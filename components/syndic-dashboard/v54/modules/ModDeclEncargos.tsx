'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
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
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { dateApi, jourCivilLocal } from '@/lib/syndic/v54/i18n/dates'
import { estHorsDelai } from '@/lib/syndic/v54/decl-encargos'
import { DECL_ENCARGOS_MESSAGES, type StatutDecl } from './i18n/ModDeclEncargos.messages'

/** Declaração de Encargos — port byte-exact V5.7 + Phase 3 : déclarations réelles.
 * Syndic connecté → vraies déclarations du cabinet (data.declaracoes) + création POST ;
 * anonyme → preview (Empty byte-exact + toast démo).
 * La date limite est calculée par la route selon le pays (PT : délai légal, terme reporté au
 * premier jour ouvrable s'il tombe un dimanche ou un jour férié ; FR : délai interne, sans report). */

type DeclForm = { fracao: string; condomino: string; edificio: string; dataPedido: string; encargosCorrentes: string; divida: string; notas: string }

const fmtEUR = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)

/** Couleur de la pastille selon le statut API (même code couleur que les KPI : à établir ambre, clôturé sauge). */
const STATUT_KIND: Record<StatutDecl, PillKind> = { pendente: 'amber', emitida: 'gold', concluida: 'sage' }
const estStatut = (s: string): s is StatutDecl => Object.prototype.hasOwnProperty.call(STATUT_KIND, s)
const statutKind = (s: string): PillKind => (estStatut(s) ? STATUT_KIND[s] : 'amber')

/** Onglets de la barre ; « todas » montre tout, y compris un statut inconnu. */
type Onglet = 'todas' | 'pen' | 'em' | 'conc'
/** Statut API affiché par chaque onglet filtrant. */
const STATUT_ONGLET: Record<Exclude<Onglet, 'todas'>, StatutDecl> = { pen: 'pendente', em: 'emitida', conc: 'concluida' }
const estOnglet = (id: string): id is Onglet => id === 'todas' || Object.prototype.hasOwnProperty.call(STATUT_ONGLET, id)

export default function ModDeclEncargos() {
  const t = useMessages(DECL_ENCARGOS_MESSAGES)
  const locale = useV54Locale()
  const f = t.formulaire
  // Phase 3 : vraies déclarations du cabinet si syndic connecté, sinon preview vide.
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.declaracoes ?? []) : []

  // Jour civil du navigateur (et non le jour UTC) : date de demande par défaut et référence du « hors délai ».
  const maintenant = new Date()
  const today = jourCivilLocal(maintenant)
  const blank: DeclForm = { fracao: '', condomino: '', edificio: '', dataPedido: today, encargosCorrentes: '', divida: '', notas: '' }
  const [onglet, setOnglet] = useState<Onglet>('todas')
  const visibles = onglet === 'todas' ? all : all.filter(i => i.estado === STATUT_ONGLET[onglet])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<DeclForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof DeclForm, string>>>({})
  const [busy, setBusy] = useState(false)
  const { push } = useToast()

  const upd = (k: keyof DeclForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof DeclForm, string>> = {}
    if (!form.fracao.trim()) errs.fracao = t.erreurs.lot
    if (!form.condomino.trim()) errs.condomino = t.erreurs.coproprietaire
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      // Pas de date limite envoyée : la route la calcule depuis dataPedido selon la règle du pays.
      fetch('/api/syndic/decl-encargos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ fracao: form.fracao, condomino: form.condomino, edificio: form.edificio, dataPedido: form.dataPedido, encargosCorrentes: Number(form.encargosCorrentes) || 0, divida: Number(form.divida) || 0, notas: form.notas, locale: locale === 'fr-FR' ? 'fr' : 'pt' }),
      })
        .then(r => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: t.toasts.enregistree, desc: t.toasts.enregistreeDesc(form.fracao) }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreur, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: t.toasts.enregistreeDemo, desc: t.toasts.connexionRequise })
  }

  const pendentes = all.filter(i => i.estado === 'pendente').length
  // KPI calculés sur toute la liste, quel que soit l'onglet.
  const foraPrazo = all.filter(i => estHorsDelai(i, maintenant)).length
  const concluidas = all.filter(i => i.estado === 'concluida').length
  // Statut API inconnu : valeur brute.
  const statutLabel = (s: string) => (estStatut(s) ? t.statuts[s] : s)

  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau}
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.nouvelle}</Button>} />
      <Alert kind="gold" icon="scale" title={t.alerteTitre}>
        {t.alerteTexte}
      </Alert>
      <KPIGrid items={[
        { icon: 'doc', num: all.length, lbl: t.kpi.total },
        { icon: 'clock', num: pendentes, lbl: t.kpi.pendentes, accent: pendentes ? 'amber' : undefined },
        { icon: 'alert', num: foraPrazo, lbl: t.kpi.horsDelai, accent: foraPrazo ? 'rust' : undefined },
        { icon: 'check', num: concluidas, lbl: t.kpi.concluidas, accent: concluidas ? 'sage' : undefined },
      ]} />
      <Tabs active={onglet} onChange={id => { if (estOnglet(id)) setOnglet(id) }} tabs={[
        { id: 'todas', label: t.onglets.todas(all.length) },
        { id: 'pen', label: t.onglets.pen(pendentes) },
        { id: 'em', label: t.onglets.em },
        { id: 'conc', label: t.onglets.conc(concluidas) },
      ]} />
      <Panel>
        {all.length === 0 ? (
          <Empty illustration="documentos" title={t.videTitre} desc={t.videDesc}
            action={<Button variant="primary" onClick={openNew}><Icon name="plus" />{t.nouvelle}</Button>} />
        ) : visibles.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--v54-navy-300)', fontSize: 13 }}>{t.vueVide}</div>
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{t.colonnes.lot}</th><th>{t.colonnes.coproprietaire}</th><th>{t.colonnes.immeuble}</th><th>{t.colonnes.demande}</th><th>{t.colonnes.dateLimite}</th><th>{t.colonnes.charges}</th><th>{t.colonnes.statut}</th></tr></thead>
              <tbody>{visibles.map(it => (
                <tr key={it.id}>
                  <td>{it.fracao}</td>
                  <td>{it.condomino}</td>
                  <td>{it.edificio || '—'}</td>
                  <td>{dateApi(it.dataPedido, locale)}</td>
                  <td>{dateApi(it.prazoLimite, locale)}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{it.encargosCorrentes ? fmtEUR(Number(it.encargosCorrentes), locale) : '—'}</td>
                  <td><Pill kind={statutKind(it.estado)}>{statutLabel(it.estado)}</Pill></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="de-modal-title" size="md">
        <ModalHead icon="doc" id="de-modal-title" title={f.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label={f.lot} required name="de-frac" error={errors.fracao}>
                <input type="text" placeholder={f.lotPlaceholder} value={form.fracao} onChange={e => upd('fracao', e.target.value)} />
              </Field>
              <Field label={f.dateDemande} name="de-data">
                <input type="date" value={form.dataPedido} onChange={e => upd('dataPedido', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={f.coproprietaire} required full name="de-cond" error={errors.condomino}>
              <input type="text" placeholder={f.coproprietairePlaceholder} value={form.condomino} onChange={e => upd('condomino', e.target.value)} />
            </Field>
            <Field label={f.immeuble} full name="de-edif">
              <input type="text" placeholder={f.immeublePlaceholder} value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={f.chargesCourantes} suffix="€" name="de-enc">
                <input type="number" step="0.01" min="0" placeholder="0" value={form.encargosCorrentes} onChange={e => upd('encargosCorrentes', e.target.value)} />
              </Field>
              <Field label={f.impayes} suffix="€" name="de-div">
                <input type="number" step="0.01" min="0" placeholder="0" value={form.divida} onChange={e => upd('divida', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={f.notes} full name="de-notas">
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
