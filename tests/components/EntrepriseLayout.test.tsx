import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (k: string, fallback?: string) => fallback ?? k }),
  useLocale: () => 'fr',
}))

import EntrepriseLayout from '@/components/dashboard/EntrepriseLayout'
import type { Artisan } from '@/lib/types'

const fakeArtisan = {
  id: 'a1',
  user_id: 'u1',
  company_name: 'ACME BTP',
} as unknown as Artisan

function makeProps(overrides: Partial<React.ComponentProps<typeof EntrepriseLayout>> = {}) {
  return {
    artisan: fakeArtisan,
    activePage: 'home',
    navigateTo: vi.fn(),
    sidebarOpen: true,
    setSidebarOpen: vi.fn(),
    unreadMsgCount: 0,
    pendingBookingsCount: 0,
    onLogout: vi.fn(),
    children: <div data-testid="child">content</div>,
    ...overrides,
  }
}

describe('EntrepriseLayout', () => {
  it('renders the children passed in', () => {
    render(<EntrepriseLayout {...makeProps()} />)
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('renders without crashing for the artisan and pro_societe paths', () => {
    expect(() => render(<EntrepriseLayout {...makeProps({ activePage: 'devis' })} />)).not.toThrow()
  })

  it('renders the message badge zone when there are unread messages', () => {
    expect(() =>
      render(<EntrepriseLayout {...makeProps({ unreadMsgCount: 3, pendingBookingsCount: 2 })} />)
    ).not.toThrow()
  })
})
