import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  type AccessLevel,
  type ProTeamRole,
  getEffectivePermissions,
  getDefaultPermissionsForRole,
  canAccess as _canAccess,
  canWrite as _canWrite,
  isGerantRole,
  ALL_PRO_MODULES,
} from '@/lib/permissions'
import type { Artisan } from '@/lib/types'

interface UsePermissionsReturn {
  permissions: Record<string, AccessLevel>
  proTeamRole: ProTeamRole | null
  isGerant: boolean
  loading: boolean
  canAccess: (moduleId: string) => boolean
  canWrite: (moduleId: string) => boolean
}

/**
 * Hook to resolve effective permissions for the current pro_societe user.
 * - Gérant (owner, no company_id in metadata): all FULL
 * - Sub-account: default permissions for role, merged with overrides from API
 */
export function usePermissions(
  orgRole: string,
  artisan: Artisan | null,
): UsePermissionsReturn {
  const [permissions, setPermissions] = useState<Record<string, AccessLevel>>({})
  const [proTeamRole, setProTeamRole] = useState<ProTeamRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Only applies to pro_societe
    if (orgRole !== 'pro_societe') {
      // Non-pro_societe: give full access to everything
      const full = Object.fromEntries(ALL_PRO_MODULES.map(m => [m, 'FULL' as AccessLevel]))
      setPermissions(full)
      setProTeamRole(null)
      setLoading(false)
      return
    }

    const loadPermissions = async () => {
      try {
        // Check if user has pro_team_role in localStorage (set at login)
        const storedRole = typeof window !== 'undefined'
          ? localStorage.getItem('fixit_pro_team_role')
          : null
        const storedCompanyId = typeof window !== 'undefined'
          ? localStorage.getItem('fixit_pro_company_id')
          : null

        // If no stored role or no company_id → this is the gérant
        if (!storedRole || !storedCompanyId) {
          const full = Object.fromEntries(ALL_PRO_MODULES.map(m => [m, 'FULL' as AccessLevel]))
          setPermissions(full)
          setProTeamRole('GERANT')
          setLoading(false)
          return
        }

        // Sub-account: start with defaults for the role
        const role = storedRole as ProTeamRole
        setProTeamRole(role)
        const defaults = getDefaultPermissionsForRole(role)
        setPermissions(defaults) // Instant UI with defaults

        // Fetch overrides from API
        try {
          const { supabase } = await import('@/lib/supabase')
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) {
            const res = await fetch('/api/pro/team/permissions?self=true', {
              headers: { Authorization: `Bearer ${session.access_token}` },
            })
            if (res.ok) {
              const data = await res.json()
              if (data.overrides?.length > 0) {
                const merged = getEffectivePermissions(role, data.overrides)
                setPermissions(merged)
              }
            }
          }
        } catch {
          // Silently fail — defaults are already applied
        }
      } catch {
        // Fallback: all FULL (fail open for gérant)
        const full = Object.fromEntries(ALL_PRO_MODULES.map(m => [m, 'FULL' as AccessLevel]))
        setPermissions(full)
      } finally {
        setLoading(false)
      }
    }

    loadPermissions()
  }, [orgRole, artisan?.id])

  const isGerant = useMemo(() => isGerantRole(proTeamRole), [proTeamRole])

  const canAccess = useCallback(
    (moduleId: string) => _canAccess(permissions, moduleId),
    [permissions]
  )

  const canWrite = useCallback(
    (moduleId: string) => _canWrite(permissions, moduleId),
    [permissions]
  )

  return { permissions, proTeamRole, isGerant, loading, canAccess, canWrite }
}
