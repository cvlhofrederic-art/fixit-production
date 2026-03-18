'use client'

import React, { useState, useEffect, useMemo } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type EstadoReferencia = 'pago' | 'pendente' | 'expirado'
type EstadoReconciliacao = 'reconciliado' | 'parcial' | 'nao_identificado'
type MetodoPagamento = 'multibanco' | 'mbway' | 'transferencia' | 'debito_direto' | 'payshop'
type TabId = 'dashboard' | 'referencias_mb' | 'reconciliacao' | 'configuracao'

interface PagamentoRecebido {
  id: string
  condomino: string
  fracao: string
  valor: number
  metodo: MetodoPagamento
  data: string
}

interface ReferenciaMB {
  id: string
  condomino: string
  fracao: string
  entidade: string
  referencia: string
  valor: number
  estado: EstadoReferencia
  dataEmissao: string
  dataLimite: string
}

interface MandatoSEPA {
  id: string
  condomino: string
  fracao: string
  iban: string          // masked
  estado: 'ativo' | 'pendente' | 'cancelado'
  dataAssinatura: string
  referenciaMandato: string
}

interface PagamentoNaoIdentificado {
  id: string
  valor: number
  data: string
  origemBancaria: string
  estadoReconciliacao: EstadoReconciliacao
  condominoAtribuido?: string
  fracaoAtribuida?: string
}

interface ConfigPagamentos {
  metodosAtivos: Record<MetodoPagamento, boolean>
  entidadeMB: string
  diasLembreteAntes: number
  taxaJurosMora: number // percentagem
}

interface Props {
  user: any
  userRole: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const METODO_CONFIG: Record<MetodoPagamento, { emoji: string; label: string }> = {
  multibanco:     { emoji: '🏧', label: 'Multibanco' },
  mbway:          { emoji: '📱', label: 'MB Way' },
  transferencia:  { emoji: '🏦', label: 'Transferência' },
  debito_direto:  { emoji: '📋', label: 'Débito Direto' },
  payshop:        { emoji: '🏪', label: 'Payshop' },
}

const ESTADO_REF_CONFIG: Record<EstadoReferencia, { label: string; bg: string; color: string }> = {
  pago:      { label: 'Pago',      bg: '#E6F4F2', color: '#1A7A6E' },
  pendente:  { label: 'Pendente',  bg: '#FEF5E4', color: '#D4830A' },
  expirado:  { label: 'Expirado',  bg: '#FDECEA', color: '#C0392B' },
}

const ESTADO_MANDATO_CONFIG: Record<MandatoSEPA['estado'], { label: string; bg: string; color: string }> = {
  ativo:     { label: 'Ativo',     bg: '#E6F4F2', color: '#1A7A6E' },
  pendente:  { label: 'Pendente',  bg: '#FEF5E4', color: '#D4830A' },
  cancelado: { label: 'Cancelado', bg: '#FDECEA', color: '#C0392B' },
}

const ESTADO_RECONCILIACAO_CONFIG: Record<EstadoReconciliacao, { icon: string; label: string; bg: string; color: string }> = {
  reconciliado:     { icon: '\u2705', label: 'Reconciliado',     bg: '#E6F4F2', color: '#1A7A6E' },
  parcial:          { icon: '\u26A0\uFE0F', label: 'Parcial',           bg: '#FEF5E4', color: '#D4830A' },
  nao_identificado: { icon: '\u274C', label: 'N\u00E3o identificado', bg: '#FDECEA', color: '#C0392B' },
}

const TAB_CONFIG: { id: TabId; label: string; emoji: string }[] = [
  { id: 'dashboard',      label: 'Dashboard',          emoji: '📊' },
  { id: 'referencias_mb', label: 'Refer\u00EAncias MB', emoji: '🏧' },
  { id: 'reconciliacao',  label: 'Reconcilia\u00E7\u00E3o',   emoji: '🔄' },
  { id: 'configuracao',   label: 'Configura\u00E7\u00E3o',    emoji: '⚙️' },
]

// ─── Demo Data ───────────────────────────────────────────────────────────────

function generateDemoData(userId: string) {
  const pagamentos: PagamentoRecebido[] = [
    { id: 'p1', condomino: 'Ana Silva', fracao: 'A-1.ºEsq', valor: 185.00, metodo: 'multibanco', data: '2026-03-10' },
    { id: 'p2', condomino: 'Carlos Mendes', fracao: 'B-2.ºDto', valor: 210.50, metodo: 'mbway', data: '2026-03-09' },
    { id: 'p3', condomino: 'Beatriz Costa', fracao: 'A-R/C', valor: 150.00, metodo: 'transferencia', data: '2026-03-08' },
    { id: 'p4', condomino: 'Diogo Ferreira', fracao: 'C-3.ºEsq', valor: 195.75, metodo: 'debito_direto', data: '2026-03-07' },
    { id: 'p5', condomino: 'Eva Rodrigues', fracao: 'B-1.ºEsq', valor: 175.00, metodo: 'multibanco', data: '2026-03-06' },
    { id: 'p6', condomino: 'F\u00E1bio Santos', fracao: 'A-3.ºDto', valor: 220.00, metodo: 'transferencia', data: '2026-03-05' },
    { id: 'p7', condomino: 'Gra\u00E7a Oliveira', fracao: 'C-1.ºDto', valor: 185.00, metodo: 'multibanco', data: '2026-03-04' },
    { id: 'p8', condomino: 'Hugo Pereira', fracao: 'B-3.ºEsq', valor: 200.00, metodo: 'mbway', data: '2026-03-03' },
    { id: 'p9', condomino: 'In\u00EAs Almeida', fracao: 'A-2.ºDto', valor: 185.00, metodo: 'multibanco', data: '2026-03-02' },
    { id: 'p10', condomino: 'Jo\u00E3o Martins', fracao: 'C-2.ºEsq', valor: 190.00, metodo: 'debito_direto', data: '2026-03-01' },
  ]

  const referencias: ReferenciaMB[] = [
    { id: 'r1', condomino: 'Ana Silva', fracao: 'A-1.\u00BAEsq', entidade: '21312', referencia: '123 456 789', valor: 185.00, estado: 'pago', dataEmissao: '2026-02-15', dataLimite: '2026-03-15' },
    { id: 'r2', condomino: 'Carlos Mendes', fracao: 'B-2.\u00BADto', entidade: '21312', referencia: '234 567 890', valor: 210.50, estado: 'pago', dataEmissao: '2026-02-15', dataLimite: '2026-03-15' },
    { id: 'r3', condomino: 'Beatriz Costa', fracao: 'A-R/C', entidade: '21312', referencia: '345 678 901', valor: 150.00, estado: 'pendente', dataEmissao: '2026-02-15', dataLimite: '2026-03-15' },
    { id: 'r4', condomino: 'Diogo Ferreira', fracao: 'C-3.\u00BAEsq', entidade: '21312', referencia: '456 789 012', valor: 195.75, estado: 'pendente', dataEmissao: '2026-02-15', dataLimite: '2026-03-15' },
    { id: 'r5', condomino: 'Eva Rodrigues', fracao: 'B-1.\u00BAEsq', entidade: '21312', referencia: '567 890 123', valor: 175.00, estado: 'expirado', dataEmissao: '2026-01-15', dataLimite: '2026-02-15' },
    { id: 'r6', condomino: 'F\u00E1bio Santos', fracao: 'A-3.\u00BADto', entidade: '21312', referencia: '678 901 234', valor: 220.00, estado: 'pendente', dataEmissao: '2026-02-15', dataLimite: '2026-03-15' },
    { id: 'r7', condomino: 'Gra\u00E7a Oliveira', fracao: 'C-1.\u00BADto', entidade: '21312', referencia: '789 012 345', valor: 185.00, estado: 'pago', dataEmissao: '2026-02-15', dataLimite: '2026-03-15' },
    { id: 'r8', condomino: 'Hugo Pereira', fracao: 'B-3.\u00BAEsq', entidade: '21312', referencia: '890 123 456', valor: 200.00, estado: 'pendente', dataEmissao: '2026-02-15', dataLimite: '2026-03-15' },
  ]

  const mandatos: MandatoSEPA[] = [
    { id: 'm1', condomino: 'Diogo Ferreira', fracao: 'C-3.\u00BAEsq', iban: 'PT50 **** **** **** **** 4523', estado: 'ativo', dataAssinatura: '2025-06-01', referenciaMandato: 'MAND-2025-001' },
    { id: 'm2', condomino: 'Jo\u00E3o Martins', fracao: 'C-2.\u00BAEsq', iban: 'PT50 **** **** **** **** 7891', estado: 'ativo', dataAssinatura: '2025-07-15', referenciaMandato: 'MAND-2025-002' },
    { id: 'm3', condomino: 'Ana Silva', fracao: 'A-1.\u00BAEsq', iban: 'PT50 **** **** **** **** 1234', estado: 'pendente', dataAssinatura: '', referenciaMandato: 'MAND-2026-003' },
  ]

  const naoIdentificados: PagamentoNaoIdentificado[] = [
    { id: 'ni1', valor: 185.00, data: '2026-03-08', origemBancaria: 'TRF PT50****1234', estadoReconciliacao: 'nao_identificado' },
    { id: 'ni2', valor: 95.00, data: '2026-03-06', origemBancaria: 'TRF PT50****5678', estadoReconciliacao: 'parcial', condominoAtribuido: 'Eva Rodrigues', fracaoAtribuida: 'B-1.\u00BAEsq' },
    { id: 'ni3', valor: 210.50, data: '2026-03-04', origemBancaria: 'MB REF 234567890', estadoReconciliacao: 'reconciliado', condominoAtribuido: 'Carlos Mendes', fracaoAtribuida: 'B-2.\u00BADto' },
  ]

  const config: ConfigPagamentos = {
    metodosAtivos: {
      multibanco: true,
      mbway: true,
      transferencia: true,
      debito_direto: true,
      payshop: false,
    },
    entidadeMB: '21312',
    diasLembreteAntes: 5,
    taxaJurosMora: 4.0,
  }

  return { pagamentos, referencias, mandatos, naoIdentificados, config }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function PagamentosDigitaisSection({ user, userRole }: Props) {
  // ── State
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [pagamentos, setPagamentos] = useState<PagamentoRecebido[]>([])
  const [referencias, setReferencias] = useState<ReferenciaMB[]>([])
  const [mandatos, setMandatos] = useState<MandatoSEPA[]>([])
  const [naoIdentificados, setNaoIdentificados] = useState<PagamentoNaoIdentificado[]>([])
  const [config, setConfig] = useState<ConfigPagamentos>({
    metodosAtivos: { multibanco: true, mbway: true, transferencia: true, debito_direto: true, payshop: false },
    entidadeMB: '21312',
    diasLembreteAntes: 5,
    taxaJurosMora: 4.0,
  })

  // ── MB Way form
  const [mbwayTelefone, setMbwayTelefone] = useState('')
  const [mbwayValor, setMbwayValor] = useState('')
  const [mbwayCondomino, setMbwayCondomino] = useState('')

  // ── Storage
  const STORAGE_KEY = `fixit_pagamentos_${user.id}`

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        if (data.pagamentos) setPagamentos(data.pagamentos)
        if (data.referencias) setReferencias(data.referencias)
        if (data.mandatos) setMandatos(data.mandatos)
        if (data.naoIdentificados) setNaoIdentificados(data.naoIdentificados)
        if (data.config) setConfig(data.config)
      } else {
        // Load demo data on first visit
        const demo = generateDemoData(user.id)
        setPagamentos(demo.pagamentos)
        setReferencias(demo.referencias)
        setMandatos(demo.mandatos)
        setNaoIdentificados(demo.naoIdentificados)
        setConfig(demo.config)
      }
    } catch { /* ignore */ }
  }, [])

  // Persist all data to localStorage
  useEffect(() => {
    const data = { pagamentos, referencias, mandatos, naoIdentificados, config }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [pagamentos, referencias, mandatos, naoIdentificados, config])

  // ── Computed stats
  const stats = useMemo(() => {
    const now = new Date()
    const mesAtual = now.getMonth()
    const anoAtual = now.getFullYear()

    const pagamentosMes = pagamentos.filter(p => {
      const d = new Date(p.data)
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual
    })
    const totalCobrado = pagamentosMes.reduce((s, p) => s + p.valor, 0)

    const pendentes = referencias.filter(r => r.estado === 'pendente')
    const totalPendente = pendentes.reduce((s, r) => s + r.valor, 0)
    const totalEsperado = totalCobrado + totalPendente
    const taxaCobranca = totalEsperado > 0 ? (totalCobrado / totalEsperado) * 100 : 0

    // Average delay: for expired references, calculate days past limit
    const expiradas = referencias.filter(r => r.estado === 'expirado')
    let atrasoMedio = 0
    if (expiradas.length > 0) {
      const totalDias = expiradas.reduce((s, r) => {
        const diff = (now.getTime() - new Date(r.dataLimite).getTime()) / (1000 * 86400)
        return s + Math.max(0, diff)
      }, 0)
      atrasoMedio = Math.round(totalDias / expiradas.length)
    }

    return { totalCobrado, totalPendente, taxaCobranca, atrasoMedio, pendentes: pendentes.length }
  }, [pagamentos, referencias])

  // ── Helpers
  const formatEUR = (v: number) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
  const formatDate = (d: string) => {
    if (!d) return '---'
    return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // ── Actions
  const handleGerarTodasReferencias = () => {
    // Simulate generating new references for fractions without pending ones
    const existingFracoes = new Set(referencias.filter(r => r.estado === 'pendente').map(r => r.fracao))
    const newRefs: ReferenciaMB[] = []
    const condominosDemo = [
      { condomino: 'In\u00EAs Almeida', fracao: 'A-2.\u00BADto', valor: 185.00 },
      { condomino: 'Jo\u00E3o Martins', fracao: 'C-2.\u00BAEsq', valor: 190.00 },
    ]
    for (const c of condominosDemo) {
      if (!existingFracoes.has(c.fracao)) {
        newRefs.push({
          id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          condomino: c.condomino,
          fracao: c.fracao,
          entidade: config.entidadeMB,
          referencia: `${Math.floor(100 + Math.random() * 900)} ${Math.floor(100 + Math.random() * 900)} ${Math.floor(100 + Math.random() * 900)}`,
          valor: c.valor,
          estado: 'pendente',
          dataEmissao: new Date().toISOString().slice(0, 10),
          dataLimite: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        })
      }
    }
    if (newRefs.length > 0) {
      setReferencias(prev => [...prev, ...newRefs])
    }
  }

  const handleReconciliarAuto = () => {
    setNaoIdentificados(prev => prev.map(ni => {
      if (ni.estadoReconciliacao === 'nao_identificado') {
        // Try to find a matching pending reference by value
        const match = referencias.find(r => r.estado === 'pendente' && Math.abs(r.valor - ni.valor) < 0.01)
        if (match) {
          // Mark reference as paid
          setReferencias(refs => refs.map(r => r.id === match.id ? { ...r, estado: 'pago' as EstadoReferencia } : r))
          return { ...ni, estadoReconciliacao: 'reconciliado' as EstadoReconciliacao, condominoAtribuido: match.condomino, fracaoAtribuida: match.fracao }
        }
      }
      return ni
    }))
  }

  const handleMBWayEnviar = () => {
    if (!mbwayTelefone || !mbwayValor || !mbwayCondomino) return
    // Simulate MB Way payment request
    const novoPagamento: PagamentoRecebido = {
      id: `p_${Date.now()}`,
      condomino: mbwayCondomino,
      fracao: '---',
      valor: parseFloat(mbwayValor),
      metodo: 'mbway',
      data: new Date().toISOString().slice(0, 10),
    }
    setPagamentos(prev => [novoPagamento, ...prev])
    setMbwayTelefone('')
    setMbwayValor('')
    setMbwayCondomino('')
  }

  const handleToggleMetodo = (metodo: MetodoPagamento) => {
    setConfig(prev => ({
      ...prev,
      metodosAtivos: { ...prev.metodosAtivos, [metodo]: !prev.metodosAtivos[metodo] },
    }))
  }

  // ── Shared styles
  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid var(--sd-border, #E4DDD0)',
    borderRadius: 12,
    padding: 20,
  }

  const headingStyle: React.CSSProperties = {
    fontFamily: "'Playfair Display', serif",
    color: 'var(--sd-navy, #0D1B2E)',
    margin: 0,
  }

  const tableHeaderStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--sd-ink-3, #8A9BB0)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    padding: '10px 12px',
    borderBottom: '1px solid var(--sd-border, #E4DDD0)',
    textAlign: 'left' as const,
  }

  const tableCellStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--sd-navy, #0D1B2E)',
    padding: '10px 12px',
    borderBottom: '1px solid var(--sd-border, #E4DDD0)',
  }

  const btnPrimary: React.CSSProperties = {
    background: 'var(--sd-gold, #C9A84C)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  }

  const btnSecondary: React.CSSProperties = {
    background: 'transparent',
    color: 'var(--sd-navy, #0D1B2E)',
    border: '1px solid var(--sd-border, #E4DDD0)',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid var(--sd-border, #E4DDD0)',
    borderRadius: 8,
    fontSize: 14,
    color: 'var(--sd-navy, #0D1B2E)',
    background: '#fff',
    outline: 'none',
    fontFamily: "'Outfit', sans-serif",
  }

  // ── Render badge
  const renderEstadoBadge = (estado: EstadoReferencia) => {
    const cfg = ESTADO_REF_CONFIG[estado]
    return (
      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: cfg.bg, color: cfg.color }}>
        {cfg.label}
      </span>
    )
  }

  // ─── Tab: Dashboard ──────────────────────────────────────────────────────────

  const renderDashboard = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {/* Total cobrado */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(201,168,76,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            💰
          </div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: 'var(--sd-navy, #0D1B2E)', lineHeight: 1 }}>
              {formatEUR(stats.totalCobrado)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', marginTop: 4 }}>Total cobrado este m\u00EAs</div>
          </div>
        </div>

        {/* Pagamentos pendentes */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: '#FEF5E4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            ⏳
          </div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: 'var(--sd-navy, #0D1B2E)', lineHeight: 1 }}>
              {stats.pendentes}
            </div>
            <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', marginTop: 4 }}>Pagamentos pendentes</div>
            <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 2 }}>{formatEUR(stats.totalPendente)}</div>
          </div>
        </div>

        {/* Taxa de cobranca */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: '#E6F4F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            📈
          </div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: 'var(--sd-navy, #0D1B2E)', lineHeight: 1 }}>
              {stats.taxaCobranca.toFixed(1)}%
            </div>
            <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', marginTop: 4 }}>Taxa de cobran\u00E7a</div>
          </div>
        </div>

        {/* Atraso medio */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: '#FDECEA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            📅
          </div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: 'var(--sd-navy, #0D1B2E)', lineHeight: 1 }}>
              {stats.atrasoMedio}
            </div>
            <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', marginTop: 4 }}>Atraso m\u00E9dio (dias)</div>
          </div>
        </div>
      </div>

      {/* Chart: Cobrado vs Pendente */}
      <div style={cardStyle}>
        <h4 style={{ ...headingStyle, fontSize: 16, marginBottom: 16 }}>Cobrado vs Pendente</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Cobrado bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)' }}>Cobrado</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{formatEUR(stats.totalCobrado)}</span>
            </div>
            <div style={{ width: '100%', height: 28, background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${stats.totalCobrado + stats.totalPendente > 0 ? (stats.totalCobrado / (stats.totalCobrado + stats.totalPendente)) * 100 : 0}%`,
                  height: '100%',
                  background: 'linear-gradient(135deg, #1A7A6E, #22A699)',
                  borderRadius: 8,
                  transition: 'width 0.6s ease',
                  minWidth: stats.totalCobrado > 0 ? 20 : 0,
                }}
              />
            </div>
          </div>

          {/* Pendente bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)' }}>Pendente</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{formatEUR(stats.totalPendente)}</span>
            </div>
            <div style={{ width: '100%', height: 28, background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${stats.totalCobrado + stats.totalPendente > 0 ? (stats.totalPendente / (stats.totalCobrado + stats.totalPendente)) * 100 : 0}%`,
                  height: '100%',
                  background: 'linear-gradient(135deg, #D4830A, #F5A623)',
                  borderRadius: 8,
                  transition: 'width 0.6s ease',
                  minWidth: stats.totalPendente > 0 ? 20 : 0,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Last 10 payments */}
      <div style={cardStyle}>
        <h4 style={{ ...headingStyle, fontSize: 16, marginBottom: 16 }}>\u00DAltimos 10 pagamentos recebidos</h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Cond\u00F3mino</th>
                <th style={tableHeaderStyle}>Fra\u00E7\u00E3o</th>
                <th style={tableHeaderStyle}>Valor</th>
                <th style={tableHeaderStyle}>M\u00E9todo</th>
                <th style={tableHeaderStyle}>Data</th>
              </tr>
            </thead>
            <tbody>
              {pagamentos.slice(0, 10).map(p => (
                <tr key={p.id} style={{ transition: 'background 0.15s' }}>
                  <td style={tableCellStyle}>
                    <span style={{ fontWeight: 500 }}>{p.condomino}</span>
                  </td>
                  <td style={tableCellStyle}>{p.fracao}</td>
                  <td style={{ ...tableCellStyle, fontWeight: 600, color: '#1A7A6E' }}>{formatEUR(p.valor)}</td>
                  <td style={tableCellStyle}>
                    <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 5, background: 'var(--sd-cream, #F7F4EE)', color: 'var(--sd-ink-2, #4A5E78)' }}>
                      {METODO_CONFIG[p.metodo]?.emoji} {METODO_CONFIG[p.metodo]?.label}
                    </span>
                  </td>
                  <td style={{ ...tableCellStyle, color: 'var(--sd-ink-3, #8A9BB0)' }}>{formatDate(p.data)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagamentos.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--sd-ink-3, #8A9BB0)', fontSize: 14 }}>
              Nenhum pagamento registado.
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ─── Tab: Refer\u00EAncias MB ───────────────────────────────────────────────────

  const renderReferenciasMB = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header with generate button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h4 style={{ ...headingStyle, fontSize: 18 }}>Refer\u00EAncias Multibanco</h4>
        <button style={btnPrimary} onClick={handleGerarTodasReferencias}>
          + Gerar refer\u00EAncias para todas as fra\u00E7\u00F5es
        </button>
      </div>

      {/* References table */}
      <div style={cardStyle}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Cond\u00F3mino</th>
                <th style={tableHeaderStyle}>Fra\u00E7\u00E3o</th>
                <th style={tableHeaderStyle}>Entidade</th>
                <th style={tableHeaderStyle}>Refer\u00EAncia</th>
                <th style={tableHeaderStyle}>Valor</th>
                <th style={tableHeaderStyle}>Estado</th>
                <th style={tableHeaderStyle}>Data Limite</th>
              </tr>
            </thead>
            <tbody>
              {referencias.map(r => (
                <tr key={r.id}>
                  <td style={tableCellStyle}><span style={{ fontWeight: 500 }}>{r.condomino}</span></td>
                  <td style={tableCellStyle}>{r.fracao}</td>
                  <td style={{ ...tableCellStyle, fontFamily: 'monospace', fontSize: 13 }}>{r.entidade}</td>
                  <td style={{ ...tableCellStyle, fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>{r.referencia}</td>
                  <td style={{ ...tableCellStyle, fontWeight: 600 }}>{formatEUR(r.valor)}</td>
                  <td style={tableCellStyle}>{renderEstadoBadge(r.estado)}</td>
                  <td style={{ ...tableCellStyle, color: 'var(--sd-ink-3, #8A9BB0)' }}>{formatDate(r.dataLimite)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {referencias.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--sd-ink-3, #8A9BB0)', fontSize: 14 }}>
              Nenhuma refer\u00EAncia gerada.
            </div>
          )}
        </div>
      </div>

      {/* MB Way Section */}
      <div style={cardStyle}>
        <h4 style={{ ...headingStyle, fontSize: 16, marginBottom: 4 }}>📱 MB Way</h4>
        <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', margin: '0 0 16px' }}>
          Enviar pedido de pagamento por MB Way
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', fontWeight: 500, marginBottom: 4, display: 'block' }}>Cond\u00F3mino</label>
            <input
              style={inputStyle}
              placeholder="Nome do cond\u00F3mino"
              value={mbwayCondomino}
              onChange={e => setMbwayCondomino(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', fontWeight: 500, marginBottom: 4, display: 'block' }}>Telefone</label>
            <input
              style={inputStyle}
              placeholder="9XX XXX XXX"
              value={mbwayTelefone}
              onChange={e => setMbwayTelefone(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', fontWeight: 500, marginBottom: 4, display: 'block' }}>Valor</label>
            <input
              style={inputStyle}
              type="number"
              step="0.01"
              placeholder="0.00"
              value={mbwayValor}
              onChange={e => setMbwayValor(e.target.value)}
            />
          </div>
        </div>
        <button
          style={{ ...btnPrimary, opacity: (!mbwayTelefone || !mbwayValor || !mbwayCondomino) ? 0.5 : 1 }}
          disabled={!mbwayTelefone || !mbwayValor || !mbwayCondomino}
          onClick={handleMBWayEnviar}
        >
          Enviar pedido MB Way
        </button>
      </div>

      {/* SEPA Direct Debit */}
      <div style={cardStyle}>
        <h4 style={{ ...headingStyle, fontSize: 16, marginBottom: 4 }}>📋 D\u00E9bito Direto SEPA</h4>
        <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', margin: '0 0 16px' }}>
          Mandatos de d\u00E9bito direto ativos
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Cond\u00F3mino</th>
                <th style={tableHeaderStyle}>Fra\u00E7\u00E3o</th>
                <th style={tableHeaderStyle}>IBAN</th>
                <th style={tableHeaderStyle}>Mandato</th>
                <th style={tableHeaderStyle}>Estado</th>
                <th style={tableHeaderStyle}>Assinatura</th>
              </tr>
            </thead>
            <tbody>
              {mandatos.map(m => {
                const mcfg = ESTADO_MANDATO_CONFIG[m.estado]
                return (
                  <tr key={m.id}>
                    <td style={tableCellStyle}><span style={{ fontWeight: 500 }}>{m.condomino}</span></td>
                    <td style={tableCellStyle}>{m.fracao}</td>
                    <td style={{ ...tableCellStyle, fontFamily: 'monospace', fontSize: 12 }}>{m.iban}</td>
                    <td style={{ ...tableCellStyle, fontSize: 12, fontFamily: 'monospace' }}>{m.referenciaMandato}</td>
                    <td style={tableCellStyle}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: mcfg.bg, color: mcfg.color }}>
                        {mcfg.label}
                      </span>
                    </td>
                    <td style={{ ...tableCellStyle, color: 'var(--sd-ink-3, #8A9BB0)' }}>{m.dataAssinatura ? formatDate(m.dataAssinatura) : '---'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {mandatos.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--sd-ink-3, #8A9BB0)', fontSize: 14 }}>
              Nenhum mandato registado.
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ─── Tab: Reconcilia\u00E7\u00E3o ────────────────────────────────────────────────────

  const renderReconciliacao = () => {
    const reconciliados = naoIdentificados.filter(n => n.estadoReconciliacao === 'reconciliado').length
    const parciais = naoIdentificados.filter(n => n.estadoReconciliacao === 'parcial').length
    const naoId = naoIdentificados.filter(n => n.estadoReconciliacao === 'nao_identificado').length

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#E6F4F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
              {'\u2705'}
            </div>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: 'var(--sd-navy, #0D1B2E)' }}>{reconciliados}</div>
              <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>Reconciliados</div>
            </div>
          </div>
          <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#FEF5E4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
              {'\u26A0\uFE0F'}
            </div>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: 'var(--sd-navy, #0D1B2E)' }}>{parciais}</div>
              <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>Parciais</div>
            </div>
          </div>
          <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#FDECEA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
              {'\u274C'}
            </div>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: 'var(--sd-navy, #0D1B2E)' }}>{naoId}</div>
              <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>N\u00E3o identificados</div>
            </div>
          </div>
        </div>

        {/* Auto reconcile button */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={btnPrimary} onClick={handleReconciliarAuto}>
            🔄 Reconciliar automaticamente
          </button>
        </div>

        {/* Payments to reconcile */}
        <div style={cardStyle}>
          <h4 style={{ ...headingStyle, fontSize: 16, marginBottom: 16 }}>Pagamentos recebidos</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Valor</th>
                  <th style={tableHeaderStyle}>Data</th>
                  <th style={tableHeaderStyle}>Origem Banc\u00E1ria</th>
                  <th style={tableHeaderStyle}>Estado</th>
                  <th style={tableHeaderStyle}>Cond\u00F3mino</th>
                  <th style={tableHeaderStyle}>Fra\u00E7\u00E3o</th>
                </tr>
              </thead>
              <tbody>
                {naoIdentificados.map(ni => {
                  const ecfg = ESTADO_RECONCILIACAO_CONFIG[ni.estadoReconciliacao]
                  return (
                    <tr key={ni.id}>
                      <td style={{ ...tableCellStyle, fontWeight: 600 }}>{formatEUR(ni.valor)}</td>
                      <td style={{ ...tableCellStyle, color: 'var(--sd-ink-3, #8A9BB0)' }}>{formatDate(ni.data)}</td>
                      <td style={{ ...tableCellStyle, fontFamily: 'monospace', fontSize: 12 }}>{ni.origemBancaria}</td>
                      <td style={tableCellStyle}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: ecfg.bg, color: ecfg.color }}>
                          {ecfg.icon} {ecfg.label}
                        </span>
                      </td>
                      <td style={tableCellStyle}>{ni.condominoAtribuido || '---'}</td>
                      <td style={tableCellStyle}>{ni.fracaoAtribuida || '---'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {naoIdentificados.length === 0 && (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--sd-ink-3, #8A9BB0)', fontSize: 14 }}>
                Nenhum pagamento para reconciliar.
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── Tab: Configura\u00E7\u00E3o ─────────────────────────────────────────────────────

  const renderConfiguracao = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Payment methods */}
      <div style={cardStyle}>
        <h4 style={{ ...headingStyle, fontSize: 16, marginBottom: 16 }}>M\u00E9todos de Pagamento</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(Object.keys(METODO_CONFIG) as MetodoPagamento[]).map(metodo => {
            const mcfg = METODO_CONFIG[metodo]
            const ativo = config.metodosAtivos[metodo]
            return (
              <div
                key={metodo}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: `1px solid ${ativo ? 'var(--sd-gold, #C9A84C)' : 'var(--sd-border, #E4DDD0)'}`,
                  background: ativo ? 'rgba(201,168,76,0.06)' : '#fff',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20 }}>{mcfg.emoji}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--sd-navy, #0D1B2E)' }}>{mcfg.label}</span>
                </div>
                <button
                  onClick={() => handleToggleMetodo(metodo)}
                  style={{
                    width: 48,
                    height: 26,
                    borderRadius: 13,
                    border: 'none',
                    cursor: 'pointer',
                    background: ativo ? 'var(--sd-gold, #C9A84C)' : '#D1D5DB',
                    position: 'relative',
                    transition: 'background 0.2s',
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: '#fff',
                      position: 'absolute',
                      top: 3,
                      left: ativo ? 25 : 3,
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    }}
                  />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Entidade Multibanco */}
      <div style={cardStyle}>
        <h4 style={{ ...headingStyle, fontSize: 16, marginBottom: 16 }}>Entidade Multibanco</h4>
        <div style={{ maxWidth: 300 }}>
          <label style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', fontWeight: 500, marginBottom: 4, display: 'block' }}>N\u00FAmero da Entidade</label>
          <input
            style={inputStyle}
            value={config.entidadeMB}
            onChange={e => setConfig(prev => ({ ...prev, entidadeMB: e.target.value }))}
            placeholder="XXXXX"
            maxLength={5}
          />
          <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>
            Entidade atribu\u00EDda pelo seu provedor de pagamentos (ex: SIBS, Eupago, ifthenpay)
          </div>
        </div>
      </div>

      {/* Auto-reminder */}
      <div style={cardStyle}>
        <h4 style={{ ...headingStyle, fontSize: 16, marginBottom: 16 }}>Lembretes Autom\u00E1ticos</h4>
        <div style={{ maxWidth: 300 }}>
          <label style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', fontWeight: 500, marginBottom: 4, display: 'block' }}>
            Enviar lembrete X dias antes do vencimento
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              style={{ ...inputStyle, width: 80 }}
              type="number"
              min={1}
              max={30}
              value={config.diasLembreteAntes}
              onChange={e => setConfig(prev => ({ ...prev, diasLembreteAntes: parseInt(e.target.value) || 5 }))}
            />
            <span style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)' }}>dias antes</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>
            Os cond\u00F3minos receber\u00E3o um email/SMS de lembrete antes da data limite
          </div>
        </div>
      </div>

      {/* Late payment interest */}
      <div style={cardStyle}>
        <h4 style={{ ...headingStyle, fontSize: 16, marginBottom: 16 }}>Juros de Mora</h4>
        <div style={{ maxWidth: 300 }}>
          <label style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', fontWeight: 500, marginBottom: 4, display: 'block' }}>
            Taxa legal de juros de mora (% anual)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              style={{ ...inputStyle, width: 100 }}
              type="number"
              step="0.1"
              min={0}
              max={20}
              value={config.taxaJurosMora}
              onChange={e => setConfig(prev => ({ ...prev, taxaJurosMora: parseFloat(e.target.value) || 4.0 }))}
            />
            <span style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)' }}>%</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>
            Taxa legal aplic\u00E1vel a pagamentos em atraso (art.\u00BA 806.\u00BA C\u00F3digo Civil)
          </div>
        </div>
      </div>
    </div>
  )

  // ─── Main Render ────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Outfit', sans-serif" }}>
      {/* Page header */}
      <div>
        <h2 style={{ ...headingStyle, fontSize: 24, marginBottom: 4 }}>💳 Pagamentos Digitais</h2>
        <p style={{ fontSize: 14, color: 'var(--sd-ink-2, #4A5E78)', margin: 0 }}>
          Gest\u00E3o de cobran\u00E7as, refer\u00EAncias Multibanco e reconcilia\u00E7\u00E3o banc\u00E1ria
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--sd-border, #E4DDD0)', paddingBottom: 0 }}>
        {TAB_CONFIG.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--sd-gold, #C9A84C)' : 'var(--sd-ink-2, #4A5E78)',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--sd-gold, #C9A84C)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: "'Outfit', sans-serif",
                marginBottom: -1,
              }}
            >
              {tab.emoji} {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'referencias_mb' && renderReferenciasMB()}
      {activeTab === 'reconciliacao' && renderReconciliacao()}
      {activeTab === 'configuracao' && renderConfiguracao()}
    </div>
  )
}
