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

/** Gestão de Seguros — port byte-exact V5.7 + Phase 3 : apólices réelles. */

const selectStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 14 } as const

const eur = (n: number) => `${(n || 0).toLocaleString('pt-PT')} €`
const TIPO_LABELS: Record<string, string> = { multirriscos: 'Multirriscos', responsabilidade_civil: 'Responsabilidade Civil', incendio: 'Incêndio', outros: 'Outros' }
const statusKind = (s: string): 'sage' | 'amber' | 'rust' => (s === 'expirada' ? 'rust' : s === 'renovacao' ? 'amber' : 'sage')
const statusLabel = (s: string): string => (s === 'expirada' ? 'Expirada' : s === 'renovacao' ? 'Renovação' : 'Ativa')

export default function ModSeguros() {
  // Phase 3 : vraies apólices du cabinet si syndic connecté, sinon mock/empty (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.seguros ?? []) : []

  const ativas = all.filter((s) => s.statut === 'ativa').length
  const expiradas = all.filter((s) => s.statut === 'expirada').length
  const aExpirar = all.filter((s) => s.statut === 'renovacao').length
  const premios = all.reduce((acc, s) => acc + (s.premioAnual || 0), 0)
  const capital = all.reduce((acc, s) => acc + (s.capital || 0), 0)

  // Phase 3 écritures : « + Nova Apólice » → POST /api/syndic/seguros.
  const { push } = useToast()
  const blank = { seguradora: '', tipo: 'multirriscos', apolice: '', premioAnual: '', capital: '', immeuble: '', dataFim: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.seguradora.trim()) errs.seguradora = 'A seguradora é obrigatória.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/seguros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ seguradora: form.seguradora, tipo: form.tipo, apolice: form.apolice, premioAnual: Number(form.premioAnual) || 0, capital: Number(form.capital) || 0, immeuble: form.immeuble, dataFim: form.dataFim }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: 'Apólice adicionada', desc: form.seguradora }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao adicionar', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: 'Apólice adicionada (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }

  return (
    <>
      <PageHead
        title="Gestão de Seguros"
        lede="Apólices, coberturas, sinistros e alertas por edifício"
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />+ Nova Apólice</Button>}
      />
      <KPIGrid items={[
        { icon: 'shield', num: real ? ativas : 0, lbl: 'Apólices Ativas', accent: 'gold' },
        { icon: 'check', num: real ? expiradas : 0, lbl: 'Expiradas', accent: 'sage' },
        { icon: 'clock', num: real ? aExpirar : 0, lbl: 'A Expirar (60d)', accent: 'amber' },
        { icon: 'coin', num: real ? eur(premios) : '0 €', lbl: 'Total Prémios/Ano' },
        { icon: 'bank', num: real ? eur(capital) : '0 €', lbl: 'Capital Total' },
      ]} />
      <Tabs defaultActive="vg" tabs={[
        { id: 'vg', icon: 'chart', label: 'Visão Geral' },
        { id: 'ap', icon: 'shield', label: 'Apólices' },
        { id: 'sn', icon: 'alert', label: 'Sinistros' },
        { id: 'al', icon: 'bell', label: 'Alertas' },
      ]} />
      <select aria-label="Filtrar por edifício" style={selectStyle}><option>Todos os edifícios</option></select>
      <Panel>
        {all.length === 0 ? (
          <Empty illustration="condominos" title="Nenhum edifício registado" />
        ) : (
          <div>
            {all.map((s) => (
              <div key={s.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--v54-line)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 18, fontWeight: 500 }}>{s.seguradora}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--v54-navy-300)', marginTop: 2 }}>{TIPO_LABELS[s.tipo] ?? s.tipo}{s.apolice ? ` · ${s.apolice}` : ''}{s.immeuble ? ` · ${s.immeuble}` : ''}</div>
                </div>
                <Pill kind={statusKind(s.statut)} noDot>{statusLabel(s.statut)}</Pill>
                <div style={{ textAlign: 'right', minWidth: 130 }}>
                  <div className={m.mono} style={{ fontWeight: 600 }}>{eur(s.premioAnual)}/ano</div>
                  {s.capital > 0 && <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>Capital: {eur(s.capital)}</div>}
                  {s.dataFim && <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>Fim: {s.dataFim}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="ns-title" size="md">
        <ModalHead icon="shield" id="ns-title" title="Nova apólice" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label="Seguradora" required full name="ns-seg" error={errors.seguradora}>
              <input type="text" placeholder="Ex.: Fidelidade, Tranquilidade…" value={form.seguradora} onChange={(e) => upd('seguradora', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Tipo" name="ns-tipo">
                <select value={form.tipo} onChange={(e) => upd('tipo', e.target.value)}>
                  <option value="multirriscos">Multirriscos</option>
                  <option value="responsabilidade_civil">Responsabilidade Civil</option>
                  <option value="incendio">Incêndio</option>
                  <option value="outros">Outros</option>
                </select>
              </Field>
              <Field label="N.º apólice" name="ns-apol">
                <input type="text" placeholder="Opcional" value={form.apolice} onChange={(e) => upd('apolice', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Prémio anual (€)" name="ns-premio">
                <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.premioAnual} onChange={(e) => upd('premioAnual', e.target.value)} />
              </Field>
              <Field label="Capital seguro (€)" name="ns-cap">
                <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.capital} onChange={(e) => upd('capital', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Edifício" name="ns-imovel">
                <input type="text" placeholder="Opcional" value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
              </Field>
              <Field label="Data de fim" name="ns-fim">
                <input type="text" placeholder="AAAA-MM-DD" value={form.dataFim} onChange={(e) => upd('dataFim', e.target.value)} />
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
