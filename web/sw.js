/* Service worker de Daret Manager : l'application fonctionne hors ligne une fois ouverte. */
const CACHE = 'daret-__VERSION__';
const BASE = '__BASE__';
const FICHIERS = __FICHIERS__;

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(cles => Promise.all(cles.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Pages : réseau d'abord (mises à jour), sinon l'application en cache
    e.respondWith(fetch(req).catch(() => caches.match(`${BASE}/`)));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(rep => {
    if (rep.ok) { const copie = rep.clone(); caches.open(CACHE).then(c => c.put(req, copie)); }
    return rep;
  })));
});
