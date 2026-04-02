'use client'

import React from 'react'
import { formatDate } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Annonce {
  id: string
  titre: string
  contenu: string
  date: string
  auteur: string
  importance: 'info' | 'important' | 'urgent'
  lu: boolean
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  t: Record<string, string>
  annonces: Annonce[]
  markAnnonceRead: (id: string) => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CoproAnnoncesSection({ t, annonces, markAnnonceRead }: Props) {
  return (
    <div className="space-y-4">
      {annonces.sort((a, b) => b.date.localeCompare(a.date)).map(a => (
        <div
          key={a.id}
          onClick={() => markAnnonceRead(a.id)}
          className={`bg-white rounded-xl border shadow-sm p-5 cursor-pointer transition ${
            !a.lu ? 'border-[#C9A84C] bg-[rgba(201,168,76,0.08)]' : 'border-[#E4DDD0] hover:bg-[#F7F4EE]'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-1 rounded ${
                a.importance === 'urgent' ? 'bg-red-100 text-red-700' :
                a.importance === 'important' ? 'bg-orange-100 text-orange-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {a.importance === 'urgent' ? t.urgentLabel : a.importance === 'important' ? t.importantLabel : t.infoLabel}
              </span>
              {!a.lu && <span className="w-2 h-2 bg-[#0D1B2E] rounded-full" />}
            </div>
            <span className="text-xs text-[#8A9BB0]">{formatDate(a.date)}</span>
          </div>
          <h3 className={`text-sm mb-2 ${!a.lu ? 'font-bold text-[#0D1B2E]' : 'font-medium text-[#0D1B2E]'}`}>{a.titre}</h3>
          <p className="text-sm text-[#4A5E78] leading-relaxed">{a.contenu}</p>
          <p className="text-xs text-[#8A9BB0] mt-3">Par {a.auteur}</p>
        </div>
      ))}
    </div>
  )
}
