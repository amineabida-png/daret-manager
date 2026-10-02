import { describe, expect, test } from '@jest/globals';
import { historiqueCSV, lienWhatsApp, MODELE_WHATSAPP_DEFAUT, numeroWhatsApp, recapitulatifTour, remplirModele } from '../partage';
import type { Daret, LigneStatut, Membre, Paiement, Tour } from '../../types';

const daret: Daret = {
  id: 1, nom: 'Daret Famille', montant_part: 100000, frequence: 'mensuelle', date_debut: '2026-01-01',
  jour_echeance: 5, mode_ordre: 'inscription', statut: 'en_cours', notes: null, cree_le: '', modifie_le: '',
};
const m = (id: number, nom: string): Membre => ({ id, daret_id: 1, nom, telephone: null, nb_parts: 1, rang_inscription: id, notes: null, cree_le: '' });

describe('WhatsApp', () => {
  test('numéros marocains convertis au format international', () => {
    expect(numeroWhatsApp('06 12 34 56 78')).toBe('212612345678');
    expect(numeroWhatsApp('0712345678')).toBe('212712345678');
    expect(numeroWhatsApp('+212 6 12 34 56 78')).toBe('212612345678');
    expect(numeroWhatsApp('00212612345678')).toBe('212612345678');
    expect(numeroWhatsApp('+33 6 12 34 56 78')).toBe('33612345678');
    expect(numeroWhatsApp('12')).toBeNull();
    expect(numeroWhatsApp('')).toBeNull();
  });
  test('lien wa.me avec message encodé', () => {
    expect(lienWhatsApp('0612345678', 'Salam & merci')).toBe('https://wa.me/212612345678?text=Salam%20%26%20merci');
    expect(lienWhatsApp(null, 'Bonjour')).toBe('https://wa.me/?text=Bonjour');
  });
  test('modèle de relance rempli', () => {
    const txt = remplirModele(MODELE_WHATSAPP_DEFAUT, { nom: 'Fatima', montant: '1 000,00 DH', date: '5 mars 2026', daret: 'Daret Famille' });
    expect(txt).toContain('Bonjour Fatima');
    expect(txt).toContain('1 000,00 DH');
    expect(txt).toContain('« Daret Famille »');
    expect(txt).not.toMatch(/\{\w+\}/);
  });
});

describe('récapitulatif et CSV', () => {
  const tour: Tour = { id: 10, daret_id: 1, numero: 2, beneficiaire_id: 2, date_echeance: '2026-02-05', remis_le: null };
  const lignes: LigneStatut[] = [
    { membre: m(1, 'Amine'), du: 100000, verse: 100000, statut: 'paye', joursRetard: 0 },
    { membre: m(2, 'Sara'), du: 100000, verse: 40000, statut: 'en_retard', joursRetard: 3 },
  ];
  test('récapitulatif du tour', () => {
    const txt = recapitulatifTour(daret, tour, m(2, 'Sara'), lignes, 6);
    expect(txt).toContain('Tour 2/6');
    expect(txt).toContain('Bénéficiaire : Sara');
    expect(txt).toContain('Ont payé (1)');
    expect(txt).toMatch(/🔴 Sara — reste 600,00 DH \(3 j de retard\)/);
  });
  test('CSV : en-tête, séparateur « ; », montants à virgule, champs échappés', () => {
    const paiements: Paiement[] = [
      { id: 1, tour_id: 10, membre_id: 1, montant: 100000, date_paiement: '2026-02-03', mode: 'especes', cree_le: '' },
      { id: 2, tour_id: 10, membre_id: 2, montant: 40000, date_paiement: '2026-02-04', mode: 'virement', cree_le: '' },
    ];
    const csv = historiqueCSV({ ...daret, nom: 'Daret "Famille"; 2026' }, [tour], [m(1, 'Amine'), m(2, 'Sara')], paiements);
    const lignesCsv = csv.replace('﻿', '').trim().split('\n');
    expect(lignesCsv[0]).toBe('Daret : "Daret ""Famille""; 2026"');
    expect(lignesCsv[1]).toBe('Tour;Échéance;Bénéficiaire;Membre;Montant (DH);Date paiement;Mode');
    expect(lignesCsv[2]).toBe('2;05/02/2026;Sara;Amine;1000,00;03/02/2026;Espèces');
    expect(lignesCsv[3]).toBe('2;05/02/2026;Sara;Sara;400,00;04/02/2026;Virement');
  });
});
