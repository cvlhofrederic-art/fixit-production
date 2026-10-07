'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Alert } from '../primitives/alert'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'
import { useComingSoon } from './use-coming-soon'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { CCTV_MESSAGES } from './i18n/ModCCTV.messages'

/** Câmaras de Vigilância — port byte-exact du ModCCTV du bundle V5.7. */

export default function ModCCTV() {
  const soon = useComingSoon()
  const t = useMessages(CCTV_MESSAGES)
  const a = t.alerte
  const c = t.colonnes
  return (
    <>
      <PageHead eyebrow={t.surtitre} title={t.titre}
        lede={t.chapeau}
        actions={<><Button onClick={soon(t.enregistrerCameraToast, t.enregistrerCameraDesc)}><Icon name="plus" />{t.enregistrerCamera}</Button><Button variant="gold" onClick={soon(t.genererPanneauxToast)}><Icon name="doc" />{t.genererPanneaux}</Button></>} />
      <Alert kind="gold" icon="scale" title={a.titre}>
        <strong>{a.fort1}</strong>{a.suite1}<strong>{a.fort2}</strong>{a.suite2}<strong>{a.fort3}</strong>{a.suite3}<strong>{a.fort4}</strong>{a.suite4}
      </Alert>
      <KPIGrid items={[
        { icon: 'monitor', num: 0, lbl: t.kpi.cameras },
        { icon: 'building', num: 0, lbl: t.kpi.immeubles },
        { icon: 'check', num: 0, lbl: t.kpi.signalisation, accent: 'sage' },
        { icon: 'doc', num: 0, lbl: t.kpi.autorisations, accent: 'gold' },
        { icon: 'alert', num: 0, lbl: t.kpi.conservation, accent: 'rust' },
        { icon: 'archive', num: 0, lbl: t.kpi.journal, accent: 'sage' },
      ]} />
      <Tabs defaultActive="cam" tabs={[
        { id: 'cam', icon: 'monitor', label: t.onglets.cam },
        { id: 'sin', icon: 'doc', label: t.onglets.sin },
        { id: 'logs', icon: 'archive', label: t.onglets.logs },
      ]} />
      <Panel flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>{c.immeuble}</th><th>{c.emplacement}</th><th>{c.type}</th><th>{c.conservation}</th><th>{c.responsable}</th><th>{c.autorisation}</th><th>{c.signalisation}</th></tr></thead>
            <tbody><tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--v54-navy-400)' }}>{t.aucuneCamera}</td></tr></tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
