'use client'

import { useTranslation } from '@/lib/i18n/context'
import { useThemeVars } from './useThemeVars'
import type { ModuleDef, ModuleConfig } from '@/hooks/useModulesConfig'

interface ModulesSectionProps {
  orgRole?: string
  ALL_MODULES: ModuleDef[]
  modulesConfig: ModuleConfig[]
  saveModulesConfig: (config: ModuleConfig[]) => void
  reorderModuleTo: (moduleId: string, newPos: number) => void
  // Keep interface compat — unused props from parent
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
  modulesConfig,
  saveModulesConfig,
  reorderModuleTo,
}: ModulesSectionProps) {
  const { t } = useTranslation()
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)

  const isEnabled = (id: string): boolean => {
    if (modulesConfig.length === 0) return true
    const m = modulesConfig.find(x => x.id === id)
    return m ? m.enabled : true
  }

  const toggleModule = (id: string) => {
    const updated = modulesConfig.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c)
    saveModulesConfig(updated)
  }

  const resetAll = () => {
    saveModulesConfig(ALL_MODULES.map((m, i) => ({ id: m.id, enabled: true, order: i })))
  }

  // Flat sorted list — exactly like v6 HTML
  const sorted = ALL_MODULES
    .map(m => ({ def: m, conf: modulesConfig.find(c => c.id === m.id) }))
    .sort((a, b) => (a.conf?.order ?? 999) - (b.conf?.order ?? 999))

  return (
    <div className={isV5 ? 'v5-fade' : 'animate-fadeIn'}>
      {/* Page header — exact v6: <div class="pg-t"><h1>Modules</h1><p>...</p></div> */}
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

      {/* Main card — v6: <div class="card"> */}
      <div style={{ padding: '0 16px 16px' }}>
        <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ padding: '1.25rem' }}>
          {/* Header row — v6 exact */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700 }}>📦 ORDRE DU MENU</span>
              <br />
              <span style={{ fontSize: 11, color: '#999' }}>
                Utilisez les flèches ou modifiez le numéro pour réorganiser — la sidebar se met à jour en temps réel
              </span>
            </div>
            <button
              onClick={resetAll}
              className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'}
            >
              ↻ Réinitialiser
            </button>
          </div>

          {/* Module list — v6: flat .mod-row list */}
          <div>
            {sorted.map(({ def: mod }, i) => {
              const enabled = isEnabled(mod.id)
              return (
                <div key={mod.id} style={{
                  display: 'flex', alignItems: mod.description ? 'flex-start' : 'center', gap: 10,
                  padding: mod.description ? '12px 14px' : '10px 12px',
                  border: '1px solid #E8E8E8', borderRadius: 6,
                  marginBottom: 6, background: '#fff',
                  transition: 'all .15s',
                }}>
                  {/* v6: .mod-drag */}
                  <span style={{ color: '#CCC', cursor: 'grab', fontSize: 14, userSelect: 'none', marginTop: mod.description ? 2 : 0 }}>⠿</span>
                  {/* v6: .mod-icon */}
                  <span style={{ fontSize: 16, width: 24, textAlign: 'center', marginTop: mod.description ? 1 : 0 }}>{mod.icon}</span>
                  {/* v6: .mod-name + description */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{mod.label}</span>
                    {mod.description && (
                      <div style={{ fontSize: 10, color: '#999', marginTop: 1 }}>{mod.description}</div>
                    )}
                  </div>
                  {/* v6: .mod-pos input */}
                  <input
                    type="number"
                    defaultValue={i + 1}
                    key={`mod-${mod.id}-${i}`}
                    min={1}
                    max={sorted.length}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value)
                      if (!isNaN(val) && val !== i + 1) reorderModuleTo(mod.id, val)
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    style={{
                      width: 40, textAlign: 'center', padding: '4px',
                      border: '1px solid #E0E0E0', borderRadius: 4,
                      fontSize: 12, fontWeight: 600, fontFamily: 'inherit', color: '#555',
                      marginTop: mod.description ? 2 : 0,
                    }}
                  />
                  {/* v6: .tgl toggle — 36×20 like HTML */}
                  <label style={{ position: 'relative', display: 'inline-block', width: 36, height: 20, flexShrink: 0, marginTop: mod.description ? 2 : 0 }}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleModule(mod.id)}
                      style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                    />
                    <span style={{
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                      background: enabled ? (tv.primary || '#FFC107') : '#E0E0E0',
                      borderRadius: 10, cursor: 'pointer', transition: '.3s',
                    }}>
                      <span style={{
                        position: 'absolute', width: 16, height: 16, background: '#fff', borderRadius: '50%',
                        left: enabled ? 18 : 2, bottom: 2, transition: '.3s',
                      }} />
                    </span>
                  </label>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
