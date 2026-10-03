import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ESPACE } from '../../components/theme';
import { Avatar, Bandeau, BadgeStatut, BarreProgression, Carte, Chargement, Ecran, EtatVide, Info, Ligne, Segment, SousTitre, TexteDoux } from '../../components/ui';
import { ecrireParametre } from '../../db/requetes';
import { lireDaretPublique, messageErreur, type DaretPublique } from '../../utils/synchro';
import { lignesStatut, resumeTour, tourCourant } from '../../utils/statuts';
import { formatDH } from '../../utils/montant';
import { aujourdhui, formatDateCourte, formatDateLongue, nomJourSemaine } from '../../utils/dates';
import type { Membre } from '../../types';
import { t, tn } from '../../i18n';

/**
 * Page publique d'une daret partagée : calendrier et paiements en lecture seule,
 * pour les membres du groupe (aucune donnée personnelle comme les téléphones).
 */
export default function DaretPubliqueEcran() {
  const { c, langue } = useTheme();
  const jeton = String(useLocalSearchParams<{ jeton: string }>().jeton);
  const [d, setD] = useState<DaretPublique | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    const charger = () => lireDaretPublique(jeton).then(x => { if (actif) { setD(x); setErreur(null); } }).catch(e => { if (actif) setErreur(messageErreur(e)); });
    charger();
    const minuterie = setInterval(charger, 60_000);
    return () => { actif = false; clearInterval(minuterie); };
  }, [jeton]);

  const choixLangue = (
    <Segment valeur={langue} onChange={v => { ecrireParametre('langue', v).catch(() => {}); }}
      options={[{ valeur: 'fr', libelle: 'Français' }, { valeur: 'ar', libelle: 'الدارجة' }]} />
  );

  if (erreur && !d) return <Ecran><Stack.Screen options={{ title: 'Daret Manager' }} />{choixLangue}<EtatVide icone="link-outline" titre={t('Lien indisponible')} message={erreur} /></Ecran>;
  if (!d) return <Chargement />;

  const today = aujourdhui();
  const membres: Membre[] = d.membres.map(m => ({ ...m, daret_id: d.daret.id, telephone: null, notes: null, cree_le: '' }));
  const nom = new Map(membres.map(m => [m.id, m.nom]));
  const totalParts = membres.reduce((s, m) => s + m.nb_parts, 0);
  const tours = [...d.tours].sort((a, b) => a.numero - b.numero);
  const courant = tourCourant(tours);
  const remis = tours.filter(x => x.remis_le).length;
  const freq = d.daret.frequence === 'mensuelle' ? t('Chaque mois, le {j}', { j: d.daret.jour_echeance })
    : d.daret.frequence === 'hebdomadaire' ? t('Chaque {jour}', { jour: nomJourSemaine(d.daret.jour_echeance) })
    : t('Un {jour} sur deux', { jour: nomJourSemaine(d.daret.jour_echeance) });

  return (
    <Ecran>
      <Stack.Screen options={{ title: d.daret.nom, headerBackVisible: false }} />
      {choixLangue}
      <Info icone="eye-outline">{t('Consultation en lecture seule · mise à jour {date}', { date: formatDateLongue(d.maj_le.slice(0, 10)) })}</Info>
      <Bandeau>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' }}>{t('Cagnotte par tour')}</Text>
        <Text style={{ color: '#FFF', fontSize: 30, fontWeight: '700' }} adjustsFontSizeToFit numberOfLines={1}>{formatDH(d.daret.montant_part * totalParts)}</Text>
        <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600', marginTop: 6 }}>{t('{montant} / part', { montant: formatDH(d.daret.montant_part) })} · {tn(membres.length, '{n} membre', '{n} membres')} · {freq}</Text>
        {tours.length ? (
          <>
            <BarreProgression valeur={remis} max={tours.length} couleur="#E6BE45" fond="rgba(255,255,255,0.18)" hauteur={6} />
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{tn(remis, '{n} tour remis sur {total}', '{n} tours remis sur {total}', { total: tours.length })}</Text>
          </>
        ) : null}
      </Bandeau>

      {!tours.length ? <Info icone="calendar-outline">{t('Calendrier pas encore généré.')}</Info> : null}

      {tours.map(tr => {
        const lignes = lignesStatut(tr, membres, d.paiements.filter(p => p.tour_id === tr.id), d.daret.montant_part, today);
        const r = resumeTour(lignes);
        const estCourant = courant?.id === tr.id;
        const detail = !tr.remis_le && (estCourant || tr.date_echeance <= today);
        return (
          <Carte key={tr.id} style={estCourant ? { borderWidth: 2, borderColor: c.or } : undefined}>
            <Ligne style={{ gap: ESPACE.m }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: tr.remis_le ? c.primaire : estCourant ? c.or : c.surface2 }}>
                {tr.remis_le ? <Ionicons name="checkmark" size={22} color="#FFF" /> : <Text style={{ fontWeight: '700', fontSize: 16, color: estCourant ? '#241C05' : c.texteDoux }}>{tr.numero}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: c.texte }} numberOfLines={1}>{nom.get(tr.beneficiaire_id) ?? '—'}</Text>
                <TexteDoux style={{ fontSize: 13 }}>{t('Tour {n}', { n: tr.numero })} · {formatDateCourte(tr.date_echeance)}</TexteDoux>
              </View>
              {tr.remis_le ? <Text style={{ color: c.primaire, fontWeight: '600', fontSize: 13 }}>{t('Remis')}</Text>
                : estCourant ? <Text style={{ color: c.sombre ? c.or : '#8A6A0C', fontWeight: '700', fontSize: 12 }}>{t('En cours')}</Text>
                : <TexteDoux style={{ fontSize: 13 }}>{t('À venir')}</TexteDoux>}
            </Ligne>
            {detail ? (
              <View style={{ marginTop: ESPACE.s }}>
                <BarreProgression valeur={r.collecte} max={r.attendu} hauteur={6} />
                <TexteDoux style={{ fontSize: 13, marginBottom: ESPACE.s }}>{tn(r.payes, '{n}/{total} payé', '{n}/{total} payés', { total: lignes.length })} · {formatDH(r.collecte)} / {formatDH(r.attendu)}</TexteDoux>
                {lignes.map(l => (
                  <Ligne key={l.membre.id} style={{ gap: ESPACE.s, paddingVertical: 4 }}>
                    <Avatar nom={l.membre.nom} taille={28} />
                    <Text style={{ flex: 1, color: c.texte }} numberOfLines={1}>{l.membre.nom}</Text>
                    <BadgeStatut statut={l.statut} complement={l.statut === 'en_retard' ? t('{n} j', { n: l.joursRetard }) : undefined} />
                  </Ligne>
                ))}
              </View>
            ) : null}
          </Carte>
        );
      })}
      <SousTitre style={{ marginTop: ESPACE.m }}>Daret Manager</SousTitre>
      <TexteDoux style={{ fontSize: 13 }}>{t('Page partagée par l\'organisateur de la daret. Seul l\'organisateur peut enregistrer les paiements.')}</TexteDoux>
    </Ecran>
  );
}
