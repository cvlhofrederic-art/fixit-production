# Journal SEO PT — vitfix.io

Règle 0.10 des instructions du 13/10/2026 : chaque changement touchant `/pt/` est consigné ici (date, changement, URL concernées, date de mise en production) pour lire les courbes Google Search Console (GSC).

## Gel immédiat (A0, en vigueur depuis le 13/10/2026)

- Ne créer aucune page métier x ville, aucune nouvelle ville, aucun nouveau métier avant la fin de la phase 3.
- Ne pas changer l'URL d'une page `PROTEGER` (colonne `priorite` de `data/seo/pt_sitemap_statut_complet.csv`) sans 301 testée.
- Ne pas modifier les `lastmod` sans changement réel de contenu.
- Pas de `noindex` en masse, pas d'alternance `noindex` / `index`, pas de double changement d'URL.
- Pas de « Demander une indexation » en masse (réservé aux 40 URL de la phase 5).
- Aucune donnée inventée (prix, délais, professionnels, avis, chantiers, adresses) ; aucune génération de texte en masse.
- Pages et sitemaps FR, EN, ES, NL intacts (contrôle T9 à chaque phase), hors les 3 exceptions de la phase 1.

## Référence du 13/10/2026 (avant toute modification)

| Indicateur | Valeur |
|---|---|
| URL dans `/pt/sitemap.xml` | 1503 |
| Explorées, actuellement non indexées (sitemap PT, GSC du 09/10) | 910 |
| Noindex dans le sitemap PT | 3 (+1 en ligne) |
| Indexées déduites | 591 |
| Clics PT septembre 2026 (export GSC, 810 lignes PT) | 689 |
| Pages `PROTEGER` | 204 (555 clics) |
| Pages P1 | 93 (133 clics) |
| Empreinte SHA-256 `/sitemap/2.xml` | `22561fbc5793def3d0e2a78655c6decad6ff3e7f27da567ad887691c177d2356` |
| Empreinte SHA-256 `/sitemap/3.xml` | `039854cb5c214f8d90f152b7754445b75473b0abe744d84d6ae8b6ffb38ff291` |

## Entrées

| Date | Phase | Changement | URL concernées | Mise en production |
|---|---|---|---|---|
| 2026-10-13 | 0 | Inventaire du code (`docs/seo/pt-inventaire.md`), script d'audit `scripts/seo/pt-audit`, tests T1 à T12 (`scripts/seo/pt-tests.mjs`), CSV de référence copiés dans `data/seo/`, journal créé, décisions propriétaire 1 à 4 posées | aucune (lecture seule) | PR #510 fusionnée le 13/10/2026, aucun effet en ligne |
| 2026-10-13 | 1 | Hygiène technique. 1.1 sitemaps PT découpés par modèle (`/pt/sitemap-{servicos,urgencia,perto-de-mim,cidades,blog,paginas}.xml`, index `/pt/sitemap.xml` pour la propriété GSC `/pt/`, `/sitemap/1.xml` en 410, 4 pages juridiques `noindex` retirées, `/pt/cidade/` et `/pt/contacto/` ajoutés : 1501 URL) ; `lastmod` = 2026-10-13 sur toutes les URL PT (`lib/seo/pt-datas.ts`). 1.2 anciens articles : 4 en 301 vers l'article équivalent, 6 sans équivalent en 410 (`middleware.ts`), plus de redirection de `/m%C3%AAs/` vers `/pt/`. 1.3 entité unique `#business` (`lib/seo/entite-pt.ts`) : adresse réelle du siège, NIF 276 873 297, téléphone +351 912 014 971, `areaServed` = 22 concelhos. 1.4 titres sans marque + template `%s \| VITFIX` (65 caractères max), descriptions propres à chaque page (freguesias, population, distrito) de 120 à 155 caractères, uniques sur les 1452 pages de grille. 1.5 hreflang retiré de la grille et des pages sans équivalent FR, `x-default` sur `/fr/…`. 1.6 JSON-LD `Service` + `BreadcrumbList` (`lib/seo/pt-schemas.ts`) : plus de `LocalBusiness` par ville, `FAQPage`, `HowTo`, `EmergencyService`, `AggregateRating`, `Review`, `Offer`. 1.7 `robots.txt` : `Allow: /api/og/`. 1.8 `/pt/contact/` → `/pt/contacto/` (308), liens du pied de page, de l'accueil et du plan du site mis à jour. Règles internes alignées (`CLAUDE.md`, `product/decisions.md`, `docs/seo-audit-pt-structure.md` marqué périmé). | les 1501 URL PT du sitemap, 6 anciens articles (410), `/pt/contact/` (308), `/m%C3%AAs/` (404) | PR #511 fusionnée le 13/10/2026 (déploiement Cloudflare automatique à la fusion). GSC (compte cvlho.frederic) : `/pt/sitemap.xml` était déjà déclaré dans les propriétés `/pt/` et racine (1504 URL lues le 02/10/2026), `/sitemap/1.xml` jamais déclaré ; `/pt/sitemap.xml` soumis de nouveau dans les deux propriétés le 13/10/2026 après le déploiement (relu le jour même, 1503 URL découvertes) |
| 2026-10-13 | 1 (correctifs) | Relecture indépendante après fusion, 7 constats corrigés : 32 titres de grille coupés dans le nom de la ville (« em Marco de \| VITFIX ») : le nom du métier est raccourci, jamais la ville (`tituloComCidade`) ; « N freguesias » retiré des 1452 descriptions, des nœuds `Service` et des corps de page (la liste du dépôt n'est pas le décompte officiel) ; « distrito de Porto » → « distrito do Porto » (descriptions, `containedInPlace`, pages villes) ; « 22 concelhos do Norte » → « do Porto, Braga e Aveiro » (Aveiro et Águeda sont dans la Região Centro) ; `lastmod` du blog = date de chaque article (dateModified sinon datePublished), `fuga-agua-como-agir` daté du 13/10 ; hreflang non réciproque retiré de `/pt/empresa/{slug}/` ; `/fr/recherche/` retrouve son h1 visible (seul `/pt/pesquisar/` passe en h2). Deux constats réfutés : codes hreflang `pt`/`pt-PT` (paires réciproques en ligne) et équivalence des 301 (les anciens slugs n'ont jamais été des articles). | 1452 pages de grille (title, description, JSON-LD), 27 articles (`lastmod`), `/pt/urgencia/`, `/pt/cidade/*`, `/pt/empresa/*`, `/fr/recherche/` (retour à l'état d'avant la phase 1) | PR de correctifs `fix/seo-pt-phase-1-correctifs`, date de fusion à reporter ici |
