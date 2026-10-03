import { describe, expect, test } from '@jest/globals';
import { fusionner } from '../fusion';
import type { Sauvegarde } from '../../db/sauvegarde';
import type { Daret, Membre, Paiement, Tour } from '../../types';

/** Petite sauvegarde : une daret, ses membres, ses tours et des paiements. */
function sauvegarde(base: number, nom: string, membres: string[], paiements: [number, number, number][] = [], remis: number[] = []): Sauvegarde {
  const d: Daret = { id: base, nom, montant_part: 100000, frequence: 'mensuelle', date_debut: '2026-01-05', jour_echeance: 5, mode_ordre: 'inscription', statut: 'en_cours', notes: null, cree_le: '', modifie_le: '' };
  const ms: Membre[] = membres.map((n, i) => ({ id: base * 10 + i, daret_id: base, nom: n, telephone: null, nb_parts: 1, rang_inscription: i + 1, notes: null, cree_le: '' }));
  const ts: Tour[] = ms.map((m, i) => ({ id: base * 10 + i, daret_id: base, numero: i + 1, beneficiaire_id: m.id, date_echeance: `2026-0${i + 1}-05`, remis_le: remis.includes(i + 1) ? `2026-0${i + 1}-05` : null }));
  const ps: Paiement[] = paiements.map(([tour, membre, montant], i) => ({ id: base * 100 + i, tour_id: ts[tour - 1].id, membre_id: ms[membre].id, montant, date_paiement: '2026-01-04', mode: 'especes', cree_le: '' }));
  return { application: 'daret-manager', version_schema: 1, exporte_le: '', darets: [d], membres: ms, tours: ts, paiements: ps, parametres: [{ cle: 'langue', valeur: 'fr' }] };
}

function coherente(s: Sauvegarde) {
  const ids = (l: { id: number }[]) => new Set(l.map(x => x.id));
  const [d, m, t] = [ids(s.darets), ids(s.membres), ids(s.tours)];
  for (const k of ['darets', 'membres', 'tours', 'paiements'] as const) expect(ids(s[k]).size).toBe(s[k].length); // ids uniques
  s.membres.forEach(x => expect(d.has(x.daret_id)).toBe(true));
  s.tours.forEach(x => { expect(d.has(x.daret_id)).toBe(true); expect(m.has(x.beneficiaire_id)).toBe(true); });
  s.paiements.forEach(x => { expect(t.has(x.tour_id)).toBe(true); expect(m.has(x.membre_id)).toBe(true); });
}

describe('fusion compte + appareil', () => {
  test('une daret présente seulement sur l\'appareil est ajoutée avec tout son contenu', () => {
    const compte = sauvegarde(1, 'Famille', ['Amine', 'Houda'], [[1, 0, 100000]]);
    const appareil = sauvegarde(1, 'Voisins', ['Karim', 'Salma', 'Nadia'], [[1, 0, 100000], [1, 1, 50000]]); // mêmes ids que le compte !
    const r = fusionner(compte, appareil);
    expect(r.ajoutees).toBe(1);
    expect(r.sauvegarde.darets.map(x => x.nom)).toEqual(['Famille', 'Voisins']);
    expect(r.sauvegarde.membres).toHaveLength(5);
    expect(r.sauvegarde.paiements).toHaveLength(3);
    coherente(r.sauvegarde);
  });

  test('la même daret des deux côtés est combinée sans doublon', () => {
    const compte = sauvegarde(1, 'Famille', ['Amine', 'Houda'], [[1, 0, 100000]]);
    const appareil = sauvegarde(7, 'famille ', ['Amine', 'Houda'], [[1, 0, 100000], [1, 1, 100000]], [1]);
    const r = fusionner(compte, appareil);
    expect(r.combinees).toBe(1);
    expect(r.ajoutees).toBe(0);
    expect(r.paiementsAjoutes).toBe(1); // seul le paiement de Houda manquait
    expect(r.sauvegarde.darets).toHaveLength(1);
    expect(r.sauvegarde.paiements).toHaveLength(2);
    expect(r.sauvegarde.tours.find(x => x.numero === 1)!.remis_le).toBe('2026-01-05'); // remise conservée
    coherente(r.sauvegarde);
  });

  test('même nom mais contenu différent : les deux sont gardées, la copie est renommée', () => {
    const compte = sauvegarde(1, 'Famille', ['Amine', 'Houda']);
    const appareil = sauvegarde(2, 'Famille', ['Amine', 'Houda', 'Karim']);
    const r = fusionner(compte, appareil);
    expect(r.sauvegarde.darets.map(x => x.nom)).toEqual(['Famille', 'Famille (cet appareil)']);
    coherente(r.sauvegarde);
  });

  test('fusionner deux fois de suite ne crée rien de plus', () => {
    const compte = sauvegarde(1, 'Famille', ['Amine', 'Houda'], [[1, 0, 100000]]);
    const appareil = sauvegarde(3, 'Voisins', ['Karim', 'Salma'], [[1, 1, 100000]]);
    const une = fusionner(compte, appareil).sauvegarde;
    const deux = fusionner(une, appareil);
    expect(deux.ajoutees).toBe(0);
    expect(deux.paiementsAjoutes).toBe(0);
    expect(deux.sauvegarde.darets).toHaveLength(2);
  });
});
