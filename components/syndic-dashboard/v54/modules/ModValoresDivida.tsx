'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPI } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
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
import kpiCss from '../primitives/kpi/KPI.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { VALORES_DIVIDA_MESSAGES } from './i18n/ModValoresDivida.messages'

/** Valores em dívida — port byte-exact du ModValoresDivida du bundle V5.7 (stateful : Modal + Toast). */

type DivForm = { condomino: string; fracao: string; montante: string; edificio: string; vencimento: string; notas: string }
type Div = { id: number; condomino: string; fracao: string; montante: number; edificio: string; vencimento: string; notas: string; estado: string }

const fmtEUR = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)

export default function ModValoresDivida() {
  const t = useMessages(VALORES_DIVIDA_MESSAGES)
  const locale = useV54Locale()
  const blank: DivForm = { condomino: '', fracao: '', montante: '', edificio: '', vencimento: '', notas: '' }
  const [items, setItems] = useState<Div[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<DivForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof DivForm, string>>>({})
  const { push } = useToast()
  // Phase 2 : vrais débiteurs du cabinet (solde < 0) si syndic connecté, sinon état local (mock/preview).
  const data = useSyndicData()
  const real = data.authenticated
  const realDebtors: Div[] = (data.coproprios ?? [])
    .filter((c) => (c.solde ?? 0) < 0)
    .map((c, i) => ({ id: i, condomino: c.proprietario || '—', fracao: [c.batiment, c.numeroPorte].filter(Boolean).join(' ') || '—', montante: Math.abs(c.solde ?? 0), edificio: c.immeuble || '—', vencimento: '—', notas: '', estado: 'inc' }))
  const displayItems = real ? realDebtors : items

  const upd = (k: keyof DivForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof DivForm, string>> = {}
    if (!form.condomino.trim()) errs.condomino = t.erreurs.condomino
    if (!form.montante || Number(form.montante) <= 0) errs.montante = t.erreurs.montante
    if (Object.keys(errs).length) { setErrors(errs); return }
    setItems(prev => [...prev, { id: Date.now(), condomino: form.condomino, fracao: form.fracao, montante: Number(form.montante), edificio: form.edificio, vencimento: form.vencimento, notas: form.notas, estado: 'inc' }])
    setOpen(false)
    push({ kind: 'warning', title: t.toastEnregistre, desc: `${form.condomino} · ${fmtEUR(Number(form.montante), locale)}` })
  }

  const total = displayItems.reduce((s, i) => s + (Number(i.montante) || 0), 0)
  const counts = { inc: displayItems.filter(i => i.estado === 'inc').length, n1: displayItems.filter(i => i.estado === 'n1').length, n2: displayItems.filter(i => i.estado === 'n2').length, ct: displayItems.filter(i => i.estado === 'ct').length, liq: displayItems.filter(i => i.estado === 'liq').length }

  const c = t.colonnes
  const f = t.formulaire
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau}
        actions={<Button variant="danger" onClick={openNew}><Icon name="alert" />{t.nouvelImpaye}</Button>} />
      <Tabs defaultActive="ac" tabs={[
        { id: 'ac', icon: 'alert', label: t.onglets.ac },
        { id: 'cf', icon: 'clipboard', label: t.onglets.cf },
      ]} />
      <div className={kpiCss.kpiGrid}>
        <KPI icon="alert" accent={total > 0 ? 'rust' : undefined} num={fmtEUR(total, locale).replace('€', '').trim()} numChildren={<span style={{ fontSize: 22, fontStyle: 'italic', marginLeft: 4 }}>€</span>} lbl={t.kpi.total} />
        <KPI icon="alert" num={counts.inc} lbl={t.kpi.inc} accent={counts.inc ? 'amber' : undefined} />
        <KPI icon="mail" num={counts.n1} lbl={t.kpi.n1} accent={counts.n1 ? 'gold' : undefined} />
        <KPI icon="mail" num={counts.n2} lbl={t.kpi.n2} />
        <KPI icon="scale" num={counts.ct} lbl={t.kpi.ct} />
      </div>
      <Tabs defaultActive="all" tabs={[
        { id: 'all', label: t.filtres.tous, badge: displayItems.length },
        { id: 'inc', label: t.filtres.inc(counts.inc) },
        { id: 'n1', label: t.filtres.n1(counts.n1) },
        { id: 'n2', label: t.filtres.n2(counts.n2) },
        { id: 'ct', label: t.filtres.ct(counts.ct) },
        { id: 'liq', icon: 'check', label: t.filtres.liq(counts.liq) },
      ]} />
      <Panel>
        {displayItems.length === 0 ? (
          <Empty kind="sage" illustration="ocorrencias" title={t.videTitre} desc={t.videDesc} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{c.condomino}</th><th>{c.fracao}</th><th>{c.edificio}</th><th>{c.vencimento}</th><th>{c.montante}</th><th>{c.estado}</th></tr></thead>
              <tbody>{displayItems.map(it => (
                <tr key={it.id}>
                  <td>{it.condomino}</td>
                  <td>{it.fracao || '—'}</td>
                  <td>{it.edificio || '—'}</td>
                  <td>{it.vencimento || '—'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(it.montante, locale)}</td>
                  <td><Pill kind="rust">{t.pastilleImpaye}</Pill></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="div-modal-title" size="md">
        <ModalHead icon="alert" id="div-modal-title" title={f.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label={f.condomino} required full name="div-cond" error={errors.condomino}>
              <input type="text" placeholder={f.condominoPlaceholder} value={form.condomino} onChange={e => upd('condomino', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={f.fracao} name="div-frac">
                <input type="text" placeholder={f.fracaoPlaceholder} value={form.fracao} onChange={e => upd('fracao', e.target.value)} />
              </Field>
              <Field label={f.montante} required name="div-mont" suffix="€" error={errors.montante}>
                <input type="number" step="0.01" min="0" inputMode="decimal" placeholder="0" value={form.montante} onChange={e => upd('montante', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={f.edificio} full name="div-edif">
              <input type="text" placeholder={f.edificioPlaceholder} value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
            </Field>
            <Field label={f.vencimento} full name="div-venc">
              <input type="date" value={form.vencimento} onChange={e => upd('vencimento', e.target.value)} />
            </Field>
            <Field label={f.notas} hint={f.notasAide} full name="div-notas">
              <textarea rows={3} value={form.notas} onChange={e => upd('notas', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{f.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.danger)}>{f.enregistrer}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
