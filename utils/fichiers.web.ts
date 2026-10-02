/**
 * Version navigateur des exports et du partage :
 * téléchargement direct des fichiers, partage natif du téléphone si disponible, sinon copie.
 */
import { exporterTout, type Sauvegarde } from '../db/sauvegarde';
import { listerMembres, listerPaiementsDaret, listerTours, getDaret } from '../db/requetes';
import { historiqueCSV } from './partage';
import { aujourdhui } from './dates';
import { t } from '../i18n';

function nomFichier(base: string, ext: string): string {
  return `${base.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'daret'}-${aujourdhui()}.${ext}`;
}

async function telecharger(nom: string, contenu: string, mimeType: string): Promise<void> {
  const fichier = new Blob([contenu], { type: `${mimeType};charset=utf-8` });
  // Sur téléphone, le menu de partage permet d'envoyer directement vers WhatsApp, Drive…
  const f = typeof File !== 'undefined' ? new File([fichier], nom, { type: mimeType }) : null;
  if (f && navigator.canShare?.({ files: [f] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [f], title: nom }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(fichier);
  const a = document.createElement('a');
  a.href = url; a.download = nom;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function exporterJSON(): Promise<void> {
  const s = await exporterTout();
  await telecharger(nomFichier('daret-manager-sauvegarde', 'json'), JSON.stringify(s, null, 2), 'application/json');
}

export async function exporterCSV(daretId: number): Promise<void> {
  const daret = await getDaret(daretId);
  if (!daret) return;
  const [tours, membres, paiements] = await Promise.all([listerTours(daretId), listerMembres(daretId), listerPaiementsDaret(daretId)]);
  await telecharger(nomFichier(daret.nom, 'csv'), historiqueCSV(daret, tours, membres, paiements), 'text/csv');
}

export function choisirSauvegarde(): Promise<Sauvegarde | null> {
  return new Promise((ok, ko) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json,text/plain';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return ok(null);
      try { ok(JSON.parse(await f.text()) as Sauvegarde); } catch { ko(new Error(t('Ce fichier n\'est pas un JSON valide.'))); }
    };
    input.click();
  });
}

export async function partagerTexte(message: string): Promise<void> {
  if (navigator.share) {
    try { await navigator.share({ text: message }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
  }
  // Ordinateur : ouverture de WhatsApp Web avec le texte prêt à envoyer
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

export async function ouvrirLien(url: string): Promise<boolean> {
  window.open(url, '_blank', 'noopener');
  return true;
}
