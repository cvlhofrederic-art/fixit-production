import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render } from '@testing-library/react'
import MessageList from '@/components/syndic-dashboard/agents-ia/MessageList'
import type { Message } from '@/lib/syndic/agent-types'

// jsdom n'implémente pas Element.scrollTo (défilement automatique de la liste).
beforeAll(() => {
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo
})

function message(content: string, role: Message['role'] = 'assistant'): Message {
  return { id: `m-${role}`, conversation_id: 'c1', role, content, tool_calls: null, metadata: null, created_at: '2026-10-28T10:00:00Z' }
}

const HOSTILE = 'Bonjour <img src=x onerror="alert(1)"> <script>alert(2)</script> <a href="javascript:alert(3)">lien</a> **gras**'

describe('MessageList : HTML hostile dans une réponse IA ou un message utilisateur', () => {
  it('rend le message en texte, sans script, image, lien ni gestionnaire d’événement', () => {
    const { container } = render(
      <MessageList messages={[message(HOSTILE)]} agentAvatarEmoji="🤖" agentAccentColor="#000" locale="fr" />,
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('[onerror], [onclick], [href^="javascript"]')).toBeNull()
    // Le Markdown légitime reste rendu, le HTML hostile est affiché tel quel (échappé).
    expect(container.querySelector('strong')?.textContent).toBe('gras')
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">')
  })

  it('traite de la même façon la réponse en cours de diffusion (streamingPartial)', () => {
    const { container } = render(
      <MessageList messages={[message('Question', 'user')]} streamingPartial={HOSTILE} agentAvatarEmoji="🤖" agentAccentColor="#000" locale="fr" />,
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[onerror], [onclick], [href^="javascript"]')).toBeNull()
    expect(container.textContent).toContain('<script>alert(2)</script>')
  })
})
