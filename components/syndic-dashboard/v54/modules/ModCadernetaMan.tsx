'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'

/** Caderneta de Manutenção & Técnica — port byte-exact du ModCadernetaMan du bundle V5.7 (stateful). */

type CadForm = { data: string; estado: string; natureza: string; edificio: string; localizacao: string; prestador: string; custo: string; garantia: string; cee: string; notas: string }
type Cad = Omit<CadForm, 'custo'> & { id: number; custo: number }

const fmtEUR = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)
const naturezaLabel = (v: string) => (({ 'manutencao-corrente': 'Manutenção corrente', 'reparacao': 'Reparação', 'diagnostico': 'Diagnóstico técnico', 'obra-conservacao': 'Obra de conservação', 'obra-beneficiacao': 'Obra de beneficiação', 'inspeccao-legal': 'Inspeção legal obrigatória' } as Record<string, string>)[v] || v)
const estadoLabel = (v: string) => (({ realizado: 'Realizado', planeado: 'Planeado', 'em-curso': 'Em curso', cancelado: 'Cancelado' } as Record<string, string>)[v] || v)
const estadoKind = (v: string): PillKind => (({ realizado: 'sage', planeado: 'gold', 'em-curso': 'amber', cancelado: 'rust' } as Record<string, PillKind>)[v])

export default function ModCadernetaMan() {
  const blank: CadForm = { data: new Date().toISOString().slice(0, 10), estado: 'realizado', natureza: '', edificio: '', localizacao: '', prestador: '', custo: '', garantia: '', cee: 'na', notas: '' }
  const [items, setItems] = useState<Cad[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CadForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof CadForm, string>>>({})
  const { push } = useToast()

  const upd = (k: keyof CadForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm({ ...blank, data: new Date().toISOString().slice(0, 10) }); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof CadForm, string>> = {}
    if (!form.data) errs.data = 'A data é obrigatória.'
    if (!form.natureza) errs.natureza = 'Indique a natureza das obras.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setItems(prev => [...prev, { ...form, id: Date.now(), custo: Number(form.custo) || 0 }])
    setOpen(false)
    push({ kind: 'success', title: 'Intervenção registada', desc: form.natureza })
  }

  const total = items.reduce((s, i) => s + (Number(i.custo) || 0), 0)
  const planeadas = items.filter(i => i.estado === 'planeado').length
  const edifSet = new Set(items.map(i => i.edificio).filter(Boolean))

  return (
    <>
      <PageHead title="Caderneta de Manutenção & Técnica" lede="Obras · Equipamentos · Contratos manutenção · Estado datado · CEE"
        actions={<><Button onClick={() => push({ kind: 'info', title: 'Export PDF', desc: items.length ? `${items.length} intervenções prontas para exportação` : 'Registe a primeira intervenção para exportar.' })}><Icon name="download" />Export PDF</Button><Button variant="gold" onClick={openNew}><Icon name="plus" />+ Intervenção</Button></>} />
      <Tabs defaultActive="cad" tabs={[
        { id: 'cad', icon: 'book', label: 'Caderneta de manutenção' },
        { id: 'eq', icon: 'cog', label: 'Equipamentos' },
        { id: 'ct', icon: 'stamp', label: 'Contratos' },
        { id: 'est', icon: 'clipboard', label: 'Estado Datado' },
        { id: 'cee', icon: 'book', label: 'CEE Coletivo' },
      ]} />
      <KPIGrid items={[
        { icon: 'clipboard', num: items.length, lbl: 'Intervenções' },
        { icon: 'calendar', num: planeadas, lbl: 'Planeadas', accent: planeadas ? 'amber' : undefined },
        { icon: 'coin', num: fmtEUR(total).replace('€', '').trim(), cur: '€', lbl: 'Custo total', accent: 'gold' },
        { icon: 'building', num: edifSet.size, lbl: 'Edifícios' },
      ]} />
      <Panel>
        {items.length === 0 ? (
          <Empty illustration="documentos" title="Caderneta vazia" desc="Registe todas as intervenções para rastreabilidade completa"
            action={<Button variant="gold" onClick={openNew}><Icon name="plus" />+ Primeira intervenção</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>Data</th><th>Natureza</th><th>Edifício</th><th>Prestador</th><th>Custo</th><th>Garantia</th><th>Estado</th></tr></thead>
              <tbody>{items.map(it => (
                <tr key={it.id}>
                  <td>{it.data}</td>
                  <td>{naturezaLabel(it.natureza)}</td>
                  <td>{it.edificio || '—'}</td>
                  <td>{it.prestador || '—'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(it.custo)}</td>
                  <td>{it.garantia || '—'}</td>
                  <td><Pill kind={estadoKind(it.estado)}>{estadoLabel(it.estado)}</Pill></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="cad-modal-title" size="md">
        <ModalHead icon="clipboard" id="cad-modal-title" title="Nova intervenção" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label="Data" required name="cad-data" error={errors.data}>
                <input type="date" value={form.data} onChange={e => upd('data', e.target.value)} />
              </Field>
              <Field label="Estado" name="cad-estado">
                <select value={form.estado} onChange={e => upd('estado', e.target.value)}>
                  <option value="realizado">Realizado</option>
                  <option value="planeado">Planeado</option>
                  <option value="em-curso">Em curso</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </Field>
            </FormRow>
            <Field label="Natureza das obras" required full name="cad-nat" error={errors.natureza}>
              <select value={form.natureza} onChange={e => upd('natureza', e.target.value)}>
                <option value="">Escolher…</option>
                <option value="manutencao-corrente">Manutenção corrente</option>
                <option value="reparacao">Reparação</option>
                <option value="diagnostico">Diagnóstico técnico</option>
                <option value="obra-conservacao">Obra de conservação</option>
                <option value="obra-beneficiacao">Obra de beneficiação</option>
                <option value="inspeccao-legal">Inspeção legal obrigatória</option>
              </select>
            </Field>
            <FormRow>
              <Field label="Edifício" name="cad-edif">
                <input type="text" placeholder="Edifício…" value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
              </Field>
              <Field label="Localização" name="cad-local">
                <input type="text" placeholder="Bloco A, entrada 2…" value={form.localizacao} onChange={e => upd('localizacao', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Prestador" name="cad-prest">
                <input type="text" placeholder="Nome da empresa" value={form.prestador} onChange={e => upd('prestador', e.target.value)} />
              </Field>
              <Field label="Custo" hint="Valor em euros" name="cad-custo" suffix="€">
                <input type="number" step="0.01" min="0" inputMode="decimal" placeholder="0" value={form.custo} onChange={e => upd('custo', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Garantia" hint="Ex.: 10 anos / até 2036" name="cad-gar">
                <input type="text" placeholder="10 anos / até 2036" value={form.garantia} onChange={e => upd('garantia', e.target.value)} />
              </Field>
              <Field label="Classe CEE" hint="Se diagnóstico energético" name="cad-cee">
                <select value={form.cee} onChange={e => upd('cee', e.target.value)}>
                  <option value="na">Não aplicável</option>
                  {['A+', 'A', 'B', 'B-', 'C', 'D', 'E', 'F'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </FormRow>
            <Field label="Notas" full name="cad-notas">
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
