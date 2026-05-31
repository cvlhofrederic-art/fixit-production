'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { Tabs } from '../primitives/tabs'
import { KPI } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Alert } from '../primitives/alert'
import { Pill } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import btnCss from '../primitives/button/Button.module.css'
import kpiCss from '../primitives/kpi/KPI.module.css'
import m from './modules.module.css'

/** Contabilidade Condomínio — port byte-exact du ModContabCond du bundle V5.7 (stateful : 7 onglets + 4 modals). */

type Frac = { id: number; identificacao: string; permilagem: number; proprietario: string; tipo: string; notas: string }
type Chamada = { id: number; titulo: string; edificio: string; dataEmissao: string; dataVencimento: string; montante: number; distribuicao: string; notas: string; liquidadas: number }
type Diar = { id: number; data: string; tipo: string; conta: string; montante: number; descricao: string }
type Orc = { id: number; ano: string; edificio: string; totalPrevisto: number; rubricas: string; notas: string; aprovado: boolean }
type FracForm = { identificacao: string; permilagem: string; proprietario: string; tipo: string; notas: string }
type ChamForm = { titulo: string; edificio: string; dataEmissao: string; dataVencimento: string; montante: string; distribuicao: string; notas: string }
type DiarForm = { data: string; tipo: string; conta: string; montante: string; descricao: string }
type OrcForm = { ano: string; edificio: string; totalPrevisto: string; rubricas: string; notas: string }

const fmtEUR = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)
const eur = (n: number) => fmtEUR(n).replace('€', '').trim()
const euroSup = <span style={{ fontSize: 22, fontStyle: 'italic', color: 'var(--v54-gold-700)', marginLeft: 4 }}>€</span>
const fracTipo = (t: string) => (t === 'habitacao' ? 'Habitação' : t === 'comercio' ? 'Comércio' : t === 'garagem' ? 'Garagem' : 'Arrecadação')
const CHECKLIST = ['Verificação do balancete geral', 'Reconciliação bancária efetuada', 'Todas as chamadas de quotas liquidadas', 'Mapa de repartição por milésimos verificado', 'Validação do orçamento previsional N+1', 'Preparação do relatório para a AG anual', 'Exportação dos documentos contabilísticos', 'Arquivo dos documentos (10 anos)']
const RELS: [IconName, string, string][] = [
  ['coin', 'Relatório financeiro anual', 'Balanço contabilístico, encargos por rubrica, comparativo N/N-1'],
  ['home', 'Mapa de encargos por fração', 'Repartição por milésimos para cada condómino'],
  ['clipboard', 'Orçamento previsional N+1', 'Propostas de orçamento para o próximo exercício'],
  ['mail', 'Chamadas de quotas — resumo', 'Todas as chamadas enviadas e o seu estado de pagamento'],
  ['construction', 'Fundo de reserva (art. 4° DL 268/94)', 'Estado do fundo de reserva obrigatório'],
  ['doc', 'Contratos em vigor', 'Lista dos contratos de manutenção e prestadores'],
]

export default function ModContabCond() {
  const today = new Date().toISOString().slice(0, 10)
  const [activeTab, setActiveTab] = useState('painel')
  const [fracoes, setFracoes] = useState<Frac[]>([])
  const [chamadas, setChamadas] = useState<Chamada[]>([])
  const [diario, setDiario] = useState<Diar[]>([])
  const [orcamentos, setOrcamentos] = useState<Orc[]>([])
  const [openMod, setOpenMod] = useState<'frac' | 'cq' | 'diar' | 'orc' | null>(null)
  const { push } = useToast()

  const [formF, setFormF] = useState<FracForm>({ identificacao: '', permilagem: '', proprietario: '', tipo: 'habitacao', notas: '' })
  const [errF, setErrF] = useState<Partial<Record<keyof FracForm, string>>>({})
  const openFrac = () => { setFormF({ identificacao: '', permilagem: '', proprietario: '', tipo: 'habitacao', notas: '' }); setErrF({}); setOpenMod('frac') }
  const submitFrac = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof FracForm, string>> = {}
    if (!formF.identificacao.trim()) errs.identificacao = 'A identificação é obrigatória.'
    if (!formF.permilagem || Number(formF.permilagem) <= 0) errs.permilagem = 'Indique a permilagem.'
    if (Object.keys(errs).length) { setErrF(errs); return }
    setFracoes(prev => [...prev, { id: Date.now(), identificacao: formF.identificacao, permilagem: Number(formF.permilagem), proprietario: formF.proprietario, tipo: formF.tipo, notas: formF.notas }])
    setOpenMod(null)
    push({ kind: 'success', title: 'Fração adicionada', desc: `${formF.identificacao} · ${formF.permilagem} milésimos` })
  }

  const [formC, setFormC] = useState<ChamForm>({ titulo: '', edificio: '', dataEmissao: today, dataVencimento: '', montante: '', distribuicao: 'milesimos', notas: '' })
  const [errC, setErrC] = useState<Partial<Record<keyof ChamForm, string>>>({})
  const openCham = () => { setFormC({ titulo: '', edificio: '', dataEmissao: today, dataVencimento: '', montante: '', distribuicao: 'milesimos', notas: '' }); setErrC({}); setOpenMod('cq') }
  const submitCham = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof ChamForm, string>> = {}
    if (!formC.titulo.trim()) errs.titulo = 'O título é obrigatório.'
    if (!formC.dataVencimento) errs.dataVencimento = 'A data de vencimento é obrigatória.'
    if (!formC.montante || Number(formC.montante) <= 0) errs.montante = 'Indique o montante total.'
    if (Object.keys(errs).length) { setErrC(errs); return }
    setChamadas(prev => [...prev, { id: Date.now(), titulo: formC.titulo, edificio: formC.edificio, dataEmissao: formC.dataEmissao, dataVencimento: formC.dataVencimento, montante: Number(formC.montante), distribuicao: formC.distribuicao, notas: formC.notas, liquidadas: 0 }])
    setOpenMod(null)
    push({ kind: 'success', title: 'Chamada de quotas criada', desc: formC.titulo })
  }

  const [formD, setFormD] = useState<DiarForm>({ data: today, tipo: 'debito', conta: '', montante: '', descricao: '' })
  const [errD, setErrD] = useState<Partial<Record<keyof DiarForm, string>>>({})
  const openDiar = () => { setFormD({ data: today, tipo: 'debito', conta: '', montante: '', descricao: '' }); setErrD({}); setOpenMod('diar') }
  const submitDiar = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof DiarForm, string>> = {}
    if (!formD.conta.trim()) errs.conta = 'Indique a conta SNC.'
    if (!formD.descricao.trim()) errs.descricao = 'Descreva o lançamento.'
    if (!formD.montante || Number(formD.montante) <= 0) errs.montante = 'Indique o montante.'
    if (Object.keys(errs).length) { setErrD(errs); return }
    setDiario(prev => [...prev, { id: Date.now(), data: formD.data, tipo: formD.tipo, conta: formD.conta, montante: Number(formD.montante), descricao: formD.descricao }])
    setOpenMod(null)
    push({ kind: 'success', title: 'Lançamento registado', desc: `${formD.conta} · ${fmtEUR(Number(formD.montante))}` })
  }

  const [formO, setFormO] = useState<OrcForm>({ ano: String(new Date().getFullYear() + 1), edificio: '', totalPrevisto: '', rubricas: '', notas: '' })
  const [errO, setErrO] = useState<Partial<Record<keyof OrcForm, string>>>({})
  const openOrc = () => { setFormO({ ano: String(new Date().getFullYear() + 1), edificio: '', totalPrevisto: '', rubricas: '', notas: '' }); setErrO({}); setOpenMod('orc') }
  const submitOrc = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof OrcForm, string>> = {}
    if (!formO.ano || formO.ano.length !== 4) errs.ano = 'Indique o ano (formato AAAA).'
    if (!formO.totalPrevisto || Number(formO.totalPrevisto) <= 0) errs.totalPrevisto = 'Indique o total previsto.'
    if (Object.keys(errs).length) { setErrO(errs); return }
    setOrcamentos(prev => [...prev, { id: Date.now(), ano: formO.ano, edificio: formO.edificio, totalPrevisto: Number(formO.totalPrevisto), rubricas: formO.rubricas, notas: formO.notas, aprovado: false }])
    setOpenMod(null)
    push({ kind: 'success', title: 'Orçamento criado', desc: `Ano ${formO.ano} · ${fmtEUR(Number(formO.totalPrevisto))}` })
  }

  const totalMilesimos = fracoes.reduce((s, f) => s + (f.permilagem || 0), 0)
  const totalCreditos = diario.filter(d => d.tipo === 'credito').reduce((s, d) => s + d.montante, 0)
  const totalDebitos = diario.filter(d => d.tipo === 'debito').reduce((s, d) => s + d.montante, 0)
  const saldoTesouraria = totalCreditos - totalDebitos
  const chamadasEnviadas = chamadas.length
  const chamadasLiquidadas = chamadas.filter(c => c.liquidadas > 0).length

  return (
    <>
      <PageHead title="Contabilidade Condomínio" lede="Ferramentas profissionais de contabilidade para administradores de condomínios" />
      <Tabs active={activeTab} onChange={setActiveTab} tabs={[
        { id: 'painel', label: 'Painel de controlo' },
        { id: 'frac', label: `Frações & Permilagem (${fracoes.length})` },
        { id: 'cq', label: `Chamadas de quotas (${chamadas.length})` },
        { id: 'diar', label: `Diário contabilístico (${diario.length})` },
        { id: 'orc', label: `Orçamento previsional (${orcamentos.length})` },
        { id: 'enc', label: 'Encerramento exercício' },
        { id: 'rel', label: 'Relatórios AG' },
      ]} />

      {activeTab === 'painel' && (<>
        <div className={kpiCss.kpiGrid} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <KPI num={fracoes.length} lbl="Frações geridas" sub={`${totalMilesimos} milésimos`} />
          <KPI num={chamadasEnviadas} lbl="Chamadas de quotas" accent={chamadasEnviadas ? 'gold' : undefined} sub={`${chamadasEnviadas} enviadas · ${chamadasLiquidadas} liquidadas`} />
          <KPI icon="coin" accent="sage" num={eur(totalCreditos)} numChildren={euroSup} lbl="Total créditos" sub="recebimentos" />
          <KPI icon="bank" accent={saldoTesouraria >= 0 ? 'sage' : 'rust'} num={eur(saldoTesouraria)} numChildren={euroSup} lbl="Saldo tesouraria" sub={`${fmtEUR(totalDebitos)} débitos`} />
        </div>
        <div className={m.cardGrid} style={{ marginTop: 16 }}>
          <Panel title="Últimas chamadas de quotas">
            {chamadas.length === 0 ? <Empty illustration="pagamentos" title="Nenhuma chamada de quotas" />
              : <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>{chamadas.slice(-5).reverse().map(c => (
                <li key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--v54-line)', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{c.titulo}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(c.montante)}</span>
                </li>
              ))}</ul>}
          </Panel>
          <Panel title="Últimos lançamentos">
            {diario.length === 0 ? <Empty illustration="faturas" title="Nenhum lançamento contabilístico" />
              : <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>{diario.slice(-5).reverse().map(d => (
                <li key={d.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--v54-line)', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{d.conta} — {d.descricao}</span><span style={{ fontVariantNumeric: 'tabular-nums', color: d.tipo === 'credito' ? 'var(--v54-sage-700)' : 'var(--v54-rust-700)' }}>{d.tipo === 'credito' ? '+' : '−'}{fmtEUR(d.montante)}</span>
                </li>
              ))}</ul>}
          </Panel>
        </div>
        {fracoes.length === 0 && <Alert title="Pontos de atenção">• Nenhuma fração registada — comece por adicionar as frações do condomínio</Alert>}
      </>)}

      {activeTab === 'frac' && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 12 }}>
          <div><h3 style={{ margin: 0, fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500 }}>Frações & Permilagem</h3>
            <div style={{ fontSize: 12, color: 'var(--v54-navy-500)', marginTop: 4 }}>Total : {totalMilesimos} / 10 000 milésimos · {fracoes.length} frações</div>
          </div>
          <Button variant="gold" onClick={openFrac}><Icon name="plus" />+ Adicionar fração</Button>
        </div>
        <Panel>
          {fracoes.length === 0 ? (
            <Empty illustration="condominos" title="Nenhuma fração" desc="Comece por registar as frações do seu condomínio"
              action={<Button variant="primary" onClick={openFrac}><Icon name="plus" />+ Adicionar a primeira fração</Button>} />
          ) : (
            <div className={m.tblWrap}>
              <table className={m.tbl}>
                <thead><tr><th>Identificação</th><th>Tipo</th><th>Permilagem</th><th>Proprietário</th></tr></thead>
                <tbody>{fracoes.map(f => (
                  <tr key={f.id}><td>{f.identificacao}</td><td>{fracTipo(f.tipo)}</td><td style={{ fontVariantNumeric: 'tabular-nums' }}>{f.permilagem}</td><td>{f.proprietario || '—'}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Panel>
      </>)}

      {activeTab === 'cq' && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500 }}>Chamadas de quotas</h3>
          <Button variant="gold" onClick={openCham}><Icon name="plus" />+ Nova chamada</Button>
        </div>
        <Panel>
          {chamadas.length === 0 ? (
            <Empty illustration="pagamentos" title="Nenhuma chamada de quotas" desc="Crie as suas chamadas de quotas trimestrais ou mensais"
              action={<Button variant="primary" onClick={openCham}><Icon name="plus" />+ Criar a primeira chamada</Button>} />
          ) : (
            <div className={m.tblWrap}>
              <table className={m.tbl}>
                <thead><tr><th>Título</th><th>Edifício</th><th>Emissão</th><th>Vencimento</th><th>Montante</th><th>Liquidadas</th></tr></thead>
                <tbody>{chamadas.map(c => (
                  <tr key={c.id}><td>{c.titulo}</td><td>{c.edificio || '—'}</td><td>{c.dataEmissao}</td><td>{c.dataVencimento}</td><td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(c.montante)}</td><td>{c.liquidadas} / {fracoes.length || '?'}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Panel>
      </>)}

      {activeTab === 'diar' && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 12 }}>
          <div><h3 style={{ margin: 0, fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500 }}>Diário contabilístico</h3>
            <div style={{ fontSize: 12, color: 'var(--v54-navy-500)', marginTop: 4 }}>Saldo : {fmtEUR(saldoTesouraria)}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button><Icon name="download" />Exportar CSV</Button>
            <Button variant="gold" onClick={openDiar}><Icon name="plus" />+ Lançamento</Button>
          </div>
        </div>
        <div className={kpiCss.kpiGrid} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <KPI num={fmtEUR(totalDebitos)} lbl="Total débitos" accent={totalDebitos ? 'rust' : undefined} />
          <KPI num={fmtEUR(totalCreditos)} lbl="Total créditos" accent={totalCreditos ? 'sage' : undefined} />
          <KPI num={fmtEUR(saldoTesouraria)} lbl="Saldo" accent={saldoTesouraria > 0 ? 'sage' : saldoTesouraria < 0 ? 'rust' : undefined} />
          <KPI num={diario.length} lbl="Lançamentos" />
        </div>
        <Panel>
          {diario.length === 0 ? (
            <Empty illustration="faturas" title="Diário vazio" desc="Comece a introduzir os seus lançamentos contabilísticos"
              action={<Button variant="primary" onClick={openDiar}><Icon name="plus" />+ Primeiro lançamento</Button>} />
          ) : (
            <div className={m.tblWrap}>
              <table className={m.tbl}>
                <thead><tr><th>Data</th><th>Conta</th><th>Descrição</th><th>Tipo</th><th>Montante</th></tr></thead>
                <tbody>{diario.map(d => (
                  <tr key={d.id}><td>{d.data}</td><td>{d.conta}</td><td>{d.descricao}</td><td><Pill kind={d.tipo === 'credito' ? 'sage' : 'rust'}>{d.tipo === 'credito' ? 'Crédito' : 'Débito'}</Pill></td><td style={{ fontVariantNumeric: 'tabular-nums', color: d.tipo === 'credito' ? 'var(--v54-sage-700)' : 'var(--v54-rust-700)' }}>{d.tipo === 'credito' ? '+' : '−'}{fmtEUR(d.montante)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Panel>
      </>)}

      {activeTab === 'orc' && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500 }}>Orçamento previsional</h3>
          <Button variant="gold" onClick={openOrc}><Icon name="plus" />+ Novo orçamento</Button>
        </div>
        <Panel>
          {orcamentos.length === 0 ? (
            <Empty illustration="documentos" title="Nenhum orçamento" desc="Crie o orçamento previsional do seu condomínio"
              action={<Button variant="primary" onClick={openOrc}><Icon name="plus" />+ Criar um orçamento</Button>} />
          ) : (
            <div className={m.tblWrap}>
              <table className={m.tbl}>
                <thead><tr><th>Ano</th><th>Edifício</th><th>Total previsto</th><th>Estado</th></tr></thead>
                <tbody>{orcamentos.map(o => (
                  <tr key={o.id}><td>{o.ano}</td><td>{o.edificio || '—'}</td><td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(o.totalPrevisto)}</td><td><Pill kind={o.aprovado ? 'sage' : 'amber'}>{o.aprovado ? 'Aprovado em AG' : 'Aguarda AG'}</Pill></td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Panel>
      </>)}

      {activeTab === 'enc' && (<>
        <h3 style={{ margin: '16px 0 12px', fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500 }}>Encerramento de exercício</h3>
        <Panel title="Checklist de encerramento anual">
          <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>{CHECKLIST.map((step, i) => (
            <li key={i} style={{ padding: '14px 16px', marginBottom: 8, background: 'var(--v54-cream)', borderRadius: 10, display: 'flex', gap: 14, alignItems: 'center', fontSize: 13 }}>
              <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--v54-paper)', border: '1px solid var(--v54-line)', display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 12, color: 'var(--v54-gold-700)' }}>{i + 1}</span>
              <span style={{ flex: 1 }}>{step}</span>
            </li>
          ))}</ol>
        </Panel>
      </>)}

      {activeTab === 'rel' && (<>
        <h3 style={{ margin: '16px 0 12px', fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500 }}>Relatórios para a Assembleia Geral</h3>
        <Panel>
          {RELS.map(([ic, t, d], i) => (
            <div key={i} style={{ padding: 14, marginBottom: 8, display: 'flex', gap: 14, alignItems: 'center', border: '1px solid var(--v54-line)', borderRadius: 10, background: 'var(--v54-gold-50)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fff', display: 'grid', placeItems: 'center', color: 'var(--v54-gold-700)' }}><Icon name={ic} /></div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{t}</div><div style={{ fontSize: 11.5, color: 'var(--v54-navy-500)' }}>{d}</div></div>
              <Button size="sm" onClick={() => push({ kind: 'info', title: 'Pré-visualização', desc: t })}><Icon name="eye" />Pré-visualizar</Button>
              <Button size="sm" variant="gold" onClick={() => push({ kind: 'info', title: 'PDF gerado', desc: t })}><Icon name="download" />PDF</Button>
            </div>
          ))}
        </Panel>
      </>)}

      <Modal open={openMod === 'frac'} onClose={() => setOpenMod(null)} labelledBy="cc-frac-title" size="md">
        <ModalHead icon="home" id="cc-frac-title" title="Adicionar fração" onClose={() => setOpenMod(null)} />
        <form onSubmit={submitFrac} noValidate>
          <ModalBody>
            <FormRow>
              <Field label="Identificação" required name="cc-frac-id" error={errF.identificacao}>
                <input type="text" placeholder="Apt 3.° E" value={formF.identificacao} onChange={e => setFormF({ ...formF, identificacao: e.target.value })} />
              </Field>
              <Field label="Tipo" name="cc-frac-tipo">
                <select value={formF.tipo} onChange={e => setFormF({ ...formF, tipo: e.target.value })}>
                  <option value="habitacao">Habitação</option>
                  <option value="comercio">Comércio</option>
                  <option value="garagem">Garagem</option>
                  <option value="arrecadacao">Arrecadação</option>
                </select>
              </Field>
            </FormRow>
            <Field label="Permilagem" required hint="Total deve somar 10 000 milésimos" full name="cc-frac-perm" error={errF.permilagem}>
              <input type="number" min="0" max="10000" placeholder="0" value={formF.permilagem} onChange={e => setFormF({ ...formF, permilagem: e.target.value })} />
            </Field>
            <Field label="Proprietário" full name="cc-frac-prop">
              <input type="text" placeholder="Nome do proprietário" value={formF.proprietario} onChange={e => setFormF({ ...formF, proprietario: e.target.value })} />
            </Field>
            <Field label="Notas" full name="cc-frac-notas">
              <textarea rows={2} value={formF.notas} onChange={e => setFormF({ ...formF, notas: e.target.value })} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpenMod(null)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)}>Adicionar</button>
          </ModalFoot>
        </form>
      </Modal>

      <Modal open={openMod === 'cq'} onClose={() => setOpenMod(null)} labelledBy="cc-cq-title" size="md">
        <ModalHead icon="mail" id="cc-cq-title" title="Nova chamada de quotas" onClose={() => setOpenMod(null)} />
        <form onSubmit={submitCham} noValidate>
          <ModalBody>
            <Field label="Título" required full name="cc-cq-tit" error={errC.titulo}>
              <input type="text" placeholder="Q1 2026 — Quotas trimestrais" value={formC.titulo} onChange={e => setFormC({ ...formC, titulo: e.target.value })} />
            </Field>
            <Field label="Edifício" full name="cc-cq-edif">
              <input type="text" placeholder="Residência…" value={formC.edificio} onChange={e => setFormC({ ...formC, edificio: e.target.value })} />
            </Field>
            <FormRow>
              <Field label="Data de emissão" name="cc-cq-emit">
                <input type="date" value={formC.dataEmissao} onChange={e => setFormC({ ...formC, dataEmissao: e.target.value })} />
              </Field>
              <Field label="Data de vencimento" required name="cc-cq-venc" error={errC.dataVencimento}>
                <input type="date" value={formC.dataVencimento} onChange={e => setFormC({ ...formC, dataVencimento: e.target.value })} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Montante total" required suffix="€" name="cc-cq-mont" error={errC.montante}>
                <input type="number" step="0.01" min="0" placeholder="0" value={formC.montante} onChange={e => setFormC({ ...formC, montante: e.target.value })} />
              </Field>
              <Field label="Distribuição" name="cc-cq-dist">
                <select value={formC.distribuicao} onChange={e => setFormC({ ...formC, distribuicao: e.target.value })}>
                  <option value="milesimos">Por milésimos</option>
                  <option value="igualitaria">Igualitária</option>
                </select>
              </Field>
            </FormRow>
            <Field label="Notas" full name="cc-cq-notas">
              <textarea rows={2} value={formC.notas} onChange={e => setFormC({ ...formC, notas: e.target.value })} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpenMod(null)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)}>Criar chamada</button>
          </ModalFoot>
        </form>
      </Modal>

      <Modal open={openMod === 'diar'} onClose={() => setOpenMod(null)} labelledBy="cc-diar-title" size="md">
        <ModalHead icon="book" id="cc-diar-title" title="Novo lançamento contabilístico" onClose={() => setOpenMod(null)} />
        <form onSubmit={submitDiar} noValidate>
          <ModalBody>
            <FormRow>
              <Field label="Data" name="cc-d-data">
                <input type="date" value={formD.data} onChange={e => setFormD({ ...formD, data: e.target.value })} />
              </Field>
              <Field label="Tipo" name="cc-d-tipo">
                <select value={formD.tipo} onChange={e => setFormD({ ...formD, tipo: e.target.value })}>
                  <option value="debito">Débito</option>
                  <option value="credito">Crédito</option>
                </select>
              </Field>
            </FormRow>
            <Field label="Conta SNC" required full hint="Ex.: 62.21 (Fornecimentos serviços externos)" name="cc-d-conta" error={errD.conta}>
              <input type="text" placeholder="62.21" value={formD.conta} onChange={e => setFormD({ ...formD, conta: e.target.value })} />
            </Field>
            <Field label="Descrição" required full name="cc-d-desc" error={errD.descricao}>
              <input type="text" placeholder="Manutenção elevador 03/2026" value={formD.descricao} onChange={e => setFormD({ ...formD, descricao: e.target.value })} />
            </Field>
            <Field label="Montante" required suffix="€" full name="cc-d-mont" error={errD.montante}>
              <input type="number" step="0.01" min="0" placeholder="0" value={formD.montante} onChange={e => setFormD({ ...formD, montante: e.target.value })} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpenMod(null)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)}>Registar</button>
          </ModalFoot>
        </form>
      </Modal>

      <Modal open={openMod === 'orc'} onClose={() => setOpenMod(null)} labelledBy="cc-orc-title" size="md">
        <ModalHead icon="clipboard" id="cc-orc-title" title="Novo orçamento previsional" onClose={() => setOpenMod(null)} />
        <form onSubmit={submitOrc} noValidate>
          <ModalBody>
            <FormRow>
              <Field label="Ano" required name="cc-o-ano" error={errO.ano}>
                <input type="number" min="2020" max="2099" value={formO.ano} onChange={e => setFormO({ ...formO, ano: e.target.value })} />
              </Field>
              <Field label="Edifício" name="cc-o-edif">
                <input type="text" placeholder="Residência…" value={formO.edificio} onChange={e => setFormO({ ...formO, edificio: e.target.value })} />
              </Field>
            </FormRow>
            <Field label="Total previsto" required suffix="€" full name="cc-o-tot" error={errO.totalPrevisto}>
              <input type="number" step="0.01" min="0" placeholder="0" value={formO.totalPrevisto} onChange={e => setFormO({ ...formO, totalPrevisto: e.target.value })} />
            </Field>
            <Field label="Rúbricas" hint="Uma rubrica por linha" full name="cc-o-rub">
              <textarea rows={4} placeholder={'Manutenção corrente: 8 000\nLimpeza áreas comuns: 4 800\nSeguro do edifício: 1 200\nFundo de reserva (10 %): X €'} value={formO.rubricas} onChange={e => setFormO({ ...formO, rubricas: e.target.value })} />
            </Field>
            <Field label="Notas" full name="cc-o-notas">
              <textarea rows={2} value={formO.notas} onChange={e => setFormO({ ...formO, notas: e.target.value })} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpenMod(null)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)}>Criar orçamento</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
