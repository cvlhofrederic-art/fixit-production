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
import { useMessages } from '@/lib/syndic/v54/i18n'
import { useSyndicCreate } from './use-syndic-create'
import { NPS_MESSAGES } from './i18n/ModNPSPosIntervencao.messages'

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
  const t = useMessages(NPS_MESSAGES)
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
    if (form.nota === '' || Number.isNaN(nota) || nota < 0 || nota > 10) { setErrors({ nota: t.erreurNote }); return }
    create(
      { prestador: form.prestador, condomino: form.condomino, intervencao: form.intervencao, tipo: form.tipo, nota, comentario: form.comentario },
      { okTitle: t.toastEnregistree, desc: t.toastNote(nota), onDone: () => setOpen(false) },
    )
  }

  const promotores = all.filter(n => n.nota >= 9).length
  const detratores = all.filter(n => n.nota <= 6).length
  const passivos = all.filter(n => n.nota === 7 || n.nota === 8).length
  const npsMedio = all.length ? Math.round(((promotores - detratores) / all.length) * 100) : 0
  const prestadores = new Set(all.map(n => n.prestador).filter(Boolean)).size
  const agg = tab === 'prest' ? aggregateNps(all, n => n.prestador) : aggregateNps(all, n => n.tipo || n.intervencao)
  const c = t.colonnes
  const f = t.formulaire
  const aggLabel = tab === 'prest' ? c.prestataire : c.typeIntervention

  return (
    <>
      <PageHead eyebrow={t.surtitre} title={t.titre}
        lede={t.chapeau}
        actions={<><Button onClick={openNew}><Icon name="plus" />{t.enregistrerReponse}</Button><Button variant="gold" onClick={() => setTab('prest')}><Icon name="chart" />{t.voirTableauPrestataires}</Button></>} />
      <Alert kind="sage" icon="check" title={t.alerte.titre}>
        {t.alerte.texte}
      </Alert>
      <KPIGrid items={[
        { icon: 'poll', num: all.length, lbl: t.kpi.reponses },
        { icon: 'sparkle', num: npsMedio, lbl: t.kpi.npsMoyen, accent: npsMedio >= 0 ? 'sage' : 'rust' },
        { icon: 'check', num: promotores, lbl: t.kpi.promoteurs, accent: promotores ? 'sage' : undefined },
        { icon: 'ban', num: detratores, lbl: t.kpi.detracteurs, accent: detratores ? 'rust' : undefined },
        { icon: 'mail', num: passivos, lbl: t.kpi.passifs, accent: 'gold' },
        { icon: 'wrench', num: prestadores, lbl: t.kpi.prestataires },
      ]} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'resp', icon: 'poll', label: t.onglets.resp },
        { id: 'prest', icon: 'wrench', label: t.onglets.prest },
        { id: 'tipo', icon: 'tag', label: t.onglets.tipo },
      ]} />
      <Panel>
        {all.length === 0 ? (
          <Empty illustration="mensagens" title={t.vide.titre}
            desc={t.vide.texte}
            action={<Button variant="primary" onClick={openNew}><Icon name="plus" />{t.vide.action}</Button>} />
        ) : tab === 'resp' ? (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{c.prestataire}</th><th>{c.coproprietaire}</th><th>{c.intervention}</th><th>{c.note}</th><th>{c.commentaire}</th></tr></thead>
              <tbody>{all.map(n => (
                <tr key={n.id}><td><b>{n.prestador || '—'}</b></td><td>{n.condomino || '—'}</td><td>{n.intervencao || n.tipo || '—'}</td><td><Pill kind={notaKind(n.nota)} noDot>{n.nota}/10</Pill></td><td>{n.comentario || '—'}</td></tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{aggLabel}</th><th>{c.reponses}</th><th>{c.noteMoyenne}</th><th>NPS</th></tr></thead>
              <tbody>{agg.map(r => (
                <tr key={r.label}><td><b>{r.label}</b></td><td className={m.numCell}>{r.n}</td><td className={m.numCell}>{t.moyenne(r.media)}</td><td><Pill kind={r.nps >= 0 ? 'sage' : 'rust'} noDot>{r.nps}</Pill></td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="nps-modal-title" size="md">
        <ModalHead icon="poll" id="nps-modal-title" title={f.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label={f.note} required name="nps-nota" error={errors.nota}>
                <input type="number" min="0" max="10" inputMode="numeric" placeholder={f.notePlaceholder} value={form.nota} onChange={e => upd('nota', e.target.value)} />
              </Field>
              <Field label={f.prestataire} name="nps-prest">
                <input type="text" placeholder={f.prestatairePlaceholder} value={form.prestador} onChange={e => upd('prestador', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={f.coproprietaire} name="nps-cond">
                <input type="text" placeholder={f.coproprietairePlaceholder} value={form.condomino} onChange={e => upd('condomino', e.target.value)} />
              </Field>
              <Field label={f.typeIntervention} name="nps-tipo">
                <input type="text" placeholder={f.typeInterventionPlaceholder} value={form.tipo} onChange={e => upd('tipo', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={f.intervention} full name="nps-interv">
              <input type="text" placeholder={f.interventionPlaceholder} value={form.intervencao} onChange={e => upd('intervencao', e.target.value)} />
            </Field>
            <Field label={f.commentaire} full name="nps-com">
              <textarea rows={3} value={form.comentario} onChange={e => upd('comentario', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{f.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{f.enregistrer}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
