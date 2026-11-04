'use client'

import { useState } from 'react'
import {
  DEMO_QUOTES_PARTS_APPELS_FONDS,
  type QuotePartAppelFonds,
} from '@/components/administrateur-judiciaire/data/appels-de-fonds'
import { DEMO_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { Tabs } from '@/components/administrateur-judiciaire/ui/Tabs'
import { champCoproprieteChoisie } from '@/components/administrateur-judiciaire/ui/copro-choisie'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import type { CoproprieteAffichee } from '@/lib/administrateur-judiciaire/db/hooks'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'
import { codeDeNomCopro, filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'
import { useCodeCoproCourant, useCoproCourante } from '@/lib/administrateur-judiciaire/selection'

/**
 * Appels de fonds de la copropriété choisie en haut de page : budget voté, quote-part et suivi du recouvrement
 * (données de démonstration). Sans copropriété choisie (écran rendu seul), toutes les copropriétés et leurs cumuls.
 * Les onglets sont autonomes (non branchés : seul « Quotes-parts » est affiché). Le formulaire « Nouvel appel de
 * fonds », prérempli avec la copropriété choisie, est simulé (toast « Appel de fonds émis »).
 */
export function AppelsDeFondsModule() {
  const { push } = useToast()
  const [ligneOuverte, setLigneOuverte] = useState<QuotePartAppelFonds | null>(null)
  const code = useCodeCoproCourant()
  const copro = useCoproCourante()
  const perimetre: readonly Pick<CoproprieteAffichee, 'budget' | 'impayes'>[] = code ? [copro] : DEMO_COPROPRIETES
  const budget = perimetre.reduce((total, candidate) => total + candidate.budget, 0)
  const impayes = perimetre.reduce((total, candidate) => total + candidate.impayes, 0)
  const quotesParts = filtrerParCopro(DEMO_QUOTES_PARTS_APPELS_FONDS, code, (ligne) => codeDeNomCopro(ligne[0]))

  return (
    <>
      <PageHead
        eyebrow="Comptabilité & finances"
        title="Appels de fonds"
        lede="Budget voté, quotes-parts par copropriété et suivi du recouvrement."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'mail',
                title: 'Nouvel appel de fonds',
                fields: [
                  champCoproprieteChoisie(code && copro.nom),
                  {
                    label: 'Période',
                    type: 'select',
                    options: ['T1 2026', 'T2 2026', 'T3 2026', 'T4 2026'],
                    full: true,
                  },
                  {
                    label: 'Type',
                    type: 'select',
                    options: ['Charges courantes', 'Fonds travaux', 'Travaux exceptionnels'],
                    full: true,
                  },
                  {
                    label: "Date d'exigibilité",
                    placeholder: 'JJ/MM/AAAA',
                    full: true,
                  },
                ],
                submitLabel: 'Enregistrer',
                toast: {
                  title: 'Appel de fonds émis',
                },
              })
            }
          >
            <Icon name="coin" />
            Émettre un appel
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'bank',
            num: formatEuros(budget),
            lbl: 'Budget annuel voté',
          },
          {
            icon: 'coin',
            num: formatEuros(Math.round(budget * 0.05)),
            lbl: 'Cotisation fonds travaux',
            accent: 'gold',
          },
          {
            icon: 'chart',
            // Budget nul (copropriété de la base sans budget saisi) : pas de taux plutôt que « NaN % ».
            num: budget > 0 ? Math.round(((budget - impayes) / budget) * 100) + ' %' : '—',
            lbl: 'Taux de recouvrement',
            accent: 'amber',
          },
          {
            icon: 'mail',
            num: 'T2',
            lbl: 'Appel en cours',
          },
        ]}
      />
      <Tabs
        defaultActive="map"
        tabs={[
          {
            id: 'map',
            icon: 'grid',
            label: 'Quotes-parts',
          },
          {
            id: 'sim',
            icon: 'chart',
            label: 'Simulateur',
          },
          {
            id: 'cob',
            icon: 'coin',
            label: 'Recouvrements',
          },
          {
            id: 'obr',
            icon: 'wrench',
            label: 'Travaux',
          },
        ]}
      />
      <Panel title="Quotes-parts par copropriété" icon="coin" flush>
        {quotesParts.length > 0 ? (
          <DataTable
            columns={[
              {
                h: 'Copropriété',
                render: (ligne) => <b>{ligne[0]}</b>,
              },
              {
                h: 'Budget voté',
                render: (ligne) => <span className="mono">{ligne[1]}</span>,
              },
              {
                h: 'Quote-part moy.',
                render: (ligne) => <span className="mono">{ligne[2]}</span>,
              },
              {
                h: 'Émis',
                render: (ligne) => <span className="mono">{ligne[3]}</span>,
              },
              {
                h: 'Recouvré',
                render: (ligne) => <span className="mono">{ligne[4]}</span>,
              },
              {
                h: 'Taux',
                render: (ligne) => (
                  <Pill kind={ligne[6]} noDot>
                    {ligne[5]}
                  </Pill>
                ),
              },
            ]}
            rows={quotesParts}
            onRow={setLigneOuverte}
          />
        ) : (
          <EmptyState icon="coin" title={`Aucune quote-part pour ${copro.nom}`} />
        )}
      </Panel>
      <DetailModal
        open={!!ligneOuverte}
        onClose={() => setLigneOuverte(null)}
        title={ligneOuverte ? ligneOuverte[0] : ''}
        icon="coin"
        fields={
          ligneOuverte
            ? [
                {
                  k: 'Budget voté',
                  v: ligneOuverte[1],
                },
                {
                  k: 'Quote-part moyenne',
                  v: ligneOuverte[2],
                },
                {
                  k: 'Appels émis',
                  v: ligneOuverte[3],
                },
                {
                  k: 'Recouvré',
                  v: ligneOuverte[4],
                },
                {
                  k: 'Taux de recouvrement',
                  v: ligneOuverte[5],
                },
              ]
            : []
        }
      />
    </>
  )
}
