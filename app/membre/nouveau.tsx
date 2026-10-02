import { useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Contacts from 'expo-contacts';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ESPACE, RAYON } from '../../components/theme';
import { Avatar, Bouton, Carte, Champ, Compteur, Ecran, Info, Ligne, SousTitre, TexteDoux, afficherErreur } from '../../components/ui';
import { ajouterMembres, listerMembres, type MembreSaisie } from '../../db/requetes';
import { useDonnees } from '../../components/useDonnees';
import { t } from '../../i18n';

interface ContactSimple { id: string; nom: string; telephone: string | null; }

export default function NouveauMembre() {
  const { c } = useTheme();
  const daretId = Number(useLocalSearchParams<{ daretId: string }>().daretId);
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [parts, setParts] = useState(1);
  const [notes, setNotes] = useState('');
  const [aAjouter, setAAjouter] = useState<MembreSaisie[]>([]);
  const [contacts, setContacts] = useState<ContactSimple[] | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [nbRapide, setNbRapide] = useState(10);
  const existants = useDonnees(() => listerMembres(daretId), [daretId]).data?.length ?? 0;

  /** Ajout rapide : N participants numérotés, à renommer ensuite si besoin. */
  function ajouterPlusieurs() {
    setAAjouter(l => [...l, ...Array.from({ length: nbRapide }, (_, i) => ({
      nom: t('Participant {n}', { n: existants + l.length + i + 1 }), telephone: null, nb_parts: 1, notes: null,
    }))]);
  }

  function ajouterALaListe() {
    if (!nom.trim()) return;
    setAAjouter(l => [...l, { nom: nom.trim(), telephone: telephone.trim() || null, nb_parts: parts, notes: notes.trim() || null }]);
    setNom(''); setTelephone(''); setParts(1); setNotes('');
  }

  async function ouvrirContacts() {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      afficherErreur(new Error(t('Permission refusée. Autorisez l\'accès aux contacts dans les réglages Android pour les importer.')));
      return;
    }
    const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name], sort: Contacts.SortTypes.FirstName });
    setContacts(data.filter(x => x.name).map(x => ({ id: x.id ?? x.name, nom: x.name, telephone: x.phoneNumbers?.[0]?.number ?? null })));
  }

  async function enregistrer() {
    const liste = nom.trim() ? [...aAjouter, { nom: nom.trim(), telephone: telephone.trim() || null, nb_parts: parts, notes: notes.trim() || null }] : aAjouter;
    if (!liste.length) return;
    setEnvoi(true);
    try {
      await ajouterMembres(daretId, liste);
      // Tous les membres sont saisis : le calendrier est à refaire → tirage au sort automatique
      if (existants + liste.length >= 2) router.replace({ pathname: '/daret/[id]/ordre', params: { id: daretId, mode: 'tirage', auto: '1' } });
      else router.back();
    } catch (e) { afficherErreur(e); } finally { setEnvoi(false); }
  }

  const total = aAjouter.length + (nom.trim() ? 1 : 0);
  return (
    <Ecran>
      {Platform.OS !== 'web' ? <Bouton titre={t('Importer depuis mes contacts')} icone="people-outline" variante="secondaire" onPress={() => ouvrirContacts().catch(afficherErreur)} style={{ marginBottom: ESPACE.xl }} /> : null}
      <Carte>
        <Compteur label={t('Nombre de participants')} valeur={nbRapide} min={1} max={60} onChange={setNbRapide}
          aide={t('Ajoute d\'un coup des participants numérotés ; vous pourrez saisir leurs noms ensuite.')} />
        <Bouton titre={t('Ajouter {n} participants', { n: nbRapide })} icone="people" variante="secondaire" onPress={ajouterPlusieurs} />
      </Carte>
      <SousTitre style={{ marginTop: ESPACE.s }}>{t('Ou un par un')}</SousTitre>
      <Champ label={t('Nom')} value={nom} onChangeText={setNom} placeholder={t('Ex. Fatima Zahra')} autoCapitalize="words" />
      <Champ label={t('Téléphone (facultatif)')} value={telephone} onChangeText={setTelephone} placeholder="06 12 34 56 78" keyboardType="phone-pad" aide={t('Utilisé pour les relances WhatsApp.')} />
      <Compteur label={t('Nombre de parts')} valeur={parts} min={1} max={10} onChange={setParts} />
      <Champ label={t('Notes (facultatif)')} value={notes} onChangeText={setNotes} />
      <Bouton titre={t('Ajouter et saisir un autre')} icone="add" variante="secondaire" onPress={ajouterALaListe} desactive={!nom.trim()} style={{ marginBottom: ESPACE.l }} />

      {aAjouter.length ? (
        <>
          <SousTitre>{t('À ajouter ({n})', { n: aAjouter.length })}</SousTitre>
          {aAjouter.map((m, i) => (
            <Carte key={i} style={{ paddingVertical: ESPACE.m }}>
              <Ligne style={{ gap: ESPACE.m }}>
                <Avatar nom={m.nom} taille={36} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: c.texte }}>{m.nom}{m.nb_parts > 1 ? ` · ${t('{n} parts', { n: m.nb_parts })}` : ''}</Text>
                  {m.telephone ? <TexteDoux style={{ fontSize: 13 }}>{m.telephone}</TexteDoux> : null}
                </View>
                <Pressable onPress={() => setAAjouter(l => l.filter((_, j) => j !== i))} hitSlop={12} accessibilityLabel={t('Retirer')}>
                  <Ionicons name="close-circle" size={24} color={c.texteDoux} />
                </Pressable>
              </Ligne>
            </Carte>
          ))}
        </>
      ) : null}

      <Bouton titre={total > 1 ? t('Enregistrer {n} membres', { n: total }) : t('Enregistrer')} icone="checkmark" onPress={enregistrer} chargement={envoi} desactive={!total} style={{ marginBottom: ESPACE.m }} />
      <Info>{t('Si le calendrier a déjà été généré, il faudra redéfinir l\'ordre des tours.')}</Info>

      <ChoixContacts contacts={contacts} onFermer={() => setContacts(null)} onChoisir={choisis => {
        setAAjouter(l => [...l, ...choisis.map(x => ({ nom: x.nom, telephone: x.telephone, nb_parts: 1, notes: null }))]);
        setContacts(null);
      }} />
    </Ecran>
  );
}

function ChoixContacts({ contacts, onFermer, onChoisir }: { contacts: ContactSimple[] | null; onFermer: () => void; onChoisir: (c: ContactSimple[]) => void }) {
  const { c } = useTheme();
  const [recherche, setRecherche] = useState('');
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (contacts ?? []).filter(x => !q || x.nom.toLowerCase().includes(q) || x.telephone?.replace(/\s/g, '').includes(q.replace(/\s/g, '')));
  }, [contacts, recherche]);

  return (
    <Modal visible={!!contacts} animationType="slide" onRequestClose={onFermer} onShow={() => { setChoisis(new Set()); setRecherche(''); }}>
      <View style={{ flex: 1, backgroundColor: c.fond, padding: ESPACE.l, paddingTop: ESPACE.xl }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: c.texte, marginBottom: ESPACE.m }}>{t('Choisir des contacts')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACE.s, minHeight: 50, borderWidth: 1.5, borderColor: c.bordure, borderRadius: RAYON, paddingHorizontal: ESPACE.m, backgroundColor: c.surface, marginBottom: ESPACE.m }}>
          <Ionicons name="search" size={18} color={c.texteDoux} />
          <TextInput value={recherche} onChangeText={setRecherche} placeholder={t('Rechercher un nom ou un numéro')} placeholderTextColor={c.texteDoux}
            style={{ flex: 1, fontSize: 16, color: c.texte, minHeight: 46 }} />
        </View>
        <FlatList
          data={filtres} keyExtractor={x => x.id} style={{ flex: 1 }}
          ListEmptyComponent={<TexteDoux style={{ textAlign: 'center', marginTop: ESPACE.xl }}>{t('Aucun contact trouvé.')}</TexteDoux>}
          renderItem={({ item }) => {
            const sel = choisis.has(item.id);
            return (
              <Pressable onPress={() => setChoisis(s => { const n = new Set(s); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); return n; })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACE.m, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.bordure }}>
                <Avatar nom={item.nom} taille={38} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: c.texte }}>{item.nom}</Text>
                  <TexteDoux style={{ fontSize: 13 }}>{item.telephone ?? t('Pas de numéro')}</TexteDoux>
                </View>
                <Ionicons name={sel ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={sel ? c.primaire : c.texteDoux} />
              </Pressable>
            );
          }}
        />
        <Ligne style={{ marginTop: ESPACE.m }}>
          <Bouton titre={t('Annuler')} variante="secondaire" onPress={onFermer} style={{ flex: 1 }} />
          <Bouton titre={t('Ajouter ({n})', { n: choisis.size })} desactive={!choisis.size} style={{ flex: 1 }} onPress={() => onChoisir((contacts ?? []).filter(x => choisis.has(x.id)))} />
        </Ligne>
      </View>
    </Modal>
  );
}
