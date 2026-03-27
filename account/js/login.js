document.addEventListener('DOMContentLoaded', function () {
  const loginForm = document.getElementById('loginForm');

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

    if (loginForm) {
      loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('remember').checked;
        if (!username || !password) {
          showFieldMsg('form', 'Please enter your credentials');
          return;
        }

      // Define submitButton outside the try block so it's accessible in the catch block
      const submitButton = this.querySelector('button[type="submit"]');
      const originalText = submitButton.textContent;

      try {
        // Show loading state
        submitButton.disabled = true;
        submitButton.textContent = 'SIGNING IN...';

        // Make login API request
        const response = await makeApiRequest('login', 'POST', {
          username,
          password
        });

        // Save token if login successful
        if (response && response.token) {
          setAuthToken(response.token);

          // Store user data if needed
          if (rememberMe && response.user) {
            localStorage.setItem('materio_user', JSON.stringify(response.user));
          }

          showFieldMsg('form', 'Login successful! Redirecting...', 'success');

          // Redirect to profile page after a short delay
          // Redirect to profile page after a short delay
          setTimeout(() => {
            // Check for redirect param in URL
            const urlParams = new URLSearchParams(window.location.search);
            const redirectUrl = urlParams.get('callback');

            if (redirectUrl) {
              // Append token to redirect URL
              // Append token to redirect URL
              const targetUrl = new URL(redirectUrl, window.location.origin);
              targetUrl.searchParams.set('handoff', response.handoffCode || '');
              window.location.href = targetUrl.toString();
            } else {
              redirectToProfile();
            }
          }, 1500);
        }
      } catch (error) {
        console.error('Login error:', error);
        showFieldMsg('form', error.message || 'Failed to sign in. Check credentials.');

        // Reset button state
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    });
  }

  // Enable social login buttons if needed (currently just UI placeholders)
  const socialButtons = document.querySelectorAll('.btn-social');
  socialButtons.forEach(button => {
    button.addEventListener('click', function () {
      showNotification('Social login is not available at this time', 'info');
    });
  });

    // --- Bulletproof Toggle Password Visibility ---
    document.addEventListener('click', function(e) {
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
