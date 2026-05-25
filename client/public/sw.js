const CACHE_VERSION = 'v1';
const STATIC_CACHE = `alain-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `alain-dynamic-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

const OFFLINE_PAGE = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(STATIC_ASSETS);
      
      try {
        const response = await fetch('/');
        if (response.ok) {
          const text = await response.text();
          const scriptMatches = text.match(/src="(\/assets\/[^"]+\.js)"/g) || [];
          const cssMatches = text.match(/href="(\/assets\/[^"]+\.css)"/g) || [];
          
          const assetUrls = [
            ...scriptMatches.map(m => m.match(/src="([^"]+)"/)?.[1]).filter(Boolean),
            ...cssMatches.map(m => m.match(/href="([^"]+)"/)?.[1]).filter(Boolean)
          ];
          
          for (const url of assetUrls) {
            try {
              await cache.add(url);
            } catch (e) {
              console.log('Failed to cache:', url);
            }
          }
        }
      } catch (e) {
        console.log('Could not fetch app shell assets');
      }
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.origin === location.origin) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

const API_FETCH_TIMEOUT_MS = 20000;

async function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function networkFirst(request) {
  const isApi = new URL(request.url).pathname.startsWith('/api/');
  const timeoutMs = isApi ? API_FETCH_TIMEOUT_MS : 15000;
  try {
    const networkResponse = await fetchWithTimeout(request, timeoutMs);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cachedResponse);
  
  return cachedResponse || fetchPromise;
}

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'العين لتجارة الحاسبات';
  const options = {
    body: data.body || 'لديك إشعار جديد',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [100, 50, 100],
    data: data.url || '/',
    actions: [
      { action: 'open', title: 'فتح' },
      { action: 'close', title: 'إغلاق' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});
