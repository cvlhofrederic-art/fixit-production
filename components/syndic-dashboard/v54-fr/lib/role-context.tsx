'use client'

// Contexte « rôle dans le cabinet » — port du RoleContext du mockup v8.
// Le cockpit (et d'autres modules) filtrent leurs tâches selon le rôle choisi
// dans la topbar. Sans persistance localStorage en v1 (zéro mismatch d'hydratation).

import { createContext, useContext, type ReactNode } from 'react'
import type { IconName } from '@/lib/syndic/icon-names'

export const ROLES = ['Direction', 'Secrétariat', 'Gestion', 'Comptabilité', 'Juridique'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABEL: Record<Role, string> = {
  Direction: 'Direction du cabinet',
  Secrétariat: 'Secrétariat',
  Gestion: 'Gestionnaire',
  Comptabilité: 'Comptabilité',
  Juridique: 'Pôle juridique',
}

export const ROLE_ICON: Record<Role, IconName> = {
  Direction: 'crown',
  Secrétariat: 'mail',
  Gestion: 'wrench',
  Comptabilité: 'chart',
  Juridique: 'scale',
}

const RoleContext = createContext<Role>('Direction')

export const useRole = (): Role => useContext(RoleContext)

export function RoleProvider({ role, children }: Readonly<{ role: Role; children: ReactNode }>) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>
}
