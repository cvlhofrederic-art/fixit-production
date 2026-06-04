'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import btnCss from '../primitives/button/Button.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'

/** Prazos Legais — port byte-exact V5.7 + Phase 3 : obligations réelles (CRUD). */

type Prazo = { id: string | null; icon: IconName; titulo: string; edificio: string; data: string; prazo: string; kind: PillKind; realizado: boolean }
const ITEMS: Prazo[] = [
  { id: null, icon: 'flame', titulo: 'Limpeza de chaminés', edificio: 'Edifício Atlântico', data: '21 de novembro de 2026', prazo: 'Dentro de 181d', kind: 'sage', realizado: false },
  { id: null, icon: 'flame', titulo: 'Limpeza de chaminés', edificio: 'Condomínio Boavista Center', data: '21 de novembro de 2026', prazo: 'Dentro de 181d', kind: 'sage', realizado: false },
  { id: null, icon: 'flame', titulo: 'Limpeza de chaminés', edificio: 'Residencial Cedofeita', data: '21 de novembro de 2026', prazo: 'Dentro de 181d', kind: 'sage', realizado: false },
  { id: null, icon: 'flame', titulo: 'Limpeza de chaminés', edificio: 'Edifício Foz Douro', data: '21 de novembro de 2026', prazo: 'Dentro de 181d', kind: 'sage', realizado: false },
  { id: null, icon: 'bank', titulo: 'AG anual', edificio: 'Edifício Atlântico', data: '21 de maio de 2027', prazo: 'Dentro de 362d', kind: 'sage', realizado: false },
  { id: null, icon: 'chart', titulo: 'Orçamento previsional', edificio: 'Edifício Atlântico', data: '21 de maio de 2027', prazo: 'Dentro de 362d', kind: 'sage', realizado: false },
  { id: null, icon: 'flame', titulo: 'Verificação de extintores', edificio: 'Edifício Atlântico', data: '21 de maio de 2027', prazo: 'Dentro de 362d', kind: 'sage', realizado: false },
  { id: null, icon: 'alert', titulo: 'Plano de gestão de amianto', edificio: 'Edifício Atlântico', data: '21 de maio de 2029', prazo: 'Dentro de 1093d', kind: 'amber', realizado: false },
  { id: null, icon: 'alert', titulo: 'Plano de gestão de amianto', edificio: 'Condomínio Boavista Center', data: '21 de maio de 2029', prazo: 'Dentro de 1093d', kind: 'amber', realizado: false },
  { id: null, icon: 'alert', titulo: 'Plano de gestão de amianto', edificio: 'Residencial Cedofeita', data: '21 de maio de 2029', prazo: 'Dentro de 1093d', kind: 'amber', realizado: false },
  { id: null, icon: 'alert', titulo: 'Plano de gestão de amianto', edificio: 'Edifício Foz Douro', data: '21 de maio de 2029', prazo: 'Dentro de 1093d', kind: 'amber', realizado: false },
  { id: null, icon: 'elevator', titulo: 'Inspeção elevador', edificio: 'Edifício Atlântico', data: '21 de maio de 2031', prazo: 'Dentro de 1823d', kind: 'gold', realizado: false },
]
const checkBtn = { background: 'var(--v54-sage-50)', color: 'var(--v54-sage-700)', borderColor: 'transparent' } as const

const daysTo = (d: string): number | null => {
  if (!d) return null
  const ms = new Date(`${d}T00:00:00`).getTime() - Date.now()
  return Number.isNaN(ms) ? null : Math.ceil(ms / 86_400_000)
}
const prazoLabel = (d: string): string => {
  const n = daysTo(d)
  if (n == null) return '—'
  if (n < 0) return `Em atraso ${-n}d`
  return `Dentro de ${n}d`
}
const prazoKind = (d: string): PillKind => {
  const n = daysTo(d)
  if (n == null) return 'sage'
  if (n < 0) return 'rust'
  if (n < 30) return 'amber'
  return 'sage'
}

export default function ModPrazosLegais() {
  // Phase 3 : vraies obligations du cabinet si syndic connecté, sinon mock (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const rows: Prazo[] = real
    ? (data.prazos ?? []).map((p) => ({
        id: p.id, icon: 'clipboard' as IconName, titulo: p.titulo, edificio: p.immeuble,
        data: p.dataLimite, prazo: p.statut === 'realizado' ? 'Realizado' : prazoLabel(p.dataLimite),
        kind: p.statut === 'realizado' ? 'sage' : prazoKind(p.dataLimite), realizado: p.statut === 'realizado',
      }))
    : ITEMS

  const total = real ? rows.length : 40
  const emAtraso = real ? rows.filter((r) => !r.realizado && (daysTo(r.data) ?? 0) < 0).length : 0
  const urgente = real ? rows.filter((r) => { const n = daysTo(r.data); return !r.realizado && n != null && n >= 0 && n < 30 }).length : 0
  const realizados = real ? rows.filter((r) => r.realizado).length : 0

  // Phase 3 écritures : créer · marquer réalisé (PATCH) · supprimer (DELETE).
  const { push } = useToast()
  const blank = { titulo: '', immeuble: '', tipo: '', dataLimite: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.titulo.trim()) errs.titulo = 'O título é obrigatório.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/prazos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ titulo: form.titulo, immeuble: form.immeuble, tipo: form.tipo, dataLimite: form.dataLimite }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: 'Obrigação adicionada', desc: form.titulo }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao adicionar', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: 'Obrigação adicionada (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }
  const mark = (id: string | null) => {
    if (real && data.token && id) {
      setBusyId(id)
      fetch('/api/syndic/prazos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ id, statut: 'realizado' }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); push({ kind: 'success', title: 'Marcado como realizado' }) })
        .catch(() => push({ kind: 'error', title: 'Erro', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusyId(null))
      return
    }
    push({ kind: 'info', title: 'Marcado (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }
  const remove = (id: string | null) => {
    if (real && data.token && id) {
      setBusyId(id)
      fetch(`/api/syndic/prazos?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${data.token}` } })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); push({ kind: 'success', title: 'Obrigação eliminada' }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao eliminar', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusyId(null))
      return
    }
    push({ kind: 'info', title: 'Eliminado (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }

  return (
    <>
      <PageHead title="Prazos Legais" lede="Acompanhamento das obrigações regulamentares multi-edifícios"
        actions={<><Pill kind="gold" noDot>Auto-iniciar</Pill><Button variant="gold" onClick={openNew}><Icon name="plus" />+ Adicionar</Button></>} />
      <KPIGrid items={[
        { icon: 'chart', num: total, lbl: 'Total' },
        { icon: 'alert', num: emAtraso, lbl: 'Em atraso', accent: 'rust' },
        { icon: 'clock', num: urgente, lbl: 'Urgente < 30d', accent: 'amber' },
        { icon: 'check', num: realizados, lbl: 'Realizados', accent: 'sage' },
      ]} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <select className={btnCss.btn} aria-label="Filtrar por edifício"><option>Todos os edifícios</option></select>
        <select className={btnCss.btn} aria-label="Filtrar por estado"><option>Todos os estados</option></select>
      </div>
      <Panel flush>
        {rows.length === 0 ? (
          <div style={{ padding: '22px', fontSize: 12.5, color: 'var(--v54-navy-300)' }}>Nenhuma obrigação registada.</div>
        ) : rows.map((r, i) => (
          <div key={r.id ?? i} style={{ padding: '14px 22px', borderBottom: i < rows.length - 1 ? '1px solid var(--v54-line)' : 'none', display: 'flex', alignItems: 'center', gap: 14, opacity: r.realizado ? 0.6 : 1 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)' }}><Icon name={r.icon} /></div>
            <div style={{ flex: 1 }}><b>{r.titulo}</b> {r.edificio && <Pill kind={r.kind} noDot>{r.edificio}</Pill>}<div style={{ fontSize: 11, color: 'var(--v54-navy-300)', marginTop: 2 }}>{r.data}</div></div>
            <Pill kind={r.kind} noDot>{r.prazo}</Pill>
            <Button size="sm" style={checkBtn} disabled={busyId === r.id} onClick={() => mark(r.id)} aria-label="Marcar como realizado" title="Marcar como realizado"><Icon name="check" /></Button>
            <Button size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => remove(r.id)} aria-label="Eliminar prazo legal" title="Eliminar"><Icon name="trash" /></Button>
          </div>
        ))}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="np-title" size="md">
        <ModalHead icon="clipboard" id="np-title" title="Adicionar obrigação" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label="Título" required full name="np-tit" error={errors.titulo}>
              <input type="text" placeholder="Ex.: Inspeção elevador" value={form.titulo} onChange={(e) => upd('titulo', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Edifício" name="np-imovel">
                <input type="text" placeholder="Opcional" value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
              </Field>
              <Field label="Data limite" name="np-data">
                <input type="text" placeholder="AAAA-MM-DD" value={form.dataLimite} onChange={(e) => upd('dataLimite', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Tipo" full name="np-tipo">
              <input type="text" placeholder="Ex.: Segurança, AG, Manutenção…" value={form.tipo} onChange={(e) => upd('tipo', e.target.value)} />
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
