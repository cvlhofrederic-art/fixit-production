'use client'

import { useState } from 'react'
import {
  DEMO_SUIVI_DELIBERATIONS,
  PILL_PAR_STATUT_DELIBERATION,
  type LigneDeliberation,
  type StatutDeliberation,
} from '@/components/administrateur-judiciaire/data/suivi-deliberations'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { Tabs } from '@/components/administrateur-judiciaire/ui/Tabs'
import {
  champCoproprieteChoisie,
  titreListeVide,
  useCoproChoisie,
} from '@/components/administrateur-judiciaire/ui/copro-choisie'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { codeDeNomCopro, filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'

/** Copropriété d'une délibération : la fin du libellé de son assemblée (« AG 2025 · Le Méridien »). */
const nomCoproAssemblee = (deliberation: LigneDeliberation): string => deliberation[1].split('·').at(-1) ?? ''

/**
 * Suivi des délibérations d'assemblée générale, écran de démonstration affiché selon la copropriété choisie dans le
 * sélecteur du haut de page : délibérations de ses assemblées, indicateurs et pastille « En retard » calculés sur
 * elles, nouvelle délibération préremplie. Les onglets sont autonomes (non branchés : le contenu ne change pas, un
 * bandeau le signale) et le formulaire « Nouvelle délibération » est simulé (toast « Délibération enregistrée »).
 */
export function SuiviDeliberationsModule() {
  const { push } = useToast()
  const [deliberationOuverte, setDeliberationOuverte] = useState<LigneDeliberation | null>(null)
  const { code, nom } = useCoproChoisie()
  const deliberations = filtrerParCopro(DEMO_SUIVI_DELIBERATIONS, code, (deliberation) =>
    codeDeNomCopro(nomCoproAssemblee(deliberation)),
  )
  const compter = (statut: StatutDeliberation) =>
    deliberations.filter((deliberation) => deliberation[4] === statut).length

  return (
    <>
      <PageHead
        eyebrow="Mandat judiciaire"
        title="Suivi des délibérations"
        lede="Exécution des décisions d'assemblée générale et respect des échéances (responsabilité du syndic)."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'poll',
                title: 'Nouvelle délibération',
                fields: [
                  champCoproprieteChoisie(nom),
                  {
                    label: 'Objet',
                    placeholder: 'ex. Vote de travaux',
                    full: true,
                  },
                  {
                    label: 'Majorité',
                    type: 'select',
                    options: ['Article 24', 'Article 25', 'Article 25-1', 'Article 26'],
                    full: true,
                  },
                  {
                    label: "Date de l'AG",
                    placeholder: 'JJ/MM/AAAA',
                    full: true,
                  },
                ],
                submitLabel: 'Enregistrer',
                toast: {
                  title: 'Délibération enregistrée',
                },
              })
            }
          >
            <Icon name="plus" />
            Nouvelle délibération
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'fact',
            num: deliberations.length,
            lbl: 'Délibérations suivies',
          },
          {
            icon: 'clock',
            num: compter('en cours'),
            lbl: 'En cours (délais)',
            accent: 'amber',
          },
          {
            icon: 'alert',
            num: compter('proche'),
            lbl: 'Proche échéance (≤3j)',
            accent: 'gold',
          },
          {
            icon: 'siren',
            num: compter('en retard'),
            lbl: 'En retard (resp. civile)',
            accent: 'rust',
          },
          {
            icon: 'check',
            num: compter('terminée'),
            lbl: 'Terminées',
            accent: 'sage',
          },
        ]}
      />
      <Tabs
        defaultActive="all"
        tabs={[
          {
            id: 'all',
            icon: 'fact',
            label: 'Toutes',
          },
          {
            id: 'cours',
            icon: 'clock',
            label: 'En cours',
          },
          {
            id: 'retard',
            icon: 'siren',
            label: 'En retard',
            badge: compter('en retard') || undefined,
          },
          {
            id: 'fini',
            icon: 'check',
            label: 'Terminées',
          },
        ]}
      />
      <Panel title="Décisions à exécuter" icon="fact" flush>
        {deliberations.length === 0 ? (
          <EmptyState icon="fact" title={titreListeVide('Aucune délibération', nom)} />
        ) : (
          <DataTable
            columns={[
              {
                h: 'Délibération',
                render: (deliberation) => <b>{deliberation[0]}</b>,
              },
              {
                h: 'Assemblée',
                render: (deliberation) => (
                  <span
                    style={{
                      color: 'var(--navy-500)',
                    }}
                  >
                    {deliberation[1]}
                  </span>
                ),
              },
              {
                h: 'Responsable',
                render: (deliberation) => deliberation[2],
              },
              {
                h: 'Échéance',
                render: (deliberation) => <span className="mono">{deliberation[3]}</span>,
              },
              {
                h: 'Statut',
                render: (deliberation) => (
                  <Pill kind={PILL_PAR_STATUT_DELIBERATION[deliberation[4]]} noDot>
                    {deliberation[4]}
                  </Pill>
                ),
              },
            ]}
            rows={deliberations}
            onRow={setDeliberationOuverte}
          />
        )}
      </Panel>
      <DetailModal
        open={!!deliberationOuverte}
        onClose={() => setDeliberationOuverte(null)}
        title={deliberationOuverte ? deliberationOuverte[0] : ''}
        icon="fact"
        fields={
          deliberationOuverte
            ? [
                {
                  k: 'Assemblée',
                  v: deliberationOuverte[1],
                },
                {
                  k: 'Responsable',
                  v: deliberationOuverte[2],
                },
                {
                  k: 'Échéance',
                  v: deliberationOuverte[3],
                },
                {
                  k: 'Statut',
                  v: deliberationOuverte[4],
                },
              ]
            : []
        }
      />
    </>
  )
}
