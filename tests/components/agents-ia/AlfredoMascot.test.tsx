import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AlfredoMascot } from '@/components/syndic-dashboard/agents-ia/alfredo/AlfredoMascot'

describe('AlfredoMascot', () => {
  it('rend le caractère emoji 📧 par défaut avec rôle img', () => {
    render(<AlfredoMascot />)
    const img = screen.getByRole('img', { name: /alfredo/i })
    expect(img).toBeDefined()
    expect(img.textContent).toBe('📧')
  })

  it('rend la taille small (48px) quand size=sm', () => {
    render(<AlfredoMascot size="sm" />)
    const img = screen.getByRole('img', { name: /alfredo/i })
    expect(img.getAttribute('style')).toContain('48px')
  })

  it('rend la taille large (96px) quand size=lg', () => {
    render(<AlfredoMascot size="lg" />)
    const img = screen.getByRole('img', { name: /alfredo/i })
    expect(img.getAttribute('style')).toContain('96px')
  })
})
