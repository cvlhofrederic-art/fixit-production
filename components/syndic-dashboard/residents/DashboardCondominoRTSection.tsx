'use client'

import React, { useState, useEffect } from 'react'

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD CONDÓMINO TEMPO REAL — Barra progresso, estado intervenções
// ═══════════════════════════════════════════════════════════════════════════════

interface Props {
  user: any
  userRole: string
}

interface Immeuble {
  id: string
  nom: string
  adresse: string
  nbLots: number
}

interface CondominoView {
  id: string
  nome: string
  fracao: string
  immeubleId: string
  immeubleNom: string
  permilagem: number
  email: string
  telefone: string
  quotasMensais: number
  quotasEmAtraso: number
  saldoDevedor: number
  intervencoesPendentes: IntervencoesCondomino[]
  documentosRecentes: DocCondomino[]
  avisos: AvisoCondomino[]
  ultimoAcesso?: string
}

interface IntervencoesCondomino {
  id: string
  titulo: string
  tipo: string
  status: 'reportada' | 'em_analise' | 'artesao_designado' | 'agendada' | 'em_curso' | 'concluida'
  progressao: number // 0-100
  dataCriacao: string
  dataEstimada?: string
  artesao?: string
  zonaAfetada: string
}

interface DocCondomino {
  id: string
  tipo: 'recibo' | 'ata' | 'convocatoria' | 'regulamento' | 'orcamento' | 'outro'
  titulo: string
  data: string
}

interface AvisoCondomino {
  id: string
  tipo: 'pagamento' | 'obra' | 'ag' | 'geral' | 'urgente'
  titulo: string
  mensagem: string
  data: string
  lido: boolean
}

// ── Status steps for intervention progress ──
const INTERVENTION_STEPS = [
  { key: 'reportada', label: 'Reportada', emoji: '📝' },
  { key: 'em_analise', label: 'Em Análise', emoji: '🔍' },
  { key: 'artesao_designado', label: 'Artesão Designado', emoji: '👷' },
  { key: 'agendada', label: 'Agendada', emoji: '📅' },
  { key: 'em_curso', label: 'Em Curso', emoji: '🔧' },
  { key: 'concluida', label: 'Concluída', emoji: '✅' },
]

// ── Demo data generator ──
function generateCondominoViews(immeubles: Immeuble[]): CondominoView[] {
  const nomes = ['Ana Silva', 'Pedro Costa', 'Maria Santos', 'João Oliveira', 'Sofia Ferreira',
    'Carlos Mendes', 'Teresa Rodrigues', 'Rui Almeida', 'Isabel Pereira', 'Miguel Sousa',
    'Catarina Lopes', 'André Martins', 'Beatriz Gomes', 'Francisco Nunes', 'Luísa Carvalho']
  const views: CondominoView[] = []

  immeubles.forEach(imm => {
    const numFracoes = Math.min(imm.nbLots || 6, 8)
    for (let i = 0; i < numFracoes; i++) {
      const nome = nomes[(views.length) % nomes.length]
      const fracao = String.fromCharCode(65 + i)
      const permilagem = Math.round(1000 / numFracoes)
      const emAtraso = Math.random() < 0.25 ? Math.floor(Math.random() * 3) + 1 : 0

      const intervencoes: IntervencoesCondomino[] = []
      if (Math.random() < 0.4) {
        const statusIdx = Math.floor(Math.random() * 6)
        const statusKey = INTERVENTION_STEPS[statusIdx].key as IntervencoesCondomino['status']
        intervencoes.push({
          id: `int_${views.length}_0`,
          titulo: ['Infiltração na casa de banho', 'Avaria no intercomunicador', 'Humidade na parede', 'Problema com canalização', 'Ruído no elevador'][Math.floor(Math.random() * 5)],
          tipo: 'avaria',
          status: statusKey,
          progressao: Math.round(((statusIdx + 1) / 6) * 100),
          dataCriacao: new Date(2026, 2, Math.floor(Math.random() * 14) + 1).toISOString(),
          dataEstimada: statusIdx >= 3 ? new Date(2026, 2, 20 + Math.floor(Math.random() * 10)).toISOString() : undefined,
          artesao: statusIdx >= 2 ? 'TecniLuso Lda' : undefined,
          zonaAfetada: ['Casa de banho', 'Cozinha', 'Sala', 'Quarto', 'Varanda'][Math.floor(Math.random() * 5)],
        })
      }

      views.push({
        id: `cond_${imm.id}_${i}`,
        nome,
        fracao,
        immeubleId: imm.id,
        immeubleNom: imm.nom,
        permilagem,
        email: `${nome.toLowerCase().replace(/\s/g, '.')}@email.pt`,
        telefone: `+351 9${Math.floor(10000000 + Math.random() * 90000000)}`,
        quotasMensais: Math.round(50 + Math.random() * 200),
        quotasEmAtraso: emAtraso,
        saldoDevedor: emAtraso * Math.round(50 + Math.random() * 200),
        intervencoesPendentes: intervencoes,
        documentosRecentes: [
          { id: `doc_${i}_1`, tipo: 'recibo', titulo: 'Recibo quota Fevereiro 2026', data: '2026-02-28' },
          { id: `doc_${i}_2`, tipo: 'ata', titulo: 'Ata AG Ordinária 2025', data: '2025-12-15' },
        ],
        avisos: emAtraso > 0 ? [{
          id: `aviso_${i}`,
          tipo: 'pagamento',
          titulo: 'Quotas em atraso',
          mensagem: `Tem ${emAtraso} quota(s) em atraso. Regularize a situação.`,
          data: new Date().toISOString(),
          lido: false,
        }] : [],
        ultimoAcesso: Math.random() < 0.7 ? new Date(2026, 2, Math.floor(Math.random() * 14) + 1).toISOString() : undefined,
      })
    }
  })

  return views
}

type TabDashCond = 'visao_geral' | 'intervencoes' | 'financeiro' | 'comunicacao'

export default function DashboardCondominoRTSection({ user, userRole }: Props) {
  const [tab, setTab] = useState<TabDashCond>('visao_geral')
  const [immeubles, setImmeubles] = useState<Immeuble[]>([])
  const [condominos, setCondominos] = useState<CondominoView[]>([])
  const [filterImmeuble, setFilterImmeuble] = useState<string>('all')
  const [selectedCondomino, setSelectedCondomino] = useState<CondominoView | null>(null)
  const [searchText, setSearchText] = useState('')

  const uid = user?.id || 'local'

  useEffect(() => {
    const fetchImm = async () => {
      try {
        const res = await fetch(`/api/syndic/immeubles?user_id=${uid}`)
        if (res.ok) {
          const data = await res.json()
          const imms = data.immeubles || []
          setImmeubles(imms)
          setCondominos(generateCondominoViews(imms))
        }
      } catch {
        const stored = localStorage.getItem(`fixit_syndic_immeubles_${uid}`)
        if (stored) {
          const imms = JSON.parse(stored)
          setImmeubles(imms)
          setCondominos(generateCondominoViews(imms))
        }
      }
    }
    fetchImm()
  }, [uid])

  // ── Filters ──
  const filtered = condominos.filter(c => {
    if (filterImmeuble !== 'all' && c.immeubleId !== filterImmeuble) return false
    if (searchText) {
      const q = searchText.toLowerCase()
      return c.nome.toLowerCase().includes(q) || c.fracao.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    }
    return true
  })

  // ── Stats ──
  const totalCondominos = condominos.length
  const comAtraso = condominos.filter(c => c.quotasEmAtraso > 0).length
  const intervencoesPendentes = condominos.reduce((s, c) => s + c.intervencoesPendentes.filter(i => i.status !== 'concluida').length, 0)
  const totalDevedor = condominos.reduce((s, c) => s + c.saldoDevedor, 0)
  const online = condominos.filter(c => c.ultimoAcesso && new Date(c.ultimoAcesso) > new Date(Date.now() - 7 * 86400000)).length

  const tabs: { id: TabDashCond; label: string; emoji: string }[] = [
    { id: 'visao_geral', label: 'Visão Geral', emoji: '📊' },
    { id: 'intervencoes', label: 'Intervenções', emoji: '🔧' },
    { id: 'financeiro', label: 'Financeiro', emoji: '💰' },
    { id: 'comunicacao', label: 'Comunicação', emoji: '📡' },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: '#0D1B2E', margin: 0 }}>
          👥 Dashboard Condómino — Tempo Real
        </h1>
        <p style={{ color: '#4A5E78', fontSize: 14, marginTop: 4 }}>
          Estado de cada condómino · Barra de progresso intervenções · Financeiro · Comunicação
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { emoji: '👥', label: 'Total condóminos', value: totalCondominos, color: '#0D1B2E' },
          { emoji: '🟢', label: 'Ativos (7 dias)', value: online, color: '#22C55E' },
          { emoji: '⚠️', label: 'Com atraso', value: comAtraso, color: '#EF4444' },
          { emoji: '🔧', label: 'Interv. pendentes', value: intervencoesPendentes, color: '#F59E0B' },
          { emoji: '💰', label: 'Total em dívida', value: `${(totalDevedor / 1000).toFixed(1)}k€`, color: '#8B5CF6' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 16 }}>{s.emoji}</span>
              <span style={{ fontSize: 11, color: '#4A5E78' }}>{s.label}</span>
            </div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="🔍 Pesquisar condómino..."
          style={{ flex: '1 1 250px', padding: '10px 14px', border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
        />
        <select value={filterImmeuble} onChange={e => setFilterImmeuble(e.target.value)}
          style={{ padding: '10px 12px', border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}>
          <option value="all">Todos os edifícios</option>
          {immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
        </select>
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

      {/* ═══ TAB: VISÃO GERAL ═══ */}
      {tab === 'visao_geral' && !selectedCondomino && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(c => (
            <div key={c.id}
              onClick={() => setSelectedCondomino(c)}
              style={{
                background: '#fff',
                border: c.quotasEmAtraso > 0 ? '1px solid #FCA5A5' : '1px solid #E4DDD0',
                borderRadius: 12, padding: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
              {/* Avatar */}
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: c.ultimoAcesso && new Date(c.ultimoAcesso) > new Date(Date.now() - 7 * 86400000) ? '#DCFCE7' : '#F3F4F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700, color: '#0D1B2E',
              }}>
                {c.nome.charAt(0)}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#0D1B2E', fontSize: 14 }}>
                  {c.nome} <span style={{ fontWeight: 400, color: '#9CA3AF', fontSize: 12 }}>— Fração {c.fracao}</span>
                </div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>
                  🏢 {c.immeubleNom} · {c.permilagem}‰
                </div>
              </div>

              {/* Intervention progress */}
              {c.intervencoesPendentes.length > 0 && (
                <div style={{ width: 140 }}>
                  <div style={{ fontSize: 11, color: '#4A5E78', marginBottom: 3 }}>
                    🔧 {c.intervencoesPendentes[0].titulo.substring(0, 20)}...
                  </div>
                  <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${c.intervencoesPendentes[0].progressao}%`,
                      background: c.intervencoesPendentes[0].progressao === 100 ? '#22C55E' : '#C9A84C',
                      borderRadius: 3, transition: 'width 0.3s',
                    }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{c.intervencoesPendentes[0].progressao}%</div>
                </div>
              )}

              {/* Financial status */}
              <div style={{ textAlign: 'right', minWidth: 90 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: c.quotasEmAtraso > 0 ? '#DC2626' : '#22C55E' }}>
                  {c.quotasEmAtraso > 0 ? `${c.quotasEmAtraso} em atraso` : '✅ Em dia'}
                </div>
                {c.saldoDevedor > 0 && (
                  <div style={{ fontSize: 12, color: '#DC2626' }}>{c.saldoDevedor}€</div>
                )}
              </div>

              {/* Online indicator */}
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: c.ultimoAcesso && new Date(c.ultimoAcesso) > new Date(Date.now() - 7 * 86400000) ? '#22C55E' : '#D1D5DB',
              }} />
            </div>
          ))}
        </div>
      )}

      {/* ═══ CONDOMINO DETAIL ═══ */}
      {tab === 'visao_geral' && selectedCondomino && (
        <div>
          <button onClick={() => setSelectedCondomino(null)}
            style={{ marginBottom: 16, padding: '8px 16px', border: '1px solid #E4DDD0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            ← Voltar
          </button>

          <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, color: '#0D1B2E' }}>{selectedCondomino.nome}</h2>
                <div style={{ fontSize: 14, color: '#4A5E78', marginTop: 4 }}>
                  Fração {selectedCondomino.fracao} · {selectedCondomino.immeubleNom} · {selectedCondomino.permilagem}‰
                </div>
                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
                  📧 {selectedCondomino.email} · 📞 {selectedCondomino.telefone}
                </div>
              </div>
              <span style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: selectedCondomino.quotasEmAtraso > 0 ? '#FEE2E2' : '#DCFCE7',
                color: selectedCondomino.quotasEmAtraso > 0 ? '#991B1B' : '#166534',
              }}>
                {selectedCondomino.quotasEmAtraso > 0 ? `⚠️ ${selectedCondomino.quotasEmAtraso} quotas em atraso` : '✅ Situação regular'}
              </span>
            </div>

            {/* Intervention progress detail */}
            {selectedCondomino.intervencoesPendentes.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: 15, color: '#0D1B2E', marginBottom: 16 }}>🔧 Intervenções</h3>
                {selectedCondomino.intervencoesPendentes.map(interv => (
                  <div key={interv.id} style={{ padding: 16, border: '1px solid #E4DDD0', borderRadius: 10, marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, color: '#0D1B2E', fontSize: 15, marginBottom: 4 }}>{interv.titulo}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
                      📍 {interv.zonaAfetada}
                      {interv.artesao && ` · 👷 ${interv.artesao}`}
                      {interv.dataEstimada && ` · 📅 Previsto: ${new Date(interv.dataEstimada).toLocaleDateString('pt-PT')}`}
                    </div>

                    {/* Step-by-step progress */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 8 }}>
                      {INTERVENTION_STEPS.map((step, idx) => {
                        const stepIdx = INTERVENTION_STEPS.findIndex(s => s.key === interv.status)
                        const isDone = idx <= stepIdx
                        const isCurrent = idx === stepIdx
                        return (
                          <React.Fragment key={step.key}>
                            <div style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center',
                              minWidth: 70, position: 'relative',
                            }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: '50%',
                                background: isDone ? '#C9A84C' : '#E5E7EB',
                                color: isDone ? '#fff' : '#9CA3AF',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 14,
                                border: isCurrent ? '3px solid #0D1B2E' : 'none',
                                zIndex: 1,
                              }}>
                                {step.emoji}
                              </div>
                              <div style={{
                                fontSize: 9, color: isDone ? '#0D1B2E' : '#9CA3AF',
                                fontWeight: isCurrent ? 700 : 400,
                                marginTop: 4, textAlign: 'center',
                              }}>
                                {step.label}
                              </div>
                            </div>
                            {idx < INTERVENTION_STEPS.length - 1 && (
                              <div style={{
                                flex: 1, height: 3, marginTop: -16,
                                background: idx < stepIdx ? '#C9A84C' : '#E5E7EB',
                              }} />
                            )}
                          </React.Fragment>
                        )
                      })}
                    </div>

                    {/* Progress bar */}
                    <div style={{ height: 8, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${interv.progressao}%`,
                        background: interv.progressao === 100 ? '#22C55E' : 'linear-gradient(90deg, #C9A84C, #D4AF37)',
                        borderRadius: 4,
                      }} />
                    </div>
                    <div style={{ fontSize: 12, color: '#4A5E78', marginTop: 4, textAlign: 'center' }}>
                      {interv.progressao}% concluído
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Documents & Info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 }}>
              <div>
                <h4 style={{ fontSize: 14, color: '#0D1B2E', marginBottom: 8 }}>📄 Documentos Recentes</h4>
                {selectedCondomino.documentosRecentes.map(doc => (
                  <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F3F4F6', fontSize: 13 }}>
                    <span style={{ color: '#0D1B2E' }}>
                      {doc.tipo === 'recibo' ? '🧾' : doc.tipo === 'ata' ? '📝' : '📄'} {doc.titulo}
                    </span>
                    <span style={{ color: '#9CA3AF', fontSize: 11 }}>{new Date(doc.data).toLocaleDateString('pt-PT')}</span>
                  </div>
                ))}
              </div>

              <div>
                <h4 style={{ fontSize: 14, color: '#0D1B2E', marginBottom: 8 }}>💰 Situação Financeira</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#6B7280' }}>Quota mensal</span>
                    <span style={{ fontWeight: 600, color: '#0D1B2E' }}>{selectedCondomino.quotasMensais}€</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#6B7280' }}>Em atraso</span>
                    <span style={{ fontWeight: 600, color: selectedCondomino.quotasEmAtraso > 0 ? '#DC2626' : '#22C55E' }}>
                      {selectedCondomino.quotasEmAtraso} meses
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#6B7280' }}>Saldo devedor</span>
                    <span style={{ fontWeight: 600, color: selectedCondomino.saldoDevedor > 0 ? '#DC2626' : '#22C55E' }}>
                      {selectedCondomino.saldoDevedor}€
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: INTERVENÇÕES ═══ */}
      {tab === 'intervencoes' && (
        <div>
          {(() => {
            const allInterv = filtered.flatMap(c =>
              c.intervencoesPendentes.map(i => ({ ...i, condominoNome: c.nome, fracao: c.fracao, immeubleNom: c.immeubleNom }))
            ).sort((a, b) => b.progressao - a.progressao)

            if (allInterv.length === 0) return (
              <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <div>Nenhuma intervenção pendente</div>
              </div>
            )

            return allInterv.map(interv => (
              <div key={interv.id} style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#0D1B2E', fontSize: 15 }}>{interv.titulo}</div>
                    <div style={{ fontSize: 12, color: '#4A5E78', marginTop: 2 }}>
                      👤 {interv.condominoNome} (Fração {interv.fracao}) · 🏢 {interv.immeubleNom} · 📍 {interv.zonaAfetada}
                    </div>
                  </div>
                  <span style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: interv.status === 'concluida' ? '#DCFCE7' : interv.status === 'em_curso' ? '#FEF3C7' : '#DBEAFE',
                    color: interv.status === 'concluida' ? '#166534' : interv.status === 'em_curso' ? '#92400E' : '#1E40AF',
                  }}>
                    {INTERVENTION_STEPS.find(s => s.key === interv.status)?.emoji} {INTERVENTION_STEPS.find(s => s.key === interv.status)?.label}
                  </span>
                </div>
                <div style={{ height: 8, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginTop: 12 }}>
                  <div style={{
                    height: '100%', width: `${interv.progressao}%`,
                    background: interv.progressao === 100 ? '#22C55E' : 'linear-gradient(90deg, #C9A84C, #D4AF37)',
                    borderRadius: 4,
                  }} />
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{interv.progressao}% concluído</div>
              </div>
            ))
          })()}
        </div>
      )}

      {/* ═══ TAB: FINANCEIRO ═══ */}
      {tab === 'financeiro' && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered
              .sort((a, b) => b.saldoDevedor - a.saldoDevedor)
              .map(c => (
                <div key={c.id} style={{
                  background: '#fff',
                  border: c.quotasEmAtraso > 0 ? '1px solid #FCA5A5' : '1px solid #E4DDD0',
                  borderRadius: 10, padding: 14, display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: c.quotasEmAtraso > 0 ? '#FEE2E2' : '#DCFCE7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16,
                  }}>
                    {c.quotasEmAtraso > 0 ? '⚠️' : '✅'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#0D1B2E', fontSize: 14 }}>
                      {c.nome} — Fração {c.fracao}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{c.immeubleNom} · Quota: {c.quotasMensais}€/mês</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: c.quotasEmAtraso > 0 ? '#DC2626' : '#22C55E' }}>
                      {c.quotasEmAtraso > 0 ? `${c.saldoDevedor}€` : 'Em dia'}
                    </div>
                    {c.quotasEmAtraso > 0 && (
                      <div style={{ fontSize: 11, color: '#991B1B' }}>{c.quotasEmAtraso} meses em atraso</div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ═══ TAB: COMUNICAÇÃO ═══ */}
      {tab === 'comunicacao' && (
        <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 18, color: '#0D1B2E' }}>📡 Estado da Comunicação</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            <div style={{ padding: 16, border: '1px solid #E4DDD0', borderRadius: 10 }}>
              <h4 style={{ margin: '0 0 12px', color: '#0D1B2E', fontSize: 14 }}>🟢 Atividade recente (últimos 7 dias)</h4>
              {filtered
                .filter(c => c.ultimoAcesso && new Date(c.ultimoAcesso) > new Date(Date.now() - 7 * 86400000))
                .slice(0, 8)
                .map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #F3F4F6', fontSize: 13 }}>
                    <span style={{ color: '#0D1B2E' }}>{c.nome} ({c.fracao})</span>
                    <span style={{ color: '#9CA3AF', fontSize: 11 }}>
                      {c.ultimoAcesso ? new Date(c.ultimoAcesso).toLocaleDateString('pt-PT') : '—'}
                    </span>
                  </div>
                ))}
            </div>

            <div style={{ padding: 16, border: '1px solid #E4DDD0', borderRadius: 10 }}>
              <h4 style={{ margin: '0 0 12px', color: '#0D1B2E', fontSize: 14 }}>🔴 Sem atividade</h4>
              {filtered
                .filter(c => !c.ultimoAcesso || new Date(c.ultimoAcesso) <= new Date(Date.now() - 7 * 86400000))
                .slice(0, 8)
                .map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #F3F4F6', fontSize: 13 }}>
                    <span style={{ color: '#6B7280' }}>{c.nome} ({c.fracao})</span>
                    <span style={{ color: '#D1D5DB', fontSize: 11 }}>Inativo</span>
                  </div>
                ))}
            </div>
          </div>

          <div style={{ marginTop: 20, padding: 16, background: '#F7F4EE', borderRadius: 10, fontSize: 13, color: '#4A5E78' }}>
            <strong>📊 Taxa de atividade:</strong> {totalCondominos > 0 ? Math.round((online / totalCondominos) * 100) : 0}% dos condóminos acederam ao portal nos últimos 7 dias
          </div>
        </div>
      )}
    </div>
  )
}
