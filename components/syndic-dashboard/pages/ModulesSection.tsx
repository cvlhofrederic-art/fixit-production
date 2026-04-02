'use client'

import React from 'react'
import { ROLE_PAGES, SYNDIC_MODULES } from '@/components/syndic-dashboard/config'

interface NavItem {
  id: string
  emoji: string
  label: string
  badge?: number
  category: string
}

interface SidebarCategory {
  key: string
  label: string
}

interface ModulesSectionProps {
  locale: string
  t: (key: string, fallback?: string) => string
  userRole: string
  isModuleEnabled: (key: string) => boolean
  toggleModule: (key: string) => void
  saveNavOrder: (newOrder: string[]) => void
  moveNavItemUp: (id: string, visibleIds: string[]) => void
  moveNavItemDown: (id: string, visibleIds: string[]) => void
  allNavItems: NavItem[]
  navItems: NavItem[]
  sidebarCategories: SidebarCategory[]
}

export default function ModulesSection({
  locale,
  t,
  userRole,
  isModuleEnabled,
  toggleModule,
  saveNavOrder,
  moveNavItemUp,
  moveNavItemDown,
  allNavItems,
  navItems,
  sidebarCategories,
}: ModulesSectionProps) {
  // Modules autorisés pour ce rôle uniquement — filtré par locale
  const roleAllowedKeys = (ROLE_PAGES[userRole] || ROLE_PAGES['syndic']) as readonly string[]
  const roleModules = SYNDIC_MODULES.filter(m => {
    if (!roleAllowedKeys.includes(m.key)) return false
    if ('locale' in m && m.locale && m.locale !== locale) return false
    return true
  })

  // Groupes avec filtrage par rôle — adapté FR/PT
  const GROUPS = locale === 'pt' ? [
    {
      title: '📋 Gestão Corrente',
      keys: ['missions', 'canal', 'planning', 'facturation', 'emails', 'ia'],
    },
    {
      title: '🔧 Terreno & Intervenções',
      keys: ['pointage', 'docs_interventions', 'comptabilite_tech', 'analyse_devis', 'carnet_entretien', 'sinistres'],
    },
    {
      title: '🏛️ Condomínio & AG',
      keys: ['compta_copro', 'ag_digitale', 'impayés', 'extranet', 'recouvrement'],
    },
    {
      title: '🇵🇹 Obrigações Legais PT',
      keys: ['declaracao_encargos', 'seguro_condominio', 'fundo_reserva', 'obrigacoes_legais', 'certificacao_energetica'],
    },
    {
      title: '🏠 Gestão Condóminos',
      keys: ['portal_condomino', 'quadro_avisos', 'enquetes', 'reserva_espacos', 'ocorrencias', 'whatsapp_condominos'],
    },
    {
      title: '🔧 Ferramentas PT',
      keys: ['relatorio_gestao', 'preparador_assembleia', 'plano_manutencao', 'vistoria_tecnica', 'votacao_online', 'atas_ia', 'pagamentos_digitais', 'mapa_quotas', 'orcamentos_obras', 'cobranca_judicial', 'carregamento_ve', 'monitorizacao_consumos', 'arquivo_digital'],
    },
  ] : [
    {
      title: '📋 Gestion courante',
      keys: ['missions', 'canal', 'planning', 'facturation', 'emails', 'ia'],
    },
    {
      title: '🔧 Terrain & Interventions',
      keys: ['pointage', 'docs_interventions', 'comptabilite_tech', 'analyse_devis', 'carnet_entretien', 'sinistres'],
    },
    {
      title: '🏛️ Copropriété & AG',
      keys: ['compta_copro', 'ag_digitale', 'impayés', 'extranet', 'recouvrement', 'preparateur_ag'],
    },
    {
      title: '⚖️ Réglementaire',
      keys: ['reglementaire', 'rapport', 'echéances', 'pppt', 'dpe_collectif', 'visite_technique'],
    },
    {
      title: '🏠 Gestion Copropriétaires',
      keys: ['extranet_enrichi', 'panneau_affichage', 'sondages_fr', 'reservation_espaces_fr', 'signalements_fr', 'communication_demat'],
    },
    {
      title: '🔧 Outils FR',
      keys: ['vote_correspondance', 'pv_assemblee_ia', 'saisie_ia_factures', 'appels_fonds', 'mise_en_concurrence', 'recouvrement_enrichi_fr', 'irve_bornes', 'suivi_energetique_fr', 'ged_certifiee'],
    },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">🧩 {t('syndicDash.modulesPage.title')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('syndicDash.modulesPage.subtitle')}</p>
        </div>
        <div className="bg-[#F7F4EE] text-[#0D1B2E] px-4 py-2 rounded-full text-sm font-bold">
          {roleModules.filter(m => isModuleEnabled(m.key)).length}/{roleModules.length} {t('syndicDash.modulesPage.active')}
        </div>
      </div>

      <div className="space-y-6">
        {GROUPS.map(group => {
          const groupMods = roleModules.filter(m => group.keys.includes(m.key))
          if (groupMods.length === 0) return null
          return (
            <div key={group.title}>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">{group.title}</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {groupMods.map(mod => {
                  const enabled = isModuleEnabled(mod.key)
                  return (
                    <div key={mod.key} className={`bg-white rounded-2xl p-4 border-2 transition-all ${enabled ? 'border-[#C9A84C] shadow-sm' : 'border-gray-200 opacity-70'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${enabled ? 'bg-[#F7F4EE]' : 'bg-gray-100'}`}>{mod.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-gray-900">{t(`syndicDash.modules.${mod.key}.label`, mod.label)}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{t(`syndicDash.modules.${mod.key}.desc`, mod.description)}</div>
                        </div>
                        <button onClick={() => toggleModule(mod.key)} className={`w-12 h-7 rounded-full transition-all relative flex-shrink-0 ${enabled ? 'bg-[#0D1B2E]' : 'bg-gray-200'}`}>
                          <div className="w-5 h-5 bg-white rounded-full shadow absolute top-1 transition-all" style={{ left: enabled ? '24px' : '4px' }} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Ordre du menu — groupé par catégorie ── */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">↕️ {t('syndicDash.modulesConfig.menuOrder')}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{t('syndicDash.modulesConfig.dragHint')}</p>
          </div>
          <button
            onClick={() => saveNavOrder(allNavItems.map(n => n.id as string))}
            className="text-xs text-gray-500 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
          >
            ↺ {t('syndicDash.modulesConfig.reset')}
          </button>
        </div>
        {sidebarCategories.map(cat => {
          const catItems = navItems.filter(item => item.category === cat.key && item.id !== 'modules')
          if (catItems.length === 0) return null
          const catIds = catItems.map(n => n.id as string)
          return (
            <div key={cat.key} className="mb-5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 px-1">{cat.label}</div>
              <div className="flex flex-col gap-2">
                {catItems.map((item, idx) => {
                  const isMod = SYNDIC_MODULES.some(m => m.key === item.id)
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 bg-white border-2 rounded-xl px-4 py-3 transition-all group ${isMod ? 'border-[#E4DDD0] hover:border-[#C9A84C]' : 'border-gray-200 hover:border-gray-400'}`}
                    >
                      <span className="text-gray-300 group-hover:text-gray-500 select-none text-lg leading-none font-mono">⠿</span>
                      <span className="text-xl w-6 text-center">{item.emoji}</span>
                      <span className="flex-1 font-semibold text-sm text-gray-800">{item.label}</span>
                      {!isMod && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">{locale === 'pt' ? 'fixo' : 'fixe'}</span>
                      )}
                      <span className="text-xs text-gray-500 font-mono w-5 text-center">{idx + 1}</span>
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveNavItemUp(item.id as string, catIds)}
                          disabled={idx === 0}
                          className="w-6 h-5 flex items-center justify-center rounded text-gray-500 hover:text-[#C9A84C] hover:bg-[#F7F4EE] disabled:opacity-20 disabled:cursor-not-allowed transition text-xs font-bold"
                        >▲</button>
                        <button
                          onClick={() => moveNavItemDown(item.id as string, catIds)}
                          disabled={idx === catItems.length - 1}
                          className="w-6 h-5 flex items-center justify-center rounded text-gray-500 hover:text-[#C9A84C] hover:bg-[#F7F4EE] disabled:opacity-20 disabled:cursor-not-allowed transition text-xs font-bold"
                        >▼</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div>
            <div className="font-semibold text-blue-800 text-sm">{locale === 'pt' ? 'Dica' : 'Astuce'}</div>
            <div className="text-xs text-blue-600 mt-0.5">{locale === 'pt' ? 'Os módulos desativados desaparecem da barra lateral mas permanecem acessíveis a qualquer momento. Os seus dados nunca são eliminados.' : 'Les modules désactivés disparaissent de la barre latérale mais restent accessibles à tout moment. Vos données ne sont jamais supprimées.'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
