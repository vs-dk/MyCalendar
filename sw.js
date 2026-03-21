/* ============================================
   MY CALENDAR — Service Worker
   Handles offline caching for PWA installability
   ============================================ */

const CACHE_NAME = 'custody-calendar-v28';
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
];

// Install — cache all assets, skip waiting to activate immediately
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate — clean old caches and take control immediately
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch — always network first, update cache, fallback to cache only if offline
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only handle same-origin requests
    if (url.origin !== self.location.origin) return;

    // Strip query string for cache key (so ?v=9 and ?v=10 hit same cache entry)
    const cacheKey = new Request(url.pathname);

    event.respondWith(
        fetch(event.request).then((response) => {
            if (response.status === 200) {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(cacheKey, clone);
                });
            }
            return response;
        }).catch(() => {
            return caches.match(cacheKey);
        })
    );
});
