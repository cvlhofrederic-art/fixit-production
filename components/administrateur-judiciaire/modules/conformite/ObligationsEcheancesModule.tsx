'use client'

import { useState } from 'react'
import { DOCUMENT_EXPORT_DONNEES } from '@/components/administrateur-judiciaire/data/elements-communs'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal, type ChampDetail } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { titreListeVide, useCoproChoisie } from '@/components/administrateur-judiciaire/ui/copro-choisie'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useObligationsPortefeuille } from '@/lib/administrateur-judiciaire/db/use-echeances'
import { MESSAGES_ETAT_ECHEANCES } from '@/lib/administrateur-judiciaire/domain/echeances-mandat'
import {
  construireEcheancierObligations,
  LIBELLES_SOURCE_OBLIGATION,
  type LigneObligation,
} from '@/lib/administrateur-judiciaire/domain/obligations'
import { codeDeNomCopro, filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'

/** Fiche détail ouverte au clic sur une obligation. */
export interface DetailObligation {
  title: string
  icon: string
  footnote: string
  fields: ChampDetail[]
}

/** Certitude de la règle du moteur (les obligations suivies par le cabinet n'en ont pas). */
const certitudeObligation = (obligation: LigneObligation) =>
  obligation.source === 'moteur' ? obligation.certitude : undefined

/**
 * Copropriété d'une ligne de l'échéancier : celle du mandat pour une ligne du moteur (déjà filtrée par code), celle
 * du nom pour une obligation suivie de démonstration.
 */
const codeObligation = (obligation: LigneObligation, codeMoteur: string | null): string | null =>
  obligation.source === 'moteur' ? codeMoteur : codeDeNomCopro(obligation.copro)

/** Sous-titre de l'indicateur « Obligations suivies » : nombre de copropriétés (portefeuille seulement) et du moteur. */
function sousTitreSuivies(obligations: readonly LigneObligation[], coproChoisie: boolean): string {
  const calculees = `${obligations.filter((obligation) => obligation.source === 'moteur').length} calculées par le moteur`
  if (coproChoisie) return calculees
  const nombreCopros = new Set(obligations.map((obligation) => obligation.copro)).size
  return `${nombreCopros} copropriété${nombreCopros > 1 ? 's' : ''} · ${calculees}`
}

/** Titre de l'alerte des obligations légales échues (« 2 obligations légales échues ou à accomplir aujourd'hui »). */
function titreAlerteEchues(nombre: number): string {
  const pluriel = nombre > 1 ? 's' : ''
  return `${nombre} obligation${pluriel} légale${pluriel} échue${pluriel} ou à accomplir aujourd'hui`
}

/** Détail de l'alerte : les trois premières obligations échues, puis le nombre des autres (« ; et 2 autres »). */
function detailAlerteEchues(echues: readonly LigneObligation[]): string {
  const premieres = echues
    .slice(0, 3)
    .map((obligation) => `${obligation.copro} · ${obligation.objet} (${obligation.date})`)
    .join(' ; ')
  const autres = echues.length - 3
  if (autres <= 0) return premieres
  return `${premieres} ; et ${autres} autre${autres > 1 ? 's' : ''}`
}

/**
 * Obligations & échéances (statut « partiel ») : obligations non accomplies calculées par le moteur de délais depuis la
 * base locale, complétées par les obligations suivies par le cabinet (indicatives). Affiché selon la copropriété
 * choisie dans le sélecteur du haut de page : échéances de son mandat (filtrées ici, le hook restant celui de tout le
 * portefeuille, partagé avec « Aujourd'hui ») et obligations suivies à son nom ; indicateurs calculés sur ces lignes.
 * Répartition des indicateurs : rust = échues ou du jour, amber/navy = à planifier, sage = à venir. L'export est simulé.
 */
export function ObligationsEcheancesModule() {
  const { push } = useToast()
  const [detailOuvert, setDetailOuvert] = useState<DetailObligation | null>(null)
  const { loading, erreur, items } = useObligationsPortefeuille()
  const { code, nom } = useCoproChoisie()
  const obligations = filtrerParCopro(
    construireEcheancierObligations(
      filtrerParCopro(items, code, (item) => item.copro.code),
      AUJOURDHUI_ISO,
    ),
    code,
    (obligation) => codeObligation(obligation, code),
  )
  const echues = obligations.filter((obligation) => obligation.pill === 'rust')
  const aPlanifier = obligations.filter((obligation) => obligation.pill === 'amber' || obligation.pill === 'navy')
  const aVenir = obligations.filter((obligation) => obligation.pill === 'sage')
  const echuesMoteur = echues.filter((obligation) => obligation.source === 'moteur')

  return (
    <>
      <PageHead
        eyebrow="Conformité légale"
        title="Obligations & échéances"
        lede="Pilotage des obligations du syndic judiciaire — délais de mission, conformité loi 1965 / décret 1967, loi ALUR et loi Climat."
        actions={
          <button className="btn" onClick={() => push(DOCUMENT_EXPORT_DONNEES)}>
            <Icon name="download" />
            Exporter
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'scale',
            num: obligations.length,
            lbl: 'Obligations suivies',
            sub: sousTitreSuivies(obligations, !!code),
          },
          {
            icon: 'alert',
            num: echues.length,
            lbl: 'Échues ou du jour',
            sub: 'à traiter',
            accent: 'rust',
            trend:
              echues.length > 0
                ? {
                    kind: 'bad',
                    label: 'prioritaire',
                  }
                : undefined,
          },
          {
            icon: 'clock',
            num: aPlanifier.length,
            lbl: 'À planifier',
            sub: 'imminentes ou à déclencher',
            accent: 'amber',
          },
          {
            icon: 'check',
            num: aVenir.length,
            lbl: 'À venir ou conformes',
            sub: 'à jour',
            accent: 'sage',
          },
        ]}
      />
      {erreur && (
        <Alert kind="warn" icon="alert" title="Base locale indisponible">
          {MESSAGES_ETAT_ECHEANCES.indisponible}
        </Alert>
      )}
      {!loading &&
        (echuesMoteur.length > 0 ? (
          <Alert kind="warn" icon="calendar" title={titreAlerteEchues(echuesMoteur.length)}>
            {detailAlerteEchues(echuesMoteur)}.
          </Alert>
        ) : (
          <Alert kind="ok" icon="check" title="Aucune obligation légale échue">
            Toutes les obligations calculées par le moteur de délais sont à venir ou accomplies.
          </Alert>
        ))}
      <Panel title="Échéancier des obligations" sub="Objet · fondement légal · échéance" icon="scale" flush>
        {!loading && obligations.length === 0 ? (
          <EmptyState icon="scale" title={titreListeVide('Aucune obligation en cours', nom)} />
        ) : (
          <DataTable
            rowKey="id"
            columns={[
              {
                h: 'Obligation',
                render: (obligation) => (
                  <b
                    style={{
                      fontWeight: 600,
                    }}
                  >
                    {obligation.objet}
                  </b>
                ),
              },
              {
                h: 'Copropriété',
                render: (obligation) => obligation.copro,
              },
              {
                h: 'Fondement',
                render: (obligation) => (
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--navy-500)',
                    }}
                  >
                    {obligation.base}
                    {obligation.source === 'suivi' && (
                      <>
                        {' '}
                        <Pill kind="navy" noDot>
                          Indicatif
                        </Pill>
                      </>
                    )}
                    {certitudeObligation(obligation) === 'A_CONFIRMER' && (
                      <>
                        {' '}
                        <Pill kind="amber" noDot>
                          À confirmer
                        </Pill>
                      </>
                    )}
                    {certitudeObligation(obligation) === 'SOURCE_SECONDAIRE' && (
                      <>
                        {' '}
                        <Pill kind="gold" noDot>
                          Source secondaire
                        </Pill>
                      </>
                    )}
                  </span>
                ),
              },
              {
                h: 'Échéance',
                render: (obligation) => (
                  <span
                    style={{
                      fontWeight: 600,
                    }}
                  >
                    {obligation.date}
                  </span>
                ),
              },
              {
                h: 'Statut',
                render: (obligation) => (
                  <Pill kind={obligation.pill} noDot={obligation.source === 'moteur'}>
                    {obligation.statut}
                  </Pill>
                ),
              },
            ]}
            rows={obligations}
            onRow={(obligation) =>
              setDetailOuvert({
                title: obligation.objet,
                icon: 'scale',
                footnote: LIBELLES_SOURCE_OBLIGATION[obligation.source],
                fields: [
                  {
                    k: 'Copropriété',
                    v: obligation.copro,
                  },
                  {
                    k: 'Fondement légal',
                    v: obligation.base,
                  },
                  {
                    k: 'Échéance',
                    v: obligation.date,
                  },
                  {
                    k: 'Statut',
                    v: obligation.statut,
                  },
                  {
                    k: 'Note',
                    v: obligation.note,
                    full: true,
                  },
                ],
              })
            }
          />
        )}
      </Panel>
      <DetailModal
        open={!!detailOuvert}
        onClose={() => setDetailOuvert(null)}
        title={detailOuvert?.title}
        icon={detailOuvert?.icon}
        fields={detailOuvert?.fields || []}
        footnote={detailOuvert?.footnote}
      />
    </>
  )
}
