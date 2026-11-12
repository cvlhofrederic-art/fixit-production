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
- `mobile/www/pro/mobile/index.html` n'est jamais affichée : iOS exige un fichier local au chemin de départ, sinon
  l'appli quitte au lancement.

### Limites connues

- Capacitor présente `server.url` comme prévu pour le rechargement à chaud (« not intended for use in production »).
- Apple peut refuser une appli qui n'est « qu'un site » (règle 4.2 de l'App Store). En cas de refus : export limité à
  l'espace mobile, pour l'iPhone seulement.
- Sans réseau, seule la page « hors connexion » s'affiche.
- Téléchargements (rapport PDF, export FEC de l'onglet Documents) : sans effet dans l'appli Android pour l'instant
  (aucun gestionnaire de téléchargement dans Capacitor ; à brancher plus tard sur les plugins Filesystem et Share).
- « Continuer avec Google » ouvre le navigateur du téléphone et la session s'y crée, pas dans l'appli : se connecter
  par e-mail et mot de passe.
- Une page de défi Cloudflare (mode « Under Attack », Bot Fight Mode, règle WAF) ne peut pas être résolue dans
  l'appli Android : la page hors connexion la remplace.
- Les photos du Proof of Work sont gardées dans le stockage local de la page (comme sur le web) : volume à surveiller.
- Icône et écran de démarrage : encore ceux par défaut de Capacitor (logo bleu), à remplacer par ceux de Vitfix.

## Architecture

```
capacitor.config.ts                    ← identité (io.vitfix.pro, « Vitfix Pro »), server.url, page hors connexion
mobile/www/index.html                  ← page « hors connexion », seul contenu affiché depuis l'appli elle-même
mobile/www/pro/mobile/index.html       ← jamais affichée : fichier de départ exigé par iOS
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

## Publication sur les stores (à faire)

- Comptes au nom de la société : Google Play Console (25 $ une fois) et Apple Developer (99 $ par an) ; une société
  doit fournir un numéro D-U-N-S (gratuit).
- **Android** : créer une clé d'envoi (upload key) gardée hors du dépôt (secret GitHub), construire un AAB signé
  (`./gradlew bundleRelease`), le déposer dans la Play Console (test interne d'abord) ; fiche, captures, politique de
  confidentialité et formulaire « Sécurité des données ».
- **iPhone** : construire et signer sur un Mac ou sur un runner macOS de GitHub (gratuit pour un dépôt public) avec
  une clé d'API App Store Connect ; TestFlight, puis revue Apple avec un compte artisan de démonstration.
- Numéros de version à augmenter à chaque envoi : `versionCode` / `versionName` (`android/app/build.gradle`),
  `CURRENT_PROJECT_VERSION` / `MARKETING_VERSION` (`ios/App/App.xcodeproj/project.pbxproj`).
- L'identifiant `io.vitfix.pro` ne pourra plus changer une fois l'appli publiée.

## Icônes et écran de démarrage

À partir d'une icône 1024 × 1024 : `@capacitor/assets` (`capacitor-assets generate`), ou à la main dans
`android/app/src/main/res/` et `ios/App/App/Assets.xcassets/`.
