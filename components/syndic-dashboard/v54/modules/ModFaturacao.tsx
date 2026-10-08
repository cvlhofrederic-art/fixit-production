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
import { FATURACAO_MESSAGES } from './i18n/ModFaturacao.messages'

/**
 * Faturação & Recibos Verdes — port byte-exact V5.7 + Phase 3 : factures condomínio réelles
 * (table existante syndic_factures_copro) : liste + émission (montant TTC calculé serveur).
 */

const eur = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n)
const fmtEUR = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)
const statutKind = (v: string): PillKind => (({ a_regler: 'amber', partiellement_regle: 'gold', reglee: 'sage', contestee: 'rust', annulee: 'rust' } as Record<string, PillKind>)[v] || 'amber')

export default function ModFaturacao() {
  const t = useMessages(FATURACAO_MESSAGES)
  const locale = useV54Locale()
  const statutLabel = (v: string) => t.statuts[v] || v
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.faturas ?? []) : []
  const coName = (id: string) => (data.coproprios ?? []).find((c) => c.id === id)?.proprietario || '—'

  const faturado = all.reduce((s, f) => s + f.montantTtc, 0)
  const aRegular = all.filter((f) => f.statut === 'a_regler' || f.statut === 'partiellement_regle').length
  const liquidadas = all.filter((f) => f.statut === 'reglee').length

  const { push } = useToast()
  const today = jourCivilLocal()
  const blank = { numeroFatura: '', coproprioId: '', immeubleId: '', emiseLe: today, echeance: '', montantHt: '', tvaTaux: t.tauxTvaParDefaut, description: '', statut: 'a_regler' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm({ ...blank, emiseLe: today }); setErrors({}); setOpen(true) }
  const ttc = (Number(form.montantHt) || 0) * (1 + (Number(form.tvaTaux) || 0) / 100)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.montantHt || Number(form.montantHt) < 0) errs.montantHt = t.erreurs.montantHt
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/factures-copro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ numeroFatura: form.numeroFatura, coproprioId: form.coproprioId, immeubleId: form.immeubleId, emiseLe: form.emiseLe, echeance: form.echeance, montantHt: Number(form.montantHt), tvaTaux: Number(form.tvaTaux) || 0, description: form.description, statut: form.statut }),
      })
        .then((r) => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: t.toasts.emise, desc: fmtEUR(ttc, locale) }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurEmission, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: t.toasts.emiseDemo, desc: t.toasts.connexionRequise })
  }

  const fo = t.formulaire
  return (
    <>
      <PageHead
        title={t.titre}
        lede={t.chapeau}
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.emettre}</Button>}
      />
      <KPIGrid items={[
        { icon: 'coin', num: real ? eur(faturado, locale) : '0', cur: '€', lbl: t.kpi.totalFacture, sub: t.kpi.nbFactures(real ? all.length : 0), accent: 'gold' },
        { icon: 'doc', num: real ? all.length : 0, lbl: t.kpi.emises },
        { icon: 'clock', num: real ? aRegular : 0, lbl: t.kpi.aRegler, accent: aRegular ? 'amber' : undefined },
        { icon: 'check', num: real ? liquidadas : 0, lbl: t.kpi.reglees, accent: liquidadas ? 'sage' : undefined },
      ]} />
      <Tabs defaultActive="fat" tabs={[
        { id: 'fat', icon: 'doc', label: t.onglets.factures },
        { id: 'tr', icon: 'archive', label: t.onglets.transferts },
        { id: 'rv', icon: 'doc', label: t.onglets.specifique },
      ]} />
      <Panel title={t.panneau} flush={all.length > 0}>
        {all.length === 0 ? (
          <Empty illustration="faturas" title={t.vide.titre} desc={t.vide.description}
            action={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.emettre}</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{t.colonnes.numero}</th><th>{t.colonnes.coproprietaire}</th><th>{t.colonnes.emise}</th><th>{t.colonnes.echeance}</th><th>{t.colonnes.montantTtc}</th><th>{t.colonnes.statut}</th></tr></thead>
              <tbody>{all.map((f) => (
                <tr key={f.id}>
                  <td>{f.numeroFatura || '—'}</td>
                  <td>{coName(f.coproprioId)}</td>
                  <td>{dateApi(f.emiseLe, locale) || '—'}</td>
                  <td>{dateApi(f.echeance, locale) || '—'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(f.montantTtc, locale)}</td>
                  <td><Pill kind={statutKind(f.statut)}>{statutLabel(f.statut)}</Pill></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="fat-title" size="md">
        <ModalHead icon="doc" id="fat-title" title={fo.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label={fo.numero} name="fat-num">
                <input type="text" placeholder={fo.numeroPlaceholder} value={form.numeroFatura} onChange={(e) => upd('numeroFatura', e.target.value)} />
              </Field>
              <Field label={fo.coproprietaire} name="fat-cond">
                <select value={form.coproprioId} onChange={(e) => upd('coproprioId', e.target.value)}>
                  <option value="">{fo.choisir}</option>
                  {(data.coproprios ?? []).map((c) => <option key={c.id} value={c.id}>{c.proprietario || c.numeroPorte || c.id}</option>)}
                </select>
              </Field>
            </FormRow>
            <FormRow>
              <Field label={fo.dateEmission} name="fat-emit">
                <input type="date" value={form.emiseLe} onChange={(e) => upd('emiseLe', e.target.value)} />
              </Field>
              <Field label={fo.echeance} name="fat-venc">
                <input type="date" value={form.echeance} onChange={(e) => upd('echeance', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={fo.montantHt} required suffix="€" name="fat-ht" error={errors.montantHt}>
                <input type="number" step="0.01" min="0" placeholder="0" value={form.montantHt} onChange={(e) => upd('montantHt', e.target.value)} />
              </Field>
              <Field label={fo.tva} hint={fo.ttc(fmtEUR(ttc, locale))} suffix="%" name="fat-tva">
                <input type="number" step="0.1" min="0" max="100" value={form.tvaTaux} onChange={(e) => upd('tvaTaux', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={fo.description} full name="fat-desc">
              <textarea rows={3} value={form.description} onChange={(e) => upd('description', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{fo.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{fo.emettre}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
