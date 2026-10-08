import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AFFECTATION_FONDS_TRAVAUX,
  NATURES_FONDS,
  controlerAffectationFondsTravaux,
  controlerSeuilFondsTravaux,
  creerReglagesFondsTravaux,
  type DecaissementFondsTravaux,
} from '@/lib/administrateur-judiciaire/domain/fonds-travaux'
import { NATURE_PLAN_COMPTABLE } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Décision J4 (Hugo Carvalho, 09/10/2026) — le fonds de travaux.
 * - Le droit (L. 1965 art. 14-2-1) : affectation EXCLUSIVE aux travaux ; aucun solde minimum légal.
 * - Le « Montant bloqué € » de Gestéam (sens DÉDUIT : trésorerie minimale, 5.4.20) est un garde-fou de GESTION,
 *   modifiable : son alerte ne cite jamais un texte de loi.
 * - La vraie règle de droit est le contrôle d'affectation : un décaissement vers une charge courante est refusé.
 */

const decaissement = (surcharge: Partial<DecaissementFondsTravaux>): DecaissementFondsTravaux => ({
  objet: 'travaux_votes_ag',
  montantCentimes: 1_250_000,
  decisionAg: 'AG du 12/03/2026, résolution 8',
  ...surcharge,
})

describe('J4 — cinq natures de fonds, jamais fusionnées', () => {
  it('les cinq natures de fonds sont distinctes et toutes présentes au référentiel du plan', () => {
    expect(NATURES_FONDS).toEqual([
      'Fonds, avance de trésorerie',
      'Fonds de prévoyance',
      'Fonds de réserve',
      'Fonds de solidarité',
      'Fonds travaux',
    ])
    expect(new Set(NATURES_FONDS).size).toBe(5)
    for (const nature of NATURES_FONDS) expect(NATURE_PLAN_COMPTABLE['Copropriété']).toContain(nature)
    // « Comptes bloqués » est une autre nature : le « Montant bloqué » du fonds travaux n'y renvoie pas.
    expect(NATURES_FONDS).not.toContain('Comptes bloqués')
  })
})

describe('J4 — contrôle d’affectation (le droit)', () => {
  it('un décaissement vers une charge courante est refusé, avec son fondement', () => {
    const resultat = controlerAffectationFondsTravaux(decaissement({ objet: 'charges_courantes', decisionAg: null }))
    expect(resultat.autorise).toBe(false)
    expect(resultat.motif).toMatch(/charges courantes/i)
    expect(resultat.fondement).toBe('L. 1965 art. 14-2-1')
  })

  it.each(['charges_courantes', 'compensation_impaye', 'frais_contentieux', 'travaux_privatifs'] as const)(
    '« %s » est exclu du fonds de travaux',
    (objet) => {
      expect(controlerAffectationFondsTravaux(decaissement({ objet })).autorise).toBe(false)
    },
  )

  it('les quatre affectations légales sont admises ; travaux votés et travaux du PPT exigent leur décision d’AG', () => {
    expect(controlerAffectationFondsTravaux(decaissement({})).autorise).toBe(true)
    expect(controlerAffectationFondsTravaux(decaissement({ objet: 'travaux_ppt' })).autorise).toBe(true)
    expect(controlerAffectationFondsTravaux(decaissement({ objet: 'travaux_prescrits', decisionAg: null })).autorise).toBe(true)
    expect(controlerAffectationFondsTravaux(decaissement({ objet: 'travaux_urgents', decisionAg: null })).autorise).toBe(true)
    for (const objet of ['travaux_votes_ag', 'travaux_ppt'] as const) {
      const sansDecision = controlerAffectationFondsTravaux(decaissement({ objet, decisionAg: '  ' }))
      expect(sansDecision.autorise).toBe(false)
      expect(sansDecision.motif).toMatch(/décision d'assemblée/)
    }
  })

  it('le montant doit être en centimes entiers strictement positifs ; un objet inconnu est refusé', () => {
    expect(() => controlerAffectationFondsTravaux(decaissement({ montantCentimes: 10.5 }))).toThrow(/centimes/)
    expect(() => controlerAffectationFondsTravaux(decaissement({ montantCentimes: 0 }))).toThrow(/centimes/)
    // @ts-expect-error — objet hors AFFECTATION_FONDS_TRAVAUX
    expect(() => controlerAffectationFondsTravaux(decaissement({ objet: 'entretien' }))).toThrow(/objet/i)
  })

  it('le référentiel d’affectation sépare les quatre admis des quatre exclus', () => {
    const admis = Object.entries(AFFECTATION_FONDS_TRAVAUX).filter(([, a]) => a.admis).map(([cle]) => cle)
    expect(admis).toEqual(['travaux_prescrits', 'travaux_votes_ag', 'travaux_ppt', 'travaux_urgents'])
    expect(Object.keys(AFFECTATION_FONDS_TRAVAUX)).toHaveLength(8)
  })
})

describe('J4 — « Montant bloqué » : un garde-fou de gestion, pas une règle légale', () => {
  it('par défaut, pas de plancher (0) ; le montant est en centimes entiers, positif ou nul', () => {
    expect(creerReglagesFondsTravaux({})).toEqual({ montantBloqueCentimes: 0 })
    expect(creerReglagesFondsTravaux({ montantBloqueCentimes: 500_000 }).montantBloqueCentimes).toBe(500_000)
    expect(() => creerReglagesFondsTravaux({ montantBloqueCentimes: -1 })).toThrow(/centimes/)
    expect(() => creerReglagesFondsTravaux({ montantBloqueCentimes: 12.5 })).toThrow(/centimes/)
  })

  it('sous le seuil : alerte de gestion ; au-dessus, ou sans seuil : rien', () => {
    const reglages = creerReglagesFondsTravaux({ montantBloqueCentimes: 500_000 })
    expect(controlerSeuilFondsTravaux(499_999, reglages)).toMatchObject({ code: 'sous_montant_bloque', ecartCentimes: 1 })
    expect(controlerSeuilFondsTravaux(500_000, reglages)).toBeNull()
    expect(controlerSeuilFondsTravaux(0, creerReglagesFondsTravaux({}))).toBeNull()
  })

  it('l’alerte de seuil ne cite aucun fondement légal et se dit garde-fou interne', () => {
    const alerte = controlerSeuilFondsTravaux(100, creerReglagesFondsTravaux({ montantBloqueCentimes: 500_000 }))
    expect(alerte?.message).toMatch(/garde-fou de gestion/)
    expect(alerte?.message).toMatch(/aucun texte/)
    expect(alerte?.message).not.toMatch(/\bart\.|article|L\. 1965|loi du/i)
    expect(alerte).not.toHaveProperty('fondement')
  })

  it('le sens du champ est marqué DÉDUIT dans le code, et ses points ouverts restent visibles', () => {
    const source = readFileSync(
      join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'fonds-travaux.ts'),
      'utf8',
    )
    expect(source).toMatch(/DÉDUIT/)
    expect(source).toMatch(/🔴/)
  })
})
