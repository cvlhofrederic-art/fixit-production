'use client'

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { OptionContratSinistre } from '@/components/administrateur-judiciaire/data/sinistres'
import {
  BlocAssurance,
  BlocEnTete,
  BlocEquipe,
  BlocIndemnites,
  BlocNotes,
  BlocQualification,
  BlocRattachement,
  type ChangerValeur,
} from '@/components/administrateur-judiciaire/modules/technique/sinistres/BlocsFicheSinistre'
import { BlocParties, BlocSuivi } from '@/components/administrateur-judiciaire/modules/technique/sinistres/BlocsPartiesSuivi'
import { BlocFiche, CaseModifiable } from '@/components/administrateur-judiciaire/modules/technique/sinistres/ChampsFiche'
import type {
  ChoixSinistre,
  CoproChoixSinistre,
} from '@/components/administrateur-judiciaire/modules/technique/sinistres/choix-sinistre'
import {
  evaluerFicheSinistre,
  valeursDepuisFiche,
  valeursAvecContrat,
  valeursAvecCopro,
  valeursNouvelleDeclaration,
  type ErreursChamps,
  type ValeursFicheSinistre,
} from '@/components/administrateur-judiciaire/modules/technique/sinistres/formulaire-sinistre'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { GrilleFiche } from '@/components/administrateur-judiciaire/ui/FicheBlocs'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'
import { proposerNumeroSinistre } from '@/lib/administrateur-judiciaire/domain/fiche-sinistre'
import type { FicheSinistre, SaisieSinistre } from '@/lib/administrateur-judiciaire/domain/sinistres'
import type { StatutSinistre } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Fiche sinistre : UNE seule modale pour la déclaration et la modification (« Détails »), avec tous les champs de la
 * fiche Gestéam groupés comme Gestéam. Déclaration : en-tête, rattachement, assurance et qualification ouverts, les
 * autres blocs à compléter (repliables) ; « Détails » : tous les blocs ouverts, fiche pré-remplie et modifiable.
 * Enregistrement refusé : chaque champ en erreur porte son message (aria-invalid, role="alert" de Field) et le résumé
 * des erreurs, en tête du corps défilant, reçoit le focus (ce qui l'amène à l'écran) ; ses changements ultérieurs sont
 * annoncés poliment. Points d'attention et annonces en aria-live="polite". La modale est remontée pour chaque fiche
 * (clé = id), son état repart de la fiche.
 */

/** Fiche identifiée (ligne de la base relue, ou fiche de démonstration). */
export type LigneSinistre = FicheSinistre & { id: string }

export const BLOCS_FICHE_SINISTRE = [
  { id: 'enTete', titre: 'En-tête', icone: 'flag', essentiel: true },
  { id: 'rattachement', titre: 'Rattachement', icone: 'building', essentiel: true },
  { id: 'assurance', titre: 'Assurance', icone: 'shield', essentiel: true },
  { id: 'qualification', titre: 'Qualification', icone: 'droplet', essentiel: true },
  { id: 'indemnites', titre: 'Indemnités', icone: 'coin', essentiel: false },
  { id: 'parties', titre: 'Parties', icone: 'users', essentiel: false },
  { id: 'suivi', titre: 'Suivi', icone: 'calendar', essentiel: false },
  { id: 'notes', titre: 'Notes', icone: 'pencil', essentiel: false },
  { id: 'equipe', titre: 'Responsable et assistant', icone: 'team', essentiel: false },
] as const

type IdBloc = (typeof BLOCS_FICHE_SINISTRE)[number]['id']

export interface FicheSinistreModalProps {
  /** Fiche à modifier ; null : déclaration. */
  ligne: LigneSinistre | null
  choix: ChoixSinistre
  /** Copropriété préremplie d'une déclaration (copropriété choisie, sinon la première). */
  coproParDefaut: CoproChoixSinistre | null
  /** Numéros des AUTRES fiches (proposition et unicité du numéro). */
  numerosExistants: readonly (string | null)[]
  /** Jour courant (AAAA-MM-JJ). */
  aujourdhui: string
  onClose: () => void
  /** Enregistre (ou simule) ; renvoie vrai si la fiche peut se fermer. Ne rejette jamais (l'écran signale l'échec). */
  onEnregistrer: (saisie: SaisieSinistre, statut: StatutSinistre) => Promise<boolean>
}

const seulMandat = (choix: ChoixSinistre, coproprieteId: string): string => {
  const mandats = choix.mandatsDe(coproprieteId)
  return mandats.length === 1 ? mandats[0].id : ''
}

const codeDe = (choix: ChoixSinistre, coproprieteId: string): string | null =>
  choix.copros.find((copro) => copro.id === coproprieteId)?.code ?? null

function valeursInitiales(props: FicheSinistreModalProps): ValeursFicheSinistre {
  const { ligne, choix, coproParDefaut, numerosExistants, aujourdhui } = props
  if (ligne) return valeursDepuisFiche(ligne)
  const coproprieteId = coproParDefaut?.id ?? ''
  return valeursNouvelleDeclaration({
    coproprieteId,
    mandatId: seulMandat(choix, coproprieteId),
    numero: proposerNumeroSinistre(coproParDefaut?.code, numerosExistants) ?? '',
    aujourdhui,
  })
}

/** Contrat d'assurance choisi dans la fiche (liste « Contrat » de sa copropriété), null si aucun. */
const contratDe = (choix: ChoixSinistre, valeurs: ValeursFicheSinistre): OptionContratSinistre | null =>
  valeurs.contratId
    ? (choix.contratsDe(valeurs.coproprieteId).find((contrat) => contrat.id === valeurs.contratId) ?? null)
    : null

/** Fiches de la copropriété (l'immeuble, ses copropriétaires) auxquelles une partie peut être rattachée. */
const refsDeLaCopro = (choix: ChoixSinistre, coproprieteId: string): string[] | null =>
  coproprieteId ? [coproprieteId, ...choix.personnesDe(coproprieteId).map((personne) => personne.id)] : null

const AUCUNE_ERREUR: ErreursChamps = {}

/**
 * Mandat affiché = proposition automatique (seul mandat de la copropriété, à la déclaration ou après un changement de
 * copropriété), différente du mandat enregistré. « Détails » rouvre la fiche avec SON mandat (aucun s'il n'en a pas) :
 * rien n'y est proposé tant que la copropriété ne change pas.
 */
const estMandatPropose = (ligne: LigneSinistre | null, choix: ChoixSinistre, valeurs: ValeursFicheSinistre): boolean =>
  valeurs.mandatId !== '' &&
  valeurs.mandatId !== (ligne?.mandatId ?? '') &&
  valeurs.mandatId === seulMandat(choix, valeurs.coproprieteId)

/** Blocs ouverts après un clic sur « Compléter » / « Replier » du bloc `id`. */
function basculerBloc(ouverts: ReadonlySet<IdBloc>, id: IdBloc): ReadonlySet<IdBloc> {
  const suivants = new Set(ouverts)
  if (!suivants.delete(id)) suivants.add(id)
  return suivants
}

/** Focus ramené sur le résumé des erreurs à chaque enregistrement refusé (focus() l'amène aussi à l'écran). */
function useFocusSurRefus() {
  const refResume = useRef<HTMLDivElement>(null)
  const [refus, setRefus] = useState(0)
  useEffect(() => {
    if (refus > 0) refResume.current?.focus()
  }, [refus])
  return { refResume, signalerRefus: () => setRefus((nombre) => nombre + 1) }
}

/**
 * Résumé des erreurs bloquantes : focalisable (tabIndex -1), il reçoit le focus à chaque refus ; ses changements
 * pendant la correction sont annoncés poliment (les erreurs des champs, elles, sont annoncées par Field).
 */
function ResumeErreurs({ erreurs, refResume }: { erreurs: readonly string[]; refResume: RefObject<HTMLDivElement | null> }) {
  if (erreurs.length === 0) return null
  return (
    <div ref={refResume} tabIndex={-1} role="group" aria-label="Erreurs de la fiche" aria-live="polite">
      <Alert kind="rust" title="La fiche ne peut pas être enregistrée :">
        {erreurs.join(' ')}
      </Alert>
    </div>
  )
}

/** Points d'attention (anomalies non bloquantes), annoncés poliment. */
function PointsAttention({ alertes }: { alertes: readonly string[] }) {
  return (
    <div aria-live="polite">
      {alertes.length > 0 && (
        <Alert kind="" title="Points d’attention (enregistrement possible) :">
          {alertes.join(' ')}
        </Alert>
      )}
    </div>
  )
}

export function FicheSinistreModal(props: FicheSinistreModalProps) {
  const { ligne, choix, numerosExistants, aujourdhui, onClose, onEnregistrer } = props
  const [valeurs, setValeurs] = useState<ValeursFicheSinistre>(() => valeursInitiales(props))
  const [ouverts, setOuverts] = useState<ReadonlySet<IdBloc>>(
    () => new Set(BLOCS_FICHE_SINISTRE.filter((bloc) => ligne || bloc.essentiel).map((bloc) => bloc.id)),
  )
  const [tentative, setTentative] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [annonce, setAnnonce] = useState('')
  const { refResume, signalerRefus } = useFocusSurRefus()
  const evaluation = evaluerFicheSinistre(valeurs, {
    aujourdhui,
    numerosExistants,
    contratChoisi: contratDe(choix, valeurs),
    refsCopropriete: refsDeLaCopro(choix, valeurs.coproprieteId),
  })

  const changer: ChangerValeur = (cle, valeur) => setValeurs((precedentes) => ({ ...precedentes, [cle]: valeur }))
  const basculer = (id: IdBloc) => setOuverts((precedents) => basculerBloc(precedents, id))
  // Le numéro d'une fiche existante n'est jamais reproposé.
  const numeroPropose = (coproprieteId: string) =>
    ligne ? null : proposerNumeroSinistre(codeDe(choix, coproprieteId), numerosExistants)
  // Ce qui avait été repris du contrat précédent (compagnie, police) suit le contrat : remplacé ou effacé.
  const changerCopro = (coproprieteId: string) =>
    setValeurs((precedentes) =>
      valeursAvecCopro(precedentes, coproprieteId, {
        mandatId: seulMandat(choix, coproprieteId),
        numeroPropose,
        contratPrecedent: contratDe(choix, precedentes),
      }),
    )
  const choisirContrat = (contrat: OptionContratSinistre | null) =>
    setValeurs((precedentes) => valeursAvecContrat(precedentes, contrat, contratDe(choix, precedentes)))

  const enregistrer = async () => {
    setTentative(true)
    if (enCours) return
    if (!evaluation.saisie) {
      signalerRefus()
      return
    }
    setEnCours(true)
    setAnnonce('Enregistrement en cours…')
    const ferme = await onEnregistrer(evaluation.saisie, valeurs.statut)
    if (ferme) return
    setEnCours(false)
    setAnnonce('La fiche n’a pas été enregistrée.')
  }

  const base = { valeurs, changer, erreurs: tentative ? evaluation.erreursChamps : AUCUNE_ERREUR }
  // Éléments seulement décrits ici : BlocFiche ne monte que le contenu des blocs ouverts.
  const contenus: Record<IdBloc, ReactNode> = {
    enTete: <BlocEnTete {...base} />,
    rattachement: (
      <BlocRattachement
        {...base}
        choix={choix}
        changerCopro={changerCopro}
        mandatPropose={estMandatPropose(ligne, choix, valeurs)}
      />
    ),
    assurance: <BlocAssurance {...base} choix={choix} choisirContrat={choisirContrat} />,
    qualification: <BlocQualification {...base} />,
    indemnites: <BlocIndemnites {...base} />,
    // Remonté à chaque changement de copropriété : la partie proposée suit la copropriété de la fiche.
    parties: <BlocParties key={valeurs.coproprieteId} {...base} choix={choix} annoncer={setAnnonce} />,
    suivi: <BlocSuivi {...base} annoncer={setAnnonce} />,
    notes: <BlocNotes {...base} />,
    equipe: <BlocEquipe {...base} choix={choix} />,
  }

  const titre = ligne ? `Sinistre ${ligne.numero ?? 'sans numéro'} — ${ligne.type}` : 'Déclarer un sinistre'
  return (
    <Modal open onClose={onClose} size="lg" labelledBy="fiche-sinistre-titre">
      <ModalHeader id="fiche-sinistre-titre" icon="shield" title={titre} onClose={onClose} />
      <ModalBody>
        {tentative && <ResumeErreurs erreurs={evaluation.bloquants} refResume={refResume} />}
        <GrilleFiche>
          {BLOCS_FICHE_SINISTRE.map((bloc) => (
            <BlocFiche
              key={bloc.id}
              titre={bloc.titre}
              icone={bloc.icone}
              ouvert={ouverts.has(bloc.id)}
              onBasculer={() => basculer(bloc.id)}
            >
              {contenus[bloc.id]}
            </BlocFiche>
          ))}
        </GrilleFiche>
        <div style={{ marginTop: 14 }}>
          <PointsAttention alertes={evaluation.alertes} />
        </div>
        <p className="sr-only" aria-live="polite">
          {annonce}
        </p>
      </ModalBody>
      <ModalFooter>
        <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <CaseModifiable
            libelle="Web : fiche publiée sur l’extranet"
            cochee={valeurs.publieExtranet}
            onChange={(cochee) => changer('publieExtranet', cochee)}
          />
          <span className="muted" style={{ fontSize: 11.5 }}>
            🔵 w-oui / w-non de Gestéam
          </span>
        </span>
        <button type="button" className="btn ghost" onClick={onClose}>
          Annuler
        </button>
        <button type="button" className="btn gold" onClick={() => void enregistrer()} disabled={enCours}>
          <Icon name="check" />
          Enregistrer
        </button>
      </ModalFooter>
    </Modal>
  )
}
