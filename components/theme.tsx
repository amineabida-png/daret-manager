import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nManager, Platform, useColorScheme, type ViewStyle } from 'react-native';
import { lireParametres } from '../db/requetes';
import { surChangement } from '../db';
import type { Langue, StatutPaiement, Theme } from '../types';
import { definirLangue, langueCourante } from '../i18n';

export interface Couleurs {
  primaire: string;
  primaireFonce: string;
  primaireClair: string;
  or: string;
  orClair: string;
  fond: string;
  surface: string;
  surface2: string;
  texte: string;
  texteDoux: string;
  bordure: string;
  danger: string;
  dangerClair: string;
  info: string;
  infoClair: string;
  sombre: boolean;
  statut: Record<StatutPaiement, { fond: string; texte: string }>;
}

const clair: Couleurs = {
  primaire: '#1B7F5A', primaireFonce: '#135E42', primaireClair: '#E3F3EC',
  or: '#C9A227', orClair: '#FBF3D9',
  fond: '#F2F5F3', surface: '#FFFFFF', surface2: '#E9EEEB',
  texte: '#102019', texteDoux: '#617069', bordure: '#DDE5E0', danger: '#C83A2E', dangerClair: '#FCE9E7',
  info: '#2F6FB5', infoClair: '#E6EFF9', sombre: false,
  statut: {
    paye: { fond: '#E3F3EC', texte: '#1B7F5A' },
    partiel: { fond: '#FDEBD3', texte: '#B35A00' },
    en_attente: { fond: '#ECEFEE', texte: '#5C6B64' },
    en_retard: { fond: '#FBE3E0', texte: '#C0392B' },
  },
};

const sombre: Couleurs = {
  primaire: '#2BA374', primaireFonce: '#1B7F5A', primaireClair: '#173A2C',
  or: '#E0B93F', orClair: '#3A3117',
  fond: '#0D1311', surface: '#161E1A', surface2: '#202A25',
  texte: '#EAF1ED', texteDoux: '#97A99F', bordure: '#2A3530', danger: '#F06B5D', dangerClair: '#3A1C18',
  info: '#7AB0EB', infoClair: '#1A2A3D', sombre: true,
  statut: {
    paye: { fond: '#173A2C', texte: '#4FD19D' },
    partiel: { fond: '#3D2A12', texte: '#F5A54A' },
    en_attente: { fond: '#262F2B', texte: '#9DB0A6' },
    en_retard: { fond: '#3E1C18', texte: '#F7897D' },
  },
};

const ThemeCtx = createContext<{ c: Couleurs; theme: Theme; langue: Langue; rtl: boolean }>({ c: clair, theme: 'systeme', langue: 'fr', rtl: false });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systeme = useColorScheme();
  const [theme, setTheme] = useState<Theme>('systeme');
  const [langue, setLangue] = useState<Langue>(langueCourante());
  const charger = useCallback(() => {
    lireParametres().then(p => {
      // La langue est appliquée avant le rendu pour que toutes les traductions suivent
      definirLangue(p.langue);
      setTheme(p.theme);
      setLangue(p.langue);
    }).catch(() => {});
  }, []);
  useEffect(() => { charger(); return surChangement(charger); }, [charger]);
  useEffect(() => {
    // Les éléments natifs (en-têtes, boîtes de dialogue) passent de droite à gauche au prochain démarrage
    I18nManager.allowRTL(true);
    if (I18nManager.isRTL !== (langue === 'ar')) I18nManager.forceRTL(langue === 'ar');
  }, [langue]);
  const valeur = useMemo(() => {
    const estSombre = theme === 'sombre' || (theme === 'systeme' && systeme === 'dark');
    return { c: estSombre ? sombre : clair, theme, langue, rtl: langue === 'ar' };
  }, [theme, systeme, langue]);
  return <ThemeCtx.Provider value={valeur}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);

export const ESPACE = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const RAYON = 16;

/** Ombre douce des cartes (élévation Android, ombre iOS) ; en mode sombre on garde une bordure fine. */
export function ombre(c: Couleurs, niveau = 1): ViewStyle {
  if (c.sombre) return { borderWidth: 1, borderColor: c.bordure };
  return Platform.select<ViewStyle>({
    android: { elevation: niveau * 2, shadowColor: '#0B2A1E' },
    default: { shadowColor: '#0B2A1E', shadowOpacity: 0.07 * niveau, shadowRadius: 6 * niveau, shadowOffset: { width: 0, height: 2 * niveau } },
  }) ?? {};
}
