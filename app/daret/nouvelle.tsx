import { router } from 'expo-router';
import { Ecran, afficherErreur } from '../../components/ui';
import { FormDaret } from '../../components/FormDaret';
import { ajouterMembres, creerDaret, definirOrdre, listerMembres } from '../../db/requetes';
import { ordreInscription } from '../../utils/calendrier';
import { t } from '../../i18n';

export default function NouvelleDaret() {
  return (
    <Ecran>
      <FormDaret libelle={t('Créer la daret')} onValider={async (s, participants) => {
        try {
          const id = await creerDaret(s);
          if (participants.length) {
            await ajouterMembres(id, participants.map(nom => ({ nom, telephone: null, nb_parts: 1, notes: null })));
            // Calendrier généré tout de suite dans l'ordre saisi (modifiable tant que la daret n'a pas commencé)
            if (participants.length >= 2) await definirOrdre(id, 'inscription', ordreInscription(await listerMembres(id)));
          }
          router.replace(`/daret/${id}`);
        } catch (e) { afficherErreur(e); }
      }} />
    </Ecran>
  );
}
