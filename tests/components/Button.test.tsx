import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/i18n/context', () => ({
  useLocale: () => 'fr',
}))

import Button from '@/components/ui/Button'

describe('Button', () => {
  it('renders a <button> by default and fires onClick', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Send</Button>)
    const btn = screen.getByRole('button', { name: 'Send' })
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('honours the disabled prop', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick} disabled>Send</Button>)
    const btn = screen.getByRole('button', { name: 'Send' })
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders a locale-aware link when href is set', () => {
    render(<Button href="/contact">Contact</Button>)
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/fr/contact')
  })

  it('passes through type=submit when requested', () => {
    render(<Button type="submit">Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit')
  })
})
