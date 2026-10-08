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
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { dateApi, jourCivilLocal } from '@/lib/syndic/v54/i18n/dates'
import { COBR_AUTO_MESSAGES, type NatureImpaye } from './i18n/ModCobrAuto.messages'

/** Cobrança Automática · Juros & Sanções — port byte-exact V5.7 + Phase 3.
 * Suivi des impayés réels du cabinet (table syndic_impayes existante) : liste, relance (PATCH), ouverture (POST). */

const eur = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n)
const fmtEUR = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)
/** Natures (codes de l'API, dans l'ordre de la liste) ; le libellé vient du dictionnaire. */
const NATURE: NatureImpaye[] = ['charges_courantes', 'travaux', 'fonds_reserve', 'interets_retard', 'frais_relance', 'autre']
const libelle = (v: string, labels: Record<string, string>) => labels[v] || v
const statutKind = (v: string): PillKind => (({ ouvert: 'amber', en_recouvrement: 'rust', solde: 'sage', passe_perte: 'gold' } as Record<string, PillKind>)[v] || 'amber')

export default function ModCobrAuto() {
  const t = useMessages(COBR_AUTO_MESSAGES)
  const locale = useV54Locale()
  const f = t.formulaire
  const natureLabel = (v: string) => libelle(v, t.natures)
  const statutLabel = (v: string) => libelle(v, t.statuts)
  // Phase 3 : vrais impayés du cabinet si syndic connecté, sinon preview vide.
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.impayes ?? []) : []
  const imName = (id: string) => data.immeubles.find((i) => i.id === id)?.nom || '—'
  const coName = (id: string) => (data.coproprios ?? []).find((c) => c.id === id)?.proprietario || '—'

  const aberto = all.filter((i) => i.statut === 'ouvert' || i.statut === 'en_recouvrement')
  const emDivida = aberto.reduce((s, i) => s + i.montant, 0)
  const recuperados = all.filter((i) => i.statut === 'solde').reduce((s, i) => s + i.montant, 0)

  const { push } = useToast()
  const today = jourCivilLocal()
  const blank = { immeubleId: '', coproprioId: '', montant: '', nature: 'charges_courantes', depuis: today, notas: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm({ ...blank, depuis: today }); setErrors({}); setOpen(true) }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.montant || Number(form.montant) <= 0) errs.montant = t.erreurs.montant
    if (!form.depuis) errs.depuis = t.erreurs.date
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/impayes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ immeubleId: form.immeubleId, coproprioId: form.coproprioId, montant: Number(form.montant), nature: form.nature, depuis: form.depuis, notes: form.notas }),
      })
        .then((r) => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: t.toasts.ouvert, desc: `${fmtEUR(Number(form.montant), locale)} · ${natureLabel(form.nature)}` }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurOuverture, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: t.toasts.ouvertDemo, desc: t.toasts.connexionRequise })
  }

  const relancar = (id: string, nb: number) => {
    if (!(real && data.token)) { push({ kind: 'info', title: t.toasts.relanceDemo, desc: t.toasts.connexionSyndic }); return }
    setBusy(true)
    fetch('/api/syndic/impayes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
      body: JSON.stringify({ id, nbRelances: nb + 1, derniereRelanceAt: new Date().toISOString() }),
    })
      .then((r) => { if (!r.ok) throw new Error() })
      .then(() => { data.refresh?.(); push({ kind: 'success', title: t.toasts.relanceEnvoyee, desc: t.toasts.relanceNumero(nb + 1) }) })
      .catch(() => push({ kind: 'error', title: t.toasts.erreurRelance, desc: t.toasts.reessayerPlusTard }))
      .finally(() => setBusy(false))
  }

  return (
    <>
      <PageHead
        title={t.titre}
        lede={t.chapeau}
        actions={<Button variant="primary" onClick={openNew}><Icon name="plus" />{t.nouveau}</Button>}
      />
      <KPIGrid items={[
        { num: real ? eur(emDivida, locale) : '0', cur: '€', lbl: t.kpi.enCours, accent: 'rust' },
        { num: real ? aberto.length : 0, lbl: t.kpi.actifs, accent: 'amber' },
        { num: real ? eur(recuperados, locale) : '0', cur: '€', lbl: t.kpi.recouvres, accent: 'sage' },
      ]} />
      <Tabs defaultActive="proc" tabs={[
        { id: 'proc', icon: 'refresh', label: t.onglets.proc },
        { id: 'js', icon: 'scale', label: t.onglets.js },
      ]} />
      <Panel flush={all.length > 0}>
        {all.length === 0 ? (
          <Empty illustration="pagamentos" title={t.vide.titre} desc={t.vide.desc}
            action={<Button variant="primary" onClick={openNew}><Icon name="plus" />{t.nouveau}</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{t.colonnes.coproprietaire}</th><th>{t.colonnes.immeuble}</th><th>{t.colonnes.nature}</th><th>{t.colonnes.montant}</th><th>{t.colonnes.depuis}</th><th>{t.colonnes.relances}</th><th>{t.colonnes.statut}</th><th></th></tr></thead>
              <tbody>{all.map((it) => (
                <tr key={it.id}>
                  <td>{coName(it.coproprioId)}</td>
                  <td>{imName(it.immeubleId)}</td>
                  <td>{natureLabel(it.nature)}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(it.montant, locale)}</td>
                  <td>{dateApi(it.depuis, locale) || '—'}</td>
                  <td>{it.nbRelances}</td>
                  <td><Pill kind={statutKind(it.statut)}>{statutLabel(it.statut)}</Pill></td>
                  <td>{(it.statut === 'ouvert' || it.statut === 'en_recouvrement') && <Button size="sm" onClick={() => relancar(it.id, it.nbRelances)} disabled={busy}><Icon name="mail" />{t.relancer}</Button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="cob-title" size="md">
        <ModalHead icon="coin" id="cob-title" title={f.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label={f.immeuble} name="cob-edif">
                <select value={form.immeubleId} onChange={(e) => upd('immeubleId', e.target.value)}>
                  <option value="">{f.choisir}</option>
                  {data.immeubles.map((i) => <option key={i.id} value={i.id}>{i.nom}</option>)}
                </select>
              </Field>
              <Field label={f.coproprietaire} name="cob-cond">
                <select value={form.coproprioId} onChange={(e) => upd('coproprioId', e.target.value)}>
                  <option value="">{f.choisir}</option>
                  {(data.coproprios ?? []).map((c) => <option key={c.id} value={c.id}>{c.proprietario || c.numeroPorte || c.id}</option>)}
                </select>
              </Field>
            </FormRow>
            <FormRow>
              <Field label={f.montant} required suffix="€" name="cob-mont" error={errors.montant}>
                <input type="number" step="0.01" min="0" placeholder="0" value={form.montant} onChange={(e) => upd('montant', e.target.value)} />
              </Field>
              <Field label={f.nature} name="cob-nat">
                <select value={form.nature} onChange={(e) => upd('nature', e.target.value)}>
                  {NATURE.map((k) => <option key={k} value={k}>{t.natures[k]}</option>)}
                </select>
              </Field>
            </FormRow>
            <Field label={f.depuis} required name="cob-dep" error={errors.depuis}>
              <input type="date" value={form.depuis} onChange={(e) => upd('depuis', e.target.value)} />
            </Field>
            <Field label={f.notes} full name="cob-notas">
              <textarea rows={3} value={form.notas} onChange={(e) => upd('notas', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{f.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{f.ouvrir}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
