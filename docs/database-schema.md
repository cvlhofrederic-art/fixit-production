# Schema Base de Donnees Vitfix.io

Documentation complete du schema PostgreSQL (via Supabase) du projet Vitfix.io.
Generee a partir des 37 fichiers de migration SQL et du fichier `lib/types.ts`.

---

## 1. Vue d'ensemble

Vitfix.io utilise **PostgreSQL 15** heberge sur **Supabase** comme base de donnees principale.

- **46 tables** dans le schema `public`
- **1 vue materialisee** (`v_rentabilite_chantier`)
- **5 buckets Storage** securises par RLS (`artisan-documents`, `profile-photos`, `artisan-photos`, `mission-reports`, `tracking`)
- **3 fonctions RPC** exposees (`next_doc_number`, `pt_fiscal_next_seq`, `search_artisans_nearby`)
- **RLS actif sur 100% des tables** (audit migration 041)
- Extensions : `pgcrypto` (chiffrement tokens OAuth)

Le schema couvre les domaines suivants : gestion des artisans/professionnels, reservations clients, syndic de copropriete, bourse aux marches publics, marketplace BTP, conformite fiscale Portugal (AT), paiements Stripe, messagerie, et audit RGPD.

---

## 2. Diagramme ERD

```mermaid
erDiagram

    %% ═══ AUTH / USERS ═══
    auth_users {
        uuid id PK
        text email
        jsonb raw_app_meta_data
        timestamptz created_at
    }

    profiles_artisan {
        uuid id PK
        uuid user_id FK
        text company_name
        text email
        text phone
        text bio
        text siret
        text nif
        text category
        text[] categories
        text[] specialties
        text country
        boolean active
        boolean verified
        numeric rating_avg
        integer rating_count
        text logo_url
        text profile_photo_url
        text slug
        text city
        text postal_code
        float8 latitude
        float8 longitude
        integer zone_radius_km
        text insurance_name
        text insurance_number
        boolean insurance_verified
        text kbis_url
        text insurance_url
        text id_document_url
        text subscription_plan
        text subscription_status
        text stripe_customer_id
        text referral_code
        uuid referral_parrain_id FK
        integer credit_mois_gratuits
        integer total_parrainages_reussis
        boolean referral_flagged
        boolean marches_opt_in
        text[] marches_categories
        text marches_work_mode
        boolean rc_pro_valid
        boolean decennale_valid
        boolean rge_valid
        boolean qualibat_valid
        text type_activite
        text periodicite_declaration
        boolean acre_actif
        boolean declaration_configuree
        jsonb paiement_modes
        boolean tva_auto_activate
        text tva_notified_level
        integer kyc_score
        jsonb kyc_checks
        timestamptz kyc_verified_at
        text kyc_market
        jsonb kbis_extracted
        jsonb certidao_extracted
        timestamptz created_at
        timestamptz updated_at
    }

    profiles_client {
        uuid id PK
        timestamptz created_at
    }

    %% ═══ SERVICES / BOOKINGS ═══
    services {
        uuid id PK
        uuid artisan_id FK
        text name
        text description
        numeric price_ht
        numeric price_ttc
        integer duration_minutes
        boolean active
        text category
        boolean validation_auto
        integer delai_minimum_heures
        timestamptz created_at
    }

    service_etapes {
        uuid id PK
        uuid service_id FK
        integer ordre
        text designation
        timestamptz created_at
    }

    bookings {
        uuid id PK
        uuid artisan_id FK
        uuid service_id FK
        uuid client_id FK
        uuid syndic_id FK
        text status
        date booking_date
        text booking_time
        integer duration_minutes
        text address
        text notes
        numeric price_ht
        numeric price_ttc
        text rapport_ia_source
        timestamptz rapport_ia_genere_le
        text rapport_ia_texte_brut
        timestamptz deleted_at
        uuid deleted_by
        timestamptz created_at
    }

    booking_messages {
        uuid id PK
        uuid booking_id FK
        uuid sender_id FK
        text sender_role
        text content
        text type
        text attachment_url
        boolean read
        timestamptz deleted_at
        timestamptz created_at
    }

    categories {
        uuid id PK
        text name
        boolean active
    }

    availability {
        uuid id PK
        uuid artisan_id FK
        integer day_of_week
        time start_time
        time end_time
        boolean is_available
    }

    artisan_absences {
        uuid id PK
        uuid artisan_id FK
        date start_date
        date end_date
        text reason
        text label
        text source
        timestamptz created_at
    }

    artisan_notifications {
        uuid id PK
        uuid artisan_id FK
        text type
        text title
        text message
        boolean read
        jsonb data
        timestamptz created_at
    }

    artisan_photos {
        uuid id PK
        uuid artisan_id FK
        text url
        timestamptz created_at
    }

    %% ═══ CONVERSATIONS (messagerie directe) ═══
    conversations {
        uuid id PK
        uuid artisan_id FK
        uuid contact_id FK
        timestamptz deleted_at
        timestamptz created_at
    }

    conversation_messages {
        uuid id PK
        uuid conversation_id FK
        uuid sender_id FK
        text content
        timestamptz deleted_at
        timestamptz created_at
    }

    %% ═══ SYNDIC / COPROPRIETE ═══
    syndic_cabinets {
        uuid id PK
        uuid user_id FK
        text nom
        text siret
        text adresse
        text ville
        text code_postal
        text telephone
        text email
        timestamptz created_at
    }

    syndic_team_members {
        uuid id PK
        uuid cabinet_id FK
        uuid user_id FK
        text role
        boolean is_active
        timestamptz created_at
    }

    syndic_immeubles {
        uuid id PK
        uuid cabinet_id FK
        text nom
        text adresse
        text ville
        text code_postal
        integer nb_lots
        integer annee_construction
        text type_immeuble
        numeric budget_annuel
        float8 latitude
        float8 longitude
        timestamptz created_at
    }

    syndic_coproprios {
        uuid id PK
        uuid cabinet_id FK
        text immeuble
        text nom_proprietaire
        text email_proprietaire
        text nom_locataire
        boolean est_occupe
        numeric tantieme
        numeric solde
        boolean acces_portail
        timestamptz created_at
    }

    syndic_signalements {
        uuid id PK
        uuid cabinet_id FK
        text immeuble_nom
        text demandeur_nom
        text demandeur_role
        text type_intervention
        text description
        text priorite
        text statut
        timestamptz deleted_at
        timestamptz created_at
    }

    syndic_signalement_messages {
        uuid id PK
        uuid signalement_id FK
        text auteur
        text role
        text texte
        timestamptz deleted_at
        timestamptz created_at
    }

    syndic_missions {
        uuid id PK
        uuid cabinet_id FK
        uuid signalement_id FK
        text artisan
        text type
        text priorite
        text statut
        date date_intervention
        numeric montant_devis
        numeric montant_facture
        text rapport_artisan
        timestamptz deleted_at
        timestamptz created_at
    }

    syndic_assemblees {
        uuid id PK
        uuid cabinet_id FK
        text titre
        text immeuble
        timestamptz date_ag
        text type_ag
        text statut
        jsonb ordre_du_jour
        numeric quorum
        timestamptz created_at
    }

    syndic_resolutions {
        uuid id PK
        uuid assemblee_id FK
        uuid cabinet_id FK
        text titre
        text majorite
        integer vote_pour
        integer vote_contre
        integer vote_abstention
        text statut
        timestamptz created_at
    }

    syndic_votes_correspondance {
        uuid id PK
        uuid resolution_id FK
        uuid cabinet_id FK
        uuid coproprio_id FK
        text vote
        integer tantiemes
        timestamptz created_at
    }

    syndic_ag_presences {
        uuid id PK
        uuid assemblee_id FK
        uuid cabinet_id FK
        uuid coproprio_id FK
        text nom
        text type_presence
        integer tantiemes
        timestamptz created_at
    }

    syndic_artisans {
        uuid id PK
        uuid cabinet_id FK
        timestamptz created_at
    }

    syndic_messages {
        uuid id PK
        uuid cabinet_id FK
        uuid artisan_user_id FK
        text content
        timestamptz created_at
    }

    syndic_planning_events {
        uuid id PK
        uuid cabinet_id FK
        timestamptz created_at
    }

    syndic_notifications {
        uuid id PK
        uuid syndic_id FK
        text type
        text message
        boolean read
        timestamptz created_at
    }

    syndic_emails_analysed {
        uuid id PK
        uuid syndic_id FK
        timestamptz deleted_at
        timestamptz created_at
    }

    syndic_oauth_tokens {
        uuid id PK
        uuid syndic_id FK
        text access_token
        text refresh_token
        bytea access_token_encrypted
        bytea refresh_token_encrypted
        text oauth_nonce
        timestamptz created_at
    }

    %% ═══ MARCHES / BOURSE ═══
    marches {
        uuid id PK
        uuid publisher_user_id FK
        text title
        text description
        text category
        text location_city
        text status
        text publisher_type
        text publisher_name
        text publisher_email
        date deadline
        text urgency
        numeric budget_min
        numeric budget_max
        text source_type
        text pays
        text district
        text departement
        text langue
        boolean is_recurring
        uuid parent_marche_id FK
        text access_token
        timestamptz created_at
    }

    marches_candidatures {
        uuid id PK
        uuid marche_id FK
        uuid artisan_id FK
        uuid artisan_user_id FK
        numeric price
        text timeline
        text description
        text status
        boolean publisher_evaluated
        boolean artisan_evaluated
        timestamptz created_at
    }

    marches_messages {
        uuid id PK
        uuid marche_id FK
        uuid candidature_id FK
        text sender_type
        text content
        boolean read
        timestamptz created_at
    }

    marches_evaluations {
        uuid id PK
        uuid marche_id FK
        uuid candidature_id FK
        text evaluator_type
        integer note_globale
        integer note_qualite
        integer note_ponctualite
        text commentaire
        timestamptz created_at
    }

    %% ═══ MARKETPLACE BTP ═══
    marketplace_listings {
        uuid id PK
        uuid user_id FK
        text title
        text categorie
        text type_annonce
        numeric prix_vente
        numeric prix_location_jour
        text localisation
        text country
        text etat
        text status
        integer vues
        timestamptz created_at
    }

    marketplace_demandes {
        uuid id PK
        uuid listing_id FK
        uuid buyer_user_id FK
        text type_demande
        numeric prix_propose
        text status
        timestamptz created_at
    }

    %% ═══ BTP PRO (Chantiers/Equipes) ═══
    chantiers_btp {
        uuid id PK
        uuid owner_id FK
        text titre
        text client
        text adresse
        float8 latitude
        float8 longitude
        date date_debut
        date date_fin
        numeric budget
        text statut
        numeric marge_prevue_pct
        numeric montant_facture
        timestamptz created_at
    }

    membres_btp {
        uuid id PK
        uuid owner_id FK
        text prenom
        text nom
        text type_compte
        numeric cout_horaire
        numeric charges_pct
        numeric salaire_brut_mensuel
        text type_contrat
        boolean actif
        timestamptz created_at
    }

    equipes_btp {
        uuid id PK
        uuid owner_id FK
        text nom
        text metier
        uuid chantier_id FK
        timestamptz created_at
    }

    equipe_membres_btp {
        uuid equipe_id PK,FK
        uuid membre_id PK,FK
    }

    pointages_btp {
        uuid id PK
        uuid owner_id FK
        uuid membre_id FK
        uuid chantier_id FK
        text employe
        date date
        time heure_arrivee
        time heure_depart
        numeric heures_travaillees
        text mode
        timestamptz created_at
    }

    depenses_btp {
        uuid id PK
        uuid owner_id FK
        uuid chantier_id FK
        text label
        numeric amount
        text category
        date date
        timestamptz created_at
    }

    settings_btp {
        uuid owner_id PK,FK
        text depot_adresse
        float8 depot_lat
        float8 depot_lng
        numeric cout_horaire_ouvrier
        numeric charges_patronales_pct
        boolean geo_pointage_enabled
        numeric salaire_patron_mensuel
        text statut_juridique
        text regime_tva
        jsonb frais_fixes_mensuels
        timestamptz updated_at
    }

    btp_candidature_messages {
        uuid id PK
        uuid candidature_id FK
        uuid sender_id FK
        text sender_role
        text content
        boolean read
        timestamptz created_at
    }

    %% ═══ RFQ (Demandes de prix materiaux) ═══
    rfqs {
        uuid id PK
        uuid user_id FK
        text country
        text status
        text title
        timestamptz created_at
    }

    rfq_items {
        uuid id PK
        uuid rfq_id FK
        text product_name
        numeric quantity
        text unit
        timestamptz created_at
    }

    suppliers {
        uuid id PK
        text name
        text email
        text country
        text[] categories
        boolean active
        timestamptz created_at
    }

    offers {
        uuid id PK
        uuid rfq_id FK
        uuid supplier_id FK
        text supplier_name
        numeric total_price
        integer delivery_days
        text status
        text token
        timestamptz created_at
    }

    offer_items {
        uuid id PK
        uuid offer_id FK
        uuid rfq_item_id FK
        text product_name
        numeric unit_price
        numeric quantity
        numeric total_price
        timestamptz created_at
    }

    %% ═══ PAYMENTS / SUBSCRIPTIONS ═══
    subscriptions {
        uuid id PK
        uuid user_id FK
        text stripe_customer_id
        text stripe_subscription_id
        text plan_id
        text status
        timestamptz current_period_end
        boolean cancel_at_period_end
        timestamptz created_at
    }

    %% ═══ DOCUMENTS / DEVIS / FACTURES ═══
    devis {
        uuid id PK
        uuid artisan_id FK
        uuid artisan_user_id FK
        text numero
        text client_name
        jsonb items
        bigint total_ht_cents
        bigint total_ttc_cents
        numeric tax_rate
        text country
        text status
        text pdf_url
        timestamptz created_at
    }

    factures {
        uuid id PK
        uuid devis_id FK
        uuid artisan_id FK
        uuid artisan_user_id FK
        text numero
        text client_name
        jsonb items
        bigint total_ht_cents
        bigint total_ttc_cents
        text status
        date due_date
        timestamptz paid_at
        text pdf_url
        timestamptz created_at
    }

    doc_sequences {
        uuid artisan_user_id PK,FK
        text doc_type PK
        integer year PK
        integer last_seq
    }

    declarations_sociales {
        uuid id PK
        uuid artisan_id FK
        text pays
        text periode_label
        numeric ca_periode
        numeric cotisations_estimees
        text statut
        timestamptz created_at
    }

    analyses_devis {
        uuid id PK
        uuid user_id FK
        text user_type
        text pdf_url
        integer score_conformite
        integer score_confiance
        text action_recommandee
        jsonb extracted
        timestamptz created_at
    }

    conversations_simulateur {
        uuid id PK
        uuid client_id FK
        jsonb messages
        text[] metiers_detectes
        numeric estimation_basse
        numeric estimation_haute
        text ville
        timestamptz created_at
    }

    %% ═══ PORTUGAL FISCAL ═══
    pt_fiscal_series {
        uuid id PK
        uuid artisan_id FK
        varchar series_prefix
        varchar doc_type
        varchar validation_code
        integer current_seq
        boolean is_active
        integer fiscal_year
        timestamptz created_at
    }

    pt_fiscal_documents {
        uuid id PK
        uuid artisan_id FK
        uuid series_id FK
        varchar doc_type
        varchar doc_number
        integer seq_number
        varchar atcud
        text hash
        varchar status
        date issue_date
        varchar issuer_nif
        numeric net_total
        numeric tax_total
        numeric gross_total
        text qr_code_string
        jsonb lines
        uuid source_doc_id FK
        timestamptz created_at
    }

    %% ═══ REFERRAL / PARRAINAGE ═══
    referrals {
        uuid id PK
        uuid parrain_id FK
        uuid filleul_id FK
        text code
        text statut
        text source_partage
        smallint risk_score
        jsonb risk_flags
        timestamptz created_at
    }

    referral_risk_log {
        uuid id PK
        uuid referral_id FK
        uuid artisan_id FK
        text type_evenement
        text detail
        timestamptz created_at
    }

    credits_log {
        uuid id PK
        uuid artisan_id FK
        text type
        integer mois_credits
        uuid referral_id FK
        timestamptz created_at
    }

    %% ═══ SPECIALITES ═══
    specialties {
        uuid id PK
        text slug
        text label_fr
        text label_pt
        text code_ape
        text applies_to
        integer sort_order
        timestamptz created_at
    }

    profile_specialties {
        uuid id PK
        uuid user_id FK
        uuid specialty_id FK
        text verified_source
        timestamptz created_at
    }

    %% ═══ AUDIT / SYSTEME ═══
    audit_logs {
        uuid id PK
        uuid user_id FK
        text action
        text table_name
        uuid record_id
        jsonb details
        text ip_address
        timestamptz created_at
    }

    idempotency_keys {
        text key PK
        jsonb response_body
        integer response_status
        timestamptz created_at
    }

    stripe_webhook_events {
        text event_id PK
        text event_type
        timestamptz processed_at
    }

    sync_jobs {
        uuid id PK
        text source
        text zone_test
        text statut
        integer nb_inserts
        integer nb_errors
        timestamptz started_at
        timestamptz completed_at
    }

    %% ═══════════════════════════════════════
    %% RELATIONS (FK)
    %% ═══════════════════════════════════════

    auth_users ||--o| profiles_artisan : "user_id"
    auth_users ||--o| profiles_client : "id"
    auth_users ||--o| subscriptions : "user_id"
    auth_users ||--o| settings_btp : "owner_id"

    profiles_artisan ||--o{ services : "artisan_id"
    profiles_artisan ||--o{ bookings : "artisan_id"
    profiles_artisan ||--o{ availability : "artisan_id"
    profiles_artisan ||--o{ artisan_absences : "artisan_id"
    profiles_artisan ||--o{ artisan_notifications : "artisan_id"
    profiles_artisan ||--o{ artisan_photos : "artisan_id"
    profiles_artisan ||--o{ referrals : "parrain_id"
    profiles_artisan ||--o{ referrals : "filleul_id"
    profiles_artisan ||--o{ referral_risk_log : "artisan_id"
    profiles_artisan ||--o{ credits_log : "artisan_id"
    profiles_artisan ||--o{ declarations_sociales : "artisan_id"
    profiles_artisan ||--o{ marches_candidatures : "artisan_id"

    services ||--o{ service_etapes : "service_id"
    services ||--o{ bookings : "service_id"

    bookings ||--o{ booking_messages : "booking_id"

    auth_users ||--o{ conversations : "artisan_id"
    auth_users ||--o{ conversations : "contact_id"
    conversations ||--o{ conversation_messages : "conversation_id"

    auth_users ||--o| syndic_cabinets : "user_id"
    syndic_cabinets ||--o{ syndic_team_members : "cabinet_id"
    syndic_cabinets ||--o{ syndic_immeubles : "cabinet_id"
    syndic_cabinets ||--o{ syndic_coproprios : "cabinet_id"
    syndic_cabinets ||--o{ syndic_signalements : "cabinet_id"
    syndic_cabinets ||--o{ syndic_missions : "cabinet_id"
    syndic_cabinets ||--o{ syndic_artisans : "cabinet_id"
    syndic_cabinets ||--o{ syndic_assemblees : "cabinet_id"

    syndic_signalements ||--o{ syndic_signalement_messages : "signalement_id"
    syndic_signalements ||--o{ syndic_missions : "signalement_id"

    syndic_assemblees ||--o{ syndic_resolutions : "assemblee_id"
    syndic_assemblees ||--o{ syndic_ag_presences : "assemblee_id"
    syndic_resolutions ||--o{ syndic_votes_correspondance : "resolution_id"
    syndic_coproprios ||--o{ syndic_votes_correspondance : "coproprio_id"
    syndic_coproprios ||--o{ syndic_ag_presences : "coproprio_id"

    auth_users ||--o{ marches : "publisher_user_id"
    marches ||--o{ marches_candidatures : "marche_id"
    marches ||--o{ marches_messages : "marche_id"
    marches ||--o{ marches_evaluations : "marche_id"
    marches ||--o| marches : "parent_marche_id"

    marches_candidatures ||--o{ marches_messages : "candidature_id"
    marches_candidatures ||--o{ marches_evaluations : "candidature_id"
    marches_candidatures ||--o{ btp_candidature_messages : "candidature_id"

    auth_users ||--o{ marketplace_listings : "user_id"
    marketplace_listings ||--o{ marketplace_demandes : "listing_id"
    auth_users ||--o{ marketplace_demandes : "buyer_user_id"

    auth_users ||--o{ chantiers_btp : "owner_id"
    auth_users ||--o{ membres_btp : "owner_id"
    auth_users ||--o{ equipes_btp : "owner_id"
    chantiers_btp ||--o{ equipes_btp : "chantier_id"
    chantiers_btp ||--o{ pointages_btp : "chantier_id"
    chantiers_btp ||--o{ depenses_btp : "chantier_id"
    membres_btp ||--o{ pointages_btp : "membre_id"
    equipes_btp ||--o{ equipe_membres_btp : "equipe_id"
    membres_btp ||--o{ equipe_membres_btp : "membre_id"

    auth_users ||--o{ rfqs : "user_id"
    rfqs ||--o{ rfq_items : "rfq_id"
    rfqs ||--o{ offers : "rfq_id"
    suppliers ||--o{ offers : "supplier_id"
    offers ||--o{ offer_items : "offer_id"
    rfq_items ||--o{ offer_items : "rfq_item_id"

    auth_users ||--o{ devis : "artisan_user_id"
    devis ||--o{ factures : "devis_id"
    auth_users ||--o{ doc_sequences : "artisan_user_id"
    auth_users ||--o{ analyses_devis : "user_id"
    auth_users ||--o{ conversations_simulateur : "client_id"

    auth_users ||--o{ pt_fiscal_series : "artisan_id"
    pt_fiscal_series ||--o{ pt_fiscal_documents : "series_id"
    pt_fiscal_documents ||--o| pt_fiscal_documents : "source_doc_id"

    auth_users ||--o{ audit_logs : "user_id"
    auth_users ||--o{ profile_specialties : "user_id"
    specialties ||--o{ profile_specialties : "specialty_id"

    referrals ||--o{ referral_risk_log : "referral_id"
    referrals ||--o{ credits_log : "referral_id"
```

---

## 3. Tables par domaine

### 3.1 Auth / Profils utilisateurs

| Table | Description | Lignes estimees |
|-------|-------------|-----------------|
| `profiles_artisan` | Profil complet artisan/pro BTP (70+ colonnes apres enrichissements) | Variable |
| `profiles_client` | Profil client (B2C), lie a `auth.users.id` | Variable |
| `subscriptions` | Abonnements Stripe (1 par user, plan + statut + periodes) | Variable |
| `profile_specialties` | Pivot user <-> specialites (verifiee KYC ou auto-declaree) | Variable |
| `specialties` | Catalogue master des 26 specialites BTP (FR + PT) | 26 (seed) |

### 3.2 Artisans / Services

| Table | Description |
|-------|-------------|
| `services` | Motifs de RDV crees par l'artisan (prix, duree, validation auto) |
| `service_etapes` | Etapes par defaut d'un service (template pour devis) |
| `availability` | Creneaux horaires hebdomadaires par artisan |
| `artisan_absences` | Periodes d'indisponibilite (conges, chantier) |
| `artisan_notifications` | Notifications artisan (RDV, messages, rappels) |
| `artisan_photos` | Photos de portfolio/chantier |
| `categories` | Categories metier (lecture publique) |

### 3.3 Clients / Reservations

| Table | Description |
|-------|-------------|
| `bookings` | Reservations client-artisan (statut, prix, rapport IA, soft delete) |
| `booking_messages` | Messages lies a une reservation (texte, photo, vocal, devis) |
| `conversations` | Fils de discussion directe artisan-client |
| `conversation_messages` | Messages dans les conversations directes |
| `conversations_simulateur` | Historique des estimations IA du simulateur devis |
| `analyses_devis` | Analyses IA de devis (scores, alertes, recommandations) |

### 3.4 Syndic / Copropriete

| Table | Description |
|-------|-------------|
| `syndic_cabinets` | Cabinets de syndic (identification, coordonnees) |
| `syndic_team_members` | Membres d'equipe du cabinet (role, actif/inactif) |
| `syndic_immeubles` | Immeubles geres (lots, budget, geoloc, reglement) |
| `syndic_coproprios` | Copropriétaires et locataires par lot |
| `syndic_signalements` | Signalements d'incident (priorite, statut, soft delete) |
| `syndic_signalement_messages` | Messages lies a un signalement |
| `syndic_missions` | Missions d'intervention artisan (devis, facture, rapport) |
| `syndic_assemblees` | Assemblees generales (AG ordinaires/extraordinaires) |
| `syndic_resolutions` | Resolutions votees en AG (majorite art.24/25/26) |
| `syndic_votes_correspondance` | Votes par correspondance (tantiemes) |
| `syndic_ag_presences` | Feuille d'emargement AG |
| `syndic_artisans` | Artisans lies au cabinet |
| `syndic_messages` | Messagerie syndic-artisan |
| `syndic_planning_events` | Evenements planning du cabinet |
| `syndic_notifications` | Notifications syndic |
| `syndic_emails_analysed` | Emails analyses par IA (Max Syndic) |
| `syndic_oauth_tokens` | Tokens OAuth (acces email), chiffrement AES via pgcrypto |

### 3.5 Marketplace / Marches

| Table | Description |
|-------|-------------|
| `marches` | Appels d'offres (publics, BTP sous-traitance, synces externes) |
| `marches_candidatures` | Candidatures artisan sur un marche (prix, delai, compliance) |
| `marches_messages` | Messagerie publisher-artisan sur un marche |
| `marches_evaluations` | Evaluations bidirectionnelles post-mission (5 criteres) |
| `marketplace_listings` | Annonces vente/location materiel BTP (P2P) |
| `marketplace_demandes` | Demandes d'achat/location sur les annonces |
| `btp_candidature_messages` | Messagerie BTP-artisan sur sous-traitance |
| `sync_jobs` | Suivi des jobs de synchronisation marches externes |

### 3.6 Paiements

| Table | Description |
|-------|-------------|
| `subscriptions` | Abonnements Stripe par utilisateur |
| `stripe_webhook_events` | Deduplication des webhooks Stripe |
| `idempotency_keys` | Cles d'idempotence pour API (TTL 24h) |

### 3.7 Documents / Facturation

| Table | Description |
|-------|-------------|
| `devis` | Devis artisan (montants en centimes, statut, PDF, mentions legales) |
| `factures` | Factures (liees optionnellement a un devis, memes champs) |
| `doc_sequences` | Numerotation sequentielle gapless par artisan/type/annee |
| `declarations_sociales` | Historique des declarations URSSAF/SS (FR + PT) |

### 3.8 RFQ (Demandes de prix materiaux)

| Table | Description |
|-------|-------------|
| `rfqs` | Demandes de prix groupees (FR + PT) |
| `rfq_items` | Lignes produit d'une demande |
| `suppliers` | Fournisseurs referencees (5 seeds FR + PT) |
| `offers` | Offres fournisseur en reponse a un RFQ |
| `offer_items` | Lignes detaillees d'une offre (prix calcule automatiquement) |

### 3.9 Portugal / Fiscal AT

| Table | Description |
|-------|-------------|
| `pt_fiscal_series` | Series documentaires enregistrees aupres de l'AT (validation_code, seq) |
| `pt_fiscal_documents` | Documents fiscaux (hash chain RSA-SHA1, ATCUD, QR code, SAF-T) |

### 3.10 Parrainage

| Table | Description |
|-------|-------------|
| `referrals` | Cycle de vie complet d'un parrainage (8 statuts, anti-fraude) |
| `referral_risk_log` | Journal anti-fraude (jamais efface) |
| `credits_log` | Historique des credits parrainage (gains + consommations) |

### 3.11 BTP Pro (Gestion chantiers)

| Table | Description |
|-------|-------------|
| `chantiers_btp` | Projets BTP (GPS, budget, marge, facturation) |
| `membres_btp` | Employes/ouvriers (cout horaire, contrat, indemnites) |
| `equipes_btp` | Equipes affectees a un chantier |
| `equipe_membres_btp` | Pivot equipe <-> membre (table associative) |
| `pointages_btp` | Pointages avec geolocalisation (manuel, geo_auto, geo_confirme) |
| `depenses_btp` | Depenses par chantier (materiaux, autres) |
| `settings_btp` | Parametres patron BTP (depot GPS, couts defaut, regime fiscal) |

### 3.12 Audit / Systeme

| Table | Description |
|-------|-------------|
| `audit_logs` | Traçabilite RGPD (actions sensibles, IP, user-agent) |
| `idempotency_keys` | Protection anti-doublon API (TTL 24h) |
| `stripe_webhook_events` | Deduplication webhooks (TTL 7j) |
| `sync_jobs` | Historique des jobs de sync marches publics |

---

## 4. Detail des tables principales

### 4.1 profiles_artisan

Table la plus riche du schema (70+ colonnes apres toutes les migrations). Stocke l'ensemble du profil professionnel : identite, coordonnees, geolocalisation, assurance, abonnement, compliance (RC Pro, Decennale, RGE, Qualibat), KYC (score, documents extraits), preferences bourse, profil fiscal (type activite, ACRE, TVA), et modes de paiement.

Colonnes cles ajoutees par migration :
- 007 : `marches_opt_in`, `rc_pro_valid`, `decennale_valid`, `rge_valid`, `qualibat_valid`
- 010 : `referral_code` (UNIQUE), `referral_parrain_id`, `credit_mois_gratuits`
- 012 : `type_activite`, `periodicite_declaration`, `acre_actif`
- 013 : `paiement_modes` (JSONB)
- 014 : `logo_url`
- 026 : `tva_auto_activate`, `tva_notified_level`
- 033 : `id_document_url`
- 034 : `kyc_score`, `kyc_checks`, `kbis_extracted`, `certidao_extracted`, `kyc_market`
- 038 : `country`, `latitude`, `longitude`

### 4.2 bookings

Reservations entre client et artisan. Statuts : `pending`, `confirmed`, `cancelled`, `completed`. Soft delete via `deleted_at`/`deleted_by` (migration 039). Rapport IA stocke directement sur la reservation (`rapport_ia_source`, `rapport_ia_texte_brut`).

### 4.3 marches

Table des appels d'offres, enrichie en 6 migrations successives (006 a 032). Supporte les marches publics, la sous-traitance BTP, les marches synces depuis sources externes (BOAMP, BASE.gov.pt). Geolocalisation, exigences compliance, recurrence, multi-pays (FR/PT).

### 4.4 devis / factures

Persistance serveur des documents comptables. Montants stockes en centimes (`total_ht_cents`, `total_ttc_cents`) pour eviter les erreurs d'arrondi. Numerotation sequentielle gapless via `doc_sequences` et la fonction `next_doc_number()`.

### 4.5 pt_fiscal_documents

Conformite AT Portugal. Chaque document porte un hash RSA-SHA1 chaine au precedent (Portaria 363/2010), un code ATCUD, et un QR code. Les triggers interdisent la suppression et la modification des champs immutables (hash, numero, ATCUD). La fonction `pt_fiscal_next_seq()` garantit l'atomicite de la numerotation.

### 4.6 chantiers_btp + pointages_btp

Gestion de chantier BTP avec geolocalisation. Le pointage supporte 3 modes : `manuel`, `geo_auto` (clock-in automatique par proximite GPS), `geo_confirme` (confirme par l'ouvrier). La vue `v_rentabilite_chantier` calcule en temps reel : cout main d'oeuvre, charges patronales, indemnites, depenses, benefice net, et benefice par homme/jour.

---

## 5. Politiques RLS

Toutes les tables du schema `public` ont RLS active (verifie par migration 041). Les API routes utilisent `supabaseAdmin` (service_role) et contournent RLS. Les policies protegent contre l'exposition de la cle `anon`.

### Patterns RLS par domaine

| Pattern | Tables concernees | Logique |
|---------|-------------------|---------|
| **Owner direct** | `profiles_client`, `subscriptions`, `doc_sequences`, `analyses_devis`, `conversations_simulateur` | `user_id = auth.uid()` ou `id = auth.uid()` |
| **Artisan via profiles_artisan** | `services`, `bookings`, `availability`, `artisan_absences`, `artisan_notifications`, `artisan_photos`, `service_etapes` | JOIN sur `profiles_artisan` pour resoudre `user_id` depuis `artisan_id` |
| **Cabinet + team** | `syndic_immeubles`, `syndic_signalements`, `syndic_missions`, `syndic_assemblees`, `syndic_resolutions`, `syndic_votes_correspondance`, `syndic_ag_presences`, `syndic_coproprios` | `cabinet_id = auth.uid()` OU membre actif dans `syndic_team_members` |
| **Coproprio self-read** | `syndic_coproprios` | Match email proprietaire/locataire avec `auth.users.email` |
| **Participant** | `conversations`, `conversation_messages`, `booking_messages`, `syndic_messages` | L'un des deux participants (artisan_id/contact_id ou client_id via booking) |
| **Public read** | `marches` (open), `profiles_artisan` (active), `services` (active), `categories`, `availability`, `artisan_photos`, `specialties`, `profile_specialties`, `marketplace_listings` (non deleted) | SELECT ouvert avec filtre sur statut/actif |
| **Soft delete** | `bookings`, `conversations`, `conversation_messages`, `syndic_signalements`, `syndic_missions`, `booking_messages`, `syndic_signalement_messages`, `syndic_emails_analysed` | `deleted_at IS NULL` ajoute dans le USING |
| **Service role only** | `audit_logs`, `idempotency_keys` | Aucune policy pour `authenticated`, uniquement `service_role` |
| **Admin only** | `referral_risk_log` | `USING (false)` pour tous les clients |

### Storage buckets

| Bucket | Lecture | Ecriture | Suppression |
|--------|---------|----------|-------------|
| `profile-photos` | Publique | Owner (folder = uid) | Owner |
| `artisan-photos` | Publique | Owner (folder = uid) | Owner |
| `artisan-documents` | Owner uniquement | Owner (folder = uid) | Owner |
| `mission-reports` | Owner uniquement | Owner (folder = uid) | Owner |
| `tracking` | Bloquee (false) | Service role only | Service role only |

---

## 6. Relations cles

### Flux reservation (B2C)

`auth.users` -> `profiles_client` (1:1) -> `bookings` (1:N) <- `profiles_artisan` (1:N) <- `services` (1:N)

Le client cree une reservation (`bookings`) pour un service specifique d'un artisan. Les messages de la reservation transitent par `booking_messages`. Le rapport d'intervention est stocke directement sur `bookings` (champs `rapport_ia_*`).

### Flux syndic (B2B)

`auth.users` -> `syndic_cabinets` (1:1) -> `syndic_immeubles` (1:N) -> signalements -> missions

Un copropriétaire ou locataire cree un `syndic_signalements`. Le syndic (ou un membre d'equipe) le transforme en `syndic_missions` avec affectation d'artisan. Les AG sont gerees via `syndic_assemblees` -> `syndic_resolutions` -> `syndic_votes_correspondance`.

### Flux marche (marketplace)

`marches` <- `marches_candidatures` (N artisans) -> `marches_evaluations` (bidirectionnelle)

Un donneur d'ordre publie un marche. Les artisans candidatent. Le donneur accepte/rejette. Apres la mission, evaluation mutuelle. Les messages transitent par `marches_messages` (public) ou `btp_candidature_messages` (sous-traitance BTP).

### Flux BTP Pro

`chantiers_btp` <- `equipes_btp` <- `equipe_membres_btp` -> `membres_btp`
`chantiers_btp` <- `pointages_btp` -> `membres_btp`
`chantiers_btp` <- `depenses_btp`

La vue `v_rentabilite_chantier` agrege pointages (heures x cout horaire x charges) et depenses pour calculer la rentabilite par chantier.

### Flux fiscal Portugal

`pt_fiscal_series` (series validees AT) -> `pt_fiscal_documents` (documents chaines par hash)

Chaque document reference le hash du precedent dans sa serie, formant une chaine cryptographique. L'ATCUD est compose du `validation_code` de la serie + le numero sequentiel.

### Flux parrainage

`profiles_artisan` (parrain) -> `referrals` -> `profiles_artisan` (filleul) -> `credits_log`

Le cycle complet : clic -> inscription -> premier paiement -> periode de verification (J+7) -> credit distribue. L'anti-fraude (IP, moyen de paiement) alimente `referral_risk_log`.

---

## 7. Migrations

Liste chronologique des 37 fichiers de migration.

| # | Fichier | Description |
|---|---------|-------------|
| 001 | `001_syndic_tables.sql` | Tables syndic de base (immeubles, signalements, missions) + RLS |
| 004 | `004_syndic_coproprios.sql` | Table copropriétaires avec tantiemes, solde, portail |
| 005 | `005_syndic_assemblees.sql` | AG digitales (assemblees, resolutions, votes correspondance, presences) |
| 006 | `006_bourse_marches.sql` | Bourse aux marches V1 (marches + candidatures + RLS) |
| 007 | `007_marches_v2.sql` | Geolocalisation marches, exigences compliance artisan, publisher types |
| 008 | `008_marches_v3_features.sql` | Messagerie marches, evaluations, recurrence, templates |
| 009 | `009_services_validation_auto.sql` | Validation auto + delai minimum sur services |
| 010 | `010_referral_system.sql` | Programme parrainage complet (referrals, risk_log, credits_log) |
| 011 | `011_rapport_ia_fields.sql` | Champs rapport IA sur bookings (source, texte brut, timestamp) |
| 012 | `012_declaration_sociale.sql` | Profil fiscal artisan + table declarations_sociales |
| 013 | `013_paiement_modes.sql` | Modes de paiement artisan (JSONB : virement, Stripe, cheque, etc.) |
| 013b | `013b_service_etapes.sql` | Etapes par service (template pour devis) |
| 014 | `014_artisan_logo.sql` | Colonne logo_url sur profiles_artisan |
| 020 | `020_analyses_devis.sql` | Table analyses_devis (scores IA, alertes, recommandations) |
| 021 | `021_conversations_simulateur.sql` | Historique conversations simulateur devis |
| 022 | `022_doc_sequences.sql` | Numerotation gapless devis/factures + fonction `next_doc_number()` |
| 023 | `023_storage_rls.sql` | Policies RLS pour 3 buckets Storage (photos, documents) |
| 024 | `024_missing_foreign_keys.sql` | 3 FK manquantes (signalements, missions -> syndic_cabinets ; candidatures -> artisan) |
| 025 | `025_rfq_btp.sql` | Systeme RFQ (rfqs, rfq_items, suppliers, offers, offer_items) |
| 026 | `026_tva_settings.sql` | Parametres TVA/IVA auto-activation + notification seuil |
| 027 | `027_marketplace_btp.sql` | Marketplace P2P materiel BTP (listings + demandes) |
| 028 | `028_sous_traitance_btp.sql` | Extension marches pour sous-traitance BTP + messagerie |
| 029 | `029_btp_data_migration.sql` | Tables BTP completes (chantiers, membres, equipes, pointages, depenses, settings) + vue rentabilite |
| 030 | `030_compta_btp_avancee.sql` | Comptabilite avancee BTP (salaire patron, charges detaillees, frais fixes) |
| 031 | `031_marches_zones.sql` | Multi-pays marches (pays, district, departement) + table sync_jobs |
| 032 | `032_marches_source_type.sql` | Colonne source_type pour marches synces par cron |
| 033 | `033_id_document_column.sql` | Colonne id_document_url pour KYC |
| 034 | `034_kyc_verification.sql` | Colonnes KYC enrichies (score, checks, extractions OCR KBIS/certidao) |
| 035 | `035_specialties.sql` | Catalogue specialites BTP (26 metiers FR+PT) + pivot profile_specialties |
| 036 | `036_add_missing_foreign_keys.sql` | Ajout 3 FK manquantes (identique a 024, idempotent) |
| 037 | `037_add_subscriptions_table.sql` | Table subscriptions Stripe + idempotency_keys |
| 038 | `038_audit_complete_fix.sql` | Tables devis/factures, geoloc artisan, haversine, subscriptions |
| 039 | `039_fix_security_audit.sql` | Audit securite complet : RLS renforce, soft delete, tokens chiffres, indexes, suppression exec_sql |
| 040 | `040_portugal_fiscal.sql` | Tables fiscales Portugal AT (series, documents, hash chain, ATCUD) |
| 041 | `041_rls_complete_audit.sql` | RLS actif sur 100% des tables (21 tables verifiees) |
| 042 | `042_sprint2_audit_logs.sql` | Table audit_logs RGPD + stripe_webhook_events |
| 043 | `043_sprint3_security_definer_fix.sql` | Fix search_path sur fonctions SECURITY DEFINER + REVOKE public |
| 044 | `044_storage_rls_policies.sql` | Policies RLS pour les 5 buckets Storage (defense en profondeur) |
