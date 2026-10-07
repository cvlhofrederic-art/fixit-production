'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Obra, Orcamento } from '@/lib/syndic/v54/api'
import { useSyndicCreate } from './use-syndic-create'
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { MOD3_ORCAMENTOS_MESSAGES } from './i18n/ModMod3Orcamentos.messages'

/** Orçamentos & Obras (3 orçamentos) — port V5.7 + lot 7 fonctionnel.
 * Syndic connecté → vraies obras du cabinet (data.obras) groupées par estado en kanban +
 * création POST ; anonyme → preview byte-exact. Lei 8/2022 — 3 devis obligatoires.
 * FR : mise en concurrence au-delà du seuil voté en AG (art. 21 loi 1965, art. 19-2 décret 1967). */

type ObraForm = { titulo: string; tipo: string; descricao: string; local: string; prazo: string; estado: Obra['estado']; orcamento: string; empresa: string; numOrcamentos: string }
type ColCor = 'amber' | 'gold' | 'sage'

const fmtEUR = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)
/** Colonnes du kanban : étape (code de l'API) et couleur ; le titre vient du dictionnaire. */
const COLDEFS: Array<[Obra['estado'], ColCor]> = [
  ['orcamentacao', 'amber'],
  ['aprovacao_ag', 'gold'],
  ['execucao', 'sage'],
  ['concluida', 'sage'],
]
const dotClass = (cor: ColCor) => clsx(m.dotStatus, cor === 'amber' && m.dotStatusAmber, cor === 'gold' && m.dotStatusGold)

export default function ModMod3Orcamentos() {
  const t = useMessages(MOD3_ORCAMENTOS_MESSAGES)
  const locale = useV54Locale()
  const data = useSyndicData()
  const real = data.authenticated
  const all: Obra[] = real ? (data.obras ?? []) : t.demo
  const { busy, create } = useSyndicCreate('/api/syndic/obras')

  // Phase A : comparaison « 3 orçamentos » par obra → POST /api/syndic/orcamentos.
  const orc = useSyndicCreate('/api/syndic/orcamentos')
  const [compareObra, setCompareObra] = useState<Obra | null>(null)
  const orcBlank = { empresa: '', valor: '', prazoDias: '' }
  const [orcForm, setOrcForm] = useState(orcBlank)
  const orcUpd = (k: keyof typeof orcBlank, v: string) => setOrcForm(s => ({ ...s, [k]: v }))
  const orcamentosObra: Orcamento[] = compareObra
    ? (data.orcamentos ?? []).filter(x => x.obraId === compareObra.id).slice().sort((a, b) => a.valor - b.valor)
    : []
  const addOrcamento = (e: FormEvent) => {
    e.preventDefault()
    if (!compareObra || !orcForm.empresa.trim()) return
    orc.create(
      { obraId: compareObra.id, empresa: orcForm.empresa, valor: Number(orcForm.valor) || 0, prazoDias: Number(orcForm.prazoDias) || undefined },
      { okTitle: t.comparaison.ajoute, desc: orcForm.empresa, onDone: () => setOrcForm(orcBlank) },
    )
  }

  const blank: ObraForm = { titulo: '', tipo: '', descricao: '', local: '', prazo: '', estado: 'orcamentacao', orcamento: '', empresa: '', numOrcamentos: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ObraForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof ObraForm, string>>>({})

  const upd = (k: keyof ObraForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.titulo.trim()) { setErrors({ titulo: t.erreurIntitule }); return }
    create(
      { titulo: form.titulo, tipo: form.tipo, descricao: form.descricao, local: form.local, prazo: form.prazo || null, estado: form.estado, orcamento: Number(form.orcamento) || 0, empresa: form.empresa, numOrcamentos: Number(form.numOrcamentos) || 0 },
      { okTitle: t.cree, desc: form.titulo, onDone: () => setOpen(false) },
    )
  }

  const ativas = all.filter(o => o.estado !== 'concluida').length
  const cnt = (e: Obra['estado']) => all.filter(o => o.estado === e).length
  const totalOrc = all.reduce((s, o) => s + (Number(o.numOrcamentos) || 0), 0)

  const ca = t.carte
  const cp = t.comparaison
  const f = t.formulaire
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <KPIGrid items={[
        { icon: 'construction', num: ativas, lbl: t.kpi.actifs, accent: 'gold' },
        { icon: 'pencil', num: cnt('orcamentacao'), lbl: t.kpi.consultation, accent: 'amber' },
        { icon: 'check', num: cnt('aprovacao_ag'), lbl: t.kpi.vote, accent: 'sage' },
        { icon: 'wrench', num: cnt('execucao'), lbl: t.kpi.execution },
        { icon: 'check', num: cnt('concluida'), lbl: t.kpi.termines, accent: 'sage' },
        { icon: 'chart', num: totalOrc, lbl: t.kpi.totalDevis },
      ]} />
      <Tabs defaultActive="cur" tabs={[
        { id: 'cur', icon: 'construction', label: t.onglets.cur, badge: ativas },
        { id: 'cmp', icon: 'chart', label: t.onglets.cmp, badge: cnt('orcamentacao') },
        { id: 'arq', icon: 'folder', label: t.onglets.arq, badge: cnt('concluida') },
        { id: 'reg', icon: 'clipboard', label: t.onglets.reg },
      ]} />
      <Button variant="gold" style={{ marginBottom: 14 }} onClick={openNew}><Icon name="plus" />{t.nouveau}</Button>
      <div className={m.cardGrid4}>
        {COLDEFS.map(([estado, cor], i) => {
          const titulo = t.colonnes[estado]
          const obras = all.filter(o => o.estado === estado)
          return (
            <div key={estado}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 6px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}><span className={dotClass(cor)}></span> {titulo}</span>
                <span style={{ fontWeight: 700, color: 'var(--v54-navy-300)' }}>{obras.length}</span>
              </div>
              {obras.length === 0 ? (
                <div style={{ padding: 36, textAlign: 'center', color: 'var(--v54-navy-300)', background: 'var(--v54-paper)', borderRadius: 12, fontSize: 12.5 }}>{t.aucun}</div>
              ) : (
                obras.map(o => (
                  <Panel key={o.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 6 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{o.titulo}</div><Pill kind={cor as PillKind} noDot>{o.tipo || '—'}</Pill></div>
                    <div style={{ fontSize: 11.5, color: 'var(--v54-navy-500)', marginBottom: 8 }}>{o.descricao}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginBottom: 4 }}>{o.local || '—'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginBottom: 4 }}>{ca.echeance}{o.prazo || '—'}</div>
                    {o.orcamento > 0 && <div style={{ fontSize: 12, color: 'var(--v54-gold-700)', fontWeight: 600, marginBottom: 4 }}>{ca.montant}{fmtEUR(o.orcamento, locale)}</div>}
                    {o.empresa && <div style={{ fontSize: 11.5, marginBottom: 4 }}>{o.empresa}</div>}
                    <Pill kind="sage" noDot>{o.numOrcamentos}{ca.nbDevis}</Pill>
                    <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                      {i === 0
                        ? <Button size="sm" onClick={() => setCompareObra(o)}><Icon name="chart" />{ca.comparer}</Button>
                        : <select className={clsx(btnCss.btn, btnCss.sm)} style={{ flex: 1 }} aria-label={ca.etapeAria}><option>{titulo}</option></select>}
                    </div>
                  </Panel>
                ))
              )}
            </div>
          )
        })}
      </div>

      <Modal open={compareObra != null} onClose={() => setCompareObra(null)} labelledBy="cmp-title" size="md">
        <ModalHead icon="chart" id="cmp-title" title={cp.titre} onClose={() => setCompareObra(null)} />
        <ModalBody>
          <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 18, marginBottom: 4 }}>{compareObra?.titulo}</div>
          <div style={{ fontSize: 12, color: 'var(--v54-navy-300)', marginBottom: 14 }}>{cp.rappel}</div>
          {orcamentosObra.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--v54-navy-300)', fontSize: 13 }}>{cp.aucunDevis}</div>
          ) : (
            <div className={m.tblWrap}>
              <table className={m.tbl}>
                <thead><tr><th>{cp.entreprise}</th><th>{cp.montant}</th><th>{cp.delai}</th></tr></thead>
                <tbody>{orcamentosObra.map((x, idx) => (
                  <tr key={x.id}>
                    <td><b>{x.empresa || '—'}</b> {x.recomendado && <Pill kind="gold" noDot>{cp.recommande}</Pill>}</td>
                    <td className={m.numCell}>{fmtEUR(x.valor, locale)} {idx === 0 && orcamentosObra.length > 1 && <Pill kind="sage" noDot>{cp.moinsDisant}</Pill>}</td>
                    <td className={m.numCell}>{x.prazoDias != null ? cp.jours(x.prazoDias) : '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <form onSubmit={addOrcamento} style={{ marginTop: 16 }} noValidate>
            <FormRow>
              <Field label={cp.entreprise} name="orc-emp">
                <input type="text" placeholder={cp.nomEntreprise} value={orcForm.empresa} onChange={e => orcUpd('empresa', e.target.value)} />
              </Field>
              <Field label={cp.montantEuros} name="orc-val">
                <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={orcForm.valor} onChange={e => orcUpd('valor', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={cp.delaiJours} name="orc-prz">
              <input type="number" min="0" inputMode="numeric" placeholder="—" value={orcForm.prazoDias} onChange={e => orcUpd('prazoDias', e.target.value)} />
            </Field>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={orc.busy} style={{ marginTop: 10 }}><Icon name="plus" />{cp.ajouter}</button>
          </form>
        </ModalBody>
        <ModalFoot>
          <Button variant="ghost" onClick={() => setCompareObra(null)}>{cp.fermer}</Button>
        </ModalFoot>
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="obra-modal-title" size="md">
        <ModalHead icon="construction" id="obra-modal-title" title={f.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label={f.intitule} required full name="obra-titulo" error={errors.titulo}>
              <input type="text" placeholder={f.intitulePlaceholder} value={form.titulo} onChange={e => upd('titulo', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={f.type} name="obra-tipo">
                <input type="text" placeholder={f.typePlaceholder} value={form.tipo} onChange={e => upd('tipo', e.target.value)} />
              </Field>
              <Field label={f.etape} name="obra-estado">
                <select value={form.estado} onChange={e => upd('estado', e.target.value)}>
                  <option value="orcamentacao">{t.colonnes.orcamentacao}</option>
                  <option value="aprovacao_ag">{t.colonnes.aprovacao_ag}</option>
                  <option value="execucao">{t.colonnes.execucao}</option>
                  <option value="concluida">{t.colonnes.concluida}</option>
                </select>
              </Field>
            </FormRow>
            <Field label={f.description} full name="obra-desc">
              <textarea rows={2} value={form.descricao} onChange={e => upd('descricao', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={f.lieu} name="obra-local">
                <input type="text" placeholder={f.lieuPlaceholder} value={form.local} onChange={e => upd('local', e.target.value)} />
              </Field>
              <Field label={f.echeance} name="obra-prazo">
                <input type="date" value={form.prazo} onChange={e => upd('prazo', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={f.montant} hint={f.montantAide} name="obra-orc" suffix="€">
                <input type="number" step="0.01" min="0" inputMode="decimal" placeholder="0" value={form.orcamento} onChange={e => upd('orcamento', e.target.value)} />
              </Field>
              <Field label={f.nbDevis} hint={f.nbDevisAide} name="obra-norc">
                <input type="number" min="0" max="9" inputMode="numeric" placeholder="3" value={form.numOrcamentos} onChange={e => upd('numOrcamentos', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={f.entreprise} full name="obra-empresa">
              <input type="text" placeholder={f.entreprisePlaceholder} value={form.empresa} onChange={e => upd('empresa', e.target.value)} />
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
