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
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { CERT_ENERG_MESSAGES } from './i18n/ModCertEnerg.messages'

/** Certificação Energética — port byte-exact V5.7 + Phase 3 : certificats SCE réels.
 * Syndic connecté → vrais certificats du cabinet (data.certificados) + création POST ;
 * anonyme → preview (Empty byte-exact + toast démo). */

type CertForm = { numero: string; edificio: string; perito: string; classe: string; dataEmissao: string; dataValidade: string; notas: string }

const validityIso = (d: string) => { const dt = new Date(d); dt.setFullYear(dt.getFullYear() + 10); return dt.toISOString().slice(0, 10) }
const classePill = (c: string, performantes: string[], energivores: string[]): PillKind => (performantes.includes(c) ? 'sage' : energivores.includes(c) ? 'rust' : 'amber')

export default function ModCertEnerg() {
  const t = useMessages(CERT_ENERG_MESSAGES)
  const f = t.formulaire
  // Phase 3 : vrais certificats SCE du cabinet si syndic connecté, sinon preview vide.
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.certificados ?? []) : []

  const today = new Date().toISOString().slice(0, 10)
  const blank: CertForm = { numero: '', edificio: '', perito: '', classe: 'C', dataEmissao: today, dataValidade: validityIso(today), notas: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CertForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof CertForm, string>>>({})
  const [busy, setBusy] = useState(false)
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
    if (!form.numero.trim()) errs.numero = t.erreurs.numero
    if (!form.edificio.trim()) errs.edificio = t.erreurs.immeuble
    if (!form.dataEmissao) errs.dataEmissao = t.erreurs.emission
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/cert-energ', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ numero: form.numero, edificio: form.edificio, perito: form.perito, classe: form.classe, dataEmissao: form.dataEmissao, dataValidade: form.dataValidade, notas: form.notas }),
      })
        .then(r => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: t.toasts.enregistre, desc: t.toasts.detail(form.numero, form.classe) }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreur, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: t.toasts.enregistreDemo, desc: t.toasts.connexionRequise })
  }

  const efficient = all.filter(i => t.classesPerformantes.includes(i.classe)).length
  const inefficient = all.filter(i => t.classesEnergivores.includes(i.classe)).length
  const expired = all.filter(i => new Date(i.dataValidade) < new Date()).length
  const renovate = all.filter(i => { const v = new Date(i.dataValidade).getTime(); const diff = (v - Date.now()) / 86400000; return diff > 0 && diff < 365 }).length

  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau}
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.ajouter}</Button>} />
      <Alert kind="sage" icon="check" title={t.alerte.titre}>
        {t.alerte.texte}
      </Alert>
      <div className={kpiCss.kpiGrid} style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        <KPI num={all.length} lbl={t.kpi.certificats} />
        <KPI num={efficient} lbl={t.kpi.efficaces} accent={efficient ? 'sage' : undefined} />
        <KPI num={inefficient} lbl={t.kpi.inefficaces} accent={inefficient ? 'rust' : undefined} />
        <KPI num={expired} lbl={t.kpi.expires} accent={expired ? 'amber' : undefined} />
        <KPI num={renovate} lbl={t.kpi.aRenouveler} accent={renovate ? 'gold' : undefined} />
      </div>
      <Panel>
        {all.length === 0 ? (
          <Empty kind="gold" illustration="documentos" title={t.vide.titre} desc={t.vide.desc}
            action={<Button variant="primary" onClick={openNew}><Icon name="plus" />{t.ajouter}</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{t.colonnes.numero}</th><th>{t.colonnes.immeuble}</th><th>{t.colonnes.classe}</th><th>{t.colonnes.emission}</th><th>{t.colonnes.validite}</th><th>{t.colonnes.expert}</th></tr></thead>
              <tbody>{all.map(it => (
                <tr key={it.id}>
                  <td>{it.numero}</td>
                  <td>{it.edificio}</td>
                  <td><Pill kind={classePill(it.classe, t.classesPerformantes, t.classesEnergivores)}>{it.classe}</Pill></td>
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
        <ModalHead icon="bolt" id="ce-modal-title" title={f.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label={f.numero} required name="ce-num" error={errors.numero}>
                <input type="text" placeholder={f.numeroPlaceholder} value={form.numero} onChange={e => upd('numero', e.target.value)} />
              </Field>
              <Field label={f.classe} name="ce-classe">
                <select value={form.classe} onChange={e => upd('classe', e.target.value)}>
                  {t.classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </FormRow>
            <Field label={f.immeuble} required full name="ce-edif" error={errors.edificio}>
              <input type="text" placeholder={f.immeublePlaceholder} value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={f.emission} required name="ce-emit" error={errors.dataEmissao}>
                <input type="date" value={form.dataEmissao} onChange={e => upd('dataEmissao', e.target.value)} />
              </Field>
              <Field label={f.validite} hint={f.validiteAide} name="ce-valid">
                <input type="date" value={form.dataValidade} onChange={e => upd('dataValidade', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={f.expert} full name="ce-perito">
              <input type="text" placeholder={f.expertPlaceholder} value={form.perito} onChange={e => upd('perito', e.target.value)} />
            </Field>
            <Field label={f.notes} full name="ce-notas">
              <textarea rows={3} value={form.notas} onChange={e => upd('notas', e.target.value)} />
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
