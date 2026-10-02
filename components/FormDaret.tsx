import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ESPACE, RAYON } from './theme';
import { Bouton, Champ, ChampDate, Compteur, Info, Ligne, Segment, TexteDoux } from './ui';
import type { DaretSaisie } from '../db/requetes';
import type { Frequence } from '../types';
import { aujourdhui, formatDateCourte, joursCourts, jourSemaineISO, parseISO } from '../utils/dates';
import { t } from '../i18n';
import { genererDates } from '../utils/calendrier';
import { formatDH, parseDH } from '../utils/montant';

/** Nombre maximal de participants proposé à la création. */
export const MAX_PARTICIPANTS = 60;

export type ChoixOrdre = 'tirage' | 'saisie';

export function FormDaret({ initial, onValider, libelle }: { initial?: DaretSaisie; onValider: (s: DaretSaisie, participants: string[], ordre: ChoixOrdre) => Promise<void>; libelle: string }) {
  const { c } = useTheme();
  const debutDefaut = initial?.date_debut ?? aujourdhui();
  const [nom, setNom] = useState(initial?.nom ?? '');
  const [montant, setMontant] = useState(initial ? String(initial.montant_part / 100).replace('.', ',') : '');
  const [frequence, setFrequence] = useState<Frequence>(initial?.frequence ?? 'mensuelle');
  const [dateDebut, setDateDebut] = useState(debutDefaut);
  const [jourMois, setJourMois] = useState(initial?.frequence === 'mensuelle' ? initial.jour_echeance : parseISO(debutDefaut).getDate());
  const [jourSemaine, setJourSemaine] = useState(initial && initial.frequence !== 'mensuelle' ? initial.jour_echeance : jourSemaineISO(debutDefaut));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [envoi, setEnvoi] = useState(false);
  const creation = !initial;
  const [nbParticipants, setNbParticipants] = useState(10);
  const [noms, setNoms] = useState<string[]>([]);
  const [choixOrdre, setChoixOrdre] = useState<ChoixOrdre>('tirage');
  const [essai, setEssai] = useState(false);

  const montantCentimes = parseDH(montant);
  const erreurs = {
    nom: !nom.trim() ? t('Donnez un nom à la daret') : null,
    montant: montantCentimes === null || montantCentimes <= 0 ? t('Montant invalide (ex. 1000 ou 1 500,50)') : null,
  };
  const jour = frequence === 'mensuelle' ? jourMois : jourSemaine;
  const apercu = useMemo(() => genererDates(dateDebut, frequence, jour, 4), [dateDebut, frequence, jour]);

  async function valider() {
    setEssai(true);
    if (erreurs.nom || erreurs.montant) return;
    setEnvoi(true);
    try {
      // Participants sans nom : « Participant 3 », renommables ensuite depuis l'onglet Membres
      const participants = creation
        ? Array.from({ length: nbParticipants }, (_, i) => noms[i]?.trim() || t('Participant {n}', { n: i + 1 }))
        : [];
      await onValider({ nom: nom.trim(), montant_part: montantCentimes!, frequence, date_debut: dateDebut, jour_echeance: jour, notes: notes.trim() || null }, participants, choixOrdre);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <View>
      <Champ label={t('Nom de la daret')} value={nom} onChangeText={setNom} placeholder={t('Ex. Daret de la famille')} erreur={essai ? erreurs.nom : null} autoFocus={!initial} />
      <Champ label={t('Montant par part (DH)')} value={montant} onChangeText={setMontant} placeholder={t('Ex. 1000')} keyboardType="decimal-pad"
        erreur={essai ? erreurs.montant : null} aide={montantCentimes ? t('Chaque membre verse {montant} par part à chaque échéance.', { montant: formatDH(montantCentimes) }) : undefined} />
      {creation ? (
        <Compteur label={t('Nombre de participants')} valeur={nbParticipants} min={2} max={MAX_PARTICIPANTS} onChange={setNbParticipants}
          aide={montantCentimes ? t('Cagnotte par tour : {montant} ({n} tours).', { montant: formatDH(montantCentimes * nbParticipants), n: nbParticipants }) : t('Une personne = un tour. Un membre à 2 parts se règle ensuite dans l\'onglet Membres.')} />
      ) : null}
      <Segment label={t('Fréquence')} valeur={frequence} onChange={setFrequence}
        options={[{ valeur: 'hebdomadaire', libelle: t('Semaine') }, { valeur: 'bimensuelle', libelle: t('15 jours') }, { valeur: 'mensuelle', libelle: t('Mois') }]} />
      <ChampDate label={t('Date de début')} valeur={dateDebut} onChange={setDateDebut} />

      {frequence === 'mensuelle' ? (
        <Compteur label={t('Jour d\'échéance dans le mois')} valeur={jourMois} min={1} max={31} onChange={setJourMois} />
      ) : (
        <View style={{ marginBottom: ESPACE.l }}>
          <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 6, color: c.texteDoux, letterSpacing: 0.2 }}>{t('Jour d\'échéance')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {joursCourts().map((j, i) => {
              const actif = jourSemaine === i + 1;
              return (
                <Pressable key={j} onPress={() => setJourSemaine(i + 1)}
                  style={{ flex: 1, minWidth: 40, minHeight: 44, borderRadius: RAYON - 4, alignItems: 'center', justifyContent: 'center', backgroundColor: actif ? c.primaire : c.surface2 }}>
                  <Text style={{ fontWeight: '700', fontSize: 13, color: actif ? '#FFF' : c.texteDoux }}>{j}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      {frequence === 'mensuelle' && jourMois > 28 ? (
        <Info>{t('Les mois plus courts, l\'échéance tombe le dernier jour du mois.')}</Info>
      ) : null}

      <View style={{ backgroundColor: c.primaireClair, borderRadius: RAYON, padding: ESPACE.m, marginBottom: ESPACE.l }}>
        <Ligne style={{ gap: 6, marginBottom: ESPACE.s }}>
          <Ionicons name="calendar" size={16} color={c.primaire} />
          <Text style={{ fontWeight: '700', color: c.primaire, fontSize: 13, letterSpacing: 0.4 }}>{t('PREMIÈRES ÉCHÉANCES')}</Text>
        </Ligne>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {apercu.map((d, i) => (
            <View key={d} style={{ backgroundColor: c.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: c.texte, fontSize: 13, fontWeight: '600' }}><Text style={{ color: c.texteDoux, fontWeight: '400' }}>{i + 1}. </Text>{formatDateCourte(d)}</Text>
            </View>
          ))}
        </View>
      </View>

      {creation ? (
        <>
        <Segment<ChoixOrdre> label={t('Ordre des tours')} valeur={choixOrdre} onChange={setChoixOrdre}
          options={[{ valeur: 'tirage', libelle: t('Tirage au sort'), icone: 'dice-outline' }, { valeur: 'saisie', libelle: t('Ordre de saisie'), icone: 'list-outline' }]} />
        <Info icone={choixOrdre === 'tirage' ? 'dice-outline' : 'list-outline'}>{choixOrdre === 'tirage'
          ? t('Après la création, l\'application tire au sort qui reçoit la cagnotte au 1er tour, au 2e tour, et ainsi de suite.')
          : t('Le 1er nom de la liste reçoit la cagnotte au 1er tour, le 2e au 2e tour, et ainsi de suite.')}</Info>
        <View style={{ marginBottom: ESPACE.l }}>
          <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 6, color: c.texteDoux, letterSpacing: 0.2 }}>{choixOrdre === 'tirage' ? t('Noms des participants') : t('Noms des participants (dans l\'ordre des tours)')}</Text>
          <TexteDoux style={{ fontSize: 13, marginBottom: ESPACE.s }}>{t('Facultatif : vous pourrez les compléter plus tard, ajouter les téléphones et changer l\'ordre.')}</TexteDoux>
          {Array.from({ length: nbParticipants }, (_, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACE.s, marginBottom: 6 }}>
              <Text style={{ width: 26, textAlign: 'center', fontWeight: '700', color: c.texteDoux }}>{i + 1}</Text>
              <TextInput value={noms[i] ?? ''} onChangeText={v => setNoms(l => { const n = [...l]; n[i] = v; return n; })}
                placeholder={t('Participant {n}', { n: i + 1 })} placeholderTextColor={c.texteDoux + 'AA'} autoCapitalize="words"
                style={{ flex: 1, minHeight: 46, borderWidth: 1.5, borderColor: c.bordure, borderRadius: 12, paddingHorizontal: ESPACE.m, fontSize: 16, color: c.texte, backgroundColor: c.surface }} />
            </View>
          ))}
        </View>
        </>
      ) : (
        <Info icone="people-outline">{t('Pour ajouter ou modifier les participants, utilisez l\'onglet Membres de la daret.')}</Info>
      )}

      <Champ label={t('Notes (facultatif)')} value={notes} onChangeText={setNotes} multiline placeholder={t('Lieu de remise, règles du groupe…')} />
      <Bouton titre={libelle} icone="checkmark" onPress={valider} chargement={envoi} />
    </View>
  );
}
