'use client'

import { useState } from 'react'
import {
  DEMO_DTG_PPT_COPROPRIETES,
  PILL_PAR_STATUT_DTG_PPT,
  type DtgPptCoproprieteDemo,
} from '@/components/administrateur-judiciaire/data/dtg-ppt'
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
import { parserMontant } from '@/lib/administrateur-judiciaire/domain/import/csv'
import { codeDeNomCopro, filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'

/** Budget pluriannuel cumulé, en milliers d'euros (« 520 k€ ») ; « — » sans budget estimé. */
function budgetPluriannuel(lignes: readonly DtgPptCoproprieteDemo[]): string {
  const total = lignes.reduce((somme, ligne) => somme + (parserMontant(ligne[3]) ?? 0), 0)
  return total > 0 ? `${Math.round(total / 1000)} k€` : '—'
}

/**
 * DTG & plan pluriannuel de travaux (barre latérale : Technique & travaux › « Diagnostic technique (DTG) »).
 * À ne pas confondre avec la route « ppt », qui affiche le Rapport mensuel. Affiché selon la copropriété choisie dans
 * le sélecteur du haut de page : sa ligne seule, indicateurs calculés sur les lignes affichées (DTG réalisés, PPT
 * approuvés, en préparation, budget cumulé), nouveau DTG prérempli.
 */
export function DtgPlanPluriannuelModule() {
  const { push } = useToast()
  const [coproprieteOuverte, setCoproprieteOuverte] = useState<DtgPptCoproprieteDemo | null>(null)
  const { code, nom } = useCoproChoisie()
  const lignes = filtrerParCopro(DEMO_DTG_PPT_COPROPRIETES, code, (ligne) => codeDeNomCopro(ligne[0]))
  const compter = (statut: DtgPptCoproprieteDemo[4]) => lignes.filter((ligne) => ligne[4] === statut).length
  const portee = nom ? `de ${nom}` : 'des copropriétés'

  return (
    <>
      <PageHead
        eyebrow="Patrimoine · CCH L731-1 / Loi Climat"
        title="DTG & plan pluriannuel de travaux"
        lede={`Diagnostic technique global et plan pluriannuel de travaux (PPT) ${portee}.`}
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'wrench',
                title: 'Nouveau diagnostic technique global',
                fields: [
                  champCoproprieteChoisie(nom),
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
            num: lignes.filter((ligne) => ligne[1].startsWith('Réalisé')).length,
            lbl: 'DTG réalisés',
          },
          {
            icon: 'check',
            num: compter('approuvé'),
            lbl: 'PPT approuvés en AG',
            accent: 'sage',
          },
          {
            icon: 'pencil',
            num: compter('en préparation'),
            lbl: 'En préparation',
            accent: 'amber',
          },
          {
            icon: 'coin',
            num: budgetPluriannuel(lignes),
            lbl: 'Budget pluriannuel',
          },
        ]}
      />
      <Panel title="DTG & PPT par copropriété" icon="clipboard" flush>
        {lignes.length === 0 ? (
          <EmptyState icon="clipboard" title={titreListeVide('Aucun DTG ni PPT', nom)} />
        ) : (
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
            rows={lignes}
            onRow={setCoproprieteOuverte}
          />
        )}
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
