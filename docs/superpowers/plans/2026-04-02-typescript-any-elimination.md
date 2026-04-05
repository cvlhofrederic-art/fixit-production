# TypeScript `any` Elimination Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate TypeScript `any` types from the codebase, replacing with proper interfaces. Focus on highest-impact files first.

**Architecture:** Three-phase approach: (1) Remove `[key: string]: any` index signatures from shared types in `lib/types.ts`, then fix cascading errors, (2) Fix top component files with the most `any` usage, (3) Fix API routes. Each task is independently committable.

**Tech Stack:** TypeScript, Next.js 16.2.2

---

## Chunk 1: Fix shared types (systemic impact)

### Task 1: Remove `[key: string]: any` from lib/types.ts interfaces

The `[key: string]: any` index signature on 7 interfaces defeats type safety across the entire codebase. Removing them will surface real type errors.

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Remove index signatures from all interfaces**

In `lib/types.ts`, remove these lines:
- Line 32: `[key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any` (Artisan)
- Line 48: `[key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any` (Service)
- Line 70: `[key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any` (Booking)
- Line 103: `[key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any` (Notification)
- Line 117: `[key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any` (ChatMessage)
- Line 130: `[key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any` (SavedDocument)
- Line 144: `[key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any` (SyndicCabinet)
- Line 156: `[key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any` (Immeuble)

- [ ] **Step 2: Run tsc to find cascading errors**

Run: `npx tsc --noEmit 2>&1 | head -80`

This will show files that relied on the index signature to access dynamic properties. Note every error for the next tasks.

- [ ] **Step 3: Fix cascading errors by adding missing properties to interfaces**

For each tsc error like `Property 'xxx' does not exist on type 'Artisan'`:
- If `xxx` is a real property used across multiple files, add it to the interface in `lib/types.ts`
- If `xxx` is used only locally, use type assertion or extend the interface locally
- Common missing properties to expect:
  - `Artisan`: `slug`, `category`, `specialties`, `latitude`, `longitude`, `city`, `postal_code`, `address`, `services`, `client_name`
  - `Booking`: `client_name`, `client_email`, `client_phone`, `service_name`
  - `SavedDocument`: `docType`, `date`, `client`, `ref`, `number`, `total`, `amount`, `lines`, `signatureData`, `numero`, `clientName`

For each missing property, add it as optional to the interface:
```typescript
// Example: Add to Artisan interface
slug?: string
category?: string
specialties?: string[]
latitude?: number | null
longitude?: number | null
city?: string
postal_code?: string
address?: string
```

- [ ] **Step 4: Run tsc again to verify clean**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors from our changes

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts
git commit -m "refactor: remove [key: string]: any from shared interfaces, add missing properties"
```

---

## Chunk 2: Top component files (highest any count)

### Task 2: Fix PipelineSection.tsx (13 any)

**Files:**
- Modify: `components/dashboard/PipelineSection.tsx`

- [ ] **Step 1: Read the file and identify all any usages**

Read `components/dashboard/PipelineSection.tsx` fully.

- [ ] **Step 2: Replace all any types**

Apply these replacements:
- Line 8: `artisan: any` → `artisan: Artisan` (import from `@/lib/types`)
- Line 39: `doc: any` → `doc: SavedDocument` (import from `@/lib/types`)
- Line 55: `docs: any[]` → `docs: SavedDocument[]`
- Line 56: `drafts: any[]` → `drafts: SavedDocument[]`
- Lines 59,60,63: `(d: any)` → `(d: SavedDocument)`
- Lines 66,73,80: `(d: any)` → `(d: SavedDocument)`
- Lines 69,76,83: `(l: any)` → `(l: { totalHT?: number; total?: number })`

Add imports at top:
```typescript
import type { Artisan, SavedDocument } from '@/lib/types'
```

- [ ] **Step 3: Run tsc check**

Run: `npx tsc --noEmit 2>&1 | grep PipelineSection`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/PipelineSection.tsx
git commit -m "refactor: eliminate any types in PipelineSection"
```

---

### Task 3: Fix HomeSection.tsx (13 any)

**Files:**
- Modify: `components/dashboard/HomeSection.tsx`

- [ ] **Step 1: Read the file**

Read `components/dashboard/HomeSection.tsx` fully.

- [ ] **Step 2: Replace all any types**

- Line 8: `artisan: any` → `artisan: Artisan`
- Line 10: `bookings: any[]` → `bookings: Booking[]`
- Line 11: `services: any[]` → `services: Service[]`
- Line 12: `pendingBookings: any[]` → `pendingBookings: Booking[]`
- Line 13: `completedBookings: any[]` → `completedBookings: Booking[]`
- Line 25: `booking: any` → `booking: Booking`
- Lines 103,104: `(d: any)`, `(a: any, b: any)` → `(d: SavedDocument)`, `(a: SavedDocument, b: SavedDocument)`
- Line 109: `alertItems: any[]` → `alertItems: Array<{ type: 'red' | 'amber'; title: string; sub: string; time: string }>`
- Lines 111,112,121,122: `(d: any)`, `(inv: any)`, `(dv: any)` → `(d: SavedDocument)`, `(inv: SavedDocument)`, `(dv: SavedDocument)`

Add imports:
```typescript
import type { Artisan, Booking, Service, SavedDocument } from '@/lib/types'
```

- [ ] **Step 3: Run tsc check**

Run: `npx tsc --noEmit 2>&1 | grep HomeSection`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/HomeSection.tsx
git commit -m "refactor: eliminate any types in HomeSection"
```

---

### Task 4: Fix AgentComptableCopro.tsx (11 any)

**Files:**
- Modify: `components/syndic-dashboard/financial/AgentComptableCopro.tsx`

- [ ] **Step 1: Read the file**

Read `components/syndic-dashboard/financial/AgentComptableCopro.tsx` fully.

- [ ] **Step 2: Add local interfaces at top of file**

These types are specific to this component and don't belong in lib/types.ts:

```typescript
interface CoproLot {
  numero: string
  proprietaire: string
  tantieme: number
  etage?: string
  surface?: number
}

interface CoproEcriture {
  date: string
  journal: string
  libelle: string
  debit: number
  credit: number
  compte: string
}

interface CoproAppel {
  statut: string
  periode: string
  totalBudget: number
}

interface CoproBudget {
  immeuble: string
  annee: number
  postes: Array<{ nom: string; montant: number }>
}
```

- [ ] **Step 3: Replace all any types**

- Line 17: `lots: any[]` → `lots: CoproLot[]`
- Line 18: `ecritures: any[]` → `ecritures: CoproEcriture[]`
- Line 19: `appels: any[]` → `appels: CoproAppel[]`
- Line 20: `budgets: any[]` → `budgets: CoproBudget[]`
- Lines 46,60: `(l: any)` → `(l: CoproLot)`
- Lines 47,48,62: `(e: any)` → `(e: CoproEcriture)`
- Line 64: `(a: any)` → `(a: CoproAppel)`
- Line 65: `(b: any)` → `(b: CoproBudget)`

- [ ] **Step 4: Run tsc check**

Run: `npx tsc --noEmit 2>&1 | grep AgentComptable`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add components/syndic-dashboard/financial/AgentComptableCopro.tsx
git commit -m "refactor: eliminate any types in AgentComptableCopro"
```

---

### Task 5: Fix ChantiersBTPV2.tsx (11 any)

**Files:**
- Modify: `components/dashboard/ChantiersBTPV2.tsx`

- [ ] **Step 1: Read the file**

Read `components/dashboard/ChantiersBTPV2.tsx` fully to understand the `ChantierForm` interface and other local types.

- [ ] **Step 2: Replace all any types**

- Line 36: `items: any` → `items: Array<{ description: string; quantite?: number; prixUnitaire?: number; totalHT?: number }>`
- Line 47: `artisan: any` → `artisan: Artisan` (import from `@/lib/types`)
- Line 72: `chantier: any` → `chantier: ChantierForm` (already defined in file)
- Lines 92,97: `(m: any)` → `(m: { actif?: boolean; prenom?: string; nom?: string; role?: string; daily_cost?: number })`
- Line 181: `(it: any)` → `(it: { description: string })`
- Line 200: `(c: any)` → `(c: ChantierForm)`
- Line 233: `(c: any)` → `(c: ChantierForm)`
- Lines 307,342,365: `(c: any)` → `(c: ChantierForm)`

- [ ] **Step 3: Run tsc check**

Run: `npx tsc --noEmit 2>&1 | grep ChantiersBTP`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/ChantiersBTPV2.tsx
git commit -m "refactor: eliminate any types in ChantiersBTPV2"
```

---

### Task 6: Fix MobileSettingsSection.tsx (10 any)

**Files:**
- Modify: `components/pro-mobile/pages/MobileSettingsSection.tsx`

- [ ] **Step 1: Read the file**

Read `components/pro-mobile/pages/MobileSettingsSection.tsx` fully.

- [ ] **Step 2: Add local SettingsForm interface**

```typescript
interface SettingsForm {
  company_name: string
  phone: string
  bio: string
  auto_reply_message: string
  auto_block_duration_minutes: number
  zone_radius_km: number
}
```

- [ ] **Step 3: Replace all any types**

- Line 18: `artisan: any` → `artisan: Artisan` (import from `@/lib/types`)
- Line 23: `settingsForm: any` → `settingsForm: SettingsForm`
- Line 24: `setSettingsForm: (v: any) => void` → `setSettingsForm: React.Dispatch<React.SetStateAction<SettingsForm>>`
- Lines 101,122,140,200,205,210: `(p: any)` → `(p: SettingsForm)`

- [ ] **Step 4: Run tsc check**

Run: `npx tsc --noEmit 2>&1 | grep MobileSettings`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add components/pro-mobile/pages/MobileSettingsSection.tsx
git commit -m "refactor: eliminate any types in MobileSettingsSection"
```

---

### Task 7: Fix marches/route.ts (9 any)

**Files:**
- Modify: `app/api/marches/route.ts`

- [ ] **Step 1: Read the file**

Read `app/api/marches/route.ts` fully.

- [ ] **Step 2: Add local interfaces at top**

```typescript
interface MarcheRow {
  id: string
  title: string
  location_lat: number | null
  location_lng: number | null
  status?: string
  created_at?: string
  [key: string]: unknown
}

interface ArtisanCandidate {
  id: string
  user_id: string
  latitude?: number | null
  longitude?: number | null
  category?: string
  specialties?: string[]
  rating_avg?: number
  distance?: number
  [key: string]: unknown
}
```

- [ ] **Step 3: Replace all any types**

- Line 93: `(c: any)` → `(c: Record<string, unknown>)`
- Line 137: `marches: any[]` → `marches: MarcheRow[]`
- Line 148: `(m: any)` → `(m: MarcheRow)`
- Lines 277,284,290,299,306,314: `(a: any)` → `(a: ArtisanCandidate)`, `(b: any)` → `(b: ArtisanCandidate)`

- [ ] **Step 4: Run tsc check**

Run: `npx tsc --noEmit 2>&1 | grep "marches/route"`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add app/api/marches/route.ts
git commit -m "refactor: eliminate any types in marches API route"
```

---

## Chunk 3: Remaining high-count files (batch)

### Task 8: Fix remaining dashboard components

**Files:** All files in `components/dashboard/` with `any` usage (estimated ~80 remaining after Tasks 2-5).

- [ ] **Step 1: List all remaining files with any**

Run: `grep -rn ': any' components/dashboard/ --include="*.tsx" | grep -v 'eslint-disable' | cut -d: -f1 | sort | uniq -c | sort -rn`

- [ ] **Step 2: For each file, read and replace any types**

Use the same pattern as Tasks 2-6:
- `artisan: any` → `artisan: Artisan`
- `booking: any` → `booking: Booking`
- `(d: any)` in document contexts → `(d: SavedDocument)`
- `(s: any)` in service contexts → `(s: Service)`
- Callback params like `(p: any)` in setState → proper state type
- `data: any` from API responses → `Record<string, unknown>` or specific interface
- `error: any` in catch blocks → `unknown`

For `catch (e: any)` patterns, replace with `catch (e: unknown)` and use `e instanceof Error ? e.message : String(e)`.

- [ ] **Step 3: Run tsc check**

Run: `npx tsc --noEmit 2>&1 | grep "components/dashboard" | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/
git commit -m "refactor: eliminate any types across dashboard components"
```

---

### Task 9: Fix syndic-dashboard components

**Files:** All files in `components/syndic-dashboard/` with `any` usage (~106 occurrences).

- [ ] **Step 1: List all files with any**

Run: `grep -rn ': any' components/syndic-dashboard/ --include="*.tsx" | grep -v 'eslint-disable' | cut -d: -f1 | sort | uniq -c | sort -rn`

- [ ] **Step 2: For each file, read and replace any types**

Same patterns as Task 8. Common syndic-specific types:
- `immeuble: any` → `immeuble: Immeuble` (from lib/types.ts)
- `cabinet: any` → `cabinet: SyndicCabinet` (from lib/types.ts)
- `signalement: any` → define local `Signalement` interface
- `mission: any` → define local `Mission` interface
- Copropriétaire-related data → define local interfaces

- [ ] **Step 3: Run tsc check**

Run: `npx tsc --noEmit 2>&1 | grep "syndic-dashboard" | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add components/syndic-dashboard/
git commit -m "refactor: eliminate any types across syndic-dashboard components"
```

---

### Task 10: Fix API routes

**Files:** All files in `app/api/` with `any` usage (~115 occurrences).

- [ ] **Step 1: List all API files with any**

Run: `grep -rn ': any' app/api/ --include="*.ts" | grep -v 'eslint-disable' | cut -d: -f1 | sort | uniq -c | sort -rn`

- [ ] **Step 2: For each file, replace any types**

Common patterns in API routes:
- `const body: any = await request.json()` → `const body: Record<string, unknown> = await request.json()` or use the Zod schema output type
- `catch (e: any)` → `catch (e: unknown)` with `e instanceof Error ? e.message : String(e)`
- `data: any` from Supabase queries → use Supabase generated types or `Record<string, unknown>`
- Function params → define proper interfaces

- [ ] **Step 3: Run tsc check**

Run: `npx tsc --noEmit 2>&1 | grep "app/api" | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add app/api/
git commit -m "refactor: eliminate any types across API routes"
```

---

## Summary

| Chunk | Tasks | Scope | Estimated `any` eliminated |
|-------|-------|-------|---------------------------|
| 1 | Task 1 | lib/types.ts index signatures | ~8 + cascading fixes |
| 2 | Tasks 2-7 | Top 6 files | ~67 |
| 3 | Tasks 8-10 | Remaining dashboard, syndic, API | ~366 |
| **Total** | **10 tasks** | **441 `any` → 0** | |
