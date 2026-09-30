'use client'

import { useState, type ReactNode } from 'react'
import { DEMO_NOMS_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal, type ChampDetail } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { FormModal } from '@/components/administrateur-judiciaire/ui/FormModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/** Sinistre déclaré à l'assureur de la copropriété (démonstration). pill : couleur de l'étiquette de statut. */
export interface SinistreDemo {
  id: string
  objet: string
  copro: string
  /** « JJ/MM/AAAA ». */
  date: string
  assureur: string
  statut: string
  pill: 'amber' | 'sage'
}

/**
 * Sinistres suivis. La maquette déclarait cette liste dans le rendu ; elle est hissée ici à l'identique
 * (le manifeste prévoyait data/sinistres.ts, fichier hors de cette unité).
 */
export const DEMO_SINISTRES: readonly SinistreDemo[] = [
  {
    id: 'SIN-2026-014',
    objet: 'Dégât des eaux — 4e étage',
    copro: 'Le Clos des Vignes',
    date: '29/05/2026',
    assureur: 'MMA',
    statut: 'Déclaré',
    pill: 'amber',
  },
  {
    id: 'SIN-2026-009',
    objet: 'Infiltration toiture',
    copro: 'Copropriété Les Tilleuls',
    date: '12/04/2026',
    assureur: 'AXA',
    statut: 'Expertise',
    pill: 'amber',
  },
  {
    id: 'SIN-2025-031',
    objet: 'Bris de glace hall',
    copro: 'Résidence Le Méridien',
    date: '18/12/2025',
    assureur: 'MMA',
    statut: 'Indemnisé',
    pill: 'sage',
  },
]

/** Fiche détail ouverte au clic sur une ligne (footnote n'est jamais renseignée par la maquette). */
interface FicheSinistre {
  title: string
  icon: string
  fields: ChampDetail[]
  footnote?: ReactNode
}

/**
 * Sinistres (registre de démonstration). La déclaration passe par une FormModal sans validation, suivie d'un
 * toast « Simulation » ; l'indicateur « Assureurs » est en dur.
 */
export function SinistresModule() {
  const { push } = useToast()
  const [declarationOuverte, setDeclarationOuverte] = useState(false)
  const [fiche, setFiche] = useState<FicheSinistre | null>(null)

  return (
    <>
      <PageHead
        eyebrow="Technique & travaux"
        title="Sinistres"
        lede="Déclarations et suivi des sinistres auprès de l'assurance obligatoire de la copropriété (art. 9-1 loi 1965)."
        actions={
          <button className="btn gold" onClick={() => setDeclarationOuverte(true)}>
            <Icon name="plus" />
            Déclarer un sinistre
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'shield',
            num: DEMO_SINISTRES.length,
            lbl: 'Sinistres suivis',
            sub: 'sur 12 mois',
          },
          {
            icon: 'clock',
            num: DEMO_SINISTRES.filter((sinistre) => sinistre.pill === 'amber').length,
            lbl: 'En cours',
            sub: 'déclaré / expertise',
            accent: 'amber',
          },
          {
            icon: 'check',
            num: DEMO_SINISTRES.filter((sinistre) => sinistre.pill === 'sage').length,
            lbl: 'Clôturés',
            sub: 'indemnisés',
            accent: 'sage',
          },
          {
            icon: 'doc',
            num: 2,
            lbl: 'Assureurs',
            sub: 'MMA · AXA',
          },
        ]}
      />
      <Panel title="Suivi des sinistres" sub="Référence · objet · état" icon="shield" flush>
        <DataTable
          rowKey="id"
          columns={[
            {
              h: 'Référence',
              render: (sinistre) => (
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                  }}
                >
                  {sinistre.id}
                </span>
              ),
            },
            {
              h: 'Objet',
              render: (sinistre) => (
                <b
                  style={{
                    fontWeight: 600,
                  }}
                >
                  {sinistre.objet}
                </b>
              ),
            },
            {
              h: 'Copropriété',
              render: (sinistre) => sinistre.copro,
            },
            {
              h: 'Date',
              render: (sinistre) => sinistre.date,
            },
            {
              h: 'Assureur',
              render: (sinistre) => sinistre.assureur,
            },
            {
              h: 'Statut',
              render: (sinistre) => <Pill kind={sinistre.pill}>{sinistre.statut}</Pill>,
            },
          ]}
          rows={DEMO_SINISTRES}
          onRow={(sinistre) =>
            setFiche({
              title: `${sinistre.objet}`,
              icon: 'shield',
              fields: [
                {
                  k: 'Référence',
                  v: sinistre.id,
                },
                {
                  k: 'Copropriété',
                  v: sinistre.copro,
                },
                {
                  k: 'Date',
                  v: sinistre.date,
                },
                {
                  k: 'Assureur',
                  v: sinistre.assureur,
                },
                {
                  k: 'Statut',
                  v: sinistre.statut,
                },
              ],
            })
          }
        />
      </Panel>
      <FormModal
        open={declarationOuverte}
        onClose={() => setDeclarationOuverte(false)}
        title="Déclarer un sinistre"
        icon="shield"
        fields={[
          {
            label: 'Objet du sinistre',
            required: true,
            full: true,
          },
          {
            label: 'Copropriété',
            type: 'select',
            options: DEMO_NOMS_COPROPRIETES,
          },
          {
            label: 'Date de survenance',
            type: 'date',
          },
          {
            label: 'Assureur',
            type: 'select',
            options: ['MMA', 'AXA', 'Allianz', 'Generali', 'Autre'],
          },
          {
            label: 'Description',
            type: 'textarea',
            full: true,
          },
        ]}
        submitLabel="Déclarer"
        onDone={() =>
          push({
            kind: 'success',
            title: 'Simulation',
            desc: "Aucune déclaration n'a été transmise à l'assureur.",
          })
        }
      />
      <DetailModal
        open={!!fiche}
        onClose={() => setFiche(null)}
        title={fiche?.title}
        icon={fiche?.icon}
        fields={fiche?.fields || []}
        footnote={fiche?.footnote}
      />
    </>
  )
}
