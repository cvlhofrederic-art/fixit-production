'use client'

import React, { useState, useEffect, useMemo } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type EstadoPedido = 'pendente' | 'em_analise' | 'aprovado' | 'recusado' | 'instalacao' | 'concluido'
type TipoUso = 'exclusivo' | 'partilhado'
type TipoPosto = 'wallbox' | 'tomada_reforçada' | 'posto_rapido'
type EstadoPosto = 'ativo' | 'em_manutencao' | 'desativado'

interface PedidoInstalacao {
  id: string
  condominoNom: string
  condominoEmail?: string
  fracao: string
  dataComunicacao: string         // Data de receção da comunicação
  prazoAnalise: string            // +60 dias
  prazoAlternativa: string        // +90 dias
  tipoUso: TipoUso
  potenciaDesejada: number        // kW
  localizacao: string             // garagem, lugar
  estado: EstadoPedido
  justificacaoRecusa?: string     // obrigatório se recusado (DL 101-D/2020)
  motivoRecusa?: 'seguranca' | 'capacidade_eletrica' | 'alternativa_existente'
  dataDecisao?: string
  dataInstalacao?: string
  observacoes?: string
  createdAt: string
}

interface PostoInstalado {
  id: string
  edificioNom: string
  localizacao: string             // Ex: "Garagem -1, Lugar 23"
  tipo: TipoPosto
  potenciaKw: number
  proprietario: string            // condómino ou "condomínio"
  tipoUso: TipoUso
  dataInstalacao: string
  estado: EstadoPosto
  operadorDPC?: string            // Operador de Ponto de Carregamento
  redeMoviE: boolean              // Ligação à rede MOBI.E
  consumoMensal: ConsumoMensal[]
}

interface ConsumoMensal {
  mes: string                     // "2026-01", "2026-02", etc.
  kwh: number
  custoEur: number
}

interface FAQItem {
  pergunta: string
  resposta: string
}

interface Props {
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> }
  userRole: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const ESTADO_PEDIDO_CONFIG: Record<EstadoPedido, { label: string; bg: string; color: string; dot: string }> = {
  pendente:    { label: 'Pendente',         bg: '#FEF5E4', color: '#D4830A', dot: '#D4830A' },
  em_analise:  { label: 'Em Análise',       bg: '#EDE8FF', color: '#6C5CE7', dot: '#6C5CE7' },
  aprovado:    { label: 'Aprovado',         bg: '#E6F4F2', color: '#1A7A6E', dot: '#1A7A6E' },
  recusado:    { label: 'Recusado',         bg: '#FDECEA', color: '#C0392B', dot: '#C0392B' },
  instalacao:  { label: 'Em Instalação',    bg: '#E8F0FE', color: '#1967D2', dot: '#1967D2' },
  concluido:   { label: 'Concluído',        bg: '#F7F4EE', color: '#0D1B2E', dot: '#0D1B2E' },
}

const TIPO_USO_LABELS: Record<TipoUso, string> = {
  exclusivo:  'Uso Exclusivo',
  partilhado: 'Uso Partilhado',
}

const TIPO_POSTO_CONFIG: Record<TipoPosto, { label: string; emoji: string }> = {
  wallbox:           { label: 'Wallbox',             emoji: '🔌' },
  tomada_reforçada:  { label: 'Tomada Reforçada',    emoji: '🔋' },
  posto_rapido:      { label: 'Posto Rápido (DC)',   emoji: '⚡' },
}

const ESTADO_POSTO_CONFIG: Record<EstadoPosto, { label: string; bg: string; color: string }> = {
  ativo:           { label: 'Ativo',           bg: '#E6F4F2', color: '#1A7A6E' },
  em_manutencao:   { label: 'Em Manutenção',   bg: '#FEF5E4', color: '#D4830A' },
  desativado:      { label: 'Desativado',      bg: '#FDECEA', color: '#C0392B' },
}

const MOTIVOS_RECUSA: Record<string, string> = {
  seguranca:            'Risco comprovado para a segurança do edifício',
  capacidade_eletrica:  'Insuficiência da capacidade elétrica do edifício',
  alternativa_existente: 'Existência de alternativa coletiva aprovada',
}

const TIMELINE_STEPS = [
  { key: 'comunicacao', label: 'Comunicação Recebida', desc: 'Receção do pedido do condómino' },
  { key: 'analise',     label: 'Prazo 60 Dias Análise', desc: 'Avaliação técnica e jurídica' },
  { key: 'decisao',     label: 'Decisão',              desc: 'Aprovação ou recusa fundamentada' },
  { key: 'instalacao',  label: 'Instalação',           desc: 'Execução da obra pelo condómino' },
]

const FAQ_DATA: FAQItem[] = [
  {
    pergunta: 'O condómino tem direito a instalar um posto de carregamento?',
    resposta: 'Sim. O DL 101-D/2020 consagra o direito individual de cada condómino a instalar infraestrutura de carregamento de veículos elétricos na sua fração ou no lugar de estacionamento, mesmo em partes comuns, mediante comunicação prévia ao administrador.',
  },
  {
    pergunta: 'Qual o prazo para comunicação prévia?',
    resposta: 'O condómino deve comunicar por escrito ao administrador do condomínio com antecedência mínima de 30 dias (Art.º 59.º-A). A comunicação deve incluir o projeto técnico e a identificação do instalador certificado.',
  },
  {
    pergunta: 'O condomínio pode recusar a instalação?',
    resposta: 'Apenas em 3 situações: (1) risco comprovado para a segurança do edifício, (2) insuficiência da capacidade elétrica, (3) existência de alternativa coletiva já aprovada. A recusa deve ser fundamentada por escrito no prazo de 60 dias.',
  },
  {
    pergunta: 'Quem suporta os custos da instalação?',
    resposta: 'Todos os custos de aquisição, instalação e manutenção são suportados pelo condómino requerente. O condomínio não tem qualquer encargo, exceto se decidir instalar infraestrutura coletiva.',
  },
  {
    pergunta: 'É necessária maioria de 2/3 para edifícios antigos?',
    resposta: 'Para edifícios construídos antes de 2010 sem pré-instalação elétrica para VE, pode ser necessária aprovação por maioria de 2/3 dos condóminos para obras de adaptação das partes comuns. Contudo, o direito individual à instalação no lugar próprio mantém-se.',
  },
  {
    pergunta: 'O que acontece se o prazo de 60 dias expirar sem resposta?',
    resposta: 'O silêncio do condomínio equivale a aprovação tácita. Após 60 dias sem resposta fundamentada, o condómino pode prosseguir com a instalação, devendo respeitar as normas técnicas aplicáveis.',
  },
  {
    pergunta: 'Qual a legislação principal aplicável?',
    resposta: 'DL 101-D/2020 (transposição da Diretiva Europeia 2018/844), que alterou o DL 118/2013. Regula o direito à mobilidade elétrica em edifícios e os procedimentos de comunicação e oposição.',
  },
  {
    pergunta: 'O posto precisa de estar ligado à rede MOBI.E?',
    resposta: 'Se o condómino pretender aceder aos incentivos do Fundo Ambiental, o posto deve estar ligado à rede MOBI.E e ser instalado por um operador de ponto de carregamento (OPC/DPC) certificado. Para uso exclusivo privado, não é obrigatória a ligação à rede.',
  },
]

// ─── Demo Data ────────────────────────────────────────────────────────────────

const DEMO_PEDIDOS: PedidoInstalacao[] = [
  {
    id: 'ped-001',
    condominoNom: 'Carlos Ferreira',
    condominoEmail: 'carlos.ferreira@email.pt',
    fracao: 'Fração B - 1.º Esq.',
    dataComunicacao: '2026-02-15',
    prazoAnalise: '2026-04-16',
    prazoAlternativa: '2026-05-16',
    tipoUso: 'exclusivo',
    potenciaDesejada: 7.4,
    localizacao: 'Garagem -1, Lugar 12',
    estado: 'em_analise',
    observacoes: 'Projeto técnico entregue. Instalador: ElectroVerde Lda.',
    createdAt: '2026-02-15T10:00:00Z',
  },
  {
    id: 'ped-002',
    condominoNom: 'Ana Rodrigues',
    condominoEmail: 'ana.rodrigues@email.pt',
    fracao: 'Fração D - 3.º Dto.',
    dataComunicacao: '2026-01-10',
    prazoAnalise: '2026-03-11',
    prazoAlternativa: '2026-04-10',
    tipoUso: 'exclusivo',
    potenciaDesejada: 11,
    localizacao: 'Garagem -1, Lugar 28',
    estado: 'aprovado',
    dataDecisao: '2026-02-20',
    observacoes: 'Aprovado em reunião de administração. Capacidade elétrica verificada.',
    createdAt: '2026-01-10T09:00:00Z',
  },
  {
    id: 'ped-003',
    condominoNom: 'Miguel Santos',
    fracao: 'Fração A - R/C',
    dataComunicacao: '2026-03-01',
    prazoAnalise: '2026-04-30',
    prazoAlternativa: '2026-05-30',
    tipoUso: 'partilhado',
    potenciaDesejada: 22,
    localizacao: 'Garagem -2, Lugar 5',
    estado: 'pendente',
    observacoes: 'Pedido de posto partilhado de alta potência. Aguarda avaliação da capacidade elétrica.',
    createdAt: '2026-03-01T14:00:00Z',
  },
]

const DEMO_POSTOS: PostoInstalado[] = [
  {
    id: 'post-001',
    edificioNom: 'Edifício Solar do Porto',
    localizacao: 'Garagem -1, Lugar 7',
    tipo: 'wallbox',
    potenciaKw: 7.4,
    proprietario: 'João Mendes (Fração C)',
    tipoUso: 'exclusivo',
    dataInstalacao: '2025-09-15',
    estado: 'ativo',
    operadorDPC: 'EDP Comercial',
    redeMoviE: true,
    consumoMensal: [
      { mes: '2026-01', kwh: 180, custoEur: 36.00 },
      { mes: '2026-02', kwh: 210, custoEur: 42.00 },
      { mes: '2026-03', kwh: 165, custoEur: 33.00 },
    ],
  },
  {
    id: 'post-002',
    edificioNom: 'Edifício Solar do Porto',
    localizacao: 'Garagem -1, Lugar 15',
    tipo: 'wallbox',
    potenciaKw: 11,
    proprietario: 'Maria Costa (Fração E)',
    tipoUso: 'exclusivo',
    dataInstalacao: '2025-11-20',
    estado: 'ativo',
    operadorDPC: 'Galp Electric',
    redeMoviE: true,
    consumoMensal: [
      { mes: '2026-01', kwh: 250, custoEur: 50.00 },
      { mes: '2026-02', kwh: 280, custoEur: 56.00 },
      { mes: '2026-03', kwh: 220, custoEur: 44.00 },
    ],
  },
  {
    id: 'post-003',
    edificioNom: 'Edifício Solar do Porto',
    localizacao: 'Garagem -2, Zona Comum',
    tipo: 'posto_rapido',
    potenciaKw: 22,
    proprietario: 'Condomínio',
    tipoUso: 'partilhado',
    dataInstalacao: '2025-06-10',
    estado: 'em_manutencao',
    operadorDPC: 'MOBI.E / Endesa',
    redeMoviE: true,
    consumoMensal: [
      { mes: '2026-01', kwh: 520, custoEur: 104.00 },
      { mes: '2026-02', kwh: 490, custoEur: 98.00 },
      { mes: '2026-03', kwh: 0,   custoEur: 0 },
    ],
  },
]

// ─── Componente ───────────────────────────────────────────────────────────────

export default function CarregamentoVESection({ user }: Props) {
  // ── Tabs
  type TabKey = 'pedidos' | 'postos' | 'legislacao' | 'incentivos'
  const [activeTab, setActiveTab] = useState<TabKey>('pedidos')

  // ── Data
  const [pedidos, setPedidos] = useState<PedidoInstalacao[]>([])
  const [postos, setPostos] = useState<PostoInstalado[]>([])

  // ── Modals / forms
  const [showNovoPedido, setShowNovoPedido] = useState(false)
  const [showNovoPostoForm, setShowNovoPostoForm] = useState(false)
  const [selectedPedido, setSelectedPedido] = useState<PedidoInstalacao | null>(null)
  const [selectedPosto, setSelectedPosto] = useState<PostoInstalado | null>(null)
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null)

  // ── Pedido form
  const [fpNom, setFpNom] = useState('')
  const [fpEmail, setFpEmail] = useState('')
  const [fpFracao, setFpFracao] = useState('')
  const [fpData, setFpData] = useState('')
  const [fpTipoUso, setFpTipoUso] = useState<TipoUso>('exclusivo')
  const [fpPotencia, setFpPotencia] = useState('')
  const [fpLocal, setFpLocal] = useState('')
  const [fpObs, setFpObs] = useState('')

  // ── Posto form
  const [ppEdificio, setPpEdificio] = useState('')
  const [ppLocal, setPpLocal] = useState('')
  const [ppTipo, setPpTipo] = useState<TipoPosto>('wallbox')
  const [ppPotencia, setPpPotencia] = useState('')
  const [ppProprietario, setPpProprietario] = useState('')
  const [ppTipoUso, setPpTipoUso] = useState<TipoUso>('exclusivo')
  const [ppData, setPpData] = useState('')
  const [ppOperador, setPpOperador] = useState('')
  const [ppMoviE, setPpMoviE] = useState(false)

  // ── Recusa form
  const [recusaMotivo, setRecusaMotivo] = useState<string>('')
  const [recusaJustificacao, setRecusaJustificacao] = useState('')

  // ── Consumo form (add consumption)
  const [consumoMes, setConsumoMes] = useState('')
  const [consumoKwh, setConsumoKwh] = useState('')
  const [consumoCusto, setConsumosCusto] = useState('')

  // ── Checklist incentivos
  const [checklistItems, setChecklistItems] = useState<Record<string, boolean>>({
    mobie: false,
    operador_dpc: false,
    projeto_tecnico: false,
    instalador_certificado: false,
    fatura_aquisicao: false,
    fatura_instalacao: false,
    certificado_conformidade: false,
  })

  // ── Storage
  const STORAGE_KEY = `fixit_carregamento_ve_${user.id}`

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (data.pedidos) setPedidos(data.pedidos)
        if (data.postos) setPostos(data.postos)
      } else {
        // Load demo data
        setPedidos(DEMO_PEDIDOS)
        setPostos(DEMO_POSTOS)
      }
    } catch {
      setPedidos(DEMO_PEDIDOS)
      setPostos(DEMO_POSTOS)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pedidos, postos }))
  }, [pedidos, postos])

  // ── Helpers
  const fmt = (n: number) => n.toLocaleString('pt-PT', { minimumFractionDigits: 2 })
  const fmtDate = (s: string) => {
    try { return new Date(s).toLocaleDateString('pt-PT') } catch { return s }
  }

  const addDays = (dateStr: string, days: number): string => {
    const d = new Date(dateStr)
    d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
  }

  const diasRestantes = (dateStr: string): number => {
    const diff = new Date(dateStr).getTime() - Date.now()
    return Math.ceil(diff / 86400000)
  }

  const getTimelineStep = (p: PedidoInstalacao): number => {
    switch (p.estado) {
      case 'pendente': return 0
      case 'em_analise': return 1
      case 'aprovado': case 'recusado': return 2
      case 'instalacao': return 3
      case 'concluido': return 4
      default: return 0
    }
  }

  // ── Stats
  const stats = useMemo(() => {
    const totalPedidos = pedidos.length
    const pendentes = pedidos.filter(p => p.estado === 'pendente' || p.estado === 'em_analise').length
    const aprovados = pedidos.filter(p => p.estado === 'aprovado' || p.estado === 'instalacao' || p.estado === 'concluido').length
    const recusados = pedidos.filter(p => p.estado === 'recusado').length
    const postosAtivos = postos.filter(p => p.estado === 'ativo').length
    const potenciaTotal = postos.filter(p => p.estado === 'ativo').reduce((s, p) => s + p.potenciaKw, 0)
    const consumoTotal = postos.reduce((s, p) => s + p.consumoMensal.reduce((a, c) => a + c.kwh, 0), 0)
    const custoTotal = postos.reduce((s, p) => s + p.consumoMensal.reduce((a, c) => a + c.custoEur, 0), 0)
    return { totalPedidos, pendentes, aprovados, recusados, postosAtivos, potenciaTotal, consumoTotal, custoTotal }
  }, [pedidos, postos])

  // ── Create pedido
  const criarPedido = () => {
    if (!fpNom.trim() || !fpFracao.trim()) return
    const dataCom = fpData || new Date().toISOString().split('T')[0]
    const novo: PedidoInstalacao = {
      id: crypto.randomUUID(),
      condominoNom: fpNom.trim(),
      condominoEmail: fpEmail.trim() || undefined,
      fracao: fpFracao.trim(),
      dataComunicacao: dataCom,
      prazoAnalise: addDays(dataCom, 60),
      prazoAlternativa: addDays(dataCom, 90),
      tipoUso: fpTipoUso,
      potenciaDesejada: parseFloat(fpPotencia) || 0,
      localizacao: fpLocal.trim(),
      estado: 'pendente',
      observacoes: fpObs.trim() || undefined,
      createdAt: new Date().toISOString(),
    }
    setPedidos(prev => [novo, ...prev])
    resetPedidoForm()
    setShowNovoPedido(false)
  }

  const resetPedidoForm = () => {
    setFpNom(''); setFpEmail(''); setFpFracao(''); setFpData('')
    setFpTipoUso('exclusivo'); setFpPotencia(''); setFpLocal(''); setFpObs('')
  }

  // ── Update pedido estado
  const atualizarPedidoEstado = (id: string, novoEstado: EstadoPedido, extra?: Partial<PedidoInstalacao>) => {
    setPedidos(prev => prev.map(p =>
      p.id === id
        ? { ...p, estado: novoEstado, dataDecisao: novoEstado === 'aprovado' || novoEstado === 'recusado' ? new Date().toISOString().split('T')[0] : p.dataDecisao, ...extra }
        : p
    ))
  }

  // ── Delete pedido
  const eliminarPedido = (id: string) => {
    setPedidos(prev => prev.filter(p => p.id !== id))
    if (selectedPedido?.id === id) setSelectedPedido(null)
  }

  // ── Create posto
  const criarPosto = () => {
    if (!ppEdificio.trim() || !ppLocal.trim()) return
    const novo: PostoInstalado = {
      id: crypto.randomUUID(),
      edificioNom: ppEdificio.trim(),
      localizacao: ppLocal.trim(),
      tipo: ppTipo,
      potenciaKw: parseFloat(ppPotencia) || 0,
      proprietario: ppProprietario.trim() || 'Condomínio',
      tipoUso: ppTipoUso,
      dataInstalacao: ppData || new Date().toISOString().split('T')[0],
      estado: 'ativo',
      operadorDPC: ppOperador.trim() || undefined,
      redeMoviE: ppMoviE,
      consumoMensal: [],
    }
    setPostos(prev => [novo, ...prev])
    resetPostoForm()
    setShowNovoPostoForm(false)
  }

  const resetPostoForm = () => {
    setPpEdificio(''); setPpLocal(''); setPpTipo('wallbox'); setPpPotencia('')
    setPpProprietario(''); setPpTipoUso('exclusivo'); setPpData(''); setPpOperador(''); setPpMoviE(false)
  }

  // ── Update posto estado
  const atualizarPostoEstado = (id: string, novoEstado: EstadoPosto) => {
    setPostos(prev => prev.map(p => p.id === id ? { ...p, estado: novoEstado } : p))
  }

  // ── Add consumo to posto
  const adicionarConsumo = (postoId: string) => {
    if (!consumoMes || !consumoKwh) return
    setPostos(prev => prev.map(p => {
      if (p.id !== postoId) return p
      const novoConsumo: ConsumoMensal = {
        mes: consumoMes,
        kwh: parseFloat(consumoKwh) || 0,
        custoEur: parseFloat(consumoCusto) || 0,
      }
      return { ...p, consumoMensal: [...p.consumoMensal, novoConsumo].sort((a, b) => a.mes.localeCompare(b.mes)) }
    }))
    setConsumoMes(''); setConsumoKwh(''); setConsumosCusto('')
  }

  // ── Delete posto
  const eliminarPosto = (id: string) => {
    setPostos(prev => prev.filter(p => p.id !== id))
    if (selectedPosto?.id === id) setSelectedPosto(null)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const TABS: { key: TabKey; label: string; emoji: string }[] = [
    { key: 'pedidos',    label: 'Pedidos',           emoji: '📋' },
    { key: 'postos',     label: 'Postos Instalados', emoji: '🔌' },
    { key: 'legislacao', label: 'Legislação',        emoji: '⚖️' },
    { key: 'incentivos', label: 'Incentivos',        emoji: '💰' },
  ]

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
            ⚡ Carregamento de Veículos Elétricos
          </h2>
          <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>
            Gestão de infraestrutura VE em condomínios · DL 101-D/2020 · Art.º 59.º-A
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { emoji: '📋', label: 'Pedidos Ativos', value: stats.pendentes, color: '#D4830A' },
          { emoji: '✅', label: 'Aprovados', value: stats.aprovados, color: '#1A7A6E' },
          { emoji: '🔌', label: 'Postos Ativos', value: stats.postosAtivos, color: 'var(--sd-navy, #0D1B2E)' },
          { emoji: '⚡', label: 'Potência Total', value: `${fmt(stats.potenciaTotal)} kW`, color: '#6C5CE7' },
          { emoji: '📊', label: 'Consumo Total', value: `${stats.consumoTotal.toLocaleString('pt-PT')} kWh`, color: '#1967D2' },
          { emoji: '💶', label: 'Custo Total', value: `${fmt(stats.custoTotal)} €`, color: '#C0392B' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 18, marginBottom: 6 }}>{s.emoji}</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '2px solid var(--sd-border, #E4DDD0)', paddingBottom: 12, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
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
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1 — PEDIDOS                                                        */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'pedidos' && (
        <div>
          {/* Action bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button
              onClick={() => setShowNovoPedido(true)}
              style={{ background: 'var(--sd-navy, #0D1B2E)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              + Registar Novo Pedido
            </button>
          </div>

          {/* Pedidos list */}
          {pedidos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--sd-ink-3, #8A9BB0)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
              <p style={{ fontSize: 16, fontWeight: 600 }}>Nenhum pedido de instalação</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Os condóminos podem solicitar a instalação de postos de carregamento VE (DL 101-D/2020)</p>
              <button onClick={() => setShowNovoPedido(true)} style={{ marginTop: 16, background: 'var(--sd-navy, #0D1B2E)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                + Registar Pedido
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pedidos.map(p => {
                const cfg = ESTADO_PEDIDO_CONFIG[p.estado]
                const diasAnalise = diasRestantes(p.prazoAnalise)
                const step = getTimelineStep(p)

                return (
                  <div key={p.id} style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'border-color 0.2s' }} onClick={() => setSelectedPedido(p)}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--sd-navy, #0D1B2E)' }}>{p.condominoNom}</span>
                          <span style={{ fontSize: 11, background: cfg.bg, color: cfg.color, padding: '2px 8px', borderRadius: 5, fontWeight: 600 }}>
                            {cfg.label}
                          </span>
                          <span style={{ fontSize: 11, background: 'var(--sd-cream, #F7F4EE)', color: 'var(--sd-ink-2, #4A5E78)', padding: '2px 8px', borderRadius: 5, fontWeight: 600 }}>
                            {TIPO_USO_LABELS[p.tipoUso]}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', marginTop: 6 }}>
                          {p.fracao} · {p.localizacao} · {p.potenciaDesejada} kW
                        </div>

                        {/* Mini timeline */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10 }}>
                          {TIMELINE_STEPS.map((ts, i) => (
                            <React.Fragment key={ts.key}>
                              <div style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: i <= step ? (p.estado === 'recusado' && i === 2 ? '#C0392B' : '#1A7A6E') : '#E4DDD0',
                              }} />
                              {i < TIMELINE_STEPS.length - 1 && (
                                <div style={{ flex: 1, height: 2, background: i < step ? '#1A7A6E' : '#E4DDD0', maxWidth: 40 }} />
                              )}
                            </React.Fragment>
                          ))}
                        </div>

                        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', flexWrap: 'wrap' }}>
                          <span>Comunicação: <strong>{fmtDate(p.dataComunicacao)}</strong></span>
                          {(p.estado === 'pendente' || p.estado === 'em_analise') && (
                            <span>Prazo decisão: <strong style={{ color: diasAnalise <= 10 ? '#C0392B' : diasAnalise <= 30 ? '#D4830A' : '#1A7A6E' }}>
                              {fmtDate(p.prazoAnalise)} ({diasAnalise > 0 ? `${diasAnalise} dias` : 'Expirado!'})
                            </strong></span>
                          )}
                          {p.dataDecisao && <span>Decisão: <strong>{fmtDate(p.dataDecisao)}</strong></span>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {p.estado === 'pendente' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); atualizarPedidoEstado(p.id, 'em_analise') }}
                            style={{ fontSize: 11, background: '#EDE8FF', color: '#6C5CE7', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontWeight: 600 }}
                          >
                            Analisar
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); eliminarPedido(p.id) }}
                          style={{ background: 'none', border: 'none', fontSize: 14, color: 'var(--sd-ink-3, #8A9BB0)', cursor: 'pointer' }}
                          aria-label="Eliminar pedido"
                        >🗑️</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Modal: Detalhes do Pedido ── */}
          {selectedPedido && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => { setSelectedPedido(null); setRecusaMotivo(''); setRecusaJustificacao('') }}>
              <div style={{ background: '#fff', borderRadius: 16, maxWidth: 650, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: 32 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, margin: 0 }}>
                    ⚡ Pedido de {selectedPedido.condominoNom}
                  </h3>
                  <button onClick={() => { setSelectedPedido(null); setRecusaMotivo(''); setRecusaJustificacao('') }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--sd-ink-3, #8A9BB0)' }}>✕</button>
                </div>

                {/* Info grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
                  <div><span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>Condómino:</span><br /><strong>{selectedPedido.condominoNom}</strong></div>
                  <div><span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>Fração:</span><br /><strong>{selectedPedido.fracao}</strong></div>
                  <div><span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>Localização:</span><br /><strong>{selectedPedido.localizacao}</strong></div>
                  <div><span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>Tipo de Uso:</span><br /><strong>{TIPO_USO_LABELS[selectedPedido.tipoUso]}</strong></div>
                  <div><span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>Potência:</span><br /><strong>{selectedPedido.potenciaDesejada} kW</strong></div>
                  <div>
                    <span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>Estado:</span><br />
                    <span style={{ background: ESTADO_PEDIDO_CONFIG[selectedPedido.estado].bg, color: ESTADO_PEDIDO_CONFIG[selectedPedido.estado].color, padding: '2px 8px', borderRadius: 5, fontWeight: 600, fontSize: 11 }}>
                      {ESTADO_PEDIDO_CONFIG[selectedPedido.estado].label}
                    </span>
                  </div>
                </div>

                {/* Timeline visual */}
                <div style={{ marginTop: 24, background: 'var(--sd-cream, #F7F4EE)', borderRadius: 12, padding: 20 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 16px' }}>Cronograma Legal</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { label: 'Comunicação recebida', date: selectedPedido.dataComunicacao, done: true },
                      { label: 'Prazo 30 dias (aviso prévio)', date: addDays(selectedPedido.dataComunicacao, 30), done: getTimelineStep(selectedPedido) >= 1 },
                      { label: 'Prazo 60 dias (decisão)', date: selectedPedido.prazoAnalise, done: getTimelineStep(selectedPedido) >= 2 },
                      { label: 'Prazo 90 dias (alternativa)', date: selectedPedido.prazoAlternativa, done: getTimelineStep(selectedPedido) >= 3 },
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                          background: item.done ? '#1A7A6E' : '#E4DDD0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, color: '#fff', fontWeight: 700,
                        }}>
                          {item.done ? '✓' : (i + 1)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{item.label}</div>
                          <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>{fmtDate(item.date)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Justificação de recusa */}
                {selectedPedido.estado === 'recusado' && selectedPedido.justificacaoRecusa && (
                  <div style={{ marginTop: 16, background: '#FDECEA', borderRadius: 10, padding: 16, fontSize: 13 }}>
                    <strong style={{ color: '#C0392B' }}>Motivo da recusa:</strong>
                    <p style={{ margin: '6px 0 0', color: '#4A5E78' }}>{selectedPedido.justificacaoRecusa}</p>
                    {selectedPedido.motivoRecusa && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>
                        Fundamento: {MOTIVOS_RECUSA[selectedPedido.motivoRecusa] || selectedPedido.motivoRecusa}
                      </p>
                    )}
                  </div>
                )}

                {selectedPedido.observacoes && (
                  <div style={{ marginTop: 16, fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8, padding: 12 }}>
                    {selectedPedido.observacoes}
                  </div>
                )}

                {/* Actions */}
                {(selectedPedido.estado === 'pendente' || selectedPedido.estado === 'em_analise') && (
                  <div style={{ marginTop: 24 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {selectedPedido.estado === 'pendente' && (
                        <button
                          onClick={() => { atualizarPedidoEstado(selectedPedido.id, 'em_analise'); setSelectedPedido({ ...selectedPedido, estado: 'em_analise' }) }}
                          style={{ background: '#EDE8FF', color: '#6C5CE7', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Iniciar Análise
                        </button>
                      )}
                      <button
                        onClick={() => { atualizarPedidoEstado(selectedPedido.id, 'aprovado'); setSelectedPedido({ ...selectedPedido, estado: 'aprovado', dataDecisao: new Date().toISOString().split('T')[0] }) }}
                        style={{ background: '#E6F4F2', color: '#1A7A6E', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                      >
                        ✓ Aprovar
                      </button>
                    </div>

                    {/* Recusa form */}
                    <div style={{ marginTop: 16, background: '#FFF8F7', border: '1px solid #FDECEA', borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#C0392B', marginBottom: 8 }}>Recusar Pedido (requer justificação obrigatória)</div>
                      <select
                        value={recusaMotivo}
                        onChange={e => setRecusaMotivo(e.target.value)}
                        style={{ ...inputStyle, marginBottom: 8 }}
                      >
                        <option value="">Selecionar motivo legal...</option>
                        {Object.entries(MOTIVOS_RECUSA).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <textarea
                        value={recusaJustificacao}
                        onChange={e => setRecusaJustificacao(e.target.value)}
                        style={{ ...inputStyle, minHeight: 60 }}
                        placeholder="Justificação detalhada da recusa (obrigatório, DL 101-D/2020)..."
                      />
                      <button
                        onClick={() => {
                          if (!recusaMotivo || !recusaJustificacao.trim()) return
                          atualizarPedidoEstado(selectedPedido.id, 'recusado', {
                            motivoRecusa: recusaMotivo as PedidoInstalacao['motivoRecusa'],
                            justificacaoRecusa: recusaJustificacao.trim(),
                          })
                          setSelectedPedido({
                            ...selectedPedido,
                            estado: 'recusado',
                            motivoRecusa: recusaMotivo as PedidoInstalacao['motivoRecusa'],
                            justificacaoRecusa: recusaJustificacao.trim(),
                            dataDecisao: new Date().toISOString().split('T')[0],
                          })
                          setRecusaMotivo(''); setRecusaJustificacao('')
                        }}
                        disabled={!recusaMotivo || !recusaJustificacao.trim()}
                        style={{
                          marginTop: 8, background: !recusaMotivo || !recusaJustificacao.trim() ? '#E4DDD0' : '#C0392B',
                          color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600,
                          cursor: !recusaMotivo || !recusaJustificacao.trim() ? 'not-allowed' : 'pointer',
                        }}
                      >
                        ✕ Recusar com Justificação
                      </button>
                    </div>
                  </div>
                )}

                {selectedPedido.estado === 'aprovado' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
                    <button
                      onClick={() => { atualizarPedidoEstado(selectedPedido.id, 'instalacao'); setSelectedPedido({ ...selectedPedido, estado: 'instalacao' }) }}
                      style={{ background: '#E8F0FE', color: '#1967D2', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Marcar Instalação Iniciada
                    </button>
                  </div>
                )}

                {selectedPedido.estado === 'instalacao' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
                    <button
                      onClick={() => { atualizarPedidoEstado(selectedPedido.id, 'concluido', { dataInstalacao: new Date().toISOString().split('T')[0] }); setSelectedPedido({ ...selectedPedido, estado: 'concluido' }) }}
                      style={{ background: 'var(--sd-navy, #0D1B2E)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      ✓ Instalação Concluída
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Modal: Novo Pedido ── */}
          {showNovoPedido && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => { resetPedidoForm(); setShowNovoPedido(false) }}>
              <div style={{ background: '#fff', borderRadius: 16, maxWidth: 600, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: 32 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, margin: 0 }}>📋 Registar Novo Pedido</h3>
                  <button onClick={() => { resetPedidoForm(); setShowNovoPedido(false) }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--sd-ink-3, #8A9BB0)' }}>✕</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Nome do Condómino *</label>
                    <input value={fpNom} onChange={e => setFpNom(e.target.value)} style={inputStyle} placeholder="Ex: João Silva" />
                  </div>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <input value={fpEmail} onChange={e => setFpEmail(e.target.value)} style={inputStyle} placeholder="email@..." />
                  </div>
                  <div>
                    <label style={labelStyle}>Fração *</label>
                    <input value={fpFracao} onChange={e => setFpFracao(e.target.value)} style={inputStyle} placeholder="Ex: Fração B - 1.º Esq." />
                  </div>
                  <div>
                    <label style={labelStyle}>Data da Comunicação</label>
                    <input type="date" value={fpData} onChange={e => setFpData(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Tipo de Uso</label>
                    <select value={fpTipoUso} onChange={e => setFpTipoUso(e.target.value as TipoUso)} style={inputStyle}>
                      <option value="exclusivo">Uso Exclusivo</option>
                      <option value="partilhado">Uso Partilhado</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Potência Desejada (kW)</label>
                    <input type="number" value={fpPotencia} onChange={e => setFpPotencia(e.target.value)} style={inputStyle} placeholder="Ex: 7.4, 11, 22" />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={labelStyle}>Localização</label>
                    <input value={fpLocal} onChange={e => setFpLocal(e.target.value)} style={inputStyle} placeholder="Ex: Garagem -1, Lugar 12" />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={labelStyle}>Observações</label>
                    <textarea value={fpObs} onChange={e => setFpObs(e.target.value)} style={{ ...inputStyle, minHeight: 60 }} placeholder="Projeto técnico, instalador, notas..." />
                  </div>
                </div>

                {/* Auto-calculated dates preview */}
                {fpData && (
                  <div style={{ marginTop: 16, background: 'var(--sd-cream, #F7F4EE)', borderRadius: 10, padding: 16, fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 8 }}>Prazos Automáticos (DL 101-D/2020)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--sd-ink-2, #4A5E78)' }}>
                      <span>Aviso prévio 30 dias: <strong>{fmtDate(addDays(fpData, 30))}</strong></span>
                      <span>Prazo decisão 60 dias: <strong>{fmtDate(addDays(fpData, 60))}</strong></span>
                      <span>Alternativa 90 dias: <strong>{fmtDate(addDays(fpData, 90))}</strong></span>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
                  <button onClick={criarPedido} style={{ background: 'var(--sd-navy, #0D1B2E)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    ✓ Registar Pedido
                  </button>
                  <button onClick={() => { resetPedidoForm(); setShowNovoPedido(false) }} style={{ background: 'var(--sd-cream, #F7F4EE)', color: 'var(--sd-ink-2, #4A5E78)', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>

                <div style={{ marginTop: 16, background: '#FEF5E4', borderRadius: 10, padding: 12, fontSize: 12, color: '#D4830A' }}>
                  <strong>Nota Legal:</strong> O condómino tem direito individual à instalação (DL 101-D/2020). A oposição só é possível em 3 situações previstas na lei e deve ser fundamentada por escrito no prazo de 60 dias.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2 — POSTOS INSTALADOS                                              */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'postos' && (
        <div>
          {/* Action bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button
              onClick={() => setShowNovoPostoForm(true)}
              style={{ background: 'var(--sd-navy, #0D1B2E)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              + Registar Novo Posto
            </button>
          </div>

          {postos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--sd-ink-3, #8A9BB0)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔌</div>
              <p style={{ fontSize: 16, fontWeight: 600 }}>Nenhum posto de carregamento instalado</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Registe os postos de carregamento VE existentes nos edifícios</p>
              <button onClick={() => setShowNovoPostoForm(true)} style={{ marginTop: 16, background: 'var(--sd-navy, #0D1B2E)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                + Registar Posto
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
              {postos.map(p => {
                const tipoCfg = TIPO_POSTO_CONFIG[p.tipo]
                const estadoCfg = ESTADO_POSTO_CONFIG[p.estado]
                const ultimoConsumo = p.consumoMensal.length > 0 ? p.consumoMensal[p.consumoMensal.length - 1] : null
                const totalKwh = p.consumoMensal.reduce((s, c) => s + c.kwh, 0)
                const totalEur = p.consumoMensal.reduce((s, c) => s + c.custoEur, 0)

                return (
                  <div key={p.id} style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 16, padding: 24, cursor: 'pointer' }} onClick={() => setSelectedPosto(p)}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--sd-cream, #F7F4EE)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                          {tipoCfg.emoji}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--sd-navy, #0D1B2E)' }}>{tipoCfg.label}</div>
                          <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>{p.potenciaKw} kW · {TIPO_USO_LABELS[p.tipoUso]}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, background: estadoCfg.bg, color: estadoCfg.color, padding: '3px 8px', borderRadius: 5, fontWeight: 600 }}>
                        {estadoCfg.label}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', marginBottom: 8 }}>
                      <div>{p.localizacao} · {p.edificioNom}</div>
                      <div style={{ marginTop: 2 }}>Proprietário: <strong>{p.proprietario}</strong></div>
                      <div style={{ marginTop: 2 }}>Instalado: {fmtDate(p.dataInstalacao)}</div>
                      {p.redeMoviE && (
                        <span style={{ fontSize: 10, background: '#E6F4F2', color: '#1A7A6E', padding: '2px 6px', borderRadius: 4, fontWeight: 600, marginTop: 4, display: 'inline-block' }}>
                          MOBI.E
                        </span>
                      )}
                    </div>

                    {/* Consumo summary */}
                    <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 10, padding: 12, marginTop: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                        <div>
                          <div style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>Último mês</div>
                          <div style={{ fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)' }}>
                            {ultimoConsumo ? `${ultimoConsumo.kwh} kWh` : '—'}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>Custo último mês</div>
                          <div style={{ fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)' }}>
                            {ultimoConsumo ? `${fmt(ultimoConsumo.custoEur)} €` : '—'}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>Total acumulado</div>
                          <div style={{ fontWeight: 700, color: '#1967D2' }}>{totalKwh.toLocaleString('pt-PT')} kWh</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>Custo total</div>
                          <div style={{ fontWeight: 700, color: '#C0392B' }}>{fmt(totalEur)} €</div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                      {p.estado === 'ativo' && (
                        <button onClick={(e) => { e.stopPropagation(); atualizarPostoEstado(p.id, 'em_manutencao') }} style={{ flex: 1, fontSize: 11, background: '#FEF5E4', color: '#D4830A', border: 'none', borderRadius: 6, padding: '6px 0', cursor: 'pointer', fontWeight: 600 }}>
                          Manutenção
                        </button>
                      )}
                      {p.estado === 'em_manutencao' && (
                        <button onClick={(e) => { e.stopPropagation(); atualizarPostoEstado(p.id, 'ativo') }} style={{ flex: 1, fontSize: 11, background: '#E6F4F2', color: '#1A7A6E', border: 'none', borderRadius: 6, padding: '6px 0', cursor: 'pointer', fontWeight: 600 }}>
                          Reativar
                        </button>
                      )}
                      {p.estado !== 'desativado' && (
                        <button onClick={(e) => { e.stopPropagation(); atualizarPostoEstado(p.id, 'desativado') }} style={{ fontSize: 11, background: '#FDECEA', color: '#C0392B', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontWeight: 600 }}>
                          Desativar
                        </button>
                      )}
                      {p.estado === 'desativado' && (
                        <button onClick={(e) => { e.stopPropagation(); atualizarPostoEstado(p.id, 'ativo') }} style={{ flex: 1, fontSize: 11, background: '#E6F4F2', color: '#1A7A6E', border: 'none', borderRadius: 6, padding: '6px 0', cursor: 'pointer', fontWeight: 600 }}>
                          Reativar
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); eliminarPosto(p.id) }} style={{ fontSize: 12, background: 'none', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: 'var(--sd-ink-3, #8A9BB0)' }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Modal: Detalhes do Posto ── */}
          {selectedPosto && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setSelectedPosto(null)}>
              <div style={{ background: '#fff', borderRadius: 16, maxWidth: 650, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: 32 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, margin: 0 }}>
                    {TIPO_POSTO_CONFIG[selectedPosto.tipo].emoji} {TIPO_POSTO_CONFIG[selectedPosto.tipo].label} — {selectedPosto.potenciaKw} kW
                  </h3>
                  <button onClick={() => setSelectedPosto(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--sd-ink-3, #8A9BB0)' }}>✕</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
                  <div><span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>Edifício:</span><br /><strong>{selectedPosto.edificioNom}</strong></div>
                  <div><span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>Localização:</span><br /><strong>{selectedPosto.localizacao}</strong></div>
                  <div><span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>Proprietário:</span><br /><strong>{selectedPosto.proprietario}</strong></div>
                  <div><span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>Tipo de Uso:</span><br /><strong>{TIPO_USO_LABELS[selectedPosto.tipoUso]}</strong></div>
                  <div><span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>Instalado em:</span><br /><strong>{fmtDate(selectedPosto.dataInstalacao)}</strong></div>
                  <div><span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>Operador DPC:</span><br /><strong>{selectedPosto.operadorDPC || '—'}</strong></div>
                  <div>
                    <span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>Rede MOBI.E:</span><br />
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                      background: selectedPosto.redeMoviE ? '#E6F4F2' : '#FDECEA',
                      color: selectedPosto.redeMoviE ? '#1A7A6E' : '#C0392B',
                    }}>
                      {selectedPosto.redeMoviE ? 'Sim' : 'Não'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>Estado:</span><br />
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: ESTADO_POSTO_CONFIG[selectedPosto.estado].bg, color: ESTADO_POSTO_CONFIG[selectedPosto.estado].color }}>
                      {ESTADO_POSTO_CONFIG[selectedPosto.estado].label}
                    </span>
                  </div>
                </div>

                {/* Consumo table */}
                <div style={{ marginTop: 24 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 12px' }}>📊 Histórico de Consumo</h4>
                  {selectedPosto.consumoMensal.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)' }}>Nenhum registo de consumo</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--sd-border, #E4DDD0)' }}>
                            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--sd-ink-3, #8A9BB0)', fontWeight: 600, fontSize: 12 }}>Mês</th>
                            <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--sd-ink-3, #8A9BB0)', fontWeight: 600, fontSize: 12 }}>kWh</th>
                            <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--sd-ink-3, #8A9BB0)', fontWeight: 600, fontSize: 12 }}>Custo</th>
                            <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--sd-ink-3, #8A9BB0)', fontWeight: 600, fontSize: 12 }}>€/kWh</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPosto.consumoMensal.map((c, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{c.mes}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{c.kwh.toLocaleString('pt-PT')}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(c.custoEur)} €</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--sd-ink-3, #8A9BB0)' }}>
                                {c.kwh > 0 ? fmt(c.custoEur / c.kwh) : '—'}
                              </td>
                            </tr>
                          ))}
                          <tr style={{ fontWeight: 700 }}>
                            <td style={{ padding: '8px 12px' }}>Total</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>{selectedPosto.consumoMensal.reduce((s, c) => s + c.kwh, 0).toLocaleString('pt-PT')}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(selectedPosto.consumoMensal.reduce((s, c) => s + c.custoEur, 0))} €</td>
                            <td style={{ padding: '8px 12px' }} />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Add consumo form */}
                  <div style={{ marginTop: 16, background: 'var(--sd-cream, #F7F4EE)', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 8 }}>Adicionar Registo de Consumo</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div>
                        <label style={labelStyle}>Mês</label>
                        <input type="month" value={consumoMes} onChange={e => setConsumoMes(e.target.value)} style={{ ...inputStyle, width: 150 }} />
                      </div>
                      <div>
                        <label style={labelStyle}>kWh</label>
                        <input type="number" value={consumoKwh} onChange={e => setConsumoKwh(e.target.value)} style={{ ...inputStyle, width: 100 }} placeholder="0" />
                      </div>
                      <div>
                        <label style={labelStyle}>Custo (€)</label>
                        <input type="number" value={consumoCusto} onChange={e => setConsumosCusto(e.target.value)} style={{ ...inputStyle, width: 100 }} placeholder="0.00" />
                      </div>
                      <button
                        onClick={() => adicionarConsumo(selectedPosto.id)}
                        style={{ background: 'var(--sd-navy, #0D1B2E)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        + Adicionar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Modal: Novo Posto ── */}
          {showNovoPostoForm && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => { resetPostoForm(); setShowNovoPostoForm(false) }}>
              <div style={{ background: '#fff', borderRadius: 16, maxWidth: 600, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: 32 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, margin: 0 }}>🔌 Registar Novo Posto</h3>
                  <button onClick={() => { resetPostoForm(); setShowNovoPostoForm(false) }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--sd-ink-3, #8A9BB0)' }}>✕</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={labelStyle}>Edifício *</label>
                    <input value={ppEdificio} onChange={e => setPpEdificio(e.target.value)} style={inputStyle} placeholder="Ex: Edifício Solar do Porto" />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={labelStyle}>Localização *</label>
                    <input value={ppLocal} onChange={e => setPpLocal(e.target.value)} style={inputStyle} placeholder="Ex: Garagem -1, Lugar 12" />
                  </div>
                  <div>
                    <label style={labelStyle}>Tipo de Posto</label>
                    <select value={ppTipo} onChange={e => setPpTipo(e.target.value as TipoPosto)} style={inputStyle}>
                      {Object.entries(TIPO_POSTO_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v.emoji} {v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Potência (kW)</label>
                    <input type="number" value={ppPotencia} onChange={e => setPpPotencia(e.target.value)} style={inputStyle} placeholder="Ex: 7.4, 11, 22" />
                  </div>
                  <div>
                    <label style={labelStyle}>Proprietário</label>
                    <input value={ppProprietario} onChange={e => setPpProprietario(e.target.value)} style={inputStyle} placeholder="Condómino ou Condomínio" />
                  </div>
                  <div>
                    <label style={labelStyle}>Tipo de Uso</label>
                    <select value={ppTipoUso} onChange={e => setPpTipoUso(e.target.value as TipoUso)} style={inputStyle}>
                      <option value="exclusivo">Uso Exclusivo</option>
                      <option value="partilhado">Uso Partilhado</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Data de Instalação</label>
                    <input type="date" value={ppData} onChange={e => setPpData(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Operador DPC</label>
                    <input value={ppOperador} onChange={e => setPpOperador(e.target.value)} style={inputStyle} placeholder="Ex: EDP, Galp, Endesa..." />
                  </div>
                  <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={ppMoviE} onChange={e => setPpMoviE(e.target.checked)} />
                      <span style={{ fontWeight: 600, color: 'var(--sd-ink-2, #4A5E78)' }}>Ligado à rede MOBI.E</span>
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
                  <button onClick={criarPosto} style={{ background: 'var(--sd-navy, #0D1B2E)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    ✓ Registar Posto
                  </button>
                  <button onClick={() => { resetPostoForm(); setShowNovoPostoForm(false) }} style={{ background: 'var(--sd-cream, #F7F4EE)', color: 'var(--sd-ink-2, #4A5E78)', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3 — LEGISLAÇÃO                                                     */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'legislacao' && (
        <div>
          {/* Legal summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              {
                emoji: '📜',
                titulo: 'DL 101-D/2020',
                subtitulo: 'Direito Individual à Instalação',
                conteudo: 'Todo o condómino tem o direito de instalar infraestrutura de carregamento de veículos elétricos na sua fração ou lugar de estacionamento, incluindo em partes comuns, mediante comunicação prévia.',
                cor: '#1967D2',
                bg: '#E8F0FE',
              },
              {
                emoji: '📩',
                titulo: 'Comunicação Prévia 30 Dias',
                subtitulo: 'Art.º 59.º-A',
                conteudo: 'O condómino deve comunicar por escrito ao administrador do condomínio com antecedência mínima de 30 dias, incluindo projeto técnico e identificação do instalador certificado.',
                cor: '#D4830A',
                bg: '#FEF5E4',
              },
              {
                emoji: '⏱️',
                titulo: 'Prazo de Decisão 60 Dias',
                subtitulo: 'Silêncio = Aprovação Tácita',
                conteudo: 'O condomínio dispõe de 60 dias para se pronunciar. Na ausência de resposta fundamentada dentro do prazo, considera-se tacitamente aprovada a instalação.',
                cor: '#6C5CE7',
                bg: '#EDE8FF',
              },
              {
                emoji: '🚫',
                titulo: 'Motivos de Oposição (apenas 3)',
                subtitulo: 'Fundamentos Taxativos',
                conteudo: '1) Risco comprovado para a segurança do edifício; 2) Insuficiência da capacidade elétrica; 3) Existência de alternativa coletiva já aprovada. Qualquer outro motivo é ilegal.',
                cor: '#C0392B',
                bg: '#FDECEA',
              },
              {
                emoji: '🏗️',
                titulo: 'Edifícios Pré-2010',
                subtitulo: 'Maioria de 2/3',
                conteudo: 'Para edifícios construídos antes de 2010 sem pré-instalação elétrica para VE, obras de adaptação das infraestruturas comuns podem requerer aprovação por maioria de 2/3 dos condóminos.',
                cor: '#1A7A6E',
                bg: '#E6F4F2',
              },
              {
                emoji: '💶',
                titulo: 'Custos e Responsabilidade',
                subtitulo: 'Condómino Requerente',
                conteudo: 'Todos os custos de aquisição, instalação e manutenção são integralmente suportados pelo condómino requerente. O condomínio não tem qualquer encargo, salvo decisão em assembleia para infraestrutura coletiva.',
                cor: 'var(--sd-navy, #0D1B2E)',
                bg: 'var(--sd-cream, #F7F4EE)',
              },
            ].map((card, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 16, padding: 24, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: card.cor }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    {card.emoji}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: card.cor }}>{card.titulo}</div>
                    <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>{card.subtitulo}</div>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.6, margin: 0 }}>
                  {card.conteudo}
                </p>
              </div>
            ))}
          </div>

          {/* FAQ Accordion */}
          <div style={{ marginTop: 8 }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 16 }}>
              Perguntas Frequentes
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {FAQ_DATA.map((faq, i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpandedFAQ(expandedFAQ === i ? null : i)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '16px 20px',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--sd-navy, #0D1B2E)' }}>{faq.pergunta}</span>
                    <span style={{ fontSize: 18, color: 'var(--sd-ink-3, #8A9BB0)', flexShrink: 0, transition: 'transform 0.2s', transform: expandedFAQ === i ? 'rotate(45deg)' : 'none' }}>+</span>
                  </button>
                  {expandedFAQ === i && (
                    <div style={{ padding: '0 20px 16px 20px', fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.7 }}>
                      {faq.resposta}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 4 — INCENTIVOS                                                     */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'incentivos' && (
        <div>
          {/* Fundo Ambiental info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#E6F4F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🛒</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--sd-navy, #0D1B2E)' }}>Aquisição do Posto</div>
                  <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>Fundo Ambiental</div>
                </div>
              </div>
              <div style={{ background: '#E6F4F2', borderRadius: 12, padding: 20, textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 36, color: '#1A7A6E', fontWeight: 700 }}>80%</div>
                <div style={{ fontSize: 13, color: '#1A7A6E', fontWeight: 600 }}>do custo de aquisição</div>
                <div style={{ fontSize: 24, color: 'var(--sd-navy, #0D1B2E)', fontWeight: 700, marginTop: 8 }}>máx. 800 €</div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.6 }}>
                Comparticipação a fundo perdido para a compra de equipamento de carregamento de veículos elétricos para uso em condomínios.
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FEF5E4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🔧</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--sd-navy, #0D1B2E)' }}>Instalação</div>
                  <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>Fundo Ambiental</div>
                </div>
              </div>
              <div style={{ background: '#FEF5E4', borderRadius: 12, padding: 20, textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 36, color: '#D4830A', fontWeight: 700 }}>80%</div>
                <div style={{ fontSize: 13, color: '#D4830A', fontWeight: 600 }}>do custo de instalação</div>
                <div style={{ fontSize: 24, color: 'var(--sd-navy, #0D1B2E)', fontWeight: 700, marginTop: 8 }}>máx. 1 000 €</div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.6 }}>
                Comparticipação a fundo perdido para a instalação do ponto de carregamento, incluindo trabalhos elétricos e de construção civil necessários.
              </div>
            </div>
          </div>

          {/* Requisitos */}
          <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 16px' }}>
              Requisitos para Acesso aos Incentivos
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {[
                { emoji: '🌐', titulo: 'Ligação à Rede MOBI.E', desc: 'O ponto de carregamento deve estar integrado na rede nacional de mobilidade elétrica MOBI.E, permitindo o acesso interoperável por qualquer utilizador.' },
                { emoji: '🏢', titulo: 'Operador DPC Certificado', desc: 'A instalação deve ser realizada por um Operador de Ponto de Carregamento (OPC) ou Detentor de Ponto de Carregamento (DPC) devidamente registado e certificado.' },
                { emoji: '📋', titulo: 'Projeto Técnico', desc: 'Apresentação de projeto técnico de instalação elaborado por técnico habilitado, incluindo esquema unifilar e dimensionamento da proteção elétrica.' },
                { emoji: '📄', titulo: 'Documentação Fiscal', desc: 'Faturas originais de aquisição do equipamento e de instalação, em nome do condómino requerente, com NIF português válido.' },
              ].map((req, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--sd-cream, #F7F4EE)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {req.emoji}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 4 }}>{req.titulo}</div>
                    <div style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.5 }}>{req.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Checklist de elegibilidade */}
          <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 16px' }}>
              Checklist de Elegibilidade
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { key: 'mobie', label: 'Posto ligado à rede MOBI.E' },
                { key: 'operador_dpc', label: 'Instalação por operador DPC certificado' },
                { key: 'projeto_tecnico', label: 'Projeto técnico aprovado' },
                { key: 'instalador_certificado', label: 'Instalador elétrico com certificação válida' },
                { key: 'fatura_aquisicao', label: 'Fatura de aquisição do equipamento' },
                { key: 'fatura_instalacao', label: 'Fatura da instalação' },
                { key: 'certificado_conformidade', label: 'Certificado de conformidade da instalação' },
              ].map(item => {
                const checked = checklistItems[item.key] || false
                return (
                  <label key={item.key} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                    background: checked ? '#E6F4F2' : 'var(--sd-cream, #F7F4EE)',
                    borderRadius: 10, cursor: 'pointer', transition: 'background 0.2s',
                    border: `1px solid ${checked ? '#1A7A6E' : 'var(--sd-border, #E4DDD0)'}`,
                  }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setChecklistItems(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                      style={{ width: 18, height: 18, accentColor: '#1A7A6E' }}
                    />
                    <span style={{
                      fontSize: 13, fontWeight: 600,
                      color: checked ? '#1A7A6E' : 'var(--sd-ink-2, #4A5E78)',
                      textDecoration: checked ? 'line-through' : 'none',
                    }}>
                      {item.label}
                    </span>
                  </label>
                )
              })}
            </div>

            {/* Progress */}
            {(() => {
              const total = Object.keys(checklistItems).length
              const done = Object.values(checklistItems).filter(Boolean).length
              const pct = Math.round((done / total) * 100)
              return (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 4 }}>
                    <span>{done}/{total} critérios cumpridos</span>
                    <span style={{ fontWeight: 700, color: pct === 100 ? '#1A7A6E' : 'var(--sd-navy, #0D1B2E)' }}>{pct}%</span>
                  </div>
                  <div style={{ width: '100%', height: 8, background: 'var(--sd-border, #E4DDD0)', borderRadius: 4 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#1A7A6E' : 'var(--sd-gold, #C9A84C)', borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                  {pct === 100 && (
                    <div style={{ marginTop: 8, fontSize: 13, color: '#1A7A6E', fontWeight: 600 }}>
                      ✓ Todos os critérios cumpridos! Elegível para submissão ao Fundo Ambiental.
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Links úteis */}
          <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 16, padding: 24 }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 16px' }}>
              Links Úteis
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
              {[
                { emoji: '🌐', nome: 'MOBI.E', desc: 'Rede nacional de mobilidade elétrica', url: 'https://www.mobie.pt' },
                { emoji: '⚡', nome: 'DGEG', desc: 'Direção-Geral de Energia e Geologia', url: 'https://www.dgeg.gov.pt' },
                { emoji: '🌿', nome: 'Fundo Ambiental', desc: 'Incentivos para mobilidade elétrica', url: 'https://www.fundoambiental.pt' },
                { emoji: '📜', nome: 'DRE — DL 101-D/2020', desc: 'Legislação no Diário da República', url: 'https://dre.pt' },
              ].map((link, i) => (
                <div
                  key={i}
                  onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: 16,
                    background: 'var(--sd-cream, #F7F4EE)', borderRadius: 12, cursor: 'pointer',
                    border: '1px solid var(--sd-border, #E4DDD0)',
                    transition: 'border-color 0.2s',
                  }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    {link.emoji}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--sd-navy, #0D1B2E)' }}>{link.nome}</div>
                    <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>{link.desc}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: 16, color: 'var(--sd-ink-3, #8A9BB0)' }}>→</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#4A5E78', display: 'block', marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E4DDD0',
  fontSize: 13, color: '#0D1B2E', background: '#FAFAF7', outline: 'none',
}
