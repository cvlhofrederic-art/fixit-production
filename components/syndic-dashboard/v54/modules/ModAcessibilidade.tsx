'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Alert } from '../primitives/alert'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useComingSoon } from './use-coming-soon'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages, useV54Locale } from '@/lib/syndic/v54/i18n'
import { ACESSIBILIDADE_MESSAGES } from './i18n/ModAcessibilidade.messages'

/** Acessibilidade dos Edifícios — port byte-exact V5.7 + Phase C : diagnóstico IA Alfredo (DL 163/2006).
 * Version française : droit français de l'accessibilité ; la route reçoit locale 'fr' pour son prompt FR. */

type Cor = 'sage' | 'gold' | 'amber' | 'rust'
/** Couleur de chaque critère (textes dans le dictionnaire, même ordre). */
const CRITERIOS_COR: Cor[] = ['sage', 'sage', 'gold', 'amber', 'sage', 'gold']

export default function ModAcessibilidade() {
  const t = useMessages(ACESSIBILIDADE_MESSAGES)
  const locale = useV54Locale()
  const md = t.modale
  const soon = useComingSoon()
  const { push } = useToast()
  const data = useSyndicData()
  const real = data.authenticated
  const [open, setOpen] = useState(false)
  const [edificio, setEdificio] = useState('')
  const [notas, setNotas] = useState('')
  const [busy, setBusy] = useState(false)
  const [analise, setAnalise] = useState('')
  const openAnalise = () => { setEdificio(''); setNotas(''); setAnalise(''); setOpen(true) }
  const analisar = () => {
    if (!edificio.trim()) { push({ kind: 'info', title: t.toasts.immeubleTitre, desc: t.toasts.immeubleDesc }); return }
    if (!real || !data.token) { push({ kind: 'info', title: t.toasts.connexionTitre, desc: t.toasts.connexionDesc }); return }
    setBusy(true)
    fetch('/api/syndic/acessibilidade-analise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
      // PT : corps inchangé ; FR : locale 'fr' sélectionne le prompt français de la route.
      body: JSON.stringify(locale === 'fr-FR' ? { edificio, notas, locale: 'fr' } : { edificio, notas }),
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((d) => setAnalise(typeof d.analise === 'string' ? d.analise : ''))
      .catch(() => push({ kind: 'error', title: t.toasts.erreurTitre, desc: t.toasts.erreurDesc }))
      .finally(() => setBusy(false))
  }

  return (
    <>
      <PageHead eyebrow={t.surtitre} title={t.titre}
        lede={t.chapeau}
        actions={<><Button onClick={soon(t.bientotPhotos)}><Icon name="upload" />{t.importerPhotos}</Button><Button variant="gold" onClick={openAnalise}><Icon name="bot" />{t.analyseIA}</Button></>} />
      <Alert kind="gold" icon="scale" title={t.alerteTitre}>
        {t.alerteTexte}
      </Alert>
      <KPIGrid items={[
        { icon: 'building', num: 0, lbl: t.kpi.evalues, accent: 'gold' },
        { icon: 'check', num: 0, lbl: t.kpi.conformes, accent: 'sage' },
        { icon: 'alert', num: 0, lbl: t.kpi.nonConformes, accent: 'rust' },
        { icon: 'construction', num: 0, lbl: t.kpi.enPlan, accent: 'amber' },
        { icon: 'coin', num: '0,00 €', lbl: t.kpi.investissement },
        { icon: 'bot', num: 0, lbl: t.kpi.diagnostics, accent: 'sage' },
      ]} />
      <Tabs defaultActive="ed" tabs={[
        { id: 'ed', icon: 'building', label: t.onglets.ed },
        { id: 'chk', icon: 'clipboard', label: t.onglets.chk },
        { id: 'plano', icon: 'construction', label: t.onglets.plano },
      ]} />
      <Panel>
        <Empty illustration="condominos" title={t.videTitre}
          desc={t.videDesc}
          action={<Button variant="primary" onClick={openAnalise}><Icon name="bot" />{t.lancerEvaluation}</Button>} />
      </Panel>
      <Panel title={t.criteresTitre}>
        <div className={m.cardGrid3}>
          {t.criteres.map(([titre, s], i) => { const c = CRITERIOS_COR[i]; return (
            <div key={i} style={{ padding: 14, border: '1px solid var(--v54-line)', borderRadius: 10, background: `var(--v54-${c}-50)`, borderLeft: `3px solid var(--v54-${c}-500)` }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{titre}</div>
              <div style={{ fontSize: 11.5, color: 'var(--v54-navy-400)' }}>{s}</div>
            </div>
          ) })}
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="acess-title" size="md">
        <ModalHead icon="bot" id="acess-title" title={md.titre} onClose={() => setOpen(false)} />
        <ModalBody>
          <Field label={md.immeuble} full name="acess-ed">
            <input type="text" placeholder={md.immeublePlaceholder} value={edificio} onChange={(e) => setEdificio(e.target.value)} />
          </Field>
          <Field label={md.observations} full name="acess-not">
            <textarea rows={2} placeholder={md.observationsPlaceholder} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </Field>
          {analise && <div style={{ marginTop: 14, maxHeight: 320, overflow: 'auto', background: 'var(--v54-paper)', border: '1px solid var(--v54-line)', borderRadius: 8, padding: 14, fontSize: 12.5, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{analise}</div>}
        </ModalBody>
        <ModalFoot>
          <Button variant="ghost" onClick={() => setOpen(false)}>{md.fermer}</Button>
          <button type="button" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy} onClick={analisar}>{busy ? md.enCours : (analise ? md.relancer : md.analyser)}</button>
        </ModalFoot>
      </Modal>
    </>
  )
}
