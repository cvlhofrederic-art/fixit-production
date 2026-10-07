'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import { Tabs } from '../primitives/tabs'
import { Button } from '../primitives/button'
import { Empty } from '../primitives/empty'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import btnCss from '../primitives/button/Button.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages } from '@/lib/syndic/v54/i18n'
import type { Reserva } from '@/lib/syndic/v54/api'
import { RESERVA_ESP_MESSAGES, type EstadoReserva } from './i18n/ModReservaEsp.messages'

/** Reserva de Espaços Comuns — port byte-exact V5.7 (calendrier + légende) + lot fonctionnel.
 * Calendrier/légende = design showcase statique ; « Próximas reservas » = data réelle du
 * cabinet (data.reservas) + création POST. Anonyme → preview byte-exact. */

type ResForm = { espaco: string; quem: string; data: string; hora: string; estado: Reserva['estado']; notes: string }

const estadoKind = (v: string): PillKind => (({ confirmada: 'sage', pendente: 'amber', cancelada: 'rust' } as Record<string, PillKind>)[v] || 'amber')
/** Icône flamme si le nom de l'espace désigne un barbecue (mots du dictionnaire de la langue courante). */
const reservaIcon = (espaco: string, motsBarbecue: readonly string[]): IconName => (motsBarbecue.some((mot) => espaco.includes(mot)) ? 'flame' : 'doc')

/** Légende : espaces dans l'ordre d'affichage, avec leur couleur (identique dans toutes les langues). */
const LEGENDA: ReadonlyArray<readonly ['salao' | 'churrasqueira' | 'campo' | 'piscina' | 'ginasio' | 'sala', string]> = [
  ['salao', 'var(--v54-gold-500)'],
  ['churrasqueira', 'var(--v54-rust-500)'],
  ['campo', 'var(--v54-sage-500)'],
  ['piscina', 'var(--v54-sage-700)'],
  ['ginasio', 'var(--v54-amber-500)'],
  ['sala', 'var(--v54-gold-700)'],
]

const DAYS = [0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]

export default function ModReservaEsp() {
  const t = useMessages(RESERVA_ESP_MESSAGES)
  const data = useSyndicData()
  const real = data.authenticated
  const all: Reserva[] = real ? (data.reservas ?? []) : t.demo
  const estadoLabel = (v: string) => t.estados[v as EstadoReserva] || v
  const ev = t.evenements

  const blank: ResForm = { espaco: '', quem: '', data: '', hora: '', estado: 'pendente', notes: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ResForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof ResForm, string>>>({})
  const [busy, setBusy] = useState(false)
  const { push } = useToast()

  const upd = (k: keyof ResForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.espaco.trim()) { setErrors({ espaco: t.erreurs.espace }); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ espaco: form.espaco, quem: form.quem, data: form.data || null, hora: form.hora, estado: form.estado, notes: form.notes }),
      })
        .then(r => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: t.toasts.creee, desc: form.espaco }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurCreation, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: t.toasts.creeeDemo, desc: t.toasts.connexionRequise })
  }

  const f = t.formulaire
  return (
    <>
      <PageHead
        title={t.titre}
        lede={t.chapeau}
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.nouvelleReserva}</Button>}
      />
      <Tabs defaultActive="cal" tabs={[
        { id: 'cal', icon: 'calendar', label: t.onglets.cal },
        { id: 'esp', icon: 'home', label: t.onglets.esp },
        { id: 'reg', icon: 'clipboard', label: t.onglets.reg },
        { id: 'rel', icon: 'chart', label: t.onglets.rel },
      ]} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        {LEGENDA.map((l, i) => (
          <Pill key={i} noDot>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: l[1], display: 'inline-block', marginRight: 4 }}></span>{t.legende[l[0]]}
          </Pill>
        ))}
        <div style={{ flex: 1 }}></div>
        <Button variant="ghost" aria-label={t.moisPrecedent} title={t.moisPrecedent} onClick={() => push({ kind: 'info', title: t.moisPrecedent, desc: t.navigationBientot })}>←</Button>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, padding: '8px 16px' }}>{t.moisAffiche}</div>
        <Button variant="ghost" aria-label={t.moisSuivant} title={t.moisSuivant} onClick={() => push({ kind: 'info', title: t.moisSuivant, desc: t.navigationBientot })}>→</Button>
        <Button onClick={() => push({ kind: 'info', title: t.aujourdhui, desc: t.semaineActuelle })}>{t.aujourdhui}</Button><Button onClick={() => push({ kind: 'info', title: t.vueSemaine, desc: t.bientot })}>{t.semaine}</Button><Button variant="primary" onClick={() => push({ kind: 'info', title: t.vueMois, desc: t.vueActive })}>{t.mois}</Button>
      </div>
      <Panel flush>
        <div className="calendar">
          {t.jours.map(d => <div key={d} className="dow">{d}</div>)}
          {DAYS.map((n, i) => (
            <div key={i} className={`day ${n === 24 ? 'today' : ''} ${n === 0 ? 'muted' : ''}`}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{n || ''}</div>
              {n === 6 && <div className="ev green">{`12:00 ${ev.piscina}`}</div>}
              {n === 7 && <><div className="ev gold">{`13:00 ${ev.salao}`}</div><div className="ev green">{`14:00 ${ev.piscina}`}</div></>}
              {n === 8 && <div className="ev green">{`16:00 ${ev.campo}`}</div>}
              {n === 11 && <><div className="ev gold">{`10:00 ${ev.salao}`}</div><div className="ev green">{`15:00 ${ev.piscina}`}</div></>}
              {n === 19 && <div className="ev green">{`13:00 ${ev.piscina}`}</div>}
              {n === 22 && <><div className="ev green">{`15:00 ${ev.piscina}`}</div><div className="ev amber">{`15:00 ${ev.ginasio}`}</div></>}
              {n === 23 && <><div className="ev green">{`09:00 ${ev.piscina}`}</div><div className="ev amber">{`13:00 ${ev.churrasqueira}`}</div></>}
              {n === 24 && <div className="ev amber">{`09:00 ${ev.ginasio}`}</div>}
              {n === 26 && <div className="ev rust">{`10:00 ${ev.sala}`}</div>}
              {n === 28 && <div className="ev amber">{`10:00 ${ev.churrasqueira}`}</div>}
              {n === 31 && <><div className="ev amber">{`15:00 ${ev.churrasqueira}`}</div><div className="ev rust">{`15:00 ${ev.sala}`}</div></>}
            </div>
          ))}
        </div>
      </Panel>
      <Panel title={t.prochaines} flush>
        {real && all.length === 0 ? (
          <Empty illustration="documentos" title={t.aucuneReservation} desc={t.aucuneReservationDesc}
            action={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.nouvelleReserva}</Button>} />
        ) : (
          all.map((r, i) => (
            <div key={r.id} style={{ padding: '14px 22px', borderBottom: i < all.length - 1 ? '1px solid var(--v54-line)' : 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)' }}><Icon name={reservaIcon(r.espaco, t.motsBarbecue)} /></div>
              <div style={{ flex: 1 }}><b>{r.espaco}</b><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{r.quem}</div></div>
              <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 600 }}>{r.data}</div><div style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>{r.hora}</div></div>
              <Pill kind={estadoKind(r.estado)} noDot>{estadoLabel(r.estado)}</Pill>
              <Button variant="danger" size="sm" onClick={() => push({ kind: 'info', title: t.annulerReservation, desc: real ? t.annulationBientot : t.connexionSyndic })}>{t.annuler}</Button>
            </div>
          ))
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="res-modal-title" size="md">
        <ModalHead icon="calendar" id="res-modal-title" title={f.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label={f.espace} required full name="res-espaco" error={errors.espaco}>
              <input type="text" placeholder={f.espaceExemple} value={form.espaco} onChange={e => upd('espaco', e.target.value)} />
            </Field>
            <Field label={f.reservePar} full name="res-quem">
              <input type="text" placeholder={f.reserveParPlaceholder} value={form.quem} onChange={e => upd('quem', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={f.date} name="res-data">
                <input type="date" value={form.data} onChange={e => upd('data', e.target.value)} />
              </Field>
              <Field label={f.horaire} name="res-hora">
                <input type="text" placeholder="10:00 - 13:00" value={form.hora} onChange={e => upd('hora', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={f.statut} name="res-estado">
              <select value={form.estado} onChange={e => upd('estado', e.target.value)}>
                <option value="pendente">{t.estados.pendente}</option>
                <option value="confirmada">{t.estados.confirmada}</option>
                <option value="cancelada">{t.estados.cancelada}</option>
              </select>
            </Field>
            <Field label={f.notes} full name="res-notes">
              <textarea rows={3} value={form.notes} onChange={e => upd('notes', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{f.creer}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
