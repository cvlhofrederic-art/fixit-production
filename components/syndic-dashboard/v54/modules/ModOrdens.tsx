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
import type { Mission } from '@/components/syndic-dashboard/types'

/** Ordens de serviço — port byte-exact du ModOrdens du bundle V5.7. */

const TABS: { id: string; label: string; count?: number }[] = [
  { id: 'todas', label: 'Todas', count: 9 },
  { id: 'urg', label: 'Urgentes', count: 1 },
  { id: 'curso', label: 'Em curso', count: 4 },
  { id: 'conc', label: 'Concluídas' },
]

const ORDERS = [
  ['Pendente', '#ORD-2026-001', 'Edifício Foz Douro', 'Canalização · Fuga de água apartamento', 'Fração 4B', 'Bruno Tavares', '22/05/2026'],
  ['Em curso', '#ORD-2026-002', 'Condomínio Boavista Center', 'Coordenação de obras · Acompanhamento da impermeabilização da cobertura', '', 'Bruno Tavares', '20/05/2026'],
  ['Concluída', '#ORD-2026-003', 'Residencial Cedofeita', 'Inspeção técnica · Verificação periódica do sistema de gás das partes comuns', '', 'Bruno Tavares', '12/04/2026'],
  ['Pendente', '#ORD-2026-004', 'Condomínio Boavista Center', 'Pequenas reparações · Substituição de 4 lâmpadas LED na garagem', '', 'Diogo Pereira', '18/05/2026'],
  ['Em curso', '#ORD-2026-005', 'Edifício Foz Douro', 'Pequenas reparações · Pintura de retoque na zona da entrada', 'And. 2.°', 'Tiago Mendes', '16/05/2026'],
  ['Pendente', '#ORD-2026-006', 'Edifício Foz Douro', 'Manutenção corrente · Portão automático da garagem fecha muito devagar', 'And. -1', '—', '—'],
  ['Pendente', '#ORD-2026-007', 'Edifício Foz Douro', 'Eletricidade · Iluminação do corredor do 2.° pisca constantemente', 'And. 2.°', '—', '—'],
  ['Pendente', '#ORD-2026-008', 'Residencial Cedofeita', 'Construção · Fissura nova no muro lateral do edifício, lado norte', 'And. Exterior', '—', '—'],
  ['Pendente', '#ORD-2026-009', 'Residencial Cedofeita', 'Manutenção corrente · Reparação de campainha avariada no R/C esquerdo', 'Bl. A · And. R/C', 'Tiago Mendes', '21/05/2026'],
] as const

const statusKind = (s: string): PillKind => (s === 'Pendente' ? 'amber' : 'sage')

type Row = readonly [string, string, string, string, string, string, string]
type OrderItem = { row: Row; id?: string; statut?: string; artisan?: string }

/** Statut mission Supabase → libellé PT affiché (Phase 2). */
function missionStatusLabel(statut: string): string {
  switch (statut) {
    case 'en_cours': case 'acceptee': return 'Em curso'
    case 'terminee': return 'Concluída'
    default: return 'Pendente'
  }
}

function missionToRow(mi: Mission): Row {
  return [
    missionStatusLabel(mi.statut),
    `#${(mi.id || '').slice(0, 8)}`,
    mi.immeuble,
    [mi.type, mi.description].filter(Boolean).join(' · '),
    mi.numLot ? `Fração ${mi.numLot}` : (mi.batiment || mi.etage || ''),
    mi.artisan || '—',
    mi.dateIntervention || mi.dateCreation || '—',
  ]
}

export default function ModOrdens() {
  const [tab, setTab] = useState<string>('todas')
  // Phase 2 : vraies missions du cabinet si syndic connecté, sinon mock (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const orders: ReadonlyArray<OrderItem> = real
    ? data.missions.map((mi) => ({ row: missionToRow(mi), id: mi.id, statut: mi.statut, artisan: mi.artisan }))
    : ORDERS.map((r) => ({ row: r }))
  const tabs = real
    ? [
        { id: 'todas', label: 'Todas', count: data.missions.length },
        { id: 'urg', label: 'Urgentes', count: data.missions.filter((mi) => mi.priorite === 'urgente').length },
        { id: 'curso', label: 'Em curso', count: data.missions.filter((mi) => mi.statut === 'en_cours' || mi.statut === 'acceptee').length },
        { id: 'conc', label: 'Concluídas', count: data.missions.filter((mi) => mi.statut === 'terminee').length },
      ]
    : TABS

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
    if (!form.immeuble.trim()) errs.immeuble = 'O edifício é obrigatório.'
    if (!form.type.trim()) errs.type = 'O tipo é obrigatório.'
    if (!form.description.trim()) errs.description = 'A descrição é obrigatória.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ immeuble: form.immeuble, type: form.type, description: form.description, priorite: form.priorite, artisan: form.artisan }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: 'Missão criada', desc: form.type }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao criar a missão', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: 'Missão criada (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }

  // Phase 2 écritures : « Abrir » / « Validar » → édition du statut + profissional via PATCH.
  const STATUT_OPTS = [
    { v: 'en_attente', l: 'Pendente' },
    { v: 'en_cours', l: 'Em curso' },
    { v: 'terminee', l: 'Concluída' },
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
        .then(() => { data.refresh?.(); setEditing(null); push({ kind: 'success', title: 'Missão atualizada', desc: STATUT_OPTS.find((o) => o.v === estado)?.l }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao atualizar', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusyEdit(false))
      return
    }
    setEditing(null)
    push({ kind: 'info', title: 'Missão atualizada (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }

  return (
    <>
      <PageHead
        title="Ordens de serviço"
        lede="Acompanhamento das missões em curso, pedidos pendentes e histórico"
        actions={<>
          <Button><Icon name="search" />Filtros</Button>
          <Button variant="gold" onClick={openNew}><Icon name="plus" />Nova missão</Button>
        </>}
      />
      <div className={m.chipRow}>
        {tabs.map((t) => (
          <button key={t.id} type="button" className={clsx(m.chip, tab === t.id && m.chipActive)} onClick={() => setTab(t.id)}>
            {t.label}{t.count != null && <span className={m.chipCount}> {t.count}</span>}
          </button>
        ))}
      </div>
      <Panel flush>
        {orders.map((it) => { const o = it.row; return (
          <div key={o[1]} style={{ padding: '18px 22px', borderBottom: '1px solid var(--v54-line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <Pill noDot>Normal</Pill>
              <Pill kind={statusKind(o[0])} noDot>{o[0]}</Pill>
              <span className={m.mono} style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>{o[1]}</span>
              {o[4] && <span style={{ fontSize: 11.5, color: 'var(--v54-navy-500)', marginLeft: 4 }}>{o[4]}</span>}
              <div style={{ flex: 1 }} />
              {o[0] !== 'Concluída' && o[5] === '—' && <Button size="sm" onClick={() => openEdit(it)} style={{ background: 'var(--v54-sage-500)', color: '#fff', border: 'none' }}>Validar</Button>}
              <Button variant="ghost" size="sm" onClick={() => openEdit(it)}>Abrir</Button>
            </div>
            <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 18, fontWeight: 500, marginBottom: 4 }}>{o[2]}</div>
            <div style={{ fontSize: 12.5, color: 'var(--v54-navy-500)' }}>{o[3]}</div>
            {o[5] !== '—' && <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11.5, color: 'var(--v54-navy-300)' }}><span>{o[5]}</span><span>{o[6]}</span></div>}
          </div>
        ) })}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="nm-title" size="md">
        <ModalHead icon="plus" id="nm-title" title="Nova missão" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label="Edifício" required full name="nm-imovel" error={errors.immeuble}>
              {real && data.immeubles.length > 0 ? (
                <select value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)}>
                  <option value="">Selecione…</option>
                  {data.immeubles.map((im) => <option key={im.id} value={im.nom}>{im.nom}</option>)}
                </select>
              ) : (
                <input type="text" placeholder="Nome do edifício" value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
              )}
            </Field>
            <FormRow>
              <Field label="Tipo" required name="nm-tipo" error={errors.type}>
                <input type="text" placeholder="Ex.: Canalização" value={form.type} onChange={(e) => upd('type', e.target.value)} />
              </Field>
              <Field label="Prioridade" name="nm-prio">
                <select value={form.priorite} onChange={(e) => upd('priorite', e.target.value)}>
                  <option value="basse">Baixa</option>
                  <option value="normale">Normal</option>
                  <option value="haute">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </Field>
            </FormRow>
            <Field label="Descrição" required full name="nm-desc" error={errors.description}>
              <textarea rows={3} placeholder="Descreva a intervenção…" value={form.description} onChange={(e) => upd('description', e.target.value)} />
            </Field>
            <Field label="Profissional (opcional)" full name="nm-art">
              <input type="text" placeholder="Nome do profissional" value={form.artisan} onChange={(e) => upd('artisan', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>Criar missão</button>
          </ModalFoot>
        </form>
      </Modal>

      <Modal open={editing != null} onClose={() => setEditing(null)} labelledBy="me-title" size="md">
        <ModalHead icon="clipboard" id="me-title" title="Gerir a missão" onClose={() => setEditing(null)} />
        <form onSubmit={saveEdit} noValidate>
          <ModalBody>
            {editing && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 18, fontWeight: 500 }}>{editing.row[2]}</div>
                <div style={{ fontSize: 12.5, color: 'var(--v54-navy-500)', marginTop: 2 }}>{editing.row[3]}</div>
              </div>
            )}
            <FormRow>
              <Field label="Estado" name="me-estado">
                <select value={estado} onChange={(e) => setEstado(e.target.value)}>
                  {STATUT_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </Field>
              <Field label="Profissional" name="me-art">
                <input type="text" placeholder="Nome do profissional" value={artisanEdit} onChange={(e) => setArtisanEdit(e.target.value)} />
              </Field>
            </FormRow>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busyEdit}>Guardar</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
