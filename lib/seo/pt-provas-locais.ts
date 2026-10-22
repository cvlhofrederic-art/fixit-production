// Données réelles des pages PT (phase 3 du plan SEO PT, section 3.2 et 3.3) : chantiers par
// ville, prix réels par métier, délais constatés, avis autorisés, méthode par métier. Source
// unique : data/seo/local-proof.json, fourni par le propriétaire (format documenté dans
// docs/seo/phase-3-donnees-reelles.md). Tant qu'une donnée manque, le bloc correspondant n'est
// pas rendu : aucune valeur par défaut, aucune donnée inventée (règle 0.2).

import provas from '@/data/seo/local-proof.json'
import { METODOS_METIER } from '@/lib/data/pt-metodos'

export interface Chantier {
  cidade: string
  metier: string
  tipo: string
  quantidade?: string
  mes: string
  freguesia?: string
  foto?: string
  /** Texte alternatif de la photo (ce qu'elle montre), obligatoire avec `foto` sur les pages de district. */
  foto_alt?: string
  consentimento_nome?: boolean
  /** Ce que l'équipe a trouvé sur place (pages de district). */
  problema?: string
  /** Ce que l'équipe a fait (pages de district). */
  solucao?: string
  /** Moyen d'accès réellement utilisé. */
  acesso?: 'andaime' | 'corda'
  /** Jour de mise en production du chantier (AAAA-MM-JJ) : lastmod des pages qui l'affichent. */
  publicado?: string
  /** Jour de mise en production d'une modification visible du chantier (photo, texte), AAAA-MM-JJ. */
  atualizado?: string
}

export interface PrecoMetier {
  metier: string
  /** Prestation précisée, pour un métier à plusieurs lignes de prix (ex. « lavagem e hidrofugação »). */
  servico?: string
  min: number
  max: number
  unite: string
  fonte?: string
  exemplos?: Array<{ mes: string; quantidade?: string; montante: number }>
}

export interface PrazoCidade {
  cidade: string
  visita_dias: number
  /** Délai de visite maximal en heures, quand le propriétaire l'exprime ainsi (« visita em 48 horas, no máximo »). */
  visita_horas_max?: number
  intervencao_dias?: number
  fonte: string
  metiers?: string[]
}

export interface Avis {
  cidade: string
  metier?: string
  nota: number
  texto: string
  mes: string
  autor?: string
  autorizacao: boolean
}

/** Particularité locale vérifiée par le propriétaire, pour la page concelho d'un service de district. */
export interface NotaConcelho {
  metier: string
  cidade: string
  texto: string
  /** Jour de mise en production de la note (AAAA-MM-JJ). */
  publicado?: string
}

/**
 * Relecture d'une page concelho par une personne (les 7 tests de la section 2.4 du guide Google du 19/10/2026), à la
 * main : sans elle, la page ne s'ouvre pas, même avec assez de chantiers. La date est celle de la mise en production.
 */
export interface RevisaoConcelho {
  metier: string
  cidade: string
  revisto: string
}

interface ProvasLocais {
  notas_concelho?: NotaConcelho[]
  revisoes_concelho?: RevisaoConcelho[]
  chantiers?: Chantier[]
  precos?: PrecoMetier[]
  prazos?: PrazoCidade[]
  avis?: Avis[]
  metodos?: Record<string, string>
}

const DADOS = provas as unknown as ProvasLocais

/** Un chantier n'est utilisable qu'avec un type de travaux et un mois (règle 3.3 du plan). */
const chantierValido = (c: Chantier) => Boolean(c.tipo && /^\d{4}-\d{2}$/.test(c.mes || ''))

/** Tous les chantiers réels d'un métier dans une ville, du plus récent au plus ancien. */
export function todosChantiersPara(metier: string, cidade: string): Chantier[] {
  return (DADOS.chantiers ?? [])
    .filter((c) => c.metier === metier && c.cidade === cidade && chantierValido(c))
    .sort((a, b) => b.mes.localeCompare(a.mes))
}

/** Chantiers réels d'un métier dans une ville, du plus récent au plus ancien, 5 au plus. */
export function chantiersPara(metier: string, cidade: string): Chantier[] {
  return todosChantiersPara(metier, cidade).slice(0, 5)
}

/** Particularités locales écrites par le propriétaire pour un service dans un concelho (phrase de plus de 20 caractères). */
export function notasConcelhoDetalhadas(metier: string, cidade: string): NotaConcelho[] {
  return (DADOS.notas_concelho ?? []).filter((n) => n.metier === metier && n.cidade === cidade && (n.texto?.trim().length ?? 0) > 20)
}

export function notasConcelhoPara(metier: string, cidade: string): string[] {
  return notasConcelhoDetalhadas(metier, cidade).map((n) => n.texto.trim())
}

/** Date de relecture d'une page concelho (AAAA-MM-JJ), ou null si elle n'a pas été relue. */
export function revisaoConcelhoPara(metier: string, cidade: string): string | null {
  const r = (DADOS.revisoes_concelho ?? []).find((x) => x.metier === metier && x.cidade === cidade)
  return r && dataIsoValida(r.revisto) ? r.revisto : null
}

/** Date AAAA-MM-JJ qui existe au calendrier (le 30/02 est refusé). */
export function dataIsoValida(d?: string): d is string {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false
  const t = new Date(`${d}T00:00:00Z`)
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d
}

const precoValido = (p: PrecoMetier) => p.max > 0 && p.min >= 0 && Boolean(p.unite)

/** Fourchette réelle d'un métier (celle de /pt/precos/ quand elle existe), sinon rien. */
export function precoPara(metier: string): PrecoMetier | null {
  const p = (DADOS.precos ?? []).find((x) => x.metier === metier)
  return p && precoValido(p) ? p : null
}

/** Toutes les fourchettes réelles d'un service (une par prestation), pour les pages de district. */
export function precosPara(metier: string): PrecoMetier[] {
  return (DADOS.precos ?? []).filter((x) => x.metier === metier && precoValido(x))
}

const prazoValido = (p: PrazoCidade) => p.visita_dias > 0 && Boolean(p.fonte)

/** Délais constatés dans une ville (pour ce métier s'ils sont précisés). */
export function prazoPara(cidade: string, metier: string): PrazoCidade | null {
  const p = (DADOS.prazos ?? []).find((x) => x.cidade === cidade && (!x.metiers || x.metiers.includes(metier)))
  return p && prazoValido(p) ? p : null
}

/** Clé `cidade` des délais valables pour tout un distrito (pages de district) : « distrito-porto ». */
export const chaveDistrito = (distrito: string) => `distrito-${distrito.toLowerCase()}`

/** Délais constatés sur tout le distrito pour ce service (entrée `cidade: "distrito-porto"`, `metiers` obligatoire). */
export function prazoDistritoPara(distrito: string, metier: string): PrazoCidade | null {
  const p = (DADOS.prazos ?? []).find((x) => x.cidade === chaveDistrito(distrito) && x.metiers?.includes(metier))
  return p && prazoValido(p) ? p : null
}

/** Avis réels, autorisés, d'un métier dans une ville (3 au plus). */
export function avisPara(metier: string, cidade: string): Avis[] {
  return (DADOS.avis ?? [])
    .filter((a) => a.cidade === cidade && (!a.metier || a.metier === metier) && a.autorizacao && a.texto && a.nota >= 1 && a.nota <= 5)
    .slice(0, 3)
}

/**
 * Méthode du métier, identique dans les 22 villes : le texte fourni par le propriétaire dans
 * data/seo/local-proof.json a priorité ; sinon le texte rédigé pour lui dans lib/data/pt-metodos.ts.
 */
export function metodoPara(metier: string): string | null {
  const m = DADOS.metodos?.[metier] ?? METODOS_METIER[metier]
  return m && m.trim().length > 40 ? m.trim() : null
}

/** Libellé « setembro de 2026 » d'un mois ISO. */
export function mesPorExtenso(mes: string): string {
  const [ano, m] = mes.split('-').map(Number)
  const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  return nomes[m - 1] ? `${nomes[m - 1]} de ${ano}` : mes
}
