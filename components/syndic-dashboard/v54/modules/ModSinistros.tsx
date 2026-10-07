'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Pill, type PillKind } from '../primitives/pill'
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
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { SINISTROS_MESSAGES, type StatutSinistre } from './i18n/ModSinistros.messages'

/** Pipeline Sinistros — port byte-exact V5.7 + Phase 3 : sinistres réels. */

// icon · statut · couleur (le libellé de l'étape vient du dictionnaire)
const STAGES: readonly (readonly [IconName, StatutSinistre, string])[] = [
  ['alert', 'declarado', 'rust'],
  ['wrench', 'atribuido', 'amber'],
  ['search', 'peritagem', 'gold'],
  ['wrench', 'resolucao', 'sage'],
  ['coin', 'indemnizado', 'sage'],
  ['check', 'encerrado', 'sage'],
]
const eur = (n: number, locale: V54Locale) => `${(n || 0).toLocaleString(locale)} €`
const statutKind = (s: string): PillKind => (s === 'declarado' ? 'rust' : s === 'atribuido' ? 'amber' : s === 'peritagem' ? 'gold' : 'sage')

export default function ModSinistros() {
  const t = useMessages(SINISTROS_MESSAGES)
  const locale = useV54Locale()
  // Statut stocké → libellé (repli sur la valeur brute si inconnue).
  const statutLabel: Readonly<Record<string, string | undefined>> = t.statuts
  // Phase 3 : vrais sinistres du cabinet si syndic connecté, sinon mock/empty (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.sinistros ?? []) : []

  const countByStatut = (st: string) => all.filter((s) => s.statut === st).length
  const ativos = all.filter((s) => s.statut !== 'encerrado').length
  const urgencias = all.filter((s) => s.urgente).length
  const montante = all.reduce((acc, s) => acc + (s.montanteEstimado || 0), 0)
  const indemniz = all.reduce((acc, s) => acc + (s.indemnizacao || 0), 0)

  // Phase 3 écritures : « + Novo sinistro » → POST /api/syndic/sinistros.
  const { push } = useToast()
  const blank = { immeuble: '', tipo: '', descricao: '', seguradora: '', montanteEstimado: '', statut: 'declarado', urgente: 'nao' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.tipo.trim()) errs.tipo = t.erreurType
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/sinistros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ immeuble: form.immeuble, tipo: form.tipo, descricao: form.descricao, seguradora: form.seguradora, montanteEstimado: Number(form.montanteEstimado) || 0, statut: form.statut, urgente: form.urgente === 'sim' }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: t.toasts.declare, desc: form.tipo }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurDeclaration, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: t.toasts.declareDemo, desc: t.toasts.connexionRequise })
  }

  const f = t.formulaire
  return (
    <>
      <PageHead
        title={t.titre}
        lede={t.chapeau}
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.nouveau}</Button>}
      />
      <KPIGrid items={[
        { icon: 'shield', num: real ? ativos : 0, lbl: t.kpi.actifs },
        { icon: 'alert', num: real ? urgencias : 0, lbl: t.kpi.urgences, accent: 'rust' },
        { icon: 'coin', num: real ? eur(montante, locale) : '0 €', lbl: t.kpi.montant, accent: 'gold' },
        { icon: 'check', num: real ? eur(indemniz, locale) : '0 €', lbl: t.kpi.indemnisations, accent: 'sage' },
      ]} />
      <Panel title={t.panneau} flush>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 0, padding: '20px 22px' }}>
          {STAGES.map(([icon, st, cor], i) => { const label = t.etapes[st]; return (
            <div key={label} style={{ textAlign: 'center', padding: 12, borderRight: i < 5 ? '1px dashed var(--v54-line)' : 'none' }}>
              <div style={{ marginBottom: 8, color: `var(--v54-${cor}-700)` }}><Icon name={icon} style={{ width: 24, height: 24 }} /></div>
              <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 6, color: 'var(--v54-navy-500)' }}>{label}</div>
              <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 24, color: `var(--v54-${cor}-700)` }}>{real ? countByStatut(st) : 0}</div>
            </div>
          ) })}
        </div>
      </Panel>
      {all.length === 0 ? (
        <Panel>
          <Empty
            kind="gold"
            illustration="seguros"
            title={t.vide.titre}
            desc={t.vide.desc}
            action={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.vide.action}</Button>}
          />
        </Panel>
      ) : (
        <Panel flush>
          {all.map((s) => (
            <div key={s.id} style={{ padding: '16px 22px', borderBottom: '1px solid var(--v54-line)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 17, fontWeight: 500 }}>{(s.tipo && t.typeAffiche(s.tipo)) || t.sinistreParDefaut}{s.urgente ? ' ⚠' : ''}</div>
                <div style={{ fontSize: 12.5, color: 'var(--v54-navy-300)', marginTop: 2 }}>{[s.immeuble, s.seguradora, s.descricao].filter(Boolean).join(' · ')}</div>
              </div>
              <Pill kind={statutKind(s.statut)} noDot>{statutLabel[s.statut] ?? s.statut}</Pill>
              <div style={{ textAlign: 'right', minWidth: 110 }} className={m.mono}>{eur(s.montanteEstimado, locale)}</div>
            </div>
          ))}
        </Panel>
      )}

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="nsi-title" size="md">
        <ModalHead icon="shield" id="nsi-title" title={f.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label={f.type} required name="nsi-tipo" error={errors.tipo}>
                <input type="text" placeholder={f.typePlaceholder} value={form.tipo} onChange={(e) => upd('tipo', e.target.value)} />
              </Field>
              <Field label={f.immeuble} name="nsi-imovel">
                <input type="text" placeholder={f.facultatif} value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={f.description} full name="nsi-desc">
              <textarea rows={3} placeholder={f.descriptionPlaceholder} value={form.descricao} onChange={(e) => upd('descricao', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={f.assureur} name="nsi-seg">
                <input type="text" placeholder={f.facultatif} value={form.seguradora} onChange={(e) => upd('seguradora', e.target.value)} />
              </Field>
              <Field label={f.montant} name="nsi-mont">
                <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.montanteEstimado} onChange={(e) => upd('montanteEstimado', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={f.statut} name="nsi-statut">
                <select value={form.statut} onChange={(e) => upd('statut', e.target.value)}>
                  <option value="declarado">{t.etapes.declarado}</option>
                  <option value="atribuido">{t.etapes.atribuido}</option>
                  <option value="peritagem">{t.etapes.peritagem}</option>
                  <option value="resolucao">{t.etapes.resolucao}</option>
                  <option value="indemnizado">{t.etapes.indemnizado}</option>
                  <option value="encerrado">{t.etapes.encerrado}</option>
                </select>
              </Field>
              <Field label={f.urgent} name="nsi-urg">
                <select value={form.urgente} onChange={(e) => upd('urgente', e.target.value)}>
                  <option value="nao">{f.non}</option>
                  <option value="sim">{f.oui}</option>
                </select>
              </Field>
            </FormRow>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{f.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{f.declarer}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
