'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { Pill } from '../primitives/pill'
import { Panel } from '../primitives/panel'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { NovaMissaoModal } from './NovaMissaoModal'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages, useV54Locale } from '@/lib/syndic/v54/i18n'
import { dateApi } from '@/lib/syndic/v54/i18n/dates'
import type { Artisan } from '@/components/syndic-dashboard/types'
import { PROFISSIONAIS_MESSAGES, type ProDemo } from './i18n/ModProfissionais.messages'

/** Profissionais — port byte-exact du ModProfissionais du bundle V5.7. */

type Pro = ProDemo

const badge = (bg: string, color: string): React.CSSProperties => ({ padding: '8px 12px', background: bg, borderRadius: 8, fontSize: 12, color, marginBottom: 6 })

/** Date du jour (locale) au format AAAA-MM-JJ, comparable aux dates de fin ISO. */
const aujourdhuiIso = (): string => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Attestation réellement valide : déposée et, si sa date de fin est connue (ISO), non échue. */
const attestationValide = (deposee: boolean | undefined, fin: string | null | undefined, aujourdhui: string): boolean => {
  if (!deposee) return false
  const iso = fin ? /^\d{4}-\d{2}-\d{2}/.exec(fin) : null
  return !iso || iso[0] >= aujourdhui
}

/** Lit la conformité d'un artisan (champs camelCase, normalisés par fetchArtisans). */
function lireArtisan(a: Artisan, aujourdhui: string) {
  return {
    certifie: !!a.vitfixCertifie,
    rcValide: attestationValide(a.rcProValide, a.rcProExpiration, aujourdhui),
    rcFin: a.rcProExpiration || null,
    decennaleValide: attestationValide(a.decennaleValide, a.decennaleExpiration, aujourdhui),
    decennaleFin: a.decennaleExpiration || null,
    interventions: a.nbInterventions ?? 0,
  }
}

/** Mappe un artisan réel vers la tuple de rendu d'une carte (Phase 2). */
function artisanToPro(a: Artisan, aujourdhui: string): Pro {
  const name = [a.prenom, a.nom].filter(Boolean).join(' ').trim() || a.nom
  const l = lireArtisan(a, aujourdhui)
  return [
    name,
    a.metier,
    l.certifie ? 'check' : '',
    String(a.note ?? ''),
    l.interventions,
    a.telephone ?? '',
    a.email ?? '',
    l.rcValide ? l.rcFin : null,
    l.decennaleValide ? l.decennaleFin : null,
  ]
}

export default function ModProfissionais() {
  const t = useMessages(PROFISSIONAIS_MESSAGES)
  const locale = useV54Locale()
  // Phase 2 : vrais artisans du cabinet si syndic connecté, sinon mock (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const aujourdhui = aujourdhuiIso()
  const conformite = real ? data.artisans.map((a) => lireArtisan(a, aujourdhui)) : []
  // Démo : les 9 exemples ont une RC Pro valide (« 9 com Seguro RC válido » / « 9 avec RC Pro valide »).
  const items: ReadonlyArray<{ pro: Pro; id: string | null; rcValide: boolean }> = real
    ? data.artisans.map((a, i) => ({ pro: artisanToPro(a, aujourdhui), id: a.id, rcValide: conformite[i].rcValide }))
    : t.demo.map((p) => ({ pro: p, id: null, rcValide: true }))
  const lede = real
    ? t.chapeau({
        total: data.artisans.length,
        certifies: conformite.filter((c) => c.certifie).length,
        rcValide: conformite.filter((c) => c.rcValide).length,
        decennale: conformite.filter((c) => c.decennaleValide).length,
      })
    : t.chapeauDemo

  // Phase 2 écritures : « Eliminar » → DELETE /api/syndic/artisans (avec confirmation).
  const { push } = useToast()
  const [delTarget, setDelTarget] = useState<{ id: string | null; name: string } | null>(null)
  const [busyDel, setBusyDel] = useState(false)
  const confirmDelete = () => {
    if (real && data.token && delTarget?.id) {
      setBusyDel(true)
      fetch(`/api/syndic/artisans?artisan_id=${encodeURIComponent(delTarget.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${data.token}` },
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); const n = delTarget?.name; setDelTarget(null); push({ kind: 'success', title: t.toasts.supprime, desc: n }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurSuppression, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusyDel(false))
      return
    }
    setDelTarget(null)
    push({ kind: 'info', title: t.toasts.supprimeDemo, desc: t.toasts.connexionRequise })
  }

  // Phase 2 écritures : « Adicionar um profissional » → POST /api/syndic/artisans.
  const blank = { email: '', nom: '', prenom: '', telephone: '', metier: '', siret: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.nom.trim()) errs.nom = t.erreurs.nom
    if (!form.email.trim()) errs.email = t.erreurs.email
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/artisans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ email: form.email, nom: form.nom, prenom: form.prenom, telephone: form.telephone, metier: form.metier, siret: form.siret, action: 'create' }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: t.toasts.ajoute, desc: form.nom }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurAjout, desc: t.toasts.verifierDonnees }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: t.toasts.ajouteDemo, desc: t.toasts.connexionRequise })
  }

  // Phase 2 raccourci : « Criar missão » sur une carte → Nova missão pré-assignée à ce profissional.
  const [missaoArtisan, setMissaoArtisan] = useState<string | null>(null)
  const c = t.carte
  const f = t.formulaire
  return (
    <>
      <PageHead
        title={t.titre}
        lede={lede}
        actions={<>
          <Button onClick={() => { data.refresh?.(); push({ kind: real ? 'success' : 'info', title: t.toasts.synchronise, desc: real ? t.toasts.synchroniseDesc : t.toasts.synchroniseConnexion }) }}><Icon name="check" />{t.synchroniser}</Button>
          <Button variant="gold" onClick={openNew}><Icon name="plus" />{t.ajouter}</Button>
        </>}
      />
      <div className={m.cardGrid}>
        {items.map(({ pro: p, id, rcValide }) => (
          <Panel key={p[6]}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500 }}>{p[0]}</div>
                  {p[2] === 'check' && <Pill kind="gold" noDot>{c.certifie}</Pill>}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--v54-navy-500)', marginTop: 2 }}>{p[1]}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--v54-gold-600)', fontWeight: 600, fontSize: 13 }}>{p[3]}</div>
                <Pill kind="sage" noDot>{c.actif}</Pill>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12.5, marginBottom: 12 }}>
              <div style={{ color: 'var(--v54-navy-500)' }}>{p[5]}</div>
              <div style={{ color: 'var(--v54-navy-500)' }}>{p[6]}</div>
              <div style={{ color: 'var(--v54-navy-500)' }}>{p[4]}{c.interventions}</div>
              <div>{rcValide && <Pill kind="sage" noDot>{c.rcValide}</Pill>}</div>
            </div>
            {p[7] && <div style={badge('var(--v54-sage-50)', 'var(--v54-sage-700)')}>{c.rcValideJusquau}{dateApi(p[7], locale)}</div>}
            {p[8] && <div style={badge('var(--v54-sage-50)', 'var(--v54-sage-700)')}>{c.decennaleJusquau}{dateApi(p[8], locale)}</div>}
            {p[9] && <div style={badge('var(--v54-sage-50)', 'var(--v54-sage-700)')}>{c.decennaleValide}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Button style={{ flex: 1, justifyContent: 'center' }} onClick={() => push({ kind: 'info', title: t.toasts.messages, desc: t.toasts.aucunCompteMessagerie })}><Icon name="chat" />{c.aucunCompte}</Button>
              <Button variant="primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setMissaoArtisan(p[0])}>{c.creerMission}</Button>
              <Button variant="ghost" aria-label={c.supprimerAria} title={c.supprimerTitre} onClick={() => setDelTarget({ id, name: p[0] })}><Icon name="trash" /></Button>
            </div>
          </Panel>
        ))}
      </div>

      <Modal open={delTarget != null} onClose={() => setDelTarget(null)} labelledBy="dp-title" size="sm">
        <ModalHead icon="trash" id="dp-title" title={t.suppression.titre} onClose={() => setDelTarget(null)} />
        <ModalBody>
          <p style={{ fontSize: 13.5, color: 'var(--v54-navy-500)', lineHeight: 1.5, margin: 0 }}>
            {t.suppression.avant}<b>{delTarget?.name}</b>{t.suppression.apres}
          </p>
        </ModalBody>
        <ModalFoot>
          <Button variant="ghost" onClick={() => setDelTarget(null)}>{t.suppression.annuler}</Button>
          <button type="button" onClick={confirmDelete} disabled={busyDel} className={btnCss.btn} style={{ color: 'var(--v54-rust-700)', borderColor: 'var(--v54-rust-100)', background: 'var(--v54-rust-50)' }}>{t.suppression.supprimer}</button>
        </ModalFoot>
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="np-title" size="md">
        <ModalHead icon="plus" id="np-title" title={t.ajouter} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label={f.nom} required name="np-nom" error={errors.nom}>
                <input type="text" placeholder={f.nomPlaceholder} value={form.nom} onChange={(e) => upd('nom', e.target.value)} />
              </Field>
              <Field label={f.prenom} name="np-prenom">
                <input type="text" placeholder={f.facultatif} value={form.prenom} onChange={(e) => upd('prenom', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={f.email} required full name="np-email" error={errors.email}>
              <input type="email" placeholder={f.emailPlaceholder} value={form.email} onChange={(e) => upd('email', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={f.telephone} name="np-tel">
                <input type="tel" placeholder={f.telephonePlaceholder} value={form.telephone} onChange={(e) => upd('telephone', e.target.value)} />
              </Field>
              <Field label={f.metier} name="np-metier">
                <input type="text" placeholder={f.metierPlaceholder} value={form.metier} onChange={(e) => upd('metier', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={f.siret} full name="np-siret">
              <input type="text" placeholder={f.facultatif} value={form.siret} onChange={(e) => upd('siret', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{f.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{f.ajouter}</button>
          </ModalFoot>
        </form>
      </Modal>

      <NovaMissaoModal open={missaoArtisan != null} onClose={() => setMissaoArtisan(null)} prefillArtisan={missaoArtisan ?? ''} lockArtisan />
    </>
  )
}
