// tests/lib/syndic/agent-locale-resolver.test.ts
import { describe, it, expect } from 'vitest'
import { resolveAgentLocale } from '@/lib/syndic/agent-locale-resolver'

describe('resolveAgentLocale', () => {
  it('priorité 1 : conversation existante → locale héritée immuable', () => {
    const locale = resolveAgentLocale(
      { profile: { country: 'pt' } },
      { locale: 'fr' },
      'pt'
    )
    expect(locale).toBe('fr')
  })

  it('priorité 2 : user.profile.country = fr → locale fr', () => {
    const locale = resolveAgentLocale({ profile: { country: 'fr' } }, undefined, 'pt')
    expect(locale).toBe('fr')
  })

  it('priorité 2 : user.profile.country = pt → locale pt', () => {
    const locale = resolveAgentLocale({ profile: { country: 'pt' } }, undefined, 'fr')
    expect(locale).toBe('pt')
  })

  it('priorité 3 : aucune info user/conv → fallback uiLocale', () => {
    const locale = resolveAgentLocale({}, undefined, 'pt')
    expect(locale).toBe('pt')
  })

  it('priorité 4 : aucune info → fallback fr', () => {
    const locale = resolveAgentLocale({}, undefined, undefined)
    expect(locale).toBe('fr')
  })

  it('rejette les valeurs invalides et fallback fr', () => {
    const locale = resolveAgentLocale({ profile: { country: 'es' as 'fr' } }, undefined, undefined)
    expect(locale).toBe('fr')
  })
})
