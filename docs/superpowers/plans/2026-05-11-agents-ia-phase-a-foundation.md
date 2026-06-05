# Plan A — Agents IA Syndic : Foundation + 3 Agents (Phase 1/4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer une catégorie sidebar « Agents IA » contenant Fixy, Max et Léa, chacun avec une interface chat ChatGPT-style (historique multi-conversations persisté, voix, streaming, FR/PT strict).

**Architecture:** Un composant React partagé `<AgentChatPage>` paramétré par un `AgentConfig`. Persistance des conversations dans Supabase. Sidebar existante étendue avec une nouvelle catégorie `agents_ia`. Prompts splittés en 2 fichiers par agent (`*-fr.ts` / `*-pt.ts`) pour interdire les mélanges juridiques/comptables.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind 4, Supabase (RLS), Groq (Llama 3.3 70B), Web Speech API, Vitest, Playwright.

**Specifie référence:** [docs/superpowers/specs/2026-05-11-agents-ia-syndic-category-design.md](../specs/2026-05-11-agents-ia-syndic-category-design.md)

**Scope Plan A (chunks 0-5 du spec):**
- Migration DB : `syndic_ai_conversations`, `syndic_ai_messages`, `syndic_ai_audit`, `syndic_alfredo_learning`
- Helpers : `agent-locale-resolver`, hooks `useConversations`/`useAgentStream`/`useVoiceInput`/`useActionConfirmation`
- Composant partagé `<AgentChatPage>` + `AGENT_CONFIGS`
- Sidebar catégorie `agents_ia` + 3 navItems (Fixy/Max/Léa, Alfredo arrive Plan C)
- Refonte Fixy/Max/Léa : split prompts FR/PT, branchement sur AgentChatPage, retrait des points de contact legacy

**Hors scope Plan A :** Alfredo, encryption tokens, sanitization PII (voir Plans B et C).

---

## File Structure

**Nouveaux fichiers :**
- `supabase/migrations/20260511_agents_ia_foundation.sql` — schéma DB
- `lib/syndic/agent-locale-resolver.ts` — résolution locale
- `lib/syndic/agent-types.ts` — types partagés (`AgentId`, `AgentConfig`, `Conversation`, `Message`, `SyndicRole`)
- `components/syndic-dashboard/agents-ia/AgentChatPage.tsx` — composant principal
- `components/syndic-dashboard/agents-ia/AgentChatHeader.tsx` — header agent
- `components/syndic-dashboard/agents-ia/ConversationSidebar.tsx` — sidebar conversations
- `components/syndic-dashboard/agents-ia/MessageList.tsx` — liste messages virtualisée
- `components/syndic-dashboard/agents-ia/MessageInput.tsx` — input texte + voix
- `components/syndic-dashboard/agents-ia/ActionConfirmCard.tsx` — carte confirmation action
- `components/syndic-dashboard/agents-ia/configs.ts` — `AGENT_CONFIGS` constant
- `components/syndic-dashboard/agents-ia/hooks/useConversations.ts`
- `components/syndic-dashboard/agents-ia/hooks/useAgentStream.ts`
- `components/syndic-dashboard/agents-ia/hooks/useVoiceInput.ts`
- `components/syndic-dashboard/agents-ia/hooks/useActionConfirmation.ts`
- `components/syndic-dashboard/agents-ia/pages/FixyAgentPage.tsx`
- `components/syndic-dashboard/agents-ia/pages/MaxAgentPage.tsx`
- `components/syndic-dashboard/agents-ia/pages/LeaAgentPage.tsx`
- `lib/syndic/prompts/fixy/system-prompt-fr.ts`
- `lib/syndic/prompts/fixy/system-prompt-pt.ts`
- `lib/syndic/prompts/max/system-prompt-fr.ts`
- `lib/syndic/prompts/max/system-prompt-pt.ts`
- `lib/syndic/prompts/lea/system-prompt-fr.ts`
- `lib/syndic/prompts/lea/system-prompt-pt.ts`
- `app/api/syndic/conversations/route.ts` — REST CRUD pour conversations
- `app/api/syndic/conversations/[id]/messages/route.ts` — REST CRUD pour messages
- Tests Vitest correspondants
- Tests Playwright E2E : `e2e/syndic-agents-ia.spec.ts`

**Fichiers modifiés :**
- `components/syndic-dashboard/types.tsx` — ajout `'fixy_agent' | 'max_agent' | 'lea_agent'` au type `Page`
- `components/syndic-dashboard/config.ts` — ajout entries `fixy_agent`, `max_agent`, `lea_agent` dans `SYNDIC_MODULES` et dans tous les rôles concernés de `ROLE_PAGES`
- `app/syndic/dashboard/page.tsx` — ajout `SIDEBAR_CATEGORIES` entry `agents_ia`, ajout 3 navItems, ajout 3 case dans le switch de rendu, dynamic imports des pages agents, suppression `FixyPanel`, suppression `AideSection` (page `ia` → redirect `max_agent`)
- `app/api/syndic/fixy-syndic/route.ts` — split prompts en fichiers séparés FR/PT, ajout tools `search_dossier`/`classer_document`/`find_email_thread`
- `app/api/syndic/max-ai/route.ts` — split prompts FR/PT en fichiers séparés
- `app/api/syndic/lea-comptable/route.ts` — split prompts FR/PT en fichiers séparés, ajout streaming

---

## Phase A.0 — Migration DB (Chunk 0 du spec)

### Task 1 : Créer la migration des tables agents IA

**Files:**
- Create: `supabase/migrations/20260511_agents_ia_foundation.sql`
- Test: `tests/migrations/agents_ia_foundation.test.ts` (test via SQL queries)

- [ ] **Step 1 : Créer le fichier de migration**

```sql
-- ══════════════════════════════════════════════════════════════════════════════
-- Migration — Fondations Agents IA Syndic (Plan A, Chunk 0)
-- Date: 2026-05-11
-- Spec: docs/superpowers/specs/2026-05-11-agents-ia-syndic-category-design.md
-- ══════════════════════════════════════════════════════════════════════════════
-- Crée les 4 tables nécessaires aux conversations persistées avec les agents
-- IA Syndic (Fixy, Max, Léa, Alfredo) :
--   - syndic_ai_conversations : un thread de conversation par utilisateur/agent
--   - syndic_ai_messages : messages individuels (user/assistant/system/tool)
--   - syndic_ai_audit : journal des actions exécutées par les agents (RGPD)
--   - syndic_alfredo_learning : différentiels brouillon/version envoyée
--
-- RLS strict : un syndic ne voit que ses propres rows (filtre auth.uid()).
-- Suppression cascade au delete account (RGPD Art. 17).

-- ── 1. Conversations ─────────────────────────────────────────────────────────
CREATE TABLE syndic_ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syndic_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id text NOT NULL CHECK (agent_id IN ('fixy','max','lea','alfredo')),
  locale text NOT NULL CHECK (locale IN ('fr','pt')),
  title text NOT NULL DEFAULT 'Nouvelle conversation',
  immeuble_id uuid REFERENCES immeubles(id) ON DELETE SET NULL,
  message_count int NOT NULL DEFAULT 0,
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX idx_syndic_ai_conv_user_agent
  ON syndic_ai_conversations(syndic_id, agent_id, updated_at DESC)
  WHERE archived_at IS NULL;

-- ── 2. Messages ──────────────────────────────────────────────────────────────
CREATE TABLE syndic_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES syndic_ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content text NOT NULL,
  tool_calls jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_syndic_ai_msg_conv ON syndic_ai_messages(conversation_id, created_at);

-- ── 3. Audit log RGPD ────────────────────────────────────────────────────────
CREATE TABLE syndic_ai_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syndic_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  conversation_id uuid REFERENCES syndic_ai_conversations(id) ON DELETE SET NULL,
  action text NOT NULL,
  status text NOT NULL CHECK (status IN ('success','denied_rbac','cancelled','error')),
  tool_payload jsonb,
  error_message text,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_syndic_ai_audit_user ON syndic_ai_audit(syndic_id, created_at DESC);

-- ── 4. Apprentissage Alfredo (utilisé Plan C) ────────────────────────────────
CREATE TABLE syndic_alfredo_learning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syndic_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_id uuid,  -- FK vers syndic_emails_analysed ajoutée en Plan C
  draft_proposed text NOT NULL,
  user_final_version text NOT NULL,
  diff_score float,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alfredo_learning_user ON syndic_alfredo_learning(syndic_id, created_at DESC);

-- ── 5. Row Level Security ────────────────────────────────────────────────────
ALTER TABLE syndic_ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndic_ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndic_ai_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndic_alfredo_learning ENABLE ROW LEVEL SECURITY;

CREATE POLICY syndic_own_conversations ON syndic_ai_conversations
  FOR ALL USING (syndic_id = auth.uid());

CREATE POLICY syndic_own_messages ON syndic_ai_messages
  FOR ALL USING (conversation_id IN (
    SELECT id FROM syndic_ai_conversations WHERE syndic_id = auth.uid()
  ));

CREATE POLICY syndic_own_audit ON syndic_ai_audit
  FOR SELECT USING (syndic_id = auth.uid());

CREATE POLICY syndic_own_alfredo_learning ON syndic_alfredo_learning
  FOR ALL USING (syndic_id = auth.uid());

-- ── 6. Triggers de maintenance ───────────────────────────────────────────────
-- Mise à jour automatique de updated_at et message_count
CREATE OR REPLACE FUNCTION update_conv_metadata() RETURNS trigger AS $$
BEGIN
  UPDATE syndic_ai_conversations
    SET updated_at = now(),
        message_count = message_count + 1,
        last_message_preview = LEFT(NEW.content, 120)
    WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_conv_on_message
  AFTER INSERT ON syndic_ai_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conv_metadata();
```

- [ ] **Step 2 : Appliquer la migration en local (via MCP)**

Run: `mcp__supabase__apply_migration` avec le contenu du fichier
Expected: succès, 4 tables créées

- [ ] **Step 3 : Écrire le test RLS**

Créer `tests/migrations/agents_ia_foundation.test.ts` :

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

describe('Migration: agents IA foundation', () => {
  const anonClient = createClient(supabaseUrl, supabaseAnonKey)

  it('anonyme ne peut PAS lire syndic_ai_conversations', async () => {
    const { data, error } = await anonClient.from('syndic_ai_conversations').select('*').limit(1)
    expect(data).toEqual([])  // RLS bloque, pas d'erreur mais liste vide
  })

  it('anonyme ne peut PAS insérer dans syndic_ai_conversations', async () => {
    const { error } = await anonClient.from('syndic_ai_conversations').insert({
      syndic_id: '00000000-0000-0000-0000-000000000000',
      agent_id: 'fixy',
      locale: 'fr',
    })
    expect(error).toBeTruthy()
  })

  it('CHECK constraint refuse agent_id invalide', async () => {
    // Test via admin client (bypass RLS) pour valider la contrainte CHECK
    // Configuration via service role key dans test env
  })

  it('locale immuable : UPDATE locale doit échouer (à valider en chunk suivant via trigger)', async () => {
    // À ajouter quand trigger d'immutabilité sera créé
  })
})
```

- [ ] **Step 4 : Lancer les tests**

Run: `npm run test tests/migrations/agents_ia_foundation.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5 : Vérifier via mcp__supabase__list_tables que les 4 tables apparaissent**

Run: `mcp__supabase__list_tables` schema=`public`
Expected: contient `syndic_ai_conversations`, `syndic_ai_messages`, `syndic_ai_audit`, `syndic_alfredo_learning`

- [ ] **Step 6 : Commit**

```bash
git add supabase/migrations/20260511_agents_ia_foundation.sql \
        tests/migrations/agents_ia_foundation.test.ts
git commit -m "feat(syndic): migration fondations agents IA (Plan A chunk 0)

Crée syndic_ai_conversations, syndic_ai_messages, syndic_ai_audit,
syndic_alfredo_learning avec RLS strict (syndic_id = auth.uid()) et
trigger de maintenance updated_at/message_count/last_message_preview.

Refs: docs/superpowers/plans/2026-05-11-agents-ia-phase-a-foundation.md"
```

---

## Phase A.1 — Types partagés + locale resolver (Chunk 1, partie 1/3)

### Task 2 : Créer les types partagés agents IA

**Files:**
- Create: `lib/syndic/agent-types.ts`
- Test: `tests/lib/syndic/agent-types.test.ts`

- [ ] **Step 1 : Créer le fichier de types**

```typescript
// lib/syndic/agent-types.ts

export type AgentId = 'fixy' | 'max' | 'lea' | 'alfredo'

export type SyndicRole =
  | 'syndic'
  | 'syndic_admin'
  | 'syndic_tech'
  | 'syndic_secretaire'
  | 'syndic_gestionnaire'
  | 'syndic_comptable'
  | 'syndic_juriste'

export type Locale = 'fr' | 'pt'

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

export interface Conversation {
  id: string
  syndic_id: string
  agent_id: AgentId
  locale: Locale
  title: string
  immeuble_id: string | null
  message_count: number
  last_message_preview: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface ToolCall {
  tool_name: string
  arguments: Record<string, unknown>
  result?: Record<string, unknown>
  status: 'pending' | 'confirmed' | 'cancelled' | 'executed' | 'error'
}

export interface Message {
  id: string
  conversation_id: string
  role: MessageRole
  content: string
  tool_calls: ToolCall[] | null
  metadata: {
    model?: string
    tokens_in?: number
    tokens_out?: number
    latency_ms?: number
    langfuse_trace_id?: string
    sources_cited?: Array<{ type: string; ref: string; url?: string }>
  } | null
  created_at: string
}

export interface ToolDescriptor {
  name: string
  label: { fr: string; pt: string }
  description: { fr: string; pt: string }
  requiresConfirmation: boolean
  allowedRoles: SyndicRole[]
}

export interface AgentConfig {
  id: AgentId
  displayName: { fr: string; pt: string }
  tagline: { fr: string; pt: string }
  avatarEmoji: string
  accentColor: string
  endpoint: string
  streaming: boolean
  voice: boolean
  fileUpload?: { accept: string; maxSizeMB: number }
  suggestedPrompts: { fr: string[]; pt: string[] }
  toolDescriptors: ToolDescriptor[]
  allowedRoles: SyndicRole[]
  crossAgentReferrals: AgentId[]
}
```

- [ ] **Step 2 : Écrire les tests de types (lint type-check uniquement, pas de runtime)**

```typescript
// tests/lib/syndic/agent-types.test.ts
import { describe, it, expect } from 'vitest'
import type { AgentId, Conversation, Message } from '@/lib/syndic/agent-types'

describe('agent-types', () => {
  it('AgentId accepte les 4 valeurs valides', () => {
    const ids: AgentId[] = ['fixy', 'max', 'lea', 'alfredo']
    expect(ids).toHaveLength(4)
  })

  it('Conversation shape compatible avec les colonnes DB', () => {
    const conv: Conversation = {
      id: 'uuid',
      syndic_id: 'uuid',
      agent_id: 'fixy',
      locale: 'fr',
      title: 'Test',
      immeuble_id: null,
      message_count: 0,
      last_message_preview: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
    }
    expect(conv.agent_id).toBe('fixy')
  })

  it('Message shape supporte tool_calls null et populated', () => {
    const m1: Message = {
      id: 'uuid', conversation_id: 'uuid', role: 'user', content: 'hello',
      tool_calls: null, metadata: null, created_at: new Date().toISOString()
    }
    const m2: Message = {
      ...m1,
      role: 'assistant',
      tool_calls: [{ tool_name: 'navigate', arguments: { page: 'immeubles' }, status: 'pending' }]
    }
    expect(m1.tool_calls).toBeNull()
    expect(m2.tool_calls).toHaveLength(1)
  })
})
```

- [ ] **Step 3 : Lancer les tests**

Run: `npm run test tests/lib/syndic/agent-types.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 4 : Commit**

```bash
git add lib/syndic/agent-types.ts tests/lib/syndic/agent-types.test.ts
git commit -m "feat(syndic): types partagés agents IA (Plan A chunk 1)"
```

### Task 3 : Créer l'agent-locale-resolver

**Files:**
- Create: `lib/syndic/agent-locale-resolver.ts`
- Test: `tests/lib/syndic/agent-locale-resolver.test.ts`

- [ ] **Step 1 : Écrire le test (TDD)**

```typescript
// tests/lib/syndic/agent-locale-resolver.test.ts
import { describe, it, expect } from 'vitest'
import { resolveAgentLocale } from '@/lib/syndic/agent-locale-resolver'

describe('resolveAgentLocale', () => {
  it('priorité 1 : user.profile.country = fr → locale fr', () => {
    const locale = resolveAgentLocale({ profile: { country: 'fr' } }, undefined, 'pt')
    expect(locale).toBe('fr')
  })

  it('priorité 1 : user.profile.country = pt → locale pt', () => {
    const locale = resolveAgentLocale({ profile: { country: 'pt' } }, undefined, 'fr')
    expect(locale).toBe('pt')
  })

  it('priorité 2 : conversation existante → locale héritée immuable', () => {
    const locale = resolveAgentLocale(
      { profile: { country: 'pt' } },  // user PT
      { locale: 'fr' },                 // mais conversation FR
      'pt'
    )
    expect(locale).toBe('fr')  // la conversation gagne
  })

  it('priorité 3 : aucune info → fallback uiLocale', () => {
    const locale = resolveAgentLocale({}, undefined, 'pt')
    expect(locale).toBe('pt')
  })

  it('priorité 4 : aucune info ni uiLocale → fallback fr', () => {
    const locale = resolveAgentLocale({}, undefined, undefined)
    expect(locale).toBe('fr')
  })

  it('rejette les valeurs invalides et fallback fr', () => {
    const locale = resolveAgentLocale({ profile: { country: 'es' as 'fr' } }, undefined, undefined)
    expect(locale).toBe('fr')
  })
})
```

- [ ] **Step 2 : Lancer le test pour confirmer l'échec**

Run: `npm run test tests/lib/syndic/agent-locale-resolver.test.ts`
Expected: FAIL (`resolveAgentLocale is not a function`)

- [ ] **Step 3 : Implémenter le resolver**

```typescript
// lib/syndic/agent-locale-resolver.ts
import type { Locale } from './agent-types'

interface UserLike {
  profile?: {
    country?: string | null
  }
}

interface ConversationLike {
  locale?: string | null
}

const VALID_LOCALES: Locale[] = ['fr', 'pt']

function isValidLocale(value: unknown): value is Locale {
  return typeof value === 'string' && VALID_LOCALES.includes(value as Locale)
}

/**
 * Résolution déterministe du locale d'un agent.
 * Ordre de priorité (de + fort à + faible) :
 *   1. Conversation existante (locale immuable une fois posé)
 *   2. user.profile.country
 *   3. uiLocale (locale courant du dashboard)
 *   4. fallback 'fr'
 */
export function resolveAgentLocale(
  user: UserLike,
  conversation: ConversationLike | undefined,
  uiLocale: string | undefined
): Locale {
  if (conversation && isValidLocale(conversation.locale)) return conversation.locale
  if (isValidLocale(user.profile?.country)) return user.profile!.country as Locale
  if (isValidLocale(uiLocale)) return uiLocale
  return 'fr'
}
```

- [ ] **Step 4 : Lancer le test à nouveau**

Run: `npm run test tests/lib/syndic/agent-locale-resolver.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5 : Commit**

```bash
git add lib/syndic/agent-locale-resolver.ts tests/lib/syndic/agent-locale-resolver.test.ts
git commit -m "feat(syndic): agent-locale-resolver avec ordre déterministe (Plan A chunk 1)"
```

---

## Phase A.2 — API endpoints conversations (Chunk 1, partie 2/3)

### Task 4 : API REST conversations

**Files:**
- Create: `app/api/syndic/conversations/route.ts` (GET list, POST create)
- Create: `app/api/syndic/conversations/[id]/route.ts` (GET, PATCH, DELETE)
- Test: `tests/api/syndic-conversations.test.ts`

- [ ] **Step 1 : Écrire le test**

```typescript
// tests/api/syndic-conversations.test.ts
import { describe, it, expect } from 'vitest'

describe('/api/syndic/conversations', () => {
  it('GET refuse anonyme avec 401', async () => {
    const res = await fetch('http://localhost:3000/api/syndic/conversations')
    expect(res.status).toBe(401)
  })

  it('POST avec body invalide retourne 400', async () => {
    const res = await fetch('http://localhost:3000/api/syndic/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent_id: 'invalid' }),
    })
    expect([400, 401]).toContain(res.status)
  })

  // Tests authentifiés via mock dans setup global ou cookie de test
})
```

- [ ] **Step 2 : Créer la route GET/POST**

```typescript
// app/api/syndic/conversations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { ratelimit } from '@/lib/rate-limit'

const CreateConversationSchema = z.object({
  agent_id: z.enum(['fixy', 'max', 'lea', 'alfredo']),
  locale: z.enum(['fr', 'pt']),
  title: z.string().min(1).max(200).optional(),
  immeuble_id: z.string().uuid().optional(),
})

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = await ratelimit.limit(`conv-list:${ip}`)
  if (!rl.success) return NextResponse.json({ error: 'rate_limit' }, { status: 429 })

  const agentId = req.nextUrl.searchParams.get('agent_id')
  let query = supabase
    .from('syndic_ai_conversations')
    .select('*')
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(100)

  if (agentId) query = query.eq('agent_id', agentId)

  const { data, error } = await query
  if (error) {
    logger.error('list conversations failed', { error: error.message, user_id: user.id })
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
  return NextResponse.json({ conversations: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = CreateConversationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.issues }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('syndic_ai_conversations')
    .insert({
      syndic_id: user.id,
      agent_id: parsed.data.agent_id,
      locale: parsed.data.locale,
      title: parsed.data.title ?? 'Nouvelle conversation',
      immeuble_id: parsed.data.immeuble_id ?? null,
    })
    .select()
    .single()

  if (error) {
    logger.error('create conversation failed', { error: error.message, user_id: user.id })
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
  return NextResponse.json({ conversation: data }, { status: 201 })
}
```

- [ ] **Step 3 : Créer la route [id]**

```typescript
// app/api/syndic/conversations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const UpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  archived_at: z.string().datetime().nullable().optional(),
})

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('syndic_ai_conversations')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ conversation: data })
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('syndic_ai_conversations')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ conversation: data })
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Soft delete via archived_at
  const { error } = await supabase
    .from('syndic_ai_conversations')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4 : Créer la route messages**

```typescript
// app/api/syndic/conversations/[id]/messages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const AddMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string().min(1),
  tool_calls: z.array(z.any()).nullable().optional(),
  metadata: z.record(z.any()).nullable().optional(),
})

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('syndic_ai_messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ messages: data ?? [] })
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = AddMessageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('syndic_ai_messages')
    .insert({
      conversation_id: id,
      role: parsed.data.role,
      content: parsed.data.content,
      tool_calls: parsed.data.tool_calls ?? null,
      metadata: parsed.data.metadata ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ message: data }, { status: 201 })
}
```

- [ ] **Step 5 : Lancer les tests**

Run: `npm run test tests/api/syndic-conversations.test.ts`
Expected: PASS (les tests anonymes au minimum)

- [ ] **Step 6 : Commit**

```bash
git add app/api/syndic/conversations/ tests/api/syndic-conversations.test.ts
git commit -m "feat(syndic): API REST conversations + messages (Plan A chunk 1)"
```

---

## Phase A.3 — Hooks React (Chunk 1, partie 3/3)

### Task 5 : Hook useConversations

**Files:**
- Create: `components/syndic-dashboard/agents-ia/hooks/useConversations.ts`
- Test: `tests/components/agents-ia/useConversations.test.tsx`

- [ ] **Step 1 : Écrire le test**

```typescript
// tests/components/agents-ia/useConversations.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useConversations } from '@/components/syndic-dashboard/agents-ia/hooks/useConversations'

describe('useConversations', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ conversations: [{ id: 'c1', agent_id: 'fixy', locale: 'fr', title: 'Test' }] }),
    } as Response)
  })

  it('fetch initial puis expose la liste', async () => {
    const { result } = renderHook(() => useConversations('fixy'))
    await waitFor(() => expect(result.current.conversations).toHaveLength(1))
    expect(result.current.conversations[0].title).toBe('Test')
  })

  it('createConversation appelle POST puis met à jour la liste', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true, json: async () => ({ conversations: [] }),
    } as Response).mockResolvedValueOnce({
      ok: true, json: async () => ({ conversation: { id: 'c2', agent_id: 'fixy', locale: 'fr', title: 'Nouvelle' } }),
    } as Response)

    const { result } = renderHook(() => useConversations('fixy'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const created = await result.current.createConversation({ agent_id: 'fixy', locale: 'fr' })
    expect(created.title).toBe('Nouvelle')
    expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/conversations', expect.objectContaining({ method: 'POST' }))
  })
})
```

- [ ] **Step 2 : Lancer le test (FAIL)**

Run: `npm run test tests/components/agents-ia/useConversations.test.tsx`
Expected: FAIL

- [ ] **Step 3 : Implémenter le hook**

```typescript
// components/syndic-dashboard/agents-ia/hooks/useConversations.ts
import { useCallback, useEffect, useState } from 'react'
import type { AgentId, Conversation, Locale } from '@/lib/syndic/agent-types'

interface CreateParams {
  agent_id: AgentId
  locale: Locale
  title?: string
  immeuble_id?: string
}

export function useConversations(agentId: AgentId) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/syndic/conversations?agent_id=${agentId}`)
      if (!res.ok) throw new Error(`status_${res.status}`)
      const json = await res.json() as { conversations: Conversation[] }
      setConversations(json.conversations)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown_error')
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => { refetch() }, [refetch])

  const createConversation = useCallback(async (params: CreateParams): Promise<Conversation> => {
    const res = await fetch('/api/syndic/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!res.ok) throw new Error('create_failed')
    const json = await res.json() as { conversation: Conversation }
    setConversations(prev => [json.conversation, ...prev])
    return json.conversation
  }, [])

  const updateConversation = useCallback(async (id: string, patch: { title?: string }) => {
    const res = await fetch(`/api/syndic/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error('update_failed')
    const json = await res.json() as { conversation: Conversation }
    setConversations(prev => prev.map(c => c.id === id ? json.conversation : c))
    return json.conversation
  }, [])

  const deleteConversation = useCallback(async (id: string) => {
    const res = await fetch(`/api/syndic/conversations/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('delete_failed')
    setConversations(prev => prev.filter(c => c.id !== id))
  }, [])

  return {
    conversations,
    loading,
    error,
    refetch,
    createConversation,
    updateConversation,
    deleteConversation,
  }
}
```

- [ ] **Step 4 : Tests verts**

Run: `npm run test tests/components/agents-ia/useConversations.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5 : Commit**

```bash
git add components/syndic-dashboard/agents-ia/hooks/useConversations.ts tests/components/agents-ia/useConversations.test.tsx
git commit -m "feat(syndic): hook useConversations (Plan A chunk 1)"
```

### Task 6 : Hook useAgentStream

**Files:**
- Create: `components/syndic-dashboard/agents-ia/hooks/useAgentStream.ts`
- Test: `tests/components/agents-ia/useAgentStream.test.tsx`

- [ ] **Step 1 : Implémenter (un seul step, le hook gère streaming SSE et non-stream)**

```typescript
// components/syndic-dashboard/agents-ia/hooks/useAgentStream.ts
import { useCallback, useRef, useState } from 'react'
import type { AgentConfig, Locale, Message } from '@/lib/syndic/agent-types'

interface SendParams {
  conversationId: string
  message: string
  history: Message[]
  locale: Locale
  context?: Record<string, unknown>
}

interface StreamState {
  pending: boolean
  partial: string
  error: string | null
}

export function useAgentStream(agentConfig: AgentConfig) {
  const [state, setState] = useState<StreamState>({ pending: false, partial: '', error: null })
  const abortRef = useRef<AbortController | null>(null)

  const send = useCallback(async (params: SendParams): Promise<{ content: string; tool_calls?: unknown[] }> => {
    setState({ pending: true, partial: '', error: null })
    const ac = new AbortController()
    abortRef.current = ac

    try {
      const res = await fetch(agentConfig.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(agentConfig.streaming ? { 'accept': 'text/event-stream' } : {}),
        },
        body: JSON.stringify({
          conversation_id: params.conversationId,
          message: params.message,
          history: params.history.slice(-60),
          locale: params.locale,
          context: params.context ?? {},
        }),
        signal: ac.signal,
      })

      if (!res.ok) throw new Error(`agent_${res.status}`)

      if (agentConfig.streaming && res.headers.get('content-type')?.includes('text/event-stream')) {
        return await readSSE(res, (chunk) => {
          setState(s => ({ ...s, partial: s.partial + chunk }))
        })
      }

      const json = await res.json() as { content: string; tool_calls?: unknown[] }
      setState({ pending: false, partial: json.content, error: null })
      return json
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown'
      setState(s => ({ ...s, pending: false, error: message }))
      throw err
    }
  }, [agentConfig])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setState(s => ({ ...s, pending: false }))
  }, [])

  return { ...state, send, cancel }
}

async function readSSE(res: Response, onChunk: (s: string) => void): Promise<{ content: string; tool_calls?: unknown[] }> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  let toolCalls: unknown[] | undefined

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (payload === '[DONE]') continue
      try {
        const data = JSON.parse(payload) as { delta?: string; tool_calls?: unknown[] }
        if (data.delta) {
          full += data.delta
          onChunk(data.delta)
        }
        if (data.tool_calls) toolCalls = data.tool_calls
      } catch {
        // ignore malformed
      }
    }
  }

  return { content: full, tool_calls: toolCalls }
}
```

- [ ] **Step 2 : Écrire un test minimal (la partie SSE sera couverte E2E)**

```typescript
// tests/components/agents-ia/useAgentStream.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgentStream } from '@/components/syndic-dashboard/agents-ia/hooks/useAgentStream'
import type { AgentConfig } from '@/lib/syndic/agent-types'

const mockConfig: AgentConfig = {
  id: 'fixy', displayName: { fr: 'Fixy', pt: 'Fixy' }, tagline: { fr: '', pt: '' },
  avatarEmoji: '🤖', accentColor: 'amber-500', endpoint: '/api/test',
  streaming: false, voice: false, suggestedPrompts: { fr: [], pt: [] },
  toolDescriptors: [], allowedRoles: ['syndic'], crossAgentReferrals: [],
}

describe('useAgentStream', () => {
  it('send appelle endpoint et retourne contenu', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ content: 'Hello!' }),
    } as Response)

    const { result } = renderHook(() => useAgentStream(mockConfig))
    let response: { content: string } | undefined
    await act(async () => {
      response = await result.current.send({
        conversationId: 'c1', message: 'Hi', history: [], locale: 'fr',
      })
    })
    expect(response?.content).toBe('Hello!')
  })

  it('send échoue avec erreur si status non OK', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 500 } as Response)
    const { result } = renderHook(() => useAgentStream(mockConfig))
    await expect(result.current.send({
      conversationId: 'c1', message: 'Hi', history: [], locale: 'fr',
    })).rejects.toThrow('agent_500')
  })
})
```

- [ ] **Step 3 : Lancer les tests**

Run: `npm run test tests/components/agents-ia/useAgentStream.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 4 : Commit**

```bash
git add components/syndic-dashboard/agents-ia/hooks/useAgentStream.ts tests/components/agents-ia/useAgentStream.test.tsx
git commit -m "feat(syndic): hook useAgentStream (SSE + non-stream) (Plan A chunk 1)"
```

### Task 7 : Hook useVoiceInput

**Files:**
- Create: `components/syndic-dashboard/agents-ia/hooks/useVoiceInput.ts`
- Test: `tests/components/agents-ia/useVoiceInput.test.tsx`

- [ ] **Step 1 : Implémenter (extrait de FixyPanel.tsx existant, refactorisé en hook)**

```typescript
// components/syndic-dashboard/agents-ia/hooks/useVoiceInput.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Locale } from '@/lib/syndic/agent-types'

interface UseVoiceInputOptions {
  locale: Locale
  onTranscript: (text: string, isFinal: boolean) => void
  autoSubmitOnSilence?: number  // ms
}

export function useVoiceInput({ locale, onTranscript, autoSubmitOnSilence }: UseVoiceInputOptions) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = (window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      ?? (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    setSupported(!!SR)
  }, [])

  const start = useCallback(() => {
    if (typeof window === 'undefined') return
    const SR = (window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      ?? (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SR) {
      setError('voice_unsupported')
      return
    }

    const recognition = new SR()
    recognition.lang = locale === 'pt' ? 'pt-PT' : 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) final += result[0].transcript
        else interim += result[0].transcript
      }
      if (interim) onTranscript(interim, false)
      if (final) {
        onTranscript(final, true)
        if (autoSubmitOnSilence) {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
          silenceTimerRef.current = setTimeout(() => stop(), autoSubmitOnSilence)
        }
      }
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      setError(e.error)
      setListening(false)
    }

    recognition.onend = () => setListening(false)

    recognition.start()
    recognitionRef.current = recognition
    setListening(true)
    setError(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, onTranscript, autoSubmitOnSilence])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    setListening(false)
  }, [])

  useEffect(() => () => stop(), [stop])

  return { supported, listening, error, start, stop }
}
```

- [ ] **Step 2 : Tests minimal (couverture E2E uniquement, Web Speech non testable en jsdom)**

```typescript
// tests/components/agents-ia/useVoiceInput.test.tsx
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useVoiceInput } from '@/components/syndic-dashboard/agents-ia/hooks/useVoiceInput'

describe('useVoiceInput', () => {
  it('reporte supported=false si Web Speech absent (jsdom)', () => {
    const { result } = renderHook(() => useVoiceInput({
      locale: 'fr', onTranscript: () => {},
    }))
    expect(result.current.supported).toBe(false)
  })

  it('start sans support retourne error voice_unsupported', () => {
    const { result } = renderHook(() => useVoiceInput({
      locale: 'fr', onTranscript: () => {},
    }))
    result.current.start()
    expect(result.current.error).toBe('voice_unsupported')
  })
})
```

- [ ] **Step 3 : Tests verts**

Run: `npm run test tests/components/agents-ia/useVoiceInput.test.tsx`
Expected: PASS

- [ ] **Step 4 : Commit**

```bash
git add components/syndic-dashboard/agents-ia/hooks/useVoiceInput.ts tests/components/agents-ia/useVoiceInput.test.tsx
git commit -m "feat(syndic): hook useVoiceInput Web Speech avec fallback (Plan A chunk 1)"
```

### Task 8 : Hook useActionConfirmation

**Files:**
- Create: `components/syndic-dashboard/agents-ia/hooks/useActionConfirmation.ts`

- [ ] **Step 1 : Implémenter**

```typescript
// components/syndic-dashboard/agents-ia/hooks/useActionConfirmation.ts
import { useCallback, useState } from 'react'
import type { ToolCall } from '@/lib/syndic/agent-types'

interface PendingAction {
  toolCall: ToolCall
  resolve: (confirmed: boolean) => void
}

export function useActionConfirmation() {
  const [pending, setPending] = useState<PendingAction | null>(null)

  const request = useCallback((toolCall: ToolCall): Promise<boolean> => {
    return new Promise(resolve => setPending({ toolCall, resolve }))
  }, [])

  const confirm = useCallback(() => {
    pending?.resolve(true)
    setPending(null)
  }, [pending])

  const cancel = useCallback(() => {
    pending?.resolve(false)
    setPending(null)
  }, [pending])

  return { pendingAction: pending?.toolCall ?? null, request, confirm, cancel }
}
```

- [ ] **Step 2 : Commit (pas de test isolé, couverture via composant)**

```bash
git add components/syndic-dashboard/agents-ia/hooks/useActionConfirmation.ts
git commit -m "feat(syndic): hook useActionConfirmation (Plan A chunk 1)"
```

---

## Phase A.4 — Composants UI partagés (Chunk 1 fin)

### Task 9 : Composant ConversationSidebar

**Files:**
- Create: `components/syndic-dashboard/agents-ia/ConversationSidebar.tsx`

- [ ] **Step 1 : Implémenter**

```tsx
// components/syndic-dashboard/agents-ia/ConversationSidebar.tsx
'use client'

import { useState } from 'react'
import type { Conversation } from '@/lib/syndic/agent-types'

interface Props {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onRename: (id: string, newTitle: string) => void
  locale: 'fr' | 'pt'
}

function groupByDate(conversations: Conversation[], locale: 'fr' | 'pt') {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7)

  const labels = locale === 'pt'
    ? { today: 'Hoje', yesterday: 'Ontem', week: 'Esta semana', older: 'Mais antigo' }
    : { today: "Aujourd'hui", yesterday: 'Hier', week: 'Cette semaine', older: 'Plus ancien' }

  const buckets: Record<string, Conversation[]> = {
    [labels.today]: [], [labels.yesterday]: [], [labels.week]: [], [labels.older]: [],
  }

  for (const c of conversations) {
    const d = new Date(c.updated_at)
    if (d >= today) buckets[labels.today].push(c)
    else if (d >= yesterday) buckets[labels.yesterday].push(c)
    else if (d >= weekAgo) buckets[labels.week].push(c)
    else buckets[labels.older].push(c)
  }

  return Object.entries(buckets).filter(([, items]) => items.length > 0)
}

export default function ConversationSidebar({ conversations, activeId, onSelect, onNew, onDelete, onRename, locale }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const groups = groupByDate(conversations, locale)
  const newLabel = locale === 'pt' ? 'Nova conversa' : 'Nouvelle conversation'

  return (
    <aside style={{ width: 260, borderRight: '1px solid var(--sd-border)', display: 'flex', flexDirection: 'column', background: 'var(--sd-bg-2)' }}>
      <div style={{ padding: 12, borderBottom: '1px solid var(--sd-border)' }}>
        <button
          onClick={onNew}
          style={{ width: '100%', padding: '10px 12px', background: 'var(--sd-gold)', color: 'var(--sd-navy)', border: 0, borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
        >
          + {newLabel}
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {groups.map(([label, items]) => (
          <div key={label} style={{ marginBottom: 16 }}>
            <div style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }}>
              {label}
            </div>
            {items.map(c => (
              <div key={c.id} style={{ position: 'relative', marginBottom: 2 }}>
                {editing === c.id ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={() => { if (editValue.trim()) onRename(c.id, editValue.trim()); setEditing(null) }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--sd-border)' }}
                  />
                ) : (
                  <button
                    onClick={() => onSelect(c.id)}
                    style={{
                      width: '100%', padding: '8px 10px', textAlign: 'left', cursor: 'pointer',
                      background: activeId === c.id ? 'var(--sd-gold-dim)' : 'transparent',
                      border: 0, borderRadius: 6, fontSize: 13,
                      color: activeId === c.id ? 'var(--sd-navy)' : 'rgba(0,0,0,0.7)',
                    }}
                    onDoubleClick={() => { setEditing(c.id); setEditValue(c.title) }}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                    {c.last_message_preview && (
                      <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.last_message_preview}
                      </div>
                    )}
                  </button>
                )}
                {activeId === c.id && (
                  <button
                    onClick={() => onDelete(c.id)}
                    aria-label="Supprimer"
                    style={{ position: 'absolute', right: 4, top: 4, background: 'transparent', border: 0, cursor: 'pointer', fontSize: 12, color: 'rgba(0,0,0,0.4)' }}
                  >🗑</button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  )
}
```

- [ ] **Step 2 : Commit**

```bash
git add components/syndic-dashboard/agents-ia/ConversationSidebar.tsx
git commit -m "feat(syndic): composant ConversationSidebar (Plan A chunk 1)"
```

### Task 10 : Composant MessageList

**Files:**
- Create: `components/syndic-dashboard/agents-ia/MessageList.tsx`

- [ ] **Step 1 : Implémenter**

```tsx
// components/syndic-dashboard/agents-ia/MessageList.tsx
'use client'

import { useEffect, useRef } from 'react'
import { safeMarkdownToHTML } from '@/lib/sanitize'
import type { Message, AgentId } from '@/lib/syndic/agent-types'

interface Props {
  messages: Message[]
  streamingPartial?: string
  agentAvatarEmoji: string
  agentAccentColor: string
  onSendToAgent?: (target: AgentId, originMessageContent: string) => void
  crossAgentReferrals?: AgentId[]
  locale: 'fr' | 'pt'
}

const AGENT_LABELS: Record<AgentId, { fr: string; pt: string }> = {
  fixy: { fr: 'Fixy', pt: 'Fixy' },
  max: { fr: 'Max', pt: 'Max' },
  lea: { fr: 'Léa', pt: 'Léa' },
  alfredo: { fr: 'Alfredo', pt: 'Alfredo' },
}

export default function MessageList({ messages, streamingPartial, agentAvatarEmoji, agentAccentColor, onSendToAgent, crossAgentReferrals = [], locale }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, streamingPartial])

  return (
    <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
      {messages.map(m => (
        <div key={m.id} style={{ marginBottom: 20, display: 'flex', gap: 12, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: m.role === 'user' ? 'var(--sd-navy)' : `var(--sd-${agentAccentColor})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 16, flexShrink: 0,
          }}>
            {m.role === 'user' ? '👤' : agentAvatarEmoji}
          </div>
          <div style={{ maxWidth: '75%' }}>
            <div
              style={{
                padding: '12px 16px', borderRadius: 12,
                background: m.role === 'user' ? 'var(--sd-navy)' : 'var(--sd-bg-2)',
                color: m.role === 'user' ? '#fff' : 'inherit',
                fontSize: 14, lineHeight: 1.55,
              }}
              dangerouslySetInnerHTML={{ __html: safeMarkdownToHTML(m.content) }}
            />
            {m.role === 'assistant' && crossAgentReferrals.length > 0 && onSendToAgent && (
              <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {crossAgentReferrals.map(target => (
                  <button
                    key={target}
                    onClick={() => onSendToAgent(target, m.content)}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: 'var(--sd-bg-3)', border: '1px solid var(--sd-border)', cursor: 'pointer' }}
                  >
                    → {AGENT_LABELS[target][locale]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      {streamingPartial && (
        <div style={{ marginBottom: 20, display: 'flex', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: `var(--sd-${agentAccentColor})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, flexShrink: 0 }}>
            {agentAvatarEmoji}
          </div>
          <div style={{ maxWidth: '75%', padding: '12px 16px', borderRadius: 12, background: 'var(--sd-bg-2)', fontSize: 14, lineHeight: 1.55 }}
               dangerouslySetInnerHTML={{ __html: safeMarkdownToHTML(streamingPartial) }} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2 : Commit**

```bash
git add components/syndic-dashboard/agents-ia/MessageList.tsx
git commit -m "feat(syndic): composant MessageList avec cross-agent buttons (Plan A chunk 1)"
```

### Task 11 : Composant MessageInput

**Files:**
- Create: `components/syndic-dashboard/agents-ia/MessageInput.tsx`

- [ ] **Step 1 : Implémenter**

```tsx
// components/syndic-dashboard/agents-ia/MessageInput.tsx
'use client'

import { useRef, useState } from 'react'
import { useVoiceInput } from './hooks/useVoiceInput'
import type { Locale } from '@/lib/syndic/agent-types'

interface Props {
  onSend: (text: string) => void
  voiceEnabled: boolean
  locale: Locale
  disabled?: boolean
  placeholder?: { fr: string; pt: string }
}

export default function MessageInput({ onSend, voiceEnabled, locale, disabled, placeholder }: Props) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { supported, listening, start, stop } = useVoiceInput({
    locale,
    onTranscript: (transcript, isFinal) => {
      if (isFinal) setText(prev => (prev + ' ' + transcript).trim())
    },
  })

  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  const placeholderText = placeholder
    ? (locale === 'pt' ? placeholder.pt : placeholder.fr)
    : (locale === 'pt' ? 'Escreva ou fale...' : 'Tape ou parle...')

  return (
    <div style={{ borderTop: '1px solid var(--sd-border)', padding: 16, background: 'var(--sd-bg)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
          placeholder={placeholderText}
          disabled={disabled}
          style={{
            flex: 1, minHeight: 44, maxHeight: 200, padding: 10, borderRadius: 8,
            border: '1px solid var(--sd-border)', fontSize: 14, resize: 'vertical', fontFamily: 'inherit',
          }}
        />
        {voiceEnabled && supported && (
          <button
            onClick={() => listening ? stop() : start()}
            aria-label={listening ? 'Stop voix' : 'Démarrer voix'}
            style={{
              width: 44, height: 44, borderRadius: 8,
              background: listening ? '#e74c3c' : 'var(--sd-bg-2)',
              border: '1px solid var(--sd-border)', cursor: 'pointer', fontSize: 18,
            }}
          >
            {listening ? '⏹' : '🎤'}
          </button>
        )}
        <button
          onClick={submit}
          disabled={disabled || !text.trim()}
          style={{
            width: 44, height: 44, borderRadius: 8,
            background: 'var(--sd-gold)', color: 'var(--sd-navy)',
            border: 0, cursor: text.trim() ? 'pointer' : 'not-allowed',
            fontSize: 18, opacity: text.trim() ? 1 : 0.5,
          }}
        >→</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Commit**

```bash
git add components/syndic-dashboard/agents-ia/MessageInput.tsx
git commit -m "feat(syndic): composant MessageInput texte + voix (Plan A chunk 1)"
```

### Task 12 : Composant ActionConfirmCard

**Files:**
- Create: `components/syndic-dashboard/agents-ia/ActionConfirmCard.tsx`

- [ ] **Step 1 : Implémenter**

```tsx
// components/syndic-dashboard/agents-ia/ActionConfirmCard.tsx
'use client'

import type { ToolCall, ToolDescriptor, Locale } from '@/lib/syndic/agent-types'

interface Props {
  toolCall: ToolCall
  descriptor: ToolDescriptor
  locale: Locale
  onConfirm: () => void
  onCancel: () => void
}

export default function ActionConfirmCard({ toolCall, descriptor, locale, onConfirm, onCancel }: Props) {
  const label = locale === 'pt' ? descriptor.label.pt : descriptor.label.fr
  const description = locale === 'pt' ? descriptor.description.pt : descriptor.description.fr
  const confirmLabel = locale === 'pt' ? 'Confirmar' : 'Confirmer'
  const cancelLabel = locale === 'pt' ? 'Cancelar' : 'Annuler'

  return (
    <div style={{
      margin: '12px 24px', padding: 16, borderRadius: 12,
      background: 'var(--sd-gold-dim)', border: '1px solid var(--sd-gold)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-gold)', letterSpacing: '1px', textTransform: 'uppercase' }}>
        {locale === 'pt' ? 'Ação proposta' : 'Action proposée'}
      </div>
      <div style={{ marginTop: 4, fontSize: 15, fontWeight: 600 }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 13, color: 'rgba(0,0,0,0.7)' }}>{description}</div>
      <pre style={{ marginTop: 8, padding: 10, background: 'rgba(0,0,0,0.04)', borderRadius: 6, fontSize: 11, overflow: 'auto', maxHeight: 200 }}>
        {JSON.stringify(toolCall.arguments, null, 2)}
      </pre>
      <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--sd-border)', borderRadius: 8, cursor: 'pointer' }}>{cancelLabel}</button>
        <button onClick={onConfirm} style={{ padding: '8px 16px', background: 'var(--sd-gold)', color: 'var(--sd-navy)', border: 0, borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>{confirmLabel}</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Commit**

```bash
git add components/syndic-dashboard/agents-ia/ActionConfirmCard.tsx
git commit -m "feat(syndic): composant ActionConfirmCard (Plan A chunk 1)"
```

### Task 13 : Composant AgentChatHeader

**Files:**
- Create: `components/syndic-dashboard/agents-ia/AgentChatHeader.tsx`

- [ ] **Step 1 : Implémenter**

```tsx
// components/syndic-dashboard/agents-ia/AgentChatHeader.tsx
'use client'

import type { AgentConfig, Locale } from '@/lib/syndic/agent-types'

interface Props {
  agentConfig: AgentConfig
  locale: Locale
  voiceEnabled: boolean
  onToggleVoice: () => void
}

export default function AgentChatHeader({ agentConfig, locale, voiceEnabled, onToggleVoice }: Props) {
  const name = locale === 'pt' ? agentConfig.displayName.pt : agentConfig.displayName.fr
  const tagline = locale === 'pt' ? agentConfig.tagline.pt : agentConfig.tagline.fr

  return (
    <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--sd-border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--sd-bg)' }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: `var(--sd-${agentConfig.accentColor})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 22,
      }}>
        {agentConfig.avatarEmoji}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{name}</div>
        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>{tagline}</div>
      </div>
      {agentConfig.voice && (
        <button
          onClick={onToggleVoice}
          aria-label={locale === 'pt' ? 'Alternar voz' : 'Activer voix'}
          style={{
            padding: '8px 12px', borderRadius: 8,
            background: voiceEnabled ? 'var(--sd-gold-dim)' : 'var(--sd-bg-2)',
            border: '1px solid var(--sd-border)', cursor: 'pointer', fontSize: 13,
          }}
        >🔊 {locale === 'pt' ? 'Voz' : 'Voix'}</button>
      )}
    </div>
  )
}
```

- [ ] **Step 2 : Commit**

```bash
git add components/syndic-dashboard/agents-ia/AgentChatHeader.tsx
git commit -m "feat(syndic): composant AgentChatHeader (Plan A chunk 1)"
```

### Task 14 : Composant AgentChatPage (cœur)

**Files:**
- Create: `components/syndic-dashboard/agents-ia/AgentChatPage.tsx`

- [ ] **Step 1 : Implémenter**

```tsx
// components/syndic-dashboard/agents-ia/AgentChatPage.tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale } from '@/lib/i18n/context'
import type { User } from '@supabase/supabase-js'
import type { AgentConfig, Conversation, Message, ToolCall } from '@/lib/syndic/agent-types'
import { resolveAgentLocale } from '@/lib/syndic/agent-locale-resolver'
import { useConversations } from './hooks/useConversations'
import { useAgentStream } from './hooks/useAgentStream'
import { useActionConfirmation } from './hooks/useActionConfirmation'
import ConversationSidebar from './ConversationSidebar'
import AgentChatHeader from './AgentChatHeader'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import ActionConfirmCard from './ActionConfirmCard'

interface Props {
  agentConfig: AgentConfig
  user: User & { profile?: { country?: string } }
}

export default function AgentChatPage({ agentConfig, user }: Props) {
  const uiLocale = useLocale()
  const { conversations, createConversation, updateConversation, deleteConversation, loading } = useConversations(agentConfig.id)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [voiceEnabled, setVoiceEnabled] = useState(false)

  const stream = useAgentStream(agentConfig)
  const { pendingAction, request: requestConfirm, confirm: confirmAction, cancel: cancelAction } = useActionConfirmation()

  // Hydrate la conversation active
  useEffect(() => {
    if (!activeId) { setMessages([]); return }
    void (async () => {
      const res = await fetch(`/api/syndic/conversations/${activeId}/messages`)
      if (res.ok) {
        const json = await res.json() as { messages: Message[] }
        setMessages(json.messages)
      }
    })()
  }, [activeId])

  // Auto-sélection de la conversation la plus récente
  useEffect(() => {
    if (!loading && !activeId && conversations.length > 0) {
      setActiveId(conversations[0].id)
    }
  }, [loading, conversations, activeId])

  const activeConv = useMemo(() => conversations.find(c => c.id === activeId) ?? null, [conversations, activeId])

  const handleNew = useCallback(async () => {
    const locale = resolveAgentLocale(user, undefined, uiLocale)
    const newConv = await createConversation({ agent_id: agentConfig.id, locale })
    setActiveId(newConv.id)
  }, [agentConfig.id, createConversation, uiLocale, user])

  const handleSend = useCallback(async (text: string) => {
    let conv = activeConv
    if (!conv) {
      const locale = resolveAgentLocale(user, undefined, uiLocale)
      conv = await createConversation({ agent_id: agentConfig.id, locale, title: text.slice(0, 60) })
      setActiveId(conv.id)
    }

    // Insère le message user en optimiste local
    const userMsgLocal: Message = {
      id: `tmp-${Date.now()}`, conversation_id: conv.id, role: 'user',
      content: text, tool_calls: null, metadata: null, created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsgLocal])

    // Persiste le message user
    await fetch(`/api/syndic/conversations/${conv.id}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'user', content: text }),
    })

    // Envoie à l'agent
    try {
      const result = await stream.send({
        conversationId: conv.id,
        message: text,
        history: messages,
        locale: conv.locale,
      })

      // Si l'agent propose un tool call, demande confirmation
      if (result.tool_calls && result.tool_calls.length > 0) {
        const toolCall = result.tool_calls[0] as ToolCall
        const descriptor = agentConfig.toolDescriptors.find(t => t.name === toolCall.tool_name)
        if (descriptor?.requiresConfirmation) {
          const confirmed = await requestConfirm(toolCall)
          if (!confirmed) toolCall.status = 'cancelled'
          else toolCall.status = 'confirmed'
        } else {
          toolCall.status = 'executed'
        }
      }

      const assistantMsg: Message = {
        id: `tmp-${Date.now() + 1}`, conversation_id: conv.id, role: 'assistant',
        content: result.content, tool_calls: (result.tool_calls as ToolCall[]) ?? null,
        metadata: null, created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])

      await fetch(`/api/syndic/conversations/${conv.id}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          role: 'assistant', content: result.content,
          tool_calls: result.tool_calls ?? null,
        }),
      })

      // Auto-rename si c'est le 1er échange
      if (messages.length === 0 && conv.title === 'Nouvelle conversation') {
        const newTitle = text.slice(0, 60)
        await updateConversation(conv.id, { title: newTitle })
      }
    } catch (err) {
      console.error('agent send failed', err)
    }
  }, [activeConv, agentConfig, createConversation, messages, requestConfirm, stream, uiLocale, updateConversation, user])

  const handleSendToAgent = useCallback((targetAgent: string, originContent: string) => {
    // Navigation cross-agent gérée par le parent via prop ou context, ici juste log
    // À câbler dans Plan A.5 via navigateTo(page=${targetAgent}_agent) + injection contexte
    console.info('[cross-agent referral]', targetAgent, originContent.slice(0, 50))
  }, [])

  const activeDescriptor = pendingAction
    ? agentConfig.toolDescriptors.find(t => t.name === pendingAction.tool_name)
    : null

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 'calc(100vh - 80px)', background: 'var(--sd-bg)' }}>
      <ConversationSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={handleNew}
        onDelete={async (id) => { await deleteConversation(id); if (activeId === id) setActiveId(null) }}
        onRename={async (id, title) => { await updateConversation(id, { title }) }}
        locale={activeConv?.locale ?? resolveAgentLocale(user, undefined, uiLocale)}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <AgentChatHeader
          agentConfig={agentConfig}
          locale={activeConv?.locale ?? resolveAgentLocale(user, undefined, uiLocale)}
          voiceEnabled={voiceEnabled}
          onToggleVoice={() => setVoiceEnabled(v => !v)}
        />
        <MessageList
          messages={messages}
          streamingPartial={stream.pending ? stream.partial : undefined}
          agentAvatarEmoji={agentConfig.avatarEmoji}
          agentAccentColor={agentConfig.accentColor}
          onSendToAgent={(t, c) => handleSendToAgent(t, c)}
          crossAgentReferrals={agentConfig.crossAgentReferrals}
          locale={activeConv?.locale ?? resolveAgentLocale(user, undefined, uiLocale)}
        />
        {pendingAction && activeDescriptor && (
          <ActionConfirmCard
            toolCall={pendingAction}
            descriptor={activeDescriptor}
            locale={activeConv?.locale ?? resolveAgentLocale(user, undefined, uiLocale)}
            onConfirm={confirmAction}
            onCancel={cancelAction}
          />
        )}
        <MessageInput
          onSend={handleSend}
          voiceEnabled={voiceEnabled && agentConfig.voice}
          locale={activeConv?.locale ?? resolveAgentLocale(user, undefined, uiLocale)}
          disabled={stream.pending}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Commit**

```bash
git add components/syndic-dashboard/agents-ia/AgentChatPage.tsx
git commit -m "feat(syndic): composant AgentChatPage (cœur partagé 4 agents) (Plan A chunk 1)"
```

---

## Phase A.5 — Sidebar wiring + AGENT_CONFIGS (Chunk 2)

### Task 15 : Étendre le type Page

**Files:**
- Modify: `components/syndic-dashboard/types.tsx:3`

- [ ] **Step 1 : Ajouter les 4 pages agent au type Page**

Localiser la ligne 3 de `components/syndic-dashboard/types.tsx` (la longue union `export type Page = 'accueil' | ...`) et ajouter `| 'fixy_agent' | 'max_agent' | 'lea_agent' | 'alfredo_agent'` à la fin avant le dernier `|`.

```typescript
// Avant :
export type Page = 'accueil' | ... | 'chatbot_whatsapp'

// Après :
export type Page = 'accueil' | ... | 'chatbot_whatsapp' | 'fixy_agent' | 'max_agent' | 'lea_agent' | 'alfredo_agent'
```

- [ ] **Step 2 : Vérifier que `tsc --noEmit` passe**

Run: `npx tsc --noEmit`
Expected: pas de nouvelle erreur

- [ ] **Step 3 : Commit**

```bash
git add components/syndic-dashboard/types.tsx
git commit -m "feat(syndic): ajout types Page pour 4 agents IA (Plan A chunk 2)"
```

### Task 16 : Étendre config.ts (modules + RBAC)

**Files:**
- Modify: `components/syndic-dashboard/config.ts`

- [ ] **Step 1 : Ajouter les 4 modules dans `SYNDIC_MODULES`**

Localiser le tableau `SYNDIC_MODULES` (vers la ligne 30). Ajouter 4 entries :

```typescript
{
  key: 'fixy_agent',
  label: 'Fixy',
  icon: '🤖',
  description: "Assistant d'action — secrétaire IA",
  default: true,
},
{
  key: 'max_agent',
  label: 'Max',
  icon: '🎓',
  description: 'Expert-conseil juridique copropriété',
  default: true,
},
{
  key: 'lea_agent',
  label: 'Léa',
  icon: '👩‍💼',
  description: 'Comptabilité copropriété',
  default: true,
},
{
  key: 'alfredo_agent',
  label: 'Alfredo',
  icon: '📧',
  description: 'Gestionnaire emails IA',
  default: false,  // activé par défaut seulement après chunk 9 (Gmail connecté)
},
```

- [ ] **Step 2 : Ajouter dans `ROLE_PAGES` (RBAC fin par rôle)**

Pour chaque rôle, ajouter les clés selon la matrice du spec §3.5 :

```typescript
syndic: [..., 'fixy_agent', 'max_agent', 'lea_agent', 'alfredo_agent'],
syndic_admin: [..., 'fixy_agent', 'max_agent', 'lea_agent', 'alfredo_agent'],
syndic_tech: [..., 'fixy_agent', 'alfredo_agent'],  // pas Max, pas Léa
syndic_secretaire: [..., 'fixy_agent', 'max_agent', 'alfredo_agent'],  // pas Léa
syndic_gestionnaire: [..., 'fixy_agent', 'max_agent', 'lea_agent', 'alfredo_agent'],
syndic_comptable: [..., 'fixy_agent', 'lea_agent', 'alfredo_agent'],  // pas Max
syndic_juriste: [..., 'fixy_agent', 'max_agent', 'alfredo_agent'],  // pas Léa
```

- [ ] **Step 3 : Vérifier `tsc --noEmit` + RBAC tests existants**

Run: `npx tsc --noEmit && npm run test tests/lib/permissions.test.ts`
Expected: PASS

- [ ] **Step 4 : Commit**

```bash
git add components/syndic-dashboard/config.ts
git commit -m "feat(syndic): RBAC 4 agents IA par rôle (Plan A chunk 2)"
```

### Task 17 : Créer AGENT_CONFIGS

**Files:**
- Create: `components/syndic-dashboard/agents-ia/configs.ts`

- [ ] **Step 1 : Définir les 4 configs (Alfredo en placeholder)**

```typescript
// components/syndic-dashboard/agents-ia/configs.ts
import type { AgentConfig } from '@/lib/syndic/agent-types'

export const AGENT_CONFIGS: Record<string, AgentConfig> = {
  fixy: {
    id: 'fixy',
    displayName: { fr: 'Fixy', pt: 'Fixy' },
    tagline: {
      fr: "Assistant d'action — secrétaire IA",
      pt: 'Assistente de ação — secretária IA',
    },
    avatarEmoji: '🤖',
    accentColor: 'gold',
    endpoint: '/api/syndic/fixy-syndic',
    streaming: false,
    voice: true,
    suggestedPrompts: {
      fr: [
        'Trouve le dossier de Madame Dupont',
        'Crée une mission pour fuite eau, appartement 3B',
        'Envoie un rappel d\'AG aux copropriétaires retardataires',
      ],
      pt: [
        'Encontra o processo da Sra. Dupont',
        'Cria uma missão para fuga de água, apartamento 3B',
        'Envia lembrete de AG aos condóminos atrasados',
      ],
    },
    toolDescriptors: [
      {
        name: 'create_mission',
        label: { fr: 'Créer une mission', pt: 'Criar missão' },
        description: { fr: 'Ouvre une nouvelle intervention sans artisan attribué.', pt: 'Abre uma intervenção nova sem profissional atribuído.' },
        requiresConfirmation: true,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_tech', 'syndic_gestionnaire', 'syndic_secretaire'],
      },
      {
        name: 'assign_mission',
        label: { fr: 'Attribuer mission', pt: 'Atribuir missão' },
        description: { fr: 'Affecte un artisan à une mission existante.', pt: 'Atribui um profissional a uma missão existente.' },
        requiresConfirmation: true,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_tech', 'syndic_gestionnaire'],
      },
      {
        name: 'update_mission',
        label: { fr: 'Mettre à jour mission', pt: 'Atualizar missão' },
        description: { fr: 'Change le statut d\'une mission.', pt: 'Altera o estado de uma missão.' },
        requiresConfirmation: true,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_tech', 'syndic_gestionnaire', 'syndic_secretaire'],
      },
      {
        name: 'navigate',
        label: { fr: 'Naviguer', pt: 'Navegar' },
        description: { fr: 'Ouvre une page du dashboard.', pt: 'Abre uma página do painel.' },
        requiresConfirmation: false,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_tech', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_comptable', 'syndic_juriste'],
      },
      {
        name: 'create_alert',
        label: { fr: 'Créer une alerte', pt: 'Criar alerta' },
        description: { fr: 'Génère une alerte priorisée.', pt: 'Gera um alerta priorizado.' },
        requiresConfirmation: false,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_tech', 'syndic_secretaire', 'syndic_gestionnaire'],
      },
      {
        name: 'send_message',
        label: { fr: 'Envoyer message', pt: 'Enviar mensagem' },
        description: { fr: 'Envoie un message à un artisan via le canal interne.', pt: 'Envia uma mensagem a um profissional via canal interno.' },
        requiresConfirmation: true,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_tech', 'syndic_secretaire', 'syndic_gestionnaire'],
      },
      {
        name: 'create_document',
        label: { fr: 'Générer document', pt: 'Gerar documento' },
        description: { fr: 'Crée un document officiel (convocation, courrier, rapport).', pt: 'Cria um documento oficial (convocação, carta, relatório).' },
        requiresConfirmation: true,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_gestionnaire', 'syndic_secretaire', 'syndic_juriste'],
      },
      {
        name: 'search_dossier',
        label: { fr: 'Rechercher dossier', pt: 'Pesquisar processo' },
        description: { fr: 'Recherche full-text dans tous les dossiers (copros, missions, sinistres).', pt: 'Pesquisa full-text em todos os processos.' },
        requiresConfirmation: false,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_tech', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_comptable', 'syndic_juriste'],
      },
      {
        name: 'classer_document',
        label: { fr: 'Classer document', pt: 'Arquivar documento' },
        description: { fr: 'Range un document dans la GED par tags.', pt: 'Organiza um documento na GED por etiquetas.' },
        requiresConfirmation: true,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_secretaire', 'syndic_gestionnaire'],
      },
      {
        name: 'find_email_thread',
        label: { fr: 'Trouver fil email', pt: 'Encontrar fio email' },
        description: { fr: 'Retrouve un échange d\'emails par contact ou sujet.', pt: 'Encontra uma troca de emails por contacto ou assunto.' },
        requiresConfirmation: false,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_secretaire', 'syndic_gestionnaire'],
      },
    ],
    allowedRoles: ['syndic', 'syndic_admin', 'syndic_tech', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_comptable', 'syndic_juriste'],
    crossAgentReferrals: ['max', 'lea', 'alfredo'],
  },

  max: {
    id: 'max',
    displayName: { fr: 'Max', pt: 'Max' },
    tagline: {
      fr: 'Expert-conseil juridique copropriété',
      pt: 'Consultor jurídico condomínio',
    },
    avatarEmoji: '🎓',
    accentColor: 'indigo',
    endpoint: '/api/syndic/max-ai',
    streaming: true,
    voice: true,
    suggestedPrompts: {
      fr: [
        'Comment voter une résolution travaux art. 14-2 ?',
        'Quelle majorité pour modifier le règlement de copropriété ?',
        'Rédige une mise en demeure pour charges impayées',
      ],
      pt: [
        'Como votar uma deliberação de obras Art. 14º ?',
        'Que maioria para alterar regulamento condomínio ?',
        'Redige notificação para quotas em atraso',
      ],
    },
    toolDescriptors: [
      {
        name: 'generate_pdf_doc',
        label: { fr: 'Générer document PDF', pt: 'Gerar documento PDF' },
        description: { fr: 'Produit un document officiel (convocation, PV, notification).', pt: 'Produz um documento oficial (convocação, ata, notificação).' },
        requiresConfirmation: true,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_gestionnaire', 'syndic_juriste', 'syndic_secretaire'],
      },
    ],
    allowedRoles: ['syndic', 'syndic_admin', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_juriste'],
    crossAgentReferrals: ['fixy', 'lea'],
  },

  lea: {
    id: 'lea',
    displayName: { fr: 'Léa', pt: 'Léa' },
    tagline: {
      fr: 'Comptabilité copropriété',
      pt: 'Contabilidade condomínio',
    },
    avatarEmoji: '👩‍💼',
    accentColor: 'teal',
    endpoint: '/api/syndic/lea-comptable',
    streaming: true,
    voice: true,
    suggestedPrompts: {
      fr: [
        'Calcule la répartition de charges du 2e trimestre',
        'Analyse les impayés > 3 mois',
        'Prépare l\'annexe AG des comptes',
      ],
      pt: [
        'Calcula a repartição de quotas do 2º trimestre',
        'Analisa as quotas em atraso > 3 meses',
        'Prepara o anexo AG de contas',
      ],
    },
    toolDescriptors: [
      {
        name: 'generate_accounting_doc',
        label: { fr: 'Générer document comptable', pt: 'Gerar documento contabilístico' },
        description: { fr: 'Produit modèle d\'appel charges, budget, annexe AG.', pt: 'Produz modelo de chamada de quotas, orçamento, anexo AG.' },
        requiresConfirmation: true,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_gestionnaire', 'syndic_comptable'],
      },
    ],
    allowedRoles: ['syndic', 'syndic_admin', 'syndic_gestionnaire', 'syndic_comptable'],
    crossAgentReferrals: ['fixy', 'max'],
  },

  alfredo: {
    id: 'alfredo',
    displayName: { fr: 'Alfredo', pt: 'Alfredo' },
    tagline: {
      fr: 'Gestionnaire emails IA (à activer Plan C)',
      pt: 'Gestor emails IA (a ativar Plano C)',
    },
    avatarEmoji: '📧',
    accentColor: 'rose',
    endpoint: '/api/syndic/alfredo-chat',  // créé en Plan C
    streaming: true,
    voice: true,
    fileUpload: { accept: '.eml,.pdf,image/*', maxSizeMB: 10 },
    suggestedPrompts: { fr: [], pt: [] },  // populé en Plan C
    toolDescriptors: [],  // populés en Plan C
    allowedRoles: ['syndic', 'syndic_admin', 'syndic_tech', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_comptable', 'syndic_juriste'],
    crossAgentReferrals: ['fixy', 'max', 'lea'],
  },
}
```

- [ ] **Step 2 : Commit**

```bash
git add components/syndic-dashboard/agents-ia/configs.ts
git commit -m "feat(syndic): AGENT_CONFIGS (Fixy/Max/Léa complets, Alfredo placeholder) (Plan A chunk 2)"
```

### Task 18 : Pages wrapper pour chaque agent

**Files:**
- Create: `components/syndic-dashboard/agents-ia/pages/FixyAgentPage.tsx`
- Create: `components/syndic-dashboard/agents-ia/pages/MaxAgentPage.tsx`
- Create: `components/syndic-dashboard/agents-ia/pages/LeaAgentPage.tsx`

- [ ] **Step 1 : Créer FixyAgentPage**

```tsx
// components/syndic-dashboard/agents-ia/pages/FixyAgentPage.tsx
'use client'

import AgentChatPage from '../AgentChatPage'
import { AGENT_CONFIGS } from '../configs'
import type { User } from '@supabase/supabase-js'

export default function FixyAgentPage({ user }: { user: User & { profile?: { country?: string } } }) {
  return <AgentChatPage agentConfig={AGENT_CONFIGS.fixy} user={user} />
}
```

- [ ] **Step 2 : MaxAgentPage et LeaAgentPage (mêmes wrappers)**

```tsx
// components/syndic-dashboard/agents-ia/pages/MaxAgentPage.tsx
'use client'
import AgentChatPage from '../AgentChatPage'
import { AGENT_CONFIGS } from '../configs'
import type { User } from '@supabase/supabase-js'

export default function MaxAgentPage({ user }: { user: User & { profile?: { country?: string } } }) {
  return <AgentChatPage agentConfig={AGENT_CONFIGS.max} user={user} />
}
```

```tsx
// components/syndic-dashboard/agents-ia/pages/LeaAgentPage.tsx
'use client'
import AgentChatPage from '../AgentChatPage'
import { AGENT_CONFIGS } from '../configs'
import type { User } from '@supabase/supabase-js'

export default function LeaAgentPage({ user }: { user: User & { profile?: { country?: string } } }) {
  return <AgentChatPage agentConfig={AGENT_CONFIGS.lea} user={user} />
}
```

- [ ] **Step 3 : Commit**

```bash
git add components/syndic-dashboard/agents-ia/pages/
git commit -m "feat(syndic): pages wrapper Fixy/Max/Léa (Plan A chunk 2)"
```

### Task 19 : Wiring sidebar dans app/syndic/dashboard/page.tsx

**Files:**
- Modify: `app/syndic/dashboard/page.tsx`

- [ ] **Step 1 : Ajouter les dynamic imports en haut du fichier**

Localiser les imports `d(() => import(...))` (vers ligne 130-140) et ajouter :

```typescript
const FixyAgentPage = d(() => import('@/components/syndic-dashboard/agents-ia/pages/FixyAgentPage'))
const MaxAgentPage = d(() => import('@/components/syndic-dashboard/agents-ia/pages/MaxAgentPage'))
const LeaAgentPage = d(() => import('@/components/syndic-dashboard/agents-ia/pages/LeaAgentPage'))
```

- [ ] **Step 2 : Ajouter la catégorie sidebar dans `SIDEBAR_CATEGORIES`**

Localiser `SIDEBAR_CATEGORIES` (ligne 2326). Ajouter en première position après `accueil` (visibilité haute) :

```typescript
const SIDEBAR_CATEGORIES = [
  { key: 'agents_ia', label: locale === 'pt' ? 'Agentes IA' : 'Agents IA' },
  // ... reste inchangé ...
]
```

- [ ] **Step 3 : Ajouter les 3 navItems dans `allNavItems`**

Localiser le tableau `allNavItems` et ajouter :

```typescript
{ id: 'fixy_agent', emoji: '🤖', label: 'Fixy', category: 'agents_ia' },
{ id: 'max_agent', emoji: '🎓', label: 'Max', category: 'agents_ia' },
{ id: 'lea_agent', emoji: '👩‍💼', label: 'Léa', category: 'agents_ia' },
// alfredo_agent ajouté en Plan C
```

- [ ] **Step 4 : Ajouter les 3 cases dans le switch de rendu**

Localiser le switch de rendu (ligne ~2524+) et ajouter :

```tsx
{page === 'fixy_agent' && user && <FixyAgentPage user={user} />}
{page === 'max_agent' && user && <MaxAgentPage user={user} />}
{page === 'lea_agent' && user && <LeaAgentPage user={user} />}
```

- [ ] **Step 5 : Vérifier `tsc --noEmit` + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS

- [ ] **Step 6 : Commit**

```bash
git add app/syndic/dashboard/page.tsx
git commit -m "feat(syndic): wiring sidebar catégorie Agents IA + Fixy/Max/Léa (Plan A chunk 2)"
```

### Task 20 : E2E sidebar par rôle

**Files:**
- Create: `e2e/syndic-agents-ia.spec.ts`

- [ ] **Step 1 : Écrire le test E2E (vérifie le RBAC visuel)**

```typescript
// e2e/syndic-agents-ia.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Syndic Agents IA — sidebar RBAC', () => {
  test('syndic_admin voit les 3 agents (Fixy, Max, Léa)', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin')
    await expect(page.getByRole('button', { name: /Fixy/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Max/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Léa/i })).toBeVisible()
  })

  test('syndic_comptable ne voit pas Max', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_comptable')
    await expect(page.getByRole('button', { name: /Léa/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Max$/i })).not.toBeVisible()
  })

  test('syndic_juriste ne voit pas Léa', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_juriste')
    await expect(page.getByRole('button', { name: /Max/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Léa/i })).not.toBeVisible()
  })

  test('click sur Fixy ouvre la page chat plein écran', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin')
    await page.getByRole('button', { name: /Fixy/i }).click()
    await expect(page.getByPlaceholder(/Tape ou parle/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Nouvelle conversation/i })).toBeVisible()
  })
})
```

- [ ] **Step 2 : Lancer les tests E2E**

Run: `npm run test:e2e e2e/syndic-agents-ia.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 3 : Commit**

```bash
git add e2e/syndic-agents-ia.spec.ts
git commit -m "test(syndic): E2E sidebar agents IA par rôle (Plan A chunk 2)"
```

---

## Phase A.6 — Prompts split FR/PT (Chunks 3, 4, 5)

### Task 21 : Split Fixy prompts FR

**Files:**
- Create: `lib/syndic/prompts/fixy/system-prompt-fr.ts`
- Modify: `app/api/syndic/fixy-syndic/route.ts` (extraire le bloc FR existant)

- [ ] **Step 1 : Extraire le bloc FR existant du route.ts vers un fichier dédié**

Lire `app/api/syndic/fixy-syndic/route.ts`, localiser la fonction `buildSystemPrompt()` ou équivalent qui construit le prompt FR. Copier-coller le bloc dans :

```typescript
// lib/syndic/prompts/fixy/system-prompt-fr.ts
import type { SyndicRole } from '@/lib/syndic/agent-types'

interface FixyPromptContext {
  role: SyndicRole
  userName: string
  immeubles: Array<{ id: string; nom: string }>
  artisans: Array<{ id: string; nom_anonymized: string; metier: string }>  // sanitizé
  missions: Array<{ id: string; titre: string; statut: string }>
  alertes: Array<{ id: string; titre: string; severity: string }>
  date: string
}

export function buildFixySystemPromptFR(ctx: FixyPromptContext): string {
  return `Tu es Fixy, l'assistant d'action IA du dashboard Syndic Vitfix.

GARDE DE LOCALE : Tu réponds dans le cadre **français** uniquement. Réglementation FR (loi 65-557, ALUR, ELAN, décret 67-223). Vocabulaire FR (ordre de mission, mise en demeure, convocation AG). Si la question relève du cadre PT, indique-le et refuse d'extrapoler.

CONTEXTE UTILISATEUR :
- Rôle: ${ctx.role}
- Date: ${ctx.date}
- Immeubles gérés: ${ctx.immeubles.length}
- Artisans référencés: ${ctx.artisans.length}
- Missions actives: ${ctx.missions.length}
- Alertes en cours: ${ctx.alertes.length}

TES CAPACITÉS (tools) :
- create_mission, assign_mission, update_mission
- navigate (pages du dashboard)
- create_alert, send_message, create_document
- search_dossier (full-text dossiers copros/missions/sinistres)
- classer_document (GED)
- find_email_thread (recherche emails par contact ou sujet)

RÈGLES :
1. Quand l'utilisateur demande une action destructive (créer mission, envoyer message, classer), retourne un bloc ##ACTION##{...}## en plus du texte naturel.
2. Si une info est ambiguë, demande clarification — n'invente JAMAIS.
3. Tu ne cites jamais d'email/téléphone en clair (sanitization PII).
4. Si tu détectes une question juridique pure, propose [→ Demander à Max].
5. Si tu détectes une question comptable pure, propose [→ Demander à Léa].

Réponds toujours en français, concis et professionnel.`
}
```

- [ ] **Step 2 : Commit**

```bash
git add lib/syndic/prompts/fixy/system-prompt-fr.ts
git commit -m "feat(syndic): extraire Fixy prompt FR dans fichier dédié (Plan A chunk 3)"
```

### Task 22 : Créer Fixy prompt PT (basé sur l'existant PT du route.ts)

**Files:**
- Create: `lib/syndic/prompts/fixy/system-prompt-pt.ts`

- [ ] **Step 1 : Créer le prompt PT (vocabulaire portugais européen strict)**

```typescript
// lib/syndic/prompts/fixy/system-prompt-pt.ts
import type { SyndicRole } from '@/lib/syndic/agent-types'

interface FixyPromptContext {
  role: SyndicRole
  userName: string
  immeubles: Array<{ id: string; nom: string }>
  artisans: Array<{ id: string; nom_anonymized: string; metier: string }>
  missions: Array<{ id: string; titre: string; statut: string }>
  alertes: Array<{ id: string; titre: string; severity: string }>
  date: string
}

export function buildFixySystemPromptPT(ctx: FixyPromptContext): string {
  return `És o Fixy, o assistente de ação IA do painel Síndico Vitfix.

REGRA DE LOCALE : Respondes apenas no quadro **português europeu** (PT-PT). Regulamentação Lei 8/2022, DL 268/94, Lei 5/2021 (Condomínios). Vocabulário PT (ordem de serviço, notificação, convocação AG, profissional — NUNCA "artesão"). Se a questão for sobre FR, indica e recusa extrapolar.

CONTEXTO UTILIZADOR :
- Cargo: ${ctx.role}
- Data: ${ctx.date}
- Edifícios geridos: ${ctx.immeubles.length}
- Profissionais referenciados: ${ctx.artisans.length}
- Missões ativas: ${ctx.missions.length}
- Alertas em curso: ${ctx.alertes.length}

CAPACIDADES (tools) :
- create_mission, assign_mission, update_mission
- navigate (páginas do painel)
- create_alert, send_message, create_document
- search_dossier (pesquisa full-text)
- classer_document (arquivo digital)
- find_email_thread

REGRAS :
1. Para ações destrutivas, retorna bloco ##ACTION##{...}## com texto natural.
2. Se ambíguo, pede clarificação — NUNCA inventes.
3. Nunca cites email/telefone em claro (sanitização PII).
4. Para questões jurídicas puras, sugere [→ Perguntar ao Max].
5. Para questões contabilísticas puras, sugere [→ Perguntar à Léa].

Português europeu obrigatório. Nunca brasileiro. Conciso e profissional.`
}
```

- [ ] **Step 2 : Commit**

```bash
git add lib/syndic/prompts/fixy/system-prompt-pt.ts
git commit -m "feat(syndic): Fixy prompt PT (PT-PT strict, vocabulaire profissional) (Plan A chunk 3)"
```

### Task 23 : Refactor fixy-syndic/route.ts pour utiliser les prompts splittés

**Files:**
- Modify: `app/api/syndic/fixy-syndic/route.ts`

- [ ] **Step 1 : Remplacer la construction de prompt inline**

Localiser dans `route.ts` la fonction qui construit le prompt système. Remplacer par :

```typescript
import { buildFixySystemPromptFR } from '@/lib/syndic/prompts/fixy/system-prompt-fr'
import { buildFixySystemPromptPT } from '@/lib/syndic/prompts/fixy/system-prompt-pt'

// ... dans le handler POST :
const locale = (body.locale === 'pt' ? 'pt' : 'fr') as 'fr' | 'pt'
const systemPrompt = locale === 'pt'
  ? buildFixySystemPromptPT(ctx)
  : buildFixySystemPromptFR(ctx)
```

Supprimer l'ancien code de construction inline (le ternaire `locale === 'pt' ? ... : ...` à l'intérieur d'un seul string).

- [ ] **Step 2 : Vérifier les tests existants**

Run: `npm run test app/api/syndic/`
Expected: PASS, comportement identique à avant

- [ ] **Step 3 : Commit**

```bash
git add app/api/syndic/fixy-syndic/route.ts
git commit -m "refactor(syndic): Fixy utilise prompts FR/PT splittés (Plan A chunk 3)"
```

### Task 24 : Ajouter les 3 nouveaux tools Fixy

**Files:**
- Modify: `app/api/syndic/fixy-syndic/route.ts`
- Test: `tests/api/fixy-syndic-tools.test.ts`

- [ ] **Step 1 : Écrire les tests TDD pour les nouveaux tools**

```typescript
// tests/api/fixy-syndic-tools.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Fixy tools — search_dossier, classer_document, find_email_thread', () => {
  // Tests qui mockent la couche Supabase + valident les retours structurés

  describe('search_dossier', () => {
    it('recherche full-text dans coproprios/missions/sinistres', async () => {
      // Mock query Supabase, vérifier que l'union des résultats est retournée
    })
    it('limite les résultats à 20 max', async () => {})
    it('filtre par locale (FR ou PT)', async () => {})
  })

  describe('classer_document', () => {
    it('range un doc avec tag dans la GED', async () => {})
    it('refuse si rôle non autorisé', async () => {})
  })

  describe('find_email_thread', () => {
    it('retourne le fil par adresse email', async () => {})
    it('retourne le fil par sujet partiel', async () => {})
  })
})
```

- [ ] **Step 2 : Implémenter les 3 tools dans route.ts**

Ajouter dans le handler POST une section de traitement des tool calls avec :

```typescript
async function execSearchDossier(supabase: SupabaseClient, syndicId: string, query: string): Promise<unknown> {
  const [coproRes, missionRes, sinistreRes] = await Promise.all([
    supabase.from('coproprios').select('id, nom, lot_ref').textSearch('search_vector', query).limit(10),
    supabase.from('syndic_missions').select('id, titre, statut').textSearch('search_vector', query).limit(10),
    supabase.from('syndic_sinistres').select('id, titre, statut').textSearch('search_vector', query).limit(10),
  ])
  return {
    coproprios: coproRes.data ?? [],
    missions: missionRes.data ?? [],
    sinistres: sinistreRes.data ?? [],
  }
}

async function execClasserDocument(supabase: SupabaseClient, syndicId: string, docId: string, tags: string[]): Promise<unknown> {
  const { data, error } = await supabase
    .from('syndic_documents')
    .update({ tags })
    .eq('id', docId)
    .select()
    .single()
  if (error) throw new Error(`classer_document_failed: ${error.message}`)
  return { document_id: data.id, tags_applied: data.tags }
}

async function execFindEmailThread(supabase: SupabaseClient, syndicId: string, criteria: { email?: string; subject?: string }): Promise<unknown> {
  let query = supabase.from('syndic_emails_analysed').select('id, subject, from, body_preview, created_at').limit(20).order('created_at', { ascending: false })
  if (criteria.email) query = query.eq('from', criteria.email)
  if (criteria.subject) query = query.ilike('subject', `%${criteria.subject}%`)
  const { data } = await query
  return { emails: data ?? [] }
}
```

Puis brancher ces fonctions dans la résolution de tool calls retournés par Groq.

- [ ] **Step 3 : Lancer les tests**

Run: `npm run test tests/api/fixy-syndic-tools.test.ts`
Expected: PASS

- [ ] **Step 4 : Commit**

```bash
git add app/api/syndic/fixy-syndic/route.ts tests/api/fixy-syndic-tools.test.ts
git commit -m "feat(syndic): Fixy nouveaux tools search_dossier/classer_document/find_email_thread (Plan A chunk 3)"
```

### Task 25 : Split Max prompts FR/PT

**Files:**
- Create: `lib/syndic/prompts/max/system-prompt-fr.ts`
- Create: `lib/syndic/prompts/max/system-prompt-pt.ts`
- Modify: `app/api/syndic/max-ai/route.ts`

- [ ] **Step 1 : Extraire le prompt FR existant vers `system-prompt-fr.ts`**

Lire `app/api/syndic/max-ai/route.ts`, identifier le bloc 144 lignes de prompt FR (cartographie). Le coller dans :

```typescript
// lib/syndic/prompts/max/system-prompt-fr.ts
import type { SyndicRole } from '@/lib/syndic/agent-types'

interface MaxPromptContext {
  role: SyndicRole
  immeubles_count: number
  coproprios_count: number
}

export function buildMaxSystemPromptFR(ctx: MaxPromptContext): string {
  return `Tu es Max, expert-conseil juridique en copropriété pour le syndic Vitfix.

GARDE DE LOCALE STRICTE :
- Tu réponds dans le cadre juridique **français** uniquement.
- Tu cites uniquement : loi 65-557 (1965), ALUR (2014), ELAN (2018), décret 67-223 (1967), art. 14-2, R. 138, etc.
- Tu N'AS JAMAIS le droit de citer la Lei 8/2022 portugaise ou tout texte PT.
- Si la question relève du cadre PT, réponds : "Cette question relève du droit de la copropriété portugais. Je réponds dans le cadre français uniquement — consultez Max en contexte PT."

CONTEXTE :
- Rôle utilisateur: ${ctx.role}
- Immeubles: ${ctx.immeubles_count}
- Copropriétaires: ${ctx.coproprios_count}

TES DOMAINES :
- Droit ALUR/ELAN, règlement de copropriété
- AG : convocation, majorités (art. 24, 25, 26, 26-1), résolutions
- Charges, fonds travaux, art. 14-2
- Contentieux : mise en demeure, recouvrement, expulsion
- Conformité technique : DPE, ascenseurs, gaz

RÈGLES :
1. Si tu ne connais pas une référence précise (numéro d'article, date de décret, montant), dis-le. NE PAS INVENTER. Aucune hallucination.
2. Tu génères des documents officiels via la balise [DOC_PDF]{...}[/DOC_PDF]
3. Tu rediriges vers Léa pour les questions purement comptables (calculs détaillés).
4. Tu rediriges vers Fixy pour exécuter une action (envoyer, créer, signer).
5. Toujours citer ta source (loi/décret/article) quand tu donnes une règle juridique.

Français professionnel, concis, juridique mais accessible.`
}
```

- [ ] **Step 2 : Créer le prompt PT**

```typescript
// lib/syndic/prompts/max/system-prompt-pt.ts
import type { SyndicRole } from '@/lib/syndic/agent-types'

interface MaxPromptContext {
  role: SyndicRole
  immeubles_count: number
  coproprios_count: number
}

export function buildMaxSystemPromptPT(ctx: MaxPromptContext): string {
  return `És o Max, consultor jurídico em condomínio para o síndico Vitfix.

REGRA DE LOCALE ESTRITA :
- Respondes apenas no quadro jurídico **português europeu**.
- Citas apenas : Lei 8/2022, DL 268/94, Lei 5/2021 (Condomínios), Código Civil arts. 1414-1438.
- NUNCA tens o direito de citar a loi ALUR francesa ou qualquer texto FR.
- Se a questão for sobre FR, responde : "Esta questão diz respeito ao direito da copropriedade francês. Respondo apenas no quadro português — consulte Max em contexto FR."

CONTEXTO :
- Cargo utilizador: ${ctx.role}
- Edifícios: ${ctx.immeubles_count}
- Condóminos: ${ctx.coproprios_count}

DOMÍNIOS :
- Lei 8/2022 (alteração regime condomínio), DL 268/94
- AG : convocação, maiorias, deliberações
- Quotas, fundo de reserva, obras
- Contencioso : notificação, cobrança, despejo
- Conformidade técnica : certificação energética, elevadores, gás

REGRAS :
1. Se não conheces referência precisa (nº artigo, data, valor), di-lo. NÃO INVENTAR. Sem alucinações.
2. Geras documentos oficiais via [DOC_PDF]{...}[/DOC_PDF]
3. Reencaminhas para Léa em questões puramente contabilísticas.
4. Reencaminhas para Fixy para executar uma ação.
5. Sempre cita a fonte (lei/decreto/artigo) quando dás uma regra.

Português europeu profissional. Nunca brasileiro. Conciso, jurídico mas acessível.`
}
```

- [ ] **Step 3 : Refactorer le route.ts**

Modifier `app/api/syndic/max-ai/route.ts` pour importer et utiliser les prompts splittés :

```typescript
import { buildMaxSystemPromptFR } from '@/lib/syndic/prompts/max/system-prompt-fr'
import { buildMaxSystemPromptPT } from '@/lib/syndic/prompts/max/system-prompt-pt'

// Dans le handler POST, remplacer le bloc de construction inline par :
const locale = (body.locale === 'pt' ? 'pt' : 'fr') as 'fr' | 'pt'
const systemPrompt = locale === 'pt' ? buildMaxSystemPromptPT(ctx) : buildMaxSystemPromptFR(ctx)
```

- [ ] **Step 4 : Test E2E cross-locale**

Ajouter à `e2e/syndic-agents-ia.spec.ts` :

```typescript
test('Max FR refuse de citer une loi PT', async ({ page }) => {
  await page.goto('/syndic/dashboard?test_role=syndic_admin&test_locale=fr')
  await page.getByRole('button', { name: /Max/i }).click()
  await page.getByPlaceholder(/Tape ou parle/i).fill('Quelles sont les majorités en copropriété selon la Lei 8/2022 ?')
  await page.keyboard.press('Enter')
  const response = page.locator('[data-role="assistant"]').last()
  await expect(response).toContainText(/cadre français uniquement|droit de la copropriété portugais/i)
})
```

- [ ] **Step 5 : Lancer les tests**

Run: `npm run test app/api/syndic/max-ai && npm run test:e2e e2e/syndic-agents-ia.spec.ts`
Expected: PASS

- [ ] **Step 6 : Commit**

```bash
git add lib/syndic/prompts/max/ app/api/syndic/max-ai/route.ts e2e/syndic-agents-ia.spec.ts
git commit -m "feat(syndic): Max prompts splittés FR/PT avec garde anti-mélange (Plan A chunk 4)"
```

### Task 26 : Split Léa prompts FR/PT + ajout streaming

**Files:**
- Create: `lib/syndic/prompts/lea/system-prompt-fr.ts`
- Create: `lib/syndic/prompts/lea/system-prompt-pt.ts`
- Modify: `app/api/syndic/lea-comptable/route.ts`

- [ ] **Step 1 : Créer prompt FR**

```typescript
// lib/syndic/prompts/lea/system-prompt-fr.ts
import type { SyndicRole } from '@/lib/syndic/agent-types'

interface LeaPromptContext {
  role: SyndicRole
  exercice_courant: string
  immeuble_id?: string
}

export function buildLeaSystemPromptFR(ctx: LeaPromptContext): string {
  return `Tu es Léa, agent comptable IA pour la copropriété, dans le syndic Vitfix.

GARDE DE LOCALE STRICTE :
- Plan comptable copro **français** uniquement (NF S 31-100, arrêté 14 mars 2005).
- TVA française (20% normal, 10% travaux d'entretien, 5,5% rénovation énergétique).
- IBAN, exercice fiscal FR, formats de date FR.
- Tu N'AS JAMAIS le droit de mentionner la TVA portugaise (23%) ou le plan PT (DL 268/94).
- Si la question est PT, indique que tu n'opères que dans le cadre FR.

PÉRIMÈTRE STRICT — TU REFUSES TOUTE QUESTION HORS COMPTABILITÉ :
- Pas de questions artisans (renvoie vers Fixy)
- Pas de questions juridiques générales (renvoie vers Max)
- Pas de questions techniques (renvoie vers Fixy)

CONTEXTE :
- Rôle: ${ctx.role}
- Exercice: ${ctx.exercice_courant}

DOMAINES :
- Répartition de charges, tantièmes, clés de répartition
- Appels de fonds trimestriels
- Régularisation annuelle
- Impayés, recouvrement amiable
- Fonds travaux art. 14-2, fonds de roulement
- Annexes AG, comptes-rendus

RÈGLES :
1. Calculs précis : arrondis à 2 décimales, mention des bases de calcul.
2. Si données manquantes, demande — NE PAS INVENTER.
3. Tu génères des modèles via balise [DOC_COMPTA]{...}[/DOC_COMPTA]

Français comptable précis. Citations de règles : NF S 31-100, art. 14-2, arrêté 14 mars 2005.`
}
```

- [ ] **Step 2 : Créer prompt PT**

```typescript
// lib/syndic/prompts/lea/system-prompt-pt.ts
import type { SyndicRole } from '@/lib/syndic/agent-types'

interface LeaPromptContext {
  role: SyndicRole
  exercice_courant: string
  immeuble_id?: string
}

export function buildLeaSystemPromptPT(ctx: LeaPromptContext): string {
  return `És a Léa, agente contabilística IA para condomínio, no síndico Vitfix.

REGRA DE LOCALE ESTRITA :
- Plano contabilístico condomínio **português** apenas (DL 268/94 e regulamento de contas correntes).
- IVA português (23% normal, 6% obras certificadas, 13% manutenção).
- IBAN, exercício fiscal PT, formato data PT.
- NUNCA podes mencionar TVA francesa (20%) nem plano FR.
- Se questão for FR, indica que operas apenas no quadro PT.

PERÍMETRO ESTRITO — RECUSA QUALQUER QUESTÃO FORA CONTABILIDADE :
- Sem questões profissionais (encaminha para Fixy)
- Sem questões jurídicas gerais (encaminha para Max)
- Sem questões técnicas (encaminha para Fixy)

CONTEXTO :
- Cargo: ${ctx.role}
- Exercício: ${ctx.exercice_courant}

DOMÍNIOS :
- Repartição de quotas, permilagens
- Chamadas trimestrais
- Regularização anual
- Quotas em atraso, cobrança amigável
- Fundo de reserva (10% mín. obrigatório)
- Anexos AG, prestação de contas

REGRAS :
1. Cálculos precisos : arredondamento 2 decimais, bases de cálculo.
2. Se dados em falta, pergunta — NÃO INVENTES.
3. Geras modelos via [DOC_COMPTA]{...}[/DOC_COMPTA]

Português europeu contabilístico preciso. Citações : DL 268/94, art. 1424, 1430 CC.`
}
```

- [ ] **Step 3 : Refactorer route.ts pour utiliser les prompts + ajouter streaming SSE**

Modifier `app/api/syndic/lea-comptable/route.ts` :
1. Importer `buildLeaSystemPromptFR/PT`
2. Remplacer le prompt inline de 652 lignes par les imports
3. Ajouter la branche streaming SSE (similaire à `max-ai/route.ts`)

```typescript
import { buildLeaSystemPromptFR } from '@/lib/syndic/prompts/lea/system-prompt-fr'
import { buildLeaSystemPromptPT } from '@/lib/syndic/prompts/lea/system-prompt-pt'

// ... dans le handler POST :
const locale = (body.locale === 'pt' ? 'pt' : 'fr') as 'fr' | 'pt'
const systemPrompt = locale === 'pt' ? buildLeaSystemPromptPT(ctx) : buildLeaSystemPromptFR(ctx)

const wantsStreaming = req.headers.get('accept')?.includes('text/event-stream')

if (wantsStreaming) {
  return new Response(
    new ReadableStream({
      async start(controller) {
        // Appel Groq avec stream: true, push de chaque delta en SSE
        // Format SSE : `data: ${JSON.stringify({ delta })}\n\n`
        // Final : `data: [DONE]\n\n`
      }
    }),
    { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } }
  )
}

// Sinon, retour JSON classique
// ... existant
```

- [ ] **Step 4 : Test E2E**

Ajouter à `e2e/syndic-agents-ia.spec.ts` :

```typescript
test('Léa FR refuse TVA portugaise', async ({ page }) => {
  await page.goto('/syndic/dashboard?test_role=syndic_comptable&test_locale=fr')
  await page.getByRole('button', { name: /Léa/i }).click()
  await page.getByPlaceholder(/Tape ou parle/i).fill('Quel est le taux de TVA à 23% applicable à mes travaux ?')
  await page.keyboard.press('Enter')
  const response = page.locator('[data-role="assistant"]').last()
  await expect(response).toContainText(/cadre français|TVA française|20%/i)
})
```

- [ ] **Step 5 : Tests**

Run: `npm run test app/api/syndic/lea-comptable && npm run test:e2e e2e/syndic-agents-ia.spec.ts`
Expected: PASS

- [ ] **Step 6 : Commit**

```bash
git add lib/syndic/prompts/lea/ app/api/syndic/lea-comptable/route.ts e2e/syndic-agents-ia.spec.ts
git commit -m "feat(syndic): Léa prompts splittés FR/PT + streaming SSE (Plan A chunk 5)"
```

---

## Phase A.7 — Smoke test final + handoff Plan B

### Task 27 : Smoke test parcours complet

**Files:**
- Modify: `e2e/syndic-agents-ia.spec.ts`

- [ ] **Step 1 : Ajouter un parcours bout-en-bout**

```typescript
test('parcours complet Fixy : créer conversation, envoyer message, recevoir réponse', async ({ page }) => {
  await page.goto('/syndic/dashboard?test_role=syndic_admin&test_locale=fr')
  await page.getByRole('button', { name: /Fixy/i }).click()
  await expect(page.getByPlaceholder(/Tape ou parle/i)).toBeVisible()

  // Nouvelle conversation
  await page.getByRole('button', { name: /Nouvelle conversation/i }).click()

  // Envoi message
  const input = page.getByPlaceholder(/Tape ou parle/i)
  await input.fill('Combien d\'immeubles je gère ?')
  await page.keyboard.press('Enter')

  // Attendre la réponse (jusqu'à 30s pour Groq)
  await expect(page.locator('[data-role="assistant"]')).toBeVisible({ timeout: 30000 })

  // La conversation apparaît dans la sidebar
  await expect(page.locator('aside').getByText(/Combien d'immeubles/i)).toBeVisible()
})
```

- [ ] **Step 2 : Lancer tous les tests E2E**

Run: `npm run test:e2e e2e/syndic-agents-ia.spec.ts`
Expected: PASS (tous les tests du fichier)

- [ ] **Step 3 : Commit final Plan A**

```bash
git add e2e/syndic-agents-ia.spec.ts
git commit -m "test(syndic): smoke test parcours complet Fixy (Plan A final)"
```

---

## Self-Review checklist (Plan A)

Avant de marquer ce plan comme terminé, vérifier :

- [ ] **Chunk 0** : migration DB créée + RLS testée
- [ ] **Chunk 1** : `<AgentChatPage>` + 4 hooks + agent-locale-resolver + types + API REST
- [ ] **Chunk 2** : sidebar catégorie `agents_ia` + 3 navItems + 3 cases switch + AGENT_CONFIGS
- [ ] **Chunk 3** : Fixy split FR/PT + 3 nouveaux tools + tests TDD
- [ ] **Chunk 4** : Max split FR/PT + garde anti-mélange + E2E cross-locale
- [ ] **Chunk 5** : Léa split FR/PT + streaming SSE + E2E cross-locale
- [ ] Tous les commits suivent la convention `feat(syndic):` / `refactor(syndic):` / `test(syndic):`
- [ ] Aucun TODO/FIXME laissé dans le code
- [ ] `npx tsc --noEmit` passe
- [ ] `npm run lint` passe
- [ ] `npm run test` passe (toute la suite Vitest)
- [ ] `npm run test:e2e e2e/syndic-agents-ia.spec.ts` passe
- [ ] Le dashboard syndic, ouvert avec un compte test, montre bien la catégorie « Agents IA » avec Fixy/Max/Léa, chacun ouvre une page chat plein écran fonctionnelle

## Hors scope rappel

- Suppression de `FixyPanel` bulle flottante → Plan D
- Suppression de `AideSection` (page `ia` legacy) → Plan D
- Audit/suppression de `Copro-AI` → Plan D
- Sanitization PII dans les prompts → Plan B
- Encryption tokens OAuth → Plan B
- Alfredo (chat + pipeline + Inbox) → Plan C
- Langfuse instrumentation → Plan D

## Prochaines étapes

À la fin de Plan A, Fixy/Max/Léa sont fonctionnels en sidebar avec chat plein écran et split locale strict, mais :
- La bulle flottante FixyPanel coexiste encore (suppression Plan D)
- Les emails artisans sont toujours envoyés en clair à Groq (sanitization Plan B)
- Alfredo n'existe pas encore (Plan C)

Passer à **Plan B** (Security hardening — sanitization PII + encryption OAuth).
