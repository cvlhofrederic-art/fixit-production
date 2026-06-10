'use client'

// Assurances — port du ModSeguros du mockup v8 (L6574-6602).
// Contrats d'assurance des copropriétés (RC obligatoire art. 9-1 loi 1965 / loi ALUR).

import type { CSSProperties } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'

type AssurTint = 'sage' | 'amber' | 'gold'
type AssurRow = readonly [string, string, string, AssurTint]

const ASSUR: AssurRow[] = [
  ['Multirisque immeuble', 'Generali · police n° MRI-44120', 'Échéance 31/12/2026', 'sage'],
  ['RC du syndicat (obligatoire)', 'AXA · Loi ALUR art. 9-1', 'Échéance 31/12/2026', 'sage'],
  ['Dommages-ouvrage', 'SMABTP · travaux toiture Les Tilleuls', 'En cours de souscription', 'amber'],
  ['Protection juridique', 'MMA · contentieux copropriété', 'Échéance 30/06/2026', 'gold'],
]

const cardStyle = (c: AssurTint): CSSProperties => ({
  padding: 16,
  border: '1px solid var(--v54-line)',
  borderRadius: 10,
  background: `var(--v54-${c}-50)`,
  borderLeft: `3px solid var(--v54-${c}-500)`,
})
const cardHeadStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 } as const
const cardTitleStyle = { fontWeight: 600, fontSize: 13.5, marginBottom: 2 } as const
const cardSubStyle = { fontSize: 12, color: 'var(--v54-navy-500)' } as const
const cardEchStyle = { fontSize: 11.5, color: 'var(--v54-navy-400)', marginTop: 6 } as const

export default function ModAssurance() {
  const { push } = useToast()
  return (
    <>
      <PageHead eyebrow="Patrimoine · Assurances" title="Assurances"
        lede="Contrats d'assurance des copropriétés sous mandat (RC obligatoire au titre de la loi ALUR)."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Nouveau contrat', desc: "Référencer un contrat d'assurance" })}><Icon name="shield" />Nouveau contrat</Button>} />
      <KPIGrid items={[
        { icon: 'shield', num: 4, lbl: 'Contrats actifs', accent: 'sage' },
        { icon: 'check', num: 'OK', lbl: 'RC obligatoire couverte', accent: 'sage' },
        { icon: 'clock', num: 1, lbl: 'Échéance < 90 j', accent: 'amber' },
      ]} />
      <Panel title="Contrats en cours" icon="shield">
        <div className={m.cardGrid}>
          {ASSUR.map(([t, s, e, c]) => (
            <div key={t} style={cardStyle(c)}>
              <div style={cardHeadStyle}>
                <div style={cardTitleStyle}>{t}</div>
                <Button variant="ghost" size="sm" onClick={() => push({ kind: 'info', title: t, desc: 'Ouvrir le contrat' })}>Voir</Button>
              </div>
              <div style={cardSubStyle}>{s}</div>
              <div style={cardEchStyle}>{e}</div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
