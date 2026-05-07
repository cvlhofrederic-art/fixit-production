# lib/services/devis — extraction target

Empty by design. This directory is the destination for the helper
extractions detailed in [docs/refactor-plan.md](../../../docs/refactor-plan.md)
"DevisFactureForm.tsx — Layer 1 (pure helpers)".

When work begins, the first PR adds:

- `totals.ts` — extracted from `components/DevisFactureForm.tsx`
  `computeDevisAmounts`. Re-uses [lib/devis-totals.ts](../../devis-totals.ts).
- `acomptes.ts` — extracted from `computeAcomptesAmounts`.
- `format.ts` — extracted from `formatPrice`.
- `validation.ts` — extracted from per-line validation.

Each helper ships with its own unit test in `tests/lib/services/devis/`.

The parent `DevisFactureForm.tsx` keeps its existing imports — the
new helpers are wrappers around already-existing inline logic, so the
extraction is a `git mv`-style move plus a re-export.

Until the first extraction lands, this directory is intentionally empty
beyond this README.
