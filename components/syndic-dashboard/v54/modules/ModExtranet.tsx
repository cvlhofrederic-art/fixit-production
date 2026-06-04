'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Pill } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'

/** Extranet Condóminos — port byte-exact du ModExtranet du bundle V5.7 (stateful : Modal + copy URL). */

type ExtForm = { nome: string; email: string; telefone: string; fracao: string; edificio: string; notas: string }
type Cond = ExtForm & { id: number; acessoAtivo: boolean; saldo: number }

const fmtEUR = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)

export default function ModExtranet() {
  const blank: ExtForm = { nome: '', email: '', telefone: '', fracao: '', edificio: '', notas: '' }
  const [items, setItems] = useState<Cond[]>([])
  const [pedidos] = useState<{ id: number }[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ExtForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof ExtForm, string>>>({})
  const [busy, setBusy] = useState(false)
  const { push } = useToast()
  // Phase 2 : vrais condóminos du cabinet si syndic connecté, sinon état local (mock/preview).
  const data = useSyndicData()
  const real = data.authenticated
  const displayItems: Cond[] = real
    ? (data.coproprios ?? []).map((c, i) => ({ id: i, nome: c.proprietario || '—', email: c.email, telefone: c.telefone, fracao: [c.batiment, c.numeroPorte].filter(Boolean).join(' '), edificio: c.immeuble, notas: '', acessoAtivo: c.acessoPortal ?? false, saldo: c.solde ?? 0 }))
    : items

  const upd = (k: keyof ExtForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof ExtForm, string>> = {}
    if (!form.nome.trim()) errs.nome = 'O nome é obrigatório.'
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) errs.email = 'Email inválido.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      // Écriture réelle : POST /api/syndic/coproprios (mapping vérifié sur le contrat), puis refresh.
      // setBusy + disabled empêchent la double-soumission (sinon doublons de condómino).
      setBusy(true)
      fetch('/api/syndic/coproprios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ coproprio: { nomProprietaire: form.nome, emailProprietaire: form.email, telephoneProprietaire: form.telefone, numeroPorte: form.fracao, immeuble: form.edificio, notes: form.notas, accesPortail: true } }),
      })
        .then((res) => { if (!res.ok) throw new Error('POST failed') })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: 'Condómino adicionado', desc: form.nome }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao adicionar', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusy(false))
      return
    }
    setItems(prev => [...prev, { ...form, id: Date.now(), acessoAtivo: true, saldo: 0 }])
    setOpen(false)
    push({ kind: 'success', title: 'Condómino adicionado', desc: form.nome })
  }

  const acessosAtivos = displayItems.filter(i => i.acessoAtivo).length
  const saldoGlobal = displayItems.reduce((s, i) => s + (i.saldo || 0), 0)
  const emAtraso = displayItems.filter(i => (i.saldo || 0) < 0).length
  const copyPortalUrl = () => {
    if (navigator.clipboard) navigator.clipboard.writeText('https://vitfix.io/copropriétaire/portail')
    push({ kind: 'info', title: 'Link copiado', desc: 'URL do portal copiado para o clipboard' })
  }

  return (
    <>
      <PageHead title="Extranet Condóminos" lede="Registo · Acesso ao portal · Pedidos de intervenção"
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />+ Condómino</Button>} />
      <Tabs defaultActive="cd" tabs={[
        { id: 'cd', icon: 'users', label: `Condóminos (${displayItems.length})` },
        { id: 'pi', icon: 'bell', label: `Pedidos de intervenção (${pedidos.length})` },
      ]} />
      <KPIGrid items={[
        { icon: 'users', num: displayItems.length, lbl: 'Condóminos', accent: displayItems.length ? 'sage' : undefined },
        { icon: 'check', num: acessosAtivos, lbl: 'Acessos ativos', accent: acessosAtivos ? 'sage' : undefined },
        { icon: 'coin', num: fmtEUR(saldoGlobal), lbl: 'Saldo global' },
        { icon: 'alert', num: emAtraso, lbl: 'Em atraso', accent: emAtraso ? 'rust' : undefined },
      ]} />
      <Panel>
        {displayItems.length === 0 ? (
          <Empty icon="users" title="Registo vazio" desc="Adicione os seus condóminos para lhes dar acesso ao portal"
            action={<Button variant="primary" onClick={openNew}><Icon name="plus" />+ Primeiro condómino</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>Nome</th><th>Email</th><th>Telefone</th><th>Fração</th><th>Saldo</th><th>Acesso</th></tr></thead>
              <tbody>{displayItems.map(it => (
                <tr key={it.id}>
                  <td>{it.nome}</td>
                  <td>{it.email || '—'}</td>
                  <td>{it.telefone || '—'}</td>
                  <td>{it.fracao || '—'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(it.saldo || 0)}</td>
                  <td><Pill kind={it.acessoAtivo ? 'sage' : 'rust'}>{it.acessoAtivo ? 'Ativo' : 'Inativo'}</Pill></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="Portal Condóminos" icon="map">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <p style={{ flex: 1, fontSize: 13, color: 'var(--v54-navy-500)', margin: 0 }}>Cada condómino pode aceder à sua área pessoal para consultar as suas quotas, atas de AG e documentos.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input type="text" readOnly aria-label="URL do portal" value="https://vitfix.io/coproprietaire/portail" style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontFamily: 'ui-monospace,monospace', fontSize: 12 }} />
          <Button onClick={copyPortalUrl}><Icon name="doc" />Copiar</Button>
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="ex-modal-title" size="md">
        <ModalHead icon="users" id="ex-modal-title" title="Adicionar condómino" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label="Nome" required full name="ex-nome" error={errors.nome}>
              <input type="text" placeholder="Nome completo" value={form.nome} onChange={e => upd('nome', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Email" name="ex-mail" error={errors.email}>
                <input type="email" placeholder="condomino@exemplo.pt" value={form.email} onChange={e => upd('email', e.target.value)} />
              </Field>
              <Field label="Telefone" name="ex-tel">
                <input type="tel" placeholder="+351 …" value={form.telefone} onChange={e => upd('telefone', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Fração" name="ex-frac">
                <input type="text" placeholder="Apt 12" value={form.fracao} onChange={e => upd('fracao', e.target.value)} />
              </Field>
              <Field label="Edifício" name="ex-edif">
                <input type="text" placeholder="Residência…" value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Notas" full name="ex-notas">
              <textarea rows={3} value={form.notas} onChange={e => upd('notas', e.target.value)} />
            </Field>
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
