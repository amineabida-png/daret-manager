/**
 * Finalise l'export web d'Expo pour en faire une application installable (PWA) :
 * manifeste, icônes Android / iPhone, service worker hors ligne, page 404 pour GitHub Pages.
 * Usage : node web/construire.js <dossier-export> [chemin-de-base]   ex. node web/construire.js dist-web /daret-manager
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dist = path.resolve(process.argv[2] || 'dist-web');
const base = (process.argv[3] || '').replace(/\/$/, '');
const ici = __dirname;
const lien = p => `${base}/${p}`;

// Icônes
fs.mkdirSync(path.join(dist, 'icones'), { recursive: true });
for (const f of fs.readdirSync(path.join(ici, 'icones'))) fs.writeFileSync(path.join(dist, 'icones', f), fs.readFileSync(path.join(ici, 'icones', f)));

// Manifeste
const manifeste = {
  name: 'Daret Manager',
  short_name: 'Daret',
  description: 'Gestion de daret (tontine marocaine) : membres, tours, cotisations, retards et relances WhatsApp.',
  lang: 'fr',
  dir: 'auto',
  start_url: `${base}/`,
  scope: `${base}/`,
  display: 'standalone',
  orientation: 'any',
  background_color: '#F2F5F3',
  theme_color: '#145F43',
  categories: ['finance', 'productivity'],
  icons: [
    { src: lien('icones/icone-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: lien('icones/icone-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: lien('icones/maskable-192.png'), sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: lien('icones/maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
fs.writeFileSync(path.join(dist, 'manifest.webmanifest'), JSON.stringify(manifeste, null, 2));

// Liste des fichiers à mettre en cache pour le mode hors ligne
const fichiers = [];
(function parcourir(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) parcourir(p);
    else fichiers.push(path.relative(dist, p).split(path.sep).join('/'));
  }
})(dist);
const aCacher = fichiers.filter(f =>
  /^_expo\/.*\.js$/.test(f) || /^sql-wasm\.(js|wasm)$/.test(f) || /^icones\//.test(f) ||
  (/^assets\//.test(f) && (/Ionicons\..*\.ttf$/.test(f) || /\.(png|jpg)$/.test(f) && !/node_modules\/expo-router/.test(f))));
const version = crypto.createHash('sha1').update(aCacher.join('|') + fs.readFileSync(path.join(dist, 'index.html'))).digest('hex').slice(0, 10);
const sw = fs.readFileSync(path.join(ici, 'sw.js'), 'utf8')
  .replace('__VERSION__', version)
  .replace('__BASE__', base)
  .replace('__FICHIERS__', JSON.stringify(['', ...aCacher].map(f => `${base}/${f}`)));
fs.writeFileSync(path.join(dist, 'sw.js'), sw);

// Page HTML : balises mobiles (Android, iPhone, iPad) et enregistrement du service worker
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
html = html.replace(/<meta name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />');
html = html.replace(/<meta httpEquiv=[^>]*>\s*/, '');
html = html.replace(/<link rel="icon"[^>]*>/, '');
const tete = `
    <link rel="manifest" href="${lien('manifest.webmanifest')}" />
    <link rel="icon" type="image/png" sizes="32x32" href="${lien('icones/icone-32.png')}" />
    <link rel="icon" type="image/png" sizes="192x192" href="${lien('icones/icone-192.png')}" />
    <link rel="apple-touch-icon" href="${lien('icones/icone-180.png')}" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Daret" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="format-detection" content="telephone=no" />
    <meta name="theme-color" content="#145F43" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#0D1311" media="(prefers-color-scheme: dark)" />
    <style>
      html, body { background: #F2F5F3; overscroll-behavior: none; -webkit-tap-highlight-color: transparent; }
      @media (prefers-color-scheme: dark) { html, body { background: #0D1311; } }
      input, textarea { font-size: 16px; } /* évite le zoom automatique sur iPhone */
      html[dir="rtl"] [dir="auto"] { text-align: right; } /* darija : noms latins alignés à droite aussi */
    </style>
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () { navigator.serviceWorker.register('${lien('sw.js')}', { scope: '${base}/' }).catch(function () {}); });
      }
    </script>
  `;
html = html.replace(/<meta name="theme-color"[^>]*>\s*/, '').replace('</head>', `${tete}</head>`);
fs.writeFileSync(path.join(dist, 'index.html'), html);
// GitHub Pages : toute adresse inconnue (ex. /daret/3) renvoie l'application
fs.writeFileSync(path.join(dist, '404.html'), html);
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
console.log(`PWA prête dans ${dist} (base « ${base || '/'} », ${aCacher.length} fichiers en cache, version ${version})`);
