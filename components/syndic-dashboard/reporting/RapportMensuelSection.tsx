'use client'

import { useState, useRef } from 'react'
import type { Immeuble, Mission, Artisan, Coproprio } from '../types'
import { useTranslation, useLocale } from '@/lib/i18n/context'

export default function RapportMensuelSection({ immeubles, missions, artisans, syndicId, coproprios }: {
  immeubles: Immeuble[]
  missions: Mission[]
  artisans: Artisan[]
  syndicId: string
  coproprios: Coproprio[]
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() === 0 ? 11 : now.getMonth() - 1)
  const [selectedYear, setSelectedYear] = useState(now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear())
  const [generating, setGenerating] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([])
  const rapportRef = useRef<HTMLDivElement>(null)

  const monthNames = locale === 'pt'
    ? ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    : ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  const monthLabel = `${monthNames[selectedMonth]} ${selectedYear}`

  // Filtrer missions du mois sélectionné
  const moisMissions = missions.filter(m => {
    if (!m.dateIntervention) return false
    const d = new Date(m.dateIntervention)
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
  })

  const totalBudget = immeubles.reduce((a, i) => a + i.budgetAnnuel, 0)
  const totalDepenses = immeubles.reduce((a, i) => a + i.depensesAnnee, 0)
  const totalMontantMois = moisMissions.reduce((a, m) => a + (m.montantFacture || m.montantDevis || 0), 0)

  // Tous les emails des copropriétaires
  const allEmails = coproprios.filter(c => c.emailProprietaire).map(c => ({
    email: c.emailProprietaire,
    nom: `${c.prenomProprietaire} ${c.nomProprietaire}`,
    immeuble: c.immeuble,
  }))

  const generatePDF = async () => {
    if (!rapportRef.current) return
    setGenerating(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')
      const canvas = await html2canvas(rapportRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', windowWidth: 794 })
      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const imgHeight = (canvas.height / canvas.width) * pdfWidth
      const pageHeight = pdf.internal.pageSize.getHeight()
      let position = 0
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight)
      while (imgHeight > pageHeight + Math.abs(position)) { position -= pageHeight; pdf.addPage(); pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight) }
      pdf.save(`rapport-mensuel-${monthLabel.replace(' ', '-').toLowerCase()}.pdf`)
    } catch { alert(t('syndicDash.rapport.pdfError')) }
    setGenerating(false)
  }

  const handleSend = () => {
    if (selectedRecipients.length === 0) return
    const subject = encodeURIComponent(`Rapport mensuel de gestion — ${monthLabel}`)
    const body = encodeURIComponent(`Madame, Monsieur,\n\nVeuillez trouver ci-joint le rapport mensuel de gestion pour le mois de ${monthLabel}.\n\nCe rapport comprend :\n- Le bilan des interventions réalisées\n- L'état du budget\n- Les alertes réglementaires\n\nCordialement,\nVotre gestionnaire Vitfix Pro`)
    const to = selectedRecipients.join(',')
    window.open(`mailto:${to}?subject=${subject}&body=${body}`)
    setShowSendModal(false)
  }

  const toggleRecipient = (email: string) => setSelectedRecipients(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email])

  return (
    <div className="space-y-4">
      {/* Contrôles */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">{t('syndicDash.rapport.month')}</label>
          <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm bg-white focus:border-[#C9A84C] focus:outline-none">
            {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">{t('syndicDash.rapport.year')}</label>
          <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm bg-white focus:border-[#C9A84C] focus:outline-none">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setShowSendModal(true)} className="flex items-center gap-2 border-2 border-[#C9A84C] text-[#C9A84C] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#F7F4EE] transition">
            📨 {t('syndicDash.rapport.sendToCopros')}
          </button>
          <button onClick={generatePDF} disabled={generating} className="flex items-center gap-2 bg-[#0D1B2E] hover:bg-[#152338] text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60">
            {generating ? '⏳' : '📄'} {generating ? t('syndicDash.rapport.generating') : t('syndicDash.rapport.downloadPDF')}
          </button>
        </div>
      </div>

      {/* Aperçu rapport */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <p className="text-xs text-gray-500 mb-4 text-center">{t('syndicDash.rapport.preview')}</p>
        {/* Template caché pour jsPDF */}
        <div ref={rapportRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '794px', backgroundColor: '#fff', fontFamily: 'Arial, sans-serif' }}>
          {/* En-tête */}
          <div style={{ background: 'linear-gradient(135deg, #0D1B2E, #152338)', padding: '32px 40px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '4px' }}>⚡ Vitfix Pro</div>
                <div style={{ fontSize: '14px', opacity: 0.85 }}>{t('syndicDash.rapport.monthlyReport')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{monthLabel}</div>
                <div style={{ fontSize: '12px', opacity: 0.75 }}>{t('syndicDash.rapport.generatedOn')} {new Date().toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</div>
              </div>
            </div>
          </div>
          {/* Contenu */}
          <div style={{ padding: '32px 40px' }}>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '32px' }}>
              {[
                { label: t('syndicDash.rapport.managedBuildings'), value: immeubles.length, color: '#0D1B2E' },
                { label: t('syndicDash.rapport.monthInterventions'), value: moisMissions.length, color: '#2563eb' },
                { label: t('syndicDash.rapport.worksAmount'), value: `${totalMontantMois.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €`, color: '#16a34a' },
                { label: t('syndicDash.rapport.budgetConsumed'), value: `${Math.round((totalDepenses / totalBudget) * 100)}%`, color: totalDepenses / totalBudget > 0.85 ? '#dc2626' : '#16a34a' },
              ].map(s => (
                <div key={s.label} style={{ border: '2px solid #e5e7eb', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{s.label}</div>
                </div>
              ))}
            </div>
            {/* Interventions */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #e5e7eb' }}>
                📋 {t('syndicDash.rapport.interventions')} — {monthLabel}
              </div>
              {moisMissions.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {[t('syndicDash.rapport.building'), t('syndicDash.rapport.type'), t('syndicDash.rapport.artisan'), t('syndicDash.rapport.date'), t('syndicDash.rapport.amount'), t('syndicDash.rapport.status')].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600', color: '#374151', border: '1px solid #e5e7eb' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {moisMissions.map((m, i) => (
                      <tr key={m.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb' }}>{m.immeuble}</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb' }}>{m.type}</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb' }}>{m.artisan}</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb' }}>{m.dateIntervention ? new Date(m.dateIntervention).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR') : '—'}</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', fontWeight: '600' }}>{(m.montantFacture || m.montantDevis || 0).toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb' }}>{m.statut}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#9ca3af', fontSize: '13px', fontStyle: 'italic' }}>{t('syndicDash.rapport.noIntervention')}</p>
              )}
            </div>
            {/* Budget */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #e5e7eb' }}>
                💶 {t('syndicDash.rapport.globalBudget')} {selectedYear}
              </div>
              {immeubles.map(imm => {
                const pct = Math.round((imm.depensesAnnee / imm.budgetAnnuel) * 100)
                return (
                  <div key={imm.id} style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '600' }}>{imm.nom}</span>
                      <span>{imm.depensesAnnee.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} € / {imm.budgetAnnuel.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} € ({pct}%)</span>
                    </div>
                    <div style={{ background: '#e5e7eb', borderRadius: '9999px', height: '8px' }}>
                      <div style={{ background: pct > 85 ? '#dc2626' : '#0D1B2E', borderRadius: '9999px', height: '8px', width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Pied de page */}
            <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af' }}>
              <span>⚡ Vitfix Pro — {t('syndicDash.rapport.coproManagement')}</span>
              <span>{t('syndicDash.rapport.autoGenerated')} — {new Date().toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</span>
            </div>
          </div>
        </div>

        {/* Aperçu visible */}
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-[#0D1B2E] to-[#152338] rounded-2xl p-6 text-white">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xl font-bold">⚡ Vitfix Pro</div>
                <div className="text-[#C9A84C] text-sm">{t('syndicDash.rapport.monthlyReport')}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{monthLabel}</div>
                <div className="text-[#C9A84C] text-xs">{t('syndicDash.rapport.generatedOn')} {new Date().toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: t('syndicDash.rapport.buildings'), value: immeubles.length, color: 'bg-[#F7F4EE] border-[#E4DDD0]' },
              { label: t('syndicDash.rapport.monthInterventions'), value: moisMissions.length, color: 'bg-blue-50 border-blue-200' },
              { label: t('syndicDash.rapport.worksAmount'), value: `${totalMontantMois.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €`, color: 'bg-green-50 border-green-200' },
              { label: t('syndicDash.rapport.budgetConsumed'), value: `${Math.round((totalDepenses / totalBudget) * 100)}%`, color: totalDepenses / totalBudget > 0.85 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border-2 p-4 text-center ${s.color}`}>
                <div className="text-2xl font-bold text-[#0D1B2E]">{s.value}</div>
                <div className="text-xs text-gray-600 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
          {moisMissions.length > 0 ? (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-[#F7F4EE] px-4 py-2 font-semibold text-gray-700 text-sm">📋 {t('syndicDash.rapport.monthlyInterventions')}</div>
              <div className="divide-y divide-gray-100">
                {moisMissions.map(m => (
                  <div key={m.id} className="px-4 py-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-[#0D1B2E]">{m.immeuble} — {m.type}</p>
                      <p className="text-xs text-gray-500">{m.artisan} · {m.dateIntervention ? new Date(m.dateIntervention).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR') : '—'}</p>
                    </div>
                    <span className="font-bold text-[#0D1B2E]">{(m.montantFacture || m.montantDevis || 0).toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
              {t('syndicDash.rapport.noInterventionMonth')} {monthLabel}
            </div>
          )}
        </div>
      </div>

      {/* Modal envoi */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSendModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#0D1B2E] mb-2">📨 {t('syndicDash.rapport.sendReport')}</h3>
            <p className="text-sm text-gray-500 mb-4">{selectedRecipients.length} {t('syndicDash.rapport.recipientCount')}</p>

            <div className="flex gap-2 mb-3">
              <button onClick={() => setSelectedRecipients(allEmails.map(e => e.email))} className="text-xs bg-[#F7F4EE] text-[#C9A84C] px-3 py-1.5 rounded-lg hover:bg-[#F7F4EE] transition font-medium">✓ {t('syndicDash.rapport.selectAll')}</button>
              <button onClick={() => setSelectedRecipients([])} className="text-xs bg-[#F7F4EE] text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition font-medium">✕ {t('syndicDash.rapport.selectNone')}</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-2">
              {Object.entries(
                allEmails.reduce((acc, e) => { if (!acc[e.immeuble]) acc[e.immeuble] = []; acc[e.immeuble].push(e); return acc }, {} as Record<string, typeof allEmails>)
              ).map(([imm, residents]) => (
                <div key={imm}>
                  <div className="text-xs font-bold text-gray-500 px-2 py-1 bg-[#F7F4EE] rounded-lg mb-1">{imm}</div>
                  {residents.map(r => (
                    <label key={r.email} className="flex items-center gap-3 px-2 py-2 hover:bg-[#F7F4EE] rounded-lg cursor-pointer">
                      <input type="checkbox" checked={selectedRecipients.includes(r.email)} onChange={() => toggleRecipient(r.email)} className="accent-[#C9A84C]" />
                      <span className="text-sm text-gray-800 flex-1">{r.nom}</span>
                      <span className="text-xs text-gray-500">{r.email}</span>
                    </label>
                  ))}
                </div>
              ))}
              {allEmails.length === 0 && <p className="text-center text-gray-500 text-sm py-6">{t('syndicDash.rapport.noEmail')}</p>}
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowSendModal(false)} className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-[#F7F4EE] transition text-sm">{t('syndicDash.rapport.cancel')}</button>
              <button onClick={handleSend} disabled={selectedRecipients.length === 0} className="flex-1 bg-[#0D1B2E] hover:bg-[#152338] text-white py-2.5 rounded-lg font-bold transition disabled:opacity-60 text-sm">
                📨 {t('syndicDash.rapport.openMailClient')} ({selectedRecipients.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
