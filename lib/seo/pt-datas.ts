// Dates de dernière modification significative des pages PT, pour `<lastmod>` des sitemaps
// (phase 1 du plan SEO PT, point 1.1). Jamais la date de build : une date réelle, écrite à
// la main à chaque mise en production qui change le contenu ou les balises d'un groupe de
// pages, et consignée dans docs/seo/journal-pt.md. Une page sans date fiable n'a pas de
// `<lastmod>` (le helper omet la balise quand la valeur est vide).
//
// Historique (git) : création des routes et des données le 18/03/2026 (3c3596aa),
// enrichissement des villes les 07/05, 09/05 et 05/06/2026, gabarits de grille le 05/06/2026
// (5f7941b1), liens prix le 06/10/2026 (88570e5b).

/** Mise en production de la phase 1 : title, description, hreflang et JSON-LD de toutes les pages PT. */
export const DATA_FASE_1 = '2026-10-13'

// Grille, villes et pages statiques : toutes ont vu leur title, description, hreflang ou JSON-LD
// changer le 13/10/2026. Les articles de blog portent leur propre date (dateModified, sinon
// datePublished, lib/data/seo-pages-data.ts) ; `blog` ne vaut que pour l'index /pt/blog/.
export const DATAS_PT = {
  servicos: DATA_FASE_1,
  urgencia: DATA_FASE_1,
  pertoDeMim: DATA_FASE_1,
  cidades: DATA_FASE_1,
  blog: DATA_FASE_1,
  paginas: DATA_FASE_1,
} as const
