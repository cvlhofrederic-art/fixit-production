'use client'

import React, { useState, useEffect, useMemo } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoEnquete = 'sim_nao' | 'escolha_multipla' | 'escala_1_5' | 'texto_livre'
type EstadoEnquete = 'ativa' | 'a_decorrer' | 'encerrada'
type AlvoEnquete = 'todos' | 'por_imovel' | 'por_bloco'

interface OpcaoEnquete {
  id: string
  texto: string
  votos: number
}

interface RespostaEnquete {
  fracaoId: string
  fracaoNome: string
  valor: string
  dataResposta: string
}

interface Enquete {
  id: string
  titulo: string
  descricao: string
  tipo: TipoEnquete
  opcoes: OpcaoEnquete[]
  alvo: AlvoEnquete
  alvoDetalhe?: string
  prazo: string
  anonima: boolean
  notificacaoAuto: boolean
  estado: EstadoEnquete
  respostas: RespostaEnquete[]
  totalFracoes: number
  imovel?: string
  criadoEm: string
}

interface Props {
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> }
  userRole: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const TIPOS_ENQUETE: Record<TipoEnquete, { label: string; emoji: string }> = {
  sim_nao:          { label: 'Sim / Não',        emoji: '✅' },
  escolha_multipla: { label: 'Escolha Múltipla', emoji: '📋' },
  escala_1_5:       { label: 'Escala 1-5',       emoji: '⭐' },
  texto_livre:      { label: 'Texto Livre',       emoji: '✏️' },
}

const ESTADO_CONFIG: Record<EstadoEnquete, { label: string; bg: string; color: string; dot: string }> = {
  ativa:      { label: 'Ativa',      bg: '#E6F4F2', color: '#1A7A6E', dot: '#1A7A6E' },
  a_decorrer: { label: 'A decorrer', bg: '#E8F0FE', color: '#1A56DB', dot: '#1A56DB' },
  encerrada:  { label: 'Encerrada',  bg: '#F0F0F0', color: '#6B7280', dot: '#6B7280' },
}

const TEMPLATES: { titulo: string; descricao: string; tipo: TipoEnquete; opcoes: string[] }[] = [
  {
    titulo: 'Horário de recolha de lixo',
    descricao: 'Qual o horário preferido para a recolha de lixo no condomínio?',
    tipo: 'escolha_multipla',
    opcoes: ['Manhã (7h-9h)', 'Tarde (14h-16h)', 'Noite (20h-22h)', 'Sem preferência'],
  },
  {
    titulo: 'Obra fachada — preferência de cor',
    descricao: 'Qual a cor preferida para a pintura da fachada do edifício?',
    tipo: 'escolha_multipla',
    opcoes: ['Branco clássico', 'Bege areia', 'Cinza claro', 'Amarelo pastel'],
  },
  {
    titulo: 'Satisfação serviço de limpeza',
    descricao: 'Como avalia o serviço de limpeza das áreas comuns?',
    tipo: 'escala_1_5',
    opcoes: [],
  },
  {
    titulo: 'Aprovação informal de obra',
    descricao: 'Concorda com a realização da obra proposta nas áreas comuns?',
    tipo: 'sim_nao',
    opcoes: [],
  },
]

const formatDate = (s: string) => {
  try {
    return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return s }
}

const diasRestantes = (prazo: string): number => {
  const diff = new Date(prazo).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

// ─── Demo data ───────────────────────────────────────────────────────────────

const gerarDemoData = (): Enquete[] => {
  const now = new Date()
  const daqui15 = new Date(now.getTime() + 15 * 86400000).toISOString().slice(0, 10)
  const daqui7 = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10)
  const daqui3 = new Date(now.getTime() + 3 * 86400000).toISOString().slice(0, 10)
  const ha30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
  const ha60 = new Date(now.getTime() - 60 * 86400000).toISOString().slice(0, 10)

  return [
    {
      id: 'enq-demo-1',
      titulo: 'Horário de recolha de lixo',
      descricao: 'Qual o horário preferido para a recolha de lixo no condomínio? Solicitamos a participação de todas as frações.',
      tipo: 'escolha_multipla',
      opcoes: [
        { id: 'o1', texto: 'Manhã (7h-9h)', votos: 8 },
        { id: 'o2', texto: 'Tarde (14h-16h)', votos: 3 },
        { id: 'o3', texto: 'Noite (20h-22h)', votos: 12 },
        { id: 'o4', texto: 'Sem preferência', votos: 2 },
      ],
      alvo: 'todos',
      prazo: daqui15,
      anonima: false,
      notificacaoAuto: true,
      estado: 'ativa',
      respostas: Array.from({ length: 25 }, (_, i) => ({
        fracaoId: `f${i}`, fracaoNome: `Fração ${String.fromCharCode(65 + (i % 26))}`,
        valor: ['Manhã (7h-9h)', 'Tarde (14h-16h)', 'Noite (20h-22h)', 'Sem preferência'][i % 4],
        dataResposta: new Date(Date.now() - i * 86400000).toISOString(),
      })),
      totalFracoes: 40,
      imovel: 'Edifício Marquês',
      criadoEm: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      id: 'enq-demo-2',
      titulo: 'Aprovação obra fachada',
      descricao: 'Concorda com a realização da obra de pintura da fachada prevista no orçamento de 2026?',
      tipo: 'sim_nao',
      opcoes: [
        { id: 'os1', texto: 'Sim', votos: 18 },
        { id: 'os2', texto: 'Não', votos: 7 },
      ],
      alvo: 'por_imovel',
      alvoDetalhe: 'Edifício Marquês',
      prazo: daqui7,
      anonima: false,
      notificacaoAuto: true,
      estado: 'a_decorrer',
      respostas: Array.from({ length: 25 }, (_, i) => ({
        fracaoId: `f${i}`, fracaoNome: `Fração ${String.fromCharCode(65 + (i % 26))}`,
        valor: i < 18 ? 'Sim' : 'Não',
        dataResposta: new Date(Date.now() - i * 43200000).toISOString(),
      })),
      totalFracoes: 32,
      imovel: 'Edifício Marquês',
      criadoEm: new Date(Date.now() - 10 * 86400000).toISOString(),
    },
    {
      id: 'enq-demo-3',
      titulo: 'Satisfação serviço limpeza',
      descricao: 'De 1 a 5, como avalia a qualidade do serviço de limpeza das áreas comuns no último trimestre?',
      tipo: 'escala_1_5',
      opcoes: [
        { id: 'oe1', texto: '1 - Muito Insatisfeito', votos: 1 },
        { id: 'oe2', texto: '2 - Insatisfeito', votos: 3 },
        { id: 'oe3', texto: '3 - Neutro', votos: 5 },
        { id: 'oe4', texto: '4 - Satisfeito', votos: 10 },
        { id: 'oe5', texto: '5 - Muito Satisfeito', votos: 6 },
      ],
      alvo: 'todos',
      prazo: daqui3,
      anonima: true,
      notificacaoAuto: true,
      estado: 'ativa',
      respostas: Array.from({ length: 25 }, (_, i) => ({
        fracaoId: `f${i}`, fracaoNome: `Fração ${String.fromCharCode(65 + (i % 26))}`,
        valor: String([1, 2, 3, 3, 4, 4, 4, 4, 5, 5][i % 10]),
        dataResposta: new Date(Date.now() - i * 21600000).toISOString(),
      })),
      totalFracoes: 40,
      imovel: 'Residência Boavista',
      criadoEm: new Date(Date.now() - 12 * 86400000).toISOString(),
    },
    {
      id: 'enq-demo-4',
      titulo: 'Preferência de cor — Pintura Hall',
      descricao: 'Escolha a cor preferida para a renovação do hall de entrada.',
      tipo: 'escolha_multipla',
      opcoes: [
        { id: 'oc1', texto: 'Branco pérola', votos: 15 },
        { id: 'oc2', texto: 'Cinza claro', votos: 10 },
        { id: 'oc3', texto: 'Bege areia', votos: 7 },
      ],
      alvo: 'por_imovel',
      alvoDetalhe: 'Residência Boavista',
      prazo: ha30,
      anonima: false,
      notificacaoAuto: true,
      estado: 'encerrada',
      respostas: Array.from({ length: 32 }, (_, i) => ({
        fracaoId: `f${i}`, fracaoNome: `Fração ${String.fromCharCode(65 + (i % 26))}`,
        valor: ['Branco pérola', 'Cinza claro', 'Bege areia'][i % 3],
        dataResposta: new Date(Date.now() - (30 + i) * 86400000).toISOString(),
      })),
      totalFracoes: 40,
      imovel: 'Residência Boavista',
      criadoEm: new Date(Date.now() - 60 * 86400000).toISOString(),
    },
    {
      id: 'enq-demo-5',
      titulo: 'Instalação de painéis solares',
      descricao: 'Concorda com a instalação de painéis solares no terraço do edifício, conforme orçamento apresentado em AG?',
      tipo: 'sim_nao',
      opcoes: [
        { id: 'op1', texto: 'Sim', votos: 28 },
        { id: 'op2', texto: 'Não', votos: 4 },
      ],
      alvo: 'todos',
      prazo: ha60,
      anonima: false,
      notificacaoAuto: true,
      estado: 'encerrada',
      respostas: Array.from({ length: 32 }, (_, i) => ({
        fracaoId: `f${i}`, fracaoNome: `Fração ${String.fromCharCode(65 + (i % 26))}`,
        valor: i < 28 ? 'Sim' : 'Não',
        dataResposta: new Date(Date.now() - (60 + i) * 86400000).toISOString(),
      })),
      totalFracoes: 40,
      imovel: 'Edifício Marquês',
      criadoEm: new Date(Date.now() - 90 * 86400000).toISOString(),
    },
  ]
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function EnquetesSection({ user, userRole }: Props) {
  // ── State
  const [enquetes, setEnquetes] = useState<Enquete[]>([])
  const [tab, setTab] = useState<'ativas' | 'historico' | 'criar'>('ativas')
  const [selectedEnquete, setSelectedEnquete] = useState<Enquete | null>(null)

  // ── Histórico filters
  const [filtroImovel, setFiltroImovel] = useState<string>('todos')
  const [filtroAno, setFiltroAno] = useState<string>('todos')

  // ── Form: Criar Enquete
  const [formTitulo, setFormTitulo] = useState('')
  const [formDescricao, setFormDescricao] = useState('')
  const [formTipo, setFormTipo] = useState<TipoEnquete>('sim_nao')
  const [formOpcoes, setFormOpcoes] = useState<string[]>(['', ''])
  const [formAlvo, setFormAlvo] = useState<AlvoEnquete>('todos')
  const [formAlvoDetalhe, setFormAlvoDetalhe] = useState('')
  const [formPrazo, setFormPrazo] = useState('')
  const [formAnonima, setFormAnonima] = useState(false)
  const [formNotificacao, setFormNotificacao] = useState(true)
  const [showPreview, setShowPreview] = useState(false)

  // ── Storage
  const STORAGE_KEY = `fixit_enquetes_${user.id}`

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEnquetes(parsed)
          return
        }
      }
    } catch { /* ignore */ }
    // Load demo data
    const demo = gerarDemoData()
    setEnquetes(demo)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
  }, [])

  useEffect(() => {
    if (enquetes.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(enquetes))
    }
  }, [enquetes])

  // ── Derived data
  const enquetesAtivas = useMemo(() =>
    enquetes.filter(e => e.estado === 'ativa' || e.estado === 'a_decorrer'),
    [enquetes]
  )

  const imoveisUnicos = useMemo(() => {
    const set = new Set(enquetes.map(e => e.imovel).filter(Boolean))
    return Array.from(set) as string[]
  }, [enquetes])

  const anosUnicos = useMemo(() => {
    const set = new Set(enquetes.map(e => new Date(e.criadoEm).getFullYear().toString()))
    return Array.from(set).sort().reverse()
  }, [enquetes])

  const enquetesHistorico = useMemo(() => {
    let list = enquetes.filter(e => e.estado === 'encerrada')
    if (filtroImovel !== 'todos') list = list.filter(e => e.imovel === filtroImovel)
    if (filtroAno !== 'todos') list = list.filter(e => new Date(e.criadoEm).getFullYear().toString() === filtroAno)
    return list
  }, [enquetes, filtroImovel, filtroAno])

  const participacaoMedia = useMemo(() => {
    const encerradas = enquetes.filter(e => e.estado === 'encerrada')
    if (encerradas.length === 0) return 0
    const total = encerradas.reduce((sum, e) => sum + (e.respostas.length / e.totalFracoes) * 100, 0)
    return Math.round(total / encerradas.length)
  }, [enquetes])

  // ── Actions
  const criarEnquete = () => {
    if (!formTitulo.trim() || !formPrazo) return

    let opcoes: OpcaoEnquete[] = []
    if (formTipo === 'sim_nao') {
      opcoes = [
        { id: crypto.randomUUID(), texto: 'Sim', votos: 0 },
        { id: crypto.randomUUID(), texto: 'Não', votos: 0 },
      ]
    } else if (formTipo === 'escolha_multipla') {
      opcoes = formOpcoes.filter(o => o.trim()).map(o => ({
        id: crypto.randomUUID(), texto: o.trim(), votos: 0,
      }))
      if (opcoes.length < 2) return
    } else if (formTipo === 'escala_1_5') {
      opcoes = [
        { id: crypto.randomUUID(), texto: '1 - Muito Insatisfeito', votos: 0 },
        { id: crypto.randomUUID(), texto: '2 - Insatisfeito', votos: 0 },
        { id: crypto.randomUUID(), texto: '3 - Neutro', votos: 0 },
        { id: crypto.randomUUID(), texto: '4 - Satisfeito', votos: 0 },
        { id: crypto.randomUUID(), texto: '5 - Muito Satisfeito', votos: 0 },
      ]
    }

    const nova: Enquete = {
      id: crypto.randomUUID(),
      titulo: formTitulo.trim(),
      descricao: formDescricao.trim(),
      tipo: formTipo,
      opcoes,
      alvo: formAlvo,
      alvoDetalhe: formAlvo !== 'todos' ? formAlvoDetalhe.trim() : undefined,
      prazo: formPrazo,
      anonima: formAnonima,
      notificacaoAuto: formNotificacao,
      estado: 'ativa',
      respostas: [],
      totalFracoes: 40,
      imovel: formAlvo === 'por_imovel' ? formAlvoDetalhe.trim() : undefined,
      criadoEm: new Date().toISOString(),
    }

    setEnquetes(prev => [nova, ...prev])
    resetForm()
    setShowPreview(false)
    setTab('ativas')
  }

  const resetForm = () => {
    setFormTitulo(''); setFormDescricao(''); setFormTipo('sim_nao')
    setFormOpcoes(['', '']); setFormAlvo('todos'); setFormAlvoDetalhe('')
    setFormPrazo(''); setFormAnonima(false); setFormNotificacao(true)
    setShowPreview(false)
  }

  const encerrarEnquete = (id: string) => {
    setEnquetes(prev => prev.map(e => e.id === id ? { ...e, estado: 'encerrada' as EstadoEnquete } : e))
    setSelectedEnquete(null)
  }

  const eliminarEnquete = (id: string) => {
    setEnquetes(prev => prev.filter(e => e.id !== id))
    setSelectedEnquete(null)
  }

  const aplicarTemplate = (tpl: typeof TEMPLATES[number]) => {
    setFormTitulo(tpl.titulo)
    setFormDescricao(tpl.descricao)
    setFormTipo(tpl.tipo)
    setFormOpcoes(tpl.opcoes.length > 0 ? tpl.opcoes : ['', ''])
  }

  const addOpcao = () => setFormOpcoes(prev => [...prev, ''])

  const removeOpcao = (idx: number) => {
    if (formOpcoes.length <= 2) return
    setFormOpcoes(prev => prev.filter((_, i) => i !== idx))
  }

  const updateOpcao = (idx: number, val: string) => {
    setFormOpcoes(prev => prev.map((o, i) => i === idx ? val : o))
  }

  // ── Styles
  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid var(--sd-border, #E4DDD0)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
  }

  const statCardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid var(--sd-border, #E4DDD0)',
    borderRadius: 12,
    padding: 16,
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

  const btnGold: React.CSSProperties = {
    background: 'var(--sd-gold, #C9A84C)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  }

  const btnOutline: React.CSSProperties = {
    background: 'transparent',
    color: 'var(--sd-ink-2, #4A5E78)',
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
    fontSize: 14,
    fontFamily: 'inherit',
    background: '#fff',
    color: 'var(--sd-navy, #0D1B2E)',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--sd-navy, #0D1B2E)',
    marginBottom: 6,
    display: 'block',
  }

  // ── Render helpers

  const renderBadge = (estado: EstadoEnquete) => {
    const cfg = ESTADO_CONFIG[estado]
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: cfg.bg, color: cfg.color,
        borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot }} />
        {cfg.label}
      </span>
    )
  }

  const renderProgressBar = (responded: number, total: number) => {
    const pct = total > 0 ? Math.round((responded / total) * 100) : 0
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 4 }}>
          <span>{responded}/{total} frações responderam</span>
          <span>{pct}%</span>
        </div>
        <div style={{ width: '100%', height: 8, background: 'var(--sd-cream, #F7F4EE)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`, height: '100%', borderRadius: 4,
            background: pct >= 75 ? '#1A7A6E' : pct >= 50 ? 'var(--sd-gold, #C9A84C)' : '#D4830A',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>
    )
  }

  const renderBarChart = (opcoes: OpcaoEnquete[]) => {
    const totalVotos = opcoes.reduce((sum, o) => sum + o.votos, 0)
    const maxVotos = Math.max(...opcoes.map(o => o.votos), 1)

    return (
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {opcoes.map(op => {
          const pct = totalVotos > 0 ? Math.round((op.votos / totalVotos) * 100) : 0
          const barWidth = maxVotos > 0 ? Math.round((op.votos / maxVotos) * 100) : 0
          return (
            <div key={op.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 4 }}>
                <span>{op.texto}</span>
                <span style={{ fontWeight: 600, color: 'var(--sd-ink-3, #8A9BB0)' }}>{op.votos} ({pct}%)</span>
              </div>
              <div style={{ width: '100%', height: 12, background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{
                  width: `${barWidth}%`, height: '100%', borderRadius: 6,
                  background: 'linear-gradient(90deg, var(--sd-navy, #0D1B2E), var(--sd-gold, #C9A84C))',
                  transition: 'width 0.3s ease',
                  minWidth: op.votos > 0 ? 4 : 0,
                }} />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderEnqueteCard = (enq: Enquete, showActions: boolean = true) => {
    const dias = diasRestantes(enq.prazo)
    return (
      <div key={enq.id} style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>{TIPOS_ENQUETE[enq.tipo].emoji}</span>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
                {enq.titulo}
              </h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', margin: '4px 0 8px', lineHeight: 1.5 }}>
              {enq.descricao}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
              {renderBadge(enq.estado)}
              <span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>
                {TIPOS_ENQUETE[enq.tipo].label}
              </span>
              {enq.imovel && (
                <span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>
                  🏢 {enq.imovel}
                </span>
              )}
              {enq.anonima && (
                <span style={{ background: '#F0F0F0', color: '#6B7280', borderRadius: 12, padding: '2px 8px', fontSize: 11 }}>
                  🔒 Anónima
                </span>
              )}
              {enq.estado !== 'encerrada' && (
                <span style={{
                  color: dias <= 3 ? '#C0392B' : dias <= 7 ? '#D4830A' : 'var(--sd-ink-3, #8A9BB0)',
                  fontWeight: dias <= 3 ? 600 : 400,
                }}>
                  ⏰ {dias > 0 ? `${dias} dias restantes` : 'Prazo expirado'}
                </span>
              )}
            </div>
          </div>
          {showActions && enq.estado !== 'encerrada' && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setSelectedEnquete(enq)} style={{ ...btnOutline, padding: '6px 12px', fontSize: 12 }}>
                Ver detalhes
              </button>
              <button onClick={() => encerrarEnquete(enq.id)} style={{ background: '#FDECEA', color: '#C0392B', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Encerrar
              </button>
            </div>
          )}
          {showActions && enq.estado === 'encerrada' && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setSelectedEnquete(enq)} style={{ ...btnOutline, padding: '6px 12px', fontSize: 12 }}>
                Ver resultados
              </button>
              <button onClick={() => eliminarEnquete(enq.id)} style={{ background: '#FDECEA', color: '#C0392B', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Eliminar
              </button>
            </div>
          )}
        </div>

        {renderProgressBar(enq.respostas.length, enq.totalFracoes)}
        {renderBarChart(enq.opcoes)}
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
            📊 Enquetes e Sondagens
          </h2>
          <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>
            Consulte a opinião dos condóminos de forma rápida e organizada
          </p>
        </div>
        <button onClick={() => { resetForm(); setTab('criar') }} style={btnPrimary}>
          + Nova Enquete
        </button>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { emoji: '📊', label: 'Enquetes Ativas', value: enquetesAtivas.length, color: '#1A7A6E' },
          { emoji: '📁', label: 'Histórico Total', value: enquetes.filter(e => e.estado === 'encerrada').length, color: 'var(--sd-navy, #0D1B2E)' },
          { emoji: '📈', label: 'Participação Média', value: `${participacaoMedia}%`, color: 'var(--sd-gold, #C9A84C)' },
          { emoji: '👥', label: 'Total Respostas', value: enquetes.reduce((s, e) => s + e.respostas.length, 0), color: '#1A56DB' },
        ].map((s, i) => (
          <div key={i} style={statCardStyle}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{s.emoji}</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid var(--sd-border, #E4DDD0)', paddingBottom: 12 }}>
        {[
          { key: 'ativas' as const, label: '📊 Enquetes Ativas', count: enquetesAtivas.length },
          { key: 'historico' as const, label: '📁 Histórico', count: enquetes.filter(e => e.estado === 'encerrada').length },
          { key: 'criar' as const, label: '✏️ Criar Enquete' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelectedEnquete(null) }}
            style={{
              background: tab === t.key ? 'var(--sd-navy, #0D1B2E)' : 'transparent',
              color: tab === t.key ? '#fff' : 'var(--sd-ink-2, #4A5E78)',
              border: tab === t.key ? 'none' : '1px solid var(--sd-border, #E4DDD0)',
              borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* ── Detail Modal ── */}
      {selectedEnquete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, maxWidth: 700, width: '100%',
            maxHeight: '85vh', overflow: 'auto', padding: 28,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
                  {TIPOS_ENQUETE[selectedEnquete.tipo].emoji} {selectedEnquete.titulo}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>{selectedEnquete.descricao}</p>
              </div>
              <button onClick={() => setSelectedEnquete(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#999' }}>
                ✕
              </button>
            </div>

            {/* Meta info */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              {renderBadge(selectedEnquete.estado)}
              <span style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>
                Tipo: {TIPOS_ENQUETE[selectedEnquete.tipo].label}
              </span>
              <span style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>
                Prazo: {formatDate(selectedEnquete.prazo)}
              </span>
              {selectedEnquete.anonima && (
                <span style={{ fontSize: 12, color: '#6B7280' }}>🔒 Anónima</span>
              )}
              {selectedEnquete.imovel && (
                <span style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>🏢 {selectedEnquete.imovel}</span>
              )}
            </div>

            {/* Participation */}
            {renderProgressBar(selectedEnquete.respostas.length, selectedEnquete.totalFracoes)}

            {/* Results chart */}
            <div style={{ marginTop: 20 }}>
              <h4 style={{ fontSize: 15, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 12px' }}>Resultados</h4>
              {renderBarChart(selectedEnquete.opcoes)}
            </div>

            {/* Respostas list (if not anonymous) */}
            {!selectedEnquete.anonima && selectedEnquete.respostas.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h4 style={{ fontSize: 15, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 12px' }}>
                  Respostas ({selectedEnquete.respostas.length})
                </h4>
                <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--sd-cream, #F7F4EE)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--sd-ink-3, #8A9BB0)', fontWeight: 600 }}>Fração</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--sd-ink-3, #8A9BB0)', fontWeight: 600 }}>Resposta</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--sd-ink-3, #8A9BB0)', fontWeight: 600 }}>Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEnquete.respostas.slice(0, 50).map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>
                          <td style={{ padding: '8px 12px', color: 'var(--sd-navy, #0D1B2E)' }}>{r.fracaoNome}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--sd-navy, #0D1B2E)', fontWeight: 500 }}>{r.valor}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--sd-ink-3, #8A9BB0)' }}>{formatDate(r.dataResposta)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              {selectedEnquete.estado !== 'encerrada' && (
                <button onClick={() => encerrarEnquete(selectedEnquete.id)} style={{ ...btnOutline, color: '#C0392B', borderColor: '#C0392B' }}>
                  Encerrar Enquete
                </button>
              )}
              <button onClick={() => setSelectedEnquete(null)} style={btnPrimary}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* ── Tab: Enquetes Ativas ── */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'ativas' && (
        <div>
          {enquetesAtivas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--sd-ink-3, #8A9BB0)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
              <p style={{ fontSize: 16, fontWeight: 600 }}>Nenhuma enquete ativa</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Crie uma nova enquete para consultar a opinião dos condóminos</p>
              <button onClick={() => { resetForm(); setTab('criar') }} style={{ ...btnPrimary, marginTop: 16 }}>
                + Criar Enquete
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {enquetesAtivas.map(enq => renderEnqueteCard(enq))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* ── Tab: Histórico ── */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'historico' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', fontWeight: 600 }}>Imóvel:</label>
              <select
                value={filtroImovel}
                onChange={e => setFiltroImovel(e.target.value)}
                style={{ ...inputStyle, width: 'auto', padding: '6px 12px', fontSize: 13 }}
              >
                <option value="todos">Todos</option>
                {imoveisUnicos.map(im => (
                  <option key={im} value={im}>{im}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', fontWeight: 600 }}>Ano:</label>
              <select
                value={filtroAno}
                onChange={e => setFiltroAno(e.target.value)}
                style={{ ...inputStyle, width: 'auto', padding: '6px 12px', fontSize: 13 }}
              >
                <option value="todos">Todos</option>
                {anosUnicos.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div style={{
              marginLeft: 'auto',
              background: 'var(--sd-cream, #F7F4EE)',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 13,
              color: 'var(--sd-navy, #0D1B2E)',
              fontWeight: 600,
            }}>
              📈 Participação média: {participacaoMedia}%
            </div>
          </div>

          {enquetesHistorico.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--sd-ink-3, #8A9BB0)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
              <p style={{ fontSize: 16, fontWeight: 600 }}>Nenhuma enquete encerrada</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>As enquetes encerradas aparecerão aqui</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {enquetesHistorico.map(enq => renderEnqueteCard(enq))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* ── Tab: Criar Enquete ── */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'criar' && (
        <div>
          {/* Templates */}
          <div style={{ ...cardStyle, marginBottom: 20 }}>
            <h4 style={{ fontSize: 15, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 12px' }}>📋 Templates rápidos</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {TEMPLATES.map((tpl, i) => (
                <button
                  key={i}
                  onClick={() => aplicarTemplate(tpl)}
                  style={{
                    background: 'var(--sd-cream, #F7F4EE)',
                    border: '1px solid var(--sd-border, #E4DDD0)',
                    borderRadius: 10,
                    padding: '12px 16px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--sd-gold, #C9A84C)' }}
                  onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--sd-border, #E4DDD0)' }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 4 }}>{tpl.titulo}</div>
                  <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>{TIPOS_ENQUETE[tpl.tipo].emoji} {TIPOS_ENQUETE[tpl.tipo].label}</div>
                </button>
              ))}
            </div>
          </div>

          {!showPreview ? (
            /* ── Form ── */
            <div style={cardStyle}>
              <h4 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 20px' }}>
                Criar Nova Enquete
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Título */}
                <div>
                  <label style={labelStyle}>Título *</label>
                  <input
                    type="text"
                    value={formTitulo}
                    onChange={e => setFormTitulo(e.target.value)}
                    placeholder="Ex.: Aprovação obra fachada"
                    style={inputStyle}
                  />
                </div>

                {/* Descrição */}
                <div>
                  <label style={labelStyle}>Descrição</label>
                  <textarea
                    value={formDescricao}
                    onChange={e => setFormDescricao(e.target.value)}
                    placeholder="Explique o contexto e objetivo desta enquete..."
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>

                {/* Tipo */}
                <div>
                  <label style={labelStyle}>Tipo de enquete *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                    {(Object.entries(TIPOS_ENQUETE) as [TipoEnquete, { label: string; emoji: string }][]).map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => setFormTipo(key)}
                        style={{
                          background: formTipo === key ? 'var(--sd-navy, #0D1B2E)' : 'var(--sd-cream, #F7F4EE)',
                          color: formTipo === key ? '#fff' : 'var(--sd-navy, #0D1B2E)',
                          border: formTipo === key ? '2px solid var(--sd-navy, #0D1B2E)' : '1px solid var(--sd-border, #E4DDD0)',
                          borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        {cfg.emoji} {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opções (for escolha_multipla) */}
                {formTipo === 'escolha_multipla' && (
                  <div>
                    <label style={labelStyle}>Opções de resposta *</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {formOpcoes.map((op, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', minWidth: 24, fontWeight: 600 }}>{idx + 1}.</span>
                          <input
                            type="text"
                            value={op}
                            onChange={e => updateOpcao(idx, e.target.value)}
                            placeholder={`Opção ${idx + 1}`}
                            style={{ ...inputStyle, flex: 1 }}
                          />
                          {formOpcoes.length > 2 && (
                            <button onClick={() => removeOpcao(idx)} style={{ background: '#FDECEA', color: '#C0392B', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      <button onClick={addOpcao} style={{ ...btnOutline, alignSelf: 'flex-start', padding: '6px 14px', fontSize: 12 }}>
                        + Adicionar opção
                      </button>
                    </div>
                  </div>
                )}

                {/* Alvo */}
                <div>
                  <label style={labelStyle}>Destinatários</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      { key: 'todos' as AlvoEnquete, label: '👥 Todos os condóminos' },
                      { key: 'por_imovel' as AlvoEnquete, label: '🏢 Por imóvel' },
                      { key: 'por_bloco' as AlvoEnquete, label: '🏗️ Por bloco' },
                    ].map(a => (
                      <button
                        key={a.key}
                        onClick={() => setFormAlvo(a.key)}
                        style={{
                          background: formAlvo === a.key ? 'var(--sd-navy, #0D1B2E)' : 'var(--sd-cream, #F7F4EE)',
                          color: formAlvo === a.key ? '#fff' : 'var(--sd-navy, #0D1B2E)',
                          border: formAlvo === a.key ? 'none' : '1px solid var(--sd-border, #E4DDD0)',
                          borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                  {formAlvo !== 'todos' && (
                    <input
                      type="text"
                      value={formAlvoDetalhe}
                      onChange={e => setFormAlvoDetalhe(e.target.value)}
                      placeholder={formAlvo === 'por_imovel' ? 'Nome do imóvel' : 'Nome do bloco'}
                      style={{ ...inputStyle, marginTop: 8 }}
                    />
                  )}
                </div>

                {/* Prazo */}
                <div>
                  <label style={labelStyle}>Prazo *</label>
                  <input
                    type="date"
                    value={formPrazo}
                    onChange={e => setFormPrazo(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    style={{ ...inputStyle, maxWidth: 250 }}
                  />
                </div>

                {/* Toggles */}
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--sd-navy, #0D1B2E)', cursor: 'pointer' }}>
                    <div
                      onClick={() => setFormAnonima(!formAnonima)}
                      style={{
                        width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                        background: formAnonima ? 'var(--sd-gold, #C9A84C)' : '#D1D5DB',
                        position: 'relative', transition: 'background 0.2s ease',
                      }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', background: '#fff',
                        position: 'absolute', top: 2,
                        left: formAnonima ? 22 : 2,
                        transition: 'left 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                      }} />
                    </div>
                    🔒 Enquete anónima
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--sd-navy, #0D1B2E)', cursor: 'pointer' }}>
                    <div
                      onClick={() => setFormNotificacao(!formNotificacao)}
                      style={{
                        width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                        background: formNotificacao ? 'var(--sd-gold, #C9A84C)' : '#D1D5DB',
                        position: 'relative', transition: 'background 0.2s ease',
                      }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', background: '#fff',
                        position: 'absolute', top: 2,
                        left: formNotificacao ? 22 : 2,
                        transition: 'left 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                      }} />
                    </div>
                    🔔 Notificação automática
                  </label>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => {
                      if (!formTitulo.trim() || !formPrazo) return
                      if (formTipo === 'escolha_multipla' && formOpcoes.filter(o => o.trim()).length < 2) return
                      setShowPreview(true)
                    }}
                    style={btnGold}
                  >
                    👁️ Pré-visualizar
                  </button>
                  <button onClick={criarEnquete} style={btnPrimary}>
                    Publicar Enquete
                  </button>
                  <button onClick={resetForm} style={btnOutline}>
                    Limpar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ── Preview ── */
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h4 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
                  👁️ Pré-visualização
                </h4>
                <button onClick={() => setShowPreview(false)} style={btnOutline}>
                  ← Voltar ao formulário
                </button>
              </div>

              <div style={{
                border: '2px dashed var(--sd-gold, #C9A84C)',
                borderRadius: 12,
                padding: 20,
                background: 'var(--sd-cream, #F7F4EE)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{TIPOS_ENQUETE[formTipo].emoji}</span>
                  <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
                    {formTitulo || 'Sem título'}
                  </h3>
                </div>
                {formDescricao && (
                  <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 12, lineHeight: 1.5 }}>
                    {formDescricao}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, fontSize: 12 }}>
                  {renderBadge('ativa')}
                  <span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>{TIPOS_ENQUETE[formTipo].label}</span>
                  <span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>⏰ Prazo: {formPrazo ? formatDate(formPrazo) : '—'}</span>
                  {formAlvo !== 'todos' && formAlvoDetalhe && (
                    <span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>🏢 {formAlvoDetalhe}</span>
                  )}
                  {formAnonima && <span style={{ color: '#6B7280' }}>🔒 Anónima</span>}
                  {formNotificacao && <span style={{ color: '#6B7280' }}>🔔 Notificação auto.</span>}
                </div>

                {/* Preview da resposta conforme tipo */}
                <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 12 }}>
                    Vista do condómino:
                  </div>
                  {formTipo === 'sim_nao' && (
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ flex: 1, background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8, padding: 16, textAlign: 'center', border: '2px solid transparent', cursor: 'pointer' }}>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>👍</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>Sim</div>
                      </div>
                      <div style={{ flex: 1, background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8, padding: 16, textAlign: 'center', border: '2px solid transparent', cursor: 'pointer' }}>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>👎</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>Não</div>
                      </div>
                    </div>
                  )}
                  {formTipo === 'escolha_multipla' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {formOpcoes.filter(o => o.trim()).map((op, idx) => (
                        <div key={idx} style={{
                          background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8, padding: '10px 14px',
                          border: '2px solid transparent', cursor: 'pointer', fontSize: 14,
                          color: 'var(--sd-navy, #0D1B2E)',
                        }}>
                          ○ {op}
                        </div>
                      ))}
                    </div>
                  )}
                  {formTipo === 'escala_1_5' && (
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <div key={n} style={{
                          width: 48, height: 48, borderRadius: '50%',
                          background: 'var(--sd-cream, #F7F4EE)',
                          border: '2px solid transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)',
                          cursor: 'pointer',
                        }}>
                          {n}
                        </div>
                      ))}
                    </div>
                  )}
                  {formTipo === 'texto_livre' && (
                    <textarea
                      disabled
                      placeholder="Escreva a sua resposta..."
                      rows={3}
                      style={{ ...inputStyle, background: 'var(--sd-cream, #F7F4EE)', resize: 'none', opacity: 0.7 }}
                    />
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowPreview(false)} style={btnOutline}>
                  ← Editar
                </button>
                <button onClick={criarEnquete} style={btnPrimary}>
                  Publicar Enquete
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
