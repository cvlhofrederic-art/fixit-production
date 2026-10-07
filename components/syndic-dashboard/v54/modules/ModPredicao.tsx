'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import m from './modules.module.css'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { PREDICAO_MESSAGES } from './i18n/ModPredicao.messages'

/** Predição de Manutenção — port byte-exact du ModPredicao du bundle V5.7. */

export default function ModPredicao() {
  const t = useMessages(PREDICAO_MESSAGES)
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <KPIGrid items={[
        { icon: 'cog', num: 0, lbl: t.kpi.equipements },
        { icon: 'alert', num: 0, lbl: t.kpi.critiques, accent: 'rust' },
        { icon: 'chart', num: 0, lbl: t.kpi.degradation, accent: 'amber' },
        { icon: 'target', num: t.kpi.scoreMoyenValeur, lbl: t.kpi.scoreMoyen, accent: 'sage' },
        { icon: 'coin', num: '0 €', lbl: t.kpi.coutPrevu, accent: 'gold' },
      ]} />
      <Tabs defaultActive="dash" tabs={[
        { id: 'dash', icon: 'chart', label: t.onglets.dash },
        { id: 'eq', icon: 'wrench', label: t.onglets.eq },
        { id: 'tl', icon: 'calendar', label: t.onglets.tl },
        { id: 'al', icon: 'bell', label: t.onglets.al },
      ]} />
      <Panel title={t.repartition}>
        <div className={m.cardGrid4}>
          {t.risques.map((c) => (
            <div key={c[0]} style={{ textAlign: 'center', padding: 24, borderRadius: 12, background: `var(--v54-${c[1]}-50)`, color: `var(--v54-${c[1]}-700)` }}>
              <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 42 }}>0</div>
              <div style={{ fontSize: 12.5 }}>{c[0]}</div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title={t.parImmeuble}>
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--v54-navy-300)' }}>{t.choisirImmeuble}</div>
      </Panel>
    </>
  )
}
