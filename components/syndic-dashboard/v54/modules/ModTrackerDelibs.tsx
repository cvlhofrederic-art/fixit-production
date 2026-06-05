'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import { Empty } from '../primitives/empty'
import { Alert } from '../primitives/alert'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Deliberacao } from '@/lib/syndic/v54/api'
import { useSyndicCreate } from './use-syndic-create'

/** Tracker de Deliberações — port V5.7 + lot 2 fonctionnel.
 * Syndic connecté → vraies délibérations du cabinet (data.deliberacoes) + création POST ;
 * anonyme → état vide byte-exact. Le pipeline IA (STEPS) reste du contenu éducatif. */

type DelibForm = { deliberacao: string; ag: string; responsavel: string; prazo: string; estado: Deliberacao['estado'] }

const AGS = ['Todas as AGs', 'AG Ord 2026', 'AG Extra Mar 2026', 'AG Ord 2025']
type Step = { icon: IconName; titulo: string; desc: string; cor: 'sage' | 'gold' | 'amber' }
const STEPS: Step[] = [
  { icon: 'bot', titulo: 'Análise semântica', desc: 'Detecta verbos no infinitivo + objeto + responsável implícito ou explícito', cor: 'sage' },
  { icon: 'clock', titulo: 'Cálculo prazo', desc: 'data_AG + 15 dias úteis (calendário PT, feriados Porto incluídos)', cor: 'gold' },
  { icon: 'bell', titulo: 'Escalation alertas', desc: 'J-3 / J-1 / J0 / J+1 — emails + push + Canal IA', cor: 'amber' },
]

const estadoLabel = (v: string) => (({ pendente: 'Pendente', em_curso: 'Em curso', concluida: 'Concluída', atrasada: 'Atrasada', bloqueada: 'Bloqueada' } as Record<string, string>)[v] || v)
const estadoKind = (v: string): PillKind => (({ pendente: 'gold', em_curso: 'amber', concluida: 'sage', atrasada: 'rust', bloqueada: 'dark' } as Record<string, PillKind>)[v] || 'gold')
const daysTo = (d: string) => { const t = new Date(d).getTime(); return Number.isNaN(t) ? null : Math.ceil((t - Date.now()) / 86_400_000) }

export default function ModTrackerDelibs() {
  const data = useSyndicData()
  const real = data.authenticated
  const all: Deliberacao[] = real ? (data.deliberacoes ?? []) : []

  const blank: DelibForm = { deliberacao: '', ag: '', responsavel: '', prazo: '', estado: 'pendente' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<DelibForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof DelibForm, string>>>({})
  const { busy, create } = useSyndicCreate('/api/syndic/deliberacoes')
  const { push } = useToast()

  const upd = (k: keyof DelibForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.deliberacao.trim()) { setErrors({ deliberacao: 'Descreva a deliberação.' }); return }
    create(
      { deliberacao: form.deliberacao, ag: form.ag, responsavel: form.responsavel, prazo: form.prazo || null, estado: form.estado, origem: 'manual' },
      { okTitle: 'Deliberação adicionada', desc: form.deliberacao.slice(0, 60), onDone: () => setOpen(false) },
    )
  }

  const extraidasIA = all.filter(d => d.origem === 'ia').length
  const emCurso = all.filter(d => d.estado === 'em_curso').length
  const proximos = all.filter(d => d.estado !== 'concluida' && d.prazo && (daysTo(d.prazo) ?? 99) >= 0 && (daysTo(d.prazo) ?? 99) <= 3).length
  const atrasadas = all.filter(d => d.estado === 'atrasada' || (d.estado !== 'concluida' && d.prazo && (daysTo(d.prazo) ?? 0) < 0)).length
  const concluidas = all.filter(d => d.estado === 'concluida').length
  const bloqueadas = all.filter(d => d.estado === 'bloqueada').length

  return (
    <>
      <PageHead eyebrow="OBRIGAÇÃO LEGAL · CC ART. 1436.° f) i)" title="Tracker de Deliberações"
        lede="Executar deliberações em 15 dias úteis · Extração IA · Calendário de execução · Calendário PT férias-aware"
        actions={<><Button onClick={() => push({ kind: 'info', title: 'Reextração IA', desc: 'Importe uma ata via Atas IA para extrair as deliberações' })}><Icon name="bot" />Reextrair com Fixy</Button><Button variant="gold" onClick={openNew}><Icon name="plus" />+ Nova ação manual</Button></>} />
      <Alert kind="gold" icon="scale" title="Obrigação legal — CC art. 1436.° alínea i)">
        O administrador deve executar as deliberações da assembleia em <strong>15 dias úteis</strong>. Fixy extrai cada deliberação da ata final, atribui prazo automaticamente e envia alertas escalados (J-3 · J-1 · J0 · J+1).
      </Alert>
      <KPIGrid items={[
        { icon: 'bot', num: extraidasIA, lbl: 'Deliberações extraídas IA', accent: extraidasIA ? 'gold' : undefined },
        { icon: 'clock', num: emCurso, lbl: 'Em curso (no prazo)', accent: emCurso ? 'sage' : undefined },
        { icon: 'alert', num: proximos, lbl: 'Próximos do prazo (≤3d)', accent: proximos ? 'amber' : undefined },
        { icon: 'ban', num: atrasadas, lbl: 'Atrasadas (responsabilidade civil)', accent: atrasadas ? 'rust' : undefined },
        { icon: 'check', num: concluidas, lbl: 'Concluídas no prazo', accent: concluidas ? 'sage' : undefined },
        { icon: 'pause', num: bloqueadas, lbl: 'Bloqueadas (justificadas)' },
      ]} />
      <Tabs defaultActive="todas" tabs={[
        { id: 'todas', label: 'Todas as deliberações' },
        { id: 'pen', label: 'Pendentes' },
        { id: 'em', label: 'Em curso' },
        { id: 'atr', label: 'Atrasadas' },
        { id: 'conc', label: 'Concluídas' },
      ]} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {AGS.map((t, i) => <Pill key={i} kind={i === 0 ? 'dark' : undefined} noDot>{t}</Pill>)}
      </div>
      <Panel>
        {all.length === 0 ? (
          <Empty illustration="ag" title="Nenhuma deliberação para acompanhar"
            desc="Quando uma ata for finalizada com Atas IA, as deliberações são extraídas automaticamente e atribuídas com prazos legais."
            action={<Button variant="primary" onClick={openNew}><Icon name="plus" />+ Nova ação manual</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>Deliberação</th><th>AG</th><th>Responsável</th><th>Prazo</th><th>Estado</th></tr></thead>
              <tbody>{all.map(d => (
                <tr key={d.id}><td><b>{d.deliberacao}</b></td><td>{d.ag || '—'}</td><td>{d.responsavel || '—'}</td><td>{d.prazo || '—'}</td><td><Pill kind={estadoKind(d.estado)} noDot>{estadoLabel(d.estado)}</Pill></td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="Como Fixy extrai as deliberações" sub="Pipeline IA pós-ata · Edge cases incluídos">
        <div className={m.cardGrid3}>
          {STEPS.map((r, i) => (
            <div key={i} style={{ padding: 14, border: '1px solid var(--v54-line)', borderRadius: 10, display: 'flex', gap: 12, background: `var(--v54-${r.cor}-50)`, borderLeft: `3px solid var(--v54-${r.cor}-500)` }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', display: 'grid', placeItems: 'center', color: `var(--v54-${r.cor}-700)` }}><Icon name={r.icon} /></div>
              <div><div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{r.titulo}</div><div style={{ fontSize: 11.5, color: 'var(--v54-navy-400)' }}>{r.desc}</div></div>
            </div>
          ))}
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="delib-modal-title" size="md">
        <ModalHead icon="check" id="delib-modal-title" title="Nova ação / deliberação" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label="Deliberação" required full name="delib-txt" error={errors.deliberacao}>
              <textarea rows={2} placeholder="Ex.: Executar a reparação do telhado do bloco B" value={form.deliberacao} onChange={e => upd('deliberacao', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Assembleia" name="delib-ag">
                <input type="text" placeholder="AG Ord 2026" value={form.ag} onChange={e => upd('ag', e.target.value)} />
              </Field>
              <Field label="Responsável" name="delib-resp">
                <input type="text" placeholder="Síndico, prestador…" value={form.responsavel} onChange={e => upd('responsavel', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Prazo de execução" name="delib-prazo">
                <input type="date" value={form.prazo} onChange={e => upd('prazo', e.target.value)} />
              </Field>
              <Field label="Estado" name="delib-estado">
                <select value={form.estado} onChange={e => upd('estado', e.target.value)}>
                  <option value="pendente">Pendente</option>
                  <option value="em_curso">Em curso</option>
                  <option value="concluida">Concluída</option>
                  <option value="atrasada">Atrasada</option>
                  <option value="bloqueada">Bloqueada</option>
                </select>
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
