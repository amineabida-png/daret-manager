import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Linking, Share } from 'react-native';
import { exporterTout, type Sauvegarde } from '../db/sauvegarde';
import { listerMembres, listerPaiementsDaret, listerTours, getDaret } from '../db/requetes';
import { historiqueCSV } from './partage';
import { aujourdhui } from './dates';
import { t } from '../i18n';

function nomFichier(base: string, ext: string): string {
  return `${base.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}-${aujourdhui()}.${ext}`;
}

async function partagerFichier(nom: string, contenu: string, mimeType: string, titre: string): Promise<void> {
  const f = new File(Paths.cache, nom);
  if (f.exists) f.delete();
  f.create();
  f.write(contenu);
  if (!(await Sharing.isAvailableAsync())) throw new Error(t('Le partage de fichiers n\'est pas disponible sur cet appareil.'));
  await Sharing.shareAsync(f.uri, { mimeType, dialogTitle: titre, UTI: mimeType === 'application/json' ? 'public.json' : 'public.comma-separated-values-text' });
}

/** Exporte toutes les données en JSON via le menu de partage Android. */
export async function exporterJSON(): Promise<void> {
  const s = await exporterTout();
  await partagerFichier(nomFichier('daret-manager-sauvegarde', 'json'), JSON.stringify(s, null, 2), 'application/json', 'Sauvegarde Daret Manager');
}

/** Exporte l'historique des paiements d'une daret en CSV. */
export async function exporterCSV(daretId: number): Promise<void> {
  const daret = await getDaret(daretId);
  if (!daret) return;
  const [tours, membres, paiements] = await Promise.all([listerTours(daretId), listerMembres(daretId), listerPaiementsDaret(daretId)]);
  await partagerFichier(nomFichier(daret.nom, 'csv'), historiqueCSV(daret, tours, membres, paiements), 'text/csv', `Historique — ${daret.nom}`);
}

/** Ouvre le sélecteur de fichiers et lit une sauvegarde JSON (null si annulé). */
export async function choisirSauvegarde(): Promise<Sauvegarde | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
  if (r.canceled || !r.assets?.length) return null;
  const texte = await new File(r.assets[0].uri).text();
  try {
    return JSON.parse(texte) as Sauvegarde;
  } catch {
    throw new Error(t('Ce fichier n\'est pas un JSON valide.'));
  }
}

/** Partage un texte (récapitulatif) via le menu Android : WhatsApp, SMS, etc. */
export async function partagerTexte(message: string): Promise<void> {
  await Share.share({ message });
}

/** Ouvre WhatsApp (lien wa.me) ; renvoie false si aucune application ne peut l'ouvrir. */
export async function ouvrirLien(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
