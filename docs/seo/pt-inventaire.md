# Inventaire du code SEO PT — phase 0 (13/10/2026)

Livrable de la phase 0 des instructions du 13/10/2026 (`docs/seo/instructions-seo-pt-2026-10-13.md`, section 4). Lecture seule : aucun fichier de l'application n'a été modifié. Chaque point donne le chemin exact (fichier:lignes, dépôt `fixit-production`, branche `main` à `1623536c`) ou « inexistant » avec la commande qui le prouve.

Sources : lecture du code (8 lecteurs indépendants puis contre-expertise, voir section 12), audit en ligne du 13/10/2026 (`scripts/seo/pt-audit`, 1505 pages, `reports/seo/pt-audit-2026-10-13-resume.md`), tests T1 à T12 en mode référence (`reports/seo/pt-tests-2026-10-13.md`), rapport GSC du 13/10/2026 (`docs/seo/rapport-pt-non-indexees-2026-10-13.md`).

## 0. Livrables de la phase 0

| Livrable | Emplacement |
|---|---|
| Cet inventaire | `docs/seo/pt-inventaire.md` |
| Journal (règle 0.10) et gel A0 | `docs/seo/journal-pt.md` |
| CSV de référence du 13/10/2026 | `data/seo/pt_sitemap_statut_complet.csv` (1503), `data/seo/pt_non_indexees.csv` (955) |
| Script de mesure (section 8 des instructions) | `scripts/seo/pt-audit/` (Node 20+, sans dépendance), mode d'emploi `scripts/seo/README.md` |
| Tests T1 à T12 (section 7) | `scripts/seo/pt-tests.mjs`, référence FR `data/seo/reference-seo-pt.json` |
| Tests unitaires de l'outillage | `tests/seo/pt-audit-outillage.test.ts`, `tests/seo/pt-sitemap-csv-concordance.test.ts` |
| Audit et état des lieux du 13/10/2026 | `reports/seo/pt-audit-2026-10-13.csv`, `-resume.md`, `reports/seo/pt-tests-2026-10-13.md` |

Le test de concordance vérifie que le code (`getAllPtSitemapUrls`) génère exactement les 1503 URL du CSV et que l'outillage reproduit sa colonne `groupe` : la base de calcul des phases 1 à 3 est donc protégée.

## 1. Routes

| URL | Fichier | Lignes utiles | Pages |
|---|---|---|---|
| `/pt/` | `app/pt/page.tsx` (metadata, JSON-LD) ; rendu par `app/page.tsx` (`'use client'`, 805 l.) | metadata 19-35, JSON-LD 44-70 ; liens 215-798 | 1 |
| `/pt/servicos/[slug]` | `app/pt/servicos/[slug]/page.tsx` (447 l.) | params 13-15, metadata 18-52, JSON-LD 70-163, blocs 165-444 | 462 |
| `/pt/urgencia/[slug]` | `app/pt/urgencia/[slug]/page.tsx` (434 l.) | params 9-11, metadata 14-48, JSON-LD 64-153, blocs 155-431 | 462 |
| `/pt/perto-de-mim/[slug]` | `app/pt/perto-de-mim/[slug]/page.tsx` (607 l.) | `resolveSlug` 22-52 (picheleiro), params 61-79, metadata 84-112, JSON-LD 153-229, blocs 231-604 | 21 hubs + 462 + 1 + 22 picheleiro = 506 |
| `/pt/cidade/[slug]` | `app/pt/cidade/[slug]/page.tsx` (377 l.) | params 14-16, metadata 19-52, JSON-LD 65-92, sections 158-343 | 22 |
| `/pt/blog/[slug]` | `app/pt/blog/[slug]/page.tsx` (333 l.) | params 8-10, metadata 34-41, JSON-LD 87-117, liens 128-294 | 27 |
| `/pt/servicos/` | `app/pt/servicos/page.tsx` (243 l.) | metadata 6-26, liens 57-233 | 1 |
| `/pt/urgencia/` | `app/pt/urgencia/page.tsx` (323 l.) | metadata 8-34, JSON-LD 75-96, liens 115-269 | 1 |
| `/pt/perto-de-mim/` | `app/pt/perto-de-mim/page.tsx` (214 l.) | metadata 7-19 (canonical seule), liens 61-189 | 1 |
| `/pt/cidade/` | `app/pt/cidade/page.tsx` (198 l.) | metadata 6-25, liens 85-189 | 1 |
| `/pt/blog/` | `app/pt/blog/page.tsx` (217 l.) | metadata 6-19, JSON-LD 37-66 | 1 |
| `/pt/precos/`, `/pt/precos/[slug]` | `app/pt/precos/page.tsx` (248 l.), `app/pt/precos/[slug]/page.tsx` (557 l., `VALID_SLUGS` 196-201 : canalizador, eletricista, pintor ; `PRICE_GUIDES` 30-194) | | 1 + 3 |
| `/pt/contact/` | `app/contact/page.tsx` + `app/contact/layout.tsx`, servie par le rewrite `next.config.ts:75-76` | canonical 20, og:image 17 | 1 |
| `/pt/contacto/` | inexistant (`ls app/pt/contacto` → absent ; `grep -rn "contacto" app lib components next.config.ts middleware.ts` → 0) | | 0 |
| `/pt/pesquisar/` | `app/pt/pesquisar/page.tsx` (ré-export de `app/fr/recherche/page.tsx`, `'use client'`) + `layout.tsx` | résultats chargés côté client : 0 mot dans `<main>` au rendu serveur (audit) | 1 |
| `/pt/profissional/[id]` | `app/pt/profissional/[id]/page.tsx:13` `robots: { index: false, follow: false }` | | n |
| Pages statiques | `app/pt/{sobre,como-funciona,avaliacoes,simulador-orcamento,especialidades,mapa-do-site,condominio,profissionais-verificados,torne-se-parceiro,mercados/publicar,mercados/gerir}/page.tsx` | | 11 |
| Pages juridiques | `app/pt/{termos,avisos-legais,privacidade,politica-cookies}/page.tsx:6-7` `robots: { index: false, follow: true }` | | 4 |

Les commentaires des routes sont périmés (« 32 static pages (4 services × 8 cities) » `app/pt/servicos/[slug]/page.tsx:12`, « 8 static city pages » `app/pt/cidade/[slug]/page.tsx:13`) : la grille est passée de 4 × 8 à 21 × 22.

Chronologie (git) : routes et données créées le 18/03/2026 (`3c3596aa`), perto-de-mim le 19/03 (`e8f8266f`), 22 villes et champs d'enrichissement `contentUpdatedAt` les 07 et 09/05/2026 (`33016a46`, `dddfae2d`), sitemap PT dédié et picheleiro le 09/05 (`5c9b5bfc`), dernier changement de contenu des routes de grille le 05/06/2026 (`5f7941b1`, hreflang et x-default), dernier changement de `lib/sitemap-pt-pages.ts` le 06/10/2026 (`96405bcd`).

## 2. Source des listes et des textes ; champs réellement variables

- Métiers (21) : `SERVICES` dans `lib/data/seo-pages-data.ts:1432-2670`. `picheleiro` n'est pas un métier : alias de `canalizador` résolu dans `app/pt/perto-de-mim/[slug]/page.tsx:22-52` (`isPicheleiro`), inscrit au sitemap par `lib/sitemap-pt-pages.ts:121-128` ; les variantes `/pt/servicos/picheleiro-*`, `/pt/urgencia/picheleiro-urgente-*`, `/pt/precos/picheleiro/` sont redirigées vers canalizador (`next.config.ts:102-104`). Le mot « picheleiro » figure déjà dans le title, le sous-titre et une FAQ de canalizador (`seo-pages-data.ts:1495-1530`) : il y a donc jusqu'à 4 URL par ville sur cette requête.
- Villes (22) : `CITIES` dans `lib/data/seo-pages-data.ts:98-1432` (interface `CityData` 16-35 : slug, name, distrito, population, lat, lng, freguesias, nearby, specialty, localEconomy, climateChallenges, landmarks, notableFreguesias, serviceCityOverrides, contentUpdatedAt). `nearby` cite 4 slugs qui n'existent pas dans `CITIES` (espinho, guimaraes, barcelos, famalicao), filtrés au rendu : Braga n'a aucune ville voisine liée.
- Texte des gabarits : uniquement `lib/data/seo-pages-data.ts` et des constantes dans chaque route. Aucune des 4 routes de grille n'importe `locales/pt.json`, Supabase, `fetch`, `lib/seo/hreflang.ts` ni `lib/seo/service-prices.ts` (imports lus : servicos 1-10, urgencia 1-6, perto-de-mim 1-6, cidade 1-11).
- Injection : `replace(/{city}/g, city.name)` (`app/pt/servicos/[slug]/page.tsx:61-64`, `app/pt/urgencia/[slug]/page.tsx:57-60`) ou gabarits littéraux (`app/pt/perto-de-mim/[slug]/page.tsx:267-275, 529-567`).

Champs réellement variables par page (texte visible) :

| Route | Variables ville | Variables métier | Texte propre au couple métier x ville |
|---|---|---|---|
| servicos | name, distrito, population, freguesias (liste), nearby (0 à 3 noms) | 10 champs (`heroTitle`, `heroSubtitle`, `features`, `problemsWeSolve`, `urgencyText`, `faqs`, `metaTitle`, `metaDesc`, `name`, `icon`) | 66 pages sur 462 : `serviceCityOverrides[slug].intro` + `localCases` pour eletricista, canalizador, pintor × 22 villes (`seo-pages-data.ts:133-1432`, 66 intros distinctes) |
| urgencia | name, distrito (JSON-LD), population, freguesias (liste et nombre), nearby | 9 champs (`urgency.*`, `features`, `faqs`) | 0 (`serviceCityOverrides` non lu) |
| perto-de-mim | name, population, freguesias, nearby | 6 champs | 0 |
| cidade | 10 champs dont 5 d'enrichissement (`specialty`, `localEconomy`, `climateChallenges`, `landmarks`, `notableFreguesias`) | | 22 sur 22 (seule route à contenu propre par page) |

Conclusion : 2 variables sémantiques (métier, ville) ; 1364 des 1430 pages métier x ville (95 %) n'ont aucun texte propre au couple ; entre les 22 villes d'un même métier ne changent que le nom de ville (environ 20 injections), le distrito, la population, la liste des freguesias et 0 à 3 noms de villes voisines. Les 3 routes partagent la même liste `features` (servicos 235, urgencia 280, perto-de-mim 387) et servicos et urgencia émettent la même `FAQPage` pour un même couple (152-161 contre 114-120). Sur les 1023 chaînes de `SERVICES` (environ 65 000 caractères), 172 contiennent le seul gabarit existant, `{city}` ; `features`, `problemsWeSolve`, `immediateSteps`, `whenToCall` n'en contiennent aucun. Les 66 `serviceCityOverrides` représentent environ 40 900 caractères (intro moyenne 269 caractères, 3 `localCases` d'environ 100 caractères) ; les champs d'enrichissement des villes (`specialty`, `climateChallenges`, `landmarks`, `notableFreguesias`, `localEconomy`, environ 41 000 caractères) ne sont rendus que par les 22 pages ville (`components/seo/City*Section.tsx`, importés seulement par `app/pt/cidade/[slug]/page.tsx:8-11`). `hasEnrichedContent` (`seo-pages-data.ts:36-44`) n'est appelée nulle part.

Attention pour la phase 3 : les blocs « Intervenções recentes em {Ville} » (`app/pt/servicos/[slug]/page.tsx:247-271`) présentent les `localCases` comme des « exemplos de trabalhos realizados pelos profissionais VITFIX no concelho » alors que ce sont des chaînes statiques écrites en mai 2026, sans lien avec un enregistrement : au sens des instructions (règle 0.2), ce sont des chantiers non sourcés, à remplacer par des chantiers réels ou à retirer.

Mesure en ligne (audit du 13/10/2026, méthode du rapport) : servicos propre 7,0 % contre tout le modèle et 30,0 % entre les 22 villes d'un métier (rapport : 9,0 % et 29,7 %), partagé 10+ 91 % ; urgencia 4,6 % ; perto-de-mim 4,0 % ; chevauchement canalizador-ovar et canalizador-aveiro 69,7 % / 67,7 % (rapport 70,9 / 69,3) ; servicos et urgencia du même couple 38,0 % / 46,4 % ; perto-de-mim canalizador-ovar et picheleiro-ovar 77,9 %. L'écart de 1 à 2 points avec le rapport vient du découpage des mots et du périmètre exact de `<main>` ; il ne change aucune conclusion. Lecture à garder en tête pour la porte de qualité : le « 30 % propre entre les 22 villes » est gonflé par les 30 substitutions du nom de ville, qui cassent chaque séquence de 5 mots autour d'elles ; en prose réellement rédigée pour la page, canalizador-aveiro et canalizador-ovar n'ont que 70 à 85 mots propres (environ 13 à 16 % du corps), et les 396 pages servicos sans override, comme toutes les pages urgencia et perto-de-mim, en ont 0.

## 3. Sitemaps

| Fichier | Générateur | Contenu au 13/10/2026 |
|---|---|---|
| `/sitemap.xml` (index) | `app/sitemap.xml/route.ts:48-60` : enfants 0 à 3 fixes, 4 si au moins un artisan vérifié (`hasVerifiedArtisans`, 35-46), plus `MARKET_SITEMAPS = ['/pt/sitemap.xml']` (32) | 5 enfants ; `/sitemap/4.xml` répond 200 avec 0 URL mais n'est pas référencé |
| `/sitemap/0.xml` | `app/sitemap/[id]/route.ts:59-92` `staticAndHubPages` | 27 URL : racine, 10 FR, 16 PT |
| `/sitemap/1.xml` | `app/sitemap/[id]/route.ts:171` → `ptProgrammaticPages` de `lib/sitemap-pt-pages.ts:79-131` | 1483 URL PT |
| `/sitemap/2.xml` | `frProgrammaticPages` (`app/sitemap/[id]/route.ts:101-154`) | 1502 URL FR, SHA-256 `22561fbc…` (référence T2/T9) |
| `/sitemap/3.xml` | `investorAndIntlPages` (156-179) | 25 URL EN/FR/NL/ES, SHA-256 `039854cb…` |
| `/pt/sitemap.xml` | `app/pt/sitemap.xml/route.ts` → `getAllPtSitemapUrls` = `ptStaticPages` (20, `lib/sitemap-pt-pages.ts:44-72`) + `ptProgrammaticPages` (1483) | 1503 URL, 1457 avec `lastmod`, 46 sans |

- Chaque URL PT de grille est déclarée deux fois (`/sitemap/1.xml` et `/pt/sitemap.xml`) et chacune des 16 statiques deux fois (`/sitemap/0.xml` et `/pt/sitemap.xml`) : 1499 URL PT dans plus d'un sitemap (T2). Les 4 pages juridiques `noindex` ne figurent que dans `/pt/sitemap.xml`. L'union des URL PT est exactement `/pt/sitemap.xml`, et `/pt/sitemap.xml` est exactement le CSV de référence (vérifié par test). L'index n'a pas de `lastmod` (appel sans `lastModByLoc`, `app/sitemap.xml/route.ts:55`).
- `/sitemap/4.xml` (fiches vérifiées) listerait des URL `/pt/profissional/…` qui sont en `noindex, nofollow` (`app/pt/profissional/[id]/page.tsx:13`) dès qu'un artisan PT serait vérifié : contradiction à lever en phase 1 (point 1.8) avant toute vérification d'artisan.
- `.github/workflows/indexnow-post-deploy.yml` soumet à IndexNow, à chaque déploiement, toutes les URL de tous les sitemaps sans dédoublonnage (PT en double, 4 pages `noindex` comprises) ; sans effet sur Google. Aucun ping Google (point de terminaison supprimé par Google en 2023) : Google ne dispose que de la relecture du sitemap et de ses `lastmod`.
- Origine des `lastmod` : `city.contentUpdatedAt` pour les 1408 pages métier x ville et les 22 pages ville (`lib/sitemap-pt-pages.ts:86, 94, 103, 116, 126`), c'est-à-dire la date à laquelle la fiche ville a été enrichie (`seo-pages-data.ts:132-1398` : 2026-05-07 pour 3 villes, 05-09 pour 7, 05-11 pour 12), quel que soit le métier ; `article.dateModified ?? datePublished` pour le blog (`lib/sitemap-pt-pages.ts:32-36`), or aucun des 27 articles n'a de `dateModified` (grep sur 2720-3837 → 0) ; aucun `lastmod` pour les 20 statiques, les 22 hubs métier et les 4 pages prix. Le helper omet la balise quand il n'a pas de date (`lib/sitemap-helpers.ts:35-45`) : il n'y a ni `changefreq` ni `priority` (`formatSitemapXml`, 47-58). Les dates réelles de dernier commit (`derniere_modif_reelle` de l'audit avec `--git`) sont au 05/06/2026 pour toutes les pages de grille. Origine des trois dates (git) : `2026-05-07` écrite par `33016a46` (pilote Aveiro, Águeda, Ovar, sources Wikipedia `lib/data/aveiro-sources.ts`), `2026-05-09` par `dddfae2d` (7 villes du district de Porto), `2026-05-11` par `5f7941b1` fusionné le 05/06/2026 (12 villes d'origine) : ce sont des dates de rédaction déclarées des fiches ville, jamais rafraîchies depuis, alors que les gabarits ont changé après (og:image dynamiques le 03/06, bloc `localCases` le 05/06, liens prix le 06/10). Blog : les 27 articles ont été ajoutés en un seul commit le 18/03/2026 (`3c3596aa`) avec des `datePublished` remontant jusqu'au 15/11/2025, donc antidatées ; le `lastmod` du blog est cette date. Dates réelles disponibles pour un futur `lastmod` honnête : création 18/03/2026, enrichissements 07/05, 09/05 et 05/06/2026, gabarits 03/06 et 05/06/2026, prix 06/10/2026.
- URL `noindex` dans le sitemap : `/pt/termos/`, `/pt/avisos-legais/`, `/pt/privacidade/`, `/pt/politica-cookies/` (`lib/sitemap-pt-pages.ts:67-70`). URL indexables absentes : `/pt/cidade/`, `/pt/contact/`. `/pt/mercados/gerir/` est bien exclue (commentaire 64).
- Validation d'identifiant `parseSitemapId` (`lib/sitemap-helpers.ts:85-88`), en-têtes `SITEMAP_HEADERS` (cache 1 h). Aucun `xhtml:link`.
- Le middleware exclut `sitemap.xml` et les `.xml` de son matcher (`middleware.ts:414-424`), donc aucun cookie ni redirection sur les sitemaps.
- `lib/seo/indexnow.ts` et `.github/workflows/indexnow-post-deploy.yml` : ping IndexNow après déploiement (Bing, Yandex ; sans effet sur Google).

## 4. Redirections et 404

- Middleware (`middleware.ts`) : tout chemin sans préfixe de langue reçoit un 302 vers `/{locale}{chemin}` avec `Vary: Accept-Language` et cookie `locale` (146-167) ; locale déduite du cookie, puis du pays Cloudflare (`cf-ipcountry`), puis d'`Accept-Language`, sinon `fr` (105-123). Les préfixes SEO publics (`SEO_PUBLIC_PREFIXES`, 51-61) reçoivent `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` (227-230) : après une mise en production, le CDN peut servir l'ancien état pendant 1 h, puis du contenu périmé pendant la revalidation ; attendre avant de contrôler. L'accueil `/pt/` n'est pas en cache public (branche `needsAuth`, 196) et fait un `getUser` Supabase à chaque requête. Les sitemaps, `robots.txt` et la clé IndexNow sont exclus du matcher (414-424).
- `next.config.ts` : `trailingSlash: true` (10) ; rewrites `/pt/auth/*`, `/pt/pro/*`, `/pt/contact`, `/pt/tracking/*`, etc. vers les pages partagées à la racine (59-83) ; redirections 308 (`permanent: true`) : variantes `electricista` (96-99), `picheleiro` → `canalizador` (102-104), anciens chemins racine PT (109-134), pages FR sous `/pt/` (164-174), anciens articles de blog (204-210 : 1 vers l'article équivalent, 5 vers l'index `/pt/blog/`), `/m%C3%AAs/` → `/pt/` (214) et `/mois/` → `/fr/` (212).
- Point 1.2 des instructions (« chemins inconnus sans préfixe qui finissent en 200 sur `/pt/` ») : vérifié en ligne, un chemin inconnu sans préfixe suit 308 (ajout du slash) → 302 (locale) → `/pt/{chemin}/` → 404 avec `noindex` (`app/not-found.tsx`). Seul `/mês` atterrit sur `/pt/` en 200, à cause de la règle explicite `next.config.ts:214`. Aucune règle générale n'envoie les inconnus vers `/pt/` : le point se limite à supprimer ou cibler cette règle. Noter que `/mês` non encodé est renvoyé par Cloudflare vers `/m%EAs/` (Latin-1) avant d'atteindre Next ; le lien `/mês` n'apparaît plus dans aucune page PT auditée (GSC l'a vu le 08/05/2026).
- 404 : `app/not-found.tsx` répond 404 avec deux balises `<meta name="robots">` (`noindex` et `noindex, nofollow`), sans redirection ; un slug de grille inconnu passe par `notFound()` (servicos 57, urgencia 53, perto-de-mim 86, cidade 21) et finit en 404 propre (vérifié : `/pt/servicos/metier-inconnu-ovar/` → 404).
- Redirections permanentes Next.js = 308, pas 301. Google traite 301 et 308 comme permanentes ; le test T8 accepte les deux et consigne le code réel.
- Blog, état en ligne le 13/10/2026 : `poupar-agua-casa`, `como-desentupir-canos`, `sinais-fuga-agua`, `iva-6-remodelacao-portugal` → 404 sans redirection ni lien (inexistants dans `app`, `lib`, `components`, `next.config.ts`, `public`) ; `certificacao-eletrica`, `como-escolher-tinta`, `paineis-solares-portugal`, `preparar-paredes-pintura`, `seguranca-eletrica-casa` → 308 vers `/pt/blog/` ; `humidade-paredes-solucoes` → 308 vers `humidade-parede-causas-reparacao`. Les cibles proposées existent : `cano-entupido-como-resolver` (`seo-pages-data.ts:3639`), `fuga-agua-como-agir` (2910), `iva-6-obras-remodelacao-portugal` (3137). Les cartes « artigos relacionados » des guides de prix gardent encore les anciens libellés avec `slug: null` → lien vers l'index (`app/pt/precos/[slug]/page.tsx:82-86, 137-141, 206-208`).

## 5. Données structurées (JSON-LD)

Bloc commun injecté par `app/layout.tsx:239-348` sur toutes les pages : `WebSite` (`#website`, `SearchAction` vers `https://vitfix.io/pt/pesquisar/?q={search_term_string}`, 259-260, URL interdite par `robots.txt`) et `Organization` + `HomeAndConstructionBusiness` (`#business`, `legalName: 'VITFIX — Empresário em Nome Individual'` 274, `priceRange: '€€'`, téléphone `PHONE_PT` de `lib/constants.ts:13`, `areaServed` France et Portugal, sans `address`). Fabriques dans `lib/schemas/index.ts` (business 68-117, breadcrumb 126-136, article 208-235, politique « pas d'aggregateRating » 17-33).

| Modèle (pages) | Nœuds émis par page | Fichier:lignes | address | geo | horaires | prix |
|---|---|---|---|---|---|---|
| servicos (462) | `LocalBusiness` « VITFIX - {Métier} em {Ville} », `Service` (`provider` `#business`, `areaServed` City, `hasOfferCatalog` 8 `Offer` avec `PriceSpecification minPrice 30`), `BreadcrumbList`, `FAQPage` (5) | `app/pt/servicos/[slug]/page.tsx:74-105, 107-142, 144-161` | ville (PostalAddress sans rue) | centroïde | 08-20 h, 7 j | `€€`, `minPrice 30` fixe |
| urgencia (462) | `EmergencyService`, `BreadcrumbList`, `FAQPage` (identique à servicos), `HowTo` (6 étapes), `WebPage` + `speakable` | `app/pt/urgencia/[slug]/page.tsx:68-104, 106-151` | ville | centroïde | 00-23:59 | |
| perto-de-mim métier x ville (484) | `LocalBusiness` sans `address`, `BreadcrumbList` (4 niveaux), `FAQPage` (3, texte différent du HTML visible) | `app/pt/perto-de-mim/[slug]/page.tsx:158-173, 183-227` | aucune | centroïde | 08-20 h | `€€` |
| hubs métier perto-de-mim (22) | `Service` (`areaServed` 22 villes, `provider` Organization en ligne), `BreadcrumbList`, `FAQPage` | idem 175-181 | | | | |
| cidade (22) | `LocalBusiness` sans `address`, `BreadcrumbList` | `app/pt/cidade/[slug]/page.tsx:69-85` | aucune | centroïde | | |
| blog (27) | `BlogPosting` (auteur `Person` « Equipa editorial Vitfix » → `/pt/sobre/`, `dateModified` = `datePublished`), `BreadcrumbList`, `FAQPage` fabriquée à partir des 5 premiers titres de section (réponses tronquées à 300 caractères) | `app/pt/blog/[slug]/page.tsx:87-117` | | | | |
| `/pt/` | second `HomeAndConstructionBusiness` avec `address` Porto 4000-001, `geo`, 12 `serviceType`, `BreadcrumbList` à 1 élément | `app/pt/page.tsx:44-70` | Porto 4000-001 | oui | oui | `€€` |
| `/pt/contact/` | `ContactPage`, `HomeAndConstructionBusiness` avec `address` Marco de Canaveses et `areaServed` Marco, Porto, Lisboa | `app/contact/page.tsx:43-85` | Marco de Canaveses | | | |
| `/pt/especialidades/` | `LocalBusiness` « VITFIX Portugal : Especialidades » (`addressRegion` Porto) | `app/pt/especialidades/page.tsx:67-77` | région seule | | | |
| `/pt/condominio/` | `LocalBusiness` sans adresse, `FAQPage` | `app/pt/condominio/page.tsx:53-85` | | | | |
| `/pt/profissionais-verificados/` | `Organization` avec `aggregateRating` (4,8 sur 6 avis codés en dur) et 6 `Review`, `FAQPage` | `app/pt/profissionais-verificados/page.tsx:54-106, 131-184` | | | | |
| `/pt/como-funciona/` | `WebPage`, `FAQPage`, `HowTo` | `app/pt/como-funciona/page.tsx:122-160` | | | | |
| `/pt/torne-se-parceiro/` | `WebPage`, `FAQPage`, `Service` avec `Offer` 0 € et 29 € (l'accueil affiche 49 €/mês, `app/page.tsx:637`) | `app/pt/torne-se-parceiro/page.tsx:149-213` | | | | |
| hubs de section, `/pt/cidade/`, `/pt/blog/`, `/pt/precos/` | `CollectionPage`, `BreadcrumbList` (`/pt/urgencia/` : `ItemList` annonçant 462 éléments et n'en listant que 21, tous vers Marco de Canaveses) | | | | | |

Audit en ligne : 926 pages avec une `address` dans le JSON-LD, 1431 avec un `geo`, 0 erreur de parsing ; `FAQPage` sur 1005 pages, `HowTo` sur 463. Trois adresses différentes coexistent (Porto 4000-001, Marco de Canaveses, « Sede : Portugal » dans `app/pt/avisos-legais/page.tsx:29`), aucune avec rue, et l'entité légale du code est « Empresário em Nome Individual, NIF 276 873 297 » (`app/pt/termos/page.tsx:200`), non « VITFIX CONSTRUÇÕES, LDA » cité par les instructions : voir décision 3.

## 6. Balises title, description, canonical, hreflang, og:image

- Template de titre : `app/pt/layout.tsx:5-8` `template: '%s | VITFIX Portugal'`. Les routes de grille, le blog et la recherche terminent déjà leur `title` par « | VITFIX » (`service.metaTitle`, `urgency.metaTitle`, perto-de-mim 93, `article.metaTitle`) : d'où « … | VITFIX | VITFIX Portugal ». Audit : marque présente plus d'une fois sur 1502 pages sur 1505 ; longueurs mesurées servicos 69 à 108 caractères, perto-de-mim 81 à 118, cidade 87 à 101, blog 67 à 93, hubs 70 à 105. `/pt/`, `/pt/contact/` et `/pt/pesquisar/` échappent au template (même segment ou arbre `app/contact`).
- Descriptions : `service.metaDesc` par métier (identique entre villes au nom près), perto-de-mim gabarit avec nombre de freguesias et population (94-96). Audit : 270 hors 80-160 caractères ; les 4 pages juridiques partagent la description du layout.
- Canonical : auto-référente partout (`metadataBase` `https://vitfix.io`), 0 écart sur 1505 pages. `/pt/pesquisar/` : canonical et hreflang posés par `app/pt/pesquisar/layout.tsx`.
- hreflang : écrit en dur dans chaque route (`buildAlternates` / `buildPtAlternates` de `lib/seo/hreflang.ts` ne sont importés par aucune route de grille). servicos → `fr-FR=/fr/services/`, `en=/en/`, `x-default=/` (44-49) ; urgencia → `/fr/urgence/` (40-45) ; cidade → `/fr/` sans `en` (45-49) ; blog → `/fr/blog/` (34-41) ; perto-de-mim : `alternates = { canonical }` seulement (110), donc aucun hreflang sur 506 pages ; idem `/pt/perto-de-mim/`, `/pt/precos/`, `/pt/precos/[slug]/`, `/pt/especialidades/`, `/pt/condominio/`, `/pt/avaliacoes/`, `/pt/sobre/` (le `page.tsx` écrase le `layout.tsx`). `x-default` pointe tantôt vers `/` (qui répond 302) tantôt vers la page elle-même (hubs). Test T4 : 4777 anomalies (alternates génériques, non réciproques, x-default en 302).
- og:image : `ogImageMeta` (`lib/og.ts:13-24`) → `https://vitfix.io/api/og/?title=…&locale=pt` pour servicos, urgencia, cidade ; image générique `/api/og/?locale=pt` pour perto-de-mim (107) et les autres pages ; `?locale=fr` sur `/pt/contact/` (`app/contact/layout.tsx:17`). `/api/` est interdit par `robots.txt` (`app/robots.ts:11, 18`) : 1501 pages sur 1505 ont une image sociale bloquée (T11).
- `robots` meta : `index, follow, max-video-preview:-1, max-image-preview:large, max-snippet:-1` hérité de `app/layout.tsx:74-88` ; aucun `X-Robots-Tag` sur les pages PT (seuls `/syndic/dev/*` et `/administrateur-judiciaire/*` en ont, `next.config.ts:268-290`).
- Un seul `h1` sur 1504 pages ; `/pt/pesquisar/` en a 2 (rendu client).

## 7. Navigation et maillage

- Coquille : `components/common/ConditionalLayout.tsx:104-127` ajoute `Header` et `Footer` à toutes les pages PT sauf l'accueil. Header (`components/common/Header.tsx:63-88`) : logo, `/pt/simulador-orcamento/`, `/pt/auth/login/`, `/pt/pesquisar/`. Footer (`components/common/Footer.tsx:30-141`) : `/pt/`, `/pt/pesquisar/`, `/pt/#how`, `/pt/precos/`, `/pt/avaliacoes/`, `/pt/pro/register/`, `/pt/pro/tarifs/`, `/pt/auth/login/`, `/pt/pro/faq/`, 4 pages juridiques `noindex`, `/pt/contact/`, `/pt/mapa-do-site/`. Aucun lien global vers `/pt/servicos/`, `/pt/urgencia/`, `/pt/perto-de-mim/`, `/pt/cidade/`, `/pt/blog/`. Les liens passés à `next/link` ou `LocaleLink` reçoivent la barre finale au rendu (`trailingSlash: true`) ; seules les balises `<a>` brutes la perdent : `app/pt/termos/page.tsx:162` `href="/pt/privacidade"` (T3).
- Accueil `/pt/` (`app/page.tsx`) : logo vers `/` sans locale (215, 302 puis `/pt/`), 8 cartes vers `/pt/pesquisar/?category=plomberie|electricite|serrurerie|chauffage|peinture|maconnerie|menuiserie|toiture` (434-440, slugs FR de `lib/categories.ts:18-25`, URL interdites par `robots.txt`), 12 villes sur 22 vers `/pt/cidade/{slug}/` (707-723 ; manquent aveiro, agueda, ovar, matosinhos, gondomar, valongo, vila-do-conde, santo-tirso, povoa-de-varzim, trofa), aucun lien vers un hub de section, un hub métier, `/pt/cidade/`, un article ou une page métier x ville. Il affiche « Mais de 2 300 avaliações verificadas · Nota média 4.9/5 » et 3 avis codés en dur (498-536) alors que `/pt/avaliacoes/` annonce une « plataforma jovem em fase de lançamento » (`app/pt/avaliacoes/page.tsx:69`).
- Hubs : `/pt/servicos/` lie les 462 pages servicos + 21 urgencia (toutes Marco de Canaveses) + 21 hubs métier + 22 villes (`app/pt/servicos/page.tsx:89-185`, 552 liens mesurés) ; `/pt/urgencia/` lie 462 urgencia + 22 villes (504) ; `/pt/perto-de-mim/` lie 21 hubs métier + 21 × 6 premières villes + 4 picheleiro = 151 des 506 pages du modèle (`app/pt/perto-de-mim/page.tsx:98-144`, `CITIES.slice(0, 6)`), et n'est lui-même lié que par `/pt/mapa-do-site/` ; `/pt/cidade/` lie 22 villes + 462 servicos repliés dans un `<details>` (505) ; `/pt/mapa-do-site/` (`components/seo/HtmlSitemap.tsx`) lie 571 URL sans les 462 urgencia, les 462 perto-de-mim métier x ville, les 23 picheleiro ni les 3 guides de prix, et liste 3 pages `noindex`.
- Pages de grille : servicos lie 0 à 3 villes voisines du même métier (330-349), les 20 autres métiers de la ville (354-373), 0 à 3 articles (7 métiers sur 21 ont des articles liés) ; urgencia lie en plus sa page servicos et, pour 3 métiers, `/pt/precos/` ; perto-de-mim lie servicos et urgencia du couple ; servicos ne lie jamais urgencia ni perto-de-mim ni la page ville. Pages ville : 21 servicos, 6 urgencia (`SERVICES.slice(0, 6)`, 199-206), 3 guides de prix, 0 à 3 villes voisines, les 6 mêmes articles pour les 22 villes (319), aucun perto-de-mim. `/pt/condominio/` ne lie pas le métier `limpeza-condominio`.
- Mesures (audit, graphe sur les 1505 pages) : profondeur depuis `/pt/` servicos 2 à 3, urgencia 2 à 4 (192 pages à 4), perto-de-mim 4 à 5 (465 à 4, 19 à 5), hubs métier 3 à 4, pages ville 1 (12 villes) à 3 ; 1 orpheline (`/pt/mercados/publicar/`) ; liens entrants moyens servicos 29, urgencia 26, perto-de-mim 25 ; 0 lien vers `/pt/profissional/`.
- Liens sans préfixe de langue encore générés : `/` (logo de l'accueil), `/pro/register/` (`app/pt/torne-se-parceiro/page.tsx:77, 94, 237, 396`, 302 puis URL interdite par robots), `/sitemap.xml` (plan HTML). `/pesquisar/` et `/mês` n'apparaissent plus (les URL de l'annexe 6.6 du rapport datent de mai à juillet 2026).
- `/pt/especialidades/` : 6 cartes qui pointent toutes vers `/pt/pesquisar/` (154), aucune route `/pt/especialidades/[slug]` (`ls app/pt/especialidades` → `page.tsx` seul), 274 mots. `/pt/sobre/` : bouton « contact » vers `/pt/avisos-legais/` (`app/fr/a-propos/page.tsx:15`).

## 8. Prix, FAQ, « professionnels », avis ; base de données

- Prix : aucun bloc prix sur les pages de grille et pas de champ `prices` dans `SERVICES` (interface 62-75). Mentions codées en dur dans les FAQ par métier (ex. canalizador « deslocação 30-50€ … esquentador 80-200€ », `seo-pages-data.ts:1519`), `minPrice: '30'` fixe dans le JSON-LD servicos (129-133), 3 fourchettes fixes sur les pages ville (`app/pt/cidade/[slug]/page.tsx:234-238`), `PRICE_GUIDES` statique pour 3 métiers (`app/pt/precos/[slug]/page.tsx:30-198`, « valores de referência » sans source, contexte « Tâmega e Sousa, 15-25 % inferiores ao Porto »). Incohérence : esquentador « 80-200€ » dans la FAQ contre « 60-150€ » dans le guide de prix. `lib/seo/service-prices.ts` ne couvre que des slugs FR (13-28) ; `components/seo/LocalPricingSection.tsx` (texte français) n'est importé que par la route FR. Méthodologie prix du dépôt : `docs/prix-2026-methodology.md` (FR).
- FAQ : `service.faqs` par métier (86 questions, 4 à 5 par métier), `{city}` substitué dans 2 questions et 5 réponses seulement ; identiques dans les 22 villes et rendues deux fois par couple (servicos et urgencia) ; perto-de-mim : 3 questions gabarit dans la route (527-570) ; blog : `FAQPage` fabriquée depuis les titres de section ; guides de prix : 4 FAQ propres.
- « Professionnels » : aucune liste ; seule la chaîne « Profissionais verificados » (servicos 224). Avis : aucun bloc sur la grille (`aggregateRating` volontairement omis, 104) ; avis codés en dur sur l'accueil (3), `/pt/profissionais-verificados/` (6, balisés `Review`) et `/pt/torne-se-parceiro/` (3 témoignages).
- Base Supabase (aucune page PT ne la lit : `grep -rn "supabase" app/pt --include=*.tsx -l` → `app/pt/mercados/*` et la recherche cliente seulement) : `profiles_artisan` avec colonne `country` (`supabase/migrations/038_audit_complete_fix.sql:99`, défaut `FR`, index `active, country`), `is_verified` (utilisée par le sitemap 4, `app/sitemap/[id]/route.ts:188-192`), `rating_avg` / `rating_count` ; `bookings` (`052_baseline_missing_tables.sql:130-150` : `artisan_id`, `service_id`, `status`, `booking_date`, `address`, `price_ht`, `price_ttc`) ; `booking_reviews` (183-191 : `rating` 1 à 5, `comment`, `created_at`, sans champ de consentement à la publication) ; `devis`, `factures`, `factures_recues`. Le sitemap 4 des fiches vérifiées est vide en ligne (0 URL), donc aucun artisan `is_verified` en production au 13/10/2026 (ou la requête échoue silencieusement). `data/artisans-PT-final.json` : 217 profils récupérés sur habitissimo.pt le 18/03/2026 (Marco de Canaveses 91, Braga 73, Porto 28, Amarante 13, Paços de Ferreira 10, Penafiel 1, Felgueiras 1), `to_import: 0`, `to_review: 149`, `auto_rejected: 68` : ce sont des fiches tierces, pas des professionnels VITFIX.
- Conclusion H2 : aucune donnée locale réelle n'est exposée, et le dépôt ne contient pas de chantiers, de devis par ville ni de délais exploitables tels quels. Les tables `bookings`, `devis`, `factures`, `booking_reviews` existent et peuvent fournir, après extraction par le propriétaire, les chantiers par ville, les montants, les dates et les avis (décision 4).

## 9. Audit et tests du 13/10/2026 (état des lieux)

| Test | Résultat | Anomalies | Lecture |
|---|---|---|---|
| T1 | échec | 4 | les 4 pages juridiques `noindex` sont dans le sitemap |
| T2 | échec | 1503 | chaque URL PT dans 2 ou 3 sitemaps ; FR intacts |
| T3 | échec | 6 | `/` (302), `/pro/register/` (302), `/sitemap.xml`, `/pt/privacidade` sans barre |
| T4 | échec | 4777 | alternates génériques et non réciproques, x-default en 302 |
| T5 | échec | 97 | `FAQPage`, `HowTo`, `LocalBusiness` par ville, pas de nœud entreprise avec adresse sur la grille |
| T6 | échec | 3240 | marque doublée, titles trop longs, descriptions hors bornes |
| T7 | échec | 679 | perto-de-mim à 4-5 clics, pages ville ne liant pas tous leurs métiers, hubs métier liant 6 villes sur 22 |
| T8 | non applicable | | table de redirection absente (phase 2) |
| T9 | OK | 0 | référence FR écrite (30 URL, empreinte de `/sitemap/2.xml`) |
| T10 | non applicable | | porte de qualité absente (phase 3) |
| T11 | échec | 5 | og:image sous `/api/` bloquée |
| T12 | OK | 0 | 404 propres avec `noindex`, jamais `/pt/` |

Le script d'audit reproduit les mesures du rapport (section 2) ; la ligne « Contrôle du script » de `reports/seo/pt-audit-2026-10-13-resume.md` donne 30,8 % propre et 65,4 % partagé 10+ pour les 22 pages canalizador (attendus 29,7 % et 67,1 %).

## 10. Hypothèses H1 à H8

Verdicts établis par les lecteurs du code ; la contre-expertise indépendante (relecture des fichiers cités et confrontation aux mesures) est en cours et ses corrections seront reportées ici.

| Id | Verdict | Preuve principale |
|---|---|---|
| H1 : texte commun avec injection {métier} {ville} | confirmée | section 2 : 2 variables, 1364/1430 pages sans texte propre, `replace(/{city}/g)` |
| H2 : aucune donnée locale réelle | confirmée (code) ; base non consultée | section 8 : aucune lecture Supabase, prix et FAQ codés en dur, 0 lien vers un professionnel ; tables disponibles pour la phase 3 |
| H3 : chevauchement d'intentions, synonymes | confirmée | 3 URL par couple avec `features` et `FAQPage` identiques ; picheleiro = canalizador (jusqu'à 4 URL par ville) ; seule justification écrite `docs/seo-audit-pt-structure.md:184` ; chevauchements mesurés 38-46 % (servicos/urgencia) et 78 % (picheleiro) |
| H4 : LocalBusiness par ville sans établissement | confirmée | section 5 : 462 `LocalBusiness` avec adresse de ville, 462 `EmergencyService`, 506 sans adresse ; même téléphone partout ; 3 adresses de siège contradictoires |
| H5 : signal de qualité global PT abaissé | plausible, non mesurable dans le code | signaux contradictoires (2300 avis / 4,9 contre « plataforma jovem »), avis auto-balisés, blog sans auteur réel ni `dateModified`, `FAQPage` sur 1005 pages, 4 anciennes URL en 404 ; le taux d'indexation du blog (41 %) est une donnée GSC |
| H6 : faible demande de crawl, lastmod figé | confirmée pour le lastmod ; demande de crawl non vérifiable | `lastmod` = `contentUpdatedAt` de mai 2026 pour 1430 URL (section 3) ; la fréquence de Googlebot relève des journaux Cloudflare ou de GSC |
| H7 : profondeur et maillage insuffisants (perto-de-mim) | confirmée | section 7 : hub lié par le seul plan HTML, 151/506, accueil 12 villes et 0 hub, profondeur 4-5 mesurée |
| H8 : hubs trop faibles ou trop denses | confirmée | `/pt/servicos/` 552 liens pour un texte recopié des pages de grille, `/pt/urgencia/` 504, `/pt/cidade/` 505, `/pt/especialidades/` 274 mots et 6 cartes vers la même URL, `/pt/perto-de-mim/` 562 mots et 151/506 |

## 11. Anomalies annexes relevées (à traiter dans les phases 1 et 3)

1. Gabarits non substitués : `service.urgencyText` rendu brut avec `{city}` (servicos 289, perto-de-mim 417) pour serralheiro, vidraceiro, ar-condicionado ; `urgency.immediateSteps` bruts (urgencia 246) pour 7 métiers ; `faqs[0].answer` brut (perto-de-mim 567) pour jardineiro, limpeza-espacos, estores-portoes.
2. Pluriel naïf sur urgencia (313 : « pladur e tetos falsoss », « faz tudos ») alors que `pluralizarServico` existe (`lib/seo/pt-pluralize.ts:45-47`).
3. `FAQPage` de perto-de-mim différente du HTML visible (204 contre 534).
4. `ItemList` de `/pt/urgencia/` incohérent (462 annoncés, 21 listés).
5. Deux manifests déclarés (`app/layout.tsx:231` et `app/pt/layout.tsx:25`) ; `<main>` imbriqué sur `/pt/especialidades/`.
6. `/pt/sobre/` : `page.tsx` écrase le `layout.tsx` et perd le hreflang ; bouton contact vers les mentions légales.
7. Offre partenaire 29 € (`torne-se-parceiro`) contre 49 €/mês (accueil).
8. Pages juridiques `noindex` listées dans le plan HTML et le pied de page (acceptable pour le pied de page, règle 1.3).
9. `/pt/pro/tarifs/`, `/pt/pro/faq/`, `/pt/pro/register/`, `/pt/auth/login/` : liées depuis chaque page mais interdites par `robots.txt` (`app/robots.ts:15-20`).
10. Blocs « Intervenções recentes » (66 pages servicos) présentés comme des travaux réalisés alors qu'il s'agit de chaînes statiques ; avis et témoignages codés en dur sur l'accueil, `/pt/profissionais-verificados/` et `/pt/torne-se-parceiro/` ; « Mais de 2 300 avaliações » sans source. Tous contraires à la règle 0.2 des instructions (aucune donnée inventée) : à retirer ou à remplacer par des données réelles en phase 1 ou 3.
11. Blog : `datePublished` antidatées (articles créés le 18/03/2026, dates affichées depuis le 15/11/2025), auteur « Equipa editorial Vitfix » sans page auteur, `searchVolume` interne en français dans les données.
12. `picheleiro` traité de deux façons contradictoires : redirigé vers `canalizador` pour servicos, urgencia et prix, mais servi comme 23 pages auto-canoniques sous `/pt/perto-de-mim/` (`app/pt/perto-de-mim/[slug]/page.tsx:27-39, 110`).

## 12. Méthode de la phase 0 et vérification des guides Google

- Lecture du code par 8 lecteurs indépendants (routes de grille ; hubs et pages statiques ; données source ; sitemaps et redirections ; JSON-LD et métadonnées ; navigation et maillage ; base de données ; tests et documentation existants), puis contre-expertise contradictoire des verdicts H1 à H8 par deux relecteurs par hypothèse, et contrôle de complétude. Les comptes rendus bruts sont conservés hors dépôt ; seules les preuves recoupées figurent ici.
- Les règles Google citées en section 2 des instructions ont été relues le 13/10/2026 sur les URL de leur section 10 (politiques anti-spam, contenu utile, guide IA, consolidation, sitemaps, budget d'exploration, hreflang, `LocalBusiness`, règles des données structurées, journal des modifications, tableau de bord des mises à jour, aide GSC). Résultat de cette relecture : voir le paragraphe « Vérification des guides Google » ci-dessous, complété à la fin de la contre-expertise.

### Vérification des guides Google (13/10/2026)

En cours de consolidation (lecteurs des guides). Les lecteurs du code ont déjà cité, en les relisant, la politique « doorway abuse » (pages par ville substantiellement similaires), « scaled content abuse » (synonymisation, pages sans valeur ajoutée), la règle `LocalBusiness` (`address` requise = emplacement physique) et l'inéligibilité des avis auto-balisés (review snippet).

## 13. Décisions propriétaire (bloquantes)

### DECISION PROPRIETAIRE 1 : consolidation des 3 modèles

Recommandation : option A, une seule URL par couple métier x ville, le modèle `servicos`, les 946 pages urgencia et perto-de-mim métier x ville (dont 22 picheleiro) et le hub `picheleiro` redirigés en 301 (308 Next.js).

| Donnée | servicos | urgencia | perto-de-mim |
|---|---|---|---|
| Clics PT de septembre 2026 (export GSC) | 312 | 54 | 109 |
| Part non indexée au 09/10 | 54 % | 72 % | 57 % |
| Pages P1 (non indexées avec clics) | 51 (82 clics) | 15 (17 clics) | 25 (32 clics) |
| Pages PROTEGER (indexées avec clics) | voir CSV | voir CSV | voir CSV |
| Texte propre au modèle (audit) | 7,0 % | 4,6 % | 4,0 % |
| Chevauchement avec servicos du même couple | | 38 % / 46 % | 16 % / 27 % (picheleiro contre canalizador : 78 %) |
| hreflang | oui (générique) | oui (générique) | aucun |
| Profondeur depuis `/pt/` | 2-3 | 2-4 | 4-5 |

Option B (garder les 3 modèles, `noindex,follow` hors sitemap pour les couples sans données locales) : garde 946 URL faibles en ligne et s'appuie sur `noindex`, que Google déconseille comme outil de gestion. À ne retenir que si une raison métier impose les 3 modèles.

### DECISION PROPRIETAIRE 2 : URL des 22 hubs métier

Recommandation : garder `/pt/perto-de-mim/{metier}/` (2 hubs indexés : canalizador, estores-portoes ; 20 non indexés ; URL connues de Google ; déplacement vers `/pt/servicos/{metier}/` possible après récupération). Le hub `picheleiro` est redirigé vers `canalizador` dans tous les cas.

### DECISION PROPRIETAIRE 3 : adresse réelle et établissements

Le code publie trois adresses contradictoires et aucune n'a de rue : Porto 4000-001 (`app/pt/page.tsx:49`), Marco de Canaveses (`app/contact/page.tsx:58-63`), « Sede : Portugal » (`app/pt/avisos-legais/page.tsx:29`). L'entité du code est « VITFIX — Empresário em Nome Individual, NIF 276 873 297 » (`app/layout.tsx:274`, `app/pt/termos/page.tsx:200`) alors que les instructions citent « VITFIX CONSTRUÇÕES, LDA ». À fournir : raison sociale, NIF, adresse postale complète du siège, téléphone de réponse réel, horaires réels de réponse (ou absence), et confirmation qu'aucun établissement physique n'existe dans les 22 villes. Sans cette réponse, le point 1.6 de la phase 1 ne peut pas être finalisé.

### DECISION PROPRIETAIRE 4 : données réelles pour la phase 3

Le dépôt ne contient aucun chantier, devis, délai ni avis réel exploitable. Les tables `bookings`, `devis`, `factures`, `booking_reviews` et `profiles_artisan` (colonne `country`) existent en production : fournir une extraction au format de la section 3.3 des instructions (`data/seo/local-proof.json` : chantiers par ville avec type, quantité, mois ; prix réels par métier avec exemples ; délais constatés ; avis avec autorisation écrite). Sans données pour une ville ou un métier, la page correspondante sera redirigée vers la page ville ou le hub (règle de la section 9 des instructions), pas remplie.

Décisions annexes à prendre en même temps : `/pt/pro/tarifs/` (page `index` mais interdite par `robots.txt` : débloquer ou retirer les liens) ; fiches `/pt/profissional/{slug}/` (`noindex,nofollow`) : laisser tel quel en phase 1 ; slug de contact : `/pt/contacto/` recommandé, `/pt/contact/` en 301.
