import { useEffect, useState } from 'react';
import { Image, Linking, Platform, Text, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useTheme, ESPACE } from '../../components/theme';
import { Bouton, Carte, Champ, Chargement, Ecran, Groupe, Info, LigneMenu, Segment, SousTitre, TexteDoux, afficherErreur, confirmer, informer } from '../../components/ui';
import { useDonnees } from '../../components/useDonnees';
import { ecrireParametre, lireParametres } from '../../db/requetes';
import { importerTout, validerSauvegarde } from '../../db/sauvegarde';
import { chargerDemo, supprimerDemo } from '../../db/demo';
import { choisirSauvegarde, exporterJSON } from '../../utils/fichiers';
import { modeleWhatsAppDefaut, remplirModele } from '../../utils/partage';
import { initialiserNotifications, RAPPELS_DISPONIBLES, replanifierRappels } from '../../utils/notifications';
import type { Parametres } from '../../types';
import { t } from '../../i18n';
import { formatDH } from '../../utils/montant';
import { formatDateLongue } from '../../utils/dates';

export default function ParametresEcran() {
  const { c } = useTheme();
  const { data } = useDonnees(lireParametres);
  const [modele, setModele] = useState('');
  const [notifOk, setNotifOk] = useState<boolean | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);

  useEffect(() => { if (data) setModele(data.modele_whatsapp); }, [data]);
  useEffect(() => { Notifications.getPermissionsAsync().then(p => setNotifOk(p.status === 'granted')).catch(() => setNotifOk(false)); }, []);

  if (!data) return <Chargement />;
  const apercu = remplirModele(modele || modeleWhatsAppDefaut(data.langue), { nom: t('Fatima'), montant: formatDH(100000), date: formatDateLongue('2026-11-05'), daret: t('Daret Famille') });

  async function action(nom: string, fn: () => Promise<void>) {
    setOccupe(nom);
    try { await fn(); } catch (e) { afficherErreur(e); } finally { setOccupe(null); }
  }

  return (
    <Ecran>
      <SousTitre>{t('Langue')} · اللغة</SousTitre>
      <Segment<Parametres['langue']> valeur={data.langue} onChange={async v => {
        if (v === data.langue) return;
        // Le modèle WhatsApp par défaut suit la langue, sauf s'il a été personnalisé
        const personnalise = modele.trim() && modele !== modeleWhatsAppDefaut(data.langue);
        if (!personnalise) await ecrireParametre('modele_whatsapp', modeleWhatsAppDefaut(v));
        await ecrireParametre('langue', v);
      }}
        options={[{ valeur: 'fr', libelle: 'Français' }, { valeur: 'ar', libelle: 'الدارجة' }]} />

      <SousTitre>{t('Apparence')}</SousTitre>
      <Segment<Parametres['theme']> valeur={data.theme} onChange={v => ecrireParametre('theme', v)}
        options={[{ valeur: 'clair', libelle: t('Clair'), icone: 'sunny-outline' }, { valeur: 'sombre', libelle: t('Sombre'), icone: 'moon-outline' }, { valeur: 'systeme', libelle: t('Auto'), icone: 'phone-portrait-outline' }]} />

      <SousTitre>{t('Rappels')}</SousTitre>
      {!RAPPELS_DISPONIBLES ? (
        <Info icone="notifications-outline">{t('Les rappels par notification sont disponibles dans l\'application Android. Dans le navigateur, consultez l\'accueil pour voir les retards.')}</Info>
      ) : <>
      <Segment<Parametres['delai_rappel']> label={t('Prévenir avant chaque échéance')} valeur={data.delai_rappel}
        onChange={v => ecrireParametre('delai_rappel', v)}
        options={[{ valeur: 1, libelle: t('1 jour') }, { valeur: 2, libelle: t('2 jours') }, { valeur: 3, libelle: t('3 jours') }]} />
      <Info icone="notifications-outline">{t('Rappel à 9 h, plus un rappel le jour de l\'échéance s\'il reste des impayés.')}</Info>
      {notifOk === false ? (
        <Carte style={{ borderWidth: 1, borderColor: c.danger + '55' }}>
          <Info icone="notifications-off-outline" ton="alerte">{t('Les notifications sont désactivées : aucun rappel ne sera envoyé.')}</Info>
          <Bouton titre={t('Activer les notifications')} icone="notifications" petit onPress={async () => {
            const ok = await initialiserNotifications();
            setNotifOk(ok);
            if (ok) await replanifierRappels(); else Linking.openSettings();
          }} />
        </Carte>
      ) : null}
      </>}

      <SousTitre style={{ marginTop: ESPACE.m }}>{t('Message de relance WhatsApp')}</SousTitre>
      <Champ label={t('Modèle')} value={modele} onChangeText={setModele} multiline aide={t('Variables :') + ' {nom}, {montant}, {date}, {daret}'} />
      <View style={{ backgroundColor: c.sombre ? '#1F2C24' : '#E7F6EC', borderRadius: 14, borderTopLeftRadius: 4, padding: ESPACE.m, marginBottom: ESPACE.m, alignSelf: 'stretch' }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#1FAF54', marginBottom: 4 }}>{t('APERÇU')}</Text>
        <Text style={{ color: c.texte, fontSize: 15, lineHeight: 21 }}>{apercu}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: ESPACE.s, marginBottom: ESPACE.xl }}>
        <Bouton titre={t('Par défaut')} icone="refresh" variante="secondaire" petit style={{ flex: 1 }} onPress={() => setModele(modeleWhatsAppDefaut(data.langue))} />
        <Bouton titre={t('Enregistrer')} icone="checkmark" petit style={{ flex: 1 }} desactive={modele === data.modele_whatsapp || !modele.trim()}
          onPress={() => action('modele', () => ecrireParametre('modele_whatsapp', modele.trim()))} />
      </View>

      <SousTitre>{t('Sauvegarde')}</SousTitre>
      <Groupe>
        <LigneMenu icone="cloud-upload-outline" titre={t('Exporter toutes les données')} sousTitre={t('Fichier JSON à garder sur Drive, WhatsApp, e-mail…')}
          chargement={occupe === 'export'} onPress={() => action('export', exporterJSON)} />
        <LigneMenu icone="cloud-download-outline" titre={t('Importer une sauvegarde')} sousTitre={t('Remplace toutes les données actuelles')}
          chargement={occupe === 'import'} onPress={() => action('import', async () => {
            const s = await choisirSauvegarde();
            if (!s) return;
            const pb = validerSauvegarde(s);
            if (pb.length) throw new Error(pb.join('\n'));
            const ok = await confirmer(t('Remplacer toutes les données ?'),
              t('La sauvegarde contient {d} daret(s), {m} membre(s) et {p} paiement(s).\n\nToutes les données actuelles seront ÉCRASÉES.', { d: s.darets.length, m: s.membres.length, p: s.paiements.length }), t('Remplacer'));
            if (!ok) return;
            await importerTout(s);
            await replanifierRappels();
            informer(t('Import terminé'), t('Les données ont été restaurées.'));
          })} />
      </Groupe>
      <Info icone="shield-checkmark-outline">{Platform.OS === 'web'
        ? t('Les données sont enregistrées dans ce navigateur. Exportez régulièrement une sauvegarde.')
        : t('Toutes les données restent sur ce téléphone. Exportez régulièrement une sauvegarde.')}</Info>

      <SousTitre style={{ marginTop: ESPACE.m }}>{t('Démonstration')}</SousTitre>
      <Groupe>
        <LigneMenu icone="flask-outline" titre={t('Charger la démonstration')} couleur={c.or} sousTitre={t('6 membres, paiements, un partiel et des retards')}
          chargement={occupe === 'demo'} onPress={() => action('demo', async () => {
            const id = await chargerDemo();
            router.push(`/daret/${id}`);
          })} />
        <LigneMenu icone="trash-outline" titre={t('Supprimer la démonstration')} couleur={c.danger} onPress={() => action('demo-sup', async () => {
          if (await confirmer(t('Supprimer la démonstration ?'), t('La daret de démonstration et toutes ses données seront effacées.'))) {
            informer(await supprimerDemo() ? t('Démonstration supprimée') : t('Aucune donnée de démonstration'));
          }
        })} />
      </Groupe>

      <View style={{ alignItems: 'center', marginTop: ESPACE.xl, gap: 6 }}>
        <Image source={require('../../assets/icon.png')} style={{ width: 48, height: 48, borderRadius: 12 }} />
        <Text style={{ color: c.texte, fontWeight: '700' }}>Daret Manager</Text>
        <TexteDoux style={{ fontSize: 12 }}>{t('Version {v} · données stockées localement', { v: Constants.expoConfig?.version ?? '1.1.0' })}</TexteDoux>
      </View>
    </Ecran>
  );
}
