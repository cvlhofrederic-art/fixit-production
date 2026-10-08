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
import { jourCivilLocal } from '@/lib/syndic/v54/i18n/dates'
import { FCR_MESSAGES } from './i18n/ModFCR.messages'

/** Fundo Comum de Reserva — port byte-exact V5.7 + Phase 3 : édifices & mouvements réels.
 * Syndic connecté → vrais édifices/mouvements du cabinet (data.fcrEdificios/fcrMovimentos) + création POST ;
 * anonyme → preview (Empty byte-exact + toast démo). */

type EdifForm = { nome: string; endereco: string; orcamentoAnual: string; percentagemFCR: number | string; saldoInicial: string }
type MovForm = { edificio: string; tipo: string; data: string; montante: string; descricao: string }

const fmtEUR = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)

export default function ModFCR() {
  const t = useMessages(FCR_MESSAGES)
  const locale = useV54Locale()
  // Taux minimal légal (10 % PT, 5 % FR) : valeur par défaut, repli et seuil de conformité.
  const seuil = t.tauxMinimal
  // Phase 3 : vrais édifices/mouvements FCR du cabinet si syndic connecté, sinon preview vide.
  const data = useSyndicData()
  const real = data.authenticated
  const edificios = real ? (data.fcrEdificios ?? []) : []
  const movimentos = real ? (data.fcrMovimentos ?? []) : []

  const today = jourCivilLocal()
  const blankE: EdifForm = { nome: '', endereco: '', orcamentoAnual: '', percentagemFCR: seuil, saldoInicial: '' }
  const blankM: MovForm = { edificio: '', tipo: 'entrada', data: today, montante: '', descricao: '' }
  const [openMod, setOpenMod] = useState<'edificio' | 'movimento' | null>(null)
  const [formE, setFormE] = useState<EdifForm>(blankE)
  const [formM, setFormM] = useState<MovForm>(blankM)
  const [errE, setErrE] = useState<Partial<Record<keyof EdifForm, string>>>({})
  const [errM, setErrM] = useState<Partial<Record<keyof MovForm, string>>>({})
  const [busy, setBusy] = useState(false)
  const { push } = useToast()

  const updE = (k: keyof EdifForm, v: string) => setFormE(s => ({ ...s, [k]: v }))
  const updM = (k: keyof MovForm, v: string) => setFormM(s => ({ ...s, [k]: v }))
  const openEdif = () => { setFormE(blankE); setErrE({}); setOpenMod('edificio') }
  const openMov = () => { setFormM(blankM); setErrM({}); setOpenMod('movimento') }

  const submitEdif = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof EdifForm, string>> = {}
    if (!formE.nome.trim()) errs.nome = t.erreurs.nom
    if (Number(formE.percentagemFCR) < seuil) errs.percentagemFCR = t.erreurs.taux
    if (Object.keys(errs).length) { setErrE(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/fcr-edificios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ nome: formE.nome, endereco: formE.endereco, orcamentoAnual: Number(formE.orcamentoAnual) || 0, percentagemFCR: Number(formE.percentagemFCR) || seuil, saldoInicial: Number(formE.saldoInicial) || 0 }),
      })
        .then(r => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpenMod(null); push({ kind: 'success', title: t.toasts.immeubleAjoute, desc: t.toasts.immeubleDetail(formE.nome, formE.percentagemFCR) }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurAjout, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpenMod(null)
    push({ kind: 'info', title: t.toasts.immeubleAjouteDemo, desc: t.toasts.connexionRequise })
  }
  const submitMov = (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<keyof MovForm, string>> = {}
    if (!formM.descricao.trim()) errs.descricao = t.erreurs.description
    if (!formM.montante || Number(formM.montante) <= 0) errs.montante = t.erreurs.montant
    if (Object.keys(errs).length) { setErrM(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/fcr-movimentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ edificio: formM.edificio, tipo: formM.tipo, data: formM.data, montante: Number(formM.montante), descricao: formM.descricao }),
      })
        .then(r => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpenMod(null); push({ kind: 'success', title: formM.tipo === 'entrada' ? t.toasts.entreeEnregistree : t.toasts.sortieEnregistree, desc: fmtEUR(Number(formM.montante), locale) }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurEnregistrement, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpenMod(null)
    push({ kind: 'info', title: formM.tipo === 'entrada' ? t.toasts.entreeEnregistreeDemo : t.toasts.sortieEnregistreeDemo, desc: t.toasts.connexionRequise })
  }

  const entradas = movimentos.filter(mv => mv.tipo === 'entrada').reduce((s, mv) => s + mv.montante, 0)
  const saidas = movimentos.filter(mv => mv.tipo === 'saida').reduce((s, mv) => s + mv.montante, 0)
  const saldoIni = edificios.reduce((s, e) => s + (e.saldoInicial || 0), 0)
  const saldoTotal = saldoIni + entradas - saidas
  const contribAnual = edificios.reduce((s, e) => s + ((e.orcamentoAnual || 0) * (e.percentagemFCR || seuil) / 100), 0)
  const minFCRok = edificios.every(e => (e.percentagemFCR || seuil) >= seuil)

  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau}
        actions={<><Button onClick={openEdif}><Icon name="building" />{t.nouvelImmeuble}</Button><Button variant="gold" onClick={openMov}><Icon name="plus" />{t.enregistrerMouvement}</Button></>} />
      <KPIGrid items={[
        { icon: 'bank', num: fmtEUR(saldoTotal, locale), lbl: t.kpi.solde, accent: saldoTotal > 0 ? 'gold' : undefined },
        { icon: 'upload', num: fmtEUR(entradas, locale), lbl: t.kpi.entrees, accent: entradas ? 'sage' : undefined },
        { icon: 'download', num: fmtEUR(saidas, locale), lbl: t.kpi.sorties, accent: saidas ? 'rust' : undefined },
        { icon: 'building', num: edificios.length, lbl: t.kpi.immeubles, accent: edificios.length ? 'gold' : undefined },
        { icon: 'coin', num: fmtEUR(contribAnual, locale), lbl: t.kpi.cotisation },
        { icon: minFCRok ? 'check' : 'alert', num: minFCRok ? t.kpi.ok : t.kpi.ko, lbl: t.kpi.conformite, accent: minFCRok ? 'sage' : 'rust' },
      ]} />
      <Tabs defaultActive="vg" tabs={[
        { id: 'vg', icon: 'chart', label: t.onglets.vg(edificios.length) },
        { id: 'mov', icon: 'clipboard', label: t.onglets.mov(movimentos.length) },
      ]} />
      <Panel>
        {edificios.length === 0 ? (
          <Empty illustration="condominos" title={t.vide.titre} desc={t.vide.desc}
            action={<Button variant="primary" onClick={openEdif}><Icon name="building" />{t.vide.action}</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{t.colonnes.immeuble}</th><th>{t.colonnes.adresse}</th><th>{t.colonnes.budget}</th><th>{t.colonnes.taux}</th><th>{t.colonnes.soldeInitial}</th><th>{t.colonnes.conformite}</th></tr></thead>
              <tbody>{edificios.map(e => (
                <tr key={e.id}>
                  <td>{e.nome}</td>
                  <td>{e.endereco || '—'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(e.orcamentoAnual, locale)}</td>
                  <td>{e.percentagemFCR} %</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(e.saldoInicial, locale)}</td>
                  <td><Pill kind={e.percentagemFCR >= seuil ? 'sage' : 'rust'}>{e.percentagemFCR >= seuil ? t.conforme : t.insuffisant}</Pill></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={openMod === 'edificio'} onClose={() => setOpenMod(null)} labelledBy="fe-modal-title" size="md">
        <ModalHead icon="building" id="fe-modal-title" title={t.immeuble.titre} onClose={() => setOpenMod(null)} />
        <form onSubmit={submitEdif} noValidate>
          <ModalBody>
            <Field label={t.immeuble.nom} required full name="fe-nome" error={errE.nome}>
              <input type="text" placeholder={t.immeuble.nomPlaceholder} value={formE.nome} onChange={e => updE('nome', e.target.value)} />
            </Field>
            <Field label={t.immeuble.adresse} full name="fe-end">
              <input type="text" placeholder={t.immeuble.adressePlaceholder} value={formE.endereco} onChange={e => updE('endereco', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={t.immeuble.budget} suffix="€" name="fe-orc">
                <input type="number" step="0.01" min="0" placeholder="0" value={formE.orcamentoAnual} onChange={e => updE('orcamentoAnual', e.target.value)} />
              </Field>
              <Field label={t.immeuble.taux} hint={t.immeuble.tauxAide} suffix="%" name="fe-pct" error={errE.percentagemFCR}>
                <input type="number" min="0" max="100" value={formE.percentagemFCR} onChange={e => updE('percentagemFCR', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={t.immeuble.soldeInitial} suffix="€" full name="fe-saldo">
              <input type="number" step="0.01" placeholder="0" value={formE.saldoInicial} onChange={e => updE('saldoInicial', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpenMod(null)}>{t.immeuble.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{t.immeuble.ajouter}</button>
          </ModalFoot>
        </form>
      </Modal>

      <Modal open={openMod === 'movimento'} onClose={() => setOpenMod(null)} labelledBy="fm-modal-title" size="md">
        <ModalHead icon="coin" id="fm-modal-title" title={t.mouvement.titre} onClose={() => setOpenMod(null)} />
        <form onSubmit={submitMov} noValidate>
          <ModalBody>
            <FormRow>
              <Field label={t.mouvement.type} name="fm-tipo">
                <select value={formM.tipo} onChange={e => updM('tipo', e.target.value)}>
                  <option value="entrada">{t.mouvement.entree}</option>
                  <option value="saida">{t.mouvement.sortie}</option>
                </select>
              </Field>
              <Field label={t.mouvement.date} name="fm-data">
                <input type="date" value={formM.data} onChange={e => updM('data', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={t.mouvement.immeuble} full name="fm-edif">
              <select value={formM.edificio} onChange={e => updM('edificio', e.target.value)}>
                <option value="">{t.mouvement.choisirImmeuble}</option>
                {edificios.map(e => <option key={e.id} value={e.nome}>{e.nome}</option>)}
              </select>
            </Field>
            <Field label={t.mouvement.montant} required suffix="€" full name="fm-mont" error={errM.montante}>
              <input type="number" step="0.01" min="0" placeholder="0" value={formM.montante} onChange={e => updM('montante', e.target.value)} />
            </Field>
            <Field label={t.mouvement.description} required full name="fm-desc" error={errM.descricao}>
              <textarea rows={3} placeholder={t.mouvement.descriptionPlaceholder} value={formM.descricao} onChange={e => updM('descricao', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpenMod(null)}>{t.mouvement.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{t.mouvement.enregistrer}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
