import { router, useLocalSearchParams } from 'expo-router';
import { Chargement, Ecran, afficherErreur } from '../../../components/ui';
import { FormDaret } from '../../../components/FormDaret';
import { useDonnees } from '../../../components/useDonnees';
import { getDaret, modifierDaret } from '../../../db/requetes';
import { t } from '../../../i18n';

export default function ModifierDaret() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { data } = useDonnees(() => getDaret(id), [id]);
  if (!data) return <Chargement />;
  return (
    <Ecran>
      <FormDaret initial={data} libelle={t('Enregistrer')} onValider={async s => {
        try {
          await modifierDaret(id, s);
          router.back();
        } catch (e) { afficherErreur(e); }
      }} />
    </Ecran>
  );
}
