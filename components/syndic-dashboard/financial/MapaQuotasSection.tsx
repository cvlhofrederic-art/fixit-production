'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ModoCalculo = 'fixa' | 'area' | 'permilagem'
type EstadoQuota = 'em_dia' | 'atraso' | 'divida'
type TabId = 'mapa' | 'simulador' | 'cobrancas' | 'relatorio'
type EstadoEnvio = 'enviado' | 'por_enviar'

interface Fracao {
  id: string
  designacao: string        // Ex: "Fração A - R/C Esq."
  condomino: string
  permilagem: number        // 0–1000
  areaM2: number
  quotaMensal: number       // EUR
  fcrMensal: number         // EUR (Fundo Comum de Reserva)
  estado: EstadoQuota
  diasAtraso: number
  valorDivida: number
  email?: string
}

interface AvisoCobranca {
  id: string
  fracaoId: string
  trimestre: string         // "2026-T1", "2026-T2" etc.
  valor: number
  estado: EstadoEnvio
  dataEnvio?: string
  diasAtraso: number
  valorDivida: number
  jurosCalculados: number
  dataPrescricao: string    // +5 anos Art.º 310.º CC
}

interface DadosRelatorio {
  mes: string
  taxaCobranca: number      // 0–100%
}

interface Props {
  user: any
  userRole: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'mapa',       label: 'Mapa de Quotas',  icon: '📊' },
  { id: 'simulador',  label: 'Simulador',        icon: '🧮' },
  { id: 'cobrancas',  label: 'Cobranças',        icon: '📬' },
  { id: 'relatorio',  label: 'Relatório',        icon: '📈' },
]

const ESTADO_CONFIG: Record<EstadoQuota, { label: string; bg: string; color: string; dot: string }> = {
  em_dia: { label: 'Em dia',  bg: '#E6F4F2', color: '#1A7A6E', dot: '#1A7A6E' },
  atraso: { label: 'Atraso',  bg: '#FEF5E4', color: '#D4830A', dot: '#D4830A' },
  divida: { label: 'Dívida',  bg: '#FDECEA', color: '#C0392B', dot: '#C0392B' },
}

const TAXA_JUROS_LEGAL = 4.0 // Taxa legal portuguesa (%)

const formatEur = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)

const formatDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return s }
}

const formatPct = (n: number) => `${n.toFixed(1)}%`

// ─── Dados Demo ──────────────────────────────────────────────────────────────

function gerarFracoesDemo(): Fracao[] {
  const nomes = [
    'Ana Silva', 'Bruno Costa', 'Carla Ferreira', 'Daniel Oliveira',
    'Elena Santos', 'Francisco Rodrigues', 'Gabriela Almeida', 'Hugo Martins',
    'Isabel Pereira', 'João Sousa', 'Katia Lopes', 'Luís Carvalho',
  ]
  const designacoes = [
    'Fração A - R/C Esq.', 'Fração B - R/C Dto.', 'Fração C - 1.º Esq.',
    'Fração D - 1.º Dto.', 'Fração E - 2.º Esq.', 'Fração F - 2.º Dto.',
    'Fração G - 3.º Esq.', 'Fração H - 3.º Dto.', 'Fração I - 4.º Esq.',
    'Fração J - 4.º Dto.', 'Fração K - 5.º Esq.', 'Fração L - 5.º Dto.',
  ]
  const areas = [65, 72, 85, 90, 78, 95, 88, 70, 82, 75, 100, 80]
  const permilagems = [70, 75, 90, 95, 82, 100, 92, 73, 86, 78, 105, 54]
  const estados: EstadoQuota[] = ['em_dia', 'em_dia', 'em_dia', 'atraso', 'em_dia', 'em_dia', 'divida', 'em_dia', 'atraso', 'em_dia', 'em_dia', 'divida']
  const diasAtraso = [0, 0, 0, 45, 0, 0, 120, 0, 30, 0, 0, 180]
  const valorDivida = [0, 0, 0, 185, 0, 0, 1450, 0, 125, 0, 0, 2200]

  return nomes.map((nome, i) => ({
    id: `frac_${i + 1}`,
    designacao: designacoes[i],
    condomino: nome,
    permilagem: permilagems[i],
    areaM2: areas[i],
    quotaMensal: 0,
    fcrMensal: 0,
    estado: estados[i],
    diasAtraso: diasAtraso[i],
    valorDivida: valorDivida[i],
    email: `${nome.toLowerCase().replace(/ /g, '.')}@email.pt`,
  }))
}

function gerarAvisosDemo(fracoes: Fracao[]): AvisoCobranca[] {
  const trimestres = ['2026-T1', '2025-T4', '2025-T3', '2025-T2']
  const avisos: AvisoCobranca[] = []
  for (const frac of fracoes) {
    for (const tri of trimestres) {
      const totalMensal = frac.quotaMensal + frac.fcrMensal
      const valorTrimestral = totalMensal * 3
      const isRecente = tri === '2026-T1'
      const enviado = frac.estado === 'em_dia' || !isRecente
      avisos.push({
        id: `aviso_${frac.id}_${tri}`,
        fracaoId: frac.id,
        trimestre: tri,
        valor: valorTrimestral,
        estado: enviado ? 'enviado' : 'por_enviar',
        dataEnvio: enviado ? `${tri.split('-')[0]}-${tri === '2026-T1' ? '01' : tri === '2025-T4' ? '10' : tri === '2025-T3' ? '07' : '04'}-01` : undefined,
        diasAtraso: frac.diasAtraso,
        valorDivida: isRecente ? frac.valorDivida : 0,
        jurosCalculados: isRecente ? frac.valorDivida * (TAXA_JUROS_LEGAL / 100) * (frac.diasAtraso / 365) : 0,
        dataPrescricao: `${parseInt(tri.split('-')[0]) + 5}-${tri.includes('T1') ? '01' : tri.includes('T2') ? '04' : tri.includes('T3') ? '07' : '10'}-01`,
      })
    }
  }
  return avisos
}

function gerarRelatorioDemo(): DadosRelatorio[] {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const taxas = [92, 88, 95, 90, 87, 93, 91, 85, 94, 89, 96, 92]
  return meses.map((m, i) => ({ mes: m, taxaCobranca: taxas[i] }))
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function MapaQuotasSection({ user, userRole }: Props) {
  const uid = user?.id || 'demo'
  const STORAGE_KEY = `fixit_quotas_${uid}`

  // ── State principal
  const [activeTab, setActiveTab] = useState<TabId>('mapa')
  const [fracoes, setFracoes] = useState<Fracao[]>([])
  const [avisos, setAvisos] = useState<AvisoCobranca[]>([])
  const [orcamentoAnual, setOrcamentoAnual] = useState(48000)
  const [fcrPercent, setFcrPercent] = useState(10)
  const [modoCalculo, setModoCalculo] = useState<ModoCalculo>('permilagem')
  const [editingCell, setEditingCell] = useState<{ fracId: string; field: 'quotaMensal' } | null>(null)
  const [editValue, setEditValue] = useState('')

  // Simulador
  const [simOrcamento, setSimOrcamento] = useState(52000)
  const [simFcr, setSimFcr] = useState(10)

  // Cobranças
  const [filtroTrimestre, setFiltroTrimestre] = useState('2026-T1')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | EstadoEnvio>('todos')

  // Relatório
  const [relatorioData] = useState<DadosRelatorio[]>(gerarRelatorioDemo)

  // ── Persistência
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.fracoes?.length) {
          setFracoes(parsed.fracoes)
          setOrcamentoAnual(parsed.orcamentoAnual || 48000)
          setFcrPercent(parsed.fcrPercent || 10)
          setModoCalculo(parsed.modoCalculo || 'permilagem')
          if (parsed.avisos?.length) setAvisos(parsed.avisos)
          return
        }
      }
    } catch { /* ignore */ }
    // Gerar demo
    const demo = gerarFracoesDemo()
    setFracoes(demo)
  }, [])

  const save = useCallback((f: Fracao[], orc: number, fcr: number, modo: ModoCalculo, avs?: AvisoCobranca[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      fracoes: f,
      orcamentoAnual: orc,
      fcrPercent: fcr,
      modoCalculo: modo,
      avisos: avs || avisos,
    }))
  }, [STORAGE_KEY, avisos])

  // ── Recalcular quotas automaticamente
  const recalcular = useCallback((fracoesInput: Fracao[], orc: number, fcr: number, modo: ModoCalculo): Fracao[] => {
    const totalPermilagem = fracoesInput.reduce((s, f) => s + f.permilagem, 0)
    const totalArea = fracoesInput.reduce((s, f) => s + f.areaM2, 0)
    const orcamentoMensal = orc / 12
    const fcrMensalGlobal = (orc * (fcr / 100)) / 12

    return fracoesInput.map(f => {
      let quota = 0
      let fcrFrac = 0

      switch (modo) {
        case 'fixa':
          quota = orcamentoMensal / fracoesInput.length
          fcrFrac = fcrMensalGlobal / fracoesInput.length
          break
        case 'area':
          quota = totalArea > 0 ? (orcamentoMensal * f.areaM2) / totalArea : 0
          fcrFrac = totalArea > 0 ? (fcrMensalGlobal * f.areaM2) / totalArea : 0
          break
        case 'permilagem':
          quota = totalPermilagem > 0 ? (orcamentoMensal * f.permilagem) / totalPermilagem : 0
          fcrFrac = totalPermilagem > 0 ? (fcrMensalGlobal * f.permilagem) / totalPermilagem : 0
          break
      }

      return { ...f, quotaMensal: Math.round(quota * 100) / 100, fcrMensal: Math.round(fcrFrac * 100) / 100 }
    })
  }, [])

  // Recalc em cascata
  useEffect(() => {
    if (fracoes.length === 0) return
    const updated = recalcular(fracoes, orcamentoAnual, fcrPercent, modoCalculo)
    const changed = updated.some((f, i) => f.quotaMensal !== fracoes[i]?.quotaMensal || f.fcrMensal !== fracoes[i]?.fcrMensal)
    if (changed) {
      setFracoes(updated)
      save(updated, orcamentoAnual, fcrPercent, modoCalculo)
    }
  }, [orcamentoAnual, fcrPercent, modoCalculo])

  // Gerar avisos quando frações mudam
  useEffect(() => {
    if (fracoes.length > 0 && fracoes[0].quotaMensal > 0) {
      const avs = gerarAvisosDemo(fracoes)
      setAvisos(avs)
      save(fracoes, orcamentoAnual, fcrPercent, modoCalculo, avs)
    }
  }, [fracoes])

  // ── Stats computados
  const stats = useMemo(() => {
    const totalMensal = fracoes.reduce((s, f) => s + f.quotaMensal + f.fcrMensal, 0)
    const totalDivida = fracoes.reduce((s, f) => s + f.valorDivida, 0)
    const emDia = fracoes.filter(f => f.estado === 'em_dia').length
    const emAtraso = fracoes.filter(f => f.estado === 'atraso').length
    const emDivida = fracoes.filter(f => f.estado === 'divida').length
    const quotaMedia = fracoes.length > 0 ? fracoes.reduce((s, f) => s + f.quotaMensal, 0) / fracoes.length : 0
    const fcrTotal = fracoes.reduce((s, f) => s + f.fcrMensal, 0) * 12
    const taxaCobranca = fracoes.length > 0 ? (emDia / fracoes.length) * 100 : 0
    return { totalMensal, totalDivida, emDia, emAtraso, emDivida, quotaMedia, fcrTotal, taxaCobranca }
  }, [fracoes])

  // ── Simulação
  const simulacao = useMemo(() => {
    if (fracoes.length === 0) return []
    const simFracoes = recalcular(fracoes, simOrcamento, simFcr, modoCalculo)
    return fracoes.map((f, i) => {
      const quotaAtual = f.quotaMensal + f.fcrMensal
      const quotaSim = simFracoes[i].quotaMensal + simFracoes[i].fcrMensal
      const diff = quotaSim - quotaAtual
      const diffPct = quotaAtual > 0 ? (diff / quotaAtual) * 100 : 0
      return {
        ...f,
        quotaAtual,
        quotaSimulada: quotaSim,
        diferenca: diff,
        diferencaPct: diffPct,
      }
    })
  }, [fracoes, simOrcamento, simFcr, modoCalculo, recalcular])

  // ── Handlers
  const handleModoChange = (modo: ModoCalculo) => {
    setModoCalculo(modo)
    const updated = recalcular(fracoes, orcamentoAnual, fcrPercent, modo)
    setFracoes(updated)
    save(updated, orcamentoAnual, fcrPercent, modo)
  }

  const handleOrcamentoChange = (val: string) => {
    const num = parseFloat(val) || 0
    setOrcamentoAnual(num)
  }

  const handleFcrChange = (val: number) => {
    const clamped = Math.max(10, Math.min(50, val))
    setFcrPercent(clamped)
  }

  const handleInlineEdit = (fracId: string) => {
    setEditingCell({ fracId, field: 'quotaMensal' })
    const frac = fracoes.find(f => f.id === fracId)
    setEditValue(frac?.quotaMensal.toFixed(2) || '0')
  }

  const handleInlineSave = () => {
    if (!editingCell) return
    const val = parseFloat(editValue) || 0
    const updated = fracoes.map(f =>
      f.id === editingCell.fracId ? { ...f, quotaMensal: Math.round(val * 100) / 100 } : f
    )
    setFracoes(updated)
    save(updated, orcamentoAnual, fcrPercent, modoCalculo)
    setEditingCell(null)
  }

  const handleAprovarSimulacao = () => {
    setOrcamentoAnual(simOrcamento)
    setFcrPercent(simFcr)
    const updated = recalcular(fracoes, simOrcamento, simFcr, modoCalculo)
    setFracoes(updated)
    save(updated, simOrcamento, simFcr, modoCalculo)
    setActiveTab('mapa')
  }

  const handleEnviarAviso = (avisoId: string) => {
    const updated = avisos.map(a =>
      a.id === avisoId ? { ...a, estado: 'enviado' as EstadoEnvio, dataEnvio: new Date().toISOString().split('T')[0] } : a
    )
    setAvisos(updated)
    save(fracoes, orcamentoAnual, fcrPercent, modoCalculo, updated)
  }

  const handleEnviarTodos = () => {
    const updated = avisos.map(a =>
      a.trimestre === filtroTrimestre && a.estado === 'por_enviar'
        ? { ...a, estado: 'enviado' as EstadoEnvio, dataEnvio: new Date().toISOString().split('T')[0] }
        : a
    )
    setAvisos(updated)
    save(fracoes, orcamentoAnual, fcrPercent, modoCalculo, updated)
  }

  const handleExportCSV = () => {
    const header = 'Fração;Condómino;Quota Atual (€);Quota Simulada (€);Diferença (€);Diferença (%)\n'
    const rows = simulacao.map(s =>
      `${s.designacao};${s.condomino};${s.quotaAtual.toFixed(2)};${s.quotaSimulada.toFixed(2)};${s.diferenca.toFixed(2)};${s.diferencaPct.toFixed(1)}%`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `simulacao_quotas_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Cobranças filtradas
  const avisosFiltrados = useMemo(() => {
    return avisos.filter(a => {
      if (a.trimestre !== filtroTrimestre) return false
      if (filtroEstado !== 'todos' && a.estado !== filtroEstado) return false
      return true
    })
  }, [avisos, filtroTrimestre, filtroEstado])

  const porEnviar = avisosFiltrados.filter(a => a.estado === 'por_enviar').length

  // ── Relatório: devedores crónicos e aging
  const devedoresCronicos = useMemo(() =>
    fracoes.filter(f => f.valorDivida > 0).sort((a, b) => b.valorDivida - a.valorDivida),
    [fracoes]
  )

  const aging = useMemo(() => {
    const buckets = { '30': 0, '60': 0, '90': 0, '120+': 0 }
    for (const f of fracoes) {
      if (f.diasAtraso <= 0) continue
      if (f.diasAtraso <= 30) buckets['30'] += f.valorDivida
      else if (f.diasAtraso <= 60) buckets['60'] += f.valorDivida
      else if (f.diasAtraso <= 90) buckets['90'] += f.valorDivida
      else buckets['120+'] += f.valorDivida
    }
    return buckets
  }, [fracoes])

  // ── Dados comparativo ano anterior (mock)
  const taxaAnoAnterior = 88.5

  // ─── Estilos comuns ─────────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid var(--sd-border,#E4DDD0)',
    borderRadius: 12,
    padding: 20,
  }

  const thStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--sd-ink-3,#8A9BB0)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '10px 12px',
    textAlign: 'left',
    borderBottom: '2px solid var(--sd-border,#E4DDD0)',
    whiteSpace: 'nowrap',
  }

  const tdStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--sd-navy,#0D1B2E)',
    padding: '10px 12px',
    borderBottom: '1px solid var(--sd-border,#E4DDD0)',
    verticalAlign: 'middle',
  }

  const btnPrimary: React.CSSProperties = {
    background: 'var(--sd-gold,#C9A84C)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  }

  const btnSecondary: React.CSSProperties = {
    background: 'transparent',
    color: 'var(--sd-navy,#0D1B2E)',
    border: '1px solid var(--sd-border,#E4DDD0)',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  }

  const inputStyle: React.CSSProperties = {
    border: '1px solid var(--sd-border,#E4DDD0)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    color: 'var(--sd-navy,#0D1B2E)',
    background: '#fff',
    outline: 'none',
    width: '100%',
  }

  // ─── Render Tab Content ────────────────────────────────────────────────────

  const renderMapaQuotas = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        {[
          { icon: '💰', label: 'Orçamento anual', value: formatEur(orcamentoAnual), sub: `${formatEur(orcamentoAnual / 12)}/mês` },
          { icon: '🏦', label: 'FCR anual', value: formatEur(stats.fcrTotal), sub: `${fcrPercent}% (min. 10% DL 268/94)` },
          { icon: '📊', label: 'Quota média', value: formatEur(stats.quotaMedia), sub: `${fracoes.length} frações` },
          { icon: '📈', label: 'Taxa cobrança', value: formatPct(stats.taxaCobranca), sub: `${stats.emDia} em dia / ${stats.emAtraso + stats.emDivida} irregulares` },
        ].map((c, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{c.icon}</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: 'var(--sd-navy,#0D1B2E)', lineHeight: 1.1 }}>{c.value}</div>
            <div style={{ fontSize: 12, color: 'var(--sd-ink-2,#4A5E78)', marginTop: 4 }}>{c.label}</div>
            {c.sub && <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 2 }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* Controles */}
      <div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-2,#4A5E78)', display: 'block', marginBottom: 4 }}>
            Orçamento anual (EUR)
          </label>
          <input
            type="number"
            value={orcamentoAnual}
            onChange={e => handleOrcamentoChange(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-2,#4A5E78)', display: 'block', marginBottom: 4 }}>
            FCR ({fcrPercent}%)
          </label>
          <input
            type="range"
            min={10}
            max={50}
            value={fcrPercent}
            onChange={e => handleFcrChange(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--sd-gold,#C9A84C)' }}
          />
        </div>
        <div style={{ flex: '1 1 240px' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-2,#4A5E78)', display: 'block', marginBottom: 4 }}>
            Modo de cálculo
          </label>
          <div style={{ display: 'flex', gap: 4, background: 'var(--sd-cream,#F7F4EE)', borderRadius: 8, padding: 3 }}>
            {(['fixa', 'area', 'permilagem'] as ModoCalculo[]).map(modo => (
              <button
                key={modo}
                onClick={() => handleModoChange(modo)}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: modoCalculo === modo ? '#fff' : 'transparent',
                  color: modoCalculo === modo ? 'var(--sd-navy,#0D1B2E)' : 'var(--sd-ink-3,#8A9BB0)',
                  boxShadow: modoCalculo === modo ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {modo === 'fixa' ? 'Fixa' : modo === 'area' ? 'Por área (m²)' : 'Permilagem'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela principal */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
          <thead>
            <tr style={{ background: 'var(--sd-cream,#F7F4EE)' }}>
              <th style={thStyle}>Fração</th>
              <th style={thStyle}>Condómino</th>
              <th style={thStyle}>Permilagem</th>
              <th style={thStyle}>Área (m²)</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Quota mensal</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>FCR</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Total mensal</th>
              <th style={thStyle}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {fracoes.map(f => {
              const totalMensal = f.quotaMensal + f.fcrMensal
              const est = ESTADO_CONFIG[f.estado]
              const isEditing = editingCell?.fracId === f.id
              return (
                <tr key={f.id} style={{ transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--sd-cream,#F7F4EE)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{f.designacao}</td>
                  <td style={tdStyle}>{f.condomino}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{f.permilagem}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{f.areaM2}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <input
                          type="number"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleInlineSave(); if (e.key === 'Escape') setEditingCell(null) }}
                          autoFocus
                          style={{ ...inputStyle, width: 80, textAlign: 'right', padding: '4px 6px' }}
                        />
                        <button onClick={handleInlineSave} style={{ ...btnPrimary, padding: '4px 8px', fontSize: 11 }}>OK</button>
                      </div>
                    ) : (
                      <span
                        onClick={() => handleInlineEdit(f.id)}
                        style={{ cursor: 'pointer', borderBottom: '1px dashed var(--sd-ink-3,#8A9BB0)' }}
                        title="Clique para editar"
                      >
                        {formatEur(f.quotaMensal)}
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--sd-ink-2,#4A5E78)' }}>{formatEur(f.fcrMensal)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatEur(totalMensal)}</td>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                      background: est.bg, color: est.color,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: est.dot }} />
                      {est.label}
                    </span>
                    {f.diasAtraso > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 2 }}>
                        {f.diasAtraso}d atraso {f.valorDivida > 0 && `| ${formatEur(f.valorDivida)}`}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {/* Summary row */}
          <tfoot>
            <tr style={{ background: 'var(--sd-navy,#0D1B2E)' }}>
              <td colSpan={4} style={{ ...tdStyle, color: '#fff', fontWeight: 700, fontSize: 12, borderBottom: 'none' }}>
                TOTAL ({fracoes.length} frações)
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', color: '#fff', fontWeight: 600, borderBottom: 'none' }}>
                {formatEur(fracoes.reduce((s, f) => s + f.quotaMensal, 0))}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', color: 'rgba(255,255,255,0.7)', borderBottom: 'none' }}>
                {formatEur(fracoes.reduce((s, f) => s + f.fcrMensal, 0))}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--sd-gold,#C9A84C)', fontWeight: 700, borderBottom: 'none' }}>
                {formatEur(stats.totalMensal)}
              </td>
              <td style={{ ...tdStyle, borderBottom: 'none' }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
                  {stats.emDia} em dia
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )

  const renderSimulador = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Inputs simulação */}
      <div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 220px' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-2,#4A5E78)', display: 'block', marginBottom: 4 }}>
            Orçamento anual proposto (EUR)
          </label>
          <input
            type="number"
            value={simOrcamento}
            onChange={e => setSimOrcamento(parseFloat(e.target.value) || 0)}
            style={{ ...inputStyle, fontSize: 16, fontWeight: 600 }}
          />
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-2,#4A5E78)', display: 'block', marginBottom: 4 }}>
            FCR: {simFcr}% (min. 10%)
          </label>
          <input
            type="range"
            min={10}
            max={50}
            value={simFcr}
            onChange={e => setSimFcr(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--sd-gold,#C9A84C)' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleAprovarSimulacao} style={btnPrimary}>
            Aprovar e aplicar
          </button>
          <button onClick={handleExportCSV} style={btnSecondary}>
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Info comparação */}
      <div style={{
        ...cardStyle,
        background: 'var(--sd-cream,#F7F4EE)',
        display: 'flex', flexWrap: 'wrap', gap: 20,
      }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)', fontWeight: 600, textTransform: 'uppercase' }}>Orçamento atual</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: 'var(--sd-navy,#0D1B2E)' }}>{formatEur(orcamentoAnual)}</div>
        </div>
        <div style={{ fontSize: 28, color: 'var(--sd-ink-3,#8A9BB0)', alignSelf: 'center' }}>&rarr;</div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)', fontWeight: 600, textTransform: 'uppercase' }}>Orçamento proposto</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: 'var(--sd-gold,#C9A84C)' }}>{formatEur(simOrcamento)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)', fontWeight: 600, textTransform: 'uppercase' }}>Variação</div>
          <div style={{
            fontFamily: "'Playfair Display',serif", fontSize: 22,
            color: simOrcamento > orcamentoAnual ? '#C0392B' : simOrcamento < orcamentoAnual ? '#1A7A6E' : 'var(--sd-navy,#0D1B2E)',
          }}>
            {simOrcamento !== orcamentoAnual ? (simOrcamento > orcamentoAnual ? '+' : '') : ''}
            {formatEur(simOrcamento - orcamentoAnual)}
          </div>
        </div>
      </div>

      {/* Tabela comparativa */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr style={{ background: 'var(--sd-cream,#F7F4EE)' }}>
              <th style={thStyle}>Fração</th>
              <th style={thStyle}>Condómino</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Quota atual</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Quota simulada</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Diferença</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Variação</th>
            </tr>
          </thead>
          <tbody>
            {simulacao.map(s => {
              let rowBg = 'transparent'
              let tagColor = 'var(--sd-ink-2,#4A5E78)'
              if (s.diferencaPct > 15) { rowBg = '#FDECEA'; tagColor = '#C0392B' }
              else if (s.diferencaPct > 10) { rowBg = '#FEF5E4'; tagColor = '#D4830A' }
              else if (s.diferencaPct > 5) { rowBg = '#FFFBE6'; tagColor = '#B8860B' }
              else if (s.diferencaPct < -5) { rowBg = '#E6F4F2'; tagColor = '#1A7A6E' }

              return (
                <tr key={s.id} style={{ background: rowBg }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{s.designacao}</td>
                  <td style={tdStyle}>{s.condomino}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{formatEur(s.quotaAtual)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatEur(s.quotaSimulada)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: tagColor, fontWeight: 600 }}>
                    {s.diferenca >= 0 ? '+' : ''}{formatEur(s.diferenca)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                      background: s.diferencaPct > 15 ? '#FDECEA' : s.diferencaPct > 10 ? '#FEF5E4' : s.diferencaPct > 5 ? '#FFFBE6' : s.diferencaPct < -5 ? '#E6F4F2' : 'rgba(13,27,46,0.05)',
                      color: tagColor,
                    }}>
                      {s.diferencaPct >= 0 ? '+' : ''}{s.diferencaPct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderCobrancas = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Filtros e ações */}
      <div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--sd-ink-3,#8A9BB0)', display: 'block', marginBottom: 4 }}>Trimestre</label>
          <select
            value={filtroTrimestre}
            onChange={e => setFiltroTrimestre(e.target.value)}
            style={{ ...inputStyle, width: 140 }}
          >
            <option value="2026-T1">2026 - T1</option>
            <option value="2025-T4">2025 - T4</option>
            <option value="2025-T3">2025 - T3</option>
            <option value="2025-T2">2025 - T2</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--sd-ink-3,#8A9BB0)', display: 'block', marginBottom: 4 }}>Estado</label>
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value as 'todos' | EstadoEnvio)}
            style={{ ...inputStyle, width: 140 }}
          >
            <option value="todos">Todos</option>
            <option value="por_enviar">Por enviar</option>
            <option value="enviado">Enviado</option>
          </select>
        </div>
        <div style={{ flex: 1 }} />
        {porEnviar > 0 && (
          <button onClick={handleEnviarTodos} style={btnPrimary}>
            Enviar todos ({porEnviar})
          </button>
        )}
      </div>

      {/* Info legal */}
      <div style={{
        ...cardStyle,
        background: 'var(--sd-cream,#F7F4EE)',
        borderLeft: '4px solid var(--sd-gold,#C9A84C)',
        fontSize: 12, color: 'var(--sd-ink-2,#4A5E78)',
        lineHeight: 1.6,
      }}>
        <strong style={{ color: 'var(--sd-navy,#0D1B2E)' }}>Base legal:</strong> Art.o 1424.o do Código Civil — As quotas são exigíveis no 1.o dia de cada trimestre.
        Juros de mora à taxa legal ({TAXA_JUROS_LEGAL}%).
        Prescrição de 5 anos (Art.o 310.o CC).
      </div>

      {/* Tabela cobranças */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 750 }}>
          <thead>
            <tr style={{ background: 'var(--sd-cream,#F7F4EE)' }}>
              <th style={thStyle}>Fração</th>
              <th style={thStyle}>Condómino</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Valor trimestral</th>
              <th style={thStyle}>Estado</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Dias atraso</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Dívida</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Juros</th>
              <th style={thStyle}>Prescrição</th>
              <th style={thStyle}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {avisosFiltrados.map(a => {
              const frac = fracoes.find(f => f.id === a.fracaoId)
              if (!frac) return null
              const prescDias = Math.ceil((new Date(a.dataPrescricao).getTime() - Date.now()) / 86400000)
              return (
                <tr key={a.id}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{frac.designacao}</td>
                  <td style={tdStyle}>{frac.condomino}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{formatEur(a.valor)}</td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                      background: a.estado === 'enviado' ? '#E6F4F2' : '#FEF5E4',
                      color: a.estado === 'enviado' ? '#1A7A6E' : '#D4830A',
                    }}>
                      {a.estado === 'enviado' ? 'Enviado' : 'Por enviar'}
                    </span>
                    {a.dataEnvio && <div style={{ fontSize: 10, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 2 }}>{formatDate(a.dataEnvio)}</div>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: a.diasAtraso > 60 ? '#C0392B' : a.diasAtraso > 30 ? '#D4830A' : 'var(--sd-ink-2,#4A5E78)' }}>
                    {a.diasAtraso > 0 ? `${a.diasAtraso}d` : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: a.valorDivida > 0 ? 600 : 400, color: a.valorDivida > 0 ? '#C0392B' : 'var(--sd-ink-3,#8A9BB0)' }}>
                    {a.valorDivida > 0 ? formatEur(a.valorDivida) : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                    {a.jurosCalculados > 0 ? formatEur(a.jurosCalculados) : '—'}
                  </td>
                  <td style={tdStyle}>
                    {a.valorDivida > 0 ? (
                      <div style={{ fontSize: 11 }}>
                        <div style={{ color: prescDias < 365 ? '#C0392B' : 'var(--sd-ink-2,#4A5E78)' }}>
                          {prescDias > 0 ? `${Math.floor(prescDias / 365)}a ${Math.floor((prescDias % 365) / 30)}m` : 'Prescrita'}
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--sd-ink-3,#8A9BB0)' }}>{formatDate(a.dataPrescricao)}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td style={tdStyle}>
                    {a.estado === 'por_enviar' && (
                      <button
                        onClick={() => handleEnviarAviso(a.id)}
                        style={{ ...btnPrimary, padding: '4px 10px', fontSize: 11 }}
                      >
                        Enviar
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {avisosFiltrados.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--sd-ink-3,#8A9BB0)', fontSize: 13 }}>
            Nenhum aviso de cobrança para os filtros selecionados.
          </div>
        )}
      </div>
    </div>
  )

  const renderRelatorio = () => {
    const maxTaxa = Math.max(...relatorioData.map(d => d.taxaCobranca), 100)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Stats resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          {[
            { icon: '📈', label: 'Taxa cobrança média', value: formatPct(relatorioData.reduce((s, d) => s + d.taxaCobranca, 0) / relatorioData.length), color: '#1A7A6E' },
            { icon: '💸', label: 'Total dívida', value: formatEur(stats.totalDivida), color: '#C0392B' },
            { icon: '👥', label: 'Devedores', value: `${devedoresCronicos.length}`, color: '#D4830A' },
            { icon: '📊', label: 'vs. Ano anterior', value: formatPct(stats.taxaCobranca - taxaAnoAnterior), color: stats.taxaCobranca >= taxaAnoAnterior ? '#1A7A6E' : '#C0392B' },
          ].map((c, i) => (
            <div key={i} style={cardStyle}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>{c.icon}</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: c.color, lineHeight: 1.1 }}>{c.value}</div>
              <div style={{ fontSize: 12, color: 'var(--sd-ink-2,#4A5E78)', marginTop: 4 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Gráfico barras — Taxa cobrança por mês */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)', marginBottom: 16, fontFamily: "'Playfair Display',serif" }}>
            Taxa de cobrança mensal (%)
          </h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 180, paddingTop: 20, position: 'relative' }}>
            {/* Linhas guia */}
            {[100, 90, 80].map(line => (
              <div key={line} style={{
                position: 'absolute',
                left: 0, right: 0,
                bottom: `${(line / maxTaxa) * 100}%`,
                borderBottom: '1px dashed var(--sd-border,#E4DDD0)',
                fontSize: 9, color: 'var(--sd-ink-3,#8A9BB0)',
              }}>
                <span style={{ position: 'absolute', top: -6, left: -2 }}>{line}</span>
              </div>
            ))}
            {relatorioData.map((d, i) => {
              const barHeight = (d.taxaCobranca / maxTaxa) * 100
              const barColor = d.taxaCobranca >= 95 ? '#1A7A6E' : d.taxaCobranca >= 90 ? 'var(--sd-gold,#C9A84C)' : d.taxaCobranca >= 85 ? '#D4830A' : '#C0392B'
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: barColor }}>{d.taxaCobranca}%</div>
                  <div style={{
                    width: '100%', maxWidth: 36,
                    height: `${barHeight}%`,
                    background: barColor,
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.4s ease',
                    minHeight: 4,
                  }} />
                  <div style={{ fontSize: 10, color: 'var(--sd-ink-3,#8A9BB0)', fontWeight: 500 }}>{d.mes}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Aging analysis */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)', marginBottom: 16, fontFamily: "'Playfair Display',serif" }}>
            Análise de envelhecimento da dívida
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {([
              { label: '0–30 dias', key: '30', color: '#D4830A', bg: '#FEF5E4' },
              { label: '31–60 dias', key: '60', color: '#C0392B', bg: '#FDECEA' },
              { label: '61–90 dias', key: '90', color: '#8B0000', bg: '#FDE0E0' },
              { label: '120+ dias', key: '120+', color: '#4A0000', bg: '#F5CCCC' },
            ] as const).map(bucket => (
              <div key={bucket.key} style={{
                background: bucket.bg,
                borderRadius: 10,
                padding: 16,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: bucket.color, marginBottom: 4, textTransform: 'uppercase' }}>
                  {bucket.label}
                </div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: bucket.color, fontWeight: 700 }}>
                  {formatEur(aging[bucket.key])}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Devedores crónicos */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)', marginBottom: 16, fontFamily: "'Playfair Display',serif" }}>
            Devedores crónicos
          </h3>
          {devedoresCronicos.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--sd-ink-3,#8A9BB0)', fontSize: 13 }}>
              Nenhum devedor registado. Todas as frações estão em dia.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {devedoresCronicos.map((f, i) => {
                const maxDivida = devedoresCronicos[0]?.valorDivida || 1
                const barWidth = (f.valorDivida / maxDivida) * 100
                return (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: i === 0 ? '#C0392B' : i === 1 ? '#D4830A' : 'var(--sd-ink-3,#8A9BB0)',
                      color: '#fff', fontSize: 11, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ width: 140, fontSize: 13, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)' }}>
                      {f.condomino}
                    </div>
                    <div style={{ flex: 1, position: 'relative', height: 22, background: '#F7F4EE', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{
                        width: `${barWidth}%`,
                        height: '100%',
                        background: i === 0 ? '#C0392B' : i === 1 ? '#D4830A' : 'var(--sd-ink-3,#8A9BB0)',
                        borderRadius: 6,
                        transition: 'width 0.4s',
                        opacity: 0.7,
                      }} />
                      <span style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        fontSize: 11, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)',
                      }}>
                        {formatEur(f.valorDivida)}
                      </span>
                    </div>
                    <div style={{ width: 70, fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)', textAlign: 'right' }}>
                      {f.diasAtraso}d atraso
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Comparativo ano anterior */}
        <div style={{
          ...cardStyle,
          background: 'var(--sd-cream,#F7F4EE)',
          display: 'flex', flexWrap: 'wrap', gap: 30, alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--sd-ink-3,#8A9BB0)', textTransform: 'uppercase', marginBottom: 4 }}>
              Ano anterior
            </div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: 'var(--sd-ink-2,#4A5E78)' }}>
              {formatPct(taxaAnoAnterior)}
            </div>
          </div>
          <div style={{ fontSize: 28, color: 'var(--sd-ink-3,#8A9BB0)' }}>&rarr;</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--sd-ink-3,#8A9BB0)', textTransform: 'uppercase', marginBottom: 4 }}>
              Ano corrente
            </div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: 'var(--sd-navy,#0D1B2E)' }}>
              {formatPct(stats.taxaCobranca)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--sd-ink-3,#8A9BB0)', textTransform: 'uppercase', marginBottom: 4 }}>
              Evolução
            </div>
            <div style={{
              fontFamily: "'Playfair Display',serif", fontSize: 28,
              color: stats.taxaCobranca >= taxaAnoAnterior ? '#1A7A6E' : '#C0392B',
            }}>
              {stats.taxaCobranca >= taxaAnoAnterior ? '+' : ''}{formatPct(stats.taxaCobranca - taxaAnoAnterior)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render principal ──────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: 'var(--sd-navy,#0D1B2E)', margin: 0 }}>
            Mapa de Quotas
          </h2>
          <p style={{ fontSize: 13, color: 'var(--sd-ink-2,#4A5E78)', margin: '4px 0 0' }}>
            Gestão inteligente de quotas do condomínio
          </p>
        </div>
        {stats.totalDivida > 0 && (
          <div style={{
            background: '#FDECEA',
            border: '1px solid #F5B7B1',
            borderRadius: 10,
            padding: '8px 16px',
            fontSize: 13, fontWeight: 600, color: '#C0392B',
          }}>
            Dívida total: {formatEur(stats.totalDivida)}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 2,
        background: 'var(--sd-cream,#F7F4EE)',
        borderRadius: 10,
        padding: 3,
        overflow: 'auto',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              background: activeTab === tab.id ? '#fff' : 'transparent',
              color: activeTab === tab.id ? 'var(--sd-navy,#0D1B2E)' : 'var(--sd-ink-3,#8A9BB0)',
              boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'mapa' && renderMapaQuotas()}
      {activeTab === 'simulador' && renderSimulador()}
      {activeTab === 'cobrancas' && renderCobrancas()}
      {activeTab === 'relatorio' && renderRelatorio()}
    </div>
  )
}
