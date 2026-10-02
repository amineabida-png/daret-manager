import type { Centimes, Daret, DateISO, Frequence, Membre, ModeOrdre, ModePaiement, Paiement, Parametres, StatutDaret, Tour } from '../types';
import { db, signalerChangement } from './index';
import { aujourdhui } from '../utils/dates';
import { genererCalendrier, genererDates, ordreValide } from '../utils/calendrier';
import { daretCommencee } from '../utils/statuts';
import { montantDuMembre } from '../utils/montant';
import { MODELE_WHATSAPP_DEFAUT, modeleWhatsAppDefaut } from '../utils/partage';
import { t } from '../i18n';

export class ErreurMetier extends Error {}

/* =============================== DARETS =============================== */

export interface DaretSaisie {
  nom: string;
  montant_part: Centimes;
  frequence: Frequence;
  date_debut: DateISO;
  jour_echeance: number;
  notes: string | null;
}

export async function listerDarets(): Promise<Daret[]> {
  return (await db()).getAllAsync<Daret>(
    `SELECT * FROM darets ORDER BY CASE statut WHEN 'en_cours' THEN 0 WHEN 'terminee' THEN 1 ELSE 2 END, cree_le DESC`,
  );
}

export async function getDaret(id: number): Promise<Daret | null> {
  return (await db()).getFirstAsync<Daret>('SELECT * FROM darets WHERE id = ?', id);
}

export async function creerDaret(s: DaretSaisie): Promise<number> {
  const r = await (await db()).runAsync(
    'INSERT INTO darets (nom, montant_part, frequence, date_debut, jour_echeance, notes) VALUES (?, ?, ?, ?, ?, ?)',
    s.nom.trim(), s.montant_part, s.frequence, s.date_debut, s.jour_echeance, s.notes,
  );
  signalerChangement();
  return r.lastInsertRowId;
}

/** Modifie une daret ; si le rythme change, les dates des tours sont recalculées (bénéficiaires conservés). */
export async function modifierDaret(id: number, s: DaretSaisie): Promise<void> {
  const d = await db();
  const avant = await getDaret(id);
  if (!avant) throw new ErreurMetier(t('Daret introuvable'));
  await d.withTransactionAsync(async () => {
    await d.runAsync(
      `UPDATE darets SET nom = ?, montant_part = ?, frequence = ?, date_debut = ?, jour_echeance = ?, notes = ?, modifie_le = datetime('now') WHERE id = ?`,
      s.nom.trim(), s.montant_part, s.frequence, s.date_debut, s.jour_echeance, s.notes, id,
    );
    const rythmeChange = avant.frequence !== s.frequence || avant.date_debut !== s.date_debut || avant.jour_echeance !== s.jour_echeance;
    if (rythmeChange) {
      const tours = await d.getAllAsync<Tour>('SELECT * FROM tours WHERE daret_id = ? ORDER BY numero', id);
      const dates = genererDates(s.date_debut, s.frequence, s.jour_echeance, tours.length);
      for (const [i, t] of tours.entries()) await d.runAsync('UPDATE tours SET date_echeance = ? WHERE id = ?', dates[i], t.id);
    }
  });
  signalerChangement();
}

export async function changerStatutDaret(id: number, statut: StatutDaret): Promise<void> {
  await (await db()).runAsync(`UPDATE darets SET statut = ?, modifie_le = datetime('now') WHERE id = ?`, statut, id);
  signalerChangement();
}

export async function supprimerDaret(id: number): Promise<void> {
  await (await db()).runAsync('DELETE FROM darets WHERE id = ?', id);
  signalerChangement();
}

/** Vrai si la 1re échéance est atteinte ou si un paiement existe. */
export async function estCommencee(daretId: number): Promise<boolean> {
  const d = await db();
  const tours = await d.getAllAsync<Pick<Tour, 'date_echeance'>>('SELECT date_echeance FROM tours WHERE daret_id = ?', daretId);
  const n = await d.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) n FROM paiements p JOIN tours t ON t.id = p.tour_id WHERE t.daret_id = ?', daretId,
  );
  return daretCommencee(tours, n?.n ?? 0, aujourdhui());
}

/* =============================== MEMBRES =============================== */

export interface MembreSaisie {
  nom: string;
  telephone: string | null;
  nb_parts: number;
  notes: string | null;
}

export async function listerMembres(daretId: number): Promise<Membre[]> {
  return (await db()).getAllAsync<Membre>('SELECT * FROM membres WHERE daret_id = ? ORDER BY rang_inscription', daretId);
}

export async function getMembre(id: number): Promise<Membre | null> {
  return (await db()).getFirstAsync<Membre>('SELECT * FROM membres WHERE id = ?', id);
}

/** Avant le démarrage, toute modification de la composition invalide le calendrier. */
async function invaliderCalendrier(daretId: number): Promise<void> {
  const d = await db();
  await d.runAsync('DELETE FROM tours WHERE daret_id = ?', daretId);
  await d.runAsync('UPDATE darets SET mode_ordre = NULL WHERE id = ?', daretId);
}

export async function ajouterMembres(daretId: number, saisies: MembreSaisie[]): Promise<void> {
  if (await estCommencee(daretId)) throw new ErreurMetier(t('La daret a commencé : impossible d\'ajouter un membre.'));
  const d = await db();
  await d.withTransactionAsync(async () => {
    const max = await d.getFirstAsync<{ m: number | null }>('SELECT MAX(rang_inscription) m FROM membres WHERE daret_id = ?', daretId);
    let rang = (max?.m ?? 0) + 1;
    for (const s of saisies) {
      await d.runAsync(
        'INSERT INTO membres (daret_id, nom, telephone, nb_parts, rang_inscription, notes) VALUES (?, ?, ?, ?, ?, ?)',
        daretId, s.nom.trim(), s.telephone?.trim() || null, Math.max(1, s.nb_parts), rang++, s.notes,
      );
    }
    await invaliderCalendrier(daretId);
  });
  signalerChangement();
}

export async function modifierMembre(id: number, s: MembreSaisie): Promise<void> {
  const avant = await getMembre(id);
  if (!avant) throw new ErreurMetier(t('Membre introuvable'));
  const partsChangent = avant.nb_parts !== s.nb_parts;
  if (partsChangent && (await estCommencee(avant.daret_id))) {
    throw new ErreurMetier(t('La daret a commencé : le nombre de parts ne peut plus changer.'));
  }
  const d = await db();
  await d.withTransactionAsync(async () => {
    await d.runAsync('UPDATE membres SET nom = ?, telephone = ?, nb_parts = ?, notes = ? WHERE id = ?',
      s.nom.trim(), s.telephone?.trim() || null, Math.max(1, s.nb_parts), s.notes, id);
    if (partsChangent) await invaliderCalendrier(avant.daret_id);
  });
  signalerChangement();
}

export async function supprimerMembre(id: number): Promise<void> {
  const m = await getMembre(id);
  if (!m) return;
  if (await estCommencee(m.daret_id)) throw new ErreurMetier(t('La daret a commencé : impossible de retirer un membre.'));
  const d = await db();
  await d.withTransactionAsync(async () => {
    await invaliderCalendrier(m.daret_id);
    await d.runAsync('DELETE FROM membres WHERE id = ?', id);
  });
  signalerChangement();
}

/* =============================== TOURS =============================== */

export async function listerTours(daretId: number): Promise<Tour[]> {
  return (await db()).getAllAsync<Tour>('SELECT * FROM tours WHERE daret_id = ? ORDER BY numero', daretId);
}

export async function getTour(id: number): Promise<Tour | null> {
  return (await db()).getFirstAsync<Tour>('SELECT * FROM tours WHERE id = ?', id);
}

/** Enregistre l'ordre (liste d'identifiants de membres, une entrée par part) et génère le calendrier. */
export async function definirOrdre(daretId: number, mode: ModeOrdre, ordre: number[]): Promise<void> {
  const daret = await getDaret(daretId);
  if (!daret) throw new ErreurMetier(t('Daret introuvable'));
  if (await estCommencee(daretId)) throw new ErreurMetier(t('La daret a commencé : utilisez l\'échange de tours.'));
  const membres = await listerMembres(daretId);
  if (membres.length < 2) throw new ErreurMetier(t('Il faut au moins 2 membres.'));
  if (!ordreValide(ordre, membres)) throw new ErreurMetier(t('Ordre incomplet : chaque part doit apparaître une fois.'));
  const cal = genererCalendrier(ordre, daret.date_debut, daret.frequence, daret.jour_echeance);
  const d = await db();
  await d.withTransactionAsync(async () => {
    await d.runAsync('DELETE FROM tours WHERE daret_id = ?', daretId);
    for (const t of cal) {
      await d.runAsync('INSERT INTO tours (daret_id, numero, beneficiaire_id, date_echeance) VALUES (?, ?, ?, ?)',
        daretId, t.numero, t.beneficiaire_id, t.date_echeance);
    }
    await d.runAsync(`UPDATE darets SET mode_ordre = ?, modifie_le = datetime('now') WHERE id = ?`, mode, daretId);
  });
  signalerChangement();
}

/** Échange les bénéficiaires de deux tours (possible même après le démarrage). */
export async function echangerDeuxTours(tourA: number, tourB: number): Promise<void> {
  const d = await db();
  const a = await getTour(tourA), b = await getTour(tourB);
  if (!a || !b || a.daret_id !== b.daret_id) throw new ErreurMetier(t('Tours invalides'));
  if (a.remis_le || b.remis_le) throw new ErreurMetier(t('Un tour déjà remis ne peut pas être échangé.'));
  await d.withTransactionAsync(async () => {
    await d.runAsync('UPDATE tours SET beneficiaire_id = ? WHERE id = ?', b.beneficiaire_id, a.id);
    await d.runAsync('UPDATE tours SET beneficiaire_id = ? WHERE id = ?', a.beneficiaire_id, b.id);
  });
  signalerChangement();
}

/** Marque le tour comme remis (date) ou annule la remise (null) ; met à jour le statut de la daret. */
export async function marquerRemis(tourId: number, date: DateISO | null): Promise<void> {
  const d = await db();
  const t = await getTour(tourId);
  if (!t) return;
  await d.withTransactionAsync(async () => {
    await d.runAsync('UPDATE tours SET remis_le = ? WHERE id = ?', date, tourId);
    const reste = await d.getFirstAsync<{ n: number }>('SELECT COUNT(*) n FROM tours WHERE daret_id = ? AND remis_le IS NULL', t.daret_id);
    const daret = await getDaret(t.daret_id);
    if (daret && daret.statut !== 'archivee') {
      await d.runAsync('UPDATE darets SET statut = ? WHERE id = ?', reste?.n === 0 ? 'terminee' : 'en_cours', t.daret_id);
    }
  });
  signalerChangement();
}

/* =============================== PAIEMENTS =============================== */

export async function listerPaiementsTour(tourId: number): Promise<Paiement[]> {
  return (await db()).getAllAsync<Paiement>('SELECT * FROM paiements WHERE tour_id = ? ORDER BY date_paiement, id', tourId);
}

export async function listerPaiementsDaret(daretId: number): Promise<Paiement[]> {
  return (await db()).getAllAsync<Paiement>(
    'SELECT p.* FROM paiements p JOIN tours t ON t.id = p.tour_id WHERE t.daret_id = ? ORDER BY p.date_paiement DESC, p.id DESC', daretId,
  );
}

export async function listerPaiementsMembre(membreId: number): Promise<Paiement[]> {
  return (await db()).getAllAsync<Paiement>('SELECT * FROM paiements WHERE membre_id = ? ORDER BY date_paiement DESC, id DESC', membreId);
}

export async function ajouterPaiement(tourId: number, membreId: number, montant: Centimes, date: DateISO, mode: ModePaiement): Promise<void> {
  if (montant <= 0) throw new ErreurMetier(t('Le montant doit être positif.'));
  await (await db()).runAsync('INSERT INTO paiements (tour_id, membre_id, montant, date_paiement, mode) VALUES (?, ?, ?, ?, ?)',
    tourId, membreId, montant, date, mode);
  signalerChangement();
}

/** Paiement complet en un appui : verse le reste dû (aucun effet si déjà payé). */
export async function payerReste(tourId: number, membre: Membre, montantPart: Centimes, mode: ModePaiement = 'especes'): Promise<void> {
  const d = await db();
  const verse = (await d.getFirstAsync<{ s: number | null }>('SELECT SUM(montant) s FROM paiements WHERE tour_id = ? AND membre_id = ?', tourId, membre.id))?.s ?? 0;
  const reste = montantDuMembre(montantPart, membre.nb_parts) - verse;
  if (reste > 0) await ajouterPaiement(tourId, membre.id, reste, aujourdhui(), mode);
}

/** Annule tous les paiements d'un membre pour un tour. */
export async function annulerPaiements(tourId: number, membreId: number): Promise<void> {
  await (await db()).runAsync('DELETE FROM paiements WHERE tour_id = ? AND membre_id = ?', tourId, membreId);
  signalerChangement();
}

export async function supprimerPaiement(id: number): Promise<void> {
  await (await db()).runAsync('DELETE FROM paiements WHERE id = ?', id);
  signalerChangement();
}

/* =============================== PARAMÈTRES =============================== */

const PARAMETRES_DEFAUT: Parametres = { theme: 'systeme', delai_rappel: 1, modele_whatsapp: MODELE_WHATSAPP_DEFAUT, langue: 'fr' };

export async function lireParametres(): Promise<Parametres> {
  const lignes = await (await db()).getAllAsync<{ cle: string; valeur: string }>('SELECT cle, valeur FROM parametres');
  const p: Parametres = { ...PARAMETRES_DEFAUT };
  let modele: string | null = null;
  for (const { cle, valeur } of lignes) {
    if (cle === 'theme' && ['clair', 'sombre', 'systeme'].includes(valeur)) p.theme = valeur as Parametres['theme'];
    if (cle === 'delai_rappel' && ['1', '2', '3'].includes(valeur)) p.delai_rappel = Number(valeur) as Parametres['delai_rappel'];
    if (cle === 'modele_whatsapp' && valeur.trim()) modele = valeur;
    if (cle === 'langue' && (valeur === 'fr' || valeur === 'ar')) p.langue = valeur;
  }
  // Sans modèle personnalisé, le modèle par défaut suit la langue
  p.modele_whatsapp = modele ?? modeleWhatsAppDefaut(p.langue);
  return p;
}

export async function ecrireParametre<K extends keyof Parametres>(cle: K, valeur: Parametres[K]): Promise<void> {
  await (await db()).runAsync('INSERT INTO parametres (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur',
    cle, String(valeur));
  signalerChangement();
}

export { PARAMETRES_DEFAUT };
