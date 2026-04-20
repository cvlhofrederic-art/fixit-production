import { supabase } from '@/lib/supabase'
import type { RefTaux, Juridiction } from './types'

let cache: { data: RefTaux[]; loadedAt: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

export async function loadRefTaux(): Promise<RefTaux[]> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return cache.data
  }
  const { data, error } = await supabase
    .from('ref_taux')
    .select('*')
    .order('date_debut_validite', { ascending: false })
  if (error) throw new Error(`Failed to load ref_taux: ${error.message}`)
  const taux = (data ?? []).map((row) => ({
    ...row,
    taux: Number(row.taux),
    seuil_min: row.seuil_min != null ? Number(row.seuil_min) : null,
    seuil_max: row.seuil_max != null ? Number(row.seuil_max) : null,
  }))
  cache = { data: taux, loadedAt: Date.now() }
  return taux
}

export function invalidateCache(): void {
  cache = null
}

export function getTaux(
  allTaux: RefTaux[], juridiction: Juridiction, typeCharge: string,
  regime: string, date: Date, montant?: number,
): RefTaux | undefined {
  const dateStr = date.toISOString().split('T')[0]
  return allTaux.find((t) => {
    if (t.juridiction !== juridiction) return false
    if (t.type_charge !== typeCharge) return false
    if (t.regime !== regime && t.regime !== 'all') return false
    if (t.date_debut_validite > dateStr) return false
    if (t.date_fin_validite && t.date_fin_validite < dateStr) return false
    if (montant !== undefined) {
      if (t.seuil_min != null && montant < t.seuil_min) return false
      if (t.seuil_max != null && montant > t.seuil_max) return false
    } else {
      if (t.seuil_min != null || t.seuil_max != null) return false
    }
    return true
  })
}

export function getAllTauxForRegime(
  allTaux: RefTaux[], juridiction: Juridiction, regime: string, date: Date,
): RefTaux[] {
  const dateStr = date.toISOString().split('T')[0]
  return allTaux.filter((t) => {
    if (t.juridiction !== juridiction) return false
    if (t.regime !== regime && t.regime !== 'all') return false
    if (t.date_debut_validite > dateStr) return false
    if (t.date_fin_validite && t.date_fin_validite < dateStr) return false
    return true
  })
}
