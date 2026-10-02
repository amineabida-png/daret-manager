import { router } from 'expo-router';
import { Ecran, afficherErreur } from '../../components/ui';
import { FormDaret } from '../../components/FormDaret';
import { ajouterMembres, creerDaret, definirOrdre, listerMembres } from '../../db/requetes';
import { ordreInscription } from '../../utils/calendrier';
import { t } from '../../i18n';

export default function NouvelleDaret() {
  return (
    <Ecran>
      <FormDaret libelle={t('Créer la daret')} onValider={async (s, participants, ordre) => {
        try {
          const id = await creerDaret(s);
          if (participants.length) await ajouterMembres(id, participants.map(nom => ({ nom, telephone: null, nb_parts: 1, notes: null })));
          if (participants.length >= 2 && ordre === 'tirage') {
            // Tirage au sort automatique, tour par tour, puis validation du calendrier
            router.replace({ pathname: '/daret/[id]/ordre', params: { id, mode: 'tirage', auto: '1' } });
            return;
          }
          // Ordre de saisie : calendrier généré tout de suite (modifiable tant que la daret n'a pas commencé)
          if (participants.length >= 2) await definirOrdre(id, 'inscription', ordreInscription(await listerMembres(id)));
          router.replace(`/daret/${id}`);
        } catch (e) { afficherErreur(e); }
      }} />
    </Ecran>
  );
}
