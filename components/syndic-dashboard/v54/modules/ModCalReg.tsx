'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Pill } from '../primitives/pill'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Obrigacao } from '@/lib/syndic/v54/api'
import { useSyndicCreate } from './use-syndic-create'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { CAL_REG_MESSAGES } from './i18n/ModCalReg.messages'

/** Calendário Regulamentar — port V5.7 + lot 3 fonctionnel.
 * Syndic connecté → vraies obrigações du cabinet (data.obrigacoes) + création POST ;
 * anonyme → preview byte-exact. Le statut (expirado/urgente/próximo/em dia) est dérivé du prazo. */

type ObrForm = { edificio: string; tipo: string; descricao: string; prazo: string; concluido: string }
type Bucket = 'expirado' | 'urgente' | 'proximo' | 'emdia'

const daysTo = (d: string) => { const t = new Date(d).getTime(); return Number.isNaN(t) ? null : Math.ceil((t - Date.now()) / 86_400_000) }
const bucketOf = (o: Obrigacao): Bucket => {
  if (o.concluido) return 'emdia'
  const d = o.prazo ? daysTo(o.prazo) : null
  if (d === null) return 'proximo'
  if (d < 0) return 'expirado'
  if (d < 30) return 'urgente'
  if (d < 90) return 'proximo'
  return 'emdia'
}
/** Libellés relatifs d'échéance, selon la langue. */
type TextesRelatifs = { realisee: string; ilYa: (jours: number) => string; dans: (jours: number) => string }
const relLabel = (o: Obrigacao, r: TextesRelatifs): string => {
  if (o.concluido) return r.realisee
  const d = o.prazo ? daysTo(o.prazo) : null
  if (d === null) return '—'
  return d < 0 ? r.ilYa(-d) : r.dans(d)
}

const selectStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' } as const

export default function ModCalReg() {
  const t = useMessages(CAL_REG_MESSAGES)
  const data = useSyndicData()
  const real = data.authenticated
  const all: Obrigacao[] = real ? (data.obrigacoes ?? []) : t.demo
  const { busy, create } = useSyndicCreate('/api/syndic/obrigacoes')

  const blank: ObrForm = { edificio: '', tipo: '', descricao: '', prazo: '', concluido: 'nao' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ObrForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof ObrForm, string>>>({})

  const upd = (k: keyof ObrForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.tipo.trim()) { setErrors({ tipo: t.erreurs.type }); return }
    create(
      { edificio: form.edificio, tipo: form.tipo, descricao: form.descricao, prazo: form.prazo || null, concluido: form.concluido === 'sim' },
      { okTitle: t.obligationAjoutee, desc: form.tipo, onDone: () => setOpen(false) },
    )
  }

  const expirados = all.filter(o => bucketOf(o) === 'expirado').length
  const urgentes = all.filter(o => bucketOf(o) === 'urgente').length
  const proximos = all.filter(o => bucketOf(o) === 'proximo').length
  const emdia = all.filter(o => bucketOf(o) === 'emdia').length

  const fo = t.formulaire
  return (
    <>
      <PageHead
        title={t.titre}
        lede={t.chapeau}
        actions={<>
          <select aria-label={t.filtres.immeubleAria} style={selectStyle}><option>{t.filtres.immeubleTous}</option></select>
          <select aria-label={t.filtres.statutAria} style={selectStyle}><option>{t.filtres.statutTous}</option></select>
          <Button variant="gold" onClick={openNew}><Icon name="plus" />{t.ajouter}</Button>
        </>}
      />
      <KPIGrid items={[
        { dot: 'rust', accent: 'rust', num: expirados, lbl: t.kpi.expirees },
        { dot: 'amber', accent: 'amber', num: urgentes, lbl: t.kpi.urgentes },
        { dot: 'gold', accent: 'amber', num: proximos, lbl: t.kpi.proches },
        { dot: 'sage', accent: 'sage', num: emdia, lbl: t.kpi.aJour },
      ]} />
      {real && all.length === 0 ? (
        <Panel>
          <Empty illustration="eventos" title={t.vide.titre}
            desc={t.vide.description}
            action={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.vide.bouton}</Button>} />
        </Panel>
      ) : (
        <Panel flush>
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{t.colonnes.immeuble}</th><th>{t.colonnes.type}</th><th>{t.colonnes.description}</th><th>{t.colonnes.echeance}</th><th>{t.colonnes.statut}</th></tr></thead>
              <tbody>
                {all.map((o) => {
                  const b = bucketOf(o)
                  return (
                    <tr key={o.id}>
                      <td>{o.edificio || '—'}</td>
                      <td><Pill kind="gold" noDot>{o.tipo}</Pill></td>
                      <td>{o.descricao || '—'}</td>
                      <td>
                        <div className={m.numCell}>{o.prazo || '—'}</div>
                        <div style={{ fontSize: 11, color: b === 'expirado' ? 'var(--v54-rust-700)' : 'var(--v54-navy-300)' }}>{relLabel(o, t.relatif)}</div>
                      </td>
                      <td><span className={clsx(m.dotStatus, b === 'expirado' && m.dotStatusRust, (b === 'urgente' || b === 'proximo') && m.dotStatusAmber)} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="obr-modal-title" size="md">
        <ModalHead icon="calendar" id="obr-modal-title" title={fo.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label={fo.type} required name="obr-tipo" error={errors.tipo}>
                <input type="text" placeholder={fo.typePlaceholder} value={form.tipo} onChange={e => upd('tipo', e.target.value)} />
              </Field>
              <Field label={fo.immeuble} name="obr-edif">
                <input type="text" placeholder={fo.immeublePlaceholder} value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={fo.description} full name="obr-desc">
              <input type="text" placeholder={fo.descriptionPlaceholder} value={form.descricao} onChange={e => upd('descricao', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={fo.echeance} name="obr-prazo">
                <input type="date" value={form.prazo} onChange={e => upd('prazo', e.target.value)} />
              </Field>
              <Field label={fo.realisee} name="obr-concl">
                <select value={form.concluido} onChange={e => upd('concluido', e.target.value)}>
                  <option value="nao">{fo.non}</option>
                  <option value="sim">{fo.oui}</option>
                </select>
              </Field>
            </FormRow>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{fo.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{fo.ajouter}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
