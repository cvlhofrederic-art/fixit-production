'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Prioridade = 'urgente' | 'alta' | 'media' | 'baixa'
type Estado = 'aberto' | 'em_analise' | 'artesao_contactado' | 'em_reparacao' | 'resolvido' | 'fechado'
type Categoria = 'infiltracao' | 'elevador' | 'eletricidade' | 'canalizacao' | 'espacos_comuns' | 'ruido' | 'limpeza' | 'outro'
type Zona = 'garagem' | 'escadas' | 'cobertura' | 'fachada' | 'cave' | 'hall' | 'elevador' | 'jardim' | 'piscina' | 'sala_condominio' | 'outro'

interface TimelineEvent {
  id: string
  data: string
  autor: string
  tipo: 'estado' | 'comentario' | 'foto'
  conteudo: string
}

interface Ocorrencia {
  id: string
  titulo: string
  descricao: string
  categoria: Categoria
  prioridade: Prioridade
  reportadoPor: string
  fracao: string
  imovel: string
  data: string
  estado: Estado
  artesaoAtribuido: string
  localizacaoEdificio: string
  fotos: string[]
  timeline: TimelineEvent[]
  zona: Zona
}

interface QRCode {
  id: string
  zona: Zona
  equipamento: string
  dataCriacao: string
  codigo: string
}

interface Props {
  user: any
  userRole: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const CATEGORIAS: Record<Categoria, { emoji: string; label: string }> = {
  infiltracao:    { emoji: '💧', label: 'Infiltração' },
  elevador:       { emoji: '🛗', label: 'Elevador' },
  eletricidade:   { emoji: '⚡', label: 'Eletricidade' },
  canalizacao:    { emoji: '🔧', label: 'Canalização' },
  espacos_comuns: { emoji: '🏢', label: 'Espaços comuns' },
  ruido:          { emoji: '🔊', label: 'Ruído' },
  limpeza:        { emoji: '🧹', label: 'Limpeza' },
  outro:          { emoji: '📋', label: 'Outro' },
}

const PRIORIDADES: Record<Prioridade, { label: string; color: string; bg: string; dot: string }> = {
  urgente: { label: 'Urgente', color: '#C0392B', bg: '#FDECEA', dot: '#C0392B' },
  alta:    { label: 'Alta',    color: '#D4830A', bg: '#FEF5E4', dot: '#D4830A' },
  media:   { label: 'Média',   color: '#B7950B', bg: '#FEF9E7', dot: '#B7950B' },
  baixa:   { label: 'Baixa',   color: '#1A7A6E', bg: '#E6F4F2', dot: '#1A7A6E' },
}

const ESTADOS: Record<Estado, { label: string; icon: string; color: string; bg: string }> = {
  aberto:              { label: 'Aberto',              icon: '📣', color: '#C0392B', bg: '#FDECEA' },
  em_analise:          { label: 'Em análise',          icon: '🔍', color: '#6C5CE7', bg: '#EDE8FF' },
  artesao_contactado:  { label: 'Artesão contactado',  icon: '📞', color: '#D4830A', bg: '#FEF5E4' },
  em_reparacao:        { label: 'Em reparação',        icon: '🔨', color: '#2980B9', bg: '#EBF5FB' },
  resolvido:           { label: 'Resolvido',           icon: '✅', color: '#1A7A6E', bg: '#E6F4F2' },
  fechado:             { label: 'Fechado',             icon: '🔒', color: '#8A9BB0', bg: '#F0EDEA' },
}

const PIPELINE_ESTADOS: Estado[] = ['aberto', 'em_analise', 'artesao_contactado', 'em_reparacao', 'resolvido', 'fechado']

const ZONAS: Record<Zona, { emoji: string; label: string }> = {
  garagem:          { emoji: '🅿️', label: 'Garagem' },
  escadas:          { emoji: '🪜', label: 'Escadas' },
  cobertura:        { emoji: '🏠', label: 'Cobertura' },
  fachada:          { emoji: '🧱', label: 'Fachada' },
  cave:             { emoji: '🔦', label: 'Cave' },
  hall:             { emoji: '🚪', label: 'Hall de entrada' },
  elevador:         { emoji: '🛗', label: 'Elevador' },
  jardim:           { emoji: '🌳', label: 'Jardim' },
  piscina:          { emoji: '🏊', label: 'Piscina' },
  sala_condominio:  { emoji: '🪑', label: 'Sala do condomínio' },
  outro:            { emoji: '📍', label: 'Outro' },
}

const SLA_TARGET_DAYS: Record<Prioridade, number> = {
  urgente: 1,
  alta: 3,
  media: 7,
  baixa: 14,
}

// ─── Formatação ──────────────────────────────────────────────────────────────

const formatDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return s }
}

const formatDateTime = (s: string) => {
  try {
    const d = new Date(s)
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) + ' ' +
           d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
  } catch { return s }
}

const diasDesde = (s: string) => {
  const diff = Date.now() - new Date(s).getTime()
  return Math.floor(diff / 86400000)
}

// ─── Demo data ───────────────────────────────────────────────────────────────

const generateDemoData = (): Ocorrencia[] => {
  const now = new Date()
  const d = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400000).toISOString()

  return [
    {
      id: 'OC-001', titulo: 'Infiltração no teto da garagem B2',
      descricao: 'Mancha de humidade crescente no teto da garagem, nível B2, junto ao pilar 4. Pingos de água quando chove forte.',
      categoria: 'infiltracao', prioridade: 'urgente',
      reportadoPor: 'Ana Silva', fracao: '3.º Esq', imovel: 'Edifício Aurora',
      data: d(2), estado: 'em_reparacao', artesaoAtribuido: 'José Ferreira — Impermeabilização',
      localizacaoEdificio: 'Garagem B2, junto ao pilar 4', fotos: [],
      zona: 'garagem',
      timeline: [
        { id: '1', data: d(2), autor: 'Ana Silva', tipo: 'estado', conteudo: 'Ocorrência registada — Infiltração detetada' },
        { id: '2', data: d(1.5), autor: 'Gestor', tipo: 'estado', conteudo: 'Estado → Em análise' },
        { id: '3', data: d(1), autor: 'Gestor', tipo: 'estado', conteudo: 'Artesão contactado — José Ferreira' },
        { id: '4', data: d(0.5), autor: 'José Ferreira', tipo: 'comentario', conteudo: 'Visita agendada para amanhã às 9h. Provável problema na impermeabilização da cobertura.' },
      ],
    },
    {
      id: 'OC-002', titulo: 'Elevador bloqueia no 4.º andar',
      descricao: 'O elevador para frequentemente no 4.º andar e as portas não abrem. Necessário reiniciar pelo quadro elétrico.',
      categoria: 'elevador', prioridade: 'alta',
      reportadoPor: 'Manuel Costa', fracao: '4.º Dto', imovel: 'Edifício Aurora',
      data: d(5), estado: 'artesao_contactado', artesaoAtribuido: 'Ascensores Lisboeta',
      localizacaoEdificio: 'Elevador principal, 4.º andar', fotos: [],
      zona: 'elevador',
      timeline: [
        { id: '1', data: d(5), autor: 'Manuel Costa', tipo: 'estado', conteudo: 'Ocorrência registada' },
        { id: '2', data: d(4), autor: 'Gestor', tipo: 'estado', conteudo: 'Estado → Em análise' },
        { id: '3', data: d(3), autor: 'Gestor', tipo: 'estado', conteudo: 'Artesão contactado — Ascensores Lisboeta' },
      ],
    },
    {
      id: 'OC-003', titulo: 'Curto-circuito na iluminação do hall',
      descricao: 'Luzes do hall de entrada fazem curto-circuito. Disjuntor dispara várias vezes ao dia.',
      categoria: 'eletricidade', prioridade: 'alta',
      reportadoPor: 'Maria Lopes', fracao: '1.º Esq', imovel: 'Edifício Bela Vista',
      data: d(3), estado: 'em_analise', artesaoAtribuido: '',
      localizacaoEdificio: 'Hall de entrada, quadro elétrico geral', fotos: [],
      zona: 'hall',
      timeline: [
        { id: '1', data: d(3), autor: 'Maria Lopes', tipo: 'estado', conteudo: 'Ocorrência registada' },
        { id: '2', data: d(2), autor: 'Gestor', tipo: 'estado', conteudo: 'Estado → Em análise. A verificar disponibilidade de eletricista.' },
      ],
    },
    {
      id: 'OC-004', titulo: 'Fuga de água na canalização do R/C',
      descricao: 'Fuga visível na canalização principal do rés-do-chão, junto à entrada da garagem. Mancha no chão.',
      categoria: 'canalizacao', prioridade: 'urgente',
      reportadoPor: 'Pedro Santos', fracao: 'R/C Dto', imovel: 'Edifício Aurora',
      data: d(1), estado: 'aberto', artesaoAtribuido: '',
      localizacaoEdificio: 'Rés-do-chão, junto à entrada da garagem', fotos: [],
      zona: 'escadas',
      timeline: [
        { id: '1', data: d(1), autor: 'Pedro Santos', tipo: 'estado', conteudo: 'Ocorrência registada — Fuga de água detetada' },
      ],
    },
    {
      id: 'OC-005', titulo: 'Grafiti na fachada norte',
      descricao: 'Grafiti extenso pintado na fachada norte do edifício durante a noite. Tinta spray preta.',
      categoria: 'espacos_comuns', prioridade: 'media',
      reportadoPor: 'Carla Martins', fracao: '2.º Dto', imovel: 'Edifício Bela Vista',
      data: d(10), estado: 'resolvido', artesaoAtribuido: 'CleanWall Lda',
      localizacaoEdificio: 'Fachada norte, nível da rua', fotos: [],
      zona: 'fachada',
      timeline: [
        { id: '1', data: d(10), autor: 'Carla Martins', tipo: 'estado', conteudo: 'Ocorrência registada' },
        { id: '2', data: d(9), autor: 'Gestor', tipo: 'estado', conteudo: 'Estado → Em análise' },
        { id: '3', data: d(7), autor: 'Gestor', tipo: 'estado', conteudo: 'Artesão contactado — CleanWall Lda' },
        { id: '4', data: d(4), autor: 'CleanWall Lda', tipo: 'estado', conteudo: 'Estado → Em reparação. Limpeza de fachada agendada.' },
        { id: '5', data: d(2), autor: 'Gestor', tipo: 'estado', conteudo: 'Estado → Resolvido. Fachada limpa com sucesso.' },
      ],
    },
    {
      id: 'OC-006', titulo: 'Ruído excessivo — obras no 5.º Esq',
      descricao: 'Obras ruidosas no apartamento do 5.º Esq fora do horário permitido (após as 20h). Várias reclamações.',
      categoria: 'ruido', prioridade: 'media',
      reportadoPor: 'João Oliveira', fracao: '5.º Dto', imovel: 'Edifício Aurora',
      data: d(8), estado: 'fechado', artesaoAtribuido: '',
      localizacaoEdificio: '5.º Esq', fotos: [],
      zona: 'outro',
      timeline: [
        { id: '1', data: d(8), autor: 'João Oliveira', tipo: 'estado', conteudo: 'Ocorrência registada' },
        { id: '2', data: d(7), autor: 'Gestor', tipo: 'comentario', conteudo: 'Carta de aviso enviada ao condómino do 5.º Esq' },
        { id: '3', data: d(4), autor: 'Gestor', tipo: 'estado', conteudo: 'Estado → Resolvido. Condómino comprometeu-se a respeitar horários.' },
        { id: '4', data: d(2), autor: 'Gestor', tipo: 'estado', conteudo: 'Estado → Fechado.' },
      ],
    },
    {
      id: 'OC-007', titulo: 'Lâmpadas fundidas nas escadas (2.º ao 4.º)',
      descricao: 'Três lâmpadas fundidas nas escadas entre o 2.º e o 4.º andar. Escadas escuras à noite.',
      categoria: 'limpeza', prioridade: 'baixa',
      reportadoPor: 'Teresa Nunes', fracao: '3.º Dto', imovel: 'Edifício Bela Vista',
      data: d(6), estado: 'resolvido', artesaoAtribuido: '',
      localizacaoEdificio: 'Escadas, pisos 2 a 4', fotos: [],
      zona: 'escadas',
      timeline: [
        { id: '1', data: d(6), autor: 'Teresa Nunes', tipo: 'estado', conteudo: 'Ocorrência registada' },
        { id: '2', data: d(4), autor: 'Gestor', tipo: 'estado', conteudo: 'Lâmpadas substituídas pelo zelador.' },
        { id: '3', data: d(4), autor: 'Gestor', tipo: 'estado', conteudo: 'Estado → Resolvido.' },
      ],
    },
    {
      id: 'OC-008', titulo: 'Porta da garagem não fecha automaticamente',
      descricao: 'O motor da porta automática da garagem não funciona. Porta permanece aberta, risco de segurança.',
      categoria: 'espacos_comuns', prioridade: 'alta',
      reportadoPor: 'Rui Almeida', fracao: '1.º Dto', imovel: 'Edifício Aurora',
      data: d(0), estado: 'aberto', artesaoAtribuido: '',
      localizacaoEdificio: 'Entrada da garagem', fotos: [],
      zona: 'garagem',
      timeline: [
        { id: '1', data: d(0), autor: 'Rui Almeida', tipo: 'estado', conteudo: 'Ocorrência registada — Motor da porta avariado' },
      ],
    },
  ]
}

const generateDemoQRCodes = (): QRCode[] => [
  { id: 'QR-001', zona: 'garagem',  equipamento: 'Porta automática', dataCriacao: '2025-11-15', codigo: 'FIXIT-GAR-001' },
  { id: 'QR-002', zona: 'elevador', equipamento: 'Elevador principal', dataCriacao: '2025-11-15', codigo: 'FIXIT-ELV-001' },
  { id: 'QR-003', zona: 'hall',     equipamento: 'Quadro elétrico geral', dataCriacao: '2025-12-01', codigo: 'FIXIT-HAL-001' },
  { id: 'QR-004', zona: 'cobertura', equipamento: 'Sistema de impermeabilização', dataCriacao: '2025-12-10', codigo: 'FIXIT-COB-001' },
]

// ─── Componente principal ────────────────────────────────────────────────────

export default function OcorrenciasSection({ user, userRole }: Props) {
  const uid = user?.id || 'demo'
  const STORAGE_KEY = `fixit_ocorrencias_${uid}`
  const STORAGE_KEY_QR = `fixit_ocorrencias_qr_${uid}`

  // ── State ──────────────────────────────────────────────────────────────────

  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [qrCodes, setQRCodes] = useState<QRCode[]>([])
  const [tab, setTab] = useState<'painel' | 'ocorrencias' | 'mapa' | 'qrcodes'>('painel')
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<Ocorrencia | null>(null)
  const [commentInput, setCommentInput] = useState('')
  const [showQRModal, setShowQRModal] = useState(false)

  // Filters
  const [filtroEstado, setFiltroEstado] = useState<Estado | ''>('')
  const [filtroPrioridade, setFiltroPrioridade] = useState<Prioridade | ''>('')
  const [filtroCategoria, setFiltroCategoria] = useState<Categoria | ''>('')
  const [filtroImovel, setFiltroImovel] = useState('')

  // Form
  const [formTitulo, setFormTitulo] = useState('')
  const [formDescricao, setFormDescricao] = useState('')
  const [formCategoria, setFormCategoria] = useState<Categoria>('infiltracao')
  const [formPrioridade, setFormPrioridade] = useState<Prioridade>('media')
  const [formImovel, setFormImovel] = useState('')
  const [formFracao, setFormFracao] = useState('')
  const [formLocalizacao, setFormLocalizacao] = useState('')
  const [formZona, setFormZona] = useState<Zona>('outro')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // QR Form
  const [qrZona, setQrZona] = useState<Zona>('garagem')
  const [qrEquipamento, setQrEquipamento] = useState('')

  // ── Persistência ───────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setOcorrencias(JSON.parse(stored))
      } else {
        const demo = generateDemoData()
        setOcorrencias(demo)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
      }
    } catch {
      setOcorrencias(generateDemoData())
    }
    try {
      const storedQR = localStorage.getItem(STORAGE_KEY_QR)
      if (storedQR) {
        setQRCodes(JSON.parse(storedQR))
      } else {
        const demoQR = generateDemoQRCodes()
        setQRCodes(demoQR)
        localStorage.setItem(STORAGE_KEY_QR, JSON.stringify(demoQR))
      }
    } catch {
      setQRCodes(generateDemoQRCodes())
    }
  }, [])

  const save = useCallback((updated: Ocorrencia[]) => {
    setOcorrencias(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }, [STORAGE_KEY])

  const saveQR = useCallback((updated: QRCode[]) => {
    setQRCodes(updated)
    localStorage.setItem(STORAGE_KEY_QR, JSON.stringify(updated))
  }, [STORAGE_KEY_QR])

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = ocorrencias.length
    const abertas = ocorrencias.filter(o => o.estado === 'aberto').length
    const emCurso = ocorrencias.filter(o => ['em_analise', 'artesao_contactado', 'em_reparacao'].includes(o.estado)).length
    const resolvidas = ocorrencias.filter(o => o.estado === 'resolvido' || o.estado === 'fechado').length

    // Tempo médio de resolução (em dias)
    const resolved = ocorrencias.filter(o => o.estado === 'resolvido' || o.estado === 'fechado')
    let tempoMedioResolucao = 0
    if (resolved.length > 0) {
      const totalDias = resolved.reduce((sum, o) => {
        const lastEvent = o.timeline[o.timeline.length - 1]
        if (lastEvent) {
          return sum + Math.max(1, Math.ceil((new Date(lastEvent.data).getTime() - new Date(o.data).getTime()) / 86400000))
        }
        return sum + 1
      }, 0)
      tempoMedioResolucao = Math.round(totalDias / resolved.length)
    }

    // Prioridades
    const porPrioridade: Record<Prioridade, number> = {
      urgente: ocorrencias.filter(o => o.prioridade === 'urgente' && o.estado !== 'fechado').length,
      alta: ocorrencias.filter(o => o.prioridade === 'alta' && o.estado !== 'fechado').length,
      media: ocorrencias.filter(o => o.prioridade === 'media' && o.estado !== 'fechado').length,
      baixa: ocorrencias.filter(o => o.prioridade === 'baixa' && o.estado !== 'fechado').length,
    }

    // SLA compliance
    let slaTotal = 0
    let slaMet = 0
    resolved.forEach(o => {
      const target = SLA_TARGET_DAYS[o.prioridade]
      const lastEvent = o.timeline[o.timeline.length - 1]
      if (lastEvent) {
        const resolvedIn = Math.ceil((new Date(lastEvent.data).getTime() - new Date(o.data).getTime()) / 86400000)
        slaTotal++
        if (resolvedIn <= target) slaMet++
      }
    })
    const slaPercent = slaTotal > 0 ? Math.round((slaMet / slaTotal) * 100) : 100

    // Zonas
    const porZona: Record<string, number> = {}
    ocorrencias.forEach(o => {
      porZona[o.zona] = (porZona[o.zona] || 0) + 1
    })

    return { total, abertas, emCurso, resolvidas, tempoMedioResolucao, porPrioridade, slaPercent, porZona }
  }, [ocorrencias])

  // ── Filtered list ──────────────────────────────────────────────────────────

  const imoveis = useMemo(() => [...new Set(ocorrencias.map(o => o.imovel))].sort(), [ocorrencias])

  const filtered = useMemo(() => {
    let list = [...ocorrencias]
    if (filtroEstado) list = list.filter(o => o.estado === filtroEstado)
    if (filtroPrioridade) list = list.filter(o => o.prioridade === filtroPrioridade)
    if (filtroCategoria) list = list.filter(o => o.categoria === filtroCategoria)
    if (filtroImovel) list = list.filter(o => o.imovel === filtroImovel)
    return list.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  }, [ocorrencias, filtroEstado, filtroPrioridade, filtroCategoria, filtroImovel])

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleRegistar = () => {
    if (!formTitulo.trim()) return
    const now = new Date().toISOString()
    const newOc: Ocorrencia = {
      id: `OC-${String(ocorrencias.length + 1).padStart(3, '0')}`,
      titulo: formTitulo.trim(),
      descricao: formDescricao.trim(),
      categoria: formCategoria,
      prioridade: formPrioridade,
      reportadoPor: user?.user_metadata?.full_name || user?.email || 'Gestor',
      fracao: formFracao.trim(),
      imovel: formImovel.trim() || 'Sem imóvel',
      data: now,
      estado: 'aberto',
      artesaoAtribuido: '',
      localizacaoEdificio: formLocalizacao.trim(),
      fotos: [],
      zona: formZona,
      timeline: [
        { id: '1', data: now, autor: 'Sistema', tipo: 'estado', conteudo: `Ocorrência registada — ${CATEGORIAS[formCategoria].label}` },
      ],
    }
    save([newOc, ...ocorrencias])
    resetForm()
    setShowModal(false)
  }

  const resetForm = () => {
    setFormTitulo('')
    setFormDescricao('')
    setFormCategoria('infiltracao')
    setFormPrioridade('media')
    setFormImovel('')
    setFormFracao('')
    setFormLocalizacao('')
    setFormZona('outro')
  }

  const advanceEstado = (id: string, novoEstado: Estado) => {
    const now = new Date().toISOString()
    const label = ESTADOS[novoEstado].label
    const updated = ocorrencias.map(o => o.id === id ? {
      ...o, estado: novoEstado,
      timeline: [...o.timeline, { id: Date.now().toString(), data: now, autor: 'Gestor', tipo: 'estado' as const, conteudo: `Estado → ${label}` }],
    } : o)
    save(updated)
    if (selected?.id === id) setSelected(updated.find(o => o.id === id) || null)
  }

  const addComment = (id: string) => {
    if (!commentInput.trim()) return
    const now = new Date().toISOString()
    const updated = ocorrencias.map(o => o.id === id ? {
      ...o, timeline: [...o.timeline, { id: Date.now().toString(), data: now, autor: 'Gestor', tipo: 'comentario' as const, conteudo: commentInput.trim() }],
    } : o)
    save(updated)
    if (selected?.id === id) setSelected(updated.find(o => o.id === id) || null)
    setCommentInput('')
  }

  const assignArtesao = (id: string, artesao: string) => {
    const now = new Date().toISOString()
    const updated = ocorrencias.map(o => o.id === id ? {
      ...o, artesaoAtribuido: artesao, estado: 'artesao_contactado' as Estado,
      timeline: [...o.timeline,
        { id: Date.now().toString(), data: now, autor: 'Gestor', tipo: 'estado' as const, conteudo: `Artesão atribuído: ${artesao}` },
      ],
    } : o)
    save(updated)
    if (selected?.id === id) setSelected(updated.find(o => o.id === id) || null)
  }

  const handleGerarQR = () => {
    if (!qrEquipamento.trim()) return
    const newQR: QRCode = {
      id: `QR-${String(qrCodes.length + 1).padStart(3, '0')}`,
      zona: qrZona,
      equipamento: qrEquipamento.trim(),
      dataCriacao: new Date().toISOString().split('T')[0],
      codigo: `FIXIT-${qrZona.slice(0, 3).toUpperCase()}-${String(qrCodes.length + 1).padStart(3, '0')}`,
    }
    saveQR([...qrCodes, newQR])
    setQrEquipamento('')
    setShowQRModal(false)
  }

  const deleteOcorrencia = (id: string) => {
    save(ocorrencias.filter(o => o.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  // ── Estilos partilhados ────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    background: '#fff', border: '1px solid var(--sd-border,#E4DDD0)',
    borderRadius: 12, padding: 20,
  }

  const btnPrimary: React.CSSProperties = {
    background: 'var(--sd-navy,#0D1B2E)', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 20px', fontWeight: 600, fontSize: 13,
    cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
  }

  const btnSecondary: React.CSSProperties = {
    background: 'var(--sd-cream,#F7F4EE)', color: 'var(--sd-navy,#0D1B2E)',
    border: '1px solid var(--sd-border,#E4DDD0)', borderRadius: 8,
    padding: '8px 16px', fontWeight: 500, fontSize: 13,
    cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--sd-border,#E4DDD0)', fontSize: 14,
    fontFamily: "'Outfit',sans-serif", background: '#fff',
    color: 'var(--sd-navy,#0D1B2E)',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-2,#4A5E78)',
    marginBottom: 4, display: 'block',
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(13,27,46,0.35)',
    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
  }

  const modalStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560,
    maxHeight: '90vh', overflow: 'auto', padding: 28,
    boxShadow: '0 20px 60px rgba(13,27,46,0.2)',
  }

  // ─── Tab navigation ────────────────────────────────────────────────────────

  const TABS: { key: typeof tab; label: string; icon: string }[] = [
    { key: 'painel',      label: 'Painel',       icon: '📊' },
    { key: 'ocorrencias', label: 'Ocorrências',  icon: '📋' },
    { key: 'mapa',        label: 'Mapa',         icon: '🗺️' },
    { key: 'qrcodes',     label: 'QR Codes',     icon: '📱' },
  ]

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Outfit',sans-serif", color: 'var(--sd-navy,#0D1B2E)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 700, margin: 0, color: 'var(--sd-navy,#0D1B2E)' }}>
            Ocorrências e Manutenção
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--sd-ink-3,#8A9BB0)' }}>
            Gestão de incidentes, manutenções e reportes do condomínio
          </p>
        </div>
        {tab === 'ocorrencias' && (
          <button onClick={() => setShowModal(true)} style={btnPrimary}>+ Registar ocorrência</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--sd-border,#E4DDD0)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 18px', fontWeight: tab === t.key ? 700 : 500,
              fontSize: 13, fontFamily: "'Outfit',sans-serif",
              background: 'transparent', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--sd-gold,#C9A84C)' : '2px solid transparent',
              color: tab === t.key ? 'var(--sd-navy,#0D1B2E)' : 'var(--sd-ink-3,#8A9BB0)',
              cursor: 'pointer', marginBottom: -1,
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1 — PAINEL */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'painel' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14 }}>
            {[
              { emoji: '📋', label: 'Total ocorrências', value: stats.total, color: 'yellow' },
              { emoji: '📣', label: 'Abertas', value: stats.abertas, color: 'red' },
              { emoji: '🔧', label: 'Em curso', value: stats.emCurso, color: 'blue' },
              { emoji: '✅', label: 'Resolvidas', value: stats.resolvidas, color: 'green' },
              { emoji: '⏱️', label: 'Tempo médio resolução', value: `${stats.tempoMedioResolucao}d`, color: 'yellow' },
            ].map((kpi, i) => (
              <div key={i} style={cardStyle}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: kpi.color === 'red' ? '#FDECEA' : kpi.color === 'green' ? '#E6F4F2' : kpi.color === 'blue' ? '#EBF5FB' : 'rgba(201,168,76,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 10,
                }}>
                  {kpi.emoji}
                </div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)', lineHeight: 1 }}>{kpi.value}</div>
                <div style={{ fontSize: 12, color: 'var(--sd-ink-2,#4A5E78)', marginTop: 4 }}>{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Priority + SLA row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Priority breakdown */}
            <div style={cardStyle}>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: 'var(--sd-navy,#0D1B2E)' }}>
                Distribuição por prioridade
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(Object.keys(PRIORIDADES) as Prioridade[]).map(p => {
                  const count = stats.porPrioridade[p]
                  const active = ocorrencias.filter(o => o.estado !== 'fechado').length
                  const pct = active > 0 ? Math.round((count / active) * 100) : 0
                  return (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: PRIORIDADES[p].dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 500, minWidth: 60 }}>{PRIORIDADES[p].label}</span>
                      <div style={{ flex: 1, height: 8, background: '#F0EDEA', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: PRIORIDADES[p].dot, borderRadius: 4, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-2,#4A5E78)', minWidth: 24, textAlign: 'right' }}>{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* SLA compliance */}
            <div style={cardStyle}>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: 'var(--sd-navy,#0D1B2E)' }}>
                Conformidade SLA
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <div style={{ position: 'relative', width: 140, height: 140 }}>
                  <svg viewBox="0 0 140 140" width={140} height={140}>
                    <circle cx="70" cy="70" r="58" fill="none" stroke="#F0EDEA" strokeWidth="12" />
                    <circle
                      cx="70" cy="70" r="58" fill="none"
                      stroke={stats.slaPercent >= 80 ? '#1A7A6E' : stats.slaPercent >= 50 ? '#D4830A' : '#C0392B'}
                      strokeWidth="12" strokeLinecap="round"
                      strokeDasharray={`${(stats.slaPercent / 100) * 364.4} 364.4`}
                      transform="rotate(-90 70 70)"
                      style={{ transition: 'stroke-dasharray 0.5s' }}
                    />
                  </svg>
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)' }}>
                      {stats.slaPercent}%
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)' }}>Dentro do prazo</span>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)', textAlign: 'center', marginTop: 8 }}>
                Objetivos: Urgente {SLA_TARGET_DAYS.urgente}d | Alta {SLA_TARGET_DAYS.alta}d | Média {SLA_TARGET_DAYS.media}d | Baixa {SLA_TARGET_DAYS.baixa}d
              </div>
            </div>
          </div>

          {/* Recentes */}
          <div style={cardStyle}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: 'var(--sd-navy,#0D1B2E)' }}>
              Últimas ocorrências
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ocorrencias.slice(0, 5).map(o => (
                <div
                  key={o.id}
                  onClick={() => { setSelected(o); setTab('ocorrencias') }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                    borderRadius: 8, cursor: 'pointer', border: '1px solid var(--sd-border,#E4DDD0)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--sd-cream,#F7F4EE)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 18 }}>{CATEGORIAS[o.categoria]?.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.titulo}</div>
                    <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)' }}>{o.imovel} — {o.reportadoPor}</div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5,
                    background: ESTADOS[o.estado]?.bg, color: ESTADOS[o.estado]?.color,
                  }}>
                    {ESTADOS[o.estado]?.label}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5,
                    background: PRIORIDADES[o.prioridade]?.bg, color: PRIORIDADES[o.prioridade]?.color,
                  }}>
                    {PRIORIDADES[o.prioridade]?.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2 — OCORRÊNCIAS */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'ocorrencias' && !selected && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as Estado | '')} style={{ ...inputStyle, width: 'auto', minWidth: 140 }}>
              <option value="">Todos os estados</option>
              {PIPELINE_ESTADOS.map(e => <option key={e} value={e}>{ESTADOS[e].icon} {ESTADOS[e].label}</option>)}
            </select>
            <select value={filtroPrioridade} onChange={e => setFiltroPrioridade(e.target.value as Prioridade | '')} style={{ ...inputStyle, width: 'auto', minWidth: 140 }}>
              <option value="">Todas as prioridades</option>
              {(Object.keys(PRIORIDADES) as Prioridade[]).map(p => <option key={p} value={p}>{PRIORIDADES[p].label}</option>)}
            </select>
            <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value as Categoria | '')} style={{ ...inputStyle, width: 'auto', minWidth: 140 }}>
              <option value="">Todas as categorias</option>
              {(Object.keys(CATEGORIAS) as Categoria[]).map(c => <option key={c} value={c}>{CATEGORIAS[c].emoji} {CATEGORIAS[c].label}</option>)}
            </select>
            <select value={filtroImovel} onChange={e => setFiltroImovel(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 140 }}>
              <option value="">Todos os imóveis</option>
              {imoveis.map(im => <option key={im} value={im}>{im}</option>)}
            </select>
            {(filtroEstado || filtroPrioridade || filtroCategoria || filtroImovel) && (
              <button onClick={() => { setFiltroEstado(''); setFiltroPrioridade(''); setFiltroCategoria(''); setFiltroImovel('') }} style={{ ...btnSecondary, fontSize: 12 }}>
                Limpar filtros
              </button>
            )}
          </div>

          {/* Count */}
          <div style={{ fontSize: 13, color: 'var(--sd-ink-3,#8A9BB0)', marginBottom: 12 }}>
            {filtered.length} ocorrência{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)' }}>Nenhuma ocorrência encontrada</div>
              <div style={{ fontSize: 13, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 4 }}>Ajuste os filtros ou registe uma nova ocorrência.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--sd-cream,#F7F4EE)' }}>
                    {['ID', 'Título', 'Categoria', 'Prioridade', 'Reportado por', 'Imóvel', 'Data', 'Estado', 'Artesão'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--sd-ink-2,#4A5E78)', fontSize: 11, letterSpacing: '0.3px', borderBottom: '1px solid var(--sd-border,#E4DDD0)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => (
                    <tr
                      key={o.id}
                      onClick={() => setSelected(o)}
                      style={{ cursor: 'pointer', borderBottom: '1px solid var(--sd-border,#E4DDD0)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--sd-cream,#F7F4EE)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--sd-gold,#C9A84C)' }}>{o.id}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.titulo}</td>
                      <td style={{ padding: '10px 12px' }}>{CATEGORIAS[o.categoria]?.emoji} {CATEGORIAS[o.categoria]?.label}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: PRIORIDADES[o.prioridade]?.bg, color: PRIORIDADES[o.prioridade]?.color }}>
                          {PRIORIDADES[o.prioridade]?.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12 }}>{o.reportadoPor}<br /><span style={{ color: 'var(--sd-ink-3,#8A9BB0)' }}>{o.fracao}</span></td>
                      <td style={{ padding: '10px 12px', fontSize: 12 }}>{o.imovel}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>{formatDate(o.data)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: ESTADOS[o.estado]?.bg, color: ESTADOS[o.estado]?.color }}>
                          {ESTADOS[o.estado]?.icon} {ESTADOS[o.estado]?.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12 }}>{o.artesaoAtribuido || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Detalhe ocorrência ────────────────────────────────────────────────── */}
      {tab === 'ocorrencias' && selected && (
        <div>
          <button onClick={() => setSelected(null)} style={{ ...btnSecondary, marginBottom: 16 }}>
            ← Voltar à lista
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            {/* Left: details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 28 }}>{CATEGORIAS[selected.categoria]?.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700 }}>{selected.titulo}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-gold,#C9A84C)' }}>{selected.id}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 4 }}>
                      {selected.imovel} — {selected.fracao} — {formatDate(selected.data)}
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--sd-ink-2,#4A5E78)', margin: '0 0 16px' }}>
                  {selected.descricao}
                </p>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: ESTADOS[selected.estado]?.bg, color: ESTADOS[selected.estado]?.color }}>
                    {ESTADOS[selected.estado]?.icon} {ESTADOS[selected.estado]?.label}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: PRIORIDADES[selected.prioridade]?.bg, color: PRIORIDADES[selected.prioridade]?.color }}>
                    {PRIORIDADES[selected.prioridade]?.label}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: 'var(--sd-cream,#F7F4EE)', color: 'var(--sd-ink-2,#4A5E78)' }}>
                    {CATEGORIAS[selected.categoria]?.label}
                  </span>
                </div>
              </div>

              {/* Info grid */}
              <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <div style={labelStyle}>Reportado por</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{selected.reportadoPor}</div>
                  <div style={{ fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)' }}>{selected.fracao}</div>
                </div>
                <div>
                  <div style={labelStyle}>Localização</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{selected.localizacaoEdificio || 'Não especificada'}</div>
                  <div style={{ fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)' }}>{ZONAS[selected.zona]?.emoji} {ZONAS[selected.zona]?.label}</div>
                </div>
                <div>
                  <div style={labelStyle}>Artesão atribuído</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{selected.artesaoAtribuido || 'Nenhum'}</div>
                </div>
                <div>
                  <div style={labelStyle}>Aberta há</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{diasDesde(selected.data)} dia{diasDesde(selected.data) !== 1 ? 's' : ''}</div>
                  <div style={{ fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)' }}>
                    SLA: {SLA_TARGET_DAYS[selected.prioridade]}d
                    {diasDesde(selected.data) > SLA_TARGET_DAYS[selected.prioridade] && selected.estado !== 'resolvido' && selected.estado !== 'fechado'
                      ? ' — SLA ultrapassado'
                      : ''}
                  </div>
                </div>
              </div>

              {/* Actions */}
              {selected.estado !== 'fechado' && (
                <div style={{ ...cardStyle, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-2,#4A5E78)', marginRight: 8 }}>Avançar estado:</span>
                  {PIPELINE_ESTADOS.map(est => {
                    const currentIdx = PIPELINE_ESTADOS.indexOf(selected.estado)
                    const estIdx = PIPELINE_ESTADOS.indexOf(est)
                    if (estIdx <= currentIdx) return null
                    return (
                      <button
                        key={est}
                        onClick={() => advanceEstado(selected.id, est)}
                        style={{
                          ...btnSecondary,
                          fontSize: 11, padding: '5px 12px',
                          background: ESTADOS[est].bg, color: ESTADOS[est].color,
                          borderColor: 'transparent',
                        }}
                      >
                        {ESTADOS[est].icon} {ESTADOS[est].label}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Assign artesão */}
              {!selected.artesaoAtribuido && selected.estado !== 'fechado' && (
                <div style={{ ...cardStyle }}>
                  <div style={labelStyle}>Atribuir artesão</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      placeholder="Nome do artesão..."
                      id="artesao-input"
                      style={inputStyle}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const input = (e.target as HTMLInputElement).value
                          if (input.trim()) {
                            assignArtesao(selected.id, input.trim());
                            (e.target as HTMLInputElement).value = ''
                          }
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById('artesao-input') as HTMLInputElement
                        if (input?.value.trim()) {
                          assignArtesao(selected.id, input.value.trim())
                          input.value = ''
                        }
                      }}
                      style={btnPrimary}
                    >
                      Atribuir
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={cardStyle}>
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: 'var(--sd-navy,#0D1B2E)' }}>
                  Cronologia
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {selected.timeline.map((evt, idx) => (
                    <div key={evt.id} style={{ display: 'flex', gap: 10, paddingBottom: idx < selected.timeline.length - 1 ? 16 : 0 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                          background: evt.tipo === 'estado' ? 'var(--sd-gold,#C9A84C)' : evt.tipo === 'foto' ? '#2980B9' : 'var(--sd-ink-3,#8A9BB0)',
                        }} />
                        {idx < selected.timeline.length - 1 && (
                          <div style={{ width: 1, flex: 1, background: 'var(--sd-border,#E4DDD0)', marginTop: 4 }} />
                        )}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{evt.conteudo}</div>
                        <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 2 }}>
                          {formatDateTime(evt.data)} — {evt.autor}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add comment */}
                {selected.estado !== 'fechado' && (
                  <div style={{ marginTop: 16, borderTop: '1px solid var(--sd-border,#E4DDD0)', paddingTop: 12 }}>
                    <textarea
                      value={commentInput}
                      onChange={e => setCommentInput(e.target.value)}
                      placeholder="Adicionar comentário..."
                      rows={2}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                    <button
                      onClick={() => addComment(selected.id)}
                      disabled={!commentInput.trim()}
                      style={{ ...btnPrimary, marginTop: 8, opacity: commentInput.trim() ? 1 : 0.5, fontSize: 12, padding: '8px 14px' }}
                    >
                      Comentar
                    </button>
                  </div>
                )}
              </div>

              {/* Delete */}
              <button
                onClick={() => { if (confirm('Eliminar esta ocorrência?')) deleteOcorrencia(selected.id) }}
                style={{ ...btnSecondary, color: '#C0392B', borderColor: '#FDECEA', background: '#FDECEA', fontSize: 12 }}
              >
                Eliminar ocorrência
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3 — MAPA */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'mapa' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={cardStyle}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: 'var(--sd-navy,#0D1B2E)' }}>
              Mapa de incidentes por zona
            </h3>
            <p style={{ fontSize: 13, color: 'var(--sd-ink-3,#8A9BB0)', margin: '0 0 20px' }}>
              Visualização das ocorrências por zona do edifício. Áreas com mais incidentes destacadas a vermelho.
            </p>

            {/* Building grid visual */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
              {(Object.keys(ZONAS) as Zona[]).filter(z => z !== 'outro').map(zona => {
                const count = stats.porZona[zona] || 0
                const maxCount = Math.max(...Object.values(stats.porZona), 1)
                const intensity = count / maxCount
                const bg = count === 0 ? '#F7F4EE'
                  : intensity >= 0.7 ? '#FDECEA'
                  : intensity >= 0.4 ? '#FEF5E4'
                  : '#E6F4F2'
                const borderColor = count === 0 ? 'var(--sd-border,#E4DDD0)'
                  : intensity >= 0.7 ? '#E5A9A0'
                  : intensity >= 0.4 ? '#E8D4A0'
                  : '#B5DDD8'
                return (
                  <div
                    key={zona}
                    style={{
                      background: bg, border: `2px solid ${borderColor}`, borderRadius: 12,
                      padding: 16, textAlign: 'center', cursor: 'pointer', transition: 'transform 0.15s',
                    }}
                    onClick={() => {
                      setFiltroEstado('')
                      setFiltroPrioridade('')
                      setFiltroCategoria('')
                      setFiltroImovel('')
                      setTab('ocorrencias')
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    <div style={{ fontSize: 28, marginBottom: 6 }}>{ZONAS[zona].emoji}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)' }}>{ZONAS[zona].label}</div>
                    <div style={{
                      fontSize: 22, fontWeight: 700, fontFamily: "'Playfair Display',serif",
                      color: count === 0 ? 'var(--sd-ink-3,#8A9BB0)' : intensity >= 0.7 ? '#C0392B' : intensity >= 0.4 ? '#D4830A' : '#1A7A6E',
                      marginTop: 4,
                    }}>
                      {count}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)' }}>
                      ocorrência{count !== 1 ? 's' : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Ranking zonas */}
          <div style={cardStyle}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: 'var(--sd-navy,#0D1B2E)' }}>
              Ranking de zonas por incidentes
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(stats.porZona)
                .sort(([, a], [, b]) => b - a)
                .map(([zona, count], idx) => {
                  const maxCount = Math.max(...Object.values(stats.porZona), 1)
                  const pct = Math.round((count / maxCount) * 100)
                  const z = ZONAS[zona as Zona]
                  return (
                    <div key={zona} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--sd-gold,#C9A84C)', minWidth: 22 }}>#{idx + 1}</span>
                      <span style={{ fontSize: 16 }}>{z?.emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, minWidth: 120 }}>{z?.label || zona}</span>
                      <div style={{ flex: 1, height: 8, background: '#F0EDEA', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`, height: '100%', borderRadius: 4, transition: 'width 0.3s',
                          background: idx === 0 ? '#C0392B' : idx === 1 ? '#D4830A' : '#1A7A6E',
                        }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, minWidth: 24, textAlign: 'right' }}>{count}</span>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* Floor plan representation */}
          <div style={cardStyle}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: 'var(--sd-navy,#0D1B2E)' }}>
              Representação do edifício
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400, margin: '0 auto' }}>
              {/* Top: cobertura */}
              <div style={{
                background: (stats.porZona['cobertura'] || 0) > 0 ? '#FDECEA' : '#F7F4EE',
                border: '1px solid var(--sd-border,#E4DDD0)', borderRadius: '12px 12px 0 0',
                padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600,
              }}>
                {ZONAS.cobertura.emoji} Cobertura ({stats.porZona['cobertura'] || 0})
              </div>
              {/* Pisos */}
              {[5, 4, 3, 2, 1].map(piso => (
                <div key={piso} style={{
                  background: '#fff', border: '1px solid var(--sd-border,#E4DDD0)', borderTop: 'none',
                  padding: '8px 16px', display: 'flex', justifyContent: 'space-between', fontSize: 12,
                }}>
                  <span style={{ fontWeight: 600 }}>{piso}.{'\u00BA'} andar</span>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span>Esq</span>
                    <span style={{ color: 'var(--sd-ink-3,#8A9BB0)' }}>|</span>
                    <span>Dto</span>
                  </div>
                </div>
              ))}
              {/* R/C */}
              <div style={{
                background: (stats.porZona['hall'] || 0) > 0 ? '#FEF5E4' : '#fff',
                border: '1px solid var(--sd-border,#E4DDD0)', borderTop: 'none',
                padding: '8px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600,
              }}>
                {ZONAS.hall.emoji} R/C — Hall ({stats.porZona['hall'] || 0})
              </div>
              {/* Fachada */}
              <div style={{
                background: (stats.porZona['fachada'] || 0) > 0 ? '#FEF5E4' : '#F7F4EE',
                border: '1px solid var(--sd-border,#E4DDD0)', borderTop: 'none',
                padding: '8px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600,
              }}>
                {ZONAS.fachada.emoji} Fachada ({stats.porZona['fachada'] || 0})
              </div>
              {/* Escadas + elevador on the side */}
              <div style={{ display: 'flex', gap: 2 }}>
                <div style={{
                  flex: 1,
                  background: (stats.porZona['escadas'] || 0) > 0 ? '#FEF5E4' : '#F7F4EE',
                  border: '1px solid var(--sd-border,#E4DDD0)', borderTop: 'none',
                  padding: '8px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600,
                }}>
                  {ZONAS.escadas.emoji} Escadas ({stats.porZona['escadas'] || 0})
                </div>
                <div style={{
                  flex: 1,
                  background: (stats.porZona['elevador'] || 0) > 0 ? '#FDECEA' : '#F7F4EE',
                  border: '1px solid var(--sd-border,#E4DDD0)', borderTop: 'none',
                  padding: '8px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600,
                }}>
                  {ZONAS.elevador.emoji} Elevador ({stats.porZona['elevador'] || 0})
                </div>
              </div>
              {/* Garagem */}
              <div style={{
                background: (stats.porZona['garagem'] || 0) > 0 ? '#FDECEA' : '#F7F4EE',
                border: '1px solid var(--sd-border,#E4DDD0)', borderTop: 'none', borderRadius: '0 0 12px 12px',
                padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600,
              }}>
                {ZONAS.garagem.emoji} Garagem ({stats.porZona['garagem'] || 0})
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 4 — QR CODES */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'qrcodes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <p style={{ fontSize: 14, color: 'var(--sd-ink-3,#8A9BB0)', margin: 0 }}>
              QR Codes por zona e equipamento. Quando digitalizados, abrem um formulário pré-preenchido com a informação da zona.
            </p>
            <button onClick={() => setShowQRModal(true)} style={btnPrimary}>+ Gerar QR Code</button>
          </div>

          {qrCodes.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📱</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)' }}>Nenhum QR Code gerado</div>
              <div style={{ fontSize: 13, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 4 }}>Gere QR Codes para facilitar o reporte de ocorrências no terreno.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
              {qrCodes.map(qr => (
                <div key={qr.id} style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 10, background: 'rgba(201,168,76,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                    }}>
                      {ZONAS[qr.zona]?.emoji}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{ZONAS[qr.zona]?.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)' }}>{qr.equipamento}</div>
                    </div>
                  </div>

                  {/* QR representation */}
                  <div style={{
                    background: '#fff', border: '2px solid var(--sd-navy,#0D1B2E)', borderRadius: 8,
                    padding: 16, textAlign: 'center', marginBottom: 12,
                  }}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, width: 84, height: 84, margin: '0 auto',
                    }}>
                      {Array.from({ length: 49 }, (_, i) => {
                        // Generate a deterministic pseudo-random pattern from the code
                        const hash = qr.codigo.charCodeAt(i % qr.codigo.length) + i
                        const filled = (hash * 31 + i * 7) % 3 !== 0
                        // Corner markers
                        const row = Math.floor(i / 7)
                        const col = i % 7
                        const isCorner = (row < 2 && col < 2) || (row < 2 && col > 4) || (row > 4 && col < 2)
                        return (
                          <div
                            key={i}
                            style={{
                              background: isCorner || filled ? 'var(--sd-navy,#0D1B2E)' : 'transparent',
                              borderRadius: 1,
                            }}
                          />
                        )
                      })}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)', marginTop: 8, fontFamily: 'monospace' }}>
                      {qr.codigo}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)' }}>Criado: {formatDate(qr.dataCriacao)}</span>
                    <button
                      onClick={() => {
                        const text = `Fixit QR — ${ZONAS[qr.zona]?.label}: ${qr.equipamento}\nCódigo: ${qr.codigo}\nDigitalizar para reportar ocorrência nesta zona.`
                        navigator.clipboard?.writeText(text)
                      }}
                      style={{ ...btnSecondary, fontSize: 11, padding: '4px 10px' }}
                    >
                      Copiar info
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL — Registar ocorrência */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div style={overlayStyle} onClick={() => setShowModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--sd-navy,#0D1B2E)' }}>
                Registar ocorrência
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--sd-ink-3,#8A9BB0)' }}>x</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Título */}
              <div>
                <label style={labelStyle}>Título *</label>
                <input value={formTitulo} onChange={e => setFormTitulo(e.target.value)} placeholder="Ex: Infiltração no teto da garagem" style={inputStyle} />
              </div>

              {/* Descrição */}
              <div>
                <label style={labelStyle}>Descrição</label>
                <textarea value={formDescricao} onChange={e => setFormDescricao(e.target.value)} placeholder="Descreva o problema em detalhe..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              {/* Categoria + Prioridade */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Categoria</label>
                  <select value={formCategoria} onChange={e => setFormCategoria(e.target.value as Categoria)} style={inputStyle}>
                    {(Object.keys(CATEGORIAS) as Categoria[]).map(c => (
                      <option key={c} value={c}>{CATEGORIAS[c].emoji} {CATEGORIAS[c].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Prioridade</label>
                  <select value={formPrioridade} onChange={e => setFormPrioridade(e.target.value as Prioridade)} style={inputStyle}>
                    {(Object.keys(PRIORIDADES) as Prioridade[]).map(p => (
                      <option key={p} value={p}>{PRIORIDADES[p].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Imóvel + Fração */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Imóvel</label>
                  <input value={formImovel} onChange={e => setFormImovel(e.target.value)} placeholder="Ex: Edifício Aurora" style={inputStyle} list="imoveis-list" />
                  <datalist id="imoveis-list">
                    {imoveis.map(im => <option key={im} value={im} />)}
                  </datalist>
                </div>
                <div>
                  <label style={labelStyle}>Fração</label>
                  <input value={formFracao} onChange={e => setFormFracao(e.target.value)} placeholder="Ex: 3.º Esq" style={inputStyle} />
                </div>
              </div>

              {/* Zona + Localização */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Zona do edifício</label>
                  <select value={formZona} onChange={e => setFormZona(e.target.value as Zona)} style={inputStyle}>
                    {(Object.keys(ZONAS) as Zona[]).map(z => (
                      <option key={z} value={z}>{ZONAS[z].emoji} {ZONAS[z].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Localização no edifício</label>
                  <input value={formLocalizacao} onChange={e => setFormLocalizacao(e.target.value)} placeholder="Ex: Junto ao pilar 4" style={inputStyle} />
                </div>
              </div>

              {/* Fotos */}
              <div>
                <label style={labelStyle}>Fotos</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ fontSize: 13, fontFamily: "'Outfit',sans-serif" }}
                />
                <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 4 }}>
                  Opcional. As fotos ajudam a diagnosticar o problema.
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button onClick={() => { setShowModal(false); resetForm() }} style={btnSecondary}>Cancelar</button>
                <button onClick={handleRegistar} disabled={!formTitulo.trim()} style={{ ...btnPrimary, opacity: formTitulo.trim() ? 1 : 0.5 }}>
                  Registar ocorrência
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL — Gerar QR Code */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {showQRModal && (
        <div style={overlayStyle} onClick={() => setShowQRModal(false)}>
          <div style={{ ...modalStyle, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--sd-navy,#0D1B2E)' }}>
                Gerar QR Code
              </h3>
              <button onClick={() => setShowQRModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--sd-ink-3,#8A9BB0)' }}>x</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Zona</label>
                <select value={qrZona} onChange={e => setQrZona(e.target.value as Zona)} style={inputStyle}>
                  {(Object.keys(ZONAS) as Zona[]).map(z => (
                    <option key={z} value={z}>{ZONAS[z].emoji} {ZONAS[z].label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Equipamento / Descrição *</label>
                <input value={qrEquipamento} onChange={e => setQrEquipamento(e.target.value)} placeholder="Ex: Quadro elétrico geral" style={inputStyle} />
              </div>

              <div style={{ background: 'var(--sd-cream,#F7F4EE)', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--sd-ink-2,#4A5E78)' }}>
                Ao digitalizar este QR Code, o condómino poderá registar uma ocorrência com a zona e equipamento pré-preenchidos.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button onClick={() => setShowQRModal(false)} style={btnSecondary}>Cancelar</button>
                <button onClick={handleGerarQR} disabled={!qrEquipamento.trim()} style={{ ...btnPrimary, opacity: qrEquipamento.trim() ? 1 : 0.5 }}>
                  Gerar QR Code
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
