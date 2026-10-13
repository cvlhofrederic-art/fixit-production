# Brief pour Claude Code : pages PT non indexées sur vitfix.io

Date du brief : 13/10/2026. Périmètre : URL commençant par `/pt/` uniquement (FR, EN, ES, NL exclus).
Sources : Google Search Console (propriété `https://vitfix.io/`, rapport « Indexation des pages », données du 09/10/2026 lues le 13/10/2026, performances de septembre 2026), sitemaps et robots.txt en ligne, HTML en ligne (1471 pages PT téléchargées le 13/10/2026).

## 0. Objectif et fichiers

Objectif : faire indexer par Google les pages PT aujourd'hui rejetées, sans casser les pages PT qui reçoivent des clics. Ce brief donne les faits mesurés, les hypothèses à vérifier dans le code, un plan d'action priorisé et des critères d'acceptation. Les choix de structure (action A1) relèvent du propriétaire du site : proposer avec les chiffres, ne pas trancher seul.

| Fichier | Contenu |
|---|---|
| `pt_non_indexees.csv` | 944 URL PT non indexées + 11 lignes d'annexe sans préfixe `/pt/` : motif GSC, groupe, métier, ville, dernière exploration Google, données de septembre, état en ligne, priorité |
| `pt_sitemap_statut_complet.csv` | les 1503 URL du sitemap PT en ligne avec leur statut (non indexée, noindex, indexée déduite) et les données de septembre : sert à comparer les pages gardées et les pages rejetées par Google |

Ordre de lecture conseillé : section 1 (résumé), section 8 (hypothèses), section 9 (plan d'action), puis les deux CSV.

## 1. Résumé

1. **944 URL PT ne sont pas indexées.** Motif principal « Explorée, actuellement non indexée » (Google a exploré la page puis choisi de ne pas la garder) : 910 URL, soit 60,5 % du sitemap PT (1503 URL).
2. **La perte est récente et continue.** Périmètre sitemap PT : 335 URL non indexées le 24/07/2026, 913 le 09/10/2026. Indexées : 1169 puis 591 (section 4).
3. **Ce n'est pas un blocage technique.** Les 1430 pages de grille testées répondent toutes 200, avec `index,follow` et une canonique égale à leur URL. Aucune différence mesurable entre pages indexées et non indexées sur le texte, les liens ou la profondeur (sections 5.4 à 5.6).
4. **Hypothèse principale : contenu quasi dupliqué à grande échelle.** 95 % du sitemap PT (1430 sur 1503) vient de 3 modèles construits sur la même grille métier x ville. Sur chaque page, 88 à 92 % du texte est partagé avec au moins 10 autres pages du même modèle et 5 à 9 % seulement lui est propre.
5. **Les 3 modèles se concurrencent** sur la même intention (métier + ville) : urgencia 72 % non indexées, perto-de-mim 57 % (hubs métier 91 %), servicos 54 %.
6. **Un signal de qualité global est possible** : 11 articles de blog sur 27 ne sont pas indexés alors que leur texte est unique (74 %) et aussi long que celui des articles indexés.
7. **Priorités** : 335 des 910 URL figurent dans l'export de septembre (2997 impressions), dont 93 avec clics (133 clics). 204 pages indexées avec clics sont à protéger (555 clics).
8. **À corriger en parallèle** (peu probable comme cause principale, mais réel) : sitemaps, hreflang, balisage LocalBusiness, 404 du blog, liens sans préfixe `/pt/`.

## 2. Périmètre et définitions

« Non publiée » est lu comme « non indexée par Google » d'après GSC. Cinq motifs GSC concernent les URL PT :

| Motif GSC | Équivalent anglais | Origine |
|---|---|---|
| Explorée, actuellement non indexée | Crawled, currently not indexed | Décision de Google après exploration |
| Bloquée par le fichier robots.txt | Blocked by robots.txt | Site |
| Introuvable (404) | Not found (404) | Site |
| Page avec redirection | Page with redirect | Site |
| Exclue par la balise « noindex » | Excluded by noindex tag | Site |

Méthode : GSC plafonne chaque liste à 1000 lignes et son filtre « URL contient » ne s'applique qu'à ces 1000 lignes. Le périmètre PT complet a donc été isolé avec le filtre de sitemap `/pt/sitemap.xml` (913 non indexées : 910 explorées non indexées + 3 noindex). La liste des 910 a été lue en entier et vérifiée par empreinte. Les motifs plus petits ont ensuite été lus à l'échelle de la propriété.

Angle mort : GSC compte 1041 URL « explorées non indexées » hors sitemap PT, dont seules 1000 sont lisibles (970 FR, 4 PT). Jusqu'à 41 URL de langue inconnue ne sont pas visibles.

## 3. Inventaire : 944 URL PT, plus 11 en annexe

| Motif GSC | URL PT | Dans le sitemap PT (vue GSC) | Détail |
|---|---|---|---|
| Explorée, actuellement non indexée, dans le sitemap | 910 | 910 | section 5 |
| Explorée, actuellement non indexée, hors sitemap | 4 | 0 | 6.5 |
| Bloquée par robots.txt | 13 | 0 | 6.1 |
| Introuvable (404) | 9 | 0 | 6.2 |
| Page avec redirection | 1 | 0 | 6.3 |
| Exclue par noindex | 7 | 3 | 6.4 |
| **Total** | **944** | **913** | |
| Annexe : slug portugais sans préfixe `/pt/` | 11 | 0 | 6.6 |

Sur les 910, une URL (`/pt/mercados/gerir/`) est vue par GSC mais absente du sitemap en ligne au 13/10/2026 : 909 sont dans le sitemap en ligne (1503 URL).

## 4. Évolution (périmètre sitemap PT, source GSC)

| Date | Non indexées | Indexées | Total | Non indexées en plus par jour (depuis la ligne précédente) |
|---|---|---|---|---|
| 24/07/2026 | 335 | 1169 | 1504 | n.d. |
| 17/08/2026 | 345 | 1159 | 1504 | 0,4 |
| 28/08/2026 | 399 | 1105 | 1504 | 4,9 |
| 08/09/2026 | 496 | 1008 | 1504 | 8,8 |
| 19/09/2026 | 686 | 818 | 1504 | 17,3 |
| 30/09/2026 | 818 | 686 | 1504 | 12,0 |
| 09/10/2026 | 913 | 591 | 1504 | 10,6 |

Perte nette de 578 pages indexées en 77 jours. Le rythme a monté jusqu'au 19/09 (pic de 17 par jour entre le 08 et le 19/09), puis ralenti (12 puis 11 par jour) sans s'arrêter : +190 du 08/09 au 19/09, +132 du 19/09 au 30/09, +95 du 30/09 au 09/10. Le total reste constant (aucune URL ajoutée) : ce sont des pages devenues non indexées. Pour 78 % des 910 URL, la dernière exploration date d'avant le 01/08 (section 5.3) : Google a retiré ces pages de l'index sans les réexplorer (inférence).

Contexte externe, sans lien causal démontré : Google a déployé une « spam update » du 18 au 21/08/2026 puis du 24/09 au 08/10/2026, présentées comme des mises à jour de routine sans nouvelle politique annoncée. La hausse des non indexées démarre fin août, atteint son maximum du 08 au 19/09 (avant le début de la seconde mise à jour, le 24/09), puis ralentit sans s'arrêter. Sources en fin de document.

## 5. Analyse du motif principal (910 URL « explorée, actuellement non indexée »)

### 5.1 Par groupe

| Groupe | URL au sitemap PT en ligne | Non indexées | Part non indexée | Avec impressions en sept. | Dont avec clics (P1) | Clics sept. (P1) |
|---|---|---|---|---|---|---|
| servicos (métier x ville) | 462 | 248 | 53,7 % | 122 | 51 | 82 |
| urgencia (métier x ville) | 462 | 334 | 72,3 % | 74 | 15 | 17 |
| perto-de-mim (métier x ville) | 484 | 277 | 57,2 % | 129 | 25 | 32 |
| perto-de-mim (hubs métier) | 22 | 20 | 90,9 % | 0 | 0 | 0 |
| pages ville | 22 | 8 | 36,4 % | 2 | 0 | 0 |
| blog (articles) | 27 | 11 | 40,7 % | 8 | 2 | 2 |
| blog (index) | 1 | 0 | 0,0 % | 0 | 0 | 0 |
| hubs de section | 3 | 3 | 100,0 % | 0 | 0 | 0 |
| pages statiques | 10 | 5 | 50,0 % | 0 | 0 | 0 |
| precos | 4 | 1 | 25,0 % | 0 | 0 | 0 |
| mercados | 1 | 2 (dont 1 hors sitemap en ligne) | 100,0 % | 0 | 0 | 0 |
| pages juridiques | 4 | 1 | 25,0 % | 0 | 0 | 0 |
| recherche | 1 | 0 | 0,0 % | 0 | 0 | 0 |
| **Total** | **1503** | **910** | **60,5 %** | **335** | **93** | **133** |

Les 910 comprennent `/pt/mercados/gerir/`, vue par GSC mais absente du sitemap en ligne : 909 sont dans le sitemap en ligne. « Avec impressions en sept. » = présente dans l'export de septembre (plafonné à 1000 lignes, voir section 12). La part non indexée est calculée sur les URL du sitemap en ligne.

### 5.2 Par ville et par métier : répartition diffuse

Aucune ville et aucun métier n'est entièrement indexé ou entièrement rejeté.

- servicos : 6 à 16 non indexées par ville (sur 21), 8 à 18 par métier (sur 22).
- urgencia : 11 à 19 par ville (sur 21), 11 à 19 par métier (sur 22).
- perto-de-mim : 11 à 17 par ville (sur 22), 9 à 17 par métier (sur 22). Sur les 22 hubs métier, seuls `canalizador` et `estores-portoes` sont indexés.
- Les grandes villes ne sont pas épargnées : `/pt/servicos/canalizador-porto/` et `/pt/servicos/eletricista-porto/` sont non indexées alors que `/pt/servicos/canalizador-ovar/` (8 clics en septembre) est indexée.
- Lot de `lastmod` du sitemap (07/05, 09/05, 11/05) : 51,6 % non indexées (3 villes), 63,2 % (7 villes), 62,1 % (12 villes). Pas d'effet net.

### 5.3 Ancienneté de la dernière exploration par Google (910 URL)

| Mois de la dernière exploration | URL | Part | Cumul |
|---|---|---|---|
| mai 2026 | 151 | 16,6 % | 16,6 % |
| juin 2026 | 220 | 24,2 % | 40,8 % |
| juillet 2026 | 338 | 37,1 % | 77,9 % |
| août 2026 | 136 | 14,9 % | 92,9 % |
| septembre 2026 | 49 | 5,4 % | 98,2 % |
| octobre 2026 | 16 | 1,8 % | 100,0 % |
| **Total** | **910** | **100,0 %** |  |

752 des 910 URL (82,6 %) ont été explorées pour la dernière fois plus de 60 jours avant le 09/10/2026, 673 (74,0 %) plus de 90 jours. La médiane de dernière exploration tombe le 04 ou le 05/07/2026 pour les trois modèles de grille. Google ne revient presque plus sur ces pages. Le `lastmod` du sitemap (figé en mai) ne donne aucun signal de fraîcheur.

### 5.4 Pages indexées et non indexées : mêmes caractéristiques

Mesure sur 1430 pages de grille (HTML en ligne le 13/10/2026, texte de `<main>`). « Texte propre » = part des séquences de 5 mots absentes de toutes les autres pages du même modèle. « Partagé 10+ » = part des séquences présentes dans au moins 10 pages du modèle.

| Modèle | Statut | Pages | Mots | Liens | h2 | Texte propre | Partagé 10+ | 200, index, canonique propre |
|---|---|---|---|---|---|---|---|---|
| servicos | indexée | 214 | 609 | 52,2 | 9,4 | 9,0 % | 88,3 % | 100 % |
| servicos | non indexée | 248 | 635 | 52,7 | 9,6 | 9,1 % | 88,1 % | 100 % |
| urgencia | indexée | 128 | 604 | 52,3 | 10,3 | 6,3 % | 91,1 % | 100 % |
| urgencia | non indexée | 334 | 624 | 52,7 | 10,4 | 5,9 % | 91,3 % | 100 % |
| perto-de-mim (métier x ville) | indexée | 207 | 559 | 55,4 | 9,0 | 5,5 % | 92,4 % | 100 % |
| perto-de-mim (métier x ville) | non indexée | 277 | 553 | 55,4 | 9,0 | 5,6 % | 92,3 % | 100 % |
| perto-de-mim (hubs métier) | indexée | 2 | 588 | 93,5 | 8,0 | 24,2 % | 65,3 % | 100 % |
| perto-de-mim (hubs métier) | non indexée | 20 | 613 | 94,0 | 8,0 | 30,3 % | 64,4 % | 100 % |

Précision de lecture : « texte propre » ci-dessus est calculé contre toutes les pages du modèle (462 ou 484). Calculé contre les seules 22 pages ville d'un même métier (mesure du 13/10/2026 sur les 22 pages servicos canalizador), le texte propre monte à 29,7 % (25,6 à 36,6 % selon la page) et le partagé 10+ à 67,1 % : le texte d'un métier est recopié dans ses 22 villes, et le socle du modèle est recopié dans tous les métiers.

Lecture : rien de mesurable ne sépare les deux groupes. La sélection faite par Google ne s'explique ni par un défaut technique, ni par la longueur du texte, ni par le nombre de liens. Le point commun de toutes ces pages est la très faible part de texte propre à chaque page.

Pages hors grille (même méthode) : pages ville non indexées (8) 1546 mots, 31,4 % de texte propre, contre 1669 mots et 35,4 % pour les 14 indexées. Articles de blog non indexés (11) 1169 mots, 73,6 % de texte propre, contre 1170 mots et 73,7 % pour les 16 indexés.

### 5.5 Doublons et chevauchement d'intentions

Part des séquences de 5 mots de la page A que l'on retrouve dans la page B (texte de `<main>`, échantillon Ovar) :

| Comparaison | A dans B | B dans A |
|---|---|---|
| servicos canalizador-ovar et servicos canalizador-aveiro (même métier, deux villes) | 70,9 % | 69,3 % |
| servicos canalizador-ovar et servicos eletricista-ovar (même ville, deux métiers) | 19,0 % | 20,7 % |
| servicos canalizador-ovar et urgencia canalizador-urgente-ovar (même couple, 2 modèles) | 36,4 % | 45,1 % |
| servicos canalizador-ovar et perto-de-mim canalizador-ovar (même couple, 2 modèles) | 13,7 % | 22,0 % |
| perto-de-mim canalizador-ovar et perto-de-mim picheleiro-ovar (synonymes PT) | 77,4 % | non mesuré |

Constats :

- Pour un même métier, les 22 pages ville d'un modèle sont des quasi-copies (environ 70 % de séquences communes).
- Un même couple métier + ville a jusqu'à 3 URL (servicos, urgencia, perto-de-mim) qui visent la même recherche. Le modèle perto-de-mim ajoute un 22e métier `picheleiro` (synonyme de `canalizador` en portugais) : 22 pages `picheleiro-{ville}` proches des 22 `canalizador-{ville}`.
- Clics de septembre par modèle (export GSC, 689 clics au total sur les lignes PT de l'export) : servicos 312, perto-de-mim 109, urgencia 54. Le modèle servicos concentre 45 % des clics PT.

### 5.6 Maillage interne

Graphe construit sur 1471 pages PT téléchargées (liens HTML présents dans le code source) :

| Mesure | Indexées | Non indexées |
|---|---|---|
| Liens entrants moyens, servicos | 27,5 | 27,6 |
| Liens entrants moyens, urgencia | 25,9 | 25,9 |
| Liens entrants moyens, perto-de-mim (métier x ville) | 24,6 | 24,8 |
| Pages sans lien entrant | 0 | 0 |

- Aucune page de grille n'est orpheline et l'écart de liens entrants est nul entre les deux groupes.
- Profondeur depuis `/pt/` : servicos 2 à 3 clics, urgencia 2 à 4, perto-de-mim 4 à 5. Les hubs ont 3 à 4 clics.
- `/pt/servicos/` lie 462 pages servicos (544 liens au total), `/pt/urgencia/` lie 462 pages urgencia (499 liens), `/pt/perto-de-mim/` ne lie que 151 des 506 pages de son modèle (188 liens).
- L'accueil `/pt/` n'a que 24 liens internes PT, dont 12 pages ville sur 22.
- Échantillon : `/pt/cidade/ovar/` (53 liens) lie 21 pages servicos, 6 pages urgencia sur 21 et aucune page perto-de-mim.
- 0 lien vers une fiche professionnelle (`/pt/profissional/`) sur les 1430 pages de grille et pages ville testées : aucune entité locale réelle (professionnel, avis) n'est exposée dans le HTML.

### 5.7 Pages hors grille non indexées (31 URL)

Mots = blocs séparés par des espaces dans le texte de `<main>`, mesurés en ligne le 13/10/2026 (comptage environ 4 % plus bas que les mots alphanumériques de la section 5.4). Toutes répondent 200, `index,follow`, canonique propre, sauf `/pt/privacidade/` et `/pt/mercados/gerir/` (noindex en ligne).

| URL | Groupe | Mots | Dernière exploration | Clics sept. | Impr. sept. |
|---|---|---|---|---|---|
| `/pt/perto-de-mim/` | hub-section | 457 | 09/07/2026 | n.d. | n.d. |
| `/pt/servicos/` | hub-section | 3489 | 07/10/2026 | n.d. | n.d. |
| `/pt/urgencia/` | hub-section | 1619 | 15/09/2026 | n.d. | n.d. |
| `/pt/cidade/agueda/` | cidade | 1464 | 05/07/2026 | 0 | 2 |
| `/pt/cidade/aveiro/` | cidade | 1458 | 27/05/2026 | n.d. | n.d. |
| `/pt/cidade/matosinhos/` | cidade | 1480 | 25/05/2026 | n.d. | n.d. |
| `/pt/cidade/ovar/` | cidade | 1434 | 23/05/2026 | n.d. | n.d. |
| `/pt/cidade/povoa-de-varzim/` | cidade | 1529 | 06/07/2026 | n.d. | n.d. |
| `/pt/cidade/santo-tirso/` | cidade | 1511 | 08/09/2026 | n.d. | n.d. |
| `/pt/cidade/valongo/` | cidade | 1418 | 29/05/2026 | 0 | 2 |
| `/pt/cidade/vila-do-conde/` | cidade | 1532 | 22/06/2026 | n.d. | n.d. |
| `/pt/condominio/` | page-statique | 360 | 21/06/2026 | n.d. | n.d. |
| `/pt/especialidades/` | page-statique | 223 | 04/07/2026 | n.d. | n.d. |
| `/pt/mapa-do-site/` | page-statique | 2173 | 05/07/2026 | n.d. | n.d. |
| `/pt/profissionais-verificados/` | page-statique | 500 | 03/07/2026 | n.d. | n.d. |
| `/pt/torne-se-parceiro/` | page-statique | 525 | 03/07/2026 | n.d. | n.d. |
| `/pt/precos/canalizador/` | precos | 575 | 12/06/2026 | n.d. | n.d. |
| `/pt/mercados/gerir/` | mercados | 2 | 28/05/2026 | n.d. | n.d. |
| `/pt/mercados/publicar/` | mercados | 424 | 05/07/2026 | n.d. | n.d. |
| `/pt/privacidade/` | juridique | 361 | 13/05/2026 | n.d. | n.d. |
| `/pt/blog/autoclismo-nao-enche-causas/` | blog | 1177 | 21/06/2026 | n.d. | n.d. |
| `/pt/blog/como-escolher-empreiteiro-confianca/` | blog | 1122 | 21/06/2026 | n.d. | n.d. |
| `/pt/blog/curto-circuito-o-que-fazer/` | blog | 1143 | 07/10/2026 | 1 | 196 |
| `/pt/blog/desentupir-canos-preco/` | blog | 949 | 04/07/2026 | n.d. | n.d. |
| `/pt/blog/disjuntor-dispara-causas/` | blog | 1284 | 31/08/2026 | 0 | 31 |
| `/pt/blog/empreiteiro-certificado-portugal-alvara-verificar/` | blog | 735 | 24/09/2026 | 1 | 162 |
| `/pt/blog/fuga-agua-como-agir/` | blog | 1316 | 01/09/2026 | 0 | 5 |
| `/pt/blog/microcimento-casa-de-banho-preco/` | blog | 975 | 24/07/2026 | 0 | 88 |
| `/pt/blog/obras-sem-licenca-portugal/` | blog | 1167 | 21/06/2026 | 0 | 188 |
| `/pt/blog/quadro-eletrico-problemas-solucoes/` | blog | 1191 | 21/08/2026 | 0 | 8 |
| `/pt/blog/teto-a-pingar-o-que-fazer/` | blog | 1266 | 04/08/2026 | 0 | 13 |

## 6. Autres motifs (listes complètes)

### 6.1 Bloquées par robots.txt (13 URL PT)

| URL | Dernière exploration | Règle | État en ligne le 13/10/2026 |
|---|---|---|---|
| `/pt/pesquisar/?category=electricite` | 14/07/2026 | `Disallow: /*/pesquisar/*?*` | 200, index, canonique /pt/pesquisar/ |
| `/pt/pesquisar/?q={search_term_string}` | 14/07/2026 | `Disallow: /*/pesquisar/*?*` | 200, index, canonique /pt/pesquisar/ |
| `/pt/pesquisar/?category=maconnerie` | 11/07/2026 | `Disallow: /*/pesquisar/*?*` | non testé (même gabarit) |
| `/pt/pesquisar/?category=serrurerie` | 09/07/2026 | `Disallow: /*/pesquisar/*?*` | non testé (même gabarit) |
| `/pt/pesquisar/?category=menuiserie` | 06/07/2026 | `Disallow: /*/pesquisar/*?*` | non testé (même gabarit) |
| `/pt/pesquisar/?category=toiture` | 05/07/2026 | `Disallow: /*/pesquisar/*?*` | non testé (même gabarit) |
| `/pt/pesquisar/?category=plomberie` | 01/07/2026 | `Disallow: /*/pesquisar/*?*` | non testé (même gabarit) |
| `/pt/pesquisar/?category=chauffage` | 28/06/2026 | `Disallow: /*/pesquisar/*?*` | non testé (même gabarit) |
| `/pt/pesquisar/?category=peinture` | 25/06/2026 | `Disallow: /*/pesquisar/*?*` | non testé (même gabarit) |
| `/pt/pro/tarifs/` | 20/06/2026 | `Disallow: /*/pro/` | 200, index, canonique propre |
| `/pt/pro/register/` | 30/05/2026 | `Disallow: /*/pro/` | 200, index, sans canonique |
| `/pt/pro/faq/` | 13/05/2026 | `Disallow: /*/pro/` | 200, index, sans canonique |
| `/pt/auth/login/` | 10/05/2026 | `Disallow: /*/auth/` | 200, index, sans canonique |

Règles en cause : `Disallow: /*/pesquisar/*?*` (variantes `?category=`), `Disallow: /*/pro/`, `Disallow: /*/auth/`. L'URL `/pt/pesquisar/?q={search_term_string}` est le gabarit de la SearchAction du JSON-LD WebSite, lu par Google comme une URL. Rien à corriger, sauf décision produit sur `/pt/pro/tarifs/` (action A8).

### 6.2 Introuvables (404) : 9 URL PT, tous d'anciens articles de blog

| URL | Dernière exploration | État en ligne le 13/10/2026 | Piste |
|---|---|---|---|
| `/pt/blog/poupar-agua-casa/` | 03/07/2026 | 404 | à décider : 301 vers un article proche ou 410 |
| `/pt/blog/como-desentupir-canos/` | 30/05/2026 | 404 | équivalent probable : /pt/blog/cano-entupido-como-resolver/ (à confirmer) |
| `/pt/blog/sinais-fuga-agua/` | 28/05/2026 | 404 | équivalent probable : /pt/blog/fuga-agua-como-agir/ (à confirmer) |
| `/pt/blog/certificacao-eletrica/` | 03/05/2026 | 301 vers /pt/blog/ (index du blog) | risque de soft 404 : viser l'article le plus proche ou 410 |
| `/pt/blog/como-escolher-tinta/` | 03/05/2026 | 301 vers /pt/blog/ (index du blog) | risque de soft 404 : viser l'article le plus proche ou 410 |
| `/pt/blog/humidade-paredes-solucoes/` | 03/05/2026 | 301 vers /pt/blog/humidade-parede-causas-reparacao/ (article équivalent) | redirection correcte vers l'article équivalent |
| `/pt/blog/paineis-solares-portugal/` | 03/05/2026 | 301 vers /pt/blog/ (index du blog) | risque de soft 404 : viser l'article le plus proche ou 410 |
| `/pt/blog/preparar-paredes-pintura/` | 03/05/2026 | 301 vers /pt/blog/ (index du blog) | risque de soft 404 : viser l'article le plus proche ou 410 |
| `/pt/blog/seguranca-eletrica-casa/` | 03/05/2026 | 301 vers /pt/blog/ (index du blog) | risque de soft 404 : viser l'article le plus proche ou 410 |

Au 13/10/2026 : 3 renvoient toujours 404, 5 redirigent vers l'index `/pt/blog/` (risque de soft 404) et 1 vers l'article équivalent. Autre cas hors rapport GSC : `/pt/blog/iva-6-remodelacao-portugal/` (1 clic en septembre) renvoie 404 alors que `/pt/blog/iva-6-obras-remodelacao-portugal/` répond 200 (changement de slug sans redirection).

### 6.3 Page avec redirection (1 URL PT)

| URL | Dernière exploration | État en ligne le 13/10/2026 |
|---|---|---|
| `/pt/pesquisar` | 10/10/2026 | redirige vers /pt/pesquisar/ (200, index, canonique propre) |

Comportement normal (la forme sans slash final redirige vers la forme avec slash). Corriger les liens internes pour pointer directement vers la forme canonique.

### 6.4 Exclues par noindex (7 URL PT)

| URL | Dernière exploration | Dans le sitemap en ligne | État en ligne le 13/10/2026 |
|---|---|---|---|
| `/pt/profissional/90fb2374-26ee-4ae7-8ac6-599c1b945690/` | 02/09/2026 | non | 200, noindex,nofollow, canonique propre |
| `/pt/avisos-legais/` | 19/06/2026 | oui | 200, noindex,follow, canonique propre |
| `/pt/profissional/construcoes-valho-filhos-lda/` | 14/05/2026 | non | 200, noindex,nofollow, canonique propre |
| `/pt/profissional/carlos-mendes-jardins/` | 13/05/2026 | non | 200, noindex,nofollow, canonique propre |
| `/pt/privacidade` | 09/05/2026 | non | redirige vers /pt/privacidade/ (200, noindex,follow) |
| `/pt/termos/` | 09/05/2026 | oui | 200, noindex,follow, canonique propre |
| `/pt/politica-cookies/` | 27/04/2026 | oui | 200, noindex,follow, canonique propre |

Les 4 pages juridiques figurent dans le sitemap PT alors qu'elles sont en noindex (contradiction à corriger, action A5). `/pt/privacidade/` est classée « explorée non indexée » par GSC mais sa balise noindex est bien présente en ligne.

### 6.5 Explorées non indexées hors sitemap (4 URL PT observées)

| URL | Dernière exploration | État en ligne le 13/10/2026 | Remarque |
|---|---|---|---|
| `/pt/contact/` | 06/10/2026 | 200, index,follow, canonique propre | hors sitemap ; slug non traduit, /pt/contacto/ répond 404 (A5, A8) |
| `/pt/cidade/` | 04/10/2026 | 200, index,follow, canonique propre | hors sitemap : à ajouter (A5) |
| `/pt/sitemap.xml` | 29/07/2026 | 200, application/xml | fichier technique |
| `/pt/manifest.webmanifest` | 12/05/2026 | 200, application/manifest+json | fichier technique |

### 6.6 Annexe : 11 URL au slug portugais sans préfixe `/pt/`

| URL | Motif GSC | Dernière exploration | État en ligne le 13/10/2026 |
|---|---|---|---|
| `/pesquisar/?category=chauffage` | Bloquée par le fichier robots.txt | 13/06/2026 | non testé (même comportement attendu) |
| `/pesquisar/?category=electricite` | Bloquée par le fichier robots.txt | 24/06/2026 | redirige vers /pt/pesquisar/?category=electricite (200, canonique /pt/pesquisar/) |
| `/pesquisar/?category=maconnerie` | Bloquée par le fichier robots.txt | 20/06/2026 | non testé (même comportement attendu) |
| `/pesquisar/?category=menuiserie` | Bloquée par le fichier robots.txt | 21/06/2026 | non testé (même comportement attendu) |
| `/pesquisar/?category=peinture` | Bloquée par le fichier robots.txt | 11/06/2026 | redirige vers /pt/pesquisar/?category=peinture (200, canonique /pt/pesquisar/) |
| `/pesquisar/?category=plomberie` | Bloquée par le fichier robots.txt | 17/06/2026 | non testé (même comportement attendu) |
| `/pesquisar/?category=serrurerie` | Bloquée par le fichier robots.txt | 17/06/2026 | non testé (même comportement attendu) |
| `/pesquisar/?category=toiture` | Bloquée par le fichier robots.txt | 05/07/2026 | redirige vers /pt/pesquisar/?category=toiture (200, canonique /pt/pesquisar/) |
| `/mês` | Introuvable (404) | 08/05/2026 | redirige vers /pt/ (200, index, canonique propre) |
| `/pesquisar` | Page avec redirection | 10/10/2026 | redirige vers /pt/pesquisar/ (200, index, canonique propre) |
| `/pesquisar/` | Page avec redirection | 10/10/2026 | redirige vers /pt/pesquisar/ (200, index, canonique propre) |

Ces URL viennent de liens internes générés sans préfixe de langue (`/pesquisar/`, `/mês`). Huit autres URL sans préfixe de langue (`/auth/login/`, `/api/og/?locale=pt|fr|en`, `/pro/register/`, `/pro/tarifs/`, `/pro/faq/`, `/contact/`) sont de langue indéterminée et ne sont pas comptées.

## 7. Constats techniques vérifiés en ligne le 13/10/2026

### 7.1 Sitemaps

- `robots.txt` ne déclare qu'une ligne `Sitemap` : l'index `https://vitfix.io/sitemap.xml`.
- L'index référence 5 sitemaps : `/sitemap/0.xml` (27 URL : 16 PT, 10 FR, la racine), `/sitemap/1.xml` (1483 URL, toutes PT), `/sitemap/2.xml` (1502 URL, toutes FR), `/sitemap/3.xml` (25 URL : EN 11, FR 4, NL 5, ES 5) et `/pt/sitemap.xml` (1503 URL, toutes PT). Tous répondent 200, `application/xml`, sans `X-Robots-Tag`.
- Les URL PT sont déclarées en double : `/sitemap/1.xml` est inclus dans `/pt/sitemap.xml` (qui ajoute 20 pages statiques) et les 16 URL PT de `/sitemap/0.xml` y figurent aussi. L'union des URL PT est exactement `/pt/sitemap.xml`.
- GSC > Sitemaps : l'index `/sitemap.xml` (lu le 11/10/2026) affiche 1504 pages découvertes et un seul sitemap enfant lu : `/pt/sitemap.xml` (lu le 02/10/2026, 1504 URL). Les enfants `/sitemap/0.xml` à `/sitemap/3.xml` n'apparaissent pas. Hors périmètre PT. Lien possible, non démontré, avec le fait que la quasi-totalité des « explorées non indexées » lisibles hors sitemap PT sont FR (970 sur 1000).
- `lastmod` : figé selon la ville pour 1430 URL (1408 pages de grille et 22 pages ville) : 2026-05-07 (aveiro, agueda, ovar), 2026-05-09 (matosinhos, gondomar, valongo, vila-do-conde, santo-tirso, povoa-de-varzim, trofa), 2026-05-11 (les 12 autres villes). Les 27 articles ont des dates distinctes (2025-11-15 à 2026-03-18). 46 URL n'ont pas de `lastmod`. Aucun `xhtml:link`, `changefreq` ni `priority`.
- URL noindex présentes dans le sitemap : `/pt/termos/`, `/pt/avisos-legais/`, `/pt/privacidade/`, `/pt/politica-cookies/`.
- URL indexables absentes du sitemap : `/pt/contact/` (200, index), `/pt/cidade/` (200, index).
- `/pt/mercados/gerir/` : noindex,nofollow, absente du sitemap en ligne mais encore comptée par GSC.

### 7.2 robots.txt

Groupe `User-agent: *` : `Allow: /` ; `Disallow` sur `/pro/`, `/syndic/`, `/client/`, `/admin/`, `/api/`, `/auth/`, `/coproprietaire/` et leurs variantes `/*/…/` ; `Disallow` sur `/*/recherche/*?*`, `/*/pesquisar/*?*`, `/recherche/*?*`, `/pesquisar/*?*` ; `Disallow` sur les paramètres `utm_`, `fbclid=`, `gclid=`, `ref=`, `_branch_match_id=`. 20 groupes d'agents (dont des bots IA) répètent ces règles. Conséquence mineure : l'image sociale `og:image` des pages pointe vers `/api/og/?locale=pt`, bloquée par `Disallow: /api/`.

### 7.3 hreflang et titres

- Pages servicos, urgencia, ville, blog et hub `/pt/servicos/` : `pt-PT` = la page elle-même ; `fr-FR` = une page FR générique (`/pt/servicos/canalizador-ovar/` vers `/fr/services/`, urgencia vers `/fr/urgence/`, ville vers `/fr/`, blog vers `/fr/blog/`) ; `en` vers `/en/` (servicos, urgencia) ; `x-default` vers `/`, qui redirige (sauf `/pt/servicos/` où x-default est la page elle-même). Les pages perto-de-mim n'ont aucun hreflang.
- Les alternates ne sont pas des équivalents de la page (pages FR/EN génériques) : usage non conforme de hreflang.
- Titres : « … | VITFIX | VITFIX Portugal » (marque en double) sur tous les modèles testés. Longueurs mesurées : 71 (urgencia), 86 (perto-de-mim), 87 (ville), 72 (blog), 105 (hub servicos) caractères.

### 7.4 Données structurées (JSON-LD)

- Pages servicos (échantillon `/pt/servicos/canalizador-ovar/`) : nœud `LocalBusiness` « VITFIX - Canalizador em Ovar » avec `address` (`PostalAddress` : localité Ovar, région Aveiro, PT), `geo` (coordonnées du centre-ville), `openingHoursSpecification` (08:00 à 20:00, 7 jours), `priceRange` et un téléphone unique. Types relevés sur les 462 pages servicos : LocalBusiness, PostalAddress, GeoCoordinates, OpeningHoursSpecification, Service, OfferCatalog, Offer, PriceSpecification, FAQPage, BreadcrumbList.
- `LocalBusiness` présent sur 968 pages (servicos 462, perto-de-mim 484, ville 22) ; les pages urgencia utilisent `EmergencyService`. Adresse et coordonnées vérifiées uniquement sur l'échantillon servicos.
- Vérifié le 13/10/2026 sur 35 pages : servicos = `LocalBusiness` avec `address` et `geo` ; urgencia = `EmergencyService` avec `address` et `geo` plus `HowTo` ; perto-de-mim et pages ville = `LocalBusiness` avec `geo` sans `address` ; hubs métier = `Service`. Toutes les pages portent en plus un bloc commun `WebSite`, `Organization`, `HomeAndConstructionBusiness`.
- Risque (hypothèse) : une adresse et des coordonnées par ville pour une plateforme sans établissement local peut être jugée trompeuse. À confirmer avec le propriétaire (présence physique réelle ou non). La documentation Google `LocalBusiness` (mise à jour 08/09/2026) rend `address` obligatoire et la définit comme « l'emplacement physique de l'entreprise » ; les règles générales exigent un balisage « représentation fidèle du contenu de la page ».
- `FAQPage` : les résultats enrichis FAQ ont été retirés de Google Search le 07/05/2026 (documentation supprimée le 15/06/2026). `HowTo` : retiré en septembre 2023. Ces deux balisages, présents sur les 1430 pages de grille, n'ont plus aucun effet d'affichage.

### 7.5 Rendu et contenu

- Le texte est présent dans le HTML initial (`<main>` : 440 à 700 mots sur les pages de grille). Aucune dépendance JavaScript observée pour le texte.
- URL inconnues : 404 propre avec `noindex` (testé sur des chemins inconnus sous `/pt/blog/`, `/pt/servicos/` et `/pt/`). Les chemins inconnus sans préfixe de langue (ex. `/mês`) redirigent vers `/pt/` en 200.

## 8. Hypothèses à vérifier dans le code (ne pas les traiter comme établies)

| Id | Hypothèse | Indice mesuré | À vérifier |
|---|---|---|---|
| H1 | Les 3 modèles injectent `{métier}` et `{ville}` dans un texte commun | 88 à 92 % du texte partagé avec 10+ pages | Composants des routes `/pt/servicos/[slug]`, `/pt/urgencia/[slug]`, `/pt/perto-de-mim/[slug]` et source du texte (fichiers de traduction, constantes). Compter les champs réellement variables par page |
| H2 | Aucune donnée locale réelle n'est exposée | 0 lien vers un professionnel sur 1430 pages ; prix et FAQ probablement génériques | Origine des blocs prix (`Offer`, `PriceSpecification`), FAQ, « professionnels » : codés en dur ou issus de la base ? Y a-t-il des professionnels réels par ville ? |
| H3 | Chevauchement d'intentions entre modèles et entre synonymes | Jusqu'à 3 URL par couple métier + ville ; `picheleiro` et `canalizador` à 77 % de texte commun | Pourquoi 3 modèles ? Quelle requête cible chacun ? Le métier `picheleiro` n'existe que dans perto-de-mim |
| H4 | Le balisage LocalBusiness avec adresse par ville est jugé trompeur | `address` et `geo` par ville sur l'échantillon servicos | Générateur JSON-LD ; existence d'un établissement par ville |
| H5 | Signal de qualité global du domaine PT abaissé | Le blog (texte unique) est aussi non indexé à 41 % ; 95 % du sitemap PT est du contenu de grille | Comparer l'indexation du blog avant et après réduction de la grille |
| H6 | Faible demande de crawl et faible autorité | 78 % des 910 URL non réexplorées depuis le 01/08 ; `lastmod` figé début mai ; autorité du domaine non mesurée | Rapport GSC « Liens » (liens externes vers `/pt/`), logs serveur (fréquence de Googlebot par modèle) |
| H7 | Profondeur et maillage insuffisants pour perto-de-mim | 4 à 5 clics ; hub `/pt/perto-de-mim/` lie 151 pages sur 506 ; accueil lie 12 villes sur 22 | Composants de navigation, blocs « villes proches » et « autres métiers » |
| H8 | Hubs trop faibles ou trop denses | `/pt/servicos/` 544 liens, `/pt/urgencia/` 499 liens, `/pt/especialidades/` 223 mots ; les 3 hubs de section et 20 hubs métier sur 22 sont non indexés | Contenu propre et liens contextuels des hubs |

## 9. Plan d'action

Ordre proposé : semaine 1 : A0, A5 (points 1, 2, 4), A6, A7. Semaines 2 et 3 : A1 (décision), A3. Semaines 3 à 6 : A2, A4. En continu : A9.

### A0. Gel immédiat

- Ne créer aucune page métier x ville ni aucune nouvelle ville ou nouveau métier.
- Ne pas changer l'URL d'une page marquée `PROTEGER` sans redirection 301.
- Ne pas modifier les `lastmod` sans changement réel de contenu.
- Ne pas utiliser « Demander une indexation » en masse.

Fait quand : ces règles sont notées dans le dépôt.

### A1. Structure cible des 3 modèles (décision du propriétaire)

Données pour décider : clics de septembre (servicos 312, perto-de-mim 109, urgencia 54) ; taux de non-indexation (54 %, 57 %, 72 %) ; chevauchement de texte (servicos et urgencia 36 à 45 %, servicos et perto-de-mim 14 à 22 %) ; « urgence » et « perto de mim » sont des variantes de la même recherche métier + ville.

- **Option A (suggérée par les données, à valider)** : servicos devient la page canonique de chaque couple métier x ville (462 URL), avec un bloc « urgence 24h » intégré. Les 462 URL urgencia et les 484 URL perto-de-mim métier x ville sont redirigées en 301 vers la page servicos du même couple (`picheleiro-{ville}` vers `canalizador-{ville}`). On garde les 22 hubs métier perto-de-mim (requête générique « perto de mim ») une fois renforcés. Gain : environ 946 URL quasi dupliquées en moins. Risque : urgencia et perto-de-mim ont reçu 54 et 109 clics en septembre, dont 17 et 32 clics sur 15 et 25 pages P1 non indexées ; la 301 transmet en principe les signaux vers la page cible, à surveiller pendant 4 semaines.
- **Option B** : garder les 3 modèles, mais n'indexer et ne mettre au sitemap que les couples disposant de données locales réelles (A2). Les autres passent en `noindex,follow` hors sitemap.
- Éléments documentés par Google qui pèsent pour l'option A : la redirection permanente est « un signal fort » pour consolider des pages dupliquées ou très similaires (doc canonicalisation, 10/07/2026) ; la politique « doorway abuse » vise « des pages ciblant des régions ou des villes spécifiques » et « des pages substantiellement similaires » (politiques anti-spam, 28/08/2026) ; le guide crawl (22/07/2026) demande de « consolider le contenu dupliqué » et déconseille `noindex` comme outil de gestion du crawl.

Fait quand : le choix est consigné dans le dépôt et la liste des URL redirigées ou en noindex est produite à partir de `pt_sitemap_statut_complet.csv`.

### A2. Contenu : données locales réelles

- Remplacer le texte commun par du contenu propre au couple métier + ville, issu de données réelles : fourchettes de prix observées (les pages `/pt/precos/*` sont déjà indexées avec clics), professionnels vérifiés réellement actifs dans la zone, délais d'intervention réels, communes et codes postaux couverts, FAQ réellement locale, avis réels.
- Interdit : données inventées, avis fictifs, statistiques non sourcées, réécriture automatique par synonymes.
- Contenu visible dans le HTML initial.

Fait quand : le calcul décrit en section 11 mesure au moins 30 % de séquences propres à la page (objectif de travail, non garanti ; aujourd'hui 5 à 9 %) sur 90 % des pages conservées.

### A3. Hubs et pages stratégiques d'abord (38 URL)

URL : `/pt/servicos/`, `/pt/urgencia/`, `/pt/perto-de-mim/`, les 20 hubs métier perto-de-mim non indexés, les 8 pages ville non indexées, `/pt/condominio/`, `/pt/especialidades/`, `/pt/mapa-do-site/`, `/pt/profissionais-verificados/`, `/pt/torne-se-parceiro/`, `/pt/precos/canalizador/`, `/pt/mercados/publicar/`.

- Contenu propre et substantiel pour chacune ; éviter la page qui n'est qu'une liste de 500 liens ; liens contextuels vers les pages enfants conservées.
- Présence dans le menu ou le pied de page et lien depuis l'accueil (aujourd'hui 12 villes sur 22).
- `/pt/especialidades/` ne fait que 223 mots.

Fait quand : URL Inspection indique « L'URL est sur Google » pour au moins 80 % de ces 38 URL, 4 semaines après la mise en production.

### A4. Maillage et profondeur

- Toute page conservée à 3 clics ou moins de `/pt/` (perto-de-mim est à 4 à 5 aujourd'hui).
- Page ville vers toutes les pages métier de la ville conservées (sur `/pt/cidade/ovar/` : 21 servicos, 6 urgencia sur 21, 0 perto-de-mim).
- Hub `/pt/perto-de-mim/` : lier toutes les pages de son modèle conservées (151 sur 506 aujourd'hui).
- Liens dans le HTML initial, avec ancres descriptives.

Fait quand : le crawl interne donne une profondeur maximale de 3 et aucune page orpheline parmi les pages conservées.

### A5. Sitemaps

1. Retirer des sitemaps les URL noindex : `/pt/termos/`, `/pt/avisos-legais/`, `/pt/privacidade/`, `/pt/politica-cookies/`.
2. Déclarer chaque URL PT dans un seul sitemap (aujourd'hui `/sitemap/1.xml` et `/pt/sitemap.xml` se chevauchent).
3. Découper par modèle (servicos, urgencia, perto-de-mim, blog, pages ; noms libres) pour suivre l'indexation par modèle dans GSC sans le plafond de 1000 lignes.
4. `lastmod` = date réelle de dernière modification du contenu (aujourd'hui figé aux 07, 09 et 11/05/2026 pour 1430 URL).
5. Comprendre pourquoi GSC ne liste que `/pt/sitemap.xml` comme enfant lu de l'index (7.1) ; effet probable sur FR, EN, ES, NL.
6. Ajouter `/pt/cidade/` ; décider du sort de `/pt/contact/` (A8).

Fait quand : chaque URL PT indexable figure dans exactement 1 sitemap, aucune URL noindex ou redirigée n'y figure, et GSC > Sitemaps montre tous les enfants lus sans erreur.

### A6. hreflang, titres, balisage

- hreflang : supprimer les alternates qui pointent vers des pages génériques FR ou EN ; ne garder que l'auto-référence `pt-PT` tant qu'aucun équivalent traduit réciproque n'existe ; `x-default` doit pointer vers une URL qui répond 200.
- Titres : marque une seule fois, environ 60 caractères (71 à 105 aujourd'hui).
- JSON-LD : si VITFIX n'a pas d'établissement dans la ville, retirer le nœud `LocalBusiness` ou `EmergencyService` par ville (Google exige `address` sur ce type, et une adresse par ville serait fausse) ; garder un seul nœud `HomeAndConstructionBusiness` avec l'adresse réelle du siège, commun à tout le site, et décrire chaque page par `Service` avec `provider` et `areaServed` (la ville). Retirer `HowTo` et `FAQPage` (sans effet depuis 2023 et depuis le 07/05/2026). Garder `BreadcrumbList`. Vérifier que `Offer` et `PriceSpecification` correspondent à du contenu visible et réel, sinon les retirer.

Fait quand : plus aucun alternate non équivalent, titres conformes sur 95 % des pages, Rich Results Test sans avertissement sur un échantillon de chaque modèle.

### A7. 404, redirections, liens sans préfixe

- 9 anciens articles (6.2) : 301 vers l'article le plus proche, sinon 410. Candidats d'équivalence à confirmer : `como-desentupir-canos` vers `cano-entupido-como-resolver`, `sinais-fuga-agua` vers `fuga-agua-como-agir`. Éviter la redirection générique vers `/pt/blog/` (5 cas actuels). Ajouter une 301 de `/pt/blog/iva-6-remodelacao-portugal/` vers `/pt/blog/iva-6-obras-remodelacao-portugal/`.
- Trouver dans le code les liens générés sans préfixe de langue vers `/pesquisar/` et `/pesquisar/?category=…` (10 URL au total) et vers `/mês` ; préfixer par la locale ou supprimer. Les valeurs `category` sont des clés FR (`electricite`, `maconnerie`, `serrurerie`, `menuiserie`, `toiture`, `plomberie`, `chauffage`, `peinture`) sur des pages PT : à vérifier.
- Faire pointer les liens internes vers la forme avec slash final (`/pt/pesquisar/`).

Fait quand : le crawl interne ne trouve aucun lien sortant vers une URL en 404, en 3xx ou sans préfixe de langue.

### A8. Décisions produit (propriétaire)

- Fiches professionnelles `/pt/profissional/{slug}/` en `noindex,nofollow` : voulu ? Si elles doivent capter du trafic local, les indexer avec du contenu réel (avis, zone, services).
- `/pt/pro/tarifs/` : `index` et canonique propre mais bloquée par robots.txt. Débloquer ou retirer les liens.
- `/pt/contact/` (200, index, hors sitemap, slug non traduit) et `/pt/contacto/` (404) : choisir le slug PT et rediriger l'autre.

### A9. Suivi

- Chaque semaine : GSC > Pages, par sitemap ou modèle : non indexées, indexées.
- Indicateurs : pages indexées par modèle, clics PT par semaine, pages P1 récupérées.
- Ne pas conclure avant 6 à 8 semaines : des analyses publiées indiquent que la récupération peut prendre plusieurs mois.

## 10. Récupération et protection

Définitions (colonnes `priorite`) :

- `P1` : URL non indexée avec au moins 1 clic en septembre (93 URL, 133 clics).
- `P2` : URL non indexée avec impressions mais sans clic (242 URL).
- `P3` : URL non indexée sans donnée de septembre (575 URL).
- `PROTEGER` : URL indexée avec au moins 1 clic en septembre (204 URL, 555 clics). À ne pas casser pendant les chantiers A1 à A4.

### 10.1 Les 25 premières URL P1 (liste complète dans le CSV)

| # | URL | Groupe | Clics sept. | Impr. sept. | Position moy. | Dernière exploration |
|---|---|---|---|---|---|---|
| 1 | `/pt/servicos/poda-arvores-felgueiras/` | servicos | 8 | 33 | 2,7 | 05/09/2026 |
| 2 | `/pt/servicos/telhador-marco-de-canaveses/` | servicos | 7 | 25 | 3,3 | 06/10/2026 |
| 3 | `/pt/perto-de-mim/telhador-lousada/` | perto-de-mim | 4 | 20 | 7,6 | 10/07/2026 |
| 4 | `/pt/servicos/telhador-vila-do-conde/` | servicos | 3 | 41 | 6,2 | 25/09/2026 |
| 5 | `/pt/servicos/limpeza-espacos-santo-tirso/` | servicos | 3 | 11 | 5,5 | 30/07/2026 |
| 6 | `/pt/servicos/isolamento-termico-pacos-de-ferreira/` | servicos | 3 | 8 | 3,3 | 03/10/2026 |
| 7 | `/pt/servicos/impermeabilizacao-amarante/` | servicos | 3 | 7 | 3,7 | 30/08/2026 |
| 8 | `/pt/servicos/isolamento-termico-vila-nova-de-gaia/` | servicos | 3 | 6 | 5,3 | 25/09/2026 |
| 9 | `/pt/servicos/jardineiro-povoa-de-varzim/` | servicos | 2 | 39 | 7,6 | 08/07/2026 |
| 10 | `/pt/servicos/telhador-santo-tirso/` | servicos | 2 | 38 | 6,2 | 02/10/2026 |
| 11 | `/pt/servicos/ar-condicionado-ovar/` | servicos | 2 | 32 | 6,6 | 24/09/2026 |
| 12 | `/pt/perto-de-mim/telhador-agueda/` | perto-de-mim | 2 | 31 | 5,7 | 28/05/2026 |
| 13 | `/pt/perto-de-mim/telhador-penafiel/` | perto-de-mim | 2 | 29 | 7,9 | 08/07/2026 |
| 14 | `/pt/servicos/faz-tudo-marco-de-canaveses/` | servicos | 2 | 26 | 6,6 | 03/07/2026 |
| 15 | `/pt/servicos/carpinteiro-amarante/` | servicos | 2 | 16 | 7,5 | 07/07/2026 |
| 16 | `/pt/servicos/ar-condicionado-valongo/` | servicos | 2 | 10 | 13,0 | 17/09/2026 |
| 17 | `/pt/servicos/impermeabilizacao-gondomar/` | servicos | 2 | 10 | 4,5 | 23/08/2026 |
| 18 | `/pt/urgencia/canalizador-urgente-maia/` | urgencia | 2 | 10 | 6,8 | 03/08/2026 |
| 19 | `/pt/perto-de-mim/picheleiro-ovar/` | perto-de-mim | 2 | 9 | 3,9 | 30/08/2026 |
| 20 | `/pt/urgencia/isolamento-termico-urgente-trofa/` | urgencia | 2 | 7 | 5,3 | 27/05/2026 |
| 21 | `/pt/servicos/limpeza-espacos-marco-de-canaveses/` | servicos | 2 | 5 | 6,6 | 21/06/2026 |
| 22 | `/pt/perto-de-mim/isolamento-termico-paredes/` | perto-de-mim | 2 | 4 | 1,0 | 01/08/2026 |
| 23 | `/pt/blog/curto-circuito-o-que-fazer/` | blog | 1 | 196 | 8,3 | 07/10/2026 |
| 24 | `/pt/blog/empreiteiro-certificado-portugal-alvara-verificar/` | blog | 1 | 162 | 9,2 | 24/09/2026 |
| 25 | `/pt/perto-de-mim/poda-arvores-braga/` | perto-de-mim | 1 | 27 | 8,0 | 04/07/2026 |

### 10.2 Les 20 premières URL PROTEGER

| # | URL | Groupe | Clics sept. | Impr. sept. | Position moy. |
|---|---|---|---|---|---|
| 1 | `/pt/` | page-statique | 38 | 153 | 1,6 |
| 2 | `/pt/precos/pintor/` | precos | 30 | 2121 | 7,6 |
| 3 | `/pt/blog/trocar-caixilharia-preco-portugal/` | blog | 29 | 2873 | 7,7 |
| 4 | `/pt/precos/eletricista/` | precos | 26 | 1894 | 7,4 |
| 5 | `/pt/blog/quanto-custa-remodelar-casa-portugal/` | blog | 16 | 3913 | 7,9 |
| 6 | `/pt/blog/substituir-banheira-base-duche-preco/` | blog | 14 | 619 | 8,8 |
| 7 | `/pt/pesquisar/` | recherche | 12 | 1031 | 6,9 |
| 8 | `/pt/cidade/porto/` | cidade | 10 | 146 | 6,5 |
| 9 | `/pt/servicos/estores-portoes-ovar/` | servicos | 9 | 74 | 7,3 |
| 10 | `/pt/blog/cheiro-a-esgoto-em-casa/` | blog | 8 | 473 | 6,9 |
| 11 | `/pt/servicos/canalizador-ovar/` | servicos | 8 | 115 | 6,7 |
| 12 | `/pt/servicos/jardineiro-amarante/` | servicos | 7 | 222 | 25,0 |
| 13 | `/pt/cidade/marco-de-canaveses/` | cidade | 7 | 120 | 5,3 |
| 14 | `/pt/servicos/carpinteiro-matosinhos/` | servicos | 6 | 204 | 8,8 |
| 15 | `/pt/servicos/jardineiro-pacos-de-ferreira/` | servicos | 6 | 81 | 7,6 |
| 16 | `/pt/urgencia/serralheiro-urgente-marco-de-canaveses/` | urgencia | 6 | 23 | 6,3 |
| 17 | `/pt/servicos/serralheiro-marco-de-canaveses/` | servicos | 5 | 79 | 7,5 |
| 18 | `/pt/servicos/canalizador-agueda/` | servicos | 5 | 75 | 7,9 |
| 19 | `/pt/servicos/serralheiro-lousada/` | servicos | 5 | 67 | 7,2 |
| 20 | `/pt/servicos/faz-tudo-povoa-de-varzim/` | servicos | 5 | 54 | 8,9 |

## 11. Mesure et suivi : comment refaire les mesures

- GSC, périmètre PT : `https://search.google.com/search-console/index?resource_id=https%3A%2F%2Fvitfix.io%2F&pages=SITEMAP&sitemap=https%3A%2F%2Fvitfix.io%2Fpt%2Fsitemap.xml`
- Texte propre par page (pseudo-code) : pour chaque URL d'un modèle, télécharger le HTML, prendre le texte de `<main>`, passer en minuscules, garder les mots alphanumériques, former les séquences glissantes de 5 mots, les hacher, puis `df[hash]` = nombre de pages du modèle qui contiennent la séquence. `texte_propre(page)` = part des séquences avec `df == 1`. `partage_10(page)` = part des séquences avec `df >= 10`.
- Maillage : extraire les liens `a[href]` de chaque page, normaliser (slash final), puis calculer les liens entrants et la profondeur par parcours en largeur depuis `/pt/`.
- Grille : 21 métiers x 22 villes pour servicos et urgencia ; 22 métiers (dont `picheleiro`) x 22 villes plus 22 hubs métier pour perto-de-mim.

Métiers : ar-condicionado, azulejador, canalizador, carpinteiro, desentupimento, eletricista, estores-portoes, faz-tudo, impermeabilizacao, isolamento-termico, jardineiro, limpeza-condominio, limpeza-espacos, obras-remodelacao, pedreiro, pintor, pladur, poda-arvores, serralheiro, telhador, vidraceiro (+ picheleiro pour perto-de-mim).
Villes : agueda, amarante, aveiro, baiao, braga, felgueiras, gondomar, lousada, maia, marco-de-canaveses, matosinhos, ovar, pacos-de-ferreira, paredes, penafiel, porto, povoa-de-varzim, santo-tirso, trofa, valongo, vila-do-conde, vila-nova-de-gaia.

## 12. Limites

- Données GSC au 09/10/2026 (lues le 13/10/2026). Les mesures en ligne datent du 13/10/2026 : un statut GSC peut avoir changé depuis.
- `indexee_deduit` (CSV complet) : URL du sitemap en ligne ni explorée non indexée ni noindex. Le calcul (1503 - 909 - 3 = 591) recoupe exactement le compteur GSC « Dans l'index » (591), mais GSC ne fournit pas la liste des URL indexées.
- Données de septembre : export GSC « Performances » plafonné à 1000 lignes toutes langues (810 lignes PT). Colonnes vides = page absente de l'export ou page indexée sans clic non extraite.
- Mesures de contenu : texte de `<main>` uniquement, séquences de 5 mots, comparaison entre pages du même modèle.
- GSC n'explique pas pourquoi Google refuse l'indexation : les causes de la section 8 sont des hypothèses.
- Non mesurés : liens externes, Core Web Vitals, rendu JavaScript de Googlebot, logs serveur.
- Jusqu'à 41 URL « explorées non indexées » hors sitemap sont invisibles (plafond GSC).

## Sources externes (contexte des mises à jour Google)

Documentation Google (lue le 13/10/2026) :

- Politiques anti-spam (mise à jour 28/08/2026) : https://developers.google.com/search/docs/essentials/spam-policies
- Contenu utile, fiable, people-first (05/10/2026) : https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Consolidation des URL dupliquées (10/07/2026) : https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Sitemaps (08/07/2026) : https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Budget d'exploration (22/07/2026) : https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget
- Données structurées LocalBusiness (08/09/2026) : https://developers.google.com/search/docs/appearance/structured-data/local-business
- Règles générales des données structurées (10/07/2026) : https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- hreflang (21/09/2026) : https://developers.google.com/search/docs/specialty/international/localized-versions
- Historique des mises à jour de classement : https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history
- Journal des modifications de la documentation (retrait FAQ 07/05/2026) : https://developers.google.com/search/updates

Presse spécialisée :

- Search Engine Land, « Google August 2026 spam update done rolling out » : https://searchengineland.com/google-august-2026-spam-update-done-rolling-out-485471
- Search Engine Land, « Google September 2026 spam update done rolling out » : https://searchengineland.com/google-september-2026-spam-update-done-rolling-out-493550
- Coalition Technologies, « Google September 2026 spam update » : https://coalitiontechnologies.com/blog/google-september-2026-spam-update
- Glenn Gabe, « August 2026 Google spam update case studies » : https://gsqi.com/marketing-blog/august-2026-google-spam-update-case-studies/

## Annexe A. Colonnes des fichiers CSV

`pt_non_indexees.csv` : `chemin` (chemin de l'URL), `url` (URL complète), `perimetre` (`pt` ou `annexe_sans_prefixe`), `motif_gsc`, `groupe` (servicos, urgencia, perto-de-mim, perto-de-mim-hub, cidade, blog, blog-index, hub-section, page-statique, precos, mercados, juridique, recherche, pro-auth, profil-pro, technique), `metier`, `ville`, `dans_sitemap_live` (oui ou non), `derniere_exploration_gsc` (AAAA-MM-JJ), `clics_sept`, `impressions_sept`, `position_moy_sept`, `priorite` (P1, P2, P3 ou technique), `etat_live_13_10`, `note`.

`pt_sitemap_statut_complet.csv` : `chemin`, `groupe`, `metier`, `ville`, `lastmod_sitemap`, `statut_gsc` (`non_indexee_explorée`, `noindex` ou `indexee_deduit`), `derniere_exploration_gsc`, `clics_sept`, `impressions_sept`, `position_moy_sept`, `priorite` (P1, P2, P3, PROTEGER ou vide).

Conventions des deux fichiers : UTF-8 sans BOM, séparateur virgule, fin de ligne LF, guillemets doubles quand une cellule contient une virgule. Cellule vide = donnée absente (voir section 12). `position_moy_sept` avec point décimal. `derniere_exploration_gsc` = date de dernière exploration affichée par GSC.

Tri de `pt_non_indexees.csv` : P1 (clics décroissants), P2 (impressions décroissantes), P3 (hubs de section, hubs métier, villes, pages statiques, precos, mercados, juridique, blog, puis servicos, urgencia, perto-de-mim par chemin), puis les lignes `technique` (autres motifs PT), puis l'annexe. Tri de `pt_sitemap_statut_complet.csv` : par groupe puis par chemin.
