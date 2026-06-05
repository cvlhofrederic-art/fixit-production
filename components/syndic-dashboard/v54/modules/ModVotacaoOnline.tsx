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

/** Votação Online AG — port V5.7 + lot 4 fonctionnel.
 * Syndic connecté → vraies votações du cabinet (data.votacoes) + création POST ;
 * anonyme → preview byte-exact. Progressão = somme das permilagens / permilagem total. */

type VotForm = { titulo: string; descricao: string; edificio: string; estado: Votacao['estado']; maioria: Votacao['maioria']; artigo: string; prazo: string; permTotal: string; options: string }

const estadoLabel = (v: string) => (({ aberta: 'Aberta', aprovada: 'Aprovada', rejeitada: 'Rejeitada', encerrada: 'Encerrada' } as Record<string, string>)[v] || v)
const estadoKind = (v: string): PillKind => (({ aberta: 'sage', aprovada: 'sage', rejeitada: 'rust', encerrada: 'amber' } as Record<string, PillKind>)[v] || 'sage')
const maioriaLabel = (v: string) => (({ simples: 'Maioria Simples', qualificada: 'Maioria Qualificada', unanimidade: 'Unanimidade' } as Record<string, string>)[v] || v)
const somaPerm = (v: Votacao) => v.options.reduce((s, o) => s + (Number(o.perm) || 0), 0)
const pctOf = (v: Votacao) => (v.permTotal > 0 ? Math.min(100, Math.round((somaPerm(v) / v.permTotal) * 100)) : 0)

const PREVIEW: Votacao[] = [
  { id: 'v1', titulo: 'Aprovação do orçamento anual 2026', descricao: 'Deliberação sobre o orçamento previsto para o exercício de 2026, incluindo quotas ordinárias e fundo de reserva. Valor total proposto: 45.600 EUR', edificio: 'Edifício Sol Nascente', estado: 'aberta', maioria: 'simples', artigo: 'Art.° 1432.° CC', prazo: '2026-05-23', permTotal: 1000, options: [{ label: 'A favor', perm: 360 }, { label: 'Contra', perm: 140 }, { label: 'Abstenção', perm: 0 }] },
  { id: 'v2', titulo: 'Obras de reparação do telhado', descricao: 'Votação para aprovação das obras de reparação urgente do telhado do bloco B. Três orçamentos obtidos. Valor médio: 18.200 EUR. Necessária maioria qualificada.', edificio: 'Edifício Sol Nascente', estado: 'aberta', maioria: 'qualificada', artigo: 'Art.° 1433.° CC', prazo: '2026-05-19', permTotal: 1000, options: [{ label: 'A favor', perm: 250 }, { label: 'Contra', perm: 0 }, { label: 'Abstenção', perm: 0 }] },
]

export default function ModVotacaoOnline() {
  const data = useSyndicData()
  const real = data.authenticated
  const all: Votacao[] = real ? (data.votacoes ?? []) : PREVIEW
  const { busy, create } = useSyndicCreate('/api/syndic/votacoes')

  const blank: VotForm = { titulo: '', descricao: '', edificio: '', estado: 'aberta', maioria: 'simples', artigo: '', prazo: '', permTotal: '1000', options: 'A favor\nContra\nAbstenção' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<VotForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof VotForm, string>>>({})

  const upd = (k: keyof VotForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.titulo.trim()) { setErrors({ titulo: 'Indique o título da deliberação.' }); return }
    const options = form.options.split('\n').map(l => l.trim()).filter(Boolean).map(label => ({ label, perm: 0 }))
    create(
      { titulo: form.titulo, descricao: form.descricao, edificio: form.edificio, estado: form.estado, maioria: form.maioria, artigo: form.artigo, prazo: form.prazo || null, permTotal: Number(form.permTotal) || 1000, options },
      { okTitle: 'Deliberação criada', desc: form.titulo, onDone: () => setOpen(false) },
    )
  }

  const ativas = all.filter(v => v.estado === 'aberta').length
  const aprovadas = all.filter(v => v.estado === 'aprovada').length
  const rejeitadas = all.filter(v => v.estado === 'rejeitada').length
  const partMedia = all.length ? Math.round(all.reduce((s, v) => s + pctOf(v), 0) / all.length) : 0

  return (
    <>
      <PageHead title="Votação Online AG" lede="Gestão de deliberações e votações eletrónicas para assembleias de condóminos"
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />Nova deliberação</Button>} />
      <KPIGrid items={[
        { icon: 'poll', num: ativas, lbl: 'Ativas', accent: ativas ? 'gold' : undefined },
        { icon: 'check', num: aprovadas, lbl: 'Aprovadas', accent: aprovadas ? 'sage' : undefined },
        { icon: 'ban', num: rejeitadas, lbl: 'Rejeitadas', accent: rejeitadas ? 'rust' : undefined },
        { icon: 'chart', num: `${partMedia}%`, lbl: 'Participação média' },
      ]} />
      <Tabs defaultActive="ativ" tabs={[
        { id: 'ativ', icon: 'chart', label: 'Votações Ativas', badge: ativas },
        { id: 'hist', icon: 'folder', label: 'Histórico', badge: aprovadas + rejeitadas },
        { id: 'cfg', icon: 'cog', label: 'Configuração' },
      ]} />
      <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 22, marginBottom: 14 }}>Deliberações em curso</div>
      {real && all.length === 0 ? (
        <Empty illustration="ag" title="Sem deliberações" desc="Crie a primeira deliberação para votação eletrónica em AG"
          action={<Button variant="gold" onClick={openNew}><Icon name="plus" />Nova deliberação</Button>} />
      ) : all.map((v) => (
        <div key={v.id} className={m.card} style={{ padding: 22, marginBottom: 14, position: 'relative' }}>
          {v.prazo && (
            <div style={{ position: 'absolute', top: 18, right: 22, fontSize: 11, color: 'var(--v54-navy-300)' }}>Prazo: {v.prazo}</div>
          )}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <Pill kind={estadoKind(v.estado)} noDot>● {estadoLabel(v.estado)}</Pill>
            <Pill kind="amber" noDot>{maioriaLabel(v.maioria)}</Pill>
            {v.artigo && <span style={{ fontSize: 11, color: 'var(--v54-navy-300)', alignSelf: 'center' }}>{v.artigo}</span>}
          </div>
          <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500, marginBottom: 6 }}>{v.titulo}</div>
          <div style={{ fontSize: 13, color: 'var(--v54-navy-500)', marginBottom: 12 }}>{v.descricao}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 6 }}>
            <span>Progresso: {pctOf(v)}%</span><span>{somaPerm(v)} / {v.permTotal} permilagem</span>
          </div>
          <Progress pct={pctOf(v)} kind={v.estado === 'rejeitada' ? 'rust' : undefined} />
          <div style={{ marginTop: 12, display: 'flex', gap: 18, fontSize: 12.5, flexWrap: 'wrap' }}>
            {v.options.map((opt, j) => (
              <div key={j}><b>{opt.label}</b> <span style={{ color: 'var(--v54-navy-300)' }}>({opt.perm}‰)</span></div>
            ))}
          </div>
          {v.edificio && <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginTop: 10 }}>{v.edificio}</div>}
        </div>
      ))}

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="vot-modal-title" size="md">
        <ModalHead icon="poll" id="vot-modal-title" title="Nova deliberação" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label="Título da deliberação" required full name="vot-titulo" error={errors.titulo}>
              <input type="text" placeholder="Ex.: Aprovação do orçamento anual 2026" value={form.titulo} onChange={e => upd('titulo', e.target.value)} />
            </Field>
            <Field label="Descrição" full name="vot-desc">
              <textarea rows={2} value={form.descricao} onChange={e => upd('descricao', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Edifício" name="vot-edif">
                <input type="text" placeholder="Edifício…" value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
              </Field>
              <Field label="Artigo (CC)" name="vot-artigo">
                <input type="text" placeholder="Art.° 1432.° CC" value={form.artigo} onChange={e => upd('artigo', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Maioria exigida" name="vot-maioria">
                <select value={form.maioria} onChange={e => upd('maioria', e.target.value)}>
                  <option value="simples">Maioria Simples</option>
                  <option value="qualificada">Maioria Qualificada</option>
                  <option value="unanimidade">Unanimidade</option>
                </select>
              </Field>
              <Field label="Estado" name="vot-estado">
                <select value={form.estado} onChange={e => upd('estado', e.target.value)}>
                  <option value="aberta">Aberta</option>
                  <option value="aprovada">Aprovada</option>
                  <option value="rejeitada">Rejeitada</option>
                  <option value="encerrada">Encerrada</option>
                </select>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Prazo" name="vot-prazo">
                <input type="date" value={form.prazo} onChange={e => upd('prazo', e.target.value)} />
              </Field>
              <Field label="Permilagem total" hint="Ex.: 1000" name="vot-perm">
                <input type="number" min="0" inputMode="numeric" placeholder="1000" value={form.permTotal} onChange={e => upd('permTotal', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Opções de voto" hint="Uma por linha" full name="vot-options">
              <textarea rows={3} value={form.options} onChange={e => upd('options', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>Criar deliberação</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
