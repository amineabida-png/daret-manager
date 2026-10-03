import { t } from '../i18n';

/**
 * Navigateur : ouvre le reçu dans un nouvel onglet et lance l'impression
 * (choisir « Enregistrer en PDF » ou l'imprimante).
 */
export async function envoyerRecuPDF(html: string, _nomFichier: string, fenetre?: Window | null): Promise<void> {
  const w = fenetre ?? window.open('', '_blank');
  if (!w) throw new Error(t('Autorisez les fenêtres pop-up pour afficher le reçu.'));
  w.document.open();
  w.document.write(html.replace('</body>', '<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body>'));
  w.document.close();
}
