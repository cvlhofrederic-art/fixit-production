import { describe, expect, it } from 'vitest'
import {
  controlerVentilation,
  echeanceReglement,
  ecritureFactureVentilee,
  partRecuperable,
  type LigneFacture,
} from '@/lib/administrateur-judiciaire/domain/facture-ventilee'

/**
 * Facture fournisseur ventilée en lignes (cartographie Gestéam, tranche 36 : onglet Détail de la facture).
 * - Chaque ligne : compte de charge, analytique, clé, rubrique, code fiscal, montant TTC, part récupérable sur le
 *   locataire ; rattachement possible à un lot, à une opération de travaux, à un contentieux ou à un sinistre.
 * - La somme des lignes égale le total TTC de la facture.
 * - Écriture « Saisie de factures » : un débit par ligne (compte du syndicat, D1), un crédit au fournisseur.
 * - Échéance : date de facture + N jours ; reste dû après acomptes ; en retard après l'échéance.
 */

const ligne = (surcharge: Partial<LigneFacture> = {}): LigneFacture => ({
  comptePlan: '61500',
  analytique: '460',
  cleRepartition: '001 - Charges communes générales',
  rubrique: '460',
  codeFiscal: null,
  montantTtcCentimes: 30_000,
  recupLocatairePct: 0,
  lotId: null,
  rattachement: null,
  ...surcharge,
})

const lignes = [
  ligne(),
  ligne({ comptePlan: '61400', analytique: '401', cleRepartition: '002 - Ascenseur', rubrique: '401', montantTtcCentimes: 18_000, recupLocatairePct: 100 }),
  ligne({ comptePlan: '67100', montantTtcCentimes: 52_000, rattachement: { type: 'travaux', id: '00042' } }),
]

describe('ventilation', () => {
  it('conforme quand la somme des lignes égale le total TTC', () => {
    expect(controlerVentilation(100_000, lignes)).toEqual([])
  })

  it('signale un écart de ventilation, un compte mal formé, une part récupérable invalide, une facture sans ligne', () => {
    expect(controlerVentilation(100_100, lignes).map((a) => a.code)).toEqual(['ecart_total'])
    expect(controlerVentilation(30_000, [ligne({ comptePlan: '615' })]).map((a) => a.code)).toEqual(['compte_invalide'])
    expect(controlerVentilation(30_000, [ligne({ recupLocatairePct: 120 })]).map((a) => a.code)).toEqual(['recuperable_invalide'])
    expect(controlerVentilation(0, []).map((a) => a.code)).toEqual(['sans_ligne'])
  })

  it('part récupérable sur les locataires', () => {
    expect(partRecuperable(lignes)).toBe(18_000)
  })
})

describe('écriture « Saisie de factures » ventilée', () => {
  it('un débit par ligne au compte du syndicat, un crédit au fournisseur, équilibrée', () => {
    const t = ecritureFactureVentilee({ id: 't-1', date: '2026-10-15', segmentSyndicat: 'TILL', auxiliaireFournisseur: 'PLOMB', totalTtcCentimes: 100_000, lignes })
    expect(t.famille).toBe('Saisie de factures')
    expect(t.mouvements.map((m) => [m.compte, m.sens, m.montantCentimes])).toEqual([
      ['TILL.61500.00000.0', 'debit', 30_000],
      ['TILL.61400.00000.0', 'debit', 18_000],
      ['TILL.67100.00042.0', 'debit', 52_000],
      ['TILL.40100.PLOMB.0', 'credit', 100_000],
    ])
  })

  it('refuse d’écrire une facture mal ventilée', () => {
    expect(() =>
      ecritureFactureVentilee({ id: 't', date: '2026-10-15', segmentSyndicat: 'TILL', auxiliaireFournisseur: 'PLOMB', totalTtcCentimes: 99_999, lignes }),
    ).toThrow(/ventilation/i)
  })
})

describe('échéance de règlement', () => {
  it('date de facture + N jours ; reste dû après acomptes ; retard', () => {
    expect(echeanceReglement({ dateFacture: '2026-10-15', joursEcheance: 30, totalTtcCentimes: 100_000, acomptesCentimes: 20_000 }, '2026-11-20')).toEqual({
      echeance: '2026-11-14',
      resteDuCentimes: 80_000,
      enRetard: true,
      joursRetard: 6,
    })
    expect(echeanceReglement({ dateFacture: '2026-10-15', joursEcheance: 30, totalTtcCentimes: 100_000, acomptesCentimes: 100_000 }, '2026-11-20')).toMatchObject({
      resteDuCentimes: 0,
      enRetard: false,
    })
  })
})

describe('marque « non déductible » et contrat de la ligne (point 28)', () => {
  it('reportés sur le débit quand la ligne les porte (attributs, liens) ; absents sinon', () => {
    const t = ecritureFactureVentilee({
      id: 't-1',
      date: '2026-10-15',
      segmentSyndicat: 'TILL',
      auxiliaireFournisseur: 'PLOMB',
      totalTtcCentimes: 48_000,
      lignes: [ligne({ nonDeductible: true, contratId: 'ctr-9' }), ligne({ montantTtcCentimes: 18_000 })],
    })
    expect(t.mouvements[0]).toMatchObject({ attributs: { nonDeductible: true }, liens: { contratId: 'ctr-9' } })
    expect(t.mouvements[1].attributs).not.toHaveProperty('nonDeductible')
    expect(t.mouvements[1]).not.toHaveProperty('liens')
  })
})
