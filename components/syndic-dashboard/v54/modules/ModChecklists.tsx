'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Pill } from '../primitives/pill'
import { Progress } from '../primitives/progress'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Checklist } from '@/lib/syndic/v54/api'

/** Checklists Inteligentes — port V5.7 + lot fonctionnel.
 * Syndic connecté → vraies checklists du cabinet (data.checklists) + création POST ;
 * anonyme → Empty byte-exact (design showcase V5.7). */

type ChkForm = { titulo: string; tipo: string; edificio: string; estado: Checklist['estado']; items: string }

const MODELOS = ['Inspeção periódica do edifício', 'Preparação de Assembleia Geral', 'Entrada / saída de fração', 'Acompanhamento de obras']
const doneCount = (c: Checklist) => c.items.filter(i => i.done).length
const pctDone = (c: Checklist) => (c.items.length ? Math.round((doneCount(c) / c.items.length) * 100) : 0)

export default function ModChecklists() {
  const data = useSyndicData()
  const real = data.authenticated
  const all: Checklist[] = real ? (data.checklists ?? []) : []
  const emCurso = all.filter(c => c.estado === 'em_curso')
  const concluidas = all.filter(c => c.estado === 'concluida')

  const blank: ChkForm = { titulo: '', tipo: '', edificio: '', estado: 'em_curso', items: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ChkForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof ChkForm, string>>>({})
  const [busy, setBusy] = useState(false)
  const { push } = useToast()

  const upd = (k: keyof ChkForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = (modelo?: string) => { setForm({ ...blank, titulo: modelo || '' }); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.titulo.trim()) { setErrors({ titulo: 'Indique o título da checklist.' }); return }
    const items = form.items.split('\n').map(l => l.trim()).filter(Boolean).map(label => ({ label, done: false }))
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ titulo: form.titulo, tipo: form.tipo, edificio: form.edificio, estado: form.estado, items }),
      })
        .then(r => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: 'Checklist criada', desc: form.titulo }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao criar', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: 'Checklist criada (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }

  const card = (c: Checklist) => (
    <div key={c.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--v54-line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
        <b style={{ fontSize: 13.5 }}>{c.titulo}</b>
        <Pill kind={c.estado === 'concluida' ? 'sage' : 'amber'} noDot>{doneCount(c)}/{c.items.length}</Pill>
      </div>
      {c.edificio && <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginBottom: 6 }}>{c.edificio}</div>}
      <Progress pct={pctDone(c)} />
    </div>
  )

  return (
    <>
      <PageHead
        title="Checklists Inteligentes com IA"
        lede="Processos padronizados — inspeções, AG, entradas/saídas, obras"
        actions={<Button variant="gold" onClick={() => openNew()}><Icon name="plus" />+ Nova Checklist</Button>}
      />
      <KPIGrid items={[
        { accent: 'amber', lblFirst: true, num: emCurso.length, lbl: 'Em Curso' },
        { accent: 'sage', lblFirst: true, num: concluidas.length, lbl: 'Concluídas' },
        { accent: 'gold', lblFirst: true, num: all.length, lbl: 'Total' },
      ]} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <Panel title="Em Curso">
          {emCurso.length === 0
            ? <Empty illustration="documentos" title="Nenhuma checklist em curso" action={<Button variant="gold" onClick={() => openNew()}><Icon name="plus" />Nova</Button>} />
            : emCurso.map(card)}
        </Panel>
        <Panel title="Modelos">
          {MODELOS.map((t, i) => (
            <button key={i} type="button" onClick={() => openNew(t)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', width: '100%', background: 'none', border: 'none', borderBottom: i < MODELOS.length - 1 ? '1px solid var(--v54-line)' : 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}>
              <Icon name="clipboard" /><span>{t}</span>
            </button>
          ))}
        </Panel>
        <Panel title="Concluídas">
          {concluidas.length === 0 ? <Empty illustration="documentos" desc="Nenhuma checklist concluída" /> : concluidas.map(card)}
        </Panel>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="chk-modal-title" size="md">
        <ModalHead icon="clipboard" id="chk-modal-title" title="Nova checklist" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label="Título" required full name="chk-titulo" error={errors.titulo}>
              <input type="text" placeholder="Ex.: Inspeção periódica do edifício" value={form.titulo} onChange={e => upd('titulo', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Tipo" name="chk-tipo">
                <input type="text" placeholder="Inspeção, AG, obra…" value={form.tipo} onChange={e => upd('tipo', e.target.value)} />
              </Field>
              <Field label="Edifício" name="chk-edif">
                <input type="text" placeholder="Edifício…" value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Estado" name="chk-estado">
              <select value={form.estado} onChange={e => upd('estado', e.target.value)}>
                <option value="em_curso">Em curso</option>
                <option value="concluida">Concluída</option>
              </select>
            </Field>
            <Field label="Itens" hint="Um item por linha" full name="chk-items">
              <textarea rows={5} placeholder={'Verificar extintores\nTestar iluminação de emergência\nInspecionar telhado'} value={form.items} onChange={e => upd('items', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>Criar checklist</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
