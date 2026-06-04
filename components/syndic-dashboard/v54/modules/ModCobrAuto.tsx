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

/** Cobrança Automática · Juros & Sanções — port byte-exact V5.7 + Phase 3.
 * Suivi des impayés réels du cabinet (table syndic_impayes existante) : liste, relance (PATCH), ouverture (POST). */

const eur = (n: number) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(n)
const fmtEUR = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)
const NATURE: [string, string][] = [
  ['charges_courantes', 'Encargos correntes'], ['travaux', 'Obras'], ['fonds_reserve', 'Fundo de reserva'],
  ['interets_retard', 'Juros de mora'], ['frais_relance', 'Custos de cobrança'], ['autre', 'Outro'],
]
const natureLabel = (v: string) => NATURE.find((n) => n[0] === v)?.[1] || v
const statutLabel = (v: string) => (({ ouvert: 'Em aberto', en_recouvrement: 'Em recuperação', solde: 'Liquidado', passe_perte: 'Incobrável' } as Record<string, string>)[v] || v)
const statutKind = (v: string): PillKind => (({ ouvert: 'amber', en_recouvrement: 'rust', solde: 'sage', passe_perte: 'gold' } as Record<string, PillKind>)[v] || 'amber')

export default function ModCobrAuto() {
  // Phase 3 : vrais impayés du cabinet si syndic connecté, sinon preview vide.
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.impayes ?? []) : []
  const imName = (id: string) => data.immeubles.find((i) => i.id === id)?.nom || '—'
  const coName = (id: string) => (data.coproprios ?? []).find((c) => c.id === id)?.proprietario || '—'

  const aberto = all.filter((i) => i.statut === 'ouvert' || i.statut === 'en_recouvrement')
  const emDivida = aberto.reduce((s, i) => s + i.montant, 0)
  const recuperados = all.filter((i) => i.statut === 'solde').reduce((s, i) => s + i.montant, 0)

  const { push } = useToast()
  const today = new Date().toISOString().slice(0, 10)
  const blank = { immeubleId: '', coproprioId: '', montant: '', nature: 'charges_courantes', depuis: today, notas: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm({ ...blank, depuis: today }); setErrors({}); setOpen(true) }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.montant || Number(form.montant) <= 0) errs.montant = 'Indique o montante (> 0).'
    if (!form.depuis) errs.depuis = 'A data é obrigatória.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/impayes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ immeubleId: form.immeubleId, coproprioId: form.coproprioId, montant: Number(form.montant), nature: form.nature, depuis: form.depuis, notes: form.notas }),
      })
        .then((r) => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: 'Processo aberto', desc: `${fmtEUR(Number(form.montant))} · ${natureLabel(form.nature)}` }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao abrir', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: 'Processo aberto (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }

  const relancar = (id: string, nb: number) => {
    if (!(real && data.token)) { push({ kind: 'info', title: 'Relance (demo)', desc: 'Conecte-se como síndico' }); return }
    setBusy(true)
    fetch('/api/syndic/impayes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
      body: JSON.stringify({ id, nbRelances: nb + 1, derniereRelanceAt: new Date().toISOString() }),
    })
      .then((r) => { if (!r.ok) throw new Error() })
      .then(() => { data.refresh?.(); push({ kind: 'success', title: 'Relance enviada', desc: `${nb + 1}.ª relance registada` }) })
      .catch(() => push({ kind: 'error', title: 'Erro na relance', desc: 'Tente novamente mais tarde' }))
      .finally(() => setBusy(false))
  }

  return (
    <>
      <PageHead
        title="Cobrança Automática · Juros & Sanções"
        lede="Pipeline de escalada · Cobrança IA · Juros legais Banco de Portugal · Sanções regulamentares"
        actions={<Button variant="primary" onClick={openNew}><Icon name="plus" />+ Novo processo</Button>}
      />
      <KPIGrid items={[
        { num: real ? eur(emDivida) : '0', cur: '€', lbl: 'Em curso de cobrança', accent: 'rust' },
        { num: real ? aberto.length : 0, lbl: 'Processos ativos', accent: 'amber' },
        { num: real ? eur(recuperados) : '0', cur: '€', lbl: 'Recuperados', accent: 'sage' },
      ]} />
      <Tabs defaultActive="proc" tabs={[
        { id: 'proc', icon: 'refresh', label: 'Processos cobrança' },
        { id: 'js', icon: 'scale', label: 'Juros & Sanções' },
      ]} />
      <Panel flush={all.length > 0}>
        {all.length === 0 ? (
          <Empty illustration="pagamentos" title="Nenhum processo" desc="Adicione um processo de dívida para acompanhar a sua escalada automaticamente"
            action={<Button variant="primary" onClick={openNew}><Icon name="plus" />+ Novo processo</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>Condómino</th><th>Edifício</th><th>Natureza</th><th>Montante</th><th>Desde</th><th>Relances</th><th>Estado</th><th></th></tr></thead>
              <tbody>{all.map((it) => (
                <tr key={it.id}>
                  <td>{coName(it.coproprioId)}</td>
                  <td>{imName(it.immeubleId)}</td>
                  <td>{natureLabel(it.nature)}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(it.montant)}</td>
                  <td>{it.depuis || '—'}</td>
                  <td>{it.nbRelances}</td>
                  <td><Pill kind={statutKind(it.statut)}>{statutLabel(it.statut)}</Pill></td>
                  <td>{(it.statut === 'ouvert' || it.statut === 'en_recouvrement') && <Button size="sm" onClick={() => relancar(it.id, it.nbRelances)} disabled={busy}><Icon name="mail" />Relançar</Button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="cob-title" size="md">
        <ModalHead icon="coin" id="cob-title" title="Novo processo de cobrança" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label="Edifício" name="cob-edif">
                <select value={form.immeubleId} onChange={(e) => upd('immeubleId', e.target.value)}>
                  <option value="">— escolher —</option>
                  {data.immeubles.map((i) => <option key={i.id} value={i.id}>{i.nom}</option>)}
                </select>
              </Field>
              <Field label="Condómino" name="cob-cond">
                <select value={form.coproprioId} onChange={(e) => upd('coproprioId', e.target.value)}>
                  <option value="">— escolher —</option>
                  {(data.coproprios ?? []).map((c) => <option key={c.id} value={c.id}>{c.proprietario || c.numeroPorte || c.id}</option>)}
                </select>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Montante" required suffix="€" name="cob-mont" error={errors.montant}>
                <input type="number" step="0.01" min="0" placeholder="0" value={form.montant} onChange={(e) => upd('montant', e.target.value)} />
              </Field>
              <Field label="Natureza" name="cob-nat">
                <select value={form.nature} onChange={(e) => upd('nature', e.target.value)}>
                  {NATURE.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </FormRow>
            <Field label="Em dívida desde" required name="cob-dep" error={errors.depuis}>
              <input type="date" value={form.depuis} onChange={(e) => upd('depuis', e.target.value)} />
            </Field>
            <Field label="Notas" full name="cob-notas">
              <textarea rows={3} value={form.notas} onChange={(e) => upd('notas', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>Abrir processo</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
