import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'

vi.mock('@/lib/i18n/context', () => ({
  useLocale: () => 'fr',
}))
vi.mock('@/components/syndic-dashboard/agents-ia/AlfredoInboxView', () => ({
  default: () => <div data-testid="inbox-view">inbox-stub</div>,
}))
vi.mock('@/components/syndic-dashboard/agents-ia/AgentChatPage', () => ({
  default: () => <div data-testid="chat-stub">chat-stub</div>,
}))

import AlfredoAgentPage from '@/components/syndic-dashboard/agents-ia/pages/AlfredoAgentPage'

describe('AlfredoAgentPage (Lot 5)', () => {
  const user = { id: 'u1' } as unknown as User

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('rend EmptyState quand connected=false', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ connected: false, email_compte: null, drafts_pending: 0, emails_analysed: 0 }),
    }) as unknown as typeof fetch

    render(<AlfredoAgentPage user={user} />)
    await waitFor(() => expect(screen.getByText(/Bonjour, je suis Alfredo/i)).toBeDefined())
    expect(screen.queryByTestId('inbox-view')).toBeNull()
  })

  it('rend LoadedView quand connected=true', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ connected: true, email_compte: 'a@b.fr', drafts_pending: 2, emails_analysed: 10 }),
    }) as unknown as typeof fetch

    render(<AlfredoAgentPage user={user} />)
    await waitFor(() => expect(screen.getByTestId('inbox-view')).toBeDefined())
    expect(screen.queryByText(/Bonjour, je suis Alfredo/i)).toBeNull()
  })
})
