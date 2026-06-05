# Plan D — Agents IA Syndic : Polish & Ship (Phase 4/4)

> **For agentic workers:** Use superpowers:subagent-driven-development. Steps utilisent `- [ ]`.

**Goal:** Finaliser la livraison de l'écosystème "Agents IA Syndic" : observabilité Langfuse, suppression du legacy (bulle FixyPanel + AideSection + Copro-AI orphelin), rename Ocorrências IA → Classificador, smoke tests de bout-en-bout.

**Architecture:** Wrap `traceAgent()` sur les 4 endpoints d'agents + pipeline Alfredo. Suppression chirurgicale du legacy en vérifiant qu'aucune référence ne reste. Tests E2E groupés en parcours métier complets.

**Tech Stack:** Langfuse SDK (`lib/langfuse.ts` existant), Vitest, Playwright.

**Spec référence:** [docs/superpowers/specs/2026-05-11-agents-ia-syndic-category-design.md](../specs/2026-05-11-agents-ia-syndic-category-design.md) §3.12 + §4 (chunks 13-15).

---

## File Structure

**Modifiés :**
- `lib/langfuse.ts` (si nécessaire pour exposer `traceAgent`)
- `app/api/syndic/fixy-syndic/route.ts` (wrap traceAgent)
- `app/api/syndic/max-ai/route.ts`
- `app/api/syndic/lea-comptable/route.ts`
- `app/api/syndic/alfredo-chat/route.ts`
- `lib/syndic/alfredo-pipeline.ts` (instrumentation des sous-étapes)
- `app/syndic/dashboard/page.tsx` (suppression FixyPanel + AideSection imports + render)
- `components/syndic-dashboard/pages/FixyPanel.tsx` (à supprimer)
- `components/syndic-dashboard/pages/AideSection.tsx` (si présent — à supprimer)
- `app/api/copro-ai/route.ts` (audit + suppression si orphelin)
- `components/syndic-dashboard/operations/OcorrenciasIASection.tsx` (rename label "IA" → "Classificador")

**Créés :**
- `tests/api/agents-langfuse-instrumentation.test.ts` (anti-régression : vérifie présence `traceAgent`)
- `e2e/syndic-agents-ia.spec.ts` (déjà existe, à enrichir)

---

## Phase D.0 — Langfuse instrumentation (chunk 13)

### Task 1 : Auditer `lib/langfuse.ts` et créer `traceAgent` si absent

**Files:**
- Read: `lib/langfuse.ts`
- Modify (si besoin): `lib/langfuse.ts`
- Create: `tests/lib/langfuse-trace-agent.test.ts`

- [ ] **Step 1 : Lire l'existant**

```bash
wc -l lib/langfuse.ts
grep -n "^export" lib/langfuse.ts
```

- [ ] **Step 2 : Si `traceAgent` n'existe pas, l'ajouter**

```typescript
// Append à lib/langfuse.ts si absent
import type { AgentId } from './syndic/agent-types'

interface TraceAgentParams {
  agent_id: AgentId | string
  conversation_id?: string
  user_id: string
  prompt?: string
  response?: string
  tools_called?: string[]
  metadata?: Record<string, unknown>
}

export async function traceAgent<T>(
  params: TraceAgentParams,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now()
  let success = false
  let result: T | undefined
  let error: unknown = null
  try {
    result = await fn()
    success = true
    return result
  } catch (e) {
    error = e
    throw e
  } finally {
    const latency_ms = Date.now() - start
    // Si l'instance langfuse existe et est configurée, log la trace.
    // Sinon, no-op silencieux (pas de hard dep en dev/test).
    try {
      const lf = (globalThis as { langfuse?: { trace: (data: Record<string, unknown>) => unknown } }).langfuse
      lf?.trace({
        name: `agent:${params.agent_id}`,
        userId: params.user_id,
        sessionId: params.conversation_id,
        input: params.prompt,
        output: params.response,
        metadata: {
          ...params.metadata,
          latency_ms,
          success,
          error: error instanceof Error ? error.message : undefined,
          tools_called: params.tools_called,
        },
      })
    } catch {
      // Ne jamais bloquer le path utilisateur sur une erreur Langfuse
    }
  }
}
```

- [ ] **Step 3 : Test minimal**

```typescript
// tests/lib/langfuse-trace-agent.test.ts
import { describe, it, expect, vi } from 'vitest'
import { traceAgent } from '@/lib/langfuse'

describe('traceAgent', () => {
  it('exécute fn() et retourne sa valeur', async () => {
    const result = await traceAgent(
      { agent_id: 'fixy', user_id: 'u1' },
      async () => 42,
    )
    expect(result).toBe(42)
  })

  it('propage les erreurs', async () => {
    await expect(traceAgent(
      { agent_id: 'fixy', user_id: 'u1' },
      async () => { throw new Error('boom') },
    )).rejects.toThrow('boom')
  })

  it('ne crash pas si Langfuse global absent', async () => {
    const result = await traceAgent(
      { agent_id: 'max', user_id: 'u1' },
      async () => 'ok',
    )
    expect(result).toBe('ok')
  })
})
```

- [ ] **Step 4 : Commit**

```bash
npm run test tests/lib/langfuse-trace-agent.test.ts -- --run
git add lib/langfuse.ts tests/lib/langfuse-trace-agent.test.ts
git commit -m "feat(observability): helper traceAgent générique pour 4 agents (Plan D Task 1)"
```

### Task 2 : Wrap les 4 endpoints d'agents

**Files:**
- Modify: `app/api/syndic/fixy-syndic/route.ts`
- Modify: `app/api/syndic/max-ai/route.ts`
- Modify: `app/api/syndic/lea-comptable/route.ts`
- Modify: `app/api/syndic/alfredo-chat/route.ts`

- [ ] **Step 1 : Wrap l'appel Groq dans chaque endpoint**

Pour chaque route, identifier l'appel principal à `callGroq` ou `callGroqStreaming`, et l'envelopper :

```typescript
import { traceAgent } from '@/lib/langfuse'

// Remplacer :
// const groqResponse = await callGroq({...})
// Par :
const groqResponse = await traceAgent(
  {
    agent_id: 'fixy',  // ou 'max' / 'lea' / 'alfredo' selon route
    user_id: user.id,
    conversation_id: body.conversation_id,
    prompt: parsed.data.message,
  },
  () => callGroq({ model: '...', messages, ... }),
)
```

Pour les routes streaming (Max/Léa), wrap au niveau de l'orchestration plutôt que de chaque chunk (le wrapper est sur le tour complet).

- [ ] **Step 2 : Test anti-régression**

```typescript
// tests/api/agents-langfuse-instrumentation.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Langfuse instrumentation (anti-régression)', () => {
  const ROOT = process.cwd()
  it.each([
    'app/api/syndic/fixy-syndic/route.ts',
    'app/api/syndic/max-ai/route.ts',
    'app/api/syndic/lea-comptable/route.ts',
    'app/api/syndic/alfredo-chat/route.ts',
  ])('%s utilise traceAgent', (path) => {
    const src = readFileSync(join(ROOT, path), 'utf-8')
    expect(src).toMatch(/from\s+['"]@\/lib\/langfuse['"]/)
    expect(src).toMatch(/traceAgent/)
  })
})
```

- [ ] **Step 3 : Commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "fixy-syndic|max-ai|lea-comptable|alfredo-chat" | head -10
npm run test tests/api/agents-langfuse-instrumentation.test.ts -- --run
git add app/api/syndic/ tests/api/agents-langfuse-instrumentation.test.ts
git commit -m "feat(observability): 4 endpoints agents wrappés avec traceAgent (Plan D Task 2)"
```

---

## Phase D.1 — Suppression legacy (chunk 14)

### Task 3 : Supprimer FixyPanel + AideSection + audit Copro-AI

**Files:**
- Delete: `components/syndic-dashboard/pages/FixyPanel.tsx`
- Delete: `components/syndic-dashboard/pages/AideSection.tsx` (si présent)
- Audit: `app/api/copro-ai/route.ts`
- Modify: `app/syndic/dashboard/page.tsx` (retirer imports + render FixyPanel/AideSection)

- [ ] **Step 1 : Recherche de toutes les références à FixyPanel**

```bash
grep -rn "FixyPanel" app/ components/ --include="*.tsx" --include="*.ts" | grep -v "FixyPanel.tsx\|backup"
```

Si seules les références sont dans `app/syndic/dashboard/page.tsx` (l'import + le mount), c'est safe à supprimer. Tout autre référence doit être nettoyée d'abord.

- [ ] **Step 2 : Retirer FixyPanel du dashboard**

Dans `app/syndic/dashboard/page.tsx`, identifier puis supprimer :
- `const FixyPanel = d(() => import(...))` 
- `<FixyPanel ...>` (autour ligne 3105-3109)
- Tous les états locaux liés (`fixyPanelOpen`, etc.) s'ils ne sont plus utilisés ailleurs

Vérifier que les utilisateurs trouvent toujours Fixy via la nouvelle catégorie sidebar `agents_ia` (Plan A Task 19).

- [ ] **Step 3 : Supprimer le fichier FixyPanel.tsx**

```bash
rm components/syndic-dashboard/pages/FixyPanel.tsx
```

- [ ] **Step 4 : Idem pour AideSection.tsx (si existe)**

```bash
ls components/syndic-dashboard/pages/ | grep -i aide
# Si présent :
grep -rn "AideSection" app/ components/ --include="*.tsx"
rm components/syndic-dashboard/pages/AideSection.tsx  # uniquement si pas de réfs externes
```

- [ ] **Step 5 : Audit Copro-AI**

```bash
grep -rn "copro-ai\|copro_ai" app/ components/ --include="*.tsx" --include="*.ts" | head -10
```

Si la route `app/api/copro-ai/route.ts` n'est référencée nulle part ailleurs (pas de fetch côté frontend, pas d'import), elle est orpheline → supprimer :

```bash
rm app/api/copro-ai/route.ts
```

**Si elle est référencée** (par exemple page publique copropriétaire), la garder et noter dans le commit.

- [ ] **Step 6 : Vérifier tsc + tests**

```bash
npx tsc --noEmit 2>&1 | head -20
npm run test -- --run 2>&1 | tail -5
```

Aucune erreur ne doit apparaître. Si des tests référencent FixyPanel ou AideSection, les retirer/adapter.

- [ ] **Step 7 : Commit**

```bash
git add -A
git commit -m "refactor(syndic): suppression FixyPanel + AideSection legacy + audit Copro-AI (Plan D Task 3)"
```

### Task 4 : Rename Ocorrências IA → Classificador

**Files:**
- Modify: `components/syndic-dashboard/operations/OcorrenciasIASection.tsx`
- Modify: `components/syndic-dashboard/config.ts` (si label module est cosmétique-changeable)
- Modify: `app/syndic/dashboard/page.tsx` (label sidebar si défini ici)

- [ ] **Step 1 : Trouver les références "Ocorrências IA" comme label**

```bash
grep -rn "Ocorrências IA\|Ocorrencias IA\|ocorrencias_ia" components/syndic-dashboard/ app/syndic/ --include="*.tsx" --include="*.ts" | head -10
```

- [ ] **Step 2 : Rename uniquement le label visible**

Le module key `ocorrencias_ia` reste (pas de migration de la base). On change uniquement les chaînes affichées :
- Cherche "Ocorrências IA" → remplace par "Ocorrências (Classificador)" 
- Cherche "Classificação IA" → "Classificação automática"
- Pas de modification du regex classifier lui-même (hors scope)

- [ ] **Step 3 : Commit**

```bash
npx tsc --noEmit 2>&1 | grep "Ocorrencias\|ocorrencias" | head -5
git add -A
git commit -m "refactor(syndic): rename Ocorrências IA → Classificador (label only) (Plan D Task 4)"
```

---

## Phase D.2 — Tests E2E parcours (chunk 15)

### Task 5 : Smoke test parcours métier complet

**Files:**
- Modify: `e2e/syndic-agents-ia.spec.ts`

- [ ] **Step 1 : Ajouter un parcours bout-en-bout métier**

Append à `e2e/syndic-agents-ia.spec.ts` :

```typescript
test.describe('Parcours métier complet (Plan D)', () => {
  test.skip(!SHOULD_RUN, 'Requires deployed app + DB migrations applied')

  test('Syndic ouvre Fixy, crée mission, valide via confirmation', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin&test_locale=fr')
    await page.getByRole('button', { name: /Fixy/i }).click()
    await page.getByRole('button', { name: /Nouvelle conversation/i }).click()
    const input = page.getByPlaceholder(/Tape ou parle/i)
    await input.fill('Crée une mission pour fuite eau immeuble Belle Vue, urgent')
    await page.keyboard.press('Enter')
    // L'agent devrait proposer une action confirmable
    await expect(page.getByText(/Action proposée|create_mission/i)).toBeVisible({ timeout: 30000 })
    await page.getByRole('button', { name: /Confirmer/i }).click()
    // L'action est exécutée, message confirmé dans le chat
  })

  test('Bascule entre Fixy → Max via "Demander à Max"', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin&test_locale=fr')
    await page.getByRole('button', { name: /Fixy/i }).click()
    const input = page.getByPlaceholder(/Tape ou parle/i)
    await input.fill('Quelle majorité pour modifier le règlement de copropriété ?')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: /→ Max/i })).toBeVisible({ timeout: 30000 })
  })

  test('FixyPanel bulle flottante a été supprimée', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin')
    // L'ancienne bulle flottante (data-testid ou class spécifique) ne doit plus exister
    await expect(page.locator('[data-testid="fixy-panel-bubble"]')).not.toBeVisible()
  })
})
```

- [ ] **Step 2 : Commit**

```bash
git add e2e/syndic-agents-ia.spec.ts
git commit -m "test(syndic): E2E parcours métier + vérif suppression FixyPanel (Plan D Task 5)"
```

---

## Phase D.3 — Final review checklist

### Task 6 : Self-review global

- [ ] `npx tsc --noEmit` clean (0 erreur)
- [ ] `npm run test -- --run` : tous verts (700+ tests)
- [ ] `npm run lint` : 0 warning/error
- [ ] `git log --oneline | wc -l` : ~70-80 commits
- [ ] Aucun FixyPanel référencé dans le code (`grep -r FixyPanel components/ app/`)
- [ ] Aucun AideSection référencé (si supprimé)
- [ ] Migration SQL Plan A, B, C présentes dans `supabase/migrations/`
- [ ] Plans A, B, C, D documentés dans `docs/superpowers/plans/`
- [ ] Spec à jour dans `docs/superpowers/specs/`
- [ ] Runbook encryption OAuth présent dans `docs/superpowers/runbooks/`

### Task 7 : Préparer le merge

- [ ] Vérifier le diff vs main : `git diff main --stat | tail -10`
- [ ] Vérifier qu'aucun secret n'est commité : `git log -p | grep -i "OAUTH_TOKENS_ENCRYPTION_KEY\|SUPABASE_SERVICE_ROLE_KEY" | head -5`
- [ ] Documentation hors scope (post-MVP) : `docs/superpowers/specs/2026-05-11-agents-ia-syndic-category-design.md` §3.11 (corpus juridique Max)

## Hors scope rappel

- Drop colonnes plain OAuth (différé de Plan B Phase 4 — 7 jours stabilité prod requis)
- Corpus juridique Max (post-MVP, phase 2)
- send_response automatique côté serveur après PATCH (à brancher si Plan C UI Inbox est déployé)

## Prochaine étape

Final code review global + handoff au merge.
