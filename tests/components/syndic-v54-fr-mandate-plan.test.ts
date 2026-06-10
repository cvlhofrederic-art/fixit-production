// tests/components/syndic-v54-fr-mandate-plan.test.ts
//
// computeMandatePlan — moteur pur d'auto-planification du mandat judiciaire
// (calendrier légal depuis ordonnance + durée + fondement). Port du mockup v8.

import { describe, it, expect } from 'vitest'
import { computeMandatePlan } from '@/components/syndic-dashboard/v54-fr/lib/mandate-plan'

describe('syndic v54-fr — computeMandatePlan', () => {
  it('1. mandat art. 46 (carence) 12 mois : échéance + 6 étapes légales, sans requête 29-1', () => {
    const p = computeMandatePlan({ ordonnance: '04/06/2026', duree: '12', fondement: 'art. 46 décret du 17 mars 1967 (carence)' })
    expect(p.ech).toBe('04/06/2027')
    expect(p.calendar).toHaveLength(6)
    expect(p.calendar[0]).toEqual({ label: "Notifier l'ordonnance aux copropriétaires", date: '04/07/2026', basis: 'art. 64 décret 1967', role: 'Secrétariat' })
    expect(p.calendar[3].date).toBe('04/04/2027') // convocation AG élective : échéance - 2 mois
    expect(p.calendar[4].basis).toBe('art. 18-2 L. 1965') // reddition hors 29-1
    expect(p.docs).toEqual(["Notification d'ordonnance", 'Convocation AG élective'])
  })

  it('2. mandat art. 29-1 (difficulté) : reddition fondée 29-1 + requête de suivi en plus', () => {
    const p = computeMandatePlan({ ordonnance: '05/11/2024', duree: '18', fondement: 'art. 29-1 loi du 10 juillet 1965 (copropriété en difficulté)' })
    expect(p.ech).toBe('05/05/2026')
    expect(p.calendar[4].basis).toBe('art. 29-1 L. 1965')
    expect(p.docs).toContain('Requête art. 29-1 (suivi)')
    expect(p.docs).toHaveLength(3)
  })

  it('3. entrées invalides : retombe sur la base mockup (04/06/2026) et 12 mois', () => {
    const p = computeMandatePlan({ ordonnance: 'pas-une-date', duree: 'abc', fondement: '' })
    expect(p.ech).toBe('04/06/2027')
    expect(p.calendar[2].date).toBe('19/06/2026') // compte séparé : ordonnance + 15 jours
  })
})
