import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ESPACE, RAYON, ombre, useTheme } from './theme';
import type { StatutPaiement } from '../types';
import { formatDateLongue, parseISO, toISO } from '../utils/dates';
import { estRTL, t } from '../i18n';

export type NomIcone = ComponentProps<typeof Ionicons>['name'];

/** Chevron « vers l'avant », inversé quand l'interface est en arabe (droite à gauche). */
export const chevron = (): NomIcone => (estRTL() ? 'chevron-back' : 'chevron-forward');

/* ---------- Textes ---------- */
export function Titre({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { c } = useTheme();
  return <Text style={[{ fontSize: 22, fontWeight: '700', color: c.texte, letterSpacing: -0.3 }, style]}>{children}</Text>;
}

/** En-tête de section : libellé discret en capitales, action facultative à droite. */
export function SousTitre({ children, style, action, onAction }: { children: ReactNode; style?: StyleProp<ViewStyle>; action?: string; onAction?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: ESPACE.s, marginBottom: ESPACE.s }, style]}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: c.texteDoux, letterSpacing: 0.9, textTransform: 'uppercase' }}>{children}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10}><Text style={{ fontSize: 14, fontWeight: '600', color: c.primaire }}>{action}</Text></Pressable>
      ) : null}
    </View>
  );
}

export function TexteDoux({ children, style, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const { c } = useTheme();
  return <Text numberOfLines={numberOfLines} style={[{ fontSize: 14, color: c.texteDoux, lineHeight: 20 }, style]}>{children}</Text>;
}

/* ---------- Icônes ---------- */
export function Icone({ nom, taille = 20, couleur, style }: { nom: NomIcone; taille?: number; couleur?: string; style?: StyleProp<TextStyle> }) {
  const { c } = useTheme();
  return <Ionicons name={nom} size={taille} color={couleur ?? c.texte} style={style} />;
}

/** Icône dans une pastille arrondie teintée. */
export function Pastille({ nom, couleur, fond, taille = 40 }: { nom: NomIcone; couleur?: string; fond?: string; taille?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: taille, height: taille, borderRadius: taille * 0.3, backgroundColor: fond ?? c.primaireClair, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={nom} size={taille * 0.5} color={couleur ?? c.primaire} />
    </View>
  );
}

const TEINTES_AVATAR = ['#1B7F5A', '#2F6FB5', '#B7791F', '#8E44AD', '#C0563B', '#16808F', '#5B6B2E', '#A23B72'];

export function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return '?';
  return (mots.length === 1 ? mots[0].slice(0, 2) : mots[0][0] + mots[mots.length - 1][0]).toUpperCase();
}

/** Avatar rond avec les initiales, couleur stable dérivée du nom. */
export function Avatar({ nom, taille = 42 }: { nom: string; taille?: number }) {
  let h = 0;
  for (const ch of nom) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const teinte = TEINTES_AVATAR[h % TEINTES_AVATAR.length];
  return (
    <View style={{ width: taille, height: taille, borderRadius: taille / 2, backgroundColor: teinte + '22', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: teinte, fontWeight: '700', fontSize: taille * 0.38 }}>{initiales(nom)}</Text>
    </View>
  );
}

/* ---------- Mise en page ---------- */
/** Largeur maximale du contenu sur tablette et ordinateur (centré). */
export const LARGEUR_MAX = 760;

export function Ecran({ children, defilable = true, style }: { children: ReactNode; defilable?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const contenu = [{ padding: ESPACE.l, paddingBottom: ESPACE.xl + insets.bottom + 72, width: '100%' as const, maxWidth: LARGEUR_MAX, alignSelf: 'center' as const }, style];
  if (!defilable) return <View style={[{ flex: 1, backgroundColor: c.fond }, ...contenu]}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.fond }} contentContainerStyle={contenu} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Carte({ children, style, onPress, onLongPress, niveau = 1 }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; onLongPress?: () => void; niveau?: number;
}) {
  const { c } = useTheme();
  const base = [{ backgroundColor: c.surface, borderRadius: RAYON, padding: ESPACE.l, marginBottom: ESPACE.m }, ombre(c, niveau), style];
  if (!onPress && !onLongPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={350}
      style={({ pressed }) => [...base, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}>
      {children}
    </Pressable>
  );
}

export function Ligne({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: ESPACE.s }, style]}>{children}</View>;
}

export function Separateur({ retrait = 0 }: { retrait?: number }) {
  const { c } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.bordure, marginStart: retrait }} />;
}

/** Groupe de lignes de menu dans une même carte, séparées par un filet. */
export function Groupe({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const elements = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <Carte style={[{ padding: 0, overflow: 'hidden' }, style]}>
      {elements.map((e, i) => (
        <View key={i}>{i > 0 ? <Separateur retrait={68} /> : null}{e}</View>
      ))}
    </Carte>
  );
}

/** Ligne de menu : pastille d'icône, titre, sous-titre, chevron. */
export function LigneMenu({ icone, titre, sousTitre, onPress, couleur, droite, desactive, chargement }: {
  icone: NomIcone; titre: string; sousTitre?: string; onPress?: () => void; couleur?: string; droite?: ReactNode; desactive?: boolean; chargement?: boolean;
}) {
  const { c } = useTheme();
  const teinte = couleur ?? c.primaire;
  const danger = couleur === c.danger;
  return (
    <Pressable onPress={onPress} disabled={!onPress || desactive || chargement} accessibilityRole="button"
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: ESPACE.m, paddingHorizontal: ESPACE.l, paddingVertical: 14, opacity: desactive ? 0.45 : 1 },
        pressed && { backgroundColor: c.surface2 }]}>
      <Pastille nom={icone} couleur={teinte} fond={danger ? c.dangerClair : couleur ? couleur + '1F' : c.primaireClair} taille={38} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: danger ? c.danger : c.texte }}>{titre}</Text>
        {sousTitre ? <TexteDoux style={{ fontSize: 13, marginTop: 1 }}>{sousTitre}</TexteDoux> : null}
      </View>
      {chargement ? <ActivityIndicator color={teinte} /> : droite ?? (onPress ? <Ionicons name={chevron()} size={18} color={c.texteDoux} /> : null)}
    </Pressable>
  );
}

/** Tuile de statistique (tableau de bord, fiche membre). */
export function Statistique({ titre, valeur, icone, couleur, sous }: { titre: string; valeur: string; icone: NomIcone; couleur: string; sous?: string }) {
  const { c } = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: c.surface, borderRadius: RAYON, padding: ESPACE.m }, ombre(c)]}>
      <Pastille nom={icone} couleur={couleur} fond={couleur + '1F'} taille={30} />
      {/* Le navigateur ne réduit pas la police automatiquement : on autorise 2 lignes */}
      <Text style={{ fontSize: 16, fontWeight: '700', color: c.texte, marginTop: ESPACE.s }} adjustsFontSizeToFit numberOfLines={Platform.OS === 'web' ? 2 : 1}>{valeur}</Text>
      <TexteDoux style={{ fontSize: 12 }} numberOfLines={1}>{sous ? `${titre} · ${sous}` : titre}</TexteDoux>
    </View>
  );
}

/* ---------- Boutons ---------- */
type Variante = 'primaire' | 'secondaire' | 'or' | 'danger' | 'dangerContour' | 'texte' | 'whatsapp';
export function Bouton({ titre, onPress, variante = 'primaire', icone, desactive, chargement, style, petit }: {
  titre: string; onPress: () => void; variante?: Variante; icone?: NomIcone; desactive?: boolean; chargement?: boolean; style?: StyleProp<ViewStyle>; petit?: boolean;
}) {
  const { c } = useTheme();
  const fond = { primaire: c.primaire, secondaire: c.surface, or: c.or, danger: c.danger, dangerContour: 'transparent', texte: 'transparent', whatsapp: '#1FAF54' }[variante];
  const couleur = { primaire: '#FFFFFF', secondaire: c.primaire, or: '#241C05', danger: '#FFFFFF', dangerContour: c.danger, texte: c.primaire, whatsapp: '#FFFFFF' }[variante];
  const bordure = variante === 'secondaire' ? c.bordure : variante === 'dangerContour' ? c.danger + '66' : 'transparent';
  return (
    <Pressable
      accessibilityRole="button" onPress={onPress} disabled={desactive || chargement}
      style={({ pressed }) => [
        styles.bouton, petit && styles.boutonPetit,
        { backgroundColor: fond, borderColor: bordure, opacity: desactive ? 0.45 : pressed ? 0.85 : 1 },
        (variante === 'primaire' || variante === 'whatsapp') && !desactive ? ombre(c) : null,
        variante === 'secondaire' && c.sombre ? { borderColor: c.bordure } : null,
        style,
      ]}>
      {chargement ? <ActivityIndicator color={couleur} /> : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icone ? <Ionicons name={icone} size={petit ? 18 : 20} color={couleur} /> : null}
          <Text style={[styles.boutonTexte, petit && { fontSize: 15 }, { color: couleur }]}>{titre}</Text>
        </View>
      )}
    </Pressable>
  );
}

/* ---------- Formulaires ---------- */
export function Champ({ label, aide, erreur, ...props }: TextInputProps & { label: string; aide?: string; erreur?: string | null }) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: ESPACE.l }}>
      <Text style={[styles.label, { color: c.texteDoux }]}>{label}</Text>
      <TextInput
        placeholderTextColor={c.texteDoux + 'AA'}
        {...props}
        onFocus={e => { setFocus(true); props.onFocus?.(e); }}
        onBlur={e => { setFocus(false); props.onBlur?.(e); }}
        style={[styles.champ, { backgroundColor: c.surface, color: c.texte, borderColor: erreur ? c.danger : focus ? c.primaire : c.bordure },
          props.multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: 14, paddingBottom: 14 }]}
      />
      {erreur ? (
        <Ligne style={{ marginTop: 6, gap: 4 }}><Ionicons name="alert-circle" size={15} color={c.danger} /><Text style={{ color: c.danger, fontSize: 13 }}>{erreur}</Text></Ligne>
      ) : aide ? <TexteDoux style={{ marginTop: 6, fontSize: 13 }}>{aide}</TexteDoux> : null}
    </View>
  );
}

export function Segment<T extends string | number>({ label, options, valeur, onChange }: {
  label?: string; options: { valeur: T; libelle: string; icone?: NomIcone }[]; valeur: T; onChange: (v: T) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={{ marginBottom: ESPACE.l }}>
      {label ? <Text style={[styles.label, { color: c.texteDoux }]}>{label}</Text> : null}
      <View style={[styles.segment, { backgroundColor: c.surface2 }]}>
        {options.map(o => {
          const actif = o.valeur === valeur;
          return (
            <Pressable key={String(o.valeur)} onPress={() => onChange(o.valeur)} accessibilityRole="tab" accessibilityState={{ selected: actif }}
              style={[styles.segmentItem, actif && [{ backgroundColor: c.surface }, ombre(c)]]}>
              {o.icone ? <Ionicons name={o.icone} size={16} color={actif ? c.primaire : c.texteDoux} /> : null}
              <Text numberOfLines={1} style={{ fontWeight: actif ? '700' : '600', fontSize: 14, textAlign: 'center', color: actif ? c.primaire : c.texteDoux }}>{o.libelle}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ChampDate({ label, valeur, onChange }: { label: string; valeur: string; onChange: (d: string) => void }) {
  const { c } = useTheme();
  const [ouvert, setOuvert] = useState(false);
  return (
    <View style={{ marginBottom: ESPACE.l, position: 'relative' }}>
      <Text style={[styles.label, { color: c.texteDoux }]}>{label}</Text>
      <Pressable onPress={() => setOuvert(true)} style={[styles.champ, { backgroundColor: c.surface, borderColor: c.bordure, flexDirection: 'row', alignItems: 'center', gap: ESPACE.s }]}>
        <Ionicons name="calendar-outline" size={20} color={c.primaire} />
        <Text style={{ color: c.texte, fontSize: 16, flex: 1 }}>{formatDateLongue(valeur)}</Text>
        <Ionicons name="chevron-down" size={18} color={c.texteDoux} />
      </Pressable>
      {Platform.OS === 'web' ? (
        // Champ date natif du navigateur, invisible, posé sur la zone cliquable
        <input type="date" value={valeur} onChange={e => { if (e.target.value) onChange(e.target.value); }}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 52, width: '100%', opacity: 0, cursor: 'pointer', border: 0 }} />
      ) : null}
      {ouvert && Platform.OS !== 'web' && (
        <DateTimePicker
          value={parseISO(valeur)} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(e, d) => { setOuvert(Platform.OS === 'ios'); if (e.type === 'set' && d) onChange(toISO(d)); }}
        />
      )}
    </View>
  );
}

export function Compteur({ label, valeur, min = 1, max = 10, onChange, aide }: { label: string; valeur: number; min?: number; max?: number; onChange: (n: number) => void; aide?: string }) {
  const { c } = useTheme();
  const [texte, setTexte] = useState<string | null>(null);
  const borner = (n: number) => Math.min(max, Math.max(min, n));
  const bouton = (icone: NomIcone, actif: boolean, f: () => void, libelle: string) => (
    <Pressable onPress={f} disabled={!actif} hitSlop={6} accessibilityLabel={libelle}
      style={({ pressed }) => [{ width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primaireClair, opacity: actif ? (pressed ? 0.7 : 1) : 0.4 }]}>
      <Ionicons name={icone} size={22} color={c.primaire} />
    </Pressable>
  );
  return (
    <View style={{ marginBottom: ESPACE.l }}>
      <Text style={[styles.label, { color: c.texteDoux }]}>{label}</Text>
      <View style={[styles.champ, { backgroundColor: c.surface, borderColor: c.bordure, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 5 }]}>
        {bouton('remove', valeur > min, () => onChange(Math.max(min, valeur - 1)), t('Diminuer'))}
        <TextInput value={texte ?? String(valeur)} keyboardType="number-pad" selectTextOnFocus maxLength={3} accessibilityLabel={label}
          onFocus={() => setTexte('')} placeholder={String(valeur)}
          onChangeText={v => { const n = parseInt(v.replace(/\D/g, ''), 10); setTexte(v.replace(/\D/g, '')); if (!isNaN(n) && n >= min && n <= max) onChange(n); }}
          onBlur={() => { const n = parseInt(texte ?? '', 10); if (texte !== null) onChange(borner(isNaN(n) ? valeur : n)); setTexte(null); }}
          style={{ flex: 1, fontSize: 20, fontWeight: '700', color: c.texte, textAlign: 'center', minHeight: 44, padding: 0 }} />
        {bouton('add', valeur < max, () => onChange(Math.min(max, valeur + 1)), t('Augmenter'))}
      </View>
      {aide ? <TexteDoux style={{ marginTop: 6, fontSize: 13 }}>{aide}</TexteDoux> : null}
    </View>
  );
}

/* ---------- Statuts et progression ---------- */
const STATUTS: Record<StatutPaiement, { libelle: () => string; icone: NomIcone }> = {
  paye: { libelle: () => t('Payé'), icone: 'checkmark-circle' },
  partiel: { libelle: () => t('Partiel'), icone: 'contrast' },
  en_attente: { libelle: () => t('En attente'), icone: 'time-outline' },
  en_retard: { libelle: () => t('En retard'), icone: 'alert-circle' },
};
export function BadgeStatut({ statut, complement }: { statut: StatutPaiement; complement?: string }) {
  const { c } = useTheme();
  const s = c.statut[statut];
  return (
    <View style={{ backgroundColor: s.fond, paddingLeft: 7, paddingRight: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={STATUTS[statut].icone} size={14} color={s.texte} />
      <Text style={{ color: s.texte, fontWeight: '700', fontSize: 12 }}>{STATUTS[statut].libelle()}{complement ? ` · ${complement}` : ''}</Text>
    </View>
  );
}

export function BarreProgression({ valeur, max, couleur, fond, hauteur = 8 }: { valeur: number; max: number; couleur?: string; fond?: string; hauteur?: number }) {
  const { c } = useTheme();
  const p = max > 0 ? Math.min(1, valeur / max) : 0;
  return (
    <View style={{ height: hauteur, borderRadius: hauteur / 2, backgroundColor: fond ?? c.surface2, overflow: 'hidden', marginVertical: ESPACE.s }}
      accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}>
      <View style={{ width: `${p * 100}%`, height: '100%', backgroundColor: couleur ?? (p >= 1 ? c.primaire : c.or), borderRadius: hauteur / 2 }} />
    </View>
  );
}

/** Bandeau principal vert avec motifs décoratifs. */
export function Bandeau({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[{ backgroundColor: '#145F43', borderRadius: RAYON + 4, padding: ESPACE.xl, marginBottom: ESPACE.l, overflow: 'hidden' }, ombre(c, 2), style]}>
      <View pointerEvents="none" style={{ position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: '#1B7F5A', top: -110, right: -70 }} />
      <View pointerEvents="none" style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 20, borderColor: 'rgba(255,255,255,0.05)', bottom: -60, left: -40 }} />
      {children}
    </View>
  );
}

/* ---------- États vides et chargement ---------- */
export function EtatVide({ icone, titre, message, action, onAction }: { icone: NomIcone; titre: string; message: string; action?: string; onAction?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: ESPACE.l }}>
      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: c.primaireClair, alignItems: 'center', justifyContent: 'center', marginBottom: ESPACE.l }}>
        <Ionicons name={icone} size={40} color={c.primaire} />
      </View>
      <Text style={{ fontSize: 18, fontWeight: '700', color: c.texte, textAlign: 'center', marginBottom: ESPACE.s }}>{titre}</Text>
      <TexteDoux style={{ textAlign: 'center', marginBottom: ESPACE.xl, maxWidth: 320 }}>{message}</TexteDoux>
      {action && onAction ? <Bouton titre={action} onPress={onAction} style={{ paddingHorizontal: ESPACE.xl }} /> : null}
    </View>
  );
}

/** Encadré d'information discret (verrouillage, avertissement). */
export function Info({ icone = 'information-circle-outline', children, ton = 'neutre' }: { icone?: NomIcone; children: ReactNode; ton?: 'neutre' | 'alerte' }) {
  const { c } = useTheme();
  const couleur = ton === 'alerte' ? c.statut.partiel.texte : c.texteDoux;
  return (
    <View style={{ flexDirection: 'row', gap: ESPACE.s, alignItems: 'flex-start', backgroundColor: ton === 'alerte' ? c.statut.partiel.fond : c.surface2, borderRadius: 12, padding: ESPACE.m, marginBottom: ESPACE.m }}>
      <Ionicons name={icone} size={18} color={couleur} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, color: couleur, fontSize: 14, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

export function Chargement() {
  const { c } = useTheme();
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.fond }}><ActivityIndicator size="large" color={c.primaire} /></View>;
}

/* ---------- Dialogues ---------- */
export function confirmer(titre: string, message: string, libelle = t('Supprimer'), destructif = true): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${titre}\n\n${message}`));
  return new Promise(resolve => {
    Alert.alert(titre, message, [
      { text: t('Annuler'), style: 'cancel', onPress: () => resolve(false) },
      { text: libelle, style: destructif ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export function afficherErreur(e: unknown) {
  informer(t('Action impossible'), e instanceof Error ? e.message : String(e));
}

/** Message d'information (boîte native sur téléphone, alerte du navigateur sur le web). */
export function informer(titre: string, message?: string) {
  if (Platform.OS === 'web') window.alert(message ? `${titre}\n\n${message}` : titre);
  else Alert.alert(titre, message);
}

const styles = StyleSheet.create({
  bouton: { minHeight: 52, borderRadius: 14, paddingHorizontal: ESPACE.l, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  boutonPetit: { minHeight: 44, paddingHorizontal: ESPACE.m, borderRadius: 12 },
  boutonTexte: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, letterSpacing: 0.2 },
  champ: { minHeight: 52, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: ESPACE.m + 2, fontSize: 16 },
  segment: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  segmentItem: { flex: 1, minHeight: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, flexDirection: 'row', gap: 6 },
});
