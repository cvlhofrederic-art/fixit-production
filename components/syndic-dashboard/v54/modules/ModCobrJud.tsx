'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { Alert } from '../primitives/alert'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
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

/** Cobrança Judicial — port byte-exact V5.7 + Phase 3 : pipeline réel (table syndic_recouvrement).
 * Kanban re-mappé sur les étapes légales réelles (enum procedure) + données réelles + ouverture/avancement. */

const fmtEUR = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)
const STAGES: { key: string; label: string; color: PillKind }[] = [
  { key: 'amiable', label: 'Contacto amigável', color: 'amber' },
  { key: 'mise_en_demeure', label: 'Notificação (LRAR)', color: 'amber' },
  { key: 'huissier', label: 'Solicitador / Agente', color: 'gold' },
  { key: 'tribunal', label: 'Injunção / Tribunal', color: 'rust' },
  { key: 'saisie', label: 'Penhora', color: 'rust' },
  { key: 'accord_paiement', label: 'Acordo de pagamento', color: 'sage' },
]
const ADVANCE = ['amiable', 'mise_en_demeure', 'huissier', 'tribunal', 'saisie']
const statutLabel = (v: string) => (({ en_cours: 'Em curso', suspendu: 'Suspenso', cloture_succes: 'Encerrado (sucesso)', cloture_echec: 'Encerrado (insucesso)' } as Record<string, string>)[v] || v)

export default function ModCobrJud() {
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.recouvrements ?? []) : []
  const imName = (id: string) => data.immeubles.find((i) => i.id === id)?.nom || '—'
  const coName = (id: string) => (data.coproprios ?? []).find((c) => c.id === id)?.proprietario || 'Condómino'

  const ativos = all.filter((r) => r.statut === 'en_cours' || r.statut === 'suspendu')
  const emDivida = ativos.reduce((s, r) => s + Math.max(0, r.montantInitial - r.montantRecouvre), 0)
  const recuperado = all.reduce((s, r) => s + r.montantRecouvre, 0)
  const emTribunal = all.filter((r) => r.procedure === 'tribunal' || r.procedure === 'saisie').length

  const { push } = useToast()
  const today = new Date().toISOString().slice(0, 10)
  const blank = { immeubleId: '', coproprioId: '', procedure: 'amiable', montantInitial: '', avocatHuissier: '', prochaineEcheance: '', dateOuverture: today, notas: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm({ ...blank, dateOuverture: today }); setErrors({}); setOpen(true) }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.montantInitial || Number(form.montantInitial) < 0) errs.montantInitial = 'Indique o montante.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/recouvrement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ immeubleId: form.immeubleId, coproprioId: form.coproprioId, procedure: form.procedure, montantInitial: Number(form.montantInitial), avocatHuissier: form.avocatHuissier, prochaineEcheance: form.prochaineEcheance, dateOuverture: form.dateOuverture, notes: form.notas }),
      })
        .then((r) => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: 'Processo aberto', desc: fmtEUR(Number(form.montantInitial)) }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao abrir', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: 'Processo aberto (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }

  const avancar = (id: string, proc: string) => {
    const next = ADVANCE[ADVANCE.indexOf(proc) + 1]
    if (!next || !(real && data.token)) { if (!(real && data.token)) push({ kind: 'info', title: 'Avançar (demo)', desc: 'Conecte-se como síndico' }); return }
    setBusy(true)
    fetch('/api/syndic/recouvrement', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
      body: JSON.stringify({ id, procedure: next }),
    })
      .then((r) => { if (!r.ok) throw new Error() })
      .then(() => { data.refresh?.(); push({ kind: 'success', title: 'Procedimento avançado', desc: STAGES.find((s) => s.key === next)?.label || next }) })
      .catch(() => push({ kind: 'error', title: 'Erro', desc: 'Tente novamente mais tarde' }))
      .finally(() => setBusy(false))
  }

  return (
    <>
      <PageHead
        title="Cobrança Judicial"
        lede="Gestão automatizada de cobrança de dívidas ao condomínio (Lei portuguesa)"
        actions={<Button variant="primary" onClick={openNew}><Icon name="plus" />+ Novo processo</Button>}
      />
      <Alert title="Enquadramento legal — Lei 8/2022">
        <span style={{ display: 'block' }}>O administrador deve instaurar ação judicial de cobrança após 90 dias de incumprimento. Faça avançar cada processo pelas etapas legais (amigável → notificação → solicitador → tribunal → penhora).</span>
      </Alert>
      <Tabs defaultActive="pipe" tabs={[
        { id: 'pipe', icon: 'chart', label: 'Pipeline' },
        { id: 'proc', icon: 'folder', label: 'Processos' },
        { id: 'mod', icon: 'clipboard', label: 'Modelos' },
        { id: 'leg', icon: 'scale', label: 'Legislação' },
      ]} />
      <KPIGrid items={[
        { icon: 'coin', num: real ? fmtEUR(emDivida) : '0 €', lbl: 'Total em dívida', accent: 'rust' },
        { icon: 'users', num: real ? ativos.length : 0, lbl: 'Processos ativos', accent: 'amber' },
        { icon: 'scale', num: real ? emTribunal : 0, lbl: 'Em tribunal / penhora', accent: 'rust' },
        { icon: 'check', num: real ? fmtEUR(recuperado) : '0 €', lbl: 'Recuperado', accent: 'sage' },
      ]} />
      <Panel title="Pipeline de cobrança">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12 }}>
          {STAGES.map((c) => {
            const procs = all.filter((r) => r.procedure === c.key)
            return (
              <div key={c.key}>
                <div style={{ padding: '10px 14px', background: `var(--v54-${c.color}-50)`, borderRadius: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: `var(--v54-${c.color}-700)`, marginBottom: 2 }}>{c.label}</div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Pill kind={c.color} noDot>{procs.length}</Pill></div>
                </div>
                {procs.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--v54-navy-300)', fontSize: 11.5, background: 'var(--v54-paper)', borderRadius: 8 }}>Sem processos</div>
                ) : (
                  procs.map((p) => (
                    <div key={p.id} className={m.card} style={{ padding: 12, fontSize: 11.5, marginBottom: 8 }}>
                      <b style={{ fontSize: 12.5 }}>{coName(p.coproprioId)}</b>
                      <div style={{ color: 'var(--v54-navy-500)', marginTop: 2 }}>{imName(p.immeubleId)}</div>
                      <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 18, color: 'var(--v54-gold-700)', marginTop: 6, fontWeight: 600 }}>{fmtEUR(Math.max(0, p.montantInitial - p.montantRecouvre))}</div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                        <Pill kind={p.statut === 'en_cours' ? 'amber' : p.statut === 'cloture_succes' ? 'sage' : 'rust'} noDot>{statutLabel(p.statut)}</Pill>
                        {p.prochaineEcheance && <Pill kind="gold" noDot>Próx.: {p.prochaineEcheance}</Pill>}
                      </div>
                      {ADVANCE.indexOf(p.procedure) >= 0 && ADVANCE.indexOf(p.procedure) < ADVANCE.length - 1 && (
                        <Button size="sm" onClick={() => avancar(p.id, p.procedure)} disabled={busy} style={{ marginTop: 8 }}><Icon name="arrow" />Avançar</Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )
          })}
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="cj-title" size="md">
        <ModalHead icon="scale" id="cj-title" title="Novo processo de cobrança judicial" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label="Edifício" name="cj-edif">
                <select value={form.immeubleId} onChange={(e) => upd('immeubleId', e.target.value)}>
                  <option value="">— escolher —</option>
                  {data.immeubles.map((i) => <option key={i.id} value={i.id}>{i.nom}</option>)}
                </select>
              </Field>
              <Field label="Condómino" name="cj-cond">
                <select value={form.coproprioId} onChange={(e) => upd('coproprioId', e.target.value)}>
                  <option value="">— escolher —</option>
                  {(data.coproprios ?? []).map((c) => <option key={c.id} value={c.id}>{c.proprietario || c.numeroPorte || c.id}</option>)}
                </select>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Etapa" name="cj-proc">
                <select value={form.procedure} onChange={(e) => upd('procedure', e.target.value)}>
                  {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Montante em dívida" required suffix="€" name="cj-mont" error={errors.montantInitial}>
                <input type="number" step="0.01" min="0" placeholder="0" value={form.montantInitial} onChange={(e) => upd('montantInitial', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Advogado / Solicitador" name="cj-adv">
                <input type="text" placeholder="Nome…" value={form.avocatHuissier} onChange={(e) => upd('avocatHuissier', e.target.value)} />
              </Field>
              <Field label="Próxima diligência" name="cj-ech">
                <input type="date" value={form.prochaineEcheance} onChange={(e) => upd('prochaineEcheance', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Notas" full name="cj-notas">
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
