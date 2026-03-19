# VITFIX

Plateforme de mise en relation entre artisans/professionnels et clients — B2C + B2B.

**Production :** https://vitfix.io
**Marchés :** France (Marseille/PACA) · Portugal (Porto/Tâmega e Sousa) · Anglophone (Porto expats)

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS 4, Radix UI, Lucide |
| Base de données | Supabase (PostgreSQL + Auth + Storage) |
| IA | Groq (Llama 3), Tavily Search, OpenRouter |
| Paiements | Stripe (abonnements artisans + syndics) |
| Email | Resend |
| Rate limiting | Upstash Redis |
| Mobile natif | Capacitor 8 (iOS + Android) |
| Tests | Vitest (unitaires), Playwright (E2E) |
| Déploiement | Vercel |
| Monitoring | Sentry (server-side uniquement) |

---

## Démarrage rapide

### Prérequis

- Node.js 20+
- Compte Supabase (avec les tables migrées)
- Fichier `.env.local` configuré (voir section Variables d'environnement)

### Installation

```bash
npm install
cp .env.example .env.local
# Remplir .env.local avec vos clés
npm run dev
```

L'application sera disponible sur [http://localhost:3000](http://localhost:3000).

---

## Scripts disponibles

```bash
# Développement
npm run dev              # Serveur dev avec Turbopack (hot reload)
npm run build            # Build de production
npm run start            # Démarrer le build de production
npm run lint             # Linter ESLint

# Tests
npm run test             # Tests unitaires (Vitest, une seule passe)
npm run test:watch       # Tests unitaires en mode watch
npm run test:coverage    # Tests unitaires avec rapport de couverture
npm run test:e2e         # Tests E2E (Playwright)
npm run test:e2e:ui      # Tests E2E avec interface visuelle

# Mobile (Capacitor)
npm run mobile:build     # Build iOS + Android
npm run mobile:ios       # Build iOS uniquement
npm run mobile:android   # Build Android uniquement
npm run mobile:sync      # Synchroniser les assets web vers les projets natifs
npm run mobile:open:ios  # Ouvrir Xcode
npm run mobile:open:android  # Ouvrir Android Studio
```

---

## Variables d'environnement

Copier `.env.example` vers `.env.local` et remplir les valeurs.

| Variable | Requise | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Clé publique Supabase (safe pour le browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Clé service Supabase — **jamais exposée côté client** |
| `NEXT_PUBLIC_APP_URL` | ✅ | URL publique de l'app (redirections OAuth, emails) |
| `GROQ_API_KEY` | ✅ | Clé Groq pour les agents IA (Fixy, Léa, Max) |
| `ADMIN_EMAIL` | ✅ | Email du compte super_admin |
| `CRON_SECRET` | ✅ | Secret pour authentifier les cron jobs |
| `RESEND_API_KEY` | ✅ | Clé Resend pour l'envoi d'emails |
| `GOOGLE_CLIENT_ID` | ⚡ | OAuth Google (agent email syndic) |
| `GOOGLE_CLIENT_SECRET` | ⚡ | OAuth Google (agent email syndic) |
| `STRIPE_SECRET_KEY` | ⚡ | Paiements Stripe (abonnements) |
| `STRIPE_WEBHOOK_SECRET` | ⚡ | Vérification signatures webhooks Stripe |
| `UPSTASH_REDIS_REST_URL` | ⚡ | Rate limiting distribué |
| `UPSTASH_REDIS_REST_TOKEN` | ⚡ | Rate limiting distribué |
| `TAVILY_API_KEY` | ⚡ | Recherche produits (agent matériaux) |
| `ENCRYPTION_KEY` | ⚡ | Chiffrement AES des tokens OAuth (32+ chars) |
| `NEXT_PUBLIC_SENTRY_DSN` | ⚡ | Monitoring erreurs Sentry |

✅ = Requise pour fonctionner · ⚡ = Optionnelle (fonctionnalité désactivée si absente)

---

## Architecture

### Structure des routes

```
app/
├── fr/                     ← Marché France (Marseille/PACA)
│   ├── services/[slug]/    ← Pages SEO service × ville (380+ pages)
│   ├── urgence/[slug]/     ← Pages urgence × ville
│   ├── ville/[slug]/       ← Pages par ville
│   ├── blog/[slug]/        ← Articles blog FR
│   ├── specialites/        ← Niches PACA (débroussaillage, palmier…)
│   ├── copropriete/        ← Pages B2B copropriété
│   ├── pres-de-chez-moi/   ← Pages "near me"
│   ├── simulateur-devis/   ← Simulateur de devis interactif
│   ├── recherche/          ← Recherche artisan
│   ├── tarifs/             ← Tarifs particuliers
│   ├── artisan/[id]/       ← Page profil artisan
│   ├── a-propos/           ← À propos
│   ├── cgu/                ← Conditions générales
│   ├── mentions-legales/   ← Mentions légales
│   ├── marches/            ← Bourse aux marchés
│   └── reserver/           ← Réservation
├── pt/                     ← Marché Portugal
│   ├── servicos/[slug]/    ← Pages SEO service × ville
│   ├── urgencia/[slug]/    ← Pages urgence × ville
│   ├── cidade/[slug]/      ← Pages par ville
│   ├── blog/[slug]/        ← Articles blog PT
│   ├── perto-de-mim/       ← Pages "near me" PT
│   ├── precos/             ← Guias de preços
│   ├── pesquisar/          ← Recherche (alias FR)
│   ├── avaliacoes/         ← Avaliações
│   ├── sobre/              ← Sobre nós
│   ├── como-funciona/      ← Como funciona
│   ├── mercados/           ← Bolsa de trabalho
│   ├── simulador-orcamento/← Simulador de orçamento
│   └── …                   ← 350+ pages SEO
├── en/                     ← Marché anglophone (expats Porto)
├── es/                     ← Marché espagnol (investisseurs)
├── nl/                     ← Marché néerlandais
├── pro/
│   ├── dashboard/          ← Dashboard artisan (~2300 lignes)
│   ├── mobile/             ← App mobile artisan (Capacitor)
│   ├── register/           ← Inscription artisan
│   └── login/              ← Connexion artisan
├── syndic/
│   ├── dashboard/          ← Dashboard syndic (~5900 lignes)
│   ├── register/           ← Inscription syndic
│   └── login/              ← Connexion syndic
├── client/dashboard/       ← Dashboard client
├── coproprietaire/         ← Espace copropriétaire
├── admin/                  ← Back-office admin
├── contact/                ← Contact (bilingue FR/PT)
├── confidentialite/        ← Politique de confidentialité (bilingue)
├── cookies/                ← Politique cookies (bilingue)
├── confirmation/           ← Confirmation réservation
└── api/                    ← Routes API (voir ci-dessous)
```

### Routes API principales

```
app/api/
├── bookings/               ← CRUD réservations
├── booking-messages/       ← Messagerie réservation (client ↔ artisan)
├── artisan-clients/        ← Liste clients d'un artisan
├── artisan-settings/       ← Paramètres profil artisan
├── artisan-photos/         ← Upload photos chantier
├── availability/           ← Disponibilités artisan
├── artisan-absences/       ← Absences artisan
├── upload/                 ← Upload fichiers (Supabase Storage)
├── wallet-sync/            ← Sync documents RC Pro → fiches syndic
├── simulateur-artisans/    ← API simulateur devis
├── fixy-ai/                ← Agent IA Fixy (client)
├── comptable-ai/           ← Agent IA Léa (comptabilité artisan)
├── copro-ai/               ← Agent IA copropriété
├── materiaux-ai/           ← Agent IA matériaux
├── syndic/                 ← APIs espace syndic
│   ├── missions/
│   ├── artisans/
│   ├── signalements/
│   ├── immeubles/
│   └── …
└── email-agent/            ← Agent email Gmail syndic
```

### Fichiers de données SEO

| Fichier | Contenu |
|---------|---------|
| `lib/fr-seo-pages-data.ts` | 20 services × 19 villes PACA (380 pages FR) |
| `lib/seo-pages-data.ts` | Services × villes Portugal |
| `lib/data/investor-pages-data.ts` | Pages investisseurs (EN/ES/NL/FR) |
| `lib/constants.ts` | Téléphones, emails, URLs, AI models, timeouts centralisés |
| `components/syndic-dashboard/config.ts` | RBAC roles, modules syndic, couleurs planning |

---

## Clients Supabase

| Import | Usage |
|--------|-------|
| `lib/supabase.ts` | Client browser (respecte RLS) |
| `lib/supabase-server.ts` → `supabaseAdmin` | Client serveur (bypass RLS — **server-side uniquement**) |
| `lib/supabase-server-component.ts` | Client pour Server Components Next.js |

---

## Règles importantes

### SEO — ne jamais enfreindre

- Toutes les pages PT vivent sous `/pt/`, toutes les pages FR sous `/fr/` — seules les pages partagées (contact, auth, pro, syndic) restent au root
- Les URLs `/pt/` et `/fr/` sont **sacrées** — jamais modifier leur structure (impact SEO critique)
- Toujours inclure `BreadcrumbList` + `FAQPage` en JSON-LD sur les pages service
- Canonical URLs pointent vers `vitfix.io` (jamais `vercel.app`)
- Portugais européen uniquement : `canalizador` (pas `encanador`), `telemóvel` (pas `celular`)

### Sécurité

- `supabaseAdmin` est réservé aux routes API server-side — jamais importé dans des composants client
- Toujours vérifier l'ownership avant toute lecture/écriture (anti-IDOR)
- Rate limiting sur toutes les routes sensibles via `checkRateLimit()` de `lib/rate-limit.ts`
- `metadata` utilisateur non validé côté client — toujours valider en DB via `lib/validation.ts`

### Mobile (Capacitor)

- Imports Capacitor toujours dynamiques : `await import('@capacitor/local-notifications')` — obligatoire pour éviter crash SSR
- Guard mobile : `window.innerWidth <= 900 || 'ontouchstart' in window || Capacitor.isNativePlatform()`
- Voir `capacitor.config.ts` pour la configuration (appId: `com.fixit.artisan`)

### Bugs connus (ne pas réintroduire)

- **Blocs roses syndic dashboard** : causé par Sentry Session Replay. Sentry client est désactivé dans `sentry.client.config.ts` — ne pas le réactiver.
- **Crash Realtime syndic** : la table `syndic_notifications` génère des CHANNEL_ERROR en boucle. Le dashboard syndic coupe le channel après 3 échecs consécutifs.

---

## Tests

```bash
# Lancer tous les tests unitaires
npm run test

# Avec couverture
npm run test:coverage

# E2E (nécessite un serveur démarré ou utilise le serveur de dev)
npm run test:e2e
```

Les tests se trouvent dans :
- `tests/` — tests unitaires et API (Vitest)
- `e2e/` — tests end-to-end (Playwright)

---

## Déploiement

Le projet se déploie automatiquement sur Vercel à chaque push sur `main`.

```bash
# Déploiement manuel en production
vercel --prod --yes
```

**Variables d'environnement** : à configurer dans le dashboard Vercel (Settings > Environment Variables).

---

## Ressources internes

| Fichier | Contenu |
|---------|---------|
| `CLAUDE.md` | Instructions pour les sessions de développement IA |
| `product/roadmap.md` | Roadmap produit et priorités |
| `product/bugs.md` | Bugs connus et leur statut |
| `product/decisions.md` | Décisions techniques documentées |
| `seo-portugal/CLAUDE.md` | Stratégie SEO Portugal complète |
| `marketing/CLAUDE.md` | Contexte marketing (ads, social media) |
| `business/competitors.md` | Analyse concurrentielle |
| `business/growth-ideas.md` | Pistes de croissance |
