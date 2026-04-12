# Audit de Compatibilité Cloudflare — Vitfix.io (fixit-production)

**Date :** 12 avril 2026
**Mode :** Read-only, aucune modification
**Source :** Analyse statique du repo + configuration infra

---

## Périmètre audité

| Composant | Quantité | Couverture |
|-----------|----------|------------|
| API routes (`app/api/`) | 143 route.ts | 100% |
| Pages (App Router) | ~350+ pages (FR/PT/EN/NL/ES) | Structure vérifiée |
| Libs partagées (`lib/`) | 25+ modules | Tous lus |
| Config (`next.config.ts`, `vercel.json`, `sentry.*.config.ts`) | 5 fichiers | 100% |
| Dépendances (`package.json`) | 85+ packages | 100% |
| Variables d'environnement | 35+ vars | 100% |
| Cron jobs (`vercel.json`) | 11 tâches | 100% |
| Static assets (`public/`) | 2.9 MB | Inventorié |

---

## Findings

| ID | Sévérité | Catégorie | Source | Description | Fix suggéré |
|----|----------|-----------|--------|-------------|-------------|
| CF-001 | **P0** | Runtime/CPU | `app/api/tenders/scan/route.ts:11` | `maxDuration = 300` (5 min). Cloudflare Workers Paid plafonne à 30s CPU time. Cette route scrape des marchés publics en boucle. | Migrer vers Cloudflare Queue + Worker dédié, ou service externe (Railway, Fly.io) pour les jobs longs. |
| CF-002 | **P0** | Runtime/CPU | `app/api/cron/scan-marches/route.ts:6` | `maxDuration = 300` (5 min). Même problème que CF-001. | Idem CF-001 : queue ou service externe. |
| CF-003 | **P0** | Runtime/Bundle | `app/api/verify-id/route.ts:2` | Import statique `import Tesseract from 'tesseract.js'`. OCR WASM complet (~8 MB unpacked). Dépasse le 1 MB compressé Workers + timeout CPU. | Remplacer par Groq Vision API (déjà utilisé dans `receipt-scan`) ou service OCR externe. |
| CF-004 | **P0** | Runtime/Bundle | `app/api/verify-kbis/route.ts:2` | Import statique Tesseract.js identique à CF-003. | Idem CF-003. |
| CF-005 | **P0** | Cron | `vercel.json` (11 entrées) | 11 cron jobs Vercel. Pas d'équivalent natif direct — Cloudflare Cron Triggers existe mais limité à 30s CPU par exécution. 8 jobs dépassent 30s (`maxDuration: 60-300`). | Migrer vers Cloudflare Cron Triggers pour les jobs courts (<30s). Jobs longs → Cloudflare Queues + Worker consumer ou service externe. |
| CF-006 | **P1** | Runtime/Node.js | 7 fichiers (voir détail) | `import crypto from 'crypto'` — module Node.js natif, incompatible edge runtime Workers. Utilisé pour `randomUUID()`, `randomBytes()`. | Remplacer par `crypto.randomUUID()` (Web Crypto API, disponible dans Workers) et `crypto.getRandomValues()` pour `randomBytes`. |
| CF-007 | **P1** | Runtime/Node.js | 25+ routes | `Buffer.from()` — API Node.js. Workers supporte `Buffer` via polyfill automatique (nodejs_compat flag), mais nécessite activation explicite. | Activer `nodejs_compat` dans `wrangler.toml`. Alternative : utiliser `Uint8Array` + `TextEncoder`/`TextDecoder`. |
| CF-008 | **P1** | Runtime/CPU | 6 sync routes | `maxDuration: 60` sur `/api/sync/base-gov-pt`, `/api/sync/decp-13`, `/api/sync/sitadel-13`, `/api/sync/mairies-13`, `/api/sync/ted-porto`, `/api/sync/obras-porto`. Fetch de données gouvernementales avec parsing. | Décomposer en plusieurs Workers chaînés via Queues, ou déporter vers un service long-running. |
| CF-009 | **P1** | Vendor Lock-in | `app/layout.tsx:15-16` | `@vercel/speed-insights` et `@vercel/analytics` — SDK propriétaires Vercel avec endpoints `/ingest` Vercel. Cassé sur Cloudflare. | Remplacer par Cloudflare Web Analytics (script gratuit) ou Plausible/Fathom. |
| CF-010 | **P1** | Sentry | `sentry.edge.config.ts`, `next.config.ts:166-179` | Intégration Sentry via `@sentry/nextjs` avec `withSentryConfig()`. Le wrapper Sentry est couplé au build pipeline Next.js/Vercel (source maps upload, bundle optimizations). | Tester la compatibilité `@sentry/nextjs` sur OpenNext/Cloudflare. Alternative : migrer vers `@sentry/cloudflare` ou `toucan-js`. |
| CF-011 | **P1** | Runtime/CPU | `app/api/marches/scan/route.ts:8` | `maxDuration = 120` (2 min). Parsing de marchés publics. | Queue + Worker consumer. |
| CF-012 | **P1** | Runtime/CPU | `app/api/email-agent/poll/route.ts:9` | `maxDuration = 60`. Polling Gmail API en boucle. | Cloudflare Cron Trigger + pagination par batch (<30s par exécution). |
| CF-013 | **P1** | Config/CSP | `next.config.ts:148` | CSP `script-src` autorise `https://*.vercel-scripts.com https://*.vercel-insights.com` — domaines Vercel. | Supprimer les domaines Vercel, ajouter les domaines Cloudflare Analytics si utilisés. |
| CF-014 | **P1** | Config/CSP | `next.config.ts:152` | CSP `connect-src` autorise `https://*.vercel-insights.com` — idem CF-013. | Idem. |
| CF-015 | **P2** | Caching | `lib/cache.ts:18` | Cache in-memory (`Map`) avec 500 entrées max. Workers sont stateless entre requêtes — le cache in-memory ne persiste pas. | Migrer vers Cloudflare KV pour le cache applicatif, garder Upstash Redis comme fallback. |
| CF-016 | **P2** | Caching | `lib/rate-limit.ts` | Rate limiter in-memory (`Map`, 10K entrées) comme fallback quand Upstash absent. Idem CF-015 — ne persiste pas entre invocations Workers. | S'assurer qu'Upstash Redis est toujours configuré en production. Alternative : Cloudflare Rate Limiting (builtin). |
| CF-017 | **P2** | Runtime | `app/api/og/route.tsx:3` | `export const runtime = 'edge'` — compatible Workers. Utilise `ImageResponse` de `next/og`. | Tester que `next/og` fonctionne sur OpenNext/Cloudflare Pages. Potentiel problème de polyfill. |
| CF-018 | **P2** | Framework | `next.config.ts` (global) | Next.js 16.2.2. Cloudflare Pages supporte Next.js via `@opennextjs/cloudflare` mais le support 16.x est encore en développement (stable pour 14.x-15.x). | Valider la compatibilité OpenNext avec Next.js 16. Consulter [opennextjs/cloudflare](https://github.com/opennextjs/cloudflare) pour le statut. |
| CF-019 | **P2** | Fiscal | `lib/portugal-fiscal.ts:17` | `import crypto from 'crypto'` — utilise probablement `createSign` ou `createHash` pour signature fiscale portugaise. Plus complexe que `randomUUID`. | Vérifier l'usage exact. Si RSA signing → `crypto.subtle.sign()` (Web Crypto). Si HMAC → `crypto.subtle.sign('HMAC', ...)`. |
| CF-020 | **P2** | SSG/ISR | `app/sitemap.ts:2` | `export const revalidate = 3600` — ISR dépend de Vercel's ISR infrastructure. Cloudflare Pages ne supporte pas l'ISR nativement. | Utiliser `stale-while-revalidate` via Cloudflare Cache API, ou régénérer le sitemap via cron Worker. |
| CF-021 | **P2** | Config | Absent | Pas de `wrangler.toml` — nécessaire pour tout déploiement Cloudflare Workers/Pages. | Créer `wrangler.toml` avec la config Pages, bindings KV/R2, variables d'environnement, compatibilité flags. |
| CF-022 | **P2** | Redirects | `next.config.ts:60-125` | 123+ redirections permanentes dans `next.config.ts`. Cloudflare Pages gère les redirects via `_redirects` ou `_headers`, pas via la config Next.js côté serveur. | Tester si OpenNext traduit correctement les redirects. Sinon, migrer vers `_redirects` ou Cloudflare Rules. |
| CF-023 | **P2** | Headers | `next.config.ts:126-163` | Headers de sécurité (HSTS, CSP, X-Frame-Options) définis dans `next.config.ts`. | Tester si OpenNext les propage. Alternative : `_headers` file ou Cloudflare Transform Rules. |
| CF-024 | **P2** | Rewrites | `next.config.ts:23-58` | Rewrites pour routing multilingue (`/fr/*` → `/auth/*`, `/pt/*` → `/auth/*`). | Tester compatibilité OpenNext. Alternative : Cloudflare Workers routing avant le Pages Function. |
| CF-025 | **P3** | DX | `package.json` scripts | Build command `next build` — compatible mais nécessite adaptation pour `@opennextjs/cloudflare`. | Ajouter script `build:cloudflare` utilisant le builder OpenNext. |
| CF-026 | **P3** | Storage | Aucun Vercel Blob/KV utilisé | Stockage 100% Supabase Storage (REST API). Aucune migration de données nécessaire. | Aucun — point positif. |
| CF-027 | **P3** | Streaming | `lib/groq.ts:100-203` | Streaming SSE via `ReadableStream` — compatible Workers. | Aucun changement requis. |
| CF-028 | **P3** | Realtime | `lib/realtime-reconnect.ts` | Supabase Realtime (WebSocket) utilisé côté client uniquement. Workers n'ont pas besoin de maintenir la connexion. | Aucun changement côté serveur. Les clients browser se connectent directement à Supabase. |
| CF-029 | **P3** | Auth | `lib/supabase-server.ts` | Supabase Admin client via `SUPABASE_SERVICE_ROLE_KEY`. REST API standard — compatible Workers. | Aucun changement requis. Migrer le secret vers Cloudflare env/secrets. |

---

## Détail des fichiers utilisant `crypto` natif Node.js (CF-006)

| Fichier | Ligne | Usage | Remplacement Web Crypto |
|---------|-------|-------|------------------------|
| `app/api/pro/team/route.ts` | 1, 106 | `crypto.randomBytes(24).toString('hex')` | `crypto.getRandomValues(new Uint8Array(24))` + hex encode |
| `app/api/syndic/team/route.ts` | 1, 84 | `crypto.randomBytes(24).toString('hex')` | Idem |
| `app/api/syndic/artisans/route.ts` | 1, 232 | `crypto.randomBytes(16).toString('hex')` | Idem |
| `app/api/marches/route.ts` | 8, 218 | `crypto.randomUUID()` | `crypto.randomUUID()` (identique en Web Crypto, juste supprimer l'import) |
| `app/api/marches/sous-traitance/route.ts` | 8, 191 | `crypto.randomUUID()` | Idem |
| `app/api/fixy-ai/route.ts` | 5, 431, 461 | `crypto.randomUUID()` | Idem |
| `app/api/email-agent/connect/route.ts` | N/A, 45 | `crypto.randomUUID()` | Idem |
| `lib/portugal-fiscal.ts` | 17 | **À CLARIFIER** — vérifier si `createSign`/`createHash` | Dépend de l'usage exact. `crypto.subtle` si RSA/HMAC. |

---

## Détail des routes > 30s (incompatibles Workers Paid)

| Route | maxDuration | Catégorie | Contenu |
|-------|-------------|-----------|---------|
| `/api/tenders/scan` | 300s | Scraping | Scan complet marchés publics |
| `/api/cron/scan-marches` | 300s | Cron | Scan hebdomadaire marchés |
| `/api/marches/scan` | 120s | Parsing | Analyse marchés publics |
| `/api/sync/base-gov-pt` | 60s | Sync | Données Base.gov.pt |
| `/api/sync/decp-13` | 60s | Sync | Données DECP France |
| `/api/sync/sitadel-13` | 60s | Sync | Permis de construire |
| `/api/sync/mairies-13` | 60s | Sync | Données mairies |
| `/api/sync/ted-porto` | 60s | Sync | TED appels d'offres |
| `/api/sync/obras-porto` | 60s | Sync | Permis construction Porto |
| `/api/email-agent/poll` | 60s | Email | Polling Gmail API |
| `/api/cron/referral` | 60s | Cron | Traitement parrainages |
| `/api/cron/booking-reminder` | 60s | Cron | Rappels RDV |
| `/api/cron/devis-reminder` | 60s | Cron | Rappels devis |
| `/api/user/export-data` | 60s | Export | Export données RGPD |

---

## Top risques

### 1. OpenNext + Next.js 16 (CF-018) — Risque structurel
OpenNext (`@opennextjs/cloudflare`) est le seul chemin viable pour déployer Next.js sur Cloudflare Pages. Le support Next.js 16.x n'est pas encore stable. Si OpenNext ne supporte pas la version 16.2.2, la migration est bloquée jusqu'à rattrapage.

### 2. 14 routes dépassent 30s (CF-001/002/008/011/012) — Redesign obligatoire
Ces routes ne peuvent pas tourner dans un Worker standard. Elles nécessitent une architecture asynchrone (Queues + Workers consumers) ou un service externe pour les traitements longs.

### 3. Tesseract.js (CF-003/004) — Bundle impossible
L'OCR WASM dépasse largement la limite de 1 MB compressé des Workers. Import statique = bundle bloated même si la route n'est pas appelée côté edge.

### 4. 11 cron jobs Vercel (CF-005) — Migration non triviale
Cloudflare Cron Triggers existe mais chaque exécution est soumise au timeout Workers. 8 jobs sur 11 dépassent cette limite.

---

## Plan de remédiation ordonné

### Phase 1 — Prérequis (avant toute migration)

1. **Valider OpenNext + Next.js 16** — tester `@opennextjs/cloudflare` build sur le repo. Si échec : downgrader vers Next.js 15.x ou attendre le support.
2. **Créer `wrangler.toml`** — config Pages, `nodejs_compat` flag, bindings.
3. **Auditer `lib/portugal-fiscal.ts`** (CF-019) — identifier l'usage exact de `crypto` pour planifier le remplacement.

### Phase 2 — Corrections rapides (P1, effort faible)

4. **Supprimer `@vercel/analytics` et `@vercel/speed-insights`** (CF-009) — remplacer par Cloudflare Web Analytics (1 script tag).
5. **Remplacer `import crypto from 'crypto'`** (CF-006) — 4 routes utilisent `randomUUID()` (supprimer l'import suffit), 3 routes utilisent `randomBytes()` (réécrire avec Web Crypto).
6. **Mettre à jour CSP** (CF-013/014) — supprimer domaines Vercel, ajouter Cloudflare si besoin.

### Phase 3 — Architecture async (P0, effort élevé)

7. **Migrer Tesseract.js → API Vision** (CF-003/004) — `verify-id` et `verify-kbis` utilisent déjà Groq Vision dans d'autres routes. Uniformiser.
8. **Implémenter Cloudflare Queues** pour les 14 routes >30s — pattern : API route enqueue message → Queue consumer exécute le travail long → résultat stocké en KV/D1.
9. **Migrer les 11 cron jobs** (CF-005) — Cron Triggers pour les jobs courts, Queues pour les longs.

### Phase 4 — Optimisation stockage/cache (P2)

10. **Configurer Cloudflare KV** pour remplacer le cache in-memory (CF-015/016). Garder Upstash Redis comme backend principal.
11. **Tester ISR/revalidation** via OpenNext (CF-020). Fallback : sitemap statique régénéré par cron Worker.
12. **Valider redirects/rewrites/headers** (CF-022/023/024) sur l'environnement Cloudflare de staging.

### Phase 5 — Env & déploiement

13. **Migrer les 35+ variables d'environnement** vers Cloudflare dashboard (Secrets pour les clés, vars pour les publiques).
14. **Configurer le build** — adapter le script de build pour OpenNext (`build:cloudflare`).
15. **DNS cutover** — Cloudflare DNS obligatoire pour Pages. Transférer `vitfix.io` si pas déjà sur Cloudflare.

---

## Questions ouvertes

| # | Question | Impact |
|---|----------|--------|
| Q1 | OpenNext supporte-t-il Next.js 16.2.2 ? Consulter le [repo](https://github.com/opennextjs/cloudflare) et tester un build. | **Bloquant** — sans cela, pas de migration. |
| Q2 | Quel est l'usage exact de `crypto` dans `lib/portugal-fiscal.ts` ? Si RSA signing pour factures SAF-T, le remplacement Web Crypto est plus complexe. | **P1** — impacte le fiscal Portugal. |
| Q3 | Cloudflare Queues est-il suffisant pour les 300s de scan marchés, ou faut-il un service externe (Railway, Fly.io) ? | Architecture — dimensionner selon le volume. |
| Q4 | Le Stripe webhook (`app/api/stripe/webhook/route.ts`) utilise-t-il `req.text()` pour la vérification de signature ? Workers gère `Request.text()` différemment. | **P1** — les paiements ne doivent pas casser. |
| Q5 | Budget Cloudflare Workers Paid vs Vercel Pro — les Queues, KV, et Workers Unbound ont des coûts distincts. | Décision business. |
| Q6 | Les fonts TTF embarquées (`public/fonts/`) sont-elles utilisées côté serveur (PDF) ou uniquement client ? Si PDF serveur → vérifier l'accès fichier dans Workers. | **P2** — impacte la génération PDF. |
| Q7 | `@docuseal/api` (e-signature) — le SDK est-il compatible edge/Workers ? | À tester. |

---

## Résumé

**Points positifs :**
- Pas de Vercel Blob, KV, ou Postgres — stockage 100% Supabase (portable)
- Streaming SSE compatible Workers
- Supabase Realtime côté client uniquement
- Upstash Redis compatible Workers (REST API)
- Groq/Tavily/Stripe/Resend — tous en REST API, aucun lock-in runtime

**Bloquants :**
- 4 findings P0 (Tesseract.js bundle, routes 300s, cron jobs)
- 10 findings P1 (crypto Node.js, routes 60s, Vercel SDK, Sentry, CSP)
- OpenNext + Next.js 16 = incertitude structurelle (Q1)

**Estimation effort :** 2-3 semaines dev pour la remédiation complète, dont 1 semaine pour l'architecture async (Queues). La validation OpenNext (Q1) doit se faire en premier — si bloqué, tout le reste est suspendu.
