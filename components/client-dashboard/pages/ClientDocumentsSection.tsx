'use client'

import React, { useState } from 'react'
import { FileText, FileSearch, Check } from 'lucide-react'

type Booking = {
  id: string; booking_date: string; booking_time: string; status: string; address: string
  notes: string; price_ttc: number; duration_minutes: number; artisan_id?: string
  confirmed_at?: string; completed_at?: string; expires_at?: string
  services?: { name: string } | null
  profiles_artisan?: { company_name: string; rating_avg: number; rating_count?: number } | null
}

type BookingDocument = {
  id: string; type?: string; content?: string; created_at?: string; booking: Booking
  metadata?: Record<string, unknown>; totalStr?: string; prestationDate?: string
  signer_name?: string; signed_at?: string; docNumber?: string; docTitle?: string
  companyName?: string; signature_svg?: string; signature_hash?: string
  lines?: Array<{ designation: string; quantite: number; prix_unitaire: number; total: number }>
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface ClientDocumentsSectionProps {
  documents: BookingDocument[]
  documentsLoading: boolean
  bookings: Booking[]
  locale: string
  t: (key: string) => string
  fetchDocuments: () => void
  openMessages: (booking: Booking) => void
  downloadDevisPdf: (doc: BookingDocument) => void
  downloadingPdf?: boolean
  setActiveTab: (tab: string) => void
  setAnalyseFilename?: (name: string) => void
  formatDateLocal: (dateStr: string) => string
}

export default function ClientDocumentsSection(props: ClientDocumentsSectionProps) {
  const {
    documents, documentsLoading, bookings, locale, t,
    fetchDocuments, openMessages, downloadDevisPdf, downloadingPdf = false, setActiveTab, setAnalyseFilename = () => {}, formatDateLocal,
  } = props

  const [compareMode, setCompareMode] = useState(false)
  const [compareSelection, setCompareSelection] = useState<string[]>([])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-display font-black tracking-[-0.02em] text-dark flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-600" /> Devis & Factures
        </h2>
        <div className="flex items-center gap-2">
          {documents.filter(d => d.type === 'devis_sent').length >= 2 && (
            <button
              onClick={() => { setCompareMode(!compareMode); setCompareSelection([]) }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${compareMode ? 'bg-[#FFC107] text-dark' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
            >
              {compareMode ? (locale === 'pt' ? '✕ Fechar' : '✕ Fermer') : (locale === 'pt' ? '⚖️ Comparar' : '⚖️ Comparer')}
            </button>
          )}
          <button
            onClick={fetchDocuments}
            disabled={documentsLoading}
            className="text-xs text-text-muted hover:text-[#FFC107] transition"
          >
            {documentsLoading ? (locale === 'pt' ? 'A carregar...' : 'Chargement...') : (locale === 'pt' ? 'Atualizar' : 'Actualiser')}
          </button>
        </div>
      </div>

      {/* Comparateur de devis */}
      {compareMode && compareSelection.length >= 2 && (() => {
        const selected = compareSelection.map(id => documents.find(d => d.id === id)).filter(Boolean) as BookingDocument[]
        return (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#FFC107] shadow-lg p-6 mb-4">
            <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
              ⚖️ {locale === 'pt' ? 'Comparação de orçamentos' : 'Comparaison des devis'}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">{locale === 'pt' ? 'Critério' : 'Critère'}</th>
                    {selected.map(d => (
                      <th key={d.id} className="text-center py-2 px-3 font-bold text-dark min-w-[140px]">
                        {(d as any).booking?.profiles_artisan?.company_name || 'Artisan'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-50">
                    <td className="py-2.5 px-3 text-gray-500">N° devis</td>
                    {selected.map(d => <td key={d.id} className="py-2.5 px-3 text-center font-mono text-xs">{(d.metadata as any)?.docNumber || '-'}</td>)}
                  </tr>
                  <tr className="border-b border-gray-50 bg-amber-50/30">
                    <td className="py-2.5 px-3 text-gray-500 font-semibold">{locale === 'pt' ? 'Montante' : 'Montant'}</td>
                    {selected.map(d => {
                      const amounts = selected.map(s => parseFloat(String((s.metadata as any)?.totalStr || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0)
                      const thisAmount = parseFloat(String((d.metadata as any)?.totalStr || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0
                      const isLowest = thisAmount === Math.min(...amounts.filter(a => a > 0))
                      return <td key={d.id} className={`py-2.5 px-3 text-center font-bold text-lg ${isLowest ? 'text-green-600' : 'text-dark'}`}>{(d.metadata as any)?.totalStr || '-'} {isLowest && '✓'}</td>
                    })}
                  </tr>
                  <tr className="border-b border-gray-50">
                    <td className="py-2.5 px-3 text-gray-500">{locale === 'pt' ? 'Prestações' : 'Lignes'}</td>
                    {selected.map(d => <td key={d.id} className="py-2.5 px-3 text-center">{((d.metadata as any)?.lines || []).length} {locale === 'pt' ? 'itens' : 'postes'}</td>)}
                  </tr>
                  <tr className="border-b border-gray-50">
                    <td className="py-2.5 px-3 text-gray-500">{locale === 'pt' ? 'Data prestaç.' : 'Date presta.'}</td>
                    {selected.map(d => <td key={d.id} className="py-2.5 px-3 text-center text-xs">{(d.metadata as any)?.prestationDate ? new Date((d.metadata as any).prestationDate).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'short' }) : '-'}</td>)}
                  </tr>
                  <tr className="border-b border-gray-50">
                    <td className="py-2.5 px-3 text-gray-500">{locale === 'pt' ? 'Estado' : 'Statut'}</td>
                    {selected.map(d => <td key={d.id} className="py-2.5 px-3 text-center">{(d.metadata as any)?.signed ? <span className="text-green-600 font-semibold">✅ {locale === 'pt' ? 'Assinado' : 'Signé'}</span> : <span className="text-amber-600">⏳ {locale === 'pt' ? 'Pendente' : 'En attente'}</span>}</td>)}
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-gray-500">{locale === 'pt' ? 'Nota artesão' : 'Note artisan'}</td>
                    {selected.map(d => <td key={d.id} className="py-2.5 px-3 text-center">⭐ {(d as any).booking?.profiles_artisan?.rating_avg || '5.0'}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {compareMode && compareSelection.length < 2 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-700">
          {locale === 'pt' ? `Selecione ${2 - compareSelection.length} orçamento(s) para comparar` : `Sélectionnez ${2 - compareSelection.length} devis pour comparer`}
        </div>
      )}

      {documentsLoading && documents.length === 0 ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] p-5 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-xl" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
                  <div className="h-3 bg-warm-gray rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-12 text-center">
          <div className="text-5xl mb-4">📄</div>
          <h3 className="text-lg font-display font-bold text-dark mb-2">{locale === 'pt' ? 'Nenhum documento' : 'Aucun document'}</h3>
          <p className="text-text-muted mb-4">{locale === 'pt' ? 'Os orçamentos e faturas recebidos dos seus profissionais aparecerão aqui.' : 'Les devis et factures reçus de vos artisans apparaîtront ici.'}</p>
          <p className="text-sm text-gray-400">{locale === 'pt' ? 'Quando um profissional lhe envia um orçamento via mensagens, aparecerá aqui.' : 'Quand un artisan vous envoie un devis via la messagerie, il sera listé ici.'}</p>
        </div>
      ) : (
        documents.map((doc) => {
          const booking = doc.booking
          const m: any = doc.metadata || {} // eslint-disable-line @typescript-eslint/no-explicit-any
          const isSigned = m.signed === true
          const isDevisSent = doc.type === 'devis_sent'
          const isDevisSigned = doc.type === 'devis_signed'
          return (
            <div
              key={doc.id}
              className={`bg-white rounded-2xl border-[1.5px] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-5 hover:shadow-lg transition border-l-4 ${
                compareMode && compareSelection.includes(doc.id) ? 'border-[#FFC107] border-[#FFC107]' :
                isSigned || isDevisSigned ? 'border-green-400 border-[#EFEFEF]' : 'border-amber-400 border-[#EFEFEF]'
              }`}
              onClick={() => {
                if (!compareMode || !isDevisSent) return
                setCompareSelection(prev =>
                  prev.includes(doc.id) ? prev.filter(id => id !== doc.id) : prev.length < 4 ? [...prev, doc.id] : prev
                )
              }}
              style={compareMode && isDevisSent ? { cursor: 'pointer' } : undefined}
            >
              <div className="flex items-start gap-4">
                {compareMode && isDevisSent && (
                  <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-3 transition ${compareSelection.includes(doc.id) ? 'bg-[#FFC107] border-[#FFC107] text-white' : 'border-gray-300'}`}>
                    {compareSelection.includes(doc.id) && <Check className="w-4 h-4" />}
                  </div>
                )}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
                  isSigned || isDevisSigned ? 'bg-green-100' : 'bg-amber-100'
                }`}>
                  {isSigned || isDevisSigned ? '✅' : '📄'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-dark">
                      {isDevisSigned ? 'Devis signé' : 'Devis'} {m.docNumber ? `N.º${m.docNumber}` : ''}
                    </h4>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      isSigned || isDevisSigned ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {isSigned || isDevisSigned ? 'Signé' : 'En attente'}
                    </span>
                  </div>
                  <p className="text-sm text-text-muted mt-1">{booking?.profiles_artisan?.company_name || 'Artisan'} — {booking?.services?.name || 'Service'}</p>
                  {m.totalStr ? <p className="text-lg font-bold text-dark mt-2">{String(m.totalStr)}</p> : null}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>Reçu le {new Date(doc.created_at || '').toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    {m.prestationDate ? <span>Prestation : {new Date(m.prestationDate).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'short' })}</span> : null}
                  </div>
                  {isSigned && m.signer_name ? (
                    <p className="text-xs text-green-600 font-medium mt-1.5">Signé par {String(m.signer_name)}{m.signed_at ? ` le ${new Date(m.signed_at).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</p>
                  ) : null}
                  {isDevisSent && !isSigned && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => openMessages(booking)}
                        className="text-xs font-semibold px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white transition"
                      >
                        Signer ce devis
                      </button>
                      <button
                        onClick={() => {
                          setAnalyseFilename(`Devis ${booking?.profiles_artisan?.company_name || 'Artisan'}${m.docNumber ? ' N.' + m.docNumber : ''}`)
                          setActiveTab('analyse')
                        }}
                        className="text-xs font-semibold px-3 py-2 rounded-lg bg-[#FFC107] hover:bg-[#FFB300] text-dark transition flex items-center gap-1"
                      >
                        <FileSearch className="w-3 h-3" /> Analyser
                      </button>
                      <button
                        onClick={() => downloadDevisPdf(doc)}
                        disabled={downloadingPdf}
                        className="text-xs font-semibold px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <FileText className="w-3 h-3" /> {downloadingPdf ? '...' : 'PDF'}
                      </button>
                      <button
                        onClick={() => openMessages(booking)}
                        className="text-xs font-semibold px-3 py-2 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition"
                      >
                        Voir la conversation
                      </button>
                    </div>
                  )}
                  {(isSigned || isDevisSigned) && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => downloadDevisPdf(doc)}
                        disabled={downloadingPdf}
                        className="text-xs font-semibold px-3 py-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 transition flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <FileText className="w-3 h-3" /> {downloadingPdf ? '...' : 'Télécharger PDF signé'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
