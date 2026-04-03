'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import type { User } from '@supabase/supabase-js'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type CanalMensagem = 'whatsapp' | 'sms' | 'email'
type EstadoMensagem = 'enviado' | 'entregue' | 'lido' | 'falhou'
type EstadoEnvioMassa = 'rascunho' | 'agendado' | 'enviado'

interface Condomino {
  id: string
  nome: string
  fracao: string
  imovel: string
  telefone: string
  email: string
  canalPreferido: CanalMensagem
  estadoPagamento: 'em_dia' | 'atrasado' | 'divida'
}

interface Mensagem {
  id: string
  condominoId: string
  condominoNome: string
  canal: CanalMensagem
  direcao: 'enviada' | 'recebida'
  conteudo: string
  estado: EstadoMensagem
  dataEnvio: string
  templateId?: string
}

interface ModeloMensagem {
  id: string
  nome: string
  categoria: 'lembrete_quota' | 'convocatoria_ag' | 'aviso_corte_agua' | 'confirmacao_pagamento' | 'aviso_manutencao' | 'personalizado'
  canal: CanalMensagem | 'todos'
  conteudo: string
  variaveis: string[]      // {nome}, {fracao}, {valor}, {data}
  criadoPor: string
  dataCriacao: string
  vezeUsado: number
}

interface EnvioMassa {
  id: string
  nome: string
  templateId?: string
  mensagemCustom?: string
  destinatarios: string[]    // condominoIds
  filtro: { tipo: 'todos' | 'imovel' | 'estado_pagamento'; valor?: string }
  canal: CanalMensagem
  estado: EstadoEnvioMassa
  dataAgendada?: string
  dataEnvio?: string
  stats: { enviadas: number; entregues: number; lidas: number; falharam: number }
  criadoPor: string
}

interface ConfigWhatsApp {
  whatsappApiKey: string
  smsProvider: string
  smsApiKey: string
  autoLembreteAtivo: boolean
  diasAntesVencimento: number
  canalPadrao: CanalMensagem
}

interface Props {
  user: User
  userRole: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const CANAL_CONFIG: Record<CanalMensagem, { emoji: string; label: string; cor: string }> = {
  whatsapp: { emoji: '💬', label: 'WhatsApp', cor: '#25D366' },
  sms:      { emoji: '📱', label: 'SMS',      cor: '#6C5CE7' },
  email:    { emoji: '📧', label: 'Email',    cor: '#3B82F6' },
}

const ESTADO_MSG_CONFIG: Record<EstadoMensagem, { label: string; emoji: string; cor: string }> = {
  enviado:  { label: 'Enviado',  emoji: '✓',  cor: 'var(--sd-ink-3, #8B8178)' },
  entregue: { label: 'Entregue', emoji: '✓✓', cor: 'var(--sd-ink-2, #5A5149)' },
  lido:     { label: 'Lido',     emoji: '✓✓', cor: '#3B82F6' },
  falhou:   { label: 'Falhou',   emoji: '✕',  cor: '#C0392B' },
}

const ESTADO_PAG_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  em_dia:   { label: 'Em dia',   bg: '#E6F4F2', color: '#1A7A6E' },
  atrasado: { label: 'Atrasado', bg: '#FEF5E4', color: '#D4830A' },
  divida:   { label: 'Em divida', bg: '#FDECEA', color: '#C0392B' },
}

const CATEGORIA_MODELO: Record<string, { label: string; emoji: string }> = {
  lembrete_quota:        { label: 'Lembrete quota',       emoji: '💰' },
  convocatoria_ag:       { label: 'Convocatoria AG',      emoji: '📋' },
  aviso_corte_agua:      { label: 'Aviso corte agua',     emoji: '🚿' },
  confirmacao_pagamento: { label: 'Confirmacao pagamento', emoji: '✅' },
  aviso_manutencao:      { label: 'Aviso manutenção',     emoji: '🔧' },
  personalizado:         { label: 'Personalizado',        emoji: '✏️' },
}

const formatDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return s }
}

// ─── Dados demo ──────────────────────────────────────────────────────────────

const gerarDadosDemo = (userId: string) => {
  const condominos: Condomino[] = [
    { id: 'cd1', nome: 'Ana Silva', fracao: 'Fração A - 1.o Esq', imovel: 'Edifício Aurora', telefone: '+351912345001', email: 'ana.silva@email.pt', canalPreferido: 'whatsapp', estadoPagamento: 'em_dia' },
    { id: 'cd2', nome: 'Carlos Santos', fracao: 'Fração B - 1.o Dto', imovel: 'Edifício Aurora', telefone: '+351912345002', email: 'carlos.s@email.pt', canalPreferido: 'whatsapp', estadoPagamento: 'atrasado' },
    { id: 'cd3', nome: 'Maria Costa', fracao: 'Fração C - 2.o Esq', imovel: 'Edifício Aurora', telefone: '+351912345003', email: 'maria.costa@email.pt', canalPreferido: 'sms', estadoPagamento: 'em_dia' },
    { id: 'cd4', nome: 'Pedro Ferreira', fracao: 'Fração D - 2.o Dto', imovel: 'Edifício Aurora', telefone: '+351912345004', email: 'pedro.f@email.pt', canalPreferido: 'email', estadoPagamento: 'divida' },
    { id: 'cd5', nome: 'Sofia Oliveira', fracao: 'Fração A - R/C', imovel: 'Edifício Sol', telefone: '+351912345005', email: 'sofia.o@email.pt', canalPreferido: 'whatsapp', estadoPagamento: 'em_dia' },
    { id: 'cd6', nome: 'João Martins', fracao: 'Fração B - 1.o', imovel: 'Edifício Sol', telefone: '+351912345006', email: 'joao.m@email.pt', canalPreferido: 'whatsapp', estadoPagamento: 'atrasado' },
  ]

  const hoje = new Date()
  const mensagens: Mensagem[] = [
    { id: 'm1', condominoId: 'cd1', condominoNome: 'Ana Silva', canal: 'whatsapp', direcao: 'enviada', conteudo: 'Boa tarde Ana. Lembramos que a quota de marco vence dia 15. Valor: 125,00 EUR. Obrigado!', estado: 'lido', dataEnvio: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 3, 14, 30).toISOString() },
    { id: 'm2', condominoId: 'cd1', condominoNome: 'Ana Silva', canal: 'whatsapp', direcao: 'recebida', conteudo: 'Obrigada, ja procedi ao pagamento.', estado: 'lido', dataEnvio: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 3, 15, 12).toISOString() },
    { id: 'm3', condominoId: 'cd2', condominoNome: 'Carlos Santos', canal: 'whatsapp', direcao: 'enviada', conteudo: 'Sr. Carlos, a quota de fevereiro encontra-se em atraso (85,00 EUR). Agradecemos a regularizacao.', estado: 'entregue', dataEnvio: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 5, 10, 0).toISOString() },
    { id: 'm4', condominoId: 'cd4', condominoNome: 'Pedro Ferreira', canal: 'email', direcao: 'enviada', conteudo: 'Exmo. Sr. Ferreira, serve a presente para informar que existem quotas em divida no valor de 340,00 EUR...', estado: 'enviado', dataEnvio: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1, 9, 0).toISOString() },
    { id: 'm5', condominoId: 'cd3', condominoNome: 'Maria Costa', canal: 'sms', direcao: 'enviada', conteudo: 'CONDOMINIO AURORA: Aviso manutenção elevador dia 20/03. Possivel interrupcao 9h-14h.', estado: 'entregue', dataEnvio: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 2, 8, 30).toISOString() },
    { id: 'm6', condominoId: 'cd5', condominoNome: 'Sofia Oliveira', canal: 'whatsapp', direcao: 'enviada', conteudo: 'Convocatoria: Assembleia Geral Ordinaria dia 25/03 as 19h na sala do condominio. Ordem de trabalhos em anexo.', estado: 'lido', dataEnvio: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 7, 16, 0).toISOString() },
  ]

  const modelos: ModeloMensagem[] = [
    { id: 'tpl1', nome: 'Lembrete quota mensal', categoria: 'lembrete_quota', canal: 'whatsapp', conteudo: 'Boa tarde {nome}. Lembramos que a quota de {data} vence em breve. Valor: {valor}. Obrigado!', variaveis: ['{nome}', '{data}', '{valor}'], criadoPor: 'Sistema', dataCriacao: '2025-01-15', vezeUsado: 34 },
    { id: 'tpl2', nome: 'Convocatoria AG', categoria: 'convocatoria_ag', canal: 'todos', conteudo: 'Exmo(a) {nome}, condomino(a) da {fracao}. Fica convocado(a) para a Assembleia Geral que se realizara no dia {data}. A sua presenca e fundamental.', variaveis: ['{nome}', '{fracao}', '{data}'], criadoPor: 'Sistema', dataCriacao: '2025-01-15', vezeUsado: 12 },
    { id: 'tpl3', nome: 'Aviso corte agua', categoria: 'aviso_corte_agua', canal: 'sms', conteudo: 'AVISO: Corte de agua previsto para {data} entre 9h e 14h para obras de manutencao. Pedimos desculpa pelo incomodo.', variaveis: ['{data}'], criadoPor: 'Sistema', dataCriacao: '2025-01-15', vezeUsado: 5 },
    { id: 'tpl4', nome: 'Confirmacao pagamento', categoria: 'confirmacao_pagamento', canal: 'whatsapp', conteudo: 'Obrigado {nome}! Confirmamos a rececao do pagamento de {valor} referente a {fracao}. Boa continuacao!', variaveis: ['{nome}', '{valor}', '{fracao}'], criadoPor: 'Sistema', dataCriacao: '2025-01-15', vezeUsado: 28 },
    { id: 'tpl5', nome: 'Aviso manutenção', categoria: 'aviso_manutencao', canal: 'todos', conteudo: 'Prezado(a) {nome}, informamos que no dia {data} irá decorrer manutenção no edifício. Agradecemos a compreensão.', variaveis: ['{nome}', '{data}'], criadoPor: 'Sistema', dataCriacao: '2025-01-15', vezeUsado: 18 },
  ]

  const enviosMassa: EnvioMassa[] = [
    {
      id: 'em1', nome: 'Lembrete quotas marco', templateId: 'tpl1', destinatarios: ['cd1', 'cd2', 'cd3', 'cd5', 'cd6'],
      filtro: { tipo: 'todos' }, canal: 'whatsapp', estado: 'enviado',
      dataEnvio: new Date(hoje.getFullYear(), hoje.getMonth(), 1, 9, 0).toISOString(),
      stats: { enviadas: 5, entregues: 4, lidas: 3, falharam: 0 }, criadoPor: 'admin',
    },
    {
      id: 'em2', nome: 'Convocatoria AG marco', templateId: 'tpl2', destinatarios: ['cd1', 'cd2', 'cd3', 'cd4', 'cd5', 'cd6'],
      filtro: { tipo: 'todos' }, canal: 'whatsapp', estado: 'enviado',
      dataEnvio: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 7, 16, 0).toISOString(),
      stats: { enviadas: 6, entregues: 6, lidas: 4, falharam: 0 }, criadoPor: 'admin',
    },
  ]

  return { condominos, mensagens, modelos, enviosMassa }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function WhatsAppCondominosSection({ user, userRole }: Props) {
  const STORAGE_KEY = `fixit_whatsapp_${user.id}`

  const [tab, setTab] = useState<'mensagens' | 'modelos' | 'envio_massa' | 'configuracao'>('mensagens')
  const [condominos, setCondominos] = useState<Condomino[]>([])
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [modelos, setModelos] = useState<ModeloMensagem[]>([])
  const [enviosMassa, setEnviosMassa] = useState<EnvioMassa[]>([])
  const [config, setConfig] = useState<ConfigWhatsApp>({
    whatsappApiKey: '', smsProvider: '', smsApiKey: '',
    autoLembreteAtivo: true, diasAntesVencimento: 5, canalPadrao: 'whatsapp',
  })

  // Mensagens tab state
  const [selectedCondomino, setSelectedCondomino] = useState<string>('todos')
  const [filtroCanal, setFiltroCanal] = useState<CanalMensagem | 'todos'>('todos')
  const [novaMensagem, setNovaMensagem] = useState('')
  const [novoCanal, setNovoCanal] = useState<CanalMensagem>('whatsapp')
  const [chatCondomino, setChatCondomino] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Modelos tab state
  const [showFormModelo, setShowFormModelo] = useState(false)
  const [fmNome, setFmNome] = useState('')
  const [fmCategoria, setFmCategoria] = useState<ModeloMensagem['categoria']>('personalizado')
  const [fmCanal, setFmCanal] = useState<CanalMensagem | 'todos'>('todos')
  const [fmConteudo, setFmConteudo] = useState('')
  const [editingModelo, setEditingModelo] = useState<ModeloMensagem | null>(null)

  // Envio massa state
  const [showFormEnvio, setShowFormEnvio] = useState(false)
  const [feNome, setFeNome] = useState('')
  const [feTemplateId, setFeTemplateId] = useState('')
  const [feMsgCustom, setFeMsgCustom] = useState('')
  const [feFiltroTipo, setFeFiltroTipo] = useState<'todos' | 'imovel' | 'estado_pagamento'>('todos')
  const [feFiltroValor, setFeFiltroValor] = useState('')
  const [feCanal, setFeCanal] = useState<CanalMensagem>('whatsapp')
  const [feDataAgendada, setFeDataAgendada] = useState('')

  // ── Storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        setCondominos(data.condominos || [])
        setMensagens(data.mensagens || [])
        setModelos(data.modelos || [])
        setEnviosMassa(data.enviosMassa || [])
        if (data.config) setConfig(data.config)
      } else {
        const demo = gerarDadosDemo(user.id)
        setCondominos(demo.condominos)
        setMensagens(demo.mensagens)
        setModelos(demo.modelos)
        setEnviosMassa(demo.enviosMassa)
      }
    } catch { /* ignore */ }
  }, [])

  const saveAll = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ condominos, mensagens, modelos, enviosMassa, config }))
  }
  useEffect(() => { saveAll() }, [condominos, mensagens, modelos, enviosMassa, config])

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, chatCondomino])

  // ── Computed
  const mensagensFiltradas = useMemo(() => {
    let filtered = mensagens
    if (selectedCondomino !== 'todos') filtered = filtered.filter(m => m.condominoId === selectedCondomino)
    if (filtroCanal !== 'todos') filtered = filtered.filter(m => m.canal === filtroCanal)
    return filtered.sort((a, b) => new Date(a.dataEnvio).getTime() - new Date(b.dataEnvio).getTime())
  }, [mensagens, selectedCondomino, filtroCanal])

  const chatMensagens = useMemo(() => {
    if (!chatCondomino) return []
    return mensagens
      .filter(m => m.condominoId === chatCondomino)
      .sort((a, b) => new Date(a.dataEnvio).getTime() - new Date(b.dataEnvio).getTime())
  }, [mensagens, chatCondomino])

  const destinatariosEnvio = useMemo(() => {
    if (feFiltroTipo === 'todos') return condominos
    if (feFiltroTipo === 'imovel') return condominos.filter(c => c.imovel === feFiltroValor)
    if (feFiltroTipo === 'estado_pagamento') return condominos.filter(c => c.estadoPagamento === feFiltroValor)
    return condominos
  }, [condominos, feFiltroTipo, feFiltroValor])

  const imoveisUnicos = useMemo(() => [...new Set(condominos.map(c => c.imovel))], [condominos])

  // ── Actions
  const enviarMensagem = () => {
    if (!chatCondomino || !novaMensagem.trim()) return
    const cond = condominos.find(c => c.id === chatCondomino)
    if (!cond) return
    const nova: Mensagem = {
      id: crypto.randomUUID(),
      condominoId: chatCondomino,
      condominoNome: cond.nome,
      canal: novoCanal,
      direcao: 'enviada',
      conteudo: novaMensagem.trim(),
      estado: 'enviado',
      dataEnvio: new Date().toISOString(),
    }
    setMensagens(prev => [...prev, nova])
    setNovaMensagem('')
    // Simulate delivery after 2s
    setTimeout(() => {
      setMensagens(prev => prev.map(m => m.id === nova.id ? { ...m, estado: 'entregue' as EstadoMensagem } : m))
    }, 2000)
  }

  const guardarModelo = () => {
    if (!fmNome.trim() || !fmConteudo.trim()) return
    const variaveis = (fmConteudo.match(/\{[^}]+\}/g) || []) as string[]
    if (editingModelo) {
      setModelos(prev => prev.map(m => m.id === editingModelo.id ? {
        ...m, nome: fmNome.trim(), categoria: fmCategoria, canal: fmCanal,
        conteudo: fmConteudo.trim(), variaveis,
      } : m))
    } else {
      const novo: ModeloMensagem = {
        id: crypto.randomUUID(),
        nome: fmNome.trim(),
        categoria: fmCategoria,
        canal: fmCanal,
        conteudo: fmConteudo.trim(),
        variaveis,
        criadoPor: user.email || 'Utilizador',
        dataCriacao: new Date().toISOString().split('T')[0],
        vezeUsado: 0,
      }
      setModelos(prev => [novo, ...prev])
    }
    setFmNome(''); setFmCategoria('personalizado'); setFmCanal('todos'); setFmConteudo('')
    setEditingModelo(null); setShowFormModelo(false)
  }

  const editarModelo = (m: ModeloMensagem) => {
    setEditingModelo(m)
    setFmNome(m.nome); setFmCategoria(m.categoria); setFmCanal(m.canal); setFmConteudo(m.conteudo)
    setShowFormModelo(true)
  }

  const eliminarModelo = (id: string) => {
    setModelos(prev => prev.filter(m => m.id !== id))
  }

  const criarEnvioMassa = () => {
    if (!feNome.trim()) return
    const destIds = destinatariosEnvio.map(c => c.id)
    const novo: EnvioMassa = {
      id: crypto.randomUUID(),
      nome: feNome.trim(),
      templateId: feTemplateId || undefined,
      mensagemCustom: feMsgCustom.trim() || undefined,
      destinatarios: destIds,
      filtro: { tipo: feFiltroTipo, valor: feFiltroValor || undefined },
      canal: feCanal,
      estado: feDataAgendada ? 'agendado' : 'enviado',
      dataAgendada: feDataAgendada || undefined,
      dataEnvio: feDataAgendada ? undefined : new Date().toISOString(),
      stats: feDataAgendada ? { enviadas: 0, entregues: 0, lidas: 0, falharam: 0 }
        : { enviadas: destIds.length, entregues: Math.floor(destIds.length * 0.85), lidas: Math.floor(destIds.length * 0.6), falharam: 0 },
      criadoPor: user.email || 'Utilizador',
    }
    setEnviosMassa(prev => [novo, ...prev])
    setFeNome(''); setFeTemplateId(''); setFeMsgCustom(''); setFeFiltroTipo('todos'); setFeFiltroValor(''); setFeCanal('whatsapp'); setFeDataAgendada('')
    setShowFormEnvio(false)
  }

  // ── Styles
  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 12, border: '1px solid var(--sd-border, #E4DDD0)',
    padding: 20, marginBottom: 16,
  }
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-3, #8B8178)', marginBottom: 6, display: 'block' }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--sd-border, #E4DDD0)',
    fontSize: 14, color: 'var(--sd-navy, #0D1B2E)', background: 'var(--sd-cream, #F7F4EE)', outline: 'none',
  }
  const btnPrimary: React.CSSProperties = {
    padding: '10px 20px', borderRadius: 8, border: 'none',
    background: 'var(--sd-gold, #C9A84C)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  }
  const btnSecondary: React.CSSProperties = {
    padding: '10px 20px', borderRadius: 8, border: '1px solid var(--sd-border, #E4DDD0)',
    background: '#fff', color: 'var(--sd-navy, #0D1B2E)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
  }

  // ── Tabs
  const tabs = [
    { key: 'mensagens' as const, label: 'Mensagens', icon: '💬' },
    { key: 'modelos' as const, label: 'Modelos', icon: '📝' },
    { key: 'envio_massa' as const, label: 'Envio em Massa', icon: '📤' },
    { key: 'configuracao' as const, label: 'Configuracao', icon: '⚙️' },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
          💬 Comunicacao com Condominos
        </h2>
        <p style={{ fontSize: 14, color: 'var(--sd-ink-3, #8B8178)', margin: '4px 0 0' }}>
          WhatsApp, SMS e Email — mensagens, modelos e envios em massa
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>
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
          </button>
        ))}
      </div>

      {/* ═══════════ TAB: Mensagens ═══════════ */}
      {tab === 'mensagens' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, minHeight: 500 }}>
          {/* Contact list */}
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 8 }}>Condominos</div>
              <select value={filtroCanal} onChange={e => setFiltroCanal(e.target.value as CanalMensagem | 'todos')} style={{ ...inputStyle, fontSize: 12, padding: '6px 8px' }}>
                <option value="todos">Todos os canais</option>
                {Object.entries(CANAL_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
              </select>
            </div>
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {condominos.map(cond => {
                const ultimaMsg = mensagens
                  .filter(m => m.condominoId === cond.id)
                  .sort((a, b) => new Date(b.dataEnvio).getTime() - new Date(a.dataEnvio).getTime())[0]
                const isSelected = chatCondomino === cond.id
                const canal = CANAL_CONFIG[cond.canalPreferido]
                const pagCfg = ESTADO_PAG_CONFIG[cond.estadoPagamento]
                return (
                  <div
                    key={cond.id}
                    onClick={() => setChatCondomino(cond.id)}
                    style={{
                      padding: '12px 16px', cursor: 'pointer',
                      background: isSelected ? 'var(--sd-cream, #F7F4EE)' : '#fff',
                      borderBottom: '1px solid var(--sd-border, #E4DDD0)',
                      borderLeft: isSelected ? '3px solid var(--sd-gold, #C9A84C)' : '3px solid transparent',
                      transition: 'all 0.1s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{cond.nome}</div>
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: pagCfg.bg, color: pagCfg.color, fontWeight: 600 }}>
                        {pagCfg.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8B8178)', marginTop: 2 }}>{cond.fracao}</div>
                    {ultimaMsg && (
                      <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8B8178)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {canal.emoji} {ultimaMsg.conteudo.slice(0, 40)}...
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Chat area */}
          <div style={{ ...cardStyle, padding: 0, display: 'flex', flexDirection: 'column' }}>
            {!chatCondomino ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sd-ink-3, #8B8178)', fontSize: 14 }}>
                Selecione um condomino para ver as mensagens
              </div>
            ) : (
              <>
                {/* Chat header */}
                {(() => {
                  const cond = condominos.find(c => c.id === chatCondomino)
                  if (!cond) return null
                  return (
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--sd-border, #E4DDD0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{cond.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8B8178)' }}>{cond.fracao} | {cond.telefone}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {Object.entries(CANAL_CONFIG).map(([k, v]) => (
                          <span key={k} style={{
                            fontSize: 11, padding: '3px 8px', borderRadius: 4,
                            background: cond.canalPreferido === k ? v.cor + '20' : 'transparent',
                            color: cond.canalPreferido === k ? v.cor : 'var(--sd-ink-3, #8B8178)',
                            fontWeight: cond.canalPreferido === k ? 600 : 400,
                          }}>{v.emoji} {v.label}</span>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Messages */}
                <div style={{ flex: 1, padding: 16, overflowY: 'auto', maxHeight: 360, background: '#FAFAF8' }}>
                  {chatMensagens.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--sd-ink-3, #8B8178)', fontSize: 13, paddingTop: 40 }}>
                      Nenhuma mensagem com este condomino
                    </div>
                  ) : chatMensagens.map(msg => {
                    const estCfg = ESTADO_MSG_CONFIG[msg.estado]
                    const canalCfg = CANAL_CONFIG[msg.canal]
                    const isEnviada = msg.direcao === 'enviada'
                    return (
                      <div key={msg.id} style={{
                        display: 'flex', justifyContent: isEnviada ? 'flex-end' : 'flex-start',
                        marginBottom: 10,
                      }}>
                        <div style={{
                          maxWidth: '75%', padding: '10px 14px', borderRadius: 12,
                          background: isEnviada ? 'var(--sd-navy, #0D1B2E)' : '#fff',
                          color: isEnviada ? '#fff' : 'var(--sd-navy, #0D1B2E)',
                          border: isEnviada ? 'none' : '1px solid var(--sd-border, #E4DDD0)',
                          borderBottomRightRadius: isEnviada ? 4 : 12,
                          borderBottomLeftRadius: isEnviada ? 12 : 4,
                        }}>
                          <div style={{ fontSize: 13, lineHeight: 1.5 }}>{msg.conteudo}</div>
                          <div style={{
                            display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6,
                            marginTop: 6, fontSize: 10,
                            color: isEnviada ? 'rgba(255,255,255,0.6)' : 'var(--sd-ink-3, #8B8178)',
                          }}>
                            <span>{canalCfg.emoji}</span>
                            <span>{new Date(msg.dataEnvio).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
                            {isEnviada && <span style={{ color: msg.estado === 'lido' ? '#3B82F6' : 'inherit' }}>{estCfg.emoji}</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--sd-border, #E4DDD0)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select value={novoCanal} onChange={e => setNovoCanal(e.target.value as CanalMensagem)} style={{ ...inputStyle, width: 'auto', padding: '8px 10px', fontSize: 12 }}>
                    {Object.entries(CANAL_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                  </select>
                  <input
                    value={novaMensagem}
                    onChange={e => setNovaMensagem(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') enviarMensagem() }}
                    placeholder="Escrever mensagem..."
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={enviarMensagem} style={{ ...btnPrimary, padding: '10px 16px' }}>
                    Enviar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ TAB: Modelos ═══════════ */}
      {tab === 'modelos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: 'var(--sd-ink-3, #8B8178)' }}>
              {modelos.length} modelo{modelos.length !== 1 ? 's' : ''} disponive{modelos.length !== 1 ? 'is' : 'l'}
            </div>
            <button onClick={() => { setEditingModelo(null); setFmNome(''); setFmCategoria('personalizado'); setFmCanal('todos'); setFmConteudo(''); setShowFormModelo(true) }} style={btnPrimary}>
              + Novo modelo
            </button>
          </div>

          {showFormModelo && (
            <div style={{ ...cardStyle, borderLeft: '4px solid var(--sd-gold, #C9A84C)' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 14 }}>
                {editingModelo ? 'Editar modelo' : 'Novo modelo'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Nome</label>
                  <input value={fmNome} onChange={e => setFmNome(e.target.value)} placeholder="Nome do modelo" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Categoria</label>
                  <select value={fmCategoria} onChange={e => setFmCategoria(e.target.value as ModeloMensagem['categoria'])} style={inputStyle}>
                    {Object.entries(CATEGORIA_MODELO).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Canal</label>
                  <select value={fmCanal} onChange={e => setFmCanal(e.target.value as CanalMensagem | 'todos')} style={inputStyle}>
                    <option value="todos">Todos</option>
                    {Object.entries(CANAL_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Conteudo (variaveis: {'{nome}'}, {'{fracao}'}, {'{valor}'}, {'{data}'})</label>
                <textarea
                  value={fmConteudo}
                  onChange={e => setFmConteudo(e.target.value)}
                  placeholder="Escreva o conteudo do modelo..."
                  rows={4}
                  style={{ ...inputStyle, resize: 'vertical' as const }}
                />
              </div>
              {fmConteudo && (
                <div style={{ padding: 12, borderRadius: 8, background: '#F7F4EE', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--sd-ink-3, #8B8178)', marginBottom: 4 }}>Pre-visualizacao:</div>
                  <div style={{ fontSize: 13, color: 'var(--sd-navy, #0D1B2E)' }}>
                    {fmConteudo
                      .replace(/\{nome\}/g, 'Ana Silva')
                      .replace(/\{fracao\}/g, 'Fração A')
                      .replace(/\{valor\}/g, '125,00 EUR')
                      .replace(/\{data\}/g, '15/03/2026')}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={guardarModelo} style={btnPrimary}>{editingModelo ? 'Guardar' : 'Criar modelo'}</button>
                <button onClick={() => { setShowFormModelo(false); setEditingModelo(null) }} style={btnSecondary}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Models grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {modelos.map(m => {
              const cat = CATEGORIA_MODELO[m.categoria]
              return (
                <div key={m.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{m.nome}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 4, background: '#F7F4EE', color: 'var(--sd-ink-2, #5A5149)', fontWeight: 500 }}>
                          {cat.emoji} {cat.label}
                        </span>
                        <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 4, background: '#F7F4EE', color: 'var(--sd-ink-2, #5A5149)', fontWeight: 500 }}>
                          {m.canal === 'todos' ? '📡 Todos' : CANAL_CONFIG[m.canal as CanalMensagem].emoji + ' ' + CANAL_CONFIG[m.canal as CanalMensagem].label}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8B8178)' }}>
                      {m.vezeUsado}x usado
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #5A5149)', lineHeight: 1.5, marginBottom: 12, padding: 10, background: '#FAFAF8', borderRadius: 8 }}>
                    {m.conteudo}
                  </div>
                  {m.variaveis.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                      {m.variaveis.map(v => (
                        <span key={v} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--sd-gold, #C9A84C)' + '20', color: 'var(--sd-gold, #C9A84C)', fontWeight: 600 }}>
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => editarModelo(m)} style={{ ...btnSecondary, padding: '6px 12px', fontSize: 12 }}>Editar</button>
                    <button onClick={() => eliminarModelo(m.id)} style={{ ...btnSecondary, padding: '6px 12px', fontSize: 12, color: '#C0392B', borderColor: '#FDECEA' }}>Eliminar</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══════════ TAB: Envio em Massa ═══════════ */}
      {tab === 'envio_massa' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: 'var(--sd-ink-3, #8B8178)' }}>
              {enviosMassa.length} envio{enviosMassa.length !== 1 ? 's' : ''} em massa
            </div>
            <button onClick={() => setShowFormEnvio(true)} style={btnPrimary}>
              + Novo envio
            </button>
          </div>

          {showFormEnvio && (
            <div style={{ ...cardStyle, borderLeft: '4px solid var(--sd-gold, #C9A84C)' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 14 }}>
                Novo envio em massa
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Nome do envio</label>
                  <input value={feNome} onChange={e => setFeNome(e.target.value)} placeholder="Ex: Lembrete quotas abril" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Canal</label>
                  <select value={feCanal} onChange={e => setFeCanal(e.target.value as CanalMensagem)} style={inputStyle}>
                    {Object.entries(CANAL_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Recipients filter */}
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Destinatarios</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <select value={feFiltroTipo} onChange={e => { setFeFiltroTipo(e.target.value as typeof feFiltroTipo); setFeFiltroValor('') }} style={{ ...inputStyle, width: 'auto' }}>
                    <option value="todos">Todos os condominos</option>
                    <option value="imovel">Por imovel</option>
                    <option value="estado_pagamento">Por estado de pagamento</option>
                  </select>
                  {feFiltroTipo === 'imovel' && (
                    <select value={feFiltroValor} onChange={e => setFeFiltroValor(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                      <option value="">Selecionar imovel...</option>
                      {imoveisUnicos.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  )}
                  {feFiltroTipo === 'estado_pagamento' && (
                    <select value={feFiltroValor} onChange={e => setFeFiltroValor(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                      <option value="">Selecionar estado...</option>
                      <option value="em_dia">Em dia</option>
                      <option value="atrasado">Atrasado</option>
                      <option value="divida">Em divida</option>
                    </select>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--sd-gold, #C9A84C)', fontWeight: 600 }}>
                  {destinatariosEnvio.length} destinatario{destinatariosEnvio.length !== 1 ? 's' : ''} selecionado{destinatariosEnvio.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Template or custom */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Modelo (opcional)</label>
                  <select value={feTemplateId} onChange={e => setFeTemplateId(e.target.value)} style={inputStyle}>
                    <option value="">Mensagem personalizada</option>
                    {modelos.map(m => <option key={m.id} value={m.id}>{CATEGORIA_MODELO[m.categoria].emoji} {m.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Agendar (opcional)</label>
                  <input type="datetime-local" value={feDataAgendada} onChange={e => setFeDataAgendada(e.target.value)} style={inputStyle} />
                </div>
              </div>

              {!feTemplateId && (
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Mensagem personalizada</label>
                  <textarea
                    value={feMsgCustom}
                    onChange={e => setFeMsgCustom(e.target.value)}
                    placeholder="Escreva a mensagem..."
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' as const }}
                  />
                </div>
              )}

              {feTemplateId && (() => {
                const tpl = modelos.find(m => m.id === feTemplateId)
                return tpl ? (
                  <div style={{ padding: 12, borderRadius: 8, background: '#F7F4EE', marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--sd-ink-3, #8B8178)', marginBottom: 4 }}>Pre-visualizacao:</div>
                    <div style={{ fontSize: 13, color: 'var(--sd-navy, #0D1B2E)' }}>{tpl.conteudo}</div>
                  </div>
                ) : null
              })()}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={criarEnvioMassa} style={btnPrimary}>
                  {feDataAgendada ? 'Agendar envio' : 'Enviar agora'}
                </button>
                <button onClick={() => setShowFormEnvio(false)} style={btnSecondary}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Envios list */}
          {enviosMassa.map(em => {
            const tpl = em.templateId ? modelos.find(m => m.id === em.templateId) : null
            const total = em.stats.enviadas || 1
            return (
              <div key={em.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{em.nome}</div>
                    <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8B8178)', marginTop: 2 }}>
                      {CANAL_CONFIG[em.canal].emoji} {CANAL_CONFIG[em.canal].label} | {em.destinatarios.length} destinatarios
                      {em.dataEnvio && ` | Enviado ${formatDate(em.dataEnvio)}`}
                      {em.dataAgendada && !em.dataEnvio && ` | Agendado para ${formatDate(em.dataAgendada)}`}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 6, fontWeight: 600,
                    background: em.estado === 'enviado' ? '#E6F4F2' : em.estado === 'agendado' ? '#FEF5E4' : '#F7F4EE',
                    color: em.estado === 'enviado' ? '#1A7A6E' : em.estado === 'agendado' ? '#D4830A' : 'var(--sd-ink-3, #8B8178)',
                  }}>
                    {em.estado === 'enviado' ? 'Enviado' : em.estado === 'agendado' ? 'Agendado' : 'Rascunho'}
                  </span>
                </div>

                {tpl && (
                  <div style={{ fontSize: 12, color: 'var(--sd-ink-2, #5A5149)', marginBottom: 12, padding: 8, background: '#FAFAF8', borderRadius: 6 }}>
                    Modelo: {tpl.nome}
                  </div>
                )}

                {/* Stats bars */}
                {em.estado === 'enviado' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {[
                      { label: 'Enviadas', value: em.stats.enviadas, color: 'var(--sd-ink-2, #5A5149)' },
                      { label: 'Entregues', value: em.stats.entregues, color: '#1A7A6E' },
                      { label: 'Lidas', value: em.stats.lidas, color: '#3B82F6' },
                      { label: 'Falharam', value: em.stats.falharam, color: '#C0392B' },
                    ].map((s, i) => (
                      <div key={i}>
                        <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8B8178)', marginBottom: 4 }}>{s.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ height: 4, borderRadius: 2, background: '#F0EDE8', marginTop: 4 }}>
                          <div style={{ height: '100%', borderRadius: 2, background: s.color, width: `${(s.value / total * 100)}%`, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {enviosMassa.length === 0 && !showFormEnvio && (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 40, color: 'var(--sd-ink-3, #8B8178)', fontSize: 13 }}>
              Nenhum envio em massa realizado
            </div>
          )}
        </div>
      )}

      {/* ═══════════ TAB: Configuração ═══════════ */}
      {tab === 'configuracao' && (
        <div>
          {/* WhatsApp API */}
          <div style={cardStyle}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 14 }}>
              💬 WhatsApp Business API
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Chave API WhatsApp Business</label>
              <input
                type="password"
                value={config.whatsappApiKey}
                onChange={e => setConfig(prev => ({ ...prev, whatsappApiKey: e.target.value }))}
                placeholder="Inserir chave API..."
                style={inputStyle}
              />
              <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8B8178)', marginTop: 4 }}>
                Obtenha a chave em business.whatsapp.com/api
              </div>
            </div>
            <div style={{
              padding: 12, borderRadius: 8,
              background: config.whatsappApiKey ? '#E6F4F2' : '#FEF5E4',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: config.whatsappApiKey ? '#1A7A6E' : '#D4830A' }}>
                {config.whatsappApiKey ? '✓ API configurada' : '⚠ API nao configurada — mensagens em modo demonstracao'}
              </div>
            </div>
          </div>

          {/* SMS Provider */}
          <div style={cardStyle}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 14 }}>
              📱 Fornecedor SMS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Fornecedor</label>
                <select value={config.smsProvider} onChange={e => setConfig(prev => ({ ...prev, smsProvider: e.target.value }))} style={inputStyle}>
                  <option value="">Selecionar...</option>
                  <option value="twilio">Twilio</option>
                  <option value="vonage">Vonage</option>
                  <option value="messagebird">MessageBird</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Chave API SMS</label>
                <input
                  type="password"
                  value={config.smsApiKey}
                  onChange={e => setConfig(prev => ({ ...prev, smsApiKey: e.target.value }))}
                  placeholder="Inserir chave..."
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Auto-reminders */}
          <div style={cardStyle}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 14 }}>
              🔄 Lembretes automaticos
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <button
                onClick={() => setConfig(prev => ({ ...prev, autoLembreteAtivo: !prev.autoLembreteAtivo }))}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: config.autoLembreteAtivo ? '#1A7A6E' : '#E4DDD0',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, left: config.autoLembreteAtivo ? 22 : 2,
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </button>
              <span style={{ fontSize: 14, color: 'var(--sd-navy, #0D1B2E)' }}>
                Enviar lembretes automaticos antes do vencimento das quotas
              </span>
            </div>
            {config.autoLembreteAtivo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--sd-ink-2, #5A5149)' }}>Enviar</span>
                <input
                  type="number"
                  value={config.diasAntesVencimento}
                  onChange={e => setConfig(prev => ({ ...prev, diasAntesVencimento: parseInt(e.target.value) || 5 }))}
                  style={{ ...inputStyle, width: 60, textAlign: 'center' as const }}
                  min={1} max={30}
                />
                <span style={{ fontSize: 13, color: 'var(--sd-ink-2, #5A5149)' }}>dias antes do vencimento</span>
              </div>
            )}
          </div>

          {/* Preferred channel per condomino */}
          <div style={cardStyle}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 14 }}>
              📡 Canal preferido por condomino
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Canal padrao</label>
              <select
                value={config.canalPadrao}
                onChange={e => setConfig(prev => ({ ...prev, canalPadrao: e.target.value as CanalMensagem }))}
                style={{ ...inputStyle, width: 'auto' }}
              >
                {Object.entries(CANAL_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
              </select>
            </div>
            {condominos.map(cond => (
              <div key={cond.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                borderBottom: '1px solid var(--sd-border, #E4DDD0)',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--sd-navy, #0D1B2E)' }}>{cond.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8B8178)' }}>{cond.fracao}</div>
                </div>
                <select
                  value={cond.canalPreferido}
                  onChange={e => setCondominos(prev => prev.map(c => c.id === cond.id ? { ...c, canalPreferido: e.target.value as CanalMensagem } : c))}
                  style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 12 }}
                >
                  {Object.entries(CANAL_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
