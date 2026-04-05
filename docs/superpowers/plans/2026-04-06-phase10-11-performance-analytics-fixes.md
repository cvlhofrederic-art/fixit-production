# Phase 10-11 Performance & Analytics Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical and high-priority issues identified in Phase 10 (Performance) and Phase 11 (Analytics) audits.

**Architecture:** Targeted fixes across database (indexes + pagination), frontend (fonts + code splitting), backend (circuit breaker + cache usage + maxDuration), and observability (Sentry replay + analytics integration).

**Tech Stack:** Next.js 16, Supabase, Upstash Redis, Sentry, TypeScript, Tailwind CSS

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `app/api/btp/route.ts` | Modify | Add .limit() to 3 unpaginated queries |
| `app/api/user/export-data/route.ts` | Modify | Add maxDuration + per-table limits |
| `app/api/verify-id/route.ts` | Modify | Add maxDuration |
| `app/api/bookings/route.ts` | Modify | Remove duplicate service lookup |
| `lib/circuit-breaker.ts` | Modify | Add cleanup + max entries cap |
| `lib/cache.ts` | No change | Already complete |
| `app/api/artisans-catalogue/route.ts` | Modify | Add cache via cacheable() |
| `app/api/marches/route.ts` | Modify | Add cache via cacheable() |
| `app/layout.tsx` | Modify | Reduce from 7 fonts to 3 |
| `sentry.client.config.ts` | Modify | Enable Session Replay on errors |
| `lib/tenders/dedup.ts` | Modify | Optimize O(n^2) to Map-based O(n) |
| `lib/fuzzy-match.ts` | Modify | Add result memoization cache |

---

### Task 1: Add pagination to BTP queries

**Files:**
- Modify: `app/api/btp/route.ts:34-103`

- [ ] **Step 1: Add .limit(200) to chantiers query**

In `app/api/btp/route.ts`, after `.order('created_at', { ascending: false })` on line 39, add `.limit(200)`:

```typescript
    if (table === 'all' || table === 'chantiers') {
      const { data } = await supabaseAdmin
        .from('chantiers_btp')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200)
      result.chantiers = data || []
    }
```

- [ ] **Step 2: Add .limit(500) to membres query**

After `.order('nom', { ascending: true })` on line 48:

```typescript
    if (table === 'all' || table === 'membres') {
      const { data } = await supabaseAdmin
        .from('membres_btp')
        .select('*')
        .eq('owner_id', user.id)
        .order('nom', { ascending: true })
        .limit(500)
      result.membres = data || []
    }
```

- [ ] **Step 3: Add .limit(500) to depenses query**

After `.order('date', { ascending: false })` on line 81:

```typescript
    if (table === 'all' || table === 'depenses') {
      let q = supabaseAdmin
        .from('depenses_btp')
        .select('*')
        .eq('owner_id', user.id)
        .order('date', { ascending: false })
        .limit(500)
      if (chantierId) q = q.eq('chantier_id', chantierId)
      const { data } = await q
      result.depenses = data || []
    }
```

- [ ] **Step 4: Add .limit(100) to rentabilite view**

```typescript
    if (table === 'rentabilite') {
      const { data } = await supabaseAdmin
        .from('v_rentabilite_chantier')
        .select('*')
        .eq('owner_id', user.id)
        .limit(100)
      result.rentabilite = data || []
    }
```

- [ ] **Step 5: Verify build passes**

Run: `cd /Users/elgato_fofo/Desktop/fixit-production && npx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: no errors related to btp/route.ts

---

### Task 2: Add maxDuration to export and verify routes

**Files:**
- Modify: `app/api/user/export-data/route.ts`
- Modify: `app/api/verify-id/route.ts`

- [ ] **Step 1: Add maxDuration to export-data**

At the top of `app/api/user/export-data/route.ts` (after imports):

```typescript
export const maxDuration = 60
```

- [ ] **Step 2: Add maxDuration to verify-id**

At the top of `app/api/verify-id/route.ts` (after imports):

```typescript
export const maxDuration = 30
```

---

### Task 3: Fix circuit breaker unbounded growth

**Files:**
- Modify: `lib/circuit-breaker.ts`

- [ ] **Step 1: Add MAX_CIRCUITS constant and cleanup**

Replace the full `circuit-breaker.ts` content. Add a max entries cap (20) and a cleanup function that removes CLOSED circuits older than 1 hour:

```typescript
// ── Circuit Breaker Pattern ─────────────────────────────────────────────────
// Prevents cascading failures when external services are down
// States: CLOSED (normal) → OPEN (failing, reject fast) → HALF_OPEN (testing)

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

interface CircuitBreakerOptions {
  failureThreshold: number
  resetTimeoutMs: number
  name: string
}

interface CircuitBreakerState {
  state: CircuitState
  failures: number
  lastFailure: number
  lastSuccess: number
}

const circuits = new Map<string, CircuitBreakerState>()
const MAX_CIRCUITS = 20
const STALE_CIRCUIT_MS = 3600_000 // 1 hour

function cleanupStaleCircuits() {
  if (circuits.size <= MAX_CIRCUITS) return
  const now = Date.now()
  for (const [name, circuit] of circuits) {
    if (circuit.state === 'CLOSED' && now - circuit.lastSuccess > STALE_CIRCUIT_MS) {
      circuits.delete(name)
    }
  }
}

function getCircuit(name: string): CircuitBreakerState {
  if (!circuits.has(name)) {
    cleanupStaleCircuits()
    circuits.set(name, { state: 'CLOSED', failures: 0, lastFailure: 0, lastSuccess: Date.now() })
  }
  return circuits.get(name)!
}

export function createCircuitBreaker(options: CircuitBreakerOptions) {
  const { failureThreshold = 5, resetTimeoutMs = 30000, name } = options

  return async function execute<T>(fn: () => Promise<T>): Promise<T> {
    const circuit = getCircuit(name)

    if (circuit.state === 'OPEN') {
      if (Date.now() - circuit.lastFailure > resetTimeoutMs) {
        circuit.state = 'HALF_OPEN'
      } else {
        throw new Error(`Circuit breaker [${name}] is OPEN — service temporarily unavailable`)
      }
    }

    try {
      const result = await fn()
      circuit.failures = 0
      circuit.state = 'CLOSED'
      circuit.lastSuccess = Date.now()
      return result
    } catch (error) {
      circuit.failures++
      circuit.lastFailure = Date.now()

      if (circuit.failures >= failureThreshold) {
        circuit.state = 'OPEN'
      }

      throw error
    }
  }
}

// Pre-configured circuit breakers for external services
export const groqCircuit = createCircuitBreaker({ name: 'groq', failureThreshold: 5, resetTimeoutMs: 30000 })
export const govApiCircuit = createCircuitBreaker({ name: 'api-gouv', failureThreshold: 3, resetTimeoutMs: 60000 })
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/elgato_fofo/Desktop/fixit-production && npx tsc --noEmit --pretty 2>&1 | grep circuit`
Expected: no errors

---

### Task 4: Activate cache on read-heavy API endpoints

**Files:**
- Modify: `app/api/artisans-catalogue/route.ts`
- Modify: `app/api/marches/route.ts`

- [ ] **Step 1: Read current artisans-catalogue route**

Read the file to understand current query structure before adding cache.

- [ ] **Step 2: Add cacheable import and wrap the Supabase query**

At the top of `app/api/artisans-catalogue/route.ts`, add:

```typescript
import { cacheable, cacheDel } from '@/lib/cache'
```

Wrap the main GET query with cacheable. Cache key should include query params (service, country). TTL 600s (10 min):

```typescript
const cacheKey = `catalogue:${service || 'all'}:${country || 'all'}:${page || 0}`
const data = await cacheable(cacheKey, async () => {
  const { data } = await supabaseAdmin
    .from(/* existing query */)
    // ... existing query chain
  return data
}, 600)
```

- [ ] **Step 3: Read current marches route and add caching**

Same pattern for `/api/marches/route.ts` GET handler. Cache key: `marches:${status}:${country}:${page}`, TTL 300s.

- [ ] **Step 4: Verify build**

Run: `cd /Users/elgato_fofo/Desktop/fixit-production && npx tsc --noEmit --pretty 2>&1 | tail -5`

---

### Task 5: Reduce fonts from 7 to 3

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Remove Syne, Playfair_Display, IBM_Plex_Mono imports and declarations**

Keep only: DM_Sans (primary body), Montserrat (headings), Outfit (dashboards). Remove Syne, Playfair_Display, IBM_Plex_Sans, IBM_Plex_Mono.

Replace lines 1-61 of `app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import { PHONE_FR, PHONE_PT } from "@/lib/constants";
import { DM_Sans, Montserrat, Outfit } from "next/font/google";
import { cookies, headers } from "next/headers";
import "./globals.css";
import ConditionalLayout from "@/components/common/ConditionalLayout";
import CookieConsent from "@/components/common/CookieConsent";
import Providers from "@/components/common/Providers";
import ConsentAnalytics from "@/components/common/ConsentAnalytics";
import type { Locale } from "@/lib/i18n/config";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});
```

- [ ] **Step 2: Update the className in the body tag**

Find the `<body>` tag and update the className to only include the 3 remaining font variables:

```typescript
className={`${dmSans.variable} ${montserrat.variable} ${outfit.variable} antialiased`}
```

Remove references to `syne.variable`, `playfairDisplay.variable`, `ibmPlexSans.variable`, `ibmPlexMono.variable`.

- [ ] **Step 3: Search for CSS usage of removed fonts**

Run: `grep -r "font-syne\|font-playfair\|font-ibm-plex" --include="*.css" --include="*.tsx" --include="*.ts" /Users/elgato_fofo/Desktop/fixit-production/app /Users/elgato_fofo/Desktop/fixit-production/components | head -20`

For each file found, replace:
- `font-syne` → `font-montserrat`
- `font-playfair` → `font-montserrat`
- `font-ibm-plex-sans` → `font-dm-sans`
- `font-ibm-plex-mono` → `font-mono` (Tailwind system mono)

- [ ] **Step 4: Update CSS custom properties if needed**

In `globals.css` or Tailwind config, ensure `--font-syne`, `--font-playfair`, `--font-ibm-plex-sans`, `--font-ibm-plex-mono` are either removed or aliased to the remaining fonts.

- [ ] **Step 5: Verify build**

Run: `cd /Users/elgato_fofo/Desktop/fixit-production && npm run build 2>&1 | tail -20`
Expected: build succeeds

---

### Task 6: Enable Sentry Session Replay on errors

**Files:**
- Modify: `sentry.client.config.ts`

- [ ] **Step 1: Enable replaysOnErrorSampleRate**

In `sentry.client.config.ts`, change line 17:

```typescript
  replaysOnErrorSampleRate: 1.0,
```

This captures a replay only when an error occurs (no performance impact on normal sessions).

- [ ] **Step 2: Bump tracesSampleRate for launch phase**

Change line 13:

```typescript
  tracesSampleRate: 1.0,
```

Note: revert to 0.1 after launch stabilization (when traffic > 1000 users/day).

---

### Task 7: Optimize tender dedup from O(n^2) to O(n)

**Files:**
- Modify: `lib/tenders/dedup.ts`

- [ ] **Step 1: Replace nested loop with Map-based grouping**

The current algorithm compares every tender against all kept tenders. Optimize by grouping by (normCity, deadlineDay) first, then only comparing within groups:

```typescript
export function deduplicateTenders(tenders: Tender[]): Tender[] {
  if (tenders.length <= 1) return tenders

  const entries = tenders.map((t) => ({
    tender: t,
    normTitle: normalizeForDedup(t.title),
    normCity: normalizeForDedup(t.city),
    deadlineDay: t.deadline ? t.deadline.slice(0, 10) : '',
    score: richness(t),
  }))

  // Group by (city, deadline) to reduce comparison space
  const groups = new Map<string, typeof entries>()
  for (const entry of entries) {
    const key = `${entry.normCity}|${entry.deadlineDay}`
    const group = groups.get(key)
    if (group) {
      group.push(entry)
    } else {
      groups.set(key, [entry])
    }
  }

  const kept: typeof entries = []

  for (const group of groups.values()) {
    // Within each group, deduplicate by title similarity
    const groupKept: typeof entries = []
    for (const entry of group) {
      let isDuplicate = false
      for (let i = 0; i < groupKept.length; i++) {
        const existing = groupKept[i]
        const sim = jaccardSimilarity(entry.normTitle, existing.normTitle)
        if (sim >= SIMILARITY_THRESHOLD) {
          if (entry.score > existing.score) {
            groupKept[i] = entry
          }
          isDuplicate = true
          break
        }
      }
      if (!isDuplicate) {
        groupKept.push(entry)
      }
    }
    kept.push(...groupKept)
  }

  return kept.map((e) => e.tender)
}
```

This reduces from O(n^2) to O(n * k) where k = average group size (typically 2-5 vs n=5000).

- [ ] **Step 2: Verify build**

Run: `cd /Users/elgato_fofo/Desktop/fixit-production && npx tsc --noEmit --pretty 2>&1 | grep dedup`

---

### Task 8: Add memoization to fuzzy-match

**Files:**
- Modify: `lib/fuzzy-match.ts`

- [ ] **Step 1: Add similarity cache at module level**

Add a bounded LRU-style cache for similarity scores at the top of the file:

```typescript
const similarityCache = new Map<string, number>()
const SIMILARITY_CACHE_MAX = 1000

function cachedSimilarity(a: string, b: string): number {
  const key = a < b ? `${a}|${b}` : `${b}|${a}`
  const cached = similarityCache.get(key)
  if (cached !== undefined) return cached

  if (similarityCache.size >= SIMILARITY_CACHE_MAX) {
    const firstKey = similarityCache.keys().next().value
    if (firstKey) similarityCache.delete(firstKey)
  }

  const score = similarity(a, b)
  similarityCache.set(key, score)
  return score
}
```

- [ ] **Step 2: Use cachedSimilarity in fuzzyFind**

In the `fuzzyFind` function, replace `similarity(search, name)` on line 81 with `cachedSimilarity(searchNorm, normalizeForSearch(name))` and `similarity(sw, iw)` on line 91 with `cachedSimilarity(sw, iw)`.

- [ ] **Step 3: Verify build**

Run: `cd /Users/elgato_fofo/Desktop/fixit-production && npx tsc --noEmit --pretty 2>&1 | grep fuzzy`

---

### Task 9: Remove duplicate service lookup in bookings

**Files:**
- Modify: `app/api/bookings/route.ts:138-146`

- [ ] **Step 1: Reuse existing service data**

The booking POST handler already fetches services earlier in the flow. At line 138-146, there's a duplicate lookup of the service name for notification. Instead, pass the service name from the earlier query or extract it from the already-fetched data.

Find the earlier service fetch and store its name. Then at line 138, replace the duplicate query with the stored value:

```typescript
        let serviceName = 'Intervention'
        if (service_id && existingServiceName) {
          serviceName = existingServiceName
        }
```

Remove the `supabaseAdmin.from('services').select('name')` call in the notification block.

---

### Task 10: Integrate analytics tracking in key flows

**Files:**
- Modify: `app/auth/register/page.tsx`
- Modify: `app/pro/register/page.tsx`
- Modify: `components/common/ConsentAnalytics.tsx`

- [ ] **Step 1: Add trackPageView to ConsentAnalytics**

In `components/common/ConsentAnalytics.tsx`, import and call `trackPageView` alongside Vercel Analytics:

```typescript
import { trackPageView } from '@/lib/analytics'
```

Inside the effect that checks consent, add `trackPageView()` call when performance consent is granted.

- [ ] **Step 2: Add signup_started event to client registration**

In `app/auth/register/page.tsx`, import `trackEvent` and `AnalyticsEventType`:

```typescript
import { trackEvent, AnalyticsEventType } from '@/lib/analytics'
```

Fire `trackEvent(AnalyticsEventType.SIGNUP_STARTED, { role: 'client', client_type })` when the form is submitted.

Fire `trackEvent(AnalyticsEventType.SIGNUP_COMPLETED, { role: 'client' })` on successful signup.

- [ ] **Step 3: Add signup events to pro registration**

Same pattern in `app/pro/register/page.tsx`:

```typescript
trackEvent(AnalyticsEventType.SIGNUP_STARTED, { role: orgType })
trackEvent(AnalyticsEventType.SIGNUP_COMPLETED, { role: orgType })
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/elgato_fofo/Desktop/fixit-production && npx tsc --noEmit --pretty 2>&1 | tail -10`

---

### Task 11: Final verification

- [ ] **Step 1: Run full type check**

Run: `cd /Users/elgato_fofo/Desktop/fixit-production && npx tsc --noEmit --pretty`
Expected: 0 errors

- [ ] **Step 2: Run unit tests**

Run: `cd /Users/elgato_fofo/Desktop/fixit-production && npm run test`
Expected: all tests pass

- [ ] **Step 3: Run build**

Run: `cd /Users/elgato_fofo/Desktop/fixit-production && npm run build 2>&1 | tail -30`
Expected: build succeeds
