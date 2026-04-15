'use client'

import { useRef, useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import type { ModuleDef, ModuleConfig } from '@/hooks/useModulesConfig'
import type { ModCategory, CatMod } from '@/hooks/useModuleCategories'
import { buildDefaultCategories } from '@/hooks/useModuleCategories'

interface ModulesSectionProps {
  orgRole?: string
  ALL_MODULES: ModuleDef[]
  modulesConfig: ModuleConfig[]
  saveModulesConfig: (config: ModuleConfig[]) => void
  reorderModuleTo: (moduleId: string, newPos: number) => void
  // Shared categories state (from useModuleCategories hook in the dashboard)
  categories?: ModCategory[]
  setCategories?: (next: ModCategory[]) => void
  // Unused props kept for interface compat
  moveModule?: unknown
  categoriesOrder?: unknown
  saveCategoriesOrder?: unknown
  moveCategory?: unknown
  reorderCategoryTo?: unknown
  CATEGORIES_DEFAULT?: unknown
}

export default function ModulesSection({
  orgRole,
  ALL_MODULES,
  saveModulesConfig,
  categories: extCategories,
  setCategories: extSetCategories,
}: ModulesSectionProps) {
  const { t: _t } = useTranslation()
  const locale = useLocale()
  const isPt = locale === 'pt'
  void _t
  void orgRole
  const primary = '#FFC107'

  // Local fallback state when the parent didn't wire up the hook
  const [localCats, setLocalCats] = useState<ModCategory[]>(() => buildDefaultCategories(ALL_MODULES))
  const categories = extCategories ?? localCats
  const applyCats = extSetCategories ?? setLocalCats

  // Drag state
  const dragType = useRef<'cat' | 'mod' | null>(null)
  const dragCatId = useRef<string | null>(null)
  const dragModId = useRef<string | null>(null)
  const [dragHoverCat, setDragHoverCat] = useState<string | null>(null)
  const [dragHoverRow, setDragHoverRow] = useState<{ catId: string; modId: string; pos: 'above' | 'below' } | null>(null)
  const [draggingRow, setDraggingRow] = useState<string | null>(null)

  // ── Commit: persist categories (via hook/setter) + mirror to modulesConfig
  const commit = (next: ModCategory[]) => {
    applyCats(next)
    const flat: ModuleConfig[] = []
    let order = 0
    next.forEach(cat => {
      cat.modules.forEach(m => {
        const def = ALL_MODULES.find(x => x.id === m.id)
        const enabled = def?.locked ? true : m.on
        flat.push({ id: m.id, enabled, order: order++ })
      })
    })
    ALL_MODULES.forEach(def => {
      if (!flat.find(f => f.id === def.id)) flat.push({ id: def.id, enabled: true, order: order++ })
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
    commit([...categories, { id, name: isPt ? 'Nova categoria' : 'Nouvelle catégorie', open: true, modules: [] }])
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

  // Move a mod to an arbitrary position (1-based) within its category
  const moveModToPos = (catId: string, modId: string, newPos: number) => {
    const cat = categories.find(c => c.id === catId)
    if (!cat) return
    const currentIdx = cat.modules.findIndex(m => m.id === modId)
    if (currentIdx < 0) return
    const targetIdx = Math.max(0, Math.min(newPos - 1, cat.modules.length - 1))
    if (targetIdx === currentIdx) return
    const mods = [...cat.modules]
    const [mod] = mods.splice(currentIdx, 1)
    mods.splice(targetIdx, 0, mod)
    commit(categories.map(c => c.id === catId ? { ...c, modules: mods } : c))
  }

  const resetAll = () => {
    commit(buildDefaultCategories(ALL_MODULES))
  }

  // ── Drag & drop ───────────────────────────────────────────────
  const onCatDragStart = (e: React.DragEvent, catId: string) => {
    dragType.current = 'cat'
    dragCatId.current = catId
    e.dataTransfer.effectAllowed = 'move'
  }
  const clearDrag = () => {
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
    if (dragType.current === 'cat' && dragCatId.current !== catId) setDragHoverCat(catId)
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
      if (!from || from === targetCatId) return clearDrag()
      const fromIdx = categories.findIndex(c => c.id === from)
      const toIdx = categories.findIndex(c => c.id === targetCatId)
      if (fromIdx < 0 || toIdx < 0) return clearDrag()
      const next = [...categories]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      commit(next)
      clearDrag()
    } else if (dragType.current === 'mod') {
      const srcCatId = dragCatId.current
      const modId = dragModId.current
      if (!srcCatId || !modId) return clearDrag()
      const next = categories.map(c => ({ ...c, modules: [...c.modules] }))
      const srcCat = next.find(c => c.id === srcCatId)
      const dstCat = next.find(c => c.id === targetCatId)
      if (!srcCat || !dstCat) return clearDrag()
      const modIdx = srcCat.modules.findIndex(m => m.id === modId)
      if (modIdx === -1) return clearDrag()
      const [mod] = srcCat.modules.splice(modIdx, 1)
      let insertIdx = dstCat.modules.length
      if (dragHoverRow && dragHoverRow.catId === targetCatId) {
        const rowIdx = dstCat.modules.findIndex(m => m.id === dragHoverRow.modId)
        if (rowIdx >= 0) insertIdx = dragHoverRow.pos === 'above' ? rowIdx : rowIdx + 1
      }
      dstCat.modules.splice(insertIdx, 0, mod)
      commit(next)
      clearDrag()
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

  return (
    <div className="v5-fade">
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
        .mc-pos { width: 22px; text-align: center; padding: 1px 0; border: 1px solid #E8E8E8; border-radius: 3px; font-size: 10px; font-weight: 400; font-family: inherit; color: #AAA; outline: none; flex-shrink: 0; }
        .mc-pos:focus { border-color: ${primary}; box-shadow: 0 0 0 2px #FFF8E1; }
        .mc-tgl { position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0; }
        .mc-tgl input { opacity: 0; width: 0; height: 0; position: absolute; }
        .mc-tgl .sl { position: absolute; inset: 0; background: #E0E0E0; border-radius: 10px; cursor: pointer; transition: .3s; }
        .mc-tgl .sl::before { content: ''; position: absolute; width: 16px; height: 16px; background: #fff; border-radius: 50%; left: 2px; bottom: 2px; transition: .3s; }
        .mc-tgl input:checked + .sl { background: ${primary}; }
        .mc-tgl input:checked + .sl::before { left: 18px; }
      `}</style>

      <div className="v5-pg-t">
        <div style={{ flex: 1 }}>
          <h1>Modules</h1>
          <p>Activez, désactivez et réorganisez vos modules par catégorie — la sidebar se met à jour en temps réel</p>
        </div>
      </div>

      <div>
        <div className="v5-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: 8 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700 }}>📦 ORGANISATION DU MENU</span>
              <br />
              <span style={{ fontSize: 11, color: '#999' }}>
                Glissez-déposez, tapez un numéro pour réordonner, ou utilisez les flèches
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addCategory} className="v5-btn v5-btn-sm v5-btn-p">+ Catégorie</button>
              <button onClick={resetAll} className="v5-btn v5-btn-sm">↻ Réinitialiser</button>
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
                    onDragEnd={clearDrag}
                  >
                    <span className="mc-cat-drag">⠿</span>
                    <input
                      className="mc-cat-name"
                      defaultValue={cat.name}
                      key={`${cat.id}-${cat.name}`}
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
                      {cat.modules.map((mod: CatMod, i: number) => {
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
                            onDragEnd={clearDrag}
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
                            <input
                              type="number"
                              className="mc-pos"
                              defaultValue={i + 1}
                              key={`pos-${mod.id}-${i}-${cat.modules.length}`}
                              min={1}
                              max={cat.modules.length}
                              title="Tapez un numéro et validez pour déplacer"
                              onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                              onBlur={(e) => {
                                const val = parseInt(e.target.value, 10)
                                if (!isNaN(val) && val !== i + 1) moveModToPos(cat.id, mod.id, val)
                              }}
                              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                              onMouseDown={(e) => e.stopPropagation()}
                              onDragStart={(e) => { e.preventDefault(); e.stopPropagation() }}
                            />
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
