import type { Langue } from '../i18n';

/** Montants exprimés en centimes (entiers) pour éviter les erreurs d'arrondi. */
export type Centimes = number;

/** Date au format AAAA-MM-JJ. */
export type DateISO = string;

export type Frequence = 'hebdomadaire' | 'bimensuelle' | 'mensuelle';
export type ModeOrdre = 'manuel' | 'tirage' | 'inscription';
export type StatutDaret = 'en_cours' | 'terminee' | 'archivee';
export type ModePaiement = 'especes' | 'virement' | 'autre';
export type StatutPaiement = 'paye' | 'partiel' | 'en_attente' | 'en_retard';
export type Theme = 'clair' | 'sombre' | 'systeme';
export type { Langue };

export interface Daret {
  id: number;
  nom: string;
  montant_part: Centimes;
  frequence: Frequence;
  date_debut: DateISO;
  /** Mensuelle : jour du mois (1-31). Hebdomadaire / bimensuelle : jour de semaine (1 = lundi … 7 = dimanche). */
  jour_echeance: number;
  mode_ordre: ModeOrdre | null;
  statut: StatutDaret;
  notes: string | null;
  cree_le: string;
  modifie_le: string;
}

export interface Membre {
  id: number;
  daret_id: number;
  nom: string;
  telephone: string | null;
  nb_parts: number;
  rang_inscription: number;
  notes: string | null;
  cree_le: string;
}

export interface Tour {
  id: number;
  daret_id: number;
  numero: number;
  beneficiaire_id: number;
  date_echeance: DateISO;
  remis_le: DateISO | null;
}

export interface Paiement {
  id: number;
  tour_id: number;
  membre_id: number;
  montant: Centimes;
  date_paiement: DateISO;
  mode: ModePaiement;
  cree_le: string;
}

export interface Parametres {
  theme: Theme;
  delai_rappel: 1 | 2 | 3;
  modele_whatsapp: string;
  langue: Langue;
}

/** Ligne de statut d'un membre pour un tour donné. */
export interface LigneStatut {
  membre: Membre;
  du: Centimes;
  verse: Centimes;
  statut: StatutPaiement;
  joursRetard: number;
}
