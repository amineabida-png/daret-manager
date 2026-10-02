import { ar } from './ar';

/** Langues de l'interface : français (par défaut) et darija marocaine en écriture arabe. */
export type Langue = 'fr' | 'ar';

let courante: Langue = 'fr';

export function definirLangue(l: Langue): void {
  courante = l;
}

export const langueCourante = (): Langue => courante;
export const estRTL = (): boolean => courante === 'ar';

/**
 * Traduit un texte français (qui sert de clé) dans la langue courante,
 * puis remplace les variables {nom}. Sans traduction, le français est conservé.
 */
export function t(texte: string, vars?: Record<string, string | number>): string {
  let s = courante === 'ar' ? (ar[texte] ?? texte) : texte;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Choisit la forme singulier / pluriel (français) puis traduit. */
export function tn(n: number, un: string, plusieurs: string, vars?: Record<string, string | number>): string {
  return t(n > 1 ? plusieurs : un, { n, ...vars });
}
