document.addEventListener('DOMContentLoaded', function () {
    const signupForm = document.getElementById('signupForm');
    const getOtpBtn = document.getElementById('getOtpBtn');
    const emailInput = document.getElementById('email');

    // --- Interactive Avatar System ---
    const mainAvatarRoot = document.getElementById('mainAvatarRoot');
    const displayNameInput = document.getElementById('displayName');
    const selectedVariantInput = document.getElementById('selectedVariant');
    const uploadBtn = document.getElementById('uploadAvatarBtn');
    const shuffleBtn = document.getElementById('shuffleAvatarBtn');
    const removeAvatarBtn = document.getElementById('removeAvatarBtn');
    const customInput = document.getElementById('customAvatarInput');

    let currentStyleIndex = 0;
    let shuffleCounter = 0;
    const STYLES = ['character', 'shape', 'face'];
    let isCustomUpload = false;

    function renderMainAvatar(seed = 'User') {
        if (isCustomUpload) return;

        const AvvComponent = window.Avvvatars || (window.AvvvatarsReactAlt && window.AvvvatarsReactAlt.Avvvatars) || window.AvvvatarsReactAlt;
        const FinalComp = (AvvComponent && AvvComponent.default) ? AvvComponent.default : AvvComponent;

        if (!mainAvatarRoot || !window.React || !window.ReactDOM || !FinalComp) return;

        const variant = STYLES[currentStyleIndex];
        selectedVariantInput.value = variant;

        // Use "Student" or any other word to avoid constant "US"
        const cleanSeed = (seed.trim() === '' || seed === 'User') ? 'Student' : seed;
        const finalSeed = shuffleCounter > 0 ? `${cleanSeed}-${shuffleCounter}` : cleanSeed;

        const root = createRootIfNotExists(mainAvatarRoot);
        root.render(React.createElement(FinalComp, {
            value: finalSeed,
            style: variant === 'face' ? 'shape' : variant,
            type: variant === 'face' ? 'face' : undefined,
            size: 70,
            radius: 35,
            shadow: true
        }));
    }

    function normalizeHexColor(value, fallback) {
        if (!value || typeof value !== 'string') return fallback;
        const color = value.trim();
        if (color.startsWith('#')) return color;
        if (/^[0-9a-fA-F]{3}$/.test(color) || /^[0-9a-fA-F]{6}$/.test(color)) return `#${color}`;
        return color;
    }

    function serializeAvatarFromRoot(rootEl, outputSize = 100) {
        if (!rootEl) return null;

        const avatarHost = rootEl.querySelector('div[size][color]');
        const avatarShape = avatarHost ? avatarHost.querySelector('span[size][color]') : null;
        const avatarSvg = avatarShape ? avatarShape.querySelector('svg') : rootEl.querySelector('[role="img"] svg, svg');
        if (!avatarSvg) return null;

        const hostSize = Number.parseFloat(avatarHost?.getAttribute('size')) || Number.parseFloat(avatarSvg.getAttribute('width')) || 70;
        const shapeSize = Number.parseFloat(avatarShape?.getAttribute('size')) || Number.parseFloat(avatarSvg.getAttribute('width')) || (hostSize * 0.5);

        const bgColor = normalizeHexColor(avatarHost?.getAttribute('color'), '#94a3b8');
        const fgColor = normalizeHexColor(avatarShape?.getAttribute('color'), '#e2e8f0');

        const ratio = hostSize > 0 ? Math.max(0.3, Math.min(0.95, shapeSize / hostSize)) : 0.5;
        const iconSize = outputSize * ratio;
        const iconOffset = (outputSize - iconSize) / 2;

        const viewBox = avatarSvg.getAttribute('viewBox');
        const vb = viewBox ? viewBox.split(/\s+/).map(Number) : [0, 0, 32, 32];
        const vbWidth = vb[2] || 32;
        const vbHeight = vb[3] || 32;

        const innerMarkup = avatarSvg.innerHTML;
        const compositedSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${outputSize}" height="${outputSize}" viewBox="0 0 ${outputSize} ${outputSize}" preserveAspectRatio="xMidYMid meet">
                <circle cx="${outputSize / 2}" cy="${outputSize / 2}" r="${outputSize / 2}" fill="${bgColor}" />
                <g transform="translate(${iconOffset}, ${iconOffset}) scale(${iconSize / vbWidth}, ${iconSize / vbHeight})" color="${fgColor}" fill="${fgColor}" stroke="${fgColor}">
                    ${innerMarkup}
                </g>
            </svg>
        `.trim();

        return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(compositedSvg)))}`;
    }

    function serializeAvatarFallback(rootEl, outputSize = 100) {
        if (!rootEl) return null;
        const svgEl = rootEl.querySelector('[role="img"] svg, svg');
        if (!svgEl) return null;

        const avatarSurface = svgEl.parentElement || rootEl;
        const surfaceStyles = window.getComputedStyle(avatarSurface);
        const bgColor = surfaceStyles.backgroundColor || '#94a3b8';
        const fgColor = surfaceStyles.color || '#e2e8f0';

        const svgRect = svgEl.getBoundingClientRect();
        const surfaceRect = avatarSurface.getBoundingClientRect();
        const ratio = surfaceRect.width > 0 ? Math.max(0.3, Math.min(0.95, svgRect.width / surfaceRect.width)) : 0.5;
        const iconSize = outputSize * ratio;
        const iconOffset = (outputSize - iconSize) / 2;

        const viewBox = svgEl.getAttribute('viewBox');
        const vb = viewBox ? viewBox.split(/\s+/).map(Number) : [0, 0, 32, 32];
        const vbWidth = vb[2] || 32;
        const vbHeight = vb[3] || 32;

        const innerMarkup = svgEl.innerHTML;
        const compositedSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${outputSize}" height="${outputSize}" viewBox="0 0 ${outputSize} ${outputSize}" preserveAspectRatio="xMidYMid meet">
                <circle cx="${outputSize / 2}" cy="${outputSize / 2}" r="${outputSize / 2}" fill="${bgColor}" />
                <g transform="translate(${iconOffset}, ${iconOffset}) scale(${iconSize / vbWidth}, ${iconSize / vbHeight})" color="${fgColor}" fill="${fgColor}" stroke="${fgColor}">
                    ${innerMarkup}
                </g>
            </svg>
        `.trim();

        return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(compositedSvg)))}`;
    }

    // Shuffle functionality
    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', () => {
            isCustomUpload = false;
            if (removeAvatarBtn) removeAvatarBtn.classList.add('hidden');
            shuffleCounter++;
            currentStyleIndex = (currentStyleIndex + 1) % STYLES.length;
            renderMainAvatar(displayNameInput.value || 'User');
        });
    }

    // Upload functionality
    if (uploadBtn && customInput) {
        uploadBtn.addEventListener('click', () => customInput.click());

        customInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    isCustomUpload = true;
                    if (removeAvatarBtn) removeAvatarBtn.classList.remove('hidden');
                    selectedVariantInput.value = 'custom';
                    
                    // Render custom image via React to maintain root integrity
                    const root = createRootIfNotExists(mainAvatarRoot);
                    root.render(React.createElement('img', {
                        src: ev.target.result,
                        id: "picturePreview",
                        style: { width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }
                    }));
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (removeAvatarBtn) {
        removeAvatarBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            isCustomUpload = false;
            removeAvatarBtn.classList.add('hidden');
            renderMainAvatar(displayNameInput ? displayNameInput.value || 'User' : 'User');
        });
    }

    // Helper to manage React roots
    const rootsMap = new WeakMap();
    function createRootIfNotExists(el) {
        if (!rootsMap.has(el)) {
            rootsMap.set(el, ReactDOM.createRoot(el));
        }
        return rootsMap.get(el);
    }

    // Update avatars when display name changes
    if (displayNameInput) {
        displayNameInput.addEventListener('input', (e) => {
            renderMainAvatar(e.target.value || 'User');
        });
    }

    // Initial render when loaded
    window.addEventListener('avvvatars-loaded', () => {
        renderMainAvatar(displayNameInput ? displayNameInput.value || 'User' : 'User');
    });

    if (window.Avvvatars) {
        renderMainAvatar('User');
    }

    function validatePhase1() {
        const username = document.getElementById('username').value.trim();
        const displayName = document.getElementById('displayName').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!username || !displayName || !email || !password) {
            showFieldMsg('form', 'Please fill all required fields');
            return false;
        }

        if (!email.endsWith('@paruluniversity.ac.in')) {
            showFieldMsg('email', 'Use your university email address');
            return false;
        }

        if (password.length < 8) {
            showFieldMsg('password', 'Password must be at least 8 characters');
            return false;
        }

        if (password !== confirmPassword) {
            showFieldMsg('confirmPassword', 'Passwords do not match');
            return false;
        }

        return true;
    }

    function showFieldMsg(fieldId, message, type = 'error') {
        let msgEl = document.getElementById(`msg-${fieldId}`);
        if (!msgEl) msgEl = document.getElementById('msg-form');

        if (msgEl) {
            msgEl.textContent = message;
            msgEl.className = `field-msg ${type}`;
            msgEl.style.display = 'block';
            msgEl.style.marginTop = '4px';

            setTimeout(() => {
                if (msgEl.textContent === message) {
                    msgEl.style.display = 'none';
                    msgEl.style.marginTop = '0';
                    msgEl.textContent = '';
                }
            }, 5000);
        }
    }

    // Phase Transitions
    const nextToOtpBtn = document.getElementById('nextToOtp');
    const backToStep1Btn = document.getElementById('backToStep1');

    if (nextToOtpBtn) {
        nextToOtpBtn.addEventListener('click', async function () {
            if (validatePhase1()) {
                const emailValue = document.getElementById('email').value.trim();

                // Set the display email IMMEDIATELY so user sees it even while loading
                const displayEl = document.getElementById('displayEmail');
                if (displayEl) displayEl.textContent = emailValue;

                try {
                    this.disabled = true;
                    this.textContent = 'SENDING...';

                    // Use the correct API V2 endpoint
                    const res = await fetch('/api/v2/auth?action=otp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: emailValue, type: 'signup' })
                    });

                    if (res.ok) {
                        document.getElementById('registration-phase').style.display = 'none';
                        document.getElementById('verification-phase').style.display = 'block';
                        showFieldMsg('otp', 'Code sent to your university email!', 'success');
                    } else {
                        const err = await res.json();
                        showFieldMsg('email', err.error || 'Failed to send OTP. Try again.');
                    }
                } catch (err) {
                    console.error('OTP Send Error:', err);
                    showFieldMsg('email', 'Connection error. Check your internet.');
                } finally {
                    this.disabled = false;
                    this.textContent = 'SEND VERIFICATION CODE';
                }
            }
        });
    }

    const resendBtn = document.getElementById('resendOtpBtn');
    if (resendBtn) {
        resendBtn.addEventListener('click', async function () {
            const emailValue = document.getElementById('email').value.trim();
            try {
                this.classList.add('requesting');
                const res = await fetch('/api/v2/auth?action=otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailValue, type: 'signup' })
                });
                if (res.ok) {
                    showFieldMsg('otp', 'New code sent!', 'success');
                }
            } catch (err) { }
            finally { this.classList.remove('requesting'); }
        });
    }

    if (backToStep1Btn) {
        backToStep1Btn.addEventListener('click', function () {
            document.getElementById('verification-phase').style.display = 'none';
            document.getElementById('registration-phase').style.display = 'block';
        });
    }

    // --- OTP Block Interaction Logic ---
    const otpInputs = document.querySelectorAll('.otp-input');
    otpInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            const val = e.target.value;
            // Only numbers
            if (!/^\d$/.test(val)) {
                e.target.value = '';
                return;
            }
            if (val && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                otpInputs[index - 1].focus();
            }
        });

        // Handle Paste
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const data = e.clipboardData.getData('text').slice(0, 6);
            if (!/^\d+$/.test(data)) return;

            data.split('').forEach((char, i) => {
                if (otpInputs[i]) otpInputs[i].value = char;
            });
            otpInputs[Math.min(data.length, otpInputs.length - 1)].focus();
        });
    });

    // Final Submission
    if (signupForm) {
        signupForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const otpCode = Array.from(otpInputs).map(i => i.value).join('');
            if (otpCode.length < 6) {
                showFieldMsg('otp', 'Please enter 6-digit code');
                return;
            }

            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());
            data.otp = otpCode;

            const avatarSeed = isCustomUpload ? 'custom' : (shuffleCounter > 0 ? `${displayNameInput.value || 'User'}-${shuffleCounter}` : displayNameInput.value || 'User');
            data.avatarSeed = avatarSeed;
            data.isCustomAvatar = isCustomUpload;

            // --- AVATAR CAPTURE LOGIC (Exact SVG serialization to preserve scale/alignment) ---
            if (!isCustomUpload) {
                const serializedSvgDataUri = serializeAvatarFromRoot(mainAvatarRoot, 100) || serializeAvatarFallback(mainAvatarRoot, 100);
                if (serializedSvgDataUri) data.profilePicture = serializedSvgDataUri;
            } else {
                const previewImg = mainAvatarRoot.querySelector('img');
                if (previewImg) data.profilePicture = previewImg.src;
            }

            try {
                const submitBtn = this.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.textContent = 'Joining...';

                const res = await fetch('/api/v2/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (res.ok) {
                    showFieldMsg('form', 'Welcome to Materio! Redirecting...', 'success');
                    setTimeout(() => window.location.href = '/account/profile', 1500);
                } else {
                    const err = await res.json();
                    showFieldMsg('form', err.error || 'Registration failed. Check details.');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Count Me In';
                }
            } catch (err) {
                showFieldMsg('form', 'Network error. Please try again.');
                this.querySelector('button[type="submit"]').disabled = false;
                this.querySelector('button[type="submit"]').textContent = 'Count Me In';
            }
        });
    }

    // --- Bulletproof Toggle Password Visibility ---
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

    // --- Auto-calculate Passout Year ---
    const yearSelect = document.getElementById('currentYear');
    const passoutInput = document.getElementById('passoutYear');
    if (yearSelect && passoutInput) {
        yearSelect.addEventListener('change', (e) => {
            const currentYearValue = parseInt(e.target.value);
            if (!isNaN(currentYearValue)) {
                // Calculation: Current Year (e.g., 2026) + (4 - Study Year)
                const calculatedYear = new Date().getFullYear() + (4 - currentYearValue);
                passoutInput.value = calculatedYear;
                showFieldMsg('form', `Estimated graduation: ${calculatedYear}`, 'success');
            }
        });
    }
});
