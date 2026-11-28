'use client'

import { useState, type ChangeEvent } from 'react'
import { EXEMPLE_RELEVE_BANCAIRE_CSV } from '@/components/administrateur-judiciaire/data/exemples-import'
import {
  analyserReleve,
  analyseValablePour,
  avecPeriodeArretee,
  decoderTexteReleve,
  LIBELLES_FORMAT_RELEVE,
  refusTailleReleve,
  type AnalyseReleve,
  type SelectionsImputation,
} from '@/components/administrateur-judiciaire/modules/finances/tresorerie/analyse-releve'
import {
  AUCUN_COMPTE_ACTIF,
  ChoixCompteBancaire,
  comptesActifs,
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
import { useArretesRapprochement } from '@/lib/administrateur-judiciaire/db/use-arretes'
import type { CoproprieteVue } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import type { PersonneCopropriete } from '@/lib/administrateur-judiciaire/domain/fiche-360'

/**
 * Panneau « Importer un relevé » de l'écran « Banque et recouvrement », déplacé de TresorerieModule.tsx. Le relevé
 * s'importe sur le compte bancaire choisi (question 6 du plan des écrans, validée le 20/11/2026) : ses lignes vont au
 * sous-compte 512 de ce compte (db/releves-bancaires.ts), d'où le solde par compte. Seuls les comptes actifs de la
 * copropriété sont proposés ; un seul : choisi d'office ; plusieurs : à choisir. L'analyse reste possible sans compte
 * (lecture du fichier), l'import non. Changer de copropriété ou de compte abandonne l'analyse, faite pour l'ancien.
 * Formats : CSV, CFONB 120 et camt.053 (analyse-releve.ts) ; fichier lu en UTF-8, à défaut en Windows-1252, refusé
 * avant lecture au-delà de 10 Mo ; un fichier structuré qui contient une erreur n'est pas importé.
 * Décision du 26/11/2026 (PR 799) : sur téléphone, « Importer N lignes » passe sous la phrase, en entier (rb-c06 A, classe
 * vfx-import-actions, règles de aj-correctifs.css) ; le motif « Aucun compte bancaire actif » n'est dit qu'une fois (rb-c08 A).
 * Décision du 26/11/2026 (PR 799, rb-04 A), période arrêtée protégée : un relevé dont une ligne retenue est datée au plus
 * tard du dernier arrêté clôturé du compte est bloqué en entier, dans le bandeau « Import bloqué » des autres motifs, et
 * le bouton d'import est inactif. Le blocage est recalculé à chaque affichage sur les arrêtés du compte (avecPeriodeArretee,
 * useArretesRapprochement) : il suit une clôture ou une déclôture faite dans le panneau « Rapprochement ». La base refuse
 * de toute façon l'import (db/releves-bancaires.ts) : après un refus, les arrêtés sont relus. Plusieurs arrêtés clôturés
 * concernés : le bandeau dit que déclôturer le dernier ne suffit pas (motif du domaine, libellé à valider).
 * Réponses du référent métier du 28/11/2026 (corrections de la PR 799) : la phrase à côté du bouton dit « encaissements
 * imputés », le mot « rapprochement » étant réservé au rapprochement bancaire (cr-02) ; sans compte actif, le motif
 * « Aucun compte bancaire actif … » est dit près du bouton « Importer N lignes », là où l'on est bloqué, dans le bandeau
 * « Import impossible » des autres motifs, et plus sous la liste « Compte bancaire du relevé », qui affiche déjà « Aucun
 * compte actif » (cr-03 B). Il n'est toujours dit qu'une fois dans le panneau (rb-c08).
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
  const ecrituresCreees = await importerReleveSurCompte(coproprieteId, compte.id, analyse.retenues)
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

/** « Importer 1 ligne », « Importer 2 lignes ». */
const libelleImporter = (nombre: number): string => `Importer ${nombre} ligne${nombre > 1 ? 's' : ''}`

/**
 * Résultat de l'analyse annoncé aux lecteurs d'écran (zone aria-live du panneau, présente avant l'analyse, comme
 * l'annonce de la fiche sinistre) : lignes retenues et ce qui empêche l'import ; vide sans analyse.
 */
function annonceAnalyse(analyse: AnalyseReleve | null, motifCompte: string | null): string {
  if (!analyse) return ''
  const lignes = `Relevé analysé (${LIBELLES_FORMAT_RELEVE[analyse.format]}) : ${accord(analyse.retenues.length, 'ligne retenue', 'lignes retenues')}.`
  const motif = motifCompte ? `Import impossible : ${motifCompte}` : null
  return [lignes, analyse.blocage, motif].filter((texte): texte is string => texte !== null).join(' ')
}

export interface ImportRelevePanelProps {
  copro: CoproprieteVue | undefined
  /** Comptes lisibles de la copropriété, actifs et clôturés : seuls les actifs sont proposés. */
  comptes: readonly CompteAffiche[]
  etatComptes: EtatComptes
  personnes: readonly PersonneCopropriete[]
  /** Écritures de banque (« 512 » et sous-comptes) du journal de la copropriété. */
  lignesBanque: readonly Ecriture[]
}

export function ImportRelevePanel({ copro, comptes, etatComptes, personnes, lignesBanque }: Readonly<ImportRelevePanelProps>) {
  const { push } = useToast()
  const [texteReleve, setTexteReleve] = useState('')
  const [analyse, setAnalyse] = useState<AnalyseReleve | null>(null)
  const [selections, setSelections] = useState<SelectionsImputation>({})
  const [importEnCours, setImportEnCours] = useState(false)
  const [choixCompte, setChoixCompte] = useState('')
  const actifs = comptesActifs(comptes, etatComptes)
  const compteChoisi = compteDeLImport(actifs, choixCompte)
  // Échec de lecture des arrêtés : signalé une seule fois, par le panneau « Rapprochement » du même écran (toast
  // « Arrêtés illisibles ») ; pas de second toast identique ici. Sans arrêtés lus, aucun blocage n'est montré : la base
  // contrôle de toute façon à l'import.
  const arretesLus = useArretesRapprochement(compteChoisi?.id ?? null, null)
  // Changement de copropriété (sélecteur du haut ou select local), de compte ou de l'IBAN du compte : l'analyse faite
  // pour l'ancien est abandonnée. Ajustement pendant le rendu, sans remontage de l'écran.
  const [codeAnalyse, setCodeAnalyse] = useState(copro?.code)
  if (codeAnalyse !== copro?.code) {
    setCodeAnalyse(copro?.code)
    setChoixCompte('')
    setAnalyse(null)
  }
  if (analyse && !analyseValablePour(analyse, compteChoisi)) setAnalyse(null)
  // Analyse affichée : celle du fichier, avec le blocage de la période arrêtée d'après les arrêtés lus (rb-04 A).
  const analyseAffichee = analyse && avecPeriodeArretee(analyse, arretesLus.arretes)
  // Motif dit une seule fois (rb-c08), dans le bandeau « Import impossible » placé près du bouton d'import ; « Aucun compte
  // bancaire actif » n'est plus dit sous la liste des comptes (cr-03 B, réponse du 28/11/2026). La zone aria-live l'annonce
  // toujours avec le résultat de l'analyse.
  const motifCompte = motifSansCompte(etatComptes, actifs.length, compteChoisi)

  const analyser = () => {
    const resultat = analyserReleve({
      texte: texteReleve,
      compte: compteChoisi,
      lignesBanque,
      personnes: personnes.map((personne) => ({ id: personne.id, nom: personne.nom, solde: personne.solde })),
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
      push({ kind: 'success', title: 'Relevé importé', desc: descriptionImport(compteChoisi, lignes, imputes, analyse.doublons.length) })
      setTexteReleve('')
      setAnalyse(null)
      setSelections({})
    } catch (erreur) {
      push({ kind: 'warn', title: 'Import impossible', desc: messageErreur(erreur) })
      // Refus possible pour un arrêté clôturé ailleurs depuis la lecture (autre onglet) : l'écran relit et le montre.
      arretesLus.relire()
    } finally {
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
        sansCompteActif={null}
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
        {annonceAnalyse(analyseAffichee, motifCompte)}
      </p>
      {analyseAffichee && (
        <div
          style={{
            marginTop: 12,
          }}
        >
          <ResultatAnalyseReleve analyse={analyseAffichee} personnes={personnes} selections={selections} setSelections={setSelections} />
          {motifCompte && (
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
              disabled={importEnCours || analyseAffichee.retenues.length === 0 || motifCompte !== null || analyseAffichee.blocage !== null}
            >
              <Icon name="check" />
              {libelleImporter(analyseAffichee.retenues.length)}
            </button>
            <span
              style={{
                fontSize: 12,
                color: 'var(--navy-500)',
              }}
            >
              Les encaissements imputés mettent le solde du copropriétaire à jour et écrivent la contrepartie 450.
            </span>
          </div>
        </div>
      )}
    </Panel>
  )
}
