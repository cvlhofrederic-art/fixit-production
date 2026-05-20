import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'

vi.mock('@/components/syndic-dashboard/agents-ia/AlfredoInboxView', () => ({
  default: () => <div data-testid="inbox-view">inbox-stub</div>,
}))
vi.mock('@/components/syndic-dashboard/agents-ia/AgentChatPage', () => ({
  default: () => <div data-testid="chat-stub">chat-stub</div>,
}))

import { AlfredoLoadedView } from '@/components/syndic-dashboard/agents-ia/alfredo/AlfredoLoadedView'

describe('AlfredoLoadedView', () => {
  const user = { id: 'u1' } as unknown as User

  it('rend le badge de statut, l’inbox et la chat sidebar collapsed', () => {
    render(
      <AlfredoLoadedView
        user={user}
        locale="fr"
        connected={true}
        draftsPending={3}
        emailsAnalysed={42}
      />
    )
    expect(screen.getByTestId('inbox-view')).toBeDefined()
    expect(screen.getByText(/brouillons à valider/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /Discuter avec Alfredo/i })).toBeDefined()
    expect(screen.queryByTestId('chat-stub')).toBeNull()
  })
})
