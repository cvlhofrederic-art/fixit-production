'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
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

/** Segurança Contra Incêndio — port byte-exact V5.7 + Phase 3 : classifications réelles. */

type Cor = 'sage' | 'gold' | 'amber' | 'rust'
const CATEGORIAS: [string, string, Cor][] = [
  ['Categoria 1 — Reduzido', 'Altura ≤ 9m · até 100 ocupantes', 'sage'],
  ['Categoria 2 — Moderado', 'Altura ≤ 28m · até 500 ocupantes', 'sage'],
  ['Categoria 3 — Elevado', 'Altura ≤ 50m · até 1500 ocupantes', 'amber'],
  ['Categoria 4 — Muito Elevado', 'Altura > 50m · > 1500 ocupantes', 'rust'],
]
const catKind = (c: string): PillKind => (c === '4' ? 'rust' : c === '3' ? 'amber' : 'sage')

export default function ModSegEdificio() {
  // Phase 3 : vraies classifications SCIE du cabinet si syndic connecté, sinon mock/empty.
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.segEdificios ?? []) : []

  const classificados = all.length
  const encarregados = all.filter((s) => s.encarregado.trim()).length
  const planos = all.filter((s) => s.planoEmergencia).length
  const exercicios = all.filter((s) => s.ultimoExercicio).length
  const cat4 = all.filter((s) => s.categoria === '4').length

  // Phase 3 écritures : « Classificar edifício » → POST /api/syndic/seg-edificio.
  const { push } = useToast()
  const blank = { immeuble: '', categoria: '1', encarregado: '', planoEmergencia: 'nao', ultimoExercicio: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.immeuble.trim()) errs.immeuble = 'O edifício é obrigatório.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/seg-edificio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ immeuble: form.immeuble, categoria: form.categoria, encarregado: form.encarregado, planoEmergencia: form.planoEmergencia === 'sim', ultimoExercicio: form.ultimoExercicio }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: 'Edifício classificado', desc: form.immeuble }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao classificar', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: 'Edifício classificado (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }

  return (
    <>
      <PageHead eyebrow="OBRIGAÇÃO LEGAL · DL 220/2008 (RSCIE) + PORTARIA 1532/2008" title="Segurança Contra Incêndio"
        lede="Classificação UT 1-12 · Categoria risco 1/2/3/4 · Encarregado de Segurança · Plano emergência · Exercícios"
        actions={<><Button onClick={openNew}><Icon name="building" />Classificar edifício</Button><Button variant="gold"><Icon name="bot" />Gerar plano emergência (Alfredo)</Button></>} />
      <Alert kind="gold" icon="scale" title="Regime Jurídico de Segurança Contra Incêndio">
        Todos os edifícios habitacionais (UT I) com altura &gt; 9m ou &gt; 9 pisos = <strong>categoria risco 3 ou 4</strong>. Obrigam <strong>Encarregado de Segurança</strong> designado + plano emergência + exercícios de evacuação anuais.
      </Alert>
      <KPIGrid items={[
        { icon: 'building', num: real ? classificados : 0, lbl: 'Edifícios classificados' },
        { icon: 'shield', num: real ? encarregados : 0, lbl: 'Encarregados designados', accent: 'sage' },
        { icon: 'doc', num: real ? planos : 0, lbl: 'Planos emergência gerados IA', accent: 'gold' },
        { icon: 'check', num: real ? exercicios : 0, lbl: 'Exercícios realizados (12m)', accent: 'sage' },
        { icon: 'alert', num: real ? cat4 : 0, lbl: 'Categoria 4 (risco elevado)', accent: 'rust' },
        { icon: 'clock', num: 0, lbl: 'Exercícios em atraso', accent: 'amber' },
      ]} />
      <Tabs defaultActive="ed" tabs={[
        { id: 'ed', icon: 'building', label: `Edifícios (${real ? classificados : 0})` },
        { id: 'enc', icon: 'team', label: `Encarregados (${real ? encarregados : 0})` },
        { id: 'plano', icon: 'doc', label: `Planos emergência (${real ? planos : 0})` },
        { id: 'ex', icon: 'check', label: 'Exercícios' },
      ]} />
      {all.length === 0 ? (
        <Panel>
          <Empty illustration="seguros" title="Nenhum edifício classificado"
            desc="Alfredo classifica automaticamente segundo RT-SCIE (utilização-tipo + altura + densidade) e gera plano de emergência 70%-pronto à medida."
            action={<Button variant="primary" onClick={openNew}><Icon name="building" />Classificar primeiro edifício</Button>} />
        </Panel>
      ) : (
        <Panel flush>
          {all.map((s) => (
            <div key={s.id} style={{ padding: '16px 22px', borderBottom: '1px solid var(--v54-line)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 17, fontWeight: 500 }}>{s.immeuble}</div>
                <div style={{ fontSize: 12.5, color: 'var(--v54-navy-300)', marginTop: 2 }}>{s.encarregado ? `Encarregado: ${s.encarregado}` : 'Sem encarregado'}{s.ultimoExercicio ? ` · Último exercício: ${s.ultimoExercicio}` : ''}</div>
              </div>
              {s.planoEmergencia && <Pill kind="sage" noDot>Plano OK</Pill>}
              <Pill kind={catKind(s.categoria)} noDot>Categoria {s.categoria}</Pill>
            </div>
          ))}
        </Panel>
      )}
      <Panel title="Categorias de Risco RT-SCIE">
        <div className={m.cardGrid}>
          {CATEGORIAS.map(([t, s, c], i) => (
            <div key={i} style={{ padding: 14, border: '1px solid var(--v54-line)', borderRadius: 10, background: `var(--v54-${c}-50)`, borderLeft: `3px solid var(--v54-${c}-500)` }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{t}</div>
              <div style={{ fontSize: 11.5, color: 'var(--v54-navy-400)' }}>{s}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="nsc-title" size="md">
        <ModalHead icon="building" id="nsc-title" title="Classificar edifício (SCIE)" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label="Edifício" required full name="nsc-imovel" error={errors.immeuble}>
              <input type="text" placeholder="Nome do edifício" value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Categoria de risco" name="nsc-cat">
                <select value={form.categoria} onChange={(e) => upd('categoria', e.target.value)}>
                  <option value="1">Categoria 1 — Reduzido</option>
                  <option value="2">Categoria 2 — Moderado</option>
                  <option value="3">Categoria 3 — Elevado</option>
                  <option value="4">Categoria 4 — Muito Elevado</option>
                </select>
              </Field>
              <Field label="Plano de emergência" name="nsc-plano">
                <select value={form.planoEmergencia} onChange={(e) => upd('planoEmergencia', e.target.value)}>
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Encarregado de Segurança" name="nsc-enc">
                <input type="text" placeholder="Nome do encarregado" value={form.encarregado} onChange={(e) => upd('encarregado', e.target.value)} />
              </Field>
              <Field label="Último exercício" name="nsc-ex">
                <input type="text" placeholder="AAAA-MM-DD" value={form.ultimoExercicio} onChange={(e) => upd('ultimoExercicio', e.target.value)} />
              </Field>
            </FormRow>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>Classificar</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
