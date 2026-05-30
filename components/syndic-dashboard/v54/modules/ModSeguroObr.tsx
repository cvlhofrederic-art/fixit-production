'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Pill } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'

/** Seguro Obrigatório de Condomínio — port byte-exact du ModSeguroObr du bundle V5.7 (stateful : 2 modals). */

type ApForm = { seguradora: string; numero: string; edificio: string; dataInicio: string; dataFim: string; premio: string; cobertura: string; notas: string }
type Apolice = { id: number; seguradora: string; numero: string; edificio: string; dataInicio: string; dataFim: string; premio: number; cobertura: number; notas: string; estado: string }
type SinForm = { apolice: string; dataSinistro: string; tipo: string; montante: string; descricao: string }
type Sinistro = { id: number; apolice: string; dataSinistro: string; tipo: string; montante: number; descricao: string; estado: string }

const fmtEUR = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)
const yearLater = (d: string) => { const dt = new Date(d); dt.setFullYear(dt.getFullYear() + 1); return dt.toISOString().slice(0, 10) }

export default function ModSeguroObr() {
  const today = new Date().toISOString().slice(0, 10)
  const blankA: ApForm = { seguradora: '', numero: '', edificio: '', dataInicio: today, dataFim: yearLater(today), premio: '', cobertura: '', notas: '' }
  const blankS: SinForm = { apolice: '', dataSinistro: today, tipo: 'agua', montante: '', descricao: '' }
  const [apolices, setApolices] = useState<Apolice[]>([])
  const [sinistros, setSinistros] = useState<Sinistro[]>([])
  const [openMod, setOpenMod] = useState<'apolice' | 'sinistro' | null>(null)
  const [formA, setFormA] = useState<ApForm>(blankA)
  const [formS, setFormS] = useState<SinForm>(blankS)
  const [errA, setErrA] = useState<Partial<Record<keyof ApForm, string>>>({})
  const [errS, setErrS] = useState<Partial<Record<keyof SinForm, string>>>({})
  const { push } = useToast()

  const updA = (k: keyof ApForm, v: string) => setFormA(s => { const next = { ...s, [k]: v }; if (k === 'dataInicio' && v) next.dataFim = yearLater(v); return next })
  const updS = (k: keyof SinForm, v: string) => setFormS(s => ({ ...s, [k]: v }))
  const openApolice = () => { setFormA(blankA); setErrA({}); setOpenMod('apolice') }
  const openSinistro = () => { setFormS(blankS); setErrS({}); setOpenMod('sinistro') }

  const submitApolice = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof ApForm, string>> = {}
    if (!formA.seguradora.trim()) errs.seguradora = 'Indique a seguradora.'
    if (!formA.numero.trim()) errs.numero = 'O nº da apólice é obrigatório.'
    if (!formA.edificio.trim()) errs.edificio = 'O edifício é obrigatório.'
    if (!formA.premio || Number(formA.premio) <= 0) errs.premio = 'Indique o prémio anual.'
    if (Object.keys(errs).length) { setErrA(errs); return }
    setApolices(prev => [...prev, { id: Date.now(), seguradora: formA.seguradora, numero: formA.numero, edificio: formA.edificio, dataInicio: formA.dataInicio, dataFim: formA.dataFim, premio: Number(formA.premio), cobertura: Number(formA.cobertura) || 0, notas: formA.notas, estado: 'ativa' }])
    setOpenMod(null)
    push({ kind: 'success', title: 'Apólice registada', desc: `${formA.seguradora} · ${formA.numero}` })
  }
  const submitSinistro = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof SinForm, string>> = {}
    if (!formS.descricao.trim()) errs.descricao = 'Descreva o sinistro.'
    if (!formS.montante || Number(formS.montante) <= 0) errs.montante = 'Indique o montante estimado.'
    if (Object.keys(errs).length) { setErrS(errs); return }
    setSinistros(prev => [...prev, { id: Date.now(), apolice: formS.apolice, dataSinistro: formS.dataSinistro, tipo: formS.tipo, montante: Number(formS.montante), descricao: formS.descricao, estado: 'aberto' }])
    setOpenMod(null)
    push({ kind: 'warning', title: 'Sinistro participado', desc: `${formS.tipo} · ${fmtEUR(Number(formS.montante))}` })
  }

  const ativas = apolices.filter(a => a.estado === 'ativa')
  const renovate = ativas.filter(a => { const days = (new Date(a.dataFim).getTime() - Date.now()) / 86400000; return days > 0 && days < 60 }).length
  const expired = apolices.filter(a => new Date(a.dataFim) < new Date()).length
  const premioAnual = ativas.reduce((s, a) => s + (a.premio || 0), 0)
  const sinistrosAbertos = sinistros.filter(s => s.estado === 'aberto').length
  const totalIndem = 0

  return (
    <>
      <PageHead title="Seguro Obrigatório de Condomínio" lede="Seguro contra incêndio obrigatório · Art.° 1429.° Código Civil · DL 268/94"
        actions={<><Button variant="gold" onClick={openApolice}><Icon name="plus" />+ Nova Apólice</Button><Button variant="danger" onClick={openSinistro}><Icon name="alert" />Participar Sinistro</Button></>} />
      <KPIGrid items={[
        { icon: 'shield', num: ativas.length, lbl: 'Apólices Ativas', accent: ativas.length ? 'gold' : undefined },
        { icon: 'clock', num: renovate, lbl: 'A Renovar (< 60 dias)', accent: renovate ? 'amber' : undefined },
        { icon: 'ban', num: expired, lbl: 'Expiradas', accent: expired ? 'rust' : undefined },
        { icon: 'coin', num: fmtEUR(premioAnual), lbl: 'Prémio Anual Total' },
        { icon: 'alert', num: sinistrosAbertos, lbl: 'Sinistros em Aberto', accent: sinistrosAbertos ? 'amber' : undefined },
        { icon: 'check', num: fmtEUR(totalIndem), lbl: 'Total Indemnizado', accent: 'sage' },
      ]} />
      <Tabs defaultActive="ap" tabs={[
        { id: 'ap', icon: 'shield', label: `Apólices (${apolices.length})` },
        { id: 'sn', icon: 'alert', label: `Sinistros (${sinistros.length})` },
      ]} />
      <Panel>
        {apolices.length === 0 ? (
          <Empty kind="gold" illustration="seguros" title="Nenhuma apólice registada" desc="O seguro contra incêndio é obrigatório para todos os edifícios em propriedade horizontal"
            action={<Button variant="primary" onClick={openApolice}><Icon name="plus" />+ Registar Apólice</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>Seguradora</th><th>Nº apólice</th><th>Edifício</th><th>Início</th><th>Fim</th><th>Prémio anual</th><th>Estado</th></tr></thead>
              <tbody>{apolices.map(a => (
                <tr key={a.id}>
                  <td>{a.seguradora}</td>
                  <td>{a.numero}</td>
                  <td>{a.edificio}</td>
                  <td>{a.dataInicio}</td>
                  <td>{a.dataFim}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(a.premio)}</td>
                  <td><Pill kind="sage">Ativa</Pill></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={openMod === 'apolice'} onClose={() => setOpenMod(null)} labelledBy="ap-modal-title" size="md">
        <ModalHead icon="shield" id="ap-modal-title" title="Nova apólice de seguro" onClose={() => setOpenMod(null)} />
        <form onSubmit={submitApolice} noValidate>
          <ModalBody>
            <FormRow>
              <Field label="Seguradora" required name="ap-seg" error={errA.seguradora}>
                <input type="text" placeholder="Fidelidade, Tranquilidade…" value={formA.seguradora} onChange={e => updA('seguradora', e.target.value)} />
              </Field>
              <Field label="Nº apólice" required name="ap-num" error={errA.numero}>
                <input type="text" placeholder="AP-2026-…" value={formA.numero} onChange={e => updA('numero', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Edifício" required full name="ap-edif" error={errA.edificio}>
              <input type="text" placeholder="Residência…" value={formA.edificio} onChange={e => updA('edificio', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Data início" required name="ap-ini">
                <input type="date" value={formA.dataInicio} onChange={e => updA('dataInicio', e.target.value)} />
              </Field>
              <Field label="Data fim" hint="Anual por defeito (+1 ano)" name="ap-fim">
                <input type="date" value={formA.dataFim} onChange={e => updA('dataFim', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Prémio anual" required suffix="€" name="ap-premio" error={errA.premio}>
                <input type="number" step="0.01" min="0" placeholder="0" value={formA.premio} onChange={e => updA('premio', e.target.value)} />
              </Field>
              <Field label="Cobertura mín." hint="Valor seguro" suffix="€" name="ap-cob">
                <input type="number" step="0.01" min="0" placeholder="0" value={formA.cobertura} onChange={e => updA('cobertura', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Notas" full name="ap-notas">
              <textarea rows={3} value={formA.notas} onChange={e => updA('notas', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpenMod(null)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)}>Registar apólice</button>
          </ModalFoot>
        </form>
      </Modal>

      <Modal open={openMod === 'sinistro'} onClose={() => setOpenMod(null)} labelledBy="sn-modal-title" size="md">
        <ModalHead icon="alert" id="sn-modal-title" title="Participar sinistro" onClose={() => setOpenMod(null)} />
        <form onSubmit={submitSinistro} noValidate>
          <ModalBody>
            <FormRow>
              <Field label="Apólice associada" name="sn-apol">
                <select value={formS.apolice} onChange={e => updS('apolice', e.target.value)}>
                  <option value="">— escolher —</option>
                  {apolices.map(a => <option key={a.id} value={a.numero}>{a.numero} ({a.seguradora})</option>)}
                </select>
              </Field>
              <Field label="Data do sinistro" name="sn-data">
                <input type="date" value={formS.dataSinistro} onChange={e => updS('dataSinistro', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Tipo de sinistro" name="sn-tipo">
                <select value={formS.tipo} onChange={e => updS('tipo', e.target.value)}>
                  <option value="incendio">Incêndio</option>
                  <option value="agua">Águas / inundação</option>
                  <option value="rouge">Roubo / vandalismo</option>
                  <option value="rc">Responsabilidade civil</option>
                  <option value="outros">Outros</option>
                </select>
              </Field>
              <Field label="Montante estimado" required suffix="€" name="sn-mont" error={errS.montante}>
                <input type="number" step="0.01" min="0" placeholder="0" value={formS.montante} onChange={e => updS('montante', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Descrição" required full name="sn-desc" error={errS.descricao}>
              <textarea rows={4} placeholder="Descreva os factos, danos e circunstâncias…" value={formS.descricao} onChange={e => updS('descricao', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpenMod(null)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.danger)}>Participar</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
