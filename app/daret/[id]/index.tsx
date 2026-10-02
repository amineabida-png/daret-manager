import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ESPACE } from '../../../components/theme';
import {
  Avatar, Bandeau, BarreProgression, BadgeStatut, Bouton, Carte, Chargement, Ecran, EtatVide, Groupe, Info, Ligne, LigneMenu, Segment, SousTitre, TexteDoux,
  afficherErreur, chevron, confirmer, type NomIcone,
} from '../../../components/ui';
import { useDonnees } from '../../../components/useDonnees';
import { chargerDetailDaret, type DetailDaret } from '../../../db/vues';
import { changerStatutDaret, supprimerDaret, supprimerPaiement } from '../../../db/requetes';
import { formatDH } from '../../../utils/montant';
import { aujourdhui, formatDateCourte, formatDateLongue, nomJourSemaine } from '../../../utils/dates';
import { resumeTour } from '../../../utils/statuts';
import { recapitulatifTour } from '../../../utils/partage';
import { exporterCSV, partagerTexte } from '../../../utils/fichiers';
import { libelleMode } from '../../../utils/partage';
import { t, tn } from '../../../i18n';

type Onglet = 'tours' | 'membres' | 'historique';

export default function DetailDaretEcran() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { data, recharger } = useDonnees(() => chargerDetailDaret(id), [id]);
  const [onglet, setOnglet] = useState<Onglet>('tours');
  if (data === undefined) return <Chargement />;
  if (data === null) return <Ecran><EtatVide icone="search-outline" titre={t('Daret introuvable')} message={t('Elle a peut-être été supprimée.')} action={t('Retour')} onAction={() => router.back()} /></Ecran>;

  const d = data;
  return (
    <Ecran>
      <Stack.Screen options={{ title: d.daret.nom }} />
      <EnTete d={d} />
      <Segment valeur={onglet} onChange={setOnglet} options={[
        { valeur: 'tours', libelle: `${t('Tours')} · ${d.tours.length}` },
        { valeur: 'membres', libelle: `${t('Membres')} · ${d.membres.length}` },
        { valeur: 'historique', libelle: t('Historique') },
      ]} />
      {onglet === 'tours' && <OngletTours d={d} />}
      {onglet === 'membres' && <OngletMembres d={d} />}
      {onglet === 'historique' && <OngletHistorique d={d} onChange={recharger} />}
      <Actions d={d} />
    </Ecran>
  );
}

function EnTete({ d }: { d: DetailDaret }) {
  const freq = d.daret.frequence === 'mensuelle'
    ? t('Chaque mois, le {j}', { j: d.daret.jour_echeance })
    : d.daret.frequence === 'hebdomadaire'
      ? t('Chaque {jour}', { jour: nomJourSemaine(d.daret.jour_echeance) })
      : t('Un {jour} sur deux', { jour: nomJourSemaine(d.daret.jour_echeance) });
  const remis = d.tours.filter(x => x.remis_le).length;
  const statut = d.daret.statut !== 'en_cours' ? (d.daret.statut === 'terminee' ? t('Terminée') : t('Archivée')) : null;
  const blanc = 'rgba(255,255,255,0.8)';
  return (
    <Bandeau>
      <Ligne style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: blanc, fontSize: 13, fontWeight: '600' }}>{t('Cagnotte par tour')}</Text>
        {statut ? (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>{statut}</Text>
          </View>
        ) : null}
      </Ligne>
      <Text style={{ color: '#FFF', fontSize: 32, fontWeight: '700', letterSpacing: -0.5 }} adjustsFontSizeToFit numberOfLines={1}>{formatDH(d.montantTour)}</Text>
      <View style={{ flexDirection: 'row', marginTop: ESPACE.m, gap: ESPACE.l }}>
        <Info2 icone="cash-outline" texte={t('{montant} / part', { montant: formatDH(d.daret.montant_part) })} />
        <Info2 icone="people-outline" texte={tn(d.totalParts, '{n} part', '{n} parts')} />
      </View>
      <View style={{ marginTop: 6 }}><Info2 icone="repeat-outline" texte={freq} /></View>
      {d.tours.length ? (
        <>
          <BarreProgression valeur={remis} max={d.tours.length} couleur="#E6BE45" fond="rgba(255,255,255,0.18)" hauteur={6} />
          <Text style={{ color: blanc, fontSize: 13 }}>{tn(remis, '{n} tour remis sur {total}', '{n} tours remis sur {total}', { total: d.tours.length })}</Text>
        </>
      ) : null}
      {d.daret.notes ? (
        <View style={{ marginTop: ESPACE.m, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: ESPACE.s, flexDirection: 'row', gap: 6 }}>
          <Ionicons name="document-text-outline" size={16} color={blanc} style={{ marginTop: 1 }} />
          <Text style={{ color: '#FFF', flex: 1, fontSize: 13 }}>{d.daret.notes}</Text>
        </View>
      ) : null}
    </Bandeau>
  );
}

function Info2({ icone, texte }: { icone: NomIcone; texte: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons name={icone} size={15} color="rgba(255,255,255,0.8)" />
      <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>{texte}</Text>
    </View>
  );
}

function OngletTours({ d }: { d: DetailDaret }) {
  const { c } = useTheme();
  if (d.membres.length < 2) {
    return <EtatVide icone="person-add-outline" titre={t('Ajoutez des membres')} message={t('Il faut au moins 2 membres pour générer le calendrier des tours.')} action={t('Ajouter des membres')} onAction={() => router.push({ pathname: '/membre/nouveau', params: { daretId: d.daret.id } })} />;
  }
  if (!d.tours.length) {
    return <EtatVide icone="shuffle" titre={t('Ordre des tours à définir')} message={t('Choisissez l\'ordre (manuel, tirage au sort ou ordre d\'inscription) pour générer automatiquement le calendrier.')} action={t('Définir l\'ordre')} onAction={() => router.push(`/daret/${d.daret.id}/ordre`)} />;
  }
  const today = aujourdhui();
  return (
    <View>
      {d.tours.map(tr => {
        const lignes = d.statuts.get(tr.id) ?? [];
        const r = resumeTour(lignes);
        const benef = d.membres.find(m => m.id === tr.beneficiaire_id);
        const courant = d.courant?.id === tr.id;
        const commence = tr.date_echeance <= today || r.collecte > 0;
        return (
          <Carte key={tr.id} onPress={() => router.push(`/daret/${d.daret.id}/tour/${tr.id}`)}
            style={courant ? { borderWidth: 2, borderColor: c.or } : undefined}>
            <Ligne style={{ gap: ESPACE.m }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                backgroundColor: tr.remis_le ? c.primaire : courant ? c.or : c.surface2 }}>
                {tr.remis_le
                  ? <Ionicons name="checkmark" size={22} color="#FFF" />
                  : <Text style={{ fontWeight: '700', fontSize: 16, color: courant ? '#241C05' : c.texteDoux }}>{tr.numero}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: c.texte }} numberOfLines={1}>{benef?.nom ?? '—'}</Text>
                <TexteDoux style={{ fontSize: 13 }}>{t('Tour {n}', { n: tr.numero })} · {formatDateCourte(tr.date_echeance)}</TexteDoux>
              </View>
              {courant ? (
                <View style={{ backgroundColor: c.orClair, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                  <Text style={{ color: c.sombre ? c.or : '#8A6A0C', fontWeight: '700', fontSize: 12 }}>{t('En cours')}</Text>
                </View>
              ) : tr.remis_le ? (
                <Text style={{ color: c.primaire, fontWeight: '600', fontSize: 13 }}>{t('Remis')}</Text>
              ) : !commence ? <TexteDoux style={{ fontSize: 13 }}>{t('À venir')}</TexteDoux> : null}
            </Ligne>
            {!tr.remis_le && commence ? (
              <View style={{ marginTop: ESPACE.s }}>
                <BarreProgression valeur={r.collecte} max={r.attendu} hauteur={6} />
                <Ligne style={{ justifyContent: 'space-between' }}>
                  <TexteDoux style={{ fontSize: 13 }}>{tn(r.payes, '{n}/{total} payé', '{n}/{total} payés', { total: lignes.length })} · {formatDH(r.collecte)} / {formatDH(r.attendu)}</TexteDoux>
                  {r.enRetard ? <BadgeStatut statut="en_retard" complement={String(r.enRetard)} /> : null}
                </Ligne>
              </View>
            ) : tr.remis_le ? (
              <TexteDoux style={{ fontSize: 13, marginTop: ESPACE.s }}>{t('Cagnotte remise le {date}', { date: formatDateLongue(tr.remis_le) })}</TexteDoux>
            ) : null}
          </Carte>
        );
      })}
      <Ligne style={{ marginBottom: ESPACE.m }}>
        {!d.commencee ? <Bouton titre={t('Refaire l\'ordre')} icone="shuffle" variante="secondaire" petit onPress={() => router.push(`/daret/${d.daret.id}/ordre`)} style={{ flex: 1 }} /> : null}
        <Bouton titre={t('Échanger 2 tours')} icone="swap-vertical" variante="secondaire" petit onPress={() => router.push(`/daret/${d.daret.id}/echanger`)} style={{ flex: 1 }} />
      </Ligne>
    </View>
  );
}

function OngletMembres({ d }: { d: DetailDaret }) {
  const { c } = useTheme();
  const ajouter = () => router.push({ pathname: '/membre/nouveau', params: { daretId: d.daret.id } });
  return (
    <View>
      {d.membres.length === 0 ? (
        <EtatVide icone="person-add-outline" titre={t('Aucun membre')} message={t('Ajoutez les participants à la main ou importez-les depuis vos contacts.')} action={t('Ajouter des membres')} onAction={ajouter} />
      ) : d.membres.map(m => {
        const retards = d.tours.filter(x => d.statuts.get(x.id)?.find(l => l.membre.id === m.id)?.statut === 'en_retard').length;
        const tours = d.tours.filter(x => x.beneficiaire_id === m.id);
        return (
          <Carte key={m.id} onPress={() => router.push(`/membre/${m.id}`)}>
            <Ligne style={{ gap: ESPACE.m }}>
              <Avatar nom={m.nom} />
              <View style={{ flex: 1 }}>
                <Ligne style={{ gap: 6 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: c.texte, flexShrink: 1 }} numberOfLines={1}>{m.nom}</Text>
                  {m.nb_parts > 1 ? (
                    <View style={{ backgroundColor: c.orClair, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Text style={{ color: c.sombre ? c.or : '#8A6A0C', fontWeight: '700', fontSize: 11 }}>{t('{n} PARTS', { n: m.nb_parts })}</Text>
                    </View>
                  ) : null}
                </Ligne>
                <TexteDoux style={{ fontSize: 13 }} numberOfLines={1}>
                  {m.telephone ?? t('Pas de téléphone')}{tours.length ? ` · ${tn(tours.length, 'tour {liste}', 'tours {liste}', { liste: tours.map(x => x.numero).join(', ') })}` : ''}
                </TexteDoux>
              </View>
              {retards ? <BadgeStatut statut="en_retard" complement={String(retards)} /> : <Ionicons name={chevron()} size={18} color={c.texteDoux} />}
            </Ligne>
          </Carte>
        );
      })}
      {d.membres.length > 0 && !d.commencee ? <Bouton titre={t('Ajouter des membres')} icone="person-add-outline" variante="secondaire" onPress={ajouter} style={{ marginBottom: ESPACE.m }} /> : null}
      {d.commencee ? <Info icone="lock-closed-outline">{t('La daret a commencé : la liste des membres est figée.')}</Info> : null}
    </View>
  );
}

function OngletHistorique({ d, onChange }: { d: DetailDaret; onChange: () => void }) {
  const { c } = useTheme();
  if (!d.paiements.length) return <EtatVide icone="receipt-outline" titre={t('Aucun paiement')} message={t('Les paiements enregistrés dans les tours apparaîtront ici, du plus récent au plus ancien.')} />;
  const nom = new Map(d.membres.map(m => [m.id, m.nom]));
  const numero = new Map(d.tours.map(x => [x.id, x.numero]));
  return (
    <View>
      <Info icone="hand-left-outline">{t('Appui long sur un paiement pour l\'annuler.')}</Info>
      <Carte style={{ padding: 0, overflow: 'hidden' }}>
        {d.paiements.map((p, i) => (
          <View key={p.id}>
            {i > 0 ? <View style={{ height: 1, backgroundColor: c.bordure, marginLeft: 68 }} /> : null}
            <LigneHistorique
              nom={nom.get(p.membre_id) ?? '—'} montant={formatDH(p.montant)}
              detail={`${t('Tour {n}', { n: numero.get(p.tour_id) ?? '' })} · ${formatDateCourte(p.date_paiement)} · ${libelleMode(p.mode)}`}
              onLongPress={async () => {
                if (await confirmer(t('Annuler ce paiement ?'), `${nom.get(p.membre_id)} — ${formatDH(p.montant)} (${t('tour {n}', { n: numero.get(p.tour_id) ?? '' })})`, t('Annuler le paiement'))) {
                  try { await supprimerPaiement(p.id); onChange(); } catch (e) { afficherErreur(e); }
                }
              }} />
          </View>
        ))}
      </Carte>
    </View>
  );
}

function LigneHistorique({ nom, montant, detail, onLongPress }: { nom: string; montant: string; detail: string; onLongPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onLongPress={onLongPress} delayLongPress={350}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: ESPACE.m, paddingHorizontal: ESPACE.l, paddingVertical: 12 }, pressed && { backgroundColor: c.surface2 }]}>
      <Avatar nom={nom} taille={38} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: c.texte }} numberOfLines={1}>{nom}</Text>
        <TexteDoux style={{ fontSize: 13 }} numberOfLines={1}>{detail}</TexteDoux>
      </View>
      <Text style={{ fontSize: 15, fontWeight: '700', color: c.primaire }}>+{montant}</Text>
    </Pressable>
  );
}

function Actions({ d }: { d: DetailDaret }) {
  const { c } = useTheme();
  const id = d.daret.id;
  async function partager() {
    const tc = d.courant;
    if (!tc) return;
    await partagerTexte(recapitulatifTour(d.daret, tc, d.membres.find(m => m.id === tc.beneficiaire_id), d.statuts.get(tc.id) ?? [], d.tours.length));
  }
  return (
    <View style={{ marginTop: ESPACE.l }}>
      <SousTitre>{t('Actions')}</SousTitre>
      <Groupe>
        {d.courant ? <LigneMenu icone="share-social-outline" titre={t('Partager le récapitulatif')} sousTitre={t('Tour en cours, payés et retards')} onPress={() => partager().catch(afficherErreur)} /> : null}
        <LigneMenu icone="create-outline" titre={t('Modifier la daret')} sousTitre={t('Nom, montant, rythme, notes')} onPress={() => router.push(`/daret/${id}/modifier`)} />
        {d.paiements.length ? <LigneMenu icone="document-text-outline" titre={t('Exporter l\'historique')} sousTitre={t('Fichier CSV lisible par Excel')} onPress={() => exporterCSV(id).catch(afficherErreur)} /> : null}
        {d.daret.statut !== 'archivee' ? (
          <LigneMenu icone="archive-outline" titre={t('Archiver')} couleur={c.texteDoux} onPress={async () => {
            if (await confirmer(t('Archiver cette daret ?'), t('Elle sera rangée dans « Archivées » et ses rappels seront arrêtés.'), t('Archiver'), false)) await changerStatutDaret(id, 'archivee');
          }} />
        ) : (
          <LigneMenu icone="arrow-undo-outline" titre={t('Désarchiver')} onPress={() => changerStatutDaret(id, d.tours.length && d.tours.every(x => x.remis_le) ? 'terminee' : 'en_cours')} />
        )}
        <LigneMenu icone="trash-outline" titre={t('Supprimer la daret')} couleur={c.danger} onPress={async () => {
          if (await confirmer(t('Supprimer définitivement ?'), t('« {nom} », ses {m} membre(s), {t} tour(s) et {p} paiement(s) seront effacés. Cette action est irréversible.', { nom: d.daret.nom, m: d.membres.length, t: d.tours.length, p: d.paiements.length }))) {
            await supprimerDaret(id);
            router.back();
          }
        }} />
      </Groupe>
    </View>
  );
}
