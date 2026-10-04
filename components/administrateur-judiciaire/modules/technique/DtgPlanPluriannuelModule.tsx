'use client'

import { useState } from 'react'
import {
  DEMO_DTG_PPT_COPROPRIETES,
  PILL_PAR_STATUT_DTG_PPT,
  type DtgPptCoproprieteDemo,
} from '@/components/administrateur-judiciaire/data/dtg-ppt'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/**
 * DTG & plan pluriannuel de travaux (barre latérale : Technique & travaux › « Diagnostic technique (DTG) »).
 * À ne pas confondre avec la route « ppt », qui affiche le Rapport mensuel. Indicateurs en dur.
 */
export function DtgPlanPluriannuelModule() {
  const { push } = useToast()
  const [coproprieteOuverte, setCoproprieteOuverte] = useState<DtgPptCoproprieteDemo | null>(null)

  return (
    <>
      <PageHead
        eyebrow="Patrimoine · CCH L731-1 / Loi Climat"
        title="DTG & plan pluriannuel de travaux"
        lede="Diagnostic technique global et plan pluriannuel de travaux (PPT) des copropriétés."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'wrench',
                title: 'Nouveau diagnostic technique global',
                fields: [
                  {
                    label: 'Copropriété',
                    type: 'select',
                    options: ['Résidence Le Méridien', 'Le Clos des Vignes', 'Copropriété Les Tilleuls', 'Villa Montaigne'],
                    full: true,
                  },
                  {
                    label: "Bureau d'études",
                    placeholder: 'ex. Qualiconsult',
                    full: true,
                  },
                  {
                    label: 'Date de réalisation',
                    placeholder: 'JJ/MM/AAAA',
                    full: true,
                  },
                ],
                submitLabel: 'Enregistrer',
                toast: {
                  title: 'DTG planifié',
                },
              })
            }
          >
            <Icon name="clipboard" />
            Lancer un DTG
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'clipboard',
            num: 3,
            lbl: 'DTG réalisés',
          },
          {
            icon: 'check',
            num: 2,
            lbl: 'PPT approuvés en AG',
            accent: 'sage',
          },
          {
            icon: 'pencil',
            num: 1,
            lbl: 'En préparation',
            accent: 'amber',
          },
          {
            icon: 'coin',
            num: '520 k€',
            lbl: 'Budget pluriannuel',
          },
        ]}
      />
      <Panel title="DTG & PPT par copropriété" icon="clipboard" flush>
        <DataTable
          columns={[
            {
              h: 'Copropriété',
              render: (ligne) => <b>{ligne[0]}</b>,
            },
            {
              h: 'DTG',
              render: (ligne) => ligne[1],
            },
            {
              h: 'Horizon PPT',
              render: (ligne) => ligne[2],
            },
            {
              h: 'Budget estimé',
              render: (ligne) => <span className="mono">{ligne[3]}</span>,
            },
            {
              h: 'Statut',
              render: (ligne) => (
                <Pill kind={PILL_PAR_STATUT_DTG_PPT[ligne[4]]} noDot>
                  {ligne[4]}
                </Pill>
              ),
            },
          ]}
          rows={DEMO_DTG_PPT_COPROPRIETES}
          onRow={setCoproprieteOuverte}
        />
      </Panel>
      <DetailModal
        open={!!coproprieteOuverte}
        onClose={() => setCoproprieteOuverte(null)}
        title={coproprieteOuverte ? coproprieteOuverte[0] : ''}
        icon="clipboard"
        fields={
          coproprieteOuverte
            ? [
                {
                  k: 'Diagnostic technique global',
                  v: coproprieteOuverte[1],
                },
                {
                  k: 'Horizon du PPT',
                  v: coproprieteOuverte[2],
                },
                {
                  k: 'Budget estimé',
                  v: coproprieteOuverte[3],
                },
                {
                  k: 'Statut',
                  v: coproprieteOuverte[4],
                },
              ]
            : []
        }
      />
    </>
  )
}
