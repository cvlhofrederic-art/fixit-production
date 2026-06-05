'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Pill } from '../primitives/pill'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Obrigacao } from '@/lib/syndic/v54/api'
import { useSyndicCreate } from './use-syndic-create'

/** Calendário Regulamentar — port V5.7 + lot 3 fonctionnel.
 * Syndic connecté → vraies obrigações du cabinet (data.obrigacoes) + création POST ;
 * anonyme → preview byte-exact. Le statut (expirado/urgente/próximo/em dia) est dérivé du prazo. */

type ObrForm = { edificio: string; tipo: string; descricao: string; prazo: string; concluido: string }
type Bucket = 'expirado' | 'urgente' | 'proximo' | 'emdia'

const daysTo = (d: string) => { const t = new Date(d).getTime(); return Number.isNaN(t) ? null : Math.ceil((t - Date.now()) / 86_400_000) }
const bucketOf = (o: Obrigacao): Bucket => {
  if (o.concluido) return 'emdia'
  const d = o.prazo ? daysTo(o.prazo) : null
  if (d === null) return 'proximo'
  if (d < 0) return 'expirado'
  if (d < 30) return 'urgente'
  if (d < 90) return 'proximo'
  return 'emdia'
}
const relLabel = (o: Obrigacao): string => {
  if (o.concluido) return 'Concluído'
  const d = o.prazo ? daysTo(o.prazo) : null
  if (d === null) return '—'
  return d < 0 ? `Há ${-d}d` : `Dentro de ${d}d`
}

const PREVIEW: Obrigacao[] = [
  { id: 'c1', edificio: 'Edifício Foz Douro', tipo: 'Assembleia Geral', descricao: 'AG Anual', prazo: '2026-04-15', concluido: false },
  { id: 'c2', edificio: 'Edifício Foz Douro', tipo: 'Inspeção elevador', descricao: 'Inspeção 2 anos elevador', prazo: '2026-04-30', concluido: false },
  { id: 'c3', edificio: 'Residencial Cedofeita', tipo: 'Renovação seguro', descricao: 'Renovação seguro condomínio', prazo: '2026-06-30', concluido: false },
  { id: 'c4', edificio: 'Condomínio Boavista Center', tipo: 'Inspeção gás', descricao: 'Inspeção 5 anos gás', prazo: '2026-07-20', concluido: false },
  { id: 'c5', edificio: 'Residencial Cedofeita', tipo: 'Verificação elétrica', descricao: 'Verificação instalação elétrica', prazo: '2026-08-10', concluido: false },
  { id: 'c6', edificio: 'Edifício Atlântico', tipo: 'Inspeção elevador', descricao: 'Inspeção 6 anos elevador', prazo: '2026-09-15', concluido: false },
  { id: 'c7', edificio: 'Edifício Atlântico', tipo: 'Assembleia Geral', descricao: 'AG Anual obrigatória', prazo: '2027-03-31', concluido: false },
  { id: 'c8', edificio: 'Condomínio Boavista Center', tipo: 'Manutenção fachada', descricao: 'Manutenção fachada (8 anos)', prazo: '2027-05-30', concluido: false },
]

const selectStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' } as const

export default function ModCalReg() {
  const data = useSyndicData()
  const real = data.authenticated
  const all: Obrigacao[] = real ? (data.obrigacoes ?? []) : PREVIEW
  const { busy, create } = useSyndicCreate('/api/syndic/obrigacoes')

  const blank: ObrForm = { edificio: '', tipo: '', descricao: '', prazo: '', concluido: 'nao' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ObrForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof ObrForm, string>>>({})

  const upd = (k: keyof ObrForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.tipo.trim()) { setErrors({ tipo: 'Indique o tipo de obrigação.' }); return }
    create(
      { edificio: form.edificio, tipo: form.tipo, descricao: form.descricao, prazo: form.prazo || null, concluido: form.concluido === 'sim' },
      { okTitle: 'Obrigação adicionada', desc: form.tipo, onDone: () => setOpen(false) },
    )
  }

  const expirados = all.filter(o => bucketOf(o) === 'expirado').length
  const urgentes = all.filter(o => bucketOf(o) === 'urgente').length
  const proximos = all.filter(o => bucketOf(o) === 'proximo').length
  const emdia = all.filter(o => bucketOf(o) === 'emdia').length

  return (
    <>
      <PageHead
        title="Calendário Regulamentar"
        lede="Acompanhamento das obrigações legais e regulamentares"
        actions={<>
          <select aria-label="Filtrar por edifício" style={selectStyle}><option>Todos os edifícios</option></select>
          <select aria-label="Filtrar por estado" style={selectStyle}><option>Todos os estados</option></select>
          <Button variant="gold" onClick={openNew}><Icon name="plus" />Adicionar</Button>
        </>}
      />
      <KPIGrid items={[
        { dot: 'rust', accent: 'rust', num: expirados, lbl: 'Expirados' },
        { dot: 'amber', accent: 'amber', num: urgentes, lbl: 'Urgentes (< 30d)' },
        { dot: 'gold', accent: 'amber', num: proximos, lbl: 'Próximos (< 90d)' },
        { dot: 'sage', accent: 'sage', num: emdia, lbl: 'Em dia' },
      ]} />
      {real && all.length === 0 ? (
        <Panel>
          <Empty illustration="eventos" title="Sem obrigações registadas"
            desc="Adicione as obrigações legais e regulamentares dos seus edifícios para as acompanhar."
            action={<Button variant="gold" onClick={openNew}><Icon name="plus" />Adicionar obrigação</Button>} />
        </Panel>
      ) : (
        <Panel flush>
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>Edifício</th><th>Tipo</th><th>Descrição</th><th>Prazo</th><th>Estado</th></tr></thead>
              <tbody>
                {all.map((o) => {
                  const b = bucketOf(o)
                  return (
                    <tr key={o.id}>
                      <td>{o.edificio || '—'}</td>
                      <td><Pill kind="gold" noDot>{o.tipo}</Pill></td>
                      <td>{o.descricao || '—'}</td>
                      <td>
                        <div className={m.numCell}>{o.prazo || '—'}</div>
                        <div style={{ fontSize: 11, color: b === 'expirado' ? 'var(--v54-rust-700)' : 'var(--v54-navy-300)' }}>{relLabel(o)}</div>
                      </td>
                      <td><span className={clsx(m.dotStatus, b === 'expirado' && m.dotStatusRust, (b === 'urgente' || b === 'proximo') && m.dotStatusAmber)} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="obr-modal-title" size="md">
        <ModalHead icon="calendar" id="obr-modal-title" title="Nova obrigação regulamentar" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label="Tipo" required name="obr-tipo" error={errors.tipo}>
                <input type="text" placeholder="Inspeção elevador, AG…" value={form.tipo} onChange={e => upd('tipo', e.target.value)} />
              </Field>
              <Field label="Edifício" name="obr-edif">
                <input type="text" placeholder="Edifício…" value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Descrição" full name="obr-desc">
              <input type="text" placeholder="Ex.: Inspeção 6 anos elevador" value={form.descricao} onChange={e => upd('descricao', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Prazo" name="obr-prazo">
                <input type="date" value={form.prazo} onChange={e => upd('prazo', e.target.value)} />
              </Field>
              <Field label="Concluído" name="obr-concl">
                <select value={form.concluido} onChange={e => upd('concluido', e.target.value)}>
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </Field>
            </FormRow>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>Adicionar</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
