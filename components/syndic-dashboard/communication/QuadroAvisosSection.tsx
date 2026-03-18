'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type CategoriaAviso = 'manutencao' | 'assembleia' | 'financeiro' | 'seguranca' | 'social' | 'outro'
type PrioridadeAviso = 'normal' | 'importante' | 'urgente'
type EstadoAviso = 'ativo' | 'arquivado'

interface Aviso {
  id: string
  titulo: string
  conteudo: string
  categoria: CategoriaAviso
  prioridade: PrioridadeAviso
  imovelTarget: string          // 'todos' ou nome do imóvel
  autor: string
  dataPublicacao: string
  dataExpiracao?: string
  anexoNome?: string
  fixado: boolean
  estado: EstadoAviso
  visualizacoes: number
}

interface Props {
  user: any
  userRole: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const CATEGORIAS: Record<CategoriaAviso, { icon: string; label: string; cor: string }> = {
  manutencao:  { icon: '🔧', label: 'Manutenção',  cor: '#D4830A' },
  assembleia:  { icon: '🏛️', label: 'Assembleia',   cor: '#6C5CE7' },
  financeiro:  { icon: '💶', label: 'Financeiro',   cor: '#1A7A6E' },
  seguranca:   { icon: '🛡️', label: 'Segurança',    cor: '#C0392B' },
  social:      { icon: '🎉', label: 'Social',       cor: '#C9A84C' },
  outro:       { icon: '📄', label: 'Outro',        cor: '#4A5E78' },
}

const PRIORIDADES: Record<PrioridadeAviso, { label: string; bg: string; color: string; borderLeft: string }> = {
  normal:     { label: 'Normal',     bg: 'rgba(13,27,46,0.06)', color: '#0D1B2E', borderLeft: 'transparent' },
  importante: { label: 'Importante', bg: '#FEF5E4',             color: '#D4830A', borderLeft: '#C9A84C' },
  urgente:    { label: 'Urgente',    bg: '#FDECEA',             color: '#C0392B', borderLeft: '#C0392B' },
}

const IMOVEIS_DEMO = [
  'Edifício Aurora — Rua das Flores 42',
  'Edifício Solaris — Av. da Liberdade 130',
  'Edifício Atlântico — Praça do Comércio 8',
]

const formatDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return s }
}

const formatDateShort = (s: string) => {
  try { return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return s }
}

const genId = () => `aviso_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

// ─── Demo Data ───────────────────────────────────────────────────────────────

const DEMO_AVISOS: Aviso[] = [
  {
    id: 'demo_1',
    titulo: 'Corte de água — Manutenção urgente da canalização',
    conteudo: 'Informamos que haverá corte de água no dia 15 de março, das 09h às 14h, para reparação urgente de uma fuga na canalização principal do edifício. Pedimos desculpa pelo incómodo e aconselhamos a reservarem água para o período indicado.',
    categoria: 'manutencao',
    prioridade: 'urgente',
    imovelTarget: 'Edifício Aurora — Rua das Flores 42',
    autor: 'Administração',
    dataPublicacao: '2026-03-11T10:00:00',
    dataExpiracao: '2026-03-16',
    fixado: true,
    estado: 'ativo',
    visualizacoes: 47,
  },
  {
    id: 'demo_2',
    titulo: 'Elevador fora de serviço — Reparação em curso',
    conteudo: 'O elevador do Edifício Solaris encontra-se fora de serviço desde hoje. A empresa de manutenção foi contactada e a reparação está prevista para os próximos 2 dias úteis. Utilizem as escadas com cuidado.',
    categoria: 'manutencao',
    prioridade: 'urgente',
    imovelTarget: 'Edifício Solaris — Av. da Liberdade 130',
    autor: 'Gestor Técnico',
    dataPublicacao: '2026-03-10T16:30:00',
    fixado: false,
    estado: 'ativo',
    visualizacoes: 62,
  },
  {
    id: 'demo_3',
    titulo: 'Convocatória — Assembleia Geral Ordinária 2026',
    conteudo: 'Convocamos todos os condóminos para a Assembleia Geral Ordinária que se realizará no dia 28 de março de 2026, às 19h00, na sala de reuniões do Edifício Aurora. Ordem de trabalhos: aprovação de contas 2025, orçamento 2026, obras de conservação e assuntos diversos.',
    categoria: 'assembleia',
    prioridade: 'importante',
    imovelTarget: 'Edifício Aurora — Rua das Flores 42',
    autor: 'Administração',
    dataPublicacao: '2026-03-08T09:00:00',
    dataExpiracao: '2026-03-28',
    fixado: true,
    estado: 'ativo',
    visualizacoes: 38,
  },
  {
    id: 'demo_4',
    titulo: 'Renovação do Seguro Multirriscos — Informação',
    conteudo: 'Informamos que o seguro multirriscos do condomínio foi renovado com a Fidelidade Seguros, com efeito a partir de 1 de abril de 2026. O prémio anual é de 2.450 EUR. Os detalhes da cobertura estão disponíveis na administração.',
    categoria: 'financeiro',
    prioridade: 'importante',
    imovelTarget: 'todos',
    autor: 'Administração',
    dataPublicacao: '2026-03-07T14:00:00',
    fixado: false,
    estado: 'ativo',
    visualizacoes: 25,
  },
  {
    id: 'demo_5',
    titulo: 'Horário de limpeza das áreas comuns',
    conteudo: 'A partir de 1 de abril, o horário de limpeza das áreas comuns será alterado para as manhãs (08h-11h) em vez do período da tarde. Esta alteração visa minimizar o incómodo para os moradores.',
    categoria: 'manutencao',
    prioridade: 'normal',
    imovelTarget: 'todos',
    autor: 'Gestor Técnico',
    dataPublicacao: '2026-03-06T11:00:00',
    fixado: false,
    estado: 'ativo',
    visualizacoes: 19,
  },
  {
    id: 'demo_6',
    titulo: 'Manutenção do jardim — Primavera 2026',
    conteudo: 'Iniciamos esta semana os trabalhos de manutenção do jardim e espaços verdes. Serão realizados podas, plantação de novas flores e reparação do sistema de rega. Os trabalhos decorrerão durante 5 dias úteis.',
    categoria: 'manutencao',
    prioridade: 'normal',
    imovelTarget: 'Edifício Atlântico — Praça do Comércio 8',
    autor: 'Gestor Técnico',
    dataPublicacao: '2026-03-05T08:30:00',
    fixado: false,
    estado: 'ativo',
    visualizacoes: 14,
  },
  {
    id: 'demo_7',
    titulo: 'Regras de segurança — Portas de acesso',
    conteudo: 'Relembramos todos os condóminos da importância de manter as portas de acesso ao edifício sempre fechadas. Não abram a porta a pessoas desconhecidas sem verificação prévia pelo intercomunicador. A segurança de todos é responsabilidade de cada um.',
    categoria: 'seguranca',
    prioridade: 'normal',
    imovelTarget: 'todos',
    autor: 'Administração',
    dataPublicacao: '2026-03-04T10:00:00',
    fixado: false,
    estado: 'ativo',
    visualizacoes: 31,
  },
  {
    id: 'demo_8',
    titulo: 'Festa de Vizinhos — 20 de março',
    conteudo: 'Convidamos todos os moradores para a Festa de Vizinhos que se realizará no dia 20 de março, às 18h30, no terraço do Edifício Aurora. Haverá petiscos e bebidas. Tragam boa disposição! Confirmem a presença junto da administração.',
    categoria: 'social',
    prioridade: 'normal',
    imovelTarget: 'Edifício Aurora — Rua das Flores 42',
    autor: 'Comissão Social',
    dataPublicacao: '2026-03-03T15:00:00',
    dataExpiracao: '2026-03-20',
    fixado: false,
    estado: 'ativo',
    visualizacoes: 42,
  },
]

// ─── Componente ───────────────────────────────────────────────────────────────

export default function QuadroAvisosSection({ user, userRole }: Props) {
  // ── State
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaAviso | 'todos'>('todos')
  const [filtroPrioridade, setFiltroPrioridade] = useState<PrioridadeAviso | 'todos'>('todos')
  const [filtroImovel, setFiltroImovel] = useState<string>('todos')
  const [filtroEstado, setFiltroEstado] = useState<EstadoAviso | 'todos'>('ativo')

  // ── Form state
  const [formTitulo, setFormTitulo] = useState('')
  const [formConteudo, setFormConteudo] = useState('')
  const [formCategoria, setFormCategoria] = useState<CategoriaAviso>('manutencao')
  const [formPrioridade, setFormPrioridade] = useState<PrioridadeAviso>('normal')
  const [formImovel, setFormImovel] = useState<string>('todos')
  const [formAnexo, setFormAnexo] = useState<string>('')
  const [formExpiracao, setFormExpiracao] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── localStorage key
  const storageKey = `fixit_avisos_${user?.id || 'local'}`

  // ── Load / Save
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        setAvisos(JSON.parse(raw))
      } else {
        setAvisos(DEMO_AVISOS)
        localStorage.setItem(storageKey, JSON.stringify(DEMO_AVISOS))
      }
    } catch {
      setAvisos(DEMO_AVISOS)
    }
  }, [storageKey])

  const persist = (next: Aviso[]) => {
    setAvisos(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
  }

  // ── Derived data
  const avisosAtivos = useMemo(() => avisos.filter(a => a.estado === 'ativo'), [avisos])
  const avisosMes = useMemo(() => {
    const now = new Date()
    const m = now.getMonth()
    const y = now.getFullYear()
    return avisosAtivos.filter(a => {
      const d = new Date(a.dataPublicacao)
      return d.getMonth() === m && d.getFullYear() === y
    }).length
  }, [avisosAtivos])
  const maisLido = useMemo(() => {
    if (avisosAtivos.length === 0) return null
    return [...avisosAtivos].sort((a, b) => b.visualizacoes - a.visualizacoes)[0]
  }, [avisosAtivos])
  const distribuicaoCategorias = useMemo(() => {
    const dist: Record<string, number> = {}
    for (const a of avisosAtivos) {
      dist[a.categoria] = (dist[a.categoria] || 0) + 1
    }
    return dist
  }, [avisosAtivos])

  // ── Filtered + sorted
  const avisosFiltrados = useMemo(() => {
    let list = [...avisos]

    // Estado filter
    if (filtroEstado !== 'todos') list = list.filter(a => a.estado === filtroEstado)

    // Categoria filter
    if (filtroCategoria !== 'todos') list = list.filter(a => a.categoria === filtroCategoria)

    // Prioridade filter
    if (filtroPrioridade !== 'todos') list = list.filter(a => a.prioridade === filtroPrioridade)

    // Imóvel filter
    if (filtroImovel !== 'todos') list = list.filter(a => a.imovelTarget === filtroImovel || a.imovelTarget === 'todos')

    // Search
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(a =>
        a.titulo.toLowerCase().includes(q) ||
        a.conteudo.toLowerCase().includes(q) ||
        a.autor.toLowerCase().includes(q)
      )
    }

    // Sort: pinned first, then by date desc
    list.sort((a, b) => {
      if (a.fixado !== b.fixado) return a.fixado ? -1 : 1
      return new Date(b.dataPublicacao).getTime() - new Date(a.dataPublicacao).getTime()
    })

    return list
  }, [avisos, filtroEstado, filtroCategoria, filtroPrioridade, filtroImovel, search])

  // ── Actions
  const handleCreateAviso = () => {
    if (!formTitulo.trim() || !formConteudo.trim()) return
    const novo: Aviso = {
      id: genId(),
      titulo: formTitulo.trim(),
      conteudo: formConteudo.trim(),
      categoria: formCategoria,
      prioridade: formPrioridade,
      imovelTarget: formImovel,
      autor: user?.user_metadata?.full_name || user?.email || 'Administração',
      dataPublicacao: new Date().toISOString(),
      dataExpiracao: formExpiracao || undefined,
      anexoNome: formAnexo || undefined,
      fixado: false,
      estado: 'ativo',
      visualizacoes: 0,
    }
    persist([novo, ...avisos])
    resetForm()
    setShowModal(false)
  }

  const toggleFixar = (id: string) => {
    persist(avisos.map(a => a.id === id ? { ...a, fixado: !a.fixado } : a))
  }

  const arquivar = (id: string) => {
    persist(avisos.map(a => a.id === id ? { ...a, estado: 'arquivado' as EstadoAviso } : a))
  }

  const restaurar = (id: string) => {
    persist(avisos.map(a => a.id === id ? { ...a, estado: 'ativo' as EstadoAviso } : a))
  }

  const resetForm = () => {
    setFormTitulo('')
    setFormConteudo('')
    setFormCategoria('manutencao')
    setFormPrioridade('normal')
    setFormImovel('todos')
    setFormAnexo('')
    setFormExpiracao('')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setFormAnexo(file.name)
  }

  // ── Simular visualização ao clicar
  const incrementViews = (id: string) => {
    persist(avisos.map(a => a.id === id ? { ...a, visualizacoes: a.visualizacoes + 1 } : a))
  }

  // ── Expanded card tracking
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      incrementViews(id)
    }
  }

  // ── Render
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* ── Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: 'var(--sd-navy,#0D1B2E)', margin: 0 }}>
            Quadro de Avisos
          </h1>
          <p style={{ fontSize: 13, color: 'var(--sd-ink-3,#8A9BB0)', margin: '4px 0 0' }}>
            Comunique com os condóminos de forma clara e organizada
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true) }}
          style={{
            background: 'var(--sd-gold,#C9A84C)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '10px 22px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 18 }}>+</span> Novo Aviso
        </button>
      </div>

      {/* ── Layout: Feed + Sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        {/* ── Main Feed Column */}
        <div>
          {/* ── Search + Filters */}
          <div style={{
            background: '#fff',
            border: '1px solid var(--sd-border,#E4DDD0)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            {/* Search bar */}
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--sd-ink-3,#8A9BB0)' }}>
                🔍
              </span>
              <input
                type="text"
                placeholder="Pesquisar avisos..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  border: '1px solid var(--sd-border,#E4DDD0)',
                  borderRadius: 8,
                  fontSize: 14,
                  color: 'var(--sd-navy,#0D1B2E)',
                  background: 'var(--sd-cream,#F7F4EE)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Filter pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {/* Estado */}
              <select
                value={filtroEstado}
                onChange={e => setFiltroEstado(e.target.value as EstadoAviso | 'todos')}
                style={filterSelectStyle}
              >
                <option value="todos">Todos os estados</option>
                <option value="ativo">Ativos</option>
                <option value="arquivado">Arquivados</option>
              </select>

              {/* Categoria */}
              <select
                value={filtroCategoria}
                onChange={e => setFiltroCategoria(e.target.value as CategoriaAviso | 'todos')}
                style={filterSelectStyle}
              >
                <option value="todos">Todas as categorias</option>
                {Object.entries(CATEGORIAS).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>

              {/* Prioridade */}
              <select
                value={filtroPrioridade}
                onChange={e => setFiltroPrioridade(e.target.value as PrioridadeAviso | 'todos')}
                style={filterSelectStyle}
              >
                <option value="todos">Todas as prioridades</option>
                {Object.entries(PRIORIDADES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              {/* Imóvel */}
              <select
                value={filtroImovel}
                onChange={e => setFiltroImovel(e.target.value)}
                style={filterSelectStyle}
              >
                <option value="todos">Todos os imóveis</option>
                {IMOVEIS_DEMO.map(i => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Feed */}
          {avisosFiltrados.length === 0 ? (
            <div style={{
              background: '#fff',
              border: '1px solid var(--sd-border,#E4DDD0)',
              borderRadius: 12,
              padding: 48,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <p style={{ fontSize: 15, color: 'var(--sd-ink-2,#4A5E78)', margin: 0 }}>
                Nenhum aviso encontrado
              </p>
              <p style={{ fontSize: 13, color: 'var(--sd-ink-3,#8A9BB0)', margin: '6px 0 0' }}>
                Ajuste os filtros ou crie um novo aviso
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {avisosFiltrados.map(aviso => {
                const cat = CATEGORIAS[aviso.categoria]
                const prio = PRIORIDADES[aviso.prioridade]
                const isExpanded = expandedId === aviso.id
                const isExpired = aviso.dataExpiracao && new Date(aviso.dataExpiracao) < new Date()

                return (
                  <div
                    key={aviso.id}
                    style={{
                      background: aviso.estado === 'arquivado' ? '#FAFAFA' : '#fff',
                      border: '1px solid var(--sd-border,#E4DDD0)',
                      borderRadius: 12,
                      borderLeft: `4px solid ${prio.borderLeft}`,
                      padding: 0,
                      opacity: aviso.estado === 'arquivado' ? 0.7 : 1,
                      transition: 'box-shadow 0.2s',
                    }}
                  >
                    {/* Card header */}
                    <div
                      onClick={() => toggleExpand(aviso.id)}
                      style={{
                        padding: '16px 20px',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: 14,
                        alignItems: 'flex-start',
                      }}
                    >
                      {/* Category icon */}
                      <div style={{
                        width: 42,
                        height: 42,
                        borderRadius: 10,
                        background: `${cat.cor}14`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        flexShrink: 0,
                        marginTop: 2,
                      }}>
                        {cat.icon}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Top row: badges */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                          {aviso.fixado && (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '2px 7px',
                              borderRadius: 5,
                              background: 'var(--sd-gold,#C9A84C)',
                              color: '#fff',
                              letterSpacing: '0.3px',
                            }}>
                              📌 Fixado
                            </span>
                          )}
                          <span style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: 5,
                            background: `${cat.cor}18`,
                            color: cat.cor,
                            letterSpacing: '0.3px',
                          }}>
                            {cat.label}
                          </span>
                          {aviso.prioridade !== 'normal' && (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '2px 7px',
                              borderRadius: 5,
                              background: prio.bg,
                              color: prio.color,
                              letterSpacing: '0.3px',
                            }}>
                              {prio.label}
                            </span>
                          )}
                          {isExpired && (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '2px 7px',
                              borderRadius: 5,
                              background: '#FDECEA',
                              color: '#C0392B',
                              letterSpacing: '0.3px',
                            }}>
                              Expirado
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h3 style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: 'var(--sd-navy,#0D1B2E)',
                          margin: 0,
                          lineHeight: 1.35,
                        }}>
                          {aviso.titulo}
                        </h3>

                        {/* Preview */}
                        {!isExpanded && (
                          <p style={{
                            fontSize: 13,
                            color: 'var(--sd-ink-2,#4A5E78)',
                            margin: '6px 0 0',
                            lineHeight: 1.45,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}>
                            {aviso.conteudo}
                          </p>
                        )}

                        {/* Meta row */}
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 14,
                          marginTop: 8,
                          fontSize: 12,
                          color: 'var(--sd-ink-3,#8A9BB0)',
                        }}>
                          <span>{aviso.autor}</span>
                          <span>{formatDate(aviso.dataPublicacao)}</span>
                          {aviso.imovelTarget !== 'todos' ? (
                            <span>🏢 {aviso.imovelTarget.split('—')[0]?.trim()}</span>
                          ) : (
                            <span>🏢 Todos os imóveis</span>
                          )}
                          <span>👁️ {aviso.visualizacoes}</span>
                        </div>
                      </div>

                      {/* Expand indicator */}
                      <span style={{
                        fontSize: 16,
                        color: 'var(--sd-ink-3,#8A9BB0)',
                        transition: 'transform 0.2s',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                        flexShrink: 0,
                        marginTop: 4,
                      }}>
                        ▾
                      </span>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div style={{
                        padding: '0 20px 16px 76px',
                        borderTop: '1px solid var(--sd-border,#E4DDD0)',
                      }}>
                        <p style={{
                          fontSize: 14,
                          color: 'var(--sd-navy,#0D1B2E)',
                          lineHeight: 1.6,
                          margin: '14px 0 0',
                          whiteSpace: 'pre-wrap',
                        }}>
                          {aviso.conteudo}
                        </p>

                        {/* Attachment */}
                        {aviso.anexoNome && (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 10,
                            padding: '6px 12px',
                            borderRadius: 8,
                            background: 'var(--sd-cream,#F7F4EE)',
                            fontSize: 12,
                            color: 'var(--sd-ink-2,#4A5E78)',
                          }}>
                            📎 {aviso.anexoNome}
                          </div>
                        )}

                        {/* Expiration */}
                        {aviso.dataExpiracao && (
                          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)' }}>
                            Expira em: {formatDateShort(aviso.dataExpiracao)}
                          </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                          <button
                            onClick={e => { e.stopPropagation(); toggleFixar(aviso.id) }}
                            style={actionBtnStyle}
                          >
                            {aviso.fixado ? '📌 Desfixar' : '📌 Fixar'}
                          </button>
                          {aviso.estado === 'ativo' ? (
                            <button
                              onClick={e => { e.stopPropagation(); arquivar(aviso.id) }}
                              style={actionBtnStyle}
                            >
                              📦 Arquivar
                            </button>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); restaurar(aviso.id) }}
                              style={actionBtnStyle}
                            >
                              ♻️ Restaurar
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Stats Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Total ativos */}
          <div style={{
            background: '#fff',
            border: '1px solid var(--sd-border,#E4DDD0)',
            borderRadius: 12,
            padding: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-ink-2,#4A5E78)', marginBottom: 14 }}>
              Resumo
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Stat: Total ativos */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 9,
                  background: 'rgba(201,168,76,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                }}>
                  📋
                </div>
                <div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: 'var(--sd-navy,#0D1B2E)', lineHeight: 1 }}>
                    {avisosAtivos.length}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)' }}>Avisos ativos</div>
                </div>
              </div>

              {/* Stat: Este mês */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 9,
                  background: 'rgba(26,122,110,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                }}>
                  📅
                </div>
                <div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: 'var(--sd-navy,#0D1B2E)', lineHeight: 1 }}>
                    {avisosMes}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)' }}>Avisos este mês</div>
                </div>
              </div>

              {/* Stat: Mais lido */}
              {maisLido && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 9,
                    background: 'rgba(108,92,231,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                  }}>
                    👁️
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: 'var(--sd-navy,#0D1B2E)', lineHeight: 1 }}>
                      {maisLido.visualizacoes}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: 'var(--sd-ink-3,#8A9BB0)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {maisLido.titulo.length > 30 ? maisLido.titulo.slice(0, 30) + '...' : maisLido.titulo}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Categorias distribution */}
          <div style={{
            background: '#fff',
            border: '1px solid var(--sd-border,#E4DDD0)',
            borderRadius: 12,
            padding: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-ink-2,#4A5E78)', marginBottom: 14 }}>
              Distribuição por Categoria
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(CATEGORIAS).map(([key, cat]) => {
                const count = distribuicaoCategorias[key] || 0
                const maxCount = Math.max(...Object.values(distribuicaoCategorias), 1)
                const pct = (count / maxCount) * 100

                return (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--sd-ink-2,#4A5E78)' }}>
                        {cat.icon} {cat.label}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)' }}>
                        {count}
                      </span>
                    </div>
                    <div style={{
                      height: 6,
                      borderRadius: 3,
                      background: 'var(--sd-cream,#F7F4EE)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        borderRadius: 3,
                        background: cat.cor,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick actions */}
          <div style={{
            background: '#fff',
            border: '1px solid var(--sd-border,#E4DDD0)',
            borderRadius: 12,
            padding: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-ink-2,#4A5E78)', marginBottom: 14 }}>
              Ações Rápidas
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => { resetForm(); setFormPrioridade('urgente'); setFormCategoria('manutencao'); setShowModal(true) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  border: '1px solid var(--sd-border,#E4DDD0)',
                  borderRadius: 8,
                  background: 'var(--sd-cream,#F7F4EE)',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--sd-navy,#0D1B2E)',
                  fontWeight: 500,
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                🚨 Aviso Urgente
              </button>
              <button
                onClick={() => { resetForm(); setFormCategoria('assembleia'); setFormPrioridade('importante'); setShowModal(true) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  border: '1px solid var(--sd-border,#E4DDD0)',
                  borderRadius: 8,
                  background: 'var(--sd-cream,#F7F4EE)',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--sd-navy,#0D1B2E)',
                  fontWeight: 500,
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                🏛️ Convocatória AG
              </button>
              <button
                onClick={() => { resetForm(); setFormCategoria('financeiro'); setShowModal(true) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  border: '1px solid var(--sd-border,#E4DDD0)',
                  borderRadius: 8,
                  background: 'var(--sd-cream,#F7F4EE)',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--sd-navy,#0D1B2E)',
                  fontWeight: 500,
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                💶 Aviso Financeiro
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal: Novo Aviso */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(13,27,46,0.45)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 16,
              width: '100%',
              maxWidth: 560,
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(13,27,46,0.2)',
            }}
          >
            {/* Modal header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--sd-border,#E4DDD0)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h2 style={{
                fontFamily: "'Playfair Display',serif",
                fontSize: 20,
                color: 'var(--sd-navy,#0D1B2E)',
                margin: 0,
              }}>
                Novo Aviso
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  color: 'var(--sd-ink-3,#8A9BB0)',
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Título */}
              <div>
                <label style={labelStyle}>Título *</label>
                <input
                  type="text"
                  placeholder="Ex: Corte de água — Manutenção urgente"
                  value={formTitulo}
                  onChange={e => setFormTitulo(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Conteúdo */}
              <div>
                <label style={labelStyle}>Conteúdo *</label>
                <textarea
                  placeholder="Descreva o aviso com todos os detalhes relevantes..."
                  value={formConteudo}
                  onChange={e => setFormConteudo(e.target.value)}
                  rows={5}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 100 }}
                />
              </div>

              {/* Row: Categoria + Prioridade */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Categoria</label>
                  <select
                    value={formCategoria}
                    onChange={e => setFormCategoria(e.target.value as CategoriaAviso)}
                    style={inputStyle}
                  >
                    {Object.entries(CATEGORIAS).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Prioridade</label>
                  <select
                    value={formPrioridade}
                    onChange={e => setFormPrioridade(e.target.value as PrioridadeAviso)}
                    style={inputStyle}
                  >
                    {Object.entries(PRIORIDADES).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Imóvel */}
              <div>
                <label style={labelStyle}>Imóvel destinatário</label>
                <select
                  value={formImovel}
                  onChange={e => setFormImovel(e.target.value)}
                  style={inputStyle}
                >
                  <option value="todos">Todos os imóveis</option>
                  {IMOVEIS_DEMO.map(i => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>

              {/* Data expiração */}
              <div>
                <label style={labelStyle}>Data de expiração (opcional)</label>
                <input
                  type="date"
                  value={formExpiracao}
                  onChange={e => setFormExpiracao(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Anexo */}
              <div>
                <label style={labelStyle}>Anexo (opcional)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid var(--sd-border,#E4DDD0)',
                      borderRadius: 8,
                      background: 'var(--sd-cream,#F7F4EE)',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: 'var(--sd-ink-2,#4A5E78)',
                    }}
                  >
                    📎 Escolher ficheiro
                  </button>
                  {formAnexo && (
                    <span style={{ fontSize: 12, color: 'var(--sd-ink-2,#4A5E78)' }}>
                      {formAnexo}
                    </span>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--sd-border,#E4DDD0)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
            }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '10px 20px',
                  border: '1px solid var(--sd-border,#E4DDD0)',
                  borderRadius: 8,
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: 'var(--sd-ink-2,#4A5E78)',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateAviso}
                disabled={!formTitulo.trim() || !formConteudo.trim()}
                style={{
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: 8,
                  background: !formTitulo.trim() || !formConteudo.trim()
                    ? 'rgba(201,168,76,0.4)'
                    : 'var(--sd-gold,#C9A84C)',
                  color: '#fff',
                  cursor: !formTitulo.trim() || !formConteudo.trim() ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Publicar Aviso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Responsive: stack sidebar below on narrow screens */}
      <style>{`
        @media (max-width: 860px) {
          div[style*="gridTemplateColumns: '1fr 320px'"],
          div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

// ─── Shared Styles ──────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--sd-ink-2,#4A5E78)',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--sd-border,#E4DDD0)',
  borderRadius: 8,
  fontSize: 14,
  color: 'var(--sd-navy,#0D1B2E)',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const filterSelectStyle: React.CSSProperties = {
  padding: '7px 12px',
  border: '1px solid var(--sd-border,#E4DDD0)',
  borderRadius: 8,
  fontSize: 13,
  color: 'var(--sd-navy,#0D1B2E)',
  background: '#fff',
  outline: 'none',
  cursor: 'pointer',
}

const actionBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  border: '1px solid var(--sd-border,#E4DDD0)',
  borderRadius: 8,
  background: 'var(--sd-cream,#F7F4EE)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--sd-ink-2,#4A5E78)',
}
