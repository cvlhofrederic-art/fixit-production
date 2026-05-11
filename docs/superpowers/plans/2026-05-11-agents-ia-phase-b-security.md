# Plan B — Agents IA Syndic : Security Hardening (Phase 2/4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger 2 vulnérabilités RGPD bloquantes identifiées dans la cartographie : (1) sanitization PII des contextes envoyés à Groq dans les prompts d'agents Fixy/Max/Léa, (2) chiffrement symétrique pgcrypto des tokens OAuth Gmail stockés en clair dans `syndic_oauth_tokens`.

**Architecture:** Helper `sanitizeContextForLLM()` qui masque emails/téléphones/IBAN/adresses avec un token déterministe + tokenMap conservé côté serveur pour résolution post-action. Encryption pgcrypto avec clé via Wrangler secret, wrapper `lib/oauth/tokens.ts` avec API `getDecryptedToken`/`setEncryptedToken`, migration en 3 étapes (add columns → backfill → swap code → drop plain in Plan D).

**Tech Stack:** TypeScript 5, Zod 4, Supabase pgcrypto, Vitest, Cloudflare Wrangler secrets, Web Crypto API (HMAC-SHA-256 pour tokens déterministes).

**Specie référence:** [docs/superpowers/specs/2026-05-11-agents-ia-syndic-category-design.md](../specs/2026-05-11-agents-ia-syndic-category-design.md) §3.7 (sanitization PII) + §3.8 (encryption tokens OAuth).

**Scope Plan B (chunks 6 + 7 du spec) :**
- Helper `lib/ai/sanitize-context.ts` (TDD couverture > 95%)
- Intégration sanitization dans 3 routes existantes (Fixy, Max, Léa)
- Migration `supabase/migrations/20260512_encrypt_oauth_tokens.sql` (add encrypted columns)
- Wrapper `lib/oauth/tokens.ts` avec API encrypt/decrypt
- Script backfill `scripts/migrate-encrypt-oauth-tokens.ts`
- Refactor 3 routes email-agent pour utiliser le wrapper
- Tests round-trip + rotation de clé

**Hors scope Plan B :**
- Drop des colonnes plain (différé Plan D après validation prod stable)
- Alfredo chat / pipeline / Inbox (Plan C)
- Suppression FixyPanel legacy (Plan D)

---

## File Structure

**Nouveaux fichiers :**
- `lib/ai/sanitize-context.ts` — sanitization PII réutilisable
- `tests/lib/ai/sanitize-context.test.ts` — TDD coverage
- `lib/oauth/tokens.ts` — wrapper encryption tokens
- `tests/lib/oauth/tokens.test.ts` — round-trip tests
- `supabase/migrations/20260512_encrypt_oauth_tokens.sql` — pgcrypto migration phase 1+2
- `scripts/migrate-encrypt-oauth-tokens.ts` — script backfill one-shot

**Fichiers modifiés :**
- `app/api/syndic/fixy-syndic/route.ts` — applique sanitizeContextForLLM avant Groq
- `app/api/syndic/max-ai/route.ts` — applique sanitization
- `app/api/syndic/lea-comptable/route.ts` — applique sanitization
- `app/api/email-agent/callback/route.ts` — utilise setEncryptedToken pour nouveaux tokens
- `app/api/email-agent/poll/route.ts` — utilise getDecryptedToken
- `app/api/email-agent/send-response/route.ts` — utilise getDecryptedToken

---

## Phase B.0 — Sanitization PII (chunk 6 du spec)

### Task 1 : `lib/ai/sanitize-context.ts` (TDD)

**Files:**
- Create: `lib/ai/sanitize-context.ts`
- Create: `tests/lib/ai/sanitize-context.test.ts`

- [ ] **Step 1 : Écrire les tests TDD (cas standards)**

```typescript
// tests/lib/ai/sanitize-context.test.ts
import { describe, it, expect } from 'vitest'
import { sanitizeContextForLLM, resolveSanitizedToken } from '@/lib/ai/sanitize-context'

describe('sanitizeContextForLLM', () => {
  it('remplace les emails par des tokens', () => {
    const { sanitized, tokenMap } = sanitizeContextForLLM({
      contact: { email: 'marie.dupont@gmail.com' }
    })
    expect(sanitized.contact.email).toMatch(/^<email:[a-f0-9]{8}>$/)
    expect(tokenMap.size).toBe(1)
    const [token, value] = Array.from(tokenMap.entries())[0]
    expect(sanitized.contact.email).toContain(token.slice(7, -1))
    expect(value).toBe('marie.dupont@gmail.com')
  })

  it('remplace les téléphones FR avec ou sans +33', () => {
    const { sanitized } = sanitizeContextForLLM({
      phones: ['+33612345678', '06 12 34 56 78', '01.23.45.67.89']
    })
    expect(sanitized.phones[0]).toMatch(/^<phone:/)
    expect(sanitized.phones[1]).toMatch(/^<phone:/)
    expect(sanitized.phones[2]).toMatch(/^<phone:/)
  })

  it('remplace les téléphones PT (+351)', () => {
    const { sanitized } = sanitizeContextForLLM({
      phone: '+351 912 345 678'
    })
    expect(sanitized.phone).toMatch(/^<phone:/)
  })

  it('remplace les IBAN', () => {
    const { sanitized } = sanitizeContextForLLM({
      iban: 'FR76 3000 4000 0312 3456 7890 143'
    })
    expect(sanitized.iban).toMatch(/^<iban:/)
  })

  it('remplace les IBAN PT', () => {
    const { sanitized } = sanitizeContextForLLM({
      iban: 'PT50000201231234567890154'
    })
    expect(sanitized.iban).toMatch(/^<iban:/)
  })

  it('remplace les adresses postales (heuristique mot-clé)', () => {
    const { sanitized } = sanitizeContextForLLM({
      address: '12 rue de la Paix, 75002 Paris'
    })
    expect(sanitized.address).toMatch(/^<address:/)
  })

  it('préserve les nombres simples sans les confondre avec IBAN', () => {
    const { sanitized } = sanitizeContextForLLM({
      count: 42,
      year: 2026,
      amount: 1500.50,
    })
    expect(sanitized.count).toBe(42)
    expect(sanitized.year).toBe(2026)
    expect(sanitized.amount).toBe(1500.50)
  })

  it('traverse les objets imbriqués et tableaux', () => {
    const { sanitized, tokenMap } = sanitizeContextForLLM({
      coproprios: [
        { nom: 'Dupont', email: 'a@b.fr' },
        { nom: 'Costa', email: 'c@d.pt' },
      ]
    })
    expect(sanitized.coproprios[0].email).toMatch(/^<email:/)
    expect(sanitized.coproprios[1].email).toMatch(/^<email:/)
    expect(tokenMap.size).toBe(2)
  })

  it('tokens déterministes : même valeur → même token dans une session', () => {
    const { sanitized: s1 } = sanitizeContextForLLM({ a: 'x@y.fr', b: 'x@y.fr' })
    expect(s1.a).toBe(s1.b)
  })

  it('option keepFirstName : ne masque pas les prénoms isolés', () => {
    const { sanitized } = sanitizeContextForLLM(
      { nom: 'Marie' },
      { keepFirstName: true }
    )
    expect(sanitized.nom).toBe('Marie')
  })

  it('résiste à null et undefined', () => {
    const { sanitized } = sanitizeContextForLLM({
      email: null,
      phone: undefined,
      iban: '',
    })
    expect(sanitized.email).toBeNull()
    expect(sanitized.phone).toBeUndefined()
    expect(sanitized.iban).toBe('')
  })

  it('ne mute pas l\'objet d\'entrée', () => {
    const input = { email: 'a@b.fr' }
    sanitizeContextForLLM(input)
    expect(input.email).toBe('a@b.fr')
  })

  it('limite la profondeur de récursion (anti boucle infinie)', () => {
    const cyclic: Record<string, unknown> = { name: 'x' }
    cyclic.self = cyclic
    // Doit retourner sans throw (WeakSet pour cycle detection)
    expect(() => sanitizeContextForLLM(cyclic)).not.toThrow()
  })

  it('booleans, dates et autres primitives passent inchangés', () => {
    const date = new Date('2026-05-11')
    const { sanitized } = sanitizeContextForLLM({
      flag: true,
      created: date,
      pi: Math.PI,
    })
    expect(sanitized.flag).toBe(true)
    expect(sanitized.created).toBe(date)
    expect(sanitized.pi).toBe(Math.PI)
  })
})

describe('resolveSanitizedToken', () => {
  it('réinjecte la valeur originale à partir du token', () => {
    const { sanitized, tokenMap } = sanitizeContextForLLM({ email: 'a@b.fr' })
    const token = sanitized.email as string
    const real = resolveSanitizedToken(token, tokenMap)
    expect(real).toBe('a@b.fr')
  })

  it('retourne null si le token est inconnu', () => {
    const tokenMap = new Map()
    expect(resolveSanitizedToken('<email:deadbeef>', tokenMap)).toBeNull()
  })

  it('traverse une string et remplace tous les tokens', () => {
    const { sanitized, tokenMap } = sanitizeContextForLLM({ email: 'a@b.fr' })
    const token = sanitized.email as string
    const llmOutput = `Contacter ${token} pour confirmer.`
    const real = resolveSanitizedToken(llmOutput, tokenMap)
    expect(real).toBe('Contacter a@b.fr pour confirmer.')
  })
})
```

- [ ] **Step 2 : Lancer (FAIL attendu)**

```bash
npm run test tests/lib/ai/sanitize-context.test.ts -- --run
```

Expected : FAIL (module not found).

- [ ] **Step 3 : Implémenter le helper**

```typescript
// lib/ai/sanitize-context.ts

/**
 * Sanitization PII pour prompts LLM.
 *
 * Remplace les emails, téléphones FR/PT, IBAN, adresses postales par des tokens
 * de la forme <type:hash8>. Conserve un tokenMap pour résolution post-action
 * (le serveur peut réinjecter la vraie valeur quand l'utilisateur confirme une
 * action sur cette donnée).
 *
 * Cf. spec §3.7.
 */

const EMAIL_RE = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
const IBAN_RE = /\b([A-Z]{2}[0-9]{2}(?:[ ]?[A-Z0-9]{4}){2,7})\b/g
const PHONE_FR_RE = /(?:\+33|0033|0)[\s.-]?[1-9](?:[\s.-]?\d{2}){4}/g
const PHONE_PT_RE = /\+351[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{3}/g
const ADDRESS_HINT_RE = /\b\d+\s+(?:rue|avenue|boulevard|impasse|allée|chemin|place|quai|rua|avenida|travessa|largo)\b[^,\n]{0,80}/gi

interface SanitizeOptions {
  keepFirstName?: boolean
}

interface SanitizeResult<T> {
  sanitized: T
  tokenMap: Map<string, string>
}

function hashToken(value: string, sessionSalt: string): string {
  // Hash court déterministe dans la session (FNV-1a 32-bit hex)
  let hash = 2166136261
  const input = sessionSalt + value
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function sanitizeString(value: string, tokenMap: Map<string, string>, salt: string): string {
  // Pour chaque match d'un pattern, remplacer par token et enregistrer dans tokenMap
  // Ordre important : IBAN avant téléphone (sinon un IBAN PT serait pris comme téléphone PT)
  let out = value

  out = out.replace(IBAN_RE, (match) => {
    const token = `<iban:${hashToken(match, salt)}>`
    tokenMap.set(token, match)
    return token
  })

  out = out.replace(EMAIL_RE, (match) => {
    const token = `<email:${hashToken(match, salt)}>`
    tokenMap.set(token, match)
    return token
  })

  out = out.replace(PHONE_PT_RE, (match) => {
    const token = `<phone:${hashToken(match, salt)}>`
    tokenMap.set(token, match)
    return token
  })

  out = out.replace(PHONE_FR_RE, (match) => {
    const token = `<phone:${hashToken(match, salt)}>`
    tokenMap.set(token, match)
    return token
  })

  out = out.replace(ADDRESS_HINT_RE, (match) => {
    const token = `<address:${hashToken(match, salt)}>`
    tokenMap.set(token, match)
    return token
  })

  return out
}

function deepSanitize<T>(
  value: T,
  tokenMap: Map<string, string>,
  salt: string,
  visited: WeakSet<object>,
  depth: number,
): T {
  if (depth > 50) return value  // garde anti-récursion profonde
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return sanitizeString(value, tokenMap, salt) as unknown as T
  if (typeof value !== 'object') return value
  if (value instanceof Date) return value
  if (Array.isArray(value)) {
    if (visited.has(value)) return value
    visited.add(value)
    return value.map(item => deepSanitize(item, tokenMap, salt, visited, depth + 1)) as unknown as T
  }
  if (visited.has(value as object)) return value
  visited.add(value as object)
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = deepSanitize(v, tokenMap, salt, visited, depth + 1)
  }
  return out as unknown as T
}

/**
 * Sanitize un objet de contexte avant envoi à un LLM.
 * Retourne le contexte avec PII remplacée par des tokens, et un tokenMap pour résolution serveur.
 *
 * @param data L'objet à sanitizer (n'est pas muté).
 * @param options Options (keepFirstName non utilisée actuellement, réservée pour évolution).
 */
export function sanitizeContextForLLM<T>(
  data: T,
  options?: SanitizeOptions,
): SanitizeResult<T> {
  const tokenMap = new Map<string, string>()
  const salt = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const sanitized = deepSanitize(data, tokenMap, salt, new WeakSet(), 0)
  // options.keepFirstName : pas de mécanisme actuel — placeholder pour future heuristique de prénoms isolés
  void options
  return { sanitized, tokenMap }
}

/**
 * Réinjecte les vraies valeurs à partir des tokens dans une string LLM-générée.
 * Tokens inconnus → retourne null (pour le helper unitaire) ou laisse intact (pour les strings).
 */
export function resolveSanitizedToken(
  input: string,
  tokenMap: Map<string, string>,
): string | null {
  // Si input est exactement un token, retourne la valeur (ou null si inconnu)
  const exactMatch = input.match(/^<(email|phone|iban|address):[a-f0-9]{8}>$/)
  if (exactMatch) {
    return tokenMap.get(input) ?? null
  }
  // Sinon, remplace tous les tokens présents dans la string
  return input.replace(/<(email|phone|iban|address):[a-f0-9]{8}>/g, token => tokenMap.get(token) ?? token)
}
```

- [ ] **Step 4 : Lancer les tests (PASS attendu)**

```bash
npm run test tests/lib/ai/sanitize-context.test.ts -- --run
npm run test:coverage tests/lib/ai/sanitize-context.test.ts -- --run 2>&1 | grep "sanitize-context"
```

Expected : tous les tests passent, couverture > 95% sur `lib/ai/sanitize-context.ts`.

- [ ] **Step 5 : Commit**

```bash
git add lib/ai/sanitize-context.ts tests/lib/ai/sanitize-context.test.ts
git commit -m "feat(security): sanitization PII pour prompts LLM avec tokenMap (Plan B Task 1)"
```

---

### Task 2 : Intégrer sanitization dans Fixy route

**Files:**
- Modify: `app/api/syndic/fixy-syndic/route.ts`

- [ ] **Step 1 : Localiser la zone d'assemblage du contexte**

```bash
grep -n "buildSystemPrompt\|callGroq\|context\s*=\|promptContext" app/api/syndic/fixy-syndic/route.ts | head -10
```

Tu cherches l'endroit où le contexte (immeubles, artisans, missions, etc.) est assemblé et passé au prompt builder.

- [ ] **Step 2 : Importer sanitizeContextForLLM**

Ajouter en haut du fichier :

```typescript
import { sanitizeContextForLLM, resolveSanitizedToken } from '@/lib/ai/sanitize-context'
```

- [ ] **Step 3 : Sanitizer avant appel Groq**

Localiser l'endroit où `promptContext` (ou équivalent — l'objet passé à `buildFixySystemPromptFR/PT`) est finalisé. Juste avant l'appel `callGroq`/`buildFixySystemPromptXX`, sanitizer :

```typescript
const { sanitized: sanitizedContext, tokenMap } = sanitizeContextForLLM(promptContext)
const systemPrompt = locale === 'pt'
  ? buildFixySystemPromptPT(sanitizedContext)
  : buildFixySystemPromptFR(sanitizedContext)
```

- [ ] **Step 4 : Résoudre les tokens dans la réponse LLM**

Après réception de `groqResponse.content`, résoudre les tokens éventuels que le LLM aurait inclus :

```typescript
const resolvedContent = typeof groqResponse.content === 'string'
  ? resolveSanitizedToken(groqResponse.content, tokenMap) ?? groqResponse.content
  : groqResponse.content
```

Utiliser `resolvedContent` à la place de `groqResponse.content` quand on renvoie la réponse au client.

⚠️ Si le LLM utilise un token dans un `tool_call` argument (ex: `{ email: '<email:abc12345>' }`), il faut aussi résoudre les tokens dans `tool_calls.arguments` avant exécution serveur. Si tu vois ce cas, applique `resolveSanitizedToken` récursivement aux strings dans `arguments` via un helper local.

- [ ] **Step 5 : Vérifier tsc**

```bash
npx tsc --noEmit 2>&1 | grep "fixy-syndic" | head -5
```

- [ ] **Step 6 : Commit**

```bash
git add app/api/syndic/fixy-syndic/route.ts
git commit -m "feat(security): Fixy sanitize PII contexte avant Groq (Plan B Task 2)"
```

---

### Task 3 : Intégrer sanitization dans Max route

**Files:**
- Modify: `app/api/syndic/max-ai/route.ts`

- [ ] **Step 1 : Mêmes étapes que Task 2 mais pour max-ai/route.ts**

```typescript
import { sanitizeContextForLLM, resolveSanitizedToken } from '@/lib/ai/sanitize-context'

// Avant buildMaxSystemPromptFR/PT :
const { sanitized: sanitizedContext, tokenMap } = sanitizeContextForLLM(promptContext)
const systemPrompt = locale === 'pt'
  ? buildMaxSystemPromptPT(sanitizedContext)
  : buildMaxSystemPromptFR(sanitizedContext)

// Après réception réponse :
const resolvedContent = typeof groqResponse.content === 'string'
  ? resolveSanitizedToken(groqResponse.content, tokenMap) ?? groqResponse.content
  : groqResponse.content
```

⚠️ Max a un cas spécifique : le streaming SSE. Chaque chunk reçu doit aussi être résolu avant push au client. Dans le `ReadableStream`, après chaque chunk `data.delta` reçu, applique `resolveSanitizedToken(delta, tokenMap)` avant `controller.enqueue`.

- [ ] **Step 2 : tsc + commit**

```bash
npx tsc --noEmit 2>&1 | grep "max-ai" | head -5
git add app/api/syndic/max-ai/route.ts
git commit -m "feat(security): Max sanitize PII contexte + SSE chunks (Plan B Task 3)"
```

---

### Task 4 : Intégrer sanitization dans Léa route

**Files:**
- Modify: `app/api/syndic/lea-comptable/route.ts`

- [ ] **Step 1 : Mêmes étapes pour lea-comptable**

```typescript
import { sanitizeContextForLLM, resolveSanitizedToken } from '@/lib/ai/sanitize-context'
```

Léa supporte streaming SSE depuis Plan A Task 26. Applique la résolution chunks comme pour Max.

- [ ] **Step 2 : tsc + commit**

```bash
npx tsc --noEmit 2>&1 | grep "lea-comptable" | head -5
git add app/api/syndic/lea-comptable/route.ts
git commit -m "feat(security): Léa sanitize PII contexte + SSE chunks (Plan B Task 4)"
```

---

### Task 5 : Tests d'intégration anti-régression

**Files:**
- Create: `tests/api/agents-pii-sanitization.test.ts`

- [ ] **Step 1 : Tests qui mockent le route handler et vérifient que le payload envoyé à Groq ne contient pas d'email en clair**

```typescript
// tests/api/agents-pii-sanitization.test.ts
import { describe, it, expect } from 'vitest'
import { sanitizeContextForLLM } from '@/lib/ai/sanitize-context'

describe('Agents PII sanitization integration', () => {
  it('un contexte typique syndic est correctement sanitizé', () => {
    const realContext = {
      cabinet: { nom: 'Cabinet Dupont', email: 'contact@cabinet-dupont.fr' },
      artisans: [
        { id: 'a1', nom: 'Jean Plombier', email: 'jean@plombier.fr', phone: '+33612345678' },
        { id: 'a2', nom: 'Maria Eletricista', email: 'maria@eletro.pt', phone: '+351912345678' },
      ],
      coproprios: [
        { nom: 'M. Costa', address: '12 rua das Flores, 4000 Porto', iban: 'PT50000201231234567890154' },
      ],
    }

    const { sanitized, tokenMap } = sanitizeContextForLLM(realContext)
    const serialized = JSON.stringify(sanitized)

    // Aucune PII en clair dans le payload sérialisé
    expect(serialized).not.toContain('jean@plombier.fr')
    expect(serialized).not.toContain('maria@eletro.pt')
    expect(serialized).not.toContain('+33612345678')
    expect(serialized).not.toContain('+351912345678')
    expect(serialized).not.toContain('PT50000201231234567890154')
    expect(serialized).not.toContain('rua das Flores')

    // Mais les tokens sont bien présents
    expect(serialized).toMatch(/<email:[a-f0-9]{8}>/)
    expect(serialized).toMatch(/<phone:[a-f0-9]{8}>/)
    expect(serialized).toMatch(/<iban:[a-f0-9]{8}>/)
    expect(serialized).toMatch(/<address:[a-f0-9]{8}>/)

    // tokenMap contient bien toutes les valeurs originales
    expect(Array.from(tokenMap.values())).toContain('jean@plombier.fr')
    expect(Array.from(tokenMap.values())).toContain('+33612345678')
    expect(Array.from(tokenMap.values())).toContain('PT50000201231234567890154')
  })
})
```

- [ ] **Step 2 : Run tests**

```bash
npm run test tests/api/agents-pii-sanitization.test.ts -- --run
```

- [ ] **Step 3 : Commit**

```bash
git add tests/api/agents-pii-sanitization.test.ts
git commit -m "test(security): anti-régression sanitization PII payload Groq (Plan B Task 5)"
```

---

## Phase B.1 — Encryption tokens OAuth (chunk 7 du spec)

### Task 6 : Migration SQL phase 1+2 (ajouter colonnes chiffrées)

**Files:**
- Create: `supabase/migrations/20260512_encrypt_oauth_tokens.sql`
- Create: `tests/migrations/encrypt_oauth_tokens.test.ts`

- [ ] **Step 1 : Créer la migration**

```sql
-- supabase/migrations/20260512_encrypt_oauth_tokens.sql
-- ══════════════════════════════════════════════════════════════════════════════
-- Migration — Encryption tokens OAuth Gmail (Plan B Chunk 7)
-- Date: 2026-05-12
-- ══════════════════════════════════════════════════════════════════════════════
-- Phase 1 : Ajouter colonnes chiffrées (bytea) en parallèle des colonnes
--           plain. Permet d'écrire les deux pendant la transition.
-- Phase 2 : Backfill (via scripts/migrate-encrypt-oauth-tokens.ts)
-- Phase 3 : Code applicatif lit/écrit via lib/oauth/tokens.ts (lit
--           uniquement les colonnes chiffrées)
-- Phase 4 : Drop des colonnes plain (différé Plan D, séparée pour rollback safety)
--
-- Algorithme : pgcrypto pgp_sym_encrypt (AES-256 symétrique).
-- Clé : Cloudflare Wrangler secret OAUTH_TOKENS_ENCRYPTION_KEY, jamais en .env.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE syndic_oauth_tokens
  ADD COLUMN access_token_enc bytea,
  ADD COLUMN refresh_token_enc bytea,
  ADD COLUMN encryption_version smallint NOT NULL DEFAULT 1;

COMMENT ON COLUMN syndic_oauth_tokens.access_token_enc IS
  'Token OAuth Gmail chiffré pgcrypto. Lecture via pgp_sym_decrypt(col, key).';
COMMENT ON COLUMN syndic_oauth_tokens.refresh_token_enc IS
  'Refresh token OAuth Gmail chiffré pgcrypto.';
COMMENT ON COLUMN syndic_oauth_tokens.encryption_version IS
  '1 = AES-256 pgp_sym, clé courante. Permet rotation future.';
```

- [ ] **Step 2 : Créer test placeholder**

```typescript
// tests/migrations/encrypt_oauth_tokens.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Migration encrypt_oauth_tokens.sql', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260512_encrypt_oauth_tokens.sql'),
    'utf-8',
  )

  it('active pgcrypto', () => {
    expect(sql).toMatch(/CREATE EXTENSION IF NOT EXISTS pgcrypto/)
  })

  it('ajoute les 3 colonnes encrypted', () => {
    expect(sql).toMatch(/ADD COLUMN access_token_enc bytea/)
    expect(sql).toMatch(/ADD COLUMN refresh_token_enc bytea/)
    expect(sql).toMatch(/ADD COLUMN encryption_version smallint/)
  })

  it('ne drop PAS les colonnes plain (phase 4 différée)', () => {
    expect(sql).not.toMatch(/DROP COLUMN access_token\b/)
    expect(sql).not.toMatch(/DROP COLUMN refresh_token\b/)
  })

  it('ne rename PAS les colonnes (phase 4)', () => {
    expect(sql).not.toMatch(/RENAME COLUMN access_token_enc/)
  })
})
```

- [ ] **Step 3 : Run tests + commit**

```bash
npm run test tests/migrations/encrypt_oauth_tokens.test.ts -- --run
git add supabase/migrations/20260512_encrypt_oauth_tokens.sql tests/migrations/encrypt_oauth_tokens.test.ts
git commit -m "feat(security): migration phase 1 — colonnes encrypted OAuth tokens (Plan B Task 6)"
```

---

### Task 7 : Wrapper `lib/oauth/tokens.ts`

**Files:**
- Create: `lib/oauth/tokens.ts`
- Create: `tests/lib/oauth/tokens.test.ts`

- [ ] **Step 1 : Test TDD round-trip**

```typescript
// tests/lib/oauth/tokens.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getDecryptedToken,
  setEncryptedToken,
  getEncryptionKey,
  ENCRYPTION_VERSION,
} from '@/lib/oauth/tokens'

describe('OAuth tokens encryption wrapper', () => {
  describe('getEncryptionKey', () => {
    it('lit la clé depuis process.env.OAUTH_TOKENS_ENCRYPTION_KEY', () => {
      process.env.OAUTH_TOKENS_ENCRYPTION_KEY = 'test-key-32-chars-long-padding!!'
      expect(getEncryptionKey()).toBe('test-key-32-chars-long-padding!!')
    })

    it('throw si la clé absente', () => {
      delete process.env.OAUTH_TOKENS_ENCRYPTION_KEY
      expect(() => getEncryptionKey()).toThrow(/OAUTH_TOKENS_ENCRYPTION_KEY/)
    })

    it('throw si la clé < 32 chars (sécurité minimale)', () => {
      process.env.OAUTH_TOKENS_ENCRYPTION_KEY = 'too-short'
      expect(() => getEncryptionKey()).toThrow(/at least 32/)
    })
  })

  describe('ENCRYPTION_VERSION', () => {
    it('expose la version courante = 1', () => {
      expect(ENCRYPTION_VERSION).toBe(1)
    })
  })

  // Les tests setEncryptedToken / getDecryptedToken nécessitent un client Supabase mocké
  describe('round-trip via Supabase client mocké', () => {
    let mockClient: any

    beforeEach(() => {
      process.env.OAUTH_TOKENS_ENCRYPTION_KEY = 'test-key-32-chars-long-padding!!'
    })

    it('setEncryptedToken appelle update avec pgp_sym_encrypt via RPC', async () => {
      const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null })
      mockClient = { rpc: rpcMock }

      await setEncryptedToken(mockClient, {
        syndic_id: 's1',
        access_token: 'ya29.A0...',
        refresh_token: '1//0g...',
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      })

      expect(rpcMock).toHaveBeenCalledWith(
        'set_encrypted_oauth_token',
        expect.objectContaining({
          p_syndic_id: 's1',
          p_access_token: 'ya29.A0...',
          p_refresh_token: '1//0g...',
        })
      )
    })

    it('getDecryptedToken appelle pgp_sym_decrypt via RPC', async () => {
      const rpcMock = vi.fn().mockResolvedValue({
        data: { access_token: 'ya29.A0...', refresh_token: '1//0g...', expires_at: '2026-05-12T00:00:00Z' },
        error: null,
      })
      mockClient = { rpc: rpcMock }

      const result = await getDecryptedToken(mockClient, 's1')

      expect(rpcMock).toHaveBeenCalledWith(
        'get_decrypted_oauth_token',
        expect.objectContaining({ p_syndic_id: 's1' }),
      )
      expect(result?.access_token).toBe('ya29.A0...')
    })

    it('getDecryptedToken retourne null si syndic inconnu', async () => {
      mockClient = { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) }
      const result = await getDecryptedToken(mockClient, 'unknown')
      expect(result).toBeNull()
    })
  })
})
```

- [ ] **Step 2 : Run (FAIL)**

```bash
npm run test tests/lib/oauth/tokens.test.ts -- --run
```

- [ ] **Step 3 : Implémenter le wrapper**

```typescript
// lib/oauth/tokens.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export const ENCRYPTION_VERSION = 1

interface DecryptedToken {
  access_token: string
  refresh_token: string
  expires_at: string
}

interface SetTokenParams {
  syndic_id: string
  access_token: string
  refresh_token: string
  expires_at: string
}

/**
 * Lit la clé d'encryption depuis l'environnement.
 * En Cloudflare Workers, la clé est injectée via Wrangler secret.
 * En local/CI, via .env (DEV ONLY, à ne pas commit).
 */
export function getEncryptionKey(): string {
  const key = process.env.OAUTH_TOKENS_ENCRYPTION_KEY
  if (!key) {
    throw new Error('OAUTH_TOKENS_ENCRYPTION_KEY is not set')
  }
  if (key.length < 32) {
    throw new Error('OAUTH_TOKENS_ENCRYPTION_KEY must be at least 32 chars')
  }
  return key
}

/**
 * Chiffre + stocke un couple access_token/refresh_token pour un syndic.
 * Utilise une fonction RPC PL/pgSQL `set_encrypted_oauth_token` qui appelle
 * pgp_sym_encrypt côté serveur (la clé ne transite pas par le client).
 */
export async function setEncryptedToken(
  client: SupabaseClient<unknown>,
  params: SetTokenParams,
): Promise<void> {
  const { error } = await client.rpc('set_encrypted_oauth_token', {
    p_syndic_id: params.syndic_id,
    p_access_token: params.access_token,
    p_refresh_token: params.refresh_token,
    p_expires_at: params.expires_at,
    p_encryption_version: ENCRYPTION_VERSION,
  })
  if (error) {
    throw new Error(`setEncryptedToken failed: ${error.message}`)
  }
}

/**
 * Récupère + déchiffre le token d'un syndic.
 * Retourne null si aucun token n'est stocké pour ce syndic.
 */
export async function getDecryptedToken(
  client: SupabaseClient<unknown>,
  syndicId: string,
): Promise<DecryptedToken | null> {
  const { data, error } = await client.rpc('get_decrypted_oauth_token', {
    p_syndic_id: syndicId,
  })
  if (error) {
    throw new Error(`getDecryptedToken failed: ${error.message}`)
  }
  if (!data) return null
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  }
}
```

- [ ] **Step 4 : Ajouter les fonctions RPC PL/pgSQL au SQL de la migration**

Édite `supabase/migrations/20260512_encrypt_oauth_tokens.sql`, ajoute à la fin :

```sql
-- ── Fonctions RPC pour encrypt/decrypt côté serveur ──────────────────────────
-- La clé est passée en paramètre par l'appelant (lue depuis env Cloudflare).
-- Postgres ne stocke jamais la clé.

CREATE OR REPLACE FUNCTION set_encrypted_oauth_token(
  p_syndic_id uuid,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamptz,
  p_encryption_version smallint DEFAULT 1
) RETURNS void AS $$
DECLARE
  v_key text := current_setting('app.oauth_encryption_key', true);
BEGIN
  IF v_key IS NULL OR length(v_key) < 32 THEN
    RAISE EXCEPTION 'app.oauth_encryption_key must be set via SET LOCAL';
  END IF;

  INSERT INTO syndic_oauth_tokens (
    syndic_id,
    access_token_enc,
    refresh_token_enc,
    token_expiry,
    encryption_version
  ) VALUES (
    p_syndic_id,
    pgp_sym_encrypt(p_access_token, v_key),
    pgp_sym_encrypt(p_refresh_token, v_key),
    p_expires_at,
    p_encryption_version
  )
  ON CONFLICT (syndic_id) DO UPDATE
    SET access_token_enc = EXCLUDED.access_token_enc,
        refresh_token_enc = EXCLUDED.refresh_token_enc,
        token_expiry = EXCLUDED.token_expiry,
        encryption_version = EXCLUDED.encryption_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_decrypted_oauth_token(p_syndic_id uuid)
RETURNS TABLE (
  access_token text,
  refresh_token text,
  expires_at timestamptz
) AS $$
DECLARE
  v_key text := current_setting('app.oauth_encryption_key', true);
BEGIN
  IF v_key IS NULL OR length(v_key) < 32 THEN
    RAISE EXCEPTION 'app.oauth_encryption_key must be set via SET LOCAL';
  END IF;

  RETURN QUERY
    SELECT
      pgp_sym_decrypt(t.access_token_enc, v_key) AS access_token,
      pgp_sym_decrypt(t.refresh_token_enc, v_key) AS refresh_token,
      t.token_expiry AS expires_at
    FROM syndic_oauth_tokens t
    WHERE t.syndic_id = p_syndic_id
      AND t.access_token_enc IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RLS : seul le service role peut appeler ces fonctions (ne pas exposer aux users)
REVOKE EXECUTE ON FUNCTION set_encrypted_oauth_token FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION get_decrypted_oauth_token FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION set_encrypted_oauth_token TO service_role;
GRANT EXECUTE ON FUNCTION get_decrypted_oauth_token TO service_role;
```

**Important** : le wrapper TS `setEncryptedToken/getDecryptedToken` doit faire un `SET LOCAL app.oauth_encryption_key = '<key>'` avant l'appel RPC. Ajustement du wrapper :

```typescript
// Dans setEncryptedToken et getDecryptedToken, AVANT l'appel rpc :
await client.rpc('set_config', {
  parameter: 'app.oauth_encryption_key',
  value: getEncryptionKey(),
  is_local: true,
})
```

Note : `set_config` est une fonction PG native. Vérifie qu'elle est exposée en RPC ou utilise `client.from('_').select` style — selon le pattern du projet.

Alternative plus simple : passer la clé directement en argument à la fonction RPC :

```sql
CREATE OR REPLACE FUNCTION set_encrypted_oauth_token(
  p_syndic_id uuid,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamptz,
  p_encryption_key text,  -- ⚠️ La clé transite par le client mais reste protégée par TLS + GRANT service_role
  p_encryption_version smallint DEFAULT 1
) ...
```

**Choisis l'option A (SET LOCAL via set_config) qui est plus sûre.** Si trop complexe, fallback option B.

- [ ] **Step 5 : Update les tests pour matcher l'API choisie**

Ajuste `tests/lib/oauth/tokens.test.ts` selon l'option choisie (vérifier que `set_config` est appelé avant chaque RPC encrypt/decrypt).

- [ ] **Step 6 : Run tests + commit**

```bash
npm run test tests/lib/oauth/tokens.test.ts -- --run
git add lib/oauth/tokens.ts tests/lib/oauth/tokens.test.ts supabase/migrations/20260512_encrypt_oauth_tokens.sql
git commit -m "feat(security): wrapper encrypt/decrypt OAuth tokens via pgcrypto RPC (Plan B Task 7)"
```

---

### Task 8 : Script backfill

**Files:**
- Create: `scripts/migrate-encrypt-oauth-tokens.ts`

- [ ] **Step 1 : Écrire le script one-shot**

```typescript
// scripts/migrate-encrypt-oauth-tokens.ts
// ──────────────────────────────────────────────────────────────────────────────
// Script one-shot : encrypte tous les tokens OAuth existants (plain) vers les
// colonnes chiffrées via le wrapper. À lancer une fois après application de la
// migration 20260512_encrypt_oauth_tokens.sql.
//
// Usage :
//   OAUTH_TOKENS_ENCRYPTION_KEY="$(wrangler secret get OAUTH_TOKENS_ENCRYPTION_KEY)" \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   NEXT_PUBLIC_SUPABASE_URL=... \
//   npx tsx scripts/migrate-encrypt-oauth-tokens.ts --dry-run
//
// Puis sans --dry-run pour appliquer.
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { setEncryptedToken, getEncryptionKey } from '@/lib/oauth/tokens'

interface PlainRow {
  syndic_id: string
  access_token: string
  refresh_token: string
  token_expiry: string
  access_token_enc: Uint8Array | null  // pour skip si déjà migré
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  console.log(`[backfill] mode = ${dryRun ? 'DRY RUN' : 'APPLY'}`)

  getEncryptionKey()  // throw early si clé absente

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Récupère tous les rows non encore chiffrés
  const { data, error } = await client
    .from('syndic_oauth_tokens')
    .select('syndic_id, access_token, refresh_token, token_expiry, access_token_enc')
    .is('access_token_enc', null)

  if (error) {
    console.error('[backfill] fetch failed:', error.message)
    process.exit(1)
  }

  const rows = (data ?? []) as PlainRow[]
  console.log(`[backfill] ${rows.length} rows à migrer`)

  if (dryRun) {
    console.log('[backfill] DRY RUN — aucun changement appliqué')
    rows.forEach(r => console.log(`  - syndic ${r.syndic_id.slice(0, 8)}... access=${r.access_token?.slice(0, 10)}...`))
    process.exit(0)
  }

  let success = 0
  let failed = 0
  for (const row of rows) {
    if (!row.access_token || !row.refresh_token) {
      console.warn(`[backfill] skip ${row.syndic_id.slice(0, 8)} (tokens manquants)`)
      failed++
      continue
    }
    try {
      await setEncryptedToken(client, {
        syndic_id: row.syndic_id,
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        expires_at: row.token_expiry,
      })
      success++
      console.log(`[backfill] ✓ ${row.syndic_id.slice(0, 8)}`)
    } catch (err) {
      failed++
      console.error(`[backfill] ✗ ${row.syndic_id.slice(0, 8)}:`, err instanceof Error ? err.message : err)
    }
  }

  console.log(`[backfill] terminé : ${success} success, ${failed} failed sur ${rows.length}`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('[backfill] FATAL:', err)
  process.exit(1)
})
```

- [ ] **Step 2 : Commit (pas de test runtime, c'est un script one-shot)**

```bash
git add scripts/migrate-encrypt-oauth-tokens.ts
git commit -m "feat(security): script backfill encryption OAuth tokens (Plan B Task 8)"
```

---

### Task 9 : Refactor `app/api/email-agent/callback/route.ts`

**Files:**
- Modify: `app/api/email-agent/callback/route.ts`

- [ ] **Step 1 : Localiser l'écriture des tokens**

```bash
grep -n "syndic_oauth_tokens\|access_token\|refresh_token" app/api/email-agent/callback/route.ts | head -10
```

- [ ] **Step 2 : Remplacer l'INSERT/UPSERT direct par le wrapper**

Remplace le bloc d'écriture (probablement `.from('syndic_oauth_tokens').upsert({...})`) par :

```typescript
import { setEncryptedToken } from '@/lib/oauth/tokens'

// À l'endroit du upsert actuel :
await setEncryptedToken(supabase, {
  syndic_id: user.id,
  access_token: tokenResponse.access_token,
  refresh_token: tokenResponse.refresh_token,
  expires_at: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString(),
})
```

⚠️ Conserve quelques colonnes additionnelles existantes (`email_compte`, `scope`, `oauth_nonce`, etc.) via un upsert séparé OU étend le wrapper pour les inclure si simple. Sois pragmatique.

- [ ] **Step 3 : Vérifier + commit**

```bash
npx tsc --noEmit 2>&1 | grep "email-agent/callback" | head -5
git add app/api/email-agent/callback/route.ts
git commit -m "feat(security): callback OAuth utilise setEncryptedToken (Plan B Task 9)"
```

---

### Task 10 : Refactor `app/api/email-agent/poll/route.ts`

**Files:**
- Modify: `app/api/email-agent/poll/route.ts`

- [ ] **Step 1 : Remplacer la lecture des tokens**

```bash
grep -n "access_token\|refresh_token" app/api/email-agent/poll/route.ts | head -10
```

- [ ] **Step 2 : Importer + utiliser getDecryptedToken**

```typescript
import { getDecryptedToken } from '@/lib/oauth/tokens'

// Remplace le .select sur syndic_oauth_tokens par :
const token = await getDecryptedToken(supabase, syndicId)
if (!token) {
  // syndic n'a pas connecté Gmail
  return NextResponse.json({ error: 'gmail_not_connected' }, { status: 404 })
}

// Utilise token.access_token, token.refresh_token, token.expires_at
```

- [ ] **Step 3 : tsc + commit**

```bash
npx tsc --noEmit 2>&1 | grep "email-agent/poll" | head -5
git add app/api/email-agent/poll/route.ts
git commit -m "feat(security): poll route utilise getDecryptedToken (Plan B Task 10)"
```

---

### Task 11 : Refactor `app/api/email-agent/send-response/route.ts`

**Files:**
- Modify: `app/api/email-agent/send-response/route.ts`

- [ ] **Step 1 : Idem Task 10 pour cette route**

```typescript
import { getDecryptedToken } from '@/lib/oauth/tokens'

const token = await getDecryptedToken(supabase, syndicId)
if (!token) {
  return NextResponse.json({ error: 'gmail_not_connected' }, { status: 404 })
}
```

- [ ] **Step 2 : tsc + commit**

```bash
npx tsc --noEmit 2>&1 | grep "email-agent/send-response" | head -5
git add app/api/email-agent/send-response/route.ts
git commit -m "feat(security): send-response utilise getDecryptedToken (Plan B Task 11)"
```

---

### Task 12 : Tests d'intégration + smoke

**Files:**
- Create: `tests/api/oauth-tokens-encryption.test.ts`

- [ ] **Step 1 : Test que les routes email-agent référencent bien le wrapper**

```typescript
// tests/api/oauth-tokens-encryption.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('OAuth tokens encryption integration', () => {
  it('callback route utilise setEncryptedToken', () => {
    const src = readFileSync(
      join(process.cwd(), 'app/api/email-agent/callback/route.ts'),
      'utf-8',
    )
    expect(src).toMatch(/from\s+['"]@\/lib\/oauth\/tokens['"]/)
    expect(src).toMatch(/setEncryptedToken/)
    // Ne fait plus d'upsert direct sur access_token plain
    expect(src).not.toMatch(/\.upsert\(\{[^}]*access_token\s*:/)
  })

  it('poll route utilise getDecryptedToken', () => {
    const src = readFileSync(
      join(process.cwd(), 'app/api/email-agent/poll/route.ts'),
      'utf-8',
    )
    expect(src).toMatch(/getDecryptedToken/)
  })

  it('send-response route utilise getDecryptedToken', () => {
    const src = readFileSync(
      join(process.cwd(), 'app/api/email-agent/send-response/route.ts'),
      'utf-8',
    )
    expect(src).toMatch(/getDecryptedToken/)
  })
})
```

- [ ] **Step 2 : Run + commit**

```bash
npm run test tests/api/oauth-tokens-encryption.test.ts -- --run
git add tests/api/oauth-tokens-encryption.test.ts
git commit -m "test(security): anti-régression OAuth encryption wrapper usage (Plan B Task 12)"
```

---

## Phase B.2 — Documentation procédure de bascule

### Task 13 : Documentation d'application

**Files:**
- Create: `docs/superpowers/runbooks/2026-05-12-encrypt-oauth-tokens.md`

- [ ] **Step 1 : Runbook complet**

```markdown
# Runbook — Encryption OAuth Tokens (Plan B)

## Pré-requis
1. Générer une clé d'encryption forte (32+ chars) :
   ```bash
   openssl rand -base64 48
   ```
2. La stocker dans Wrangler :
   ```bash
   wrangler secret put OAUTH_TOKENS_ENCRYPTION_KEY
   ```
3. La stocker aussi dans Supabase Vault (pour les fonctions RPC) :
   ```sql
   -- Via Supabase Studio > SQL Editor
   SELECT vault.create_secret('OAUTH_TOKENS_ENCRYPTION_KEY', '<la-clé>');
   ```
4. Confirmer présence : `wrangler secret list` doit montrer la clé.

## Phase 1 — Migration SQL (additive, non destructive)
```bash
# Via Supabase MCP ou supabase db push
# Applique : supabase/migrations/20260512_encrypt_oauth_tokens.sql
```

Vérifier :
```sql
\d syndic_oauth_tokens
-- Doit montrer access_token, refresh_token (plain), access_token_enc, refresh_token_enc (bytea)
```

## Phase 2 — Backfill
```bash
# Dry run d'abord
OAUTH_TOKENS_ENCRYPTION_KEY="<key>" \
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
NEXT_PUBLIC_SUPABASE_URL="https://irluhepekbqgquveaett.supabase.co" \
npx tsx scripts/migrate-encrypt-oauth-tokens.ts --dry-run

# Si OK :
OAUTH_TOKENS_ENCRYPTION_KEY="<key>" \
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
NEXT_PUBLIC_SUPABASE_URL="..." \
npx tsx scripts/migrate-encrypt-oauth-tokens.ts
```

Vérifier :
```sql
SELECT count(*) FILTER (WHERE access_token_enc IS NULL) AS unencrypted,
       count(*) FILTER (WHERE access_token_enc IS NOT NULL) AS encrypted
FROM syndic_oauth_tokens;
```

## Phase 3 — Deploy app
Le code commité utilise déjà `getDecryptedToken/setEncryptedToken`. Déployer normalement :
```bash
git push origin claude/exciting-bardeen-ac4a0b
# Merge to main → deploy-cloudflare.yml applique en prod
```

## Phase 4 (différée — Plan D)
Une fois la prod stable en lecture/écriture chiffrée pendant > 7 jours :
```sql
ALTER TABLE syndic_oauth_tokens
  DROP COLUMN access_token,
  DROP COLUMN refresh_token;
```

## Rollback
Si problème en phase 3, revert le code (les colonnes plain sont toujours là).
Si problème en phase 4 (déjà drop), restaurer depuis backup point-in-time Supabase.
```

- [ ] **Step 2 : Commit**

```bash
git add docs/superpowers/runbooks/2026-05-12-encrypt-oauth-tokens.md
git commit -m "docs(security): runbook bascule encryption OAuth tokens (Plan B Task 13)"
```

---

## Self-Review checklist (Plan B)

- [ ] **Chunk 6 (sanitization PII)** :
  - Task 1 : helper + TDD couverture > 95%
  - Tasks 2-4 : intégration Fixy/Max/Léa avec résolution tokens (côté SSE pour Max + Léa)
  - Task 5 : tests anti-régression
- [ ] **Chunk 7 (encryption tokens)** :
  - Task 6 : migration phase 1 (colonnes encrypted, pas de drop)
  - Task 7 : wrapper TS + fonctions RPC PG avec SECURITY DEFINER + search_path public
  - Task 8 : script backfill avec dry-run
  - Tasks 9-11 : refactor 3 routes email-agent
  - Task 12 : tests d'intégration
  - Task 13 : runbook d'application
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run test` : tous verts (suite Plan A + nouveaux tests Plan B)
- [ ] Aucun TODO/FIXME laissé
- [ ] Phase 4 (drop colonnes plain) bien documentée comme différée vers Plan D

## Hors scope rappel

- Drop des colonnes plain OAuth → Plan D Task X
- Alfredo chat / pipeline / Inbox → Plan C
- Cleanup FixyPanel legacy → Plan D
- Langfuse instrumentation → Plan D

## Application séquentielle conseillée

1. Tasks 1-5 (sanitization PII) — pas de DB, déployable indépendamment
2. Tasks 6-8 (encryption infra + script) — uniquement le code, à déployer **avant** d'appliquer la migration
3. Apply migration 20260512_encrypt_oauth_tokens.sql sur prod (via Supabase MCP avec consent user, ou Supabase branch)
4. Lancer le script backfill (Task 8)
5. Tasks 9-11 (refactor routes) déployés (les routes lisent désormais les colonnes chiffrées)
6. Monitoring 7 jours avant Plan D Task X (drop plain columns)

## Prochaine étape

Après Plan B : Plan C (Alfredo proactif).
