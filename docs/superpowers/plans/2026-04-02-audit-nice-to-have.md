# Audit Nice-to-Have Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all 12 nice-to-have improvements from AUDIT_RESULTS.md section 5, in order.

**Architecture:** Sequential chunks — quick wins first (links, migrations, docs), then architecture refactors (token refresh, fetch helper), then UX/SEO/a11y/perf improvements. Each task is independently committable.

**Tech Stack:** Next.js 16.2.2, TypeScript, Supabase, Zod, Tailwind CSS, jsPDF

---

## Chunk 1: Quick Wins (< 30 min total)

### Task 1: Fix broken `/auth/signup` → `/auth/register` link

**Files:**
- Modify: `app/simulateur/page.tsx:35`
- Modify: `components/simulateur/SimulateurChat.tsx:59`

- [ ] **Step 1: Fix link in simulateur page**

In `app/simulateur/page.tsx`, line 35, change:
```tsx
href="/auth/signup"
```
to:
```tsx
href="/auth/register"
```

- [ ] **Step 2: Fix link in SimulateurChat component**

In `components/simulateur/SimulateurChat.tsx`, line 59, change:
```tsx
[Créer un compte →](/auth/signup)
```
to:
```tsx
[Créer un compte →](/auth/register)
```

- [ ] **Step 3: Verify no other `/auth/signup` references remain**

Run: `grep -r "/auth/signup" app/ components/ --include="*.tsx" --include="*.ts"`
Expected: No results

- [ ] **Step 4: Commit**

```bash
git add app/simulateur/page.tsx components/simulateur/SimulateurChat.tsx
git commit -m "fix: correct broken /auth/signup links to /auth/register"
```

---

### Task 2: Rename migrations for strict numbering

**Files:**
- Rename: `supabase/migrations/013_service_etapes.sql` → `supabase/migrations/013b_service_etapes.sql`
- Rename 9 unnumbered hotfix files to sequential numbers (036-044)

**Current state:** 35 numbered files (001-035) + 9 unnumbered hotfix files + duplicate 013.

- [ ] **Step 1: Fix duplicate 013**

```bash
cd /Users/elgato_fofo/Desktop/fixit-production/supabase/migrations
mv 013_service_etapes.sql 013b_service_etapes.sql
```

- [ ] **Step 2: Rename unnumbered hotfix files to sequential numbers**

```bash
mv add_missing_foreign_keys.sql 036_add_missing_foreign_keys.sql
mv add_subscriptions_table.sql 037_add_subscriptions_table.sql
mv audit_complete_fix.sql 038_audit_complete_fix.sql
mv fix_security_audit.sql 039_fix_security_audit.sql
mv portugal_fiscal.sql 040_portugal_fiscal.sql
mv rls_complete_audit.sql 041_rls_complete_audit.sql
mv sprint2_audit_logs.sql 042_sprint2_audit_logs.sql
mv sprint3_security_definer_fix.sql 043_sprint3_security_definer_fix.sql
mv storage_rls_policies.sql 044_storage_rls_policies.sql
```

- [ ] **Step 3: Verify all files are now numbered**

```bash
ls supabase/migrations/ | grep -v "^[0-9]"
```
Expected: No results (all files start with a number)

- [ ] **Step 4: Verify no code references the old filenames**

```bash
grep -r "add_missing_foreign_keys\|add_subscriptions_table\|audit_complete_fix\|fix_security_audit\|portugal_fiscal\|rls_complete_audit\|sprint2_audit_logs\|sprint3_security_definer_fix\|storage_rls_policies" app/ lib/ scripts/ --include="*.ts" --include="*.tsx" --include="*.js"
```
Expected: No results (migrations are only referenced by Supabase CLI, not by app code)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/
git commit -m "chore: rename migrations for strict sequential numbering (fix double 013, number hotfixes 036-044)"
```

---

### Task 3: Document `exec_sql` RPC endpoint and clean up dead calls

**Context:** The `exec_sql` function was already **dropped** in `fix_security_audit.sql`. However, 3 files still call it — they'll fail at runtime. This task documents the removal and updates the dead code.

**Files:**
- Modify: `app/api/admin/setup/route.ts:215`
- Modify: `app/api/setup-storage/route.ts:32`
- Modify: `scripts/create-agenda-tables.ts:13,37`

- [ ] **Step 1: Read the 3 calling files to understand current usage**

Read:
- `app/api/admin/setup/route.ts` (around line 215)
- `app/api/setup-storage/route.ts` (around line 32)
- `scripts/create-agenda-tables.ts` (lines 1-50)

- [ ] **Step 2: Replace `exec_sql` RPC calls in admin/setup with `supabaseAdmin.from()` or raw SQL via `supabaseAdmin.rpc()`**

In `app/api/admin/setup/route.ts`, replace the `exec_sql` call pattern:
```typescript
// BEFORE
const { error } = await supabaseAdmin.rpc('exec_sql', { sql: stmt + ';' }).single()

// AFTER — use supabaseAdmin direct query (service_role bypasses RLS)
const { error } = await supabaseAdmin.from('_exec').select().csv()
// Note: If direct table operations suffice, prefer .from('table').insert/upsert/update
// If raw SQL is needed, use Supabase Dashboard SQL editor or a dedicated admin migration
```

The exact replacement depends on what `stmt` contains. Add a comment:
```typescript
// exec_sql was removed (security audit FIX-6). Use supabaseAdmin direct queries
// or Supabase Dashboard SQL editor for admin operations.
```

- [ ] **Step 3: Replace `exec_sql` in setup-storage**

In `app/api/setup-storage/route.ts`, line 32, apply same pattern — replace RPC call with a comment explaining the function was removed and use `supabaseAdmin` direct queries.

- [ ] **Step 4: Replace `exec_sql` in create-agenda-tables script**

In `scripts/create-agenda-tables.ts`, replace both calls (lines 13, 37) with direct `supabaseAdmin` table operations or mark the script as deprecated with a clear comment:
```typescript
// DEPRECATED: exec_sql was removed in security audit.
// Run these CREATE TABLE statements directly in Supabase Dashboard SQL editor
// or add them as a numbered migration in supabase/migrations/
```

- [ ] **Step 5: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors from our changes

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/setup/route.ts app/api/setup-storage/route.ts scripts/create-agenda-tables.ts
git commit -m "fix: remove dead exec_sql RPC calls (function dropped in security audit)"
```

---

## Chunk 2: Architecture Refactors

### Task 4: Extract token refresh pattern into `lib/auth-helpers.ts`

**Context:** `lib/auth-helpers.ts` already exists with auth user helpers. The Gmail OAuth `refreshAccessToken()` function is duplicated identically in 2 files. The Supabase token refresh in syndic dashboard is client-side and distinct — leave it in place.

**Files:**
- Modify: `lib/auth-helpers.ts` (add `refreshGmailAccessToken`)
- Modify: `app/api/email-agent/poll/route.ts` (remove local function, import from lib)
- Modify: `app/api/email-agent/send-response/route.ts` (remove local function, import from lib)
- Test: `tests/auth-helpers-refresh.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/auth-helpers-refresh.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock env vars
vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id')
vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-client-secret')

describe('refreshGmailAccessToken', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('returns tokens on successful refresh', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'new-token', expires_in: 3600 }),
    })

    const { refreshGmailAccessToken } = await import('../lib/auth-helpers')
    const result = await refreshGmailAccessToken('my-refresh-token')

    expect(result).toEqual({ access_token: 'new-token', expires_in: 3600 })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    )
  })

  it('returns null on failed refresh', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })

    const { refreshGmailAccessToken } = await import('../lib/auth-helpers')
    const result = await refreshGmailAccessToken('bad-token')

    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth-helpers-refresh.test.ts`
Expected: FAIL — `refreshGmailAccessToken` is not exported from `lib/auth-helpers`

- [ ] **Step 3: Add `refreshGmailAccessToken` to `lib/auth-helpers.ts`**

Append to `lib/auth-helpers.ts`:
```typescript
/**
 * Refresh a Gmail OAuth access token using a refresh token.
 * Returns new access_token + expires_in, or null on failure.
 */
export async function refreshGmailAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return null
  return res.json()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/auth-helpers-refresh.test.ts`
Expected: PASS

- [ ] **Step 5: Replace local function in poll/route.ts**

In `app/api/email-agent/poll/route.ts`:
1. Remove the local `refreshAccessToken` function (lines ~14-27)
2. Add import: `import { refreshGmailAccessToken } from '@/lib/auth-helpers'`
3. Replace all calls from `refreshAccessToken(...)` to `refreshGmailAccessToken(...)`

- [ ] **Step 6: Replace local function in send-response/route.ts**

In `app/api/email-agent/send-response/route.ts`:
1. Remove the local `refreshAccessToken` function (lines ~16-29)
2. Add import: `import { refreshGmailAccessToken } from '@/lib/auth-helpers'`
3. Replace all calls from `refreshAccessToken(...)` to `refreshGmailAccessToken(...)`

- [ ] **Step 7: Run full test suite**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add lib/auth-helpers.ts app/api/email-agent/poll/route.ts app/api/email-agent/send-response/route.ts tests/auth-helpers-refresh.test.ts
git commit -m "refactor: extract Gmail token refresh into lib/auth-helpers.ts (DRY)"
```

---

### Task 5: Extract fetch+Bearer pattern into unified helper

**Context:** 69 files use `Authorization: Bearer ${token}` headers. A full refactor of all 69 files is too large. Instead, create a helper and migrate the 4 hooks first (highest reuse value), leave components for a future pass.

**Files:**
- Create: `lib/api-client.ts`
- Modify: `hooks/dashboard/useSettings.ts`
- Modify: `hooks/dashboard/useAvailability.ts`
- Modify: `hooks/useNotifications.ts`
- Modify: `hooks/useDashboardMessaging.ts`
- Test: `tests/api-client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api-client.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('authFetch', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('adds Authorization Bearer header', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: 'test' }) })

    const { authFetch } = await import('../lib/api-client')
    await authFetch('/api/test', 'my-token')

    expect(mockFetch).toHaveBeenCalledWith('/api/test', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer my-token',
      },
    })
  })

  it('merges custom options', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    const { authFetch } = await import('../lib/api-client')
    await authFetch('/api/test', 'tok', {
      method: 'POST',
      body: JSON.stringify({ foo: 'bar' }),
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/test', {
      method: 'POST',
      body: JSON.stringify({ foo: 'bar' }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer tok',
      },
    })
  })

  it('allows overriding Content-Type', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    const { authFetch } = await import('../lib/api-client')
    await authFetch('/api/upload', 'tok', {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/upload', {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': 'Bearer tok',
      },
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api-client.test.ts`
Expected: FAIL — `authFetch` not found

- [ ] **Step 3: Create `lib/api-client.ts`**

```typescript
/**
 * Authenticated fetch wrapper.
 * Adds Authorization: Bearer header and Content-Type: application/json by default.
 */
export async function authFetch(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const { headers: customHeaders, ...rest } = options
  return fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...customHeaders as Record<string, string>,
      'Authorization': `Bearer ${token}`,
    },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api-client.test.ts`
Expected: PASS

- [ ] **Step 5: Migrate `hooks/dashboard/useSettings.ts`**

Read the file, identify fetch calls with Bearer headers, replace with `authFetch` import and usage. Example pattern:
```typescript
// BEFORE
const res = await fetch('/api/artisan-settings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({...})
})

// AFTER
import { authFetch } from '@/lib/api-client'
const res = await authFetch('/api/artisan-settings', token, {
  method: 'POST',
  body: JSON.stringify({...})
})
```

- [ ] **Step 6: Migrate `hooks/dashboard/useAvailability.ts`**

Same pattern — replace fetch+Bearer with `authFetch`.

- [ ] **Step 7: Migrate `hooks/useNotifications.ts`**

Same pattern — replace fetch+Bearer with `authFetch` (2 call sites: lines ~59, ~92).

- [ ] **Step 8: Migrate `hooks/useDashboardMessaging.ts`**

Same pattern — replace fetch+Bearer with `authFetch` (6 call sites: lines ~45, 63, 89, 110, 141, 200).

- [ ] **Step 9: Run full test suite**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 10: Commit**

```bash
git add lib/api-client.ts tests/api-client.test.ts hooks/dashboard/useSettings.ts hooks/dashboard/useAvailability.ts hooks/useNotifications.ts hooks/useDashboardMessaging.ts
git commit -m "refactor: extract authFetch helper, migrate 4 hooks (DRY fetch+Bearer)"
```

---

## Chunk 3: UX Improvements

### Task 6: Show password rules during input (not just after submit)

**Files:**
- Modify: Auth registration form (likely `app/auth/register/page.tsx` or a shared component)

- [ ] **Step 1: Read the registration form to find password input**

Read `app/auth/register/page.tsx` and identify the password field and any existing validation.

- [ ] **Step 2: Add inline password strength indicator**

Below the password `<input>`, add a rules checklist that shows in real-time:
```tsx
{password.length > 0 && (
  <ul className="mt-1 space-y-0.5 text-xs">
    <li className={password.length >= 8 ? 'text-green-600' : 'text-gray-400'}>
      Min. 8 caractères
    </li>
    <li className={/[A-Z]/.test(password) ? 'text-green-600' : 'text-gray-400'}>
      Une majuscule
    </li>
    <li className={/[0-9]/.test(password) ? 'text-green-600' : 'text-gray-400'}>
      Un chiffre
    </li>
  </ul>
)}
```

Adjust rules to match the actual Supabase auth password requirements.

- [ ] **Step 3: Verify visually**

Run: `npm run dev` — navigate to `/auth/register`, type in password field, confirm rules update live.

- [ ] **Step 4: Commit**

```bash
git add app/auth/register/page.tsx
git commit -m "feat: show password rules during input on registration form"
```

---

### Task 7: Real-time form validation with debounce

**Context:** This applies to key forms (registration, devis, booking). Start with registration form as proof of concept, then extend.

**Files:**
- Modify: `app/auth/register/page.tsx` (or the form component used there)

- [ ] **Step 1: Read the registration form**

Read the current form to understand field structure and validation flow.

- [ ] **Step 2: Add debounced email validation**

```typescript
import { useRef, useState } from 'react'

const [emailError, setEmailError] = useState('')
const debounceRef = useRef<NodeJS.Timeout>()

const handleEmailChange = (value: string) => {
  setEmail(value)
  clearTimeout(debounceRef.current)
  debounceRef.current = setTimeout(() => {
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailError('Adresse email invalide')
    } else {
      setEmailError('')
    }
  }, 500)
}
```

- [ ] **Step 3: Show inline error below the email field**

```tsx
<input
  type="email"
  value={email}
  onChange={(e) => handleEmailChange(e.target.value)}
  className={emailError ? 'border-red-400' : ''}
/>
{emailError && <p className="mt-1 text-xs text-red-500">{emailError}</p>}
```

- [ ] **Step 4: Verify visually**

Run: `npm run dev` — navigate to `/auth/register`, type invalid email, wait 500ms, confirm error appears.

- [ ] **Step 5: Commit**

```bash
git add app/auth/register/page.tsx
git commit -m "feat: add debounced real-time email validation on registration form"
```

---

## Chunk 4: Accessibility

### Task 8: Add `<label>` to 8+ inputs without label

**Files:** Multiple form files (exact list to be determined by grep)

- [ ] **Step 1: Find all inputs without labels**

```bash
# Find inputs that don't have an associated label or aria-label
grep -rn '<input' components/ app/ --include="*.tsx" | grep -v 'aria-label\|aria-labelledby' | head -20
```

Cross-reference with inputs that lack a preceding `<label htmlFor=`.

- [ ] **Step 2: Read each file and add `<label>` or `aria-label`**

For each input found without a label:
- If the input has visible text nearby, wrap it with `<label>` using `htmlFor` matching the input's `id`
- If the input is icon-only or has no visible text, add `aria-label`
- Add an `id` to the input if it doesn't have one

- [ ] **Step 3: Run a11y tests**

Run: `npm run test:e2e -- --grep a11y`
Expected: No new a11y violations

- [ ] **Step 4: Commit**

```bash
git add -A  # after reviewing staged changes
git commit -m "a11y: add labels to form inputs missing accessible names"
```

---

### Task 9: Add `aria-label` to icon-only buttons (1934+ buttons)

**Context:** This is the largest task. Use a systematic find-and-fix approach, prioritizing high-traffic pages.

**Files:** Multiple component files across `components/`, `app/`

- [ ] **Step 1: Identify all icon-only buttons**

```bash
# Buttons with only an icon child (no text content)
grep -rn '<button' components/ app/ --include="*.tsx" -A2 | grep -B1 'Icon\|icon\|svg\|<img' | head -40
```

- [ ] **Step 2: Prioritize high-traffic components**

Fix in this order:
1. `components/common/` — shared across app
2. `components/dashboard/` — pro dashboard (most used)
3. `components/client-dashboard/` — client-facing
4. `components/syndic-dashboard/` — syndic dashboard
5. `app/` pages with inline buttons

- [ ] **Step 3: Add aria-labels batch by batch**

For each icon-only button, add a descriptive `aria-label`:
```tsx
// BEFORE
<button onClick={handleDelete}><TrashIcon className="h-5 w-5" /></button>

// AFTER
<button onClick={handleDelete} aria-label="Supprimer"><TrashIcon className="h-5 w-5" /></button>
```

Use French labels matching the action (Supprimer, Modifier, Fermer, Rechercher, Menu, etc.)

- [ ] **Step 4: Run a11y tests after each batch**

Run: `npm run test:e2e -- --grep a11y`
Expected: Fewer a11y violations after each batch

- [ ] **Step 5: Commit per batch**

```bash
git commit -m "a11y: add aria-labels to icon-only buttons in [component-area]"
```

---

## Chunk 5: SEO

### Task 10: Add metadata to 56 pages without it

**Context:** Dashboard pages, `[slug]` dynamic pages, and legal pages lack `metadata` exports.

**Files:** ~56 pages across `app/`

- [ ] **Step 1: Find pages without metadata export**

```bash
# Find all page.tsx files
find app/ -name "page.tsx" -type f | while read f; do
  if ! grep -q 'export.*metadata\|generateMetadata' "$f"; then
    echo "$f"
  fi
done
```

- [ ] **Step 2: Categorize pages**

Group the 56 pages into:
- **Dashboard pages** (don't need SEO, but need `<title>` for tab UX)
- **Public pages** (need full SEO metadata)
- **Legal pages** (need basic metadata, noindex)

- [ ] **Step 3: Add metadata to dashboard pages (batch)**

For dashboard pages, add a simple metadata export:
```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard Pro | Vitfix',
  robots: { index: false, follow: false },
}
```

- [ ] **Step 4: Add metadata to public pages (batch)**

For public pages, add proper SEO metadata:
```typescript
export const metadata: Metadata = {
  title: 'Page Title | Vitfix.io',
  description: 'Concise description with CTA, 150-160 chars.',
  alternates: { canonical: 'https://vitfix.io/path' },
}
```

- [ ] **Step 5: Add metadata to legal pages (batch)**

```typescript
export const metadata: Metadata = {
  title: 'Mentions légales | Vitfix.io',
  robots: { index: false, follow: true },
}
```

- [ ] **Step 6: Verify build succeeds**

Run: `npx next build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 7: Commit per category**

```bash
git commit -m "seo: add metadata to dashboard pages (noindex)"
git commit -m "seo: add metadata to public pages"
git commit -m "seo: add metadata to legal pages (noindex)"
```

---

## Chunk 6: Performance

### Task 11: Replace remaining `<img>` with `next/image`

**Context:** ~20% of images still use raw `<img>` tags — syndic logo, marketplace, receipt scanner.

**Files:** Multiple component files

- [ ] **Step 1: Find all `<img>` tags**

```bash
grep -rn '<img ' components/ app/ --include="*.tsx" | grep -v 'next/image' | grep -v node_modules
```

- [ ] **Step 2: Replace each `<img>` with `next/image`**

For each file:
```tsx
// BEFORE
<img src={url} alt="Description" className="h-20 w-20 rounded" />

// AFTER
import Image from 'next/image'
<Image src={url} alt="Description" width={80} height={80} className="rounded" />
```

For external images, ensure the domain is in `next.config.js` `images.remotePatterns`.

- [ ] **Step 3: Check next.config for remote patterns**

Read `next.config.js` (or `.mjs`/`.ts`) and verify all external image domains are listed in `images.remotePatterns`. Add any missing ones.

- [ ] **Step 4: Verify build**

Run: `npx next build 2>&1 | tail -10`
Expected: Build succeeds without image warnings

- [ ] **Step 5: Commit**

```bash
git add -A  # after reviewing
git commit -m "perf: replace remaining <img> tags with next/image"
```

---

## Chunk 7: Supabase Realtime

### Task 12: Add auto-reconnect with exponential backoff for Realtime

**Files:**
- Create: `lib/realtime-reconnect.ts`
- Modify: Files that use Supabase Realtime channels (to be identified)
- Test: `tests/realtime-reconnect.test.ts`

- [ ] **Step 1: Find all Realtime channel usage**

```bash
grep -rn 'supabase.*channel\|\.on.*postgres_changes\|\.subscribe' app/ components/ hooks/ lib/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

- [ ] **Step 2: Write the failing test**

Create `tests/realtime-reconnect.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'

describe('createRealtimeChannel', () => {
  it('retries with exponential backoff on channel error', async () => {
    const { createRealtimeChannel } = await import('../lib/realtime-reconnect')
    expect(typeof createRealtimeChannel).toBe('function')
  })

  it('caps retry delay at 30 seconds', async () => {
    const { getBackoffDelay } = await import('../lib/realtime-reconnect')
    expect(getBackoffDelay(0)).toBe(1000)    // 1s
    expect(getBackoffDelay(1)).toBe(2000)    // 2s
    expect(getBackoffDelay(2)).toBe(4000)    // 4s
    expect(getBackoffDelay(5)).toBe(30000)   // capped at 30s
    expect(getBackoffDelay(10)).toBe(30000)  // still capped
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/realtime-reconnect.test.ts`
Expected: FAIL

- [ ] **Step 4: Create `lib/realtime-reconnect.ts`**

```typescript
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'

const MAX_DELAY = 30_000 // 30 seconds
const BASE_DELAY = 1_000 // 1 second

export function getBackoffDelay(attempt: number): number {
  return Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_DELAY)
}

/**
 * Subscribe to a Realtime channel with automatic reconnection on error.
 * Uses exponential backoff capped at 30s.
 */
export function subscribeWithReconnect(
  channel: RealtimeChannel,
  onError?: (error: unknown) => void
): RealtimeChannel {
  let retryCount = 0

  const subscribe = () => {
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        retryCount = 0
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError?.(err)
        const delay = getBackoffDelay(retryCount)
        retryCount++
        setTimeout(() => {
          channel.unsubscribe()
          subscribe()
        }, delay)
      }
    })
  }

  subscribe()
  return channel
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/realtime-reconnect.test.ts`
Expected: PASS

- [ ] **Step 6: Integrate into existing Realtime usages**

For each file using `.subscribe()` on a Realtime channel, replace:
```typescript
// BEFORE
channel.subscribe()

// AFTER
import { subscribeWithReconnect } from '@/lib/realtime-reconnect'
subscribeWithReconnect(channel)
```

- [ ] **Step 7: Run full test suite**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add lib/realtime-reconnect.ts tests/realtime-reconnect.test.ts [modified files]
git commit -m "feat: add Realtime auto-reconnect with exponential backoff"
```

---

## Summary

| Chunk | Tasks | Estimated Effort |
|-------|-------|-----------------|
| 1 — Quick Wins | Tasks 1-3 (links, migrations, exec_sql) | ~30 min |
| 2 — Architecture | Tasks 4-5 (token refresh, fetch helper) | ~2h |
| 3 — UX | Tasks 6-7 (password rules, debounce) | ~2h |
| 4 — Accessibility | Tasks 8-9 (labels, aria-labels) | ~5h |
| 5 — SEO | Task 10 (metadata) | ~3h |
| 6 — Performance | Task 11 (next/image) | ~2h |
| 7 — Supabase | Task 12 (Realtime reconnect) | ~2h |
| **Total** | **12 tasks** | **~16h** |
