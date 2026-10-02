import type { Daret, Membre, Paiement, Tour } from '../types';
import { db, signalerChangement } from './index';
import { VERSION_SCHEMA } from './schema';
import { estDateISO } from '../utils/dates';
import { t } from '../i18n';

export interface Sauvegarde {
  application: 'daret-manager';
  version_schema: number;
  exporte_le: string;
  darets: Daret[];
  membres: Membre[];
  tours: Tour[];
  paiements: Paiement[];
  parametres: { cle: string; valeur: string }[];
}

export async function exporterTout(): Promise<Sauvegarde> {
  const d = await db();
  return {
    application: 'daret-manager',
    version_schema: VERSION_SCHEMA,
    exporte_le: new Date().toISOString(),
    darets: await d.getAllAsync<Daret>('SELECT * FROM darets ORDER BY id'),
    membres: await d.getAllAsync<Membre>('SELECT * FROM membres ORDER BY id'),
    tours: await d.getAllAsync<Tour>('SELECT * FROM tours ORDER BY id'),
    paiements: await d.getAllAsync<Paiement>('SELECT * FROM paiements ORDER BY id'),
    parametres: await d.getAllAsync<{ cle: string; valeur: string }>('SELECT * FROM parametres'),
  };
}

const estEntier = (v: unknown) => Number.isInteger(v);
const estTexte = (v: unknown) => typeof v === 'string';

/** Vérifie la structure et la cohérence d'une sauvegarde ; renvoie la liste des problèmes. */
export function validerSauvegarde(s: unknown): string[] {
  const err: string[] = [];
  if (!s || typeof s !== 'object') return [t('Le fichier n\'est pas une sauvegarde valide.')];
  const x = s as Partial<Sauvegarde>;
  if (x.application !== 'daret-manager') err.push(t('Ce fichier ne provient pas de Daret Manager.'));
  for (const k of ['darets', 'membres', 'tours', 'paiements', 'parametres'] as const) {
    if (!Array.isArray(x[k])) err.push(t('Section « {k} » manquante.', { k }));
  }
  if (err.length) return err;
  if ((x.version_schema ?? 0) > VERSION_SCHEMA) err.push(t('Sauvegarde créée par une version plus récente de l\'application.'));
  const ids = (l: { id: number }[]) => new Set(l.map(e => e.id));
  const darets = ids(x.darets!), membres = ids(x.membres!), tours = ids(x.tours!);
  x.darets!.forEach(d => {
    if (!estEntier(d.id) || !estTexte(d.nom) || !estEntier(d.montant_part) || !estDateISO(d.date_debut)) err.push(t('Daret invalide (id {id}).', { id: d.id }));
  });
  x.membres!.forEach(m => { if (!darets.has(m.daret_id) || !estTexte(m.nom) || !estEntier(m.nb_parts)) err.push(t('Membre invalide (id {id}).', { id: m.id })); });
  x.tours!.forEach(tr => { if (!darets.has(tr.daret_id) || !membres.has(tr.beneficiaire_id) || !estDateISO(tr.date_echeance)) err.push(t('Tour invalide (id {id}).', { id: tr.id })); });
  x.paiements!.forEach(p => { if (!tours.has(p.tour_id) || !membres.has(p.membre_id) || !estEntier(p.montant)) err.push(t('Paiement invalide (id {id}).', { id: p.id })); });
  return err.slice(0, 5);
}

/** Remplace toutes les données par celles de la sauvegarde (transaction : tout ou rien). */
export async function importerTout(s: Sauvegarde): Promise<void> {
  const problemes = validerSauvegarde(s);
  if (problemes.length) throw new Error(problemes.join('\n'));
  const d = await db();
  await d.withTransactionAsync(async () => {
    await d.execAsync('DELETE FROM rappels; DELETE FROM paiements; DELETE FROM tours; DELETE FROM membres; DELETE FROM darets; DELETE FROM parametres;');
    for (const x of s.darets) {
      await d.runAsync(
        'INSERT INTO darets (id, nom, montant_part, frequence, date_debut, jour_echeance, mode_ordre, statut, notes, cree_le, modifie_le) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        x.id, x.nom, x.montant_part, x.frequence, x.date_debut, x.jour_echeance, x.mode_ordre, x.statut, x.notes, x.cree_le, x.modifie_le,
      );
    }
    for (const m of s.membres) {
      await d.runAsync('INSERT INTO membres (id, daret_id, nom, telephone, nb_parts, rang_inscription, notes, cree_le) VALUES (?,?,?,?,?,?,?,?)',
        m.id, m.daret_id, m.nom, m.telephone, m.nb_parts, m.rang_inscription, m.notes, m.cree_le);
    }
    for (const t of s.tours) {
      await d.runAsync('INSERT INTO tours (id, daret_id, numero, beneficiaire_id, date_echeance, remis_le) VALUES (?,?,?,?,?,?)',
        t.id, t.daret_id, t.numero, t.beneficiaire_id, t.date_echeance, t.remis_le);
    }
    for (const p of s.paiements) {
      await d.runAsync('INSERT INTO paiements (id, tour_id, membre_id, montant, date_paiement, mode, cree_le) VALUES (?,?,?,?,?,?,?)',
        p.id, p.tour_id, p.membre_id, p.montant, p.date_paiement, p.mode, p.cree_le);
    }
    for (const p of s.parametres) await d.runAsync('INSERT INTO parametres (cle, valeur) VALUES (?, ?)', p.cle, p.valeur);
  });
  signalerChangement();
}
