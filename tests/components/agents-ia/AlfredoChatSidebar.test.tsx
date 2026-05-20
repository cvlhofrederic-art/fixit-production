import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AlfredoChatSidebar } from '@/components/syndic-dashboard/agents-ia/alfredo/AlfredoChatSidebar'

describe('AlfredoChatSidebar', () => {
  it('rend collapsed par défaut avec un bouton "Discuter avec Alfredo"', () => {
    render(<AlfredoChatSidebar locale="fr">{<div data-testid="chat-content" />}</AlfredoChatSidebar>)
    expect(screen.getByRole('button', { name: /Discuter avec Alfredo/i })).toBeDefined()
    expect(screen.queryByTestId('chat-content')).toBeNull()
  })

  it('rend expanded quand on clique sur le bouton', () => {
    render(<AlfredoChatSidebar locale="fr">{<div data-testid="chat-content" />}</AlfredoChatSidebar>)
    fireEvent.click(screen.getByRole('button', { name: /Discuter avec Alfredo/i }))
    expect(screen.getByTestId('chat-content')).toBeDefined()
  })

  it('appelle onToggle si fourni', () => {
    const onToggle = vi.fn()
    render(<AlfredoChatSidebar locale="fr" onToggle={onToggle}>{<div />}</AlfredoChatSidebar>)
    fireEvent.click(screen.getByRole('button', { name: /Discuter avec Alfredo/i }))
    expect(onToggle).toHaveBeenCalledWith(true)
  })

  it('label en portugais quand locale=pt', () => {
    render(<AlfredoChatSidebar locale="pt">{<div />}</AlfredoChatSidebar>)
    expect(screen.getByRole('button', { name: /Conversar com Alfredo/i })).toBeDefined()
  })
})
