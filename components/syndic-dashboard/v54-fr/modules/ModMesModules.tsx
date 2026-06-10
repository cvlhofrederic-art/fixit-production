'use client'

// Mes modules — port du ModOsMeusModulos du mockup v8 (FR).
// Catalogue de modules de la plateforme avec activation/désactivation (Toggle).

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Toggle } from '@/components/syndic-dashboard/v54/primitives/toggle'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'

/** [clé, nom, description, icône, actif par défaut] */
type CatalogRow = readonly [string, string, string, IconName, boolean]

const CATALOG: readonly CatalogRow[] = [
  ['cockpit', 'Cockpit du jour', 'Pilotage quotidien & échéances', 'bolt', true],
  ['mandats', 'Mandats judiciaires', 'Suivi des ordonnances & missions', 'scale', true],
  ['compta', 'Comptabilité', 'Compte séparé, appels, reddition', 'bank', true],
  ['canal', 'Canal de communication', 'Échanges par dossier', 'chat', true],
  ['planning', 'Planning', 'Agenda hebdomadaire', 'calendar', true],
  ['doleances', 'Doléances', 'Incidents & réclamations', 'clipboard', true],
  ['rgpd', 'Centre RGPD', 'Registre & droits des titulaires', 'shield', false],
  ['signature', 'Signature électronique', 'Documents en signature eIDAS', 'pencil', false],
  ['nps', 'NPS prestataires', 'Satisfaction post-intervention', 'poll', false],
]

const cardHeadRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as const

export default function ModMesModules() {
  const { push } = useToast()
  const [on, setOn] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {}
    CATALOG.forEach((c) => { o[c[0]] = c[4] })
    return o
  })
  const n = Object.values(on).filter(Boolean).length
  return (
    <>
      <PageHead eyebrow="Système" title="Mes modules"
        lede="Activez ou désactivez les modules de la plateforme selon vos besoins." />
      <KPIGrid items={[
        { icon: 'grid', num: n, lbl: 'Modules actifs', accent: 'sage' },
        { icon: 'grid', num: CATALOG.length, lbl: 'Disponibles' },
        { icon: 'sparkle', num: 'IA', lbl: 'Assistants inclus', accent: 'gold' },
      ]} />
      <Panel title="Catalogue de modules" icon="grid">
        <div className={m.cardGrid3}>
          {CATALOG.map(([k, name, desc, icon]) => (
            <div key={k} style={{ padding: 16, border: '1px solid var(--v54-line)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8, background: on[k] ? 'var(--v54-sage-50)' : 'transparent' }}>
              <div style={cardHeadRow}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13.5 }}><Icon name={icon} />{name}</span>
                <Toggle on={on[k]} onToggle={() => { setOn((s) => ({ ...s, [k]: !s[k] })); push({ kind: 'info', title: on[k] ? `${name} désactivé` : `${name} activé` }) }} aria-label={name} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--v54-navy-500)' }}>{desc}</div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
