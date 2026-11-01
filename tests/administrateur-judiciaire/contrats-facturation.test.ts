import { describe, expect, it } from 'vitest'
import {
  controlerFactureContrat,
  dateLimiteResiliation,
  factureEnRetard,
  imputationDepuisContrat,
  prixAttendu,
  prochainTerme,
  type FacturationContrat,
} from '@/lib/administrateur-judiciaire/domain/contrats-facturation'

/**
 * Contrats — reconduction et facturation (cartographie Gestéam, tranche 33 : fiche contrat, onglet Facturation).
 * - Reconduction : date d'effet + durée → terme ; tacite → terme suivant ; préavis → date limite de résiliation.
 * - Prix attendu : prix d'origine révisé par l'indice (valeur actuelle / valeur d'origine), à défaut le dernier prix.
 * - Contrôle d'une facture : au-dessus du montant d'alerte ; écart au prix attendu au-delà d'une tolérance.
 * - Facture en retard : dernière facture + périodicité + tolérance (« facture en retard N jours »).
 * - Codification par défaut du contrat (clé, compte, analytique, libellé), prioritaire sur les mots-clés.
 */

const contrat = (surcharge: Partial<FacturationContrat> = {}): FacturationContrat => ({
  dateEffet: '2024-01-01',
  dureeMois: 12,
  tacite: true,
  preavisMois: 3,
  prixOrigineTtcCentimes: 120_000,
  prixDernierTtcCentimes: 126_000,
  montantAlerteCentimes: 150_000,
  indice: { origine: 100, actuel: 107.5 },
  periodiciteFacturesMois: 3,
  derniereFacture: '2026-07-01',
  retardFactureJours: 10,
  codification: { cleRepartition: '002 - Ascenseur', comptePlan: '61400', analytique: '401', libelle: 'Maintenance ascenseur' },
  ...surcharge,
})

describe('reconduction', () => {
  it('tacite : terme suivant après la date du jour ; sinon le terme initial', () => {
    expect(prochainTerme(contrat(), '2026-10-27')).toBe('2027-01-01')
    expect(prochainTerme(contrat({ tacite: false }), '2026-10-27')).toBe('2025-01-01')
  })

  it('date limite de résiliation = terme − préavis', () => {
    expect(dateLimiteResiliation(contrat(), '2026-10-27')).toBe('2026-10-01')
    expect(dateLimiteResiliation(contrat({ preavisMois: 0 }), '2026-10-27')).toBe('2027-01-01')
  })

  it('refuse une durée nulle ou une date d’effet invalide', () => {
    expect(() => prochainTerme(contrat({ dureeMois: 0 }), '2026-10-27')).toThrow(/durée/i)
    expect(() => prochainTerme(contrat({ dateEffet: '01/01/2024' }), '2026-10-27')).toThrow(/date/i)
  })
})

describe('prix et contrôle de la facture', () => {
  it('prix attendu révisé par l’indice ; à défaut le dernier prix', () => {
    expect(prixAttendu(contrat())).toBe(129_000)
    expect(prixAttendu(contrat({ indice: null }))).toBe(126_000)
  })

  it('facture conforme dans la tolérance', () => {
    expect(controlerFactureContrat(130_000, contrat())).toEqual([])
  })

  it('signale un écart au prix attendu et un dépassement du montant d’alerte', () => {
    expect(controlerFactureContrat(140_000, contrat()).map((a) => a.code)).toEqual(['ecart_prix_attendu'])
    expect(controlerFactureContrat(160_000, contrat()).map((a) => a.code)).toEqual(['au_dessus_montant_alerte', 'ecart_prix_attendu'])
    expect(controlerFactureContrat(140_000, contrat(), { tolerancePct: 10 })).toEqual([])
  })
})

describe('facture en retard', () => {
  it('attendue à la dernière facture + périodicité ; en retard au-delà de la tolérance', () => {
    expect(factureEnRetard(contrat(), '2026-10-05')).toEqual({ attendueLe: '2026-10-01', joursRetard: 4, enRetard: false })
    expect(factureEnRetard(contrat(), '2026-10-27')).toEqual({ attendueLe: '2026-10-01', joursRetard: 26, enRetard: true })
    expect(factureEnRetard(contrat(), '2026-09-15')).toEqual({ attendueLe: '2026-10-01', joursRetard: 0, enRetard: false })
  })

  it('sans dernière facture ni périodicité : rien à contrôler', () => {
    expect(factureEnRetard(contrat({ derniereFacture: null }), '2026-10-27')).toBeNull()
  })
})

describe('codification par le contrat', () => {
  it('reprend la clé, le compte et l’analytique du contrat ; certitude « contrat »', () => {
    expect(imputationDepuisContrat(contrat())).toEqual({
      comptePlan: '61400',
      libelleCompte: 'Maintenance ascenseur',
      familleAnalytique: null,
      rubriqueAnalytique: '401',
      cleRepartition: '002 - Ascenseur',
      decisionAgRequise: false,
      certitude: 'contrat',
    })
  })

  it('sans codification au contrat : null (on retombe sur les mots-clés)', () => {
    expect(imputationDepuisContrat(contrat({ codification: null }))).toBeNull()
  })
})
