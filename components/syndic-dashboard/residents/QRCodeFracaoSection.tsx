'use client'

import { useState, useEffect, useRef } from 'react'
import type { User } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════════════════════
// QR CODE POR FRAÇÃO — Signalement géolocalisé via QR Code
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

interface QRConfig {
  id: string
  immeubleId: string
  immeubleNom: string
  fracao: string
  zona: string // ex: Hall, Garagem, Cobertura, Escada A
  tipo: 'fracao' | 'zona_comum' | 'equipamento'
  qrData: string
  dataCriacao: string
  totalScans: number
  ultimoScan?: string
  ativo: boolean
}

interface Signalement {
  id: string
  qrConfigId: string
  immeubleNom: string
  fracao: string
  zona: string
  tipo: 'avaria' | 'limpeza' | 'seguranca' | 'ruido' | 'infiltracao' | 'elevador' | 'iluminacao' | 'outro'
  descricao: string
  fotos: string[]
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente'
  status: 'novo' | 'em_analise' | 'em_curso' | 'resolvido'
  dataCriacao: string
  reportadoPor: string
  contacto?: string
}

const ZONAS_COMUNS = [
  'Hall de Entrada', 'Garagem', 'Cave', 'Cobertura / Terraço', 'Escada A', 'Escada B',
  'Elevador', 'Sala do Condomínio', 'Sala de Máquinas', 'Jardim', 'Piscina',
  'Ginásio', 'Lavandaria', 'Parque Infantil', 'Corredor Piso 0', 'Corredor Piso 1',
]

const TIPOS_SIGNALEMENT: { id: Signalement['tipo']; label: string; emoji: string }[] = [
  { id: 'avaria', label: 'Avaria', emoji: '🔧' },
  { id: 'limpeza', label: 'Limpeza', emoji: '🧹' },
  { id: 'seguranca', label: 'Segurança', emoji: '🔒' },
  { id: 'ruido', label: 'Ruído', emoji: '🔊' },
  { id: 'infiltracao', label: 'Infiltração', emoji: '💧' },
  { id: 'elevador', label: 'Elevador', emoji: '🛗' },
  { id: 'iluminacao', label: 'Iluminação', emoji: '💡' },
  { id: 'outro', label: 'Outro', emoji: '📋' },
]

type TabQR = 'gerir_qr' | 'signalements' | 'estatisticas'

// ── Simple QR Code SVG generator ──
function generateQRSVG(data: string, size: number = 200): string {
  // Simple visual QR-like pattern (real QR would need a library)
  const cells = 21
  const cellSize = size / cells
  let rects = ''

  // Generate deterministic pattern from data hash
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0
  }

  // Position patterns (corners)
  const addFinder = (x: number, y: number) => {
    for (let dy = 0; dy < 7; dy++) {
      for (let dx = 0; dx < 7; dx++) {
        const isBorder = dx === 0 || dx === 6 || dy === 0 || dy === 6
        const isInner = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4
        if (isBorder || isInner) {
          rects += `<rect x="${(x + dx) * cellSize}" y="${(y + dy) * cellSize}" width="${cellSize}" height="${cellSize}" fill="#0D1B2E"/>`
        }
      }
    }
  }

  addFinder(0, 0)
  addFinder(cells - 7, 0)
  addFinder(0, cells - 7)

  // Data cells
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      // Skip finder areas
      if ((x < 8 && y < 8) || (x >= cells - 8 && y < 8) || (x < 8 && y >= cells - 8)) continue
      const seed = (hash + x * 31 + y * 17) & 0xFFFF
      if (seed % 3 === 0) {
        rects += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="#0D1B2E"/>`
      }
    }
  }

  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" fill="white"/>${rects}</svg>`
}

export default function QRCodeFracaoSection({ user, userRole }: Props) {
  const [tab, setTab] = useState<TabQR>('gerir_qr')
  const [immeubles, setImmeubles] = useState<Immeuble[]>([])
  const [qrConfigs, setQrConfigs] = useState<QRConfig[]>([])
  const [signalements, setSignalements] = useState<Signalement[]>([])
  const [showNewQR, setShowNewQR] = useState(false)
  const [showQRDetail, setShowQRDetail] = useState<QRConfig | null>(null)
  const [filterImmeuble, setFilterImmeuble] = useState<string>('all')
  const [newQRForm, setNewQRForm] = useState({
    immeubleId: '',
    tipo: 'zona_comum' as QRConfig['tipo'],
    fracao: '',
    zona: '',
    zonaCustom: '',
  })

  const uid = user?.id || 'local'
  const qrKey = `fixit_syndic_qr_${uid}`
  const sigKey = `fixit_syndic_qr_signalements_${uid}`

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

    const storedQR = localStorage.getItem(qrKey)
    if (storedQR) setQrConfigs(JSON.parse(storedQR))
    const storedSig = localStorage.getItem(sigKey)
    if (storedSig) setSignalements(JSON.parse(storedSig))
  }, [uid])

  const saveQR = (data: QRConfig[]) => {
    setQrConfigs(data)
    localStorage.setItem(qrKey, JSON.stringify(data))
  }

  const saveSig = (data: Signalement[]) => {
    setSignalements(data)
    localStorage.setItem(sigKey, JSON.stringify(data))
  }

  const createQR = () => {
    const imm = immeubles.find(i => i.id === newQRForm.immeubleId)
    if (!imm) return

    const zona = newQRForm.tipo === 'zona_comum'
      ? (newQRForm.zona || newQRForm.zonaCustom)
      : newQRForm.fracao

    const qrData = `fixit://report/${imm.id}/${zona.replace(/\s/g, '-')}/${Date.now()}`

    const config: QRConfig = {
      id: `qr_${Date.now()}`,
      immeubleId: imm.id,
      immeubleNom: imm.nom,
      fracao: newQRForm.tipo === 'fracao' ? newQRForm.fracao : '',
      zona,
      tipo: newQRForm.tipo,
      qrData,
      dataCriacao: new Date().toISOString(),
      totalScans: 0,
      ativo: true,
    }

    saveQR([...qrConfigs, config])
    setShowNewQR(false)
    setNewQRForm({ immeubleId: '', tipo: 'zona_comum', fracao: '', zona: '', zonaCustom: '' })
  }

  const createBulkQR = (immeubleId: string) => {
    const imm = immeubles.find(i => i.id === immeubleId)
    if (!imm) return

    const newConfigs: QRConfig[] = ZONAS_COMUNS.slice(0, 8).map((zona, idx) => ({
      id: `qr_${Date.now()}_${idx}`,
      immeubleId: imm.id,
      immeubleNom: imm.nom,
      fracao: '',
      zona,
      tipo: 'zona_comum' as const,
      qrData: `fixit://report/${imm.id}/${zona.replace(/\s/g, '-')}/${Date.now() + idx}`,
      dataCriacao: new Date().toISOString(),
      totalScans: 0,
      ativo: true,
    }))

    saveQR([...qrConfigs, ...newConfigs])
  }

  const toggleQR = (id: string) => {
    const updated = qrConfigs.map(q => q.id === id ? { ...q, ativo: !q.ativo } : q)
    saveQR(updated)
  }

  const deleteQR = (id: string) => {
    saveQR(qrConfigs.filter(q => q.id !== id))
  }

  // ── Simulate receiving a signalement ──
  const simulateSignalement = (qrId: string) => {
    const qr = qrConfigs.find(q => q.id === qrId)
    if (!qr) return

    const randomType = TIPOS_SIGNALEMENT[Math.floor(Math.random() * TIPOS_SIGNALEMENT.length)]
    const sig: Signalement = {
      id: `sig_${Date.now()}`,
      qrConfigId: qrId,
      immeubleNom: qr.immeubleNom,
      fracao: qr.fracao,
      zona: qr.zona,
      tipo: randomType.id,
      descricao: `Signalement automático de teste: ${randomType.label} na zona ${qr.zona}`,
      fotos: [],
      prioridade: ['baixa', 'media', 'alta'][Math.floor(Math.random() * 3)] as Signalement['prioridade'],
      status: 'novo',
      dataCriacao: new Date().toISOString(),
      reportadoPor: 'Condómino (scan QR)',
    }

    saveSig([sig, ...signalements])

    // Update scan count
    const updatedQR = qrConfigs.map(q => q.id === qrId
      ? { ...q, totalScans: q.totalScans + 1, ultimoScan: new Date().toISOString() }
      : q)
    saveQR(updatedQR)
  }

  const updateSigStatus = (id: string, status: Signalement['status']) => {
    const updated = signalements.map(s => s.id === id ? { ...s, status } : s)
    saveSig(updated)
  }

  // ── Filtered ──
  const filteredQR = filterImmeuble === 'all'
    ? qrConfigs
    : qrConfigs.filter(q => q.immeubleId === filterImmeuble)

  // ── Stats ──
  const totalQR = qrConfigs.length
  const totalScans = qrConfigs.reduce((s, q) => s + q.totalScans, 0)
  const newSigs = signalements.filter(s => s.status === 'novo').length
  const resolvedSigs = signalements.filter(s => s.status === 'resolvido').length

  const tabs: { id: TabQR; label: string; emoji: string }[] = [
    { id: 'gerir_qr', label: 'Gerir QR Codes', emoji: '📱' },
    { id: 'signalements', label: `Signalements (${newSigs})`, emoji: '🚨' },
    { id: 'estatisticas', label: 'Estatísticas', emoji: '📊' },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: '#0D1B2E', margin: 0 }}>
          📱 QR Code por Fração
        </h1>
        <p style={{ color: '#4A5E78', fontSize: 14, marginTop: 4 }}>
          Gere QR Codes por zona · Condóminos reportam problemas com scan · Signalements automáticos
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { emoji: '📱', label: 'QR Codes ativos', value: qrConfigs.filter(q => q.ativo).length, color: '#0D1B2E' },
          { emoji: '👁️', label: 'Total scans', value: totalScans, color: '#0EA5E9' },
          { emoji: '🆕', label: 'Novos signalements', value: newSigs, color: '#EF4444' },
          { emoji: '✅', label: 'Resolvidos', value: resolvedSigs, color: '#22C55E' },
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
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 20px', border: 'none',
            borderBottom: tab === t.id ? '2px solid #C9A84C' : '2px solid transparent',
            background: tab === t.id ? '#F7F4EE' : 'transparent',
            color: tab === t.id ? '#0D1B2E' : '#4A5E78',
            fontWeight: tab === t.id ? 600 : 400, fontSize: 14, cursor: 'pointer',
            borderRadius: '8px 8px 0 0', marginBottom: -2,
          }}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: GÉRER QR ═══ */}
      {tab === 'gerir_qr' && !showQRDetail && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <select value={filterImmeuble} onChange={e => setFilterImmeuble(e.target.value)}
              style={{ padding: '10px 12px', border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}>
              <option value="all">Todos os edifícios</option>
              {immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              {filterImmeuble !== 'all' && (
                <button
                  onClick={() => createBulkQR(filterImmeuble)}
                  style={{ padding: '10px 16px', border: '1px solid #C9A84C', borderRadius: 8, background: '#F7F4EE', color: '#C9A84C', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  ⚡ Gerar em lote (8 zonas)
                </button>
              )}
              <button
                onClick={() => setShowNewQR(true)}
                style={{ padding: '10px 20px', background: '#C9A84C', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                + Novo QR Code
              </button>
            </div>
          </div>

          {filteredQR.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
              <div style={{ fontSize: 16 }}>Nenhum QR Code criado</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Crie QR Codes para zonas comuns ou frações</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              {filteredQR.map(qr => (
                <div key={qr.id} style={{
                  background: '#fff',
                  border: '1px solid #E4DDD0',
                  borderRadius: 12,
                  padding: 16,
                  opacity: qr.ativo ? 1 : 0.5,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#0D1B2E', fontSize: 15 }}>{qr.zona}</div>
                      <div style={{ fontSize: 12, color: '#4A5E78', marginTop: 2 }}>
                        🏢 {qr.immeubleNom}
                        {qr.fracao && ` · Fração ${qr.fracao}`}
                      </div>
                    </div>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: qr.tipo === 'zona_comum' ? '#DBEAFE' : qr.tipo === 'fracao' ? '#F3E8FF' : '#FEF3C7',
                      color: qr.tipo === 'zona_comum' ? '#1E40AF' : qr.tipo === 'fracao' ? '#6B21A8' : '#92400E',
                    }}>
                      {qr.tipo === 'zona_comum' ? '🏢 Zona comum' : qr.tipo === 'fracao' ? '🚪 Fração' : '⚙️ Equipamento'}
                    </span>
                  </div>

                  {/* Mini QR preview */}
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
                    <div
                      dangerouslySetInnerHTML={{ __html: generateQRSVG(qr.qrData, 120) }}
                      style={{ border: '4px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: 8 }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
                    <span>👁️ {qr.totalScans} scans</span>
                    {qr.ultimoScan && <span>Último: {new Date(qr.ultimoScan).toLocaleDateString('pt-PT')}</span>}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setShowQRDetail(qr)}
                      style={{ flex: 1, padding: '8px', border: '1px solid #E4DDD0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12 }}
                    >
                      👁️ Ver detalhe
                    </button>
                    <button
                      onClick={() => simulateSignalement(qr.id)}
                      style={{ flex: 1, padding: '8px', background: '#C9A84C', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                    >
                      🧪 Simular scan
                    </button>
                    <button
                      onClick={() => toggleQR(qr.id)}
                      style={{ padding: '8px 10px', border: '1px solid #E4DDD0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12 }}
                    >
                      {qr.ativo ? '⏸' : '▶️'}
                    </button>
                    <button
                      onClick={() => deleteQR(qr.id)}
                      style={{ padding: '8px 10px', border: '1px solid #FCA5A5', borderRadius: 6, background: '#FEF2F2', cursor: 'pointer', fontSize: 12 }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ QR DETAIL ═══ */}
      {tab === 'gerir_qr' && showQRDetail && (
        <div>
          <button onClick={() => setShowQRDetail(null)}
            style={{ marginBottom: 16, padding: '8px 16px', border: '1px solid #E4DDD0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            ← Voltar
          </button>

          <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 24, textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 22, color: '#0D1B2E' }}>{showQRDetail.zona}</h2>
            <div style={{ fontSize: 14, color: '#4A5E78' }}>{showQRDetail.immeubleNom}</div>

            <div style={{ margin: '24px auto', display: 'inline-block' }}>
              <div
                dangerouslySetInnerHTML={{ __html: generateQRSVG(showQRDetail.qrData, 250) }}
                style={{ border: '8px solid #fff', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', borderRadius: 12 }}
              />
            </div>

            <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 8 }}>
              {showQRDetail.qrData}
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
              <button style={{ padding: '10px 24px', background: '#C9A84C', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                🖨️ Imprimir QR Code
              </button>
              <button
                onClick={() => simulateSignalement(showQRDetail.id)}
                style={{ padding: '10px 24px', border: '1px solid #E4DDD0', borderRadius: 8, background: '#fff', fontSize: 14, cursor: 'pointer' }}
              >
                🧪 Simular scan
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 24, textAlign: 'center' }}>
              <div style={{ padding: 16, border: '1px solid #E4DDD0', borderRadius: 8 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#0D1B2E' }}>{showQRDetail.totalScans}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>Total scans</div>
              </div>
              <div style={{ padding: 16, border: '1px solid #E4DDD0', borderRadius: 8 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#0D1B2E' }}>
                  {signalements.filter(s => s.qrConfigId === showQRDetail.id).length}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>Signalements</div>
              </div>
              <div style={{ padding: 16, border: '1px solid #E4DDD0', borderRadius: 8 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: showQRDetail.ativo ? '#22C55E' : '#EF4444' }}>
                  {showQRDetail.ativo ? '●' : '○'}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>{showQRDetail.ativo ? 'Ativo' : 'Inativo'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: SIGNALEMENTS ═══ */}
      {tab === 'signalements' && (
        <div>
          {signalements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🚨</div>
              <div>Nenhum signalement recebido</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Simule um scan para criar um signalement de teste</div>
            </div>
          ) : (
            signalements.map(sig => {
              const tipoConfig = TIPOS_SIGNALEMENT.find(t => t.id === sig.tipo)
              return (
                <div key={sig.id} style={{
                  background: '#fff',
                  border: sig.status === 'novo' ? '2px solid #EF4444' : '1px solid #E4DDD0',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 20 }}>{tipoConfig?.emoji}</span>
                        <span style={{ fontWeight: 600, color: '#0D1B2E', fontSize: 15 }}>{tipoConfig?.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#4A5E78', marginTop: 4 }}>
                        🏢 {sig.immeubleNom} · 📍 {sig.zona} · 📅 {new Date(sig.dataCriacao).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ fontSize: 13, color: '#4A5E78', marginTop: 6 }}>{sig.descricao}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: sig.prioridade === 'urgente' ? '#FEE2E2' : sig.prioridade === 'alta' ? '#FEF3C7' : sig.prioridade === 'media' ? '#DBEAFE' : '#F3F4F6',
                        color: sig.prioridade === 'urgente' ? '#991B1B' : sig.prioridade === 'alta' ? '#92400E' : sig.prioridade === 'media' ? '#1E40AF' : '#6B7280',
                      }}>
                        {sig.prioridade === 'urgente' ? '🔴' : sig.prioridade === 'alta' ? '🟡' : sig.prioridade === 'media' ? '🔵' : '⚪'} {sig.prioridade}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    {(['novo', 'em_analise', 'em_curso', 'resolvido'] as Signalement['status'][]).map(status => (
                      <button
                        key={status}
                        onClick={() => updateSigStatus(sig.id, status)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: 12,
                          border: sig.status === status ? '2px solid #C9A84C' : '1px solid #E4DDD0',
                          background: sig.status === status ? '#F7F4EE' : '#fff',
                          fontWeight: sig.status === status ? 600 : 400,
                          cursor: 'pointer',
                        }}
                      >
                        {status === 'novo' ? '🆕 Novo' : status === 'em_analise' ? '🔍 Em análise' : status === 'em_curso' ? '🔧 Em curso' : '✅ Resolvido'}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ═══ TAB: ESTATÍSTICAS ═══ */}
      {tab === 'estatisticas' && (
        <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 18, color: '#0D1B2E' }}>📊 Estatísticas QR Code</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {/* By building */}
            <div style={{ padding: 16, border: '1px solid #E4DDD0', borderRadius: 10 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#0D1B2E' }}>🏢 Por Edifício</h4>
              {immeubles.map(imm => {
                const immQR = qrConfigs.filter(q => q.immeubleId === imm.id)
                const immScans = immQR.reduce((s, q) => s + q.totalScans, 0)
                const immSigs = signalements.filter(s => s.immeubleNom === imm.nom).length
                return (
                  <div key={imm.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F3F4F6', fontSize: 13 }}>
                    <span style={{ color: '#0D1B2E' }}>{imm.nom}</span>
                    <span style={{ color: '#6B7280' }}>{immQR.length} QR · {immScans} scans · {immSigs} sig.</span>
                  </div>
                )
              })}
            </div>

            {/* By type */}
            <div style={{ padding: 16, border: '1px solid #E4DDD0', borderRadius: 10 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#0D1B2E' }}>🚨 Por Tipo de Problema</h4>
              {TIPOS_SIGNALEMENT.map(tipo => {
                const count = signalements.filter(s => s.tipo === tipo.id).length
                return (
                  <div key={tipo.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F3F4F6', fontSize: 13 }}>
                    <span>{tipo.emoji} {tipo.label}</span>
                    <span style={{ fontWeight: 600, color: count > 0 ? '#0D1B2E' : '#9CA3AF' }}>{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: NEW QR ═══ */}
      {showNewQR && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18, color: '#0D1B2E' }}>📱 Novo QR Code</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Edifício</label>
                <select value={newQRForm.immeubleId} onChange={e => setNewQRForm({ ...newQRForm, immeubleId: e.target.value })}
                  style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}>
                  <option value="">Selecione...</option>
                  {immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Tipo</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { value: 'zona_comum', label: '🏢 Zona Comum' },
                    { value: 'fracao', label: '🚪 Fração' },
                    { value: 'equipamento', label: '⚙️ Equipamento' },
                  ].map(t => (
                    <button key={t.value}
                      onClick={() => setNewQRForm({ ...newQRForm, tipo: t.value as any })}
                      style={{
                        flex: 1, padding: '8px', borderRadius: 8,
                        border: newQRForm.tipo === t.value ? '2px solid #C9A84C' : '1px solid #E4DDD0',
                        background: newQRForm.tipo === t.value ? '#F7F4EE' : '#fff',
                        fontSize: 13, cursor: 'pointer',
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {newQRForm.tipo === 'fracao' && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Fração</label>
                  <input value={newQRForm.fracao} onChange={e => setNewQRForm({ ...newQRForm, fracao: e.target.value })}
                    placeholder="Ex: A, B1, 3º Dto" style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }} />
                </div>
              )}

              {newQRForm.tipo === 'zona_comum' && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Zona</label>
                  <select value={newQRForm.zona} onChange={e => setNewQRForm({ ...newQRForm, zona: e.target.value })}
                    style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}>
                    <option value="">Selecione ou escreva abaixo</option>
                    {ZONAS_COMUNS.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                  <input value={newQRForm.zonaCustom} onChange={e => setNewQRForm({ ...newQRForm, zonaCustom: e.target.value })}
                    placeholder="Ou zona personalizada..." style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14, marginTop: 8 }} />
                </div>
              )}

              {newQRForm.tipo === 'equipamento' && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Equipamento</label>
                  <input value={newQRForm.zona} onChange={e => setNewQRForm({ ...newQRForm, zona: e.target.value })}
                    placeholder="Ex: Elevador 1, Caldeira, Portão garagem" style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }} />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={() => setShowNewQR(false)} style={{ flex: 1, padding: 12, border: '1px solid #E4DDD0', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={createQR} disabled={!newQRForm.immeubleId}
                style={{ flex: 1, padding: 12, background: '#C9A84C', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                ✅ Gerar QR Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
