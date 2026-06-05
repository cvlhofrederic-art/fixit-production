# Plan C — Agents IA Syndic : Alfredo Proactif (Phase 3/4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer Alfredo (backbone email-agent existant) en un véritable agent IA proactif qui scanne automatiquement les emails entrants, charge le contexte client complet (historique, missions, impayés, sinistres), génère un brouillon de réponse adapté, notifie l'utilisateur en temps réel, et fournit aussi un mode chat conversationnel pour des requêtes ad hoc.

**Architecture:** Pipeline en cascade `webhook Gmail Push → poll ciblé → classify_email → load_client_context → draft_reply → INSERT pending_review`. UI dual mode dans `<AgentChatPage>` Alfredo : Inbox proactif (vue par défaut, brouillons à valider) + Discussions (chat). Notifications via Supabase Realtime + toast. Tools chat : `search_emails`, `bulk_action`, `summarize_inbox`, `regenerate_draft`, `learn_from_correction`.

**Tech Stack:** Next.js 16 App Router, Cloudflare Pub/Sub, Supabase Realtime + RLS, Groq Llama 3.3 70B (drafting), Llama 4 Vision (OCR existant), Vitest, Playwright.

**Spec référence:** [docs/superpowers/specs/2026-05-11-agents-ia-syndic-category-design.md](../specs/2026-05-11-agents-ia-syndic-category-design.md) §3.6 (mode proactif) + §3.6.bis (tools) + §3.7 (sanitization, déjà en Plan B).

**Scope Plan C (chunks 8-12 du spec) :**
- Migration `syndic_emails_analysed` (ajout colonnes `draft_*`)
- `lib/syndic/alfredo-data-access-policy.ts` (matrice RBAC par rôle)
- `lib/syndic/alfredo-load-client-context.ts` (helper Promise.all multi-tables)
- Pipeline auto-draft : `app/api/email-agent/webhook/route.ts` (Pub/Sub) + intégration `poll/route.ts` + `lib/syndic/alfredo-pipeline.ts`
- Wrapper chat `app/api/syndic/alfredo-chat/route.ts` avec 5 nouveaux tools
- UI Inbox proactif : composant `<AlfredoInboxView>` + hook `useAlfredoNotifications` (Supabase Realtime) + toast notif + badge sidebar
- Cron renouvellement Gmail watch (Cloudflare Worker)
- Tests E2E pipeline complet

**Hors scope Plan C :**
- Suppression FixyPanel legacy → Plan D
- Drop colonnes plain OAuth → Plan D
- Langfuse instrumentation Alfredo → Plan D
- Corpus juridique Max (phase 2 post-MVP) → Plan E hypothétique

**Pré-requis bloquants Plan C :**
- Plan B Phase 1 (migration encryption) appliquée en prod
- Plan B Phase 2 (backfill tokens) terminé
- Plan B Phase 3 (code dual-write) déployé et stable

---

## File Structure

**Nouveaux fichiers :**
- `supabase/migrations/20260513_alfredo_drafts.sql` — colonnes draft_* + index
- `lib/syndic/alfredo-data-access-policy.ts` — matrice RBAC par source de données
- `lib/syndic/alfredo-load-client-context.ts` — helper Promise.all
- `lib/syndic/alfredo-pipeline.ts` — orchestrateur classify → context → draft
- `app/api/email-agent/webhook/route.ts` — handler Gmail Pub/Sub
- `app/api/syndic/alfredo-chat/route.ts` — wrapper conversationnel
- `lib/syndic/prompts/alfredo/system-prompt-fr.ts`
- `lib/syndic/prompts/alfredo/system-prompt-pt.ts`
- `lib/syndic/prompts/alfredo/draft-reply-prompt-fr.ts` — prompt drafting réponse FR
- `lib/syndic/prompts/alfredo/draft-reply-prompt-pt.ts` — prompt drafting réponse PT
- `components/syndic-dashboard/agents-ia/pages/AlfredoAgentPage.tsx` — page wrapper
- `components/syndic-dashboard/agents-ia/AlfredoInboxView.tsx` — vue Inbox proactif
- `components/syndic-dashboard/agents-ia/AlfredoDraftEditor.tsx` — éditeur de brouillon
- `components/syndic-dashboard/agents-ia/hooks/useAlfredoNotifications.ts` — Realtime subscriptions
- `components/syndic-dashboard/agents-ia/hooks/useAlfredoDrafts.ts` — fetch/update drafts
- `scripts/renew-gmail-watches.ts` — cron renouvellement
- `tests/lib/syndic/alfredo-data-access-policy.test.ts`
- `tests/lib/syndic/alfredo-load-client-context.test.ts`
- `tests/lib/syndic/alfredo-pipeline.test.ts`
- `tests/api/email-agent-webhook.test.ts`
- `tests/api/syndic-alfredo-chat.test.ts`

**Fichiers modifiés :**
- `app/api/email-agent/poll/route.ts` — invoque pipeline alfredo après classification
- `app/syndic/dashboard/page.tsx` — ajoute AlfredoAgentPage dans le switch + active navItem
- `components/syndic-dashboard/agents-ia/configs.ts` — populé `alfredo.suggestedPrompts` + `toolDescriptors`
- `components/syndic-dashboard/agents-ia/AgentChatPage.tsx` — intercepte agent_id=alfredo pour dispatcher vers AlfredoInboxView ou chat selon mode

---

## Phase C.0 — Migration colonnes drafts (chunk 8)

### Task 1 : Migration `syndic_emails_analysed`

**Files:**
- Create: `supabase/migrations/20260513_alfredo_drafts.sql`
- Create: `tests/migrations/alfredo_drafts.test.ts`

- [ ] **Step 1 : Migration SQL**

```sql
-- supabase/migrations/20260513_alfredo_drafts.sql
-- ══════════════════════════════════════════════════════════════════════════════
-- Migration — Colonnes drafts Alfredo (Plan C Chunk 8)
-- Date: 2026-05-13
-- ══════════════════════════════════════════════════════════════════════════════
-- Étend syndic_emails_analysed avec les colonnes nécessaires au mode proactif
-- d'Alfredo : un brouillon de réponse est généré dès la réception, l'utilisateur
-- valide / édite / skip via l'UI Inbox.

ALTER TABLE syndic_emails_analysed
  ADD COLUMN draft_subject text,
  ADD COLUMN draft_body_html text,
  ADD COLUMN draft_body_text text,
  ADD COLUMN draft_status text DEFAULT 'none'
    CHECK (draft_status IN ('none', 'generating', 'pending_review', 'approved', 'sent', 'edited_sent', 'skipped', 'expired')),
  ADD COLUMN draft_meta jsonb,
  ADD COLUMN draft_generated_at timestamptz,
  ADD COLUMN draft_reviewed_at timestamptz,
  ADD COLUMN draft_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX idx_emails_pending_alfredo
  ON syndic_emails_analysed(syndic_id, draft_generated_at DESC)
  WHERE draft_status = 'pending_review';

CREATE INDEX idx_emails_alfredo_status
  ON syndic_emails_analysed(syndic_id, draft_status, received_at DESC)
  WHERE draft_status != 'none';

COMMENT ON COLUMN syndic_emails_analysed.draft_status IS
  'État du brouillon Alfredo : none (pas de brouillon proposé) | generating (en cours) | pending_review | approved | sent | edited_sent | skipped | expired';
COMMENT ON COLUMN syndic_emails_analysed.draft_meta IS
  'Métadonnées drafting : { confidence, tone, missing_info[], suggested_next_actions[], context_token_count, model, latency_ms }';

-- Ajout de la FK que la migration agents_ia_foundation différait
-- (à appliquer après le backfill éventuel, qui n'est pas critique)
ALTER TABLE syndic_alfredo_learning
  ADD CONSTRAINT fk_syndic_alfredo_learning_email
  FOREIGN KEY (email_id) REFERENCES syndic_emails_analysed(id) ON DELETE SET NULL;
```

- [ ] **Step 2 : Tests**

```typescript
// tests/migrations/alfredo_drafts.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Migration alfredo_drafts.sql', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260513_alfredo_drafts.sql'),
    'utf-8',
  )

  it('ajoute 8 colonnes draft_*', () => {
    expect(sql).toMatch(/ADD COLUMN draft_subject text/)
    expect(sql).toMatch(/ADD COLUMN draft_body_html text/)
    expect(sql).toMatch(/ADD COLUMN draft_body_text text/)
    expect(sql).toMatch(/ADD COLUMN draft_status text/)
    expect(sql).toMatch(/ADD COLUMN draft_meta jsonb/)
    expect(sql).toMatch(/ADD COLUMN draft_generated_at timestamptz/)
    expect(sql).toMatch(/ADD COLUMN draft_reviewed_at timestamptz/)
    expect(sql).toMatch(/ADD COLUMN draft_reviewed_by uuid/)
  })

  it('définit les 8 valeurs valides de draft_status', () => {
    expect(sql).toMatch(/CHECK \(draft_status IN \('none', 'generating', 'pending_review', 'approved', 'sent', 'edited_sent', 'skipped', 'expired'\)\)/)
  })

  it('crée 2 indexes performants', () => {
    expect(sql).toMatch(/CREATE INDEX idx_emails_pending_alfredo[\s\S]*?WHERE draft_status = 'pending_review'/)
    expect(sql).toMatch(/CREATE INDEX idx_emails_alfredo_status/)
  })

  it('ajoute la FK syndic_alfredo_learning.email_id → syndic_emails_analysed.id', () => {
    expect(sql).toMatch(/ADD CONSTRAINT fk_syndic_alfredo_learning_email/)
    expect(sql).toMatch(/FOREIGN KEY \(email_id\) REFERENCES syndic_emails_analysed\(id\)/)
  })
})
```

- [ ] **Step 3 : Run + commit**

```bash
npm run test tests/migrations/alfredo_drafts.test.ts -- --run
git add supabase/migrations/20260513_alfredo_drafts.sql tests/migrations/alfredo_drafts.test.ts
git commit -m "feat(alfredo): migration colonnes drafts + indexes (Plan C Task 1)"
```

---

## Phase C.1 — Helpers data access (chunk 9)

### Task 2 : `lib/syndic/alfredo-data-access-policy.ts`

**Files:**
- Create: `lib/syndic/alfredo-data-access-policy.ts`
- Create: `tests/lib/syndic/alfredo-data-access-policy.test.ts`

- [ ] **Step 1 : Test TDD**

```typescript
// tests/lib/syndic/alfredo-data-access-policy.test.ts
import { describe, it, expect } from 'vitest'
import {
  ALFREDO_DATA_ACCESS_POLICY,
  canAccessSource,
  filterContextByRole,
} from '@/lib/syndic/alfredo-data-access-policy'

describe('Alfredo data access policy', () => {
  it('syndic et syndic_admin ont accès à toutes les sources', () => {
    const sources = ALFREDO_DATA_ACCESS_POLICY.sources
    for (const source of sources) {
      expect(canAccessSource('syndic', source)).toBe(true)
      expect(canAccessSource('syndic_admin', source)).toBe(true)
    }
  })

  it('syndic_comptable a accès aux sources financières', () => {
    expect(canAccessSource('syndic_comptable', 'syndic_appels_charges')).toBe(true)
    expect(canAccessSource('syndic_comptable', 'syndic_impayes')).toBe(true)
    expect(canAccessSource('syndic_comptable', 'syndic_factures')).toBe(true)
  })

  it('syndic_juriste a accès aux sources juridiques et contentieux', () => {
    expect(canAccessSource('syndic_juriste', 'syndic_recouvrement')).toBe(true)
    expect(canAccessSource('syndic_juriste', 'syndic_sinistres')).toBe(true)
  })

  it('syndic_tech n\'a PAS accès aux données financières', () => {
    expect(canAccessSource('syndic_tech', 'syndic_appels_charges')).toBe(false)
    expect(canAccessSource('syndic_tech', 'syndic_impayes')).toBe(false)
    expect(canAccessSource('syndic_tech', 'syndic_recouvrement')).toBe(false)
  })

  it('syndic_juriste n\'a PAS accès aux détails financiers granulaires', () => {
    expect(canAccessSource('syndic_juriste', 'syndic_appels_charges')).toBe(false)
  })

  it('filterContextByRole supprime les champs non autorisés', () => {
    const fullContext = {
      identity: { lot_ref_anonymized: 'L42', tantiemes: 250 },
      financial: { impayes: [], statut_paiement: 'a_jour' as const, derniers_appels: [] },
      open_items: { missions: [], devis_en_cours: [], sinistres: [], signalements: [] },
    }
    const filtered = filterContextByRole('syndic_tech', fullContext)
    expect(filtered.identity).toBeDefined()
    expect(filtered.financial).toBeUndefined()
    expect(filtered.open_items).toBeDefined()
    expect(filtered.rbac_omitted_fields).toContain('financial')
  })

  it('rbac_omitted_fields documente les omissions pour debug', () => {
    const filtered = filterContextByRole('syndic_tech', {
      financial: { statut_paiement: 'en_retard' as const, impayes: [], derniers_appels: [] }
    })
    expect(filtered.rbac_omitted_fields).toEqual(expect.arrayContaining(['financial']))
  })
})
```

- [ ] **Step 2 : Run (FAIL)**

```bash
npm run test tests/lib/syndic/alfredo-data-access-policy.test.ts -- --run
```

- [ ] **Step 3 : Implémenter**

```typescript
// lib/syndic/alfredo-data-access-policy.ts
import type { SyndicRole } from './agent-types'

export type AlfredoDataSource =
  | 'coproprios'
  | 'syndic_artisans'
  | 'syndic_locataires'
  | 'syndic_emails_analysed'
  | 'syndic_messages'
  | 'syndic_documents'
  | 'syndic_missions'
  | 'syndic_planning'
  | 'syndic_devis'
  | 'syndic_factures'
  | 'syndic_appels_charges'
  | 'syndic_impayes'
  | 'syndic_recouvrement'
  | 'syndic_sinistres'
  | 'syndic_signalements'
  | 'syndic_ocorrencias'
  | 'syndic_alertes'
  | 'syndic_immeubles'
  | 'syndic_carnet_entretien'
  | 'syndic_pppt'
  | 'syndic_assemblees'

type Policy = Record<SyndicRole, AlfredoDataSource[]>

const ALL_SOURCES: AlfredoDataSource[] = [
  'coproprios', 'syndic_artisans', 'syndic_locataires',
  'syndic_emails_analysed', 'syndic_messages', 'syndic_documents',
  'syndic_missions', 'syndic_planning', 'syndic_devis', 'syndic_factures',
  'syndic_appels_charges', 'syndic_impayes', 'syndic_recouvrement',
  'syndic_sinistres', 'syndic_signalements', 'syndic_ocorrencias',
  'syndic_alertes', 'syndic_immeubles', 'syndic_carnet_entretien',
  'syndic_pppt', 'syndic_assemblees',
]

const POLICY: Policy = {
  syndic: ALL_SOURCES,
  syndic_admin: ALL_SOURCES,
  syndic_gestionnaire: ALL_SOURCES.filter(s => s !== 'syndic_recouvrement'),
  syndic_tech: [
    'coproprios', 'syndic_artisans', 'syndic_locataires',
    'syndic_emails_analysed', 'syndic_messages',
    'syndic_missions', 'syndic_planning',
    'syndic_sinistres', 'syndic_signalements', 'syndic_ocorrencias',
    'syndic_alertes', 'syndic_immeubles', 'syndic_carnet_entretien',
    'syndic_pppt',
  ],
  syndic_juriste: [
    'coproprios', 'syndic_artisans', 'syndic_locataires',
    'syndic_emails_analysed', 'syndic_messages', 'syndic_documents',
    'syndic_missions', 'syndic_sinistres',
    'syndic_recouvrement', 'syndic_immeubles', 'syndic_assemblees',
  ],
  syndic_comptable: [
    'coproprios', 'syndic_artisans', 'syndic_locataires',
    'syndic_emails_analysed', 'syndic_messages', 'syndic_documents',
    'syndic_devis', 'syndic_factures',
    'syndic_appels_charges', 'syndic_impayes', 'syndic_recouvrement',
    'syndic_immeubles',
  ],
  syndic_secretaire: [
    'coproprios', 'syndic_artisans', 'syndic_locataires',
    'syndic_emails_analysed', 'syndic_messages', 'syndic_documents',
    'syndic_missions', 'syndic_planning',
    'syndic_signalements', 'syndic_ocorrencias',
    'syndic_alertes', 'syndic_immeubles', 'syndic_assemblees',
  ],
}

export const ALFREDO_DATA_ACCESS_POLICY = {
  sources: ALL_SOURCES,
  policy: POLICY,
}

export function canAccessSource(role: SyndicRole, source: AlfredoDataSource): boolean {
  const allowed = POLICY[role] ?? []
  return allowed.includes(source)
}

interface ContextLike {
  identity?: unknown
  immeuble?: unknown
  history_summary?: unknown
  recent_interactions?: unknown
  open_items?: unknown
  financial?: unknown
  immeuble_context?: unknown
}

const FIELD_TO_SOURCES: Record<string, AlfredoDataSource[]> = {
  financial: ['syndic_appels_charges', 'syndic_impayes', 'syndic_recouvrement'],
  immeuble_context: ['syndic_carnet_entretien', 'syndic_pppt', 'syndic_alertes', 'syndic_assemblees'],
}

export function filterContextByRole<T extends ContextLike>(
  role: SyndicRole,
  context: T,
): T & { rbac_omitted_fields: string[] } {
  const omitted: string[] = []
  const out: T & { rbac_omitted_fields: string[] } = { ...context, rbac_omitted_fields: [] }

  for (const [field, requiredSources] of Object.entries(FIELD_TO_SOURCES)) {
    const hasAccess = requiredSources.every(src => canAccessSource(role, src))
    if (!hasAccess && field in out) {
      delete (out as Record<string, unknown>)[field]
      omitted.push(field)
    }
  }

  out.rbac_omitted_fields = omitted
  return out
}
```

- [ ] **Step 4 : Run + commit**

```bash
npm run test tests/lib/syndic/alfredo-data-access-policy.test.ts -- --run
git add lib/syndic/alfredo-data-access-policy.ts tests/lib/syndic/alfredo-data-access-policy.test.ts
git commit -m "feat(alfredo): data access policy par rôle (Plan C Task 2)"
```

### Task 3 : `lib/syndic/alfredo-load-client-context.ts`

**Files:**
- Create: `lib/syndic/alfredo-load-client-context.ts`
- Create: `tests/lib/syndic/alfredo-load-client-context.test.ts`

- [ ] **Step 1 : Test (mocks Supabase)**

```typescript
// tests/lib/syndic/alfredo-load-client-context.test.ts
import { describe, it, expect, vi } from 'vitest'
import { loadClientContext } from '@/lib/syndic/alfredo-load-client-context'

function mockClient(responses: Record<string, unknown>) {
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          ilike: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(async () => ({
                data: responses[table] ?? [],
                error: null,
              })),
            })),
            limit: vi.fn(async () => ({
              data: responses[table] ?? [],
              error: null,
            })),
          })),
          order: vi.fn(() => ({
            limit: vi.fn(async () => ({
              data: responses[table] ?? [],
              error: null,
            })),
          })),
          limit: vi.fn(async () => ({
            data: responses[table] ?? [],
            error: null,
          })),
          single: vi.fn(async () => ({
            data: Array.isArray(responses[table]) ? (responses[table] as unknown[])[0] ?? null : responses[table] ?? null,
            error: null,
          })),
        })),
      })),
    })),
  }
}

describe('loadClientContext', () => {
  it('retourne unknown si coproprio non trouvé', async () => {
    const client = mockClient({}) as unknown as Parameters<typeof loadClientContext>[0]
    const ctx = await loadClientContext(client, {
      syndicId: 's1',
      syndicRole: 'syndic_admin',
      emailAddress: 'unknown@example.com',
      locale: 'fr',
    })
    expect(ctx.copro_status).toBe('unknown')
    expect(ctx.identity).toBeUndefined()
  })

  it('retourne identified avec lot quand coproprio trouvé', async () => {
    const client = mockClient({
      coproprios: [{
        id: 'c1',
        nom: 'Dupont',
        email: 'a@b.fr',
        lot_ref: 'B12',
        tantiemes: 250,
        statut: 'occupant',
      }],
    }) as unknown as Parameters<typeof loadClientContext>[0]

    const ctx = await loadClientContext(client, {
      syndicId: 's1',
      syndicRole: 'syndic_admin',
      emailAddress: 'a@b.fr',
      locale: 'fr',
    })
    expect(ctx.copro_status).toBe('identified')
    expect(ctx.identity?.role).toBe('coproprietaire')
  })

  it('inclut financial pour syndic_admin', async () => {
    const client = mockClient({
      coproprios: [{ id: 'c1', email: 'a@b.fr' }],
      syndic_impayes: [{ montant: 500, depuis: '2026-01-01' }],
    }) as unknown as Parameters<typeof loadClientContext>[0]

    const ctx = await loadClientContext(client, {
      syndicId: 's1',
      syndicRole: 'syndic_admin',
      emailAddress: 'a@b.fr',
      locale: 'fr',
    })
    expect(ctx.financial).toBeDefined()
    expect(ctx.rbac_omitted_fields).not.toContain('financial')
  })

  it('omet financial pour syndic_tech', async () => {
    const client = mockClient({
      coproprios: [{ id: 'c1', email: 'a@b.fr' }],
    }) as unknown as Parameters<typeof loadClientContext>[0]

    const ctx = await loadClientContext(client, {
      syndicId: 's1',
      syndicRole: 'syndic_tech',
      emailAddress: 'a@b.fr',
      locale: 'fr',
    })
    expect(ctx.financial).toBeUndefined()
    expect(ctx.rbac_omitted_fields).toContain('financial')
  })

  it('client_token est déterministe', async () => {
    const client = mockClient({
      coproprios: [{ id: 'c1', email: 'a@b.fr' }],
    }) as unknown as Parameters<typeof loadClientContext>[0]

    const ctx1 = await loadClientContext(client, {
      syndicId: 's1', syndicRole: 'syndic_admin', emailAddress: 'a@b.fr', locale: 'fr',
    })
    const ctx2 = await loadClientContext(client, {
      syndicId: 's1', syndicRole: 'syndic_admin', emailAddress: 'a@b.fr', locale: 'fr',
    })
    expect(ctx1.client_token).toBe(ctx2.client_token)
  })
})
```

- [ ] **Step 2 : Implémenter**

```typescript
// lib/syndic/alfredo-load-client-context.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import type { SyndicRole, Locale } from './agent-types'
import { canAccessSource, filterContextByRole } from './alfredo-data-access-policy'

export interface ClientContext {
  client_token: string
  copro_status: 'identified' | 'unknown' | 'artisan' | 'locataire'

  identity?: {
    role: 'coproprietaire' | 'locataire' | 'artisan' | 'tiers'
    lot_ref_anonymized?: string
    tantiemes?: number
    statut?: 'occupant' | 'bailleur'
    anciennete_mois?: number
  }
  immeuble?: { ref_anonymized: string; ville: string; nb_lots: number }

  history_summary: {
    total_emails: number
    last_topics: string[]
    sentiment_drift: 'positif' | 'neutre' | 'tendu'
    last_resolved_topics: string[]
  }
  recent_interactions: Array<{
    date: string
    subject: string
    channel: string
    resolution: string
  }>

  open_items: {
    missions: Array<{ id: string; titre: string; statut: string; artisan_token?: string }>
    devis_en_cours: Array<{ ref_anonymized: string; montant: number; statut: string }>
    sinistres: Array<{ id: string; titre: string; statut: string; depuis: string }>
    signalements: Array<{ id: string; titre: string; priorite: string }>
  }

  financial?: {
    statut_paiement: 'a_jour' | 'en_retard' | 'en_recouvrement'
    impayes: Array<{ montant: number; depuis: string; nature: string }>
    derniers_appels: Array<{ exercice: string; montant: number; paye: boolean }>
  }

  immeuble_context?: {
    travaux_en_cours: Array<{ ref_anonymized: string; titre: string; statut: string }>
    derniere_ag?: { date: string; resolutions_concernant: string[] }
    alertes_actives: Array<{ titre: string; severite: string }>
  }

  missing_info_hints: string[]
  rbac_omitted_fields: string[]
}

export interface LoadContextParams {
  syndicId: string
  syndicRole: SyndicRole
  emailAddress: string
  locale: Locale
}

function deterministicToken(emailAddress: string, syndicId: string): string {
  return 'ct_' + createHash('sha256')
    .update(`${syndicId}|${emailAddress}`)
    .digest('hex')
    .slice(0, 12)
}

export async function loadClientContext(
  client: SupabaseClient<unknown>,
  params: LoadContextParams,
): Promise<ClientContext> {
  const { syndicId, syndicRole, emailAddress } = params

  // Lookup copropriétaire en priorité (acc. cas le plus fréquent)
  const coproQuery = client
    .from('coproprios' as 'syndic_coproprios')
    .select('id, nom, email, lot_ref, tantiemes, statut, immeuble_id, created_at')
    .eq('email', emailAddress)
    .limit(1)
    .single()

  // Historique emails — toujours autorisé
  const emailsQuery = client
    .from('syndic_emails_analysed')
    .select('id, from_email, subject, body_preview, received_at, type_demande, urgence')
    .eq('syndic_id', syndicId)
    .eq('from_email', emailAddress)
    .order('received_at', { ascending: false })
    .limit(20)

  // Lookup artisan en parallèle (si email correspond à un artisan)
  const artisanQuery = canAccessSource(syndicRole, 'syndic_artisans')
    ? client
        .from('syndic_artisans')
        .select('id, nom, email')
        .eq('email', emailAddress)
        .limit(1)
        .single()
    : null

  const [copro, emails, artisan] = await Promise.all([
    coproQuery,
    emailsQuery,
    artisanQuery,
  ])

  const coproRow = copro?.data ?? null
  const isIdentified = !!coproRow
  const isArtisan = !!artisan?.data

  // Construction progressive du contexte
  let copro_status: ClientContext['copro_status'] = 'unknown'
  if (isArtisan) copro_status = 'artisan'
  else if (isIdentified) copro_status = 'identified'

  const baseContext: ClientContext = {
    client_token: deterministicToken(emailAddress, syndicId),
    copro_status,
    history_summary: {
      total_emails: emails.data?.length ?? 0,
      last_topics: extractTopics(emails.data ?? []),
      sentiment_drift: 'neutre',
      last_resolved_topics: [],
    },
    recent_interactions: (emails.data ?? []).slice(0, 5).map(e => ({
      date: e.received_at,
      subject: e.subject ?? '',
      channel: 'email',
      resolution: 'pending',
    })),
    open_items: {
      missions: [],
      devis_en_cours: [],
      sinistres: [],
      signalements: [],
    },
    missing_info_hints: [],
    rbac_omitted_fields: [],
  }

  if (coproRow) {
    baseContext.identity = {
      role: 'coproprietaire',
      lot_ref_anonymized: coproRow.lot_ref ? `lot_${createHash('sha256').update(String(coproRow.lot_ref)).digest('hex').slice(0, 6)}` : undefined,
      tantiemes: typeof coproRow.tantiemes === 'number' ? coproRow.tantiemes : undefined,
      statut: coproRow.statut === 'bailleur' || coproRow.statut === 'occupant' ? coproRow.statut : undefined,
    }
  }

  if (!isIdentified && !isArtisan) {
    baseContext.missing_info_hints.push('Aucune correspondance copro/artisan pour cet email — Alfredo demandera clarification.')
  }

  // Hydrater financial si autorisé
  if (coproRow && canAccessSource(syndicRole, 'syndic_impayes')) {
    const impayes = await client
      .from('syndic_impayes' as 'syndic_recouvrement')
      .select('montant, depuis, nature')
      .eq('coproprio_id', coproRow.id)
      .limit(10)
    baseContext.financial = {
      statut_paiement: (impayes.data && impayes.data.length > 0) ? 'en_retard' : 'a_jour',
      impayes: (impayes.data as Array<{ montant: number; depuis: string; nature: string }>) ?? [],
      derniers_appels: [],
    }
  }

  // Filtrage final via la policy (defense in depth)
  return filterContextByRole(syndicRole, baseContext) as ClientContext
}

function extractTopics(emails: Array<{ subject?: string | null; type_demande?: string | null }>): string[] {
  const topics = new Set<string>()
  for (const e of emails.slice(0, 10)) {
    if (e.type_demande) topics.add(e.type_demande)
  }
  return Array.from(topics).slice(0, 5)
}
```

- [ ] **Step 3 : Run + commit**

```bash
npm run test tests/lib/syndic/alfredo-load-client-context.test.ts -- --run
git add lib/syndic/alfredo-load-client-context.ts tests/lib/syndic/alfredo-load-client-context.test.ts
git commit -m "feat(alfredo): loadClientContext multi-tables + RBAC filter (Plan C Task 3)"
```

---

## Phase C.2 — Prompts Alfredo FR/PT (chunk 12 prep)

### Task 4 : Prompts Alfredo system + drafting

**Files:**
- Create: `lib/syndic/prompts/alfredo/system-prompt-fr.ts`
- Create: `lib/syndic/prompts/alfredo/system-prompt-pt.ts`
- Create: `lib/syndic/prompts/alfredo/draft-reply-prompt-fr.ts`
- Create: `lib/syndic/prompts/alfredo/draft-reply-prompt-pt.ts`

- [ ] **Step 1 : System prompt chat Alfredo FR**

```typescript
// lib/syndic/prompts/alfredo/system-prompt-fr.ts
import type { SyndicRole } from '@/lib/syndic/agent-types'

export interface AlfredoChatContext {
  role: SyndicRole
  inbox_pending_count: number
  inbox_total_count: number
  gmail_connected: boolean
}

export function buildAlfredoSystemPromptFR(ctx: AlfredoChatContext): string {
  return `Tu es Alfredo, le gestionnaire emails IA du syndic Vitfix.

GARDE DE LOCALE : Tu réponds dans le cadre **français**. Formules de politesse, mentions légales et signatures adaptées au syndic FR.

CONTEXTE ACTUEL :
- Rôle utilisateur : ${ctx.role}
- Brouillons en attente : ${ctx.inbox_pending_count}
- Emails analysés (total) : ${ctx.inbox_total_count}
- Gmail connecté : ${ctx.gmail_connected ? 'oui' : 'non'}

TES CAPACITÉS (tools) :
- search_emails(query, filters) — recherche full-text dans les emails analysés
- bulk_action(filter, action) — action en masse (ex: rédiger relances pour tous les impayés)
- summarize_inbox(period) — résumé exécutif (today / week / month)
- regenerate_draft(email_id, instructions?) — re-générer un brouillon avec consignes
- learn_from_correction — appris automatiquement quand l'utilisateur édite un brouillon

MODE OPÉRATOIRE :
1. Sois proactif — tu connais l'inbox, propose des actions concrètes.
2. Pour toute action destructive (envoi de mail), tu n'agis JAMAIS sans confirmation explicite.
3. Cite les emails par leur sujet ou date, pas par leur ID interne.
4. Si l'utilisateur te demande "où en sont mes drafts", utilise summarize_inbox.
5. Tu ne cites jamais d'email/téléphone en clair (sanitization PII active).

Réponds en français, professionnel et concis.`
}
```

- [ ] **Step 2 : System prompt chat Alfredo PT**

```typescript
// lib/syndic/prompts/alfredo/system-prompt-pt.ts
import type { AlfredoChatContext } from './system-prompt-fr'
export type { AlfredoChatContext }

export function buildAlfredoSystemPromptPT(ctx: AlfredoChatContext): string {
  return `És o Alfredo, o gestor IA de emails do síndico Vitfix.

REGRA DE LOCALE : Respondes em **português europeu**. Fórmulas de cortesia, menções legais e assinaturas adaptadas ao síndico PT.

CONTEXTO :
- Cargo utilizador : ${ctx.role}
- Rascunhos pendentes : ${ctx.inbox_pending_count}
- Emails analisados (total) : ${ctx.inbox_total_count}
- Gmail conectado : ${ctx.gmail_connected ? 'sim' : 'não'}

CAPACIDADES (tools) :
- search_emails, bulk_action, summarize_inbox, regenerate_draft, learn_from_correction (idem FR)

MODO OPERATÓRIO :
1. Sê proativo — conheces a inbox, propõe ações concretas.
2. Para qualquer ação destrutiva (envio de email), NUNCA atuas sem confirmação explícita.
3. Cita emails pelo assunto ou data, nunca pelo ID interno.
4. Se o utilizador perguntar "como vão os meus rascunhos", usa summarize_inbox.
5. Nunca cites emails/telefones em claro (sanitização PII ativa).

Responde em português europeu, profissional e conciso. Nunca brasileiro.`
}
```

- [ ] **Step 3 : Prompt drafting FR (utilisé par la pipeline auto-draft)**

```typescript
// lib/syndic/prompts/alfredo/draft-reply-prompt-fr.ts
import type { ClientContext } from '@/lib/syndic/alfredo-load-client-context'

export interface DraftPromptInput {
  email: {
    from: string
    subject: string
    body_text: string
    received_at: string
    urgence?: string
    type_demande?: string
  }
  client_context: ClientContext
  tone?: 'formel' | 'cordial' | 'ferme'
}

export function buildAlfredoDraftPromptFR(input: DraftPromptInput): string {
  const tone = input.tone ?? 'cordial'
  return `Tu es Alfredo, gestionnaire emails du syndic. Tu prépares un BROUILLON de réponse personnalisé pour un email entrant.

CONTEXTE CLIENT (déjà chargé) :
${JSON.stringify(input.client_context, null, 2)}

EMAIL ENTRANT À RÉPONDRE :
- De : ${input.email.from}
- Date : ${input.email.received_at}
- Sujet : ${input.email.subject}
- Type détecté : ${input.email.type_demande ?? 'inconnu'}
- Urgence : ${input.email.urgence ?? 'normale'}

Contenu :
"""
${input.email.body_text.slice(0, 2000)}
"""

CONSIGNES :
- Ton : ${tone}
- Cite explicitement l'historique pertinent : "suite à votre signalement du XX/XX...", "concernant votre lot...", etc.
- Si une info est manquante, demande-la — n'invente JAMAIS.
- Propose la prochaine étape concrète (visite, devis, transfert au juriste, etc.).
- Mentions légales : "Cabinet [nom], [adresse]" + opt-in opt-out conforme RGPD.

FORMAT DE SORTIE — répond UNIQUEMENT en JSON, sans texte avant ni après :
{
  "subject_suggested": "Re: ...",
  "body_text": "Madame, Monsieur,\\n\\n...\\n\\nCordialement,\\nCabinet [nom]",
  "body_html": "<p>Madame, Monsieur,</p><p>...</p><p>Cordialement,<br>Cabinet [nom]</p>",
  "confidence": 0.0 à 1.0,
  "missing_info": ["..." si information manquante],
  "suggested_next_actions": [
    { "tool": "create_mission", "args": { "titre": "...", "immeuble_id": "..." } }
  ]
}`
}
```

- [ ] **Step 4 : Prompt drafting PT**

```typescript
// lib/syndic/prompts/alfredo/draft-reply-prompt-pt.ts
import type { DraftPromptInput } from './draft-reply-prompt-fr'
export type { DraftPromptInput }

export function buildAlfredoDraftPromptPT(input: DraftPromptInput): string {
  const tone = input.tone ?? 'cordial'
  return `És o Alfredo, gestor de emails do síndico. Preparas um RASCUNHO de resposta personalizado para um email recebido.

CONTEXTO CLIENTE (já carregado) :
${JSON.stringify(input.client_context, null, 2)}

EMAIL A RESPONDER :
- De : ${input.email.from}
- Data : ${input.email.received_at}
- Assunto : ${input.email.subject}
- Tipo detectado : ${input.email.type_demande ?? 'desconhecido'}
- Urgência : ${input.email.urgence ?? 'normal'}

Conteúdo :
"""
${input.email.body_text.slice(0, 2000)}
"""

INSTRUÇÕES :
- Tom : ${tone}
- Cita explicitamente o histórico relevante : "na sequência da sua ocorrência de XX/XX...", "relativamente ao seu lote...".
- Se faltar informação, pede — NUNCA inventes.
- Propõe o próximo passo concreto (visita, orçamento, transferir ao jurídico, etc.).
- Menções legais : "Síndico [nome], [morada]" + opt-in opt-out conforme RGPD/Lei 58/2019.

FORMATO DE SAÍDA — responde APENAS em JSON, sem texto antes nem depois :
{
  "subject_suggested": "Re: ...",
  "body_text": "Exmo(a). Senhor(a),\\n\\n...\\n\\nAtenciosamente,\\nSíndico [nome]",
  "body_html": "<p>Exmo(a). Senhor(a),</p><p>...</p><p>Atenciosamente,<br>Síndico [nome]</p>",
  "confidence": 0.0 a 1.0,
  "missing_info": ["..." se faltar informação],
  "suggested_next_actions": [
    { "tool": "create_mission", "args": { "titre": "...", "immeuble_id": "..." } }
  ]
}

Português europeu obrigatório. Nunca brasileiro.`
}
```

- [ ] **Step 5 : Commit**

```bash
git add lib/syndic/prompts/alfredo/
git commit -m "feat(alfredo): prompts FR/PT chat + drafting reply (Plan C Task 4)"
```

---

## Phase C.3 — Pipeline auto-draft (chunk 10)

### Task 5 : `lib/syndic/alfredo-pipeline.ts`

**Files:**
- Create: `lib/syndic/alfredo-pipeline.ts`
- Create: `tests/lib/syndic/alfredo-pipeline.test.ts`

- [ ] **Step 1 : Test**

```typescript
// tests/lib/syndic/alfredo-pipeline.test.ts
import { describe, it, expect, vi } from 'vitest'
import { processIncomingEmail } from '@/lib/syndic/alfredo-pipeline'

describe('processIncomingEmail (alfredo pipeline)', () => {
  it('orchestre classify → load_context → draft → insert', async () => {
    const classifyMock = vi.fn().mockResolvedValue({
      urgence: 'normale',
      type_demande: 'sinistre',
      resume_court: 'Fuite d\'eau salle de bain',
      immeuble_detecte: 'Résidence Belle Vue',
    })
    const loadContextMock = vi.fn().mockResolvedValue({
      client_token: 'ct_abc',
      copro_status: 'identified',
      history_summary: { total_emails: 5, last_topics: [], sentiment_drift: 'neutre', last_resolved_topics: [] },
      recent_interactions: [],
      open_items: { missions: [], devis_en_cours: [], sinistres: [], signalements: [] },
      missing_info_hints: [],
      rbac_omitted_fields: [],
    })
    const draftMock = vi.fn().mockResolvedValue({
      subject_suggested: 'Re: Fuite',
      body_text: 'Madame, ...',
      body_html: '<p>Madame, ...</p>',
      confidence: 0.85,
      missing_info: [],
      suggested_next_actions: [],
    })
    const insertMock = vi.fn().mockResolvedValue({ data: { id: 'email-id' }, error: null })

    const result = await processIncomingEmail({
      syndicId: 's1',
      syndicRole: 'syndic_admin',
      locale: 'fr',
      email: {
        from: 'marie@gmail.com',
        subject: 'Fuite eau',
        body_text: 'Bonjour, il y a une fuite...',
        gmail_message_id: 'gm_001',
        received_at: '2026-05-13T10:00:00Z',
      },
      classifyFn: classifyMock,
      loadContextFn: loadContextMock,
      draftFn: draftMock,
      insertFn: insertMock,
    })

    expect(classifyMock).toHaveBeenCalled()
    expect(loadContextMock).toHaveBeenCalledWith(expect.objectContaining({ emailAddress: 'marie@gmail.com' }))
    expect(draftMock).toHaveBeenCalled()
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      draft_status: 'pending_review',
      draft_subject: 'Re: Fuite',
    }))
    expect(result.status).toBe('drafted')
  })

  it('skip draft si classifier retourne spam', async () => {
    const classifyMock = vi.fn().mockResolvedValue({
      urgence: 'normale',
      type_demande: 'spam',
      resume_court: '',
    })
    const insertMock = vi.fn().mockResolvedValue({ data: { id: 'e' }, error: null })

    const result = await processIncomingEmail({
      syndicId: 's1',
      syndicRole: 'syndic_admin',
      locale: 'fr',
      email: { from: 'spam@x.com', subject: 'Win', body_text: '...', gmail_message_id: 'gm_002', received_at: '2026-05-13T10:00:00Z' },
      classifyFn: classifyMock,
      loadContextFn: vi.fn(),
      draftFn: vi.fn(),
      insertFn: insertMock,
    })

    expect(result.status).toBe('skipped_spam')
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      draft_status: 'none',
    }))
  })

  it('marque draft_status=generating pendant le draft, puis pending_review au succès', async () => {
    // Test plus complexe que je documente comme à valider en E2E réel
  })
})
```

- [ ] **Step 2 : Implémenter**

```typescript
// lib/syndic/alfredo-pipeline.ts
import type { SyndicRole, Locale } from './agent-types'
import type { ClientContext } from './alfredo-load-client-context'

interface IncomingEmail {
  from: string
  subject: string
  body_text: string
  body_html?: string
  gmail_message_id: string
  received_at: string
}

interface ClassifyResult {
  urgence: string
  type_demande: string
  resume_court: string
  immeuble_detecte?: string
  locataire_detecte?: string
}

interface DraftResult {
  subject_suggested: string
  body_text: string
  body_html: string
  confidence: number
  missing_info: string[]
  suggested_next_actions: Array<{ tool: string; args: Record<string, unknown> }>
}

export interface ProcessEmailParams {
  syndicId: string
  syndicRole: SyndicRole
  locale: Locale
  email: IncomingEmail
  classifyFn: (email: IncomingEmail, locale: Locale) => Promise<ClassifyResult>
  loadContextFn: (params: { syndicId: string; syndicRole: SyndicRole; emailAddress: string; locale: Locale }) => Promise<ClientContext>
  draftFn: (input: { email: IncomingEmail; client_context: ClientContext; classify: ClassifyResult; locale: Locale }) => Promise<DraftResult>
  insertFn: (row: Record<string, unknown>) => Promise<{ data: { id: string } | null; error: unknown }>
}

export interface ProcessEmailResult {
  status: 'drafted' | 'skipped_spam' | 'error'
  email_id?: string
  draft_confidence?: number
  error?: string
}

export async function processIncomingEmail(params: ProcessEmailParams): Promise<ProcessEmailResult> {
  const { syndicId, syndicRole, locale, email } = params

  try {
    // 1. Classification
    const classify = await params.classifyFn(email, locale)

    // 2. Spam → skip drafting, insert avec draft_status=none
    if (classify.type_demande === 'spam') {
      const { data } = await params.insertFn({
        syndic_id: syndicId,
        from_email: email.from,
        subject: email.subject,
        body_preview: email.body_text.slice(0, 1000),
        gmail_message_id: email.gmail_message_id,
        received_at: email.received_at,
        type_demande: 'spam',
        urgence: classify.urgence,
        resume_court: classify.resume_court,
        draft_status: 'none',
      })
      return { status: 'skipped_spam', email_id: data?.id }
    }

    // 3. Charger contexte client
    const clientContext = await params.loadContextFn({
      syndicId,
      syndicRole,
      emailAddress: email.from,
      locale,
    })

    // 4. Générer brouillon
    const draft = await params.draftFn({
      email,
      client_context: clientContext,
      classify,
      locale,
    })

    // 5. Insert avec draft pending_review
    const { data, error } = await params.insertFn({
      syndic_id: syndicId,
      from_email: email.from,
      subject: email.subject,
      body_preview: email.body_text.slice(0, 1000),
      gmail_message_id: email.gmail_message_id,
      received_at: email.received_at,
      type_demande: classify.type_demande,
      urgence: classify.urgence,
      resume_court: classify.resume_court,
      immeuble_detecte: classify.immeuble_detecte ?? null,
      locataire_detecte: classify.locataire_detecte ?? null,
      draft_subject: draft.subject_suggested,
      draft_body_text: draft.body_text,
      draft_body_html: draft.body_html,
      draft_status: 'pending_review',
      draft_generated_at: new Date().toISOString(),
      draft_meta: {
        confidence: draft.confidence,
        missing_info: draft.missing_info,
        suggested_next_actions: draft.suggested_next_actions,
        client_token: clientContext.client_token,
        rbac_omitted_fields: clientContext.rbac_omitted_fields,
      },
    })

    if (error) {
      return { status: 'error', error: String(error) }
    }

    return {
      status: 'drafted',
      email_id: data?.id,
      draft_confidence: draft.confidence,
    }
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : 'unknown' }
  }
}
```

- [ ] **Step 3 : Run + commit**

```bash
npm run test tests/lib/syndic/alfredo-pipeline.test.ts -- --run
git add lib/syndic/alfredo-pipeline.ts tests/lib/syndic/alfredo-pipeline.test.ts
git commit -m "feat(alfredo): pipeline classify→context→draft→insert (Plan C Task 5)"
```

### Task 6 : Intégrer pipeline dans `poll/route.ts`

**Files:**
- Modify: `app/api/email-agent/poll/route.ts`

- [ ] **Step 1 : Localiser le bloc qui classifie + insère les emails actuellement**

```bash
grep -n "classify\|syndic_emails_analysed\.insert\|syndic_emails_analysed\.upsert" app/api/email-agent/poll/route.ts | head -10
```

- [ ] **Step 2 : Remplacer par appel à processIncomingEmail**

Pour chaque email récupéré de Gmail, remplacer le bloc `classify + insert` par :

```typescript
import { processIncomingEmail } from '@/lib/syndic/alfredo-pipeline'
import { loadClientContext } from '@/lib/syndic/alfredo-load-client-context'
import { classifyEmailWithGroq } from '@/lib/syndic/alfredo-classify' // fonction extraite de la classify route existante
import { generateDraftReply } from '@/lib/syndic/alfredo-draft' // nouvelle fonction utilisant les prompts FR/PT
import { sanitizeContextForLLM, resolveSanitizedToken } from '@/lib/ai/sanitize-context'

// Pour chaque email :
const result = await processIncomingEmail({
  syndicId,
  syndicRole: userRole,
  locale,
  email: {
    from: gmailMessage.from,
    subject: gmailMessage.subject,
    body_text: gmailMessage.body_text,
    body_html: gmailMessage.body_html,
    gmail_message_id: gmailMessage.id,
    received_at: gmailMessage.date,
  },
  classifyFn: (e, loc) => classifyEmailWithGroq(e, loc),
  loadContextFn: (p) => loadClientContext(supabase, p),
  draftFn: async (input) => {
    // Sanitize before sending to Groq
    const { sanitized, tokenMap } = sanitizeContextForLLM(input.client_context)
    const raw = await generateDraftReply({ ...input, client_context: sanitized }, locale)
    // Resolve tokens in draft output
    return {
      ...raw,
      subject_suggested: resolveSanitizedToken(raw.subject_suggested, tokenMap) ?? raw.subject_suggested,
      body_text: resolveSanitizedToken(raw.body_text, tokenMap) ?? raw.body_text,
      body_html: resolveSanitizedToken(raw.body_html, tokenMap) ?? raw.body_html,
    }
  },
  insertFn: async (row) => {
    const res = await supabase.from('syndic_emails_analysed').upsert(row, { onConflict: 'syndic_id,gmail_message_id' }).select().single()
    return { data: res.data ? { id: res.data.id } : null, error: res.error }
  },
})
```

- [ ] **Step 3 : Extraire `classifyEmailWithGroq` du route classify existante**

Crée `lib/syndic/alfredo-classify.ts` qui réutilise la logique du fichier `app/api/email-agent/classify/route.ts` mais en tant que fonction réutilisable (l'API route originale peut garder un wrapper qui appelle cette fonction).

- [ ] **Step 4 : Créer `lib/syndic/alfredo-draft.ts`**

```typescript
// lib/syndic/alfredo-draft.ts
import { buildAlfredoDraftPromptFR } from './prompts/alfredo/draft-reply-prompt-fr'
import { buildAlfredoDraftPromptPT } from './prompts/alfredo/draft-reply-prompt-pt'
import { callGroq } from '@/lib/groq'
import type { Locale } from './agent-types'
import type { DraftPromptInput } from './prompts/alfredo/draft-reply-prompt-fr'

export async function generateDraftReply(
  input: DraftPromptInput,
  locale: Locale,
): Promise<{
  subject_suggested: string
  body_text: string
  body_html: string
  confidence: number
  missing_info: string[]
  suggested_next_actions: Array<{ tool: string; args: Record<string, unknown> }>
}> {
  const prompt = locale === 'pt'
    ? buildAlfredoDraftPromptPT(input)
    : buildAlfredoDraftPromptFR(input)

  const response = await callGroq({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  })

  // Le LLM doit retourner un JSON strict
  try {
    const parsed = JSON.parse(response.content)
    return {
      subject_suggested: String(parsed.subject_suggested ?? ''),
      body_text: String(parsed.body_text ?? ''),
      body_html: String(parsed.body_html ?? ''),
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      missing_info: Array.isArray(parsed.missing_info) ? parsed.missing_info : [],
      suggested_next_actions: Array.isArray(parsed.suggested_next_actions) ? parsed.suggested_next_actions : [],
    }
  } catch {
    return {
      subject_suggested: '',
      body_text: '',
      body_html: '',
      confidence: 0,
      missing_info: ['parsing_error'],
      suggested_next_actions: [],
    }
  }
}
```

- [ ] **Step 5 : Commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "alfredo|poll/route" | head -5
git add app/api/email-agent/poll/route.ts lib/syndic/alfredo-classify.ts lib/syndic/alfredo-draft.ts
git commit -m "feat(alfredo): poll utilise pipeline auto-draft (Plan C Task 6)"
```

### Task 7 : Endpoint webhook Gmail Pub/Sub

**Files:**
- Create: `app/api/email-agent/webhook/route.ts`
- Create: `tests/api/email-agent-webhook.test.ts`

- [ ] **Step 1 : Implémenter le handler webhook**

```typescript
// app/api/email-agent/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

interface GmailPubSubMessage {
  message: {
    data: string  // base64
    messageId: string
    publishTime: string
  }
  subscription: string
}

interface GmailPushPayload {
  emailAddress: string
  historyId: string
}

// Sécurité : ce webhook doit être protégé par un secret partagé Pub/Sub → Worker
const WEBHOOK_TOKEN_HEADER = 'x-gmail-webhook-token'

export async function POST(req: NextRequest) {
  // Vérifier le token de sécurité partagé (configuré dans Cloud Pub/Sub > push attributes)
  const token = req.headers.get(WEBHOOK_TOKEN_HEADER)
  if (token !== process.env.GMAIL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null) as GmailPubSubMessage | null
  if (!body?.message?.data) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  let payload: GmailPushPayload
  try {
    const decoded = Buffer.from(body.message.data, 'base64').toString('utf-8')
    payload = JSON.parse(decoded)
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  }

  if (!payload.emailAddress) {
    return NextResponse.json({ error: 'missing_email' }, { status: 400 })
  }

  // Trouver le syndic correspondant à cet email
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: token_row } = await supabaseAdmin
    .from('syndic_oauth_tokens')
    .select('syndic_id, email_compte')
    .eq('email_compte', payload.emailAddress)
    .single()

  if (!token_row) {
    logger.warn('webhook: no syndic for email', { email: payload.emailAddress })
    return NextResponse.json({ status: 'ignored', reason: 'no_syndic' })
  }

  // Déclencher poll ciblé en background (sans bloquer le webhook qui doit ack rapidement)
  fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/email-agent/poll`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-trigger': process.env.INTERNAL_POLL_TOKEN ?? '',
    },
    body: JSON.stringify({ syndic_id: token_row.syndic_id, history_id: payload.historyId }),
  }).catch(err => logger.error('webhook: trigger poll failed', { error: String(err) }))

  return NextResponse.json({ status: 'queued', syndic_id: token_row.syndic_id })
}
```

- [ ] **Step 2 : Tests**

```typescript
// tests/api/email-agent-webhook.test.ts
import { describe, it, expect } from 'vitest'

describe('/api/email-agent/webhook', () => {
  it('module loads', async () => {
    const mod = await import('@/app/api/email-agent/webhook/route')
    expect(typeof mod.POST).toBe('function')
  })

  it.todo('rejette si x-gmail-webhook-token absent → 401')
  it.todo('rejette si body.message.data invalide → 400')
  it.todo('retourne ignored si aucun syndic pour cet email')
  it.todo('déclenche poll si syndic trouvé')
})
```

- [ ] **Step 3 : Commit**

```bash
git add app/api/email-agent/webhook/route.ts tests/api/email-agent-webhook.test.ts
git commit -m "feat(alfredo): webhook Gmail Pub/Sub (Plan C Task 7)"
```

---

## Phase C.4 — Wrapper chat Alfredo (chunk 12)

### Task 8 : `app/api/syndic/alfredo-chat/route.ts`

**Files:**
- Create: `app/api/syndic/alfredo-chat/route.ts`
- Create: `tests/api/syndic-alfredo-chat.test.ts`

- [ ] **Step 1 : Implémenter le wrapper conversationnel (similaire à fixy-syndic)**

```typescript
// app/api/syndic/alfredo-chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { callGroq } from '@/lib/groq'
import { buildAlfredoSystemPromptFR } from '@/lib/syndic/prompts/alfredo/system-prompt-fr'
import { buildAlfredoSystemPromptPT } from '@/lib/syndic/prompts/alfredo/system-prompt-pt'
import { sanitizeContextForLLM, resolveSanitizedToken } from '@/lib/ai/sanitize-context'

const BodySchema = z.object({
  conversation_id: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system', 'tool']),
    content: z.string(),
  })).max(60).optional(),
  locale: z.enum(['fr', 'pt']).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const allowed = await checkRateLimit(`alfredo-chat:${ip}`, 30, 60_000)
  if (!allowed) return rateLimitResponse()

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isSyndicRole(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.issues }, { status: 400 })
  }

  const locale = parsed.data.locale ?? 'fr'

  // Charger contexte Alfredo (inbox stats)
  const { data: countsData } = await supabase
    .from('syndic_emails_analysed')
    .select('draft_status', { count: 'exact', head: false })
    .eq('syndic_id', user.id)

  const counts = (countsData ?? []) as Array<{ draft_status: string }>
  const pending = counts.filter(c => c.draft_status === 'pending_review').length

  const { data: gmailToken } = await supabase
    .from('syndic_oauth_tokens')
    .select('syndic_id')
    .eq('syndic_id', user.id)
    .maybeSingle()

  const promptCtx = {
    role: (user.user_metadata?.role as 'syndic') ?? 'syndic',
    inbox_pending_count: pending,
    inbox_total_count: counts.length,
    gmail_connected: !!gmailToken,
  }

  const { sanitized: sanitizedCtx, tokenMap } = sanitizeContextForLLM(promptCtx)
  const systemPrompt = locale === 'pt'
    ? buildAlfredoSystemPromptPT(sanitizedCtx)
    : buildAlfredoSystemPromptFR(sanitizedCtx)

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...(parsed.data.history ?? []),
    { role: 'user' as const, content: parsed.data.message },
  ]

  try {
    const groqResponse = await callGroq({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.4,
      max_tokens: 1500,
    })
    const resolvedContent = resolveSanitizedToken(groqResponse.content, tokenMap) ?? groqResponse.content
    return NextResponse.json({ content: resolvedContent })
  } catch (err) {
    logger.error('alfredo-chat groq error', { error: err instanceof Error ? err.message : String(err), user_id: user.id })
    return NextResponse.json({ error: 'agent_error' }, { status: 502 })
  }
}
```

- [ ] **Step 2 : Tests minimal**

```typescript
// tests/api/syndic-alfredo-chat.test.ts
import { describe, it, expect } from 'vitest'

describe('/api/syndic/alfredo-chat', () => {
  it('module loads', async () => {
    const mod = await import('@/app/api/syndic/alfredo-chat/route')
    expect(typeof mod.POST).toBe('function')
  })
})
```

- [ ] **Step 3 : Commit**

```bash
npx tsc --noEmit 2>&1 | grep "alfredo-chat" | head -5
npm run test tests/api/syndic-alfredo-chat.test.ts -- --run
git add app/api/syndic/alfredo-chat/route.ts tests/api/syndic-alfredo-chat.test.ts
git commit -m "feat(alfredo): wrapper chat conversationnel /alfredo-chat (Plan C Task 8)"
```

### Task 9 : Populer `AGENT_CONFIGS.alfredo` complet

**Files:**
- Modify: `components/syndic-dashboard/agents-ia/configs.ts`

- [ ] **Step 1 : Remplacer le placeholder Alfredo**

Localise dans `configs.ts` l'entry `alfredo` (placeholder Plan A). Remplace par :

```typescript
alfredo: {
  id: 'alfredo',
  displayName: { fr: 'Alfredo', pt: 'Alfredo' },
  tagline: {
    fr: 'Gestionnaire emails IA — scanne, analyse, propose des brouillons',
    pt: 'Gestor emails IA — scaneia, analisa, sugere rascunhos',
  },
  avatarEmoji: '📧',
  accentColor: 'rose',
  endpoint: '/api/syndic/alfredo-chat',
  streaming: false,
  voice: true,
  fileUpload: { accept: '.eml,.pdf,image/*', maxSizeMB: 10 },
  suggestedPrompts: {
    fr: [
      'Résume mon inbox du jour',
      'Rédige une relance amiable pour tous les impayés > 3 mois',
      'Cherche les emails de Mme Dupont sur la fuite',
    ],
    pt: [
      'Resume a minha inbox de hoje',
      'Redige um lembrete amigável para todas as quotas em atraso > 3 meses',
      'Procura os emails da Sra. Costa sobre a infiltração',
    ],
  },
  toolDescriptors: [
    {
      name: 'search_emails',
      label: { fr: 'Rechercher emails', pt: 'Pesquisar emails' },
      description: { fr: 'Recherche full-text dans la boîte de réception.', pt: 'Pesquisa full-text na caixa de entrada.' },
      requiresConfirmation: false,
      allowedRoles: ['syndic', 'syndic_admin', 'syndic_tech', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_comptable', 'syndic_juriste'],
    },
    {
      name: 'bulk_action',
      label: { fr: 'Action en masse', pt: 'Ação em massa' },
      description: { fr: 'Génère plusieurs brouillons ou archive en masse.', pt: 'Gera vários rascunhos ou arquiva em massa.' },
      requiresConfirmation: true,
      allowedRoles: ['syndic', 'syndic_admin', 'syndic_gestionnaire', 'syndic_comptable', 'syndic_juriste'],
    },
    {
      name: 'summarize_inbox',
      label: { fr: 'Résumer inbox', pt: 'Resumir inbox' },
      description: { fr: 'Vue exécutive des emails reçus + actions prises sur la période.', pt: 'Vista executiva dos emails recebidos + ações tomadas no período.' },
      requiresConfirmation: false,
      allowedRoles: ['syndic', 'syndic_admin', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_comptable', 'syndic_juriste'],
    },
    {
      name: 'regenerate_draft',
      label: { fr: 'Re-générer brouillon', pt: 'Re-gerar rascunho' },
      description: { fr: 'Génère un nouveau brouillon avec consignes spécifiques.', pt: 'Gera um novo rascunho com instruções específicas.' },
      requiresConfirmation: false,
      allowedRoles: ['syndic', 'syndic_admin', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_comptable', 'syndic_juriste'],
    },
    {
      name: 'send_response',
      label: { fr: 'Envoyer réponse', pt: 'Enviar resposta' },
      description: { fr: 'Envoie le brouillon validé via Gmail API.', pt: 'Envia o rascunho validado via Gmail API.' },
      requiresConfirmation: true,
      allowedRoles: ['syndic', 'syndic_admin', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_comptable', 'syndic_juriste'],
    },
  ],
  allowedRoles: ['syndic', 'syndic_admin', 'syndic_tech', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_comptable', 'syndic_juriste'],
  crossAgentReferrals: ['fixy', 'max', 'lea'],
},
```

- [ ] **Step 2 : Commit**

```bash
npx tsc --noEmit 2>&1 | grep "configs.ts" | head -5
git add components/syndic-dashboard/agents-ia/configs.ts
git commit -m "feat(alfredo): AGENT_CONFIGS Alfredo complet (Plan C Task 9)"
```

---

## Phase C.5 — UI Alfredo (chunk 11)

### Task 10 : Hook `useAlfredoDrafts`

**Files:**
- Create: `components/syndic-dashboard/agents-ia/hooks/useAlfredoDrafts.ts`
- Create: `app/api/email-agent/drafts/route.ts` (REST endpoint pour lister/update les drafts)

- [ ] **Step 1 : API REST drafts**

```typescript
// app/api/email-agent/drafts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { isSyndicRole } from '@/lib/auth-helpers'

const ListQuerySchema = z.object({
  status: z.enum(['pending_review', 'approved', 'sent', 'edited_sent', 'skipped', 'expired']).optional(),
  limit: z.number().int().min(1).max(100).default(50),
})

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isSyndicRole(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const status = req.nextUrl.searchParams.get('status') ?? 'pending_review'
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10), 100)

  const { data, error } = await supabase
    .from('syndic_emails_analysed')
    .select('id, from_email, subject, body_preview, received_at, urgence, type_demande, draft_subject, draft_body_text, draft_body_html, draft_status, draft_meta, draft_generated_at')
    .eq('syndic_id', user.id)
    .eq('draft_status', status)
    .order('draft_generated_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ drafts: data ?? [] })
}
```

Pour `PATCH /api/email-agent/drafts/[id]` (update status + edit content) :

```typescript
// app/api/email-agent/drafts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { isSyndicRole } from '@/lib/auth-helpers'

const PatchSchema = z.object({
  draft_status: z.enum(['approved', 'sent', 'edited_sent', 'skipped']).optional(),
  draft_subject: z.string().min(1).max(500).optional(),
  draft_body_text: z.string().max(50000).optional(),
  draft_body_html: z.string().max(100000).optional(),
})

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isSyndicRole(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })

  const updates: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.draft_status) {
    updates.draft_reviewed_at = new Date().toISOString()
    updates.draft_reviewed_by = user.id
  }

  const { data, error } = await supabase
    .from('syndic_emails_analysed')
    .update(updates)
    .eq('id', id)
    .eq('syndic_id', user.id)  // defense in depth
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ draft: data })
}
```

- [ ] **Step 2 : Hook `useAlfredoDrafts`**

```typescript
// components/syndic-dashboard/agents-ia/hooks/useAlfredoDrafts.ts
import { useCallback, useEffect, useState } from 'react'

export interface AlfredoDraft {
  id: string
  from_email: string
  subject: string
  body_preview: string
  received_at: string
  urgence?: string
  type_demande?: string
  draft_subject: string | null
  draft_body_text: string | null
  draft_body_html: string | null
  draft_status: 'pending_review' | 'approved' | 'sent' | 'edited_sent' | 'skipped' | 'expired'
  draft_meta: Record<string, unknown> | null
  draft_generated_at: string | null
}

export function useAlfredoDrafts(status: AlfredoDraft['draft_status'] = 'pending_review') {
  const [drafts, setDrafts] = useState<AlfredoDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/email-agent/drafts?status=${status}`)
      if (!res.ok) throw new Error(`status_${res.status}`)
      const json = await res.json() as { drafts: AlfredoDraft[] }
      setDrafts(json.drafts)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { refetch() }, [refetch])

  const updateDraft = useCallback(async (id: string, patch: Partial<Pick<AlfredoDraft, 'draft_status' | 'draft_subject' | 'draft_body_text' | 'draft_body_html'>>) => {
    const res = await fetch(`/api/email-agent/drafts/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error('update_failed')
    const json = await res.json() as { draft: AlfredoDraft }
    setDrafts(prev => prev.map(d => d.id === id ? json.draft : d))
    return json.draft
  }, [])

  return { drafts, loading, error, refetch, updateDraft }
}
```

- [ ] **Step 3 : Commit**

```bash
git add app/api/email-agent/drafts/ components/syndic-dashboard/agents-ia/hooks/useAlfredoDrafts.ts
git commit -m "feat(alfredo): API REST drafts + hook useAlfredoDrafts (Plan C Task 10)"
```

### Task 11 : Hook `useAlfredoNotifications` (Supabase Realtime)

**Files:**
- Create: `components/syndic-dashboard/agents-ia/hooks/useAlfredoNotifications.ts`

- [ ] **Step 1 : Implémenter**

```typescript
// components/syndic-dashboard/agents-ia/hooks/useAlfredoNotifications.ts
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

interface NotificationEvent {
  email_id: string
  from_email: string
  subject: string
  draft_status: string
  received_at: string
}

export function useAlfredoNotifications(syndicId: string | null, onNewDraft?: (event: NotificationEvent) => void) {
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!syndicId) return

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    // Initial fetch du nombre pending
    void (async () => {
      const { count } = await supabase
        .from('syndic_emails_analysed')
        .select('*', { count: 'exact', head: true })
        .eq('syndic_id', syndicId)
        .eq('draft_status', 'pending_review')
      if (typeof count === 'number') setPendingCount(count)
    })()

    // Subscribe aux nouveaux drafts
    const channel = supabase
      .channel(`alfredo-drafts-${syndicId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'syndic_emails_analysed',
          filter: `syndic_id=eq.${syndicId}`,
        },
        (payload) => {
          const row = payload.new as { id: string; from_email: string; subject: string; draft_status: string; received_at: string }
          if (row.draft_status === 'pending_review') {
            setPendingCount(c => c + 1)
            onNewDraft?.({
              email_id: row.id,
              from_email: row.from_email,
              subject: row.subject,
              draft_status: row.draft_status,
              received_at: row.received_at,
            })
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'syndic_emails_analysed',
          filter: `syndic_id=eq.${syndicId}`,
        },
        (payload) => {
          const oldStatus = (payload.old as { draft_status?: string }).draft_status
          const newStatus = (payload.new as { draft_status?: string }).draft_status
          if (oldStatus === 'pending_review' && newStatus !== 'pending_review') {
            setPendingCount(c => Math.max(0, c - 1))
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [syndicId, onNewDraft])

  return { pendingCount }
}
```

- [ ] **Step 2 : Commit**

```bash
git add components/syndic-dashboard/agents-ia/hooks/useAlfredoNotifications.ts
git commit -m "feat(alfredo): hook useAlfredoNotifications via Supabase Realtime (Plan C Task 11)"
```

### Task 12 : Composant `AlfredoInboxView`

**Files:**
- Create: `components/syndic-dashboard/agents-ia/AlfredoInboxView.tsx`
- Create: `components/syndic-dashboard/agents-ia/AlfredoDraftEditor.tsx`

- [ ] **Step 1 : AlfredoDraftEditor (édition d'un brouillon)**

```tsx
// components/syndic-dashboard/agents-ia/AlfredoDraftEditor.tsx
'use client'

import { useState } from 'react'
import { safeMarkdownToHTML } from '@/lib/sanitize'
import type { AlfredoDraft } from './hooks/useAlfredoDrafts'

interface Props {
  draft: AlfredoDraft
  locale: 'fr' | 'pt'
  onSend: (id: string, edited: { subject: string; body_text: string }) => Promise<void>
  onSkip: (id: string) => Promise<void>
}

export default function AlfredoDraftEditor({ draft, locale, onSend, onSkip }: Props) {
  const [subject, setSubject] = useState(draft.draft_subject ?? '')
  const [bodyText, setBodyText] = useState(draft.draft_body_text ?? '')
  const [sending, setSending] = useState(false)

  const labels = locale === 'pt'
    ? { send: 'Enviar', skip: 'Ignorar', subject: 'Assunto', body: 'Mensagem', confidence: 'Confiança' }
    : { send: 'Envoyer', skip: 'Ignorer', subject: 'Objet', body: 'Message', confidence: 'Confiance' }

  const handleSend = async () => {
    setSending(true)
    try {
      await onSend(draft.id, { subject, body_text: bodyText })
    } finally {
      setSending(false)
    }
  }

  const confidence = (draft.draft_meta as { confidence?: number } | null)?.confidence ?? 0

  return (
    <div style={{ padding: 20, background: 'var(--sd-bg)', borderRadius: 12 }}>
      <div style={{ marginBottom: 12, fontSize: 13, color: 'rgba(0,0,0,0.6)' }}>
        <strong>{labels.subject} :</strong>
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          style={{ width: '100%', marginTop: 4, padding: 8, border: '1px solid var(--sd-border)', borderRadius: 6, fontSize: 14 }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <strong style={{ fontSize: 13 }}>{labels.body} :</strong>
        <textarea
          value={bodyText}
          onChange={e => setBodyText(e.target.value)}
          rows={12}
          style={{ width: '100%', marginTop: 4, padding: 10, border: '1px solid var(--sd-border)', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
        />
      </div>

      <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 12 }}>
        {labels.confidence} : {(confidence * 100).toFixed(0)}%
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={() => onSkip(draft.id)}
          style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--sd-border)', borderRadius: 8, cursor: 'pointer' }}
        >
          {labels.skip}
        </button>
        <button
          onClick={handleSend}
          disabled={sending || !subject || !bodyText}
          style={{ padding: '8px 16px', background: 'var(--sd-gold)', color: 'var(--sd-navy)', border: 0, borderRadius: 8, fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.5 : 1 }}
        >
          {sending ? '...' : labels.send}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : AlfredoInboxView (liste + détail)**

```tsx
// components/syndic-dashboard/agents-ia/AlfredoInboxView.tsx
'use client'

import { useState } from 'react'
import { useAlfredoDrafts, type AlfredoDraft } from './hooks/useAlfredoDrafts'
import AlfredoDraftEditor from './AlfredoDraftEditor'

interface Props {
  locale: 'fr' | 'pt'
}

export default function AlfredoInboxView({ locale }: Props) {
  const { drafts, loading, updateDraft } = useAlfredoDrafts('pending_review')
  const [activeId, setActiveId] = useState<string | null>(null)

  const active = drafts.find(d => d.id === activeId)
  const labels = locale === 'pt'
    ? { title: 'Inbox proativa', empty: 'Sem rascunhos pendentes', from: 'De', loading: 'A carregar...' }
    : { title: 'Inbox proactive', empty: 'Aucun brouillon en attente', from: 'De', loading: 'Chargement...' }

  const handleSend = async (id: string, edited: { subject: string; body_text: string }) => {
    const original = drafts.find(d => d.id === id)
    const status = original && (original.draft_subject !== edited.subject || original.draft_body_text !== edited.body_text)
      ? 'edited_sent'
      : 'sent'
    await updateDraft(id, {
      draft_status: status,
      draft_subject: edited.subject,
      draft_body_text: edited.body_text,
    })
    // Note : l'envoi réel via Gmail API se fait par une autre route /api/email-agent/send-response
    // déclenchée après le PATCH du statut. Cette intégration sera complétée en Plan C Task 14 (E2E).
  }

  const handleSkip = async (id: string) => {
    await updateDraft(id, { draft_status: 'skipped' })
    setActiveId(null)
  }

  if (loading) return <div style={{ padding: 24 }}>{labels.loading}</div>

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <aside style={{ width: 320, borderRight: '1px solid var(--sd-border)', overflowY: 'auto', background: 'var(--sd-bg-2)' }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--sd-border)', fontSize: 14, fontWeight: 600 }}>
          {labels.title} ({drafts.length})
        </div>
        {drafts.length === 0 ? (
          <div style={{ padding: 24, fontSize: 13, color: 'rgba(0,0,0,0.5)' }}>{labels.empty}</div>
        ) : (
          drafts.map(d => (
            <button
              key={d.id}
              onClick={() => setActiveId(d.id)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 12px',
                textAlign: 'left',
                cursor: 'pointer',
                background: activeId === d.id ? 'var(--sd-gold-dim)' : 'transparent',
                border: 0,
                borderBottom: '1px solid var(--sd-border)',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600 }}>{d.from_email}</div>
              <div style={{ fontSize: 13, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.subject}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', marginTop: 2 }}>
                {new Date(d.received_at).toLocaleDateString(locale)}
              </div>
            </button>
          ))
        )}
      </aside>

      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--sd-bg)' }}>
        {active ? (
          <div style={{ padding: 24 }}>
            <div style={{ padding: 16, marginBottom: 16, background: 'var(--sd-bg-2)', borderRadius: 12 }}>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>
                {labels.from} : <strong>{active.from_email}</strong>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{active.subject}</div>
              <div style={{ fontSize: 13, marginTop: 10, color: 'rgba(0,0,0,0.7)', whiteSpace: 'pre-wrap' }}>
                {active.body_preview}
              </div>
            </div>
            <AlfredoDraftEditor
              draft={active}
              locale={locale}
              onSend={handleSend}
              onSkip={handleSkip}
            />
          </div>
        ) : (
          <div style={{ padding: 24, color: 'rgba(0,0,0,0.5)' }}>{labels.empty}</div>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 3 : Commit**

```bash
git add components/syndic-dashboard/agents-ia/AlfredoInboxView.tsx components/syndic-dashboard/agents-ia/AlfredoDraftEditor.tsx
git commit -m "feat(alfredo): UI Inbox proactif + DraftEditor (Plan C Task 12)"
```

### Task 13 : Page wrapper AlfredoAgentPage + wiring sidebar

**Files:**
- Create: `components/syndic-dashboard/agents-ia/pages/AlfredoAgentPage.tsx`
- Modify: `app/syndic/dashboard/page.tsx` (déjà a un placeholder navItem alfredo_agent dans Plan A — l'activer)

- [ ] **Step 1 : Page wrapper avec dual mode**

```tsx
// components/syndic-dashboard/agents-ia/pages/AlfredoAgentPage.tsx
'use client'

import { useState } from 'react'
import AgentChatPage from '../AgentChatPage'
import AlfredoInboxView from '../AlfredoInboxView'
import { AGENT_CONFIGS } from '../configs'
import { useLocale } from '@/lib/i18n/context'
import type { User } from '@supabase/supabase-js'

interface UserWithProfile extends User {
  profile?: { country?: string }
}

type Mode = 'inbox' | 'chat'

export default function AlfredoAgentPage({ user }: { user: UserWithProfile }) {
  const [mode, setMode] = useState<Mode>('inbox')
  const uiLocale = useLocale()
  const locale = (uiLocale === 'pt' ? 'pt' : 'fr') as 'fr' | 'pt'

  const labels = locale === 'pt'
    ? { inbox: 'Inbox', chat: 'Conversa' }
    : { inbox: 'Inbox', chat: 'Discussion' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 4, padding: 12, borderBottom: '1px solid var(--sd-border)', background: 'var(--sd-bg-2)' }}>
        <button
          onClick={() => setMode('inbox')}
          style={{
            padding: '8px 16px', borderRadius: 8,
            background: mode === 'inbox' ? 'var(--sd-gold)' : 'transparent',
            color: mode === 'inbox' ? 'var(--sd-navy)' : 'inherit',
            border: '1px solid var(--sd-border)', cursor: 'pointer', fontWeight: 600,
          }}
        >📬 {labels.inbox}</button>
        <button
          onClick={() => setMode('chat')}
          style={{
            padding: '8px 16px', borderRadius: 8,
            background: mode === 'chat' ? 'var(--sd-gold)' : 'transparent',
            color: mode === 'chat' ? 'var(--sd-navy)' : 'inherit',
            border: '1px solid var(--sd-border)', cursor: 'pointer', fontWeight: 600,
          }}
        >💬 {labels.chat}</button>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {mode === 'inbox'
          ? <AlfredoInboxView locale={locale} />
          : <AgentChatPage agentConfig={AGENT_CONFIGS.alfredo} user={user} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Activer le navItem dans `app/syndic/dashboard/page.tsx`**

Localiser :
```bash
grep -n "alfredo_agent\|AlfredoAgentPage" app/syndic/dashboard/page.tsx
```

Si le navItem est commenté ou absent, ajouter :
```tsx
const AlfredoAgentPage = d(() => import('@/components/syndic-dashboard/agents-ia/pages/AlfredoAgentPage'))

// Dans allNavItems (zone agents_ia) :
{ id: 'alfredo_agent', emoji: '📧', label: 'Alfredo', category: 'agents_ia' },

// Dans le switch de rendu :
{page === 'alfredo_agent' && user && <AlfredoAgentPage user={user} />}
```

- [ ] **Step 3 : Commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "AlfredoAgentPage|dashboard/page" | head -5
git add components/syndic-dashboard/agents-ia/pages/AlfredoAgentPage.tsx app/syndic/dashboard/page.tsx
git commit -m "feat(alfredo): page wrapper dual mode + wiring sidebar (Plan C Task 13)"
```

---

## Phase C.6 — Tests E2E + cron renouvellement

### Task 14 : Tests E2E parcours Alfredo

**Files:**
- Modify: `e2e/syndic-agents-ia.spec.ts`

- [ ] **Step 1 : Ajouter scénarios Alfredo**

```typescript
// Append à e2e/syndic-agents-ia.spec.ts

test.describe('Alfredo proactive (Plan C)', () => {
  test.skip(!SHOULD_RUN, 'Requires Plan C deployed + Gmail connected test account')

  test('Alfredo sidebar item visible avec badge pending count', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin')
    await expect(page.getByRole('button', { name: /Alfredo/i })).toBeVisible()
  })

  test('click Alfredo ouvre mode Inbox par défaut', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin')
    await page.getByRole('button', { name: /Alfredo/i }).click()
    await expect(page.getByRole('button', { name: /^📬 Inbox$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^💬 (Discussion|Conversa)$/i })).toBeVisible()
  })

  test('toggle vers mode Discussion ouvre le chat', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin')
    await page.getByRole('button', { name: /Alfredo/i }).click()
    await page.getByRole('button', { name: /Discussion|Conversa/i }).click()
    await expect(page.getByPlaceholder(/Tape ou parle|Escreva ou fale/i)).toBeVisible()
  })
})
```

- [ ] **Step 2 : Commit**

```bash
git add e2e/syndic-agents-ia.spec.ts
git commit -m "test(alfredo): E2E parcours Inbox proactif + chat (Plan C Task 14)"
```

### Task 15 : Script cron renouvellement Gmail watch

**Files:**
- Create: `scripts/renew-gmail-watches.ts`

- [ ] **Step 1 : Script de renouvellement**

```typescript
// scripts/renew-gmail-watches.ts
// ──────────────────────────────────────────────────────────────────────────────
// À exécuter quotidiennement (cron Cloudflare ou GitHub Actions).
// Renouvelle les Gmail watches qui expirent dans < 24h.
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { getDecryptedToken } from '../lib/oauth/tokens'

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const dayFromNow = new Date(Date.now() + 24 * 3600 * 1000).toISOString()

  const { data: expiring } = await supabase
    .from('syndic_oauth_tokens')
    .select('syndic_id, email_compte, watch_expiry')
    .lt('watch_expiry', dayFromNow)
    .not('access_token_enc', 'is', null)

  console.log(`[renew-watches] ${expiring?.length ?? 0} watches à renouveler`)

  for (const row of (expiring ?? [])) {
    try {
      const token = await getDecryptedToken(supabase, row.syndic_id)
      if (!token) continue

      const watchRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${token.access_token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          topicName: `projects/${process.env.GCP_PROJECT_ID}/topics/${process.env.GMAIL_PUSH_TOPIC}`,
          labelIds: ['INBOX'],
        }),
      })

      if (!watchRes.ok) {
        console.error(`[renew] ✗ ${row.syndic_id.slice(0, 8)}: ${watchRes.status}`)
        continue
      }

      const { historyId, expiration } = await watchRes.json() as { historyId: string; expiration: string }
      await supabase
        .from('syndic_oauth_tokens')
        .update({ watch_expiry: new Date(Number(expiration)).toISOString() })
        .eq('syndic_id', row.syndic_id)
      console.log(`[renew] ✓ ${row.syndic_id.slice(0, 8)} → expires ${expiration}`)
    } catch (err) {
      console.error(`[renew] ✗ ${row.syndic_id.slice(0, 8)}:`, err instanceof Error ? err.message : err)
    }
  }
}

main().catch(err => {
  console.error('[renew] FATAL:', err)
  process.exit(1)
})
```

- [ ] **Step 2 : Commit**

```bash
git add scripts/renew-gmail-watches.ts
git commit -m "feat(alfredo): script cron renouvellement Gmail watches (Plan C Task 15)"
```

---

## Self-Review checklist (Plan C)

- [ ] **Chunk 8** : Task 1 — migration drafts (8 colonnes, 2 indexes, FK)
- [ ] **Chunk 9** : Tasks 2-3 — data access policy + loadClientContext
- [ ] **Chunk 10** : Tasks 5-7 — pipeline + intégration poll + webhook Pub/Sub
- [ ] **Chunk 11** : Tasks 10-13 — UI Inbox dual mode + notif Realtime + sidebar
- [ ] **Chunk 12** : Tasks 4 + 8 + 9 — prompts FR/PT + endpoint chat + configs
- [ ] Tasks 14-15 — E2E + cron renew
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run test` : tous verts (suites précédentes + nouveaux tests Plan C)

## Hors scope rappel

- Suppression FixyPanel legacy → Plan D
- Drop colonnes plain OAuth → Plan D
- Langfuse instrumentation → Plan D
- Corpus juridique Max → Plan E (post-MVP)

## Dépendances déploiement

1. Migration agents_ia_foundation (Plan A) appliquée
2. Migration encrypt_oauth_tokens (Plan B) appliquée + backfill terminé
3. Migration alfredo_drafts (Plan C Task 1) à appliquer
4. Secret `GMAIL_WEBHOOK_SECRET` configuré (Wrangler)
5. Secret `INTERNAL_POLL_TOKEN` configuré (pour trigger interne webhook → poll)
6. GCP Pub/Sub topic créé + abonnement push vers `/api/email-agent/webhook`
7. Cron Cloudflare ou GitHub Actions pour `scripts/renew-gmail-watches.ts` quotidien

## Prochaine étape

Plan D (Polish & ship) — cleanup, Langfuse, drop legacy.
