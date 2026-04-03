'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TabId = 'assinar' | 'assinados' | 'validacao' | 'configuracao'
type TipoDocumento = 'ata' | 'convocatoria' | 'orcamento' | 'contrato' | 'procuracao' | 'regulamento'
type EstadoAssinatura = 'assinado' | 'pendente' | 'expirado'
type EtapaCMD = 'identificacao' | 'pin' | 'sms'

interface DocumentoAssinado {
  id: string
  nome: string
  tipo: TipoDocumento
  dataAssinatura: string
  signatario: string
  nifSignatario: string
  telefoneSignatario: string
  estado: EstadoAssinatura
  hashSHA256: string
  tamanhoBytes: number
  edificioNom: string
}

interface ConfigCMD {
  nif: string
  telefone: string
  nomeCompleto: string
  notificacoesAtivas: boolean
  autoArquivar: boolean
  emailNotificacao: string
}

interface Props {
  user: User
  userRole: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const TIPO_DOC_CONFIG: Record<TipoDocumento, { label: string; emoji: string }> = {
  ata:           { label: 'Ata de Assembleia',        emoji: '📋' },
  convocatoria:  { label: 'Convocatória',             emoji: '📬' },
  orcamento:     { label: 'Orçamento',                emoji: '💰' },
  contrato:      { label: 'Contrato',                 emoji: '📝' },
  procuracao:    { label: 'Procuração',               emoji: '📄' },
  regulamento:   { label: 'Regulamento',              emoji: '📖' },
}

const ESTADO_CONFIG: Record<EstadoAssinatura, { label: string; bg: string; color: string; dot: string }> = {
  assinado: { label: 'Assinado',  bg: '#E6F4F2', color: '#1A7A6E', dot: '#1A7A6E' },
  pendente: { label: 'Pendente',  bg: '#FEF5E4', color: '#D4830A', dot: '#D4830A' },
  expirado: { label: 'Expirado',  bg: '#FDECEA', color: '#C0392B', dot: '#C0392B' },
}

const TAB_CONFIG: { id: TabId; label: string; emoji: string }[] = [
  { id: 'assinar',      label: 'Assinar Documento',   emoji: '✍️' },
  { id: 'assinados',    label: 'Documentos Assinados', emoji: '📑' },
  { id: 'validacao',    label: 'Validação',            emoji: '🔍' },
  { id: 'configuracao', label: 'Configuração',         emoji: '⚙️' },
]

const ETAPA_CMD_LABELS: Record<EtapaCMD, { titulo: string; descricao: string }> = {
  identificacao: { titulo: 'Identificação',          descricao: 'Introduza o seu NIF e número de telemóvel associado à Chave Móvel Digital.' },
  pin:           { titulo: 'Código PIN CMD',         descricao: 'Introduza o PIN da sua Chave Móvel Digital.' },
  sms:           { titulo: 'Código SMS Confirmação', descricao: 'Introduza o código de confirmação enviado por SMS para o seu telemóvel.' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const genId = () => Math.random().toString(36).slice(2, 10)

const genHash = () => {
  const chars = '0123456789abcdef'
  let hash = ''
  for (let i = 0; i < 64; i++) hash += chars[Math.floor(Math.random() * 16)]
  return hash
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

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ─── Dados demo ──────────────────────────────────────────────────────────────

function buildDemoDocumentos(): DocumentoAssinado[] {
  const now = new Date()
  return [
    {
      id: 'd1', nome: 'Ata AG Ordinária - Março 2026', tipo: 'ata',
      dataAssinatura: new Date(now.getTime() - 2 * 86400000).toISOString(),
      signatario: 'João Silva', nifSignatario: '123456789', telefoneSignatario: '+351912345678',
      estado: 'assinado', hashSHA256: 'a3f2b8c91d4e5f6071829a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f70819203',
      tamanhoBytes: 245760, edificioNom: 'Edifício Sol Nascente',
    },
    {
      id: 'd2', nome: 'Convocatória AG Extraordinária', tipo: 'convocatoria',
      dataAssinatura: new Date(now.getTime() - 5 * 86400000).toISOString(),
      signatario: 'João Silva', nifSignatario: '123456789', telefoneSignatario: '+351912345678',
      estado: 'assinado', hashSHA256: 'b4e3c9d02e5f6a7182930b1c2d3e4f5060718293a4b5c6d7e8f9001a2b3c4d5e',
      tamanhoBytes: 182400, edificioNom: 'Edifício Sol Nascente',
    },
    {
      id: 'd3', nome: 'Orçamento Obras Telhado', tipo: 'orcamento',
      dataAssinatura: new Date(now.getTime() - 10 * 86400000).toISOString(),
      signatario: 'Maria Santos', nifSignatario: '987654321', telefoneSignatario: '+351923456789',
      estado: 'assinado', hashSHA256: 'c5f4d0e13f6a7b8293041c2d3e4f5a6071829304b5c6d7e8f90a1b2c3d4e5f60',
      tamanhoBytes: 512000, edificioNom: 'Edifício Mar Azul',
    },
    {
      id: 'd4', nome: 'Contrato Manutenção Elevadores', tipo: 'contrato',
      dataAssinatura: new Date(now.getTime() - 15 * 86400000).toISOString(),
      signatario: 'João Silva', nifSignatario: '123456789', telefoneSignatario: '+351912345678',
      estado: 'assinado', hashSHA256: 'd6a5e1f24a7b8c9304152d3e4f5a6b7182930415c6d7e8f9a0b1c2d3e4f5a6b7',
      tamanhoBytes: 890000, edificioNom: 'Edifício Sol Nascente',
    },
    {
      id: 'd5', nome: 'Procuração Representação AG', tipo: 'procuracao',
      dataAssinatura: new Date(now.getTime() - 30 * 86400000).toISOString(),
      signatario: 'Ana Costa', nifSignatario: '456789123', telefoneSignatario: '+351934567891',
      estado: 'expirado', hashSHA256: 'e7b6f2a35b8c9d0415263e4f5a6b7c8293041526d7e8f9a0b1c2d3e4f5a6b7c8',
      tamanhoBytes: 98304, edificioNom: 'Edifício Mar Azul',
    },
    {
      id: 'd6', nome: 'Regulamento Interno 2026', tipo: 'regulamento',
      dataAssinatura: '',
      signatario: '', nifSignatario: '', telefoneSignatario: '',
      estado: 'pendente', hashSHA256: '',
      tamanhoBytes: 340000, edificioNom: 'Edifício Sol Nascente',
    },
    {
      id: 'd7', nome: 'Ata AG Extraordinária - Fev 2026', tipo: 'ata',
      dataAssinatura: new Date(now.getTime() - 45 * 86400000).toISOString(),
      signatario: 'João Silva', nifSignatario: '123456789', telefoneSignatario: '+351912345678',
      estado: 'assinado', hashSHA256: 'f8c7a3b46c9d0e1526374f5a6b7c8d9304152637e8f9a0b1c2d3e4f5a6b7c8d9',
      tamanhoBytes: 276000, edificioNom: 'Edifício Sol Nascente',
    },
  ]
}

// ─── Estilos base ────────────────────────────────────────────────────────────

const S = {
  page: { fontFamily: "'Inter', -apple-system, sans-serif", color: '#4A5E78', background: '#F7F4EE', minHeight: '100%', padding: 24 } as React.CSSProperties,
  card: { background: '#fff', borderRadius: 14, border: '1px solid #E4DDD0', padding: 24, marginBottom: 16 } as React.CSSProperties,
  cardSmall: { background: '#fff', borderRadius: 12, border: '1px solid #E4DDD0', padding: 16 } as React.CSSProperties,
  h1: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 700, color: '#0D1B2E', margin: 0, marginBottom: 4 } as React.CSSProperties,
  h2: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 700, color: '#0D1B2E', margin: 0, marginBottom: 12 } as React.CSSProperties,
  h3: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, fontWeight: 600, color: '#0D1B2E', margin: 0, marginBottom: 8 } as React.CSSProperties,
  subtitle: { fontSize: 14, color: '#8A9BB0', margin: 0 } as React.CSSProperties,
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#4A5E78', marginBottom: 4 } as React.CSSProperties,
  input: { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E4DDD0', fontSize: 14, color: '#0D1B2E', background: '#FAFAF7', outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
  select: { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E4DDD0', fontSize: 14, color: '#0D1B2E', background: '#FAFAF7', outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
  btnPrimary: { padding: '10px 22px', borderRadius: 10, border: 'none', background: '#C9A84C', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
  btnSecondary: { padding: '10px 22px', borderRadius: 10, border: '1px solid #E4DDD0', background: '#fff', color: '#4A5E78', fontSize: 14, fontWeight: 500, cursor: 'pointer' } as React.CSSProperties,
  btnDanger: { padding: '10px 22px', borderRadius: 10, border: 'none', background: '#C0392B', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
  badge: (bg: string, color: string) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: bg, color, fontSize: 12, fontWeight: 600 }) as React.CSSProperties,
  dot: (color: string) => ({ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }) as React.CSSProperties,
  tabRow: { display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' as const } as React.CSSProperties,
  tab: (active: boolean) => ({
    padding: '10px 18px', borderRadius: 10, border: active ? '2px solid #C9A84C' : '1px solid #E4DDD0',
    background: active ? '#FEF9EC' : '#fff', color: active ? '#C9A84C' : '#4A5E78',
    fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
  }) as React.CSSProperties,
  statCard: { flex: '1 1 180px', background: '#fff', borderRadius: 12, border: '1px solid #E4DDD0', padding: 18, textAlign: 'center' as const } as React.CSSProperties,
  statValue: { fontSize: 28, fontWeight: 700, color: '#0D1B2E', margin: 0 } as React.CSSProperties,
  statLabel: { fontSize: 12, color: '#8A9BB0', margin: 0, marginTop: 4 } as React.CSSProperties,
  tableRow: { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #F0ECE3', gap: 12, flexWrap: 'wrap' as const } as React.CSSProperties,
  tableHeader: { display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '2px solid #E4DDD0', gap: 12, background: '#FAFAF7', borderRadius: '12px 12px 0 0', flexWrap: 'wrap' as const } as React.CSSProperties,
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(13,27,46,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 } as React.CSSProperties,
  modal: { background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' as const, boxShadow: '0 20px 60px rgba(13,27,46,0.25)' } as React.CSSProperties,
  uploadArea: { border: '2px dashed #E4DDD0', borderRadius: 14, padding: 40, textAlign: 'center' as const, cursor: 'pointer', background: '#FAFAF7', transition: 'border-color 0.2s' } as React.CSSProperties,
  hashBox: { fontFamily: "'Courier New', monospace", fontSize: 12, background: '#F0ECE3', padding: '8px 12px', borderRadius: 8, wordBreak: 'break-all' as const, color: '#4A5E78' } as React.CSSProperties,
  legalRef: { fontSize: 11, color: '#8A9BB0', fontStyle: 'italic' as const, marginTop: 8 } as React.CSSProperties,
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 } as React.CSSProperties,
  stepIndicator: (active: boolean, done: boolean) => ({
    width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 700,
    background: done ? '#1A7A6E' : active ? '#C9A84C' : '#E4DDD0',
    color: done ? '#fff' : active ? '#fff' : '#8A9BB0',
  }) as React.CSSProperties,
  stepLine: (done: boolean) => ({ flex: 1, height: 2, background: done ? '#1A7A6E' : '#E4DDD0', margin: '0 8px' }) as React.CSSProperties,
  switchTrack: (on: boolean) => ({
    width: 44, height: 24, borderRadius: 12, background: on ? '#1A7A6E' : '#E4DDD0',
    cursor: 'pointer', position: 'relative' as const, transition: 'background 0.2s',
  }) as React.CSSProperties,
  switchThumb: (on: boolean) => ({
    width: 20, height: 20, borderRadius: '50%', background: '#fff',
    position: 'absolute' as const, top: 2, left: on ? 22 : 2, transition: 'left 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  }) as React.CSSProperties,
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function AssinaturaCMDSection({ user, userRole }: Props) {
  const uid = user?.id || 'demo'
  const STORAGE_KEY = `fixit_syndic_cmd_${uid}`

  // ── State ────────────────────────────────────────────────────────────────

  const [tab, setTab] = useState<TabId>('assinar')
  const [immeubles, setImmeubles] = useState<{ id: string; nom: string }[]>([])
  const [documentos, setDocumentos] = useState<DocumentoAssinado[]>([])
  const [loading, setLoading] = useState(true)

  // Assinar tab
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null)
  const [tipoDoc, setTipoDoc] = useState<TipoDocumento>('ata')
  const [edificioSelecionado, setEdificioSelecionado] = useState('')
  const [nomeDocumento, setNomeDocumento] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  // CMD signing flow
  const [showCMDModal, setShowCMDModal] = useState(false)
  const [etapaCMD, setEtapaCMD] = useState<EtapaCMD>('identificacao')
  const [cmdNif, setCmdNif] = useState('')
  const [cmdTelefone, setCmdTelefone] = useState('')
  const [cmdPin, setCmdPin] = useState('')
  const [cmdSms, setCmdSms] = useState('')
  const [cmdLoading, setCmdLoading] = useState(false)
  const [cmdSucesso, setCmdSucesso] = useState(false)

  // Validação tab
  const [hashValidacao, setHashValidacao] = useState('')
  const [resultadoValidacao, setResultadoValidacao] = useState<DocumentoAssinado | null>(null)
  const [validacaoRealizada, setValidacaoRealizada] = useState(false)

  // Configuração tab
  const [config, setConfig] = useState<ConfigCMD>({
    nif: '', telefone: '', nomeCompleto: '',
    notificacoesAtivas: true, autoArquivar: true, emailNotificacao: '',
  })

  // Filter
  const [filtroEstado, setFiltroEstado] = useState<EstadoAssinatura | 'todos'>('todos')

  // ── Persistência & load ────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      // Fetch immeubles
      try {
        const res = await fetch(`/api/syndic/immeubles?user_id=${uid}`)
        const data = await res.json()
        setImmeubles((data.immeubles || []).map((i: { id: string; nom: string }) => ({ id: i.id, nom: i.nom })))
      } catch {
        // localStorage fallback
        try {
          const cached = localStorage.getItem(`fixit_syndic_immeubles_${uid}`)
          if (cached) setImmeubles(JSON.parse(cached))
        } catch {}
      }

      // Load saved data
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed.documentos) setDocumentos(parsed.documentos)
          if (parsed.config) setConfig(prev => ({ ...prev, ...parsed.config }))
        } else {
          setDocumentos(buildDemoDocumentos())
        }
      } catch {
        setDocumentos(buildDemoDocumentos())
      }

      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  const persist = useCallback((docs: DocumentoAssinado[], cfg?: ConfigCMD) => {
    const data = { documentos: docs, config: cfg || config }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [STORAGE_KEY, config])

  const saveDocumentos = useCallback((docs: DocumentoAssinado[]) => {
    setDocumentos(docs)
    persist(docs)
  }, [persist])

  const saveConfig = useCallback((cfg: ConfigCMD) => {
    setConfig(cfg)
    persist(documentos, cfg)
  }, [persist, documentos])

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const assinados = documentos.filter(d => d.estado === 'assinado')
    const pendentes = documentos.filter(d => d.estado === 'pendente')
    const now = new Date()
    const mesAtual = now.getMonth()
    const anoAtual = now.getFullYear()
    const esteMes = assinados.filter(d => {
      const dt = new Date(d.dataAssinatura)
      return dt.getMonth() === mesAtual && dt.getFullYear() === anoAtual
    })
    const ultimo = assinados.sort((a, b) => new Date(b.dataAssinatura).getTime() - new Date(a.dataAssinatura).getTime())[0]
    return {
      totalAssinados: assinados.length,
      pendentes: pendentes.length,
      esteMes: esteMes.length,
      ultimoDoc: ultimo ? formatDate(ultimo.dataAssinatura) : '—',
    }
  }, [documentos])

  // ── Filtered documentos ────────────────────────────────────────────────────

  const docsFiltrados = useMemo(() => {
    if (filtroEstado === 'todos') return documentos
    return documentos.filter(d => d.estado === filtroEstado)
  }, [documentos, filtroEstado])

  // ── Simulate upload ────────────────────────────────────────────────────────

  const handleFileUpload = () => {
    const fakeName = nomeDocumento || `Documento_${new Date().toISOString().split('T')[0]}.pdf`
    const fakeSize = Math.floor(Math.random() * 900000) + 100000
    setUploadedFile({ name: fakeName, size: fakeSize })
    setShowPreview(true)
  }

  // ── CMD signing flow ───────────────────────────────────────────────────────

  const iniciarAssinatura = () => {
    if (!uploadedFile) return
    setCmdNif(config.nif || '')
    setCmdTelefone(config.telefone || '')
    setCmdPin('')
    setCmdSms('')
    setEtapaCMD('identificacao')
    setCmdSucesso(false)
    setShowCMDModal(true)
  }

  const avancarEtapa = async () => {
    if (etapaCMD === 'identificacao') {
      if (!cmdNif || !cmdTelefone) return
      setCmdLoading(true)
      await new Promise(r => setTimeout(r, 1200))
      setCmdLoading(false)
      setEtapaCMD('pin')
    } else if (etapaCMD === 'pin') {
      if (!cmdPin || cmdPin.length < 4) return
      setCmdLoading(true)
      await new Promise(r => setTimeout(r, 1500))
      setCmdLoading(false)
      setEtapaCMD('sms')
    } else if (etapaCMD === 'sms') {
      if (!cmdSms || cmdSms.length < 6) return
      setCmdLoading(true)
      await new Promise(r => setTimeout(r, 2000))

      // Create signed document
      const novoDoc: DocumentoAssinado = {
        id: genId(),
        nome: uploadedFile!.name,
        tipo: tipoDoc,
        dataAssinatura: new Date().toISOString(),
        signatario: config.nomeCompleto || 'Administrador',
        nifSignatario: cmdNif,
        telefoneSignatario: cmdTelefone,
        estado: 'assinado',
        hashSHA256: genHash(),
        tamanhoBytes: uploadedFile!.size,
        edificioNom: immeubles.find(i => i.id === edificioSelecionado)?.nom || edificioSelecionado || 'Edifício',
      }

      saveDocumentos([novoDoc, ...documentos])
      setCmdLoading(false)
      setCmdSucesso(true)

      // Reset form after delay
      setTimeout(() => {
        setShowCMDModal(false)
        setUploadedFile(null)
        setShowPreview(false)
        setNomeDocumento('')
        setCmdSucesso(false)
      }, 2500)
    }
  }

  // ── Validação ──────────────────────────────────────────────────────────────

  const validarHash = () => {
    if (!hashValidacao.trim()) return
    const found = documentos.find(d => d.hashSHA256 === hashValidacao.trim())
    setResultadoValidacao(found || null)
    setValidacaoRealizada(true)
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
          <p style={{ color: '#8A9BB0', fontSize: 14 }}>A carregar módulo CMD...</p>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── Renderização ──────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 32 }}>🔐</span>
          <div>
            <h1 style={S.h1}>Assinatura Digital CMD</h1>
            <p style={S.subtitle}>Chave Móvel Digital — Assinatura qualificada de documentos do condomínio</p>
          </div>
        </div>
        <p style={S.legalRef}>
          Conforme DL 12/2021 (assinatura digital qualificada PT) e Regulamento eIDAS (UE 910/2014).
          A assinatura via Chave Móvel Digital tem o mesmo valor legal que a assinatura manuscrita.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={S.statCard}>
          <p style={{ ...S.statValue, color: '#1A7A6E' }}>{stats.totalAssinados}</p>
          <p style={S.statLabel}>Total Documentos Assinados</p>
        </div>
        <div style={S.statCard}>
          <p style={{ ...S.statValue, color: '#D4830A' }}>{stats.pendentes}</p>
          <p style={S.statLabel}>Pendentes</p>
        </div>
        <div style={S.statCard}>
          <p style={{ ...S.statValue, color: '#C9A84C' }}>{stats.esteMes}</p>
          <p style={S.statLabel}>Este Mês</p>
        </div>
        <div style={S.statCard}>
          <p style={{ ...S.statValue, fontSize: 16, color: '#0D1B2E' }}>{stats.ultimoDoc}</p>
          <p style={S.statLabel}>Último Documento</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabRow}>
        {TAB_CONFIG.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={S.tab(tab === t.id)}>
            <span>{t.emoji}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ─── Tab: Assinar Documento ────────────────────────────────────────── */}
      {tab === 'assinar' && (
        <div>
          <div style={S.card}>
            <h2 style={S.h2}>Assinar Novo Documento</h2>
            <p style={{ ...S.subtitle, marginBottom: 20 }}>
              Carregue o documento que pretende assinar digitalmente com a Chave Móvel Digital.
            </p>

            {/* Document info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={S.label}>Nome do Documento</label>
                <input
                  type="text"
                  placeholder="Ex: Ata AG Ordinária - Março 2026"
                  value={nomeDocumento}
                  onChange={e => setNomeDocumento(e.target.value)}
                  style={S.input}
                />
              </div>
              <div>
                <label style={S.label}>Tipo de Documento</label>
                <select value={tipoDoc} onChange={e => setTipoDoc(e.target.value as TipoDocumento)} style={S.select}>
                  {Object.entries(TIPO_DOC_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.emoji} {v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={S.label}>Edifício</label>
                <select value={edificioSelecionado} onChange={e => setEdificioSelecionado(e.target.value)} style={S.select}>
                  <option value="">— Selecionar edifício —</option>
                  {immeubles.map(i => (
                    <option key={i.id} value={i.id}>{i.nom}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Upload area */}
            {!uploadedFile ? (
              <div
                style={S.uploadArea}
                onClick={handleFileUpload}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFileUpload() }}
              >
                <div style={{ fontSize: 48, marginBottom: 12 }}>📎</div>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#0D1B2E', marginBottom: 4 }}>
                  Clique ou arraste o ficheiro aqui
                </p>
                <p style={{ fontSize: 13, color: '#8A9BB0', margin: 0 }}>
                  Formatos suportados: PDF, DOC, DOCX (máx. 10 MB)
                </p>
              </div>
            ) : (
              <div style={{ ...S.cardSmall, border: '2px solid #C9A84C', background: '#FEF9EC' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 28 }}>📄</span>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, color: '#0D1B2E', fontSize: 14 }}>{uploadedFile.name}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#8A9BB0' }}>{formatBytes(uploadedFile.size)} — {TIPO_DOC_CONFIG[tipoDoc].label}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowPreview(!showPreview)} style={S.btnSecondary}>
                      {showPreview ? 'Ocultar' : 'Pré-visualizar'}
                    </button>
                    <button onClick={() => { setUploadedFile(null); setShowPreview(false) }} style={{ ...S.btnSecondary, color: '#C0392B' }}>
                      Remover
                    </button>
                  </div>
                </div>

                {/* Simulated preview */}
                {showPreview && (
                  <div style={{ marginTop: 16, padding: 20, background: '#fff', borderRadius: 10, border: '1px solid #E4DDD0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 12, color: '#8A9BB0' }}>Pré-visualização do documento</span>
                      <span style={S.badge('#E6F4F2', '#1A7A6E')}>
                        <span style={S.dot('#1A7A6E')} /> Pronto para assinar
                      </span>
                    </div>
                    <div style={{ background: '#FAFAF7', padding: 24, borderRadius: 8, border: '1px solid #F0ECE3', textAlign: 'center' }}>
                      <p style={{ color: '#8A9BB0', fontSize: 13, margin: 0 }}>
                        [Conteúdo do documento: {uploadedFile.name}]
                      </p>
                      <p style={{ color: '#8A9BB0', fontSize: 12, margin: '8px 0 0', fontStyle: 'italic' }}>
                        A pré-visualização completa estará disponível após o carregamento real do ficheiro.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sign button */}
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
              <p style={{ ...S.legalRef, margin: 0, flex: 1 }}>
                Ao assinar, confirma que leu e aceita os termos. A assinatura é juridicamente vinculativa (DL 12/2021).
              </p>
              <button
                onClick={iniciarAssinatura}
                disabled={!uploadedFile}
                style={{
                  ...S.btnPrimary,
                  opacity: uploadedFile ? 1 : 0.5,
                  cursor: uploadedFile ? 'pointer' : 'not-allowed',
                  padding: '12px 28px',
                  fontSize: 15,
                }}
              >
                🔐 Assinar com CMD
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tab: Documentos Assinados ─────────────────────────────────────── */}
      {tab === 'assinados' && (
        <div>
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ ...S.h2, marginBottom: 0 }}>Documentos Assinados</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={filtroEstado}
                  onChange={e => setFiltroEstado(e.target.value as EstadoAssinatura | 'todos')}
                  style={{ ...S.select, width: 'auto' }}
                >
                  <option value="todos">Todos os estados</option>
                  {Object.entries(ESTADO_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table header */}
            <div style={S.tableHeader}>
              <span style={{ flex: '2 1 200px', fontSize: 12, fontWeight: 700, color: '#4A5E78' }}>Documento</span>
              <span style={{ flex: '1 1 100px', fontSize: 12, fontWeight: 700, color: '#4A5E78' }}>Tipo</span>
              <span style={{ flex: '1 1 120px', fontSize: 12, fontWeight: 700, color: '#4A5E78' }}>Data</span>
              <span style={{ flex: '1 1 120px', fontSize: 12, fontWeight: 700, color: '#4A5E78' }}>Signatário</span>
              <span style={{ flex: '0 0 100px', fontSize: 12, fontWeight: 700, color: '#4A5E78' }}>Estado</span>
              <span style={{ flex: '0 0 80px', fontSize: 12, fontWeight: 700, color: '#4A5E78', textAlign: 'right' }}>Ações</span>
            </div>

            {/* Table rows */}
            {docsFiltrados.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <p style={{ color: '#8A9BB0', fontSize: 14 }}>Nenhum documento encontrado.</p>
              </div>
            ) : (
              docsFiltrados.map(doc => {
                const estadoCfg = ESTADO_CONFIG[doc.estado]
                const tipoCfg = TIPO_DOC_CONFIG[doc.tipo]
                return (
                  <div key={doc.id} style={S.tableRow}>
                    <div style={{ flex: '2 1 200px' }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0D1B2E' }}>{doc.nome}</p>
                      <p style={{ margin: 0, fontSize: 11, color: '#8A9BB0' }}>{doc.edificioNom} — {formatBytes(doc.tamanhoBytes)}</p>
                    </div>
                    <div style={{ flex: '1 1 100px' }}>
                      <span style={{ fontSize: 13 }}>{tipoCfg.emoji} {tipoCfg.label}</span>
                    </div>
                    <div style={{ flex: '1 1 120px' }}>
                      <span style={{ fontSize: 13, color: '#4A5E78' }}>
                        {doc.dataAssinatura ? formatDateTime(doc.dataAssinatura) : '—'}
                      </span>
                    </div>
                    <div style={{ flex: '1 1 120px' }}>
                      <span style={{ fontSize: 13, color: '#4A5E78' }}>{doc.signatario || '—'}</span>
                    </div>
                    <div style={{ flex: '0 0 100px' }}>
                      <span style={S.badge(estadoCfg.bg, estadoCfg.color)}>
                        <span style={S.dot(estadoCfg.dot)} />
                        {estadoCfg.label}
                      </span>
                    </div>
                    <div style={{ flex: '0 0 80px', textAlign: 'right', display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      {doc.estado === 'assinado' && doc.hashSHA256 && (
                        <button
                          onClick={() => { setHashValidacao(doc.hashSHA256); setTab('validacao'); setResultadoValidacao(null); setValidacaoRealizada(false) }}
                          title="Verificar"
                          style={{ ...S.btnSecondary, padding: '6px 10px', fontSize: 12 }}
                        >
                          🔍
                        </button>
                      )}
                      <button
                        title="Descarregar"
                        onClick={() => {/* simulated download */ }}
                        style={{ ...S.btnSecondary, padding: '6px 10px', fontSize: 12 }}
                      >
                        ⬇️
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Hash details for last signed doc */}
          {docsFiltrados.filter(d => d.estado === 'assinado' && d.hashSHA256).length > 0 && (
            <div style={S.card}>
              <h3 style={S.h3}>Detalhes de Integridade (SHA-256)</h3>
              <p style={{ ...S.subtitle, marginBottom: 12 }}>
                O hash criptográfico garante a integridade do documento após assinatura.
              </p>
              {docsFiltrados.filter(d => d.estado === 'assinado' && d.hashSHA256).slice(0, 3).map(doc => (
                <div key={doc.id} style={{ marginBottom: 12 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0D1B2E', marginBottom: 4 }}>{doc.nome}</p>
                  <div style={S.hashBox}>{doc.hashSHA256}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Validação ────────────────────────────────────────────────── */}
      {tab === 'validacao' && (
        <div>
          <div style={S.card}>
            <h2 style={S.h2}>Validação de Assinatura Digital</h2>
            <p style={{ ...S.subtitle, marginBottom: 20 }}>
              Cole o hash SHA-256 do documento para verificar a validade da assinatura digital.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Hash SHA-256 do Documento</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Ex: a3f2b8c91d4e5f6071829a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f70819203"
                  value={hashValidacao}
                  onChange={e => setHashValidacao(e.target.value)}
                  style={{ ...S.input, fontFamily: "'Courier New', monospace", fontSize: 13 }}
                />
                <button onClick={validarHash} style={S.btnPrimary}>
                  Validar
                </button>
              </div>
            </div>

            {/* Result */}
            {validacaoRealizada && (
              <div style={{ marginTop: 20 }}>
                {resultadoValidacao ? (
                  <div style={{ ...S.cardSmall, border: '2px solid #1A7A6E', background: '#E6F4F2' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1A7A6E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 24, color: '#fff' }}>✓</span>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1A7A6E' }}>Assinatura Válida</p>
                        <p style={{ margin: 0, fontSize: 13, color: '#4A5E78' }}>O documento é autêntico e não foi alterado.</p>
                      </div>
                    </div>
                    <div style={S.grid2}>
                      <div>
                        <p style={{ margin: 0, fontSize: 12, color: '#8A9BB0' }}>Documento</p>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0D1B2E' }}>{resultadoValidacao.nome}</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 12, color: '#8A9BB0' }}>Signatário</p>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0D1B2E' }}>{resultadoValidacao.signatario}</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 12, color: '#8A9BB0' }}>NIF</p>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0D1B2E' }}>{resultadoValidacao.nifSignatario}</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 12, color: '#8A9BB0' }}>Data de Assinatura</p>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0D1B2E' }}>{formatDateTime(resultadoValidacao.dataAssinatura)}</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 12, color: '#8A9BB0' }}>Tipo de Documento</p>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0D1B2E' }}>{TIPO_DOC_CONFIG[resultadoValidacao.tipo].emoji} {TIPO_DOC_CONFIG[resultadoValidacao.tipo].label}</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 12, color: '#8A9BB0' }}>Edifício</p>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0D1B2E' }}>{resultadoValidacao.edificioNom}</p>
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <p style={{ margin: 0, fontSize: 12, color: '#8A9BB0' }}>Hash SHA-256</p>
                      <div style={S.hashBox}>{resultadoValidacao.hashSHA256}</div>
                    </div>
                    <p style={S.legalRef}>
                      Assinatura qualificada nos termos do DL 12/2021 e Regulamento eIDAS (UE 910/2014).
                    </p>
                  </div>
                ) : (
                  <div style={{ ...S.cardSmall, border: '2px solid #C0392B', background: '#FDECEA' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#C0392B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 24, color: '#fff' }}>✗</span>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#C0392B' }}>Assinatura Inválida</p>
                        <p style={{ margin: 0, fontSize: 13, color: '#4A5E78' }}>
                          O hash introduzido não corresponde a nenhum documento assinado neste sistema.
                          O documento pode ter sido alterado ou a assinatura não é reconhecida.
                        </p>
                      </div>
                    </div>
                    <p style={S.legalRef}>
                      Se suspeita de fraude, contacte a AMA (Agência para a Modernização Administrativa) ou o CNCS.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick hash reference */}
          <div style={S.card}>
            <h3 style={S.h3}>Referência Rápida de Hashes</h3>
            <p style={{ ...S.subtitle, marginBottom: 12 }}>
              Clique no hash de um documento assinado para preencher automaticamente o campo de validação.
            </p>
            {documentos.filter(d => d.estado === 'assinado' && d.hashSHA256).map(doc => (
              <div
                key={doc.id}
                onClick={() => { setHashValidacao(doc.hashSHA256); setResultadoValidacao(null); setValidacaoRealizada(false) }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F0ECE3', cursor: 'pointer' }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0D1B2E' }}>{doc.nome}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#8A9BB0' }}>{formatDate(doc.dataAssinatura)}</p>
                </div>
                <div style={{ ...S.hashBox, fontSize: 11, padding: '4px 8px' }}>
                  {doc.hashSHA256.slice(0, 16)}...
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Tab: Configuração ─────────────────────────────────────────────── */}
      {tab === 'configuracao' && (
        <div>
          <div style={S.card}>
            <h2 style={S.h2}>Conta Chave Móvel Digital</h2>
            <p style={{ ...S.subtitle, marginBottom: 20 }}>
              Configure os dados da sua conta CMD para facilitar o processo de assinatura.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={S.label}>Nome Completo</label>
                <input
                  type="text"
                  placeholder="Ex: João Manuel da Silva Santos"
                  value={config.nomeCompleto}
                  onChange={e => setConfig(prev => ({ ...prev, nomeCompleto: e.target.value }))}
                  style={S.input}
                />
              </div>
              <div>
                <label style={S.label}>NIF Associado</label>
                <input
                  type="text"
                  placeholder="Ex: 123456789"
                  value={config.nif}
                  onChange={e => setConfig(prev => ({ ...prev, nif: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
                  style={S.input}
                  maxLength={9}
                />
              </div>
              <div>
                <label style={S.label}>Telemóvel Associado</label>
                <input
                  type="text"
                  placeholder="Ex: +351912345678"
                  value={config.telefone}
                  onChange={e => setConfig(prev => ({ ...prev, telefone: e.target.value }))}
                  style={S.input}
                />
              </div>
              <div>
                <label style={S.label}>Email para Notificações</label>
                <input
                  type="email"
                  placeholder="Ex: gestor@condominio.pt"
                  value={config.emailNotificacao}
                  onChange={e => setConfig(prev => ({ ...prev, emailNotificacao: e.target.value }))}
                  style={S.input}
                />
              </div>
            </div>

            {/* Preferences */}
            <h3 style={S.h3}>Preferências</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0D1B2E' }}>Notificações por Email</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#8A9BB0' }}>Receber notificação quando um documento é assinado ou expira.</p>
                </div>
                <div
                  onClick={() => setConfig(prev => ({ ...prev, notificacoesAtivas: !prev.notificacoesAtivas }))}
                  style={S.switchTrack(config.notificacoesAtivas)}
                >
                  <div style={S.switchThumb(config.notificacoesAtivas)} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0D1B2E' }}>Arquivo Automático</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#8A9BB0' }}>Arquivar automaticamente documentos assinados após 90 dias.</p>
                </div>
                <div
                  onClick={() => setConfig(prev => ({ ...prev, autoArquivar: !prev.autoArquivar }))}
                  style={S.switchTrack(config.autoArquivar)}
                >
                  <div style={S.switchThumb(config.autoArquivar)} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => saveConfig(config)} style={S.btnPrimary}>
                Guardar Configuração
              </button>
            </div>
          </div>

          {/* Legal info */}
          <div style={S.card}>
            <h3 style={S.h3}>Enquadramento Legal</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ ...S.cardSmall, background: '#FAFAF7' }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0D1B2E' }}>DL 12/2021</p>
                <p style={{ margin: 0, fontSize: 13, color: '#4A5E78', marginTop: 4 }}>
                  Estabelece o regime jurídico da assinatura digital qualificada em Portugal.
                  A Chave Móvel Digital é reconhecida como meio de autenticação e assinatura eletrónica qualificada.
                </p>
              </div>
              <div style={{ ...S.cardSmall, background: '#FAFAF7' }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0D1B2E' }}>Regulamento eIDAS (UE 910/2014)</p>
                <p style={{ margin: 0, fontSize: 13, color: '#4A5E78', marginTop: 4 }}>
                  Regulamento europeu relativo à identificação eletrónica e serviços de confiança.
                  Define o enquadramento legal para assinaturas eletrónicas em todos os Estados-Membros da UE.
                </p>
              </div>
              <div style={{ ...S.cardSmall, background: '#FAFAF7' }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0D1B2E' }}>Chave Móvel Digital (CMD)</p>
                <p style={{ margin: 0, fontSize: 13, color: '#4A5E78', marginTop: 4 }}>
                  Sistema de autenticação e assinatura digital do Estado português, gerido pela AMA.
                  Permite assinar documentos com validade legal equivalente à assinatura manuscrita.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── Modal CMD Signing Flow ──────────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {showCMDModal && (
        <div style={S.overlay} onClick={() => { if (!cmdLoading) setShowCMDModal(false) }}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            {/* CMD Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#0D1B2E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 24 }}>🔐</span>
              </div>
              <div>
                <h2 style={{ ...S.h2, marginBottom: 2 }}>Assinatura CMD</h2>
                <p style={{ ...S.subtitle, margin: 0 }}>Chave Móvel Digital — Assinatura Qualificada</p>
              </div>
            </div>

            {/* Success state */}
            {cmdSucesso ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#E6F4F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <span style={{ fontSize: 40 }}>✓</span>
                </div>
                <h3 style={{ ...S.h2, color: '#1A7A6E', marginBottom: 8 }}>Documento Assinado com Sucesso</h3>
                <p style={{ fontSize: 14, color: '#4A5E78', margin: 0 }}>
                  O documento foi assinado digitalmente com a sua Chave Móvel Digital.
                </p>
                <p style={{ ...S.legalRef, marginTop: 12 }}>
                  Assinatura qualificada nos termos do DL 12/2021 e Regulamento eIDAS.
                </p>
              </div>
            ) : (
              <>
                {/* Step indicators */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28, padding: '0 20px' }}>
                  {(['identificacao', 'pin', 'sms'] as EtapaCMD[]).map((step, idx) => {
                    const stepNum = idx + 1
                    const isActive = step === etapaCMD
                    const isDone = (['identificacao', 'pin', 'sms'] as EtapaCMD[]).indexOf(etapaCMD) > idx
                    return (
                      <React.Fragment key={step}>
                        {idx > 0 && <div style={S.stepLine(isDone)} />}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={S.stepIndicator(isActive, isDone)}>
                            {isDone ? '✓' : stepNum}
                          </div>
                          <span style={{ fontSize: 10, color: isActive ? '#C9A84C' : isDone ? '#1A7A6E' : '#8A9BB0', fontWeight: isActive ? 700 : 400, whiteSpace: 'nowrap' }}>
                            {ETAPA_CMD_LABELS[step].titulo}
                          </span>
                        </div>
                      </React.Fragment>
                    )
                  })}
                </div>

                {/* Step content */}
                <div style={{ marginBottom: 24 }}>
                  <h3 style={S.h3}>
                    Passo {(['identificacao', 'pin', 'sms'] as EtapaCMD[]).indexOf(etapaCMD) + 1}: {ETAPA_CMD_LABELS[etapaCMD].titulo}
                  </h3>
                  <p style={{ ...S.subtitle, marginBottom: 16 }}>
                    {ETAPA_CMD_LABELS[etapaCMD].descricao}
                  </p>

                  {etapaCMD === 'identificacao' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <label style={S.label}>NIF (Número de Identificação Fiscal)</label>
                        <input
                          type="text"
                          placeholder="123456789"
                          value={cmdNif}
                          onChange={e => setCmdNif(e.target.value.replace(/\D/g, '').slice(0, 9))}
                          style={S.input}
                          maxLength={9}
                        />
                      </div>
                      <div>
                        <label style={S.label}>Número de Telemóvel</label>
                        <input
                          type="text"
                          placeholder="+351 912 345 678"
                          value={cmdTelefone}
                          onChange={e => setCmdTelefone(e.target.value)}
                          style={S.input}
                        />
                      </div>
                    </div>
                  )}

                  {etapaCMD === 'pin' && (
                    <div>
                      <label style={S.label}>PIN da Chave Móvel Digital (4-8 dígitos)</label>
                      <input
                        type="password"
                        placeholder="••••••"
                        value={cmdPin}
                        onChange={e => setCmdPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                        style={{ ...S.input, letterSpacing: 8, textAlign: 'center', fontSize: 20 }}
                        maxLength={8}
                      />
                      <p style={{ ...S.legalRef, marginTop: 8 }}>
                        O PIN da CMD foi definido aquando da ativação da sua Chave Móvel Digital.
                      </p>
                    </div>
                  )}

                  {etapaCMD === 'sms' && (
                    <div>
                      <label style={S.label}>Código SMS de Confirmação (6 dígitos)</label>
                      <input
                        type="text"
                        placeholder="123456"
                        value={cmdSms}
                        onChange={e => setCmdSms(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        style={{ ...S.input, letterSpacing: 12, textAlign: 'center', fontSize: 24, fontWeight: 700 }}
                        maxLength={6}
                      />
                      <div style={{ ...S.cardSmall, background: '#FEF9EC', border: '1px solid #C9A84C', marginTop: 12 }}>
                        <p style={{ margin: 0, fontSize: 13, color: '#4A5E78' }}>
                          📱 Um código SMS foi enviado para <strong>{cmdTelefone || '***'}</strong>.
                          Introduza o código de 6 dígitos para confirmar a assinatura.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Document being signed */}
                <div style={{ ...S.cardSmall, background: '#FAFAF7', marginBottom: 20 }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#8A9BB0', marginBottom: 4 }}>Documento a assinar:</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{TIPO_DOC_CONFIG[tipoDoc].emoji}</span>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0D1B2E' }}>
                      {uploadedFile?.name}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button
                    onClick={() => setShowCMDModal(false)}
                    disabled={cmdLoading}
                    style={{ ...S.btnSecondary, opacity: cmdLoading ? 0.5 : 1 }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={avancarEtapa}
                    disabled={cmdLoading}
                    style={{
                      ...S.btnPrimary,
                      opacity: cmdLoading ? 0.7 : 1,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    {cmdLoading ? (
                      <>
                        <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        A processar...
                      </>
                    ) : etapaCMD === 'sms' ? (
                      '🔐 Assinar Documento'
                    ) : (
                      'Avançar →'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
