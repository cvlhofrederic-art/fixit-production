import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import {
  OrgRoleProvider,
  useOrgRoleContext,
  type OrgRole,
  type OrgRoleContextValue,
} from '@/lib/hooks/useOrgRoleContext'

function wrap(orgRole: OrgRole, overrides?: Partial<OrgRoleContextValue>) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <OrgRoleProvider orgRole={orgRole} overrides={overrides}>
      {children}
    </OrgRoleProvider>
  )
  Wrapper.displayName = 'TestOrgRoleWrapper'
  return Wrapper
}

describe('useOrgRoleContext', () => {
  it('derives flags for artisan', () => {
    const { result } = renderHook(() => useOrgRoleContext(), { wrapper: wrap('artisan') })
    expect(result.current).toEqual({
      orgRole: 'artisan',
      isArtisan: true,
      isBtp: false,
      isPro: false,
      isV5: true,
      isConcierge: false,
      isGestionnaire: false,
      useBtpDesign: false,
    })
  })

  it('derives flags for pro_societe (BTP)', () => {
    const { result } = renderHook(() => useOrgRoleContext(), { wrapper: wrap('pro_societe') })
    expect(result.current.isBtp).toBe(true)
    expect(result.current.useBtpDesign).toBe(true)
    expect(result.current.isV5).toBe(true)
    expect(result.current.isPro).toBe(true)
    expect(result.current.isArtisan).toBe(false)
  })

  it('derives flags for pro_conciergerie', () => {
    const { result } = renderHook(() => useOrgRoleContext(), { wrapper: wrap('pro_conciergerie') })
    expect(result.current.isConcierge).toBe(true)
    expect(result.current.isPro).toBe(true)
    expect(result.current.isV5).toBe(false)
    expect(result.current.isBtp).toBe(false)
    expect(result.current.useBtpDesign).toBe(false)
  })

  it('derives flags for pro_gestionnaire', () => {
    const { result } = renderHook(() => useOrgRoleContext(), { wrapper: wrap('pro_gestionnaire') })
    expect(result.current.isGestionnaire).toBe(true)
    expect(result.current.isPro).toBe(true)
    expect(result.current.isV5).toBe(false)
    expect(result.current.isBtp).toBe(false)
  })

  it('applies overrides on top of derived flags', () => {
    const { result } = renderHook(() => useOrgRoleContext(), {
      wrapper: wrap('artisan', { useBtpDesign: true }),
    })
    expect(result.current.isArtisan).toBe(true)
    expect(result.current.useBtpDesign).toBe(true)
  })

  it('throws when used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useOrgRoleContext())).toThrow(
      'useOrgRoleContext must be used within OrgRoleProvider'
    )
    spy.mockRestore()
  })
})
