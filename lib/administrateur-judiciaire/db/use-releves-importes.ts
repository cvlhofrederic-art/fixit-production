'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { listerRelevesImportes } from '@/lib/administrateur-judiciaire/db/releves-importes'
import type { ReleveImporteEnregistre } from '@/lib/administrateur-judiciaire/db/schema'

/**
 * Lecture des relevés importés gardés d'une copropriété (db/releves-importes.ts), sur le modèle de
 * useArretesRapprochement : la table n'est pas chargée par le store (sa forme est figée par l'oracle de la base locale),
 * elle est lue ici à l'affichage, puis relue après chaque import de l'écran (`relire`). Un échec de lecture est remonté
 * par `erreur` et signalé à `signalerErreur` ; les relevés sont alors vides : l'analyse ne reconnaît plus un relevé déjà
 * importé, mais l'écriture le refuse toujours (contrôle dans la transaction de l'import).
 */

export interface RelevesImportesLus {
  /** Vrai tant que les relevés de la copropriété n'ont pas été lus. */
  chargement: boolean
  erreur: string | null
  /** Relevés gardés de la copropriété (tous ses comptes bancaires), dans l'ordre de leur enregistrement. */
  releves: ReleveImporteEnregistre[]
  relire: () => void
}

interface Lecture {
  coproprieteId: string | null
  releves: ReleveImporteEnregistre[]
  erreur: string | null
}

export function useRelevesImportes(coproprieteId: string | null, signalerErreur: (message: string) => void): RelevesImportesLus {
  const [version, setVersion] = useState(0)
  const [lecture, setLecture] = useState<Lecture | null>(null)
  // Dernière fonction reçue : la signaler ne relance pas la lecture (une nouvelle fonction à chaque rendu).
  const refSignaler = useRef(signalerErreur)
  useEffect(() => {
    refSignaler.current = signalerErreur
  })

  useEffect(() => {
    let abandonnee = false
    const lire = coproprieteId ? listerRelevesImportes(coproprieteId) : Promise.resolve([])
    lire.then(
      (releves) => {
        if (!abandonnee) setLecture({ coproprieteId, releves, erreur: null })
      },
      (erreur: unknown) => {
        if (abandonnee) return
        const message = erreur instanceof Error ? erreur.message : String(erreur)
        setLecture({ coproprieteId, releves: [], erreur: message })
        refSignaler.current(message)
      },
    )
    return () => {
      abandonnee = true
    }
  }, [coproprieteId, version])

  const relire = useCallback(() => setVersion((precedente) => precedente + 1), [])
  // Lecture d'une autre copropriété (changement en cours) : rien n'est gardé de l'ancienne.
  const aJour = lecture !== null && lecture.coproprieteId === coproprieteId
  return {
    chargement: !aJour,
    erreur: aJour ? lecture.erreur : null,
    releves: aJour ? lecture.releves : [],
    relire,
  }
}
