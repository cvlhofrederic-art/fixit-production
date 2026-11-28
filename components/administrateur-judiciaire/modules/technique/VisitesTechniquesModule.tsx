'use client'

import { useState } from 'react'
import {
  DEMO_VISITES_TECHNIQUES,
  PILL_PAR_ETAT_VISITE_TECHNIQUE,
  type VisiteTechniqueDemo,
} from '@/components/administrateur-judiciaire/data/visites-techniques'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import {
  champCoproprieteChoisie,
  titreListeVide,
  useCoproChoisie,
} from '@/components/administrateur-judiciaire/ui/copro-choisie'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { codeDeNomCopro, filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'

/**
 * Visites techniques (barre latérale : « Visite technique / état daté » ; surtitre « Patrimoine »), affiché selon la
 * copropriété choisie dans le sélecteur du haut de page : visites filtrées, indicateurs (réalisées, à surveiller,
 * déficientes) calculés sur elles, nouvelle visite préremplie. Le bouton « Nouvelle visite » porte l'icône « search »
 * et ouvre un formulaire « pin ».
 */
export function VisitesTechniquesModule() {
  const { push } = useToast()
  const [visiteOuverte, setVisiteOuverte] = useState<VisiteTechniqueDemo | null>(null)
  const { code, nom } = useCoproChoisie()
  const visites = filtrerParCopro(DEMO_VISITES_TECHNIQUES, code, (visite) => codeDeNomCopro(visite[0]))
  const compter = (etat: VisiteTechniqueDemo[4]) => visites.filter((visite) => visite[4] === etat).length

  return (
    <>
      <PageHead
        eyebrow="Patrimoine"
        title="Visites techniques"
        lede="État technique des immeubles relevé lors des visites du gestionnaire."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'pin',
                title: 'Nouvelle visite',
                fields: [
                  champCoproprieteChoisie(nom),
                  {
                    label: 'Objet',
                    placeholder: 'ex. Visite technique annuelle',
                    full: true,
                  },
                  {
                    label: 'Date',
                    placeholder: 'JJ/MM/AAAA',
                    full: true,
                  },
                  {
                    label: 'Accompagnant',
                    placeholder: 'ex. Conseil syndical',
                    full: true,
                  },
                ],
                submitLabel: 'Enregistrer',
                toast: {
                  title: 'Visite planifiée',
                },
              })
            }
          >
            <Icon name="search" />
            Nouvelle visite
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'check',
            num: visites.length,
            lbl: 'Visites réalisées',
          },
          {
            icon: 'alert',
            num: compter('à surveiller'),
            lbl: 'Points à surveiller',
            accent: 'amber',
          },
          {
            icon: 'siren',
            num: compter('déficient'),
            lbl: 'Points déficients',
            accent: 'rust',
          },
        ]}
      />
      <Panel title="Dernières visites" icon="search" flush>
        {visites.length === 0 ? (
          <EmptyState icon="search" title={titreListeVide('Aucune visite technique', nom)} />
        ) : (
          <DataTable
            columns={[
              {
                h: 'Copropriété',
                render: (visite) => <b>{visite[0]}</b>,
              },
              {
                h: 'Date',
                render: (visite) => <span className="mono">{visite[1]}</span>,
              },
              {
                h: 'Objet',
                render: (visite) => visite[2],
              },
              {
                h: 'Constat',
                render: (visite) => visite[3],
              },
              {
                h: 'État',
                render: (visite) => (
                  <Pill kind={PILL_PAR_ETAT_VISITE_TECHNIQUE[visite[4]]} noDot>
                    {visite[4]}
                  </Pill>
                ),
              },
            ]}
            rows={visites}
            onRow={setVisiteOuverte}
          />
        )}
      </Panel>
      <DetailModal
        open={!!visiteOuverte}
        onClose={() => setVisiteOuverte(null)}
        title={visiteOuverte ? `${visiteOuverte[0]} — ${visiteOuverte[2]}` : ''}
        icon="search"
        fields={
          visiteOuverte
            ? [
                {
                  k: 'Date',
                  v: visiteOuverte[1],
                },
                {
                  k: 'Objet',
                  v: visiteOuverte[2],
                },
                {
                  k: 'Constat',
                  v: visiteOuverte[3],
                  full: true,
                },
                {
                  k: 'État',
                  v: visiteOuverte[4],
                },
              ]
            : []
        }
      />
    </>
  )
}
