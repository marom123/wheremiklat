// Service Worker for WhereMiklat PWA
// Handles caching, offline functionality, and background sync

const CACHE_VERSION = Date.now(); // Force cache invalidation
const CACHE_NAME = `wheremiklat-v${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `wheremiklat-dynamic-v${CACHE_VERSION}`;
const API_CACHE_NAME = `wheremiklat-api-v${CACHE_VERSION}`;

// Resources to cache immediately (app shell)
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;900&family=Bebas+Neue&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.0/proj4.js'
];

// API endpoints and patterns
const API_PATTERNS = [
  /govmap\.gov\.il\/api/
];

// Cache duration in milliseconds
const CACHE_DURATION = {
  STATIC: 7 * 24 * 60 * 60 * 1000,      // 1 week
  DYNAMIC: 24 * 60 * 60 * 1000,         // 1 day
  API: 60 * 60 * 1000,                  // 1 hour
  FONTS: 30 * 24 * 60 * 60 * 1000       // 30 days
};

// Install event - cache static resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static resources');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        return self.skipWaiting(); // Force activation
      })
      .catch((error) => {
        console.error('Cache installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Delete old versions of caches
              return cacheName.startsWith('wheremiklat-') &&
                     cacheName !== CACHE_NAME &&
                     cacheName !== DYNAMIC_CACHE_NAME &&
                     cacheName !== API_CACHE_NAME;
            })
            .map((cacheName) => {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        return self.clients.claim(); // Take control of all clients
      })
  );
});

// Fetch event - handle all network requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle different types of requests with appropriate strategies
  if (isStaticResource(request)) {
    // Static resources: Cache First
    event.respondWith(cacheFirst(request));
  } else if (isAPIRequest(request)) {
    // API requests: Network First with cache fallback
    event.respondWith(networkFirstAPI(request));
  } else if (isFontRequest(request)) {
    // Fonts: Stale While Revalidate with long cache
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE_NAME));
  } else if (isNavigationRequest(request)) {
    // Navigation: Network First with app shell fallback
    event.respondWith(navigationHandler(request));
  } else {
    // Other resources: Stale While Revalidate
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE_NAME));
  }
});

// Background sync for failed API requests
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);

  if (event.tag === 'shelter-search') {
    event.waitUntil(retryFailedRequests());
  }
});

// Push notifications (future feature)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();

    const options = {
      body: data.body || 'התראת חירום חדשה',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: 'emergency-alert',
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: {
        url: data.url || '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'WhereMiklat', options)
    );
  }
});

// Helper functions

function isStaticResource(request) {
  const url = new URL(request.url);
  return STATIC_CACHE_URLS.some(staticUrl =>
    staticUrl === url.pathname ||
    staticUrl === request.url ||
    staticUrl === url.pathname + url.search
  );
}

function isAPIRequest(request) {
  return API_PATTERNS.some(pattern => pattern.test(request.url));
}

function isFontRequest(request) {
  return request.url.includes('fonts.googleapis.com') ||
         request.url.includes('fonts.gstatic.com') ||
         request.destination === 'font';
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

// Caching strategies

async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);

    if (cachedResponse && !isExpired(cachedResponse, CACHE_DURATION.STATIC)) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('Cache first strategy failed:', error);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    throw error;
  }
}

async function networkFirstAPI(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok && request.method === 'GET') {
      // Only cache GET requests - POST requests can't be cached
      const cache = await caches.open(API_CACHE_NAME);
      const responseToCache = networkResponse.clone();

      // Add timestamp for expiration
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-timestamp', Date.now().toString());

      const modifiedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      });

      cache.put(request, modifiedResponse);
    }

    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache for API request:', error);

    // Try to serve from cache
    const cachedResponse = await caches.match(request);

    if (cachedResponse && !isExpired(cachedResponse, CACHE_DURATION.API)) {
      // Add offline indicator to response
      const headers = new Headers(cachedResponse.headers);
      headers.set('x-served-by', 'sw-cache');

      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: headers
      });
    }

    // Register background sync for retry
    if ('serviceWorker' in self && 'sync' in window.ServiceWorkerRegistration.prototype) {
      await self.registration.sync.register('shelter-search');
    }

    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName = DYNAMIC_CACHE_NAME) {
  const cachedResponse = await caches.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        const cache = caches.open(cacheName);
        cache.then(c => c.put(request, networkResponse.clone()));
      }
      return networkResponse;
    })
    .catch(() => cachedResponse); // Fallback to cache on network error

  // Return cached version immediately if available, otherwise wait for network
  return cachedResponse || fetchPromise;
}

async function navigationHandler(request) {
  try {
    // Try network first for navigation requests
    return await fetch(request);
  } catch (error) {
    // Fallback to cached app shell
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match('/') || await cache.match('/index.html');

    if (cachedResponse) {
      return cachedResponse;
    }

    // Ultimate fallback - offline page
    return new Response(`
      <!DOCTYPE html>
      <html lang="he" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>WhereMiklat - אין חיבור</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #0a0a0a;
            color: #fff;
            text-align: center;
            padding: 2rem;
            direction: rtl;
          }
          .offline-message {
            max-width: 400px;
            margin: 0 auto;
          }
          .retry-btn {
            background: #ff3b30;
            color: white;
            border: none;
            padding: 1rem 2rem;
            border-radius: 8px;
            font-size: 1rem;
            margin-top: 1rem;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div class="offline-message">
          <h1>אין חיבור לאינטרנט</h1>
          <p>אנא בדק את החיבור לאינטרנט ונסה שוב</p>
          <button class="retry-btn" onclick="location.reload()">נסה שוב</button>
        </div>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

// Utility functions

function isExpired(response, maxAge) {
  const timestamp = response.headers.get('sw-cache-timestamp');
  if (!timestamp) return false;

  const age = Date.now() - parseInt(timestamp);
  return age > maxAge;
}

async function retryFailedRequests() {
  console.log('Retrying failed shelter search requests...');

  // Get failed requests from IndexedDB (future enhancement)
  // For now, just log the retry attempt

  try {
    // Attempt to notify clients that background sync occurred
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC_SUCCESS',
        tag: 'shelter-search'
      });
    });
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Cache management and cleanup
async function cleanupExpiredCache() {
  const cacheNames = [CACHE_NAME, DYNAMIC_CACHE_NAME, API_CACHE_NAME];

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();

    for (const request of requests) {
      const response = await cache.match(request);

      let maxAge;
      if (cacheName === API_CACHE_NAME) {
        maxAge = CACHE_DURATION.API;
      } else if (cacheName === DYNAMIC_CACHE_NAME) {
        maxAge = CACHE_DURATION.DYNAMIC;
      } else {
        maxAge = CACHE_DURATION.STATIC;
      }

      if (response && isExpired(response, maxAge)) {
        console.log('Removing expired cache entry:', request.url);
        await cache.delete(request);
      }
    }
  }
}

// Periodic cache cleanup (runs every hour when SW is active)
setInterval(cleanupExpiredCache, 60 * 60 * 1000);

// Message handling from main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_URLS':
      // Cache additional URLs on demand
      if (data && data.urls) {
        caches.open(DYNAMIC_CACHE_NAME)
          .then(cache => cache.addAll(data.urls))
          .then(() => {
            event.ports[0].postMessage({ success: true });
          })
          .catch(error => {
            event.ports[0].postMessage({ success: false, error: error.message });
          });
      }
      break;

    case 'CLEAR_CACHE':
      // Clear specific cache on demand
      if (data && data.cacheName) {
        caches.delete(data.cacheName)
          .then(() => {
            event.ports[0].postMessage({ success: true });
          });
      }
      break;

    default:
      console.log('Unknown message type:', type);
  }
});

console.log('WhereMiklat Service Worker loaded successfully');