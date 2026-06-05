'use client'

import { useState, useEffect, useRef, Fragment, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Alert } from '../primitives/alert'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'

/** Planeamento — port byte-exact du ModPlaneamento du bundle V5.7 (agenda semaine, stateful).
 * CSS bespoke dans ./planeamento.css (scopé #syndic-dashboard-v54), importé dans le layout dev.
 * Icônes chevron-up/down absentes du bundle (fallback doc) → on utilise chevronDown (affordance correcte). */

type Member = { id: string; name: string; role: string; accent: string }
type Day = { key: string; short: string; long: string; date: string }
type WeekEvent = { id: number; day: string; start: string; end: string; label: string; kind: string; owner: string }
type Settings = { workingDays: string[]; startHour: number; endHour: number; slotMinutes: number }

const TEAM: Member[] = [
  { id: 'HC', name: 'Helena Carvalho', role: 'Administrador', accent: 'gold' },
  { id: 'BT', name: 'Bruno Tavares', role: 'Gestor Técnico', accent: 'sage' },
  { id: 'DP', name: 'Diogo Pereira', role: 'Técnico', accent: 'sage' },
  { id: 'TM', name: 'Tiago Mendes', role: 'Técnico', accent: 'sage' },
  { id: 'MS', name: 'Margarida Sousa', role: 'Secretária', accent: 'sage' },
  { id: 'RA', name: 'Ricardo Almeida', role: 'Contabilista', accent: 'sage' },
  { id: 'IM', name: 'Inês Monteiro', role: 'Jurista', accent: 'amber' },
]
const ALL_DAYS: Day[] = [
  { key: 'mon', short: 'Seg', long: 'Segunda', date: '19' },
  { key: 'tue', short: 'Ter', long: 'Terça', date: '20' },
  { key: 'wed', short: 'Qua', long: 'Quarta', date: '21' },
  { key: 'thu', short: 'Qui', long: 'Quinta', date: '22' },
  { key: 'fri', short: 'Sex', long: 'Sexta', date: '23' },
  { key: 'sat', short: 'Sáb', long: 'Sábado', date: '24' },
  { key: 'sun', short: 'Dom', long: 'Domingo', date: '25' },
]
const WEEK_EVENTS: WeekEvent[] = [
  { id: 1, day: 'mon', start: '09:00', end: '10:00', label: 'Reunião AG Atlântico', kind: 'gold', owner: 'HC' },
  { id: 2, day: 'mon', start: '14:00', end: '16:00', label: 'Visita Edifício Atlântico', kind: 'sage', owner: 'BT' },
  { id: 3, day: 'tue', start: '10:00', end: '11:00', label: 'Piscina', kind: 'green', owner: 'MS' },
  { id: 4, day: 'tue', start: '15:00', end: '16:00', label: 'Salão', kind: 'gold', owner: 'MS' },
  { id: 5, day: 'wed', start: '09:00', end: '11:00', label: 'Inspeção elevador', kind: 'amber', owner: 'DP' },
  { id: 6, day: 'wed', start: '15:00', end: '16:00', label: 'Reunião condóminos', kind: 'gold', owner: 'IM' },
  { id: 7, day: 'thu', start: '08:00', end: '09:00', label: 'Visita Foz Douro', kind: 'sage', owner: 'TM' },
  { id: 8, day: 'thu', start: '11:00', end: '12:00', label: 'Fatura Q1', kind: 'amber', owner: 'RA' },
  { id: 9, day: 'fri', start: '10:00', end: '11:00', label: 'Ginásio', kind: 'green', owner: 'MS' },
  { id: 10, day: 'fri', start: '16:00', end: '18:00', label: 'Reunião AG Boavista', kind: 'gold', owner: 'HC' },
  { id: 11, day: 'sat', start: '10:00', end: '12:00', label: 'Evento condóminos', kind: 'rust', owner: 'MS' },
]
const DEFAULTS: Settings = { workingDays: ['mon', 'tue', 'wed', 'thu', 'fri'], startHour: 8, endHour: 19, slotMinutes: 60 }
const eventPill = (k: string): PillKind => (k === 'green' ? 'sage' : k === 'gold' ? 'gold' : k === 'amber' ? 'amber' : k === 'rust' ? 'rust' : 'sage')
const parseMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }

export default function ModPlaneamento() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [draft, setDraft] = useState<Settings>(DEFAULTS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const dropdownBtnRef = useRef<HTMLButtonElement>(null)
  const { push } = useToast()

  const selectedMember = selectedMemberId ? TEAM.find(m => m.id === selectedMemberId) || null : null

  useEffect(() => {
    if (!dropdownOpen) return
    const onClick = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setDropdownOpen(false); dropdownBtnRef.current?.focus() } }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [dropdownOpen])

  const selectMember = (memberId: string | null) => {
    setSelectedMemberId(memberId)
    setDropdownOpen(false)
    dropdownBtnRef.current?.focus()
    const m = memberId ? TEAM.find(x => x.id === memberId) : null
    push({ kind: 'info', title: m ? `Agenda de ${m.name}` : 'Toda a equipa', desc: m ? `A mostrar apenas eventos de ${m.role}` : 'A mostrar todos os eventos da equipa' })
  }
  const openSettings = () => { setDraft(settings); setSettingsOpen(true) }
  const applySettings = (e: FormEvent) => {
    e.preventDefault()
    if (draft.endHour <= draft.startHour) { push({ kind: 'warning', title: 'Horário inválido', desc: 'A hora de fim deve ser posterior à hora de início.' }); return }
    if (draft.workingDays.length === 0) { push({ kind: 'warning', title: 'Sem dias úteis', desc: 'Selecione pelo menos um dia da semana.' }); return }
    setSettings(draft)
    setSettingsOpen(false)
    push({ kind: 'success', title: 'Visualização atualizada', desc: `${draft.workingDays.length} dias · ${draft.startHour}h-${draft.endHour}h · slots de ${draft.slotMinutes >= 60 ? (draft.slotMinutes / 60) + 'h' : draft.slotMinutes + 'min'}` })
  }
  const resetDefaults = () => { setDraft(DEFAULTS) }
  const toggleDay = (dayKey: string) => {
    setDraft(d => ({ ...d, workingDays: d.workingDays.includes(dayKey) ? d.workingDays.filter(k => k !== dayKey) : [...d.workingDays, dayKey] }))
  }

  const visibleDays = ALL_DAYS.filter(d => settings.workingDays.includes(d.key))
  const slots: { idx: number; label: string }[] = []
  for (let totalMin = settings.startHour * 60; totalMin < settings.endHour * 60; totalMin += settings.slotMinutes) {
    const h = Math.floor(totalMin / 60); const m = totalMin % 60
    slots.push({ idx: slots.length, label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` })
  }
  const visibleEvents = WEEK_EVENTS.filter(ev => {
    if (selectedMemberId && ev.owner !== selectedMemberId) return false
    if (!settings.workingDays.includes(ev.day)) return false
    if (parseMin(ev.end) <= settings.startHour * 60) return false
    if (parseMin(ev.start) >= settings.endHour * 60) return false
    return true
  })
  const placeEvent = (ev: WeekEvent) => {
    const startMin = Math.max(parseMin(ev.start), settings.startHour * 60)
    const endMin = Math.min(parseMin(ev.end), settings.endHour * 60)
    const startSlot = (startMin - settings.startHour * 60) / settings.slotMinutes
    const endSlot = (endMin - settings.startHour * 60) / settings.slotMinutes
    const colIdx = visibleDays.findIndex(d => d.key === ev.day)
    if (colIdx < 0) return null
    return { gridColumn: colIdx + 2, gridRow: `${Math.floor(startSlot) + 2} / ${Math.ceil(endSlot) + 2}` } as const
  }

  return (
    <>
      <PageHead
        title={selectedMember ? `Agenda de ${selectedMember.name}` : 'Planeamento'}
        lede={selectedMember
          ? `${selectedMember.role} · ${visibleDays.length} dias visíveis · ${slots.length} créneaux`
          : `Vista semanal · ${visibleDays.length} dias visíveis · slots de ${settings.slotMinutes >= 60 ? (settings.slotMinutes / 60) + 'h' : settings.slotMinutes + 'min'}`}
        actions={
          <>
            <div className="team-dd-wrap" ref={dropdownRef}>
              <button ref={dropdownBtnRef} type="button" className={clsx(btnCss.btn, 'team-dd-btn')} aria-haspopup="menu" aria-expanded={dropdownOpen ? 'true' : 'false'} onClick={() => setDropdownOpen(o => !o)}>
                {selectedMember ? (
                  <>
                    <span className={`team-dd-avatar accent-${selectedMember.accent}`}>{selectedMember.id}</span>
                    <span className="team-dd-label">{selectedMember.name}</span>
                  </>
                ) : (
                  <>
                    <Icon name="team" />
                    <span className="team-dd-label">Toda a equipa</span>
                  </>
                )}
                <Icon name="chevronDown" />
              </button>
              {dropdownOpen && (
                <div className="team-dd-menu" role="menu" aria-label="Selecionar membro da equipa">
                  <button type="button" role="menuitem" className={clsx('team-dd-item', !selectedMemberId && 'active')} onClick={() => selectMember(null)}>
                    <span className="team-dd-item-icon"><Icon name="team" /></span>
                    <span className="team-dd-item-info">
                      <span className="team-dd-item-name">Toda a equipa</span>
                      <span className="team-dd-item-role">{TEAM.length} membros · vista global</span>
                    </span>
                    {!selectedMemberId && <Icon name="check" />}
                  </button>
                  <div className="team-dd-sep" role="separator" />
                  {TEAM.map(m => (
                    <button key={m.id} type="button" role="menuitem" className={clsx('team-dd-item', selectedMemberId === m.id && 'active')} onClick={() => selectMember(m.id)}>
                      <span className={`team-dd-avatar accent-${m.accent}`}>{m.id}</span>
                      <span className="team-dd-item-info">
                        <span className="team-dd-item-name">{m.name}</span>
                        <span className="team-dd-item-role">{m.role}</span>
                      </span>
                      {selectedMemberId === m.id && <Icon name="check" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button onClick={openSettings}><Icon name="cog" />Visualização</Button>
            <Button variant="ghost" onClick={() => push({ kind: 'info', title: 'Semana anterior' })}>←</Button>
            <Button variant="ghost" onClick={() => push({ kind: 'info', title: 'Esta semana' })}>Hoje</Button>
            <Button variant="ghost" onClick={() => push({ kind: 'info', title: 'Próxima semana' })}>→</Button>
            <Button variant="gold" onClick={() => push({ kind: 'info', title: 'Adicionar evento' })}><Icon name="plus" />Adicionar</Button>
          </>
        }
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <button type="button" className="chip" style={{ background: 'var(--v54-navy-900)', color: '#fff', borderColor: 'var(--v54-navy-900)' }}>Reunião</button>
        <button type="button" className="chip" style={{ background: 'var(--v54-sage-50)', color: 'var(--v54-sage-700)', borderColor: 'transparent' }}>Visita</button>
        <button type="button" className="chip" style={{ background: 'var(--v54-amber-100)', color: 'var(--v54-amber-700)', borderColor: 'transparent' }}>Tarefa</button>
        <button type="button" className="chip" style={{ background: 'var(--v54-gold-50)', color: 'var(--v54-gold-700)', borderColor: 'transparent' }}>Missão Prestador</button>
        <button type="button" className="chip">Outro</button>
      </div>

      {visibleEvents.length === 0 && selectedMember && (
        <Alert icon="info" title={`Sem eventos planeados para ${selectedMember.name} esta semana`}>
          A agenda está vazia. Adicione um evento ou volte à vista global da equipa.
        </Alert>
      )}

      <Panel flush>
        <div className="week-grid" style={{ gridTemplateColumns: `60px repeat(${visibleDays.length}, minmax(0, 1fr))`, gridTemplateRows: `40px repeat(${slots.length}, 48px)` }}>
          <div className="week-corner" />
          {visibleDays.map(d => (
            <div key={`h-${d.key}`} className="week-day-head">
              <span className="week-day-short">{d.short}</span>
              <span className="week-day-date">{d.date}/05</span>
            </div>
          ))}
          {slots.map(slot => (
            <Fragment key={`row-${slot.idx}`}>
              <div className="week-hour">{slot.label}</div>
              {visibleDays.map(d => (
                <div key={`c-${d.key}-${slot.idx}`} className="week-cell" onClick={() => push({ kind: 'info', title: 'Novo evento', desc: `${d.long} às ${slot.label}` })} role="button" tabIndex={-1} />
              ))}
            </Fragment>
          ))}
          {visibleEvents.map(ev => {
            const pos = placeEvent(ev)
            if (!pos) return null
            const owner = TEAM.find(t => t.id === ev.owner)
            return (
              <button key={`ev-${ev.id}`} type="button" className={`week-event kind-${ev.kind}`} style={pos} onClick={() => push({ kind: 'info', title: ev.label, desc: `${ev.start}-${ev.end} · ${owner?.name || ''}` })} title={`${ev.start}-${ev.end} · ${owner?.name || ''}`}>
                <span className="week-event-time">{ev.start}</span>
                <span className="week-event-label">{ev.label}</span>
                {owner && <span className={`team-dd-avatar sm accent-${owner.accent}`}>{owner.id}</span>}
              </button>
            )
          })}
        </div>
      </Panel>

      <div style={{ marginTop: 16 }}>
        <div className="section-eyebrow">
          <span>{selectedMember ? `Eventos de ${selectedMember.name} esta semana` : 'Eventos da semana'} ({visibleEvents.length})</span>
          <div className="line"></div>
        </div>
      </div>
      <Panel flush>
        {visibleEvents.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--v54-navy-300)', fontSize: 13 }}>Sem eventos esta semana com os filtros atuais.</div>
        ) : visibleEvents.map(ev => {
          const owner = TEAM.find(t => t.id === ev.owner)
          const dayLabel = ALL_DAYS.find(d => d.key === ev.day)?.long || ev.day
          return (
            <div key={ev.id} className="list-row">
              <div className="thumb" style={{ flexDirection: 'column', fontSize: 12, padding: 4, lineHeight: 1.1 }}>
                <div style={{ fontWeight: 700 }}>{ALL_DAYS.find(d => d.key === ev.day)?.short}</div>
                <div style={{ fontSize: 10, color: 'var(--v54-navy-300)' }}>{ev.start}</div>
              </div>
              <div className="info">
                <b>{ev.label}</b>
                <div className="meta">
                  <Pill kind={eventPill(ev.kind)} noDot>{dayLabel}</Pill>
                  {owner && <span className={`team-dd-avatar sm accent-${owner.accent}`} title={owner.name}>{owner.id}</span>}
                  {owner && <span style={{ fontSize: 11.5, color: 'var(--v54-navy-500)' }}>{owner.name}</span>}
                </div>
              </div>
              <div style={{ color: 'var(--v54-navy-500)', fontSize: 12 }}>{ev.start}-{ev.end}</div>
              <button type="button" className={clsx(btnCss.btn, btnCss.sm, btnCss.ghost)} aria-label="Fechar marcação" title="Fechar">×</button>
            </div>
          )
        })}
      </Panel>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} labelledBy="plan-settings-title" size="md">
        <ModalHead icon="cog" id="plan-settings-title" title="Parâmetros de visualização" onClose={() => setSettingsOpen(false)} />
        <form onSubmit={applySettings} noValidate>
          <ModalBody>
            <section className="plan-settings-section">
              <h4 className="plan-settings-label">Dias úteis</h4>
              <p className="plan-settings-hint">Selecione os dias da semana visíveis na agenda.</p>
              <div className="plan-day-toggles" role="group" aria-label="Dias úteis">
                {ALL_DAYS.map(d => {
                  const active = draft.workingDays.includes(d.key)
                  return (
                    <button key={d.key} type="button" className={clsx('plan-day-toggle', active && 'active')} aria-pressed={active ? 'true' : 'false'} onClick={() => toggleDay(d.key)}>{d.short}</button>
                  )
                })}
              </div>
            </section>
            <section className="plan-settings-section">
              <h4 className="plan-settings-label">Horário de trabalho</h4>
              <p className="plan-settings-hint">Intervalo horário visível na grelha semanal.</p>
              <FormRow>
                <Field label="Hora de início" name="plan-start">
                  <select value={draft.startHour} onChange={e => setDraft(d => ({ ...d, startHour: Number(e.target.value) }))}>
                    {Array.from({ length: 24 }, (_, i) => i).map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                  </select>
                </Field>
                <Field label="Hora de fim" name="plan-end">
                  <select value={draft.endHour} onChange={e => setDraft(d => ({ ...d, endHour: Number(e.target.value) }))}>
                    {Array.from({ length: 24 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                  </select>
                </Field>
              </FormRow>
            </section>
            <section className="plan-settings-section">
              <h4 className="plan-settings-label">Duração dos créneaux</h4>
              <p className="plan-settings-hint">Granularidade vertical da grelha.</p>
              <div className="plan-slot-radios" role="radiogroup" aria-label="Duração dos créneaux">
                {([[30, '30 min'], [60, '1 hora'], [120, '2 horas']] as const).map(([min, lbl]) => (
                  <label key={min} className={clsx('plan-slot-radio', draft.slotMinutes === min && 'active')}>
                    <input type="radio" name="slot-minutes" value={min} checked={draft.slotMinutes === min} onChange={() => setDraft(d => ({ ...d, slotMinutes: min }))} />
                    <span>{lbl}</span>
                  </label>
                ))}
              </div>
            </section>
            <Alert kind="gold" icon="info" title="Pré-visualização">
              {draft.workingDays.length} dias visíveis · {draft.startHour}h–{draft.endHour}h · slots de {draft.slotMinutes >= 60 ? (draft.slotMinutes / 60) + 'h' : draft.slotMinutes + 'min'}
            </Alert>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={resetDefaults}>Restaurar predefinições</Button>
            <Button variant="ghost" onClick={() => setSettingsOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)}>Aplicar</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
