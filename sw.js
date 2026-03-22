// OBR CAM PRO — Service Worker v5 | scope: /OBR-EQUIPO-ESPECIAL/

const CACHE_NAME = 'obr-cam-v5';
const BASE       = '/OBR-EQUIPO-ESPECIAL';

const PRECACHE = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/manifest.json`,
  `${BASE}/obr-logo.png`,
  `${BASE}/icons/icon-192.png`,
  `${BASE}/icons/icon-512.png`,
  `${BASE}/icons/icon-152.png`,
  `${BASE}/js/tf.min.js`,
  `${BASE}/js/pose-detection.min.js`,
  `${BASE}/js/face_mesh.js`,
  `${BASE}/js/selfie_segmentation.js`,
  'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@500;700;900&display=swap'
];

const BYPASS = ['elevenlabs.io','api.peerjs.com','googleapis.com/upload','firebaseio.com'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(PRECACHE.map(url =>
        cache.add(new Request(url, {credentials:'omit',mode:'no-cors'})).catch(()=>{})
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.protocol === 'blob:' || url.protocol === 'chrome-extension:') return;
  if (BYPASS.some(b => url.hostname.includes(b))) return;

  const isHTML = e.request.destination === 'document';

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached && !isHTML) return cached;
      return fetch(e.request, {credentials:'omit'}).then(res => {
        if (res.ok || res.type === 'opaque') {
          caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone())).catch(()=>{});
        }
        return res;
      }).catch(() => cached || (isHTML ?
        caches.match(`${BASE}/index.html`) :
        new Response('', {status:503})
      ));
    })
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
