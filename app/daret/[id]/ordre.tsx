import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import ReorderableList, { reorderItems, useReorderableDrag, type ReorderableListReorderEvent } from 'react-native-reorderable-list';
import { useTheme, ESPACE, RAYON } from '../../../components/theme';
import { Avatar, Bouton, Chargement, Ecran, EtatVide, Info, LARGEUR_MAX, Segment, TexteDoux, afficherErreur } from '../../../components/ui';
import { useDonnees } from '../../../components/useDonnees';
import { chargerDetailDaret } from '../../../db/vues';
import { definirOrdre } from '../../../db/requetes';
import { genererDates, ordreInscription, ordreTirage } from '../../../utils/calendrier';
import { formatDateCourte } from '../../../utils/dates';
import type { Membre, ModeOrdre } from '../../../types';
import { t } from '../../../i18n';

interface Part { cle: string; membreId: number; }

/** Transforme une liste d'identifiants (une entrée par part) en éléments à clé unique. */
function versParts(ordre: number[]): Part[] {
  const vus = new Map<number, number>();
  return ordre.map(id => { const n = (vus.get(id) ?? 0) + 1; vus.set(id, n); return { cle: `${id}-${n}`, membreId: id }; });
}

export default function OrdreTours() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ id: string; mode?: string; auto?: string }>();
  const id = Number(params.id);
  const auto = params.auto === '1';
  const { data } = useDonnees(() => chargerDetailDaret(id), [id]);
  // Par défaut : tirage au sort (1er tour, 2e tour… tirés un par un)
  const [mode, setMode] = useState<ModeOrdre>(params.mode === 'inscription' || params.mode === 'manuel' ? params.mode : 'tirage');
  const [reveles, setReveles] = useState(0);
  const [tourEnTirage, setTourEnTirage] = useState(0);
  const autoLance = useRef(false);
  const [manuel, setManuel] = useState<Part[] | null>(null);
  const [tirage, setTirage] = useState<number[] | null>(null);
  const [animation, setAnimation] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const minuterie = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (minuterie.current) clearInterval(minuterie.current); }, []);
  // L'ordre manuel part de l'ordre actuel du calendrier s'il existe, sinon de l'ordre d'inscription
  useEffect(() => {
    if (data && !manuel) setManuel(versParts(data.tours.length ? data.tours.map(t => t.beneficiaire_id) : ordreInscription(data.membres)));
  }, [data, manuel]);

  const ordre = useMemo<number[] | null>(() => {
    if (!data) return null;
    if (mode === 'inscription') return ordreInscription(data.membres);
    if (mode === 'tirage') return tirage && reveles >= tirage.length ? tirage : null;
    return manuel?.map(p => p.membreId) ?? null;
  }, [data, mode, tirage, reveles, manuel]);

  /**
   * Tirage au sort position par position : pour chaque tour, les noms restants défilent
   * puis le bénéficiaire est révélé (1er tour, 2e tour, et ainsi de suite).
   */
  function lancerTirage() {
    if (!data) return;
    const final = ordreTirage(data.membres);
    const nom = new Map(data.membres.map(m => [m.id, m.nom]));
    if (minuterie.current) clearInterval(minuterie.current);
    setTirage(final);
    setReveles(0);
    let position = 0, tic = 0, pause = 0;
    const tics = final.length > 15 ? 5 : 9;
    setTourEnTirage(1);
    minuterie.current = setInterval(() => {
      // Le nom tiré reste affiché un instant avant de passer au tour suivant
      if (pause > 0) { pause--; return; }
      if (tic === 0) setTourEnTirage(position + 1);
      const restants = final.slice(position);
      setAnimation(nom.get(restants[Math.floor(Math.random() * restants.length)]) ?? '');
      Haptics.selectionAsync().catch(() => {});
      if (++tic >= tics) {
        tic = 0;
        setAnimation(nom.get(final[position]) ?? '');
        position++;
        setReveles(position);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        if (position >= final.length) {
          clearInterval(minuterie.current!);
          setAnimation(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        } else pause = final.length > 15 ? 3 : 6;
      }
    }, 95);
  }

  function toutReveler() {
    if (minuterie.current) clearInterval(minuterie.current);
    setAnimation(null);
    if (tirage) setReveles(tirage.length);
  }

  // Arrivée depuis la création ou l'ajout de membres : le tirage démarre tout seul
  useEffect(() => {
    if (auto && data && !autoLance.current && mode === 'tirage' && !data.commencee && data.membres.length >= 2) {
      autoLance.current = true;
      lancerTirage();
    }
  });

  if (!data) return <Chargement />;
  if (data.commencee) return <Ecran><EtatVide icone="lock-closed-outline" titre={t('Daret commencée')} message={t('L\'ordre ne peut plus être refait. Utilisez « Échanger 2 tours » pour inverser deux bénéficiaires.')} action={t('Échanger deux tours')} onAction={() => router.replace(`/daret/${id}/echanger`)} /></Ecran>;
  if (data.membres.length < 2) return <Ecran><EtatVide icone="person-add-outline" titre={t('Pas assez de membres')} message={t('Ajoutez au moins 2 membres avant de définir l\'ordre.')} action={t('Ajouter des membres')} onAction={() => router.replace({ pathname: '/membre/nouveau', params: { daretId: id } })} /></Ecran>;

  const membres = new Map(data.membres.map(m => [m.id, m]));
  const dates = genererDates(data.daret.date_debut, data.daret.frequence, data.daret.jour_echeance, data.totalParts);

  async function valider() {
    if (!ordre) return;
    setEnvoi(true);
    try {
      await definirOrdre(id, mode, ordre);
      if (auto) router.replace(`/daret/${id}`); else router.back();
    } catch (e) { afficherErreur(e); } finally { setEnvoi(false); }
  }

  const entete = (
    <View style={{ padding: ESPACE.l, paddingBottom: 0 }}>
      <Segment valeur={mode} onChange={setMode} options={[
        { valeur: 'inscription', libelle: t('Inscription'), icone: 'list-outline' }, { valeur: 'tirage', libelle: t('Tirage'), icone: 'dice-outline' }, { valeur: 'manuel', libelle: t('Manuel'), icone: 'hand-left-outline' },
      ]} />
      <Info>
        {mode === 'inscription' && t('Les tours suivent l\'ordre d\'ajout des membres. Un membre à plusieurs parts reçoit des tours consécutifs.')}
        {mode === 'tirage' && (tirage && reveles >= tirage.length && !animation
          ? t('Tirage terminé ! Touchez « Générer le calendrier » pour valider, ou relancez le tirage.')
          : t('Le tirage au sort désigne qui reçoit la cagnotte au 1er tour, au 2e tour, et ainsi de suite.'))}
        {mode === 'manuel' && (Platform.OS === 'web' ? t('Utilisez les flèches pour changer la place d\'un membre.') : t('Maintenez un nom appuyé puis faites-le glisser pour changer sa place.'))}
      </Info>
      {mode === 'tirage' && (
        <View style={{ marginBottom: ESPACE.m }}>
          {animation !== null ? (
            <View style={{ alignItems: 'center', padding: ESPACE.l, backgroundColor: c.orClair, borderRadius: RAYON, marginBottom: ESPACE.m }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: c.sombre ? c.or : '#8A6A0C', letterSpacing: 0.6 }}>{t('TIRAGE DU TOUR {n}', { n: tourEnTirage })}</Text>
              <Ionicons name="dice" size={32} color={c.or} style={{ marginTop: ESPACE.s }} />
              <Text style={{ fontSize: 26, fontWeight: '700', color: c.texte, marginTop: ESPACE.s }} numberOfLines={1}>{animation}</Text>
              <Pressable onPress={toutReveler} hitSlop={10} style={{ marginTop: ESPACE.m }}>
                <Text style={{ color: c.primaire, fontWeight: '700' }}>{t('Tout révéler')}</Text>
              </Pressable>
            </View>
          ) : null}
          <Bouton titre={tirage ? t('Relancer le tirage') : t('Lancer le tirage au sort')} icone="dice-outline" variante="or" onPress={lancerTirage} desactive={animation !== null} />
        </View>
      )}
    </View>
  );

  const pied = (
    <View style={{ padding: ESPACE.l, width: '100%', maxWidth: LARGEUR_MAX, alignSelf: 'center' }}>
      <Bouton titre={t('Générer le calendrier')} icone="calendar" onPress={valider} chargement={envoi} desactive={!ordre || animation !== null} />
    </View>
  );

  if (mode === 'manuel' && manuel && Platform.OS === 'web') {
    // Navigateur : flèches haut / bas à la place du glisser-déposer
    const deplacer = (i: number, d: number) => setManuel(l => (l && i + d >= 0 && i + d < l.length ? reorderItems(l, i, i + d) : l));
    return (
      <View style={{ flex: 1, backgroundColor: c.fond }}>
        <Ecran style={{ padding: 0 }}>
          {entete}
          <View style={{ paddingHorizontal: ESPACE.l }}>
            {manuel.map((p, i) => (
              <View key={p.cle} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ flex: 1 }}><ElementTour rang={i + 1} membre={membres.get(p.membreId)!} date={dates[i]} /></View>
                <FlecheOrdre icone="chevron-up" libelle={t('Monter')} actif={i > 0} onPress={() => deplacer(i, -1)} />
                <FlecheOrdre icone="chevron-down" libelle={t('Descendre')} actif={i < manuel.length - 1} onPress={() => deplacer(i, 1)} />
              </View>
            ))}
          </View>
        </Ecran>
        {pied}
      </View>
    );
  }

  if (mode === 'manuel' && manuel) {
    return (
      <View style={{ flex: 1, backgroundColor: c.fond }}>
        {entete}
        <ReorderableList
          data={manuel}
          keyExtractor={p => p.cle}
          onReorder={({ from, to }: ReorderableListReorderEvent) => setManuel(l => (l ? reorderItems(l, from, to) : l))}
          renderItem={({ item, index }) => <ElementGlissable membre={membres.get(item.membreId)!} rang={index + 1} date={dates[index]} />}
          contentContainerStyle={{ paddingHorizontal: ESPACE.l }}
          style={{ flex: 1 }}
        />
        {pied}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.fond }}>
      <Ecran style={{ padding: 0 }}>
        {entete}
        <View style={{ paddingHorizontal: ESPACE.l }}>
          {mode === 'tirage' && tirage
            ? tirage.map((mid, i) => i < reveles
              ? <ElementTour key={i} rang={i + 1} membre={membres.get(mid)!} date={dates[i]} actif={i === reveles - 1 && animation !== null} />
              : <ElementAttente key={i} rang={i + 1} date={dates[i]} />)
            : ordre ? ordre.map((mid, i) => <ElementTour key={i} rang={i + 1} membre={membres.get(mid)!} date={dates[i]} />)
            : <TexteDoux style={{ textAlign: 'center', marginTop: ESPACE.l }}>{t('Lancez le tirage pour voir l\'ordre.')}</TexteDoux>}
        </View>
      </Ecran>
      {pied}
    </View>
  );
}

function ElementTour({ rang, membre, date, actif }: { rang: number; membre: Membre; date: string; actif?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACE.m, padding: ESPACE.m, marginBottom: ESPACE.s, borderRadius: RAYON, borderWidth: 1,
      backgroundColor: actif ? c.orClair : c.surface, borderColor: actif ? c.or : c.bordure }}>
      <View style={{ width: 30, alignItems: 'center' }}>
        <Text style={{ fontWeight: '700', fontSize: 16, color: c.texteDoux }}>{rang}</Text>
      </View>
      <Avatar nom={membre.nom} taille={36} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: c.texte }} numberOfLines={1}>{membre.nom}{membre.nb_parts > 1 ? ` · ${t('plusieurs parts')}` : ''}</Text>
        <TexteDoux style={{ fontSize: 13 }}>{formatDateCourte(date)}</TexteDoux>
      </View>
    </View>
  );
}

function ElementGlissable({ rang, membre, date }: { rang: number; membre: Membre; date: string }) {
  const { c } = useTheme();
  const glisser = useReorderableDrag();
  return (
    <Pressable onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); glisser(); }} delayLongPress={250}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}><ElementTour rang={rang} membre={membre} date={date} /></View>
        <Ionicons name="reorder-three" size={26} color={c.texteDoux} style={{ paddingHorizontal: ESPACE.s, marginBottom: ESPACE.s }} />
      </View>
    </Pressable>
  );
}

function FlecheOrdre({ icone, libelle, actif, onPress }: { icone: 'chevron-up' | 'chevron-down'; libelle: string; actif: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!actif} accessibilityLabel={libelle}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 10, marginBottom: ESPACE.s, alignItems: 'center', justifyContent: 'center',
        backgroundColor: c.primaireClair, opacity: actif ? (pressed ? 0.7 : 1) : 0.3 })}>
      <Ionicons name={icone} size={20} color={c.primaire} />
    </Pressable>
  );
}

/** Place pas encore tirée au sort. */
function ElementAttente({ rang, date }: { rang: number; date: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACE.m, padding: ESPACE.m, marginBottom: ESPACE.s, borderRadius: RAYON, borderWidth: 1,
      borderStyle: 'dashed', borderColor: c.bordure, backgroundColor: c.surface2 }}>
      <View style={{ width: 30, alignItems: 'center' }}>
        <Text style={{ fontWeight: '700', fontSize: 16, color: c.texteDoux }}>{rang}</Text>
      </View>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.fond, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="help" size={18} color={c.texteDoux} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: c.texteDoux }}>{t('À tirer au sort')}</Text>
        <TexteDoux style={{ fontSize: 13 }}>{formatDateCourte(date)}</TexteDoux>
      </View>
    </View>
  );
}
