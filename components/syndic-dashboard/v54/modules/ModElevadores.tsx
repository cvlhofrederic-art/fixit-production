'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Alert } from '../primitives/alert'
import { Pill } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import { useDocumentUpload } from './use-document-upload'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { ELEVADORES_MESSAGES } from './i18n/ModElevadores.messages'

/** Gestão de Elevadores — port byte-exact V5.7 + Phase 3 : parc réel. */

const estadoKind = (s: string): 'sage' | 'amber' | 'rust' => (s === 'atraso' ? 'rust' : s === 'prazo' ? 'amber' : 'sage')

export default function ModElevadores() {
  const t = useMessages(ELEVADORES_MESSAGES)
  const estadoLabel = (s: string): string => (s === 'atraso' ? t.etats.atraso : s === 'prazo' ? t.etats.prazo : t.etats.conforme)
  // Phase 3 : vrai parc d'ascenseurs si syndic connecté, sinon mock/empty (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.elevadores ?? []) : []

  const registados = all.length
  const conformes = all.filter((e) => e.estado === 'conforme').length
  const prazo = all.filter((e) => e.estado === 'prazo').length
  const atraso = all.filter((e) => e.estado === 'atraso').length
  const emas = all.filter((e) => e.ema.trim()).length

  // Phase 3 écritures : « + Registar elevador » → POST /api/syndic/elevadores.
  const { push } = useToast()
  const upload = useDocumentUpload()
  const blank = { immeuble: '', marca: '', categoria: 'habitacional', ema: '', ultimaInspecao: '', proximaInspecao: '', estado: 'conforme' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.immeuble.trim()) errs.immeuble = t.erreurs.immeuble
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/elevadores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ immeuble: form.immeuble, marca: form.marca, categoria: form.categoria, ema: form.ema, ultimaInspecao: form.ultimaInspecao, proximaInspecao: form.proximaInspecao, estado: form.estado }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: t.toasts.enregistre, desc: form.immeuble }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreur, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: t.toasts.enregistreDemo, desc: t.toasts.connexionRequise })
  }

  const a = t.alerte
  const c = t.colonnes
  const f = t.formulaire
  return (
    <>
      <PageHead eyebrow={t.surtitre} title={t.titre}
        lede={t.chapeau}
        actions={<><Button onClick={openNew}><Icon name="plus" />{t.enregistrer}</Button><Button variant="gold" onClick={upload('autre')}><Icon name="upload" />{t.importerRapport}</Button></>} />
      <Alert kind="gold" icon="scale" title={a.titre}>
        <strong>{a.lignes[0][0]}</strong>{a.lignes[0][1]}<br />
        <strong>{a.lignes[1][0]}</strong>{a.lignes[1][1]}<br />
        <strong>{a.lignes[2][0]}</strong>{a.lignes[2][1]}<br />
        {a.finAvant}<strong>{a.finFort}</strong>{a.finApres}
      </Alert>
      <KPIGrid items={[
        { icon: 'monitor', num: real ? registados : 0, lbl: t.kpi.enregistres },
        { icon: 'check', num: real ? conformes : 0, lbl: t.kpi.conformes, accent: 'sage' },
        { icon: 'clock', num: real ? prazo : 0, lbl: t.kpi.prochesEcheance, accent: 'amber' },
        { icon: 'ban', num: real ? atraso : 0, lbl: t.kpi.enRetard, accent: 'rust' },
        { icon: 'shield', num: real ? emas : 0, lbl: t.kpi.contrats },
        { icon: 'alert', num: 0, lbl: t.kpi.signalements, accent: 'rust' },
      ]} />
      <Tabs defaultActive="elev" tabs={[
        { id: 'elev', icon: 'monitor', label: t.onglets.ascenseurs(real ? registados : 0) },
        { id: 'insp', icon: 'clipboard', label: t.onglets.controles },
        { id: 'ema', icon: 'shield', label: t.onglets.contrats(real ? emas : 0) },
        { id: 'risco', icon: 'alert', label: t.onglets.risques },
      ]} />
      <Panel flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>{c.immeuble}</th><th>{c.marque}</th><th>{c.categorie}</th><th>{c.periodicite}</th><th>{c.dernier}</th><th>{c.prochain}</th><th>{c.entretien}</th><th>{c.etat}</th></tr></thead>
            <tbody>
              {all.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--v54-navy-400)' }}>{t.aucunAscenseur}</td></tr>
              ) : all.map((e) => (
                <tr key={e.id}>
                  <td>{e.immeuble || '—'}</td>
                  <td>{e.marca || '—'}</td>
                  <td>{t.categories[e.categoria] ?? e.categoria}</td>
                  <td>{t.periodicites[e.categoria] ?? '—'}</td>
                  <td>{e.ultimaInspecao || '—'}</td>
                  <td>{e.proximaInspecao || '—'}</td>
                  <td>{e.ema || '—'}</td>
                  <td><Pill kind={estadoKind(e.estado)} noDot>{estadoLabel(e.estado)}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title={t.procedure.titre} sub={t.procedure.sousTitre}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {t.procedure.etapes.map(([n, titre, s], i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 14px', background: 'var(--v54-cream)', borderRadius: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--v54-rust-500)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>{n}</div>
              <div><div style={{ fontWeight: 600, fontSize: 13 }}>{titre}</div><div style={{ fontSize: 12, color: 'var(--v54-navy-400)' }}>{s}</div></div>
            </div>
          ))}
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="ne-title" size="md">
        <ModalHead icon="monitor" id="ne-title" title={f.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label={f.immeuble} required name="ne-imovel" error={errors.immeuble}>
                <input type="text" placeholder={f.nomImmeuble} value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
              </Field>
              <Field label={f.marque} name="ne-marca">
                <input type="text" placeholder={f.marqueExemple} value={form.marca} onChange={(e) => upd('marca', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={f.categorie} name="ne-cat">
                <select value={form.categoria} onChange={(e) => upd('categoria', e.target.value)}>
                  <option value="comercial">{f.optionsCategorie.comercial}</option>
                  <option value="misto">{f.optionsCategorie.misto}</option>
                  <option value="habitacional">{f.optionsCategorie.habitacional}</option>
                </select>
              </Field>
              <Field label={f.etat} name="ne-estado">
                <select value={form.estado} onChange={(e) => upd('estado', e.target.value)}>
                  <option value="conforme">{f.optionsEtat.conforme}</option>
                  <option value="prazo">{f.optionsEtat.prazo}</option>
                  <option value="atraso">{f.optionsEtat.atraso}</option>
                </select>
              </Field>
            </FormRow>
            <Field label={f.entretien} full name="ne-ema">
              <input type="text" placeholder={f.entretienExemple} value={form.ema} onChange={(e) => upd('ema', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={f.dernier} name="ne-ult">
                <input type="text" placeholder={f.formatDate} value={form.ultimaInspecao} onChange={(e) => upd('ultimaInspecao', e.target.value)} />
              </Field>
              <Field label={f.prochain} name="ne-prox">
                <input type="text" placeholder={f.formatDate} value={form.proximaInspecao} onChange={(e) => upd('proximaInspecao', e.target.value)} />
              </Field>
            </FormRow>
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
