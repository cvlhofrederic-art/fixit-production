'use client'

import { useState } from 'react'
import {
  DEMO_COMPTES_EXTRANET,
  type CompteExtranetDemo,
} from '@/components/administrateur-judiciaire/data/comptes-extranet'
import { CHAMP_COPROPRIETE } from '@/components/administrateur-judiciaire/data/elements-communs'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/**
 * Extranet copropriétaires (écran de démonstration ; surtitre « Gestion courante »).
 * Indicateurs en dur (5, « 80% », 24, 2). Le bouton « Inviter un copropriétaire » ouvre un formulaire
 * intitulé « Inviter une personne » ; la fiche détail n'a pas de note de bas de page.
 */
export function ExtranetCoproprietairesModule() {
  const { push } = useToast()
  const [compteOuvert, setCompteOuvert] = useState<CompteExtranetDemo | null>(null)

  return (
    <>
      <PageHead
        eyebrow="Gestion courante"
        title="Extranet copropriétaires"
        lede="Espace en ligne des copropriétaires : documents, soldes et demandes."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'users',
                title: 'Inviter une personne',
                fields: [
                  {
                    label: 'Adresse e-mail',
                    placeholder: 'nom@exemple.fr',
                    full: true,
                  },
                  {
                    label: 'Rôle',
                    type: 'select',
                    options: ['Conseil syndical', 'Copropriétaire', 'Prestataire', 'Lecture seule'],
                    full: true,
                  },
                  CHAMP_COPROPRIETE,
                ],
                submitLabel: 'Inviter',
                toast: {
                  title: 'Invitation envoyée',
                },
              })
            }
          >
            <Icon name="mail" />
            Inviter un copropriétaire
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'users',
            num: 5,
            lbl: 'Comptes',
            accent: 'sage',
          },
          {
            icon: 'chart',
            num: '80%',
            lbl: 'Taux de connexion',
          },
          {
            icon: 'folder',
            num: 24,
            lbl: 'Documents partagés',
          },
          {
            icon: 'chat',
            num: 2,
            lbl: 'Demandes en ligne',
            accent: 'amber',
          },
        ]}
      />
      <Panel title="Comptes copropriétaires" icon="team" flush>
        <DataTable
          columns={[
            {
              h: 'Nom',
              render: (compte) => <b>{compte[0]}</b>,
            },
            {
              h: 'Email',
              render: (compte) => (
                <span
                  style={{
                    color: 'var(--navy-500)',
                  }}
                >
                  {compte[1]}
                </span>
              ),
            },
            {
              h: 'Lot',
              render: (compte) => compte[2],
            },
            {
              h: 'Solde',
              render: (compte) => (
                <span
                  className="mono"
                  style={{
                    color: compte[3].startsWith('-') ? 'var(--rust-600)' : 'var(--ink)',
                  }}
                >
                  {compte[3]}
                </span>
              ),
            },
            {
              h: 'Accès',
              render: (compte) => (
                <Pill kind={compte[4] === 'actif' ? 'sage' : 'rust'} noDot>
                  {compte[4]}
                </Pill>
              ),
            },
          ]}
          rows={DEMO_COMPTES_EXTRANET}
          onRow={setCompteOuvert}
        />
      </Panel>
      <DetailModal
        open={!!compteOuvert}
        onClose={() => setCompteOuvert(null)}
        title={compteOuvert ? compteOuvert[0] : ''}
        icon="users"
        fields={
          compteOuvert
            ? [
                {
                  k: 'Email',
                  v: compteOuvert[1],
                },
                {
                  k: 'Lot',
                  v: compteOuvert[2],
                },
                {
                  k: 'Solde',
                  v: compteOuvert[3],
                },
                {
                  k: 'Accès extranet',
                  v: compteOuvert[4],
                },
              ]
            : []
        }
      />
    </>
  )
}
