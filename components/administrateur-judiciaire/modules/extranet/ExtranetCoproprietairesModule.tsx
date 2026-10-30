'use client'

import { useState } from 'react'
import {
  DEMO_COMPTES_EXTRANET,
  type CompteExtranetDemo,
} from '@/components/administrateur-judiciaire/data/comptes-extranet'
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
  sousTitreFige,
  titreListeVide,
  useCoproChoisie,
} from '@/components/administrateur-judiciaire/ui/copro-choisie'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { pourcentageArrondi } from '@/lib/administrateur-judiciaire/domain/format'
import { codeDeNomCopro, filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'

/**
 * Extranet copropriétaires (écran de démonstration ; surtitre « Gestion courante »), affiché selon la copropriété
 * choisie dans le sélecteur du haut de page (rattachement par le libellé du lot, « Le Méridien · lot 12 ») : comptes
 * filtrés, « Comptes » et « Taux de connexion » (part des accès actifs) calculés sur ces comptes, invitation préremplie.
 * « Documents partagés » et « Demandes en ligne » restent en dur (24, 2 ; marqués « Tous les mandats » quand une copropriété est choisie). Le bouton « Inviter un copropriétaire »
 * ouvre un formulaire intitulé « Inviter une personne » ; la fiche détail n'a pas de note de bas de page.
 */
export function ExtranetCoproprietairesModule() {
  const { push } = useToast()
  const [compteOuvert, setCompteOuvert] = useState<CompteExtranetDemo | null>(null)
  const { code, nom } = useCoproChoisie()
  const comptes = filtrerParCopro(DEMO_COMPTES_EXTRANET, code, (compte) => codeDeNomCopro(compte[2]))
  const actifs = comptes.filter((compte) => compte[4] === 'actif').length

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
                  champCoproprieteChoisie(nom),
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
            num: comptes.length,
            lbl: 'Comptes',
            accent: 'sage',
          },
          {
            icon: 'chart',
            num: comptes.length > 0 ? `${pourcentageArrondi(actifs, comptes.length)}%` : '—',
            lbl: 'Taux de connexion',
          },
          {
            icon: 'folder',
            num: 24,
            lbl: 'Documents partagés',
            sub: sousTitreFige(code),
          },
          {
            icon: 'chat',
            num: 2,
            lbl: 'Demandes en ligne',
            sub: sousTitreFige(code),
            accent: 'amber',
          },
        ]}
      />
      <Panel title="Comptes copropriétaires" icon="team" flush>
        {comptes.length === 0 ? (
          <EmptyState icon="users" title={titreListeVide('Aucun compte extranet', nom)} />
        ) : (
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
            rows={comptes}
            onRow={setCompteOuvert}
          />
        )}
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
