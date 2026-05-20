# Alfredo Lot 5 — Refonte design UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre la page Alfredo côté Syndic en deux états : un état vide accueillant style Léa (mascotte + statut + prompts suggérés + CTA Connecter Gmail) et un état chargé style SOTA Superhuman 3 zones (drafts list / éditeur / sidebar chat collapsible), responsive mobile, en consolidant les deux entrées dashboard (`emails` et `alfredo_agent`) sur une seule page.

**Architecture:**
1. Nouvel endpoint `GET /api/email-agent/status` qui retourne `{ connected, email_compte, drafts_pending, emails_analysed }` pour piloter la bascule empty/loaded.
2. Suite de 6 composants dans `components/syndic-dashboard/agents-ia/alfredo/` (Mascot, StatusBadge, SuggestedPrompts, EmptyState, ChatSidebar, LoadedView) chacun avec un test Vitest + React Testing Library.
3. `AlfredoAgentPage` refondu en composant routeur qui choisit Empty ou Loaded selon le statut.
4. Dashboard `app/syndic/dashboard/page.tsx` modifié pour que `page === 'emails'` rende `AlfredoAgentPage` (au lieu de l'ancien `EmailsSection`). L'ancien composant reste en place mais n'est plus monté (cleanup en patch séparé, hors scope Lot 5).
5. Spec E2E Playwright `e2e/syndic-alfredo-ui.spec.ts` qui couvre les deux états.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript 5 · Vitest 4 · @testing-library/react 16 · Playwright 1.59 · Supabase SSR.

**Branche** : `feature/alfredo-lot5-design` (créée en Task 0).

**Spec amont** : [docs/superpowers/specs/2026-05-20-alfredo-pro-2026-design.md](../specs/2026-05-20-alfredo-pro-2026-design.md) §5 Lot 5.

---

## File Structure

**Créés :**
- `app/api/email-agent/status/route.ts` — endpoint GET pour piloter empty/loaded
- `components/syndic-dashboard/agents-ia/alfredo/AlfredoMascot.tsx` — avatar emoji avec glow
- `components/syndic-dashboard/agents-ia/alfredo/AlfredoStatusBadge.tsx` — badge connexion + counts
- `components/syndic-dashboard/agents-ia/alfredo/AlfredoSuggestedPrompts.tsx` — grille 8 chips
- `components/syndic-dashboard/agents-ia/alfredo/AlfredoEmptyState.tsx` — composition Léa-style
- `components/syndic-dashboard/agents-ia/alfredo/AlfredoChatSidebar.tsx` — sidebar droite collapsible
- `components/syndic-dashboard/agents-ia/alfredo/AlfredoLoadedView.tsx` — layout 3 zones responsive
- `components/syndic-dashboard/agents-ia/alfredo/useAlfredoStatus.ts` — hook qui consomme /status
- `tests/api/email-agent-status.test.ts`
- `tests/components/agents-ia/AlfredoMascot.test.tsx`
- `tests/components/agents-ia/AlfredoStatusBadge.test.tsx`
- `tests/components/agents-ia/AlfredoSuggestedPrompts.test.tsx`
- `tests/components/agents-ia/AlfredoEmptyState.test.tsx`
- `tests/components/agents-ia/AlfredoLoadedView.test.tsx`
- `tests/components/agents-ia/useAlfredoStatus.test.tsx`
- `e2e/syndic-alfredo-ui.spec.ts`

**Modifiés :**
- `components/syndic-dashboard/config.ts:51` — label `'Emails Fixy'` → `'Alfredo'`
- `components/syndic-dashboard/agents-ia/pages/AlfredoAgentPage.tsx` — bascule empty/loaded
- `app/syndic/dashboard/page.tsx:2838` — render `AlfredoAgentPage` au lieu de `EmailsSection` pour `page === 'emails'`

**Intouchés (volontairement, scope Lot 5) :**
- `components/syndic-dashboard/communication/EmailsSection.tsx` — reste dans le repo mais plus monté (cleanup en patch séparé)
- `components/syndic-dashboard/agents-ia/AlfredoInboxView.tsx` — réutilisé dans `AlfredoLoadedView` sans modif
- `components/syndic-dashboard/agents-ia/AlfredoDraftEditor.tsx` — intouché
- `components/syndic-dashboard/agents-ia/configs.ts` — `displayName.fr = 'Alfredo'` est déjà OK

---

## Task 0 : Setup branche feature

**Files:** N/A (git seulement)

- [ ] **Step 1 : Créer la branche feature**

```bash
git checkout -b feature/alfredo-lot5-design
git status
```

Expected output : `On branch feature/alfredo-lot5-design`, `nothing to commit`.

- [ ] **Step 2 : Vérifier l'état de départ (tests verts)**

```bash
npm run test -- --run --silent 2>&1 | tail -20
```

Expected : aucun test fail. Si fail préexistant, NE PAS commencer ; reporter au reviewer.

---

## Task 1 : Endpoint `GET /api/email-agent/status`

**Files:**
- Create: `app/api/email-agent/status/route.ts`
- Create: `tests/api/email-agent-status.test.ts`

- [ ] **Step 1 : Écrire le test failing**

Create `tests/api/email-agent-status.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'

describe('/api/email-agent/status', () => {
  it('module loads and exports GET', async () => {
    const mod = await import('@/app/api/email-agent/status/route')
    expect(typeof mod.GET).toBe('function')
  })
})
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

```bash
npm run test -- tests/api/email-agent-status.test.ts --run
```

Expected : `FAIL` avec `Cannot find module '@/app/api/email-agent/status/route'`.

- [ ] **Step 3 : Implémenter l'endpoint**

Create `app/api/email-agent/status/route.ts` :

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const { data: tokenRow } = await supabaseAdmin
      .from('syndic_oauth_tokens')
      .select('email_compte, token_expiry')
      .eq('syndic_id', user.id)
      .maybeSingle()

    const connected = Boolean(tokenRow?.email_compte)
    const email_compte = tokenRow?.email_compte ?? null

    if (!connected) {
      return NextResponse.json({
        connected: false,
        email_compte: null,
        drafts_pending: 0,
        emails_analysed: 0,
      })
    }

    const [{ count: draftsPending }, { count: emailsAnalysed }] = await Promise.all([
      supabaseAdmin
        .from('syndic_emails_analysed')
        .select('*', { count: 'exact', head: true })
        .eq('syndic_id', user.id)
        .eq('draft_status', 'pending_review'),
      supabaseAdmin
        .from('syndic_emails_analysed')
        .select('*', { count: 'exact', head: true })
        .eq('syndic_id', user.id),
    ])

    return NextResponse.json({
      connected: true,
      email_compte,
      drafts_pending: draftsPending ?? 0,
      emails_analysed: emailsAnalysed ?? 0,
    })
  } catch (err) {
    logger.error('email-agent status failed', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
```

- [ ] **Step 4 : Vérifier que le test passe**

```bash
npm run test -- tests/api/email-agent-status.test.ts --run
```

Expected : `PASS`.

- [ ] **Step 5 : Commit**

```bash
git add app/api/email-agent/status/route.ts tests/api/email-agent-status.test.ts
git commit -m "feat(syndic-alfredo): endpoint /api/email-agent/status pour pilotage empty/loaded"
```

---

## Task 2 : Hook `useAlfredoStatus`

**Files:**
- Create: `components/syndic-dashboard/agents-ia/alfredo/useAlfredoStatus.ts`
- Create: `tests/components/agents-ia/useAlfredoStatus.test.tsx`

- [ ] **Step 1 : Écrire le test failing**

Create `tests/components/agents-ia/useAlfredoStatus.test.tsx` :

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAlfredoStatus } from '@/components/syndic-dashboard/agents-ia/alfredo/useAlfredoStatus'

describe('useAlfredoStatus', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renvoie loading=true puis le statut quand /status répond', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        connected: true,
        email_compte: 'syndic@cabinet.fr',
        drafts_pending: 3,
        emails_analysed: 42,
      }),
    }) as unknown as typeof fetch

    const { result } = renderHook(() => useAlfredoStatus())
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.status?.connected).toBe(true)
    expect(result.current.status?.drafts_pending).toBe(3)
  })

  it('renvoie connected=false quand /status renvoie 401', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    }) as unknown as typeof fetch

    const { result } = renderHook(() => useAlfredoStatus())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.status?.connected).toBe(false)
  })
})
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

```bash
npm run test -- tests/components/agents-ia/useAlfredoStatus.test.tsx --run
```

Expected : `FAIL` (module not found).

- [ ] **Step 3 : Implémenter le hook**

Create `components/syndic-dashboard/agents-ia/alfredo/useAlfredoStatus.ts` :

```typescript
import { useCallback, useEffect, useState } from 'react'

export interface AlfredoStatus {
  connected: boolean
  email_compte: string | null
  drafts_pending: number
  emails_analysed: number
}

export function useAlfredoStatus() {
  const [status, setStatus] = useState<AlfredoStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/email-agent/status')
      if (!res.ok) {
        setStatus({ connected: false, email_compte: null, drafts_pending: 0, emails_analysed: 0 })
        setError(`status_${res.status}`)
        return
      }
      const json = (await res.json()) as AlfredoStatus
      setStatus(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown')
      setStatus({ connected: false, email_compte: null, drafts_pending: 0, emails_analysed: 0 })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { status, loading, error, refetch }
}
```

- [ ] **Step 4 : Vérifier que le test passe**

```bash
npm run test -- tests/components/agents-ia/useAlfredoStatus.test.tsx --run
```

Expected : `PASS`, 2 tests.

- [ ] **Step 5 : Commit**

```bash
git add components/syndic-dashboard/agents-ia/alfredo/useAlfredoStatus.ts \
        tests/components/agents-ia/useAlfredoStatus.test.tsx
git commit -m "feat(syndic-alfredo): hook useAlfredoStatus pour pilotage empty/loaded"
```

---

## Task 3 : Composant `AlfredoMascot`

**Files:**
- Create: `components/syndic-dashboard/agents-ia/alfredo/AlfredoMascot.tsx`
- Create: `tests/components/agents-ia/AlfredoMascot.test.tsx`

- [ ] **Step 1 : Écrire le test failing**

Create `tests/components/agents-ia/AlfredoMascot.test.tsx` :

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AlfredoMascot } from '@/components/syndic-dashboard/agents-ia/alfredo/AlfredoMascot'

describe('AlfredoMascot', () => {
  it('rend le caractère emoji 📧 par défaut avec rôle img', () => {
    render(<AlfredoMascot />)
    const img = screen.getByRole('img', { name: /alfredo/i })
    expect(img).toBeDefined()
    expect(img.textContent).toBe('📧')
  })

  it('rend la taille small (48px) quand size=sm', () => {
    render(<AlfredoMascot size="sm" />)
    const img = screen.getByRole('img', { name: /alfredo/i })
    expect(img.getAttribute('style')).toContain('48px')
  })

  it('rend la taille large (96px) quand size=lg', () => {
    render(<AlfredoMascot size="lg" />)
    const img = screen.getByRole('img', { name: /alfredo/i })
    expect(img.getAttribute('style')).toContain('96px')
  })
})
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

```bash
npm run test -- tests/components/agents-ia/AlfredoMascot.test.tsx --run
```

Expected : `FAIL` (module not found).

- [ ] **Step 3 : Implémenter le composant**

Create `components/syndic-dashboard/agents-ia/alfredo/AlfredoMascot.tsx` :

```typescript
'use client'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  glow?: boolean
}

const SIZES: Record<NonNullable<Props['size']>, number> = {
  sm: 48,
  md: 72,
  lg: 96,
}

export function AlfredoMascot({ size = 'md', glow = true }: Props) {
  const px = SIZES[size]
  return (
    <div
      role="img"
      aria-label="Alfredo"
      style={{
        width: px,
        height: px,
        fontSize: px * 0.7,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.18), rgba(244, 222, 159, 0.32))',
        boxShadow: glow ? '0 0 24px rgba(212, 175, 55, 0.35)' : 'none',
        userSelect: 'none',
      }}
    >
      📧
    </div>
  )
}
```

- [ ] **Step 4 : Vérifier que le test passe**

```bash
npm run test -- tests/components/agents-ia/AlfredoMascot.test.tsx --run
```

Expected : `PASS`, 3 tests.

- [ ] **Step 5 : Commit**

```bash
git add components/syndic-dashboard/agents-ia/alfredo/AlfredoMascot.tsx \
        tests/components/agents-ia/AlfredoMascot.test.tsx
git commit -m "feat(syndic-alfredo): composant AlfredoMascot avec 3 tailles"
```

---

## Task 4 : Composant `AlfredoStatusBadge`

**Files:**
- Create: `components/syndic-dashboard/agents-ia/alfredo/AlfredoStatusBadge.tsx`
- Create: `tests/components/agents-ia/AlfredoStatusBadge.test.tsx`

- [ ] **Step 1 : Écrire le test failing**

Create `tests/components/agents-ia/AlfredoStatusBadge.test.tsx` :

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AlfredoStatusBadge } from '@/components/syndic-dashboard/agents-ia/alfredo/AlfredoStatusBadge'

describe('AlfredoStatusBadge', () => {
  it('affiche "Boîte non connectée" quand connected=false', () => {
    render(<AlfredoStatusBadge connected={false} draftsPending={0} emailsAnalysed={0} locale="fr" />)
    expect(screen.getByText(/Boîte non connectée/i)).toBeDefined()
  })

  it('affiche "Boîte connectée · 0 email en attente" quand connecté sans drafts', () => {
    render(<AlfredoStatusBadge connected={true} draftsPending={0} emailsAnalysed={42} locale="fr" />)
    expect(screen.getByText(/Boîte connectée/i)).toBeDefined()
    expect(screen.getByText(/0 email en attente/i)).toBeDefined()
  })

  it('affiche "N brouillons à valider" quand drafts > 0', () => {
    render(<AlfredoStatusBadge connected={true} draftsPending={5} emailsAnalysed={42} locale="fr" />)
    expect(screen.getByText(/5 brouillons à valider/i)).toBeDefined()
    expect(screen.getByText(/42 emails analysés/i)).toBeDefined()
  })

  it('rend en portugais quand locale=pt', () => {
    render(<AlfredoStatusBadge connected={false} draftsPending={0} emailsAnalysed={0} locale="pt" />)
    expect(screen.getByText(/Caixa não ligada/i)).toBeDefined()
  })
})
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

```bash
npm run test -- tests/components/agents-ia/AlfredoStatusBadge.test.tsx --run
```

Expected : `FAIL`.

- [ ] **Step 3 : Implémenter le composant**

Create `components/syndic-dashboard/agents-ia/alfredo/AlfredoStatusBadge.tsx` :

```typescript
'use client'

interface Props {
  connected: boolean
  draftsPending: number
  emailsAnalysed: number
  locale: 'fr' | 'pt'
}

export function AlfredoStatusBadge({ connected, draftsPending, emailsAnalysed, locale }: Props) {
  if (!connected) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 999,
          background: 'rgba(220, 38, 38, 0.08)',
          color: '#991b1b',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <span aria-hidden>🔴</span>
        {locale === 'pt' ? 'Caixa não ligada' : 'Boîte non connectée'}
      </span>
    )
  }

  if (draftsPending === 0) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 999,
          background: 'rgba(34, 197, 94, 0.10)',
          color: '#166534',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <span aria-hidden>🟢</span>
        {locale === 'pt'
          ? `Caixa ligada · 0 email em espera`
          : `Boîte connectée · 0 email en attente`}
      </span>
    )
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 999,
        background: 'rgba(212, 175, 55, 0.16)',
        color: '#7c5d10',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <span aria-hidden>🟡</span>
      {locale === 'pt'
        ? `${draftsPending} rascunhos a validar · ${emailsAnalysed} emails analisados`
        : `${draftsPending} brouillons à valider · ${emailsAnalysed} emails analysés`}
    </span>
  )
}
```

- [ ] **Step 4 : Vérifier que le test passe**

```bash
npm run test -- tests/components/agents-ia/AlfredoStatusBadge.test.tsx --run
```

Expected : `PASS`, 4 tests.

- [ ] **Step 5 : Commit**

```bash
git add components/syndic-dashboard/agents-ia/alfredo/AlfredoStatusBadge.tsx \
        tests/components/agents-ia/AlfredoStatusBadge.test.tsx
git commit -m "feat(syndic-alfredo): composant AlfredoStatusBadge (3 états connexion)"
```

---

## Task 5 : Composant `AlfredoSuggestedPrompts`

**Files:**
- Create: `components/syndic-dashboard/agents-ia/alfredo/AlfredoSuggestedPrompts.tsx`
- Create: `tests/components/agents-ia/AlfredoSuggestedPrompts.test.tsx`

- [ ] **Step 1 : Écrire le test failing**

Create `tests/components/agents-ia/AlfredoSuggestedPrompts.test.tsx` :

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AlfredoSuggestedPrompts } from '@/components/syndic-dashboard/agents-ia/alfredo/AlfredoSuggestedPrompts'

describe('AlfredoSuggestedPrompts', () => {
  it('rend 8 chips en français par défaut', () => {
    render(<AlfredoSuggestedPrompts locale="fr" onPick={() => {}} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBe(8)
  })

  it('rend les 8 chips en portugais quand locale=pt', () => {
    render(<AlfredoSuggestedPrompts locale="pt" onPick={() => {}} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBe(8)
    expect(screen.getByText(/Resume os meus emails/i)).toBeDefined()
  })

  it('appelle onPick avec le texte du chip cliqué', () => {
    const onPick = vi.fn()
    render(<AlfredoSuggestedPrompts locale="fr" onPick={onPick} />)
    fireEvent.click(screen.getByText(/Résume mes emails du jour/i))
    expect(onPick).toHaveBeenCalledWith('Résume mes emails du jour')
  })
})
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

```bash
npm run test -- tests/components/agents-ia/AlfredoSuggestedPrompts.test.tsx --run
```

Expected : `FAIL`.

- [ ] **Step 3 : Implémenter le composant**

Create `components/syndic-dashboard/agents-ia/alfredo/AlfredoSuggestedPrompts.tsx` :

```typescript
'use client'

const PROMPTS_FR = [
  'Résume mes emails du jour',
  'Quels emails sont urgents ?',
  'Cherche les emails de Mme Dupont',
  'Brouillon pour le sinistre du lot 12',
  'Archive tous les spams',
  'Quels emails attendent réponse ?',
  'Rédige une relance amiable',
  'Combien d’emails à traiter ?',
]

const PROMPTS_PT = [
  'Resume os meus emails de hoje',
  'Quais emails são urgentes ?',
  'Procura os emails da Sra. Costa',
  'Rascunho para o sinistro do lote 12',
  'Arquiva todo o spam',
  'Que emails aguardam resposta ?',
  'Redige um lembrete amigável',
  'Quantos emails para tratar ?',
]

interface Props {
  locale: 'fr' | 'pt'
  onPick: (prompt: string) => void
}

export function AlfredoSuggestedPrompts({ locale, onPick }: Props) {
  const prompts = locale === 'pt' ? PROMPTS_PT : PROMPTS_FR

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 10,
        maxWidth: 720,
        margin: '0 auto',
      }}
    >
      {prompts.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPick(p)}
          style={{
            textAlign: 'left',
            padding: '12px 16px',
            background: 'var(--sd-bg-2, #f7f4ec)',
            border: '1px solid var(--sd-border, rgba(0,0,0,0.08))',
            borderRadius: 14,
            cursor: 'pointer',
            fontSize: 14,
            color: 'var(--sd-navy, #0d1b2e)',
            lineHeight: 1.4,
          }}
        >
          {p}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4 : Vérifier que le test passe**

```bash
npm run test -- tests/components/agents-ia/AlfredoSuggestedPrompts.test.tsx --run
```

Expected : `PASS`, 3 tests.

- [ ] **Step 5 : Commit**

```bash
git add components/syndic-dashboard/agents-ia/alfredo/AlfredoSuggestedPrompts.tsx \
        tests/components/agents-ia/AlfredoSuggestedPrompts.test.tsx
git commit -m "feat(syndic-alfredo): grille 8 prompts suggérés FR/PT"
```

---

## Task 6 : Composant `AlfredoEmptyState`

**Files:**
- Create: `components/syndic-dashboard/agents-ia/alfredo/AlfredoEmptyState.tsx`
- Create: `tests/components/agents-ia/AlfredoEmptyState.test.tsx`

- [ ] **Step 1 : Écrire le test failing**

Create `tests/components/agents-ia/AlfredoEmptyState.test.tsx` :

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AlfredoEmptyState } from '@/components/syndic-dashboard/agents-ia/alfredo/AlfredoEmptyState'

describe('AlfredoEmptyState', () => {
  it('affiche mascotte, titre Bonjour, badge non connecté, prompts, CTA quand non connecté', () => {
    render(
      <AlfredoEmptyState
        connected={false}
        draftsPending={0}
        emailsAnalysed={0}
        locale="fr"
        onPickPrompt={() => {}}
        onConnectGmail={() => {}}
      />
    )
    expect(screen.getByRole('img', { name: /alfredo/i })).toBeDefined()
    expect(screen.getByText(/Bonjour, je suis Alfredo/i)).toBeDefined()
    expect(screen.getByText(/Boîte non connectée/i)).toBeDefined()
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(9) // 8 prompts + CTA
    expect(screen.getByRole('button', { name: /Connecter Gmail/i })).toBeDefined()
  })

  it('appelle onConnectGmail quand le CTA est cliqué', () => {
    const onConnectGmail = vi.fn()
    render(
      <AlfredoEmptyState
        connected={false}
        draftsPending={0}
        emailsAnalysed={0}
        locale="fr"
        onPickPrompt={() => {}}
        onConnectGmail={onConnectGmail}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Connecter Gmail/i }))
    expect(onConnectGmail).toHaveBeenCalledTimes(1)
  })

  it('cache le CTA Connecter Gmail si déjà connecté', () => {
    render(
      <AlfredoEmptyState
        connected={true}
        draftsPending={0}
        emailsAnalysed={42}
        locale="fr"
        onPickPrompt={() => {}}
        onConnectGmail={() => {}}
      />
    )
    expect(screen.queryByRole('button', { name: /Connecter Gmail/i })).toBeNull()
  })

  it('affiche le titre en portugais quand locale=pt', () => {
    render(
      <AlfredoEmptyState
        connected={false}
        draftsPending={0}
        emailsAnalysed={0}
        locale="pt"
        onPickPrompt={() => {}}
        onConnectGmail={() => {}}
      />
    )
    expect(screen.getByText(/Olá, sou o Alfredo/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /Ligar Gmail/i })).toBeDefined()
  })
})
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

```bash
npm run test -- tests/components/agents-ia/AlfredoEmptyState.test.tsx --run
```

Expected : `FAIL`.

- [ ] **Step 3 : Implémenter le composant**

Create `components/syndic-dashboard/agents-ia/alfredo/AlfredoEmptyState.tsx` :

```typescript
'use client'

import { AlfredoMascot } from './AlfredoMascot'
import { AlfredoStatusBadge } from './AlfredoStatusBadge'
import { AlfredoSuggestedPrompts } from './AlfredoSuggestedPrompts'

interface Props {
  connected: boolean
  draftsPending: number
  emailsAnalysed: number
  locale: 'fr' | 'pt'
  onPickPrompt: (prompt: string) => void
  onConnectGmail: () => void
}

export function AlfredoEmptyState({
  connected,
  draftsPending,
  emailsAnalysed,
  locale,
  onPickPrompt,
  onConnectGmail,
}: Props) {
  const labels = locale === 'pt'
    ? {
        greeting: 'Olá, sou o Alfredo !',
        intro: 'Sou o seu assistente de emails IA. Ligue a sua caixa Gmail e eu analiso, classifico e proponho rascunhos de resposta para cada email recebido.',
        connect: '🔗 Ligar Gmail',
      }
    : {
        greeting: 'Bonjour, je suis Alfredo !',
        intro: "Je suis votre assistant emails IA. Connectez votre boîte Gmail et j'analyse, classe et propose un brouillon de réponse pour chaque mail reçu.",
        connect: '🔗 Connecter Gmail',
      }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        padding: '48px 24px',
        maxWidth: 920,
        margin: '0 auto',
      }}
    >
      <AlfredoStatusBadge
        connected={connected}
        draftsPending={draftsPending}
        emailsAnalysed={emailsAnalysed}
        locale={locale}
      />
      <AlfredoMascot size="lg" />
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{labels.greeting}</h2>
      <p style={{ fontSize: 15, color: 'rgba(0,0,0,0.65)', textAlign: 'center', maxWidth: 620, lineHeight: 1.5, margin: 0 }}>
        {labels.intro}
      </p>
      {!connected ? (
        <button
          type="button"
          onClick={onConnectGmail}
          style={{
            padding: '12px 24px',
            background: 'var(--sd-navy, #0d1b2e)',
            color: 'var(--sd-gold, #d4af37)',
            border: 0,
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {labels.connect}
        </button>
      ) : null}
      <div style={{ marginTop: 8, width: '100%' }}>
        <AlfredoSuggestedPrompts locale={locale} onPick={onPickPrompt} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4 : Vérifier que le test passe**

```bash
npm run test -- tests/components/agents-ia/AlfredoEmptyState.test.tsx --run
```

Expected : `PASS`, 4 tests.

- [ ] **Step 5 : Commit**

```bash
git add components/syndic-dashboard/agents-ia/alfredo/AlfredoEmptyState.tsx \
        tests/components/agents-ia/AlfredoEmptyState.test.tsx
git commit -m "feat(syndic-alfredo): AlfredoEmptyState Léa-style (mascotte + statut + prompts + CTA)"
```

---

## Task 7 : Composant `AlfredoChatSidebar` (collapsible)

**Files:**
- Create: `components/syndic-dashboard/agents-ia/alfredo/AlfredoChatSidebar.tsx`
- Create: `tests/components/agents-ia/AlfredoChatSidebar.test.tsx`

- [ ] **Step 1 : Écrire le test failing**

Create `tests/components/agents-ia/AlfredoChatSidebar.test.tsx` :

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AlfredoChatSidebar } from '@/components/syndic-dashboard/agents-ia/alfredo/AlfredoChatSidebar'

describe('AlfredoChatSidebar', () => {
  it('rend collapsed par défaut avec un bouton "Discuter avec Alfredo"', () => {
    render(<AlfredoChatSidebar locale="fr">{<div data-testid="chat-content" />}</AlfredoChatSidebar>)
    expect(screen.getByRole('button', { name: /Discuter avec Alfredo/i })).toBeDefined()
    expect(screen.queryByTestId('chat-content')).toBeNull()
  })

  it('rend expanded quand on clique sur le bouton', () => {
    render(<AlfredoChatSidebar locale="fr">{<div data-testid="chat-content" />}</AlfredoChatSidebar>)
    fireEvent.click(screen.getByRole('button', { name: /Discuter avec Alfredo/i }))
    expect(screen.getByTestId('chat-content')).toBeDefined()
  })

  it('appelle onToggle si fourni', () => {
    const onToggle = vi.fn()
    render(<AlfredoChatSidebar locale="fr" onToggle={onToggle}>{<div />}</AlfredoChatSidebar>)
    fireEvent.click(screen.getByRole('button', { name: /Discuter avec Alfredo/i }))
    expect(onToggle).toHaveBeenCalledWith(true)
  })

  it('label en portugais quand locale=pt', () => {
    render(<AlfredoChatSidebar locale="pt">{<div />}</AlfredoChatSidebar>)
    expect(screen.getByRole('button', { name: /Conversar com Alfredo/i })).toBeDefined()
  })
})
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

```bash
npm run test -- tests/components/agents-ia/AlfredoChatSidebar.test.tsx --run
```

Expected : `FAIL`.

- [ ] **Step 3 : Implémenter le composant**

Create `components/syndic-dashboard/agents-ia/alfredo/AlfredoChatSidebar.tsx` :

```typescript
'use client'

import { useState, type ReactNode } from 'react'

interface Props {
  locale: 'fr' | 'pt'
  children: ReactNode
  onToggle?: (expanded: boolean) => void
}

export function AlfredoChatSidebar({ locale, children, onToggle }: Props) {
  const [expanded, setExpanded] = useState(false)

  const labels = locale === 'pt'
    ? { open: 'Conversar com Alfredo', close: 'Fechar conversa' }
    : { open: 'Discuter avec Alfredo', close: 'Fermer la discussion' }

  const toggle = () => {
    const next = !expanded
    setExpanded(next)
    onToggle?.(next)
  }

  if (!expanded) {
    return (
      <aside
        style={{
          width: 56,
          borderLeft: '1px solid var(--sd-border, rgba(0,0,0,0.08))',
          background: 'var(--sd-bg-2, #f7f4ec)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '12px 0',
        }}
      >
        <button
          type="button"
          onClick={toggle}
          aria-label={labels.open}
          title={labels.open}
          style={{
            background: 'var(--sd-gold, #d4af37)',
            color: 'var(--sd-navy, #0d1b2e)',
            border: 0,
            borderRadius: 999,
            width: 40,
            height: 40,
            fontSize: 20,
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          💬
        </button>
      </aside>
    )
  }

  return (
    <aside
      style={{
        width: 400,
        borderLeft: '1px solid var(--sd-border, rgba(0,0,0,0.08))',
        background: 'var(--sd-bg, white)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 12,
          borderBottom: '1px solid var(--sd-border, rgba(0,0,0,0.08))',
        }}
      >
        <strong style={{ fontSize: 14 }}>{labels.open}</strong>
        <button
          type="button"
          onClick={toggle}
          aria-label={labels.close}
          style={{ background: 'transparent', border: 0, cursor: 'pointer', fontSize: 18 }}
        >
          ✕
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
    </aside>
  )
}
```

- [ ] **Step 4 : Vérifier que le test passe**

```bash
npm run test -- tests/components/agents-ia/AlfredoChatSidebar.test.tsx --run
```

Expected : `PASS`, 4 tests.

- [ ] **Step 5 : Commit**

```bash
git add components/syndic-dashboard/agents-ia/alfredo/AlfredoChatSidebar.tsx \
        tests/components/agents-ia/AlfredoChatSidebar.test.tsx
git commit -m "feat(syndic-alfredo): AlfredoChatSidebar (collapsible droite)"
```

---

## Task 8 : Composant `AlfredoLoadedView` (3 zones)

**Files:**
- Create: `components/syndic-dashboard/agents-ia/alfredo/AlfredoLoadedView.tsx`
- Create: `tests/components/agents-ia/AlfredoLoadedView.test.tsx`

- [ ] **Step 1 : Écrire le test failing**

Create `tests/components/agents-ia/AlfredoLoadedView.test.tsx` :

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'

vi.mock('@/components/syndic-dashboard/agents-ia/AlfredoInboxView', () => ({
  default: () => <div data-testid="inbox-view">inbox-stub</div>,
}))
vi.mock('@/components/syndic-dashboard/agents-ia/AgentChatPage', () => ({
  default: () => <div data-testid="chat-stub">chat-stub</div>,
}))

import { AlfredoLoadedView } from '@/components/syndic-dashboard/agents-ia/alfredo/AlfredoLoadedView'

describe('AlfredoLoadedView', () => {
  const user = { id: 'u1' } as unknown as User

  it('rend le badge de statut, l’inbox et la chat sidebar collapsed', () => {
    render(
      <AlfredoLoadedView
        user={user}
        locale="fr"
        connected={true}
        draftsPending={3}
        emailsAnalysed={42}
      />
    )
    expect(screen.getByTestId('inbox-view')).toBeDefined()
    expect(screen.getByText(/brouillons à valider/i)).toBeDefined()
    // chat sidebar est collapsed par défaut → bouton visible, chat-stub absent
    expect(screen.getByRole('button', { name: /Discuter avec Alfredo/i })).toBeDefined()
    expect(screen.queryByTestId('chat-stub')).toBeNull()
  })
})
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

```bash
npm run test -- tests/components/agents-ia/AlfredoLoadedView.test.tsx --run
```

Expected : `FAIL`.

- [ ] **Step 3 : Implémenter le composant**

Create `components/syndic-dashboard/agents-ia/alfredo/AlfredoLoadedView.tsx` :

```typescript
'use client'

import type { User } from '@supabase/supabase-js'
import AlfredoInboxView from '../AlfredoInboxView'
import AgentChatPage from '../AgentChatPage'
import { AGENT_CONFIGS } from '../configs'
import { AlfredoStatusBadge } from './AlfredoStatusBadge'
import { AlfredoChatSidebar } from './AlfredoChatSidebar'

interface UserWithProfile extends User {
  profile?: { country?: string }
}

interface Props {
  user: UserWithProfile
  locale: 'fr' | 'pt'
  connected: boolean
  draftsPending: number
  emailsAnalysed: number
}

export function AlfredoLoadedView({ user, locale, connected, draftsPending, emailsAnalysed }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid var(--sd-border, rgba(0,0,0,0.08))',
          background: 'var(--sd-bg-2, #f7f4ec)',
        }}
      >
        <strong style={{ fontSize: 15 }}>📧 Alfredo</strong>
        <AlfredoStatusBadge
          connected={connected}
          draftsPending={draftsPending}
          emailsAnalysed={emailsAnalysed}
          locale={locale}
        />
      </header>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <AlfredoInboxView locale={locale} />
        </div>
        <AlfredoChatSidebar locale={locale}>
          <AgentChatPage agentConfig={AGENT_CONFIGS.alfredo} user={user} />
        </AlfredoChatSidebar>
      </div>
    </div>
  )
}
```

- [ ] **Step 4 : Vérifier que le test passe**

```bash
npm run test -- tests/components/agents-ia/AlfredoLoadedView.test.tsx --run
```

Expected : `PASS`, 1 test.

- [ ] **Step 5 : Commit**

```bash
git add components/syndic-dashboard/agents-ia/alfredo/AlfredoLoadedView.tsx \
        tests/components/agents-ia/AlfredoLoadedView.test.tsx
git commit -m "feat(syndic-alfredo): AlfredoLoadedView 3 zones (inbox + chat sidebar)"
```

---

## Task 9 : Refonte `AlfredoAgentPage` (bascule empty/loaded)

**Files:**
- Modify: `components/syndic-dashboard/agents-ia/pages/AlfredoAgentPage.tsx`
- Create: `tests/components/agents-ia/AlfredoAgentPage.test.tsx`

- [ ] **Step 1 : Écrire le test failing**

Create `tests/components/agents-ia/AlfredoAgentPage.test.tsx` :

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'

vi.mock('@/lib/i18n/context', () => ({
  useLocale: () => 'fr',
}))
vi.mock('@/components/syndic-dashboard/agents-ia/AlfredoInboxView', () => ({
  default: () => <div data-testid="inbox-view">inbox-stub</div>,
}))
vi.mock('@/components/syndic-dashboard/agents-ia/AgentChatPage', () => ({
  default: () => <div data-testid="chat-stub">chat-stub</div>,
}))

import AlfredoAgentPage from '@/components/syndic-dashboard/agents-ia/pages/AlfredoAgentPage'

describe('AlfredoAgentPage (Lot 5)', () => {
  const user = { id: 'u1' } as unknown as User

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('rend EmptyState quand connected=false', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ connected: false, email_compte: null, drafts_pending: 0, emails_analysed: 0 }),
    }) as unknown as typeof fetch

    render(<AlfredoAgentPage user={user} />)
    await waitFor(() => expect(screen.getByText(/Bonjour, je suis Alfredo/i)).toBeDefined())
    expect(screen.queryByTestId('inbox-view')).toBeNull()
  })

  it('rend LoadedView quand connected=true', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ connected: true, email_compte: 'a@b.fr', drafts_pending: 2, emails_analysed: 10 }),
    }) as unknown as typeof fetch

    render(<AlfredoAgentPage user={user} />)
    await waitFor(() => expect(screen.getByTestId('inbox-view')).toBeDefined())
    expect(screen.queryByText(/Bonjour, je suis Alfredo/i)).toBeNull()
  })
})
```

- [ ] **Step 2 : Lancer le test (doit échouer car composant pas modifié)**

```bash
npm run test -- tests/components/agents-ia/AlfredoAgentPage.test.tsx --run
```

Expected : `FAIL` (l'ancien `AlfredoAgentPage` rend les tabs Inbox/Discussion, pas l'EmptyState).

- [ ] **Step 3 : Refondre le composant**

Overwrite `components/syndic-dashboard/agents-ia/pages/AlfredoAgentPage.tsx` :

```typescript
'use client'

import { useLocale } from '@/lib/i18n/context'
import type { User } from '@supabase/supabase-js'
import { useAlfredoStatus } from '../alfredo/useAlfredoStatus'
import { AlfredoEmptyState } from '../alfredo/AlfredoEmptyState'
import { AlfredoLoadedView } from '../alfredo/AlfredoLoadedView'

interface UserWithProfile extends User {
  profile?: { country?: string }
}

export default function AlfredoAgentPage({ user }: { user: UserWithProfile }) {
  const uiLocale = useLocale()
  const locale = (uiLocale === 'pt' ? 'pt' : 'fr') as 'fr' | 'pt'
  const { status, loading } = useAlfredoStatus()

  if (loading || !status) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'rgba(0,0,0,0.5)' }}>
        {locale === 'pt' ? 'A carregar Alfredo…' : 'Chargement d’Alfredo…'}
      </div>
    )
  }

  const handleConnectGmail = () => {
    window.location.href = '/api/email-agent/connect'
  }

  const handlePickPrompt = (_prompt: string) => {
    // Lot 5 : pas d'action ; les prompts deviendront cliquables en Lot 5+ quand on aura
    // un store global pour pré-remplir l'input chat. Ici on no-op pour ne pas casser l'UX.
  }

  if (!status.connected) {
    return (
      <div style={{ minHeight: 'calc(100vh - 80px)', background: 'var(--sd-bg, white)' }}>
        <AlfredoEmptyState
          connected={false}
          draftsPending={0}
          emailsAnalysed={0}
          locale={locale}
          onPickPrompt={handlePickPrompt}
          onConnectGmail={handleConnectGmail}
        />
      </div>
    )
  }

  if (status.drafts_pending === 0 && status.emails_analysed === 0) {
    return (
      <div style={{ minHeight: 'calc(100vh - 80px)', background: 'var(--sd-bg, white)' }}>
        <AlfredoEmptyState
          connected={true}
          draftsPending={0}
          emailsAnalysed={0}
          locale={locale}
          onPickPrompt={handlePickPrompt}
          onConnectGmail={handleConnectGmail}
        />
      </div>
    )
  }

  return (
    <div style={{ height: 'calc(100vh - 80px)' }}>
      <AlfredoLoadedView
        user={user}
        locale={locale}
        connected={status.connected}
        draftsPending={status.drafts_pending}
        emailsAnalysed={status.emails_analysed}
      />
    </div>
  )
}
```

- [ ] **Step 4 : Vérifier que le test passe**

```bash
npm run test -- tests/components/agents-ia/AlfredoAgentPage.test.tsx --run
```

Expected : `PASS`, 2 tests.

- [ ] **Step 5 : Vérifier la suite entière des tests Alfredo**

```bash
npm run test -- tests/components/agents-ia/ tests/api/email-agent-status.test.ts --run
```

Expected : tous les tests passent (7 fichiers).

- [ ] **Step 6 : Commit**

```bash
git add components/syndic-dashboard/agents-ia/pages/AlfredoAgentPage.tsx \
        tests/components/agents-ia/AlfredoAgentPage.test.tsx
git commit -m "feat(syndic-alfredo): refonte AlfredoAgentPage (bascule empty/loaded)"
```

---

## Task 10 : Rename sidebar label + routing dashboard

**Files:**
- Modify: `components/syndic-dashboard/config.ts:51`
- Modify: `app/syndic/dashboard/page.tsx:2838`

- [ ] **Step 1 : Renommer le label de la sidebar**

Edit `components/syndic-dashboard/config.ts` ligne 51 :

Avant :
```typescript
{ key: 'emails', label: 'Emails Fixy', icon: '📧', description: 'Gestion des emails avec IA', default: true },
```

Après :
```typescript
{ key: 'emails', label: 'Alfredo', icon: '📧', description: 'Assistant emails IA — analyse, brouillons de réponse, contexte client', default: true },
```

Commande Edit :

```typescript
// Edit tool :
// old_string: { key: 'emails', label: 'Emails Fixy', icon: '📧', description: 'Gestion des emails avec IA', default: true },
// new_string: { key: 'emails', label: 'Alfredo', icon: '📧', description: 'Assistant emails IA — analyse, brouillons de réponse, contexte client', default: true },
```

- [ ] **Step 2 : Router `page === 'emails'` vers `AlfredoAgentPage`**

Edit `app/syndic/dashboard/page.tsx` ligne 2838 :

Avant :
```tsx
{page === 'emails' && user && <EmailsSection syndicId={user.id} onNavigateParams={() => setPage('parametres')} />}
```

Après :
```tsx
{page === 'emails' && user && <AlfredoAgentPage user={user} />}
```

Note : `AlfredoAgentPage` est déjà importé ligne 141 (`const AlfredoAgentPage = d(() => import('@/components/syndic-dashboard/agents-ia/pages/AlfredoAgentPage'))`), donc pas besoin d'ajouter d'import. L'ancien `EmailsSection` (ligne 40) reste importé pour le moment (cleanup en patch séparé).

- [ ] **Step 3 : Vérifier que ça compile**

```bash
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20 || echo "TSC: 0 errors"
```

Expected : `TSC: 0 errors` ou aucune nouvelle erreur introduite.

- [ ] **Step 4 : Vérifier que les tests existants ne sont pas cassés**

```bash
npm run test --run 2>&1 | tail -15
```

Expected : tous les tests passent (y compris les 7 nouveaux).

- [ ] **Step 5 : Commit**

```bash
git add components/syndic-dashboard/config.ts app/syndic/dashboard/page.tsx
git commit -m "feat(syndic-alfredo): rename sidebar 'Emails Fixy' → 'Alfredo' + routing AlfredoAgentPage"
```

---

## Task 11 : E2E Playwright `syndic-alfredo-ui`

**Files:**
- Create: `e2e/syndic-alfredo-ui.spec.ts`

- [ ] **Step 1 : Écrire le test E2E**

Create `e2e/syndic-alfredo-ui.spec.ts` :

```typescript
/**
 * E2E — Syndic Alfredo UI (Lot 5)
 *
 * Pré-requis :
 *   1. Migrations Alfredo appliquées
 *   2. Dev server lancé (`npm run dev`)
 *   3. Compte de test syndic_admin disponible avec `test_role=syndic_admin`
 *
 * Tests skippés par défaut tant que `RUN_AGENTS_IA_E2E=1` n'est pas activé.
 */
import { test, expect } from '@playwright/test'

const SHOULD_RUN = process.env.RUN_AGENTS_IA_E2E === '1'

test.describe('Alfredo UI — Empty State (non connecté)', () => {
  test.skip(!SHOULD_RUN, 'RUN_AGENTS_IA_E2E pas activé')

  test('affiche mascotte + greeting + CTA Connecter Gmail si non connecté', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin&page=emails')
    await expect(page.getByRole('img', { name: /alfredo/i })).toBeVisible()
    await expect(page.getByText(/Bonjour, je suis Alfredo/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Connecter Gmail/i })).toBeVisible()
  })

  test('affiche la grille de 8 prompts suggérés', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin&page=emails')
    await expect(page.getByText(/Résume mes emails du jour/i)).toBeVisible()
    await expect(page.getByText(/Combien d.emails à traiter/i)).toBeVisible()
  })
})

test.describe('Alfredo UI — Loaded State (boîte connectée + drafts)', () => {
  test.skip(!SHOULD_RUN, 'RUN_AGENTS_IA_E2E pas activé ou pas de fixture de drafts')

  test('affiche header avec status badge et inbox', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin&page=emails&seed=alfredo_drafts')
    await expect(page.getByText(/Alfredo/).first()).toBeVisible()
    await expect(page.getByText(/brouillons à valider/i)).toBeVisible()
  })

  test('chat sidebar : bouton ouvre/ferme la sidebar', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin&page=emails&seed=alfredo_drafts')
    const openBtn = page.getByRole('button', { name: /Discuter avec Alfredo/i })
    await expect(openBtn).toBeVisible()
    await openBtn.click()
    await expect(page.getByRole('button', { name: /Fermer la discussion/i })).toBeVisible()
  })
})

test.describe('Alfredo UI — Sidebar rename', () => {
  test.skip(!SHOULD_RUN, 'RUN_AGENTS_IA_E2E pas activé')

  test('sidebar syndic affiche "Alfredo" (et plus "Emails Fixy")', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin')
    await expect(page.getByRole('button', { name: /^Alfredo$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Emails Fixy/i })).toHaveCount(0)
  })
})
```

- [ ] **Step 2 : Lancer le test E2E (skip par défaut)**

```bash
npm run test:e2e -- e2e/syndic-alfredo-ui.spec.ts 2>&1 | tail -20
```

Expected : tests skip (sans `RUN_AGENTS_IA_E2E=1`) ou pass si activé. Pas d'erreur de parsing/import.

- [ ] **Step 3 : Optionnel — exécuter en local avec dev server**

(À faire manuellement en local si dev server lancé.)

```bash
RUN_AGENTS_IA_E2E=1 npm run test:e2e -- e2e/syndic-alfredo-ui.spec.ts
```

- [ ] **Step 4 : Commit**

```bash
git add e2e/syndic-alfredo-ui.spec.ts
git commit -m "test(syndic-alfredo): E2E Playwright empty/loaded states + sidebar rename"
```

---

## Task 12 : Validation finale et ouverture de PR

**Files:** N/A (git + revue)

- [ ] **Step 1 : Lancer toute la suite de tests**

```bash
npm run test --run 2>&1 | tail -15
```

Expected : tous les tests passent. Compter les nouveaux tests : 7 fichiers ajoutés + 1 ajouté = 8 nouveaux, ~25 nouveaux it().

- [ ] **Step 2 : Lancer ESLint**

```bash
npm run lint 2>&1 | tail -20
```

Expected : aucun warning/error nouveau introduit. Si présence de warnings préexistants, le noter en commentaire de PR.

- [ ] **Step 3 : Lancer le type-check**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

Expected : `0`.

- [ ] **Step 4 : Vérification visuelle manuelle**

```bash
npm run dev
```

Ouvrir [http://localhost:3000/syndic/dashboard?test_role=syndic_admin](http://localhost:3000/syndic/dashboard?test_role=syndic_admin) (ou route équivalente projet).

Vérifier manuellement :
1. Sidebar affiche "Alfredo" (et pas "Emails Fixy")
2. Cliquer "Alfredo" → écran empty state avec mascotte + greeting + 8 prompts + CTA
3. Si compte de test a Gmail connecté → écran loaded avec header badge + inbox + bouton chat sidebar à droite
4. Cliquer bouton chat → sidebar s'ouvre à droite avec le chat
5. Vérifier responsive : resize fenêtre à 768px → layout reste utilisable (au pire les 3 zones se stackent verticalement, on accepte la dégradation pour Lot 5)

- [ ] **Step 5 : Push la branche**

```bash
git push -u origin feature/alfredo-lot5-design
```

- [ ] **Step 6 : Ouvrir la PR**

```bash
gh pr create --title "feat(syndic-alfredo): Lot 5 — Refonte UI Alfredo (empty/loaded states)" --body "$(cat <<'EOF'
## Summary
- Refonte page Alfredo (`page === 'emails'`) en deux états : empty state Léa-style (mascotte + statut + 8 prompts + CTA Gmail) et loaded state SOTA 3-zones (inbox + chat sidebar collapsible).
- 6 nouveaux composants atomiques dans `components/syndic-dashboard/agents-ia/alfredo/` (Mascot, StatusBadge, SuggestedPrompts, EmptyState, ChatSidebar, LoadedView) avec test Vitest dédié.
- Endpoint `GET /api/email-agent/status` pour piloter la bascule empty/loaded.
- Rename sidebar `'Emails Fixy'` → `'Alfredo'`, consolidation routing dashboard.
- 1 spec Playwright E2E couvrant les deux états + le rename (skip-par-défaut, activable via `RUN_AGENTS_IA_E2E=1`).

## Spec
[docs/superpowers/specs/2026-05-20-alfredo-pro-2026-design.md](docs/superpowers/specs/2026-05-20-alfredo-pro-2026-design.md) §5 Lot 5.

## Test plan
- [ ] `npm run test --run` vert (8 nouveaux fichiers, ~25 nouveaux it())
- [ ] `npm run lint` propre
- [ ] `npx tsc --noEmit` 0 erreur
- [ ] Vérification manuelle sur dev server : sidebar 'Alfredo' visible, empty state OK quand non connecté, loaded state OK quand connecté
- [ ] `/ultrareview` avant merge

## Out-of-scope (cleanup différé)
- Suppression de `components/syndic-dashboard/communication/EmailsSection.tsx` (552 lignes) — restera comme dead code jusqu'à un cleanup patch séparé après validation Lot 5 en prod.
- Send Gmail réel (Lot 1), sécurité tokens (Lot 4), webhook (Lot 2), learning (Lot 3) — chacun aura son propre plan.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 7 : Lancer `/ultrareview` sur la PR**

(À faire manuellement par l'utilisateur après la PR ouverte, conformément à la méthode pro 2026.)

---

## Notes pour l'agent exécutant

- TDD strict : aucune feature sans test rouge → vert d'abord. Si tu as envie d'implémenter avant le test, c'est une violation de la méthode pro 2026.
- Pas de `--no-verify` sur les commits (règle dure CLAUDE.md).
- Si un test échoue après une étape de "doit échouer", lis le message d'erreur attentivement — il peut révéler un problème de path/import que la suite ne corrigera pas.
- Les couleurs utilisent les variables CSS `--sd-gold`, `--sd-navy`, `--sd-border`, `--sd-bg`, `--sd-bg-2` qui sont déjà définies dans le projet. Si l'une manque, lire `app/syndic/dashboard/page.tsx` ou un layout proche pour trouver les valeurs réelles.
- L'auto-memory du worktree devrait être mise à jour à la fin (réactivation scope syndic-alfredo tracée). C'est hors-scope du plan Lot 5 mais à noter avant merge.
