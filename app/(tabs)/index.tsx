import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ESPACE } from '../../components/theme';
import {
  Avatar, Bandeau, BarreProgression, Bouton, Carte, Chargement, Ecran, EtatVide, Ligne, Pastille, SousTitre, Statistique, TexteDoux, chevron,
} from '../../components/ui';
import { useDonnees } from '../../components/useDonnees';
import { chargerTableauBord } from '../../db/vues';
import { formatDH } from '../../utils/montant';
import { aujourdhui, formatDateCourte, formatDateLongue } from '../../utils/dates';
import { t } from '../../i18n';

export default function Accueil() {
  const { c } = useTheme();
  const { data } = useDonnees(chargerTableauBord);
  if (!data) return <Chargement />;

  if (!data.cartes.length) {
    return (
      <Ecran>
        <EtatVide icone="people-circle-outline" titre={t('Bienvenue dans Daret Manager')}
          message={t('Créez votre première daret pour suivre les cotisations, les tours et les retards.\n\nVous pouvez aussi charger une daret de démonstration depuis les Paramètres.')}
          action={t('Créer une daret')} onAction={() => router.push('/daret/nouvelle')} />
      </Ecran>
    );
  }

  const taux = data.totalAttendu > 0 ? Math.min(100, Math.round((data.totalCollecte / data.totalAttendu) * 100)) : 0;

  return (
    <Ecran>
      <Bandeau>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700', letterSpacing: 0.8 }}>{formatDateLongue(aujourdhui()).toLocaleUpperCase()}</Text>
        <Text style={{ color: '#FFF', fontSize: 14, marginTop: ESPACE.m, opacity: 0.9 }}>{t('Collecté sur les tours en cours')}</Text>
        <Text style={{ color: '#FFF', fontSize: 32, fontWeight: '700', letterSpacing: -0.5, marginTop: 2 }} adjustsFontSizeToFit numberOfLines={1}>{formatDH(data.totalCollecte)}</Text>
        <BarreProgression valeur={data.totalCollecte} max={data.totalAttendu} couleur="#E6BE45" fond="rgba(255,255,255,0.18)" hauteur={6} />
        <Ligne style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>{t('sur {montant} attendus', { montant: formatDH(data.totalAttendu) })}</Text>
          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>{taux} %</Text>
        </Ligne>
      </Bandeau>

      <View style={{ flexDirection: 'row', gap: ESPACE.s, marginBottom: ESPACE.l }}>
        <Statistique titre={t('Darets actives')} valeur={String(data.cartes.length)} icone="albums-outline" couleur={c.primaire} />
        <Statistique titre={t('Reste à collecter')} valeur={formatDH(Math.max(0, data.totalAttendu - data.totalCollecte))} icone="hourglass-outline" couleur={c.or} />
        <Statistique titre={t('En retard')} valeur={String(data.membresEnRetard)} icone="alert-circle-outline" couleur={data.membresEnRetard ? c.danger : c.texteDoux} />
      </View>

      <SousTitre action={t('Tout voir')} onAction={() => router.push('/darets')}>{t('Tours en cours')}</SousTitre>
      {data.cartes.map(({ detail, collecte, attendu, beneficiaire }) => {
        const tc = detail.courant;
        const complet = collecte >= attendu && attendu > 0;
        return (
          <Carte key={detail.daret.id} onPress={() => router.push(`/daret/${detail.daret.id}`)}>
            <Ligne style={{ gap: ESPACE.m }}>
              <Pastille nom="wallet-outline" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: c.texte }} numberOfLines={1}>{detail.daret.nom}</Text>
                <TexteDoux style={{ fontSize: 13 }}>
                  {tc ? t('Tour {n} sur {total} · échéance {date}', { n: tc.numero, total: detail.tours.length, date: formatDateCourte(tc.date_echeance) }) : t('Calendrier à préparer')}
                </TexteDoux>
              </View>
              <Ionicons name={chevron()} size={18} color={c.texteDoux} />
            </Ligne>
            {tc ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACE.s, marginTop: ESPACE.m, padding: ESPACE.s, borderRadius: 12, backgroundColor: c.surface2 }}>
                  <Avatar nom={beneficiaire?.nom ?? '?'} taille={32} />
                  <View style={{ flex: 1 }}>
                    <TexteDoux style={{ fontSize: 12, lineHeight: 16 }}>{t('Bénéficiaire')}</TexteDoux>
                    <Text style={{ fontWeight: '700', color: c.texte }}>{beneficiaire?.nom ?? '—'}</Text>
                  </View>
                  <Ionicons name="gift-outline" size={20} color={c.or} />
                </View>
                <BarreProgression valeur={collecte} max={attendu} />
                <Ligne style={{ justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '700', color: complet ? c.primaire : c.texte, fontSize: 15 }}>{formatDH(collecte)}</Text>
                  <TexteDoux style={{ fontSize: 13 }}>{t('sur {montant}', { montant: formatDH(attendu) })}</TexteDoux>
                </Ligne>
              </>
            ) : (
              <Ligne style={{ marginTop: ESPACE.m, gap: 6 }}>
                <Ionicons name={detail.membres.length < 2 ? 'person-add-outline' : 'shuffle'} size={16} color={c.or} />
                <Text style={{ color: c.texte, fontSize: 14 }}>
                  {detail.membres.length < 2 ? t('Ajoutez au moins 2 membres') : t('Définissez l\'ordre des tours')}
                </Text>
              </Ligne>
            )}
          </Carte>
        );
      })}

      <SousTitre style={{ marginTop: ESPACE.m }}>{t('Retards')}</SousTitre>
      {data.retards.length === 0 ? (
        <Carte>
          <Ligne style={{ gap: ESPACE.m }}>
            <Pastille nom="checkmark-done" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, color: c.texte, fontWeight: '700' }}>{t('Aucun retard')}</Text>
              <TexteDoux style={{ fontSize: 13 }}>{t('Toutes les cotisations échues sont réglées.')}</TexteDoux>
            </View>
          </Ligne>
        </Carte>
      ) : data.retards.map(({ daret, tour, ligne }) => (
        <Carte key={`${tour.id}-${ligne.membre.id}`} onPress={() => router.push(`/daret/${daret.id}/tour/${tour.id}`)}>
          <Ligne style={{ gap: ESPACE.m }}>
            <Avatar nom={ligne.membre.nom} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.texte }} numberOfLines={1}>{ligne.membre.nom}</Text>
              <TexteDoux style={{ fontSize: 13 }} numberOfLines={1}>{daret.nom} · {t('tour {n}', { n: tour.numero })} ({formatDateCourte(tour.date_echeance)})</TexteDoux>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontWeight: '700', color: c.texte }}>{formatDH(ligne.du - ligne.verse)}</Text>
              <View style={{ marginTop: 3, backgroundColor: c.statut.en_retard.fond, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: c.statut.en_retard.texte, fontWeight: '700', fontSize: 12 }}>{t('{n} j de retard', { n: ligne.joursRetard })}</Text>
              </View>
            </View>
          </Ligne>
        </Carte>
      ))}

      <Bouton titre={t('Nouvelle daret')} icone="add" onPress={() => router.push('/daret/nouvelle')} style={{ marginTop: ESPACE.m }} />
    </Ecran>
  );
}
