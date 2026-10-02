import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ESPACE } from '../../../../components/theme';
import {
  Avatar, BadgeStatut, Bandeau, BarreProgression, Bouton, Carte, Champ, ChampDate, Chargement, Ecran, EtatVide, Info, Ligne, Pastille, Segment, SousTitre, TexteDoux,
  afficherErreur, confirmer, LARGEUR_MAX,
} from '../../../../components/ui';
import { useDonnees } from '../../../../components/useDonnees';
import { chargerDetailDaret } from '../../../../db/vues';
import { ajouterPaiement, annulerPaiements, lireParametres, marquerRemis, payerReste } from '../../../../db/requetes';
import { formatDH, parseDH } from '../../../../utils/montant';
import { aujourdhui, formatDateLongue } from '../../../../utils/dates';
import { resumeTour } from '../../../../utils/statuts';
import { lienWhatsApp, recapitulatifTour, remplirModele } from '../../../../utils/partage';
import { ouvrirLien, partagerTexte } from '../../../../utils/fichiers';
import type { LigneStatut, ModePaiement } from '../../../../types';
import { t, tn } from '../../../../i18n';

export default function PaiementsTour() {
  const { c } = useTheme();
  const p = useLocalSearchParams<{ id: string; tourId: string }>();
  const daretId = Number(p.id), tourId = Number(p.tourId);
  const { data } = useDonnees(() => chargerDetailDaret(daretId), [daretId]);
  const [saisie, setSaisie] = useState<LigneStatut | null>(null);
  const [dateRemise, setDateRemise] = useState(aujourdhui());

  if (!data) return <Chargement />;
  const tour = data.tours.find(t => t.id === tourId);
  if (!tour) return <Ecran><EtatVide icone="search-outline" titre={t('Tour introuvable')} message={t('Le calendrier a peut-être été régénéré.')} action={t('Retour')} onAction={() => router.back()} /></Ecran>;
  const lignes = data.statuts.get(tour.id) ?? [];
  const r = resumeTour(lignes);
  const benef = data.membres.find(m => m.id === tour.beneficiaire_id);

  async function appuiCourt(l: LigneStatut) {
    try {
      if (l.statut === 'paye') {
        if (await confirmer(t('Annuler le paiement ?'), t('Tous les paiements de {nom} pour ce tour ({montant}) seront supprimés.', { nom: l.membre.nom, montant: formatDH(l.verse) }), t('Annuler le paiement'))) {
          await annulerPaiements(tour!.id, l.membre.id);
        }
        return;
      }
      await payerReste(tour!.id, l.membre, data!.daret.montant_part);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) { afficherErreur(e); }
  }

  async function relancer(l: LigneStatut) {
    const { modele_whatsapp } = await lireParametres();
    const msg = remplirModele(modele_whatsapp, { nom: l.membre.nom, montant: formatDH(l.du - l.verse), date: formatDateLongue(tour!.date_echeance), daret: data!.daret.nom });
    if (!(await ouvrirLien(lienWhatsApp(l.membre.telephone, msg)))) afficherErreur(new Error(t('WhatsApp n\'a pas pu être ouvert.')));
  }

  return (
    <Ecran>
      <Stack.Screen options={{ title: t('Tour {n} sur {total}', { n: tour.numero, total: data.tours.length }) }} />
      <Bandeau>
        <Ligne style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' }}>{data.daret.nom}</Text>
          <Ligne style={{ gap: 4 }}>
            <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>{formatDateLongue(tour.date_echeance)}</Text>
          </Ligne>
        </Ligne>
        <Ligne style={{ gap: ESPACE.m, marginTop: ESPACE.m }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="gift" size={24} color="#E6BE45" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{t('Bénéficiaire')}</Text>
            <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '700' }} numberOfLines={1}>{benef?.nom ?? '—'}</Text>
          </View>
        </Ligne>
        <BarreProgression valeur={r.collecte} max={r.attendu} couleur="#E6BE45" fond="rgba(255,255,255,0.18)" hauteur={6} />
        <Ligne style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>{formatDH(r.collecte)} <Text style={{ fontWeight: '400', color: 'rgba(255,255,255,0.8)' }}>/ {formatDH(r.attendu)}</Text></Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>{tn(r.payes, '{n}/{total} payé', '{n}/{total} payés', { total: lignes.length })}</Text>
        </Ligne>
      </Bandeau>

      <Info icone="hand-left-outline">{t('Appui : marquer payé (ou annuler). Appui long : paiement partiel, date et mode.')}</Info>

      <SousTitre>{t('Cotisations')}</SousTitre>
      {lignes.map(l => (
        <Carte key={l.membre.id} onPress={() => appuiCourt(l)} onLongPress={() => setSaisie(l)}>
          <Ligne style={{ gap: ESPACE.m }}>
            <View>
              <Avatar nom={l.membre.nom} />
              {l.statut === 'paye' ? (
                <View style={{ position: 'absolute', right: -3, bottom: -3, backgroundColor: c.surface, borderRadius: 10 }}>
                  <Ionicons name="checkmark-circle" size={20} color={c.primaire} />
                </View>
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.texte }} numberOfLines={1}>{l.membre.nom}{l.membre.nb_parts > 1 ? ` · ${t('{n} parts', { n: l.membre.nb_parts })}` : ''}</Text>
              <TexteDoux style={{ fontSize: 13 }}>{t('Dû {montant}', { montant: formatDH(l.du) })}{l.verse ? ` · ${t('versé {montant}', { montant: formatDH(l.verse) })}` : ''}</TexteDoux>
            </View>
            <BadgeStatut statut={l.statut} complement={l.statut === 'en_retard' ? t('{n} j', { n: l.joursRetard }) : undefined} />
          </Ligne>
          {l.statut === 'en_retard' ? (
            <Bouton titre={t('Relancer sur WhatsApp')} icone="logo-whatsapp" variante="whatsapp" petit onPress={() => relancer(l).catch(afficherErreur)} style={{ marginTop: ESPACE.m }} />
          ) : null}
        </Carte>
      ))}

      <SousTitre style={{ marginTop: ESPACE.m }}>{t('Remise de la cagnotte')}</SousTitre>
      {tour.remis_le ? (
        <Carte>
          <Ligne style={{ gap: ESPACE.m }}>
            <Pastille nom="checkmark-done" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.texte }}>{t('Remise effectuée')}</Text>
              <TexteDoux style={{ fontSize: 13 }}>{t('À {nom} le {date}', { nom: benef?.nom ?? '—', date: formatDateLongue(tour.remis_le) })}</TexteDoux>
            </View>
          </Ligne>
          <Bouton titre={t('Annuler la remise')} icone="arrow-undo-outline" variante="texte" petit style={{ marginTop: ESPACE.s }} onPress={async () => {
            if (await confirmer(t('Annuler la remise ?'), t('Le tour repassera « non remis ».'), t('Annuler la remise'))) await marquerRemis(tour.id, null);
          }} />
        </Carte>
      ) : (
        <Carte>
          {r.collecte < r.attendu ? <Info icone="warning-outline" ton="alerte">{t('Il manque encore {montant} pour compléter la cagnotte.', { montant: formatDH(r.attendu - r.collecte) })}</Info> : null}
          <ChampDate label={t('Date de remise')} valeur={dateRemise} onChange={setDateRemise} />
          <Bouton titre={t('Remettre à {nom}', { nom: benef?.nom ?? t('au bénéficiaire') })} icone="gift-outline" variante="or" onPress={async () => {
            if (await confirmer(t('Confirmer la remise ?'), t('{montant} remis à {nom} le {date}.', { montant: formatDH(r.collecte), nom: benef?.nom ?? '—', date: formatDateLongue(dateRemise) }), t('Confirmer'), false)) await marquerRemis(tour.id, dateRemise);
          }} />
        </Carte>
      )}

      <Bouton titre={t('Partager le récapitulatif')} icone="share-social-outline" variante="secondaire" style={{ marginTop: ESPACE.s }}
        onPress={() => partagerTexte(recapitulatifTour(data.daret, tour, benef, lignes, data.tours.length)).catch(afficherErreur)} />

      <SaisiePaiement ligne={saisie} onFermer={() => setSaisie(null)} onValider={async (montant, date, mode) => {
        await ajouterPaiement(tour.id, saisie!.membre.id, montant, date, mode);
        setSaisie(null);
      }} />
    </Ecran>
  );
}

function SaisiePaiement({ ligne, onFermer, onValider }: {
  ligne: LigneStatut | null; onFermer: () => void; onValider: (montant: number, date: string, mode: ModePaiement) => Promise<void>;
}) {
  const { c } = useTheme();
  const [montant, setMontant] = useState('');
  const [date, setDate] = useState(aujourdhui());
  const [mode, setMode] = useState<ModePaiement>('especes');
  const [envoi, setEnvoi] = useState(false);
  const reste = ligne ? Math.max(0, ligne.du - ligne.verse) : 0;
  const valeur = parseDH(montant);
  const erreur = montant && (valeur === null || valeur <= 0) ? t('Montant invalide') : null;

  return (
    <Modal visible={!!ligne} transparent animationType="slide" onRequestClose={onFermer} onShow={() => { setMontant(String(reste / 100).replace('.', ',')); setDate(aujourdhui()); setMode('especes'); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <View style={{ backgroundColor: c.fond, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', width: '100%', maxWidth: LARGEUR_MAX, alignSelf: 'center' }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.bordure, marginTop: 10 }} />
          <ScrollView contentContainerStyle={{ padding: ESPACE.xl, paddingTop: ESPACE.l }} keyboardShouldPersistTaps="handled">
            <Text style={{ fontSize: 20, fontWeight: '700', color: c.texte }}>{t('Paiement de {nom}', { nom: ligne?.membre.nom ?? '' })}</Text>
            <TexteDoux style={{ marginBottom: ESPACE.l, marginTop: 4 }}>{t('Dû : {du} · déjà versé : {verse} · reste : {reste}', { du: formatDH(ligne?.du ?? 0), verse: formatDH(ligne?.verse ?? 0), reste: formatDH(reste) })}</TexteDoux>
            <Champ label={t('Montant versé (DH)')} value={montant} onChangeText={setMontant} keyboardType="decimal-pad" erreur={erreur} autoFocus />
            <ChampDate label={t('Date du paiement')} valeur={date} onChange={setDate} />
            <Segment label={t('Mode de paiement')} valeur={mode} onChange={setMode}
              options={[{ valeur: 'especes', libelle: t('Espèces'), icone: 'cash-outline' }, { valeur: 'virement', libelle: t('Virement'), icone: 'card-outline' }, { valeur: 'autre', libelle: t('Autre') }]} />
            <Ligne>
              <Bouton titre={t('Annuler')} variante="secondaire" onPress={onFermer} style={{ flex: 1 }} />
              <Bouton titre={t('Enregistrer')} chargement={envoi} desactive={!valeur || valeur <= 0} style={{ flex: 1 }} onPress={async () => {
                setEnvoi(true);
                try { await onValider(valeur!, date, mode); } catch (e) { afficherErreur(e); } finally { setEnvoi(false); }
              }} />
            </Ligne>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
