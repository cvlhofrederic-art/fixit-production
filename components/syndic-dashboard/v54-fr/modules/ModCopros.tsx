'use client'

// Copropriétés — port du `ModCopros` du mockup v8 (master data des 4 copropriétés).
// Cartes entité (entity-card du mockup, styles hoistés) + DetailModal.

import { useState, type CSSProperties, type ReactNode } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { Icon } from '@/components/syndic-dashboard/v54/primitives/icon'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import type { IconName } from '@/lib/syndic/icon-names'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import DetailModal, { type DetailField } from '../shared/DetailModal'
import { COPROS, TOTAL_LOTS, TOTAL_BUDGET } from '../data/mock'
import { fmtEUR } from '../lib/format'

interface Detail {
  title: ReactNode
  icon: IconName
  fields: DetailField[]
  footnote?: ReactNode
}

/* Port inline des classes .entity-card* du mockup (CSS L695-704). */
const cardStyle: CSSProperties = { padding: 22 }
const headStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 14 }
const avatarStyle: CSSProperties = {
  width: 52, height: 52, borderRadius: 'var(--v54-r-md)', background: 'var(--v54-cream)',
  display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)', flexShrink: 0,
}
const titleStyle: CSSProperties = { fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em' }
const subStyle: CSSProperties = { fontSize: 12.5, color: 'var(--v54-navy-400)', marginTop: 2 }
const pillsStyle: CSSProperties = { marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }
const statsStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, margin: '14px 0' }
const statValStyle: CSSProperties = { fontFamily: 'var(--v54-font-serif)', fontSize: 28, fontWeight: 500, marginTop: 4 }
const statLblStyle: CSSProperties = { fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-navy-400)', fontWeight: 600 }
const actionsStyle: CSSProperties = { display: 'flex', gap: 8 }

export default function ModCopros({ onNavigate }: Readonly<{ onNavigate?: (id: string) => void }>) {
  const { push } = useToast()
  const [detail, setDetail] = useState<Detail | null>(null)
  return (
    <>
      <PageHead eyebrow="Patrimoine" title="Copropriétés" lede="Immeubles administrés dans le cadre des mandats judiciaires — caractéristiques, gestion et conformité."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Nouvelle copropriété', desc: 'Rattacher une copropriété à un mandat' })}><Icon name="plus" />Ajouter</Button>} />
      <KPIGrid items={[
        { icon: 'building', num: 4, lbl: 'Copropriétés', sub: `${TOTAL_LOTS} lots au total` },
        { icon: 'users', num: TOTAL_LOTS, lbl: 'Lots gérés', sub: 'résidentiel & mixte', accent: 'sage' },
        { icon: 'coin', num: fmtEUR(TOTAL_BUDGET), lbl: 'Budgets cumulés', sub: 'exercice 2026' },
        { icon: 'shield', num: '100%', lbl: 'Assurance RC', sub: 'à jour', accent: 'sage' },
      ]} />
      <div className={m.cardGrid}>
        {COPROS.map((c) => (
          <div key={c.id} className={m.card} style={cardStyle}>
            <div style={headStyle}>
              <div style={avatarStyle}>{c.code}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={titleStyle}>{c.nom}</div>
                <div style={subStyle}>{c.adresse}</div>
                <div style={pillsStyle}><Pill kind={c.pill}>{c.statut}</Pill><Pill kind="dark" noDot>{c.fondement}</Pill></div>
              </div>
            </div>
            <div style={statsStyle}>
              <div><div style={statValStyle}>{c.lots}</div><div style={statLblStyle}>Lots</div></div>
              <div><div style={statValStyle}>{fmtEUR(c.budget)}</div><div style={statLblStyle}>Budget</div></div>
              <div><div style={statValStyle}>{c.echeance}</div><div style={statLblStyle}>Fin de mission</div></div>
            </div>
            <div style={actionsStyle}>
              <Button variant="ghost" size="sm" onClick={() => setDetail({
                title: c.nom, icon: 'building',
                footnote: `Désignation : ${c.tribunal} · RG ${c.rg} · ordonnance du ${c.ordonnance}.`,
                fields: [
                  { k: 'Adresse', v: c.adresse, full: true },
                  { k: 'Lots', v: c.lots },
                  { k: 'Fondement', v: c.fondement },
                  { k: 'Budget', v: fmtEUR(c.budget) },
                  { k: 'Charges engagées', v: fmtEUR(c.depense) },
                  { k: 'Impayés', v: fmtEUR(c.impayes) },
                  { k: 'Fonds de travaux', v: fmtEUR(c.fondsTravaux) },
                  { k: 'Notification ordonnance', v: c.notifOrdonnance },
                  { k: 'Motif', v: c.motif, full: true },
                ],
              })}>Détails</Button>
              <Button variant="ghost" size="sm" onClick={() => onNavigate?.('lots')}>Lots &amp; copropriétaires</Button>
            </div>
          </div>
        ))}
      </div>
      <DetailModal open={!!detail} onClose={() => setDetail(null)} title={detail?.title} icon={detail?.icon} fields={detail?.fields || []} footnote={detail?.footnote} />
    </>
  )
}
