# Audit SEO - Vitfix.io

**Date :** 12 avril 2026
**Scope :** fixit-production (Next.js 16.2.2, Vercel, 5 locales)
**Mode :** Read-only, aucun edit

---

## Cartographie du perimetre audite

| Domaine | Fichiers cles | Pages publiques |
|---------|--------------|-----------------|
| **FR (Marseille/PACA)** | `app/fr/`, `lib/data/fr-seo-pages-data.ts` | ~181 pages (services, urgences, blog, specialites, simulateur, copro) |
| **PT (Tamega e Sousa)** | `app/pt/`, `lib/data/seo-pages-data.ts` | ~229 pages (servicos, urgencia, blog, precos, perto-de-mim) |
| **EN (Porto expats)** | `app/en/`, `lib/data/en-services-data.ts` | ~10 pages (services, emergency landing) |
| **NL (investisseurs)** | `app/nl/`, `lib/data/investor-pages-data.ts` | 5 pages |
| **ES (investisseurs)** | `app/es/`, `lib/data/investor-pages-data.ts` | 5 pages |
| **Profils artisans** | `app/fr/artisan/[id]/` (Supabase dynamique) | Jusqu'a 2000 (limite hardcodee) |
| **Infrastructure SEO** | `app/sitemap.ts`, `app/robots.ts`, `next.config.ts`, `proxy.ts` | - |
| **Structured data** | 52 pages avec JSON-LD, root layout global | - |

**Total estime :** ~2 430 URLs dans le sitemap

---

## Tableau des findings

| ID | Severite | Categorie | Source | Description | Fix suggere |
|----|----------|-----------|--------|-------------|-------------|
| SEO-01 | **P0** | Sitemap / Robots | `app/sitemap.ts:13`, `app/robots.ts:4`, `.env.local:7` | `NEXT_PUBLIC_APP_URL=https://fixit-production.vercel.app` dans .env.local. Si meme valeur dans les env vars Vercel production, le sitemap.xml et robots.txt referencent le mauvais domaine au lieu de vitfix.io. Les canonicals et hreflang dans le code sont hardcodes sur vitfix.io, creant une incoherence. | **A CLARIFIER :** Verifier la valeur de `NEXT_PUBLIC_APP_URL` dans les env vars Vercel production. Doit etre `https://vitfix.io`. |
| SEO-02 | **P1** | Hreflang | `app/en/layout.tsx:15-21` | Le layout EN ne declare que 3 alternates (pt, fr, en). Manquent nl, es et x-default. Les layouts FR (`app/fr/layout.tsx:11-18`) et PT (`app/pt/layout.tsx:12-18`) declarent correctement les 5 locales + x-default. | Ajouter `'nl': 'https://vitfix.io/nl/'`, `'es': 'https://vitfix.io/es/'` et `'x-default': 'https://vitfix.io/'` dans `alternates.languages` du layout EN. |
| SEO-03 | **P1** | Structured Data | `app/layout.tsx:349-355` | SearchAction URLs sans prefixe locale : PT cible `/pesquisar/` au lieu de `/pt/pesquisar/`, FR cible `/recherche/` au lieu de `/fr/recherche/`. Ces URLs sont redirigees (301) vers les bonnes, mais Google suit un hop supplementaire. | Corriger les URLs SearchAction : `https://vitfix.io/pt/pesquisar/?q={search_term_string}` et `https://vitfix.io/fr/recherche/?q={search_term_string}`. |
| SEO-04 | **P1** | Hreflang | `app/layout.tsx:330-335` | Les balises hreflang hardcodees dans `<head>` pointent uniquement vers les homepages (`/fr/`, `/pt/`, etc.). Aucune page interne n'a de hreflang page-specifique vers son equivalent dans les autres locales (ex : `/fr/services/plomberie-marseille/` n'a pas de lien vers `/pt/servicos/canalizador-porto/`). | Pour les pages qui ont un equivalent cross-locale, ajouter des `alternates.languages` page-specifiques dans chaque `generateMetadata()`. Prioriser les pages services FR<->PT. |
| SEO-05 | **P1** | Performance | `app/layout.tsx:18-61` | 7 familles Google Fonts chargees dans le root layout (DM Sans, Syne, Montserrat, Outfit, Playfair Display, IBM Plex Sans, IBM Plex Mono) avec 25 weights au total. Impact direct sur LCP : le navigateur doit telecharger toutes les polices avant le premier rendu. | Reduire a 2-3 familles pour les pages publiques. Charger les polices dashboard (Outfit, Playfair, IBM Plex) via `next/dynamic` uniquement dans les layouts dashboard (`/pro/`, `/syndic/`). |
| SEO-06 | **P1** | Sitemap | `app/sitemap.ts:17-20` | Toutes les dates `lastModified` du sitemap sont hardcodees (`2026-03-01`, `2026-03-18`, etc.) sauf les profils artisans (dynamique via `updated_at`). Google deprioritise les sitemaps avec des dates statiques car ils ne refletent pas les mises a jour reelles. | Utiliser des timestamps dynamiques : `new Date()` pour les pages statiques, ou un systeme de suivi des modifications de contenu. Au minimum, mettre a jour les dates a chaque deploiement. |
| SEO-07 | **P2** | Sitemap | `app/sitemap.ts` | Aucune annotation `<xhtml:link rel="alternate" hreflang="...">` dans le sitemap XML. Google recommande d'inclure les hreflang soit dans le HTML `<head>`, soit dans le sitemap, soit dans les headers HTTP. Le sitemap est le seul endroit ou on peut declarer les equivalences page par page a grande echelle. | Ajouter les annotations hreflang dans le sitemap pour chaque URL ayant un equivalent cross-locale. Next.js `MetadataRoute.Sitemap` ne supporte pas nativement les alternates ; envisager un sitemap custom. |
| SEO-08 | **P2** | Open Graph | `app/layout.tsx`, toutes les pages | Une seule image OG generique (`/og-image.png`, 1200x630) utilisee par toutes les pages et locales. Pas d'image specifique par service, ville ou locale. Reduit le taux de clic sur les partages sociaux. | Generer des images OG dynamiques via `next/og` (ImageResponse API) avec le nom du service, la ville et la locale. Prioriser les pages services et urgences. |
| SEO-09 | **P2** | Sitemap | `app/sitemap.ts` | Sitemap monolithique unique (472 KB, ~2 384 URLs). Pas de sitemap index. Fonctionnel sous le seuil de 50 000 URLs mais approche la limite recommandee de 50 MB non compresse. Si les profils artisans depassent 2 000, la taille augmentera significativement. | Implementer un sitemap index avec des sitemaps par locale et par type de contenu (`/sitemap-fr.xml`, `/sitemap-pt.xml`, `/sitemap-artisans.xml`). |
| SEO-10 | **P2** | Sitemap | `app/sitemap.ts:351` | Limite de 2 000 profils artisans hardcodee dans le sitemap (`.limit(2000)`). Si la base depasse ce nombre, les artisans au-dela ne seront pas indexes. | Implementer une pagination du sitemap artisans ou augmenter la limite. Monitorer le count `profiles_artisan` regulierement. |
| SEO-11 | **P2** | Performance | `public/manifest.json` | Manifeste PWA configure (`display: standalone`, icones 192/512) mais aucun service worker (`sw.js`) detecte. Pas de strategie offline ni de pre-cache des assets critiques. Google Lighthouse penalise l'absence de SW pour les PWA. | Si l'objectif est un score PWA Lighthouse, implementer un SW minimal avec `next-pwa` ou Workbox. Sinon, declarer clairement que le PWA manifest est pour le "Add to Home Screen" uniquement. |
| SEO-12 | **P2** | Meta | `app/nl/page.tsx`, `app/es/page.tsx` | Les pages NL et ES n'ont pas de Twitter Cards configurees. Les partages sur X/Twitter afficheront un lien brut sans apercu enrichi. | Ajouter `twitter: { card: 'summary_large_image', title: '...', description: '...' }` dans les metadata exports des pages NL et ES. |
| SEO-13 | **P2** | Structured Data | `app/layout.tsx:336-360` + pages enfants | Double injection JSON-LD : le root layout injecte `HomeAndConstructionBusiness` + `WebSite` globalement, et les pages enfants (services, villes, urgences) injectent aussi leur propre `HomeAndConstructionBusiness` ou `LocalBusiness`. Google peut voir des signaux conflictuels (adresses differentes, notes differentes). | Retirer le schema business du root layout et le garder uniquement dans les pages individuelles qui ont des donnees specifiques. Le root layout ne devrait garder que `WebSite` + `SearchAction`. |
| SEO-14 | **P2** | Performance | `app/globals.css`, `app/pro/dashboard/` | Pas de strategie d'extraction CSS critique. Le CSS complet (Tailwind + design tokens + dashboard styles) est charge sur toutes les pages, meme les pages publiques legeres. | Scoper les styles dashboard dans des CSS modules ou les charger via `next/dynamic`. Verifier que Tailwind v4 purge correctement les classes inutilisees. |
| SEO-15 | **P2** | Sitemap | `app/sitemap.ts` | Pas de sitemap images. Google Images represente une source de trafic significative pour les services de construction (photos avant/apres, realisations artisans). | Ajouter un sitemap images (`/sitemap-images.xml`) listant les photos de profils artisans et realisations stockees dans Supabase Storage. |
| SEO-16 | **P2** | Meta | `app/fr/layout.tsx:3-20` | Le layout FR n'a pas d'Open Graph configure au niveau layout (contrairement au layout PT qui a `openGraph` avec `locale: 'pt_PT'`). Les pages enfants FR ont leurs propres OG tags, mais les pages qui n'en definissent pas explicitement n'auront pas d'OG par defaut. | Ajouter un bloc `openGraph` dans le layout FR avec `locale: 'fr_FR'`, `siteName: 'VITFIX Marseille'`, et l'image par defaut. |
| SEO-17 | **P3** | Contenu | `lib/data/fr-blog-data.ts`, `lib/data/seo-pages-data.ts` | Contenu blog mince : 8 articles PT, 6 articles FR. Pour un site ciblant 2 marches geographiques avec 14+ services, le ratio contenu/pages programmatiques est faible. Impact sur l'autorite thematique et le trafic long-tail. | Planifier un calendrier editorial : 2-3 articles/mois par locale sur les requetes informationnelles a volume moyen (guides, comparatifs, prix). |
| SEO-18 | **P3** | Performance | `next.config.ts:10-12` | `optimizePackageImports` ne couvre que 4 packages (`sonner`, `recharts`, `jspdf`, `@supabase/supabase-js`). D'autres packages lourds presents dans le bundle (ex : `@sentry/nextjs`, `pdf-lib`) pourraient beneficier de tree-shaking explicite. | Auditer le bundle avec `ANALYZE=true next build` et ajouter les packages les plus lourds a `optimizePackageImports`. |
| SEO-19 | **P3** | Structured Data | 52 fichiers | Pas de librairie utilitaire centralisee pour les schemas JSON-LD. Chaque page genere son propre objet inline. Risque d'incoherence (notes differentes, adresses differentes entre pages) et maintenance couteuse. | Creer `lib/schemas/` avec des factories : `buildBusinessSchema()`, `buildBreadcrumbSchema()`, `buildFaqSchema()`. Centralise les donnees partagees (nom, telephone, note, adresse). |

---

## Top risques

1. **SEO-01 (P0)** : Si `NEXT_PUBLIC_APP_URL` vaut `fixit-production.vercel.app` en production Vercel, le sitemap et robots.txt envoient les crawlers vers le mauvais domaine. Le reste du site (hreflang, canonical) pointe vers vitfix.io, creant une incoherence qui peut fragmenter le crawl budget.

2. **SEO-04 + SEO-07 (P1+P2)** : Absence de hreflang page-specifique. Les pages equivalentes FR/PT ne se declarent pas mutuellement. Google peut considerer le contenu FR et PT comme des pages independantes au lieu de variantes linguistiques, diluant l'autorite de domaine entre les versions.

3. **SEO-05 (P1)** : 7 familles de polices (25 weights) chargees sur toutes les pages, y compris les pages publiques SEO. Impact direct sur LCP et Core Web Vitals, qui sont un facteur de ranking Google depuis 2021.

4. **SEO-06 (P1)** : Dates sitemap statiques. Google utilise `lastModified` pour prioriser le recrawl. Des dates figees a mars 2026 signalent a Google que le contenu ne change pas, reduisant la frequence de passage.

5. **SEO-13 (P2)** : Double schema `HomeAndConstructionBusiness` (root + pages enfants). Rich Snippets Test de Google peut interpreter des signaux contradictoires et ne pas afficher les rich results.

---

## Plan de remediation ordonne

### Phase 1 - Critique (cette semaine)

| Priorite | Finding | Action | Effort |
|----------|---------|--------|--------|
| P0 | SEO-01 | Verifier et corriger `NEXT_PUBLIC_APP_URL` dans Vercel production -> `https://vitfix.io` | 5 min |
| P1 | SEO-02 | Ajouter nl/es/x-default dans `app/en/layout.tsx` alternates | 5 min |
| P1 | SEO-03 | Corriger les URLs SearchAction dans `app/layout.tsx` (ajouter prefixes locales) | 10 min |
| P1 | SEO-06 | Remplacer les dates hardcodees du sitemap par `new Date()` | 15 min |

### Phase 2 - High Impact (semaine 2)

| Priorite | Finding | Action | Effort |
|----------|---------|--------|--------|
| P1 | SEO-05 | Scoper les polices dashboard : charger Outfit/Playfair/IBM Plex uniquement dans layouts pro/syndic | 2h |
| P1 | SEO-04 | Ajouter hreflang page-specifique pour les pages services FR<->PT (20 services principaux) | 3h |
| P2 | SEO-13 | Retirer le schema business du root layout, garder uniquement WebSite + SearchAction | 30 min |
| P2 | SEO-16 | Ajouter bloc OpenGraph dans layout FR | 10 min |

### Phase 3 - Medium Impact (semaines 3-4)

| Priorite | Finding | Action | Effort |
|----------|---------|--------|--------|
| P2 | SEO-07 | Ajouter annotations hreflang dans le sitemap XML | 4h |
| P2 | SEO-08 | Implementer images OG dynamiques via `next/og` pour les pages services | 4h |
| P2 | SEO-09 | Splitter en sitemap index par locale | 3h |
| P2 | SEO-12 | Ajouter Twitter Cards aux pages NL/ES | 15 min |
| P2 | SEO-15 | Creer un sitemap images pour les photos artisans | 2h |

### Phase 4 - Optimisation (mois 2)

| Priorite | Finding | Action | Effort |
|----------|---------|--------|--------|
| P2 | SEO-10 | Paginer le sitemap artisans ou lever la limite 2000 | 2h |
| P2 | SEO-11 | Evaluer la pertinence d'un service worker (PWA vs mobile app) | 1h decision |
| P2 | SEO-14 | Auditer le CSS bundle et scoper les styles dashboard | 3h |
| P3 | SEO-17 | Lancer le calendrier editorial (2-3 articles/mois/locale) | Continu |
| P3 | SEO-18 | Auditer le bundle JS avec `ANALYZE=true` et optimiser | 2h |
| P3 | SEO-19 | Creer `lib/schemas/` avec factories JSON-LD centralisees | 4h |

---

## Questions ouvertes

1. **SEO-01 :** Quelle est la valeur de `NEXT_PUBLIC_APP_URL` dans les variables d'environnement Vercel production ? Si c'est `fixit-production.vercel.app`, c'est le fix le plus urgent.

2. **Hreflang cross-locale :** Existe-t-il un mapping explicite entre les slugs FR et PT ? (ex : `plomberie-marseille` <-> `canalizador-marco-de-canaveses`). Necessaire pour implementer SEO-04 et SEO-07.

3. **Polices :** Quelles polices sont utilisees sur les pages publiques vs les dashboards ? Si Outfit/Playfair/IBM Plex ne sont utilisees que dans les dashboards authentifies, les deplacer ne cassera rien sur les pages SEO.

4. **Budget images OG :** Souhaite-t-on investir dans des images OG dynamiques (SEO-08) ou est-ce que l'image generique suffit pour le moment ?

5. **PWA vs Capacitor :** L'app mobile est deja en Capacitor. Le service worker (SEO-11) est-il pertinent, ou le manifeste PWA sert uniquement au "Add to Home Screen" pour les utilisateurs web ?

6. **Profils artisans :** Combien de profils artisans verifies existent actuellement dans la base ? Si < 500, la limite de 2000 (SEO-10) n'est pas urgente.

---

## Synthese

| Categorie | Findings | P0 | P1 | P2 | P3 |
|-----------|----------|-----|-----|-----|-----|
| Meta (title, desc, OG, Twitter) | 2 | 0 | 0 | 2 | 0 |
| Hreflang / Multilingue | 3 | 0 | 2 | 1 | 0 |
| Sitemap / Robots | 5 | 1 | 1 | 3 | 0 |
| Structured Data (JSON-LD) | 3 | 0 | 1 | 1 | 1 |
| Performance SEO | 4 | 0 | 1 | 2 | 1 |
| Contenu | 1 | 0 | 0 | 0 | 1 |
| **Total** | **19** | **1** | **5** | **10** | **3** |

**Points forts du site :**
- Couverture meta/canonical exhaustive sur les 430+ pages publiques
- JSON-LD riche (52 pages, 15+ types schema.org dont BreadcrumbList, FAQPage, AggregateRating)
- robots.txt bien configure avec disallow des routes privees et allow explicite des AI crawlers (GEO)
- 50 redirections 301 pour consolider les URLs legacy
- Trailing slash enforce partout, URLs propres et semantiques
- Consent analytics RGPD-compliant (pas de scripts avant consentement)
- Locale detection robuste (cookie > geolocation Vercel > Accept-Language > default)
