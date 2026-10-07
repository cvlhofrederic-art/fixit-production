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
import { AG_LIVE_MESSAGES } from './i18n/ModAGLive.messages'

/** Assembleia Geral Digital — port byte-exact du ModAGLive du bundle V5.7. */

export default function ModAGLive() {
  const t = useMessages(AG_LIVE_MESSAGES)
  const soon = useComingSoon()
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <KPIGrid items={[
        { icon: 'bank', num: 0, lbl: t.kpi.total },
        { icon: 'check', num: 0, lbl: t.kpi.cloturees, accent: 'sage' },
        { icon: 'users', num: 0, lbl: t.kpi.presents, accent: 'gold' },
        { icon: 'poll', num: t.kpi.voixValeur, lbl: t.kpi.voix, accent: 'amber' },
      ]} />
      <Tabs defaultActive="live" tabs={[
        { id: 'live', label: t.onglets.live },
        { id: 'ag', icon: 'calendar', label: t.onglets.ag },
        { id: 'hist', icon: 'stamp', label: t.onglets.hist },
        { id: 'cfg', icon: 'cog', label: t.onglets.cfg },
      ]} />
      <Panel>
        <Empty
          illustration="ag"
          title={t.vide.titre}
          desc={t.vide.desc}
          action={<Button variant="gold" onClick={soon(t.planifier, t.planificationBientot)}><Icon name="calendar" />{t.planifier}</Button>}
        />
      </Panel>
    </>
  )
}
