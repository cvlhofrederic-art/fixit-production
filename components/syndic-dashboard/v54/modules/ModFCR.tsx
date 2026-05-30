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

/** Fundo Comum de Reserva — port byte-exact du ModFCR du bundle V5.7 (stateful : 2 modals + Toast). */

type EdifForm = { nome: string; endereco: string; orcamentoAnual: string; percentagemFCR: number | string; saldoInicial: string }
type Edif = { id: number; nome: string; endereco: string; orcamentoAnual: number; percentagemFCR: number; saldoInicial: number }
type MovForm = { edificio: string; tipo: string; data: string; montante: string; descricao: string }
type Mov = { id: number; edificio: string; tipo: string; data: string; montante: number; descricao: string }

const fmtEUR = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)

export default function ModFCR() {
  const today = new Date().toISOString().slice(0, 10)
  const blankE: EdifForm = { nome: '', endereco: '', orcamentoAnual: '', percentagemFCR: 10, saldoInicial: '' }
  const blankM: MovForm = { edificio: '', tipo: 'entrada', data: today, montante: '', descricao: '' }
  const [edificios, setEdificios] = useState<Edif[]>([])
  const [movimentos, setMovimentos] = useState<Mov[]>([])
  const [openMod, setOpenMod] = useState<'edificio' | 'movimento' | null>(null)
  const [formE, setFormE] = useState<EdifForm>(blankE)
  const [formM, setFormM] = useState<MovForm>(blankM)
  const [errE, setErrE] = useState<Partial<Record<keyof EdifForm, string>>>({})
  const [errM, setErrM] = useState<Partial<Record<keyof MovForm, string>>>({})
  const { push } = useToast()

  const updE = (k: keyof EdifForm, v: string) => setFormE(s => ({ ...s, [k]: v }))
  const updM = (k: keyof MovForm, v: string) => setFormM(s => ({ ...s, [k]: v }))
  const openEdif = () => { setFormE(blankE); setErrE({}); setOpenMod('edificio') }
  const openMov = () => { setFormM(blankM); setErrM({}); setOpenMod('movimento') }

  const submitEdif = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof EdifForm, string>> = {}
    if (!formE.nome.trim()) errs.nome = 'O nome do edifício é obrigatório.'
    if (Number(formE.percentagemFCR) < 10) errs.percentagemFCR = 'O FCR não pode ser inferior a 10 % (DL 268/94 art. 4.°).'
    if (Object.keys(errs).length) { setErrE(errs); return }
    setEdificios(prev => [...prev, { id: Date.now(), nome: formE.nome, endereco: formE.endereco, orcamentoAnual: Number(formE.orcamentoAnual) || 0, percentagemFCR: Number(formE.percentagemFCR), saldoInicial: Number(formE.saldoInicial) || 0 }])
    setOpenMod(null)
    push({ kind: 'success', title: 'Edifício adicionado', desc: `${formE.nome} · FCR ${formE.percentagemFCR} %` })
  }
  const submitMov = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof MovForm, string>> = {}
    if (!formM.descricao.trim()) errs.descricao = 'Descreva o movimento.'
    if (!formM.montante || Number(formM.montante) <= 0) errs.montante = 'Indique o montante.'
    if (Object.keys(errs).length) { setErrM(errs); return }
    setMovimentos(prev => [...prev, { id: Date.now(), edificio: formM.edificio, tipo: formM.tipo, data: formM.data, montante: Number(formM.montante), descricao: formM.descricao }])
    setOpenMod(null)
    push({ kind: 'success', title: formM.tipo === 'entrada' ? 'Entrada registada' : 'Saída registada', desc: fmtEUR(Number(formM.montante)) })
  }

  const entradas = movimentos.filter(mv => mv.tipo === 'entrada').reduce((s, mv) => s + mv.montante, 0)
  const saidas = movimentos.filter(mv => mv.tipo === 'saida').reduce((s, mv) => s + mv.montante, 0)
  const saldoIni = edificios.reduce((s, e) => s + (e.saldoInicial || 0), 0)
  const saldoTotal = saldoIni + entradas - saidas
  const contribAnual = edificios.reduce((s, e) => s + ((e.orcamentoAnual || 0) * (e.percentagemFCR || 10) / 100), 0)
  const minFCRok = edificios.every(e => (e.percentagemFCR || 10) >= 10)

  return (
    <>
      <PageHead title="Fundo Comum de Reserva" lede="Mínimo legal 10% do orçamento anual · DL 268/94, Art.° 4.° · Código Civil Art.° 1424.°"
        actions={<><Button onClick={openEdif}><Icon name="building" />Novo Edifício</Button><Button variant="gold" onClick={openMov}><Icon name="plus" />+ Registar Movimento</Button></>} />
      <KPIGrid items={[
        { icon: 'bank', num: fmtEUR(saldoTotal), lbl: 'Saldo Total', accent: saldoTotal > 0 ? 'gold' : undefined },
        { icon: 'upload', num: fmtEUR(entradas), lbl: 'Total Entradas', accent: entradas ? 'sage' : undefined },
        { icon: 'download', num: fmtEUR(saidas), lbl: 'Total Saídas', accent: saidas ? 'rust' : undefined },
        { icon: 'building', num: edificios.length, lbl: 'Edifícios', accent: edificios.length ? 'gold' : undefined },
        { icon: 'coin', num: fmtEUR(contribAnual), lbl: 'Contribuição Anual Devida' },
        { icon: minFCRok ? 'check' : 'alert', num: minFCRok ? 'OK' : 'KO', lbl: 'Conformidade Legal', accent: minFCRok ? 'sage' : 'rust' },
      ]} />
      <Tabs defaultActive="vg" tabs={[
        { id: 'vg', icon: 'chart', label: `Visão Geral (${edificios.length})` },
        { id: 'mov', icon: 'clipboard', label: `Movimentos (${movimentos.length})` },
      ]} />
      <Panel>
        {edificios.length === 0 ? (
          <Empty illustration="condominos" title="Nenhum edifício configurado" desc="Registe os edifícios do seu portefólio para gerir o fundo comum de reserva"
            action={<Button variant="primary" onClick={openEdif}><Icon name="building" />Adicionar Edifício</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>Edifício</th><th>Endereço</th><th>Orçamento anual</th><th>FCR %</th><th>Saldo inicial</th><th>Conformidade</th></tr></thead>
              <tbody>{edificios.map(e => (
                <tr key={e.id}>
                  <td>{e.nome}</td>
                  <td>{e.endereco || '—'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(e.orcamentoAnual)}</td>
                  <td>{e.percentagemFCR} %</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(e.saldoInicial)}</td>
                  <td><Pill kind={e.percentagemFCR >= 10 ? 'sage' : 'rust'}>{e.percentagemFCR >= 10 ? 'Conforme' : 'Insuficiente'}</Pill></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={openMod === 'edificio'} onClose={() => setOpenMod(null)} labelledBy="fe-modal-title" size="md">
        <ModalHead icon="building" id="fe-modal-title" title="Adicionar edifício ao FCR" onClose={() => setOpenMod(null)} />
        <form onSubmit={submitEdif} noValidate>
          <ModalBody>
            <Field label="Nome do edifício" required full name="fe-nome" error={errE.nome}>
              <input type="text" placeholder="Residência Os Pinheiros" value={formE.nome} onChange={e => updE('nome', e.target.value)} />
            </Field>
            <Field label="Endereço" full name="fe-end">
              <input type="text" placeholder="Rua…" value={formE.endereco} onChange={e => updE('endereco', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Orçamento anual" suffix="€" name="fe-orc">
                <input type="number" step="0.01" min="0" placeholder="0" value={formE.orcamentoAnual} onChange={e => updE('orcamentoAnual', e.target.value)} />
              </Field>
              <Field label="% FCR" hint="Mín. legal 10 %" suffix="%" name="fe-pct" error={errE.percentagemFCR}>
                <input type="number" min="0" max="100" value={formE.percentagemFCR} onChange={e => updE('percentagemFCR', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Saldo inicial FCR" suffix="€" full name="fe-saldo">
              <input type="number" step="0.01" placeholder="0" value={formE.saldoInicial} onChange={e => updE('saldoInicial', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpenMod(null)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)}>Adicionar edifício</button>
          </ModalFoot>
        </form>
      </Modal>

      <Modal open={openMod === 'movimento'} onClose={() => setOpenMod(null)} labelledBy="fm-modal-title" size="md">
        <ModalHead icon="coin" id="fm-modal-title" title="Registar movimento no FCR" onClose={() => setOpenMod(null)} />
        <form onSubmit={submitMov} noValidate>
          <ModalBody>
            <FormRow>
              <Field label="Tipo" name="fm-tipo">
                <select value={formM.tipo} onChange={e => updM('tipo', e.target.value)}>
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                </select>
              </Field>
              <Field label="Data" name="fm-data">
                <input type="date" value={formM.data} onChange={e => updM('data', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Edifício" full name="fm-edif">
              <select value={formM.edificio} onChange={e => updM('edificio', e.target.value)}>
                <option value="">— escolher edifício —</option>
                {edificios.map(e => <option key={e.id} value={e.nome}>{e.nome}</option>)}
              </select>
            </Field>
            <Field label="Montante" required suffix="€" full name="fm-mont" error={errM.montante}>
              <input type="number" step="0.01" min="0" placeholder="0" value={formM.montante} onChange={e => updM('montante', e.target.value)} />
            </Field>
            <Field label="Descrição" required full name="fm-desc" error={errM.descricao}>
              <textarea rows={3} placeholder="Origem do movimento, justificação…" value={formM.descricao} onChange={e => updM('descricao', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpenMod(null)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)}>Registar</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
