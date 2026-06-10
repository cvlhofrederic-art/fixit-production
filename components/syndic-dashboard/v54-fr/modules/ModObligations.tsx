'use client'

// Obligations & échéances — port du ModObligations du mockup v8 (L4610-4641).
// Pilotage des obligations du syndic judiciaire (loi 1965 / décret 1967, ALUR, Climat).

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Alert } from '@/components/syndic-dashboard/v54/primitives/alert'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import DataTable from '../shared/DataTable'
import DetailModal, { type DetailField } from '../shared/DetailModal'
import { OBLIGATIONS } from '../data/mock'

interface ObligationDetail {
  title: string
  icon: IconName
  footnote: string
  fields: DetailField[]
}

const fondementStyle = { fontSize: 12, color: 'var(--v54-navy-500)' } as const

export default function ModObligations() {
  const { push } = useToast()
  const [detail, setDetail] = useState<ObligationDetail | null>(null)
  return (
    <>
      <PageHead eyebrow="Conformité légale" title="Obligations & échéances" lede="Pilotage des obligations du syndic judiciaire — délais de mission, conformité loi 1965 / décret 1967, loi ALUR et loi Climat."
        actions={<Button onClick={() => push({ kind: 'success', title: 'Export généré', desc: 'Calendrier des obligations' })}><Icon name="download" />Exporter</Button>} />
      <KPIGrid items={[
        { icon: 'scale', num: OBLIGATIONS.length, lbl: 'Obligations suivies', sub: '4 copropriétés' },
        { icon: 'alert', num: OBLIGATIONS.filter((o) => o.pill === 'rust').length, lbl: 'Urgentes / en retard', sub: 'à traiter', accent: 'rust', trend: { kind: 'bad', label: 'prioritaire' } },
        { icon: 'clock', num: OBLIGATIONS.filter((o) => o.pill === 'amber').length, lbl: 'À planifier', sub: 'sous 90 jours', accent: 'amber' },
        { icon: 'check', num: OBLIGATIONS.filter((o) => o.pill === 'sage').length, lbl: 'Conformes / planifiées', sub: 'à jour', accent: 'sage' },
      ]} />
      {/* kind="warn" du mockup = défaut amber de la primitive Alert. */}
      <Alert icon="calendar" title="Échéance critique — Le Clos des Vignes">La convocation de l&apos;AG élective doit intervenir au plus tard le 22/05/2026 (deux mois avant la fin de mission du 22/07/2026).</Alert>
      <Panel title="Échéancier des obligations" sub="Objet · fondement légal · échéance" icon="scale" flush>
        <DataTable rowKey="id"
          columns={[
            { h: 'Obligation', render: (r) => <b style={{ fontWeight: 600 }}>{r.objet}</b> },
            { h: 'Copropriété', render: (r) => r.copro },
            { h: 'Fondement', render: (r) => <span style={fondementStyle}>{r.base}</span> },
            { h: 'Échéance', render: (r) => <span style={{ fontWeight: 600 }}>{r.date}</span> },
            { h: 'Statut', render: (r) => <Pill kind={r.pill}>{r.statut}</Pill> },
          ]}
          rows={OBLIGATIONS}
          onRow={(r) => setDetail({ title: r.objet, icon: 'scale', footnote: r.note, fields: [{ k: 'Copropriété', v: r.copro }, { k: 'Fondement légal', v: r.base }, { k: 'Échéance', v: r.date }, { k: 'Statut', v: r.statut }, { k: 'Note', v: r.note, full: true }] })} />
      </Panel>
      <DetailModal open={!!detail} onClose={() => setDetail(null)} title={detail?.title} icon={detail?.icon} fields={detail?.fields || []} footnote={detail?.footnote} />
    </>
  )
}
