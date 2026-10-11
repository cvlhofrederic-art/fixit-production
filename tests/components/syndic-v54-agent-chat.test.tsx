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
    expect(onAsk).toHaveBeenCalledWith('Olá agente', []) // première question : historique vide
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

/** Envoie une question par le champ de saisie et attend la fin de la réponse. */
async function poser(question: string) {
  fireEvent.change(screen.getByLabelText('Pergunta a Fixy'), { target: { value: question } })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
  await waitFor(() => expect(screen.queryByText('A escrever…')).toBeNull())
}

describe('AgentChatPage — mémoire de conversation', () => {
  it('la deuxième question transmet le fil déjà affiché (user puis assistant)', async () => {
    const onAsk = vi.fn().mockResolvedValueOnce('Primeira resposta').mockResolvedValueOnce('Segunda resposta')
    render(<AgentChatPage name="Fixy" intro="Olá" onAsk={onAsk} />)
    await poser('Primeira pergunta')
    await poser('E depois?')
    expect(onAsk).toHaveBeenNthCalledWith(2, 'E depois?', [
      { role: 'user', content: 'Primeira pergunta' },
      { role: 'assistant', content: 'Primeira resposta' },
    ])
  })

  it('la réponse d\'erreur locale (errorReply) n\'est pas transmise comme historique', async () => {
    const onAsk = vi.fn().mockRejectedValueOnce(new Error('HTTP 500')).mockResolvedValueOnce('Agora sim')
    render(<AgentChatPage name="Fixy" intro="Olá" onAsk={onAsk} />)
    await poser('Pergunta falhada')
    expect(screen.getByText(/ocorreu um erro ao contactar o assistente/)).toBeInTheDocument()
    await poser('Nova tentativa')
    expect(onAsk).toHaveBeenNthCalledWith(2, 'Nova tentativa', [{ role: 'user', content: 'Pergunta falhada' }])
  })
})

describe('AgentChatPage — réponses de l\'agent rendues en Markdown', () => {
  it('bulle assistant : gras et liste rendus, aucun astérisque visible', async () => {
    const onAsk = vi.fn().mockResolvedValue('**Prazo legal** a cumprir :\n- convocar a assembleia\n- enviar a ata')
    const { container } = render(<AgentChatPage name="Fixy" intro="Olá" onAsk={onAsk} />)
    await poser('Quais prazos?')
    const gras = await screen.findByText('Prazo legal')
    expect(gras.tagName).toBe('STRONG')
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['convocar a assembleia', 'enviar a ata'])
    const fil = container.querySelector('[aria-live="polite"]')
    expect(fil?.textContent).not.toContain('*')
    // La bulle garde ses styles ; seul le pre-wrap est retiré (MarkdownIA gère les lignes).
    const bulle = gras.closest('p')?.parentElement as HTMLElement
    expect(bulle.style.maxWidth).toBe('78%')
    expect(bulle.style.alignSelf).toBe('flex-start')
    expect(bulle.style.whiteSpace).toBe('')
  })

  it('bulle utilisateur : texte brut en pre-wrap, Markdown non interprété', async () => {
    const onAsk = vi.fn().mockResolvedValue('ok')
    render(<AgentChatPage name="Fixy" intro="Olá" onAsk={onAsk} />)
    await poser('Texto **literal**')
    const bulle = screen.getByText('Texto **literal**')
    expect(bulle.style.whiteSpace).toBe('pre-wrap')
    expect(bulle.querySelector('strong')).toBeNull()
  })
})
