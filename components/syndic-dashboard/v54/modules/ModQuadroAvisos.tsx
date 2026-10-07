'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import btnCss from '../primitives/button/Button.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { QUADRO_AVISOS_MESSAGES, type CategorieAviso, type PrioriteAviso } from './i18n/ModQuadroAvisos.messages'

/** Quadro de Avisos — port byte-exact V5.7 + Phase 3 : avisos réels. */

/** Avis affiché : catégorie et priorité en codes (libellés résolus à l'affichage selon la langue). */
type Aviso = { id: string | null; fixado: boolean; categorie: string; priorite: PrioriteAviso; expire: boolean; titulo: string; desc: string; edificio: string; views: number; color: string; data: string }
const COR: Record<string, string> = { rust: 'var(--v54-rust-500)', amber: 'var(--v54-amber-500)', gold: 'var(--v54-gold-500)', sage: 'var(--v54-sage-500)' }
const avisoCard = { background: '#fff', border: '1px solid var(--v54-line)', borderRadius: 14, boxShadow: 'var(--v54-shadow-card)', padding: '18px 20px', marginBottom: 12 } as const
const fieldInput = { width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, fontSize: 13 } as const
const prioKind = (p: PrioriteAviso): PillKind | undefined => (p === 'urgente' ? 'rust' : p === 'importante' ? 'gold' : undefined)
/** Actions rapides : icône, clé du libellé, catégorie passée au formulaire. */
const ACOES: [IconName, 'urgent' | 'ag' | 'financier', string][] = [['siren', 'urgent', 'urgente'], ['bank', 'ag', 'assembleia'], ['coin', 'financier', 'financeiro']]
/** Ordre des catégories (répartition et liste du formulaire). */
const CATEGORIES: CategorieAviso[] = ['manutencao', 'assembleia', 'financeiro', 'seguranca', 'social', 'outro']
const DISTRIB_DEMO: Record<CategorieAviso, number> = { manutencao: 4, assembleia: 1, financeiro: 1, seguranca: 1, social: 1, outro: 0 }

/** Priorité API (normal | importante | urgente) → pastille affichée. */
const prioriteAffichee = (p: string): PrioriteAviso => (p === 'urgente' || p === 'importante' ? p : '')
const fmtDate = (iso: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`
}

export default function ModQuadroAvisos() {
  const t = useMessages(QUADRO_AVISOS_MESSAGES)
  // Phase 3 : vrais avisos du cabinet si syndic connecté, sinon mock (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const avisos: Aviso[] = real
    ? (data.avisos ?? []).map((a) => ({
        id: a.id, fixado: !!a.fixado, categorie: a.categoria,
        priorite: prioriteAffichee(a.prioridade), expire: false, titulo: a.titulo, desc: a.descricao,
        edificio: a.immeuble || '—', views: a.views,
        color: a.prioridade === 'urgente' ? 'rust' : a.prioridade === 'importante' ? 'gold' : '', data: fmtDate(a.createdAt),
      }))
    : t.demo.map((a) => ({ id: null, fixado: a.fixado, categorie: a.categorie, priorite: a.priorite, expire: a.expire, titulo: a.titre, desc: a.desc, edificio: a.edificio, views: a.views, color: a.color, data: a.data }))
  // Catégorie API inconnue : valeur brute (comportement d'origine).
  const categorieLabel = (c: string) => t.categories[c] ?? c

  // Sidebar (réel calculé / mock statique).
  const catCount = (key: string) => (data.avisos ?? []).filter((a) => a.categoria === key).length
  const DISTRIB: [string, number][] = CATEGORIES.map((c) => [t.categories[c], real ? catCount(c) : DISTRIB_DEMO[c]])
  const totalViews = (data.avisos ?? []).reduce((s, a) => s + (a.views || 0), 0)
  const RESUMO: [IconName, number, string][] = real
    ? [['clipboard', avisos.length, t.resume.actifs], ['eye', totalViews, t.resume.vues], ['pin', (data.avisos ?? []).filter((a) => a.fixado).length, t.resume.epingles]]
    : [['clipboard', 8, t.resume.actifs], ['calendar', 0, t.resume.ceMois], ['eye', 62, t.resume.plusVu]]

  // Phase 3 écritures : « Novo Aviso » / Ações Rápidas → POST /api/syndic/avisos.
  const { push } = useToast()
  const blank = { titulo: '', descricao: '', categoria: 'outro', prioridade: 'normal', immeuble: '', fixado: 'nao' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = (categoria?: string, prioridade?: string) => { setForm({ ...blank, categoria: categoria || 'outro', prioridade: prioridade || 'normal' }); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.titulo.trim()) errs.titulo = t.erreurs.titre
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/avisos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ titulo: form.titulo, descricao: form.descricao, categoria: form.categoria, prioridade: form.prioridade, immeuble: form.immeuble, fixado: form.fixado === 'sim' }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: t.toasts.publie, desc: form.titulo }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurPublication, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: t.toasts.publieDemo, desc: t.toasts.connexionRequise })
  }

  const fl = t.filtres
  const f = t.formulaire
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau}
        actions={<Button variant="gold" onClick={() => openNew()}><Icon name="plus" />{t.nouvelAvis}</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
        <div style={{ position: 'relative' }}><Icon name="search" style={{ position: 'absolute', left: 12, top: 11, width: 14, height: 14, color: 'var(--v54-navy-300)' }} /><input aria-label={fl.rechercheAria} style={fieldInput} placeholder={fl.recherchePlaceholder} /></div>
        <select className={btnCss.btn} aria-label={fl.statutAria}><option>{fl.statutActifs}</option></select>
        <select className={btnCss.btn} aria-label={fl.categorieAria}><option>{fl.toutesCategories}</option></select>
        <select className={btnCss.btn} aria-label={fl.prioriteAria}><option>{fl.toutesPriorites}</option></select>
        <select className={btnCss.btn} aria-label={fl.immeubleAria}><option>{fl.tousImmeubles}</option></select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div>
          {avisos.length === 0 ? (
            <div style={{ ...avisoCard, color: 'var(--v54-navy-300)', fontSize: 13 }}>{t.aucunAvis}</div>
          ) : avisos.map((a, i) => (
            <div key={a.id ?? i} style={{ ...avisoCard, borderLeft: `3px solid ${COR[a.color] || 'var(--v54-navy-300)'}` }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                {a.fixado && <Pill kind="gold" noDot>{t.fixe}</Pill>}
                <Pill noDot>{categorieLabel(a.categorie)}</Pill>
                {a.priorite && <Pill kind={prioKind(a.priorite)} noDot>{t.priorites[a.priorite]}</Pill>}
                {a.expire && <Pill noDot>{t.expire}</Pill>}
              </div>
              <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 20, fontWeight: 500, marginBottom: 6 }}>{a.titulo}</div>
              <div style={{ fontSize: 13, color: 'var(--v54-navy-500)', marginBottom: 8 }}>{a.desc}</div>
              <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--v54-navy-300)' }}>
                <span>{a.edificio === '—' ? t.auteurGeneral : t.auteurImmeuble}</span><span>{a.data}</span><span>{a.edificio}</span><span>{a.views}</span>
              </div>
            </div>
          ))}
        </div>
        <div>
          <Panel title={t.resumeTitre}>
            {RESUMO.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < 2 ? '1px solid var(--v54-line)' : 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)' }}><Icon name={s[0]} /></div>
                <div><div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 20 }}>{s[1]}</div><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{s[2]}</div></div>
              </div>
            ))}
          </Panel>
          <Panel title={t.distributionTitre}>
            {DISTRIB.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, borderBottom: i < 5 ? '1px solid var(--v54-line)' : 'none' }}>
                <span>{c[0]}</span><b>{c[1]}</b>
              </div>
            ))}
          </Panel>
          <Panel title={t.actionsTitre}>
            {ACOES.map((q, i) => (
              <Button key={i} onClick={() => openNew(q[2], q[2] === 'urgente' ? 'urgente' : 'importante')} style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 8, padding: '10px 14px', background: 'var(--v54-cream)' }}><Icon name={q[0]} /> <span>{t.actionsRapides[q[1]]}</span></Button>
            ))}
          </Panel>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="na-title" size="md">
        <ModalHead icon="clipboard" id="na-title" title={f.titreModale} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label={f.titre} required full name="na-tit" error={errors.titulo}>
              <input type="text" placeholder={f.titrePlaceholder} value={form.titulo} onChange={(e) => upd('titulo', e.target.value)} />
            </Field>
            <Field label={f.description} full name="na-desc">
              <textarea rows={3} placeholder={f.descriptionPlaceholder} value={form.descricao} onChange={(e) => upd('descricao', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={f.categorie} name="na-cat">
                <select value={form.categoria} onChange={(e) => upd('categoria', e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{t.categories[c]}</option>)}
                </select>
              </Field>
              <Field label={f.priorite} name="na-prio">
                <select value={form.prioridade} onChange={(e) => upd('prioridade', e.target.value)}>
                  <option value="normal">{f.priorites.normal}</option>
                  <option value="importante">{f.priorites.importante}</option>
                  <option value="urgente">{f.priorites.urgente}</option>
                </select>
              </Field>
            </FormRow>
            <FormRow>
              <Field label={f.immeuble} name="na-imovel">
                <input type="text" placeholder={f.immeublePlaceholder} value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
              </Field>
              <Field label={f.epingler} name="na-fix">
                <select value={form.fixado} onChange={(e) => upd('fixado', e.target.value)}>
                  <option value="nao">{f.non}</option>
                  <option value="sim">{f.oui}</option>
                </select>
              </Field>
            </FormRow>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{f.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{f.publier}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
