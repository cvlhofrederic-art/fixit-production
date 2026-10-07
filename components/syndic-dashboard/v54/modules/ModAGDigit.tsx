'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Pill } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { AG_DIGIT_MESSAGES } from './i18n/ModAGDigit.messages'

/** AG Digitais — port byte-exact V5.7 + Phase 3 : AG réelles (table syndic_assemblees via route v54).
 * Syndic connecté → vraies AG du cabinet (data.assembleias) + création POST ;
 * anonyme → preview (Empty byte-exact + toast démo). */

type AGForm = { titulo: string; edificio: string; dataHora: string; tipo: string; local: string; quorum: number | string; milesimos: number | string; ordem: string }

const fmtDateTime = (v: string, locale: V54Locale) => v ? new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v)) : '—'

export default function ModAGDigit() {
  const t = useMessages(AG_DIGIT_MESSAGES)
  const locale = useV54Locale()
  // Phase 3 : vraies AG du cabinet si syndic connecté, sinon preview vide.
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.assembleias ?? []) : []

  const blank: AGForm = { titulo: '', edificio: '', dataHora: '', tipo: 'ordinaria', local: '', quorum: 50, milesimos: 10000, ordem: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<AGForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof AGForm, string>>>({})
  const [busy, setBusy] = useState(false)
  const { push } = useToast()

  const upd = (k: keyof AGForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof AGForm, string>> = {}
    if (!form.titulo.trim()) errs.titulo = t.erreurs.titre
    if (!form.dataHora) errs.dataHora = t.erreurs.dateHeure
    if (Number(form.quorum) < 0 || Number(form.quorum) > 100) errs.quorum = t.erreurs.seuil
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/ag-v54', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ titulo: form.titulo, edificio: form.edificio, dataHora: form.dataHora, tipo: form.tipo, local: form.local, quorum: Number(form.quorum) || 0, milesimos: Number(form.milesimos) || 0, ordem: form.ordem }),
      })
        .then(r => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: t.toasts.creee, desc: form.titulo }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurCreation, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: t.toasts.creeeDemo, desc: t.toasts.connexionRequise })
  }

  const counts = { total: all.length, emCurso: all.filter(i => i.estado === 'em-curso').length, encerradas: all.filter(i => i.estado === 'encerrada').length }

  const md = t.modal
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau}
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.nouvelleAg}</Button>} />
      <KPIGrid items={[
        { icon: 'bank', num: counts.total, lbl: t.kpi.total },
        { icon: 'clock', num: counts.emCurso, lbl: t.kpi.enCours, accent: counts.emCurso ? 'amber' : undefined },
        { icon: 'check', num: counts.encerradas, lbl: t.kpi.cloturees, accent: counts.encerradas ? 'sage' : undefined },
        { icon: 'poll', num: 0, lbl: t.kpi.resolutions, accent: 'gold' },
      ]} />
      <Panel>
        {all.length === 0 ? (
          <Empty illustration="ag" title={t.vide.titre}
            desc={t.vide.desc}
            action={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.vide.creerPremiere}</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{t.colonnes.titre}</th><th>{t.colonnes.immeuble}</th><th>{t.colonnes.date}</th><th>{t.colonnes.type}</th><th>{t.colonnes.seuil}</th><th>{t.colonnes.statut}</th></tr></thead>
              <tbody>{all.map(it => (
                <tr key={it.id}>
                  <td>{it.titulo}</td>
                  <td>{it.edificio || '—'}</td>
                  <td>{fmtDateTime(it.dataHora, locale)}</td>
                  <td>{t.types[it.tipo === 'ordinaria' ? 'ordinaria' : it.tipo === 'extraordinaria' ? 'extraordinaria' : 'urgente']}</td>
                  <td>{it.quorum}{t.pourcent}</td>
                  <td><Pill kind={it.estado === 'em-curso' ? 'amber' : 'sage'}>{it.estado === 'em-curso' ? t.etats.enCours : t.etats.cloturee}</Pill></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="ag-modal-title" size="lg">
        <ModalHead icon="bank" id="ag-modal-title" title={md.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label={md.champTitre} required full name="ag-titulo" error={errors.titulo}>
              <input type="text" placeholder={md.titrePlaceholder} value={form.titulo} onChange={e => upd('titulo', e.target.value)} />
            </Field>
            <Field label={md.immeuble} full name="ag-edif">
              <input type="text" placeholder={md.immeublePlaceholder} value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={md.dateHeure} required name="ag-data" error={errors.dataHora}>
                <input type="datetime-local" value={form.dataHora} onChange={e => upd('dataHora', e.target.value)} />
              </Field>
              <Field label={md.type} name="ag-tipo">
                <select value={form.tipo} onChange={e => upd('tipo', e.target.value)}>
                  <option value="ordinaria">{md.options.ordinaria}</option>
                  <option value="extraordinaria">{md.options.extraordinaria}</option>
                  <option value="urgente">{md.options.urgente}</option>
                </select>
              </Field>
            </FormRow>
            <Field label={md.lieu} full name="ag-local">
              <input type="text" placeholder={md.lieuPlaceholder} value={form.local} onChange={e => upd('local', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={md.seuil} hint={md.seuilAide} name="ag-quorum" suffix="%" error={errors.quorum}>
                <input type="number" min="0" max="100" value={form.quorum} onChange={e => upd('quorum', e.target.value)} />
              </Field>
              <Field label={md.tantiemes} hint={md.tantiemesAide} name="ag-miles">
                <input type="number" min="0" value={form.milesimos} onChange={e => upd('milesimos', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={md.ordreDuJour} hint={md.ordreDuJourAide} full name="ag-ordem">
              <textarea rows={5} placeholder={md.ordreDuJourPlaceholder} value={form.ordem} onChange={e => upd('ordem', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{md.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{md.creer}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
