/**
 * Notifications Module (ESM)
 * Fetches and displays system notifications with badge management.
 * 
 * @module notify
 */

import { setCookie, getCookie, formatDateTime } from './utils.js';

// Module state
let globalNotifications = [];
const NOTIFICATION_PREF_KEY = 'materio_notifications_enabled';
const WEB_PUSH_API_BASE = '/api/v2/features?action=web-push';
let cachedVapidPublicKey = null;

function isNotificationsEnabled() {
  const stored = localStorage.getItem(NOTIFICATION_PREF_KEY);
  if (stored === 'false') return false;
  if (stored === 'true') return true;

  const cookieValue = getCookie('notificationsEnabled');
  if (cookieValue === 'false') return false;
  if (cookieValue === 'true') return true;

  return true;
}

function setNotificationsEnabled(enabled) {
  const value = enabled ? 'true' : 'false';
  localStorage.setItem(NOTIFICATION_PREF_KEY, value);
  setCookie('notificationsEnabled', value, 365);
}

async function syncServiceWorkerNotificationPreference(enabled) {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      registration.active.postMessage({
        type: 'SET_NOTIFICATIONS_ENABLED',
        enabled: !!enabled
      });
    }
  } catch (error) {
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function getVapidPublicKey() {
  if (cachedVapidPublicKey) return cachedVapidPublicKey;

  const response = await fetch(`${WEB_PUSH_API_BASE}&subAction=public-key`, {
    method: 'GET',
    credentials: 'same-origin'
  });

  if (!response.ok) {
    throw new Error('Failed to fetch VAPID public key');
  }

  const data = await response.json();
  if (!data?.publicKey) {
    throw new Error('VAPID public key missing in response');
  }

  cachedVapidPublicKey = data.publicKey;
  return cachedVapidPublicKey;
}

async function registerSubscriptionOnServer(subscription) {
  const payload = {
    subscription: typeof subscription.toJSON === 'function' ? subscription.toJSON() : subscription
  };

  await fetch(`${WEB_PUSH_API_BASE}&subAction=subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload)
  });
}

async function unregisterSubscriptionOnServer(endpoint) {
  if (!endpoint) return;

  await fetch(`${WEB_PUSH_API_BASE}&subAction=unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ endpoint })
  });
}

async function unsubscribeBrowserPush() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await unregisterSubscriptionOnServer(subscription.endpoint);
      await subscription.unsubscribe();
    }
  } catch (error) {
  }
}

async function setupNotificationsToggle() {
  const notificationsToggle = document.getElementById('notificationsToggle');
  const enabled = isNotificationsEnabled();

  await syncServiceWorkerNotificationPreference(enabled);

  if (!notificationsToggle) {
    if (enabled) {
      await ensureAutomaticNotificationSubscription();
    }
    return;
  }

  notificationsToggle.checked = enabled;

  notificationsToggle.addEventListener('change', async function () {
    const isEnabled = this.checked;
    setNotificationsEnabled(isEnabled);
    await syncServiceWorkerNotificationPreference(isEnabled);

    if (isEnabled) {
      await ensureAutomaticNotificationSubscription();
      await requestServiceWorkerContentCheck();
    } else {
      await unsubscribeBrowserPush();
    }
  });

  if (enabled) {
    await ensureAutomaticNotificationSubscription();
  }
}

async function ensureAutomaticNotificationSubscription() {
  if (!isNotificationsEnabled()) return;
  if (!('Notification' in window)) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch (error) {
    }
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const existingSubscription = await registration.pushManager.getSubscription();

    if (existingSubscription) {
      await registerSubscriptionOnServer(existingSubscription);
      return;
    }

    const publicKey = await getVapidPublicKey();
    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });

    await registerSubscriptionOnServer(subscription);
  } catch (error) {
    console.warn('Web push auto-subscription failed:', error);
  }
}

/**
 * Generate fake notifications for testing
 * @param {number} count - Number of notifications to generate
 * @returns {Array} Array of fake notification objects
 */
function generateFakeNotifications(count = 5) {
  const fakeNotifications = [];
  for (let i = 0; i < count; i++) {
    fakeNotifications.push({
      date: new Date(Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 5)).toISOString(),
      title: `Test Notification ${i + 1}`,
      message: `This is a fake notification created for testing (notification ${i + 1}).`,
      links: []
    });
  }
  return fakeNotifications;
}

/**
 * Display notifications in the notification board
 * @param {Array} notifications - Array of notification objects
 */
function displayNotifications(notifications) {
  const container = document.getElementById('notificationBoard');
  if (!container) return;

  container.innerHTML = '';

  // Reset layout styles
  container.style.display = '';
  container.style.flexDirection = '';
  container.style.justifyContent = '';
  container.style.alignItems = '';
  container.style.minHeight = '';

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 10);

  const validNotifications = notifications
    .filter(n => new Date(n.date) >= cutoff)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (validNotifications.length === 0) {
    renderEmptyState(container);
    return;
  }

  validNotifications.forEach(notification => {
    const card = createNotificationCard(notification);
    container.appendChild(card);
  });
}

/**
 * Render empty state when no notifications
 * @param {HTMLElement} container
 */
function renderEmptyState(container) {
  // Apply centering styles
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.justifyContent = 'center';
  container.style.alignItems = 'center';
  container.style.minHeight = '60vh';

  // Create image element for empty state
  const emptyImg = document.createElement('img');
  emptyImg.src = '/assets/img/193d8b46-eaed-423e-9673-5bed950377ba.webp';
  emptyImg.alt = 'All Caught Up!';
  emptyImg.style.display = 'block';
  emptyImg.style.margin = '0 auto';
  emptyImg.style.height = 'auto';
  emptyImg.style.opacity = '0.7';
  emptyImg.classList.add('empty-state-img');

  // Add responsive styles if not already present
  if (!document.getElementById('notify-empty-style')) {
    const style = document.createElement('style');
    style.id = 'notify-empty-style';
    style.innerHTML = `
            .empty-state-img {
                max-width: 550px;
                width: 100%;
            }
            @media (max-width: 768px) {
                .empty-state-img {
                    max-width: 350px;
                }
            }
        `;
    document.head.appendChild(style);
  }

  container.appendChild(emptyImg);

  // Create text element below image
  const emptyText = document.createElement('p');
  emptyText.textContent = 'All Caught Up !';
  emptyText.style.textAlign = 'center';
  emptyText.style.marginTop = '16px';
  emptyText.style.marginBottom = '0';
  emptyText.style.color = '#666';
  emptyText.style.fontSize = '18px';
  emptyText.style.fontWeight = '900';

  container.appendChild(emptyText);
}

/**
 * Create a notification card element
 * @param {Object} notification - Notification data
 * @returns {HTMLElement} Card element
 */
function createNotificationCard(notification) {
  const card = document.createElement('div');
  card.classList.add('card-layout');
  card.id = 'notify';

  const title = document.createElement('h3');
  title.textContent = notification.title;
  card.appendChild(title);

  const message = document.createElement('p');
  message.textContent = notification.message;
  card.appendChild(message);

  const dateElem = document.createElement('span');
  dateElem.classList.add('notification-date');
  dateElem.textContent = formatDateTime(notification.date);
  card.appendChild(dateElem);

  if (notification.links?.length > 0) {
    const linksContainer = document.createElement('div');
    linksContainer.classList.add('notification-links');
    notification.links.forEach(linkObj => {
      const link = document.createElement('a');
      link.href = linkObj.url;
      link.textContent = linkObj.text;
      linksContainer.appendChild(link);
    });
    card.appendChild(linksContainer);
  }

  if (document.body.classList.contains('dark-mode')) {
    card.classList.add('dark-mode');
  }

  return card;
}

/**
 * Update the notification badge count
 * @param {Array} notifications - Array of notification objects
 */
function updateNotificationBadge(notifications) {
  const lastSeenCookie = getCookie('lastSeenNotification');
  const lastSeen = lastSeenCookie ? new Date(lastSeenCookie) : null;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 10);

  const newCount = notifications
    .filter(n => new Date(n.date) >= cutoff)
    .filter(n => !lastSeen || new Date(n.date) > lastSeen)
    .length;

  const bellLink = document.querySelector('.tab-link[data-tab="notifications"]');
  if (!bellLink) return;

  // Remove old badge
  const oldBadge = bellLink.querySelector('.notification-badge');
  if (oldBadge) {
    oldBadge.remove();
  }

  if (newCount > 0) {
    const badge = document.createElement('span');
    badge.classList.add('notification-badge');
    badge.textContent = newCount;

    // Apply badge styles
    Object.assign(badge.style, {
      backgroundColor: '#ff8400',
      color: '#fff',
      borderRadius: '50%',
      height: '14px',
      width: '14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '8px',
      position: 'absolute',
      zIndex: '1'
    });

    // Position based on viewport
    if (window.innerWidth < 768) {
      badge.style.top = '18px';
      badge.style.right = '18px';
    } else {
      badge.style.top = '4px';
      badge.style.right = '16px';
    }

    bellLink.style.position = 'relative';
    bellLink.appendChild(badge);
  }
}

/**
 * Fetch notifications from server
 * @returns {Promise<Array>}
 */
async function fetchNotifications() {
  const notifyUrl = 'https://cdn-materioa.vercel.app/notifications.json';
  try {
    const response = await fetch(notifyUrl + '?t=' + Date.now());
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error loading notifications:', error);
    return [];
  }
}

/**
 * Fetch latest posts from InsightRoom
 */
async function fetchInsightRoomPosts() {
  try {
    const response = await fetch('https://insightroom.vercel.app/api/posts?t=' + Date.now());
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    return [];
  }
}

/**
 * Fetch latest releases
 */
async function fetchReleases() {
  try {
    const response = await fetch('/assets/data/releases.json?t=' + Date.now());
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    return [];
  }
}

/**
 * Shows a native browser notification via Service Worker (Proper PWA Implementation)
 */
function sendNativeNotification(title, message, url, image = null) {
  if (!isNotificationsEnabled()) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const favicon = '/favicon.ico'; // General favicon for icon

  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title: title,
      message: message,
      url: url,
      icon: favicon,
      image: image // Large cover image (optional)
    });
  } else {
    // Fallback
    new Notification(title, {
      body: message,
      icon: favicon,
      image: image,
      data: { url: url }
    }).onclick = (e) => {
      e.preventDefault();
      window.open(url, '_blank');
    };
  }
}

/**
 * Ask service worker to check for new content and notify.
 * Falls back to in-page check if SW is not available.
 */
async function requestServiceWorkerContentCheck() {
  if (!isNotificationsEnabled()) {
    await syncServiceWorkerNotificationPreference(false);
    return;
  }

  if (!('serviceWorker' in navigator)) {
    await checkForNewContent();
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    if ('sync' in registration) {
      registration.sync.register('materio-content-check').catch(() => {});
    }

    if ('periodicSync' in registration) {
      try {
        let hasPermission = true;
        if (navigator.permissions && navigator.permissions.query) {
          const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
          hasPermission = status.state === 'granted';
        }

        if (hasPermission) {
          await registration.periodicSync.register('materio-content-check', {
            minInterval: 6 * 60 * 60 * 1000
          });
        }
      } catch (error) {
      }
    }

    if (registration.active) {
      registration.active.postMessage({ type: 'CHECK_NEW_CONTENT' });
      return;
    }
  } catch (error) {
  }

  await checkForNewContent();
}

/**
 * Fetch latest 'What's New' posts from site (Jekyll-generated)
 */
async function fetchWhatsNewPosts() {
  try {
    const response = await fetch('/assets/data/posts.json?t=' + Date.now());
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    return [];
  }
}

/**
 * Check for new items across all sources and notify
 */
async function checkForNewContent() {
  if (!isNotificationsEnabled()) {
    return;
  }

  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }

  if (!("Notification" in window) || Notification.permission !== 'granted') {
    return;
  }

  const now = new Date();
  const lastCheck = localStorage.getItem('materio_last_notif_check') || (now.getTime() - 24 * 60 * 60 * 1000);
  const lastCheckDate = new Date(parseInt(lastCheck));

  // Fetch all sources
  const [systemNotifs, resources, updates, releases] = await Promise.all([
    fetchNotifications(),
    fetchInsightRoomPosts(), // Educational Resources
    fetchWhatsNewPosts(),    // Platform Updates
    fetchReleases()
  ]);

  // Helper to normalize dates for comparison (just YYYY-MM-DD)
  const toYMD = (d) => new Date(d).toISOString().split('T')[0];

  // 1. Check System Notifications (New PDFs)
  systemNotifs.forEach(n => {
    if (new Date(n.date) > lastCheckDate) {
      sendNativeNotification('New Resource Added', n.title, n.links?.[0]?.url || '/');
    }
  });

  // 2. Check InsightRoom Posts (Education Resources)
  resources.forEach(p => {
    if (new Date(p.date) > lastCheckDate) {
      const body = p.excerpt ? (p.excerpt.length > 100 ? p.excerpt.slice(0, 97) + '...' : p.excerpt) : p.title;
      sendNativeNotification('New Resource', body, p.link || '/', p.imgUrl);
    }
  });

  // 3. Check 'What's New' Posts (Platform Updates)
  updates.forEach(p => {
    if (new Date(p.date) > lastCheckDate) {
      const body = p.excerpt ? (p.excerpt.length > 100 ? p.excerpt.slice(0, 97) + '...' : p.excerpt) : p.title;
      sendNativeNotification('New Update', body, p.url || '/', p.image);
    }
  });

  // 4. Check Releases (Version Bumps)
  if (releases.length > 0) {
    const latest = releases[0];
    const parts = latest.build.split('/');
    const bDate = new Date(parts[2], parts[1] - 1, parts[0]);
    const bDateYMD = toYMD(bDate);
    
    if (bDate > lastCheckDate) {
      const lastVer = localStorage.getItem('materio_last_ver');
      if (lastVer !== latest.version) {
        // --- Intelligent Changelog Linking ---
        // Find if a 'What's New' post exists with the same date as this release
        const releasePost = updates.find(p => toYMD(p.date) === bDateYMD);
        const changelogUrl = releasePost ? releasePost.url : '/changelog';
        const coverImage = releasePost ? releasePost.image : null;
        
        sendNativeNotification(
           'Materio Updated', 
           `Materio was updated to V${latest.version}. Check the changelog for details.`, 
           changelogUrl || '/changelog',
           coverImage
        );
        localStorage.setItem('materio_last_ver', latest.version);
      }
    }
  }

  localStorage.setItem('materio_last_notif_check', now.getTime().toString());
}



/**
 * Setup tab click handlers for badge removal
 */
function setupTabClickHandlers() {
  document.querySelectorAll('.tab-link').forEach(link => {
    link.addEventListener('click', function () {
      const tab = this.getAttribute('data-tab');
      if (tab === 'notifications' && !window.devMode) {
        setCookie('lastSeenNotification', new Date().toISOString(), 7);

        const bellLink = document.querySelector('.tab-link[data-tab="notifications"]');
        const badge = bellLink?.querySelector('.notification-badge');
        if (badge) {
          badge.remove();
        }
      } else if (tab === 'notifications') {
        console.log('Dev mode active: badge remains visible');
      }
    });
  });
}

/**
 * Enable dev mode for testing notifications
 */
function enableDevMode() {
  window.devMode = true;
  console.log('Dev mode enabled for notifications. Badge removal is disabled.');
  setCookie('lastSeenNotification', '', -1);
  globalNotifications = generateFakeNotifications();
  displayNotifications(globalNotifications);
  updateNotificationBadge(globalNotifications);
}

/**
 * Generate test notifications (dev mode only)
 * @param {number} count - Number of notifications to generate
 */
function generateTestNotifications(count) {
  if (!window.devMode) {
    console.log('Activate dev mode first by typing test();');
    return;
  }
  globalNotifications = generateFakeNotifications(count);
  displayNotifications(globalNotifications);
  updateNotificationBadge(globalNotifications);
}

/**
 * Initialize notifications module
 */
async function init() {
  await setupNotificationsToggle();

  if (!window.devMode) {
    globalNotifications = await fetchNotifications();
  } else {
    globalNotifications = generateFakeNotifications();
  }

  displayNotifications(globalNotifications);
  updateNotificationBadge(globalNotifications);
  setupTabClickHandlers();

  // Check for new content for native notifications
  requestServiceWorkerContentCheck();

  // Keep polling while app is open.
  setInterval(requestServiceWorkerContentCheck, 10 * 60 * 1000);

  // Re-check when user returns or network comes back.
  window.addEventListener('focus', requestServiceWorkerContentCheck);
  window.addEventListener('online', requestServiceWorkerContentCheck);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestServiceWorkerContentCheck();
    }
  });
}


// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Expose dev mode functions to window
window.test = enableDevMode;
window.generate = generateTestNotifications;

// Export for module use
export {
  init,
  displayNotifications,
  updateNotificationBadge,
  fetchNotifications,
  enableDevMode,
  generateTestNotifications
};