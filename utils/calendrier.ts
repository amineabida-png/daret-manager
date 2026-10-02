import type { DateISO, Frequence, Membre } from '../types';
import { ajouterJours, dateDuMois, jourSemaineISO, parseISO, toISO } from './dates';

/** Nombre de tours = nombre total de parts. */
export function totalParts(membres: Pick<Membre, 'nb_parts'>[]): number {
  return membres.reduce((s, m) => s + m.nb_parts, 0);
}

/**
 * Première échéance à partir de la date de début (incluse).
 * - mensuelle : jour `jourEcheance` du mois (dernier jour si le mois est plus court) ;
 * - hebdomadaire / bimensuelle : premier jour de semaine `jourEcheance` (1 = lundi).
 */
export function premiereEcheance(dateDebut: DateISO, frequence: Frequence, jourEcheance: number): DateISO {
  if (frequence === 'mensuelle') {
    const d = parseISO(dateDebut);
    const ceMois = dateDuMois(d.getFullYear(), d.getMonth(), jourEcheance);
    if (toISO(ceMois) >= dateDebut) return toISO(ceMois);
    return toISO(dateDuMois(d.getFullYear(), d.getMonth() + 1, jourEcheance));
  }
  const decalage = (jourEcheance - jourSemaineISO(dateDebut) + 7) % 7;
  return ajouterJours(dateDebut, decalage);
}

/**
 * Dates d'échéance de `nbTours` tours.
 * Mensuelle : toujours calculée depuis le jour d'échéance demandé, pour qu'un 31 redevienne
 * le 31 après un mois court (31 janv. → 28 févr. → 31 mars).
 * Bimensuelle : tous les 14 jours.
 */
export function genererDates(dateDebut: DateISO, frequence: Frequence, jourEcheance: number, nbTours: number): DateISO[] {
  const premiere = premiereEcheance(dateDebut, frequence, jourEcheance);
  const dates: DateISO[] = [];
  if (frequence === 'mensuelle') {
    const p = parseISO(premiere);
    for (let i = 0; i < nbTours; i++) dates.push(toISO(dateDuMois(p.getFullYear(), p.getMonth() + i, jourEcheance)));
    return dates;
  }
  const pas = frequence === 'hebdomadaire' ? 7 : 14;
  for (let i = 0; i < nbTours; i++) dates.push(ajouterJours(premiere, i * pas));
  return dates;
}

/**
 * Ordre d'inscription : chaque membre apparaît autant de fois que de parts,
 * ses parts étant consécutives (ex. A, A, B, C).
 */
export function ordreInscription(membres: Pick<Membre, 'id' | 'nb_parts' | 'rang_inscription'>[]): number[] {
  return [...membres]
    .sort((a, b) => a.rang_inscription - b.rang_inscription)
    .flatMap(m => Array<number>(m.nb_parts).fill(m.id));
}

/** Tirage au sort (Fisher-Yates) des parts. `aleatoire` injectable pour les tests. */
export function ordreTirage(
  membres: Pick<Membre, 'id' | 'nb_parts' | 'rang_inscription'>[],
  aleatoire: () => number = Math.random,
): number[] {
  const parts = ordreInscription(membres);
  for (let i = parts.length - 1; i > 0; i--) {
    const j = Math.floor(aleatoire() * (i + 1));
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }
  return parts;
}

/** Vérifie qu'un ordre manuel contient exactement les parts de chaque membre. */
export function ordreValide(ordre: number[], membres: Pick<Membre, 'id' | 'nb_parts'>[]): boolean {
  if (ordre.length !== totalParts(membres)) return false;
  const compte = new Map<number, number>();
  for (const id of ordre) compte.set(id, (compte.get(id) ?? 0) + 1);
  return membres.every(m => compte.get(m.id) === m.nb_parts);
}

export interface TourGenere {
  numero: number;
  beneficiaire_id: number;
  date_echeance: DateISO;
}

/** Calendrier complet : un tour par part, dans l'ordre donné. */
export function genererCalendrier(
  ordre: number[],
  dateDebut: DateISO,
  frequence: Frequence,
  jourEcheance: number,
): TourGenere[] {
  const dates = genererDates(dateDebut, frequence, jourEcheance, ordre.length);
  return ordre.map((beneficiaire_id, i) => ({ numero: i + 1, beneficiaire_id, date_echeance: dates[i] }));
}

/** Échange les bénéficiaires de deux tours (les dates restent en place). */
export function echangerTours<T extends { numero: number; beneficiaire_id: number }>(tours: T[], numA: number, numB: number): T[] {
  const a = tours.find(t => t.numero === numA);
  const b = tours.find(t => t.numero === numB);
  if (!a || !b || numA === numB) return tours;
  return tours.map(t =>
    t.numero === numA ? { ...t, beneficiaire_id: b.beneficiaire_id } :
    t.numero === numB ? { ...t, beneficiaire_id: a.beneficiaire_id } : t,
  );
}
