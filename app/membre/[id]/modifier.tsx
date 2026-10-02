import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Bouton, Champ, Chargement, Compteur, Ecran, Info, afficherErreur } from '../../../components/ui';
import { useDonnees } from '../../../components/useDonnees';
import { estCommencee, getMembre, modifierMembre } from '../../../db/requetes';
import { ESPACE } from '../../../components/theme';
import { t } from '../../../i18n';

export default function ModifierMembre() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { data } = useDonnees(async () => {
    const m = await getMembre(id);
    return m ? { m, commencee: await estCommencee(m.daret_id) } : null;
  }, [id]);
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [parts, setParts] = useState(1);
  const [notes, setNotes] = useState('');
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (data?.m) { setNom(data.m.nom); setTelephone(data.m.telephone ?? ''); setParts(data.m.nb_parts); setNotes(data.m.notes ?? ''); }
  }, [data]);

  if (!data) return <Chargement />;
  return (
    <Ecran>
      <Champ label={t('Nom')} value={nom} onChangeText={setNom} autoCapitalize="words" erreur={!nom.trim() ? t('Le nom est obligatoire') : null} />
      <Champ label={t('Téléphone (facultatif)')} value={telephone} onChangeText={setTelephone} keyboardType="phone-pad" />
      {data.commencee ? (
        <Info icone="lock-closed-outline">{t('Nombre de parts : {n} (la daret a commencé, il ne peut plus changer).', { n: parts })}</Info>
      ) : (
        <Compteur label={t('Nombre de parts')} valeur={parts} min={1} max={10} onChange={setParts} />
      )}
      <Champ label={t('Notes (facultatif)')} value={notes} onChangeText={setNotes} multiline />
      {!data.commencee && parts !== data.m.nb_parts ? (
        <Info icone="warning-outline" ton="alerte">{t('Changer le nombre de parts effacera le calendrier : il faudra redéfinir l\'ordre des tours.')}</Info>
      ) : null}
      <Bouton titre={t('Enregistrer')} icone="checkmark" chargement={envoi} desactive={!nom.trim()} onPress={async () => {
        setEnvoi(true);
        try {
          await modifierMembre(id, { nom, telephone: telephone || null, nb_parts: parts, notes: notes.trim() || null });
          router.back();
        } catch (e) { afficherErreur(e); } finally { setEnvoi(false); }
      }} />
    </Ecran>
  );
}
