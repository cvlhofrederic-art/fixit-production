'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPI } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Alert } from '../primitives/alert'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import kpiCss from '../primitives/kpi/KPI.module.css'
import m from './modules.module.css'

/** Certificação Energética — port byte-exact du ModCertEnerg du bundle V5.7 (stateful : Modal + form + Toast). */

type CertForm = { numero: string; edificio: string; perito: string; classe: string; dataEmissao: string; dataValidade: string; notas: string }
type Cert = CertForm & { id: number }

const validityIso = (d: string) => { const dt = new Date(d); dt.setFullYear(dt.getFullYear() + 10); return dt.toISOString().slice(0, 10) }
const classePill = (c: string): PillKind => (['A+', 'A', 'B', 'B-'].includes(c) ? 'sage' : ['E', 'F'].includes(c) ? 'rust' : 'amber')

export default function ModCertEnerg() {
  const today = new Date().toISOString().slice(0, 10)
  const blank: CertForm = { numero: '', edificio: '', perito: '', classe: 'C', dataEmissao: today, dataValidade: validityIso(today), notas: '' }
  const [items, setItems] = useState<Cert[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CertForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof CertForm, string>>>({})
  const { push } = useToast()

  const upd = (k: keyof CertForm, v: string) => {
    setForm(s => {
      const next = { ...s, [k]: v }
      if (k === 'dataEmissao' && v) next.dataValidade = validityIso(v)
      return next
    })
  }
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof CertForm, string>> = {}
    if (!form.numero.trim()) errs.numero = 'Indique o nº do certificado.'
    if (!form.edificio.trim()) errs.edificio = 'O edifício é obrigatório.'
    if (!form.dataEmissao) errs.dataEmissao = 'A data de emissão é obrigatória.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setItems(prev => [...prev, { ...form, id: Date.now() }])
    setOpen(false)
    push({ kind: 'success', title: 'Certificado registado', desc: `${form.numero} · classe ${form.classe}` })
  }

  const efficient = items.filter(i => ['A+', 'A', 'B', 'B-'].includes(i.classe)).length
  const inefficient = items.filter(i => ['E', 'F'].includes(i.classe)).length
  const expired = items.filter(i => new Date(i.dataValidade) < new Date()).length
  const renovate = items.filter(i => { const v = new Date(i.dataValidade).getTime(); const diff = (v - Date.now()) / 86400000; return diff > 0 && diff < 365 }).length

  return (
    <>
      <PageHead title="Certificação Energética" lede="SCE — DL 101-D/2020 · EPBD 2024 · Classes A+ a F"
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />+ Adicionar certificado</Button>} />
      <Alert kind="sage" icon="check" title="Sistema de Certificação Energética (SCE) — DL 101-D/2020">
        O certificado energético é obrigatório para todos os edifícios. Validade de 10 anos. Diretiva EPBD 2024: todos os edifícios devem atingir classe E até 2030 e classe D até 2033. Frações classe F ficam impedidas de arrendamento (MEPS).
      </Alert>
      <div className={kpiCss.kpiGrid} style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        <KPI num={items.length} lbl="Certificados" />
        <KPI num={efficient} lbl="Eficientes (A+ a B-)" accent={efficient ? 'sage' : undefined} />
        <KPI num={inefficient} lbl="Ineficientes (E & F)" accent={inefficient ? 'rust' : undefined} />
        <KPI num={expired} lbl="Expirados" accent={expired ? 'amber' : undefined} />
        <KPI num={renovate} lbl="A renovar <1 ano" accent={renovate ? 'gold' : undefined} />
      </div>
      <Panel>
        {items.length === 0 ? (
          <Empty kind="gold" illustration="documentos" title="Nenhum certificado registado" desc="Comece por registar o certificado energético dos seus edifícios."
            action={<Button variant="primary" onClick={openNew}><Icon name="plus" />+ Adicionar certificado</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>Nº</th><th>Edifício</th><th>Classe</th><th>Emissão</th><th>Validade</th><th>Perito</th></tr></thead>
              <tbody>{items.map(it => (
                <tr key={it.id}>
                  <td>{it.numero}</td>
                  <td>{it.edificio}</td>
                  <td><Pill kind={classePill(it.classe)}>{it.classe}</Pill></td>
                  <td>{it.dataEmissao}</td>
                  <td>{it.dataValidade}</td>
                  <td>{it.perito || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="ce-modal-title" size="md">
        <ModalHead icon="bolt" id="ce-modal-title" title="Adicionar certificado energético" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label="Nº certificado" required name="ce-num" error={errors.numero}>
                <input type="text" placeholder="SCE-2026-…" value={form.numero} onChange={e => upd('numero', e.target.value)} />
              </Field>
              <Field label="Classe" name="ce-classe">
                <select value={form.classe} onChange={e => upd('classe', e.target.value)}>
                  {['A+', 'A', 'B', 'B-', 'C', 'D', 'E', 'F'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </FormRow>
            <Field label="Edifício" required full name="ce-edif" error={errors.edificio}>
              <input type="text" placeholder="Residência Os Pinheiros, 12 rua…" value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Data de emissão" required name="ce-emit" error={errors.dataEmissao}>
                <input type="date" value={form.dataEmissao} onChange={e => upd('dataEmissao', e.target.value)} />
              </Field>
              <Field label="Data de validade" hint="Calculada automaticamente (+10 anos)" name="ce-valid">
                <input type="date" value={form.dataValidade} onChange={e => upd('dataValidade', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Perito qualificado" full name="ce-perito">
              <input type="text" placeholder="Nome do perito SCE" value={form.perito} onChange={e => upd('perito', e.target.value)} />
            </Field>
            <Field label="Notas" full name="ce-notas">
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
