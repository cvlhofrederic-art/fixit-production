// Titres et descriptions des pages PT (phase 1 du plan SEO PT, point 1.4).
//
// Règles : la marque apparaît une seule fois (ajoutée par le template `%s | VITFIX` de
// app/pt/layout.tsx), le titre fait 35 à 65 caractères marque comprise, la description
// 120 à 155 caractères avec un fait réel de la page (freguesias, population, distrito).
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
export function titulo(base: string, qualificativo?: string): string {
  const limpo = semMarca(base)
  if (qualificativo) {
    const completo = `${limpo}: ${qualificativo}`
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

// Phrase de contact : complète (téléphone PT) si elle tient, sinon abrégée. Sans variante
// courte, 52 descriptions perdaient tout appel à l'action et tombaient sous 90 caractères.
// Troisième variante pour les métiers et villes aux noms longs (« Estores e Portões Automáticos
// perto de si em Marco de Canaveses… » fait déjà 118 caractères).
const CONTACTO = [
  `Orçamento grátis pelo site, WhatsApp ou telefone ${TELEFONE_PT_TEXTE}.`,
  'Orçamento grátis pelo site ou WhatsApp.',
  'Orçamento grátis.',
]
const CONTACTO_URGENCIA = [
  `Contacto por telefone ou WhatsApp ${TELEFONE_PT_TEXTE}, ou pedido pelo site.`,
  'Contacto por WhatsApp ou pedido pelo site.',
  'Contacto por WhatsApp.',
]

function freguesiasTexto(city: CityData): string {
  const lista = city.freguesias.slice(0, 3).join(', ')
  return lista ? `Freguesias: ${lista}.` : ''
}

export function tituloServico(service: ServiceData, city: CityData): string {
  return titulo(`${service.name} em ${city.name}`, QUALIFICATIVO_SERVICO[service.slug])
}

export function descricaoServico(service: ServiceData, city: CityData): string {
  return descricao([
    `${service.name} em ${city.name} (distrito de ${city.distrito}): ${city.freguesias.length} freguesias, ${numero(city.population)} habitantes.`,
    CONTACTO,
    freguesiasTexto(city),
  ])
}

export function tituloUrgencia(service: ServiceData, city: CityData): string {
  // Qualificatif du métier quand il tient : « Pintor urgente em Maia » seul fait 31 caractères marque
  // comprise, sous le plancher de 35 du test T6.
  return titulo(`${service.name} urgente em ${city.name}`, QUALIFICATIVO_SERVICO[service.slug])
}

export function descricaoUrgencia(service: ServiceData, city: CityData): string {
  return descricao([
    `${service.name} urgente em ${city.name}: ${city.freguesias.length} freguesias, ${numero(city.population)} habitantes (distrito de ${city.distrito}).`,
    CONTACTO_URGENCIA,
    freguesiasTexto(city),
  ])
}

export function tituloPertoDeMim(nome: string, city: CityData | null): string {
  return city ? titulo(`${nome} perto de mim em ${city.name}`) : titulo(`${nome} perto de mim`, '22 concelhos do Norte')
}

export function descricaoPertoDeMim(nome: string, city: CityData | null): string {
  if (!city) {
    return descricao([
      `${nome} perto de si em 22 concelhos dos distritos do Porto, Braga e Aveiro.`,
      CONTACTO,
    ])
  }
  return descricao([
    `${nome} perto de si em ${city.name}: ${city.freguesias.length} freguesias, ${numero(city.population)} habitantes (distrito de ${city.distrito}).`,
    CONTACTO,
    freguesiasTexto(city),
  ])
}

export function tituloCidade(city: CityData): string {
  return titulo(`Serviços para casa em ${city.name}`, 'eletricista, canalizador, pintor')
}

export function descricaoCidade(city: CityData, numeroServicos: number): string {
  return descricao([
    `Profissionais em ${city.name} (distrito de ${city.distrito}): ${city.freguesias.length} freguesias, ${numero(city.population)} habitantes.`,
    `${numeroServicos} serviços, de eletricista a telhador, com orçamento grátis.`,
    freguesiasTexto(city),
  ])
}
