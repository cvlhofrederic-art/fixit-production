'use client'

import type { Dispatch, SetStateAction } from 'react'
import {
  LIBELLES_FORMAT_RELEVE,
  PILL_CONFIANCE_RAPPROCHEMENT,
  textePourEcran,
  texteBlocage,
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
 * l'import et toutes les erreurs du fichier (un relevé refusé reste lisible en entier), avertissements.
 * Décision du 26/11/2026 du référent métier (PR 799, point 10 B) : un relevé déjà importé sur le compte lors d'un import
 * précédent est reconnu ; un bandeau sur le modèle de « Import bloqué » le dit, un message par relevé, avec la date de
 * cet import, et sa ligne de « Relevés lus » porte « Déjà importé ». L'ancien bandeau « non reconnu » ne reste que pour
 * un compte qui porte des lignes sans relevé gardé (CSV, import antérieur), avec un texte qui dit cette limite.
 */

const STYLE_DISCRET = { fontSize: 11, color: 'var(--navy-300)' } as const
/** Un message par ligne dans un bandeau (texte du domaine, gardé en entier). */
const STYLE_LIGNE = { display: 'block' } as const

const enLignes = (textes: readonly string[]) =>
  textes.map((texte, index) => (
    // Clé avec l'index : deux relevés refusés peuvent donner le même message.
    <span key={`${index}-${texte}`} style={STYLE_LIGNE}>
      {textePourEcran(texte)}
    </span>
  ))

/** « Relevé déjà importé », « 2 relevés déjà importés ». */
const titreDejaImportes = (nombre: number): string => (nombre > 1 ? `${nombre} relevés déjà importés` : 'Relevé déjà importé')

/** Bandeaux de la lecture du fichier : blocage et erreurs, relevés déjà importés, lignes non lues d'un CSV, avertissements, limite. */
function BandeauxLecture({ analyse }: Readonly<{ analyse: AnalyseReleve }>) {
  const structure = analyse.format !== 'csv'
  const pluriel = (nombre: number) => (nombre > 1 ? 's' : '')
  return (
    <>
      {analyse.blocage && (
        <Alert kind="rust" icon="alert" title="Import bloqué">
          <span style={STYLE_LIGNE}>{texteBlocage(analyse.blocage)}</span>
          {structure && enLignes(analyse.erreurs)}
        </Alert>
      )}
      {analyse.relevesDejaImportes.length > 0 && (
        <Alert kind="rust" icon="alert" title={titreDejaImportes(analyse.relevesDejaImportes.length)}>
          {enLignes(analyse.relevesDejaImportes)}
          {analyse.relevesAImporter.length === 0 && (
            <span style={STYLE_LIGNE}>Rien à importer : tous les relevés de ce fichier sont déjà enregistrés sur ce compte.</span>
          )}
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
        <Alert kind="" icon="info" title="Lignes enregistrées sans relevé gardé">
          Des lignes de ce compte viennent d’un CSV ou d’un import fait avant que les relevés soient gardés : un relevé qui
          les contient n’est pas reconnu. Vérifier la période avant d’importer : un relevé importé deux fois compterait deux
          fois dans le solde du compte.
        </Alert>
      )}
    </>
  )
}

/** Pastille de l'état d'un relevé lu. */
const PILL_ETAT_RELEVE: Record<ReleveLu['etat'], { kind: string; label: string }> = {
  nouveau: { kind: 'sage', label: 'Contrôlé' },
  deja_importe: { kind: 'amber', label: 'Déjà dans le fichier' },
  importe_avant: { kind: 'amber', label: 'Déjà importé' },
}

/**
 * Relevés lus d'un fichier CFONB 120 ou camt.053, dans l'ordre du fichier ; sur téléphone, une fiche par relevé, les valeurs
 * les unes sous les autres (rb-c04 A : classe vfx-fiches, étiquette de chaque valeur dans data-label).
 */
function TableauRelevesLus({ releves }: Readonly<{ releves: readonly ReleveLu[] }>) {
  return (
    <div className="tbl-wrap" style={{ marginBottom: 12 }}>
      <table className="tbl vfx-fiches" aria-label="Relevés lus" role="table">
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader">Relevé</th>
            <th role="columnheader" style={{ textAlign: 'right' }}>
              Ancien solde
            </th>
            <th role="columnheader" style={{ textAlign: 'right' }}>
              Nouveau solde
            </th>
            <th role="columnheader" style={{ textAlign: 'right' }}>
              Mouvements
            </th>
            <th role="columnheader">État</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {releves.map((releve) => (
            <tr key={releve.rang} role="row">
              <td role="cell" data-label="Relevé">{releve.designation}</td>
              <td role="cell" className="num-cell" style={{ textAlign: 'right', whiteSpace: 'nowrap' }} data-label="Ancien solde">
                {releve.ancienSolde}
              </td>
              <td role="cell" className="num-cell" style={{ textAlign: 'right', whiteSpace: 'nowrap' }} data-label="Nouveau solde">
                {releve.nouveauSolde}
              </td>
              <td role="cell" className="num-cell" style={{ textAlign: 'right' }} data-label="Mouvements">
                {releve.mouvements}
              </td>
              <td role="cell" data-label="État">
                <Pill kind={PILL_ETAT_RELEVE[releve.etat].kind} noDot>
                  {PILL_ETAT_RELEVE[releve.etat].label}
                </Pill>
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

/** Ligne retenue du tableau : proposition d'imputation et son rang. */
type LigneRetenue = AnalyseReleve['rapprochements'][number] & { i: number }

interface CelluleCoproprietaireProps {
  ligne: LigneRetenue
  personnes: readonly PersonneCopropriete[]
  selections: SelectionsImputation
  setSelections: Dispatch<SetStateAction<SelectionsImputation>>
}

/** Copropriétaire à imputer (encaissement) ; « débit » pour une sortie. */
function CelluleCoproprietaire({ ligne, personnes, selections, setSelections }: Readonly<CelluleCoproprietaireProps>) {
  if (ligne.ligne.montant <= 0)
    return (
      <span
        style={{
          color: 'var(--navy-300)',
          fontSize: 12,
        }}
      >
        débit
      </span>
    )
  return (
    <select
      aria-label={`Copropriétaire ligne ${ligne.i + 1}`}
      value={selections[ligne.i] || ''}
      onChange={(evenement) =>
        setSelections((precedentes) => ({
          ...precedentes,
          [ligne.i]: evenement.target.value,
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
  )
}

/** Confiance et motif de l'imputation proposée. */
function CelluleImputationProposee({ ligne }: Readonly<{ ligne: LigneRetenue }>) {
  if (!ligne.confiance) return <span style={STYLE_DISCRET}>{ligne.motif}</span>
  return (
    <>
      <Pill kind={PILL_CONFIANCE_RAPPROCHEMENT[ligne.confiance].kind} noDot>
        {PILL_CONFIANCE_RAPPROCHEMENT[ligne.confiance].label}
      </Pill>{' '}
      <span style={STYLE_DISCRET}>{ligne.motif}</span>
    </>
  )
}

/** Lignes retenues avec le copropriétaire proposé. */
function TableauLignesRetenues({ analyse, personnes, selections, setSelections }: Readonly<ResultatAnalyseReleveProps>) {
  return (
    <DataTable
      rowKey="i"
      columns={[
        {
          h: 'Date',
          render: (ligne) => <span className="mono">{dateIsoVersFr(ligne.ligne.date)}</span>,
        },
        {
          h: 'Libellé',
          render: (ligne) => ligne.ligne.libelle,
        },
        {
          h: 'Montant',
          render: (ligne) => (
            <span className="mono" style={{ color: ligne.ligne.montant < 0 ? 'var(--rust-500)' : 'var(--sage-600, inherit)' }}>
              {formatEurosCentimes(ligne.ligne.montant)}
            </span>
          ),
        },
        {
          h: 'Copropriétaire',
          render: (ligne) => <CelluleCoproprietaire ligne={ligne} personnes={personnes} selections={selections} setSelections={setSelections} />,
        },
        {
          // Imputation proposée à un copropriétaire : « Rapprochement » désigne le rapprochement bancaire (rb-19 A, décision du 26/11/2026).
          h: 'Imputation proposée',
          render: (ligne) => <CelluleImputationProposee ligne={ligne} />,
        },
      ]}
      rows={analyse.rapprochements.map((rapprochement, index): LigneRetenue => ({ ...rapprochement, i: index }))}
    />
  )
}

export function ResultatAnalyseReleve(props: Readonly<ResultatAnalyseReleveProps>) {
  const { analyse } = props
  const s = analyse.doublons.length > 1 ? 's' : ''
  return (
    <>
      <p className="muted" style={{ fontSize: 12, margin: '0 0 10px' }}>
        Format lu : {LIBELLES_FORMAT_RELEVE[analyse.format]}
      </p>
      <BandeauxLecture analyse={analyse} />
      {analyse.releves.length > 0 && <TableauRelevesLus releves={analyse.releves} />}
      {analyse.doublons.length > 0 && (
        <Alert kind="info" icon="history" title={`${analyse.doublons.length} doublon${s} déjà importé${s}, écarté${s}`}>
          {analyse.doublons.map((ligne) => `${dateIsoVersFr(ligne.date)} ${ligne.libelle}`).join(' · ')}
        </Alert>
      )}
      {analyse.retenues.length > 0 && <TableauLignesRetenues {...props} />}
    </>
  )
}
