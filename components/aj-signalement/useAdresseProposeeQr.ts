'use client'

// ── Adresse proposée d'après la position (copropriété sans adresse) ──────────
//
// Demande de Hugo du 06/11/2026 : quand l'adresse de la copropriété n'est pas renseignée, la page demande la position
// au navigateur, une seule fois par visite, et la fait traduire en adresse par le serveur (POST
// /api/aj-signalement/adresse). Refus, absence de géolocalisation ou échec : rien n'est bloqué, le signalement part
// sans adresse proposée. Quand l'adresse est connue, aucune position n'est demandée.
// Le hook vit dans l'application et non dans le formulaire : « Faire un autre signalement » remonte le formulaire
// sans redemander la position. État initial identique au rendu serveur et au navigateur ; navigator n'est lu que
// dans l'effet ; une réponse arrivée après le démontage est ignorée.

import { useEffect, useRef, useState } from 'react'
import { proposerAdresseQr } from '@/lib/aj-signalement/api'

export type EtatAdresseProposeeQr = 'inutile' | 'attente' | 'recherche' | 'proposee' | 'refusee' | 'echec'

export interface AdresseProposeeEtat {
  etat: EtatAdresseProposeeQr
  /** Libellé de l'adresse proposée ; '' tant qu'il n'y en a pas. */
  adresse: string
}

/** Erreur « permission refusée » de l'API Geolocation (GeolocationPositionError.PERMISSION_DENIED). */
const PERMISSION_REFUSEE = 1

/** Position récente acceptée (5 minutes), délai de réponse du navigateur (15 secondes). */
const OPTIONS_POSITION: PositionOptions = { enableHighAccuracy: true, timeout: 15_000, maximumAge: 300_000 }

type Position = { ok: true; latitude: number; longitude: number } | { ok: false; refusee: boolean }

/** Position du navigateur ; ne rejette jamais (navigateur sans géolocalisation, refus, délai dépassé → ok: false). */
function lirePosition(): Promise<Position> {
  return new Promise((resoudre) => {
    const geolocalisation = typeof navigator === 'undefined' ? undefined : navigator.geolocation
    if (!geolocalisation) {
      resoudre({ ok: false, refusee: false })
      return
    }
    try {
      geolocalisation.getCurrentPosition(
        (p) => resoudre({ ok: true, latitude: p.coords.latitude, longitude: p.coords.longitude }),
        (e) => resoudre({ ok: false, refusee: e.code === PERMISSION_REFUSEE }),
        OPTIONS_POSITION,
      )
    } catch (e) {
      console.warn('[aj-signalement] position indisponible', e)
      resoudre({ ok: false, refusee: false })
    }
  })
}

export function useAdresseProposeeQr(jeton: string, adresseConnue: string): AdresseProposeeEtat {
  const inutile = adresseConnue.trim() !== ''
  const [etat, setEtat] = useState<AdresseProposeeEtat>({ etat: inutile ? 'inutile' : 'attente', adresse: '' })
  // Une seule demande de position par visite, même quand le mode strict de React rejoue l'effet.
  const demandee = useRef(false)
  const monte = useRef(false)

  useEffect(() => {
    monte.current = true
    if (!inutile && !demandee.current) {
      demandee.current = true
      const proposer = async () => {
        const position = await lirePosition()
        if (!monte.current) return
        if (!position.ok) {
          setEtat({ etat: position.refusee ? 'refusee' : 'echec', adresse: '' })
          return
        }
        setEtat({ etat: 'recherche', adresse: '' })
        const resultat = await proposerAdresseQr(jeton, position.latitude, position.longitude)
        if (!monte.current) return
        setEtat(resultat.ok && resultat.adresse ? { etat: 'proposee', adresse: resultat.adresse } : { etat: 'echec', adresse: '' })
      }
      // L'état n'est posé qu'à la réponse du navigateur puis du serveur (asynchrone), pas dans le corps de l'effet.
      void proposer()
    }
    return () => {
      monte.current = false
    }
  }, [inutile, jeton])

  return etat
}
