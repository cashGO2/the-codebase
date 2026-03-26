/**
 * Materio Service Worker v4.2.0
 * 🔋 Optimized High-Precision PDF.js Asset Caching & Push Notifications
 */

const VERSION = 'v4.2.0-notif-fix';
const CORE_CACHE = 'materio-core-' + VERSION;
const PDFJS_CACHE_PREFIX = 'pdfjs-assets-';

// Essential UI / Core assets
const CORE_ASSETS = [
    '/',
    '/index.html',
    '/assets/style/main.css',
    '/assets/scripts/main.js',
    '/assets/scripts/caching.js',
    '/assets/img/icon.svg',
    '/assets/img/v4_logo.png'
];

// Explicit PDF.js Viewer assets to be pre-cached per session
const PDFJS_PRECACHE = [
    '/oread/build/pdf.mjs',
    '/oread/build/pdf.worker.mjs',
    '/oread/web/viewer.html',
    '/oread/web/viewer.mjs',
    '/oread/web/viewer.css',
    '/oread/web/intelligence.js',
    '/oread/web/themesync.css',
    '/oread/web/images/loading-icon.gif'
];

let currentSessionId = null;

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CORE_CACHE).then(cache => cache.addAll(CORE_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            caches.keys().then(keys => {
                return Promise.all(
                    keys.filter(key => key.startsWith('materio-core-') && key !== CORE_CACHE)
                        .map(key => caches.delete(key))
                );
            }),
            self.clients.claim()
        ])
    );
});

// Cache PDF.js assets for current session
async function cacheSessionAssets(sessionId) {
    if (!sessionId || currentSessionId === sessionId) return;
    currentSessionId = sessionId;
    const sessionCacheName = PDFJS_CACHE_PREFIX + sessionId;
    
    // Clear old session caches (Disposal)
    const keys = await caches.keys();
    for (const key of keys) {
        if (key.startsWith(PDFJS_CACHE_PREFIX) && key !== sessionCacheName) {
            await caches.delete(key);
        }
    }
    
    // Pre-cache primary PDF.js assets
    const cache = await caches.open(sessionCacheName);
    try {
        await cache.addAll(PDFJS_PRECACHE);
    } catch (e) {
    }
}

// --- NOTIFICATION ENGINE ---

// Handle Notification Clicks (Standard SW pattern)
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // If a tab is already open to this URL, focus it
            for (let client of windowClients) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open a new tab
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Real Push listener (ready for backend integration)
self.addEventListener('push', (event) => {
    let data = { title: 'Materio Notification', message: 'New update available!', url: '/' };
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.message = event.data.text();
        }
    }

    const options = {
        body: data.message,
        icon: '/assets/img/icon.svg',
        badge: '/assets/img/icon.svg',
        data: { url: data.url },
        vibrate: [200, 100, 200]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Intercept messages
self.addEventListener('message', (event) => {
    if (!event.data) return;
    
    if (event.data.type === 'SET_SESSION') {
        event.waitUntil(cacheSessionAssets(event.data.sessionId));
    } else if (event.data.type === 'CLEAR_SESSION_ASSETS') {
        event.waitUntil((async () => {
            const keys = await caches.keys();
            for (const key of keys) {
                if (key.startsWith(PDFJS_CACHE_PREFIX)) await caches.delete(key);
            }
        })());
    } else if (event.data.type === 'SHOW_NOTIFICATION') {
        const { title, message, url, icon, image } = event.data;
        event.waitUntil(
            self.registration.showNotification(title, {
                body: message,
                icon: icon || '/assets/img/icon.svg',
                badge: '/assets/img/icon.svg',
                image: image || null, // For large cover images
                vibrate: [200, 100, 200],
                data: { url: url }
            })
        );
    }

});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const path = url.pathname;

    const isOreadAsset = path.startsWith('/oread/') && !path.endsWith('.pdf');
    const isCoreAsset = CORE_ASSETS.includes(path);

    if (isOreadAsset || isCoreAsset) {
        event.respondWith(
            (async () => {
                if (isOreadAsset && currentSessionId) {
                    const sessionCache = await caches.open(PDFJS_CACHE_PREFIX + currentSessionId);
                    const cachedResponse = await sessionCache.match(event.request);
                    if (cachedResponse) return cachedResponse;
                    
                    const networkResponse = await fetch(event.request);
                    if (networkResponse.ok) {
                        sessionCache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }
                
                const coreCache = await caches.open(CORE_CACHE);
                const coreCached = await coreCache.match(event.request);
                if (coreCached) return coreCached;
                
                return fetch(event.request);
            })()
        );
        return;
    }

    event.respondWith(
        fetch(event.request).catch(() => {
            if (url.origin === self.location.origin) {
                return caches.match(event.request);
            }
        })
    );
});
