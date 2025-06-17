// Service Worker for Materio PWA
// Version: 2.0.0 - Online-First Strategy
// Skip caching on localhost
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', () => self.clients.claim());
  self.addEventListener('fetch', (event) => {
    // Pass through all requests without caching
    event.respondWith(fetch(event.request));
  });
  return;
}

const CACHE_NAME = 'materio-v2-0';
const STATIC_CACHE = 'materio-static-v2-0';
const DYNAMIC_CACHE = 'materio-dynamic-v2-0';
const API_CACHE = 'materio-api-v2-0';

// Essential files that need to be cached for offline functionality
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  
  // CSS Files - Cache all for offline UI
  '/assets/style/main.css',
  '/assets/style/notification.css',
  '/assets/style/gestures.css',
  
  // JavaScript Files - Cache all for offline functionality
  '/assets/scripts/main.js',
  '/assets/scripts/caching.js',
  '/assets/scripts/notify.js',
  '/assets/scripts/releases.js',
  '/assets/scripts/theme.js',
  '/assets/scripts/advanced.js',
  '/assets/scripts/profile-image.js',
  '/assets/scripts/ga.js',
  '/assets/scripts/gestures.js',
  '/assets/scripts/pwa.js',
  
  // Images and Icons
  '/assets/img/materio_new_bk.svg',
  '/assets/img/materio_new_wh.svg',
  '/assets/img/default-avatar.svg',
  
  // Account pages - Cache for offline access
  '/account/index.html',
  '/account/profile.html',
  '/account/files.html',
  '/account/signup.html',
  
  // Essential data files - Cache last known versions for offline
  '/assets/data/releases.json',
  '/assets/data/events.json',
  
  // Account CSS for full offline experience
  '/account/css/styles.css',
  '/account/css/redesigned-styles.css',
  
  // Account JS for offline functionality
  '/account/js/auth.js',
  '/account/js/profile.js',
  '/account/js/google-drive.js'
];

// Files that should NEVER be served from cache when online (always fresh)
const ALWAYS_FRESH_PATTERNS = [
  /^\/assets\/data\//,           // All data files
  /^\/channels\//,               // All channel content
  /^\/databases\//,              // All database files
  /^\/manifest\.json/,           // PWA manifest
  /^\/api\//,                    // All API calls
  /\.html$/,                     // All HTML pages (for feature updates)
  /\.css$/,                      // All CSS (for UI updates)
  /\.js$/                        // All JavaScript (for feature updates)
];

// Only these file types can be served from cache when online (mostly static assets)
const CACHE_ALLOWED_WHEN_ONLINE = [
  /\.(?:png|jpg|jpeg|gif|webp|ico)$/,  // Images only
  /\.(?:woff|woff2|ttf|eot)$/,         // Fonts only
  /\.(?:svg)$/ // SVG icons (but not if they're in /assets/img/ for consistency)
];

// Install event - cache static assets
self.addEventListener('install', event => {
//   console.log('[SW] Installing service worker...');
  event.waitUntil(
    (async () => {
      try {
        const staticCache = await caches.open(STATIC_CACHE);
        const dynamicCache = await caches.open(DYNAMIC_CACHE);
        
        // console.log('[SW] Caching static assets...');
        
        // Cache essential files one by one to handle errors gracefully
        const cachePromises = STATIC_ASSETS.map(async (url) => {
          try {
            await staticCache.add(url);
            // console.log(`[SW] Cached: ${url}`);
          } catch (error) {
            console.warn(`[SW] Failed to cache: ${url}`, error);
          }
        });
        
        await Promise.allSettled(cachePromises);
        
        // Pre-cache some dynamic content for better offline experience
        const dynamicUrls = [
          '/assets/data/releases.json',
          '/assets/data/events.json'
        ];
        
        const dynamicPromises = dynamicUrls.map(async (url) => {
          try {
            const response = await fetch(url);
            if (response.ok) {
              await dynamicCache.put(url, response);
              // console.log(`[SW] Pre-cached dynamic: ${url}`);
            }
          } catch (error) {
            console.warn(`[SW] Failed to pre-cache dynamic: ${url}`, error);
          }
        });
        
        await Promise.allSettled(dynamicPromises);
        // console.log('[SW] Installation complete - site ready for offline use');
        
        // Skip waiting to activate immediately
        self.skipWaiting();
      } catch (error) {
        console.error('[SW] Installation failed:', error);
      }
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
//   console.log('[SW] Activating service worker...');
  event.waitUntil(
    (async () => {
      try {
        // Take control of all pages immediately
        await self.clients.claim();
        
        // Clean up old caches
        const cacheNames = await caches.keys();
        const deleteCachePromises = cacheNames
          .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== API_CACHE)
          .map(name => {
            // console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          });
        
        await Promise.all(deleteCachePromises);
        // console.log('[SW] Service worker activated');
      } catch (error) {
        console.error('[SW] Activation failed:', error);
      }
    })()
  );
});

// Fetch event - handle all network requests
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  event.respondWith(handleFetch(request));
});

// Main fetch handler - ONLINE FIRST STRATEGY
async function handleFetch(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  try {
    // Special handling for blob cache requests
    if (url.searchParams.has('blob-cache-key')) {
      return await handleBlobCacheRequest(request);
    }
    
    // Check if user is online
    const isOnline = navigator.onLine;
    
    if (isOnline) {
      // ONLINE: Always fetch fresh content, but cache it for offline use
      return await onlineFetchAndCache(request);
    } else {
      // OFFLINE: Use cache-first strategy
      return await offlineCacheFirst(request);
    }
    
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    return await handleOfflineFallback(request);
  }
}

// Online strategy: Always fetch fresh, cache in background
async function onlineFetchAndCache(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  try {
    // Always fetch fresh content when online
    const networkResponse = await fetch(request, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (networkResponse.ok) {
      // Cache the response for offline use
      const responseToCache = networkResponse.clone();
      
      // Determine which cache to use
      let cache;
      if (STATIC_ASSETS.includes(pathname) || 
          pathname.startsWith('/assets/') || 
          pathname.startsWith('/account/')) {
        cache = await caches.open(STATIC_CACHE);
      } else if (pathname.startsWith('/api/')) {
        cache = await caches.open(API_CACHE);
      } else {
        cache = await caches.open(DYNAMIC_CACHE);
      }
      
      // Cache asynchronously (don't block the response)
      cache.put(request, responseToCache).catch(err => {
        console.warn('[SW] Failed to cache:', request.url, err);
      });
    }
    
    return networkResponse;
  } catch (error) {
    console.warn('[SW] Network failed while online, falling back to cache:', request.url);
    // If network fails even when online, fall back to cache
    return await offlineCacheFirst(request);
  }
}

// Offline strategy: Cache-first with comprehensive fallback
async function offlineCacheFirst(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  try {
    // Try static cache first
    const staticCache = await caches.open(STATIC_CACHE);
    let cachedResponse = await staticCache.match(request);
    
    if (cachedResponse) {
      console.log('[SW] Serving from static cache (offline):', request.url);
      return cachedResponse;
    }
    
    // Try API cache
    const apiCache = await caches.open(API_CACHE);
    cachedResponse = await apiCache.match(request);
    
    if (cachedResponse) {
      console.log('[SW] Serving from API cache (offline):', request.url);
      return cachedResponse;
    }
    
    // Try dynamic cache
    const dynamicCache = await caches.open(DYNAMIC_CACHE);
    cachedResponse = await dynamicCache.match(request);
    
    if (cachedResponse) {
      console.log('[SW] Serving from dynamic cache (offline):', request.url);
      return cachedResponse;
    }
    
    // No cache available
    throw new Error('No cached version available');
    
  } catch (error) {
    console.error('[SW] Cache lookup failed:', error);
    return await handleOfflineFallback(request);
  }
}

// Offline fallback handler
async function handleOfflineFallback(request) {
  const url = new URL(request.url);
  
  // For HTML requests, try to serve the requested page from cache, then fallback to main page
  if (request.headers.get('accept')?.includes('text/html')) {
    const cache = await caches.open(STATIC_CACHE);
    
    // First try to serve the exact requested page
    let cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving cached page (offline):', request.url);
      return cachedResponse;
    }
    
    // If that fails, try common variations
    const possiblePages = [
      url.pathname,
      url.pathname + 'index.html',
      url.pathname.replace(/\/$/, '') + '.html',
      '/',
      '/index.html'
    ];
    
    for (const page of possiblePages) {
      cachedResponse = await cache.match(page);
      if (cachedResponse) {
        console.log('[SW] Serving fallback page (offline):', page);
        return cachedResponse;
      }
    }
  }
  
  // For CSS/JS/image requests, try to serve from cache
  if (url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|eot)$/)) {
    const caches = [STATIC_CACHE, DYNAMIC_CACHE];
    for (const cacheName of caches) {
      const cache = await caches.open(cacheName);
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        console.log('[SW] Serving cached asset (offline):', request.url);
        return cachedResponse;
      }
    }
  }
  
  // For API requests, return a proper offline response
  if (url.pathname.startsWith('/api/')) {
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'This feature requires an internet connection',
        offline: true,
        status: 'offline_mode',
        retryAfter: 'Please check your connection and try again'
      }),
      {
        status: 503,
        statusText: 'Service Unavailable (Offline)',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      }
    );
  }
  
  // For data files, try to serve last cached version
  if (url.pathname.startsWith('/assets/data/') || url.pathname.startsWith('/channels/')) {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving cached data (offline):', request.url);
      return cachedResponse;
    }
  }
  
  // Final fallback - return a simple offline message only for unhandled requests
  return new Response(
    `<!DOCTYPE html>
    <html>
    <head>
      <title>Offline - Materio</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5;">
      <h2>🌐 You're Offline</h2>
      <p>This content isn't available offline.</p>
      <p>Please check your internet connection and try again.</p>
      <button onclick="window.location.reload()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Try Again
      </button>
    </body>
    </html>`,
    { 
      status: 503,
      statusText: 'Service Unavailable (Offline)',
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache'
      }
    }
  );
}

// Blob cache storage for PDF optimization
const blobCacheMap = new Map();

// Handle blob cache requests
async function handleBlobCacheRequest(request) {
  const url = new URL(request.url);
  const cacheKey = url.searchParams.get('blob-cache-key');
  
  if (blobCacheMap.has(cacheKey)) {
    const cachedBlob = blobCacheMap.get(cacheKey);
    return new Response(cachedBlob.data, {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': cachedBlob.size.toString(),
        'Cache-Control': 'public, max-age=31536000',
        'Accept-Ranges': 'bytes'
      }
    });
  }
  
  // If not in cache, return 404
  return new Response('Not Found', { status: 404 });
}

// Store blob in cache
function storeBlobInCache(key, arrayBuffer, size) {
  blobCacheMap.set(key, {
    data: arrayBuffer,
    size: size,
    timestamp: Date.now()
  });
  
  // Clean up old entries (keep max 10 cached PDFs)
  if (blobCacheMap.size > 10) {
    const entries = Array.from(blobCacheMap.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const oldestKey = entries[0][0];
    blobCacheMap.delete(oldestKey);
  }
}

// Message handling for manual cache updates
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_UPDATE') {
    event.waitUntil(updateCache(event.data.urls));
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(clearAllCaches());
  }
  
  if (event.data && event.data.type === 'REFRESH_VERSION_DATA') {
    event.waitUntil(refreshVersionCriticalFiles());
  }
  
  if (event.data && event.data.type === 'STORE_BLOB_CACHE') {
    const { key, arrayBuffer, size } = event.data;
    storeBlobInCache(key, arrayBuffer, size);
    // Send confirmation back
    event.ports[0]?.postMessage({ success: true });
  }
    if (event.data && event.data.type === 'GET_BLOB_CACHE') {
    const { key } = event.data;
    const cached = blobCacheMap.get(key);
    event.ports[0]?.postMessage({ 
      success: !!cached,
      data: cached || null 
    });
  }
  
  if (event.data && event.data.type === 'CLEAR_BLOB_CACHE') {
    blobCacheMap.clear();
    event.ports[0]?.postMessage({ success: true });
  }
});

// Refresh critical files (now just clears cache since we're online-first)
async function refreshVersionCriticalFiles() {
  try {
    console.log('[SW] Refreshing caches for online-first strategy...');
    
    // Clear old cached versions to ensure fresh content
    const cacheNames = await caches.keys();
    const clearPromises = cacheNames.map(async (name) => {
      if (name.includes('materio-api') || name.includes('materio-dynamic')) {
        console.log('[SW] Clearing cache:', name);
        return caches.delete(name);
      }
    });
    
    await Promise.allSettled(clearPromises);
    
    // Re-create fresh caches
    await caches.open(API_CACHE);
    await caches.open(DYNAMIC_CACHE);
    
    console.log('[SW] Cache refresh complete - all content will be fresh on next request');
  } catch (error) {
    console.error('[SW] Cache refresh failed:', error);
  }
}

// Manually update cache
async function updateCache(urls = []) {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachePromises = urls.map(url => 
      fetch(url).then(response => {
        if (response.ok) {
          cache.put(url, response.clone());
        }
      }).catch(error => {
        console.warn(`[SW] Failed to update cache for: ${url}`, error);
      })
    );
    await Promise.allSettled(cachePromises);
    // console.log('[SW] Cache updated');
  } catch (error) {
    console.error('[SW] Cache update failed:', error);
  }
}

// Clear all caches
async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    const deletePromises = cacheNames.map(name => caches.delete(name));
    await Promise.all(deletePromises);
    // console.log('[SW] All caches cleared');
  } catch (error) {
    console.error('[SW] Cache clearing failed:', error);
  }
}

// Background sync for when connectivity is restored
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  try {
    // Retry failed requests or sync data when back online
    // console.log('[SW] Background sync triggered');
    
    // You can implement specific sync logic here
    // For example, sync user data, upload pending files, etc.
    
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Push notification handling
self.addEventListener('push', event => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/assets/img/icon.svg',
    badge: '/assets/img/icon.svg',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: data.id || 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open',
        icon: '/assets/img/icon.svg'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/assets/img/icon.svg'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Materio', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  event.waitUntil(
    clients.openWindow('/')
  );
});

// console.log('[SW] Service worker script loaded');
