# Pre-Launch Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger les 3 vrais problèmes pré-launch identifiés après audit approfondi du codebase.

**Architecture:** Les faux positifs de l'audit initial ont été écartés (migrations DB existent, auth cron correct, index Stripe existe). Seuls 3 vrais bugs subsistent : locale stale-cookie, unsafe-eval dans le CSP statique, et bugs.md désynchronisé.

**Tech Stack:** Next.js 16 App Router, TypeScript, middleware Edge Runtime, Supabase SSR

---

## Audit Corrections (faux positifs)

Ces items du rapport initial sont déjà corrects — NE PAS toucher :

| Item | Réalité |
|------|---------|
| "DB schema not in version control" | 34 migrations dans `supabase/migrations/` |
| "Cron auth via query params" | Tous les `/api/cron/*` utilisent `Authorization: Bearer` |
| "Stripe webhook index manquant" | `event_id TEXT PRIMARY KEY` = index B-tree |
| "Rate limiter unbounded" | MAX_MAP_SIZE=10k + cleanup toutes les 5min |
| "Phone placeholder +33600000000" | Déjà `+33634468897` dans `lib/constants.ts` |

---

## Task 1: Fix locale stale-cookie (bug navigation FR/PT)

**Root cause:** `app/layout.tsx:174` lit le cookie de la REQUEST. Quand middleware détecte `/pt/` et met à jour le cookie, il l'écrit dans la RESPONSE. Le root layout lit l'ancien cookie → FR translations sur pages PT.

**Files:**
- Modify: `middleware.ts` — ajouter `x-locale` dans requestHeaders
- Modify: `app/layout.tsx` — lire `x-locale` header en priorité, changer default 'fr'→'pt', fix hreflang x-default

- [ ] **Step 1: Modifier middleware.ts — ajouter x-locale dans requestHeaders**

Dans `middleware.ts`, trouver le bloc (ligne ~124-128) :
```typescript
const requestHeaders = new Headers(request.headers)
requestHeaders.set('x-nonce', nonce)
const supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
```

Remplacer par :
```typescript
const requestHeaders = new Headers(request.headers)
requestHeaders.set('x-nonce', nonce)
requestHeaders.set('x-locale', locale)
const supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
```

- [ ] **Step 2: Modifier app/layout.tsx — lire x-locale header**

Trouver la ligne ~174 :
```typescript
const locale = (cookieStore.get('locale')?.value || 'fr') as Locale
```

Remplacer par (ajouter import headers au début du fichier si absent) :
```typescript
import { headers } from 'next/headers'

// Dans la fonction RootLayout :
const headerStore = await headers()
const xLocale = headerStore.get('x-locale')
const locale = (xLocale || cookieStore.get('locale')?.value || 'pt') as Locale
```

- [ ] **Step 3: Fix hreflang x-default dans app/layout.tsx**

Trouver la ligne ~334 :
```html
<link rel="alternate" hrefLang="x-default" href="https://vitfix.io/fr/" />
```

Remplacer par :
```html
<link rel="alternate" hrefLang="x-default" href="https://vitfix.io/" />
```

Raison : `x-default` doit pointer vers l'URL racine (auto-détection de locale), pas vers `/fr/`. Le DEFAULT_LOCALE dans `lib/i18n/config.ts` est `'pt'`, pas `'fr'`.

- [ ] **Step 4: Vérifier que `headers` est bien importé dans app/layout.tsx**

Chercher si `import { cookies } from 'next/headers'` existe déjà, et ajouter `headers` dans le même import :
```typescript
import { cookies, headers } from 'next/headers'
```

- [ ] **Step 5: Commit Task 1**

```bash
git add middleware.ts app/layout.tsx
git commit -m "fix: locale stale-cookie — pass x-locale header from middleware to root layout

Root layout was reading REQUEST cookies which could be stale when middleware
updated the locale cookie in the RESPONSE (e.g. user with old 'fr' cookie
visiting /pt/ pages). Now reads x-locale header set by middleware from URL path.
Also fixes x-default hreflang to point to / instead of /fr/."
```

---

## Task 2: Retirer unsafe-eval du CSP statique

**Root cause:** `next.config.ts` définit un header CSP statique (build-time) avec `'unsafe-eval'`. Le middleware écrase ce header avec un CSP nonce-based (sans unsafe-eval) pour toutes les pages. Mais le header statique reste dans la config et pourrait s'appliquer aux routes non couvertes par middleware ou aux futures évolutions.

**Files:**
- Modify: `next.config.ts` — retirer `'unsafe-eval'` du script-src

- [ ] **Step 1: Modifier next.config.ts**

Trouver la ligne ~139 :
```typescript
"script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://*.vercel-scripts.com https://*.vercel-insights.com https://*.sentry.io",
```

Remplacer par :
```typescript
"script-src 'self' 'unsafe-inline' https://js.stripe.com https://*.vercel-scripts.com https://*.vercel-insights.com https://*.sentry.io",
```

Note : `'unsafe-inline'` reste (nécessaire pour les inline scripts Next.js dans les static assets). `'unsafe-eval'` est inutile en production et augmente la surface XSS.

- [ ] **Step 2: Commit Task 2**

```bash
git add next.config.ts
git commit -m "security: remove unsafe-eval from static CSP fallback in next.config.ts

Middleware already serves a nonce-based CSP (strict-dynamic, no unsafe-eval)
for all page routes. The static CSP in next.config.ts is a build-time fallback
that should not include unsafe-eval as it widens the XSS attack surface."
```

---

## Task 3: Mettre à jour bugs.md

**Files:**
- Modify: `product/bugs.md`

- [ ] **Step 1: Marquer le bug téléphone comme résolu**

Le numéro `+33634468897` est déjà dans `lib/constants.ts` (bug déjà corrigé, jamais marqué).

Déplacer le bloc `### 🟠 Número de telefone placeholder no schema FR` dans la section `## Bugs resolvidos ✅` avec date de résolution.

- [ ] **Step 2: Marquer le bug navigation FR/PT comme résolu**

Après le commit de Task 1, déplacer `### 🟡 Menu de navegação com mistura PT/FR` dans les résolus avec la description de la correction (x-locale header).

- [ ] **Step 3: Mettre à jour le bug trailing slash**

Changer le statut de `### 🟡 URL da homepage PT inconsistente` — avec `trailingSlash: true` dans next.config.ts et le fix x-locale, ce problème est mitigé. Laisser ouvert mais mettre à jour la description pour préciser que le canonical est correct dans chaque layout PT.

- [ ] **Step 4: Commit Task 3**

```bash
git add product/bugs.md
git commit -m "docs: update bugs.md — mark phone and navigation bugs as resolved"
```

---

## Task 4: Déploiement

- [ ] **Step 1: Vérifier le build**

```bash
npm run build
```

Expected: no TypeScript errors, no build failures.

- [ ] **Step 2: Push vers main (Vercel auto-deploy)**

```bash
git push origin main
```

Expected: Vercel pipeline vert, déploiement automatique sur https://vitfix.io

---

## Self-Review

**Spec coverage:**
- Bug navigation FR/PT → Task 1 ✅
- unsafe-eval CSP → Task 2 ✅
- bugs.md sync → Task 3 ✅
- Faux positifs écartés (pas de changement) ✅
- Dashboards monolithiques → explicitement exclu par l'utilisateur ✅

**Ce qui N'est PAS dans ce plan (confirmé correct) :**
- DB schema : 34 migrations existent déjà
- Cron auth : Authorization Bearer déjà en place
- Stripe index : PRIMARY KEY = index B-tree
- Rate limiter : bounds déjà en place
- Phone bug : déjà fix dans constants.ts
