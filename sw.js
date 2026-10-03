/* Service worker de Daret Manager : l'application fonctionne hors ligne une fois ouverte. */
const CACHE = 'daret-eb226a390a';
const BASE = '/daret-manager';
const FICHIERS = ["/daret-manager/","/daret-manager/assets/assets/icon.62efa68fe059757126b6119548d6ba30.png","/daret-manager/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.b4eb097d35f44ed943676fd56f6bdc51.ttf","/daret-manager/icones/icone-180.png","/daret-manager/icones/icone-192.png","/daret-manager/icones/icone-32.png","/daret-manager/icones/icone-512.png","/daret-manager/icones/maskable-192.png","/daret-manager/icones/maskable-512.png","/daret-manager/sql-wasm.js","/daret-manager/sql-wasm.wasm","/daret-manager/_expo/static/js/web/entry-8a1d5117be1b62b5f80c8b191851131c.js"];

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
