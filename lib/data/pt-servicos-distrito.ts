// Pages de service à l'échelle du district (plan de pages du 19/10/2026,
// docs/seo/porto-palavras-chave/plano-paginas.md) : une page forte par service pour toute la zone de l'équipe, au lieu
// d'une série de pages par concelho (politiques Google « doorway abuse » et « scaled content abuse », guide
// docs/seo/porto-palavras-chave/consignes-google-2026-10-19.md). Le gel A0 (aucun nouveau métier avant la fin de la
// phase 3) a été levé par le propriétaire le 20/10/2026 pour trois pages : limpeza de telhados, renovação de fachadas,
// trabalhos verticais, d'abord pour le distrito do Porto.
//
// Zone étendue le 28/10/2026 (confirmée par le propriétaire) : l'équipe VITFIX, partie de Marco de Canaveses, intervient
// dans TOUS les concelhos des distritos do Porto, de Braga et de Aveiro pour les trois services (et pour le capoto neuf),
// visite en 48 heures au maximum partout, mêmes prix partout. Les trois pages gardent leur URL et couvrent les trois
// distritos (champ `distritos`) : la zone est dite en clair (« nos distritos do Porto, Braga e Aveiro »), jamais par une
// liste de concelhos ou de villages (keyword stuffing), et les pages concelho ne s'ouvrent toujours que sur chantier
// réel documenté, désormais dans toutes les villes de la grille de ces distritos (Braga, Aveiro, Ovar, Águeda comprises).
//
// Règle 0.2 : aucun prix, délai, chantier ni avis dans ces textes. Les prestations citées sont celles que
// le propriétaire a confirmées le 20/10/2026 (lavagem e tratamento antimusgo, hidrofugação, pintura de
// telhas, caleiras e algerozes ; travaux faits par l'équipe VITFIX ; telhados de fibrocimento non traités), puis le
// 21/10/2026 : accès par andaimes ou cordistes certifiés IRATA, lavage haute pression avec un produit pour tuiles avant
// l'impermeabilização (hidrofugante).
// Prix et délais réels : data/seo/local-proof.json (clé « limpeza-de-telhados »), blocs absents tant
// qu'ils sont vides. Textes à relire par le propriétaire.
//
// Renovação de fachadas et trabalhos verticais (23/10/2026) : faits confirmés par le propriétaire du 20 au 23/10/2026,
// les seuls affirmés ici. Travaux faits par l'équipe VITFIX, partie de Marco de Canaveses, dans tout le distrito do Porto
// (zone étendue aux distritos de Braga et de Aveiro le 28/10/2026) ;
// accès par andaimes ou par técnicos de acesso por corda certificados IRATA ; tous les travaux en hauteur sur les
// bâtiments, prédios et moradias : pintura de fachadas et pintura em altura, renovação de fachadas, tratamento de
// infiltrações, impermeabilização, reparação de fissuras, reboco e betão (varandas), lavagem de fachadas, capoto existant
// (reparar, limpar, pintar), selagem de juntas de dilatação, caleiras inacessíveis ; aucun prix publié ; visite en 48 heures
// au maximum (data/seo/local-proof.json, entrée de zone `distritos`). Non confirmés, donc jamais écrits : linhas de vida,
// vidros em altura, drone, graffitis, fachada ventilada, azulejos, estruturas metálicas, inspeção ou relatório, ANETVA, ISO,
// assurances, garanties, marques, années ou taille de l'équipe. Règles légales citées, vérifiées le 23/10/2026 sur le texte
// officiel : RJUE (DL 555/99 republié par le DL 108/2026, en vigueur le 01/10/2026) art. 2.º d) et f), 4.º n.º 2 d) et i),
// 6.º n.º 1 a) et n.º 12, 80.º-A n.º 1, 3 et 5 (informer la câmara et afficher un aviso avant des travaux extérieurs, même
// exemptés), 89.º n.º 1 et 2 ; Código Civil art. 1436.º n.º 2 (Lei 8/2022) ; DL 268/94 art. 4.º n.º 1 ; DL 50/2005
// art. 36.º et 39.º. Relecture indépendante du 23/10/2026 : détails de méthode non confirmés retirés (traitement du ferro,
// tinta compatível, pressão baixa et produit anti-algues, saison sèche, engenheiro, délimitation de la zone, mástique
// elástico, préparation du condomínio, vent fort), à rétablir seulement après validation par le propriétaire
// (docs/seo/journal-pt.md, 23/10/2026). Ordre des étapes des deux méthodes et méthode des juntas validés par le
// propriétaire le 23/10/2026 (« Oui, c'est ça »).

import { DATA_LIGACOES_DISTRITO, DATA_LIGACOES_FACHADAS_TV, DATA_ZONA_DISTRITOS } from '@/lib/seo/pt-datas'
import { CITIES, type CityData } from '@/lib/data/seo-pages-data'
import { dataIsoValida, notasConcelhoDetalhadas, revisaoConcelhoPara, todosChantiersPara, type Chantier } from '@/lib/seo/pt-provas-locais'

export interface PassoServico {
  titulo: string
  texto: string
}

export interface PerguntaServico {
  pergunta: string
  resposta: string
  /** Ajoute à la réponse la fourchette réelle de data/seo/local-proof.json (« exemplo » : avec le calcul pour 100 m²), sur la
   * seule question qui porte sur la prestation chiffrée. */
  preco?: 'simples' | 'exemplo'
}

export interface LigacaoServico {
  href: string
  titulo: string
  texto: string
}

export interface ServicoDistrito {
  /** Segment d'URL : /pt/servicos/{slug}/ (route statique app/pt/servicos/{slug}/page.tsx). */
  slug: string
  /** Nom court du service (fil d'Ariane, cartes de liens). */
  nome: string
  /** `serviceType` du nœud `Service`. */
  tipoServico: string
  icon: string
  /**
   * Distritos servis (valeurs de `CityData.distrito`), dans l'ordre où la page les nomme : JSON-LD `areaServed`, pages ville
   * et de la grille qui lient la page, chantiers affichés et pages concelho possibles. Le titre, le H1 et le résumé les
   * nomment en toutes lettres (test : même zone partout).
   */
  distritos: readonly string[]
  /** Titre sans marque (le template `%s | VITFIX` l'ajoute) et h1. */
  titulo: string
  /**
   * Titre sans la zone (`titulo` = « {tituloSemZona}: {distritos} », test) : texte des liens vers la page là où un
   * intertitre ou une phrase dit déjà la zone (/pt/servicos/, hubs qui lient plusieurs pages de district, plan du site),
   * pour ne pas répéter les noms des distritos dans chaque ancre (keyword stuffing).
   */
  tituloSemZona: string
  h1: string
  /** Première phrase de la description (la phrase de contact suit, voir descricaoServicoDistrito). */
  resumo: string
  intro: string
  /** Titres de section propres au service (le composant est commun aux pages de district). */
  titulos: { preco: string; metodo: string; sinais: string; ligacoes: string; ctaFinal: string; /** Titre des particularités locales des pages concelho, suivi de « de/do/da {concelho} ». */ local: string }
  /** Réserve de l'exemple de prix pour 100 m² (« conforme o acesso e o estado do telhado »). */
  ressalvaPreco: string
  /** Phrase finale du message WhatsApp, suivie du lieu (« O telhado fica » + « no Porto. » ou « em … »). */
  mensagemLocal: string
  /** Encadré d'appel à l'action du bloc prix, suivi du numéro affiché. */
  textoOrcamento: string
  prestacoes: PassoServico[]
  metodo: PassoServico[]
  sinais: string[]
  frequencia: string
  fatoresPreco: string[]
  aviso?: PassoServico
  /**
   * Ce qui change pour le travail d'un endroit à l'autre de la zone (climat, environnement), rendu dans la section « Onde
   * trabalhamos » de la page de district (pas sur les pages concelho) : faits vérifiés sur une source publique citée dans
   * le commentaire des données, concelhos nommés seulement là où le fait les concerne, jamais plus de deux d'affilée (test).
   */
  condicoesLocais?: { titulo: string; intro: string; zonas: PassoServico[] }
  faqs: PerguntaServico[]
  ligacoes: LigacaoServico[]
  /** Métiers de la grille dont les pages des `distritos` et le hub lient cette page. */
  metiersLigados: string[]
  /** Phrase qui précède le lien sur un hub métier qui ne lie que cette page de district (sinon, phrase commune). */
  chamadaHub: string
  /** Début du message WhatsApp prérempli (le lieu suit, voir mensagemLocal). */
  mensagemWhatsapp: string
  /**
   * Dernière modification significative des textes repris sur les pages concelho (lastmod), jour de la mise en production,
   * y compris un prix ou un délai de data/seo/local-proof.json (dataModificacaoDistrito ne lit aucune date dans `precos` ni
   * `prazos`). Pour une nouvelle modification, une nouvelle constante de lib/seo/pt-datas.ts, mise ici pour les seuls
   * services touchés : jamais DATA_ZONA_DISTRITOS avancée, qui date aussi les liens et d'autres pages.
   */
  dataModificacao: string
  /**
   * Dernière modification des cartes de liens (`ligacoes`) de la page de district, quand elle est postérieure à
   * `dataModificacao`. Elle n'entre que dans le lastmod de la page de district (dataModificacaoDistrito) : le gabarit des
   * pages concelho n'affiche pas ces cartes.
   */
  dataModificacaoLigacoes?: string
  /**
   * Dernière modification des liens vers cette page ou de leur texte (titre, titre sans la zone ou résumé de la page,
   * phrase de zone) sur les pages qui les affichent : hubs des metiersLigados, pages ville des `distritos`, /pt/servicos/,
   * plan du site. C'est leur lastmod, la plus récente si elles lient plusieurs pages de district.
   */
  dataLigacoes: string
  /**
   * Jour où les liens vers cette page sont apparus sur les pages de la grille des metiersLigados, par distrito (clé : valeur
   * de `CityData.distrito`, une par entrée de `distritos`) : leur lastmod. Leur ancre ne reprend que le nom du service et le
   * distrito de la page qui lie (« Limpeza de telhados no distrito de Braga »), d'où une date par distrito : un changement de
   * titre ou de zone ne les modifie pas.
   */
  dataLigacoesGrelha: Readonly<Record<string, string>>
}

/** Zone de l'équipe VITFIX confirmée par le propriétaire le 28/10/2026 : tous les concelhos de ces distritos. */
export const DISTRITOS_EQUIPA: readonly string[] = ['Porto', 'Braga', 'Aveiro']

/**
 * Liens des pages de la grille vers une page de district : dans le distrito do Porto depuis `desdePorto` (jour de la
 * publication de la page), dans les distritos de Braga et de Aveiro depuis l'extension de la zone (DATA_ZONA_DISTRITOS).
 */
const ligacoesGrelha = (desdePorto: string): Readonly<Record<string, string>> => ({ Porto: desdePorto, Braga: DATA_ZONA_DISTRITOS, Aveiro: DATA_ZONA_DISTRITOS })

export const LIMPEZA_DE_TELHADOS: ServicoDistrito = {
  slug: 'limpeza-de-telhados',
  nome: 'Limpeza de telhados',
  tipoServico: 'Limpeza de telhados e caleiras',
  icon: '🏠',
  distritos: DISTRITOS_EQUIPA,
  // Titre gardé (requêtes de l'autocomplétion Google du 28/10/2026 : « limpeza de telhados e caleiras porto », « limpeza de
  // telhados braga », « limpeza de telhados aveiro ») ; H1 et résumé avec « lavagem » et « impermeabilização » (« lavagem de
  // telhados aveiro », « lavagem de telhados braga », « lavagem de telhados preço m2 »), sans perdre « limpeza de telhados » ;
  // description de 154 caractères avec le numéro (test).
  titulo: 'Limpeza de telhados e caleiras: Porto, Braga e Aveiro',
  tituloSemZona: 'Limpeza de telhados e caleiras',
  h1: 'Limpeza de telhados e caleiras: lavagem e impermeabilização nos distritos do Porto, Braga e Aveiro',
  resumo: 'Limpeza de telhados e caleiras: lavagem, impermeabilização e pintura de telhas nos distritos do Porto, Braga e Aveiro.',
  intro:
    'A equipa VITFIX limpa telhados e caleiras em todos os concelhos destes três distritos, a partir de Marco de Canaveses: lavagem do telhado com tratamento contra o musgo e os líquenes, impermeabilização das telhas (hidrofugação), pintura de telhas e limpeza de caleiras e algerozes. Não limpamos telhados de fibrocimento (lusalite). O orçamento é grátis e sem compromisso.',
  titulos: {
    preco: 'Quanto custa a limpeza de um telhado',
    metodo: 'Como fazemos a limpeza de um telhado',
    sinais: 'Quando limpar o telhado',
    ligacoes: 'Quando a limpeza não chega',
    ctaFinal: 'Peça o orçamento para o seu telhado',
    local: 'Os telhados',
  },
  ressalvaPreco: 'conforme o acesso e o estado do telhado',
  mensagemLocal: 'O telhado fica',
  textoOrcamento: 'O orçamento é grátis e sem compromisso. Envie-nos a área aproximada e algumas fotografias do telhado por WhatsApp, ou ligue para',
  prestacoes: [
    {
      titulo: 'Lavagem e tratamento antimusgo',
      texto: 'Retiramos o musgo, os líquenes e a sujidade acumulada nas telhas e aplicamos um tratamento que atrasa o regresso do musgo.',
    },
    {
      titulo: 'Impermeabilização das telhas',
      texto: 'Depois da lavagem, com o telhado seco, aplicamos um hidrofugante que impermeabiliza as telhas: absorvem menos água, secam mais depressa e o musgo demora mais a voltar.',
    },
    {
      titulo: 'Pintura de telhas',
      texto: 'Para telhas desbotadas mas inteiras: lavagem completa e pintura com tinta própria para coberturas.',
    },
    {
      titulo: 'Caleiras e algerozes',
      texto: 'Retiramos folhas, terra e lamas das caleiras e dos algerozes.',
    },
  ],
  // Méthode confirmée par le propriétaire (20 et 21/10/2026). Compte rendu au client et contrôle des tubos de queda :
  // à faire confirmer avant d'être écrits ici.
  metodo: [
    {
      titulo: 'Avaliação do telhado',
      texto: 'Tipo e estado das telhas, inclinação, altura e acessos, quantidade de musgo e estado das caleiras: é o que define o trabalho e o preço.',
    },
    {
      titulo: 'Acesso e segurança',
      texto: 'Conforme a altura e o acesso, trabalhamos a partir de andaimes ou com técnicos de acesso por corda certificados IRATA.',
    },
    {
      titulo: 'Lavagem',
      texto: 'Lavamos o telhado com máquina de alta pressão e um produto de limpeza próprio para telhas, que retira o musgo, os líquenes e a sujidade.',
    },
    {
      titulo: 'Tratamento e impermeabilização',
      texto: 'Com o telhado limpo e seco, aplicamos o tratamento antimusgo e, se o pedir, o hidrofugante que impermeabiliza as telhas.',
    },
    {
      titulo: 'Caleiras e algerozes',
      texto: 'Limpamos as caleiras e os algerozes e recolhemos os resíduos.',
    },
  ],
  sinais: [
    'Musgo, líquenes ou manchas escuras nas telhas.',
    'Caleiras que transbordam quando chove, ou ervas a crescer dentro delas.',
    'Água a escorrer pela fachada ou manchas de humidade junto ao beirado.',
    'Telhas que continuam molhadas muito depois da chuva, sobretudo nas águas viradas a norte ou à sombra de árvores.',
  ],
  frequencia:
    'Não há um intervalo fixo: depende da exposição do telhado, das árvores à volta e da humidade. Com os invernos chuvosos da zona onde trabalhamos, vale a pena verificar o telhado e as caleiras todos os anos, de preferência antes das chuvas de outono.',
  fatoresPreco: [
    'A área do telhado.',
    'A inclinação, a altura e o acesso: andaime ou acesso por corda.',
    'O tipo e o estado das telhas.',
    'A quantidade de musgo e de sujidade.',
    'Os tratamentos escolhidos: antimusgo, impermeabilização, pintura.',
    'O comprimento e o estado das caleiras.',
  ],
  aviso: {
    titulo: 'Telhados de fibrocimento (lusalite): não fazemos a limpeza',
    texto:
      'As placas de fibrocimento instaladas até 2005 podem conter amianto, e só uma análise em laboratório o confirma. Lavar, escovar ou raspar estas placas pode libertar fibras perigosas para a saúde; por isso, não limpamos telhados de fibrocimento. Em Portugal, a remoção de materiais com amianto está sujeita, em regra, a autorização prévia da ACT (Autoridade para as Condições do Trabalho), que aprova o plano de trabalhos, nos termos do Decreto-Lei n.º 266/2007. Se não sabe de que material é o seu telhado, envie-nos uma fotografia antes de marcar.',
  },
  // Demande du propriétaire du 28/10/2026 : toucher Águeda, Aveiro et tout le distrito de Aveiro sans liste de villes ni page
  // satellite. Faits vérifiés le 28/10/2026, seuls écrits ici :
  // - IPMA, normais climatológicas 1991-2020 (fiches de 2024, versão 1.0) : Aveiro / Universidade (estação 702, 3,6 m),
  //   https://www.ipma.pt/bin/file.data/climate-normal/cn_91-20_AVEIRO.pdf : 975,5 mm, 97,2 dias com P >= 1 mm, 0,3 dias
  //   com TN < 0 °C ; Porto / Pedras Rubras (545, 67,7 m),
  //   https://www.ipma.pt/opencms/bin/file.data/climate-normal/cn_91-20_PORTO_PEDRAS_RUBRAS.pdf : 1146,9 mm, 105,4 dias,
  //   1,4 dias ; Braga / Merelim (622, 68,4 m), https://www.ipma.pt/bin/file.data/climate-normal/cn_91-20_BRAGA_MERELIM.pdf :
  //   1387,3 mm, 113,5 dias, 24,3 dias. « Dias de geada » = TN < 0 °C (légende des fiches). Normales calculées sur des séries
  //   hybrides (données observées complétées par le modèle WRF ; Braga / Merelim : données depuis 1999) : le texte dit « a
  //   normal 1991-2020 do IPMA dá », jamais « a estação regista ».
  // - APA, Plano Nacional da Água (2002), vol. 1, cap. II, 1.2.1.1,
  //   https://apambiente.pt/sites/default/files/_SNIAMB_Agua/DRH/PlaneamentoOrdenamento/PNA/2002/Volume1_Capitulo2_T01.pdf :
  //   précipitation moyenne annuelle « próximos de 4000 mm » en certains points de la serra do Gerês. Source et période
  //   différentes des normales IPMA : le texte nomme le Plano Nacional da Água, et l'introduction ne parle que des stations.
  // - ISO 9223:2012, tableau C.1 (exemples d'environnements), C4 (corrosividade alta) en climat tempéré : « coastal areas
  //   without spray of salt water », sans distance (reproductions du tableau lues par la relecture du 28/10/2026 ; texte de la
  //   norme, payant, non lu). Le « < one kilometre of the ocean » de la fiche n° 8 de la Hot Dip Galvanizers Association
  //   Southern Africa (https://www.hdgasa.org.za/wp-content/uploads/2015/12/HDGA-Info-Sheet-No8-Corrosion-of-Zinc-Corrosivity-of-Atmospheres.pdf)
  //   est une adaptation du tableau, non reprise ; la même fiche dit les chlorures apportés par les vents de mer.
  // - Regulamento Delegado (UE) 2017/1475 da Comissão, de 26 de janeiro de 2017 (classes de résistance au gel des tuiles en
  //   terre cuite de la EN 1304, essai EN 539-2), https://apcmc.pt/legislacao/telhas-ceramica-uso-exterior-resistencia-ao-gelo/
  // - Águeda : forêt sur près des trois quarts du concelho, eucalyptus dominant (PMDFCI 2021-2030, caderno I, déjà cité par
  //   lib/data/pt-servicos-concelho.ts).
  // Non vérifié, donc non écrit : fréquence du brouillard (nevoeiro) sur la côte (aucune normale récente publiée par l'IPMA
  // trouvée) ; humidité plus forte sur la côte, et donc mousse et lichens qui y repousseraient plus vite (PNA 2002, 1.2.1.4,
  // normales 1951-1980 : « não apresenta tendências claras » ; humidité relative à 9 h des normales IPMA 1971-2000, fiches
  // cn_71-00_ANADIA et cn_71-00_AVEIRO lues par la relecture du 28/10/2026 : 81 % à Anadia, dans l'intérieur, contre 80 % à
  // Aveiro, sur la côte) ; pluie ou gel chiffrés dans les serras du distrito do Porto et de Aveiro ; durée de vie des
  // caleiras. Côté propriétaire, un conseil (« vale a pena vigiar ») et non un contrôle de l'équipe : la méthode confirmée ne
  // couvre que l'« estado das caleiras » à l'avaliação. Fréquence conseillée : celle de la FAQ et de « Quando limpar »
  // (vérifier tous les ans, avant les pluies d'automne), aucune promesse nouvelle de l'équipe.
  condicoesLocais: {
    titulo: 'O que muda no telhado de uma zona para outra',
    intro:
      'Os três distritos não têm o mesmo clima, e isso vê-se nas telhas e nas caleiras. Os valores das estações do IPMA são médias anuais das normais climatológicas 1991-2020; os dias de geada são os dias com temperatura mínima abaixo de 0 °C.',
    zonas: [
      {
        titulo: 'Junto ao mar e à Ria de Aveiro',
        texto:
          'Perto da costa quase nunca gela: 0,3 dias de geada por ano na estação da Universidade de Aveiro, junto à ria, e 1,4 na de Pedras Rubras, no aeroporto do Porto. Em contrapartida, o vento do mar traz sal, que ataca o metal: a norma internacional sobre a corrosividade da atmosfera (ISO 9223) dá as zonas costeiras sem salpicos de água do mar como exemplo de corrosividade alta para os metais, em clima temperado. Numa casa perto da praia, em Vila do Conde ou em Espinho, vale a pena vigiar as caleiras metálicas, os rufos e os remates de chapa: corrosão, furos e uniões abertas.',
      },
      {
        titulo: 'No interior: mais geada e mais chuva',
        texto:
          'À medida que nos afastamos da costa, a geada passa a contar: a normal 1991-2020 do IPMA para Braga (Merelim) dá 24,3 dias de geada e 1387,3 mm de chuva por ano, contra 0,3 dias e 975,5 mm em Aveiro. Uma telha que passa o inverno encharcada sofre com o gelo e o degelo, e é por isso que as telhas cerâmicas têm uma classe europeia de resistência ao gelo (Regulamento Delegado (UE) 2017/1475). Antes do inverno, troque as telhas partidas ou fissuradas: a lavagem e o hidrofugante não as reparam.',
      },
      {
        titulo: 'Na serra e entre árvores',
        texto:
          'Nas serras chove ainda mais: em alguns locais da serra do Gerês, o Plano Nacional da Água indica médias perto de 4000 mm por ano. Quando a casa está rodeada de árvores, as folhas, as agulhas dos pinheiros e a casca dos eucaliptos enchem as caleiras e os algerozes, e a sombra deixa as telhas húmidas mais tempo. Em Águeda, por exemplo, a floresta ocupa perto de três quartos do concelho e o eucalipto domina os povoamentos. Nestas casas, as caleiras entopem mais depressa, e a verificação de todos os anos, antes das chuvas de outono, conta ainda mais.',
      },
    ],
  },
  faqs: [
    {
      pergunta: 'Quanto custa limpar um telhado?',
      resposta:
        'Depende da área, da inclinação e do acesso, do tipo e do estado das telhas, da quantidade de musgo e dos tratamentos escolhidos. Para lhe enviarmos um orçamento, precisamos da área aproximada e de ver o telhado, em fotografia ou no local. O orçamento é grátis e sem compromisso.',
    },
    {
      pergunta: 'Quanto custa lavar e impermeabilizar (hidrofugar) um telhado?',
      preco: 'exemplo',
      resposta:
        'Custa mais do que a lavagem simples, porque a hidrofugação, a que muitos chamam impermeabilização do telhado, é um passo a mais, feito depois da lavagem e com o telhado seco. Diga-nos no pedido se quer a lavagem com hidrofugação, para o orçamento incluir as duas.',
    },
    {
      pergunta: 'Vale a pena pintar o telhado?',
      resposta:
        'Pode valer a pena em telhas desbotadas mas inteiras: a pintura devolve a cor e protege a superfície. A pintura não substitui a reparação: telhas partidas ou fissuradas têm de ser trocadas antes.',
    },
    {
      pergunta: 'Como tirar o musgo do telhado?',
      resposta:
        'Primeiro retira-se o musgo mais espesso, depois lava-se o telhado com uma pressão adequada à telha e, por fim, aplica-se um tratamento antimusgo. Num telhado de fibrocimento (lusalite), não lave nem escove as placas: podem libertar fibras de amianto. Subir a um telhado sem proteção contra quedas é perigoso: sem o equipamento certo, peça a uma equipa habituada a trabalhar em altura.',
    },
    {
      pergunta: 'De quanto em quanto tempo se deve limpar o telhado?',
      resposta:
        'Não há uma periodicidade fixa. Vale a pena verificar o telhado e as caleiras todos os anos, antes das chuvas de outono, e limpar quando aparecem musgo ou líquenes, ou quando as caleiras entopem.',
    },
    {
      pergunta: 'Quanto custa limpar as caleiras?',
      resposta:
        'Depende do comprimento das caleiras, da altura e do acesso, e da quantidade de folhas e lamas. Se também precisa de limpar o telhado, peça as duas coisas no mesmo orçamento.',
    },
    {
      pergunta: 'Para que serve o hidrofugante?',
      resposta:
        'Reduz a água que as telhas absorvem: secam mais depressa e o musgo demora mais a voltar. Não repara telhas partidas nem resolve infiltrações: se já entra água em casa, é preciso reparar ou impermeabilizar a cobertura.',
    },
    {
      pergunta: 'Limpam telhados de fibrocimento ou de lusalite?',
      resposta:
        'Não. As placas de fibrocimento antigas podem conter amianto e a lavagem pode libertar fibras perigosas. Para estes telhados, consulte uma empresa autorizada pela ACT para trabalhos com amianto.',
    },
  ],
  ligacoes: [
    {
      href: '/pt/perto-de-mim/telhador/',
      titulo: 'Reparação de telhados',
      texto: 'Telhas partidas, rufos, beirados, infiltrações e telhado novo.',
    },
    {
      href: '/pt/perto-de-mim/impermeabilizacao/',
      titulo: 'Impermeabilização',
      texto: 'Telhados, coberturas planas e terraços com infiltrações: o que a lavagem e o hidrofugante não resolvem.',
    },
    {
      href: '/pt/servicos/renovacao-de-fachadas/',
      titulo: 'Renovação de fachadas',
      texto: 'Fissuras, verdete e infiltrações na fachada quando a água das caleiras escorre pela parede.',
    },
    {
      href: '/pt/servicos/trabalhos-verticais/',
      titulo: 'Trabalhos verticais',
      texto: 'Caleiras a que não se chega do chão nem do telhado, e outros trabalhos em altura, por corda ou andaime.',
    },
    {
      href: '/pt/blog/reparar-telhado-preco-portugal/',
      titulo: 'Quanto custa reparar um telhado',
      texto: 'Guia de preços da reparação de telhados em Portugal.',
    },
    {
      href: '/pt/blog/teto-a-pingar-o-que-fazer/',
      titulo: 'Teto a pingar: o que fazer',
      texto: 'Os primeiros passos quando a água já entra em casa.',
    },
  ],
  metiersLigados: ['telhador', 'impermeabilizacao'],
  chamadaHub: 'Lavagem do telhado, tratamento antimusgo e limpeza de caleiras feitos pela equipa VITFIX:',
  mensagemWhatsapp: 'Olá! Gostaria de um orçamento para a limpeza de um telhado.',
  // Contenu : DATA_PAGINAS_DISTRITO (22/10/2026) jusqu'à l'extension de la zone aux distritos de Braga et de Aveiro ; H1,
  // résumé et `condicoesLocais` changés le même jour, dans le même lot (voir DATA_ZONA_DISTRITOS).
  dataModificacao: DATA_ZONA_DISTRITOS,
  // Cartes vers renovação de fachadas et trabalhos verticais, ajoutées le jour des liens vers ces deux pages.
  dataModificacaoLigacoes: DATA_LIGACOES_FACHADAS_TV,
  // Titre et résumé repris par les hubs, les pages ville, /pt/servicos/ et le plan du site : changés avec la zone.
  dataLigacoes: DATA_ZONA_DISTRITOS,
  dataLigacoesGrelha: ligacoesGrelha(DATA_LIGACOES_DISTRITO),
}

// Page FACH-PILAR du plan du 19/10/2026 (docs/seo/porto-palavras-chave/plano-paginas.md, section 2.2) : deux parcours dans
// la même page, prédio (assembleia, orçamentos comparables, fundo comum de reserva) et moradia, par la FAQ. Les requêtes
// qui contiennent « fachada » viennent ici, même avec « em altura » ou « por alpinistas » (arbitrage de la section 4).
export const RENOVACAO_DE_FACHADAS: ServicoDistrito = {
  slug: 'renovacao-de-fachadas',
  nome: 'Renovação de fachadas',
  tipoServico: 'Reparação, impermeabilização e pintura de fachadas',
  icon: '🏢',
  distritos: DISTRITOS_EQUIPA,
  titulo: 'Reparação e pintura de fachadas: Porto, Braga e Aveiro',
  tituloSemZona: 'Reparação e pintura de fachadas',
  h1: 'Renovação de fachadas de prédios e moradias nos distritos do Porto, Braga e Aveiro',
  resumo: 'Reparação, impermeabilização e pintura de fachadas de prédios e moradias nos distritos do Porto, Braga e Aveiro.',
  intro:
    'A equipa VITFIX repara, impermeabiliza, lava e pinta fachadas de prédios e de moradias em todos os concelhos destes três distritos: fissuras, reboco solto, betão das varandas, infiltrações e capoto já aplicado. Para chegar à parede, montamos andaime ou trabalhamos em acesso por corda, com técnicos que têm certificação IRATA. O orçamento é gratuito e não o obriga a nada.',
  titulos: {
    preco: 'Quanto custa renovar uma fachada',
    metodo: 'Como trabalhamos numa fachada',
    sinais: 'Sinais de que a fachada precisa de obras',
    ligacoes: 'Outros trabalhos e guias para o edifício',
    ctaFinal: 'Peça uma visita e um orçamento para o seu edifício',
    local: 'As fachadas',
  },
  ressalvaPreco: 'segundo o estado do reboco e o acesso à parede',
  mensagemLocal: 'A fachada fica',
  textoOrcamento:
    'Para prepararmos o orçamento, que é gratuito, diga-nos se se trata de um prédio ou de uma moradia, quantos pisos tem e o que vê na parede. Pode enviar fotografias por WhatsApp ou ligar para',
  prestacoes: [
    {
      titulo: 'Fissuras e reboco',
      texto: 'Reparamos fissuras e fendas e refazemos o reboco que está oco, empolado ou a cair, para que a tinta assente numa base firme.',
    },
    {
      titulo: 'Betão das varandas',
      texto: 'Reparamos as varandas cujo betão estala, se desfaz ou já deixa o ferro à vista.',
    },
    {
      titulo: 'Infiltrações e impermeabilização',
      texto: 'Procuramos o ponto por onde a água entra, reparamo-lo e impermeabilizamos a parede, para a humidade deixar de chegar ao interior.',
    },
    {
      titulo: 'Limpeza e lavagem de fachadas',
      texto: 'Lavamos paredes rebocadas e de capoto para retirar o verdete, a poluição e as escorrências, antes de pintar ou como manutenção.',
    },
    {
      titulo: 'Capoto existente',
      texto: 'Reparamos buracos, fissuras e zonas danificadas de um capoto que já existe, limpamos o verdete e voltamos a pintá-lo.',
    },
    {
      titulo: 'Pintura de fachadas',
      texto: 'Pintamos prédios e moradias por fora, depois das reparações, a partir de andaime ou por acesso por corda.',
    },
  ],
  // Méthode rédigée le 23/10/2026 avec les seules prestations confirmées, dans l'ordre usuel (lavagem, reparações,
  // impermeabilização e pintura) : ordre validé par le propriétaire le 23/10/2026. Choix de l'accès dans l'étape de visite (les
  // critères sont dans la FAQ sur les alpinistas). Aucun produit, temps de séchage, compte rendu ni contrôle final promis.
  metodo: [
    {
      titulo: 'Visita e diagnóstico',
      texto: 'Vemos as fissuras, o reboco solto ou oco, o betão das varandas, as manchas de humidade e o estado da tinta, e escolhemos o acesso: andaime ou corda. É o que define os trabalhos e o orçamento.',
    },
    {
      titulo: 'Lavagem',
      texto: 'Lavamos a fachada para retirar o verdete, a sujidade e a tinta que já se solta.',
    },
    {
      titulo: 'Reparações',
      texto: 'Tratamos as fissuras, refazemos o reboco e o betão e vedamos as juntas e os pontos por onde entra a água.',
    },
    {
      titulo: 'Impermeabilização e pintura',
      texto: 'Impermeabilizamos e pintamos a fachada, seja de reboco ou de capoto. No fim, desmontamos o andaime ou retiramos as cordas.',
    },
  ],
  sinais: [
    'Fissuras que voltam a abrir depois de pintadas.',
    'Reboco que soa a oco quando se bate, que empola ou que já caiu.',
    'Betão a estalar ou ferro à vista nas varandas.',
    'Manchas de humidade ou bolor no interior, junto às paredes exteriores.',
    'Verdete e escorrências escuras nas zonas que apanham pouco sol.',
    'Tinta a descascar, ou que deixa pó branco nos dedos quando se lhe toca.',
  ],
  frequencia:
    'Os sinais aparecem aos poucos e agravam-se de um inverno para o outro. Num prédio, convém levar os orçamentos à assembleia de condóminos com tempo, antes que os estragos aumentem.',
  fatoresPreco: [
    'A área da fachada e o número de pisos.',
    'Como se chega à parede: andaime ou técnicos de acesso por corda, e o espaço disponível no passeio.',
    'O estado do reboco e do betão: fissuras, zonas ocas, ferro à vista nas varandas.',
    'As infiltrações a tratar e a extensão da impermeabilização.',
    'O revestimento: reboco pintado ou capoto.',
    'A tinta e o acabamento escolhidos.',
  ],
  // Pas d'`aviso` : ce bloc annonce une exclusion (fibrocimento sur limpeza de telhados, repris tel quel sur les pages
  // concelho) ; le conseil de sécurité « reboco ou betão a cair » est une question de la FAQ.
  faqs: [
    {
      pergunta: 'Quanto custa renovar a fachada de um prédio?',
      resposta:
        'Não há um preço fixo: duas fachadas com a mesma área podem pedir trabalhos muito diferentes, de uma reparação localizada a uma reabilitação completa. O valor depende da área e do número de pisos, do acesso, do estado do reboco e do betão, das infiltrações a tratar e da tinta. Depois de vermos o edifício, enviamos o orçamento, sem custos para si.',
    },
    {
      pergunta: 'Quanto custa rebocar uma fachada?',
      resposta:
        'Depende sobretudo de ser preciso retirar o reboco antigo ou só reparar as zonas ocas, e também da área, da altura e do acesso. Uma reparação localizada e um reboco novo em toda a parede são trabalhos diferentes; por isso, o preço só se fixa depois de vermos o edifício.',
    },
    {
      // Question « fachada degradada : reparar ou reabilitar » du plan (FACH-PILAR), avec les seules prestations confirmées.
      pergunta: 'A fachada está degradada: reparar ou reabilitar?',
      resposta:
        'Depende da parte da fachada que está afetada. Se os estragos se limitam a alguns pontos, como uma fissura, uma zona de reboco oco ou uma varanda, basta repará-los. Se o reboco, a tinta e as infiltrações afetam a parede toda, reparar ponto a ponto não chega e faz sentido a recuperação da fachada inteira: lavagem, reparações, impermeabilização e pintura. Dizemos-lhe qual das duas se aplica depois de vermos a fachada de perto, na visita.',
    },
    {
      pergunta: 'Pintam fachadas de prédios sem andaime, por acesso por corda?',
      resposta:
        'Sim. A pintura de fachadas em altura pode fazer-se sem andaime: os nossos técnicos de acesso por corda, a quem muitos chamam alpinistas, têm certificação IRATA e trabalham suspensos a partir do topo do edifício. Na visita, comparamos as duas soluções para o seu caso: a altura, a duração da obra, o material necessário e o espaço disponível na rua contam para a escolha.',
    },
    {
      pergunta: 'Num prédio, como se decide a obra na fachada?',
      resposta:
        'Quando a assembleia de condóminos delibera sobre obras de conservação extraordinária ou inovações, o administrador tem de apresentar pelo menos três orçamentos de diferentes proveniências, salvo se o regulamento do condomínio ou a assembleia dispuserem de outra forma (Código Civil, artigo 1436.º, n.º 2). Cada condomínio tem de ter um fundo comum de reserva, destinado às despesas de conservação do edifício (Decreto-Lei n.º 268/94, artigo 4.º, n.º 1). Para comparar os orçamentos, peça a todas as empresas as mesmas rubricas: acesso, reparações, impermeabilização e pintura, cada uma com a sua área.',
    },
    {
      pergunta: 'E numa moradia, o que muda?',
      resposta:
        'Numa moradia não há assembleia: a decisão e o orçamento são só seus. O trabalho segue a mesma ordem: lavar a parede, reparar o reboco e as fissuras, tratar as infiltrações e pintar o exterior. No pedido, diga-nos quantos lados da casa quer renovar e se há zonas difíceis de alcançar, como uma empena alta ou uma parede por cima de um telhado.',
    },
    {
      pergunta: 'De quanto em quanto tempo tem de se pintar um prédio?',
      resposta:
        'Os edifícios devem ter obras de conservação pelo menos uma vez em cada período de oito anos e, fora desse prazo, sempre que sejam precisas para manter a segurança, a salubridade e o arranjo estético (regime jurídico da urbanização e edificação, Decreto-Lei n.º 555/99, artigo 89.º, n.º 1). Quanto à pintura, o intervalo depende da exposição à chuva e ao sol e da tinta usada, e uma pintura nova só dura se as fissuras e as infiltrações forem tratadas antes.',
    },
    {
      pergunta: 'As obras na fachada precisam de licença da câmara?',
      resposta:
        'Reparar, limpar ou voltar a pintar a fachada como estava são obras de conservação (regime jurídico da urbanização e edificação, artigo 2.º, alínea f)), em regra isentas de licença e de comunicação prévia (artigo 6.º, n.º 1, alínea a)). Mesmo assim, por serem obras no exterior, o promotor da obra tem de informar a câmara municipal até cinco dias antes do início dos trabalhos, com a identificação de quem os executa, e o proprietário ou o diretor da obra tem de afixar no local, no mesmo prazo, um aviso visível da via pública (artigo 80.º-A, n.os 1, 3 e 5). Mudar a cor ou o material do revestimento exterior já é uma obra de alteração (artigo 2.º, alínea d)), que pode precisar de licença ou de comunicação prévia, e a remoção de azulejos de fachada está sujeita a licença (artigo 4.º, n.º 2, alínea i)). Em imóveis classificados, ou na zona de proteção de um imóvel classificado, as regras são mais exigentes (artigo 4.º, n.º 2, alínea d)). Antes de mudar a cor, informe-se na câmara municipal.',
    },
    {
      pergunta: 'O capoto pode ser pintado?',
      resposta:
        'Pode, e é um dos trabalhos que fazemos em capoto já aplicado, a par da reparação e da limpeza. Antes de pintar, reparamos os buracos e as fissuras e lavamos o verdete.',
    },
    {
      pergunta: 'Como tirar o verdete das paredes exteriores?',
      resposta:
        'O verdete é uma camada de algas que cresce onde a parede fica húmida e recebe pouco sol. Sai com a lavagem da fachada, que fazemos em paredes rebocadas e em capoto. Se o verdete volta depressa, a parede está a receber água a mais, por exemplo de uma caleira que transborda ou de uma infiltração: trate primeiro a origem da água.',
    },
    {
      pergunta: 'Basta pintar por cima das fissuras?',
      resposta:
        'Não. Uma fissura só pintada volta a aparecer, e a água continua a entrar por ela. Primeiro repara-se a fissura e o reboco à volta, e só depois se pinta.',
    },
    {
      pergunta: 'Caiu reboco ou betão da fachada: o que fazer?',
      resposta:
        'Há perigo para quem passa por baixo: afaste as pessoas e os carros dessa zona. A seguir, é preciso ver a parede de perto, por andaime ou por acesso por corda, para retirar o que está solto e reparar. As obras necessárias à segurança do edifício cabem ao proprietário, e a câmara municipal pode determinar a sua execução (regime jurídico da urbanização e edificação, artigo 89.º).',
    },
    {
      pergunta: 'Impermeabilizar a fachada acaba com as infiltrações?',
      resposta:
        'Só quando a água entra através da própria parede. Muitas vezes entra por uma fissura, por uma junta, por uma varanda ou à volta de uma janela, e esse ponto tem de ser reparado antes. Na visita, procuramos por onde a água entra; a impermeabilização da superfície vem depois das reparações.',
    },
  ],
  ligacoes: [
    {
      href: '/pt/servicos/trabalhos-verticais/',
      titulo: 'Trabalhos verticais',
      texto: 'Reparações pontuais, juntas de dilatação e pintura em altura, por corda ou andaime.',
    },
    {
      href: '/pt/servicos/limpeza-de-telhados/',
      titulo: 'Limpeza de telhados e caleiras',
      texto: 'Caleiras entupidas que transbordam molham a fachada e trazem o verdete de volta.',
    },
    {
      href: '/pt/perto-de-mim/isolamento-termico/',
      titulo: 'Isolamento térmico e capoto',
      texto: 'Para isolar pelo exterior uma casa ou um prédio que ainda não tem capoto.',
    },
    {
      href: '/pt/perto-de-mim/impermeabilizacao/',
      titulo: 'Impermeabilização de coberturas e terraços',
      texto: 'Telhados, terraços, varandas e caves: quando a água não entra pelas paredes.',
    },
    {
      href: '/pt/perto-de-mim/pintor/',
      titulo: 'Pintura de interiores',
      texto: 'Para pintar as paredes e os tetos dentro de casa ou do apartamento.',
    },
    {
      href: '/pt/perto-de-mim/obras-remodelacao/',
      titulo: 'Obras e remodelação de casas',
      texto: 'Quando a obra é a casa inteira, por dentro e por fora, e não só a fachada.',
    },
  ],
  // Liens du plan et du guide (§4.3, §4.5) : hub pintor (il garde « pintor » et la peinture intérieure, arbitrage 253) et
  // OBRAS-HUB (réhabilitation d'une maison entière, arbitrage 257). Article BLOG-HUMIDADE retiré le 23/10/2026 : il publie
  // des fourchettes de prix non sourcées pour les prestations de cette page (impermeabilização, reparação e pintura,
  // capoto), comme l'article capoto déjà écarté.
  // Grille des distritos de la page et hubs qui la lient (prestations de lib/data/seo-pages-data.ts, arbitrages de la
  // section 4 du plan) : pintor (« Pintura exterior de fachadas »), impermeabilizacao (« Tratamento de fachadas contra
  // infiltrações »), pedreiro (« Reparação de fachadas exteriores »), isolamento-termico (entretien d'un capoto existant)
  // et limpeza-condominio (« Lavagem de fachadas », « Fachada com manchas ou musgo »).
  metiersLigados: ['pintor', 'impermeabilizacao', 'pedreiro', 'isolamento-termico', 'limpeza-condominio'],
  chamadaHub: 'Reparação, impermeabilização, lavagem e pintura de fachadas feitas pela equipa VITFIX:',
  mensagemWhatsapp: 'Olá! Queria pedir um orçamento para renovar uma fachada.',
  // Contenu : DATA_PAGINAS_FACHADAS_TV (23/10/2026) jusqu'à l'extension de la zone ; liens : voir LIMPEZA_DE_TELHADOS.
  dataModificacao: DATA_ZONA_DISTRITOS,
  dataLigacoes: DATA_ZONA_DISTRITOS,
  dataLigacoesGrelha: ligacoesGrelha(DATA_LIGACOES_FACHADAS_TV),
}

// Page TV-PILAR du plan du 19/10/2026 : une seule page pour les synonymes (trabalhos verticais, trabalhos em altura, acesso
// por corda, alpinismo industrial). Requête « altura / verticais / corda / alpinismo » sans « fachada » → ici ; la rénovation
// d'une façade entière et la décision en copropriété renvoient à renovação de fachadas.
export const TRABALHOS_VERTICAIS: ServicoDistrito = {
  slug: 'trabalhos-verticais',
  nome: 'Trabalhos verticais',
  // « A equipa VITFIX fez um trabalho de reparação, pintura e limpeza em altura … » sur une page concelho éventuelle.
  tipoServico: 'Reparação, pintura e limpeza em altura',
  icon: '🧗',
  distritos: DISTRITOS_EQUIPA,
  titulo: 'Trabalhos verticais e em altura: Porto, Braga e Aveiro',
  tituloSemZona: 'Trabalhos verticais e em altura',
  h1: 'Trabalhos verticais e em altura nos distritos do Porto, Braga e Aveiro',
  // « juntas de dilatação » (fait confirmé le 23/10/2026), pas « juntas » seul, plus large ; 151 caractères avec le numéro.
  resumo: 'Corda (IRATA) ou andaime: pintura em altura, juntas de dilatação e fissuras nos distritos do Porto, Braga e Aveiro.',
  intro:
    'A equipa VITFIX faz trabalhos em altura em prédios e moradias: pintura em altura, selagem de juntas de dilatação, reparação de fissuras, reboco e betão de varandas, tratamento de infiltrações e limpeza de caleiras fora do alcance de uma escada. Saímos de Marco de Canaveses para todos os concelhos destes três distritos. Para chegar aos pontos altos, trabalhamos na corda, com técnicos certificados IRATA, ou montamos andaime, conforme o edifício e o que há a fazer.',
  titulos: {
    preco: 'Quanto custa um trabalho em altura',
    metodo: 'Como preparamos e fazemos o trabalho',
    sinais: 'Quando chamar técnicos de acesso por corda',
    ligacoes: 'Trabalhos relacionados',
    ctaFinal: 'Peça orçamento para trabalhos verticais',
    local: 'Os edifícios',
  },
  ressalvaPreco: 'conforme a altura, o acesso e o estado da fachada',
  mensagemLocal: 'O edifício fica',
  textoOrcamento:
    'Pedir orçamento não custa nada e não o compromete. Mande-nos por WhatsApp fotografias do ponto a tratar e da fachada inteira, com o número de andares, ou ligue para',
  prestacoes: [
    {
      titulo: 'Pintura em altura',
      texto: 'Pintamos empenas, saguões, platibandas e paredes altas a partir da corda ou do andaime. Fissuras e reboco solto são reparados antes da pintura.',
    },
    {
      titulo: 'Selagem de juntas de dilatação',
      texto: 'Voltamos a selar as juntas de dilatação, entre dois prédios ou a meio da fachada, quando o vedante está gasto, gretado ou descolado.',
    },
    {
      titulo: 'Fissuras, reboco e betão das varandas',
      texto: 'Reparamos fissuras, reboco solto e betão degradado das varandas nos andares altos, antes que a água entre ou que caiam pedaços.',
    },
    {
      titulo: 'Infiltrações nos andares altos',
      texto: 'Quando a água entra por um ponto alto da fachada, numa junta, numa fissura ou no remate de uma varanda, tratamos e impermeabilizamos esse ponto.',
    },
    {
      titulo: 'Caleiras inacessíveis',
      texto: 'Limpamos e desentupimos caleiras e algerozes de prédios altos e de pontos a que não se chega do chão nem do telhado.',
    },
  ],
  // Lavagem et capoto existant : page renovação de fachadas (arbitrages FACH-PILAR / TV-PILAR du plan), carte de lien
  // ci-dessous. Accès par andaimes ou cordistes IRATA confirmé par le propriétaire ; choix de l'accès dans l'étape de visite
  // (les critères sont dans la FAQ « Quando é melhor a corda do que o andaime? »). Délimitation de la zone, mástique
  // elástico et préparation du condomínio retirés le 23/10/2026 tant que le propriétaire ne les a pas validés.
  metodo: [
    {
      titulo: 'Visita ao edifício',
      texto: 'Vemos o que há a tratar, a altura e o que fica por baixo (passeio, pátio, saguão ou outro telhado). Daí sai a escolha entre corda e andaime e dos pontos onde se fixam as cordas.',
    },
    {
      titulo: 'Montagem do acesso',
      texto: 'Montamos o andaime ou fixamos as cordas nos pontos escolhidos.',
    },
    {
      titulo: 'Reparação e limpeza final',
      texto: 'Tratamos os pontos combinados e, no fim, retiramos cordas, andaime e resíduos.',
    },
  ],
  sinais: [
    'Uma junta de dilatação aberta, com o vedante gretado ou descolado.',
    'Fissuras ou reboco solto num andar alto, ou pedaços de reboco caídos no passeio.',
    'Betão a cair aos bocados nas varandas, com o ferro à vista.',
    'Uma mancha de humidade que aparece só num andar, junto a uma junta ou por baixo de uma varanda.',
    'Uma caleira que transborda e a que ninguém consegue chegar.',
  ],
  frequencia:
    'Estes sinais não desaparecem com o tempo seco: a água que entra por uma junta ou por uma fissura volta a entrar a cada chuva e o estrago cresce por dentro da parede. Quanto mais cedo se trata o ponto, mais pequena costuma ser a reparação.',
  fatoresPreco: [
    'O tipo de trabalho: pintura, selagem de juntas, reparação de fissuras ou de betão, limpeza de caleiras.',
    'A área a pintar, os metros de junta ou o número de pontos a reparar.',
    'A altura do edifício e o meio de acesso escolhido.',
    'Os pontos de fixação das cordas e o que há debaixo da zona de trabalho.',
    'O estado do suporte: reboco solto, fissuras ou betão degradado a reparar antes.',
    'Os materiais escolhidos: tinta, mástique, produto de impermeabilização.',
  ],
  faqs: [
    {
      pergunta: 'O que é o acesso por corda?',
      resposta:
        'É uma forma de trabalhar em altura suspenso por cordas presas a pontos de fixação seguros, em regra no topo do edifício: o técnico desce ou sobe pela fachada e trabalha onde é preciso, sem andaime. Também se chama trabalhos verticais ou alpinismo industrial, e quem o faz é muitas vezes conhecido por alpinista. Na equipa VITFIX, quem trabalha na corda tem certificação IRATA.',
    },
    {
      pergunta: 'Quando é melhor a corda do que o andaime?',
      resposta:
        'A corda compensa quando o trabalho é localizado ou está espalhado por pontos afastados: uma junta, umas fissuras num andar alto, uma caleira, uma empena para pintar. Evita montar andaime em toda a altura, não deixa uma estrutura presa à fachada durante a obra e chega a saguões e a paredes por cima do telhado de um vizinho, onde não há chão para apoiar um andaime. O andaime ganha quando há muito para reparar em toda a fachada, com várias camadas e tempos de secagem, ou quando o trabalho pede muito material junto à parede.',
    },
    {
      pergunta: 'Trabalhar suspenso numa corda é seguro?',
      resposta:
        'Em Portugal, o Decreto-Lei n.º 50/2005 (artigo 39.º) só admite o acesso por corda quando a avaliação de riscos indica que o trabalho pode ser feito com segurança e não se justifica um equipamento mais seguro. Em regra, há duas cordas com pontos de fixação independentes: a de trabalho, que sustenta o técnico, e a de segurança, ligada ao arnês por um dispositivo antiqueda; as ferramentas vão presas ao arnês. O mesmo decreto-lei (artigo 36.º) só permite trabalhos em altura quando o tempo não compromete a segurança.',
    },
    {
      pergunta: 'Quanto custa a pintura em altura?',
      resposta:
        'Não há um preço por metro quadrado que sirva para todas as paredes: conta a área, a altura, o meio de acesso, o que é preciso reparar antes de pintar e a tinta escolhida. Numa área pequena, preparar o acesso pesa bastante no total. Com fotografias da parede e o número de andares, preparamos o orçamento ou marcamos uma visita, sem custo para si.',
    },
    {
      pergunta: 'Como se sela uma junta de dilatação na fachada?',
      resposta:
        'A junta separa duas partes do edifício que se mexem com o calor e o frio. Quando o vedante endurece, greta ou descola, a água entra e aparecem manchas de humidade nas casas junto à junta. Retiramos o vedante velho, limpamos a junta e voltamos a selá-la. Como a junta corre a fachada de cima a baixo, a corda permite tratá-la de uma ponta à outra sem andaime.',
    },
    {
      pergunta: 'Limpam caleiras inacessíveis?',
      resposta:
        'Sim: chegamos-lhes pela corda ou por andaime, mesmo por cima de um saguão ou de um telhado onde não é seguro pôr os pés. Não suba a uma escada encostada a uma caleira alta sem proteção contra quedas. Para a limpeza regular do telhado e das caleiras de uma casa, veja a página de limpeza de telhados.',
    },
    // « O que deve o condomínio preparar antes do trabalho? » retirée le 23/10/2026 : préparation non confirmée par le
    // propriétaire (accès à la cobertura, personne de contact, consignes aux moradores), à rétablir après sa validation.
    {
      pergunta: 'E se for preciso renovar a fachada inteira?',
      resposta:
        'Aí já não se trata de uma reparação pontual: reparar, rebocar e pintar toda a fachada pede outra preparação e outro orçamento. Também fazemos esse trabalho, em prédios e moradias; a página de renovação de fachadas explica como.',
    },
  ],
  ligacoes: [
    {
      href: '/pt/servicos/renovacao-de-fachadas/',
      titulo: 'Renovação de fachadas',
      texto: 'A fachada inteira, a lavagem e o capoto já aplicado: prédios em condomínio e moradias.',
    },
    {
      href: '/pt/servicos/limpeza-de-telhados/',
      titulo: 'Limpeza de telhados e caleiras',
      texto: 'Lavagem e tratamento das telhas e limpeza regular das caleiras.',
    },
    {
      href: '/pt/perto-de-mim/impermeabilizacao/',
      titulo: 'Impermeabilização',
      texto: 'Terraços, coberturas planas e varandas por onde entra água.',
    },
    {
      href: '/pt/perto-de-mim/telhador/',
      titulo: 'Reparação de telhados e caleiras',
      texto: 'Telhas partidas, rufos e substituição de caleiras.',
    },
  ],
  // pintor : pintura em altura ; impermeabilizacao : juntas de dilatação et infiltrations par un point haut. Pas telhador :
  // ses pages lient déjà limpeza de telhados (caleiras), et cette page lie le hub telhador.
  metiersLigados: ['pintor', 'impermeabilizacao'],
  chamadaHub: 'Pintura, reparações e limpeza em altura, por acesso por corda ou andaime, feitas pela equipa VITFIX:',
  mensagemWhatsapp: 'Olá! Gostaria de um orçamento para um trabalho em altura.',
  // Contenu : DATA_PAGINAS_FACHADAS_TV (23/10/2026) jusqu'à l'extension de la zone ; liens : voir LIMPEZA_DE_TELHADOS.
  dataModificacao: DATA_ZONA_DISTRITOS,
  dataLigacoes: DATA_ZONA_DISTRITOS,
  dataLigacoesGrelha: ligacoesGrelha(DATA_LIGACOES_FACHADAS_TV),
}

/** Pages de district publiées (ordre des liens et du sitemap). */
export const SERVICOS_DISTRITO: ServicoDistrito[] = [LIMPEZA_DE_TELHADOS, RENOVACAO_DE_FACHADAS, TRABALHOS_VERTICAIS]

/** La page de district couvre-t-elle ce distrito (valeur de `CityData.distrito`) ? */
export const cobreDistrito = (servico: ServicoDistrito, distrito: string) => servico.distritos.includes(distrito)

/** Pages de district à lier depuis les pages d'un métier de la grille (distrito couvert par la page) et son hub. */
export function servicosDistritoLigados(metier: string, distrito?: string): ServicoDistrito[] {
  return SERVICOS_DISTRITO.filter((s) => s.metiersLigados.includes(metier) && (!distrito || cobreDistrito(s, distrito)))
}

/**
 * Pages de district qu'une page métier x ville lie en plus de celles de son métier (CityData.serviceCityOverrides[métier]
 * .servicosDistrito, ex. poda-arvores-agueda → limpeza de telhados), dans un distrito qu'elles couvrent.
 */
export function servicosDistritoRelacionados(slugs: readonly string[] | undefined, distrito: string): ServicoDistrito[] {
  return SERVICOS_DISTRITO.filter((s) => Boolean(slugs?.includes(s.slug)) && cobreDistrito(s, distrito))
}

/** Date des liens d'une page qui lie ces pages de district (hub, page ville, page statique) : la plus récente de leurs `dataLigacoes`. */
export function dataLigacoesServicos(servicos: ServicoDistrito[]): string {
  return maisRecente(servicos.map((s) => s.dataLigacoes))
}

/** Date des liens d'une page de la grille de ce distrito vers ces pages de district : la plus récente de leurs `dataLigacoesGrelha`. */
export function dataLigacoesGrelha(servicos: ServicoDistrito[], distrito: string): string {
  return maisRecente(servicos.map((s) => s.dataLigacoesGrelha[distrito] ?? ''))
}

// ── Pages concelho d'un service de district (/pt/servicos/{servico}-{concelho}/) ──
// Guide Google du 19/10/2026, section 4.4 : une page concelho ne se crée que si TOUTES les conditions sont réunies.
// Elle s'ouvre donc seulement quand data/seo/local-proof.json contient, pour ce service et ce concelho :
//   1. au moins un chantier complet : photo décrite, freguesia, problème trouvé, solution, date de mise en production ;
//   2. une information propre au lieu : une particularité locale du propriétaire (notas_concelho) ou un deuxième
//      chantier détaillé (freguesia, problème, solution) ;
//   3. une relecture humaine datée (revisoes_concelho : les 7 tests de la section 2.4), qui permet aussi d'ouvrir les
//      pages par petits groupes (section 4.6).
// Sans cela, aucune page : les recherches « service + concelho » vont à la page de district et aux pages de la grille qui
// la lient. Jamais de page par freguesia : les freguesias n'apparaissent que dans les chantiers.

/** Date de mise en production la plus récente d'un chantier (ajout ou modification visible). */
export const dataChantier = (c: Chantier) => maisRecente([c.publicado ?? '', c.atualizado ?? ''].filter(dataIsoValida))

const preenchido = (t?: string) => Boolean(t && t.trim())

/** Chantiers d'un service de district dans un concelho qui comptent : valides et datés (`publicado`). */
export function chantiersDocumentados(servico: ServicoDistrito, cidade: string): Chantier[] {
  return todosChantiersPara(servico.slug, cidade).filter((c) => dataIsoValida(c.publicado))
}

/** Chantier détaillé : freguesia, problème trouvé et solution. */
export const chantierDetalhado = (c: Chantier) => preenchido(c.freguesia) && preenchido(c.problema) && preenchido(c.solucao)

/** Chantier complet : détaillé, avec une photo décrite. */
export const chantierCompleto = (c: Chantier) => chantierDetalhado(c) && preenchido(c.foto) && preenchido(c.foto_alt)

/** Conditions 1 et 2 de la section 4.4 du guide (la relecture, condition 3, est vérifiée à part). */
export function concelhoDocumentado(servico: ServicoDistrito, cidade: string, chantiers: Chantier[]): boolean {
  const localPropria = notasConcelhoDetalhadas(servico.slug, cidade).length > 0 || chantiers.filter(chantierDetalhado).length >= 2
  return chantiers.some(chantierCompleto) && localPropria
}

export interface PaginaConcelhoDistrito {
  slug: string
  servico: ServicoDistrito
  city: CityData
  chantiers: Chantier[]
  /** Jour d'ouverture (date de relecture) : date des pages qui lient la page concelho. */
  dataAbertura: string
  /**
   * lastmod de la page concelho : textes du service (sans `dataModificacaoLigacoes` : le gabarit concelho n'affiche pas les
   * cartes de liens de la page de district), relecture, chantiers et notes du concelho.
   */
  dataModificacao: string
}

function maisRecente(datas: string[]): string {
  return [...datas].filter(Boolean).sort((a, b) => a.localeCompare(b)).at(-1) ?? ''
}

/** Pages concelho ouvertes, pour toutes les pages de district. */
export function paginasConcelhoDistrito(): PaginaConcelhoDistrito[] {
  return SERVICOS_DISTRITO.flatMap((servico) =>
    CITIES.filter((city) => cobreDistrito(servico, city.distrito)).flatMap((city) => {
      const revisto = revisaoConcelhoPara(servico.slug, city.slug)
      const chantiers = chantiersDocumentados(servico, city.slug)
      if (!revisto || !concelhoDocumentado(servico, city.slug, chantiers)) return []
      const notas = notasConcelhoDetalhadas(servico.slug, city.slug).map((n) => n.publicado ?? '').filter(dataIsoValida)
      return [{
        slug: `${servico.slug}-${city.slug}`,
        servico,
        city,
        chantiers,
        dataAbertura: revisto,
        dataModificacao: maisRecente([servico.dataModificacao, revisto, ...chantiers.map(dataChantier), ...notas]),
      }]
    }),
  )
}

export function paginaConcelhoDistrito(slug: string): PaginaConcelhoDistrito | undefined {
  return paginasConcelhoDistrito().find((p) => p.slug === slug)
}

/** Lien vers le service pour un concelho : sa page concelho si elle est ouverte, sinon la page de district. */
export function urlServicoDistrito(servico: ServicoDistrito, cidade?: string): string {
  const pagina = cidade ? paginasConcelhoDistrito().find((p) => p.servico.slug === servico.slug && p.city.slug === cidade) : undefined
  return pagina ? `/pt/servicos/${pagina.slug}/` : `/pt/servicos/${servico.slug}/`
}

/**
 * Chantiers affichés sur la page de district : les 6 plus récents, plus le plus récent de chaque concelho dont la page
 * est ouverte (pour que chaque page concelho soit liée depuis une carte de chantier réel, jamais depuis une liste de
 * villes), du plus récent au plus ancien.
 */
export function chantiersExibidosDistrito(servico: ServicoDistrito): Chantier[] {
  const todos = CITIES.filter((city) => cobreDistrito(servico, city.distrito))
    .flatMap((city) => chantiersDocumentados(servico, city.slug))
    .sort((a, b) => b.mes.localeCompare(a.mes))
  const exibidos = todos.slice(0, 6)
  for (const pagina of paginasConcelhoDistrito().filter((p) => p.servico.slug === servico.slug)) {
    if (!exibidos.some((c) => c.cidade === pagina.city.slug)) exibidos.push(pagina.chantiers[0])
  }
  return exibidos.sort((a, b) => b.mes.localeCompare(a.mes))
}

/**
 * lastmod de la page de district : ses textes, ses cartes de liens, le dernier chantier affiché ou la dernière page concelho
 * ouverte, la plus récente de ces dates.
 */
export function dataModificacaoDistrito(servico: ServicoDistrito): string {
  const abertas = paginasConcelhoDistrito().filter((p) => p.servico.slug === servico.slug).map((p) => p.dataAbertura)
  return maisRecente([servico.dataModificacao, servico.dataModificacaoLigacoes ?? '', ...chantiersExibidosDistrito(servico).map(dataChantier), ...abertas])
}
