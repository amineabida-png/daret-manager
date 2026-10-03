import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ESPACE } from '../components/theme';
import { Carte, Chargement, Ecran, EtatVide, Info, Ligne, Pastille, TexteDoux, afficherErreur, chevron, confirmer, informer } from '../components/ui';
import { listerSauvegardesServeur, messageErreur, restaurerSauvegardeServeur, type SauvegardeServeur } from '../utils/synchro';
import { formatDateLongue } from '../utils/dates';
import { t, tn } from '../i18n';

/** Copies quotidiennes du compte conservées 30 jours sur le serveur, restaurables en un geste. */
export default function SauvegardesEcran() {
  const { c, langue } = useTheme();
  const [liste, setListe] = useState<SauvegardeServeur[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<number | null>(null);

  useEffect(() => { listerSauvegardesServeur().then(setListe).catch(e => setErreur(messageErreur(e))); }, []);

  if (erreur) return <Ecran><EtatVide icone="cloud-offline-outline" titre={t('Sauvegardes indisponibles')} message={erreur} /></Ecran>;
  if (!liste) return <Chargement />;

  const heure = (d: string) => new Date(d).toLocaleTimeString(langue === 'ar' ? 'ar-MA' : 'fr-FR', { hour: '2-digit', minute: '2-digit' });

  async function restaurer(s: SauvegardeServeur) {
    const quand = `${formatDateLongue(s.cree_le.slice(0, 10))} · ${heure(s.cree_le)}`;
    if (!(await confirmer(t('Restaurer cette sauvegarde ?'),
      t('Toutes vos darets reviendront à leur état du {quand}, sur tous vos appareils.\n\nL\'état actuel est gardé dans la liste : vous pourrez revenir en arrière.', { quand }), t('Restaurer'), false))) return;
    setOccupe(s.id);
    try {
      await restaurerSauvegardeServeur(s.id);
      informer(t('Sauvegarde restaurée'), t('Vos darets ont été remises dans leur état du {quand}.', { quand }));
      router.back();
    } catch (e) { afficherErreur(new Error(messageErreur(e))); } finally { setOccupe(null); }
  }

  return (
    <Ecran>
      <Info icone="shield-checkmark-outline">{t('Chaque jour, le serveur garde une copie complète de vos darets pendant 30 jours. Touchez une date pour revenir à cet état.')}</Info>
      {liste.length === 0 ? (
        <EtatVide icone="time-outline" titre={t('Aucune sauvegarde pour le moment')} message={t('La première copie est faite automatiquement dans l\'heure qui suit votre première synchronisation.')} />
      ) : liste.map(s => (
        <Carte key={s.id} onPress={occupe ? undefined : () => restaurer(s)}>
          <Ligne style={{ gap: ESPACE.m }}>
            <Pastille nom={s.type === 'avant_restauration' ? 'arrow-undo-outline' : 'calendar-outline'} couleur={s.type === 'avant_restauration' ? c.or : c.primaire}
              fond={s.type === 'avant_restauration' ? c.orClair : c.primaireClair} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.texte }}>{formatDateLongue(s.cree_le.slice(0, 10))} · {heure(s.cree_le)}</Text>
              <TexteDoux style={{ fontSize: 13 }}>
                {s.type === 'avant_restauration' ? `${t('Avant une restauration')} · ` : ''}{tn(s.nb_darets, '{n} daret', '{n} darets')} · {tn(s.nb_paiements, '{n} paiement', '{n} paiements')}
              </TexteDoux>
            </View>
            {occupe === s.id ? <Ionicons name="sync-outline" size={18} color={c.primaire} /> : <Ionicons name={chevron()} size={18} color={c.texteDoux} />}
          </Ligne>
        </Carte>
      ))}
    </Ecran>
  );
}
