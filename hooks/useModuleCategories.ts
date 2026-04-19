'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import type { ModuleDef } from './useModulesConfig'

export type CatMod = { id: string; icon: string; name: string; on: boolean }
export type ModCategory = { id: string; name: string; open: boolean; modules: CatMod[] }

const STORAGE_KEY = 'fixit_modules_categories_v3'

// Aligned 1:1 with V5Sidebar (pro_societe BTP) structure
const DEFAULT_STRUCTURE: Array<{ id: string; name: string; namePt: string; modIds: string[] }> = [
  { id: 'cat-pilotage', name: 'Pilotage', namePt: 'Pilotagem', modIds: ['home', 'gestion_comptes', 'stats', 'revenus', 'motifs'] },
  { id: 'cat-chantiers', name: 'Chantiers', namePt: 'Obras', modIds: ['chantiers', 'gantt', 'equipes', 'pointage', 'estimation_materiaux', 'calendar', 'meteo', 'photos_chantier', 'rapports'] },
  { id: 'cat-commercial', name: 'Commercial', namePt: 'Comercial', modIds: ['pipeline', 'devis', 'dpgf', 'marches'] },
  { id: 'cat-facturation', name: 'Facturation', namePt: 'Faturação', modIds: ['factures', 'situations', 'garanties'] },
  { id: 'cat-achats', name: 'Sous-traitance & Achats', namePt: 'Subempreitada & Compras', modIds: ['sous_traitance', 'sous_traitance_offres', 'rfq_btp', 'marketplace_btp'] },
  { id: 'cat-finances', name: 'Finances', namePt: 'Finanças', modIds: ['compta_btp', 'rentabilite', 'comptabilite'] },
  { id: 'cat-communication', name: 'Communication', namePt: 'Comunicação', modIds: ['messages', 'clients', 'portail_client'] },
  { id: 'cat-admin', name: 'Administration', namePt: 'Administração', modIds: ['wallet', 'contrats', 'horaires'] },
  { id: 'cat-vitrine', name: 'Vitrine', namePt: 'Montra', modIds: ['portfolio', 'parrainage'] },
]

export function buildDefaultCategories(ALL_MODULES: ModuleDef[]): ModCategory[] {
  const byId = new Map(ALL_MODULES.map(m => [m.id, { ...m, label: m.label }]))
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

    // Migrations one-shot : s'assurer que les modules ciblés sont dans la bonne catégorie
    // (pour les users dont le localStorage date d'avant le déplacement du module).
    const MIGRATIONS: Array<{ modId: string; targetCatId: string; insertAfter?: string }> = [
      { modId: 'estimation_materiaux', targetCatId: 'cat-chantiers', insertAfter: 'pointage' },
    ]
    let migrated = false
    for (const m of MIGRATIONS) {
      let currentCat: ModCategory | undefined
      let modData: CatMod | undefined
      for (const c of base) {
        const idx = c.modules.findIndex(x => x.id === m.modId)
        if (idx !== -1) {
          currentCat = c
          modData = c.modules[idx]
          break
        }
      }
      if (!modData) continue // will be auto-added by the "missing" block below
      if (currentCat?.id === m.targetCatId) continue // already at the right place
      // Retire de la catégorie actuelle
      currentCat!.modules = currentCat!.modules.filter(x => x.id !== m.modId)
      // Insère dans la catégorie cible
      let targetCat = base.find(c => c.id === m.targetCatId)
      if (!targetCat) {
        targetCat = { id: m.targetCatId, name: m.targetCatId, open: true, modules: [] }
        base.push(targetCat)
      }
      const insertIdx = m.insertAfter
        ? targetCat.modules.findIndex(x => x.id === m.insertAfter) + 1
        : targetCat.modules.length
      targetCat.modules.splice(insertIdx > 0 ? insertIdx : targetCat.modules.length, 0, modData)
      migrated = true
    }

    // Merge: append any ALL_MODULES id not in saved state (so new modules auto-appear)
    const placed = new Set(base.flatMap(c => c.modules.map(m => m.id)))
    const missing = ALL_MODULES.filter(m => !placed.has(m.id))
    if (missing.length > 0) {
      // Respecter la catégorie déclarée dans ALL_MODULES pour chaque module manquant
      for (const mod of missing) {
        const targetCatId = 'cat-' + (mod.category === 'sous_traitance' ? 'achats' : mod.category)
        let targetCat = base.find(c => c.id === targetCatId)
        if (!targetCat) {
          targetCat = base.find(c => c.id === 'cat-compte')
          if (!targetCat) {
            targetCat = { id: 'cat-compte', name: 'Compte', open: true, modules: [] }
            base.push(targetCat)
          }
        }
        targetCat.modules.push({ id: mod.id, icon: mod.icon, name: mod.label, on: true })
      }
    }
    // Persiste la migration si elle a eu lieu (pour éviter de la refaire à chaque mount)
    if (migrated && loaded) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(base)) } catch {}
    }
    // Re-sync icon/name from ALL_MODULES (authoritative)
    const byId = new Map(ALL_MODULES.map(m => [m.id, { ...m, label: m.label }]))
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
