'use client'

// Reddition de comptes (lot A) — port du ModReddition du mockup v8 : KPI de
// clôture, comptes par copropriété (DataTable) et détail par copropriété
// (DetailModal).

import { useState } from 'react'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import DataTable from '../shared/DataTable'
import DetailModal, { type DetailField } from '../shared/DetailModal'
import { COPROS, TOTAL_BUDGET, TOTAL_DEPENSE, type Copro } from '../data/mock'
import { fmtEUR } from '../lib/format'

type RedditionRow = Copro & { disponible: number }

interface RedditionDetail {
  title: string
  icon: IconName
  footnote: string
  fields: DetailField[]
}

export default function ModReddition() {
  const { push } = useToast()
  const [detail, setDetail] = useState<RedditionDetail | null>(null)
  const rows: RedditionRow[] = COPROS.map((c) => ({ ...c, disponible: c.budget - c.depense }))
  return (
    <>
      <PageHead
        eyebrow="Mandat judiciaire"
        title="Reddition de comptes"
        lede="Présentation des comptes de la gestion judiciaire — au syndic élu et, le cas échéant, au tribunal (mandats art. 29-1)."
        actions={
          <>
            <Button onClick={() => push({ kind: 'success', title: 'Export généré', desc: 'Reddition de comptes (PDF)' })}><Icon name="download" />Exporter</Button>
            <Button variant="gold" onClick={() => push({ kind: 'info', title: 'Dépôt du rapport', desc: 'Transmission de la reddition au tribunal' })}><Icon name="upload" />Déposer le rapport</Button>
          </>
        }
      />
      <KPIGrid
        items={[
          { icon: 'doc', num: 2, lbl: 'Redditions à produire', sub: '1 au tribunal · 1 au syndic élu', accent: 'amber' },
          { icon: 'coin', num: fmtEUR(TOTAL_DEPENSE), lbl: 'Charges justifiées', sub: 'Pièces rapprochées', accent: 'sage' },
          { icon: 'bank', num: fmtEUR(TOTAL_BUDGET - TOTAL_DEPENSE), lbl: 'Solde de trésorerie', sub: 'Compte séparé · art. 18' },
          { icon: 'check', num: '94%', lbl: 'Pièces rapprochées', sub: '6 écritures à valider', accent: 'sage' },
        ]}
      />
      <Panel title="Comptes par copropriété" sub="Budget · charges engagées · solde — à arrêter pour la reddition" icon="chart" flush>
        <DataTable<RedditionRow>
          rowKey="id"
          columns={[
            { h: 'Copropriété', render: (r) => r.nom },
            { h: 'Budget', render: (r) => fmtEUR(r.budget) },
            { h: 'Charges', render: (r) => <span style={{ color: 'var(--v54-rust-700)' }}>{fmtEUR(r.depense)}</span> },
            { h: 'Solde', render: (r) => <span style={{ color: 'var(--v54-sage-700)', fontWeight: 600 }}>{fmtEUR(r.disponible)}</span> },
            { h: 'Fonds travaux', render: (r) => fmtEUR(r.fondsTravaux) },
          ]}
          rows={rows}
          onRow={(r) =>
            setDetail({
              title: `Reddition — ${r.nom}`,
              icon: 'doc',
              footnote:
                "La reddition retrace l'intégralité des recettes et dépenses de la période de gestion, justificatifs à l'appui. Pour les mandats fondés sur l'art. 29-1, elle est également présentée au tribunal.",
              fields: [
                { k: 'Budget prévisionnel', v: fmtEUR(r.budget) },
                { k: 'Charges engagées', v: fmtEUR(r.depense) },
                { k: 'Solde de trésorerie', v: fmtEUR(r.disponible) },
                { k: 'Fonds de travaux', v: fmtEUR(r.fondsTravaux) },
                { k: 'Impayés à recouvrer', v: fmtEUR(r.impayes) },
                { k: 'Compte bancaire séparé', v: 'Conforme (art. 18)' },
                { k: 'Période', v: `Depuis le ${r.ordonnance}`, full: true },
              ],
            })
          }
        />
      </Panel>
      <DetailModal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.title}
        icon={detail?.icon}
        footnote={detail?.footnote}
        fields={detail?.fields ?? []}
      />
    </>
  )
}
