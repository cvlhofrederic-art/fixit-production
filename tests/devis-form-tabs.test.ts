// tests/devis-form-tabs.test.ts — #7 (onglets) : basculer Devis↔Facture via les
// onglets ne doit pas écraser un doc établi ni hériter du mauvais préfixe de
// numéro. La décision pure est testée ici (les effets de bord — snapshot + reset
// d'identité — sont câblés dans switchDocType côté composant).

import { describe, it, expect } from 'vitest'
import { shouldResetIdentityOnTypeSwitch } from '../components/DevisFactureForm'

describe('shouldResetIdentityOnTypeSwitch', () => {
  it('reset si bascule de type sur un doc avec numéro attribué', () => {
    expect(shouldResetIdentityOnTypeSwitch('devis', 'facture', 'DEV-2026-010', false)).toBe(true)
  })
  it('reset si bascule de type sur un doc déjà émis', () => {
    expect(shouldResetIdentityOnTypeSwitch('devis', 'facture', '', true)).toBe(true)
  })
  it('pas de reset sur un doc neuf (pas de numéro, pas émis)', () => {
    expect(shouldResetIdentityOnTypeSwitch('devis', 'facture', '', false)).toBe(false)
    expect(shouldResetIdentityOnTypeSwitch('devis', 'facture', null, false)).toBe(false)
  })
  it('pas de reset si on reste sur le même type', () => {
    expect(shouldResetIdentityOnTypeSwitch('facture', 'facture', 'FACT-2026-001', true)).toBe(false)
  })
})
