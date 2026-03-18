'use client'

import React, { useState, useEffect, useMemo } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoTarifa = 'simples' | 'bi-horario' | 'tri-horario'
type ClasseEnergetica = 'A+' | 'A' | 'B' | 'B-' | 'C' | 'D' | 'E' | 'F'

interface Fornecedor {
  id: string
  nome: string
  logo: string
  tarifaPonta: number      // EUR/kWh
  tarifaVazio: number      // EUR/kWh
  tarifaSuperVazio: number // EUR/kWh
  potencia: number         // EUR/dia
  custoFixo: number        // EUR/mês
  percentagemRenovavel: number // 0-100
  satisfacao: number       // 1-5
  cor: string
}

interface EdificioEnergia {
  id: string
  nome: string
  consumoMensal: number    // kWh
  custoMedio: number       // EUR
  classeEnergetica: ClasseEnergetica
  fornecedorAtual: string
  potenciaContratada: number // kVA
  tipoTarifa: TipoTarifa
}

interface RegistoConsumo {
  mes: string  // YYYY-MM
  edificioId: string
  consumo: number
  custo: number
}

interface Props {
  user: any
  userRole: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const COLORS = {
  navy: '#0D1B2E',
  gold: '#C9A84C',
  text: '#4A5E78',
  border: '#E4DDD0',
  bg: '#F7F4EE',
  white: '#FFFFFF',
  green: '#1A7A6E',
  greenBg: '#E6F4F2',
  red: '#C0392B',
  redBg: '#FDECEA',
  orange: '#D4830A',
  orangeBg: '#FEF5E4',
}

const CLASSE_CORES: Record<ClasseEnergetica, string> = {
  'A+': '#006837',
  'A':  '#009a6e',
  'B':  '#51b84b',
  'B-': '#abce50',
  'C':  '#f7e64b',
  'D':  '#f0b429',
  'E':  '#e8731a',
  'F':  '#d9231e',
}

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const formatEur = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)

const formatNum = (n: number, decimals = 0) =>
  new Intl.NumberFormat('pt-PT', { maximumFractionDigits: decimals }).format(n)

const FORNECEDORES: Fornecedor[] = [
  { id: 'edp', nome: 'EDP Comercial', logo: '⚡', tarifaPonta: 0.1652, tarifaVazio: 0.0897, tarifaSuperVazio: 0.0714, potencia: 0.4128, custoFixo: 3.20, percentagemRenovavel: 62, satisfacao: 3.8, cor: '#E21E26' },
  { id: 'galp', nome: 'Galp Energia', logo: '🔶', tarifaPonta: 0.1598, tarifaVazio: 0.0872, tarifaSuperVazio: 0.0698, potencia: 0.3985, custoFixo: 2.95, percentagemRenovavel: 45, satisfacao: 3.6, cor: '#FF6600' },
  { id: 'endesa', nome: 'Endesa', logo: '🟢', tarifaPonta: 0.1576, tarifaVazio: 0.0865, tarifaSuperVazio: 0.0702, potencia: 0.4050, custoFixo: 3.10, percentagemRenovavel: 58, satisfacao: 3.5, cor: '#00A651' },
  { id: 'iberdrola', nome: 'Iberdrola', logo: '🌿', tarifaPonta: 0.1610, tarifaVazio: 0.0880, tarifaSuperVazio: 0.0695, potencia: 0.3920, custoFixo: 2.85, percentagemRenovavel: 72, satisfacao: 3.9, cor: '#3C8A2E' },
  { id: 'goldenergy', nome: 'GoldEnergy', logo: '🌞', tarifaPonta: 0.1490, tarifaVazio: 0.0845, tarifaSuperVazio: 0.0680, potencia: 0.3750, custoFixo: 2.50, percentagemRenovavel: 100, satisfacao: 4.1, cor: '#FFB800' },
  { id: 'luzboa', nome: 'Luzboa', logo: '💡', tarifaPonta: 0.1525, tarifaVazio: 0.0855, tarifaSuperVazio: 0.0690, potencia: 0.3880, custoFixo: 2.70, percentagemRenovavel: 100, satisfacao: 4.3, cor: '#0088CC' },
]

const TIPO_TARIFA_LABELS: Record<TipoTarifa, string> = {
  'simples': 'Simples',
  'bi-horario': 'Bi-Horário',
  'tri-horario': 'Tri-Horário',
}

// Proporções de consumo por período para cada tipo de tarifa
const DISTRIBUICAO_CONSUMO: Record<TipoTarifa, { ponta: number; vazio: number; superVazio: number }> = {
  'simples': { ponta: 1.0, vazio: 0, superVazio: 0 },
  'bi-horario': { ponta: 0.55, vazio: 0.45, superVazio: 0 },
  'tri-horario': { ponta: 0.40, vazio: 0.35, superVazio: 0.25 },
}

// ─── Dados demo ──────────────────────────────────────────────────────────────

const gerarDadosDemo = (nomes: string[]): { edificios: EdificioEnergia[]; historico: RegistoConsumo[] } => {
  const classes: ClasseEnergetica[] = ['B', 'C', 'D', 'B-', 'C', 'E']
  const fornecedores = ['edp', 'galp', 'endesa', 'edp', 'iberdrola', 'edp']
  const tiposTarifa: TipoTarifa[] = ['tri-horario', 'bi-horario', 'simples', 'tri-horario', 'bi-horario', 'simples']

  const edificios: EdificioEnergia[] = nomes.slice(0, 6).map((nome, i) => {
    const consumo = 800 + Math.floor(Math.random() * 1200)
    return {
      id: `ed-${i}`,
      nome,
      consumoMensal: consumo,
      custoMedio: consumo * 0.15 + 35,
      classeEnergetica: classes[i % classes.length],
      fornecedorAtual: fornecedores[i % fornecedores.length],
      potenciaContratada: [6.9, 10.35, 13.8, 6.9, 10.35, 13.8][i % 6],
      tipoTarifa: tiposTarifa[i % tiposTarifa.length],
    }
  })

  const historico: RegistoConsumo[] = []
  const hoje = new Date()
  edificios.forEach(ed => {
    for (let m = 11; m >= 0; m--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - m, 1)
      const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const sazonal = [1.15, 1.10, 1.0, 0.90, 0.85, 0.80, 0.78, 0.80, 0.85, 0.95, 1.05, 1.18]
      const consumo = Math.round(ed.consumoMensal * sazonal[d.getMonth()] * (0.9 + Math.random() * 0.2))
      historico.push({ mes, edificioId: ed.id, consumo, custo: consumo * 0.15 + 35 })
    }
  })

  return { edificios, historico }
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function ComparadorEnergiaSection({ user, userRole }: Props) {
  const uid = user?.id || 'anon'
  const STORAGE_KEY = `fixit_syndic_energia_${uid}`

  // State
  const [tab, setTab] = useState<'dashboard' | 'comparar' | 'simulacao' | 'historico'>('dashboard')
  const [edificios, setEdificios] = useState<EdificioEnergia[]>([])
  const [historico, setHistorico] = useState<RegistoConsumo[]>([])
  const [loading, setLoading] = useState(true)

  // Simulação state
  const [simConsumo, setSimConsumo] = useState('1200')
  const [simTarifa, setSimTarifa] = useState<TipoTarifa>('tri-horario')
  const [simFornecedorAtual, setSimFornecedorAtual] = useState('edp')

  // Comparação state
  const [compSortBy, setCompSortBy] = useState<'preco' | 'renovavel' | 'satisfacao'>('preco')

  // Histórico state
  const [histEdificio, setHistEdificio] = useState<string>('todos')

  // ── Carregar dados
  useEffect(() => {
    const carregar = async () => {
      setLoading(true)
      try {
        // Tenta buscar imóveis da API
        const stored = localStorage.getItem(STORAGE_KEY)
        let nomesEdificios: string[] = []
        try {
          const res = await fetch(`/api/syndic/immeubles?user_id=${uid}`)
          if (res.ok) {
            const data = await res.json()
            const imms = data.immeubles || data || []
            nomesEdificios = imms.map((im: any) => im.nom || im.nome || im.name || 'Edifício').slice(0, 6)
          }
        } catch {
          // API falhou — usar fallback
        }

        if (nomesEdificios.length === 0) {
          nomesEdificios = ['Edifício Aurora', 'Edifício Belém', 'Edifício Cascais', 'Edifício Douro']
        }

        if (stored) {
          try {
            const parsed = JSON.parse(stored)
            if (parsed.edificios?.length) {
              setEdificios(parsed.edificios)
              setHistorico(parsed.historico || [])
              setLoading(false)
              return
            }
          } catch { /* ignorar parse error */ }
        }

        const demo = gerarDadosDemo(nomesEdificios)
        setEdificios(demo.edificios)
        setHistorico(demo.historico)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
      } catch {
        const demo = gerarDadosDemo(['Edifício Aurora', 'Edifício Belém', 'Edifício Cascais'])
        setEdificios(demo.edificios)
        setHistorico(demo.historico)
      }
      setLoading(false)
    }
    carregar()
  }, [uid])

  // ── Salvar em localStorage
  useEffect(() => {
    if (!loading && edificios.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ edificios, historico }))
    }
  }, [edificios, historico, loading])

  // ── Calcular custo anual por fornecedor
  const calcularCustoAnual = (consumoMensal: number, tipo: TipoTarifa, fornecedor: Fornecedor): number => {
    const dist = DISTRIBUICAO_CONSUMO[tipo]
    const custoEnergia =
      consumoMensal * dist.ponta * fornecedor.tarifaPonta +
      consumoMensal * dist.vazio * fornecedor.tarifaVazio +
      consumoMensal * dist.superVazio * fornecedor.tarifaSuperVazio
    const custoMensal = custoEnergia + fornecedor.potencia * 30 + fornecedor.custoFixo
    return custoMensal * 12
  }

  // ── Stats globais
  const stats = useMemo(() => {
    if (edificios.length === 0) return { total: 0, custoMedio: 0, poupanca: 0, classMedia: 'C' as ClasseEnergetica }
    const total = edificios.length
    const custoMedio = edificios.reduce((s, e) => s + e.custoMedio, 0) / total

    // Calcular poupança potencial: diferença entre fornecedor atual e o mais barato
    let poupancaTotal = 0
    edificios.forEach(ed => {
      const fornAtual = FORNECEDORES.find(f => f.id === ed.fornecedorAtual)
      if (!fornAtual) return
      const custoAtual = calcularCustoAnual(ed.consumoMensal, ed.tipoTarifa, fornAtual)
      const custoMaisBaixo = Math.min(...FORNECEDORES.map(f => calcularCustoAnual(ed.consumoMensal, ed.tipoTarifa, f)))
      poupancaTotal += custoAtual - custoMaisBaixo
    })

    const classesOrdem: ClasseEnergetica[] = ['A+', 'A', 'B', 'B-', 'C', 'D', 'E', 'F']
    const mediaIdx = Math.round(edificios.reduce((s, e) => s + classesOrdem.indexOf(e.classeEnergetica), 0) / total)
    const classMedia = classesOrdem[Math.min(mediaIdx, classesOrdem.length - 1)]

    return { total, custoMedio, poupanca: poupancaTotal, classMedia }
  }, [edificios])

  // ── Simulação resultados
  const simResultados = useMemo(() => {
    const consumo = parseFloat(simConsumo) || 0
    if (consumo <= 0) return []
    return FORNECEDORES.map(f => {
      const custoAnual = calcularCustoAnual(consumo, simTarifa, f)
      return { fornecedor: f, custoAnual, custoMensal: custoAnual / 12 }
    }).sort((a, b) => a.custoAnual - b.custoAnual)
  }, [simConsumo, simTarifa])

  const fornecedorAtualSim = FORNECEDORES.find(f => f.id === simFornecedorAtual)
  const custoAtualAnualSim = fornecedorAtualSim
    ? calcularCustoAnual(parseFloat(simConsumo) || 0, simTarifa, fornecedorAtualSim)
    : 0

  // ── Fornecedores ordenados para comparação
  const fornecedoresOrdenados = useMemo(() => {
    const consumoRef = edificios.length > 0
      ? edificios.reduce((s, e) => s + e.consumoMensal, 0) / edificios.length
      : 1000
    const tipoRef: TipoTarifa = 'tri-horario'
    return [...FORNECEDORES].sort((a, b) => {
      if (compSortBy === 'preco') return calcularCustoAnual(consumoRef, tipoRef, a) - calcularCustoAnual(consumoRef, tipoRef, b)
      if (compSortBy === 'renovavel') return b.percentagemRenovavel - a.percentagemRenovavel
      return b.satisfacao - a.satisfacao
    })
  }, [compSortBy, edificios])

  // ── Histórico filtrado
  const historicoFiltrado = useMemo(() => {
    if (histEdificio === 'todos') return historico
    return historico.filter(h => h.edificioId === histEdificio)
  }, [historico, histEdificio])

  const historicoAgregado = useMemo(() => {
    const meses: Record<string, { consumo: number; custo: number; count: number }> = {}
    historicoFiltrado.forEach(h => {
      if (!meses[h.mes]) meses[h.mes] = { consumo: 0, custo: 0, count: 0 }
      meses[h.mes].consumo += h.consumo
      meses[h.mes].custo += h.custo
      meses[h.mes].count += 1
    })
    return Object.entries(meses)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, data]) => ({ mes, ...data }))
  }, [historicoFiltrado])

  const maxConsumo = useMemo(() => Math.max(...historicoAgregado.map(h => h.consumo), 1), [historicoAgregado])

  // ── Estilos comuns
  const cardStyle: React.CSSProperties = {
    background: COLORS.white,
    borderRadius: 16,
    border: `1px solid ${COLORS.border}`,
    padding: 24,
  }

  const headerFont: React.CSSProperties = {
    fontFamily: "'Playfair Display', Georgia, serif",
    color: COLORS.navy,
    fontWeight: 700,
  }

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14,
    transition: 'all 0.2s',
    background: active ? COLORS.navy : COLORS.white,
    color: active ? COLORS.white : COLORS.text,
    boxShadow: active ? '0 2px 8px rgba(13,27,46,0.15)' : 'none',
  })

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: `1px solid ${COLORS.border}`,
    fontSize: 14,
    color: COLORS.navy,
    background: COLORS.white,
    outline: 'none',
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  }

  const badgeStyle = (bg: string, color: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    background: bg,
    color,
  })

  // ── Estrelas de satisfação
  const renderEstrelas = (nota: number) => {
    const cheias = Math.floor(nota)
    const meia = nota % 1 >= 0.5
    const vazias = 5 - cheias - (meia ? 1 : 0)
    return (
      <span style={{ fontSize: 14, letterSpacing: 1 }}>
        {'★'.repeat(cheias)}
        {meia ? '½' : ''}
        {'☆'.repeat(vazias)}
      </span>
    )
  }

  // ── Loading
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16, animation: 'pulse 1.5s infinite' }}>⚡</div>
        <p style={{ color: COLORS.text, fontSize: 15 }}>A carregar dados energéticos...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
      {/* ── Cabeçalho ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ ...headerFont, fontSize: 26, margin: 0 }}>
            ⚡ Comparador de Tarifas de Energia Coletiva
          </h1>
          <p style={{ color: COLORS.text, fontSize: 14, marginTop: 4 }}>
            Analise, compare e otimize os custos energéticos dos seus edifícios
          </p>
        </div>
        <div style={badgeStyle(COLORS.greenBg, COLORS.green)}>
          ERSE 2024 - Mercado Liberalizado
        </div>
      </div>

      {/* ── Stats cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total edifícios', value: stats.total.toString(), icon: '🏢', accent: COLORS.navy },
          { label: 'Custo médio mensal', value: formatEur(stats.custoMedio), icon: '💰', accent: COLORS.gold },
          { label: 'Poupança potencial/ano', value: formatEur(stats.poupanca), icon: '📉', accent: COLORS.green },
          { label: 'Classe energética média', value: stats.classMedia, icon: '🏷️', accent: CLASSE_CORES[stats.classMedia] },
        ].map((card, i) => (
          <div key={i} style={{
            ...cardStyle,
            padding: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: `${card.accent}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: 12, color: COLORS.text, marginBottom: 2 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.accent }}>{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap',
        background: COLORS.bg, padding: 6, borderRadius: 14,
      }}>
        {([
          { key: 'dashboard', label: '📊 Dashboard' },
          { key: 'comparar', label: '⚖️ Comparar Tarifas' },
          { key: 'simulacao', label: '🧮 Simulação' },
          { key: 'historico', label: '📈 Histórico' },
        ] as { key: typeof tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={tabBtnStyle(tab === t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* TAB: Dashboard                                                          */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === 'dashboard' && (
        <div>
          <h2 style={{ ...headerFont, fontSize: 20, marginBottom: 16 }}>Perfil Energético por Edifício</h2>
          {edificios.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 48 }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>🏢</p>
              <p style={{ color: COLORS.text, fontSize: 15 }}>Nenhum edifício registado.</p>
              <p style={{ color: COLORS.text, fontSize: 13, marginTop: 4 }}>Adicione imóveis no módulo de Imóveis para começar.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {edificios.map(ed => {
                const fornecedor = FORNECEDORES.find(f => f.id === ed.fornecedorAtual)
                const custoAnual = fornecedor ? calcularCustoAnual(ed.consumoMensal, ed.tipoTarifa, fornecedor) : 0
                const melhorCusto = Math.min(...FORNECEDORES.map(f => calcularCustoAnual(ed.consumoMensal, ed.tipoTarifa, f)))
                const poupanca = custoAnual - melhorCusto

                return (
                  <div key={ed.id} style={{ ...cardStyle, padding: 20 }}>
                    {/* Header do card */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div>
                        <h3 style={{ ...headerFont, fontSize: 16, margin: 0 }}>{ed.nome}</h3>
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          <span style={badgeStyle(`${CLASSE_CORES[ed.classeEnergetica]}20`, CLASSE_CORES[ed.classeEnergetica])}>
                            Classe {ed.classeEnergetica}
                          </span>
                          <span style={badgeStyle(COLORS.bg, COLORS.text)}>
                            {TIPO_TARIFA_LABELS[ed.tipoTarifa]}
                          </span>
                        </div>
                      </div>
                      <div style={{
                        width: 42, height: 42, borderRadius: 10,
                        background: `${CLASSE_CORES[ed.classeEnergetica]}20`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: 16, color: CLASSE_CORES[ed.classeEnergetica],
                      }}>
                        {ed.classeEnergetica}
                      </div>
                    </div>

                    {/* Dados */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                      <div style={{ background: COLORS.bg, borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 11, color: COLORS.text, marginBottom: 2 }}>Consumo mensal</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.navy }}>{formatNum(ed.consumoMensal)} <span style={{ fontSize: 12, fontWeight: 400 }}>kWh</span></div>
                      </div>
                      <div style={{ background: COLORS.bg, borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 11, color: COLORS.text, marginBottom: 2 }}>Custo médio</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.gold }}>{formatEur(ed.custoMedio)}</div>
                      </div>
                    </div>

                    {/* Fornecedor atual */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: COLORS.bg, borderRadius: 10, marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, color: COLORS.text }}>Fornecedor atual</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.navy, marginTop: 2 }}>
                          {fornecedor ? `${fornecedor.logo} ${fornecedor.nome}` : 'Desconhecido'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: COLORS.text }}>Potência</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.navy }}>{ed.potenciaContratada} kVA</div>
                      </div>
                    </div>

                    {/* Poupança potencial */}
                    {poupanca > 10 && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 12px', borderRadius: 10,
                        background: COLORS.greenBg,
                      }}>
                        <span style={{ fontSize: 16 }}>💰</span>
                        <div>
                          <div style={{ fontSize: 12, color: COLORS.green, fontWeight: 600 }}>Poupança potencial</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.green }}>{formatEur(poupanca)}<span style={{ fontSize: 11, fontWeight: 400 }}>/ano</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* TAB: Comparar Tarifas                                                   */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === 'comparar' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ ...headerFont, fontSize: 20, margin: 0 }}>Comparação de Fornecedores</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { key: 'preco', label: '💶 Preço' },
                { key: 'renovavel', label: '🌱 Renovável' },
                { key: 'satisfacao', label: '⭐ Satisfação' },
              ] as { key: typeof compSortBy; label: string }[]).map(s => (
                <button key={s.key} onClick={() => setCompSortBy(s.key)} style={{
                  padding: '6px 14px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: compSortBy === s.key ? COLORS.navy : COLORS.white,
                  color: compSortBy === s.key ? COLORS.white : COLORS.text,
                  transition: 'all 0.2s',
                }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {fornecedoresOrdenados.map((f, idx) => {
              const consumoRef = edificios.length > 0
                ? edificios.reduce((s, e) => s + e.consumoMensal, 0) / edificios.length
                : 1000
              const custoAnual = calcularCustoAnual(consumoRef, 'tri-horario', f)
              const custoMaisBaixo = Math.min(...FORNECEDORES.map(fn => calcularCustoAnual(consumoRef, 'tri-horario', fn)))
              const diff = custoAnual - custoMaisBaixo
              const isUsed = edificios.some(e => e.fornecedorAtual === f.id)

              return (
                <div key={f.id} style={{
                  ...cardStyle,
                  padding: 20,
                  borderLeft: `4px solid ${f.cor}`,
                  position: 'relative',
                }}>
                  {idx === 0 && (
                    <div style={{
                      position: 'absolute', top: -8, right: 16,
                      background: COLORS.gold, color: COLORS.white,
                      padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                    }}>
                      MELHOR PREÇO
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, alignItems: 'center' }}>
                    {/* Fornecedor info */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 28 }}>{f.logo}</span>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.navy }}>{f.nome}</div>
                          {isUsed && <span style={badgeStyle(COLORS.orangeBg, COLORS.orange)}>Atual</span>}
                        </div>
                      </div>
                    </div>

                    {/* Tarifas */}
                    <div>
                      <div style={{ fontSize: 11, color: COLORS.text, marginBottom: 6 }}>Tarifas (EUR/kWh)</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: COLORS.text }}>Ponta</span>
                          <span style={{ fontWeight: 600, color: COLORS.navy }}>{f.tarifaPonta.toFixed(4)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: COLORS.text }}>Vazio</span>
                          <span style={{ fontWeight: 600, color: COLORS.navy }}>{f.tarifaVazio.toFixed(4)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: COLORS.text }}>Super vazio</span>
                          <span style={{ fontWeight: 600, color: COLORS.navy }}>{f.tarifaSuperVazio.toFixed(4)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Renovável + Satisfação */}
                    <div>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, color: COLORS.text, marginBottom: 4 }}>Energia renovável</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            flex: 1, height: 8, borderRadius: 4, background: COLORS.bg,
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${f.percentagemRenovavel}%`, height: '100%',
                              borderRadius: 4,
                              background: f.percentagemRenovavel >= 80 ? COLORS.green : f.percentagemRenovavel >= 50 ? COLORS.gold : COLORS.orange,
                            }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.navy }}>{f.percentagemRenovavel}%</span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: COLORS.text, marginBottom: 4 }}>Satisfação clientes</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: COLORS.gold }}>{renderEstrelas(f.satisfacao)}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.navy }}>{f.satisfacao.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Custo estimado */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: COLORS.text, marginBottom: 4 }}>Custo estimado anual</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.navy }}>{formatEur(custoAnual)}</div>
                      <div style={{ fontSize: 12, color: COLORS.text, marginTop: 2 }}>
                        Custo fixo: {formatEur(f.custoFixo)}/mês
                      </div>
                      {diff > 0 && (
                        <div style={{ fontSize: 12, color: COLORS.red, fontWeight: 600, marginTop: 4 }}>
                          +{formatEur(diff)} vs melhor opção
                        </div>
                      )}
                      {diff === 0 && (
                        <div style={{ fontSize: 12, color: COLORS.green, fontWeight: 600, marginTop: 4 }}>
                          Tarifa mais competitiva
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Legenda */}
          <div style={{ ...cardStyle, marginTop: 16, padding: 16, display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontSize: 12, color: COLORS.text }}>
              * Estimativa baseada no consumo médio de {formatNum(edificios.length > 0 ? edificios.reduce((s, e) => s + e.consumoMensal, 0) / edificios.length : 1000)} kWh/mês em tarifa tri-horaria
            </span>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* TAB: Simulação                                                          */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === 'simulacao' && (
        <div>
          <h2 style={{ ...headerFont, fontSize: 20, marginBottom: 16 }}>Simulação de Custos Energéticos</h2>

          {/* Form de simulação */}
          <div style={{ ...cardStyle, marginBottom: 24 }}>
            <h3 style={{ ...headerFont, fontSize: 16, marginBottom: 16 }}>Parâmetros da simulação</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 6 }}>
                  Consumo mensal (kWh)
                </label>
                <input
                  type="number"
                  value={simConsumo}
                  onChange={e => setSimConsumo(e.target.value)}
                  style={inputStyle}
                  placeholder="Ex: 1200"
                  min="0"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 6 }}>
                  Tipo de tarifa
                </label>
                <select value={simTarifa} onChange={e => setSimTarifa(e.target.value as TipoTarifa)} style={selectStyle}>
                  <option value="simples">Simples</option>
                  <option value="bi-horario">Bi-Horário</option>
                  <option value="tri-horario">Tri-Horário</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 6 }}>
                  Fornecedor atual
                </label>
                <select value={simFornecedorAtual} onChange={e => setSimFornecedorAtual(e.target.value)} style={selectStyle}>
                  {FORNECEDORES.map(f => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Resultados da simulação */}
          {simResultados.length > 0 && (
            <div>
              <h3 style={{ ...headerFont, fontSize: 16, marginBottom: 16 }}>Resultados da simulação</h3>

              {/* Resumo */}
              {fornecedorAtualSim && simResultados.length > 0 && (
                <div style={{
                  ...cardStyle,
                  marginBottom: 20,
                  background: custoAtualAnualSim > simResultados[0].custoAnual ? COLORS.greenBg : COLORS.bg,
                  borderColor: custoAtualAnualSim > simResultados[0].custoAnual ? COLORS.green : COLORS.border,
                  display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                }}>
                  <span style={{ fontSize: 32 }}>💡</span>
                  <div style={{ flex: 1 }}>
                    {custoAtualAnualSim > simResultados[0].custoAnual ? (
                      <>
                        <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.green, marginBottom: 4 }}>
                          Pode poupar {formatEur(custoAtualAnualSim - simResultados[0].custoAnual)}/ano!
                        </div>
                        <div style={{ fontSize: 13, color: COLORS.text }}>
                          Ao mudar de {fornecedorAtualSim.nome} para {simResultados[0].fornecedor.nome}, pouparia{' '}
                          {formatEur((custoAtualAnualSim - simResultados[0].custoAnual) / 12)}/mês
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.navy, marginBottom: 4 }}>
                          Já tem a melhor tarifa!
                        </div>
                        <div style={{ fontSize: 13, color: COLORS.text }}>
                          O seu fornecedor atual ({fornecedorAtualSim.nome}) oferece o melhor preço para o seu perfil de consumo.
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Tabela de resultados */}
              <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: COLORS.bg }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}>#</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}>Fornecedor</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}>Custo mensal</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}>Custo anual</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}>Poupança vs atual</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}>Renovável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simResultados.map((r, i) => {
                      const poupanca = custoAtualAnualSim - r.custoAnual
                      const isAtual = r.fornecedor.id === simFornecedorAtual
                      return (
                        <tr key={r.fornecedor.id} style={{
                          background: isAtual ? `${COLORS.gold}10` : i % 2 === 0 ? COLORS.white : COLORS.bg,
                          transition: 'background 0.2s',
                        }}>
                          <td style={{ padding: '12px 16px', borderBottom: `1px solid ${COLORS.border}`, fontSize: 14 }}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                          </td>
                          <td style={{ padding: '12px 16px', borderBottom: `1px solid ${COLORS.border}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 20 }}>{r.fornecedor.logo}</span>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.navy }}>{r.fornecedor.nome}</div>
                                {isAtual && <span style={{ fontSize: 11, color: COLORS.orange, fontWeight: 600 }}>Fornecedor atual</span>}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', fontSize: 14, fontWeight: 600, color: COLORS.navy }}>
                            {formatEur(r.custoMensal)}
                          </td>
                          <td style={{ padding: '12px 16px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', fontSize: 14, fontWeight: 700, color: COLORS.navy }}>
                            {formatEur(r.custoAnual)}
                          </td>
                          <td style={{ padding: '12px 16px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>
                            {poupanca > 0 ? (
                              <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.green }}>-{formatEur(poupanca)}</span>
                            ) : poupanca < 0 ? (
                              <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.red }}>+{formatEur(Math.abs(poupanca))}</span>
                            ) : (
                              <span style={{ fontSize: 13, color: COLORS.text }}>---</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'center' }}>
                            <span style={badgeStyle(
                              r.fornecedor.percentagemRenovavel >= 80 ? COLORS.greenBg : COLORS.bg,
                              r.fornecedor.percentagemRenovavel >= 80 ? COLORS.green : COLORS.text,
                            )}>
                              {r.fornecedor.percentagemRenovavel}%
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Nota de simulação */}
              <div style={{ ...cardStyle, marginTop: 16, padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>ℹ️</span>
                <p style={{ fontSize: 12, color: COLORS.text, margin: 0 }}>
                  Simulação baseada em {formatNum(parseFloat(simConsumo) || 0)} kWh/mês em tarifa {TIPO_TARIFA_LABELS[simTarifa].toLowerCase()}.
                  Valores indicativos sujeitos a IVA e impostos especiais. Consulte o fornecedor para uma proposta vinculativa.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* TAB: Histórico                                                          */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === 'historico' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ ...headerFont, fontSize: 20, margin: 0 }}>Histórico de Consumos</h2>
            <select
              value={histEdificio}
              onChange={e => setHistEdificio(e.target.value)}
              style={{ ...selectStyle, width: 'auto', minWidth: 200 }}
            >
              <option value="todos">Todos os edifícios</option>
              {edificios.map(ed => (
                <option key={ed.id} value={ed.id}>{ed.nome}</option>
              ))}
            </select>
          </div>

          {/* Gráfico de barras de consumo */}
          <div style={{ ...cardStyle, marginBottom: 24 }}>
            <h3 style={{ ...headerFont, fontSize: 16, marginBottom: 20 }}>Consumo mensal (kWh)</h3>

            {historicoAgregado.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <p style={{ color: COLORS.text, fontSize: 14 }}>Sem dados de histórico disponíveis.</p>
              </div>
            ) : (
              <div>
                {/* Barras */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 220, paddingBottom: 30, position: 'relative' }}>
                  {/* Linhas de referência */}
                  {[0.25, 0.5, 0.75, 1.0].map(pct => (
                    <div key={pct} style={{
                      position: 'absolute',
                      left: 0, right: 0,
                      bottom: 30 + (190 * pct),
                      borderBottom: `1px dashed ${COLORS.border}`,
                      pointerEvents: 'none',
                    }}>
                      <span style={{
                        position: 'absolute', left: -4, top: -8,
                        fontSize: 10, color: COLORS.text, background: COLORS.white,
                        padding: '0 4px',
                      }}>
                        {formatNum(maxConsumo * pct)}
                      </span>
                    </div>
                  ))}

                  {historicoAgregado.map((h, i) => {
                    const pct = h.consumo / maxConsumo
                    const [y, m] = h.mes.split('-')
                    const label = `${MESES_PT[parseInt(m) - 1]}`
                    // Cor baseada no consumo relativo
                    const barColor = pct > 0.85 ? '#e8731a' : pct > 0.65 ? COLORS.gold : COLORS.green
                    return (
                      <div key={h.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                        {/* Valor */}
                        <div style={{
                          fontSize: 10, fontWeight: 600, color: COLORS.navy,
                          marginBottom: 4, textAlign: 'center', minHeight: 14,
                        }}>
                          {formatNum(h.consumo)}
                        </div>
                        {/* Barra */}
                        <div style={{
                          width: '70%',
                          height: Math.max(4, pct * 190),
                          borderRadius: '6px 6px 0 0',
                          background: `linear-gradient(180deg, ${barColor}, ${barColor}88)`,
                          transition: 'height 0.4s ease',
                          minHeight: 4,
                        }} />
                        {/* Mês */}
                        <div style={{
                          fontSize: 10, color: COLORS.text, marginTop: 6,
                          fontWeight: 600, textAlign: 'center',
                        }}>
                          {label}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Gráfico de barras de custo */}
          <div style={{ ...cardStyle, marginBottom: 24 }}>
            <h3 style={{ ...headerFont, fontSize: 16, marginBottom: 20 }}>Custo mensal (EUR)</h3>

            {historicoAgregado.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <p style={{ color: COLORS.text, fontSize: 14 }}>Sem dados de histórico disponíveis.</p>
              </div>
            ) : (() => {
              const maxCusto = Math.max(...historicoAgregado.map(h => h.custo), 1)
              return (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 200, paddingBottom: 30 }}>
                  {historicoAgregado.map(h => {
                    const pct = h.custo / maxCusto
                    const [, m] = h.mes.split('-')
                    const label = MESES_PT[parseInt(m) - 1]
                    return (
                      <div key={h.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.gold, marginBottom: 4, textAlign: 'center', minHeight: 14 }}>
                          {formatEur(h.custo)}
                        </div>
                        <div style={{
                          width: '70%',
                          height: Math.max(4, pct * 170),
                          borderRadius: '6px 6px 0 0',
                          background: `linear-gradient(180deg, ${COLORS.gold}, ${COLORS.gold}88)`,
                          transition: 'height 0.4s ease',
                          minHeight: 4,
                        }} />
                        <div style={{ fontSize: 10, color: COLORS.text, marginTop: 6, fontWeight: 600 }}>
                          {label}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>

          {/* Tabela de detalhes */}
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${COLORS.border}` }}>
              <h3 style={{ ...headerFont, fontSize: 16, margin: 0 }}>Detalhes mensais</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: COLORS.bg }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}>Mês</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}>Consumo (kWh)</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}>Custo (EUR)</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}>EUR/kWh</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}>Tendência</th>
                </tr>
              </thead>
              <tbody>
                {[...historicoAgregado].reverse().map((h, i, arr) => {
                  const [y, m] = h.mes.split('-')
                  const label = `${MESES_PT[parseInt(m) - 1]} ${y}`
                  const prev = arr[i + 1]
                  const varPct = prev ? ((h.consumo - prev.consumo) / prev.consumo * 100) : 0
                  return (
                    <tr key={h.mes} style={{ background: i % 2 === 0 ? COLORS.white : COLORS.bg }}>
                      <td style={{ padding: '10px 16px', borderBottom: `1px solid ${COLORS.border}`, fontSize: 14, fontWeight: 600, color: COLORS.navy }}>{label}</td>
                      <td style={{ padding: '10px 16px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', fontSize: 14, color: COLORS.navy }}>{formatNum(h.consumo)}</td>
                      <td style={{ padding: '10px 16px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', fontSize: 14, fontWeight: 600, color: COLORS.gold }}>{formatEur(h.custo)}</td>
                      <td style={{ padding: '10px 16px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', fontSize: 13, color: COLORS.text }}>{(h.custo / Math.max(h.consumo, 1)).toFixed(4)}</td>
                      <td style={{ padding: '10px 16px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'center' }}>
                        {prev ? (
                          <span style={{
                            fontSize: 13, fontWeight: 600,
                            color: varPct > 5 ? COLORS.red : varPct < -5 ? COLORS.green : COLORS.text,
                          }}>
                            {varPct > 0 ? '▲' : varPct < 0 ? '▼' : '—'} {Math.abs(varPct).toFixed(1)}%
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: COLORS.text }}>---</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
