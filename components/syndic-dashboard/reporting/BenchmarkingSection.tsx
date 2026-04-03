'use client'

import { useState, useEffect, useMemo } from 'react'
import { StatCard } from '../types'
import type { User } from '@supabase/supabase-js'

// ─── Types ───────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'comparacao' | 'rankings' | 'alertas' | 'exportar'
type MetricKey = 'scoreGlobal' | 'saudeFinanceira' | 'eficienciaManutencao' | 'satisfacao' | 'conformidade' | 'quotasAtraso' | 'tempoResolucao' | 'taxaOcupacao'

interface ImmeubleMetrics {
  id: string; nome: string; adresse: string; ville: string; nbLots: number
  scoreGlobal: number; saudeFinanceira: number; eficienciaManutencao: number
  satisfacao: number; conformidade: number; quotasAtraso: number
  tempoResolucao: number; taxaOcupacao: number; classeEnergetica: string
}

interface PortfolioStats {
  avgScore: number; medianScore: number; p25: number; p75: number
  bestPerformer: string; worstPerformer: string; totalBuildings: number
}

interface AlertaOutlier {
  id: string; imovel: string; metric: MetricKey; value: number
  portfolioAvg: number; deviationPct: number
  severity: 'critico' | 'atencao' | 'info'; message: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const NAVY = '#0D1B2E'
const GOLD = '#C9A84C'
const TEAL = '#1A7A6E'
const BORDER = '#E4DDD0'
const BG = '#F7F4EE'
const RED = '#C0392B'
const AMBER = '#D4830A'

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: 'overview', label: 'Overview', emoji: '📊' },
  { id: 'comparacao', label: 'Comparação Detalhada', emoji: '🔍' },
  { id: 'rankings', label: 'Rankings', emoji: '🏆' },
  { id: 'alertas', label: 'Alertas', emoji: '🚨' },
  { id: 'exportar', label: 'Exportar', emoji: '📥' },
]

const METRIC_LABELS: Record<MetricKey, string> = {
  scoreGlobal: 'Score Global',
  saudeFinanceira: 'Saúde Financeira',
  eficienciaManutencao: 'Eficiência Manutenção',
  satisfacao: 'Satisfação',
  conformidade: 'Conformidade',
  quotasAtraso: 'Quotas em Atraso (%)',
  tempoResolucao: 'Tempo Resolução (dias)',
  taxaOcupacao: 'Taxa Ocupação (%)',
}

const METRIC_KEYS: MetricKey[] = ['scoreGlobal', 'saudeFinanceira', 'eficienciaManutencao', 'satisfacao', 'conformidade', 'quotasAtraso', 'tempoResolucao', 'taxaOcupacao']

const RADAR_METRICS: MetricKey[] = ['saudeFinanceira', 'eficienciaManutencao', 'satisfacao', 'conformidade', 'quotasAtraso', 'taxaOcupacao']

const BUILDING_NAMES = [
  'Edifício Aurora', 'Residencial Atlântico', 'Condomínio Solar', 'Edifício Horizonte',
  'Residencial Douro', 'Condomínio Estrela', 'Edifício Ribeira', 'Residencial Miramar',
  'Condomínio Jardim', 'Edifício Cristal', 'Residencial Oceano', 'Condomínio Belvedere',
]

const BUILDING_ADDRESSES = [
  'Rua da Boavista 123', 'Av. dos Aliados 45', 'Rua de Santa Catarina 78', 'Praça da Liberdade 12',
  'Rua do Almada 56', 'Av. da República 89', 'Rua de Cedofeita 34', 'Rua das Flores 67',
  'Largo do Toural 90', 'Rua de Sá da Bandeira 23', 'Av. de França 11', 'Rua do Heroísmo 55',
]

const CITIES = ['Porto', 'Vila Nova de Gaia', 'Matosinhos', 'Maia', 'Gondomar', 'Penafiel']
const ENERGY_CLASSES = ['A', 'A+', 'B', 'B-', 'C', 'D', 'E']

// ─── Seeded Random ───────────────────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function seededRandom(seed: number): () => number {
  let s = seed
  return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647 }
}

// ─── Utility Functions ───────────────────────────────────────────────────────

function healthColor(value: number, inverted = false): string {
  const v = inverted ? 100 - value : value
  if (v >= 75) return TEAL
  if (v >= 50) return AMBER
  return RED
}

function metricColor(key: MetricKey, value: number): string {
  if (key === 'quotasAtraso') return value <= 10 ? TEAL : value <= 20 ? AMBER : RED
  if (key === 'tempoResolucao') return value <= 3 ? TEAL : value <= 7 ? AMBER : RED
  return healthColor(value)
}

function computePercentiles(metrics: ImmeubleMetrics[], key: MetricKey): { p25: number; p50: number; p75: number } {
  const vals = metrics.map(m => m[key] as number).sort((a, b) => a - b)
  const n = vals.length
  const percentile = (p: number) => {
    const idx = (p / 100) * (n - 1)
    const lo = Math.floor(idx)
    const hi = Math.ceil(idx)
    return lo === hi ? vals[lo] : vals[lo] + (vals[hi] - vals[lo]) * (idx - lo)
  }
  return { p25: percentile(25), p50: percentile(50), p75: percentile(75) }
}

function computePortfolioStats(metrics: ImmeubleMetrics[]): PortfolioStats {
  const scores = metrics.map(m => m.scoreGlobal)
  const sorted = [...scores].sort((a, b) => a - b)
  const n = sorted.length
  const avg = scores.reduce((a, b) => a + b, 0) / n
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)]
  const p25 = sorted[Math.floor(n * 0.25)]
  const p75 = sorted[Math.floor(n * 0.75)]
  const best = metrics.reduce((a, b) => a.scoreGlobal > b.scoreGlobal ? a : b)
  const worst = metrics.reduce((a, b) => a.scoreGlobal < b.scoreGlobal ? a : b)
  return { avgScore: Math.round(avg * 10) / 10, medianScore: Math.round(median * 10) / 10, p25, p75, bestPerformer: best.nome, worstPerformer: worst.nome, totalBuildings: n }
}

function detectOutliers(metrics: ImmeubleMetrics[], threshold = 1.0): AlertaOutlier[] {
  const alerts: AlertaOutlier[] = []
  const keysToCheck: MetricKey[] = ['saudeFinanceira', 'eficienciaManutencao', 'satisfacao', 'conformidade', 'taxaOcupacao']

  for (const key of keysToCheck) {
    const vals = metrics.map(m => m[key] as number)
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    const variance = vals.reduce((a, b) => a + (b - avg) ** 2, 0) / vals.length
    const stddev = Math.sqrt(variance)
    if (stddev === 0) continue

    for (const m of metrics) {
      const val = m[key] as number
      const deviation = (avg - val) / stddev
      if (deviation > threshold) {
        const deviationPct = Math.round(((avg - val) / avg) * 100)
        let severity: AlertaOutlier['severity'] = 'info'
        if (deviation > 2) severity = 'critico'
        else if (deviation > 1.5) severity = 'atencao'

        alerts.push({
          id: `${m.id}-${key}`,
          imovel: m.nome,
          metric: key,
          value: val,
          portfolioAvg: Math.round(avg * 10) / 10,
          deviationPct,
          severity,
          message: `${m.nome}: ${METRIC_LABELS[key]} a ${val} (média portfolio: ${Math.round(avg)})`,
        })
      }
    }
  }

  // Also check quotasAtraso (inverted: high is bad)
  const quotaVals = metrics.map(m => m.quotasAtraso)
  const quotaAvg = quotaVals.reduce((a, b) => a + b, 0) / quotaVals.length
  const quotaVar = quotaVals.reduce((a, b) => a + (b - quotaAvg) ** 2, 0) / quotaVals.length
  const quotaStd = Math.sqrt(quotaVar)
  if (quotaStd > 0) {
    for (const m of metrics) {
      const deviation = (m.quotasAtraso - quotaAvg) / quotaStd
      if (deviation > threshold) {
        let severity: AlertaOutlier['severity'] = 'info'
        if (deviation > 2) severity = 'critico'
        else if (deviation > 1.5) severity = 'atencao'
        alerts.push({
          id: `${m.id}-quotasAtraso`,
          imovel: m.nome,
          metric: 'quotasAtraso',
          value: m.quotasAtraso,
          portfolioAvg: Math.round(quotaAvg * 10) / 10,
          deviationPct: Math.round(((m.quotasAtraso - quotaAvg) / quotaAvg) * 100),
          severity,
          message: `${m.nome}: Quotas em atraso a ${m.quotasAtraso}% (média: ${Math.round(quotaAvg)}%)`,
        })
      }
    }
  }

  // tempoResolucao (inverted: high is bad)
  const tempoVals = metrics.map(m => m.tempoResolucao)
  const tempoAvg = tempoVals.reduce((a, b) => a + b, 0) / tempoVals.length
  const tempoVar = tempoVals.reduce((a, b) => a + (b - tempoAvg) ** 2, 0) / tempoVals.length
  const tempoStd = Math.sqrt(tempoVar)
  if (tempoStd > 0) {
    for (const m of metrics) {
      const deviation = (m.tempoResolucao - tempoAvg) / tempoStd
      if (deviation > threshold) {
        let severity: AlertaOutlier['severity'] = 'info'
        if (deviation > 2) severity = 'critico'
        else if (deviation > 1.5) severity = 'atencao'
        alerts.push({
          id: `${m.id}-tempoResolucao`,
          imovel: m.nome,
          metric: 'tempoResolucao',
          value: m.tempoResolucao,
          portfolioAvg: Math.round(tempoAvg * 10) / 10,
          deviationPct: Math.round(((m.tempoResolucao - tempoAvg) / tempoAvg) * 100),
          severity,
          message: `${m.nome}: Tempo de resolução ${m.tempoResolucao} dias (média: ${Math.round(tempoAvg)} dias)`,
        })
      }
    }
  }

  const severityOrder = { critico: 0, atencao: 1, info: 2 }
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
}

function exportCSV(data: ImmeubleMetrics[], selectedMetrics: MetricKey[]) {
  const headers = ['Nome', 'Adresse', 'Ville', 'Nb Lots', 'Classe Energética', ...selectedMetrics.map(k => METRIC_LABELS[k])]
  const rows = data.map(m => [
    m.nome, m.adresse, m.ville, m.nbLots.toString(), m.classeEnergetica,
    ...selectedMetrics.map(k => String(m[k])),
  ])
  const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `benchmarking-portfolio-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Data Generation ─────────────────────────────────────────────────────────

function generateBuildings(userId: string): ImmeubleMetrics[] {
  const seed = hashStr(userId || 'default-user')
  const rng = seededRandom(seed)

  const rangeVal = (min: number, max: number) => Math.round(min + rng() * (max - min))

  return BUILDING_NAMES.map((nome, i) => ({
    id: `bm-${i + 1}`,
    nome,
    adresse: BUILDING_ADDRESSES[i],
    ville: CITIES[i % CITIES.length],
    nbLots: rangeVal(8, 120),
    scoreGlobal: rangeVal(45, 95),
    saudeFinanceira: rangeVal(40, 98),
    eficienciaManutencao: rangeVal(50, 95),
    satisfacao: rangeVal(55, 90),
    conformidade: rangeVal(60, 100),
    quotasAtraso: rangeVal(2, 35),
    tempoResolucao: rangeVal(1, 15),
    taxaOcupacao: rangeVal(70, 100),
    classeEnergetica: ENERGY_CLASSES[rangeVal(0, ENERGY_CLASSES.length - 1)],
  }))
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BenchmarkingSection({ user, userRole }: { user: User; userRole: string }) {
  const [tab, setTab] = useState<TabId>('overview')
  const [buildings, setBuildings] = useState<ImmeubleMetrics[]>([])
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([])
  const [compareDropdownOpen, setCompareDropdownOpen] = useState(false)
  const [sortKey, setSortKey] = useState<MetricKey>('scoreGlobal')
  const [sortAsc, setSortAsc] = useState(false)
  const [exportMetrics, setExportMetrics] = useState<MetricKey[]>([...METRIC_KEYS])
  const [exportDateFrom, setExportDateFrom] = useState('')
  const [exportDateTo, setExportDateTo] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    const key = `fixit_benchmarking_${user?.id}`
    const stored = typeof window !== 'undefined' ? localStorage.getItem(key) : null
    if (stored) {
      try {
        setBuildings(JSON.parse(stored))
        return
      } catch { /* fall through */ }
    }
    const generated = generateBuildings(user?.id || 'anon')
    setBuildings(generated)
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(generated))
    }
  }, [user?.id])

  const portfolioStats = useMemo(() => buildings.length > 0 ? computePortfolioStats(buildings) : null, [buildings])
  const outlierAlerts = useMemo(() => buildings.length > 0 ? detectOutliers(buildings) : [], [buildings])

  const sortedBuildings = useMemo(() => {
    const sorted = [...buildings].sort((a, b) => {
      const va = a[sortKey] as number
      const vb = b[sortKey] as number
      return sortAsc ? va - vb : vb - va
    })
    return sorted
  }, [buildings, sortKey, sortAsc])

  const comparedBuildings = useMemo(() => buildings.filter(b => selectedForCompare.includes(b.id)), [buildings, selectedForCompare])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleSort = (key: MetricKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(false) }
  }

  const toggleCompare = (id: string) => {
    setSelectedForCompare(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 4) return prev
      return [...prev, id]
    })
  }

  const toggleExportMetric = (key: MetricKey) => {
    setExportMetrics(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  if (buildings.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#8A9BB0' }}>A carregar dados...</div>
  }

  // ─── Radar Chart Data ───────────────────────────────────────────────────────

  const radarAvgs = RADAR_METRICS.map(key => {
    const vals = buildings.map(b => b[key] as number)
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    // Invert quotasAtraso so that lower = better = higher on chart
    if (key === 'quotasAtraso') return Math.round(100 - avg)
    return Math.round(avg)
  })

  const radarLabels = RADAR_METRICS.map(k => k === 'quotasAtraso' ? 'Quotas (inv.)' : METRIC_LABELS[k].replace('Eficiência ', 'Efic. '))

  // ─── Distribution Histogram ─────────────────────────────────────────────────

  const histBuckets = [
    { label: '0-20', min: 0, max: 20 },
    { label: '21-40', min: 21, max: 40 },
    { label: '41-60', min: 41, max: 60 },
    { label: '61-80', min: 61, max: 80 },
    { label: '81-100', min: 81, max: 100 },
  ]
  const histCounts = histBuckets.map(b => buildings.filter(m => m.scoreGlobal >= b.min && m.scoreGlobal <= b.max).length)
  const histMax = Math.max(...histCounts, 1)

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 0 }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999, background: NAVY, color: '#fff', padding: '12px 24px', borderRadius: 8, fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: NAVY, margin: 0 }}>
          Benchmarking do Portfolio
        </h2>
        <p style={{ fontSize: 13, color: '#8A9BB0', marginTop: 4 }}>
          Comparação de desempenho entre {buildings.length} imóveis geridos
        </p>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}`, marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '10px 20px', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? NAVY : '#8A9BB0',
              borderBottom: tab === t.id ? `2px solid ${GOLD}` : '2px solid transparent',
              background: 'none', border: 'none', cursor: 'pointer' }}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* OVERVIEW TAB                                                           */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'overview' && portfolioStats && (
        <div>
          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
            <StatCard emoji="📊" label="Média Portfolio" value={portfolioStats.avgScore} sub={`Mediana: ${portfolioStats.medianScore}`} color="yellow" />
            <StatCard emoji="🏅" label="Melhor Desempenho" value={portfolioStats.bestPerformer} sub="Score mais alto" color="green" />
            <StatCard emoji="⚠️" label="Necessita Atenção" value={portfolioStats.worstPerformer} sub="Score mais baixo" color="red" />
            <StatCard emoji="🏢" label="Total Imóveis" value={portfolioStats.totalBuildings} sub={`P25: ${portfolioStats.p25} | P75: ${portfolioStats.p75}`} color="blue" />
          </div>

          {/* Radar Chart + Histogram side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            {/* CSS Radar Chart */}
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: NAVY, marginBottom: 20, marginTop: 0 }}>
                Perfil Médio do Portfolio
              </h3>
              <div style={{ position: 'relative', width: '100%', maxWidth: 320, margin: '0 auto' }}>
                {/* Radial bars from center */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {radarAvgs.map((val, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 90, fontSize: 11, color: '#4A5E78', textAlign: 'right', flexShrink: 0 }}>
                        {radarLabels[i]}
                      </div>
                      <div style={{ flex: 1, height: 20, background: '#F0EDE7', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                        <div style={{
                          width: `${val}%`, height: '100%', borderRadius: 4,
                          background: `linear-gradient(90deg, ${healthColor(val)} 0%, ${healthColor(val)}CC 100%)`,
                          transition: 'width 0.6s ease',
                        }} />
                        <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 600, color: val > 60 ? '#fff' : NAVY }}>
                          {val}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Distribution Histogram */}
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: NAVY, marginBottom: 20, marginTop: 0 }}>
                Distribuição Score Global
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {histBuckets.map((bucket, i) => (
                  <div key={bucket.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 50, fontSize: 12, color: '#4A5E78', textAlign: 'right', flexShrink: 0 }}>
                      {bucket.label}
                    </div>
                    <div style={{ flex: 1, height: 24, background: '#F0EDE7', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                      <div style={{
                        width: `${(histCounts[i] / histMax) * 100}%`,
                        height: '100%', borderRadius: 4, minWidth: histCounts[i] > 0 ? 24 : 0,
                        background: i <= 1 ? RED : i === 2 ? AMBER : TEAL,
                        transition: 'width 0.4s ease',
                      }} />
                      <span style={{ position: 'absolute', left: Math.max((histCounts[i] / histMax) * 100, 12) > 30 ? 8 : undefined, right: Math.max((histCounts[i] / histMax) * 100, 12) <= 30 ? -24 : undefined, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 600, color: Math.max((histCounts[i] / histMax) * 100, 12) > 30 ? '#fff' : NAVY }}>
                        {histCounts[i]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: '#8A9BB0', textAlign: 'center' }}>
                Número de imóveis por faixa de score
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* COMPARAÇÃO DETALHADA TAB                                               */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'comparacao' && portfolioStats && (
        <div>
          {/* Building selector */}
          <div style={{ marginBottom: 24, position: 'relative' }}>
            <div style={{ fontSize: 13, color: '#4A5E78', marginBottom: 8 }}>
              Selecionar imóveis para comparar (2 a 4):
            </div>
            <button
              onClick={() => setCompareDropdownOpen(!compareDropdownOpen)}
              style={{
                padding: '10px 16px', border: `1px solid ${BORDER}`, borderRadius: 8,
                background: '#fff', cursor: 'pointer', fontSize: 13, color: NAVY,
                display: 'flex', alignItems: 'center', gap: 8, minWidth: 280,
              }}
            >
              {selectedForCompare.length === 0 ? 'Escolher imóveis...' : `${selectedForCompare.length} imóvel(is) selecionado(s)`}
              <span style={{ marginLeft: 'auto', fontSize: 10 }}>{compareDropdownOpen ? '▲' : '▼'}</span>
            </button>

            {compareDropdownOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 100,
                background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 300, overflowY: 'auto',
                width: 340, marginTop: 4,
              }}>
                {buildings.map(b => (
                  <label key={b.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                    cursor: selectedForCompare.length >= 4 && !selectedForCompare.includes(b.id) ? 'not-allowed' : 'pointer',
                    borderBottom: `1px solid ${BORDER}20`, fontSize: 13, color: NAVY,
                    opacity: selectedForCompare.length >= 4 && !selectedForCompare.includes(b.id) ? 0.4 : 1,
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedForCompare.includes(b.id)}
                      onChange={() => toggleCompare(b.id)}
                      disabled={selectedForCompare.length >= 4 && !selectedForCompare.includes(b.id)}
                      style={{ accentColor: GOLD }}
                    />
                    <span style={{ fontWeight: 500 }}>{b.nome}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8A9BB0' }}>Score: {b.scoreGlobal}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Comparison Table */}
          {comparedBuildings.length >= 2 ? (
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: BG }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: '#4A5E78', fontWeight: 600, borderBottom: `1px solid ${BORDER}` }}>Métrica</th>
                      {comparedBuildings.map(b => (
                        <th key={b.id} style={{ padding: '12px 16px', textAlign: 'center', color: NAVY, fontWeight: 600, borderBottom: `1px solid ${BORDER}`, minWidth: 140 }}>
                          {b.nome}
                        </th>
                      ))}
                      <th style={{ padding: '12px 16px', textAlign: 'center', color: '#8A9BB0', fontWeight: 500, borderBottom: `1px solid ${BORDER}` }}>Δ Média</th>
                    </tr>
                  </thead>
                  <tbody>
                    {METRIC_KEYS.map(key => {
                      const avgAll = buildings.reduce((a, b) => a + (b[key] as number), 0) / buildings.length
                      const vals = comparedBuildings.map(b => b[key] as number)
                      const isInverted = key === 'quotasAtraso' || key === 'tempoResolucao'
                      const bestVal = isInverted ? Math.min(...vals) : Math.max(...vals)

                      return (
                        <tr key={key} style={{ borderBottom: `1px solid ${BORDER}20` }}>
                          <td style={{ padding: '12px 16px', fontWeight: 500, color: NAVY }}>{METRIC_LABELS[key]}</td>
                          {comparedBuildings.map(b => {
                            const val = b[key] as number
                            const isBest = val === bestVal
                            const barPct = key === 'quotasAtraso' ? Math.min(val / 40 * 100, 100) :
                                          key === 'tempoResolucao' ? Math.min(val / 15 * 100, 100) :
                                          val
                            return (
                              <td key={b.id} style={{ padding: '12px 16px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                                  <span style={{ fontWeight: 600, color: metricColor(key, val), fontSize: 14 }}>
                                    {val}{key === 'quotasAtraso' || key === 'taxaOcupacao' ? '%' : key === 'tempoResolucao' ? 'd' : ''}
                                  </span>
                                  {isBest && (
                                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: `${GOLD}20`, color: GOLD }}>
                                      TOP
                                    </span>
                                  )}
                                </div>
                                <div style={{ height: 4, background: '#F0EDE7', borderRadius: 2, marginTop: 6 }}>
                                  <div style={{ width: `${barPct}%`, height: '100%', borderRadius: 2, background: metricColor(key, val) }} />
                                </div>
                              </td>
                            )
                          })}
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: '#8A9BB0' }}>
                            {Math.round(avgAll * 10) / 10}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 40, textAlign: 'center', color: '#8A9BB0' }}>
              Selecione pelo menos 2 imóveis para comparar.
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* RANKINGS TAB                                                           */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'rankings' && (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: BG }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#4A5E78', borderBottom: `1px solid ${BORDER}`, width: 40 }}>#</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#4A5E78', borderBottom: `1px solid ${BORDER}` }}>Imóvel</th>
                  {METRIC_KEYS.map(key => {
                    const isActive = sortKey === key
                    return (
                      <th
                        key={key}
                        onClick={() => handleSort(key)}
                        style={{
                          padding: '12px 10px', textAlign: 'center', fontWeight: 600,
                          color: isActive ? NAVY : '#4A5E78', borderBottom: `1px solid ${BORDER}`,
                          cursor: 'pointer', userSelect: 'none', fontSize: 11, whiteSpace: 'nowrap',
                          background: isActive ? `${GOLD}10` : undefined,
                        }}
                      >
                        {METRIC_LABELS[key].replace('Eficiência ', 'Efic. ').replace(' (%)', '').replace(' (dias)', '')}
                        {isActive && <span style={{ marginLeft: 4 }}>{sortAsc ? '↑' : '↓'}</span>}
                      </th>
                    )
                  })}
                  <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 600, color: '#4A5E78', borderBottom: `1px solid ${BORDER}`, fontSize: 11 }}>Percentil</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 600, color: '#4A5E78', borderBottom: `1px solid ${BORDER}`, fontSize: 11 }}>Tendência</th>
                </tr>
              </thead>
              <tbody>
                {sortedBuildings.map((b, idx) => {
                  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
                  const { p25, p50, p75 } = computePercentiles(buildings, sortKey)
                  const val = b[sortKey] as number
                  const isInverted = sortKey === 'quotasAtraso' || sortKey === 'tempoResolucao'
                  let pLabel: string
                  if (isInverted) {
                    pLabel = val <= p25 ? 'P75+' : val <= p50 ? 'P50' : val <= p75 ? 'P25' : '<P25'
                  } else {
                    pLabel = val >= p75 ? 'P75+' : val >= p50 ? 'P50' : val >= p25 ? 'P25' : '<P25'
                  }
                  const pColor = pLabel === 'P75+' ? TEAL : pLabel === 'P50' ? AMBER : RED

                  // Simple trend based on seeded pattern
                  const trendSeed = hashStr(b.id + sortKey)
                  const trend = trendSeed % 3 === 0 ? '↑' : trendSeed % 3 === 1 ? '↓' : '→'
                  const trendColor = trend === '↑' ? TEAL : trend === '↓' ? RED : '#8A9BB0'

                  return (
                    <tr key={b.id} style={{ borderBottom: `1px solid ${BORDER}20` }}>
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: NAVY }}>
                        {medal || idx + 1}
                      </td>
                      <td style={{ padding: '10px 16px', fontWeight: 500, color: NAVY }}>
                        <div>{b.nome}</div>
                        <div style={{ fontSize: 11, color: '#8A9BB0', marginTop: 2 }}>{b.ville} · {b.nbLots} lots</div>
                      </td>
                      {METRIC_KEYS.map(key => {
                        const v = b[key] as number
                        const c = metricColor(key, v)
                        return (
                          <td key={key} style={{ padding: '10px 10px', textAlign: 'center' }}>
                            <span style={{
                              fontWeight: 600, fontSize: 12, color: c,
                              padding: '2px 6px', borderRadius: 4,
                              background: c === TEAL ? '#E6F4F2' : c === AMBER ? '#FEF5E4' : '#FDECEA',
                            }}>
                              {v}
                            </span>
                          </td>
                        )
                      })}
                      <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: pColor, padding: '2px 8px', borderRadius: 4, background: pColor === TEAL ? '#E6F4F2' : pColor === AMBER ? '#FEF5E4' : '#FDECEA' }}>
                          {pLabel}
                        </span>
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'center', fontSize: 16, color: trendColor }}>
                        {trend}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* ALERTAS TAB                                                            */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'alertas' && (
        <div>
          <div style={{ fontSize: 13, color: '#4A5E78', marginBottom: 16 }}>
            {outlierAlerts.length} alerta(s) detetado(s) no portfolio
          </div>

          {outlierAlerts.length === 0 ? (
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: TEAL }}>Nenhum outlier detetado</div>
              <div style={{ fontSize: 13, color: '#8A9BB0', marginTop: 4 }}>Todos os imóveis estão dentro dos limites esperados.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {outlierAlerts.map(alert => {
                const severityConfig = {
                  critico: { bg: '#FDECEA', border: RED, label: 'Crítico', icon: '🔴', textColor: RED },
                  atencao: { bg: '#FEF5E4', border: AMBER, label: 'Atenção', icon: '🟡', textColor: AMBER },
                  info: { bg: '#E6F4F2', border: TEAL, label: 'Info', icon: '🔵', textColor: TEAL },
                }
                const sc = severityConfig[alert.severity]

                return (
                  <div key={alert.id} style={{
                    background: '#fff', border: `1px solid ${BORDER}`, borderLeft: `4px solid ${sc.border}`,
                    borderRadius: 8, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 12,
                  }}>
                    <span style={{ fontSize: 18 }}>{sc.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: NAVY }}>{alert.imovel}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                          background: sc.bg, color: sc.textColor, letterSpacing: '0.3px',
                        }}>
                          {sc.label.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#4A5E78', marginBottom: 4 }}>
                        {METRIC_LABELS[alert.metric]}
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#8A9BB0' }}>
                        <span>Valor: <strong style={{ color: sc.textColor }}>{alert.value}</strong></span>
                        <span>Média portfolio: <strong>{alert.portfolioAvg}</strong></span>
                        <span>Desvio: <strong style={{ color: sc.textColor }}>{alert.deviationPct > 0 ? '+' : ''}{alert.deviationPct}%</strong></span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* EXPORTAR TAB                                                           */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'exportar' && (
        <div>
          {/* Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            {/* Date Range */}
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: NAVY, marginTop: 0, marginBottom: 12 }}>Período</h4>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: 11, color: '#8A9BB0', display: 'block', marginBottom: 4 }}>De</label>
                  <input
                    type="date"
                    value={exportDateFrom}
                    onChange={e => setExportDateFrom(e.target.value)}
                    style={{ padding: '8px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, color: NAVY }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#8A9BB0', display: 'block', marginBottom: 4 }}>Até</label>
                  <input
                    type="date"
                    value={exportDateTo}
                    onChange={e => setExportDateTo(e.target.value)}
                    style={{ padding: '8px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, color: NAVY }}
                  />
                </div>
              </div>
            </div>

            {/* Metric Selection */}
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: NAVY, marginTop: 0, marginBottom: 12 }}>Métricas a incluir</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {METRIC_KEYS.map(key => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#4A5E78', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={exportMetrics.includes(key)}
                      onChange={() => toggleExportMetric(key)}
                      style={{ accentColor: GOLD }}
                    />
                    {METRIC_LABELS[key]}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <button
              onClick={() => {
                if (exportMetrics.length === 0) { showToast('Selecione pelo menos uma métrica.'); return }
                exportCSV(buildings, exportMetrics)
                showToast('CSV exportado com sucesso!')
              }}
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: TEAL, color: '#fff', fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              📥 Exportar CSV
            </button>
            <button
              onClick={() => showToast('PDF export em desenvolvimento')}
              style={{
                padding: '10px 24px', borderRadius: 8, border: `1px solid ${BORDER}`, cursor: 'pointer',
                background: '#fff', color: NAVY, fontSize: 13, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              📄 Exportar PDF
            </button>
          </div>

          {/* Preview Table */}
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, background: BG }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>Pré-visualização da exportação</span>
              <span style={{ fontSize: 11, color: '#8A9BB0', marginLeft: 8 }}>({buildings.length} imóveis, {exportMetrics.length} métricas)</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: BG }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#4A5E78', borderBottom: `1px solid ${BORDER}` }}>Nome</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#4A5E78', borderBottom: `1px solid ${BORDER}` }}>Ville</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#4A5E78', borderBottom: `1px solid ${BORDER}` }}>Lots</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#4A5E78', borderBottom: `1px solid ${BORDER}` }}>Classe</th>
                    {exportMetrics.map(key => (
                      <th key={key} style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, color: '#4A5E78', borderBottom: `1px solid ${BORDER}`, fontSize: 11, whiteSpace: 'nowrap' }}>
                        {METRIC_LABELS[key].replace('Eficiência ', 'Efic. ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {buildings.map(b => (
                    <tr key={b.id} style={{ borderBottom: `1px solid ${BORDER}20` }}>
                      <td style={{ padding: '8px 12px', fontWeight: 500, color: NAVY }}>{b.nome}</td>
                      <td style={{ padding: '8px 12px', color: '#4A5E78' }}>{b.ville}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#4A5E78' }}>{b.nbLots}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                          background: b.classeEnergetica <= 'B' ? '#E6F4F2' : b.classeEnergetica <= 'D' ? '#FEF5E4' : '#FDECEA',
                          color: b.classeEnergetica <= 'B' ? TEAL : b.classeEnergetica <= 'D' ? AMBER : RED,
                        }}>
                          {b.classeEnergetica}
                        </span>
                      </td>
                      {exportMetrics.map(key => (
                        <td key={key} style={{ padding: '8px 8px', textAlign: 'center', fontSize: 12, color: metricColor(key, b[key] as number), fontWeight: 500 }}>
                          {b[key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
