/**
 * Tests d'intégration de la couche base de données avec un vrai moteur SQLite
 * (node:sqlite, intégré à Node ≥ 22.5) à la place d'expo-sqlite.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('expo-sqlite', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require('node:sqlite');
  return {
    openDatabaseAsync: async () => {
      const raw = new DatabaseSync(':memory:');
      const api = {
        execAsync: async (sql: string) => { raw.exec(sql); },
        runAsync: async (sql: string, ...p: unknown[]) => {
          const r = raw.prepare(sql).run(...p);
          return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
        },
        getAllAsync: async (sql: string, ...p: unknown[]) => raw.prepare(sql).all(...p).map((x: object) => ({ ...x })),
        getFirstAsync: async (sql: string, ...p: unknown[]) => { const x = raw.prepare(sql).get(...p); return x ? { ...x } : null; },
        withTransactionAsync: async (fn: () => Promise<void>) => {
          raw.exec('BEGIN');
          try { await fn(); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; }
        },
      };
      return api;
    },
  };
});

type Requetes = typeof import('../requetes');
let R: Requetes;
let S: typeof import('../sauvegarde');
let V: typeof import('../vues');
let D: typeof import('../demo');

beforeEach(() => {
  // Base neuve à chaque test
  jest.resetModules();
  R = require('../requetes');
  S = require('../sauvegarde');
  V = require('../vues');
  D = require('../demo');
});

const saisie = (date_debut = '2099-01-01') => ({ nom: 'Test', montant_part: 100000, frequence: 'mensuelle' as const, date_debut, jour_echeance: 31, notes: null });

describe('cycle de vie d\'une daret', () => {
  test('création, membres (dont 2 parts), ordre, calendrier fin de mois', async () => {
    const id = await R.creerDaret(saisie());
    await R.ajouterMembres(id, [
      { nom: 'A', telephone: null, nb_parts: 1, notes: null },
      { nom: 'B', telephone: '0612345678', nb_parts: 2, notes: null },
      { nom: 'C', telephone: null, nb_parts: 1, notes: null },
    ]);
    const membres = await R.listerMembres(id);
    expect(membres.map(m => m.rang_inscription)).toEqual([1, 2, 3]);
    await R.definirOrdre(id, 'inscription', [membres[0].id, membres[1].id, membres[1].id, membres[2].id]);
    const tours = await R.listerTours(id);
    expect(tours).toHaveLength(4);
    expect(tours.map(t => t.date_echeance)).toEqual(['2099-01-31', '2099-02-28', '2099-03-31', '2099-04-30']);
    const detail = (await V.chargerDetailDaret(id))!;
    expect(detail.montantTour).toBe(400000);
    expect(detail.commencee).toBe(false);
  });

  test('ordre invalide refusé, ajout de membre efface le calendrier', async () => {
    const id = await R.creerDaret(saisie());
    await R.ajouterMembres(id, [{ nom: 'A', telephone: null, nb_parts: 1, notes: null }, { nom: 'B', telephone: null, nb_parts: 1, notes: null }]);
    const [a, b] = await R.listerMembres(id);
    await expect(R.definirOrdre(id, 'manuel', [a.id])).rejects.toThrow('Ordre incomplet');
    await R.definirOrdre(id, 'manuel', [b.id, a.id]);
    expect((await R.listerTours(id))[0].beneficiaire_id).toBe(b.id);
    await R.ajouterMembres(id, [{ nom: 'C', telephone: null, nb_parts: 1, notes: null }]);
    expect(await R.listerTours(id)).toHaveLength(0);
    expect((await R.getDaret(id))!.mode_ordre).toBeNull();
  });

  test('paiements : complet, partiel, annulation ; daret commencée verrouillée', async () => {
    const id = await R.creerDaret(saisie());
    await R.ajouterMembres(id, [{ nom: 'A', telephone: null, nb_parts: 1, notes: null }, { nom: 'B', telephone: null, nb_parts: 2, notes: null }]);
    const [a, b] = await R.listerMembres(id);
    await R.definirOrdre(id, 'inscription', [a.id, b.id, b.id]);
    const [t1] = await R.listerTours(id);
    await R.payerReste(t1.id, a, 100000);
    await R.payerReste(t1.id, a, 100000); // aucun effet : déjà payé
    await R.ajouterPaiement(t1.id, b.id, 50000, '2099-01-20', 'virement');
    await R.payerReste(t1.id, b, 100000); // complète le reste : 150 000
    const p = await R.listerPaiementsTour(t1.id);
    expect(p.map(x => x.montant).sort((x, y) => x - y)).toEqual([50000, 100000, 150000]);
    expect(p.filter(x => x.membre_id === b.id).reduce((s, x) => s + x.montant, 0)).toBe(200000); // 2 parts
    expect(await R.estCommencee(id)).toBe(true);
    await expect(R.supprimerMembre(a.id)).rejects.toThrow('a commencé');
    await expect(R.definirOrdre(id, 'inscription', [a.id, b.id, b.id])).rejects.toThrow('a commencé');
    await R.annulerPaiements(t1.id, b.id);
    expect(await R.listerPaiementsTour(t1.id)).toHaveLength(1);
    await expect(R.ajouterPaiement(t1.id, a.id, 0, '2099-01-20', 'especes')).rejects.toThrow('positif');
  });

  test('échange de tours et remise : statut terminée automatiquement', async () => {
    const id = await R.creerDaret(saisie());
    await R.ajouterMembres(id, [{ nom: 'A', telephone: null, nb_parts: 1, notes: null }, { nom: 'B', telephone: null, nb_parts: 1, notes: null }]);
    const [a, b] = await R.listerMembres(id);
    await R.definirOrdre(id, 'inscription', [a.id, b.id]);
    const [t1, t2] = await R.listerTours(id);
    await R.echangerDeuxTours(t1.id, t2.id);
    expect((await R.listerTours(id)).map(t => t.beneficiaire_id)).toEqual([b.id, a.id]);
    await R.marquerRemis(t1.id, '2099-01-31');
    await expect(R.echangerDeuxTours(t1.id, t2.id)).rejects.toThrow('déjà remis');
    expect((await R.getDaret(id))!.statut).toBe('en_cours');
    await R.marquerRemis(t2.id, '2099-02-28');
    expect((await R.getDaret(id))!.statut).toBe('terminee');
    await R.marquerRemis(t2.id, null);
    expect((await R.getDaret(id))!.statut).toBe('en_cours');
  });

  test('modifier le rythme recalcule les dates en gardant les bénéficiaires', async () => {
    const id = await R.creerDaret(saisie());
    await R.ajouterMembres(id, [{ nom: 'A', telephone: null, nb_parts: 1, notes: null }, { nom: 'B', telephone: null, nb_parts: 1, notes: null }]);
    const [a, b] = await R.listerMembres(id);
    await R.definirOrdre(id, 'inscription', [b.id, a.id]);
    await R.modifierDaret(id, { ...saisie(), frequence: 'hebdomadaire', jour_echeance: 1 });
    const tours = await R.listerTours(id);
    expect(tours.map(t => t.date_echeance)).toEqual(['2099-01-05', '2099-01-12']); // 1er janv. 2099 = jeudi
    expect(tours.map(t => t.beneficiaire_id)).toEqual([b.id, a.id]);
  });

  test('suppression en cascade', async () => {
    const id = await R.creerDaret(saisie());
    await R.ajouterMembres(id, [{ nom: 'A', telephone: null, nb_parts: 1, notes: null }, { nom: 'B', telephone: null, nb_parts: 1, notes: null }]);
    await R.supprimerDaret(id);
    expect(await R.getDaret(id)).toBeNull();
    expect(await R.listerMembres(id)).toHaveLength(0);
  });
});

describe('démonstration, tableau de bord et sauvegarde', () => {
  test('données de démonstration cohérentes et visibles sur l\'accueil', async () => {
    const id = await D.chargerDemo();
    expect(await D.chargerDemo()).toBe(id); // pas de doublon
    const detail = (await V.chargerDetailDaret(id))!;
    expect(detail.membres).toHaveLength(6);
    expect(detail.tours).toHaveLength(7); // Youssef a 2 parts
    expect(detail.tours.filter(t => t.remis_le)).toHaveLength(2);
    expect(detail.courant?.numero).toBe(3);
    const tb = await V.chargerTableauBord();
    expect(tb.cartes).toHaveLength(1);
    expect(tb.retards.map(r => r.ligne.membre.nom).sort()).toEqual(['Naima', 'Omar', 'Rachid']);
    expect(tb.membresEnRetard).toBe(3);
    const fiche = (await V.chargerFicheMembre(detail.membres[1].id))!; // Youssef
    expect(fiche.toursRecus.map(t => t.numero)).toEqual([2, 3]);
    expect(await D.supprimerDemo()).toBe(true);
    expect((await V.chargerTableauBord()).cartes).toHaveLength(0);
  });

  test.each(['2026-01-01', '2026-03-01', '2026-10-01', '2026-10-31', '2028-02-29', '2026-07-15'])(
    'démonstration avec 3 retards quelle que soit la date (%s)',
    async jour => {
      jest.useFakeTimers({ now: new Date(`${jour}T10:00:00`), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
      try {
        const id = await D.chargerDemo();
        const detail = (await V.chargerDetailDaret(id))!;
        expect(detail.courant?.numero).toBe(3);
        const retards = (await V.chargerTableauBord()).retards;
        expect(retards.map(r => r.ligne.membre.nom).sort()).toEqual(['Naima', 'Omar', 'Rachid']);
        expect(Math.min(...retards.map(r => r.ligne.joursRetard))).toBeGreaterThanOrEqual(3);
      } finally {
        jest.useRealTimers();
      }
    },
  );

  test('export puis import JSON : données identiques', async () => {
    await D.chargerDemo();
    await R.ecrireParametre('delai_rappel', 3);
    const s = await S.exporterTout();
    expect(S.validerSauvegarde(s)).toEqual([]);
    const json = JSON.parse(JSON.stringify(s));
    await D.supprimerDemo();
    await R.ecrireParametre('delai_rappel', 1);
    await S.importerTout(json);
    const apres = await S.exporterTout();
    expect({ ...apres, exporte_le: '' }).toEqual({ ...s, exporte_le: '' });
    expect((await R.lireParametres()).delai_rappel).toBe(3);
  });

  test('import d\'un fichier invalide refusé sans rien effacer', async () => {
    const id = await D.chargerDemo();
    expect(S.validerSauvegarde({ application: 'autre' })).not.toEqual([]);
    const s = await S.exporterTout();
    const corrompue = { ...s, paiements: [...s.paiements, { ...s.paiements[0], id: 9999, tour_id: 123456 }] };
    await expect(S.importerTout(corrompue)).rejects.toThrow('Paiement invalide');
    expect(await R.getDaret(id)).not.toBeNull();
  });
});
