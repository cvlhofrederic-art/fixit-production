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
import { downloadReportPdf } from '@/lib/syndic/v54/report-pdf'
import { useMessages, useV54Locale } from '@/lib/syndic/v54/i18n'
import { dateApi } from '@/lib/syndic/v54/i18n/dates'
import { PROCURACOES_MESSAGES } from './i18n/ModProcuracoes.messages'

/** Procurações & Lista de Presenças — port byte-exact V5.7 + Phase 3 : tracker réel. */

const statutKind = (s: string): PillKind => (s === 'expirada' ? 'rust' : 'sage')

export default function ModProcuracoes() {
  const t = useMessages(PROCURACOES_MESSAGES)
  const locale = useV54Locale()
  // Phase 3 : vraies procurations du cabinet si syndic connecté, sinon mock/empty (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.procuracoes ?? []) : []

  const arquivadas = all.length
  const aExpirar = all.filter((p) => p.statut === 'expirada').length

  // Phase 3 écritures : « Registar procuração » → POST /api/syndic/procuracoes.
  const { push } = useToast()
  const blank = { condomino: '', procurador: '', fracao: '', immeuble: '', dataValidade: '', agRef: '', statut: 'valida' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.condomino.trim()) errs.condomino = t.erreurMandant
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/procuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ condomino: form.condomino, procurador: form.procurador, fracao: form.fracao, immeuble: form.immeuble, dataValidade: form.dataValidade, agRef: form.agRef, statut: form.statut }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: t.toasts.enregistre, desc: form.condomino }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurEnregistrement, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: t.toasts.enregistreDemo, desc: t.toasts.connexionRequise })
  }

  const exportPresencas = () => {
    if (!real || all.length === 0) { push({ kind: 'info', title: t.toasts.feuilleTitre, desc: real ? t.toasts.feuilleVide : t.toasts.feuilleConnexion }); return }
    const statutLabel = (s: string) => (s === 'expirada' ? t.statuts.expire : t.statuts.valide)
    downloadReportPdf(t.pdf.fichier, {
      title: t.pdf.titre,
      subtitle: t.pdf.sousTitre,
      tables: [{ headers: t.pdf.colonnes, rows: all.map((p) => [p.condomino || '—', p.fracao || '—', p.procurador || '—', dateApi(p.dataValidade, locale) || '—', statutLabel(p.statut), '']) }],
    }, locale)
  }

  const md = t.modal
  return (
    <>
      <PageHead eyebrow={t.surtitre} title={t.titre}
        lede={t.chapeau}
        actions={<><Button onClick={openNew}><Icon name="upload" />{t.enregistrer}</Button><Button variant="gold" onClick={exportPresencas}><Icon name="bank" />{t.genererFeuille}</Button></>} />
      <Alert kind="gold" icon="scale" title={t.cadre.titre}>
        {t.cadre.texte}
      </Alert>
      <KPIGrid items={[
        { icon: 'doc', num: real ? arquivadas : 0, lbl: t.kpi.archives },
        { icon: 'bot', num: real ? '—' : t.kpi.confianceVide, lbl: t.kpi.confiance, accent: 'sage' },
        { icon: 'check', num: 0, lbl: t.kpi.controles, accent: 'sage' },
        { icon: 'alert', num: 0, lbl: t.kpi.erreurs, accent: 'rust' },
        { icon: 'clock', num: real ? aExpirar : 0, lbl: t.kpi.aExpirer, accent: 'amber' },
        { icon: 'bank', num: 0, lbl: t.kpi.agCompletes, accent: 'gold' },
      ]} />
      <Tabs defaultActive="proc" tabs={[
        { id: 'proc', icon: 'doc', label: t.onglets.pouvoirs(real ? arquivadas : 0) },
        { id: 'pres', icon: 'team', label: t.onglets.feuilles },
      ]} />
      {all.length === 0 ? (
        <Panel>
          <Empty illustration="ag" title={t.vide.titre}
            desc={t.vide.desc}
            action={<Button variant="primary" onClick={openNew}><Icon name="upload" />{t.vide.action}</Button>} />
        </Panel>
      ) : (
        <Panel flush>
          {all.map((p) => (
            <div key={p.id} style={{ padding: '16px 22px', borderBottom: '1px solid var(--v54-line)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 17, fontWeight: 500 }}>{p.condomino}{p.fracao ? ` · ${p.fracao}` : ''}</div>
                <div style={{ fontSize: 12.5, color: 'var(--v54-navy-300)', marginTop: 2 }}>{t.representePar}{p.procurador || '—'}{p.agRef ? ` · ${p.agRef}` : ''}{p.immeuble ? ` · ${p.immeuble}` : ''}</div>
              </div>
              {p.dataValidade && <span style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{t.validite}{dateApi(p.dataValidade, locale)}</span>}
              <Pill kind={statutKind(p.statut)} noDot>{p.statut === 'expirada' ? t.statuts.expire : t.statuts.valide}</Pill>
            </div>
          ))}
        </Panel>
      )}
      <Panel title={t.traitement.titre} sub={t.traitement.sousTitre}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {t.traitement.etapes.map(([n, intitule, s], i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 14px', background: 'var(--v54-cream)', borderRadius: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--v54-gold-500)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>{n}</div>
              <div><div style={{ fontWeight: 600, fontSize: 13 }}>{intitule}</div><div style={{ fontSize: 12, color: 'var(--v54-navy-400)' }}>{s}</div></div>
            </div>
          ))}
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="npc-title" size="md">
        <ModalHead icon="doc" id="npc-title" title={md.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <FormRow>
              <Field label={md.mandant} required name="npc-cond" error={errors.condomino}>
                <input type="text" placeholder={md.mandantPlaceholder} value={form.condomino} onChange={(e) => upd('condomino', e.target.value)} />
              </Field>
              <Field label={md.mandataire} name="npc-proc">
                <input type="text" placeholder={md.mandatairePlaceholder} value={form.procurador} onChange={(e) => upd('procurador', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={md.lot} name="npc-frac">
                <input type="text" placeholder={md.lotPlaceholder} value={form.fracao} onChange={(e) => upd('fracao', e.target.value)} />
              </Field>
              <Field label={md.immeuble} name="npc-imovel">
                <input type="text" placeholder={md.immeublePlaceholder} value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={md.ag} name="npc-ag">
                <input type="text" placeholder={md.agPlaceholder} value={form.agRef} onChange={(e) => upd('agRef', e.target.value)} />
              </Field>
              <Field label={md.validite} name="npc-val">
                <input type="text" placeholder={md.validitePlaceholder} value={form.dataValidade} onChange={(e) => upd('dataValidade', e.target.value)} />
              </Field>
            </FormRow>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{md.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{md.enregistrer}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
