'use client'

// Lots & copropriétaires — port du `ModLots` du mockup v8 : registre des
// copropriétaires, lots et tantièmes (COPROPRIETAIRES de ../data/mock).

import { useState, type ReactNode } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { Icon } from '@/components/syndic-dashboard/v54/primitives/icon'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import type { IconName } from '@/lib/syndic/icon-names'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import DataTable from '../shared/DataTable'
import DetailModal, { type DetailField } from '../shared/DetailModal'
import CreateModal from '../shared/CreateModal'
import { COPROPRIETAIRES, COPRO_NAMES, TOTAL_LOTS } from '../data/mock'
import { fmtEUR2 } from '../lib/format'

interface Detail {
  title: ReactNode
  icon: IconName
  fields: DetailField[]
  footnote?: ReactNode
}

export default function ModLots() {
  const { push } = useToast()
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<Detail | null>(null)
  return (
    <>
      <PageHead eyebrow="Patrimoine" title="Lots & copropriétaires" lede="Registre des copropriétaires, lots et tantièmes — base de la convocation des assemblées et de la répartition des charges."
        actions={<><Button onClick={() => push({ kind: 'success', title: 'Export généré', desc: 'Liste des copropriétaires' })}><Icon name="download" />Exporter</Button><Button variant="gold" onClick={() => setOpen(true)}><Icon name="plus" />Ajouter un copropriétaire</Button></>} />
      <KPIGrid items={[
        { icon: 'users', num: COPROPRIETAIRES.length, lbl: 'Copropriétaires (échantillon)', sub: `${TOTAL_LOTS} lots au total` },
        { icon: 'check', num: COPROPRIETAIRES.filter((p) => p.statut === 'À jour').length, lbl: 'À jour', sub: 'charges réglées', accent: 'sage' },
        { icon: 'alert', num: COPROPRIETAIRES.filter((p) => p.solde < 0).length, lbl: 'En retard / impayé', sub: 'à relancer', accent: 'rust' },
        { icon: 'doc', num: '10 000', lbl: 'Tantièmes (total)', sub: 'clé de répartition générale' },
      ]} />
      <Panel title="Registre des copropriétaires" sub="Lots, tantièmes et situation de compte" icon="users" flush>
        <DataTable rowKey="id"
          columns={[
            { h: 'Copropriétaire', render: (r) => <b style={{ fontWeight: 600 }}>{r.nom}</b> },
            { h: 'Copropriété', render: (r) => r.copro },
            { h: 'Lot', render: (r) => r.lot },
            { h: 'Tantièmes', render: (r) => <span className={m.mono} style={{ fontSize: 12 }}>{r.tantiemes}</span> },
            { h: 'Solde', render: (r) => <span style={{ color: r.solde < 0 ? 'var(--v54-rust-700)' : 'var(--v54-sage-700)', fontWeight: 600 }}>{fmtEUR2(r.solde)}</span> },
            { h: 'Statut', render: (r) => <Pill kind={r.pill}>{r.statut}</Pill> },
          ]}
          rows={COPROPRIETAIRES}
          onRow={(r) => setDetail({
            title: r.nom, icon: 'users',
            fields: [
              { k: 'Copropriété', v: r.copro },
              { k: 'Lot', v: r.lot },
              { k: 'Tantièmes', v: r.tantiemes },
              { k: 'Solde', v: fmtEUR2(r.solde) },
              { k: 'Statut', v: r.statut },
              { k: 'Téléphone', v: r.tel },
              { k: 'Courriel', v: r.mail, full: true },
            ],
          })} />
      </Panel>
      <CreateModal open={open} onClose={() => setOpen(false)} title="Ajouter un copropriétaire" icon="users"
        fields={[
          { label: 'Nom / Raison sociale', required: true, full: true },
          { label: 'Copropriété', type: 'select', options: COPRO_NAMES },
          { label: 'Lot', placeholder: 'ex. Lot 12 — Apt B3' },
          { label: 'Tantièmes', placeholder: 'ex. 350/10000' },
          { label: 'Courriel', type: 'email', placeholder: 'nom@email.fr' },
        ]}
        submitLabel="Ajouter" onDone={() => push({ kind: 'success', title: 'Copropriétaire ajouté' })} />
      <DetailModal open={!!detail} onClose={() => setDetail(null)} title={detail?.title} icon={detail?.icon} fields={detail?.fields || []} footnote={detail?.footnote} />
    </>
  )
}
