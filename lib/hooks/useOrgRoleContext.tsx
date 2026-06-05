'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'

export type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

export interface OrgRoleContextValue {
  orgRole: OrgRole
  isArtisan: boolean
  isBtp: boolean
  isPro: boolean
  isV5: boolean
  isConcierge: boolean
  isGestionnaire: boolean
  useBtpDesign: boolean
}

const OrgRoleContext = createContext<OrgRoleContextValue | undefined>(undefined)

export function OrgRoleProvider({
  children,
  orgRole,
  overrides,
}: {
  children: ReactNode
  orgRole: OrgRole
  overrides?: Partial<OrgRoleContextValue>
}) {
  const value = useMemo<OrgRoleContextValue>(() => {
    const isBtp = orgRole === 'pro_societe'
    const isArtisan = orgRole === 'artisan'
    return {
      orgRole,
      isArtisan,
      isBtp,
      isPro:
        orgRole === 'pro_societe' ||
        orgRole === 'pro_conciergerie' ||
        orgRole === 'pro_gestionnaire',
      isV5: isArtisan || isBtp,
      isConcierge: orgRole === 'pro_conciergerie',
      isGestionnaire: orgRole === 'pro_gestionnaire',
      useBtpDesign: isBtp,
      ...overrides,
    }
  }, [orgRole, overrides])

  return <OrgRoleContext.Provider value={value}>{children}</OrgRoleContext.Provider>
}

export function useOrgRoleContext(): OrgRoleContextValue {
  const ctx = useContext(OrgRoleContext)
  if (!ctx) {
    throw new Error('useOrgRoleContext must be used within OrgRoleProvider')
  }
  return ctx
}
