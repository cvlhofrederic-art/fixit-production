'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { Alert } from '../primitives/alert'
import { KPIGrid } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { PlanoMan } from '@/lib/syndic/v54/api'
import { useSyndicCreate } from './use-syndic-create'

/** Plano de Manutenção — port V5.7 + lot 2 fonctionnel.
 * Syndic connecté → vrais plans du cabinet (data.planosMan) + création POST ;
 * anonyme → état vide byte-exact (design showcase). */

type PlanForm = { titulo: string; edificio: string; estado: PlanoMan['estado']; orcamento: string; anoInicio: string; periodicidade: string; descricao: string }

const fmtEUR = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)
const estadoLabel = (v: string) => (({ preparacao: 'Em preparação', aprovado: 'Aprovado', concluido: 'Concluído' } as Record<string, string>)[v] || v)
const estadoKind = (v: string): PillKind => (({ preparacao: 'amber', aprovado: 'sage', concluido: 'gold' } as Record<string, PillKind>)[v] || 'amber')

export default function ModPlanoMan() {
  const data = useSyndicData()
  const real = data.authenticated
  const all: PlanoMan[] = real ? (data.planosMan ?? []) : []
  const { busy, create } = useSyndicCreate('/api/syndic/planos-man')

  const blank: PlanForm = { titulo: '', edificio: '', estado: 'preparacao', orcamento: '', anoInicio: '', periodicidade: '8 anos', descricao: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<PlanForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof PlanForm, string>>>({})

  const upd = (k: keyof PlanForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.titulo.trim()) { setErrors({ titulo: 'Indique o título do plano.' }); return }
    create(
      { titulo: form.titulo, edificio: form.edificio, estado: form.estado, orcamento: Number(form.orcamento) || 0, anoInicio: form.anoInicio ? Number(form.anoInicio) : null, periodicidade: form.periodicidade, descricao: form.descricao },
      { okTitle: 'Plano criado', desc: form.titulo, onDone: () => setOpen(false) },
    )
  }

  const aprovados = all.filter(p => p.estado === 'aprovado').length
  const emPrep = all.filter(p => p.estado === 'preparacao').length
  const orcTotal = all.reduce((s, p) => s + (Number(p.orcamento) || 0), 0)

  return (
    <>
      <PageHead title="Plano de Manutenção" lede="Conservação obrigatória 8 anos — DL 555/99 art. 89.°"
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />+ Novo plano</Button>} />
      <Alert kind="gold" icon="scale" title="Obrigação Legal — DL 555/99 art. 89.°">
        Os edifícios devem ser objeto de obras de conservação pelo menos uma vez em cada período de 8 anos. A câmara municipal pode determinar a execução de obras de conservação necessárias.
      </Alert>
      <KPIGrid items={[
        { icon: 'doc', num: all.length, lbl: 'Planos criados' },
        { icon: 'check', num: aprovados, lbl: 'Aprovados em AG', accent: aprovados ? 'sage' : undefined },
        { icon: 'pencil', num: emPrep, lbl: 'Em preparação', accent: emPrep ? 'amber' : undefined },
        { icon: 'coin', num: orcTotal ? fmtEUR(orcTotal).replace('€', '').trim() : '—', cur: orcTotal ? '€' : undefined, lbl: 'Orçamento total' },
      ]} />
      <Panel>
        {all.length === 0 ? (
          <Empty illustration="eventos" title="Nenhum plano de manutenção"
            desc="Comece por criar o plano de conservação para os seus edifícios."
            action={<Button variant="primary" onClick={openNew}><Icon name="plus" />+ Criar plano</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>Título</th><th>Edifício</th><th>Início</th><th>Periodicidade</th><th>Orçamento</th><th>Estado</th></tr></thead>
              <tbody>{all.map(p => (
                <tr key={p.id}><td><b>{p.titulo}</b></td><td>{p.edificio || '—'}</td><td>{p.anoInicio || '—'}</td><td>{p.periodicidade || '—'}</td><td className={m.numCell}>{fmtEUR(Number(p.orcamento) || 0)}</td><td><Pill kind={estadoKind(p.estado)} noDot>{estadoLabel(p.estado)}</Pill></td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="plano-modal-title" size="md">
        <ModalHead icon="doc" id="plano-modal-title" title="Novo plano de manutenção" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label="Título" required full name="plano-titulo" error={errors.titulo}>
              <input type="text" placeholder="Ex.: Conservação fachada e cobertura" value={form.titulo} onChange={e => upd('titulo', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Edifício" name="plano-edif">
                <input type="text" placeholder="Edifício…" value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
              </Field>
              <Field label="Estado" name="plano-estado">
                <select value={form.estado} onChange={e => upd('estado', e.target.value)}>
                  <option value="preparacao">Em preparação</option>
                  <option value="aprovado">Aprovado em AG</option>
                  <option value="concluido">Concluído</option>
                </select>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Ano de início" name="plano-ano">
                <input type="number" min="2000" max="2100" inputMode="numeric" placeholder="2026" value={form.anoInicio} onChange={e => upd('anoInicio', e.target.value)} />
              </Field>
              <Field label="Periodicidade" name="plano-period">
                <input type="text" placeholder="8 anos" value={form.periodicidade} onChange={e => upd('periodicidade', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Orçamento" hint="Valor em euros" name="plano-orc" suffix="€">
              <input type="number" step="0.01" min="0" inputMode="decimal" placeholder="0" value={form.orcamento} onChange={e => upd('orcamento', e.target.value)} />
            </Field>
            <Field label="Descrição" full name="plano-desc">
              <textarea rows={3} placeholder="Obras de conservação previstas…" value={form.descricao} onChange={e => upd('descricao', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>Criar plano</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
