const CACHE_NAME = 'obr-pro-cache-v1';

// Estos archivos se guardarán en el "disco duro" del celular la primera vez que entres
const ASSETS_TO_CACHE = [
  './',
  './camara.html',
  './obr-logo.png',
  './manifest.json'
];

// 1. INSTALACIÓN: Descarga y guarda los archivos silenciosamente
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[OBR Service Worker] Blindando recursos en Caché Local');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// 2. ACTIVACIÓN: Limpia versiones viejas si llegas a actualizar el código en Github
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[OBR Service Worker] Purgando caché obsoleta');
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. INTERCEPTOR (MAGIA ANTI-BLOQUEO): 
// Cuando el celular pide "camara.html", se lo damos desde la caché en 1 milisegundo,
// saltándonos las restricciones de datos móviles de Telcel/AT&T.
self.addEventListener('fetch', event => {
  // Ignoramos peticiones a la IA, WebRTC o a otros servidores
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Intentamos actualizar la página en segundo plano si hay buen Internet
      const networkFetch = fetch(event.request).then(response => {
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, response.clone());
        });
        return response;
      }).catch(() => {
        console.log('[OBR Service Worker] Offline o bloqueado. Usando caché segura.');
      });

      // ¡Entregamos la caché inmediatamente si existe!
      return cachedResponse || networkFetch;
    })
  );
});
