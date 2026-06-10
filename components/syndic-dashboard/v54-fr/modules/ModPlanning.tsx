'use client'

// Planning — port du ModPlaneamento du mockup v8 FR (route « planning »),
// agenda hebdomadaire CSS-grid. Reprend exactement les classes globales du
// module PT (components/syndic-dashboard/v54/modules/planeamento.css, scopé
// #syndic-dashboard-v54, chargé par le layout) : team-dd-*, week-*, plan-*,
// list-row/thumb/info/meta, section-eyebrow. Données et textes du mockup FR.

import { useState, useEffect, useRef, Fragment, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Alert } from '@/components/syndic-dashboard/v54/primitives/alert'
import { Pill, type PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '@/components/syndic-dashboard/v54/primitives/modal'
import { Field } from '@/components/syndic-dashboard/v54/primitives/field'
import FormRow from '@/components/syndic-dashboard/v54/primitives/form-row/FormRow'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import btnCss from '@/components/syndic-dashboard/v54/primitives/button/Button.module.css'
import { onKeyActivate } from '../lib/format'

type Member = { id: string; name: string; role: string; accent: string }
type Day = { key: string; short: string; long: string; date: string }
type WeekEvent = { id: number; day: string; start: string; end: string; label: string; kind: string; owner: string }
type Settings = { workingDays: string[]; startHour: number; endHour: number; slotMinutes: number }

const PLAN_TEAM: Member[] = [
  { id: 'CD', name: 'Cabinet Delaunay', role: 'Direction', accent: 'gold' },
  { id: 'AD', name: 'Awa Diallo', role: 'Gestionnaire', accent: 'sage' },
  { id: 'ML', name: 'Marc Léautaud', role: 'Gestionnaire', accent: 'sage' },
  { id: 'CN', name: 'Camille Noël', role: 'Juriste', accent: 'amber' },
  { id: 'JM', name: 'Julien Marchand', role: 'Comptable', accent: 'sage' },
  { id: 'SV', name: 'Sophie Vidal', role: 'Assistante', accent: 'sage' },
]
const PLAN_DAYS: Day[] = [
  { key: 'mon', short: 'Lun', long: 'Lundi', date: '08' },
  { key: 'tue', short: 'Mar', long: 'Mardi', date: '09' },
  { key: 'wed', short: 'Mer', long: 'Mercredi', date: '10' },
  { key: 'thu', short: 'Jeu', long: 'Jeudi', date: '11' },
  { key: 'fri', short: 'Ven', long: 'Vendredi', date: '12' },
  { key: 'sat', short: 'Sam', long: 'Samedi', date: '13' },
  { key: 'sun', short: 'Dim', long: 'Dimanche', date: '14' },
]
const PLAN_EVENTS: WeekEvent[] = [
  { id: 1, day: 'mon', start: '09:00', end: '10:30', label: 'Convocation AG — Le Clos des Vignes', kind: 'gold', owner: 'CN' },
  { id: 2, day: 'mon', start: '14:00', end: '16:00', label: 'Visite technique — Les Tilleuls (toiture)', kind: 'sage', owner: 'ML' },
  { id: 3, day: 'tue', start: '10:00', end: '11:00', label: 'Conseil syndical — Le Méridien', kind: 'gold', owner: 'AD' },
  { id: 4, day: 'tue', start: '15:00', end: '16:00', label: 'Mise en demeure — SCI Belvédère', kind: 'amber', owner: 'JM' },
  { id: 5, day: 'wed', start: '09:00', end: '11:00', label: 'Inspection ascenseur — Le Méridien', kind: 'amber', owner: 'ML' },
  { id: 6, day: 'wed', start: '15:00', end: '16:30', label: 'Réunion copropriétaires — Villa Montaigne', kind: 'gold', owner: 'CN' },
  { id: 7, day: 'thu', start: '08:30', end: '09:30', label: 'Notification ordonnance — Villa Montaigne', kind: 'sage', owner: 'SV' },
  { id: 8, day: 'thu', start: '11:00', end: '12:00', label: 'Rapprochement bancaire (compte séparé)', kind: 'amber', owner: 'JM' },
  { id: 9, day: 'thu', start: '16:00', end: '17:00', label: 'Dépôt requête en prorogation — Les Tilleuls', kind: 'rust', owner: 'CN' },
  { id: 10, day: 'fri', start: '10:00', end: '12:00', label: 'AG élective — Le Clos des Vignes', kind: 'gold', owner: 'CD' },
  { id: 11, day: 'fri', start: '15:00', end: '16:00', label: 'État de frais & taxation — Le Méridien', kind: 'amber', owner: 'JM' },
  { id: 12, day: 'sat', start: '10:00', end: '11:30', label: "Réunion d'information copropriétaires", kind: 'rust', owner: 'AD' },
]
const PLAN_DEFAULTS: Settings = { workingDays: ['mon', 'tue', 'wed', 'thu', 'fri'], startHour: 8, endHour: 19, slotMinutes: 60 }
const KIND_PILL: Record<string, PillKind> = { gold: 'gold', sage: 'sage', amber: 'amber', rust: 'rust', green: 'sage' }
const parseMin = (t: string) => { const [h, mi] = t.split(':').map(Number); return h * 60 + mi }
const slotLabel = (min: number) => (min >= 60 ? min / 60 + 'h' : min + 'min')

export default function ModPlanning() {
  const { push } = useToast()
  const [settings, setSettings] = useState<Settings>(PLAN_DEFAULTS)
  const [draft, setDraft] = useState<Settings>(PLAN_DEFAULTS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const dropdownBtnRef = useRef<HTMLButtonElement>(null)
  const selectedMember = selectedMemberId ? PLAN_TEAM.find((m) => m.id === selectedMemberId) || null : null

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
    const m = memberId ? PLAN_TEAM.find((x) => x.id === memberId) : null
    push({ kind: 'info', title: m ? `Agenda de ${m.name}` : "Toute l'équipe", desc: m ? `Événements de ${m.role}` : 'Tous les événements du cabinet' })
  }
  const openSettings = () => { setDraft(settings); setSettingsOpen(true) }
  const applySettings = (e: FormEvent) => {
    e.preventDefault()
    if (draft.endHour <= draft.startHour) { push({ kind: 'info', title: 'Horaire invalide', desc: "L'heure de fin doit suivre l'heure de début." }); return }
    if (draft.workingDays.length === 0) { push({ kind: 'info', title: 'Aucun jour ouvré', desc: 'Sélectionnez au moins un jour.' }); return }
    setSettings(draft)
    setSettingsOpen(false)
    push({ kind: 'success', title: 'Affichage mis à jour', desc: `${draft.workingDays.length} jours · ${draft.startHour}h-${draft.endHour}h · créneaux de ${slotLabel(draft.slotMinutes)}` })
  }
  const toggleDay = (dayKey: string) => {
    setDraft((d) => ({ ...d, workingDays: d.workingDays.includes(dayKey) ? d.workingDays.filter((k) => k !== dayKey) : [...d.workingDays, dayKey] }))
  }

  const visibleDays = PLAN_DAYS.filter((d) => settings.workingDays.includes(d.key))
  const slots: { idx: number; label: string }[] = []
  for (let totalMin = settings.startHour * 60; totalMin < settings.endHour * 60; totalMin += settings.slotMinutes) {
    const h = Math.floor(totalMin / 60); const mi = totalMin % 60
    slots.push({ idx: slots.length, label: `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}` })
  }
  const visibleEvents = PLAN_EVENTS.filter((ev) => {
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
    const colIdx = visibleDays.findIndex((d) => d.key === ev.day)
    if (colIdx < 0) return null
    return { gridColumn: colIdx + 2, gridRow: `${Math.floor(startSlot) + 2} / ${Math.ceil(endSlot) + 2}` } as const
  }

  return (
    <>
      <PageHead
        eyebrow="Gestion courante"
        title={selectedMember ? `Agenda de ${selectedMember.name}` : 'Planning'}
        lede={selectedMember
          ? `${selectedMember.role} · ${visibleDays.length} jours affichés · ${slots.length} créneaux`
          : `Vue hebdomadaire · semaine du 8 au 14 juin 2026 · créneaux de ${slotLabel(settings.slotMinutes)}`}
        actions={
          <>
            <div className="team-dd-wrap" ref={dropdownRef}>
              <button ref={dropdownBtnRef} type="button" className={clsx(btnCss.btn, 'team-dd-btn')} aria-haspopup="menu" aria-expanded={dropdownOpen ? 'true' : 'false'} onClick={() => setDropdownOpen((o) => !o)}>
                {selectedMember ? (
                  <>
                    <span className={`team-dd-avatar accent-${selectedMember.accent}`}>{selectedMember.id}</span>
                    <span className="team-dd-label">{selectedMember.name}</span>
                  </>
                ) : (
                  <>
                    <Icon name="team" />
                    <span className="team-dd-label">Toute l&apos;équipe</span>
                  </>
                )}
                <Icon name="chevron" />
              </button>
              {dropdownOpen && (
                <div className="team-dd-menu" role="menu" aria-label="Sélectionner un collaborateur">
                  <button type="button" role="menuitem" className={clsx('team-dd-item', !selectedMemberId && 'active')} onClick={() => selectMember(null)}>
                    <span className="team-dd-item-icon"><Icon name="team" /></span>
                    <span className="team-dd-item-info">
                      <span className="team-dd-item-name">Toute l&apos;équipe</span>
                      <span className="team-dd-item-role">{PLAN_TEAM.length} collaborateurs</span>
                    </span>
                  </button>
                  <div className="team-dd-sep" role="separator" />
                  {PLAN_TEAM.map((m) => (
                    <button key={m.id} type="button" role="menuitem" className={clsx('team-dd-item', selectedMemberId === m.id && 'active')} onClick={() => selectMember(m.id)}>
                      <span className={`team-dd-avatar accent-${m.accent}`}>{m.id}</span>
                      <span className="team-dd-item-info">
                        <span className="team-dd-item-name">{m.name}</span>
                        <span className="team-dd-item-role">{m.role}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button onClick={openSettings}><Icon name="wrench" />Réglages</Button>
            <Button variant="gold" onClick={() => push({ kind: 'info', title: 'Nouvel événement', desc: 'Intervention, visite, AG, conseil syndical…' })}><Icon name="plus" />Ajouter</Button>
          </>
        }
      />

      {visibleEvents.length === 0 && selectedMember && (
        <Alert icon="calendar" title={`Aucun événement pour ${selectedMember.name} cette semaine`}>
          Revenez à la vue globale de l&apos;équipe ou ajoutez un événement.
        </Alert>
      )}

      <Panel flush>
        <div className="week-grid" style={{ gridTemplateColumns: `60px repeat(${visibleDays.length}, minmax(0, 1fr))`, gridTemplateRows: `40px repeat(${slots.length}, 48px)` }}>
          <div className="week-corner" />
          {visibleDays.map((d) => (
            <div key={`h-${d.key}`} className="week-day-head">
              <span className="week-day-short">{d.short}</span>
              <span className="week-day-date">{d.date}/06</span>
            </div>
          ))}
          {slots.map((slot) => (
            <Fragment key={`row-${slot.idx}`}>
              <div className="week-hour">{slot.label}</div>
              {visibleDays.map((d) => (
                <div key={`c-${d.key}-${slot.idx}`} className="week-cell" role="button" tabIndex={-1} aria-label={`Nouvel événement ${d.long} à ${slot.label}`} onClick={() => push({ kind: 'info', title: 'Nouvel événement', desc: `${d.long} à ${slot.label}` })} onKeyDown={onKeyActivate(() => push({ kind: 'info', title: 'Nouvel événement', desc: `${d.long} à ${slot.label}` }))} />
              ))}
            </Fragment>
          ))}
          {visibleEvents.map((ev) => {
            const pos = placeEvent(ev)
            if (!pos) return null
            const owner = PLAN_TEAM.find((t) => t.id === ev.owner)
            return (
              <button key={`ev-${ev.id}`} type="button" className={`week-event kind-${ev.kind}`} style={pos} onClick={() => push({ kind: 'info', title: ev.label, desc: `${ev.start}-${ev.end} · ${owner ? owner.name : ''}` })} title={`${ev.start}-${ev.end} · ${owner ? owner.name : ''}`}>
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
          <span>{selectedMember ? `Événements de ${selectedMember.name} cette semaine` : 'Événements de la semaine'} ({visibleEvents.length})</span>
          <div className="line"></div>
        </div>
      </div>
      <Panel flush>
        {visibleEvents.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--v54-navy-300)', fontSize: 13 }}>Aucun événement cette semaine avec les filtres actuels.</div>
        ) : visibleEvents.map((ev) => {
          const owner = PLAN_TEAM.find((t) => t.id === ev.owner)
          const dayLabel = PLAN_DAYS.find((d) => d.key === ev.day)
          return (
            <div key={ev.id} className="list-row">
              <div className="thumb" style={{ flexDirection: 'column', fontSize: 12, padding: 4, lineHeight: 1.1 }}>
                <div style={{ fontWeight: 700 }}>{dayLabel && dayLabel.short}</div>
                <div style={{ fontSize: 10, color: 'var(--v54-navy-300)' }}>{ev.start}</div>
              </div>
              <div className="info">
                <b>{ev.label}</b>
                <div className="meta">
                  <Pill kind={KIND_PILL[ev.kind]} noDot>{dayLabel && dayLabel.long}</Pill>
                  {owner && <span className={`team-dd-avatar sm accent-${owner.accent}`} title={owner.name}>{owner.id}</span>}
                  {owner && <span style={{ fontSize: 11.5, color: 'var(--v54-navy-500)' }}>{owner.name}</span>}
                </div>
              </div>
              <div style={{ color: 'var(--v54-navy-500)', fontSize: 12 }}>{ev.start}-{ev.end}</div>
            </div>
          )
        })}
      </Panel>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} size="md" labelledBy="plan-set-t">
        <ModalHead id="plan-set-t" icon="wrench" title="Réglages d'affichage" onClose={() => setSettingsOpen(false)} closeLabel="Fermer" />
        <form onSubmit={applySettings} noValidate>
          <ModalBody>
            <section className="plan-settings-section">
              <h4 className="plan-settings-label">Jours ouvrés affichés</h4>
              <div className="plan-day-toggles" role="group" aria-label="Jours ouvrés affichés">
                {PLAN_DAYS.map((d) => {
                  const active = draft.workingDays.includes(d.key)
                  return (
                    <button key={d.key} type="button" className={clsx('plan-day-toggle', active && 'active')} aria-pressed={active ? 'true' : 'false'} onClick={() => toggleDay(d.key)}>{d.short}</button>
                  )
                })}
              </div>
            </section>
            <section className="plan-settings-section">
              <h4 className="plan-settings-label">Plage horaire</h4>
              <FormRow>
                <Field label="Heure de début" name="plan-start">
                  <select value={draft.startHour} onChange={(e) => setDraft((d) => ({ ...d, startHour: Number(e.target.value) }))}>
                    {[6, 7, 8, 9, 10, 11].map((h) => <option key={h} value={h}>{h}h</option>)}
                  </select>
                </Field>
                <Field label="Heure de fin" name="plan-end">
                  <select value={draft.endHour} onChange={(e) => setDraft((d) => ({ ...d, endHour: Number(e.target.value) }))}>
                    {[16, 17, 18, 19, 20, 21, 22].map((h) => <option key={h} value={h}>{h}h</option>)}
                  </select>
                </Field>
              </FormRow>
            </section>
            <section className="plan-settings-section">
              <h4 className="plan-settings-label">Durée des créneaux</h4>
              <div className="plan-slot-radios" role="radiogroup" aria-label="Durée des créneaux">
                {[30, 60, 120].map((v) => (
                  <label key={v} className={clsx('plan-slot-radio', draft.slotMinutes === v && 'active')}>
                    <input type="radio" name="slot-minutes" value={v} checked={draft.slotMinutes === v} onChange={() => setDraft((d) => ({ ...d, slotMinutes: v }))} />
                    <span>{slotLabel(v)}</span>
                  </label>
                ))}
              </div>
              <div className="plan-settings-hint">Affecte la hauteur des lignes et le calage des événements.</div>
            </section>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setDraft(PLAN_DEFAULTS)}>Réinitialiser</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)}>Appliquer</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
