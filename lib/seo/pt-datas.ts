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

/**
 * Phase 2 (consolidation) : bloc « Urgência » et liens des pages servicos, hubs métier réécrits
 * (22 pages ville liées), hubs de section /pt/servicos/, /pt/urgencia/ et /pt/perto-de-mim/,
 * liens des pages ville. À aligner sur le jour de la mise en production (docs/seo/journal-pt.md).
 */
export const DATA_FASE_2 = '2026-10-13'

/**
 * Phase 3, lot 0, et phase 4 (maillage) : textes de méthode par métier sur les pages servicos et les
 * hubs, liens de maillage (page ville, hub, métiers liés, villes voisines recalculées), freguesias
 * en prose ; pages ville (liens voisins) ; pages statiques réécrites listées dans
 * lib/sitemap-pt-pages.ts (PAGINAS_FASE_3). À aligner sur le jour de la mise en production.
 */
export const DATA_FASE_3 = '2026-10-14'

/**
 * Phase 3, lot 1 : « urgências » dans les titres, descriptions, JSON-LD et l'en-tête des pages métier x ville
 * et des hubs des seuls métiers d'urgence (METIERS_URGENCIA, lib/seo/pt-meta.ts) ; appliquée URL par URL dans
 * lib/sitemap-pt-pages.ts, les autres pages gardant DATA_FASE_3. À aligner sur le jour de sa mise en
 * production si elle diffère de celle du lot 0.
 */
export const DATA_FASE_3_LOT_1 = '2026-10-14'

// Les articles de blog portent leur propre date (dateModified, sinon datePublished,
// lib/data/seo-pages-data.ts) ; `blog` ne vaut que pour l'index /pt/blog/. `paginas` est la date
// par défaut des pages statiques, surchargée par page dans lib/sitemap-pt-pages.ts.
export const DATAS_PT = {
  servicos: DATA_FASE_3,
  hubs: DATA_FASE_3,
  cidades: DATA_FASE_3,
  blog: DATA_FASE_1,
  paginas: DATA_FASE_1,
} as const
