import { db, signalerChangement } from './index';
import { ajouterMembres, ajouterPaiement, creerDaret, definirOrdre, listerMembres, listerTours, marquerRemis } from './requetes';
import { ajouterJours, aujourdhui, dateDuMois, parseISO, toISO } from '../utils/dates';
import { ordreInscription } from '../utils/calendrier';
import { montantDuMembre } from '../utils/montant';
import { langueCourante } from '../i18n';

export const NOM_DEMO = 'Daret des voisins (démo)';
export const NOM_DEMO_AR = 'دارت الجيران (تجربة)';

/** Textes de la démonstration dans la langue courante. */
function textesDemo() {
  if (langueCourante() === 'ar') {
    return {
      nom: NOM_DEMO_AR, notes: 'معطيات ديال التجربة — تقدر تمسحها من الإعدادات.',
      membres: [['فاطمة الزهراء', null], ['يوسف', 'كيخلص عليه وعلى ختو'], ['خديجة', null], ['رشيد', null], ['نعيمة', null], ['عمر', 'ما عندوش واتساب']] as const,
    };
  }
  return {
    nom: NOM_DEMO, notes: 'Données de démonstration — à supprimer depuis les paramètres.',
    membres: [['Fatima Zahra', null], ['Youssef', 'Cotise pour lui et sa sœur'], ['Khadija', null], ['Rachid', null], ['Naima', null], ['Omar', 'Pas de WhatsApp']] as const,
  };
}

/**
 * Crée une daret de démonstration de 6 membres (dont un à 2 parts → 7 tours),
 * commencée il y a deux mois : 2 tours remis, le tour courant avec des payés, un partiel et des retards.
 */
export async function chargerDemo(): Promise<number> {
  const d = await db();
  const existe = await d.getFirstAsync<{ id: number }>('SELECT id FROM darets WHERE nom IN (?, ?)', NOM_DEMO, NOM_DEMO_AR);
  const tx = textesDemo();
  if (existe) return existe.id;

  // Le tour 3 tombe au moins 3 jours avant aujourd'hui (quel que soit le jour du mois) ;
  // les tours 1 et 2 sont les deux mois précédents.
  const ilYa3Jours = parseISO(ajouterJours(aujourdhui(), -3));
  const jour = Math.min(ilYa3Jours.getDate(), 28);
  const debut = dateDuMois(ilYa3Jours.getFullYear(), ilYa3Jours.getMonth() - 2, jour);
  const montantPart = 100000; // 1 000 DH

  const id = await creerDaret({
    nom: tx.nom, montant_part: montantPart, frequence: 'mensuelle', date_debut: toISO(debut), jour_echeance: jour,
    notes: tx.notes,
  });
  await ajouterMembres(id, [
    { nom: tx.membres[0][0], telephone: '0612345678', nb_parts: 1, notes: tx.membres[0][1] },
    { nom: tx.membres[1][0], telephone: '0623456789', nb_parts: 2, notes: tx.membres[1][1] },
    { nom: tx.membres[2][0], telephone: '0634567890', nb_parts: 1, notes: tx.membres[2][1] },
    { nom: tx.membres[3][0], telephone: '0645678901', nb_parts: 1, notes: tx.membres[3][1] },
    { nom: tx.membres[4][0], telephone: '0656789012', nb_parts: 1, notes: tx.membres[4][1] },
    { nom: tx.membres[5][0], telephone: null, nb_parts: 1, notes: tx.membres[5][1] },
  ]);
  const membres = await listerMembres(id);
  await definirOrdre(id, 'inscription', ordreInscription(membres));
  const tours = await listerTours(id);

  // Tours 1 et 2 : tout le monde a payé, cagnotte remise
  for (const t of tours.slice(0, 2)) {
    for (const m of membres) {
      await ajouterPaiement(t.id, m.id, montantDuMembre(montantPart, m.nb_parts), ajouterJours(t.date_echeance, -1), m.id % 2 ? 'especes' : 'virement');
    }
    await marquerRemis(t.id, t.date_echeance);
  }
  // Tour 3 (échéance passée de 3 jours) : 3 payés, Rachid partiel (en retard), Naima et Omar en retard
  const t3 = tours[2];
  if (t3) {
    const [fz, yo, kh, ra] = membres;
    await ajouterPaiement(t3.id, fz.id, montantDuMembre(montantPart, fz.nb_parts), ajouterJours(t3.date_echeance, -2), 'especes');
    await ajouterPaiement(t3.id, yo.id, montantDuMembre(montantPart, yo.nb_parts), ajouterJours(t3.date_echeance, -1), 'virement');
    await ajouterPaiement(t3.id, kh.id, montantDuMembre(montantPart, kh.nb_parts), t3.date_echeance, 'especes');
    await ajouterPaiement(t3.id, ra.id, 40000, ajouterJours(t3.date_echeance, -1), 'especes');
  }
  signalerChangement();
  return id;
}

export async function supprimerDemo(): Promise<boolean> {
  const r = await (await db()).runAsync('DELETE FROM darets WHERE nom IN (?, ?)', NOM_DEMO, NOM_DEMO_AR);
  signalerChangement();
  return r.changes > 0;
}
