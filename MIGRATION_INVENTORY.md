# MIGRATION_INVENTORY.md — Dashboard Pro Societe BTP v5

> Inventaire exhaustif des fonctionnalites existantes vs nouveau template HTML.
> Chaque ligne = une fonctionnalite interactive a preserver lors de la migration.

---

## Legende

- **Page** : identifiant `activePage` dans le React actuel
- **Composant** : fichier React source
- **HTML v5** : identifiant `data-p` / `#pg-xxx` dans le nouveau template
- **Statut** : `EXISTE` (deja implemente en React) | `NOUVEAU` (a creer) | `N/A` (pas dans le nouveau template)

---

## 1. SIDEBAR — Structure actuelle vs nouvelle

### Sidebar actuelle (pro_societe)

| Section actuelle | Items |
|---|---|
| Principal | Home, Gestion comptes (gerant) |
| Gestion chantier | Chantiers, Equipes, Agenda/Planning, Gantt, Pointage |
| Finance BTP | Compta Intelligente, Rentabilite, Devis Fournisseurs, Situations, Garanties, Sous-traitance DC4, Recruter ST, Appels d'offres |
| Lots & Parametrage | Lots/Prestations, Horaires chantier |
| Communication | Messagerie, Base clients |
| Facturation | Devis, Pipeline, Factures, Rapports, Photos Chantier, Bibliotheque, Contrats |
| Analyse | Stats, Revenus, Comptabilite, Materiaux & Appro, Bourse aux Marches, Marketplace BTP |
| Profil Pro | Conformite, References chantiers, Parrainage |
| Compte | Mon profil, Modules, Aide, Deconnexion |

### Sidebar nouvelle (HTML v5)

| Section nouvelle | Items | data-p |
|---|---|---|
| Pilotage | Tableau de bord, Comptes utilisateurs, Statistiques, Revenus | home, users, stats, revenus |
| Chantiers | Chantiers, Gantt, Equipes, Pointage, Agenda/Planning, Meteo, Photos, Rapports | chantiers, gantt, equipes, pointage, calendar, meteo, photos, rapports |
| Commercial | Pipeline, Devis, DPGF, Bourse aux Marches | pipeline, devis, dpgf, marches |
| Facturation | Factures, Situations de travaux, Retenues de garantie | factures, situations, garanties |
| Sous-traitance & Achats | Sous-traitance DC4, Recruter ST, Devis Fournisseurs, Materiaux, Marketplace BTP | sous_traitance, sous_traitance_offres, rfq, materiaux, marketplace |
| Finances | Compta Intelligente, Rentabilite, Comptabilite | compta_btp, rentabilite, comptabilite |
| Communication | Messagerie, Base clients, Portail client | messages, clients, portail_client |
| Administration | Conformite, Contrats, Bibliotheque, Lots/Prestations, Horaires chantier | wallet, contrats, bibliotheque, motifs, horaires |
| Vitrine | References chantiers, Parrainage | portfolio, parrainage |
| Compte | Mon profil, Modules, Aide, Deconnexion | settings, modules, help, logout |

---

## 2. PAGES — Inventaire complet

### 2.1 HOME (Tableau de bord)
- **Page** : `home`
- **Composant** : `components/dashboard/HomeSection.tsx` (dynamic import)
- **HTML v5** : `#pg-home`
- **Fonctionnalites React** :
  - KPIs : reservations en attente, completees, revenus, services actifs
  - Agenda du jour (prochains RDV)
  - Actions rapides : Nouveau RDV, Nouveau motif, Creer devis, Creer facture
  - Derniers messages, derniers devis
  - Props : artisan, orgRole, bookings, services, pendingBookings, completedBookings, totalRevenue, firstName, navigateTo, setShowNewRdv, setShowDevisForm, setShowFactureForm, openNewMotif
- **Statut** : EXISTE — adapter aux KPIs BTP du template (chantiers actifs, CA, marge, equipes)

### 2.2 COMPTES UTILISATEURS
- **Page** : `gestion_comptes` (actuel) → `users` (nouveau)
- **Composant** : `components/dashboard/CompteUtilisateursSection.tsx` (dynamic import)
- **HTML v5** : `#pg-users`
- **Fonctionnalites React** :
  - Table des membres (nom, email, role, statut, derniere connexion)
  - Modal d'invitation (email, nom, tel, role, chantiers, permissions)
  - Modal de permissions (matrice module x access level)
  - Actions : inviter, changer role, activer/desactiver, renvoyer invitation, supprimer
  - RBAC : 6 roles x 35 modules x 3 niveaux (FULL/READ/NONE)
  - Guard gerant-only
  - FR/PT i18n
- **Statut** : EXISTE — renommer activePage de `gestion_comptes` a `users`

### 2.3 STATISTIQUES
- **Page** : `stats`
- **Composant** : `components/dashboard/StatsRevenusSection.tsx` (activePage="stats")
- **HTML v5** : `#pg-stats`
- **Fonctionnalites React** :
  - KPIs mensuels (CA, RDV, taux completion)
  - Graphiques CA (bar chart)
  - Repartition par service (pie chart)
  - Top services, top clients
- **Statut** : EXISTE

### 2.4 REVENUS
- **Page** : `revenus`
- **Composant** : `components/dashboard/StatsRevenusSection.tsx` (activePage="revenus")
- **HTML v5** : `#pg-revenus`
- **Fonctionnalites React** :
  - KPIs revenus (CA annuel, encaissements, factures en attente)
  - Historique encaissements
  - Evolution mensuelle
- **Statut** : EXISTE

### 2.5 CHANTIERS
- **Page** : `chantiers`
- **Composant** : `components/dashboard/ChantiersBTPV2.tsx` (dynamic import)
- **HTML v5** : `#pg-chantiers`
- **Fonctionnalites React** :
  - Liste chantiers avec recherche/filtre
  - CRUD chantier (creation, edition, suppression)
  - Supabase-backed (table btp_chantiers)
  - GPS geolocalisation chantier
  - Statuts : Planifie, En cours, Termine, En retard
  - Avancement par chantier
  - Budget, chef de chantier, dates
- **Statut** : EXISTE

### 2.6 PLANIFICATION GANTT
- **Page** : `gantt`
- **Composant** : `components/dashboard/BTPSections.tsx` → GanttSection
- **HTML v5** : `#pg-gantt`
- **Fonctionnalites React** :
  - Diagramme Gantt interactif
  - Barres par chantier avec avancement
  - Ligne "aujourd'hui"
  - Jalons (diamonds)
- **Statut** : EXISTE

### 2.7 EQUIPES
- **Page** : `equipes`
- **Composant** : `components/dashboard/EquipesBTPV2.tsx` (dynamic import)
- **HTML v5** : `#pg-equipes`
- **Fonctionnalites React** :
  - Gestion equipes terrain
  - CRUD equipe (creation, edition)
  - Assignation membres aux chantiers
  - Affichage chef d'equipe, nb personnes
  - Statut : deployee, en repos
- **Statut** : EXISTE

### 2.8 POINTAGE EQUIPES
- **Page** : `pointage`
- **Composant** : `components/dashboard/PointageGeoSection.tsx` (dynamic import)
- **HTML v5** : `#pg-pointage`
- **Fonctionnalites React** :
  - Pointage GPS en temps reel
  - Pointage manuel (fallback)
  - Tableau du jour (arrive, depart, heures, GPS status)
  - Resume heures hebdomadaires
  - Statuts GPS : sur site, zone tampon, hors zone
- **Statut** : EXISTE

### 2.9 AGENDA / PLANNING
- **Page** : `calendar`
- **Composant** : `components/dashboard/CalendarSection.tsx` (dynamic import)
- **HTML v5** : `#pg-calendar`
- **Fonctionnalites React** :
  - Vue semaine/mois/jour
  - Creation RDV (modal)
  - Gestion absences (modal)
  - Detail booking (modal)
  - Navigation calendrier (prev/next)
  - Drag events
  - Actions : accepter, refuser, devis, message
  - Badge nombre de bookings en attente
  - Props complexes : 20+ props (bookings, services, calendar state, handlers)
- **Statut** : EXISTE

### 2.10 METEO CHANTIERS
- **Page** : N/A (nouveau)
- **Composant** : N/A (a creer)
- **HTML v5** : `#pg-meteo`
- **Fonctionnalites a implementer** :
  - Previsions 5 jours par chantier
  - Alertes par seuils BTP (pluie >5mm, vent >60km/h, gel, chaleur >33C)
  - KPIs : chantiers OK, vigilance, alerte rouge, gel
  - Donnees Open-Meteo API
  - Classification : exterieur/interieur/mixte
- **Statut** : NOUVEAU

### 2.11 PHOTOS CHANTIER
- **Page** : `photos_chantier`
- **Composant** : `components/dashboard/PhotosChantierSection.tsx` (dynamic import)
- **HTML v5** : `#pg-photos`
- **Fonctionnalites React** :
  - Upload photos (drag & drop)
  - Galerie par chantier et phase
  - Metadata (date, chantier, phase)
- **Statut** : EXISTE

### 2.12 RAPPORTS DE CHANTIER
- **Page** : `rapports`
- **Composant** : `components/dashboard/RapportsSection.tsx` (dynamic import)
- **HTML v5** : `#pg-rapports`
- **Fonctionnalites React** :
  - Liste rapports avec recherche
  - Types : hebdomadaire, PV reception
  - Export PDF
  - Lien vers navigation (onNavigate)
- **Statut** : EXISTE

### 2.13 PIPELINE COMMERCIAL
- **Page** : `pipeline`
- **Composant** : `components/dashboard/PipelineSection.tsx` (dynamic import)
- **HTML v5** : `#pg-pipeline`
- **Fonctionnalites React** :
  - Kanban 5 colonnes (Prospection, Chiffrage, Offre remise, Negociation, Signe)
  - Drag & drop entre colonnes
  - Cards avec nom, info, montant
  - Navigation vers devis
- **Statut** : EXISTE

### 2.14 DEVIS
- **Page** : `devis`
- **Composant** : `components/dashboard/DevisSection.tsx` (dynamic import)
- **HTML v5** : `#pg-devis`
- **Fonctionnalites React** :
  - Liste devis avec recherche
  - Formulaire creation/edition complet (DevisFactureForm)
  - Lignes de devis (description, qte, unite, prix HT, TVA)
  - Generation PDF (jsPDF + html2canvas)
  - Apercu PDF
  - Factur-X
  - Conversion devis → facture
  - Statuts : brouillon, envoye, signe, refuse
  - Numerotation automatique (API /api/devis-number)
  - Assurance RC Pro obligatoire (hard block)
  - Retractation B2C
- **Statut** : EXISTE

### 2.15 APPELS D'OFFRES / DPGF
- **Page** : `dpgf`
- **Composant** : `components/dashboard/BTPSections.tsx` → DPGFSection
- **HTML v5** : `#pg-dpgf`
- **Fonctionnalites React** :
  - Liste appels d'offres
  - Tableau DPGF (lots, sous-lots, unites, quantites, PU, total)
  - Statuts : en preparation, soumis, retenu
  - Deadlines avec alertes
- **Statut** : EXISTE

### 2.16 BOURSE AUX MARCHES
- **Page** : `marches`
- **Composant** : `components/marches/BourseAuxMarchesSection.tsx` (dynamic import)
- **HTML v5** : `#pg-marches`
- **Fonctionnalites React** :
  - Appels d'offres publics et prives
  - Bouton "Repondre"
  - Filtres, recherche
- **Statut** : EXISTE

### 2.17 FACTURES
- **Page** : `factures`
- **Composant** : `components/dashboard/FacturesSection.tsx` (dynamic import)
- **HTML v5** : `#pg-factures`
- **Fonctionnalites React** :
  - Liste factures avec recherche
  - Formulaire creation/edition (DevisFactureForm partage)
  - Types : situation, acompte, solde
  - Generation PDF
  - Statuts : emise, payee
- **Statut** : EXISTE

### 2.18 SITUATIONS DE TRAVAUX
- **Page** : `situations`
- **Composant** : `components/dashboard/BTPSections.tsx` → SituationsTravaux
- **HTML v5** : `#pg-situations`
- **Fonctionnalites React** :
  - Liste situations avec numero, chantier, periode, montant
  - Calcul retenue 5% automatique
  - Statuts : emise, payee
  - Creation nouvelle situation
- **Statut** : EXISTE

### 2.19 RETENUES DE GARANTIE
- **Page** : `garanties`
- **Composant** : `components/dashboard/BTPSections.tsx` → RetenuesGarantieSection
- **HTML v5** : `#pg-garanties`
- **Fonctionnalites React** :
  - KPIs : total retenu, liberation imminente
  - Tableau par chantier (montant, reception, liberation, statut)
  - Alertes "liberable bientot"
- **Statut** : EXISTE

### 2.20 SOUS-TRAITANCE DC4
- **Page** : `sous_traitance`
- **Composant** : `components/dashboard/BTPSections.tsx` → SousTraitanceDC4Section
- **HTML v5** : `#pg-sous_traitance`
- **Fonctionnalites React** :
  - Liste DC4 (sous-traitant, chantier, montant, % marche, statut)
  - Modal formulaire DC4 reglementaire
  - Champs : titulaire, numero marche, sous-traitant, SIRET, prestations, montant, conditions paiement
  - Statuts : brouillon, soumis au MOA, accepte
- **Statut** : EXISTE

### 2.21 RECRUTER SOUS-TRAITANTS
- **Page** : `sous_traitance_offres`
- **Composant** : `components/dashboard/SousTraitanceOffresSection.tsx` (dynamic import)
- **HTML v5** : `#pg-sous_traitance_offres`
- **Fonctionnalites React** :
  - Publication offres de sous-traitance
  - Reception candidatures
  - Profils ST avec note, tarif, disponibilite
  - Bouton "Contacter"
- **Statut** : EXISTE

### 2.22 DEVIS FOURNISSEURS (RFQ)
- **Page** : `rfq_btp`
- **Composant** : `components/dashboard/RFQSection.tsx`
- **HTML v5** : `#pg-rfq`
- **Fonctionnalites React** :
  - Demandes de prix aux fournisseurs
  - Suivi statuts (envoye, recu, expire)
  - CRUD demande de prix
  - Comparatif fournisseurs
- **Statut** : EXISTE — renommer activePage de `rfq_btp` a `rfq`

### 2.23 MATERIAUX & APPRO
- **Page** : `materiaux`
- **Composant** : `components/dashboard/MateriauxSection.tsx`
- **HTML v5** : `#pg-materiaux`
- **Fonctionnalites React** :
  - Recherche materiaux avec IA (Tavily API)
  - Comparatif prix fournisseurs
  - Export vers devis (onExportDevis)
  - Stock, commandes en cours
- **Statut** : EXISTE

### 2.24 MARKETPLACE BTP
- **Page** : `marketplace_btp`
- **Composant** : `components/dashboard/MarketplaceProBTPSection.tsx` (dynamic import)
- **HTML v5** : `#pg-marketplace`
- **Fonctionnalites React** :
  - Achat/vente materiaux entre pros
  - Annonces avec photos, prix, localisation
  - Recherche, filtres
  - Depot d'annonce
- **Statut** : EXISTE

### 2.25 COMPTA INTELLIGENTE BTP
- **Page** : `compta_btp`
- **Composant** : `components/dashboard/ComptaBTPSection.tsx` (dynamic import)
- **HTML v5** : `#pg-compta_btp`
- **Fonctionnalites React** :
  - KPIs : CA HT cumule, charges sous-traitance, marge brute, tresorerie
  - Ventilation par chantier
  - Agent IA Lea BTP (chat contextualise)
- **Statut** : EXISTE

### 2.26 RENTABILITE CHANTIER
- **Page** : `rentabilite`
- **Composant** : `components/dashboard/RentabiliteChantierSection.tsx` (dynamic import)
- **HTML v5** : `#pg-rentabilite`
- **Fonctionnalites React** :
  - Comparatif budget prevu vs realise
  - Marge prevue vs reelle
  - Graphique bar chart comparatif
  - Alertes depassement
- **Statut** : EXISTE

### 2.27 COMPTABILITE
- **Page** : `comptabilite`
- **Composant** : `components/dashboard/ComptabiliteSection.tsx`
- **HTML v5** : `#pg-comptabilite`
- **Fonctionnalites React** :
  - 5 onglets : Tableau de bord, Revenus, Depenses, Declaration, Agent IA
  - Agent Lea (chat IA comptable)
  - Stockage depenses localStorage
  - Seuils TVA
- **Statut** : EXISTE

### 2.28 MESSAGERIE
- **Page** : `messages`
- **Composant** : `components/dashboard/MessagerieArtisan.tsx`
- **HTML v5** : `#pg-messages`
- **Fonctionnalites React** :
  - Liste conversations (tous, syndics, sous-traitants)
  - Chat temps reel (Supabase Realtime)
  - Envoi texte, photos, pieces jointes
  - Enregistrement vocal
  - Badges messages non lus
  - Proposer devis depuis conversation (matching intelligent motif → service)
  - Blocage agenda depuis devis
- **Statut** : EXISTE

### 2.29 BASE CLIENTS
- **Page** : `clients`
- **Composant** : `components/dashboard/ClientsSection.tsx`
- **HTML v5** : `#pg-clients`
- **Fonctionnalites React** :
  - Liste clients avec recherche
  - Types : syndic, promoteur, collectivite, particulier
  - Actions : Creer RDV, Creer devis
  - Auto-ajout depuis bookings confirmes
- **Statut** : EXISTE

### 2.30 PORTAIL CLIENT
- **Page** : N/A (nouveau)
- **Composant** : N/A (a creer)
- **HTML v5** : `#pg-portail_client`
- **Fonctionnalites a implementer** :
  - KPIs : portails actifs, derniere consultation, situations validees
  - Toggle activation par chantier
  - Configuration modules visibles par client (chips)
  - Log activite clients
  - Section "Ce que le client voit" / "Comment ca fonctionne"
  - Envoi acces email
- **Statut** : NOUVEAU

### 2.31 CONFORMITE (Wallet)
- **Page** : `wallet`
- **Composant** : `components/dashboard/WalletConformiteSection.tsx` (dynamic import)
- **HTML v5** : `#pg-wallet`
- **Fonctionnalites React** :
  - Score de conformite (progress bar)
  - Liste documents (Kbis, URSSAF, Decennale, RC Pro, Qualibat, Carte BTP)
  - Statuts : valide, expire bientot, expire
  - Upload documents
- **Statut** : EXISTE

### 2.32 CONTRATS
- **Page** : `contrats`
- **Composant** : `components/dashboard/GestionnaireSections.tsx` → ContratsSection
- **HTML v5** : `#pg-contrats`
- **Fonctionnalites React** :
  - Liste contrats (marche, sous-traitance, avenant)
  - Statuts : signe, en negociation
- **Statut** : EXISTE

### 2.33 BIBLIOTHEQUE D'OUVRAGES
- **Page** : `bibliotheque`
- **Composant** : `components/dashboard/BibliothequeSection.tsx` (dynamic import)
- **HTML v5** : `#pg-bibliotheque`
- **Fonctionnalites React** :
  - Base de donnees prix unitaires
  - Recherche ouvrages
  - Export vers devis
- **Statut** : EXISTE

### 2.34 LOTS / PRESTATIONS
- **Page** : `motifs`
- **Composant** : `components/dashboard/MotifsSection.tsx` (dynamic import)
- **HTML v5** : `#pg-motifs`
- **Fonctionnalites React** :
  - Catalogue services organise par corps d'etat
  - CRUD complet (creer, editer, supprimer)
  - Toggle actif/inactif
  - Prix unitaire, unite, description
  - Modal creation/edition
- **Statut** : EXISTE

### 2.35 HORAIRES CHANTIER
- **Page** : `horaires`
- **Composant** : `components/dashboard/HorairesSection.tsx` (dynamic import)
- **HTML v5** : `#pg-horaires`
- **Fonctionnalites React** :
  - Horaires par jour de semaine
  - Horaires ete/hiver par chantier
  - Toggle samedi
  - Auto-accept toggle
  - Services par creneau
- **Statut** : EXISTE

### 2.36 REFERENCES CHANTIERS (Portfolio)
- **Page** : `portfolio`
- **Composant** : `components/dashboard/CarnetDeVisiteSection.tsx` (dynamic import)
- **HTML v5** : `#pg-portfolio`
- **Fonctionnalites React** :
  - Galerie realisations
  - Ajout projet
  - Photos, titre, date, type de travaux
- **Statut** : EXISTE

### 2.37 PARRAINAGE
- **Page** : `parrainage`
- **Composant** : `components/dashboard/ParrainageSection.tsx` (dynamic import)
- **HTML v5** : `#pg-parrainage`
- **Fonctionnalites React** :
  - Code parrainage unique
  - KPIs : entreprises parrainées, bonus cumule
  - Tableau parrainages (entreprise, date, statut, bonus)
- **Statut** : EXISTE

### 2.38 PROFIL ENTREPRISE (Settings)
- **Page** : `settings`
- **Composant** : `components/dashboard/SettingsSection.tsx` (dynamic import)
- **HTML v5** : `#pg-settings`
- **Fonctionnalites React** :
  - Onglets : profil, modules
  - Formulaire profil complet (raison sociale, SIRET, email, tel, adresse, certifications, CA)
  - Upload photo profil
  - Toggle auto-accept
  - Upload documents
  - Gestion modules (activer/desactiver, reordonner)
- **Statut** : EXISTE

### 2.39 MODULES
- **Page** : `settings` (tab modules)
- **Composant** : `components/dashboard/SettingsSection.tsx`
- **HTML v5** : `#pg-modules`
- **Fonctionnalites React** :
  - Liste tous modules avec toggle on/off
  - Reordonnancement (fleches haut/bas + numero)
  - Reset ordre par defaut
- **Statut** : EXISTE — dans le nouveau HTML c'est une page separee, pas un tab

### 2.40 AIDE
- **Page** : `help`
- **Composant** : `components/dashboard/AideSection.tsx` (dynamic import)
- **HTML v5** : `#pg-help`
- **Fonctionnalites React** :
  - Guide de demarrage rapide
  - FAQ accordeon (questions/reponses interactives)
  - Contact support
- **Statut** : EXISTE

---

## 3. COMPOSANTS TRANSVERSAUX

### 3.1 HEADER
- **Actuel** : V22 Topbar (h-14, fond noir, logo VITFIX, badge Espace Pro, notifications dropdown, avatar)
- **Nouveau** : Header light (fond #F5F5F5, notifications dropdown orange, avatar)
- **Fonctionnalites a preserver** :
  - Bouton hamburger mobile
  - Logo cliquable → home
  - Badge "Espace Pro"
  - Dropdown notifications (liste, marquer lu, navigation par type)
  - Avatar initiales
  - Bouton retour admin (mode override)

### 3.2 NOTIFICATIONS DROPDOWN
- **Fonctionnalites a preserver** :
  - Liste 20 dernieres notifications
  - Indicateur non-lus (dot colore)
  - "Tout marquer lu" (API PATCH)
  - Click → navigation selon type (message, booking, devis, tva, marketplace)
  - Temps relatif (il y a Xmin, Xh, Xj)
  - Badge compteur dans le header
  - Loading state

### 3.3 CHATBOT FIXY (FAB)
- **Composant** : `components/chat/AiChatBot.tsx`
- **HTML v5** : `.cb-fab` / `.cb-win`
- **Fonctionnalites a preserver** :
  - FAB flottant (bouton rond jaune en bas a droite)
  - Fenetre chat avec historique
  - Creation RDV via chat
  - Creation absence via chat
  - Envoi notification via chat
  - Voix (Web Speech API fr-FR)
  - NE PAS TOUCHER au composant React existant

### 3.4 MESSAGERIE INLINE (dashboard messages)
- **Hook** : `useDashboardMessaging`
- **Fonctionnalites a preserver** :
  - Modal messagerie avec liste conversations
  - Envoi texte, photo, piece jointe
  - Enregistrement vocal
  - Fullscreen image
  - Blocage agenda depuis devis

### 3.5 RBAC / PERMISSIONS
- **Hook** : `usePermissions`
- **Fonctionnalites a preserver** :
  - proCanAccess() pour filtrer sidebar
  - isProGerant pour guard gestion comptes
  - 6 roles x 35 modules x 3 niveaux
  - localStorage sync (fixit_pro_team_role, fixit_pro_company_id)

### 3.6 MODULES CONFIG
- **Hook** : `useModulesConfig`
- **Fonctionnalites a preserver** :
  - isModuleEnabled() pour filtrer sidebar
  - Ordre des modules
  - Persistance config

---

## 4. MAPPING NAVIGATION activePage

| Ancien activePage | Nouveau data-p | Action requise |
|---|---|---|
| home | home | Aucune |
| gestion_comptes | users | Renommer |
| stats | stats | Aucune |
| revenus | revenus | Aucune |
| chantiers | chantiers | Aucune |
| gantt | gantt | Aucune |
| equipes | equipes | Aucune |
| pointage | pointage | Aucune |
| calendar | calendar | Aucune |
| — | meteo | CREER |
| photos_chantier | photos | Renommer |
| rapports | rapports | Aucune |
| pipeline | pipeline | Aucune |
| devis | devis | Aucune |
| dpgf | dpgf | Aucune |
| marches | marches | Aucune |
| factures | factures | Aucune |
| situations | situations | Aucune |
| garanties | garanties | Aucune |
| sous_traitance | sous_traitance | Aucune |
| sous_traitance_offres | sous_traitance_offres | Aucune |
| rfq_btp | rfq | Renommer |
| materiaux | materiaux | Aucune |
| marketplace_btp | marketplace | Renommer |
| compta_btp | compta_btp | Aucune |
| rentabilite | rentabilite | Aucune |
| comptabilite | comptabilite | Aucune |
| messages | messages | Aucune |
| clients | clients | Aucune |
| — | portail_client | CREER |
| wallet | wallet | Aucune |
| contrats | contrats | Aucune |
| bibliotheque | bibliotheque | Aucune |
| motifs | motifs | Aucune |
| horaires | horaires | Aucune |
| portfolio | portfolio | Aucune |
| parrainage | parrainage | Aucune |
| settings | settings | Aucune |
| settings (tab modules) | modules | Separer en page |
| help | help | Aucune |
| canal | — | Garder (pas dans HTML) |
| comm_pro | — | Garder (legacy) |
| chantiers_v22 | — | Fusionner avec chantiers |

---

## 5. PAGES NOUVELLES A CREER

1. **Meteo chantiers** (`meteo`) — Open-Meteo API, previsions 5j, alertes BTP
2. **Portail client** (`portail_client`) — Toggle acces, modules visibles, log activite
3. **Modules** en page separee (`modules`) — Extraire du tab settings

---

## 6. CSS — Changements majeurs

| Element | Ancien (V22) | Nouveau (HTML v5) |
|---|---|---|
| Sidebar | Fond noir, 220px, texte clair | Fond #F5F5F5, 210px, texte gris |
| Header | Fond noir, h-14, border jaune | Fond #F5F5F5, h-48px, border gris |
| Content | bg var(--v22-bg) | bg #FAFAFA |
| Cards | v22-card | .card (border #E8E8E8, radius 6px) |
| Boutons | v22-btn | .btn, .btn-p, .btn-s, .btn-d |
| Tables | — | .dt (compact, 12px) |
| KPIs | — | .kpi, .kpi.hl |
| Sidebar items | V22SidebarItem | .sb-i (border-left active) |
| Logo | VITFIX jaune/blanc | VITFIX orange + badge PRO |

**REGLE** : Ne PAS modifier le CSS du fichier HTML v5. L'integrer tel quel.

---

## 7. ROLLBACK

- Branch `main` = etat stable avant migration
- Creer branch `feat/dashboard-v5` pour la migration
- Si probleme : `git checkout main`
