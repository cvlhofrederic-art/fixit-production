'use client'

import { useState } from 'react'
import {
  DEMO_REGISTRE_IMMATRICULATION,
  PILL_PAR_STATUT_IMMATRICULATION,
  type ImmatriculationDemo,
} from '@/components/administrateur-judiciaire/data/registre-immatriculation'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/**
 * Immatriculation au registre national des copropriétés (CCH art. L711-1), écran de démonstration : indicateurs en dur
 * (3 / 1 / 1 / 120). La télédéclaration est simulée (document généré).
 */
export function ImmatriculationRegistreModule() {
  const { push } = useToast()
  const [immatriculationOuverte, setImmatriculationOuverte] = useState<ImmatriculationDemo | null>(null)

  return (
    <>
      <PageHead
        eyebrow="Conformité · CCH art. L711-1"
        title="Immatriculation au registre national"
        lede="Immatriculation et télédéclaration annuelle des copropriétés au registre national (obligation légale)."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'doc',
                icon: 'bank',
                title: 'Télédéclaration — Registre des copropriétés',
                eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
                docTitle: 'Immatriculation au registre national',
                meta: "Agence nationale de l'habitat · télédéclaration",
                lines: [
                  "La fiche d'immatriculation a été télétransmise au registre national des copropriétés (art. L711-1 du CCH).",
                  {
                    h: 'Données déclarées',
                  },
                  {
                    k: "Numéro d'immatriculation",
                    v: 'AAA000-123-456',
                  },
                  {
                    k: 'Nombre de lots',
                    v: '36',
                  },
                  {
                    k: 'Budget prévisionnel',
                    v: '142 000 €',
                  },
                  {
                    k: 'Dernier exercice clos',
                    v: '2025',
                  },
                ],
              })
            }
          >
            <Icon name="bank" />
            Télédéclarer
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'building',
            num: 3,
            lbl: 'Copropriétés immatriculées',
            accent: 'sage',
          },
          {
            icon: 'alert',
            num: 1,
            lbl: 'À actualiser',
            accent: 'amber',
          },
          {
            icon: 'siren',
            num: 1,
            lbl: 'Non immatriculée',
            accent: 'rust',
          },
          {
            icon: 'grid',
            num: 120,
            lbl: 'Lots déclarés',
          },
        ]}
      />
      <Panel title="Registre des copropriétés sous mandat" icon="bank" flush>
        <DataTable
          columns={[
            {
              h: 'Copropriété',
              render: (immatriculation) => <b>{immatriculation[0]}</b>,
            },
            {
              h: "N° d'immatriculation",
              render: (immatriculation) => <span className="mono">{immatriculation[1]}</span>,
            },
            {
              h: 'Lots',
              render: (immatriculation) => <span className="mono">{immatriculation[2]}</span>,
            },
            {
              h: 'Dernière MAJ',
              render: (immatriculation) => immatriculation[3],
            },
            {
              h: 'Statut',
              render: (immatriculation) => (
                <Pill kind={PILL_PAR_STATUT_IMMATRICULATION[immatriculation[4]]} noDot>
                  {immatriculation[4]}
                </Pill>
              ),
            },
          ]}
          rows={DEMO_REGISTRE_IMMATRICULATION}
          onRow={setImmatriculationOuverte}
        />
      </Panel>
      <DetailModal
        open={!!immatriculationOuverte}
        onClose={() => setImmatriculationOuverte(null)}
        title={immatriculationOuverte ? immatriculationOuverte[0] : ''}
        icon="bank"
        fields={
          immatriculationOuverte
            ? [
                {
                  k: "N° d'immatriculation",
                  v: immatriculationOuverte[1],
                },
                {
                  k: 'Nombre de lots',
                  v: immatriculationOuverte[2],
                },
                {
                  k: 'Dernière mise à jour',
                  v: immatriculationOuverte[3],
                },
                {
                  k: 'Statut',
                  v: immatriculationOuverte[4],
                },
              ]
            : []
        }
        footnote="Télédéclaration annuelle obligatoire (art. L711-1 et s. du CCH)."
      />
    </>
  )
}
