import { Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ESPACE } from '../../../components/theme';
import {
  Avatar, BadgeStatut, Bouton, Carte, Chargement, Ecran, EtatVide, Groupe, Info, Ligne, LigneMenu, Pastille, SousTitre, Statistique, TexteDoux,
  afficherErreur, confirmer,
} from '../../../components/ui';
import { useDonnees } from '../../../components/useDonnees';
import { chargerFicheMembre } from '../../../db/vues';
import { lireParametres, supprimerMembre } from '../../../db/requetes';
import { formatDH } from '../../../utils/montant';
import { formatDateCourte, formatDateLongue } from '../../../utils/dates';
import { libelleMode, lienWhatsApp, remplirModele } from '../../../utils/partage';
import { ouvrirLien } from '../../../utils/fichiers';
import { t, tn } from '../../../i18n';


export default function FicheMembreEcran() {
  const { c } = useTheme();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { data } = useDonnees(() => chargerFicheMembre(id), [id]);
  if (data === undefined) return <Chargement />;
  if (data === null) return <Ecran><EtatVide icone="search-outline" titre={t('Membre introuvable')} message={t('Il a peut-être été retiré de la daret.')} action={t('Retour')} onAction={() => router.back()} /></Ecran>;
  const { membre, detail, retards } = data;

  async function relancer() {
    const { modele_whatsapp } = await lireParametres();
    const resteTotal = retards.reduce((s, r) => s + r.ligne.du - r.ligne.verse, 0);
    const msg = remplirModele(modele_whatsapp, {
      nom: membre.nom, montant: formatDH(resteTotal), daret: detail.daret.nom,
      date: retards.map(r => formatDateLongue(r.tour.date_echeance)).join(', '),
    });
    if (!(await ouvrirLien(lienWhatsApp(membre.telephone, msg)))) afficherErreur(new Error(t('WhatsApp n\'a pas pu être ouvert.')));
  }

  return (
    <Ecran>
      <Stack.Screen options={{ title: t('Fiche membre') }} />
      <View style={{ alignItems: 'center', marginBottom: ESPACE.l }}>
        <Avatar nom={membre.nom} taille={80} />
        <Text style={{ fontSize: 22, fontWeight: '700', color: c.texte, marginTop: ESPACE.m, textAlign: 'center' }}>{membre.nom}</Text>
        <TexteDoux style={{ marginTop: 2 }}>{detail.daret.nom} · {tn(membre.nb_parts, '{n} part', '{n} parts')}</TexteDoux>
        {membre.telephone ? (
          <Ligne style={{ gap: 4, marginTop: 4 }}>
            <Ionicons name="call-outline" size={14} color={c.texteDoux} />
            <TexteDoux>{membre.telephone}</TexteDoux>
          </Ligne>
        ) : null}
      </View>
      {membre.notes ? <Info icone="document-text-outline">{membre.notes}</Info> : null}

      <View style={{ flexDirection: 'row', gap: ESPACE.s, marginBottom: ESPACE.l }}>
        <Statistique titre={t('Total versé')} valeur={formatDH(data.totalVerse)} icone="wallet-outline" couleur={c.primaire} />
        <Statistique titre={t('Dû à ce jour')} valeur={formatDH(data.totalDu)} icone="receipt-outline" couleur={c.info} />
        <Statistique titre={t('Retards')} valeur={String(retards.length)} icone="alert-circle-outline" couleur={retards.length ? c.danger : c.texteDoux} />
      </View>

      {retards.length ? (
        <Carte style={{ borderWidth: 1, borderColor: c.danger + '44' }}>
          <Ligne style={{ gap: ESPACE.m, marginBottom: ESPACE.s }}>
            <Pastille nom="alert-circle" couleur={c.danger} fond={c.dangerClair} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.texte }}>{t('En retard')}</Text>
              <TexteDoux style={{ fontSize: 13 }}>{t('Reste {montant} à régler', { montant: formatDH(retards.reduce((s, r) => s + r.ligne.du - r.ligne.verse, 0)) })}</TexteDoux>
            </View>
          </Ligne>
          {retards.map(({ tour, ligne }) => (
            <Ligne key={tour.id} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
              <TexteDoux>{t('Tour {n}', { n: tour.numero })} · {formatDateCourte(tour.date_echeance)}</TexteDoux>
              <Text style={{ color: c.texte, fontWeight: '600' }}>{formatDH(ligne.du - ligne.verse)} · <Text style={{ color: c.danger }}>{t('{n} j', { n: ligne.joursRetard })}</Text></Text>
            </Ligne>
          ))}
          <Bouton titre={t('Relancer sur WhatsApp')} icone="logo-whatsapp" variante="whatsapp" petit onPress={() => relancer().catch(afficherErreur)} style={{ marginTop: ESPACE.m }} />
        </Carte>
      ) : null}

      <SousTitre style={{ marginTop: ESPACE.s }}>{t('Tours reçus')}</SousTitre>
      {data.toursRecus.length ? data.toursRecus.map(tr => (
        <Carte key={tr.id} onPress={() => router.push(`/daret/${detail.daret.id}/tour/${tr.id}`)}>
          <Ligne style={{ gap: ESPACE.m }}>
            <Pastille nom={tr.remis_le ? 'checkmark-done' : 'gift-outline'} couleur={tr.remis_le ? c.primaire : c.or} fond={tr.remis_le ? c.primaireClair : c.orClair} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.texte }}>{t('Tour {n}', { n: tr.numero })} · {formatDateCourte(tr.date_echeance)}</Text>
              <TexteDoux style={{ fontSize: 13 }}>{tr.remis_le ? t('Remis le {date}', { date: formatDateLongue(tr.remis_le) }) : t('À recevoir')}</TexteDoux>
            </View>
            <Text style={{ fontWeight: '700', color: tr.remis_le ? c.primaire : c.texte }}>{formatDH(detail.montantTour)}</Text>
          </Ligne>
        </Carte>
      )) : <Info icone="calendar-outline">{t('Calendrier pas encore généré.')}</Info>}

      <SousTitre style={{ marginTop: ESPACE.s }}>{t('Paiements')}</SousTitre>
      {data.paiements.length ? (
        <Carte style={{ padding: 0, overflow: 'hidden' }}>
          {data.paiements.map((p, i) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACE.m, paddingHorizontal: ESPACE.l, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.bordure }}>
              <Ionicons name={p.mode === 'virement' ? 'card-outline' : 'cash-outline'} size={20} color={c.texteDoux} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: c.texte }}>{t('Tour {n}', { n: p.tour.numero })}</Text>
                <TexteDoux style={{ fontSize: 13 }}>{formatDateLongue(p.date_paiement)} · {libelleMode(p.mode)}</TexteDoux>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: c.primaire }}>+{formatDH(p.montant)}</Text>
            </View>
          ))}
        </Carte>
      ) : <Info icone="receipt-outline">{t('Aucun paiement enregistré.')}</Info>}

      {detail.tours.length ? (
        <>
          <SousTitre style={{ marginTop: ESPACE.s }}>{t('Statut par tour')}</SousTitre>
          <Carte style={{ paddingVertical: ESPACE.s }}>
            {detail.tours.map(tr => {
              const l = detail.statuts.get(tr.id)?.find(x => x.membre.id === membre.id);
              return l ? (
                <Ligne key={tr.id} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
                  <TexteDoux>{t('Tour {n}', { n: tr.numero })} · {formatDateCourte(tr.date_echeance)}</TexteDoux>
                  <BadgeStatut statut={l.statut} complement={l.statut === 'partiel' || (l.statut === 'en_retard' && l.verse) ? formatDH(l.verse) : undefined} />
                </Ligne>
              ) : null;
            })}
          </Carte>
        </>
      ) : null}

      <SousTitre style={{ marginTop: ESPACE.s }}>{t('Gérer')}</SousTitre>
      <Groupe>
        <LigneMenu icone="create-outline" titre={t('Modifier le membre')} sousTitre={t('Nom, téléphone, parts, notes')} onPress={() => router.push(`/membre/${membre.id}/modifier`)} />
        {!detail.commencee ? (
          <LigneMenu icone="person-remove-outline" titre={t('Retirer de la daret')} couleur={c.danger} onPress={async () => {
            if (!(await confirmer(t('Retirer ce membre ?'), t('{nom} sera retiré de « {daret} ». Le calendrier devra être régénéré.', { nom: membre.nom, daret: detail.daret.nom }), t('Retirer')))) return;
            try { await supprimerMembre(membre.id); router.back(); } catch (e) { afficherErreur(e); }
          }} />
        ) : null}
      </Groupe>
      {detail.commencee ? <Info icone="lock-closed-outline">{t('La daret a commencé : ce membre ne peut plus être retiré.')}</Info> : null}
    </Ecran>
  );
}
