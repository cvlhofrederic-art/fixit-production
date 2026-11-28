// Pages d'un service pour un concelho qui forme toute sa zone desservie (demande du propriétaire du 21/10/2026 :
// « ranker au maximum sur Águeda et tous les petits villages aux alentours »). Une page par service pour tout le
// concelho, jamais une page par freguesia : les freguesias sont des groupes de lieux dans la page, chacun avec ce qui
// change pour le travail (politiques Google « doorway abuse », « scaled content abuse » et « keyword stuffing », guide
// docs/seo/porto-palavras-chave/consignes-google-2026-10-19.md). L'autocomplétion Google relevée le 21/10/2026 ne
// propose « limpeza de terrenos » qu'avec Águeda elle-même, aucune freguesia.
//
// Faits confirmés par le propriétaire le 21/10/2026 : tous les travaux sont faits par l'équipe VITFIX ; moyens :
// trator com destroçador, roçadoras et motosserras, giratória ou retroescavadora, évacuation des résidus (camion ou
// trator com reboque : rien n'est brûlé sur place) ; aucun prix publié (orçamento après visite ou photos WhatsApp) ;
// zone : tout le concelho d'Águeda, rien au-delà. Règles légales : sources officielles citées dans chaque page,
// vérifiées le jour indiqué (regras.verificadoEm), relues par un agent indépendant le même jour. Prix, délais et
// chantiers réels : data/seo/local-proof.json (clé = slug de la page), blocs absents tant qu'ils sont vides ; le
// propriétaire a décidé le 22/10/2026 d'ouvrir ces pages sans chantier documenté, les chantiers s'ajouteront ensuite.
// Textes à relire par le propriétaire.
//
// 28/10/2026 : carte vers la page de district /pt/servicos/limpeza-de-telhados/ dans les liens des deux pages (l'équipe
// travaille dans tous les concelhos du distrito de Aveiro, confirmé le 28/10/2026 ; aucun chantier ni photo à Águeda à ce
// jour : la carte ne parle que du service), date DATA_LIGACOES_AGUEDA_TELHADOS.

import { DATA_LIGACOES_AGUEDA_TELHADOS } from '@/lib/seo/pt-datas'
import { chantiersPara } from '@/lib/seo/pt-provas-locais'
import { dataChantier } from '@/lib/data/pt-servicos-distrito'

export interface ItemTexto {
  titulo: string
  texto: string
}

export interface PerguntaResposta {
  pergunta: string
  resposta: string
}

export interface Fonte {
  nome: string
  url: string
}

export interface Ligacao {
  href: string
  titulo: string
  texto: string
}

export interface GrupoFreguesias {
  titulo: string
  /** Freguesias officielles du concelho (CityData.freguesias) : chacune dans un seul groupe de la page. */
  freguesias: string[]
  /** Ce qui change pour le travail dans ces lieux (terrain, accès, règles), jamais une simple énumération. */
  texto: string
}

export interface ServicoConcelho {
  /** Segment d'URL : /pt/servicos/{slug}/ (route statique app/pt/servicos/{slug}/page.tsx). */
  slug: string
  /** Concelho servi (CityData.slug). */
  cidade: string
  /** Nom court du service (badge, cartes de liens). */
  nome: string
  /** `serviceType` du nœud `Service`. */
  tipoServico: string
  icon: string
  /** Titre sans marque (le template `%s | VITFIX` l'ajoute). */
  titulo: string
  h1: string
  /** Première phrase de la description (la phrase de contact suit, voir descricaoServicoConcelho). */
  resumo: string
  intro: string[]
  servicos: ItemTexto[]
  equipamento: string
  naoFazemos: string[]
  metodo: ItemTexto[]
  preco: { titulo: string; texto: string; fatores: string[] }
  regras: { titulo: string; intro: string; itens: ItemTexto[]; fontes: Fonte[]; verificadoEm: string }
  zona: { titulo: string; intro: string; grupos: GrupoFreguesias[]; fontes: Fonte[] }
  faqs: PerguntaResposta[]
  /** Qui fait le travail (confirmé par le propriétaire pour ce concelho). */
  quemFaz: string
  ligacoes: Ligacao[]
  /** Métiers de la grille dont la page dans le même concelho lie cette page. */
  metiersLigados: string[]
  /** Texte prérempli du message WhatsApp. */
  mensagemWhatsapp: string
  ctaFinal: string
  /** Dernière modification significative (lastmod), jour de la mise en production. */
  dataModificacao: string
}

// Sources partagées par les deux pages d'Águeda (adresses vérifiées le 21/10/2026).
const FONTES = {
  freguesias: { nome: 'Lei n.º 25-A/2025 (freguesias de Águeda separadas em 2025)', url: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/legislacao/diplomas_legislativos/Documents/lei-25-a-2025.pdf' },
  pmdfci: { nome: 'Câmara Municipal de Águeda: plano municipal de defesa da floresta contra incêndios 2021-2030, caderno I (relevo, floresta)', url: 'https://www.cm-agueda.pt/cmagueda/uploads/writer_file/document/5773/caderno_i___pmdfci_2021_30_agueda.pdf' },
  incendios2024: { nome: 'Câmara Municipal de Águeda: ficha do projeto de recuperação das áreas ardidas em 2024', url: 'https://www.cm-agueda.pt/cmagueda/uploads/writer_file/document/9335/ficha_de_projeto_pdr2020_814_105048.pdf' },
  codigoRegulamentar: { nome: 'Câmara Municipal de Águeda: Código Regulamentar (versão consolidada)', url: 'https://www.cm-agueda.pt/cmagueda/uploads/document/file/6576/codigo_regulamentar___versao_consolidada_12_a_alteracao.pdf' },
  prioritarias2025: { nome: 'Despacho n.º 4717/2025 (freguesias prioritárias para a fiscalização em 2025)', url: 'https://www.sgifr.gov.pt/documents/196633/1514736/Despacho_4717_2025_17_abril.pdf/8aa43547-073c-fb49-d5c4-6a4cc2b2db6e?t=1744909715442' },
  dl82: { nome: 'Decreto-Lei n.º 82/2021, Sistema de Gestão Integrada de Fogos Rurais (texto consolidado, PGDL)', url: 'https://www.pgdlisboa.pt/leis/lei_mostra_articulado.php?nid=3453&tabela=leis' },
  dl124: { nome: 'Decreto-Lei n.º 124/2006 (faixas e coimas do regime de transição, texto consolidado, PGDL)', url: 'https://www.pgdlisboa.pt/leis/lei_mostra_articulado.php?nid=1931&tabela=leis' },
  rjue: { nome: 'Regime Jurídico da Urbanização e Edificação, revisto pelo Decreto-Lei n.º 108/2026 (texto consolidado, PGDL)', url: 'https://www.pgdlisboa.pt/leis/lei_mostra_articulado.php?nid=625&tabela=leis' },
  pateira: { nome: 'Câmara Municipal de Águeda: Pateira de Fermentelos (sítio Ramsar, Rede Natura 2000)', url: 'https://www.cm-agueda.pt/pages/899' },
} satisfies Record<string, Fonte>

export const LIMPEZA_DE_TERRENOS_AGUEDA: ServicoConcelho = {
  slug: 'limpeza-de-terrenos-agueda',
  cidade: 'agueda',
  nome: 'Limpeza de terrenos e desmatação',
  tipoServico: 'Limpeza de terrenos e desmatação',
  icon: '🚜',
  titulo: 'Limpeza de terrenos e desmatação em Águeda',
  h1: 'Limpeza de terrenos e desmatação em Águeda',
  resumo: 'Limpeza de terrenos e desmatação em todo o concelho de Águeda: trator, roçadoras e sobrantes retirados.',
  intro: [
    'A equipa VITFIX limpa terrenos e faz desmatação em todas as freguesias do concelho de Águeda, da cidade às aldeias da serra. Onde o trator entra, o destroçador corta e tritura o mato, as silvas e as canas; nos taludes, nas encostas e à volta das casas, o trabalho é feito com roçadoras e motosserras.',
    'Os ramos, os troncos e os restos de corte são carregados e levados do terreno: não fazemos queimas. O orçamento é grátis e sem compromisso; para começar, envie fotografias e a localização do terreno por WhatsApp.',
  ],
  servicos: [
    {
      titulo: 'Limpeza de mato com trator',
      texto: 'Em terrenos com acesso e pouca inclinação, o trator com destroçador corta e tritura numa só passagem o mato, as silvas, as giestas e as canas. O material triturado fica no solo, exceto junto às casas: nos 2 metros à volta, a lei pede o terreno sem nada que arda, e aí é retirado.',
    },
    {
      titulo: 'Roçagem manual',
      texto: 'Taludes, encostas, zonas pedregosas, o terreno junto aos muros e o espaço à volta da casa, onde a máquina não chega ou não deve passar, limpamos com roçadoras e motosserras.',
    },
    {
      titulo: 'Faixas de gestão de combustível',
      texto: 'Limpeza das faixas obrigatórias à volta das casas e das aldeias: corte do mato, desbaste das árvores demasiado juntas e desramação dos troncos, para cumprir as distâncias explicadas mais abaixo.',
    },
    {
      titulo: 'Desmatação antes de uma obra',
      texto: 'Antes de construir ou de vedar, retiramos a vegetação, os cepos e as raízes e, se for preciso, a camada de terra vegetal (decapagem) com a giratória. Quando a desmatação prepara uma construção ou outro uso que não seja só agrícola, pecuário, florestal ou mineiro, é um trabalho de remodelação de terrenos: precisa de licença municipal, ou de comunicação prévia num loteamento ou plano de pormenor que já o preveja, salvo se fizer parte do processo da obra.',
    },
    {
      titulo: 'Retirada dos sobrantes',
      texto: 'Ramos, troncos e restos de corte são carregados e levados do terreno, em camião ou no reboque do trator: não fica nada amontoado na faixa.',
    },
  ],
  equipamento: 'trator com destroçador para as áreas abertas, roçadoras e motosserras para o trabalho manual, giratória ou retroescavadora para cepos, raízes e decapagem, camião ou trator com reboque para levar os sobrantes.',
  naoFazemos: [
    'Queimas e queimadas: os sobrantes são retirados do terreno.',
  ],
  metodo: [
    {
      titulo: 'Fotografias e localização',
      texto: 'Envie por WhatsApp algumas fotografias do terreno, a localização no mapa e, se souber, a área aproximada. Quando as fotografias não chegam para perceber o trabalho, vamos ver o terreno.',
    },
    {
      titulo: 'Orçamento',
      texto: 'Com a área, o tipo e a altura do mato, a inclinação, o acesso para o trator e as árvores a desbastar, enviamos o orçamento antes de qualquer trabalho.',
    },
    {
      titulo: 'Limpeza',
      texto: 'Trator onde entra, roçadoras e motosserras onde não entra. Nas faixas junto às casas, desbastamos e desramamos as árvores de acordo com as distâncias da lei.',
    },
    {
      titulo: 'Sobrantes',
      texto: 'Carregamos e levamos os ramos, os troncos e os restos de corte. O mato triturado pelo destroçador fica no solo como cobertura, fora dos 2 metros junto às casas.',
    },
  ],
  preco: {
    titulo: 'Quanto custa limpar um terreno em Águeda',
    texto: 'Não publicamos um preço por metro quadrado: dois terrenos com a mesma área podem pedir trabalhos muito diferentes. Um terreno plano com erva alta limpa-se com o trator; uma encosta com silvas e eucaliptos jovens pede trabalho manual, muito mais demorado. O preço do orçamento depende sobretudo de:',
    fatores: [
      'A área a limpar.',
      'O tipo de vegetação: erva e mato rasteiro, ou silvas, giestas, tojo e canas com vários anos.',
      'A inclinação e o acesso: o trator só trabalha em terreno com entrada e pouco declive; o resto é trabalho manual.',
      'As árvores a desbastar ou a desramar para cumprir as faixas de gestão de combustível.',
      'O volume de ramos e troncos a retirar.',
      'Os cepos e as raízes a arrancar, quando o terreno é preparado para uma obra.',
    ],
  },
  regras: {
    titulo: 'O que diz a lei sobre a limpeza de terrenos',
    // Régime de transition : art. 79.º n.º 4 du DL 82/2021, PMDFCI prorogés jusqu'au 31/12/2026 par le DL 86/2026 ;
    // programme sous-régional de la Região de Aveiro encore en consultation publique (Aviso 19511/2026, 05/08/2026).
    intro: 'Em Águeda, em 2026, as larguras das faixas e as coimas seguem ainda o regime de transição: o plano municipal de defesa da floresta contra incêndios continua em vigor até 31 de dezembro de 2026 e, com ele, as regras do Decreto-Lei n.º 124/2006 (artigo 79.º do Decreto-Lei n.º 82/2021). Os critérios de limpeza vêm do regulamento do ICNF de 2026.',
    itens: [
      {
        titulo: 'Quem tem de limpar',
        texto: 'Os proprietários, arrendatários, usufrutuários ou quem, a qualquer título, detenha os terrenos que ficam dentro das faixas. A obrigação é de quem tem o terreno, mesmo que a casa a proteger seja do vizinho.',
      },
      {
        titulo: '50 metros à volta das casas',
        texto: 'À volta de edifícios em espaço rural, a faixa tem pelo menos 50 metros quando o terreno à volta é floresta, mato ou pastagem natural; noutras ocupações, a largura é a do plano municipal, entre 10 e 50 metros.',
      },
      {
        titulo: '100 metros à volta das aldeias',
        texto: 'Nos aglomerados populacionais definidos no plano municipal, a faixa exterior tem pelo menos 100 metros. Também aqui a limpeza cabe a quem detém os terrenos dentro da faixa.',
      },
      {
        titulo: 'Como deve ficar o terreno',
        texto: 'Nos 2 metros junto à casa, nada que arda: mato, ervas, folhas ou lenha. As copas das árvores ficam a pelo menos 5 metros das paredes, sem se projetarem sobre o telhado; os troncos são desramados até metade da altura nas árvores até 8 metros e até pelo menos 4 metros do chão nas mais altas; as copas ficam afastadas entre si e o mato baixo. Lenha e sobrantes não se acumulam na faixa, salvo se estiverem guardados e isolados do exterior.',
      },
      {
        titulo: 'Prazos',
        texto: 'Em 2026, o prazo geral de 31 de maio (Despacho n.º 3440/2026) foi prorrogado para 30 de junho em todo o continente (Despacho n.º 7164/2026); os concelhos em situação de calamidade já tinham até 30 de junho. A 21 de outubro de 2026, o prazo de 2027 ainda não tinha sido publicado.',
      },
      {
        titulo: 'Se o terreno não for limpo',
        texto: 'A câmara municipal pode notificar o responsável e, se nada for feito, limpar o terreno por conta dele (artigo 15.º do Decreto-Lei n.º 124/2006 e artigo 58.º do Decreto-Lei n.º 82/2021). No regime de transição que se aplica em Águeda em 2026, as coimas vão de 140 € a 5 000 € para pessoas singulares e de 1 500 € a 60 000 € para pessoas coletivas.',
      },
      {
        titulo: 'Dias de perigo de incêndio',
        texto: 'Nos dias de perigo de incêndio rural muito elevado ou máximo no concelho, a lei proíbe, em regra, trabalhar em espaço rural e à volta das áreas edificadas com roçadoras, corta-matos, destroçadores e motosserras, com exceções limitadas, como as máquinas agrícolas e florestais entre o pôr do sol e as 11 horas (artigo 69.º do Decreto-Lei n.º 82/2021). Antes de marcar o trabalho, confirme o perigo de incêndio do dia.',
      },
      {
        titulo: 'Queimas e queimadas',
        texto: 'Queimar sobrantes amontoados exige comunicação prévia à câmara municipal fora do período de 1 de junho a 31 de outubro e autorização da câmara nesse período; nos dias de perigo muito elevado ou máximo, só com autorização da autarquia. Uma queimada é proibida nos dias de perigo muito elevado ou máximo e, nos outros, precisa de autorização do município e do acompanhamento de um técnico credenciado em fogo controlado ou de bombeiros.',
      },
    ],
    fontes: [
      { nome: 'SGIFR: gestão de combustível', url: 'https://www.sgifr.gov.pt/gestao-de-combustivel' },
      FONTES.dl82,
      FONTES.dl124,
      { nome: 'Decreto-Lei n.º 86/2026 (planos municipais em vigor até 31 de dezembro de 2026)', url: 'https://diariodarepublica.pt/dr/detalhe/decreto-lei/86-2026-1085738182' },
      { nome: 'Despacho n.º 675/2026 (regulamento do ICNF, critérios de gestão de combustível)', url: 'https://diariodarepublica.pt/dr/detalhe/despacho/675-2026-1016754080' },
      { nome: 'ANEPC: prazos de limpeza de terrenos para 2026 (Despacho n.º 3440/2026)', url: 'https://prociv.gov.pt/pt/noticias/19032026-limpeza-de-terrenos-novos-prazos-para-2026/' },
      { nome: 'Despacho n.º 7164/2026 (prazo prorrogado até 30 de junho de 2026)', url: 'https://diariodarepublica.pt/dr/detalhe/despacho/7164-2026-1129893216' },
      { nome: 'GNR: Linha SOS Ambiente e Território', url: 'https://www.gnr.pt/ambiente.aspx' },
      { nome: 'Câmara Municipal de Águeda: Gabinete Técnico Florestal', url: 'https://www.cm-agueda.pt/viver/seguranca-e-proteccao-civil/gabinete-tecnico-florestal' },
      { nome: 'Governo: segunda fase do programa Floresta Ativa (11 de agosto de 2026)', url: 'https://portugal.gov.pt/pt/gc25/comunicacao/comunicados/fundo-ambiental-reforca-apoios-para-limpeza-de-terrenos-espacos-verdes-nas-cidades-e-gas-engarrafado' },
      { nome: 'Portal das Finanças: listas de taxas do Código do IVA', url: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/civa_rep/Pages/c-iva-listas.aspx' },
    ],
    verificadoEm: '2026-10-21',
  },
  zona: {
    titulo: 'Limpeza de terrenos nas freguesias de Águeda',
    intro: 'Trabalhamos nas 15 freguesias do concelho. O que muda de uma zona para outra é o terreno: a inclinação, o acesso para o trator, a floresta à volta das casas e a proximidade da água. No conjunto do concelho, a floresta ocupa perto de três quartos do território e o eucalipto domina os povoamentos.',
    // Groupes tirés du plan municipal (PMDFCI 2021-2030, caderno I, quadro 11, part de floresta par freguesia) :
    // Fermentelos 27 %, Barrô e Aguada de Baixo 36 %, Travassô e Óis 44 % ; Recardães 43 %, Trofa 47 %, Águeda e Borralha
    // 61 % ; Aguada de Cima 70 %, Macinhata 75 %, Valongo 79 % ; Préstimo 87 %, Belazaima/Castanheira/Agadão 93 %.
    grupos: [
      {
        titulo: 'Cidade e arredores',
        freguesias: ['Águeda', 'Borralha', 'Recardães e Espinhel', 'Trofa, Segadães e Lamas do Vouga'],
        texto: 'A zona mais povoada do concelho: lotes e quintais entre casas, terrenos à espera de construção e logradouros, onde a máquina tem pouco espaço e o trabalho é sobretudo manual. Dentro das áreas edificadas aplica-se o regulamento municipal: o Código Regulamentar de Águeda permite à Câmara notificar o dono de um terreno cuja vegetação crie risco de incêndio ou de insalubridade e, se nada for feito, limpá-lo por conta dele.',
      },
      {
        titulo: 'Pateira e campos a poente',
        freguesias: ['Fermentelos', 'Travassô e Óis da Ribeira', 'Aguada de Baixo', 'Barrô'],
        texto: 'As freguesias menos florestais do concelho, com menos de metade do território em floresta: campos agrícolas e terrenos amplos onde o trator rende mais. Junto à Pateira de Fermentelos, formada pelo rio Cértima perto do rio Águeda, o terreno desce aos 5 metros de altitude e, nos campos baixos e húmidos, o trator só entra com o solo seco. Nas margens dos cursos de água, que fazem parte do domínio hídrico, a limpeza segue as orientações da APA, que desaconselha cortar toda a vegetação da margem.',
      },
      {
        titulo: 'Encostas florestais a norte e a sul',
        freguesias: ['Macinhata do Vouga', 'Valongo do Vouga', 'Aguada de Cima'],
        texto: 'Mais de dois terços do território em floresta, com quintas e campos nos vales. Os incêndios de setembro de 2024 atingiram aldeias de Macinhata do Vouga (Alombada, Chãs, Moita) e de Valongo do Vouga (Cadaveira, Gandra, Moutedo, Redonda, Salgueiro), onde a Câmara Municipal tem um projeto de recuperação das áreas ardidas.',
      },
      {
        titulo: 'Serra, a nascente',
        freguesias: ['Préstimo e Macieira de Alcoba', 'Agadão', 'Belazaima do Chão', 'Castanheira do Vouga'],
        texto: 'A parte mais alta e mais florestal do concelho, quase toda coberta de floresta, com vales encaixados dos rios Águeda, Alfusqueiro e Agadão e o ponto mais alto, 721 metros, na Urgueira. As aldeias estão rodeadas de eucaliptal e pinhal, por isso as faixas de 50 e de 100 metros caem quase sempre em floresta, e nas encostas o trabalho é sobretudo manual. Em 2025, Belazaima do Chão, Castanheira do Vouga e Agadão (então uma só união de freguesias) e Préstimo e Macieira de Alcoba estavam na lista nacional de freguesias prioritárias para a fiscalização da limpeza.',
      },
    ],
    fontes: [FONTES.freguesias, FONTES.pmdfci, FONTES.incendios2024, FONTES.codigoRegulamentar, FONTES.prioritarias2025, FONTES.pateira],
  },
  faqs: [
    {
      pergunta: 'Quanto custa limpar um terreno em Águeda?',
      resposta: 'Depende da área, do tipo de mato, da inclinação, do acesso para o trator e das árvores a desbastar; por isso não damos um preço por metro quadrado sem ver o terreno. Envie fotografias e a localização por WhatsApp e respondemos com um orçamento, grátis e sem compromisso.',
    },
    {
      pergunta: 'Até quando tenho de limpar o terreno?',
      resposta: 'Em 2026, o prazo terminou a 30 de junho. A 21 de outubro de 2026, o prazo de 2027 ainda não tinha sido publicado. Como a câmara pode agir logo a seguir ao prazo, o mais seguro é limpar no inverno ou no início da primavera, antes da procura de maio e dos dias de perigo de incêndio.',
    },
    {
      pergunta: 'Qual é a multa por não limpar o terreno?',
      resposta: 'Em Águeda, em 2026, no regime de transição, de 140 € a 5 000 € para pessoas singulares e de 1 500 € a 60 000 € para pessoas coletivas. Além da coima, a câmara pode fazer a limpeza e cobrar a despesa ao responsável. Os valores até 120 000 € que ainda circulam vêm da duplicação destas coimas, aplicada pela última vez em 2021 (Lei n.º 75-B/2020, Orçamento do Estado para 2021).',
    },
    {
      pergunta: 'O terreno do vizinho não está limpo. A quem posso comunicar?',
      resposta: 'À Câmara Municipal de Águeda, cujo Gabinete Técnico Florestal responde pelo endereço gtf@cm-agueda.pt, ou à GNR, pela Linha SOS Ambiente e Território (808 200 520, todos os dias, 24 horas) ou pelo endereço sepna@gnr.pt.',
    },
    {
      pergunta: 'Há apoios para limpar o terreno em 2026?',
      resposta: 'Para a faixa à volta de uma casa, não encontrámos nenhum apoio aberto a particulares a 21 de outubro de 2026. O programa Floresta Ativa (ICNF e Fundo Ambiental) apoiou em 2025 a gestão de povoamentos florestais de particulares, excluindo o eucaliptal e os terrenos só com mato; a 11 de agosto de 2026, o Governo anunciou uma segunda fase para produtores florestais, com candidaturas ao ICNF ainda por abrir.',
    },
    {
      pergunta: 'Posso queimar o mato cortado?',
      resposta: 'Só com comunicação prévia ou autorização da câmara municipal, conforme a época do ano e o perigo de incêndio; uma queimada precisa sempre de autorização e de acompanhamento técnico. A alternativa é triturar o mato no local e levar os ramos e troncos, que é o que fazemos.',
    },
    {
      pergunta: 'A limpeza de terrenos paga IVA a 6 % ou a 23 %?',
      resposta: 'Depende do trabalho. A taxa reduzida de 6 % aplica-se à limpeza feita no âmbito da gestão da floresta e da prevenção de incêndios, como as faixas de gestão de combustível (lista I do Código do IVA, verba 4.1); a poda de árvores e o corte de madeira constam da verba 4.2. Fora desse âmbito, como a desmatação para uma obra, aplica-se em regra a taxa normal de 23 %.',
    },
    {
      pergunta: 'Limpam terrenos inclinados ou sem entrada para o trator?',
      resposta: 'Sim. O trator só trabalha onde há acesso e pouco declive; taludes, encostas, socalcos e o espaço junto às casas limpamos com roçadoras e motosserras.',
    },
    {
      pergunta: 'Trabalham em todas as freguesias de Águeda?',
      resposta: 'Sim, em todo o concelho: na cidade, nas freguesias do vale do Vouga e junto à Pateira, e nas aldeias da serra.',
    },
  ],
  quemFaz: 'Os trabalhos são feitos pela equipa VITFIX, sem subcontratar.',
  ligacoes: [
    {
      href: '/pt/servicos/terraplanagem-agueda/',
      titulo: 'Terraplanagem e desaterro em Águeda',
      texto: 'Depois da desmatação, nivelar o terreno ou abrir a plataforma de uma casa.',
    },
    {
      href: '/pt/servicos/poda-arvores-agueda/',
      titulo: 'Poda e abate de árvores em Águeda',
      texto: 'Eucaliptos e pinheiros junto à casa, árvores a abater ou a desramar para as faixas.',
    },
    {
      href: '/pt/servicos/jardineiro-agueda/',
      titulo: 'Jardineiro em Águeda',
      texto: 'Manutenção regular do jardim e do quintal depois da limpeza.',
    },
    {
      href: '/pt/servicos/limpeza-espacos-agueda/',
      titulo: 'Limpeza e remoção de entulho em Águeda',
      texto: 'Entulho, lixo e monos acumulados num terreno ou num anexo.',
    },
    {
      href: '/pt/servicos/limpeza-de-telhados/',
      titulo: 'Lavagem e impermeabilização de telhados',
      texto: 'Musgo nas telhas e caleiras cheias de folhas: a mesma equipa trata do telhado, em todo o concelho.',
    },
  ],
  metiersLigados: ['jardineiro', 'poda-arvores', 'limpeza-espacos'],
  mensagemWhatsapp: 'Olá! Tenho um terreno para limpar no concelho de Águeda. Envio fotografias e a localização.',
  ctaFinal: 'Peça o orçamento para o seu terreno em Águeda',
  // Page publiée le 23/10/2026 (DATA_PAGINAS_AGUEDA) ; carte vers limpeza de telhados ajoutée le 28/10/2026.
  dataModificacao: DATA_LIGACOES_AGUEDA_TELHADOS,
}

export const TERRAPLANAGEM_AGUEDA: ServicoConcelho = {
  slug: 'terraplanagem-agueda',
  cidade: 'agueda',
  nome: 'Terraplanagem e desaterro',
  tipoServico: 'Terraplanagem, desaterro e movimento de terras',
  icon: '🏗️',
  titulo: 'Terraplanagem e desaterro em Águeda: movimento de terras',
  h1: 'Terraplanagem e desaterro em Águeda',
  resumo: 'Terraplanagem, desaterro e movimento de terras em todo o concelho de Águeda, com giratória ou retroescavadora.',
  intro: [
    'A equipa VITFIX faz terraplanagem, desaterro e aterro em todas as freguesias do concelho de Águeda: abrir a plataforma de uma moradia, baixar ou subir a cota de um terreno, nivelar um quintal, preparar um acesso.',
    'Trabalhamos com giratória ou retroescavadora, conforme o espaço e o volume, e levamos as terras que sobram. O orçamento é grátis e sem compromisso; para começar, envie fotografias do terreno e, se já existir, a planta do projeto por WhatsApp.',
  ],
  servicos: [
    {
      titulo: 'Desaterro',
      texto: 'Escavação para baixar a cota do terreno: plataforma de uma moradia, garagem, zona de estacionamento ou acesso à casa.',
    },
    {
      titulo: 'Aterro e nivelamento',
      texto: 'Subir ou acertar o nível do terreno com terra, até à cota do projeto, ou para deixar um quintal plano.',
    },
    {
      titulo: 'Desmatação e decapagem',
      texto: 'Antes de mexer na terra, retiramos a vegetação, os cepos e as raízes e a camada de terra vegetal, que não serve para aterro.',
    },
    {
      titulo: 'Carga e transporte de terras',
      texto: 'As terras que sobram são carregadas e levadas do terreno, ou espalhadas no próprio terreno quando o projeto o permite.',
    },
  ],
  equipamento: 'giratória ou retroescavadora para escavar, carregar e nivelar; camião ou trator com reboque para levar as terras e os sobrantes; trator com destroçador e motosserras para a desmatação prévia.',
  naoFazemos: [],
  metodo: [
    {
      titulo: 'Fotografias, projeto e localização',
      texto: 'Envie fotografias do terreno, a localização e, se houver, a planta do projeto com as cotas. Para perceber o volume de terra e o acesso da máquina, vamos ver o terreno.',
    },
    {
      titulo: 'Orçamento',
      texto: 'Com o volume a escavar ou a aterrar, o tipo de solo, o acesso e o destino das terras, enviamos o orçamento antes de qualquer trabalho.',
    },
    {
      titulo: 'Desmatação',
      texto: 'Retiramos a vegetação e a terra vegetal antes de começar o movimento de terras.',
    },
    {
      titulo: 'Escavação, aterro e nivelamento',
      texto: 'Giratória ou retroescavadora, conforme o espaço e o volume, até às cotas combinadas.',
    },
    {
      titulo: 'Terras sobrantes',
      texto: 'Carregamos e levamos as terras que não ficam no terreno.',
    },
  ],
  preco: {
    titulo: 'Quanto custa a terraplanagem de um terreno',
    texto: 'Não publicamos um preço por metro quadrado ou por metro cúbico: o mesmo volume de terra custa mais numa encosta sem acesso ou num solo com pedra do que num terreno plano de terra solta. O preço do orçamento depende sobretudo de:',
    fatores: [
      'O volume de terra a escavar ou a aterrar.',
      'O tipo de solo: terra, saibro ou rocha.',
      'O acesso para a máquina e o espaço para manobrar.',
      'O volume de terras a levar e a distância até ao destino.',
      'A terra a trazer de fora, quando o terreno precisa de aterro.',
      'A desmatação prévia, quando o terreno tem mato ou árvores.',
    ],
  },
  regras: {
    titulo: 'Licenças e regras antes de mexer na terra',
    // RJUE (DL 555/99) revu et republié par le DL 108/2026, en vigueur le 01/10/2026 (date fixée par le DL 155-B/2026) :
    // art. 2.º m), art. 4.º n.º 2 b) et n.º 4 c), art. 6.º-A n.º 1 d), vérifiés dans le texte consolidé (PGDL, 26.ª versão)
    // le 21/10/2026.
    intro: 'Escavar ou aterrar muda o relevo do terreno, e a lei trata isso como uma operação urbanística. As regras abaixo são as do Regime Jurídico da Urbanização e Edificação revisto, em vigor desde 1 de outubro de 2026, e dos regimes da Reserva Ecológica, da Reserva Agrícola, do domínio hídrico e dos resíduos. Em caso de dúvida, peça uma informação prévia à Câmara Municipal antes de começar.',
    itens: [
      {
        titulo: 'Licença ou comunicação prévia',
        texto: 'Os trabalhos de remodelação de terrenos (destruir o coberto vegetal, alterar o relevo ou a camada de solo arável, ou derrubar árvores de alto porte ou em maciço, para fins que não sejam só agrícolas, pecuários, florestais ou mineiros) precisam de licença da câmara municipal, ou de comunicação prévia quando o terreno está num loteamento ou plano de pormenor que já define as obras de urbanização. Quando a terraplanagem faz parte de uma obra com projeto, confirme no processo dessa obra.',
      },
      {
        titulo: 'Pequenos arranjos à volta da casa',
        texto: 'As obras de escassa relevância urbanística, como pequenas obras de arranjo e melhoramento da área à volta de uma casa que não afetem o domínio público, ou muros de suporte de terras até 2 metros, não precisam de licença nem de comunicação prévia. Na dúvida, confirme com a câmara.',
      },
      {
        titulo: 'Reserva Ecológica e Reserva Agrícola',
        texto: 'Na Reserva Ecológica Nacional, escavações e aterros são, em regra, proibidos, salvo usos compatíveis comunicados à CCDR. Na Reserva Agrícola Nacional, um uso não agrícola precisa de parecer prévio da entidade regional da RAN. A planta de condicionantes do PDM de Águeda mostra se o terreno está numa delas.',
      },
      {
        titulo: 'Junto a ribeiros e rios',
        texto: 'As margens dos cursos de água fazem parte do domínio hídrico: 10 metros nos que não são navegáveis nem flutuáveis, 30 metros nos navegáveis ou flutuáveis. Trabalhar com máquinas nessas margens passa pela Agência Portuguesa do Ambiente e, em Rede Natura 2000, também pelo ICNF.',
      },
      {
        titulo: 'Terras que sobram',
        texto: 'Terra limpa reutilizada no próprio local da escavação não é resíduo. Levada para outro sítio, ou é reutilizada como subproduto, com análises e declaração à APA, ou segue como resíduo de construção para um operador licenciado, com guia eletrónica de acompanhamento (e-GAR).',
      },
      {
        titulo: 'Sobreiros e azinheiras',
        texto: 'Cortar ou arrancar sobreiros e azinheiras precisa de autorização do ICNF. Depois do corte ou arranque ilegal de um povoamento de sobreiros ou azinheiras, ficam proibidas nesse terreno, durante 25 anos, construções, obras de urbanização e remodelações do terreno (artigo 5.º do Decreto-Lei n.º 169/2001).',
      },
    ],
    fontes: [
      FONTES.rjue,
      { nome: 'APA: nota técnica sobre solos e rochas não contaminados (subprodutos)', url: 'https://apambiente.pt/sites/default/files/_Residuos/Producao_Gest%C3%A3o_Residuos/Subprodutos/nota-tecnica_solos-e-rochas_versao2_0.pdf' },
      { nome: 'ICNF: pedido de autorização para corte ou arranque de sobreiros e azinheiras', url: 'https://www.icnf.pt/api/file/doc/2cfec17106bb518c' },
    ],
    verificadoEm: '2026-10-21',
  },
  zona: {
    titulo: 'Terraplanagem nas freguesias de Águeda',
    intro: 'Trabalhamos nas 15 freguesias do concelho. O relevo muda muito entre a serra, a nascente, onde o terreno passa os 700 metros, e os campos junto ao rio e à Pateira, a poente, onde desce quase ao nível do mar: é o que mais pesa no acesso da máquina, no trabalho e no preço.',
    // Mêmes groupes que la page de limpeza (PMDFCI, quadro 11), textes propres au movimento de terras.
    grupos: [
      {
        titulo: 'Cidade e arredores',
        freguesias: ['Águeda', 'Borralha', 'Recardães e Espinhel', 'Trofa, Segadães e Lamas do Vouga'],
        texto: 'Lotes urbanos e terrenos para construção entre casas: pouco espaço para manobrar e para deixar terra de lado, por isso a escolha entre giratória e retroescavadora e o transporte das terras pesam tanto como o volume. Num loteamento que já define as obras de urbanização, a remodelação do terreno faz-se por comunicação prévia em vez de licença.',
      },
      {
        titulo: 'Pateira e campos a poente',
        freguesias: ['Fermentelos', 'Travassô e Óis da Ribeira', 'Aguada de Baixo', 'Barrô'],
        texto: 'Terreno baixo, com campos agrícolas e a Pateira de Fermentelos, sítio Ramsar integrado na Rede Natura 2000 (zona de proteção especial da Ria de Aveiro). Antes de aterrar ou escavar, vale a pena ver na planta de condicionantes do PDM se o terreno está em Reserva Agrícola, Reserva Ecológica ou Rede Natura; nos terrenos baixos e húmidos, as máquinas só trabalham bem com o solo seco.',
      },
      {
        titulo: 'Encostas florestais a norte e a sul',
        freguesias: ['Macinhata do Vouga', 'Valongo do Vouga', 'Aguada de Cima'],
        texto: 'Vales agrícolas e encostas florestais. O rio Vouga está na Rede Natura 2000 (sítio Rio Vouga) e as margens dos ribeiros e rios fazem parte do domínio hídrico. Nas encostas, abrir uma plataforma para uma casa ou um anexo pode obrigar a muros de suporte depois do desaterro, e a desmatação vem quase sempre antes.',
      },
      {
        titulo: 'Serra, a nascente',
        freguesias: ['Préstimo e Macieira de Alcoba', 'Agadão', 'Belazaima do Chão', 'Castanheira do Vouga'],
        texto: 'Encostas inclinadas, vales encaixados dos rios Águeda, Alfusqueiro e Agadão e caminhos estreitos até às aldeias: o acesso da máquina e o tipo de solo são o que mais pesa no trabalho. É também a zona mais florestal do concelho, onde a desmatação antes do movimento de terras é necessária quase sempre.',
      },
    ],
    fontes: [FONTES.freguesias, FONTES.pmdfci, FONTES.pateira],
  },
  faqs: [
    {
      pergunta: 'Qual é a diferença entre desaterro e terraplanagem?',
      resposta: 'O desaterro é a escavação que retira terra para baixar a cota do terreno; o aterro é o contrário, acrescentar terra para a subir. A terraplanagem, que também se escreve terraplenagem, é o conjunto destes trabalhos para deixar o terreno com a forma e o nível pretendidos, por exemplo a plataforma de uma casa.',
    },
    {
      pergunta: 'Quanto custa a terraplanagem de um terreno em Águeda?',
      resposta: 'Depende do volume de terra, do tipo de solo, do acesso para a máquina e do destino das terras que sobram; por isso não damos um preço por metro cúbico sem ver o terreno. Envie fotografias, a localização e, se houver, a planta do projeto por WhatsApp e respondemos com um orçamento, grátis e sem compromisso.',
    },
    {
      pergunta: 'Preciso de licença para fazer terraplanagem?',
      resposta: 'Em regra, sim: os trabalhos de remodelação de terrenos que não sejam só para fins agrícolas, pecuários, florestais ou mineiros precisam de licença municipal, ou de comunicação prévia num loteamento ou plano de pormenor que já os preveja. Ficam isentas as obras de escassa relevância urbanística, como pequenos arranjos à volta de uma casa que não afetem o domínio público; na dúvida, confirme com a câmara antes de começar.',
    },
    {
      pergunta: 'O que acontece às terras que sobram?',
      resposta: 'Ficam no próprio terreno quando o projeto o permite. As que saem são levadas: reutilizadas noutro local como subproduto, com as análises e a declaração à APA, ou entregues como resíduo a um operador licenciado, com guia eletrónica.',
    },
    {
      pergunta: 'Fazem também a desmatação antes?',
      resposta: 'Sim. Retiramos o mato, os cepos, as raízes e a terra vegetal antes do movimento de terras, com o trator, as roçadoras e a giratória ou a retroescavadora.',
    },
  ],
  quemFaz: 'Os trabalhos são feitos pela equipa VITFIX, sem subcontratar.',
  ligacoes: [
    {
      href: '/pt/servicos/limpeza-de-terrenos-agueda/',
      titulo: 'Limpeza de terrenos e desmatação em Águeda',
      texto: 'Mato, silvas e faixas de gestão de combustível, com trator e roçadoras.',
    },
    {
      href: '/pt/servicos/pedreiro-agueda/',
      titulo: 'Pedreiro em Águeda',
      texto: 'Muros de suporte, fundações e alvenaria depois do movimento de terras.',
    },
    {
      href: '/pt/servicos/obras-remodelacao-agueda/',
      titulo: 'Obras e remodelação em Águeda',
      texto: 'A obra que se segue à preparação do terreno.',
    },
    {
      href: '/pt/servicos/limpeza-de-telhados/',
      titulo: 'Lavagem e impermeabilização de telhados',
      texto: 'Na casa já construída: lavagem das telhas, hidrofugante e limpeza das caleiras e dos algerozes.',
    },
  ],
  metiersLigados: ['pedreiro', 'obras-remodelacao'],
  mensagemWhatsapp: 'Olá! Preciso de terraplanagem ou desaterro num terreno no concelho de Águeda. Envio fotografias e a localização.',
  ctaFinal: 'Peça o orçamento para o seu terreno em Águeda',
  // Page publiée le 23/10/2026 (DATA_PAGINAS_AGUEDA) ; carte vers limpeza de telhados ajoutée le 28/10/2026.
  dataModificacao: DATA_LIGACOES_AGUEDA_TELHADOS,
}

export const SERVICOS_CONCELHO: ServicoConcelho[] = [LIMPEZA_DE_TERRENOS_AGUEDA, TERRAPLANAGEM_AGUEDA]

/**
 * lastmod d'une page de concelho : sa propre date, ou la date de mise en production (`publicado`, `atualizado`) du dernier
 * chantier affiché si elle est plus récente. Un chantier ajouté plus tard à local-proof.json change donc la date.
 */
export function dataModificacaoConcelho(servico: ServicoConcelho): string {
  const datas = [servico.dataModificacao, ...chantiersPara(servico.slug, servico.cidade).map(dataChantier)].filter(Boolean)
  return datas.sort((a, b) => a.localeCompare(b)).at(-1) ?? servico.dataModificacao
}

/** Pages de service d'un concelho que la page métier x ville `metier` de `cidade` doit lier. */
export function servicosConcelhoLigados(metier: string, cidade: string): ServicoConcelho[] {
  return SERVICOS_CONCELHO.filter((s) => s.cidade === cidade && s.metiersLigados.includes(metier))
}
