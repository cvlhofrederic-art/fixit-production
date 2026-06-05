'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Tabs } from '../primitives/tabs'
import { Pill, type PillKind } from '../primitives/pill'
import { KPIGrid } from '../primitives/kpi'
import { Button } from '../primitives/button'
import { Alert } from '../primitives/alert'
import { Empty } from '../primitives/empty'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Infracao } from '@/lib/syndic/v54/api'

/** Acompanhamento de Infrações — page net-new + lot fonctionnel.
 * Syndic connecté → vraies infractions du cabinet (data.infracoes) + création POST ;
 * anonyme → preview byte-exact (design showcase V5.7). */

type Etapa = Infracao['etapa']
type InfForm = { tipo: string; condomino: string; edificio: string; etapa: Etapa; multa: string; descricao: string }

const fmtMulta = (n: number) => (n > 0 ? `€ ${new Intl.NumberFormat('pt-PT').format(n)}` : '—')
const etapaLabel = (v: string) => (({ sinalizada: 'Sinalizada', analise: 'Em análise', notificacao: 'Notificação enviada', multa: 'Multa aplicada', resolvida: 'Resolvida' } as Record<string, string>)[v] || v)
const etapaKind = (v: string): PillKind => (({ sinalizada: 'gold', analise: 'amber', notificacao: 'amber', multa: 'rust', resolvida: 'sage' } as Record<string, PillKind>)[v] || 'gold')

const PREVIEW: Infracao[] = [
  { id: 'p1', tipo: 'Ruído fora de horas', condomino: 'Carlos Mendes — Fração 4B', edificio: 'Edifício Aurora', etapa: 'notificacao', multa: 75, descricao: '' },
  { id: 'p2', tipo: 'Estacionamento indevido', condomino: 'Ana Silva — Fração 2A', edificio: 'Edifício Bela Vista', etapa: 'sinalizada', multa: 0, descricao: '' },
  { id: 'p3', tipo: 'Lixo fora do contentor', condomino: 'Pedro Costa — Fração 1C', edificio: 'Residencial Cedofeita', etapa: 'multa', multa: 50, descricao: '' },
  { id: 'p4', tipo: 'Obras sem autorização', condomino: 'Rita Oliveira — Fração 5A', edificio: 'Condomínio Boavista Center', etapa: 'resolvida', multa: 150, descricao: '' },
]

const PIPELINE_DEF: Array<[string, Etapa, PillKind]> = [
  ['Sinalização', 'sinalizada', 'gold'],
  ['Análise & provas', 'analise', 'amber'],
  ['Notificação', 'notificacao', 'amber'],
  ['Multa aplicada', 'multa', 'rust'],
  ['Resolvida', 'resolvida', 'sage'],
]
const MODELOS = ['Notificação de infração', 'Advertência formal', 'Aplicação de multa', 'Resolução amigável']

export default function ModInfracoes() {
  const data = useSyndicData()
  const real = data.authenticated
  const all: Infracao[] = real ? (data.infracoes ?? []) : PREVIEW

  const blank: InfForm = { tipo: '', condomino: '', edificio: '', etapa: 'sinalizada', multa: '', descricao: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<InfForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof InfForm, string>>>({})
  const [busy, setBusy] = useState(false)
  const { push } = useToast()

  const upd = (k: keyof InfForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.tipo.trim()) { setErrors({ tipo: 'Indique o tipo de infração.' }); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/infracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ tipo: form.tipo, condomino: form.condomino, edificio: form.edificio, etapa: form.etapa, multa: Number(form.multa) || 0, descricao: form.descricao }),
      })
        .then(r => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: 'Infração registada', desc: form.tipo }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao registar', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: 'Infração registada (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }

  const abertas = all.filter(i => i.etapa !== 'resolvida').length
  const emProcesso = all.filter(i => i.etapa === 'analise' || i.etapa === 'notificacao' || i.etapa === 'multa').length
  const multasTotal = all.reduce((s, i) => s + (Number(i.multa) || 0), 0)
  const resolvidas = all.filter(i => i.etapa === 'resolvida').length

  return (
    <>
      <PageHead title="Acompanhamento de Infrações" lede="Infrações ao regulamento · Pipeline sinalização → multa · Provas · Histórico · Modelos de carta"
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />Nova infração</Button>} />
      <Tabs defaultActive="pipeline" tabs={[
        { id: 'pipeline', icon: 'chart', label: 'Pipeline' },
        { id: 'infracoes', icon: 'alert', label: 'Infrações' },
        { id: 'modelos', icon: 'doc', label: 'Modelos de carta' },
        { id: 'hist', icon: 'clock', label: 'Histórico' },
      ]} />
      <Alert kind="gold" icon="scale" title="Procedimento conforme o regulamento do condomínio">
        Cada infração segue o pipeline sinalização → análise → notificação → multa, com registo de provas e modelos de carta gerados automaticamente.
      </Alert>
      <KPIGrid items={[
        { icon: 'alert', num: abertas, lbl: 'Infrações abertas', accent: abertas ? 'rust' : undefined },
        { icon: 'clock', num: emProcesso, lbl: 'Em processo', accent: emProcesso ? 'amber' : undefined },
        { icon: 'coin', num: fmtMulta(multasTotal).replace('€', '').trim() || '0', cur: '€', lbl: 'Multas aplicadas' },
        { icon: 'check', num: resolvidas, lbl: 'Resolvidas', accent: resolvidas ? 'sage' : undefined },
      ]} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}>
        <Panel title="Pipeline por etapa">
          {PIPELINE_DEF.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < PIPELINE_DEF.length - 1 ? '1px solid var(--v54-line)' : 'none' }}>
              <span>{p[0]}</span><Pill kind={p[2]} noDot>{all.filter(x => x.etapa === p[1]).length}</Pill>
            </div>
          ))}
        </Panel>
        <Panel title="Modelos de carta">
          {MODELOS.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < MODELOS.length - 1 ? '1px solid var(--v54-line)' : 'none' }}>
              <Icon name="doc" /><span>{t}</span>
            </div>
          ))}
        </Panel>
      </div>
      <Panel title="Infrações em curso" flush>
        {real && all.length === 0 ? (
          <Empty illustration="documentos" title="Sem infrações registadas" desc="Sinalize a primeira infração ao regulamento do condomínio"
            action={<Button variant="gold" onClick={openNew}><Icon name="plus" />Nova infração</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>Tipo</th><th>Condómino</th><th>Edifício</th><th>Etapa</th><th>Multa</th></tr></thead>
              <tbody>{all.map(f => (
                <tr key={f.id}><td><b>{f.tipo}</b></td><td>{f.condomino || '—'}</td><td>{f.edificio || '—'}</td><td><Pill kind={etapaKind(f.etapa)} noDot>{etapaLabel(f.etapa)}</Pill></td><td className={m.numCell}>{fmtMulta(Number(f.multa) || 0)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="inf-modal-title" size="md">
        <ModalHead icon="alert" id="inf-modal-title" title="Nova infração" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label="Tipo de infração" required full name="inf-tipo" error={errors.tipo}>
              <input type="text" placeholder="Ex.: Ruído fora de horas" value={form.tipo} onChange={e => upd('tipo', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Condómino" name="inf-cond">
                <input type="text" placeholder="Nome — Fração" value={form.condomino} onChange={e => upd('condomino', e.target.value)} />
              </Field>
              <Field label="Edifício" name="inf-edif">
                <input type="text" placeholder="Edifício…" value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Etapa" name="inf-etapa">
                <select value={form.etapa} onChange={e => upd('etapa', e.target.value)}>
                  <option value="sinalizada">Sinalizada</option>
                  <option value="analise">Em análise</option>
                  <option value="notificacao">Notificação enviada</option>
                  <option value="multa">Multa aplicada</option>
                  <option value="resolvida">Resolvida</option>
                </select>
              </Field>
              <Field label="Multa" hint="Valor em euros" name="inf-multa" suffix="€">
                <input type="number" step="0.01" min="0" inputMode="decimal" placeholder="0" value={form.multa} onChange={e => upd('multa', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Descrição / provas" full name="inf-desc">
              <textarea rows={3} placeholder="Contexto, provas, testemunhos…" value={form.descricao} onChange={e => upd('descricao', e.target.value)} />
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
