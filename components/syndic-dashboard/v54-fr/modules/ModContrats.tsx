'use client'

// Contrats avec les prestataires — port du `ModContrats` du mockup v8.
// Seed CONTRATS propre au module (inline, verbatim mockup).

import { useState, type ReactNode } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill, type PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { Icon } from '@/components/syndic-dashboard/v54/primitives/icon'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import type { IconName } from '@/lib/syndic/icon-names'
import DataTable from '../shared/DataTable'
import DetailModal, { type DetailField } from '../shared/DetailModal'
import CreateModal from '../shared/CreateModal'
import { COPRO_NAMES, PRESTATAIRES } from '../data/mock'
import { fmtEUR } from '../lib/format'

interface Contrat {
  id: string
  objet: string
  prestataire: string
  copro: string
  montant: number
  echeance: string
  statut: string
  pill: PillKind
}

const CONTRATS: Contrat[] = [
  { id: 'K1', objet: 'Maintenance ascenseur', prestataire: 'OTIS Maintenance', copro: 'Le Clos des Vignes', montant: 3480, echeance: '31/12/2026', statut: 'Actif', pill: 'sage' },
  { id: 'K2', objet: 'Nettoyage parties communes', prestataire: 'Net Hall Propreté', copro: 'Résidence Le Méridien', montant: 6120, echeance: '30/09/2026', statut: 'Actif', pill: 'sage' },
  { id: 'K3', objet: 'Contrat de chauffage', prestataire: 'Atlantic Plomberie SARL', copro: 'Copropriété Les Tilleuls', montant: 8900, echeance: '15/06/2026', statut: 'À renégocier', pill: 'amber' },
  { id: 'K4', objet: 'Sécurité incendie (vérifications)', prestataire: 'Sécurité Incendie 92', copro: 'Résidence Le Méridien', montant: 1450, echeance: '31/03/2027', statut: 'Actif', pill: 'sage' },
  { id: 'K5', objet: 'Espaces verts', prestataire: 'Vert Pro Espaces', copro: 'Villa Montaigne', montant: 2200, echeance: '01/05/2026', statut: 'Échu', pill: 'rust' },
]

interface Detail {
  title: ReactNode
  icon: IconName
  fields: DetailField[]
  footnote?: ReactNode
}

export default function ModContrats() {
  const { push } = useToast()
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<Detail | null>(null)
  return (
    <>
      <PageHead eyebrow="Patrimoine" title="Contrats avec les prestataires" lede="Contrats de la copropriété en cours — révision, mise en concurrence et résiliation dans l'intérêt du syndicat."
        actions={<><Button onClick={() => push({ kind: 'success', title: 'Export généré', desc: 'Registre des contrats' })}><Icon name="download" />Exporter</Button><Button variant="gold" onClick={() => setOpen(true)}><Icon name="plus" />Nouveau contrat</Button></>} />
      <KPIGrid items={[
        { icon: 'handshake', num: CONTRATS.length, lbl: 'Contrats actifs', sub: '4 copropriétés' },
        { icon: 'coin', num: fmtEUR(CONTRATS.reduce((s, k) => s + k.montant, 0)), lbl: 'Engagement annuel', sub: 'cumulé' },
        { icon: 'clock', num: CONTRATS.filter((k) => k.pill === 'amber').length, lbl: 'À renégocier', sub: 'sous 90 jours', accent: 'amber' },
        { icon: 'alert', num: CONTRATS.filter((k) => k.pill === 'rust').length, lbl: 'Échus', sub: 'à renouveler', accent: 'rust' },
      ]} />
      <Panel title="Registre des contrats" sub="Objet · prestataire · échéance" icon="handshake" flush>
        <DataTable rowKey="id"
          columns={[
            { h: 'Objet', render: (r) => <b style={{ fontWeight: 600 }}>{r.objet}</b> },
            { h: 'Prestataire', render: (r) => r.prestataire },
            { h: 'Copropriété', render: (r) => r.copro },
            { h: 'Montant / an', render: (r) => fmtEUR(r.montant) },
            { h: 'Échéance', render: (r) => r.echeance },
            { h: 'Statut', render: (r) => <Pill kind={r.pill}>{r.statut}</Pill> },
          ]}
          rows={CONTRATS}
          onRow={(r) => setDetail({
            title: r.objet, icon: 'handshake',
            fields: [
              { k: 'Prestataire', v: r.prestataire },
              { k: 'Copropriété', v: r.copro },
              { k: 'Montant annuel', v: fmtEUR(r.montant) },
              { k: 'Échéance', v: r.echeance },
              { k: 'Statut', v: r.statut },
            ],
          })} />
      </Panel>
      <CreateModal open={open} onClose={() => setOpen(false)} title="Nouveau contrat" icon="handshake"
        fields={[
          { label: 'Objet', required: true, full: true },
          { label: 'Prestataire', type: 'select', options: PRESTATAIRES.map((p) => p.nom) },
          { label: 'Copropriété', type: 'select', options: COPRO_NAMES },
          { label: 'Montant annuel (€)', type: 'number' },
          { label: 'Échéance', type: 'date' },
        ]}
        submitLabel="Enregistrer" onDone={() => push({ kind: 'success', title: 'Contrat enregistré' })} />
      <DetailModal open={!!detail} onClose={() => setDetail(null)} title={detail?.title} icon={detail?.icon} fields={detail?.fields || []} footnote={detail?.footnote} />
    </>
  )
}
