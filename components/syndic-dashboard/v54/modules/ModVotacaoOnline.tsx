'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Pill, type PillKind } from '../primitives/pill'
import { Progress } from '../primitives/progress'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Votacao } from '@/lib/syndic/v54/api'
import { useSyndicCreate } from './use-syndic-create'
import { useMessages, useV54Locale } from '@/lib/syndic/v54/i18n'
import { dateApi } from '@/lib/syndic/v54/i18n/dates'
import { VOTACAO_ONLINE_MESSAGES } from './i18n/ModVotacaoOnline.messages'

/** Votação Online AG — port V5.7 + lot 4 fonctionnel.
 * Syndic connecté → vraies votações du cabinet (data.votacoes) + création POST ;
 * anonyme → preview byte-exact. Progressão = somme das permilagens / permilagem total. */

type VotForm = { titulo: string; descricao: string; edificio: string; estado: Votacao['estado']; maioria: Votacao['maioria']; artigo: string; prazo: string; permTotal: string; options: string }

/** Libellé d'un code (statut, majorité) dans la langue courante ; repli sur la valeur brute si le code est inconnu. */
const libelle = (v: string, libelles: Record<string, string>) => libelles[v] || v
const estadoKind = (v: string): PillKind => (({ aberta: 'sage', aprovada: 'sage', rejeitada: 'rust', encerrada: 'amber' } as Record<string, PillKind>)[v] || 'sage')
const somaPerm = (v: Votacao) => v.options.reduce((s, o) => s + (Number(o.perm) || 0), 0)
const pctOf = (v: Votacao) => (v.permTotal > 0 ? Math.min(100, Math.round((somaPerm(v) / v.permTotal) * 100)) : 0)

export default function ModVotacaoOnline() {
  const t = useMessages(VOTACAO_ONLINE_MESSAGES)
  const locale = useV54Locale()
  const data = useSyndicData()
  const real = data.authenticated
  const all: Votacao[] = real ? (data.votacoes ?? []) : t.demo
  const { busy, create } = useSyndicCreate('/api/syndic/votacoes')
  const [tab, setTab] = useState('ativ')

  const blank: VotForm = { titulo: '', descricao: '', edificio: '', estado: 'aberta', maioria: 'simples', artigo: '', prazo: '', permTotal: '1000', options: t.optionsParDefaut }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<VotForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof VotForm, string>>>({})

  const upd = (k: keyof VotForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.titulo.trim()) { setErrors({ titulo: t.erreurTitre }); return }
    const options = form.options.split('\n').map(l => l.trim()).filter(Boolean).map(label => ({ label, perm: 0 }))
    create(
      { titulo: form.titulo, descricao: form.descricao, edificio: form.edificio, estado: form.estado, maioria: form.maioria, artigo: form.artigo, prazo: form.prazo || null, permTotal: Number(form.permTotal) || 1000, options },
      { okTitle: t.creee, desc: form.titulo, onDone: () => setOpen(false) },
    )
  }

  const ativas = all.filter(v => v.estado === 'aberta').length
  const aprovadas = all.filter(v => v.estado === 'aprovada').length
  const rejeitadas = all.filter(v => v.estado === 'rejeitada').length
  const partMedia = all.length ? Math.round(all.reduce((s, v) => s + pctOf(v), 0) / all.length) : 0
  const md = t.modal

  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau}
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.nouvelle}</Button>} />
      <KPIGrid items={[
        { icon: 'poll', num: ativas, lbl: t.kpi.ouvertes, accent: ativas ? 'gold' : undefined },
        { icon: 'check', num: aprovadas, lbl: t.kpi.adoptees, accent: aprovadas ? 'sage' : undefined },
        { icon: 'ban', num: rejeitadas, lbl: t.kpi.rejetees, accent: rejeitadas ? 'rust' : undefined },
        { icon: 'chart', num: t.pourcentKpi(partMedia), lbl: t.kpi.participation },
      ]} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'ativ', icon: 'chart', label: t.onglets.ativ, badge: ativas },
        { id: 'hist', icon: 'folder', label: t.onglets.hist, badge: aprovadas + rejeitadas },
        { id: 'cfg', icon: 'cog', label: t.onglets.cfg },
      ]} />
      <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 22, marginBottom: 14 }}>{t.enCours}</div>
      {real && all.length === 0 ? (
        <Empty illustration="ag" title={t.vide.titre} desc={t.vide.desc}
          action={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.nouvelle}</Button>} />
      ) : all.filter(v => tab === 'hist' ? v.estado !== 'aberta' : tab === 'ativ' ? v.estado === 'aberta' : true).map((v) => (
        <div key={v.id} className={m.card} style={{ padding: 22, marginBottom: 14, position: 'relative' }}>
          {v.prazo && (
            <div style={{ position: 'absolute', top: 18, right: 22, fontSize: 11, color: 'var(--v54-navy-300)' }}>{t.echeance}{dateApi(v.prazo, locale)}</div>
          )}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <Pill kind={estadoKind(v.estado)} noDot>● {libelle(v.estado, t.etats)}</Pill>
            <Pill kind="amber" noDot>{libelle(v.maioria, t.majorites)}</Pill>
            {v.artigo && <span style={{ fontSize: 11, color: 'var(--v54-navy-300)', alignSelf: 'center' }}>{v.artigo}</span>}
          </div>
          <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500, marginBottom: 6 }}>{v.titulo}</div>
          <div style={{ fontSize: 13, color: 'var(--v54-navy-500)', marginBottom: 12 }}>{v.descricao}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 6 }}>
            <span>{t.progression}{pctOf(v)}{t.pourcent}</span><span>{somaPerm(v)} / {v.permTotal}{t.totalVoix}</span>
          </div>
          <Progress pct={pctOf(v)} kind={v.estado === 'rejeitada' ? 'rust' : undefined} />
          <div style={{ marginTop: 12, display: 'flex', gap: 18, fontSize: 12.5, flexWrap: 'wrap' }}>
            {v.options.map((opt, j) => (
              <div key={j}><b>{opt.label}</b> <span style={{ color: 'var(--v54-navy-300)' }}>({opt.perm}{t.voixOption}</span></div>
            ))}
          </div>
          {v.edificio && <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginTop: 10 }}>{v.edificio}</div>}
        </div>
      ))}

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="vot-modal-title" size="md">
        <ModalHead icon="poll" id="vot-modal-title" title={t.nouvelle} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label={md.champTitre} required full name="vot-titulo" error={errors.titulo}>
              <input type="text" placeholder={md.titrePlaceholder} value={form.titulo} onChange={e => upd('titulo', e.target.value)} />
            </Field>
            <Field label={md.description} full name="vot-desc">
              <textarea rows={2} value={form.descricao} onChange={e => upd('descricao', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={md.immeuble} name="vot-edif">
                <input type="text" placeholder={md.immeublePlaceholder} value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
              </Field>
              <Field label={md.article} name="vot-artigo">
                <input type="text" placeholder={md.articlePlaceholder} value={form.artigo} onChange={e => upd('artigo', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={md.majorite} name="vot-maioria">
                <select value={form.maioria} onChange={e => upd('maioria', e.target.value)}>
                  <option value="simples">{t.majorites.simples}</option>
                  <option value="qualificada">{t.majorites.qualificada}</option>
                  <option value="unanimidade">{t.majorites.unanimidade}</option>
                </select>
              </Field>
              <Field label={md.statut} name="vot-estado">
                <select value={form.estado} onChange={e => upd('estado', e.target.value)}>
                  <option value="aberta">{t.etats.aberta}</option>
                  <option value="aprovada">{t.etats.aprovada}</option>
                  <option value="rejeitada">{t.etats.rejeitada}</option>
                  <option value="encerrada">{t.etats.encerrada}</option>
                </select>
              </Field>
            </FormRow>
            <FormRow>
              <Field label={md.echeance} name="vot-prazo">
                <input type="date" value={form.prazo} onChange={e => upd('prazo', e.target.value)} />
              </Field>
              <Field label={md.totalVoix} hint={md.totalVoixAide} name="vot-perm">
                <input type="number" min="0" inputMode="numeric" placeholder="1000" value={form.permTotal} onChange={e => upd('permTotal', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={md.options} hint={md.optionsAide} full name="vot-options">
              <textarea rows={3} value={form.options} onChange={e => upd('options', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{md.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{md.creer}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
