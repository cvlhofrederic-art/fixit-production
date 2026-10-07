'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import { useComingSoon } from './use-coming-soon'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { QRCODE_MESSAGES } from './i18n/ModQRCode.messages'

/** QR Code por Fração — port byte-exact du ModQRCode du bundle V5.7. */

const selectStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 14 } as const

export default function ModQRCode() {
  const t = useMessages(QRCODE_MESSAGES)
  const soon = useComingSoon()
  return (
    <>
      <PageHead
        title={t.titre}
        lede={t.chapeau}
        actions={<Button variant="gold" onClick={soon(t.bientot.titre, t.bientot.desc)}><Icon name="plus" />{t.nouveauBouton}</Button>}
      />
      <KPIGrid items={[
        { icon: 'qr', num: 0, lbl: t.kpi.actifs, accent: 'gold' },
        { icon: 'target', num: 0, lbl: t.kpi.scans },
        { icon: 'alert', num: 0, lbl: t.kpi.signalements, accent: 'rust' },
        { icon: 'check', num: 0, lbl: t.kpi.resolus, accent: 'sage' },
      ]} />
      <Tabs defaultActive="ger" tabs={[
        { id: 'ger', icon: 'qr', label: t.onglets.ger },
        { id: 'sig', icon: 'siren', label: t.onglets.sig },
        { id: 'est', icon: 'chart', label: t.onglets.est },
      ]} />
      <select aria-label={t.filtreAria} style={selectStyle}><option>{t.tousLesImmeubles}</option></select>
      <Panel>
        <Empty
          illustration="documentos"
          title={t.vide.titre}
          desc={t.vide.desc}
          action={<Button variant="gold" onClick={soon(t.bientot.titre, t.bientot.desc)}><Icon name="plus" />{t.nouveauBouton}</Button>}
        />
      </Panel>
    </>
  )
}
