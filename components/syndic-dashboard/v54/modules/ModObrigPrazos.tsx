'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPI } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Alert } from '../primitives/alert'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import btnCss from '../primitives/button/Button.module.css'
import kpiCss from '../primitives/kpi/KPI.module.css'
import m from './modules.module.css'

/** Obrigações Legais — port byte-exact du ModObrigPrazos du bundle V5.7 (stateful : Modal + Toast). */

type OPForm = { edificio: string; tipo: string; descricao: string; prazo: string; notas: string }
type OP = OPForm & { id: number }
type Bucket = 'expirado' | 'urgente' | 'proximo' | 'emdia'
type Cor = 'sage' | 'gold' | 'amber' | 'rust'

const TIPO_LABEL: Record<string, string> = {
  conservacao: 'Conservação obrigatória (DL 555/99)',
  gas: 'Inspeção de gás (DL 97/2017)',
  elevador: 'Inspeção de elevadores (DL 320/2002)',
  eletrica: 'Inspeção elétrica (RTIEBT)',
  seguro: 'Seguro do edifício (DL 267/94)',
  ag: 'Assembleia geral anual (CC art. 1431.°)',
  certif: 'Certificado energético (DL 101-D/2020)',
  inc: 'Segurança contra incêndios (DL 220/2008)',
}
const REFS: [IconName, string, string, Cor][] = [
  ['construction', 'Conservação obrigatória', 'DL 555/99 art. 89.° — 8 anos', 'sage'],
  ['flame', 'Inspeção de gás', 'DL 97/2017 — 5 anos', 'gold'],
  ['building', 'Inspeção de elevadores', 'DL 320/2002 — 2 a 6 anos', 'sage'],
  ['bolt', 'Inspeção elétrica', 'RTIEBT — 10 anos', 'amber'],
  ['shield', 'Seguro do edifício', 'DL 267/94 — anual', 'sage'],
  ['bank', 'Assembleia geral anual', 'CC art. 1431.° — anual', 'sage'],
  ['target', 'Certificado energético', 'DL 101-D/2020 — 10 anos', 'sage'],
  ['alert', 'Segurança contra incêndios', 'DL 220/2008 — anual', 'rust'],
]
const status = (prazo: string): { kind: PillKind; label: string; bucket: Bucket } => {
  const days = (new Date(prazo).getTime() - Date.now()) / 86400000
  if (days < 0) return { kind: 'rust', label: 'Expirado', bucket: 'expirado' }
  if (days < 30) return { kind: 'amber', label: 'Urgente', bucket: 'urgente' }
  if (days < 90) return { kind: 'gold', label: 'Próximo', bucket: 'proximo' }
  return { kind: 'sage', label: 'Em dia', bucket: 'emdia' }
}

export default function ModObrigPrazos() {
  const today = new Date().toISOString().slice(0, 10)
  const blank: OPForm = { edificio: '', tipo: 'conservacao', descricao: '', prazo: today, notas: '' }
  const [items, setItems] = useState<OP[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<OPForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof OPForm, string>>>({})
  const { push } = useToast()

  const upd = (k: keyof OPForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof OPForm, string>> = {}
    if (!form.edificio.trim()) errs.edificio = 'O edifício é obrigatório.'
    if (!form.descricao.trim()) errs.descricao = 'Descreva a obrigação.'
    if (!form.prazo) errs.prazo = 'O prazo é obrigatório.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setItems(prev => [...prev, { ...form, id: Date.now() }])
    setOpen(false)
    push({ kind: 'success', title: 'Obrigação registada', desc: TIPO_LABEL[form.tipo] })
  }

  const counts: Record<Bucket, number> = { expirado: 0, urgente: 0, proximo: 0, emdia: 0 }
  items.forEach(i => { counts[status(i.prazo).bucket]++ })

  return (
    <>
      <PageHead title="Obrigações Legais" lede="Calendário de obrigações · Prazos legais · Lei 8/2022 · DL 555/99"
        actions={<><select className={btnCss.btn} aria-label="Filtrar por edifício"><option>Todos os edifícios</option></select><select className={btnCss.btn} aria-label="Filtrar por estado"><option>Todos os estados</option></select><Button variant="gold" onClick={openNew}><Icon name="plus" />+ Adicionar</Button></>} />
      <Alert kind="gold" icon="scale" title="Enquadramento Legal Português">
        Conservação obrigatória a cada 8 anos (DL 555/99) · Inspeção de gás a cada 5 anos (DL 97/2017) · Elevadores a cada 2-6 anos (DL 320/2002) · Assembleia anual obrigatória (CC art. 1431.°) · Lei 8/2022
      </Alert>
      <div className={kpiCss.kpiGrid}>
        <KPI dot="rust" accent={counts.expirado ? 'rust' : undefined} num={counts.expirado} lbl="Expirados" />
        <KPI dot="amber" accent={counts.urgente ? 'amber' : undefined} num={counts.urgente} lbl="Urgentes" />
        <KPI dot="gold" num={counts.proximo} lbl="Próximos" />
        <KPI dot="sage" accent={counts.emdia ? 'sage' : undefined} num={counts.emdia} lbl="Em dia" />
      </div>
      <Panel flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Edifício</th><th>Tipo</th><th>Descrição</th><th>Prazo</th><th>Estado</th></tr></thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--v54-navy-300)' }}>Nenhuma obrigação registada. Clique em &quot;+ Adicionar&quot; para começar.</td></tr>
              ) : items.map(it => {
                const st = status(it.prazo)
                return (
                  <tr key={it.id}>
                    <td>{it.edificio}</td>
                    <td>{TIPO_LABEL[it.tipo].split(' (')[0]}</td>
                    <td>{it.descricao}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{it.prazo}</td>
                    <td><Pill kind={st.kind}>{st.label}</Pill></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Referências Legais Portuguesas">
        <div className={m.cardGrid}>
          {REFS.map(([ic, t, s, c], i) => (
            <div key={i} style={{ padding: 14, border: '1px solid var(--v54-line)', borderRadius: 10, display: 'flex', gap: 12, background: `var(--v54-${c}-50)`, borderLeft: `3px solid var(--v54-${c}-500)` }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', display: 'grid', placeItems: 'center', color: `var(--v54-${c}-700)` }}><Icon name={ic} /></div>
              <div><div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{t}</div><div style={{ fontSize: 11.5, color: 'var(--v54-navy-500)' }}>{s}</div></div>
            </div>
          ))}
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="op-modal-title" size="md">
        <ModalHead icon="scale" id="op-modal-title" title="Adicionar obrigação legal" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label="Edifício" required full name="op-edif" error={errors.edificio}>
              <input type="text" placeholder="Residência…" value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
            </Field>
            <Field label="Tipo de obrigação" full name="op-tipo">
              <select value={form.tipo} onChange={e => upd('tipo', e.target.value)}>
                {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Descrição" required full name="op-desc" error={errors.descricao}>
              <input type="text" placeholder="Ex.: Inspeção de elevador do bloco A" value={form.descricao} onChange={e => upd('descricao', e.target.value)} />
            </Field>
            <Field label="Prazo limite" required full name="op-prazo" error={errors.prazo}>
              <input type="date" value={form.prazo} onChange={e => upd('prazo', e.target.value)} />
            </Field>
            <Field label="Notas" full name="op-notas">
              <textarea rows={3} value={form.notas} onChange={e => upd('notas', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)}>Adicionar</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
