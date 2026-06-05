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

/** AG Digitais — port byte-exact V5.7 + Phase 3 : AG réelles (table syndic_assemblees via route v54).
 * Syndic connecté → vraies AG du cabinet (data.assembleias) + création POST ;
 * anonyme → preview (Empty byte-exact + toast démo). */

type AGForm = { titulo: string; edificio: string; dataHora: string; tipo: string; local: string; quorum: number | string; milesimos: number | string; ordem: string }

const fmtDateTime = (v: string) => v ? new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v)) : '—'

export default function ModAGDigit() {
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
    if (!form.titulo.trim()) errs.titulo = 'Indique o título da AG.'
    if (!form.dataHora) errs.dataHora = 'A data e hora são obrigatórias.'
    if (Number(form.quorum) < 0 || Number(form.quorum) > 100) errs.quorum = 'O quórum deve estar entre 0 e 100 %.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/ag-v54', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ titulo: form.titulo, edificio: form.edificio, dataHora: form.dataHora, tipo: form.tipo, local: form.local, quorum: Number(form.quorum) || 0, milesimos: Number(form.milesimos) || 0, ordem: form.ordem }),
      })
        .then(r => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: 'AG criada', desc: form.titulo }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao criar AG', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: 'AG criada (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }

  const counts = { total: all.length, emCurso: all.filter(i => i.estado === 'em-curso').length, encerradas: all.filter(i => i.estado === 'encerrada').length }

  return (
    <>
      <PageHead title="AG Digitais" lede="Convocação · Votação em sessão e por correspondência · Maiorias legais · Ata em PDF assinada"
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />Nova AG</Button>} />
      <KPIGrid items={[
        { icon: 'bank', num: counts.total, lbl: 'Total AG' },
        { icon: 'clock', num: counts.emCurso, lbl: 'Em curso', accent: counts.emCurso ? 'amber' : undefined },
        { icon: 'check', num: counts.encerradas, lbl: 'Encerradas', accent: counts.encerradas ? 'sage' : undefined },
        { icon: 'poll', num: 0, lbl: 'Resoluções totais', accent: 'gold' },
      ]} />
      <Panel>
        {all.length === 0 ? (
          <Empty illustration="ag" title="Nenhuma AG"
            desc="Organize as suas assembleias gerais 100% online com votação por correspondência"
            action={<Button variant="gold" onClick={openNew}><Icon name="plus" />Criar a primeira AG</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>Título</th><th>Edifício</th><th>Data</th><th>Tipo</th><th>Quórum</th><th>Estado</th></tr></thead>
              <tbody>{all.map(it => (
                <tr key={it.id}>
                  <td>{it.titulo}</td>
                  <td>{it.edificio || '—'}</td>
                  <td>{fmtDateTime(it.dataHora)}</td>
                  <td>{it.tipo === 'ordinaria' ? 'Ordinária' : it.tipo === 'extraordinaria' ? 'Extraordinária' : 'Urgente'}</td>
                  <td>{it.quorum}%</td>
                  <td><Pill kind={it.estado === 'em-curso' ? 'amber' : 'sage'}>{it.estado === 'em-curso' ? 'Em curso' : 'Encerrada'}</Pill></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="ag-modal-title" size="lg">
        <ModalHead icon="bank" id="ag-modal-title" title="Nova Assembleia Geral" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label="Título" required full name="ag-titulo" error={errors.titulo}>
              <input type="text" placeholder="AG Anual 2026 — Residência Os Pinheiros" value={form.titulo} onChange={e => upd('titulo', e.target.value)} />
            </Field>
            <Field label="Edifício" full name="ag-edif">
              <input type="text" placeholder="Residência Os Pinheiros, 12 rua…" value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Data e hora" required name="ag-data" error={errors.dataHora}>
                <input type="datetime-local" value={form.dataHora} onChange={e => upd('dataHora', e.target.value)} />
              </Field>
              <Field label="Tipo" name="ag-tipo">
                <select value={form.tipo} onChange={e => upd('tipo', e.target.value)}>
                  <option value="ordinaria">Ordinária (AGO)</option>
                  <option value="extraordinaria">Extraordinária (AGE)</option>
                  <option value="urgente">Urgente (CC art. 1432.º)</option>
                </select>
              </Field>
            </FormRow>
            <Field label="Local" full name="ag-local">
              <input type="text" placeholder="Sala de reuniões, 12 rua…" value={form.local} onChange={e => upd('local', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Quórum" hint="Percentagem mínima para deliberar" name="ag-quorum" suffix="%" error={errors.quorum}>
                <input type="number" min="0" max="100" value={form.quorum} onChange={e => upd('quorum', e.target.value)} />
              </Field>
              <Field label="Total milésimos" hint="Capital total do condomínio" name="ag-miles">
                <input type="number" min="0" value={form.milesimos} onChange={e => upd('milesimos', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Ordem do dia" hint="Um ponto por linha" full name="ag-ordem">
              <textarea rows={5} placeholder={'Aprovação das contas 2025\nVotação do orçamento 2026\nObras de reabilitação\nAssuntos diversos'} value={form.ordem} onChange={e => upd('ordem', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>Criar a AG</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
