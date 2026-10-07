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
import { downloadCsv } from '@/lib/syndic/v54/export-csv'
import btnCss from '../primitives/button/Button.module.css'
import kpiCss from '../primitives/kpi/KPI.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { CONTAB_COND_MESSAGES, type TypeLot } from './i18n/ModContabCond.messages'

/** Contabilidade Condomínio — port byte-exact V5.7 + Phase 3 : 4 entités réelles (route /api/syndic/contab).
 * Syndic connecté → vraies données du cabinet (data.contab) + création POST ; anonyme → preview byte-exact. */

type FracForm = { identificacao: string; permilagem: string; proprietario: string; tipo: string; notas: string }
type ChamForm = { titulo: string; edificio: string; dataEmissao: string; dataVencimento: string; montante: string; distribuicao: string; notas: string }
type DiarForm = { data: string; tipo: string; conta: string; montante: string; descricao: string }
type OrcForm = { ano: string; edificio: string; totalPrevisto: string; rubricas: string; notas: string }

const fmtEUR = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)
const eur = (n: number, locale: V54Locale) => fmtEUR(n, locale).replace('€', '').trim()
const euroSup = <span style={{ fontSize: 22, fontStyle: 'italic', color: 'var(--v54-gold-700)', marginLeft: 4 }}>€</span>
/** Type de lot de l'API → code du libellé (tout type inconnu s'affiche comme « arrecadacao », comme avant). */
const fracTipo = (tp: string): TypeLot => (tp === 'habitacao' || tp === 'comercio' || tp === 'garagem' ? tp : 'arrecadacao')

export default function ModContabCond() {
  const t = useMessages(CONTAB_COND_MESSAGES)
  const locale = useV54Locale()
  // Phase 3 : vraies données comptables du cabinet si syndic connecté, sinon preview vide.
  const data = useSyndicData()
  const real = data.authenticated
  const fracoes = real ? (data.contab?.fracoes ?? []) : []
  const chamadas = real ? (data.contab?.chamadas ?? []) : []
  const diario = real ? (data.contab?.diario ?? []) : []
  const orcamentos = real ? (data.contab?.orcamentos ?? []) : []

  const today = new Date().toISOString().slice(0, 10)
  const [busy, setBusy] = useState(false)
  const [activeTab, setActiveTab] = useState('painel')
  const [openMod, setOpenMod] = useState<'frac' | 'cq' | 'diar' | 'orc' | null>(null)
  const { push } = useToast()

  // Création : POST /api/syndic/contab (route consolidée, discriminée par `entity`).
  const postContab = (payload: Record<string, unknown>, okTitle: string, okDesc: string) => {
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/contab', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` }, body: JSON.stringify(payload) })
        .then(r => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpenMod(null); push({ kind: 'success', title: okTitle, desc: okDesc }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurEnregistrement, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpenMod(null)
    push({ kind: 'info', title: t.toasts.demo(okTitle), desc: t.toasts.connexionRequise })
  }

  const [formF, setFormF] = useState<FracForm>({ identificacao: '', permilagem: '', proprietario: '', tipo: 'habitacao', notas: '' })
  const [errF, setErrF] = useState<Partial<Record<keyof FracForm, string>>>({})
  const openFrac = () => { setFormF({ identificacao: '', permilagem: '', proprietario: '', tipo: 'habitacao', notas: '' }); setErrF({}); setOpenMod('frac') }
  const submitFrac = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof FracForm, string>> = {}
    if (!formF.identificacao.trim()) errs.identificacao = t.erreurs.identification
    if (!formF.permilagem || Number(formF.permilagem) <= 0) errs.permilagem = t.erreurs.tantiemes
    if (Object.keys(errs).length) { setErrF(errs); return }
    postContab({ entity: 'frac', identificacao: formF.identificacao, permilagem: Number(formF.permilagem) || 0, proprietario: formF.proprietario, tipo: formF.tipo, notas: formF.notas }, t.toasts.lotAjoute, t.toasts.lotAjouteDesc(formF.identificacao, formF.permilagem))
  }

  const [formC, setFormC] = useState<ChamForm>({ titulo: '', edificio: '', dataEmissao: today, dataVencimento: '', montante: '', distribuicao: 'milesimos', notas: '' })
  const [errC, setErrC] = useState<Partial<Record<keyof ChamForm, string>>>({})
  const openCham = () => { setFormC({ titulo: '', edificio: '', dataEmissao: today, dataVencimento: '', montante: '', distribuicao: 'milesimos', notas: '' }); setErrC({}); setOpenMod('cq') }
  const submitCham = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof ChamForm, string>> = {}
    if (!formC.titulo.trim()) errs.titulo = t.erreurs.intitule
    if (!formC.dataVencimento) errs.dataVencimento = t.erreurs.dateEcheance
    if (!formC.montante || Number(formC.montante) <= 0) errs.montante = t.erreurs.montantTotal
    if (Object.keys(errs).length) { setErrC(errs); return }
    postContab({ entity: 'cham', titulo: formC.titulo, edificio: formC.edificio, dataEmissao: formC.dataEmissao, dataVencimento: formC.dataVencimento, montante: Number(formC.montante) || 0, distribuicao: formC.distribuicao, notas: formC.notas }, t.toasts.appelCree, formC.titulo)
  }

  const [formD, setFormD] = useState<DiarForm>({ data: today, tipo: 'debito', conta: '', montante: '', descricao: '' })
  const [errD, setErrD] = useState<Partial<Record<keyof DiarForm, string>>>({})
  const openDiar = () => { setFormD({ data: today, tipo: 'debito', conta: '', montante: '', descricao: '' }); setErrD({}); setOpenMod('diar') }
  const submitDiar = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof DiarForm, string>> = {}
    if (!formD.conta.trim()) errs.conta = t.erreurs.compte
    if (!formD.descricao.trim()) errs.descricao = t.erreurs.libelle
    if (!formD.montante || Number(formD.montante) <= 0) errs.montante = t.erreurs.montant
    if (Object.keys(errs).length) { setErrD(errs); return }
    postContab({ entity: 'diar', data: formD.data, tipo: formD.tipo, conta: formD.conta, montante: Number(formD.montante) || 0, descricao: formD.descricao }, t.toasts.ecritureEnregistree, `${formD.conta} · ${fmtEUR(Number(formD.montante), locale)}`)
  }

  const [formO, setFormO] = useState<OrcForm>({ ano: String(new Date().getFullYear() + 1), edificio: '', totalPrevisto: '', rubricas: '', notas: '' })
  const [errO, setErrO] = useState<Partial<Record<keyof OrcForm, string>>>({})
  const openOrc = () => { setFormO({ ano: String(new Date().getFullYear() + 1), edificio: '', totalPrevisto: '', rubricas: '', notas: '' }); setErrO({}); setOpenMod('orc') }
  const submitOrc = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof OrcForm, string>> = {}
    if (!formO.ano || formO.ano.length !== 4) errs.ano = t.erreurs.exercice
    if (!formO.totalPrevisto || Number(formO.totalPrevisto) <= 0) errs.totalPrevisto = t.erreurs.totalPrevu
    if (Object.keys(errs).length) { setErrO(errs); return }
    postContab({ entity: 'orc', ano: formO.ano, edificio: formO.edificio, totalPrevisto: Number(formO.totalPrevisto) || 0, rubricas: formO.rubricas, notas: formO.notas }, t.toasts.budgetCree, t.toasts.budgetCreeDesc(formO.ano, fmtEUR(Number(formO.totalPrevisto), locale)))
  }

  const totalMilesimos = fracoes.reduce((s, f) => s + (f.permilagem || 0), 0)
  const totalCreditos = diario.filter(d => d.tipo === 'credito').reduce((s, d) => s + d.montante, 0)
  const totalDebitos = diario.filter(d => d.tipo === 'debito').reduce((s, d) => s + d.montante, 0)
  const saldoTesouraria = totalCreditos - totalDebitos
  const exportarDiario = () => {
    if (!real || diario.length === 0) { push({ kind: 'info', title: t.toasts.exportTitre, desc: real ? t.toasts.aucuneEcritureExport : t.toasts.connexionExport }); return }
    try {
      downloadCsv(t.csv.fichier, t.csv.entetes, diario.map(d => [d.data, t.csv.sens(d.tipo), d.conta, d.descricao, d.montante]))
      push({ kind: 'success', title: t.toasts.exportTermine, desc: t.toasts.exportTermineDesc(diario.length) })
    } catch (err) {
      console.error('[ModContabCond] export CSV falhou', err)
      push({ kind: 'error', title: t.toasts.erreur, desc: t.toasts.exportImpossible })
    }
  }
  const chamadasEnviadas = chamadas.length
  const chamadasLiquidadas = chamadas.filter(c => c.liquidadas > 0).length

  const p = t.painel
  const f = t.formulaire
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <Tabs active={activeTab} onChange={setActiveTab} tabs={[
        { id: 'painel', label: t.onglets.painel },
        { id: 'frac', label: t.onglets.frac(fracoes.length) },
        { id: 'cq', label: t.onglets.cq(chamadas.length) },
        { id: 'diar', label: t.onglets.diar(diario.length) },
        { id: 'orc', label: t.onglets.orc(orcamentos.length) },
        { id: 'enc', label: t.onglets.enc },
        { id: 'rel', label: t.onglets.rel },
      ]} />

      {activeTab === 'painel' && (<>
        <div className={kpiCss.kpiGrid} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <KPI num={fracoes.length} lbl={p.lotsGeres} sub={p.tantiemes(totalMilesimos)} />
          <KPI num={chamadasEnviadas} lbl={p.appels} accent={chamadasEnviadas ? 'gold' : undefined} sub={p.appelsSous(chamadasEnviadas, chamadasLiquidadas)} />
          <KPI icon="coin" accent="sage" num={eur(totalCreditos, locale)} numChildren={euroSup} lbl={p.totalCredits} sub={p.encaissements} />
          <KPI icon="bank" accent={saldoTesouraria >= 0 ? 'sage' : 'rust'} num={eur(saldoTesouraria, locale)} numChildren={euroSup} lbl={p.soldeTresorerie} sub={p.debits(fmtEUR(totalDebitos, locale))} />
        </div>
        <div className={m.cardGrid} style={{ marginTop: 16 }}>
          <Panel title={p.derniersAppels}>
            {chamadas.length === 0 ? <Empty illustration="pagamentos" title={p.aucunAppel} />
              : <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>{chamadas.slice(-5).reverse().map(c => (
                <li key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--v54-line)', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{c.titulo}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(c.montante, locale)}</span>
                </li>
              ))}</ul>}
          </Panel>
          <Panel title={p.dernieresEcritures}>
            {diario.length === 0 ? <Empty illustration="faturas" title={p.aucuneEcriture} />
              : <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>{diario.slice(-5).reverse().map(d => (
                <li key={d.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--v54-line)', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{d.conta} — {d.descricao}</span><span style={{ fontVariantNumeric: 'tabular-nums', color: d.tipo === 'credito' ? 'var(--v54-sage-700)' : 'var(--v54-rust-700)' }}>{d.tipo === 'credito' ? '+' : '−'}{fmtEUR(d.montante, locale)}</span>
                </li>
              ))}</ul>}
          </Panel>
        </div>
        {fracoes.length === 0 && <Alert title={p.pointsAttention}>{p.aucunLot}</Alert>}
      </>)}

      {activeTab === 'frac' && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 12 }}>
          <div><h3 style={{ margin: 0, fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500 }}>{t.frac.titre}</h3>
            <div style={{ fontSize: 12, color: 'var(--v54-navy-500)', marginTop: 4 }}>{t.frac.totalDebut}{totalMilesimos}{t.frac.totalMilieu}{fracoes.length}{t.frac.totalFin(fracoes.length)}</div>
          </div>
          <Button variant="gold" onClick={openFrac}><Icon name="plus" />{t.frac.ajouter}</Button>
        </div>
        <Panel>
          {fracoes.length === 0 ? (
            <Empty illustration="condominos" title={t.frac.videTitre} desc={t.frac.videDesc}
              action={<Button variant="primary" onClick={openFrac}><Icon name="plus" />{t.frac.ajouterPremier}</Button>} />
          ) : (
            <div className={m.tblWrap}>
              <table className={m.tbl}>
                <thead><tr><th>{t.frac.colonnes.identification}</th><th>{t.frac.colonnes.type}</th><th>{t.frac.colonnes.tantiemes}</th><th>{t.frac.colonnes.proprietaire}</th></tr></thead>
                <tbody>{fracoes.map(fr => (
                  <tr key={fr.id}><td>{fr.identificacao}</td><td>{t.typesLot[fracTipo(fr.tipo)]}</td><td style={{ fontVariantNumeric: 'tabular-nums' }}>{fr.permilagem}</td><td>{fr.proprietario || '—'}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Panel>
      </>)}

      {activeTab === 'cq' && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500 }}>{t.cq.titre}</h3>
          <Button variant="gold" onClick={openCham}><Icon name="plus" />{t.cq.nouvel}</Button>
        </div>
        <Panel>
          {chamadas.length === 0 ? (
            <Empty illustration="pagamentos" title={t.cq.videTitre} desc={t.cq.videDesc}
              action={<Button variant="primary" onClick={openCham}><Icon name="plus" />{t.cq.creerPremier}</Button>} />
          ) : (
            <div className={m.tblWrap}>
              <table className={m.tbl}>
                <thead><tr><th>{t.cq.colonnes.titre}</th><th>{t.cq.colonnes.immeuble}</th><th>{t.cq.colonnes.emission}</th><th>{t.cq.colonnes.echeance}</th><th>{t.cq.colonnes.montant}</th><th>{t.cq.colonnes.regles}</th></tr></thead>
                <tbody>{chamadas.map(c => (
                  <tr key={c.id}><td>{c.titulo}</td><td>{c.edificio || '—'}</td><td>{c.dataEmissao}</td><td>{c.dataVencimento}</td><td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(c.montante, locale)}</td><td>{c.liquidadas} / {fracoes.length || '?'}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Panel>
      </>)}

      {activeTab === 'diar' && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 12 }}>
          <div><h3 style={{ margin: 0, fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500 }}>{t.diar.titre}</h3>
            <div style={{ fontSize: 12, color: 'var(--v54-navy-500)', marginTop: 4 }}>{t.diar.solde}{fmtEUR(saldoTesouraria, locale)}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={exportarDiario}><Icon name="download" />{t.diar.exporter}</Button>
            <Button variant="gold" onClick={openDiar}><Icon name="plus" />{t.diar.ecriture}</Button>
          </div>
        </div>
        <div className={kpiCss.kpiGrid} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <KPI num={fmtEUR(totalDebitos, locale)} lbl={t.diar.totalDebits} accent={totalDebitos ? 'rust' : undefined} />
          <KPI num={fmtEUR(totalCreditos, locale)} lbl={t.diar.totalCredits} accent={totalCreditos ? 'sage' : undefined} />
          <KPI num={fmtEUR(saldoTesouraria, locale)} lbl={t.diar.soldeKpi} accent={saldoTesouraria > 0 ? 'sage' : saldoTesouraria < 0 ? 'rust' : undefined} />
          <KPI num={diario.length} lbl={t.diar.ecritures} />
        </div>
        <Panel>
          {diario.length === 0 ? (
            <Empty illustration="faturas" title={t.diar.videTitre} desc={t.diar.videDesc}
              action={<Button variant="primary" onClick={openDiar}><Icon name="plus" />{t.diar.premiere}</Button>} />
          ) : (
            <div className={m.tblWrap}>
              <table className={m.tbl}>
                <thead><tr><th>{t.diar.colonnes.date}</th><th>{t.diar.colonnes.compte}</th><th>{t.diar.colonnes.libelle}</th><th>{t.diar.colonnes.sens}</th><th>{t.diar.colonnes.montant}</th></tr></thead>
                <tbody>{diario.map(d => (
                  <tr key={d.id}><td>{d.data}</td><td>{d.conta}</td><td>{d.descricao}</td><td><Pill kind={d.tipo === 'credito' ? 'sage' : 'rust'}>{d.tipo === 'credito' ? t.sens.credito : t.sens.debito}</Pill></td><td style={{ fontVariantNumeric: 'tabular-nums', color: d.tipo === 'credito' ? 'var(--v54-sage-700)' : 'var(--v54-rust-700)' }}>{d.tipo === 'credito' ? '+' : '−'}{fmtEUR(d.montante, locale)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Panel>
      </>)}

      {activeTab === 'orc' && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500 }}>{t.orc.titre}</h3>
          <Button variant="gold" onClick={openOrc}><Icon name="plus" />{t.orc.nouveau}</Button>
        </div>
        <Panel>
          {orcamentos.length === 0 ? (
            <Empty illustration="documentos" title={t.orc.videTitre} desc={t.orc.videDesc}
              action={<Button variant="primary" onClick={openOrc}><Icon name="plus" />{t.orc.creer}</Button>} />
          ) : (
            <div className={m.tblWrap}>
              <table className={m.tbl}>
                <thead><tr><th>{t.orc.colonnes.exercice}</th><th>{t.orc.colonnes.immeuble}</th><th>{t.orc.colonnes.totalPrevu}</th><th>{t.orc.colonnes.statut}</th></tr></thead>
                <tbody>{orcamentos.map(o => (
                  <tr key={o.id}><td>{o.ano}</td><td>{o.edificio || '—'}</td><td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(o.totalPrevisto, locale)}</td><td><Pill kind={o.aprovado ? 'sage' : 'amber'}>{o.aprovado ? t.orc.vote : t.orc.enAttente}</Pill></td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Panel>
      </>)}

      {activeTab === 'enc' && (<>
        <h3 style={{ margin: '16px 0 12px', fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500 }}>{t.enc.titre}</h3>
        <Panel title={t.enc.panneau}>
          <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>{t.enc.etapes.map((step, i) => (
            <li key={i} style={{ padding: '14px 16px', marginBottom: 8, background: 'var(--v54-cream)', borderRadius: 10, display: 'flex', gap: 14, alignItems: 'center', fontSize: 13 }}>
              <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--v54-paper)', border: '1px solid var(--v54-line)', display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 12, color: 'var(--v54-gold-700)' }}>{i + 1}</span>
              <span style={{ flex: 1 }}>{step}</span>
            </li>
          ))}</ol>
        </Panel>
      </>)}

      {activeTab === 'rel' && (<>
        <h3 style={{ margin: '16px 0 12px', fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500 }}>{t.rel.titre}</h3>
        <Panel>
          {t.rel.rapports.map(([ic, titre, d], i) => (
            <div key={i} style={{ padding: 14, marginBottom: 8, display: 'flex', gap: 14, alignItems: 'center', border: '1px solid var(--v54-line)', borderRadius: 10, background: 'var(--v54-gold-50)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fff', display: 'grid', placeItems: 'center', color: 'var(--v54-gold-700)' }}><Icon name={ic} /></div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{titre}</div><div style={{ fontSize: 11.5, color: 'var(--v54-navy-500)' }}>{d}</div></div>
              <Button size="sm" onClick={() => push({ kind: 'info', title: t.rel.toastApercu, desc: titre })}><Icon name="eye" />{t.rel.apercu}</Button>
              <Button size="sm" variant="gold" onClick={() => push({ kind: 'info', title: t.rel.toastPdf, desc: titre })}><Icon name="download" />{t.rel.pdf}</Button>
            </div>
          ))}
        </Panel>
      </>)}

      <Modal open={openMod === 'frac'} onClose={() => setOpenMod(null)} labelledBy="cc-frac-title" size="md">
        <ModalHead icon="home" id="cc-frac-title" title={f.frac.titre} onClose={() => setOpenMod(null)} />
        <form onSubmit={submitFrac} noValidate>
          <ModalBody>
            <FormRow>
              <Field label={f.frac.identification} required name="cc-frac-id" error={errF.identificacao}>
                <input type="text" placeholder={f.frac.identificationPlaceholder} value={formF.identificacao} onChange={e => setFormF({ ...formF, identificacao: e.target.value })} />
              </Field>
              <Field label={f.frac.type} name="cc-frac-tipo">
                <select value={formF.tipo} onChange={e => setFormF({ ...formF, tipo: e.target.value })}>
                  <option value="habitacao">{t.typesLot.habitacao}</option>
                  <option value="comercio">{t.typesLot.comercio}</option>
                  <option value="garagem">{t.typesLot.garagem}</option>
                  <option value="arrecadacao">{t.typesLot.arrecadacao}</option>
                </select>
              </Field>
            </FormRow>
            <Field label={f.frac.tantiemes} required hint={f.frac.tantiemesAide} full name="cc-frac-perm" error={errF.permilagem}>
              <input type="number" min="0" max="10000" placeholder="0" value={formF.permilagem} onChange={e => setFormF({ ...formF, permilagem: e.target.value })} />
            </Field>
            <Field label={f.frac.proprietaire} full name="cc-frac-prop">
              <input type="text" placeholder={f.frac.proprietairePlaceholder} value={formF.proprietario} onChange={e => setFormF({ ...formF, proprietario: e.target.value })} />
            </Field>
            <Field label={f.notes} full name="cc-frac-notas">
              <textarea rows={2} value={formF.notas} onChange={e => setFormF({ ...formF, notas: e.target.value })} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpenMod(null)}>{f.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{f.frac.valider}</button>
          </ModalFoot>
        </form>
      </Modal>

      <Modal open={openMod === 'cq'} onClose={() => setOpenMod(null)} labelledBy="cc-cq-title" size="md">
        <ModalHead icon="mail" id="cc-cq-title" title={f.cq.titre} onClose={() => setOpenMod(null)} />
        <form onSubmit={submitCham} noValidate>
          <ModalBody>
            <Field label={f.cq.intitule} required full name="cc-cq-tit" error={errC.titulo}>
              <input type="text" placeholder={f.cq.intitulePlaceholder} value={formC.titulo} onChange={e => setFormC({ ...formC, titulo: e.target.value })} />
            </Field>
            <Field label={f.immeuble} full name="cc-cq-edif">
              <input type="text" placeholder={f.immeublePlaceholder} value={formC.edificio} onChange={e => setFormC({ ...formC, edificio: e.target.value })} />
            </Field>
            <FormRow>
              <Field label={f.cq.dateEmission} name="cc-cq-emit">
                <input type="date" value={formC.dataEmissao} onChange={e => setFormC({ ...formC, dataEmissao: e.target.value })} />
              </Field>
              <Field label={f.cq.dateEcheance} required name="cc-cq-venc" error={errC.dataVencimento}>
                <input type="date" value={formC.dataVencimento} onChange={e => setFormC({ ...formC, dataVencimento: e.target.value })} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={f.cq.montantTotal} required suffix="€" name="cc-cq-mont" error={errC.montante}>
                <input type="number" step="0.01" min="0" placeholder="0" value={formC.montante} onChange={e => setFormC({ ...formC, montante: e.target.value })} />
              </Field>
              <Field label={f.cq.repartition} name="cc-cq-dist">
                <select value={formC.distribuicao} onChange={e => setFormC({ ...formC, distribuicao: e.target.value })}>
                  <option value="milesimos">{f.cq.parTantiemes}</option>
                  <option value="igualitaria">{f.cq.partsEgales}</option>
                </select>
              </Field>
            </FormRow>
            <Field label={f.notes} full name="cc-cq-notas">
              <textarea rows={2} value={formC.notas} onChange={e => setFormC({ ...formC, notas: e.target.value })} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpenMod(null)}>{f.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{f.cq.valider}</button>
          </ModalFoot>
        </form>
      </Modal>

      <Modal open={openMod === 'diar'} onClose={() => setOpenMod(null)} labelledBy="cc-diar-title" size="md">
        <ModalHead icon="book" id="cc-diar-title" title={f.diar.titre} onClose={() => setOpenMod(null)} />
        <form onSubmit={submitDiar} noValidate>
          <ModalBody>
            <FormRow>
              <Field label={f.diar.date} name="cc-d-data">
                <input type="date" value={formD.data} onChange={e => setFormD({ ...formD, data: e.target.value })} />
              </Field>
              <Field label={f.diar.sens} name="cc-d-tipo">
                <select value={formD.tipo} onChange={e => setFormD({ ...formD, tipo: e.target.value })}>
                  <option value="debito">{t.sens.debito}</option>
                  <option value="credito">{t.sens.credito}</option>
                </select>
              </Field>
            </FormRow>
            <Field label={f.diar.compte} required full hint={f.diar.compteAide} name="cc-d-conta" error={errD.conta}>
              <input type="text" placeholder={f.diar.comptePlaceholder} value={formD.conta} onChange={e => setFormD({ ...formD, conta: e.target.value })} />
            </Field>
            <Field label={f.diar.libelle} required full name="cc-d-desc" error={errD.descricao}>
              <input type="text" placeholder={f.diar.libellePlaceholder} value={formD.descricao} onChange={e => setFormD({ ...formD, descricao: e.target.value })} />
            </Field>
            <Field label={f.diar.montant} required suffix="€" full name="cc-d-mont" error={errD.montante}>
              <input type="number" step="0.01" min="0" placeholder="0" value={formD.montante} onChange={e => setFormD({ ...formD, montante: e.target.value })} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpenMod(null)}>{f.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{f.diar.valider}</button>
          </ModalFoot>
        </form>
      </Modal>

      <Modal open={openMod === 'orc'} onClose={() => setOpenMod(null)} labelledBy="cc-orc-title" size="md">
        <ModalHead icon="clipboard" id="cc-orc-title" title={f.orc.titre} onClose={() => setOpenMod(null)} />
        <form onSubmit={submitOrc} noValidate>
          <ModalBody>
            <FormRow>
              <Field label={f.orc.exercice} required name="cc-o-ano" error={errO.ano}>
                <input type="number" min="2020" max="2099" value={formO.ano} onChange={e => setFormO({ ...formO, ano: e.target.value })} />
              </Field>
              <Field label={f.immeuble} name="cc-o-edif">
                <input type="text" placeholder={f.immeublePlaceholder} value={formO.edificio} onChange={e => setFormO({ ...formO, edificio: e.target.value })} />
              </Field>
            </FormRow>
            <Field label={f.orc.totalPrevu} required suffix="€" full name="cc-o-tot" error={errO.totalPrevisto}>
              <input type="number" step="0.01" min="0" placeholder="0" value={formO.totalPrevisto} onChange={e => setFormO({ ...formO, totalPrevisto: e.target.value })} />
            </Field>
            <Field label={f.orc.postes} hint={f.orc.postesAide} full name="cc-o-rub">
              <textarea rows={4} placeholder={f.orc.postesPlaceholder} value={formO.rubricas} onChange={e => setFormO({ ...formO, rubricas: e.target.value })} />
            </Field>
            <Field label={f.notes} full name="cc-o-notas">
              <textarea rows={2} value={formO.notas} onChange={e => setFormO({ ...formO, notas: e.target.value })} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpenMod(null)}>{f.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{f.orc.valider}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
