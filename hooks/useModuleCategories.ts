'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { ModuleDef } from './useModulesConfig'
import { ID_MODULE_DICTIONNAIRE, MODULES_SELON_LE_PAYS } from '@/lib/dictionnaire-materiaux/disponibilite'

export type CatMod = { id: string; icon: string; name: string; on: boolean }
export type ModCategory = { id: string; name: string; open: boolean; modules: CatMod[] }

const STORAGE_KEY = 'fixit_modules_categories_v3'

// Aligned 1:1 with V5Sidebar (pro_societe BTP) structure
const DEFAULT_STRUCTURE: Array<{ id: string; name: string; namePt: string; modIds: string[] }> = [
  { id: 'cat-pilotage', name: 'Pilotage', namePt: 'Gestão', modIds: ['home', 'gestion_comptes', 'stats', 'revenus', 'motifs'] },
  { id: 'cat-chantiers', name: 'Chantiers', namePt: 'Obras', modIds: ['chantiers', 'gantt', 'equipes', 'pointage', 'estimation_materiaux', ID_MODULE_DICTIONNAIRE, 'calendar', 'meteo', 'photos_chantier', 'rapports'] },
  { id: 'cat-commercial', name: 'Commercial', namePt: 'Comercial', modIds: ['pipeline', 'devis', 'dpgf', 'marches'] },
  { id: 'cat-facturation', name: 'Facturation', namePt: 'Faturação', modIds: ['factures', 'situations', 'garanties'] },
  { id: 'cat-achats', name: 'Sous-traitance & Achats', namePt: 'Subempreitada & Compras', modIds: ['sous_traitance', 'sous_traitance_offres', 'rfq_btp', 'marketplace_btp'] },
  { id: 'cat-finances', name: 'Finances', namePt: 'Finanças', modIds: ['compta_btp', 'rentabilite', 'comptabilite'] },
  { id: 'cat-communication', name: 'Communication', namePt: 'Comunicação', modIds: ['messages', 'clients', 'portail_client'] },
  { id: 'cat-admin', name: 'Administration', namePt: 'Administração', modIds: ['wallet', 'contrats', 'horaires'] },
  { id: 'cat-vitrine', name: 'Vitrine', namePt: 'Montra', modIds: ['portfolio', 'parrainage'] },
]

// Rubriques par défaut (dont « Compte », créée à part) : nom enregistré à leur création (français) et nom portugais.
const RUBRIQUES_PAR_DEFAUT: ReadonlyMap<string, { name: string; namePt: string }> = new Map([
  ...DEFAULT_STRUCTURE.map(cat => [cat.id, { name: cat.name, namePt: cat.namePt }] as const),
  ['cat-compte', { name: 'Compte', namePt: 'Conta' }] as const,
])

/**
 * Nom d'une rubrique à l'écran. Les rubriques par défaut sont enregistrées avec leur nom français : en portugais, on
 * affiche leur nom portugais tant que l'utilisateur ne les a pas renommées ; un nom choisi par l'utilisateur s'affiche
 * tel quel dans les deux langues.
 */
export function nomDeRubrique(cat: Pick<ModCategory, 'id' | 'name'>, isPt: boolean): string {
  const defaut = RUBRIQUES_PAR_DEFAUT.get(cat.id)
  if (!isPt || !defaut) return cat.name
  // Une rubrique recréée par la migration de useModuleCategories porte son identifiant pour nom : non renommée non plus.
  const nonRenommee = cat.name === defaut.name || cat.name === cat.id
  return nonRenommee ? defaut.namePt : cat.name
}

/**
 * Nom à enregistrer quand l'utilisateur valide le champ de la rubrique : garder le nom enregistré si la saisie est vide
 * ou n'a pas changé ce qui était affiché (sinon le nom portugais affiché remplacerait le nom par défaut, et la rubrique
 * resterait en portugais une fois revenu en français).
 */
export function nomRubriqueApresSaisie(cat: Pick<ModCategory, 'id' | 'name'>, saisie: string, isPt: boolean): string {
  const nom = saisie.trim()
  if (!nom || nom === nomDeRubrique(cat, isPt)) return cat.name
  return nom
}

// Modules dont la présence dépend de la langue (MODULES_SELON_LE_PAYS) : absents de ALL_MODULES, ils sont retirés
// de l'affichage même si l'état enregistré les contient (côté français, pas d'entrée pour un dictionnaire qui n'existe
// que pour le Portugal), mais remis à leur place à chaque enregistrement : allumé ou éteint, déplacé, le réglage fait
// en portugais se retrouve en portugais.
interface ModuleMasque { catId: string; apres: string | null; module: CatMod }

function remettreLesMasques(categories: ModCategory[], masques: readonly ModuleMasque[]): ModCategory[] {
  if (masques.length === 0) return categories
  const copie = categories.map(c => ({ ...c, modules: [...c.modules] }))
  for (const { catId, apres, module } of masques) {
    if (copie.some(c => c.modules.some(m => m.id === module.id))) continue
    const cat = copie.find(c => c.id === catId) ?? copie[0]
    if (!cat) continue
    const position = apres === null ? 0 : cat.modules.findIndex(m => m.id === apres) + 1
    if (apres !== null && position === 0) cat.modules.push(module)
    else cat.modules.splice(position, 0, module)
  }
  return copie
}

// Un module ajouté après coup se range à la fin de sa catégorie dans un état déjà enregistré. Ceux-ci se
// placent juste après leur voisin : le dictionnaire reste sous l'estimation des matériaux.
const PLACE_APRES: Readonly<Record<string, string>> = { [ID_MODULE_DICTIONNAIRE]: 'estimation_materiaux' }

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
  /** Modules enregistrés qui n'existent pas dans cette langue : cachés, puis remis à leur place à l'enregistrement. */
  const masques = useRef<ModuleMasque[]>([])

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
        const entree: CatMod = { id: mod.id, icon: mod.icon, name: mod.label, on: true }
        const voisin = PLACE_APRES[mod.id]
        const position = voisin ? targetCat.modules.findIndex(x => x.id === voisin) : -1
        if (position >= 0) targetCat.modules.splice(position + 1, 0, entree)
        else targetCat.modules.push(entree)
      }
    }
    // Persiste la migration si elle a eu lieu (pour éviter de la refaire à chaque mount)
    if (migrated && loaded) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(base)) } catch {}
    }
    // Re-sync icon/name from ALL_MODULES (authoritative)
    const byId = new Map(ALL_MODULES.map(m => [m.id, { ...m, label: m.label }]))
    const absentDeLaLangue = (m: CatMod) => !byId.has(m.id) && MODULES_SELON_LE_PAYS.has(m.id)
    masques.current = base.flatMap(c =>
      c.modules.flatMap((m, i): ModuleMasque[] => (absentDeLaLangue(m) ? [{ catId: c.id, apres: c.modules[i - 1]?.id ?? null, module: m }] : [])),
    )
    const synced = base.map(c => ({
      ...c,
      modules: c.modules
        .filter(m => !absentDeLaLangue(m))
        .map(m => {
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
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remettreLesMasques(next, masques.current)))
      } catch (e) {
        console.warn('[storage] modules categories', e)
      }
    }
  }, [])

  return { categories, setCategories, ready }
}
