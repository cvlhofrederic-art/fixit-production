# Guide d'onboarding developpeur - Vitfix

Ce guide couvre tout ce qu'il faut pour etre productif sur le projet Vitfix, de l'installation locale jusqu'a la premiere PR.

---

## 1. Prerequis

Installer ces outils avant de commencer :

| Outil | Version minimum | Verification |
|-------|-----------------|--------------|
| Node.js | 20+ | `node -v` |
| npm | 10+ (inclus avec Node 20) | `npm -v` |
| Git | 2.x | `git --version` |
| Supabase CLI | Derniere version | `supabase --version` |
| Vercel CLI | Derniere version | `vercel --version` |

Installation des CLIs si absents :

```bash
npm install -g supabase vercel
```

Optionnel mais recommande : Playwright pour les tests E2E.

```bash
npx playwright install
```

---

## 2. Installation

```bash
# Cloner le repo
git clone git@github.com:<org>/fixit-production.git
cd fixit-production

# Installer les dependances (lockfile strict)
npm ci

# Copier le fichier d'environnement
cp .env.example .env.local
```

Utiliser `npm ci` (pas `npm install`) pour garantir que tout le monde travaille avec les memes versions exactes des dependances.

---

## 3. Configuration environnement

Ouvrir `.env.local` et remplir les valeurs. Pour le developpement local, seules ces variables sont strictement requises :

**Variables obligatoires :**

| Variable | Ou la trouver |
|----------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard Supabase > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dashboard Supabase > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard Supabase > Settings > API |
| `NEXT_PUBLIC_APP_URL` | Mettre `http://localhost:3000` |
| `GROQ_API_KEY` | Console Groq > API Keys |
| `ADMIN_EMAIL` | Ton email ou un email de test |
| `CRON_SECRET` | Chaine aleatoire (ex: `openssl rand -hex 16`) |
| `RESEND_API_KEY` | Dashboard Resend > API Keys |

**Variables optionnelles (fonctionnalites desactivees si absentes) :**

- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` : paiements
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` : agent email syndic
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` : rate limiting distribue
- `TAVILY_API_KEY` : recherche materiaux IA
- `NEXT_PUBLIC_SENTRY_DSN` : monitoring erreurs

Demander les cles de dev partagees au lead du projet si tu n'as pas tes propres comptes Supabase/Groq.

---

## 4. Lancer le projet

```bash
npm run dev
```

L'app demarre sur http://localhost:3000 avec Turbopack (hot reload rapide). La premiere compilation prend 10-15 secondes, les suivantes sont quasi-instantanees.

Verifier que ca fonctionne :
1. Ouvrir http://localhost:3000/fr pour le marche France
2. Ouvrir http://localhost:3000/pt pour le marche Portugal
3. Ouvrir http://localhost:3000/pro/login pour le dashboard artisan

Pour un build de production local :

```bash
npm run build && npm run start
```

---

## 5. Base de donnees locale

Le projet utilise Supabase (PostgreSQL + Auth + Storage). Deux options :

### Option A : Supabase local (recommande)

```bash
# Demarrer les services Supabase en local (Docker requis)
supabase start

# Appliquer toutes les migrations
supabase db reset
```

Apres `supabase start`, la CLI affiche les URLs et cles locales. Copier `API URL` dans `NEXT_PUBLIC_SUPABASE_URL` et `anon key` dans `NEXT_PUBLIC_SUPABASE_ANON_KEY` de ton `.env.local`.

Les migrations SQL se trouvent dans `supabase/migrations/`. Elles contiennent les tables, les politiques RLS, les foreign keys et les Storage policies.

### Option B : Supabase cloud (projet de dev partage)

Utiliser les cles du projet Supabase de dev partage (demander au lead). Moins isole mais plus rapide a mettre en place.

### Creer une migration

```bash
supabase migration new nom_descriptif
# Editer le fichier SQL genere dans supabase/migrations/
supabase db reset  # Appliquer
```

---

## 6. Tests

### Tests unitaires (Vitest)

```bash
npm run test             # Une seule passe
npm run test:watch       # Mode watch (relance a chaque modif)
npm run test:coverage    # Avec rapport de couverture
```

Les tests unitaires sont dans `tests/`. Ils couvrent : rate-limit, sanitize, stripe, circuit-breaker, groq, validation, logger, et les routes API (auth, stripe, health).

### Tests E2E (Playwright)

```bash
npm run test:e2e         # Chromium uniquement en local
npm run test:e2e:ui      # Avec interface visuelle (utile pour debug)
```

Les tests E2E sont dans `e2e/`. Ils couvrent : page d'accueil, securite, SEO, accessibilite, auth, artisan, et API.

En CI, Playwright tourne sur 3 navigateurs (Chromium, Firefox, WebKit). En local, Chromium seul avec 1 worker.

### Parcours critiques a ne jamais casser

1. Creation devis par artisan via Fixy AI (voix ou texte)
2. Inscription artisan, verification, acces dashboard
3. Inscription client, recherche artisan, mise en relation
4. Commande vocale, analyse, action confirmee
5. Paiement Stripe et echeancier

Toujours lancer `npm run test` avant de pousser du code. Le pre-deploiement complet :

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

---

## 7. Structure du projet

```
fixit-production/
├── app/                    Pages Next.js (App Router)
│   ├── fr/                 Marche France (380+ pages SEO)
│   ├── pt/                 Marche Portugal (350+ pages SEO)
│   ├── en/                 Marche anglophone (expats Porto)
│   ├── pro/                Dashboard et auth artisan
│   ├── syndic/             Dashboard et auth syndic
│   ├── client/             Dashboard client
│   ├── admin/              Back-office admin
│   └── api/                Routes API (bookings, IA, syndic, uploads...)
├── components/
│   ├── dashboard/          Sections dashboard artisan
│   ├── syndic-dashboard/   Sections dashboard syndic
│   ├── client-dashboard/   Sections dashboard client
│   ├── chat/               Composants chat IA (Fixy, etc.)
│   ├── pro-mobile/         Dashboard mobile artisan (Capacitor)
│   └── common/             Composants partages
├── lib/
│   ├── supabase.ts         Client browser (respecte RLS)
│   ├── supabase-server.ts  Client serveur (bypass RLS, server-side UNIQUEMENT)
│   ├── validation.ts       Schemas Zod centralises
│   ├── types.ts            Types partages (Artisan, Booking, Service...)
│   ├── constants.ts        Telephones, emails, URLs, models IA
│   ├── logger.ts           Logger structure JSON + Sentry
│   ├── pdf/                Generateurs PDF (devis, factures)
│   └── i18n/               Systeme i18n (FR/PT/EN)
├── supabase/
│   └── migrations/         Migrations SQL
├── tests/                  Tests unitaires (Vitest)
├── e2e/                    Tests E2E (Playwright)
├── security/               Configs et outputs des scans secu
├── product/                Roadmap, bugs, decisions
└── public/
    └── fonts/              Liberation Sans (pour PDF)
```

### Fichiers de donnees SEO

| Fichier | Contenu |
|---------|---------|
| `lib/fr-seo-pages-data.ts` | 20 services x 19 villes PACA |
| `lib/seo-pages-data.ts` | Services x villes Portugal |
| `lib/data/investor-pages-data.ts` | Pages investisseurs (EN/ES/NL/FR) |

---

## 8. Workflows CI/CD

Chaque PR declenche ces checks bloquants dans GitHub Actions :

| Workflow | Ce qu'il fait |
|----------|---------------|
| `tests.yml` | Vitest unitaires + Playwright E2E (3 navigateurs) + Axe-core WCAG |
| `ci.yml` | Build production Next.js |
| `code-quality.yml` | ESLint + `tsc --noEmit` + SonarCloud |
| `lighthouse.yml` | Audit perf/a11y/SEO (seuils : perf 80, a11y 90, SEO 90, BP 85) |
| `security.yml` | CodeQL + TruffleHog + Semgrep (OWASP+JWT) + Giskard (prompts IA) |
| `ai-eval.yml` | DeepEval regression prompts (uniquement si fichiers IA modifies) |

Workflows non-bloquants :

| Workflow | Ce qu'il fait |
|----------|---------------|
| `i18n.yml` | Compare les cles FR/PT (warning si desynchronisees) |
| `langfuse-eval.yml` | Eval nocturne qualite IA (cree une issue si qualite < 0.7) |
| `release.yml` | Release Please (changelog auto) |

Tous les checks verts sont requis pour merger. Si un check echoue, corriger avant de demander une review.

---

## 9. Conventions

### Prefixes de commit

Le projet utilise Release Please pour generer les changelogs automatiquement. Chaque commit sur `main` doit utiliser un prefixe :

| Prefixe | Usage |
|---------|-------|
| `feat:` | Nouvelle fonctionnalite |
| `fix:` | Correction de bug |
| `ai:` | Modification d'un agent IA ou d'un prompt |
| `voice:` | Modification liee a la reconnaissance vocale |
| `perf:` | Amelioration de performance |

Exemples :
- `feat: ajout page tarifs syndic`
- `fix: correction calcul TVA devis PDF`
- `ai: mise a jour prompt Fixy pour devis multi-lots`

### Nommage de branches

Format : `<prefixe>/<description-courte>`

Exemples :
- `feat/syndic-tarifs-page`
- `fix/devis-tva-calculation`
- `ai/fixy-multi-lot-prompt`

### Code

- Pas de `any` dans le TypeScript. Utiliser les types de `lib/types.ts`.
- `Record<string, unknown>` pour les objets dynamiques.
- Toujours valider les inputs API avec Zod (`lib/validation.ts`).
- `supabaseAdmin` (server) ne doit JAMAIS etre importe dans un composant client.
- Gestion d'erreurs : `toast` (Sonner) cote client, `logger` cote serveur, jamais de `catch {}` vide.

---

## 10. Premiere tache

Voici le parcours recommande pour ta premiere contribution :

1. **Choisir un bug** dans `product/bugs.md`. Prendre un bug marque comme non-resolu et de priorite basse ou moyenne.

2. **Creer une branche** depuis `main` :
   ```bash
   git checkout main && git pull
   git checkout -b fix/description-du-bug
   ```

3. **Corriger le bug.** Consulter les fichiers de contexte pertinents (`CLAUDE.md`, `product/decisions.md`).

4. **Tester localement** :
   ```bash
   npm run lint
   npx tsc --noEmit
   npm run test
   ```

5. **Commiter** avec le bon prefixe :
   ```bash
   git commit -m "fix: description claire du fix"
   ```

6. **Pousser et creer une PR** :
   ```bash
   git push -u origin fix/description-du-bug
   gh pr create --title "fix: description du fix" --body "Fixes #numero-issue"
   ```

7. **Attendre les checks CI.** Tous doivent passer avant review.

---

## 11. Gotchas courants

### localStorage en navigation privee

`localStorage` n'est pas disponible dans certains navigateurs en mode prive. Le code utilise `console.warn` pour ces erreurs (c'est attendu). Ne pas les traiter comme des bugs critiques. Toujours wrapper les acces localStorage dans un try/catch.

### Font Liberation Sans pour les PDF

Les generateurs PDF (`lib/pdf/`) embarquent la font Liberation Sans depuis `public/fonts/`. Cette font est necessaire pour les caracteres Unicode (symbole euro, degres, metres carres). Si un PDF affiche des caracteres manquants, verifier que les fichiers TTF sont presents dans `public/fonts/`.

### Supabase RLS (Row Level Security)

Trois clients Supabase existent dans le projet, chacun avec un niveau d'acces different :

| Import | Respecte RLS | Contexte |
|--------|-------------|----------|
| `lib/supabase.ts` | Oui | Browser (composants client) |
| `lib/supabase-server-component.ts` | Oui | Server Components |
| `lib/supabase-server.ts` (`supabaseAdmin`) | Non (bypass) | Routes API server-side uniquement |

Utiliser `supabaseAdmin` dans un composant client est une faille de securite. Le linter devrait le signaler, mais rester vigilant.

### Sentry client desactive

Le client Sentry est volontairement desactive dans `sentry.client.config.ts`. Le Session Replay causait des blocs roses dans le dashboard syndic. Ne pas le reactiver.

### Realtime syndic

La table `syndic_notifications` genere des `CHANNEL_ERROR` en boucle sur Supabase Realtime. Le dashboard syndic coupe le channel apres 3 echecs consecutifs. C'est un comportement connu, pas un bug a corriger.

### Imports Capacitor

Les imports Capacitor doivent toujours etre dynamiques (`await import(...)`) pour eviter un crash SSR. Le code natif n'existe pas cote serveur.

### URLs SEO sacrees

Les routes `/fr/` et `/pt/` ont un historique SEO. Ne jamais modifier leur structure (ajout/suppression/renommage de segments d'URL) sans validation explicite.

---

## 12. Ressources

### Documentation interne

| Document | Chemin |
|----------|--------|
| Reference API | `docs/api-reference.md` |
| Runbook incidents | `docs/incident-runbook.md` |
| Architecture | `docs/architecture/` |
| Configuration environnements | `docs/ENVIRONMENTS.md` |
| Setup services externes | `docs/setup-external-services.md` |
| Setup GitHub Actions | `docs/github-actions-setup.md` |

### Contexte produit

| Document | Chemin |
|----------|--------|
| Roadmap | `product/roadmap.md` |
| Bugs connus | `product/bugs.md` |
| Decisions techniques | `product/decisions.md` |
| Analyse concurrence | `business/competitors.md` |

### Instructions IA et marketing

| Document | Chemin |
|----------|--------|
| Instructions session dev | `CLAUDE.md` |
| Strategie SEO Portugal | `seo-portugal/CLAUDE.md` |
| Contexte marketing | `marketing/CLAUDE.md` |

### Stack technique (liens externes)

- [Next.js 16 (App Router)](https://nextjs.org/docs)
- [Supabase](https://supabase.com/docs)
- [Tailwind CSS 4](https://tailwindcss.com/docs)
- [Vitest](https://vitest.dev/)
- [Playwright](https://playwright.dev/docs/intro)
- [Capacitor](https://capacitorjs.com/docs)
- [Stripe](https://docs.stripe.com/)
- [Groq](https://console.groq.com/docs)
