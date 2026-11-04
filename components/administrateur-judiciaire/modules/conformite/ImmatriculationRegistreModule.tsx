'use client'

import { useState } from 'react'
import {
  DEMO_REGISTRE_IMMATRICULATION,
  PILL_PAR_STATUT_IMMATRICULATION,
  type ImmatriculationDemo,
} from '@/components/administrateur-judiciaire/data/registre-immatriculation'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast, type OptionsDocument } from '@/components/administrateur-judiciaire/ui/toast'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'
import { codeDeNomCopro, filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'
import { useCodeCoproCourant, useCoproCourante } from '@/lib/administrateur-judiciaire/selection'

/** Données déclarées par la télédéclaration (document généré). */
interface DonneesTeledeclaration {
  /** Destinataire affiché sous le titre du document. */
  meta: string
  numero: string
  lots: string
  budget: string
}

/** Télédéclaration de démonstration, sans copropriété choisie (écran rendu seul). */
const TELEDECLARATION_DEMO: DonneesTeledeclaration = {
  meta: "Agence nationale de l'habitat · télédéclaration",
  numero: 'AAA000-123-456',
  lots: '36',
  budget: '142 000 €',
}

/** Document « Télédéclaration » (simulé) des données déclarées. */
function documentTeledeclaration({ meta, numero, lots, budget }: DonneesTeledeclaration): OptionsDocument {
  return {
    kind: 'doc',
    icon: 'bank',
    title: 'Télédéclaration — Registre des copropriétés',
    eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
    docTitle: 'Immatriculation au registre national',
    meta,
    lines: [
      "La fiche d'immatriculation a été télétransmise au registre national des copropriétés (art. L711-1 du CCH).",
      {
        h: 'Données déclarées',
      },
      {
        k: "Numéro d'immatriculation",
        v: numero,
      },
      {
        k: 'Nombre de lots',
        v: lots,
      },
      {
        k: 'Budget prévisionnel',
        v: budget,
      },
      {
        k: 'Dernier exercice clos',
        v: '2025',
      },
    ],
  }
}

/** Nombre de lignes du registre au statut donné. */
const compterStatut = (registre: readonly ImmatriculationDemo[], statut: ImmatriculationDemo[4]): number =>
  registre.filter((immatriculation) => immatriculation[4] === statut).length

/**
 * Immatriculation au registre national des copropriétés (CCH art. L711-1), écran de démonstration affiché selon la
 * copropriété choisie dans le sélecteur du haut de page : registre filtré, indicateurs calculés sur lui, télédéclaration
 * de la copropriété (numéro du registre, lots et budget de la copropriété). Sans copropriété choisie (écran rendu
 * seul) : tout le registre (3 / 1 / 1 / 120) et la télédéclaration de démonstration. La télédéclaration est simulée
 * (document généré).
 */
export function ImmatriculationRegistreModule() {
  const { push } = useToast()
  const [immatriculationOuverte, setImmatriculationOuverte] = useState<ImmatriculationDemo | null>(null)
  const code = useCodeCoproCourant()
  const copro = useCoproCourante()
  const registre = filtrerParCopro(DEMO_REGISTRE_IMMATRICULATION, code, (immatriculation) =>
    codeDeNomCopro(immatriculation[0]),
  )
  const teledeclaration: DonneesTeledeclaration = code
    ? {
        meta: `${copro.nom} · Agence nationale de l'habitat · télédéclaration`,
        numero: registre[0]?.[1] ?? '—',
        lots: String(copro.lots),
        budget: formatEuros(copro.budget),
      }
    : TELEDECLARATION_DEMO

  return (
    <>
      <PageHead
        eyebrow="Conformité · CCH art. L711-1"
        title="Immatriculation au registre national"
        lede="Immatriculation et télédéclaration annuelle des copropriétés au registre national (obligation légale)."
        actions={
          <button
            className="btn gold"
            onClick={() => push(documentTeledeclaration(teledeclaration))}
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
            num: registre.length - compterStatut(registre, 'manquante'),
            lbl: 'Copropriétés immatriculées',
            accent: 'sage',
          },
          {
            icon: 'alert',
            num: compterStatut(registre, 'à actualiser'),
            lbl: 'À actualiser',
            accent: 'amber',
          },
          {
            icon: 'siren',
            num: compterStatut(registre, 'manquante'),
            lbl: 'Non immatriculée',
            accent: 'rust',
          },
          {
            icon: 'grid',
            num: registre.reduce((total, immatriculation) => total + Number(immatriculation[2]), 0),
            lbl: 'Lots déclarés',
          },
        ]}
      />
      <Panel title="Registre des copropriétés sous mandat" icon="bank" flush>
        {registre.length === 0 ? (
          <EmptyState icon="bank" title={`Aucune immatriculation pour ${copro.nom}`} />
        ) : (
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
            rows={registre}
            onRow={setImmatriculationOuverte}
          />
        )}
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
