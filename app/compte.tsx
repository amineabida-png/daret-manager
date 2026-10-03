import { useState } from 'react';
import { router } from 'expo-router';
import { Bouton, Champ, Ecran, Info, Segment, afficherErreur, confirmer, informer } from '../components/ui';
import { annulerConnexion, choisirDonnees, connecter, messageErreur } from '../utils/synchro';
import { ESPACE } from '../components/theme';
import { t } from '../i18n';

type Mode = 'connexion' | 'inscription';

export default function CompteEcran() {
  const [mode, setMode] = useState<Mode>('connexion');
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [mdp2, setMdp2] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [essai, setEssai] = useState(false);

  const erreurEmail = essai && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? t('Adresse e-mail invalide.') : null;
  const erreurMdp = essai && mdp.length < 8 ? t('Le mot de passe doit contenir au moins 8 caractères.') : null;
  const erreurMdp2 = essai && mode === 'inscription' && mdp2 !== mdp ? t('Les deux mots de passe sont différents.') : null;

  async function valider() {
    setEssai(true);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || mdp.length < 8 || (mode === 'inscription' && mdp2 !== mdp)) return;
    setEnvoi(true);
    try {
      const r = await connecter(mode, email, mdp);
      if (r === 'conflit') {
        // 1er choix proposé : fusionner (rien n'est perdu) ; sinon garder seulement le compte ; sinon annuler
        if (await confirmer(
          t('Ce compte contient déjà des darets'),
          t('Cet appareil contient aussi des darets. Les réunir avec celles du compte ? Rien n\'est perdu : les darets identiques sont combinées, les autres ajoutées.'),
          t('Fusionner'), false)) {
          const f = await choisirDonnees('fusion');
          if (f) informer(t('Fusion terminée'), t('{a} daret(s) ajoutée(s), {c} combinée(s), {p} paiement(s) récupéré(s).', { a: f.ajoutees, c: f.combinees, p: f.paiementsAjoutes }));
          router.back();
          return;
        }
        if (!(await confirmer(t('Garder seulement le compte ?'), t('Les darets de cet appareil seront remplacées par celles du compte.\n\nPour les garder, annulez puis exportez une sauvegarde.'), t('Utiliser le compte')))) {
          annulerConnexion();
          return;
        }
        await choisirDonnees('compte');
      }
      informer(t('Synchronisation activée'), t('Vos darets sont enregistrées en ligne et suivront ce compte sur tous vos appareils.'));
      router.back();
    } catch (e) {
      afficherErreur(new Error(messageErreur(e)));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Ecran>
      <Segment<Mode> valeur={mode} onChange={m => { setMode(m); setEssai(false); }}
        options={[{ valeur: 'connexion', libelle: t('Se connecter'), icone: 'log-in-outline' }, { valeur: 'inscription', libelle: t('Créer un compte'), icone: 'person-add-outline' }]} />
      <Info icone="cloud-done-outline">{t('Avec un compte, vos darets sont enregistrées en ligne de façon sécurisée et synchronisées entre votre téléphone, votre tablette et le site web.')}</Info>
      <Champ label={t('E-mail')} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
        autoComplete="email" textContentType="emailAddress" placeholder="nom@exemple.com" erreur={erreurEmail} />
      <Champ label={t('Mot de passe')} value={mdp} onChangeText={setMdp} secureTextEntry autoCapitalize="none"
        autoComplete={mode === 'inscription' ? 'new-password' : 'current-password'} textContentType={mode === 'inscription' ? 'newPassword' : 'password'}
        erreur={erreurMdp} aide={mode === 'inscription' ? t('Au moins 8 caractères.') : undefined} />
      {mode === 'inscription' ? (
        <Champ label={t('Confirmer le mot de passe')} value={mdp2} onChangeText={setMdp2} secureTextEntry autoCapitalize="none" autoComplete="new-password" erreur={erreurMdp2} />
      ) : null}
      <Bouton titre={mode === 'connexion' ? t('Se connecter') : t('Créer mon compte')} icone={mode === 'connexion' ? 'log-in-outline' : 'person-add-outline'}
        onPress={valider} chargement={envoi} style={{ marginTop: ESPACE.s }} />
    </Ecran>
  );
}
