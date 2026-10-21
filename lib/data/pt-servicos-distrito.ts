// Pages de service à l'échelle du district (plan de pages du 19/10/2026,
// docs/seo/porto-palavras-chave/plano-paginas.md) : une page forte par service pour tout le distrito do
// Porto, au lieu d'une série de pages par concelho (politiques Google « doorway abuse » et « scaled
// content abuse », guide docs/seo/porto-palavras-chave/consignes-google-2026-10-19.md). Le gel A0
// (aucun nouveau métier avant la fin de la phase 3) a été levé par le propriétaire le 20/10/2026 pour
// trois pages : limpeza de telhados, renovação de fachadas, trabalhos verticais.
//
// Règle 0.2 : aucun prix, délai, chantier ni avis dans ces textes. Les prestations citées sont celles que
// le propriétaire a confirmées le 20/10/2026 (lavagem e tratamento antimusgo, hidrofugação, pintura de
// telhas, caleiras e algerozes ; travaux faits par l'équipe VITFIX ; telhados de fibrocimento non traités), puis le
// 21/10/2026 : accès par andaimes ou cordistes certifiés IRATA, lavage haute pression avec un produit pour tuiles avant
// l'impermeabilização (hidrofugante).
// Prix et délais réels : data/seo/local-proof.json (clé « limpeza-de-telhados »), blocs absents tant
// qu'ils sont vides. Textes à relire par le propriétaire.

import { DATA_PAGINAS_DISTRITO } from '@/lib/seo/pt-datas'
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
  /** Distrito servi (valeur de `CityData.distrito`). */
  distrito: string
  /** Titre sans marque (le template `%s | VITFIX` l'ajoute) et h1. */
  titulo: string
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
  faqs: PerguntaServico[]
  ligacoes: LigacaoServico[]
  /** Métiers de la grille dont les pages du même distrito et le hub lient cette page. */
  metiersLigados: string[]
  /** Début du message WhatsApp prérempli (le lieu suit, voir mensagemLocal). */
  mensagemWhatsapp: string
  /** Dernière modification significative (lastmod), jour de la mise en production. */
  dataModificacao: string
}

export const LIMPEZA_DE_TELHADOS: ServicoDistrito = {
  slug: 'limpeza-de-telhados',
  nome: 'Limpeza de telhados',
  tipoServico: 'Limpeza de telhados e caleiras',
  icon: '🏠',
  distrito: 'Porto',
  titulo: 'Limpeza de telhados e caleiras no distrito do Porto',
  h1: 'Limpeza de telhados e caleiras no distrito do Porto',
  resumo: 'Lavagem, impermeabilização e pintura de telhados, tratamento antimusgo e limpeza de caleiras no distrito do Porto.',
  intro:
    'A equipa VITFIX limpa telhados e caleiras em todo o distrito do Porto, a partir de Marco de Canaveses: lavagem do telhado com tratamento contra o musgo e os líquenes, impermeabilização das telhas (hidrofugação), pintura de telhas e limpeza de caleiras e algerozes. Não limpamos telhados de fibrocimento (lusalite). O orçamento é grátis e sem compromisso.',
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
    'Não há um intervalo fixo: depende da exposição do telhado, das árvores à volta e da humidade. Com os invernos chuvosos do distrito do Porto, vale a pena verificar o telhado e as caleiras todos os anos, de preferência antes das chuvas de outono.',
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
  mensagemWhatsapp: 'Olá! Gostaria de um orçamento para a limpeza de um telhado.',
  dataModificacao: DATA_PAGINAS_DISTRITO,
}

/** Pages de district publiées (ordre des liens et du sitemap). */
export const SERVICOS_DISTRITO: ServicoDistrito[] = [LIMPEZA_DE_TELHADOS]

/** Pages de district à lier depuis les pages d'un métier de la grille (même distrito) et son hub. */
export function servicosDistritoLigados(metier: string, distrito?: string): ServicoDistrito[] {
  return SERVICOS_DISTRITO.filter((s) => s.metiersLigados.includes(metier) && (!distrito || s.distrito === distrito))
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
  /** lastmod de la page concelho : textes du service, relecture, chantiers et notes du concelho. */
  dataModificacao: string
}

function maisRecente(datas: string[]): string {
  return [...datas].filter(Boolean).sort((a, b) => a.localeCompare(b)).at(-1) ?? ''
}

/** Pages concelho ouvertes, pour toutes les pages de district. */
export function paginasConcelhoDistrito(): PaginaConcelhoDistrito[] {
  return SERVICOS_DISTRITO.flatMap((servico) =>
    CITIES.filter((city) => city.distrito === servico.distrito).flatMap((city) => {
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
  const todos = CITIES.filter((city) => city.distrito === servico.distrito)
    .flatMap((city) => chantiersDocumentados(servico, city.slug))
    .sort((a, b) => b.mes.localeCompare(a.mes))
  const exibidos = todos.slice(0, 6)
  for (const pagina of paginasConcelhoDistrito().filter((p) => p.servico.slug === servico.slug)) {
    if (!exibidos.some((c) => c.cidade === pagina.city.slug)) exibidos.push(pagina.chantiers[0])
  }
  return exibidos.sort((a, b) => b.mes.localeCompare(a.mes))
}

/** lastmod de la page de district : ses textes, ou le dernier chantier affiché, ou la dernière page concelho ouverte. */
export function dataModificacaoDistrito(servico: ServicoDistrito): string {
  const abertas = paginasConcelhoDistrito().filter((p) => p.servico.slug === servico.slug).map((p) => p.dataAbertura)
  return maisRecente([servico.dataModificacao, ...chantiersExibidosDistrito(servico).map(dataChantier), ...abertas])
}
