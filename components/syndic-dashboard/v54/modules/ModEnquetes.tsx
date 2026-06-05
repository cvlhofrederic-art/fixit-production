'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Pill, type PillKind } from '../primitives/pill'
import { Progress } from '../primitives/progress'
import { Button } from '../primitives/button'
import { Empty } from '../primitives/empty'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Enquete } from '@/lib/syndic/v54/api'

/** Enquetes & Sondagens — port byte-exact V5.7 + lot fonctionnel.
 * Syndic connecté → vraies enquêtes du cabinet (data.enquetes) + création POST ;
 * anonyme → preview byte-exact (les % sont dérivés des votes → mêmes chiffres). */

type EnqForm = { titulo: string; descricao: string; tipo: string; edificio: string; estado: Enquete['estado']; prazo: string; total: string; anonima: string; options: string }

const estadoLabel = (v: string) => (({ ativa: 'Ativa', a_decorrer: 'A decorrer', encerrada: 'Encerrada' } as Record<string, string>)[v] || v)
const estadoKind = (v: string): PillKind => (({ ativa: 'sage', a_decorrer: 'amber', encerrada: 'rust' } as Record<string, PillKind>)[v] || 'amber')
const respondido = (e: Enquete) => e.options.reduce((s, o) => s + (Number(o.votes) || 0), 0)
const partPct = (e: Enquete) => (e.total > 0 ? Math.min(100, Math.round((respondido(e) / e.total) * 100)) : 0)
const optPct = (e: Enquete, votes: number) => { const r = respondido(e); return r > 0 ? Math.round((votes / r) * 100) : 0 }

const PREVIEW: Enquete[] = [
  { id: 'p1', titulo: 'Horário de recolha de lixo', descricao: 'Qual o horário preferido para a recolha de lixo no condomínio? Solicitamos a participação de todas as frações', estado: 'ativa', tipo: 'Escolha Múltipla', edificio: 'Edifício Marquês', prazo: '8 dias restantes', total: 40, options: [{ label: 'Manhã (7h-9h)', votes: 8 }, { label: 'Tarde (14h-16h)', votes: 3 }, { label: 'Noite (20h-22h)', votes: 12 }, { label: 'Sem preferência', votes: 2 }], anonima: false },
  { id: 'p2', titulo: 'Aprovação obra fachada', descricao: 'Concorda com a realização da obra de pintura da fachada prevista no orçamento de 2026?', estado: 'a_decorrer', tipo: 'Sim / Não', edificio: 'Edifício Marquês', prazo: 'Prazo expirado', total: 32, options: [{ label: 'Sim', votes: 18 }, { label: 'Não', votes: 7 }], anonima: false },
  { id: 'p3', titulo: 'Satisfação serviço limpeza', descricao: 'De 1 a 5, como avalia a qualidade do serviço de limpeza das áreas comuns no último trimestre?', estado: 'ativa', tipo: 'Escala 1-5', edificio: 'Residência Boavista', prazo: 'Prazo expirado', total: 40, options: [{ label: '1 - Muito Insatisfeito', votes: 1 }, { label: '2 - Insatisfeito', votes: 3 }, { label: '3 - Neutro', votes: 5 }, { label: '4 - Satisfeito', votes: 10 }, { label: '5 - Muito Satisfeito', votes: 6 }], anonima: true },
]
const surveyCard = { background: '#fff', border: '1px solid var(--v54-line)', borderRadius: 14, boxShadow: 'var(--v54-shadow-card)', padding: 22, marginBottom: 16 } as const

export default function ModEnquetes() {
  const data = useSyndicData()
  const real = data.authenticated
  const all: Enquete[] = real ? (data.enquetes ?? []) : PREVIEW

  const blank: EnqForm = { titulo: '', descricao: '', tipo: 'Escolha Múltipla', edificio: '', estado: 'ativa', prazo: '', total: '', anonima: 'nao', options: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<EnqForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof EnqForm, string>>>({})
  const [busy, setBusy] = useState(false)
  const { push } = useToast()

  const upd = (k: keyof EnqForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.titulo.trim()) { setErrors({ titulo: 'Indique o título da enquete.' }); return }
    const options = form.options.split('\n').map(l => l.trim()).filter(Boolean).map(label => ({ label, votes: 0 }))
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/enquetes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ titulo: form.titulo, descricao: form.descricao, tipo: form.tipo, edificio: form.edificio, estado: form.estado, prazo: form.prazo || null, total: Number(form.total) || 0, options, anonima: form.anonima === 'sim' }),
      })
        .then(r => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: 'Enquete criada', desc: form.titulo }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao criar', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: 'Enquete criada (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }

  const ativas = all.filter(e => e.estado === 'ativa').length
  const historico = all.filter(e => e.estado === 'encerrada').length
  const partMedia = all.length ? Math.round(all.reduce((s, e) => s + partPct(e), 0) / all.length) : 0
  const totalRespostas = all.reduce((s, e) => s + respondido(e), 0)

  return (
    <>
      <PageHead title="Enquetes & Sondagens" lede="Consulte a opinião dos condóminos de forma rápida e organizada"
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />Nova Enquete</Button>} />
      <KPIGrid items={[
        { icon: 'poll', num: ativas, lbl: 'Enquetes Ativas', accent: 'gold' },
        { icon: 'folder', num: historico, lbl: 'Histórico Total' },
        { icon: 'chart', num: `${partMedia}%`, lbl: 'Participação Média', accent: 'sage' },
        { icon: 'users', num: totalRespostas, lbl: 'Total Respostas', accent: 'sage' },
      ]} />
      <Tabs defaultActive="ativas" tabs={[
        { id: 'ativas', icon: 'chart', label: 'Enquetes Ativas', badge: ativas },
        { id: 'hist', icon: 'folder', label: 'Histórico', badge: historico },
        { id: 'criar', icon: 'pencil', label: 'Criar Enquete' },
      ]} />
      {real && all.length === 0 ? (
        <Empty illustration="documentos" title="Sem enquetes" desc="Lance a primeira consulta aos condóminos"
          action={<Button variant="gold" onClick={openNew}><Icon name="plus" />Nova Enquete</Button>} />
      ) : all.map(s => (
        <div key={s.id} style={surveyCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500, marginBottom: 4 }}>{s.titulo}</div>
              <div style={{ fontSize: 13, color: 'var(--v54-navy-500)' }}>{s.descricao}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Pill kind={estadoKind(s.estado)} noDot>● {estadoLabel(s.estado)}</Pill>
                {s.tipo && <Pill noDot>{s.tipo}</Pill>}
                {s.edificio && <Pill noDot>{s.edificio}</Pill>}
                {s.anonima && <Pill kind="gold" noDot>Anónima</Pill>}
                {s.prazo && <Pill kind={s.prazo === 'Prazo expirado' ? 'rust' : 'gold'} noDot>{s.prazo}</Pill>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => push({ kind: 'info', title: 'Detalhes da enquete', desc: s.titulo })}>Ver detalhes</Button>
              <Button variant="danger" size="sm" onClick={() => push({ kind: 'info', title: 'Encerrar enquete', desc: real ? 'Gestão de encerramento em breve' : 'Conecte-se como síndico' })}>Encerrar</Button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--v54-navy-300)', margin: '14px 0 6px' }}><span>{respondido(s)}/{s.total} frações responderam</span><span><b style={{ color: 'var(--v54-ink)' }}>{partPct(s)}%</b></span></div>
          <Progress pct={partPct(s)} />
          <div style={{ marginTop: 14 }}>
            {s.options.map((o, j) => (
              <div key={j}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}><span>{o.label}</span><span><b>{o.votes} ({optPct(s, o.votes)}%)</b></span></div>
                <Progress pct={optPct(s, o.votes)} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="enq-modal-title" size="md">
        <ModalHead icon="poll" id="enq-modal-title" title="Nova enquete" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label="Título" required full name="enq-titulo" error={errors.titulo}>
              <input type="text" placeholder="Ex.: Horário de recolha de lixo" value={form.titulo} onChange={e => upd('titulo', e.target.value)} />
            </Field>
            <Field label="Descrição" full name="enq-desc">
              <textarea rows={2} value={form.descricao} onChange={e => upd('descricao', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Tipo" name="enq-tipo">
                <select value={form.tipo} onChange={e => upd('tipo', e.target.value)}>
                  <option value="Escolha Múltipla">Escolha Múltipla</option>
                  <option value="Sim / Não">Sim / Não</option>
                  <option value="Escala 1-5">Escala 1-5</option>
                </select>
              </Field>
              <Field label="Edifício" name="enq-edif">
                <input type="text" placeholder="Edifício…" value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Estado" name="enq-estado">
                <select value={form.estado} onChange={e => upd('estado', e.target.value)}>
                  <option value="ativa">Ativa</option>
                  <option value="a_decorrer">A decorrer</option>
                  <option value="encerrada">Encerrada</option>
                </select>
              </Field>
              <Field label="Prazo" name="enq-prazo">
                <input type="date" value={form.prazo} onChange={e => upd('prazo', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Frações consultadas" hint="Total de frações" name="enq-total">
                <input type="number" min="0" inputMode="numeric" placeholder="0" value={form.total} onChange={e => upd('total', e.target.value)} />
              </Field>
              <Field label="Anónima" name="enq-anon">
                <select value={form.anonima} onChange={e => upd('anonima', e.target.value)}>
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </Field>
            </FormRow>
            <Field label="Opções de resposta" hint="Uma opção por linha" full name="enq-options">
              <textarea rows={4} placeholder={'Manhã (7h-9h)\nTarde (14h-16h)\nNoite (20h-22h)'} value={form.options} onChange={e => upd('options', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>Criar enquete</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
