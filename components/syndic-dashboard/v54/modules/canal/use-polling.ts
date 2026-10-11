'use client'

import { useEffect, useRef } from 'react'

/** Intervalle de rafraîchissement automatique du Canal de communication (données réelles). */
export const INTERVALLE_POLLING_CANAL_MS = 15_000

/** Écart minimal entre deux rechargements déclenchés par le retour sur la page (focus + visibilitychange). */
const ECART_RETOUR_MS = 1_000

/**
 * Appelle `charger` au montage, puis toutes les `intervalleMs` tant que la page est visible, et
 * dès que la page redevient visible ou reprend le focus (un seul appel si les deux arrivent ensemble).
 * Rien quand l'onglet du navigateur est masqué.
 */
export function usePolling(charger: () => void, intervalleMs: number = INTERVALLE_POLLING_CANAL_MS): void {
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
