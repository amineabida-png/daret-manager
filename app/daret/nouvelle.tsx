import { router } from 'expo-router';
import { Ecran, afficherErreur } from '../../components/ui';
import { FormDaret } from '../../components/FormDaret';
import { creerDaret } from '../../db/requetes';
import { t } from '../../i18n';

export default function NouvelleDaret() {
  return (
    <Ecran>
      <FormDaret libelle={t('Créer la daret')} onValider={async s => {
        try {
          const id = await creerDaret(s);
          router.replace(`/daret/${id}`);
        } catch (e) { afficherErreur(e); }
      }} />
    </Ecran>
  );
}
