'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Alert } from '../primitives/alert'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Nps } from '@/lib/syndic/v54/api'
import { useSyndicCreate } from './use-syndic-create'

/** NPS Pós-Intervenção — port V5.7 + lot 7 fonctionnel.
 * Syndic connecté → réponses NPS réelles (data.nps) + saisie POST ; anonyme → Empty byte-exact.
 * NPS = % promotores (9-10) − % detratores (0-6). */

type NpsForm = { prestador: string; condomino: string; intervencao: string; tipo: string; nota: string; comentario: string }

const notaKind = (n: number): PillKind => (n >= 9 ? 'sage' : n <= 6 ? 'rust' : 'amber')

/** Agrégation NPS par clé (prestador / tipo) : nombre, note moyenne, NPS = %promo − %detr. */
type AggRow = { label: string; n: number; media: number; nps: number }
function aggregateNps(rows: Nps[], key: (n: Nps) => string): AggRow[] {
  const map = new Map<string, Nps[]>()
  for (const r of rows) {
    const k = key(r) || '—'
    const arr = map.get(k)
    if (arr) arr.push(r); else map.set(k, [r])
  }
  return Array.from(map.entries())
    .map(([label, rs]) => {
      const promo = rs.filter(r => r.nota >= 9).length
      const detr = rs.filter(r => r.nota <= 6).length
      return { label, n: rs.length, media: Math.round((rs.reduce((s, r) => s + r.nota, 0) / rs.length) * 10) / 10, nps: Math.round(((promo - detr) / rs.length) * 100) }
    })
    .sort((a, b) => b.nps - a.nps)
}

export default function ModNPSPosIntervencao() {
  const data = useSyndicData()
  const real = data.authenticated
  const all: Nps[] = real ? (data.nps ?? []) : []
  const [tab, setTab] = useState('resp')
  const { busy, create } = useSyndicCreate('/api/syndic/nps')

  const blank: NpsForm = { prestador: '', condomino: '', intervencao: '', tipo: '', nota: '', comentario: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<NpsForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof NpsForm, string>>>({})

  const upd = (k: keyof NpsForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const nota = Number(form.nota)
    if (form.nota === '' || Number.isNaN(nota) || nota < 0 || nota > 10) { setErrors({ nota: 'Nota entre 0 e 10.' }); return }
    create(
      { prestador: form.prestador, condomino: form.condomino, intervencao: form.intervencao, tipo: form.tipo, nota, comentario: form.comentario },
      { okTitle: 'Resposta NPS registada', desc: `Nota ${nota}/10`, onDone: () => setOpen(false) },
    )
  }

  const promotores = all.filter(n => n.nota >= 9).length
  const detratores = all.filter(n => n.nota <= 6).length
  const passivos = all.filter(n => n.nota === 7 || n.nota === 8).length
  const npsMedio = all.length ? Math.round(((promotores - detratores) / all.length) * 100) : 0
  const prestadores = new Set(all.map(n => n.prestador).filter(Boolean)).size
  const agg = tab === 'prest' ? aggregateNps(all, n => n.prestador) : aggregateNps(all, n => n.tipo || n.intervencao)
  const aggLabel = tab === 'prest' ? 'Prestador' : 'Tipo de intervenção'

  return (
    <>
      <PageHead eyebrow="OPERACIONAL · NPS PÓS-INTERVENÇÃO" title="NPS Pós-Intervenção"
        lede="Auto-envio 48h após fecho ordem serviço · NPS + comentário · Rating Marketplace · Alfredo agrega insights"
        actions={<><Button onClick={openNew}><Icon name="plus" />Registar resposta</Button><Button variant="gold" onClick={() => setTab('prest')}><Icon name="chart" />Ver dashboard prestadores</Button></>} />
      <Alert kind="sage" icon="check" title="Loop fechado qualidade prestadores">
        Cada intervenção fechada dispara um inquérito 48h depois. As respostas alimentam o rating no Marketplace e o Alfredo deteta prestadores em descida de satisfação antes que escalone.
      </Alert>
      <KPIGrid items={[
        { icon: 'poll', num: all.length, lbl: 'Respostas recebidas' },
        { icon: 'sparkle', num: npsMedio, lbl: 'NPS médio', accent: npsMedio >= 0 ? 'sage' : 'rust' },
        { icon: 'check', num: promotores, lbl: 'Promotores (9-10)', accent: promotores ? 'sage' : undefined },
        { icon: 'ban', num: detratores, lbl: 'Detratores (0-6)', accent: detratores ? 'rust' : undefined },
        { icon: 'mail', num: passivos, lbl: 'Passivos (7-8)', accent: 'gold' },
        { icon: 'wrench', num: prestadores, lbl: 'Prestadores avaliados' },
      ]} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'resp', icon: 'poll', label: 'Respostas recentes' },
        { id: 'prest', icon: 'wrench', label: 'Por prestador' },
        { id: 'tipo', icon: 'tag', label: 'Por tipo intervenção' },
      ]} />
      <Panel>
        {all.length === 0 ? (
          <Empty illustration="mensagens" title="Nenhum inquérito enviado ainda"
            desc="Quando uma ordem de serviço for marcada como Concluída, um inquérito (1 pergunta NPS + 1 comentário) é enviado automaticamente 48 horas depois ao condómino que abriu."
            action={<Button variant="primary" onClick={openNew}><Icon name="plus" />Registar primeira resposta</Button>} />
        ) : tab === 'resp' ? (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>Prestador</th><th>Condómino</th><th>Intervenção</th><th>Nota</th><th>Comentário</th></tr></thead>
              <tbody>{all.map(n => (
                <tr key={n.id}><td><b>{n.prestador || '—'}</b></td><td>{n.condomino || '—'}</td><td>{n.intervencao || n.tipo || '—'}</td><td><Pill kind={notaKind(n.nota)} noDot>{n.nota}/10</Pill></td><td>{n.comentario || '—'}</td></tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{aggLabel}</th><th>Respostas</th><th>Nota média</th><th>NPS</th></tr></thead>
              <tbody>{agg.map(r => (
                <tr key={r.label}><td><b>{r.label}</b></td><td className={m.numCell}>{r.n}</td><td className={m.numCell}>{r.media.toFixed(1)}</td><td><Pill kind={r.nps >= 0 ? 'sage' : 'rust'} noDot>{r.nps}</Pill></td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="nps-modal-title" size="md">
        <ModalHead icon="poll" id="nps-modal-title" title="Registar resposta NPS" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label="Nota (0-10)" required name="nps-nota" error={errors.nota}>
                <input type="number" min="0" max="10" inputMode="numeric" placeholder="0-10" value={form.nota} onChange={e => upd('nota', e.target.value)} />
              </Field>
              <Field label="Prestador" name="nps-prest">
                <input type="text" placeholder="Empresa / técnico" value={form.prestador} onChange={e => upd('prestador', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Condómino" name="nps-cond">
                <input type="text" placeholder="Nome · Fração" value={form.condomino} onChange={e => upd('condomino', e.target.value)} />
              </Field>
              <Field label="Tipo de intervenção" name="nps-tipo">
                <input type="text" placeholder="Canalização, elétrica…" value={form.tipo} onChange={e => upd('tipo', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Intervenção" full name="nps-interv">
              <input type="text" placeholder="Descrição da ordem de serviço" value={form.intervencao} onChange={e => upd('intervencao', e.target.value)} />
            </Field>
            <Field label="Comentário" full name="nps-com">
              <textarea rows={3} value={form.comentario} onChange={e => upd('comentario', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>Registar</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
