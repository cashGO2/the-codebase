/**
 * Profile Image Module (ESM)
 * Handles user profile image display, dropdown functionality, and account card updates.
 * 
 * @module profile-image
 */

import { setCookie } from './utils.js';

// Constants for authentication storage
const LOCAL_STORAGE_TOKEN_KEY = 'materio_auth_token';
const LOCAL_STORAGE_USER_KEY = 'materio_user';

/**
 * Check if user is logged in
 * @returns {boolean}
 */
function isUserLoggedIn() {
  return !!localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY);
}

/**
 * Get current user data from localStorage
 * @returns {Object|null}
 */
function getUserData() {
  const userData = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
  if (!userData) return null;

  try {
    return JSON.parse(userData);
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
}

/**
 * Update profile image element with user's image
 * @param {HTMLImageElement} imgElement
 */
function updateProfileImage(imgElement) {
  const user = getUserData();
  if (user?.profilePicture) {
    imgElement.src = user.profilePicture;
  }
}

/**
 * Update account card in settings tab
 * @param {HTMLImageElement} accountProfileImage
 * @param {HTMLElement} accountName
 * @param {HTMLElement} accountUsername
 */
function updateAccountCard(accountProfileImage, accountName, accountUsername) {
  const user = getUserData();
  if (!user) return;

  // Update profile picture
  if (user.profilePicture && accountProfileImage) {
    accountProfileImage.src = user.profilePicture;
  }

  // Update display name and username
  if (accountName) {
    accountName.innerHTML = user.displayName || user.username || '';

    // Add verified badges
    if (user.hasAdminPrivileges) {
      accountName.innerHTML += '<i class="fas fa-badge-check verified-badge admin" title="Admin"></i>';
    } else if (user.isPlusUser) {
      accountName.innerHTML += '<i class="fas fa-badge-check verified-badge plus" title="Plus User"></i>';
    }
  }

  if (accountUsername && user.username) {
    accountUsername.textContent = '@' + user.username;
  }
}

/**
 * Show settings tab
 */
function showSettingsTab() {
  const tabLinks = document.querySelectorAll('.tab-link');
  const tabContents = document.querySelectorAll('.tab-content');
  const settingsContent = document.getElementById('settings');

  if (!settingsContent) return;

  // Remove active class from all tabs and contents
  tabLinks.forEach(tab => {
    tab.classList.remove('active');
    const icon = tab.querySelector('i');
    if (icon && !tab.querySelector('img')) {
      icon.classList.remove('fas');
      icon.classList.add('far');
    }
  });
  tabContents.forEach(content => content.classList.remove('active'));

  // Add active class to profile icon
  const profileIcon = document.querySelector('.profile-icon');
  if (profileIcon) {
    profileIcon.classList.add('active');
    const icon = profileIcon.querySelector('i');
    if (icon && !profileIcon.querySelector('img')) {
      icon.classList.remove('far');
      icon.classList.add('fas');
    }
  }

  // Show settings content
  settingsContent.classList.add('active');

  // Hide search dropdown
  const searchResults = document.getElementById('quickSearchResults');
  if (searchResults) {
    searchResults.style.display = 'none';
  }

  // Update cookie
  setCookie('activeTab', 'settings', 7);
}

/**
 * Show downloads tab
 */
function showDownloadsTab() {
  const tabLinks = document.querySelectorAll('.tab-link');
  const tabContents = document.querySelectorAll('.tab-content');
  const downloadsContent = document.getElementById('downloads');

  if (!downloadsContent) return;

  // Remove active class from all tabs and contents
  tabLinks.forEach(tab => tab.classList.remove('active'));
  tabContents.forEach(content => content.classList.remove('active'));

  // Add active class to profile icon
  const profileIcon = document.querySelector('.profile-icon');
  if (profileIcon) {
    profileIcon.classList.add('active');
  }

  // Show downloads content
  downloadsContent.classList.add('active');

  // Hide search dropdown
  const searchResults = document.getElementById('quickSearchResults');
  if (searchResults) {
    searchResults.style.display = 'none';
  }

  // Update cookie
  setCookie('activeTab', 'downloads', 7);

  // Trigger downloads load
  setTimeout(() => {
    document.dispatchEvent(new Event('downloadsTabOpened'));
  }, 100);
}

/**
 * Handle clicks outside dropdown to close it
 * @param {Event} e
 */
function handleOutsideClick(e) {
  const profileIconLink = document.querySelector('.profile-icon');
  const profileDropdown = document.getElementById('profile-dropdown');

  if (profileDropdown &&
    !profileIconLink?.contains(e.target) &&
    !profileDropdown.contains(e.target)) {
    profileDropdown.classList.remove('show');
    profileDropdown.setAttribute('aria-hidden', 'true');
    profileDropdown.querySelectorAll('.dropdown-item').forEach(
      item => item.setAttribute('tabindex', '-1')
    );
    // Reset submenus
    profileDropdown.querySelectorAll('.has-submenu').forEach(
      p => p.classList.remove('submenu-open')
    );
  }
}

/**
 * Handle keyboard navigation in dropdown
 * @param {KeyboardEvent} e
 */
function handleDropdownKeydown(e) {
  const profileDropdown = document.getElementById('profile-dropdown');
  const profileIconLink = document.querySelector('.profile-icon');

  if (!profileDropdown?.classList.contains('show')) return;

  const items = profileDropdown.querySelectorAll('.dropdown-item');
  const currentIndex = Array.from(items).indexOf(document.activeElement);

  switch (e.key) {
    case 'Escape':
      e.preventDefault();
      profileDropdown.classList.remove('show');
      profileDropdown.setAttribute('aria-hidden', 'true');
      items.forEach(item => item.setAttribute('tabindex', '-1'));
      profileDropdown.querySelectorAll('.has-submenu').forEach(p => p.classList.remove('submenu-open'));
      profileIconLink?.focus();
      break;
    case 'ArrowDown':
      e.preventDefault();
      items[(currentIndex + 1) % items.length]?.focus();
      break;
    case 'ArrowUp':
      e.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length]?.focus();
      break;
    case 'Enter':
    case ' ':
      e.preventDefault();
      if (document.activeElement?.classList.contains('dropdown-item')) {
        document.activeElement.click();
      }
      break;
  }
}

/**
 * Set up profile dropdown functionality
 * @param {HTMLElement} profileIconLink
 * @param {HTMLElement} profileDropdown
 */
function setupProfileDropdown(profileIconLink, profileDropdown) {
  if (!profileIconLink || !profileDropdown) return;

  // Mark as having dropdown functionality
  profileIconLink.classList.add('has-dropdown');

  // Profile icon click handler
  profileIconLink.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (!e.target.closest('.profile-dropdown')) {
      const isShowing = profileDropdown.classList.contains('show');

      // Haptic feedback
      if (window.MaterioHaptics) {
        window.MaterioHaptics.vibrate(isShowing ? 'dropdownClose' : 'dropdownOpen');
      }

      profileDropdown.classList.toggle('show');
      profileDropdown.setAttribute('aria-hidden', isShowing ? 'true' : 'false');

      // Update tabindex for focusable items
      const dropdownItems = profileDropdown.querySelectorAll('.dropdown-item');
      dropdownItems.forEach(item => {
        item.setAttribute('tabindex', isShowing ? '-1' : '0');
      });

      // Focus first item when opening
      if (!isShowing) {
        dropdownItems[0]?.focus();
      }
    }
  }, true);

  // Settings dropdown item click
  const settingsItem = profileDropdown.querySelector('.dropdown-item[data-action="settings"]');
  if (settingsItem) {
    settingsItem.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();

      if (window.MaterioHaptics) {
        window.MaterioHaptics.vibrate('select');
      }

      profileDropdown.classList.remove('show');
      profileDropdown.setAttribute('aria-hidden', 'true');
      profileDropdown.querySelectorAll('.dropdown-item').forEach(
        item => item.setAttribute('tabindex', '-1')
      );

      showSettingsTab();
    });
  }

  // Downloads dropdown item click
  const downloadsItem = profileDropdown.querySelector('.dropdown-item[data-action="downloads"]');
  if (downloadsItem) {
    downloadsItem.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();

      if (window.MaterioHaptics) {
        window.MaterioHaptics.vibrate('select');
      }

      profileDropdown.classList.remove('show');
      profileDropdown.setAttribute('aria-hidden', 'true');
      profileDropdown.querySelectorAll('.dropdown-item').forEach(
        item => item.setAttribute('tabindex', '-1')
      );

      showDownloadsTab();
    });
  }

  // Handle nested submenu interactions (event delegation for dynamic classes)
  profileDropdown.addEventListener('click', function (e) {
    const parent = e.target.closest('.has-submenu');
    if (!parent) return;

    // If we clicked inside the submenu itself (on an actual item), don't toggle the submenu
    if (e.target.closest('.dropdown-submenu')) return;

    // Prevent event from bubbling up and closing the menu
    e.stopPropagation();

    const isOpening = !parent.classList.contains('submenu-open');

    // Close all other submenus in this dropdown
    profileDropdown.querySelectorAll('.has-submenu').forEach(p => {
      if (p !== parent) p.classList.remove('submenu-open');
    });

    // Toggle this one
    parent.classList.toggle('submenu-open');

    if (window.MaterioHaptics) {
      window.MaterioHaptics.vibrate(isOpening ? 'dropdownOpen' : 'dropdownClose');
    }
  });

  // Close dropdown when any item inside a submenu is clicked
  profileDropdown.addEventListener('click', function (e) {
    const item = e.target.closest('.dropdown-submenu .dropdown-item');
    if (!item) return;

    // Close everything
    profileDropdown.classList.remove('show');
    profileDropdown.setAttribute('aria-hidden', 'true');
    profileDropdown.querySelectorAll('.has-submenu').forEach(p => p.classList.remove('submenu-open'));

    if (window.MaterioHaptics) {
      window.MaterioHaptics.vibrate('select');
    }
  });

  // Event listeners for closing dropdown
  document.addEventListener('click', handleOutsideClick);
  document.addEventListener('keydown', handleDropdownKeydown);

  // Initial aria state
  profileDropdown.setAttribute('aria-hidden', 'true');
}

/**
 * Log out current user
 */
window.handleLogout = function () {
  localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
  localStorage.removeItem(LOCAL_STORAGE_USER_KEY);

  if (window.MaterioHaptics) {
    window.MaterioHaptics.vibrate('success');
  }

  // Delay reload slightly for haptic feedback
  setTimeout(() => {
    window.location.reload();
  }, 100);
}

/**
 * Initialize profile image module
 */
function init() {
  const profileImage = document.getElementById('profile-image');
  const settingsIcon = document.getElementById('settings-icon');
  const accountProfileImage = document.getElementById('account-profile-image');
  const accountName = document.getElementById('account-name');
  const accountUsername = document.getElementById('account-username');
  const profileDropdown = document.getElementById('profile-dropdown');
  const profileIconLink = document.querySelector('.profile-icon');

  const isLoggedIn = isUserLoggedIn();

  // Update navbar elements
  if (profileImage && settingsIcon) {
    if (isLoggedIn) {
      updateProfileImage(profileImage);
      profileImage.style.display = 'block';
      settingsIcon.style.display = 'none';
    } else {
      profileImage.style.display = 'block';
      profileImage.src = '/assets/img/default-avatar.svg';
      settingsIcon.style.display = 'none';
    }

    setupProfileDropdown(profileIconLink, profileDropdown);
  }

  // Handle Profile dynamic nested menu
  const profileMenuItem = document.getElementById('profile-menu-item');
  const profileItemText = document.getElementById('profile-item-text');
  const profileChevron = document.getElementById('profile-chevron');
  const profileSubmenu = document.getElementById('profile-submenu');

  if (profileMenuItem) {
    if (isLoggedIn) {
      profileMenuItem.classList.add('has-submenu');
      if (profileItemText) profileItemText.textContent = 'Profile';
      if (profileChevron) profileChevron.style.display = 'block';
      if (profileSubmenu) profileSubmenu.style.display = 'flex';
    } else {
      profileMenuItem.classList.remove('has-submenu');
      if (profileItemText) profileItemText.textContent = 'Account';
      if (profileChevron) profileChevron.style.display = 'none';
      if (profileSubmenu) profileSubmenu.style.display = 'none';

      // If not logged in, clicking the parent should take to /account
      profileMenuItem.onclick = function () {
        if (!isUserLoggedIn()) {
          window.location.href = '/account';
        }
      };
    }
  }

  // Update account card in settings tab
  if (accountProfileImage && accountName) {
    if (isLoggedIn) {
      updateAccountCard(accountProfileImage, accountName, accountUsername);
    } else {
      accountProfileImage.src = '/assets/img/default-avatar.svg';
      accountName.textContent = 'Log in to Materio Account';
      if (accountUsername) {
        accountUsername.textContent = '';
      }
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for potential future use
export {
  init,
  isUserLoggedIn,
  getUserData,
  updateProfileImage,
  updateAccountCard,
  showSettingsTab,
  showDownloadsTab
};