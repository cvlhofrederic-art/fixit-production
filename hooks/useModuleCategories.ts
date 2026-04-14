'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import type { ModuleDef } from './useModulesConfig'

export type CatMod = { id: string; icon: string; name: string; on: boolean }
export type ModCategory = { id: string; name: string; open: boolean; modules: CatMod[] }

const STORAGE_KEY = 'fixit_modules_categories_v3'

// Aligned 1:1 with V5Sidebar (pro_societe BTP) structure
const DEFAULT_STRUCTURE: Array<{ id: string; name: string; modIds: string[] }> = [
  { id: 'cat-pilotage', name: 'Pilotage', modIds: ['home', 'gestion_comptes', 'stats', 'revenus', 'motifs'] },
  { id: 'cat-chantiers', name: 'Chantiers', modIds: ['chantiers', 'gantt', 'equipes', 'pointage', 'calendar', 'meteo', 'photos_chantier', 'rapports'] },
  { id: 'cat-commercial', name: 'Commercial', modIds: ['pipeline', 'devis', 'dpgf', 'marches'] },
  { id: 'cat-facturation', name: 'Facturation', modIds: ['factures', 'situations', 'garanties'] },
  { id: 'cat-achats', name: 'Sous-traitance & Achats', modIds: ['sous_traitance', 'sous_traitance_offres', 'rfq_btp', 'marketplace_btp'] },
  { id: 'cat-finances', name: 'Finances', modIds: ['compta_btp', 'rentabilite', 'comptabilite'] },
  { id: 'cat-communication', name: 'Communication', modIds: ['messages', 'clients', 'portail_client'] },
  { id: 'cat-admin', name: 'Administration', modIds: ['wallet', 'contrats', 'horaires'] },
  { id: 'cat-vitrine', name: 'Vitrine', modIds: ['portfolio', 'parrainage'] },
]

export function buildDefaultCategories(ALL_MODULES: ModuleDef[]): ModCategory[] {
  const byId = new Map(ALL_MODULES.map(m => [m.id, m]))
  const cats: ModCategory[] = DEFAULT_STRUCTURE.map(cat => ({
    id: cat.id,
    name: cat.name,
    open: true,
    modules: cat.modIds
      .map(id => {
        const def = byId.get(id)
        if (!def) return null
        return { id, icon: def.icon, name: def.label, on: true } as CatMod
      })
      .filter((m): m is CatMod => m !== null),
  }))
  // Catch-all: any ALL_MODULES not placed → dedicated "Compte" category (settings, etc.)
  const placed = new Set(cats.flatMap(c => c.modules.map(m => m.id)))
  const extras = ALL_MODULES.filter(m => !placed.has(m.id))
  if (extras.length > 0) {
    cats.push({
      id: 'cat-compte',
      name: 'Compte',
      open: true,
      modules: extras.map(m => ({ id: m.id, icon: m.icon, name: m.label, on: true })),
    })
  }
  return cats
}

/**
 * Hook shared between V5Sidebar and ModulesSection.
 * Persists to localStorage; ensures any new ALL_MODULES entry is auto-appended.
 */
export function useModuleCategories(ALL_MODULES: ModuleDef[]) {
  const defaults = useMemo(() => buildDefaultCategories(ALL_MODULES), [ALL_MODULES])
  const [categories, setCategoriesState] = useState<ModCategory[]>(defaults)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    let loaded: ModCategory[] | null = null
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as ModCategory[]
        if (Array.isArray(parsed) && parsed.length > 0) loaded = parsed
      }
    } catch {}
    const base = loaded ?? defaults
    // Merge: append any ALL_MODULES id not in saved state (so new modules auto-appear)
    const placed = new Set(base.flatMap(c => c.modules.map(m => m.id)))
    const missing = ALL_MODULES.filter(m => !placed.has(m.id))
    if (missing.length > 0) {
      const compteCat = base.find(c => c.id === 'cat-compte')
      const additions = missing.map(m => ({ id: m.id, icon: m.icon, name: m.label, on: true }))
      if (compteCat) {
        compteCat.modules = [...compteCat.modules, ...additions]
      } else {
        base.push({ id: 'cat-compte', name: 'Compte', open: true, modules: additions })
      }
    }
    // Re-sync icon/name from ALL_MODULES (authoritative)
    const byId = new Map(ALL_MODULES.map(m => [m.id, m]))
    const synced = base.map(c => ({
      ...c,
      modules: c.modules.map(m => {
        const def = byId.get(m.id)
        return def ? { ...m, icon: def.icon, name: def.label } : m
      }),
    }))
    setCategoriesState(synced)
    setReady(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setCategories = useCallback((next: ModCategory[]) => {
    setCategoriesState(next)
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
    }
  }, [])

  return { categories, setCategories, ready }
}
