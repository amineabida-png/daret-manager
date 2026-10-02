import type { Centimes } from '../types';
import { langueCourante } from '../i18n';

/**
 * Formate un montant en centimes au format marocain : « 1 500,00 DH ».
 * Séparateur de milliers : espace insécable fine (U+202F) remplacée par une espace insécable
 * classique pour un rendu identique sur tous les téléphones.
 */
export function formatDH(centimes: Centimes): string {
  const negatif = centimes < 0;
  const abs = Math.abs(Math.round(centimes));
  const entier = Math.floor(abs / 100);
  const decimales = String(abs % 100).padStart(2, '0');
  const milliers = String(entier).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${negatif ? '-' : ''}${milliers},${decimales} ${langueCourante() === 'ar' ? 'درهم' : 'DH'}`;
}

/**
 * Convertit une saisie utilisateur (« 1500 », « 1 500,50 », « 1500.5 ») en centimes.
 * Renvoie null si la saisie n'est pas un montant valide.
 */
export function parseDH(saisie: string): Centimes | null {
  const propre = saisie.replace(/[\s  ]/g, '').replace(/(DH|درهم)$/i, '').replace(',', '.').replace(/[٠-٩]/g, ch => String(ch.charCodeAt(0) - 0x660));
  if (!/^\d+(\.\d{1,2})?$/.test(propre)) return null;
  return Math.round(parseFloat(propre) * 100);
}

/** Montant d'un tour = montant par part × nombre total de parts. */
export function montantTour(montantPart: Centimes, totalParts: number): Centimes {
  return montantPart * totalParts;
}

/** Montant dû par un membre à chaque tour = montant par part × ses parts. */
export function montantDuMembre(montantPart: Centimes, nbParts: number): Centimes {
  return montantPart * nbParts;
}
