'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Alert } from '../primitives/alert'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'
import { useComingSoon } from './use-coming-soon'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { RGPD_CENTER_MESSAGES } from './i18n/ModRGPDCenter.messages'

/** RGPD Compliance Center — port byte-exact du ModRGPDCenter du bundle V5.7. */

export default function ModRGPDCenter() {
  const t = useMessages(RGPD_CENTER_MESSAGES)
  const soon = useComingSoon()
  const a = t.alerte
  return (
    <>
      <PageHead eyebrow={t.surtitre} title={t.titre}
        lede={t.chapeau}
        actions={<><Button onClick={soon(t.nouvelleDemandeToast)}><Icon name="upload" />{t.nouvelleDemande}</Button><Button variant="gold" onClick={soon(t.exporterRegistreToast)}><Icon name="doc" />{t.exporterRegistre}</Button></>} />
      <Alert kind="gold" icon="scale" title={a.titre}>
        {a.a}<strong>{a.fort1}</strong>{a.b}<strong>{a.fort2}</strong>{a.c}<strong>{a.fort3}</strong>{a.d}
      </Alert>
      <KPIGrid items={[
        { icon: 'doc', num: 0, lbl: t.kpi.traitements, accent: 'gold' },
        { icon: 'bell', num: 0, lbl: t.kpi.demandes, accent: 'amber' },
        { icon: 'check', num: 0, lbl: t.kpi.dansLesDelais, accent: 'sage' },
        { icon: 'alert', num: 0, lbl: t.kpi.prochesEcheance, accent: 'rust' },
        { icon: 'ban', num: 0, lbl: t.kpi.violations, accent: 'rust' },
        { icon: 'bot', num: t.kpi.fixyNum, lbl: t.kpi.fixy },
      ]} />
      <Tabs defaultActive="sol" tabs={[
        { id: 'sol', icon: 'bell', label: t.onglets.sol },
        { id: 'trat', icon: 'doc', label: t.onglets.trat },
        { id: 'log', icon: 'archive', label: t.onglets.log },
        { id: 'pol', icon: 'shield', label: t.onglets.pol },
        { id: 'viol', icon: 'alert', label: t.onglets.viol },
      ]} />
      <Panel>
        <Empty illustration="documentos" title={t.vide.titre}
          desc={t.vide.desc}
          action={<Button variant="primary" onClick={soon(t.vide.actionToast)}><Icon name="bell" />{t.vide.action}</Button>} />
      </Panel>
      <Panel title={t.droitsTitre}>
        <div className={m.cardGrid3}>
          {t.droits.map(([titre, s, c], i) => (
            <div key={i} style={{ padding: 14, border: '1px solid var(--v54-line)', borderRadius: 10, background: `var(--v54-${c}-50)`, borderLeft: `3px solid var(--v54-${c}-500)` }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{titre}</div>
              <div style={{ fontSize: 11.5, color: 'var(--v54-navy-400)' }}>{s}</div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
