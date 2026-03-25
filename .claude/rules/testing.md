# Tests — Commandes et parcours critiques

## Commandes locales
```
npm run test              # Vitest unitaires (10 tests)
npm run test:watch        # Vitest watch mode
npm run test:coverage     # Vitest + couverture
npm run test:e2e          # Playwright E2E (7 specs, Chromium)
npm run test:e2e:ui       # Playwright UI mode
```

## Tests unitaires (tests/)
rate-limit, sanitize, stripe, circuit-breaker, groq, validation,
logger, auth API, stripe API, health API.

## Tests E2E (e2e/)
home, security, seo, a11y, auth, artisan, api.

## Parcours critiques — ne jamais casser
1. Création devis par artisan via Fixy AI (voix ou texte)
2. Inscription artisan → vérification → dashboard
3. Inscription client → recherche artisan → mise en relation
4. Commande vocale → analyse → action confirmée
5. Paiement Stripe et échéancier

## CI
- Playwright tourne sur 3 navigateurs en CI (chromium/firefox/webkit)
- Axe-core WCAG (wcag2a + wcag2aa + wcag21aa) bloque sur critiques/sérieuses
- Config Playwright : playwright.config.ts (Chromium local, 1 worker en CI)
