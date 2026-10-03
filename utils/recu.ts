/**
 * Reçu de cotisation : document HTML (converti en PDF) remis à un membre après son paiement.
 */
import type { Daret, LigneStatut, Paiement, Tour } from '../types';
import { formatDH } from './montant';
import { aujourdhui, formatDateLongue } from './dates';
import { libelleMode } from './partage';
import { estRTL, t } from '../i18n';

export interface DonneesRecu {
  daret: Daret;
  tour: Tour;
  nbTours: number;
  ligne: LigneStatut;
  paiements: Paiement[];
  beneficiaire: string;
}

const echapper = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export const numeroRecu = (d: DonneesRecu) => `R-${d.daret.id}-${d.tour.numero}-${d.ligne.membre.id}`;

export function nomFichierRecu(d: DonneesRecu): string {
  const nom = d.ligne.membre.nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'membre';
  return `recu-${numeroRecu(d)}-${nom}`.toLowerCase();
}

/** Statut affiché sur le reçu. */
function statut(d: DonneesRecu): { texte: string; couleur: string } {
  if (d.ligne.verse >= d.ligne.du) return { texte: t('Payé intégralement'), couleur: '#1B7F5A' };
  return { texte: t('Paiement partiel — reste {montant}', { montant: formatDH(d.ligne.du - d.ligne.verse) }), couleur: '#B35A00' };
}

export function recuHTML(d: DonneesRecu): string {
  const s = statut(d);
  const lignes = d.paiements
    .slice().sort((a, b) => a.date_paiement.localeCompare(b.date_paiement))
    .map(p => `<tr><td>${formatDateLongue(p.date_paiement)}</td><td>${echapper(libelleMode(p.mode))}</td><td class="m">${formatDH(p.montant)}</td></tr>`).join('');
  return `<!doctype html><html dir="${estRTL() ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${echapper(t('Reçu de cotisation'))}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @page { size: A5; margin: 12mm; }
  body { font-family: 'Segoe UI', Roboto, Tahoma, Arial, sans-serif; color: #102019; margin: 0; padding: 16px; }
  .carte { max-width: 520px; margin: 0 auto; border: 1px solid #DDE5E0; border-radius: 16px; overflow: hidden; }
  .entete { background: #145F43; color: #fff; padding: 20px 24px; }
  .entete .app { color: #E6BE45; font-weight: 700; letter-spacing: 1px; font-size: 12px; }
  .entete h1 { margin: 6px 0 2px; font-size: 22px; }
  .entete .num { opacity: .8; font-size: 13px; }
  .corps { padding: 20px 24px; }
  .montant { text-align: center; margin: 4px 0 18px; }
  .montant .v { font-size: 30px; font-weight: 800; }
  .montant .s { display: inline-block; margin-top: 6px; padding: 4px 12px; border-radius: 99px; font-weight: 700; font-size: 13px; color: #fff; background: ${s.couleur}; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .infos td { padding: 6px 0; border-bottom: 1px solid #EEF2F0; }
  .infos td:first-child { color: #617069; width: 45%; }
  .infos td:last-child { font-weight: 600; }
  h2 { font-size: 13px; letter-spacing: .8px; color: #617069; text-transform: uppercase; margin: 20px 0 6px; }
  .detail th { text-align: start; color: #617069; font-weight: 600; font-size: 12px; padding-bottom: 4px; }
  .detail td { padding: 5px 0; border-top: 1px solid #EEF2F0; }
  .m { text-align: end; font-weight: 700; }
  .detail th.m { text-align: end; }
  .pied { text-align: center; color: #617069; font-size: 11px; padding: 14px 24px 18px; border-top: 1px dashed #DDE5E0; }
</style></head><body><div class="carte">
  <div class="entete"><div class="app">DARET MANAGER</div><h1>${echapper(t('Reçu de cotisation'))}</h1>
    <div class="num">${echapper(t('N° {numero}', { numero: numeroRecu(d) }))} · ${echapper(t('émis le {date}', { date: formatDateLongue(aujourdhui()) }))}</div></div>
  <div class="corps">
    <div class="montant"><div class="v">${formatDH(d.ligne.verse)}</div><div class="s">${echapper(s.texte)}</div></div>
    <table class="infos">
      <tr><td>${echapper(t('Membre'))}</td><td>${echapper(d.ligne.membre.nom)}${d.ligne.membre.nb_parts > 1 ? ` (${echapper(t('{n} parts', { n: d.ligne.membre.nb_parts }))})` : ''}</td></tr>
      <tr><td>${echapper(t('Daret'))}</td><td>${echapper(d.daret.nom)}</td></tr>
      <tr><td>${echapper(t('Tour'))}</td><td>${echapper(t('Tour {n}/{total}', { n: d.tour.numero, total: d.nbTours }))}</td></tr>
      <tr><td>${echapper(t('Échéance'))}</td><td>${formatDateLongue(d.tour.date_echeance)}</td></tr>
      <tr><td>${echapper(t('Bénéficiaire'))}</td><td>${echapper(d.beneficiaire)}</td></tr>
      <tr><td>${echapper(t('Montant dû'))}</td><td>${formatDH(d.ligne.du)}</td></tr>
    </table>
    <h2>${echapper(t('Détail des versements'))}</h2>
    <table class="detail"><tr><th>${echapper(t('Date'))}</th><th>${echapper(t('Mode'))}</th><th class="m">${echapper(t('Montant'))}</th></tr>${lignes}</table>
  </div>
  <div class="pied">${echapper(t('Reçu généré par Daret Manager · darete.up.railway.app'))}</div>
</div></body></html>`;
}

/** Version texte, pour un message WhatsApp. */
export function recuTexte(d: DonneesRecu): string {
  return [
    `🧾 *${t('Reçu de cotisation')}* — ${numeroRecu(d)}`,
    `${t('Membre')} : ${d.ligne.membre.nom}`,
    `${t('Daret')} : ${d.daret.nom} · ${t('Tour {n}/{total}', { n: d.tour.numero, total: d.nbTours })}`,
    `${t('Montant versé')} : ${formatDH(d.ligne.verse)} / ${formatDH(d.ligne.du)}`,
    `✅ ${statut(d).texte}`,
  ].join('\n');
}
