'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { toast } from 'sonner'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Props {
  user: any
  userRole: string
}

interface Immeuble {
  id: string
  nom: string
  adresse?: string
  ville?: string
  nbLots: number
  anneeConstruction?: number
  budgetAnnuel: number
  depensesAnnee: number
  nbInterventions: number
  prochainControle?: string
  gestionnaire?: string
}

interface ImmeubleMetrics {
  immeuble: Immeuble
  scoreSaude: number          // 0-100
  quotasAtraso: number        // % 0-100
  proximaAG: string           // date ISO
  satisfacao: number          // 0-100
  classeEnergetica: string    // A-G
  taxaOcupacao: number        // % 0-100
  tempoResolucao: number      // dias médios
  saudeFinanceira: number     // 0-100
  eficienciaManutencao: number // 0-100
  conformidade: number        // 0-100
  scoreGlobal: number         // 0-100
}

type TabId = 'visao' | 'comparacao' | 'ranking' | 'kpis'
type SortKey = 'scoreGlobal' | 'saudeFinanceira' | 'eficienciaManutencao' | 'satisfacao'

// ─── Constantes de design ──────────────────────────────────────────────────────

const COLORS = {
  navy: '#0D1B2E',
  gold: '#C9A84C',
  text: '#4A5E78',
  border: '#E4DDD0',
  bg: '#F7F4EE',
  white: '#FFFFFF',
  green: '#1A7A6E',
  greenBg: '#E6F4F2',
  yellow: '#D4830A',
  yellowBg: '#FEF5E4',
  red: '#C0392B',
  redBg: '#FDEDEC',
  silver: '#A0A9B4',
  bronze: '#CD7F32',
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'visao',      label: 'Visao Global',  icon: '🏢' },
  { id: 'comparacao', label: 'Comparação',     icon: '⚖️' },
  { id: 'ranking',    label: 'Ranking',        icon: '🏆' },
  { id: 'kpis',       label: 'KPIs',           icon: '📊' },
]

const CLASSES_ENERGETICAS = ['A', 'B', 'B-', 'C', 'D', 'E', 'F', 'G']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function healthColor(score: number): { bg: string; color: string; label: string } {
  if (score >= 70) return { bg: COLORS.greenBg, color: COLORS.green, label: 'Bom' }
  if (score >= 40) return { bg: COLORS.yellowBg, color: COLORS.yellow, label: 'Atenção' }
  return { bg: COLORS.redBg, color: COLORS.red, label: 'Crítico' }
}

function formatCurrency(val: number): string {
  return val.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function generateMetrics(imm: Immeuble): ImmeubleMetrics {
  const seed = hashStr(imm.id)
  const r = (i: number) => seededRandom(seed + i)

  const scoreSaude = Math.round(40 + r(1) * 55)
  const quotasAtraso = Math.round(r(2) * 25)
  const satisfacao = Math.round(55 + r(3) * 40)
  const classeEnergetica = CLASSES_ENERGETICAS[Math.floor(r(4) * CLASSES_ENERGETICAS.length)]
  const taxaOcupacao = Math.round(75 + r(5) * 25)
  const tempoResolucao = Math.round(1 + r(6) * 14)
  const saudeFinanceira = imm.budgetAnnuel > 0
    ? Math.round(Math.max(0, Math.min(100, 100 - (imm.depensesAnnee / imm.budgetAnnuel) * 80 + r(7) * 20)))
    : Math.round(30 + r(7) * 40)
  const eficienciaManutencao = Math.round(50 + r(8) * 45)
  const conformidade = Math.round(60 + r(9) * 35)
  const scoreGlobal = Math.round(
    scoreSaude * 0.25 + saudeFinanceira * 0.25 + eficienciaManutencao * 0.2 + satisfacao * 0.15 + conformidade * 0.15
  )

  const now = new Date()
  const agOffset = Math.floor(r(10) * 180) + 30
  const proximaAG = new Date(now.getTime() + agOffset * 86400000).toISOString().split('T')[0]

  return {
    immeuble: imm,
    scoreSaude,
    quotasAtraso,
    proximaAG,
    satisfacao,
    classeEnergetica,
    taxaOcupacao,
    tempoResolucao,
    saudeFinanceira,
    eficienciaManutencao,
    conformidade,
    scoreGlobal,
  }
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function DashboardMultiImmeublesSection({ user, userRole }: Props) {
  const [tab, setTab] = useState<TabId>('visao')
  const [immeubles, setImmeubles] = useState<Immeuble[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Comparação
  const [selA, setSelA] = useState('')
  const [selB, setSelB] = useState('')
  const [selC, setSelC] = useState('')

  // Ranking
  const [sortKey, setSortKey] = useState<SortKey>('scoreGlobal')
  const [sortAsc, setSortAsc] = useState(false)

  const uid = user?.id || user?.user?.id || ''
  const storageKey = `fixit_syndic_multi_${uid}`

  // ─── Fetch immeubles ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!uid) { setLoading(false); return }

    const cached = localStorage.getItem(storageKey)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setImmeubles(parsed)
          setLoading(false)
        }
      } catch { toast.error('Erreur lors du chargement du cache local') }
    }

    fetch(`/api/syndic/immeubles?user_id=${uid}`)
      .then(r => r.ok ? r.json() : Promise.reject('Erro'))
      .then(data => {
        const list: Immeuble[] = (data.immeubles || []).map((i: any) => ({
          id: i.id,
          nom: i.nom || 'Sem nome',
          adresse: i.adresse,
          ville: i.ville,
          nbLots: i.nbLots || 1,
          anneeConstruction: i.anneeConstruction,
          budgetAnnuel: i.budgetAnnuel || 0,
          depensesAnnee: i.depensesAnnee || 0,
          nbInterventions: i.nbInterventions || 0,
          prochainControle: i.prochainControle,
          gestionnaire: i.gestionnaire,
        }))
        setImmeubles(list)
        localStorage.setItem(storageKey, JSON.stringify(list))
        setError('')
      })
      .catch(() => {
        if (immeubles.length === 0) setError('Erro ao carregar imóveis')
        toast.error('Erreur lors du chargement des immeubles')
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  // ─── Métricas calculadas ────────────────────────────────────────────────────

  const metricsAll = useMemo(() => immeubles.map(generateMetrics), [immeubles])

  // Defaults para comparação
  useEffect(() => {
    if (immeubles.length >= 2 && !selA && !selB) {
      setSelA(immeubles[0].id)
      setSelB(immeubles[1].id)
      if (immeubles.length >= 3) setSelC(immeubles[2].id)
    }
  }, [immeubles, selA, selB])

  // ─── Ranking ordenado ──────────────────────────────────────────────────────

  const rankedMetrics = useMemo(() => {
    const copy = [...metricsAll]
    copy.sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      return sortAsc ? va - vb : vb - va
    })
    return copy
  }, [metricsAll, sortKey, sortAsc])

  // ─── KPIs agregados ────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    if (metricsAll.length === 0) return null
    const totalLots = immeubles.reduce((s, i) => s + i.nbLots, 0)
    const totalBudget = immeubles.reduce((s, i) => s + i.budgetAnnuel, 0)
    const totalDespesas = immeubles.reduce((s, i) => s + i.depensesAnnee, 0)
    const totalInterventions = immeubles.reduce((s, i) => s + i.nbInterventions, 0)
    const avgResolucao = metricsAll.reduce((s, m) => s + m.tempoResolucao, 0) / metricsAll.length
    const avgSatisfacao = metricsAll.reduce((s, m) => s + m.satisfacao, 0) / metricsAll.length
    const avgConformidade = metricsAll.reduce((s, m) => s + m.conformidade, 0) / metricsAll.length
    const avgScoreGlobal = metricsAll.reduce((s, m) => s + m.scoreGlobal, 0) / metricsAll.length
    const avgQuotasAtraso = metricsAll.reduce((s, m) => s + m.quotasAtraso, 0) / metricsAll.length

    return {
      totalImoveis: immeubles.length,
      totalLots,
      totalBudget,
      totalDespesas,
      totalInterventions,
      avgResolucao: Math.round(avgResolucao * 10) / 10,
      avgSatisfacao: Math.round(avgSatisfacao),
      avgConformidade: Math.round(avgConformidade),
      avgScoreGlobal: Math.round(avgScoreGlobal),
      avgQuotasAtraso: Math.round(avgQuotasAtraso * 10) / 10,
      taxaExecucao: totalBudget > 0 ? Math.round((totalDespesas / totalBudget) * 100) : 0,
    }
  }, [metricsAll, immeubles])

  // ─── Toggle sort ────────────────────────────────────────────────────────────

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(false) }
  }, [sortKey, sortAsc])

  // ─── Styles communs ─────────────────────────────────────────────────────────

  const s = {
    container: { background: COLORS.bg, minHeight: '100vh', padding: '24px' } as React.CSSProperties,
    header: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: '28px', fontWeight: 700, color: COLORS.navy, marginBottom: '4px' } as React.CSSProperties,
    subtitle: { color: COLORS.text, fontSize: '14px', marginBottom: '24px' } as React.CSSProperties,
    tabBar: { display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' as const } as React.CSSProperties,
    tab: (active: boolean) => ({
      padding: '10px 20px',
      borderRadius: '8px',
      border: `1.5px solid ${active ? COLORS.gold : COLORS.border}`,
      background: active ? COLORS.gold : COLORS.white,
      color: active ? COLORS.white : COLORS.text,
      fontWeight: active ? 600 : 400,
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'all 0.2s',
    } as React.CSSProperties),
    card: {
      background: COLORS.white,
      borderRadius: '12px',
      border: `1px solid ${COLORS.border}`,
      padding: '20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    } as React.CSSProperties,
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' } as React.CSSProperties,
    badge: (bg: string, color: string) => ({
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: 600,
      background: bg,
      color,
    } as React.CSSProperties),
    progressBar: (pct: number, color: string) => ({
      width: '100%',
      height: '8px',
      background: COLORS.border,
      borderRadius: '4px',
      overflow: 'hidden' as const,
      position: 'relative' as const,
    }),
    progressFill: (pct: number, color: string) => ({
      width: `${Math.min(100, Math.max(0, pct))}%`,
      height: '100%',
      background: color,
      borderRadius: '4px',
      transition: 'width 0.5s ease',
    }),
    metricRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${COLORS.border}` } as React.CSSProperties,
    metricLabel: { color: COLORS.text, fontSize: '13px' } as React.CSSProperties,
    metricValue: { fontWeight: 600, fontSize: '14px', color: COLORS.navy } as React.CSSProperties,
    select: {
      padding: '8px 12px',
      borderRadius: '8px',
      border: `1px solid ${COLORS.border}`,
      background: COLORS.white,
      color: COLORS.navy,
      fontSize: '14px',
      minWidth: '200px',
      cursor: 'pointer',
    } as React.CSSProperties,
    sectionTitle: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: '18px', fontWeight: 600, color: COLORS.navy, marginBottom: '16px' } as React.CSSProperties,
    kpiCard: {
      background: COLORS.white,
      borderRadius: '12px',
      border: `1px solid ${COLORS.border}`,
      padding: '20px',
      textAlign: 'center' as const,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    } as React.CSSProperties,
  }

  // ─── Render helpers ─────────────────────────────────────────────────────────

  const renderScoreBadge = (score: number) => {
    const h = healthColor(score)
    return <span style={s.badge(h.bg, h.color)}>{score}/100 — {h.label}</span>
  }

  const renderProgressBar = (pct: number, color: string) => (
    <div style={s.progressBar(pct, color)}>
      <div style={s.progressFill(pct, color)} />
    </div>
  )

  // ─── Loading / Error ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ ...s.container, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px', animation: 'spin 1s linear infinite' }}>🏢</div>
          <p style={{ color: COLORS.text }}>A carregar imóveis...</p>
        </div>
      </div>
    )
  }

  if (error && immeubles.length === 0) {
    return (
      <div style={{ ...s.container, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ ...s.card, textAlign: 'center', maxWidth: '400px' }}>
          <p style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️</p>
          <p style={{ color: COLORS.red, fontWeight: 600 }}>{error}</p>
          <p style={{ color: COLORS.text, fontSize: '13px', marginTop: '8px' }}>Verifique a sua ligação e tente novamente.</p>
        </div>
      </div>
    )
  }

  if (immeubles.length === 0) {
    return (
      <div style={{ ...s.container, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ ...s.card, textAlign: 'center', maxWidth: '400px' }}>
          <p style={{ fontSize: '32px', marginBottom: '8px' }}>🏗️</p>
          <p style={{ color: COLORS.navy, fontWeight: 600, fontSize: '16px' }}>Nenhum imóvel registado</p>
          <p style={{ color: COLORS.text, fontSize: '13px', marginTop: '8px' }}>Adicione imóveis ao seu cabinet para ver o dashboard multi-imóveis.</p>
        </div>
      </div>
    )
  }

  // ─── Tab: Visão Global ──────────────────────────────────────────────────────

  const renderVisaoGlobal = () => (
    <div>
      <p style={{ ...s.subtitle, marginBottom: '16px' }}>
        Visão consolidada dos {immeubles.length} imóveis sob gestão — métricas chave por edifício.
      </p>
      <div style={s.grid}>
        {metricsAll.map(m => {
          const hc = healthColor(m.scoreSaude)
          return (
            <div key={m.immeuble.id} style={{ ...s.card, position: 'relative' }}>
              {/* Health indicator dot */}
              <div style={{
                position: 'absolute', top: '16px', right: '16px',
                width: '12px', height: '12px', borderRadius: '50%',
                background: hc.color, boxShadow: `0 0 6px ${hc.color}40`,
              }} />

              <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '16px', fontWeight: 600, color: COLORS.navy, marginBottom: '4px', paddingRight: '28px' }}>
                {m.immeuble.nom}
              </h3>
              <p style={{ fontSize: '12px', color: COLORS.text, marginBottom: '12px' }}>
                {m.immeuble.adresse ? `${m.immeuble.adresse}` : ''}{m.immeuble.ville ? `, ${m.immeuble.ville}` : ''}
              </p>

              {/* Score saúde */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: COLORS.text }}>Pontuação de Saúde</span>
                  {renderScoreBadge(m.scoreSaude)}
                </div>
                {renderProgressBar(m.scoreSaude, hc.color)}
              </div>

              {/* Métricas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                <div>
                  <span style={{ color: COLORS.text }}>Frações: </span>
                  <strong style={{ color: COLORS.navy }}>{m.immeuble.nbLots}</strong>
                </div>
                <div>
                  <span style={{ color: COLORS.text }}>Intervenções: </span>
                  <strong style={{ color: COLORS.navy }}>{m.immeuble.nbInterventions}</strong>
                </div>
                <div>
                  <span style={{ color: COLORS.text }}>Orçamento: </span>
                  <strong style={{ color: COLORS.navy }}>{formatCurrency(m.immeuble.budgetAnnuel)}</strong>
                </div>
                <div>
                  <span style={{ color: COLORS.text }}>Despesas: </span>
                  <strong style={{ color: COLORS.navy }}>{formatCurrency(m.immeuble.depensesAnnee)}</strong>
                </div>
                <div>
                  <span style={{ color: COLORS.text }}>Quotas atraso: </span>
                  <strong style={{ color: m.quotasAtraso > 15 ? COLORS.red : m.quotasAtraso > 5 ? COLORS.yellow : COLORS.green }}>
                    {m.quotasAtraso}%
                  </strong>
                </div>
                <div>
                  <span style={{ color: COLORS.text }}>Próxima AG: </span>
                  <strong style={{ color: COLORS.navy }}>{formatDate(m.proximaAG)}</strong>
                </div>
              </div>

              {/* Score global footer */}
              <div style={{
                marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${COLORS.border}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: '12px', color: COLORS.text }}>Score Global</span>
                <span style={{ fontWeight: 700, fontSize: '18px', color: COLORS.gold }}>{m.scoreGlobal}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  // ─── Tab: Comparação ────────────────────────────────────────────────────────

  const renderComparacao = () => {
    const selected = [selA, selB, selC].filter(Boolean).map(id => metricsAll.find(m => m.immeuble.id === id)).filter(Boolean) as ImmeubleMetrics[]

    const dimensions: { key: keyof ImmeubleMetrics; label: string; suffix: string; isPercentage?: boolean }[] = [
      { key: 'saudeFinanceira', label: 'Saúde Financeira', suffix: '/100' },
      { key: 'scoreSaude', label: 'Pontuação de Saúde', suffix: '/100' },
      { key: 'eficienciaManutencao', label: 'Eficiência Manutenção', suffix: '/100' },
      { key: 'satisfacao', label: 'Satisfação', suffix: '/100' },
      { key: 'taxaOcupacao', label: 'Taxa de Ocupação', suffix: '%', isPercentage: true },
      { key: 'quotasAtraso', label: 'Quotas em Atraso', suffix: '%', isPercentage: true },
      { key: 'tempoResolucao', label: 'Tempo Resolução', suffix: ' dias' },
      { key: 'conformidade', label: 'Conformidade', suffix: '/100' },
      { key: 'scoreGlobal', label: 'Score Global', suffix: '/100' },
    ]

    const barColors = [COLORS.gold, COLORS.green, '#6C63FF']

    return (
      <div>
        <p style={{ ...s.subtitle, marginBottom: '16px' }}>
          Selecione 2 ou 3 imóveis para comparar lado a lado.
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
          {[
            { val: selA, set: setSelA, label: 'Imóvel A' },
            { val: selB, set: setSelB, label: 'Imóvel B' },
            { val: selC, set: setSelC, label: 'Imóvel C (opcional)' },
          ].map((sel, idx) => (
            <div key={idx}>
              <label style={{ fontSize: '12px', color: COLORS.text, display: 'block', marginBottom: '4px' }}>{sel.label}</label>
              <select style={s.select} value={sel.val} onChange={e => sel.set(e.target.value)}>
                <option value="">— Selecionar —</option>
                {immeubles.map(i => (
                  <option key={i.id} value={i.id}>{i.nom}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {selected.length < 2 ? (
          <div style={{ ...s.card, textAlign: 'center', padding: '40px' }}>
            <p style={{ color: COLORS.text }}>Selecione pelo menos 2 imóveis para iniciar a comparação.</p>
          </div>
        ) : (
          <div style={s.card}>
            {/* Legenda */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {selected.map((m, idx) => (
                <div key={m.immeuble.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: barColors[idx] }} />
                  <span style={{ fontSize: '13px', color: COLORS.navy, fontWeight: 600 }}>{m.immeuble.nom}</span>
                </div>
              ))}
            </div>

            {/* Classe energética */}
            <div style={{ ...s.metricRow, borderBottom: `1px solid ${COLORS.border}` }}>
              <span style={s.metricLabel}>Classe Energética</span>
              <div style={{ display: 'flex', gap: '16px' }}>
                {selected.map((m, idx) => (
                  <span key={m.immeuble.id} style={{ ...s.metricValue, color: barColors[idx] }}>
                    {m.classeEnergetica}
                  </span>
                ))}
              </div>
            </div>

            {/* Barras comparativas */}
            {dimensions.map(dim => {
              const maxVal = Math.max(...selected.map(m => m[dim.key] as number), 1)
              return (
                <div key={dim.key} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', color: COLORS.text }}>{dim.label}</span>
                  </div>
                  {selected.map((m, idx) => {
                    const val = m[dim.key] as number
                    const pct = dim.key === 'tempoResolucao'
                      ? Math.min(100, (val / 21) * 100)
                      : (val / Math.max(maxVal, 1)) * 100
                    return (
                      <div key={m.immeuble.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div style={{ width: '24px', fontSize: '11px', color: barColors[idx], fontWeight: 600, textAlign: 'right' as const }}>
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <div style={{ flex: 1, height: '18px', background: COLORS.border, borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, pct)}%`,
                            background: barColors[idx],
                            borderRadius: '4px',
                            transition: 'width 0.4s ease',
                            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '6px',
                          }}>
                            <span style={{ fontSize: '10px', color: COLORS.white, fontWeight: 600 }}>
                              {val}{dim.suffix}
                            </span>
                          </div>
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
    )
  }

  // ─── Tab: Ranking ───────────────────────────────────────────────────────────

  const renderRanking = () => {
    const sortOptions: { key: SortKey; label: string }[] = [
      { key: 'scoreGlobal', label: 'Score Global' },
      { key: 'saudeFinanceira', label: 'Saúde Financeira' },
      { key: 'eficienciaManutencao', label: 'Eficiência Manutenção' },
      { key: 'satisfacao', label: 'Satisfação' },
    ]

    const medalColors = [COLORS.gold, COLORS.silver, COLORS.bronze]
    const medalLabels = ['🥇', '🥈', '🥉']

    return (
      <div>
        <p style={{ ...s.subtitle, marginBottom: '16px' }}>
          Classificação dos imóveis por diferentes indicadores de desempenho.
        </p>

        {/* Botões de ordenação */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: COLORS.text, fontWeight: 500 }}>Ordenar por:</span>
          {sortOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => handleSort(opt.key)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: `1px solid ${sortKey === opt.key ? COLORS.gold : COLORS.border}`,
                background: sortKey === opt.key ? COLORS.gold : COLORS.white,
                color: sortKey === opt.key ? COLORS.white : COLORS.text,
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: sortKey === opt.key ? 600 : 400,
                transition: 'all 0.2s',
              }}
            >
              {opt.label} {sortKey === opt.key ? (sortAsc ? '↑' : '↓') : ''}
            </button>
          ))}
        </div>

        {/* Tabela */}
        <div style={{ ...s.card, overflowX: 'auto', padding: '0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: COLORS.navy }}>
                {['#', 'Imóvel', 'Frações', 'Score Global', 'Saúde Fin.', 'Efic. Manut.', 'Satisfação', 'Conformidade'].map((h, i) => (
                  <th key={i} style={{
                    padding: '12px 14px',
                    textAlign: i <= 1 ? 'left' as const : 'center' as const,
                    color: COLORS.white,
                    fontWeight: 600,
                    fontSize: '12px',
                    whiteSpace: 'nowrap' as const,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rankedMetrics.map((m, idx) => {
                const isTop3 = idx < 3
                const rowBg = isTop3 ? `${medalColors[idx]}10` : (idx % 2 === 0 ? COLORS.white : COLORS.bg)
                return (
                  <tr key={m.immeuble.id} style={{ background: rowBg, transition: 'background 0.2s' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, fontSize: '15px', textAlign: 'center' }}>
                      {isTop3 ? medalLabels[idx] : idx + 1}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, color: COLORS.navy }}>{m.immeuble.nom}</div>
                      <div style={{ fontSize: '11px', color: COLORS.text }}>{m.immeuble.ville || ''}</div>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', color: COLORS.navy }}>{m.immeuble.nbLots}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{
                        fontWeight: 700,
                        fontSize: '16px',
                        color: isTop3 ? medalColors[idx] : COLORS.navy,
                      }}>
                        {m.scoreGlobal}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>{renderScoreBadge(m.saudeFinanceira)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>{renderScoreBadge(m.eficienciaManutencao)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>{renderScoreBadge(m.satisfacao)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>{renderScoreBadge(m.conformidade)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ─── Tab: KPIs ──────────────────────────────────────────────────────────────

  const renderKPIs = () => {
    if (!kpis) return null

    const kpiCards: { label: string; value: string; icon: string; sub?: string; highlight?: boolean }[] = [
      { label: 'Total Imóveis', value: String(kpis.totalImoveis), icon: '🏢', sub: 'edifícios sob gestão' },
      { label: 'Total Frações', value: String(kpis.totalLots), icon: '🏠', sub: 'unidades geridas' },
      { label: 'Orçamento Total', value: formatCurrency(kpis.totalBudget), icon: '💰', sub: 'orçamento anual agregado', highlight: true },
      { label: 'Despesas Totais', value: formatCurrency(kpis.totalDespesas), icon: '📉', sub: `${kpis.taxaExecucao}% de execução orçamental` },
      { label: 'Total Intervenções', value: String(kpis.totalInterventions), icon: '🔧', sub: 'intervenções realizadas' },
      { label: 'Tempo Médio Resolução', value: `${kpis.avgResolucao} dias`, icon: '⏱️', sub: 'por intervenção' },
      { label: 'Satisfação Média', value: `${kpis.avgSatisfacao}/100`, icon: '⭐', sub: 'score médio dos condóminos', highlight: true },
      { label: 'Conformidade Média', value: `${kpis.avgConformidade}%`, icon: '✅', sub: 'taxa de conformidade' },
      { label: 'Score Global Médio', value: `${kpis.avgScoreGlobal}/100`, icon: '📊', sub: 'desempenho médio do portfólio', highlight: true },
      { label: 'Quotas em Atraso', value: `${kpis.avgQuotasAtraso}%`, icon: '⚠️', sub: 'média de inadimplência' },
    ]

    return (
      <div>
        <p style={{ ...s.subtitle, marginBottom: '16px' }}>
          Indicadores chave de desempenho agregados para todo o portfólio de imóveis.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {kpiCards.map((k, idx) => (
            <div key={idx} style={{
              ...s.kpiCard,
              borderLeft: k.highlight ? `4px solid ${COLORS.gold}` : undefined,
            }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>{k.icon}</div>
              <div style={{ fontSize: '12px', color: COLORS.text, textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '4px' }}>
                {k.label}
              </div>
              <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '24px', fontWeight: 700, color: COLORS.navy, marginBottom: '4px' }}>
                {k.value}
              </div>
              {k.sub && <div style={{ fontSize: '11px', color: COLORS.text }}>{k.sub}</div>}
            </div>
          ))}
        </div>

        {/* Resumo saúde do portfólio */}
        <div style={s.card}>
          <h3 style={s.sectionTitle}>Distribuição de Saúde do Portfólio</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {[
              { label: 'Bom (70+)', count: metricsAll.filter(m => m.scoreSaude >= 70).length, color: COLORS.green, bg: COLORS.greenBg },
              { label: 'Atenção (40-69)', count: metricsAll.filter(m => m.scoreSaude >= 40 && m.scoreSaude < 70).length, color: COLORS.yellow, bg: COLORS.yellowBg },
              { label: 'Crítico (<40)', count: metricsAll.filter(m => m.scoreSaude < 40).length, color: COLORS.red, bg: COLORS.redBg },
            ].map((cat, idx) => {
              const pct = metricsAll.length > 0 ? Math.round((cat.count / metricsAll.length) * 100) : 0
              return (
                <div key={idx} style={{ background: cat.bg, borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: cat.color }}>{cat.count}</div>
                  <div style={{ fontSize: '13px', color: cat.color, fontWeight: 500 }}>{cat.label}</div>
                  <div style={{ fontSize: '11px', color: COLORS.text, marginTop: '4px' }}>{pct}% do portfólio</div>
                  <div style={{ marginTop: '8px' }}>
                    {renderProgressBar(pct, cat.color)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Alertas */}
        {(() => {
          const alertes: { immeuble: string; message: string; severity: 'red' | 'yellow' }[] = []
          metricsAll.forEach(m => {
            if (m.scoreSaude < 40) alertes.push({ immeuble: m.immeuble.nom, message: 'Pontuação de saúde crítica', severity: 'red' })
            if (m.quotasAtraso > 20) alertes.push({ immeuble: m.immeuble.nom, message: `${m.quotasAtraso}% de quotas em atraso`, severity: 'red' })
            if (m.saudeFinanceira < 40) alertes.push({ immeuble: m.immeuble.nom, message: 'Saúde financeira em risco', severity: 'red' })
            if (m.conformidade < 60) alertes.push({ immeuble: m.immeuble.nom, message: 'Conformidade abaixo do limiar', severity: 'yellow' })
          })

          if (alertes.length === 0) return null

          return (
            <div style={{ ...s.card, marginTop: '16px' }}>
              <h3 style={s.sectionTitle}>Alertas do Portfólio</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {alertes.slice(0, 10).map((a, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', borderRadius: '8px',
                    background: a.severity === 'red' ? COLORS.redBg : COLORS.yellowBg,
                    border: `1px solid ${a.severity === 'red' ? COLORS.red : COLORS.yellow}20`,
                  }}>
                    <span style={{ fontSize: '14px' }}>{a.severity === 'red' ? '🔴' : '🟡'}</span>
                    <span style={{ fontWeight: 600, color: COLORS.navy, fontSize: '13px' }}>{a.immeuble}</span>
                    <span style={{ color: COLORS.text, fontSize: '13px' }}>— {a.message}</span>
                  </div>
                ))}
                {alertes.length > 10 && (
                  <p style={{ fontSize: '12px', color: COLORS.text, textAlign: 'center', marginTop: '4px' }}>
                    + {alertes.length - 10} alertas adicionais
                  </p>
                )}
              </div>
            </div>
          )
        })()}
      </div>
    )
  }

  // ─── Render principal ───────────────────────────────────────────────────────

  return (
    <div style={s.container}>
      <h1 style={s.header}>Dashboard Multi-Imóveis</h1>
      <p style={s.subtitle}>
        Gestão unificada de {immeubles.length} imóvel{immeubles.length > 1 ? 'is' : ''} — visão consolidada do portfólio
      </p>

      {/* Tab bar */}
      <div style={s.tabBar}>
        {TABS.map(t => (
          <button key={t.id} style={s.tab(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'visao' && renderVisaoGlobal()}
      {tab === 'comparacao' && renderComparacao()}
      {tab === 'ranking' && renderRanking()}
      {tab === 'kpis' && renderKPIs()}
    </div>
  )
}
