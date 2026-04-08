'use client'

import { useTranslation } from '@/lib/i18n/context'
import { useThemeVars } from './useThemeVars'

interface ModulesSectionProps {
  orgRole?: string
  ALL_MODULES: { id: string; label: string; icon: string; description: string; category: string; locked?: boolean }[]
  modulesConfig: { id: string; enabled: boolean; order: number }[]
  saveModulesConfig: (config: { id: string; enabled: boolean; order: number }[]) => void
  moveModule: (moduleId: string, direction: 'up' | 'down') => void
}

export default function ModulesSection({
  orgRole,
  ALL_MODULES,
  modulesConfig,
  saveModulesConfig,
  moveModule,
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

  return (
    <div className={isV5 ? 'v5-fade' : 'animate-fadeIn'}>
      {/* Page header */}
      <div className={isV5 ? 'v5-pg-t' : 'v22-page-header'}>
        <div style={{ flex: 1 }}>
          {isV5 ? (
            <>
              <h1>🧩 {t('proDash.settings.modulesTitle')}</h1>
              <p>{t('proDash.settings.modulesSubtitle')}</p>
            </>
          ) : (
            <>
              <div className="v22-page-title">🧩 {t('proDash.settings.modulesTitle')}</div>
              <div className="v22-page-sub">{t('proDash.settings.modulesSubtitle')}</div>
            </>
          )}
        </div>
      </div>

      {/* Modules content */}
      <div style={{ padding: 16 }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: tv.text }}>🧩 {t('proDash.settings.mesModules')}</div>
              <div style={{ fontSize: 12, color: tv.textMuted, marginTop: 2 }}>{t('proDash.settings.modulesDesc')}</div>
            </div>
            <span className={isV5 ? 'v5-badge v5-badge-yellow' : 'v22-tag v22-tag-yellow'}>
              {ALL_MODULES.filter(m => !m.locked && isModuleEnabled(m.id)).length}/{ALL_MODULES.filter(m => !m.locked).length} {t('proDash.settings.actifs')}
            </span>
          </div>

          {/* Module Cards Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { title: `📅 ${t('proDash.settings.activite')}`, keys: ['calendar', 'motifs', 'horaires'] },
              { title: `💬 ${t('proDash.settings.communicationGroup')}`, keys: ['messages', 'clients'] },
              { title: `📄 ${t('proDash.settings.facturationDocs')}`, keys: ['devis', 'factures', 'rapports', 'contrats'] },
              { title: `📊 ${t('proDash.settings.analyseFinances')}`, keys: ['stats', 'revenus', 'comptabilite', 'materiaux'] },
              { title: `🗂️ ${t('proDash.settings.profilProGroup')}`, keys: ['wallet', 'portfolio', 'parrainage'] },
            ].map(group => {
              const groupMods = ALL_MODULES.filter(m => group.keys.includes(m.id))
              if (groupMods.length === 0) return null
              return (
                <div key={group.title}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: tv.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{group.title}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {groupMods.map(mod => {
                      const enabled = isModuleEnabled(mod.id)
                      return (
                        <div key={mod.id} className={isV5 ? 'v5-card' : 'v22-card'} style={{ opacity: enabled ? 1 : 0.6, borderColor: enabled ? tv.primaryBorder : tv.border }}>
                          <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, background: enabled ? tv.primaryLight : tv.bg }}>
                              {mod.icon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: tv.text }}>{mod.label}</div>
                              <div style={{ fontSize: 11, color: tv.textMuted, marginTop: 2 }}>{mod.description}</div>
                            </div>
                            {isV5 ? (
                              <button onClick={() => toggleModule(mod.id)} className={`v5-tgl${enabled ? ' active' : ''}`} />
                            ) : (
                              <button
                                onClick={() => toggleModule(mod.id)}
                                style={{ width: 44, height: 24, borderRadius: 12, position: 'relative', transition: 'background .2s', background: enabled ? tv.primary : tv.borderDark, border: 'none', cursor: 'pointer', flexShrink: 0 }}
                              >
                                <div style={{ width: 20, height: 20, background: '#fff', borderRadius: '50%', boxShadow: '0 1px 2px rgba(0,0,0,.15)', position: 'absolute', top: 2, transition: 'left .2s', left: enabled ? 22 : 2 }} />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Menu order */}
          <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginTop: 16 }}>
            <div className={isV5 ? '' : 'v22-card-head'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className={isV5 ? 'v5-st' : 'v22-card-title'}>↕️ {t('proDash.settings.ordreMenu')}</div>
                <div style={{ fontSize: 12, color: tv.textMuted, marginTop: 2 }}>{t('proDash.settings.ordreMenuDesc')}</div>
              </div>
              <button
                onClick={() => saveModulesConfig(ALL_MODULES.map((m, i) => ({ id: m.id, enabled: true, order: i })))}
                className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'}
              >
                ↺ {t('proDash.settings.reinitialiser')}
              </button>
            </div>
            <div className={isV5 ? '' : 'v22-card-body'} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(() => {
                const enabledMods = modulesConfig
                  .filter(c => c.enabled)
                  .sort((a, b) => a.order - b.order)
                return enabledMods.map((conf, idx) => {
                  const mod = ALL_MODULES.find(m => m.id === conf.id)
                  if (!mod) return null
                  return (
                    <div key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: `1px solid ${tv.primaryBorder}`, borderRadius: 6, background: tv.surface, transition: 'border-color .15s' }}>
                      <span style={{ color: tv.textMuted, userSelect: 'none', fontSize: 16, lineHeight: 1, fontFamily: 'monospace' }}>⠿</span>
                      <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{mod.icon}</span>
                      <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: tv.text }}>{mod.label}</span>
                      <span className={isV5 ? 'v5-badge' : 'v22-ref'} style={{ width: 20, textAlign: 'center' }}>{idx + 1}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <button
                          onClick={() => moveModule(mod.id, 'up')}
                          disabled={idx === 0}
                          style={{ width: 22, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3, border: 'none', background: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? tv.border : tv.textMuted, fontSize: 11, fontWeight: 700, opacity: idx === 0 ? 0.3 : 1 }}
                        >▲</button>
                        <button
                          onClick={() => moveModule(mod.id, 'down')}
                          disabled={idx === enabledMods.length - 1}
                          style={{ width: 22, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3, border: 'none', background: 'none', cursor: idx === enabledMods.length - 1 ? 'not-allowed' : 'pointer', color: idx === enabledMods.length - 1 ? tv.border : tv.textMuted, fontSize: 11, fontWeight: 700, opacity: idx === enabledMods.length - 1 ? 0.3 : 1 }}
                        >▼</button>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>

          {/* Tip box */}
          <div className={isV5 ? 'v5-badge v5-badge-amber' : 'v22-alert v22-alert-amber'} style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 18 }}>💡</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: tv.primary }}>{t('proDash.settings.astuce')}</div>
                <div style={{ fontSize: 11, color: tv.textMuted, marginTop: 2 }}>{t('proDash.settings.astuceTexte')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
