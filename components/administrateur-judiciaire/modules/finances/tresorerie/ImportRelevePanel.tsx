'use client'

import { useState, type ChangeEvent } from 'react'
import { EXEMPLE_RELEVE_BANCAIRE_CSV } from '@/components/administrateur-judiciaire/data/exemples-import'
import {
  analyserReleve,
  analyseValablePour,
  decoderTexteReleve,
  LIBELLES_FORMAT_RELEVE,
  refusTailleReleve,
  type AnalyseReleve,
  type MotifAVerifier,
  type SelectionsImputation,
} from '@/components/administrateur-judiciaire/modules/finances/tresorerie/analyse-releve'
import {
  AUCUN_COMPTE_ACTIF,
  ChoixCompteBancaire,
  comptesActifs,
  libelleCompte,
  type EtatComptes,
} from '@/components/administrateur-judiciaire/modules/finances/tresorerie/ChoixCompteBancaire'
import { nomDuCompte } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/CompteBancaireModal'
import type { CompteAffiche } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/comptes-bancaires-vue'
import { imputerEnFile } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/file-ecritures'
import { ResultatAnalyseReleve } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/ResultatAnalyseReleve'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { importerReleveSurCompte } from '@/lib/administrateur-judiciaire/db/releves-bancaires'
import type { Ecriture } from '@/lib/administrateur-judiciaire/db/schema'
import type { CoproprieteVue } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import type { PersonneCopropriete } from '@/lib/administrateur-judiciaire/domain/fiche-360'
import type { ReleveImporte } from '@/lib/administrateur-judiciaire/domain/import/releves-importes'

/**
 * Panneau « Importer un relevé » de l'écran « Banque et recouvrement », déplacé de TresorerieModule.tsx. Le relevé
 * s'importe sur le compte bancaire choisi (question 6 du plan des écrans, validée le 20/11/2026) : ses lignes vont au
 * sous-compte 512 de ce compte (db/releves-bancaires.ts), d'où le solde par compte. Seuls les comptes actifs de la
 * copropriété sont proposés ; un seul : choisi d'office ; plusieurs : à choisir. L'analyse reste possible sans compte
 * (lecture du fichier), l'import non. Changer de copropriété ou de compte abandonne l'analyse, faite pour l'ancien.
 * Formats : CSV, CFONB 120 et camt.053 (analyse-releve.ts) ; fichier lu en UTF-8, à défaut en Windows-1252, refusé
 * avant lecture au-delà de 10 Mo ; un fichier structuré qui contient une erreur n'est pas importé.
 * Décision du 26/11/2026 du référent métier (PR 799, points 10 B et 11 B) : les relevés CFONB 120 et camt.053 importés
 * sont gardés (db/releves-importes.ts). L'analyse reçoit ceux de la copropriété et reconnaît un relevé déjà importé sur
 * le compte choisi ; l'import garde les relevés nouveaux avec leurs lignes, puis fait relire les relevés gardés.
 * Retours de la relecture du 27/11/2026 : l'analyse reçoit aussi les fiches de compte de la copropriété, actives et
 * clôturées, pour dire sur laquelle un relevé a déjà été importé (deux fiches peuvent porter le même IBAN) ; un fichier
 * sans ligne à écrire dont un relevé nouveau est à garder (relevé sans mouvement, ou dont tous les mouvements sont déjà
 * venus d'un autre relevé) s'enregistre : le bouton devient « Enregistrer le relevé ». Sans cela, ce relevé ne serait
 * jamais gardé : il repasserait « Contrôlé » à chaque analyse, et « Nouvel arrêté » proposerait le solde du relevé
 * précédent.
 * Décision du 26/11/2026 (PR 799) : sur téléphone, « Importer N lignes » passe sous la phrase, en entier (rb-c06 A, classe
 * vfx-import-actions, règles de aj-correctifs.css) ; le motif « Aucun compte bancaire actif » n'est dit qu'une fois (rb-c08 A).
 */

/** Fichiers proposés : CSV, CFONB 120 (.txt, .cfonb) et camt.053 (.xml, .053). */
const FICHIERS_ACCEPTES = '.csv,.txt,.xml,.053,.cfonb,text/csv,application/xml,text/xml'

const COMPTE_A_CHOISIR = 'Choisir le compte bancaire du relevé.'
const COMPTES_NON_LUS = 'Comptes bancaires non lus : import impossible pour l’instant.'

/** « 1 ligne enregistrée », « 2 lignes enregistrées ». */
const accord = (nombre: number, singulier: string, plurielle: string): string => `${nombre} ${nombre > 1 ? plurielle : singulier}`

const messageErreur = (erreur: unknown): string => (erreur instanceof Error ? erreur.message : String(erreur))

/** Motif qui empêche l'import faute de compte choisi ; null : un compte est choisi. */
function motifSansCompte(etat: EtatComptes, actifs: number, choisi: CompteAffiche | null): string | null {
  if (choisi) return null
  if (etat !== 'lu') return COMPTES_NON_LUS
  return actifs === 0 ? AUCUN_COMPTE_ACTIF : COMPTE_A_CHOISIR
}

/** Compte de l'import : le seul compte actif, sinon celui choisi dans la liste ; null : aucun. */
const compteDeLImport = (actifs: readonly CompteAffiche[], choix: string): CompteAffiche | null =>
  actifs.length === 1 ? actifs[0] : (actifs.find((compte) => compte.id === choix) ?? null)

/** Copropriétaire proposé pour chaque ligne retenue (« » : ne pas imputer). */
const selectionsProposees = (analyse: AnalyseReleve): SelectionsImputation =>
  Object.fromEntries(analyse.rapprochements.map((rapprochement, index): [number, string] => [index, rapprochement.candidat?.id ?? '']))

/**
 * Importe les lignes retenues sur le sous-compte 512 du compte, puis impute les encaissements choisis, chacun à son tour
 * dans la file des écritures de l'écran. Renvoie le nombre de lignes enregistrées et d'encaissements imputés.
 */
async function importerEtImputer(
  coproprieteId: string,
  compte: CompteAffiche,
  analyse: AnalyseReleve,
  selections: SelectionsImputation,
): Promise<{ lignes: number; imputes: number }> {
  const ecrituresCreees = await importerReleveSurCompte(coproprieteId, compte.id, analyse.retenues, analyse.relevesAImporter)
  let imputes = 0
  for (const [index, ecriture] of ecrituresCreees.entries()) {
    const coproprietaireId = selections[index]
    // Ligne déjà imputée à la main pendant la boucle : ni seconde imputation, ni décompte.
    if (coproprietaireId && ecriture.sens === 'debit' && (await imputerEnFile(ecriture.id, coproprietaireId))) imputes++
  }
  return { lignes: ecrituresCreees.length, imputes }
}

/** Texte du toast d'un import réussi. */
function descriptionImport(compte: CompteAffiche, lignes: number, imputes: number, doublons: number): string {
  const ecartes = doublons ? `, ${accord(doublons, 'doublon écarté', 'doublons écartés')}` : ''
  return (
    `${accord(lignes, 'ligne enregistrée', 'lignes enregistrées')} sur « ${nomDuCompte(compte)} », ` +
    `${accord(imputes, 'encaissement imputé', 'encaissements imputés')}${ecartes}.`
  )
}

/** Vrai pour un fichier importable sans ligne à écrire dont un relevé nouveau au moins est à garder (voir l'en-tête). */
const relevesSeulsAGarder = (analyse: AnalyseReleve): boolean =>
  analyse.blocage === null && analyse.retenues.length === 0 && analyse.relevesAImporter.length > 0

/** Toast d'un import réussi : lignes enregistrées, ou relevés gardés sans ligne à écrire. */
function toastImport(compte: CompteAffiche, analyse: AnalyseReleve, lignes: number, imputes: number): { kind: 'success'; title: string; desc: string } {
  if (relevesSeulsAGarder(analyse))
    return {
      kind: 'success',
      title: 'Relevé enregistré',
      desc: `${accord(analyse.relevesAImporter.length, 'relevé enregistré', 'relevés enregistrés')} sur « ${nomDuCompte(compte)} », aucune ligne à écrire.`,
    }
  return { kind: 'success', title: 'Relevé importé', desc: descriptionImport(compte, lignes, imputes, analyse.doublons.length) }
}

/**
 * Lit un fichier de relevé : refusé avant lecture au-delà du seuil de taille (tout est lu en mémoire), puis décodé
 * (UTF-8, à défaut Windows-1252). Le texte lu ou le motif du refus est rendu par `lu` ou `refuse`.
 */
function lireFichierReleve(fichier: File, lu: (texte: string) => void, refuse: (motif: string) => void): void {
  const refus = refusTailleReleve(fichier.size)
  if (refus) {
    refuse(refus)
    return
  }
  const lecteur = new FileReader()
  lecteur.onload = () => lu(lecteur.result instanceof ArrayBuffer ? decoderTexteReleve(lecteur.result) : '')
  lecteur.onerror = () => refuse(lecteur.error?.message ?? 'Lecture du fichier impossible.')
  lecteur.readAsArrayBuffer(fichier)
}

/**
 * « Importer 1 ligne », « Importer 2 lignes » ; sans ligne à écrire mais avec un relevé nouveau à garder : « Enregistrer
 * le relevé », « Enregistrer les 2 relevés ».
 */
function libelleImporter(analyse: AnalyseReleve): string {
  const lignes = analyse.retenues.length,
    releves = analyse.relevesAImporter.length
  if (!relevesSeulsAGarder(analyse)) return `Importer ${lignes} ligne${lignes > 1 ? 's' : ''}`
  return releves > 1 ? `Enregistrer les ${releves} relevés` : 'Enregistrer le relevé'
}

/** Phrase à côté du bouton : ce que fait l'import. */
const PHRASE_IMPORT = 'Les encaissements rapprochés mettent le solde du copropriétaire à jour et écrivent la contrepartie 450.'
/** Avant le clic : le relevé n'est pas encore gardé, c'est « Enregistrer … » qui le garde (accord selon le nombre de relevés). */
const phraseReleveSansLigne = (releves: number): string =>
  releves > 1
    ? `Aucune ligne à écrire. « Enregistrer les ${releves} relevés » les garde : ils seront reconnus au prochain import, et leur solde de clôture pourra être repris dans un arrêté.`
    : 'Aucune ligne à écrire. « Enregistrer le relevé » le garde : il sera reconnu au prochain import, et son solde de clôture pourra être repris dans un arrêté.'

/** Relevés déjà importés (sur ce compte ou sur une autre fiche de la copropriété), annoncés avec le résultat de l'analyse ; null : aucun. */
function annonceDejaImportes(nombre: number): string | null {
  if (nombre === 0) return null
  return nombre > 1 ? `${nombre} relevés déjà importés : leurs mouvements ne sont pas repris.` : 'Relevé déjà importé : ses mouvements ne sont pas repris.'
}

/** Ce qui fait écarter les relevés à vérifier, tel que l'annonce le dit : un motif, ou les deux. */
function motifAnnonce(motifs: readonly MotifAVerifier[]): string {
  if (motifs.length > 1) return 'même identifiant ou même période qu’un relevé déjà importé, contenu différent'
  return motifs[0] === 'periode'
    ? 'même période qu’un relevé déjà importé, soldes ou totaux différents'
    : 'même identifiant qu’un relevé déjà importé, contenu différent'
}

/**
 * Relevés non repris pour leur identifiant (celui d'un relevé gardé d'un autre contenu) ou, sans identifiant commun, pour
 * leur période (réponse du 28/11/2026, point #858 · 2 A), annoncés de même ; null : aucun.
 */
function annonceAVerifier(nombre: number, motifs: readonly MotifAVerifier[]): string | null {
  if (nombre === 0) return null
  const sujet = nombre > 1 ? `${nombre} relevés non repris` : 'Relevé non repris'
  return `${sujet}, à vérifier : ${motifAnnonce(motifs)}.`
}

/**
 * Résultat de l'analyse annoncé aux lecteurs d'écran (zone aria-live du panneau, présente avant l'analyse, comme
 * l'annonce de la fiche sinistre) : lignes retenues et ce qui empêche l'import ; vide sans analyse.
 */
function annonceAnalyse(analyse: AnalyseReleve | null, motifCompte: string | null): string {
  if (!analyse) return ''
  const lignes = `Relevé analysé (${LIBELLES_FORMAT_RELEVE[analyse.format]}) : ${accord(analyse.retenues.length, 'ligne retenue', 'lignes retenues')}.`
  const motif = motifCompte ? `Import impossible : ${motifCompte}` : null
  return [lignes, annonceDejaImportes(analyse.relevesDejaImportes.length), annonceAVerifier(analyse.relevesAVerifier.length, analyse.motifsAVerifier), analyse.blocage, motif]
    .filter((texte): texte is string => texte !== null)
    .join(' ')
}

export interface ImportRelevePanelProps {
  copro: CoproprieteVue | undefined
  /** Comptes lisibles de la copropriété, actifs et clôturés : seuls les actifs sont proposés. */
  comptes: readonly CompteAffiche[]
  etatComptes: EtatComptes
  personnes: readonly PersonneCopropriete[]
  /** Écritures de banque (« 512 » et sous-comptes) du journal de la copropriété. */
  lignesBanque: readonly Ecriture[]
  /** Relevés importés gardés de la copropriété (toutes ses fiches de compte) : un relevé déjà importé est reconnu à l'analyse. */
  relevesImportes: readonly ReleveImporte[]
  /** Relit les relevés gardés, après un import. */
  relireReleves: () => void
}

export function ImportRelevePanel({
  copro,
  comptes,
  etatComptes,
  personnes,
  lignesBanque,
  relevesImportes,
  relireReleves,
}: Readonly<ImportRelevePanelProps>) {
  const { push } = useToast()
  const [texteReleve, setTexteReleve] = useState('')
  const [analyse, setAnalyse] = useState<AnalyseReleve | null>(null)
  const [selections, setSelections] = useState<SelectionsImputation>({})
  const [importEnCours, setImportEnCours] = useState(false)
  const [choixCompte, setChoixCompte] = useState('')
  const actifs = comptesActifs(comptes, etatComptes)
  const compteChoisi = compteDeLImport(actifs, choixCompte)
  // Changement de copropriété (sélecteur du haut ou select local), de compte ou de l'IBAN du compte : l'analyse faite
  // pour l'ancien est abandonnée. Ajustement pendant le rendu, sans remontage de l'écran.
  const [codeAnalyse, setCodeAnalyse] = useState(copro?.code)
  if (codeAnalyse !== copro?.code) {
    setCodeAnalyse(copro?.code)
    setChoixCompte('')
    setAnalyse(null)
  }
  if (analyse && !analyseValablePour(analyse, compteChoisi)) setAnalyse(null)
  const motifCompte = motifSansCompte(etatComptes, actifs.length, compteChoisi)
  // « Aucun compte bancaire actif » est déjà dit sous la liste des comptes : pas répété dans le bandeau (rb-c08 A, décision
  // du 26/11/2026). Le bouton reste inactif et la zone aria-live l'annonce toujours avec le résultat de l'analyse.
  const motifDejaAffiche = motifCompte === AUCUN_COMPTE_ACTIF && etatComptes === 'lu'

  const analyser = () => {
    const resultat = analyserReleve({
      texte: texteReleve,
      compte: compteChoisi,
      lignesBanque,
      personnes: personnes.map((personne) => ({ id: personne.id, nom: personne.nom, solde: personne.solde })),
      relevesImportes,
      comptes: comptes.map((compte) => ({ id: compte.id, libelle: libelleCompte(compte), cloture: !compte.actif })),
    })
    setAnalyse(resultat)
    setSelections(selectionsProposees(resultat))
  }

  const choisirFichier = (evenement: ChangeEvent<HTMLInputElement>) => {
    const fichier = evenement.target.files?.[0]
    if (!fichier) return
    lireFichierReleve(
      fichier,
      (texte) => {
        setTexteReleve(texte)
        setAnalyse(null)
      },
      (motif) => push({ kind: 'warn', title: 'Fichier non lu', desc: motif }),
    )
  }

  const importer = async () => {
    if (!copro || !analyse || !compteChoisi) return
    setImportEnCours(true)
    try {
      const { lignes, imputes } = await importerEtImputer(copro.id, compteChoisi, analyse, selections)
      push(toastImport(compteChoisi, analyse, lignes, imputes))
      setTexteReleve('')
      setAnalyse(null)
      setSelections({})
    } catch (erreur) {
      push({ kind: 'warn', title: 'Import impossible', desc: messageErreur(erreur) })
    } finally {
      // Relevés gardés relus après une réussite comme après un refus (relevé gardé entre-temps par un autre import).
      relireReleves()
      setImportEnCours(false)
    }
  }

  return (
    <Panel
      title="Importer un relevé"
      sub="Relevé de la banque : CSV (date, libellé, montant, ou débit et crédit), CFONB 120 ou camt.053. Coller le texte ou choisir un fichier."
      icon="upload"
    >
      <ChoixCompteBancaire
        label="Compte bancaire du relevé"
        name="releve-compte"
        etat={etatComptes}
        actifs={actifs}
        choisi={compteChoisi}
        choisir={setChoixCompte}
        choixExige
      />
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <input type="file" accept={FICHIERS_ACCEPTES} aria-label="Fichier de relevé" onChange={choisirFichier} />
        <button
          className="btn"
          onClick={() => {
            setTexteReleve(EXEMPLE_RELEVE_BANCAIRE_CSV)
            setAnalyse(null)
          }}
        >
          Exemple
        </button>
        <button className="btn gold" onClick={analyser} disabled={!texteReleve.trim() || !copro}>
          <Icon name="search" />
          Analyser
        </button>
      </div>
      <textarea
        aria-label="Relevé bancaire"
        value={texteReleve}
        onChange={(evenement) => {
          setTexteReleve(evenement.target.value)
          setAnalyse(null)
        }}
        rows={5}
        style={{
          width: '100%',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12,
        }}
        placeholder={EXEMPLE_RELEVE_BANCAIRE_CSV}
      />
      <p className="sr-only" aria-live="polite">
        {annonceAnalyse(analyse, motifCompte)}
      </p>
      {analyse && (
        <div
          style={{
            marginTop: 12,
          }}
        >
          <ResultatAnalyseReleve analyse={analyse} personnes={personnes} selections={selections} setSelections={setSelections} />
          {motifCompte && !motifDejaAffiche && (
            <Alert kind="warn" icon="alert" title="Import impossible">
              {motifCompte}
            </Alert>
          )}
          <div
            className="vfx-import-actions"
            style={{
              marginTop: 10,
              display: 'flex',
              gap: 10,
            }}
          >
            <button
              className="btn gold"
              onClick={importer}
              disabled={
                importEnCours ||
                (analyse.retenues.length === 0 && analyse.relevesAImporter.length === 0) ||
                motifCompte !== null ||
                analyse.blocage !== null
              }
            >
              <Icon name="check" />
              {libelleImporter(analyse)}
            </button>
            <span
              style={{
                fontSize: 12,
                color: 'var(--navy-500)',
              }}
            >
              {relevesSeulsAGarder(analyse) ? phraseReleveSansLigne(analyse.relevesAImporter.length) : PHRASE_IMPORT}
            </span>
          </div>
        </div>
      )}
    </Panel>
  )
}
