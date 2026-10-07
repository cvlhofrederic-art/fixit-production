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
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { VISTORIA_MESSAGES } from './i18n/ModVistoria.messages'

/** Vistoria Técnica — port byte-exact V5.7 + Phase 3 : vistorias réelles. */

const statutKind = (s: string): PillKind => (s === 'concluida' ? 'sage' : s === 'enviada' ? 'gold' : 'amber')

export default function ModVistoria() {
  const t = useMessages(VISTORIA_MESSAGES)
  const statutLabel: Record<string, string> = t.statuts
  // Phase 3 : vraies vistorias du cabinet si syndic connecté, sinon mock/empty (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.vistorias ?? []) : []

  const realizadas = all.filter((v) => v.statut === 'concluida').length
  const vigiar = all.reduce((acc, v) => acc + (v.pontosVigiar || 0), 0)
  const deficientes = all.reduce((acc, v) => acc + (v.pontosDeficientes || 0), 0)

  // Phase 3 écritures : « + Nova vistoria » → POST /api/syndic/vistorias.
  const { push } = useToast()
  const blank = { titulo: '', immeuble: '', statut: 'em_curso', pontosVigiar: '', pontosDeficientes: '', dataVistoria: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.titulo.trim()) errs.titulo = t.erreurTitre
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/vistorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ titulo: form.titulo, immeuble: form.immeuble, statut: form.statut, pontosVigiar: Number(form.pontosVigiar) || 0, pontosDeficientes: Number(form.pontosDeficientes) || 0, dataVistoria: form.dataVistoria }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: t.toasts.creee, desc: form.titulo }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurCreation, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: t.toasts.creeeDemo, desc: t.toasts.connexionRequise })
  }

  return (
    <>
      <PageHead
        title={t.titre}
        lede={t.chapeau}
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.nouvelleVisite}</Button>}
      />
      <KPIGrid items={[
        { icon: 'check', num: real ? realizadas : 0, lbl: t.kpi.realisees, accent: 'sage' },
        { icon: 'alert', num: real ? vigiar : 0, lbl: t.kpi.aSurveiller, accent: 'amber' },
        { icon: 'alert', num: real ? deficientes : 0, lbl: t.kpi.defaillants, accent: 'rust' },
      ]} />
      <Tabs defaultActive="todas" tabs={[
        { id: 'todas', label: t.onglets.todas },
        { id: 'conc', label: t.onglets.conc },
        { id: 'curso', label: t.onglets.curso },
        { id: 'env', label: t.onglets.env },
      ]} />
      {all.length === 0 ? (
        <Panel>
          <Empty
            illustration="documentos"
            title={t.vide.titre}
            desc={t.vide.desc}
            action={<Button variant="primary" onClick={openNew}><Icon name="plus" />{t.nouvelleVisite}</Button>}
          />
        </Panel>
      ) : (
        <Panel flush>
          {all.map((v) => (
            <div key={v.id} style={{ padding: '16px 22px', borderBottom: '1px solid var(--v54-line)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 17, fontWeight: 500 }}>{v.titulo || t.titreParDefaut}</div>
                <div style={{ fontSize: 12.5, color: 'var(--v54-navy-300)', marginTop: 2 }}>{[v.immeuble, v.dataVistoria].filter(Boolean).join(' · ')}</div>
              </div>
              {v.pontosVigiar > 0 && <Pill kind="amber" noDot>{v.pontosVigiar}{t.suffixeASurveiller(v.pontosVigiar)}</Pill>}
              {v.pontosDeficientes > 0 && <Pill kind="rust" noDot>{v.pontosDeficientes}{t.suffixeDefaillants(v.pontosDeficientes)}</Pill>}
              <Pill kind={statutKind(v.statut)} noDot>{statutLabel[v.statut] ?? v.statut}</Pill>
            </div>
          ))}
        </Panel>
      )}

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="nv-title" size="md">
        <ModalHead icon="clipboard" id="nv-title" title={t.modal.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label={t.modal.champTitre} required full name="nv-tit" error={errors.titulo}>
              <input type="text" placeholder={t.modal.titrePlaceholder} value={form.titulo} onChange={(e) => upd('titulo', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={t.modal.immeuble} name="nv-imovel">
                <input type="text" placeholder={t.modal.facultatif} value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
              </Field>
              <Field label={t.modal.statut} name="nv-statut">
                <select value={form.statut} onChange={(e) => upd('statut', e.target.value)}>
                  <option value="em_curso">{t.statuts.em_curso}</option>
                  <option value="concluida">{t.statuts.concluida}</option>
                  <option value="enviada">{t.statuts.enviada}</option>
                </select>
              </Field>
            </FormRow>
            <FormRow>
              <Field label={t.modal.aSurveiller} name="nv-vig">
                <input type="number" min="0" inputMode="numeric" placeholder="0" value={form.pontosVigiar} onChange={(e) => upd('pontosVigiar', e.target.value)} />
              </Field>
              <Field label={t.modal.defaillants} name="nv-def">
                <input type="number" min="0" inputMode="numeric" placeholder="0" value={form.pontosDeficientes} onChange={(e) => upd('pontosDeficientes', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={t.modal.date} full name="nv-data">
              <input type="text" placeholder={t.modal.datePlaceholder} value={form.dataVistoria} onChange={(e) => upd('dataVistoria', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t.modal.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{t.modal.creer}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
