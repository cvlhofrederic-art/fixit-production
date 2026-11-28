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
 * HISTORIQUE, plus lue par le code depuis le 28/10/2026 : ne plus l'avancer. Date du CONTENU de la page
 * /pt/servicos/limpeza-de-telhados/ et de ses pages concelho (textes, prix, délai) du 22/10/2026 (PR #529) jusqu'à
 * l'extension de la zone ; ce contenu porte depuis DATA_ZONA_DISTRITOS (champ `dataModificacao` du service). Pour une
 * modification ultérieure, voir la consigne sous DATA_ZONA_DISTRITOS. Les chantiers, notes et relectures portent leur
 * propre date, et les cartes de liens de la page de district aussi (champ `dataModificacaoLigacoes` du service) : le
 * gabarit des pages concelho ne les affiche pas, leur ajout ne change donc que le lastmod de la page de district. Les deux
 * cartes vers renovação de fachadas et trabalhos verticais (23/10/2026) portent DATA_LIGACOES_FACHADAS_TV.
 */
export const DATA_PAGINAS_DISTRITO = '2026-10-22'

/**
 * Date d'ajout des LIENS vers la page limpeza de telhados : pages telhador et impermeabilizacao des 18 concelhos du
 * distrito do Porto, leurs deux hubs, les 18 pages ville du distrito, /pt/servicos/ et /pt/mapa-do-site/. Chaque page de
 * district a sa propre date de liens (champ `dataLigacoes`) : une page qui en lie plusieurs prend la plus récente, et une
 * page qui lie une page concelho prend en plus la date d'ouverture de celle-ci (lib/sitemap-pt-pages.ts,
 * dataLigacoesConcelho). Mise en production le 22/10/2026 (PR #529). Depuis le 28/10/2026, elle ne vaut plus que pour les
 * pages telhador et impermeabilizacao du distrito do Porto (`dataLigacoesGrelha.Porto` : lien et ancre inchangés) ; les
 * hubs, les pages ville et les pages statiques portent DATA_ZONA_DISTRITOS (titre et résumé de la page changés).
 */
export const DATA_LIGACOES_DISTRITO = '2026-10-22'

/**
 * HISTORIQUE, plus lue par le code depuis le 28/10/2026 : ne plus l'avancer. Date du CONTENU des pages de district
 * renovação de fachadas et trabalhos verticais (gel A0 levé le 20/10/2026, faits confirmés par le propriétaire du 20 au
 * 23/10/2026), mises en production le 23/10/2026 (PR #536), jusqu'à l'extension de la zone ; ce contenu porte depuis
 * DATA_ZONA_DISTRITOS (champ `dataModificacao`). Pour une modification ultérieure, voir la consigne sous DATA_ZONA_DISTRITOS.
 */
export const DATA_PAGINAS_FACHADAS_TV = '2026-10-23'

/**
 * Date d'ajout des LIENS vers renovação de fachadas et trabalhos verticais : pages pintor, impermeabilizacao, pedreiro,
 * isolamento-termico et limpeza-condominio des 18 concelhos du distrito do Porto et leurs cinq hubs, les 18 pages ville du
 * distrito, /pt/servicos/, /pt/mapa-do-site/ et la page limpeza de telhados (ses deux cartes de liens, champ
 * `dataModificacaoLigacoes` : lastmod de la page de district seulement, pas de ses pages concelho). Mise en production le
 * 23/10/2026 (PR #536). Depuis le 28/10/2026, elle ne vaut plus que pour les pages de la grille du distrito do Porto
 * (`dataLigacoesGrelha.Porto`) et les cartes de la page limpeza de telhados ; le reste porte DATA_ZONA_DISTRITOS.
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
 * métier isolamento-termico, sur ses 22 pages métier x ville et sur son hub /pt/perto-de-mim/isolamento-termico/ (question
 * « Quanto custa… » du hub) ; délai de retour retiré de sa réponse « O isolamento térmico paga-se a si próprio? » (27/10/2026).
 * Le 28/10/2026, le propriétaire confirme les mêmes prix à Braga, Aveiro et Ovar : leur réponse sans prix est retirée et la
 * zone dite avec le prix devient « distrito do Porto e concelhos de Braga, Aveiro, Ovar e Águeda », donc la date avance sur
 * les 22 pages, le hub et les deux articles touchés (capoto-isolamento-termico-quanto-custa, humidade-parede-causas-reparacao),
 * qui portent la même date dans leur `dateModified`. Mis en production le 28/10/2026 (PR #571). La zone dite avec le prix a
 * changé encore le même jour (DATA_ZONA_DISTRITOS) : ces pages prennent la plus récente des deux dates.
 */
export const DATA_PRECO_CAPOTO = '2026-10-28'

/**
 * Zone de l'équipe VITFIX confirmée par le propriétaire le 28/10/2026 : tous les concelhos des distritos do Porto, de Braga
 * et de Aveiro, pour la limpeza de telhados, la renovação de fachadas, les trabalhos verticais et le capoto neuf, visite en
 * 48 heures au maximum et mêmes prix partout. Les trois pages de district (lib/data/pt-servicos-distrito.ts, `distritos`)
 * couvrent désormais ces trois distritos, sans changer d'URL. Pages datées de ce jour, et seulement elles :
 * - les trois pages de district (titre, description, H1, introduction, zone, appel final, JSON-LD `areaServed`) ;
 * - les pages qui affichent leur titre, leur résumé ou la phrase de zone (champ `dataLigacoes`) : les 22 pages ville, les
 *   hubs des metiersLigados (telhador, impermeabilizacao, pintor, pedreiro, isolamento-termico, limpeza-condominio),
 *   /pt/servicos/ et /pt/mapa-do-site/ ;
 * - les pages de la grille des metiersLigados dans les distritos de Braga et de Aveiro (Braga, Aveiro, Ovar, Águeda), qui
 *   reçoivent les liens (champ `dataLigacoesGrelha`) ; celles du distrito do Porto gardent leur date (lien et ancre
 *   inchangés) ;
 * - /pt/precos/pintor/ (phrase qui situe la page renovação de fachadas) ;
 * - la réponse « Quanto custa aplicar capoto por m²? » (22 pages isolamento-termico et leur hub) et les deux articles qui
 *   disent la zone avec le prix (capoto-isolamento-termico-quanto-custa, humidade-parede-causas-reparacao : `dateModified`).
 * Même lot, même jour (demande du propriétaire du 28/10/2026, page limpeza de telhados pour Águeda, Aveiro et le distrito de
 * Aveiro sans liste de lieux) : H1 et description de limpeza de telhados avec « lavagem » et « impermeabilização », section
 * « O que muda no telhado de uma zona para outra » (champ `condicoesLocais`) ; résumé repris par les 22 pages ville, déjà
 * datées de ce jour. Les liens des trois pages d'Águeda vers limpeza de telhados portent DATA_LIGACOES_AGUEDA_TELHADOS.
 * À reporter seulement au jour réel de la fusion de ce lot, et à consigner dans docs/seo/journal-pt.md. Ensuite, ne plus
 * l'avancer : elle date 78 URL (test pt-zona-tres-distritos), dont la plupart ne changent pas quand le contenu d'une page
 * de district change. Pour toute modification ultérieure de ce contenu (texte, ou prix et délai d'une ligne `precos` ou
 * `prazos` de data/seo/local-proof.json), créer une nouvelle constante datée et la mettre dans `dataModificacao` des seuls
 * services touchés (lib/data/pt-servicos-distrito.ts) ; une modification des liens ou de leur texte prend de même une
 * nouvelle constante dans `dataLigacoes`.
 */
export const DATA_ZONA_DISTRITOS = '2026-10-28'

/**
 * Liens vers /pt/servicos/limpeza-de-telhados/ ajoutés le 28/10/2026 sur les trois pages d'Águeda (demande du propriétaire :
 * toucher Águeda et le distrito de Aveiro sans page satellite ni liste de lieux), dans leurs blocs de liens existants :
 * /pt/servicos/limpeza-de-terrenos-agueda/ et /pt/servicos/terraplanagem-agueda/ (cartes `ligacoes`, champ `dataModificacao`
 * de lib/data/pt-servicos-concelho.ts), /pt/servicos/poda-arvores-agueda/ (« Serviços relacionados », champs
 * `servicosDistrito` et `dataServicosDistrito` de CityData.serviceCityOverrides). Date de ces trois pages seulement : la page
 * ville d'Águeda et ses autres pages métier x ville ne changent pas. Même lot que DATA_ZONA_DISTRITOS : à reporter avec elle
 * au jour réel de la fusion, et à consigner dans docs/seo/journal-pt.md ; ensuite, ne plus l'avancer.
 */
export const DATA_LIGACOES_AGUEDA_TELHADOS = '2026-10-28'

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
