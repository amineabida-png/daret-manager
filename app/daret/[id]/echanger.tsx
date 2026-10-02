import { useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme, ESPACE } from '../../../components/theme';
import { Avatar, Bouton, Carte, Chargement, Ecran, EtatVide, Info, Ligne, TexteDoux, afficherErreur, confirmer } from '../../../components/ui';
import { useDonnees } from '../../../components/useDonnees';
import { chargerDetailDaret } from '../../../db/vues';
import { echangerDeuxTours } from '../../../db/requetes';
import { formatDateCourte } from '../../../utils/dates';
import { t } from '../../../i18n';

export default function Echanger() {
  const { c } = useTheme();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { data } = useDonnees(() => chargerDetailDaret(id), [id]);
  const [choix, setChoix] = useState<number[]>([]);
  if (!data) return <Chargement />;
  if (!data.tours.length) return <Ecran><EtatVide icone="calendar-outline" titre={t('Pas encore de calendrier')} message={t('Définissez d\'abord l\'ordre des tours.')} action={t('Définir l\'ordre')} onAction={() => router.replace(`/daret/${id}/ordre`)} /></Ecran>;

  const nom = (mid: number) => data.membres.find(m => m.id === mid)?.nom ?? '—';
  const basculer = (tid: number) => setChoix(cs => cs.includes(tid) ? cs.filter(x => x !== tid) : cs.length < 2 ? [...cs, tid] : [cs[1], tid]);
  const [a, b] = choix.map(tid => data.tours.find(x => x.id === tid)!);

  return (
    <Ecran>
      <Info icone="swap-vertical">{t('Sélectionnez deux tours : leurs bénéficiaires seront inversés, les dates restent les mêmes. Les tours déjà remis ne peuvent pas être échangés.')}</Info>
      {data.tours.map(tr => {
        const sel = choix.includes(tr.id);
        return (
          <Carte key={tr.id} onPress={tr.remis_le ? undefined : () => basculer(tr.id)}
            style={[sel && { borderColor: c.primaire, borderWidth: 2 }, tr.remis_le ? { opacity: 0.45 } : null]}>
            <Ligne style={{ gap: ESPACE.m }}>
              <Ionicons name={sel ? 'checkmark-circle' : tr.remis_le ? 'lock-closed-outline' : 'ellipse-outline'} size={24} color={sel ? c.primaire : c.texteDoux} />
              <Avatar nom={nom(tr.beneficiaire_id)} taille={36} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: c.texte }} numberOfLines={1}>{nom(tr.beneficiaire_id)}</Text>
                <TexteDoux style={{ fontSize: 13 }}>{t('Tour {n}', { n: tr.numero })} · {tr.remis_le ? t('déjà remis') : formatDateCourte(tr.date_echeance)}</TexteDoux>
              </View>
            </Ligne>
          </Carte>
        );
      })}
      <View style={{ marginTop: ESPACE.m }}>
        <Bouton titre={t('Échanger')} icone="swap-vertical" desactive={choix.length !== 2} onPress={async () => {
          if (!a || !b) return;
          if (!(await confirmer(t('Échanger ces deux tours ?'), `${t('Tour {n}', { n: a.numero })} → ${nom(b.beneficiaire_id)}\n${t('Tour {n}', { n: b.numero })} → ${nom(a.beneficiaire_id)}`, t('Échanger'), false))) return;
          try { await echangerDeuxTours(a.id, b.id); router.back(); } catch (e) { afficherErreur(e); }
        }} />
      </View>
    </Ecran>
  );
}
