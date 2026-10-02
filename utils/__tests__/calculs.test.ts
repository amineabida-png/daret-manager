import { describe, expect, test } from '@jest/globals';
import { formatDH, montantDuMembre, montantTour, parseDH } from '../montant';
import { ajouterJours, dateDuMois, ecartJours, estDateISO, jourSemaineISO, toISO } from '../dates';
import {
  echangerTours, genererCalendrier, genererDates, ordreInscription, ordreTirage, ordreValide, premiereEcheance, totalParts,
} from '../calendrier';
import { daretCommencee, joursDeRetard, lignesStatut, resumeTour, statutPaiement, tourCourant } from '../statuts';
import type { Membre } from '../../types';

const membre = (id: number, nb_parts = 1, rang_inscription = id): Membre => ({
  id, daret_id: 1, nom: `M${id}`, telephone: null, nb_parts, rang_inscription, notes: null, cree_le: '',
});

describe('montants', () => {
  test('format « 1 500,00 DH »', () => {
    expect(formatDH(150000)).toBe('1 500,00 DH');
    expect(formatDH(5)).toBe('0,05 DH');
    expect(formatDH(123456789)).toBe('1 234 567,89 DH');
    expect(formatDH(-2500)).toBe('-25,00 DH');
  });
  test('saisie → centimes', () => {
    expect(parseDH('1500')).toBe(150000);
    expect(parseDH('1 500,50')).toBe(150050);
    expect(parseDH('1500.5')).toBe(150050);
    expect(parseDH('1 500 DH')).toBe(150000);
    expect(parseDH('abc')).toBeNull();
    expect(parseDH('12,345')).toBeNull();
  });
  test('montant du tour = montant par part × nombre total de parts', () => {
    const membres = [membre(1), membre(2, 2), membre(3)];
    expect(totalParts(membres)).toBe(4);
    expect(montantTour(100000, totalParts(membres))).toBe(400000);
    expect(montantDuMembre(100000, 2)).toBe(200000);
  });
});

describe('dates', () => {
  test('fin de mois : le 31 devient le dernier jour du mois', () => {
    expect(toISO(dateDuMois(2026, 1, 31))).toBe('2026-02-28');
    expect(toISO(dateDuMois(2028, 1, 31))).toBe('2028-02-29'); // bissextile
    expect(toISO(dateDuMois(2026, 3, 31))).toBe('2026-04-30');
    expect(toISO(dateDuMois(2026, 0, 31))).toBe('2026-01-31');
  });
  test('passage d\'année et écarts', () => {
    expect(toISO(dateDuMois(2026, 12, 15))).toBe('2027-01-15');
    expect(ajouterJours('2026-12-30', 5)).toBe('2027-01-04');
    expect(ecartJours('2026-02-25', '2026-03-03')).toBe(6);
    expect(jourSemaineISO('2026-09-28')).toBe(1); // lundi
    expect(jourSemaineISO('2026-10-04')).toBe(7); // dimanche
  });
  test('validation de date', () => {
    expect(estDateISO('2026-02-28')).toBe(true);
    expect(estDateISO('2026-02-30')).toBe(false);
    expect(estDateISO('28/02/2026')).toBe(false);
  });
});

describe('calendrier', () => {
  test('nombre de tours = nombre total de parts', () => {
    const membres = [membre(1), membre(2, 2), membre(3, 3)];
    const cal = genererCalendrier(ordreInscription(membres), '2026-01-01', 'mensuelle', 5);
    expect(cal).toHaveLength(6);
    expect(cal.map(t => t.numero)).toEqual([1, 2, 3, 4, 5, 6]);
  });
  test('un membre à 2 parts apparaît 2 fois', () => {
    const ordre = ordreInscription([membre(1), membre(2, 2), membre(3)]);
    expect(ordre).toEqual([1, 2, 2, 3]);
    expect(ordre.filter(id => id === 2)).toHaveLength(2);
  });
  test('mensuelle avec échéance le 31 : 31 janv., 28 févr., 31 mars, 30 avr.', () => {
    expect(genererDates('2026-01-01', 'mensuelle', 31, 4)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });
  test('mensuelle : 1re échéance le mois suivant si le jour est déjà passé', () => {
    expect(premiereEcheance('2026-03-20', 'mensuelle', 5)).toBe('2026-04-05');
    expect(premiereEcheance('2026-03-05', 'mensuelle', 5)).toBe('2026-03-05');
    expect(genererDates('2026-11-10', 'mensuelle', 5, 3)).toEqual(['2026-12-05', '2027-01-05', '2027-02-05']);
  });
  test('hebdomadaire : chaque semaine au jour choisi', () => {
    // 2026-10-01 est un jeudi ; échéance le lundi (1)
    expect(genererDates('2026-10-01', 'hebdomadaire', 1, 3)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);
    // le jour même compte
    expect(premiereEcheance('2026-10-05', 'hebdomadaire', 1)).toBe('2026-10-05');
  });
  test('bimensuelle : tous les 14 jours', () => {
    expect(genererDates('2026-10-01', 'bimensuelle', 4, 3)).toEqual(['2026-10-01', '2026-10-15', '2026-10-29']);
  });
  test('tirage au sort : toutes les parts, ordre reproductible avec un aléa fixé', () => {
    const membres = [membre(1), membre(2, 2), membre(3), membre(4)];
    let graine = 0.42;
    const alea = () => { graine = (graine * 9301 + 49297) % 233280 / 233280; return graine; };
    const ordre = ordreTirage(membres, alea);
    expect(ordreValide(ordre, membres)).toBe(true);
    expect([...ordre].sort()).toEqual([1, 2, 2, 3, 4]);
  });
  test('ordre manuel invalide détecté', () => {
    const membres = [membre(1), membre(2, 2)];
    expect(ordreValide([1, 2, 2], membres)).toBe(true);
    expect(ordreValide([1, 2], membres)).toBe(false);
    expect(ordreValide([1, 1, 2], membres)).toBe(false);
  });
  test('échange de deux tours : bénéficiaires inversés, dates inchangées', () => {
    const cal = genererCalendrier([1, 2, 3], '2026-01-01', 'mensuelle', 10);
    const ech = echangerTours(cal, 1, 3);
    expect(ech.map(t => t.beneficiaire_id)).toEqual([3, 2, 1]);
    expect(ech.map(t => t.date_echeance)).toEqual(cal.map(t => t.date_echeance));
    expect(echangerTours(cal, 1, 1)).toBe(cal);
  });
});

describe('statuts de paiement', () => {
  const ech = '2026-10-10';
  test('payé, partiel, en attente, en retard', () => {
    expect(statutPaiement(100000, 100000, ech, '2026-10-20')).toBe('paye');
    expect(statutPaiement(100000, 120000, ech, '2026-10-01')).toBe('paye');
    expect(statutPaiement(100000, 40000, ech, '2026-10-05')).toBe('partiel');
    expect(statutPaiement(100000, 0, ech, '2026-10-05')).toBe('en_attente');
    expect(statutPaiement(100000, 0, ech, ech)).toBe('en_attente'); // le jour même n'est pas en retard
  });
  test('en retard si échéance passée et versé < dû (même partiellement)', () => {
    expect(statutPaiement(100000, 0, ech, '2026-10-11')).toBe('en_retard');
    expect(statutPaiement(100000, 99999, ech, '2026-10-11')).toBe('en_retard');
    expect(joursDeRetard(ech, '2026-10-17')).toBe(7);
    expect(joursDeRetard(ech, '2026-10-01')).toBe(0);
  });
  test('lignes et résumé d\'un tour', () => {
    const membres = [membre(1), membre(2, 2), membre(3)];
    const paiements = [{ membre_id: 1, montant: 50000 }, { membre_id: 2, montant: 60000 }, { membre_id: 2, montant: 60000 }];
    // 500 DH par part ; le membre 2 (2 parts) doit 1 000 DH et a versé 2 × 600 DH = 1 200 DH
    const lignes = lignesStatut({ date_echeance: ech }, membres, paiements, 50000, '2026-10-13');
    expect(lignes.map(l => l.statut)).toEqual(['paye', 'paye', 'en_retard']);
    expect(lignes[1]).toMatchObject({ du: 100000, verse: 120000 });
    expect(lignes[2]).toMatchObject({ du: 50000, verse: 0, joursRetard: 3 });
    // collecté plafonné au dû de chacun (le surplus du membre 2 ne compte pas)
    expect(resumeTour(lignes)).toEqual({ collecte: 150000, attendu: 200000, enRetard: 1, payes: 2 });
  });
});

describe('avancement de la daret', () => {
  test('tour en cours = premier tour non remis', () => {
    const tours = [{ numero: 2, remis_le: null }, { numero: 1, remis_le: '2026-01-05' }, { numero: 3, remis_le: null }];
    expect(tourCourant(tours)?.numero).toBe(2);
    expect(tourCourant(tours.map(t => ({ ...t, remis_le: '2026-02-01' })))?.numero).toBe(3);
    expect(tourCourant([])).toBeUndefined();
  });
  test('daret commencée : 1re échéance atteinte ou paiement existant', () => {
    const tours = [{ date_echeance: '2026-11-05' }, { date_echeance: '2026-12-05' }];
    expect(daretCommencee(tours, 0, '2026-10-01')).toBe(false);
    expect(daretCommencee(tours, 1, '2026-10-01')).toBe(true);
    expect(daretCommencee(tours, 0, '2026-11-05')).toBe(true);
    expect(daretCommencee([], 0, '2026-11-05')).toBe(false);
  });
});
