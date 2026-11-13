'use client'

// ── Cabinets clients et fiches gestionnaires de l'espace AJ Signalement ───────────────────────────────────────────
//
// Chargés une seule fois, à la première vue qui en a besoin (Copropriétés, Gestionnaires, Cabinets, Journal), jamais
// au Tableau de bord ni aux Signalements ; rechargés après une modification. Toutes les fiches (« tous » : la liste
// montre aussi les fiches désactivées). Rien n'est gardé dans le navigateur.

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { chargerCabinetsQr, chargerGestionnairesQr, type CodeErreurQr } from '@/lib/aj-signalement/api'
import { messageErreurTableauQr } from '@/lib/aj-signalement/affichage'
import type { CabinetQr, GestionnaireQr } from '@/lib/aj-signalement/types'

export interface ReferentielsQr {
  /** null : pas encore chargés. */
  cabinets: CabinetQr[] | null
  gestionnaires: GestionnaireQr[] | null
  erreur: CodeErreurQr | null
  /** Tenue une fois cabinets et fiches posés, ou l'échec affiché (encadré, toast si le réseau est coupé) ; jamais rejetée. */
  recharger: () => Promise<void>
}

export function useReferentielsQr(actif: boolean): ReferentielsQr {
  const [cabinets, setCabinets] = useState<CabinetQr[] | null>(null)
  const [gestionnaires, setGestionnaires] = useState<GestionnaireQr[] | null>(null)
  const [erreur, setErreur] = useState<CodeErreurQr | null>(null)
  const demande = useRef(false)

  const recharger = useCallback(async () => {
    const [c, g] = await Promise.all([chargerCabinetsQr(), chargerGestionnairesQr({ etat: 'tous' })])
    if (c.ok) setCabinets(c.cabinets)
    if (g.ok) setGestionnaires(g.gestionnaires)
    const echec = !c.ok ? c.code : !g.ok ? g.code : null
    setErreur(echec)
    if (echec === 'reseau') toast.error(messageErreurTableauQr(echec))
  }, [])

  // Premier chargement à la première vue qui en a besoin : l'état n'est posé qu'à la réponse (asynchrone).
  useEffect(() => {
    if (!actif || demande.current) return
    demande.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recharger()
  }, [actif, recharger])

  return { cabinets, gestionnaires, erreur, recharger }
}
