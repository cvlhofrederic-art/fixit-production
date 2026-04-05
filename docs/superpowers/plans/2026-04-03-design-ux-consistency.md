# Design & UX Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical a11y gaps (labels, modals, touch targets) and expose design tokens to Tailwind v4 — zero visual changes.

**Architecture:** 4 layers built bottom-up. Layer 1 extends the existing `@theme inline` block in globals.css to expose v22/sd CSS vars as Tailwind utilities. Layer 2 patches globals.css for touch targets and focus-visible. Layer 3 creates two style-agnostic UI primitives (FormField, Modal) with built-in a11y. Layer 4 migrates existing inline patterns to use these primitives, dashboard by dashboard.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4 (`@tailwindcss/postcss`), TypeScript

**Spec:** `docs/superpowers/specs/2026-04-03-design-ux-consistency-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `app/globals.css` | Modify | @theme tokens, touch targets, focus-visible, modal a11y |
| `components/ui/FormField.tsx` | Create | Label/input binding, aria-describedby, aria-invalid |
| `components/ui/Modal.tsx` | Create | Overlay, Escape key, focus trap, scroll lock, aria-modal |
| `components/dashboard/**/*.tsx` | Modify | FormField + Modal migration (artisan pro) |
| `components/client-dashboard/**/*.tsx` | Modify | FormField + Modal migration |
| `components/syndic-dashboard/**/*.tsx` | Modify | FormField + Modal migration |
| `components/coproprietaire-dashboard/**/*.tsx` | Modify | FormField migration |
| `components/pro-mobile/**/*.tsx` | Modify | FormField migration |
| `components/artisan-profile/*.tsx` | Modify | FormField migration |
| `components/marches/**/*.tsx` | Modify | Modal migration |
| `components/DevisFactureForm.tsx` | Modify | FormField migration |
| `app/auth/register/page.tsx` | Modify | FormField migration |
| `app/pro/register/page.tsx` | Modify | FormField migration |

---

### Task 1: Extend @theme with v22/sd tokens

**Files:**
- Modify: `app/globals.css:1481-1504` (existing `@theme inline` block)

- [ ] **Step 1: Add v22 and sd color tokens to @theme inline**

Open `app/globals.css` and find the `@theme inline` block at line 1481. Append the following tokens after the existing `--font-display` line (before the closing `}`):

```css
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
```

- [ ] **Step 2: Verify build passes**

Run: `cd /Users/elgato_fofo/Desktop/fixit-production && npx next build 2>&1 | tail -10`
Expected: Build succeeds. No CSS compilation errors.

- [ ] **Step 3: Verify tokens generate utilities**

Create a temporary test: add `className="bg-v22-yellow text-sd-navy p-v22-4"` to any component, run the dev server, inspect element in browser. The classes should resolve to the correct CSS values. Remove the test after verifying.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat: expose v22/sd design tokens to Tailwind v4 via @theme"
```

---

### Task 2: Touch targets and focus-visible patches

**Files:**
- Modify: `app/globals.css:91-112` (v22-btn section)
- Modify: `app/globals.css:2431-2437` (modal focus section)

- [ ] **Step 1: Add min-height to v22-btn**

In `app/globals.css`, find the `.v22-btn` rule at line 91. Add `min-height: 44px;` and `display: inline-flex; align-items: center; justify-content: center;` to ensure content stays vertically centered with the new height:

```css
#artisan-dashboard-v22 .v22-btn {
  font-size: 12px;
  font-weight: 500;
  padding: 6px 14px;
  border-radius: 3px;
  cursor: pointer;
  border: 1px solid var(--v22-border-dark);
  background: var(--v22-surface);
  color: var(--v22-text);
  transition: all 0.15s;
  font-family: var(--font-ibm-plex-sans), 'IBM Plex Sans', sans-serif;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 2: Bump v22-btn-sm to 36px**

Find line 110 and change:

```css
#artisan-dashboard-v22 .v22-btn-sm { padding: 6px 12px; font-size: 11px; min-height: 36px; }
```

- [ ] **Step 3: Add touch-device rule**

Add after the focus-visible block (after line 1525):

```css
/* ── Touch device minimum targets (WCAG 2.5.8) ─────────── */
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

- [ ] **Step 4: Fix modal focus rule**

Replace the incomplete modal focus rules at lines 2431-2437:

```css
/* ── Accessibility — Dialog focus ───────────────── */
[role="dialog"]:focus-visible {
  outline: 2px solid #FFC107;
  outline-offset: 2px;
}
[role="dialog"] {
  position: relative;
}
```

- [ ] **Step 5: Verify no layout breakage**

Run: `cd /Users/elgato_fofo/Desktop/fixit-production && npx next build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css
git commit -m "fix(a11y): add 44px touch targets, complete focus-visible for dialogs"
```

---

### Task 3: Create FormField component

**Files:**
- Create: `components/ui/FormField.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useId, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'

interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  icon?: ReactNode
  className?: string
  labelClassName?: string
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>
}

export function FormField({
  label,
  required,
  error,
  hint,
  icon,
  className,
  labelClassName,
  children,
}: FormFieldProps) {
  const reactId = useId()
  const fieldId = `field${reactId}`
  const errorId = error ? `${fieldId}-error` : undefined
  const hintId = hint && !error ? `${fieldId}-hint` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  const child = isValidElement(children)
    ? cloneElement(children, {
        id: fieldId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })
    : children

  return (
    <div className={className}>
      <label htmlFor={fieldId} className={labelClassName}>
        {icon && <>{icon} </>}
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {child}
      {error && (
        <span id={errorId} role="alert" className="text-red-600 text-xs mt-1 block">
          {error}
        </span>
      )}
      {hint && !error && (
        <span id={hintId} className="text-gray-500 text-xs mt-1 block">
          {hint}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep "FormField"`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/FormField.tsx
git commit -m "feat: add FormField component with automatic htmlFor/aria binding"
```

---

### Task 4: Create Modal component

**Files:**
- Create: `components/ui/Modal.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useEffect, useRef, useId, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  maxWidth?: number | string
  className?: string
  overlayClassName?: string
  children: ReactNode
}

export function Modal({
  open,
  onClose,
  title,
  maxWidth = 640,
  className,
  overlayClassName = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50',
  children,
}: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  // Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Focus management + scroll lock
  useEffect(() => {
    if (!open) return

    previousFocus.current = document.activeElement as HTMLElement
    document.body.style.overflow = 'hidden'

    // Focus first focusable element inside dialog
    const timer = setTimeout(() => {
      const focusable = dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      focusable?.focus()
    }, 0)

    return () => {
      clearTimeout(timer)
      document.body.style.overflow = ''
      previousFocus.current?.focus()
    }
  }, [open])

  // Focus trap
  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  if (!open) return null

  const style = typeof maxWidth === 'number'
    ? { maxWidth, width: '100%' }
    : { maxWidth, width: '100%' }

  return (
    <div className={overlayClassName} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={className}
        style={style}
        onClick={e => e.stopPropagation()}
      >
        <h2 id={titleId} className="sr-only">{title}</h2>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep "Modal"`
Expected: No errors related to Modal.tsx.

- [ ] **Step 3: Commit**

```bash
git add components/ui/Modal.tsx
git commit -m "feat: add Modal component with Escape, focus trap, scroll lock, aria-modal"
```

---

### Task 5: Migrate FormField — artisan dashboard

**Files:**
- Modify: All files in `components/dashboard/` that contain `<label>` without `htmlFor`

- [ ] **Step 1: Identify files to migrate**

Run:
```bash
grep -rL "htmlFor" --include="*.tsx" components/dashboard/ | xargs grep -l "<label" 2>/dev/null
```

This gives files with `<label>` but no `htmlFor`.

- [ ] **Step 2: Migrate each file**

For each file from Step 1:

1. Add import: `import { FormField } from '@/components/ui/FormField'`
2. Find each `<label className="...">Label text</label>` followed by an `<input>`/`<select>`/`<textarea>`
3. Replace with:
```tsx
<FormField label="Label text" labelClassName="existing-label-classes" className="existing-wrapper-classes">
  <input className="existing-input-classes" value={...} onChange={...} />
</FormField>
```
4. Remove the old `<label>` element
5. For labels with a required `*` indicator, add `required` prop to FormField
6. For labels with icons, pass them via the `icon` prop
7. **Skip** labels wrapping checkboxes/radios (input inside label already works for a11y)
8. **Skip** labels that are purely visual (no associated input)

- [ ] **Step 3: Verify after each file**

Run after each file: `npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "app/pro/dashboard" | wc -l`
Expected: 0

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/
git commit -m "fix(a11y): migrate artisan dashboard labels to FormField with htmlFor"
```

---

### Task 6: Migrate FormField — client dashboard

**Files:**
- Modify: Files in `components/client-dashboard/pages/` with `<label>` without `htmlFor`

- [ ] **Step 1: Identify and migrate**

Same process as Task 5. Key files:
- `ClientProfileSection.tsx` — profile form with name, email, phone, address fields
- `ClientDocumentsSection.tsx` — upload form
- `ClientMarchesSection.tsx` — market publishing form

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "app/pro/dashboard" | wc -l`
Expected: 0

- [ ] **Step 3: Commit**

```bash
git add components/client-dashboard/
git commit -m "fix(a11y): migrate client dashboard labels to FormField with htmlFor"
```

---

### Task 7: Migrate FormField — syndic dashboard

**Files:**
- Modify: Files in `components/syndic-dashboard/` (8 subdirectories, 50+ files)

- [ ] **Step 1: Identify files**

```bash
grep -rL "htmlFor" --include="*.tsx" components/syndic-dashboard/ | xargs grep -l "<label" 2>/dev/null | wc -l
```

- [ ] **Step 2: Migrate in batches by subdirectory**

Process each subdirectory separately:
1. `components/syndic-dashboard/financial/`
2. `components/syndic-dashboard/operations/`
3. `components/syndic-dashboard/governance/`
4. `components/syndic-dashboard/communication/`
5. `components/syndic-dashboard/legal/`
6. `components/syndic-dashboard/technical/`
7. `components/syndic-dashboard/residents/`
8. `components/syndic-dashboard/misc/`
9. `components/syndic-dashboard/pages/`

Same migration pattern as Task 5. The syndic dashboard uses `labelClassName` like `"block text-sm font-medium text-gray-700 mb-1"` and inputs with `focus:border-sd-gold`.

**Important:** The 3 existing `htmlFor` instances (CarnetEntretienSection, MiseEnConcurrenceSection, RetenuesGarantieSection) must be left as-is.

- [ ] **Step 3: Verify after each subdirectory**

Run: `npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "app/pro/dashboard" | wc -l`
Expected: 0

- [ ] **Step 4: Commit per subdirectory**

```bash
git add components/syndic-dashboard/financial/
git commit -m "fix(a11y): migrate syndic financial labels to FormField"
```

Repeat for each subdirectory.

---

### Task 8: Migrate FormField — copro, pro-mobile, artisan-profile, app pages

**Files:**
- Modify: `components/coproprietaire-dashboard/pages/*.tsx`
- Modify: `components/pro-mobile/pages/*.tsx`
- Modify: `components/artisan-profile/BookingForm.tsx`
- Modify: `components/DevisFactureForm.tsx`
- Modify: `app/auth/register/page.tsx`
- Modify: `app/pro/register/page.tsx`

- [ ] **Step 1: Migrate copro dashboard**

Same process as Task 5 for `components/coproprietaire-dashboard/pages/`.

- [ ] **Step 2: Migrate pro-mobile**

Same process for `components/pro-mobile/pages/`.

- [ ] **Step 3: Migrate artisan-profile and DevisFactureForm**

Migrate `BookingForm.tsx` and `DevisFactureForm.tsx`.

- [ ] **Step 4: Migrate app pages**

Migrate `app/auth/register/page.tsx` and `app/pro/register/page.tsx`.

- [ ] **Step 5: Verify all**

Run: `npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "app/pro/dashboard" | wc -l`
Expected: 0

- [ ] **Step 6: Commit**

```bash
git add components/coproprietaire-dashboard/ components/pro-mobile/ components/artisan-profile/ components/DevisFactureForm.tsx app/auth/ app/pro/register/
git commit -m "fix(a11y): migrate remaining labels to FormField with htmlFor"
```

---

### Task 9: Migrate Modal — artisan dashboard and marches

**Files:**
- Modify: Files in `components/dashboard/` and `components/marches/` with `fixed inset-0` modal pattern

- [ ] **Step 1: Identify modal files**

```bash
grep -rl "fixed inset-0" --include="*.tsx" components/dashboard/ components/marches/
```

- [ ] **Step 2: Migrate each modal**

For each file:

1. Add import: `import { Modal } from '@/components/ui/Modal'`
2. Find the modal pattern:
```tsx
{showSomething && (
  <div className="fixed inset-0 bg-black/50 ..." onClick={() => setShowSomething(false)}>
    <div className="bg-white rounded-2xl ..." onClick={e => e.stopPropagation()}>
      ...content...
    </div>
  </div>
)}
```
3. Replace with:
```tsx
<Modal open={showSomething} onClose={() => setShowSomething(false)} title="Descriptive Title" className="bg-white rounded-2xl ..." maxWidth={680}>
  ...content (unchanged)...
</Modal>
```
4. Remove the outer overlay div and inner `onClick={e => e.stopPropagation()}`
5. Keep all inner content, buttons, and close handlers as-is

For v22-style modals, use `className="v22-modal"`:
```tsx
<Modal open={showDetail} onClose={onClose} title="Détail du marché" className="v22-modal" maxWidth={680}>
  <div className="v22-modal-head">...existing...</div>
  <div className="v22-modal-body">...existing...</div>
</Modal>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "app/pro/dashboard" | wc -l`
Expected: 0

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/ components/marches/
git commit -m "fix(a11y): migrate artisan/marches modals to Modal component"
```

---

### Task 10: Migrate Modal — syndic and remaining dashboards

**Files:**
- Modify: Files in `components/syndic-dashboard/`, `components/client-dashboard/`, `components/pro-mobile/` with modal pattern

- [ ] **Step 1: Identify modal files**

```bash
grep -rl "fixed inset-0" --include="*.tsx" components/syndic-dashboard/ components/client-dashboard/ components/pro-mobile/ components/coproprietaire-dashboard/
```

- [ ] **Step 2: Migrate each modal**

Same process as Task 9. Syndic modals typically use:
```tsx
<Modal open={show} onClose={...} title="..." className="bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" maxWidth="lg">
  ...existing content...
</Modal>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "app/pro/dashboard" | wc -l`
Expected: 0

- [ ] **Step 4: Commit**

```bash
git add components/syndic-dashboard/ components/client-dashboard/ components/pro-mobile/ components/coproprietaire-dashboard/
git commit -m "fix(a11y): migrate syndic/client/mobile modals to Modal component"
```

---

### Task 11: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Verify zero remaining labels without htmlFor**

```bash
cd /Users/elgato_fofo/Desktop/fixit-production
# Count labels without htmlFor (excluding labels wrapping inputs, which are fine)
grep -rn "<label" --include="*.tsx" components/ app/ | grep -v "htmlFor" | grep -v "// a11y-ok" | wc -l
```

Compare with the label-wrapping-input pattern count to understand residual.

- [ ] **Step 2: Verify zero remaining inline modals**

```bash
grep -rn "fixed inset-0.*bg-black" --include="*.tsx" components/ | wc -l
```

Expected: 0 (all migrated to Modal component).

- [ ] **Step 3: TypeScript clean**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 21 (pre-existing baseline in app/pro/dashboard/page.tsx).

- [ ] **Step 4: Run existing tests**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 5: Commit any remaining fixes**

If any issues found in steps 1-4, fix and commit:
```bash
git commit -m "fix(a11y): final cleanup for design-ux-consistency"
```
