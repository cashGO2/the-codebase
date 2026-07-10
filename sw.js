/**
 * Materio Service Worker v4.2.0
 * 🔋 Optimized High-Precision PDF.js Asset Caching & Push Notifications
 */

const VERSION = 'v4.2.5-network-home';
const CORE_CACHE = 'materio-core-' + VERSION;
const PDFJS_CACHE_PREFIX = 'pdfjs-assets-';
const META_CACHE = 'materio-meta-' + VERSION;
const META_STATE_KEY = '/__sw_meta/content-state';

const CONTENT_CHECK_TAG = 'materio-content-check';
const NOTIFY_SOURCES = {
    system: '/api/v2/features?action=notifications-feed&num=6',
    insight: 'https://room.getmaterio.app/api/posts?num=6',
    updates: '/assets/data/posts.json',
    releases: '/assets/data/releases.json'
};

// Essential UI / Core assets
const CORE_ASSETS = [
    '/assets/style/main.css',
    '/assets/scripts/main.js',
    '/assets/scripts/caching.js',
    '/assets/img/icon.svg',
    '/assets/img/v4_logo.png',
    '/assets/img/internet.webp',
    '/favicon.ico'
];

// Explicit PDF.js Viewer assets to be pre-cached per session
const PDFJS_PRECACHE = [
    '/oread/build/pdf.mjs',
    '/oread/build/pdf.worker.mjs',
    '/oread/web/viewer.html',
    '/oread/web/viewer.mjs',
    '/oread/web/viewer.css',
    '/oread/web/intelligence.js',
    '/oread/web/thinklet.js',
    '/oread/web/themesync.css',
    '/oread/web/images/loading-icon.gif'
];

let currentSessionId = null;

function getDefaultMetaState() {
    return {
        notificationsEnabled: true,
        lastCheckTs: 0,
        lastVersion: null,
        seen: {
            system: {},
            insight: {},
            updates: {}
        }
    };
}

async function readMetaState() {
    const cache = await caches.open(META_CACHE);
    const res = await cache.match(META_STATE_KEY);
    if (!res) {
        return getDefaultMetaState();
    }

    try {
        const parsed = await res.json();
        const defaults = getDefaultMetaState();
        return {
            ...defaults,
            ...parsed,
            seen: {
                ...defaults.seen,
                ...(parsed?.seen || {})
            }
        };
    } catch (e) {
        return getDefaultMetaState();
    }
}

async function writeMetaState(state) {
    const cache = await caches.open(META_CACHE);
    await cache.put(
        META_STATE_KEY,
        new Response(JSON.stringify(state), {
            headers: { 'Content-Type': 'application/json' }
        })
    );
}

function toDate(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function getItemId(item, fallbackPrefix) {
    return String(
        item?.id ||
        item?._id ||
        item?.slug ||
        item?.url ||
        item?.link ||
        item?.title ||
        `${fallbackPrefix}-${item?.date || Date.now()}`
    );
}

async function fetchJson(url) {
    const sep = url.includes('?') ? '&' : '?';
    try {
        const response = await fetch(`${url}${sep}t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return [];
        const payload = await response.json();
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.notifications)) return payload.notifications;
        return [];
    } catch (e) {
        return [];
    }
}

async function showBackgroundNotification(title, body, url, image = null) {
    await self.registration.showNotification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        image,
        data: { url: url || '/' },
        vibrate: [200, 100, 200]
    });
}

async function checkForNewContent() {
    const state = await readMetaState();
    if (state.notificationsEnabled === false) {
        return;
    }

    // Set last check threshold to start of today on first run to avoid notification spamming
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const lastCheckDate = state.lastCheckTs ? new Date(state.lastCheckTs) : startOfToday;

    const [systemNotifs, resources, updates, releases] = await Promise.all([
        fetchJson(NOTIFY_SOURCES.system),
        fetchJson(NOTIFY_SOURCES.insight),
        fetchJson(NOTIFY_SOURCES.updates),
        fetchJson(NOTIFY_SOURCES.releases)
    ]);

    if (Array.isArray(systemNotifs)) {
        for (const n of systemNotifs) {
            const date = toDate(n?.date);
            const id = getItemId(n, 'sys');
            if (date && date > lastCheckDate && !state.seen.system[id]) {
                await showBackgroundNotification('New Resource Added', n?.title || 'New content available', n?.links?.[0]?.url || '/');
                state.seen.system[id] = true;
            }
        }
    }

    if (Array.isArray(resources)) {
        for (const p of resources) {
            const date = toDate(p?.date);
            const id = getItemId(p, 'insight');
            if (date && date > lastCheckDate && !state.seen.insight[id]) {
                const excerpt = typeof p?.excerpt === 'string' ? p.excerpt : '';
                const body = excerpt ? (excerpt.length > 100 ? `${excerpt.slice(0, 97)}...` : excerpt) : (p?.title || 'New post');
                await showBackgroundNotification('New Resource', body, p?.link || '/', p?.imgUrl || null);
                state.seen.insight[id] = true;
            }
        }
    }

    if (Array.isArray(updates)) {
        for (const p of updates) {
            const date = toDate(p?.date);
            const id = getItemId(p, 'updates');
            if (date && date > lastCheckDate && !state.seen.updates[id]) {
                const excerpt = typeof p?.excerpt === 'string' ? p.excerpt : '';
                const body = excerpt ? (excerpt.length > 100 ? `${excerpt.slice(0, 97)}...` : excerpt) : (p?.title || 'New update');
                await showBackgroundNotification('New Update', body, p?.url || '/', p?.image || null);
                state.seen.updates[id] = true;
            }
        }
    }

    if (Array.isArray(releases) && releases.length > 0) {
        const latest = releases[0];
        if (latest?.version && state.lastVersion !== latest.version) {
            await showBackgroundNotification(
                'Materio Updated',
                `Materio was updated to V${latest.version}. Check the changelog for details.`,
                '/changelog'
            );
            state.lastVersion = latest.version;
        }
    }

    state.lastCheckTs = Date.now();
    await writeMetaState(state);
}

async function registerBackgroundChecks() {
    if ('periodicSync' in self.registration) {
        try {
            await self.registration.periodicSync.register(CONTENT_CHECK_TAG, {
                minInterval: 6 * 60 * 60 * 1000
            });
        } catch (e) {
        }
    }
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CORE_CACHE);
            await Promise.allSettled(
                CORE_ASSETS.map(async (asset) => {
                    try {
                        await cache.add(asset);
                    } catch (e) {
                    }
                })
            );
        })()
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
            registerBackgroundChecks(),
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
    event.waitUntil((async () => {
        const state = await readMetaState();
        if (state.notificationsEnabled === false) {
            return;
        }

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
            icon: data.icon || '/favicon.ico',
            badge: '/favicon.ico',
            image: data.image || data.coverImage || data.imgUrl || null,
            data: { url: data.url },
            vibrate: [200, 100, 200]
        };

        await self.registration.showNotification(data.title, options);
    })());
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
                icon: icon || '/favicon.ico',
                badge: '/favicon.ico',
                image: image || null, // For large cover images
                vibrate: [200, 100, 200],
                data: { url: url }
            })
        );
    } else if (event.data.type === 'CHECK_NEW_CONTENT') {
        event.waitUntil(checkForNewContent());
    } else if (event.data.type === 'SET_NOTIFICATIONS_ENABLED') {
        event.waitUntil((async () => {
            const state = await readMetaState();
            state.notificationsEnabled = !!event.data.enabled;
            await writeMetaState(state);
        })());
    }

});

self.addEventListener('sync', (event) => {
    if (event.tag === CONTENT_CHECK_TAG) {
        event.waitUntil(checkForNewContent());
    }
});

self.addEventListener('periodicsync', (event) => {
    if (event.tag === CONTENT_CHECK_TAG) {
        event.waitUntil(checkForNewContent());
    }
});

// Helper to cleanse redirected responses to prevent "a redirected response was used for a request whose redirect mode is not 'follow'"
function cleanRedirectedResponse(response) {
    if (!response || !response.redirected) {
        return response;
    }
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
    });
}

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const path = url.pathname;

    // Bypass analytics/telemetry endpoints and non-GET requests so they
    // are forwarded directly to the network (avoids accidental caching
    // or HTML/offline fallbacks breaking analytics uploads).
    const analyticsPaths = [
        '/api/analytics',
        '/analytics',
        '/collect',
        '/gtag/js'
    ];

    const isAnalytics = analyticsPaths.some(p => path.startsWith(p) || url.href.includes(p) || url.hostname.includes('google-analytics') || url.hostname.includes('analytics'));

    if (event.request.method !== 'GET' || isAnalytics) {
        event.respondWith(
            fetch(event.request).catch((err) => {
                if (url.origin === self.location.origin) {
                    return caches.match(event.request).then(cached => {
                        if (cached) return cleanRedirectedResponse(cached);
                        throw err;
                    });
                }
                throw err;
            })
        );
        return;
    }

    const isOreadAsset = path.startsWith('/oread/') && !path.endsWith('.pdf');
    const isCoreAsset = CORE_ASSETS.includes(path);

    if (isOreadAsset || isCoreAsset) {
        event.respondWith(
            (async () => {
                if (isOreadAsset && currentSessionId) {
                    const sessionCache = await caches.open(PDFJS_CACHE_PREFIX + currentSessionId);
                    const cachedResponse = await sessionCache.match(event.request);
                    if (cachedResponse) return cleanRedirectedResponse(cachedResponse);
                    
                    const networkResponse = await fetch(event.request);
                    if (networkResponse.ok) {
                        sessionCache.put(event.request, networkResponse.clone());
                    }
                    return cleanRedirectedResponse(networkResponse);
                }
                
                const coreCache = await caches.open(CORE_CACHE);
                const coreCached = await coreCache.match(event.request);
                if (coreCached) return cleanRedirectedResponse(coreCached);
                
                const netRes = await fetch(event.request);
                return cleanRedirectedResponse(netRes);
            })()
        );
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(res => cleanRedirectedResponse(res))
            .catch((err) => {
                if (url.origin === self.location.origin) {
                    return caches.match(event.request).then(cached => {
                        if (cached) return cleanRedirectedResponse(cached);
                        throw err;
                    });
                }
                throw err;
            })
    );
});
