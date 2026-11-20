'use client'

import type { Dispatch, SetStateAction } from 'react'
import {
  LIBELLES_FORMAT_RELEVE,
  PILL_CONFIANCE_RAPPROCHEMENT,
  type AnalyseReleve,
  type ReleveLu,
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
 * retenues avec le copropriétaire proposé (rendu déplacé tel quel de TresorerieModule.tsx) ; pour un relevé CFONB 120
 * ou camt.053 (mémo de branchement du 20/11/2026), en plus : format lu, relevés lus avec leurs soldes, blocage de
 * l'import et toutes les erreurs du fichier (un relevé refusé reste lisible en entier), avertissements, limite des
 * empreintes (un relevé importé lors d'un import précédent n'est pas reconnu).
 */

const STYLE_DISCRET = { fontSize: 11, color: 'var(--navy-300)' } as const
/** Un message par ligne dans un bandeau (texte du domaine, gardé en entier). */
const STYLE_LIGNE = { display: 'block' } as const

const enLignes = (textes: readonly string[]) =>
  textes.map((texte, index) => (
    // Clé avec l'index : deux relevés refusés peuvent donner le même message.
    <span key={`${index}-${texte}`} style={STYLE_LIGNE}>
      {texte}
    </span>
  ))

/** Bandeaux de la lecture du fichier : blocage et erreurs, lignes non lues d'un CSV, avertissements, limite. */
function BandeauxLecture({ analyse }: Readonly<{ analyse: AnalyseReleve }>) {
  const structure = analyse.format !== 'csv'
  const pluriel = (nombre: number) => (nombre > 1 ? 's' : '')
  return (
    <>
      {analyse.blocage && (
        <Alert kind="rust" icon="alert" title="Import bloqué">
          <span style={STYLE_LIGNE}>{analyse.blocage}</span>
          {structure && enLignes(analyse.erreurs)}
        </Alert>
      )}
      {!structure && analyse.erreurs.length > 0 && (
        <Alert
          kind="warn"
          icon="alert"
          title={`${analyse.erreurs.length} ligne${pluriel(analyse.erreurs.length)} non lue${pluriel(analyse.erreurs.length)}`}
        >
          {analyse.erreurs.slice(0, 5).join(' · ')}
        </Alert>
      )}
      {analyse.avertissements.length > 0 && (
        <Alert kind="warn" icon="alert" title={`${analyse.avertissements.length} avertissement${pluriel(analyse.avertissements.length)}`}>
          {enLignes(analyse.avertissements)}
        </Alert>
      )}
      {analyse.limiteEmpreintes && (
        <Alert kind="" icon="info" title="Relevé déjà importé lors d’un import précédent : non reconnu">
          Les relevés importés ne sont pas encore mémorisés : seul un relevé présent deux fois dans ce fichier est reconnu.
          Vérifier la période avant d’importer : un relevé importé deux fois compterait deux fois dans le solde du compte.
        </Alert>
      )}
    </>
  )
}

/** Relevés lus d'un fichier CFONB 120 ou camt.053, dans l'ordre du fichier ; défile dans son cadre sur téléphone. */
function TableauRelevesLus({ releves }: Readonly<{ releves: readonly ReleveLu[] }>) {
  return (
    <div className="tbl-wrap" style={{ marginBottom: 12 }}>
      <table className="tbl" aria-label="Relevés lus">
        <thead>
          <tr>
            <th>Relevé</th>
            <th style={{ textAlign: 'right' }}>Ancien solde</th>
            <th style={{ textAlign: 'right' }}>Nouveau solde</th>
            <th style={{ textAlign: 'right' }}>Mouvements</th>
            <th>État</th>
          </tr>
        </thead>
        <tbody>
          {releves.map((releve) => (
            <tr key={releve.rang}>
              <td>{releve.designation}</td>
              <td className="num-cell" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                {releve.ancienSolde}
              </td>
              <td className="num-cell" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                {releve.nouveauSolde}
              </td>
              <td className="num-cell" style={{ textAlign: 'right' }}>
                {releve.mouvements}
              </td>
              <td>
                {releve.etat === 'nouveau' ? (
                  <Pill kind="sage" noDot>
                    Contrôlé
                  </Pill>
                ) : (
                  <Pill kind="amber" noDot>
                    Déjà dans le fichier
                  </Pill>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

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
      <p className="muted" style={{ fontSize: 12, margin: '0 0 10px' }}>
        Format lu : {LIBELLES_FORMAT_RELEVE[analyse.format]}
      </p>
      <BandeauxLecture analyse={analyse} />
      {analyse.releves.length > 0 && <TableauRelevesLus releves={analyse.releves} />}
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
