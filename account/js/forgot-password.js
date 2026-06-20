document.addEventListener('DOMContentLoaded', function () {
    const phase1 = document.getElementById('phase1');
    const phase2 = document.getElementById('phase2');
    const nextBtn = document.getElementById('nextBtn');
    const resetBtn = document.getElementById('resetBtn');
    const goBackBtn = document.getElementById('goBackBtn');
    const emailInput = document.getElementById('email');
    const keyInput = document.getElementById('recoveryKey');
    const targetEmailDisplay = document.getElementById('targetEmailDisplay');
    const methodTabs = document.querySelectorAll('.method-tab');
    
    let currentMethod = 'otp';

    // --- OTP GRID LOGIC ---
    const otpDigits = document.querySelectorAll('.otp-input');
    
    otpDigits.forEach((digit, index) => {
        digit.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && index < otpDigits.length - 1) {
                otpDigits[index + 1].focus();
            }
        });

        digit.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                otpDigits[index - 1].focus();
            }
        });

        digit.addEventListener('paste', (e) => {
            e.preventDefault();
            const data = e.clipboardData.getData('text').slice(0, 6);
            if (!/^\d+$/.test(data)) return;

            data.split('').forEach((char, i) => {
                if (otpDigits[i]) otpDigits[i].value = char;
            });
            otpDigits[Math.min(data.length, otpDigits.length - 1)].focus();
        });
    });

    function getOtpCode() {
        return Array.from(otpDigits).map(d => d.value).join('');
    }

    // --- SEGMENTED METHOD SELECTOR ---
    methodTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            methodTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentMethod = tab.dataset.method;
            
            const emailGroup = document.getElementById('emailGroup');
            const keyGroup = document.getElementById('keyGroup');
            const nextBtnText = nextBtn.querySelector('.btn-text');
            const nextBtnIcon = nextBtn.querySelector('i');

            if (currentMethod === 'otp') {
                emailGroup.classList.remove('hidden');
                keyGroup.classList.add('hidden');
                nextBtnText.textContent = 'Send Code';
                nextBtnIcon.className = 'fa-regular fa-paper-plane';
            } else {
                emailGroup.classList.remove('hidden');
                keyGroup.classList.remove('hidden');
                nextBtnText.textContent = 'Continue';
                nextBtnIcon.className = 'fa-regular fa-arrow-right';
            }
        });
    });

    // --- PHASE 1 VALIDATION & SEND ---
    const keySegments = document.querySelectorAll('.key-segment');
    keySegments.forEach((segment, index) => {
        segment.addEventListener('input', (e) => {
            if (e.target.value.length === 4 && index < keySegments.length - 1) {
                keySegments[index + 1].focus();
            }
        });
        segment.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                keySegments[index - 1].focus();
            }
        });
        segment.addEventListener('paste', (e) => {
            e.preventDefault();
            const data = (e.clipboardData || window.clipboardData).getData('text').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
            for (let i = 0; i < keySegments.length; i++) {
                const chunk = data.slice(i * 4, (i * 4) + 4);
                if (chunk) {
                    keySegments[i].value = chunk.toUpperCase();
                    if (i < keySegments.length - 1 && chunk.length === 4) keySegments[i+1].focus();
                }
            }
        });
    });

    const getRecoveryKey = () => Array.from(keySegments).map(s => s.value).join('');

    nextBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const recoveryKey = getRecoveryKey();

        if (!email) {
            showFieldMsg('phase1', 'Account email required');
            return;
        }

        if (currentMethod === 'key') {
            if (recoveryKey.length < 16) {
                showFieldMsg('phase1', '16-character recovery key required');
                return;
            }
            switchToPhase2(email);
        } else {
            try {
                setLoading(nextBtn, true);
                const response = await fetch('/api/v2/auth?action=otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, type: 'recovery' })
                });

                const data = await response.json();
                if (response.ok) {
                    switchToPhase2(email);
                } else {
                    showFieldMsg('phase1', data.error || 'Identity not found');
                }
            } catch (err) {
                showFieldMsg('phase1', 'Connection lost');
            } finally {
                setLoading(nextBtn, false);
            }
        }
    });

    function switchToPhase2(email) {
        targetEmailDisplay.textContent = email;
        phase1.classList.remove('active');
        phase2.classList.add('active');
        document.getElementById('recoveryTitle').textContent = 'Finalize Security';
        document.getElementById('recoverySubtitle').textContent = 'Confirm verification and establish your new credentials.';
    }

    goBackBtn.addEventListener('click', () => {
        phase2.classList.remove('active');
        phase1.classList.add('active');
        document.getElementById('recoveryTitle').textContent = 'Recover Account';
        document.getElementById('recoverySubtitle').textContent = 'Follow the steps to regain access to your workspace.';
    });

    // --- FINAL ESTABLISHMENT ---
    resetBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const otp = getOtpCode();
        const recoveryKey = keyInput.value.trim();
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;

        if (currentMethod === 'otp' && otp.length !== 6) {
            showFieldMsg('phase2', 'Complete 6-digit proof required');
            return;
        }

        if (newPassword.length < 8) {
            showFieldMsg('phase2', 'Password must be 8+ characters');
            return;
        }

        if (newPassword !== confirmNewPassword) {
            showFieldMsg('phase2', 'Credential mismatch');
            return;
        }

        try {
            setLoading(resetBtn, true);
            const payload = {
                email,
                newPassword,
                action: 'forgot-password'
            };

            if (currentMethod === 'otp') payload.otp = otp;
            else payload.recoveryKey = recoveryKey;

            const response = await fetch('/api/v2/auth?action=forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (response.ok) {
                showFieldMsg('phase2', 'Credentials Established! Returning to login...', 'success');
                setTimeout(() => window.location.href = '/account', 2000);
            } else {
                showFieldMsg('phase2', data.error || 'Establishment failed');
            }
        } catch (err) {
            showFieldMsg('phase2', 'Network disruption');
        } finally {
            setLoading(resetBtn, false);
        }
    });

    // --- UTILITIES ---
    function showFieldMsg(phaseId, message, type = 'error') {
        const msgEl = document.getElementById(`${phaseId}-msg`);
        if (msgEl) {
            msgEl.textContent = message;
            msgEl.className = `field-msg ${type}`;
            msgEl.style.display = 'block';
            setTimeout(() => msgEl.style.display = 'none', 3500);
        }
    }

    function setLoading(btn, isLoading) {
        const textEl = btn.querySelector('.btn-text');
        const iconEl = btn.querySelector('i');
        if (isLoading) {
            btn.disabled = true;
            btn.classList.add('requesting');
            textEl.innerHTML = '<i class="fa-regular fa-loader fa-spin"></i>';
        } else {
            btn.disabled = false;
            btn.classList.remove('requesting');
            textEl.textContent = btn.id === 'nextBtn' ? (currentMethod === 'otp' ? 'Send Code' : 'Continue') : 'Establish New Password';
        }
    }
    
    document.addEventListener('click', function (e) {
        const trigger = e.target.closest('.password-toggle-trigger');
        if (trigger) {
            e.preventDefault();
            e.stopPropagation();

            const wrapper = trigger.closest('.password-wrapper');
            const input = wrapper.querySelector('input');

            if (input.type === 'password') {
                input.type = 'text';
                trigger.classList.add('is-visible');
            } else {
                input.type = 'password';
                trigger.classList.remove('is-visible');
            }
        }
    });
});
