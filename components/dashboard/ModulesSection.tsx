'use client'

import { useTranslation } from '@/lib/i18n/context'
import { useThemeVars } from './useThemeVars'
import type { ModuleDef, ModuleConfig, CategoryDef } from '@/hooks/useModulesConfig'

interface ModulesSectionProps {
  orgRole?: string
  ALL_MODULES: ModuleDef[]
  modulesConfig: ModuleConfig[]
  saveModulesConfig: (config: ModuleConfig[]) => void
  moveModule: (moduleId: string, direction: 'up' | 'down') => void
  categoriesOrder: CategoryDef[]
  saveCategoriesOrder: (cats: CategoryDef[]) => void
  moveCategory: (catId: string, direction: 'up' | 'down') => void
  reorderModuleTo: (moduleId: string, newPos: number) => void
  reorderCategoryTo: (catId: string, newPos: number) => void
  CATEGORIES_DEFAULT: CategoryDef[]
}

export default function ModulesSection({
  orgRole,
  ALL_MODULES,
  modulesConfig,
  saveModulesConfig,
  moveModule,
  categoriesOrder,
  saveCategoriesOrder,
  moveCategory,
  reorderModuleTo,
  reorderCategoryTo,
  CATEGORIES_DEFAULT,
}: ModulesSectionProps) {
  const { t } = useTranslation()
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)

  const isModuleEnabled = (moduleId: string): boolean => {
    if (modulesConfig.length === 0) return true
    const m = modulesConfig.find(x => x.id === moduleId)
    return m ? m.enabled : true
  }

  const toggleModule = (moduleId: string) => {
    const updated = modulesConfig.map(c => c.id === moduleId ? { ...c, enabled: !c.enabled } : c)
    saveModulesConfig(updated)
  }

  const resetAll = () => {
    saveModulesConfig(ALL_MODULES.map((m, i) => ({ id: m.id, enabled: true, order: i })))
    saveCategoriesOrder(CATEGORIES_DEFAULT)
  }

  const sortedCategories = [...categoriesOrder].sort((a, b) => a.order - b.order)
  const enabledCount = ALL_MODULES.filter(m => !m.locked && isModuleEnabled(m.id)).length
  const totalCount = ALL_MODULES.filter(m => !m.locked).length

  // Shared input style (v6 .mod-pos)
  const posInputStyle = {
    width: 40, textAlign: 'center' as const, padding: '4px 2px',
    border: `1px solid ${tv.border}`, borderRadius: 4,
    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
    color: tv.textMuted, background: tv.bg,
  }

  return (
    <div className={isV5 ? 'v5-fade' : 'animate-fadeIn'}>
      {/* Page header */}
      <div className={isV5 ? 'v5-pg-t' : 'v22-page-header'}>
        <div style={{ flex: 1 }}>
          {isV5 ? (
            <>
              <h1>Modules</h1>
              <p>Activez, désactivez et réorganisez vos modules</p>
            </>
          ) : (
            <>
              <div className="v22-page-title">Modules</div>
              <div className="v22-page-sub">Activez, désactivez et réorganisez vos modules</div>
            </>
          )}
        </div>
      </div>

      {/* Main card */}
      <div style={{ padding: '0 16px 16px' }}>
        <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ padding: '1.25rem' }}>
          {/* Card header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, color: tv.text }}>📦 ORDRE DU MENU</span>
              <br />
              <span style={{ fontSize: 11, color: tv.textMuted }}>
                Utilisez les flèches ou modifiez le numéro pour réorganiser — {enabledCount}/{totalCount} actifs
              </span>
            </div>
            <button
              onClick={resetAll}
              className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'}
            >
              ↻ Réinitialiser
            </button>
          </div>

          {/* Module list by category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sortedCategories.map((cat, catIdx) => {
              const catModules = ALL_MODULES.filter(m => m.category === cat.id)
              if (catModules.length === 0) return null

              // Sort modules within category by their config order
              const sortedMods = catModules
                .map(m => ({ def: m, conf: modulesConfig.find(c => c.id === m.id) }))
                .sort((a, b) => (a.conf?.order ?? 999) - (b.conf?.order ?? 999))

              return (
                <div key={cat.id}>
                  {/* ── Category row ── */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', marginTop: catIdx > 0 ? 8 : 0, marginBottom: 4,
                    background: tv.primaryLight, borderRadius: 6,
                    border: `1px solid ${tv.primaryBorder}`,
                  }}>
                    <span style={{ color: tv.textMuted, userSelect: 'none', fontSize: 14, lineHeight: 1, fontFamily: 'monospace', cursor: 'grab' }}>⠿</span>
                    <span style={{ fontSize: 15, width: 22, textAlign: 'center' }}>{cat.icon}</span>
                    <span style={{ flex: 1, fontWeight: 700, fontSize: 12, color: tv.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{cat.label}</span>
                    <span style={{ fontSize: 10, color: tv.textMuted, fontWeight: 600 }}>
                      {catModules.filter(m => !m.locked && isModuleEnabled(m.id)).length}/{catModules.filter(m => !m.locked).length}
                    </span>
                    {/* Position input */}
                    <input
                      type="number"
                      defaultValue={catIdx + 1}
                      key={`cat-${cat.id}-${catIdx}`}
                      min={1}
                      max={sortedCategories.length}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value)
                        if (!isNaN(val) && val !== catIdx + 1) reorderCategoryTo(cat.id, val)
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      style={posInputStyle}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      <button
                        onClick={() => moveCategory(cat.id, 'up')}
                        disabled={catIdx === 0}
                        style={{
                          background: 'none', border: 'none', cursor: catIdx === 0 ? 'default' : 'pointer',
                          fontSize: 11, color: catIdx === 0 ? tv.border : tv.textMuted, fontWeight: 700,
                          padding: '0 4px', lineHeight: 1, opacity: catIdx === 0 ? 0.3 : 1,
                        }}
                      >▲</button>
                      <button
                        onClick={() => moveCategory(cat.id, 'down')}
                        disabled={catIdx === sortedCategories.length - 1}
                        style={{
                          background: 'none', border: 'none', cursor: catIdx === sortedCategories.length - 1 ? 'default' : 'pointer',
                          fontSize: 11, color: catIdx === sortedCategories.length - 1 ? tv.border : tv.textMuted, fontWeight: 700,
                          padding: '0 4px', lineHeight: 1, opacity: catIdx === sortedCategories.length - 1 ? 0.3 : 1,
                        }}
                      >▼</button>
                    </div>
                  </div>

                  {/* ── Module rows ── */}
                  {sortedMods.map(({ def: mod }, modIdx) => {
                    const enabled = isModuleEnabled(mod.id)
                    const sameCatNonLocked = sortedMods.filter(s => !s.def.locked)
                    const modCatIdx = sameCatNonLocked.findIndex(s => s.def.id === mod.id)
                    return (
                      <div key={mod.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', marginLeft: 16,
                        border: `1px solid ${tv.border}`, borderRadius: 6,
                        marginBottom: 4, background: enabled ? '#fff' : tv.bg,
                        opacity: enabled ? 1 : 0.6,
                        transition: 'all .15s',
                      }}>
                        <span style={{ color: '#CCC', cursor: 'grab', fontSize: 14, userSelect: 'none' }}>⠿</span>
                        <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{mod.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: tv.text }}>{mod.label}</span>
                          <div style={{ fontSize: 10, color: tv.textMuted, marginTop: 1 }}>{mod.description}</div>
                        </div>
                        {/* Position input */}
                        {!mod.locked ? (
                          <input
                            type="number"
                            defaultValue={modIdx + 1}
                            key={`mod-${mod.id}-${modIdx}`}
                            min={1}
                            max={sortedMods.length}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value)
                              if (!isNaN(val) && val !== modIdx + 1) reorderModuleTo(mod.id, val)
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                            style={posInputStyle}
                          />
                        ) : (
                          <span style={{ ...posInputStyle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            {modIdx + 1}
                          </span>
                        )}
                        {/* Arrows */}
                        {!mod.locked && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            <button
                              onClick={() => moveModule(mod.id, 'up')}
                              disabled={modCatIdx === 0}
                              style={{
                                background: 'none', border: 'none', cursor: modCatIdx === 0 ? 'default' : 'pointer',
                                fontSize: 11, color: modCatIdx === 0 ? tv.border : tv.textMuted, fontWeight: 700,
                                padding: '0 4px', lineHeight: 1, opacity: modCatIdx === 0 ? 0.3 : 1,
                              }}
                            >▲</button>
                            <button
                              onClick={() => moveModule(mod.id, 'down')}
                              disabled={modCatIdx === sameCatNonLocked.length - 1}
                              style={{
                                background: 'none', border: 'none', cursor: modCatIdx === sameCatNonLocked.length - 1 ? 'default' : 'pointer',
                                fontSize: 11, color: modCatIdx === sameCatNonLocked.length - 1 ? tv.border : tv.textMuted, fontWeight: 700,
                                padding: '0 4px', lineHeight: 1, opacity: modCatIdx === sameCatNonLocked.length - 1 ? 0.3 : 1,
                              }}
                            >▼</button>
                          </div>
                        )}
                        {/* Toggle */}
                        {mod.locked ? (
                          <span style={{ fontSize: 10, color: tv.textMuted, fontWeight: 600, whiteSpace: 'nowrap' }}>🔒 requis</span>
                        ) : (
                          <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, flexShrink: 0 }}>
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={() => toggleModule(mod.id)}
                              style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                            />
                            <span style={{
                              position: 'absolute', cursor: 'pointer', inset: 0, borderRadius: 12,
                              background: enabled ? tv.primary : tv.borderDark, transition: 'background .2s',
                            }}>
                              <span style={{
                                position: 'absolute', width: 20, height: 20, background: '#fff', borderRadius: '50%',
                                boxShadow: '0 1px 2px rgba(0,0,0,.15)', top: 2,
                                left: enabled ? 22 : 2, transition: 'left .2s',
                              }} />
                            </span>
                          </label>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Tip */}
          <div style={{
            marginTop: 16, padding: '10px 14px', borderRadius: 6,
            background: tv.primaryLight, border: `1px solid ${tv.primaryBorder}`,
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <span style={{ fontSize: 16 }}>💡</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 12, color: tv.primary }}>Astuce</div>
              <div style={{ fontSize: 11, color: tv.textMuted, marginTop: 2 }}>
                Les catégories déplacent tous leurs modules en bloc.
                Désactivez un module pour le masquer de la sidebar sans le supprimer.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
