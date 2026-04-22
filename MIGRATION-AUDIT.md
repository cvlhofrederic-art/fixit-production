# MIGRATION-AUDIT.md — Vercel → Cloudflare (vitfix.io)

> **Phase 1 — cartographie, lecture seule.** Aucun fichier du projet n'a été modifié.
> Livrable demandé par [MIGRATION-VERCEL-TO-CLOUDFLARE.md](../../Documents/MIGRATION-VERCEL-TO-CLOUDFLARE.md).

---

## 1. Résumé exécutif

- La migration est **faisable** et **partiellement préparée** : `wrangler.toml`, script `build:cloudflare` avec `@opennextjs/cloudflare`, et trois documents d'audit (`audit-cloudflare-compat.md`, `MIGRATION_INVENTORY.md`, `audit-api.md`) existent déjà à la racine du repo.
- Le projet est une **app Next.js 16.2.2 mono-repo** (App Router, React 19, TS 5, Tailwind v4). Aucun package `@vercel/*` n'est importé : le couplage Vercel est faible.
- Backend 100 % portable : **Supabase** (DB + Auth + Storage), **Upstash Redis**, **Stripe**, **Resend**, **Sentry**, **Groq**. Rien à migrer côté données.
- Les trois modules à conserver (**Client**, **Artisan**, **BTP Pro**) existent bien. Les modules à désactiver (**Syndic**, **Conciergerie**, **Gestionnaire Immo**, **Copropriétaire**) sont mélangés : Syndic et Copropriétaire sont isolés, mais Conciergerie et Gestionnaire Immo sont **importés dynamiquement par `app/pro/dashboard/page.tsx`** via `ConciergerieSections.tsx` et `GestionnaireSections.tsx` → désactivation par simple suppression d'import risque de casser le dashboard BTP Pro.
- Trois blockers principaux : (1) **OpenNext × Next 16** à valider par un build test (l'audit signale un risque P0) ; (2) **10 routes API avec `maxDuration` 60-300 s** incompatibles avec la limite 30 s des Workers (nécessitent Cloudflare Queues) ; (3) **`proxy.ts` dépend de `request.geo` (Vercel)** et doit être refactorisé vers `CF-IPCountry`.
- Estimation Phase 1 → prod stable : **2 à 3 semaines** de dev, dont environ 1 semaine pour l'architecture async (Queues).

---

## 2. Stack détectée

### 2.1 Framework & runtime

| Élément | Valeur |
|---|---|
| Framework | Next.js **16.2.2** (App Router) |
| React | 19.2.3 |
| TypeScript | ^5 (strict, `target ES2017`, `moduleResolution bundler`) |
| CSS | Tailwind CSS v4 + PostCSS |
| Runtime Node | Node 20 (`@types/node ^20`) |
| Package manager | npm (uniquement `package-lock.json`, pas de workspaces) |
| Linter / format | ESLint 9 (`eslint-config-next 16.2.2`) |
| Tests | Vitest 4 (unit) + Playwright 1.59 (E2E, chromium/firefox/webkit) + Axe-core |
| Bundle analyzer | `@next/bundle-analyzer` (via `ANALYZE=true`) |
| Instrumentation | [instrumentation.ts](instrumentation.ts) — valide les env vars au boot |

Pas de monorepo, pas de Turborepo / Nx / pnpm workspaces.

### 2.2 Backend & données

| Service | Usage | Portabilité CF |
|---|---|---|
| **Supabase** (`@supabase/ssr 0.8`, `@supabase/supabase-js 2.95`) | Postgres 15 (86 tables, 51 migrations), Auth SSR, Storage, Realtime | ✅ REST/WS, 100 % portable |
| **Upstash Redis** (`@upstash/redis`, `@upstash/ratelimit`) | Rate limit + cache léger | ✅ REST natif Workers |
| **Stripe** (`stripe 20.4`, `@stripe/stripe-js 8.8`) | Paiement + webhooks | ✅ REST |
| **Resend** (`resend 6.11`) | Email transactionnel | ✅ REST |
| **Sentry** (`@sentry/nextjs 10.47`) | Monitoring | ⚠️ à tester avec OpenNext (l'audit recommande `@sentry/cloudflare` en fallback) |
| **Langfuse** (`langfuse 3.38`) | Observabilité LLM | ✅ REST |
| **Groq / Tavily / OpenRouter** | IA (10 agents actifs) | ✅ REST |
| **DocuSeal** (`@docuseal/api 1.0`) | Signature devis | ✅ REST |
| **Portugal Fiscal** (`lib/portugal-fiscal.ts`, 3 routes `/api/portugal-fiscal/*`) | SAF-T, série fiscale, cert | ⚠️ crypto Node natif — à porter sur Web Crypto API |
| Mobile | Capacitor 8 (`com.fixit.artisan`), export statique `webDir: 'out'` | ✅ indépendant de l'hébergement web |

**Aucun service Vercel propriétaire** n'est utilisé : pas de Vercel Blob, KV, Postgres, OG, Analytics, Speed-Insights.

### 2.3 Configuration actuelle

- [next.config.ts](next.config.ts) : 58 rewrites locale (fr/pt), 38 redirects permanent (PT/FR), `remotePatterns` Supabase + Google + ui-avatars, CSP statique détaillée (avec `vercel-insights.com` à retirer).
- [vercel.json](vercel.json) : 11 crons (voir §4.5).
- [wrangler.toml](wrangler.toml) : projet `vitfix`, `compatibility_date 2024-09-23`, `nodejs_compat`, `pages_build_output_dir .open-next`, 5 crons déjà mappés, bindings KV et Queues commentés (prêts à décommenter).
- [proxy.ts](proxy.ts) (14.8 KB) : **pas** un `middleware.ts` Next, c'est une fonction `proxy()` utilisée côté server ; gère nonce CSP, geo, CSRF. Dépend de `request.geo` (API Vercel).
- [tsconfig.json](tsconfig.json) : exclut `scripts/` du build.
- [capacitor.config.ts](capacitor.config.ts) : mobile appart (artisan uniquement, `webDir out`, export statique).
- [sentry.client.config.ts](sentry.client.config.ts) + [sentry.edge.config.ts](sentry.edge.config.ts) + [sentry.server.config.ts](sentry.server.config.ts).

---

## 3. Carte des modules

### 3.1 Modules ACTIFS — à migrer

#### Client (B2C)
- UI : [app/client/](app/client/) (dashboard, login).
- API : [app/api/client/](app/api/client/) (analyse-devis, extract-pdf), [app/api/bookings/](app/api/bookings/), [app/api/booking-messages/](app/api/booking-messages/), [app/api/reviews/](app/api/reviews/), [app/api/favorites/](app/api/favorites/).
- Données SEO : [lib/seo-pages-data.ts](lib/seo-pages-data.ts), [lib/fr-seo-pages-data.ts](lib/fr-seo-pages-data.ts), [lib/en-services-data.ts](lib/en-services-data.ts).
- Aucune dépendance vers code dormant.

#### Artisan (auto-entrepreneur / micro-BTP)
- UI : [app/artisan/](app/artisan/) (SEO + dashboard via `/artisan/dashboard`), [app/pro/mobile/](app/pro/mobile/) (app Capacitor).
- API : 18 routes `app/api/artisan-*` (absences, clients, company, marches-prefs, payment-info, photos, settings, catalogue, nearby…).
- Dashboard partagé avec BTP Pro via composants `components/dashboard/*` conditionnés par `orgRole === 'artisan'`.

#### BTP Pro (société BTP)
- UI : [app/pro/dashboard/](app/pro/dashboard/) (~3 841 lignes, page monolithique), [app/pro/register/](app/pro/register/), [app/pro/tarifs/](app/pro/tarifs/), [app/pro/faq/](app/pro/faq/).
- API : [app/api/pro/](app/api/pro/), [app/api/btp/](app/api/btp/), [app/api/marketplace-btp/](app/api/marketplace-btp/), [app/api/marches/](app/api/marches/), [app/api/rfq/](app/api/rfq/), [app/api/estimation/](app/api/estimation/), [app/api/dce-analyse/](app/api/dce-analyse/), [app/api/facturx/](app/api/facturx/), [app/api/declaration-sociale/](app/api/declaration-sociale/).
- Dashboard : composants `components/dashboard/*Section.tsx` (38+) + `components/dashboard/BTP/*`.
- **Dépendance croisée critique** : [app/pro/dashboard/page.tsx](app/pro/dashboard/page.tsx) importe dynamiquement `ConciergerieSections` et `GestionnaireSections` (voir §3.2). Il faut conserver ces composants ou les gater proprement.

### 3.2 Modules DORMANTS — à désactiver (pas supprimer)

| Module | Localisation | Isolé ? | Stratégie de désactivation |
|---|---|---|---|
| **Syndic** | [app/syndic/](app/syndic/) (dashboard, login, register, invite), [app/api/syndic/](app/api/syndic/) (22 routes : missions, signalements, assemblees, immeubles, chatbot-whatsapp, lea-comptable, fixy-syndic, max-ai, etc.), [components/syndic-dashboard/](components/syndic-dashboard/) (20+ composants), [lib/syndic-pdf.ts](lib/syndic-pdf.ts) | **Oui** — aucun import depuis code actif | Retirer liens nav, feature flag `MODULE_SYNDIC_ENABLED=false`, API retournent 410 |
| **Copropriétaire** | [app/coproprietaire/](app/coproprietaire/) (dashboard, portail), [app/api/coproprietaire/signalement/](app/api/coproprietaire/signalement/), [app/api/copro-ai/](app/api/copro-ai/), [components/coproprietaire-dashboard/](components/coproprietaire-dashboard/) | **Oui** — lié à Syndic uniquement (via `ComptaCoproSection`) | Idem, flag `MODULE_COPRO_ENABLED=false` |
| **Conciergerie** | [components/dashboard/ConciergerieSections.tsx](components/dashboard/ConciergerieSections.tsx) (8 sections : proprietes, acces, channel-manager, tarification, checkin/out, livret, planning-menage, revpar). Pas de route dédiée, pas d'API dédiée. | **Non** — importé par [app/pro/dashboard/page.tsx](app/pro/dashboard/page.tsx) | Garder le fichier, gater le routing par `orgRole` ou flag, ou dummy composants |
| **Gestionnaire Immo** | [components/dashboard/GestionnaireSections.tsx](components/dashboard/GestionnaireSections.tsx) (3 sections : immeubles, missions, contrats). Pas de route ni d'API dédiée. | **Non** — importé par [app/pro/dashboard/page.tsx](app/pro/dashboard/page.tsx) | Idem |

**Rapport IA** ([app/api/rapport-ia/](app/api/rapport-ia/)) : partagé entre syndic et autres, contrôlé par `RAPPORT_IA_ACTIF`. À conserver sous flag.

---

## 4. Blockers potentiels

### 4.1 OpenNext × Next.js 16 — **CONFIRMÉ P0 (2026-04-22)**
- [audit-cloudflare-compat.md](audit-cloudflare-compat.md) signale que `@opennextjs/cloudflare` est stable sur Next 14-15, **support 16.x en cours**.
- Validation effectuée : `npm run build:cloudflare` sur Next 16.2.3 + OpenNext 1.19.3 **échoue** avec :
  - Avec `middleware.ts` seul : *"Node.js middleware is not currently supported. Consider switching to Edge Middleware."* (OpenNext refuse le runtime Node pour middleware/proxy).
  - Avec `proxy.ts` + `export const runtime = 'edge'` : *"Route segment config is not allowed in Proxy file at './proxy.ts'. Proxy always runs on Node.js runtime."* (Next 16 force Node sur proxy.ts et interdit toute config de runtime).
- **Deadlock** : Next 16 force Node pour proxy ; OpenNext 1.19.3 n'accepte que Edge. Pas de release beta plus récente (latest = 1.19.3).
- **Options** (à arbitrer avant Phase 3) :
  1. **Downgrade Next 15.5.x** — plus sûr, garde Edge middleware. Peer deps OpenNext acceptent (`>=15.5.15 <16`).
  2. **Attendre OpenNext `>=1.20.x`** supportant Next 16 Node proxy (suivre [opennextjs-cloudflare releases](https://github.com/opennextjs/opennextjs-cloudflare/releases)).
  3. **Démonter `proxy.ts`** et déporter auth/CSP/locale dans des Server Components / handlers API — gros refactor, impacte quasi toutes les routes.
- En attendant, la Phase 2 (scope reduction, feature flags, gating login/dashboard, docs) est **terminée** et commitée ; elle ne dépend pas du succès du build.

### 4.2 Routes > 30 s CPU (P0)
- 10 routes déclarent `maxDuration 60-300 s` (voir §4.5). Les Workers ont une limite de 30 s CPU.
- Solution : **Cloudflare Queues** (producer + consumer jusqu'à 15 min). La config Queues est déjà commentée dans [wrangler.toml](wrangler.toml), à décommenter et implémenter.
- `/api/tenders/scan` et `/api/cron/scan-marches` (300 s, scraping marchés publics) + Tesseract.js (bundle ~8 MB) = le plus gros effort.

### 4.3 `proxy.ts` dépendance Vercel (P1)
- Utilise `request.geo` (propriété Vercel-only).
- À remplacer par le header **`CF-IPCountry`** (natif Cloudflare).
- Nettoyer aussi la CSP : retirer `vercel-insights.com`, l'allowlist CORS `fixit-production.vercel.app`, etc.

### 4.4 ISR natif absent (P1)
- 3 fichiers utilisent `revalidate` : [app/sitemap.ts](app/sitemap.ts) (`revalidate 3600`), [app/api/verify-siret/route.ts](app/api/verify-siret/route.ts), [app/api/artisan-company/route.ts](app/api/artisan-company/route.ts).
- OpenNext a un émulateur ISR, mais la stratégie robuste = cache headers HTTP + revalidation via Queues.

### 4.5 Cron jobs (P1)

| Route | `vercel.json` | `wrangler.toml` | maxDuration | Stratégie |
|---|---|---|---|---|
| `/api/health` | ✅ | ✅ | < 30 s | Cron direct |
| `/api/cron/referral` | ✅ | ✅ | < 30 s | Cron direct |
| `/api/cron/booking-reminder` | ❌ (orphelin) | ✅ | 60 s | Queue consumer |
| `/api/cron/devis-reminder` | ❌ (orphelin) | ✅ | 60 s | Queue consumer |
| `/api/email-agent/poll` | ✅ | ✅ | 60 s | Batched pagination |
| `/api/cron/scan-marches` | ✅ | ❌ | 300 s | **Queue consumer** |
| `/api/tenders/scan` | ✅ | ❌ | 300 s | **Queue consumer** |
| `/api/marches/scan` | on-demand | ❌ | 120 s | **Queue consumer** |
| `/api/sync/decp-13` | ✅ | ❌ | 60 s | Queue consumer |
| `/api/sync/sitadel-13` | ✅ | ❌ | 60 s | Queue consumer |
| `/api/sync/mairies-13` | ✅ | ❌ | 60 s | Queue consumer |
| `/api/sync/base-gov-pt` | ✅ | ❌ | 60 s | Queue consumer |
| `/api/sync/ted-porto` | ✅ | ❌ | 60 s | Queue consumer |
| `/api/sync/obras-porto` | ✅ | ❌ | 60 s | Queue consumer |
| `/api/user/export-data` | on-demand | ❌ | 60 s | Queue consumer |

→ **11 crons Vercel**, seulement **5 déjà mappés** dans `wrangler.toml`. 10 routes à refactoriser en pattern producer / consumer.

### 4.6 Hygiène sécurité (hors-migration mais utile)
[audit-api.md](audit-api.md) signale 1 P0 (`/api/syndic/mission-report` sans auth) et 8 P1 (rate limits manquants, erreurs Supabase exposées). À traiter avant bascule DNS, mais les routes Syndic seront désactivées donc le P0 est résolu "naturellement".

### 4.7 Base de données (hors migration mais prérequis backup)
[audit-database.md](audit-database.md) : 8+ tables sans migration versionnée, pas de scripts `down` → générer `000_baseline.sql` via `pg_dump --schema-only` avant toute bascule, pour pouvoir restaurer si incident.

### 4.8 Tesseract.js (P0 si utilisé dans une route à migrer)
- Bundle ~8 MB, incompatible Workers (limite 10 MB compressé, mais RAM 128 MB).
- L'audit recommande de basculer sur **Groq Vision API** (déjà utilisée par d'autres endpoints IA).

### 4.9 Dépendances mineures
- [`lib/crypto-compat.ts`](lib/crypto-compat.ts) et 6 fichiers Portugal-fiscal utilisent `crypto` Node natif → porter sur Web Crypto API (`crypto.subtle`, `crypto.randomUUID`).
- `pg` en devDependencies uniquement (scripts de migration) — pas déployé, pas de souci Workers.
- `next/image` standard, remotePatterns à conserver tel quel (ou passer par Cloudflare Images si besoin d'optim plus poussée).

---

## 5. Plan de migration proposé

Format : `[effort] étape` avec S = < 1 j, M = 1-3 j, L = > 3 j.

### Phase 1 — Validation & préparation (1 semaine)
1. **[S]** Valider build OpenNext + Next 16 sur branche `migration/cloudflare` → GO/NO-GO de la migration.
2. **[S]** Générer baseline DB (`pg_dump --schema-only` → `supabase/migrations/000_baseline.sql`).
3. **[S]** Lister les 35+ env vars à copier depuis Vercel (déjà documentées dans [wrangler.toml](wrangler.toml)).
4. **[S]** Corriger le P0 API Syndic (auth `/api/syndic/mission-report`) ou forcer 410 via désactivation du module.

### Phase 2 — Désactivation des modules dormants (2-3 j)
Branche `chore/disable-inactive-modules`, un commit par module.
5. **[M]** Créer `lib/features.ts` exposant `MODULE_SYNDIC_ENABLED`, `MODULE_COPRO_ENABLED`, `MODULE_CONCIERGERIE_ENABLED`, `MODULE_GESTIONNAIRE_ENABLED` (lus depuis `process.env`, défaut `false` en prod).
6. **[S]** Gater les routes UI : retourner `notFound()` au niveau `layout.tsx` de chaque dossier dormant.
7. **[S]** Gater les API routes : retourner `410 Gone` en début de handler si flag off.
8. **[S]** Retirer les liens de navigation (sidebar, homepage, footer) vers ces modules.
9. **[M]** Dans [app/pro/dashboard/page.tsx](app/pro/dashboard/page.tsx), garder `ConciergerieSections` et `GestionnaireSections` mais gater leur affichage par flag — prudence : le dashboard est monolithique, ne pas casser BTP actif.
10. **[S]** Produire [MODULES.md](MODULES.md) à la racine : état de chaque module + procédure de réactivation.
11. **[S]** Tests manuels : Client / Artisan / BTP Pro intacts, 4 modules dormants invisibles.

### Phase 3 — Adaptation Cloudflare (1 semaine)
12. **[M]** Refactor [proxy.ts](proxy.ts) : `request.geo` → `CF-IPCountry` ; nettoyer CSP (retirer `vercel-insights.com`, staging URL Vercel).
13. **[S]** Remplacer `@vercel/analytics` / `@vercel/speed-insights` par Cloudflare Web Analytics (si utilisés — audit dit non, vérifier).
14. **[S]** Porter `lib/crypto-compat.ts` et Portugal-fiscal sur Web Crypto API.
15. **[M]** Si Tesseract.js actif sur une route migrée, basculer sur Groq Vision API.
16. **[S]** Remplacer `fetch(..., { next: { revalidate }})` par `Cache-Control` HTTP sur les 2 routes concernées.
17. **[S]** Provisionner : R2 bucket (si on remplace Supabase Storage, facultatif), KV namespace `CACHE`, Queue `fixit-sync-jobs`.

### Phase 4 — Crons & jobs longs (1 semaine)
18. **[L]** Créer pattern producer / consumer Queues. Un Worker consumer commun + une API route producer par job.
19. **[M]** Migrer les 10 routes > 30 s (scan-marches, tenders/scan, marches/scan, 6 sync, export-data) vers le pattern Queue.
20. **[S]** Compléter `wrangler.toml` `[triggers].crons` avec les 11 expressions cron.
21. **[S]** Vérifier `CRON_SECRET` sur chaque route cron (déjà présent).

### Phase 5 — Déploiement preview & bascule (3-5 j)
22. **[S]** Copier toutes les env vars dans Cloudflare Pages (script `wrangler pages secret put` ou dashboard).
23. **[M]** Déployer sur preview `preview.vitfix.io` pointé via Cloudflare Pages (DNS déjà chez Cloudflare).
24. **[M]** Tests E2E complets sur preview : auth, Stripe webhook (reconfigurer endpoint), upload Supabase, emails Resend, 11 crons exécutés manuellement via `wrangler triggers cron`.
25. **[M]** Lighthouse + monitoring 48 h sur preview.
26. **[S]** Bascule DNS : `vitfix.io` → Cloudflare Pages. Garder Vercel actif 72 h en fallback, baisser TTL à 300 s 24 h avant.
27. **[S]** Mettre à jour les webhooks externes : Stripe, Supabase Auth callbacks, Resend.
28. **[S]** Documenter [MIGRATION-NOTES.md](MIGRATION-NOTES.md) + procédure rollback en < 5 min (changer DNS vers Vercel).

### Phase 6 — Post-bascule (ongoing)
29. **[S]** Décommissionner le projet Vercel (après 7 j sans incident).
30. **[S]** Mettre à jour README avec commandes Cloudflare.

**Total estimé : 15-20 jours de dev** (pour 2 personnes, 2-3 semaines calendaires).

---

## 6. Questions à trancher par l'humain

1. **OpenNext × Next 16** : lancer le build de validation **maintenant**. Si NO-GO, quelle bascule ? (downgrade Next 15.x, attendre OpenNext 16, ou rester sur Vercel plus longtemps)
2. **DB** : on garde Supabase (recommandé, aucun lien avec Vercel) ? Confirmation souhaitée avant Phase 2.
3. **Adapter** : `@opennextjs/cloudflare` confirmé (déjà dans `package.json` et `wrangler.toml`) — on n'évalue pas `next-on-pages` ?
4. **Sous-domaines** : on reste sur un seul domaine `vitfix.io` avec routes (`/client`, `/pro`, `/artisan`) ? Ou on introduit `client.vitfix.io` / `pro.vitfix.io` ? (recommandation : rester sur un seul domaine, ça correspond à l'architecture actuelle.)
5. **Email transactionnel** : Resend déjà utilisé, compatible Cloudflare → rien à changer. Confirmation ?
6. **Monitoring** : `@sentry/nextjs` actuellement — on teste avec OpenNext, ou on bascule préventivement sur `@sentry/cloudflare` ?
7. **Stockage fichiers** : Supabase Storage actuellement. On migre vers **R2** (moins cher, plus proche) ou on garde Supabase ?
8. **Conciergerie & Gestionnaire Immo** : désactiver complètement (redirect 404 dans le dashboard pour les `orgRole` concernés), ou laisser accessible sous flag explicite `MODULE_CONCIERGERIE_ENABLED=true` pour quelques comptes pilotes ?
9. **Cron Porto/Portugal** : les 3 syncs PT (`base-gov-pt`, `ted-porto`, `obras-porto`) sont-ils critiques en prod immédiate ou peuvent-ils être reportés après bascule ?
10. **Preview URL** : `preview.vitfix.io` convient ? (il est déjà sous-domaine libre chez Cloudflare DNS)

---

**Fin Phase 1. En attente de validation humaine avant Phase 2 (désactivation des modules dormants).**
