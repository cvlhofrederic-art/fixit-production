'use client'

import { useState, type ChangeEvent } from 'react'
import { EXEMPLE_RELEVE_BANCAIRE_CSV } from '@/components/administrateur-judiciaire/data/exemples-import'
import {
  analyserReleve,
  decoderTexteReleve,
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
 */

/** Fichiers proposés : CSV, CFONB 120 (.txt, .cfonb) et camt.053 (.xml, .053). */
const FICHIERS_ACCEPTES = '.csv,.txt,.xml,.053,.cfonb,text/csv,application/xml,text/xml'

const COMPTE_A_CHOISIR = 'Choisir le compte bancaire du relevé.'
const COMPTES_NON_LUS = 'Comptes bancaires non lus : import impossible pour l’instant.'

/** « 1 ligne enregistrée », « 2 lignes enregistrées ». */
const accord = (nombre: number, singulier: string, plurielle: string): string => `${nombre} ${nombre > 1 ? plurielle : singulier}`

/** Motif qui empêche l'import faute de compte choisi ; null : un compte est choisi. */
function motifSansCompte(etat: EtatComptes, actifs: number, choisi: CompteAffiche | null): string | null {
  if (choisi) return null
  if (etat !== 'lu') return COMPTES_NON_LUS
  return actifs === 0 ? AUCUN_COMPTE_ACTIF : COMPTE_A_CHOISIR
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
  const compteChoisi = actifs.length === 1 ? actifs[0] : (actifs.find((compte) => compte.id === choixCompte) ?? null)
  // Changement de copropriété (sélecteur du haut ou select local) ou de compte : l'analyse faite pour l'ancien est
  // abandonnée. Ajustement pendant le rendu, sans remontage de l'écran.
  const [codeAnalyse, setCodeAnalyse] = useState(copro?.code)
  if (codeAnalyse !== copro?.code) {
    setCodeAnalyse(copro?.code)
    setChoixCompte('')
    setAnalyse(null)
  }
  if (analyse && analyse.compteId !== (compteChoisi?.id ?? null)) setAnalyse(null)
  const motifCompte = motifSansCompte(etatComptes, actifs.length, compteChoisi)

  const analyser = () => {
    const resultat = analyserReleve({
      texte: texteReleve,
      compte: compteChoisi,
      lignesBanque,
      personnes: personnes.map((personne) => ({ id: personne.id, nom: personne.nom, solde: personne.solde })),
    })
    setAnalyse(resultat)
    setSelections(
      Object.fromEntries(
        resultat.rapprochements.map((rapprochement, index): [number, string] => [index, rapprochement.candidat ? rapprochement.candidat.id : '']),
      ),
    )
  }

  const choisirFichier = (evenement: ChangeEvent<HTMLInputElement>) => {
    const fichier = evenement.target.files && evenement.target.files[0]
    if (!fichier) return
    // Tout le fichier est lu en mémoire : un fichier trop gros est refusé avant sa lecture.
    const refus = refusTailleReleve(fichier.size)
    if (refus) {
      push({ kind: 'warn', title: 'Fichier non lu', desc: refus })
      return
    }
    const lecteur = new FileReader()
    lecteur.onload = () => {
      setTexteReleve(lecteur.result instanceof ArrayBuffer ? decoderTexteReleve(lecteur.result) : '')
      setAnalyse(null)
    }
    lecteur.onerror = () => {
      push({ kind: 'warn', title: 'Fichier non lu', desc: lecteur.error?.message ?? 'Lecture du fichier impossible.' })
    }
    lecteur.readAsArrayBuffer(fichier)
  }

  const importer = async () => {
    if (!copro || !analyse || !compteChoisi) return
    setImportEnCours(true)
    try {
      const ecrituresCreees = await importerReleveSurCompte(copro.id, compteChoisi.id, analyse.retenues)
      let imputes = 0
      for (let index = 0; index < ecrituresCreees.length; index++) {
        const coproprietaireId = selections[index]
        // Ligne déjà imputée à la main pendant la boucle : ni seconde imputation, ni décompte.
        if (coproprietaireId && ecrituresCreees[index].sens === 'debit' && (await imputerEnFile(ecrituresCreees[index].id, coproprietaireId)))
          imputes++
      }
      const nombre = ecrituresCreees.length,
        doublons = analyse.doublons.length
      push({
        kind: 'success',
        title: 'Relevé importé',
        desc:
          `${accord(nombre, 'ligne enregistrée', 'lignes enregistrées')} sur « ${nomDuCompte(compteChoisi)} », ` +
          accord(imputes, 'encaissement imputé', 'encaissements imputés') +
          `${doublons ? `, ${accord(doublons, 'doublon écarté', 'doublons écartés')}` : ''}.`,
      })
      setTexteReleve('')
      setAnalyse(null)
      setSelections({})
    } catch (erreur) {
      push({
        kind: 'warn',
        title: 'Import impossible',
        desc: erreur instanceof Error ? erreur.message : String(erreur),
      })
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
      {analyse && (
        <div
          style={{
            marginTop: 12,
          }}
        >
          <ResultatAnalyseReleve analyse={analyse} personnes={personnes} selections={selections} setSelections={setSelections} />
          {motifCompte && (
            <Alert kind="warn" icon="alert" title="Import impossible">
              {motifCompte}
            </Alert>
          )}
          <div
            style={{
              marginTop: 10,
              display: 'flex',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <button
              className="btn gold"
              onClick={importer}
              disabled={importEnCours || analyse.retenues.length === 0 || motifCompte !== null || analyse.blocage !== null}
            >
              <Icon name="check" />
              {'Importer '}
              {analyse.retenues.length}
              {' ligne'}
              {analyse.retenues.length > 1 ? 's' : ''}
            </button>
            <span
              style={{
                fontSize: 12,
                color: 'var(--navy-500)',
              }}
            >
              Les encaissements rapprochés mettent le solde du copropriétaire à jour et écrivent la contrepartie 450.
            </span>
          </div>
        </div>
      )}
    </Panel>
  )
}
