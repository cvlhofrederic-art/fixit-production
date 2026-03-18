'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type EstadoApolice = 'ativa' | 'a_renovar' | 'expirada' | 'em_negociacao'
type EstadoSinistro = 'aberto' | 'em_analise' | 'aprovado' | 'recusado' | 'pago'

interface ApoliceSeguro {
  id: string
  edificioNom: string
  seguradora: string
  numeroApolice: string
  tipo: 'incendio' | 'multirriscos' | 'responsabilidade_civil' | 'acidentes_trabalho'
  dataInicio: string
  dataFim: string
  premioAnual: number       // em EUR
  capitalSegurado: number
  franquia: number
  estado: EstadoApolice
  coberturas: string[]
  contactoSeguradora?: string
  emailSeguradora?: string
  observacoes?: string
}

interface SinistroSeguro {
  id: string
  apoliceId: string
  edificioNom: string
  seguradora: string
  dataOcorrencia: string
  dataParticipacao: string
  tipo: string
  descricao: string
  valorEstimado: number
  valorPago?: number
  estado: EstadoSinistro
  referenciaSinistro?: string
  observacoes?: string
}

interface Props {
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> }
  userRole: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const TIPOS_SEGURO: Record<ApoliceSeguro['tipo'], { emoji: string; label: string }> = {
  incendio:              { emoji: '🔥', label: 'Seguro contra Incêndio' },
  multirriscos:          { emoji: '🛡️', label: 'Seguro Multirriscos' },
  responsabilidade_civil: { emoji: '⚖️', label: 'Responsabilidade Civil' },
  acidentes_trabalho:    { emoji: '🦺', label: 'Acidentes de Trabalho' },
}

const COBERTURAS_DISPONIVEIS = [
  'Incêndio', 'Inundação', 'Tempestade', 'Roubo', 'Vandalismo',
  'Queda de raio', 'Explosão', 'Fenómenos sísmicos', 'Danos por água',
  'Responsabilidade civil', 'Reconstrução', 'Danos estéticos',
  'Perda de rendas', 'Despesas de realojamento',
]

const ESTADO_APOLICE_CONFIG: Record<EstadoApolice, { label: string; bg: string; color: string; dot: string }> = {
  ativa:          { label: 'Ativa',          bg: '#E6F4F2', color: '#1A7A6E', dot: '#1A7A6E' },
  a_renovar:      { label: 'A Renovar',     bg: '#FEF5E4', color: '#D4830A', dot: '#D4830A' },
  expirada:       { label: 'Expirada',       bg: '#FDECEA', color: '#C0392B', dot: '#C0392B' },
  em_negociacao:  { label: 'Em Negociação', bg: '#EDE8FF', color: '#6C5CE7', dot: '#6C5CE7' },
}

const ESTADO_SINISTRO_CONFIG: Record<EstadoSinistro, { label: string; bg: string; color: string }> = {
  aberto:     { label: 'Aberto',      bg: '#FEF5E4', color: '#D4830A' },
  em_analise: { label: 'Em Análise',  bg: '#E6F4F2', color: '#1A7A6E' },
  aprovado:   { label: 'Aprovado',    bg: '#E6F4F2', color: '#1A7A6E' },
  recusado:   { label: 'Recusado',    bg: '#FDECEA', color: '#C0392B' },
  pago:       { label: 'Pago',        bg: '#F7F4EE', color: '#0D1B2E' },
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function SeguroCondominioSection({ user, userRole }: Props) {
  // ── State
  const [apolices, setApolices] = useState<ApoliceSeguro[]>([])
  const [sinistros, setSinistros] = useState<SinistroSeguro[]>([])
  const [view, setView] = useState<'apolices' | 'sinistros' | 'novo_apolice' | 'novo_sinistro'>('apolices')
  const [selectedApolice, setSelectedApolice] = useState<ApoliceSeguro | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<EstadoApolice | 'todos'>('todos')

  // ── Form state — apólice
  const [formEdificio, setFormEdificio] = useState('')
  const [formSeguradora, setFormSeguradora] = useState('')
  const [formNumero, setFormNumero] = useState('')
  const [formTipo, setFormTipo] = useState<ApoliceSeguro['tipo']>('incendio')
  const [formDataInicio, setFormDataInicio] = useState('')
  const [formDataFim, setFormDataFim] = useState('')
  const [formPremio, setFormPremio] = useState('')
  const [formCapital, setFormCapital] = useState('')
  const [formFranquia, setFormFranquia] = useState('')
  const [formCoberturas, setFormCoberturas] = useState<string[]>([])
  const [formContacto, setFormContacto] = useState('')
  const [formEmailSeg, setFormEmailSeg] = useState('')
  const [formObs, setFormObs] = useState('')

  // ── Form state — sinistro
  const [sinApoliceId, setSinApoliceId] = useState('')
  const [sinDataOcorrencia, setSinDataOcorrencia] = useState('')
  const [sinTipo, setSinTipo] = useState('')
  const [sinDescricao, setSinDescricao] = useState('')
  const [sinValor, setSinValor] = useState('')
  const [sinObs, setSinObs] = useState('')

  // ── Storage
  const STORAGE_KEY_A = `fixit_seguros_apolices_${user.id}`
  const STORAGE_KEY_S = `fixit_seguros_sinistros_${user.id}`

  useEffect(() => {
    try {
      const a = localStorage.getItem(STORAGE_KEY_A)
      if (a) setApolices(JSON.parse(a))
      const s = localStorage.getItem(STORAGE_KEY_S)
      if (s) setSinistros(JSON.parse(s))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { localStorage.setItem(STORAGE_KEY_A, JSON.stringify(apolices)) }, [apolices])
  useEffect(() => { localStorage.setItem(STORAGE_KEY_S, JSON.stringify(sinistros)) }, [sinistros])

  // ── Helpers
  const diasAteExpiracao = (dataFim: string): number => {
    const diff = new Date(dataFim).getTime() - Date.now()
    return Math.ceil(diff / (1000 * 86400))
  }

  const getEstadoAuto = (ap: ApoliceSeguro): EstadoApolice => {
    if (ap.estado === 'em_negociacao') return 'em_negociacao'
    const dias = diasAteExpiracao(ap.dataFim)
    if (dias < 0) return 'expirada'
    if (dias <= 60) return 'a_renovar'
    return 'ativa'
  }

  // ── Stats
  const stats = useMemo(() => {
    const ativas = apolices.filter(a => getEstadoAuto(a) === 'ativa').length
    const aRenovar = apolices.filter(a => getEstadoAuto(a) === 'a_renovar').length
    const expiradas = apolices.filter(a => getEstadoAuto(a) === 'expirada').length
    const premioTotal = apolices.reduce((sum, a) => sum + a.premioAnual, 0)
    const sinistrosAbertos = sinistros.filter(s => s.estado === 'aberto' || s.estado === 'em_analise').length
    const totalPago = sinistros.filter(s => s.estado === 'pago').reduce((sum, s) => sum + (s.valorPago || 0), 0)
    return { ativas, aRenovar, expiradas, premioTotal, sinistrosAbertos, totalPago }
  }, [apolices, sinistros])

  // ── Filtered apólices
  const apolicesFiltradas = useMemo(() => {
    if (filtroEstado === 'todos') return apolices
    return apolices.filter(a => getEstadoAuto(a) === filtroEstado)
  }, [apolices, filtroEstado])

  // ── Create apólice
  const criarApolice = () => {
    if (!formEdificio.trim() || !formSeguradora.trim()) return
    const nova: ApoliceSeguro = {
      id: crypto.randomUUID(),
      edificioNom: formEdificio.trim(),
      seguradora: formSeguradora.trim(),
      numeroApolice: formNumero.trim(),
      tipo: formTipo,
      dataInicio: formDataInicio || new Date().toISOString().slice(0, 10),
      dataFim: formDataFim || '',
      premioAnual: parseFloat(formPremio) || 0,
      capitalSegurado: parseFloat(formCapital) || 0,
      franquia: parseFloat(formFranquia) || 0,
      estado: 'ativa',
      coberturas: formCoberturas,
      contactoSeguradora: formContacto.trim() || undefined,
      emailSeguradora: formEmailSeg.trim() || undefined,
      observacoes: formObs.trim() || undefined,
    }
    setApolices(prev => [nova, ...prev])
    resetFormApolice()
    setView('apolices')
  }

  const resetFormApolice = () => {
    setFormEdificio(''); setFormSeguradora(''); setFormNumero(''); setFormTipo('incendio')
    setFormDataInicio(''); setFormDataFim(''); setFormPremio(''); setFormCapital('')
    setFormFranquia(''); setFormCoberturas([]); setFormContacto(''); setFormEmailSeg(''); setFormObs('')
  }

  // ── Create sinistro
  const criarSinistro = () => {
    if (!sinApoliceId || !sinDescricao.trim()) return
    const ap = apolices.find(a => a.id === sinApoliceId)
    if (!ap) return
    const novo: SinistroSeguro = {
      id: crypto.randomUUID(),
      apoliceId: sinApoliceId,
      edificioNom: ap.edificioNom,
      seguradora: ap.seguradora,
      dataOcorrencia: sinDataOcorrencia || new Date().toISOString().slice(0, 10),
      dataParticipacao: new Date().toISOString().slice(0, 10),
      tipo: sinTipo.trim() || 'Dano genérico',
      descricao: sinDescricao.trim(),
      valorEstimado: parseFloat(sinValor) || 0,
      estado: 'aberto',
      observacoes: sinObs.trim() || undefined,
    }
    setSinistros(prev => [novo, ...prev])
    setSinApoliceId(''); setSinDataOcorrencia(''); setSinTipo(''); setSinDescricao(''); setSinValor(''); setSinObs('')
    setView('sinistros')
  }

  // ── Update sinistro estado
  const atualizarSinistro = (id: string, novoEstado: EstadoSinistro, valorPago?: number) => {
    setSinistros(prev => prev.map(s => s.id === id ? { ...s, estado: novoEstado, valorPago: valorPago ?? s.valorPago } : s))
  }

  // ── Delete
  const eliminarApolice = (id: string) => {
    setApolices(prev => prev.filter(a => a.id !== id))
    setSinistros(prev => prev.filter(s => s.apoliceId !== id))
    if (selectedApolice?.id === id) setSelectedApolice(null)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const fmt = (n: number) => n.toLocaleString('pt-PT', { minimumFractionDigits: 2 })

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: '#0D1B2E', margin: 0 }}>🛡️ Seguro Obrigatório de Condomínio</h2>
          <p style={{ fontSize: 13, color: '#8A9BB0', marginTop: 4 }}>Seguro contra incêndio obrigatório · Art.º 1429.º Código Civil · DL 268/94</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setView('novo_apolice')} style={{ background: '#0D1B2E', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + Nova Apólice
          </button>
          <button onClick={() => setView('novo_sinistro')} style={{ background: '#C0392B', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            ⚠️ Participar Sinistro
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { emoji: '🛡️', label: 'Apólices Ativas', value: stats.ativas, color: '#1A7A6E' },
          { emoji: '⏰', label: 'A Renovar (< 60 dias)', value: stats.aRenovar, color: '#D4830A' },
          { emoji: '❌', label: 'Expiradas', value: stats.expiradas, color: '#C0392B' },
          { emoji: '💶', label: 'Prémio Anual Total', value: `${fmt(stats.premioTotal)} €`, color: '#0D1B2E' },
          { emoji: '📋', label: 'Sinistros em Aberto', value: stats.sinistrosAbertos, color: '#D4830A' },
          { emoji: '✅', label: 'Total Indemnizado', value: `${fmt(stats.totalPago)} €`, color: '#1A7A6E' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{s.emoji}</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#8A9BB0', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid #E4DDD0', paddingBottom: 12 }}>
        {[
          { key: 'apolices' as const, label: '🛡️ Apólices', count: apolices.length },
          { key: 'sinistros' as const, label: '⚠️ Sinistros', count: sinistros.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            style={{
              background: view === tab.key ? '#0D1B2E' : 'transparent',
              color: view === tab.key ? '#fff' : '#4A5E78',
              border: view === tab.key ? 'none' : '1px solid #E4DDD0',
              borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* ── View: Apólices ── */}
      {view === 'apolices' && (
        <div>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {(['todos', 'ativa', 'a_renovar', 'expirada', 'em_negociacao'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFiltroEstado(f)}
                style={{
                  background: filtroEstado === f ? '#0D1B2E' : '#F7F4EE',
                  color: filtroEstado === f ? '#fff' : '#4A5E78',
                  border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {f === 'todos' ? 'Todos' : ESTADO_APOLICE_CONFIG[f].label}
              </button>
            ))}
          </div>

          {apolicesFiltradas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#8A9BB0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🛡️</div>
              <p style={{ fontSize: 16, fontWeight: 600 }}>Nenhuma apólice registada</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>O seguro contra incêndio é obrigatório para todos os edifícios em propriedade horizontal</p>
              <button onClick={() => setView('novo_apolice')} style={{ marginTop: 16, background: '#0D1B2E', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                + Registar Apólice
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {apolicesFiltradas.map(ap => {
                const estado = getEstadoAuto(ap)
                const cfg = ESTADO_APOLICE_CONFIG[estado]
                const dias = diasAteExpiracao(ap.dataFim)
                const tipoInfo = TIPOS_SEGURO[ap.tipo]
                return (
                  <div key={ap.id} style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'border-color 0.2s' }} onClick={() => setSelectedApolice(ap)}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 18 }}>{tipoInfo.emoji}</span>
                          <span style={{ fontWeight: 700, fontSize: 15, color: '#0D1B2E' }}>{ap.edificioNom}</span>
                          <span style={{ fontSize: 11, background: cfg.bg, color: cfg.color, padding: '2px 8px', borderRadius: 5, fontWeight: 600 }}>
                            {cfg.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: '#4A5E78', marginTop: 6 }}>
                          {tipoInfo.label} · {ap.seguradora} · Apólice n.º {ap.numeroApolice || '—'}
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#8A9BB0', flexWrap: 'wrap' }}>
                          <span>Prémio: <strong style={{ color: '#0D1B2E' }}>{fmt(ap.premioAnual)} €/ano</strong></span>
                          <span>Capital: <strong style={{ color: '#0D1B2E' }}>{fmt(ap.capitalSegurado)} €</strong></span>
                          <span>Franquia: <strong>{fmt(ap.franquia)} €</strong></span>
                          <span>Expira: <strong style={{ color: dias < 0 ? '#C0392B' : dias <= 60 ? '#D4830A' : '#1A7A6E' }}>
                            {ap.dataFim ? new Date(ap.dataFim).toLocaleDateString('pt-PT') : '—'}
                            {dias >= 0 ? ` (${dias} dias)` : ` (expirada há ${Math.abs(dias)} dias)`}
                          </strong></span>
                        </div>
                        {ap.coberturas.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                            {ap.coberturas.slice(0, 5).map(c => (
                              <span key={c} style={{ fontSize: 10, background: '#F7F4EE', color: '#4A5E78', padding: '2px 6px', borderRadius: 4 }}>{c}</span>
                            ))}
                            {ap.coberturas.length > 5 && (
                              <span style={{ fontSize: 10, color: '#8A9BB0' }}>+{ap.coberturas.length - 5}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); eliminarApolice(ap.id) }}
                        style={{ background: 'none', border: 'none', fontSize: 16, color: '#8A9BB0', cursor: 'pointer' }}
                        aria-label="Eliminar apólice"
                      >🗑️</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Detail modal */}
          {selectedApolice && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setSelectedApolice(null)}>
              <div style={{ background: '#fff', borderRadius: 16, maxWidth: 600, width: '100%', maxHeight: '80vh', overflow: 'auto', padding: 32 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, margin: 0 }}>
                    {TIPOS_SEGURO[selectedApolice.tipo].emoji} {selectedApolice.edificioNom}
                  </h3>
                  <button onClick={() => setSelectedApolice(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#8A9BB0' }}>✕</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
                  <div><span style={{ color: '#8A9BB0' }}>Seguradora:</span><br /><strong>{selectedApolice.seguradora}</strong></div>
                  <div><span style={{ color: '#8A9BB0' }}>N.º Apólice:</span><br /><strong>{selectedApolice.numeroApolice || '—'}</strong></div>
                  <div><span style={{ color: '#8A9BB0' }}>Tipo:</span><br /><strong>{TIPOS_SEGURO[selectedApolice.tipo].label}</strong></div>
                  <div><span style={{ color: '#8A9BB0' }}>Estado:</span><br /><span style={{ background: ESTADO_APOLICE_CONFIG[getEstadoAuto(selectedApolice)].bg, color: ESTADO_APOLICE_CONFIG[getEstadoAuto(selectedApolice)].color, padding: '2px 8px', borderRadius: 5, fontWeight: 600, fontSize: 11 }}>{ESTADO_APOLICE_CONFIG[getEstadoAuto(selectedApolice)].label}</span></div>
                  <div><span style={{ color: '#8A9BB0' }}>Início:</span><br /><strong>{selectedApolice.dataInicio ? new Date(selectedApolice.dataInicio).toLocaleDateString('pt-PT') : '—'}</strong></div>
                  <div><span style={{ color: '#8A9BB0' }}>Fim:</span><br /><strong>{selectedApolice.dataFim ? new Date(selectedApolice.dataFim).toLocaleDateString('pt-PT') : '—'}</strong></div>
                  <div><span style={{ color: '#8A9BB0' }}>Prémio Anual:</span><br /><strong>{fmt(selectedApolice.premioAnual)} €</strong></div>
                  <div><span style={{ color: '#8A9BB0' }}>Capital Segurado:</span><br /><strong>{fmt(selectedApolice.capitalSegurado)} €</strong></div>
                  <div><span style={{ color: '#8A9BB0' }}>Franquia:</span><br /><strong>{fmt(selectedApolice.franquia)} €</strong></div>
                  {selectedApolice.contactoSeguradora && <div><span style={{ color: '#8A9BB0' }}>Contacto:</span><br /><strong>{selectedApolice.contactoSeguradora}</strong></div>}
                  {selectedApolice.emailSeguradora && <div><span style={{ color: '#8A9BB0' }}>Email:</span><br /><strong>{selectedApolice.emailSeguradora}</strong></div>}
                </div>

                {selectedApolice.coberturas.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B2E', marginBottom: 8 }}>Coberturas Incluídas</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {selectedApolice.coberturas.map(c => (
                        <span key={c} style={{ fontSize: 11, background: '#E6F4F2', color: '#1A7A6E', padding: '3px 8px', borderRadius: 5 }}>✓ {c}</span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedApolice.observacoes && (
                  <div style={{ marginTop: 16, fontSize: 13, color: '#4A5E78', background: '#F7F4EE', borderRadius: 8, padding: 12 }}>
                    {selectedApolice.observacoes}
                  </div>
                )}

                {/* Sinistros dessa apólice */}
                {(() => {
                  const apSinistros = sinistros.filter(s => s.apoliceId === selectedApolice.id)
                  if (apSinistros.length === 0) return null
                  return (
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B2E', marginBottom: 8 }}>⚠️ Sinistros ({apSinistros.length})</div>
                      {apSinistros.map(s => (
                        <div key={s.id} style={{ background: '#FAFAF7', border: '1px solid #E4DDD0', borderRadius: 8, padding: 12, marginBottom: 8, fontSize: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong>{s.tipo}</strong>
                            <span style={{ background: ESTADO_SINISTRO_CONFIG[s.estado].bg, color: ESTADO_SINISTRO_CONFIG[s.estado].color, padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600 }}>
                              {ESTADO_SINISTRO_CONFIG[s.estado].label}
                            </span>
                          </div>
                          <div style={{ color: '#4A5E78', marginTop: 4 }}>{s.descricao}</div>
                          <div style={{ color: '#8A9BB0', marginTop: 4 }}>
                            Ocorrência: {new Date(s.dataOcorrencia).toLocaleDateString('pt-PT')} · Estimado: {fmt(s.valorEstimado)} €
                            {s.valorPago != null && ` · Pago: ${fmt(s.valorPago)} €`}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── View: Sinistros ── */}
      {view === 'sinistros' && (
        <div>
          {sinistros.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#8A9BB0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <p style={{ fontSize: 16, fontWeight: 600 }}>Nenhum sinistro registado</p>
              <p style={{ fontSize: 13 }}>Quando ocorrer um sinistro, registe-o aqui para acompanhar a participação junto da seguradora</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sinistros.map(s => {
                const cfg = ESTADO_SINISTRO_CONFIG[s.estado]
                return (
                  <div key={s.id} style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 15, color: '#0D1B2E' }}>{s.tipo}</span>
                          <span style={{ fontSize: 11, background: cfg.bg, color: cfg.color, padding: '2px 8px', borderRadius: 5, fontWeight: 600 }}>{cfg.label}</span>
                        </div>
                        <div style={{ fontSize: 13, color: '#4A5E78', marginTop: 4 }}>{s.edificioNom} · {s.seguradora}</div>
                        <div style={{ fontSize: 13, color: '#4A5E78', marginTop: 4 }}>{s.descricao}</div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#8A9BB0' }}>
                          <span>Ocorrência: <strong>{new Date(s.dataOcorrencia).toLocaleDateString('pt-PT')}</strong></span>
                          <span>Participação: <strong>{new Date(s.dataParticipacao).toLocaleDateString('pt-PT')}</strong></span>
                          <span>Valor: <strong style={{ color: '#0D1B2E' }}>{fmt(s.valorEstimado)} €</strong></span>
                          {s.referenciaSinistro && <span>Ref: <strong>{s.referenciaSinistro}</strong></span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {s.estado === 'aberto' && (
                          <button onClick={() => atualizarSinistro(s.id, 'em_analise')} style={{ fontSize: 11, background: '#E6F4F2', color: '#1A7A6E', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}>
                            → Em Análise
                          </button>
                        )}
                        {s.estado === 'em_analise' && (
                          <>
                            <button onClick={() => atualizarSinistro(s.id, 'aprovado')} style={{ fontSize: 11, background: '#E6F4F2', color: '#1A7A6E', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}>
                              ✓ Aprovado
                            </button>
                            <button onClick={() => atualizarSinistro(s.id, 'recusado')} style={{ fontSize: 11, background: '#FDECEA', color: '#C0392B', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}>
                              ✕ Recusado
                            </button>
                          </>
                        )}
                        {s.estado === 'aprovado' && (
                          <button onClick={() => {
                            const val = prompt('Valor indemnizado (€):')
                            if (val) atualizarSinistro(s.id, 'pago', parseFloat(val))
                          }} style={{ fontSize: 11, background: '#0D1B2E', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}>
                            💶 Registar Pagamento
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── View: Novo Apólice ── */}
      {view === 'novo_apolice' && (
        <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 16, padding: 32, maxWidth: 700 }}>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, margin: '0 0 20px' }}>Nova Apólice de Seguro</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Edifício *</label>
              <input value={formEdificio} onChange={e => setFormEdificio(e.target.value)} style={inputStyle} placeholder="Ex: Edifício Aurora" />
            </div>
            <div>
              <label style={labelStyle}>Seguradora *</label>
              <input value={formSeguradora} onChange={e => setFormSeguradora(e.target.value)} style={inputStyle} placeholder="Ex: Fidelidade" />
            </div>
            <div>
              <label style={labelStyle}>N.º Apólice</label>
              <input value={formNumero} onChange={e => setFormNumero(e.target.value)} style={inputStyle} placeholder="Ex: AP-2024-001" />
            </div>
            <div>
              <label style={labelStyle}>Tipo de Seguro</label>
              <select value={formTipo} onChange={e => setFormTipo(e.target.value as ApoliceSeguro['tipo'])} style={inputStyle}>
                {Object.entries(TIPOS_SEGURO).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Data Início</label>
              <input type="date" value={formDataInicio} onChange={e => setFormDataInicio(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Data Fim</label>
              <input type="date" value={formDataFim} onChange={e => setFormDataFim(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Prémio Anual (€)</label>
              <input type="number" value={formPremio} onChange={e => setFormPremio(e.target.value)} style={inputStyle} placeholder="0.00" />
            </div>
            <div>
              <label style={labelStyle}>Capital Segurado (€)</label>
              <input type="number" value={formCapital} onChange={e => setFormCapital(e.target.value)} style={inputStyle} placeholder="0.00" />
            </div>
            <div>
              <label style={labelStyle}>Franquia (€)</label>
              <input type="number" value={formFranquia} onChange={e => setFormFranquia(e.target.value)} style={inputStyle} placeholder="0.00" />
            </div>
            <div>
              <label style={labelStyle}>Contacto Seguradora</label>
              <input value={formContacto} onChange={e => setFormContacto(e.target.value)} style={inputStyle} placeholder="+351 ..." />
            </div>
            <div>
              <label style={labelStyle}>Email Seguradora</label>
              <input value={formEmailSeg} onChange={e => setFormEmailSeg(e.target.value)} style={inputStyle} placeholder="seguros@..." />
            </div>

            {/* Coberturas */}
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Coberturas</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {COBERTURAS_DISPONIVEIS.map(c => {
                  const sel = formCoberturas.includes(c)
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormCoberturas(prev => sel ? prev.filter(x => x !== c) : [...prev, c])}
                      style={{
                        fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
                        background: sel ? '#E6F4F2' : '#F7F4EE',
                        color: sel ? '#1A7A6E' : '#4A5E78',
                        border: sel ? '1px solid #1A7A6E' : '1px solid #E4DDD0',
                      }}
                    >
                      {sel ? '✓ ' : ''}{c}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Observações</label>
              <textarea value={formObs} onChange={e => setFormObs(e.target.value)} style={{ ...inputStyle, minHeight: 60 }} placeholder="Notas adicionais..." />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
            <button onClick={criarApolice} style={{ background: '#0D1B2E', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              ✓ Registar Apólice
            </button>
            <button onClick={() => { resetFormApolice(); setView('apolices') }} style={{ background: '#F7F4EE', color: '#4A5E78', border: '1px solid #E4DDD0', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>

          {/* Legal note */}
          <div style={{ marginTop: 20, background: '#FEF5E4', borderRadius: 10, padding: 16, fontSize: 12, color: '#D4830A' }}>
            <strong>⚖️ Obrigação Legal:</strong> O seguro contra incêndio é obrigatório para todos os edifícios em regime de propriedade horizontal (Art.º 1429.º do Código Civil). O valor do capital segurado deve corresponder ao valor de reconstrução do edifício.
          </div>
        </div>
      )}

      {/* ── View: Novo Sinistro ── */}
      {view === 'novo_sinistro' && (
        <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 16, padding: 32, maxWidth: 600 }}>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, margin: '0 0 20px' }}>⚠️ Participar Sinistro</h3>

          {apolices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#8A9BB0' }}>
              <p>Nenhuma apólice registada. Registe primeiro uma apólice de seguro.</p>
              <button onClick={() => setView('novo_apolice')} style={{ marginTop: 12, background: '#0D1B2E', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                + Nova Apólice
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Apólice *</label>
                  <select value={sinApoliceId} onChange={e => setSinApoliceId(e.target.value)} style={inputStyle}>
                    <option value="">Selecionar apólice...</option>
                    {apolices.map(a => (
                      <option key={a.id} value={a.id}>{a.edificioNom} — {a.seguradora} ({a.numeroApolice || '—'})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Data da Ocorrência</label>
                  <input type="date" value={sinDataOcorrencia} onChange={e => setSinDataOcorrencia(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Tipo de Sinistro</label>
                  <input value={sinTipo} onChange={e => setSinTipo(e.target.value)} style={inputStyle} placeholder="Ex: Inundação, Incêndio..." />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Descrição *</label>
                  <textarea value={sinDescricao} onChange={e => setSinDescricao(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} placeholder="Descreva o sinistro em detalhe..." />
                </div>
                <div>
                  <label style={labelStyle}>Valor Estimado (€)</label>
                  <input type="number" value={sinValor} onChange={e => setSinValor(e.target.value)} style={inputStyle} placeholder="0.00" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Observações</label>
                  <textarea value={sinObs} onChange={e => setSinObs(e.target.value)} style={{ ...inputStyle, minHeight: 60 }} placeholder="Notas adicionais..." />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
                <button onClick={criarSinistro} style={{ background: '#C0392B', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  ⚠️ Registar Sinistro
                </button>
                <button onClick={() => setView('sinistros')} style={{ background: '#F7F4EE', color: '#4A5E78', border: '1px solid #E4DDD0', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </>
          )}
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
