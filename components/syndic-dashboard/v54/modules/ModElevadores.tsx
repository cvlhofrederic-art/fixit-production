'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Alert } from '../primitives/alert'
import { Pill } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import { useDocumentUpload } from './use-document-upload'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'

/** Gestão de Elevadores — port byte-exact V5.7 + Phase 3 : parc réel. */

const STEPS: [string, string, string][] = [
  ['1', 'EMA deteta risco grave', 'Travagem · cabos · porta · botoneira'],
  ['2', 'EMA notifica administrador', 'Email/SMS automático · prazo 24h'],
  ['3', 'Administrador notifica Câmara', 'Template auto-gerado · enviado em 48h'],
  ['4', 'Sinalização elevador fora serviço', 'Cartaz auto-gerado em PDF'],
  ['5', 'Acompanhamento até reparação', 'Predição Manutenção atualiza'],
]

const CAT_LABEL: Record<string, string> = { comercial: 'Comercial', misto: 'Misto', habitacional: 'Habitacional' }
const PERIOD_BY_CAT: Record<string, string> = { comercial: '2 anos', misto: '4 anos', habitacional: '6 anos' }
const estadoLabel = (s: string): string => (s === 'atraso' ? 'Em atraso' : s === 'prazo' ? 'Próximo' : 'Conforme')
const estadoKind = (s: string): 'sage' | 'amber' | 'rust' => (s === 'atraso' ? 'rust' : s === 'prazo' ? 'amber' : 'sage')

export default function ModElevadores() {
  // Phase 3 : vrai parc d'ascenseurs si syndic connecté, sinon mock/empty (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.elevadores ?? []) : []

  const registados = all.length
  const conformes = all.filter((e) => e.estado === 'conforme').length
  const prazo = all.filter((e) => e.estado === 'prazo').length
  const atraso = all.filter((e) => e.estado === 'atraso').length
  const emas = all.filter((e) => e.ema.trim()).length

  // Phase 3 écritures : « + Registar elevador » → POST /api/syndic/elevadores.
  const { push } = useToast()
  const upload = useDocumentUpload()
  const blank = { immeuble: '', marca: '', categoria: 'habitacional', ema: '', ultimaInspecao: '', proximaInspecao: '', estado: 'conforme' }
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
      fetch('/api/syndic/elevadores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ immeuble: form.immeuble, marca: form.marca, categoria: form.categoria, ema: form.ema, ultimaInspecao: form.ultimaInspecao, proximaInspecao: form.proximaInspecao, estado: form.estado }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: 'Elevador registado', desc: form.immeuble }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao registar', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: 'Elevador registado (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }

  return (
    <>
      <PageHead eyebrow="OBRIGAÇÃO LEGAL · DL 320/2002 + LEI 65/2013" title="Gestão de Elevadores"
        lede="Contrato EMA obrigatório · Inspeções periódicas 2/4/6 anos · Comunicação Câmara em 48h se risco grave"
        actions={<><Button onClick={openNew}><Icon name="plus" />+ Registar elevador</Button><Button variant="gold" onClick={upload('autre')}><Icon name="upload" />Upload relatório inspeção</Button></>} />
      <Alert kind="gold" icon="scale" title="Periodicidade obrigatória das inspeções — Art. 8.° DL 320/2002">
        <strong>2 anos</strong> — edifícios comerciais ou serviços abertos ao público.<br />
        <strong>4 anos</strong> — edifícios mistos ou habitacionais com &gt; 32 fogos / &gt; 8 pisos.<br />
        <strong>6 anos</strong> — outros edifícios habitacionais.<br />
        Coimas em caso de incumprimento: <strong>250 € a 5 000 €</strong>.
      </Alert>
      <KPIGrid items={[
        { icon: 'monitor', num: real ? registados : 0, lbl: 'Elevadores registados' },
        { icon: 'check', num: real ? conformes : 0, lbl: 'Em conformidade', accent: 'sage' },
        { icon: 'clock', num: real ? prazo : 0, lbl: 'Próximos do prazo (≤ 90d)', accent: 'amber' },
        { icon: 'ban', num: real ? atraso : 0, lbl: 'Inspeção em atraso', accent: 'rust' },
        { icon: 'shield', num: real ? emas : 0, lbl: 'EMAs ativas' },
        { icon: 'alert', num: 0, lbl: 'Comunicações Câmara 48h', accent: 'rust' },
      ]} />
      <Tabs defaultActive="elev" tabs={[
        { id: 'elev', icon: 'monitor', label: `Elevadores (${real ? registados : 0})` },
        { id: 'insp', icon: 'clipboard', label: 'Inspeções (0)' },
        { id: 'ema', icon: 'shield', label: `Contratos EMA (${real ? emas : 0})` },
        { id: 'risco', icon: 'alert', label: 'Comunicações risco grave' },
      ]} />
      <Panel flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Edifício</th><th>Marca/Modelo</th><th>Categoria</th><th>Periodicidade</th><th>Última inspeção</th><th>Próxima inspeção</th><th>EMA</th><th>Estado</th></tr></thead>
            <tbody>
              {all.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--v54-navy-400)' }}>Nenhum elevador registado. Registe o primeiro elevador.</td></tr>
              ) : all.map((e) => (
                <tr key={e.id}>
                  <td>{e.immeuble || '—'}</td>
                  <td>{e.marca || '—'}</td>
                  <td>{CAT_LABEL[e.categoria] ?? e.categoria}</td>
                  <td>{PERIOD_BY_CAT[e.categoria] ?? '—'}</td>
                  <td>{e.ultimaInspecao || '—'}</td>
                  <td>{e.proximaInspecao || '—'}</td>
                  <td>{e.ema || '—'}</td>
                  <td><Pill kind={estadoKind(e.estado)} noDot>{estadoLabel(e.estado)}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Workflow risco grave — 48h" sub="DL 320/2002 art. 22.° + Lei 65/2013">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STEPS.map(([n, t, s], i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 14px', background: 'var(--v54-cream)', borderRadius: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--v54-rust-500)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>{n}</div>
              <div><div style={{ fontWeight: 600, fontSize: 13 }}>{t}</div><div style={{ fontSize: 12, color: 'var(--v54-navy-400)' }}>{s}</div></div>
            </div>
          ))}
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="ne-title" size="md">
        <ModalHead icon="monitor" id="ne-title" title="Registar elevador" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label="Edifício" required name="ne-imovel" error={errors.immeuble}>
                <input type="text" placeholder="Nome do edifício" value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
              </Field>
              <Field label="Marca / Modelo" name="ne-marca">
                <input type="text" placeholder="Ex.: Otis Gen2" value={form.marca} onChange={(e) => upd('marca', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Categoria" name="ne-cat">
                <select value={form.categoria} onChange={(e) => upd('categoria', e.target.value)}>
                  <option value="comercial">Comercial (2 anos)</option>
                  <option value="misto">Misto (4 anos)</option>
                  <option value="habitacional">Habitacional (6 anos)</option>
                </select>
              </Field>
              <Field label="Estado" name="ne-estado">
                <select value={form.estado} onChange={(e) => upd('estado', e.target.value)}>
                  <option value="conforme">Conforme</option>
                  <option value="prazo">Próximo do prazo</option>
                  <option value="atraso">Em atraso</option>
                </select>
              </Field>
            </FormRow>
            <Field label="EMA (entidade de manutenção)" full name="ne-ema">
              <input type="text" placeholder="Ex.: Otis Manutenção, Lda." value={form.ema} onChange={(e) => upd('ema', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Última inspeção" name="ne-ult">
                <input type="text" placeholder="AAAA-MM-DD" value={form.ultimaInspecao} onChange={(e) => upd('ultimaInspecao', e.target.value)} />
              </Field>
              <Field label="Próxima inspeção" name="ne-prox">
                <input type="text" placeholder="AAAA-MM-DD" value={form.proximaInspecao} onChange={(e) => upd('proximaInspecao', e.target.value)} />
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
