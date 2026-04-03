'use client'

import React, { useState, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoUtilidade = 'eletricidade' | 'agua' | 'gas'
type SeveridadeAlerta = 'info' | 'aviso' | 'critico'
type EstadoAlerta = 'ativo' | 'reconhecido' | 'resolvido'

interface Leitura {
  id: string
  contadorId: string
  mes: string           // YYYY-MM
  leituraAnterior: number
  leituraAtual: number
  consumo: number       // leituraAtual - leituraAnterior
  custoEstimado: number
  registadoPor: string
  dataRegisto: string
}

interface Contador {
  id: string
  nome: string
  tipo: TipoUtilidade
  edificioNom: string
  fracaoId?: string     // null = comum, string = fração individual
  numeroContador: string
  tarifa: number        // EUR/unidade
  unidade: string       // kWh, m³
  ativo: boolean
}

interface AlertaConsumo {
  id: string
  contadorId: string
  contadorNome: string
  tipo: 'consumo_anormal' | 'fuga_agua' | 'limite_orcamental'
  severidade: SeveridadeAlerta
  estado: EstadoAlerta
  mensagem: string
  valor: number
  limiar: number
  dataCriacao: string
}

interface ConfigAlerta {
  id: string
  tipo: 'consumo_anormal' | 'fuga_agua' | 'limite_orcamental'
  limiarPercentagem: number   // ex: 20 para consumo_anormal
  limiteValor?: number        // para limite_orcamental
  ativo: boolean
}

interface LembreteRegisto {
  id: string
  contadorId: string
  diaMes: number              // dia do mês para lembrete
  ativo: boolean
}

interface Props {
  user: User
  userRole: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const TIPO_UTILIDADE_CONFIG: Record<TipoUtilidade, { emoji: string; label: string; unidade: string; cor: string; corBarra: string }> = {
  eletricidade: { emoji: '⚡', label: 'Eletricidade', unidade: 'kWh', cor: '#F59E0B', corBarra: '#F59E0B' },
  agua:         { emoji: '💧', label: 'Água',         unidade: 'm³',  cor: '#3B82F6', corBarra: '#3B82F6' },
  gas:          { emoji: '🔥', label: 'Gás',          unidade: 'm³',  cor: '#EF4444', corBarra: '#EF4444' },
}

const SEVERIDADE_CONFIG: Record<SeveridadeAlerta, { label: string; bg: string; color: string; dot: string }> = {
  info:    { label: 'Info',     bg: '#E6F4F2', color: '#1A7A6E', dot: '#1A7A6E' },
  aviso:   { label: 'Aviso',   bg: '#FEF5E4', color: '#D4830A', dot: '#D4830A' },
  critico: { label: 'Critico', bg: '#FDECEA', color: '#C0392B', dot: '#C0392B' },
}

const ESTADO_ALERTA_CONFIG: Record<EstadoAlerta, { label: string; bg: string; color: string }> = {
  ativo:        { label: 'Ativo',        bg: '#FDECEA', color: '#C0392B' },
  reconhecido:  { label: 'Reconhecido',  bg: '#FEF5E4', color: '#D4830A' },
  resolvido:    { label: 'Resolvido',    bg: '#E6F4F2', color: '#1A7A6E' },
}

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const formatEur = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)

const formatNum = (n: number, decimals = 1) =>
  new Intl.NumberFormat('pt-PT', { maximumFractionDigits: decimals }).format(n)

const getMesLabel = (mesStr: string) => {
  const [y, m] = mesStr.split('-')
  return `${MESES_PT[parseInt(m) - 1]} ${y}`
}

// ─── Dados demo ──────────────────────────────────────────────────────────────

const gerarDadosDemo = (userId: string) => {
  const hoje = new Date()
  const contadores: Contador[] = [
    { id: 'c1', nome: 'Contador Geral Eletricidade', tipo: 'eletricidade', edificioNom: 'Edifício Aurora', fracaoId: undefined, numeroContador: 'EL-2024-001', tarifa: 0.16, unidade: 'kWh', ativo: true },
    { id: 'c2', nome: 'Contador Geral Água', tipo: 'agua', edificioNom: 'Edifício Aurora', fracaoId: undefined, numeroContador: 'AG-2024-001', tarifa: 2.85, unidade: 'm³', ativo: true },
    { id: 'c3', nome: 'Contador Gás Comum', tipo: 'gas', edificioNom: 'Edifício Aurora', fracaoId: undefined, numeroContador: 'GS-2024-001', tarifa: 0.08, unidade: 'm³', ativo: true },
    { id: 'c4', nome: 'Fração A - Eletricidade', tipo: 'eletricidade', edificioNom: 'Edifício Aurora', fracaoId: 'Fração A', numeroContador: 'EL-2024-A01', tarifa: 0.16, unidade: 'kWh', ativo: true },
    { id: 'c5', nome: 'Fração B - Água', tipo: 'agua', edificioNom: 'Edifício Aurora', fracaoId: 'Fração B', numeroContador: 'AG-2024-B01', tarifa: 2.85, unidade: 'm³', ativo: true },
  ]

  const leituras: Leitura[] = []
  const consumosBase: Record<string, number[]> = {
    c1: [1200, 1150, 980, 1050, 1300, 1250],
    c2: [45, 42, 38, 40, 52, 48],
    c3: [320, 310, 180, 150, 200, 280],
    c4: [280, 270, 240, 260, 310, 290],
    c5: [12, 11, 10, 11, 14, 13],
  }

  for (const cId of Object.keys(consumosBase)) {
    const cnt = contadores.find(c => c.id === cId)!
    let leituraAcum = 10000 + Math.floor(Math.random() * 5000)
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const mesStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const consumo = consumosBase[cId][5 - i] + Math.floor(Math.random() * 30 - 15)
      const leituraAnterior = leituraAcum
      leituraAcum += consumo
      leituras.push({
        id: `l-${cId}-${mesStr}`,
        contadorId: cId,
        mes: mesStr,
        leituraAnterior,
        leituraAtual: leituraAcum,
        consumo,
        custoEstimado: consumo * cnt.tarifa,
        registadoPor: 'Sistema',
        dataRegisto: d.toISOString(),
      })
    }
  }

  const alertas: AlertaConsumo[] = [
    {
      id: 'a1', contadorId: 'c2', contadorNome: 'Contador Geral Água',
      tipo: 'consumo_anormal', severidade: 'aviso', estado: 'ativo',
      mensagem: 'Consumo de água 28% acima da média dos últimos 3 meses',
      valor: 52, limiar: 41.7, dataCriacao: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 2).toISOString(),
    },
    {
      id: 'a2', contadorId: 'c1', contadorNome: 'Contador Geral Eletricidade',
      tipo: 'limite_orcamental', severidade: 'info', estado: 'reconhecido',
      mensagem: 'Custo mensal de eletricidade atingiu 85% do limite orçamental',
      valor: 208, limiar: 250, dataCriacao: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 5).toISOString(),
    },
  ]

  const configAlertas: ConfigAlerta[] = [
    { id: 'ca1', tipo: 'consumo_anormal', limiarPercentagem: 20, ativo: true },
    { id: 'ca2', tipo: 'fuga_agua', limiarPercentagem: 15, ativo: true },
    { id: 'ca3', tipo: 'limite_orcamental', limiarPercentagem: 0, limiteValor: 500, ativo: true },
  ]

  return { contadores, leituras, alertas, configAlertas }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function MonitorizacaoConsumosSection({ user, userRole }: Props) {
  const STORAGE_KEY = `fixit_consumos_${user.id}`

  const [tab, setTab] = useState<'dashboard' | 'consumos' | 'alertas' | 'configuracao'>('dashboard')
  const [contadores, setContadores] = useState<Contador[]>([])
  const [leituras, setLeituras] = useState<Leitura[]>([])
  const [alertas, setAlertas] = useState<AlertaConsumo[]>([])
  const [configAlertas, setConfigAlertas] = useState<ConfigAlerta[]>([])
  const [lembretes, setLembretes] = useState<LembreteRegisto[]>([])

  // Forms
  const [showFormLeitura, setShowFormLeitura] = useState(false)
  const [formContadorId, setFormContadorId] = useState('')
  const [formLeituraAtual, setFormLeituraAtual] = useState('')
  const [showFormContador, setShowFormContador] = useState(false)
  const [fcNome, setFcNome] = useState('')
  const [fcTipo, setFcTipo] = useState<TipoUtilidade>('eletricidade')
  const [fcEdificio, setFcEdificio] = useState('')
  const [fcFracao, setFcFracao] = useState('')
  const [fcNumero, setFcNumero] = useState('')
  const [fcTarifa, setFcTarifa] = useState('')

  // Consumos filters
  const [filtroTipo, setFiltroTipo] = useState<TipoUtilidade | 'todos'>('todos')
  const [filtroContador, setFiltroContador] = useState<string>('todos')

  // ── Storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        setContadores(data.contadores || [])
        setLeituras(data.leituras || [])
        setAlertas(data.alertas || [])
        setConfigAlertas(data.configAlertas || [])
        setLembretes(data.lembretes || [])
      } else {
        const demo = gerarDadosDemo(user.id)
        setContadores(demo.contadores)
        setLeituras(demo.leituras)
        setAlertas(demo.alertas)
        setConfigAlertas(demo.configAlertas)
      }
    } catch { /* ignore */ }
  }, [])

  const saveAll = (c?: Contador[], l?: Leitura[], a?: AlertaConsumo[], ca?: ConfigAlerta[], lem?: LembreteRegisto[]) => {
    const data = {
      contadores: c ?? contadores,
      leituras: l ?? leituras,
      alertas: a ?? alertas,
      configAlertas: ca ?? configAlertas,
      lembretes: lem ?? lembretes,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  useEffect(() => { saveAll() }, [contadores, leituras, alertas, configAlertas, lembretes])

  // ── Computed data
  const ultimos6Meses = useMemo(() => {
    const meses: string[] = []
    const hoje = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return meses
  }, [])

  const kpis = useMemo(() => {
    const mesAtual = ultimos6Meses[ultimos6Meses.length - 1]
    const mesAnterior = ultimos6Meses[ultimos6Meses.length - 2]
    const leiturasAtual = leituras.filter(l => l.mes === mesAtual)
    const leiturasAnterior = leituras.filter(l => l.mes === mesAnterior)

    const porTipo = (tipo: TipoUtilidade, lista: Leitura[]) => {
      const ids = contadores.filter(c => c.tipo === tipo && !c.fracaoId).map(c => c.id)
      return lista.filter(l => ids.includes(l.contadorId)).reduce((s, l) => s + l.consumo, 0)
    }

    const custoTotal = (lista: Leitura[]) => lista.reduce((s, l) => s + l.custoEstimado, 0)

    const eletAtual = porTipo('eletricidade', leiturasAtual)
    const eletAnterior = porTipo('eletricidade', leiturasAnterior)
    const aguaAtual = porTipo('agua', leiturasAtual)
    const aguaAnterior = porTipo('agua', leiturasAnterior)
    const gasAtual = porTipo('gas', leiturasAtual)
    const gasAnterior = porTipo('gas', leiturasAnterior)
    const custoAtual = custoTotal(leiturasAtual)
    const custoAnterior = custoTotal(leiturasAnterior)

    const variacao = (atual: number, anterior: number) => anterior > 0 ? ((atual - anterior) / anterior * 100) : 0

    return {
      eletricidade: { valor: eletAtual, variacao: variacao(eletAtual, eletAnterior) },
      agua: { valor: aguaAtual, variacao: variacao(aguaAtual, aguaAnterior) },
      gas: { valor: gasAtual, variacao: variacao(gasAtual, gasAnterior) },
      custoTotal: { valor: custoAtual, variacao: variacao(custoAtual, custoAnterior) },
    }
  }, [leituras, contadores, ultimos6Meses])

  const dadosGrafico = useMemo(() => {
    const tipos: TipoUtilidade[] = ['eletricidade', 'agua', 'gas']
    const resultado: Record<TipoUtilidade, number[]> = { eletricidade: [], agua: [], gas: [] }
    const maxVals: Record<TipoUtilidade, number> = { eletricidade: 0, agua: 0, gas: 0 }

    for (const tipo of tipos) {
      const idsComuns = contadores.filter(c => c.tipo === tipo && !c.fracaoId).map(c => c.id)
      for (const mes of ultimos6Meses) {
        const total = leituras
          .filter(l => l.mes === mes && idsComuns.includes(l.contadorId))
          .reduce((s, l) => s + l.consumo, 0)
        resultado[tipo].push(total)
        if (total > maxVals[tipo]) maxVals[tipo] = total
      }
    }

    return { resultado, maxVals }
  }, [leituras, contadores, ultimos6Meses])

  const dadosAnoAnterior = useMemo(() => {
    const tipos: TipoUtilidade[] = ['eletricidade', 'agua', 'gas']
    const resultado: Record<TipoUtilidade, number[]> = { eletricidade: [], agua: [], gas: [] }
    const hoje = new Date()
    const mesesAnoAnterior: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear() - 1, hoje.getMonth() - i, 1)
      mesesAnoAnterior.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    for (const tipo of tipos) {
      const idsComuns = contadores.filter(c => c.tipo === tipo && !c.fracaoId).map(c => c.id)
      for (const mes of mesesAnoAnterior) {
        const total = leituras
          .filter(l => l.mes === mes && idsComuns.includes(l.contadorId))
          .reduce((s, l) => s + l.consumo, 0)
        resultado[tipo].push(total)
      }
    }
    return resultado
  }, [leituras, contadores, ultimos6Meses])

  // ── Actions
  const adicionarLeitura = () => {
    if (!formContadorId || !formLeituraAtual) return
    const cnt = contadores.find(c => c.id === formContadorId)
    if (!cnt) return
    const hoje = new Date()
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
    const leiturasContador = leituras.filter(l => l.contadorId === formContadorId).sort((a, b) => b.mes.localeCompare(a.mes))
    const leituraAnterior = leiturasContador.length > 0 ? leiturasContador[0].leituraAtual : 0
    const leituraAtualNum = parseFloat(formLeituraAtual) || 0
    const consumo = Math.max(0, leituraAtualNum - leituraAnterior)
    const nova: Leitura = {
      id: crypto.randomUUID(),
      contadorId: formContadorId,
      mes: mesAtual,
      leituraAnterior,
      leituraAtual: leituraAtualNum,
      consumo,
      custoEstimado: consumo * cnt.tarifa,
      registadoPor: user.email || 'Utilizador',
      dataRegisto: hoje.toISOString(),
    }
    setLeituras(prev => [nova, ...prev])
    setFormContadorId('')
    setFormLeituraAtual('')
    setShowFormLeitura(false)
  }

  const adicionarContador = () => {
    if (!fcNome.trim() || !fcEdificio.trim()) return
    const cfg = TIPO_UTILIDADE_CONFIG[fcTipo]
    const novo: Contador = {
      id: crypto.randomUUID(),
      nome: fcNome.trim(),
      tipo: fcTipo,
      edificioNom: fcEdificio.trim(),
      fracaoId: fcFracao.trim() || undefined,
      numeroContador: fcNumero.trim(),
      tarifa: parseFloat(fcTarifa) || cfg.cor === '#3B82F6' ? 2.85 : 0.16,
      unidade: cfg.unidade,
      ativo: true,
    }
    setContadores(prev => [novo, ...prev])
    setFcNome(''); setFcTipo('eletricidade'); setFcEdificio(''); setFcFracao(''); setFcNumero(''); setFcTarifa('')
    setShowFormContador(false)
  }

  const reconhecerAlerta = (id: string) => {
    setAlertas(prev => prev.map(a => a.id === id ? { ...a, estado: 'reconhecido' as EstadoAlerta } : a))
  }

  const resolverAlerta = (id: string) => {
    setAlertas(prev => prev.map(a => a.id === id ? { ...a, estado: 'resolvido' as EstadoAlerta } : a))
  }

  const toggleConfigAlerta = (id: string) => {
    setConfigAlertas(prev => prev.map(ca => ca.id === id ? { ...ca, ativo: !ca.ativo } : ca))
  }

  const updateLimiar = (id: string, val: number) => {
    setConfigAlertas(prev => prev.map(ca => ca.id === id ? { ...ca, limiarPercentagem: val } : ca))
  }

  const updateLimiteValor = (id: string, val: number) => {
    setConfigAlertas(prev => prev.map(ca => ca.id === id ? { ...ca, limiteValor: val } : ca))
  }

  // Filtered leituras for consumos tab
  const leiturasFiltradas = useMemo(() => {
    let filtered = leituras
    if (filtroTipo !== 'todos') {
      const ids = contadores.filter(c => c.tipo === filtroTipo).map(c => c.id)
      filtered = filtered.filter(l => ids.includes(l.contadorId))
    }
    if (filtroContador !== 'todos') {
      filtered = filtered.filter(l => l.contadorId === filtroContador)
    }
    return filtered.sort((a, b) => b.mes.localeCompare(a.mes) || a.contadorId.localeCompare(b.contadorId))
  }, [leituras, contadores, filtroTipo, filtroContador])

  const alertasAtivos = useMemo(() => alertas.filter(a => a.estado !== 'resolvido'), [alertas])

  // ── Tabs
  const tabs = [
    { key: 'dashboard' as const, label: 'Dashboard', icon: '📊' },
    { key: 'consumos' as const, label: 'Consumos', icon: '📈' },
    { key: 'alertas' as const, label: 'Alertas', icon: '🔔', badge: alertasAtivos.length },
    { key: 'configuracao' as const, label: 'Configuracao', icon: '⚙️' },
  ]

  // ── Styles
  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 12, border: '1px solid var(--sd-border, #E4DDD0)',
    padding: 20, marginBottom: 16,
  }
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-3, #8B8178)', marginBottom: 6, display: 'block' }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--sd-border, #E4DDD0)',
    fontSize: 14, color: 'var(--sd-navy, #0D1B2E)', background: 'var(--sd-cream, #F7F4EE)',
    outline: 'none',
  }
  const btnPrimary: React.CSSProperties = {
    padding: '10px 20px', borderRadius: 8, border: 'none',
    background: 'var(--sd-gold, #C9A84C)', color: '#fff', fontSize: 14, fontWeight: 600,
    cursor: 'pointer',
  }
  const btnSecondary: React.CSSProperties = {
    padding: '10px 20px', borderRadius: 8, border: '1px solid var(--sd-border, #E4DDD0)',
    background: '#fff', color: 'var(--sd-navy, #0D1B2E)', fontSize: 14, fontWeight: 500,
    cursor: 'pointer',
  }

  // ── Render
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
          ⚡ Monitorizacao de Consumos
        </h2>
        <p style={{ fontSize: 14, color: 'var(--sd-ink-3, #8B8178)', margin: '4px 0 0' }}>
          Eletricidade, agua e gas — leituras, custos e alertas
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--sd-border, #E4DDD0)', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 18px', border: 'none', background: 'transparent',
              fontSize: 14, fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? 'var(--sd-gold, #C9A84C)' : 'var(--sd-ink-3, #8B8178)',
              borderBottom: tab === t.key ? '2px solid var(--sd-gold, #C9A84C)' : '2px solid transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              marginBottom: -1, transition: 'all 0.15s',
            }}
          >
            <span>{t.icon}</span> {t.label}
            {t.badge ? (
              <span style={{
                background: '#C0392B', color: '#fff', fontSize: 10, fontWeight: 700,
                borderRadius: 10, padding: '1px 7px', marginLeft: 2,
              }}>{t.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ═══════════ TAB: Dashboard ═══════════ */}
      {tab === 'dashboard' && (
        <div>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            {([
              { label: 'Eletricidade', valor: `${formatNum(kpis.eletricidade.valor)} kWh`, variacao: kpis.eletricidade.variacao, emoji: '⚡', cor: '#F59E0B' },
              { label: 'Agua', valor: `${formatNum(kpis.agua.valor)} m3`, variacao: kpis.agua.variacao, emoji: '💧', cor: '#3B82F6' },
              { label: 'Gas', valor: `${formatNum(kpis.gas.valor)} m3`, variacao: kpis.gas.variacao, emoji: '🔥', cor: '#EF4444' },
              { label: 'Custo total', valor: formatEur(kpis.custoTotal.valor), variacao: kpis.custoTotal.variacao, emoji: '💰', cor: 'var(--sd-gold, #C9A84C)' },
            ] as const).map((kpi, i) => (
              <div key={i} style={{ ...cardStyle, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--sd-ink-3, #8B8178)', marginBottom: 4 }}>
                      {kpi.emoji} {kpi.label}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)' }}>
                      {kpi.valor}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                    background: kpi.variacao > 0 ? '#FDECEA' : '#E6F4F2',
                    color: kpi.variacao > 0 ? '#C0392B' : '#1A7A6E',
                  }}>
                    {kpi.variacao > 0 ? '+' : ''}{kpi.variacao.toFixed(1)}%
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8B8178)', marginTop: 6 }}>
                  vs. mes anterior
                </div>
              </div>
            ))}
          </div>

          {/* Bar Charts per utility */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 24 }}>
            {(['eletricidade', 'agua', 'gas'] as TipoUtilidade[]).map(tipo => {
              const cfg = TIPO_UTILIDADE_CONFIG[tipo]
              const vals = dadosGrafico.resultado[tipo]
              const maxVal = dadosGrafico.maxVals[tipo] || 1
              const valsAnoAnt = dadosAnoAnterior[tipo]
              return (
                <div key={tipo} style={cardStyle}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 16 }}>
                    {cfg.emoji} {cfg.label} ({cfg.unidade}) — Ultimos 6 meses
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
                    {ultimos6Meses.map((mes, i) => {
                      const h = maxVal > 0 ? (vals[i] / maxVal * 110) : 0
                      const hAnt = maxVal > 0 ? (valsAnoAnt[i] / maxVal * 110) : 0
                      return (
                        <div key={mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 110 }}>
                            {/* Ano anterior (transparente) */}
                            <div
                              title={`Ano anterior: ${formatNum(valsAnoAnt[i])}`}
                              style={{
                                width: 14, height: Math.max(2, hAnt), borderRadius: '4px 4px 0 0',
                                background: cfg.corBarra, opacity: 0.2,
                              }}
                            />
                            {/* Ano atual */}
                            <div
                              title={`${formatNum(vals[i])} ${cfg.unidade}`}
                              style={{
                                width: 14, height: Math.max(2, h), borderRadius: '4px 4px 0 0',
                                background: cfg.corBarra, opacity: 0.85,
                              }}
                            />
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--sd-ink-3, #8B8178)' }}>
                            {getMesLabel(mes).split(' ')[0]}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: 'var(--sd-ink-3, #8B8178)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: cfg.corBarra, opacity: 0.85, display: 'inline-block' }} />
                      Ano atual
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: cfg.corBarra, opacity: 0.2, display: 'inline-block' }} />
                      Ano anterior
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Active alerts summary */}
          {alertasAtivos.length > 0 && (
            <div style={{ ...cardStyle, borderLeft: '4px solid #D4830A' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 10 }}>
                🔔 Alertas ativos ({alertasAtivos.length})
              </div>
              {alertasAtivos.slice(0, 3).map(a => {
                const sev = SEVERIDADE_CONFIG[a.severidade]
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: sev.dot, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--sd-ink-2, #5A5149)', flex: 1 }}>{a.mensagem}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: sev.bg, color: sev.color, fontWeight: 600 }}>{sev.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ TAB: Consumos ═══════════ */}
      {tab === 'consumos' && (
        <div>
          {/* Filters & add button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select
                value={filtroTipo}
                onChange={e => { setFiltroTipo(e.target.value as TipoUtilidade | 'todos'); setFiltroContador('todos') }}
                style={{ ...inputStyle, width: 'auto' }}
              >
                <option value="todos">Todos os tipos</option>
                {Object.entries(TIPO_UTILIDADE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
              <select value={filtroContador} onChange={e => setFiltroContador(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                <option value="todos">Todos os contadores</option>
                {contadores
                  .filter(c => filtroTipo === 'todos' || c.tipo === filtroTipo)
                  .map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <button onClick={() => setShowFormLeitura(true)} style={btnPrimary}>
              + Registar leitura
            </button>
          </div>

          {/* Add leitura form */}
          {showFormLeitura && (
            <div style={{ ...cardStyle, borderLeft: '4px solid var(--sd-gold, #C9A84C)' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 14 }}>
                Nova leitura
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Contador</label>
                  <select value={formContadorId} onChange={e => setFormContadorId(e.target.value)} style={inputStyle}>
                    <option value="">Selecionar...</option>
                    {contadores.filter(c => c.ativo).map(c => (
                      <option key={c.id} value={c.id}>{c.nome} ({TIPO_UTILIDADE_CONFIG[c.tipo].emoji})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Leitura atual</label>
                  <input
                    type="number"
                    value={formLeituraAtual}
                    onChange={e => setFormLeituraAtual(e.target.value)}
                    placeholder="Ex: 12345"
                    style={inputStyle}
                  />
                </div>
              </div>
              {formContadorId && (() => {
                const cnt = contadores.find(c => c.id === formContadorId)
                const ultimaLeitura = leituras
                  .filter(l => l.contadorId === formContadorId)
                  .sort((a, b) => b.mes.localeCompare(a.mes))[0]
                if (!cnt) return null
                return (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--sd-ink-3, #8B8178)' }}>
                    Ultima leitura: {ultimaLeitura ? formatNum(ultimaLeitura.leituraAtual, 0) : 'N/A'} — Tarifa: {formatEur(cnt.tarifa)}/{cnt.unidade}
                  </div>
                )
              })()}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={adicionarLeitura} style={btnPrimary}>Registar</button>
                <button onClick={() => { setShowFormLeitura(false); setFormContadorId(''); setFormLeituraAtual('') }} style={btnSecondary}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Readings table */}
          <div style={cardStyle}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--sd-border, #E4DDD0)' }}>
                    {['Contador', 'Tipo', 'Mes', 'Leit. anterior', 'Leit. atual', 'Consumo', 'Custo est.'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 8px', fontSize: 11, fontWeight: 600, color: 'var(--sd-ink-3, #8B8178)', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leiturasFiltradas.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--sd-ink-3, #8B8178)' }}>Nenhuma leitura registada</td></tr>
                  ) : leiturasFiltradas.map(l => {
                    const cnt = contadores.find(c => c.id === l.contadorId)
                    const cfg = cnt ? TIPO_UTILIDADE_CONFIG[cnt.tipo] : null
                    return (
                      <tr key={l.id} style={{ borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 500, color: 'var(--sd-navy, #0D1B2E)' }}>
                          {cnt?.nome || l.contadorId}
                          {cnt?.fracaoId && <span style={{ fontSize: 11, color: 'var(--sd-ink-3, #8B8178)', marginLeft: 6 }}>({cnt.fracaoId})</span>}
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          {cfg && (
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: cfg.cor + '18', color: cfg.cor, fontWeight: 600 }}>
                              {cfg.emoji} {cfg.label}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 8px', color: 'var(--sd-ink-2, #5A5149)' }}>{getMesLabel(l.mes)}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--sd-ink-2, #5A5149)' }}>{formatNum(l.leituraAnterior, 0)}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--sd-ink-2, #5A5149)' }}>{formatNum(l.leituraAtual, 0)}</td>
                        <td style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>
                          {formatNum(l.consumo)} {cnt?.unidade}
                        </td>
                        <td style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--sd-gold, #C9A84C)' }}>{formatEur(l.custoEstimado)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-fraction breakdown */}
          {contadores.some(c => c.fracaoId) && (
            <div style={cardStyle}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 12 }}>
                📊 Repartição por fracao
              </div>
              {contadores.filter(c => c.fracaoId).map(cnt => {
                const ultimaLeitura = leituras
                  .filter(l => l.contadorId === cnt.id)
                  .sort((a, b) => b.mes.localeCompare(a.mes))[0]
                const cfg = TIPO_UTILIDADE_CONFIG[cnt.tipo]
                return (
                  <div key={cnt.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: cfg.cor + '18', color: cfg.cor, fontWeight: 600 }}>
                      {cfg.emoji}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--sd-navy, #0D1B2E)' }}>{cnt.fracaoId} — {cnt.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8B8178)' }}>N.º {cnt.numeroContador}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>
                        {ultimaLeitura ? `${formatNum(ultimaLeitura.consumo)} ${cnt.unidade}` : 'N/A'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--sd-gold, #C9A84C)' }}>
                        {ultimaLeitura ? formatEur(ultimaLeitura.custoEstimado) : ''}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ TAB: Alertas ═══════════ */}
      {tab === 'alertas' && (
        <div>
          {/* Alert rules summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Consumo anormal', desc: '>20% vs media', emoji: '📊', count: alertas.filter(a => a.tipo === 'consumo_anormal' && a.estado !== 'resolvido').length },
              { label: 'Fuga de agua', desc: 'Consumo noturno', emoji: '🚿', count: alertas.filter(a => a.tipo === 'fuga_agua' && a.estado !== 'resolvido').length },
              { label: 'Limite orcamental', desc: 'Custo excedido', emoji: '💶', count: alertas.filter(a => a.tipo === 'limite_orcamental' && a.estado !== 'resolvido').length },
            ].map((rule, i) => (
              <div key={i} style={{ ...cardStyle, padding: 16 }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{rule.emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{rule.label}</div>
                <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8B8178)', marginBottom: 8 }}>{rule.desc}</div>
                <div style={{
                  fontSize: 18, fontWeight: 700,
                  color: rule.count > 0 ? '#C0392B' : '#1A7A6E',
                }}>{rule.count} {rule.count === 1 ? 'alerta' : 'alertas'}</div>
              </div>
            ))}
          </div>

          {/* Active alerts list */}
          <div style={cardStyle}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 14 }}>
              Alertas ativos
            </div>
            {alertas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--sd-ink-3, #8B8178)', fontSize: 13 }}>
                Nenhum alerta registado
              </div>
            ) : alertas.sort((a, b) => {
              const ord: Record<EstadoAlerta, number> = { ativo: 0, reconhecido: 1, resolvido: 2 }
              return ord[a.estado] - ord[b.estado]
            }).map(a => {
              const sev = SEVERIDADE_CONFIG[a.severidade]
              const est = ESTADO_ALERTA_CONFIG[a.estado]
              return (
                <div key={a.id} style={{
                  padding: 14, marginBottom: 10, borderRadius: 10,
                  border: '1px solid var(--sd-border, #E4DDD0)',
                  background: a.estado === 'ativo' ? '#FFFBF5' : '#fff',
                  opacity: a.estado === 'resolvido' ? 0.6 : 1,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: sev.dot }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{a.contadorNome}</span>
                        <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 4, background: sev.bg, color: sev.color, fontWeight: 600 }}>{sev.label}</span>
                        <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 4, background: est.bg, color: est.color, fontWeight: 600 }}>{est.label}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #5A5149)', marginBottom: 4 }}>{a.mensagem}</div>
                      <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8B8178)' }}>
                        Valor: {formatNum(a.valor)} | Limiar: {formatNum(a.limiar)} — {new Date(a.dataCriacao).toLocaleDateString('pt-PT')}
                      </div>
                    </div>
                    {a.estado !== 'resolvido' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        {a.estado === 'ativo' && (
                          <button onClick={() => reconhecerAlerta(a.id)} style={{ ...btnSecondary, padding: '6px 12px', fontSize: 12 }}>
                            Reconhecer
                          </button>
                        )}
                        <button onClick={() => resolverAlerta(a.id)} style={{ ...btnPrimary, padding: '6px 12px', fontSize: 12, background: '#1A7A6E' }}>
                          Resolver
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══════════ TAB: Configuração ═══════════ */}
      {tab === 'configuracao' && (
        <div>
          {/* Meters list */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>
                Contadores registados
              </div>
              <button onClick={() => setShowFormContador(true)} style={btnPrimary}>
                + Adicionar contador
              </button>
            </div>

            {showFormContador && (
              <div style={{ padding: 16, marginBottom: 16, borderRadius: 10, border: '1px solid var(--sd-gold, #C9A84C)', background: '#FFFBF5' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 12 }}>Novo contador</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Nome</label>
                    <input value={fcNome} onChange={e => setFcNome(e.target.value)} placeholder="Ex: Contador Geral Agua" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Tipo</label>
                    <select value={fcTipo} onChange={e => setFcTipo(e.target.value as TipoUtilidade)} style={inputStyle}>
                      {Object.entries(TIPO_UTILIDADE_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v.emoji} {v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Edificio</label>
                    <input value={fcEdificio} onChange={e => setFcEdificio(e.target.value)} placeholder="Nome do edificio" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Fracao (vazio = comum)</label>
                    <input value={fcFracao} onChange={e => setFcFracao(e.target.value)} placeholder="Ex: Fracao A" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>N.º do contador</label>
                    <input value={fcNumero} onChange={e => setFcNumero(e.target.value)} placeholder="Ex: EL-2024-001" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Tarifa (EUR/unidade)</label>
                    <input type="number" step="0.01" value={fcTarifa} onChange={e => setFcTarifa(e.target.value)} placeholder="Ex: 0.16" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button onClick={adicionarContador} style={btnPrimary}>Guardar</button>
                  <button onClick={() => { setShowFormContador(false); setFcNome(''); setFcTipo('eletricidade'); setFcEdificio(''); setFcFracao(''); setFcNumero(''); setFcTarifa('') }} style={btnSecondary}>Cancelar</button>
                </div>
              </div>
            )}

            {contadores.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--sd-ink-3, #8B8178)', fontSize: 13 }}>
                Nenhum contador registado
              </div>
            ) : contadores.map(cnt => {
              const cfg = TIPO_UTILIDADE_CONFIG[cnt.tipo]
              return (
                <div key={cnt.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                  borderBottom: '1px solid var(--sd-border, #E4DDD0)',
                }}>
                  <span style={{ fontSize: 20 }}>{cfg.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{cnt.nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8B8178)' }}>
                      {cnt.edificioNom}{cnt.fracaoId ? ` — ${cnt.fracaoId}` : ' (comum)'} | N.º {cnt.numeroContador}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-gold, #C9A84C)' }}>
                      {formatEur(cnt.tarifa)}/{cnt.unidade}
                    </div>
                    <div style={{
                      fontSize: 11, padding: '1px 6px', borderRadius: 4,
                      background: cnt.ativo ? '#E6F4F2' : '#FDECEA',
                      color: cnt.ativo ? '#1A7A6E' : '#C0392B',
                      fontWeight: 600, display: 'inline-block', marginTop: 2,
                    }}>
                      {cnt.ativo ? 'Ativo' : 'Inativo'}
                    </div>
                  </div>
                  <button
                    onClick={() => setContadores(prev => prev.map(c => c.id === cnt.id ? { ...c, ativo: !c.ativo } : c))}
                    style={{ ...btnSecondary, padding: '6px 10px', fontSize: 11 }}
                  >
                    {cnt.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Alert thresholds */}
          <div style={cardStyle}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 14 }}>
              🔔 Limiares de alerta
            </div>
            {configAlertas.map(ca => (
              <div key={ca.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                borderBottom: '1px solid var(--sd-border, #E4DDD0)',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>
                    {ca.tipo === 'consumo_anormal' ? '📊 Consumo anormal' :
                     ca.tipo === 'fuga_agua' ? '🚿 Fuga de agua' :
                     '💶 Limite orcamental'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8B8178)' }}>
                    {ca.tipo === 'consumo_anormal' ? `Alerta quando consumo excede ${ca.limiarPercentagem}% da media` :
                     ca.tipo === 'fuga_agua' ? `Alerta quando consumo noturno excede ${ca.limiarPercentagem}% do normal` :
                     `Alerta quando custo mensal excede ${formatEur(ca.limiteValor || 0)}`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {ca.tipo !== 'limite_orcamental' ? (
                    <input
                      type="number"
                      value={ca.limiarPercentagem}
                      onChange={e => updateLimiar(ca.id, parseInt(e.target.value) || 0)}
                      style={{ ...inputStyle, width: 70, textAlign: 'center' as const }}
                      min={0}
                      max={100}
                    />
                  ) : (
                    <input
                      type="number"
                      value={ca.limiteValor || 0}
                      onChange={e => updateLimiteValor(ca.id, parseFloat(e.target.value) || 0)}
                      style={{ ...inputStyle, width: 100, textAlign: 'center' as const }}
                      step={10}
                    />
                  )}
                  <span style={{ fontSize: 12, color: 'var(--sd-ink-3, #8B8178)' }}>
                    {ca.tipo !== 'limite_orcamental' ? '%' : 'EUR'}
                  </span>
                  <button
                    onClick={() => toggleConfigAlerta(ca.id)}
                    style={{
                      padding: '6px 12px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600,
                      background: ca.ativo ? '#E6F4F2' : '#FDECEA',
                      color: ca.ativo ? '#1A7A6E' : '#C0392B',
                      cursor: 'pointer',
                    }}
                  >
                    {ca.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Reading schedule reminders */}
          <div style={cardStyle}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 14 }}>
              📅 Lembretes de leitura
            </div>
            <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8B8178)', marginBottom: 14 }}>
              Configure lembretes mensais para registar leituras dos contadores.
            </p>
            {contadores.filter(c => c.ativo).map(cnt => {
              const cfg = TIPO_UTILIDADE_CONFIG[cnt.tipo]
              const lembrete = lembretes.find(l => l.contadorId === cnt.id)
              return (
                <div key={cnt.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                  borderBottom: '1px solid var(--sd-border, #E4DDD0)',
                }}>
                  <span>{cfg.emoji}</span>
                  <div style={{ flex: 1, fontSize: 13, color: 'var(--sd-navy, #0D1B2E)' }}>{cnt.nome}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--sd-ink-3, #8B8178)' }}>Dia:</span>
                    <input
                      type="number"
                      min={1} max={28}
                      value={lembrete?.diaMes || 1}
                      onChange={e => {
                        const dia = parseInt(e.target.value) || 1
                        if (lembrete) {
                          setLembretes(prev => prev.map(l => l.id === lembrete.id ? { ...l, diaMes: dia } : l))
                        } else {
                          setLembretes(prev => [...prev, { id: crypto.randomUUID(), contadorId: cnt.id, diaMes: dia, ativo: true }])
                        }
                      }}
                      style={{ ...inputStyle, width: 60, textAlign: 'center' as const }}
                    />
                    <button
                      onClick={() => {
                        if (lembrete) {
                          setLembretes(prev => prev.map(l => l.id === lembrete.id ? { ...l, ativo: !l.ativo } : l))
                        } else {
                          setLembretes(prev => [...prev, { id: crypto.randomUUID(), contadorId: cnt.id, diaMes: 1, ativo: true }])
                        }
                      }}
                      style={{
                        padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600,
                        background: (lembrete?.ativo ?? false) ? '#E6F4F2' : '#F7F4EE',
                        color: (lembrete?.ativo ?? false) ? '#1A7A6E' : 'var(--sd-ink-3, #8B8178)',
                        cursor: 'pointer',
                      }}
                    >
                      {(lembrete?.ativo ?? false) ? 'Ativo' : 'Inativo'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
