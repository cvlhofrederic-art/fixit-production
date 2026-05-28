// tests/components/syndic-v54-batch8.test.tsx
//
// Primitive batch 8 : AgentChatPage (page composite agent IA). On teste la
// structure + les interactions (suggestions, saisie, callbacks/toasts, buckets)
// en jsdom ; le rendu visuel + responsive sont en Playwright.

import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { AgentChatPage, type AgentChatPageProps } from '@/components/syndic-dashboard/v54/primitives/agent-chat-page'

afterEach(cleanup)

const base: AgentChatPageProps = { name: 'Max Lavandeira', intro: 'Olá!' }
const renderACP = (props: Partial<AgentChatPageProps> = {}) =>
  render(
    <ToastProvider>
      <AgentChatPage {...base} {...props} />
    </ToastProvider>,
  )
const mainInput = () => screen.getByLabelText('Pergunta a Max Lavandeira') as HTMLInputElement

describe('syndic v54 — AgentChatPage', () => {
  it('1. rend la sidebar Conversas + le main (nom + badge IA + intro)', () => {
    renderACP({ title: 'Assistente' })
    expect(screen.getByText('CONVERSAS')).toBeTruthy()
    expect(screen.getByText('IA')).toBeTruthy()
    expect(screen.getByText('Olá!')).toBeTruthy()
    expect(screen.getByText('Assistente')).toBeTruthy()
    expect(screen.getByRole('button', { name: '+ Nova conversa' })).toBeTruthy()
  })

  it('2. groupe les conversas par bucket (ONTEM / ESTA SEMANA / MAIS ANTIGAS)', () => {
    renderACP({
      conversations: [
        { id: 'a', title: 'Conv A', bucket: 'ontem' },
        { id: 'b', title: 'Conv B', bucket: 'esta-semana' },
        { id: 'c', title: 'Conv C', bucket: 'mais-antigas' },
      ],
    })
    expect(screen.getByText('ONTEM')).toBeTruthy()
    expect(screen.getByText('ESTA SEMANA')).toBeTruthy()
    expect(screen.getByText('MAIS ANTIGAS')).toBeTruthy()
    expect(screen.getByText('Conv A')).toBeTruthy()
    expect(screen.getByText('Conv C')).toBeTruthy()
  })

  it('3. conversas vides : message d\'invite', () => {
    renderACP({ conversations: [] })
    expect(screen.getByText(/Nenhuma conversa ainda/)).toBeTruthy()
  })

  it('4. clic suggestion : remplit le champ + lui donne le focus', () => {
    renderACP({ suggestions: ['Resumir a ata'] })
    fireEvent.click(screen.getByRole('button', { name: 'Resumir a ata' }))
    const input = mainInput()
    expect(input.value).toBe('Resumir a ata')
    expect(document.activeElement).toBe(input)
  })

  it('5. Enviar désactivé si vide, activé après saisie', () => {
    renderACP()
    const send = screen.getByRole('button', { name: 'Enviar' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.change(mainInput(), { target: { value: 'Olá Max' } })
    expect(send.disabled).toBe(false)
  })

  it('6a. envoi sans onSend : pousse un toast (info)', () => {
    renderACP()
    fireEvent.change(mainInput(), { target: { value: 'Quanto custa?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(screen.getByText('Pergunta enviada a Lavandeira')).toBeTruthy()
    expect(mainInput().value).toBe('') // champ vidé après envoi
  })

  it('6b. envoi avec onSend : appelle le callback avec la valeur', () => {
    const onSend = vi.fn()
    renderACP({ onSend })
    fireEvent.change(mainInput(), { target: { value: 'Pergunta X' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(onSend).toHaveBeenCalledWith('Pergunta X')
  })

  it('7. contextSelector + showDocsBtn rendus', () => {
    renderACP({ contextSelector: { label: 'Condomínio', options: ['A', 'B'] }, showDocsBtn: true })
    expect(screen.getByText('Condomínio :')).toBeTruthy()
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(within(select).getAllByRole('option').length).toBe(2)
    expect(screen.getByRole('button', { name: 'Documentos' })).toBeTruthy()
  })

  it('8. alert rendu quand fourni', () => {
    renderACP({ alert: { kind: 'gold', icon: 'info', title: 'Aviso IA' } })
    expect(screen.getByText('Aviso IA')).toBeTruthy()
  })

  it('9. + Nova conversa : callback onNewConversation', () => {
    const onNewConversation = vi.fn()
    renderACP({ onNewConversation })
    fireEvent.click(screen.getByRole('button', { name: '+ Nova conversa' }))
    expect(onNewConversation).toHaveBeenCalled()
  })

  it('10. clic conversa : callback onSelectConversation avec l\'item', () => {
    const onSelectConversation = vi.fn()
    renderACP({
      conversations: [{ id: 'z', title: 'Conv Z', bucket: 'ontem' }],
      onSelectConversation,
    })
    fireEvent.click(screen.getByRole('button', { name: /Conv Z/ }))
    expect(onSelectConversation).toHaveBeenCalledWith(expect.objectContaining({ id: 'z' }))
  })
})
