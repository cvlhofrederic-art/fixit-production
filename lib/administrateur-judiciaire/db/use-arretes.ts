'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { listerArretes } from '@/lib/administrateur-judiciaire/db/rapprochements'
import type { ArreteRapprochement } from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'

/**
 * Lecture des arrêtés de rapprochement d'un compte bancaire (db/rapprochements.ts), sur le modèle de
 * useComptesBancaires : la table n'est pas chargée par le store (sa forme est figée par l'oracle de la base locale), elle
 * est lue ici à l'affichage, puis relue après chaque écriture de l'écran (`relire`). Un échec de lecture est remonté par
 * `erreur` et signalé à `signalerErreur`.
 */

export interface ArretesLusEcran {
  /** Vrai tant que les arrêtés du compte n'ont pas été lus. */
  chargement: boolean
  erreur: string | null
  /**
   * Arrêtés lisibles du compte qui comptent (en cours, clôturés), par date. Les arrêtés abandonnés (décision du
   * 26/11/2026, PR 799, rb-01 A) restent en base et ne sont pas remontés à l'écran.
   */
  arretes: ArreteRapprochement[]
  /** Lignes du compte sans la forme d'un arrêté. */
  illisibles: number
  relire: () => void
}

interface Lecture {
  banqueId: string | null
  arretes: ArreteRapprochement[]
  illisibles: number
  erreur: string | null
}

export function useArretesRapprochement(banqueId: string | null, signalerErreur: (message: string) => void): ArretesLusEcran {
  const [version, setVersion] = useState(0)
  const [lecture, setLecture] = useState<Lecture | null>(null)
  // Dernière fonction reçue : la signaler ne relance pas la lecture (une nouvelle fonction à chaque rendu).
  const refSignaler = useRef(signalerErreur)
  useEffect(() => {
    refSignaler.current = signalerErreur
  })

  useEffect(() => {
    let abandonnee = false
    const lire = banqueId ? listerArretes(banqueId) : Promise.resolve({ arretes: [], illisibles: 0 })
    lire.then(
      ({ arretes, illisibles }) => {
        if (!abandonnee) setLecture({ banqueId, arretes, illisibles, erreur: null })
      },
      (erreur: unknown) => {
        if (abandonnee) return
        const message = erreur instanceof Error ? erreur.message : String(erreur)
        setLecture({ banqueId, arretes: [], illisibles: 0, erreur: message })
        refSignaler.current(message)
      },
    )
    return () => {
      abandonnee = true
    }
  }, [banqueId, version])

  const relire = useCallback(() => setVersion((precedente) => precedente + 1), [])
  // Lecture d'un autre compte (changement en cours) : rien n'est affiché de l'ancien.
  const aJour = lecture !== null && lecture.banqueId === banqueId
  return {
    chargement: !aJour,
    erreur: aJour ? lecture.erreur : null,
    arretes: aJour ? lecture.arretes : [],
    illisibles: aJour ? lecture.illisibles : 0,
    relire,
  }
}
