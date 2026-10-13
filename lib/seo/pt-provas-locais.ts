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
  consentimento_nome?: boolean
}

export interface PrecoMetier {
  metier: string
  min: number
  max: number
  unite: string
  fonte?: string
  exemplos?: Array<{ mes: string; quantidade?: string; montante: number }>
}

export interface PrazoCidade {
  cidade: string
  visita_dias: number
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

interface ProvasLocais {
  chantiers?: Chantier[]
  precos?: PrecoMetier[]
  prazos?: PrazoCidade[]
  avis?: Avis[]
  metodos?: Record<string, string>
}

const DADOS = provas as unknown as ProvasLocais

/** Un chantier n'est utilisable qu'avec un type de travaux et un mois (règle 3.3 du plan). */
const chantierValido = (c: Chantier) => Boolean(c.tipo && /^\d{4}-\d{2}$/.test(c.mes || ''))

/** Chantiers réels d'un métier dans une ville, du plus récent au plus ancien, 5 au plus. */
export function chantiersPara(metier: string, cidade: string): Chantier[] {
  return (DADOS.chantiers ?? [])
    .filter((c) => c.metier === metier && c.cidade === cidade && chantierValido(c))
    .sort((a, b) => b.mes.localeCompare(a.mes))
    .slice(0, 5)
}

/** Fourchette réelle d'un métier (celle de /pt/precos/ quand elle existe), sinon rien. */
export function precoPara(metier: string): PrecoMetier | null {
  const p = (DADOS.precos ?? []).find((x) => x.metier === metier)
  return p && p.max > 0 && p.min >= 0 && p.unite ? p : null
}

/** Délais constatés dans une ville (pour ce métier s'ils sont précisés). */
export function prazoPara(cidade: string, metier: string): PrazoCidade | null {
  const p = (DADOS.prazos ?? []).find((x) => x.cidade === cidade && (!x.metiers || x.metiers.includes(metier)))
  return p && p.visita_dias > 0 && p.fonte ? p : null
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
