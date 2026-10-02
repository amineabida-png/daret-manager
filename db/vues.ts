import type { Centimes, Daret, LigneStatut, Membre, Paiement, Tour } from '../types';
import { getDaret, getMembre, listerDarets, listerMembres, listerPaiementsDaret, listerTours } from './requetes';
import { aujourdhui } from '../utils/dates';
import { daretCommencee, lignesStatut, resumeTour, tourCourant } from '../utils/statuts';
import { montantTour, montantDuMembre } from '../utils/montant';
import { totalParts } from '../utils/calendrier';

export interface DetailDaret {
  daret: Daret;
  membres: Membre[];
  tours: Tour[];
  paiements: Paiement[];
  commencee: boolean;
  totalParts: number;
  montantTour: Centimes;
  courant?: Tour;
  /** Lignes de statut par identifiant de tour. */
  statuts: Map<number, LigneStatut[]>;
}

export async function chargerDetailDaret(id: number): Promise<DetailDaret | null> {
  const daret = await getDaret(id);
  if (!daret) return null;
  const [membres, tours, paiements] = await Promise.all([listerMembres(id), listerTours(id), listerPaiementsDaret(id)]);
  const today = aujourdhui();
  const statuts = new Map<number, LigneStatut[]>();
  for (const t of tours) statuts.set(t.id, lignesStatut(t, membres, paiements.filter(p => p.tour_id === t.id), daret.montant_part, today));
  const parts = totalParts(membres);
  return {
    daret, membres, tours, paiements, statuts,
    commencee: daretCommencee(tours, paiements.length, today),
    totalParts: parts, montantTour: montantTour(daret.montant_part, parts), courant: tourCourant(tours),
  };
}

export interface RetardGlobal {
  daret: Daret;
  tour: Tour;
  ligne: LigneStatut;
}

export interface CarteDaret {
  detail: DetailDaret;
  collecte: Centimes;
  attendu: Centimes;
  beneficiaire?: Membre;
}

export interface TableauBord {
  cartes: CarteDaret[];
  retards: RetardGlobal[];
  totalCollecte: Centimes;
  totalAttendu: Centimes;
  membresEnRetard: number;
}

/** Accueil : darets en cours, tour courant de chacune, et tous les retards (tous tours confondus). */
export async function chargerTableauBord(): Promise<TableauBord> {
  const darets = (await listerDarets()).filter(d => d.statut === 'en_cours');
  const details = (await Promise.all(darets.map(d => chargerDetailDaret(d.id)))).filter((x): x is DetailDaret => !!x);
  const cartes: CarteDaret[] = [];
  const retards: RetardGlobal[] = [];
  const membresRetard = new Set<number>();
  for (const detail of details) {
    const t = detail.courant;
    const lignes = t ? detail.statuts.get(t.id) ?? [] : [];
    const r = resumeTour(lignes);
    cartes.push({ detail, collecte: r.collecte, attendu: r.attendu || detail.montantTour, beneficiaire: detail.membres.find(m => m.id === t?.beneficiaire_id) });
    for (const tour of detail.tours) {
      for (const ligne of detail.statuts.get(tour.id) ?? []) {
        if (ligne.statut === 'en_retard') { retards.push({ daret: detail.daret, tour, ligne }); membresRetard.add(ligne.membre.id); }
      }
    }
  }
  retards.sort((a, b) => b.ligne.joursRetard - a.ligne.joursRetard);
  return {
    cartes, retards, membresEnRetard: membresRetard.size,
    totalCollecte: cartes.reduce((s, c) => s + c.collecte, 0),
    totalAttendu: cartes.reduce((s, c) => s + c.attendu, 0),
  };
}

export interface FicheMembre {
  membre: Membre;
  detail: DetailDaret;
  totalVerse: Centimes;
  totalDu: Centimes;
  toursRecus: Tour[];
  retards: { tour: Tour; ligne: LigneStatut }[];
  paiements: (Paiement & { tour: Tour })[];
}

export async function chargerFicheMembre(id: number): Promise<FicheMembre | null> {
  const membre = await getMembre(id);
  if (!membre) return null;
  const detail = await chargerDetailDaret(membre.daret_id);
  if (!detail) return null;
  const today = aujourdhui();
  const tourParId = new Map(detail.tours.map(t => [t.id, t]));
  const paiements = detail.paiements.filter(p => p.membre_id === id && tourParId.has(p.tour_id)).map(p => ({ ...p, tour: tourParId.get(p.tour_id)! }));
  const echus = detail.tours.filter(t => t.date_echeance <= today);
  const retards = detail.tours
    .map(tour => ({ tour, ligne: detail.statuts.get(tour.id)!.find(l => l.membre.id === id)! }))
    .filter(x => x.ligne?.statut === 'en_retard');
  return {
    membre, detail, paiements, retards,
    totalVerse: paiements.reduce((s, p) => s + p.montant, 0),
    totalDu: echus.length * montantDuMembre(detail.daret.montant_part, membre.nb_parts),
    toursRecus: detail.tours.filter(t => t.beneficiaire_id === id),
  };
}
