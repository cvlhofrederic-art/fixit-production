'use client'

import React, { useState, useEffect, useMemo } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoEspaco = 'salao_festas' | 'churrasqueira' | 'campo' | 'piscina' | 'ginasio' | 'sala_reunioes'
type EstadoEspaco = 'disponivel' | 'reservado' | 'manutencao'
type TabReserva = 'calendario' | 'espacos' | 'regras' | 'relatorio'
type CalendarView = 'semana' | 'mes'

interface Espaco {
  id: string
  tipo: TipoEspaco
  nome: string
  capacidade: number
  horarioInicio: string   // "09:00"
  horarioFim: string      // "22:00"
  estado: EstadoEspaco
  foto?: string
}

interface RegraEspaco {
  espacoId: string
  horarioPermitidoInicio: string
  horarioPermitidoFim: string
  duracaoMaximaHoras: number
  antecedenciaMinimasDias: number
  antecedenciaMaximaDias: number
  caucaoValor: number
  limpezaObrigatoria: boolean
  limiteReservasMes: number
  cancelamentoHorasAntes: number
}

interface Reserva {
  id: string
  espacoId: string
  espacoNome: string
  tipoEspaco: TipoEspaco
  fracaoId: string        // e.g. "1A", "3B"
  nomeResidente: string
  data: string            // YYYY-MM-DD
  horaInicio: string      // "10:00"
  horaFim: string         // "14:00"
  caucaoPaga: boolean
  caucaoValor: number
  estado: 'confirmada' | 'pendente' | 'cancelada'
  criadaEm: string
}

interface Props {
  user: any
  userRole: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const TIPO_ESPACO_CONFIG: Record<TipoEspaco, { label: string; emoji: string; cor: string; corBg: string }> = {
  salao_festas:  { label: 'Salão de Festas',    emoji: '🎉', cor: '#3B82F6', corBg: 'rgba(59,130,246,0.12)' },
  churrasqueira: { label: 'Churrasqueira',       emoji: '🔥', cor: '#F97316', corBg: 'rgba(249,115,22,0.12)' },
  campo:         { label: 'Campo/Polidesportivo', emoji: '⚽', cor: '#22C55E', corBg: 'rgba(34,197,94,0.12)' },
  piscina:       { label: 'Piscina',             emoji: '🏊', cor: '#06B6D4', corBg: 'rgba(6,182,212,0.12)' },
  ginasio:       { label: 'Ginasio',             emoji: '🏋️', cor: '#8B5CF6', corBg: 'rgba(139,92,246,0.12)' },
  sala_reunioes: { label: 'Sala de Reuniões',    emoji: '🤝', cor: '#EC4899', corBg: 'rgba(236,72,153,0.12)' },
}

const ESTADO_ESPACO_CONFIG: Record<EstadoEspaco, { label: string; cor: string; bg: string }> = {
  disponivel:  { label: 'Disponivel',   cor: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  reservado:   { label: 'Reservado',    cor: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  manutencao:  { label: 'Manutencao',   cor: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
}

const TABS: { key: TabReserva; label: string; emoji: string }[] = [
  { key: 'calendario', label: 'Calendario', emoji: '📅' },
  { key: 'espacos',    label: 'Espacos',    emoji: '🏢' },
  { key: 'regras',     label: 'Regras',     emoji: '📋' },
  { key: 'relatorio',  label: 'Relatorio',  emoji: '📊' },
]

// ─── Demo data ───────────────────────────────────────────────────────────────

function gerarDemoData(userId: string): { espacos: Espaco[]; regras: RegraEspaco[]; reservas: Reserva[] } {
  const espacos: Espaco[] = [
    { id: 'e1', tipo: 'salao_festas',  nome: 'Salão de Festas Principal', capacidade: 80, horarioInicio: '09:00', horarioFim: '23:00', estado: 'disponivel' },
    { id: 'e2', tipo: 'churrasqueira', nome: 'Churrasqueira Cobertura',   capacidade: 20, horarioInicio: '10:00', horarioFim: '22:00', estado: 'disponivel' },
    { id: 'e3', tipo: 'campo',         nome: 'Campo Polidesportivo',      capacidade: 30, horarioInicio: '07:00', horarioFim: '21:00', estado: 'disponivel' },
    { id: 'e4', tipo: 'piscina',       nome: 'Piscina Exterior',          capacidade: 40, horarioInicio: '08:00', horarioFim: '20:00', estado: 'manutencao' },
    { id: 'e5', tipo: 'ginasio',       nome: 'Ginásio Condominial',       capacidade: 15, horarioInicio: '06:00', horarioFim: '23:00', estado: 'disponivel' },
    { id: 'e6', tipo: 'sala_reunioes', nome: 'Sala de Reuniões B1',       capacidade: 12, horarioInicio: '08:00', horarioFim: '20:00', estado: 'disponivel' },
  ]

  const regras: RegraEspaco[] = espacos.map(e => ({
    espacoId: e.id,
    horarioPermitidoInicio: e.horarioInicio,
    horarioPermitidoFim: e.horarioFim,
    duracaoMaximaHoras: e.tipo === 'salao_festas' ? 8 : e.tipo === 'churrasqueira' ? 6 : 4,
    antecedenciaMinimasDias: 2,
    antecedenciaMaximaDias: 30,
    caucaoValor: e.tipo === 'salao_festas' ? 150 : e.tipo === 'churrasqueira' ? 75 : e.tipo === 'piscina' ? 50 : 0,
    limpezaObrigatoria: e.tipo === 'salao_festas' || e.tipo === 'churrasqueira',
    limiteReservasMes: e.tipo === 'ginasio' ? 8 : 2,
    cancelamentoHorasAntes: 48,
  }))

  const hoje = new Date()
  const reservas: Reserva[] = []
  const nomes = ['Ana Silva', 'Carlos Mendes', 'Maria Santos', 'Joao Ferreira', 'Rita Oliveira', 'Pedro Costa', 'Sofia Almeida', 'Bruno Pereira']
  const fracoes = ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B']

  for (let d = -14; d < 21; d++) {
    const dt = new Date(hoje)
    dt.setDate(dt.getDate() + d)
    const dateStr = dt.toISOString().slice(0, 10)
    const numReservas = Math.random() > 0.5 ? (Math.random() > 0.6 ? 2 : 1) : 0
    for (let r = 0; r < numReservas; r++) {
      const esp = espacos[Math.floor(Math.random() * espacos.length)]
      const cfg = TIPO_ESPACO_CONFIG[esp.tipo]
      const horaI = 9 + Math.floor(Math.random() * 8)
      const duracao = 2 + Math.floor(Math.random() * 4)
      const fracao = fracoes[Math.floor(Math.random() * fracoes.length)]
      const nome = nomes[Math.floor(Math.random() * nomes.length)]
      const regra = regras.find(rr => rr.espacoId === esp.id)
      reservas.push({
        id: crypto.randomUUID(),
        espacoId: esp.id,
        espacoNome: esp.nome,
        tipoEspaco: esp.tipo,
        fracaoId: fracao,
        nomeResidente: nome,
        data: dateStr,
        horaInicio: `${String(horaI).padStart(2, '0')}:00`,
        horaFim: `${String(Math.min(horaI + duracao, 23)).padStart(2, '0')}:00`,
        caucaoPaga: Math.random() > 0.3,
        caucaoValor: regra?.caucaoValor || 0,
        estado: d < 0 ? 'confirmada' : Math.random() > 0.2 ? 'confirmada' : 'pendente',
        criadaEm: new Date(dt.getTime() - 86400000 * 3).toISOString(),
      })
    }
  }

  return { espacos, regras, reservas }
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function ReservaEspacosSection({ user, userRole }: Props) {
  // ── State
  const [tab, setTab] = useState<TabReserva>('calendario')
  const [calView, setCalView] = useState<CalendarView>('mes')
  const [espacos, setEspacos] = useState<Espaco[]>([])
  const [regras, setRegras] = useState<RegraEspaco[]>([])
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [calDate, setCalDate] = useState(new Date())

  // Modal states
  const [showNovoEspaco, setShowNovoEspaco] = useState(false)
  const [showNovaReserva, setShowNovaReserva] = useState(false)
  const [reservaDataPrefill, setReservaDataPrefill] = useState('')

  // Form: Novo espaco
  const [fNome, setFNome] = useState('')
  const [fTipo, setFTipo] = useState<TipoEspaco>('salao_festas')
  const [fCapacidade, setFCapacidade] = useState('')
  const [fHoraInicio, setFHoraInicio] = useState('09:00')
  const [fHoraFim, setFHoraFim] = useState('22:00')

  // Form: Nova reserva
  const [rEspacoId, setREspacoId] = useState('')
  const [rFracao, setRFracao] = useState('')
  const [rNome, setRNome] = useState('')
  const [rData, setRData] = useState('')
  const [rHoraInicio, setRHoraInicio] = useState('10:00')
  const [rHoraFim, setRHoraFim] = useState('14:00')

  // Regras editing
  const [regraEditId, setRegraEditId] = useState<string | null>(null)

  // ── Storage
  const STORAGE_KEY = `fixit_reservas_${user.id}`

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (data.espacos) setEspacos(data.espacos)
        if (data.regras) setRegras(data.regras)
        if (data.reservas) setReservas(data.reservas)
      } else {
        // Seed demo data
        const demo = gerarDemoData(user.id)
        setEspacos(demo.espacos)
        setRegras(demo.regras)
        setReservas(demo.reservas)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ espacos, regras, reservas }))
    } catch { /* ignore */ }
  }, [espacos, regras, reservas])

  // ── Actions
  const criarEspaco = () => {
    if (!fNome.trim()) return
    const novoEspaco: Espaco = {
      id: crypto.randomUUID(),
      tipo: fTipo,
      nome: fNome.trim(),
      capacidade: parseInt(fCapacidade) || 20,
      horarioInicio: fHoraInicio,
      horarioFim: fHoraFim,
      estado: 'disponivel',
    }
    const novaRegra: RegraEspaco = {
      espacoId: novoEspaco.id,
      horarioPermitidoInicio: fHoraInicio,
      horarioPermitidoFim: fHoraFim,
      duracaoMaximaHoras: 4,
      antecedenciaMinimasDias: 2,
      antecedenciaMaximaDias: 30,
      caucaoValor: 0,
      limpezaObrigatoria: false,
      limiteReservasMes: 2,
      cancelamentoHorasAntes: 48,
    }
    setEspacos(prev => [...prev, novoEspaco])
    setRegras(prev => [...prev, novaRegra])
    setFNome(''); setFCapacidade(''); setFTipo('salao_festas'); setFHoraInicio('09:00'); setFHoraFim('22:00')
    setShowNovoEspaco(false)
  }

  const eliminarEspaco = (id: string) => {
    setEspacos(prev => prev.filter(e => e.id !== id))
    setRegras(prev => prev.filter(r => r.espacoId !== id))
    setReservas(prev => prev.filter(r => r.espacoId !== id))
  }

  const toggleEstadoEspaco = (id: string) => {
    setEspacos(prev => prev.map(e => {
      if (e.id !== id) return e
      const next: EstadoEspaco = e.estado === 'disponivel' ? 'manutencao' : e.estado === 'manutencao' ? 'reservado' : 'disponivel'
      return { ...e, estado: next }
    }))
  }

  const criarReserva = () => {
    if (!rEspacoId || !rFracao.trim() || !rNome.trim() || !rData) return
    const esp = espacos.find(e => e.id === rEspacoId)
    if (!esp) return
    const regra = regras.find(r => r.espacoId === rEspacoId)
    const nova: Reserva = {
      id: crypto.randomUUID(),
      espacoId: rEspacoId,
      espacoNome: esp.nome,
      tipoEspaco: esp.tipo,
      fracaoId: rFracao.trim(),
      nomeResidente: rNome.trim(),
      data: rData,
      horaInicio: rHoraInicio,
      horaFim: rHoraFim,
      caucaoPaga: false,
      caucaoValor: regra?.caucaoValor || 0,
      estado: 'pendente',
      criadaEm: new Date().toISOString(),
    }
    setReservas(prev => [nova, ...prev])
    setREspacoId(''); setRFracao(''); setRNome(''); setRData(''); setRHoraInicio('10:00'); setRHoraFim('14:00')
    setShowNovaReserva(false)
    setReservaDataPrefill('')
  }

  const cancelarReserva = (id: string) => {
    setReservas(prev => prev.map(r => r.id === id ? { ...r, estado: 'cancelada' as const } : r))
  }

  const confirmarReserva = (id: string) => {
    setReservas(prev => prev.map(r => r.id === id ? { ...r, estado: 'confirmada' as const } : r))
  }

  const atualizarRegra = (espacoId: string, campo: keyof RegraEspaco, valor: any) => {
    setRegras(prev => prev.map(r => r.espacoId === espacoId ? { ...r, [campo]: valor } : r))
  }

  // ── Calendar helpers
  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const getFirstDayOfMonth = (date: Date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), 1).getDay()
    return d === 0 ? 6 : d - 1 // Monday=0
  }

  const getWeekDays = (date: Date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d.setDate(diff))
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const dd = new Date(monday)
      dd.setDate(monday.getDate() + i)
      days.push(dd)
    }
    return days
  }

  const reservasNoDia = (dateStr: string) => reservas.filter(r => r.data === dateStr && r.estado !== 'cancelada')
  const isToday = (d: Date) => {
    const t = new Date()
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
  }
  const dateStr = (d: Date) => d.toISOString().slice(0, 10)
  const fmt = (n: number) => n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const diasSemana = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']
  const meses = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

  // ── Stats
  const stats = useMemo(() => {
    const agora = new Date()
    const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
    const reservasMes = reservas.filter(r => r.data.startsWith(mesAtual) && r.estado !== 'cancelada')
    const totalReservasMes = reservasMes.length

    // Espaco mais usado
    const contagemPorEspaco: Record<string, number> = {}
    for (const r of reservasMes) {
      contagemPorEspaco[r.espacoNome] = (contagemPorEspaco[r.espacoNome] || 0) + 1
    }
    const espacoMaisUsado = Object.entries(contagemPorEspaco).sort((a, b) => b[1] - a[1])[0]

    // Taxa de ocupacao (reservas no mes / (espacos * 30 dias))
    const diasMes = getDaysInMonth(agora)
    const espacosAtivos = espacos.filter(e => e.estado !== 'manutencao').length
    const taxaOcupacao = espacosAtivos > 0 ? Math.round((totalReservasMes / (espacosAtivos * diasMes)) * 100) : 0

    // Revenue caucoes
    const receita = reservasMes.filter(r => r.caucaoPaga).reduce((s, r) => s + r.caucaoValor, 0)
    const caucoesPendentes = reservasMes.filter(r => !r.caucaoPaga && r.caucaoValor > 0).length

    // Top fracoes
    const porFracao: Record<string, number> = {}
    for (const r of reservas.filter(rr => rr.estado !== 'cancelada')) {
      porFracao[r.fracaoId] = (porFracao[r.fracaoId] || 0) + 1
    }
    const topFracoes = Object.entries(porFracao).sort((a, b) => b[1] - a[1]).slice(0, 5)

    // Reservas por tipo espaco
    const porTipo: Record<string, number> = {}
    for (const r of reservasMes) {
      const label = TIPO_ESPACO_CONFIG[r.tipoEspaco]?.label || r.tipoEspaco
      porTipo[label] = (porTipo[label] || 0) + 1
    }

    return { totalReservasMes, espacoMaisUsado, taxaOcupacao, receita, caucoesPendentes, topFracoes, porTipo }
  }, [reservas, espacos])

  // ─── Shared styles ──────────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid var(--sd-border, #E4DDD0)',
    borderRadius: 12,
    padding: 20,
  }

  const btnPrimary: React.CSSProperties = {
    background: 'var(--sd-navy, #0D1B2E)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  }

  const btnSecondary: React.CSSProperties = {
    background: 'var(--sd-cream, #F7F4EE)',
    color: 'var(--sd-navy, #0D1B2E)',
    border: '1px solid var(--sd-border, #E4DDD0)',
    borderRadius: 10,
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid var(--sd-border, #E4DDD0)',
    borderRadius: 8,
    fontSize: 13,
    outline: 'none',
    background: '#fff',
    color: 'var(--sd-navy, #0D1B2E)',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--sd-ink-2, #4A5E78)',
    marginBottom: 4,
    display: 'block',
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(13,27,46,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  }

  const modalStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 16,
    padding: 28,
    maxWidth: 520,
    width: '90vw',
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(13,27,46,0.18)',
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
            📅 Reserva de Espacos Comuns
          </h2>
          <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>
            Gestao de reservas, espacos e regras de utilizacao do condominio
          </p>
        </div>
        <button onClick={() => { setShowNovaReserva(true); setReservaDataPrefill('') }} style={btnPrimary}>
          + Nova Reserva
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--sd-cream, #F7F4EE)', padding: 4, borderRadius: 12, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              minWidth: 120,
              padding: '10px 16px',
              borderRadius: 10,
              border: 'none',
              background: tab === t.key ? '#fff' : 'transparent',
              color: tab === t.key ? 'var(--sd-navy, #0D1B2E)' : 'var(--sd-ink-3, #8A9BB0)',
              fontWeight: tab === t.key ? 600 : 400,
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: tab === t.key ? '0 1px 4px rgba(13,27,46,0.08)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* ─── Tab: Calendario ─────────────────────────────────────────────────── */}
      {tab === 'calendario' && (
        <div>
          {/* Calendar controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => {
                const d = new Date(calDate)
                if (calView === 'mes') d.setMonth(d.getMonth() - 1)
                else d.setDate(d.getDate() - 7)
                setCalDate(d)
              }} style={{ ...btnSecondary, padding: '8px 14px' }}>{'<'}</button>
              <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)', minWidth: 180, textAlign: 'center' }}>
                {calView === 'mes'
                  ? `${meses[calDate.getMonth()]} ${calDate.getFullYear()}`
                  : (() => {
                      const wk = getWeekDays(calDate)
                      return `${wk[0].getDate()} - ${wk[6].getDate()} ${meses[wk[6].getMonth()]} ${wk[6].getFullYear()}`
                    })()
                }
              </span>
              <button onClick={() => {
                const d = new Date(calDate)
                if (calView === 'mes') d.setMonth(d.getMonth() + 1)
                else d.setDate(d.getDate() + 7)
                setCalDate(d)
              }} style={{ ...btnSecondary, padding: '8px 14px' }}>{'>'}</button>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => { setCalDate(new Date()); }}
                style={{ ...btnSecondary, padding: '8px 14px', fontSize: 12 }}
              >
                Hoje
              </button>
              <button
                onClick={() => setCalView('semana')}
                style={{ ...btnSecondary, padding: '8px 14px', fontSize: 12, background: calView === 'semana' ? 'var(--sd-navy, #0D1B2E)' : undefined, color: calView === 'semana' ? '#fff' : undefined }}
              >
                Semana
              </button>
              <button
                onClick={() => setCalView('mes')}
                style={{ ...btnSecondary, padding: '8px 14px', fontSize: 12, background: calView === 'mes' ? 'var(--sd-navy, #0D1B2E)' : undefined, color: calView === 'mes' ? '#fff' : undefined }}
              >
                Mes
              </button>
            </div>
          </div>

          {/* Legenda */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            {Object.entries(TIPO_ESPACO_CONFIG).map(([key, cfg]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--sd-ink-2, #4A5E78)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: cfg.cor, display: 'inline-block' }} />
                {cfg.label}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          {calView === 'mes' ? (
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {diasSemana.map(d => (
                  <div key={d} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--sd-ink-3, #8A9BB0)', background: 'var(--sd-cream, #F7F4EE)', borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>
                    {d}
                  </div>
                ))}
              </div>
              {/* Days grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {/* Empty cells for offset */}
                {Array.from({ length: getFirstDayOfMonth(calDate) }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ minHeight: 90, borderBottom: '1px solid var(--sd-border, #E4DDD0)', borderRight: '1px solid var(--sd-border, #E4DDD0)', background: 'var(--sd-cream, #F7F4EE)', opacity: 0.5 }} />
                ))}
                {/* Actual days */}
                {Array.from({ length: getDaysInMonth(calDate) }).map((_, i) => {
                  const dayNum = i + 1
                  const dt = new Date(calDate.getFullYear(), calDate.getMonth(), dayNum)
                  const ds = dateStr(dt)
                  const dayReservas = reservasNoDia(ds)
                  const today = isToday(dt)
                  return (
                    <div
                      key={dayNum}
                      onClick={() => { setReservaDataPrefill(ds); setRData(ds); setShowNovaReserva(true) }}
                      style={{
                        minHeight: 90,
                        padding: 6,
                        borderBottom: '1px solid var(--sd-border, #E4DDD0)',
                        borderRight: '1px solid var(--sd-border, #E4DDD0)',
                        cursor: 'pointer',
                        background: today ? 'rgba(201,168,76,0.06)' : '#fff',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { if (!today) (e.currentTarget as HTMLDivElement).style.background = 'var(--sd-cream, #F7F4EE)' }}
                      onMouseLeave={e => { if (!today) (e.currentTarget as HTMLDivElement).style.background = '#fff' }}
                    >
                      <div style={{
                        fontSize: 12,
                        fontWeight: today ? 700 : 400,
                        color: today ? 'var(--sd-gold, #C9A84C)' : 'var(--sd-navy, #0D1B2E)',
                        marginBottom: 4,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: today ? 'var(--sd-gold, #C9A84C)' : 'transparent',
                        ...(today ? { color: '#fff' } : {}),
                      }}>
                        {dayNum}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {dayReservas.slice(0, 3).map(r => {
                          const cfg = TIPO_ESPACO_CONFIG[r.tipoEspaco]
                          return (
                            <div key={r.id} style={{
                              fontSize: 9,
                              padding: '2px 4px',
                              borderRadius: 3,
                              background: cfg?.corBg || 'rgba(13,27,46,0.06)',
                              color: cfg?.cor || 'var(--sd-navy, #0D1B2E)',
                              fontWeight: 500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {r.horaInicio} {r.espacoNome.split(' ')[0]}
                            </div>
                          )
                        })}
                        {dayReservas.length > 3 && (
                          <div style={{ fontSize: 9, color: 'var(--sd-ink-3, #8A9BB0)', fontWeight: 500 }}>
                            +{dayReservas.length - 3} mais
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* Week view */
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {getWeekDays(calDate).map(d => {
                  const ds = dateStr(d)
                  const dayReservas = reservasNoDia(ds)
                  const today = isToday(d)
                  return (
                    <div key={ds} style={{ borderRight: '1px solid var(--sd-border, #E4DDD0)' }}>
                      <div style={{
                        padding: '10px 8px',
                        textAlign: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                        color: today ? 'var(--sd-gold, #C9A84C)' : 'var(--sd-ink-2, #4A5E78)',
                        background: today ? 'rgba(201,168,76,0.08)' : 'var(--sd-cream, #F7F4EE)',
                        borderBottom: '1px solid var(--sd-border, #E4DDD0)',
                      }}>
                        {diasSemana[d.getDay() === 0 ? 6 : d.getDay() - 1]} {d.getDate()}
                      </div>
                      <div
                        onClick={() => { setReservaDataPrefill(ds); setRData(ds); setShowNovaReserva(true) }}
                        style={{ minHeight: 300, padding: 6, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}
                      >
                        {dayReservas.map(r => {
                          const cfg = TIPO_ESPACO_CONFIG[r.tipoEspaco]
                          return (
                            <div key={r.id} style={{
                              fontSize: 11,
                              padding: '6px 8px',
                              borderRadius: 6,
                              background: cfg?.corBg || 'rgba(13,27,46,0.06)',
                              borderLeft: `3px solid ${cfg?.cor || '#999'}`,
                            }}>
                              <div style={{ fontWeight: 600, color: cfg?.cor || 'var(--sd-navy, #0D1B2E)', fontSize: 10 }}>
                                {r.horaInicio}-{r.horaFim}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--sd-ink-2, #4A5E78)', marginTop: 2 }}>
                                {cfg?.emoji} {r.espacoNome}
                              </div>
                              <div style={{ fontSize: 9, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 1 }}>
                                {r.nomeResidente} (Fr. {r.fracaoId})
                              </div>
                            </div>
                          )
                        })}
                        {dayReservas.length === 0 && (
                          <div style={{ fontSize: 10, color: 'var(--sd-ink-3, #8A9BB0)', textAlign: 'center', marginTop: 40, opacity: 0.6 }}>
                            Sem reservas
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Reservas proximas */}
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 12 }}>
              Proximas reservas
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reservas
                .filter(r => r.data >= dateStr(new Date()) && r.estado !== 'cancelada')
                .sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio))
                .slice(0, 8)
                .map(r => {
                  const cfg = TIPO_ESPACO_CONFIG[r.tipoEspaco]
                  return (
                    <div key={r.id} style={{ ...cardStyle, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 9, background: cfg?.corBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                          {cfg?.emoji}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--sd-navy, #0D1B2E)' }}>{r.espacoNome}</div>
                          <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>
                            {r.nomeResidente} - Fracao {r.fracaoId}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 120 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>
                          {new Date(r.data + 'T00:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>
                          {r.horaInicio} - {r.horaFim}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 5,
                          background: r.estado === 'confirmada' ? 'rgba(34,197,94,0.12)' : r.estado === 'pendente' ? 'rgba(249,115,22,0.12)' : 'rgba(239,68,68,0.12)',
                          color: r.estado === 'confirmada' ? '#22C55E' : r.estado === 'pendente' ? '#F97316' : '#EF4444',
                        }}>
                          {r.estado === 'confirmada' ? 'Confirmada' : r.estado === 'pendente' ? 'Pendente' : 'Cancelada'}
                        </span>
                        {r.estado === 'pendente' && (
                          <button onClick={() => confirmarReserva(r.id)} style={{ ...btnSecondary, padding: '4px 10px', fontSize: 10, background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)' }}>
                            Confirmar
                          </button>
                        )}
                        {r.estado !== 'cancelada' && (
                          <button onClick={() => cancelarReserva(r.id)} style={{ ...btnSecondary, padding: '4px 10px', fontSize: 10, background: 'rgba(239,68,68,0.06)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              }
              {reservas.filter(r => r.data >= dateStr(new Date()) && r.estado !== 'cancelada').length === 0 && (
                <div style={{ ...cardStyle, textAlign: 'center', padding: 40, color: 'var(--sd-ink-3, #8A9BB0)', fontSize: 13 }}>
                  Nenhuma reserva futura registada
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Tab: Espacos ──────────────────────────────────────────────────── */}
      {tab === 'espacos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={() => setShowNovoEspaco(true)} style={btnPrimary}>
              + Adicionar espaco
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340, 1fr))', gap: 16 }}>
            {espacos.map(e => {
              const cfg = TIPO_ESPACO_CONFIG[e.tipo]
              const estadoCfg = ESTADO_ESPACO_CONFIG[e.estado]
              const numReservas = reservas.filter(r => r.espacoId === e.id && r.estado !== 'cancelada').length
              return (
                <div key={e.id} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Foto placeholder */}
                  <div style={{
                    height: 120,
                    borderRadius: 10,
                    background: `linear-gradient(135deg, ${cfg.corBg}, rgba(13,27,46,0.04))`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 40,
                  }}>
                    {cfg.emoji}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--sd-navy, #0D1B2E)' }}>{e.nome}</div>
                      <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 2 }}>{cfg.label}</div>
                    </div>
                    <span
                      onClick={() => toggleEstadoEspaco(e.id)}
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '3px 10px',
                        borderRadius: 5,
                        background: estadoCfg.bg,
                        color: estadoCfg.cor,
                        cursor: 'pointer',
                      }}
                    >
                      {estadoCfg.label}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)' }}>
                      <span style={{ fontWeight: 600 }}>Capacidade:</span> {e.capacidade} pessoas
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)' }}>
                      <span style={{ fontWeight: 600 }}>Horario:</span> {e.horarioInicio}-{e.horarioFim}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)' }}>
                      <span style={{ fontWeight: 600 }}>Reservas:</span> {numReservas} total
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      onClick={() => { setREspacoId(e.id); setShowNovaReserva(true) }}
                      style={{ ...btnSecondary, flex: 1, textAlign: 'center', padding: '8px 12px', fontSize: 12 }}
                    >
                      Reservar
                    </button>
                    <button
                      onClick={() => eliminarEspaco(e.id)}
                      style={{ ...btnSecondary, padding: '8px 12px', fontSize: 12, background: 'rgba(239,68,68,0.06)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {espacos.length === 0 && (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 60, color: 'var(--sd-ink-3, #8A9BB0)', fontSize: 14 }}>
              Nenhum espaco configurado. Adicione o primeiro espaco comum.
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Regras ───────────────────────────────────────────────────── */}
      {tab === 'regras' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {espacos.map(e => {
            const cfg = TIPO_ESPACO_CONFIG[e.tipo]
            const regra = regras.find(r => r.espacoId === e.id)
            if (!regra) return null
            const isEditing = regraEditId === e.id

            return (
              <div key={e.id} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 9, background: cfg.corBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                      {cfg.emoji}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--sd-navy, #0D1B2E)' }}>{e.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>{cfg.label}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setRegraEditId(isEditing ? null : e.id)}
                    style={{ ...btnSecondary, padding: '6px 14px', fontSize: 12 }}
                  >
                    {isEditing ? 'Fechar' : 'Editar'}
                  </button>
                </div>

                {!isEditing ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    <RegraCampo label="Horario permitido" valor={`${regra.horarioPermitidoInicio} - ${regra.horarioPermitidoFim}`} />
                    <RegraCampo label="Duracao maxima" valor={`${regra.duracaoMaximaHoras} horas`} />
                    <RegraCampo label="Antecedencia minima" valor={`${regra.antecedenciaMinimasDias} dias`} />
                    <RegraCampo label="Antecedencia maxima" valor={`${regra.antecedenciaMaximaDias} dias`} />
                    <RegraCampo label="Caucao / Deposito" valor={regra.caucaoValor > 0 ? `${fmt(regra.caucaoValor)} EUR` : 'Sem caucao'} />
                    <RegraCampo label="Limpeza obrigatoria" valor={regra.limpezaObrigatoria ? 'Sim' : 'Nao'} />
                    <RegraCampo label="Limite reservas/mes" valor={`${regra.limiteReservasMes} por fracao`} />
                    <RegraCampo label="Cancelamento" valor={`Ate ${regra.cancelamentoHorasAntes}h antes`} />
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Horario inicio</label>
                      <input type="time" value={regra.horarioPermitidoInicio} onChange={ev => atualizarRegra(e.id, 'horarioPermitidoInicio', ev.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Horario fim</label>
                      <input type="time" value={regra.horarioPermitidoFim} onChange={ev => atualizarRegra(e.id, 'horarioPermitidoFim', ev.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Duracao maxima (horas)</label>
                      <input type="number" min={1} max={24} value={regra.duracaoMaximaHoras} onChange={ev => atualizarRegra(e.id, 'duracaoMaximaHoras', parseInt(ev.target.value) || 1)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Antecedencia minima (dias)</label>
                      <input type="number" min={0} max={90} value={regra.antecedenciaMinimasDias} onChange={ev => atualizarRegra(e.id, 'antecedenciaMinimasDias', parseInt(ev.target.value) || 0)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Antecedencia maxima (dias)</label>
                      <input type="number" min={1} max={365} value={regra.antecedenciaMaximaDias} onChange={ev => atualizarRegra(e.id, 'antecedenciaMaximaDias', parseInt(ev.target.value) || 30)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Caucao / Deposito (EUR)</label>
                      <input type="number" min={0} step={5} value={regra.caucaoValor} onChange={ev => atualizarRegra(e.id, 'caucaoValor', parseFloat(ev.target.value) || 0)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Limpeza obrigatoria</label>
                      <select value={regra.limpezaObrigatoria ? 'sim' : 'nao'} onChange={ev => atualizarRegra(e.id, 'limpezaObrigatoria', ev.target.value === 'sim')} style={inputStyle}>
                        <option value="sim">Sim</option>
                        <option value="nao">Nao</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Limite reservas / mes / fracao</label>
                      <input type="number" min={1} max={31} value={regra.limiteReservasMes} onChange={ev => atualizarRegra(e.id, 'limiteReservasMes', parseInt(ev.target.value) || 1)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Cancelamento (horas antes)</label>
                      <input type="number" min={0} max={168} value={regra.cancelamentoHorasAntes} onChange={ev => atualizarRegra(e.id, 'cancelamentoHorasAntes', parseInt(ev.target.value) || 0)} style={inputStyle} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {espacos.length === 0 && (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 60, color: 'var(--sd-ink-3, #8A9BB0)', fontSize: 14 }}>
              Adicione espacos primeiro para configurar as regras.
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Relatorio ────────────────────────────────────────────────── */}
      {tab === 'relatorio' && (
        <div>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            <StatCardLocal emoji="📅" label="Reservas este mes" value={stats.totalReservasMes} />
            <StatCardLocal emoji="🏆" label="Espaco mais usado" value={stats.espacoMaisUsado ? stats.espacoMaisUsado[0] : 'N/A'} sub={stats.espacoMaisUsado ? `${stats.espacoMaisUsado[1]} reservas` : undefined} />
            <StatCardLocal emoji="📊" label="Taxa de ocupacao" value={`${stats.taxaOcupacao}%`} />
            <StatCardLocal emoji="💰" label="Receita caucoes" value={`${fmt(stats.receita)} EUR`} sub={stats.caucoesPendentes > 0 ? `${stats.caucoesPendentes} pendentes` : undefined} />
          </div>

          {/* Reservas por tipo - CSS bar chart */}
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 16 }}>
              Reservas por tipo de espaco (este mes)
            </h3>
            {Object.entries(stats.porTipo).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(() => {
                  const maxVal = Math.max(...Object.values(stats.porTipo), 1)
                  return Object.entries(stats.porTipo).sort((a, b) => b[1] - a[1]).map(([label, count]) => {
                    const tipoEntry = Object.entries(TIPO_ESPACO_CONFIG).find(([, c]) => c.label === label)
                    const cor = tipoEntry ? tipoEntry[1].cor : 'var(--sd-navy, #0D1B2E)'
                    return (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 130, fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', fontWeight: 500, flexShrink: 0, textAlign: 'right' }}>
                          {label}
                        </div>
                        <div style={{ flex: 1, height: 24, background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                          <div style={{
                            width: `${(count / maxVal) * 100}%`,
                            height: '100%',
                            background: cor,
                            borderRadius: 6,
                            transition: 'width 0.5s ease',
                            minWidth: 24,
                          }} />
                          <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 600, color: count / maxVal > 0.6 ? '#fff' : 'var(--sd-navy, #0D1B2E)' }}>
                            {count}
                          </span>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--sd-ink-3, #8A9BB0)', fontSize: 12 }}>
                Sem dados de reservas este mes
              </div>
            )}
          </div>

          {/* Top 5 fracoes */}
          <div style={{ ...cardStyle }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 16 }}>
              Top 5 fracoes que mais reservam
            </h3>
            {stats.topFracoes.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stats.topFracoes.map(([fracao, count], idx) => {
                  const maxVal = stats.topFracoes[0][1] as number
                  const medals = ['🥇', '🥈', '🥉', '4.', '5.']
                  return (
                    <div key={fracao} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 16, width: 28, textAlign: 'center' }}>{medals[idx]}</span>
                      <div style={{ width: 70, fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>
                        Fr. {fracao}
                      </div>
                      <div style={{ flex: 1, height: 22, background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                        <div style={{
                          width: `${((count as number) / maxVal) * 100}%`,
                          height: '100%',
                          background: idx === 0 ? 'var(--sd-gold, #C9A84C)' : idx === 1 ? 'rgba(201,168,76,0.6)' : 'rgba(201,168,76,0.35)',
                          borderRadius: 6,
                          transition: 'width 0.5s ease',
                          minWidth: 20,
                        }} />
                        <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>
                          {count} reservas
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--sd-ink-3, #8A9BB0)', fontSize: 12 }}>
                Sem dados de fracoes
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Modal: Novo Espaco ──────────────────────────────────────────── */}
      {showNovoEspaco && (
        <div style={overlayStyle} onClick={() => setShowNovoEspaco(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 20 }}>
              Novo Espaco Comum
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nome do espaco</label>
                <input value={fNome} onChange={e => setFNome(e.target.value)} placeholder="Ex: Salão de Festas Bloco A" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select value={fTipo} onChange={e => setFTipo(e.target.value as TipoEspaco)} style={inputStyle}>
                  {Object.entries(TIPO_ESPACO_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.emoji} {v.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Capacidade</label>
                  <input type="number" min={1} value={fCapacidade} onChange={e => setFCapacidade(e.target.value)} placeholder="20" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Abertura</label>
                  <input type="time" value={fHoraInicio} onChange={e => setFHoraInicio(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Fecho</label>
                  <input type="time" value={fHoraFim} onChange={e => setFHoraFim(e.target.value)} style={inputStyle} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNovoEspaco(false)} style={btnSecondary}>Cancelar</button>
              <button onClick={criarEspaco} style={btnPrimary}>Criar Espaco</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Nova Reserva ─────────────────────────────────────────── */}
      {showNovaReserva && (
        <div style={overlayStyle} onClick={() => { setShowNovaReserva(false); setReservaDataPrefill('') }}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 20 }}>
              Nova Reserva
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Espaco</label>
                <select value={rEspacoId} onChange={e => setREspacoId(e.target.value)} style={inputStyle}>
                  <option value="">-- Selecionar espaco --</option>
                  {espacos.filter(e => e.estado !== 'manutencao').map(e => {
                    const cfg = TIPO_ESPACO_CONFIG[e.tipo]
                    return <option key={e.id} value={e.id}>{cfg.emoji} {e.nome}</option>
                  })}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Nome do residente</label>
                  <input value={rNome} onChange={e => setRNome(e.target.value)} placeholder="Ex: Ana Silva" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Fracao</label>
                  <input value={rFracao} onChange={e => setRFracao(e.target.value)} placeholder="Ex: 2A" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Data</label>
                <input type="date" value={rData || reservaDataPrefill} onChange={e => setRData(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Hora inicio</label>
                  <input type="time" value={rHoraInicio} onChange={e => setRHoraInicio(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Hora fim</label>
                  <input type="time" value={rHoraFim} onChange={e => setRHoraFim(e.target.value)} style={inputStyle} />
                </div>
              </div>
              {rEspacoId && (() => {
                const regra = regras.find(r => r.espacoId === rEspacoId)
                if (!regra) return null
                return (
                  <div style={{ padding: 12, background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8, fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)' }}>
                    <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--sd-navy, #0D1B2E)' }}>Regras deste espaco:</div>
                    <div>Horario: {regra.horarioPermitidoInicio} - {regra.horarioPermitidoFim}</div>
                    <div>Duracao max: {regra.duracaoMaximaHoras}h | Limite: {regra.limiteReservasMes}/mes</div>
                    {regra.caucaoValor > 0 && <div>Caucao: {fmt(regra.caucaoValor)} EUR</div>}
                    {regra.limpezaObrigatoria && <div style={{ color: '#F97316', fontWeight: 500 }}>Limpeza obrigatoria apos utilizacao</div>}
                  </div>
                )
              })()}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowNovaReserva(false); setReservaDataPrefill('') }} style={btnSecondary}>Cancelar</button>
              <button onClick={criarReserva} style={btnPrimary}>Criar Reserva</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function RegraCampo({ label, valor }: { label: string; valor: string }) {
  return (
    <div style={{ padding: '10px 14px', background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{valor}</div>
    </div>
  )
}

function StatCardLocal({ emoji, label, value, sub }: { emoji: string; label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(201,168,76,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{emoji}</div>
      <div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: 'var(--sd-navy, #0D1B2E)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', fontWeight: 400, marginTop: 4 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}
