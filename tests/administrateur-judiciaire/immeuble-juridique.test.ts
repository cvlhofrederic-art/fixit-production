import { describe, expect, it } from 'vitest'
import { fusionnerDocuments, lireDocument } from '@/lib/administrateur-judiciaire/domain/import-documents-mandat'
import {
  FAMILLES_DIAGNOSTIC,
  creerDiagnostic,
  echeancesDiagnostics,
  referencesDepuisBrouillon,
} from '@/lib/administrateur-judiciaire/domain/immeuble-juridique'

/**
 * Immeuble — volet juridique (cartographie Gestéam, tranche 28) : cadastre, règlement de copropriété et diagnostics.
 * - Les références lues à l'import de documents (fiche cadastrale, règlement) deviennent des données de l'immeuble.
 * - Les diagnostics suivent les huit familles de Gestéam ; leur date de VALIDITÉ est celle du rapport, saisie :
 *   VitFix ne calcule aucune durée légale de validité.
 * - Seul le diagnostic le plus récent d'un même type compte pour l'échéance.
 */

describe('diagnostics — familles et saisie', () => {
  it('reprend les huit familles de Gestéam', () => {
    expect(Object.values(FAMILLES_DIAGNOSTIC).map((f) => f.libelle)).toEqual([
      'Amiante parties communes',
      'Amiante parties privatives',
      'Termites',
      'Autres risques sanitaires',
      'Plomb',
      "Plomb dans l'eau",
      'Technique, professionnel',
      'Juridique',
    ])
  })

  it('crée un diagnostic valide, type de document nettoyé', () => {
    expect(
      creerDiagnostic({ famille: 'amiante_pc', typeDocument: '  Dossier technique amiante ', date: '2023-05-30', validite: '2031-03-12' }),
    ).toEqual({ famille: 'amiante_pc', typeDocument: 'Dossier technique amiante', date: '2023-05-30', validite: '2031-03-12' })
  })

  it('accepte un diagnostic sans validité (rapport sans échéance)', () => {
    expect(creerDiagnostic({ famille: 'plomb', typeDocument: 'CREP', date: '2020-01-10', validite: null }).validite).toBeNull()
  })

  it('refuse une famille inconnue, une date invalide, une validité antérieure au rapport, un type vide', () => {
    expect(() => creerDiagnostic({ famille: 'radon' as never, typeDocument: 'X', date: '2024-01-01', validite: null })).toThrow(/famille/i)
    expect(() => creerDiagnostic({ famille: 'plomb', typeDocument: 'X', date: '30/05/2023', validite: null })).toThrow(/date/i)
    expect(() => creerDiagnostic({ famille: 'plomb', typeDocument: 'X', date: '2024-01-01', validite: '2023-12-31' })).toThrow(/validit/i)
    expect(() => creerDiagnostic({ famille: 'plomb', typeDocument: '  ', date: '2024-01-01', validite: null })).toThrow(/type/i)
  })
})

describe('diagnostics — échéances au jour donné', () => {
  const diagnostics = [
    creerDiagnostic({ famille: 'termites', typeDocument: 'État parasitaire', date: '2025-11-02', validite: '2026-05-02' }),
    creerDiagnostic({ famille: 'technique', typeDocument: 'DTG', date: '2022-06-01', validite: '2026-12-15' }),
    creerDiagnostic({ famille: 'amiante_pc', typeDocument: 'DTA', date: '2023-05-30', validite: '2031-03-12' }),
    creerDiagnostic({ famille: 'plomb', typeDocument: 'CREP', date: '2020-01-10', validite: null }),
  ]

  it('classe expiré, à renouveler (seuil 90 jours par défaut), valide, sans validité ; tri par échéance', () => {
    expect(echeancesDiagnostics(diagnostics, '2026-10-27').map((e) => [e.typeDocument, e.statut, e.joursRestants])).toEqual([
      ['État parasitaire', 'expire', -178],
      ['DTG', 'a_renouveler', 49],
      ['DTA', 'valide', 1597],
      ['CREP', 'sans_validite', null],
    ])
  })

  it('le seuil « à renouveler » est un réglage de gestion', () => {
    expect(echeancesDiagnostics(diagnostics, '2026-10-27', { seuilJours: 30 }).find((e) => e.typeDocument === 'DTG')?.statut).toBe('valide')
  })

  it('le jour même de la validité, le diagnostic est encore valable (à renouveler)', () => {
    expect(echeancesDiagnostics(diagnostics, '2026-12-15').find((e) => e.typeDocument === 'DTG')).toMatchObject({
      statut: 'a_renouveler',
      joursRestants: 0,
    })
  })

  it('un diagnostic remplacé par un plus récent du même type ne compte plus', () => {
    const avecNouveau = [
      ...diagnostics,
      creerDiagnostic({ famille: 'termites', typeDocument: 'état parasitaire', date: '2026-05-01', validite: '2026-11-01' }),
    ]
    const termites = echeancesDiagnostics(avecNouveau, '2026-10-27').filter((e) => e.famille === 'termites')
    expect(termites).toHaveLength(1)
    expect(termites[0]).toMatchObject({ date: '2026-05-01', statut: 'a_renouveler', joursRestants: 5 })
  })

  it('refuse un jour de référence invalide', () => {
    expect(() => echeancesDiagnostics(diagnostics, '27/10/2026')).toThrow(/date/i)
  })
})

describe('références juridiques depuis les documents importés', () => {
  const REGLEMENT = `RÈGLEMENT DE COPROPRIÉTÉ ET ÉTAT DESCRIPTIF DE DIVISION
Syndicat des copropriétaires de la Résidence Les Tilleuls
Acte reçu le 12 janvier 1954 par Maître Jean Durand, notaire à Lyon
Lot n° 1 : appartement, 120/1000
Lot n° 2 : cave, 5/1000`
  const CADASTRE = `EXTRAIT DU PLAN CADASTRAL
Commune : 69003 LYON
Section AB n° 123 — contenance 12 a 50 ca`

  it('reprend commune, parcelles, date et notaire du règlement', () => {
    const brouillon = fusionnerDocuments([lireDocument('reglement.pdf', REGLEMENT), lireDocument('cadastre.pdf', CADASTRE)])
    expect(referencesDepuisBrouillon(brouillon)).toEqual({
      commune: 'LYON',
      codeCommune: '69003',
      parcelles: [{ section: 'AB', numero: '123', contenanceM2: 1250 }],
      reglement: { date: '1954-01-12', notaire: 'Maître Jean Durand', modificatifs: [], aJourSru: null },
      sources: ['reglement.pdf', 'cadastre.pdf'],
    })
  })

  it('sans règlement importé, le volet règlement reste vide', () => {
    const brouillon = fusionnerDocuments([lireDocument('cadastre.pdf', CADASTRE)])
    expect(referencesDepuisBrouillon(brouillon).reglement).toEqual({ date: null, notaire: null, modificatifs: [], aJourSru: null })
  })
})
