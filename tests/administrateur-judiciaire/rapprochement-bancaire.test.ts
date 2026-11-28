import { describe, expect, it } from 'vitest'
import {
  abandonnerArrete,
  cloturerArrete,
  decloturerArrete,
  etatArrete,
  ouvrirArrete,
  verifierClotureCompteBancaire,
  type ArreteRapprochement,
  type ElementRapprochement,
} from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'

/**
 * Rapprochement bancaire par arrêtés successifs (cartographie Gestéam, tranche 29 ; D1 : comptes du syndicat).
 * - Un arrêté par compte et par date : solde banque, solde compta, éléments rapprochés ou en suspens.
 * - Équilibre : solde banque − suspens banque = solde compta − suspens compta.
 * - Taux rapproché automatiquement / manuellement (colonnes Rap% et Man% de Gestéam).
 * - Un seul arrêté « En cours » par compte ; clôture à l'équilibre ; seule la dernière clôture se déclôture.
 * - Décision du 26/11/2026 (rb-01) : un arrêté « En cours » s'abandonne (statut « Abandonné », hors de toute règle),
 *   jamais un arrêté clôturé. Un arrêté déjà clôturé ne se clôture pas une seconde fois (rb-03 : son solde compta est
 *   figé à la clôture).
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
  // Jour de référence : date d'arrêté refusée après lui (rb-16 A, tests dans rapprochement-regles-communes.test.ts).
  const AUJOURDHUI = '2026-11-27'

  it('ouvre un arrêté après le dernier arrêté clôturé du compte', () => {
    const nouveau = ouvrirArrete(
      [cloture('a-0', '2026-10-10')],
      {
        id: 'a-1',
        banqueId: 'b-courant',
        dateArrete: '2026-10-20',
        soldeBanqueCentimes: 1_000_000,
        soldeComptaCentimes: 1_000_000,
      },
      AUJOURDHUI,
    )
    expect(nouveau).toMatchObject({ statut: 'En cours', elements: [] })
  })

  it('refuse un deuxième arrêté en cours sur le même compte, ou une date non postérieure', () => {
    const saisie = { id: 'a-2', banqueId: 'b-courant', dateArrete: '2026-10-30', soldeBanqueCentimes: 0, soldeComptaCentimes: 0 }
    expect(() => ouvrirArrete([arrete()], saisie, AUJOURDHUI)).toThrow(/en cours/i)
    expect(() => ouvrirArrete([cloture('a-0', '2026-10-30')], saisie, AUJOURDHUI)).toThrow(/post[ée]rieur/i)
    expect(ouvrirArrete([arrete({ banqueId: 'b-fonds-travaux' })], saisie, AUJOURDHUI).banqueId).toBe('b-courant')
    expect(() => ouvrirArrete([], { ...saisie, dateArrete: '30/10/2026' }, AUJOURDHUI)).toThrow(/date/i)
  })

  it('clôture seulement à l’équilibre', () => {
    expect(() => cloturerArrete(arrete())).toThrow(/équilibr/i)
    expect(cloturerArrete(arrete({ soldeComptaCentimes: 970_000 })).statut).toBe('Clôturé')
  })

  it('clôture refusée pour un arrêté déjà clôturé, même à l’équilibre (rb-03 : solde compta figé à la clôture)', () => {
    expect(() => cloturerArrete(arrete({ soldeComptaCentimes: 970_000, statut: 'Clôturé' }))).toThrow('Clôture refusée : arrêté déjà clôturé.')
  })

  it('abandon d’un arrêté en cours (rb-01) : statut « Abandonné », rien d’autre ne change', () => {
    const enCours = arrete({ elements: [el('e3', 'compta', -40_000, false)] })
    expect(abandonnerArrete(enCours)).toEqual({ ...enCours, statut: 'Abandonné' })
    // L'arrêté reçu n'est pas modifié.
    expect(enCours.statut).toBe('En cours')
  })

  it('abandon refusé pour un arrêté clôturé (rb-01 : jamais un arrêté clôturé)', () => {
    expect(() => abandonnerArrete(arrete({ statut: 'Clôturé', elements: [] }))).toThrow(
      'Abandon refusé : seul un arrêté en cours peut être abandonné (arrêté « Clôturé »).',
    )
  })

  it('abandon refusé tant qu’un élément est pointé : un pointage ne se perd pas sans bruit', () => {
    expect(() => abandonnerArrete(arrete())).toThrow('Abandon refusé : 3 éléments pointés sur cet arrêté, à dépointer d’abord.')
    expect(() => abandonnerArrete(arrete({ elements: [el('e5', 'banque', 8_000, 'manuel')] }))).toThrow(
      'Abandon refusé : 1 élément pointé sur cet arrêté, à dépointer d’abord.',
    )
  })

  it('déclôture seulement le dernier arrêté clôturé du compte, sans arrêté en cours', () => {
    const arretes = [cloture('a-0', '2026-10-10'), cloture('a-1', '2026-10-20')]
    expect(decloturerArrete(arretes, 'a-1').statut).toBe('En cours')
    expect(() => decloturerArrete(arretes, 'a-0')).toThrow(/dernier/i)
    expect(() => decloturerArrete([...arretes, arrete({ id: 'a-2', dateArrete: '2026-10-30' })], 'a-1')).toThrow(/en cours/i)
    expect(() => decloturerArrete(arretes, 'a-9')).toThrow(/introuvable/i)
  })
})

describe('rapprochement — clôture du compte bancaire (réponse du référent métier du 28/11/2026, point #857 · 1, choix A)', () => {
  const cloture = (id: string, dateArrete: string) => arrete({ id, dateArrete, statut: 'Clôturé' })

  it('refusée tant qu’un arrêté du compte est en cours : le message dit quoi faire (le clôturer ou l’abandonner d’abord)', () => {
    const arretes = [cloture('a-0', '2026-10-10'), arrete({ id: 'a-1', dateArrete: '2026-10-20' })]
    expect(() => verifierClotureCompteBancaire('b-courant', arretes)).toThrow(
      'Un arrêté est en cours sur ce compte : le clôturer ou l’abandonner d’abord.',
    )
  })

  it('acceptée sans arrêté, ou quand tous les arrêtés du compte sont clôturés', () => {
    expect(() => verifierClotureCompteBancaire('b-courant', [])).not.toThrow()
    expect(() => verifierClotureCompteBancaire('b-courant', [cloture('a-0', '2026-10-10'), cloture('a-1', '2026-10-20')])).not.toThrow()
  })

  it('l’arrêté en cours d’un autre compte ne bloque pas', () => {
    expect(() => verifierClotureCompteBancaire('b-fonds', [arrete({ id: 'a-1' }), cloture('a-2', '2026-10-10')])).not.toThrow()
  })
})
