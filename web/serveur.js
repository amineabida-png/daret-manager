/**
 * Serveur web minimal de Daret Manager (Railway) : fichiers statiques, compression,
 * cache long pour les fichiers versionnés et renvoi de l'application pour les autres adresses.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const api = require('./api');

// dist/ à côté du serveur (déploiement Railway) ou dist-web/ du projet (essai local)
const RACINE = [path.join(__dirname, 'dist'), path.join(__dirname, '..', 'dist-web')].find(d => fs.existsSync(d)) || path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.ttf': 'font/ttf',
};
const COMPRESSIBLES = /\.(html|js|json|webmanifest|wasm|css|svg|ttf)$/;

http.createServer(async (req, res) => {
  if ((req.url || '').startsWith('/api/')) { await api.traiter(req, res); return; }
  let chemin = decodeURIComponent((req.url || '/').split('?')[0]);
  if (chemin === '/sante') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  let fichier = path.normalize(path.join(RACINE, chemin));
  if (!fichier.startsWith(RACINE)) { res.writeHead(403); return res.end(); }
  // Railway n'envoie pas les dossiers « node_modules » : ils sont déployés sous le nom « modules_npm »
  if (!fs.existsSync(fichier) && fichier.includes(`${path.sep}node_modules${path.sep}`)) fichier = fichier.split(`${path.sep}node_modules${path.sep}`).join(`${path.sep}modules_npm${path.sep}`);
  if (!fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) fichier = path.join(RACINE, 'index.html');

  const ext = path.extname(fichier);
  const versionne = /[\\/](_expo|assets)[\\/]/.test(fichier) || /-[0-9a-f]{16,}\./.test(fichier);
  const entetes = {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Cache-Control': versionne ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
  const flux = fs.createReadStream(fichier);
  if (COMPRESSIBLES.test(fichier) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    res.writeHead(200, { ...entetes, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
    flux.pipe(zlib.createGzip()).pipe(res);
  } else {
    res.writeHead(200, entetes);
    flux.pipe(res);
  }
}).listen(PORT, () => {
  console.log(`Daret Manager en ligne sur le port ${PORT}`);
  api.initialiser().then(() => console.log(process.env.DATABASE_URL ? 'PostgreSQL prêt (schéma daret_manager)' : 'Sans base : synchronisation désactivée')).catch(e => console.error('PostgreSQL :', e.message));
});
