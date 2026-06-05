// tests/devis-doc-time.test.ts
//
// getDocTime : horodatage de récence (ms epoch) pour le tri « du plus récent au
// plus ancien ». Basé sur l'émission réelle (sentAt → savedAt → docDate), PAS
// sur le numéro de séquence : les séries sont indépendantes (AC- a son propre
// compteur), donc un acompte récent AC-2026-002 (séq 2) NE doit PAS se retrouver
// sous FACT-2026-003+ (séq 3+).

import { describe, it, expect } from 'vitest'
import { getDocTime, getDocSeq } from '../lib/devis-utils'

describe('getDocTime', () => {
  it('priorise sentAt, puis savedAt, puis docDate', () => {
    expect(getDocTime({ sentAt: '2026-06-05T10:00:00.000Z', savedAt: '2026-06-01T00:00:00.000Z' }))
      .toBe(Date.parse('2026-06-05T10:00:00.000Z'))
    expect(getDocTime({ savedAt: '2026-06-02T08:00:00.000Z' }))
      .toBe(Date.parse('2026-06-02T08:00:00.000Z'))
    expect(getDocTime({ docDate: '2026-05-20' })).toBe(Date.parse('2026-05-20'))
  })

  it('renvoie 0 si aucune date', () => {
    expect(getDocTime({})).toBe(0)
  })

  it('un acompte récent passe AVANT une facture plus ancienne (vs getDocSeq qui le mettait après)', () => {
    const fact = { docNumber: 'FACT-2026-017', sentAt: '2026-06-04T09:00:00.000Z' }
    const acompte = { docNumber: 'AC-2026-002', sentAt: '2026-06-05T15:00:00.000Z' }
    // Tri récence : l'acompte (plus récent) avant la facture
    expect(getDocTime(acompte)).toBeGreaterThan(getDocTime(fact))
    // Alors que getDocSeq mettait la facture (séq 17) avant l'acompte (séq 2)
    expect(getDocSeq(fact)).toBeGreaterThan(getDocSeq(acompte))
  })
})
