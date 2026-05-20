import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AlfredoEmptyState } from '@/components/syndic-dashboard/agents-ia/alfredo/AlfredoEmptyState'

describe('AlfredoEmptyState', () => {
  it('affiche mascotte, titre Bonjour, badge non connecté, prompts, CTA quand non connecté', () => {
    render(
      <AlfredoEmptyState
        connected={false}
        draftsPending={0}
        emailsAnalysed={0}
        locale="fr"
        onPickPrompt={() => {}}
        onConnectGmail={() => {}}
      />
    )
    expect(screen.getByRole('img', { name: /alfredo/i })).toBeDefined()
    expect(screen.getByText(/Bonjour, je suis Alfredo/i)).toBeDefined()
    expect(screen.getByText(/Boîte non connectée/i)).toBeDefined()
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(9)
    expect(screen.getByRole('button', { name: /Connecter Gmail/i })).toBeDefined()
  })

  it('appelle onConnectGmail quand le CTA est cliqué', () => {
    const onConnectGmail = vi.fn()
    render(
      <AlfredoEmptyState
        connected={false}
        draftsPending={0}
        emailsAnalysed={0}
        locale="fr"
        onPickPrompt={() => {}}
        onConnectGmail={onConnectGmail}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Connecter Gmail/i }))
    expect(onConnectGmail).toHaveBeenCalledTimes(1)
  })

  it('cache le CTA Connecter Gmail si déjà connecté', () => {
    render(
      <AlfredoEmptyState
        connected={true}
        draftsPending={0}
        emailsAnalysed={42}
        locale="fr"
        onPickPrompt={() => {}}
        onConnectGmail={() => {}}
      />
    )
    expect(screen.queryByRole('button', { name: /Connecter Gmail/i })).toBeNull()
  })

  it('affiche le titre en portugais quand locale=pt', () => {
    render(
      <AlfredoEmptyState
        connected={false}
        draftsPending={0}
        emailsAnalysed={0}
        locale="pt"
        onPickPrompt={() => {}}
        onConnectGmail={() => {}}
      />
    )
    expect(screen.getByText(/Olá, sou o Alfredo/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /Ligar Gmail/i })).toBeDefined()
  })
})
