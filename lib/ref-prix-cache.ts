import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export interface RefPrix {
  id: string
  corps_metier: string
  prestation: string
  unite: string
  prix_min: number
  prix_moyen: number
  prix_max: number
  region: string
  source: string
  annee: number
}

const CACHE_TTL_MS = 5 * 60 * 1000

let cache: { data: RefPrix[]; expiresAt: number } | null = null
let inflight: Promise<RefPrix[]> | null = null

async function loadFromDb(): Promise<RefPrix[]> {
  const { data, error } = await supabaseAdmin
    .from('ref_prix_prestations_2026')
    .select('id, corps_metier, prestation, unite, prix_min, prix_moyen, prix_max, region, source, annee')
  if (error) {
    logger.error('[ref-prix-cache] DB load failed', { error: error.message })
    throw error
  }
  return (data || []) as RefPrix[]
}

export async function getRefPrix(corpsMetier?: string): Promise<RefPrix[]> {
  const now = Date.now()
  if (!cache || cache.expiresAt <= now) {
    if (!inflight) {
      inflight = loadFromDb()
        .then(data => { cache = { data, expiresAt: Date.now() + CACHE_TTL_MS }; return data })
        .finally(() => { inflight = null })
    }
    await inflight
  }
  const all = cache?.data || []
  return corpsMetier ? all.filter(r => r.corps_metier === corpsMetier) : all
}

export function invalidateRefPrixCache() {
  cache = null
}
