import type { Daret, LigneStatut, Membre, Paiement, Tour } from '../types';
import { formatDateLongue, formatDateNum } from './dates';
import { formatDH } from './montant';
import { t, type Langue } from '../i18n';

export const MODELE_WHATSAPP_DEFAUT =
  'Bonjour {nom}, j\'espère que vous allez bien. Petit rappel amical : votre cotisation de {montant} pour la daret « {daret} » était attendue le {date}. Merci d\'avance 🙏';

export const MODELE_WHATSAPP_DARIJA =
  'السلام {nom}، كنتمنى تكون بخير. غير تذكير صغير: المساهمة ديالك ديال {montant} فدارت « {daret} » كانت خاصها تخلص نهار {date}. الله يخليك 🙏';

/** Modèle de relance par défaut selon la langue de l'interface. */
export function modeleWhatsAppDefaut(langue: Langue): string {
  return langue === 'ar' ? MODELE_WHATSAPP_DARIJA : MODELE_WHATSAPP_DEFAUT;
}

/** Remplace les variables {nom}, {montant}, {date}, {daret} du modèle. */
export function remplirModele(modele: string, vars: { nom: string; montant: string; date: string; daret: string }): string {
  return modele
    .replace(/\{nom\}/g, vars.nom)
    .replace(/\{montant\}/g, vars.montant)
    .replace(/\{date\}/g, vars.date)
    .replace(/\{daret\}/g, vars.daret);
}

/**
 * Numéro au format international sans « + » pour wa.me.
 * 06 12 34 56 78 → 212612345678 ; +212 6… ou 00212 6… conservés ; autres numéros laissés tels quels.
 */
export function numeroWhatsApp(tel: string): string | null {
  let n = tel.replace(/[^\d+]/g, '');
  if (!n) return null;
  if (n.startsWith('+')) n = n.slice(1);
  else if (n.startsWith('00')) n = n.slice(2);
  else if (/^0[5-7]\d{8}$/.test(n)) n = '212' + n.slice(1);
  return /^\d{8,15}$/.test(n) ? n : null;
}

export function lienWhatsApp(tel: string | null, message: string): string {
  const num = tel ? numeroWhatsApp(tel) : null;
  const texte = encodeURIComponent(message);
  return num ? `https://wa.me/${num}?text=${texte}` : `https://wa.me/?text=${texte}`;
}

const ICONES: Record<LigneStatut['statut'], string> = { paye: '✅', partiel: '🟠', en_attente: '⏳', en_retard: '🔴' };

/** Récapitulatif d'un tour à partager dans le groupe WhatsApp. */
export function recapitulatifTour(daret: Daret, tour: Tour, beneficiaire: Membre | undefined, lignes: LigneStatut[], nbTours: number): string {
  const payes = lignes.filter(l => l.statut === 'paye');
  const restants = lignes.filter(l => l.statut !== 'paye');
  const collecte = lignes.reduce((s, l) => s + Math.min(l.verse, l.du), 0);
  const attendu = lignes.reduce((s, l) => s + l.du, 0);
  const out = [
    `📋 *${daret.nom}* — ${t('Tour {n}/{total}', { n: tour.numero, total: nbTours })}`,
    `📅 ${t('Échéance : {date}', { date: formatDateLongue(tour.date_echeance) })}`,
    `🎁 ${t('Bénéficiaire : {nom}', { nom: beneficiaire?.nom ?? '—' })}`,
    `💰 ${t('Collecté : {collecte} / {attendu}', { collecte: formatDH(collecte), attendu: formatDH(attendu) })}`,
    '',
    `✅ ${t('Ont payé ({n}) :', { n: payes.length })}`,
    ...(payes.length ? payes.map(l => `   • ${l.membre.nom}`) : ['   —']),
    '',
    `⏳ ${t('Restent à payer ({n}) :', { n: restants.length })}`,
    ...(restants.length
      ? restants.map(l => `   ${ICONES[l.statut]} ${l.membre.nom} — ${t('reste {montant}', { montant: formatDH(l.du - l.verse) })}${l.statut === 'en_retard' ? ` (${t('{n} j de retard', { n: l.joursRetard })})` : ''}`)
      : [`   ${t('Tout le monde a payé')} 🎉`]),
  ];
  if (tour.remis_le) out.push('', `🤝 ${t('Remis au bénéficiaire le {date}', { date: formatDateLongue(tour.remis_le) })}`);
  return out.join('\n');
}

function csvCellule(v: string | number): string {
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const libelleMode = (m: Paiement['mode']): string => (m === 'especes' ? t('Espèces') : m === 'virement' ? t('Virement') : t('Autre'));

/** Historique d'une daret en CSV (séparateur « ; », lisible directement par Excel en français). */
export function historiqueCSV(daret: Daret, tours: Tour[], membres: Membre[], paiements: Paiement[]): string {
  const nomMembre = new Map(membres.map(m => [m.id, m.nom]));
  const tourParId = new Map(tours.map(t => [t.id, t]));
  const lignes: (string | number)[][] = [[t('Tour'), t('Échéance'), t('Bénéficiaire'), t('Membre'), t('Montant (DH)'), t('Date paiement'), t('Mode')]];
  const tries = [...paiements].sort((a, b) => {
    const ta = tourParId.get(a.tour_id)?.numero ?? 0, tb = tourParId.get(b.tour_id)?.numero ?? 0;
    return ta - tb || a.date_paiement.localeCompare(b.date_paiement);
  });
  for (const p of tries) {
    const t = tourParId.get(p.tour_id);
    if (!t) continue;
    lignes.push([
      t.numero, formatDateNum(t.date_echeance), nomMembre.get(t.beneficiaire_id) ?? '',
      nomMembre.get(p.membre_id) ?? '', (p.montant / 100).toFixed(2).replace('.', ','),
      formatDateNum(p.date_paiement), libelleMode(p.mode),
    ]);
  }
  // BOM pour qu'Excel reconnaisse l'UTF-8 (accents)
  return '﻿' + `${t('Daret : {nom}', { nom: csvCellule(daret.nom) })}\n` + lignes.map(l => l.map(csvCellule).join(';')).join('\n') + '\n';
}
