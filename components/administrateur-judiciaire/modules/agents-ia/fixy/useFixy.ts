'use client'

import { useCallback, useMemo } from 'react'
import { DEMO_ORDRES_DE_SERVICE } from '@/components/administrateur-judiciaire/data/ordres-de-service'
import { naviguerVers } from '@/components/administrateur-judiciaire/shell/navigation'
import { useToast, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesLocales, type DonneesLocales } from '@/lib/administrateur-judiciaire/db/hooks'
import type { Fiche360CoproprieteLocale } from '@/lib/administrateur-judiciaire/db/use-fiches-360'
import { useIndexRecherche } from '@/lib/administrateur-judiciaire/db/use-index-recherche'
import {
  construireFiche360Copropriete,
  construireFiche360Personne,
} from '@/lib/administrateur-judiciaire/domain/fiche-360'
import type { ActionFixy, ActionNaviguerFixy } from '@/lib/administrateur-judiciaire/domain/fixy/agents'
import { analyserCourriel, type AnalyseCourriel } from '@/lib/administrateur-judiciaire/domain/fixy/courriel'
import { comprendreDemandeFixy, type IntentionFixy } from '@/lib/administrateur-judiciaire/domain/fixy/intentions'
import {
  analyserTexteOrdonnance,
  type LectureOrdonnance,
} from '@/lib/administrateur-judiciaire/domain/fixy/lecture-ordonnance'
import {
  repondreDemandeFixy,
  type DonneesFixy,
  type ReponseFixy,
} from '@/lib/administrateur-judiciaire/domain/fixy/reponses'
import { calculerVeilleFixy, type RappelVeille } from '@/lib/administrateur-judiciaire/domain/fixy/veille'
import type { EntreeIndexRecherche } from '@/lib/administrateur-judiciaire/domain/recherche'
import { PIECES_REPRISE, piecesRepriseRecues } from '@/lib/administrateur-judiciaire/domain/reprise'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'

/**
 * Action que Fixy sait exécuter : une action proposée (veille, demande, courriel) ou une simple navigation
 * décrite par son type et ses paramètres (bouton « Ouvrir la fiche 360 » après la création d'un mandat).
 */
export type ActionExecutableFixy = ActionFixy | Pick<ActionNaviguerFixy, 'type' | 'params'>

/** Demande comprise par Fixy et réponse assemblée. */
export interface EchangeFixy {
  intention: IntentionFixy
  reponse: ReponseFixy
}

/** Valeur renvoyée par useFixy (noms de propriétés de la maquette, lus par le Shell et le lanceur). */
export interface Fixy {
  /** Données et actions de la base locale. */
  p: DonneesLocales
  /** Index de la recherche globale. */
  index: EntreeIndexRecherche[]
  /** Données sur lesquelles Fixy répond aux demandes. */
  donnees: DonneesFixy
  /** Rappels de la veille, du plus grave au moins grave (vide pendant le chargement). */
  veille: RappelVeille[]
  /**
   * Exécute une action : navigation (sélection du dossier puis écran ; le cockpit pour un acte) ou étape de
   * recouvrement (écrite dans la base, toast « Fixy a exécuté »). Renvoie false pour un type inconnu.
   */
  executer: (action: ActionExecutableFixy) => Promise<boolean>
  /** Fiche 360 de la copropriété d'un code, null si le code est inconnu. */
  ficheCopro: (code: string) => Fiche360CoproprieteLocale | null
  push: ToastApi['push']
  /** Comprend une demande libre et prépare la réponse. */
  demander: (texte: string) => EchangeFixy
  /** Analyse un courriel reçu (expéditeur, sujet, réponse proposée, note, actions). */
  lireCourriel: (texte: string) => AnalyseCourriel
  /** Lit le texte d'une ordonnance de désignation. */
  lireOrdonnance: (texte: string) => LectureOrdonnance
}

/**
 * Fixy : assemble les données de la base locale, l'index de recherche et le moteur d'échéances pour la veille,
 * les demandes, l'analyse des courriels et la lecture des ordonnances. Rien n'est écrit sans un clic.
 */
export function useFixy(): Fixy {
  const { push } = useToast()
  const donneesLocales = useDonneesLocales()
  const index = useIndexRecherche()
  const { choisirCopro, choisirPersonne } = useSelectionDossier()
  const { loading, copros, lots, coproprietaires, echeances, contrats, sinistres, prestataires, impayes, documents } =
    donneesLocales

  // Mémorisé sur les seules données lues par la fiche 360 : résultat identique au recalcul par rendu de la maquette.
  const ficheCopro = useCallback(
    (code: string): Fiche360CoproprieteLocale | null => {
      const vue = copros.find((copro) => copro.code === code)
      return vue
        ? construireFiche360Copropriete(vue, {
            lots,
            coproprietaires,
            echeances,
            contrats,
            sinistres,
            prestataires,
          })
        : null
    },
    [copros, lots, coproprietaires, echeances, contrats, sinistres, prestataires],
  )

  const donnees: DonneesFixy = {
    reference: AUJOURDHUI_ISO,
    ficheCopro,
    fichePersonne: (coproprietaireId) => {
      const personne = coproprietaires.find((candidat) => candidat.id === coproprietaireId)
      return personne
        ? construireFiche360Personne(personne, {
            lots,
            copros,
            coproprietaires,
          })
        : null
    },
    copros: copros.map((copro) => ({
      code: copro.code,
      nom: copro.nom,
    })),
    ordresDeService: DEMO_ORDRES_DE_SERVICE,
    impayes,
  }

  // Calcul coûteux (une fiche 360 par copropriété) : mémorisé, résultat identique au recalcul par rendu.
  const veille = useMemo(
    () =>
      loading
        ? []
        : calculerVeilleFixy({
            reference: AUJOURDHUI_ISO,
            fiches: copros
              .map((copro) => ficheCopro(copro.code))
              .filter((fiche): fiche is Fiche360CoproprieteLocale => fiche !== null),
            impayes,
            piecesRecues: copros.flatMap((copro) =>
              Array.from(piecesRepriseRecues(documents, copro.id)).map((type) => ({
                coproprieteId: copro.id,
                type,
              })),
            ),
            nbPieces: PIECES_REPRISE.length,
          }),
    [loading, copros, ficheCopro, impayes, documents],
  )

  const executer = async (action: ActionExecutableFixy): Promise<boolean> => {
    if (action.type === 'naviguer' || action.type === 'ouvrirActe') {
      const coproprietaireId = action.type === 'naviguer' ? action.params.coproprietaireId : undefined
      if (action.params.code) choisirCopro(action.params.code)
      if (coproprietaireId) choisirPersonne(coproprietaireId)
      naviguerVers(action.type === 'ouvrirActe' ? 'cockpit' : action.params.route)
      return true
    }
    if (action.type === 'avancerRecouvrement') {
      await donneesLocales.avancerRecouvrement(action.params.coproprietaireId, action.params.etape, AUJOURDHUI_ISO)
      push({
        kind: 'success',
        title: 'Fixy a exécuté',
        desc: action.effet,
      })
      return true
    }
    return false
  }

  return {
    p: donneesLocales,
    index,
    donnees,
    veille,
    executer,
    ficheCopro,
    push,
    demander: (texte) => {
      const intention = comprendreDemandeFixy(texte, index)
      return {
        intention,
        reponse: repondreDemandeFixy(intention, donnees),
      }
    },
    lireCourriel: (texte) => analyserCourriel(texte, index, ficheCopro, AUJOURDHUI_ISO),
    lireOrdonnance: analyserTexteOrdonnance,
  }
}
