'use client'

import type { Dispatch, SetStateAction } from 'react'
import {
  PILL_CONFIANCE_RAPPROCHEMENT,
  type AnalyseReleve,
  type SelectionsImputation,
} from '@/components/administrateur-judiciaire/modules/finances/tresorerie/analyse-releve'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import type { PersonneCopropriete } from '@/lib/administrateur-judiciaire/domain/fiche-360'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'

/**
 * Résultat de l'analyse d'un relevé (panneau « Importer un relevé ») : lignes non lues, doublons écartés, lignes
 * retenues avec le copropriétaire proposé. Rendu déplacé tel quel de TresorerieModule.tsx.
 */

const STYLE_DISCRET = { fontSize: 11, color: 'var(--navy-300)' } as const

export interface ResultatAnalyseReleveProps {
  analyse: AnalyseReleve
  personnes: readonly PersonneCopropriete[]
  selections: SelectionsImputation
  setSelections: Dispatch<SetStateAction<SelectionsImputation>>
}

export function ResultatAnalyseReleve({ analyse, personnes, selections, setSelections }: Readonly<ResultatAnalyseReleveProps>) {
  const pluriel = (nombre: number) => (nombre > 1 ? 's' : '')
  return (
    <>
      {analyse.erreurs.length > 0 && (
        <Alert
          kind="warn"
          icon="alert"
          title={`${analyse.erreurs.length} ligne${pluriel(analyse.erreurs.length)} non lue${pluriel(analyse.erreurs.length)}`}
        >
          {analyse.erreurs.slice(0, 5).join(' · ')}
        </Alert>
      )}
      {analyse.doublons.length > 0 && (
        <Alert
          kind="info"
          icon="history"
          title={`${analyse.doublons.length} doublon${pluriel(analyse.doublons.length)} déjà importé${pluriel(analyse.doublons.length)}, écarté${pluriel(analyse.doublons.length)}`}
        >
          {analyse.doublons.map((ligne) => `${dateIsoVersFr(ligne.date)} ${ligne.libelle}`).join(' · ')}
        </Alert>
      )}
      {analyse.retenues.length > 0 && (
        <DataTable
          rowKey="i"
          columns={[
            {
              h: 'Date',
              render: (rapprochement) => <span className="mono">{dateIsoVersFr(rapprochement.ligne.date)}</span>,
            },
            {
              h: 'Libellé',
              render: (rapprochement) => rapprochement.ligne.libelle,
            },
            {
              h: 'Montant',
              render: (rapprochement) => (
                <span
                  className="mono"
                  style={{
                    color: rapprochement.ligne.montant < 0 ? 'var(--rust-500)' : 'var(--sage-600, inherit)',
                  }}
                >
                  {formatEurosCentimes(rapprochement.ligne.montant)}
                </span>
              ),
            },
            {
              h: 'Copropriétaire',
              render: (rapprochement) =>
                rapprochement.ligne.montant > 0 ? (
                  <select
                    aria-label={`Copropriétaire ligne ${rapprochement.i + 1}`}
                    value={selections[rapprochement.i] || ''}
                    onChange={(evenement) =>
                      setSelections((precedentes) => ({
                        ...precedentes,
                        [rapprochement.i]: evenement.target.value,
                      }))
                    }
                  >
                    <option value="">Ne pas imputer</option>
                    {personnes.map((personne) => (
                      <option value={personne.id} key={personne.id}>
                        {personne.nom}
                        {' · '}
                        {personne.lot}
                        {' · '}
                        {formatEurosCentimes(personne.solde)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    style={{
                      color: 'var(--navy-300)',
                      fontSize: 12,
                    }}
                  >
                    débit
                  </span>
                ),
            },
            {
              h: 'Rapprochement',
              render: (rapprochement) =>
                rapprochement.confiance ? (
                  <>
                    <Pill kind={PILL_CONFIANCE_RAPPROCHEMENT[rapprochement.confiance].kind} noDot>
                      {PILL_CONFIANCE_RAPPROCHEMENT[rapprochement.confiance].label}
                    </Pill>{' '}
                    <span style={STYLE_DISCRET}>{rapprochement.motif}</span>
                  </>
                ) : (
                  <span style={STYLE_DISCRET}>{rapprochement.motif}</span>
                ),
            },
          ]}
          rows={analyse.rapprochements.map((rapprochement, index) => ({
            ...rapprochement,
            i: index,
          }))}
        />
      )}
    </>
  )
}
