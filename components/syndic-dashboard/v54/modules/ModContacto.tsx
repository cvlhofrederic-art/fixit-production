'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Campanha } from '@/lib/syndic/v54/api'
import { useSyndicCreate } from './use-syndic-create'

/** Contacto Proativo IA — port V5.7 + lot 3 fonctionnel.
 * Syndic connecté → vraies campanhas du cabinet (data.campanhas) + création POST (suivi —
 * l'envoi réel reste hors-scope) ; anonyme → Empty byte-exact. */

type CampForm = { nome: string; tipo: string; edificio: string; destinatarios: string; estado: Campanha['estado']; mensagem: string }

const estadoLabel = (v: string) => (({ rascunho: 'Rascunho', agendada: 'Agendada', enviada: 'Enviada' } as Record<string, string>)[v] || v)
const estadoKind = (v: string): PillKind => (({ rascunho: 'amber', agendada: 'gold', enviada: 'sage' } as Record<string, PillKind>)[v] || 'amber')

export default function ModContacto() {
  const data = useSyndicData()
  const real = data.authenticated
  const all: Campanha[] = real ? (data.campanhas ?? []) : []
  const { busy, create } = useSyndicCreate('/api/syndic/campanhas')

  const blank: CampForm = { nome: '', tipo: 'cobranca', edificio: '', destinatarios: '', estado: 'rascunho', mensagem: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CampForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof CampForm, string>>>({})

  const upd = (k: keyof CampForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.nome.trim()) { setErrors({ nome: 'Indique o nome da campanha.' }); return }
    create(
      { nome: form.nome, tipo: form.tipo, edificio: form.edificio, destinatarios: Number(form.destinatarios) || 0, estado: form.estado, mensagem: form.mensagem },
      { okTitle: 'Campanha criada', desc: form.nome, onDone: () => setOpen(false) },
    )
  }

  const enviadas = all.filter(c => c.estado === 'enviada').length
  const totalDest = all.reduce((s, c) => s + (Number(c.destinatarios) || 0), 0)
  const mensagensEnviadas = all.filter(c => c.estado === 'enviada').reduce((s, c) => s + (Number(c.destinatarios) || 0), 0)

  return (
    <>
      <PageHead
        title="Contacto Proativo IA"
        lede="Comunicação automática e personalizada com condóminos — cobranças, avisos, relatórios"
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />+ Nova Campanha</Button>}
      />
      <KPIGrid items={[
        { icon: 'sat', num: all.length, lbl: 'Campanhas Criadas' },
        { icon: 'mail', num: enviadas, lbl: 'Enviadas', accent: enviadas ? 'sage' : undefined },
        { icon: 'users', num: totalDest, lbl: 'Total Destinatários', accent: totalDest ? 'gold' : undefined },
        { icon: 'chat', num: mensagensEnviadas, lbl: 'Mensagens Enviadas', accent: mensagensEnviadas ? 'amber' : undefined },
      ]} />
      <Tabs defaultActive="camp" tabs={[
        { id: 'camp', icon: 'mail', label: 'Campanhas' },
        { id: 'mod', icon: 'pencil', label: 'Modelos IA' },
        { id: 'hist', icon: 'chart', label: 'Histórico' },
        { id: 'cfg', icon: 'cog', label: 'Configuração' },
      ]} />
      <Panel flush>
        {all.length === 0 ? (
          <Empty illustration="mensagens" title="Sem campanhas"
            desc="Crie a sua primeira campanha proativa para contactar condóminos automaticamente"
            action={real ? <Button variant="gold" onClick={openNew}><Icon name="plus" />+ Nova Campanha</Button> : undefined} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>Campanha</th><th>Tipo</th><th>Edifício</th><th>Destinatários</th><th>Estado</th></tr></thead>
              <tbody>{all.map(c => (
                <tr key={c.id}><td><b>{c.nome}</b></td><td>{c.tipo || '—'}</td><td>{c.edificio || '—'}</td><td className={m.numCell}>{c.destinatarios}</td><td><Pill kind={estadoKind(c.estado)} noDot>{estadoLabel(c.estado)}</Pill></td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="camp-modal-title" size="md">
        <ModalHead icon="mail" id="camp-modal-title" title="Nova campanha" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label="Nome da campanha" required full name="camp-nome" error={errors.nome}>
              <input type="text" placeholder="Ex.: Aviso obras fachada — junho" value={form.nome} onChange={e => upd('nome', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Tipo" name="camp-tipo">
                <select value={form.tipo} onChange={e => upd('tipo', e.target.value)}>
                  <option value="cobranca">Cobrança</option>
                  <option value="aviso">Aviso</option>
                  <option value="relatorio">Relatório</option>
                  <option value="personalizada">Personalizada</option>
                </select>
              </Field>
              <Field label="Edifício" name="camp-edif">
                <input type="text" placeholder="Edifício / todos…" value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Destinatários" hint="Número de condóminos" name="camp-dest">
                <input type="number" min="0" inputMode="numeric" placeholder="0" value={form.destinatarios} onChange={e => upd('destinatarios', e.target.value)} />
              </Field>
              <Field label="Estado" name="camp-estado">
                <select value={form.estado} onChange={e => upd('estado', e.target.value)}>
                  <option value="rascunho">Rascunho</option>
                  <option value="agendada">Agendada</option>
                  <option value="enviada">Enviada</option>
                </select>
              </Field>
            </FormRow>
            <Field label="Mensagem" full name="camp-msg">
              <textarea rows={3} placeholder="Conteúdo da comunicação…" value={form.mensagem} onChange={e => upd('mensagem', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>Criar campanha</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
