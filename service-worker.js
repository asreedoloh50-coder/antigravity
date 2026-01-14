const CACHE_NAME = 'check-the-work-v999-RESET';

// Install event - immediately skip waiting
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Activate event - claim clients and clear ALL old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    console.log('Deleting cache:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// Fetch event - always go to network, never cache
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request).catch(() => {
            return new Response('Offline - forcing reload');
        })
    );
});
