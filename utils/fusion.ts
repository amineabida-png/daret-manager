/**
 * Fusion de deux sauvegardes complètes (celle du compte en ligne et celle de l'appareil),
 * sans rien perdre ni mélanger :
 * - une daret présente seulement sur l'appareil est ajoutée au compte (nouveaux identifiants) ;
 * - la même daret des deux côtés (même nom, montant, début, rythme, membres et ordre des tours)
 *   est combinée : paiements manquants ajoutés sans doublon, remises de cagnotte conservées ;
 * - deux darets de même nom mais au contenu différent sont gardées toutes les deux
 *   (la copie de l'appareil est renommée pour les distinguer).
 */
import type { Daret, Membre, Paiement, Tour } from '../types';
import type { Sauvegarde } from '../db/sauvegarde';

const norm = (s: string) => s.trim().toLocaleLowerCase().replace(/\s+/g, ' ');

/** Empreinte d'une daret : identique si c'est « la même » daret saisie sur deux appareils. */
function empreinte(d: Daret, s: Sauvegarde): string {
  const membres = s.membres.filter(m => m.daret_id === d.id);
  const nom = new Map(membres.map(m => [m.id, norm(m.nom)]));
  const tours = s.tours.filter(x => x.daret_id === d.id).sort((a, b) => a.numero - b.numero);
  return JSON.stringify([
    norm(d.nom), d.montant_part, d.date_debut, d.frequence, d.jour_echeance,
    membres.map(m => `${norm(m.nom)}×${m.nb_parts}`).sort(),
    tours.map(x => nom.get(x.beneficiaire_id) ?? ''),
  ]);
}

const max = (l: { id: number }[]) => l.reduce((m, x) => Math.max(m, x.id), 0);

export interface ResultatFusion {
  sauvegarde: Sauvegarde;
  ajoutees: number;
  combinees: number;
  paiementsAjoutes: number;
}

export function fusionner(compte: Sauvegarde, appareil: Sauvegarde, suffixeCopie = ' (cet appareil)'): ResultatFusion {
  const r: Sauvegarde = JSON.parse(JSON.stringify(compte));
  let idD = max(r.darets), idM = max(r.membres), idT = max(r.tours), idP = max(r.paiements);
  let ajoutees = 0, combinees = 0, paiementsAjoutes = 0;

  const empreintesCompte = new Map(r.darets.map(d => [empreinte(d, r), d]));
  const nomsCompte = new Set(r.darets.map(d => norm(d.nom)));

  for (const d of appareil.darets) {
    const membresApp = appareil.membres.filter(m => m.daret_id === d.id);
    const toursApp = appareil.tours.filter(x => x.daret_id === d.id);
    const idsToursApp = new Set(toursApp.map(x => x.id));
    const paiementsApp = appareil.paiements.filter(p => idsToursApp.has(p.tour_id));
    const meme = empreintesCompte.get(empreinte(d, appareil));

    if (meme) {
      // Même daret : on relie membres (par nom) et tours (par numéro), puis on complète
      combinees++;
      const membresCompte = r.membres.filter(m => m.daret_id === meme.id);
      const toursCompte = r.tours.filter(x => x.daret_id === meme.id);
      const membreVers = new Map<number, Membre>();
      for (const m of membresApp) {
        const cible = membresCompte.find(x => norm(x.nom) === norm(m.nom));
        if (cible) {
          membreVers.set(m.id, cible);
          if (!cible.telephone && m.telephone) cible.telephone = m.telephone;
          if (!cible.notes && m.notes) cible.notes = m.notes;
        }
      }
      const tourVers = new Map<number, Tour>();
      for (const x of toursApp) {
        const cible = toursCompte.find(y => y.numero === x.numero);
        if (cible) {
          tourVers.set(x.id, cible);
          if (!cible.remis_le && x.remis_le) cible.remis_le = x.remis_le;
        }
      }
      const cle = (p: Pick<Paiement, 'tour_id' | 'membre_id' | 'montant' | 'date_paiement' | 'mode'>) => `${p.tour_id}|${p.membre_id}|${p.montant}|${p.date_paiement}|${p.mode}`;
      const existants = new Set(r.paiements.map(cle));
      for (const p of paiementsApp) {
        const tour = tourVers.get(p.tour_id), membre = membreVers.get(p.membre_id);
        if (!tour || !membre) continue;
        const nouveau: Paiement = { ...p, id: ++idP, tour_id: tour.id, membre_id: membre.id };
        if (existants.has(cle(nouveau))) { idP--; continue; }
        existants.add(cle(nouveau));
        r.paiements.push(nouveau);
        paiementsAjoutes++;
      }
      if (meme.statut === 'en_cours' && toursCompte.length && toursCompte.every(x => x.remis_le)) meme.statut = 'terminee';
      continue;
    }

    // Daret différente : copie complète avec de nouveaux identifiants
    ajoutees++;
    const nouvelId = ++idD;
    const nom = nomsCompte.has(norm(d.nom)) ? `${d.nom}${suffixeCopie}` : d.nom;
    nomsCompte.add(norm(nom));
    r.darets.push({ ...d, id: nouvelId, nom });
    const membreVers = new Map<number, number>();
    for (const m of membresApp) { membreVers.set(m.id, ++idM); r.membres.push({ ...m, id: idM, daret_id: nouvelId }); }
    const tourVers = new Map<number, number>();
    for (const x of toursApp) {
      tourVers.set(x.id, ++idT);
      r.tours.push({ ...x, id: idT, daret_id: nouvelId, beneficiaire_id: membreVers.get(x.beneficiaire_id)! });
    }
    for (const p of paiementsApp) {
      r.paiements.push({ ...p, id: ++idP, tour_id: tourVers.get(p.tour_id)!, membre_id: membreVers.get(p.membre_id)! });
      paiementsAjoutes++;
    }
  }

  // Paramètres : ceux du compte priment, ceux qui manquent sont repris de l'appareil
  const cles = new Set(r.parametres.map(p => p.cle));
  for (const p of appareil.parametres) if (!cles.has(p.cle)) r.parametres.push({ ...p });
  r.exporte_le = new Date().toISOString();
  return { sauvegarde: r, ajoutees, combinees, paiementsAjoutes };
}
