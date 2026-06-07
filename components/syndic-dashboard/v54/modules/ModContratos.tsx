'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Alert } from '../primitives/alert'
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

/** Contratos com Prestadores — port byte-exact V5.7 + Phase 3 : contrats réels. */

type Cor = 'sage' | 'gold' | 'amber' | 'rust'
const LIFECYCLE: [string, string, Cor][] = [
  ['Upload PDF', 'Léa OCR · 30 segundos · ficha 90% pronta', 'sage'],
  ['Tracking ativo', 'Custo mensal · indexações · próxima revisão', 'gold'],
  ['Alerta J-90', 'Tempo notifica · revisão satisfação prestador', 'amber'],
  ['Workflow J-60', 'Auto-dispara 3 Orçamentos · concorrência', 'gold'],
  ['Decisão J-30', 'Renovar · trocar · negociar', 'amber'],
  ['Renovação/Substituição', 'Update auto · histórico preservado', 'sage'],
]

const eur = (n: number) => `${(n || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
const CAT_LABELS: Record<string, string> = { limpezas: 'Limpezas', elevadores: 'Elevadores', seguranca: 'Segurança', jardinagem: 'Jardinagem', outros: 'Outros' }
const TAB_TO_CAT: Record<string, string> = { limp: 'limpezas', elev: 'elevadores', seg: 'seguranca', jard: 'jardinagem', outros: 'outros' }
const statusKind = (s: string): 'sage' | 'amber' | 'rust' => (s === 'expirado' ? 'rust' : s === 'renovacao' ? 'amber' : 'sage')
const statusLabel = (s: string): string => (s === 'expirado' ? 'Expirado' : s === 'renovacao' ? 'Renovação' : 'Ativo')

export default function ModContratos() {
  // Phase 3 : vrais contrats du cabinet si syndic connecté, sinon mock/empty (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.contratos ?? []) : []
  const [tab, setTab] = useState('todos')
  const filtered = tab === 'todos' ? all : all.filter((c) => c.categoria === TAB_TO_CAT[tab])

  const ativos = all.filter((c) => c.statut === 'ativo').length
  const aRenovar = all.filter((c) => c.statut === 'renovacao').length
  const expirados = all.filter((c) => c.statut === 'expirado').length
  const custoMensal = all.reduce((s, c) => s + (c.custoMensal || 0), 0)
  const custoAnual = all.reduce((s, c) => s + (c.custoAnual || (c.custoMensal || 0) * 12), 0)

  // Phase 3 écritures : « + Novo contrato » → POST /api/syndic/contratos.
  const { push } = useToast()
  const blank = { fornecedor: '', categoria: 'limpezas', custoMensal: '', custoAnual: '', dataFim: '', immeuble: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.fornecedor.trim()) errs.fornecedor = 'O fornecedor é obrigatório.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ fornecedor: form.fornecedor, categoria: form.categoria, custoMensal: Number(form.custoMensal) || 0, custoAnual: Number(form.custoAnual) || 0, dataFim: form.dataFim, immeuble: form.immeuble }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: 'Contrato adicionado', desc: form.fornecedor }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao adicionar', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: 'Contrato adicionado (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }

  return (
    <>
      <PageHead eyebrow="GESTÃO OPERACIONAL · CENTRALIZADO" title="Contratos com Prestadores"
        lede="Limpezas · Elevadores · Segurança · Jardim · Dedetização · Alertas renovação J-90/60/30 · 3 Orçamentos auto"
        actions={<><Button onClick={() => push({ kind: 'info', title: 'Upload contrato PDF', desc: 'Análise via Léa em desenvolvimento' })}><Icon name="upload" />Upload contrato PDF (Léa)</Button><Button variant="gold" onClick={openNew}><Icon name="plus" />+ Novo contrato</Button></>} />
      <Alert kind="sage" icon="check" title="Tempo + Léa = renovações nunca esquecidas">
        Léa extrai datas/valores/partes dos PDFs em segundos. Tempo agenda alertas J-90 · J-60 · J-30 antes do término. A J-60 auto-dispara workflow <strong>3 Orçamentos</strong> para re-concorrência.
      </Alert>
      <KPIGrid items={[
        { icon: 'handshake', num: real ? ativos : 0, lbl: 'Contratos ativos', accent: 'gold' },
        { icon: 'clock', num: real ? aRenovar : 0, lbl: 'A renovar (≤ 90 dias)', accent: 'amber' },
        { icon: 'coin', num: real ? eur(custoMensal) : '0,00 €', lbl: 'Custo mensal total' },
        { icon: 'coin', num: real ? eur(custoAnual) : '0,00 €', lbl: 'Custo anual total' },
        { icon: 'refresh', num: 0, lbl: '3 Orçamentos em curso', accent: 'gold' },
        { icon: 'ban', num: real ? expirados : 0, lbl: 'Expirados (atenção)', accent: 'rust' },
      ]} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'todos', label: 'Todos' },
        { id: 'limp', label: 'Limpezas' },
        { id: 'elev', label: 'Elevadores' },
        { id: 'seg', label: 'Segurança' },
        { id: 'jard', label: 'Jardinagem' },
        { id: 'outros', label: 'Outros' },
      ]} />
      <Panel>
        {filtered.length === 0 ? (
          <Empty illustration="profissionais" title="Nenhum contrato centralizado"
            desc="Léa lê PDFs de contratos (limpezas, elevadores, segurança, jardim) em segundos e pré-preenche 90% da ficha. Renovações nunca esquecidas."
            action={<Button variant="primary" onClick={openNew}><Icon name="plus" />Adicionar primeiro contrato</Button>} />
        ) : (
          <div>
            {filtered.map((c) => (
              <div key={c.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--v54-line)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 18, fontWeight: 500 }}>{c.fornecedor}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--v54-navy-300)', marginTop: 2 }}>{CAT_LABELS[c.categoria] ?? c.categoria}{c.immeuble ? ` · ${c.immeuble}` : ''}</div>
                </div>
                <Pill kind={statusKind(c.statut)} noDot>{statusLabel(c.statut)}</Pill>
                <div style={{ textAlign: 'right', minWidth: 120 }}>
                  <div className={m.mono} style={{ fontWeight: 600 }}>{eur(c.custoMensal)}/mês</div>
                  {c.dataFim && <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>Fim: {c.dataFim}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Lifecycle de um contrato" sub="Léa + Tempo + 3 Orçamentos = ciclo fechado">
        <div className={m.cardGrid3}>
          {LIFECYCLE.map(([t, s, c], i) => (
            <div key={i} style={{ padding: 14, border: '1px solid var(--v54-line)', borderRadius: 10, background: `var(--v54-${c}-50)`, borderLeft: `3px solid var(--v54-${c}-500)` }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{t}</div>
              <div style={{ fontSize: 11.5, color: 'var(--v54-navy-400)' }}>{s}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="nc-title" size="md">
        <ModalHead icon="handshake" id="nc-title" title="Novo contrato" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label="Fornecedor" required full name="nc-forn" error={errors.fornecedor}>
              <input type="text" placeholder="Ex.: Limpezas Norte, Lda." value={form.fornecedor} onChange={(e) => upd('fornecedor', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Categoria" name="nc-cat">
                <select value={form.categoria} onChange={(e) => upd('categoria', e.target.value)}>
                  <option value="limpezas">Limpezas</option>
                  <option value="elevadores">Elevadores</option>
                  <option value="seguranca">Segurança</option>
                  <option value="jardinagem">Jardinagem</option>
                  <option value="outros">Outros</option>
                </select>
              </Field>
              <Field label="Edifício" name="nc-imovel">
                <input type="text" placeholder="Opcional" value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Custo mensal (€)" name="nc-mensal">
                <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.custoMensal} onChange={(e) => upd('custoMensal', e.target.value)} />
              </Field>
              <Field label="Custo anual (€)" name="nc-anual">
                <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.custoAnual} onChange={(e) => upd('custoAnual', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Data de fim (renovação)" full name="nc-fim">
              <input type="text" placeholder="AAAA-MM-DD" value={form.dataFim} onChange={(e) => upd('dataFim', e.target.value)} />
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
