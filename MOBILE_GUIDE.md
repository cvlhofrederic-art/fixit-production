# 📱 Vitfix Pro — appli mobile artisan (Android et iPhone)

## Principe (décision du 12/11/2026)

L'appli est une coque Capacitor qui affiche l'espace mobile artisan du site, `https://vitfix.io/pro/mobile/`
(`server.url` + `server.appStartPath` dans `capacitor.config.ts`). Pas d'export statique : connexion, données et
mises à jour sont celles du site, sans nouvelle version à envoyer aux stores. Le pont Capacitor (`window.Capacitor`)
est injecté dans les pages de vitfix.io ; `estAppMobile()` (`lib/app-mobile.ts`) dit si une page tourne dans l'appli.

- **Langue** : le départ `/pro/mobile/` est sans langue ; le middleware la choisit (cookie, puis pays : France et pays
  francophones → `/fr/`, Portugal et pays lusophones → `/pt/`, puis langues du téléphone). L'espace mobile n'existe
  qu'en français et en portugais : hors de ces pays, un téléphone dont la liste de langues contient l'anglais aboutit
  à la connexion en portugais.
- **Rôles** : dans l'appli, un artisan connecté arrive sur l'espace mobile (`destinationApresConnexion`, option
  `appMobile`). Les autres comptes sont renvoyés vers leur espace par le middleware, y compris un compte BTP
  (`pro_societe`…), qui a aussi une fiche `profiles_artisan` mais n'a pas accès à `/pro/mobile`. La déconnexion
  ramène à la page de connexion.
- **Hors connexion** : page locale `mobile/www/index.html` (`server.errorPath`), en français ou en portugais selon le
  téléphone, avec un bouton « Réessayer ». Sous Android, elle s'affiche aussi pour toute erreur HTTP d'une page
  entière (404, 500, page de défi Cloudflare 403/503 comprises).
- **Liens vers un autre site** (PDF stockés chez Supabase, cartes, e-mail, SMS) : ouverts par les applis du téléphone.
- **« Continuer avec Google »** : voir plus bas — Google refuse de s'authentifier dans une WebView, l'appli ouvre
  donc une fenêtre du navigateur du système et reprend la main par un lien profond.
- `mobile/www/pro/mobile/index.html` n'est jamais affichée : iOS exige un fichier local au chemin de départ, sinon
  l'appli quitte au lancement.

### Limites connues

- Capacitor présente `server.url` comme prévu pour le rechargement à chaud (« not intended for use in production »).
- Apple peut refuser une appli qui n'est « qu'un site » (règle 4.2 de l'App Store). En cas de refus : export limité à
  l'espace mobile, pour l'iPhone seulement.
- Sans réseau, seule la page « hors connexion » s'affiche.
- Téléchargements (rapport PDF, export FEC de l'onglet Documents) : sans effet dans l'appli Android pour l'instant
  (aucun gestionnaire de téléchargement dans Capacitor ; à brancher plus tard sur les plugins Filesystem et Share).
- Une page de défi Cloudflare (mode « Under Attack », Bot Fight Mode, règle WAF) ne peut pas être résolue dans
  l'appli Android : la page hors connexion la remplace.
- Les photos du Proof of Work sont gardées dans le stockage local de la page (comme sur le web) : volume à surveiller.
- Règle 4.8 de l'App Store : proposer « Continuer avec Google » dans l'appli iPhone peut obliger à offrir aussi
  « Se connecter avec Apple ». À trancher avant le dépôt sur l'App Store ; sans effet sur Android, qui part le premier.
- Une autre application du téléphone peut déclarer le même schéma `io.vitfix.pro://` et intercepter le retour, ou
  ouvrir l'appli sur un faux lien : gêne, jamais vol de session (le code ne vaut rien sans le vérificateur). La parade
  est un lien `https://vitfix.io/…` vérifié par `assetlinks.json`, possible une fois l'appli signée pour les stores.
- Icône et écran de démarrage : encore ceux par défaut de Capacitor (logo bleu), à remplacer par ceux de Vitfix.

## Architecture

```
capacitor.config.ts                    ← identité (io.vitfix.pro, « Vitfix Pro »), server.url, page hors connexion
mobile/www/index.html                  ← page « hors connexion », seul contenu affiché depuis l'appli elle-même
mobile/www/pro/mobile/index.html       ← jamais affichée : fichier de départ exigé par iOS
lib/auth/google-app-mobile.ts          ← « Continuer avec Google » : fenêtre du système + retour par lien profond
app/(commun)/auth/callback/route.ts    ← échange du code contre la session, puis aiguillage selon le rôle
app/(commun)/pro/mobile/page.tsx       ← espace mobile artisan (page du site)
lib/app-mobile.ts                      ← estAppMobile()
android/                               ← projet Android (Android Studio)
ios/                                   ← projet iOS (Xcode) ; WKAppBoundDomains = vitfix.io et localhost
scripts/build-mobile.sh                ← cap sync (npm run mobile:build, mobile:android, mobile:ios)
.github/workflows/mobile-android.yml   ← APK de test construit par GitHub
tests/mobile/capacitor-config.test.ts  ← invariants : origine, départ, page hors connexion, identité identique partout
```

## Fonctionnalités de l'espace mobile

- **Accueil** : résumé du jour (rendez-vous du jour et du lendemain), statistiques, actions rapides, alerte des
  rendez-vous en attente.
- **Agenda** : calendrier mensuel, rendez-vous du jour choisi, création rapide.
- **Interventions** : tous les rendez-vous, filtrés (en attente, confirmés, terminés), accès à Proof of Work.
- **Proof of Work** : photos avant / pendant / après avec GPS et horodatage, puis signature du client à l'écran.
- **Documents** : preuves d'intervention archivées, photos, motifs.
- **Paramètres** : informations de l'entreprise, jours travaillés, acceptation automatique, déconnexion.

## « Continuer avec Google » dans l'appli

Google refuse l'authentification dans une WebView intégrée (politique « Use secure browsers », erreur 403
`disallowed_useragent`) : une appli doit passer par une fenêtre du navigateur du système. C'est la méthode de
toutes les applis qui proposent ce bouton — onglet personnalisé Chrome sur Android, SFSafariViewController sur
iPhone — et c'est ce que fait `lib/auth/google-app-mobile.ts` :

1. l'appli demande à Supabase l'URL d'autorisation sans la suivre (`skipBrowserRedirect`), ce qui écrit au passage
   le vérificateur PKCE dans les cookies de vitfix.io **côté WebView** ;
2. elle ouvre cette URL dans la fenêtre du système (plugin `@capacitor/browser`) ;
3. Supabase renvoie vers `io.vitfix.pro://auth/callback?code=…` ; Android (intent-filter de `AndroidManifest.xml`)
   et iPhone (`CFBundleURLTypes` d'`Info.plist`) rendent la main à l'appli, jamais au navigateur ;
4. l'appli referme la fenêtre et va sur `/{langue}/auth/callback?code=…&app=1` : la route serveur échange le code
   contre la session — le vérificateur est dans ses cookies — et aiguille selon le rôle (artisan → espace mobile).

Le lien profond ne porte qu'un code d'autorisation, inutilisable sans le vérificateur de cette WebView : une autre
application du téléphone qui l'imiterait n'ouvrirait aucune session.

**Réglage obligatoire côté Supabase** (une fois, par Frédéric) : tableau de bord du projet →
**Authentication** → **URL Configuration** → **Redirect URLs** → **Add URL** → `io.vitfix.pro://auth/callback`
→ **Save**. Sans cette ligne, Supabase ignore l'adresse de retour, renvoie vers la Site URL, et l'appli ne reçoit
jamais la main : l'utilisateur reste sur le formulaire. Rien à changer dans la console Google : elle ne connaît que
l'adresse de retour de Supabase, inchangée.

Plus tard, pour l'écran de choix du compte Google sans navigateur du tout (`signInWithIdToken` et le SDK natif
Google), il faudra un identifiant OAuth par plateforme dans la console Google, lié à l'empreinte de la clé de
signature de l'appli : à voir quand l'appli sera signée pour les stores.

## Tester sur un téléphone Android (sans Android Studio)

1. Sur GitHub, onglet **Actions** → **App Android — APK de test**. Le workflow tourne seul sur une PR qui touche
   l'appli ; sinon **Run workflow** sur la branche voulue.
2. Ouvrir le run terminé (coche verte), rubrique **Artifacts** → **vitfix-pro-apk-test** : un zip qui contient
   `app-debug.apk`, gardé 14 jours.
3. Copier `app-debug.apk` sur le téléphone, l'ouvrir et autoriser l'installation depuis cette source quand Android le
   demande.
4. Chaque APK est signé par une clé de debug différente : désinstaller l'ancienne version avant d'installer la
   nouvelle. Désinstaller efface les données gardées dans l'appli (photos du Proof of Work, documents de conformité)
   que le miroir serveur `user_storage` n'a pas reprises (il ignore toute valeur de plus de 5 Mo) : essayer avec un
   compte de test.
5. L'APK charge toujours la production : un changement du site apporté par une PR (redirection après connexion…) ne
   s'y voit qu'après sa fusion et son déploiement.

## Construire en local (facultatif)

- `npm run mobile:android` (ou `mobile:ios`, ou `mobile:build` pour les deux) lance `cap sync`, puis
  `npm run mobile:open:android` (Android Studio, JDK 21) ou `npm run mobile:open:ios` (Xcode, sur Mac).
- Rechargement à chaud sur un serveur de dev : remplacer `server.url` par l'adresse du poste
  (`http://192.168.x.x:3000`) et ajouter cette adresse IP à `android/app/src/debug/res/xml/network_security_config.xml`
  (seuls localhost, 127.0.0.1 et 10.0.2.2 y acceptent le HTTP en clair ; `cleartext: true` est ignoré quand le
  manifeste déclare cette configuration), le temps de l'essai seulement : le test d'invariants refuse un tel
  `server.url` dans un commit.

## Publication sur les stores

Deux workflows manuels font tout l'envoi, sans Mac ni Android Studio. Ils ne tournent que sur demande
(**Actions** → le workflow → **Run workflow**), jamais sur une PR : chaque exécution consomme un numéro de version
que le store refusera ensuite de réutiliser.

| | Workflow | Ce qu'il produit |
|---|---|---|
| iPhone | **App iPhone — envoi TestFlight** (`mobile-ios.yml`) | archive signée déposée sur App Store Connect, puis TestFlight |
| Android | **App Android — envoi Play** (`mobile-android-release.yml`) | bundle AAB signé déposé sur le canal Play choisi (test interne par défaut) |

Les runners macOS standards sont **gratuits et sans limite sur un dépôt public** : aucun Mac n'est nécessaire.

> **Signature iPhone : archive non signée, signature à l'export.** Deux pièges, tous deux constatés sur un
> envoi réel :
> - `CODE_SIGN_IDENTITY` figé dans `project.pbxproj` (« iPhone Developer » du gabarit Capacitor, ou même
>   « Apple Distribution ») entre en conflit avec la signature automatique : *« App has conflicting
>   provisioning settings »* ;
> - en signature automatique, l'archive réclame un profil **de développement**, qu'Apple refuse à une équipe
>   sans appareil enregistré : *« Your team has no devices from which to generate a provisioning profile »*.
>   Un runner n'a pas d'iPhone à déclarer.
>
> D'où le choix : l'archive est fabriquée **sans signature** (`CODE_SIGNING_ALLOWED=NO`) et la signature a lieu
> une seule fois, à l'export, avec un profil **App Store** — qui ne contient aucun appareil. Les deux
> invariants sont gardés par `tests/mobile/chaine-publication.test.ts`.

### Numéros de version

- Le **numéro d'envoi** est automatique et pris sur le numéro du run : `CURRENT_PROJECT_VERSION` côté iPhone,
  `versionCode` côté Android. Il ne recule jamais, et les deux stores refusent un numéro déjà déposé.
- Le **numéro affiché aux utilisateurs** reste à la main : `MARKETING_VERSION`
  (`ios/App/App.xcodeproj/project.pbxproj`) et `versionName` (`android/app/build.gradle`).
- L'identifiant `io.vitfix.pro` ne pourra plus changer une fois l'appli publiée.

### Secrets à créer une fois (Settings → Secrets and variables → Actions)

**iPhone** — une clé d'API App Store Connect suffit : elle laisse Xcode créer lui-même le certificat de
distribution et le profil sur le runner, donc rien à fabriquer dans un trousseau.

1. App Store Connect → **Utilisateurs et accès** → **Intégrations** → **App Store Connect API** → **+**,
   rôle **Admin**, clé d'équipe générée par le détenteur du compte.
   Le rôle compte : `-allowProvisioningUpdates` doit créer un certificat de distribution et un profil, et
   seul **Admin** ouvre « Certificates, Identifiers & Profiles » par l'API. Avec App Manager, le build
   compile puis s'arrête sur « You haven't been given access to cloud-managed distribution certificates ».
2. Le fichier `AuthKey_XXXXXXXX.p8` ne se télécharge **qu'une seule fois** : le garder hors du dépôt.
   S'il est perdu, il faut créer une nouvelle clé et refaire les trois secrets.

| Secret | Où le lire |
|---|---|
| `APPSTORE_KEY_ID` | colonne « Key ID » de la clé |
| `APPSTORE_ISSUER_ID` | « Issuer ID », au-dessus de la liste des clés |
| `APPSTORE_PRIVATE_KEY` | contenu entier du `.p8`, lignes `-----BEGIN PRIVATE KEY-----` comprises |
| `APPLE_TEAM_ID` | Apple Developer → Membership (identifiant d'équipe) |

**Android** — il faut une clé d'envoi (*upload key*) et un compte de service Google.

1. Créer la clé, sans JDK, avec OpenSSL (livré avec Git pour Windows). **À coller dans Git Bash**, hors du
   dépôt, par exemple après `mkdir -p ~/cles-stores && cd ~/cles-stores` :
   ```bash
   MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:4096 -sha256 -days 10000 -nodes \
     -keyout upload.key -out upload.crt -subj "/CN=Vitfix Pro/O=Vitfix/C=PT"
   openssl pkcs12 -export -inkey upload.key -in upload.crt -name upload -out upload.p12
   base64 -w0 upload.p12 > upload.p12.base64
   ```
   `MSYS_NO_PATHCONV=1` est indispensable sous Windows : sans lui, Git Bash prend le `/CN=…` pour un chemin et
   le réécrit, et le certificat sort avec un sujet absurde. PowerShell ne convient pas (la continuation `\`
   n'y existe pas).
   **Perdre cette clé interdit toute mise à jour de l'appli** : en garder une copie hors du poste et hors du
   dépôt. Une fois les secrets collés dans GitHub, effacer les fichiers intermédiaires du poste.
2. **Play Console** → **Paramètres** → **Accès à l'API** : lier un projet Google Cloud. Ce passage active
   l'API *Google Play Android Developer* dans le projet — sans elle, le premier envoi échoue en 403.
3. Dans ce projet, **Google Cloud** → **IAM et administration** → **Comptes de service** → créer un compte,
   puis lui ajouter une clé **JSON**. Revenir dans Play Console → **Utilisateurs et autorisations**, inviter
   ce compte et lui donner le rôle **Release manager** sur l'application. Les droits mettent parfois quelques
   minutes à se propager : un premier essai en 403 juste après l'invitation n'est pas une erreur de
   configuration.

| Secret | Contenu |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | contenu de `upload.p12.base64` |
| `ANDROID_KEYSTORE_PASSWORD` | mot de passe donné à `openssl pkcs12 -export` |
| `ANDROID_KEY_ALIAS` | `upload` (le `-name` ci-dessus) |
| `ANDROID_KEY_PASSWORD` | le même mot de passe |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | le fichier JSON du compte de service, en entier |

L'envoi lui-même passe par `scripts/mobile/publier-play.mjs` (API Google Play en fetch direct, aucune action
tierce ni dépendance ajoutée). L'AAB signé n'est jamais publié en artefact : sur un dépôt public, il serait
téléchargeable par n'importe qui.

### Le premier envoi Android part en brouillon

Tant que l'appli n'a jamais été publiée, Google la tient pour un brouillon et **refuse** une version déposée
en `completed`. L'entrée **statut** du workflow vaut donc `draft` par défaut : la version apparaît dans le
canal choisi et se publie d'un clic dans la Play Console. Une fois l'appli publiée une première fois, basculer
l'entrée sur `completed` pour que les envois suivants partent directement aux testeurs.

### Ce qui reste manuel dans les consoles

- Fiche du store : description, captures d'écran, catégorie, adresse de la politique de confidentialité
  (`https://vitfix.io/fr/confidentialite/`).
- Google Play : formulaire **Sécurité des données**, classification du contenu, statut de professionnel par appli.
- App Store : classification d'âge, statut de commerçant par appli, et — pour une publication publique — un compte
  artisan de démonstration pour la revue Apple.
- Inviter les testeurs : **Test interne** côté Play, **TestFlight → testeurs internes** côté Apple.

Le questionnaire de chiffrement à l'export, lui, n'est plus à remplir à chaque build : `Info.plist` déclare
`ITSAppUsesNonExemptEncryption` à `false` (l'appli ne fait que du HTTPS). Sans cette clé, chaque build reste
en « Conformité manquante » et TestFlight refuse de la distribuer, même en interne.

## Icônes et écran de démarrage

À partir d'une icône 1024 × 1024 : `@capacitor/assets` (`capacitor-assets generate`), ou à la main dans
`android/app/src/main/res/` et `ios/App/App/Assets.xcassets/`.
