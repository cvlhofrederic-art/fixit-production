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

/**
 * Faturação & Recibos Verdes — port byte-exact V5.7 + Phase 3 : factures condomínio réelles
 * (table existante syndic_factures_copro) : liste + émission (montant TTC calculé serveur).
 */

const eur = (n: number) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(n)
const fmtEUR = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)
const statutLabel = (v: string) => (({ a_regler: 'A regularizar', partiellement_regle: 'Parcial', reglee: 'Liquidada', contestee: 'Contestada', annulee: 'Anulada' } as Record<string, string>)[v] || v)
const statutKind = (v: string): PillKind => (({ a_regler: 'amber', partiellement_regle: 'gold', reglee: 'sage', contestee: 'rust', annulee: 'rust' } as Record<string, PillKind>)[v] || 'amber')

export default function ModFaturacao() {
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.faturas ?? []) : []
  const coName = (id: string) => (data.coproprios ?? []).find((c) => c.id === id)?.proprietario || '—'

  const faturado = all.reduce((s, f) => s + f.montantTtc, 0)
  const aRegular = all.filter((f) => f.statut === 'a_regler' || f.statut === 'partiellement_regle').length
  const liquidadas = all.filter((f) => f.statut === 'reglee').length

  const { push } = useToast()
  const today = new Date().toISOString().slice(0, 10)
  const blank = { numeroFatura: '', coproprioId: '', immeubleId: '', emiseLe: today, echeance: '', montantHt: '', tvaTaux: '23', description: '', statut: 'a_regler' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm({ ...blank, emiseLe: today }); setErrors({}); setOpen(true) }
  const ttc = (Number(form.montantHt) || 0) * (1 + (Number(form.tvaTaux) || 0) / 100)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.montantHt || Number(form.montantHt) < 0) errs.montantHt = 'Indique o montante HT.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/factures-copro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ numeroFatura: form.numeroFatura, coproprioId: form.coproprioId, immeubleId: form.immeubleId, emiseLe: form.emiseLe, echeance: form.echeance, montantHt: Number(form.montantHt), tvaTaux: Number(form.tvaTaux) || 0, description: form.description, statut: form.statut }),
      })
        .then((r) => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: 'Fatura emitida', desc: fmtEUR(ttc) }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao emitir', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: 'Fatura emitida (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }

  return (
    <>
      <PageHead
        title="Faturação & Recibos Verdes"
        lede="Faturas, orçamentos e dossiês transferidos · Recibos verdes com retenção IRS automática"
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />+ Emitir fatura</Button>}
      />
      <KPIGrid items={[
        { icon: 'coin', num: real ? eur(faturado) : '0', cur: '€', lbl: 'Faturado total', sub: `${real ? all.length : 0} faturas`, accent: 'gold' },
        { icon: 'doc', num: real ? all.length : 0, lbl: 'Faturas emitidas' },
        { icon: 'clock', num: real ? aRegular : 0, lbl: 'A regularizar', accent: aRegular ? 'amber' : undefined },
        { icon: 'check', num: real ? liquidadas : 0, lbl: 'Liquidadas', accent: liquidadas ? 'sage' : undefined },
      ]} />
      <Tabs defaultActive="fat" tabs={[
        { id: 'fat', icon: 'doc', label: 'Faturas & Orçamentos' },
        { id: 'tr', icon: 'archive', label: 'Dossiês transferidos' },
        { id: 'rv', icon: 'doc', label: 'Recibos Verdes & IRS' },
      ]} />
      <Panel title="Faturas do condomínio" flush={all.length > 0}>
        {all.length === 0 ? (
          <Empty illustration="faturas" title="Nenhuma fatura emitida" desc="Emita a primeira fatura de condomínio — o montante TTC é calculado automaticamente"
            action={<Button variant="gold" onClick={openNew}><Icon name="plus" />+ Emitir fatura</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>Nº</th><th>Condómino</th><th>Emitida</th><th>Vencimento</th><th>Montante TTC</th><th>Estado</th></tr></thead>
              <tbody>{all.map((f) => (
                <tr key={f.id}>
                  <td>{f.numeroFatura || '—'}</td>
                  <td>{coName(f.coproprioId)}</td>
                  <td>{f.emiseLe || '—'}</td>
                  <td>{f.echeance || '—'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(f.montantTtc)}</td>
                  <td><Pill kind={statutKind(f.statut)}>{statutLabel(f.statut)}</Pill></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="fat-title" size="md">
        <ModalHead icon="doc" id="fat-title" title="Emitir fatura de condomínio" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label="Nº fatura" name="fat-num">
                <input type="text" placeholder="FT-2026-…" value={form.numeroFatura} onChange={(e) => upd('numeroFatura', e.target.value)} />
              </Field>
              <Field label="Condómino" name="fat-cond">
                <select value={form.coproprioId} onChange={(e) => upd('coproprioId', e.target.value)}>
                  <option value="">— escolher —</option>
                  {(data.coproprios ?? []).map((c) => <option key={c.id} value={c.id}>{c.proprietario || c.numeroPorte || c.id}</option>)}
                </select>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Data de emissão" name="fat-emit">
                <input type="date" value={form.emiseLe} onChange={(e) => upd('emiseLe', e.target.value)} />
              </Field>
              <Field label="Vencimento" name="fat-venc">
                <input type="date" value={form.echeance} onChange={(e) => upd('echeance', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Montante HT" required suffix="€" name="fat-ht" error={errors.montantHt}>
                <input type="number" step="0.01" min="0" placeholder="0" value={form.montantHt} onChange={(e) => upd('montantHt', e.target.value)} />
              </Field>
              <Field label="IVA" hint={`TTC: ${fmtEUR(ttc)}`} suffix="%" name="fat-tva">
                <input type="number" step="0.1" min="0" max="100" value={form.tvaTaux} onChange={(e) => upd('tvaTaux', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Descrição" full name="fat-desc">
              <textarea rows={3} value={form.description} onChange={(e) => upd('description', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>Emitir fatura</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
