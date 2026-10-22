// Titres et descriptions des pages PT (phase 1 du plan SEO PT, point 1.4).
//
// Règles : la marque apparaît une seule fois (ajoutée par le template `%s | VITFIX` de
// app/pt/layout.tsx), le titre fait 35 à 65 caractères marque comprise, la description
// 120 à 155 caractères avec un fait réel de la page (population, distrito ; freguesias si la place reste).
// Aucune donnée inventée : seules les données de lib/data/seo-pages-data.ts sont utilisées.

import type { CityData, ServiceData } from '@/lib/data/seo-pages-data'
import { TELEFONE_PT_TEXTE } from './entite-pt'

export const MARCA = 'VITFIX'
export const SUFIXO_MARCA = ` | ${MARCA}`
export const TITULO_MAX = 65
export const DESCRICAO_MAX = 155

/** Retire une marque déjà présente en fin de titre (« … | VITFIX », « … | VITFIX Portugal »). */
export function semMarca(titulo: string): string {
  return titulo.replace(/\s*[|:·\-–—]\s*VITFIX(\s+Portugal)?\s*$/i, '').trim()
}

/** Coupe une chaîne à `max` caractères sur une limite de mot. */
export function cortar(texto: string, max: number): string {
  if (texto.length <= max) return texto
  const corte = texto.slice(0, max + 1)
  const ultimoEspaco = corte.lastIndexOf(' ')
  return (ultimoEspaco > max * 0.6 ? corte.slice(0, ultimoEspaco) : texto.slice(0, max)).replace(/[\s,;:·\-–]+$/, '')
}

/**
 * Titre sans marque (le template l'ajoute) : `base: qualificativo` si le tout tient en 65
 * caractères marque comprise, sinon `base` seul.
 */
export function titulo(base: string, qualificativo?: string | string[]): string {
  const limpo = semMarca(base)
  // Plusieurs qualificatifs : du plus complet au plus court, le premier qui tient est retenu.
  const candidatos = (Array.isArray(qualificativo) ? qualificativo : [qualificativo]).filter((q): q is string => Boolean(q))
  for (const q of candidatos) {
    const completo = `${limpo}: ${q}`
    if (completo.length + SUFIXO_MARCA.length <= TITULO_MAX) return completo
  }
  return limpo.length + SUFIXO_MARCA.length <= TITULO_MAX ? limpo : cortar(limpo, TITULO_MAX - SUFIXO_MARCA.length)
}

/**
 * Titre d'article de blog : le `metaTitle` rédactionnel sans sa marque si le template tient,
 * sinon le titre visible (h1), sinon le `metaTitle` coupé sans template (`absolute`).
 */
export function tituloBlog(metaTitle: string, tituloVisivel: string): string | { absolute: string } {
  const candidatos = [semMarca(metaTitle), semMarca(tituloVisivel)]
  for (const c of candidatos) {
    if (c.length + SUFIXO_MARCA.length <= TITULO_MAX) return c
  }
  return { absolute: cortar(candidatos[0], TITULO_MAX) }
}

/**
 * Assemble des parties par priorité décroissante sans dépasser 155 caractères. Une partie
 * donnée sous forme de tableau est une liste de variantes, de la plus longue à la plus
 * courte : la première qui tient est retenue (ex. phrase de contact complète, puis abrégée).
 */
export function descricao(partes: Array<string | string[]>, max = DESCRICAO_MAX): string {
  let resultado = ''
  for (const parte of partes) {
    const variantes = (Array.isArray(parte) ? parte : [parte]).map((v) => v.trim()).filter(Boolean)
    for (const v of variantes) {
      const candidato = resultado ? `${resultado} ${v}` : v
      if (candidato.length <= max) {
        resultado = candidato
        break
      }
    }
    if (!resultado && variantes[0]) resultado = cortar(variantes[0], max)
  }
  return resultado
}

export const numero = (n: number) => n.toLocaleString('pt-PT')

/** « do Porto » (toponyme avec article), « de Braga », « de Aveiro » : le nom officiel est « Distrito do Porto ». */
export function nomeDistrito(distrito: string): string {
  return distrito === 'Porto' ? 'do Porto' : `de ${distrito}`
}

/**
 * Titre « <nome><complemento> <cidade> » (complemento : « em », « urgente em », « perto de mim em ») :
 * le nom de la ville n'est jamais coupé. Si l'ensemble dépasse 65 caractères marque comprise, le
 * qualificatif saute, puis le nom du métier perd ses derniers mots (« Estores e Portões Automáticos »
 * → « Estores e Portões »). Sans cette règle, 32 titres finissaient en « em Marco de | VITFIX ».
 */
export function tituloComCidade(nome: string, complemento: string, cidade: string, qualificativo?: string | string[]): string {
  const fim = ` ${complemento} ${cidade}`
  const completo = titulo(`${nome}${fim}`, qualificativo)
  if (completo.includes(fim)) return completo
  const maxNome = TITULO_MAX - SUFIXO_MARCA.length - fim.length
  const curto = cortar(nome, maxNome).replace(/\s+(e|de|do|da|dos|das)$/i, '')
  return `${curto}${fim}`
}

/** Qualificatif court par métier, tiré des libellés existants (metaTitle / features). */
export const QUALIFICATIVO_SERVICO: Record<string, string> = {
  eletricista: 'avarias, quadros e tomadas',
  canalizador: 'fugas e entupimentos',
  pintor: 'interior e exterior',
  pladur: 'tetos falsos e divisórias',
  'obras-remodelacao': 'casas e apartamentos',
  'isolamento-termico': 'capoto e ETICS',
  impermeabilizacao: 'telhados, terraços e caves',
  desentupimento: 'canos e esgotos',
  'faz-tudo': 'pequenas reparações',
  serralheiro: 'portas e fechaduras',
  telhador: 'reparação de telhados',
  vidraceiro: 'vidros e janelas',
  azulejador: 'azulejos e ladrilhos',
  pedreiro: 'alvenaria e muros',
  'ar-condicionado': 'instalação e manutenção',
  carpinteiro: 'móveis, portas e janelas',
  jardineiro: 'jardins e relva',
  'limpeza-espacos': 'despejos e entulho',
  'poda-arvores': 'poda e abate',
  'limpeza-condominio': 'partes comuns',
  'estores-portoes': 'estores e portões',
}

// Lot 1 SEO PT (14/10/2026) : urgências dans les balises de toutes les spécialités. Service SOS 24 h / 7 j
// confirmé par écrit par le propriétaire le 13/10/2026 ; le 14/10 il a tranché : « tu peux garder le mot clef
// urgências sur toutes les spécialités ». Garde-fou de cohérence (test pt-phase-1-hygiene) : le texte d'urgence
// de chaque métier (urgencyText, lib/data/seo-pages-data.ts) annonce une intervention urgente, immédiate, 24h
// ou le jour même (URGENCIA_NO_TEXTO) ; les huit textes qui décrivaient un service planifié ou « rapide » ont
// été réécrits depuis leur propre liste « quando chamar ». La liste reste explicite : un métier à retirer, c'est
// une ligne ici.
export const URGENCIA_NO_TEXTO = /urg[êe]n|imediat|próprio dia|disponível 24 ?h/i

export const METIERS_URGENCIA = new Set<string>([
  'eletricista', 'canalizador', 'desentupimento', 'serralheiro', 'telhador', 'vidraceiro', 'impermeabilizacao',
  'pedreiro', 'ar-condicionado', 'carpinteiro', 'faz-tudo', 'jardineiro', 'poda-arvores', 'estores-portoes',
  'pintor', 'pladur', 'obras-remodelacao', 'isolamento-termico', 'azulejador', 'limpeza-espacos', 'limpeza-condominio',
])

/** Phrase courte des descriptions (« 24/7 » est la forme courante au Portugal ; « 24h/7 » ne l'est pas). */
export const URGENCIAS_TEXTO = 'Urgências 24/7.'

/**
 * Phrase visible sous le titre (pages métier x ville) et dans l'intro des hubs : le même service, en toutes lettres.
 * « Atendimento » : c'est le contact (téléphone, WhatsApp) qui est assuré 24 h / 7 j, comme le propriétaire l'a
 * confirmé (« je réponds toujours au téléphone ») ; l'intervention suit, selon le métier et l'urgence.
 */
export const URGENCIAS_FRASE = 'Urgências: atendimento 24 horas por dia, 7 dias por semana.'

/**
 * Phrase à ajouter après l'intro visible d'un métier de METIERS_URGENCIA, pour que la page dise en clair ce que
 * le titre (« 24h ») et la description (« Urgências 24/7 ») annoncent. Seulement « Atendimento 7 dias por semana »
 * si l'intro dit déjà « 24 horas » (rien si elle dit aussi « 7 dias ») ;
 * sans « 7 dias por semana » si l'intro le dit déjà ; « Atendimento » seul si l'intro emploie
 * déjà le mot. Au final, chaque page d'un métier d'urgence affiche « 24 horas » et « 7 dias » (test
 * pt-phase-1-hygiene).
 */
export function fraseUrgenciasEncabecado(intro: string, metier: string): string {
  if (!METIERS_URGENCIA.has(metier)) return ''
  const semana = /7 dias|7\/7/i.test(intro)
  if (/24 ?h|24 horas/i.test(intro)) return semana ? '' : ' Atendimento 7 dias por semana.'
  const sujeito = /urg[êe]nci/i.test(intro) ? 'Atendimento' : 'Urgências: atendimento'
  return ` ${sujeito} 24 horas por dia${semana ? '' : ', 7 dias por semana'}.`
}

const urgencias = (metier: string) => (METIERS_URGENCIA.has(metier) ? URGENCIAS_TEXTO : '')

// Phrase de contact, de la plus longue à la plus courte : la première qui tient est retenue. Sans variante
// courte, 52 descriptions perdaient tout appel à l'action. Les métiers d'urgence (tous, depuis le 14/10) ont une
// variante de plus, à numéro seul, parce que « Urgências 24/7. » prend la place du site : le numéro reste dans
// 479 descriptions sur 505 (467 avant le lot 1 ; sans numéro : les 22 pages ville, qui n'en ont jamais eu, et
// 4 hubs aux noms de métier trop longs : isolamento-termico, azulejador, limpeza-espacos, estores-portoes). Un métier retiré de METIERS_URGENCIA retrouverait
// exactement ses variantes d'avant.
const CONTACTO = [
  `Orçamento grátis pelo site, WhatsApp ou telefone ${TELEFONE_PT_TEXTE}.`,
  'Orçamento grátis pelo site ou WhatsApp.',
  'Orçamento grátis.',
]
const CONTACTO_URGENCIA = [CONTACTO[0], `Orçamento grátis: WhatsApp ou ${TELEFONE_PT_TEXTE}.`, CONTACTO[1], CONTACTO[2]]
const contacto = (metier: string) => (METIERS_URGENCIA.has(metier) ? CONTACTO_URGENCIA : CONTACTO)

function freguesiasTexto(city: CityData): string {
  const lista = city.freguesias.slice(0, 3).join(', ')
  return lista ? `Freguesias: ${lista}.` : ''
}

// Faits réels des descriptions : population et distrito (lib/data/seo-pages-data.ts) ; trois noms de
// freguesias seulement si la place reste après la phrase de contact (aujourd'hui jamais : la variante la
// plus courte occupe le reste). Jamais « N freguesias » : `city.freguesias` est une liste de localités,
// pas le décompte officiel des freguesias du concelho.

export function tituloServico(service: ServiceData, city: CityData): string {
  // Lot 1 : « Canalizador em Penafiel: fugas e entupimentos, 24h » pour les métiers d'urgence (requêtes
  // « canalizador 24h », « urgente ») ; si la place manque, « urgências 24h » seul, puis le qualificatif seul.
  const q = QUALIFICATIVO_SERVICO[service.slug]
  const qualificativos = METIERS_URGENCIA.has(service.slug) ? [q ? `${q}, 24h` : 'urgências 24h', 'urgências 24h', q ?? ''] : q
  return tituloComCidade(service.name, 'em', city.name, qualificativos)
}

export function descricaoServico(service: ServiceData, city: CityData): string {
  return descricao([
    `${service.name} em ${city.name} (distrito ${nomeDistrito(city.distrito)}): ${numero(city.population)} habitantes.`,
    urgencias(service.slug),
    contacto(service.slug),
    freguesiasTexto(city),
  ])
}

// Pages de district (lib/data/pt-servicos-distrito.ts, gel A0 levé le 20/10/2026 pour trois services) : titre
// rédigé, sans « 24h » (service planifié, pas d'urgence), description = résumé des prestations confirmées puis
// la phrase de contact la plus longue qui tient.

export function tituloServicoDistrito(servico: { titulo: string }): string {
  return titulo(servico.titulo)
}

export function descricaoServicoDistrito(servico: { resumo: string }): string {
  return descricao([servico.resumo, [`Orçamento grátis: ${TELEFONE_PT_TEXTE}.`, ...CONTACTO.slice(1)]])
}

/**
 * Concelhos du distrito do Porto qui prennent l'article en pt-PT (« no Porto », « na Maia », « na Trofa », « na Póvoa
 * de Varzim »). Utilisé par les pages concelho des services de district ; la grille métier x ville écrit encore « em »
 * partout (à trancher par le propriétaire avant d'y toucher : 462 titres).
 */
const ARTIGO_CONCELHO: Record<string, 'o' | 'a'> = { Porto: 'o', Maia: 'a', Trofa: 'a', 'Póvoa de Varzim': 'a' }

/** « no » / « na » / « em » devant le nom d'un concelho. */
export function preposicaoEm(nome: string): string {
  const artigo = ARTIGO_CONCELHO[nome]
  return artigo === 'o' ? 'no' : artigo === 'a' ? 'na' : 'em'
}

/** « no Porto », « na Maia », « em Baião ». */
export const emConcelho = (nome: string) => `${preposicaoEm(nome)} ${nome}`

/** « do Porto », « da Maia », « de Baião ». */
export function deConcelho(nome: string): string {
  const artigo = ARTIGO_CONCELHO[nome]
  return `${artigo === 'o' ? 'do' : artigo === 'a' ? 'da' : 'de'} ${nome}`
}

/** Page concelho d'un service de district : le nom du concelho n'est jamais coupé, le fait réel est le nombre de chantiers. */
export function tituloConcelhoDistrito(pagina: { servico: { nome: string }; city: { name: string }; chantiers: unknown[] }): string {
  return tituloComCidade(pagina.servico.nome, preposicaoEm(pagina.city.name), pagina.city.name, pagina.chantiers.length > 1 ? 'trabalhos realizados' : undefined)
}

export function descricaoConcelhoDistrito(pagina: { servico: { nome: string }; city: { name: string }; chantiers: unknown[] }): string {
  const n = pagina.chantiers.length
  const trabalhos = n > 1 ? `${n} trabalhos documentados` : 'um trabalho documentado'
  return descricao([
    `${pagina.servico.nome} ${emConcelho(pagina.city.name)}: ${trabalhos} da equipa VITFIX no concelho.`,
    [`Orçamento grátis por WhatsApp ou telefone: ${TELEFONE_PT_TEXTE}.`, `Orçamento grátis: ${TELEFONE_PT_TEXTE}.`, ...CONTACTO.slice(1)],
  ])
}

// Phase 2 SEO PT : plus de pages urgencia ni perto-de-mim métier x ville (308 vers servicos) ; les
// hubs métier /pt/perto-de-mim/{metier}/ sont les seules pages « perto de mim » restantes.

export function tituloPertoDeMim(nome: string, metier = ''): string {
  // Les 22 concelhos relèvent des distritos do Porto, de Braga et de Aveiro (Aveiro et Águeda sont dans
  // la Região Centro) : pas de « Norte ».
  const zona = 'Porto, Braga e Aveiro'
  return titulo(`${nome} perto de mim`, METIERS_URGENCIA.has(metier) ? [`${zona}, 24h`, 'urgências 24h', zona] : zona)
}

export function descricaoPertoDeMim(nome: string, metier = ''): string {
  return descricao([
    `${nome} perto de si em 22 concelhos dos distritos do Porto, Braga e Aveiro.`,
    urgencias(metier),
    contacto(metier),
  ])
}

export function tituloCidade(city: CityData): string {
  return titulo(`Serviços para casa em ${city.name}`, 'eletricista, canalizador, pintor')
}

export function descricaoCidade(city: CityData, numeroServicos: number): string {
  return descricao([
    `Profissionais em ${city.name} (distrito ${nomeDistrito(city.distrito)}): ${numero(city.population)} habitantes.`,
    `${numeroServicos} serviços, de eletricista a telhador, com orçamento grátis.`,
    freguesiasTexto(city),
  ])
}
