# CLAUDE.md — Vitfix.io

## Projet
Plateforme de mise en relation artisans/clients (B2C + B2B) et logiciels métier : Syndic v54, Administrateur
judiciaire, portail copropriétaire. Production : https://vitfix.io, servie par un Worker Cloudflare (OpenNext).
Stack : Next.js 16.4 (App Router) · React 19.2 · TS 5 · Tailwind 4 · Zod 4 · Supabase (SSR + Realtime + Storage) ·
`@opennextjs/cloudflare` 1.20 · wrangler 4.149. IA : Claude Sonnet 5.5 (Syndic, Administrateur judiciaire,
Copropriétaire) et Groq (artisan / BTP) — voir `.claude/rules/ai-agents.md`.
Mobile : Capacitor 8.5 (`com.fixit.artisan`, périmètre de l'export à décider). Observabilité : Sentry 10 · Langfuse 3.

## Règles dures
- **IMPORTANT** : aucune modification de design/UX sans permission explicite de Frédéric.
- **IMPORTANT** : secrets via `wrangler secret put` uniquement. Jamais de `.env` en clair, jamais de valeur secrète
  dans le dépôt (gitleaks en CI et en pre-commit).
- Jamais de `catch {}` vide : `toast` (Sonner) côté client, `logger` (`lib/logger.ts`) serveur.
- TDD obligatoire avant toute modification du code du Simulateur V2 — refléter chaque changement par un test.
- Aucune donnée inventée sur les pages publiques (prix, délais, chantiers, avis, chiffres) : seulement ce que
  Frédéric a confirmé.
- Dépôt public : aucune donnée personnelle (identifiants, numéros, contacts) dans le code ni dans les docs.

## Règles projet (.claude/rules/) — lire avant de coder
Lire le fichier concerné AVANT toute modification de son domaine. Non optionnel.
- **`artisan-vs-btp.md` — RÈGLE #1.** AVANT toute modif touchant devis, factures, `app/(commun)/pro/`, `lib/pdf/`.
- `ai-agents.md` — AVANT toute modif d'un agent IA (Claude ou Groq), d'un prompt ou de la voix.
- `testing.md` — AVANT d'écrire ou modifier un test.
- `github-actions.md` — AVANT de toucher un workflow CI.
- Agent `.claude/agents/security-reviewer.md` : audit en lecture seule après une modification touchant l'auth, les
  RLS, Stripe, les prompts IA ou les PDF.

## Commandes
- Dev : `npm run dev` — sans `.env.local`, exporter `CI=1` (`lib/env.ts` tolère alors l'absence des variables serveur ;
  les variables publiques sont dans `wrangler.toml` `[vars]`).
- Build local : `npm run build` · Build prod (pipeline réel) : `npm run build:cloudflare` (OpenNext).
- Lint : `npm run lint` (`--max-warnings=1011` : 0 erreur, aucun nouvel avertissement).
- Type check : `npx tsc --noEmit` (`NODE_OPTIONS=--max-old-space-size=8192` sur une machine à 8 Go ; le contrôle de
  `next build` ne montre qu'une erreur à la fois).
- Tests : `npm run test` · E2E : `npm run test:e2e` — détails et parcours critiques dans `.claude/rules/testing.md`.
- SEO PT : `node scripts/seo/pt-tests.mjs --mode controle [--base http://localhost:3000]` (T1 à T12) ;
  `node scripts/seo/verifier-prerendu.mjs` après un build.
- Mobile : `npm run mobile:build` (bascule `output:'export'` + `cap sync`) — export complet en échec, décision ouverte.
- Deploy : fusion dans `main` → GitHub Actions → Cloudflare (`deploy-cloudflare.yml` : build OpenNext,
  `wrangler deploy`, smoke test, IndexNow). Aucun deploy local. `**.md`, `.github/**` et `.claude/**` ne déploient pas.

## Base de données (Supabase)
- Le schéma de production ne correspond pas aux migrations du dépôt : `profiles_artisan` n'a ni `org_role`, ni
  `country`, ni `is_verified`, ni `first_name`/`last_name` (colonnes réelles listées dans
  `tests/seo/sitemap-fiches-artisans.test.ts`). Toute requête qui nomme une colonne prévoit le repli sur l'erreur
  PostgREST 42703, ou lit `select('*')` puis filtre par liste blanche.
- Migrations rejouables (`if not exists`, `create or replace`), sans `drop trigger` ; contraintes `not valid` puis
  `validate` ; RLS sur toute table (une table sans politique est inaccessible aux clés anon/authenticated, parfois
  voulu). Un trigger garde 38 colonnes sensibles de `profiles_artisan` contre l'écriture directe par anon/authenticated.
- Les devis et factures des comptes pro vivent dans le `localStorage` (`fixit_*`) avec miroir serveur
  `user_storage` : ne jamais effacer ce stockage ; une déconnexion ne touche que les cookies `sb-*`.

## Fusion et déploiement
- Une PR se fusionne sur une CI verte **dont la tête contient `main`** (ou dont l'arbre de fusion est celui qui a été
  testé) : `tests.yml` ne tourne que sur `pull_request`, une CI verte vieillit dès que `main` avance.
- Relecture adverse **avant** d'ouvrir la PR, fichiers appelants compris : un défaut trouvé après fusion coûte une
  PR de correctifs et une mise en ligne de plus.
- Après fusion : suivre les trois jobs du déploiement, lire « Total Upload » (limite du Worker : 64 Mio non
  compressés, environ 50 Mio début novembre 2026), contrôler en production les pages touchées.
- Commits : préfixes `feat|fix|ai|voice|perf|docs` + scope `(artisan|btp|shared|judiciaire|syndic)`. Release Please.

## Architecture (structure — chiffres et tailles : mesurer, ne pas supposer)
- `app/api/` → routes (auth, agents IA, stripe, kbis, simulateur…)
- `app/{fr,pt,en,es,nl}/` → locales SEO publiques. Pas de `app/layout.tsx` : chaque dossier de langue a son layout racine
  statique (`<html lang>` fixé par le dossier, jamais de `cookies()`/`headers()`), la coquille HTML commune est
  `components/common/CoquilleRacine.tsx` (entité `#business` unique) et ses métadonnées `lib/seo/metadonnees-racine.ts` ;
  les pages SEO (servicos, precos, perto-de-mim, blog, cidade, services, ville, urgence…) sont pré-rendues au build
  et servies telles quelles par le Worker : cache incrémental OpenNext en assets statiques, en lecture seule
  (`open-next.config.ts`, copie de `.open-next/cache` dans `deploy-cloudflare.yml`). Donc pas de `revalidate` (une mise à
  jour = un déploiement) ; une page qui lit l'URL (`useSearchParams`) ou la date au rendu garde
  `export const dynamic = 'force-dynamic'`. Plusieurs layouts racine : passer d'une section à l'autre (ex. `/pt/…` vers
  `/pt/contacto/` ou `/fr/…`) recharge la page. Ne pas ajouter de `app/layout.tsx`, même sans `<html>` : la 404 globale
  resterait affichée après un clic, et Providers serait remonté à chaque changement de section.
  Gardes : `tests/seo/layouts-racine-statiques.test.tsx`, et `scripts/seo/verifier-prerendu.mjs` après le build (CI et
  déploiement : chaque page de section au prerender-manifest, sauf la liste nommée `RENDUES_A_LA_DEMANDE` ; planchers par
  section, pages témoins). `getServerTranslation()` lit `cookies()` : une page qui l'appelle est rendue à la demande.
- `app/(commun)/` → pages communes à toutes les langues, servies par réécriture `/fr/…` et `/pt/…` (next.config.ts) sous un
  layout racine dynamique (locale par l'en-tête `x-locale` du middleware). `app/global-not-found.tsx`
  (`experimental.globalNotFound`) rend la 404 de toute URL sans route ; jamais de route fourre-tout (une page qui lève
  `notFound()` ne rend côté serveur qu'une coquille `__next_error__` vide). Toute nouvelle page sans langue dans
  l'URL va dans ce groupe : hors section, `next build` échoue (« doesn't have a root layout ») et `next dev` crée un
  layout minimal à côté de la page, à supprimer. Sur OpenNext, une réécriture ou redirection `:path*` avec un
  paramètre vide n'est pas compilée : une règle exacte précède la règle `:path*` pour tout préfixe qui a une page racine.
- `app/(commun)/pro/` → dashboard partagé artisan + pro_societe (BTP) — séparation par `orgRole`
- `app/(commun)/{client,artisan}/` → landings pubs
- `app/(commun)/coproprietaire/dashboard` → portail copropriétaire (actif depuis le 17/10/2026) : huit écrans (le super admin y a en plus un lien vers AJ Signalement)
  `components/coproprietaire-dashboard/ecrans/`, données réelles du syndic via `GET /api/coproprietaire/espace`
  (`lib/coproprietaire/` : accès par fiche `syndic_coproprios`, filtrage de ce qu'un copropriétaire peut voir),
  démonstration `lib/coproprietaire/demo.ts`. Spécification : `components/coproprietaire-dashboard/SPECIFICATION-ECRANS.md`.
- `app/(commun)/administrateur-judiciaire` + `lib/administrateur-judiciaire/` + `components/administrateur-judiciaire/` →
  Administrateur judiciaire (en ligne depuis le 04/10/2026 sous `/fr/administrateur-judiciaire/`, session syndic ou
  super_admin requise) : application cliente fidèle à sa maquette (Dexie, 40 tables, CSS isolé sous `#aj-root`),
  agents IA sur Claude (`app/api/administrateur-judiciaire/{agent,outils}`), liaison de démonstration avec le portail
  copropriétaire (`lib/liaison-copro-aj/`, `localStorage`). Ne pas y mêler le Syndic v54.
- `components/syndic-dashboard/v54` → Syndic v54 (PT par défaut ; version FR adaptée au droit français sous
  `/fr/syndic/v54` via `lib/syndic/v54/i18n`). PT et FR sont deux réalités juridiques : ne jamais calquer un correctif
  ou un module de l'un sur l'autre.
- `app/(commun)/signalement/[jeton]` + `app/(commun)/aj-signalement/` + `lib/aj-signalement/` + `components/aj-signalement/` → « AJ Signalement » (04/11/2026) :
  signalements déposés par QR code sans compte (coordonnées obligatoires), tables `signalements_qr_*` sans lien avec `syndic_*`,
  e-mail à l’administrateur et accusé de réception au déclarant ; tableau de bord = espace indépendant `/fr/aj-signalement/`
  (depuis le 10/11/2026 ; super admin seul, accès décidé par `lib/aj-signalement/acces-espace.ts` et contrôlé dans le middleware).
  Entrées : sa page de connexion professionnelle `/fr/aj-signalement/connexion/` (sans session, l’espace y renvoie), la carte
  « AJ Signalement » du panneau admin (`/admin/dashboard`) ; le portail copropriétaire (pied de la barre latérale, menu « Plus »
  sur téléphone) et l’AJ (pied de la barre latérale) n’en gardent qu’un lien, réservé au super admin : ne pas y recréer
  d’écran de signalements.
- `app/(commun)/coproprietaire/portail` (portail léger sans compte) et `app/(commun)/syndic/` (hors v54) → code conservé, ne pas y toucher
- `components/dashboard/` → composants `*Section.tsx`
- `lib/` → logger, validation, types, claude, groq, circuit-breaker, rate-limit, pdf/, seo/, i18n/
- `supabase/` → migrations + RLS policies

## Conventions code
- API : validation Zod (`lib/validation.ts`), rate limiting sur endpoints IA, aucun détail interne au client.
- Types dans `lib/types.ts`. Éviter `any` ; `Record<string, unknown>` pour objets dynamiques.
- PDF : 3 paths (download / aperçu / Factur-X), RC Pro obligatoire, police Liberation Sans (Unicode).
- Qualité CI (SonarCloud, CodeQL) : duplication du nouveau code < 3 % (factoriser les composants partagés FR/PT au
  lieu de copier), `toHaveLength`, promesses marquées `void`, tris avec comparateur, regex sans retour arrière,
  métacaractères échappés avant `new RegExp`, pas de `Math.random` pour un identifiant, JSON-LD échappé
  (`serialiserJsonLd`), Markdown des réponses IA rendu par `components/common/MarkdownIA.tsx` (jamais de HTML injecté).
- Copies de travail Windows en CRLF : conserver les fins de ligne des fichiers modifiés.

## SEO (règles techniques — FR et PT)
- Schema FR : `HomeAndConstructionBusiness` + `AggregateRating` + `BreadcrumbList` + `FAQPage`.
- Schema PT (phase 1 du plan SEO PT, 13/10/2026) : une seule entité `#business` (`components/common/CoquilleRacine.tsx`, rendue par chaque layout racine ; adresse réelle dans `lib/seo/entite-pt.ts`) ; page métier x ville = `Service` (provider `#business`, `areaServed` = la ville) + `BreadcrumbList` (`lib/seo/pt-schemas.ts`). Jamais de `LocalBusiness` par ville, de `FAQPage`, de `HowTo`, d'avis auto-attribués ni d'`Offer` sans prix réel visible.
- Title : la marque une seule fois, ajoutée par le template `%s | VITFIX` des layouts `app/{pt,fr,en}/layout.tsx` ; titre de page sans marque, ou `titreAvecMarque()` (`lib/seo/titre-avec-marque.ts`) si la phrase la contient déjà — garde `tests/seo/titres-marque-unique.test.ts`. PT : 65 caractères max marque comprise (`lib/seo/pt-meta.ts`). FR : 50-60 caractères. Description 120-155 (PT) · 150-160 (FR) · un seul H1 · canonical vers vitfix.io.
- hreflang PT : seulement vers une page FR réellement équivalente et réciproque ; `x-default` sur `/fr/…`, jamais sur `/` (302). Aucun hreflang sur la grille métier x ville.
- Sitemaps PT : `/pt/sitemap-{servicos,hubs,cidades,blog,paginas}.xml` (`lib/sitemap-pt-pages.ts`), index `/pt/sitemap.xml` ; une URL dans un seul fichier, `lastmod` réel (`lib/seo/pt-datas.ts`, daté du jour de la mise en production). Fiches : une seule URL indexable par fiche FR (`/fr/artisan/<slug>/`, sitemap 4), canonical calculée par `getProfilePath` sur la fiche lue, slug inconnu → 404 noindex.
- Grille PT (phase 2, 13/10/2026) : une seule URL par couple métier x ville, `/pt/servicos/{metier}-{ville}/` ; `/pt/urgencia/{metier}-urgente-{ville}/` et `/pt/perto-de-mim/{metier}-{ville}/` répondent 301 (`middleware.ts` via `lib/seo/pt-consolidacao.ts`, table `data/seo/pt-redirects.csv`) ; les 21 hubs `/pt/perto-de-mim/{metier}/` restent. Ne jamais recréer ces modèles.
- Plan de réindexation PT : `docs/seo/pt-inventaire.md`, journal `docs/seo/journal-pt.md`, tests `scripts/seo/pt-tests.mjs`. Gel A0 : aucune nouvelle page PT métier x ville avant la fin de la phase 3, sauf les trois pages de district autorisées par Frédéric le 20/10/2026 (`/pt/servicos/limpeza-de-telhados/`, `/pt/servicos/renovacao-de-fachadas/` et `/pt/servicos/trabalhos-verticais/` : `lib/data/pt-servicos-distrito.ts`, une page par service pour toute la zone de l'équipe, champ `distritos` : distritos do Porto, Braga e Aveiro depuis le 28/10/2026, zone dite en clair sans liste de concelhos, jamais de série par concelho ; chaque page a sa date de contenu et sa date de liens `dataLigacoes`, une page qui lie plusieurs pages de district prend la plus récente ; une page concelho `/pt/servicos/{service}-{concelho}/` ne s'ouvre que sur chantiers réels documentés dans `data/seo/local-proof.json`, voir `concelhoDocumentado`). Exception demandée par Frédéric le 21/10/2026 : pages de service du concelho d'Águeda (`lib/data/pt-servicos-concelho.ts` : `/pt/servicos/limpeza-de-terrenos-agueda/`, `/pt/servicos/terraplanagem-agueda/`), zone desservie = tout le concelho ; une page par service, les freguesias en sections de la page, jamais une page par freguesia. Ce ne sont pas des pages concelho d'un service de district : c'est la page unique de chacun de ces services, dont la zone est le concelho. Frédéric a décidé le 22/10/2026 de les ouvrir sans chantier documenté ; les chantiers réels s'ajoutent ensuite dans `data/seo/local-proof.json` (clé = slug de la page) et s'affichent sans autre changement.
- Prix publiés : seulement ceux confirmés par Frédéric, avec la règle d'IVA (23 % ou 6 % Lista I) et le prix com IVA, obligation légale (DL 138/90, DL 57/2008) ; sinon « orçamento ».
- Liens d'en-tête et de pied : table `lib/i18n/liens-entete-pied.ts` (EN/NL/ES n'ont pas toutes les pages : accueil de la section ou page PT), garde `tests/seo/liens-entete-pied-langues.test.tsx`. Le cookie de langue n'est posé que sur les documents (`Sec-Fetch-Dest`), jamais sur les requêtes RSC ; un lien vers une autre langue est un simple `<a>`.
- Vérifier l'existant avant de créer une page — jamais de duplicata.
- Contexte marché PT (langue, villes, ton) : `seo-portugal/CLAUDE.md`.

## Préférences, scope actif, bugs connus
Portés par la mémoire persistante de Claude Code sur le poste de Frédéric (hors dépôt) : préférences de travail,
scope actif, décisions produit, bugs récurrents. `product/{roadmap,bugs,decisions}.md` en donne la part publique.
Un contributeur sans cet accès demande ce contexte à Frédéric avant de coder.

## Contexte par domaine (lire à la demande)
- Produit : `product/{roadmap,bugs,decisions}.md`
- Marketing : `marketing/CLAUDE.md`, `marketing/ads/`
- Clients : `clients/onboarding/`, `clients/faq-responses/faq-completo.md`
- Business : `business/{competitors,growth-ideas}.md`
