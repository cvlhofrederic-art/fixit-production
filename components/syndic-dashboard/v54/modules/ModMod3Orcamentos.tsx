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
import { useComingSoon } from './use-coming-soon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Obra } from '@/lib/syndic/v54/api'
import { useSyndicCreate } from './use-syndic-create'

/** Orçamentos & Obras (3 orçamentos) — port V5.7 + lot 7 fonctionnel.
 * Syndic connecté → vraies obras du cabinet (data.obras) groupées par estado en kanban +
 * création POST ; anonyme → preview byte-exact. Lei 8/2022 — 3 devis obligatoires. */

type ObraForm = { titulo: string; tipo: string; descricao: string; local: string; prazo: string; estado: Obra['estado']; orcamento: string; empresa: string; numOrcamentos: string }
type ColCor = 'amber' | 'gold' | 'sage'

const fmtEUR = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)
const COLDEFS: Array<[string, Obra['estado'], ColCor]> = [
  ['Orçamentação', 'orcamentacao', 'amber'],
  ['Aprovação AG', 'aprovacao_ag', 'gold'],
  ['Em Execução', 'execucao', 'sage'],
  ['Concluída', 'concluida', 'sage'],
]
const dotClass = (cor: ColCor) => clsx(m.dotStatus, cor === 'amber' && m.dotStatusAmber, cor === 'gold' && m.dotStatusGold)

const PREVIEW: Obra[] = [
  { id: 'p1', titulo: 'Impermeabilização da cobertura', tipo: 'Reparação', descricao: 'Reparação e impermeabilização completa da cobertura do edifício principal, inclu…', local: 'Edifício Av. da Liberdade, 42', prazo: '2026-06-30', estado: 'orcamentacao', orcamento: 0, empresa: '', numOrcamentos: 3 },
  { id: 'p2', titulo: 'Renovação da fachada exterior', tipo: 'Renovação', descricao: 'Pintura e restauro da fachada com tratamento anti-humidade e limpeza de cantaria…', local: 'Edifício Rua Augusta, 105', prazo: '2026-09-15', estado: 'aprovacao_ag', orcamento: 29800, empresa: 'ConstruPT Lda.', numOrcamentos: 3 },
]

export default function ModMod3Orcamentos() {
  const soon = useComingSoon()
  const data = useSyndicData()
  const real = data.authenticated
  const all: Obra[] = real ? (data.obras ?? []) : PREVIEW
  const { busy, create } = useSyndicCreate('/api/syndic/obras')

  const blank: ObraForm = { titulo: '', tipo: '', descricao: '', local: '', prazo: '', estado: 'orcamentacao', orcamento: '', empresa: '', numOrcamentos: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ObraForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof ObraForm, string>>>({})

  const upd = (k: keyof ObraForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.titulo.trim()) { setErrors({ titulo: 'Indique o título da obra.' }); return }
    create(
      { titulo: form.titulo, tipo: form.tipo, descricao: form.descricao, local: form.local, prazo: form.prazo || null, estado: form.estado, orcamento: Number(form.orcamento) || 0, empresa: form.empresa, numOrcamentos: Number(form.numOrcamentos) || 0 },
      { okTitle: 'Obra criada', desc: form.titulo, onDone: () => setOpen(false) },
    )
  }

  const ativas = all.filter(o => o.estado !== 'concluida').length
  const cnt = (e: Obra['estado']) => all.filter(o => o.estado === e).length
  const totalOrc = all.reduce((s, o) => s + (Number(o.numOrcamentos) || 0), 0)

  return (
    <>
      <PageHead title="Orçamentos & Obras" lede="Comparação obrigatória de 3 orçamentos · Lei 8/2022 Art. 1436.° CC" />
      <KPIGrid items={[
        { icon: 'construction', num: ativas, lbl: 'Obras Ativas', accent: 'gold' },
        { icon: 'pencil', num: cnt('orcamentacao'), lbl: 'Em Orçamentação', accent: 'amber' },
        { icon: 'check', num: cnt('aprovacao_ag'), lbl: 'Aprovação AG', accent: 'sage' },
        { icon: 'wrench', num: cnt('execucao'), lbl: 'Em Execução' },
        { icon: 'check', num: cnt('concluida'), lbl: 'Concluídas', accent: 'sage' },
        { icon: 'chart', num: totalOrc, lbl: 'Total Orçamentos' },
      ]} />
      <Tabs defaultActive="cur" tabs={[
        { id: 'cur', icon: 'construction', label: 'Obras em Curso', badge: ativas },
        { id: 'cmp', icon: 'chart', label: 'Comparação Orçamentos', badge: cnt('orcamentacao') },
        { id: 'arq', icon: 'folder', label: 'Arquivo', badge: cnt('concluida') },
        { id: 'reg', icon: 'clipboard', label: 'Regras' },
      ]} />
      <Button variant="gold" style={{ marginBottom: 14 }} onClick={openNew}><Icon name="plus" />+ Nova Obra</Button>
      <div className={m.cardGrid4}>
        {COLDEFS.map(([titulo, estado, cor], i) => {
          const obras = all.filter(o => o.estado === estado)
          return (
            <div key={estado}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 6px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}><span className={dotClass(cor)}></span> {titulo}</span>
                <span style={{ fontWeight: 700, color: 'var(--v54-navy-300)' }}>{obras.length}</span>
              </div>
              {obras.length === 0 ? (
                <div style={{ padding: 36, textAlign: 'center', color: 'var(--v54-navy-300)', background: 'var(--v54-paper)', borderRadius: 12, fontSize: 12.5 }}>Nenhuma obra</div>
              ) : (
                obras.map(o => (
                  <Panel key={o.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 6 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{o.titulo}</div><Pill kind={cor as PillKind} noDot>{o.tipo || '—'}</Pill></div>
                    <div style={{ fontSize: 11.5, color: 'var(--v54-navy-500)', marginBottom: 8 }}>{o.descricao}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginBottom: 4 }}>{o.local || '—'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginBottom: 4 }}>Prazo: {o.prazo || '—'}</div>
                    {o.orcamento > 0 && <div style={{ fontSize: 12, color: 'var(--v54-gold-700)', fontWeight: 600, marginBottom: 4 }}>Orçamento: {fmtEUR(o.orcamento)}</div>}
                    {o.empresa && <div style={{ fontSize: 11.5, marginBottom: 4 }}>{o.empresa}</div>}
                    <Pill kind="sage" noDot>{o.numOrcamentos}/3 orçamentos</Pill>
                    <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                      {i === 0
                        ? <Button size="sm" onClick={soon('Comparar orçamentos', 'Comparação de orçamentos em desenvolvimento')}><Icon name="chart" />Comparar</Button>
                        : <select className={clsx(btnCss.btn, btnCss.sm)} style={{ flex: 1 }} aria-label="Estado da obra"><option>{titulo}</option></select>}
                    </div>
                  </Panel>
                ))
              )}
            </div>
          )
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="obra-modal-title" size="md">
        <ModalHead icon="construction" id="obra-modal-title" title="Nova obra" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label="Título" required full name="obra-titulo" error={errors.titulo}>
              <input type="text" placeholder="Ex.: Impermeabilização da cobertura" value={form.titulo} onChange={e => upd('titulo', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Tipo" name="obra-tipo">
                <input type="text" placeholder="Reparação, Renovação…" value={form.tipo} onChange={e => upd('tipo', e.target.value)} />
              </Field>
              <Field label="Estado" name="obra-estado">
                <select value={form.estado} onChange={e => upd('estado', e.target.value)}>
                  <option value="orcamentacao">Orçamentação</option>
                  <option value="aprovacao_ag">Aprovação AG</option>
                  <option value="execucao">Em Execução</option>
                  <option value="concluida">Concluída</option>
                </select>
              </Field>
            </FormRow>
            <Field label="Descrição" full name="obra-desc">
              <textarea rows={2} value={form.descricao} onChange={e => upd('descricao', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Local" name="obra-local">
                <input type="text" placeholder="Edifício / morada" value={form.local} onChange={e => upd('local', e.target.value)} />
              </Field>
              <Field label="Prazo" name="obra-prazo">
                <input type="date" value={form.prazo} onChange={e => upd('prazo', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Orçamento" hint="Valor retido (€)" name="obra-orc" suffix="€">
                <input type="number" step="0.01" min="0" inputMode="decimal" placeholder="0" value={form.orcamento} onChange={e => upd('orcamento', e.target.value)} />
              </Field>
              <Field label="N.º de orçamentos" hint="Mín. 3 (Lei 8/2022)" name="obra-norc">
                <input type="number" min="0" max="9" inputMode="numeric" placeholder="3" value={form.numOrcamentos} onChange={e => upd('numOrcamentos', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Empresa adjudicada" full name="obra-empresa">
              <input type="text" placeholder="Nome da empresa (se já escolhida)" value={form.empresa} onChange={e => upd('empresa', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>Criar obra</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
