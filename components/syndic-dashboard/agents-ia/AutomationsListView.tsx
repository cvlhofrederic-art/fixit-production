'use client'

import { useState } from 'react'

interface Automation {
  id: string
  name: string
  description: string | null
  task_type: string
  cron_expr: string
  cron_human: { fr: string; pt: string }
  target: string
  status: 'active' | 'paused'
  last_run_at: string | null
  last_run_status: 'success' | 'partial' | 'failed' | null
  next_run_at: string | null
  run_count: number
  failure_count: number
  created_at: string
}

const TASK_TYPE_LABELS: Record<string, { fr: string; pt: string; emoji: string }> = {
  send_appel_charges: { fr: 'Appel de charges', pt: 'Chamada de quotas', emoji: '💶' },
  send_relance_impaye: { fr: 'Relance impayé', pt: 'Cobrança dívida', emoji: '⚠️' },
  send_convocation_ag: { fr: 'Convocation AG', pt: 'Convocatória AG', emoji: '📋' },
  generate_monthly_report: { fr: 'Rapport mensuel', pt: 'Relatório mensal', emoji: '📊' },
  remind_echeance_legale: { fr: 'Échéance légale', pt: 'Prazo legal', emoji: '⏰' },
  send_email_template: { fr: 'Email automatique', pt: 'Email automático', emoji: '📧' },
  backup_docs: { fr: 'Backup docs', pt: 'Backup docs', emoji: '🗄️' },
}

// ── Données démo réalistes (PT context — Gabinete Vitfix Portugal) ──
const DEMO_AUTOMATIONS: Automation[] = [
  {
    id: 'demo-001',
    name: 'Chamadas de quotas — Edifício Atlântico',
    description: 'Envio trimestral das chamadas de quotas a todos os condóminos do Edifício Atlântico.',
    task_type: 'send_appel_charges',
    cron_expr: '0 9 1 1,4,7,10 *',
    cron_human: { fr: 'Trimestriel — 1er jour à 9h', pt: 'Trimestral — dia 1 às 9h' },
    target: 'Edifício Atlântico (24 condóminos)',
    status: 'active',
    last_run_at: '2026-04-01T09:00:12Z',
    last_run_status: 'success',
    next_run_at: '2026-07-01T09:00:00Z',
    run_count: 6,
    failure_count: 0,
    created_at: '2025-10-15T14:30:00Z',
  },
  {
    id: 'demo-002',
    name: 'Cobrança dívidas > 30 dias',
    description: 'Relance automática aos condóminos com quotas em atraso superior a 30 dias — todos os edifícios.',
    task_type: 'send_relance_impaye',
    cron_expr: '0 10 * * 1',
    cron_human: { fr: 'Chaque lundi à 10h', pt: 'Cada segunda-feira às 10h' },
    target: 'Todos os edifícios (dívidas > 30 dias)',
    status: 'active',
    last_run_at: '2026-05-19T10:00:08Z',
    last_run_status: 'partial',
    next_run_at: '2026-05-26T10:00:00Z',
    run_count: 31,
    failure_count: 2,
    created_at: '2025-11-03T09:15:00Z',
  },
  {
    id: 'demo-003',
    name: 'Convocatória AG — Residencial Cedofeita',
    description: 'Convocação anual da Assembleia Geral ordinária — envio automático 15 dias antes da data prevista (outubro).',
    task_type: 'send_convocation_ag',
    cron_expr: '0 9 15 9 *',
    cron_human: { fr: '15 septembre à 9h', pt: '15 de setembro às 9h' },
    target: 'Residencial Cedofeita (18 condóminos)',
    status: 'active',
    last_run_at: '2025-09-15T09:00:05Z',
    last_run_status: 'success',
    next_run_at: '2026-09-15T09:00:00Z',
    run_count: 1,
    failure_count: 0,
    created_at: '2025-09-01T11:00:00Z',
  },
  {
    id: 'demo-004',
    name: 'Relatório mensal de gestão',
    description: 'Compilação automática: receitas, despesas, obras em curso, incidentes e dívidas — enviado ao conselho fiscal.',
    task_type: 'generate_monthly_report',
    cron_expr: '0 8 5 * *',
    cron_human: { fr: 'Le 5 de chaque mois à 8h', pt: 'Dia 5 de cada mês às 8h' },
    target: 'Conselho fiscal + administração',
    status: 'active',
    last_run_at: '2026-05-05T08:00:22Z',
    last_run_status: 'success',
    next_run_at: '2026-06-05T08:00:00Z',
    run_count: 7,
    failure_count: 0,
    created_at: '2025-10-28T16:45:00Z',
  },
  {
    id: 'demo-005',
    name: 'Alerta prazo DPE — Condomínio Boavista Center',
    description: 'Lembrete automático 60 dias antes da expiração do certificado energético (DPE).',
    task_type: 'remind_echeance_legale',
    cron_expr: '0 9 1 * *',
    cron_human: { fr: '1er de chaque mois à 9h', pt: 'Dia 1 de cada mês às 9h' },
    target: 'Condomínio Boavista Center',
    status: 'active',
    last_run_at: '2026-05-01T09:00:03Z',
    last_run_status: 'success',
    next_run_at: '2026-06-01T09:00:00Z',
    run_count: 7,
    failure_count: 0,
    created_at: '2025-11-10T10:20:00Z',
  },
  {
    id: 'demo-006',
    name: 'Backup documentos — semanal',
    description: 'Export ZIP semanal de todos os documentos do gabinete (facturas, actas, convocatórias).',
    task_type: 'backup_docs',
    cron_expr: '0 2 * * 0',
    cron_human: { fr: 'Chaque dimanche à 2h', pt: 'Cada domingo às 2h' },
    target: 'Gabinete Vitfix Portugal',
    status: 'active',
    last_run_at: '2026-05-18T02:00:45Z',
    last_run_status: 'success',
    next_run_at: '2026-05-25T02:00:00Z',
    run_count: 28,
    failure_count: 1,
    created_at: '2025-11-20T08:00:00Z',
  },
  {
    id: 'demo-007',
    name: 'Boas-vindas novos condóminos',
    description: 'Email de boas-vindas automático com regulamento interno e contactos úteis — ativado manualmente quando necessário.',
    task_type: 'send_email_template',
    cron_expr: '0 9 * * *',
    cron_human: { fr: 'Quotidien à 9h (si déclenché)', pt: 'Diário às 9h (se ativado)' },
    target: 'Novos condóminos (todos os edifícios)',
    status: 'paused',
    last_run_at: '2026-03-12T09:00:11Z',
    last_run_status: 'success',
    next_run_at: null,
    run_count: 4,
    failure_count: 0,
    created_at: '2026-01-08T13:30:00Z',
  },
  {
    id: 'demo-008',
    name: 'Chamadas de quotas — Foz do Douro Residence',
    description: 'Envio trimestral das chamadas de quotas premium — Passeio Alegre 78.',
    task_type: 'send_appel_charges',
    cron_expr: '0 9 1 1,4,7,10 *',
    cron_human: { fr: 'Trimestriel — 1er jour à 9h', pt: 'Trimestral — dia 1 às 9h' },
    target: 'Foz do Douro Residence (12 condóminos)',
    status: 'active',
    last_run_at: '2026-04-01T09:00:18Z',
    last_run_status: 'success',
    next_run_at: '2026-07-01T09:00:00Z',
    run_count: 6,
    failure_count: 0,
    created_at: '2025-10-15T15:00:00Z',
  },
]

type FilterStatus = 'all' | 'active' | 'paused'
type SortBy = 'next_run' | 'name' | 'created'

interface Props {
  locale: 'fr' | 'pt'
}

export default function AutomationsListView({ locale }: Props) {
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [sortBy, setSortBy] = useState<SortBy>('next_run')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const t = locale === 'pt'
    ? {
        title: 'Automatizações',
        all: 'Todas',
        active: 'Ativas',
        paused: 'Pausadas',
        sort_next: 'Próxima exec.',
        sort_name: 'Nome',
        sort_created: 'Criação',
        next_run: 'Próxima execução',
        last_run: 'Última execução',
        runs: 'execuções',
        failures: 'falhas',
        never: 'nunca',
        target: 'Alvo',
        schedule: 'Agenda',
        created: 'Criada em',
        pause: 'Pausar',
        resume: 'Retomar',
        success: 'Sucesso',
        partial: 'Parcial',
        failed: 'Falhou',
        total: 'Total',
        active_count: 'ativas',
        paused_count: 'pausadas',
      }
    : {
        title: 'Automatisations',
        all: 'Toutes',
        active: 'Actives',
        paused: 'En pause',
        sort_next: 'Proch. exéc.',
        sort_name: 'Nom',
        sort_created: 'Création',
        next_run: 'Prochaine exécution',
        last_run: 'Dernière exécution',
        runs: 'exécutions',
        failures: 'échecs',
        never: 'jamais',
        target: 'Cible',
        schedule: 'Planification',
        created: 'Créée le',
        pause: 'Pauser',
        resume: 'Reprendre',
        success: 'Succès',
        partial: 'Partiel',
        failed: 'Échoué',
        total: 'Total',
        active_count: 'actives',
        paused_count: 'en pause',
      }

  const filtered = DEMO_AUTOMATIONS
    .filter(a => filter === 'all' || a.status === filter)
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'created') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      // next_run — nulls at end
      const aNext = a.next_run_at ? new Date(a.next_run_at).getTime() : Infinity
      const bNext = b.next_run_at ? new Date(b.next_run_at).getTime() : Infinity
      return aNext - bNext
    })

  const activeCount = DEMO_AUTOMATIONS.filter(a => a.status === 'active').length
  const pausedCount = DEMO_AUTOMATIONS.filter(a => a.status === 'paused').length
  const totalRuns = DEMO_AUTOMATIONS.reduce((s, a) => s + a.run_count, 0)

  const formatDate = (d: string | null) => {
    if (!d) return t.never
    return new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const statusBadge = (status: 'success' | 'partial' | 'failed' | null) => {
    if (!status) return null
    const colors = {
      success: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
      partial: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
      failed: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
    }
    const c = colors[status]
    const label = status === 'success' ? t.success : status === 'partial' ? t.partial : t.failed
    return (
      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: c.bg, color: c.text }}>
        {label}
      </span>
    )
  }

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto', color: 'var(--sd-text)' }}>
      {/* ── Stats summary ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: t.total, value: String(DEMO_AUTOMATIONS.length), color: 'var(--sd-gold)' },
          { label: t.active_count, value: String(activeCount), color: '#22c55e' },
          { label: t.paused_count, value: String(pausedCount), color: '#f59e0b' },
          { label: t.runs, value: String(totalRuns), color: '#6366f1' },
        ].map((stat, i) => (
          <div key={i} style={{
            flex: '1 1 120px',
            padding: '12px 16px',
            background: 'var(--sd-bg-2)',
            borderRadius: 10,
            border: '1px solid var(--sd-border-dark)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: 'var(--sd-text-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filter + Sort bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'active', 'paused'] as FilterStatus[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                border: '1px solid var(--sd-border-dark)',
                background: filter === f ? 'var(--sd-gold)' : 'var(--sd-bg-2)',
                color: filter === f ? 'var(--sd-navy)' : 'var(--sd-text-2)',
                cursor: 'pointer',
              }}
            >
              {f === 'all' ? t.all : f === 'active' ? t.active : t.paused}
              {f === 'active' && ` (${activeCount})`}
              {f === 'paused' && ` (${pausedCount})`}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--sd-text-3)' }}>
          {(['next_run', 'name', 'created'] as SortBy[]).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                borderRadius: 6,
                border: '1px solid var(--sd-border-dark)',
                background: sortBy === s ? 'var(--sd-bg-3)' : 'transparent',
                color: sortBy === s ? 'var(--sd-text)' : 'var(--sd-text-3)',
                cursor: 'pointer',
              }}
            >
              {s === 'next_run' ? t.sort_next : s === 'name' ? t.sort_name : t.sort_created}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ borderRadius: 12, border: '1px solid var(--sd-border-dark)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 2fr 1fr 1fr 1fr 80px',
          padding: '10px 16px',
          background: 'var(--sd-bg-3)',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--sd-text-3)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          gap: 8,
        }}>
          <div />
          <div>{locale === 'pt' ? 'Nome' : 'Nom'}</div>
          <div>{locale === 'pt' ? 'Tipo' : 'Type'}</div>
          <div>{t.schedule}</div>
          <div>{t.last_run}</div>
          <div style={{ textAlign: 'center' }}>Status</div>
        </div>

        {/* Rows */}
        {filtered.map(a => {
          const meta = TASK_TYPE_LABELS[a.task_type] ?? { fr: a.task_type, pt: a.task_type, emoji: '⚙️' }
          const isExpanded = expandedId === a.id

          return (
            <div key={a.id}>
              <div
                onClick={() => setExpandedId(isExpanded ? null : a.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 2fr 1fr 1fr 1fr 80px',
                  padding: '12px 16px',
                  borderTop: '1px solid var(--sd-border-dark)',
                  cursor: 'pointer',
                  background: isExpanded ? 'var(--sd-bg-2)' : 'transparent',
                  transition: 'background 0.15s',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = 'var(--sd-bg-2)' }}
                onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <div style={{ fontSize: 20, textAlign: 'center' }}>{meta.emoji}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--sd-text)' }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--sd-text-3)', marginTop: 2 }}>{a.target}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--sd-text-2)' }}>
                  {locale === 'pt' ? meta.pt : meta.fr}
                </div>
                <div style={{ fontSize: 12, color: 'var(--sd-text-2)' }}>
                  {locale === 'pt' ? a.cron_human.pt : a.cron_human.fr}
                </div>
                <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {statusBadge(a.last_run_status)}
                  <span style={{ color: 'var(--sd-text-3)' }}>
                    {a.last_run_at ? new Date(a.last_run_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : t.never}
                  </span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                    background: a.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                    color: a.status === 'active' ? '#22c55e' : '#f59e0b',
                  }}>
                    {a.status === 'active' ? t.active : t.paused}
                  </span>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div style={{
                  padding: '12px 16px 16px 56px',
                  background: 'var(--sd-bg-2)',
                  borderTop: '1px solid var(--sd-border-dark)',
                  fontSize: 12,
                  color: 'var(--sd-text-2)',
                }}>
                  {a.description && (
                    <p style={{ marginBottom: 10, lineHeight: 1.5 }}>{a.description}</p>
                  )}
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 10 }}>
                    <div>
                      <span style={{ color: 'var(--sd-text-3)' }}>{t.next_run}: </span>
                      <strong style={{ color: 'var(--sd-text)' }}>{formatDate(a.next_run_at)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--sd-text-3)' }}>{t.last_run}: </span>
                      <strong style={{ color: 'var(--sd-text)' }}>{formatDate(a.last_run_at)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--sd-text-3)' }}>{t.runs}: </span>
                      <strong style={{ color: 'var(--sd-text)' }}>{a.run_count}</strong>
                    </div>
                    {a.failure_count > 0 && (
                      <div>
                        <span style={{ color: 'var(--sd-text-3)' }}>{t.failures}: </span>
                        <strong style={{ color: '#ef4444' }}>{a.failure_count}</strong>
                      </div>
                    )}
                    <div>
                      <span style={{ color: 'var(--sd-text-3)' }}>Cron: </span>
                      <code style={{ fontFamily: 'monospace', color: 'var(--sd-text)', background: 'var(--sd-bg-3)', padding: '2px 6px', borderRadius: 4 }}>{a.cron_expr}</code>
                    </div>
                    <div>
                      <span style={{ color: 'var(--sd-text-3)' }}>{t.created}: </span>
                      <strong style={{ color: 'var(--sd-text)' }}>{formatDate(a.created_at)}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{
                      padding: '6px 14px',
                      fontSize: 12,
                      borderRadius: 6,
                      background: 'var(--sd-bg-3)',
                      color: 'var(--sd-text)',
                      border: '1px solid var(--sd-border-dark)',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}>
                      {a.status === 'active' ? `⏸ ${t.pause}` : `▶ ${t.resume}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
