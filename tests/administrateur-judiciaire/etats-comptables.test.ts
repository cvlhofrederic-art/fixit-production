import { describe, expect, it } from 'vitest'
import { ETATS_GESTEAM, balance, grandLivre, journalDesTraitements } from '@/lib/administrateur-judiciaire/domain/etats-comptables'
import { creerTraitement } from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * États comptables d'un syndicat (cartographie Gestéam, tranche 28), calculés sur les traitements (R6 : tout
 * mouvement appartient à un traitement). Paramètres communs de Gestéam : plage de comptes, période, familles.
 * - Balance : débit, crédit, solde débiteur ou créditeur par compte ; totaux équilibrés.
 * - Grand livre : par compte, report des mouvements antérieurs à la période, mouvements, solde progressif.
 * - Journal : les traitements de la période, dans l'ordre des dates.
 */

const t = (id: string, famille: Parameters<typeof creerTraitement>[0]['famille'], date: string, lignes: [string, 'debit' | 'credit', number][]) =>
  creerTraitement({ id, famille, date, mouvements: lignes.map(([compte, sens, montantCentimes]) => ({ compte, sens, montantCentimes })) })

const traitements = [
  t('t1', 'Appel de fonds', '2026-01-05', [
    ['TILL.45000.00012.0', 'debit', 80_000],
    ['TILL.70100.00000.0', 'credit', 80_000],
  ]),
  t('t2', 'Encaissement', '2026-02-10', [
    ['TILL.51200.00000.0', 'debit', 50_000],
    ['TILL.45000.00012.0', 'credit', 50_000],
  ]),
  t('t3', 'Saisie de factures', '2026-03-15', [
    ['TILL.61500.00000.0', 'debit', 12_000],
    ['TILL.40100.PLOMB.0', 'credit', 12_000],
  ]),
]

describe('états comptables — référentiel', () => {
  it('reprend les neuf éditions de Gestéam et dit lesquelles VitFix calcule', () => {
    expect(ETATS_GESTEAM.map((e) => e.libelle)).toEqual([
      'Position des mandants',
      'Pointe de garantie',
      'Grand livre',
      'Balance',
      'Journaux',
      'État des honoraires de gestion syndic',
      'Tableau des honoraires',
      'Évolution des honoraires',
      'Récapitulatif de caisse de garantie',
    ])
    expect(ETATS_GESTEAM.filter((e) => e.calcule).map((e) => e.libelle)).toEqual(['Grand livre', 'Balance', 'Journaux'])
  })
})

describe('balance', () => {
  it('débit, crédit et solde par compte, triés ; totaux équilibrés', () => {
    const b = balance(traitements)
    expect(b.lignes.map((l) => [l.compte, l.debitCentimes, l.creditCentimes, l.soldeDebiteurCentimes, l.soldeCrediteurCentimes])).toEqual([
      ['TILL.40100.PLOMB.0', 0, 12_000, 0, 12_000],
      ['TILL.45000.00012.0', 80_000, 50_000, 30_000, 0],
      ['TILL.51200.00000.0', 50_000, 0, 50_000, 0],
      ['TILL.61500.00000.0', 12_000, 0, 12_000, 0],
      ['TILL.70100.00000.0', 0, 80_000, 0, 80_000],
    ])
    expect(b.totaux).toEqual({ debitCentimes: 142_000, creditCentimes: 142_000, equilibre: true })
  })

  it('filtre sur une plage de comptes et une période', () => {
    const b = balance(traitements, { compteDu: 'TILL.45000.00000.0', compteAu: 'TILL.51200.ZZZZZ.Z', au: '2026-01-31' })
    expect(b.lignes.map((l) => [l.compte, l.debitCentimes, l.creditCentimes])).toEqual([['TILL.45000.00012.0', 80_000, 0]])
  })

  it('filtre sur les familles de traitement (journaux)', () => {
    expect(balance(traitements, { familles: ['Encaissement'] }).lignes.map((l) => l.compte)).toEqual(['TILL.45000.00012.0', 'TILL.51200.00000.0'])
  })

  it('refuse une période ou une date invalide', () => {
    expect(() => balance(traitements, { du: '2026-03-01', au: '2026-02-01' })).toThrow(/période/i)
    expect(() => balance(traitements, { du: '01/03/2026' })).toThrow(/date/i)
  })
})

describe('grand livre', () => {
  it('report des mouvements antérieurs, mouvements de la période, solde progressif (débit positif)', () => {
    const gl = grandLivre(traitements, { du: '2026-02-01' })
    const copro = gl.find((c) => c.compte === 'TILL.45000.00012.0')
    expect(copro).toEqual({
      compte: 'TILL.45000.00012.0',
      reportCentimes: 80_000,
      mouvements: [{ date: '2026-02-10', traitementId: 't2', famille: 'Encaissement', debitCentimes: 0, creditCentimes: 50_000, soldeCentimes: 30_000 }],
      soldeFinalCentimes: 30_000,
    })
    expect(gl.find((c) => c.compte === 'TILL.70100.00000.0')).toMatchObject({ reportCentimes: -80_000, mouvements: [], soldeFinalCentimes: -80_000 })
  })
})

describe('journal', () => {
  it('liste les traitements de la période dans l’ordre des dates, avec leurs totaux', () => {
    const j = journalDesTraitements([traitements[2], traitements[0], traitements[1]], { du: '2026-01-01', au: '2026-02-28' })
    expect(j.map((e) => [e.date, e.famille, e.totalCentimes, e.mouvements.length])).toEqual([
      ['2026-01-05', 'Appel de fonds', 80_000, 2],
      ['2026-02-10', 'Encaissement', 50_000, 2],
    ])
  })
})
