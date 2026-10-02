import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ESPACE } from '../../components/theme';
import { Bouton, Carte, Chargement, Ecran, EtatVide, Ligne, Pastille, Segment, TexteDoux, chevron, type NomIcone } from '../../components/ui';
import { useDonnees } from '../../components/useDonnees';
import { listerDarets } from '../../db/requetes';
import { formatDH } from '../../utils/montant';
import { formatDateLongue } from '../../utils/dates';
import type { StatutDaret } from '../../types';
import { t } from '../../i18n';

const FREQ = () => ({ hebdomadaire: t('Hebdomadaire'), bimensuelle: t('Tous les 15 jours'), mensuelle: t('Mensuelle') });
const STATUT = (): Record<StatutDaret, string> => ({ en_cours: t('En cours'), terminee: t('Terminées'), archivee: t('Archivées') });
const ICONE: Record<StatutDaret, NomIcone> = { en_cours: 'wallet-outline', terminee: 'trophy-outline', archivee: 'archive-outline' };

export default function MesDarets() {
  const { c } = useTheme();
  const [filtre, setFiltre] = useState<StatutDaret>('en_cours');
  const { data } = useDonnees(listerDarets);
  if (!data) return <Chargement />;
  const liste = data.filter(d => d.statut === filtre);

  return (
    <Ecran>
      <Segment
        valeur={filtre} onChange={setFiltre}
        options={(['en_cours', 'terminee', 'archivee'] as const).map(s => ({ valeur: s, libelle: `${STATUT()[s]} · ${data.filter(d => d.statut === s).length}` }))}
      />
      {liste.length === 0 ? (
        <EtatVide
          icone={filtre === 'en_cours' ? 'file-tray-outline' : filtre === 'terminee' ? 'trophy-outline' : 'archive-outline'}
          titre={filtre === 'en_cours' ? t('Aucune daret en cours') : filtre === 'terminee' ? t('Aucune daret terminée') : t('Aucune daret archivée')}
          message={filtre === 'en_cours'
            ? t('Une daret réunit des membres qui cotisent le même montant à chaque échéance ; à chaque tour, l\'un d\'eux reçoit la cagnotte.')
            : filtre === 'terminee' ? t('Une daret passe automatiquement en « terminée » quand tous les tours ont été remis.') : t('Archivez une daret terminée pour la ranger ici.')}
          action={filtre === 'en_cours' ? t('Créer une daret') : undefined}
          onAction={filtre === 'en_cours' ? () => router.push('/daret/nouvelle') : undefined}
        />
      ) : (
        <>
          {liste.map(d => (
            <Carte key={d.id} onPress={() => router.push(`/daret/${d.id}`)}>
              <Ligne style={{ gap: ESPACE.m }}>
                <Pastille nom={ICONE[d.statut]} couleur={d.statut === 'en_cours' ? c.primaire : c.texteDoux} fond={d.statut === 'en_cours' ? c.primaireClair : c.surface2} taille={44} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: c.texte }} numberOfLines={1}>{d.nom}</Text>
                  <TexteDoux style={{ fontSize: 13 }}>{FREQ()[d.frequence]} · {t('depuis le {date}', { date: formatDateLongue(d.date_debut) })}</TexteDoux>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: c.primaire }}>{formatDH(d.montant_part)}</Text>
                  <TexteDoux style={{ fontSize: 12 }}>{t('par part')}</TexteDoux>
                </View>
                <Ionicons name={chevron()} size={18} color={c.texteDoux} />
              </Ligne>
            </Carte>
          ))}
        </>
      )}
      {filtre === 'en_cours' && liste.length > 0 ? (
        <Bouton titre={t('Nouvelle daret')} icone="add" onPress={() => router.push('/daret/nouvelle')} style={{ marginTop: ESPACE.s }} />
      ) : null}
    </Ecran>
  );
}
