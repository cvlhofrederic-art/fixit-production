'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'

// ─── Composant ────────────────────────────────────────────────────────────────

export default function RelatorioGestaoSection({ user, userRole }: { user: { id: string }; userRole: string }) {
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() === 0 ? 11 : now.getMonth() - 1)
  const [selectedYear, setSelectedYear] = useState(now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear())
  const [generating, setGenerating] = useState(false)
  const rapportRef = useRef<HTMLDivElement>(null)

  // Dados manuais do formulário
  const [nbEdificios, setNbEdificios] = useState(0)
  const [nbIntervencoes, setNbIntervencoes] = useState(0)
  const [montanteObras, setMontanteObras] = useState(0)
  const [orcamentoAnual, setOrcamentoAnual] = useState(0)
  const [despesasAno, setDespesasAno] = useState(0)
  const [observacoes, setObservacoes] = useState('')

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const monthLabel = `${monthNames[selectedMonth]} ${selectedYear}`

  const pctOrcamento = orcamentoAnual > 0 ? Math.round((despesasAno / orcamentoAnual) * 100) : 0

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
      pdf.save(`relatorio-gestao-${monthLabel.replace(' ', '-').toLowerCase()}.pdf`)
    } catch { toast.error('Erro ao gerar o PDF') }
    setGenerating(false)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Controles */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Mês</label>
          <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm bg-white focus:border-[#C9A84C] focus:outline-none">
            {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Ano</label>
          <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm bg-white focus:border-[#C9A84C] focus:outline-none">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="ml-auto">
          <button onClick={generatePDF} disabled={generating} className="flex items-center gap-2 bg-[#0D1B2E] hover:bg-[#152338] text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60">
            {generating ? '⏳ A gerar...' : '📄 Descarregar PDF'}
          </button>
        </div>
      </div>

      {/* Alerta legal */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <span className="text-xl">📄</span>
        <div>
          <p className="font-semibold text-blue-800 text-sm">Relatório de Gestão — Art.º 1436.º do Código Civil</p>
          <p className="text-blue-700 text-sm mt-0.5">
            O administrador do condomínio é obrigado a prestar contas à assembleia de condóminos (Lei 8/2022).
            Este relatório facilita a prestação de contas mensal e anual.
          </p>
        </div>
      </div>

      {/* Formulário de dados */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-gray-800 mb-4">📊 Dados do período — {monthLabel}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Edifícios geridos</label>
            <input type="number" min={0} value={nbEdificios} onChange={e => setNbEdificios(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[#C9A84C] focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Intervenções do mês</label>
            <input type="number" min={0} value={nbIntervencoes} onChange={e => setNbIntervencoes(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[#C9A84C] focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Montante obras (€)</label>
            <input type="number" min={0} value={montanteObras} onChange={e => setMontanteObras(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[#C9A84C] focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Orçamento anual (€)</label>
            <input type="number" min={0} value={orcamentoAnual} onChange={e => setOrcamentoAnual(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[#C9A84C] focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Despesas do ano (€)</label>
            <input type="number" min={0} value={despesasAno} onChange={e => setDespesasAno(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[#C9A84C] focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Orçamento consumido</label>
            <div className={`px-3 py-2 rounded-lg text-sm font-bold ${pctOrcamento > 85 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {orcamentoAnual > 0 ? `${pctOrcamento}%` : '—'}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Observações</label>
          <textarea rows={3} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Notas adicionais, alertas regulamentares, decisões pendentes..." className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[#C9A84C] focus:outline-none resize-none" />
        </div>
      </div>

      {/* Pré-visualização */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <p className="text-xs text-gray-500 mb-4 text-center">Pré-visualização do relatório</p>

        {/* Template oculto para PDF */}
        <div ref={rapportRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '794px', backgroundColor: '#fff', fontFamily: 'Arial, sans-serif' }}>
          <div style={{ background: 'linear-gradient(135deg, #0D1B2E, #152338)', padding: '32px 40px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '4px' }}>⚡ Vitfix Pro</div>
                <div style={{ fontSize: '14px', opacity: 0.85 }}>Relatório Mensal de Gestão</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{monthLabel}</div>
                <div style={{ fontSize: '12px', opacity: 0.75 }}>Gerado a {new Date().toLocaleDateString('pt-PT')}</div>
              </div>
            </div>
          </div>
          <div style={{ padding: '32px 40px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '32px' }}>
              {[
                { label: 'Edifícios geridos', value: nbEdificios, color: '#0D1B2E' },
                { label: 'Intervenções do mês', value: nbIntervencoes, color: '#2563eb' },
                { label: 'Montante obras', value: `${montanteObras.toLocaleString('pt-PT')} €`, color: '#16a34a' },
                { label: 'Orçamento consumido', value: orcamentoAnual > 0 ? `${pctOrcamento}%` : '—', color: pctOrcamento > 85 ? '#dc2626' : '#16a34a' },
              ].map(s => (
                <div key={s.label} style={{ border: '2px solid #e5e7eb', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{s.label}</div>
                </div>
              ))}
            </div>
            {observacoes && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #e5e7eb' }}>
                  💬 Observações
                </div>
                <p style={{ fontSize: '13px', color: '#374151', whiteSpace: 'pre-wrap' }}>{observacoes}</p>
              </div>
            )}
            <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af' }}>
              <span>⚡ Vitfix Pro — Gestão de condomínios</span>
              <span>Gerado automaticamente — {new Date().toLocaleString('pt-PT')}</span>
            </div>
          </div>
        </div>

        {/* Pré-visualização visível */}
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-[#0D1B2E] to-[#152338] rounded-2xl p-6 text-white">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xl font-bold">⚡ Vitfix Pro</div>
                <div className="text-[#C9A84C] text-sm">Relatório Mensal de Gestão</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{monthLabel}</div>
                <div className="text-[#C9A84C] text-xs">Gerado a {new Date().toLocaleDateString('pt-PT')}</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Edifícios', value: nbEdificios, color: 'bg-[#F7F4EE] border-[#E4DDD0]' },
              { label: 'Intervenções', value: nbIntervencoes, color: 'bg-blue-50 border-blue-200' },
              { label: 'Montante obras', value: `${montanteObras.toLocaleString('pt-PT')} €`, color: 'bg-green-50 border-green-200' },
              { label: 'Orçamento consumido', value: orcamentoAnual > 0 ? `${pctOrcamento}%` : '—', color: pctOrcamento > 85 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border-2 p-4 text-center ${s.color}`}>
                <div className="text-2xl font-bold text-[#0D1B2E]">{s.value}</div>
                <div className="text-xs text-gray-600 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
          {nbEdificios === 0 && nbIntervencoes === 0 && (
            <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
              Preencha os dados acima para gerar o relatório de gestão de {monthLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
