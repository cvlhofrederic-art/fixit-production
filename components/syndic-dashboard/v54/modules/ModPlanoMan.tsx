'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { Alert } from '../primitives/alert'
import { KPIGrid } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { PlanoMan } from '@/lib/syndic/v54/api'
import { useSyndicCreate } from './use-syndic-create'
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { PLANO_MAN_MESSAGES } from './i18n/ModPlanoMan.messages'

/** Plano de Manutenção — port V5.7 + lot 2 fonctionnel.
 * Syndic connecté → vrais plans du cabinet (data.planosMan) + création POST ;
 * anonyme → état vide byte-exact (design showcase). */

type PlanForm = { titulo: string; edificio: string; estado: PlanoMan['estado']; orcamento: string; anoInicio: string; periodicidade: string; descricao: string }

const fmtEUR = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)
const estadoKind = (v: string): PillKind => (({ preparacao: 'amber', aprovado: 'sage', concluido: 'gold' } as Record<string, PillKind>)[v] || 'amber')

export default function ModPlanoMan() {
  const t = useMessages(PLANO_MAN_MESSAGES)
  const locale = useV54Locale()
  const estadoLabel = (v: string) => (t.etats as Record<string, string>)[v] || v
  const data = useSyndicData()
  const real = data.authenticated
  const all: PlanoMan[] = real ? (data.planosMan ?? []) : []
  const { busy, create } = useSyndicCreate('/api/syndic/planos-man')

  const blank: PlanForm = { titulo: '', edificio: '', estado: 'preparacao', orcamento: '', anoInicio: '', periodicidade: t.modal.periodiciteDefaut, descricao: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<PlanForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof PlanForm, string>>>({})

  const upd = (k: keyof PlanForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.titulo.trim()) { setErrors({ titulo: t.erreurTitre }); return }
    create(
      { titulo: form.titulo, edificio: form.edificio, estado: form.estado, orcamento: Number(form.orcamento) || 0, anoInicio: form.anoInicio ? Number(form.anoInicio) : null, periodicidade: form.periodicidade, descricao: form.descricao },
      { okTitle: t.cree, desc: form.titulo, onDone: () => setOpen(false) },
    )
  }

  const aprovados = all.filter(p => p.estado === 'aprovado').length
  const emPrep = all.filter(p => p.estado === 'preparacao').length
  const orcTotal = all.reduce((s, p) => s + (Number(p.orcamento) || 0), 0)

  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau}
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.nouveauPlan}</Button>} />
      <Alert kind="gold" icon="scale" title={t.cadre.titre}>
        {t.cadre.texte}
      </Alert>
      <KPIGrid items={[
        { icon: 'doc', num: all.length, lbl: t.kpi.crees },
        { icon: 'check', num: aprovados, lbl: t.kpi.adoptes, accent: aprovados ? 'sage' : undefined },
        { icon: 'pencil', num: emPrep, lbl: t.kpi.enPreparation, accent: emPrep ? 'amber' : undefined },
        { icon: 'coin', num: orcTotal ? fmtEUR(orcTotal, locale).replace('€', '').trim() : '—', cur: orcTotal ? '€' : undefined, lbl: t.kpi.budgetTotal },
      ]} />
      <Panel>
        {all.length === 0 ? (
          <Empty illustration="eventos" title={t.vide.titre}
            desc={t.vide.desc}
            action={<Button variant="primary" onClick={openNew}><Icon name="plus" />{t.vide.action}</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{t.colonnes.titre}</th><th>{t.colonnes.immeuble}</th><th>{t.colonnes.debut}</th><th>{t.colonnes.periodicite}</th><th>{t.colonnes.budget}</th><th>{t.colonnes.statut}</th></tr></thead>
              <tbody>{all.map(p => (
                <tr key={p.id}><td><b>{p.titulo}</b></td><td>{p.edificio || '—'}</td><td>{p.anoInicio || '—'}</td><td>{p.periodicidade || '—'}</td><td className={m.numCell}>{fmtEUR(Number(p.orcamento) || 0, locale)}</td><td><Pill kind={estadoKind(p.estado)} noDot>{estadoLabel(p.estado)}</Pill></td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="plano-modal-title" size="md">
        <ModalHead icon="doc" id="plano-modal-title" title={t.modal.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label={t.modal.champTitre} required full name="plano-titulo" error={errors.titulo}>
              <input type="text" placeholder={t.modal.titrePlaceholder} value={form.titulo} onChange={e => upd('titulo', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={t.modal.immeuble} name="plano-edif">
                <input type="text" placeholder={t.modal.immeublePlaceholder} value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
              </Field>
              <Field label={t.modal.statut} name="plano-estado">
                <select value={form.estado} onChange={e => upd('estado', e.target.value)}>
                  <option value="preparacao">{t.modal.options.preparacao}</option>
                  <option value="aprovado">{t.modal.options.aprovado}</option>
                  <option value="concluido">{t.modal.options.concluido}</option>
                </select>
              </Field>
            </FormRow>
            <FormRow>
              <Field label={t.modal.anneeDebut} name="plano-ano">
                <input type="number" min="2000" max="2100" inputMode="numeric" placeholder="2026" value={form.anoInicio} onChange={e => upd('anoInicio', e.target.value)} />
              </Field>
              <Field label={t.modal.periodicite} name="plano-period">
                <input type="text" placeholder={t.modal.periodiciteDefaut} value={form.periodicidade} onChange={e => upd('periodicidade', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={t.modal.budget} hint={t.modal.budgetAide} name="plano-orc" suffix="€">
              <input type="number" step="0.01" min="0" inputMode="decimal" placeholder="0" value={form.orcamento} onChange={e => upd('orcamento', e.target.value)} />
            </Field>
            <Field label={t.modal.description} full name="plano-desc">
              <textarea rows={3} placeholder={t.modal.descriptionPlaceholder} value={form.descricao} onChange={e => upd('descricao', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t.modal.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{t.modal.creer}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
