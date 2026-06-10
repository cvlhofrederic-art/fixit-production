import { describe, it, expect } from 'vitest'
import { buildAcomptePrefill } from '@/lib/acompte-prefill'

// Audit 2026-06-10 (Vague 4) — verrouillage de contrat.
// buildAcomptePrefill hérite de TOUS les champs du parent via `...scaled`
// (scaleDocumentLines fait un spread complet du doc). Les flags de visibilité
// (materialLinesEnabled, fraisLinesEnabled…) doivent suivre le parent : un
// parent qui masque ses materialLines ne doit pas produire un acompte qui les
// affiche (sinon le total affiché de l'acompte diverge du parent).
// Ce test fige ce contrat — si un refactor de scaleDocumentLines cesse de
// recopier le document complet, il casse ici.

const PARENT = {
  id: 'b2c8a1f0-0000-4000-8000-000000000001',
  docType: 'facture',
  docNumber: 'FACT-2026-042',
  tvaEnabled: false,
  materialLinesEnabled: false,
  fraisLinesEnabled: true,
  lines: [{ id: 1, description: 'MO', qty: 1, unit: 'forfait', priceHT: 1000, tvaRate: 0, totalHT: 1000 }],
  materialLines: [{ id: 2, description: 'Fournitures', qty: 1, unit: 'forfait', priceHT: 500, tvaRate: 0, totalHT: 500 }],
}

describe('buildAcomptePrefill — héritage des flags de visibilité', () => {
  const acompte = buildAcomptePrefill(PARENT, { percentage: 30, ordre: 1, total: 1, declencheur: 'signature' })

  it('materialLinesEnabled=false hérité du parent', () => {
    expect(acompte.materialLinesEnabled).toBe(false)
  })

  it('fraisLinesEnabled=true hérité du parent', () => {
    expect(acompte.fraisLinesEnabled).toBe(true)
  })

  it('franchise héritée : mention 293 B dans les notes', () => {
    expect(String(acompte.notes)).toContain('293 B')
  })

  it('échéancier remis à zéro (un acompte ne porte pas d\'échéancier)', () => {
    expect(acompte.acomptesEnabled).toBe(false)
    expect(acompte.acomptes).toEqual([])
  })
})
