# CLAUDE.md — Vitfix.io

## Projet
Plateforme mise en relation artisans/clients (B2C + B2B). Production : https://vitfix.io
Stack : Next.js 16.2.4 · React 19.2.3 · TS 5 · Tailwind 4 · Zod 4 · Supabase (SSR + Realtime)
Mobile : Capacitor 8.1 (`com.fixit.artisan`). Observabilité : Sentry 10 · Langfuse 3

## Règles dures
- **IMPORTANT** : aucune modification de design/UX sans permission explicite de Frédéric.
- **IMPORTANT** : secrets via `wrangler secret put` uniquement. Jamais de `.env` en clair.
- Jamais de `catch {}` vide : `toast` (Sonner) côté client, `logger` (`lib/logger.ts`) serveur.
- TDD obligatoire avant toute modification du code du Simulateur V2 — refléter chaque change par un test.

## Règles projet (.claude/rules/) — lire avant de coder
Lire le fichier concerné AVANT toute modification de son domaine. Non optionnel.
- **`artisan-vs-btp.md` — RÈGLE #1.** AVANT toute modif touchant devis, factures, `app/pro/`, `lib/pdf/`.
- `ai-agents.md` — AVANT toute modif d'un agent Groq ou de la voix.
- `testing.md` — AVANT d'écrire ou modifier un test.
- `github-actions.md` — AVANT de toucher un workflow CI.

## Commandes
- Dev : `npm run dev`
- Build local : `npm run build`
- Build prod (pipeline réel) : `npm run build:cloudflare`
- Lint : `npm run lint`
- Tests : `npm run test` · E2E : `npm run test:e2e` — détails et parcours critiques dans `.claude/rules/testing.md`
- Mobile : `npm run mobile:build` (bascule `output:'export'` + `cap sync`)
- Type check : tourne en CI (`code-quality.yml`) — pas de commande locale
- Deploy : `git push origin main` → GitHub Actions Cloudflare. Aucun deploy local.

## Architecture (structure — chiffres et tailles : voir claude-mem)
- `app/api/` → routes (auth, agents IA, stripe, kbis, simulateur…)
- `app/pro/` → dashboard partagé artisan + pro_societe (BTP) — séparation par `orgRole`
- `app/{fr,pt,en,es,nl}/` → locales SEO publiques
- `app/{client,artisan}/` → landings pubs
- `app/{coproprietaire,syndic}/` → DORMANTS — code conservé, ne pas y toucher
- `components/dashboard/` → composants `*Section.tsx`
- `lib/` → logger, validation, types, groq, circuit-breaker, rate-limit, pdf/
- `supabase/` → migrations + RLS policies

## Conventions code
- API : validation Zod (`lib/validation.ts`), rate limiting sur endpoints IA, aucun détail interne au client.
- Types dans `lib/types.ts`. Éviter `any` ; `Record<string, unknown>` pour objets dynamiques.
- PDF : 3 paths (download / aperçu / Factur-X), RC Pro obligatoire, police Liberation Sans (Unicode).
- Commits : préfixes `feat|fix|ai|voice|perf` + scope `(artisan|btp|shared)`. Release Please.

## SEO (règles techniques — FR et PT)
- Schema FR : `HomeAndConstructionBusiness` + `AggregateRating` + `BreadcrumbList` + `FAQPage`.
- Schema PT (phase 1 du plan SEO PT, 13/10/2026) : une seule entité `#business` (`app/layout.tsx`, adresse réelle dans `lib/seo/entite-pt.ts`) ; page métier x ville = `Service` (provider `#business`, `areaServed` = la ville) + `BreadcrumbList` (`lib/seo/pt-schemas.ts`). Jamais de `LocalBusiness` par ville, de `FAQPage`, de `HowTo`, d'avis auto-attribués ni d'`Offer` sans prix réel visible.
- Title : la marque une seule fois. PT : titre de page sans marque, ajoutée par le template `%s | VITFIX` de `app/pt/layout.tsx`, 65 caractères max marque comprise (`lib/seo/pt-meta.ts`). FR : 50-60 caractères. Description 120-155 (PT) · 150-160 (FR) · un seul H1 · canonical vers vitfix.io.
- hreflang PT : seulement vers une page FR réellement équivalente et réciproque ; `x-default` sur `/fr/…`, jamais sur `/` (302). Aucun hreflang sur la grille métier x ville.
- Sitemaps PT : `/pt/sitemap-{servicos,hubs,cidades,blog,paginas}.xml` (`lib/sitemap-pt-pages.ts`), index `/pt/sitemap.xml` ; une URL dans un seul fichier, `lastmod` réel (`lib/seo/pt-datas.ts`).
- Grille PT (phase 2, 13/10/2026) : une seule URL par couple métier x ville, `/pt/servicos/{metier}-{ville}/` ; `/pt/urgencia/{metier}-urgente-{ville}/` et `/pt/perto-de-mim/{metier}-{ville}/` répondent 308 (`next.config.ts`, table `data/seo/pt-redirects.csv`) ; les 21 hubs `/pt/perto-de-mim/{metier}/` restent. Ne jamais recréer ces modèles.
- Plan de réindexation PT : `docs/seo/pt-inventaire.md`, journal `docs/seo/journal-pt.md`, tests `scripts/seo/pt-tests.mjs`. Gel A0 : aucune nouvelle page PT métier x ville avant la fin de la phase 3.
- Vérifier l'existant avant de créer une page — jamais de duplicata.
- Contexte marché PT (langue, villes, ton) : `seo-portugal/CLAUDE.md`.

## Préférences, scope actif, bugs connus
Non listés ici : portés par la mémoire persistante claude-mem (`MEMORY.md`, réinjectée au démarrage).
Couvre — scope actif (Client/Artisan/BTP Pro ; Syndic/Copro dormants), 100 % français,
cause racine sans workaround, Cloudflare-only, faits d'architecture chiffrés, bugs récurrents.
Un contributeur sans accès claude-mem doit demander ce contexte à Frédéric avant de coder.

## Contexte par domaine (lire à la demande)
- Produit : `product/{roadmap,bugs,decisions}.md`
- Marketing : `marketing/CLAUDE.md`, `marketing/ads/`
- Clients : `clients/onboarding/`, `clients/faq-responses/faq-completo.md`
- Business : `business/{competitors,growth-ideas}.md`
