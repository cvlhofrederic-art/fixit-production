import type { Mission, Immeuble, Artisan, TeamMember } from '@/components/syndic-dashboard/types'

/**
 * Fetchers typés du dashboard syndic v54 (Phase 2) — réutilisent les routes
 * /api/syndic/* existantes (auth Bearer + filtrage cabinet RLS + mapping
 * snake_case→camelCase déjà faits côté serveur). On ne réécrit pas la couche
 * data : on la consomme.
 */

async function getList<T>(path: string, token: string, key: string): Promise<T[]> {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`)
  const json: unknown = await res.json()
  const list = (json as Record<string, unknown>)?.[key]
  return Array.isArray(list) ? (list as T[]) : []
}

export const fetchMissions = (token: string): Promise<Mission[]> =>
  getList<Mission>('/api/syndic/missions', token, 'missions')

export const fetchImmeubles = (token: string): Promise<Immeuble[]> =>
  getList<Immeuble>('/api/syndic/immeubles', token, 'immeubles')

export const fetchArtisans = (token: string): Promise<Artisan[]> =>
  getList<Artisan>('/api/syndic/artisans', token, 'artisans')

/**
 * Copropriétaire/lot — forme v54 (camelCase). La route /api/syndic/coproprios
 * renvoie le brut Supabase en snake_case (`select('*')`), donc on mappe ici.
 */
export interface Coprop {
  id: string
  immeuble: string
  batiment: string
  etage: number
  numeroPorte: string
  proprietario: string
  email: string
  telefone: string
  ocupado: boolean
  /** Permilagem (tantième). Optionnel : consommateurs `?? 0`. */
  tantieme?: number
  /** Solde du condómino. Convention (ancien dashboard) : < 0 = doit/em dívida. */
  solde?: number
  /** Accès au portail condómino activé. */
  acessoPortal?: boolean
}

function rowToCoprop(r: Record<string, unknown>): Coprop {
  const s = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : '')
  const n = (k: string) => (typeof r[k] === 'number' ? (r[k] as number) : 0)
  return {
    id: s('id'),
    immeuble: s('immeuble'),
    batiment: s('batiment'),
    etage: typeof r['etage'] === 'number' ? (r['etage'] as number) : 0,
    numeroPorte: s('numero_porte'),
    proprietario: [s('prenom_proprietaire'), s('nom_proprietaire')].filter(Boolean).join(' ').trim(),
    email: s('email_proprietaire'),
    telefone: s('tel_proprietaire'),
    ocupado: r['est_occupe'] === true,
    tantieme: n('tantieme'),
    solde: n('solde'),
    acessoPortal: r['acces_portail'] === true,
  }
}

export async function fetchCoproprios(token: string): Promise<Coprop[]> {
  const res = await fetch('/api/syndic/coproprios', { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`/api/syndic/coproprios → HTTP ${res.status}`)
  const json: unknown = await res.json()
  const list = (json as Record<string, unknown>)?.coproprios
  return Array.isArray(list) ? list.map((r) => rowToCoprop(r as Record<string, unknown>)) : []
}

/** Équipe du cabinet — TeamMember correspond déjà aux colonnes DB (full_name, is_active…). */
export const fetchTeam = (token: string): Promise<TeamMember[]> =>
  getList<TeamMember>('/api/syndic/team', token, 'members')

/** Contrat prestataire (Phase 3 — ModContratos). camelCase renvoyé par l'API. */
export interface Contrato {
  id: string
  immeuble: string
  fornecedor: string
  /** limpezas | elevadores | seguranca | jardinagem | outros */
  categoria: string
  custoMensal: number
  custoAnual: number
  dataInicio: string
  dataFim: string
  /** ativo | expirado | renovacao */
  statut: string
  notes: string
}

export const fetchContratos = (token: string): Promise<Contrato[]> =>
  getList<Contrato>('/api/syndic/contratos', token, 'contratos')

/** Endpoints des 5 agents IA syndic (route id → API). */
const AGENT_ENDPOINTS: Record<string, string> = {
  fixy: '/api/syndic/fixy-syndic',
  max: '/api/syndic/max-ai',
  lea: '/api/syndic/lea-comptable',
  alfredo: '/api/syndic/alfredo-chat',
  tempo: '/api/syndic/tempo-ai',
}

/**
 * Envoie un message à un agent IA syndic et retourne sa réponse texte.
 * Réponse : clé `response` (fixy/max/lea/tempo) ou `content` (alfredo).
 * Ne modifie aucun prompt (conforme ai-agents.md) — pur câblage UI → endpoint.
 */
export async function askAgent(route: string, message: string, token: string): Promise<string> {
  const endpoint = AGENT_ENDPOINTS[route]
  if (!endpoint) throw new Error(`Agent inconnu: ${route}`)
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) throw new Error(`${endpoint} → HTTP ${res.status}`)
  const j = (await res.json()) as Record<string, unknown>
  const text = typeof j.response === 'string' ? j.response : typeof j.content === 'string' ? j.content : ''
  return text || 'Sem resposta.'
}
