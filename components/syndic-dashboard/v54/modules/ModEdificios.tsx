'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { Pill } from '../primitives/pill'
import { KPIGrid } from '../primitives/kpi'
import { Progress } from '../primitives/progress'
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
import type { Immeuble } from '@/components/syndic-dashboard/types'
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { EDIFICIOS_MESSAGES, type ImmeubleDemo } from './i18n/ModEdificios.messages'

/** Edifícios — port byte-exact du ModEdificios du bundle V5.7 (utilise Progress). */

const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.max(0, (a / b) * 100)) : 0)
const eur = (n: number, locale: V54Locale) => n.toLocaleString(locale)

/** Dernier élément : règlement de copropriété présent. */
type Row = ImmeubleDemo

/** Mappe un immeuble réel vers la tuple de rendu d'une carte (Phase 2). */
function immToRow(i: Immeuble): Row {
  return [
    i.nom,
    [i.adresse, i.codePostal, i.ville].filter(Boolean).join(', '),
    i.nbLots ?? 0,
    i.anneeConstruction ?? 0,
    i.prochainControle ?? '—',
    String(i.nbInterventions ?? 0),
    i.depensesAnnee ?? 0,
    i.budgetAnnuel ?? 0,
    Boolean(i.reglementTexte),
  ]
}

export default function ModEdificios() {
  const t = useMessages(EDIFICIOS_MESSAGES)
  const locale = useV54Locale()
  // Phase 2 : vraies données du cabinet si syndic connecté, sinon mock (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const items: ReadonlyArray<{ row: Row; im: Immeuble | null }> = real
    ? data.immeubles.map((i) => ({ row: immToRow(i), im: i }))
    : t.demo.map((r) => ({ row: r, im: null }))
  const buildings = items.map((it) => it.row)
  const totalFracoes = buildings.reduce((acc, b) => acc + b[2], 0)

  // Phase 2 écritures : « Adicionar edifício » → POST /api/syndic/immeubles.
  const { push } = useToast()
  const blank = { nom: '', adresse: '', ville: '', codePostal: '', nbLots: '', budgetAnnuel: '' }
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setEditId(null); setForm(blank); setErrors({}); setOpen(true) }
  const openEdit = (im: Immeuble | null) => {
    setEditId(im?.id ?? null)
    setForm(im
      ? { nom: im.nom ?? '', adresse: im.adresse ?? '', ville: im.ville ?? '', codePostal: im.codePostal ?? '', nbLots: im.nbLots != null ? String(im.nbLots) : '', budgetAnnuel: im.budgetAnnuel != null ? String(im.budgetAnnuel) : '' }
      : blank)
    setErrors({}); setOpen(true)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.nom.trim()) errs.nom = t.erreurNom
    if (Object.keys(errs).length) { setErrors(errs); return }
    const fields = { nom: form.nom, adresse: form.adresse, ville: form.ville, codePostal: form.codePostal, nbLots: Number(form.nbLots) || 1, budgetAnnuel: Number(form.budgetAnnuel) || 0 }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/immeubles', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify(editId ? { id: editId, ...fields } : fields),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: editId ? t.toasts.misAJour : t.toasts.ajoute, desc: form.nom }) })
        .catch(() => push({ kind: 'error', title: editId ? t.toasts.erreurMiseAJour : t.toasts.erreurAjout, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: editId ? t.toasts.misAJourDemo : t.toasts.ajouteDemo, desc: t.toasts.connexionRequise })
  }

  // Phase 2 raccourci : « Nova missão » sur une carte → Nova missão pré-remplie pour cet edifício.
  const [missaoImovel, setMissaoImovel] = useState<string | null>(null)
  // Phase A : Suspender / Reativar un edifício → PATCH statut.
  const [suspendTarget, setSuspendTarget] = useState<Immeuble | null>(null)
  const [suspendBusy, setSuspendBusy] = useState(false)
  const confirmSuspend = () => {
    const im = suspendTarget
    if (!im) return
    const novo = im.statut === 'suspenso' ? 'ativo' : 'suspenso'
    if (real && data.token) {
      setSuspendBusy(true)
      fetch('/api/syndic/immeubles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ id: im.id, statut: novo }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setSuspendTarget(null); push({ kind: 'success', title: novo === 'suspenso' ? t.toasts.suspendu : t.toasts.reactive, desc: im.nom }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreur, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setSuspendBusy(false))
      return
    }
    setSuspendTarget(null)
    push({ kind: 'info', title: t.toasts.actionDemo, desc: t.toasts.connexionRequise })
  }
  const c = t.carte
  const f = t.formulaire
  const sp = t.suspension
  return (
    <>
      <PageHead
        title={t.titre}
        lede={t.chapeau(buildings.length, real ? totalFracoes : 40)}
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.ajouterImmeuble}</Button>}
      />
      <KPIGrid items={[
        { icon: 'building', num: real ? data.immeubles.length : 4, lbl: t.kpi.geres, sub: t.kpi.portefeuille },
        { icon: 'grid', num: real ? totalFracoes : 40, lbl: t.kpi.lots, sub: t.kpi.totalLots, accent: 'gold' },
        { icon: 'clipboard', num: real ? data.missions.filter((mi) => mi.statut === 'en_cours' || mi.statut === 'acceptee').length : 25, lbl: t.kpi.interventions, sub: t.kpi.enCours, accent: 'sage' },
        { icon: 'alert', num: real ? data.immeubles.filter((i) => !i.reglementTexte).length : 4, lbl: t.kpi.documents, sub: t.kpi.reglementsAAjouter, accent: 'amber' },
      ]} />
      {items.map(({ row: b, im }) => (
        <div key={b[0]} className={m.card} style={{ marginBottom: 16, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 18 }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)' }}><Icon name="building" style={{ width: 24, height: 24 }} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 24, fontWeight: 500, letterSpacing: '-0.01em' }}>{b[0]}</div>
              <div style={{ fontSize: 12.5, color: 'var(--v54-navy-300)', marginTop: 2 }}>{b[1]}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Pill noDot>{b[2]}{c.nbLots(b[2])}</Pill>
                <Pill noDot>{c.construitEn}{b[3]}</Pill>
                <Pill kind={b[8] ? 'sage' : 'amber'} noDot>{b[8] ? c.reglementOk : c.reglementManquant}</Pill>
                {im?.statut === 'suspenso' && <Pill kind="rust" noDot>{c.suspendu}</Pill>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => openEdit(im)}><Icon name="pencil" />{c.modifier}</Button>
              <Button aria-label={im?.statut === 'suspenso' ? c.reactiverAria : c.suspendreAria} title={im?.statut === 'suspenso' ? c.reactiver : c.suspendre} onClick={() => im ? setSuspendTarget(im) : push({ kind: 'info', title: c.suspendreAnonyme, desc: c.disponibleConnecte })}><Icon name={im?.statut === 'suspenso' ? 'check' : 'ban'} /></Button>
              <Button variant="gold" onClick={() => setMissaoImovel(b[0])}><Icon name="plus" />{c.nouvelleMission}</Button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 18 }}>
            <div><div className={m.statKey}>{c.lots}</div><div className={m.statBig}>{b[2]}</div><div style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>{c.totalLots}</div></div>
            <div><div className={m.statKey}>{c.construitEnStat}</div><div className={m.statBig}>{b[3]}</div></div>
            <div><div className={m.statKey}>{c.interventions}</div><div className={m.statBig}>{b[5]}</div><div style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>{c.enCours}</div></div>
            <div><div className={m.statKey}>{c.prochaineInspection}</div><div className={m.statBig}>{b[4]}</div></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}><span style={{ color: 'var(--v54-gold-700)', fontWeight: 600 }}>{c.budget}</span><span className={m.mono} style={{ color: 'var(--v54-navy-500)' }}>{eur(b[6], locale)} € / {eur(b[7], locale)} €</span></div>
          <Progress pct={pct(b[6], b[7])} />
          <div style={{ marginTop: 14, display: 'flex', gap: 14, fontSize: 12, color: 'var(--v54-navy-300)' }}>
            <span style={{ color: 'var(--v54-gold-700)', fontWeight: 600, cursor: 'pointer' }}>{c.ajouterReglement}</span>
            <div style={{ flex: 1 }} />
            <span style={{ cursor: 'pointer' }}>{c.coproprietaires}</span>
            <span style={{ cursor: 'pointer' }}>{c.documents}</span>
            <span style={{ cursor: 'pointer' }}>{c.historique}</span>
          </div>
        </div>
      ))}

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="ne-title" size="md">
        <ModalHead icon="building" id="ne-title" title={editId ? f.titreModifier : f.titreAjouter} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label={f.nom} required full name="ne-nom" error={errors.nom}>
              <input type="text" placeholder={f.nomPlaceholder} value={form.nom} onChange={(e) => upd('nom', e.target.value)} />
            </Field>
            <Field label={f.adresse} full name="ne-adr">
              <input type="text" placeholder={f.adressePlaceholder} value={form.adresse} onChange={(e) => upd('adresse', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={f.ville} name="ne-ville">
                <input type="text" placeholder={f.villePlaceholder} value={form.ville} onChange={(e) => upd('ville', e.target.value)} />
              </Field>
              <Field label={f.codePostal} name="ne-cp">
                <input type="text" placeholder={f.codePostalPlaceholder} value={form.codePostal} onChange={(e) => upd('codePostal', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={f.nbLots} name="ne-lots">
                <input type="number" min="1" inputMode="numeric" placeholder="1" value={form.nbLots} onChange={(e) => upd('nbLots', e.target.value)} />
              </Field>
              <Field label={f.budgetAnnuel} name="ne-budget">
                <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.budgetAnnuel} onChange={(e) => upd('budgetAnnuel', e.target.value)} />
              </Field>
            </FormRow>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{f.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{editId ? f.enregistrer : f.ajouter}</button>
          </ModalFoot>
        </form>
      </Modal>

      <Modal open={suspendTarget != null} onClose={() => setSuspendTarget(null)} labelledBy="susp-title" size="sm">
        <ModalHead icon="ban" id="susp-title" title={suspendTarget?.statut === 'suspenso' ? sp.titreReactiver : sp.titreSuspendre} onClose={() => setSuspendTarget(null)} />
        <ModalBody>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
            {suspendTarget?.statut === 'suspenso'
              ? <>{sp.reactiverAvant}<b>{suspendTarget?.nom}</b>{sp.reactiverApres}</>
              : <>{sp.suspendreAvant}<b>{suspendTarget?.nom}</b>{sp.suspendreApres}</>}
          </p>
        </ModalBody>
        <ModalFoot>
          <Button variant="ghost" onClick={() => setSuspendTarget(null)}>{sp.annuler}</Button>
          <Button variant={suspendTarget?.statut === 'suspenso' ? 'gold' : 'danger'} onClick={confirmSuspend} disabled={suspendBusy}>{suspendTarget?.statut === 'suspenso' ? c.reactiver : c.suspendre}</Button>
        </ModalFoot>
      </Modal>

      <NovaMissaoModal open={missaoImovel != null} onClose={() => setMissaoImovel(null)} prefillImmeuble={missaoImovel ?? ''} lockImmeuble />
    </>
  )
}
