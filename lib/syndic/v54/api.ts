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
