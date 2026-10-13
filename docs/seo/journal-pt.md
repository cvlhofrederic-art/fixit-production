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
| 2026-10-13 | 0 | Inventaire du code (`docs/seo/pt-inventaire.md`), script d'audit `scripts/seo/pt-audit`, tests T1 à T12 (`scripts/seo/pt-tests.mjs`), CSV de référence copiés dans `data/seo/`, journal créé, décisions propriétaire 1 à 4 posées | aucune (lecture seule) | PR documentation, aucun effet en ligne |
