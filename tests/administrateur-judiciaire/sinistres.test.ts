import { describe, expect, it } from 'vitest'
import {
  controlerChronologieSinistre,
  creerSinistre,
  etapeSuiviSinistre,
  indemnitesSinistre,
  reperesDelaisSinistre,
  statutSinistre,
  type SaisieSinistre,
} from '@/lib/administrateur-judiciaire/domain/sinistres'

/**
 * Sinistres (cartographie Gestéam, tranches 20 et 28) : fiche, phase déduite des dates, chronologie, indemnités et
 * repères de délais d'assurance.
 * - Type, phase et statut : référentiels Gestéam existants (TYPE_SINISTRE, PHASE_SINISTRE, STATUT_SINISTRE).
 * - L'étape de suivi se lit sur les dates (déclaration → expertise → rapport → règlement → clôture) ; elle ne remplace
 *   pas la phase Gestéam, saisie.
 * - Repères INDICATIFS, jamais présentés comme l'échéance certaine : déclaration dans le délai du contrat, au moins
 *   5 jours ouvrés (2 pour un vol) depuis la connaissance du sinistre (C. assur. art. L. 113-2) ; prescription de
 *   deux ans depuis l'événement (C. assur. art. L. 114-1), interrompue par les causes de l'art. L. 114-2.
 */

const saisie = (surcharge: Partial<SaisieSinistre> = {}): SaisieSinistre => ({
  coproprieteId: 'copro-1',
  type: 'Dégât des eaux',
  phase: null,
  dateSurvenance: '2026-10-27',
  dateConnaissance: null,
  dateDeclaration: null,
  dateExpertise: null,
  dateRapport: null,
  dateReglement: null,
  dateCloture: null,
  partiesCommunesLesees: true,
  partiesCommunesResponsables: false,
  origine: 'Fuite sur colonne d’eau froide',
  lieu: 'Cage B, 3e étage',
  dommages: 'Plafond du palier',
  assurance: { compagnie: null, courtier: null, contrat: null, numeroSinistre: null },
  indemniteImmediateCentimes: 0,
  indemniteImmediateReglee: false,
  indemniteDiffereeCentimes: 0,
  indemniteDiffereeReglee: false,
  causesSupprimees: false,
  reparationsFaites: false,
  ...surcharge,
})

describe('sinistres — types et création', () => {
  it('accepte une phase Gestéam saisie, refuse une phase inconnue', () => {
    expect(creerSinistre(saisie({ phase: "Mission d'expertise" })).phase).toBe("Mission d'expertise")
    expect(() => creerSinistre(saisie({ phase: 'Expertise' as never }))).toThrow(/phase/i)
  })

  it('crée une fiche : textes nettoyés, connaissance = survenance par défaut', () => {
    const sinistre = creerSinistre(saisie({ origine: '  Fuite  ' }))
    expect(sinistre.origine).toBe('Fuite')
    expect(sinistre.dateConnaissance).toBe('2026-10-27')
  })

  it('refuse un type inconnu, une date invalide, un montant non entier', () => {
    expect(() => creerSinistre(saisie({ type: 'Grêle' as never }))).toThrow(/type/i)
    expect(() => creerSinistre(saisie({ dateSurvenance: '27/10/2026' }))).toThrow(/date/i)
    expect(() => creerSinistre(saisie({ dateExpertise: '2026-13-01' }))).toThrow(/date/i)
    expect(() => creerSinistre(saisie({ indemniteDiffereeCentimes: 10.5 }))).toThrow(/montant/i)
  })
})

describe('sinistres — étape de suivi déduite des dates, statut', () => {
  it.each([
    [{}, 'a_declarer'],
    [{ dateDeclaration: '2026-10-28' }, 'declare'],
    [{ dateDeclaration: '2026-10-28', dateExpertise: '2026-11-10' }, 'expertise'],
    [{ dateDeclaration: '2026-10-28', dateExpertise: '2026-11-10', dateRapport: '2026-11-20' }, 'rapport'],
    [{ dateDeclaration: '2026-10-28', dateRapport: '2026-11-20', dateReglement: '2026-12-01' }, 'regle'],
    [{ dateDeclaration: '2026-10-28', dateCloture: '2026-12-15' }, 'clos'],
  ] as const)('%o → %s', (dates, phase) => {
    expect(etapeSuiviSinistre(creerSinistre(saisie(dates)))).toBe(phase)
  })

  it('statut « Terminé » dès que la clôture est datée, sinon « En cours »', () => {
    expect(statutSinistre(creerSinistre(saisie()))).toBe('En cours')
    expect(statutSinistre(creerSinistre(saisie({ dateCloture: '2026-12-15' })))).toBe('Terminé')
  })
})

describe('sinistres — chronologie', () => {
  it('aucune anomalie pour des dates dans l’ordre', () => {
    expect(
      controlerChronologieSinistre(
        creerSinistre(saisie({ dateDeclaration: '2026-10-28', dateExpertise: '2026-11-10', dateRapport: '2026-11-20', dateCloture: '2026-12-15' })),
      ),
    ).toEqual([])
  })

  it('signale une déclaration avant la survenance et une clôture avant le rapport', () => {
    const anomalies = controlerChronologieSinistre(
      creerSinistre(saisie({ dateDeclaration: '2026-10-20', dateRapport: '2026-12-20', dateCloture: '2026-12-15' })),
    )
    expect(anomalies.map((a) => a.champ)).toEqual(['dateDeclaration', 'dateCloture'])
  })
})

describe('sinistres — indemnités', () => {
  it('total, réglé et reste à recevoir en centimes', () => {
    const sinistre = creerSinistre(
      saisie({ indemniteImmediateCentimes: 120_000, indemniteImmediateReglee: true, indemniteDiffereeCentimes: 45_000 }),
    )
    expect(indemnitesSinistre(sinistre)).toEqual({ totalCentimes: 165_000, regleCentimes: 120_000, resteCentimes: 45_000 })
  })
})

describe('sinistres — repères de délais (indicatifs)', () => {
  it('déclaration : 5 jours ouvrés depuis la connaissance ; prescription : 2 ans depuis l’événement', () => {
    expect(reperesDelaisSinistre(creerSinistre(saisie()))).toMatchObject({
      declarationAuPlusTard: '2026-11-03',
      delaiDeclarationJoursOuvres: 5,
      prescription: '2028-10-27',
      declarationTardive: false,
    })
  })

  it('vol : 2 jours ouvrés', () => {
    expect(reperesDelaisSinistre(creerSinistre(saisie({ type: 'Vol' })))).toMatchObject({
      declarationAuPlusTard: '2026-10-29',
      delaiDeclarationJoursOuvres: 2,
    })
  })

  it('les jours fériés ne comptent pas (11 novembre)', () => {
    expect(reperesDelaisSinistre(creerSinistre(saisie({ dateSurvenance: '2026-11-06' }))).declarationAuPlusTard).toBe('2026-11-16')
  })

  it('le délai du contrat remplace le minimum légal s’il est plus long, jamais s’il est plus court', () => {
    const sinistre = creerSinistre(saisie())
    expect(reperesDelaisSinistre(sinistre, { delaiContratJoursOuvres: 10 }).delaiDeclarationJoursOuvres).toBe(10)
    expect(reperesDelaisSinistre(sinistre, { delaiContratJoursOuvres: 3 }).delaiDeclarationJoursOuvres).toBe(5)
  })

  it('part de la connaissance du sinistre quand elle est postérieure à la survenance', () => {
    expect(
      reperesDelaisSinistre(creerSinistre(saisie({ dateConnaissance: '2026-11-02' }))).declarationAuPlusTard,
    ).toBe('2026-11-09')
  })

  it('signale une déclaration faite après le repère, avec les fondements et l’avertissement', () => {
    const reperes = reperesDelaisSinistre(creerSinistre(saisie({ dateDeclaration: '2026-11-05' })))
    expect(reperes.declarationTardive).toBe(true)
    expect(reperes.fondements).toEqual(['C. assur. art. L. 113-2', 'C. assur. art. L. 114-1'])
    expect(reperes.avertissement).toMatch(/indicatif/i)
  })
})
