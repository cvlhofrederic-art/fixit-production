'use client'

import React from 'react'
import type { Alerte } from '@/components/syndic-dashboard/types'

interface AlertesSectionProps {
  alertes: Alerte[]
  locale: string
  t: (key: string, fallback?: string) => string
  onTraiterAlerte: (id: string) => void
}

export default function AlertesSection({ alertes, locale, t, onTraiterAlerte }: AlertesSectionProps) {
  return (
    <div className="space-y-3">
      {alertes.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <div className="text-5xl mb-3">✅</div>
          <p className="font-semibold text-gray-600">{t('syndicDash.alertes.allProcessed')}</p>
        </div>
      )}
      {alertes.map(a => (
        <div key={a.id} className={`bg-white rounded-2xl shadow-sm p-5 border-l-4 ${
          a.urgence === 'haute' ? 'border-l-red-500' :
          a.urgence === 'moyenne' ? 'border-l-amber-500' : 'border-l-gray-300'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">
                {a.type === 'rc_pro' ? '📄' : a.type === 'controle' ? '⚙️' : a.type === 'budget' ? '💶' : '📁'}
              </span>
              <div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  a.urgence === 'haute' ? 'bg-red-100 text-red-700' :
                  a.urgence === 'moyenne' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {a.urgence === 'haute' ? (locale === 'pt' ? '🔴 Urgente' : '🔴 Urgente') : a.urgence === 'moyenne' ? (locale === 'pt' ? '🟡 Média' : '🟡 Moyenne') : (locale === 'pt' ? '🟢 Baixa' : '🟢 Basse')}
                </span>
                <p className="text-gray-900 font-medium mt-2">{a.message}</p>
                <p className="text-xs text-gray-500 mt-1">{a.date}</p>
              </div>
            </div>
            <button onClick={() => onTraiterAlerte(a.id)} className="text-xs bg-[#F7F4EE] text-[#C9A84C] px-3 py-1.5 rounded-lg hover:bg-[#EDE8DF] transition font-medium ml-4 flex-shrink-0">
              ✓ {locale === 'pt' ? 'Tratar' : 'Traiter'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
