'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import { useComingSoon } from './use-coming-soon'
import m from './modules.module.css'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { LANCAMENTO_FAT_MESSAGES } from './i18n/ModLancamentoFat.messages'

/** Lançamento IA de Faturas — port byte-exact du ModLancamentoFat du bundle V5.7. */

export default function ModLancamentoFat() {
  const soon = useComingSoon()
  const t = useMessages(LANCAMENTO_FAT_MESSAGES)
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <KPIGrid items={[
        { icon: 'doc', num: 8, lbl: t.kpi.total },
        { icon: 'clock', num: 4, lbl: t.kpi.attente, accent: 'amber' },
        { icon: 'check', num: 4, lbl: t.kpi.validees, accent: 'sage' },
        { icon: 'alert', num: 3, lbl: t.kpi.anomalies, accent: 'rust' },
      ]} />
      <Tabs defaultActive="imp" tabs={[
        { id: 'imp', icon: 'upload', label: t.onglets.imp },
        { id: 'esp', icon: 'clock', label: t.onglets.esp, badge: 4 },
        { id: 'trat', icon: 'check', label: t.onglets.trat },
        { id: 'an', icon: 'alert', label: t.onglets.an, badge: 3 },
        { id: 'cfg', icon: 'cog', label: t.onglets.cfg },
      ]} />
      <div className={m.dropZone}>
        <div className={m.icoLg}><Icon name="folder" /></div>
        <h4>{t.depot.titre}</h4>
        <p>{t.depot.formats}</p>
        <Button variant="gold" onClick={soon(t.parcourir, t.parcourirEnCours)}><Icon name="search" />{t.parcourir}</Button>
      </div>
    </>
  )
}
