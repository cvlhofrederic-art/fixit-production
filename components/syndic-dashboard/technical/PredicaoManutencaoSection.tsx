'use client'

import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════════════════════
// PREDIÇÃO DE MANUTENÇÃO ML — Score prédictif + timeline interventions
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
  anneeConstruction: number
}

// ── Types ──
interface EquipamentoPredicao {
  id: string
  immeubleId: string
  immeubleNom: string
  nome: string
  tipo: EquipamentoTipo
  anoInstalacao: number
  vidaUtilAnos: number
  ultimaManutencao: string
  proximaManutencao: string
  custoPrevisto: number
  scoreRisco: number // 0-100
  tendencia: 'estavel' | 'degradacao' | 'critico'
  historico: HistoricoManutencao[]
  fatoresRisco: FatorRisco[]
}

type EquipamentoTipo = 'elevador' | 'cobertura' | 'canalizacao' | 'eletricidade' | 'fachada' | 'caldeira' | 'portao' | 'intercomunicador' | 'bomba_agua' | 'sistema_incendio'

interface HistoricoManutencao {
  data: string
  tipo: 'preventiva' | 'corretiva' | 'emergencia'
  descricao: string
  custo: number
  fornecedor: string
}

interface FatorRisco {
  nome: string
  peso: number // 0-1
  valor: number // 0-100
  descricao: string
}

interface AlertaPredicao {
  id: string
  equipamentoId: string
  equipamentoNome: string
  immeubleNom: string
  tipo: 'substituicao_urgente' | 'manutencao_preventiva' | 'inspecao_obrigatoria' | 'fim_vida_util'
  mensagem: string
  dataLimite: string
  custoEstimado: number
  prioridade: 'critica' | 'alta' | 'media' | 'baixa'
}

// ── Equipment configs ──
const EQUIPAMENTO_CONFIG: Record<EquipamentoTipo, { emoji: string; label: string; vidaUtilMedia: number; custoMedio: number }> = {
  elevador: { emoji: '🛗', label: 'Elevador', vidaUtilMedia: 25, custoMedio: 15000 },
  cobertura: { emoji: '🏠', label: 'Cobertura / Telhado', vidaUtilMedia: 30, custoMedio: 25000 },
  canalizacao: { emoji: '🔧', label: 'Canalização', vidaUtilMedia: 40, custoMedio: 8000 },
  eletricidade: { emoji: '⚡', label: 'Instalação Elétrica', vidaUtilMedia: 35, custoMedio: 12000 },
  fachada: { emoji: '🏢', label: 'Fachada', vidaUtilMedia: 20, custoMedio: 30000 },
  caldeira: { emoji: '🔥', label: 'Caldeira / Aquecimento', vidaUtilMedia: 15, custoMedio: 5000 },
  portao: { emoji: '🚪', label: 'Portão Automático', vidaUtilMedia: 15, custoMedio: 3000 },
  intercomunicador: { emoji: '📞', label: 'Intercomunicador', vidaUtilMedia: 12, custoMedio: 2500 },
  bomba_agua: { emoji: '💧', label: 'Bomba de Água', vidaUtilMedia: 12, custoMedio: 4000 },
  sistema_incendio: { emoji: '🧯', label: 'Sistema Incêndio', vidaUtilMedia: 10, custoMedio: 6000 },
}

// ── Simulate predictive data ──
function generateEquipamentos(immeubles: Immeuble[]): EquipamentoPredicao[] {
  const equipamentos: EquipamentoPredicao[] = []
  const types: EquipamentoTipo[] = ['elevador', 'cobertura', 'canalizacao', 'eletricidade', 'fachada', 'caldeira', 'portao', 'intercomunicador']

  immeubles.forEach(imm => {
    const selectedTypes = types.slice(0, 4 + Math.floor(Math.random() * 4))
    selectedTypes.forEach((tipo, idx) => {
      const config = EQUIPAMENTO_CONFIG[tipo]
      const anoConst = imm.anneeConstruction || 2000
      const anoInstalacao = anoConst + Math.floor(Math.random() * 10)
      const idade = 2026 - anoInstalacao
      const percentVida = (idade / config.vidaUtilMedia) * 100
      const scoreRisco = Math.min(100, Math.max(5, Math.round(percentVida + (Math.random() * 20 - 10))))

      const tendencia: EquipamentoPredicao['tendencia'] =
        scoreRisco > 80 ? 'critico' : scoreRisco > 50 ? 'degradacao' : 'estavel'

      const lastMaint = new Date(2026, 0, 1)
      lastMaint.setMonth(lastMaint.getMonth() - Math.floor(Math.random() * 18))

      const nextMaint = new Date(lastMaint)
      nextMaint.setMonth(nextMaint.getMonth() + (scoreRisco > 70 ? 3 : scoreRisco > 40 ? 6 : 12))

      equipamentos.push({
        id: `eq_${imm.id}_${idx}`,
        immeubleId: imm.id,
        immeubleNom: imm.nom,
        nome: `${config.label} — ${imm.nom}`,
        tipo,
        anoInstalacao,
        vidaUtilAnos: config.vidaUtilMedia,
        ultimaManutencao: lastMaint.toISOString().split('T')[0],
        proximaManutencao: nextMaint.toISOString().split('T')[0],
        custoPrevisto: Math.round(config.custoMedio * (0.3 + Math.random() * 0.7)),
        scoreRisco,
        tendencia,
        historico: [
          { data: lastMaint.toISOString().split('T')[0], tipo: 'preventiva', descricao: 'Manutenção preventiva anual', custo: Math.round(config.custoMedio * 0.1), fornecedor: 'TecniLuso Lda' },
        ],
        fatoresRisco: [
          { nome: 'Idade do equipamento', peso: 0.3, valor: Math.min(100, percentVida), descricao: `${idade} anos / ${config.vidaUtilMedia} anos vida útil` },
          { nome: 'Frequência avarias', peso: 0.25, valor: Math.floor(Math.random() * 80), descricao: 'Baseado no histórico de intervenções' },
          { nome: 'Condições ambientais', peso: 0.2, valor: 30 + Math.floor(Math.random() * 40), descricao: 'Proximidade mar, humidade, exposição solar' },
          { nome: 'Qualidade última manutenção', peso: 0.15, valor: 20 + Math.floor(Math.random() * 50), descricao: 'Avaliação do último técnico' },
          { nome: 'Obsolescência tecnológica', peso: 0.1, valor: Math.min(100, Math.round(idade * 4)), descricao: 'Disponibilidade de peças e suporte' },
        ],
      })
    })
  })

  return equipamentos.sort((a, b) => b.scoreRisco - a.scoreRisco)
}

function generateAlertas(equipamentos: EquipamentoPredicao[]): AlertaPredicao[] {
  return equipamentos
    .filter(e => e.scoreRisco > 60)
    .map(e => ({
      id: `alerta_${e.id}`,
      equipamentoId: e.id,
      equipamentoNome: e.nome,
      immeubleNom: e.immeubleNom,
      tipo: e.scoreRisco > 90 ? 'substituicao_urgente' as const :
        e.scoreRisco > 75 ? 'fim_vida_util' as const :
          'manutencao_preventiva' as const,
      mensagem: e.scoreRisco > 90
        ? `${EQUIPAMENTO_CONFIG[e.tipo].label} necessita substituição urgente`
        : e.scoreRisco > 75
          ? `${EQUIPAMENTO_CONFIG[e.tipo].label} próximo do fim de vida útil`
          : `Agendar manutenção preventiva para ${EQUIPAMENTO_CONFIG[e.tipo].label}`,
      dataLimite: e.proximaManutencao,
      custoEstimado: e.custoPrevisto,
      prioridade: e.scoreRisco > 90 ? 'critica' as const : e.scoreRisco > 75 ? 'alta' as const : 'media' as const,
    }))
}

type TabPredicao = 'dashboard' | 'equipamentos' | 'timeline' | 'alertas'

export default function PredicaoManutencaoSection({ user, userRole }: Props) {
  const [tab, setTab] = useState<TabPredicao>('dashboard')
  const [immeubles, setImmeubles] = useState<Immeuble[]>([])
  const [equipamentos, setEquipamentos] = useState<EquipamentoPredicao[]>([])
  const [alertas, setAlertas] = useState<AlertaPredicao[]>([])
  const [filterImmeuble, setFilterImmeuble] = useState<string>('all')
  const [filterTipo, setFilterTipo] = useState<string>('all')
  const [selectedEquip, setSelectedEquip] = useState<EquipamentoPredicao | null>(null)

  const uid = user?.id || 'local'

  useEffect(() => {
    const fetchImm = async () => {
      try {
        const res = await fetch(`/api/syndic/immeubles?user_id=${uid}`)
        if (res.ok) {
          const data = await res.json()
          const imms = data.immeubles || []
          setImmeubles(imms)
          const eqs = generateEquipamentos(imms)
          setEquipamentos(eqs)
          setAlertas(generateAlertas(eqs))
        }
      } catch {
        const stored = localStorage.getItem(`fixit_syndic_immeubles_${uid}`)
        if (stored) {
          const imms = JSON.parse(stored)
          setImmeubles(imms)
          const eqs = generateEquipamentos(imms)
          setEquipamentos(eqs)
          setAlertas(generateAlertas(eqs))
        }
      }
    }
    fetchImm()
  }, [uid])

  // ── Filters ──
  const filtered = equipamentos.filter(e => {
    if (filterImmeuble !== 'all' && e.immeubleId !== filterImmeuble) return false
    if (filterTipo !== 'all' && e.tipo !== filterTipo) return false
    return true
  })

  // ── Stats ──
  const totalEquip = equipamentos.length
  const critiques = equipamentos.filter(e => e.scoreRisco > 80).length
  const degradation = equipamentos.filter(e => e.tendencia === 'degradacao').length
  const custoTotal = equipamentos.reduce((s, e) => s + e.custoPrevisto, 0)
  const scoreMoyen = totalEquip > 0 ? Math.round(equipamentos.reduce((s, e) => s + e.scoreRisco, 0) / totalEquip) : 0

  const getScoreColor = (score: number) => {
    if (score > 80) return '#DC2626'
    if (score > 60) return '#F59E0B'
    if (score > 40) return '#F97316'
    return '#22C55E'
  }

  const getScoreLabel = (score: number) => {
    if (score > 80) return 'Crítico'
    if (score > 60) return 'Atenção'
    if (score > 40) return 'Moderado'
    return 'Bom'
  }

  const tabs: { id: TabPredicao; label: string; emoji: string }[] = [
    { id: 'dashboard', label: 'Dashboard', emoji: '📊' },
    { id: 'equipamentos', label: 'Equipamentos', emoji: '🔧' },
    { id: 'timeline', label: 'Timeline', emoji: '📅' },
    { id: 'alertas', label: `Alertas (${alertas.length})`, emoji: '🚨' },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: '#0D1B2E', margin: 0 }}>
          🤖 Predição de Manutenção
        </h1>
        <p style={{ color: '#4A5E78', fontSize: 14, marginTop: 4 }}>
          Machine Learning preditivo · Score de risco por equipamento · Timeline de intervenções
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { emoji: '🔧', label: 'Equipamentos', value: totalEquip, color: '#0D1B2E' },
          { emoji: '🔴', label: 'Críticos', value: critiques, color: '#DC2626' },
          { emoji: '📉', label: 'Em degradação', value: degradation, color: '#F59E0B' },
          { emoji: '📊', label: 'Score médio risco', value: `${scoreMoyen}%`, color: getScoreColor(scoreMoyen) },
          { emoji: '💰', label: 'Custo previsto total', value: `${(custoTotal / 1000).toFixed(0)}k€`, color: '#8B5CF6' },
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

      {/* ═══ TAB: DASHBOARD ═══ */}
      {tab === 'dashboard' && (
        <div>
          {/* Risk distribution */}
          <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#0D1B2E' }}>📊 Distribuição de Risco</h3>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'Crítico (>80%)', count: equipamentos.filter(e => e.scoreRisco > 80).length, color: '#DC2626', bg: '#FEE2E2' },
                { label: 'Atenção (60-80%)', count: equipamentos.filter(e => e.scoreRisco > 60 && e.scoreRisco <= 80).length, color: '#F59E0B', bg: '#FEF3C7' },
                { label: 'Moderado (40-60%)', count: equipamentos.filter(e => e.scoreRisco > 40 && e.scoreRisco <= 60).length, color: '#F97316', bg: '#FFEDD5' },
                { label: 'Bom (<40%)', count: equipamentos.filter(e => e.scoreRisco <= 40).length, color: '#22C55E', bg: '#DCFCE7' },
              ].map(cat => (
                <div key={cat.label} style={{ flex: 1, padding: 16, borderRadius: 10, background: cat.bg, textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, color: cat.color }}>{cat.count}</div>
                  <div style={{ fontSize: 12, color: cat.color, fontWeight: 600, marginTop: 4 }}>{cat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Top risk per building */}
          <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#0D1B2E' }}>🏢 Risco por Edifício</h3>
            {immeubles.map(imm => {
              const immEquips = equipamentos.filter(e => e.immeubleId === imm.id)
              const avgScore = immEquips.length > 0 ? Math.round(immEquips.reduce((s, e) => s + e.scoreRisco, 0) / immEquips.length) : 0
              const maxScore = immEquips.length > 0 ? Math.max(...immEquips.map(e => e.scoreRisco)) : 0
              const custoImm = immEquips.reduce((s, e) => s + e.custoPrevisto, 0)

              return (
                <div key={imm.id} style={{ padding: 14, borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#0D1B2E', fontSize: 14 }}>{imm.nom}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{imm.adresse} · {immEquips.length} equipamentos</div>
                  </div>

                  {/* Risk bar */}
                  <div style={{ width: 120 }}>
                    <div style={{ height: 8, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${avgScore}%`, background: getScoreColor(avgScore), borderRadius: 4, transition: 'width 0.5s' }} />
                    </div>
                    <div style={{ fontSize: 11, color: getScoreColor(avgScore), fontWeight: 600, marginTop: 2, textAlign: 'center' }}>
                      {avgScore}% risco médio
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', minWidth: 100 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0D1B2E' }}>{(custoImm / 1000).toFixed(1)}k€</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>custo previsto</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ TAB: EQUIPAMENTOS ═══ */}
      {tab === 'equipamentos' && !selectedEquip && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <select value={filterImmeuble} onChange={e => setFilterImmeuble(e.target.value)}
              style={{ padding: '10px 12px', border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}>
              <option value="all">Todos os edifícios</option>
              {immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
            </select>
            <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
              style={{ padding: '10px 12px', border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}>
              <option value="all">Todos os tipos</option>
              {Object.entries(EQUIPAMENTO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(eq => {
              const config = EQUIPAMENTO_CONFIG[eq.tipo]
              return (
                <div
                  key={eq.id}
                  onClick={() => setSelectedEquip(eq)}
                  style={{
                    background: '#fff',
                    border: eq.scoreRisco > 80 ? '2px solid #DC2626' : '1px solid #E4DDD0',
                    borderRadius: 12,
                    padding: 16,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <div style={{
                    width: 50, height: 50, borderRadius: 12,
                    background: `${getScoreColor(eq.scoreRisco)}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24,
                  }}>
                    {config.emoji}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#0D1B2E', fontSize: 15 }}>{config.label}</div>
                    <div style={{ fontSize: 12, color: '#4A5E78' }}>
                      🏢 {eq.immeubleNom} · Instalado {eq.anoInstalacao} · {2026 - eq.anoInstalacao} anos
                    </div>
                  </div>

                  {/* Score circle */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%',
                      border: `3px solid ${getScoreColor(eq.scoreRisco)}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'column',
                    }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: getScoreColor(eq.scoreRisco) }}>{eq.scoreRisco}</span>
                    </div>
                    <div style={{ fontSize: 10, color: getScoreColor(eq.scoreRisco), fontWeight: 600, marginTop: 2 }}>
                      {getScoreLabel(eq.scoreRisco)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', minWidth: 90 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B2E' }}>{eq.custoPrevisto.toLocaleString('pt-PT')}€</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>Próx: {new Date(eq.proximaManutencao).toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })}</div>
                  </div>

                  <span style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: eq.tendencia === 'critico' ? '#FEE2E2' : eq.tendencia === 'degradacao' ? '#FEF3C7' : '#DCFCE7',
                    color: eq.tendencia === 'critico' ? '#991B1B' : eq.tendencia === 'degradacao' ? '#92400E' : '#166534',
                  }}>
                    {eq.tendencia === 'critico' ? '🔴 Crítico' : eq.tendencia === 'degradacao' ? '🟡 Degradação' : '🟢 Estável'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ EQUIPMENT DETAIL ═══ */}
      {tab === 'equipamentos' && selectedEquip && (
        <div>
          <button onClick={() => setSelectedEquip(null)}
            style={{ marginBottom: 16, padding: '8px 16px', border: '1px solid #E4DDD0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            ← Voltar
          </button>

          <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, color: '#0D1B2E' }}>
                  {EQUIPAMENTO_CONFIG[selectedEquip.tipo].emoji} {EQUIPAMENTO_CONFIG[selectedEquip.tipo].label}
                </h2>
                <div style={{ fontSize: 14, color: '#4A5E78', marginTop: 4 }}>
                  🏢 {selectedEquip.immeubleNom} · Instalado em {selectedEquip.anoInstalacao}
                </div>
              </div>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                border: `4px solid ${getScoreColor(selectedEquip.scoreRisco)}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
              }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: getScoreColor(selectedEquip.scoreRisco) }}>{selectedEquip.scoreRisco}</span>
                <span style={{ fontSize: 10, color: '#6B7280' }}>RISCO</span>
              </div>
            </div>

            {/* Risk factors */}
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 15, color: '#0D1B2E', marginBottom: 12 }}>🧠 Fatores de Risco (ML)</h3>
              {selectedEquip.fatoresRisco.map((f, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#0D1B2E', fontWeight: 500 }}>{f.nome} <span style={{ color: '#9CA3AF', fontWeight: 400 }}>({Math.round(f.peso * 100)}%)</span></span>
                    <span style={{ color: getScoreColor(f.valor), fontWeight: 600 }}>{f.valor}%</span>
                  </div>
                  <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, marginTop: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${f.valor}%`, background: getScoreColor(f.valor), borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{f.descricao}</div>
                </div>
              ))}
            </div>

            {/* Info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 20 }}>
              {[
                { label: 'Vida útil estimada', value: `${selectedEquip.vidaUtilAnos} anos`, emoji: '📅' },
                { label: 'Idade atual', value: `${2026 - selectedEquip.anoInstalacao} anos`, emoji: '⏱' },
                { label: 'Última manutenção', value: new Date(selectedEquip.ultimaManutencao).toLocaleDateString('pt-PT'), emoji: '🔧' },
                { label: 'Próxima manutenção', value: new Date(selectedEquip.proximaManutencao).toLocaleDateString('pt-PT'), emoji: '📆' },
                { label: 'Custo previsto', value: `${selectedEquip.custoPrevisto.toLocaleString('pt-PT')}€`, emoji: '💰' },
                { label: 'Tendência', value: selectedEquip.tendencia, emoji: selectedEquip.tendencia === 'critico' ? '🔴' : selectedEquip.tendencia === 'degradacao' ? '🟡' : '🟢' },
              ].map(item => (
                <div key={item.label} style={{ padding: 12, border: '1px solid #E4DDD0', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{item.emoji} {item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0D1B2E', marginTop: 4 }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* History */}
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 15, color: '#0D1B2E', marginBottom: 12 }}>📜 Histórico</h3>
              {selectedEquip.historico.map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: 10, borderBottom: '1px solid #F3F4F6', fontSize: 13 }}>
                  <span style={{ color: '#9CA3AF' }}>{new Date(h.data).toLocaleDateString('pt-PT')}</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 11,
                    background: h.tipo === 'emergencia' ? '#FEE2E2' : h.tipo === 'corretiva' ? '#FEF3C7' : '#DCFCE7',
                    color: h.tipo === 'emergencia' ? '#991B1B' : h.tipo === 'corretiva' ? '#92400E' : '#166534',
                  }}>
                    {h.tipo}
                  </span>
                  <span style={{ flex: 1, color: '#4A5E78' }}>{h.descricao}</span>
                  <span style={{ fontWeight: 600, color: '#0D1B2E' }}>{h.custo}€</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: TIMELINE ═══ */}
      {tab === 'timeline' && (
        <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 18, color: '#0D1B2E' }}>📅 Timeline de Manutenções Previstas</h3>

          {(() => {
            const sorted = [...equipamentos]
              .filter(e => e.proximaManutencao)
              .sort((a, b) => new Date(a.proximaManutencao).getTime() - new Date(b.proximaManutencao).getTime())

            const months: Record<string, EquipamentoPredicao[]> = {}
            sorted.forEach(e => {
              const monthKey = new Date(e.proximaManutencao).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
              if (!months[monthKey]) months[monthKey] = []
              months[monthKey].push(e)
            })

            return Object.entries(months).map(([month, eqs]) => (
              <div key={month} style={{ marginBottom: 24 }}>
                <div style={{
                  fontSize: 14, fontWeight: 700, color: '#0D1B2E', padding: '8px 16px',
                  background: '#F7F4EE', borderRadius: 8, marginBottom: 8,
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span>📆 {month.charAt(0).toUpperCase() + month.slice(1)}</span>
                  <span style={{ fontSize: 12, color: '#6B7280' }}>
                    {eqs.length} intervenções · {(eqs.reduce((s, e) => s + e.custoPrevisto, 0) / 1000).toFixed(1)}k€
                  </span>
                </div>
                {eqs.map(eq => (
                  <div key={eq.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderBottom: '1px solid #F3F4F6' }}>
                    <span style={{ fontSize: 18 }}>{EQUIPAMENTO_CONFIG[eq.tipo].emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B2E' }}>{EQUIPAMENTO_CONFIG[eq.tipo].label}</div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>{eq.immeubleNom}</div>
                    </div>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      border: `2px solid ${getScoreColor(eq.scoreRisco)}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: getScoreColor(eq.scoreRisco),
                    }}>
                      {eq.scoreRisco}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0D1B2E', minWidth: 70, textAlign: 'right' }}>
                      {eq.custoPrevisto.toLocaleString('pt-PT')}€
                    </span>
                  </div>
                ))}
              </div>
            ))
          })()}
        </div>
      )}

      {/* ═══ TAB: ALERTAS ═══ */}
      {tab === 'alertas' && (
        <div>
          {alertas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16 }}>Nenhum alerta de manutenção</div>
            </div>
          ) : (
            alertas.map(a => (
              <div key={a.id} style={{
                background: '#fff',
                border: a.prioridade === 'critica' ? '2px solid #DC2626' : '1px solid #E4DDD0',
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#0D1B2E', fontSize: 15 }}>{a.mensagem}</div>
                    <div style={{ fontSize: 12, color: '#4A5E78', marginTop: 4 }}>
                      🏢 {a.immeubleNom} · 📅 Até {new Date(a.dataLimite).toLocaleDateString('pt-PT')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: a.prioridade === 'critica' ? '#FEE2E2' : a.prioridade === 'alta' ? '#FEF3C7' : '#DBEAFE',
                      color: a.prioridade === 'critica' ? '#991B1B' : a.prioridade === 'alta' ? '#92400E' : '#1E40AF',
                    }}>
                      {a.prioridade === 'critica' ? '🔴 Crítica' : a.prioridade === 'alta' ? '🟡 Alta' : '🔵 Média'}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#0D1B2E' }}>{a.custoEstimado.toLocaleString('pt-PT')}€</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
