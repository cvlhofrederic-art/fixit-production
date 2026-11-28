'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { arreteDejaCloture, listerArretes } from '@/lib/administrateur-judiciaire/db/rapprochements'
import type { ArreteAbandonne, ArreteRapprochement } from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'

/**
 * Lecture des arrêtés de rapprochement d'un compte bancaire (db/rapprochements.ts), sur le modèle de
 * useComptesBancaires : la table n'est pas chargée par le store (sa forme est figée par l'oracle de la base locale), elle
 * est lue ici à l'affichage, puis relue après chaque écriture de l'écran (`relire`). Un échec de lecture est remonté par
 * `erreur` et signalé à `signalerErreur`.
 * Période arrêtée protégée (décision du 26/11/2026, PR 799, rb-04 A) : le panneau « Importer un relevé » lit lui aussi
 * les arrêtés du compte du relevé. `relire` fait donc relire tous les lecteurs montés : une clôture ou une déclôture
 * faite dans le panneau « Rapprochement » est connue de l'import sans nouvelle analyse. Un échec de lecture toucherait
 * alors tous les lecteurs à la fois : un seul le signale à l'utilisateur, celui du panneau « Rapprochement » ; les
 * autres passent `signalerErreur` à null et gardent l'échec dans `erreur` (retour de relecture de la suite rb-04).
 * Réponse du référent métier du 28/11/2026 (corrections de la PR 799, cr-01 A) : les arrêtés abandonnés sont remontés à
 * part (`abandonnes`), pour être affichés dans « Arrêtés du compte » et rien d'autre. La lecture dit aussi si l'arrêté en
 * cours a déjà été clôturé une fois (`enCoursDejaCloture`, journal d'activité), pour la confirmation de l'abandon : les
 * arrêtés sont remontés d'abord, comme avant, ce passé juste après, sans retarder leur affichage.
 */

/** Lecteurs montés, à relancer ensemble (voir l'en-tête). */
const lecteurs = new Set<() => void>()

export interface ArretesLusEcran {
  /** Vrai tant que les arrêtés du compte n'ont pas été lus. */
  chargement: boolean
  erreur: string | null
  /** Arrêtés lisibles du compte qui comptent (en cours, clôturés), par date : les seuls reçus par les règles et les calculs. */
  arretes: ArreteRapprochement[]
  /**
   * Arrêtés abandonnés lisibles du compte, par date (décision du 26/11/2026, PR 799, rb-01 A) : à afficher seulement
   * (« Arrêtés du compte », statut « Abandonné »), jamais dans un calcul.
   */
  abandonnes: ArreteAbandonne[]
  /** Vrai si l'arrêté en cours du compte a déjà été clôturé une fois, puis déclôturé ; faux sans arrêté en cours. */
  enCoursDejaCloture: boolean
  /** Lignes du compte sans la forme d'un arrêté. */
  illisibles: number
  /** Relit les arrêtés, ici et dans les autres lecteurs montés de l'écran. */
  relire: () => void
}

interface Lecture {
  banqueId: string | null
  arretes: ArreteRapprochement[]
  abandonnes: ArreteAbandonne[]
  /** Identifiant de l'arrêté en cours quand il a déjà été clôturé une fois ; null : aucun, jamais clôturé, ou pas encore lu. */
  dejaClotureId: string | null
  illisibles: number
  erreur: string | null
}

export function useArretesRapprochement(banqueId: string | null, signalerErreur: ((message: string) => void) | null): ArretesLusEcran {
  const [version, setVersion] = useState(0)
  const [lecture, setLecture] = useState<Lecture | null>(null)
  // Dernière fonction reçue : la signaler ne relance pas la lecture (une nouvelle fonction à chaque rendu).
  const refSignaler = useRef(signalerErreur)
  useEffect(() => {
    refSignaler.current = signalerErreur
  })

  useEffect(() => {
    let abandonnee = false
    const lire = async () => {
      const lus = banqueId ? await listerArretes(banqueId) : { arretes: [], abandonnes: [], illisibles: 0 }
      if (abandonnee) return
      const enCours = lus.arretes.find((arrete) => arrete.statut === 'En cours')
      // Arrêtés remontés tout de suite. Un arrêté déjà clôturé une fois le reste : ce qui a été lu de l'arrêté en cours
      // à la lecture précédente du même compte est gardé, le journal d'activité est relu juste après.
      setLecture((precedente) => ({
        ...lus,
        banqueId,
        dejaClotureId: enCours && precedente?.banqueId === banqueId && precedente.dejaClotureId === enCours.id ? enCours.id : null,
        erreur: null,
      }))
      if (!enCours || !(await arreteDejaCloture(enCours.id)) || abandonnee) return
      setLecture((precedente) => precedente && { ...precedente, dejaClotureId: enCours.id })
    }
    lire().catch((erreur: unknown) => {
      if (abandonnee) return
      const message = erreur instanceof Error ? erreur.message : String(erreur)
      setLecture({ banqueId, arretes: [], abandonnes: [], dejaClotureId: null, illisibles: 0, erreur: message })
      // null : lecteur secondaire, l'échec est déjà signalé par le panneau « Rapprochement » (voir l'en-tête).
      refSignaler.current?.(message)
    })
    return () => {
      abandonnee = true
    }
  }, [banqueId, version])

  useEffect(() => {
    const relancer = () => setVersion((precedente) => precedente + 1)
    lecteurs.add(relancer)
    return () => {
      lecteurs.delete(relancer)
    }
  }, [])

  const relire = useCallback(() => {
    for (const relancer of lecteurs) relancer()
  }, [])
  // Lecture d'un autre compte (changement en cours) : rien n'est affiché de l'ancien.
  const aJour = lecture !== null && lecture.banqueId === banqueId
  return {
    chargement: !aJour,
    erreur: aJour ? lecture.erreur : null,
    arretes: aJour ? lecture.arretes : [],
    abandonnes: aJour ? lecture.abandonnes : [],
    enCoursDejaCloture: aJour && lecture.dejaClotureId !== null,
    illisibles: aJour ? lecture.illisibles : 0,
    relire,
  }
}
