# Refactor plan — monolith sections

Source-of-truth document for the staged decomposition of the three
biggest components in the active-scope code. Out of scope of the
current branch — this file is the **playbook**, not a deliverable.

## Why this is its own document, not a sprint

The three monoliths are critical UX paths:

| File | Lines | Hooks (use*) | Risk if broken |
|---|---:|---:|---|
| [components/DevisFactureForm.tsx](../components/DevisFactureForm.tsx) | 3 793 | 115 | Devis creation breaks → revenue path down |
| [components/dashboard/ComptabiliteSection.tsx](../components/dashboard/ComptabiliteSection.tsx) | 1 412 | 25 | Artisan accounting view broken |
| [components/dashboard/ClientsSection.tsx](../components/dashboard/ClientsSection.tsx) | 1 153 | n/a | Artisan CRM broken |

A single-PR rewrite of any of these would be a coin flip. Instead we
extract **one piece at a time**, each behind a passing test, in a way
that's reviewable as a single diff. The sequencing below is the
playbook: helper → hooks → sub-components, never the reverse.

## Pre-condition: the harness

Before any extraction, the parent file must have a baseline test that
would catch a regression. None of the three monoliths has one today —
adding it is **step 0 of every extraction PR**.

For `DevisFactureForm.tsx`, the minimum baseline is:

```ts
// tests/components/DevisFactureForm.test.tsx
it('renders the empty form for a new devis', () => { … })
it('renders an existing devis when prefilled via prop', () => { … })
it('computes totals (HT, TVA, TTC, acomptes) on items change', () => { … })
it('triggers onSave with the canonical payload on submit', () => { … })
it('renders the BTP variant when orgRole=pro_societe', () => { … })
```

Same idea for `ComptabiliteSection` (financial summary KPIs +
chat handler) and `ClientsSection` (CRUD + filtering).

## DevisFactureForm.tsx — extraction order

Driven by [components/DevisFactureForm.tsx](../components/DevisFactureForm.tsx).
Lines below are approximate; refresh by reading the file before each PR.

### Layer 1 — pure helpers (1 PR)

These are mechanical: zero state, zero side-effects. Move them out
behind unit tests, no behaviour change in the parent.

| Helper | Lines | New home |
|---|---:|---|
| `computeDevisAmounts(items, tva)` (HT, TVA, TTC) | ~280-360 | `lib/services/devis/totals.ts` (re-uses lib/devis-totals helpers) |
| `computeAcomptesAmounts(percents, total)` | ~370-410 | `lib/services/devis/acomptes.ts` |
| `formatPrice(cents, locale)` | ~150 | `lib/services/devis/format.ts` |
| `validateDevisLine(line)` (returns errors[]) | scattered | `lib/services/devis/validation.ts` |

**Test gate before merge**: each helper has its own unit test, and the
`DevisFactureForm.test.tsx` baseline still passes against the call-site.

### Layer 2 — domain hooks (2-3 PRs)

State + side-effects, but no JSX. Each hook owns one concern and
exposes a tiny API.

| Hook | Lines | New home | Concern |
|---|---:|---|---|
| `useDevisTemplate(initial)` | ~74-130 | `hooks/devis/useDevisTemplate.ts` | localStorage-persisted template defaults |
| `useClientPicker(artisan)` | ~146-220 | `hooks/devis/useClientPicker.ts` | Async client list + selection |
| `useDevisLines()` | ~350-650 | `hooks/devis/useDevisLines.ts` | CRUD on the line array (add/edit/delete/sort) |
| `usePdfGeneration(payload)` | scattered | `hooks/devis/usePdfGeneration.ts` | PDF render + download — already lazy, can move out cleanly |

**Test gate**: hook unit tests with `@testing-library/react-hooks`
patterns + the parent's baseline test still green.

### Layer 3 — sub-components (3-5 PRs)

UI only — receive props and an event-handler from the parent. Each
extraction shrinks the parent by 100-300 lines.

| Component | Lines | New home |
|---|---:|---|
| `DevisCompanySection` | ~96-130 | `components/devis/DevisCompanySection.tsx` |
| `DevisClientPicker` | ~200-280 | `components/devis/DevisClientPicker.tsx` |
| `DevisLinesTable` | ~600-1100 | `components/devis/DevisLinesTable.tsx` |
| `DevisAcomptesPanel` | ~1100-1300 | `components/devis/DevisAcomptesPanel.tsx` |
| `DevisFooterTotals` | ~1300-1500 | `components/devis/DevisFooterTotals.tsx` |

The parent component becomes ~600-800 lines: just orchestration + the
two hooks + the sub-components.

### Stop-condition

When `wc -l components/DevisFactureForm.tsx` is < 1 000 lines, we stop
and reassess. Below that, further extraction is mostly cosmetic.

## ComptabiliteSection.tsx — extraction order

Smaller, simpler. Three PRs:

1. Extract `useFinancialContext()` hook (~70-96): aggregates annual CA,
   expenses, team payroll. Pure derived state. New home:
   `hooks/compta/useFinancialContext.ts`.
2. Extract `<QuickQuestionsPanel>` (~100-127): renders the i18n quick-
   question buttons + dispatches a sendMessage event. New home:
   `components/compta/QuickQuestionsPanel.tsx`.
3. Extract `<AgentComptableChat>` (~129-176): chat scaffold (messages,
   isLoading, fetch). New home: `components/compta/AgentComptableChat.tsx`.

After these three the parent should be ~900 lines and structurally
similar to the post-refactor DevisFactureForm.

## ClientsSection.tsx — extraction order

Single PR, two extractions:

1. `useClientsCrud(artisanId)` — list + add + edit + delete + Supabase
   subscribe. New home: `hooks/clients/useClientsCrud.ts`.
2. `<ClientsFilterBar>` — the filter input + dropdowns. New home:
   `components/clients/ClientsFilterBar.tsx`.

The remaining parent component renders the table and the modal — manageable
without further surgery.

## Test investment per phase

| Phase | New tests | Total cost |
|---|---:|---:|
| Baseline `DevisFactureForm.test.tsx` | ~5 | 0.5 day |
| Layer 1 helpers (4 PRs) | 1 test per helper | ~1 day total |
| Layer 2 hooks (3 PRs) | 3-5 tests per hook | 1-1.5 day |
| Layer 3 sub-components (5 PRs) | 2-3 tests per sub-component | 1-1.5 day |
| ComptabiliteSection (3 PRs) | similar split | 1 day |
| ClientsSection (1 PR) | similar | 0.5 day |
| **Total** | **~50 new tests** | **~6 days** |

## What NOT to do

- **No big-bang rewrite.** No PR > 600 lines diff (sub-component
  extraction layer aside, where the parent shrinks dramatically — but
  the new files are small).
- **No prop-drilling cleanup before the extraction.** First the cleave,
  then the prop reduction. Combining both fights diff readability.
- **No "while-I'm-here" refactors.** Cosmetics, naming, the dozens of
  CSS class refactors that look obvious — defer them. One concern per
  PR.
- **No new features inside an extraction PR.** The harness assertions
  are about `before === after` behaviour. Adding a feature breaks the
  harness.

## Tooling

- `wc -l` is the gate. After every PR: `wc -l components/DevisFactureForm.tsx`
  in the PR description, with the delta from the previous head.
- Each extraction PR title: `refactor(devis): extract <Helper|Hook|Component>` with
  scope.
- The shared `tests/components/setup.tsx` from Phase 4 is the test
  starting point — every new test file imports from it.

## Sequencing in calendar terms

Estimated duration with 1 dev at 4 productive hours/day, **net of any
parallel project work**:

| Week | Goals |
|---|---|
| 1 | Baseline tests on all three monoliths (5 + 5 + 3 = ~13 tests) |
| 2 | DevisFactureForm Layer 1 helpers (4 PRs) |
| 3 | DevisFactureForm Layer 2 hooks (3 PRs) |
| 4 | DevisFactureForm Layer 3 sub-components (5 PRs) |
| 5 | ComptabiliteSection (3 PRs) + ClientsSection (1 PR) |

The parent components end at ~700/800/600 lines. Audit score on the
"Architecture & Code" axis goes from 4.5 to ~7 once these land.

## Why this isn't in the current PR

- Each extraction needs the matching baseline test to land first.
  Adding all 13 baseline tests in this PR would inflate the diff
  significantly without any architectural gain.
- The refactor is a **dedicated session** with focused review, not a
  side-quest in a 6-phase hardening branch.

This file becomes the GitHub issue body when work starts: copy/paste,
break out the table rows into checkboxes, assign.
