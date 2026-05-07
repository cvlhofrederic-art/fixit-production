/**
 * Baseline tests for ClientsSection.tsx (1 153 lines).
 *
 * Phase 20 scope: assert that the component mounts in two standard
 * configurations without throwing. No semantic assertions.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('@/lib/i18n/context', () => ({
  useLocale: () => 'fr',
  useTranslation: () => ({ t: (k: string, fallback?: string) => fallback ?? k }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    from: () => ({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
    }),
  },
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}))

vi.mock('@/components/dashboard/useThemeVars', () => ({
  useThemeVars: () => ({
    bg: '#fff',
    bgAlt: '#f5f5f5',
    border: '#ddd',
    text: '#000',
    textMid: '#666',
    accent: '#000',
  }),
}))

import ClientsSection from '@/components/dashboard/ClientsSection'
import type { Artisan, Booking, Service } from '@/lib/types'

const fakeArtisan = {
  id: 'a1',
  user_id: 'u1',
  company_name: 'ACME',
} as unknown as Artisan

const fakeBooking = {
  id: 'b1',
  client_name: 'Jean Dupont',
  client_email: 'jean@example.com',
  status: 'completed',
  booking_date: '2026-04-01',
} as unknown as Booking

describe('ClientsSection — baseline render', () => {
  it('mounts without throwing when bookings list is empty', () => {
    expect(() =>
      render(
        <ClientsSection
          artisan={fakeArtisan}
          bookings={[]}
          services={[] as Service[]}
          onNewRdv={vi.fn()}
          onNewDevis={vi.fn()}
          orgRole="artisan"
        />
      )
    ).not.toThrow()
  })

  it('mounts without throwing when bookings list contains entries', () => {
    expect(() =>
      render(
        <ClientsSection
          artisan={fakeArtisan}
          bookings={[fakeBooking]}
          services={[] as Service[]}
          onNewRdv={vi.fn()}
          onNewDevis={vi.fn()}
          orgRole="artisan"
        />
      )
    ).not.toThrow()
  })
})
