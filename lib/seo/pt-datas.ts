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
 * et des hubs des métiers de METIERS_URGENCIA (lib/seo/pt-meta.ts : les 21 depuis la décision du 14/10) ;
 * appliquée URL par URL dans lib/sitemap-pt-pages.ts, une page d'un métier retiré de la liste gardant
 * DATA_FASE_3. À aligner sur le jour de sa mise en production si elle diffère de celle du lot 0.
 */
export const DATA_FASE_3_LOT_1 = '2026-10-14'

/**
 * Pages de district (gel A0 levé le 20/10/2026, lib/data/pt-servicos-distrito.ts) : date du CONTENU de la page
 * /pt/servicos/limpeza-de-telhados/ et de ses pages concelho (textes, prix, délai). À avancer au jour de la mise en
 * production de toute modification de ce contenu (y compris un prix ou un délai de data/seo/local-proof.json), et à
 * consigner dans docs/seo/journal-pt.md. Les chantiers, notes et relectures portent leur propre date, et les cartes de
 * liens de la page de district aussi (champ `dataModificacaoLigacoes` du service) : le gabarit des pages concelho ne les
 * affiche pas, leur ajout ne change donc que le lastmod de la page de district. Les deux cartes vers renovação de fachadas
 * et trabalhos verticais (23/10/2026) portent DATA_LIGACOES_FACHADAS_TV.
 */
export const DATA_PAGINAS_DISTRITO = '2026-10-22'

/**
 * Date d'ajout des LIENS vers la page limpeza de telhados : pages telhador et impermeabilizacao des 18 concelhos du
 * distrito do Porto, leurs deux hubs, les 18 pages ville du distrito, /pt/servicos/ et /pt/mapa-do-site/. Chaque page de
 * district a sa propre date de liens (champ `dataLigacoes`) : une page qui en lie plusieurs prend la plus récente, et une
 * page qui lie une page concelho prend en plus la date d'ouverture de celle-ci (lib/sitemap-pt-pages.ts,
 * dataLigacoesConcelho). Mise en production le 22/10/2026 (PR #529).
 */
export const DATA_LIGACOES_DISTRITO = '2026-10-22'

/**
 * Pages de district renovação de fachadas et trabalhos verticais (gel A0 levé le 20/10/2026, faits confirmés par le
 * propriétaire du 20 au 23/10/2026) : date du CONTENU des deux pages. Mise en production prévue le 23/10/2026 : à reporter
 * au jour réel de la fusion, et à avancer à chaque modification de leur contenu.
 */
export const DATA_PAGINAS_FACHADAS_TV = '2026-10-23'

/**
 * Date d'ajout des LIENS vers renovação de fachadas et trabalhos verticais : pages pintor, impermeabilizacao, pedreiro,
 * isolamento-termico et limpeza-condominio des 18 concelhos du distrito do Porto et leurs cinq hubs, les 18 pages ville du
 * distrito, /pt/servicos/, /pt/mapa-do-site/ et la page limpeza de telhados (ses deux cartes de liens, champ
 * `dataModificacaoLigacoes` : lastmod de la page de district seulement, pas de ses pages concelho). À aligner sur le jour
 * de la mise en production.
 */
export const DATA_LIGACOES_FACHADAS_TV = '2026-10-23'

/**
 * Pages de service du concelho d'Águeda (lib/data/pt-servicos-concelho.ts, demande du propriétaire du 21/10/2026) :
 * date des deux pages, de la page ville d'Águeda et des 21 pages métier x ville d'Águeda (freguesias et population
 * corrigées, liens vers les nouvelles pages). Mise en production le 23/10/2026 (heure de Lisbonne) : à reporter si la fusion a lieu un autre jour.
 */
export const DATA_PAGINAS_AGUEDA = '2026-10-23'

/**
 * Corrections de FAQ : réponse « Preciso de autorização para cortar uma árvore? » du métier poda-arvores (pages métier x
 * ville et hub) ; réponse « Quanto custa… » des hubs poda-arvores et faz-tudo, qui affichaient la première FAQ du métier
 * au lieu de sa question de prix. Mise en production le 23/10/2026 : à reporter si la fusion a lieu un autre jour.
 */
export const DATA_CORRECOES_FAQ = '2026-10-23'

/**
 * Page /pt/precos/pintor/ : ligne « Pintura exterior fachada » et fourchette de façade du contexte régional retirées
 * (décision du propriétaire du 23/10/2026 : « Pas de prix, devis » pour la peinture et la rénovation de façade), phrase
 * qui renvoie à la page renovação de fachadas. Vaut aussi pour le hub /pt/precos/, dont la carte pintor passe de 9 à 8
 * services (conséquence directe de la même décision). Date propre à ces deux pages seulement (les guides canalizador et
 * eletricista gardent DATA_FASE_3). À aligner sur le jour de la mise en production, et à consigner dans
 * docs/seo/journal-pt.md.
 */
export const DATA_PRECOS_PINTOR = '2026-10-23'

/**
 * Prix réel du capoto (équipe VITFIX, 53 à 58 €/m² sans IVA, matériel et main-d'œuvre compris, donné par le propriétaire en
 * octobre 2026) à la place de la fourchette de référence 40-80 €/m² : réponse « Quanto custa aplicar capoto por m²? » du
 * métier isolamento-termico, avec la zone de l'équipe (distrito do Porto et concelhos de Braga, Aveiro, Ovar et Águeda), sur ses
 * 22 pages métier x ville et sur son hub /pt/perto-de-mim/isolamento-termico/ (question « Quanto custa… » du hub). Le 28/10/2026,
 * le propriétaire confirme les mêmes prix à Braga, Aveiro et Ovar : la réponse sans prix de ces trois villes est retirée et la
 * zone dite avec le prix s'élargit, donc la date avance pour toutes ces pages ; délai de retour retiré de sa réponse « O isolamento térmico paga-se a si próprio? ». Les 22 pages
 * métier x ville changent donc toutes. Les deux articles touchés (capoto-isolamento-termico-quanto-custa,
 * humidade-parede-causas-reparacao) portent la même date dans leur `dateModified`. À aligner sur le jour de la mise en
 * production, et à consigner dans docs/seo/journal-pt.md.
 */
export const DATA_PRECO_CAPOTO = '2026-10-28'

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
