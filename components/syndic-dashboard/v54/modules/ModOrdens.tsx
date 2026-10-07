'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { Pill, type PillKind } from '../primitives/pill'
import { Panel } from '../primitives/panel'
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
import type { Mission } from '@/components/syndic-dashboard/types'
import { ORDENS_MESSAGES, type OrdreDemo, type StatutOrdre } from './i18n/ModOrdens.messages'

/** Ordens de serviço — port byte-exact du ModOrdens du bundle V5.7. */

/** Compteurs des onglets de la démonstration (bundle). */
const DEMO_COMPTEURS = { todas: 9, urg: 1, curso: 4 } as const

const statusKind = (s: StatutOrdre): PillKind => (s === 'pendente' ? 'amber' : 'sage')

type OrderItem = { row: OrdreDemo; id?: string; statut?: string; artisan?: string; priorite?: string }

/** Statut mission Supabase → statut affiché (Phase 2). */
function missionStatut(statut: string): StatutOrdre {
  switch (statut) {
    case 'en_cours': case 'acceptee': return 'curso'
    case 'terminee': return 'concluida'
    default: return 'pendente'
  }
}

function missionToRow(mi: Mission, lot: (numero: string) => string, locale: V54Locale): OrdreDemo {
  return {
    statut: missionStatut(mi.statut),
    ref: `#${(mi.id || '').slice(0, 8)}`,
    immeuble: mi.immeuble,
    intervention: [mi.type, mi.description].filter(Boolean).join(' · '),
    lieu: mi.numLot ? lot(mi.numLot) : (mi.batiment || mi.etage || ''),
    prestataire: mi.artisan || '—',
    date: dateApi(mi.dateIntervention || mi.dateCreation, locale) || '—',
  }
}

export default function ModOrdens() {
  const t = useMessages(ORDENS_MESSAGES)
  const locale = useV54Locale()
  const [tab, setTab] = useState<string>('todas')
  const [showFilter, setShowFilter] = useState(false)
  const [query, setQuery] = useState('')
  // Phase 2 : vraies missions du cabinet si syndic connecté, sinon mock (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const orders: ReadonlyArray<OrderItem> = real
    ? data.missions.map((mi) => ({ row: missionToRow(mi, t.lot, locale), id: mi.id, statut: mi.statut, artisan: mi.artisan, priorite: mi.priorite }))
    : t.demo.map((r) => ({ row: r }))
  const tabs: { id: string; label: string; count?: number }[] = real
    ? [
        { id: 'todas', label: t.onglets.todas, count: data.missions.length },
        { id: 'urg', label: t.onglets.urg, count: data.missions.filter((mi) => mi.priorite === 'urgente').length },
        { id: 'curso', label: t.onglets.curso, count: data.missions.filter((mi) => mi.statut === 'en_cours' || mi.statut === 'acceptee').length },
        { id: 'conc', label: t.onglets.conc, count: data.missions.filter((mi) => mi.statut === 'terminee').length },
      ]
    : [
        { id: 'todas', label: t.onglets.todas, count: DEMO_COMPTEURS.todas },
        { id: 'urg', label: t.onglets.urg, count: DEMO_COMPTEURS.urg },
        { id: 'curso', label: t.onglets.curso, count: DEMO_COMPTEURS.curso },
        { id: 'conc', label: t.onglets.conc },
      ]

  // Filtrage par onglet (statut/priorité) + recherche texte (édifice, descrição, profissional).
  const q = query.trim().toLowerCase()
  const shown = orders.filter((it) => {
    const tabOk = tab === 'urg' ? it.priorite === 'urgente' : tab === 'curso' ? it.row.statut === 'curso' : tab === 'conc' ? it.row.statut === 'concluida' : true
    const queryOk = !q || [it.row.immeuble, it.row.intervention, it.row.prestataire].join(' ').toLowerCase().includes(q)
    return tabOk && queryOk
  })

  // Phase 2 écritures : « Nova missão » → POST /api/syndic/missions (réel si connecté).
  const { push } = useToast()
  const blank = { immeuble: '', type: '', description: '', priorite: 'normale', artisan: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.immeuble.trim()) errs.immeuble = t.erreurs.immeuble
    if (!form.type.trim()) errs.type = t.erreurs.type
    if (!form.description.trim()) errs.description = t.erreurs.description
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ immeuble: form.immeuble, type: form.type, description: form.description, priorite: form.priorite, artisan: form.artisan }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: t.toasts.creee, desc: form.type }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurCreation, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: t.toasts.creeeDemo, desc: t.toasts.connexionRequise })
  }

  // Phase 2 écritures : « Abrir » / « Validar » → édition du statut + profissional via PATCH.
  const STATUT_OPTS = [
    { v: 'en_attente', l: t.statuts.pendente },
    { v: 'en_cours', l: t.statuts.curso },
    { v: 'terminee', l: t.statuts.concluida },
  ] as const
  const normStatut = (s?: string) => (s === 'acceptee' ? 'en_cours' : s === 'terminee' || s === 'en_cours' ? s : 'en_attente')
  const [editing, setEditing] = useState<OrderItem | null>(null)
  const [estado, setEstado] = useState('en_attente')
  const [artisanEdit, setArtisanEdit] = useState('')
  const [busyEdit, setBusyEdit] = useState(false)
  const openEdit = (it: OrderItem) => { setEditing(it); setEstado(normStatut(it.statut)); setArtisanEdit(it.artisan && it.artisan !== '—' ? it.artisan : '') }
  const saveEdit = (e: FormEvent) => {
    e.preventDefault()
    if (real && data.token && editing?.id) {
      setBusyEdit(true)
      fetch('/api/syndic/missions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ id: editing.id, statut: estado, artisan: artisanEdit }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setEditing(null); push({ kind: 'success', title: t.toasts.miseAJour, desc: STATUT_OPTS.find((o) => o.v === estado)?.l }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurMiseAJour, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusyEdit(false))
      return
    }
    setEditing(null)
    push({ kind: 'info', title: t.toasts.miseAJourDemo, desc: t.toasts.connexionRequise })
  }

  const f = t.formulaire
  return (
    <>
      <PageHead
        title={t.titre}
        lede={t.chapeau}
        actions={<>
          <Button onClick={() => setShowFilter((v) => !v)}><Icon name="search" />{t.filtres}</Button>
          <Button variant="gold" onClick={openNew}><Icon name="plus" />{t.nouvelleMission}</Button>
        </>}
      />
      <div className={m.chipRow}>
        {tabs.map((tb) => (
          <button key={tb.id} type="button" className={clsx(m.chip, tab === tb.id && m.chipActive)} onClick={() => setTab(tb.id)}>
            {tb.label}{tb.count != null && <span className={m.chipCount}> {tb.count}</span>}
          </button>
        ))}
      </div>
      {showFilter && (
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Icon name="search" style={{ position: 'absolute', left: 12, top: 11, width: 14, height: 14, color: 'var(--v54-navy-300)' }} />
          <input aria-label={t.rechercheAria} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.recherchePlaceholder} style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, fontSize: 13 }} />
        </div>
      )}
      <Panel flush>
        {shown.length === 0 ? (
          <div style={{ padding: '36px 22px', textAlign: 'center', color: 'var(--v54-navy-300)', fontSize: 13 }}>{t.aucunResultat}</div>
        ) : shown.map((it) => { const o = it.row; return (
          <div key={o.ref} style={{ padding: '18px 22px', borderBottom: '1px solid var(--v54-line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <Pill noDot>{t.prioriteNormale}</Pill>
              <Pill kind={statusKind(o.statut)} noDot>{t.statuts[o.statut]}</Pill>
              <span className={m.mono} style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>{o.ref}</span>
              {o.lieu && <span style={{ fontSize: 11.5, color: 'var(--v54-navy-500)', marginLeft: 4 }}>{o.lieu}</span>}
              <div style={{ flex: 1 }} />
              {o.statut !== 'concluida' && o.prestataire === '—' && <Button size="sm" onClick={() => openEdit(it)} style={{ background: 'var(--v54-sage-500)', color: '#fff', border: 'none' }}>{t.valider}</Button>}
              <Button variant="ghost" size="sm" onClick={() => openEdit(it)}>{t.ouvrir}</Button>
            </div>
            <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 18, fontWeight: 500, marginBottom: 4 }}>{o.immeuble}</div>
            <div style={{ fontSize: 12.5, color: 'var(--v54-navy-500)' }}>{o.intervention}</div>
            {o.prestataire !== '—' && <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11.5, color: 'var(--v54-navy-300)' }}><span>{o.prestataire}</span><span>{o.date}</span></div>}
          </div>
        ) })}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="nm-title" size="md">
        <ModalHead icon="plus" id="nm-title" title={t.nouvelleMission} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label={f.immeuble} required full name="nm-imovel" error={errors.immeuble}>
              {real && data.immeubles.length > 0 ? (
                <select value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)}>
                  <option value="">{f.selectionner}</option>
                  {data.immeubles.map((im) => <option key={im.id} value={im.nom}>{im.nom}</option>)}
                </select>
              ) : (
                <input type="text" placeholder={f.nomImmeuble} value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
              )}
            </Field>
            <FormRow>
              <Field label={f.type} required name="nm-tipo" error={errors.type}>
                <input type="text" placeholder={f.typeExemple} value={form.type} onChange={(e) => upd('type', e.target.value)} />
              </Field>
              <Field label={f.priorite} name="nm-prio">
                <select value={form.priorite} onChange={(e) => upd('priorite', e.target.value)}>
                  <option value="basse">{f.priorites.basse}</option>
                  <option value="normale">{f.priorites.normale}</option>
                  <option value="haute">{f.priorites.haute}</option>
                  <option value="urgente">{f.priorites.urgente}</option>
                </select>
              </Field>
            </FormRow>
            <Field label={f.description} required full name="nm-desc" error={errors.description}>
              <textarea rows={3} placeholder={f.descriptionPlaceholder} value={form.description} onChange={(e) => upd('description', e.target.value)} />
            </Field>
            <Field label={f.prestataireOptionnel} full name="nm-art">
              <input type="text" placeholder={f.nomPrestataire} value={form.artisan} onChange={(e) => upd('artisan', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{f.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{f.creer}</button>
          </ModalFoot>
        </form>
      </Modal>

      <Modal open={editing != null} onClose={() => setEditing(null)} labelledBy="me-title" size="md">
        <ModalHead icon="clipboard" id="me-title" title={f.gerer} onClose={() => setEditing(null)} />
        <form onSubmit={saveEdit} noValidate>
          <ModalBody>
            {editing && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 18, fontWeight: 500 }}>{editing.row.immeuble}</div>
                <div style={{ fontSize: 12.5, color: 'var(--v54-navy-500)', marginTop: 2 }}>{editing.row.intervention}</div>
              </div>
            )}
            <FormRow>
              <Field label={f.statut} name="me-estado">
                <select value={estado} onChange={(e) => setEstado(e.target.value)}>
                  {STATUT_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </Field>
              <Field label={f.prestataire} name="me-art">
                <input type="text" placeholder={f.nomPrestataire} value={artisanEdit} onChange={(e) => setArtisanEdit(e.target.value)} />
              </Field>
            </FormRow>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setEditing(null)}>{f.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busyEdit}>{f.enregistrer}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
