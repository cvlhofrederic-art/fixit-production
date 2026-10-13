# Outillage SEO PT (`scripts/seo/`)

Livré en phase 0 du plan de réindexation des pages `/pt/` (instructions du 13/10/2026, `docs/seo/instructions-seo-pt-2026-10-13.md`, sections 7 et 8). Node 20+, aucune dépendance.

## Script de mesure : `pt-audit`

```bash
node scripts/seo/pt-audit/index.mjs --git
```

Entrée : les sitemaps en ligne (`/sitemap.xml` et ses enfants, `/pt/sitemap.xml`), plus `/pt/cidade/` et `/pt/contact/` (indexables hors sitemap). `--source csv` prend à la place la liste de `data/seo/pt_sitemap_statut_complet.csv` (base du 13/10/2026).

Sortie dans `reports/seo/` :

- `pt-audit-{date}.csv` : une ligne par URL. Statut HTTP, URL finale, `X-Robots-Tag`, meta robots, canonique, `title` et longueur, nombre de mentions de la marque, `meta description` et longueur, nombre de `h1` et `h2`, hreflang, `og:image`, types JSON-LD avec présence d'`address` et de `geo`, mots du `<main>`, liens internes, liens vers `/pt/profissional/`, liens sans préfixe de langue, liens sans barre finale, liens entrants, profondeur depuis `/pt/`, `lastmod` du sitemap, date du dernier commit des fichiers source (`--git`), et le recoupement GSC du CSV de référence (`statut_gsc`, clics, impressions, priorité).
- `pt-audit-{date}.json` : les mêmes données, consommées par `pt-tests.mjs --audit`. Volumineux (environ 11 Mo), non versionné (`reports/seo/*.json` dans `.gitignore`) : le régénérer localement avant de lancer les tests avec `--audit`, ou lancer `pt-tests.mjs` sans `--audit` pour qu'il refasse l'audit lui-même.
- `pt-audit-{date}-resume.md` : synthèse par groupe, comparaison indexées / non indexées, mesures de contenu, motifs hreflang et JSON-LD, liens fautifs, profondeur, hubs.

Mesures de contenu (méthode du rapport, section 11) : séquences glissantes de 5 mots du texte de `<main>`, `df` = nombre de pages du modèle contenant la séquence, `propre` = part des séquences avec `df == 1`, `partage10` = part avec `df >= 10`. Deux périmètres : le modèle entier (`propre_modele`, 462 pages servicos par exemple) et les 22 villes d'un même métier (`propre_metier`). Valeurs de contrôle du 13/10/2026 : servicos `propre` 9,0 % (indexées) et 9,1 % (non indexées), `partage10` 88 % ; canalizador 22 villes `propre` 29,7 %, `partage10` 67,1 %.

Options : `--base` (défaut `https://vitfix.io`), `--out`, `--concurrence` (8), `--echantillon N` (N URL par groupe, pour un passage rapide), `--git`, `--date`.

Limites : analyse HTML par expressions régulières (suffisant pour le HTML généré par Next.js) ; le graphe ne connaît que les pages auditées comme sources ; `derniere_modif_reelle` est la date du dernier commit des fichiers qui produisent la page (`lib/data/seo-pages-data.ts` et la route), pas la date de modification de la seule entrée concernée.

## Tests T1 à T12 : `pt-tests.mjs`

```bash
# État des lieux et référence (une fois, avant la phase 1)
node scripts/seo/pt-tests.mjs --mode reference

# Porte de PR / contrôle après mise en production (code de sortie 1 si un test échoue)
node scripts/seo/pt-tests.mjs --mode controle

# Réutiliser un audit déjà calculé, limiter aux tests voulus
node scripts/seo/pt-tests.mjs --audit reports/seo/pt-audit-2026-10-13.json --tests T1,T2,T6
```

| Test | Vérifie | Données |
|---|---|---|
| T1 | chaque URL des sitemaps PT : 200, index (meta et `X-Robots-Tag`), canonique = URL, HTML | audit |
| T2 | chaque URL dans exactement 1 sitemap ; 0 noindex/3xx/4xx ; `lastmod` ISO ≤ maintenant ; 0 `priority`/`changefreq` ; enfants PT référencés dans l'index ; empreintes SHA-256 de `/sitemap/2.xml` et `/sitemap/3.xml` identiques à la référence | audit + référence |
| T3 | cibles de tous les liens internes des pages PT en 200 ; 0 lien sans préfixe de langue ; 0 lien sans barre finale | audit + requêtes |
| T4 | chaque alternate hreflang répond 200, renvoie vers la page PT, n'est pas une page générique ; x-default en 200 | audit + requêtes |
| T5 | JSON-LD sur 1 page par modèle + 20 pages (échantillon déterministe) : valide, 0 `FAQPage`, 0 `HowTo`, 0 nœud entreprise par ville, 1 nœud entreprise avec `address`, `Service` avec `provider` et `areaServed` sur la grille, `BreadcrumbList` cohérent avec les liens visibles, 0 `aggregateRating` auto-attribué | audit |
| T6 | marque une fois dans le `title`, `title` 35-65, description 80-160 et unique, 1 `h1` | audit |
| T7 | profondeur ≤ 3 depuis `/pt/` pour les pages conservées ; 0 orpheline ; chaque page ville lie ses pages métier ; chaque hub métier lie ses 22 villes | audit |
| T8 | `data/seo/pt-redirects.csv` (phase 2, colonnes `source,destination,code[,decision]`) : 301 (ou 308 Next.js) en un saut, destination 200 index auto-canonique, 0 chaîne, 0 boucle, `PROTEGER` avec décision | fichier + requêtes ; N/A tant que le fichier n'existe pas |
| T9 | 30 URL FR de `/sitemap/2.xml` : statut, canonique, `title`, hreflang identiques à la référence ; empreinte du sitemap identique | référence |
| T10 | `data/seo/porte-qualite.json` (phase 3) : sections obligatoires par `id`, séquences propres ≥ seuil, 0 bloc de villes | fichier + audit ; N/A tant que le fichier n'existe pas |
| T11 | robots.txt : `/pt/servicos/canalizador-ovar/` autorisée ; `og:image` de 5 pages non bloquée ; règles hors PT identiques à la référence | requête + référence |
| T12 | chemin inconnu sous `/pt/` et sans préfixe : 404 final avec `noindex`, jamais `/pt/` | requêtes |

La référence (`data/seo/reference-seo-pt.json`) est écrite par `--mode reference` : empreintes des sitemaps FR, mesures des 30 URL FR, règles robots hors PT. Elle ne doit être régénérée que si un changement FR voulu a eu lieu.

Précaution : le CDN garde les pages SEO en cache 1 h (`Cache-Control: public, s-maxage=3600`) ; après une mise en production, attendre l'expiration ou purger avant de lancer `--mode controle`.
