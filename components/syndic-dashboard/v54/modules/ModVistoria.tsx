'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'

/** Vistoria Técnica — port byte-exact V5.7 + Phase 3 : vistorias réelles. */

const STATUT_LABEL: Record<string, string> = { em_curso: 'Em curso', concluida: 'Concluída', enviada: 'Enviada' }
const statutKind = (s: string): PillKind => (s === 'concluida' ? 'sage' : s === 'enviada' ? 'gold' : 'amber')

export default function ModVistoria() {
  // Phase 3 : vraies vistorias du cabinet si syndic connecté, sinon mock/empty (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.vistorias ?? []) : []

  const realizadas = all.filter((v) => v.statut === 'concluida').length
  const vigiar = all.reduce((acc, v) => acc + (v.pontosVigiar || 0), 0)
  const deficientes = all.reduce((acc, v) => acc + (v.pontosDeficientes || 0), 0)

  // Phase 3 écritures : « + Nova vistoria » → POST /api/syndic/vistorias.
  const { push } = useToast()
  const blank = { titulo: '', immeuble: '', statut: 'em_curso', pontosVigiar: '', pontosDeficientes: '', dataVistoria: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.titulo.trim()) errs.titulo = 'O título é obrigatório.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/vistorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ titulo: form.titulo, immeuble: form.immeuble, statut: form.statut, pontosVigiar: Number(form.pontosVigiar) || 0, pontosDeficientes: Number(form.pontosDeficientes) || 0, dataVistoria: form.dataVistoria }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: 'Vistoria criada', desc: form.titulo }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao criar', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: 'Vistoria criada (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }

  return (
    <>
      <PageHead
        title="Vistoria Técnica"
        lede="Checklist de terreno → Relatório PDF · DL 555/99 · DL 97/2017 · DL 320/2002"
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />+ Nova vistoria</Button>}
      />
      <KPIGrid items={[
        { icon: 'check', num: real ? realizadas : 0, lbl: 'Vistorias realizadas', accent: 'sage' },
        { icon: 'alert', num: real ? vigiar : 0, lbl: 'Pontos a vigiar', accent: 'amber' },
        { icon: 'alert', num: real ? deficientes : 0, lbl: 'Pontos deficientes', accent: 'rust' },
      ]} />
      <Tabs defaultActive="todas" tabs={[
        { id: 'todas', label: 'Todas' },
        { id: 'conc', label: 'Concluídas' },
        { id: 'curso', label: 'Em curso' },
        { id: 'env', label: 'Enviadas' },
      ]} />
      {all.length === 0 ? (
        <Panel>
          <Empty
            illustration="documentos"
            title="Nenhuma vistoria registada"
            desc="Comece a sua primeira vistoria técnica."
            action={<Button variant="primary" onClick={openNew}><Icon name="plus" />+ Nova vistoria</Button>}
          />
        </Panel>
      ) : (
        <Panel flush>
          {all.map((v) => (
            <div key={v.id} style={{ padding: '16px 22px', borderBottom: '1px solid var(--v54-line)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 17, fontWeight: 500 }}>{v.titulo || 'Vistoria'}</div>
                <div style={{ fontSize: 12.5, color: 'var(--v54-navy-300)', marginTop: 2 }}>{[v.immeuble, v.dataVistoria].filter(Boolean).join(' · ')}</div>
              </div>
              {v.pontosVigiar > 0 && <Pill kind="amber" noDot>{v.pontosVigiar} a vigiar</Pill>}
              {v.pontosDeficientes > 0 && <Pill kind="rust" noDot>{v.pontosDeficientes} deficientes</Pill>}
              <Pill kind={statutKind(v.statut)} noDot>{STATUT_LABEL[v.statut] ?? v.statut}</Pill>
            </div>
          ))}
        </Panel>
      )}

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="nv-title" size="md">
        <ModalHead icon="clipboard" id="nv-title" title="Nova vistoria" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label="Título" required full name="nv-tit" error={errors.titulo}>
              <input type="text" placeholder="Ex.: Vistoria anual partes comuns" value={form.titulo} onChange={(e) => upd('titulo', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Edifício" name="nv-imovel">
                <input type="text" placeholder="Opcional" value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
              </Field>
              <Field label="Estado" name="nv-statut">
                <select value={form.statut} onChange={(e) => upd('statut', e.target.value)}>
                  <option value="em_curso">Em curso</option>
                  <option value="concluida">Concluída</option>
                  <option value="enviada">Enviada</option>
                </select>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Pontos a vigiar" name="nv-vig">
                <input type="number" min="0" inputMode="numeric" placeholder="0" value={form.pontosVigiar} onChange={(e) => upd('pontosVigiar', e.target.value)} />
              </Field>
              <Field label="Pontos deficientes" name="nv-def">
                <input type="number" min="0" inputMode="numeric" placeholder="0" value={form.pontosDeficientes} onChange={(e) => upd('pontosDeficientes', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Data da vistoria" full name="nv-data">
              <input type="text" placeholder="AAAA-MM-DD" value={form.dataVistoria} onChange={(e) => upd('dataVistoria', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>Criar</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
