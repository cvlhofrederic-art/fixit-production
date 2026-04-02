'use client'

import React from 'react'

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  t: Record<string, string>
  coproModules: readonly { key: string; label: string; icon: string; description: string }[]
  isModuleEnabled: (key: string) => boolean
  toggleModule: (key: string) => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CoproModulesSection({ t, coproModules, isModuleEnabled, toggleModule }: Props) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#0D1B2E]">{t.mesModules}</h2>
          <p className="text-sm text-[#8A9BB0] mt-1">{t.mesModulesDesc}</p>
        </div>
        <div className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full text-sm font-bold">
          {coproModules.filter(m => isModuleEnabled(m.key)).length}/{coproModules.length} {t.actifs}
        </div>
      </div>

      <div className="grid gap-3">
        {coproModules.map(mod => {
          const enabled = isModuleEnabled(mod.key)
          return (
            <div key={mod.key} className={`bg-white rounded-2xl p-4 border-2 transition-all ${enabled ? 'border-amber-300 shadow-sm' : 'border-[#E4DDD0] opacity-75'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${enabled ? 'bg-amber-100' : 'bg-[#F7F4EE]'}`}>
                  {mod.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#0D1B2E]">{mod.label}</div>
                  <div className="text-sm text-[#8A9BB0] mt-0.5">{mod.description}</div>
                </div>
                <button
                  onClick={() => toggleModule(mod.key)}
                  className={`w-14 h-8 rounded-full transition-all relative flex-shrink-0 ${enabled ? 'bg-[#0D1B2E]' : 'bg-[#E4DDD0]'}`}
                >
                  <div className="w-6 h-6 bg-white rounded-full shadow absolute top-1 transition-all" style={{ left: enabled ? '28px' : '4px' }} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div>
            <div className="font-semibold text-blue-800 text-sm">{t.astuce}</div>
            <div className="text-xs text-blue-600 mt-0.5">{t.astuceTexte}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
