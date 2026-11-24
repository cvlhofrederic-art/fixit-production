'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { lireDonneesAppels, type DonneesAppelsLues } from '@/lib/administrateur-judiciaire/db/appels-de-fonds'

/**
 * Lecture des tables D2 d'un syndicat pour l'écran « Appels de fonds » (db/appels-de-fonds.ts, lireDonneesAppels). Ces
 * tables ne sont pas chargées par le store (sa forme est figée par l'oracle de la base locale) : elles sont lues ici, à
 * l'affichage, puis relues après chaque écriture de l'écran (`relire`), comme les comptes bancaires
 * (use-comptes-bancaires.ts). Un échec de lecture est remonté par `erreur` et signalé à `signalerErreur`.
 */

export interface AppelsDeFondsLus {
  /** Vrai tant que les données de ce syndicat n'ont pas été lues. */
  chargement: boolean
  erreur: string | null
  /** Données du syndicat ; null pendant le chargement, en erreur ou sans syndicat. */
  donnees: DonneesAppelsLues | null
  /** Relit la base (après une écriture). */
  relire: () => void
}

interface Lecture {
  coproprieteId: string | null
  donnees: DonneesAppelsLues | null
  erreur: string | null
}

export function useAppelsDeFonds(coproprieteId: string | null, signalerErreur: (message: string) => void): AppelsDeFondsLus {
  const [version, setVersion] = useState(0)
  const [lecture, setLecture] = useState<Lecture | null>(null)
  // Dernière fonction reçue : la signaler ne relance pas la lecture (une nouvelle fonction à chaque rendu).
  const refSignaler = useRef(signalerErreur)
  useEffect(() => {
    refSignaler.current = signalerErreur
  })

  useEffect(() => {
    let abandonnee = false
    const lire = coproprieteId ? lireDonneesAppels(coproprieteId) : Promise.resolve(null)
    lire.then(
      (donnees) => {
        if (!abandonnee) setLecture({ coproprieteId, donnees, erreur: null })
      },
      (erreur: unknown) => {
        if (abandonnee) return
        const message = erreur instanceof Error ? erreur.message : String(erreur)
        setLecture({ coproprieteId, donnees: null, erreur: message })
        refSignaler.current(message)
      },
    )
    return () => {
      abandonnee = true
    }
  }, [coproprieteId, version])

  const relire = useCallback(() => setVersion((precedente) => precedente + 1), [])
  // Lecture d'un autre syndicat (changement en cours) : rien n'est affiché de l'ancien.
  const aJour = lecture !== null && lecture.coproprieteId === coproprieteId
  return {
    chargement: !aJour,
    erreur: aJour ? lecture.erreur : null,
    donnees: aJour ? lecture.donnees : null,
    relire,
  }
}
