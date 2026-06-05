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
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { ProcessoJud } from '@/lib/syndic/v54/api'
import { useSyndicCreate } from './use-syndic-create'

/** Centro de Notificações Judiciais — port V5.7 + lot 2 fonctionnel.
 * Syndic connecté → vrais processus du cabinet (data.processosJud) + création POST ;
 * anonyme → état vide byte-exact. Léa OCR / relatório semestral = contenu éducatif. */

type Cor = 'sage' | 'gold' | 'amber' | 'rust'
type ProcForm = { tipo: string; contraparte: string; processo: string; data: string; prazo: string; estado: ProcessoJud['estado']; valor: string; descricao: string }

const fmtEUR = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)
const estadoLabel = (v: string) => (({ ativo: 'Ativo', arquivado: 'Arquivado' } as Record<string, string>)[v] || v)
const estadoKind = (v: string): PillKind => (v === 'arquivado' ? 'sage' : 'amber')

const TIPOS: [string, string, Cor][] = [
  ['Citação tribunal', 'Email a todos os condóminos · cópia notificação · prazo defesa', 'rust'],
  ['Notificação injunção', 'Email + carta registada · explicação simples · próximos passos', 'amber'],
  ['Sentença favorável', 'Email all · resumo + acta arquivo', 'sage'],
  ['Sentença contrária', 'Email all · análise impactos + plano resposta', 'rust'],
  ['Procedimento contraord.', 'Email all · descrição + defesa em curso', 'amber'],
  ['Update semestral', 'Auto-gerado · sumário evolução todos processos', 'gold'],
]

export default function ModNotificJud() {
  const data = useSyndicData()
  const real = data.authenticated
  const all: ProcessoJud[] = real ? (data.processosJud ?? []) : []

  const blank: ProcForm = { tipo: '', contraparte: '', processo: '', data: '', prazo: '', estado: 'ativo', valor: '', descricao: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ProcForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof ProcForm, string>>>({})
  const { busy, create } = useSyndicCreate('/api/syndic/processos-jud')
  const { push } = useToast()

  const upd = (k: keyof ProcForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.tipo.trim()) { setErrors({ tipo: 'Indique o tipo de processo.' }); return }
    create(
      { tipo: form.tipo, contraparte: form.contraparte, processo: form.processo, data: form.data || null, prazo: form.prazo || null, estado: form.estado, valor: Number(form.valor) || 0, descricao: form.descricao },
      { okTitle: 'Processo registado', desc: form.tipo, onDone: () => setOpen(false) },
    )
  }

  const ativos = all.filter(p => p.estado === 'ativo').length
  const arquivados = all.filter(p => p.estado === 'arquivado').length
  const valorTotal = all.reduce((s, p) => s + (Number(p.valor) || 0), 0)

  return (
    <>
      <PageHead eyebrow="OBRIGAÇÃO LEGAL · CC ART. 1436.° o) e p)" title="Centro de Notificações Judiciais"
        lede="Citações · Notificações · Sentenças · Relatório semestral automático · Léa OCR + Fixy redação"
        actions={<><Button onClick={openNew}><Icon name="upload" />Upload notificação</Button><Button variant="gold" onClick={() => push({ kind: 'info', title: 'Relatório semestral', desc: ativos ? `${ativos} processos ativos a incluir` : 'Registe o primeiro processo para gerar o relatório' })}><Icon name="doc" />Gerar relatório semestral</Button></>} />
      <Alert kind="gold" icon="scale" title="Obrigação dupla — Lei 8/2022">
        <strong>Alínea o)</strong> — Informar condóminos sempre que o condomínio é citado/notificado (processo judicial, arbitral, injunção, contraordenacional ou administrativo).<br />
        <strong>Alínea p)</strong> — Informar <strong>pelo menos semestralmente</strong> sobre o desenvolvimento dos processos em curso.
      </Alert>
      <KPIGrid items={[
        { icon: 'scale', num: ativos, lbl: 'Processos ativos', accent: ativos ? 'rust' : undefined },
        { icon: 'folder', num: all.length, lbl: 'Total processos' },
        { icon: 'coin', num: valorTotal ? fmtEUR(valorTotal).replace('€', '').trim() : '—', cur: valorTotal ? '€' : undefined, lbl: 'Valor em causa' },
        { icon: 'check', num: arquivados, lbl: 'Arquivados', accent: arquivados ? 'sage' : undefined },
        { icon: 'clock', num: 'semestral', lbl: 'Próximo relatório', accent: 'gold' },
        { icon: 'bot', num: 'Léa', lbl: 'OCR + classificação' },
      ]} />
      <Tabs defaultActive="proc" tabs={[
        { id: 'proc', icon: 'scale', label: `Processos (${all.length})` },
        { id: 'in', icon: 'upload', label: 'Inbox notificações' },
        { id: 'com', icon: 'mail', label: 'Comunicações enviadas' },
        { id: 'rel', icon: 'doc', label: 'Relatórios semestrais' },
      ]} />
      <Panel>
        {all.length === 0 ? (
          <Empty illustration="documentos" title="Nenhum processo judicial em curso"
            desc="Quando uma notificação chegar, faça upload. Léa classifica (citação · notificação · sentença), extrai partes + prazos, Fixy redige a comunicação aos condóminos afetados."
            action={<Button variant="primary" onClick={openNew}><Icon name="upload" />+ Primeira notificação</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>Tipo</th><th>Contraparte</th><th>Processo n.º</th><th>Data</th><th>Valor</th><th>Estado</th></tr></thead>
              <tbody>{all.map(p => (
                <tr key={p.id}><td><b>{p.tipo}</b></td><td>{p.contraparte || '—'}</td><td>{p.processo || '—'}</td><td>{p.data || '—'}</td><td className={m.numCell}>{p.valor ? fmtEUR(Number(p.valor)) : '—'}</td><td><Pill kind={estadoKind(p.estado)} noDot>{estadoLabel(p.estado)}</Pill></td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="Tipos de comunicação automática">
        <div className={m.cardGrid}>
          {TIPOS.map(([t, s, c], i) => (
            <div key={i} style={{ padding: 14, border: '1px solid var(--v54-line)', borderRadius: 10, background: `var(--v54-${c}-50)`, borderLeft: `3px solid var(--v54-${c}-500)` }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{t}</div>
              <div style={{ fontSize: 11.5, color: 'var(--v54-navy-400)' }}>{s}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="proc-modal-title" size="md">
        <ModalHead icon="scale" id="proc-modal-title" title="Novo processo / notificação" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label="Tipo" required name="proc-tipo" error={errors.tipo}>
                <input type="text" placeholder="Citação, injunção, sentença…" value={form.tipo} onChange={e => upd('tipo', e.target.value)} />
              </Field>
              <Field label="Contraparte" name="proc-contra">
                <input type="text" placeholder="Nome / entidade" value={form.contraparte} onChange={e => upd('contraparte', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="N.º de processo" full name="proc-num">
              <input type="text" placeholder="Ex.: 1234/26.0T8PRT" value={form.processo} onChange={e => upd('processo', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Data" name="proc-data">
                <input type="date" value={form.data} onChange={e => upd('data', e.target.value)} />
              </Field>
              <Field label="Prazo" hint="Defesa / resposta" name="proc-prazo">
                <input type="date" value={form.prazo} onChange={e => upd('prazo', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Estado" name="proc-estado">
                <select value={form.estado} onChange={e => upd('estado', e.target.value)}>
                  <option value="ativo">Ativo</option>
                  <option value="arquivado">Arquivado</option>
                </select>
              </Field>
              <Field label="Valor em causa" hint="Euros" name="proc-valor" suffix="€">
                <input type="number" step="0.01" min="0" inputMode="decimal" placeholder="0" value={form.valor} onChange={e => upd('valor', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Descrição" full name="proc-desc">
              <textarea rows={3} placeholder="Objeto do processo, partes, estado…" value={form.descricao} onChange={e => upd('descricao', e.target.value)} />
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
