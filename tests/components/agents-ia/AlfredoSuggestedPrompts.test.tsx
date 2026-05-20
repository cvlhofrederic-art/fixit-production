import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AlfredoSuggestedPrompts } from '@/components/syndic-dashboard/agents-ia/alfredo/AlfredoSuggestedPrompts'

describe('AlfredoSuggestedPrompts', () => {
  it('rend 8 chips en français par défaut', () => {
    render(<AlfredoSuggestedPrompts locale="fr" onPick={() => {}} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBe(8)
  })

  it('rend les 8 chips en portugais quand locale=pt', () => {
    render(<AlfredoSuggestedPrompts locale="pt" onPick={() => {}} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBe(8)
    expect(screen.getByText(/Resume os meus emails/i)).toBeDefined()
  })

  it('appelle onPick avec le texte du chip cliqué', () => {
    const onPick = vi.fn()
    render(<AlfredoSuggestedPrompts locale="fr" onPick={onPick} />)
    fireEvent.click(screen.getByText(/Résume mes emails du jour/i))
    expect(onPick).toHaveBeenCalledWith('Résume mes emails du jour')
  })
})
