import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/i18n/context', () => ({
  useLocale: () => 'fr',
}))

import LocaleLink from '@/components/common/LocaleLink'

describe('LocaleLink', () => {
  it('prepends the current locale to internal absolute paths', () => {
    render(<LocaleLink href="/recherche">cherche</LocaleLink>)
    expect(screen.getByRole('link', { name: 'cherche' })).toHaveAttribute('href', '/fr/recherche')
  })

  it('does not double-prefix paths that already start with /<locale>/', () => {
    render(<LocaleLink href="/pt/pesquisar">pesquisar</LocaleLink>)
    expect(screen.getByRole('link', { name: 'pesquisar' })).toHaveAttribute('href', '/pt/pesquisar')
  })

  it('passes API and _next paths through unchanged', () => {
    render(<LocaleLink href="/api/health">health</LocaleLink>)
    expect(screen.getByRole('link', { name: 'health' })).toHaveAttribute('href', '/api/health')
  })

  it('honours an explicit locale prop over the context', () => {
    render(<LocaleLink href="/contact" locale="pt">contacto</LocaleLink>)
    expect(screen.getByRole('link', { name: 'contacto' })).toHaveAttribute('href', '/pt/contact')
  })
})
