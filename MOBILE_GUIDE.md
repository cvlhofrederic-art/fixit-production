# 📱 Fixit Pro — Guide Application Mobile

## Architecture

```
app/(commun)/pro/mobile/page.tsx    ← Interface mobile artisan (Next.js)
capacitor.config.ts        ← Configuration Capacitor
android/                   ← Projet Android natif (Android Studio)
ios/                       ← Projet iOS natif (Xcode)
scripts/build-mobile.sh    ← Script de build automatique
```

## Fonctionnalités de l'app mobile

### 🏠 Accueil
- Vue résumée du jour (RDV du jour, demain)
- Statistiques : en attente, CA, confirmés, note
- Actions rapides (Nouveau RDV, Motif, Agenda, Demandes)
- Alerte visuelle pour les RDV en attente

### 📅 Agenda
- Mini-calendrier mensuel avec navigation
- Points colorés sur les jours avec RDV
- Liste des RDV par jour sélectionné
- Création rapide de RDV

### 🔧 Interventions
- Liste complète de tous les RDV
- Filtres : Tous, En attente, Confirmés, Terminés
- Bouton "Proof of Work" pour les RDV confirmés

### 📸 PROOF OF WORK (Fonction phare)
Workflow complet en 4 étapes :
1. **AVANT** : 3+ photos obligatoires (avec GPS + horodatage)
2. **PENDANT** : Photos d'étapes (optionnel)
3. **APRÈS** : 3+ photos + description des travaux
4. **SIGNATURE** : Pad de signature client sur écran tactile

Protection juridique :
- GPS automatique à l'arrivée sur le chantier
- Horodatage cryptographique de chaque photo
- Signature électronique du client
- Archivage local (+ migration Supabase Storage possible)

### 📄 Documents & Preuves
- Historique des preuves d'intervention archivées
- Galerie des photos avant/après
- Gestion des motifs (créer/voir)

### ⚙️ Paramètres
- Infos entreprise (nom, téléphone, bio)
- Jours travaillés (toggle par jour)
- Acceptation automatique des RDV
- Déconnexion

---

## 🚀 Comment builder l'application

### Prérequis
- Node.js 18+
- Android Studio (pour Android)
- Xcode 14+ sur macOS (pour iOS)
- Compte Apple Developer ($99/an) pour iOS
- Compte Google Play Console ($25) pour Android

### Build complet (iOS + Android)
```bash
npm run mobile:build
```

### Build Android seulement
```bash
npm run mobile:android
```

### Build iOS seulement (macOS uniquement)
```bash
npm run mobile:ios
```

### Ouvrir dans les IDE
```bash
npm run mobile:open:ios       # Ouvre Xcode
npm run mobile:open:android   # Ouvre Android Studio
```

---

## 📤 Publication sur les stores

### Google Play Store
1. Dans Android Studio : Build → Generate Signed Bundle/APK → Android App Bundle
2. Créer une clé de signature (garder précieusement !)
3. Sur play.google.com/console → Créer une application
4. Uploader le fichier `.aab`
5. Remplir les informations (description, captures d'écran, etc.)
6. Publier

### Apple App Store
1. Dans Xcode : Product → Archive
2. Window → Organizer → Distribute App
3. Sur appstoreconnect.apple.com → Créer une app
4. Uploader depuis Xcode via Transporter
5. Remplir les informations (description, captures d'écran 6.7")
6. Soumettre pour révision (24-48h)

---

## 🔧 Configuration

### Changer l'ID de l'application
Dans `capacitor.config.ts` :
```ts
appId: 'com.votrenom.artisan',  // Doit être unique sur les stores
appName: 'Votre App Name',
```

### Icônes et splash screen
- Placer l'icône dans `public/icon.png` (1024x1024px)
- Utiliser `npx capacitor-assets generate` pour générer toutes les tailles
- Ou manuellement dans `android/app/src/main/res/` et `ios/App/App/Assets.xcassets/`

### Variables d'environnement en production mobile
Les variables `NEXT_PUBLIC_*` sont intégrées au build statique.
Assurez-vous que `.env.local` est correctement configuré avant le build.

---

## 🔗 Route de l'app mobile

L'app mobile artisan est accessible sur :
- **Web** : `https://votre-domaine.com/pro/mobile`
- **App native** : pointe directement sur cette URL ou le build statique

Pour tester sur mobile avant de builder :
1. `npm run dev` sur votre machine
2. Trouver votre IP locale (ex: 192.168.1.10)
3. Dans `capacitor.config.ts`, décommenter : `url: 'http://192.168.1.10:3000'`
4. `npm run mobile:sync` puis ouvrir dans Android Studio/Xcode
