'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TabPortal = 'visao_geral' | 'conta_corrente' | 'documentos' | 'comunicacoes' | 'pedidos'

type EstadoPagamento = 'em_dia' | 'em_atraso' | 'em_divida'
type PeriodoFiltro = 'mes' | 'trimestre' | 'ano'
type CategoriaDocumento = 'atas_ag' | 'convocatorias' | 'regulamento' | 'orcamentos' | 'seguros' | 'contratos'
type EstadoPedido = 'submetido' | 'em_analise' | 'em_curso' | 'resolvido'
type TipoPedido = 'manutencao' | 'reclamacao' | 'informacao' | 'outro'

interface MovimentoConta {
  id: string
  data: string
  descricao: string
  debito: number
  credito: number
}

interface AvisoPortal {
  id: string
  titulo: string
  corpo: string
  data: string
  tipo: 'info' | 'urgente' | 'manutencao' | 'financeiro'
}

interface DocumentoPortal {
  id: string
  nome: string
  categoria: CategoriaDocumento
  data: string
  tamanho: string
}

interface MensagemPortal {
  id: string
  remetente: 'admin' | 'condomino'
  nomeRemetente: string
  assunto: string
  corpo: string
  data: string
  lida: boolean
}

interface PedidoPortal {
  id: string
  tipo: TipoPedido
  titulo: string
  descricao: string
  estado: EstadoPedido
  dataCriacao: string
  dataAtualizacao: string
  fotos: string[]
  historico: { data: string; estado: EstadoPedido; nota?: string }[]
}

interface Props {
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> }
  userRole: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const TABS: { key: TabPortal; label: string; icon: string }[] = [
  { key: 'visao_geral',    label: 'Visao Geral',    icon: '🏠' },
  { key: 'conta_corrente', label: 'Conta Corrente',  icon: '💶' },
  { key: 'documentos',     label: 'Documentos',      icon: '📁' },
  { key: 'comunicacoes',   label: 'Comunicacoes',    icon: '💬' },
  { key: 'pedidos',        label: 'Pedidos',          icon: '📋' },
]

const CATEGORIAS_DOC: Record<CategoriaDocumento, { emoji: string; label: string }> = {
  atas_ag:        { emoji: '📜', label: 'Atas AG' },
  convocatorias:  { emoji: '📨', label: 'Convocatorias' },
  regulamento:    { emoji: '📖', label: 'Regulamento' },
  orcamentos:     { emoji: '📊', label: 'Orcamentos' },
  seguros:        { emoji: '🛡️', label: 'Seguros' },
  contratos:      { emoji: '📝', label: 'Contratos' },
}

const TIPOS_PEDIDO: Record<TipoPedido, { emoji: string; label: string }> = {
  manutencao:  { emoji: '🔧', label: 'Manutencao' },
  reclamacao:  { emoji: '⚠️', label: 'Reclamacao' },
  informacao:  { emoji: 'ℹ️', label: 'Informação' },
  outro:       { emoji: '📄', label: 'Outro' },
}

const ESTADO_PEDIDO_CONFIG: Record<EstadoPedido, { label: string; bg: string; color: string; dot: string }> = {
  submetido:  { label: 'Submetido',  bg: '#FEF5E4', color: '#D4830A', dot: '#D4830A' },
  em_analise: { label: 'Em analise', bg: '#E6F4F2', color: '#1A7A6E', dot: '#1A7A6E' },
  em_curso:   { label: 'Em curso',   bg: '#EDE8FF', color: '#6C5CE7', dot: '#6C5CE7' },
  resolvido:  { label: 'Resolvido',  bg: '#E6F4F2', color: '#1A7A6E', dot: '#1A7A6E' },
}

const ESTADO_PAGAMENTO_CONFIG: Record<EstadoPagamento, { label: string; icon: string; bg: string; color: string }> = {
  em_dia:    { label: 'Em dia',    icon: '\u2705', bg: '#E6F4F2', color: '#1A7A6E' },
  em_atraso: { label: 'Em atraso', icon: '\u26A0\uFE0F', bg: '#FEF5E4', color: '#D4830A' },
  em_divida: { label: 'Em divida', icon: '\uD83D\uDD34', bg: '#FDECEA', color: '#C0392B' },
}

const formatEur = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)

const formatDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return s }
}

const formatDateShort = (s: string) => {
  try { return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return s }
}

// ─── Demo data ──────────────────────────────────────────────────────────────

function generateDemoData(userId: string) {
  const movimentos: MovimentoConta[] = [
    { id: 'mov-1', data: '2026-03-01', descricao: 'Quota ordinária - Marco 2026', debito: 85, credito: 0 },
    { id: 'mov-2', data: '2026-03-01', descricao: 'Pagamento quota Março', debito: 0, credito: 85 },
    { id: 'mov-3', data: '2026-02-01', descricao: 'Quota ordinária - Fevereiro 2026', debito: 85, credito: 0 },
    { id: 'mov-4', data: '2026-02-05', descricao: 'Pagamento quota Fevereiro', debito: 0, credito: 85 },
    { id: 'mov-5', data: '2026-01-01', descricao: 'Quota ordinária - Janeiro 2026', debito: 85, credito: 0 },
    { id: 'mov-6', data: '2026-01-03', descricao: 'Pagamento quota Janeiro', debito: 0, credito: 85 },
    { id: 'mov-7', data: '2025-12-01', descricao: 'Quota ordinária - Dezembro 2025', debito: 85, credito: 0 },
    { id: 'mov-8', data: '2025-12-04', descricao: 'Pagamento quota Dezembro', debito: 0, credito: 85 },
    { id: 'mov-9', data: '2025-12-15', descricao: 'Quota extraordinaria - Obras fachada', debito: 250, credito: 0 },
    { id: 'mov-10', data: '2025-12-20', descricao: 'Pagamento quota extraordinaria', debito: 0, credito: 250 },
    { id: 'mov-11', data: '2025-11-01', descricao: 'Quota ordinária - Novembro 2025', debito: 85, credito: 0 },
    { id: 'mov-12', data: '2025-11-02', descricao: 'Pagamento quota Novembro', debito: 0, credito: 85 },
  ]

  const avisos: AvisoPortal[] = [
    { id: 'av-1', titulo: 'Obras na fachada - Inicio previsto', corpo: 'Informamos que as obras de reabilitacao da fachada principal terao inicio no dia 20 de Marco. Agradecemos a colaboracao de todos.', data: '2026-03-10', tipo: 'manutencao' },
    { id: 'av-2', titulo: 'Assembleia Geral Ordinaria', corpo: 'Convocamos todos os condominos para a Assembleia Geral Ordinaria que decorrera no dia 15 de Abril as 19h00 na sala do condominio.', data: '2026-03-08', tipo: 'info' },
    { id: 'av-3', titulo: 'Corte de agua programado', corpo: 'No dia 25 de Marco, entre as 9h e as 13h, havera corte de agua para reparacao no sistema de canalizacao do piso 0.', data: '2026-03-05', tipo: 'urgente' },
    { id: 'av-4', titulo: 'Orcamento aprovado - Elevador', corpo: 'Foi aprovado em AG o orcamento para modernizacao do elevador no valor de 12.500 EUR. Os trabalhos iniciam em Maio.', data: '2026-03-01', tipo: 'financeiro' },
    { id: 'av-5', titulo: 'Limpeza partes comuns', corpo: 'Informamos que a nova empresa de limpeza iniciara funcoes a partir de 1 de Abril. Horario: 2.ª a 6.ª, das 8h as 10h.', data: '2026-02-28', tipo: 'info' },
  ]

  const documentos: DocumentoPortal[] = [
    { id: 'doc-1', nome: 'Ata AG Ordinaria - Fevereiro 2026', categoria: 'atas_ag', data: '2026-02-15', tamanho: '245 KB' },
    { id: 'doc-2', nome: 'Ata AG Extraordinaria - Dezembro 2025', categoria: 'atas_ag', data: '2025-12-10', tamanho: '180 KB' },
    { id: 'doc-3', nome: 'Convocatoria AG Abril 2026', categoria: 'convocatorias', data: '2026-03-08', tamanho: '95 KB' },
    { id: 'doc-4', nome: 'Regulamento Interno do Condominio', categoria: 'regulamento', data: '2024-06-01', tamanho: '520 KB' },
    { id: 'doc-5', nome: 'Orcamento Anual 2026', categoria: 'orcamentos', data: '2026-01-10', tamanho: '310 KB' },
    { id: 'doc-6', nome: 'Orcamento Obras Fachada', categoria: 'orcamentos', data: '2025-11-20', tamanho: '450 KB' },
    { id: 'doc-7', nome: 'Apolice Seguro Multirriscos 2026', categoria: 'seguros', data: '2026-01-01', tamanho: '380 KB' },
    { id: 'doc-8', nome: 'Contrato Limpeza - LimpaPro Lda', categoria: 'contratos', data: '2026-02-28', tamanho: '210 KB' },
    { id: 'doc-9', nome: 'Contrato Manutencao Elevador', categoria: 'contratos', data: '2025-09-15', tamanho: '275 KB' },
    { id: 'doc-10', nome: 'Seguro Responsabilidade Civil', categoria: 'seguros', data: '2025-06-01', tamanho: '190 KB' },
  ]

  const mensagens: MensagemPortal[] = [
    { id: 'msg-1', remetente: 'admin', nomeRemetente: 'Administracao', assunto: 'Re: Humidade na garagem', corpo: 'Boa tarde. Ja agendamos a visita do tecnico para dia 18 de Marco. Sera contactado por telefone para confirmar a hora.', data: '2026-03-11T14:30:00', lida: false },
    { id: 'msg-2', remetente: 'condomino', nomeRemetente: 'Eu', assunto: 'Humidade na garagem', corpo: 'Boa tarde. Gostaria de reportar humidade na parede junto ao meu lugar de garagem (lugar 12). Parece estar a piorar com as chuvas recentes.', data: '2026-03-10T09:15:00', lida: true },
    { id: 'msg-3', remetente: 'admin', nomeRemetente: 'Administracao', assunto: 'Quota extraordinaria aprovada', corpo: 'Informamos que a quota extraordinaria para obras na fachada foi aprovada em AG. O valor e de 250 EUR e devera ser pago ate 31 de Dezembro.', data: '2026-02-16T10:00:00', lida: true },
    { id: 'msg-4', remetente: 'condomino', nomeRemetente: 'Eu', assunto: 'Duvida sobre quota extraordinaria', corpo: 'Boa tarde. Pode esclarecer-me sobre o metodo de calculo da quota extraordinaria? Gostaria de perceber a reparticao por fracao.', data: '2026-02-17T11:30:00', lida: true },
    { id: 'msg-5', remetente: 'admin', nomeRemetente: 'Administracao', assunto: 'Re: Duvida sobre quota extraordinaria', corpo: 'O calculo foi feito com base na permilagem de cada fracao, conforme previsto no regulamento. A sua fracao tem permilagem de 55/1000, logo: 4.545 EUR x 0.055 = 250 EUR.', data: '2026-02-18T09:45:00', lida: true },
  ]

  const pedidos: PedidoPortal[] = [
    {
      id: 'ped-1', tipo: 'manutencao', titulo: 'Torneira com fuga - casa de banho',
      descricao: 'A torneira do lavatorio da casa de banho principal tem uma fuga constante. Ja tentei apertar mas nao resolve.',
      estado: 'em_curso', dataCriacao: '2026-03-05', dataAtualizacao: '2026-03-11', fotos: ['foto_torneira_1.jpg'],
      historico: [
        { data: '2026-03-05', estado: 'submetido', nota: 'Pedido submetido pelo condomino.' },
        { data: '2026-03-06', estado: 'em_analise', nota: 'Em analise pela administracao. Sera encaminhado ao canalizador.' },
        { data: '2026-03-08', estado: 'em_curso', nota: 'Canalizador agendado para dia 14 de Marco.' },
      ],
    },
    {
      id: 'ped-2', tipo: 'reclamacao', titulo: 'Barulho excessivo - vizinho 3.o Esq',
      descricao: 'Barulho constante apos as 23h durante a semana. Obras ou musica alta. Ja conversei diretamente mas sem resultado.',
      estado: 'em_analise', dataCriacao: '2026-03-01', dataAtualizacao: '2026-03-03', fotos: [],
      historico: [
        { data: '2026-03-01', estado: 'submetido', nota: 'Pedido submetido pelo condomino.' },
        { data: '2026-03-03', estado: 'em_analise', nota: 'Administracao tomou nota. Sera enviada notificacao ao condomino em questao.' },
      ],
    },
    {
      id: 'ped-3', tipo: 'informacao', titulo: 'Copia da ata AG 2024',
      descricao: 'Gostaria de obter copia da ata da Assembleia Geral de 2024 para efeitos fiscais.',
      estado: 'resolvido', dataCriacao: '2026-02-10', dataAtualizacao: '2026-02-12', fotos: [],
      historico: [
        { data: '2026-02-10', estado: 'submetido' },
        { data: '2026-02-11', estado: 'em_analise', nota: 'A localizar o documento.' },
        { data: '2026-02-12', estado: 'resolvido', nota: 'Documento disponibilizado na seccao Documentos.' },
      ],
    },
  ]

  return { movimentos, avisos, documentos, mensagens, pedidos }
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PortalCondominoSection({ user, userRole }: Props) {
  const STORAGE_KEY = `fixit_portal_condomino_${user.id}`

  // ── State
  const [activeTab, setActiveTab] = useState<TabPortal>('visao_geral')
  const [movimentos, setMovimentos] = useState<MovimentoConta[]>([])
  const [avisos, setAvisos] = useState<AvisoPortal[]>([])
  const [documentos, setDocumentos] = useState<DocumentoPortal[]>([])
  const [mensagens, setMensagens] = useState<MensagemPortal[]>([])
  const [pedidos, setPedidos] = useState<PedidoPortal[]>([])

  // Conta Corrente filters
  const [periodoFiltro, setPeriodoFiltro] = useState<PeriodoFiltro>('ano')

  // Documentos search + filter
  const [docSearch, setDocSearch] = useState('')
  const [docCatFiltro, setDocCatFiltro] = useState<CategoriaDocumento | 'todos'>('todos')

  // Comunicacoes
  const [novoAssunto, setNovoAssunto] = useState('')
  const [novoCorpo, setNovoCorpo] = useState('')

  // Pedidos
  const [showNovoPedido, setShowNovoPedido] = useState(false)
  const [pedidoTipo, setPedidoTipo] = useState<TipoPedido>('manutencao')
  const [pedidoTitulo, setPedidoTitulo] = useState('')
  const [pedidoDescricao, setPedidoDescricao] = useState('')
  const [pedidoFotos, setPedidoFotos] = useState<string[]>([])
  const [selectedPedido, setSelectedPedido] = useState<PedidoPortal | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Load / Save
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.movimentos) setMovimentos(parsed.movimentos)
        if (parsed.avisos) setAvisos(parsed.avisos)
        if (parsed.documentos) setDocumentos(parsed.documentos)
        if (parsed.mensagens) setMensagens(parsed.mensagens)
        if (parsed.pedidos) setPedidos(parsed.pedidos)
      } else {
        // Seed demo data
        const demo = generateDemoData(user.id)
        setMovimentos(demo.movimentos)
        setAvisos(demo.avisos)
        setDocumentos(demo.documentos)
        setMensagens(demo.mensagens)
        setPedidos(demo.pedidos)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    const data = { movimentos, avisos, documentos, mensagens, pedidos }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [movimentos, avisos, documentos, mensagens, pedidos])

  // ── Computed values
  const saldoDevedor = useMemo(() => {
    const totalDebitos = movimentos.reduce((s, m) => s + m.debito, 0)
    const totalCreditos = movimentos.reduce((s, m) => s + m.credito, 0)
    return totalDebitos - totalCreditos
  }, [movimentos])

  const estadoPagamento: EstadoPagamento = useMemo(() => {
    if (saldoDevedor <= 0) return 'em_dia'
    if (saldoDevedor <= 170) return 'em_atraso'
    return 'em_divida'
  }, [saldoDevedor])

  const movimentosFiltrados = useMemo(() => {
    const now = new Date()
    return movimentos.filter(m => {
      const d = new Date(m.data)
      if (periodoFiltro === 'mes') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      }
      if (periodoFiltro === 'trimestre') {
        const qNow = Math.floor(now.getMonth() / 3)
        const qMov = Math.floor(d.getMonth() / 3)
        return qMov === qNow && d.getFullYear() === now.getFullYear()
      }
      return d.getFullYear() === now.getFullYear()
    }).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  }, [movimentos, periodoFiltro])

  const saldoAcumulado = useMemo(() => {
    let saldo = 0
    const sorted = [...movimentosFiltrados].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    return sorted.map(m => {
      saldo = saldo + m.debito - m.credito
      return { ...m, saldo }
    }).reverse()
  }, [movimentosFiltrados])

  const documentosFiltrados = useMemo(() => {
    return documentos.filter(d => {
      if (docCatFiltro !== 'todos' && d.categoria !== docCatFiltro) return false
      if (docSearch && !d.nome.toLowerCase().includes(docSearch.toLowerCase())) return false
      return true
    }).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  }, [documentos, docCatFiltro, docSearch])

  const unreadCount = useMemo(() => mensagens.filter(m => !m.lida && m.remetente === 'admin').length, [mensagens])

  // ── Handlers
  const handleEnviarMensagem = () => {
    if (!novoAssunto.trim() || !novoCorpo.trim()) return
    const msg: MensagemPortal = {
      id: `msg-${Date.now()}`,
      remetente: 'condomino',
      nomeRemetente: 'Eu',
      assunto: novoAssunto.trim(),
      corpo: novoCorpo.trim(),
      data: new Date().toISOString(),
      lida: true,
    }
    setMensagens(prev => [msg, ...prev])
    setNovoAssunto('')
    setNovoCorpo('')
  }

  const handleSubmitPedido = () => {
    if (!pedidoTitulo.trim() || !pedidoDescricao.trim()) return
    const pedido: PedidoPortal = {
      id: `ped-${Date.now()}`,
      tipo: pedidoTipo,
      titulo: pedidoTitulo.trim(),
      descricao: pedidoDescricao.trim(),
      estado: 'submetido',
      dataCriacao: new Date().toISOString().split('T')[0],
      dataAtualizacao: new Date().toISOString().split('T')[0],
      fotos: pedidoFotos,
      historico: [{ data: new Date().toISOString().split('T')[0], estado: 'submetido' as EstadoPedido, nota: 'Pedido submetido pelo condomino.' }],
    }
    setPedidos(prev => [pedido, ...prev])
    setPedidoTipo('manutencao')
    setPedidoTitulo('')
    setPedidoDescricao('')
    setPedidoFotos([])
    setShowNovoPedido(false)
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach((f: File) => {
      setPedidoFotos(prev => [...prev, f.name])
    })
  }

  const markAsRead = (msgId: string) => {
    setMensagens(prev => prev.map(m => m.id === msgId ? { ...m, lida: true } : m))
  }

  // ─── Shared styles
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
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Outfit', sans-serif",
  }

  const btnSecondary: React.CSSProperties = {
    background: 'var(--sd-cream, #F7F4EE)',
    color: 'var(--sd-navy, #0D1B2E)',
    border: '1px solid var(--sd-border, #E4DDD0)',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Outfit', sans-serif",
  }

  const btnGold: React.CSSProperties = {
    background: 'var(--sd-gold, #C9A84C)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Outfit', sans-serif",
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid var(--sd-border, #E4DDD0)',
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "'Outfit', sans-serif",
    background: '#fff',
    color: 'var(--sd-navy, #0D1B2E)',
    outline: 'none',
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--sd-ink-2, #4A5E78)',
    marginBottom: 4,
    display: 'block',
    fontFamily: "'Outfit', sans-serif",
  }

  // ─── Tab: Visao Geral ───────────────────────────────────────────────────────

  const renderVisaoGeral = () => {
    const epCfg = ESTADO_PAGAMENTO_CONFIG[estadoPagamento]
    const ultimoPagamento = movimentos
      .filter(m => m.credito > 0)
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0]

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {/* Saldo devedor */}
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: estadoPagamento === 'em_dia' ? '#E6F4F2' : '#FEF5E4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💰</div>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: 'var(--sd-navy, #0D1B2E)', lineHeight: 1 }}>{formatEur(Math.max(0, saldoDevedor))}</div>
              <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', marginTop: 4 }}>Saldo devedor</div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', borderRadius: 5, background: epCfg.bg, color: epCfg.color, marginTop: 4 }}>
                {epCfg.icon} {epCfg.label}
              </span>
            </div>
          </div>

          {/* Proxima quota */}
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(201,168,76,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📅</div>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: 'var(--sd-navy, #0D1B2E)', lineHeight: 1 }}>{formatEur(85)}</div>
              <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', marginTop: 4 }}>Proxima quota</div>
              <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 2 }}>Vencimento: 1 Abril 2026</div>
            </div>
          </div>

          {/* Ultimo pagamento */}
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: '#E6F4F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✅</div>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: 'var(--sd-navy, #0D1B2E)', lineHeight: 1 }}>{ultimoPagamento ? formatEur(ultimoPagamento.credito) : '-'}</div>
              <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', marginTop: 4 }}>Ultimo pagamento</div>
              <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 2 }}>{ultimoPagamento ? formatDate(ultimoPagamento.data) : '-'}</div>
            </div>
          </div>

          {/* Fracao */}
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(201,168,76,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏢</div>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: 'var(--sd-navy, #0D1B2E)', lineHeight: 1 }}>Fracao B</div>
              <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', marginTop: 4 }}>2.o Direito</div>
              <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 2 }}>Permilagem: 55/1000</div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div style={cardStyle}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 16 }}>Acoes rapidas</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {[
              { label: 'Ver recibos', icon: '🧾', action: () => { setActiveTab('conta_corrente') } },
              { label: 'Declaracao para IRS', icon: '📄', action: () => { setActiveTab('documentos'); setDocCatFiltro('atas_ag') } },
              { label: 'Reportar avaria', icon: '🔧', action: () => { setActiveTab('pedidos'); setShowNovoPedido(true); setPedidoTipo('manutencao') } },
              { label: 'Contactar administracao', icon: '💬', action: () => { setActiveTab('comunicacoes') } },
            ].map(a => (
              <button
                key={a.label}
                onClick={a.action}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 18px', borderRadius: 8,
                  background: 'var(--sd-cream, #F7F4EE)',
                  border: '1px solid var(--sd-border, #E4DDD0)',
                  cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  color: 'var(--sd-navy, #0D1B2E)',
                  fontFamily: "'Outfit', sans-serif",
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = 'rgba(201,168,76,0.15)' }}
                onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = 'var(--sd-cream, #F7F4EE)' }}
              >
                <span style={{ fontSize: 16 }}>{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Avisos recentes */}
        <div style={cardStyle}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 16 }}>Avisos recentes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {avisos.slice(0, 5).map(a => {
              const tipoColors: Record<string, { bg: string; color: string }> = {
                info: { bg: '#E6F4F2', color: '#1A7A6E' },
                urgente: { bg: '#FDECEA', color: '#C0392B' },
                manutencao: { bg: '#FEF5E4', color: '#D4830A' },
                financeiro: { bg: 'rgba(201,168,76,0.15)', color: '#C9A84C' },
              }
              const tc = tipoColors[a.tipo] || tipoColors.info
              return (
                <div key={a.id} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 8, background: 'var(--sd-cream, #F7F4EE)', border: '1px solid var(--sd-border, #E4DDD0)' }}>
                  <div style={{ minWidth: 8, borderRadius: 4, background: tc.color }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{a.titulo}</div>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: tc.bg, color: tc.color, whiteSpace: 'nowrap' }}>
                        {a.tipo.charAt(0).toUpperCase() + a.tipo.slice(1)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>{a.corpo.substring(0, 120)}{a.corpo.length > 120 ? '...' : ''}</div>
                    <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>{formatDate(a.data)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ─── Tab: Conta Corrente ────────────────────────────────────────────────────

  const renderContaCorrente = () => {
    const epCfg = ESTADO_PAGAMENTO_CONFIG[estadoPagamento]

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Status + filter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 14px', borderRadius: 8, background: epCfg.bg, color: epCfg.color, fontWeight: 600 }}>
              {epCfg.icon} {epCfg.label}
            </span>
            <span style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)' }}>
              Saldo: <strong style={{ color: saldoDevedor > 0 ? '#C0392B' : '#1A7A6E' }}>{formatEur(saldoDevedor)}</strong>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={periodoFiltro} onChange={e => setPeriodoFiltro(e.target.value as PeriodoFiltro)} style={{ ...selectStyle, width: 'auto' }}>
              <option value="mes">Este mes</option>
              <option value="trimestre">Este trimestre</option>
              <option value="ano">Este ano</option>
            </select>
            <button
              style={btnSecondary}
              onClick={() => { alert('Extrato PDF gerado (demo).') }}
            >
              📥 Descarregar extrato PDF
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: "'Outfit', sans-serif" }}>
              <thead>
                <tr style={{ background: 'var(--sd-cream, #F7F4EE)' }}>
                  {['Data', 'Descricao', 'Debito', 'Credito', 'Saldo'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: h === 'Data' || h === 'Descricao' ? 'left' : 'right', fontSize: 11, fontWeight: 700, color: 'var(--sd-ink-2, #4A5E78)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {saldoAcumulado.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--sd-ink-3, #8A9BB0)' }}>Nenhum movimento neste periodo.</td>
                  </tr>
                ) : saldoAcumulado.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: 'var(--sd-ink-2, #4A5E78)' }}>{formatDateShort(m.data)}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--sd-navy, #0D1B2E)', fontWeight: 500 }}>{m.descricao}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: m.debito > 0 ? '#C0392B' : 'var(--sd-ink-3, #8A9BB0)' }}>
                      {m.debito > 0 ? formatEur(m.debito) : '-'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: m.credito > 0 ? '#1A7A6E' : 'var(--sd-ink-3, #8A9BB0)' }}>
                      {m.credito > 0 ? formatEur(m.credito) : '-'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: m.saldo > 0 ? '#C0392B' : '#1A7A6E' }}>
                      {formatEur(m.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ─── Tab: Documentos ────────────────────────────────────────────────────────

  const renderDocumentos = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            type="text"
            placeholder="Pesquisar documentos..."
            value={docSearch}
            onChange={e => setDocSearch(e.target.value)}
            style={inputStyle}
          />
        </div>
        <select value={docCatFiltro} onChange={e => setDocCatFiltro(e.target.value as CategoriaDocumento | 'todos')} style={{ ...selectStyle, width: 'auto', minWidth: 160 }}>
          <option value="todos">Todas as categorias</option>
          {Object.entries(CATEGORIAS_DOC).map(([k, v]) => (
            <option key={k} value={k}>{v.emoji} {v.label}</option>
          ))}
        </select>
      </div>

      {/* Categories grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        {Object.entries(CATEGORIAS_DOC).map(([k, v]) => {
          const count = documentos.filter(d => d.categoria === k).length
          const isActive = docCatFiltro === k
          return (
            <button
              key={k}
              onClick={() => setDocCatFiltro(isActive ? 'todos' : k as CategoriaDocumento)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '14px 10px', borderRadius: 10,
                background: isActive ? 'rgba(201,168,76,0.15)' : '#fff',
                border: `1px solid ${isActive ? 'var(--sd-gold, #C9A84C)' : 'var(--sd-border, #E4DDD0)'}`,
                cursor: 'pointer', transition: 'all 0.15s',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              <span style={{ fontSize: 22 }}>{v.emoji}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{v.label}</span>
              <span style={{ fontSize: 10, color: 'var(--sd-ink-3, #8A9BB0)' }}>{count} doc{count !== 1 ? 's' : ''}</span>
            </button>
          )
        })}
      </div>

      {/* Documents list */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {documentosFiltrados.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--sd-ink-3, #8A9BB0)' }}>Nenhum documento encontrado.</div>
          ) : documentosFiltrados.map(d => {
            const cat = CATEGORIAS_DOC[d.categoria]
            return (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 8, background: 'var(--sd-cream, #F7F4EE)', border: '1px solid var(--sd-border, #E4DDD0)' }}>
                <span style={{ fontSize: 20 }}>{cat.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{d.nome}</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>{formatDateShort(d.data)}</span>
                    <span style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>{d.tamanho}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'rgba(201,168,76,0.15)', color: 'var(--sd-gold, #C9A84C)' }}>{cat.label}</span>
                  </div>
                </div>
                <button
                  onClick={() => { alert(`Download: ${d.nome} (demo)`) }}
                  style={{ background: 'var(--sd-navy, #0D1B2E)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit', sans-serif", whiteSpace: 'nowrap' }}
                >
                  📥 Download
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  // ─── Tab: Comunicacoes ──────────────────────────────────────────────────────

  const renderComunicacoes = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* New message form */}
      <div style={cardStyle}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 16 }}>Nova mensagem</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Assunto</label>
            <input
              type="text"
              placeholder="Assunto da mensagem..."
              value={novoAssunto}
              onChange={e => setNovoAssunto(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Mensagem</label>
            <textarea
              placeholder="Escreva a sua mensagem..."
              value={novoCorpo}
              onChange={e => setNovoCorpo(e.target.value)}
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleEnviarMensagem} style={btnPrimary} disabled={!novoAssunto.trim() || !novoCorpo.trim()}>
              📨 Enviar mensagem
            </button>
          </div>
        </div>
      </div>

      {/* Message thread */}
      <div style={cardStyle}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 16 }}>
          Historico de mensagens
          {unreadCount > 0 && (
            <span style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 20, height: 20, borderRadius: 10, background: '#C0392B', color: '#fff', fontSize: 11, fontWeight: 700, padding: '0 6px' }}>
              {unreadCount}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mensagens.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--sd-ink-3, #8A9BB0)' }}>Nenhuma mensagem.</div>
          ) : mensagens.map(m => {
            const isAdmin = m.remetente === 'admin'
            return (
              <div
                key={m.id}
                onClick={() => { if (!m.lida) markAsRead(m.id) }}
                style={{
                  padding: '14px 16px', borderRadius: 10,
                  background: isAdmin ? (m.lida ? '#fff' : 'rgba(201,168,76,0.08)') : 'var(--sd-cream, #F7F4EE)',
                  border: `1px solid ${!m.lida && isAdmin ? 'var(--sd-gold, #C9A84C)' : 'var(--sd-border, #E4DDD0)'}`,
                  marginLeft: isAdmin ? 0 : 40,
                  marginRight: isAdmin ? 40 : 0,
                  cursor: !m.lida ? 'pointer' : 'default',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 14, background: isAdmin ? 'var(--sd-navy, #0D1B2E)' : 'var(--sd-gold, #C9A84C)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                      {isAdmin ? 'A' : 'E'}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{m.nomeRemetente}</span>
                    {!m.lida && isAdmin && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#C0392B', color: '#fff' }}>Nova</span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>{formatDateShort(m.data.split('T')[0])}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-2, #4A5E78)', marginBottom: 4 }}>{m.assunto}</div>
                <div style={{ fontSize: 13, color: 'var(--sd-navy, #0D1B2E)', lineHeight: 1.5 }}>{m.corpo}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  // ─── Tab: Pedidos ───────────────────────────────────────────────────────────

  const renderPedidos = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)' }}>
          Pedidos ({pedidos.length})
        </div>
        <button onClick={() => { setShowNovoPedido(true); setSelectedPedido(null) }} style={btnGold}>
          + Novo pedido
        </button>
      </div>

      {/* New request form */}
      {showNovoPedido && (
        <div style={{ ...cardStyle, border: '2px solid var(--sd-gold, #C9A84C)' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 16 }}>Submeter novo pedido</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Tipo de pedido</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(TIPOS_PEDIDO).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => setPedidoTipo(k as TipoPedido)}
                    style={{
                      padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${pedidoTipo === k ? 'var(--sd-gold, #C9A84C)' : 'var(--sd-border, #E4DDD0)'}`,
                      background: pedidoTipo === k ? 'rgba(201,168,76,0.15)' : '#fff',
                      color: 'var(--sd-navy, #0D1B2E)',
                      cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
                    }}
                  >
                    {v.emoji} {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Titulo</label>
              <input type="text" placeholder="Titulo do pedido..." value={pedidoTitulo} onChange={e => setPedidoTitulo(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Descricao</label>
              <textarea placeholder="Descreva o seu pedido em detalhe..." value={pedidoDescricao} onChange={e => setPedidoDescricao(e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div>
              <label style={labelStyle}>Fotos (opcional)</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={() => fileInputRef.current?.click()} style={btnSecondary}>
                  📷 Adicionar foto
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoUpload} />
                {pedidoFotos.map((f, i) => (
                  <span key={i} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'var(--sd-cream, #F7F4EE)', border: '1px solid var(--sd-border, #E4DDD0)', color: 'var(--sd-ink-2, #4A5E78)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    📎 {f}
                    <button onClick={() => setPedidoFotos(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C0392B', fontSize: 12, padding: 0, lineHeight: 1 }}>&times;</button>
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowNovoPedido(false); setPedidoTitulo(''); setPedidoDescricao(''); setPedidoFotos([]) }} style={btnSecondary}>Cancelar</button>
              <button onClick={handleSubmitPedido} style={btnPrimary} disabled={!pedidoTitulo.trim() || !pedidoDescricao.trim()}>Submeter pedido</button>
            </div>
          </div>
        </div>
      )}

      {/* Selected pedido timeline view */}
      {selectedPedido && (
        <div style={{ ...cardStyle, border: '2px solid var(--sd-gold, #C9A84C)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 18 }}>{TIPOS_PEDIDO[selectedPedido.tipo].emoji}</span>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)' }}>{selectedPedido.titulo}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>Submetido em {formatDate(selectedPedido.dataCriacao)}</div>
            </div>
            <button onClick={() => setSelectedPedido(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--sd-ink-3, #8A9BB0)' }}>&times;</button>
          </div>

          <div style={{ fontSize: 13, color: 'var(--sd-navy, #0D1B2E)', lineHeight: 1.6, marginBottom: 20, padding: 14, borderRadius: 8, background: 'var(--sd-cream, #F7F4EE)' }}>
            {selectedPedido.descricao}
          </div>

          {/* Photos */}
          {selectedPedido.fotos.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {selectedPedido.fotos.map((f, i) => (
                <span key={i} style={{ fontSize: 11, padding: '6px 12px', borderRadius: 6, background: 'var(--sd-cream, #F7F4EE)', border: '1px solid var(--sd-border, #E4DDD0)', color: 'var(--sd-ink-2, #4A5E78)' }}>📎 {f}</span>
              ))}
            </div>
          )}

          {/* Status progress */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
              {(['submetido', 'em_analise', 'em_curso', 'resolvido'] as EstadoPedido[]).map((e, i, arr) => {
                const reached = arr.indexOf(selectedPedido.estado) >= i
                const cfg = ESTADO_PEDIDO_CONFIG[e]
                return (
                  <React.Fragment key={e}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 14,
                        background: reached ? cfg.dot : '#E4DDD0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 12, fontWeight: 700,
                      }}>
                        {reached ? '\u2713' : (i + 1)}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: reached ? cfg.color : 'var(--sd-ink-3, #8A9BB0)', textAlign: 'center', maxWidth: 70 }}>{cfg.label}</span>
                    </div>
                    {i < arr.length - 1 && (
                      <div style={{ flex: 1, height: 2, background: reached && arr.indexOf(selectedPedido.estado) > i ? cfg.dot : '#E4DDD0', margin: '0 4px', marginBottom: 18 }} />
                    )}
                  </React.Fragment>
                )
              })}
            </div>
          </div>

          {/* Timeline */}
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 12 }}>Historico</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative', paddingLeft: 20 }}>
            <div style={{ position: 'absolute', left: 9, top: 8, bottom: 8, width: 2, background: 'var(--sd-border, #E4DDD0)' }} />
            {selectedPedido.historico.map((h, i) => {
              const cfg = ESTADO_PEDIDO_CONFIG[h.estado]
              return (
                <div key={i} style={{ display: 'flex', gap: 14, padding: '10px 0', position: 'relative' }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 10,
                    background: cfg.dot,
                    border: '3px solid #fff',
                    position: 'absolute', left: -11, top: 12,
                    zIndex: 1,
                  }} />
                  <div style={{ marginLeft: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>{formatDate(h.data)}</span>
                    </div>
                    {h.nota && <div style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.5 }}>{h.nota}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pedidos list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pedidos.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--sd-ink-3, #8A9BB0)', padding: 32 }}>Nenhum pedido submetido.</div>
        ) : pedidos.map(p => {
          const cfg = ESTADO_PEDIDO_CONFIG[p.estado]
          const tCfg = TIPOS_PEDIDO[p.tipo]
          return (
            <div
              key={p.id}
              onClick={() => setSelectedPedido(p)}
              style={{
                ...cardStyle, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 14,
                transition: 'all 0.15s',
                border: selectedPedido?.id === p.id ? '2px solid var(--sd-gold, #C9A84C)' : '1px solid var(--sd-border, #E4DDD0)',
              }}
            >
              <span style={{ fontSize: 24 }}>{tCfg.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 2 }}>{p.titulo}</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>{formatDateShort(p.dataCriacao)}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: 'rgba(201,168,76,0.1)', color: 'var(--sd-gold, #C9A84C)' }}>{tCfg.label}</span>
                  {p.fotos.length > 0 && <span style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>📎 {p.fotos.length}</span>}
                </div>
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                background: cfg.bg, color: cfg.color,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: cfg.dot }} />
                {cfg.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )

  // ─── Main render ─────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--sd-navy, #0D1B2E)' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
          Portal do Condomino
        </h2>
        <p style={{ fontSize: 14, color: 'var(--sd-ink-2, #4A5E78)', margin: '6px 0 0' }}>
          Consulte a sua conta, documentos, comunicacoes e pedidos.
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '2px solid var(--sd-border, #E4DDD0)',
        marginBottom: 24,
        overflowX: 'auto',
      }}>
        {TABS.map(t => {
          const isActive = activeTab === t.key
          const showBadge = t.key === 'comunicacoes' && unreadCount > 0
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '12px 20px',
                background: 'none', border: 'none',
                borderBottom: `3px solid ${isActive ? 'var(--sd-gold, #C9A84C)' : 'transparent'}`,
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--sd-navy, #0D1B2E)' : 'var(--sd-ink-3, #8A9BB0)',
                cursor: 'pointer',
                fontFamily: "'Outfit', sans-serif",
                whiteSpace: 'nowrap',
                position: 'relative',
                transition: 'all 0.15s',
                marginBottom: -2,
              }}
            >
              <span style={{ fontSize: 15 }}>{t.icon}</span>
              {t.label}
              {showBadge && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 17, height: 17, borderRadius: 9,
                  background: '#C0392B', color: '#fff',
                  fontSize: 10, fontWeight: 700, padding: '0 4px',
                  marginLeft: 2,
                }}>
                  {unreadCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'visao_geral' && renderVisaoGeral()}
      {activeTab === 'conta_corrente' && renderContaCorrente()}
      {activeTab === 'documentos' && renderDocumentos()}
      {activeTab === 'comunicacoes' && renderComunicacoes()}
      {activeTab === 'pedidos' && renderPedidos()}
    </div>
  )
}
