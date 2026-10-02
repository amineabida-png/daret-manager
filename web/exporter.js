/**
 * Construit la version web complète.
 * node web/exporter.js [dossier] [chemin-de-base]
 *   ex. node web/exporter.js dist-web               (Railway, à la racine du domaine)
 *       node web/exporter.js dist-pages /daret-manager (GitHub Pages)
 */
const { execSync } = require('child_process');
const dossier = process.argv[2] || 'dist-web';
const base = process.argv[3] || '';
execSync(`npx expo export -p web --output-dir ${dossier} --clear`, { stdio: 'inherit', env: { ...process.env, BASE_URL: base } });
execSync(`node web/construire.js ${dossier} ${base}`, { stdio: 'inherit' });
