'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Pill } from '../primitives/pill'
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
import { dateApi } from '@/lib/syndic/v54/i18n/dates'
import { SEGUROS_MESSAGES } from './i18n/ModSeguros.messages'

/** Gestão de Seguros — port byte-exact V5.7 + Phase 3 : apólices réelles. */

const selectStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 14 } as const

const eur = (n: number, locale: V54Locale) => `${(n || 0).toLocaleString(locale)} €`
const statusKind = (s: string): 'sage' | 'amber' | 'rust' => (s === 'expirada' ? 'rust' : s === 'renovacao' ? 'amber' : 'sage')
const statusLabel = (s: string, l: { expirada: string; renovacao: string; ativa: string }): string => (s === 'expirada' ? l.expirada : s === 'renovacao' ? l.renovacao : l.ativa)

export default function ModSeguros() {
  const t = useMessages(SEGUROS_MESSAGES)
  const locale = useV54Locale()
  const tipoLabels: Record<string, string> = t.types
  // Phase 3 : vraies apólices du cabinet si syndic connecté, sinon mock/empty (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.seguros ?? []) : []

  const ativas = all.filter((s) => s.statut === 'ativa').length
  const expiradas = all.filter((s) => s.statut === 'expirada').length
  const aExpirar = all.filter((s) => s.statut === 'renovacao').length
  const premios = all.reduce((acc, s) => acc + (s.premioAnual || 0), 0)
  const capital = all.reduce((acc, s) => acc + (s.capital || 0), 0)

  // Phase 3 écritures : « + Nova Apólice » → POST /api/syndic/seguros.
  const { push } = useToast()
  const blank = { seguradora: '', tipo: 'multirriscos', apolice: '', premioAnual: '', capital: '', immeuble: '', dataFim: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.seguradora.trim()) errs.seguradora = t.erreurAssureur
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/seguros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ seguradora: form.seguradora, tipo: form.tipo, apolice: form.apolice, premioAnual: Number(form.premioAnual) || 0, capital: Number(form.capital) || 0, immeuble: form.immeuble, dataFim: form.dataFim }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: t.toasts.ajoutee, desc: form.seguradora }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurAjout, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: t.toasts.ajouteeDemo, desc: t.toasts.connexionRequise })
  }

  const f = t.formulaire
  return (
    <>
      <PageHead
        title={t.titre}
        lede={t.chapeau}
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.nouvellePolice}</Button>}
      />
      <KPIGrid items={[
        { icon: 'shield', num: real ? ativas : 0, lbl: t.kpi.actives, accent: 'gold' },
        { icon: 'check', num: real ? expiradas : 0, lbl: t.kpi.expirees, accent: 'sage' },
        { icon: 'clock', num: real ? aExpirar : 0, lbl: t.kpi.aEcheance, accent: 'amber' },
        { icon: 'coin', num: real ? eur(premios, locale) : '0 €', lbl: t.kpi.primes },
        { icon: 'bank', num: real ? eur(capital, locale) : '0 €', lbl: t.kpi.capital },
      ]} />
      <Tabs defaultActive="vg" tabs={[
        { id: 'vg', icon: 'chart', label: t.onglets.vg },
        { id: 'ap', icon: 'shield', label: t.onglets.ap },
        { id: 'sn', icon: 'alert', label: t.onglets.sn },
        { id: 'al', icon: 'bell', label: t.onglets.al },
      ]} />
      <select aria-label={t.filtreAria} style={selectStyle}><option>{t.tousImmeubles}</option></select>
      <Panel>
        {all.length === 0 ? (
          <Empty illustration="condominos" title={t.vide} />
        ) : (
          <div>
            {all.map((s) => (
              <div key={s.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--v54-line)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 18, fontWeight: 500 }}>{s.seguradora}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--v54-navy-300)', marginTop: 2 }}>{tipoLabels[s.tipo] ?? s.tipo}{s.apolice ? ` · ${s.apolice}` : ''}{s.immeuble ? ` · ${s.immeuble}` : ''}</div>
                </div>
                <Pill kind={statusKind(s.statut)} noDot>{statusLabel(s.statut, t.statuts)}</Pill>
                <div style={{ textAlign: 'right', minWidth: 130 }}>
                  <div className={m.mono} style={{ fontWeight: 600 }}>{eur(s.premioAnual, locale)}{t.liste.parAn}</div>
                  {s.capital > 0 && <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{t.liste.capital}{eur(s.capital, locale)}</div>}
                  {s.dataFim && <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{t.liste.fin}{dateApi(s.dataFim, locale)}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="ns-title" size="md">
        <ModalHead icon="shield" id="ns-title" title={f.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label={f.assureur} required full name="ns-seg" error={errors.seguradora}>
              <input type="text" placeholder={f.assureurPlaceholder} value={form.seguradora} onChange={(e) => upd('seguradora', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={f.type} name="ns-tipo">
                <select value={form.tipo} onChange={(e) => upd('tipo', e.target.value)}>
                  <option value="multirriscos">{t.types.multirriscos}</option>
                  <option value="responsabilidade_civil">{t.types.responsabilidade_civil}</option>
                  <option value="incendio">{t.types.incendio}</option>
                  <option value="outros">{t.types.outros}</option>
                </select>
              </Field>
              <Field label={f.numero} name="ns-apol">
                <input type="text" placeholder={f.facultatif} value={form.apolice} onChange={(e) => upd('apolice', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={f.prime} name="ns-premio">
                <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.premioAnual} onChange={(e) => upd('premioAnual', e.target.value)} />
              </Field>
              <Field label={f.capital} name="ns-cap">
                <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.capital} onChange={(e) => upd('capital', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={f.immeuble} name="ns-imovel">
                <input type="text" placeholder={f.facultatif} value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
              </Field>
              <Field label={f.dateFin} name="ns-fim">
                <input type="text" placeholder={f.dateFinPlaceholder} value={form.dataFim} onChange={(e) => upd('dataFim', e.target.value)} />
              </Field>
            </FormRow>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{f.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{f.ajouter}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
