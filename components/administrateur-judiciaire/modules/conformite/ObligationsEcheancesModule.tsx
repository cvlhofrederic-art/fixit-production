'use client'

import { useState } from 'react'
import { DOCUMENT_EXPORT_DONNEES } from '@/components/administrateur-judiciaire/data/elements-communs'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal, type ChampDetail } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useObligationsPortefeuille } from '@/lib/administrateur-judiciaire/db/use-echeances'
import { MESSAGES_ETAT_ECHEANCES } from '@/lib/administrateur-judiciaire/domain/echeances-mandat'
import {
  construireEcheancierObligations,
  LIBELLES_SOURCE_OBLIGATION,
  type LigneObligation,
} from '@/lib/administrateur-judiciaire/domain/obligations'
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
 * Obligations & échéances (statut « partiel ») : obligations non accomplies calculées par le moteur de délais depuis la
 * base locale, complétées par les obligations suivies par le cabinet (indicatives). Répartition des indicateurs :
 * rust = échues ou du jour, amber/navy = à planifier, sage = à venir. L'export est simulé.
 */
export function ObligationsEcheancesModule() {
  const { push } = useToast()
  const [detailOuvert, setDetailOuvert] = useState<DetailObligation | null>(null)
  const { loading, erreur, items } = useObligationsPortefeuille()
  const obligations = construireEcheancierObligations(items, AUJOURDHUI_ISO)
  const echues = obligations.filter((obligation) => obligation.pill === 'rust')
  const aPlanifier = obligations.filter((obligation) => obligation.pill === 'amber' || obligation.pill === 'navy')
  const aVenir = obligations.filter((obligation) => obligation.pill === 'sage')
  const nombreCopros = new Set(obligations.map((obligation) => obligation.copro)).size
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
            sub: `${nombreCopros} copropriété${nombreCopros > 1 ? 's' : ''} · ${obligations.filter((obligation) => obligation.source === 'moteur').length} calculées par le moteur`,
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
          <Alert
            kind="warn"
            icon="calendar"
            title={`${echuesMoteur.length} obligation${echuesMoteur.length > 1 ? 's' : ''} légale${echuesMoteur.length > 1 ? 's' : ''} échue${echuesMoteur.length > 1 ? 's' : ''} ou à accomplir aujourd'hui`}
          >
            {echuesMoteur
              .slice(0, 3)
              .map((obligation) => `${obligation.copro} · ${obligation.objet} (${obligation.date})`)
              .join(' ; ')}
            {echuesMoteur.length > 3
              ? ` ; et ${echuesMoteur.length - 3} autre${echuesMoteur.length > 4 ? 's' : ''}`
              : ''}
            .
          </Alert>
        ) : (
          <Alert kind="ok" icon="check" title="Aucune obligation légale échue">
            Toutes les obligations calculées par le moteur de délais sont à venir ou accomplies.
          </Alert>
        ))}
      <Panel title="Échéancier des obligations" sub="Objet · fondement légal · échéance" icon="scale" flush>
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
