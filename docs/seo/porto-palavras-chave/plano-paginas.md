# Plan de pages — 4 services dans le district de Porto

Date : 19/10/2026. Périmètre : `vitfix.io/pt/` (pt-PT). Services : limpeza de telhados, trabalhos em altura (trabalhos verticais, acesso por corda), renovação de fachadas (prédios e moradias), impermeabilização (telhados, coberturas, terraços).

Ce document ne crée aucune page dans le code. Il dit quelle page doit répondre à chaque mot-clé, quelles pages créer, dans quel ordre, et ce que Frédéric doit trancher avant.

Fichiers liés (même dossier) :

- `palavras-chave-distrito-porto.csv` : les 3 422 mots-clés retenus, chacun avec sa page cible (`page_id`, `url_cible`, `statut_page`).
- `palavras-chave-excluidas.csv` : les 2 890 suggestions écartées (BR, ES, PROD, MARQUE, HORS, EMP, LOC, AUTRE).
- `matriz-geografica.csv` : pour chaque requête « service + concelho » envoyée à Google, l'autocomplétion a-t-elle renvoyé ce lieu ?
- `consignes-google-2026-10-19.md` : les règles Google sur lesquelles ce plan s'appuie. Les liens cités ci-dessous viennent de ce guide.

---

## 0. En bref

- **3 422 mots-clés retenus** après dédoublonnage entre thèmes (51 doublons fusionnés) : A 958, B 1 250, C 1 214. 2 890 exclus. Dont 156 ajoutés par le contrôle de complétude du 19/10 (section 1.1).
- **Aucun volume de recherche.** Les colonnes `hits_autocomplete` (nombre de requêtes différentes qui ont fait remonter la suggestion) et `meilleur_rang` (1 = première suggestion) sont des indices de popularité, pas des volumes. Les outils tiers n'ont pas accès aux données de Google ([Third-party SEO tools](https://developers.google.com/search/docs/fundamentals/third-party-seo)). Les vraies requêtes viendront de Search Console et du rapport de la fiche Business Profile.
- **Chaque mot-clé a une page cible, et chaque page cible est définie** (66 identifiants) :

| Statut | Pages | Mots-clés | dont A | Rôle |
|---|---|---|---|---|
| existante | 51 (11 pages + 40 pages de la grille métier x ville) | 1 065 | 440 | à enrichir, aucune URL nouvelle |
| nouvelle | 5 (3 pages service de district, 2 guides) | 735 | 327 | à créer après décision sur le gel A0 |
| conditionnelle | 9 (4 sous-services, 5 pages concelho) | 519 | 191 | à créer seulement si la condition est remplie, sinon repli indiqué |
| aucune | 1 (`SEM-PAGINA`) | 1 103 | 0 | pas de page : bricolage, produits, inspiration, location de matériel, réglementation pour travailleurs |

- **Principe** : une page forte par intention, les variantes deviennent des sections. Pas de série de pages par concelho. Les requêtes géographiques vont d'abord à la grille existante `/pt/servicos/{metier}-{concelho}/` quand le métier existe (telhador, impermeabilizacao, isolamento-termico, pintor, obras-remodelacao), sinon à la page de district du service.

---

## 1. Données et méthode

- Source : autocomplétion Google pt-PT (hl=pt-PT, gl=pt) récoltée le 19/10/2026, 4 865 requêtes, puis classement par lot (decision, sous-thème, intention, traîne, concelho, priorité), vérification par thème et complément de 1 048 suggestions confirmées par Google (limpeza_telhado 234, altura 232, fachada 288, impermeabilizacao 294), puis contrôle de complétude : 156 suggestions de plus (section 1.1).
- Dédoublonnage : une suggestion présente dans deux thèmes est gardée une fois, avec la priorité la plus haute ; l'autre thème est noté dans `autres_themes`.
- Rattachement : chaque mot-clé reçoit une page par des règles de partage explicites (section 4). Les règles par défaut sont données par sous-thème, les exceptions mot par mot.
- Géographie : 202 mots-clés portent un concelho. Porto en porte 107, Vila Nova de Gaia 22, Maia 15, Matosinhos 12, Gondomar 8, Penafiel 7. Une partie des hausses de Gaia, Maia, Matosinhos et Gondomar vient des zones ARU (questions fiscales, pas des demandes de travaux). Baião n'en porte aucun. « perto de mim » : 11 mots-clés. Pour les trois nouveaux services, l'autocomplétion ne renvoie rien pour la plupart des concelhos de l'intérieur (Paredes, Penafiel, Amarante, Marco de Canaveses, Lousada, Felgueiras, Baião), y compris avec « empresa » ou « preço » (`matriz-geografica.csv`). Une absence de suggestion ne prouve pas l'absence de demande : les requêtes locales rares n'apparaissent pas dans l'autocomplétion.

### 1.1 Contrôle de complétude (19/10, 360 requêtes de plus)

Vingt-trois familles de requêtes qui pouvaient manquer ont été soumises à l'autocomplétion (même réglage pt-PT). Les suggestions pertinentes absentes ont été ajoutées (`lots/ajouts-<theme>-critique.csv`, source « autocomplete (critique) », colonne `preuve` = requête envoyée). Aucun volume : ces lignes disent seulement que Google propose la formulation.

| famille | résultat | effet sur le plan |
|---|---|---|
| urgence (« urgente », « 24 horas ») | une seule suggestion pt-PT : « telhado urgente » (les autres variantes ne renvoient rien ; « conserto de telhado urgente » est brésilien) | aucune page d'urgence (le modèle `/pt/urgencia/` est déjà consolidé) ; la ligne va au hub telhador |
| « orçamento grátis / gratuito » | rien pour les 4 services ; « orçamento + service » existe (orçamento reparação telhado, orçamento pintura prédio, orçamento telhado policarbonato) | 4 lignes A ou B, aucune page |
| saison (« antes do inverno », « chuva », « temporal », « vento ») | rien d'exploitable (paroles de chansons, météo, actualité) | aucun ajout |
| « telhador + concelho » (18 concelhos, Ermesinde, perto de mim, preço) | aucune suggestion : les gens tapent « telhados + concelho », déjà dans la grille | aucun ajout ; la grille telhador garde ses requêtes « telhados {concelho} » |
| coberturas / cobertura | « cobertura » = telhado : empresa de coberturas, reparação et substituição de coberturas, coberturas porto, coberturas industriais, painel sandwich ; le reste vise piscines, gâteaux, opérateurs mobiles ou des marques | 10 lignes, hub telhador (le prix du painel sandwich va à l'article prix) |
| caleiras PVC / zinco / alumínio / cobre | matériaux et prix (zinco, alumínio lacado, cobre, « caleiras sem emendas », caleiras em zinco porto) ; PVC surtout du produit de magasin | 13 lignes au hub telhador, 4 lignes PVC en C sans page |
| claraboias, janelas de telhado | instalação de claraboias, prix au m2, claraboia infiltração ; Velux, desenfumagem et autocaravanas exclus | 10 lignes : 7 au hub telhador, 1 à l'article teto-a-pingar, 2 « janela de telhado » en C sans page |
| chaminés | réparation, vedação et impermeabilização de chaminés (travail de couvreur) ; « limpa chaminés porto » (ramonage) | 8 lignes : 4 au hub telhador, 1 au hub impermeabilização, 1 à l'article teto, 1 détail en C ; le ramonage reste sans page |
| telhados de lousa / xisto / ardósia | 10 formulations (telhado de lousa, telhado de xisto, telhado de ardósia preço…), dont 1 produit en C | hub telhador : section « telhados de lousa e xisto » si l'équipe en a réalisé (Baião, Amarante, Marco de Canaveses) |
| amianto (legislação), lusalite | amianto legislação (portugal, nova), telhas de lusalite (tem amianto, preço), « recolha de telhas lusalite » (A) | 11 lignes à AMIANTO ; aucune requête « amianto + concelho » hors Porto |
| condomínio (quem paga, não faz obras) | obras no prédio quem paga, condomínio não faz obras, pintura prédio condomínio | 4 lignes au guide copropriété, 1 à FACH-PILAR |
| seguro | seguro cobre telhado, multirriscos, temporal | 4 lignes à l'article teto-a-pingar |
| ARU | zones ARU de Gaia, Matosinhos, Maia et Gondomar, benefícios fiscais, ARU + IVA 6 % | 22 lignes à l'article IVA 6 % (la carte ARU de Gaia reste sans page, comme celle de Porto) : la section ARU de l'article doit renvoyer aux pages officielles des câmaras concernées |
| apoios, IVA 6 % | iva 6 mão de obra, iva 6 reabilitação urbana, apoios telhado ; IFRRU, Reabilitar para Arrendar, IMI en C | 6 lignes B (IVA 6 % vers l'article IVA 6 % ; « apoios telhado » vers l'article capoto, rattachement faible), 8 lignes C sans page |
| licença Câmara, ocupação da via pública | rien pour « licença + Câmara do Porto / Gaia / Matosinhos » ; « licença de ocupação de via pública para andaime » | 1 ligne à l'article licença ; les requêtes « ocupação de via pública porto » restent sans page (esplanadas possibles) |
| prédios antigos, centro histórico | rien de nouveau (reabilitação urbana porto renvoie à des événements et à l'IHRU) | aucun ajout |
| gaivotas, pombos, ninhos | gaivotas no porto, gaivotas porto, gaivotas póvoa de varzim (C, signal local) ; remoção de ninhos, remoção de ninhos ICNF | 6 lignes à ANTIPOMBOS ; la page doit dire ce que l'ICNF autorise |
| graffitis à Porto | limpeza de graffitis porto (A), proteção anti graffiti | 2 lignes (FACH-porto, FACH-PILAR), 1 produit en C sans page |
| azulejos, granito, cantaria | rien de nouveau pour les façades (granito = sols, azulejos = inspiration) | aucun ajout |
| reboco de fachada | reboco fachada (de prédio, preço m2), reboco exterior preço m2, rebocar fachada | 11 lignes à FACH-PILAR : section reboco avec prix réels (ces prix restent sur la page façades, pas sur `/pt/precos/pintor/`) |
| alpinistas | alpinistas porto, alpinistas fachadas (porto) | 4 lignes ; TV-porto et FACH-porto passent à 6 mots-clés |
| infiltrações | reparação et detecção de infiltrações, infiltrações porto, peritagem de infiltrações porto, terraço com infiltração o que fazer | 6 lignes (hub impermeabilização, impermeabilizacao-porto, IMP-TERRACOS) |
| conservação de edifícios | conservação de edifícios, manutenção e conservação de edifícios ; manutenção de fachadas de vidro ; pintura prédio 4 andares | 3 lignes à FACH-PILAR, 1 à LV, 1 à la page prix pintor |

Corrections faites pendant ce contrôle : 3 requêtes « impermeabilização fachada / fachada predio / paredes exteriores » passent de C à A (même priorité que leurs jumelles du thème fachada), 3 requêtes « muros » de C à B, « impermeabilização junta de dilatação » de C à B (comme « juntas ») ; les 5 tournures « paredes externas / muro externo » (plutôt brésiliennes) et « impermeabilização fachada ventilada » restent en C, sans page ; 3 requêtes « isolamento exterior de telhado » rangées en fachada vont au hub isolamento-térmico (et plus à l'article capoto) ; « coberturas planas invertidas » rejoint « cobertura plana invertida » (IMP-TERRACOS).

---

## 2. Architecture

### 2.1 Vue d'ensemble

| id | URL | statut | intention dominante | mots-clés (A/B/C) |
|---|---|---|---|---|
| LT-PILAR | `/pt/servicos/limpeza-de-telhados/` | nouvelle | transactionnelle + prix | 261 (151/95/15) |
| FACH-PILAR | `/pt/servicos/renovacao-de-fachadas/` | nouvelle | transactionnelle | 266 (148/117/1) |
| TV-PILAR | `/pt/servicos/trabalhos-verticais/` | nouvelle | transactionnelle + définition | 80 (28/46/6) |
| GUIA-COND | `/pt/blog/obras-condominio-fachada-telhado-quem-paga/` | nouvelle | informationnelle | 104 (0/70/34) |
| GUIA-FISSURAS | `/pt/blog/fissuras-fachada-causas-reparacao/` | nouvelle | informationnelle | 24 (0/22/2) |
| IMP-TERRACOS | `/pt/servicos/impermeabilizacao-de-terracos/` | conditionnelle (contenu distinct) | transactionnelle + prix + technique | 217 (102/98/17) |
| LV | `/pt/servicos/limpeza-de-vidros-em-altura/` | conditionnelle (offre réelle) | transactionnelle | 66 (30/34/2) |
| ANTIPOMBOS | `/pt/servicos/redes-anti-pombos-e-gaivotas/` | conditionnelle (service réel) | informationnelle | 129 (6/114/9) |
| AMIANTO | `/pt/servicos/remocao-de-amianto/` | conditionnelle (habilitation) | transactionnelle + sécurité | 83 (30/46/7) |
| LT-porto | `/pt/servicos/limpeza-de-telhados-porto/` | conditionnelle (preuve locale) | transactionnelle | 7 |
| LT-maia | `/pt/servicos/limpeza-de-telhados-maia/` | conditionnelle (preuve locale) | transactionnelle | 3 |
| LT-vila-nova-de-gaia | `/pt/servicos/limpeza-de-telhados-vila-nova-de-gaia/` | conditionnelle (preuve locale) | transactionnelle | 2 |
| TV-porto | `/pt/servicos/trabalhos-verticais-porto/` | conditionnelle (preuve locale) | transactionnelle | 6 |
| FACH-porto | `/pt/servicos/renovacao-de-fachadas-porto/` | conditionnelle (preuve locale) | transactionnelle | 6 |
| IMP-HUB | `/pt/perto-de-mim/impermeabilizacao/` | existante | transactionnelle + prix | 120 (80/33/7) |
| TEL-HUB | `/pt/perto-de-mim/telhador/` | existante | transactionnelle | 181 (80/98/3) |
| ISO-HUB | `/pt/perto-de-mim/isolamento-termico/` | existante | transactionnelle | 99 (80/19/0) |
| OBRAS-HUB | `/pt/perto-de-mim/obras-remodelacao/` | existante | transactionnelle | 10 (8/2/0) |
| PIN-PRECOS | `/pt/precos/pintor/` | existante | commerciale (prix) | 58 (15/42/1) |
| BLOG-CAPOTO | `/pt/blog/capoto-isolamento-termico-quanto-custa/` | existante | commerciale + informationnelle | 278 (64/213/1) |
| BLOG-TELHADO-PRECO | `/pt/blog/reparar-telhado-preco-portugal/` | existante | commerciale (prix) | 64 (19/45/0) |
| BLOG-TETO | `/pt/blog/teto-a-pingar-o-que-fazer/` | existante | informationnelle | 65 (0/60/5) |
| BLOG-IVA6 | `/pt/blog/iva-6-obras-remodelacao-portugal/` | existante | informationnelle | 59 (0/55/4) |
| BLOG-HUMIDADE | `/pt/blog/humidade-parede-causas-reparacao/` | existante | informationnelle | 17 (0/14/3) |
| BLOG-LICENCA | `/pt/blog/obras-sem-licenca-portugal/` | existante | informationnelle | 14 (0/10/4) |
| grille (40 pages) | `/pt/servicos/{telhador, impermeabilizacao, isolamento-termico, pintor, obras-remodelacao}-{concelho}/` | existante | transactionnelle locale | 100 (94 A) |
| SEM-PAGINA | aucune | aucune | — | 1 103 (0/10/1 093) |

URL : même convention que l'existant (minuscules, tirets, sans accents). Les pages de district des nouveaux services sont sous `/pt/servicos/{service}/`, leurs éventuelles pages concelho sous `/pt/servicos/{service}-{concelho}/`, comme la grille. Le middleware de consolidation (`lib/seo/pt-consolidacao.ts`) ne réécrit que `/pt/urgencia/` et `/pt/perto-de-mim/` : ces slugs ne sont pas interceptés, mais il faudra une route statique à côté de `app/pt/servicos/[slug]/`. Pas de hub `/pt/perto-de-mim/` pour les nouveaux services : la page de district en tient lieu.

### 2.2 Pages nouvelles

#### LT-PILAR — Limpeza de telhados e caleiras no distrito do Porto

- **URL** `/pt/servicos/limpeza-de-telhados/` · **nouvelle** · 261 mots-clés (A 151, B 95, C 15) · transactionnelle 129, commerciale 63, informationnelle 69.
- **Mots-clés principaux** : lavagem e impermeabilização de telhados preço (hits 11) ; lavagem e pintura de telhados preço (11) ; limpeza de telhados preço m2 (7) ; lavagem de telhados preço m2 (7) ; empresa especializada em limpeza de telhados (7) ; empresa de limpeza de telhado de vidro (7) ; limpeza de telhados e caleiras (5) ; limpeza de caleiras e algerozes (4) ; hidrofugação de telhados ; limpeza de painéis solares.
- **Géographie attestée** : limpeza de telhado(s) perto de mim, limpeza de caleiras gondomar (sous le seuil, reste ici), manutenção paineis solares porto. Porto, Maia et Gaia ont assez de signal pour une page conditionnelle (2.3) ; tant qu'elle n'existe pas, ces requêtes reviennent ici.
- **Sections** (les variantes deviennent des sections, pas des URL) : lavagem e tratamento (hidrofugação) ; lavagem e pintura de telhas (matériaux : barro, cimento, metálicas) ; musgo e líquenes ; caleiras e algerozes (limpeza, desentupimento, manutenção) ; coberturas de vidro e policarbonato, claraboias ; painéis solares (seulement si Vitfix le fait) ; manutenção e inspeção anual (drone seulement si réel) ; prix réels au m2 et cas types (100 m2, 200 m2).
- **FAQ visible** : quanto custa lavar um telhado (o metro quadrado, 100 m2, 200 m2) ; quanto custa lavar e hidrofugar / lavar e pintar um telhado ; vale a pena lavar o telhado ; vale a pena pintar o telhado ; como tirar musgo do telhado (et pourquoi la méthode choisie, si l'équipe le confirme) ; quanto custa limpar caleiras ; hidrofugante para que serve e quanto tempo dura ; quem faz limpeza de telhado e como lavar telhado com segurança (ne pas encourager le bricolage en hauteur).
- **Liens** : TEL-HUB (telhas partidas, reparação, montagem de caleiras), IMP-HUB (impermeabilização de telhado), AMIANTO ou, à défaut, l'avertissement fibrocimento, BLOG-TELHADO-PRECO, TV-PILAR (accès difficile), FACH-PILAR (limpeza de fachadas), pages LT-{concelho} publiées seulement.
- **Concurrence observée** : Zaask et Habitissimo occupent les requêtes avec des pages par concelho (Porto, Gaia, Gondomar, Matosinhos, Valongo, Maia, Póvoa) et un guide de prix au m2 ; OLX à l'est (Penafiel, Paredes). Aucun prestataire local fort à l'est du district.

#### FACH-PILAR — Renovação de fachadas : prédios e moradias

- **URL** `/pt/servicos/renovacao-de-fachadas/` · **nouvelle** · 266 mots-clés (A 148, B 117, C 1) · transactionnelle 168.
- **Mots-clés principaux** : pintura de fachadas de prédios por alpinistas (hits 10) ; pintura de fachadas de prédios (7) ; empresa de limpeza de fachadas com drone (7) ; empresas de pintura de prédios (6) ; empresas de reabilitação de fachadas (6) ; empresas de reparação de fachadas (6) ; recuperação de fachadas de prédios (5) ; reparação de fissuras em fachadas (5) ; reparação e pintura de fachadas (5) ; obras fachada condomínio ; reboco fachada, reboco exterior preço m2 ; alpinistas fachadas ; impermeabilização fachada.
- **Géographie attestée** : aucune requête pertinente hors Porto pour ce service (voir FACH-porto, qui reçoit aussi limpeza de graffitis porto et alpinistas fachadas porto). Les requêtes « capoto + concelho » vont à la grille isolamento-termico, « empresa de pintura porto » à pintor-porto.
- **Deux parcours dans la même page** : *prédio* (assembleia de condóminos, orçamento comparável, andaime ou acesso por corda, prazos, fundo de reserva) et *moradia* (pintura exterior, muros, reboco). Deux pages séparées seulement si les étapes, les prix et les chantiers diffèrent vraiment (guide Google 4.3). Sections : reabilitação e reparação (fissuras, reboco et ses prix au m2, betão e varandas) ; pintura de fachadas ; limpeza e lavagem (capoto, pedra, granito, cantarias, graffitis) ; impermeabilização e hidrofugação ; manutenção de capoto existant (reparar, limpar, pintar) ; revestimentos (fachada ventilada, azulejos de fachada à Porto) si le service existe.
- **FAQ visible** : de quanto em quanto tempo tem que pintar o prédio (obligation de conservation tous les 8 ans du RJUE, à vérifier et à citer) ; o capoto pode ser pintado ; como tirar verdete das paredes exteriores ; fachada degradada : reparar ou reabilitar ; obras na fachada precisam de licença (lien BLOG-LICENCA) ; quanto custa (fourchettes réelles de réhabilitation et de limpeza, la peinture renvoie à PIN-PRECOS).
- **Liens** : ISO-HUB (aplicação de capoto), PIN-PRECOS (preços de pintura), TV-PILAR (sem andaime), LV, GUIA-COND, GUIA-FISSURAS, BLOG-HUMIDADE, BLOG-LICENCA, BLOG-IVA6, OBRAS-HUB (reabilitação de casas).
- **Concurrence observée** : Habitissimo (guide « quanto custa pintar um prédio de 3 andares », 10 à 30 €/m²) et Zaask (550 à 12 000 € pour réhabiliter une façade, pages capoto par concelho) ; Fórum da Casa sur les prix du capoto. Pas de site local fort.

#### TV-PILAR — Trabalhos verticais e em altura (acesso por corda)

- **URL** `/pt/servicos/trabalhos-verticais/` · **nouvelle** · 80 mots-clés (A 28, B 46, C 6).
- **Mots-clés principaux** : alpinismo industrial empresas (hits 4) ; trabalhos em altura empresas (4) ; empresa de pintura em altura (4) ; pintura em altura preço (4) ; empresa de acesso por cordas (2) ; empresas trabalhos verticais (2) ; trabalhos verticais ; instalação de linha de vida ; inspeção de fachadas ; selagem de juntas de dilatação.
- **Géographie attestée** : trabalhos em altura gondomar (sous le seuil, reste ici) ; Porto a sa page conditionnelle (TV-porto, avec alpinistas porto).
- **Une seule page pour les synonymes** : trabalhos verticais, trabalhos em altura, acesso por corda(s), alpinismo industrial, rappel. Sections par cas d'usage : pintura em altura et estruturas metálicas ; inspeção e reparação de fachadas por cordas (juntas de dilatação, reboco solto) ; limpeza de vidros (lien LV) ; caleiras inacessíveis (lien LT-PILAR, TEL-HUB) ; linhas de vida (seulement si Vitfix les installe et les certifie). Le titre H1 peut porter « Trabalhos verticais » et le texte les autres termes, sans répétition.
- **FAQ visible** : o que é acesso por corda e quando é preferível ao andaime ; quanto custa (valor da pintura em altura, metro) ; linha de vida é obrigatória ; quanto custa uma linha de vida ; que formação e seguro tem a equipa (seulement des faits vérifiables : IRATA, ANETVA ou autre).
- **Liens** : FACH-PILAR, LT-PILAR, LV, ANTIPOMBOS, TEL-HUB.
- **Concurrence observée** : NCA Trabalhos em Altura (Maia, IRATA, ANETVA, ISO 9001) est le concurrent direct du district ; Habitissimo a un annuaire « trabalhos verticais » par concelho et un guide de prix ; Zaask liste des indépendants. La plupart des fiches Habitissimo sont « não disponível para novos contactos ».

#### GUIA-COND — Obras de fachada, telhado e terraço num prédio : quem decide e quem paga

- **URL** `/pt/blog/obras-condominio-fachada-telhado-quem-paga/` · **nouvelle** · 104 mots-clés (B 70, C 34), tous informationnels.
- **Mots-clés principaux** : fundo de obras condomínio quem paga (hits 6) ; obras de condomínio entram no irs (5) ; obras de caráter urgente condomínio (4) ; infiltrações no telhado condomínio (3) ; obras condomínio permilagem (3) ; obras condomínio iva 6 (3) ; fachada do prédio é parte comum ; varanda é parte comum ; pintura de fachada é responsabilidade do inquilino ou proprietário ; obras de conservação de 8 em 8 anos ; condomínio não faz obras ; obras no prédio quem paga.
- **FAQ visible** : fachada, telhado e terraço de cobertura são partes comuns ; quem paga (permilagem, fundo comum de reserva, quota extra) ; obras urgentes vs obras necessárias, úteis e inovações (maiorias) ; infiltração vinda do telhado ou do terraço : condomínio ou condómino ; obras coercivas da câmara ; IRS e IVA 6 % sur les obras de condomínio.
- **Règle de contenu** : sujet juridique et fiscal. Ne paraphraser que des textes réels (Código Civil, RJUE, CIVA), les citer, et ajouter ce que Vitfix voit sur ses chantiers en copropriété (délais d'assemblée, devis comparables). Relecture par Frédéric. Les requêtes de pure procédure (aviso de obras, horários, minuta, jurisprudência dgsi) sont laissées sans page.
- **Liens** : FACH-PILAR (parcours prédio), IMP-TERRACOS ou IMP-HUB, TEL-HUB, BLOG-TETO (seguro, vizinho de cima), BLOG-IVA6, `/pt/condominio/`.

#### GUIA-FISSURAS — Fissuras e reboco a cair na fachada : causas e reparação

- **URL** `/pt/blog/fissuras-fachada-causas-reparacao/` · **nouvelle** · 24 mots-clés (B 22, C 2), informationnels.
- **Mots-clés principaux** : capoto rachado (hits 2) ; fissuras na fachada ; como reparar fissuras na parede exterior ; como tratar fissuras em paredes exteriores ; fissuras no capoto exterior ; reparar rachas na parede exterior ; tratamento de fissuras em alvenaria ; queda de reboco (causas) ; reboco a cair.
- **FAQ visible** : fissura de retração ou fissura estrutural : como distinguir e quando chamar um técnico ; como se repara uma fissura numa fachada (et pourquoi un mastic seul ne tient pas, si l'équipe le confirme) ; fissuras no capoto : reparar ou refazer ; reboco a cair : risco para quem passa, o que fazer já.
- **Pourquoi un guide et pas une section** : ces requêtes sont des questions « Know » ; la page de service répond au « Do » (QRG § 12.7). À ne publier que si l'équipe apporte des cas réels (photos de fissures, diagnostic, solution).
- **Liens** : FACH-PILAR, BLOG-HUMIDADE, ISO-HUB (capoto), hub pedreiro (fissuras estruturais).

### 2.3 Pages conditionnelles

| id | condition de création | repli tant que la condition n'est pas remplie |
|---|---|---|
| IMP-TERRACOS | Vitfix a un contenu propre aux terraços et coberturas planas : méthode (tela asfáltica, membrana líquida, poliureia, EPDM ou PVC, cobertura invertida), prix réels au m2, chantiers | section « Terraços, varandas e coberturas planas » du hub IMP-HUB |
| LV | limpeza de vidros em altura vendue comme service à part (contrats de condomínios, bureaux, commerces), avec prix et chantiers | section « Vidros » de TV-PILAR |
| ANTIPOMBOS | Vitfix pose réellement des redes, picos ou fios anti-pombos et anti-gaivotas | aucune page ; une ligne dans TV-PILAR si le service existe |
| AMIANTO | Vitfix, ou l'entreprise qui réalise le retrait, est habilitée au retrait d'amiante (procédure et plan de travaux auprès de l'ACT), avec des chantiers documentés | section « Telhados de fibrocimento » dans TEL-HUB : risque, interdiction de laver ou poncer soi-même, renvoi vers une entreprise habilitée |
| LT-porto, LT-maia, LT-vila-nova-de-gaia, TV-porto, FACH-porto | les 5 conditions du guide Google 4.4 et la porte de qualité interne 3.4 : intervention réelle dans le concelho, au moins un chantier documenté (photos, date, problème, solution), délai réel depuis Marco de Canaveses, les 7 tests du guide 2.4 | page de district du service |

Seuil de signal retenu pour proposer une page concelho : au moins 2 mots-clés « service + concelho » renvoyés par Google. C'est un seuil de proposition, pas une autorisation de publier : seule la preuve locale autorise la page. Gondomar (limpeza de caleiras, trabalhos em altura) reste sous le seuil.

Détail des conditionnelles :

- **IMP-TERRACOS** (217 mots-clés, A 102) : impermeabilização de terraços preço m2 (hits 8) ; impermeabilização de coberturas planas preço (7) ; impermeabilização de terraços com tela asfáltica (6) ; preço m2 impermeabilização tela asfáltica (6) ; impermeabilização de terraços com poliureia (5) ; impermeabilização laje preço m2 (5) ; empresa de impermeabilização de laje perto de mim (4) ; impermeabilizar terraço sem quebrar ; impermeabilização de varandas. FAQ : quanto custa impermeabilizar um terraço / uma laje / uma varanda ; quanto tempo dura ; tela asfáltica, membrana líquida ou poliureia ; impermeabilizar sem levantar o pavimento ; como resolver infiltração no terraço. Liens : IMP-HUB, BLOG-TETO, GUIA-COND, hub azulejador (revêtement de terraços).
- **LV** (66, A 30) : limpeza de vidros em altura valor (hits 10) ; limpeza de vidros em altura porto (10) ; limpeza de vidros em altura (8) ; empresa limpeza de vidros em altura (7) ; limpeza de fachadas de vidro (3). Géographie attestée : Porto, Vila Nova de Gaia, Maia, Matosinhos, Póvoa de Varzim, Vila do Conde, perto de mim. Attention : « limpeza de vidros + concelho » sans « altura » peut viser un nettoyage de vitres ordinaire, que Vitfix ne propose pas forcément. FAQ : quanto custa ; de quanto em quanto tempo limpar vidros ; como se limpam vidros exteriores inacessíveis (corda, plataforma, perche à eau pure, drone seulement si réel). Liens : TV-PILAR, FACH-PILAR, hub limpeza-condominio.
- **ANTIPOMBOS** (129, A 6) : demande surtout informationnelle (como afastar pombos do telhado, da varanda, do ar condicionado ; redes de proteção para pombos ; picos anti pombos), quelques requêtes transactionnelles (empresa anti pombos, remoção de ninhos, limpeza de dejetos). Signal local : gaivotas gaia, gaivotas matosinhos, gaivotas no porto, gaivotas póvoa de varzim (plan de contrôle des goélands de l'Área Metropolitana do Porto cité par la presse). FAQ : o que funciona (redes, picos, fios) ; pombos no telhado o que fazer ; gaivotas et ninhos : ce qui est permis (espèces protégées, autorisation ICNF : « remoção de ninhos icnf », à vérifier avant publication). Liens : TV-PILAR, LT-PILAR, TEL-HUB.
- **AMIANTO** (83, A 30) : remoção de amianto preço m2 (hits 3) ; recolha de telhas lusalite ; amianto legislação (portugal, nova legislação) ; telhas de lusalite (tem amianto, preço) ; remoção de amianto porto ; empresas certificadas para remoção de amianto porto ; preço m2 remoção de amianto porto (4) ; substituição de telhas de amianto / fibrocimento ; remoção lusalite. Beaucoup de requêtes visent à laver, peindre ou changer soi-même des telhas de fibrocimento : la page doit le déconseiller clairement (sécurité physique, catégorie YMYL des QRG § 2.3). FAQ : lusalite tem amianto ; é obrigatório remover o amianto ; posso lavar ou pintar telhas de fibrocimento ; quanto custa remover um telhado de amianto ; existem apoios. Liens : TEL-HUB (telhado novo), BLOG-TELHADO-PRECO, LT-PILAR, IMP-HUB.
- **Pages concelho** : LT-porto (limpeza de telhados e caleiras porto, hits 13 ; limpeza de telhados porto, 9 ; limpeza de caleiras porto ; lavagem de telhados porto ; desentupir caleiras porto), LT-maia (limpeza de telhados maia, limpeza de caleiras maia), LT-vila-nova-de-gaia (limpeza de telhados gaia, limpeza de caleiras gaia), TV-porto (empresas de trabalhos verticais porto, trabalhos em altura porto, alpinismo industrial porto, trabalhos verticais porto, alpinistas porto), FACH-porto (reabilitação de fachadas porto, limpeza de fachadas porto, empresas de reabilitação de edifícios no porto, fachada ventilada porto, limpeza de graffitis porto, alpinistas fachadas porto). Remarque : « porto » peut désigner la ville ou le district.

### 2.4 Pages existantes à enrichir

Ces pages couvrent déjà l'intention : on les enrichit (phase 3 du plan interne : contenu réel sur les pages conservées) au lieu de créer une URL concurrente.

| id | mots-clés | ce qui leur revient | ce qu'il faut ajouter (données réelles seulement) |
|---|---|---|---|
| IMP-HUB | 120 | impermeabilização de telhados et de coberturas (inclinadas, zinco, cerâmica, industriais), prix au m2, impermeabilização de caleiras e algerozes et de chaminés, reparação et deteção de infiltrações, « perto de mim » | section telhados et coberturas avec prix réels au m2 ; section terraços tant qu'IMP-TERRACOS n'existe pas ; FAQ durée et prix (quanto tempo dura, quanto custa o metro quadrado) |
| TEL-HUB | 181 | reparação de telhados, arranjar / arranjo / compor, telhas partidas et substituição, retelhar, telhado novo et construção, « coberturas » (empresa, reparação, substituição, industriais), coberturas em zinco, painel sandwich, rufos, montagem / reparação / substituição de caleiras (feitas no local, sem emendas, zinco, alumínio lacado, cobre), claraboias (instalação, prix), chaminés (reparação, vedação), telhados de lousa, xisto et ardósia, « telhado urgente » | section caleiras (montagem, materiais, prix réels au mètre) ; section telhas partidas ; section painel sandwich et zinco ; section chaminés et claraboias ; section lousa et xisto seulement si l'équipe a de vrais chantiers (est du district) ; lien vers LT-PILAR pour le nettoyage |
| ISO-HUB | 99 | aplicação de capoto / ETICS (empresas, orçamento), isolamento exterior de paredes, isolamento de telhados, coberturas et sótão (poliuretano projetado, lã de rocha, cortiça) | section isolamento de telhados ; liens vers BLOG-CAPOTO (prix) et FACH-PILAR (entretien du capoto) |
| OBRAS-HUB | 10 | reabilitação et recuperação de casas antigas, reabilitação de moradias, empresas de reabilitação (urbana) | courte section « reabilitação de casas antigas » si Vitfix en a réalisé |
| PIN-PRECOS | 58 | tous les prix de peinture extérieure : pintura exterior preço m2, pintar casa por fora, quanto custa pintar a fachada de um prédio, quanto custa pintar um prédio de N andares (2 à 20 andares), muros exteriores | section fachada de prédio avec exemples réels par nombre d'étages (andaime ou corda, reparação incluse ou non) ; section moradia ; remplacer les « valeurs de référence » non sourcées par des devis réels (règle interne 0.2) |
| BLOG-CAPOTO | 278 | prix du capoto (capoto preço m2 portugal, hits 9 ; 2026 ; mão de obra ; 6, 8, 10 cm ; cortiça) et questions (o que é, espessura, EPS ou XPS, lã de rocha, humidade, caixilharia, vale a pena, desvantagens), apoios (Fundo Ambiental, Edifícios mais sustentáveis) | prix réels 2026 tirés de devis, épaisseurs réellement posées, réponses aux questions humidade et caixilharia, état réel des apoios 2026 avec source officielle |
| BLOG-TELHADO-PRECO | 64 | prix de réparation, telhado novo preço m2, telhado de zinco, painel sandwich, quanto custa trocar telhas, telha partida o que fazer | section telhado novo (zinco, sandwich, telha) avec prix réels ; section trocar telhas |
| BLOG-TETO | 65 | como resolver / acabar com infiltrações no telhado ou no teto, chove dentro de casa, goteiras, infiltração pela claraboia ou pela chaminé, seguro cobre infiltrações, seguro cobre telhado ou temporal, vizinho de cima, casa alugada | réponse sur le seguro multirriscos et sur l'infiltration venant du voisin ; liens vers IMP-HUB, TEL-HUB et GUIA-COND |
| BLOG-IVA6 | 59 | IVA 6 % (obras, reabilitação urbana, mão de obra, fachada), zones ARU de Porto, Vila Nova de Gaia, Matosinhos, Maia et Gondomar (benefícios fiscais, ARU et IVA 6 %), apoios à reabilitação de casas antigas | section ARU : ce qu'une ARU change pour les travaux (IVA 6 %), avec un lien vers la page officielle de chaque câmara où Vitfix intervient réellement (pas de liste de villes sans contenu) ; rattachement faible pour les « apoios » : liens officiels ou requêtes laissées sans page |
| BLOG-HUMIDADE | 17 | infiltrações nas paredes, humidade parede exterior, salitre, eflorescências | lien vers FACH-PILAR (impermeabilização de fachadas) |
| BLOG-LICENCA | 14 | licença pour pintar prédio ou moradia, capoto, arranjar ou substituir telhado, alteração de fachada, ocupação da via pública pour un andaime | exemples fachada, capoto et telhado dans « preciso de licença para isto ? » |

**Grille métier x ville** (100 mots-clés, 94 en A) : les requêtes géographiques des métiers existants restent sur leur page actuelle, rien n'est créé.

| métier | concelhos attestés (mots-clés) | exemples |
|---|---|---|
| telhador | Porto 27, Vila Nova de Gaia 6, Maia 4, Matosinhos 4, Penafiel 3, Vila do Conde 2, Gondomar 2, Póvoa de Varzim 2, Amarante, Marco de Canaveses, Paredes, Lousada, Paços de Ferreira, Santo Tirso, Trofa, Valongo 1 chacun | empresas de reparação de telhados porto (hits 9), caleiras feitas no local porto, coberturas porto, caleiras em zinco porto, telhados penafiel, caleiras marco de canaveses |
| impermeabilizacao | Porto 11, Vila Nova de Gaia, Maia, Lousada, Penafiel, Trofa, Póvoa de Varzim, Vila do Conde 1 chacun | empresas de impermeabilização de terraços porto (hits 9), infiltrações porto, impermeabilização penafiel |
| isolamento-termico | Porto 7, Vila Nova de Gaia 2, Penafiel 2, Gondomar, Lousada, Paços de Ferreira, Póvoa de Varzim, Trofa, Felgueiras, Maia, Matosinhos, Santo Tirso, Valongo, Vila do Conde 1 chacun | empresas capoto porto, capoto penafiel, capoto felgueiras |
| pintor | Porto 1 | empresa de pintura porto |
| obras-remodelacao | Porto 1 | empresas reabilitação porto |

Ces pages sont déjà soumises à la porte de qualité de la phase 3 : les mots-clés attestés disent quoi y ajouter en priorité (caleiras et telhados sur telhador-porto, capoto sur isolamento-termico-{concelho}), sans liste de localités.

### 2.5 Sans page (`SEM-PAGINA`, 1 103 mots-clés)

1 093 lignes C et 10 lignes B : produits et marques génériques (produto para limpeza de telhado, tela asfáltica xisto, esferovite, massa de capoto), bricolage (como aplicar, limpar telhado com cloro ou vinagre, pintar telhado com rolo), inspiration (cores de fachadas 2026), location de matériel (aluguer de andaimes porto, plataforma elevatória), réglementation pour travailleurs (trabalhos em altura legislação, EPIs, ACT), détails de construction pour professionnels (pormenor, cobertura invertida camadas), procédure de copropriété sans lien avec les travaux (aviso de obras, horários). Les 10 B sont la limpeza de chaminés (6 requêtes, hors des 4 services, à trancher) et les cartes ARU de Porto et de Gaia (requêtes navigationnelles vers la câmara). Le contrôle de complétude y a ajouté des produits (caleiras em PVC, janela de telhado, lousa para telhados), IFRRU, Reabilitar para Arrendar, ARU et IMI, et les tournures « paredes externas / muro externo », plutôt brésiliennes.

Ce n'est pas un oubli : Google déconseille de couvrir chaque variante de longue traîne et de produire beaucoup de contenus sur beaucoup de sujets ([AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) ; [Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)). Ces lignes restent dans le CSV pour la veille : si Search Console montre des impressions réelles sur l'une d'elles, on la rattache à une page existante.

---

## 3. Justification par les règles Google

| Choix | Règle Google | Lien |
|---|---|---|
| Une page de district par nouveau service, pas 18 pages par concelho | Doorway abuse (pages qui ciblent des villes et canalisent vers une seule destination ; pages très semblables) et scaled content abuse | [Spam policies](https://developers.google.com/search/docs/essentials/spam-policies) |
| Synonymes dans la même page (limpeza / lavagem ; trabalhos verticais / acesso por corda / alpinismo industrial ; terraço / laje / cobertura plana) | Ne pas créer un contenu séparé pour chaque formulation d'une recherche ; les systèmes comprennent les synonymes | [AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) |
| Pages concelho seulement en « conditionnelle » avec preuve locale | Le lieu explicite d'une requête compte, mais une page faite d'un modèle où seul le nom change est notée au plus bas | [QRG § 12.3-12.4 et § 4.6.5-4.6.6](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf) |
| Rattacher aux pages existantes (impermeabilização, telhador, isolamento-térmico, preços de pintura, articles) au lieu de créer une URL concurrente | Un même contenu accessible par une seule URL ; regroupement des quasi-doublons sous une canonique | [Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) ; [Canonicalization](https://developers.google.com/search/docs/crawling-indexing/canonicalization) |
| Une seule page Vitfix visée par requête | En général, pas plus de deux résultats d'un même site en tête | [Ranking systems guide](https://developers.google.com/search/docs/appearance/ranking-systems-guide) |
| Page de sous-service seulement si l'intention et le contenu diffèrent (terraços, vidros, amianto, pombos) | Des pages au contenu principal proche sont regroupées et une seule est affichée | [Canonicalization](https://developers.google.com/search/docs/crawling-indexing/canonicalization) |
| Guides pour les questions (condomínio, fissuras) et pages de service pour l'action | Intentions Know et Do distinctes, souvent mêlées ; contenu « non-commodity » fondé sur l'expérience | [QRG § 12.7](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf) ; [AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) |
| Aucune page pour bricolage, produits, inspiration, location | Ne pas chercher à couvrir toutes les variantes ; signal d'alerte : beaucoup de contenus sur beaucoup de sujets | [AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) ; [Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) |
| Prix seulement tirés de vrais orçamentos, chantiers réels, signature d'une personne qui connaît les chantiers | Effort, originalité, expertise de première main ; contenu IA vérifié à la main | [Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) ; [Using generative AI content](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content) |
| Pas de liste de concelhos dans les textes, les titles ni les alt | Keyword stuffing : blocs de texte listant les villes visées | [Spam policies](https://developers.google.com/search/docs/essentials/spam-policies) |
| « perto de mim » envoyé au hub ou à la page de district, pas à une page dédiée | La distance se mesure entre l'entreprise et l'internaute ; c'est la fiche qui pèse | [Tips to improve your local ranking](https://support.google.com/business/answer/7091?hl=en) |
| Amiante, travail en hauteur : déconseiller le bricolage dangereux, rester exact | Sécurité physique : catégorie YMYL | [QRG § 2.3](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf) |
| Arborescence service → district → concelho, fil d'Ariane, liens en contexte | Ce que Google oppose aux doorways ; découverte par les liens | [Spam policies](https://developers.google.com/search/docs/essentials/spam-policies) ; [Link best practices](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) ; [Breadcrumb](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb) |
| URL simples et stables, sans viser de mots-clés | Les mots de l'URL n'ont presque pas d'effet ; convention minuscules et tirets | [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) ; [URL structure](https://developers.google.com/search/docs/crawling-indexing/url-structure) |
| Mots des clients dans title, H1, intertitres, alt et ancres | Employer les mots que les gens tapent, sans répétition | [Search Essentials](https://developers.google.com/search/docs/essentials) |
| Publication par petits lots, mesure après plusieurs semaines | Une amélioration ou une mise en conformité peut prendre des mois à être constatée | [Core updates](https://developers.google.com/search/docs/appearance/core-updates) ; [Spam updates](https://developers.google.com/search/docs/appearance/spam-updates) |

Règles internes appliquées (`docs/seo/instructions-seo-pt-2026-10-13.md`) : 0.2 aucune donnée inventée ; 0.3 pas de texte généré en masse ; 0.7 gel des nouvelles pages métier x ville et des nouveaux métiers ; gabarit 3.2 et porte de qualité 3.4 pour toute page concelho ; interdits de la section 5 (pas de listes de villes, pas de `LocalBusiness` par ville, pas d'`AggregateRating`, pas de `FAQPage`).

---

## 4. Cannibalisation et arbitrages

Règle générale : chaque requête n'a qu'une page cible. Les pages voisines se lient entre elles, elles ne visent pas les mêmes requêtes.

| Conflit | Arbitrage retenu (appliqué dans le CSV) |
|---|---|
| LT-PILAR / TEL-HUB (le hub telhador cite « limpeza de caleiras » et « tratamento e pintura de telhados ») | Nettoyer, laver, traiter, hydrofuger, peindre les telhas, déboucher les caleiras → LT-PILAR. Réparer, arranjar, telhas partidas, retelhar, telhado novo, poser ou remplacer des caleiras, rufos → TEL-HUB. « limpeza e reparação de telhados » → LT-PILAR avec lien. |
| IMP-HUB / TEL-HUB | Requête avec « impermeabilização / impermeabilizar » → IMP-HUB (y compris « reparação e impermeabilização de telhados », « impermeabilização painel sandwich », « impermeabilização de caleiras »). Requête de réparation sans étanchéité → TEL-HUB. |
| IMP-HUB / IMP-TERRACOS | Terraço, laje, placa, cobertura plana, varanda, et les techniques de toit plat (tela asfáltica, membrana líquida, poliureia, EPDM, PVC) → IMP-TERRACOS. Telhado, cobertura inclinada et requêtes génériques → IMP-HUB. Avec un concelho → grille impermeabilizacao-{concelho}. |
| LT-PILAR / IMP-HUB sur « lavagem e impermeabilização de telhados » | LT-PILAR (le geste est un lavage suivi d'un hydrofuge) ; IMP-HUB garde l'étanchéité proprement dite. |
| ISO-HUB / BLOG-CAPOTO | Engager un applicateur (empresa, aplicação, orçamento) → ISO-HUB. Prix et questions (preço m2, espessura, EPS ou XPS, humidade, vale a pena) → BLOG-CAPOTO. La FAQ prix du hub reste courte et renvoie à l'article. |
| ISO-HUB / FACH-PILAR | Poser un capoto → ISO-HUB. Entretenir un capoto existant (reparar, limpar, lavar, pintar, verdete) → FACH-PILAR. Fissures du capoto (question) → GUIA-FISSURAS. Isolation extérieure d'un telhado (même rangée en fachada) → ISO-HUB. |
| FACH-PILAR / PIN-PRECOS / hub pintor | Prix de peinture extérieure (prédio par étages, moradia, muros) → PIN-PRECOS. Engager pour peindre ou réhabiliter une façade → FACH-PILAR. « empresa de pintura porto » → pintor-porto. Le hub pintor garde « pintor » et la peinture intérieure. |
| FACH-PILAR / TV-PILAR | Requête qui contient « fachada » → FACH-PILAR, même avec « em altura » ou « por alpinistas » (le service est la façade, la méthode est une section). Requête « altura / verticais / corda / alpinismo » sans « fachada » → TV-PILAR. |
| FACH-PILAR / LV | « limpeza de fachadas de vidro » et « limpeza de vidros em altura » → LV. « limpeza de vidros e fachadas » → FACH-PILAR (section limpeza, lien LV). |
| FACH-PILAR / hubs pedreiro et limpeza-condominio (« Reparação de fachadas exteriores », « Lavagem de fachadas » dans leurs listes) | Les requêtes façade vont à FACH-PILAR ; ces hubs gardent leur intention (alvenaria, limpeza de partes comuns) et lient FACH-PILAR. |
| FACH-PILAR / OBRAS-HUB | Requête façade (reabilitação de fachadas, de prédios, de edifícios) → FACH-PILAR. Réhabilitation d'une maison entière (casas antigas, moradias, reabilitação urbana) → OBRAS-HUB. |
| AMIANTO / TEL-HUB / LT-PILAR | Tout ce qui contient amianto, fibrocimento ou lusalite → AMIANTO (y compris laver ou peindre ces telhas, à déconseiller, et « recolha de telhas lusalite »). |
| TEL-HUB / IMP-HUB / BLOG-TETO sur chaminés et claraboias | Réparer, vedar, installer → TEL-HUB ; « impermeabilização de chaminés » → IMP-HUB ; infiltration par la chaminé ou la claraboia (question) → BLOG-TETO ; ramonage (limpeza, limpa chaminés) → sans page. |
| « coberturas » | Synonyme de telhado : empresa, reparação, substituição de coberturas → TEL-HUB ; « impermeabilização de coberturas » → IMP-HUB ; coberturas planas → IMP-TERRACOS ; coberturas de piscinas, de terraços (pérgolas, toldos) → exclues. |
| FACH-PILAR / PIN-PRECOS sur le reboco | Prix du reboco (fachada, exterior, au m2) → FACH-PILAR (réhabilitation) ; seuls les prix de peinture vont à PIN-PRECOS, y compris « pintura prédio N andares ». |
| GUIA-COND / BLOG-TETO | Responsabilité du condomínio, partes comuns, permilagem, fundo de reserva, IRS des obras de condomínio → GUIA-COND. Seguro, vizinho de cima, inquilino, casa alugada → BLOG-TETO. |
| GUIA-FISSURAS / FACH-PILAR / BLOG-HUMIDADE | Question sur une fissure → GUIA-FISSURAS ; demande de réparation → FACH-PILAR ; humidité, salitre, eflorescências → BLOG-HUMIDADE. |
| Pages concelho conditionnelles / grille existante | Un métier existant garde ses requêtes géographiques (telhados porto → telhador-porto, capoto penafiel → isolamento-termico-penafiel). Les pages conditionnelles ne prennent que les requêtes des nouveaux services. |

Doublons entre thèmes : 51 suggestions apparaissaient dans deux thèmes (caleiras, arranjar telhado, retelhar, remoção de lusalite, impermeabilização de fachadas, limpeza de fachadas de vidro…). Chacune n'a qu'une ligne dans le CSV ; l'autre thème figure dans `autres_themes`.

---

## 5. Ordre de création conseillé

1. **Maintenant, sans attendre la fin du gel (travail de phase 3 sur des pages conservées)** : recueillir les preuves (photos de chantiers, devis réels anonymisés, délais, qualifications, assurance), puis enrichir les pages existantes dans l'ordre des mots-clés A qu'elles reçoivent : TEL-HUB et telhador-porto (caleiras, telhas, telhado novo), IMP-HUB et impermeabilizacao-porto (telhados, prix au m2, section terraços), ISO-HUB et BLOG-CAPOTO (prix réels 2026), PIN-PRECOS (fachada de prédio), BLOG-TELHADO-PRECO, BLOG-TETO. `lastmod` seulement sur les pages réellement modifiées, entrée au journal SEO PT.
2. **Lot 1 après décision sur le gel** : LT-PILAR (le plus de requêtes A, signal à Porto, Maia et Gaia, complète le hub telhador), puis FACH-PILAR (arbitrages avec pintor, isolamento-térmico et pedreiro à poser avant la rédaction), puis TV-PILAR. Liens depuis les hubs voisins, fil d'Ariane, sitemap avec `lastmod` réel, demande d'indexation pour ces 3 URL seulement.
3. **Mesurer** quelques semaines (indexation, canonique choisie, impressions), sans multiplier les modifications.
4. **Lot 2** : IMP-TERRACOS si son contenu est réellement distinct (sinon la section du hub suffit), GUIA-COND, GUIA-FISSURAS.
5. **Lot 3** : sous-services conditionnels dont la condition est remplie : LV, AMIANTO, ANTIPOMBOS.
6. **Lot 4** : pages concelho qui passent la porte de qualité, une par une : LT-porto en premier (seul signal fort : hits 13 et 9), puis LT-maia, LT-vila-nova-de-gaia, TV-porto, FACH-porto. À l'est (Penafiel, Marco de Canaveses, Amarante, Paredes), aucune requête attestée pour ces services : une page n'y est justifiée que par des chantiers réels, pas par la demande.

---

## 6. Point de décision pour Frédéric : le gel A0 (règle 0.7)

**DECISION PROPRIETAIRE** — La règle 0.7 interdit toute nouvelle page métier x ville, toute nouvelle ville et tout nouveau métier avant la fin de la phase 3. Les trois pages de district (limpeza de telhados, renovação de fachadas, trabalhos verticais) sont trois nouveaux métiers. Une validation de correction tourne dans Search Console sur 914 URL depuis le 14/10/2026, à relire vers le 28/10.

| Option | Ce qu'elle permet | Risque |
|---|---|---|
| A. Gel maintenu jusqu'à la fin de la phase 3 (recommandée pour les pages nouvelles) | Enrichir dès maintenant les 11 pages existantes et la grille (section 5, étape 1), qui reçoivent 1 065 mots-clés dont 440 en A ; préparer textes, photos et prix des 3 pages de district | Les 3 services restent sans page dédiée quelques semaines de plus |
| B. Exception limitée aux 3 pages de district, après lecture de la validation Search Console (vers le 28/10) | Publier LT-PILAR, puis FACH-PILAR et TV-PILAR, avec données réelles ; aucune page concelho ni sous-service | Ajouter de nouveaux métiers pendant la convalescence de l'indexation ; à décider par écrit et à noter au journal |
| C. Levée complète du gel | — | Non recommandée : pages concelho et sous-services sans preuves, au moment où 914 URL sont en cours de réévaluation |

Recommandation : A pour tout, puis B dès que la validation du 28/10 est lue et que les données réelles des trois services sont prêtes. Dans tous les cas, aucune page concelho ni sous-service conditionnel avant la fin de la phase 3.

---

## 7. Autres points à trancher par Frédéric

1. **Qui réalise ces travaux** : équipe Vitfix ou artisans partenaires ? Cela change ce que disent les pages, l'éligibilité à une fiche Business Profile pour ces services et le bloc « supplier » ou « aggregator » (guide Google 3.1).
2. **Services réellement assurés**, qui décident des conditionnelles et de certaines sections : limpeza de vidros em altura (contrats), redes et picos anti-pombos / gaivotas, retrait d'amiante (habilitation), linhas de vida (pose et certification), limpeza de painéis solares, fachada ventilada, restauro de azulejos de fachada, caleiras feitas no local, inspection par drone. Sans service réel, la section ou la page n'existe pas.
3. **Chaminés** : le ramonage (6 requêtes B dont « limpeza de chaminés porto » et « limpa chaminés porto ») est hors des 4 services, aucune page proposée. La réparation, la vedação et l'impermeabilização de chaminés sur le toit vont au hub telhador et au hub impermeabilização, seulement si l'équipe fait ce travail.
4. **IMP-TERRACOS** : page à part ou section du hub ? Elle reçoit 217 mots-clés (102 en A) ; la séparer n'a de sens que si méthode, prix et chantiers diffèrent de la page impermeabilização.
5. **Données réelles** : prix au m2 (lavagem, hidrofugação, pintura de telhas, impermeabilização de terraço, reabilitação de fachada, trabalhos verticais), délais depuis Marco de Canaveses, chantiers par concelho, qualifications pour le travail en hauteur. Sans elles, les blocs prix et chantiers restent absents (règle 0.2).
6. **Repères de prix des concurrents** relevés pendant la vérification (Zaask 3 à 6 €/m2 pour laver un telhado, Habitissimo 10 à 30 €/m² pour peindre un immeuble, etc.) : ce sont des prix affichés par des tiers, pas des données Vitfix. Ils ne doivent pas être recopiés sur les pages.
7. **Vocabulaire** : relecture pt-PT par un Portugais (caleiras, algerozes, telhas partidas, retelhar, arranjar telhado, lusalite ; éviter calha, telhas quebradas, conserto, retelhamento, hidrolavagem, emborrachada).

---

## 8. Fichiers et reproductibilité

- `palavras-chave-distrito-porto.csv` (3 422 lignes) : `mot_cle;theme;sous_theme;intention;traine;nb_mots;concelho;priorite;page_id;url_cible;type_page;statut_page;hits_autocomplete;meilleur_rang;source;preuve;autres_themes;note`. Filtrer `page_id` pour obtenir la liste d'une page.
- `palavras-chave-excluidas.csv` (2 890 lignes) : `mot_cle;theme;code;origine;note`.
- Le rattachement a été produit par un script à partir des lots classés et des règles de la section 4 (règles par sous-thème, exceptions mot par mot) ; contrôle final : 0 mot-clé sans page, 0 page référencée sans définition, 0 concelho hors liste, 0 ligne au nombre de colonnes incohérent. Doublons proches : 338 groupes (singulier/pluriel, accents, ordre des mots, prépositions) ; 21 groupes répartis sur deux pages, presque tous voulus (« X para telhados » = produit, sans page) ; restent à arbitrer à la relecture : « sistema capoto » (ISO-HUB) et « capoto sistema » (BLOG-CAPOTO), « isolamento térmico exterior » (ISO-HUB) et « isolamento termico para exterior » (BLOG-CAPOTO), « trabalhos em altura linha de vida » (B) et « linha de vida trabalho em altura » (C), « impermeabilização de telhados borracha líquida » (B) et « impermeabilização de telhado borracha liquida » (C), « limpeza de vidros fachadas » (FACH-PILAR) et « limpeza de fachadas de vidro » (LV).
