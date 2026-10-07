'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill } from '../primitives/pill'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import { useComingSoon } from './use-coming-soon'
import type { IconName } from '@/lib/syndic/icon-names'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { PORTAL_MESSAGES } from './i18n/ModPortal.messages'
import m from './modules.module.css'

/** Portal do Condómino — port byte-exact du ModPortal du bundle V5.7. */

const eur = <span style={{ fontSize: 22, fontStyle: 'italic', color: 'var(--v54-gold-700)', marginLeft: 4 }}>€</span>

/** Actions rapides : icône + clé du libellé dans le dictionnaire. */
const ACTIONS: readonly (readonly [IconName, 'recus' | 'attestation' | 'incident' | 'contact'])[] = [
  ['clipboard', 'recus'],
  ['doc', 'attestation'],
  ['wrench', 'incident'],
  ['chat', 'contact'],
]

const qaBtn = { padding: '18px', flexDirection: 'column', gap: 10, minHeight: 110, background: 'var(--v54-cream)' } as const

export default function ModPortal() {
  const t = useMessages(PORTAL_MESSAGES)
  const soon = useComingSoon()
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <Tabs defaultActive="vg" tabs={[
        { id: 'vg', icon: 'chart', label: t.onglets.vg },
        { id: 'cc', icon: 'coin', label: t.onglets.cc },
        { id: 'dc', icon: 'doc', label: t.onglets.dc },
        { id: 'cm', icon: 'chat', label: t.onglets.cm, badge: 1 },
        { id: 'pd', icon: 'pencil', label: t.onglets.pd },
      ]} />
      <KPIGrid items={[
        { icon: 'coin', num: '0,00', numChildren: eur, lbl: t.kpi.solde, subChildren: <Pill kind="sage" noDot>{t.kpi.aJour}</Pill> },
        { icon: 'calendar', accent: 'amber', num: '85,00', numChildren: eur, lbl: t.kpi.prochainAppel, sub: t.kpi.echeance },
        { icon: 'check', accent: 'sage', num: '85,00', numChildren: eur, lbl: t.kpi.dernierPaiement, sub: t.kpi.dateDernierPaiement },
        { icon: 'grid', accent: 'gold', num: t.kpi.lot, numStyle: { fontSize: 28 }, lbl: t.kpi.etage, sub: t.kpi.tantiemes },
      ]} />
      <Panel title={t.actionsTitre}>
        <div className={m.cardGrid4}>
          {ACTIONS.map((a) => { const label = t.actions[a[1]]; return (
            <Button key={label} style={qaBtn} onClick={soon(label)}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)' }}><Icon name={a[0]} /></div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
            </Button>
          ) })}
        </div>
      </Panel>
      <Panel title={t.avisTitre} flush>
        {t.avis.map((a) => (
          <div key={a.titre} style={{ padding: '14px 22px', borderBottom: '1px solid var(--v54-line)', borderLeft: `3px solid var(--v54-${a.teinte}-500)` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontWeight: 600 }}>{a.titre}</div>
              <Pill kind={a.teinte} noDot>{a.categorie}</Pill>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--v54-navy-500)' }}>{a.extrait}…</div>
            <div style={{ fontSize: 11, color: 'var(--v54-navy-300)', marginTop: 4 }}>{a.date}</div>
          </div>
        ))}
      </Panel>
    </>
  )
}
