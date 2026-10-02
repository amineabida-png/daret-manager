import type { Centimes, DateISO, LigneStatut, Membre, Paiement, StatutPaiement, Tour } from '../types';
import { ecartJours } from './dates';
import { montantDuMembre } from './montant';

/**
 * Statut d'un membre pour un tour :
 * - payé : versé ≥ dû ;
 * - en retard : échéance dépassée et versé < dû (même partiellement) ;
 * - partiel : quelque chose de versé avant l'échéance ;
 * - en attente : rien de versé, échéance pas encore passée.
 */
export function statutPaiement(du: Centimes, verse: Centimes, echeance: DateISO, aujourdhui: DateISO): StatutPaiement {
  if (verse >= du) return 'paye';
  if (aujourdhui > echeance) return 'en_retard';
  if (verse > 0) return 'partiel';
  return 'en_attente';
}

export function joursDeRetard(echeance: DateISO, aujourdhui: DateISO): number {
  return Math.max(0, ecartJours(echeance, aujourdhui));
}

export function totalVerse(paiements: Pick<Paiement, 'membre_id' | 'montant'>[], membreId: number): Centimes {
  return paiements.filter(p => p.membre_id === membreId).reduce((s, p) => s + p.montant, 0);
}

/** Statut de chaque membre pour un tour (paiements = ceux du tour). */
export function lignesStatut(
  tour: Pick<Tour, 'date_echeance'>,
  membres: Membre[],
  paiements: Pick<Paiement, 'membre_id' | 'montant'>[],
  montantPart: Centimes,
  aujourdhui: DateISO,
): LigneStatut[] {
  return membres.map(membre => {
    const du = montantDuMembre(montantPart, membre.nb_parts);
    const verse = totalVerse(paiements, membre.id);
    const statut = statutPaiement(du, verse, tour.date_echeance, aujourdhui);
    return { membre, du, verse, statut, joursRetard: statut === 'en_retard' ? joursDeRetard(tour.date_echeance, aujourdhui) : 0 };
  });
}

/** Résumé d'un tour : collecté (plafonné au dû de chacun) et attendu. */
export function resumeTour(lignes: LigneStatut[]): { collecte: Centimes; attendu: Centimes; enRetard: number; payes: number } {
  return {
    collecte: lignes.reduce((s, l) => s + Math.min(l.verse, l.du), 0),
    attendu: lignes.reduce((s, l) => s + l.du, 0),
    enRetard: lignes.filter(l => l.statut === 'en_retard').length,
    payes: lignes.filter(l => l.statut === 'paye').length,
  };
}

/** Tour « en cours » : le premier tour non remis au bénéficiaire, sinon le dernier. */
export function tourCourant<T extends Pick<Tour, 'numero' | 'remis_le'>>(tours: T[]): T | undefined {
  const tries = [...tours].sort((a, b) => a.numero - b.numero);
  return tries.find(t => !t.remis_le) ?? tries[tries.length - 1];
}

/** La daret est commencée dès que la 1re échéance est atteinte ou qu'un paiement existe. */
export function daretCommencee(tours: Pick<Tour, 'date_echeance'>[], nbPaiements: number, aujourdhui: DateISO): boolean {
  if (nbPaiements > 0) return true;
  if (!tours.length) return false;
  const premiere = tours.reduce((m, t) => (t.date_echeance < m ? t.date_echeance : m), tours[0].date_echeance);
  // Le jour même de la 1re échéance, on peut encore compléter la liste (daret créée le jour J)
  return premiere < aujourdhui;
}
