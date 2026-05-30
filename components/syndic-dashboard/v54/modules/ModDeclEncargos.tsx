'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Alert } from '../primitives/alert'
import { Pill } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'

/** Declaração de Encargos — port byte-exact du ModDeclEncargos du bundle V5.7 (stateful : Modal + form + Toast). */

type DeclForm = { fracao: string; condomino: string; edificio: string; dataPedido: string; encargosCorrentes: string; divida: string; notas: string }
type Decl = DeclForm & { id: number; prazoLimite: string; estado: string }

const fmtEUR = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)

export default function ModDeclEncargos() {
  const today = new Date().toISOString().slice(0, 10)
  const blank: DeclForm = { fracao: '', condomino: '', edificio: '', dataPedido: today, encargosCorrentes: '', divida: '', notas: '' }
  const [items, setItems] = useState<Decl[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<DeclForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof DeclForm, string>>>({})
  const { push } = useToast()

  const upd = (k: keyof DeclForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof DeclForm, string>> = {}
    if (!form.fracao.trim()) errs.fracao = 'A fração é obrigatória.'
    if (!form.condomino.trim()) errs.condomino = 'Indique o condómino.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    const prazoLimite = new Date(form.dataPedido); prazoLimite.setDate(prazoLimite.getDate() + 10)
    setItems(prev => [...prev, { ...form, id: Date.now(), prazoLimite: prazoLimite.toISOString().slice(0, 10), estado: 'pendente' }])
    setOpen(false)
    push({ kind: 'success', title: 'Declaração registada', desc: `Fração ${form.fracao} · prazo legal 10 dias úteis` })
  }

  const pendentes = items.filter(i => i.estado === 'pendente').length
  const foraPrazo = items.filter(i => new Date(i.prazoLimite) < new Date() && i.estado === 'pendente').length
  const concluidas = items.filter(i => i.estado === 'concluida').length

  return (
    <>
      <PageHead title="Declaração de Encargos" lede="Obrigação legal — Lei n.° 8/2022 de 10 de janeiro · Transmissão de frações"
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />+ Nova declaração</Button>} />
      <Alert kind="gold" icon="scale" title="Obrigação legal — Lei n.° 8/2022 de 10 de janeiro (alteração ao Código Civil)">
        O administrador é obrigado a emitir a declaração de encargos em 10 dias úteis após o pedido. Após a escritura, o novo proprietário deve notificar o administrador no prazo de 15 dias.
      </Alert>
      <KPIGrid items={[
        { icon: 'doc', num: items.length, lbl: 'Total de declarações' },
        { icon: 'clock', num: pendentes, lbl: 'Pendentes', accent: pendentes ? 'amber' : undefined },
        { icon: 'alert', num: foraPrazo, lbl: 'Fora do prazo', accent: foraPrazo ? 'rust' : undefined },
        { icon: 'check', num: concluidas, lbl: 'Concluídas', accent: concluidas ? 'sage' : undefined },
      ]} />
      <Tabs defaultActive="todas" tabs={[
        { id: 'todas', label: `Todas (${items.length})` },
        { id: 'pen', label: `Pendentes (${pendentes})` },
        { id: 'em', label: 'Emitidas' },
        { id: 'conc', label: `Concluídas (${concluidas})` },
      ]} />
      <Panel>
        {items.length === 0 ? (
          <Empty illustration="documentos" title="Nenhuma declaração registada" desc="Crie uma declaração de encargos quando um condómino solicitar a venda da sua fração."
            action={<Button variant="primary" onClick={openNew}><Icon name="plus" />+ Nova declaração</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>Fração</th><th>Condómino</th><th>Edifício</th><th>Pedido</th><th>Prazo limite</th><th>Encargos</th><th>Estado</th></tr></thead>
              <tbody>{items.map(it => (
                <tr key={it.id}>
                  <td>{it.fracao}</td>
                  <td>{it.condomino}</td>
                  <td>{it.edificio || '—'}</td>
                  <td>{it.dataPedido}</td>
                  <td>{it.prazoLimite}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{it.encargosCorrentes ? fmtEUR(Number(it.encargosCorrentes)) : '—'}</td>
                  <td><Pill kind="amber">Pendente</Pill></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="de-modal-title" size="md">
        <ModalHead icon="doc" id="de-modal-title" title="Nova declaração de encargos" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label="Fração" required name="de-frac" error={errors.fracao}>
                <input type="text" placeholder="Apt 3.º E" value={form.fracao} onChange={e => upd('fracao', e.target.value)} />
              </Field>
              <Field label="Data do pedido" name="de-data">
                <input type="date" value={form.dataPedido} onChange={e => upd('dataPedido', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Condómino" required full name="de-cond" error={errors.condomino}>
              <input type="text" placeholder="Nome do proprietário" value={form.condomino} onChange={e => upd('condomino', e.target.value)} />
            </Field>
            <Field label="Edifício" full name="de-edif">
              <input type="text" placeholder="Residência…" value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Encargos correntes" suffix="€" name="de-enc">
                <input type="number" step="0.01" min="0" placeholder="0" value={form.encargosCorrentes} onChange={e => upd('encargosCorrentes', e.target.value)} />
              </Field>
              <Field label="Dívidas em atraso" suffix="€" name="de-div">
                <input type="number" step="0.01" min="0" placeholder="0" value={form.divida} onChange={e => upd('divida', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Notas" full name="de-notas">
              <textarea rows={3} value={form.notas} onChange={e => upd('notas', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)}>Registar</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
