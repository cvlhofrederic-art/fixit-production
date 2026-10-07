'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Alert } from '../primitives/alert'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages, useV54Locale } from '@/lib/syndic/v54/i18n'
import { SEG_EDIFICIO_MESSAGES } from './i18n/ModSegEdificio.messages'

/** Segurança Contra Incêndio — port byte-exact V5.7 + Phase 3 : classifications réelles. */

const catKind = (c: string): PillKind => (c === '4' ? 'rust' : c === '3' ? 'amber' : 'sage')

export default function ModSegEdificio() {
  const t = useMessages(SEG_EDIFICIO_MESSAGES)
  const locale = useV54Locale()
  // Phase 3 : vraies classifications SCIE du cabinet si syndic connecté, sinon mock/empty.
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.segEdificios ?? []) : []

  const classificados = all.length
  const encarregados = all.filter((s) => s.encarregado.trim()).length
  const planos = all.filter((s) => s.planoEmergencia).length
  const exercicios = all.filter((s) => s.ultimoExercicio).length
  const cat4 = all.filter((s) => s.categoria === '4').length

  // Phase 3 écritures : « Classificar edifício » → POST /api/syndic/seg-edificio.
  const { push } = useToast()
  const blank = { immeuble: '', categoria: '1', encarregado: '', planoEmergencia: 'nao', ultimoExercicio: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.immeuble.trim()) errs.immeuble = t.erreurImmeuble
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/seg-edificio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ immeuble: form.immeuble, categoria: form.categoria, encarregado: form.encarregado, planoEmergencia: form.planoEmergencia === 'sim', ultimoExercicio: form.ultimoExercicio }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: t.toasts.classe, desc: form.immeuble }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurClassement, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: t.toasts.classeDemo, desc: t.toasts.connexionRequise })
  }

  // Phase C : « Gerar plano emergência (Alfredo) » → /api/syndic/seg-edificio-plano.
  const [planoOpen, setPlanoOpen] = useState(false)
  const [planoForm, setPlanoForm] = useState({ edificio: '', categoria: '1', encarregado: '' })
  const [planoBusy, setPlanoBusy] = useState(false)
  const [planoText, setPlanoText] = useState('')
  const pUpd = (k: keyof typeof planoForm, v: string) => setPlanoForm((s) => ({ ...s, [k]: v }))
  const openPlano = () => { setPlanoForm({ edificio: '', categoria: '1', encarregado: '' }); setPlanoText(''); setPlanoOpen(true) }
  const gerarPlano = () => {
    if (!planoForm.edificio.trim()) { push({ kind: 'info', title: t.toasts.immeuble, desc: t.toasts.indiquerImmeuble }); return }
    if (!real || !data.token) { push({ kind: 'info', title: t.toasts.plan, desc: t.toasts.connexionAlfredo }); return }
    setPlanoBusy(true)
    const corps = { edificio: planoForm.edificio, categoria: planoForm.categoria, encarregado: planoForm.encarregado }
    fetch('/api/syndic/seg-edificio-plano', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
      // FR : l'agent rédige selon le droit français (locale 'fr') ; corps PT inchangé.
      body: JSON.stringify(locale === 'fr-FR' ? { ...corps, locale: 'fr' } : corps),
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((d) => setPlanoText(typeof d.plano === 'string' ? d.plano : ''))
      .catch(() => push({ kind: 'error', title: t.toasts.erreur, desc: t.toasts.erreurPlan }))
      .finally(() => setPlanoBusy(false))
  }

  const fc = t.classement
  const p = t.plan
  return (
    <>
      <PageHead eyebrow={t.surtitre} title={t.titre}
        lede={t.chapeau}
        actions={<><Button onClick={openNew}><Icon name="building" />{t.classer}</Button><Button variant="gold" onClick={openPlano}><Icon name="bot" />{t.genererPlan}</Button></>} />
      <Alert kind="gold" icon="scale" title={t.alerte.titre}>
        {t.alerte.avant}<strong>{t.alerte.fort1}</strong>{t.alerte.milieu}<strong>{t.alerte.fort2}</strong>{t.alerte.apres}
      </Alert>
      <KPIGrid items={[
        { icon: 'building', num: real ? classificados : 0, lbl: t.kpi.classes },
        { icon: 'shield', num: real ? encarregados : 0, lbl: t.kpi.referents, accent: 'sage' },
        { icon: 'doc', num: real ? planos : 0, lbl: t.kpi.plans, accent: 'gold' },
        { icon: 'check', num: real ? exercicios : 0, lbl: t.kpi.exercices, accent: 'sage' },
        { icon: 'alert', num: real ? cat4 : 0, lbl: t.kpi.cat4, accent: 'rust' },
        { icon: 'clock', num: 0, lbl: t.kpi.enRetard, accent: 'amber' },
      ]} />
      <Tabs defaultActive="ed" tabs={[
        { id: 'ed', icon: 'building', label: t.onglets.ed(real ? classificados : 0) },
        { id: 'enc', icon: 'team', label: t.onglets.enc(real ? encarregados : 0) },
        { id: 'plano', icon: 'doc', label: t.onglets.plano(real ? planos : 0) },
        { id: 'ex', icon: 'check', label: t.onglets.ex },
      ]} />
      {all.length === 0 ? (
        <Panel>
          <Empty illustration="seguros" title={t.vide.titre}
            desc={t.vide.desc}
            action={<Button variant="primary" onClick={openNew}><Icon name="building" />{t.vide.action}</Button>} />
        </Panel>
      ) : (
        <Panel flush>
          {all.map((s) => (
            <div key={s.id} style={{ padding: '16px 22px', borderBottom: '1px solid var(--v54-line)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 17, fontWeight: 500 }}>{s.immeuble}</div>
                <div style={{ fontSize: 12.5, color: 'var(--v54-navy-300)', marginTop: 2 }}>{s.encarregado ? t.ligne.referent(s.encarregado) : t.ligne.sansReferent}{s.ultimoExercicio ? t.ligne.dernierExercice(s.ultimoExercicio) : ''}</div>
              </div>
              {s.planoEmergencia && <Pill kind="sage" noDot>{t.ligne.planOk}</Pill>}
              <Pill kind={catKind(s.categoria)} noDot>{t.ligne.categorie(s.categoria)}</Pill>
            </div>
          ))}
        </Panel>
      )}
      <Panel title={t.panneauCategories}>
        <div className={m.cardGrid}>
          {t.categories.map(([titre, desc, c], i) => (
            <div key={i} style={{ padding: 14, border: '1px solid var(--v54-line)', borderRadius: 10, background: `var(--v54-${c}-50)`, borderLeft: `3px solid var(--v54-${c}-500)` }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{titre}</div>
              <div style={{ fontSize: 11.5, color: 'var(--v54-navy-400)' }}>{desc}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="nsc-title" size="md">
        <ModalHead icon="building" id="nsc-title" title={fc.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label={fc.immeuble} required full name="nsc-imovel" error={errors.immeuble}>
              <input type="text" placeholder={fc.nomImmeuble} value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={fc.categorie} name="nsc-cat">
                <select value={form.categoria} onChange={(e) => upd('categoria', e.target.value)}>
                  <option value="1">{fc.options[1]}</option>
                  <option value="2">{fc.options[2]}</option>
                  <option value="3">{fc.options[3]}</option>
                  <option value="4">{fc.options[4]}</option>
                </select>
              </Field>
              <Field label={fc.plan} name="nsc-plano">
                <select value={form.planoEmergencia} onChange={(e) => upd('planoEmergencia', e.target.value)}>
                  <option value="nao">{fc.non}</option>
                  <option value="sim">{fc.oui}</option>
                </select>
              </Field>
            </FormRow>
            <FormRow>
              <Field label={fc.referent} name="nsc-enc">
                <input type="text" placeholder={fc.nomReferent} value={form.encarregado} onChange={(e) => upd('encarregado', e.target.value)} />
              </Field>
              <Field label={fc.dernierExercice} name="nsc-ex">
                <input type="text" placeholder={fc.formatDate} value={form.ultimoExercicio} onChange={(e) => upd('ultimoExercicio', e.target.value)} />
              </Field>
            </FormRow>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{fc.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{fc.classer}</button>
          </ModalFoot>
        </form>
      </Modal>

      <Modal open={planoOpen} onClose={() => setPlanoOpen(false)} labelledBy="plano-title" size="md">
        <ModalHead icon="bot" id="plano-title" title={p.titre} onClose={() => setPlanoOpen(false)} />
        <ModalBody>
          <FormRow>
            <Field label={p.immeuble} name="plano-ed">
              <input type="text" placeholder={p.nomImmeuble} value={planoForm.edificio} onChange={(e) => pUpd('edificio', e.target.value)} />
            </Field>
            <Field label={p.categorie} name="plano-cat">
              <select value={planoForm.categoria} onChange={(e) => pUpd('categoria', e.target.value)}>
                <option value="1">{p.options[1]}</option>
                <option value="2">{p.options[2]}</option>
                <option value="3">{p.options[3]}</option>
                <option value="4">{p.options[4]}</option>
              </select>
            </Field>
          </FormRow>
          <Field label={p.referent} full name="plano-enc">
            <input type="text" placeholder={p.nomFacultatif} value={planoForm.encarregado} onChange={(e) => pUpd('encarregado', e.target.value)} />
          </Field>
          {planoText && <div style={{ marginTop: 14, maxHeight: 320, overflow: 'auto', background: 'var(--v54-paper)', border: '1px solid var(--v54-line)', borderRadius: 8, padding: 14, fontSize: 12.5, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{planoText}</div>}
        </ModalBody>
        <ModalFoot>
          <Button variant="ghost" onClick={() => setPlanoOpen(false)}>{p.fermer}</Button>
          <button type="button" className={clsx(btnCss.btn, btnCss.gold)} disabled={planoBusy} onClick={gerarPlano}>{planoBusy ? p.enCours : (planoText ? p.regenerer : p.generer)}</button>
        </ModalFoot>
      </Modal>
    </>
  )
}
