import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { t } from '../i18n';

/** Téléphone : convertit le reçu en PDF puis ouvre le menu de partage (WhatsApp, e-mail…). */
export async function envoyerRecuPDF(html: string, nomFichier: string, _fenetre?: unknown): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html, width: 420, height: 595 });
  // Renomme le fichier pour que le destinataire voie un nom explicite
  let cible = new File(uri);
  try {
    const renomme = new File(Paths.cache, `${nomFichier}.pdf`);
    if (renomme.exists) renomme.delete();
    cible.move(renomme);
    cible = renomme;
  } catch { /* garde le nom généré */ }
  if (!(await Sharing.isAvailableAsync())) throw new Error(t('Le partage de fichiers n\'est pas disponible sur cet appareil.'));
  await Sharing.shareAsync(cible.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: t('Reçu de cotisation') });
}
