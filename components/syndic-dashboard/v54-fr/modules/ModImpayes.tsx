'use client'

// Impayés & recouvrement — port byte-exact du ModImpayes du mockup v8 (route
// « impayes »). Comptes débiteurs (COPROPRIETAIRES à solde négatif), procédures
// de recouvrement (mise en demeure, art. 19-2 déchéance du terme).

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import type { IconName } from '@/lib/syndic/icon-names'
import DataTable from '../shared/DataTable'
import CreateModal from '../shared/CreateModal'
import DetailModal, { type DetailField } from '../shared/DetailModal'
import { COPROPRIETAIRES, TOTAL_IMPAYES, type Coproprietaire } from '../data/mock'
import { fmtEUR, fmtEUR2 } from '../lib/format'

interface DetailState {
  title: string
  icon: IconName
  footnote?: string
  fields: DetailField[]
}

export default function ModImpayes() {
  const { push } = useToast()
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<DetailState | null>(null)
  const rows = COPROPRIETAIRES.filter((p) => p.solde < 0)
  return (
    <>
      <PageHead
        eyebrow="Comptabilité & finances"
        title="Impayés & recouvrement"
        lede="Charges impayées et procédures de recouvrement — mise en demeure, mise en œuvre de l'article 19-2 (déchéance du terme)."
        actions={
          <>
            <Button onClick={() => push({ kind: 'success', title: 'Export généré', desc: 'État des impayés' })}><Icon name="download" />Exporter</Button>
            <Button variant="gold" onClick={() => setOpen(true)}><Icon name="scale" />Engager le recouvrement</Button>
          </>
        }
      />
      <KPIGrid
        items={[
          { icon: 'coin', num: fmtEUR(TOTAL_IMPAYES), lbl: 'Total des impayés', sub: 'sur 4 copropriétés', accent: 'rust', trend: { kind: 'bad', label: 'à recouvrer' } },
          { icon: 'users', num: rows.length, lbl: 'Copropriétaires concernés', sub: '1 en contentieux', accent: 'amber' },
          { icon: 'scale', num: 1, lbl: 'Procédure contentieuse', sub: 'SCI Belvédère · 9 200 €', accent: 'rust' },
          { icon: 'check', num: '18%', lbl: "Taux d'impayés moyen", sub: 'Les Tilleuls : 36 %', accent: 'amber' },
        ]}
      />
      <Panel title="Comptes débiteurs" sub="Copropriétaires en retard ou en contentieux" icon="alert" flush>
        <DataTable
          rowKey="id"
          columns={[
            { h: 'Copropriétaire', render: (r: Coproprietaire) => (
              <div>
                <b style={{ fontWeight: 600 }}>{r.nom}</b>
                <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{r.lot}</div>
              </div>
            ) },
            { h: 'Copropriété', render: (r: Coproprietaire) => r.copro },
            { h: 'Tantièmes', render: (r: Coproprietaire) => <span className={m.mono} style={{ fontSize: 12 }}>{r.tantiemes}</span> },
            { h: 'Solde', render: (r: Coproprietaire) => <span style={{ color: 'var(--v54-rust-700)', fontWeight: 600 }}>{fmtEUR2(r.solde)}</span> },
            { h: 'Statut', render: (r: Coproprietaire) => <Pill kind={r.pill}>{r.statut}</Pill> },
          ]}
          rows={rows}
          onRow={(r) =>
            setDetail({
              title: r.nom,
              icon: 'users',
              footnote: "À défaut de paiement après mise en demeure, l'article 19-2 de la loi de 1965 permet la déchéance du terme et la saisine du juge.",
              fields: [
                { k: 'Lot', v: r.lot },
                { k: 'Copropriété', v: r.copro },
                { k: 'Tantièmes', v: r.tantiemes },
                { k: 'Solde débiteur', v: fmtEUR2(r.solde) },
                { k: 'Statut', v: r.statut },
                { k: 'Téléphone', v: r.tel },
                { k: 'Courriel', v: r.mail, full: true },
              ],
            })
          }
        />
      </Panel>
      <CreateModal
        open={open}
        onClose={() => setOpen(false)}
        title="Engager une procédure de recouvrement"
        icon="scale"
        fields={[
          { label: 'Copropriétaire', type: 'select', options: rows.map((r) => r.nom), required: true, full: true },
          { label: 'Type de procédure', type: 'select', options: ['Relance amiable', 'Mise en demeure (LRAR)', 'Déchéance du terme (art. 19-2)', 'Injonction de payer', 'Assignation'] },
          { label: 'Montant réclamé (€)', type: 'number', placeholder: '0', required: true },
          { label: 'Observations', type: 'textarea', full: true },
        ]}
        submitLabel="Engager la procédure"
        onDone={() => push({ kind: 'success', title: 'Procédure engagée', desc: 'Courrier de recouvrement généré' })}
      />
      <DetailModal open={!!detail} onClose={() => setDetail(null)} title={detail?.title} icon={detail?.icon} fields={detail?.fields || []} footnote={detail?.footnote} />
    </>
  )
}
