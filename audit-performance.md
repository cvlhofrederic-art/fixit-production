# Audit Performance — Vitfix.io

**Date :** 11 avril 2026  
**Scope :** Application Next.js 16.2.2 + Supabase + Vercel  
**Mode :** Read-only, analyse statique du code source  
**Auditeur :** Claude Code (Opus 4.6)

---

## 1. Cartographie du perimetre audite

| Zone | Fichiers cles | Status |
|------|--------------|--------|
| **Build config** | `next.config.ts`, `package.json`, `postcss.config.mjs`, `vercel.json` | Audite |
| **Middleware** | `proxy.ts` (305 lignes) | Audite |
| **Layout racine** | `app/layout.tsx` (382 lignes) | Audite |
| **API routes** | 57 routes dans `app/api/` | Audite |
| **Composants client** | 263 fichiers `'use client'` | Audite |
| **CSS** | `globals.css` (2506 lignes), 3 modules CSS dashboard | Audite |
| **Images** | `public/` (avatars PNG), patterns `<img>` vs `<Image>` | Audite |
| **Fonts** | 7 Google Fonts via `next/font` | Audite |
| **Sentry** | `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` | Audite |
| **Supabase queries** | Patterns `.from()`, `.select()`, `.limit()` dans API + hooks | Audite |
| **Sitemap** | `app/sitemap.ts` (~1000 URLs, query DB) | Audite |
| **Cache** | `lib/cache.ts`, headers HTTP, Vercel Edge | Audite |
| **Cron jobs** | 11 jobs dans `vercel.json` | Audite |
| **Static generation** | `generateStaticParams()` sur pages SEO PT/FR | Audite |

**Non audite (hors scope) :** Supabase DB indexes (pas d'acces admin), Vercel dashboard (metriques runtime), Cloudflare (pas configure), Lighthouse reel (pas de navigateur).

---

## 2. Tableau des findings

### Legende severites
- **P0** : Impact critique sur performance ou cout, correction immediate
- **P1** : Impact significatif, correction dans la semaine
- **P2** : Optimisation importante, sprint suivant
- **P3** : Amelioration mineure, backlog

---

| ID | Sev | Categorie | Source | Description | Fix suggere |
|----|-----|-----------|--------|-------------|-------------|
| **PERF-01** | P0 | Middleware | `proxy.ts:167` | **Auth Supabase sur chaque requete** — `await supabase.auth.getUser()` bloque chaque requete (images, CSS, API) avec un round-trip reseau vers Supabase (50-200ms). Aucun cache de session. | Exclure les assets statiques du matcher middleware ou cacher le resultat auth en cookie/edge cache avec TTL court (30s). |
| **PERF-02** | P0 | Backend | `app/api/marketplace-btp/route.ts:67` | **Query Supabase sans limite** — `.select('*')` sans `.limit()` retourne TOUS les listings marketplace. Response size illimitee. | Ajouter `.limit(50)` + pagination (offset/cursor). |
| **PERF-03** | P0 | Rendering | `app/layout.tsx:90` | **`cookies()` dans le layout racine** — Force le rendering dynamique sur TOUTES les pages de l'application. Aucune page n'est statiquement cached au build. | Deplacer `cookies()`/`headers()` dans les segments qui en ont besoin (dashboard, auth) et non dans le root layout. |
| **PERF-04** | P1 | Monitoring | `sentry.client.config.ts:13` | **Sentry tracesSampleRate a 1.0 (100%)** — Chaque interaction utilisateur envoie une transaction a Sentry. A 1000 visiteurs/jour = 1000+ transactions, depassement quota rapide + overhead reseau. | Reduire a `0.05` (5%) en production. Le server est deja a 0.1. |
| **PERF-05** | P1 | Frontend | `app/layout.tsx:4-63` | **7 Google Fonts chargees** — DM Sans, Syne, Montserrat, Outfit, Playfair Display, IBM Plex Sans, IBM Plex Mono. Environ 20+ fichiers de font (weights multiples). Estimation: 200-400KB de fonts au total. | Reduire a 2-3 familles max. Auditer quelles fonts sont reellement utilisees sur quelles pages. Lazy-load les fonts secondaires. |
| **PERF-06** | P1 | Backend | `app/api/btp/route.ts:38-67` | **Over-fetching massif BTP** — 6 tables requetees avec `select('*')` et limites hautes (200-500 rows). Transfere potentiellement 100KB+ de donnees dont une partie est inutilisee cote client. | Specifier les colonnes exactes dans chaque `.select()`. Reduire les `.limit()` au strict necessaire. |
| **PERF-07** | P1 | CSS | `app/globals.css:1-2506` | **CSS global de 2506 lignes** — Contient les styles Tailwind + custom properties + styles dashboard. Render-blocking sur le first paint. Pas de content purging visible dans la config Tailwind v4. | Verifier que Tailwind v4 purge correctement (auto-detection des fichiers source). Extraire les styles dashboard dans des CSS modules charges a la demande. |
| **PERF-08** | P1 | Images | `public/fixy-avatar.png` (924KB), `public/lea-avatar.png` (851KB), `public/max-avatar.png` (188KB) | **Avatars PNG non optimises** — 3 fichiers totalisant ~2MB en PNG. Servis sans optimisation Next.js si references directement. | Convertir en WebP/AVIF. Redimensionner a la taille d'affichage reelle (probablement 48-96px). Utiliser `<Image>` avec `width`/`height`. |
| **PERF-09** | P1 | Images | 19 fichiers divers | **`unoptimized={true}` sur 19 composants Image** — Bypass complet de l'optimisation Next.js (resize, format, lazy loading). Fichiers : `app/pro/register/page.tsx`, `app/pro/mobile/page.tsx`, `app/client/dashboard/page.tsx`, etc. | Retirer `unoptimized` partout ou c'est possible. Pour les data URIs/blobs de preview, c'est acceptable mais documenter pourquoi. |
| **PERF-10** | P2 | Bundle | `package.json` | **Pas d'analyseur de bundle** — Aucun `@next/bundle-analyzer` ou equivalent configure. Impossible de tracker la taille du bundle JS au fil du temps. | Installer `@next/bundle-analyzer`, ajouter script `"analyze": "ANALYZE=true next build"`. Integrer dans CI. |
| **PERF-11** | P2 | Backend | 60 instances | **Pattern `select('*')` generalise** — 60 occurrences de `.select('*')` dans les API routes. Sur-selection systematique de colonnes inutiles. | Remplacer par des selections explicites de colonnes. Commencer par les routes a fort trafic (artisans-catalogue, bookings, btp). |
| **PERF-12** | P2 | Backend | `app/api/marches/sous-traitance/route.ts:71-75` | **Candidatures sans limite** — Query `.select()` sur candidatures sans `.limit()`. Response potentiellement volumineuse. | Ajouter `.limit(100)` + pagination. |
| **PERF-13** | P2 | Middleware | `proxy.ts:55` | **Generation nonce crypto par requete** — `btoa(crypto.randomUUID())` execute sur chaque requete, meme les assets statiques. | Limiter la generation de nonce aux requetes HTML uniquement (pas les API, images, fonts). |
| **PERF-14** | P2 | Rendering | `app/sitemap.ts:343` | **Sitemap avec query DB a la demande** — Query Supabase pour 500 artisans a chaque generation. Latence 200-500ms. Limite a 500 artisans (URLs manquantes si >500). | Cacher la sitemap avec `revalidate = 3600` (1h). Augmenter la limite ou paginer si >500 artisans. |
| **PERF-15** | P2 | Frontend | `components/DevisFactureForm.tsx` (3330 lignes) | **Composant monolithique** — 3330 lignes dans un seul fichier client. Charge entierement en memoire meme si seule une partie est visible. | Splitter en sous-composants (DevisForm, FactureForm, PDFPreview, etc.) avec lazy loading interne. |
| **PERF-16** | P2 | Backend | `app/api/marketplace-btp/route.ts:67-89` | **Pas de Cache-Control sur marketplace GET** — Endpoint liste sans header de cache. Chaque requete frappe la DB. | Ajouter `Cache-Control: s-maxage=300, stale-while-revalidate=600`. |
| **PERF-17** | P2 | Cron | `vercel.json:3-46` | **11 cron jobs concentres lundi 5-9h** — Pic de charge serveur potentiel chaque lundi matin. 7 jobs entre 5h et 9h le lundi. | Distribuer les jobs sur la semaine (mardi-vendredi) ou les espacer davantage. |
| **PERF-18** | P2 | Frontend | 263 fichiers | **263 composants `'use client'`** — Nombre eleve de composants client. Certains pourraient etre des Server Components (affichage statique, pas d'interactivite). | Auditer les composants `'use client'` les plus gros. Convertir en Server Components ceux qui ne font que de l'affichage. |
| **PERF-19** | P3 | Rendering | Codebase-wide | **Pas d'ISR/revalidation** — Aucun `revalidatePath()` ou `revalidateTag()` trouve. Toute l'invalidation de cache repose sur les headers HTTP. | Implementer ISR avec `revalidate` sur les pages profil artisan, catalogue, blog. |
| **PERF-20** | P3 | Scripts | `app/layout.tsx:15-17` | **Pas de `next/script` utilise** — Les scripts tiers (Vercel Analytics, Speed Insights) sont charges via composants React. Pas de strategie `afterInteractive`/`lazyOnload`. | Migrer les scripts tiers non critiques vers `<Script strategy="lazyOnload">` si applicable. |
| **PERF-21** | P3 | Frontend | `next.config.ts:56-118` | **42 redirections permanentes** — Chaque redirect ajoute un hop reseau si pas cache par le CDN. | Verifier que Vercel Edge cache bien les 301. Consolider les redirects si possible. |
| **PERF-22** | P3 | Backend | `app/api/reviews/route.ts:46-56` | **`auth.admin.listUsers()` pour recherche** — Utilise la pagination admin Supabase (perPage: 1000) au lieu d'un index DB. Lent a grande echelle. | Stocker les noms utilisateurs dans une table denormalisee ou utiliser un index. |
| **PERF-23** | P3 | Frontend | `app/layout.tsx:339-362` | **JSON-LD inline dans chaque page** — Schema.org injecte via `dangerouslySetInnerHTML` dans le layout racine. Augmente la taille HTML de chaque page. | Deplacer le JSON-LD dans les pages specifiques (service, artisan, accueil) plutot que le layout racine. |
| **PERF-24** | P3 | Middleware | `proxy.ts:31-49` | **Detection locale sur chaque requete** — Parsing Accept-Language + geolocation meme quand le cookie locale existe deja. | Short-circuit: si le cookie locale existe, skip la detection geo/Accept-Language. |

---

## 3. Top risques

### Risque 1 — Latence middleware (PERF-01 + PERF-13 + PERF-24)
**Impact :** +50-200ms sur CHAQUE requete HTTP, y compris les assets statiques.  
**Cause :** `proxy.ts` execute `supabase.auth.getUser()` + generation nonce + detection locale sur toutes les requetes non exclues par le matcher.  
**Estimation :** A 100 requetes/page, ca represente 5-20 secondes de latence cumulee par chargement de page.  
**Mitigation :** Restreindre le middleware aux routes qui en ont besoin (/pro/, /syndic/, /client/, /api/) et exclure strictement les assets.

### Risque 2 — Rendering dynamique force (PERF-03)
**Impact :** Aucune page n'est servie depuis le cache statique Vercel.  
**Cause :** `cookies()` appele dans `app/layout.tsx` (root layout) force le dynamic rendering sur l'ensemble du site.  
**Estimation :** Les pages SEO (services, villes, blog) qui devraient etre statiques sont generees a chaque requete. TTFB degrade de 200-500ms vs static.  
**Mitigation :** Restructurer pour que seuls les layouts authentifies appellent `cookies()`.

### Risque 3 — Queries DB non bornees (PERF-02 + PERF-06 + PERF-11 + PERF-12)
**Impact :** Temps de reponse API imprevisible, cout Supabase croissant.  
**Cause :** `select('*')` sans `.limit()` ou avec des limites trop hautes (500 rows). 60 instances identifiees.  
**Estimation :** A mesure que les donnees croissent, certaines API vont depasser 1-2s de latence.  
**Mitigation :** Audit systematique des `.select()` — colonnes explicites + `.limit()` raisonnable + pagination.

### Risque 4 — Poids frontend (PERF-05 + PERF-07 + PERF-08 + PERF-15)
**Impact :** LCP degrade, surtout sur mobile (3G/4G lent).  
**Cause :** 7 fonts (~300KB), globals.css (2506 lignes), avatars PNG (~2MB), composant monolithique 3330 lignes.  
**Estimation :** First Contentful Paint > 3s sur connexion lente.  
**Mitigation :** Reduire les fonts a 2-3, compresser les images, verifier le purge Tailwind, splitter les gros composants.

---

## 4. Plan de remediation ordonne

### Phase 1 — Gains immediats (1-2 jours)

| Priorite | Finding | Action | Impact estime |
|----------|---------|--------|---------------|
| 1 | PERF-01 | Restreindre le middleware matcher pour exclure assets statiques, fonts, images | -50-200ms/requete sur assets |
| 2 | PERF-04 | Reduire `tracesSampleRate` a 0.05 dans `sentry.client.config.ts` | -5-15ms/interaction + economie quota |
| 3 | PERF-02 | Ajouter `.limit(50)` sur marketplace-btp GET | Previent explosion response |
| 4 | PERF-08 | Convertir 3 avatars PNG en WebP et redimensionner | -1.8MB sur pages utilisant ces avatars |
| 5 | PERF-16 | Ajouter Cache-Control sur marketplace-btp GET | Reduit hits DB |

### Phase 2 — Optimisations structurelles (1 semaine)

| Priorite | Finding | Action | Impact estime |
|----------|---------|--------|---------------|
| 6 | PERF-03 | Restructurer layout pour deplacer `cookies()` hors du root layout | Pages SEO deviennent statiques, TTFB divise par 2-5x |
| 7 | PERF-05 | Auditer les fonts, reduire a 3 familles max | -150-250KB de fonts |
| 8 | PERF-06 | Refactorer les 6 queries BTP avec colonnes explicites | Reduit payload de 30-60% |
| 9 | PERF-07 | Verifier purge Tailwind v4 + extraire CSS dashboard | Reduit CSS blocking |
| 10 | PERF-11 | Remplacer les 60 `select('*')` les plus critiques | Reduit transfert DB global |

### Phase 3 — Optimisations avancees (2 semaines)

| Priorite | Finding | Action | Impact estime |
|----------|---------|--------|---------------|
| 11 | PERF-10 | Installer bundle analyzer + baseline | Tracking continu des regressions |
| 12 | PERF-15 | Splitter DevisFactureForm.tsx en sous-composants | Reduit JS charge initialement |
| 13 | PERF-14 | Cacher sitemap avec `revalidate = 3600` | -200-500ms par crawl |
| 14 | PERF-19 | Ajouter ISR sur pages profil artisan et catalogue | TTFB < 100ms pour pages populaires |
| 15 | PERF-18 | Auditer les 263 `'use client'` — convertir les plus simples en Server Components | Reduit hydration JS |
| 16 | PERF-17 | Redistribuer les cron jobs sur la semaine | Lisse la charge serveur |

### Phase 4 — Polish (backlog)

| Priorite | Finding | Action |
|----------|---------|--------|
| 17 | PERF-09 | Auditer les 19 `unoptimized={true}` et retirer ou est possible |
| 18 | PERF-20 | Migrer scripts tiers vers `next/script` |
| 19 | PERF-22 | Denormaliser les noms utilisateurs pour eviter `listUsers()` |
| 20 | PERF-23 | Deplacer JSON-LD du layout racine vers les pages concernees |
| 21 | PERF-24 | Short-circuit detection locale si cookie deja present |

---

## 5. Reponses aux questions initiales

### Web Vitals
| Metrique | Estimation statique | Verdict |
|----------|-------------------|---------|
| **LCP < 2.5s** | A CLARIFIER — Middleware auth (PERF-01) + dynamic rendering (PERF-03) degradent probablement le LCP au-dela de 2.5s sur mobile. Fonts lourdes (PERF-05) et CSS blocking (PERF-07) aggravent. | Probablement NON sur mobile |
| **INP < 200ms** | Probable OUI — Les interactions principales sont dans des composants client avec dynamic imports. Pas de JS blocking identifie sur les interactions. | Probable OUI |
| **CLS < 0.1** | A CLARIFIER — Les fonts Google avec `next/font` previennent le FOIT. Les images avec `<Image>` reservent l'espace. Mais les 19 `unoptimized` et les `<img>` legacy pourraient causer du layout shift. | Probable OUI si images dimensionnees |
| **Lighthouse > 90** | A CLARIFIER — Necessite un test reel. Les issues PERF-01/03/05/07/08 impactent Performance. SEO et Best Practices probablement > 90. | Performance < 90 probable |

### Frontend
| Question | Reponse |
|----------|---------|
| Bundle size analyse ? | NON — Pas d'outil configure (PERF-10) |
| Code splitting ? | OUI — 28+ dynamic imports sur le dashboard principal, pattern bien utilise |
| Images WebP/AVIF ? | PARTIELLEMENT — Next.js Image convertit automatiquement, mais 3 avatars PNG non optimises (PERF-08) et 19 `unoptimized` (PERF-09) |
| Fonts optimisees ? | PARTIELLEMENT — `next/font` utilise (bon), mais 7 familles chargees (PERF-05) |

### Backend
| Question | Reponse |
|----------|---------|
| Requetes N+1 ? | RARES — Bon usage de `Promise.all()` dans la plupart des routes. Quelques loops sequentiels dans syndic/artisans |
| Indexes DB ? | 167 `CREATE INDEX` dans les migrations. Couverture correcte sur FK et colonnes filtrees. A CLARIFIER : indexes composites (owner_id, created_at) |
| Cache ? | OUI — `lib/cache.ts` avec Redis + fallback in-memory. 41/57 routes ont des Cache-Control headers |
| Pagination ? | PARTIELLEMENT — Reviews paginee, mais marketplace (PERF-02) et sous-traitance (PERF-12) non bornees |

### Edge
| Question | Reponse |
|----------|---------|
| CDN assets caches ? | OUI — `max-age=31536000, immutable` sur images/fonts/icones. Excellent |
| Cache headers corrects ? | OUI pour 41/57 routes. PERF-16 : marketplace manquant |
| Stale-while-revalidate ? | OUI — Pattern `s-maxage + stale-while-revalidate` utilise sur la majorite des routes API |

---

## 6. Questions ouvertes

| # | Question | Raison |
|---|----------|--------|
| Q1 | Quel est le trafic reel (pageviews/jour, requetes API/jour) ? | Permet de prioriser PERF-04 (Sentry cout) et PERF-02 (queries non bornees) |
| Q2 | Le purge Tailwind v4 est-il actif ? | Tailwind v4 auto-detecte les fichiers source, mais aucune config explicite trouvee. La taille reelle du CSS en production est inconnue |
| Q3 | Combien d'artisans verifies en DB ? | Si > 500, le sitemap tronque des URLs (PERF-14, limit 500) |
| Q4 | Le middleware matcher dans `proxy.ts` exclut-il bien les `_next/static` ? | Le matcher config (lignes 295-304) semble exclure `/static/`, mais verifier si les fonts et images passent quand meme |
| Q5 | Y a-t-il un plan pour Cloudflare ou autre CDN devant Vercel ? | Impacterait la strategie de cache headers et les recommandations PERF-01/13/24 |
| Q6 | Les 42 redirects dans next.config.ts sont-ils toutes necessaires ? | Certaines pourraient etre consolidees pour reduire la config (PERF-21) |
| Q7 | Quelles fonts sont reellement utilisees sur quelles pages ? | Prerequis pour PERF-05 — reduire sans casser le design |
| Q8 | Le composant `DevisFactureForm.tsx` (3330 lignes) est-il charge sur d'autres pages que le dashboard ? | Determine l'urgence de PERF-15 |

---

## 7. Positifs identifies

Pour equilibrer l'audit, voici ce qui fonctionne bien :

- **Code splitting dashboard** : 28+ `dynamic()` imports avec `webpackPrefetch` sur les sections chaudes — pattern exemplaire
- **Cache HTTP structure** : `s-maxage + stale-while-revalidate` sur la majorite des API routes
- **Rate limiting** : 57/57 routes protegees via `lib/rate-limit.ts` (Upstash Redis)
- **Static asset caching** : 1 an immutable sur images/fonts — optimal
- **PDF libs lazy-loaded** : jsPDF, html2canvas, tesseract.js charges dynamiquement
- **Static generation SEO** : `generateStaticParams()` sur les pages services/villes PT et FR
- **Sentry server-side** : Sample rate a 0.1 (10%) — raisonnable
- **Security headers** : CSP + HSTS + X-Frame-Options complets
- **`optimizePackageImports`** : Active pour sonner, recharts, jspdf, supabase — tree-shaking correct
- **Source maps supprimees** apres upload Sentry — pas d'exposition en production

---

*Audit genere le 11 avril 2026 — Analyse statique uniquement, pas de mesures runtime.*
