'use client'

import { createContext, useContext } from 'react'
import type { RoleCabinet } from '@/lib/administrateur-judiciaire/domain/roles-cabinet'

/**
 * Rôle du collaborateur dans le cabinet (« Direction » par défaut). Le Shell le fournit autour de la zone de contenu ;
 * il est choisi dans le sélecteur « Rôle dans le cabinet » de la barre du haut et conservé dans localStorage.
 */
export const RoleCabinetContext = createContext<RoleCabinet>('Direction')

/** Rôle courant du cabinet. */
export const useRoleCabinet = (): RoleCabinet => useContext(RoleCabinetContext)

/** Pictogramme de chaque rôle (pastille de rôle du cockpit). */
export const ICONES_ROLES_CABINET: Record<RoleCabinet, string> = {
  Direction: 'crown',
  Secrétariat: 'mail',
  Gestion: 'wrench',
  Comptabilité: 'chart',
  Juridique: 'scale',
}
