'use client'

import { useState, useEffect, useRef } from 'react'
import type { User } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════════════════════
// AG LIVE DIGITAL — Assembleia Geral em tempo real + votação instantânea
// ═══════════════════════════════════════════════════════════════════════════════

interface Props {
  user: User
  userRole: string
}

interface Immeuble {
  id: string
  nom: string
  adresse: string
  nbLots: number
}

// ── Types AG ──
type AGStatus = 'agendada' | 'convocada' | 'em_curso' | 'encerrada' | 'ata_pendente'

interface PontoOrdem {
  id: string
  numero: number
  titulo: string
  descricao: string
  tipo: 'informativo' | 'deliberativo' | 'eleicao'
  duracao: number // minutes
  estado: 'pendente' | 'em_discussao' | 'votado' | 'adiado'
  votacao?: Votacao
}

interface Votacao {
  id: string
  pontoId: string
  tipo: 'maioria_simples' | 'maioria_qualificada' | 'unanimidade'
  votos: VotoRegistado[]
  resultado?: 'aprovado' | 'rejeitado' | 'adiado'
  quorumNecessario: number // percentage
  quorumAtingido: boolean
  dataAbertura?: string
  dataFecho?: string
}

interface VotoRegistado {
  condominoId: string
  condominoNome: string
  fracao: string
  permilagem: number
  voto: 'favor' | 'contra' | 'abstencao'
  timestamp: string
  modo: 'presencial' | 'online' | 'procuracao'
}

interface AGSession {
  id: string
  immeubleId: string
  immeubleNom: string
  tipo: 'ordinaria' | 'extraordinaria'
  data: string
  hora: string
  local: string
  status: AGStatus
  pontosOrdem: PontoOrdem[]
  presentes: Presente[]
  pontoAtual: number // index
  iniciadaEm?: string
  encerradaEm?: string
  ataGerada: boolean
  observacoes: string
}

interface Presente {
  id: string
  nome: string
  fracao: string
  permilagem: number
  modo: 'presencial' | 'online' | 'procuracao'
  procuracaoDe?: string
  horaChegada: string
}

// ── Tabs ──
type TabAG = 'sessao_live' | 'agendar' | 'historico' | 'configuracao'

// ── Templates pontos de ordem standard PT ──
const PONTOS_TEMPLATE = [
  { titulo: 'Eleição da mesa da assembleia', tipo: 'eleicao' as const, duracao: 5 },
  { titulo: 'Aprovação da ata da assembleia anterior', tipo: 'deliberativo' as const, duracao: 10 },
  { titulo: 'Discussão e aprovação das contas do exercício', tipo: 'deliberativo' as const, duracao: 20 },
  { titulo: 'Aprovação do orçamento para o novo exercício', tipo: 'deliberativo' as const, duracao: 15 },
  { titulo: 'Eleição do administrador', tipo: 'eleicao' as const, duracao: 10 },
  { titulo: 'Apreciação do seguro obrigatório', tipo: 'informativo' as const, duracao: 5 },
  { titulo: 'Obras de conservação e manutenção', tipo: 'deliberativo' as const, duracao: 15 },
  { titulo: 'Diversos e assuntos gerais', tipo: 'informativo' as const, duracao: 10 },
]

export default function AGLiveDigitalSection({ user, userRole }: Props) {
  const [tab, setTab] = useState<TabAG>('sessao_live')
  const [immeubles, setImmeubles] = useState<Immeuble[]>([])
  const [sessions, setSessions] = useState<AGSession[]>([])
  const [activeSession, setActiveSession] = useState<AGSession | null>(null)
  const [showNewAG, setShowNewAG] = useState(false)
  const [showVoteModal, setShowVoteModal] = useState(false)
  const [showPresenceModal, setShowPresenceModal] = useState(false)
  const [liveTimer, setLiveTimer] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Form AG
  const [agForm, setAgForm] = useState({
    immeubleId: '',
    tipo: 'ordinaria' as AGSession['tipo'],
    data: '',
    hora: '18:00',
    local: '',
    usarTemplate: true,
  })

  // Form vote
  const [voteForm, setVoteForm] = useState({
    condominoNome: '',
    fracao: '',
    permilagem: 0,
    voto: 'favor' as VotoRegistado['voto'],
    modo: 'presencial' as VotoRegistado['modo'],
  })

  // Form présence
  const [presenceForm, setPresenceForm] = useState({
    nome: '',
    fracao: '',
    permilagem: 0,
    modo: 'presencial' as Presente['modo'],
    procuracaoDe: '',
  })

  const uid = user?.id || 'local'
  const storageKey = `fixit_syndic_ag_live_${uid}`

  // ── Load ──
  useEffect(() => {
    const fetchImm = async () => {
      try {
        const res = await fetch(`/api/syndic/immeubles?user_id=${uid}`)
        if (res.ok) {
          const data = await res.json()
          setImmeubles(data.immeubles || [])
        }
      } catch {
        const stored = localStorage.getItem(`fixit_syndic_immeubles_${uid}`)
        if (stored) setImmeubles(JSON.parse(stored))
      }
    }
    fetchImm()

    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const parsed: AGSession[] = JSON.parse(stored)
      setSessions(parsed)
      const live = parsed.find(s => s.status === 'em_curso')
      if (live) setActiveSession(live)
    }
  }, [uid])

  // ── Timer for live session ──
  useEffect(() => {
    if (activeSession?.status === 'em_curso' && activeSession.iniciadaEm) {
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - new Date(activeSession.iniciadaEm!).getTime()) / 1000)
        setLiveTimer(elapsed)
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [activeSession?.status, activeSession?.iniciadaEm])

  // ── Persist ──
  const saveSessions = (data: AGSession[]) => {
    setSessions(data)
    localStorage.setItem(storageKey, JSON.stringify(data))
  }

  // ── Create AG ──
  const createAG = () => {
    const imm = immeubles.find(i => i.id === agForm.immeubleId)
    if (!imm) return

    const pontosOrdem: PontoOrdem[] = agForm.usarTemplate
      ? PONTOS_TEMPLATE.map((p, i) => ({
          id: `pt_${Date.now()}_${i}`,
          numero: i + 1,
          titulo: p.titulo,
          descricao: '',
          tipo: p.tipo,
          duracao: p.duracao,
          estado: 'pendente' as const,
        }))
      : [{ id: `pt_${Date.now()}_0`, numero: 1, titulo: 'Ponto 1', descricao: '', tipo: 'informativo' as const, duracao: 10, estado: 'pendente' as const }]

    const session: AGSession = {
      id: `ag_${Date.now()}`,
      immeubleId: agForm.immeubleId,
      immeubleNom: imm.nom,
      tipo: agForm.tipo,
      data: agForm.data,
      hora: agForm.hora,
      local: agForm.local || imm.adresse,
      status: 'agendada',
      pontosOrdem,
      presentes: [],
      pontoAtual: 0,
      ataGerada: false,
      observacoes: '',
    }

    saveSessions([session, ...sessions])
    setShowNewAG(false)
    setAgForm({ immeubleId: '', tipo: 'ordinaria', data: '', hora: '18:00', local: '', usarTemplate: true })
  }

  // ── Start AG live ──
  const startAG = (session: AGSession) => {
    const updated = { ...session, status: 'em_curso' as AGStatus, iniciadaEm: new Date().toISOString() }
    const newSessions = sessions.map(s => s.id === session.id ? updated : s)
    saveSessions(newSessions)
    setActiveSession(updated)
    setTab('sessao_live')
  }

  // ── Navigate points ──
  const goToPoint = (index: number) => {
    if (!activeSession) return
    const pts = [...activeSession.pontosOrdem]
    // Mark previous as voted if deliberativo
    if (activeSession.pontoAtual < pts.length) {
      const prev = pts[activeSession.pontoAtual]
      if (prev.estado === 'em_discussao') {
        prev.estado = prev.votacao ? 'votado' : 'pendente'
      }
    }
    if (index < pts.length) {
      pts[index].estado = 'em_discussao'
    }
    const updated = { ...activeSession, pontosOrdem: pts, pontoAtual: index }
    const newSessions = sessions.map(s => s.id === updated.id ? updated : s)
    saveSessions(newSessions)
    setActiveSession(updated)
  }

  // ── Vote ──
  const submitVote = () => {
    if (!activeSession) return
    const pts = [...activeSession.pontosOrdem]
    const ponto = pts[activeSession.pontoAtual]
    if (!ponto) return

    const voto: VotoRegistado = {
      condominoId: `cond_${Date.now()}`,
      condominoNome: voteForm.condominoNome,
      fracao: voteForm.fracao,
      permilagem: voteForm.permilagem,
      voto: voteForm.voto,
      timestamp: new Date().toISOString(),
      modo: voteForm.modo,
    }

    if (!ponto.votacao) {
      ponto.votacao = {
        id: `vote_${Date.now()}`,
        pontoId: ponto.id,
        tipo: 'maioria_simples',
        votos: [voto],
        quorumNecessario: 50,
        quorumAtingido: false,
        dataAbertura: new Date().toISOString(),
      }
    } else {
      ponto.votacao.votos.push(voto)
    }

    // Calculate result
    const totalPermilagem = ponto.votacao.votos.reduce((sum, v) => sum + v.permilagem, 0)
    const favorPermilagem = ponto.votacao.votos.filter(v => v.voto === 'favor').reduce((sum, v) => sum + v.permilagem, 0)
    ponto.votacao.quorumAtingido = totalPermilagem >= (ponto.votacao.quorumNecessario * 10) // permilagem base 1000

    const updated = { ...activeSession, pontosOrdem: pts }
    const newSessions = sessions.map(s => s.id === updated.id ? updated : s)
    saveSessions(newSessions)
    setActiveSession(updated)
    setShowVoteModal(false)
    setVoteForm({ condominoNome: '', fracao: '', permilagem: 0, voto: 'favor', modo: 'presencial' })
  }

  // ── Close vote ──
  const closeVote = (pontoIndex: number) => {
    if (!activeSession) return
    const pts = [...activeSession.pontosOrdem]
    const ponto = pts[pontoIndex]
    if (!ponto?.votacao) return

    const favorPerm = ponto.votacao.votos.filter(v => v.voto === 'favor').reduce((s, v) => s + v.permilagem, 0)
    const totalPerm = ponto.votacao.votos.reduce((s, v) => s + v.permilagem, 0)
    ponto.votacao.resultado = totalPerm > 0 && favorPerm > totalPerm / 2 ? 'aprovado' : 'rejeitado'
    ponto.votacao.dataFecho = new Date().toISOString()
    ponto.estado = 'votado'

    const updated = { ...activeSession, pontosOrdem: pts }
    const newSessions = sessions.map(s => s.id === updated.id ? updated : s)
    saveSessions(newSessions)
    setActiveSession(updated)
  }

  // ── Add presence ──
  const addPresence = () => {
    if (!activeSession) return
    const presente: Presente = {
      id: `pres_${Date.now()}`,
      nome: presenceForm.nome,
      fracao: presenceForm.fracao,
      permilagem: presenceForm.permilagem,
      modo: presenceForm.modo,
      procuracaoDe: presenceForm.procuracaoDe || undefined,
      horaChegada: new Date().toISOString(),
    }

    const updated = { ...activeSession, presentes: [...activeSession.presentes, presente] }
    const newSessions = sessions.map(s => s.id === updated.id ? updated : s)
    saveSessions(newSessions)
    setActiveSession(updated)
    setShowPresenceModal(false)
    setPresenceForm({ nome: '', fracao: '', permilagem: 0, modo: 'presencial', procuracaoDe: '' })
  }

  // ── End AG ──
  const endAG = () => {
    if (!activeSession) return
    const updated = { ...activeSession, status: 'encerrada' as AGStatus, encerradaEm: new Date().toISOString() }
    const newSessions = sessions.map(s => s.id === updated.id ? updated : s)
    saveSessions(newSessions)
    setActiveSession(null)
    if (timerRef.current) clearInterval(timerRef.current)
    setLiveTimer(0)
  }

  // ── Format timer ──
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // ── Stats ──
  const totalAGs = sessions.length
  const agEncerradas = sessions.filter(s => s.status === 'encerrada').length
  const totalPresentes = activeSession?.presentes.length || 0
  const totalPermilagem = activeSession?.presentes.reduce((s, p) => s + p.permilagem, 0) || 0

  const tabs: { id: TabAG; label: string; emoji: string }[] = [
    { id: 'sessao_live', label: 'Sessão Live', emoji: '🔴' },
    { id: 'agendar', label: 'Agendar AG', emoji: '📅' },
    { id: 'historico', label: 'Histórico', emoji: '📜' },
    { id: 'configuracao', label: 'Configuração', emoji: '⚙️' },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: '#0D1B2E', margin: 0 }}>
          🏛️ Assembleia Geral Digital
        </h1>
        <p style={{ color: '#4A5E78', fontSize: 14, marginTop: 4 }}>
          Sessão em tempo real · Votação instantânea · Controlo de presenças · Ata automática
        </p>
      </div>

      {/* Live indicator */}
      {activeSession?.status === 'em_curso' && (
        <div style={{
          background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
          color: '#fff',
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontWeight: 700, fontSize: 16 }}>
              AG EM CURSO — {activeSession.immeubleNom}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 20 }}>{formatTime(liveTimer)}</span>
            <span style={{ fontSize: 13 }}>👥 {totalPresentes} presentes · {totalPermilagem}‰</span>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { emoji: '🏛️', label: 'Total AGs', value: totalAGs, color: '#0D1B2E' },
          { emoji: '✅', label: 'Encerradas', value: agEncerradas, color: '#22C55E' },
          { emoji: '👥', label: 'Presentes (live)', value: totalPresentes, color: '#0EA5E9' },
          { emoji: '📊', label: 'Permilagem (live)', value: `${totalPermilagem}‰`, color: '#C9A84C' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{s.emoji}</span>
              <span style={{ fontSize: 12, color: '#4A5E78' }}>{s.label}</span>
            </div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid #E4DDD0' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid #C9A84C' : '2px solid transparent',
              background: tab === t.id ? '#F7F4EE' : 'transparent',
              color: tab === t.id ? '#0D1B2E' : '#4A5E78',
              fontWeight: tab === t.id ? 600 : 400,
              fontSize: 14,
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
              marginBottom: -2,
            }}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: SESSÃO LIVE ═══ */}
      {tab === 'sessao_live' && (
        <div>
          {!activeSession || activeSession.status !== 'em_curso' ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
              <div style={{ fontSize: 60, marginBottom: 16 }}>🏛️</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#0D1B2E' }}>Nenhuma AG em curso</div>
              <div style={{ fontSize: 14, marginTop: 8 }}>Agende uma AG ou inicie uma sessão agendada</div>
              <button
                onClick={() => setTab('agendar')}
                style={{
                  marginTop: 20,
                  padding: '12px 24px',
                  background: '#C9A84C',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                📅 Agendar nova AG
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 20 }}>
              {/* Main: Pontos de ordem */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 18, color: '#0D1B2E' }}>📋 Ordem de Trabalhos</h3>
                  <button
                    onClick={endAG}
                    style={{
                      padding: '8px 16px',
                      background: '#DC2626',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ⏹ Encerrar AG
                  </button>
                </div>

                {activeSession.pontosOrdem.map((ponto, idx) => (
                  <div
                    key={ponto.id}
                    style={{
                      background: '#fff',
                      border: idx === activeSession.pontoAtual ? '2px solid #C9A84C' : '1px solid #E4DDD0',
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 12,
                      cursor: 'pointer',
                    }}
                    onClick={() => goToPoint(idx)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: idx === activeSession.pontoAtual ? '#C9A84C' : ponto.estado === 'votado' ? '#22C55E' : '#E4DDD0',
                          color: idx === activeSession.pontoAtual || ponto.estado === 'votado' ? '#fff' : '#4A5E78',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          fontWeight: 700,
                        }}>
                          {ponto.estado === 'votado' ? '✓' : ponto.numero}
                        </span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#0D1B2E' }}>{ponto.titulo}</div>
                          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                            {ponto.tipo === 'deliberativo' ? '🗳️ Deliberativo' : ponto.tipo === 'eleicao' ? '👤 Eleição' : 'ℹ️ Informativo'}
                            {' · '}{ponto.duracao} min
                          </div>
                        </div>
                      </div>

                      <span style={{
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 600,
                        background: ponto.estado === 'votado' ? '#DCFCE7' : ponto.estado === 'em_discussao' ? '#FEF3C7' : '#F3F4F6',
                        color: ponto.estado === 'votado' ? '#166534' : ponto.estado === 'em_discussao' ? '#92400E' : '#6B7280',
                      }}>
                        {ponto.estado === 'votado' ? '✅ Votado' : ponto.estado === 'em_discussao' ? '💬 Em discussão' : ponto.estado === 'adiado' ? '⏸ Adiado' : '⏳ Pendente'}
                      </span>
                    </div>

                    {/* Vote results if exists */}
                    {ponto.votacao && ponto.votacao.votos.length > 0 && (
                      <div style={{ marginTop: 12, padding: 12, background: '#F7F4EE', borderRadius: 8 }}>
                        <div style={{ display: 'flex', gap: 16, fontSize: 13, marginBottom: 8 }}>
                          <span style={{ color: '#22C55E' }}>
                            👍 {ponto.votacao.votos.filter(v => v.voto === 'favor').length} A favor
                            ({ponto.votacao.votos.filter(v => v.voto === 'favor').reduce((s, v) => s + v.permilagem, 0)}‰)
                          </span>
                          <span style={{ color: '#EF4444' }}>
                            👎 {ponto.votacao.votos.filter(v => v.voto === 'contra').length} Contra
                            ({ponto.votacao.votos.filter(v => v.voto === 'contra').reduce((s, v) => s + v.permilagem, 0)}‰)
                          </span>
                          <span style={{ color: '#6B7280' }}>
                            ✋ {ponto.votacao.votos.filter(v => v.voto === 'abstencao').length} Abstenções
                          </span>
                        </div>

                        {/* Progress bar visual */}
                        {(() => {
                          const total = ponto.votacao!.votos.reduce((s, v) => s + v.permilagem, 0) || 1
                          const favor = ponto.votacao!.votos.filter(v => v.voto === 'favor').reduce((s, v) => s + v.permilagem, 0)
                          const contra = ponto.votacao!.votos.filter(v => v.voto === 'contra').reduce((s, v) => s + v.permilagem, 0)
                          return (
                            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#E5E7EB' }}>
                              <div style={{ width: `${(favor / total) * 100}%`, background: '#22C55E' }} />
                              <div style={{ width: `${(contra / total) * 100}%`, background: '#EF4444' }} />
                            </div>
                          )
                        })()}

                        {/* Vote result badge */}
                        {ponto.votacao.resultado && (
                          <div style={{
                            marginTop: 8,
                            padding: '4px 12px',
                            borderRadius: 20,
                            display: 'inline-block',
                            fontSize: 12,
                            fontWeight: 700,
                            background: ponto.votacao.resultado === 'aprovado' ? '#DCFCE7' : '#FEE2E2',
                            color: ponto.votacao.resultado === 'aprovado' ? '#166534' : '#991B1B',
                          }}>
                            {ponto.votacao.resultado === 'aprovado' ? '✅ APROVADO' : '❌ REJEITADO'}
                          </div>
                        )}

                        {/* Close vote button */}
                        {!ponto.votacao.resultado && idx === activeSession.pontoAtual && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button
                              onClick={e => { e.stopPropagation(); setShowVoteModal(true) }}
                              style={{ padding: '6px 12px', background: '#C9A84C', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                            >
                              + Registar voto
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); closeVote(idx) }}
                              style={{ padding: '6px 12px', background: '#0D1B2E', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                            >
                              🔒 Fechar votação
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Start vote button for current deliberative point */}
                    {idx === activeSession.pontoAtual && ponto.tipo !== 'informativo' && !ponto.votacao && (
                      <button
                        onClick={e => { e.stopPropagation(); setShowVoteModal(true) }}
                        style={{
                          marginTop: 12,
                          padding: '8px 16px',
                          background: '#C9A84C',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        🗳️ Iniciar votação
                      </button>
                    )}
                  </div>
                ))}

                {/* Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                  <button
                    onClick={() => goToPoint(Math.max(0, activeSession.pontoAtual - 1))}
                    disabled={activeSession.pontoAtual === 0}
                    style={{
                      padding: '10px 20px',
                      border: '1px solid #E4DDD0',
                      borderRadius: 8,
                      background: '#fff',
                      cursor: activeSession.pontoAtual === 0 ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      opacity: activeSession.pontoAtual === 0 ? 0.5 : 1,
                    }}
                  >
                    ← Ponto anterior
                  </button>
                  <span style={{ fontSize: 13, color: '#4A5E78', alignSelf: 'center' }}>
                    Ponto {activeSession.pontoAtual + 1} / {activeSession.pontosOrdem.length}
                  </span>
                  <button
                    onClick={() => goToPoint(Math.min(activeSession.pontosOrdem.length - 1, activeSession.pontoAtual + 1))}
                    disabled={activeSession.pontoAtual >= activeSession.pontosOrdem.length - 1}
                    style={{
                      padding: '10px 20px',
                      background: '#C9A84C',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      cursor: activeSession.pontoAtual >= activeSession.pontosOrdem.length - 1 ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      opacity: activeSession.pontoAtual >= activeSession.pontosOrdem.length - 1 ? 0.5 : 1,
                    }}
                  >
                    Ponto seguinte →
                  </button>
                </div>
              </div>

              {/* Sidebar: Presenças */}
              <div>
                <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h4 style={{ margin: 0, fontSize: 15, color: '#0D1B2E' }}>👥 Presenças</h4>
                    <button
                      onClick={() => setShowPresenceModal(true)}
                      style={{
                        padding: '6px 12px',
                        background: '#C9A84C',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      + Registar
                    </button>
                  </div>

                  {/* Quorum indicator */}
                  <div style={{
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 12,
                    background: totalPermilagem >= 500 ? '#F0FDF4' : '#FEF2F2',
                    border: `1px solid ${totalPermilagem >= 500 ? '#BBF7D0' : '#FECACA'}`,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: totalPermilagem >= 500 ? '#166534' : '#991B1B' }}>
                      {totalPermilagem >= 500 ? '✅ Quórum atingido' : '⚠️ Quórum não atingido'}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#0D1B2E', marginTop: 4 }}>
                      {totalPermilagem}‰ / 500‰
                    </div>
                    <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(100, (totalPermilagem / 500) * 100)}%`,
                        background: totalPermilagem >= 500 ? '#22C55E' : '#EF4444',
                        borderRadius: 3,
                      }} />
                    </div>
                  </div>

                  {/* List */}
                  <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                    {activeSession.presentes.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 20, color: '#9CA3AF', fontSize: 13 }}>
                        Nenhum condómino registado
                      </div>
                    ) : (
                      activeSession.presentes.map(p => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F3F4F6', fontSize: 13 }}>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0D1B2E' }}>{p.nome}</div>
                            <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                              Fração {p.fracao} · {p.permilagem}‰ · {p.modo === 'presencial' ? '🏢' : p.modo === 'online' ? '💻' : '📄'} {p.modo}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: AGENDAR ═══ */}
      {tab === 'agendar' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 18, color: '#0D1B2E' }}>📅 Assembleias Agendadas</h3>
            <button
              onClick={() => setShowNewAG(true)}
              style={{ padding: '10px 20px', background: '#C9A84C', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              + Nova AG
            </button>
          </div>

          {/* Scheduled AGs list */}
          {sessions.filter(s => s.status === 'agendada' || s.status === 'convocada').length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
              <div>Nenhuma AG agendada</div>
            </div>
          ) : (
            sessions.filter(s => s.status === 'agendada' || s.status === 'convocada').map(s => (
              <div key={s.id} style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16, color: '#0D1B2E' }}>
                      {s.tipo === 'ordinaria' ? '📋 AG Ordinária' : '⚡ AG Extraordinária'}
                    </div>
                    <div style={{ fontSize: 13, color: '#4A5E78', marginTop: 4 }}>
                      🏢 {s.immeubleNom} · 📅 {new Date(s.data).toLocaleDateString('pt-PT')} · ⏰ {s.hora} · 📍 {s.local}
                    </div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
                      {s.pontosOrdem.length} pontos na ordem de trabalhos
                    </div>
                  </div>
                  <button
                    onClick={() => startAG(s)}
                    style={{
                      padding: '10px 20px',
                      background: '#22C55E',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ▶️ Iniciar AG
                  </button>
                </div>
              </div>
            ))
          )}

          {/* New AG Modal */}
          {showNewAG && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 18, color: '#0D1B2E' }}>📅 Agendar Nova AG</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Edifício</label>
                    <select
                      value={agForm.immeubleId}
                      onChange={e => setAgForm({ ...agForm, immeubleId: e.target.value })}
                      style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                    >
                      <option value="">Selecione...</option>
                      {immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Tipo</label>
                    <select
                      value={agForm.tipo}
                      onChange={e => setAgForm({ ...agForm, tipo: e.target.value as any })}
                      style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                    >
                      <option value="ordinaria">AG Ordinária</option>
                      <option value="extraordinaria">AG Extraordinária</option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Data</label>
                      <input
                        type="date"
                        value={agForm.data}
                        onChange={e => setAgForm({ ...agForm, data: e.target.value })}
                        style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Hora</label>
                      <input
                        type="time"
                        value={agForm.hora}
                        onChange={e => setAgForm({ ...agForm, hora: e.target.value })}
                        style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Local</label>
                    <input
                      type="text"
                      value={agForm.local}
                      onChange={e => setAgForm({ ...agForm, local: e.target.value })}
                      placeholder="Endereço ou sala"
                      style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={agForm.usarTemplate}
                      onChange={e => setAgForm({ ...agForm, usarTemplate: e.target.checked })}
                    />
                    <label style={{ fontSize: 13, color: '#4A5E78' }}>
                      Usar modelo standard de ordem de trabalhos (8 pontos)
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button onClick={() => setShowNewAG(false)} style={{ flex: 1, padding: 12, border: '1px solid #E4DDD0', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button
                    onClick={createAG}
                    disabled={!agForm.immeubleId || !agForm.data}
                    style={{ flex: 1, padding: 12, background: '#C9A84C', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                  >
                    ✅ Criar AG
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: HISTÓRICO ═══ */}
      {tab === 'historico' && (
        <div>
          {sessions.filter(s => s.status === 'encerrada').length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📜</div>
              <div>Nenhuma AG encerrada</div>
            </div>
          ) : (
            sessions.filter(s => s.status === 'encerrada').map(s => {
              const totalVotacoes = s.pontosOrdem.filter(p => p.votacao?.resultado).length
              const aprovados = s.pontosOrdem.filter(p => p.votacao?.resultado === 'aprovado').length
              const duration = s.iniciadaEm && s.encerradaEm
                ? Math.round((new Date(s.encerradaEm).getTime() - new Date(s.iniciadaEm).getTime()) / 60000)
                : 0

              return (
                <div key={s.id} style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 16, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16, color: '#0D1B2E' }}>
                        {s.tipo === 'ordinaria' ? '📋' : '⚡'} {s.immeubleNom}
                      </div>
                      <div style={{ fontSize: 13, color: '#4A5E78', marginTop: 4 }}>
                        📅 {new Date(s.data).toLocaleDateString('pt-PT')} · ⏱ {duration} min · 👥 {s.presentes.length} presentes
                      </div>
                    </div>
                    <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#DCFCE7', color: '#166534' }}>
                      Encerrada
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 13, color: '#6B7280' }}>
                    <span>🗳️ {totalVotacoes} votações</span>
                    <span>✅ {aprovados} aprovados</span>
                    <span>📊 {s.presentes.reduce((s2, p) => s2 + p.permilagem, 0)}‰ representados</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ═══ TAB: CONFIGURAÇÃO ═══ */}
      {tab === 'configuracao' && (
        <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 18, color: '#0D1B2E' }}>⚙️ Configurações da AG Digital</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            <div style={{ padding: 16, border: '1px solid #E4DDD0', borderRadius: 10 }}>
              <div style={{ fontWeight: 600, color: '#0D1B2E', marginBottom: 8 }}>🗳️ Regras de votação</div>
              <div style={{ fontSize: 13, color: '#4A5E78', lineHeight: 1.8 }}>
                • Maioria simples: &gt;50% permilagem<br />
                • Maioria qualificada (2/3): obras estruturais<br />
                • Unanimidade: alteração título constitutivo<br />
                • Quórum mínimo 1ª conv.: 50% (500‰)<br />
                • Quórum 2ª conv.: qualquer representação
              </div>
            </div>

            <div style={{ padding: 16, border: '1px solid #E4DDD0', borderRadius: 10 }}>
              <div style={{ fontWeight: 600, color: '#0D1B2E', marginBottom: 8 }}>📋 Prazos legais (Lei 8/2022)</div>
              <div style={{ fontSize: 13, color: '#4A5E78', lineHeight: 1.8 }}>
                • Convocatória: mín. 10 dias antes<br />
                • Carta registada obrigatória<br />
                • AG ordinária: 1x/ano nos primeiros 3 meses<br />
                • Ata: até 30 dias após AG<br />
                • Envio ata: até 30 dias após redação
              </div>
            </div>

            <div style={{ padding: 16, border: '1px solid #E4DDD0', borderRadius: 10 }}>
              <div style={{ fontWeight: 600, color: '#0D1B2E', marginBottom: 8 }}>💻 Participação online</div>
              <div style={{ fontSize: 13, color: '#4A5E78', lineHeight: 1.8 }}>
                • Permitida se prevista no regulamento<br />
                • Voto por procuração aceite<br />
                • Cada condómino: 1 voto por fração<br />
                • Permilagem define peso do voto<br />
                • Registo de presença obrigatório
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: VOTE ═══ */}
      {showVoteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 450 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18, color: '#0D1B2E' }}>🗳️ Registar Voto</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Condómino</label>
                <input
                  value={voteForm.condominoNome}
                  onChange={e => setVoteForm({ ...voteForm, condominoNome: e.target.value })}
                  placeholder="Nome do condómino"
                  style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Fração</label>
                  <input
                    value={voteForm.fracao}
                    onChange={e => setVoteForm({ ...voteForm, fracao: e.target.value })}
                    placeholder="Ex: A, B1"
                    style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Permilagem (‰)</label>
                  <input
                    type="number"
                    value={voteForm.permilagem || ''}
                    onChange={e => setVoteForm({ ...voteForm, permilagem: Number(e.target.value) })}
                    placeholder="Ex: 50"
                    style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Sentido do voto</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { value: 'favor', label: '👍 A favor', bg: '#DCFCE7', color: '#166534' },
                    { value: 'contra', label: '👎 Contra', bg: '#FEE2E2', color: '#991B1B' },
                    { value: 'abstencao', label: '✋ Abstenção', bg: '#F3F4F6', color: '#4B5563' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setVoteForm({ ...voteForm, voto: opt.value as any })}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: 8,
                        border: voteForm.voto === opt.value ? '2px solid #0D1B2E' : '1px solid #E4DDD0',
                        background: voteForm.voto === opt.value ? opt.bg : '#fff',
                        color: voteForm.voto === opt.value ? opt.color : '#6B7280',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Modo</label>
                <select
                  value={voteForm.modo}
                  onChange={e => setVoteForm({ ...voteForm, modo: e.target.value as any })}
                  style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                >
                  <option value="presencial">🏢 Presencial</option>
                  <option value="online">💻 Online</option>
                  <option value="procuracao">📄 Procuração</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={() => setShowVoteModal(false)} style={{ flex: 1, padding: 12, border: '1px solid #E4DDD0', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button
                onClick={submitVote}
                disabled={!voteForm.condominoNome || !voteForm.fracao || !voteForm.permilagem}
                style={{ flex: 1, padding: 12, background: '#C9A84C', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
              >
                ✅ Registar voto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: PRESENÇA ═══ */}
      {showPresenceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 450 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18, color: '#0D1B2E' }}>👤 Registar Presença</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Nome</label>
                <input
                  value={presenceForm.nome}
                  onChange={e => setPresenceForm({ ...presenceForm, nome: e.target.value })}
                  placeholder="Nome do condómino"
                  style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Fração</label>
                  <input
                    value={presenceForm.fracao}
                    onChange={e => setPresenceForm({ ...presenceForm, fracao: e.target.value })}
                    placeholder="Ex: A, B1"
                    style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Permilagem (‰)</label>
                  <input
                    type="number"
                    value={presenceForm.permilagem || ''}
                    onChange={e => setPresenceForm({ ...presenceForm, permilagem: Number(e.target.value) })}
                    style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Modo de presença</label>
                <select
                  value={presenceForm.modo}
                  onChange={e => setPresenceForm({ ...presenceForm, modo: e.target.value as any })}
                  style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                >
                  <option value="presencial">🏢 Presencial</option>
                  <option value="online">💻 Online</option>
                  <option value="procuracao">📄 Procuração</option>
                </select>
              </div>

              {presenceForm.modo === 'procuracao' && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Procuração de</label>
                  <input
                    value={presenceForm.procuracaoDe}
                    onChange={e => setPresenceForm({ ...presenceForm, procuracaoDe: e.target.value })}
                    placeholder="Nome do mandante"
                    style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={() => setShowPresenceModal(false)} style={{ flex: 1, padding: 12, border: '1px solid #E4DDD0', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button
                onClick={addPresence}
                disabled={!presenceForm.nome || !presenceForm.fracao || !presenceForm.permilagem}
                style={{ flex: 1, padding: 12, background: '#C9A84C', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
              >
                ✅ Registar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
