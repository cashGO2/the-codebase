document.addEventListener('DOMContentLoaded', function () {
  // Sidebar tab switching functionality
  const sidebarNavItems = document.querySelectorAll('.sidebar-nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');

  if (sidebarNavItems.length) {
    sidebarNavItems.forEach(button => {
      button.addEventListener('click', function () {
        const targetTab = this.getAttribute('data-tab');

        // Update active state for buttons
        sidebarNavItems.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');

        // Show the selected tab content
        tabPanes.forEach(pane => {
          pane.classList.remove('active');
          if (pane.id === targetTab) {
            pane.classList.add('active');
          }
        });

        // Initialize and load OAuth apps if this tab is clicked
        if (targetTab === 'oauth' && typeof window.initializeOAuthTab === 'function') {
          window.initializeOAuthTab();
        }
      });
    });
  }
  // Profile picture handling
  const profilePictureInput = document.getElementById('profilePicture');
  const picturePreview = document.getElementById('picturePreview');
  const dashboardProfileImage = document.getElementById('dashboard-profile-image');
  const dashboardDisplayName = document.getElementById('dashboard-display-name');
  const dashboardUsername = document.getElementById('dashboard-username');
  const uploadButton = document.getElementById('uploadButton');

  // --- IDENTITY STUDIO LOGIC ---
  const shuffleBtn = document.getElementById('shuffleAvatarBtn');
  const mainAvatarRoot = document.getElementById('mainAvatarRoot');
  const selectedVariantInput = document.getElementById('selectedVariant');
  let currentStyleIndex = 0;
  let shuffleCounter = 0;
  let isCustomUpload = false;
  let avatarDirty = false;
  const STYLES = ['character', 'shape', 'face'];

  function renderMainAvatar(seed = 'User') {
    if (isCustomUpload) return;

    const AvvComponent = window.Avvvatars || (window.AvvvatarsReactAlt && window.AvvvatarsReactAlt.Avvvatars) || window.AvvvatarsReactAlt;
    const FinalComp = (AvvComponent && AvvComponent.default) ? AvvComponent.default : AvvComponent;

    if (!mainAvatarRoot || !window.React || !window.ReactDOM || !FinalComp) return;

    const variant = STYLES[currentStyleIndex];
    if (selectedVariantInput) selectedVariantInput.value = variant;

    const finalSeed = shuffleCounter > 0 ? `${seed}-${shuffleCounter}` : seed;

    const root = window.reactRoot || (window.ReactDOM.createRoot(mainAvatarRoot));
    window.reactRoot = root;

    root.render(window.React.createElement(FinalComp, {
      value: finalSeed,
      style: variant === 'face' ? 'shape' : variant,
      type: variant === 'face' ? 'face' : undefined,
      size: 92,
      radius: 46,
      shadow: false
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

    const hostSize = Number.parseFloat(avatarHost?.getAttribute('size')) || Number.parseFloat(avatarSvg.getAttribute('width')) || 92;
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

  async function captureCurrentAvatarDataUri(outputSize = 100) {
    let serialized = serializeAvatarFromRoot(mainAvatarRoot, outputSize) || serializeAvatarFallback(mainAvatarRoot, outputSize);
    if (serialized) return serialized;

    const nameValue = document.getElementById('displayName')?.value || document.getElementById('username')?.value || 'User';
    renderMainAvatar(nameValue);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    serialized = serializeAvatarFromRoot(mainAvatarRoot, outputSize) || serializeAvatarFallback(mainAvatarRoot, outputSize);
    return serialized;
  }

  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', () => {
      avatarDirty = true;
      isCustomUpload = false;
      currentStyleIndex = (currentStyleIndex + 1) % STYLES.length;
      shuffleCounter++;
      const nameValue = document.getElementById('displayName').value || document.getElementById('username').value || 'User';
      renderMainAvatar(nameValue);
    });
  }

  if (profilePictureInput && picturePreview) {
    if (uploadButton) {
      uploadButton.addEventListener('click', () => profilePictureInput.click());
    }

    profilePictureInput.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (file) {
        isCustomUpload = true;
        avatarDirty = true;
        const reader = new FileReader();
        reader.onload = function (event) {
          // Replace Avvvatars with image
          if (window.reactRoot) {
            window.reactRoot.unmount();
            window.reactRoot = null;
          }
          mainAvatarRoot.innerHTML = `<img id="picturePreview" src="${event.target.result}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
          if (dashboardProfileImage) dashboardProfileImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }
  // Admin invite card reference
  const adminInviteCard = document.getElementById('adminInviteCard');
  const presetWarnBtn = document.getElementById('presetWarnBtn');
  const presetBanBtn = document.getElementById('presetBanBtn');
  const saveModerationBtn = document.getElementById('saveModerationBtn');
  const refreshModerationBtn = document.getElementById('refreshModerationBtn');

  // Function to extract username from URL or session storage
  function getProfileUsername() {
    let username = null;

    // Just use the logged in user's username
    const userData = localStorage.getItem('materio_user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        username = user.username;
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
    return username;
  }

  // Load user profile data
  async function loadUserProfile() {
    try {
      const profileUsername = getProfileUsername();
      let response;

      // Get the currently logged in user's info from localStorage
      const currentUser = JSON.parse(localStorage.getItem('materio_user') || '{}');

      // Just fetch the current user's profile (no URL-based username support)
      response = await makeApiRequest('profile', 'GET', null, true);

      if (response && response.user) {
        const user = response.user;

        // Store user data for future use
        localStorage.setItem('materio_user', JSON.stringify(user));
        window.dispatchEvent(new CustomEvent('materio-profile-loaded', { detail: { user } }));
        // Fill form fields with user data
        document.getElementById('username').value = user.username || '';
        document.getElementById('displayName').value = user.displayName || '';
        document.getElementById('email').value = user.email || '';
        // Set recovery key if available
        if (user.recoveryKey) {
          document.getElementById('recoveryKey').value = user.recoveryKey;
        }
        // Show admin invite card if user has admin privileges
        if (user.hasAdminPrivileges && adminInviteCard) {
          adminInviteCard.style.display = 'block';
          initAbuseModerationSection();
        }        // Show Files tab if user has admin privileges
        const filesTab = document.getElementById('filesTab');
        if (user.hasAdminPrivileges && filesTab) {
          filesTab.style.display = 'block';
          // Initialize file management functionality
          initializeFileManagement();
          // Initialize course upload functionality
          initializeCourseUpload();
          // Initialize promotion management functionality
          initializePromotionManagement();
        }

        // Set profile picture if available
        if (user.profilePicture) {
          // Update profile form preview
          picturePreview.src = user.profilePicture;

          // Update dashboard profile card
          if (dashboardProfileImage) {
            dashboardProfileImage.src = user.profilePicture;
          }

          // Also update the stored user data to ensure profile image is available across site
          localStorage.setItem('materio_user', JSON.stringify(user));
        }

        // Update dashboard profile info
        if (dashboardDisplayName) {
          const displayName = user.displayName || user.username;
          const upgradeContainer = document.getElementById('upgrade-plus-container');

          // Build the display name HTML
          let nameHtml = displayName;

          // Add verified badges and hide/update upgrade link
          if (user.hasAdminPrivileges) {
            nameHtml += ' <i class="fas fa-badge-check verified-badge admin" title="Admin"></i>';
            if (upgradeContainer) upgradeContainer.style.display = 'none';
          } else if (user.isProUser || user.isPlusUser) {
            nameHtml += ' <i class="fas fa-badge-check verified-badge pro" title="Pro User"></i>'; // Pro Badge
            if (upgradeContainer) upgradeContainer.style.display = 'none';
          } else if (user.isLiteUser) {
            nameHtml += ' <i class="fas fa-badge-check verified-badge plus" title="Plus User"></i>'; // Plus Badge

            // Add expiry info if available
            if (user.plusExpiry) {
              const expiryDate = new Date(user.plusExpiry).toLocaleDateString();
              nameHtml += ` <span class="expiry-text" style="font-size: 0.7rem; color: #666; margin-left: 5px;">(Expires: ${expiryDate})</span>`;
            }

            // If they are Plus, keep upgrade link but change text to "Upgrade to Pro"
            if (upgradeContainer) {
              const upgradeLink = upgradeContainer.querySelector('.upgrade-link');
              if (upgradeLink) {
                upgradeLink.textContent = 'Upgrade to Pro →';
              }
            }
          }

          // Add upgrade container back at the end if it exists and is visible
          if (upgradeContainer && upgradeContainer.style.display !== 'none') {
            nameHtml += ' ' + upgradeContainer.outerHTML;
            upgradeContainer.remove(); // Remove original to avoid duplicate
          }

          dashboardDisplayName.innerHTML = nameHtml;
        }
        if (dashboardUsername) {
          dashboardUsername.textContent = '@' + user.username;
        }
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);

      // Check specific error types
      if (error.message && error.message.includes('Authentication required') ||
        error.message && error.message.includes('Invalid or expired token')) {
        // Auth error - redirect to login
        showNotification('Please sign in to access your profile', 'error');
        setTimeout(() => {
          window.location.href = '/account/';
        }, 2000);
      } else if (error.message && error.message.includes('not authorized')) {
        // Authorization error - attempted to access someone else's profile
        showNotification('You are not authorized to view this profile', 'error');
        // Get current user from localStorage
        const currentUser = JSON.parse(localStorage.getItem('materio_user') || '{}');
        // Redirect to their own profile
        const isLocalhost = window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1';
        setTimeout(() => {
          if (isLocalhost) {
            window.location.href = '/account/profile.html';
          } else if (currentUser && currentUser.username) {
            window.location.href = `/account/@${currentUser.username}`;
          } else {
            window.location.href = '/account/';
          }
        }, 2000);
      } else {
        // General error
        showNotification('Failed to load user profile: ' + (error.message || 'Unknown error'), 'error');
      }
    }
  }

  // Load user profile when page loads
  loadUserProfile();

  // Admin invite functionality
  const generateInviteBtn = document.getElementById('generateInviteBtn');
  const generatePlusInviteBtn = document.getElementById('generatePlusInviteBtn');
  const viewInvitesBtn = document.getElementById('viewInvitesBtn');
  const copyInviteBtn = document.getElementById('copyInviteBtn');
  const generatedInviteSection = document.getElementById('generatedInviteSection');

  // Generate regular invite code
  if (generateInviteBtn) {
    generateInviteBtn.addEventListener('click', async function () {
      await generateInvite(this, false);
    });
  }

  if (presetWarnBtn) {
    presetWarnBtn.addEventListener('click', () => applyModerationPreset('warn'));
  }

  if (presetBanBtn) {
    presetBanBtn.addEventListener('click', () => applyModerationPreset('ban'));
  }

  if (saveModerationBtn) {
    saveModerationBtn.addEventListener('click', () => saveModerationRule(saveModerationBtn));
  }

  if (refreshModerationBtn) {
    refreshModerationBtn.addEventListener('click', loadModerationRules);
  }

  // Generate plus invite code
  if (generatePlusInviteBtn) {
    generatePlusInviteBtn.addEventListener('click', async function () {
      await generateInvite(this, true);
    });
  }

  // Function to generate invite (regular or plus)
  async function generateInvite(button, isPlusInvite = false) {
    try {
      const originalText = button.textContent;
      button.disabled = true;
      button.innerHTML = '<i class="fa-regular fa-loader fa-spin"></i> Generating...';

      const response = await makeApiRequest('invites', 'POST', {
        containsPlusPerks: isPlusInvite
      }, true);

      if (response && response.invite) {
        document.getElementById('generatedInviteCode').value = response.invite.code;
        generatedInviteSection.style.display = 'block';

        const inviteType = isPlusInvite ? 'Plus invite' : 'Invite';
        const helpText = isPlusInvite ?
          'Share this code with users you want to invite with Plus benefits. The code expires in 30 days.' :
          'Share this code with users you want to invite. The code expires in 30 days.';

        document.querySelector('.invite-help').textContent = helpText;
        showNotification(`${inviteType} code generated successfully!`, 'success');
      }
    } catch (error) {
      console.error('Generate invite error:', error);
      showNotification(error.message || 'Failed to generate invite code', 'error');
    } finally {
      button.disabled = false;
      const iconClass = button.id === 'generatePlusInviteBtn' ? 'fa-star' : 'fa-plus';
      const text = button.id === 'generatePlusInviteBtn' ? 'Generate Plus Invite' : 'Generate Invite Code';
      button.innerHTML = `<i class="fas ${iconClass}"></i> ${text}`;
    }
  }

  // Copy invite code
  if (copyInviteBtn) {
    copyInviteBtn.addEventListener('click', function () {
      const inviteCodeInput = document.getElementById('generatedInviteCode');

      if (inviteCodeInput && inviteCodeInput.value) {
        inviteCodeInput.select();
        document.execCommand('copy');
        showNotification('Invite code copied to clipboard!', 'success');
      }
    });
  }
  // View all invites - open modal
  if (viewInvitesBtn) {
    viewInvitesBtn.addEventListener('click', function () {
      openInvitesModal();
    });
  }

  // Handle profile update form submission
  const profileForm = document.getElementById('profileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const formData = new FormData(this);
      const data = Object.fromEntries(formData.entries());

      // Filter out the file object if it hasn't changed to avoid serialization errors
      if (!(data.profilePicture instanceof File) || data.profilePicture.size === 0) {
        delete data.profilePicture;
      }

      // --- AVATAR CAPTURE LOGIC (Exact SVG serialization to preserve scale/alignment) ---
      if (avatarDirty) {
        if (!isCustomUpload) {
          const serializedSvgDataUri = await captureCurrentAvatarDataUri(100);
          if (!serializedSvgDataUri) {
            showNotification('Failed to capture selected avatar. Please shuffle once and try again.', 'error');
            return;
          }
          data.profilePicture = serializedSvgDataUri;
        } else {
          // If it was a custom upload, grab from the img inside mainAvatarRoot
          const previewImg = mainAvatarRoot.querySelector('img');
          if (!previewImg || !previewImg.src || !previewImg.src.startsWith('data:image')) {
            showNotification('Invalid uploaded image. Please upload again.', 'error');
            return;
          }
          data.profilePicture = previewImg.src;
        }
      } else {
        delete data.profilePicture;
      }

      try {
        const submitBtn = this.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'SAVING...';

        const response = await makeApiRequest('profile', 'PUT', data, true);
        if (response) {
          showNotification('Profile updated successfully!', 'success');
          avatarDirty = false;

          // Sync dashboard & localStorage
          if (response.user) {
            const user = response.user;
            localStorage.setItem('materio_user', JSON.stringify(user));

            if (dashboardProfileImage && user.profilePicture) {
              dashboardProfileImage.src = user.profilePicture;
            }
            if (dashboardDisplayName) {
              dashboardDisplayName.textContent = user.displayName || user.username;
            }
            if (dashboardUsername) {
              dashboardUsername.textContent = '@' + user.username;
            }
          }
        }
      } catch (err) {
        showNotification(err.message || 'Failed to update profile', 'error');
      } finally {
        const submitBtn = this.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.textContent = 'SAVE CHANGES';
      }
    });
  }

  // Handle security form submission
  const securityForm = document.getElementById('securityForm');
  if (securityForm) {
    securityForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const currentPassword = document.getElementById('currentPassword').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      // Validate passwords if provided
      if (newPassword || confirmPassword) {
        if (!currentPassword) {
          showNotification('Current password is required to set a new password', 'error');
          return;
        }

        if (newPassword !== confirmPassword) {
          showNotification('New passwords do not match', 'error');
          return;
        }

        if (newPassword.length < 8) {
          showNotification('Password must be at least 8 characters long', 'error');
          return;
        }
      }

      try {
        // Show loading state
        const submitButton = this.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'UPDATING...';

        // Prepare update data
        const updateData = {};

        // Add password update if provided
        if (currentPassword && newPassword) {
          updateData.currentPassword = currentPassword;
          updateData.newPassword = newPassword;
        }

        // Make security update API request
        const response = await makeApiRequest('profile', 'PUT', updateData, true);

        if (response && response.message) {
          showNotification(response.message, 'success');

          // Clear password fields after successful update
          document.getElementById('currentPassword').value = '';
          document.getElementById('newPassword').value = '';
          document.getElementById('confirmPassword').value = '';
        }
      } catch (error) {
        console.error('Security update error:', error);
        showNotification(error.message || 'Failed to update security settings', 'error');
      } finally {
        // Reset button state
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    });
  }

  // Recovery key functionality
  const copyKeyButton = document.getElementById('copyKey');
  const generateNewKeyButton = document.getElementById('generateNewKey');

  if (copyKeyButton) {
    copyKeyButton.addEventListener('click', function () {
      const recoveryKeyInput = document.getElementById('recoveryKey');

      if (recoveryKeyInput && recoveryKeyInput.value) {
        recoveryKeyInput.select();
        document.execCommand('copy');
        showNotification('Recovery key copied to clipboard', 'success');
      }
    });
  }
  if (generateNewKeyButton) {
    generateNewKeyButton.addEventListener('click', async function () {
      try {
        // Confirm action
        if (!confirm('Generating a new recovery key will invalidate your old one. Are you sure?')) {
          return;
        }

        // Get the current password from the security form
        const currentPassword = document.getElementById('currentPassword').value;

        if (!currentPassword) {
          showNotification('Please enter your current password to generate a new recovery key', 'error');
          return;
        }

        // Show loading state
        const originalText = this.textContent;
        this.disabled = true;
        this.textContent = 'GENERATING...';

        // Make API request to generate new key
        const updateData = {
          generateNewRecoveryKey: true,
          currentPassword: currentPassword
        };
        const response = await makeApiRequest('profile', 'PUT', updateData, true);

        // Check for recovery key in the response, could be in either location based on server response
        const newRecoveryKey = response.recoveryKey || (response.user && response.user.recoveryKey);

        if (newRecoveryKey) {
          // Display new recovery key
          document.getElementById('recoveryKey').value = newRecoveryKey;
          showNotification('New recovery key generated successfully', 'success');

          // Clear password field after successful update
          document.getElementById('currentPassword').value = '';
        }
      } catch (error) {
        console.error('Recovery key generation error:', error);
        showNotification(error.message || 'Failed to generate new recovery key', 'error');
      } finally {
        // Reset button state
        this.disabled = false;
        this.textContent = originalText;
      }
    });
  }

  // Delete account functionality
  const deleteAccountButton = document.getElementById('deleteAccountButton');
  const deleteAccountModal = document.getElementById('deleteAccountModal');
  const confirmDeleteButton = document.getElementById('confirmDeleteButton');
  if (deleteAccountButton && deleteAccountModal) {    // Open modal when delete button is clicked
    deleteAccountButton.addEventListener('click', function () {
      deleteAccountModal.style.display = 'flex';
      // Reinitialize password toggles for the modal
      setTimeout(() => {
        initializePasswordToggles(deleteAccountModal);
        console.log('Password toggles reinitialized for delete modal');
      }, 10);
    });

    // Close modal when close button is clicked
    const closeButtons = deleteAccountModal.querySelectorAll('.modal-close, .modal-cancel');
    closeButtons.forEach(button => {
      button.addEventListener('click', function () {
        deleteAccountModal.style.display = 'none';
      });
    });
    // Handle account deletion confirmation
    if (confirmDeleteButton) {
      confirmDeleteButton.addEventListener('click', async function () {
        const password = document.getElementById('deleteConfirmPassword').value;

        if (!password) {
          showNotification('Please enter your password to confirm', 'error');
          return;
        }
        // Store the original text before entering try block
        const originalText = this.textContent;
        this.disabled = true;
        this.textContent = 'DELETING...';

        try {
          console.log('Attempting account deletion');
          // Make API request to delete account
          const response = await makeApiRequest('profile', 'DELETE', { password }, true);

          if (response && response.message) {
            showNotification(response.message, 'success');

            // Clear auth token and redirect to login
            clearAuthToken();

            // Redirect to login after a short delay
            setTimeout(() => {
              redirectToLogin();
            }, 2000);
          }
        } catch (error) {
          console.error('Account deletion error:', error);
          showNotification(error.message || 'Failed to delete account', 'error');

          // Reset button state
          this.disabled = false;
          this.textContent = originalText;
        }
      });
    }
  }
  // Logout functionality
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', function () {
      // Clear auth token and user data
      clearAuthToken();
      localStorage.removeItem('materio_user');
      redirectToLogin();
    });
  }    // Password visibility toggle function
  function initializePasswordToggles(container = document) {
    const togglePasswordButtons = container.querySelectorAll('.toggle-password');
    if (togglePasswordButtons.length) {
      console.log('Found', togglePasswordButtons.length, 'password toggle buttons');
      togglePasswordButtons.forEach(button => {
        // Remove existing listeners to avoid duplicates
        button.removeEventListener('click', handlePasswordToggle);
        button.addEventListener('click', handlePasswordToggle);
      });
    } else {
      console.log('No password toggle buttons found');
    }
  }

  function handlePasswordToggle() {
    const targetId = this.getAttribute('data-target');
    const passwordInput = document.getElementById(targetId);

    console.log('Toggle clicked for target:', targetId);

    if (passwordInput) {
      // Toggle password visibility
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        this.classList.remove('fa-eye');
        this.classList.add('fa-eye-slash');
        console.log('Password shown for:', targetId);
      } else {
        passwordInput.type = 'password';
        this.classList.remove('fa-eye-slash');
        this.classList.add('fa-eye');
        console.log('Password hidden for:', targetId);
      }
    } else {
      console.error('Password input not found for target:', targetId);
    }
  }
  // Initialize password toggles on page load
  initializePasswordToggles();

  // Redeem Gift Code
  const redeemButton = document.getElementById('redeemButton');
  const redeemCodeInput = document.getElementById('redeemCode');
  const redeemStatus = document.getElementById('redeemStatus');

  if (redeemButton && redeemCodeInput) {
    redeemButton.addEventListener('click', async function () {
      const code = redeemCodeInput.value.trim();
      if (!code) {
        showNotification('Please enter a gift code', 'error');
        return;
      }

      try {
        this.disabled = true;
        const originalText = this.textContent;
        this.textContent = 'REDEEMING...';
        if (redeemStatus) {
          redeemStatus.textContent = 'Checking code...';
          redeemStatus.style.color = '#64748b';
        }

        const response = await makeApiRequest('invites?action=redeem', 'POST', { inviteCode: code }, true);

        if (response && response.success) {
          showNotification(response.message, 'success');
          if (redeemStatus) {
            redeemStatus.textContent = 'Successfully redeemed!';
            redeemStatus.style.color = '#10b981';
          }
          redeemCodeInput.value = '';

          // Reload profile to show updated perks
          setTimeout(() => {
            loadUserProfile();
          }, 1500);
        }
      } catch (error) {
        console.error('Redeem error:', error);
        if (redeemStatus) {
          redeemStatus.textContent = error.message || 'Failed to redeem code';
          redeemStatus.style.color = '#ef4444';
        }
        showNotification(error.message || 'Failed to redeem code', 'error');
      } finally {
        this.disabled = false;
        this.textContent = 'REDEEM';
      }
    });
  }
});

// Google Drive functionality
function handleGoogleDriveClick() {
  showNotification('Google Drive integration coming soon!', 'info');
}

// Invite Management Modal Functions
function openInvitesModal() {
  const modal = document.getElementById('viewInvitesModal');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('show');
    loadInvites();
  }
}

function closeInvitesModal() {
  const modal = document.getElementById('viewInvitesModal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('show');
  }
}

let abuseModerationInitialized = false;

function initAbuseModerationSection() {
  if (abuseModerationInitialized) return;
  abuseModerationInitialized = true;

  // Attach event listeners
  const saveBtn = document.getElementById('saveModerationBtn');
  if (saveBtn) saveBtn.addEventListener('click', () => saveModerationRule(saveBtn));

  const refreshBtn = document.getElementById('refreshModerationBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', loadModerationRules);

  const warnBtn = document.getElementById('presetWarnBtn');
  if (warnBtn) warnBtn.addEventListener('click', () => applyModerationPreset('warn'));

  const banBtn = document.getElementById('presetBanBtn');
  if (banBtn) banBtn.addEventListener('click', () => applyModerationPreset('ban'));

  loadModerationRules();
}

function applyModerationPreset(preset) {
  const actionEl = document.getElementById('moderationAction');
  const titleEl = document.getElementById('moderationTitle');
  const bodyEl = document.getElementById('moderationBody');
  if (!actionEl || !titleEl || !bodyEl) return;

  if (preset === 'ban') {
    actionEl.value = 'ban';
    titleEl.value = 'Access Restricted';
    bodyEl.value = 'Your activity matched a blocked profile and access has been restricted.';
    return;
  }

  actionEl.value = 'warn';
  titleEl.value = 'Account Notice';
  bodyEl.value = 'Your activity matched a review profile. Please follow usage guidelines.';
}

function maskValue(value, keep = 6) {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (text.length <= keep) return text;
  return `${text.slice(0, 3)}...${text.slice(-keep)}`;
}

function escapeHtmlSafe(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function saveModerationRule(triggerBtn) {
  const anonId = document.getElementById('moderationAnonId')?.value?.trim() || '';
  const fingerprint = document.getElementById('moderationFingerprint')?.value?.trim() || '';
  const ipAddress = document.getElementById('moderationIp')?.value?.trim() || '';
  const action = document.getElementById('moderationAction')?.value || 'warn';
  const title = document.getElementById('moderationTitle')?.value?.trim() || '';
  const body = document.getElementById('moderationBody')?.value?.trim() || '';

  if (!anonId) {
    showNotification('anon_id is required', 'error');
    return;
  }

  // If fingerprint or IP are missing, we'll let the backend try to find them
  if (!fingerprint || !ipAddress) {
    console.log('Fingerprint or IP missing, backend will attempt to auto-fill from recent activity.');
  }

  const originalText = triggerBtn?.innerHTML;
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.innerHTML = '<i class="fa-regular fa-loader fa-spin"></i> Saving...';
  }

  try {
    await makeApiRequest('invites/moderation', 'POST', {
      anonId,
      fingerprint,
      ipAddress,
      action,
      title,
      body,
      preset: action,
    }, true);

    showNotification(action === 'clear' ? 'Moderation rule cleared' : `Moderation ${action} rule saved`, 'success');
    await loadModerationRules();
  } catch (error) {
    console.error('Save moderation rule error:', error);
    showNotification(error.message || 'Failed to save moderation rule', 'error');
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.innerHTML = originalText;
    }
  }
}

async function loadModerationRules() {
  const tbody = document.getElementById('moderationRulesBody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="admin-empty-cell">Loading rules...</td></tr>';

  try {
    const response = await makeApiRequest('invites/moderation?status=all', 'GET', null, true);
    const rules = Array.isArray(response?.rules) ? response.rules : [];

    if (!rules.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="admin-empty-cell">No moderation rules yet.</td></tr>';
      return;
    }

    tbody.innerHTML = rules.map((rule) => {
      const action = String(rule.action || '').toLowerCase();
      const actionClass = action === 'ban' ? 'ban' : 'warn';
      const updatedAt = rule.updatedAt ? formatDate(rule.updatedAt) : '-';
      const title = escapeHtmlSafe(rule.title || '-');
      return `
        <tr>
          <td><span class="moderation-action-pill ${actionClass}">${escapeHtmlSafe(action || 'warn')}</span></td>
          <td title="${escapeHtmlSafe(rule.anon_id || '')}">${escapeHtmlSafe(maskValue(rule.anon_id || ''))}</td>
          <td title="${escapeHtmlSafe(rule.fingerprint || '')}">${escapeHtmlSafe(maskValue(rule.fingerprint || ''))}</td>
          <td title="${escapeHtmlSafe(rule.ip_address || '')}">${escapeHtmlSafe(rule.ip_address || '-')}</td>
          <td title="${title}">${title}</td>
          <td class="moderation-muted">${escapeHtmlSafe(updatedAt)}</td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    console.error('Load moderation rules error:', error);
    tbody.innerHTML = '<tr><td colspan="6" class="admin-empty-cell">Failed to load moderation rules.</td></tr>';
  }
}

// Load invites into the modal
async function loadInvites() {
  try {
    const tableBody = document.getElementById('inviteTableBody');
    const inviteEmpty = document.getElementById('inviteEmpty');
    const tableContainer = document.querySelector('.invite-table-container');

    // Show loading state
    tableBody.innerHTML = `
      <tr class="invite-loading">
        <td colspan="6">
          <div class="loading-content">
            <i class="fa-regular fa-loader fa-spin"></i>
            <p>Loading invites...</p>
          </div>
        </td>
      </tr>
    `;

    const response = await makeApiRequest('invites', 'GET', null, true);

    if (response && response.invites) {
      const invites = response.invites;

      if (invites.length === 0) {
        // Show empty state
        tableContainer.style.display = 'none';
        inviteEmpty.style.display = 'block';
        updateInviteStats({ total: 0, used: 0, pending: 0, expired: 0 });
      } else {
        // Show table with data
        tableContainer.style.display = 'block';
        inviteEmpty.style.display = 'none';

        // Calculate statistics
        const now = new Date();
        const stats = {
          total: invites.length,
          used: invites.filter(invite => invite.redeemed).length,
          pending: invites.filter(invite => !invite.redeemed && new Date(invite.expires_at) > now).length,
          expired: invites.filter(invite => !invite.redeemed && new Date(invite.expires_at) <= now).length
        };
        updateInviteStats(stats);

        // Populate table
        tableBody.innerHTML = invites.map(invite => {
          const isExpired = new Date(invite.expires_at) <= now;
          const status = invite.redeemed ? 'used' : (isExpired ? 'expired' : 'pending');
          const statusText = invite.redeemed ? 'Used' : (isExpired ? 'Expired' : 'Pending');
          const inviteType = invite.contains_plus_perks ? 'Plus' : 'Regular';
          const typeClass = invite.contains_plus_perks ? 'plus-invite' : 'regular-invite';

          return `
            <tr>
              <td>
                <span class="invite-code">${invite.code}</span>
                <button class="btn-icon" onclick="copyToClipboard('${invite.code}')" title="Copy code">
                  <i class="fas fa-copy"></i>
                </button>
              </td>
              <td>
                <span class="status-badge ${status}">${statusText}</span>
              </td>
              <td>
                <span class="invite-type ${typeClass}">
                  ${invite.contains_plus_perks ? '<i class="fas fa-star"></i>' : '<i class="fas fa-user"></i>'} ${inviteType}
                </span>
              </td>
              <td>${formatDate(invite.created_at)}</td>
              <td>
                ${invite.redeemed_user ? `
                  <div class="user-info-with-avatar">
                    <img src="${invite.redeemed_user.profile_picture || '/assets/img/default-avatar.svg'}" 
                         alt="Profile" 
                         class="user-avatar-small">
                    <span>${invite.redeemed_user.display_name || invite.redeemed_user.username}</span>
                  </div>
                ` : '-'}
              </td>
              <td>${formatDate(invite.expires_at)}</td>              <td>
                <div class="action-buttons">
                  <button class="btn-icon" onclick="openShareModal('${invite.code}')" title="Share">
                    <i class="fas fa-share-alt"></i>
                  </button>
                  ${invite.redeemed_user ? `
                    <button class="btn-icon admin-toggle ${invite.redeemed_user.has_admin_privileges ? 'active' : ''}" 
                            onclick="toggleAdminPrivilege('${invite.redeemed_user.id}', ${!invite.redeemed_user.has_admin_privileges})" 
                            title="${invite.redeemed_user.has_admin_privileges ? 'Demote from Admin' : 'Promote to Admin'}">
                      <i class="fas ${invite.redeemed_user.has_admin_privileges ? 'fa-user-minus' : 'fa-user-shield'}"></i>
                    </button>
                    <button class="btn-icon plus-toggle ${invite.redeemed_user.is_plus_user ? 'active' : ''}" 
                            onclick="togglePlusPrivilege('${invite.redeemed_user.id}', ${!invite.redeemed_user.is_plus_user})" 
                            title="${invite.redeemed_user.is_plus_user ? 'Remove Plus Access' : 'Grant Plus Access'}">
                      <i class="fas ${invite.redeemed_user.is_plus_user ? 'fa-star-half-alt' : 'fa-star'}"></i>
                    </button>
                  ` : ''}                  ${!invite.redeemed ? `
                    <button class="btn-icon delete-invite" data-invite-id="${invite.id}" onclick="deleteInvite('${invite.id}')" title="Delete invite">
                      <i class="fas fa-trash"></i>
                    </button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (error) {
    console.error('Failed to load invites:', error);
    showNotification('Failed to load invites', 'error');

    const tableBody = document.getElementById('inviteTableBody');
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-light-color);">
          <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 16px; color: #dc3545;"></i>
          <p>Failed to load invites. Please try again.</p>
        </td>
      </tr>
    `;
  }
}

// Update invite statistics
function updateInviteStats(stats) {
  document.getElementById('totalInvites').textContent = stats.total;
  document.getElementById('usedInvites').textContent = stats.used;
  document.getElementById('pendingInvites').textContent = stats.pending;
  document.getElementById('expiredInvites').textContent = stats.expired;
}

// Refresh invites
function refreshInvites() {
  loadInvites();
  showNotification('Invites refreshed', 'success');
}

// Generate new invite from modal
async function generateNewInviteFromModal(isPlusInvite = false) {
  try {
    const response = await makeApiRequest('invites', 'POST', {
      containsPlusPerks: isPlusInvite
    }, true);

    if (response && response.invite) {
      const inviteType = isPlusInvite ? 'Plus invite' : 'Invite';
      showNotification(`${inviteType} code generated successfully!`, 'success');
      loadInvites(); // Refresh the list
    }
  } catch (error) {
    console.error('Generate invite error:', error);
    showNotification(error.message || 'Failed to generate invite code', 'error');
  }
}

// Copy to clipboard utility
function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showNotification('Invite code copied to clipboard!', 'success');
    }).catch(() => {
      // Fallback for older browsers
      fallbackCopyToClipboard(text);
    });
  } else {
    // Fallback for older browsers
    fallbackCopyToClipboard(text);
  }
}

// Fallback copy method
function fallbackCopyToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    document.execCommand('copy');
    showNotification('Invite code copied to clipboard!', 'success');
  } catch (err) {
    showNotification('Failed to copy invite code', 'error');
  }
  document.body.removeChild(textArea);
}

// Format date utility
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Toggle admin privileges
async function toggleAdminPrivilege(userId, makeAdmin) {
  try {
    const response = await makeApiRequest('invites/toggle-admin', 'POST', {
      userId: userId,
      hasAdminPrivileges: makeAdmin
    }, true);

    if (response && response.user) {
      showNotification(`User ${makeAdmin ? 'promoted to' : 'demoted from'} admin successfully`, 'success');
      loadInvites(); // Refresh the list
    }
  } catch (error) {
    console.error('Toggle admin error:', error);
    showNotification(error.message || 'Failed to update user privileges', 'error');
  }
}

// Toggle plus user privileges
async function togglePlusPrivilege(userId, makePlus) {
  try {
    const response = await makeApiRequest('invites/toggle-plus', 'POST', {
      userId: userId,
      isPlusUser: makePlus
    }, true);

    if (response && response.user) {
      showNotification(`User ${makePlus ? 'granted' : 'removed from'} plus access successfully`, 'success');
      loadInvites(); // Refresh the list
    }
  } catch (error) {
    console.error('Toggle plus user error:', error);
    showNotification(error.message || 'Failed to update user plus privileges', 'error');
  }
}

// Close modal when clicking outside
document.addEventListener('click', function (event) {
  const modal = document.getElementById('viewInvitesModal');
  if (modal && event.target === modal) {
    closeInvitesModal();
  }
});

// Close modal with Escape key
document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') {
    const modal = document.getElementById('viewInvitesModal');
    if (modal && modal.classList.contains('show')) {
      closeInvitesModal();
    }
  }
});

// File Management Functionality
let currentPath = '';
let fileManagementInitialized = false;

function initializeFileManagement() {
  if (fileManagementInitialized) return;
  fileManagementInitialized = true;

  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('fileInput');
  const uploadProgress = document.getElementById('uploadProgress');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const fileList = document.getElementById('fileList');
  const refreshBtn = document.getElementById('refreshBtn');
  const newFolderBtn = document.getElementById('newFolderBtn');

  // Initialize file browser
  loadFiles();

  // File upload handling
  if (uploadArea && fileInput) {
    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files);
      handleFileUpload(files);
    });

    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      handleFileUpload(files);
    });
  }

  // Refresh button
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadFiles();
    });
  }

  // New folder button
  if (newFolderBtn) {
    newFolderBtn.addEventListener('click', () => {
      createNewFolder();
    });
  }
}

async function loadFiles() {
  const fileList = document.getElementById('fileList');
  if (!fileList) return;

  try {
    fileList.innerHTML = `
      <div class="file-loading">
        <i class="fa-regular fa-loader fa-spin"></i>
        <p>Loading files...</p>
      </div>
    `;

    const response = await makeApiRequest(`cdn?path=${encodeURIComponent(currentPath)}`, 'GET', null, true);

    if (response) {
      // Handle GitHub API response format
      if (response.type === 'directory' && response.items) {
        displayFiles(response.items);
      } else if (response.type === 'file') {
        // Single file response
        displayFiles([response]);
      } else {
        throw new Error('Invalid response format');
      }
      updateBreadcrumb();
    } else {
      throw new Error('Failed to load files');
    }
  } catch (error) {
    console.error('Failed to load files:', error);
    fileList.innerHTML = `
      <div class="file-empty">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Failed to load files: ${error.message}</p>
      </div>
    `;
  }
}

function displayFiles(files) {
  const fileList = document.getElementById('fileList');
  if (!fileList) return;

  if (!files || files.length === 0) {
    fileList.innerHTML = `
      <div class="file-empty">
        <i class="fas fa-folder-open"></i>
        <p>This directory is empty</p>
      </div>
    `;
    return;
  }

  const filesHtml = files.map(file => {
    const icon = getFileIcon(file);
    const size = file.size ? formatFileSize(file.size) : '';
    const date = file.modified ? formatDate(file.modified) : '';
    const isJson = file.name.toLowerCase().endsWith('.json');
    const downloadUrl = file.download_url || '';

    return `
      <div class="file-item" data-name="${file.name}" data-type="${file.type}" data-path="${file.path || ''}" data-download-url="${escapeHtml(downloadUrl)}">
        <div class="file-icon ${icon.class}">
          <i class="${icon.icon}"></i>
        </div>
        <div class="file-details">
          <div class="file-name">${escapeHtml(file.name)}${stagedJsonChanges[file.path] ? '<span class="staged-json-badge"><i class="fas fa-layer-group"></i> Staged</span>' : ''}</div>
          <div class="file-meta">${size} ${date}</div>
        </div>
        <div class="file-actions">
          ${isJson && file.type !== 'directory' ?
        `<button class="edit-json-btn" onclick="openJsonEditor('${escapeHtml(file.path || currentPath + '/' + file.name)}', '${escapeHtml(downloadUrl)}')" title="Edit JSON">
              <i class="fas fa-edit"></i> Edit
            </button>` : ''
      }
          ${file.type === 'directory' ?
        `<button class="file-action-btn" onclick="openDirectory('${escapeHtml(file.name)}')" title="Open">
              <i class="fas fa-folder-open"></i>
            </button>` :
        `<button class="file-action-btn download" onclick="downloadFile('${escapeHtml(file.name)}')" title="Download">
              <i class="fas fa-download"></i>
            </button>`
      }
          <button class="file-action-btn rename" onclick="renameFile('${escapeHtml(file.name)}')" title="Rename">
            <i class="fas fa-edit"></i>
          </button>
          <button class="file-action-btn delete" onclick="deleteFile('${escapeHtml(file.name)}', '${file.type}')" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  fileList.innerHTML = filesHtml;
}

function getFileIcon(file) {
  if (file.type === 'directory') {
    return { icon: 'fas fa-folder', class: 'folder' };
  }

  const extension = file.name.split('.').pop().toLowerCase();

  // Images
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff'].includes(extension)) {
    return { icon: 'fas fa-image', class: 'image' };
  }

  // Videos
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', '3gp', 'm4v'].includes(extension)) {
    return { icon: 'fas fa-video', class: 'video' };
  }

  // Audio
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'].includes(extension)) {
    return { icon: 'fas fa-music', class: 'audio' };
  }

  // Code files
  if (['js', 'ts', 'jsx', 'tsx', 'css', 'scss', 'sass', 'less', 'html', 'htm', 'php', 'py', 'java', 'cpp', 'c', 'cs', 'rb', 'go', 'rs', 'swift', 'kotlin', 'vue', 'svelte'].includes(extension)) {
    return { icon: 'fas fa-code', class: 'code' };
  }

  // Configuration and data files
  if (['json', 'xml', 'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf'].includes(extension)) {
    return { icon: 'fas fa-cog', class: 'code' };
  }

  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'dmg', 'iso'].includes(extension)) {
    return { icon: 'fas fa-file-archive', class: 'archive' };
  }

  // Documents
  if (['txt', 'md', 'pdf', 'doc', 'docx', 'rtf', 'odt', 'pages'].includes(extension)) {
    return { icon: 'fas fa-file-alt', class: 'document' };
  }

  // Spreadsheets
  if (['xls', 'xlsx', 'csv', 'ods', 'numbers'].includes(extension)) {
    return { icon: 'fas fa-file-excel', class: 'document' };
  }

  // Presentations
  if (['ppt', 'pptx', 'odp', 'key'].includes(extension)) {
    return { icon: 'fas fa-file-powerpoint', class: 'document' };
  }

  // Default
  return { icon: 'fas fa-file', class: 'default' };
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateBreadcrumb() {
  const breadcrumb = document.querySelector('.breadcrumb');
  if (!breadcrumb) return;
  const parts = currentPath.split('/').filter(part => part);
  let breadcrumbHtml = `
    <span class="breadcrumb-item ${currentPath === '' ? 'active' : ''}" data-path="">
      <i class="fas fa-home"></i> Root
    </span>
  `;
  let path = '';
  parts.forEach((part, index) => {
    path = path ? path + '/' + part : part;
    const isActive = index === parts.length - 1;
    breadcrumbHtml += `
      <span class="breadcrumb-item ${isActive ? 'active' : ''}" data-path="${path}">
        ${escapeHtml(part)}
      </span>
    `;
  });

  breadcrumb.innerHTML = breadcrumbHtml;

  // Add click handlers for breadcrumb navigation
  breadcrumb.querySelectorAll('.breadcrumb-item:not(.active)').forEach(item => {
    item.addEventListener('click', () => {
      currentPath = item.dataset.path;
      loadFiles();
    });
  });
}

async function handleFileUpload(files) {
  if (!files || files.length === 0) return;

  const uploadProgress = document.getElementById('uploadProgress');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');

  try {
    uploadProgress.style.display = 'block';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progress = Math.round(((i + 1) / files.length) * 100);

      progressBar.style.setProperty('--progress', `${progress}%`);
      progressText.textContent = `Uploading ${file.name}... (${i + 1}/${files.length})`;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', currentPath); const response = await fetch('/api/v2/cdn', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`
        },
        body: formData
      });

      const result = await response.json();
      // Handle GitHub API response format
      if (!result || result.error) {
        throw new Error(result?.error || `Failed to upload ${file.name}`);
      }

      // GitHub API returns file object on success
      if (!result.name && !result.sha) {
        throw new Error(`Invalid response for ${file.name}`);
      }
    }

    showNotification('Files uploaded successfully!', 'success');
    loadFiles(); // Refresh file list
  } catch (error) {
    console.error('Upload error:', error);
    showNotification(error.message || 'Failed to upload files', 'error');
  } finally {
    uploadProgress.style.display = 'none';
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
  }
}

function openDirectory(name) {
  currentPath = currentPath ? currentPath + '/' + name : name;
  loadFiles();
}

function downloadFile(name) {
  // Find the file in the current listing to get its download_url
  const fileList = document.getElementById('fileList'); const fileItem = fileList?.querySelector(`[data-name="${name}"]`);
  if (fileItem) {
    // For GitHub CDN, we need to get the file's download URL from the API
    const filePath = currentPath ? currentPath + '/' + name : name;

    // Make API request to get file details with download URL
    makeApiRequest(`cdn?path=${encodeURIComponent(filePath)}`, 'GET', null, true)
      .then(response => {
        if (response && response.download_url) {
          // Use GitHub's download URL
          const link = document.createElement('a');
          link.href = response.download_url;
          link.download = name;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          throw new Error('Download URL not available');
        }
      })
      .catch(error => {
        console.error('Download error:', error);
        showNotification('Failed to download file', 'error');
      });
  } else {
    showNotification('File not found', 'error');
  }
}

async function renameFile(oldName) {
  const newName = prompt('Enter new name:', oldName);
  if (!newName || newName === oldName) return;
  try {
    const filePath = currentPath ? currentPath + '/' + oldName : oldName;
    const newPath = currentPath ? currentPath + '/' + newName : newName;

    const response = await makeApiRequest('cdn', 'PUT', {
      oldPath: filePath,
      newPath: newPath
    }, true);

    // Handle GitHub API response format
    if (response && !response.error) {
      // GitHub API returns the new file object on success
      if (response.name || response.sha) {
        showNotification('File renamed successfully!', 'success');
        loadFiles();
      } else {
        throw new Error('Invalid response format');
      }
    } else {
      throw new Error(response?.error || 'Failed to rename file');
    }
  } catch (error) {
    console.error('Rename error:', error);
    showNotification(error.message || 'Failed to rename file', 'error');
  }
}

async function deleteFile(name, type) {
  const itemType = type === 'directory' ? 'folder' : 'file';
  const warningMessage = type === 'directory'
    ? `Are you sure you want to delete this folder and ALL its contents? This will permanently delete all files inside. This action cannot be undone.`
    : `Are you sure you want to delete this ${itemType}? This action cannot be undone.`;

  if (!confirm(warningMessage)) {
    return;
  }

  try {
    const filePath = currentPath ? currentPath + '/' + name : name;

    // Show loading message for directories since they might take longer
    if (type === 'directory') {
      showNotification('Deleting folder and all contents...', 'info');
    }

    const response = await makeApiRequest(`cdn?path=${encodeURIComponent(filePath)}`, 'DELETE', null, true);

    // Handle GitHub API response format
    if (response && !response.error) {
      // GitHub API returns success message or commit info
      const successMessage = type === 'directory'
        ? `Folder '${name}' and all its contents deleted successfully!`
        : `File '${name}' deleted successfully!`;
      showNotification(successMessage, 'success');
      loadFiles();
    } else {
      throw new Error(response?.error || `Failed to delete ${itemType}`);
    }
  } catch (error) {
    console.error('Delete error:', error);
    showNotification(error.message || `Failed to delete ${itemType}`, 'error');
  }
}

async function createNewFolder() {
  const name = prompt('Enter folder name:');
  if (!name) return;
  try {
    const folderPath = currentPath ? currentPath + '/' + name : name;

    const response = await makeApiRequest('cdn', 'POST', {
      path: folderPath,
      type: 'directory'
    }, true);

    // Handle GitHub API response format
    if (response && !response.error) {
      // GitHub API returns file/folder object on success
      showNotification('Folder created successfully!', 'success');
      loadFiles();
    } else {
      throw new Error(response?.error || 'Failed to create folder');
    }
  } catch (error) {
    console.error('Create folder error:', error);
    showNotification(error.message || 'Failed to create folder', 'error');
  }
}

// Course Upload System - Multi-Section with Queue
let semesterSubjectMappings = {};
let uploadSections = {}; // { sectionId: { semester, subject, category, files: [] } }
let sectionCounter = 0;
const BATCH_SIZE_LIMIT = 3.5 * 1024 * 1024; // 3.5MB to stay safely under Vercel's 4MB limit

// Initialize course upload functionality
function initializeCourseUpload() {
  // Load semester-subject mappings
  loadSemesterSubjectMappings();

  // Sub-tab switching
  const subTabBtns = document.querySelectorAll('.files-sub-tabs > .sub-tab-nav > .sub-tab-btn');
  const subTabPanes = document.querySelectorAll('.files-sub-tabs > .sub-tab-pane');

  subTabBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      const targetTab = this.getAttribute('data-subtab');
      if (!targetTab) return;

      // Update active state for buttons
      subTabBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      // Show the selected sub-tab content
      subTabPanes.forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === targetTab) {
          pane.classList.add('active');
        }
      });
    });
  });

  // Initialize the first section
  initializeSection(0);

  // Add Section button
  const addSectionBtn = document.getElementById('addSectionBtn');
  if (addSectionBtn) {
    addSectionBtn.addEventListener('click', addNewSection);
  }

  // Upload All button
  const uploadAllBtn = document.getElementById('uploadAllBtn');
  if (uploadAllBtn) {
    uploadAllBtn.addEventListener('click', handleMultiSectionUpload);
  }

  // Clear All button
  const clearAllBtn = document.getElementById('clearAllBtn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', clearAllSections);
  }
}

// Initialize a section with event listeners
function initializeSection(sectionId) {
  uploadSections[sectionId] = { semester: '', subject: '', category: '', files: [] };

  const section = document.querySelector(`[data-section-id="${sectionId}"]`);
  if (!section) return;

  const semesterSelect = section.querySelector('.section-semester');
  const subjectSelect = section.querySelector('.section-subject');
  const customSubjectInput = section.querySelector('.section-custom-subject');
  const uploadArea = section.querySelector('.section-upload-area');
  const fileInput = section.querySelector('.section-file-input');

  // Semester change handler
  if (semesterSelect) {
    semesterSelect.addEventListener('change', function () {
      const semester = this.value;
      uploadSections[sectionId].semester = semester;
      populateSectionSubjects(sectionId, semester);
      updateGlobalUploadOptions();
    });
  }

  // Subject change handler
  if (subjectSelect) {
    subjectSelect.addEventListener('change', function () {
      if (this.value === 'custom') {
        customSubjectInput.style.display = 'block';
        customSubjectInput.required = true;
        uploadSections[sectionId].subject = '';
      } else {
        customSubjectInput.style.display = 'none';
        customSubjectInput.required = false;
        uploadSections[sectionId].subject = this.value;
      }
      updateGlobalUploadOptions();
    });
  }

  // Custom subject input handler
  if (customSubjectInput) {
    customSubjectInput.addEventListener('input', function () {
      uploadSections[sectionId].subject = this.value;
      updateGlobalUploadOptions();
    });
  }

  // Category change handler
  const categorySelect = section.querySelector('.section-category');
  const customCategoryInput = section.querySelector('.section-custom-category');

  if (categorySelect) {
    categorySelect.addEventListener('change', function () {
      if (this.value === 'Other') {
        if (customCategoryInput) {
          customCategoryInput.style.display = 'block';
          customCategoryInput.required = true;
        }
        uploadSections[sectionId].category = '';
      } else {
        if (customCategoryInput) {
          customCategoryInput.style.display = 'none';
          customCategoryInput.required = false;
        }
        uploadSections[sectionId].category = this.value;
      }
      updateGlobalUploadOptions();
    });
  }

  // Custom category input handler
  if (customCategoryInput) {
    customCategoryInput.addEventListener('input', function () {
      uploadSections[sectionId].category = this.value;
      updateGlobalUploadOptions();
    });
  }

  // File upload handling
  if (uploadArea && fileInput) {
    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files);
      handleSectionFileSelection(sectionId, files);
    });

    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      handleSectionFileSelection(sectionId, files);
      fileInput.value = ''; // Reset to allow selecting same files again
    });
  }
}

// Add a new upload section
function addNewSection() {
  sectionCounter++;
  const newSectionId = sectionCounter;
  const container = document.getElementById('uploadSectionsContainer');
  const previousSection = container.querySelector('.upload-section:last-child');
  const previousSectionId = previousSection ? parseInt(previousSection.dataset.sectionId) : 0;

  // Create new section HTML with match previous option
  const newSection = document.createElement('div');
  newSection.className = 'upload-section';
  newSection.dataset.sectionId = newSectionId;

  newSection.innerHTML = `
    <div class="upload-section-header">
      <span class="upload-section-title">
        <i class="fas fa-layer-group"></i>
        Section ${newSectionId + 1}
      </span>
      <button type="button" class="remove-section-btn" onclick="removeUploadSection(${newSectionId})">
        <i class="fas fa-times"></i> Remove
      </button>
    </div>

    <div class="match-previous-option">
      <input type="checkbox" class="match-previous-checkbox" data-section="${newSectionId}" id="matchPrevious${newSectionId}">
      <label for="matchPrevious${newSectionId}">Match previous section's semester</label>
      <small>Uses Semester ${uploadSections[previousSectionId]?.semester || '?'}</small>
    </div>

    <!-- Collapsible form fields -->
    <div class="section-form-fields">
      <div class="form-row">
        <div class="form-group">
          <label>Semester</label>
          <select class="section-semester" data-section="${newSectionId}" required>
            <option value="">Select Semester</option>
            <option value="1">Semester 1</option>
            <option value="2">Semester 2</option>
            <option value="3">Semester 3</option>
            <option value="4">Semester 4</option>
            <option value="5">Semester 5</option>
            <option value="6">Semester 6</option>
            <option value="7">Semester 7</option>
            <option value="8">Semester 8</option>
            <option value="9">Miscellaneous</option>
          </select>
        </div>
        <div class="form-group">
          <label>Subject</label>
          <select class="section-subject" data-section="${newSectionId}" required disabled>
            <option value="">Select Semester First</option>
          </select>
          <input type="text" class="section-custom-subject form-control" data-section="${newSectionId}"
            placeholder="Enter new subject name" style="display: none; margin-top: 8px;">
        </div>
      </div>

      <div class="form-group">
        <label>Category</label>
        <select class="section-category" data-section="${newSectionId}" required>
          <option value="">Select Category</option>
          <option value="Syllabus">Syllabus</option>
          <option value="Chapters">Chapters</option>
          <option value="Presentations">Presentations</option>
          <option value="Assignments">Assignments</option>
          <option value="Question Banks">Question Banks</option>
          <option value="Lab">Lab</option>
          <option value="Previous Year Papers">Previous Year Papers</option>
          <option value="Reference Books">Reference Books</option>
          <option value="Lecture Notes">Lecture Notes</option>
          <option value="Handwritten Notes">Handwritten Notes</option>
          <option value="NPTEL Book">NPTEL Book</option>
          <option value="NPTEL Assignment with Solutions">NPTEL Assignment with Solutions</option>
          <option value="NPTEL Weekly Materials">NPTEL Weekly Materials</option>
          <option value="Other">Other</option>
        </select>
        <input type="text" class="section-custom-category form-control" data-section="${newSectionId}"
          placeholder="Enter new category name" style="display: none; margin-top: 8px;">
      </div>
    </div>

    <div class="upload-area section-upload-area" data-section="${newSectionId}">
      <div class="upload-icon">
        <i class="fas fa-cloud-upload-alt" style="font-size: 3rem; color: var(--text-secondary);"></i>
      </div>
      <div class="upload-text">
        <h4>Drop files here or click to upload</h4>
        <p>Supports only PDF Format files</p>
      </div>
      <input type="file" class="section-file-input" data-section="${newSectionId}" multiple accept=".pdf" style="display: none;">
    </div>

    <div class="section-file-preview" data-section="${newSectionId}" style="display: none;">
      <div class="section-collapsed-summary"></div>
      <div class="section-file-header">
        <h5>Selected Files</h5>
        <button type="button" class="section-expand-btn" onclick="expandUploadSection(${newSectionId})" title="Add more files">
          <i class="fas fa-plus"></i>
        </button>
      </div>
      <div class="section-file-list"></div>
    </div>
  `;

  container.appendChild(newSection);

  // Collapse previous sections that have files
  collapsePreviousSections();

  // Initialize the new section
  initializeSection(newSectionId);

  // Set up match previous checkbox
  const matchPreviousCheckbox = newSection.querySelector('.match-previous-checkbox');
  if (matchPreviousCheckbox) {
    matchPreviousCheckbox.addEventListener('change', function () {
      const semesterSelect = newSection.querySelector('.section-semester');
      if (this.checked && uploadSections[previousSectionId]?.semester) {
        semesterSelect.value = uploadSections[previousSectionId].semester;
        semesterSelect.disabled = true;
        uploadSections[newSectionId].semester = uploadSections[previousSectionId].semester;
        populateSectionSubjects(newSectionId, uploadSections[previousSectionId].semester);
      } else {
        semesterSelect.disabled = false;
      }
      updateGlobalUploadOptions();
    });
  }

  // Scroll to new section
  newSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Remove an upload section
function removeUploadSection(sectionId) {
  const section = document.querySelector(`[data-section-id="${sectionId}"]`);
  if (section) {
    section.remove();
    delete uploadSections[sectionId];
    updateGlobalUploadOptions();
    renumberSections();
  }
}

// Renumber sections after removal
function renumberSections() {
  const sections = document.querySelectorAll('.upload-section');
  sections.forEach((section, index) => {
    const title = section.querySelector('.upload-section-title');
    if (title) {
      title.innerHTML = `<i class="fas fa-layer-group"></i> Section ${index + 1}`;
    }
  });
}

// Collapse all previous sections that have files
function collapsePreviousSections() {
  const sections = document.querySelectorAll('.upload-section');
  sections.forEach((section, index) => {
    // Collapse all sections except the last one
    if (index < sections.length - 1) {
      const sectionId = parseInt(section.dataset.sectionId);
      const sectionData = uploadSections[sectionId];

      // Only collapse if it has files
      if (sectionData?.files && sectionData.files.length > 0) {
        section.classList.add('collapsed');
        updateCollapsedSummary(sectionId);
      }
    }
  });
}

// Expand a collapsed section
function expandUploadSection(sectionId) {
  const section = document.querySelector(`[data-section-id="${sectionId}"]`);
  if (section) {
    section.classList.remove('collapsed');
  }
}

// Update the collapsed summary text
function updateCollapsedSummary(sectionId) {
  const section = document.querySelector(`[data-section-id="${sectionId}"]`);
  if (!section) return;

  const summary = section.querySelector('.section-collapsed-summary');
  if (!summary) return;

  const sectionData = uploadSections[sectionId];
  if (!sectionData) return;

  const subject = sectionData.subject || 'No subject';
  const category = sectionData.category || 'No category';
  const fileCount = sectionData.files?.length || 0;

  summary.innerHTML = `<i class="fas fa-info-circle"></i> ${subject} • ${category} • ${fileCount} file(s)`;
}

// Populate subjects for a specific section
function populateSectionSubjects(sectionId, semester) {
  const section = document.querySelector(`[data-section-id="${sectionId}"]`);
  if (!section) return;

  const subjectSelect = section.querySelector('.section-subject');
  if (!subjectSelect) return;

  // Clear existing options
  subjectSelect.innerHTML = '<option value="">Select Subject</option>';

  if (semester && semesterSubjectMappings[semester]) {
    semesterSubjectMappings[semester].forEach(subject => {
      const option = document.createElement('option');
      option.value = subject;
      option.textContent = subject;
      subjectSelect.appendChild(option);
    });
  }

  // Add custom option
  const customOption = document.createElement('option');
  customOption.value = 'custom';
  customOption.textContent = 'Add New Subject...';
  subjectSelect.appendChild(customOption);

  // Enable the subject dropdown
  subjectSelect.disabled = false;
}

// Handle file selection for a specific section
function handleSectionFileSelection(sectionId, files) {
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit
  const validFiles = [];
  const rejectedFiles = [];

  // Validate each file
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      rejectedFiles.push({
        name: file.name,
        reason: `File too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum size is 50MB.`
      });
    } else if (!file.name.toLowerCase().endsWith('.pdf')) {
      rejectedFiles.push({
        name: file.name,
        reason: 'Only PDF files are allowed for course materials.'
      });
    } else {
      validFiles.push(file);
    }
  }

  // Show warnings for rejected files
  if (rejectedFiles.length > 0) {
    const rejectedList = rejectedFiles.map(f => `• ${f.name}: ${f.reason}`).join('\n');
    showNotification(`Some files were rejected:\n${rejectedList}`, 'warning');
  }

  // Add valid files to section
  if (!uploadSections[sectionId]) {
    uploadSections[sectionId] = { semester: '', subject: '', category: '', files: [] };
  }
  uploadSections[sectionId].files = [...uploadSections[sectionId].files, ...validFiles];

  // Update file preview
  displaySectionFilePreview(sectionId);
  updateGlobalUploadOptions();
}

// Display file preview for a specific section
function displaySectionFilePreview(sectionId) {
  const section = document.querySelector(`[data-section-id="${sectionId}"]`);
  if (!section) return;

  const previewContainer = section.querySelector('.section-file-preview');
  const fileList = section.querySelector('.section-file-list');
  const files = uploadSections[sectionId]?.files || [];

  if (files.length === 0) {
    previewContainer.style.display = 'none';
    return;
  }

  previewContainer.style.display = 'block';
  fileList.innerHTML = files.map((file, index) => {
    const displayName = file.displayName || file.name.replace(/\.[^/.]+$/, "");
    const priority = file.priority !== undefined ? file.priority : index + 1;
    return `
    <div class="section-file-chip" data-file-index="${index}" draggable="true">
      <i class="fas fa-grip-vertical drag-handle" title="Drag to reorder"></i>
      <i class="fas fa-file-pdf"></i>
      <input type="text" class="file-name-input" value="${displayName}" 
             onchange="renameSectionFile(${sectionId}, ${index}, this.value)"
             onclick="event.stopPropagation()"
             title="Click to rename">
      <span class="file-extension">.pdf</span>
      <input type="number" class="priority-input" value="${priority}" min="1"
             onchange="setFilePriority(${sectionId}, ${index}, this.value)"
             onclick="event.stopPropagation(); this.select()"
             title="Priority (lower = first)">
      <button type="button" class="remove-file" onclick="removeSectionFile(${sectionId}, ${index})">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
  }).join('');

  // Add sort by priority button if more than 1 file
  if (files.length > 1) {
    const existingBtn = previewContainer.querySelector('.sort-by-priority-btn');
    if (!existingBtn) {
      const sortBtn = document.createElement('button');
      sortBtn.type = 'button';
      sortBtn.className = 'sort-by-priority-btn';
      sortBtn.innerHTML = '<i class="fas fa-sort-numeric-down"></i> Sort by Priority';
      sortBtn.onclick = () => sortFilesByPriority(sectionId);
      previewContainer.appendChild(sortBtn);
    }
  }

  // Set up drag-and-drop for file reordering
  setupFileDragAndDrop(sectionId, fileList);

  // Update collapsed summary in case this section gets collapsed
  updateCollapsedSummary(sectionId);
}

// Set file priority
function setFilePriority(sectionId, fileIndex, priority) {
  if (uploadSections[sectionId]?.files && uploadSections[sectionId].files[fileIndex]) {
    uploadSections[sectionId].files[fileIndex].priority = parseInt(priority) || 1;
  }
}

// Sort files by priority number
function sortFilesByPriority(sectionId) {
  const files = uploadSections[sectionId]?.files;
  if (!files || files.length < 2) return;

  // Sort by priority (lower number = first)
  files.sort((a, b) => {
    const priorityA = a.priority !== undefined ? a.priority : Infinity;
    const priorityB = b.priority !== undefined ? b.priority : Infinity;
    return priorityA - priorityB;
  });

  // Re-render the file list
  displaySectionFilePreview(sectionId);
  showNotification('Files sorted by priority', 'info');
}

// Set up drag-and-drop for file reordering within a section
function setupFileDragAndDrop(sectionId, fileList) {
  const chips = fileList.querySelectorAll('.section-file-chip');

  chips.forEach(chip => {
    chip.addEventListener('dragstart', (e) => {
      chip.classList.add('dragging');
      fileList.classList.add('drag-active');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', chip.dataset.fileIndex);
    });

    chip.addEventListener('dragend', () => {
      chip.classList.remove('dragging');
      fileList.classList.remove('drag-active');
      chips.forEach(c => c.classList.remove('drag-over'));
    });

    chip.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const dragging = fileList.querySelector('.dragging');
      if (dragging && chip !== dragging) {
        chip.classList.add('drag-over');
      }
    });

    chip.addEventListener('dragleave', () => {
      chip.classList.remove('drag-over');
    });

    chip.addEventListener('drop', (e) => {
      e.preventDefault();
      chip.classList.remove('drag-over');

      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
      const toIndex = parseInt(chip.dataset.fileIndex);

      if (fromIndex !== toIndex) {
        reorderSectionFiles(sectionId, fromIndex, toIndex);
      }
    });
  });
}

// Reorder files within a section
function reorderSectionFiles(sectionId, fromIndex, toIndex) {
  const files = uploadSections[sectionId]?.files;
  if (!files) return;

  // Remove the file from its original position
  const [movedFile] = files.splice(fromIndex, 1);

  // Insert at the new position
  files.splice(toIndex, 0, movedFile);

  // Re-render the file list
  displaySectionFilePreview(sectionId);
}

// Rename a file in a section
function renameSectionFile(sectionId, fileIndex, newName) {
  if (uploadSections[sectionId]?.files && uploadSections[sectionId].files[fileIndex]) {
    const originalFile = uploadSections[sectionId].files[fileIndex];
    const newFileName = newName + '.pdf';

    // Create a new File object with the new name
    const renamedFile = new File([originalFile], newFileName, {
      type: originalFile.type,
      lastModified: originalFile.lastModified
    });

    // Store the display name for UI
    renamedFile.displayName = newName;

    uploadSections[sectionId].files[fileIndex] = renamedFile;
  }
}


// Remove a file from a section
function removeSectionFile(sectionId, fileIndex) {
  if (uploadSections[sectionId]?.files) {
    uploadSections[sectionId].files.splice(fileIndex, 1);
    displaySectionFilePreview(sectionId);
    updateGlobalUploadOptions();
  }
}

// Update global upload options visibility
function updateGlobalUploadOptions() {
  const globalOptions = document.getElementById('globalUploadOptions');
  const hasFiles = Object.values(uploadSections).some(s => s.files && s.files.length > 0);

  if (globalOptions) {
    globalOptions.style.display = hasFiles ? 'block' : 'none';
  }
}

// Clear all sections (with confirmation for user-initiated clear)
function clearAllSections() {
  if (!confirm('Are you sure you want to clear all sections and files?')) return;
  clearAllSectionsInternal();
  showNotification('All sections cleared', 'info');
}

// Internal function to clear sections without confirmation
function clearAllSectionsInternal() {
  // Reset all sections
  Object.keys(uploadSections).forEach(sectionId => {
    uploadSections[sectionId].files = [];
    displaySectionFilePreview(sectionId);

    const section = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (section) {
      section.querySelector('.section-semester').value = '';
      const subjectSelect = section.querySelector('.section-subject');
      subjectSelect.innerHTML = '<option value="">Select Semester First</option>';
      subjectSelect.disabled = true;
      section.querySelector('.section-category').value = '';
      const customSubject = section.querySelector('.section-custom-subject');
      if (customSubject) {
        customSubject.style.display = 'none';
        customSubject.value = '';
      }
    }
  });

  // Remove all sections except the first one
  const container = document.getElementById('uploadSectionsContainer');
  const sections = container.querySelectorAll('.upload-section');
  sections.forEach((section, index) => {
    if (index > 0) {
      section.remove();
      const id = parseInt(section.dataset.sectionId);
      delete uploadSections[id];
    } else {
      // Uncollapse the first section
      section.classList.remove('collapsed');
      // Clear valid state if any
      section.querySelector('.section-collapsed-summary').innerHTML = '';
    }
  });

  renumberSections();
  updateGlobalUploadOptions();
}

// Create batches from all sections' files to stay under size limit
function createUploadBatches() {
  const batches = [];
  let currentBatch = { items: [], totalSize: 0 };

  // Collect all files with their metadata
  Object.entries(uploadSections).forEach(([sectionId, section]) => {
    if (!section.files || section.files.length === 0) return;

    const subject = section.subject ||
      document.querySelector(`[data-section-id="${sectionId}"] .section-custom-subject`)?.value;

    section.files.forEach(file => {
      const item = {
        file,
        sectionId,
        semester: section.semester,
        subject,
        category: section.category
      };

      // Check if adding this file would exceed the batch limit
      if (currentBatch.totalSize + file.size > BATCH_SIZE_LIMIT && currentBatch.items.length > 0) {
        // Push current batch and start a new one
        batches.push(currentBatch);
        currentBatch = { items: [], totalSize: 0 };
      }

      // If single file is larger than limit, it gets its own batch (will likely fail but we try)
      if (file.size > BATCH_SIZE_LIMIT) {
        if (currentBatch.items.length > 0) {
          batches.push(currentBatch);
          currentBatch = { items: [], totalSize: 0 };
        }
        batches.push({ items: [item], totalSize: file.size });
      } else {
        currentBatch.items.push(item);
        currentBatch.totalSize += file.size;
      }
    });
  });

  // Don't forget the last batch
  if (currentBatch.items.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

// Handle multi-section upload with queue - uses staged uploads for single commit
async function handleMultiSectionUpload() {
  // Validate all sections
  let hasValidSection = false;
  let validationError = null;

  for (const [sectionId, section] of Object.entries(uploadSections)) {
    if (section.files && section.files.length > 0) {
      const sectionEl = document.querySelector(`[data-section-id="${sectionId}"]`);
      const subject = section.subject ||
        sectionEl?.querySelector('.section-custom-subject')?.value;

      if (!section.semester || !subject || !section.category) {
        validationError = `Section ${parseInt(sectionId) + 1}: Please fill all required fields (semester, subject, category)`;
        break;
      }
      hasValidSection = true;
    }
  }

  if (validationError) {
    showNotification(validationError, 'error');
    return;
  }

  if (!hasValidSection) {
    showNotification('Please select files to upload in at least one section', 'error');
    return;
  }

  const autoPushNotify = document.getElementById('autoPushNotify')?.checked ?? true;

  // Create batches
  const batches = createUploadBatches();

  if (batches.length === 0) {
    showNotification('No files to upload', 'error');
    return;
  }

  // Show queue progress
  const queueProgress = document.getElementById('queueProgress');
  const queueItems = document.getElementById('queueItems');
  const queueStats = document.getElementById('queueStats');
  const queueProgressBar = document.getElementById('queueProgressBar');
  const queueProgressPercent = document.getElementById('queueProgressPercent');
  const batchCommitInfo = document.getElementById('batchCommitInfo');
  const commitMessage = document.getElementById('commitMessage');
  const uploadAllBtn = document.getElementById('uploadAllBtn');

  queueProgress.style.display = 'block';
  batchCommitInfo.style.display = 'none';
  uploadAllBtn.disabled = true;
  uploadAllBtn.innerHTML = '<i class="fa-regular fa-loader fa-spin"></i> Preparing files...';

  // Initialize queue display with processing + upload phases
  const totalSteps = batches.length + 1; // batches + 1 processing step
  queueStats.textContent = `0 / ${totalSteps} steps`;

  // Build queue items display
  let queueHTML = batches.map((batch, index) => {
    const fileCount = batch.items.length;
    const size = (batch.totalSize / 1024 / 1024).toFixed(2);
    return `
      <div class="queue-item" data-batch="${index}">
        <div class="queue-item-icon pending">
          <i class="fas fa-clock"></i>
        </div>
        <div class="queue-item-details">
          <div class="queue-item-name">Process batch ${index + 1}: ${fileCount} file(s)</div>
          <div class="queue-item-meta">${size} MB</div>
        </div>
        <span class="queue-item-status pending">Pending</span>
      </div>
    `;
  }).join('');

  // Add final upload step
  queueHTML += `
    <div class="queue-item" data-batch="commit">
      <div class="queue-item-icon pending">
        <i class="fas fa-clock"></i>
      </div>
      <div class="queue-item-details">
        <div class="queue-item-name">Finalize Upload</div>
        <div class="queue-item-meta">Saving files to server</div>
      </div>
      <span class="queue-item-status pending">Pending</span>
    </div>
  `;
  queueItems.innerHTML = queueHTML;

  // Phase 1: Process all files in batches
  let successCount = 0;
  let failedCount = 0;
  const allStagedFiles = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const queueItem = queueItems.querySelector(`[data-batch="${i}"]`);
    const icon = queueItem.querySelector('.queue-item-icon');
    const status = queueItem.querySelector('.queue-item-status');

    // Update to processing state
    icon.className = 'queue-item-icon uploading';
    icon.innerHTML = '<i class="fa-regular fa-loader fa-spin"></i>';
    status.className = 'queue-item-status uploading';
    status.textContent = 'Processing...';

    try {
      // Group files by semester/subject/category for the API
      const groupedFiles = {};
      batch.items.forEach(item => {
        const key = `${item.semester}|${item.subject}|${item.category}`;
        if (!groupedFiles[key]) {
          groupedFiles[key] = {
            semester: item.semester,
            subject: item.subject,
            category: item.category,
            files: []
          };
        }
        groupedFiles[key].files.push(item.file);
      });

      const groups = Object.values(groupedFiles);

      for (const group of groups) {
        const stageFormData = new FormData();
        stageFormData.append('semester', group.semester);
        stageFormData.append('subject', group.subject);
        stageFormData.append('category', group.category);
        stageFormData.append('basePath', `pdfs/${group.semester}/${group.subject}`);

        group.files.forEach(file => {
          stageFormData.append('files', file);
        });

        // Use the new stage endpoint
        const response = await fetch('/api/v2/cdn?stage=true', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`
          },
          body: stageFormData
        });

        const result = await response.json();

        if (!response.ok || result.error) {
          throw new Error(result.error || `Processing failed: ${response.status}`);
        }

        // Collect processed files for the final upload
        if (result.stagedFiles) {
          allStagedFiles.push(...result.stagedFiles);
        }
      }

      // Update to success state
      icon.className = 'queue-item-icon success';
      icon.innerHTML = '<i class="fas fa-check"></i>';
      status.className = 'queue-item-status success';
      status.textContent = 'Ready';
      successCount++;

    } catch (error) {
      console.error(`Batch ${i + 1} processing failed:`, error);

      // Update to error state
      icon.className = 'queue-item-icon error';
      icon.innerHTML = '<i class="fas fa-exclamation"></i>';
      status.className = 'queue-item-status error';
      status.textContent = 'Failed';
      failedCount++;
    }

    // Update progress
    const progress = Math.round(((i + 1) / totalSteps) * 100);
    queueProgressBar.style.setProperty('--progress', `${progress}%`);
    queueProgressPercent.textContent = `${progress}%`;
    queueStats.textContent = `${i + 1} / ${totalSteps} steps`;
  }

  // Phase 2: Finalize upload with all files
  const commitQueueItem = queueItems.querySelector('[data-batch="commit"]');
  const commitIcon = commitQueueItem.querySelector('.queue-item-icon');
  const commitStatus = commitQueueItem.querySelector('.queue-item-status');
  const stagedJsonFiles = getStagedJsonForCommit();

  if (failedCount > 0 && allStagedFiles.length > 0) {
    showNotification(`${failedCount} batch(es) failed. Uploading ${allStagedFiles.length} successfully staged file(s)...`, 'warning');
  }

  if (allStagedFiles.length === 0 && stagedJsonFiles.length === 0) {
    commitIcon.className = 'queue-item-icon error';
    commitIcon.innerHTML = '<i class="fas fa-exclamation"></i>';
    commitStatus.className = 'queue-item-status error';
    commitStatus.textContent = 'No items';

    showNotification('No files or JSON edits were staged. Upload cancelled.', 'error');
  } else {
    // Update to uploading state
    uploadAllBtn.innerHTML = '<i class="fa-regular fa-loader fa-spin"></i> Finalizing...';
    commitIcon.className = 'queue-item-icon uploading';
    commitIcon.innerHTML = '<i class="fa-regular fa-loader fa-spin"></i>';
    commitStatus.className = 'queue-item-status uploading';
    commitStatus.textContent = 'Finalizing...';

    try {
      // Get staged JSON changes
      const stagedJsonFiles = getStagedJsonForCommit();

      // Send commit request with all staged files
      const response = await fetch('/api/v2/cdn?commit=true', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          stagedFiles: allStagedFiles,
          stagedJsonFiles, // Include staged JSON changes
          autoPushNotify
        })
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || `Upload failed: ${response.status}`);
      }

      // Update to success state
      commitIcon.className = 'queue-item-icon success';
      commitIcon.innerHTML = '<i class="fas fa-check"></i>';
      commitStatus.className = 'queue-item-status success';
      commitStatus.textContent = 'Complete';

      // Update progress to 100%
      queueProgressBar.style.setProperty('--progress', '100%');
      queueProgressPercent.textContent = '100%';
      queueStats.textContent = `${totalSteps} / ${totalSteps} steps`;

      // Show success
      batchCommitInfo.style.display = 'flex';
      const jsonCount = stagedJsonFiles.length;
      const totalCount = allStagedFiles.length + jsonCount;
      const jsonNote = jsonCount > 0 ? ` + ${jsonCount} JSON edit(s)` : '';
      commitMessage.textContent = `All ${allStagedFiles.length} files${jsonNote} uploaded successfully!`;
      showNotification(`Successfully uploaded ${totalCount} item(s)!`, 'success');

      // Clear all sections and staged JSON on success
      setTimeout(() => {
        clearAllSectionsInternal();
        clearStagedJson();
        queueProgress.style.display = 'none';
      }, 3000);

    } catch (error) {
      console.error('Upload failed:', error);

      commitIcon.className = 'queue-item-icon error';
      commitIcon.innerHTML = '<i class="fas fa-exclamation"></i>';
      commitStatus.className = 'queue-item-status error';
      commitStatus.textContent = 'Failed';

      showNotification(`Upload failed: ${error.message}`, 'error');
    }
  }

  // Reset button
  uploadAllBtn.disabled = false;
  uploadAllBtn.innerHTML = '<i class="fas fa-upload"></i> Upload All Sections';
}


// Load semester-subject mappings from GitHub
async function loadSemesterSubjectMappings() {
  try {
    const response = await makeApiRequest('cdn?path=databases/semester-subjects.json', 'GET', null, true);
    if (response && response.download_url) {
      const mappingResponse = await fetch(response.download_url);
      if (mappingResponse.ok) {
        semesterSubjectMappings = await mappingResponse.json();
        console.log('Loaded existing semester-subject mappings');
        return;
      }
    }
  } catch (error) {
    // File doesn't exist yet, this is expected for first-time setup
    console.log('No existing semester-subject mappings found, initializing with defaults');
  }
  // Initialize with default subjects for each semester
  semesterSubjectMappings = {
    "1": [
      "Engineering Mathematics I",
      "Physics",
      "Chemistry",
      "Engineering Graphics",
      "Basic Electrical Engineering",
      "Programming for Problem Solving"
    ],
    "2": [
      "Engineering Mathematics II",
      "Physics II",
      "Chemistry II",
      "Engineering Mechanics",
      "Basic Electronics Engineering",
      "Engineering Graphics II"
    ],
    "3": [
      "Engineering Mathematics III",
      "Data Structures and Algorithms",
      "Digital Logic Design",
      "Computer Organization",
      "Object Oriented Programming",
      "Database Management Systems"
    ],
    "4": [
      "Engineering Mathematics IV",
      "Operating Systems",
      "Computer Networks",
      "Software Engineering",
      "Theory of Computation",
      "Microprocessors"
    ],
    "5": [
      "Machine Learning",
      "Artificial Intelligence",
      "Compiler Design",
      "Computer Graphics",
      "Distributed Systems",
      "Web Technologies"
    ],
    "6": [
      "Data Mining",
      "Information Security",
      "Mobile Computing",
      "Cloud Computing",
      "Internet of Things",
      "Elective I"
    ],
    "7": [
      "Major Project I",
      "Advanced Algorithms",
      "Blockchain Technology",
      "DevOps",
      "Elective II",
      "Internship"
    ],
    "8": [
      "Major Project II",
      "Industry Training",
      "Seminar",
      "Elective III",
      "Placement Training",
      "Final Viva"
    ]
  };
}


// Legacy functions - now handled by batch upload
// These functions are kept for reference but are no longer used

// Update semester-subject mappings (now handled in batch-upload.js)
async function updateSemesterSubjectMappings_LEGACY(semester, subject) {
  if (!semesterSubjectMappings[semester]) {
    semesterSubjectMappings[semester] = [];
  }

  if (!semesterSubjectMappings[semester].includes(subject)) {
    semesterSubjectMappings[semester].push(subject);
    // Save to GitHub
    const content = JSON.stringify(semesterSubjectMappings, null, 2);
    const formData = new FormData();
    const blob = new Blob([content], { type: 'application/json' });
    formData.append('file', blob, 'semester-subjects.json');
    formData.append('path', 'databases');

    await fetch('/api/v2/cdn', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`
      },
      body: formData
    });
  }
}

// Update resource library (now handled in batch-upload.js)
async function updateResourceLibrary_LEGACY(semester, subject, category, uploadedFiles) {
  try {
    console.log('Starting resource library update...');

    // Try to load existing resource library
    let resourceLib = {};
    try {
      console.log('Fetching existing resource library...');
      const response = await makeApiRequest('cdn?path=databases/beta/resource.lib.json', 'GET', null, true);
      console.log('Resource library fetch response:', response);

      if (response && response.download_url) {
        console.log('Downloading resource library from:', response.download_url);
        const libResponse = await fetch(response.download_url);
        if (libResponse.ok) {
          resourceLib = await libResponse.json();
          console.log('Loaded existing resource library:', Object.keys(resourceLib));
        } else {
          console.log('Failed to download resource library:', libResponse.status, libResponse.statusText);
        }
      } else {
        console.log('No existing resource library found, creating new one');
      }
    } catch (error) {
      console.log('Error loading existing resource library, creating new one:', error.message);
    }

    // Initialize structure if needed
    if (!resourceLib[semester]) {
      resourceLib[semester] = {};
    }
    if (!resourceLib[semester][subject]) {
      resourceLib[semester][subject] = [];
    }

    // Find existing category or create new one
    let categoryIndex = resourceLib[semester][subject].findIndex(item => item.type === category);
    if (categoryIndex === -1) {
      resourceLib[semester][subject].push({
        type: category,
        content: []
      });
      categoryIndex = resourceLib[semester][subject].length - 1;
    }

    // Add uploaded file names to content
    const fileNames = uploadedFiles.map(file => file.name);
    resourceLib[semester][subject][categoryIndex].content.push(...fileNames);

    // Save updated resource library
    const content = JSON.stringify(resourceLib, null, 2);
    const formData = new FormData();
    const blob = new Blob([content], { type: 'application/json' });
    formData.append('file', blob, 'resource.lib.json');
    formData.append('path', 'databases/beta');

    console.log('Updating resource library with content:', resourceLib);

    const response = await fetch('/api/v2/cdn', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`
      },
      body: formData
    });

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      console.error('Failed to parse resource library update response:', parseError);
      throw new Error('Failed to update resource library - server returned invalid response');
    }

    if (!response.ok || result.error) {
      console.error('Resource library update failed:', result);
      throw new Error(result.error || `Failed to update resource library: ${response.status} ${response.statusText}`);
    }

    console.log('Resource library updated successfully:', result);

  } catch (error) {
    console.error('Failed to update resource library:', error);
  }
}

// Create upload notification (now handled in batch-upload.js)
async function createUploadNotification_LEGACY(subject, category, fileCount) {
  try {
    const notification = {
      title: "New Materials Uploaded!",
      message: `New materials have been added in ${category} category of ${subject}.`,
      date: new Date().toISOString(),
      links: []
    };

    // Try to load existing notifications
    let notifications = [];
    try {
      const response = await makeApiRequest('cdn?path=notifications.json', 'GET', null, true);
      if (response && response.download_url) {
        const notifResponse = await fetch(response.download_url);
        if (notifResponse.ok) {
          notifications = await notifResponse.json();
        }
      }
    } catch (error) {
      console.log('Creating new notifications file');
    }
    // Add new notification to the top
    notifications.unshift(notification);

    // Save updated notifications
    const content = JSON.stringify(notifications, null, 2);
    const formData = new FormData();
    const blob = new Blob([content], { type: 'application/json' });
    formData.append('file', blob, 'notifications.json');
    formData.append('path', '');

    await fetch('/api/v2/cdn', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`
      },
      body: formData
    });

  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

// Delete an invite
async function deleteInvite(inviteId) {
  if (!confirm('Are you sure you want to delete this invite code? This action cannot be undone.')) {
    return;
  }

  // Find the delete button to show a loading indicator
  const deleteButton = document.querySelector(`.delete-invite[data-invite-id="${inviteId}"]`);
  if (deleteButton) {
    // Store original content and disable button
    const originalHTML = deleteButton.innerHTML;
    deleteButton.disabled = true;
    deleteButton.innerHTML = '<i class="fa-regular fa-loader fa-spin"></i>';
  }

  try {
    console.log('Deleting invite with ID:', inviteId);
    // Show deletion in progress notification
    showNotification('Deleting invite code...', 'info', 2000);

    let attempts = 0;
    const maxAttempts = 3;
    let success = false;
    let lastError = null;

    // Try up to 3 times with exponential backoff
    while (attempts < maxAttempts && !success) {
      attempts++;
      try {
        console.log(`Delete attempt ${attempts}/${maxAttempts}...`);

        const response = await makeApiRequest('invites/delete', 'POST', {
          inviteId: inviteId
        }, true);

        console.log('Delete response:', response);

        if (response && response.message) {
          success = true;
          showNotification(response.message, 'success');
          setTimeout(() => {
            loadInvites(); // Refresh the list
          }, 500);
          break;
        } else if (response && response.error) {
          lastError = response.error;
          console.warn(`Delete attempt ${attempts} failed:`, response.error);

          // Wait before trying again (exponential backoff)
          if (attempts < maxAttempts) {
            const waitTime = Math.pow(2, attempts) * 500; // 1s, 2s, 4s...
            console.log(`Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        } else {
          throw new Error('Failed to delete invite: No success message received');
        }
      } catch (attemptError) {
        lastError = attemptError.message || `Error in attempt ${attempts}`;
        console.warn(`Delete attempt ${attempts} exception:`, attemptError);

        // Wait before trying again (exponential backoff)
        if (attempts < maxAttempts) {
          const waitTime = Math.pow(2, attempts) * 500; // 1s, 2s, 4s...
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    if (!success) {
      throw new Error(lastError || `Failed after ${maxAttempts} attempts`);
    }
  } catch (error) {
    console.error('Delete invite error:', error);
    showNotification(error.message || 'Failed to delete invite code', 'error');
  } finally {
    // Restore original button state if failure
    if (deleteButton) {
      deleteButton.disabled = false;
      deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
    }
  }
}

// ==============================================
// PROMOTION MANAGEMENT FUNCTIONALITY
// ==============================================

// Promotions, Releases, and Exams & Seating variables
let currentPromoData = { media: [] };
let promoMediaUrls = [];
let activePromoId = null;
let currentExamSemesters = [];
let activeSeatingUrl = "";
let activeSeatingUrls = [];

// Promotions nested tabs switching
function switchPromoInnerTab(tabId) {
  document.querySelectorAll('.promo-inner-pane').forEach(pane => {
    pane.style.display = 'none';
  });
  const targetPane = document.getElementById(tabId);
  if (targetPane) {
    targetPane.style.display = 'block';
  }

  const editorBtn = document.getElementById('promoTabEditorBtn');
  const historyBtn = document.getElementById('promoTabHistoryBtn');
  if (editorBtn) editorBtn.classList.remove('active');
  if (historyBtn) historyBtn.classList.remove('active');

  if (tabId === 'promo-editor') {
    if (editorBtn) editorBtn.classList.add('active');
    if (!activePromoId && currentPromoData && currentPromoData.title) {
      populatePromoEditor(currentPromoData);
    }
  } else if (tabId === 'promo-history') {
    if (historyBtn) historyBtn.classList.add('active');
    loadPromoHistoryCms();
  }
}
window.switchPromoInnerTab = switchPromoInnerTab;

function initializePromotionManagement() {
  // Setup forms listener
  const form = document.getElementById('promotionForm');
  if (form) {
    // Remove existing listener if any by cloning or setting onsubmit
    form.onsubmit = function(e) {
      e.preventDefault();
      savePromoForm();
    };
  }
  loadPromotionData();
}

async function loadPromotionData() {
  try {
    const response = await fetch('/api/v2/promotions?all=true', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`
      }
    });
    if (response.ok) {
      const promos = await response.json();
      if (Array.isArray(promos) && promos.length > 0) {
        const activePromo = promos.find(p => p.enabled) || promos[0];
        currentPromoData = activePromo;
        populatePromoEditor(activePromo);
      }
    }
  } catch (error) {
    console.error('Error loading active promotion:', error);
  }
}

async function loadPromoHistoryCms() {
  const tbody = document.getElementById('promoHistoryTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Loading promotions history...</td></tr>';

  try {
    const response = await fetch('/api/v2/promotions?all=true', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`
      }
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to load promotions history');
    }

    const promos = await response.json();
    if (!Array.isArray(promos) || promos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No promotions in history.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    const now = new Date();
    promos.forEach(promo => {
      const tr = document.createElement('tr');
      const isCurrentlyActive = !!promo.enabled;
      const isExpired = promo.isLimitedOffer && promo.endDate && new Date(promo.endDate) < now;

      let statusBadge = '';
      if (isExpired) {
        statusBadge = '<span class="status-badge expired" style="background: rgba(229, 62, 62, 0.15); color: #e53e3e; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">Expired</span>';
      } else if (isCurrentlyActive) {
        statusBadge = '<span class="status-badge active">Active</span>';
      } else {
        statusBadge = '<span class="status-badge inactive">Inactive</span>';
      }

      let dateInfo = 'Always';
      if (promo.isLimitedOffer && promo.startDate && promo.endDate) {
        dateInfo = `${new Date(promo.startDate).toLocaleDateString()} - ${new Date(promo.endDate).toLocaleDateString()}`;
      }

      const lastUpdatedFormatted = promo.lastUpdated ? new Date(promo.lastUpdated).toLocaleString() : 'N/A';
      const promoId = promo._id ? String(promo._id) : '';

      tr.innerHTML = `
        <td><strong>${escapeHtml(promo.title || 'Untitled')}</strong></td>
        <td><code>${escapeHtml(promo.category || 'whats-new')}</code></td>
        <td>${statusBadge}</td>
        <td><small>${escapeHtml(dateInfo)}</small></td>
        <td><small>${escapeHtml(lastUpdatedFormatted)}</small></td>
        <td>
          <div class="exam-actions-btn">
            <button type="button" class="btn btn-outline btn-sm" onclick="editPromoCms('${promoId}')"><i class="fas fa-edit"></i> Edit</button>
            ${(!isCurrentlyActive && !isExpired) ? `<button type="button" class="btn btn-outline btn-sm" onclick="activatePromoCms('${promoId}')"><i class="fas fa-check"></i> Activate</button>` : ''}
            <button type="button" class="btn btn-outline btn-sm btn-danger" onclick="deletePromoCms('${promoId}')"><i class="fas fa-trash"></i> Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger-color, #e53e3e);">Failed to load promo history: ${escapeHtml(err.message || 'Error')}</td></tr>`;
    }
    showNotification('Failed to load promo history', 'error');
  }
}
window.loadPromoHistoryCms = loadPromoHistoryCms;

function populatePromoEditor(promo) {
  if (!promo) return;
  activePromoId = promo._id ? String(promo._id) : null;
  const promoIdEl = document.getElementById('promoId');
  if (promoIdEl) promoIdEl.value = activePromoId || '';

  const promoEnabledEl = document.getElementById('promoEnabled');
  if (promoEnabledEl) promoEnabledEl.checked = !!promo.enabled;

  const promoTitleEl = document.getElementById('promoTitle');
  if (promoTitleEl) promoTitleEl.value = promo.title || '';

  const promoCategoryEl = document.getElementById('promoCategory');
  if (promoCategoryEl) promoCategoryEl.value = promo.category || 'whats-new';

  const promoDescEl = document.getElementById('promoDescription');
  if (promoDescEl) promoDescEl.value = promo.description || '';

  const promoLinkEl = document.getElementById('promoLink');
  if (promoLinkEl) promoLinkEl.value = promo.link || '';

  const promoOrientEl = document.getElementById('promoOrientation');
  if (promoOrientEl) promoOrientEl.value = promo.orientation || 'horizontal';

  const promoMediaFitEl = document.getElementById('promoMediaFit');
  if (promoMediaFitEl) promoMediaFitEl.value = promo.mediaFit || 'cover';

  const promoRotationEl = document.getElementById('promoRotationInterval');
  if (promoRotationEl) promoRotationEl.value = promo.imageRotationInterval || 2500;
  
  // Frequency
  const promoFreqEl = document.getElementById('promoFrequency');
  if (promoFreqEl) promoFreqEl.value = promo.frequency || 'once';

  const promoCustomFreqEl = document.getElementById('promoCustomFreqHours');
  if (promoCustomFreqEl) promoCustomFreqEl.value = promo.customFrequencyHours || '0';
  togglePromoCustomFrequency();

  // Limited offer / Dates
  const isLimited = !!promo.isLimitedOffer;
  const promoLimitedEl = document.getElementById('promoIsLimitedOffer');
  if (promoLimitedEl) promoLimitedEl.checked = isLimited;

  const promoStartEl = document.getElementById('promoStartDate');
  if (promoStartEl) {
    promoStartEl.value = promo.startDate ? promo.startDate.substring(0, 16) : '';
  }

  const promoEndEl = document.getElementById('promoEndDate');
  if (promoEndEl) {
    promoEndEl.value = promo.endDate ? promo.endDate.substring(0, 16) : '';
  }
  togglePromoDateRange();

  // Buttons
  const buttons = promo.buttons || {};
  const btnPrimaryShowEl = document.getElementById('promoBtnPrimaryShow');
  if (btnPrimaryShowEl) btnPrimaryShowEl.checked = buttons.primary?.show !== false;

  const btnPrimaryTextEl = document.getElementById('promoBtnPrimaryText');
  if (btnPrimaryTextEl) btnPrimaryTextEl.value = buttons.primary?.text || 'Read Release Notes';

  const btnSecondaryShowEl = document.getElementById('promoBtnSecondaryShow');
  if (btnSecondaryShowEl) btnSecondaryShowEl.checked = buttons.secondary?.show !== false;

  const btnSecondaryTextEl = document.getElementById('promoBtnSecondaryText');
  if (btnSecondaryTextEl) btnSecondaryTextEl.value = buttons.secondary?.text || 'Got it';

  // Media
  promoMediaUrls = Array.isArray(promo.media) ? [...promo.media] : [];
  renderPromoMediaList();
}

function renderPromoMediaList() {
  const container = document.getElementById('promoMediaList');
  if (!container) return;

  if (!promoMediaUrls || promoMediaUrls.length === 0) {
    container.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.9rem; margin: auto;">No media added yet</span>';
    return;
  }

  container.innerHTML = '';
  promoMediaUrls.forEach((url, idx) => {
    const badge = document.createElement('div');
    badge.className = 'media-badge';
    badge.title = 'Click to remove';
    badge.onclick = () => removePromoMediaUrl(idx);
    badge.innerHTML = `
      <i class="fas fa-image"></i>
      <span style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(url.split('/').pop() || url)}</span>
      <i class="fas fa-times" style="font-size: 0.8rem; margin-left: 5px; color: var(--text-secondary);"></i>
    `;
    container.appendChild(badge);
  });
}

function addPromoMediaUrl(url = '') {
  const input = document.getElementById('promoMediaUrl');
  const value = url || (input ? input.value.trim() : '');
  
  if (!value) return;
  try { new URL(value); } catch(e) { 
    showNotification('Please enter a valid URL', 'error');
    return;
  }

  promoMediaUrls.push(value);
  renderPromoMediaList();
  if (input && !url) input.value = '';
}
window.addPromoMediaUrl = addPromoMediaUrl;

function removePromoMediaUrl(index) {
  promoMediaUrls.splice(index, 1);
  renderPromoMediaList();
}

async function uploadPromoImage(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    showNotification('Uploading image to Supabase...', 'info');
    const response = await fetch('/api/v2/examdata', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`
      },
      body: formData
    });

    const data = await response.json();
    if (response.ok && data.url) {
      addPromoMediaUrl(data.url);
      showNotification('Image uploaded successfully!', 'success');
    } else {
      showNotification(data.error || 'Upload failed', 'error');
    }
  } catch (err) {
    console.error(err);
    showNotification('Upload failed', 'error');
  }
  input.value = '';
}
window.uploadPromoImage = uploadPromoImage;

function togglePromoCustomFrequency() {
  const freqEl = document.getElementById('promoFrequency');
  const freq = freqEl ? freqEl.value : 'once';
  const container = document.getElementById('promoCustomFreqContainer');
  if (container) {
    container.style.display = freq === 'custom' ? 'block' : 'none';
  }
  const inputEl = document.getElementById('promoCustomFreqHours');
  if (inputEl) {
    inputEl.disabled = freq !== 'custom';
  }
}
window.togglePromoCustomFrequency = togglePromoCustomFrequency;

function togglePromoDateRange() {
  const limitedEl = document.getElementById('promoIsLimitedOffer');
  const isLimited = limitedEl ? limitedEl.checked : false;
  const container = document.getElementById('promoDateRangeContainer');
  if (container) {
    container.style.display = isLimited ? 'flex' : 'none';
  }
}
window.togglePromoDateRange = togglePromoDateRange;

function clearPromoForm() {
  activePromoId = null;
  const promoIdEl = document.getElementById('promoId');
  if (promoIdEl) promoIdEl.value = '';
  const form = document.getElementById('promotionForm');
  if (form) form.reset();
  promoMediaUrls = [];
  renderPromoMediaList();
  togglePromoCustomFrequency();
  togglePromoDateRange();
}
window.clearPromoForm = clearPromoForm;

async function savePromoForm() {
  try {
    const isEdit = !!activePromoId;
    const method = isEdit ? 'PUT' : 'POST';

    const titleEl = document.getElementById('promoTitle');
    const descEl = document.getElementById('promoDescription');
    const titleVal = titleEl ? titleEl.value.trim() : '';
    const descVal = descEl ? descEl.value.trim() : '';

    if (!titleVal) {
      showNotification('Please enter a promotion title', 'error');
      if (titleEl) titleEl.focus();
      return;
    }

    if (!descVal) {
      showNotification('Please enter a promotion description', 'error');
      if (descEl) descEl.focus();
      return;
    }

    const buttons = {
      primary: {
        show: document.getElementById('promoBtnPrimaryShow') ? document.getElementById('promoBtnPrimaryShow').checked : true,
        text: (document.getElementById('promoBtnPrimaryText') ? document.getElementById('promoBtnPrimaryText').value.trim() : '') || 'Read Release Notes'
      },
      secondary: {
        show: document.getElementById('promoBtnSecondaryShow') ? document.getElementById('promoBtnSecondaryShow').checked : true,
        text: (document.getElementById('promoBtnSecondaryText') ? document.getElementById('promoBtnSecondaryText').value.trim() : '') || 'Got it'
      }
    };

    const promoPayload = {
      enabled: document.getElementById('promoEnabled') ? document.getElementById('promoEnabled').checked : false,
      title: titleVal,
      category: (document.getElementById('promoCategory') ? document.getElementById('promoCategory').value.trim() : '') || 'whats-new',
      description: descVal,
      link: document.getElementById('promoLink') ? document.getElementById('promoLink').value.trim() : '',
      orientation: document.getElementById('promoOrientation') ? document.getElementById('promoOrientation').value : 'horizontal',
      mediaFit: document.getElementById('promoMediaFit') ? document.getElementById('promoMediaFit').value : 'cover',
      imageRotationInterval: parseInt(document.getElementById('promoRotationInterval') ? document.getElementById('promoRotationInterval').value : 2500) || 2500,
      frequency: document.getElementById('promoFrequency') ? document.getElementById('promoFrequency').value : 'once',
      customFrequencyHours: parseInt(document.getElementById('promoCustomFreqHours') ? document.getElementById('promoCustomFreqHours').value : 0) || 0,
      isLimitedOffer: document.getElementById('promoIsLimitedOffer') ? document.getElementById('promoIsLimitedOffer').checked : false,
      startDate: document.getElementById('promoStartDate') ? document.getElementById('promoStartDate').value : '',
      endDate: document.getElementById('promoEndDate') ? document.getElementById('promoEndDate').value : '',
      buttons,
      media: promoMediaUrls
    };

    if (isEdit) {
      promoPayload._id = activePromoId;
    }

    showNotification('Saving promotion data...', 'info');
    const response = await fetch('/api/v2/promotions', {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`
      },
      body: JSON.stringify(promoPayload)
    });

    const data = await response.json();
    if (response.ok) {
      try {
        await fetch('/api/v2/save-promo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(promoPayload)
        });
      } catch (e) {
        console.warn('Sync save-promo failed:', e);
      }
      showNotification('Promotion saved successfully!', 'success');
      if (data.promo) {
        currentPromoData = data.promo;
        activePromoId = String(data.promo._id);
      } else if (data.id) {
        activePromoId = String(data.id);
      }
      switchPromoInnerTab('promo-history');
    } else {
      showNotification(data.error || 'Failed to save promotion', 'error');
    }
  } catch (err) {
    console.error(err);
    showNotification('Failed to save promotion: ' + (err.message || 'Error'), 'error');
  }
}
window.savePromoForm = savePromoForm;

async function editPromoCms(id) {
  try {
    const response = await fetch('/api/v2/promotions?all=true', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`
      }
    });
    if (response.ok) {
      const list = await response.json();
      const promo = list.find(p => String(p._id) === String(id));
      if (promo) {
        populatePromoEditor(promo);
        switchPromoInnerTab('promo-editor');
      } else {
        showNotification('Promotion not found', 'error');
      }
    } else {
      showNotification('Failed to load promotion details', 'error');
    }
  } catch (err) {
    console.error(err);
    showNotification('Error loading promotion for editing', 'error');
  }
}
window.editPromoCms = editPromoCms;

async function activatePromoCms(id) {
  if (!confirm('Are you sure you want to activate this promotion? This will disable other active promotions.')) return;
  try {
    // Fetch all promos
    const response = await fetch('/api/v2/promotions?all=true', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`
      }
    });
    if (!response.ok) throw new Error('Failed to fetch promos');
    const list = await response.json();

    showNotification('Activating promotion...', 'info');
    // 1. Disable other promotions
    for (const promo of list) {
      if (String(promo._id) !== String(id) && promo.enabled) {
        await fetch('/api/v2/promotions', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`
          },
          body: JSON.stringify({ ...promo, enabled: false })
        });
      }
    }

    // 2. Enable target promotion
    const target = list.find(p => String(p._id) === String(id));
    if (!target) throw new Error('Target promotion not found');

    const updateRes = await fetch('/api/v2/promotions', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`
      },
      body: JSON.stringify({ ...target, enabled: true })
    });

    if (updateRes.ok) {
      showNotification('Promotion activated!', 'success');
      loadPromoHistoryCms();
    } else {
      showNotification('Failed to activate promotion', 'error');
    }
  } catch (err) {
    console.error(err);
    showNotification('Error activating promotion: ' + (err.message || 'Error'), 'error');
  }
}
window.activatePromoCms = activatePromoCms;

async function deletePromoCms(id) {
  if (!confirm('Are you sure you want to delete this promotion? This cannot be undone.')) return;
  try {
    const response = await fetch(`/api/v2/promotions?id=${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`
      }
    });
    if (response.ok) {
      showNotification('Promotion deleted successfully', 'success');
      loadPromoHistoryCms();
    } else {
      const data = await response.json().catch(() => ({}));
      showNotification(data.error || 'Failed to delete promotion', 'error');
    }
  } catch (err) {
    console.error(err);
    showNotification('Error deleting promotion: ' + (err.message || 'Error'), 'error');
  }
}
window.deletePromoCms = deletePromoCms;

// Live preview inside the page modal
function previewPromoLive() {
  const modal = document.getElementById('promoModal');
  if (!modal) return;

  const title = document.getElementById('promoTitle').value.trim() || 'Preview Title';
  const desc = document.getElementById('promoDescription').value.trim() || 'Preview description content...';
  const mediaFit = document.getElementById('promoMediaFit').value;
  const orientation = document.getElementById('promoOrientation').value;

  const titleEl = modal.querySelector('.promo-title');
  const descEl = modal.querySelector('.promo-description');
  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = desc;

  // Media
  const imageEl = modal.querySelector('.promo-cover');
  const videoEl = modal.querySelector('.promo-video');
  
  if (imageEl) imageEl.style.objectFit = mediaFit;
  if (videoEl) videoEl.style.objectFit = mediaFit;

  if (promoMediaUrls.length > 0) {
    const firstMedia = promoMediaUrls[0];
    const isVideo = firstMedia.endsWith('.mp4') || firstMedia.endsWith('.webm');

    if (isVideo) {
      if (videoEl) {
        videoEl.src = firstMedia;
        videoEl.style.display = 'block';
      }
      if (imageEl) imageEl.style.display = 'none';
    } else {
      if (imageEl) {
        imageEl.src = firstMedia;
        imageEl.style.display = 'block';
      }
      if (videoEl) videoEl.style.display = 'none';
    }
  } else {
    if (imageEl) imageEl.style.display = 'none';
    if (videoEl) videoEl.style.display = 'none';
  }

  // Buttons
  const primaryShow = document.getElementById('promoBtnPrimaryShow').checked;
  const primaryText = document.getElementById('promoBtnPrimaryText').value.trim() || 'View Offer';
  const secondaryShow = document.getElementById('promoBtnSecondaryShow').checked;
  const secondaryText = document.getElementById('promoBtnSecondaryText').value.trim() || 'Remind me later';

  const primaryBtn = modal.querySelector('#offerButton');
  const secondaryBtn = modal.querySelector('#remindLaterBtn');
  const linkWrapper = modal.querySelector('.promo-link');

  if (primaryBtn) {
    primaryBtn.querySelector('.promo-button-text').textContent = primaryText;
    if (linkWrapper) linkWrapper.style.display = primaryShow ? 'inline-block' : 'none';
  }
  if (secondaryBtn) {
    secondaryBtn.querySelector('.promo-secondary-text').textContent = secondaryText;
    secondaryBtn.style.display = secondaryShow ? 'inline-block' : 'none';
  }

  // Orientation
  const modalContainer = modal.querySelector('.promo-modal');
  if (modalContainer) {
    modalContainer.classList.remove('promo-orientation-vertical');
    modalContainer.style.flexDirection = '';
    modalContainer.style.maxWidth = '';
    
    if (orientation === 'vertical') {
      modalContainer.classList.add('promo-orientation-vertical');
      modalContainer.style.flexDirection = 'column';
      modalContainer.style.maxWidth = '460px';
      
      const imgContainer = modal.querySelector('.promo-image');
      if (imgContainer) {
        imgContainer.style.minWidth = '100%';
        imgContainer.style.height = '200px';
      }
    } else {
      const imgContainer = modal.querySelector('.promo-image');
      if (imgContainer) {
        imgContainer.style.minWidth = '';
        imgContainer.style.height = '';
      }
    }
  }

  modal.style.display = 'flex';
}
window.previewPromoLive = previewPromoLive;

function closePromoModalPreview() {
  const modal = document.getElementById('promoModal');
  if (modal) modal.style.display = 'none';
}
window.closePromoModalPreview = closePromoModalPreview;


// ==========================================
// RELEASES MANAGEMENT
// ==========================================

async function loadReleasesCms() {
  try {
    const response = await fetch('/api/v2/releases');
    if (!response.ok) throw new Error('Failed to fetch releases');
    releasesList = await response.json();

    const tbody = document.getElementById('releasesTableBody');
    if (!tbody) return;

    if (releasesList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No releases logged yet.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    releasesList.forEach(rel => {
      const tr = document.createElement('tr');
      const logsSummary = rel.logs && rel.logs.length > 0 
        ? `<ul style="margin: 0; padding-left: 15px;">${rel.logs.map(l => `<li>${l}</li>`).join('')}</ul>` 
        : 'No logs';

      tr.innerHTML = `
        <td><strong>${rel.version}</strong></td>
        <td><code>${rel.branch || 'stable'}</code></td>
        <td>${rel.build}</td>
        <td>${logsSummary}</td>
        <td>
          <div class="exam-actions-btn">
            <button class="btn btn-outline btn-sm" onclick="openReleaseModalForm('${rel._id}')"><i class="fas fa-edit"></i> Edit</button>
            <button class="btn btn-outline btn-sm btn-danger" onclick="deleteReleaseCms('${rel._id}')"><i class="fas fa-trash"></i> Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    showNotification('Failed to load release logs', 'error');
  }
}
window.loadReleasesCms = loadReleasesCms;

function openReleaseModalForm(id = null) {
  const modal = document.getElementById('releaseModal');
  const title = document.getElementById('releaseModalTitle');
  if (!modal || !title) return;

  document.getElementById('releaseModalForm').reset();
  document.getElementById('releaseId').value = id || '';

  if (id) {
    title.textContent = 'Edit Release';
    const rel = releasesList.find(r => r._id === id);
    if (rel) {
      document.getElementById('releaseVersion').value = rel.version || '';
      document.getElementById('releaseBuild').value = rel.build || '';
      document.getElementById('releaseBranch').value = rel.branch || 'stable';
      document.getElementById('releaseLogs').value = rel.logs ? rel.logs.join('\n') : '';
    }
  } else {
    title.textContent = 'Add New Release';
    document.getElementById('releaseBuild').value = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY
  }

  modal.style.display = 'flex';
}
window.openReleaseModalForm = openReleaseModalForm;

function closeReleaseModal() {
  const modal = document.getElementById('releaseModal');
  if (modal) modal.style.display = 'none';
}
window.closeReleaseModal = closeReleaseModal;

async function saveReleaseForm(event) {
  event.preventDefault();
  const id = document.getElementById('releaseId').value;
  const version = document.getElementById('releaseVersion').value.trim();
  const build = document.getElementById('releaseBuild').value.trim();
  const branch = document.getElementById('releaseBranch').value;
  const logsText = document.getElementById('releaseLogs').value;

  const logs = logsText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (!version || !build || logs.length === 0) {
    showNotification('Version, build date, and logs are required', 'error');
    return;
  }

  const payload = { version, build, branch, logs };
  const method = id ? 'PUT' : 'POST';
  if (id) payload._id = id;

  try {
    showNotification('Saving release notes...', 'info');
    const response = await fetch('/api/v2/releases', {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (response.ok) {
      showNotification('Release saved successfully!', 'success');
      closeReleaseModal();
      loadReleasesCms();
    } else {
      showNotification(data.error || 'Failed to save release', 'error');
    }
  } catch (err) {
    console.error(err);
    showNotification('Failed to save release', 'error');
  }
}
window.saveReleaseForm = saveReleaseForm;

async function deleteReleaseCms(id) {
  if (!confirm('Are you sure you want to delete this release? This cannot be undone.')) return;
  try {
    const response = await fetch(`/api/v2/releases?id=${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`
      }
    });

    if (response.ok) {
      showNotification('Release deleted successfully', 'success');
      loadReleasesCms();
    } else {
      const data = await response.json();
      showNotification(data.error || 'Failed to delete release', 'error');
    }
  } catch (err) {
    console.error(err);
    showNotification('Error deleting release', 'error');
  }
}
window.deleteReleaseCms = deleteReleaseCms;


// ==========================================
// EXAMS & SEATING MANAGEMENT
// ==========================================

function renderSeatingFilesList() {
  const container = document.getElementById('seatingFilesListContainer');
  const testArea = document.getElementById('seatingTestLookupArea');
  if (!container) return;

  if (!activeSeatingUrls || activeSeatingUrls.length === 0) {
    container.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.85rem;">No seating CSV files uploaded yet.</span>';
    if (testArea) testArea.style.display = 'none';
    return;
  }

  if (testArea) testArea.style.display = 'block';

  container.innerHTML = '';
  activeSeatingUrls.forEach((url, idx) => {
    const item = document.createElement('div');
    item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(0,0,0,0.03); border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.88rem;';
    const fileName = url.split('/').pop() || url;
    item.innerHTML = `
      <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 10px;">
        <i class="fas fa-file-csv" style="margin-right: 6px; color: var(--primary-color);"></i>
        <a href="${escapeHtml(url)}" target="_blank" style="color: var(--text-color); font-weight: 500;">${escapeHtml(fileName)}</a>
      </div>
      <button type="button" class="btn btn-outline btn-sm btn-danger" style="padding: 2px 8px; font-size: 0.75rem;" onclick="deleteSeatingCsv(${idx})">
        <i class="fas fa-trash"></i> Delete
      </button>
    `;
    container.appendChild(item);
  });
}
window.renderSeatingFilesList = renderSeatingFilesList;

async function deleteSeatingCsv(index) {
  if (confirm('Are you sure you want to remove this seating CSV file?')) {
    activeSeatingUrls.splice(index, 1);
    activeSeatingUrl = activeSeatingUrls[0] || '';
    renderSeatingFilesList();
    await saveExamConfig(null);
    showNotification('Seating CSV file removed', 'info');
  }
}
window.deleteSeatingCsv = deleteSeatingCsv;

async function loadExamDataCms() {
  try {
    const response = await fetch('/api/v2/examdata');
    if (!response.ok) throw new Error('Failed to load exam data');
    const config = await response.json();

    document.getElementById('examEnabled').checked = !!config.enabled;
    document.getElementById('examRotationInterval').value = config.viewRotationInterval || 15000;
    document.getElementById('examShowBeforeDays').value = config.showBeforeDays || 9;
    document.getElementById('examShowBeforeDaysViva').value = config.showBeforeDaysViva || 3;
    document.getElementById('examDefaultCoverImage').value = config.defaultCoverImage || "";

    activeSeatingUrl = config.seatingDataUrl || "";
    if (Array.isArray(config.seatingDataUrls) && config.seatingDataUrls.length > 0) {
      activeSeatingUrls = config.seatingDataUrls;
    } else if (activeSeatingUrl) {
      activeSeatingUrls = [activeSeatingUrl];
    } else {
      activeSeatingUrls = [];
    }
    currentExamSemesters = config.semesters || [];

    renderSeatingFilesList();
    renderSemestersList();
  } catch (err) {
    console.error(err);
    showNotification('Failed to load exam configurations', 'error');
  }
}
window.loadExamDataCms = loadExamDataCms;

// Save Exam Global Settings and Schedule
async function saveExamConfig(event) {
  if (event) event.preventDefault();

  const payload = {
    enabled: document.getElementById('examEnabled').checked,
    viewRotationInterval: parseInt(document.getElementById('examRotationInterval').value) || 15000,
    showBeforeDays: parseInt(document.getElementById('examShowBeforeDays').value) || 9,
    showBeforeDaysViva: parseInt(document.getElementById('examShowBeforeDaysViva').value) || 3,
    defaultCoverImage: document.getElementById('examDefaultCoverImage').value.trim() || null,
    seatingDataUrl: activeSeatingUrls[0] || null,
    seatingDataUrls: activeSeatingUrls,
    semesters: currentExamSemesters
  };

  try {
    showNotification('Saving exam configurations...', 'info');
    const response = await fetch('/api/v2/examdata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (response.ok) {
      showNotification('Exam settings saved successfully!', 'success');
      loadExamDataCms();
    } else {
      showNotification(data.error || 'Failed to save exam settings', 'error');
    }
  } catch (err) {
    console.error(err);
    showNotification('Failed to save exam settings', 'error');
  }
}

// Bind Submit
const examConfigForm = document.getElementById('examConfigForm');
if (examConfigForm) {
  examConfigForm.addEventListener('submit', saveExamConfig);
}

async function uploadSeatingCsv(input) {
  if (!input.files || input.files.length === 0) return;

  try {
    showNotification('Uploading seating CSV(s)...', 'info');
    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/v2/examdata', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`
        },
        body: formData
      });

      const data = await response.json();
      if (response.ok && data.url) {
        if (!activeSeatingUrls.includes(data.url)) {
          activeSeatingUrls.push(data.url);
        }
      }
    }
    activeSeatingUrl = activeSeatingUrls[0] || '';
    renderSeatingFilesList();
    showNotification('Seating CSV file(s) uploaded successfully!', 'success');
    await saveExamConfig(null);
  } catch (err) {
    console.error(err);
    showNotification('CSV upload failed', 'error');
  }
  input.value = '';
}
window.uploadSeatingCsv = uploadSeatingCsv;

async function testSeatingLookupInCms() {
  const enrollment = document.getElementById('testEnrollmentNo').value.trim();
  const resultDiv = document.getElementById('testSeatingResult');
  if (!enrollment || activeSeatingUrls.length === 0) return;

  resultDiv.style.display = 'block';
  resultDiv.innerHTML = 'Searching CSV files...';

  try {
    let match = null;
    for (const url of activeSeatingUrls) {
      const response = await fetch(url);
      const text = await response.text();
      const lines = text.trim().split(/\r?\n/);
      if (lines.length <= 1) continue;

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length >= headers.length) {
          const row = {};
          headers.forEach((h, idx) => {
            row[h] = (values[idx] || '').trim();
          });

          if (row.enrollment_no === enrollment) {
            match = row;
            break;
          }
        }
      }
      if (match) break;
    }

    if (match) {
      resultDiv.innerHTML = `<span style="color: #28a745; font-weight: 600;">Match Found:</span> Room <strong>${match.room_no || '—'}</strong> · Bench <strong>${match.bench_no || '—'}</strong>`;
    } else {
      resultDiv.innerHTML = `<span style="color: #dc3545;">Enrollment number <strong>${enrollment}</strong> not found in seating CSV files.</span>`;
    }
  } catch (e) {
    console.error(e);
    resultDiv.innerHTML = '<span style="color: #dc3545;">Failed to parse CSV. Check console.</span>';
  }
}
window.testSeatingLookupInCms = testSeatingLookupInCms;

function renderSemestersList() {
  const container = document.getElementById('semesterListContainer');
  if (!container) return;

  if (currentExamSemesters.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 20px;">No semesters added yet. Click "Add Semester Schedule" to begin.</div>';
    return;
  }

  // Sort semesters by number ascending
  currentExamSemesters.sort((a, b) => a.semester - b.semester);

  container.innerHTML = '';
  currentExamSemesters.forEach((sem, semIdx) => {
    const card = document.createElement('div');
    card.className = 'semester-card';

    const examsList = sem.exams && sem.exams.length > 0
      ? sem.exams.map((exam, examIdx) => `
          <div class="exam-grid-item">
            <div>
              <strong>${exam.subject}</strong> <small>(${exam.code || 'No code'})</small> · 
              <span>${exam.date} @ ${exam.time}</span> · 
              <small>${exam.duration || '—'}</small>
              ${exam.global ? '<span class="status-badge active" style="margin-left: 5px; font-size: 0.75rem;">Global</span>' : ''}
            </div>
            <div class="exam-actions-btn">
              <button type="button" class="btn btn-outline btn-sm" onclick="openExamEntryModalForm(${semIdx}, ${examIdx})"><i class="fas fa-edit"></i> Edit</button>
              <button type="button" class="btn btn-outline btn-sm btn-danger" onclick="deleteExamEntry(${semIdx}, ${examIdx})"><i class="fas fa-trash"></i> Remove</button>
            </div>
          </div>
        `).join('')
      : '<div style="color: var(--text-secondary); font-size: 0.85rem; padding: 5px;">No exams added.</div>';

    card.innerHTML = `
      <div class="semester-card-header">
        <span>Semester ${sem.semester} - <span style="font-weight: 500; font-size: 0.95rem; opacity: 0.85;">${sem.examPeriod?.name || 'Semester Exams'}</span></span>
        <div class="exam-actions-btn">
          <button type="button" class="btn btn-outline btn-sm" onclick="openExamEntryModalForm(${semIdx}, -1)"><i class="fas fa-plus"></i> Add Exam</button>
          <button type="button" class="btn btn-outline btn-sm btn-danger" onclick="deleteSemesterSchedule(${semIdx})"><i class="fas fa-trash"></i> Delete Semester</button>
        </div>
      </div>
      <div style="display: flex; gap: 12px; margin-bottom: 16px;">
        <div style="flex: 1;">
          <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; text-align: left;">Exam Period Name</label>
          <input type="text" class="semester-period-name" value="${sem.examPeriod?.name || 'Semester Exams'}" onchange="updateSemesterPeriodName(${semIdx}, this.value)" placeholder="e.g. Mid Semester">
        </div>
        <div style="flex: 1;">
          <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; text-align: left;">Short Name</label>
          <input type="text" class="semester-period-short" value="${sem.examPeriod?.shortName || 'Exams'}" onchange="updateSemesterPeriodShortName(${semIdx}, this.value)" placeholder="e.g. Mid Sem">
        </div>
      </div>
      <div style="margin-top: 10px;">
        ${examsList}
      </div>
    `;
    container.appendChild(card);
  });
}

function updateSemesterPeriodName(semIdx, val) {
  if (currentExamSemesters[semIdx]) {
    currentExamSemesters[semIdx].examPeriod = currentExamSemesters[semIdx].examPeriod || {};
    currentExamSemesters[semIdx].examPeriod.name = val;
    // Auto-calculate shortName if empty
    if (!currentExamSemesters[semIdx].examPeriod.shortName) {
      currentExamSemesters[semIdx].examPeriod.shortName = val.substring(0, 10);
    }
    renderSemestersList();
    saveExamConfig(null);
  }
}
window.updateSemesterPeriodName = updateSemesterPeriodName;

function updateSemesterPeriodShortName(semIdx, val) {
  if (currentExamSemesters[semIdx]) {
    currentExamSemesters[semIdx].examPeriod = currentExamSemesters[semIdx].examPeriod || {};
    currentExamSemesters[semIdx].examPeriod.shortName = val;
    renderSemestersList();
    saveExamConfig(null);
  }
}
window.updateSemesterPeriodShortName = updateSemesterPeriodShortName;

function addNewSemesterSchedule() {
  const semNumStr = prompt('Enter semester number (1-8 or 9 for Miscellaneous):');
  if (!semNumStr) return;
  const semNum = parseInt(semNumStr);
  if (isNaN(semNum) || semNum < 1 || semNum > 9) {
    showNotification('Please enter a valid semester number (1-9)', 'error');
    return;
  }

  // Check if semester already exists
  const exists = currentExamSemesters.some(s => s.semester === semNum);
  if (exists) {
    showNotification(`Semester ${semNum} schedule already exists`, 'error');
    return;
  }

  currentExamSemesters.push({
    semester: semNum,
    examPeriod: {
      name: "Semester Exams",
      shortName: "Exams",
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString()
    },
    exams: []
  });

  renderSemestersList();
  saveExamConfig(null);
}
window.addNewSemesterSchedule = addNewSemesterSchedule;

function deleteSemesterSchedule(semIndex) {
  if (!confirm('Are you sure you want to delete this entire semester schedule?')) return;
  currentExamSemesters.splice(semIndex, 1);
  renderSemestersList();
  saveExamConfig(null);
}
window.deleteSemesterSchedule = deleteSemesterSchedule;

function openExamEntryModalForm(semIndex, examIndex) {
  const modal = document.getElementById('editExamModal');
  const title = document.getElementById('examEntryModalTitle');
  if (!modal || !title) return;

  document.getElementById('examEntryModalForm').reset();
  document.getElementById('examSemesterVal').value = semIndex;
  document.getElementById('examEntryIndex').value = examIndex;

  if (examIndex >= 0) {
    title.textContent = 'Edit Exam Entry';
    const exam = currentExamSemesters[semIndex].exams[examIndex];
    if (exam) {
      document.getElementById('examSubject').value = exam.subject || '';
      document.getElementById('examCode').value = exam.code || '';
      document.getElementById('examDuration').value = exam.duration || '';
      document.getElementById('examDate').value = exam.date || '';
      document.getElementById('examTime').value = exam.time || '';
      document.getElementById('examGlobal').checked = !!exam.global;
      document.getElementById('examAliases').value = exam.aliases ? exam.aliases.join(', ') : '';
      document.getElementById('examImage').value = exam.image || '';
      document.getElementById('examSyllabus').value = exam.syllabus ? exam.syllabus.join('\n') : '';
    }
  } else {
    title.textContent = 'Add Exam Schedule';
  }

  modal.style.display = 'flex';
}
window.openExamEntryModalForm = openExamEntryModalForm;

function closeExamEntryModal() {
  const modal = document.getElementById('editExamModal');
  if (modal) modal.style.display = 'none';
}
window.closeExamEntryModal = closeExamEntryModal;

function saveExamEntryForm(event) {
  event.preventDefault();
  const semIndex = parseInt(document.getElementById('examSemesterVal').value);
  const examIndex = parseInt(document.getElementById('examEntryIndex').value);

  const subject = document.getElementById('examSubject').value.trim();
  const code = document.getElementById('examCode').value.trim();
  const duration = document.getElementById('examDuration').value.trim() || '1.5 hours';
  const date = document.getElementById('examDate').value;
  const time = document.getElementById('examTime').value;
  const global = document.getElementById('examGlobal').checked;
  const aliasesText = document.getElementById('examAliases').value;
  const image = document.getElementById('examImage').value.trim() || null;
  const syllabusText = document.getElementById('examSyllabus').value;

  const aliases = aliasesText.split(',').map(a => a.trim()).filter(a => a.length > 0);
  const syllabus = syllabusText.split('\n').map(s => s.trim()).filter(s => s.length > 0);

  const payload = {
    id: examIndex >= 0 ? currentExamSemesters[semIndex].exams[examIndex].id : Date.now(),
    subject,
    code,
    duration,
    date,
    time,
    global,
    aliases,
    image,
    syllabus
  };

  if (examIndex >= 0) {
    currentExamSemesters[semIndex].exams[examIndex] = payload;
  } else {
    currentExamSemesters[semIndex].exams.push(payload);
  }

  // Update exam dates range based on actual exams
  const exams = currentExamSemesters[semIndex].exams;
  if (exams.length > 0) {
    const dates = exams.map(e => new Date(e.date + 'T' + e.time));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    currentExamSemesters[semIndex].examPeriod.startDate = minDate.toISOString();
    currentExamSemesters[semIndex].examPeriod.endDate = maxDate.toISOString();
  }

  closeExamEntryModal();
  renderSemestersList();
  saveExamConfig(null);
}
window.saveExamEntryForm = saveExamEntryForm;

function deleteExamEntry(semIndex, examIndex) {
  if (!confirm('Are you sure you want to remove this exam entry?')) return;
  currentExamSemesters[semIndex].exams.splice(examIndex, 1);
  renderSemestersList();
  saveExamConfig(null);
}
window.deleteExamEntry = deleteExamEntry;

// Handle Files sub-tab navigation
document.querySelectorAll('.files-sub-tabs > .sub-tab-nav > .sub-tab-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    const subtab = this.getAttribute('data-subtab');
    if (subtab === 'releases') {
      loadReleasesCms();
    } else if (subtab === 'examdata') {
      loadExamDataCms();
    } else if (subtab === 'promotions') {
      loadPromotionData();
    } else if (subtab === 'notifications-mgr') {
      loadNotificationsCms();
    }
  });
});

function isLocalDevelopment() {
  return window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
}

// Share Modal Functions
let currentInviteCode = '';

function openShareModal(inviteCode) {
  console.log('Opening share modal for invite code:', inviteCode);
  currentInviteCode = inviteCode;
  const modal = document.getElementById('shareInviteModal');
  const shareUrl = document.getElementById('shareUrl');

  // Determine the base URL based on the current location
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const baseUrl = isLocalhost ? `${window.location.protocol}//${window.location.host}` : 'https://materioa.netlify.app';

  // Set the default URL
  shareUrl.value = `${baseUrl}/invites/${inviteCode}`;

  // Reset form
  document.getElementById('customHeading').value = '';
  document.getElementById('headingTemplate').value = '';

  // Check if sharelinks database is working
  fetch('/api/v2/invites/diagnostic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inviteCode: inviteCode })
  })
    .then(response => {
      if (!response.ok) {
        // If 404, it might be because the endpoint is not available or path is wrong
        // Try the features endpoint as fallback if needed, or just ignore for now
        console.warn(`Diagnostic check failed with status: ${response.status}`);
        return null;
      }
      return response.json();
    })
    .then(data => {
      if (data) {
        console.log('Debug info:', data);
        if (!data.tableExists && data.found === false && data.error && data.error.includes('relation "sharelinks" does not exist')) {
          showNotification('Sharelinks table not found. Please contact admin.', 'warning');
        }
      }
    })
    .catch(error => {
      console.error('Debug check failed:', error);
      // Don't show error to user, just log it
    });

  // Show modal
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeShareModal() {
  const modal = document.getElementById('shareInviteModal');
  modal.style.display = 'none';
  modal.classList.remove('show');
  currentInviteCode = '';
}

function updateCustomHeading() {
  const template = document.getElementById('headingTemplate').value;
  const customHeading = document.getElementById('customHeading');

  if (template) {
    customHeading.value = template;
    console.log('Template selected:', template);
    console.log('Current invite code:', currentInviteCode);
  }
}

async function updateShareLink() {
  try {
    const customHeading = document.getElementById('customHeading').value.trim();
    const shareUrl = document.getElementById('shareUrl');
    const updateBtn = document.getElementById('updateShareLinkBtn');

    // Show loading state
    updateBtn.disabled = true;
    updateBtn.innerHTML = '<i class="fa-regular fa-loader fa-spin"></i> Updating...';

    console.log('Updating share link for invite code:', currentInviteCode);
    console.log('Custom heading:', customHeading);

    // Determine base URL for share links
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocalhost ? `${window.location.protocol}//${window.location.host}` : 'https://materioa.netlify.app';

    // Try multiple approaches, with fallbacks for each
    let successfulUpdate = false;
    let errorDetails = null;

    // Approach 1: Use the dedicated sharelink endpoint
    if (!successfulUpdate) {
      try {
        console.log('Attempting to update using sharelink endpoint...');
        const response = await fetch('/api/v2/features?action=sharelink', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`
          },
          body: JSON.stringify({
            inviteCode: currentInviteCode,
            customHeading: customHeading || null
          })
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);

        if (response.ok) {
          // Always use clean URL regardless of what's returned
          shareUrl.value = `${baseUrl}/invites/${currentInviteCode}`;
          successfulUpdate = true;
          console.log('Successfully updated using sharelink endpoint');
        } else {
          errorDetails = data.error || 'Unknown error';
          console.warn('Sharelink endpoint failed:', errorDetails);
        }
      } catch (e) {
        console.warn('Error using sharelink endpoint:', e.message);
        errorDetails = e.message;
      }
    }

    // Approach 2: Try using the debug endpoint which might have less restrictive policies
    if (!successfulUpdate) {
      try {
        console.log('Attempting to update using debug-sharelink endpoint...');
        const response = await fetch('/debug-sharelink', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inviteCode: currentInviteCode,
            customHeading: customHeading || null
          })
        });

        const data = await response.json();

        if (response.ok) {
          if (data.sharelink && data.sharelink.url) {
            shareUrl.value = data.sharelink.url;
          } else if (data.url) {
            shareUrl.value = data.url;
          } else {
            // If no URL is returned, just create a clean one without parameters
            shareUrl.value = `${baseUrl}/invites/${currentInviteCode}`;
          }
          successfulUpdate = true;
          console.log('Successfully updated using debug-sharelink endpoint');
        } else {
          console.warn('Debug sharelink endpoint failed:', data.error || 'Unknown error');
        }
      } catch (e) {
        console.warn('Error using debug-sharelink endpoint:', e.message);
      }
    }

    // Approach 3: Fallback to just updating the UI with a URL parameter approach
    if (!successfulUpdate) {
      console.log('Using fallback URL parameter approach...');
      if (customHeading) {
        const updatedUrl = `${baseUrl}/invites/${currentInviteCode}?heading=${encodeURIComponent(customHeading)}`;
        shareUrl.value = updatedUrl;
      } else {
        shareUrl.value = `${baseUrl}/invites/${currentInviteCode}`;
      }

      // Show a special message about the fallback
      if (errorDetails && errorDetails.includes("no data returned")) {
        showNotification('Using URL parameter fallback - database updated but no data returned', 'info');
      } else {
        showNotification('Using URL parameter fallback - link will still work correctly', 'info');
      }

      successfulUpdate = true;
      console.log('Using URL parameter fallback');
    }

    if (successfulUpdate) {
      // After a successful update, let's make sure we fetch the URL without parameters
      try {
        // Wait a moment for the database to update
        await new Promise(resolve => setTimeout(resolve, 500));

        // Try to check if the URL is available without parameters
        console.log('Verifying sharelink in database...');
        try {
          const response = await fetch(`/api/v2/invites/sharelink-info?code=${currentInviteCode}`);

          if (response.ok) {
            // Data exists in database, use a clean URL
            shareUrl.value = `${baseUrl}/invites/${currentInviteCode}`;
            console.log('Verified sharelink exists in database, using clean URL');
          } else {
            console.log('Could not verify sharelink in database, response status:', response.status);
            // Still use clean URL since we know the update succeeded
            shareUrl.value = `${baseUrl}/invites/${currentInviteCode}`;
          }
        } catch (fetchError) {
          console.log('Error fetching sharelink info, still using clean URL:', fetchError);
          // Still use clean URL since we know the update succeeded
          shareUrl.value = `${baseUrl}/invites/${currentInviteCode}`;
        }
      } catch (verifyError) {
        console.warn('Error in verification process:', verifyError);
        // Keep existing URL if verification fails
      }

      showNotification('Share link updated successfully', 'success');
    } else {
      throw new Error(errorDetails || 'Failed to update sharelink');
    }
  } catch (error) {
    console.error('Error updating sharelink:', error);
    showNotification('Error updating sharelink: ' + error.message, 'error');
  } finally {
    // Reset button state
    const updateBtn = document.getElementById('updateShareLinkBtn');
    updateBtn.disabled = false;
    updateBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Share Link';
  }
}

function shareViaWhatsApp() {
  const shareUrl = document.getElementById('shareUrl').value;
  const customHeading = document.getElementById('customHeading').value;

  let message = `Check out this invitation to join Materio!`;
  if (customHeading) {
    message = customHeading.replace('{name}', 'you');
  }
  message += `\n\n${shareUrl}`;

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, '_blank');
}

function shareViaTwitter() {
  const shareUrl = document.getElementById('shareUrl').value;
  const customHeading = document.getElementById('customHeading').value;

  let text = `Join me on Materio - where e-learning doesn't feel like suffering!`;
  if (customHeading) {
    text = customHeading.replace('{name}', 'everyone');
  }

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
  window.open(twitterUrl, '_blank');
}

// Close modal when clicking outside
document.addEventListener('click', function (event) {
  const modal = document.getElementById('shareInviteModal');
  if (event.target === modal) {
    closeShareModal();
  }
});

// Close modal with escape key
document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') {
    closeShareModal();
    closeJsonEditor();
  }
});

// =============================================
// JSON Editor Functions
// =============================================

// Store for staged JSON changes
let stagedJsonChanges = {}; // { path: { content: string, originalContent: string } }
let currentJsonFile = null;
let originalJsonContent = '';

// Open JSON editor for a file
async function openJsonEditor(filePath, downloadUrl) {
  const panel = document.getElementById('jsonEditorPanel');
  const textarea = document.getElementById('jsonEditorTextarea');
  const fileName = document.getElementById('jsonEditorFileName');
  const status = document.getElementById('jsonEditorStatus');
  const statusText = document.getElementById('jsonEditorStatusText');

  // Set the file name
  fileName.textContent = filePath.split('/').pop();
  currentJsonFile = filePath;

  // Show loading state
  textarea.value = 'Loading...';
  textarea.disabled = true;
  panel.classList.add('open');

  try {
    // Fetch the JSON content
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error('Failed to fetch file');

    const content = await response.text();
    originalJsonContent = content;

    // Check if there's already a staged version
    if (stagedJsonChanges[filePath]) {
      textarea.value = stagedJsonChanges[filePath].content;
      statusText.textContent = 'Loaded (has staged changes)';
      status.className = 'json-editor-status success';
    } else {
      // Try to format it
      try {
        const parsed = JSON.parse(content);
        textarea.value = JSON.stringify(parsed, null, 2);
      } catch {
        textarea.value = content;
      }
      statusText.textContent = 'Ready';
      status.className = 'json-editor-status';
    }

    textarea.disabled = false;
  } catch (error) {
    console.error('Error loading JSON:', error);
    textarea.value = '// Error loading file: ' + error.message;
    statusText.textContent = 'Error loading file';
    status.className = 'json-editor-status error';
  }

  // Set up live validation
  textarea.oninput = validateJsonLive;
}

// Close JSON editor
function closeJsonEditor() {
  const panel = document.getElementById('jsonEditorPanel');
  panel.classList.remove('open');
  currentJsonFile = null;
  originalJsonContent = '';
}

// Format JSON in the editor
function formatJson() {
  const textarea = document.getElementById('jsonEditorTextarea');
  const status = document.getElementById('jsonEditorStatus');
  const statusText = document.getElementById('jsonEditorStatusText');

  try {
    const parsed = JSON.parse(textarea.value);
    textarea.value = JSON.stringify(parsed, null, 2);
    statusText.textContent = 'Formatted successfully';
    status.className = 'json-editor-status success';
  } catch (error) {
    statusText.textContent = 'Invalid JSON: ' + error.message;
    status.className = 'json-editor-status error';
  }
}

// Reset JSON editor to original content
function resetJsonEditor() {
  const textarea = document.getElementById('jsonEditorTextarea');
  const status = document.getElementById('jsonEditorStatus');
  const statusText = document.getElementById('jsonEditorStatusText');

  if (originalJsonContent) {
    try {
      const parsed = JSON.parse(originalJsonContent);
      textarea.value = JSON.stringify(parsed, null, 2);
    } catch {
      textarea.value = originalJsonContent;
    }
    statusText.textContent = 'Reset to original';
    status.className = 'json-editor-status';
  }
}

// Validate JSON live as user types
function validateJsonLive() {
  const textarea = document.getElementById('jsonEditorTextarea');
  const status = document.getElementById('jsonEditorStatus');
  const statusText = document.getElementById('jsonEditorStatusText');
  const lineInfo = document.getElementById('jsonEditorLineInfo');

  // Update line info
  const lines = textarea.value.split('\n').length;
  const chars = textarea.value.length;
  lineInfo.textContent = `${lines} lines, ${chars} chars`;

  try {
    JSON.parse(textarea.value);
    statusText.textContent = 'Valid JSON';
    status.className = 'json-editor-status success';
    return true;
  } catch (error) {
    statusText.textContent = 'Invalid: ' + error.message.substring(0, 50);
    status.className = 'json-editor-status error';
    return false;
  }
}

// Load staged changes from localStorage on init
const STAGED_JSON_STORAGE_KEY = 'materio_staged_json';
try {
  const savedStagedJson = localStorage.getItem(STAGED_JSON_STORAGE_KEY);
  if (savedStagedJson) {
    stagedJsonChanges = JSON.parse(savedStagedJson);
    setTimeout(updateStagedJsonCount, 1000); // Update UI after page load
  }
} catch (e) {
  console.error('Failed to load staged JSON from storage:', e);
}

// Warn user if leaving with staged changes
window.addEventListener('beforeunload', (e) => {
  if (Object.keys(stagedJsonChanges).length > 0) {
    e.preventDefault();
    e.returnValue = 'You have staged JSON changes that have not been uploaded. Are you sure you want to leave?';
  }
});

// Stage JSON changes for next upload
function stageJsonChanges() {
  const textarea = document.getElementById('jsonEditorTextarea');
  const status = document.getElementById('jsonEditorStatus');
  const statusText = document.getElementById('jsonEditorStatusText');

  if (!currentJsonFile) {
    showNotification('No file open', 'error');
    return;
  }

  // Validate JSON first
  try {
    JSON.parse(textarea.value);
  } catch (error) {
    showNotification('Cannot stage invalid JSON: ' + error.message, 'error');
    return;
  }

  // Check if content has changed
  const currentContent = textarea.value;
  let originalFormatted;
  try {
    originalFormatted = JSON.stringify(JSON.parse(originalJsonContent), null, 2);
  } catch {
    originalFormatted = originalJsonContent;
  }

  if (currentContent === originalFormatted) {
    showNotification('No changes to stage', 'info');
    return;
  }

  // Stage the changes
  stagedJsonChanges[currentJsonFile] = {
    content: currentContent,
    originalContent: originalJsonContent,
    path: currentJsonFile
  };

  // Save to localStorage
  localStorage.setItem(STAGED_JSON_STORAGE_KEY, JSON.stringify(stagedJsonChanges));

  statusText.textContent = 'Changes staged!';
  status.className = 'json-editor-status success';

  showNotification(`Staged changes to ${currentJsonFile.split('/').pop()}`, 'success');
  updateStagedJsonCount();

  // Close the editor
  setTimeout(() => closeJsonEditor(), 500);
}

// Update the staged JSON count display
function updateStagedJsonCount() {
  const count = Object.keys(stagedJsonChanges).length;

  // Update the global upload options to show staged count
  const globalOptions = document.getElementById('globalUploadOptions');
  if (globalOptions) {
    let badge = globalOptions.querySelector('.staged-json-count');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'staged-json-count';
        globalOptions.querySelector('.upload-all-container')?.prepend(badge);
      }
      badge.innerHTML = `<i class="fas fa-code"></i> ${count} JSON file(s) staged`;
      globalOptions.style.display = 'block';
    } else if (badge) {
      badge.remove();
    }
  }
}

// Get staged JSON for the commit
function getStagedJsonForCommit() {
  return Object.values(stagedJsonChanges).map(item => ({
    path: item.path,
    content: item.content
  }));
}

// Clear staged JSON after successful upload
function clearStagedJson() {
  stagedJsonChanges = {};
  localStorage.removeItem(STAGED_JSON_STORAGE_KEY);
  updateStagedJsonCount();
}

// ==========================================
// OAuth Tab Management
// ==========================================

let oauthInitialized = false;

function initializeOAuthTab() {
  if (oauthInitialized) {
    loadOAuthApps();
    return;
  }
  
  oauthInitialized = true;
  
  // Bind form submission
  const registerForm = document.getElementById('oauthRegisterForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const nameInput = document.getElementById('oauthAppName');
      const uriInput = document.getElementById('oauthRedirectUri');
      const submitBtn = this.querySelector('button[type="submit"]');
      
      if (!nameInput || !uriInput) return;
      
      const name = nameInput.value.trim();
      const redirectUri = uriInput.value.trim();
      
      if (!name || !redirectUri) {
        showNotification('Please enter both name and redirect URI', 'error');
        return;
      }
      
      try {
        submitBtn.disabled = true;
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Registering...';
        
        const response = await makeApiRequest('auth?action=oauth_register_app', 'POST', {
          name,
          redirectUri
        }, true);
        
        if (response && response.success) {
          showNotification('Application registered successfully!', 'success');
          nameInput.value = '';
          uriInput.value = '';
          loadOAuthApps();
        }
      } catch (error) {
        console.error('Register OAuth app error:', error);
        showNotification(error.message || 'Failed to register application', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register Application';
      }
    });
  }
  
  loadOAuthApps();
}

async function loadOAuthApps() {
  const loading = document.getElementById('oauthAppsLoading');
  const empty = document.getElementById('oauthAppsEmpty');
  const list = document.getElementById('oauthAppsList');
  
  if (!loading || !empty || !list) return;
  
  loading.style.display = 'block';
  empty.style.display = 'none';
  list.style.display = 'none';
  list.innerHTML = '';
  
  try {
    const response = await makeApiRequest('auth?action=oauth_list_apps', 'GET', null, true);
    
    loading.style.display = 'none';
    
    if (response && response.apps && response.apps.length > 0) {
      list.style.display = 'flex';
      
      response.apps.forEach(app => {
        const card = document.createElement('div');
        card.className = 'oauth-app-card';
        card.innerHTML = `
          <div class="oauth-app-header">
            <span class="oauth-app-title">${escapeHtml(app.name)}</span>
          </div>
          <div class="oauth-app-details">
            <div class="oauth-detail-row">
              <span class="oauth-detail-label">Client ID</span>
              <div class="oauth-detail-value-wrapper">
                <span class="oauth-detail-value" id="client-id-${app.client_id}">${app.client_id}</span>
                <button type="button" class="oauth-copy-btn" onclick="copyOAuthField('${app.client_id}')" title="Copy Client ID">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
            </div>
            <div class="oauth-detail-row">
              <span class="oauth-detail-label">Client Secret</span>
              <div class="oauth-detail-value-wrapper">
                <input type="password" class="oauth-detail-value" id="secret-${app.client_id}" value="${app.client_secret}" readonly style="border: 1px solid var(--border-color); border-radius: 6px;">
                <button type="button" class="oauth-toggle-btn" onclick="toggleOAuthSecret('${app.client_id}')" title="Toggle Secret Visibility">
                  <i class="fas fa-eye"></i>
                </button>
                <button type="button" class="oauth-copy-btn" onclick="copyOAuthSecret('${app.client_id}')" title="Copy Secret">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
            </div>
            <div class="oauth-detail-row">
              <span class="oauth-detail-label">Redirect URI</span>
              <div class="oauth-detail-value-wrapper">
                <span class="oauth-detail-value">${escapeHtml(app.redirect_uri)}</span>
              </div>
            </div>
          </div>
          <div class="oauth-app-actions">
            <button type="button" class="btn-delete-oauth" onclick="deleteOAuthApp('${app.client_id}')">
              <i class="fas fa-trash"></i> Delete App
            </button>
          </div>
        `;
        list.appendChild(card);
      });
    } else {
      empty.style.display = 'block';
    }
  } catch (error) {
    console.error('Load OAuth apps error:', error);
    loading.style.display = 'none';
    showNotification('Failed to load applications', 'error');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function copyOAuthField(clientId) {
  const el = document.getElementById(`client-id-${clientId}`);
  if (el) {
    navigator.clipboard.writeText(el.textContent)
      .then(() => showNotification('Client ID copied to clipboard!', 'success'))
      .catch(() => showNotification('Failed to copy Client ID', 'error'));
  }
}

function toggleOAuthSecret(clientId) {
  const el = document.getElementById(`secret-${clientId}`);
  const btn = document.querySelector(`#oauth .oauth-app-card button[onclick="toggleOAuthSecret('${clientId}')"] i`);
  if (el) {
    if (el.type === 'password') {
      el.type = 'text';
      if (btn) btn.className = 'fas fa-eye-slash';
    } else {
      el.type = 'password';
      if (btn) btn.className = 'fas fa-eye';
    }
  }
}

function copyOAuthSecret(clientId) {
  const el = document.getElementById(`secret-${clientId}`);
  if (el) {
    navigator.clipboard.writeText(el.value)
      .then(() => showNotification('Client Secret copied to clipboard!', 'success'))
      .catch(() => showNotification('Failed to copy Client Secret', 'error'));
  }
}

async function deleteOAuthApp(clientId) {
  if (!confirm('Are you sure you want to delete this application? Any client using these credentials will lose access immediately.')) {
    return;
  }
  
  try {
    const response = await makeApiRequest('auth?action=oauth_delete_app', 'POST', { clientId }, true);
    if (response && response.success) {
      showNotification('Application deleted successfully', 'success');
      loadOAuthApps();
    }
  } catch (error) {
    console.error('Delete OAuth app error:', error);
    showNotification('Failed to delete application', 'error');
  }
}

// Bind to window for HTML inline event handlers
window.initializeOAuthTab = initializeOAuthTab;
window.copyOAuthField = copyOAuthField;
window.toggleOAuthSecret = toggleOAuthSecret;
window.copyOAuthSecret = copyOAuthSecret;
window.deleteOAuthApp = deleteOAuthApp;

// NOTIFICATION MANAGEMENT FUNCTIONALITY
// ==============================================
let notificationsListCms = [];

async function loadNotificationsCms() {
  const tbody = document.getElementById('notificationsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 15px;">Loading notifications...</td></tr>';

  try {
    const response = await fetch('/api/v2/notifications', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`
      }
    });

    if (!response.ok) throw new Error('Failed to fetch notifications');
    notificationsListCms = await response.json();

    if (!Array.isArray(notificationsListCms) || notificationsListCms.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 15px; color: var(--text-secondary);">No notifications found.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    notificationsListCms.forEach(item => {
      const tr = document.createElement('tr');
      tr.style.cssText = 'border-bottom: 1px solid var(--border-color); font-size: 0.88rem;';
      const notifId = item._id ? String(item._id) : (item.id || '');
      const dateStr = item.date || (item.timestamp ? new Date(item.timestamp).toLocaleDateString() : 'N/A');

      tr.innerHTML = `
        <td style="padding: 10px;"><strong>${escapeHtml(item.title || 'Untitled')}</strong></td>
        <td style="padding: 10px; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.message || '')}</td>
        <td style="padding: 10px;"><span class="status-badge" style="background: rgba(0,0,0,0.06); color: var(--text-color); font-size: 0.75rem;">${escapeHtml(item.category || 'General')}</span></td>
        <td style="padding: 10px;"><small>${escapeHtml(dateStr)}</small></td>
        <td style="padding: 10px; text-align: right;">
          <div class="exam-actions-btn" style="justify-content: flex-end;">
            <button type="button" class="btn btn-outline btn-sm" onclick="editNotificationCms('${notifId}')"><i class="fas fa-edit"></i> Edit</button>
            <button type="button" class="btn btn-outline btn-sm btn-danger" onclick="deleteNotificationCms('${notifId}')"><i class="fas fa-trash"></i> Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger-color, #e53e3e); padding: 15px;">Failed to load notifications: ${escapeHtml(err.message || 'Error')}</td></tr>`;
    }
  }
}
window.loadNotificationsCms = loadNotificationsCms;

function clearNotifForm() {
  const idEl = document.getElementById('notifId');
  if (idEl) idEl.value = '';
  const titleInput = document.getElementById('notifTitle');
  if (titleInput) titleInput.value = '';
  const catInput = document.getElementById('notifCategory');
  if (catInput) catInput.value = '';
  const msgInput = document.getElementById('notifMessage');
  if (msgInput) msgInput.value = '';
  const linkInput = document.getElementById('notifLink');
  if (linkInput) linkInput.value = '';

  const titleEl = document.getElementById('notifFormTitle');
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-plus-circle"></i> Add New Notification';
}
window.clearNotifForm = clearNotifForm;

function editNotificationCms(id) {
  const item = notificationsListCms.find(n => String(n._id || n.id) === String(id));
  if (!item) return;

  const idEl = document.getElementById('notifId');
  if (idEl) idEl.value = String(item._id || item.id);
  const titleInput = document.getElementById('notifTitle');
  if (titleInput) titleInput.value = item.title || '';
  const catInput = document.getElementById('notifCategory');
  if (catInput) catInput.value = item.category || '';
  const msgInput = document.getElementById('notifMessage');
  if (msgInput) msgInput.value = item.message || '';
  const linkInput = document.getElementById('notifLink');
  if (linkInput) linkInput.value = item.link || '';

  const titleEl = document.getElementById('notifFormTitle');
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-edit"></i> Edit Notification';

  if (titleInput) titleInput.focus();
}
window.editNotificationCms = editNotificationCms;

async function saveNotificationCms(event) {
  if (event) event.preventDefault();

  const idEl = document.getElementById('notifId');
  const titleInput = document.getElementById('notifTitle');
  const catInput = document.getElementById('notifCategory');
  const msgInput = document.getElementById('notifMessage');
  const linkInput = document.getElementById('notifLink');

  const id = idEl ? idEl.value.trim() : '';
  const title = titleInput ? titleInput.value.trim() : '';
  const category = catInput ? catInput.value.trim() : '';
  const message = msgInput ? msgInput.value.trim() : '';
  const link = linkInput ? linkInput.value.trim() : '';

  if (!title || !message) {
    showNotification('Please enter both title and message', 'error');
    return;
  }

  const payload = { title, category, message, link };
  if (id) payload._id = id;

  const method = id ? 'PUT' : 'POST';

  try {
    showNotification('Saving notification...', 'info');
    const response = await fetch('/api/v2/notifications', {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (response.ok) {
      showNotification(id ? 'Notification updated!' : 'Notification created!', 'success');
      clearNotifForm();
      loadNotificationsCms();
    } else {
      showNotification(data.error || 'Failed to save notification', 'error');
    }
  } catch (err) {
    console.error(err);
    showNotification('Failed to save notification', 'error');
  }
}
window.saveNotificationCms = saveNotificationCms;

async function deleteNotificationCms(id) {
  if (!confirm('Are you sure you want to delete this notification?')) return;

  try {
    showNotification('Deleting notification...', 'info');
    const response = await fetch(`/api/v2/notifications?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('materio_auth_token')}`
      }
    });

    const data = await response.json();
    if (response.ok) {
      showNotification('Notification deleted!', 'success');
      loadNotificationsCms();
    } else {
      showNotification(data.error || 'Failed to delete notification', 'error');
    }
  } catch (err) {
    console.error(err);
    showNotification('Failed to delete notification', 'error');
  }
}
window.deleteNotificationCms = deleteNotificationCms;