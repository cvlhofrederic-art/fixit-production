'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { lireReglagesComptesCabinet, listerComptesBancaires } from '@/lib/administrateur-judiciaire/db/comptes-bancaires'
import type { Banque } from '@/lib/administrateur-judiciaire/db/schema'
import type { ReglagesComptesCabinet } from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'

/**
 * Lecture des comptes bancaires d'une copropriété et du réglage du cabinet. Ces tables ne sont pas chargées par le store
 * (sa forme est figée par l'oracle de la base locale) : elles sont lues ici, à l'affichage, puis relues après chaque
 * écriture de l'écran (`relire`). Un échec de lecture est remonté par `erreur` et signalé à `signalerErreur`. Le réglage
 * du cabinet reste null tant qu'il n'a pas été lu : le défaut du domaine n'est jamais présenté comme le réglage enregistré.
 */

export interface ComptesBancairesLus {
  /** Vrai tant que les comptes de cette copropriété n'ont pas été lus. */
  chargement: boolean
  erreur: string | null
  /** Comptes de la copropriété, actifs et clôturés, dans l'ordre de création. */
  comptes: Banque[]
  /** Réglage du cabinet lu dans la base ; null avant la première lecture et quand la lecture échoue. */
  reglagesCabinet: ReglagesComptesCabinet | null
  /** Relit la base (après une écriture). */
  relire: () => void
}

interface Lecture {
  coproprieteId: string | null
  comptes: Banque[]
  reglagesCabinet: ReglagesComptesCabinet | null
  erreur: string | null
}

export function useComptesBancaires(
  coproprieteId: string | null,
  signalerErreur: (message: string) => void,
): ComptesBancairesLus {
  const [version, setVersion] = useState(0)
  const [lecture, setLecture] = useState<Lecture | null>(null)
  // Dernière fonction reçue : la signaler ne relance pas la lecture (une nouvelle fonction à chaque rendu).
  const refSignaler = useRef(signalerErreur)
  useEffect(() => {
    refSignaler.current = signalerErreur
  })

  useEffect(() => {
    let abandonnee = false
    Promise.all([coproprieteId ? listerComptesBancaires(coproprieteId) : Promise.resolve([]), lireReglagesComptesCabinet()]).then(
      ([comptes, reglagesCabinet]) => {
        if (!abandonnee) setLecture({ coproprieteId, comptes, reglagesCabinet, erreur: null })
      },
      (erreur: unknown) => {
        if (abandonnee) return
        const message = erreur instanceof Error ? erreur.message : String(erreur)
        setLecture({ coproprieteId, comptes: [], reglagesCabinet: null, erreur: message })
        refSignaler.current(message)
      },
    )
    return () => {
      abandonnee = true
    }
  }, [coproprieteId, version])

  const relire = useCallback(() => setVersion((precedente) => precedente + 1), [])
  // Lecture d'une autre copropriété (changement en cours) : rien n'est affiché de l'ancienne.
  const aJour = lecture !== null && lecture.coproprieteId === coproprieteId
  return {
    chargement: !aJour,
    erreur: aJour ? lecture.erreur : null,
    comptes: aJour ? lecture.comptes : [],
    // Réglage global du cabinet : celui de la lecture précédente reste valable pendant un changement de copropriété.
    reglagesCabinet: lecture?.reglagesCabinet ?? null,
    relire,
  }
}
