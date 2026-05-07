import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (k: string, fallback?: string) => fallback ?? k }),
  useLocale: () => 'fr',
}))

const useBTPDataMock = vi.fn()
vi.mock('@/lib/hooks/use-btp-data', () => ({
  useBTPData: () => useBTPDataMock(),
}))

vi.mock('../useThemeVars', () => ({
  useThemeVars: () => ({
    textMid: '#666',
    bg: '#fff',
    accent: '#000',
  }),
}))

vi.mock('@/components/dashboard/btp/ChantierSelect', () => ({
  ChantierSelect: () => null,
}))

import { RetenuesGarantieSection } from '@/components/dashboard/btp/RetenuesGarantieSection'

describe('RetenuesGarantieSection', () => {
  it('renders the empty state when there are no retenues', () => {
    useBTPDataMock.mockReturnValue({ items: [], loading: false, add: vi.fn(), update: vi.fn() })
    render(<RetenuesGarantieSection userId="u1" orgRole="artisan" />)
    expect(screen.getByText(/proDash\.btp\.retenues\.title/i)).toBeInTheDocument()
  })

  it('shows the loading hint when loading=true', () => {
    useBTPDataMock.mockReturnValue({ items: [], loading: true, add: vi.fn(), update: vi.fn() })
    render(<RetenuesGarantieSection userId="u1" orgRole="pro_societe" />)
    expect(screen.getByText(/Chargement\.\.\./)).toBeInTheDocument()
  })

  it('renders KPI totals derived from items', () => {
    useBTPDataMock.mockReturnValue({
      items: [
        { id: '1', chantier: 'A', client: 'C', montantMarche: 100_000, tauxRetenue: 5, montantRetenu: 5_000, dateFinTravaux: '2025-01-01', statut: 'active', caution: false },
        { id: '2', chantier: 'B', client: 'D', montantMarche: 200_000, tauxRetenue: 5, montantRetenu: 10_000, dateFinTravaux: '2025-06-01', statut: 'libérée', caution: false },
      ],
      loading: false,
      add: vi.fn(),
      update: vi.fn(),
    })
    render(<RetenuesGarantieSection userId="u1" orgRole="artisan" />)
    // 5 000 € retenu + 10 000 € libéré — multiple elements may carry the
    // formatted number across KPI cards and table rows; assert "≥ 1".
    const matches = screen.getAllByText(/5\s?000/)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('opens the form modal when "nouvelle retenue" is clicked', () => {
    useBTPDataMock.mockReturnValue({ items: [], loading: false, add: vi.fn(), update: vi.fn() })
    render(<RetenuesGarantieSection userId="u1" orgRole="artisan" />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    // After click, the form input fields should be in the DOM (number inputs).
    expect(document.querySelectorAll('input').length).toBeGreaterThan(0)
  })
})
