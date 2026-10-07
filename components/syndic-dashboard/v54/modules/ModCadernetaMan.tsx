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
import { downloadReportPdf } from '@/lib/syndic/v54/report-pdf'
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { CADERNETA_MESSAGES } from './i18n/ModCadernetaMan.messages'

/** Caderneta de Manutenção & Técnica — port byte-exact V5.7 + Phase 3 : interventions réelles.
 * Syndic connecté → vraies interventions du cabinet (data.caderneta) + création POST ;
 * anonyme → preview (Empty byte-exact + toast démo). */

type CadForm = { data: string; estado: string; natureza: string; edificio: string; localizacao: string; prestador: string; custo: string; garantia: string; cee: string; notas: string }

const fmtEUR = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)
const estadoKind = (v: string): PillKind => (({ realizado: 'sage', planeado: 'gold', 'em-curso': 'amber', cancelado: 'rust' } as Record<string, PillKind>)[v])

export default function ModCadernetaMan() {
  const t = useMessages(CADERNETA_MESSAGES)
  const locale = useV54Locale()
  const naturezaLabel = (v: string) => (t.natures as Record<string, string>)[v] || v
  const estadoLabel = (v: string) => (t.etats as Record<string, string>)[v] || v
  // Phase 3 : vraies interventions du cabinet si syndic connecté, sinon preview vide.
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.caderneta ?? []) : []

  const blank: CadForm = { data: new Date().toISOString().slice(0, 10), estado: 'realizado', natureza: '', edificio: '', localizacao: '', prestador: '', custo: '', garantia: '', cee: 'na', notas: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CadForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof CadForm, string>>>({})
  const [busy, setBusy] = useState(false)
  const { push } = useToast()

  const upd = (k: keyof CadForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm({ ...blank, data: new Date().toISOString().slice(0, 10) }); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof CadForm, string>> = {}
    if (!form.data) errs.data = t.erreurs.date
    if (!form.natureza) errs.natureza = t.erreurs.nature
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/caderneta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ data: form.data, estado: form.estado, natureza: form.natureza, edificio: form.edificio, localizacao: form.localizacao, prestador: form.prestador, custo: Number(form.custo) || 0, garantia: form.garantia, cee: form.cee, notas: form.notas }),
      })
        .then(r => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: t.toasts.enregistree, desc: form.natureza }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreur, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: t.toasts.enregistreeDemo, desc: t.toasts.connexionRequise })
  }

  const total = all.reduce((s, i) => s + (Number(i.custo) || 0), 0)
  const planeadas = all.filter(i => i.estado === 'planeado').length
  const edifSet = new Set(all.map(i => i.edificio).filter(Boolean))

  const exportPdf = () => {
    if (!real || all.length === 0) { push({ kind: 'info', title: t.toasts.exportTitre, desc: real ? t.toasts.exportPremiere : t.toasts.exportConnexion }); return }
    const eur = (n: number) => `${(n || 0).toLocaleString(locale)} €`
    const p = t.pdf
    downloadReportPdf(p.fichier, {
      title: p.titre,
      subtitle: p.sousTitre,
      kpis: [
        { label: p.kpi.interventions, value: String(all.length) },
        { label: p.kpi.planifiees, value: String(planeadas) },
        { label: p.kpi.coutTotal, value: eur(total) },
        { label: p.kpi.immeubles, value: String(edifSet.size) },
      ],
      tables: [{ headers: [...p.colonnes], rows: all.map((i) => [i.data || '—', naturezaLabel(i.natureza), i.edificio || '—', i.prestador || '—', eur(Number(i.custo) || 0), estadoLabel(i.estado)]) }],
    }, locale)
  }

  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau}
        actions={<><Button onClick={exportPdf}><Icon name="download" />{t.exporterPdf}</Button><Button variant="gold" onClick={openNew}><Icon name="plus" />{t.nouvelleIntervention}</Button></>} />
      <Tabs defaultActive="cad" tabs={[
        { id: 'cad', icon: 'book', label: t.onglets.cad },
        { id: 'eq', icon: 'cog', label: t.onglets.eq },
        { id: 'ct', icon: 'stamp', label: t.onglets.ct },
        { id: 'est', icon: 'clipboard', label: t.onglets.est },
        { id: 'cee', icon: 'book', label: t.onglets.cee },
      ]} />
      <KPIGrid items={[
        { icon: 'clipboard', num: all.length, lbl: t.kpi.interventions },
        { icon: 'calendar', num: planeadas, lbl: t.kpi.planifiees, accent: planeadas ? 'amber' : undefined },
        { icon: 'coin', num: fmtEUR(total, locale).replace('€', '').trim(), cur: '€', lbl: t.kpi.coutTotal, accent: 'gold' },
        { icon: 'building', num: edifSet.size, lbl: t.kpi.immeubles },
      ]} />
      <Panel>
        {all.length === 0 ? (
          <Empty illustration="documentos" title={t.vide.titre} desc={t.vide.desc}
            action={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.vide.action}</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{t.colonnes.date}</th><th>{t.colonnes.nature}</th><th>{t.colonnes.immeuble}</th><th>{t.colonnes.prestataire}</th><th>{t.colonnes.cout}</th><th>{t.colonnes.garantie}</th><th>{t.colonnes.statut}</th></tr></thead>
              <tbody>{all.map(it => (
                <tr key={it.id}>
                  <td>{it.data}</td>
                  <td>{naturezaLabel(it.natureza)}</td>
                  <td>{it.edificio || '—'}</td>
                  <td>{it.prestador || '—'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(it.custo, locale)}</td>
                  <td>{it.garantia || '—'}</td>
                  <td><Pill kind={estadoKind(it.estado)}>{estadoLabel(it.estado)}</Pill></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="cad-modal-title" size="md">
        <ModalHead icon="clipboard" id="cad-modal-title" title={t.modal.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label={t.modal.date} required name="cad-data" error={errors.data}>
                <input type="date" value={form.data} onChange={e => upd('data', e.target.value)} />
              </Field>
              <Field label={t.modal.statut} name="cad-estado">
                <select value={form.estado} onChange={e => upd('estado', e.target.value)}>
                  <option value="realizado">{t.etats.realizado}</option>
                  <option value="planeado">{t.etats.planeado}</option>
                  <option value="em-curso">{t.etats['em-curso']}</option>
                  <option value="cancelado">{t.etats.cancelado}</option>
                </select>
              </Field>
            </FormRow>
            <Field label={t.modal.nature} required full name="cad-nat" error={errors.natureza}>
              <select value={form.natureza} onChange={e => upd('natureza', e.target.value)}>
                <option value="">{t.modal.choisir}</option>
                <option value="manutencao-corrente">{t.natures['manutencao-corrente']}</option>
                <option value="reparacao">{t.natures.reparacao}</option>
                <option value="diagnostico">{t.natures.diagnostico}</option>
                <option value="obra-conservacao">{t.natures['obra-conservacao']}</option>
                <option value="obra-beneficiacao">{t.natures['obra-beneficiacao']}</option>
                <option value="inspeccao-legal">{t.natures['inspeccao-legal']}</option>
              </select>
            </Field>
            <FormRow>
              <Field label={t.modal.immeuble} name="cad-edif">
                <input type="text" placeholder={t.modal.immeublePlaceholder} value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
              </Field>
              <Field label={t.modal.localisation} name="cad-local">
                <input type="text" placeholder={t.modal.localisationPlaceholder} value={form.localizacao} onChange={e => upd('localizacao', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={t.modal.prestataire} name="cad-prest">
                <input type="text" placeholder={t.modal.prestatairePlaceholder} value={form.prestador} onChange={e => upd('prestador', e.target.value)} />
              </Field>
              <Field label={t.modal.cout} hint={t.modal.coutAide} name="cad-custo" suffix="€">
                <input type="number" step="0.01" min="0" inputMode="decimal" placeholder="0" value={form.custo} onChange={e => upd('custo', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={t.modal.garantie} hint={t.modal.garantieAide} name="cad-gar">
                <input type="text" placeholder={t.modal.garantiePlaceholder} value={form.garantia} onChange={e => upd('garantia', e.target.value)} />
              </Field>
              <Field label={t.modal.classe} hint={t.modal.classeAide} name="cad-cee">
                <select value={form.cee} onChange={e => upd('cee', e.target.value)}>
                  <option value="na">{t.modal.sansObjet}</option>
                  {t.modal.classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </FormRow>
            <Field label={t.modal.notes} full name="cad-notas">
              <textarea rows={3} value={form.notas} onChange={e => upd('notas', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t.modal.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{t.modal.enregistrer}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
