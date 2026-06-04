import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import AgentChatPage from '@/components/syndic-dashboard/v54/primitives/agent-chat-page/AgentChatPage'

/** Phase 2 — AgentChatPage : vue conversation (onAsk → fil user/assistant). */

afterEach(cleanup)

describe('AgentChatPage — conversation (Phase 2)', () => {
  it('onAsk : envoie le message et affiche question + réponse', async () => {
    const onAsk = vi.fn().mockResolvedValue('Resposta do agente')
    render(<AgentChatPage name="Fixy" intro="Olá" onAsk={onAsk} />)
    fireEvent.change(screen.getByLabelText('Pergunta a Fixy'), { target: { value: 'Olá agente' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(onAsk).toHaveBeenCalledWith('Olá agente')
    expect(screen.getByText('Olá agente')).toBeInTheDocument() // bulle utilisateur
    await waitFor(() => expect(screen.getByText('Resposta do agente')).toBeInTheDocument()) // bulle assistant
    cleanup()
  })

  it('sans onAsk : reste sur l\'écran d\'accueil (preview)', () => {
    render(<AgentChatPage name="Fixy" intro="Bem-vindo Fixy" />)
    expect(screen.getByText('Bem-vindo Fixy')).toBeInTheDocument()
    cleanup()
  })
})
