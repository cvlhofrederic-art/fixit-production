'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type TabId = 'gerador' | 'historico' | 'comparacao' | 'aprovacao'

interface PosteOrcamento {
  categoria: string
  subcategoria: string
  valorAnterior1: number  // N-3
  valorAnterior2: number  // N-2
  valorAnterior3: number  // N-1
  valorPrevisto: number   // N (IA)
  valorAjustado: number   // N (utilisateur)
  tendencia: 'up' | 'down' | 'stable'
  variacao: number        // % vs N-1
  justificacao: string    // IA explanation
}

interface OrcamentoAnual {
  id: string
  immeuble: string
  immeubleNom: string
  ano: number
  postes: PosteOrcamento[]
  totalPrevisto: number
  totalAjustado: number
  estado: 'rascunho' | 'proposto' | 'aprovado_ag'
  dataCriacao: string
  geradoPorIA: boolean
  taxaInflacao: number
  notas: string
}

interface HistoricoExercicio {
  ano: number
  postes: { categoria: string; valor: number }[]
  total: number
}

// ─── Catégories budgétaires PT ───────────────────────────────────────────────

const CATEGORIAS_ORCAMENTO = [
  { categoria: 'Seguro obrigatório', subcategoria: 'Incêndio + RC', icon: '🛡️' },
  { categoria: 'Limpeza', subcategoria: 'Partes comuns', icon: '🧹' },
  { categoria: 'Eletricidade', subcategoria: 'Partes comuns (iluminação, elevador)', icon: '💡' },
  { categoria: 'Água', subcategoria: 'Consumo partes comuns', icon: '💧' },
  { categoria: 'Elevador', subcategoria: 'Manutenção + inspeção obrigatória', icon: '🛗' },
  { categoria: 'Manutenção geral', subcategoria: 'Reparações correntes', icon: '🔧' },
  { categoria: 'Jardinagem', subcategoria: 'Espaços verdes', icon: '🌿' },
  { categoria: 'Porteiro/Vigilância', subcategoria: 'Segurança', icon: '👮' },
  { categoria: 'Administração', subcategoria: 'Honorários administrador', icon: '📋' },
  { categoria: 'Fundo reserva', subcategoria: 'Mínimo 10% (DL 268/94)', icon: '🏦' },
  { categoria: 'Contencioso', subcategoria: 'Despesas jurídicas', icon: '⚖️' },
  { categoria: 'Obras conservação', subcategoria: 'Obras planeadas', icon: '🏗️' },
  { categoria: 'Gás', subcategoria: 'Aquecimento central (se aplicável)', icon: '🔥' },
  { categoria: 'Diversos', subcategoria: 'Material escritório, correios, etc.', icon: '📦' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatEur = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const formatPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

const genId = () => Math.random().toString(36).slice(2, 10)

// ─── IA Budget Generator ────────────────────────────────────────────────────

function generateBudgetIA(
  historico: HistoricoExercicio[],
  taxaInflacao: number
): PosteOrcamento[] {
  // Tri par année
  const sorted = [...historico].sort((a, b) => a.ano - b.ano)
  const last3 = sorted.slice(-3)

  return CATEGORIAS_ORCAMENTO.map(cat => {
    const valores = last3.map(h => {
      const p = h.postes.find(pp => pp.categoria === cat.categoria)
      return p?.valor || 0
    })

    // Padding si moins de 3 ans d'historique
    while (valores.length < 3) valores.unshift(0)

    const [v1, v2, v3] = valores
    const nonZero = valores.filter(v => v > 0)

    let valorPrevisto: number
    let justificacao: string

    if (nonZero.length === 0) {
      // Pas d'historique — estimation par défaut
      valorPrevisto = 0
      justificacao = 'Sem histórico. Preencha manualmente.'
    } else if (nonZero.length === 1) {
      // 1 seul exercice — inflation simple
      valorPrevisto = Math.round(nonZero[0] * (1 + taxaInflacao / 100))
      justificacao = `Baseado no único exercício disponível + inflação ${taxaInflacao}%`
    } else if (nonZero.length === 2) {
      // 2 exercices — tendance linéaire + inflation
      const growth = v3 > 0 && v2 > 0 ? (v3 - v2) / v2 : 0
      valorPrevisto = Math.round(v3 * (1 + growth * 0.5 + taxaInflacao / 100))
      justificacao = `Tendência linear (${formatPct(growth * 100)}/ano) + inflação ${taxaInflacao}%`
    } else {
      // 3 exercices — moyenne pondérée + tendance + inflation
      const avgWeighted = (v1 * 0.15 + v2 * 0.35 + v3 * 0.50)
      const trend12 = v2 > 0 ? (v3 - v2) / v2 : 0
      const trend01 = v1 > 0 ? (v2 - v1) / v1 : 0
      const avgTrend = (trend12 * 0.7 + trend01 * 0.3)

      // Limiter les variations extrêmes
      const cappedTrend = Math.max(-0.15, Math.min(0.25, avgTrend))
      valorPrevisto = Math.round(avgWeighted * (1 + cappedTrend + taxaInflacao / 100))

      justificacao = `Média ponderada 3 exercícios (tendência ${formatPct(avgTrend * 100)}) + inflação ${taxaInflacao}%`
    }

    // Assurer fundo reserva minimum 10% du budget total
    if (cat.categoria === 'Fundo reserva' && valorPrevisto === 0) {
      justificacao = 'Mínimo legal 10% do orçamento total (DL 268/94). Calculado automaticamente.'
    }

    const variacao = v3 > 0 ? ((valorPrevisto - v3) / v3) * 100 : 0
    const tendencia: 'up' | 'down' | 'stable' =
      variacao > 3 ? 'up' : variacao < -3 ? 'down' : 'stable'

    return {
      categoria: cat.categoria,
      subcategoria: cat.subcategoria,
      valorAnterior1: v1,
      valorAnterior2: v2,
      valorAnterior3: v3,
      valorPrevisto,
      valorAjustado: valorPrevisto,
      tendencia,
      variacao,
      justificacao,
    }
  })
}

// ─── Composant Principal ─────────────────────────────────────────────────────

interface Props {
  user: User
  userRole: string
}

export default function OrcamentoAnualIASection({ user }: Props) {
  const uid = user?.id || 'demo'
  const lsKey = (k: string) => `fixit_syndic_${uid}_${k}`

  const [tab, setTab] = useState<TabId>('gerador')
  const [immeubles, setImmeubles] = useState<{ id: string; nom: string }[]>([])
  const [selectedImm, setSelectedImm] = useState('')
  const [orcamentos, setOrcamentos] = useState<OrcamentoAnual[]>([])
  const [historico, setHistorico] = useState<HistoricoExercicio[]>([])
  const [taxaInflacao, setTaxaInflacao] = useState(3.2)
  const [generating, setGenerating] = useState(false)
  const [currentOrcamento, setCurrentOrcamento] = useState<OrcamentoAnual | null>(null)
  const [loading, setLoading] = useState(true)

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  const loadData = async () => {
    setLoading(true)
    try {
      // Immeubles depuis API
      const res = await fetch(`/api/syndic/immeubles?user_id=${uid}`)
      const data = await res.json()
      const imms = (data.immeubles || []).map((i: { id: string; nom: string }) => ({ id: i.id, nom: i.nom }))
      setImmeubles(imms)
      if (imms.length > 0 && !selectedImm) setSelectedImm(imms[0].id)

      // Orçamentos sauvegardés
      const saved = JSON.parse(localStorage.getItem(lsKey('orcamentos_ia')) || '[]')
      setOrcamentos(saved)

      // Historique exercices (depuis budgets existants ou données comptables)
      const budgets = JSON.parse(localStorage.getItem(`fixit_budgets_${uid}`) || '[]')
      const hist: HistoricoExercicio[] = budgets.map((b: Record<string, unknown>) => ({
        ano: (b.annee || b.ano) as number,
        postes: ((b.postes as Array<Record<string, unknown>> | undefined) || []).map((p) => ({
          categoria: (p.libelle || p.categoria) as string,
          valor: ((p.realise || p.budget || p.valor || 0) as number),
        })),
        total: ((b.postes as Array<Record<string, unknown>> | undefined) || []).reduce((s: number, p) => s + ((p.realise || p.budget || p.valor || 0) as number), 0),
      }))
      setHistorico(hist)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const saveOrcamentos = useCallback((orcs: OrcamentoAnual[]) => {
    setOrcamentos(orcs)
    localStorage.setItem(lsKey('orcamentos_ia'), JSON.stringify(orcs))
  }, [lsKey])

  // ── Génération IA ─────────────────────────────────────────────────────────
  const handleGenerate = () => {
    if (!selectedImm) return
    setGenerating(true)

    setTimeout(() => {
      const immNom = immeubles.find(i => i.id === selectedImm)?.nom || 'Edifício'
      const ano = new Date().getFullYear() + 1

      // Filtrer historique pour cet immeuble
      const immHist = historico.filter(h =>
        orcamentos.some(o => o.immeuble === selectedImm && o.ano === h.ano)
      )

      // Si pas d'historique spécifique, utiliser tout l'historique
      const histToUse = immHist.length > 0 ? immHist : historico

      const postes = generateBudgetIA(histToUse, taxaInflacao)

      // Calculer fundo reserva si = 0
      const totalSemFundo = postes.filter(p => p.categoria !== 'Fundo reserva').reduce((s, p) => s + p.valorPrevisto, 0)
      const fundoIdx = postes.findIndex(p => p.categoria === 'Fundo reserva')
      if (fundoIdx >= 0 && postes[fundoIdx].valorPrevisto === 0 && totalSemFundo > 0) {
        const min10 = Math.round(totalSemFundo * 0.10)
        postes[fundoIdx].valorPrevisto = min10
        postes[fundoIdx].valorAjustado = min10
        postes[fundoIdx].justificacao = `Mínimo legal 10% = ${formatEur(min10)} (DL 268/94)`
      }

      const totalPrevisto = postes.reduce((s, p) => s + p.valorPrevisto, 0)

      const newOrc: OrcamentoAnual = {
        id: genId(),
        immeuble: selectedImm,
        immeubleNom: immNom,
        ano,
        postes,
        totalPrevisto,
        totalAjustado: totalPrevisto,
        estado: 'rascunho',
        dataCriacao: new Date().toISOString(),
        geradoPorIA: true,
        taxaInflacao,
        notas: '',
      }

      setCurrentOrcamento(newOrc)
      const updated = [newOrc, ...orcamentos.filter(o => !(o.immeuble === selectedImm && o.ano === ano))]
      saveOrcamentos(updated)
      setGenerating(false)
    }, 1500)
  }

  // ── Ajuster un poste ──────────────────────────────────────────────────────
  const handleAjustarPoste = (idx: number, valor: number) => {
    if (!currentOrcamento) return
    const updated = { ...currentOrcamento }
    updated.postes = [...updated.postes]
    updated.postes[idx] = { ...updated.postes[idx], valorAjustado: valor }
    updated.totalAjustado = updated.postes.reduce((s, p) => s + p.valorAjustado, 0)
    setCurrentOrcamento(updated)
    // Save
    const allUpdated = orcamentos.map(o => o.id === updated.id ? updated : o)
    saveOrcamentos(allUpdated)
  }

  // ── Changer estado ────────────────────────────────────────────────────────
  const handleChangeEstado = (id: string, estado: OrcamentoAnual['estado']) => {
    const updated = orcamentos.map(o => o.id === id ? { ...o, estado } : o)
    saveOrcamentos(updated)
    if (currentOrcamento?.id === id) setCurrentOrcamento({ ...currentOrcamento, estado })
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: orcamentos.length,
    rascunho: orcamentos.filter(o => o.estado === 'rascunho').length,
    proposto: orcamentos.filter(o => o.estado === 'proposto').length,
    aprovado: orcamentos.filter(o => o.estado === 'aprovado_ag').length,
  }), [orcamentos])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-[#C9A84C] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500 text-sm">A carregar dados orçamentais...</p>
        </div>
      </div>
    )
  }

  const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'gerador', label: 'Gerador IA', icon: '🤖' },
    { id: 'historico', label: 'Histórico', icon: '📊' },
    { id: 'comparacao', label: 'Comparação', icon: '📈' },
    { id: 'aprovacao', label: 'Aprovação AG', icon: '✅' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#0D1B2E] flex items-center gap-2">
          🤖 Orçamento Anual com IA
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Geração automática baseada nos últimos 3 exercícios + tendências económicas + inflação
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total Orçamentos</p>
          <p className="text-2xl font-bold text-[#0D1B2E]">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Rascunho</p>
          <p className="text-2xl font-bold text-gray-500">{stats.rascunho}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Proposto</p>
          <p className="text-2xl font-bold text-amber-600">{stats.proposto}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Aprovado AG</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.aprovado}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg transition-all ${
              tab === t.id ? 'bg-white text-[#0D1B2E] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: Gerador IA ═══ */}
      {tab === 'gerador' && (
        <div className="space-y-6">
          {/* Paramètres de génération */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-semibold text-[#0D1B2E] text-sm mb-4">⚙️ Parâmetros de Geração</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Edifício</label>
                <select
                  value={selectedImm}
                  onChange={e => setSelectedImm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#C9A84C]/40 focus:border-[#C9A84C]"
                >
                  {immeubles.map(i => (
                    <option key={i.id} value={i.id}>{i.nom}</option>
                  ))}
                  {immeubles.length === 0 && <option value="">Nenhum edifício</option>}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Taxa de inflação prevista (%)</label>
                <input
                  type="number"
                  value={taxaInflacao}
                  onChange={e => setTaxaInflacao(parseFloat(e.target.value) || 0)}
                  step="0.1"
                  min="0"
                  max="20"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#C9A84C]/40 focus:border-[#C9A84C]"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleGenerate}
                  disabled={generating || !selectedImm}
                  className="w-full px-4 py-2 bg-[#0D1B2E] text-white rounded-lg text-sm font-medium hover:bg-[#0D1B2E]/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {generating ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      A gerar...
                    </>
                  ) : (
                    <>🤖 Gerar Orçamento {new Date().getFullYear() + 1}</>
                  )}
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              💡 O algoritmo analisa os últimos 3 exercícios contabilísticos, aplica médias ponderadas,
              deteta tendências de crescimento/redução por categoria, e ajusta pela inflação prevista.
              O fundo de reserva é automaticamente calculado ao mínimo legal de 10% (DL 268/94).
            </p>
          </div>

          {/* Résultat de la génération */}
          {currentOrcamento && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-[#0D1B2E] to-[#1a2d4a] text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg">
                      Orçamento {currentOrcamento.ano} — {currentOrcamento.immeubleNom}
                    </h3>
                    <p className="text-sm text-gray-300">
                      Gerado por IA • Inflação {currentOrcamento.taxaInflacao}% •{' '}
                      {new Date(currentOrcamento.dataCriacao).toLocaleDateString('pt-PT')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-300">Total previsto</p>
                    <p className="text-2xl font-bold text-[#C9A84C]">{formatEur(currentOrcamento.totalAjustado)}</p>
                    {currentOrcamento.totalAjustado !== currentOrcamento.totalPrevisto && (
                      <p className="text-xs text-gray-400">
                        IA: {formatEur(currentOrcamento.totalPrevisto)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Tableau des postes */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 bg-gray-50/50">
                      <th className="text-left px-4 py-3 font-medium">Categoria</th>
                      <th className="text-right px-3 py-3 font-medium">N-3</th>
                      <th className="text-right px-3 py-3 font-medium">N-2</th>
                      <th className="text-right px-3 py-3 font-medium">N-1</th>
                      <th className="text-right px-3 py-3 font-medium">Previsão IA</th>
                      <th className="text-center px-3 py-3 font-medium">Var.</th>
                      <th className="text-right px-3 py-3 font-medium w-32">Valor Ajustado</th>
                      <th className="text-left px-3 py-3 font-medium">Justificação IA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {currentOrcamento.postes.map((poste, idx) => {
                      const catInfo = CATEGORIAS_ORCAMENTO.find(c => c.categoria === poste.categoria)
                      return (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{catInfo?.icon || '📋'}</span>
                              <div>
                                <p className="text-sm font-medium text-[#0D1B2E]">{poste.categoria}</p>
                                <p className="text-xs text-gray-400">{poste.subcategoria}</p>
                              </div>
                            </div>
                          </td>
                          <td className="text-right px-3 py-3 text-xs text-gray-400 font-mono">
                            {poste.valorAnterior1 > 0 ? formatEur(poste.valorAnterior1) : '—'}
                          </td>
                          <td className="text-right px-3 py-3 text-xs text-gray-400 font-mono">
                            {poste.valorAnterior2 > 0 ? formatEur(poste.valorAnterior2) : '—'}
                          </td>
                          <td className="text-right px-3 py-3 text-xs text-gray-600 font-mono font-medium">
                            {poste.valorAnterior3 > 0 ? formatEur(poste.valorAnterior3) : '—'}
                          </td>
                          <td className="text-right px-3 py-3 text-xs text-blue-600 font-mono font-semibold">
                            {poste.valorPrevisto > 0 ? formatEur(poste.valorPrevisto) : '—'}
                          </td>
                          <td className="text-center px-3 py-3">
                            {poste.valorAnterior3 > 0 && (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                poste.tendencia === 'up' ? 'bg-red-100 text-red-600' :
                                poste.tendencia === 'down' ? 'bg-emerald-100 text-emerald-600' :
                                'bg-gray-100 text-gray-500'
                              }`}>
                                {poste.tendencia === 'up' ? '↑' : poste.tendencia === 'down' ? '↓' : '→'}{' '}
                                {formatPct(poste.variacao)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              value={poste.valorAjustado}
                              onChange={e => handleAjustarPoste(idx, parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-xs text-right border border-gray-200 rounded-lg font-mono focus:ring-2 focus:ring-[#C9A84C]/40 focus:border-[#C9A84C]"
                            />
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-400 max-w-48 truncate" title={poste.justificacao}>
                            {poste.justificacao}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-4 py-3 text-sm text-[#0D1B2E]">TOTAL</td>
                      <td className="text-right px-3 py-3 text-xs text-gray-500 font-mono">
                        {formatEur(currentOrcamento.postes.reduce((s, p) => s + p.valorAnterior1, 0))}
                      </td>
                      <td className="text-right px-3 py-3 text-xs text-gray-500 font-mono">
                        {formatEur(currentOrcamento.postes.reduce((s, p) => s + p.valorAnterior2, 0))}
                      </td>
                      <td className="text-right px-3 py-3 text-xs text-gray-600 font-mono">
                        {formatEur(currentOrcamento.postes.reduce((s, p) => s + p.valorAnterior3, 0))}
                      </td>
                      <td className="text-right px-3 py-3 text-xs text-blue-600 font-mono">
                        {formatEur(currentOrcamento.totalPrevisto)}
                      </td>
                      <td />
                      <td className="text-right px-3 py-3 text-xs text-[#0D1B2E] font-mono">
                        {formatEur(currentOrcamento.totalAjustado)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Actions */}
              <div className="px-6 py-4 bg-gray-50 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    currentOrcamento.estado === 'rascunho' ? 'bg-gray-200 text-gray-700' :
                    currentOrcamento.estado === 'proposto' ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {currentOrcamento.estado === 'rascunho' ? '📝 Rascunho' :
                     currentOrcamento.estado === 'proposto' ? '📤 Proposto' :
                     '✅ Aprovado em AG'}
                  </span>
                </div>
                <div className="flex gap-2">
                  {currentOrcamento.estado === 'rascunho' && (
                    <button
                      onClick={() => handleChangeEstado(currentOrcamento.id, 'proposto')}
                      className="px-4 py-2 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 transition-all"
                    >
                      📤 Propor para AG
                    </button>
                  )}
                  {currentOrcamento.estado === 'proposto' && (
                    <button
                      onClick={() => handleChangeEstado(currentOrcamento.id, 'aprovado_ag')}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition-all"
                    >
                      ✅ Marcar como Aprovado em AG
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {!currentOrcamento && !generating && (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
              <p className="text-4xl mb-3">📊</p>
              <p className="font-semibold text-[#0D1B2E]">Gere o seu primeiro orçamento com IA</p>
              <p className="text-sm text-gray-500 mt-1">
                Selecione um edifício, defina a inflação prevista e clique em "Gerar"
              </p>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Histórico ═══ */}
      {tab === 'historico' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-[#0D1B2E] text-sm">📊 Orçamentos Gerados</h3>
          {orcamentos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-sm text-gray-500">Nenhum orçamento gerado ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orcamentos.map(orc => (
                <button
                  key={orc.id}
                  onClick={() => { setCurrentOrcamento(orc); setTab('gerador') }}
                  className="w-full bg-white rounded-xl border border-gray-100 p-5 text-left hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-[#0D1B2E]">{orc.immeubleNom} — {orc.ano}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(orc.dataCriacao).toLocaleDateString('pt-PT')} •
                        {orc.postes.length} categorias •
                        Inflação {orc.taxaInflacao}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#0D1B2E]">{formatEur(orc.totalAjustado)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        orc.estado === 'rascunho' ? 'bg-gray-100 text-gray-600' :
                        orc.estado === 'proposto' ? 'bg-amber-100 text-amber-600' :
                        'bg-emerald-100 text-emerald-600'
                      }`}>
                        {orc.estado === 'rascunho' ? 'Rascunho' :
                         orc.estado === 'proposto' ? 'Proposto' : 'Aprovado AG'}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Comparação ═══ */}
      {tab === 'comparacao' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-[#0D1B2E] text-sm">📈 Comparação Plurianual</h3>
          {orcamentos.length < 2 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
              <p className="text-4xl mb-3">📈</p>
              <p className="text-sm text-gray-500">Gere pelo menos 2 orçamentos para comparar</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 bg-gray-50">
                    <th className="text-left px-4 py-3">Categoria</th>
                    {orcamentos.slice(0, 4).map(o => (
                      <th key={o.id} className="text-right px-3 py-3">{o.ano}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {CATEGORIAS_ORCAMENTO.map(cat => (
                    <tr key={cat.categoria} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2 text-xs font-medium text-[#0D1B2E]">
                        {cat.icon} {cat.categoria}
                      </td>
                      {orcamentos.slice(0, 4).map(o => {
                        const poste = o.postes.find(p => p.categoria === cat.categoria)
                        return (
                          <td key={o.id} className="text-right px-3 py-2 text-xs font-mono text-gray-600">
                            {poste ? formatEur(poste.valorAjustado) : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-3 text-sm">TOTAL</td>
                    {orcamentos.slice(0, 4).map(o => (
                      <td key={o.id} className="text-right px-3 py-3 text-xs font-mono text-[#0D1B2E]">
                        {formatEur(o.totalAjustado)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Aprovação AG ═══ */}
      {tab === 'aprovacao' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-[#0D1B2E] text-sm">✅ Orçamentos para Aprovação em AG</h3>
          {orcamentos.filter(o => o.estado === 'proposto').length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
              <p className="text-4xl mb-3">🗳️</p>
              <p className="text-sm text-gray-500">Nenhum orçamento proposto para aprovação</p>
              <p className="text-xs text-gray-400 mt-1">Gere um orçamento e clique "Propor para AG"</p>
            </div>
          ) : (
            orcamentos.filter(o => o.estado === 'proposto').map(orc => (
              <div key={orc.id} className="bg-white rounded-xl border border-amber-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-[#0D1B2E]">{orc.immeubleNom} — {orc.ano}</p>
                    <p className="text-xs text-gray-400">{orc.postes.length} categorias</p>
                  </div>
                  <p className="text-xl font-bold text-[#0D1B2E]">{formatEur(orc.totalAjustado)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleChangeEstado(orc.id, 'aprovado_ag')}
                    className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition-all"
                  >
                    ✅ Aprovado em AG
                  </button>
                  <button
                    onClick={() => handleChangeEstado(orc.id, 'rascunho')}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-all"
                  >
                    ↩ Voltar a rascunho
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
