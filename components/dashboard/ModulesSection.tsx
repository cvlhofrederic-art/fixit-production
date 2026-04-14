'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { useThemeVars } from './useThemeVars'
import type { ModuleDef, ModuleConfig } from '@/hooks/useModulesConfig'

interface ModulesSectionProps {
  orgRole?: string
  ALL_MODULES: ModuleDef[]
  modulesConfig: ModuleConfig[]
  saveModulesConfig: (config: ModuleConfig[]) => void
  reorderModuleTo: (moduleId: string, newPos: number) => void
  // Unused props from parent — kept for interface compat
  moveModule?: unknown
  categoriesOrder?: unknown
  saveCategoriesOrder?: unknown
  moveCategory?: unknown
  reorderCategoryTo?: unknown
  CATEGORIES_DEFAULT?: unknown
}

type CatMod = { id: string; icon: string; name: string; on: boolean }
type Cat = { id: string; name: string; open: boolean; modules: CatMod[] }

// Default categories — aligned with V5Sidebar (pro_societe BTP) structure
const DEFAULT_STRUCTURE: Array<{ id: string; name: string; open: boolean; modIds: string[] }> = [
  { id: 'cat-pilotage', name: 'Pilotage', open: true, modIds: ['home', 'gestion_comptes', 'stats', 'revenus', 'motifs'] },
  { id: 'cat-chantiers', name: 'Chantiers', open: true, modIds: ['chantiers', 'gantt', 'equipes', 'pointage', 'calendar', 'meteo', 'photos_chantier', 'rapports'] },
  { id: 'cat-commercial', name: 'Commercial', open: true, modIds: ['pipeline', 'devis', 'dpgf', 'marches'] },
  { id: 'cat-facturation', name: 'Facturation', open: true, modIds: ['factures', 'situations', 'garanties'] },
  { id: 'cat-achats', name: 'Sous-traitance & Achats', open: true, modIds: ['sous_traitance', 'sous_traitance_offres', 'rfq_btp', 'marketplace_btp'] },
  { id: 'cat-finances', name: 'Finances', open: true, modIds: ['compta_btp', 'rentabilite', 'comptabilite'] },
  { id: 'cat-communication', name: 'Communication', open: true, modIds: ['messages', 'clients', 'portail_client'] },
  { id: 'cat-admin', name: 'Administration', open: true, modIds: ['wallet', 'contrats', 'horaires'] },
  { id: 'cat-vitrine', name: 'Vitrine', open: true, modIds: ['portfolio', 'parrainage'] },
]

const STORAGE_KEY = 'fixit_modules_categories_v2'

function buildDefaults(ALL_MODULES: ModuleDef[], modulesConfig: ModuleConfig[]): Cat[] {
  const byId = new Map(ALL_MODULES.map(m => [m.id, m]))
  const enabledOf = (id: string) => {
    const c = modulesConfig.find(x => x.id === id)
    return c ? c.enabled : true
  }
  return DEFAULT_STRUCTURE.map(cat => ({
    id: cat.id,
    name: cat.name,
    open: cat.open,
    modules: cat.modIds
      .map(id => {
        const def = byId.get(id)
        if (!def) return null
        return { id, icon: def.icon, name: def.label, on: enabledOf(id) } as CatMod
      })
      .filter((m): m is CatMod => m !== null),
  }))
}

export default function ModulesSection({
  orgRole,
  ALL_MODULES,
  modulesConfig,
  saveModulesConfig,
}: ModulesSectionProps) {
  const { t: _t } = useTranslation()
  void _t
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)

  const [categories, setCategories] = useState<Cat[]>(() => buildDefaults(ALL_MODULES, modulesConfig))
  const [hydrated, setHydrated] = useState(false)

  // Drag state
  const dragType = useRef<'cat' | 'mod' | null>(null)
  const dragCatId = useRef<string | null>(null)
  const dragModId = useRef<string | null>(null)
  const [dragHoverCat, setDragHoverCat] = useState<string | null>(null)
  const [dragHoverRow, setDragHoverRow] = useState<{ catId: string; modId: string; pos: 'above' | 'below' } | null>(null)
  const [draggingRow, setDraggingRow] = useState<string | null>(null)

  // Load persisted state
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Cat[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Re-sync 'on' state from modulesConfig to stay authoritative
          const synced = parsed.map(c => ({
            ...c,
            modules: c.modules.map(m => {
              const conf = modulesConfig.find(x => x.id === m.id)
              return conf ? { ...m, on: conf.enabled } : m
            }),
          }))
          setCategories(synced)
        }
      }
    } catch {}
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist + sync to modulesConfig
  const commit = (next: Cat[]) => {
    setCategories(next)
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
    }
    // Rebuild modulesConfig from flat order so sidebar gating + ordering stay in sync
    const flat: ModuleConfig[] = []
    let order = 0
    next.forEach(cat => {
      cat.modules.forEach(m => {
        const def = ALL_MODULES.find(x => x.id === m.id)
        const enabled = def?.locked ? true : m.on
        flat.push({ id: m.id, enabled, order: order++ })
      })
    })
    // Keep modules absent from any category (e.g. locked settings) in config
    ALL_MODULES.forEach(def => {
      if (!flat.find(f => f.id === def.id)) {
        flat.push({ id: def.id, enabled: true, order: order++ })
      }
    })
    saveModulesConfig(flat)
  }

  // ── Actions ───────────────────────────────────────────────────
  const renameCat = (catId: string, name: string) => {
    const trimmed = name.trim()
    commit(categories.map(c => c.id === catId ? { ...c, name: trimmed || c.name } : c))
  }

  const toggleCatOpen = (catId: string) => {
    commit(categories.map(c => c.id === catId ? { ...c, open: !c.open } : c))
  }

  const deleteCategory = (catId: string) => {
    const cat = categories.find(c => c.id === catId)
    if (!cat) return
    const remaining = categories.filter(c => c.id !== catId)
    if (cat.modules.length > 0 && remaining.length > 0) {
      remaining[0] = { ...remaining[0], modules: [...remaining[0].modules, ...cat.modules] }
    }
    commit(remaining)
  }

  const addCategory = () => {
    const id = 'cat-' + Date.now()
    commit([...categories, { id, name: 'Nouvelle catégorie', open: true, modules: [] }])
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('.mc-cat-name')
      const last = inputs[inputs.length - 1]
      if (last) { last.select(); last.focus() }
    }, 50)
  }

  const toggleMod = (catId: string, modId: string, val: boolean) => {
    commit(categories.map(c => c.id === catId ? {
      ...c,
      modules: c.modules.map(m => m.id === modId ? { ...m, on: val } : m),
    } : c))
  }

  const moveModUp = (catId: string, modId: string) => {
    commit(categories.map(c => {
      if (c.id !== catId) return c
      const idx = c.modules.findIndex(m => m.id === modId)
      if (idx <= 0) return c
      const mods = [...c.modules]
      ;[mods[idx - 1], mods[idx]] = [mods[idx], mods[idx - 1]]
      return { ...c, modules: mods }
    }))
  }

  const moveModDown = (catId: string, modId: string) => {
    commit(categories.map(c => {
      if (c.id !== catId) return c
      const idx = c.modules.findIndex(m => m.id === modId)
      if (idx === -1 || idx >= c.modules.length - 1) return c
      const mods = [...c.modules]
      ;[mods[idx], mods[idx + 1]] = [mods[idx + 1], mods[idx]]
      return { ...c, modules: mods }
    }))
  }

  const resetAll = () => {
    commit(buildDefaults(ALL_MODULES, modulesConfig.map(c => ({ ...c, enabled: true }))))
  }

  // ── Drag & drop ───────────────────────────────────────────────
  const onCatDragStart = (e: React.DragEvent, catId: string) => {
    dragType.current = 'cat'
    dragCatId.current = catId
    e.dataTransfer.effectAllowed = 'move'
  }
  const onCatDragEnd = () => {
    dragType.current = null
    dragCatId.current = null
    dragModId.current = null
    setDragHoverCat(null)
    setDragHoverRow(null)
    setDraggingRow(null)
  }
  const onModDragStart = (e: React.DragEvent, catId: string, modId: string) => {
    dragType.current = 'mod'
    dragCatId.current = catId
    dragModId.current = modId
    setDraggingRow(modId)
    e.dataTransfer.effectAllowed = 'move'
    e.stopPropagation()
  }
  const onBlockDragOver = (e: React.DragEvent, catId: string) => {
    e.preventDefault()
    if (dragType.current === 'cat' && dragCatId.current !== catId) {
      setDragHoverCat(catId)
    }
  }
  const onBlockDragLeave = (e: React.DragEvent, catId: string) => {
    const related = e.relatedTarget as Node | null
    if (!related || !(e.currentTarget as HTMLElement).contains(related)) {
      if (dragHoverCat === catId) setDragHoverCat(null)
    }
  }
  const onBlockDrop = (e: React.DragEvent, targetCatId: string) => {
    e.preventDefault()
    if (dragType.current === 'cat') {
      const from = dragCatId.current
      if (!from || from === targetCatId) return onCatDragEnd()
      const fromIdx = categories.findIndex(c => c.id === from)
      const toIdx = categories.findIndex(c => c.id === targetCatId)
      if (fromIdx < 0 || toIdx < 0) return onCatDragEnd()
      const next = [...categories]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      commit(next)
      onCatDragEnd()
    } else if (dragType.current === 'mod') {
      const srcCatId = dragCatId.current
      const modId = dragModId.current
      if (!srcCatId || !modId) return onCatDragEnd()
      const next = categories.map(c => ({ ...c, modules: [...c.modules] }))
      const srcCat = next.find(c => c.id === srcCatId)
      const dstCat = next.find(c => c.id === targetCatId)
      if (!srcCat || !dstCat) return onCatDragEnd()
      const modIdx = srcCat.modules.findIndex(m => m.id === modId)
      if (modIdx === -1) return onCatDragEnd()
      const [mod] = srcCat.modules.splice(modIdx, 1)
      // Determine insertion index from hovered row
      let insertIdx = dstCat.modules.length
      if (dragHoverRow && dragHoverRow.catId === targetCatId) {
        const rowIdx = dstCat.modules.findIndex(m => m.id === dragHoverRow.modId)
        if (rowIdx >= 0) {
          insertIdx = dragHoverRow.pos === 'above' ? rowIdx : rowIdx + 1
        }
      }
      dstCat.modules.splice(insertIdx, 0, mod)
      commit(next)
      onCatDragEnd()
    }
  }
  const onRowDragOver = (e: React.DragEvent, catId: string, modId: string) => {
    if (dragType.current !== 'mod') return
    e.preventDefault()
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const pos: 'above' | 'below' = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below'
    setDragHoverRow({ catId, modId, pos })
  }

  // ── Render ────────────────────────────────────────────────────
  void tv
  const primary = '#FFC107'

  return (
    <div className={isV5 ? 'v5-fade' : 'animate-fadeIn'}>
      <style>{`
        .mc-cat { border: 1px solid #E8E8E8; border-radius: 8px; background: #fff; margin-bottom: .75rem; overflow: hidden; transition: box-shadow .2s; }
        .mc-cat.drag-over { box-shadow: 0 0 0 2px ${primary}; border-color: ${primary}; }
        .mc-cat-hdr { display: flex; align-items: center; gap: 8px; padding: .6rem .75rem; background: #FAFAFA; border-bottom: 1px solid #E8E8E8; cursor: grab; user-select: none; }
        .mc-cat-hdr:active { cursor: grabbing; }
        .mc-cat-drag { color: #CCC; font-size: 15px; flex-shrink: 0; }
        .mc-cat-name { flex: 1; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: #555; border: none; background: transparent; font-family: inherit; outline: none; min-width: 60px; padding: 2px 4px; border-radius: 3px; }
        .mc-cat-name:focus { background: #FFF8E1; color: #333; box-shadow: 0 0 0 2px ${primary}; }
        .mc-cat-count { font-size: 10px; color: #BBB; font-weight: 400; }
        .mc-cat-actions { display: flex; align-items: center; gap: 4px; margin-left: auto; }
        .mc-cat-toggle, .mc-cat-del { font-size: 11px; cursor: pointer; padding: 2px 6px; border-radius: 3px; border: none; background: none; transition: all .15s; }
        .mc-cat-toggle { color: #BBB; }
        .mc-cat-toggle:hover { background: #F0F0F0; color: #555; }
        .mc-cat-del { color: #DDD; }
        .mc-cat-del:hover { color: #E53935; background: #FFEBEE; }
        .mc-mod-list { padding: .4rem .5rem; min-height: 44px; transition: background .15s; }
        .mc-mod-list.drop-target { background: #FFF8E1; }
        .mc-mod-empty { text-align: center; color: #BBB; font-size: 11px; padding: 10px; font-style: italic; }
        .mc-row { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 5px; border: 1px solid transparent; background: #fff; margin-bottom: 3px; cursor: grab; user-select: none; transition: all .15s; }
        .mc-row:hover { border-color: #E8E8E8; box-shadow: 0 1px 4px rgba(0,0,0,.05); }
        .mc-row.dragging { opacity: .4; border-style: dashed; }
        .mc-row.drag-above { border-top: 2px solid ${primary}; }
        .mc-row.drag-below { border-bottom: 2px solid ${primary}; }
        .mc-drag { color: #CCC; font-size: 13px; flex-shrink: 0; }
        .mc-icon { font-size: 15px; width: 22px; text-align: center; flex-shrink: 0; }
        .mc-label { flex: 1; font-size: 13px; font-weight: 600; color: #1a1a1a; }
        .mc-off .mc-label { color: #BBB; text-decoration: line-through; }
        .mc-arrows { display: flex; flex-direction: row; gap: 2px; flex-shrink: 0; }
        .mc-arrow { background: none; border: 1px solid #E8E8E8; border-radius: 3px; cursor: pointer; font-size: 10px; color: #999; padding: 2px 5px; transition: all .1s; }
        .mc-arrow:hover:not(:disabled) { color: #FFA000; border-color: ${primary}; background: #FFF8E1; }
        .mc-arrow:disabled { opacity: .25; cursor: default; }
        .mc-tgl { position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0; }
        .mc-tgl input { opacity: 0; width: 0; height: 0; position: absolute; }
        .mc-tgl .sl { position: absolute; inset: 0; background: #E0E0E0; border-radius: 10px; cursor: pointer; transition: .3s; }
        .mc-tgl .sl::before { content: ''; position: absolute; width: 16px; height: 16px; background: #fff; border-radius: 50%; left: 2px; bottom: 2px; transition: .3s; }
        .mc-tgl input:checked + .sl { background: ${primary}; }
        .mc-tgl input:checked + .sl::before { left: 18px; }
      `}</style>

      <div className={isV5 ? 'v5-pg-t' : 'v22-page-header'}>
        <div style={{ flex: 1 }}>
          {isV5 ? (
            <>
              <h1>Modules</h1>
              <p>Activez, désactivez et réorganisez vos modules par catégorie</p>
            </>
          ) : (
            <>
              <div className="v22-page-title">Modules</div>
              <div className="v22-page-sub">Activez, désactivez et réorganisez vos modules par catégorie</div>
            </>
          )}
        </div>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: 8 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700 }}>📦 ORGANISATION DU MENU</span>
              <br />
              <span style={{ fontSize: 11, color: '#999' }}>
                Glissez-déposez pour réorganiser — renommez, supprimez ou créez de nouvelles catégories
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addCategory} className={isV5 ? 'v5-btn v5-btn-sm v5-btn-p' : 'v22-btn v22-btn-sm v22-btn-p'}>+ Catégorie</button>
              <button onClick={resetAll} className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'}>↻ Réinitialiser</button>
            </div>
          </div>

          <div id="catList">
            {categories.map(cat => {
              const activeCount = cat.modules.filter(m => m.on).length
              const totalCount = cat.modules.length
              const listClass = `mc-mod-list${dragType.current === 'mod' && dragHoverCat === cat.id ? ' drop-target' : ''}`
              return (
                <div
                  key={cat.id}
                  className={`mc-cat${dragHoverCat === cat.id && dragType.current === 'cat' ? ' drag-over' : ''}`}
                  onDragOver={(e) => onBlockDragOver(e, cat.id)}
                  onDragLeave={(e) => onBlockDragLeave(e, cat.id)}
                  onDrop={(e) => onBlockDrop(e, cat.id)}
                >
                  <div
                    className="mc-cat-hdr"
                    draggable
                    onDragStart={(e) => onCatDragStart(e, cat.id)}
                    onDragEnd={onCatDragEnd}
                  >
                    <span className="mc-cat-drag">⠿</span>
                    <input
                      className="mc-cat-name"
                      defaultValue={cat.name}
                      key={`${cat.id}-${hydrated}-${cat.name}`}
                      title="Cliquez pour renommer"
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => renameCat(cat.id, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onDragStart={(e) => { e.preventDefault(); e.stopPropagation() }}
                    />
                    <span className="mc-cat-count">({activeCount}/{totalCount} actifs)</span>
                    <div className="mc-cat-actions">
                      <button className="mc-cat-toggle" onClick={() => toggleCatOpen(cat.id)} title={cat.open ? 'Réduire' : 'Développer'}>
                        {cat.open ? '▲' : '▼'}
                      </button>
                      <button className="mc-cat-del" onClick={() => deleteCategory(cat.id)} title="Supprimer la catégorie">✕</button>
                    </div>
                  </div>
                  {cat.open && (
                    <div className={listClass} data-cat-id={cat.id}>
                      {cat.modules.length === 0 && (
                        <div className="mc-mod-empty">Aucun module — glissez-en un ici</div>
                      )}
                      {cat.modules.map((mod, i) => {
                        const isFirst = i === 0
                        const isLast = i === cat.modules.length - 1
                        const hoverCls = dragHoverRow && dragHoverRow.catId === cat.id && dragHoverRow.modId === mod.id
                          ? ` drag-${dragHoverRow.pos}` : ''
                        const draggingCls = draggingRow === mod.id ? ' dragging' : ''
                        return (
                          <div
                            key={mod.id}
                            className={`mc-row${mod.on ? '' : ' mc-off'}${hoverCls}${draggingCls}`}
                            draggable
                            onDragStart={(e) => onModDragStart(e, cat.id, mod.id)}
                            onDragEnd={onCatDragEnd}
                            onDragOver={(e) => onRowDragOver(e, cat.id, mod.id)}
                          >
                            <span className="mc-drag">⠿</span>
                            <span className="mc-icon">{mod.icon}</span>
                            <span className="mc-label">{mod.name}</span>
                            <div className="mc-arrows">
                              <button
                                className="mc-arrow"
                                disabled={isFirst}
                                onClick={() => moveModUp(cat.id, mod.id)}
                                title="Monter"
                              >▲</button>
                              <button
                                className="mc-arrow"
                                disabled={isLast}
                                onClick={() => moveModDown(cat.id, mod.id)}
                                title="Descendre"
                              >▼</button>
                            </div>
                            <label className="mc-tgl" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={mod.on}
                                onChange={(e) => toggleMod(cat.id, mod.id, e.target.checked)}
                              />
                              <span className="sl" />
                            </label>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
