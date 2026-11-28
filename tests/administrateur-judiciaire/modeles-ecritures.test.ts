import { describe, expect, it } from 'vitest'
import {
  creerModeleEcriture,
  echeancesModele,
  genererTraitementModele,
  type SaisieModeleEcriture,
} from '@/lib/administrateur-judiciaire/domain/modeles-ecritures'

/**
 * Modèles d'écritures (Gestéam, Réglages > 5, tranche 29) : écriture type rejouée par un traitement, à montants fixes
 * ou ventilée en pourcentages d'une base ; périodicité (n mois, jour du mois) ; « hors service » ne se rejoue plus.
 * D1 : les comptes générés portent le segment du syndicat.
 */

const saisie = (surcharge: Partial<SaisieModeleEcriture> = {}): SaisieModeleEcriture => ({
  code: 'ABO-ASC',
  nom: 'Abonnement ascenseur',
  horsService: false,
  famille: 'Saisie de mouvements',
  periodicite: { mois: 3, jour: 5 },
  dernierUsage: '2026-04-05',
  lignes: [
    { compte: '61400', sens: 'debit', montantCentimes: 45_000, tauxPct: null },
    { compte: '40100', auxiliaire: 'ASCEN', sens: 'credit', montantCentimes: 45_000, tauxPct: null },
  ],
  ...surcharge,
})

describe('modèles d’écritures — création', () => {
  it('modèle à montants fixes équilibré', () => {
    expect(creerModeleEcriture(saisie()).mode).toBe('montants')
  })

  it('modèle ventilé : pourcentages de chaque côté = 100', () => {
    const ventile = creerModeleEcriture(
      saisie({
        lignes: [
          { compte: '61500', sens: 'debit', montantCentimes: null, tauxPct: 60 },
          { compte: '61400', sens: 'debit', montantCentimes: null, tauxPct: 40 },
          { compte: '40100', auxiliaire: 'MULTI', sens: 'credit', montantCentimes: null, tauxPct: 100 },
        ],
      }),
    )
    expect(ventile.mode).toBe('ventilation')
  })

  it('refuse : déséquilibre, mélange montants / taux, taux ≠ 100, compte mal formé, famille inconnue, jour > 28', () => {
    expect(() => creerModeleEcriture(saisie({ lignes: [{ compte: '61400', sens: 'debit', montantCentimes: 1, tauxPct: null }, { compte: '40100', sens: 'credit', montantCentimes: 2, tauxPct: null }] }))).toThrow(/équilibr/i)
    expect(() => creerModeleEcriture(saisie({ lignes: [{ compte: '61400', sens: 'debit', montantCentimes: 1, tauxPct: null }, { compte: '40100', sens: 'credit', montantCentimes: null, tauxPct: 100 }] }))).toThrow(/mélange/i)
    expect(() => creerModeleEcriture(saisie({ lignes: [{ compte: '61400', sens: 'debit', montantCentimes: null, tauxPct: 90 }, { compte: '40100', sens: 'credit', montantCentimes: null, tauxPct: 100 }] }))).toThrow(/100/)
    expect(() => creerModeleEcriture(saisie({ lignes: [{ compte: '614', sens: 'debit', montantCentimes: 1, tauxPct: null }, { compte: '40100', sens: 'credit', montantCentimes: 1, tauxPct: null }] }))).toThrow(/compte/i)
    expect(() => creerModeleEcriture(saisie({ famille: 'Inventée' as never }))).toThrow(/famille/i)
    expect(() => creerModeleEcriture(saisie({ periodicite: { mois: 1, jour: 31 } }))).toThrow(/jour/i)
  })
})

describe('modèles d’écritures — échéances et génération', () => {
  it('échéances après le dernier usage, au jour prévu, jusqu’à la date donnée', () => {
    expect(echeancesModele(creerModeleEcriture(saisie()), '2026-12-31')).toEqual(['2026-07-05', '2026-10-05'])
    expect(echeancesModele(creerModeleEcriture(saisie({ periodicite: null })), '2026-12-31')).toEqual([])
  })

  it('génère un traitement équilibré au compte du syndicat (montants fixes)', () => {
    const t = genererTraitementModele(creerModeleEcriture(saisie()), { id: 't-1', date: '2026-07-05', segmentSyndicat: 'TILL' })
    expect(t.famille).toBe('Saisie de mouvements')
    expect(t.mouvements.map((m) => [m.compte, m.sens, m.montantCentimes])).toEqual([
      ['TILL.61400.00000.0', 'debit', 45_000],
      ['TILL.40100.ASCEN.0', 'credit', 45_000],
    ])
  })

  it('ventile une base au centime près (le reste va à la dernière ligne de chaque côté)', () => {
    const modele = creerModeleEcriture(
      saisie({
        lignes: [
          { compte: '61500', sens: 'debit', montantCentimes: null, tauxPct: 33.33 },
          { compte: '61400', sens: 'debit', montantCentimes: null, tauxPct: 66.67 },
          { compte: '40100', auxiliaire: 'MULTI', sens: 'credit', montantCentimes: null, tauxPct: 100 },
        ],
      }),
    )
    const t = genererTraitementModele(modele, { id: 't-2', date: '2026-07-05', segmentSyndicat: 'TILL', baseCentimes: 10_001 })
    expect(t.mouvements.map((m) => m.montantCentimes)).toEqual([3_333, 6_668, 10_001])
    expect(() => genererTraitementModele(modele, { id: 't-3', date: '2026-07-05', segmentSyndicat: 'TILL' })).toThrow(/base/i)
  })

  it('un modèle hors service ne se rejoue pas', () => {
    expect(() => genererTraitementModele(creerModeleEcriture(saisie({ horsService: true })), { id: 't', date: '2026-07-05', segmentSyndicat: 'TILL' })).toThrow(/hors service/i)
  })
})
