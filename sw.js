// ============================================================
// OBR CAM PRO — Service Worker v4
// Scope: /OBR-EQUIPO-ESPECIAL/
// Estrategia: Cache-First estáticos + Network-First HTML
// ============================================================

const CACHE_NAME   = 'obr-cam-v4';
const BASE         = '/OBR-EQUIPO-ESPECIAL';

// Recursos estáticos que se pre-cachean al instalar
const PRECACHE = [
  `${BASE}/camara.html`,
  `${BASE}/manifest.json`,
  `${BASE}/icons/icon-192.png`,
  `${BASE}/icons/icon-512.png`,
  // ← AGREGAR ESTOS
  `${BASE}/INTRO_1.mp4`,
  `${BASE}/FIN_DIRECTO.mp4`,
  `${BASE}/BANNER_1.mp4`,
  `${BASE}/obr-logo.png`, 
  // JS locales (si existen en el repo)
  `${BASE}/js/tf.min.js`,
  `${BASE}/js/pose-detection.min.js`,
  `${BASE}/js/face_mesh.js`,
  `${BASE}/js/selfie_segmentation.js`,
  // Assets locales
  `${BASE}/obr-logo.png`,
  // CDN críticos
  'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@500;700;900&display=swap',
  'https://fonts.gstatic.com/s/sharetechmono/v15/J7aHnp1uDWRBEqV98dVQztYldFcLowEFA87Heg.woff2',
  'https://fonts.gstatic.com/s/orbitron/v29/yMJRMIlzdpvBhQQL_Qq7dys.woff2'
];

// Dominios que NUNCA se interceptan (APIs dinámicas, cámara, WebRTC)
const BYPASS_HOSTS = [
  'elevenlabs.io',
  'api.elevenlabs.io',
  'api.peerjs.com',
  'metered.ca',       // STUN/TURN servers
  'googleapis.com',   // Auth y uploads
  'firebaseio.com'
];

// ── INSTALL: pre-cachear recursos críticos ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // allSettled: si un recurso falla (sin conexión), no bloquea la instalación
        return Promise.allSettled(
          PRECACHE.map(url =>
            cache.add(new Request(url, { credentials: 'omit', mode: 'no-cors' }))
              .catch(err => console.warn('[SW] No precacheado:', url, err.message))
          )
        );
      })
      .then(() => {
        console.log('[SW] Instalado y listo');
        return self.skipWaiting(); // Activar inmediatamente sin esperar
      })
  );
});

// ── ACTIVATE: limpiar cachés antiguos ──────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Eliminando caché antigua:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim()) // Tomar control de todas las pestañas
  );
});

// ── FETCH: estrategia inteligente por tipo de recurso ──────
self.addEventListener('fetch', event => {
  // Ignorar métodos no-GET
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // No interceptar: blobs, extensiones, APIs dinámicas
  if (url.protocol === 'blob:') return;
  if (url.protocol === 'chrome-extension:') return;
  if (BYPASS_HOSTS.some(h => url.hostname.includes(h))) return;

  // Detectar tipo de recurso para elegir estrategia
  const isHTML     = event.request.destination === 'document';
  const isLocal    = url.hostname === location.hostname;
  const isFont     = event.request.destination === 'font';
  const isImage    = event.request.destination === 'image';
  const isScript   = event.request.destination === 'script';
  const isStyle    = event.request.destination === 'style';

  if (isHTML) {
    // HTML: Network-first → fallback a caché (siempre actualizado)
    event.respondWith(networkFirstStrategy(event.request));
  } else if (isFont || isImage || isScript || isStyle) {
    // Estáticos pesados: Cache-first → fallback a red
    event.respondWith(cacheFirstStrategy(event.request));
  } else {
    // Resto: Stale-while-revalidate
    event.respondWith(staleWhileRevalidate(event.request));
  }
});

// ── ESTRATEGIAS ─────────────────────────────────────────────

// Network-first: intenta red, si falla usa caché
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request, { credentials: 'omit' });
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || offlineFallback(request);
  }
}

// Cache-first: sirve desde caché, actualiza en background
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Revalidar en background sin bloquear
    fetch(request, { credentials: 'omit' })
      .then(res => {
        if (res.ok) {
          caches.open(CACHE_NAME).then(c => c.put(request, res)).catch(() => {});
        }
      }).catch(() => {});
    return cached;
  }
  // No está en caché — ir a la red y cachear
  try {
    const response = await fetch(request, { credentials: 'omit', mode: 'no-cors' });
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch {
    return offlineFallback(request);
  }
}

// Stale-while-revalidate: caché instantáneo + actualización paralela
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request, { credentials: 'omit' })
    .then(res => {
      if (res.ok || res.type === 'opaque') {
        caches.open(CACHE_NAME).then(c => c.put(request, res.clone())).catch(() => {});
      }
      return res;
    }).catch(() => null);
  return cached || await fetchPromise || offlineFallback(request);
}

// Página de fallback cuando no hay red ni caché
function offlineFallback(request) {
  if (request.destination === 'document') {
    return caches.match(`${BASE}/camara.html`)
      || new Response(
        `<!DOCTYPE html><html><body style="background:#000;color:#ff3333;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:16px">
          <div style="font-size:2rem">📡</div>
          <div>OBR CAM — Sin conexión</div>
          <div style="font-size:0.75rem;color:#666">Los recursos no están disponibles offline aún.</div>
          <button onclick="location.reload()" style="background:#ff3333;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer">Reintentar</button>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
  }
  return new Response('', { status: 503 });
}

// ── MENSAJE: forzar actualización desde la app ──────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      event.source.postMessage({ type: 'CACHE_CLEARED' });
    });
  }
});
