/**
 * Baseline tests for DevisFactureForm.tsx (3 793 lines, 115 hooks).
 *
 * **Scope (Phase 20)** — these tests do NOT validate business logic
 * (totals, acomptes, PDF wiring, etc.). They lock in "the component
 * mounts without throwing in 2 standard configurations" so that the
 * extraction PRs described in docs/refactor-plan.md can compare
 * before/after rendering as a safety net.
 *
 * Adding more semantic tests is a job for the extraction layers, where
 * each pure helper / hook moves out and gets its own dedicated unit
 * test. Don't expand the scope of this file in-place — extract first.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('@/lib/i18n/context', () => ({
  useLocale: () => 'fr',
  useTranslation: () => ({ t: (k: string, fallback?: string) => fallback ?? k }),
}))

vi.mock('@/lib/i18n/config', () => ({
  getLocaleFormats: () => ({
    currency: 'EUR',
    date: 'fr-FR',
    decimal: ',',
    currencyFormat: (v: number) => `${v.toFixed(2)} €`,
    dateFormat: (d: Date | string) => new Date(d).toISOString().split('T')[0],
    numberFormat: (v: number) => v.toFixed(2),
  }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}))

vi.mock('@/lib/document-sync', () => ({
  syncDocumentSafe: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('@/lib/utils', () => ({
  formatPrice: (cents: number) => `${(cents / 100).toFixed(2)} €`,
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/lib/money', () => ({
  mulMoney: (a: number, b: number) => Math.round(a * b * 100) / 100,
  sumMoney: (xs: number[]) => xs.reduce((s, x) => s + x, 0),
  round2: (x: number) => Math.round(x * 100) / 100,
  parseDecimalInput: (s: string) => parseFloat(s) || 0,
  parseDecimalInput4: (s: string) => parseFloat(s) || 0,
  computeAcomptesAmounts: () => ({ amounts: [], remaining: 0 }),
  assertInvoiceInvariant: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
  withScope: (cb: (scope: { setLevel: () => void; setTag: () => void; setExtras: () => void; setUser: () => void }) => void) => cb({ setLevel: vi.fn(), setTag: vi.fn(), setExtras: vi.fn(), setUser: vi.fn() }),
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}))

vi.mock('@/components/common/ReceiptScanner', () => ({
  default: () => null,
}))

vi.mock('@/components/dashboard/btp/RentabiliteDevisModal', () => ({
  default: () => null,
}))

vi.mock('@/lib/pdf/build-v2-input', () => ({
  buildV2Input: vi.fn(),
}))

vi.mock('@/lib/pdf/devis-pdf-v3', () => ({
  generateDevisPdfV3: vi.fn(),
}))

vi.mock('@/lib/devis-utils', () => ({
  resolveLineUnit: (u?: string) => u ?? 'unit',
  getSelectValue: (v: unknown) => String(v ?? ''),
  mapLegalFormToCode: () => '5710',
  getStatusLabel: () => 'SAS',
  getCompanyStatuses: () => [],
  isSocieteStatus: () => true,
  isSmallBusinessStatus: () => false,
}))

vi.mock('next/image', () => ({
  default: () => null,
}))

import DevisFactureForm from '@/components/DevisFactureForm'
import type { ArtisanBasic } from '@/lib/devis-types'

const fakeArtisan: ArtisanBasic = {
  id: 'a1',
  company_name: 'ACME',
  siret: '12345678901234',
  phone: '+33000000000',
  email: 'acme@example.com',
}

describe('DevisFactureForm — baseline render', () => {
  it('mounts without throwing for an empty new-devis form', () => {
    expect(() =>
      render(
        <DevisFactureForm
          artisan={fakeArtisan}
          services={[]}
          bookings={[]}
          initialDocType="devis"
          onBack={vi.fn()}
          onSave={vi.fn()}
        />
      )
    ).not.toThrow()
  })

  it('mounts without throwing for an existing devis (initialData provided)', () => {
    expect(() =>
      render(
        <DevisFactureForm
          artisan={fakeArtisan}
          services={[]}
          bookings={[]}
          initialDocType="devis"
          initialData={{
            docNumber: 'D-2026-0001',
            clientName: 'Client Test',
            clientEmail: 'client@example.com',
          }}
          onBack={vi.fn()}
          onSave={vi.fn()}
        />
      )
    ).not.toThrow()
  })
})
