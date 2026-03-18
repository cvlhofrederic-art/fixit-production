'use client'

import { useState, useEffect } from 'react'

// ═══════════════════════════════════════════════════════════════════════════════
// PROCESSAMENTOS EM LOTE — Émission quotas, relances, clôture exercice
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

// ── Types batch ──
type BatchType = 'emissao_quotas' | 'relance_impagados' | 'encerramento_exercicio' | 'atualizacao_fundos' | 'geracao_recibos' | 'notificacao_ag'

interface BatchConfig {
  type: BatchType
  label: string
  emoji: string
  description: string
  color: string
  steps: string[]
}

interface BatchExecution {
  id: string
  type: BatchType
  dateExecution: string
  immeubleId: string | 'all'
  immeubleNom: string
  statut: 'em_fila' | 'em_execucao' | 'concluido' | 'erro' | 'cancelado'
  progression: number // 0-100
  totalItems: number
  processedItems: number
  errors: string[]
  resultSummary?: string
  createdBy: string
  duration?: number // seconds
}

interface ScheduledBatch {
  id: string
  type: BatchType
  frequencia: 'diaria' | 'semanal' | 'mensal' | 'trimestral' | 'anual'
  diaExecucao: number // day of month or day of week
  horaExecucao: string // HH:MM
  ativo: boolean
  ultimaExecucao?: string
  proximaExecucao?: string
  immeubleId: string | 'all'
  immeubleNom: string
}

// ── Configuration des types de batch ──
const BATCH_CONFIGS: BatchConfig[] = [
  {
    type: 'emissao_quotas',
    label: 'Emissão de Quotas',
    emoji: '💰',
    description: 'Gerar avisos de pagamento de quotas para todos os condóminos',
    color: '#22C55E',
    steps: [
      'Carregar lista de frações',
      'Calcular quotas por permilagem',
      'Aplicar ajustes e créditos',
      'Gerar avisos de pagamento',
      'Registar em contabilidade',
      'Enviar notificações',
    ],
  },
  {
    type: 'relance_impagados',
    label: 'Relance de Impagados',
    emoji: '⚠️',
    description: 'Enviar avisos automáticos para quotas em atraso (30, 60, 90 dias)',
    color: '#EF4444',
    steps: [
      'Identificar quotas em atraso',
      'Classificar por antiguidade',
      'Gerar cartas 1º aviso (30 dias)',
      'Gerar cartas 2º aviso (60 dias)',
      'Gerar cartas pré-contencioso (90 dias)',
      'Calcular juros de mora',
      'Enviar notificações',
    ],
  },
  {
    type: 'encerramento_exercicio',
    label: 'Encerramento de Exercício',
    emoji: '📊',
    description: 'Fechar exercício fiscal: balanço, relatório de contas, preparar novo ano',
    color: '#8B5CF6',
    steps: [
      'Verificar lançamentos pendentes',
      'Calcular saldos finais',
      'Gerar balanço anual',
      'Calcular resultado do exercício',
      'Preparar relatório de contas',
      'Transferir saldos para novo exercício',
      'Arquivar documentos fiscais',
    ],
  },
  {
    type: 'atualizacao_fundos',
    label: 'Atualização Fundo de Reserva',
    emoji: '🏦',
    description: 'Recalcular e atualizar fundo de reserva legal (mín. 10% orçamento - DL 268/94)',
    color: '#0EA5E9',
    steps: [
      'Carregar orçamento aprovado',
      'Calcular 10% mínimo legal',
      'Verificar contribuições recebidas',
      'Calcular défice/excedente',
      'Atualizar saldos por fração',
      'Gerar relatório fundo reserva',
    ],
  },
  {
    type: 'geracao_recibos',
    label: 'Geração de Recibos',
    emoji: '🧾',
    description: 'Gerar recibos em lote para pagamentos recebidos no período',
    color: '#F59E0B',
    steps: [
      'Identificar pagamentos sem recibo',
      'Validar dados fiscais',
      'Gerar recibos numerados',
      'Associar a frações',
      'Preparar envio por email',
      'Atualizar estado contabilístico',
    ],
  },
  {
    type: 'notificacao_ag',
    label: 'Convocatória AG em Lote',
    emoji: '📬',
    description: 'Enviar convocatórias para Assembleia Geral a todos os condóminos',
    color: '#EC4899',
    steps: [
      'Carregar lista de condóminos',
      'Preparar ordem de trabalhos',
      'Gerar convocatória (modelo legal)',
      'Calcular prazo legal (15 dias)',
      'Enviar por email/carta registada',
      'Registar envio com prova',
    ],
  },
]

// ── Tabs ──
type TabBatch = 'executar' | 'historico' | 'agendamentos' | 'relatorio'

export default function ProcessamentosLoteSection({ user, userRole }: Props) {
  const [tab, setTab] = useState<TabBatch>('executar')
  const [immeubles, setImmeubles] = useState<Immeuble[]>([])
  const [executions, setExecutions] = useState<BatchExecution[]>([])
  const [schedules, setSchedules] = useState<ScheduledBatch[]>([])
  const [selectedBatch, setSelectedBatch] = useState<BatchType | null>(null)
  const [selectedImmeuble, setSelectedImmeuble] = useState<string>('all')
  const [isExecuting, setIsExecuting] = useState(false)
  const [currentExecution, setCurrentExecution] = useState<BatchExecution | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({
    type: 'emissao_quotas' as BatchType,
    frequencia: 'mensal' as ScheduledBatch['frequencia'],
    diaExecucao: 1,
    horaExecucao: '08:00',
    immeubleId: 'all',
  })

  const uid = user?.id || 'local'
  const storageKey = `fixit_syndic_batch_${uid}`
  const schedulesKey = `fixit_syndic_batch_schedules_${uid}`

  // ── Load data ──
  useEffect(() => {
    // Load immeubles
    const fetchImm = async () => {
      try {
        const res = await fetch(`/api/syndic/immeubles?user_id=${uid}`)
        if (res.ok) {
          const data = await res.json()
          setImmeubles(data.immeubles || [])
        }
      } catch {
        // fallback localStorage
        const stored = localStorage.getItem(`fixit_syndic_immeubles_${uid}`)
        if (stored) setImmeubles(JSON.parse(stored))
      }
    }
    fetchImm()

    // Load execution history
    const storedExec = localStorage.getItem(storageKey)
    if (storedExec) setExecutions(JSON.parse(storedExec))

    // Load schedules
    const storedSched = localStorage.getItem(schedulesKey)
    if (storedSched) setSchedules(JSON.parse(storedSched))
  }, [uid])

  // ── Persist ──
  const saveExecutions = (data: BatchExecution[]) => {
    setExecutions(data)
    localStorage.setItem(storageKey, JSON.stringify(data))
  }

  const saveSchedules = (data: ScheduledBatch[]) => {
    setSchedules(data)
    localStorage.setItem(schedulesKey, JSON.stringify(data))
  }

  // ── Simulate batch execution ──
  const executeBatch = async (type: BatchType) => {
    const config = BATCH_CONFIGS.find(c => c.type === type)
    if (!config) return

    const immNom = selectedImmeuble === 'all'
      ? 'Todos os edifícios'
      : immeubles.find(i => i.id === selectedImmeuble)?.nom || 'Desconhecido'

    const totalItems = selectedImmeuble === 'all'
      ? immeubles.reduce((sum, i) => sum + (i.nbLots || 10), 0)
      : (immeubles.find(i => i.id === selectedImmeuble)?.nbLots || 10)

    const execution: BatchExecution = {
      id: `batch_${Date.now()}`,
      type,
      dateExecution: new Date().toISOString(),
      immeubleId: selectedImmeuble,
      immeubleNom: immNom,
      statut: 'em_execucao',
      progression: 0,
      totalItems,
      processedItems: 0,
      errors: [],
      createdBy: user?.email || 'admin',
    }

    setCurrentExecution(execution)
    setIsExecuting(true)

    // Simulate step-by-step progression
    const steps = config.steps.length
    for (let i = 0; i < steps; i++) {
      await new Promise(r => setTimeout(r, 800 + Math.random() * 400))
      const prog = Math.round(((i + 1) / steps) * 100)
      const processed = Math.round((prog / 100) * totalItems)
      // Random minor errors
      const errors = [...execution.errors]
      if (Math.random() < 0.1 && i > 0) {
        errors.push(`Aviso: Fração ${Math.floor(Math.random() * 50) + 1} — email inválido`)
      }
      const updated = { ...execution, progression: prog, processedItems: processed, errors }
      setCurrentExecution(updated)
      execution.progression = prog
      execution.processedItems = processed
      execution.errors = errors
    }

    // Complete
    execution.statut = 'concluido'
    execution.progression = 100
    execution.processedItems = totalItems
    execution.duration = Math.round(steps * 1.2)
    execution.resultSummary = getResultSummary(type, totalItems, execution.errors.length)
    setCurrentExecution(execution)
    setIsExecuting(false)

    const newExecs = [execution, ...executions]
    saveExecutions(newExecs)

    // Reset after delay
    setTimeout(() => {
      setCurrentExecution(null)
      setSelectedBatch(null)
    }, 3000)
  }

  const getResultSummary = (type: BatchType, total: number, errors: number): string => {
    const success = total - errors
    switch (type) {
      case 'emissao_quotas': return `${success} quotas emitidas com sucesso. ${errors > 0 ? `${errors} com aviso.` : ''}`
      case 'relance_impagados': return `${success} avisos de relance enviados. ${errors > 0 ? `${errors} falharam.` : ''}`
      case 'encerramento_exercicio': return `Exercício encerrado. Balanço gerado para ${success} frações.`
      case 'atualizacao_fundos': return `Fundo de reserva atualizado para ${success} frações.`
      case 'geracao_recibos': return `${success} recibos gerados e prontos para envio.`
      case 'notificacao_ag': return `${success} convocatórias enviadas. Prazo legal: 15 dias.`
      default: return `${success} itens processados.`
    }
  }

  // ── Add schedule ──
  const addSchedule = () => {
    const config = BATCH_CONFIGS.find(c => c.type === scheduleForm.type)
    if (!config) return

    const immNom = scheduleForm.immeubleId === 'all'
      ? 'Todos os edifícios'
      : immeubles.find(i => i.id === scheduleForm.immeubleId)?.nom || 'Desconhecido'

    const schedule: ScheduledBatch = {
      id: `sched_${Date.now()}`,
      type: scheduleForm.type,
      frequencia: scheduleForm.frequencia,
      diaExecucao: scheduleForm.diaExecucao,
      horaExecucao: scheduleForm.horaExecucao,
      ativo: true,
      immeubleId: scheduleForm.immeubleId,
      immeubleNom: immNom,
      proximaExecucao: calcNextExecution(scheduleForm.frequencia, scheduleForm.diaExecucao, scheduleForm.horaExecucao),
    }

    const updated = [...schedules, schedule]
    saveSchedules(updated)
    setShowScheduleModal(false)
  }

  const calcNextExecution = (freq: string, dia: number, hora: string): string => {
    const now = new Date()
    const [h, m] = hora.split(':').map(Number)
    const next = new Date(now)
    next.setHours(h, m, 0, 0)

    switch (freq) {
      case 'diaria':
        if (next <= now) next.setDate(next.getDate() + 1)
        break
      case 'semanal':
        next.setDate(next.getDate() + ((7 + dia - next.getDay()) % 7 || 7))
        break
      case 'mensal':
        next.setDate(dia)
        if (next <= now) next.setMonth(next.getMonth() + 1)
        break
      case 'trimestral':
        next.setDate(dia)
        if (next <= now) next.setMonth(next.getMonth() + 3)
        break
      case 'anual':
        next.setDate(dia)
        if (next <= now) next.setFullYear(next.getFullYear() + 1)
        break
    }
    return next.toISOString()
  }

  const toggleSchedule = (id: string) => {
    const updated = schedules.map(s => s.id === id ? { ...s, ativo: !s.ativo } : s)
    saveSchedules(updated)
  }

  const deleteSchedule = (id: string) => {
    const updated = schedules.filter(s => s.id !== id)
    saveSchedules(updated)
  }

  // ── Stats ──
  const totalExecutions = executions.length
  const successExecutions = executions.filter(e => e.statut === 'concluido').length
  const errorExecutions = executions.filter(e => e.statut === 'erro').length
  const activeSchedules = schedules.filter(s => s.ativo).length

  const tabs: { id: TabBatch; label: string; emoji: string }[] = [
    { id: 'executar', label: 'Executar', emoji: '▶️' },
    { id: 'historico', label: 'Histórico', emoji: '📜' },
    { id: 'agendamentos', label: 'Agendamentos', emoji: '⏰' },
    { id: 'relatorio', label: 'Relatório', emoji: '📊' },
  ]

  const freqLabels: Record<string, string> = {
    diaria: 'Diária',
    semanal: 'Semanal',
    mensal: 'Mensal',
    trimestral: 'Trimestral',
    anual: 'Anual',
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: '#0D1B2E', margin: 0 }}>
          ⚙️ Processamentos em Lote
        </h1>
        <p style={{ color: '#4A5E78', fontSize: 14, marginTop: 4 }}>
          Automatize tarefas repetitivas: emissão de quotas, relances, encerramento de exercício
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { emoji: '▶️', label: 'Execuções totais', value: totalExecutions, color: '#0EA5E9' },
          { emoji: '✅', label: 'Concluídas', value: successExecutions, color: '#22C55E' },
          { emoji: '❌', label: 'Com erros', value: errorExecutions, color: '#EF4444' },
          { emoji: '⏰', label: 'Agendamentos ativos', value: activeSchedules, color: '#8B5CF6' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>{s.emoji}</span>
              <span style={{ fontSize: 12, color: '#4A5E78' }}>{s.label}</span>
            </div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid #E4DDD0', paddingBottom: 0 }}>
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

      {/* ═══ TAB: EXECUTAR ═══ */}
      {tab === 'executar' && (
        <div>
          {/* Current execution progress */}
          {currentExecution && (
            <div style={{
              background: '#fff',
              border: '2px solid #C9A84C',
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: '#0D1B2E' }}>
                  {BATCH_CONFIGS.find(c => c.type === currentExecution.type)?.emoji}{' '}
                  {BATCH_CONFIGS.find(c => c.type === currentExecution.type)?.label}
                </h3>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  background: currentExecution.statut === 'concluido' ? '#DCFCE7' : '#FEF3C7',
                  color: currentExecution.statut === 'concluido' ? '#166534' : '#92400E',
                }}>
                  {currentExecution.statut === 'em_execucao' ? 'Em execução...' : 'Concluído ✓'}
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ background: '#F3F4F6', borderRadius: 8, height: 12, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{
                  height: '100%',
                  width: `${currentExecution.progression}%`,
                  background: currentExecution.statut === 'concluido'
                    ? 'linear-gradient(90deg, #22C55E, #16A34A)'
                    : 'linear-gradient(90deg, #C9A84C, #D4AF37)',
                  borderRadius: 8,
                  transition: 'width 0.5s ease-out',
                }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#4A5E78' }}>
                <span>{currentExecution.processedItems} / {currentExecution.totalItems} itens</span>
                <span>{currentExecution.progression}%</span>
              </div>

              {/* Steps progress */}
              <div style={{ marginTop: 16 }}>
                {BATCH_CONFIGS.find(c => c.type === currentExecution.type)?.steps.map((step, i) => {
                  const stepProg = Math.round(((i + 1) / (BATCH_CONFIGS.find(c => c.type === currentExecution.type)?.steps.length || 1)) * 100)
                  const isDone = currentExecution.progression >= stepProg
                  const isCurrent = !isDone && currentExecution.progression >= stepProg - 20
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 }}>
                      <span style={{ fontSize: 14 }}>
                        {isDone ? '✅' : isCurrent ? '⏳' : '⬜'}
                      </span>
                      <span style={{ color: isDone ? '#16A34A' : isCurrent ? '#D4830A' : '#9CA3AF' }}>
                        {step}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Errors */}
              {currentExecution.errors.length > 0 && (
                <div style={{ marginTop: 12, padding: 12, background: '#FEF2F2', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#DC2626', marginBottom: 4 }}>⚠️ Avisos ({currentExecution.errors.length})</div>
                  {currentExecution.errors.map((e, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#991B1B' }}>{e}</div>
                  ))}
                </div>
              )}

              {/* Result */}
              {currentExecution.resultSummary && (
                <div style={{ marginTop: 12, padding: 12, background: '#F0FDF4', borderRadius: 8, fontSize: 14, color: '#166534' }}>
                  ✅ {currentExecution.resultSummary}
                </div>
              )}
            </div>
          )}

          {/* Immeuble selector */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#0D1B2E', marginBottom: 6, display: 'block' }}>
              🏢 Edifício alvo
            </label>
            <select
              value={selectedImmeuble}
              onChange={e => setSelectedImmeuble(e.target.value)}
              style={{
                width: '100%',
                maxWidth: 400,
                padding: '10px 12px',
                border: '1px solid #E4DDD0',
                borderRadius: 8,
                fontSize: 14,
                background: '#fff',
              }}
            >
              <option value="all">Todos os edifícios</option>
              {immeubles.map(i => (
                <option key={i.id} value={i.id}>{i.nom} — {i.adresse}</option>
              ))}
            </select>
          </div>

          {/* Batch cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
            {BATCH_CONFIGS.map(config => (
              <div
                key={config.type}
                style={{
                  background: '#fff',
                  border: selectedBatch === config.type ? `2px solid ${config.color}` : '1px solid #E4DDD0',
                  borderRadius: 12,
                  padding: 20,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => setSelectedBatch(selectedBatch === config.type ? null : config.type)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{config.emoji}</div>
                    <h3 style={{ margin: 0, fontSize: 16, color: '#0D1B2E' }}>{config.label}</h3>
                    <p style={{ margin: '8px 0', fontSize: 13, color: '#4A5E78', lineHeight: 1.5 }}>
                      {config.description}
                    </p>
                  </div>
                </div>

                {/* Steps preview */}
                {selectedBatch === config.type && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#4A5E78', marginBottom: 8 }}>
                      Etapas do processamento:
                    </div>
                    {config.steps.map((step, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 12, color: '#6B7280' }}>
                        <span style={{ color: config.color, fontWeight: 700 }}>{i + 1}.</span> {step}
                      </div>
                    ))}
                    <button
                      onClick={e => { e.stopPropagation(); executeBatch(config.type) }}
                      disabled={isExecuting}
                      style={{
                        marginTop: 16,
                        width: '100%',
                        padding: '12px',
                        background: isExecuting ? '#D1D5DB' : config.color,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: isExecuting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isExecuting ? '⏳ Em execução...' : `▶️ Executar ${config.label}`}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ TAB: HISTÓRICO ═══ */}
      {tab === 'historico' && (
        <div>
          {executions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📜</div>
              <div style={{ fontSize: 16 }}>Nenhuma execução registada</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Execute um processamento para ver o histórico</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {executions.map(exec => {
                const config = BATCH_CONFIGS.find(c => c.type === exec.type)
                return (
                  <div
                    key={exec.id}
                    style={{
                      background: '#fff',
                      border: '1px solid #E4DDD0',
                      borderRadius: 12,
                      padding: 16,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 24 }}>{config?.emoji}</span>
                        <div>
                          <div style={{ fontWeight: 600, color: '#0D1B2E', fontSize: 15 }}>{config?.label}</div>
                          <div style={{ fontSize: 12, color: '#4A5E78' }}>
                            {exec.immeubleNom} · {new Date(exec.dateExecution).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          background: exec.statut === 'concluido' ? '#DCFCE7' : exec.statut === 'erro' ? '#FEE2E2' : '#FEF3C7',
                          color: exec.statut === 'concluido' ? '#166534' : exec.statut === 'erro' ? '#991B1B' : '#92400E',
                        }}>
                          {exec.statut === 'concluido' ? '✅ Concluído' : exec.statut === 'erro' ? '❌ Erro' : '⏳ Em curso'}
                        </span>
                        {exec.duration && (
                          <span style={{ fontSize: 11, color: '#9CA3AF' }}>{exec.duration}s</span>
                        )}
                      </div>
                    </div>

                    {exec.resultSummary && (
                      <div style={{ marginTop: 8, fontSize: 13, color: '#166534', background: '#F0FDF4', padding: '6px 10px', borderRadius: 6 }}>
                        {exec.resultSummary}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#6B7280' }}>
                      <span>📦 {exec.processedItems}/{exec.totalItems} itens</span>
                      {exec.errors.length > 0 && <span>⚠️ {exec.errors.length} avisos</span>}
                      <span>👤 {exec.createdBy}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: AGENDAMENTOS ═══ */}
      {tab === 'agendamentos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button
              onClick={() => setShowScheduleModal(true)}
              style={{
                padding: '10px 20px',
                background: '#C9A84C',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Novo agendamento
            </button>
          </div>

          {schedules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⏰</div>
              <div style={{ fontSize: 16 }}>Nenhum agendamento configurado</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Crie um agendamento para automatizar processamentos</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {schedules.map(sched => {
                const config = BATCH_CONFIGS.find(c => c.type === sched.type)
                return (
                  <div
                    key={sched.id}
                    style={{
                      background: '#fff',
                      border: '1px solid #E4DDD0',
                      borderRadius: 12,
                      padding: 16,
                      opacity: sched.ativo ? 1 : 0.6,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 24 }}>{config?.emoji}</span>
                        <div>
                          <div style={{ fontWeight: 600, color: '#0D1B2E', fontSize: 15 }}>{config?.label}</div>
                          <div style={{ fontSize: 12, color: '#4A5E78' }}>
                            {sched.immeubleNom} · {freqLabels[sched.frequencia]} às {sched.horaExecucao}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          onClick={() => toggleSchedule(sched.id)}
                          style={{
                            padding: '4px 12px',
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer',
                            background: sched.ativo ? '#DCFCE7' : '#FEE2E2',
                            color: sched.ativo ? '#166534' : '#991B1B',
                          }}
                        >
                          {sched.ativo ? '● Ativo' : '○ Inativo'}
                        </button>
                        <button
                          onClick={() => deleteSchedule(sched.id)}
                          style={{
                            padding: '4px 8px',
                            border: '1px solid #E4DDD0',
                            borderRadius: 6,
                            background: '#fff',
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    {sched.proximaExecucao && (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#6B7280' }}>
                        ⏭️ Próxima execução: {new Date(sched.proximaExecucao).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Schedule Modal */}
          {showScheduleModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 500 }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 18, color: '#0D1B2E' }}>⏰ Novo Agendamento</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#0D1B2E', marginBottom: 6, display: 'block' }}>
                      Tipo de processamento
                    </label>
                    <select
                      value={scheduleForm.type}
                      onChange={e => setScheduleForm({ ...scheduleForm, type: e.target.value as BatchType })}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                    >
                      {BATCH_CONFIGS.map(c => (
                        <option key={c.type} value={c.type}>{c.emoji} {c.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#0D1B2E', marginBottom: 6, display: 'block' }}>
                      Frequência
                    </label>
                    <select
                      value={scheduleForm.frequencia}
                      onChange={e => setScheduleForm({ ...scheduleForm, frequencia: e.target.value as any })}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                    >
                      {Object.entries(freqLabels).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#0D1B2E', marginBottom: 6, display: 'block' }}>
                        Dia de execução
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={scheduleForm.diaExecucao}
                        onChange={e => setScheduleForm({ ...scheduleForm, diaExecucao: Number(e.target.value) })}
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#0D1B2E', marginBottom: 6, display: 'block' }}>
                        Hora
                      </label>
                      <input
                        type="time"
                        value={scheduleForm.horaExecucao}
                        onChange={e => setScheduleForm({ ...scheduleForm, horaExecucao: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#0D1B2E', marginBottom: 6, display: 'block' }}>
                      Edifício
                    </label>
                    <select
                      value={scheduleForm.immeubleId}
                      onChange={e => setScheduleForm({ ...scheduleForm, immeubleId: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                    >
                      <option value="all">Todos os edifícios</option>
                      {immeubles.map(i => (
                        <option key={i.id} value={i.id}>{i.nom}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button
                    onClick={() => setShowScheduleModal(false)}
                    style={{ flex: 1, padding: '12px', border: '1px solid #E4DDD0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14 }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={addSchedule}
                    style={{ flex: 1, padding: '12px', background: '#C9A84C', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                  >
                    ✅ Criar agendamento
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: RELATÓRIO ═══ */}
      {tab === 'relatorio' && (
        <div>
          <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 24 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18, color: '#0D1B2E' }}>📊 Relatório de Processamentos</h3>

            {/* Summary by type */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {BATCH_CONFIGS.map(config => {
                const typeExecs = executions.filter(e => e.type === config.type)
                const typeSuccess = typeExecs.filter(e => e.statut === 'concluido').length
                const totalProcessed = typeExecs.reduce((sum, e) => sum + e.processedItems, 0)
                const totalErrors = typeExecs.reduce((sum, e) => sum + e.errors.length, 0)
                const lastExec = typeExecs[0]

                return (
                  <div key={config.type} style={{ border: '1px solid #E4DDD0', borderRadius: 10, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 20 }}>{config.emoji}</span>
                      <span style={{ fontWeight: 600, color: '#0D1B2E', fontSize: 14 }}>{config.label}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                      <div>
                        <div style={{ color: '#9CA3AF', fontSize: 11 }}>Execuções</div>
                        <div style={{ fontWeight: 600, color: '#0D1B2E' }}>{typeExecs.length}</div>
                      </div>
                      <div>
                        <div style={{ color: '#9CA3AF', fontSize: 11 }}>Taxa sucesso</div>
                        <div style={{ fontWeight: 600, color: '#22C55E' }}>
                          {typeExecs.length > 0 ? Math.round((typeSuccess / typeExecs.length) * 100) : 0}%
                        </div>
                      </div>
                      <div>
                        <div style={{ color: '#9CA3AF', fontSize: 11 }}>Itens processados</div>
                        <div style={{ fontWeight: 600, color: '#0D1B2E' }}>{totalProcessed}</div>
                      </div>
                      <div>
                        <div style={{ color: '#9CA3AF', fontSize: 11 }}>Avisos</div>
                        <div style={{ fontWeight: 600, color: totalErrors > 0 ? '#EF4444' : '#9CA3AF' }}>{totalErrors}</div>
                      </div>
                    </div>
                    {lastExec && (
                      <div style={{ marginTop: 8, fontSize: 11, color: '#9CA3AF' }}>
                        Última: {new Date(lastExec.dateExecution).toLocaleDateString('pt-PT')}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {executions.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
                <div style={{ fontSize: 16 }}>Nenhum dado de execução disponível</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Execute processamentos para ver o relatório</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
