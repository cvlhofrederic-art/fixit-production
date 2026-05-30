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

/** Valores em dívida — port byte-exact du ModValoresDivida du bundle V5.7 (stateful : Modal + Toast). */

type DivForm = { condomino: string; fracao: string; montante: string; edificio: string; vencimento: string; notas: string }
type Div = { id: number; condomino: string; fracao: string; montante: number; edificio: string; vencimento: string; notas: string; estado: string }

const fmtEUR = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)

export default function ModValoresDivida() {
  const blank: DivForm = { condomino: '', fracao: '', montante: '', edificio: '', vencimento: '', notas: '' }
  const [items, setItems] = useState<Div[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<DivForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof DivForm, string>>>({})
  const { push } = useToast()

  const upd = (k: keyof DivForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof DivForm, string>> = {}
    if (!form.condomino.trim()) errs.condomino = 'O condómino é obrigatório.'
    if (!form.montante || Number(form.montante) <= 0) errs.montante = 'Indique um montante superior a 0 €.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setItems(prev => [...prev, { id: Date.now(), condomino: form.condomino, fracao: form.fracao, montante: Number(form.montante), edificio: form.edificio, vencimento: form.vencimento, notas: form.notas, estado: 'inc' }])
    setOpen(false)
    push({ kind: 'warning', title: 'Incumprimento registado', desc: `${form.condomino} · ${fmtEUR(Number(form.montante))}` })
  }

  const total = items.reduce((s, i) => s + (Number(i.montante) || 0), 0)
  const counts = { inc: items.filter(i => i.estado === 'inc').length, n1: items.filter(i => i.estado === 'n1').length, n2: items.filter(i => i.estado === 'n2').length, ct: items.filter(i => i.estado === 'ct').length, liq: items.filter(i => i.estado === 'liq').length }

  return (
    <>
      <PageHead title="Valores em dívida" lede="Acompanhamento de incumprimentos e chamadas de fundos — Notificações graduais, cartas de interpelação, contencioso"
        actions={<Button variant="danger" onClick={openNew}><Icon name="alert" />+ Incumprimento</Button>} />
      <Tabs defaultActive="ac" tabs={[
        { id: 'ac', icon: 'alert', label: 'Acompanhamento de Incumprimentos' },
        { id: 'cf', icon: 'clipboard', label: 'Chamadas de Fundos' },
      ]} />
      <div className={kpiCss.kpiGrid}>
        <KPI icon="alert" accent={total > 0 ? 'rust' : undefined} num={fmtEUR(total).replace('€', '').trim()} numChildren={<span style={{ fontSize: 22, fontStyle: 'italic', marginLeft: 4 }}>€</span>} lbl="Total de incumprimentos em curso" />
        <KPI icon="alert" num={counts.inc} lbl="Em incumprimento" accent={counts.inc ? 'amber' : undefined} />
        <KPI icon="mail" num={counts.n1} lbl="Notificação 1" accent={counts.n1 ? 'gold' : undefined} />
        <KPI icon="mail" num={counts.n2} lbl="Notificação 2" />
        <KPI icon="scale" num={counts.ct} lbl="Contencioso" />
      </div>
      <Tabs defaultActive="all" tabs={[
        { id: 'all', label: 'Todos', badge: items.length },
        { id: 'inc', label: `● Em incumprimento (${counts.inc})` },
        { id: 'n1', label: `● Notificação 1 (${counts.n1})` },
        { id: 'n2', label: `● Notificação 2 (${counts.n2})` },
        { id: 'ct', label: `● Contencioso (${counts.ct})` },
        { id: 'liq', icon: 'check', label: `Liquidado (${counts.liq})` },
      ]} />
      <Panel>
        {items.length === 0 ? (
          <Empty kind="sage" illustration="ocorrencias" title="Nenhum incumprimento" desc="Operação nominal" />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>Condómino</th><th>Fração</th><th>Edifício</th><th>Vencimento</th><th>Montante</th><th>Estado</th></tr></thead>
              <tbody>{items.map(it => (
                <tr key={it.id}>
                  <td>{it.condomino}</td>
                  <td>{it.fracao || '—'}</td>
                  <td>{it.edificio || '—'}</td>
                  <td>{it.vencimento || '—'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(it.montante)}</td>
                  <td><Pill kind="rust">Em incumprimento</Pill></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="div-modal-title" size="md">
        <ModalHead icon="alert" id="div-modal-title" title="Registar um incumprimento" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label="Condómino" required full name="div-cond" error={errors.condomino}>
              <input type="text" placeholder="Nome do condómino" value={form.condomino} onChange={e => upd('condomino', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Fração" name="div-frac">
                <input type="text" placeholder="Apt 12" value={form.fracao} onChange={e => upd('fracao', e.target.value)} />
              </Field>
              <Field label="Montante" required name="div-mont" suffix="€" error={errors.montante}>
                <input type="number" step="0.01" min="0" inputMode="decimal" placeholder="0" value={form.montante} onChange={e => upd('montante', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Edifício" full name="div-edif">
              <input type="text" placeholder="Residência…" value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
            </Field>
            <Field label="Data de vencimento" full name="div-venc">
              <input type="date" value={form.vencimento} onChange={e => upd('vencimento', e.target.value)} />
            </Field>
            <Field label="Notas" hint="Informações complementares" full name="div-notas">
              <textarea rows={3} value={form.notas} onChange={e => upd('notas', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.danger)}>Registar</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
