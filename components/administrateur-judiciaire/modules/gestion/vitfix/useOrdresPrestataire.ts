'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  DemandeEnvoiOrdre,
  OrdrePrestataire,
  PrestataireVitfix,
} from '@/lib/administrateur-judiciaire/ordres-prestataire'
import {
  envoyerOrdrePrestataire,
  lireOrdresPrestataire,
  repondreOrdrePrestataire,
  type ResultatEnvoiOrdre,
} from '@/components/administrateur-judiciaire/modules/gestion/vitfix/api'

/** Rafraîchissement automatique du suivi (comme le Canal de communication du Syndic v54). */
export const INTERVALLE_SUIVI_PRESTATAIRE_MS = 15_000

/** Écart minimal entre deux rechargements déclenchés par le retour sur la page (focus + visibilitychange). */
const ECART_RETOUR_MS = 1_000

/**
 * Appelle `charger` au montage, puis toutes les `intervalleMs` tant que la page est visible, et dès que la page
 * redevient visible ou reprend le focus (un seul appel si les deux arrivent ensemble). Rien quand l'onglet est masqué.
 */
export function usePollingVisible(charger: () => void, intervalleMs: number = INTERVALLE_SUIVI_PRESTATAIRE_MS): void {
  const ref = useRef(charger)
  useEffect(() => {
    ref.current = charger
  })

  useEffect(() => {
    let dernier = 0
    const lancer = () => {
      dernier = Date.now()
      ref.current()
    }
    const tick = () => {
      if (document.visibilityState !== 'hidden') lancer()
    }
    const retour = () => {
      if (document.visibilityState !== 'hidden' && Date.now() - dernier >= ECART_RETOUR_MS) lancer()
    }
    lancer()
    const id = setInterval(tick, intervalleMs)
    document.addEventListener('visibilitychange', retour)
    window.addEventListener('focus', retour)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', retour)
      window.removeEventListener('focus', retour)
    }
  }, [intervalleMs])
}

export interface SuiviOrdresPrestataire {
  prestataires: PrestataireVitfix[]
  ordres: OrdrePrestataire[]
  /** Première lecture terminée (avec ou sans succès). */
  charge: boolean
  chargement: boolean
  /** Dernier échec de lecture (affiché dans l'écran, jamais en toast), null après une lecture réussie. */
  erreur: unknown
  /** Heure de la dernière lecture réussie. */
  misAJourLe: Date | null
  rafraichir: () => Promise<void>
  envoyer: (demande: DemandeEnvoiOrdre) => Promise<ResultatEnvoiOrdre>
  repondre: (missionId: string, contenu: string) => Promise<void>
}

/**
 * Ordres de service envoyés aux prestataires Vitfix du cabinet : lecture au montage puis toutes les 15 s tant que
 * la page est visible, et après chaque envoi ou réponse. Une lecture demandée pendant une autre est relancée à la
 * fin de celle-ci (jamais deux appels simultanés, jamais d'état périmé après un envoi).
 */
export function useOrdresPrestataire(): SuiviOrdresPrestataire {
  const [prestataires, setPrestataires] = useState<PrestataireVitfix[]>([])
  const [ordres, setOrdres] = useState<OrdrePrestataire[]>([])
  const [charge, setCharge] = useState(false)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const [misAJourLe, setMisAJourLe] = useState<Date | null>(null)
  const monte = useRef(true)
  const enCours = useRef<Promise<void> | null>(null)
  const relancer = useRef(false)

  useEffect(() => {
    monte.current = true
    return () => {
      monte.current = false
    }
  }, [])

  const rafraichir = useCallback((): Promise<void> => {
    if (enCours.current) {
      relancer.current = true
      return enCours.current
    }
    const executer = async () => {
      setChargement(true)
      try {
        do {
          relancer.current = false
          try {
            const reponse = await lireOrdresPrestataire()
            if (!monte.current) return
            setPrestataires(reponse.prestataires)
            setOrdres(reponse.ordres)
            setErreur(null)
            setMisAJourLe(new Date())
          } catch (echec) {
            if (monte.current) setErreur(echec)
          }
        } while (relancer.current && monte.current)
      } finally {
        enCours.current = null
        if (monte.current) {
          setChargement(false)
          setCharge(true)
        }
      }
    }
    enCours.current = executer()
    return enCours.current
  }, [])

  usePollingVisible(() => {
    void rafraichir()
  })

  const envoyer = useCallback(
    async (demande: DemandeEnvoiOrdre) => {
      const resultat = await envoyerOrdrePrestataire(demande)
      await rafraichir()
      return resultat
    },
    [rafraichir],
  )

  const repondre = useCallback(
    async (missionId: string, contenu: string) => {
      await repondreOrdrePrestataire(missionId, contenu)
      await rafraichir()
    },
    [rafraichir],
  )

  return { prestataires, ordres, charge, chargement, erreur, misAJourLe, rafraichir, envoyer, repondre }
}
