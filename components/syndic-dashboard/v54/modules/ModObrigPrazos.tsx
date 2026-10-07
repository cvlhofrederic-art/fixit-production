'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPI } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Alert } from '../primitives/alert'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import btnCss from '../primitives/button/Button.module.css'
import kpiCss from '../primitives/kpi/KPI.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages, useV54Locale } from '@/lib/syndic/v54/i18n'
import { dateApi } from '@/lib/syndic/v54/i18n/dates'
import { OBRIG_PRAZOS_MESSAGES, type BucketPrazo } from './i18n/ModObrigPrazos.messages'

/** Obrigações Legais — port byte-exact V5.7 + Phase 3 : réutilise la table syndic_prazos.
 * Une obligation ↔ un prazo (edificio↔immeuble, descricao↔titulo, prazo↔dataLimite, notas↔notes).
 * Syndic connecté → vrais prazos du cabinet + création POST /api/syndic/prazos ; anonyme → preview byte-exact.
 * Les codes de type (tipo) sont envoyés tels quels à l'API ; seuls les libellés dépendent de la langue. */

type OPForm = { edificio: string; tipo: string; descricao: string; prazo: string; notas: string }
type Cor = 'sage' | 'gold' | 'amber' | 'rust'

/** Icône et couleur de chaque carte de références légales (textes dans le dictionnaire, même ordre). */
const REFS_STYLE: [IconName, Cor][] = [
  ['construction', 'sage'],
  ['flame', 'gold'],
  ['building', 'sage'],
  ['bolt', 'amber'],
  ['shield', 'sage'],
  ['bank', 'sage'],
  ['target', 'sage'],
  ['alert', 'rust'],
]
const status = (prazo: string): { kind: PillKind; bucket: BucketPrazo } => {
  const days = (new Date(prazo).getTime() - Date.now()) / 86400000
  if (days < 0) return { kind: 'rust', bucket: 'expirado' }
  if (days < 30) return { kind: 'amber', bucket: 'urgente' }
  if (days < 90) return { kind: 'gold', bucket: 'proximo' }
  return { kind: 'sage', bucket: 'emdia' }
}

export default function ModObrigPrazos() {
  const t = useMessages(OBRIG_PRAZOS_MESSAGES)
  const locale = useV54Locale()
  const f = t.formulaire
  const types: Record<string, string> = t.types
  // Phase 3 : une obligation = un prazo (table syndic_prazos, partagée avec ModPrazosLegais).
  const data = useSyndicData()
  const real = data.authenticated
  const items = (real ? (data.prazos ?? []) : []).map((p) => ({
    id: p.id, edificio: p.immeuble, tipo: p.tipo, descricao: p.titulo, prazo: p.dataLimite, notas: p.notes,
  }))

  const today = new Date().toISOString().slice(0, 10)
  const blank: OPForm = { edificio: '', tipo: 'conservacao', descricao: '', prazo: today, notas: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<OPForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof OPForm, string>>>({})
  const [busy, setBusy] = useState(false)
  const { push } = useToast()

  const upd = (k: keyof OPForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof OPForm, string>> = {}
    if (!form.edificio.trim()) errs.edificio = t.erreurs.immeuble
    if (!form.descricao.trim()) errs.descricao = t.erreurs.description
    if (!form.prazo) errs.prazo = t.erreurs.echeance
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/prazos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ immeuble: form.edificio, titulo: form.descricao, tipo: form.tipo, dataLimite: form.prazo, notes: form.notas, statut: 'pendente' }),
      })
        .then((r) => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: t.toasts.enregistree, desc: types[form.tipo] || form.tipo }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreur, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: t.toasts.enregistreeDemo, desc: t.toasts.connexionRequise })
  }

  const counts: Record<BucketPrazo, number> = { expirado: 0, urgente: 0, proximo: 0, emdia: 0 }
  items.forEach((i) => { if (i.prazo) counts[status(i.prazo).bucket]++ })

  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau}
        actions={<><select className={btnCss.btn} aria-label={t.filtreImmeubleAria}><option>{t.tousImmeubles}</option></select><select className={btnCss.btn} aria-label={t.filtreStatutAria}><option>{t.tousStatuts}</option></select><Button variant="gold" onClick={openNew}><Icon name="plus" />{t.ajouter}</Button></>} />
      <Alert kind="gold" icon="scale" title={t.alerteTitre}>
        {t.alerteTexte}
      </Alert>
      <div className={kpiCss.kpiGrid}>
        <KPI dot="rust" accent={counts.expirado ? 'rust' : undefined} num={counts.expirado} lbl={t.kpi.expirado} />
        <KPI dot="amber" accent={counts.urgente ? 'amber' : undefined} num={counts.urgente} lbl={t.kpi.urgente} />
        <KPI dot="gold" num={counts.proximo} lbl={t.kpi.proximo} />
        <KPI dot="sage" accent={counts.emdia ? 'sage' : undefined} num={counts.emdia} lbl={t.kpi.emdia} />
      </div>
      <Panel flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>{t.colonnes.immeuble}</th><th>{t.colonnes.type}</th><th>{t.colonnes.description}</th><th>{t.colonnes.echeance}</th><th>{t.colonnes.statut}</th></tr></thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--v54-navy-300)' }}>{t.vide}</td></tr>
              ) : items.map(it => {
                const st = status(it.prazo)
                return (
                  <tr key={it.id}>
                    <td>{it.edificio}</td>
                    <td>{(types[it.tipo] || it.tipo).split(' (')[0]}</td>
                    <td>{it.descricao}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{dateApi(it.prazo, locale)}</td>
                    <td><Pill kind={st.kind}>{t.statuts[st.bucket]}</Pill></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title={t.referencesTitre}>
        <div className={m.cardGrid}>
          {t.references.map(([titre, s], i) => {
            const [ic, c] = REFS_STYLE[i]
            return (
              <div key={i} style={{ padding: 14, border: '1px solid var(--v54-line)', borderRadius: 10, display: 'flex', gap: 12, background: `var(--v54-${c}-50)`, borderLeft: `3px solid var(--v54-${c}-500)` }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', display: 'grid', placeItems: 'center', color: `var(--v54-${c}-700)` }}><Icon name={ic} /></div>
                <div><div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{titre}</div><div style={{ fontSize: 11.5, color: 'var(--v54-navy-500)' }}>{s}</div></div>
              </div>
            )
          })}
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="op-modal-title" size="md">
        <ModalHead icon="scale" id="op-modal-title" title={f.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label={f.immeuble} required full name="op-edif" error={errors.edificio}>
              <input type="text" placeholder={f.immeublePlaceholder} value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
            </Field>
            <Field label={f.type} full name="op-tipo">
              <select value={form.tipo} onChange={e => upd('tipo', e.target.value)}>
                {Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label={f.description} required full name="op-desc" error={errors.descricao}>
              <input type="text" placeholder={f.descriptionPlaceholder} value={form.descricao} onChange={e => upd('descricao', e.target.value)} />
            </Field>
            <Field label={f.dateLimite} required full name="op-prazo" error={errors.prazo}>
              <input type="date" value={form.prazo} onChange={e => upd('prazo', e.target.value)} />
            </Field>
            <Field label={f.notes} full name="op-notas">
              <textarea rows={3} value={form.notas} onChange={e => upd('notas', e.target.value)} />
            </Field>
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
