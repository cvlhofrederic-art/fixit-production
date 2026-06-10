import { describe, it, expect } from 'vitest'
import { resolveTvaEnabledV2 } from '@/lib/devis-utils'

// Audit 2026-06-10 (Vague 4) — franchise 293 B fragile sur les docs legacy.
// Un document V2 (artisan) enregistré AVANT la persistance du flag tvaEnabled
// rendait « TVA applicable » + colonnes TTC par défaut, même pour un
// auto-entrepreneur en franchise (non-conformité art. 293 B CGI).
// Règle : flag explicite respecté ; sinon, inférence depuis companyStatus —
// EI / auto-entrepreneur (FR) et ENI (PT) sont en franchise par défaut
// (cf. .claude/rules/artisan-vs-btp.md « Franchise 293B : Artisan EI/auto/micro »).

describe('resolveTvaEnabledV2 — inférence franchise 293B', () => {
  it('flag explicite true → TVA activée (auto-entrepreneur ayant dépassé le seuil)', () => {
    expect(resolveTvaEnabledV2({ tvaEnabled: true, companyStatus: 'ae' })).toBe(true)
  })

  it('flag explicite false → franchise', () => {
    expect(resolveTvaEnabledV2({ tvaEnabled: false, companyStatus: 'sarl' })).toBe(false)
  })

  it('legacy sans flag + auto-entrepreneur (ae) → franchise par défaut', () => {
    expect(resolveTvaEnabledV2({ companyStatus: 'ae' })).toBe(false)
  })

  it('legacy sans flag + EI → franchise par défaut', () => {
    expect(resolveTvaEnabledV2({ companyStatus: 'ei' })).toBe(false)
  })

  it('legacy sans flag + ENI (PT) → isenção par défaut', () => {
    expect(resolveTvaEnabledV2({ companyStatus: 'eni' })).toBe(false)
  })

  it('legacy sans flag + SARL → TVA activée', () => {
    expect(resolveTvaEnabledV2({ companyStatus: 'sarl' })).toBe(true)
  })

  it('legacy sans flag ni companyStatus → TVA activée (comportement historique conservé)', () => {
    expect(resolveTvaEnabledV2({})).toBe(true)
  })
})
