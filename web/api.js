/**
 * API de synchronisation de Daret Manager (PostgreSQL).
 * Chaque compte (e-mail + mot de passe) possède une copie complète de ses données (sauvegarde JSON),
 * versionnée pour éviter qu'un appareil n'écrase sans le savoir les modifications d'un autre.
 * Tout est rangé dans le schéma « daret_manager » pour ne pas toucher aux autres applications de la base.
 */
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

let pool = null;
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
}

const ORIGINES = new Set(['https://amineabida-png.github.io', 'http://localhost:8081', 'http://localhost:8080', 'http://localhost:8090']);
const TAILLE_MAX = 5 * 1024 * 1024;
const DUREE_SESSION_JOURS = 365;

async function initialiser() {
  if (!pool) return;
  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS daret_manager;
    CREATE TABLE IF NOT EXISTS daret_manager.comptes (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      mot_de_passe TEXT NOT NULL,
      cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS daret_manager.sessions (
      jeton_hash TEXT PRIMARY KEY,
      compte_id INTEGER NOT NULL REFERENCES daret_manager.comptes(id) ON DELETE CASCADE,
      expire_le TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS daret_manager.partages (
      jeton TEXT PRIMARY KEY,
      compte_id INTEGER NOT NULL REFERENCES daret_manager.comptes(id) ON DELETE CASCADE,
      daret_id INTEGER NOT NULL,
      cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (compte_id, daret_id)
    );
    CREATE TABLE IF NOT EXISTS daret_manager.donnees (
      compte_id INTEGER PRIMARY KEY REFERENCES daret_manager.comptes(id) ON DELETE CASCADE,
      version INTEGER NOT NULL DEFAULT 0,
      contenu JSONB,
      maj_le TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

/* ---------- Mots de passe et jetons ---------- */
async function hacher(mdp) {
  const sel = crypto.randomBytes(16);
  const cle = await scrypt(mdp, sel, 64);
  return `scrypt$${sel.toString('hex')}$${cle.toString('hex')}`;
}
async function verifier(mdp, stocke) {
  const [, selHex, cleHex] = stocke.split('$');
  const cle = await scrypt(mdp, Buffer.from(selHex, 'hex'), 64);
  return crypto.timingSafeEqual(cle, Buffer.from(cleHex, 'hex'));
}
const hashJeton = j => crypto.createHash('sha256').update(j).digest('hex');
async function nouvelleSession(compteId) {
  const jeton = crypto.randomBytes(32).toString('base64url');
  await pool.query(`INSERT INTO daret_manager.sessions (jeton_hash, compte_id, expire_le) VALUES ($1, $2, now() + interval '${DUREE_SESSION_JOURS} days')`, [hashJeton(jeton), compteId]);
  return jeton;
}
async function compteDeLaRequete(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const r = await pool.query(`SELECT c.id, c.email FROM daret_manager.sessions s JOIN daret_manager.comptes c ON c.id = s.compte_id WHERE s.jeton_hash = $1 AND s.expire_le > now()`, [hashJeton(m[1])]);
  return r.rows[0] || null;
}

/* ---------- Limitation des tentatives de connexion ---------- */
const tentatives = new Map();
function tropDeTentatives(cle, max = 10) {
  const maintenant = Date.now();
  const l = (tentatives.get(cle) || []).filter(t => maintenant - t < 15 * 60 * 1000);
  l.push(maintenant);
  tentatives.set(cle, l);
  return l.length > max;
}

/* ---------- Utilitaires HTTP ---------- */
function repondre(res, code, corps) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(corps));
}
function lireCorps(req) {
  return new Promise((ok, ko) => {
    let taille = 0; const morceaux = [];
    req.on('data', m => { taille += m.length; if (taille > TAILLE_MAX) { ko(Object.assign(new Error('trop gros'), { code: 413 })); req.destroy(); } else morceaux.push(m); });
    req.on('end', () => { try { ok(morceaux.length ? JSON.parse(Buffer.concat(morceaux).toString('utf8')) : {}); } catch { ko(Object.assign(new Error('JSON invalide'), { code: 400 })); } });
    req.on('error', ko);
  });
}
// Adresse réelle du visiteur (Railway passe par un proxy)
const ip = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
const emailValide = e => typeof e === 'string' && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/** Traite les requêtes /api/… ; renvoie false si l'adresse n'est pas une route d'API. */
async function traiter(req, res) {
  const url = (req.url || '').split('?')[0];
  if (!url.startsWith('/api/')) return false;

  const origine = req.headers.origin;
  if (origine && ORIGINES.has(origine)) {
    res.setHeader('Access-Control-Allow-Origin', origine);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return true; }
  if (!pool) { repondre(res, 503, { erreur: 'base_indisponible' }); return true; }

  try {
    if (url === '/api/inscription' && req.method === 'POST') {
      const { email, mot_de_passe: mdp } = await lireCorps(req);
      const e = String(email || '').trim().toLowerCase();
      if (!emailValide(e)) return repondre(res, 400, { erreur: 'email_invalide' }), true;
      if (typeof mdp !== 'string' || mdp.length < 8 || mdp.length > 200) return repondre(res, 400, { erreur: 'mot_de_passe_court' }), true;
      if (tropDeTentatives(`i:${ip(req)}`)) return repondre(res, 429, { erreur: 'trop_de_tentatives' }), true;
      const existe = await pool.query('SELECT 1 FROM daret_manager.comptes WHERE email = $1', [e]);
      if (existe.rowCount) return repondre(res, 409, { erreur: 'email_utilise' }), true;
      const r = await pool.query('INSERT INTO daret_manager.comptes (email, mot_de_passe) VALUES ($1, $2) RETURNING id', [e, await hacher(mdp)]);
      await pool.query('INSERT INTO daret_manager.donnees (compte_id) VALUES ($1)', [r.rows[0].id]);
      repondre(res, 201, { jeton: await nouvelleSession(r.rows[0].id), email: e });
      return true;
    }

    if (url === '/api/connexion' && req.method === 'POST') {
      const { email, mot_de_passe: mdp } = await lireCorps(req);
      const e = String(email || '').trim().toLowerCase();
      if (tropDeTentatives(`c:${e}`) || tropDeTentatives(`ip:${ip(req)}`)) return repondre(res, 429, { erreur: 'trop_de_tentatives' }), true;
      const r = await pool.query('SELECT id, mot_de_passe FROM daret_manager.comptes WHERE email = $1', [e]);
      if (!r.rowCount || typeof mdp !== 'string' || !(await verifier(mdp, r.rows[0].mot_de_passe))) return repondre(res, 401, { erreur: 'identifiants_incorrects' }), true;
      repondre(res, 200, { jeton: await nouvelleSession(r.rows[0].id), email: e });
      return true;
    }

    // Consultation publique d'une daret partagée (lecture seule, sans numéros de téléphone)
    const pub = /^\/api\/public\/([A-Za-z0-9_-]{16,64})$/.exec(url);
    if (pub && req.method === 'GET') {
      if (tropDeTentatives(`p:${ip(req)}`, 120)) return repondre(res, 429, { erreur: 'trop_de_tentatives' }), true;
      const r = await pool.query(
        `SELECT p.daret_id, d.contenu, d.maj_le FROM daret_manager.partages p JOIN daret_manager.donnees d ON d.compte_id = p.compte_id WHERE p.jeton = $1`, [pub[1]]);
      const ligne = r.rows[0];
      const c = ligne && ligne.contenu;
      const daret = c && (c.darets || []).find(x => x.id === ligne.daret_id);
      if (!daret) return repondre(res, 404, { erreur: 'lien_invalide' }), true;
      const tours = (c.tours || []).filter(x => x.daret_id === daret.id);
      const idsTours = new Set(tours.map(x => x.id));
      return repondre(res, 200, {
        maj_le: ligne.maj_le,
        daret: { id: daret.id, nom: daret.nom, montant_part: daret.montant_part, frequence: daret.frequence, date_debut: daret.date_debut, jour_echeance: daret.jour_echeance, statut: daret.statut },
        membres: (c.membres || []).filter(x => x.daret_id === daret.id).map(x => ({ id: x.id, nom: x.nom, nb_parts: x.nb_parts, rang_inscription: x.rang_inscription })),
        tours: tours.map(x => ({ id: x.id, numero: x.numero, beneficiaire_id: x.beneficiaire_id, date_echeance: x.date_echeance, remis_le: x.remis_le })),
        paiements: (c.paiements || []).filter(x => idsTours.has(x.tour_id)).map(x => ({ tour_id: x.tour_id, membre_id: x.membre_id, montant: x.montant, date_paiement: x.date_paiement })),
      }), true;
    }

    const compte = await compteDeLaRequete(req);
    if (!compte) return repondre(res, 401, { erreur: 'non_connecte' }), true;

    if (url === '/api/partages' && req.method === 'GET') {
      const r = await pool.query('SELECT daret_id, jeton FROM daret_manager.partages WHERE compte_id = $1', [compte.id]);
      return repondre(res, 200, { partages: r.rows }), true;
    }
    if (url === '/api/partages' && req.method === 'POST') {
      const { daret_id: daretId } = await lireCorps(req);
      if (!Number.isInteger(daretId)) return repondre(res, 400, { erreur: 'daret_invalide' }), true;
      const existant = await pool.query('SELECT jeton FROM daret_manager.partages WHERE compte_id = $1 AND daret_id = $2', [compte.id, daretId]);
      if (existant.rowCount) return repondre(res, 200, { jeton: existant.rows[0].jeton }), true;
      const jeton = crypto.randomBytes(18).toString('base64url');
      await pool.query('INSERT INTO daret_manager.partages (jeton, compte_id, daret_id) VALUES ($1, $2, $3)', [jeton, compte.id, daretId]);
      return repondre(res, 201, { jeton }), true;
    }
    const supp = /^\/api\/partages\/(\d+)$/.exec(url);
    if (supp && req.method === 'DELETE') {
      await pool.query('DELETE FROM daret_manager.partages WHERE compte_id = $1 AND daret_id = $2', [compte.id, Number(supp[1])]);
      return repondre(res, 200, { ok: true }), true;
    }

    if (url === '/api/deconnexion' && req.method === 'POST') {
      await pool.query('DELETE FROM daret_manager.sessions WHERE jeton_hash = $1', [hashJeton(req.headers.authorization.slice(7))]);
      return repondre(res, 200, { ok: true }), true;
    }

    if (url === '/api/donnees' && req.method === 'GET') {
      const r = await pool.query('SELECT version, contenu, maj_le FROM daret_manager.donnees WHERE compte_id = $1', [compte.id]);
      const d = r.rows[0] || { version: 0, contenu: null, maj_le: null };
      return repondre(res, 200, { email: compte.email, version: d.version, contenu: d.contenu, maj_le: d.maj_le }), true;
    }

    if (url === '/api/donnees' && req.method === 'PUT') {
      const { version_base: base, contenu } = await lireCorps(req);
      if (!contenu || contenu.application !== 'daret-manager') return repondre(res, 400, { erreur: 'contenu_invalide' }), true;
      // Mise à jour seulement si personne n'a écrit entre-temps (version attendue)
      const r = await pool.query(
        `UPDATE daret_manager.donnees SET contenu = $1, version = version + 1, maj_le = now()
         WHERE compte_id = $2 AND version = $3 RETURNING version, maj_le`, [contenu, compte.id, Number(base) || 0]);
      if (!r.rowCount) {
        const actuel = await pool.query('SELECT version FROM daret_manager.donnees WHERE compte_id = $1', [compte.id]);
        return repondre(res, 409, { erreur: 'version_depassee', version: actuel.rows[0]?.version ?? 0 }), true;
      }
      return repondre(res, 200, { version: r.rows[0].version, maj_le: r.rows[0].maj_le }), true;
    }

    if (url === '/api/compte' && req.method === 'DELETE') {
      await pool.query('DELETE FROM daret_manager.comptes WHERE id = $1', [compte.id]);
      return repondre(res, 200, { ok: true }), true;
    }

    repondre(res, 404, { erreur: 'introuvable' });
  } catch (e) {
    if (e.code === 413 || e.code === 400) repondre(res, e.code, { erreur: e.message });
    else { console.error('API :', e.message); repondre(res, 500, { erreur: 'erreur_serveur' }); }
  }
  return true;
}

module.exports = { initialiser, traiter };
