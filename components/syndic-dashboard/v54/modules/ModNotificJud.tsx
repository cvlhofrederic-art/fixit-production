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
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { dateApi } from '@/lib/syndic/v54/i18n/dates'
import { NOTIFIC_JUD_MESSAGES } from './i18n/ModNotificJud.messages'

/** Centro de Notificações Judiciais — port V5.7 + lot 2 fonctionnel.
 * Syndic connecté → vrais processus du cabinet (data.processosJud) + création POST ;
 * anonyme → état vide byte-exact. Léa OCR / relatório semestral = contenu éducatif. */

type ProcForm = { tipo: string; contraparte: string; processo: string; data: string; prazo: string; estado: ProcessoJud['estado']; valor: string; descricao: string }

const fmtEUR = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)
const estadoLabel = (v: string, labels: Record<string, string>) => labels[v] || v
const estadoKind = (v: string): PillKind => (v === 'arquivado' ? 'sage' : 'amber')

export default function ModNotificJud() {
  const t = useMessages(NOTIFIC_JUD_MESSAGES)
  const locale = useV54Locale()
  const f = t.formulaire
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
    if (!form.tipo.trim()) { setErrors({ tipo: t.erreurType }); return }
    create(
      { tipo: form.tipo, contraparte: form.contraparte, processo: form.processo, data: form.data || null, prazo: form.prazo || null, estado: form.estado, valor: Number(form.valor) || 0, descricao: form.descricao },
      { okTitle: t.okTitre, desc: form.tipo, onDone: () => setOpen(false) },
    )
  }

  const ativos = all.filter(p => p.estado === 'ativo').length
  const arquivados = all.filter(p => p.estado === 'arquivado').length
  const valorTotal = all.reduce((s, p) => s + (Number(p.valor) || 0), 0)

  return (
    <>
      <PageHead eyebrow={t.surtitre} title={t.titre}
        lede={t.chapeau}
        actions={<><Button onClick={openNew}><Icon name="upload" />{t.enregistrerActe}</Button><Button variant="gold" onClick={() => push({ kind: 'info', title: t.rapport.titre, desc: ativos ? t.rapport.actifs(ativos) : t.rapport.aucun })}><Icon name="doc" />{t.genererRapport}</Button></>} />
      <Alert kind="gold" icon="scale" title={t.alerte.titre}>
        <strong>{t.alerte.l1Fort}</strong>{t.alerte.l1Texte}<br />
        <strong>{t.alerte.l2Fort}</strong>{t.alerte.l2Avant}<strong>{t.alerte.l2Fort2}</strong>{t.alerte.l2Apres}
      </Alert>
      <KPIGrid items={[
        { icon: 'scale', num: ativos, lbl: t.kpi.actifs, accent: ativos ? 'rust' : undefined },
        { icon: 'folder', num: all.length, lbl: t.kpi.total },
        { icon: 'coin', num: valorTotal ? fmtEUR(valorTotal, locale).replace('€', '').trim() : '—', cur: valorTotal ? '€' : undefined, lbl: t.kpi.valeur },
        { icon: 'check', num: arquivados, lbl: t.kpi.archives, accent: arquivados ? 'sage' : undefined },
        { icon: 'clock', num: t.kpi.prochainNum, lbl: t.kpi.prochain, accent: 'gold' },
        { icon: 'bot', num: t.kpi.leaNum, lbl: t.kpi.ocr },
      ]} />
      <Tabs defaultActive="proc" tabs={[
        { id: 'proc', icon: 'scale', label: t.onglets.proc(all.length) },
        { id: 'in', icon: 'upload', label: t.onglets.inbox },
        { id: 'com', icon: 'mail', label: t.onglets.com },
        { id: 'rel', icon: 'doc', label: t.onglets.rel },
      ]} />
      <Panel>
        {all.length === 0 ? (
          <Empty illustration="documentos" title={t.vide.titre}
            desc={t.vide.desc}
            action={<Button variant="primary" onClick={openNew}><Icon name="upload" />{t.vide.action}</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{t.colonnes.type}</th><th>{t.colonnes.contrepartie}</th><th>{t.colonnes.numero}</th><th>{t.colonnes.date}</th><th>{t.colonnes.valeur}</th><th>{t.colonnes.statut}</th></tr></thead>
              <tbody>{all.map(p => (
                <tr key={p.id}><td><b>{p.tipo}</b></td><td>{p.contraparte || '—'}</td><td>{p.processo || '—'}</td><td>{dateApi(p.data, locale) || '—'}</td><td className={m.numCell}>{p.valor ? fmtEUR(Number(p.valor), locale) : '—'}</td><td><Pill kind={estadoKind(p.estado)} noDot>{estadoLabel(p.estado, t.statuts)}</Pill></td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title={t.typesTitre}>
        <div className={m.cardGrid}>
          {t.types.map(([titre, s, c], i) => (
            <div key={i} style={{ padding: 14, border: '1px solid var(--v54-line)', borderRadius: 10, background: `var(--v54-${c}-50)`, borderLeft: `3px solid var(--v54-${c}-500)` }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{titre}</div>
              <div style={{ fontSize: 11.5, color: 'var(--v54-navy-400)' }}>{s}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="proc-modal-title" size="md">
        <ModalHead icon="scale" id="proc-modal-title" title={f.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label={f.type} required name="proc-tipo" error={errors.tipo}>
                <input type="text" placeholder={f.typePlaceholder} value={form.tipo} onChange={e => upd('tipo', e.target.value)} />
              </Field>
              <Field label={f.contrepartie} name="proc-contra">
                <input type="text" placeholder={f.contrepartiePlaceholder} value={form.contraparte} onChange={e => upd('contraparte', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={f.numero} full name="proc-num">
              <input type="text" placeholder={f.numeroPlaceholder} value={form.processo} onChange={e => upd('processo', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={f.date} name="proc-data">
                <input type="date" value={form.data} onChange={e => upd('data', e.target.value)} />
              </Field>
              <Field label={f.delai} hint={f.delaiAide} name="proc-prazo">
                <input type="date" value={form.prazo} onChange={e => upd('prazo', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={f.statut} name="proc-estado">
                <select value={form.estado} onChange={e => upd('estado', e.target.value)}>
                  <option value="ativo">{t.statuts.ativo}</option>
                  <option value="arquivado">{t.statuts.arquivado}</option>
                </select>
              </Field>
              <Field label={f.valeur} hint={f.valeurAide} name="proc-valor" suffix="€">
                <input type="number" step="0.01" min="0" inputMode="decimal" placeholder="0" value={form.valor} onChange={e => upd('valor', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={f.description} full name="proc-desc">
              <textarea rows={3} placeholder={f.descriptionPlaceholder} value={form.descricao} onChange={e => upd('descricao', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{f.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{f.enregistrer}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
