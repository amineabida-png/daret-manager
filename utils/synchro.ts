/**
 * Synchronisation avec le serveur (PostgreSQL sur Railway).
 * Le compte conserve une copie complète des données (même format que la sauvegarde JSON) avec un numéro
 * de version : chaque appareil envoie ses modifications et récupère celles des autres.
 * Les données restent aussi sur l'appareil : l'application fonctionne hors ligne.
 */
import { AppState, Platform } from 'react-native';
import { db, signalerChangement, surChangement } from '../db';
import { exporterTout, importerTout, type Sauvegarde } from '../db/sauvegarde';
import { t } from '../i18n';

const SERVEUR = 'https://daret-manager-production.up.railway.app';
/** Sur le site Railway lui-même, l'API est à la même adresse. */
const API = Platform.OS === 'web' && typeof location !== 'undefined' && location.origin === SERVEUR ? '' : SERVEUR;

export type StatutSynchro = 'deconnecte' | 'en_cours' | 'a_jour' | 'hors_ligne' | 'erreur';
export interface EtatSynchro { email: string | null; statut: StatutSynchro; derniere: string | null; message: string | null }

interface Session { jeton: string; email: string; version: number; derniere: string | null }

let session: Session | null = null;
let etat: EtatSynchro = { email: null, statut: 'deconnecte', derniere: null, message: null };
const abonnes = new Set<(e: EtatSynchro) => void>();
let importEnCours = false;
let minuterie: ReturnType<typeof setTimeout> | undefined;
let envoiEnCours: Promise<void> | null = null;
let demarre = false;

function changerEtat(e: Partial<EtatSynchro>) {
  etat = { ...etat, ...e };
  abonnes.forEach(f => f(etat));
}
export const etatSynchro = () => etat;
export function surEtatSynchro(f: (e: EtatSynchro) => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

/* ---------- Session conservée sur l'appareil (table hors sauvegardes) ---------- */
async function tableSynchro() {
  const d = await db();
  await d.execAsync('CREATE TABLE IF NOT EXISTS synchro (cle TEXT PRIMARY KEY, valeur TEXT NOT NULL)');
  return d;
}
async function chargerSession(): Promise<Session | null> {
  const d = await tableSynchro();
  const r = await d.getFirstAsync<{ valeur: string }>(`SELECT valeur FROM synchro WHERE cle = 'session'`);
  try { return r ? (JSON.parse(r.valeur) as Session) : null; } catch { return null; }
}
async function enregistrerSession(s: Session | null) {
  session = s;
  const d = await tableSynchro();
  if (s) await d.runAsync(`INSERT INTO synchro (cle, valeur) VALUES ('session', ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur`, JSON.stringify(s));
  else await d.runAsync(`DELETE FROM synchro WHERE cle = 'session'`);
}

/* ---------- Appels au serveur ---------- */
class ErreurApi extends Error { constructor(public code: number, public erreur: string) { super(erreur); } }

async function appel<T>(methode: string, chemin: string, corps?: unknown): Promise<T> {
  let rep: Response;
  try {
    rep = await fetch(`${API}${chemin}`, {
      method: methode,
      headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.jeton}` } : {}) },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
  } catch {
    throw new ErreurApi(0, 'hors_ligne');
  }
  const json = await rep.json().catch(() => ({}));
  if (!rep.ok) throw new ErreurApi(rep.status, (json as { erreur?: string }).erreur ?? 'erreur');
  return json as T;
}

/** Message lisible pour une erreur du serveur. */
export function messageErreur(e: unknown): string {
  const code = e instanceof ErreurApi ? e.erreur : '';
  switch (code) {
    case 'hors_ligne': return t('Pas de connexion Internet. Réessayez plus tard.');
    case 'identifiants_incorrects': return t('E-mail ou mot de passe incorrect.');
    case 'email_utilise': return t('Un compte existe déjà avec cet e-mail. Connectez-vous.');
    case 'email_invalide': return t('Adresse e-mail invalide.');
    case 'mot_de_passe_court': return t('Le mot de passe doit contenir au moins 8 caractères.');
    case 'trop_de_tentatives': return t('Trop de tentatives. Réessayez dans 15 minutes.');
    case 'base_indisponible': return t('Le serveur est momentanément indisponible.');
    default: return e instanceof Error && !(e instanceof ErreurApi) ? e.message : t('Une erreur est survenue sur le serveur.');
  }
}

/* ---------- Synchronisation ---------- */
async function appliquerDonneesServeur(contenu: Sauvegarde, version: number) {
  importEnCours = true;
  try {
    await importerTout(contenu);
  } finally {
    importEnCours = false;
  }
  await enregistrerSession({ ...session!, version, derniere: new Date().toISOString() });
}

/** Récupère les données du compte si un autre appareil les a modifiées. */
export async function recuperer(): Promise<void> {
  if (!session) return;
  changerEtat({ statut: 'en_cours', message: null });
  try {
    const r = await appel<{ version: number; contenu: Sauvegarde | null }>('GET', '/api/donnees');
    if (r.contenu && r.version > session.version) await appliquerDonneesServeur(r.contenu, r.version);
    changerEtat({ statut: 'a_jour', derniere: new Date().toISOString() });
  } catch (e) {
    gererErreur(e);
  }
}

/** Envoie toutes les données de l'appareil vers le compte. */
export function envoyer(): Promise<void> {
  if (!session) return Promise.resolve();
  if (envoiEnCours) return envoiEnCours;
  envoiEnCours = (async () => {
    changerEtat({ statut: 'en_cours', message: null });
    try {
      const r = await appel<{ version: number }>('PUT', '/api/donnees', { version_base: session!.version, contenu: await exporterTout() });
      await enregistrerSession({ ...session!, version: r.version, derniere: new Date().toISOString() });
      changerEtat({ statut: 'a_jour', derniere: new Date().toISOString() });
    } catch (e) {
      if (e instanceof ErreurApi && e.code === 409) {
        // Un autre appareil a modifié le compte entre-temps : ses données (plus récentes) sont chargées
        await recuperer();
        changerEtat({ message: t('Des modifications faites sur un autre appareil ont été chargées.') });
      } else gererErreur(e);
    } finally {
      envoiEnCours = null;
    }
  })();
  return envoiEnCours;
}

function gererErreur(e: unknown) {
  if (e instanceof ErreurApi && e.code === 401) {
    // Session expirée ou fermée ailleurs
    enregistrerSession(null).catch(() => {});
    changerEtat({ email: null, statut: 'deconnecte', message: t('Votre session a expiré. Reconnectez-vous.') });
    return;
  }
  changerEtat({ statut: e instanceof ErreurApi && e.code === 0 ? 'hors_ligne' : 'erreur', message: messageErreur(e) });
}

/** À appeler une fois au démarrage : reprend la session et suit les modifications. */
export async function demarrerSynchro(): Promise<void> {
  if (demarre) return;
  demarre = true;
  session = await chargerSession();
  changerEtat({ email: session?.email ?? null, statut: session ? 'en_cours' : 'deconnecte', derniere: session?.derniere ?? null });
  surChangement(() => {
    if (!session || importEnCours || pendant) return;
    clearTimeout(minuterie);
    minuterie = setTimeout(() => { envoyer().catch(() => {}); }, 1500);
  });
  // Récupère les modifications des autres appareils au retour dans l'application et chaque minute
  AppState.addEventListener('change', s => { if (s === 'active') recuperer().catch(() => {}); });
  setInterval(() => { if (session && !envoiEnCours) recuperer().catch(() => {}); }, 60_000);
  if (session) await recuperer();
}

export type ResultatConnexion = 'ok' | 'conflit';

/**
 * Connexion ou création de compte. Si le compte et l'appareil contiennent tous deux des données,
 * renvoie « conflit » : l'écran demande alors laquelle garder (choisirDonnees).
 */
export async function connecter(mode: 'connexion' | 'inscription', email: string, motDePasse: string): Promise<ResultatConnexion> {
  const r = await appel<{ jeton: string; email: string }>('POST', mode === 'connexion' ? '/api/connexion' : '/api/inscription', { email: email.trim(), mot_de_passe: motDePasse });
  session = { jeton: r.jeton, email: r.email, version: 0, derniere: null };
  const distant = await appel<{ version: number; contenu: Sauvegarde | null }>('GET', '/api/donnees');
  const local = await exporterTout();
  const localVide = local.darets.length === 0;
  const distantVide = !distant.contenu || distant.contenu.darets.length === 0;
  if (!distantVide && !localVide) {
    session.version = distant.version;
    pendant = distant;
    return 'conflit';
  }
  await enregistrerSession(session);
  changerEtat({ email: r.email, statut: 'en_cours', message: null });
  if (!distantVide) await appliquerDonneesServeur(distant.contenu!, distant.version);
  else { session.version = distant.version; await envoyer(); }
  changerEtat({ statut: 'a_jour', derniere: new Date().toISOString() });
  signalerChangement();
  return 'ok';
}

let pendant: { version: number; contenu: Sauvegarde | null } | null = null;

/** Après un conflit : « compte » charge les données du compte, « appareil » les remplace par celles de l'appareil. */
export async function choisirDonnees(choix: 'compte' | 'appareil'): Promise<void> {
  if (!session || !pendant) return;
  await enregistrerSession(session);
  changerEtat({ email: session.email, statut: 'en_cours', message: null });
  if (choix === 'compte') await appliquerDonneesServeur(pendant.contenu!, pendant.version);
  else await envoyer();
  pendant = null;
  changerEtat({ statut: 'a_jour', derniere: new Date().toISOString() });
  signalerChangement();
}

/** Abandonne une connexion en conflit sans rien modifier. */
export function annulerConnexion() {
  session = null;
  pendant = null;
}

/** Déconnexion : les données restent sur l'appareil, la synchronisation s'arrête. */
export async function deconnecter(): Promise<void> {
  if (session) await appel('POST', '/api/deconnexion').catch(() => {});
  await enregistrerSession(null);
  changerEtat({ email: null, statut: 'deconnecte', derniere: null, message: null });
}
