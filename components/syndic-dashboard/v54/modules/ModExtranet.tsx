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
import { EXTRANET_MESSAGES } from './i18n/ModExtranet.messages'

/** Extranet Condóminos — port byte-exact du ModExtranet du bundle V5.7 (stateful : Modal + copy URL). */

type ExtForm = { nome: string; email: string; telefone: string; fracao: string; edificio: string; notas: string }
type Cond = ExtForm & { id: number; acessoAtivo: boolean; saldo: number }

/** URL du portail : la même valeur est affichée dans le champ et copiée dans le presse-papiers (route réelle, sans accent). */
const URL_PORTAIL = 'https://vitfix.io/coproprietaire/portail'

const fmtEUR = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)

export default function ModExtranet() {
  const t = useMessages(EXTRANET_MESSAGES)
  const locale = useV54Locale()
  const f = t.formulaire
  const blank: ExtForm = { nome: '', email: '', telefone: '', fracao: '', edificio: '', notas: '' }
  const [items, setItems] = useState<Cond[]>([])
  const [pedidos] = useState<{ id: number }[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ExtForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof ExtForm, string>>>({})
  const [busy, setBusy] = useState(false)
  const { push } = useToast()
  // Phase 2 : vrais condóminos du cabinet si syndic connecté, sinon état local (mock/preview).
  const data = useSyndicData()
  const real = data.authenticated
  const displayItems: Cond[] = real
    ? (data.coproprios ?? []).map((c, i) => ({ id: i, nome: c.proprietario || '—', email: c.email, telefone: c.telefone, fracao: [c.batiment, c.numeroPorte].filter(Boolean).join(' '), edificio: c.immeuble, notas: '', acessoAtivo: c.acessoPortal ?? false, saldo: c.solde ?? 0 }))
    : items

  const upd = (k: keyof ExtForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof ExtForm, string>> = {}
    if (!form.nome.trim()) errs.nome = t.erreurs.nom
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) errs.email = t.erreurs.email
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      // Écriture réelle : POST /api/syndic/coproprios (mapping vérifié sur le contrat), puis refresh.
      // setBusy + disabled empêchent la double-soumission (sinon doublons de condómino).
      setBusy(true)
      fetch('/api/syndic/coproprios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ coproprio: { nomProprietaire: form.nome, emailProprietaire: form.email, telephoneProprietaire: form.telefone, numeroPorte: form.fracao, immeuble: form.edificio, notes: form.notas, accesPortail: true } }),
      })
        .then((res) => { if (!res.ok) throw new Error('POST failed') })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: t.toasts.ajoute, desc: form.nome }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurAjout, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setItems(prev => [...prev, { ...form, id: Date.now(), acessoAtivo: true, saldo: 0 }])
    setOpen(false)
    push({ kind: 'success', title: t.toasts.ajoute, desc: form.nome })
  }

  const acessosAtivos = displayItems.filter(i => i.acessoAtivo).length
  const saldoGlobal = displayItems.reduce((s, i) => s + (i.saldo || 0), 0)
  const emAtraso = displayItems.filter(i => (i.saldo || 0) < 0).length
  /** Copie l'URL du portail : « copié » seulement une fois la copie confirmée par le navigateur. */
  const copyPortalUrl = async () => {
    const echec = () => push({ kind: 'error', title: t.toasts.copieImpossible, desc: t.toasts.copierManuellement })
    // Presse-papiers absent hors contexte sécurisé (http) et sur certains navigateurs : rien n'est copié.
    if (!navigator.clipboard?.writeText) { echec(); return }
    try {
      await navigator.clipboard.writeText(URL_PORTAIL)
    } catch {
      // Copie refusée (permission, document sans focus : NotAllowedError) : l'utilisateur copie à la main.
      echec()
      return
    }
    push({ kind: 'info', title: t.toasts.lienCopie, desc: t.toasts.urlCopiee })
  }

  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau}
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.ajouter}</Button>} />
      <Tabs defaultActive="cd" tabs={[
        { id: 'cd', icon: 'users', label: t.onglets.coproprietaires(displayItems.length) },
        { id: 'pi', icon: 'bell', label: t.onglets.demandes(pedidos.length) },
      ]} />
      <KPIGrid items={[
        { icon: 'users', num: displayItems.length, lbl: t.kpi.coproprietaires, accent: displayItems.length ? 'sage' : undefined },
        { icon: 'check', num: acessosAtivos, lbl: t.kpi.acces, accent: acessosAtivos ? 'sage' : undefined },
        { icon: 'coin', num: fmtEUR(saldoGlobal, locale), lbl: t.kpi.solde },
        { icon: 'alert', num: emAtraso, lbl: t.kpi.retard, accent: emAtraso ? 'rust' : undefined },
      ]} />
      <Panel>
        {displayItems.length === 0 ? (
          <Empty icon="users" title={t.vide.titre} desc={t.vide.desc}
            action={<Button variant="primary" onClick={openNew}><Icon name="plus" />{t.vide.action}</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{t.colonnes.nom}</th><th>{t.colonnes.email}</th><th>{t.colonnes.telephone}</th><th>{t.colonnes.lot}</th><th>{t.colonnes.solde}</th><th>{t.colonnes.acces}</th></tr></thead>
              <tbody>{displayItems.map(it => (
                <tr key={it.id}>
                  <td>{it.nome}</td>
                  <td>{it.email || '—'}</td>
                  <td>{it.telefone || '—'}</td>
                  <td>{it.fracao || '—'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(it.saldo || 0, locale)}</td>
                  <td><Pill kind={it.acessoAtivo ? 'sage' : 'rust'}>{it.acessoAtivo ? t.actif : t.inactif}</Pill></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title={t.portail.titre} icon="map">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <p style={{ flex: 1, fontSize: 13, color: 'var(--v54-navy-500)', margin: 0 }}>{t.portail.texte}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input type="text" readOnly aria-label={t.portail.urlAria} value={URL_PORTAIL} style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontFamily: 'ui-monospace,monospace', fontSize: 12 }} />
          <Button onClick={copyPortalUrl}><Icon name="doc" />{t.portail.copier}</Button>
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="ex-modal-title" size="md">
        <ModalHead icon="users" id="ex-modal-title" title={f.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label={f.nom} required full name="ex-nome" error={errors.nome}>
              <input type="text" placeholder={f.nomPlaceholder} value={form.nome} onChange={e => upd('nome', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={f.email} name="ex-mail" error={errors.email}>
                <input type="email" placeholder={f.emailPlaceholder} value={form.email} onChange={e => upd('email', e.target.value)} />
              </Field>
              <Field label={f.telephone} name="ex-tel">
                <input type="tel" placeholder={f.telephonePlaceholder} value={form.telefone} onChange={e => upd('telefone', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={f.lot} name="ex-frac">
                <input type="text" placeholder={f.lotPlaceholder} value={form.fracao} onChange={e => upd('fracao', e.target.value)} />
              </Field>
              <Field label={f.immeuble} name="ex-edif">
                <input type="text" placeholder={f.immeublePlaceholder} value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={f.notes} full name="ex-notas">
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
