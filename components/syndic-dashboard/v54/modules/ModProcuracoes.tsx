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
import { downloadReportPdf } from '@/lib/syndic/v54/report-pdf'

/** Procurações & Lista de Presenças — port byte-exact V5.7 + Phase 3 : tracker réel. */

const STEPS: [string, string, string][] = [
  ['1', 'Upload PDF procuração', 'Léa extrai texto OCR · confidence score'],
  ['2', 'Identificação partes', 'Procurante (condómino) · procurador · fração'],
  ['3', 'Validação NIF', 'API AT.gov.pt — match contra lista condóminos'],
  ['4', 'Extração datas', 'Validade · AG específica ou geral'],
  ['5', 'Arquivo + sinalização', 'Disponível em AG Live · pré-cheka lista presenças'],
]
const statutKind = (s: string): PillKind => (s === 'expirada' ? 'rust' : 'sage')

export default function ModProcuracoes() {
  // Phase 3 : vraies procurations du cabinet si syndic connecté, sinon mock/empty (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.procuracoes ?? []) : []

  const arquivadas = all.length
  const aExpirar = all.filter((p) => p.statut === 'expirada').length

  // Phase 3 écritures : « Registar procuração » → POST /api/syndic/procuracoes.
  const { push } = useToast()
  const blank = { condomino: '', procurador: '', fracao: '', immeuble: '', dataValidade: '', agRef: '', statut: 'valida' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.condomino.trim()) errs.condomino = 'O condómino é obrigatório.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/procuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ condomino: form.condomino, procurador: form.procurador, fracao: form.fracao, immeuble: form.immeuble, dataValidade: form.dataValidade, agRef: form.agRef, statut: form.statut }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: 'Procuração registada', desc: form.condomino }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao registar', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: 'Procuração registada (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }

  const exportPresencas = () => {
    if (!real || all.length === 0) { push({ kind: 'info', title: 'Lista de presenças AG', desc: real ? 'Registe procurações para gerar a lista.' : 'Conecte-se como síndico para gerar a lista.' }); return }
    const statutLabel = (s: string) => (s === 'expirada' ? 'Expirada' : 'Válida')
    downloadReportPdf('lista-presencas-ag.pdf', {
      title: 'Lista de Presenças — Assembleia Geral',
      subtitle: 'CC art. 1433.º-3 · DL 268/94 art. 1.º-3',
      tables: [{ headers: ['Condómino', 'Fração', 'Representado por', 'Validade', 'Estado', 'Assinatura'], rows: all.map((p) => [p.condomino || '—', p.fracao || '—', p.procurador || '—', p.dataValidade || '—', statutLabel(p.statut), '']) }],
    })
  }

  return (
    <>
      <PageHead eyebrow="OBRIGAÇÃO LEGAL · CC ART. 1433.° N.° 3" title="Procurações & Lista de Presenças"
        lede="Arquivo de procurações escritas · Lista de presenças assinada · Léa OCR + validação NIF"
        actions={<><Button onClick={openNew}><Icon name="upload" />Registar procuração</Button><Button variant="gold" onClick={exportPresencas}><Icon name="bank" />Gerar lista presenças AG</Button></>} />
      <Alert kind="gold" icon="scale" title="Enquadramento legal">
        Todo o condómino pode ser representado em assembleia por procuração escrita (CC art. 1433.°-3). A lista de presenças é obrigatória em qualquer AG (DL 268/94 art. 1.°-3) e deve ser conservada com a ata.
      </Alert>
      <KPIGrid items={[
        { icon: 'doc', num: real ? arquivadas : 0, lbl: 'Procurações arquivadas' },
        { icon: 'bot', num: real ? '—' : '0%', lbl: 'OCR Léa confidence', accent: 'sage' },
        { icon: 'check', num: 0, lbl: 'NIFs validados AT', accent: 'sage' },
        { icon: 'alert', num: 0, lbl: 'NIFs com erro', accent: 'rust' },
        { icon: 'clock', num: real ? aExpirar : 0, lbl: 'A expirar (próx. AG)', accent: 'amber' },
        { icon: 'bank', num: 0, lbl: 'AGs com lista completa', accent: 'gold' },
      ]} />
      <Tabs defaultActive="proc" tabs={[
        { id: 'proc', icon: 'doc', label: `Procurações (${real ? arquivadas : 0})` },
        { id: 'pres', icon: 'team', label: 'Listas de Presenças (0)' },
      ]} />
      {all.length === 0 ? (
        <Panel>
          <Empty illustration="ag" title="Nenhuma procuração arquivada"
            desc="Fazer upload das procurações em PDF. Léa extrai automaticamente: condómino representado, procurador, datas de validade, e valida NIFs contra AT."
            action={<Button variant="primary" onClick={openNew}><Icon name="upload" />+ Registar primeira procuração</Button>} />
        </Panel>
      ) : (
        <Panel flush>
          {all.map((p) => (
            <div key={p.id} style={{ padding: '16px 22px', borderBottom: '1px solid var(--v54-line)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 17, fontWeight: 500 }}>{p.condomino}{p.fracao ? ` · ${p.fracao}` : ''}</div>
                <div style={{ fontSize: 12.5, color: 'var(--v54-navy-300)', marginTop: 2 }}>Representado por {p.procurador || '—'}{p.agRef ? ` · ${p.agRef}` : ''}{p.immeuble ? ` · ${p.immeuble}` : ''}</div>
              </div>
              {p.dataValidade && <span style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>Validade: {p.dataValidade}</span>}
              <Pill kind={statutKind(p.statut)} noDot>{p.statut === 'expirada' ? 'Expirada' : 'Válida'}</Pill>
            </div>
          ))}
        </Panel>
      )}
      <Panel title="Pipeline OCR Léa" sub="Validação automática + alertas">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STEPS.map(([n, t, s], i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 14px', background: 'var(--v54-cream)', borderRadius: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--v54-gold-500)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>{n}</div>
              <div><div style={{ fontWeight: 600, fontSize: 13 }}>{t}</div><div style={{ fontSize: 12, color: 'var(--v54-navy-400)' }}>{s}</div></div>
            </div>
          ))}
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="npc-title" size="md">
        <ModalHead icon="doc" id="npc-title" title="Registar procuração" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label="Condómino representado" required name="npc-cond" error={errors.condomino}>
                <input type="text" placeholder="Nome do condómino" value={form.condomino} onChange={(e) => upd('condomino', e.target.value)} />
              </Field>
              <Field label="Procurador" name="npc-proc">
                <input type="text" placeholder="Quem representa" value={form.procurador} onChange={(e) => upd('procurador', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Fração" name="npc-frac">
                <input type="text" placeholder="Ex.: 2C" value={form.fracao} onChange={(e) => upd('fracao', e.target.value)} />
              </Field>
              <Field label="Edifício" name="npc-imovel">
                <input type="text" placeholder="Opcional" value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="AG (referência)" name="npc-ag">
                <input type="text" placeholder="Ex.: AG Ordinária 2026" value={form.agRef} onChange={(e) => upd('agRef', e.target.value)} />
              </Field>
              <Field label="Validade" name="npc-val">
                <input type="text" placeholder="AAAA-MM-DD" value={form.dataValidade} onChange={(e) => upd('dataValidade', e.target.value)} />
              </Field>
            </FormRow>
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
