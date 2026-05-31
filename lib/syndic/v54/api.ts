import type { Mission, Immeuble, Artisan } from '@/components/syndic-dashboard/types'

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
