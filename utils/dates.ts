import type { DateISO } from '../types';
import { langueCourante } from '../i18n';

/** Analyse une date AAAA-MM-JJ en date locale (sans décalage de fuseau). */
export function parseISO(d: DateISO): Date {
  const [a, m, j] = d.split('-').map(Number);
  return new Date(a, m - 1, j);
}

export function toISO(d: Date): DateISO {
  const a = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${a}-${m}-${j}`;
}

export function aujourdhui(): DateISO {
  return toISO(new Date());
}

/** Nombre de jours dans un mois (mois 0-11). */
export function joursDansMois(annee: number, mois: number): number {
  return new Date(annee, mois + 1, 0).getDate();
}

/** Date au jour demandé du mois ; si le mois est plus court (ex. 31 en février), dernier jour du mois. */
export function dateDuMois(annee: number, mois: number, jour: number): Date {
  return new Date(annee, mois, Math.min(jour, joursDansMois(annee, mois)));
}

export function ajouterJours(d: DateISO, n: number): DateISO {
  const x = parseISO(d);
  x.setDate(x.getDate() + n);
  return toISO(x);
}

/** Différence en jours entiers : b - a. */
export function ecartJours(a: DateISO, b: DateISO): number {
  const ms = parseISO(b).getTime() - parseISO(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Jour de semaine ISO : 1 = lundi … 7 = dimanche. */
export function jourSemaineISO(d: DateISO): number {
  const j = parseISO(d).getDay();
  return j === 0 ? 7 : j;
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
// Noms marocains des mois et des jours (darija)
const MOIS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'];
const JOURS_AR = ['الحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** Nom du jour de semaine ISO (1 = lundi … 7 = dimanche) dans la langue courante. */
export function nomJourSemaine(iso: number): string {
  return (langueCourante() === 'ar' ? JOURS_AR : JOURS)[iso % 7];
}

/** Abréviations des jours (lundi → dimanche) pour les boutons de choix. */
export function joursCourts(): string[] {
  return langueCourante() === 'ar'
    ? ['اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت', 'حد']
    : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
}

/** « 5 mars 2026 » / « 5 مارس 2026 » */
export function formatDateLongue(d: DateISO): string {
  const x = parseISO(d);
  const mois = (langueCourante() === 'ar' ? MOIS_AR : MOIS)[x.getMonth()];
  return `${x.getDate()} ${mois} ${x.getFullYear()}`;
}

/** « lun. 5 mars » / « الاثنين 5 مارس » */
export function formatDateCourte(d: DateISO): string {
  const x = parseISO(d);
  if (langueCourante() === 'ar') return `${JOURS_AR[x.getDay()]} ${x.getDate()} ${MOIS_AR[x.getMonth()]}`;
  return `${JOURS[x.getDay()].slice(0, 3)}. ${x.getDate()} ${MOIS[x.getMonth()]}`;
}

/** « 05/03/2026 » */
export function formatDateNum(d: DateISO): string {
  const [a, m, j] = d.split('-');
  return `${j}/${m}/${a}`;
}

export function estDateISO(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toISO(parseISO(s)) === s;
}
