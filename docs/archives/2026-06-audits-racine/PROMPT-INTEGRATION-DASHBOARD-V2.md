# PROMPT — Intégration complète Dashboard Artisan V2

> **Copie ce prompt tel quel et donne-le à Claude avec ton fichier HTML `vitfix-artisan-v2.html` en pièce jointe.**

---

Tu es un développeur front-end expert HTML/CSS/JS vanilla. Je te fournis le fichier HTML `vitfix-artisan-v2.html` — c'est le nouveau design du dashboard artisan Vitfix.io.

## Ta mission

Intègre **toutes les fonctionnalités** décrites ci-dessous dans ce HTML, en respectant **strictement** le design system existant (variables CSS, classes, typographie IBM Plex, couleurs jaune/noir/blanc).

## Règles absolues

1. **Un seul fichier HTML** autonome, ouvrable dans un navigateur
2. **Ne modifie jamais** le layout, les variables CSS, ni les styles existants — ajoute uniquement
3. **Données mock statiques** en JavaScript (pas d'API, pas de fetch, pas de Supabase)
4. **Toute la logique en vanilla JS** — pas de framework, pas de librairie externe (sauf les Google Fonts déjà importées)
5. **Chaque section** doit être navigable via la sidebar avec le système `nav()/showSection()` existant
6. **Chaque CRUD** doit fonctionner en mémoire (array JS) avec mise à jour dynamique du DOM
7. Utilise les classes CSS existantes : `.card`, `.card-head`, `.card-title`, `.card-body`, `.btn`, `.btn-primary`, `.btn-sm`, `.tag-*`, `.stat`, `.form-*`, `.modal-*`, `.lead-item`, `.msg-item`, `.agenda-slot`, `.alert`, `.conformite-item`, `.prog-*`, `.panel-*`, `.table`, `.ref`, `.amount`, etc.
8. Commente chaque section avec `<!-- MODULE: nom_du_module -->`
9. Sections déjà présentes dans le HTML : Accueil, Agenda, Messagerie, Clients, Devis, Factures, Photos Chantier, Documents, Statistiques, Bourse aux Marchés, Wallet Conformité — **enrichis-les** avec les fonctionnalités manquantes décrites ci-dessous
10. Sections **à créer** : Motifs, Horaires, Revenus, Comptabilité, Matériaux, Rapports, Canal Pro, Carnet de Visite, Paramètres, Modules

---

## MODULES — Description complète de chaque section

### 1. ACCUEIL (enrichir l'existant)
- **4 stat cards** : demandes en attente, CA du mois, note moyenne, taux de conversion
- **Demandes reçues** : liste cliquable → ouvre modal détail avec boutons "Contacter" et "Créer devis"
- **Agenda du jour** : 2-3 prochains RDV cliquables
- **Alertes** : facture impayée (rouge), document expirant (ambre), devis sans réponse (jaune)
- **Derniers avis** : 3 avis avec étoiles, nom, date, texte
- **Messagerie** : 3 derniers messages avec badge non-lu
- **Devis récents** : mini-tableau 3 lignes (réf, client, montant, statut)
- **Boutons rapides** : "+ Nouveau devis", "Exporter"

### 2. AGENDA (enrichir l'existant)
- **3 vues** : Jour / Semaine / Mois — avec boutons toggle en haut
- **Vue Jour** : liste des créneaux horaires (08h-18h) avec RDV positionnés
- **Vue Semaine** : grille Lun-Dim avec RDV colorés par statut
- **Vue Mois** : grille calendrier avec compteurs de RDV par jour
- **Navigation** : flèches ← → pour changer jour/semaine/mois + titre dynamique
- **Nouveau RDV** : bouton → modal avec champs (client, service, date, heure, durée, adresse, notes, téléphone)
- **Clic sur RDV** → modal détail avec : infos complètes + boutons (Confirmer ✓ / Annuler ✗ / Terminer / Envoyer message / Créer devis)
- **Absences** : bouton "Déclarer absence" → modal (date début, date fin, motif : Vacances/Maladie/Formation/Personnel)
- **Indicateurs absences** : jours grisés sur le calendrier
- **Statuts RDV** colorés : en attente (jaune), confirmé (vert), annulé (rouge), terminé (gris)

### 3. MOTIFS / SERVICES (nouvelle section)
- **Tableau des services** avec colonnes : Nom, Durée (min), Fourchette prix, Unité, Statut, Actions
- **Bouton "+ Nouveau motif"** → modal de création :
  - Nom du service (texte)
  - Description (textarea)
  - Durée en minutes (number)
  - Prix min / Prix max (number)
  - Unité de tarification (select : forfait, /m², /ml, /m³, /heure, /unité, /kg, /tonne, /lot)
- **Actions par ligne** : Éditer (ouvre modal pré-rempli), Activer/Désactiver (toggle), Supprimer (confirmation)
- **Badge statut** : Actif (vert) / Inactif (gris)
- **Données mock** : 5-6 services (Plomberie, Électricité, Peinture, Carrelage, Maçonnerie, Menuiserie)

### 4. HORAIRES (nouvelle section)
- **Mode acceptation** : 2 boutons radio visuels "Automatique" / "Manuel"
- **7 jours de la semaine** — chaque jour :
  - Toggle On/Off (checkbox stylisée)
  - Inputs heure début / heure fin (type="time")
  - Quand Off → inputs grisés
- **Services par jour** : checkboxes des motifs disponibles ce jour-là
- **Bouton "Sauvegarder"** avec toast confirmation
- **Données mock** : Lun-Ven actifs (08:00-17:00), Sam-Dim inactifs

### 5. MESSAGERIE (enrichir l'existant)
- **2 onglets** : "Particuliers" / "Professionnels" avec badge non-lu
- **Barre de recherche** + filtre "Tous / Non lus"
- **Liste conversations** à gauche (avatar initiales, nom, aperçu dernier message, heure, badge non-lu)
- **Thread à droite** : bulles de messages (envoyé = droite jaune, reçu = gauche gris)
- **Types de messages** : texte, photo (thumbnail), vocal (icône play), système (italique gris)
- **Zone de saisie** : input + bouton envoyer + bouton photo + bouton vocal
- **Templates rapides** : 3 boutons de réponse pré-remplie ("En route", "Arrivé sur place", "Devis envoyé")
- **Données mock** : 5 conversations, 3-5 messages chacune

### 6. CLIENTS (enrichir l'existant)
- **Recherche** + **Filtres** : Tous / Particuliers (B2C) / Entreprises (B2B)
- **Bouton "+ Ajouter client"** → modal :
  - Type (B2C/B2B)
  - Nom / Entreprise
  - Email, Téléphone
  - SIRET (si B2B)
  - Adresse principale
  - Adresses d'intervention (dynamique, + ajouter)
  - Notes
- **Tableau clients** : Nom, Type (tag), Ville, Interventions (count), CA total, Dernier contact
- **Clic sur client** → expansion avec historique des interventions (timeline)
- **Actions** : Éditer, Créer RDV, Créer devis, Supprimer

### 7. DEVIS (enrichir l'existant)
- **3 stats en haut** : Total devis, Envoyés, Non envoyés
- **Tableau** : Réf, Client, Prestation, Montant HT, Date, Statut (En attente/Accepté/Refusé/Expiré)
- **Bouton "+ Nouveau devis"** → modal formulaire :
  - Client (texte ou select)
  - Lignes de prestation dynamiques (description, qté, unité, prix unitaire HT, taux TVA, total HT) — bouton "+ Ajouter ligne"
  - Sous-total HT, TVA, Total TTC (calculés auto)
  - Date de validité
  - Notes / Conditions
  - Remise % optionnelle
- **Actions par devis** : Éditer, Convertir en facture, Marquer envoyé, Envoyer par email, Supprimer
- **Conversion devis → facture** : pré-remplit le formulaire facture avec les données du devis

### 8. FACTURES (enrichir l'existant)
- **3 stats** : Total factures, CA total TTC, Envoyées
- **Tableau** : Réf, Client, Montant TTC, Émise le, Échéance, Statut (En attente/Payée/Impayée/Annulée)
- **Badge "Impayée"** rouge si échéance dépassée
- **Bouton "+ Nouvelle facture"** → modal avec mêmes champs que devis + date échéance paiement
- **Actions** : Éditer, Marquer envoyée, Marquer payée, Envoyer par email, Supprimer

### 9. RAPPORTS D'INTERVENTION (nouvelle section)
- **Liste des rapports** avec cards : numéro, client, date, statut (Terminé/En cours/À reprendre/Sous garantie)
- **Bouton "+ Nouveau rapport"** → modal :
  - Infos artisan (pré-rempli)
  - Client (select depuis base clients)
  - Date et heure d'intervention
  - Adresse
  - Travaux réalisés (textarea + checklist)
  - Matériaux utilisés (liste dynamique : nom, qté, prix)
  - Observations et recommandations (textarea)
  - Statut (select)
- **Actions** : Éditer, Envoyer par email, Supprimer

### 10. STATISTIQUES (enrichir l'existant)
- **4 stat cards** : CA mensuel, Interventions, Taux conversion, Panier moyen
- **Graphique barres CSS** : Revenus par prestation (barres horizontales avec %)
- **Performance** : 4 progress bars (taux acceptation devis, satisfaction client, taux recouvrement, délai paiement)
- **Bouton "Exporter"** → modal format (PDF/Excel/CSV) + période

### 11. REVENUS (nouvelle section)
- **3 stat cards** : Total encaissé, En attente, Montant moyen
- **Tableau des revenus** : Date, Service, Client, Montant, Statut (Payé vert / En attente ambre / Impayé rouge)
- **Filtre par mois** (select)
- **Bouton "Exporter CSV"**

### 12. COMPTABILITÉ (nouvelle section)
- **Sélecteurs** : Année (2024/2025/2026) + Période (Mois/Trimestre/Année)
- **5 onglets** : Dashboard / Revenus / Dépenses / Déclaration / Assistant IA
- **Dashboard** : 4 cards (CA brut, Charges, Résultat net, Marge %) + barres mensuelles
- **Revenus** : tableau des encaissements par mois
- **Dépenses** : liste + bouton "+ Ajouter dépense" → modal (libellé, montant, catégorie, date, notes)
  - Catégories : Matériaux, Outillage, Carburant, Assurance, Sous-traitance, Divers
- **Déclaration** : résumé trimestriel, estimations cotisations URSSAF / IR
- **Assistant IA** : interface chat simple avec réponses mock ("Léa, votre comptable IA")

### 13. MATÉRIAUX (nouvelle section)
- **Recherche** par projet ou produit
- **Boutons métier** : Plomberie, Électricité, Peinture, Carrelage, etc.
- **Résultats** : grille de matériaux avec nom, quantité, prix par magasin (Brico Dépôt, Leroy Merlin, Point P)
- **Meilleur prix** mis en évidence
- **Curseur marge** (15-50%) pour calculer prix client
- **Total estimé** avec TVA
- **Bouton "Exporter vers devis"**

### 14. CANAL PRO (nouvelle section)
- **Liste contacts** (sidebar gauche étroite) : Syndic Bellevue, SCI Horizon, Mairie Ségur
- **Zone chat** (droite) : bulles de messages
- **Boutons rapides** : "En route" / "Arrivé" / "Terminé" / "Alerte"
- **Input message** + bouton envoyer
- **Types** : texte, statut (badge coloré), alerte (rouge)

### 15. PHOTOS CHANTIER (enrichir l'existant)
- **Filtres** : Tous / Non assignées / Par chantier
- **Grille photos** : thumbnails avec métadonnées (date, GPS, chantier associé)
- **Actions** : Associer à un chantier (dropdown), Associer à un rapport, Supprimer
- **Lightbox** plein écran au clic
- **Bouton "+ Ajouter photos"** (simule un upload avec photo mock)

### 16. DOCUMENTS (enrichir l'existant)
- **2 colonnes** : Réglementation (DTU, RE2020, normes) + Contrats & CCTP (modèles)
- **Bouton "+ Ajouter"** → modal (nom, catégorie, fichier simulé)
- **Actions** : Voir, Télécharger (toast)

### 17. BOURSE AUX MARCHÉS (enrichir l'existant)
- **Liste appels d'offres** avec type (public/privé/syndic), titre, localisation, budget, deadline
- **Tags** : Nouveau (jaune), Urgent (rouge), Récurrent (vert)
- **Clic** → modal détail avec bouton "Candidater" (toast)
- **Filtre** par type

### 18. WALLET CONFORMITÉ (enrichir l'existant)
- **Barre de progression** globale (documents valides / total)
- **Liste documents** : Assurance RC Pro, Kbis, Carte RGE, Garantie décennale, Qualibat, URSSAF, Passeport Prévention, Carte Pro BTP
- Chaque document : icône statut (✓ vert / ! ambre / ✗ rouge), nom, date expiration, tag statut, bouton action
- **Upload simulé** : bouton "Ajouter" → toast "Document ajouté"
- **Renouvellement** : bouton sur documents expirés/expirants

### 19. CARNET DE VISITE / PORTFOLIO (nouvelle section)
- **Galerie photos** en grille (3 colonnes)
- **Filtre par catégorie** : Tous, Plomberie, Électricité, Peinture, Carrelage, Maçonnerie
- **Chaque photo** : thumbnail + titre + catégorie + hover avec bouton supprimer
- **Bouton "+ Ajouter"** → modal (titre, catégorie select, photo simulée)
- **Lightbox** au clic
- **Données mock** : 6-8 photos avec catégories variées

### 20. PARAMÈTRES (nouvelle section)
- **2 onglets** : Profil / Modules
- **Profil** :
  - Photo de profil (cercle avec initiales + bouton "Changer")
  - Champs : Nom entreprise, Email, Téléphone, Bio (textarea)
  - Lien de réservation (copiable avec bouton copier)
  - Mode acceptation : Automatique / Manuel (radio)
  - Durée auto-blocage (select : 1h / 2h / 4h / 8h)
  - Message auto-réponse (textarea)
  - Rayon de zone (slider 5-100 km)
  - Bouton "Sauvegarder"
- **Modules** :
  - Grille de tous les modules avec toggle On/Off
  - Réorganisation : boutons ↑ ↓ par module
  - Bouton "Réinitialiser"
  - Les modules désactivés disparaissent de la sidebar

### 21. AIDE (nouvelle section)
- **FAQ** : 5-6 questions fréquentes en accordéon (clic pour dérouler réponse)
- **Contact support** : email + téléphone
- **Version** : Vitfix Pro v2.0

---

## Sidebar finale attendue

```
PRINCIPAL
  ● Tableau de bord
  ● Agenda
  ● Motifs
  ● Horaires

COMMUNICATION
  ● Messagerie        [10]
  ● Canal Pro
  ● Base clients

FACTURATION
  ● Devis             [12]
  ● Factures           [4]
  ● Rapports
  ● Photos Chantier
  ● Documents

ANALYSE
  ● Statistiques
  ● Revenus
  ● Comptabilité
  ● Matériaux
  ● Bourse aux Marchés [3]

PROFIL PRO
  ● Wallet Conformité
  ● Carnet de Visite

COMPTE
  ● Paramètres
  ● Modules
  ● Aide
```

---

## 22. FIXY — Assistant IA flottant (chatbot vocal + textuel)

Fixy est le robot assistant IA de Vitfix. C'est un **bouton flottant draggable** (position: fixed, z-index 999) en bas à droite qui ouvre une fenêtre de chat.

### Avatar SVG Fixy (robot doré avec clé à molette)
Intègre cet avatar SVG inline partout où Fixy apparaît :

```svg
<svg width="40" height="40" viewBox="0 0 100 100" fill="none">
  <rect x="25" y="45" width="50" height="35" rx="8" fill="#FFC107"/>
  <rect x="28" y="18" width="44" height="30" rx="10" fill="#FFD54F"/>
  <circle cx="40" cy="30" r="5" fill="#1a1a2e"/>
  <circle cx="60" cy="30" r="5" fill="#1a1a2e"/>
  <circle cx="42" cy="28" r="1.5" fill="white"/>
  <circle cx="62" cy="28" r="1.5" fill="white"/>
  <path d="M42 38 Q50 44 58 38" stroke="#1a1a2e" stroke-width="2.5" stroke-linecap="round" fill="none"/>
  <line x1="50" y1="18" x2="50" y2="8" stroke="#FFC107" stroke-width="3" stroke-linecap="round"/>
  <circle cx="50" cy="6" r="4" fill="#FF9800"/>
  <rect x="12" y="50" width="13" height="6" rx="3" fill="#FFD54F"/>
  <g transform="translate(72,42) rotate(30)">
    <rect x="0" y="8" width="5" height="20" rx="2" fill="#78909C"/>
    <circle cx="2.5" cy="6" r="7" fill="none" stroke="#78909C" stroke-width="4"/>
    <circle cx="2.5" cy="6" r="3" fill="#FFD54F"/>
  </g>
  <rect x="33" y="80" width="10" height="12" rx="4" fill="#FFD54F"/>
  <rect x="57" y="80" width="10" height="12" rx="4" fill="#FFD54F"/>
  <rect x="30" y="62" width="40" height="4" rx="2" fill="#FF9800"/>
  <circle cx="50" cy="55" r="3" fill="#FF9800"/>
</svg>
```

### Bouton flottant
- **Cercle 56px** fond `#FFC107`, ombre portée, contient l'avatar SVG Fixy (32px)
- **Draggable** : on peut le déplacer avec la souris (mousedown/mousemove/mouseup). Si on drag → déplace le bouton. Si on clique sans drag → ouvre le chat.
- **Position sauvegardée** dans localStorage (`fixy_btn_pos`)
- **Pastille rouge pulsante** (8px) en haut à droite tant que l'utilisateur n'a pas interagi
- Position par défaut : `bottom: 24px; right: 24px`

### Fenêtre de chat (quand ouverte)
- **380px × 520px max**, fixed, positionnée en fonction de la position du bouton (au-dessus si bouton en bas, en dessous si bouton en haut)
- **Header** : dégradé `#FFC107 → #FFD54F`, avatar Fixy (36px) + "Fixy — Assistant IA" + sous-titre "Artisan & Gestion" + bouton fermer ✕
- **Zone messages** : fond `#F9FAFB`, scroll vertical
  - Bulles assistant : fond blanc, border `#E5E7EB`, border-radius 16px, coin bas-gauche carré, avatar Fixy miniature (24px) à gauche
  - Bulles utilisateur : fond `#FFC107`, texte noir, border-radius 16px, coin bas-droit carré, aligné à droite
  - Indicateur "typing" : 3 points jaunes qui rebondissent (animation bounce)
- **Actions rapides** (affichées uniquement avant la 1ère interaction) :
  - 4 boutons pilules : "📅 Mes RDV du jour", "📄 Créer un devis", "🔧 Mes services", "📊 Mon CA ce mois"
  - Style : fond `#FFF8E1`, border `#FFE082`, texte `#8A6000`, 11px
- **Zone input** : input texte + bouton envoyer (fond `#FFC107`, icône flèche)
- **Message de bienvenue** (premier message, rôle assistant) :
  > "Bonjour ! Je suis Fixy 🤖, votre assistant IA personnel. Je peux vous aider sur : agenda, devis, factures, clients, disponibilités, comptabilité... Posez-moi votre question !"

### Commandes vocales Fixy (tools)
Fixy comprend des commandes et exécute des actions. En mode mock, simule ces réponses :

| Commande utilisateur | Réponse mock Fixy |
|---|---|
| "Mes RDV du jour" | "Vous avez 2 RDV aujourd'hui :\n• 09:00 — Diagnostic fuite, Mme Fontaine (Paris 11e)\n• 14:00 — Peinture appart., SCI Tilleuls (Vincennes)" |
| "Crée un RDV" | "D'accord ! Pour quel client, quelle date et quelle heure ?" (puis simule un formulaire inline) |
| "Mon CA ce mois" | "Votre CA mars 2026 : 8 420 € TTC (+18% vs février)\n• 14 interventions terminées\n• Panier moyen : 601 €" |
| "Mes dispos" | "Vos disponibilités :\n• Lun-Ven : 08:00–17:00 ✅\n• Sam-Dim : Fermé ❌" |
| "Liste mes services" | "Vous avez 6 services actifs :\n✅ Plomberie — 80–150€\n✅ Électricité — 60–200€\n..." |
| "Crée un devis" | "Ouverture du formulaire devis... ✅" (simule navigation vers section devis) |
| Tout autre message | Réponse générique de conversation |

### Logique JS
```javascript
// Mock responses basées sur mots-clés
function fixyRespond(msg) {
  const lower = msg.toLowerCase();
  if (lower.includes('rdv') && lower.includes('jour')) return MOCK_RESPONSES.rdv_jour;
  if (lower.includes('ca') || lower.includes('chiffre')) return MOCK_RESPONSES.ca;
  if (lower.includes('dispo')) return MOCK_RESPONSES.dispos;
  if (lower.includes('service') || lower.includes('motif')) return MOCK_RESPONSES.services;
  if (lower.includes('devis') && lower.includes('cré')) return MOCK_RESPONSES.create_devis;
  if (lower.includes('facture') && lower.includes('cré')) return MOCK_RESPONSES.create_facture;
  return "Je suis Fixy, votre assistant. Je peux vous aider avec votre agenda, vos devis, factures, services... Que souhaitez-vous faire ?";
}
```

---

## Données mock attendues

Crée en JS un objet `MOCK` contenant :
- `artisan` : { id, company_name: "Jean Dubois", email, phone, bio, rating: 4.8, reviews: 64 }
- `bookings` : 8-10 RDV (variés en statuts/dates/services)
- `services` : 6 motifs (Plomberie, Électricité, Peinture, Carrelage, Maçonnerie, Menuiserie) avec prix/durée/unité
- `clients` : 6 clients (3 B2C, 2 B2B, 1 syndic) avec CA et interventions
- `devis` : 6 devis (variés en statuts)
- `factures` : 5 factures (variées)
- `conversations` : 5 conversations avec 3-5 messages chacune
- `expenses` : 8-10 dépenses (catégories variées)
- `rapports` : 3 rapports d'intervention
- `photos` : 8 photos chantier
- `portfolio` : 6 photos portfolio
- `documents_wallet` : 8 documents conformité avec statuts variés
- `marches` : 4 appels d'offres
- `notifications` : 5 alertes
- `availability` : horaires Lun-Dim
- `proContacts` : 3 contacts pro avec messages

---

## Récapitulatif en fin de fichier

Ajoute un commentaire HTML en fin de fichier :
```html
<!--
RÉCAPITULATIF INTÉGRATION
✅ Sections intégrées : [liste]
❌ Sections manquantes : [liste si applicable]
📝 Notes : [observations]
-->
```
