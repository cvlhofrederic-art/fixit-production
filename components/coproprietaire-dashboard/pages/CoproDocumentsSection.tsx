'use client'

import React, { useState } from 'react'
import { formatDate } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DocumentCopro {
  id: string
  nom: string
  type: 'pv_ag' | 'compte_annuel' | 'budget' | 'contrat' | 'reglement' | 'appel_charges' | 'autre'
  dateUpload: string
  taille: string
  annee: number
  public: boolean
  consulte: boolean
  dateConsultation?: string
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  t: Record<string, string>
  locale: string
  documents: DocumentCopro[]
  docTypeLabels: Record<string, { label: string; emoji: string }>
  markDocConsulte: (id: string) => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CoproDocumentsSection({ t, locale, documents, docTypeLabels, markDocConsulte }: Props) {
  const [docFilterType, setDocFilterType] = useState<string>('tous')
  const [docFilterAnnee, setDocFilterAnnee] = useState<string>('toutes')
  const [docSearch, setDocSearch] = useState('')

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <select
            value={docFilterType}
            onChange={e => setDocFilterType(e.target.value)}
            className="px-3 py-2 border-2 border-[#E4DDD0] rounded-lg text-sm focus:border-[#C9A84C] focus:outline-none bg-white"
          >
            <option value="tous">{t.tousLesTypes}</option>
            {Object.entries(docTypeLabels).map(([k, v]) => (
              <option key={k} value={k}>{v.emoji} {v.label}</option>
            ))}
          </select>
          <select
            value={docFilterAnnee}
            onChange={e => setDocFilterAnnee(e.target.value)}
            className="px-3 py-2 border-2 border-[#E4DDD0] rounded-lg text-sm focus:border-[#C9A84C] focus:outline-none bg-white"
          >
            <option value="toutes">{t.toutesLesAnnees}</option>
            {[...new Set(documents.map(d => d.annee))].sort((a, b) => b - a).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder={t.rechercherDoc}
            value={docSearch}
            onChange={e => setDocSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 border-2 border-[#E4DDD0] rounded-lg text-sm focus:border-[#C9A84C] focus:outline-none"
          />
        </div>
      </div>

      {/* Grille documents */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents
          .filter(d => docFilterType === 'tous' || d.type === docFilterType)
          .filter(d => docFilterAnnee === 'toutes' || d.annee === Number(docFilterAnnee))
          .filter(d => !docSearch || d.nom.toLowerCase().includes(docSearch.toLowerCase()))
          .sort((a, b) => b.dateUpload.localeCompare(a.dateUpload))
          .map(doc => (
            <div key={doc.id} className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm hover:shadow-md transition">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{docTypeLabels[doc.type]?.emoji || '📄'}</span>
                  {!doc.consulte && <span className="text-xs bg-[rgba(201,168,76,0.15)] text-[#A8842A] px-1.5 py-0.5 rounded font-bold">{t.nouveau}</span>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${doc.public ? 'bg-green-100 text-green-700' : 'bg-[#F7F4EE] text-[#4A5E78]'}`}>
                  {doc.public ? t.publique : t.personnel}
                </span>
              </div>
              <h3 className="text-sm font-bold text-[#0D1B2E] mb-1">{doc.nom}</h3>
              <p className="text-xs text-[#8A9BB0] mb-1">{docTypeLabels[doc.type]?.label} · {doc.annee}</p>
              <p className="text-xs text-[#8A9BB0] mb-3">{doc.taille} · {t.ajouteLe} {formatDate(doc.dateUpload)}</p>
              {doc.consulte && doc.dateConsultation && (
                <p className="text-xs text-green-600 mb-3">{t.consulteLe} {formatDate(doc.dateConsultation)}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    markDocConsulte(doc.id)
                    alert(locale === 'pt' ? `A descarregar "${doc.nom}"...` : `Téléchargement de "${doc.nom}" en cours...`)
                  }}
                  className="flex-1 flex items-center justify-center gap-1 bg-[#0D1B2E] hover:bg-[#152338] text-white text-xs font-medium py-2 rounded-lg transition"
                >
                  {t.telecharger}
                </button>
                {!doc.consulte && (
                  <button
                    onClick={() => markDocConsulte(doc.id)}
                    className="flex items-center justify-center gap-1 bg-[#F7F4EE] hover:bg-[#F7F4EE] text-[#4A5E78] text-xs font-medium py-2 px-3 rounded-lg transition"
                  >
                    {t.marquerLu}
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>

      {/* Derniers consultes */}
      {documents.filter(d => d.consulte).length > 0 && (
        <div className="bg-white rounded-xl border border-[#E4DDD0] shadow-sm">
          <div className="px-5 py-4 border-b border-[#E4DDD0]">
            <h2 className="font-bold text-[#0D1B2E]">{t.derniersConsultes}</h2>
          </div>
          <div className="divide-y divide-[#E4DDD0]">
            {documents.filter(d => d.consulte && d.dateConsultation).sort((a, b) => (b.dateConsultation || '').localeCompare(a.dateConsultation || '')).slice(0, 5).map(doc => (
              <div key={doc.id} className="px-5 py-3 flex items-center gap-3">
                <span>{docTypeLabels[doc.type]?.emoji || '📄'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0D1B2E] truncate">{doc.nom}</p>
                  <p className="text-xs text-[#8A9BB0]">Consulté le {formatDate(doc.dateConsultation!)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
