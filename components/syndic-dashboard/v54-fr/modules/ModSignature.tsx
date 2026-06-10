'use client'

// Signature électronique — port du ModAssinaturaCMD du mockup v8 (FR).
// KPI + cartes de documents en signature (valeur probante eIDAS).

import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'

/** [document, partie, statut, couleur] */
type SignRow = readonly [string, string, string, 'sage' | 'amber']

const SIGN: readonly SignRow[] = [
  ["Contrat d'entretien ascenseur", 'Otis', 'signé', 'sage'],
  ['Procès-verbal AG 2025', 'Conseil syndical — Le Méridien', 'en attente', 'amber'],
  ['Devis travaux toiture', 'Ent. Toitures Nord', 'en attente', 'amber'],
  ['Mandat de prélèvement', 'SCI Belvédère', 'signé', 'sage'],
]

const signCard = { padding: 16, border: '1px solid var(--v54-line)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8 } as const
const cardHeadRow = { display: 'flex', justifyContent: 'space-between', gap: 8 } as const

export default function ModSignature() {
  const { push } = useToast()
  return (
    <>
      <PageHead eyebrow="Documents" title="Signature électronique"
        lede="Documents en signature électronique (valeur probante eIDAS)."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Nouvelle signature', desc: 'Envoyer un document à signer' })}><Icon name="pencil" />Envoyer à signer</Button>} />
      <KPIGrid items={[
        { icon: 'doc', num: 4, lbl: 'Documents' },
        { icon: 'check', num: 2, lbl: 'Signés', accent: 'sage' },
        { icon: 'clock', num: 2, lbl: 'En attente', accent: 'amber' },
        { icon: 'shield', num: 'eIDAS', lbl: 'Niveau de signature' },
      ]} />
      <Panel title="Documents" icon="pencil">
        <div className={m.cardGrid}>
          {SIGN.map(([t, who, st, c], i) => (
            <div key={i} style={signCard}>
              <div style={cardHeadRow}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t}</div>
                <Pill kind={c} noDot>{st}</Pill>
              </div>
              <div style={{ fontSize: 12, color: 'var(--v54-navy-500)' }}>{who}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="ghost" size="sm" onClick={() => push({ kind: st === 'signé' ? 'info' : 'success', title: st === 'signé' ? 'Document signé' : 'Relance envoyée', desc: t })}>{st === 'signé' ? 'Télécharger' : 'Relancer'}</Button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
