# Daret Manager

Application Android **et web** de gestion de **daret** (tontine marocaine) : membres, ordre des tours, cotisations, retards, rappels et relances WhatsApp. Toutes les données restent **sur le téléphone** (base SQLite locale, aucun serveur).

- React Native + **Expo SDK 57**, TypeScript, navigation **expo-router**
- Base locale **expo-sqlite**, rappels **expo-notifications**
- Interface en **français** ou en **darija** (écriture arabe, de droite à gauche), montants au format « 1 500,00 DH »
- Version **web installable** (PWA) adaptée aux téléphones Android, iPhone, tablettes et ordinateurs

---

## 1. Installation

Prérequis : **Node.js 20 ou plus récent** (testé avec Node 24) et npm.

```bash
cd daret-manager
npm install
```

## 2. Lancement

```bash
npx expo start
```

Le terminal affiche un **QR code** et l'adresse du serveur de développement.

Autres commandes utiles :

| Commande | Rôle |
|---|---|
| `npm test` | Tests unitaires et d'intégration (Jest) |
| `npm run typecheck` | Vérification TypeScript |
| `npx expo-doctor` | Diagnostic de la configuration Expo |

## 3. Tester sur le téléphone avec Expo Go

1. Installez **Expo Go** depuis le Play Store (version compatible avec le SDK 57).
2. Connectez le téléphone **au même Wi-Fi** que l'ordinateur.
3. Lancez `npx expo start`, puis dans Expo Go touchez **« Scan QR code »** et scannez le QR code.

Si le téléphone ne se connecte pas (réseau d'entreprise, pare-feu…) : `npx expo start --tunnel`.

> **Notifications** : dans Expo Go, les rappels programmés peuvent être limités sur Android. Pour les tester de façon fiable, utilisez l'APK (section suivante).

Pour essayer l'application sans saisir de données : **Paramètres → Démonstration → Charger** (daret de 6 membres dont un à 2 parts, avec paiements, un paiement partiel et des retards).

## 4. Générer l'APK installable

L'APK est compilé dans le cloud d'Expo (**EAS Build**, offre gratuite suffisante).

```bash
npm install -g eas-cli          # une seule fois
eas login                        # compte Expo gratuit (expo.dev)
eas build -p android --profile preview
```

- Au premier build, EAS propose de créer le projet sur expo.dev et de **générer la clé de signature Android** : répondez **Oui**.
- À la fin (≈ 10 à 20 min), EAS affiche un **lien et un QR code** : ouvrez-le sur le téléphone pour télécharger l'APK.
- Installez-le en autorisant « Installer des applications inconnues » pour votre navigateur si Android le demande.

Le profil `preview` de `eas.json` produit un fichier **.apk** (`buildType: "apk"`). Le profil `production` produit un `.aab` pour le Play Store.

Pour publier une nouvelle version : augmentez `version` et `android.versionCode` dans `app.json`, puis relancez la commande de build.

### Variante sans compte Expo : compilation locale

L'APK `Daret-Manager-1.1.0.apk` a été compilé localement (sous WSL/Linux) avec Java 17 et le SDK Android 36 :

```bash
npx expo prebuild -p android          # génère le projet natif android/
cd android
./gradlew assembleRelease --max-workers=2
# APK : android/app/build/outputs/apk/release/app-release.apk
```

La première compilation est longue (plusieurs heures avec 2 tâches parallèles) ; les suivantes réutilisent le cache (≈ 2 à 12 min).

**Icône** : générée par `assets/source-icone/generer-icone.js` (SVG converti en PNG avec Chrome en mode headless).

**Signature** : l'APK est signé avec la clé conservée dans `signature/daret-manager.keystore` (mot de passe `android`, alias `androiddebugkey`). Les mises à jour doivent être signées avec **la même clé**, sinon Android refuse de les installer par-dessus la version existante. Pour une publication sur le Play Store, utilisez plutôt `eas build` (clé de production gérée par Expo).

---

## Fonctionnement

- **Montant du tour** = montant par part × nombre total de parts.
- **Nombre de tours** = nombre total de parts : un membre à 2 parts cotise double et apparaît 2 fois dans le calendrier.
- **Fréquences** : chaque semaine, tous les 15 jours (14 jours), chaque mois. Une échéance le 31 tombe le dernier jour des mois plus courts (28/29 févr., 30 avril…).
- **Statuts** : ✅ payé · 🟠 partiel (avant l'échéance) · ⏳ en attente · 🔴 en retard (échéance dépassée et montant versé inférieur au dû).
- **Daret commencée** dès la 1re échéance ou le 1er paiement : la liste des membres est alors figée ; l'ordre ne se change plus que par **échange de deux tours**.
- La daret passe automatiquement en **« terminée »** quand tous les tours sont remis.
- **Rappels** à 9 h, 1, 2 ou 3 jours avant chaque échéance, et le jour J s'il reste des impayés (reprogrammés à chaque modification).
- **Sauvegarde** : Paramètres → Exporter (JSON) via le menu de partage Android ; Importer remplace toutes les données après confirmation. Historique d'une daret exportable en **CSV** (lisible par Excel).

## Organisation du code

```
app/                 Écrans (expo-router)
  (tabs)/            Accueil, Mes darets, Paramètres
  daret/             Création, détail (Tours / Membres / Historique), ordre, échange, paiements d'un tour
  membre/            Ajout (dont import de contacts), fiche, modification
components/          Thème clair/sombre, composants d'interface, formulaire de daret
db/                  Schéma et migrations, requêtes, vues agrégées, sauvegarde, démonstration
utils/               Calculs (montants, dates, calendrier, statuts), partage WhatsApp/CSV, notifications, fichiers
types/               Types TypeScript
```

## Tests

`npm test` lance 40 tests :

- **calculs** : format DH, montant du tour, fins de mois, années bissextiles, calendrier hebdomadaire / 15 jours / mensuel, parts multiples, tirage au sort, échange de tours, statuts et jours de retard ;
- **partage** : numéros marocains → WhatsApp, modèle de relance, récapitulatif, CSV ;
- **intégration** : la couche base de données est exécutée avec un vrai SQLite (`node:sqlite`, Node ≥ 22.5) : cycle de vie complet d'une daret, verrouillage après démarrage, remise et statut « terminée », données de démonstration à plusieurs dates, export → import JSON identique, refus d'une sauvegarde corrompue.

## Version web (navigateur, Android, iPhone, tablette)

La même application fonctionne dans un navigateur, à partir du même code (React Native Web).

| | |
|---|---|
| Construire (racine du domaine) | `npm run build:web` → dossier `dist-web/` |
| Construire pour GitHub Pages | `npm run build:pages` → dossier `dist-pages/` (chemin `/daret-manager`) |
| Essayer en local | `npm run build:web` puis `npm run serve:web` → http://localhost:8080 |

- **Données** : base SQLite dans le navigateur (`sql.js`, WebAssembly), enregistrée automatiquement dans IndexedDB. Elles restent sur l'appareil ; exportez une sauvegarde JSON pour les transférer (la même sauvegarde s'importe dans l'APK Android).
- **Installer sur l'écran d'accueil** : Android (Chrome) → menu ⋮ → *Installer l'application* ; iPhone / iPad (Safari) → bouton Partager → *Sur l'écran d'accueil*. L'application s'ouvre alors en plein écran et fonctionne hors ligne.
- **Différences avec l'APK** : pas de rappels par notification ni d'import des contacts (non disponibles dans un navigateur) ; l'ordre manuel des tours se règle avec des flèches ; exports téléchargés ou partagés via le menu du téléphone.
- **Fichiers propres au web** : `db/moteur.web.ts` (base SQLite navigateur), `utils/fichiers.web.ts` (exports), `web/` (finalisation PWA, service worker hors ligne, serveur Node pour Railway).

## Compte en ligne et synchronisation (PostgreSQL)

Paramètres → **Compte en ligne** : créer un compte (e-mail + mot de passe) pour enregistrer les darets sur le serveur et les retrouver sur tous les appareils (APK, site Railway, site GitHub Pages).

- **Serveur** : `web/serveur.js` + `web/api.js` sur Railway (service `daret-manager`), relié au PostgreSQL du projet par la variable `DATABASE_URL = ${{Postgres.DATABASE_URL}}`.
- **Base** : schéma séparé `daret_manager` (tables `comptes`, `sessions`, `donnees`), sans contact avec les tables des autres applications.
- **Sécurité** : mots de passe hachés (scrypt), jetons de session stockés hachés (SHA-256), 10 tentatives de connexion max. par quart d'heure, accès limité au site GitHub Pages et au site Railway.
- **Fonctionnement** : chaque modification est envoyée 1,5 s plus tard ; les changements des autres appareils sont récupérés à l'ouverture et chaque minute. Un numéro de version empêche un appareil d'écraser sans le savoir les modifications d'un autre. Sans connexion Internet, l'application continue de fonctionner et envoie les modifications au retour du réseau.
- **API** : `POST /api/inscription`, `POST /api/connexion`, `POST /api/deconnexion`, `GET /api/donnees`, `PUT /api/donnees`, `DELETE /api/compte`.
