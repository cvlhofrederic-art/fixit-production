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
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { dateApi } from '@/lib/syndic/v54/i18n/dates'
import { SEGURO_OBR_MESSAGES } from './i18n/ModSeguroObr.messages'

/** Seguro Obrigatório de Condomínio — port byte-exact V5.7 + Phase 3 : réutilise syndic_seguros + syndic_sinistros.
 * Apólices = assurance incêndio obligatoire (seguros tipo='incendio') ; sinistros = syndic_sinistros.
 * Syndic connecté → données réelles + création POST ; anonyme → preview byte-exact. */

type ApForm = { seguradora: string; numero: string; edificio: string; dataInicio: string; dataFim: string; premio: string; cobertura: string; notas: string }
type SinForm = { apolice: string; dataSinistro: string; tipo: string; montante: string; descricao: string }

const fmtEUR = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)
const yearLater = (d: string) => { const dt = new Date(d); dt.setFullYear(dt.getFullYear() + 1); return dt.toISOString().slice(0, 10) }

export default function ModSeguroObr() {
  const t = useMessages(SEGURO_OBR_MESSAGES)
  const locale = useV54Locale()
  // Phase 3 : apólices = assurance incêndio obligatoire (syndic_seguros tipo='incendio'),
  // sinistros = syndic_sinistros. Les autres polices restent dans ModSeguros.
  const data = useSyndicData()
  const real = data.authenticated
  const apolices = (real ? (data.seguros ?? []) : []).filter((s) => s.tipo === 'incendio').map((s) => ({
    id: s.id, seguradora: s.seguradora, numero: s.apolice, edificio: s.immeuble,
    dataInicio: s.dataInicio, dataFim: s.dataFim, premio: s.premioAnual, cobertura: s.capital,
    notas: s.notes, estado: s.statut,
  }))
  const sinistros = (real ? (data.sinistros ?? []) : []).map((s) => ({
    id: s.id, apolice: '', dataSinistro: s.dataDeclaracao, tipo: s.tipo,
    montante: s.montanteEstimado, descricao: s.descricao,
    estado: s.statut === 'encerrado' || s.statut === 'indemnizado' ? 'fechado' : 'aberto',
  }))

  const today = new Date().toISOString().slice(0, 10)
  const blankA: ApForm = { seguradora: '', numero: '', edificio: '', dataInicio: today, dataFim: yearLater(today), premio: '', cobertura: '', notas: '' }
  const blankS: SinForm = { apolice: '', dataSinistro: today, tipo: 'agua', montante: '', descricao: '' }
  const [busy, setBusy] = useState(false)
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
    if (!formA.seguradora.trim()) errs.seguradora = t.erreurs.assureur
    if (!formA.numero.trim()) errs.numero = t.erreurs.numero
    if (!formA.edificio.trim()) errs.edificio = t.erreurs.immeuble
    if (!formA.premio || Number(formA.premio) <= 0) errs.premio = t.erreurs.prime
    if (Object.keys(errs).length) { setErrA(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/seguros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ immeuble: formA.edificio, seguradora: formA.seguradora, tipo: 'incendio', apolice: formA.numero, premioAnual: Number(formA.premio) || 0, capital: Number(formA.cobertura) || 0, dataInicio: formA.dataInicio, dataFim: formA.dataFim, statut: 'ativa', notes: formA.notas }),
      })
        .then((r) => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpenMod(null); push({ kind: 'success', title: t.toasts.policeEnregistree, desc: `${formA.seguradora} · ${formA.numero}` }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurEnregistrement, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpenMod(null)
    push({ kind: 'info', title: t.toasts.policeEnregistreeDemo, desc: t.toasts.connexionRequise })
  }
  const submitSinistro = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof SinForm, string>> = {}
    if (!formS.descricao.trim()) errs.descricao = t.erreurs.description
    if (!formS.montante || Number(formS.montante) <= 0) errs.montante = t.erreurs.montant
    if (Object.keys(errs).length) { setErrS(errs); return }
    if (real && data.token) {
      setBusy(true)
      const ap = apolices.find((a) => a.numero === formS.apolice)
      fetch('/api/syndic/sinistros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        // Valeurs techniques envoyées à l'API : identiques en PT et en FR.
        body: JSON.stringify({ immeuble: ap?.edificio || '', tipo: formS.tipo, descricao: formS.descricao, seguradora: ap?.seguradora || '', montanteEstimado: Number(formS.montante) || 0, indemnizacao: 0, dataDeclaracao: formS.dataSinistro, urgente: false, statut: 'declarado', notes: formS.apolice ? `Apólice: ${formS.apolice}` : '' }),
      })
        .then((r) => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpenMod(null); push({ kind: 'warning', title: t.toasts.sinistreDeclare, desc: t.toasts.sinistreDetail(formS.tipo, fmtEUR(Number(formS.montante), locale)) }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurDeclaration, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpenMod(null)
    push({ kind: 'warning', title: t.toasts.sinistreDeclareDemo, desc: t.toasts.connexionRequise })
  }

  const ativas = apolices.filter(a => a.estado === 'ativa')
  const renovate = ativas.filter(a => { const days = (new Date(a.dataFim).getTime() - Date.now()) / 86400000; return days > 0 && days < 60 }).length
  const expired = apolices.filter(a => new Date(a.dataFim) < new Date()).length
  const premioAnual = ativas.reduce((s, a) => s + (a.premio || 0), 0)
  const sinistrosAbertos = sinistros.filter(s => s.estado === 'aberto').length
  const totalIndem = 0

  const p = t.police
  const sn = t.sinistre
  const col = t.colonnes
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau}
        actions={<><Button variant="gold" onClick={openApolice}><Icon name="plus" />{t.nouvellePolice}</Button><Button variant="danger" onClick={openSinistro}><Icon name="alert" />{t.declarerSinistre}</Button></>} />
      <KPIGrid items={[
        { icon: 'shield', num: ativas.length, lbl: t.kpi.actives, accent: ativas.length ? 'gold' : undefined },
        { icon: 'clock', num: renovate, lbl: t.kpi.aRenouveler, accent: renovate ? 'amber' : undefined },
        { icon: 'ban', num: expired, lbl: t.kpi.expirees, accent: expired ? 'rust' : undefined },
        { icon: 'coin', num: fmtEUR(premioAnual, locale), lbl: t.kpi.primeTotale },
        { icon: 'alert', num: sinistrosAbertos, lbl: t.kpi.sinistresOuverts, accent: sinistrosAbertos ? 'amber' : undefined },
        { icon: 'check', num: fmtEUR(totalIndem, locale), lbl: t.kpi.totalIndemnise, accent: 'sage' },
      ]} />
      <Tabs defaultActive="ap" tabs={[
        { id: 'ap', icon: 'shield', label: t.onglets.polices(apolices.length) },
        { id: 'sn', icon: 'alert', label: t.onglets.sinistres(sinistros.length) },
      ]} />
      <Panel>
        {apolices.length === 0 ? (
          <Empty kind="gold" illustration="seguros" title={t.vide.titre} desc={t.vide.desc}
            action={<Button variant="primary" onClick={openApolice}><Icon name="plus" />{t.vide.action}</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{col.assureur}</th><th>{col.numero}</th><th>{col.immeuble}</th><th>{col.debut}</th><th>{col.fin}</th><th>{col.prime}</th><th>{col.statut}</th></tr></thead>
              <tbody>{apolices.map(a => (
                <tr key={a.id}>
                  <td>{a.seguradora}</td>
                  <td>{a.numero}</td>
                  <td>{a.edificio}</td>
                  <td>{dateApi(a.dataInicio, locale)}</td>
                  <td>{dateApi(a.dataFim, locale)}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(a.premio, locale)}</td>
                  <td><Pill kind="sage">{t.active}</Pill></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={openMod === 'apolice'} onClose={() => setOpenMod(null)} labelledBy="ap-modal-title" size="md">
        <ModalHead icon="shield" id="ap-modal-title" title={p.titre} onClose={() => setOpenMod(null)} />
        <form onSubmit={submitApolice} noValidate>
          <ModalBody>
            <FormRow>
              <Field label={p.assureur} required name="ap-seg" error={errA.seguradora}>
                <input type="text" placeholder={p.assureurPlaceholder} value={formA.seguradora} onChange={e => updA('seguradora', e.target.value)} />
              </Field>
              <Field label={p.numero} required name="ap-num" error={errA.numero}>
                <input type="text" placeholder={p.numeroPlaceholder} value={formA.numero} onChange={e => updA('numero', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={p.immeuble} required full name="ap-edif" error={errA.edificio}>
              <input type="text" placeholder={p.immeublePlaceholder} value={formA.edificio} onChange={e => updA('edificio', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={p.dateDebut} required name="ap-ini">
                <input type="date" value={formA.dataInicio} onChange={e => updA('dataInicio', e.target.value)} />
              </Field>
              <Field label={p.dateFin} hint={p.dateFinAide} name="ap-fim">
                <input type="date" value={formA.dataFim} onChange={e => updA('dataFim', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={p.prime} required suffix="€" name="ap-premio" error={errA.premio}>
                <input type="number" step="0.01" min="0" placeholder="0" value={formA.premio} onChange={e => updA('premio', e.target.value)} />
              </Field>
              <Field label={p.garantie} hint={p.garantieAide} suffix="€" name="ap-cob">
                <input type="number" step="0.01" min="0" placeholder="0" value={formA.cobertura} onChange={e => updA('cobertura', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={p.notes} full name="ap-notas">
              <textarea rows={3} value={formA.notas} onChange={e => updA('notas', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpenMod(null)}>{p.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{p.enregistrer}</button>
          </ModalFoot>
        </form>
      </Modal>

      <Modal open={openMod === 'sinistro'} onClose={() => setOpenMod(null)} labelledBy="sn-modal-title" size="md">
        <ModalHead icon="alert" id="sn-modal-title" title={sn.titre} onClose={() => setOpenMod(null)} />
        <form onSubmit={submitSinistro} noValidate>
          <ModalBody>
            <FormRow>
              <Field label={sn.police} name="sn-apol">
                <select value={formS.apolice} onChange={e => updS('apolice', e.target.value)}>
                  <option value="">{sn.choisir}</option>
                  {apolices.map(a => <option key={a.id} value={a.numero}>{a.numero} ({a.seguradora})</option>)}
                </select>
              </Field>
              <Field label={sn.date} name="sn-data">
                <input type="date" value={formS.dataSinistro} onChange={e => updS('dataSinistro', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={sn.type} name="sn-tipo">
                <select value={formS.tipo} onChange={e => updS('tipo', e.target.value)}>
                  <option value="incendio">{sn.types.incendio}</option>
                  <option value="agua">{sn.types.agua}</option>
                  <option value="rouge">{sn.types.rouge}</option>
                  <option value="rc">{sn.types.rc}</option>
                  <option value="outros">{sn.types.outros}</option>
                </select>
              </Field>
              <Field label={sn.montant} required suffix="€" name="sn-mont" error={errS.montante}>
                <input type="number" step="0.01" min="0" placeholder="0" value={formS.montante} onChange={e => updS('montante', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={sn.description} required full name="sn-desc" error={errS.descricao}>
              <textarea rows={4} placeholder={sn.descriptionPlaceholder} value={formS.descricao} onChange={e => updS('descricao', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpenMod(null)}>{sn.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.danger)} disabled={busy}>{sn.declarer}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
