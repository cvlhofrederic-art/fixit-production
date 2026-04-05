# Design & UX Consistency — Spec

**Date:** 2026-04-03
**Project:** Vitfix.io (fixit-production)
**Scope:** Accessibility, design tokens, shared UI primitives

---

## Context

Vitfix.io has 5 distinct dashboard sections, each with intentionally different visual identities:

| Section | CSS prefix | Primary color | Font |
|---------|-----------|---------------|------|
| Artisan (Pro) | `v22-*` | `#FFD600` yellow | IBM Plex Sans/Mono |
| Client | `v22-*` | `#FFC107` yellow | System/Tailwind |
| Syndic | `sd-*` | `#C9A84C` gold / `#0D1B2E` navy | Outfit / Playfair Display |
| Copropriétaire | — | Blue accents | System/Tailwind |
| Pro Mobile | — | `#FFC107` yellow | System/Tailwind |

This is by design. The goal is NOT to merge these into one system, but to:
1. Expose existing tokens to Tailwind so components stop hardcoding hex values
2. Fix critical a11y gaps (1,317 labels without `htmlFor`, modals without keyboard support)
3. Improve mobile touch targets
4. Provide shared UI primitives that respect each section's visual identity

---

## Architecture: 4 Layers

```
Layer 1: globals.css @theme ─── tokens (colors, spacing) exposed to Tailwind v4
    │
Layer 2: globals.css patches ── touch targets, focus-visible reinforcement
    │
Layer 3: UI primitives ──────── FormField, Modal (a11y wrappers, style-agnostic)
    │
Layer 4: Migration ──────────── Replace inline patterns with primitives
```

Each layer builds on the previous. No layer changes visual appearance.

---

## Layer 1 — Extend `@theme` in `globals.css`

**File:** `app/globals.css` (modify existing `@theme inline` block at line 1481)

**Context:** The project uses Tailwind CSS v4 with `@tailwindcss/postcss`. In v4, theme tokens are defined via `@theme` blocks in CSS, not `tailwind.config.ts`. A `@theme inline` block already exists (lines 1481-1504) with brand/legacy tokens.

**Purpose:** Extend the existing `@theme inline` block to include v22 (artisan) and sd (syndic) color tokens. This enables `bg-v22-yellow` instead of `bg-[var(--v22-yellow)]` or `bg-[#FFD600]`.

### What to add to the existing `@theme inline` block

v22 and sd tokens are already defined as CSS custom properties in `:root` within their scoped sections of globals.css. The `@theme` block re-declares them at the theme level so Tailwind generates utility classes for them.

```css
@theme inline {
  /* ── Existing brand tokens (already present, do not duplicate) ── */

  /* ── V22 Artisan Dashboard ── */
  --color-v22-yellow: var(--v22-yellow);
  --color-v22-yellow-light: var(--v22-yellow-light);
  --color-v22-yellow-border: var(--v22-yellow-border);
  --color-v22-bg: var(--v22-bg);
  --color-v22-surface: var(--v22-surface);
  --color-v22-border: var(--v22-border);
  --color-v22-border-dark: var(--v22-border-dark);
  --color-v22-text: var(--v22-text);
  --color-v22-text-mid: var(--v22-text-mid);
  --color-v22-text-muted: var(--v22-text-muted);
  --color-v22-green: var(--v22-green);
  --color-v22-green-light: var(--v22-green-light);
  --color-v22-red: var(--v22-red);
  --color-v22-red-light: var(--v22-red-light);
  --color-v22-red-bg: var(--v22-red-bg);
  --color-v22-amber: var(--v22-amber);
  --color-v22-amber-light: var(--v22-amber-light);
  --color-v22-blue: var(--v22-blue);
  --color-v22-blue-light: var(--v22-blue-light);

  /* ── SD Syndic Dashboard ── */
  --color-sd-navy: var(--sd-navy);
  --color-sd-navy-mid: var(--sd-navy-mid);
  --color-sd-navy-soft: var(--sd-navy-soft);
  --color-sd-navy-muted: var(--sd-navy-muted);
  --color-sd-gold: var(--sd-gold);
  --color-sd-gold-light: var(--sd-gold-light);
  --color-sd-gold-dim: var(--sd-gold-dim);
  --color-sd-cream: var(--sd-cream);
  --color-sd-cream-dark: var(--sd-cream-dark);
  --color-sd-white: var(--sd-white);
  --color-sd-ink: var(--sd-ink);
  --color-sd-ink-2: var(--sd-ink-2);
  --color-sd-ink-3: var(--sd-ink-3);
  --color-sd-border: var(--sd-border);
  --color-sd-border-dark: var(--sd-border-dark);
  --color-sd-red: var(--sd-red);
  --color-sd-red-soft: var(--sd-red-soft);
  --color-sd-amber: var(--sd-amber);
  --color-sd-amber-soft: var(--sd-amber-soft);
  --color-sd-teal: var(--sd-teal);
  --color-sd-teal-soft: var(--sd-teal-soft);

  /* ── Spacing (v22 scale) ── */
  --spacing-v22-1: var(--v22-space-1);
  --spacing-v22-2: var(--v22-space-2);
  --spacing-v22-3: var(--v22-space-3);
  --spacing-v22-4: var(--v22-space-4);
  --spacing-v22-6: var(--v22-space-6);
  --spacing-v22-8: var(--v22-space-8);
}
```

In Tailwind v4, `--color-*` tokens in `@theme` automatically generate `bg-*`, `text-*`, `border-*` utilities. So `--color-v22-yellow` produces `bg-v22-yellow`, `text-v22-yellow`, etc. Similarly, `--spacing-*` tokens produce `p-v22-1`, `m-v22-2`, `gap-v22-3`, etc.

### Constraints

- Append to the existing `@theme inline` block — do not create a separate block
- Every value references an existing CSS variable defined in `:root` — no hardcoded hex
- No new visual tokens introduced — only exposing existing vars to Tailwind
- Existing Tailwind classes (`bg-blue-500`, `text-gray-700`, etc.) keep working

### Verification

After modifying, run `npx next build 2>&1 | tail -5` to verify no CSS compilation errors. Existing Tailwind classes must continue to work.

---

## Layer 2 — `globals.css` Patches

**File:** `app/globals.css` (modify existing)

### 2a — Touch Targets

Current state:
- `v22-btn`: padding 8px 16px (no explicit min-height)
- `v22-btn-sm`: min-height 32px

Changes:

```css
/* Add min-height to default v22 buttons */
#artisan-dashboard-v22 .v22-btn {
  min-height: 44px;
}

/* Keep v22-btn-sm compact for desktop, bump to 36px */
#artisan-dashboard-v22 .v22-btn-sm {
  min-height: 36px;
}

/* Touch devices: enforce 44px on all interactive elements */
@media (pointer: coarse) {
  button,
  [role="button"],
  select,
  input[type="checkbox"],
  input[type="radio"] {
    min-height: 44px;
    min-width: 44px;
  }
}
```

This uses `pointer: coarse` to target touch devices (phones, tablets) regardless of which dashboard section is active. Desktop mouse users keep the compact sizes.

### 2b — Focus-visible Reinforcement

Current state: globals.css lines 1517-1525 already define `focus-visible` with 2px yellow outline. This covers buttons, links, inputs, selects, textareas.

Missing: modals. Add:

```css
[role="dialog"]:focus-visible {
  outline: 2px solid #FFC107;
  outline-offset: 2px;
}
```

This rule already exists at line 2432 but is incomplete. Verify and complete it.

### Constraints

- No visual changes to existing components
- Only min-height additions and focus outline completions
- Test on mobile viewport (375px width) to ensure buttons don't break layout

---

## Layer 3 — UI Primitives

### 3a — `components/ui/FormField.tsx`

**Purpose:** Wrapper that binds `<label>` to any form control via `htmlFor`/`id`, adds `aria-describedby` for errors/hints, and `aria-invalid` for error state. Does not impose any visual style.

**Props:**

```ts
interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  icon?: React.ReactNode
  className?: string        // wrapper div className
  labelClassName?: string   // label className (each dashboard passes its own)
  children: React.ReactElement  // the input/select/textarea
}
```

**Behavior:**

1. Generate unique `id` via `React.useId()`
2. Clone `children` with injected props: `id`, `aria-describedby` (pointing to error/hint span), `aria-invalid` (if error)
3. Render `<label htmlFor={id}>` with the label text, optional required indicator, optional icon
4. Render error span with `id={id}-error` and `role="alert"` if error is truthy
5. Render hint span with `id={id}-hint` if hint is truthy

**Output HTML (example):**

```html
<div>
  <label for="field-:r1:">Email <span aria-hidden="true">*</span></label>
  <input id="field-:r1:" aria-describedby="field-:r1:-error" aria-invalid="true" class="v22-form-input" />
  <span id="field-:r1:-error" role="alert">Email invalide</span>
</div>
```

**What it does NOT do:**
- No styling on the input (each dashboard's classes stay)
- No validation logic (that stays in the parent component)
- No state management (controlled by parent)

### 3b — `components/ui/Modal.tsx`

**Purpose:** Overlay + container with keyboard support and a11y attributes. Content and styling are injected by the consumer.

**Props:**

```ts
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  maxWidth?: number | string    // default 640
  className?: string            // applied to content container
  overlayClassName?: string     // applied to overlay (default: 'fixed inset-0 bg-black/50')
  children: React.ReactNode
}
```

**Behavior:**

1. Render nothing if `!open`
2. Overlay div with `onClick={onClose}` (click-outside-to-close)
3. Content div with `onClick={e => e.stopPropagation()}`
4. Attributes: `role="dialog"`, `aria-modal="true"`, `aria-labelledby={titleId}`
5. Title rendered as `<h2 id={titleId}>` (visually hidden if consumer provides their own header via `sr-only`)
6. **Escape key:** `useEffect` with `keydown` listener calling `onClose`
7. **Focus trap:** On mount, focus first focusable element inside modal. On unmount, restore focus to previously focused element.
8. **Scroll lock:** Set `document.body.style.overflow = 'hidden'` on mount, restore on unmount.

**What it does NOT do:**
- No header/body/footer structure (consumer controls layout)
- No close button (consumer adds their own `<button onClick={onClose}>`)
- No animation (can be added later via className)
- No visual style on content (consumer passes className for their design system)

**Usage (v22 dashboard):**

```tsx
<Modal open={showDetail} onClose={() => setShowDetail(false)} title="Détail" className="v22-modal" maxWidth={680}>
  <div className="v22-modal-head">
    <div className="v22-modal-title">Détail du marché</div>
    <button className="v22-modal-close" onClick={() => setShowDetail(false)}>✕</button>
  </div>
  <div className="v22-modal-body">
    {/* existing content unchanged */}
  </div>
</Modal>
```

**Usage (syndic dashboard):**

```tsx
<Modal open={showPdf} onClose={() => setShowPdf(false)} title="Générer PDF" className="bg-white rounded-2xl shadow-2xl" maxWidth="lg">
  {/* existing syndic content unchanged */}
</Modal>
```

### Constraints for Both Components

- Zero visual opinions — style comes from the consumer
- Must work with SSR (Next.js App Router, `'use client'` directive)
- No external dependencies beyond React
- File size target: <80 lines each

---

## Layer 4 — Migration

### 4a — FormField Migration

**Scope:** All files with `<label>` elements that lack `htmlFor`.

**Process per file:**
1. Import `FormField` from `@/components/ui/FormField`
2. Find each `<label>...<input>` pair
3. Wrap with `<FormField label="..." required={...} labelClassName="existing-classes">`
4. Move the input as child of FormField
5. Remove the old `<label>` element
6. Run `npx tsc --noEmit` — verify 0 new errors
7. Visual spot-check: the rendered HTML should look identical

**Migration order:**
1. `components/dashboard/` (artisan pro — 20+ files)
2. `components/client-dashboard/pages/` (10 files)
3. `components/syndic-dashboard/` (50+ files, 8 subdirectories)
4. `components/coproprietaire-dashboard/pages/` (10 files)
5. `components/pro-mobile/pages/` (5 files)
6. `components/artisan-profile/` (3 files)
7. `app/` pages with inline forms (auth, register, etc.)

**Exclusions:**
- Checkbox labels that already use `htmlFor` (3 instances) — leave as-is
- Labels that are purely decorative (no associated input) — skip
- Inline label+checkbox combos where the input is inside the label — these already work for a11y, no wrapping needed

### 4b — Modal Migration

**Scope:** All inline modal implementations using `fixed inset-0 bg-black/50` pattern.

**Process per modal:**
1. Import `Modal` from `@/components/ui/Modal`
2. Find the state variable controlling visibility (e.g., `showModal`, `showPdfModal`)
3. Replace the outer overlay `<div className="fixed inset-0 ...">` with `<Modal open={state} onClose={...} title="...">`
4. Keep all inner content as-is
5. Remove the manual `onClick` overlay handler and `e.stopPropagation()`
6. Run `npx tsc --noEmit` — verify 0 new errors
7. Test Escape key closes the modal

**Migration order:** Same as FormField (dashboard by dashboard).

**Estimated scope:** ~30 modal instances across the codebase.

---

## What This Spec Does NOT Cover

- **Inline styles migration** (10,704 instances) — separate future effort, not blocked by this work
- **Hardcoded hex replacement** (6,740 instances) — enabled by Layer 1 but migration is a separate task
- **Dark mode** — not in scope
- **Typography scale unification** — intentionally different per section
- **New visual design** — zero visual changes

---

## Success Criteria

1. `@theme inline` block in globals.css contains v22/sd tokens and they are available as Tailwind classes (e.g., `bg-v22-yellow`)
2. `npx tsc --noEmit` passes with no new errors (baseline: 21 pre-existing in `app/pro/dashboard/page.tsx`)
3. All `<label>` elements associated with form controls use `htmlFor`/`id` binding
4. All modals support Escape key, focus trap, `role="dialog"`, `aria-modal="true"`
5. All buttons in mobile sections have `min-height: 44px`
6. Existing e2e tests pass (`npm run test:e2e`)
7. Axe-core a11y audit shows fewer critical/serious violations than before

---

## Files Modified/Created

| File | Action |
|------|--------|
| `app/globals.css` | Modify (@theme tokens, touch targets, focus-visible) |
| `components/ui/FormField.tsx` | Create |
| `components/ui/Modal.tsx` | Create |
| `components/dashboard/**/*.tsx` | Modify (FormField + Modal migration) |
| `components/client-dashboard/**/*.tsx` | Modify (FormField + Modal migration) |
| `components/syndic-dashboard/**/*.tsx` | Modify (FormField + Modal migration) |
| `components/coproprietaire-dashboard/**/*.tsx` | Modify (FormField + Modal migration) |
| `components/pro-mobile/**/*.tsx` | Modify (FormField + Modal migration) |
| `components/artisan-profile/*.tsx` | Modify (FormField migration) |
| `components/marches/**/*.tsx` | Modify (Modal migration) |
| `components/DevisFactureForm.tsx` | Modify (FormField migration) |
| `app/auth/register/page.tsx` | Modify (FormField migration) |
| `app/pro/register/page.tsx` | Modify (FormField migration) |
