# Catégorie « Agents IA » Syndic — Design

**Date :** 2026-05-11
**Auteur :** Claude (brainstorming session — exciting-bardeen-ac4a0b)
**Statut :** Design validé, prêt pour plan d'implémentation

---

## 1. Objectif

Transformer l'écosystème IA fragmenté du dashboard Syndic (bulle flottante Fixy + onglets dispersés Max + Léa enterrée + Alfredo backbone caché) en une **catégorie unifiée « Agents IA »** dans la sidebar, où chaque agent vit comme un **module à part entière** avec une **interface chat plein écran ChatGPT-style** (historique de conversations, voix, streaming, actions agentiques, RBAC fin).

Les 4 agents :

| Agent | Avatar | Rôle métier | Endpoint principal |
|---|---|---|---|
| **Fixy** | 🤖 | Secrétaire d'action — création missions, recherche dossiers, classement, navigation, alertes, courriers | `/api/syndic/fixy-syndic` (existant, à enrichir) |
| **Max** | 🎓 | Expert-conseil juridique — droit copro FR/PT, ALUR/ELAN, Lei 8/2022, conformité, contentieux | `/api/syndic/max-ai` (existant) |
| **Léa** | 👩‍💼 | Comptabilité copro — charges, budgets, appels, impayés, rapprochements bancaires | `/api/syndic/lea-comptable` (existant, 652 lignes) |
| **Alfredo** | 📧 | Gestionnaire emails — scan boîte, **analyse contexte client (historique mails, missions, dossier copro, statut paiements)**, classification, **brouillons de réponse personnalisés** | `/api/syndic/alfredo-chat` (nouveau wrapper) sur `/api/email-agent/*` (existant) |

## 2. Découvertes de la cartographie

L'audit préalable a révélé que **3 des 4 backends sont déjà construits** :

- **Léa** : route API 652 lignes + composant `AgentComptableCopro` + avatar `LeaAvatar` (production-ready, périmètre comptable strict)
- **Alfredo backbone** : OAuth Gmail complet, polling, classification Groq, OCR Llama 4 Vision, envoi via Gmail API, RLS, schéma DB (tables `syndic_oauth_tokens`, `syndic_emails_analysed`)
- **Sidebar catégorisée** : 12 catégories existantes (`SIDEBAR_CATEGORIES`), ajouter `agents_ia` est trivial

Le travail réel est donc **(a)** une refonte UI partagée, **(b)** le câblage des 4 agents dedans, **(c)** des correctifs sécurité critiques, **(d)** la création du wrapper conversationnel Alfredo + ses tools de contexte client.

### Faiblesses critiques détectées (à corriger dans le scope)

| # | Problème | Sévérité |
|---|---|---|
| 1 | OAuth tokens Gmail stockés en clair dans Postgres | 🔴 RGPD bloquant |
| 2 | Emails PII artisans envoyés en clair à Groq dans les prompts Fixy | 🔴 RGPD |
| 3 | Pas de persistance conversation (Fixy perd l'historique au reload) | 🟡 UX |
| 4 | Polling 7j only (pas de webhook Gmail Push) | 🟡 Réactivité |
| 5 | Drift de responsabilité Max ↔ Léa sur comptabilité | 🟡 Confusion utilisateur |
| 6 | Pas d'instrumentation Langfuse (alors que CLAUDE.md l'exige pour tout nouvel agent) | 🟡 Observabilité |
| 7 | Copro-AI orphelin (75 lignes, usage incertain) | 🟢 Cleanup |

## 3. Architecture cible

### 3.1. Vue d'ensemble

```
app/syndic/dashboard
│
├─ Sidebar (composant existant, supporte déjà les catégories)
│   ├─ ... modules existants ...
│   └─ 📦 Catégorie "Agents IA"      ← NOUVEAU
│       ├─ 🤖 Fixy        → page=fixy_agent
│       ├─ 🎓 Max         → page=max_agent
│       ├─ 👩‍💼 Léa        → page=lea_agent
│       └─ 📧 Alfredo     → page=alfredo_agent (avec badge "N nouveaux")
│
└─ Chaque page rend <AgentChatPage agentConfig={...} />

<AgentChatPage>  (~ 1 fichier ~600 lignes, partagé par les 4 agents)
│
├─ Colonne gauche : Sidebar conversations (260 px, repliable)
│   ├─ Bouton "+ Nouvelle conversation"
│   └─ Liste groupée par date (Aujourd'hui / Hier / Cette semaine / Plus ancien)
│
└─ Colonne droite : Chat principal
    ├─ Header (avatar agent + nom + statut + actions toggle voix/clear)
    ├─ Message list (virtualisée, streaming SSE)
    ├─ Action confirmation cards (overlay) pour actions destructives
    ├─ Suggested prompts (au démarrage d'une nouvelle conversation)
    ├─ Cross-agent referral buttons dans messages ("→ Envoyer à Léa")
    └─ Input multimodal (texte + voix Web Speech + upload fichier si Alfredo)
```

### 3.2. Composant central `<AgentChatPage>`

**Fichier :** `components/syndic-dashboard/agents-ia/AgentChatPage.tsx`

**Type `AgentConfig` :**

```ts
export type AgentId = 'fixy' | 'max' | 'lea' | 'alfredo'

export type AgentConfig = {
  id: AgentId
  displayName: { fr: string; pt: string }
  tagline: { fr: string; pt: string }
  avatar: ReactNode
  accentColor: string                    // ex: 'amber-500' (Fixy), 'indigo-500' (Max)
  endpoint: string                       // POST endpoint chat
  streaming: boolean                     // SSE supporté
  voice: boolean                         // Web Speech API
  fileUpload?: { accept: string; maxSizeMB: number }  // Alfredo: emails, images
  suggestedPrompts: { fr: string[]; pt: string[] }
  contextLoader?: (user: User) => Promise<Record<string, unknown>>
  toolDescriptors: ToolDescriptor[]      // pour rendre les action cards
  allowedRoles: SyndicRole[]             // RBAC UI (defense in depth, le serveur revérifie)
  crossAgentReferrals?: AgentId[]        // boutons "→ Envoyer à X"
}
```

**Hooks internes :**

- `useConversations(agentId)` — fetch + create + delete + rename, depuis Supabase via SWR
- `useAgentStream(agentConfig, conversationId)` — gère SSE, fallback non-stream
- `useVoiceInput(enabled)` — wraps Web Speech API + fallback gracieux
- `useActionConfirmation()` — orchestration des cartes de confirmation

**Responsabilités du composant :**
- Persistance de la conversation active (Supabase + cache local SWR)
- Streaming des réponses agent (SSE) avec annulation
- Rendu des action cards avec confirm/cancel
- Gestion voix (toggle, transcription, auto-send sur silence)
- Auto-génération du titre de conversation (1er message utilisateur → Groq prompt court pour titre)
- Suppression / archivage / renommage de conversation
- i18n FR/PT via `useLocale()` existant

### 3.3. Configuration par agent

Fichier `components/syndic-dashboard/agents-ia/configs.ts` exporte `AGENT_CONFIGS: Record<AgentId, AgentConfig>`.

**Fixy** :
- `endpoint: '/api/syndic/fixy-syndic'`
- `streaming: false` (l'existant ne stream pas, à upgrader phase 2)
- `voice: true`
- `toolDescriptors: ['create_mission', 'assign_mission', 'update_mission', 'navigate', 'create_alert', 'send_message', 'create_document', 'search_dossier'*, 'classer_document'*, 'find_email_thread'*]`  (* = nouveaux)
- `crossAgentReferrals: ['max', 'lea', 'alfredo']`

**Max** :
- `endpoint: '/api/syndic/max-ai'`
- `streaming: true`
- `voice: true` (ajouté, n'existait pas avant)
- `toolDescriptors: ['generate_pdf_doc']` (extraction [DOC_PDF] existante)
- `crossAgentReferrals: ['fixy', 'lea']`

**Léa** :
- `endpoint: '/api/syndic/lea-comptable'`
- `streaming: true` (à ajouter, n'existe pas)
- `voice: true`
- `toolDescriptors: ['generate_accounting_doc']` (modèles d'appels, budgets, AG annexes)
- `crossAgentReferrals: ['fixy', 'max']`

**Alfredo** :
- `endpoint: '/api/syndic/alfredo-chat'` (nouveau)
- `streaming: true`
- `voice: true`
- `fileUpload: { accept: '.eml,.pdf,image/*', maxSizeMB: 10 }` (drag-drop un email à analyser)
- `toolDescriptors: ['scan_inbox', 'classify_email', 'load_client_context', 'draft_reply', 'send_response', 'archive', 'flag_priority', 'create_mission_from_email']`
- `crossAgentReferrals: ['fixy', 'max', 'lea']`

### 3.4. Modèle de données (nouvelles tables Supabase)

```sql
-- Migration : 20260511_agents_ia_conversations.sql

CREATE TABLE syndic_ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syndic_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id text NOT NULL CHECK (agent_id IN ('fixy','max','lea','alfredo')),
  locale text NOT NULL CHECK (locale IN ('fr','pt')),  -- immuable, défini à la création (§3.10)
  title text NOT NULL DEFAULT 'Nouvelle conversation',
  immeuble_id uuid REFERENCES immeubles(id) ON DELETE SET NULL,  -- contexte optionnel
  message_count int NOT NULL DEFAULT 0,
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX idx_syndic_ai_conv_user_agent ON syndic_ai_conversations(syndic_id, agent_id, updated_at DESC)
  WHERE archived_at IS NULL;

CREATE TABLE syndic_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES syndic_ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content text NOT NULL,
  tool_calls jsonb,
  metadata jsonb,                       -- { model, tokens_in, tokens_out, latency_ms, langfuse_trace_id }
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_syndic_ai_msg_conv ON syndic_ai_messages(conversation_id, created_at);

CREATE TABLE syndic_ai_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syndic_id uuid NOT NULL,
  agent_id text NOT NULL,
  conversation_id uuid REFERENCES syndic_ai_conversations(id) ON DELETE SET NULL,
  action text NOT NULL,                 -- ex: 'tool_call:create_mission'
  status text NOT NULL,                 -- 'success' | 'denied_rbac' | 'cancelled' | 'error'
  tool_payload jsonb,
  error_message text,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_syndic_ai_audit_user ON syndic_ai_audit(syndic_id, created_at DESC);

-- Table dédiée à l'apprentissage Alfredo (cf. §3.6 learn_from_correction)
CREATE TABLE syndic_alfredo_learning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syndic_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_id uuid REFERENCES syndic_emails_analysed(id) ON DELETE SET NULL,
  draft_proposed text NOT NULL,
  user_final_version text NOT NULL,
  diff_score float,                     -- 0.0 (identique) → 1.0 (totalement réécrit)
  metadata jsonb,                       -- tone, length, structural changes
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alfredo_learning_user ON syndic_alfredo_learning(syndic_id, created_at DESC);

-- RLS
ALTER TABLE syndic_ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndic_ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndic_ai_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY syndic_own_conversations ON syndic_ai_conversations
  FOR ALL USING (syndic_id = auth.uid());
CREATE POLICY syndic_own_messages ON syndic_ai_messages
  FOR ALL USING (conversation_id IN (SELECT id FROM syndic_ai_conversations WHERE syndic_id = auth.uid()));
CREATE POLICY syndic_own_audit ON syndic_ai_audit
  FOR SELECT USING (syndic_id = auth.uid());

ALTER TABLE syndic_alfredo_learning ENABLE ROW LEVEL SECURITY;
CREATE POLICY syndic_own_alfredo_learning ON syndic_alfredo_learning
  FOR ALL USING (syndic_id = auth.uid());
```

### 3.5. RBAC

**Niveau UI** : `AGENT_CONFIGS[id].allowedRoles` filtre l'affichage dans la sidebar (defense layer 1).

**Niveau API** : chaque endpoint et chaque tool fait un check de rôle côté serveur (defense layer 2).

| Rôle | Fixy | Max | Léa | Alfredo |
|---|---|---|---|---|
| `syndic` / `syndic_admin` | ✅ tout | ✅ tout | ✅ tout | ✅ tout |
| `syndic_gestionnaire` | ✅ tout | ✅ conseil | ✅ conseil | ✅ son scope |
| `syndic_tech` | ✅ missions/artisans | ❌ caché | ❌ caché | ✅ techniques uniquement |
| `syndic_juriste` | ✅ docs/conformité | ✅ tout | ❌ caché | ✅ contentieux uniquement |
| `syndic_comptable` | ✅ facturation/relances | ❌ caché | ✅ tout | ✅ factures/relances |
| `syndic_secretaire` | ✅ tout sauf comptable | ✅ conseil | ❌ caché | ✅ tri général |

**Tools sensibles** (ex: `send_response`, `create_mission`, `update_mission`) ont un check explicite `if (!ALLOWED_TOOLS_BY_ROLE[role].includes(toolName)) return 403`.

### 3.6. Alfredo — Mode proactif : auto-draft à l'arrivée du mail

**Comportement attendu (demande utilisateur explicite) :**

```
                ┌──────────────────────────────────────────────────────────┐
                │  Email arrive sur la boîte connectée                     │
                └────────────────────────┬─────────────────────────────────┘
                                         │ Gmail Push (Pub/Sub) → webhook
                                         ▼
                ┌──────────────────────────────────────────────────────────┐
                │  /api/email-agent/webhook                                │
                │  → poll ciblé sur le syndic concerné                     │
                │  → pour chaque nouvel email :                            │
                │     1. classify_email (urgence, type, immeuble, copro)   │
                │     2. load_client_context (toutes les données métier)   │
                │     3. draft_reply (brouillon adapté, tone auto)         │
                │     4. INSERT syndic_emails_analysed avec :              │
                │          draft_status = 'pending_review'                 │
                │          draft_body_html, draft_body_text, draft_subject │
                │          draft_meta { confidence, tone, missing_info }   │
                └────────────────────────┬─────────────────────────────────┘
                                         │ Supabase Realtime broadcast
                                         ▼
                ┌──────────────────────────────────────────────────────────┐
                │  UI utilisateur (n'importe quelle page du dashboard)     │
                │  → Toast notification : "📧 Nouvel email — brouillon prêt"│
                │  → Badge incrémenté sur l'item Alfredo dans la sidebar   │
                │  → Click sur la notif OU sur l'item Alfredo              │
                └────────────────────────┬─────────────────────────────────┘
                                         ▼
                ┌──────────────────────────────────────────────────────────┐
                │  Page Alfredo (AgentChatPage en mode "Inbox proactif")   │
                │                                                          │
                │  ┌─ Sidebar gauche ─┐  ┌─ Vue centrale ──────────────┐  │
                │  │ 📬 Inbox (3)     │  │ De : marie.dupont@…         │  │
                │  │  • Mme Dupont 🟠 │  │ Objet : Fuite salle de bain │  │
                │  │  • M. Costa  🟢 │  │                              │  │
                │  │  • Notaire   🔴 │  │ ─── Email reçu ───           │  │
                │  │                  │  │ Bonjour, …                  │  │
                │  │ 💬 Conversations │  │                              │  │
                │  │  • Discussion 1  │  │ ─── 📝 Brouillon Alfredo ───│  │
                │  │  • Discussion 2  │  │ [éditable inline]            │  │
                │  └──────────────────┘  │                              │  │
                │                        │ [Envoyer] [Modifier] [Skip] │  │
                │                        │                              │  │
                │                        │ Contexte utilisé (collapse):│  │
                │                        │ • Lot B12 — 250/10000èmes   │  │
                │                        │ • 2 missions ouvertes        │  │
                │                        │ • À jour des charges         │  │
                │                        └──────────────────────────────┘  │
                └──────────────────────────────────────────────────────────┘
```

**Deux modes d'utilisation d'Alfredo dans la même page :**

1. **Mode Inbox proactif** (par défaut à l'ouverture) — liste des emails en attente de review avec leur brouillon prêt. Vue dominante au quotidien.
2. **Mode chat conversationnel** — accessible via onglet « Discussions », pour les questions ad hoc à Alfredo (« montre-moi tous les mails de Mme Dupont des 3 derniers mois », « rédige une relance amiable pour tous les impayés > 3 mois »).

**Notification cross-pages** : un hook `useAlfredoNotifications()` souscrit en Supabase Realtime à `syndic_emails_analysed` filtré par `syndic_id = auth.uid() AND draft_status = 'pending_review' AND inserted_after = session_start`. Toast Sonner + mise à jour du badge sidebar en temps réel. Cliquable → `navigateTo('alfredo_agent')`.

**Migration du schéma `syndic_emails_analysed`** (existant, ajout de colonnes) :
```sql
ALTER TABLE syndic_emails_analysed
  ADD COLUMN draft_subject text,
  ADD COLUMN draft_body_html text,
  ADD COLUMN draft_body_text text,
  ADD COLUMN draft_status text DEFAULT 'pending_review'
    CHECK (draft_status IN ('pending_review','approved','sent','edited_sent','skipped','expired')),
  ADD COLUMN draft_meta jsonb,
  ADD COLUMN draft_generated_at timestamptz,
  ADD COLUMN draft_reviewed_at timestamptz,
  ADD COLUMN draft_reviewed_by uuid REFERENCES auth.users(id);

CREATE INDEX idx_emails_pending_alfredo
  ON syndic_emails_analysed(syndic_id, draft_generated_at DESC)
  WHERE draft_status = 'pending_review';
```

**Workflow de validation utilisateur :**
- **Envoyer** → `/api/email-agent/send-response` (existant) + `draft_status = 'sent'`
- **Modifier puis envoyer** → tracking de la diff dans `syndic_alfredo_learning` + `draft_status = 'edited_sent'`
- **Skip** (ignorer, garder le mail non répondu en inbox classique) → `draft_status = 'skipped'`
- Au-delà de 30 jours sans review → `draft_status = 'expired'` (cron quotidien)

### 3.6.bis. Tools Alfredo (accès données métier étendu)

Tous les tools listés ci-dessous sont disponibles côté `/api/syndic/alfredo-chat` (mode conversationnel) **et** invoqués automatiquement par la pipeline webhook (mode proactif).

#### `load_client_context(email_address: string)`
Charge en parallèle (Promise.all, requêtes scopées RLS `syndic_id = auth.uid()`) **toutes les données métier nécessaires** à une réponse contextualisée :

**Identification**
- `coproprios` : email → lot, immeuble, tantièmes, statut bailleur/occupant, date d'achat, IBAN (token only)
- `syndic_artisans` : si l'expéditeur est un artisan, ses missions passées
- `syndic_locataires` : si locataire, le bailleur associé

**Historique conversationnel**
- `syndic_emails_analysed` : 20 derniers mails du même expéditeur, antéchronologique
- `syndic_messages` : échanges sur le canal interne (chat copro)
- `syndic_documents` : documents envoyés/reçus de ce contact

**État du dossier copro**
- `syndic_missions` : missions ouvertes/closes filtrées par coproprio_id ou immeuble_id mentionné
- `syndic_planning` : RDV passés et futurs (interventions artisan dans le lot)
- `syndic_devis` : devis en cours pour le copro
- `syndic_factures` : factures émises au coproprio (12 derniers mois)

**Financier**
- `syndic_appels_charges` : appels du copro (3 derniers exercices)
- `syndic_impayes` : impayés actifs + ancienneté
- `syndic_recouvrement` : procédures de recouvrement en cours

**Sinistres / signalements**
- `syndic_sinistres` : sinistres ouverts ou clos < 6 mois
- `syndic_ocorrencias` : signalements (PT) — actifs ou récents
- `syndic_alertes` : alertes en cours sur l'immeuble

**Contexte immeuble**
- `syndic_immeubles` : nom, adresse, nb lots, syndic principal/secondaire
- `syndic_carnet_entretien` : interventions récentes parties communes
- `syndic_pppt` : plan pluriannuel travaux en cours
- `syndic_ag` : AG passées (max 2 dernières) + votes pertinents

**Filtrage RBAC** : selon le rôle du syndic appelant, certaines sources sont omises (un `syndic_juriste` n'aura pas `syndic_appels_charges` détaillés, un `syndic_tech` n'aura pas `syndic_impayes`). Matrice définie dans `lib/syndic/alfredo-data-access-policy.ts`.

Retour structuré, sanitizé (sans PII brute envoyée au LLM — voir §3.7) :
```ts
type ClientContext = {
  client_token: string                          // mapping interne pour rappel ultérieur
  copro_status: 'identified' | 'unknown' | 'artisan' | 'locataire'

  // Identification
  identity?: {
    role: 'coproprietaire' | 'locataire' | 'artisan' | 'tiers'
    lot_ref_anonymized?: string
    tantiemes?: number
    statut?: 'occupant' | 'bailleur'
    anciennete_mois?: number
  }
  immeuble?: { ref_anonymized: string; ville: string; nb_lots: number }

  // Historique conversationnel
  history_summary: {
    total_emails: number
    last_topics: string[]                       // résumé Groq des sujets
    sentiment_drift: 'positif' | 'neutre' | 'tendu'
    last_resolved_topics: string[]
  }
  recent_interactions: { date: string; subject: string; channel: string; resolution: string }[]

  // État dossier
  open_items: {
    missions: { id: string; titre: string; statut: string; artisan_token?: string }[]
    devis_en_cours: { ref_anonymized: string; montant: number; statut: string }[]
    sinistres: { id: string; titre: string; statut: string; depuis: string }[]
    signalements: { id: string; titre: string; priorite: string }[]
  }

  // Financier (omis selon RBAC)
  financial?: {
    statut_paiement: 'a_jour' | 'en_retard' | 'en_recouvrement'
    impayes: { montant: number; depuis: string; nature: string }[]
    derniers_appels: { exercice: string; montant: number; paye: boolean }[]
  }

  // Contexte immeuble
  immeuble_context?: {
    travaux_en_cours: { ref_anonymized: string; titre: string; statut: string }[]
    derniere_ag?: { date: string; resolutions_concernant: string[] }
    alertes_actives: { titre: string; severite: string }[]
  }

  // Méta
  missing_info_hints: string[]                  // ex: "Aucune correspondance copro pour cet email"
  rbac_omitted_fields: string[]                 // transparence pour debug
}
```

#### `draft_reply(email_id, context: ClientContext, tone?: 'formel'|'cordial'|'ferme')`
Construit un prompt enrichi :
- Système : « Tu es Alfredo, gestionnaire emails du syndic. Réponds au mail de manière personnalisée en t'appuyant sur le contexte client fourni. Ton FR/PT formel par défaut. Pas d'invention de fait. Si info manquante, demande, ne devine pas. »
- Contexte : `ClientContext` sanitizé
- Email entrant (corps + sujet + thread précédent)
- Sortie attendue : `{ subject_suggested, body_html, body_text, missing_info?: string[], suggested_next_actions: ToolCall[] }`

Le brouillon est **toujours** présenté à l'utilisateur pour validation (jamais d'envoi automatique). L'utilisateur peut éditer puis envoyer via `send_response` (qui existe déjà côté `/api/email-agent/send-response`).

#### `learn_from_correction(draft_id, original_draft, user_final_version)`
Enregistre la différence entre brouillon proposé et version envoyée dans la table `syndic_alfredo_learning` (cf. §3.4) pour future fine-tuning ou few-shot adaptatif. Calcule un `diff_score` (Levenshtein normalisé), classifie le type de correction (`tone | factual | structural | minor_typo`).

#### `regenerate_draft(email_id, instructions?: string)`
Permet à l'utilisateur de demander un nouveau brouillon avec des consignes spécifiques (« plus ferme », « ajoute le rappel d'AG », « en portugais »). Réutilise le `ClientContext` cached (TTL 5 min).

#### Tools conversationnels (mode chat)
- `search_emails(query: string, filters?: { from?, since?, until?, has_attachment? })` — recherche fulltext dans les emails analysés
- `bulk_action(filter, action: 'draft_reply' | 'archive' | 'flag_priority')` — par exemple « rédige un brouillon de relance amiable pour tous les impayés > 3 mois »
- `summarize_inbox(period: 'today' | 'week' | 'month')` — résumé exécutif des emails reçus + actions prises

### 3.7. Sanitization PII

**Helper :** `lib/ai/sanitize-context.ts`

```ts
export function sanitizeContextForLLM<T extends Record<string, unknown>>(
  data: T,
  options?: { keepFirstName?: boolean }
): { sanitized: T; tokenMap: Map<string, string> }
```

Stratégie :
- Emails → `<email:token>` (token = hash court déterministe par session)
- Téléphones → `<phone:token>`
- IBAN → `<iban:token>`
- Adresses postales → `<address:token>`
- Le `tokenMap` est gardé côté serveur (pas envoyé à Groq) pour résoudre les tokens lors de l'exécution des actions

Tests obligatoires : couverture > 95% (TDD).

### 3.8. Sécurité tokens OAuth (encryption)

**Migration :** `20260511_encrypt_oauth_tokens.sql`

```sql
-- Activer pgcrypto (déjà actif probablement)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ajouter colonnes chiffrées
ALTER TABLE syndic_oauth_tokens
  ADD COLUMN access_token_enc bytea,
  ADD COLUMN refresh_token_enc bytea;

-- Backfill (script TS one-shot, lit clé depuis env, écrit chiffré)
-- (script de backfill supprimé le 2026-06-13 — audit P2 OAUT-3 ; flux actuel : lib/oauth/tokens.ts)

-- Une fois backfill validé : drop colonnes plain
ALTER TABLE syndic_oauth_tokens
  DROP COLUMN access_token,
  DROP COLUMN refresh_token;

-- Renommage final
ALTER TABLE syndic_oauth_tokens
  RENAME COLUMN access_token_enc TO access_token;
ALTER TABLE syndic_oauth_tokens
  RENAME COLUMN refresh_token_enc TO refresh_token;
```

**Côté code :** wrapper `lib/oauth/tokens.ts` avec `getDecryptedToken(syndic_id)` et `setEncryptedToken(syndic_id, ...)`. Clé via `wrangler secret put OAUTH_TOKENS_ENCRYPTION_KEY` (jamais en .env disque, cf. CLAUDE.md).

Tests obligatoires : round-trip encrypt → decrypt, rotation de clé, gestion d'erreur si clé absente.

### 3.9. Webhook Gmail Push (Alfredo réactif)

**Phase Alfredo (chunk 9)** :
- Activation Gmail Pub/Sub watch lors du `/connect` (renouvelle `watch_expiry` automatiquement)
- Endpoint `/api/email-agent/webhook` qui reçoit les push notifications (signature vérifiée via JWT Google)
- Sur push : déclenche `poll/route.ts` ciblé sur le syndic concerné (déduplication garantie par UNIQUE(syndic_id, gmail_message_id))
- Cron Cloudflare quotidien pour renouveler les watch < 24h d'expiration

### 3.10. Isolation locale stricte FR ≠ PT (règle transversale)

**Principe non négociable :** chaque agent répond exclusivement dans le cadre juridique/réglementaire/comptable du pays détecté pour la conversation. Jamais de mélange (ex: Max ne cite pas la loi ALUR à un syndic portugais, Léa ne mentionne pas la TVA portugaise à un syndic français).

**Détection du contexte locale (déterministe, dans l'ordre de priorité) :**
1. `user.profile.country` en base (`fr` ou `pt`) — source de vérité
2. Sinon, locale active du dashboard (`useLocale()`)
3. Sinon, fallback `fr`

Le `locale` est attaché à chaque conversation au moment de sa création (`syndic_ai_conversations.locale text NOT NULL CHECK (locale IN ('fr','pt'))`) et **immuable** ensuite. Toute nouvelle conversation hérite du contexte locale courant.

**Implications par agent :**

| Agent | Règle FR/PT |
|---|---|
| **Fixy** | Prompt FR ou PT, vocabulaire métier localisé (ex: « ordre de mission » FR vs « ordem de serviço » PT, jamais mélangés). Tools utilisent toujours les libellés du pays. Documents générés (convocation AG, mise en demeure) dans le bon cadre légal. |
| **Max** | **CRITIQUE** : corpus juridique strictement séparé. Système prompt FR cite uniquement ALUR (loi 65-557), ELAN, décret 67-223, art. 14-2, etc. Système prompt PT cite uniquement Lei 8/2022, DL 268/94, Lei 5/2021 (Condomínios). Une garde explicite en début de prompt : « Tu réponds dans le cadre juridique [FR/PT] uniquement. Si la question relève de l'autre juridiction, indique-le et refuse d'extrapoler. » |
| **Léa** | Plan comptable copro FR (NF S 31-100, arrêté du 14 mars 2005) vs plan PT (Decreto-Lei n.º 268/94, contas correntes). Calcul TVA selon pays (FR 20%, PT 23%). Formats IBAN, devises, exercices fiscaux. |
| **Alfredo** | Brouillons dans la langue du destinataire (détection automatique sur l'email entrant). Formules de politesse, signatures, mentions légales adaptées au cadre du syndic (FR ou PT). |

**Implémentation concrète :**
- `lib/syndic/agent-locale-resolver.ts` : helper `resolveAgentLocale(user, conversation?)` → `'fr' | 'pt'`
- Chaque route API (`fixy-syndic`, `max-ai`, `lea-comptable`, `alfredo-chat`) reçoit `locale` en paramètre, refuse de mélanger
- Les system prompts sont séparés en 2 fichiers par agent (`max-system-prompt-fr.ts`, `max-system-prompt-pt.ts`) — pas de switch ternaire à l'intérieur d'un seul prompt
- Tests E2E : envoyer une question PT à Max en contexte FR → réponse doit indiquer "Cette question relève du cadre PT, je réponds dans le cadre FR uniquement"

### 3.11. Corpus juridique Max (phase ultérieure — out of scope MVP)

**Vision (demande utilisateur, à implémenter après le MVP) :** alimenter Max avec les textes officiels copropriété FR et PT pour éliminer les hallucinations sur les références d'articles, dates de décrets, montants de plafonds, etc. Approche type « Claude Project » avec corpus indexé.

**Architecture cible (préparée mais non livrée dans ce spec) :**
- Tables `syndic_legal_corpus_fr` et `syndic_legal_corpus_pt` (segments de textes officiels avec métadonnées : source, article, date d'entrée en vigueur, date de mise à jour)
- Pipeline d'ingestion versionné depuis Légifrance (FR) et Diário da República (PT)
- Embeddings (pgvector) pour retrieval sémantique
- Tool `cite_legal_source(query)` côté Max qui retourne `{ article, texte_exact, source_url, date_maj }` — Max obligé de citer la source quand il s'appuie sur un texte
- Détection de drift : si Max produit une réponse non sourcée dans un cadre juridique, warning dans Langfuse

**Préparation MVP (ce qu'on fait dès maintenant pour faciliter la phase 2) :**
- La table `syndic_ai_messages.metadata` accepte déjà un champ `sources_cited: { type, ref, url }[]` — la structure est prête
- Les prompts Max sont structurés en deux fichiers (`-fr.ts`, `-pt.ts`) — facile d'injecter un bloc « Contexte juridique récupéré » avant l'historique
- Les system prompts incluent dès maintenant la directive « Si tu ne connais pas une référence précise, dis-le. Ne pas inventer d'article ni de date. »

**Hors scope strict du MVP** : l'ingestion du corpus, le pipeline embeddings, l'UI de gestion du corpus, le tool `cite_legal_source`. Issue GitHub à créer post-MVP pour tracker cette phase.

### 3.12. Observabilité (Langfuse + Sentry)

**Langfuse** (`lib/langfuse.ts` existant) :
- Chaque appel Groq encapsulé dans `traceAgent({ agent_id, conversation_id, user_id, prompt, response, tools_called })`
- Span séparé par tool call
- Métadonnées : tokens, latence, modèle, fallback utilisé

**Sentry** :
- Tag automatique `agent_type: <agent_id>` sur toutes les erreurs des routes `/api/syndic/{fixy,max,lea,alfredo}-*`
- Capture du tool name dans le contexte

## 4. Plan de rollout chunké

15 chunks, mergeables séparément. Chunks 6 et 7 (sécurité) peuvent partir avant si on les détecte critiques en pré-déploiement.

| # | Chunk | Description | Tests requis | Dépend de | Risque |
|---|---|---|---|---|---|
| 0 | DB migrations agents IA | `syndic_ai_conversations` (avec `locale`), `syndic_ai_messages`, `syndic_ai_audit`, `syndic_alfredo_learning` + RLS | Tests RLS (anon ne voit rien, user voit ses propres rows) | — | 🟢 |
| 1 | Composant `<AgentChatPage>` + hooks + `agent-locale-resolver` | UI partagée locale-aware, mock backend pour iso | Vitest unit + Playwright iso | 0 | 🟢 |
| 2 | Sidebar catégorie `agents_ia` | `SIDEBAR_CATEGORIES` + 4 navItems + types Page + RBAC | E2E Playwright (rôles différents voient bien les bons agents) | 1 | 🟢 |
| 3 | **Fixy** branché | Split prompts FR/PT, réutilise endpoint, ajoute `search_dossier`, `classer_document`, `find_email_thread` (TDD) | Tests tools + E2E parcours secrétaire FR et PT | 1, 2 | 🟡 |
| 4 | **Max** branché | Split prompts en `max-system-prompt-{fr,pt}.ts`, ajoute streaming + voix, garde explicite anti-mélange juridique | E2E parcours juridique + test cross-locale (question PT en contexte FR → refus) | 1, 2 | 🟡 |
| 5 | **Léa** branchée | Split prompts FR/PT (plans comptables séparés), streaming + voix, garde scope strict | E2E parcours comptable FR et PT | 1, 2 | 🟡 |
| 6 | **Sanitization PII** | `lib/ai/sanitize-context.ts` + intégration prompts Fixy/Max/Léa | TDD couverture > 95% | — | 🟡 sécu |
| 7 | **Encryption tokens OAuth** | Migration pgcrypto + Vault + wrapper `lib/oauth/tokens.ts` + script backfill | Tests round-trip, rotation | — | 🔴 sécu |
| 8 | **Migration `syndic_emails_analysed`** | Ajout colonnes `draft_*` + index `idx_emails_pending_alfredo` | Tests Supabase migration up/down | — | 🟢 |
| 9 | **`lib/syndic/alfredo-data-access-policy.ts`** | Matrice RBAC des sources de données + helper `loadClientContext()` (TDD) | Tests par rôle (filtrage attendu) | 6 | 🟡 |
| 10 | **Pipeline auto-draft** | `/api/email-agent/webhook` (Gmail Pub/Sub) → poll ciblé → classify + load_client_context + draft_reply → INSERT avec `draft_status=pending_review` | Tests signature webhook, déduplication, dry-run draft | 6, 7, 8, 9 | 🔴 |
| 11 | **UI Inbox proactif Alfredo** | Mode dual (Inbox + Chat) dans `<AgentChatPage>`, `useAlfredoNotifications()` (Supabase Realtime), toast + badge sidebar, vue review/edit/send | E2E parcours réception → notif → validation | 1, 2, 10 | 🟡 |
| 12 | **Alfredo chat conversationnel** | `/api/syndic/alfredo-chat` + tools `search_emails`, `bulk_action`, `summarize_inbox`, `regenerate_draft`, `learn_from_correction` | Tests tools | 9, 11 | 🟡 |
| 13 | **Langfuse instrumentation** | Wrap des 4 endpoints + pipeline webhook | Vérif manuelle traces Langfuse | 3, 4, 5, 10, 12 | 🟢 |
| 14 | **Suppression legacy + cleanup** | Bulle FixyPanel + AideSection + audit Copro-AI (suppression si orphelin confirmé) + rename Ocorrências IA | Vérif que rien ne casse | 3 | 🟢 |
| 15 | **Tests E2E parcours complets** | Un parcours Playwright par agent + parcours Alfredo bout-en-bout (mock email → drafted → reviewed → sent) | — | 3-12 | 🟢 |

**Estimation cumulée :** ~3 semaines temps-équipe, livrable PR par PR.

## 5. Décisions par défaut (révisables si feedback)

| Sujet | Décision |
|---|---|
| Persistance | Multi-conversations Supabase (ChatGPT-style) |
| Voix | Active sur les 4 agents |
| Streaming | SSE généralisé via `useAgentStream` |
| Cross-agent | Bouton « → Envoyer à X » dans messages, transfère contexte |
| Confirmations | Cartes action avant exécution (pattern Fixy existant) |
| Tokens OAuth | pgcrypto symétrique, clé via Wrangler secret |
| PII dans prompts | Sanitization systématique, tokenMap côté serveur |
| Ocorrências IA | Rename « Classificador » uniquement (hors scope) |
| Isolation locale | FR ≠ PT strict par conversation, immuable, prompts splittés en 2 fichiers par agent |
| Corpus juridique Max | Architecture préparée (champ `sources_cited` dans messages, prompts splittés), ingestion en phase 2 post-MVP |
| Copro-AI | Audit séparé chunk 11, suppression si orphelin |
| Mobile | Sidebar conversations repliable, chat plein écran |
| Workflow dev | brainstorming → writing-plans → executing-plans avec plan mode |
| TDD obligatoire | Sur sanitization PII, encryption tokens, tools Alfredo |
| Parallélisation | subagent-driven-development sur chunks indépendants |

## 6. Critères de succès

- Les 4 agents accessibles depuis la sidebar dans une catégorie dédiée
- Chaque agent a son propre fil de conversations persistant (utilisateur ferme et rouvre → retrouve son historique)
- Fixy peut « trouver le dossier de Madame X » en exécutant `search_dossier` puis `find_email_thread`
- Alfredo, sur réception d'un email, génère un brouillon qui cite explicitement l'historique client (« suite à votre signalement du 12 mars … ») et propose les bonnes actions suivantes
- RBAC respecté : un `syndic_juriste` ne voit pas Léa, un `syndic_comptable` ne voit pas Max
- Aucun token OAuth en clair dans Postgres
- Aucun email/téléphone PII envoyé en clair à Groq dans les prompts
- Tous les agents instrumentés Langfuse, erreurs taggées Sentry par agent
- **Isolation locale stricte : Max FR ne cite jamais une loi PT, Léa PT ne calcule jamais avec la TVA FR**, vérifié par tests E2E cross-locale
- Tests E2E verts pour chaque parcours agent

## 7. Hors scope explicite

- Refonte du classifieur Ocorrências (juste un rename)
- Support IMAP/Outlook (Gmail-only comme aujourd'hui)
- Fine-tuning de modèle (Alfredo apprend via few-shot dans le prompt, pas de fine-tune)
- Refonte d'`EmailsSection` (Alfredo cohabite avec, lien réciproque)
- Migration des agents Artisan ou BTP vers le même pattern (Syndic uniquement, par scope du `.claude/rules/artisan-vs-btp.md`)
- Dashboard analytics IA pour admin (peut venir en chunk 13+)
- **Corpus juridique RAG Max** (cf. §3.11) — l'ingestion des textes officiels FR/PT, le pipeline embeddings et le tool `cite_legal_source` arriveront en phase 2 post-MVP. L'architecture MVP est préparée pour les accueillir sans refactor.

## 8. Risques identifiés

| Risque | Mitigation |
|---|---|
| Refonte UI casse l'expérience actuelle Max | Tests E2E avant suppression de la version legacy (chunk 11) |
| Encryption migration → tokens illisibles si rollback | Période transition avec double-write, script de backfill testé en staging |
| Webhook Gmail Push : signature invalide en dev | Mode `polling-only` activable par feature flag pendant dev |
| Alfredo `draft_reply` hallucine sur contexte client absent | Contrat strict : si `copro_status === 'unknown'`, demande clarification au lieu d'inventer |
| Charge Groq accrue (4 agents × streaming × multi-conv) | Rate limiting renforcé par agent + cache des contextes (TTL 5 min) |
| Drift Max ↔ Léa persiste | Prompts révisés avec instruction explicite « redirige vers l'autre agent pour son scope » + bouton UI cross-agent |

## 9. Ordre d'exécution recommandé

1. **Chunks 0 → 2** (DB + UI partagée + sidebar) en série, en plan mode après writing-plans
2. **Chunks 3, 4, 5 en parallèle** (Fixy / Max / Léa indépendants une fois le composant prêt) via subagent-driven-development
3. **Chunks 6, 7, 8 en parallèle** (sanitization PII + encryption OAuth + migration colonnes drafts — tous indépendants)
4. **Chunk 9** (`alfredo-data-access-policy`) après 6
5. **Chunk 10** (pipeline auto-draft webhook) — chunk pivot, après 6, 7, 8, 9
6. **Chunk 11** (UI Inbox proactif) après 10
7. **Chunk 12** (chat conversationnel Alfredo) après 9 et 11
8. **Chunks 13, 14, 15 en parallèle** (observabilité, cleanup, E2E)

## 10. Prochaine étape

Invoquer le skill `superpowers:writing-plans` pour transformer ce design en plan d'implémentation détaillé phase par phase, prêt à être exécuté en plan mode via `superpowers:executing-plans`.
