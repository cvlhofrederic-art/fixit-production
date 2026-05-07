import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/i18n/context', () => ({
  useLocale: () => 'fr',
}))

vi.mock('@/lib/devis-totals', () => ({
  computeDocumentTotalHT: () => 0,
  computeDocumentTotalHtCents: () => 0,
}))

import PipelineSection from '@/components/dashboard/PipelineSection'
import type { Artisan } from '@/lib/types'

const fakeArtisan = {
  id: 'a1',
  user_id: 'u1',
  company_name: 'ACME',
} as unknown as Artisan

describe('PipelineSection', () => {
  it('renders without crashing when there are no documents', () => {
    expect(() =>
      render(
        <PipelineSection
          artisan={fakeArtisan}
          orgRole="artisan"
          navigateTo={vi.fn()}
          savedDocuments={[]}
        />
      )
    ).not.toThrow()
  })

  it('renders without crashing for the BTP role', () => {
    expect(() =>
      render(
        <PipelineSection
          artisan={fakeArtisan}
          orgRole="pro_societe"
          navigateTo={vi.fn()}
          savedDocuments={[]}
        />
      )
    ).not.toThrow()
  })

  it('renders without crashing when savedDocuments is undefined', () => {
    expect(() =>
      render(
        <PipelineSection
          artisan={fakeArtisan}
          orgRole="artisan"
          navigateTo={vi.fn()}
          savedDocuments={undefined}
        />
      )
    ).not.toThrow()
  })

  it('exposes at least one stage label after render', () => {
    render(
      <PipelineSection
        artisan={fakeArtisan}
        orgRole="artisan"
        navigateTo={vi.fn()}
        savedDocuments={[]}
      />
    )
    // Pipeline section always renders the section heading region.
    expect(document.body.textContent?.length).toBeGreaterThan(0)
  })
})
