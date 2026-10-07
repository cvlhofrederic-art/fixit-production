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
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Evento } from '@/lib/syndic/v54/api'
import { useSyndicCreate } from './use-syndic-create'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { PLANEAMENTO_MESSAGES, type EvenementPlanning } from './i18n/ModPlaneamento.messages'

/** Planeamento — port byte-exact du ModPlaneamento du bundle V5.7 (agenda semaine, stateful).
 * CSS bespoke dans ./planeamento.css (scopé #syndic-dashboard-v54), importé dans le layout dev.
 * Icônes chevron-up/down absentes du bundle (fallback doc) → on utilise chevronDown (affordance correcte). */

type WeekEvent = EvenementPlanning
type Settings = { workingDays: string[]; startHour: number; endHour: number; slotMinutes: number }

const DEFAULTS: Settings = { workingDays: ['mon', 'tue', 'wed', 'thu', 'fri'], startHour: 8, endHour: 19, slotMinutes: 60 }
const eventPill = (k: string): PillKind => (k === 'green' ? 'sage' : k === 'gold' ? 'gold' : k === 'amber' ? 'amber' : k === 'rust' ? 'rust' : 'sage')
const parseMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }

export default function ModPlaneamento() {
  const t = useMessages(PLANEAMENTO_MESSAGES)
  const TEAM = t.team
  const ALL_DAYS = t.jours
  const WEEK_EVENTS = t.demo
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [draft, setDraft] = useState<Settings>(DEFAULTS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const dropdownBtnRef = useRef<HTMLButtonElement>(null)
  const { push } = useToast()
  const data = useSyndicData()
  const real = data.authenticated
  const { busy: evtBusy, create: createEvt } = useSyndicCreate('/api/syndic/eventos')
  // Connecté → vrais événements du cabinet placés sur la grille ; anonyme → preview byte-exact.
  const events: WeekEvent[] = real
    ? (data.eventos ?? []).map((e: Evento) => ({ id: e.id, day: e.dia, start: e.horaInicio, end: e.horaFim, label: e.titulo, kind: e.tipo, owner: '' }))
    : WEEK_EVENTS
  const [evtOpen, setEvtOpen] = useState(false)
  const [evtForm, setEvtForm] = useState({ titulo: '', dia: 'mon', horaInicio: '09:00', horaFim: '10:00', tipo: 'gold', responsavel: '', edificio: '' })
  const updEvt = (k: keyof typeof evtForm, v: string) => setEvtForm(s => ({ ...s, [k]: v }))
  const openEvt = () => { setEvtForm({ titulo: '', dia: 'mon', horaInicio: '09:00', horaFim: '10:00', tipo: 'gold', responsavel: '', edificio: '' }); setEvtOpen(true) }
  const submitEvt = (e: FormEvent) => {
    e.preventDefault()
    if (!evtForm.titulo.trim()) return
    createEvt({ ...evtForm }, { okTitle: t.toasts.evenementAjoute, desc: evtForm.titulo, onDone: () => setEvtOpen(false) })
  }

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
    push({ kind: 'info', title: m ? t.agendaDe(m.name) : t.toasts.toutEquipe, desc: m ? t.toasts.membreDesc(m.role) : t.toasts.toutEquipeDesc })
  }
  const openSettings = () => { setDraft(settings); setSettingsOpen(true) }
  const applySettings = (e: FormEvent) => {
    e.preventDefault()
    if (draft.endHour <= draft.startHour) { push({ kind: 'warning', title: t.toasts.horaireInvalide, desc: t.toasts.horaireInvalideDesc }); return }
    if (draft.workingDays.length === 0) { push({ kind: 'warning', title: t.toasts.aucunJour, desc: t.toasts.aucunJourDesc }); return }
    setSettings(draft)
    setSettingsOpen(false)
    push({ kind: 'success', title: t.toasts.affichageMisAJour, desc: t.toasts.affichageMisAJourDesc(draft.workingDays.length, draft.startHour, draft.endHour, t.creneau(draft.slotMinutes)) })
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
  const visibleEvents = events.filter(ev => {
    if (selectedMemberId && ev.owner && ev.owner !== selectedMemberId) return false
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

  const fe = t.evenement
  const r = t.reglages
  return (
    <>
      <PageHead
        title={selectedMember ? t.agendaDe(selectedMember.name) : t.titre}
        lede={selectedMember
          ? t.chapeauMembre(selectedMember.role, visibleDays.length, slots.length)
          : t.chapeau(visibleDays.length, t.creneau(settings.slotMinutes))}
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
                    <span className="team-dd-label">{t.equipe.toute}</span>
                  </>
                )}
                <Icon name="chevronDown" />
              </button>
              {dropdownOpen && (
                <div className="team-dd-menu" role="menu" aria-label={t.equipe.menuAria}>
                  <button type="button" role="menuitem" className={clsx('team-dd-item', !selectedMemberId && 'active')} onClick={() => selectMember(null)}>
                    <span className="team-dd-item-icon"><Icon name="team" /></span>
                    <span className="team-dd-item-info">
                      <span className="team-dd-item-name">{t.equipe.toute}</span>
                      <span className="team-dd-item-role">{TEAM.length}{t.equipe.resume(TEAM.length)}</span>
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
            <Button onClick={openSettings}><Icon name="cog" />{t.boutons.affichage}</Button>
            <Button variant="ghost" onClick={() => push({ kind: 'info', title: t.toasts.semainePrecedente })}>←</Button>
            <Button variant="ghost" onClick={() => push({ kind: 'info', title: t.toasts.cetteSemaine })}>{t.boutons.aujourdhui}</Button>
            <Button variant="ghost" onClick={() => push({ kind: 'info', title: t.toasts.semaineSuivante })}>→</Button>
            <Button variant="gold" onClick={openEvt}><Icon name="plus" />{t.boutons.ajouter}</Button>
          </>
        }
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <button type="button" className="chip" style={{ background: 'var(--v54-navy-900)', color: '#fff', borderColor: 'var(--v54-navy-900)' }}>{t.types.reunion}</button>
        <button type="button" className="chip" style={{ background: 'var(--v54-sage-50)', color: 'var(--v54-sage-700)', borderColor: 'transparent' }}>{t.types.visite}</button>
        <button type="button" className="chip" style={{ background: 'var(--v54-amber-100)', color: 'var(--v54-amber-700)', borderColor: 'transparent' }}>{t.types.tache}</button>
        <button type="button" className="chip" style={{ background: 'var(--v54-gold-50)', color: 'var(--v54-gold-700)', borderColor: 'transparent' }}>{t.types.mission}</button>
        <button type="button" className="chip">{t.types.autre}</button>
      </div>

      {visibleEvents.length === 0 && selectedMember && (
        <Alert icon="info" title={t.alerteVide.titre(selectedMember.name)}>
          {t.alerteVide.texte}
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
                <div key={`c-${d.key}-${slot.idx}`} className="week-cell" onClick={() => push({ kind: 'info', title: t.toasts.nouvelEvenement, desc: t.toasts.jourA(d.long, slot.label) })} role="button" tabIndex={-1} />
              ))}
            </Fragment>
          ))}
          {visibleEvents.map(ev => {
            const pos = placeEvent(ev)
            if (!pos) return null
            const owner = TEAM.find(mb => mb.id === ev.owner)
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
          <span>{selectedMember ? t.liste.titreMembre(selectedMember.name) : t.liste.titre} ({visibleEvents.length})</span>
          <div className="line"></div>
        </div>
      </div>
      <Panel flush>
        {visibleEvents.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--v54-navy-300)', fontSize: 13 }}>{t.liste.vide}</div>
        ) : visibleEvents.map(ev => {
          const owner = TEAM.find(mb => mb.id === ev.owner)
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
              <button type="button" className={clsx(btnCss.btn, btnCss.sm, btnCss.ghost)} aria-label={t.liste.fermerAria} title={t.liste.fermerTitre}>×</button>
            </div>
          )
        })}
      </Panel>

      <Modal open={evtOpen} onClose={() => setEvtOpen(false)} labelledBy="evt-modal-title" size="md">
        <ModalHead icon="calendar" id="evt-modal-title" title={fe.titre} onClose={() => setEvtOpen(false)} />
        <form onSubmit={submitEvt} noValidate>
          <ModalBody>
            <Field label={fe.champTitre} required full name="evt-titulo">
              <input type="text" placeholder={fe.titrePlaceholder} value={evtForm.titulo} onChange={e => updEvt('titulo', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={fe.jour} name="evt-dia">
                <select value={evtForm.dia} onChange={e => updEvt('dia', e.target.value)}>
                  {ALL_DAYS.map(d => <option key={d.key} value={d.key}>{d.long}</option>)}
                </select>
              </Field>
              <Field label={fe.type} name="evt-tipo">
                <select value={evtForm.tipo} onChange={e => updEvt('tipo', e.target.value)}>
                  <option value="gold">{fe.types.gold}</option>
                  <option value="sage">{fe.types.sage}</option>
                  <option value="amber">{fe.types.amber}</option>
                  <option value="green">{fe.types.green}</option>
                  <option value="rust">{fe.types.rust}</option>
                </select>
              </Field>
            </FormRow>
            <FormRow>
              <Field label={fe.heureDebut} name="evt-hi">
                <input type="time" value={evtForm.horaInicio} onChange={e => updEvt('horaInicio', e.target.value)} />
              </Field>
              <Field label={fe.heureFin} name="evt-hf">
                <input type="time" value={evtForm.horaFim} onChange={e => updEvt('horaFim', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={fe.responsable} name="evt-resp">
                <input type="text" placeholder={fe.responsablePlaceholder} value={evtForm.responsavel} onChange={e => updEvt('responsavel', e.target.value)} />
              </Field>
              <Field label={fe.immeuble} name="evt-edif">
                <input type="text" placeholder={fe.immeublePlaceholder} value={evtForm.edificio} onChange={e => updEvt('edificio', e.target.value)} />
              </Field>
            </FormRow>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setEvtOpen(false)}>{fe.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={evtBusy}>{fe.ajouter}</button>
          </ModalFoot>
        </form>
      </Modal>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} labelledBy="plan-settings-title" size="md">
        <ModalHead icon="cog" id="plan-settings-title" title={r.titre} onClose={() => setSettingsOpen(false)} />
        <form onSubmit={applySettings} noValidate>
          <ModalBody>
            <section className="plan-settings-section">
              <h4 className="plan-settings-label">{r.jours}</h4>
              <p className="plan-settings-hint">{r.joursAide}</p>
              <div className="plan-day-toggles" role="group" aria-label={r.jours}>
                {ALL_DAYS.map(d => {
                  const active = draft.workingDays.includes(d.key)
                  return (
                    <button key={d.key} type="button" className={clsx('plan-day-toggle', active && 'active')} aria-pressed={active ? 'true' : 'false'} onClick={() => toggleDay(d.key)}>{d.short}</button>
                  )
                })}
              </div>
            </section>
            <section className="plan-settings-section">
              <h4 className="plan-settings-label">{r.horaires}</h4>
              <p className="plan-settings-hint">{r.horairesAide}</p>
              <FormRow>
                <Field label={r.heureDebut} name="plan-start">
                  <select value={draft.startHour} onChange={e => setDraft(d => ({ ...d, startHour: Number(e.target.value) }))}>
                    {Array.from({ length: 24 }, (_, i) => i).map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                  </select>
                </Field>
                <Field label={r.heureFin} name="plan-end">
                  <select value={draft.endHour} onChange={e => setDraft(d => ({ ...d, endHour: Number(e.target.value) }))}>
                    {Array.from({ length: 24 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                  </select>
                </Field>
              </FormRow>
            </section>
            <section className="plan-settings-section">
              <h4 className="plan-settings-label">{r.duree}</h4>
              <p className="plan-settings-hint">{r.dureeAide}</p>
              <div className="plan-slot-radios" role="radiogroup" aria-label={r.duree}>
                {([30, 60, 120] as const).map((min) => (
                  <label key={min} className={clsx('plan-slot-radio', draft.slotMinutes === min && 'active')}>
                    <input type="radio" name="slot-minutes" value={min} checked={draft.slotMinutes === min} onChange={() => setDraft(d => ({ ...d, slotMinutes: min }))} />
                    <span>{r.durees[min]}</span>
                  </label>
                ))}
              </div>
            </section>
            <Alert kind="gold" icon="info" title={r.apercu}>
              {draft.workingDays.length}{r.apercuJours(draft.workingDays.length)}{draft.startHour}{r.apercuHeureDebut}{draft.endHour}{r.apercuHeureFin}{t.creneau(draft.slotMinutes)}
            </Alert>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={resetDefaults}>{r.restaurer}</Button>
            <Button variant="ghost" onClick={() => setSettingsOpen(false)}>{r.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)}>{r.appliquer}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
