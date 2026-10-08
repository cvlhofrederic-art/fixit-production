'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Pill, type PillKind } from '../primitives/pill'
import { Progress } from '../primitives/progress'
import { Button } from '../primitives/button'
import { Empty } from '../primitives/empty'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages, useV54Locale } from '@/lib/syndic/v54/i18n'
import { dateApi, echeanceDepassee } from '@/lib/syndic/v54/i18n/dates'
import type { Enquete } from '@/lib/syndic/v54/api'
import { ENQUETES_MESSAGES } from './i18n/ModEnquetes.messages'

/** Enquetes & Sondagens — port byte-exact V5.7 + lot fonctionnel.
 * Syndic connecté → vraies enquêtes du cabinet (data.enquetes) + création POST ;
 * anonyme → preview byte-exact (les % sont dérivés des votes → mêmes chiffres). */

type EnqForm = { titulo: string; descricao: string; tipo: string; edificio: string; estado: Enquete['estado']; prazo: string; total: string; anonima: string; options: string }
/** Enquête affichée : la démonstration porte un drapeau de délai dépassé. */
type EnqueteAffichee = Enquete & { prazoExpire?: boolean }

/** Types de question : valeurs envoyées à l'API (identiques en PT et en FR) ; seul le libellé change. */
const TIPOS = ['Escolha Múltipla', 'Sim / Não', 'Escala 1-5'] as const
const ESTADOS: Enquete['estado'][] = ['ativa', 'a_decorrer', 'encerrada']

const estadoKind = (v: string): PillKind => (({ ativa: 'sage', a_decorrer: 'amber', encerrada: 'rust' } as Record<string, PillKind>)[v] || 'amber')
const respondido = (e: Enquete) => e.options.reduce((s, o) => s + (Number(o.votes) || 0), 0)
const partPct = (e: Enquete) => (e.total > 0 ? Math.min(100, Math.round((respondido(e) / e.total) * 100)) : 0)
const optPct = (e: Enquete, votes: number) => { const r = respondido(e); return r > 0 ? Math.round((votes / r) * 100) : 0 }
/** Délai dépassé : drapeau de la démonstration ; données réelles : date limite (colonne DATE)
 * antérieure au jour civil local, quel que soit le statut (historique compris). */
const prazoExpire = (s: EnqueteAffichee) => s.prazoExpire ?? echeanceDepassee(s.prazo)

const surveyCard = { background: '#fff', border: '1px solid var(--v54-line)', borderRadius: 14, boxShadow: 'var(--v54-shadow-card)', padding: 22, marginBottom: 16 } as const

export default function ModEnquetes() {
  const t = useMessages(ENQUETES_MESSAGES)
  const locale = useV54Locale()
  const data = useSyndicData()
  const real = data.authenticated
  const all: EnqueteAffichee[] = real ? (data.enquetes ?? []) : t.demo
  const estadoLabel = (v: string) => t.statuts[v] || v
  const tipoLabel = (v: string) => t.types[v] ?? v

  const blank: EnqForm = { titulo: '', descricao: '', tipo: 'Escolha Múltipla', edificio: '', estado: 'ativa', prazo: '', total: '', anonima: 'nao', options: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<EnqForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof EnqForm, string>>>({})
  const [tab, setTab] = useState('ativas')
  const [busy, setBusy] = useState(false)
  const { push } = useToast()

  const upd = (k: keyof EnqForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.titulo.trim()) { setErrors({ titulo: t.erreurs.titre }); return }
    const options = form.options.split('\n').map(l => l.trim()).filter(Boolean).map(label => ({ label, votes: 0 }))
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/enquetes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ titulo: form.titulo, descricao: form.descricao, tipo: form.tipo, edificio: form.edificio, estado: form.estado, prazo: form.prazo || null, total: Number(form.total) || 0, options, anonima: form.anonima === 'sim' }),
      })
        .then(r => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: t.toasts.creee, desc: form.titulo }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurCreation, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: t.toasts.creeeDemo, desc: t.toasts.connexionRequise })
  }

  const ativas = all.filter(e => e.estado === 'ativa').length
  const historico = all.filter(e => e.estado === 'encerrada').length
  const partMedia = all.length ? Math.round(all.reduce((s, e) => s + partPct(e), 0) / all.length) : 0
  const totalRespostas = all.reduce((s, e) => s + respondido(e), 0)

  const f = t.formulaire
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau}
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.nouvelleEnquete}</Button>} />
      <KPIGrid items={[
        { icon: 'poll', num: ativas, lbl: t.kpi.actives, accent: 'gold' },
        { icon: 'folder', num: historico, lbl: t.kpi.historique },
        { icon: 'chart', num: t.pct(partMedia), lbl: t.kpi.participation, accent: 'sage' },
        { icon: 'users', num: totalRespostas, lbl: t.kpi.reponses, accent: 'sage' },
      ]} />
      <Tabs active={tab} onChange={(id) => { if (id === 'criar') openNew(); else setTab(id) }} tabs={[
        { id: 'ativas', icon: 'chart', label: t.onglets.actives, badge: ativas },
        { id: 'hist', icon: 'folder', label: t.onglets.historique, badge: historico },
        { id: 'criar', icon: 'pencil', label: t.onglets.creer },
      ]} />
      {real && all.length === 0 ? (
        <Empty illustration="documentos" title={t.vide.titre} desc={t.vide.desc}
          action={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.nouvelleEnquete}</Button>} />
      ) : all.filter(s => tab === 'hist' ? s.estado === 'encerrada' : s.estado !== 'encerrada').map(s => (
        <div key={s.id} style={surveyCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500, marginBottom: 4 }}>{s.titulo}</div>
              <div style={{ fontSize: 13, color: 'var(--v54-navy-500)' }}>{s.descricao}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Pill kind={estadoKind(s.estado)} noDot>● {estadoLabel(s.estado)}</Pill>
                {s.tipo && <Pill noDot>{tipoLabel(s.tipo)}</Pill>}
                {s.edificio && <Pill noDot>{s.edificio}</Pill>}
                {s.anonima && <Pill kind="gold" noDot>{t.anonyme}</Pill>}
                {s.prazo && <Pill kind={prazoExpire(s) ? 'rust' : 'gold'} noDot>{dateApi(s.prazo, locale)}</Pill>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => push({ kind: 'info', title: t.toasts.details, desc: s.titulo })}>{t.voirDetails}</Button>
              <Button variant="danger" size="sm" onClick={() => push({ kind: 'info', title: t.toasts.cloturer, desc: real ? t.toasts.clotureBientot : t.toasts.connexion })}>{t.cloturer}</Button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--v54-navy-300)', margin: '14px 0 6px' }}><span>{respondido(s)}/{s.total}{t.ontRepondu}</span><span><b style={{ color: 'var(--v54-ink)' }}>{partPct(s)}{t.pourcentCarte}</b></span></div>
          <Progress pct={partPct(s)} />
          <div style={{ marginTop: 14 }}>
            {s.options.map((o, j) => (
              <div key={j}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}><span>{o.label}</span><span><b>{o.votes} ({optPct(s, o.votes)}{t.pourcentOption}</b></span></div>
                <Progress pct={optPct(s, o.votes)} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="enq-modal-title" size="md">
        <ModalHead icon="poll" id="enq-modal-title" title={f.titreModale} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label={f.titre} required full name="enq-titulo" error={errors.titulo}>
              <input type="text" placeholder={f.titrePlaceholder} value={form.titulo} onChange={e => upd('titulo', e.target.value)} />
            </Field>
            <Field label={f.description} full name="enq-desc">
              <textarea rows={2} value={form.descricao} onChange={e => upd('descricao', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={f.type} name="enq-tipo">
                <select value={form.tipo} onChange={e => upd('tipo', e.target.value)}>
                  {TIPOS.map((v) => <option key={v} value={v}>{tipoLabel(v)}</option>)}
                </select>
              </Field>
              <Field label={f.immeuble} name="enq-edif">
                <input type="text" placeholder={f.immeublePlaceholder} value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={f.statut} name="enq-estado">
                <select value={form.estado} onChange={e => upd('estado', e.target.value)}>
                  {ESTADOS.map((v) => <option key={v} value={v}>{estadoLabel(v)}</option>)}
                </select>
              </Field>
              <Field label={f.delai} name="enq-prazo">
                <input type="date" value={form.prazo} onChange={e => upd('prazo', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={f.lotsConsultes} hint={f.lotsConsultesAide} name="enq-total">
                <input type="number" min="0" inputMode="numeric" placeholder="0" value={form.total} onChange={e => upd('total', e.target.value)} />
              </Field>
              <Field label={f.anonyme} name="enq-anon">
                <select value={form.anonima} onChange={e => upd('anonima', e.target.value)}>
                  <option value="nao">{f.non}</option>
                  <option value="sim">{f.oui}</option>
                </select>
              </Field>
            </FormRow>
            <Field label={f.options} hint={f.optionsAide} full name="enq-options">
              <textarea rows={4} placeholder={f.optionsPlaceholder} value={form.options} onChange={e => upd('options', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{f.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{f.creer}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
