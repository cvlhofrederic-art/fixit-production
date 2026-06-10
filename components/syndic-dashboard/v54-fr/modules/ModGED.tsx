'use client'

// Documents (GED) — port du ModDocsGED du mockup v8 (FR).
// Coffre-fort numérique : KPI de stockage + table des derniers documents.

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import DataTable from '../shared/DataTable'
import DetailModal from '../shared/DetailModal'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'

/** [document, type, bâtiment, auteur, date] */
type GedRow = readonly [string, string, string, string, string]

const GED_ROWS: readonly GedRow[] = [
  ['Ordonnance de désignation', 'Juridique', 'Le Méridien', 'Greffe TJ Nanterre', '12/03/2026'],
  ['Procès-verbal AG 2025', 'Assemblée', 'Le Clos des Vignes', 'Cabinet Delaunay', '15/04/2025'],
  ['Devis toiture', 'Technique', 'Les Tilleuls', 'Ent. Toitures Nord', '28/05/2026'],
  ['Contrat ascenseur', 'Contrat', 'Le Méridien', 'Otis', '01/01/2026'],
  ['État daté', 'Comptabilité', 'Villa Montaigne', 'Cabinet Delaunay', '02/06/2026'],
]

export default function ModGED() {
  const { push } = useToast()
  const [open, setOpen] = useState<GedRow | null>(null)
  return (
    <>
      <PageHead eyebrow="Documents" title="Documents (GED)"
        lede="Gestion électronique des documents de l'ensemble des mandats."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Téléverser', desc: 'Ajouter un document à la GED' })}><Icon name="plus" />Téléverser</Button>} />
      <KPIGrid items={[
        { icon: 'folder', num: 248, lbl: 'Documents' },
        { icon: 'doc', num: '1,2 Go', lbl: 'Espace utilisé' },
        { icon: 'users', num: 36, lbl: 'Partagés extranet' },
        { icon: 'clock', num: 5, lbl: 'Récents (7 j)', accent: 'sage' },
      ]} />
      <Panel title="Derniers documents" icon="folder" flush>
        <DataTable<GedRow>
          columns={[
            { h: 'Document', render: (r) => <b>{r[0]}</b> },
            { h: 'Type', render: (r) => <Pill noDot>{r[1]}</Pill> },
            { h: 'Bâtiment', render: (r) => r[2] },
            { h: 'Auteur', render: (r) => <span style={{ color: 'var(--v54-navy-500)' }}>{r[3]}</span> },
            { h: 'Date', render: (r) => <span className={m.mono}>{r[4]}</span> },
          ]}
          rows={[...GED_ROWS]} onRow={setOpen} />
      </Panel>
      <DetailModal open={!!open} onClose={() => setOpen(null)} title={open ? open[0] : ''} icon="folder"
        fields={open ? [{ k: 'Type', v: open[1] }, { k: 'Bâtiment', v: open[2] }, { k: 'Auteur', v: open[3] }, { k: 'Date', v: open[4] }] : []} />
    </>
  )
}
