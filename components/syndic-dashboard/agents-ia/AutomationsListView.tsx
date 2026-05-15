'use client'

import { useEffect, useState, useCallback } from 'react'

interface Automation {
  id: string
  name: string
  description: string | null
  task_type: string
  cron_expr: string
  timezone: string
  status: 'active' | 'paused' | 'archived'
  last_run_at: string | null
  last_run_status: string | null
  next_run_at: string | null
  run_count: number
  failure_count: number
  locale: 'fr' | 'pt'
}

const TASK_TYPE_LABELS: Record<string, { fr: string; pt: string; emoji: string }> = {
  send_email_template: { fr: 'Email templated', pt: 'Email templated', emoji: '📧' },
  send_appel_charges: { fr: 'Appel de charges', pt: 'Chamada de quotas', emoji: '💶' },
  send_relance_impaye: { fr: 'Relance impayé', pt: 'Cobrança dívida', emoji: '⚠️' },
  send_convocation_ag: { fr: 'Convocation AG', pt: 'Convocatória AG', emoji: '📋' },
  generate_monthly_report: { fr: 'Rapport mensuel', pt: 'Relatório mensal', emoji: '📊' },
  remind_echeance_legale: { fr: 'Échéance légale', pt: 'Prazo legal', emoji: '⏰' },
  backup_docs: { fr: 'Backup docs', pt: 'Backup docs', emoji: '🗄️' },
}

interface Props {
  locale: 'fr' | 'pt'
}

export default function AutomationsListView({ locale }: Props) {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const labels =
    locale === 'pt'
      ? {
          title: 'Minhas automatizações',
          new: 'Nova automatização',
          empty: 'Nenhuma automatização configurada. Pergunta ao Tempo no chat para criar uma.',
          active: 'Ativa',
          paused: 'Pausada',
          archived: 'Arquivada',
          pause: 'Pausar',
          resume: 'Retomar',
          delete: 'Eliminar',
          next_run: 'Próxima execução',
          last_run: 'Última execução',
          runs: 'execuções',
          failures: 'falhas',
          never: 'nunca',
        }
      : {
          title: 'Mes automatisations',
          new: 'Nouvelle automatisation',
          empty: 'Aucune automatisation configurée. Demande à Tempo dans le chat pour en créer une.',
          active: 'Active',
          paused: 'En pause',
          archived: 'Archivée',
          pause: 'Pauser',
          resume: 'Reprendre',
          delete: 'Supprimer',
          next_run: 'Prochaine exécution',
          last_run: 'Dernière exécution',
          runs: 'exécutions',
          failures: 'échecs',
          never: 'jamais',
        }

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/syndic/automations')
      if (!res.ok) return
      const json = (await res.json()) as { automations: Automation[] }
      setAutomations(json.automations.filter((a) => a.status !== 'archived'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const updateStatus = async (id: string, status: 'active' | 'paused' | 'archived') => {
    await fetch(`/api/syndic/automations/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    void refetch()
  }

  const deleteOne = async (id: string) => {
    if (
      !confirm(locale === 'pt' ? 'Eliminar esta automatização?' : 'Supprimer cette automatisation ?')
    )
      return
    await fetch(`/api/syndic/automations/${id}`, { method: 'DELETE' })
    void refetch()
  }

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 600 }}>🔄 {labels.title}</h2>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '10px 16px',
            background: 'var(--sd-gold)',
            color: 'var(--sd-navy)',
            border: 0,
            borderRadius: 8,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + {labels.new}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 24, color: 'rgba(0,0,0,0.5)' }}>Chargement...</div>
      ) : automations.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            background: 'var(--sd-bg-2)',
            borderRadius: 12,
            color: 'rgba(0,0,0,0.5)',
          }}
        >
          {labels.empty}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {automations.map((a) => {
            const meta = TASK_TYPE_LABELS[a.task_type] ?? {
              fr: a.task_type,
              pt: a.task_type,
              emoji: '⚙️',
            }
            const statusLabel =
              a.status === 'active'
                ? labels.active
                : a.status === 'paused'
                  ? labels.paused
                  : labels.archived
            const statusColor =
              a.status === 'active'
                ? '#22c55e'
                : a.status === 'paused'
                  ? '#f59e0b'
                  : 'rgba(0,0,0,0.4)'
            return (
              <div
                key={a.id}
                style={{
                  padding: 16,
                  background: 'var(--sd-bg-2)',
                  borderRadius: 12,
                  border: '1px solid var(--sd-border)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 24 }}>{meta.emoji}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{a.name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.55)' }}>
                        {locale === 'pt' ? meta.pt : meta.fr} •{' '}
                        <code>{a.cron_expr}</code>
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: `${statusColor}22`,
                      color: statusColor,
                    }}
                  >
                    {statusLabel}
                  </div>
                </div>

                {a.description && (
                  <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.65)', marginBottom: 8 }}>
                    {a.description}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    gap: 16,
                    fontSize: 12,
                    color: 'rgba(0,0,0,0.55)',
                    marginBottom: 10,
                  }}
                >
                  <span>
                    {labels.next_run}:{' '}
                    <strong>
                      {a.next_run_at
                        ? new Date(a.next_run_at).toLocaleString(locale)
                        : labels.never}
                    </strong>
                  </span>
                  <span>
                    {labels.last_run}:{' '}
                    <strong>
                      {a.last_run_at
                        ? new Date(a.last_run_at).toLocaleString(locale)
                        : labels.never}
                    </strong>
                  </span>
                  <span>
                    {a.run_count} {labels.runs}
                  </span>
                  {a.failure_count > 0 && (
                    <span style={{ color: '#ef4444' }}>
                      {a.failure_count} {labels.failures}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {a.status === 'active' && (
                    <button onClick={() => updateStatus(a.id, 'paused')} style={btnStyle()}>
                      ⏸ {labels.pause}
                    </button>
                  )}
                  {a.status === 'paused' && (
                    <button onClick={() => updateStatus(a.id, 'active')} style={btnStyle()}>
                      ▶ {labels.resume}
                    </button>
                  )}
                  <button onClick={() => deleteOne(a.id)} style={btnStyle('danger')}>
                    🗑 {labels.delete}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <CreateAutomationModal
          locale={locale}
          onClose={() => setShowCreate(false)}
          onCreated={refetch}
        />
      )}
    </div>
  )
}

function btnStyle(variant?: 'danger'): React.CSSProperties {
  return {
    padding: '6px 12px',
    fontSize: 12,
    borderRadius: 6,
    background: variant === 'danger' ? 'transparent' : 'var(--sd-bg)',
    color: variant === 'danger' ? '#ef4444' : 'inherit',
    border: '1px solid var(--sd-border)',
    cursor: 'pointer',
  }
}

interface CreateModalProps {
  locale: 'fr' | 'pt'
  onClose: () => void
  onCreated: () => void
}

function CreateAutomationModal({ locale, onClose, onCreated }: CreateModalProps) {
  const [name, setName] = useState('')
  const [taskType, setTaskType] = useState('send_email_template')
  const [cron, setCron] = useState('0 9 1 * *')
  const [paramsJson, setParamsJson] = useState('{}')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const labels =
    locale === 'pt'
      ? {
          create: 'Criar',
          cancel: 'Cancelar',
          name: 'Nome',
          type: 'Tipo',
          cron: 'Cron',
          params: 'Parâmetros (JSON)',
          presets: 'Presets',
          invalidJson: 'JSON inválido',
          daily: 'Diário 9h',
          weekly: 'Segunda 10h',
          monthly: '1.º do mês',
          quarterly: 'Trimestral',
        }
      : {
          create: 'Créer',
          cancel: 'Annuler',
          name: 'Nom',
          type: 'Type',
          cron: 'Cron',
          params: 'Paramètres (JSON)',
          presets: 'Presets',
          invalidJson: 'JSON invalide',
          daily: 'Quotidien 9h',
          weekly: 'Lundi 10h',
          monthly: '1er du mois',
          quarterly: 'Trimestriel',
        }

  const submit = async () => {
    setError(null)
    setSubmitting(true)
    let params: unknown = {}
    try {
      params = JSON.parse(paramsJson)
    } catch {
      setError(labels.invalidJson)
      setSubmitting(false)
      return
    }
    const res = await fetch('/api/syndic/automations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, task_type: taskType, cron_expr: cron, params, locale }),
    })
    if (res.ok) {
      onCreated()
      onClose()
    } else {
      const err = (await res.json().catch(() => ({}))) as { error?: string }
      setError(err.error ?? 'failed')
    }
    setSubmitting(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--sd-bg)',
          borderRadius: 12,
          padding: 24,
          width: 'min(600px, 90vw)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
          + {locale === 'pt' ? 'Nova automatização' : 'Nouvelle automatisation'}
        </h3>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            {labels.name}
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle()}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            {labels.type}
          </span>
          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
            style={inputStyle()}
          >
            {Object.entries(TASK_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.emoji} {locale === 'pt' ? v.pt : v.fr}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: 8 }}>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            {labels.cron}
          </span>
          <input
            value={cron}
            onChange={(e) => setCron(e.target.value)}
            placeholder="0 9 1 * *"
            style={{ ...inputStyle(), fontFamily: 'monospace' }}
          />
        </label>

        <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', marginBottom: 12 }}>
          {labels.presets}:{' '}
          <button onClick={() => setCron('0 9 * * *')} style={presetBtn()}>
            {labels.daily}
          </button>
          <button onClick={() => setCron('0 10 * * 1')} style={presetBtn()}>
            {labels.weekly}
          </button>
          <button onClick={() => setCron('0 9 1 * *')} style={presetBtn()}>
            {labels.monthly}
          </button>
          <button onClick={() => setCron('0 9 1 1,4,7,10 *')} style={presetBtn()}>
            {labels.quarterly}
          </button>
        </div>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            {labels.params}
          </span>
          <textarea
            value={paramsJson}
            onChange={(e) => setParamsJson(e.target.value)}
            rows={4}
            style={{ ...inputStyle(), fontFamily: 'monospace', fontSize: 12 }}
          />
        </label>

        {error && (
          <div
            style={{
              padding: 8,
              background: '#fee',
              color: '#c33',
              borderRadius: 6,
              marginBottom: 12,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnStyle()} disabled={submitting}>
            {labels.cancel}
          </button>
          <button
            onClick={submit}
            disabled={submitting || !name}
            style={{
              padding: '8px 16px',
              background: 'var(--sd-gold)',
              color: 'var(--sd-navy)',
              border: 0,
              borderRadius: 8,
              fontWeight: 600,
              cursor: submitting || !name ? 'not-allowed' : 'pointer',
              opacity: submitting || !name ? 0.5 : 1,
            }}
          >
            {submitting ? '...' : labels.create}
          </button>
        </div>
      </div>
    </div>
  )
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: 8,
    fontSize: 14,
    border: '1px solid var(--sd-border)',
    borderRadius: 6,
  }
}

function presetBtn(): React.CSSProperties {
  return {
    margin: '0 4px',
    padding: '2px 8px',
    fontSize: 11,
    background: 'var(--sd-bg-2)',
    border: '1px solid var(--sd-border)',
    borderRadius: 4,
    cursor: 'pointer',
  }
}
