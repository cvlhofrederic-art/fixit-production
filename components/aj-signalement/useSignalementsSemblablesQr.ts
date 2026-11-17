'use client'

// ── Signalements déjà faits au même endroit, pendant la rédaction ────────────
//
// Dès que le lieu « parties communes », le bâtiment et la zone sont choisis, la page demande au serveur les
// signalements semblables (GET /api/aj-signalement/similaires), après une courte pause de frappe. Seule la réponse
// de la dernière recherche compte : chaque résultat porte la clé de l'endroit cherché, et un résultat d'un autre
// endroit n'est jamais montré. Une erreur donne une liste vide : rien n'est bloqué. Aucun appel pour un logement.

import { useEffect, useState } from 'react'
import { chargerSemblablesQr } from '@/lib/aj-signalement/api'
import { cleZoneQr, normaliserBatimentQr } from '@/lib/aj-signalement/semblables'
import type { LangueSignalementQr, SignalementSemblableQr } from '@/lib/aj-signalement/types'

/** Pause de frappe avant la recherche (bâtiment saisi au clavier). */
export const PAUSE_RECHERCHE_SEMBLABLES_MS = 400

export interface RechercheSemblablesFormulaire {
  jeton: string
  langue: LangueSignalementQr
  communes: boolean
  batiment: string
  zone: string
}

/** Clé de l'endroit cherché ; '' quand il n'y a rien à chercher (logement, bâtiment ou zone manquant). */
export function cleEndroitQr(r: Pick<RechercheSemblablesFormulaire, 'communes' | 'batiment' | 'zone'>): string {
  const batiment = normaliserBatimentQr(r.batiment)
  return r.communes && batiment && r.zone ? `${batiment}|${cleZoneQr(r.zone)}` : ''
}

export function useSignalementsSemblablesQr(r: RechercheSemblablesFormulaire): { cle: string; semblables: SignalementSemblableQr[] } {
  const cle = cleEndroitQr(r)
  const [resultat, setResultat] = useState<{ cle: string; semblables: SignalementSemblableQr[] } | null>(null)
  const { jeton, langue, batiment, zone } = r

  useEffect(() => {
    if (!cle) return undefined
    let actuelle = true
    const minuterie = setTimeout(() => {
      void chargerSemblablesQr({ jeton, batiment: batiment.trim(), zone, langue }).then((reponse) => {
        if (actuelle) setResultat({ cle, semblables: reponse.ok ? reponse.semblables : [] })
      })
    }, PAUSE_RECHERCHE_SEMBLABLES_MS)
    // Chaque frappe relance la pause : une seule recherche une fois la saisie posée. Tant que l'endroit (clé normalisée)
    // ne change pas, le résultat précédent reste affiché.
    return () => {
      actuelle = false
      clearTimeout(minuterie)
    }
  }, [cle, jeton, langue, batiment, zone])

  return { cle, semblables: resultat?.cle === cle && cle ? resultat.semblables : [] }
}
