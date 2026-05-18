# Tests — Commandes et parcours critiques

## Commandes locales
```
npm run test              # Vitest unitaires (~40 fichiers)
npm run test:watch        # Vitest watch mode
npm run test:coverage     # Vitest + couverture
npm run test:e2e          # Playwright E2E (9 specs, Chromium local)
npm run test:e2e:ui       # Playwright UI mode
```

## Tests unitaires (`tests/`)

### Racine (`tests/*.test.ts`) — 21 fichiers
- **Simulateur V2** (10) : `simulateur-v2-aggregate`, `-artisan-rate`, `-compute`, `-feature-flag`, `-groq-tools`, `-lookup`, `-route.integration`, `-token-substitution`, `-tools`, `-validate`
- **Estimation matériaux** (4) : `estimation-materiaux`, `-engine-errors`, `-extractor`, `-isolation`
- **IA / qualité** : `hallucination-eval`
- **Realtime / storage** : `realtime-reconnect`, `storage-sync`
- **Auth / API** : `auth-helpers-refresh`, `api-client`, `permissions`
- **Devis** : `devis-utils`

### `tests/api/` — 7 fichiers
`auth`, `companies-search`, `health`, `profile-specialties`, `specialties`, `stripe`, `verify-kbis`

### `tests/lib/` — 8 fichiers + dossier `rentabilite/`
`circuit-breaker`, `groq`, `kyc-verification`, `logger`, `rate-limit`, `sanitize`, `stripe`, `validation`

### `tests/prix-2026/` — 3 fichiers + dossiers `aides/`, `data/`
`coefficients`, `data-integrity`, `region-detector`, `types`

## Tests E2E (`e2e/`) — 9 specs
`a11y`, `api`, `artisan`, `artisan-flow`, `auth`, `home`, `security`, `seo`, `simulateur-v2`

## Parcours critiques — ne jamais casser
1. Création devis par artisan via Fixy AI (voix ou texte)
2. Inscription artisan → vérification → dashboard
3. Inscription client → recherche artisan → mise en relation
4. Commande vocale → analyse → action confirmée
5. Paiement Stripe et échéancier
6. Simulateur Devis V2 (Phase 1 — prix 2026 Tier 1)

## CI
- Playwright tourne sur 3 navigateurs en CI (chromium/firefox/webkit)
- Axe-core WCAG (wcag2a + wcag2aa + wcag21aa) bloque sur critiques/sérieuses
- Config Playwright : `playwright.config.ts` (Chromium local, 1 worker en CI)

## Avant de toucher au Simulateur V2
Lire en priorité les tests `simulateur-v2-*` — couverture dense (la règle TDD est portée par le `CLAUDE.md` racine).
