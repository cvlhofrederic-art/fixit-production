'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Alert } from '../primitives/alert'
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
import { REEMBOLSOS_MESSAGES, type StatutReembolso } from './i18n/ModReembolsos.messages'

/** Reembolsos Automáticos — port byte-exact V5.7 + Phase 3 : reembolsos réels. */

const codeStyle = { fontFamily: 'var(--v54-font-mono)', background: 'var(--v54-cream)', padding: '2px 6px', borderRadius: 3 } as const
const eur = (n: number, locale: V54Locale) => `${(n || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
const statutKind = (s: string): PillKind => (s === 'liquidado' ? 'sage' : s === 'bloqueado' ? 'rust' : 'amber')

export default function ModReembolsos() {
  const t = useMessages(REEMBOLSOS_MESSAGES)
  const locale = useV54Locale()
  // Phase 3 : vrais reembolsos du cabinet si syndic connecté, sinon mock/empty (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.reembolsos ?? []) : []
  const [tab, setTab] = useState('pend')
  const shown = tab === 'pend' ? all.filter((r) => r.statut === 'pendente') : tab === 'liq' ? all.filter((r) => r.statut === 'liquidado') : all

  const liquidadosN = all.filter((r) => r.statut === 'liquidado').length
  const totalLiquidado = all.filter((r) => r.statut === 'liquidado').reduce((s, r) => s + (r.montanteReembolso || 0), 0)
  const aProcessar = all.filter((r) => r.statut === 'pendente').length
  const bloqueados = all.filter((r) => r.statut === 'bloqueado').length

  // Phase 3 écritures : « Registar mudança proprietário » → POST /api/syndic/reembolsos.
  const { push } = useToast()
  const blank = { antigoProprietario: '', immeuble: '', fracao: '', dataVenda: '', quotasPagas: '', montanteReembolso: '', statut: 'pendente' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.antigoProprietario.trim()) errs.antigoProprietario = t.erreurs.ancienProprietaire
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/reembolsos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ antigoProprietario: form.antigoProprietario, immeuble: form.immeuble, fracao: form.fracao, dataVenda: form.dataVenda, quotasPagas: Number(form.quotasPagas) || 0, montanteReembolso: Number(form.montanteReembolso) || 0, statut: form.statut }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: t.toasts.enregistre, desc: form.antigoProprietario }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurEnregistrement, desc: t.toasts.reessayerPlusTard }))
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
        actions={<><Button onClick={openNew}><Icon name="users" />{t.enregistrerMutation}</Button><Button variant="gold" onClick={() => setTab('pend')}><Icon name="refresh" />{t.voirEnAttente}</Button></>} />
      <Alert kind="gold" icon="scale" title={a.titre}>
        {a.debut}<strong>{a.libelleCalcul}</strong>{a.separateur}<code style={codeStyle}>{a.formule}</code>{a.fin}
      </Alert>
      <KPIGrid items={[
        { icon: 'refresh', num: real ? liquidadosN : 0, lbl: t.kpi.traites },
        { icon: 'coin', num: real ? eur(totalLiquidado, locale) : '0,00 €', lbl: t.kpi.totalRembourse, accent: 'gold' },
        { icon: 'clock', num: real ? aProcessar : 0, lbl: t.kpi.aTraiter, accent: 'amber' },
        { icon: 'check', num: real ? eur(totalLiquidado, locale) : '0,00 €', lbl: t.kpi.regleOpenBanking, accent: 'sage' },
        { icon: 'alert', num: real ? bloqueados : 0, lbl: t.kpi.bloques, accent: 'rust' },
        { icon: 'bot', num: 'Max Expert', lbl: t.kpi.moteur },
      ]} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'pend', icon: 'clock', label: t.onglets.pendentes(real ? aProcessar : 0) },
        { id: 'liq', icon: 'check', label: t.onglets.liquidados },
        { id: 'todos', label: t.onglets.todos },
      ]} />
      <Panel flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>{c.ancienProprietaire}</th><th>{c.lot}</th><th>{c.dateVente}</th><th>{c.provisionsVersees}</th><th>{c.joursRestants}</th><th>{c.remboursement}</th><th>{c.methode}</th><th>{c.statut}</th></tr></thead>
            <tbody>
              {shown.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--v54-navy-400)' }}>{t.aucun}</td></tr>
              ) : shown.map((r) => (
                <tr key={r.id}>
                  <td>{r.antigoProprietario || '—'}</td>
                  <td>{r.fracao || '—'}</td>
                  <td>{r.dataVenda || '—'}</td>
                  <td className={m.mono}>{eur(r.quotasPagas, locale)}</td>
                  <td>—</td>
                  <td className={m.mono}>{eur(r.montanteReembolso, locale)}</td>
                  <td>{r.metodo || '—'}</td>
                  <td><Pill kind={statutKind(r.statut)} noDot>{t.statuts[r.statut as StatutReembolso] ?? r.statut}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title={t.pipeline} sub={t.pipelineSous}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {t.etapes.map(([n, titre, s], i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 14px', background: 'var(--v54-cream)', borderRadius: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--v54-gold-500)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>{n}</div>
              <div><div style={{ fontWeight: 600, fontSize: 13 }}>{titre}</div><div style={{ fontSize: 12, color: 'var(--v54-navy-400)' }}>{s}</div></div>
            </div>
          ))}
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="nr-title" size="md">
        <ModalHead icon="users" id="nr-title" title={f.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label={f.ancienProprietaire} required name="nr-prop" error={errors.antigoProprietario}>
                <input type="text" placeholder={f.nomVendeur} value={form.antigoProprietario} onChange={(e) => upd('antigoProprietario', e.target.value)} />
              </Field>
              <Field label={f.lot} name="nr-frac">
                <input type="text" placeholder={f.lotExemple} value={form.fracao} onChange={(e) => upd('fracao', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={f.immeuble} name="nr-imovel">
                <input type="text" placeholder={f.facultatif} value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
              </Field>
              <Field label={f.dateVente} name="nr-data">
                <input type="text" placeholder={f.formatDate} value={form.dataVenda} onChange={(e) => upd('dataVenda', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={f.provisionsVersees} name="nr-quotas">
                <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.quotasPagas} onChange={(e) => upd('quotasPagas', e.target.value)} />
              </Field>
              <Field label={f.remboursement} name="nr-mont">
                <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.montanteReembolso} onChange={(e) => upd('montanteReembolso', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={f.statut} full name="nr-statut">
              <select value={form.statut} onChange={(e) => upd('statut', e.target.value)}>
                <option value="pendente">{t.statuts.pendente}</option>
                <option value="liquidado">{t.statuts.liquidado}</option>
                <option value="bloqueado">{t.statuts.bloqueado}</option>
              </select>
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
