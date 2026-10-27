import { describe, expect, it } from 'vitest'
import {
  cloturerArrete,
  decloturerArrete,
  etatArrete,
  ouvrirArrete,
  type ArreteRapprochement,
  type ElementRapprochement,
} from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'

/**
 * Rapprochement bancaire par arrêtés successifs (cartographie Gestéam, tranche 29 ; D1 : comptes du syndicat).
 * - Un arrêté par compte et par date : solde banque, solde compta, éléments rapprochés ou en suspens.
 * - Équilibre : solde banque − suspens banque = solde compta − suspens compta.
 * - Taux rapproché automatiquement / manuellement (colonnes Rap% et Man% de Gestéam).
 * - Un seul arrêté « En cours » par compte ; clôture à l'équilibre ; seule la dernière clôture se déclôture.
 */

const el = (id: string, cote: 'banque' | 'compta', montantCentimes: number, rapproche: ElementRapprochement['rapproche']): ElementRapprochement => ({
  id,
  cote,
  montantCentimes,
  rapproche,
})

const arrete = (surcharge: Partial<ArreteRapprochement> = {}): ArreteRapprochement => ({
  id: 'a-1',
  banqueId: 'b-courant',
  dateArrete: '2026-10-20',
  soldeBanqueCentimes: 1_000_000,
  soldeComptaCentimes: 1_030_000,
  statut: 'En cours',
  elements: [
    el('e1', 'banque', 25_000, 'auto'),
    el('e2', 'compta', 25_000, 'auto'),
    el('e3', 'compta', -40_000, false),
    el('e4', 'banque', -10_000, false),
    el('e5', 'banque', 8_000, 'manuel'),
  ],
  ...surcharge,
})

describe('rapprochement — état d’un arrêté', () => {
  it('équilibre quand solde banque − suspens banque = solde compta − suspens compta', () => {
    expect(etatArrete(arrete())).toEqual({
      soldeBanqueAjusteCentimes: 1_010_000,
      soldeComptaAjusteCentimes: 1_070_000,
      ecartCentimes: -60_000,
      equilibre: false,
      suspensBanque: 1,
      suspensCompta: 1,
      tauxAutoPct: 40,
      tauxManuelPct: 20,
    })
    expect(etatArrete(arrete({ soldeComptaCentimes: 970_000 })).equilibre).toBe(true)
  })

  it('un arrêté sans élément : taux nuls', () => {
    expect(etatArrete(arrete({ elements: [], soldeComptaCentimes: 1_000_000 }))).toMatchObject({ equilibre: true, tauxAutoPct: 0, tauxManuelPct: 0 })
  })
})

describe('rapprochement — ouverture, clôture, déclôture', () => {
  const cloture = (id: string, dateArrete: string) => arrete({ id, dateArrete, statut: 'Clôturé' })

  it('ouvre un arrêté après le dernier arrêté clôturé du compte', () => {
    const nouveau = ouvrirArrete([cloture('a-0', '2026-10-10')], {
      id: 'a-1',
      banqueId: 'b-courant',
      dateArrete: '2026-10-20',
      soldeBanqueCentimes: 1_000_000,
      soldeComptaCentimes: 1_000_000,
    })
    expect(nouveau).toMatchObject({ statut: 'En cours', elements: [] })
  })

  it('refuse un deuxième arrêté en cours sur le même compte, ou une date non postérieure', () => {
    const saisie = { id: 'a-2', banqueId: 'b-courant', dateArrete: '2026-10-30', soldeBanqueCentimes: 0, soldeComptaCentimes: 0 }
    expect(() => ouvrirArrete([arrete()], saisie)).toThrow(/en cours/i)
    expect(() => ouvrirArrete([cloture('a-0', '2026-10-30')], saisie)).toThrow(/post[ée]rieur/i)
    expect(ouvrirArrete([arrete({ banqueId: 'b-fonds-travaux' })], saisie).banqueId).toBe('b-courant')
    expect(() => ouvrirArrete([], { ...saisie, dateArrete: '30/10/2026' })).toThrow(/date/i)
  })

  it('clôture seulement à l’équilibre', () => {
    expect(() => cloturerArrete(arrete())).toThrow(/équilibr/i)
    expect(cloturerArrete(arrete({ soldeComptaCentimes: 970_000 })).statut).toBe('Clôturé')
  })

  it('déclôture seulement le dernier arrêté clôturé du compte, sans arrêté en cours', () => {
    const arretes = [cloture('a-0', '2026-10-10'), cloture('a-1', '2026-10-20')]
    expect(decloturerArrete(arretes, 'a-1').statut).toBe('En cours')
    expect(() => decloturerArrete(arretes, 'a-0')).toThrow(/dernier/i)
    expect(() => decloturerArrete([...arretes, arrete({ id: 'a-2', dateArrete: '2026-10-30' })], 'a-1')).toThrow(/en cours/i)
    expect(() => decloturerArrete(arretes, 'a-9')).toThrow(/introuvable/i)
  })
})
