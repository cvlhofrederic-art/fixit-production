'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Tabs } from '../primitives/tabs'
import { Pill, type PillKind } from '../primitives/pill'
import { KPIGrid } from '../primitives/kpi'
import { Button } from '../primitives/button'
import { Alert } from '../primitives/alert'
import { Empty } from '../primitives/empty'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Infracao } from '@/lib/syndic/v54/api'
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { INFRACOES_MESSAGES } from './i18n/ModInfracoes.messages'

/** Acompanhamento de Infrações — page net-new + lot fonctionnel.
 * Syndic connecté → vraies infractions du cabinet (data.infracoes) + création POST ;
 * anonyme → preview byte-exact (design showcase V5.7). */

type Etapa = Infracao['etapa']
type InfForm = { tipo: string; condomino: string; edificio: string; etapa: Etapa; multa: string; descricao: string }

const fmtMulta = (n: number, locale: V54Locale, montant: (n: string) => string) => (n > 0 ? montant(new Intl.NumberFormat(locale).format(n)) : '—')
const etapaLabel = (v: string, labels: Record<string, string>) => labels[v] || v
const etapaKind = (v: string): PillKind => (({ sinalizada: 'gold', analise: 'amber', notificacao: 'amber', multa: 'rust', resolvida: 'sage' } as Record<string, PillKind>)[v] || 'gold')

/** Étapes du panneau (code de l'API, couleur) ; le libellé vient du dictionnaire. */
const PIPELINE_DEF: Array<[Etapa, PillKind]> = [
  ['sinalizada', 'gold'],
  ['analise', 'amber'],
  ['notificacao', 'amber'],
  ['multa', 'rust'],
  ['resolvida', 'sage'],
]

export default function ModInfracoes() {
  const t = useMessages(INFRACOES_MESSAGES)
  const locale = useV54Locale()
  const f = t.formulaire
  const data = useSyndicData()
  const real = data.authenticated
  const all: Infracao[] = real ? (data.infracoes ?? []) : t.demo

  const blank: InfForm = { tipo: '', condomino: '', edificio: '', etapa: 'sinalizada', multa: '', descricao: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<InfForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof InfForm, string>>>({})
  const [busy, setBusy] = useState(false)
  const { push } = useToast()

  const upd = (k: keyof InfForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.tipo.trim()) { setErrors({ tipo: t.erreurType }); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/infracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ tipo: form.tipo, condomino: form.condomino, edificio: form.edificio, etapa: form.etapa, multa: Number(form.multa) || 0, descricao: form.descricao }),
      })
        .then(r => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: t.toasts.enregistree, desc: form.tipo }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreur, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: t.toasts.enregistreeDemo, desc: t.toasts.connexionRequise })
  }

  const abertas = all.filter(i => i.etapa !== 'resolvida').length
  const emProcesso = all.filter(i => i.etapa === 'analise' || i.etapa === 'notificacao' || i.etapa === 'multa').length
  const multasTotal = all.reduce((s, i) => s + (Number(i.multa) || 0), 0)
  const resolvidas = all.filter(i => i.etapa === 'resolvida').length

  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau}
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.nouvelle}</Button>} />
      <Tabs defaultActive="pipeline" tabs={[
        { id: 'pipeline', icon: 'chart', label: t.onglets.pipeline },
        { id: 'infracoes', icon: 'alert', label: t.onglets.infracoes },
        { id: 'modelos', icon: 'doc', label: t.onglets.modelos },
        { id: 'hist', icon: 'clock', label: t.onglets.hist },
      ]} />
      <Alert kind="gold" icon="scale" title={t.alerte.titre}>
        {t.alerte.texte}
      </Alert>
      <KPIGrid items={[
        { icon: 'alert', num: abertas, lbl: t.kpi.ouvertes, accent: abertas ? 'rust' : undefined },
        { icon: 'clock', num: emProcesso, lbl: t.kpi.enCours, accent: emProcesso ? 'amber' : undefined },
        { icon: 'coin', num: fmtMulta(multasTotal, locale, t.montant).replace('€', '').trim() || '0', cur: '€', lbl: t.kpi.montants },
        { icon: 'check', num: resolvidas, lbl: t.kpi.resolues, accent: resolvidas ? 'sage' : undefined },
      ]} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}>
        <Panel title={t.panneauEtapes}>
          {PIPELINE_DEF.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < PIPELINE_DEF.length - 1 ? '1px solid var(--v54-line)' : 'none' }}>
              <span>{t.etapesPipeline[p[0]]}</span><Pill kind={p[1]} noDot>{all.filter(x => x.etapa === p[0]).length}</Pill>
            </div>
          ))}
        </Panel>
        <Panel title={t.panneauModeles}>
          {t.modeles.map((modele, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < t.modeles.length - 1 ? '1px solid var(--v54-line)' : 'none' }}>
              <Icon name="doc" /><span>{modele}</span>
            </div>
          ))}
        </Panel>
      </div>
      <Panel title={t.panneauListe} flush>
        {real && all.length === 0 ? (
          <Empty illustration="documentos" title={t.vide.titre} desc={t.vide.desc}
            action={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.nouvelle}</Button>} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{t.colonnes.type}</th><th>{t.colonnes.coproprietaire}</th><th>{t.colonnes.immeuble}</th><th>{t.colonnes.etape}</th><th>{t.colonnes.montant}</th></tr></thead>
              <tbody>{all.map(inf => (
                <tr key={inf.id}><td><b>{inf.tipo}</b></td><td>{inf.condomino || '—'}</td><td>{inf.edificio || '—'}</td><td><Pill kind={etapaKind(inf.etapa)} noDot>{etapaLabel(inf.etapa, t.etapes)}</Pill></td><td className={m.numCell}>{fmtMulta(Number(inf.multa) || 0, locale, t.montant)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="inf-modal-title" size="md">
        <ModalHead icon="alert" id="inf-modal-title" title={f.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label={f.type} required full name="inf-tipo" error={errors.tipo}>
              <input type="text" placeholder={f.typePlaceholder} value={form.tipo} onChange={e => upd('tipo', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={f.coproprietaire} name="inf-cond">
                <input type="text" placeholder={f.coproprietairePlaceholder} value={form.condomino} onChange={e => upd('condomino', e.target.value)} />
              </Field>
              <Field label={f.immeuble} name="inf-edif">
                <input type="text" placeholder={f.immeublePlaceholder} value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={f.etape} name="inf-etapa">
                <select value={form.etapa} onChange={e => upd('etapa', e.target.value)}>
                  <option value="sinalizada">{t.etapes.sinalizada}</option>
                  <option value="analise">{t.etapes.analise}</option>
                  <option value="notificacao">{t.etapes.notificacao}</option>
                  <option value="multa">{t.etapes.multa}</option>
                  <option value="resolvida">{t.etapes.resolvida}</option>
                </select>
              </Field>
              <Field label={f.montant} hint={f.montantAide} name="inf-multa" suffix="€">
                <input type="number" step="0.01" min="0" inputMode="decimal" placeholder="0" value={form.multa} onChange={e => upd('multa', e.target.value)} />
              </Field>
            </FormRow>
            <Field label={f.description} full name="inf-desc">
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
