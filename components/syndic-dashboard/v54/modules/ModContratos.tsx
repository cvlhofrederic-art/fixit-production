'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
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
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { CONTRATOS_MESSAGES, type CategorieContrat, type OngletContrat } from './i18n/ModContratos.messages'

/** Contratos com Prestadores — port byte-exact V5.7 + Phase 3 : contrats réels. */

const eur = (n: number, locale: V54Locale) => `${(n || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
const TAB_TO_CAT: Record<string, string> = { limp: 'limpezas', elev: 'elevadores', seg: 'seguranca', jard: 'jardinagem', outros: 'outros' }
const statusKind = (s: string): 'sage' | 'amber' | 'rust' => (s === 'expirado' ? 'rust' : s === 'renovacao' ? 'amber' : 'sage')
/** Code de statut stocké → clé du libellé (tout statut inconnu s'affiche comme actif, comme avant). */
const statusKey = (s: string): 'expirado' | 'renovacao' | 'ativo' => (s === 'expirado' ? 'expirado' : s === 'renovacao' ? 'renovacao' : 'ativo')
/** Onglets dans l'ordre d'affichage (le libellé vient du dictionnaire). */
const ONGLETS: OngletContrat[] = ['todos', 'limp', 'elev', 'seg', 'jard', 'outros']
/** Catégories du formulaire : valeurs envoyées à l'API, identiques dans toutes les langues. */
const CATEGORIES: CategorieContrat[] = ['limpezas', 'elevadores', 'seguranca', 'jardinagem', 'outros']

export default function ModContratos() {
  const t = useMessages(CONTRATOS_MESSAGES)
  const locale = useV54Locale()
  // Phase 3 : vrais contrats du cabinet si syndic connecté, sinon mock/empty (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.contratos ?? []) : []
  const [tab, setTab] = useState('todos')
  const filtered = tab === 'todos' ? all : all.filter((c) => c.categoria === TAB_TO_CAT[tab])

  const ativos = all.filter((c) => c.statut === 'ativo').length
  const aRenovar = all.filter((c) => c.statut === 'renovacao').length
  const expirados = all.filter((c) => c.statut === 'expirado').length
  const custoMensal = all.reduce((s, c) => s + (c.custoMensal || 0), 0)
  const custoAnual = all.reduce((s, c) => s + (c.custoAnual || (c.custoMensal || 0) * 12), 0)

  // Phase 3 écritures : « + Novo contrato » → POST /api/syndic/contratos.
  const { push } = useToast()
  const upload = useDocumentUpload(() => data.refresh?.())
  const blank = { fornecedor: '', categoria: 'limpezas', custoMensal: '', custoAnual: '', dataFim: '', immeuble: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.fornecedor.trim()) errs.fornecedor = t.erreurs.prestataire
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ fornecedor: form.fornecedor, categoria: form.categoria, custoMensal: Number(form.custoMensal) || 0, custoAnual: Number(form.custoAnual) || 0, dataFim: form.dataFim, immeuble: form.immeuble }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: t.toasts.ajoute, desc: form.fornecedor }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurAjout, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: t.toasts.ajouteDemo, desc: t.toasts.connexionRequise })
  }

  const f = t.formulaire
  return (
    <>
      <PageHead eyebrow={t.surtitre} title={t.titre}
        lede={t.chapeau}
        actions={<><Button onClick={upload('contrat')}><Icon name="upload" />{t.importerPdf}</Button><Button variant="gold" onClick={openNew}><Icon name="plus" />{t.nouveauContrat}</Button></>} />
      <Alert kind="sage" icon="check" title={t.alerte.titre}>
        {t.alerte.avant}<strong>{t.alerte.fort}</strong>{t.alerte.apres}
      </Alert>
      <KPIGrid items={[
        { icon: 'handshake', num: real ? ativos : 0, lbl: t.kpi.actifs, accent: 'gold' },
        { icon: 'clock', num: real ? aRenovar : 0, lbl: t.kpi.aRenouveler, accent: 'amber' },
        { icon: 'coin', num: real ? eur(custoMensal, locale) : '0,00 €', lbl: t.kpi.coutMensuel },
        { icon: 'coin', num: real ? eur(custoAnual, locale) : '0,00 €', lbl: t.kpi.coutAnnuel },
        { icon: 'refresh', num: 0, lbl: t.kpi.concurrence, accent: 'gold' },
        { icon: 'ban', num: real ? expirados : 0, lbl: t.kpi.expires, accent: 'rust' },
      ]} />
      <Tabs active={tab} onChange={setTab} tabs={ONGLETS.map((id) => ({ id, label: t.onglets[id] }))} />
      <Panel>
        {filtered.length === 0 ? (
          <Empty illustration="profissionais" title={t.vide.titre}
            desc={t.vide.texte}
            action={<Button variant="primary" onClick={openNew}><Icon name="plus" />{t.vide.action}</Button>} />
        ) : (
          <div>
            {filtered.map((c) => (
              <div key={c.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--v54-line)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 18, fontWeight: 500 }}>{c.fornecedor}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--v54-navy-300)', marginTop: 2 }}>{t.categories[c.categoria as CategorieContrat] ?? c.categoria}{c.immeuble ? ` · ${c.immeuble}` : ''}</div>
                </div>
                <Pill kind={statusKind(c.statut)} noDot>{t.statuts[statusKey(c.statut)]}</Pill>
                <div style={{ textAlign: 'right', minWidth: 120 }}>
                  <div className={m.mono} style={{ fontWeight: 600 }}>{eur(c.custoMensal, locale)}{t.parMois}</div>
                  {c.dataFim && <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{t.fin}{c.dataFim}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title={t.cycle.titre} sub={t.cycle.sousTitre}>
        <div className={m.cardGrid3}>
          {t.cycle.etapes.map(([etape, s, c], i) => (
            <div key={i} style={{ padding: 14, border: '1px solid var(--v54-line)', borderRadius: 10, background: `var(--v54-${c}-50)`, borderLeft: `3px solid var(--v54-${c}-500)` }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{etape}</div>
              <div style={{ fontSize: 11.5, color: 'var(--v54-navy-400)' }}>{s}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="nc-title" size="md">
        <ModalHead icon="handshake" id="nc-title" title={f.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label={f.prestataire} required full name="nc-forn" error={errors.fornecedor}>
              <input type="text" placeholder={f.prestatairePlaceholder} value={form.fornecedor} onChange={(e) => upd('fornecedor', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={f.categorie} name="nc-cat">
                <select value={form.categoria} onChange={(e) => upd('categoria', e.target.value)}>
                  {CATEGORIES.map((cat) => <option key={cat} value={cat}>{t.categories[cat]}</option>)}
                </select>
              </Field>
              <Field label={f.immeuble} name="nc-imovel">
                <input type="text" placeholder={f.facultatif} value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={f.coutMensuel} name="nc-mensal">
                <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.custoMensal} onChange={(e) => upd('custoMensal', e.target.value)} />
              </Field>
              <Field label={f.coutAnnuel} name="nc-anual">
                <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.custoAnual} onChange={(e) => upd('custoAnual', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={f.echeance} full name="nc-fim">
              <input type="text" placeholder={f.echeancePlaceholder} value={form.dataFim} onChange={(e) => upd('dataFim', e.target.value)} />
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
