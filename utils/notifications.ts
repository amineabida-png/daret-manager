import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { db } from '../db';
import { lireParametres } from '../db/requetes';
import type { Daret, Membre, Paiement, Tour } from '../types';
import { ajouterJours, aujourdhui, formatDateLongue, parseISO } from './dates';
import { lignesStatut } from './statuts';
import { formatDH, montantTour } from './montant';
import { estRTL, t, tn } from '../i18n';

const CANAL = 'rappels';
const HEURE = 9;
const MAX_TOURS = 40; // Android limite le nombre d'alarmes programmées

// Les rappels programmés n'existent que dans l'application installée (pas dans le navigateur)
export const RAPPELS_DISPONIBLES = Platform.OS !== 'web';

if (RAPPELS_DISPONIBLES) Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

export async function initialiserNotifications(): Promise<boolean> {
  if (!RAPPELS_DISPONIBLES) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CANAL, {
      name: t('Rappels d\'échéance'),
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const demande = await Notifications.requestPermissionsAsync();
  return demande.status === 'granted';
}

function aNeufHeures(date: string): Date {
  const d = parseISO(date);
  d.setHours(HEURE, 0, 0, 0);
  return d;
}

async function programmer(titre: string, corps: string, quand: Date, data: Record<string, unknown>): Promise<string | null> {
  if (quand.getTime() <= Date.now()) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title: titre, body: corps, data },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: quand, channelId: CANAL },
  });
}

let enCours: Promise<void> | null = null;
let aRefaire = false;

/** Annule puis reprogramme tous les rappels (appelé après chaque modification). */
export function replanifierRappels(): Promise<void> {
  if (!RAPPELS_DISPONIBLES) return Promise.resolve();
  if (enCours) { aRefaire = true; return enCours; }
  enCours = (async () => {
    try {
      do {
        aRefaire = false;
        await planifier();
      } while (aRefaire);
    } finally {
      enCours = null;
    }
  })();
  return enCours;
}

async function planifier(): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  const d = await db();
  await Notifications.cancelAllScheduledNotificationsAsync();
  await d.runAsync('DELETE FROM rappels');
  if (status !== 'granted') return;

  const { delai_rappel } = await lireParametres();
  const today = aujourdhui();
  const darets = await d.getAllAsync<Daret>(`SELECT * FROM darets WHERE statut = 'en_cours'`);
  const aVenir: { daret: Daret; tour: Tour }[] = [];
  for (const daret of darets) {
    const tours = await d.getAllAsync<Tour>('SELECT * FROM tours WHERE daret_id = ? AND remis_le IS NULL AND date_echeance >= ? ORDER BY numero', daret.id, today);
    tours.forEach(tour => aVenir.push({ daret, tour }));
  }
  aVenir.sort((a, b) => a.tour.date_echeance.localeCompare(b.tour.date_echeance));

  for (const { daret, tour } of aVenir.slice(0, MAX_TOURS)) {
    const membres = await d.getAllAsync<Membre>('SELECT * FROM membres WHERE daret_id = ?', daret.id);
    const paiements = await d.getAllAsync<Paiement>('SELECT * FROM paiements WHERE tour_id = ?', tour.id);
    const benef = membres.find(m => m.id === tour.beneficiaire_id)?.nom ?? '—';
    const lignes = lignesStatut(tour, membres, paiements, daret.montant_part, today);
    const impayes = lignes.filter(l => l.statut !== 'paye');
    const parts = membres.reduce((s, m) => s + m.nb_parts, 0);
    const data = { daretId: daret.id, tourId: tour.id };

    const avant = await programmer(
      `⏰ ${daret.nom} — ${tn(delai_rappel, 'échéance dans {n} jour', 'échéance dans {n} jours')}`,
      t('Tour {n} le {date} · bénéficiaire : {nom} · {montant}', { n: tour.numero, date: formatDateLongue(tour.date_echeance), nom: benef, montant: formatDH(montantTour(daret.montant_part, parts)) }),
      aNeufHeures(ajouterJours(tour.date_echeance, -delai_rappel)), data,
    );
    if (avant) await d.runAsync(`INSERT INTO rappels (tour_id, type, notification_id) VALUES (?, 'avant', ?)`, tour.id, avant);

    if (impayes.length) {
      const jourJ = await programmer(
        `📅 ${daret.nom} — ${t('échéance aujourd\'hui')}`,
        tn(impayes.length, '{n} membre n\'a pas encore payé : {noms}', '{n} membres n\'ont pas encore payé : {noms}',
          { noms: impayes.map(l => l.membre.nom).slice(0, 4).join(estRTL() ? '، ' : ', ') + (impayes.length > 4 ? '…' : '') }),
        aNeufHeures(tour.date_echeance), data,
      );
      if (jourJ) await d.runAsync(`INSERT INTO rappels (tour_id, type, notification_id) VALUES (?, 'jour_j', ?)`, tour.id, jourJ);
    }
  }
}
