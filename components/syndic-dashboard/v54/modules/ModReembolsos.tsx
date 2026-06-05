'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Alert } from '../primitives/alert'
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

/** Reembolsos Automáticos — port byte-exact V5.7 + Phase 3 : reembolsos réels. */

const STEPS: [string, string, string][] = [
  ['1', 'Declaração venda fração', 'Por antigo proprietário · email/portal · prazo legal 15 dias'],
  ['2', 'Max Expert calcula reembolso', 'Pro-rata sobre quotas + FCR já pagos · prazo < 1h'],
  ['3', 'Validação administrador', '1-clique aprovação ou ajuste manual'],
  ['4', 'Execução Open Banking', 'Ordem virement automática via API AISP'],
  ['5', 'Confirmação + arquivo', 'Email antigo proprietário · arquivo contabilístico'],
]
const codeStyle = { fontFamily: 'var(--v54-font-mono)', background: 'var(--v54-cream)', padding: '2px 6px', borderRadius: 3 } as const
const eur = (n: number) => `${(n || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
const STATUT_LABEL: Record<string, string> = { pendente: 'Pendente', liquidado: 'Liquidado', bloqueado: 'Bloqueado' }
const statutKind = (s: string): PillKind => (s === 'liquidado' ? 'sage' : s === 'bloqueado' ? 'rust' : 'amber')

export default function ModReembolsos() {
  // Phase 3 : vrais reembolsos du cabinet si syndic connecté, sinon mock/empty (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.reembolsos ?? []) : []

  const liquidadosN = all.filter((r) => r.statut === 'liquidado').length
  const totalLiquidado = all.filter((r) => r.statut === 'liquidado').reduce((s, r) => s + (r.montanteReembolso || 0), 0)
  const aProcessar = all.filter((r) => r.statut === 'pendente').length
  const bloqueados = all.filter((r) => r.statut === 'bloqueado').length

  // Phase 3 écritures : « Registar mudança proprietário » → POST /api/syndic/reembolsos.
  const { push } = useToast()
  const blank = { antigoProprietario: '', immeuble: '', fracao: '', dataVenda: '', quotasPagas: '', montanteReembolso: '', statut: 'pendente' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.antigoProprietario.trim()) errs.antigoProprietario = 'O antigo proprietário é obrigatório.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/reembolsos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ antigoProprietario: form.antigoProprietario, immeuble: form.immeuble, fracao: form.fracao, dataVenda: form.dataVenda, quotasPagas: Number(form.quotasPagas) || 0, montanteReembolso: Number(form.montanteReembolso) || 0, statut: form.statut }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: 'Reembolso registado', desc: form.antigoProprietario }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao registar', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: 'Reembolso registado (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }

  return (
    <>
      <PageHead eyebrow="OPERACIONAL · MUDANÇA DE PROPRIEDADE" title="Reembolsos Automáticos"
        lede="Pro-rata temporis na venda de fração · Max Expert calcula · Open Banking executa · Lei 8/2022 prazos"
        actions={<><Button onClick={openNew}><Icon name="users" />Registar mudança proprietário</Button><Button variant="gold"><Icon name="refresh" />Ver reembolsos pendentes</Button></>} />
      <Alert kind="gold" icon="scale" title="Direito a reembolso pro-rata na venda">
        Quando um condómino vende mid-year, as quotas pré-pagas devem ser reembolsadas proporcionalmente. <strong>Fórmula</strong>: <code style={codeStyle}>quotas_pagas × (dias_restantes / dias_periodo)</code>. Lei 8/2022 fixa prazo notificação venda em 15 dias.
      </Alert>
      <KPIGrid items={[
        { icon: 'refresh', num: real ? liquidadosN : 0, lbl: 'Reembolsos processados (ano)' },
        { icon: 'coin', num: real ? eur(totalLiquidado) : '0,00 €', lbl: 'Total reembolsado (ano)', accent: 'gold' },
        { icon: 'clock', num: real ? aProcessar : 0, lbl: 'A processar', accent: 'amber' },
        { icon: 'check', num: real ? eur(totalLiquidado) : '0,00 €', lbl: 'Liquidado via Open Banking', accent: 'sage' },
        { icon: 'alert', num: real ? bloqueados : 0, lbl: 'Bloqueados (rever)', accent: 'rust' },
        { icon: 'bot', num: 'Max Expert', lbl: 'Motor cálculo' },
      ]} />
      <Tabs defaultActive="pend" tabs={[
        { id: 'pend', icon: 'clock', label: `Pendentes (${real ? aProcessar : 0})` },
        { id: 'liq', icon: 'check', label: 'Liquidados' },
        { id: 'todos', label: 'Todos (12m)' },
      ]} />
      <Panel flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Antigo proprietário</th><th>Fração</th><th>Data venda</th><th>Quotas pagas</th><th>Dias restantes</th><th>Reembolso</th><th>Método</th><th>Estado</th></tr></thead>
            <tbody>
              {all.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--v54-navy-400)' }}>Nenhum reembolso em curso.</td></tr>
              ) : all.map((r) => (
                <tr key={r.id}>
                  <td>{r.antigoProprietario || '—'}</td>
                  <td>{r.fracao || '—'}</td>
                  <td>{r.dataVenda || '—'}</td>
                  <td className={m.mono}>{eur(r.quotasPagas)}</td>
                  <td>—</td>
                  <td className={m.mono}>{eur(r.montanteReembolso)}</td>
                  <td>{r.metodo || '—'}</td>
                  <td><Pill kind={statutKind(r.statut)} noDot>{STATUT_LABEL[r.statut] ?? r.statut}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Pipeline automático" sub="Lei 8/2022 — 15 dias">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STEPS.map(([n, t, s], i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 14px', background: 'var(--v54-cream)', borderRadius: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--v54-gold-500)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>{n}</div>
              <div><div style={{ fontWeight: 600, fontSize: 13 }}>{t}</div><div style={{ fontSize: 12, color: 'var(--v54-navy-400)' }}>{s}</div></div>
            </div>
          ))}
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="nr-title" size="md">
        <ModalHead icon="users" id="nr-title" title="Registar reembolso" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label="Antigo proprietário" required name="nr-prop" error={errors.antigoProprietario}>
                <input type="text" placeholder="Nome do vendedor" value={form.antigoProprietario} onChange={(e) => upd('antigoProprietario', e.target.value)} />
              </Field>
              <Field label="Fração" name="nr-frac">
                <input type="text" placeholder="Ex.: 4B" value={form.fracao} onChange={(e) => upd('fracao', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Edifício" name="nr-imovel">
                <input type="text" placeholder="Opcional" value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
              </Field>
              <Field label="Data da venda" name="nr-data">
                <input type="text" placeholder="AAAA-MM-DD" value={form.dataVenda} onChange={(e) => upd('dataVenda', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Quotas pagas (€)" name="nr-quotas">
                <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.quotasPagas} onChange={(e) => upd('quotasPagas', e.target.value)} />
              </Field>
              <Field label="Reembolso (€)" name="nr-mont">
                <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.montanteReembolso} onChange={(e) => upd('montanteReembolso', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Estado" full name="nr-statut">
              <select value={form.statut} onChange={(e) => upd('statut', e.target.value)}>
                <option value="pendente">Pendente</option>
                <option value="liquidado">Liquidado</option>
                <option value="bloqueado">Bloqueado</option>
              </select>
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>Registar</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
