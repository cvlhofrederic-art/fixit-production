'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoMaioria = 'simples' | 'qualificada_2_3' | 'unanimidade'
type EstadoVotacao = 'aberta' | 'encerrada' | 'aprovada' | 'rejeitada'
type OpcaoVoto = 'favoravel' | 'contra' | 'abstencao'

interface Fracao {
  id: string
  designacao: string      // Ex: "Fração A - 1.º Dto"
  condominoNom: string
  condominoEmail: string
  permilagem: number      // 0-1000
}

interface Voto {
  fracaoId: string
  condominoNom: string
  opcao: OpcaoVoto
  permilagem: number
  dataVoto: string
  metodo: 'online' | 'presencial' | 'procuracao'
}

interface Votacao {
  id: string
  titulo: string
  descricao: string
  tipoMaioria: TipoMaioria
  prazoLimite: string
  estado: EstadoVotacao
  opcoes: OpcaoVoto[]
  edificioNom: string
  fracoes: Fracao[]
  votos: Voto[]
  criadaEm: string
  encerradaEm?: string
  observacoes?: string
}

interface ConfigVotacao {
  votoAntecipadoAtivo: boolean
  procuracaoAutomatica: boolean
  notificacaoEmail: boolean
  notificacaoLembrete: boolean
  diasLembrete: number
  quorum2aConvocatoria: number   // Lei 8/2022: 25%
}

interface Props {
  user: User
  userRole: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const TIPO_MAIORIA_CONFIG: Record<TipoMaioria, { label: string; descricao: string; emoji: string; artigo: string }> = {
  simples:          { label: 'Maioria Simples',       descricao: 'Mais de 50% dos votos',        emoji: '✋', artigo: 'Art.o 1432.o CC' },
  qualificada_2_3:  { label: 'Maioria Qualificada',   descricao: '2/3 do valor total do prédio',  emoji: '✌️', artigo: 'Art.o 1433.o CC' },
  unanimidade:      { label: 'Unanimidade',           descricao: 'Todos os condóminos devem votar a favor', emoji: '🤝', artigo: 'Art.o 1433.o n.o 1 CC' },
}

const ESTADO_CONFIG: Record<EstadoVotacao, { label: string; bg: string; color: string; dot: string }> = {
  aberta:    { label: 'Aberta',    bg: '#E6F4F2', color: '#1A7A6E', dot: '#1A7A6E' },
  encerrada: { label: 'Encerrada', bg: '#EDE8DF', color: '#4A5E78', dot: '#8A9BB0' },
  aprovada:  { label: 'Aprovada',  bg: '#E6F4F2', color: '#1A7A6E', dot: '#27ae60' },
  rejeitada: { label: 'Rejeitada', bg: '#FDECEA', color: '#C0392B', dot: '#C0392B' },
}

const OPCAO_CONFIG: Record<OpcaoVoto, { label: string; emoji: string; color: string }> = {
  favoravel:  { label: 'Favoravel', emoji: '👍', color: '#1A7A6E' },
  contra:     { label: 'Contra',    emoji: '👎', color: '#C0392B' },
  abstencao:  { label: 'Abstencao', emoji: '🤷', color: '#8A9BB0' },
}

const formatDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return s }
}

const formatDateTime = (s: string) => {
  try {
    return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return s }
}

const formatEur = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

// ─── Dados demo ──────────────────────────────────────────────────────────────

const DEMO_FRACOES: Fracao[] = [
  { id: 'f1', designacao: 'Fracao A - R/C Esq', condominoNom: 'Ana Santos', condominoEmail: 'ana.santos@email.pt', permilagem: 120 },
  { id: 'f2', designacao: 'Fracao B - R/C Dto', condominoNom: 'Bruno Costa', condominoEmail: 'bruno.costa@email.pt', permilagem: 120 },
  { id: 'f3', designacao: 'Fracao C - 1.o Esq', condominoNom: 'Carla Oliveira', condominoEmail: 'carla.oliveira@email.pt', permilagem: 130 },
  { id: 'f4', designacao: 'Fracao D - 1.o Dto', condominoNom: 'David Ferreira', condominoEmail: 'david.ferreira@email.pt', permilagem: 130 },
  { id: 'f5', designacao: 'Fracao E - 2.o Esq', condominoNom: 'Eva Rodrigues', condominoEmail: 'eva.rodrigues@email.pt', permilagem: 140 },
  { id: 'f6', designacao: 'Fracao F - 2.o Dto', condominoNom: 'Fabio Almeida', condominoEmail: 'fabio.almeida@email.pt', permilagem: 140 },
  { id: 'f7', designacao: 'Fracao G - 3.o Esq', condominoNom: 'Gabriela Pereira', condominoEmail: 'gabriela.pereira@email.pt', permilagem: 110 },
  { id: 'f8', designacao: 'Fracao H - 3.o Dto', condominoNom: 'Hugo Mendes', condominoEmail: 'hugo.mendes@email.pt', permilagem: 110 },
]

function buildDemoVotacoes(): Votacao[] {
  const now = new Date()
  const in3days = new Date(now.getTime() + 3 * 86400000).toISOString()
  const in7days = new Date(now.getTime() + 7 * 86400000).toISOString()
  const in14days = new Date(now.getTime() + 14 * 86400000).toISOString()
  const past10 = new Date(now.getTime() - 10 * 86400000).toISOString()
  const past30 = new Date(now.getTime() - 30 * 86400000).toISOString()
  const past60 = new Date(now.getTime() - 60 * 86400000).toISOString()

  return [
    {
      id: 'v1',
      titulo: 'Aprovacao do orcamento anual 2026',
      descricao: 'Deliberacao sobre o orcamento previsto para o exercicio de 2026, incluindo quotas ordinarias e fundo de reserva. Valor total proposto: 45.600 EUR.',
      tipoMaioria: 'simples',
      prazoLimite: in7days,
      estado: 'aberta',
      opcoes: ['favoravel', 'contra', 'abstencao'],
      edificioNom: 'Edifício Sol Nascente',
      fracoes: DEMO_FRACOES,
      votos: [
        { fracaoId: 'f1', condominoNom: 'Ana Santos', opcao: 'favoravel', permilagem: 120, dataVoto: new Date(now.getTime() - 2 * 86400000).toISOString(), metodo: 'online' },
        { fracaoId: 'f3', condominoNom: 'Carla Oliveira', opcao: 'favoravel', permilagem: 130, dataVoto: new Date(now.getTime() - 1 * 86400000).toISOString(), metodo: 'online' },
        { fracaoId: 'f5', condominoNom: 'Eva Rodrigues', opcao: 'contra', permilagem: 140, dataVoto: new Date(now.getTime() - 12 * 3600000).toISOString(), metodo: 'online' },
        { fracaoId: 'f7', condominoNom: 'Gabriela Pereira', opcao: 'favoravel', permilagem: 110, dataVoto: new Date(now.getTime() - 6 * 3600000).toISOString(), metodo: 'procuracao' },
      ],
      criadaEm: new Date(now.getTime() - 5 * 86400000).toISOString(),
    },
    {
      id: 'v2',
      titulo: 'Obras de reparacao do telhado',
      descricao: 'Votação para aprovação das obras de reparação urgente do telhado do bloco B. Três orçamentos obtidos. Valor médio: 18.200 EUR. Necessária maioria qualificada por ser obra de conservação extraordinária.',
      tipoMaioria: 'qualificada_2_3',
      prazoLimite: in3days,
      estado: 'aberta',
      opcoes: ['favoravel', 'contra', 'abstencao'],
      edificioNom: 'Edifício Sol Nascente',
      fracoes: DEMO_FRACOES,
      votos: [
        { fracaoId: 'f2', condominoNom: 'Bruno Costa', opcao: 'favoravel', permilagem: 120, dataVoto: new Date(now.getTime() - 1 * 86400000).toISOString(), metodo: 'online' },
        { fracaoId: 'f4', condominoNom: 'David Ferreira', opcao: 'favoravel', permilagem: 130, dataVoto: new Date(now.getTime() - 18 * 3600000).toISOString(), metodo: 'online' },
      ],
      criadaEm: new Date(now.getTime() - 3 * 86400000).toISOString(),
    },
    {
      id: 'v3',
      titulo: 'Alteracao do regulamento interno',
      descricao: 'Proposta de alteracao ao regulamento do condominio para incluir novas regras sobre uso de areas comuns, estacionamento de bicicletas e horarios de silencio. Requer unanimidade conforme CC.',
      tipoMaioria: 'unanimidade',
      prazoLimite: in14days,
      estado: 'aberta',
      opcoes: ['favoravel', 'contra', 'abstencao'],
      edificioNom: 'Edifício Sol Nascente',
      fracoes: DEMO_FRACOES,
      votos: [
        { fracaoId: 'f1', condominoNom: 'Ana Santos', opcao: 'favoravel', permilagem: 120, dataVoto: new Date(now.getTime() - 1 * 86400000).toISOString(), metodo: 'online' },
      ],
      criadaEm: new Date(now.getTime() - 2 * 86400000).toISOString(),
    },
    // Historico
    {
      id: 'v4',
      titulo: 'Contratacao servico de limpeza',
      descricao: 'Deliberacao sobre novo contrato de limpeza das areas comuns com a empresa LimpoPro Lda. Valor mensal: 380 EUR.',
      tipoMaioria: 'simples',
      prazoLimite: past10,
      estado: 'aprovada',
      opcoes: ['favoravel', 'contra', 'abstencao'],
      edificioNom: 'Edifício Sol Nascente',
      fracoes: DEMO_FRACOES,
      votos: [
        { fracaoId: 'f1', condominoNom: 'Ana Santos', opcao: 'favoravel', permilagem: 120, dataVoto: past30, metodo: 'online' },
        { fracaoId: 'f2', condominoNom: 'Bruno Costa', opcao: 'favoravel', permilagem: 120, dataVoto: past30, metodo: 'online' },
        { fracaoId: 'f3', condominoNom: 'Carla Oliveira', opcao: 'favoravel', permilagem: 130, dataVoto: past30, metodo: 'presencial' },
        { fracaoId: 'f4', condominoNom: 'David Ferreira', opcao: 'contra', permilagem: 130, dataVoto: past30, metodo: 'online' },
        { fracaoId: 'f5', condominoNom: 'Eva Rodrigues', opcao: 'favoravel', permilagem: 140, dataVoto: past30, metodo: 'online' },
        { fracaoId: 'f6', condominoNom: 'Fabio Almeida', opcao: 'abstencao', permilagem: 140, dataVoto: past30, metodo: 'procuracao' },
        { fracaoId: 'f7', condominoNom: 'Gabriela Pereira', opcao: 'favoravel', permilagem: 110, dataVoto: past30, metodo: 'online' },
      ],
      criadaEm: past60,
      encerradaEm: past10,
    },
    {
      id: 'v5',
      titulo: 'Instalacao de paineis solares',
      descricao: 'Proposta para instalacao de paineis fotovoltaicos no terraço para reducao de custos energeticos nas areas comuns. Investimento: 32.000 EUR com retorno estimado em 6 anos.',
      tipoMaioria: 'qualificada_2_3',
      prazoLimite: past30,
      estado: 'rejeitada',
      opcoes: ['favoravel', 'contra', 'abstencao'],
      edificioNom: 'Edifício Sol Nascente',
      fracoes: DEMO_FRACOES,
      votos: [
        { fracaoId: 'f1', condominoNom: 'Ana Santos', opcao: 'favoravel', permilagem: 120, dataVoto: past60, metodo: 'online' },
        { fracaoId: 'f2', condominoNom: 'Bruno Costa', opcao: 'contra', permilagem: 120, dataVoto: past60, metodo: 'online' },
        { fracaoId: 'f3', condominoNom: 'Carla Oliveira', opcao: 'contra', permilagem: 130, dataVoto: past60, metodo: 'presencial' },
        { fracaoId: 'f4', condominoNom: 'David Ferreira', opcao: 'contra', permilagem: 130, dataVoto: past60, metodo: 'online' },
        { fracaoId: 'f5', condominoNom: 'Eva Rodrigues', opcao: 'favoravel', permilagem: 140, dataVoto: past60, metodo: 'online' },
        { fracaoId: 'f6', condominoNom: 'Fabio Almeida', opcao: 'contra', permilagem: 140, dataVoto: past60, metodo: 'online' },
        { fracaoId: 'f8', condominoNom: 'Hugo Mendes', opcao: 'abstencao', permilagem: 110, dataVoto: past60, metodo: 'online' },
      ],
      criadaEm: new Date(new Date(past60).getTime() - 5 * 86400000).toISOString(),
      encerradaEm: past30,
    },
  ]
}

const DEFAULT_CONFIG: ConfigVotacao = {
  votoAntecipadoAtivo: true,
  procuracaoAutomatica: false,
  notificacaoEmail: true,
  notificacaoLembrete: true,
  diasLembrete: 3,
  quorum2aConvocatoria: 25,
}

// ─── Helpers de calculo ──────────────────────────────────────────────────────

function calcularResultados(v: Votacao) {
  const totalPermilagem = v.fracoes.reduce((s, f) => s + f.permilagem, 0)
  const totalFracoes = v.fracoes.length
  const votosRecebidos = v.votos.length

  const porOpcao: Record<OpcaoVoto, { count: number; permilagem: number }> = {
    favoravel: { count: 0, permilagem: 0 },
    contra: { count: 0, permilagem: 0 },
    abstencao: { count: 0, permilagem: 0 },
  }

  for (const voto of v.votos) {
    porOpcao[voto.opcao].count++
    porOpcao[voto.opcao].permilagem += voto.permilagem
  }

  const permilagemVotada = v.votos.reduce((s, vt) => s + vt.permilagem, 0)
  const quorumAtingido = (permilagemVotada / totalPermilagem) * 100

  let aprovada = false
  if (v.tipoMaioria === 'simples') {
    aprovada = porOpcao.favoravel.permilagem > (permilagemVotada - porOpcao.abstencao.permilagem) / 2
  } else if (v.tipoMaioria === 'qualificada_2_3') {
    aprovada = porOpcao.favoravel.permilagem >= (totalPermilagem * 2) / 3
  } else {
    aprovada = porOpcao.favoravel.count === totalFracoes
  }

  return {
    totalPermilagem,
    totalFracoes,
    votosRecebidos,
    porOpcao,
    permilagemVotada,
    quorumAtingido,
    aprovada,
  }
}

function getCountdown(prazo: string): string {
  const diff = new Date(prazo).getTime() - Date.now()
  if (diff <= 0) return 'Encerrado'
  const dias = Math.floor(diff / 86400000)
  const horas = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (dias > 0) return `${dias}d ${horas}h restantes`
  if (horas > 0) return `${horas}h ${mins}m restantes`
  return `${mins}m restantes`
}

// ─── Estilos partilhados ─────────────────────────────────────────────────────

const sCard: React.CSSProperties = { background: '#fff', border: '1px solid var(--sd-border,#E4DDD0)', borderRadius: 12, padding: 20 }
const sHeading: React.CSSProperties = { fontFamily: "'Playfair Display',serif", color: 'var(--sd-navy,#0D1B2E)', margin: 0 }
const sLabel: React.CSSProperties = { fontSize: 13, color: 'var(--sd-ink-2,#4A5E78)', fontWeight: 500, marginBottom: 4 }
const sInput: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--sd-border,#E4DDD0)', fontSize: 14, fontFamily: "'Outfit',sans-serif", color: 'var(--sd-navy,#0D1B2E)', background: '#fff', outline: 'none', boxSizing: 'border-box' }
const sTextarea: React.CSSProperties = { ...sInput, minHeight: 80, resize: 'vertical' as const }
const sSelect: React.CSSProperties = { ...sInput, cursor: 'pointer' }
const sBtnPrimary: React.CSSProperties = { padding: '10px 20px', borderRadius: 8, border: 'none', background: 'var(--sd-navy,#0D1B2E)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", display: 'inline-flex', alignItems: 'center', gap: 8 }
const sBtnSecondary: React.CSSProperties = { ...sBtnPrimary, background: 'transparent', color: 'var(--sd-navy,#0D1B2E)', border: '1px solid var(--sd-border,#E4DDD0)' }
const sBtnGold: React.CSSProperties = { ...sBtnPrimary, background: 'var(--sd-gold,#C9A84C)', color: '#fff' }

// ─── Componente principal ────────────────────────────────────────────────────

export default function VotacaoOnlineSection({ user, userRole }: Props) {
  // State
  const [tab, setTab] = useState<'ativas' | 'historico' | 'configuracao'>('ativas')
  const [votacoes, setVotacoes] = useState<Votacao[]>([])
  const [config, setConfig] = useState<ConfigVotacao>(DEFAULT_CONFIG)
  const [showModal, setShowModal] = useState(false)
  const [selectedVotacao, setSelectedVotacao] = useState<Votacao | null>(null)
  const [showVoteModal, setShowVoteModal] = useState(false)

  // Historico filters
  const [filtroEdificio, setFiltroEdificio] = useState<string>('todos')
  const [filtroAno, setFiltroAno] = useState<string>('todos')
  const [filtroResultado, setFiltroResultado] = useState<string>('todos')

  // Form: nova votacao
  const [formTitulo, setFormTitulo] = useState('')
  const [formDescricao, setFormDescricao] = useState('')
  const [formTipoMaioria, setFormTipoMaioria] = useState<TipoMaioria>('simples')
  const [formPrazo, setFormPrazo] = useState('')
  const [formEdificio, setFormEdificio] = useState('Edifício Sol Nascente')

  // Simulate vote form
  const [voteFracaoId, setVoteFracaoId] = useState('')
  const [voteOpcao, setVoteOpcao] = useState<OpcaoVoto>('favoravel')

  // Timer for countdown
  const [, setTick] = useState(0)

  // Storage
  const STORAGE_KEY = `fixit_votacoes_${user.id}`
  const CONFIG_KEY = `fixit_votacoes_config_${user.id}`

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setVotacoes(JSON.parse(stored))
      } else {
        const demo = buildDemoVotacoes()
        setVotacoes(demo)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
      }
      const cfg = localStorage.getItem(CONFIG_KEY)
      if (cfg) setConfig(JSON.parse(cfg))
    } catch { /* ignore */ }
  }, [])

  const saveVotacoes = useCallback((list: Votacao[]) => {
    setVotacoes(list)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  }, [STORAGE_KEY])

  const saveConfig = useCallback((c: ConfigVotacao) => {
    setConfig(c)
    localStorage.setItem(CONFIG_KEY, JSON.stringify(c))
  }, [CONFIG_KEY])

  // Countdown refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  // ── Ativas / Historico split
  const ativas = useMemo(() => votacoes.filter(v => v.estado === 'aberta'), [votacoes])
  const historico = useMemo(() => votacoes.filter(v => v.estado !== 'aberta'), [votacoes])

  // ── Historico filtered
  const edificiosUnicos = useMemo(() => [...new Set(votacoes.map(v => v.edificioNom))], [votacoes])
  const anosUnicos = useMemo(() => [...new Set(votacoes.map(v => new Date(v.criadaEm).getFullYear().toString()))].sort().reverse(), [votacoes])

  const historicoFiltrado = useMemo(() => {
    let list = historico
    if (filtroEdificio !== 'todos') list = list.filter(v => v.edificioNom === filtroEdificio)
    if (filtroAno !== 'todos') list = list.filter(v => new Date(v.criadaEm).getFullYear().toString() === filtroAno)
    if (filtroResultado !== 'todos') list = list.filter(v => v.estado === filtroResultado)
    return list.sort((a, b) => new Date(b.encerradaEm || b.prazoLimite).getTime() - new Date(a.encerradaEm || a.prazoLimite).getTime())
  }, [historico, filtroEdificio, filtroAno, filtroResultado])

  // ── Stats globais
  const stats = useMemo(() => {
    const totalAtivas = ativas.length
    const totalHistorico = historico.length
    const totalAprovadas = votacoes.filter(v => v.estado === 'aprovada').length
    const totalRejeitadas = votacoes.filter(v => v.estado === 'rejeitada').length
    const taxaParticipacao = votacoes.length > 0
      ? Math.round(votacoes.reduce((s, v) => s + (v.votos.length / v.fracoes.length) * 100, 0) / votacoes.length)
      : 0
    return { totalAtivas, totalHistorico, totalAprovadas, totalRejeitadas, taxaParticipacao }
  }, [votacoes, ativas, historico])

  // ── Criar votacao
  const handleCriarVotacao = () => {
    if (!formTitulo.trim() || !formPrazo) return
    const nova: Votacao = {
      id: uid(),
      titulo: formTitulo.trim(),
      descricao: formDescricao.trim(),
      tipoMaioria: formTipoMaioria,
      prazoLimite: new Date(formPrazo).toISOString(),
      estado: 'aberta',
      opcoes: ['favoravel', 'contra', 'abstencao'],
      edificioNom: formEdificio,
      fracoes: DEMO_FRACOES,
      votos: [],
      criadaEm: new Date().toISOString(),
    }
    saveVotacoes([nova, ...votacoes])
    setFormTitulo('')
    setFormDescricao('')
    setFormTipoMaioria('simples')
    setFormPrazo('')
    setShowModal(false)
  }

  // ── Simular voto
  const handleVotar = () => {
    if (!selectedVotacao || !voteFracaoId) return
    const fracao = selectedVotacao.fracoes.find(f => f.id === voteFracaoId)
    if (!fracao) return
    if (selectedVotacao.votos.find(v => v.fracaoId === voteFracaoId)) return

    const novoVoto: Voto = {
      fracaoId: voteFracaoId,
      condominoNom: fracao.condominoNom,
      opcao: voteOpcao,
      permilagem: fracao.permilagem,
      dataVoto: new Date().toISOString(),
      metodo: 'online',
    }

    const updated = votacoes.map(v => {
      if (v.id === selectedVotacao.id) {
        return { ...v, votos: [...v.votos, novoVoto] }
      }
      return v
    })
    saveVotacoes(updated)
    setSelectedVotacao(prev => prev ? { ...prev, votos: [...prev.votos, novoVoto] } : null)
    setVoteFracaoId('')
    setShowVoteModal(false)
  }

  // ── Encerrar votacao
  const handleEncerrar = (votacao: Votacao) => {
    const res = calcularResultados(votacao)
    const novoEstado: EstadoVotacao = res.aprovada ? 'aprovada' : 'rejeitada'
    const updated = votacoes.map(v => {
      if (v.id === votacao.id) {
        return { ...v, estado: novoEstado, encerradaEm: new Date().toISOString() }
      }
      return v
    })
    saveVotacoes(updated)
    if (selectedVotacao?.id === votacao.id) {
      setSelectedVotacao({ ...votacao, estado: novoEstado, encerradaEm: new Date().toISOString() })
    }
  }

  // ── Export ata parcial
  const handleExportAta = (votacao: Votacao) => {
    const res = calcularResultados(votacao)
    const lines = [
      `ATA PARCIAL - VOTACAO ONLINE`,
      `========================================`,
      ``,
      `Titulo: ${votacao.titulo}`,
      `Edificio: ${votacao.edificioNom}`,
      `Tipo de Maioria: ${TIPO_MAIORIA_CONFIG[votacao.tipoMaioria].label} (${TIPO_MAIORIA_CONFIG[votacao.tipoMaioria].artigo})`,
      `Data de Criacao: ${formatDate(votacao.criadaEm)}`,
      `Prazo Limite: ${formatDate(votacao.prazoLimite)}`,
      votacao.encerradaEm ? `Data de Encerramento: ${formatDate(votacao.encerradaEm)}` : '',
      `Estado: ${ESTADO_CONFIG[votacao.estado].label}`,
      ``,
      `DESCRICAO:`,
      votacao.descricao,
      ``,
      `RESULTADOS:`,
      `  Total de fracoes: ${res.totalFracoes}`,
      `  Votos recebidos: ${res.votosRecebidos} (${Math.round((res.votosRecebidos / res.totalFracoes) * 100)}%)`,
      `  Permilagem votada: ${res.permilagemVotada} / ${res.totalPermilagem} (${res.quorumAtingido.toFixed(1)}%)`,
      ``,
      `  Favoravel: ${res.porOpcao.favoravel.count} votos (${res.porOpcao.favoravel.permilagem} permilagem)`,
      `  Contra: ${res.porOpcao.contra.count} votos (${res.porOpcao.contra.permilagem} permilagem)`,
      `  Abstencao: ${res.porOpcao.abstencao.count} votos (${res.porOpcao.abstencao.permilagem} permilagem)`,
      ``,
      `DELIBERACAO: ${res.aprovada ? 'APROVADA' : 'NAO APROVADA'}`,
      ``,
      `DETALHE DOS VOTOS:`,
      ...votacao.votos.map(v =>
        `  - ${v.condominoNom} (${v.permilagem} permilagem): ${OPCAO_CONFIG[v.opcao].label} [${v.metodo}] em ${formatDateTime(v.dataVoto)}`
      ),
      ``,
      `FRACOES QUE NAO VOTARAM:`,
      ...votacao.fracoes.filter(f => !votacao.votos.find(v => v.fracaoId === f.id)).map(f =>
        `  - ${f.condominoNom} (${f.designacao}, ${f.permilagem} permilagem)`
      ),
      ``,
      `========================================`,
      `Documento gerado automaticamente em ${formatDateTime(new Date().toISOString())}`,
      `Fixit - Gestao de Condominios`,
    ].filter(Boolean)

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ata_votacao_${votacao.id}_${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Tabs nav ──────────────────────────────────────────────────────────────
  const TABS: { key: typeof tab; label: string; emoji: string; count?: number }[] = [
    { key: 'ativas', label: 'Votacoes Ativas', emoji: '🗳️', count: ativas.length },
    { key: 'historico', label: 'Historico', emoji: '📜', count: historico.length },
    { key: 'configuracao', label: 'Configuracao', emoji: '⚙️' },
  ]

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Outfit',sans-serif", color: 'var(--sd-navy,#0D1B2E)' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ ...sHeading, fontSize: 28, marginBottom: 6 }}>Votacao Online AG</h1>
        <p style={{ fontSize: 14, color: 'var(--sd-ink-2,#4A5E78)', margin: 0 }}>
          Gestao de deliberacoes e votacoes eletronicas para assembleias de condominos
        </p>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { emoji: '🗳️', label: 'Ativas', value: stats.totalAtivas, color: 'var(--sd-gold,#C9A84C)' },
          { emoji: '✅', label: 'Aprovadas', value: stats.totalAprovadas, color: '#1A7A6E' },
          { emoji: '❌', label: 'Rejeitadas', value: stats.totalRejeitadas, color: '#C0392B' },
          { emoji: '📊', label: 'Participacao media', value: `${stats.taxaParticipacao}%`, color: 'var(--sd-navy,#0D1B2E)' },
        ].map((s, i) => (
          <div key={i} style={{ ...sCard, display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(201,168,76,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{s.emoji}</div>
            <div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, lineHeight: 1, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--sd-border,#E4DDD0)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 18px',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--sd-gold,#C9A84C)' : '2px solid transparent',
              background: 'transparent',
              color: tab === t.key ? 'var(--sd-navy,#0D1B2E)' : 'var(--sd-ink-3,#8A9BB0)',
              fontWeight: tab === t.key ? 600 : 400,
              fontSize: 14,
              fontFamily: "'Outfit',sans-serif",
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <span>{t.emoji}</span>
            {t.label}
            {t.count !== undefined && (
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: 10,
                background: tab === t.key ? 'var(--sd-gold,#C9A84C)' : 'var(--sd-border,#E4DDD0)',
                color: tab === t.key ? '#fff' : 'var(--sd-ink-3,#8A9BB0)',
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Votacoes Ativas ───────────────────────────────────────────── */}
      {tab === 'ativas' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ ...sHeading, fontSize: 20 }}>Deliberacoes em curso</h2>
            <button onClick={() => setShowModal(true)} style={sBtnGold}>
              + Criar nova votacao
            </button>
          </div>

          {ativas.length === 0 && (
            <div style={{ ...sCard, textAlign: 'center', padding: 48, color: 'var(--sd-ink-3,#8A9BB0)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗳️</div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>Nenhuma votacao ativa</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Crie uma nova votacao para iniciar uma deliberacao online.</div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {ativas.map(v => {
              const res = calcularResultados(v)
              const countdown = getCountdown(v.prazoLimite)
              const isUrgent = new Date(v.prazoLimite).getTime() - Date.now() < 3 * 86400000
              const progressPct = Math.round((res.votosRecebidos / res.totalFracoes) * 100)

              return (
                <div key={v.id} style={{ ...sCard, cursor: 'pointer', transition: 'box-shadow 0.2s' }}
                  onClick={() => setSelectedVotacao(v)}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(13,27,46,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                >
                  {/* Top row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: ESTADO_CONFIG[v.estado].bg, color: ESTADO_CONFIG[v.estado].color }}>
                          {ESTADO_CONFIG[v.estado].label}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 5, background: 'rgba(201,168,76,0.12)', color: 'var(--sd-gold,#C9A84C)' }}>
                          {TIPO_MAIORIA_CONFIG[v.tipoMaioria].emoji} {TIPO_MAIORIA_CONFIG[v.tipoMaioria].label}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--sd-ink-3,#8A9BB0)' }}>
                          {TIPO_MAIORIA_CONFIG[v.tipoMaioria].artigo}
                        </span>
                      </div>
                      <h3 style={{ ...sHeading, fontSize: 17, marginBottom: 4 }}>{v.titulo}</h3>
                      <p style={{ fontSize: 13, color: 'var(--sd-ink-2,#4A5E78)', margin: 0, lineHeight: 1.5 }}>
                        {v.descricao.length > 150 ? v.descricao.slice(0, 150) + '...' : v.descricao}
                      </p>
                    </div>
                    <div style={{
                      textAlign: 'right',
                      padding: '8px 14px',
                      borderRadius: 8,
                      background: isUrgent ? '#FDECEA' : 'var(--sd-cream,#F7F4EE)',
                      flexShrink: 0,
                      marginLeft: 16,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isUrgent ? '#C0392B' : 'var(--sd-ink-2,#4A5E78)' }}>
                        {countdown}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 2 }}>
                        Prazo: {formatDate(v.prazoLimite)}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--sd-ink-2,#4A5E78)' }}>
                        Progresso: {res.votosRecebidos} / {res.totalFracoes} fracoes ({progressPct}%)
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)' }}>
                        {res.permilagemVotada} / {res.totalPermilagem} permilagem
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: 'var(--sd-border,#E4DDD0)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        borderRadius: 4,
                        width: `${progressPct}%`,
                        background: progressPct >= 66 ? '#1A7A6E' : progressPct >= 33 ? 'var(--sd-gold,#C9A84C)' : '#C0392B',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>

                    {/* Mini results */}
                    <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                      {(['favoravel', 'contra', 'abstencao'] as OpcaoVoto[]).map(opcao => (
                        <div key={opcao} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 13 }}>{OPCAO_CONFIG[opcao].emoji}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: OPCAO_CONFIG[opcao].color }}>
                            {res.porOpcao[opcao].count}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)' }}>
                            ({res.porOpcao[opcao].permilagem}‰)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Edificio */}
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    🏢 {v.edificioNom}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Tab: Historico ─────────────────────────────────────────────────── */}
      {tab === 'historico' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ ...sHeading, fontSize: 20 }}>Historico de votacoes</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select value={filtroEdificio} onChange={e => setFiltroEdificio(e.target.value)} style={{ ...sSelect, width: 'auto', fontSize: 12, padding: '6px 10px' }}>
                <option value="todos">Todos os edificios</option>
                {edificiosUnicos.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} style={{ ...sSelect, width: 'auto', fontSize: 12, padding: '6px 10px' }}>
                <option value="todos">Todos os anos</option>
                {anosUnicos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={filtroResultado} onChange={e => setFiltroResultado(e.target.value)} style={{ ...sSelect, width: 'auto', fontSize: 12, padding: '6px 10px' }}>
                <option value="todos">Todos os resultados</option>
                <option value="aprovada">Aprovada</option>
                <option value="rejeitada">Rejeitada</option>
                <option value="encerrada">Encerrada</option>
              </select>
            </div>
          </div>

          {historicoFiltrado.length === 0 && (
            <div style={{ ...sCard, textAlign: 'center', padding: 48, color: 'var(--sd-ink-3,#8A9BB0)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📜</div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>Nenhuma votacao no historico</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>As votacoes encerradas aparecerao aqui.</div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {historicoFiltrado.map(v => {
              const res = calcularResultados(v)
              const participacao = Math.round((res.votosRecebidos / res.totalFracoes) * 100)

              return (
                <div key={v.id} style={{ ...sCard, cursor: 'pointer', transition: 'box-shadow 0.2s' }}
                  onClick={() => setSelectedVotacao(v)}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(13,27,46,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: ESTADO_CONFIG[v.estado].bg, color: ESTADO_CONFIG[v.estado].color }}>
                          {ESTADO_CONFIG[v.estado].label}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 5, background: 'rgba(201,168,76,0.12)', color: 'var(--sd-gold,#C9A84C)' }}>
                          {TIPO_MAIORIA_CONFIG[v.tipoMaioria].label}
                        </span>
                      </div>
                      <h3 style={{ ...sHeading, fontSize: 16, marginBottom: 4 }}>{v.titulo}</h3>
                      <p style={{ fontSize: 12, color: 'var(--sd-ink-2,#4A5E78)', margin: 0 }}>
                        {v.descricao.length > 120 ? v.descricao.slice(0, 120) + '...' : v.descricao}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                      <div style={{ fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)' }}>
                        Encerrada: {v.encerradaEm ? formatDate(v.encerradaEm) : formatDate(v.prazoLimite)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 2 }}>
                        Quorum: {res.quorumAtingido.toFixed(1)}% | Participacao: {participacao}%
                      </div>
                    </div>
                  </div>

                  {/* Results bar */}
                  <div style={{ display: 'flex', gap: 2, marginTop: 12, height: 6, borderRadius: 3, overflow: 'hidden' }}>
                    {res.porOpcao.favoravel.permilagem > 0 && (
                      <div style={{ width: `${(res.porOpcao.favoravel.permilagem / res.totalPermilagem) * 100}%`, background: '#1A7A6E', borderRadius: 3 }} />
                    )}
                    {res.porOpcao.contra.permilagem > 0 && (
                      <div style={{ width: `${(res.porOpcao.contra.permilagem / res.totalPermilagem) * 100}%`, background: '#C0392B', borderRadius: 3 }} />
                    )}
                    {res.porOpcao.abstencao.permilagem > 0 && (
                      <div style={{ width: `${(res.porOpcao.abstencao.permilagem / res.totalPermilagem) * 100}%`, background: '#8A9BB0', borderRadius: 3 }} />
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 14 }}>
                      {(['favoravel', 'contra', 'abstencao'] as OpcaoVoto[]).map(opcao => (
                        <span key={opcao} style={{ fontSize: 11, color: OPCAO_CONFIG[opcao].color, fontWeight: 500 }}>
                          {OPCAO_CONFIG[opcao].emoji} {res.porOpcao[opcao].count} ({res.porOpcao[opcao].permilagem}‰)
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleExportAta(v) }}
                      style={{ ...sBtnSecondary, padding: '5px 12px', fontSize: 11 }}
                    >
                      📄 Exportar ata parcial
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Tab: Configuracao ──────────────────────────────────────────────── */}
      {tab === 'configuracao' && (
        <div>
          <h2 style={{ ...sHeading, fontSize: 20, marginBottom: 20 }}>Configuracao de votacoes</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Voto antecipado */}
            <div style={sCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)', marginBottom: 4 }}>
                    🗳️ Voto antecipado (antes da AG)
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--sd-ink-2,#4A5E78)' }}>
                    Permitir que os condominos votem eletronicamente antes da sessao presencial da Assembleia Geral.
                  </div>
                </div>
                <button
                  onClick={() => saveConfig({ ...config, votoAntecipadoAtivo: !config.votoAntecipadoAtivo })}
                  style={{
                    width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', position: 'relative',
                    background: config.votoAntecipadoAtivo ? 'var(--sd-gold,#C9A84C)' : 'var(--sd-border,#E4DDD0)',
                    transition: 'background 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 11, background: '#fff', position: 'absolute', top: 3,
                    left: config.votoAntecipadoAtivo ? 27 : 3,
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  }} />
                </button>
              </div>
            </div>

            {/* Procuracao automatica */}
            <div style={sCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)', marginBottom: 4 }}>
                    📋 Geracao automatica de procuracao
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--sd-ink-2,#4A5E78)' }}>
                    Gerar automaticamente documento de procuracao quando um condomino delega o seu voto a outro representante.
                  </div>
                </div>
                <button
                  onClick={() => saveConfig({ ...config, procuracaoAutomatica: !config.procuracaoAutomatica })}
                  style={{
                    width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', position: 'relative',
                    background: config.procuracaoAutomatica ? 'var(--sd-gold,#C9A84C)' : 'var(--sd-border,#E4DDD0)',
                    transition: 'background 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 11, background: '#fff', position: 'absolute', top: 3,
                    left: config.procuracaoAutomatica ? 27 : 3,
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  }} />
                </button>
              </div>
            </div>

            {/* Notificacao email */}
            <div style={sCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)', marginBottom: 4 }}>
                    📧 Notificacao por email aos condominos
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--sd-ink-2,#4A5E78)' }}>
                    Enviar email automatico quando uma nova votacao e criada, com link de acesso para votar.
                  </div>
                </div>
                <button
                  onClick={() => saveConfig({ ...config, notificacaoEmail: !config.notificacaoEmail })}
                  style={{
                    width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', position: 'relative',
                    background: config.notificacaoEmail ? 'var(--sd-gold,#C9A84C)' : 'var(--sd-border,#E4DDD0)',
                    transition: 'background 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 11, background: '#fff', position: 'absolute', top: 3,
                    left: config.notificacaoEmail ? 27 : 3,
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  }} />
                </button>
              </div>
            </div>

            {/* Lembrete */}
            <div style={sCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)', marginBottom: 4 }}>
                    🔔 Lembrete antes do prazo
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--sd-ink-2,#4A5E78)' }}>
                    Enviar lembrete automatico aos condominos que ainda nao votaram, X dias antes do prazo limite.
                  </div>
                  {config.notificacaoLembrete && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                      <span style={{ fontSize: 13, color: 'var(--sd-ink-2,#4A5E78)' }}>Enviar lembrete</span>
                      <select
                        value={config.diasLembrete}
                        onChange={e => saveConfig({ ...config, diasLembrete: Number(e.target.value) })}
                        style={{ ...sSelect, width: 80, padding: '4px 8px', fontSize: 13 }}
                      >
                        {[1, 2, 3, 5, 7].map(d => <option key={d} value={d}>{d} dias</option>)}
                      </select>
                      <span style={{ fontSize: 13, color: 'var(--sd-ink-2,#4A5E78)' }}>antes do prazo</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => saveConfig({ ...config, notificacaoLembrete: !config.notificacaoLembrete })}
                  style={{
                    width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', position: 'relative',
                    background: config.notificacaoLembrete ? 'var(--sd-gold,#C9A84C)' : 'var(--sd-border,#E4DDD0)',
                    transition: 'background 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 11, background: '#fff', position: 'absolute', top: 3,
                    left: config.notificacaoLembrete ? 27 : 3,
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  }} />
                </button>
              </div>
            </div>

            {/* Quorum rules */}
            <div style={sCard}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)', marginBottom: 8 }}>
                ⚖️ Regras de quorum (Lei 8/2022)
              </div>
              <div style={{ fontSize: 13, color: 'var(--sd-ink-2,#4A5E78)', lineHeight: 1.6, marginBottom: 12 }}>
                A Lei n.o 8/2022, de 10 de janeiro, introduziu regras especificas para quorum em assembleias de condominos.
                Em segunda convocatoria, a assembleia pode deliberar com qualquer numero de condominos presentes,
                desde que representem, no minimo, 25% do capital investido (permilagem).
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 8, background: 'var(--sd-cream,#F7F4EE)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)' }}>Quorum minimo 2.a convocatoria:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={config.quorum2aConvocatoria}
                    onChange={e => saveConfig({ ...config, quorum2aConvocatoria: Math.max(1, Math.min(100, Number(e.target.value))) })}
                    style={{ ...sInput, width: 64, textAlign: 'center', padding: '6px 8px' }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--sd-ink-2,#4A5E78)' }}>% do capital investido</span>
                </div>
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)', fontStyle: 'italic' }}>
                Nota: O valor minimo legal e 25% do capital investido para a 2.a convocatoria (Art.o 1432.o, n.o 4 CC, na redacao da Lei 8/2022).
              </div>
            </div>

            {/* Info box about majority types */}
            <div style={{ ...sCard, background: 'var(--sd-cream,#F7F4EE)' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)', marginBottom: 12 }}>
                📚 Referencia legal - Tipos de maioria
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(Object.keys(TIPO_MAIORIA_CONFIG) as TipoMaioria[]).map(tipo => {
                  const cfg = TIPO_MAIORIA_CONFIG[tipo]
                  return (
                    <div key={tipo} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{cfg.emoji}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)' }}>
                          {cfg.label} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--sd-ink-3,#8A9BB0)' }}>({cfg.artigo})</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--sd-ink-2,#4A5E78)', marginTop: 2 }}>{cfg.descricao}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Criar nova votacao ──────────────────────────────────────── */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(13,27,46,0.5)', backdropFilter: 'blur(4px)',
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div style={{ ...sCard, width: '90%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ ...sHeading, fontSize: 20 }}>Criar nova votacao</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--sd-ink-3,#8A9BB0)' }}>x</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={sLabel}>Titulo da deliberacao *</div>
                <input
                  value={formTitulo}
                  onChange={e => setFormTitulo(e.target.value)}
                  placeholder="Ex: Aprovacao do orcamento anual 2026"
                  style={sInput}
                />
              </div>

              <div>
                <div style={sLabel}>Descricao</div>
                <textarea
                  value={formDescricao}
                  onChange={e => setFormDescricao(e.target.value)}
                  placeholder="Descreva a deliberacao em detalhe..."
                  style={sTextarea}
                />
              </div>

              <div>
                <div style={sLabel}>Tipo de maioria</div>
                <select value={formTipoMaioria} onChange={e => setFormTipoMaioria(e.target.value as TipoMaioria)} style={sSelect}>
                  {(Object.keys(TIPO_MAIORIA_CONFIG) as TipoMaioria[]).map(t => (
                    <option key={t} value={t}>
                      {TIPO_MAIORIA_CONFIG[t].label} ({TIPO_MAIORIA_CONFIG[t].artigo})
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 4 }}>
                  {TIPO_MAIORIA_CONFIG[formTipoMaioria].descricao}
                </div>
              </div>

              <div>
                <div style={sLabel}>Prazo limite *</div>
                <input
                  type="datetime-local"
                  value={formPrazo}
                  onChange={e => setFormPrazo(e.target.value)}
                  style={sInput}
                />
              </div>

              <div>
                <div style={sLabel}>Associar a edificio</div>
                <input
                  value={formEdificio}
                  onChange={e => setFormEdificio(e.target.value)}
                  placeholder="Nome do edificio"
                  style={sInput}
                />
              </div>

              <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--sd-cream,#F7F4EE)', fontSize: 13, color: 'var(--sd-ink-2,#4A5E78)' }}>
                <strong>Opcoes de voto:</strong> Favoravel / Contra / Abstencao (predefinido)
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={() => setShowModal(false)} style={sBtnSecondary}>Cancelar</button>
                <button
                  onClick={handleCriarVotacao}
                  disabled={!formTitulo.trim() || !formPrazo}
                  style={{
                    ...sBtnGold,
                    opacity: (!formTitulo.trim() || !formPrazo) ? 0.5 : 1,
                    cursor: (!formTitulo.trim() || !formPrazo) ? 'not-allowed' : 'pointer',
                  }}
                >
                  Criar votacao
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Detalhe votacao ─────────────────────────────────────────── */}
      {selectedVotacao && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(13,27,46,0.5)', backdropFilter: 'blur(4px)',
        }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedVotacao(null) }}
        >
          <div style={{ ...sCard, width: '95%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: ESTADO_CONFIG[selectedVotacao.estado].bg, color: ESTADO_CONFIG[selectedVotacao.estado].color }}>
                    {ESTADO_CONFIG[selectedVotacao.estado].label}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 5, background: 'rgba(201,168,76,0.12)', color: 'var(--sd-gold,#C9A84C)' }}>
                    {TIPO_MAIORIA_CONFIG[selectedVotacao.tipoMaioria].emoji} {TIPO_MAIORIA_CONFIG[selectedVotacao.tipoMaioria].label}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--sd-ink-3,#8A9BB0)' }}>
                    {TIPO_MAIORIA_CONFIG[selectedVotacao.tipoMaioria].artigo}
                  </span>
                </div>
                <h2 style={{ ...sHeading, fontSize: 22 }}>{selectedVotacao.titulo}</h2>
              </div>
              <button onClick={() => setSelectedVotacao(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--sd-ink-3,#8A9BB0)', flexShrink: 0 }}>x</button>
            </div>

            {/* Description */}
            <p style={{ fontSize: 14, color: 'var(--sd-ink-2,#4A5E78)', lineHeight: 1.6, marginBottom: 16 }}>
              {selectedVotacao.descricao}
            </p>

            {/* Meta */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Edificio', value: selectedVotacao.edificioNom, emoji: '🏢' },
                { label: 'Criada em', value: formatDate(selectedVotacao.criadaEm), emoji: '📅' },
                { label: 'Prazo', value: formatDate(selectedVotacao.prazoLimite), emoji: '⏰' },
                ...(selectedVotacao.encerradaEm ? [{ label: 'Encerrada em', value: formatDate(selectedVotacao.encerradaEm), emoji: '🔒' }] : []),
              ].map((m, i) => (
                <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--sd-cream,#F7F4EE)' }}>
                  <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)' }}>{m.emoji} {m.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)', marginTop: 2 }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Results panel */}
            {(() => {
              const res = calcularResultados(selectedVotacao)
              const progressPct = Math.round((res.votosRecebidos / res.totalFracoes) * 100)

              return (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)', marginBottom: 12 }}>Resultados</div>

                  {/* Progress */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--sd-ink-2,#4A5E78)' }}>
                      {res.votosRecebidos} / {res.totalFracoes} fracoes ({progressPct}%)
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)' }}>
                      Quorum: {res.quorumAtingido.toFixed(1)}% da permilagem
                    </span>
                  </div>
                  <div style={{ height: 10, borderRadius: 5, background: 'var(--sd-border,#E4DDD0)', overflow: 'hidden', marginBottom: 16 }}>
                    <div style={{ height: '100%', borderRadius: 5, width: `${progressPct}%`, background: 'var(--sd-gold,#C9A84C)', transition: 'width 0.4s' }} />
                  </div>

                  {/* Opcao bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(['favoravel', 'contra', 'abstencao'] as OpcaoVoto[]).map(opcao => {
                      const pct = res.totalPermilagem > 0 ? (res.porOpcao[opcao].permilagem / res.totalPermilagem) * 100 : 0
                      return (
                        <div key={opcao}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: OPCAO_CONFIG[opcao].color }}>
                              {OPCAO_CONFIG[opcao].emoji} {OPCAO_CONFIG[opcao].label}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--sd-ink-2,#4A5E78)' }}>
                              {res.porOpcao[opcao].count} votos | {res.porOpcao[opcao].permilagem}‰ ({pct.toFixed(1)}%)
                            </span>
                          </div>
                          <div style={{ height: 8, borderRadius: 4, background: 'var(--sd-border,#E4DDD0)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: OPCAO_CONFIG[opcao].color, transition: 'width 0.3s' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Deliberation result */}
                  {selectedVotacao.estado !== 'aberta' && (
                    <div style={{
                      marginTop: 16,
                      padding: '12px 16px',
                      borderRadius: 8,
                      background: res.aprovada ? '#E6F4F2' : '#FDECEA',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      <span style={{ fontSize: 18 }}>{res.aprovada ? '✅' : '❌'}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: res.aprovada ? '#1A7A6E' : '#C0392B' }}>
                        Deliberacao {res.aprovada ? 'APROVADA' : 'NAO APROVADA'}
                      </span>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Vote list */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)', marginBottom: 12 }}>Detalhe dos votos</div>

              {selectedVotacao.votos.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--sd-ink-3,#8A9BB0)', fontStyle: 'italic' }}>Nenhum voto registado ainda.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {selectedVotacao.votos.map((voto, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'var(--sd-cream,#F7F4EE)',
                      fontSize: 13,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)' }}>{voto.condominoNom}</span>
                        <span style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)' }}>({voto.permilagem}‰)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                          color: OPCAO_CONFIG[voto.opcao].color,
                          background: voto.opcao === 'favoravel' ? '#E6F4F2' : voto.opcao === 'contra' ? '#FDECEA' : '#EDE8DF',
                        }}>
                          {OPCAO_CONFIG[voto.opcao].emoji} {OPCAO_CONFIG[voto.opcao].label}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--sd-ink-3,#8A9BB0)' }}>
                          {voto.metodo} | {formatDateTime(voto.dataVoto)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Fracoes que nao votaram */}
              {(() => {
                const naoVotaram = selectedVotacao.fracoes.filter(f => !selectedVotacao.votos.find(v => v.fracaoId === f.id))
                if (naoVotaram.length === 0) return null
                return (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-3,#8A9BB0)', marginBottom: 6 }}>
                      Nao votaram ({naoVotaram.length}):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {naoVotaram.map(f => (
                        <span key={f.id} style={{
                          fontSize: 11, padding: '3px 8px', borderRadius: 4,
                          background: '#fff', border: '1px solid var(--sd-border,#E4DDD0)',
                          color: 'var(--sd-ink-3,#8A9BB0)',
                        }}>
                          {f.condominoNom} ({f.permilagem}‰)
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', borderTop: '1px solid var(--sd-border,#E4DDD0)', paddingTop: 16 }}>
              {selectedVotacao.estado === 'aberta' && (
                <>
                  <button onClick={() => { setShowVoteModal(true); setVoteFracaoId(''); setVoteOpcao('favoravel') }} style={sBtnGold}>
                    🗳️ Registar voto
                  </button>
                  <button onClick={() => handleEncerrar(selectedVotacao)} style={{ ...sBtnPrimary, background: '#C0392B' }}>
                    🔒 Encerrar votacao
                  </button>
                </>
              )}
              <button onClick={() => handleExportAta(selectedVotacao)} style={sBtnSecondary}>
                📄 Exportar ata parcial
              </button>
              <button onClick={() => setSelectedVotacao(null)} style={sBtnSecondary}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Registar voto ───────────────────────────────────────────── */}
      {showVoteModal && selectedVotacao && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(13,27,46,0.6)', backdropFilter: 'blur(4px)',
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowVoteModal(false) }}
        >
          <div style={{ ...sCard, width: '90%', maxWidth: 440, padding: 28 }}>
            <h3 style={{ ...sHeading, fontSize: 18, marginBottom: 16 }}>Registar voto</h3>

            <div style={{ marginBottom: 16 }}>
              <div style={sLabel}>Fracao</div>
              <select value={voteFracaoId} onChange={e => setVoteFracaoId(e.target.value)} style={sSelect}>
                <option value="">-- Selecionar fracao --</option>
                {selectedVotacao.fracoes
                  .filter(f => !selectedVotacao.votos.find(v => v.fracaoId === f.id))
                  .map(f => (
                    <option key={f.id} value={f.id}>
                      {f.designacao} - {f.condominoNom} ({f.permilagem}‰)
                    </option>
                  ))
                }
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={sLabel}>Sentido de voto</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['favoravel', 'contra', 'abstencao'] as OpcaoVoto[]).map(opcao => (
                  <button
                    key={opcao}
                    onClick={() => setVoteOpcao(opcao)}
                    style={{
                      flex: 1,
                      padding: '12px 8px',
                      borderRadius: 8,
                      border: voteOpcao === opcao ? `2px solid ${OPCAO_CONFIG[opcao].color}` : '1px solid var(--sd-border,#E4DDD0)',
                      background: voteOpcao === opcao ? (opcao === 'favoravel' ? '#E6F4F2' : opcao === 'contra' ? '#FDECEA' : '#EDE8DF') : '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      fontFamily: "'Outfit',sans-serif",
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{OPCAO_CONFIG[opcao].emoji}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: OPCAO_CONFIG[opcao].color }}>{OPCAO_CONFIG[opcao].label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowVoteModal(false)} style={sBtnSecondary}>Cancelar</button>
              <button
                onClick={handleVotar}
                disabled={!voteFracaoId}
                style={{
                  ...sBtnGold,
                  opacity: !voteFracaoId ? 0.5 : 1,
                  cursor: !voteFracaoId ? 'not-allowed' : 'pointer',
                }}
              >
                Confirmar voto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
