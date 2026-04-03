'use client'

import React, { useState, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type FaseObra = 'orcamentacao' | 'aprovacao_ag' | 'em_execucao' | 'concluida'
type TipoObra = 'manutencao' | 'reparacao' | 'renovacao' | 'urgente'

interface Orcamento {
  id: string
  obraId: string
  fornecedor: string
  valorTotal: number
  prazoExecucao: number // dias
  garantiaMeses: number
  materiaisIncluidos: boolean
  iva: number // percentagem
  condicoesPagamento: string
  dataSubmissao: string
  reputacao: number // 1-5
}

interface Obra {
  id: string
  titulo: string
  descricao: string
  tipo: TipoObra
  imovel: string
  valorEstimado: number
  fase: FaseObra
  progresso: number // 0-100
  prazo: string // data limite
  artesaoSelecionado?: string
  orcamentoAprovado?: number
  dataCriacao: string
  dataArquivo?: string
  fornecedorSelecionado?: string
  valorFinal?: number
  resultado?: string
}

interface Props {
  user: User
  userRole: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const FASES_CONFIG: Record<FaseObra, { label: string; emoji: string; bg: string; color: string; dot: string }> = {
  orcamentacao:  { label: 'Oramentao',  emoji: '📋', bg: '#FEF5E4', color: '#D4830A', dot: '#D4830A' },
  aprovacao_ag:   { label: 'Aprovao AG',   emoji: '🗳️', bg: '#EDE8FF', color: '#6C5CE7', dot: '#6C5CE7' },
  em_execucao:    { label: 'Em Execuo',    emoji: '🔧', bg: '#E6F4F2', color: '#1A7A6E', dot: '#1A7A6E' },
  concluida:      { label: 'Concluída',      emoji: '✅', bg: '#F0F9E8', color: '#2D8A4E', dot: '#2D8A4E' },
}

const TIPOS_OBRA: Record<TipoObra, { label: string; emoji: string }> = {
  manutencao: { emoji: '🔧', label: 'Manutenção' },
  reparacao:  { emoji: '🛠️', label: 'Reparação' },
  renovacao:  { emoji: '🏗️', label: 'Renovação' },
  urgente:    { emoji: '🚨', label: 'Urgente' },
}

const FASES_PIPELINE: FaseObra[] = ['orcamentacao', 'aprovacao_ag', 'em_execucao', 'concluida']

// ─── Demo Data ───────────────────────────────────────────────────────────────

function gerarDemoData(): { obras: Obra[]; orcamentos: Orcamento[] } {
  const obra1Id = 'demo-obra-001'
  const obra2Id = 'demo-obra-002'

  const obras: Obra[] = [
    {
      id: obra1Id,
      titulo: 'Impermeabilização da cobertura',
      descricao: 'Reparação e impermeabilização completa da cobertura do edifício principal, incluindo substituição de telhas danificadas.',
      tipo: 'reparacao',
      imovel: 'Edifício Av. da Liberdade, 42',
      valorEstimado: 18500,
      fase: 'orcamentacao',
      progresso: 0,
      prazo: '2026-06-30',
      dataCriacao: '2026-02-15',
    },
    {
      id: obra2Id,
      titulo: 'Renovação da fachada exterior',
      descricao: 'Pintura e restauro da fachada com tratamento anti-humidade e limpeza de cantarias.',
      tipo: 'renovacao',
      imovel: 'Edifício Rua Augusta, 105',
      valorEstimado: 32000,
      fase: 'aprovacao_ag',
      progresso: 0,
      prazo: '2026-09-15',
      artesaoSelecionado: 'ConstruPT Lda.',
      orcamentoAprovado: 29800,
      dataCriacao: '2026-01-20',
    },
  ]

  const orcamentos: Orcamento[] = [
    // Obra 1 — 3 orçamentos
    {
      id: 'orc-001', obraId: obra1Id, fornecedor: 'TelhaViva Lda.', valorTotal: 17200,
      prazoExecucao: 21, garantiaMeses: 60, materiaisIncluidos: true, iva: 23,
      condicoesPagamento: '30% adiantamento + 70% conclusão', dataSubmissao: '2026-02-28', reputacao: 4,
    },
    {
      id: 'orc-002', obraId: obra1Id, fornecedor: 'ImpermeSul SA', valorTotal: 19500,
      prazoExecucao: 14, garantiaMeses: 120, materiaisIncluidos: true, iva: 23,
      condicoesPagamento: '50% adiantamento + 50% conclusão', dataSubmissao: '2026-03-01', reputacao: 5,
    },
    {
      id: 'orc-003', obraId: obra1Id, fornecedor: 'Obras & Telhados Unipessoal', valorTotal: 15800,
      prazoExecucao: 35, garantiaMeses: 24, materiaisIncluidos: false, iva: 23,
      condicoesPagamento: '100% conclusão', dataSubmissao: '2026-03-02', reputacao: 3,
    },
    // Obra 2 — 3 orçamentos
    {
      id: 'orc-004', obraId: obra2Id, fornecedor: 'ConstruPT Lda.', valorTotal: 29800,
      prazoExecucao: 45, garantiaMeses: 60, materiaisIncluidos: true, iva: 23,
      condicoesPagamento: '20% início + 40% meio + 40% fim', dataSubmissao: '2026-01-25', reputacao: 5,
    },
    {
      id: 'orc-005', obraId: obra2Id, fornecedor: 'PintaLisboa SA', valorTotal: 27500,
      prazoExecucao: 60, garantiaMeses: 36, materiaisIncluidos: true, iva: 23,
      condicoesPagamento: '50% adiantamento + 50% conclusão', dataSubmissao: '2026-01-28', reputacao: 3,
    },
    {
      id: 'orc-006', obraId: obra2Id, fornecedor: 'RestauraFachadas Lda.', valorTotal: 34200,
      prazoExecucao: 30, garantiaMeses: 120, materiaisIncluidos: true, iva: 23,
      condicoesPagamento: '30% adiantamento + 70% conclusão', dataSubmissao: '2026-01-30', reputacao: 4,
    },
  ]

  return { obras, orcamentos }
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function OrcamentosObrasSection({ user, userRole }: Props) {
  // ── Tabs
  type TabKey = 'obras' | 'comparacao' | 'arquivo' | 'regras'
  const [activeTab, setActiveTab] = useState<TabKey>('obras')

  // ── State — obras & orçamentos
  const [obras, setObras] = useState<Obra[]>([])
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])

  // ── State — nova obra form
  const [showNovaObra, setShowNovaObra] = useState(false)
  const [formTitulo, setFormTitulo] = useState('')
  const [formDescricao, setFormDescricao] = useState('')
  const [formTipo, setFormTipo] = useState<TipoObra>('manutencao')
  const [formImovel, setFormImovel] = useState('')
  const [formValorEstimado, setFormValorEstimado] = useState('')
  const [formPrazo, setFormPrazo] = useState('')

  // ── State — comparação
  const [obraComparacao, setObraComparacao] = useState<string | null>(null)

  // ── State — arquivo filtros
  const [filtroAno, setFiltroAno] = useState<string>('todos')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroImovel, setFiltroImovel] = useState<string>('todos')
  const [searchArquivo, setSearchArquivo] = useState('')

  // ── State — regras: seuil
  const [seuilValue, setSeuilValue] = useState<number>(2500)

  // ── Storage
  const STORAGE_KEY = `fixit_orcamentos_${user.id}`

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (data.obras && data.obras.length > 0) {
          setObras(data.obras)
          setOrcamentos(data.orcamentos || [])
          if (typeof data.seuilValue === 'number') setSeuilValue(data.seuilValue)
          return
        }
      }
    } catch { /* ignore */ }
    // Seed demo
    const demo = gerarDemoData()
    setObras(demo.obras)
    setOrcamentos(demo.orcamentos)
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ obras, orcamentos, seuilValue }))
  }, [obras, orcamentos, seuilValue])

  // ── Helpers
  const fmt = (n: number) => n.toLocaleString('pt-PT', { minimumFractionDigits: 2 })

  const orcamentosPorObra = useMemo(() => {
    const map: Record<string, Orcamento[]> = {}
    for (const o of orcamentos) {
      if (!map[o.obraId]) map[o.obraId] = []
      map[o.obraId].push(o)
    }
    return map
  }, [orcamentos])

  const obrasAtivas = useMemo(() => obras.filter(o => o.fase !== 'concluida'), [obras])
  const obrasArquivadas = useMemo(() => obras.filter(o => o.fase === 'concluida'), [obras])

  // ── Score calculation (Preo 40%, Prazo 20%, Garantia 20%, Reputao 20%)
  const calcularScores = (orcs: Orcamento[]) => {
    if (orcs.length === 0) return []
    const minPreco = Math.min(...orcs.map(o => o.valorTotal))
    const maxPreco = Math.max(...orcs.map(o => o.valorTotal))
    const minPrazo = Math.min(...orcs.map(o => o.prazoExecucao))
    const maxPrazo = Math.max(...orcs.map(o => o.prazoExecucao))
    const maxGarantia = Math.max(...orcs.map(o => o.garantiaMeses))

    return orcs.map(o => {
      const precoScore = maxPreco === minPreco ? 100 : ((maxPreco - o.valorTotal) / (maxPreco - minPreco)) * 100
      const prazoScore = maxPrazo === minPrazo ? 100 : ((maxPrazo - o.prazoExecucao) / (maxPrazo - minPrazo)) * 100
      const garantiaScore = maxGarantia === 0 ? 50 : (o.garantiaMeses / maxGarantia) * 100
      const reputacaoScore = (o.reputacao / 5) * 100
      const total = precoScore * 0.4 + prazoScore * 0.2 + garantiaScore * 0.2 + reputacaoScore * 0.2
      return { ...o, score: Math.round(total), precoScore: Math.round(precoScore), prazoScore: Math.round(prazoScore), garantiaScore: Math.round(garantiaScore), reputacaoScore: Math.round(reputacaoScore) }
    }).sort((a, b) => b.score - a.score)
  }

  // ── Actions
  const criarObra = () => {
    if (!formTitulo.trim() || !formImovel.trim()) return
    const nova: Obra = {
      id: crypto.randomUUID(),
      titulo: formTitulo.trim(),
      descricao: formDescricao.trim(),
      tipo: formTipo,
      imovel: formImovel.trim(),
      valorEstimado: parseFloat(formValorEstimado) || 0,
      fase: 'orcamentacao',
      progresso: 0,
      prazo: formPrazo || '',
      dataCriacao: new Date().toISOString().slice(0, 10),
    }
    setObras(prev => [nova, ...prev])
    setFormTitulo(''); setFormDescricao(''); setFormTipo('manutencao'); setFormImovel(''); setFormValorEstimado(''); setFormPrazo('')
    setShowNovaObra(false)
  }

  const mudarFase = (obraId: string, novaFase: FaseObra) => {
    setObras(prev => prev.map(o => o.id === obraId ? { ...o, fase: novaFase, dataArquivo: novaFase === 'concluida' ? new Date().toISOString().slice(0, 10) : o.dataArquivo } : o))
  }

  const selecionarFornecedor = (obraId: string, orcamento: Orcamento) => {
    setObras(prev => prev.map(o => o.id === obraId ? {
      ...o,
      artesaoSelecionado: orcamento.fornecedor,
      orcamentoAprovado: orcamento.valorTotal,
      fornecedorSelecionado: orcamento.fornecedor,
      valorFinal: orcamento.valorTotal,
      fase: 'aprovacao_ag',
      resultado: `Selecionado: ${orcamento.fornecedor} — ${fmt(orcamento.valorTotal)} €`,
    } : o))
    setObraComparacao(null)
  }

  const eliminarObra = (obraId: string) => {
    setObras(prev => prev.filter(o => o.id !== obraId))
    setOrcamentos(prev => prev.filter(o => o.obraId !== obraId))
  }

  // ── Arquivo filtering
  const obrasArquivadasFiltradas = useMemo(() => {
    return obrasArquivadas.filter(o => {
      if (filtroAno !== 'todos' && !o.dataCriacao.startsWith(filtroAno)) return false
      if (filtroTipo !== 'todos' && o.tipo !== filtroTipo) return false
      if (filtroImovel !== 'todos' && o.imovel !== filtroImovel) return false
      if (searchArquivo && !o.titulo.toLowerCase().includes(searchArquivo.toLowerCase()) && !o.imovel.toLowerCase().includes(searchArquivo.toLowerCase())) return false
      return true
    })
  }, [obrasArquivadas, filtroAno, filtroTipo, filtroImovel, searchArquivo])

  const imoveisUnicos = useMemo(() => [...new Set(obras.map(o => o.imovel))], [obras])
  const anosUnicos = useMemo(() => [...new Set(obras.map(o => o.dataCriacao.slice(0, 4)))].sort().reverse(), [obras])

  // ─── Styles ────────────────────────────────────────────────────────────────

  const sCard: React.CSSProperties = {
    background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, padding: 16,
  }
  const sBtn: React.CSSProperties = {
    background: 'var(--sd-navy, #0D1B2E)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  }
  const sBtnSecondary: React.CSSProperties = {
    background: 'var(--sd-cream, #F7F4EE)', color: 'var(--sd-navy, #0D1B2E)', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  }
  const sInput: React.CSSProperties = {
    width: '100%', padding: '10px 14px', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 8, fontSize: 14, background: '#fff', outline: 'none',
  }
  const sLabel: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--sd-ink-2, #4A5E78)', marginBottom: 6,
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
            📋 Oramentos &amp; Obras
          </h2>
          <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>
            Comparao obrigatria de 3 oramentos Lei 8/2022 Art. 1436. CC
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { emoji: '🏗️', label: 'Obras Ativas', value: obrasAtivas.length, color: 'var(--sd-navy, #0D1B2E)' },
          { emoji: '📋', label: 'Em Orçamentação', value: obras.filter(o => o.fase === 'orcamentacao').length, color: '#D4830A' },
          { emoji: '🗳️', label: 'Aprovação AG', value: obras.filter(o => o.fase === 'aprovacao_ag').length, color: '#6C5CE7' },
          { emoji: '🔧', label: 'Em Execução', value: obras.filter(o => o.fase === 'em_execucao').length, color: '#1A7A6E' },
          { emoji: '✅', label: 'Concluídas', value: obrasArquivadas.length, color: '#2D8A4E' },
          { emoji: '📊', label: 'Total Orçamentos', value: orcamentos.length, color: 'var(--sd-gold, #C9A84C)' },
        ].map((s, i) => (
          <div key={i} style={{ ...sCard }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{s.emoji}</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid var(--sd-border, #E4DDD0)', paddingBottom: 12, flexWrap: 'wrap' }}>
        {([
          { key: 'obras' as TabKey, label: '🏗️ Obras em Curso', count: obrasAtivas.length },
          { key: 'comparacao' as TabKey, label: '📊 Comparação Orçamentos', count: Object.keys(orcamentosPorObra).length },
          { key: 'arquivo' as TabKey, label: '📁 Arquivo', count: obrasArquivadas.length },
          { key: 'regras' as TabKey, label: '⚖️ Regras', count: null },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: activeTab === tab.key ? 'var(--sd-navy, #0D1B2E)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'var(--sd-ink-2, #4A5E78)',
              border: activeTab === tab.key ? 'none' : '1px solid var(--sd-border, #E4DDD0)',
              borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {tab.label}{tab.count !== null ? ` (${tab.count})` : ''}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════
          TAB 1 — Obras em Curso (Pipeline / Kanban)
         ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'obras' && (
        <div>
          {/* Nova obra button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={() => setShowNovaObra(!showNovaObra)} style={sBtn}>
              + Nova Obra
            </button>
          </div>

          {/* Nova obra form */}
          {showNovaObra && (
            <div style={{ ...sCard, marginBottom: 24, borderLeft: '4px solid var(--sd-gold, #C9A84C)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--sd-navy, #0D1B2E)' }}>Nova Obra</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={sLabel}>Título *</label>
                  <input value={formTitulo} onChange={e => setFormTitulo(e.target.value)} style={sInput} placeholder="Ex.: Impermeabilização da cobertura" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={sLabel}>Descrição</label>
                  <textarea value={formDescricao} onChange={e => setFormDescricao(e.target.value)} style={{ ...sInput, minHeight: 60, resize: 'vertical' }} placeholder="Descrição detalhada da obra..." />
                </div>
                <div>
                  <label style={sLabel}>Tipo</label>
                  <select value={formTipo} onChange={e => setFormTipo(e.target.value as TipoObra)} style={sInput}>
                    {Object.entries(TIPOS_OBRA).map(([k, v]) => (
                      <option key={k} value={k}>{v.emoji} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={sLabel}>Imvel *</label>
                  <input value={formImovel} onChange={e => setFormImovel(e.target.value)} style={sInput} placeholder="Ex.: Edifício Rua Augusta, 105" />
                </div>
                <div>
                  <label style={sLabel}>Valor Estimado ()</label>
                  <input type="number" value={formValorEstimado} onChange={e => setFormValorEstimado(e.target.value)} style={sInput} placeholder="0.00" />
                </div>
                <div>
                  <label style={sLabel}>Prazo (data limite)</label>
                  <input type="date" value={formPrazo} onChange={e => setFormPrazo(e.target.value)} style={sInput} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowNovaObra(false)} style={sBtnSecondary}>Cancelar</button>
                <button onClick={criarObra} style={sBtn}>Criar Obra</button>
              </div>
            </div>
          )}

          {/* Pipeline / Kanban columns */}
          {obrasAtivas.length === 0 && !showNovaObra ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--sd-ink-3, #8A9BB0)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🏗️</div>
              <p style={{ fontSize: 16 }}>Nenhuma obra em curso</p>
              <p style={{ fontSize: 13 }}>Clique em &quot;+ Nova Obra&quot; para iniciar</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              {FASES_PIPELINE.map(fase => {
                const obrasFase = obrasAtivas.filter(o => o.fase === fase)
                const conf = FASES_CONFIG[fase]
                return (
                  <div key={fase} style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 12, padding: 12, minHeight: 200 }}>
                    {/* Column header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid var(--sd-border, #E4DDD0)' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: conf.dot, display: 'inline-block' }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)' }}>
                        {conf.emoji} {conf.label}
                      </span>
                      <span style={{ marginLeft: 'auto', background: conf.bg, color: conf.color, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                        {obrasFase.length}
                      </span>
                    </div>

                    {/* Cards */}
                    {obrasFase.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 20, color: 'var(--sd-ink-3, #8A9BB0)', fontSize: 12, fontStyle: 'italic' }}>
                        Nenhuma obra
                      </div>
                    )}
                    {obrasFase.map(obra => {
                      const tipoConf = TIPOS_OBRA[obra.tipo]
                      const orcs = orcamentosPorObra[obra.id] || []
                      return (
                        <div key={obra.id} style={{ ...sCard, marginBottom: 8, cursor: 'default' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', lineHeight: 1.3 }}>{obra.titulo}</div>
                            <span style={{ fontSize: 11, background: conf.bg, color: conf.color, padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                              {tipoConf.emoji} {tipoConf.label}
                            </span>
                          </div>
                          <p style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', margin: '6px 0', lineHeight: 1.4 }}>
                            {obra.descricao.length > 80 ? obra.descricao.slice(0, 80) + '...' : obra.descricao}
                          </p>
                          <div style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', marginBottom: 4 }}>
                            🏢 {obra.imovel}
                          </div>
                          {obra.orcamentoAprovado && (
                            <div style={{ fontSize: 12, color: '#1A7A6E', fontWeight: 600 }}>
                              💰 Orçamento: {fmt(obra.orcamentoAprovado)} €
                            </div>
                          )}
                          {obra.artesaoSelecionado && (
                            <div style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)' }}>
                              👷 {obra.artesaoSelecionado}
                            </div>
                          )}
                          {obra.prazo && (
                            <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>
                              📅 Prazo: {new Date(obra.prazo).toLocaleDateString('pt-PT')}
                            </div>
                          )}
                          {/* Progress bar */}
                          {fase === 'em_execucao' && (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 4 }}>
                                <span>Progresso</span>
                                <span>{obra.progresso}%</span>
                              </div>
                              <div style={{ background: '#E4DDD0', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                                <div style={{ height: '100%', background: '#1A7A6E', borderRadius: 4, width: `${obra.progresso}%`, transition: 'width 0.3s' }} />
                              </div>
                            </div>
                          )}
                          {/* Orçamentos badge */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 600,
                              background: orcs.length >= 3 ? '#E6F4F2' : '#FDECEA',
                              color: orcs.length >= 3 ? '#1A7A6E' : '#C0392B',
                            }}>
                              📋 {orcs.length}/3 orçamentos
                            </span>
                            {orcs.length < 3 && obra.tipo !== 'urgente' && (
                              <span style={{ fontSize: 10, color: '#C0392B' }}>⚠️ Lei 8/2022</span>
                            )}
                            {obra.tipo === 'urgente' && (
                              <span style={{ fontSize: 10, color: '#D4830A', fontWeight: 600 }}>🚨 Exceção urgência</span>
                            )}
                          </div>
                          {/* Actions */}
                          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                            {fase === 'orcamentacao' && orcs.length >= 3 && (
                              <button onClick={() => { setObraComparacao(obra.id); setActiveTab('comparacao') }} style={{ ...sBtnSecondary, padding: '5px 10px', fontSize: 11 }}>
                                📊 Comparar
                              </button>
                            )}
                            {fase !== 'concluida' && (
                              <select
                                value={obra.fase}
                                onChange={e => mudarFase(obra.id, e.target.value as FaseObra)}
                                style={{ ...sInput, padding: '5px 8px', fontSize: 11, width: 'auto' }}
                              >
                                {FASES_PIPELINE.map(f => (
                                  <option key={f} value={f}>{FASES_CONFIG[f].emoji} {FASES_CONFIG[f].label}</option>
                                ))}
                              </select>
                            )}
                            <button onClick={() => eliminarObra(obra.id)} style={{ background: 'none', border: 'none', color: '#C0392B', fontSize: 11, cursor: 'pointer', padding: '5px' }}>
                              🗑️
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          TAB 2 — Comparao Oramentos
         ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'comparacao' && (
        <div>
          {/* Obra selector */}
          <div style={{ marginBottom: 20 }}>
            <label style={sLabel}>Selecionar Obra para Comparao</label>
            <select
              value={obraComparacao || ''}
              onChange={e => setObraComparacao(e.target.value || null)}
              style={{ ...sInput, maxWidth: 400 }}
            >
              <option value="">-- Selecione uma obra --</option>
              {obras.filter(o => (orcamentosPorObra[o.id] || []).length > 0).map(o => (
                <option key={o.id} value={o.id}>{o.titulo} ({(orcamentosPorObra[o.id] || []).length} orçamentos)</option>
              ))}
            </select>
          </div>

          {!obraComparacao && (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--sd-ink-3, #8A9BB0)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
              <p style={{ fontSize: 16 }}>Selecione uma obra para comparar oramentos</p>
              <p style={{ fontSize: 13 }}>Mnimo 3 oramentos obrigatrios Lei 8/2022</p>
            </div>
          )}

          {obraComparacao && (() => {
            const obra = obras.find(o => o.id === obraComparacao)
            if (!obra) return null
            const orcs = orcamentosPorObra[obra.id] || []
            const scored = calcularScores(orcs)
            const cheapest = orcs.length > 0 ? orcs.reduce((a, b) => a.valorTotal < b.valorTotal ? a : b) : null
            const fastest = orcs.length > 0 ? orcs.reduce((a, b) => a.prazoExecucao < b.prazoExecucao ? a : b) : null
            const bestValue = scored.length > 0 ? scored[0] : null

            return (
              <div>
                {/* Obra info */}
                <div style={{ ...sCard, marginBottom: 20, borderLeft: '4px solid var(--sd-gold, #C9A84C)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, color: 'var(--sd-navy, #0D1B2E)' }}>{obra.titulo}</h3>
                      <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', margin: '4px 0' }}>{obra.descricao}</p>
                      <div style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)' }}>
                        🏢 {obra.imovel} &middot; {TIPOS_OBRA[obra.tipo].emoji} {TIPOS_OBRA[obra.tipo].label} &middot; Estimado: {fmt(obra.valorEstimado)} €
                      </div>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10,
                      background: orcs.length >= 3 ? '#E6F4F2' : '#FDECEA',
                      color: orcs.length >= 3 ? '#1A7A6E' : '#C0392B',
                      fontWeight: 700, fontSize: 13,
                    }}>
                      {orcs.length >= 3 ? '✅' : '⚠️'} {orcs.length}/3 orçamentos
                    </div>
                  </div>
                </div>

                {/* Comparison table */}
                <div style={{ overflowX: 'auto', marginBottom: 20 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--sd-border, #E4DDD0)' }}>
                    <thead>
                      <tr style={{ background: 'var(--sd-navy, #0D1B2E)', color: '#fff' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Fornecedor</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600 }}>Valor Total</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>Prazo (dias)</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>Garantia</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>Materiais</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>IVA</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Cond. Pagamento</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>Score</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scored.map((orc, idx) => {
                        const isCheapest = cheapest && orc.id === cheapest.id
                        const isFastest = fastest && orc.id === fastest.id
                        const isBestValue = bestValue && orc.id === bestValue.id
                        return (
                          <tr key={orc.id} style={{
                            borderBottom: '1px solid var(--sd-border, #E4DDD0)',
                            background: idx === 0 ? 'rgba(201, 168, 76, 0.06)' : 'transparent',
                          }}>
                            <td style={{ padding: '12px 16px', fontSize: 13 }}>
                              <div style={{ fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{orc.fornecedor}</div>
                              <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                                {isCheapest && <span style={{ fontSize: 10, background: '#E6F4F2', color: '#1A7A6E', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>💰 Mais barato</span>}
                                {isFastest && <span style={{ fontSize: 10, background: '#EDE8FF', color: '#6C5CE7', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>⚡ Mais rpido</span>}
                                {isBestValue && <span style={{ fontSize: 10, background: 'rgba(201,168,76,0.15)', color: '#B8941F', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>🏆 Melhor relao qualidade-preo</span>}
                              </div>
                              <div style={{ marginTop: 4 }}>
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <span key={i} style={{ color: i < orc.reputacao ? '#C9A84C' : '#E4DDD0', fontSize: 12 }}>★</span>
                                ))}
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 700, color: isCheapest ? '#1A7A6E' : 'var(--sd-navy, #0D1B2E)' }}>
                              {fmt(orc.valorTotal)} €
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: isFastest ? 700 : 400, color: isFastest ? '#6C5CE7' : 'var(--sd-ink-2, #4A5E78)' }}>
                              {orc.prazoExecucao} dias
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)' }}>
                              {orc.garantiaMeses} meses
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 16 }}>
                              {orc.materiaisIncluidos ? '✅' : '❌'}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)' }}>
                              {orc.iva}%
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', maxWidth: 160 }}>
                              {orc.condicoesPagamento}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: 44, height: 44, borderRadius: '50%',
                                background: orc.score >= 80 ? '#E6F4F2' : orc.score >= 60 ? '#FEF5E4' : '#FDECEA',
                                color: orc.score >= 80 ? '#1A7A6E' : orc.score >= 60 ? '#D4830A' : '#C0392B',
                                fontWeight: 800, fontSize: 14,
                              }}>
                                {orc.score}
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <button
                                onClick={() => selecionarFornecedor(obra.id, orc)}
                                style={{ ...sBtn, padding: '6px 12px', fontSize: 11 }}
                              >
                                Selecionar
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Score breakdown */}
                <div style={{ ...sCard, borderLeft: '4px solid var(--sd-gold, #C9A84C)' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--sd-navy, #0D1B2E)' }}>📐 Critrios de Pontuao</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    {[
                      { label: 'Preço', peso: '40%', desc: 'Menor valor = melhor score', emoji: '💰' },
                      { label: 'Prazo', peso: '20%', desc: 'Menor prazo = melhor score', emoji: '⏱️' },
                      { label: 'Garantia', peso: '20%', desc: 'Maior garantia = melhor score', emoji: '🛡️' },
                      { label: 'Reputação', peso: '20%', desc: 'Classificação do fornecedor', emoji: '⭐' },
                    ].map((c, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 20 }}>{c.emoji}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)' }}>{c.label} ({c.peso})</div>
                          <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>{c.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {bestValue && (
                    <div style={{
                      marginTop: 16, padding: '12px 16px', borderRadius: 10,
                      background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      <span style={{ fontSize: 20 }}>🤖</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)' }}>
                          Recomendao IA: {bestValue.fornecedor}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)' }}>
                          Melhor relao qualidade-preo Score global: {bestValue.score}/100
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          TAB 3 — Arquivo
         ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'arquivo' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={sLabel}>Pesquisar</label>
              <input value={searchArquivo} onChange={e => setSearchArquivo(e.target.value)} style={{ ...sInput, width: 220 }} placeholder="Título ou imóvel..." />
            </div>
            <div>
              <label style={sLabel}>Ano</label>
              <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} style={{ ...sInput, width: 120 }}>
                <option value="todos">Todos</option>
                {anosUnicos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label style={sLabel}>Tipo</label>
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ ...sInput, width: 160 }}>
                <option value="todos">Todos</option>
                {Object.entries(TIPOS_OBRA).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={sLabel}>Imvel</label>
              <select value={filtroImovel} onChange={e => setFiltroImovel(e.target.value)} style={{ ...sInput, width: 220 }}>
                <option value="todos">Todos</option>
                {imoveisUnicos.map(im => <option key={im} value={im}>{im}</option>)}
              </select>
            </div>
          </div>

          {obrasArquivadasFiltradas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--sd-ink-3, #8A9BB0)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
              <p style={{ fontSize: 16 }}>Nenhuma obra arquivada</p>
              <p style={{ fontSize: 13 }}>As obras concludas aparecero aqui</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--sd-border, #E4DDD0)' }}>
                <thead>
                  <tr style={{ background: 'var(--sd-cream, #F7F4EE)' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-2, #4A5E78)' }}>Data</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-2, #4A5E78)' }}>Obra</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-2, #4A5E78)' }}>Tipo</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-2, #4A5E78)' }}>Imvel</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-2, #4A5E78)' }}>Fornecedor</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-2, #4A5E78)' }}>Valor</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-2, #4A5E78)' }}>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {obrasArquivadasFiltradas.map(obra => {
                    const tipoConf = TIPOS_OBRA[obra.tipo]
                    return (
                      <tr key={obra.id} style={{ borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>
                        <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)' }}>
                          {obra.dataArquivo ? new Date(obra.dataArquivo).toLocaleDateString('pt-PT') : new Date(obra.dataCriacao).toLocaleDateString('pt-PT')}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>
                          {obra.titulo}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 12 }}>
                          <span style={{ background: 'var(--sd-cream, #F7F4EE)', padding: '2px 8px', borderRadius: 6 }}>
                            {tipoConf.emoji} {tipoConf.label}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)' }}>
                          {obra.imovel}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)' }}>
                          {obra.fornecedorSelecionado || '-'}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>
                          {obra.valorFinal ? `${fmt(obra.valorFinal)} €` : obra.orcamentoAprovado ? `${fmt(obra.orcamentoAprovado)} €` : '-'}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)' }}>
                          {obra.resultado || 'Concluída'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          TAB 4 — Regras
         ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'regras' && (
        <div>
          {/* Legal info cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
            {/* Lei 8/2022 */}
            <div style={{ ...sCard, borderLeft: '4px solid var(--sd-gold, #C9A84C)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{
                  width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(201,168,76,0.12)', fontSize: 20,
                }}>📋</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)' }}>Lei 8/2022</div>
                  <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Regime da Propriedade Horizontal</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.6, margin: 0 }}>
                O administrador obrigado a obter, no mnimo, <strong>3 oramentos</strong> de diferentes fornecedores para obras e servios cujo valor ultrapasse o limite fixado em assembleia geral.
                Esta obrigao visa garantir transparncia e o melhor uso dos fundos do condomnio.
              </p>
            </div>

            {/* Seuil AG */}
            <div style={{ ...sCard, borderLeft: '4px solid #6C5CE7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{
                  width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(108,92,231,0.12)', fontSize: 20,
                }}>🗳️</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)' }}>Limiar de Concorrncia</div>
                  <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Fixado em Assembleia Geral</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.6, margin: 0 }}>
                A assembleia geral deve fixar o valor a partir do qual obrigatrio solicitar mltiplos oramentos.
                Acima deste limiar, o administrador deve apresentar pelo menos 3 propostas antes de qualquer contratao.
              </p>
            </div>

            {/* Art. 1436 CC */}
            <div style={{ ...sCard, borderLeft: '4px solid #1A7A6E' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{
                  width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(26,122,110,0.12)', fontSize: 20,
                }}>⚖️</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)' }}>Art. 1436. CC</div>
                  <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Deveres do Administrador</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.6, margin: 0 }}>
                O administrador deve agir com diligncia e no interesse do condomnio.
                Compete-lhe executar as deliberaes da assembleia, cobrar receitas, efetuar os pagamentos necessrios,
                e prestar contas  assembleia geral. A gesto deve ser prudente e transparente.
              </p>
            </div>

            {/* Obras urgentes */}
            <div style={{ ...sCard, borderLeft: '4px solid #C0392B' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{
                  width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(192,57,43,0.12)', fontSize: 20,
                }}>🚨</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)' }}>Obras Urgentes Exceo</div>
                  <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Art. 1427. CC</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.6, margin: 0 }}>
                Em caso de <strong>reparaes urgentes</strong> (risco para a segurana de pessoas ou bens),
                o administrador pode atuar sem aguardar deliberao da assembleia geral e sem o requisito dos 3 oramentos.
                Deve, no entanto, informar os condminos logo que possvel e justificar a urgncia.
              </p>
            </div>
          </div>

          {/* Configuration: seuil value */}
          <div style={{ ...sCard, borderLeft: '4px solid var(--sd-navy, #0D1B2E)', maxWidth: 500 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 15, color: 'var(--sd-navy, #0D1B2E)' }}>⚙️ Configurao do Limiar</h4>
            <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 16 }}>
              Defina o valor a partir do qual necessrio obter 3 oramentos (conforme deliberao da AG).
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ ...sLabel, marginBottom: 0, whiteSpace: 'nowrap' }}>Limiar ()</label>
              <input
                type="number"
                value={seuilValue}
                onChange={e => setSeuilValue(parseFloat(e.target.value) || 0)}
                style={{ ...sInput, maxWidth: 160 }}
                min={0}
                step={100}
              />
            </div>
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--sd-cream, #F7F4EE)', fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)' }}>
              Obras com valor estimado superior a <strong>{fmt(seuilValue)} €</strong> exigiro automaticamente 3 oramentos.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
