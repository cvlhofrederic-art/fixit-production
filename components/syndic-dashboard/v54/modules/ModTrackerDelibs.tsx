'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import { Empty } from '../primitives/empty'
import { Alert } from '../primitives/alert'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Deliberacao } from '@/lib/syndic/v54/api'
import { useSyndicCreate } from './use-syndic-create'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { TRACKER_DELIBS_MESSAGES, type CouleurEtape } from './i18n/ModTrackerDelibs.messages'

/** Tracker de Deliberações — port V5.7 + lot 2 fonctionnel.
 * Syndic connecté → vraies délibérations du cabinet (data.deliberacoes) + création POST ;
 * anonyme → état vide byte-exact. Le pipeline IA (STEPS) reste du contenu éducatif. */

type DelibForm = { deliberacao: string; ag: string; responsavel: string; prazo: string; estado: Deliberacao['estado'] }

/** Icône et couleur de chaque étape du pipeline (textes dans le dictionnaire, même ordre). */
type Step = { icon: IconName; cor: CouleurEtape }
const STEPS: Step[] = [
  { icon: 'bot', cor: 'sage' },
  { icon: 'clock', cor: 'gold' },
  { icon: 'bell', cor: 'amber' },
]

const estadoKind = (v: string): PillKind => (({ pendente: 'gold', em_curso: 'amber', concluida: 'sage', atrasada: 'rust', bloqueada: 'dark' } as Record<string, PillKind>)[v] || 'gold')
const daysTo = (d: string) => { const t = new Date(d).getTime(); return Number.isNaN(t) ? null : Math.ceil((t - Date.now()) / 86_400_000) }

export default function ModTrackerDelibs() {
  const t = useMessages(TRACKER_DELIBS_MESSAGES)
  const estadoLabel = (v: string) => (t.estados as Record<string, string>)[v] || v
  const data = useSyndicData()
  const real = data.authenticated
  const all: Deliberacao[] = real ? (data.deliberacoes ?? []) : []

  const blank: DelibForm = { deliberacao: '', ag: '', responsavel: '', prazo: '', estado: 'pendente' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<DelibForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof DelibForm, string>>>({})
  const { busy, create } = useSyndicCreate('/api/syndic/deliberacoes')
  const { push } = useToast()
  const [tab, setTab] = useState('todas')
  const shown = all.filter(d => tab === 'todas' ? true : tab === 'pen' ? d.estado === 'pendente' : tab === 'em' ? d.estado === 'em_curso' : tab === 'atr' ? (d.estado === 'atrasada' || (d.estado !== 'concluida' && !!d.prazo && (daysTo(d.prazo) ?? 0) < 0)) : d.estado === 'concluida')

  const upd = (k: keyof DelibForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.deliberacao.trim()) { setErrors({ deliberacao: t.erreurDeliberation }); return }
    create(
      { deliberacao: form.deliberacao, ag: form.ag, responsavel: form.responsavel, prazo: form.prazo || null, estado: form.estado, origem: 'manual' },
      { okTitle: t.ajoutee, desc: form.deliberacao.slice(0, 60), onDone: () => setOpen(false) },
    )
  }

  const extraidasIA = all.filter(d => d.origem === 'ia').length
  const emCurso = all.filter(d => d.estado === 'em_curso').length
  const proximos = all.filter(d => d.estado !== 'concluida' && d.prazo && (daysTo(d.prazo) ?? 99) >= 0 && (daysTo(d.prazo) ?? 99) <= 3).length
  const atrasadas = all.filter(d => d.estado === 'atrasada' || (d.estado !== 'concluida' && d.prazo && (daysTo(d.prazo) ?? 0) < 0)).length
  const concluidas = all.filter(d => d.estado === 'concluida').length
  const bloqueadas = all.filter(d => d.estado === 'bloqueada').length

  return (
    <>
      <PageHead eyebrow={t.surtitre} title={t.titre}
        lede={t.chapeau}
        actions={<><Button onClick={() => push({ kind: 'info', title: t.toastReextraction.titre, desc: t.toastReextraction.desc })}><Icon name="bot" />{t.reextraire}</Button><Button variant="gold" onClick={openNew}><Icon name="plus" />{t.nouvelleAction}</Button></>} />
      <Alert kind="gold" icon="scale" title={t.cadre.titre}>
        {t.cadre.avantGras}<strong>{t.cadre.gras}</strong>{t.cadre.apresGras}
      </Alert>
      <KPIGrid items={[
        { icon: 'bot', num: extraidasIA, lbl: t.kpi.extraites, accent: extraidasIA ? 'gold' : undefined },
        { icon: 'clock', num: emCurso, lbl: t.kpi.enCours, accent: emCurso ? 'sage' : undefined },
        { icon: 'alert', num: proximos, lbl: t.kpi.proches, accent: proximos ? 'amber' : undefined },
        { icon: 'ban', num: atrasadas, lbl: t.kpi.enRetard, accent: atrasadas ? 'rust' : undefined },
        { icon: 'check', num: concluidas, lbl: t.kpi.executees, accent: concluidas ? 'sage' : undefined },
        { icon: 'pause', num: bloqueadas, lbl: t.kpi.bloquees },
      ]} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'todas', label: t.onglets.todas },
        { id: 'pen', label: t.onglets.pen },
        { id: 'em', label: t.onglets.em },
        { id: 'atr', label: t.onglets.atr },
        { id: 'conc', label: t.onglets.conc },
      ]} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {t.ags.map((ag, i) => <Pill key={i} kind={i === 0 ? 'dark' : undefined} noDot>{ag}</Pill>)}
      </div>
      <Panel>
        {all.length === 0 ? (
          <Empty illustration="ag" title={t.vide.titre}
            desc={t.vide.desc}
            action={<Button variant="primary" onClick={openNew}><Icon name="plus" />{t.nouvelleAction}</Button>} />
        ) : shown.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--v54-navy-300)', fontSize: 13 }}>{t.vueVide}</div>
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{t.colonnes.deliberation}</th><th>{t.colonnes.ag}</th><th>{t.colonnes.responsable}</th><th>{t.colonnes.echeance}</th><th>{t.colonnes.statut}</th></tr></thead>
              <tbody>{shown.map(d => (
                <tr key={d.id}><td><b>{d.deliberacao}</b></td><td>{d.ag || '—'}</td><td>{d.responsavel || '—'}</td><td>{d.prazo || '—'}</td><td><Pill kind={estadoKind(d.estado)} noDot>{estadoLabel(d.estado)}</Pill></td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title={t.pipeline.titre} sub={t.pipeline.sousTitre}>
        <div className={m.cardGrid3}>
          {STEPS.map((r, i) => (
            <div key={i} style={{ padding: 14, border: '1px solid var(--v54-line)', borderRadius: 10, display: 'flex', gap: 12, background: `var(--v54-${r.cor}-50)`, borderLeft: `3px solid var(--v54-${r.cor}-500)` }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', display: 'grid', placeItems: 'center', color: `var(--v54-${r.cor}-700)` }}><Icon name={r.icon} /></div>
              <div><div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{t.pipeline.etapes[i].titre}</div><div style={{ fontSize: 11.5, color: 'var(--v54-navy-400)' }}>{t.pipeline.etapes[i].desc}</div></div>
            </div>
          ))}
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="delib-modal-title" size="md">
        <ModalHead icon="check" id="delib-modal-title" title={t.modal.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label={t.modal.deliberation} required full name="delib-txt" error={errors.deliberacao}>
              <textarea rows={2} placeholder={t.modal.deliberationPlaceholder} value={form.deliberacao} onChange={e => upd('deliberacao', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={t.modal.assemblee} name="delib-ag">
                <input type="text" placeholder={t.modal.assembleePlaceholder} value={form.ag} onChange={e => upd('ag', e.target.value)} />
              </Field>
              <Field label={t.modal.responsable} name="delib-resp">
                <input type="text" placeholder={t.modal.responsablePlaceholder} value={form.responsavel} onChange={e => upd('responsavel', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={t.modal.echeance} name="delib-prazo">
                <input type="date" value={form.prazo} onChange={e => upd('prazo', e.target.value)} />
              </Field>
              <Field label={t.modal.statut} name="delib-estado">
                <select value={form.estado} onChange={e => upd('estado', e.target.value)}>
                  <option value="pendente">{t.estados.pendente}</option>
                  <option value="em_curso">{t.estados.em_curso}</option>
                  <option value="concluida">{t.estados.concluida}</option>
                  <option value="atrasada">{t.estados.atrasada}</option>
                  <option value="bloqueada">{t.estados.bloqueada}</option>
                </select>
              </Field>
            </FormRow>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t.modal.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{t.modal.ajouter}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
