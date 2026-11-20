// Taux de TVA proposés par pays (lib/tva-calculator.ts) — constat de Frédéric du 20/11/2026 : sur /pt, les formulaires
// de devis et de factures proposaient 20 % (taux français) alors qu'au Portugal le taux normal est 23 %, et 6 % sous
// conditions. Une seule liste par pays, reprise par les formulaires artisan et BTP, Fixy, la lecture des factures
// fournisseurs et le devis rapide de l'appli.
import { describe, it, expect } from 'vitest'
import { TAUX_TVA_PROPOSES, htDepuisTtcTauxNormal, localeTva, tauxTvaParDefaut, tauxTvaSelecteur } from '@/lib/tva-calculator'

describe('taux proposés par pays', () => {
  it('Portugal : 23 % par défaut, puis 13, 6 et 0 %, aucun taux français', () => {
    expect(TAUX_TVA_PROPOSES.pt).toEqual([23, 13, 6, 0])
    expect(tauxTvaParDefaut('pt')).toBe(23)
    for (const tauxFrancais of [20, 10, 5.5]) expect(TAUX_TVA_PROPOSES.pt).not.toContain(tauxFrancais)
  })

  it('France : inchangé, 20 % par défaut puis 10, 5,5 et 0 %', () => {
    expect(TAUX_TVA_PROPOSES.fr).toEqual([20, 10, 5.5, 0])
    expect(tauxTvaParDefaut('fr')).toBe(20)
  })

  it('pays des taux : portugais sur l\'interface portugaise seulement (autres langues : comportement antérieur)', () => {
    expect(localeTva('pt')).toBe('pt')
    for (const autre of ['fr', 'en', 'es', 'nl', '', undefined, null]) expect(localeTva(autre)).toBe('fr')
  })
})

describe('sélecteur d\'une ligne', () => {
  it('liste du pays quand la ligne porte un de ses taux (ou aucun)', () => {
    expect(tauxTvaSelecteur('pt', 23)).toEqual([23, 13, 6, 0])
    expect(tauxTvaSelecteur('pt', 6)).toEqual([23, 13, 6, 0])
    expect(tauxTvaSelecteur('pt', 0)).toEqual([23, 13, 6, 0])
    expect(tauxTvaSelecteur('fr', 5.5)).toEqual([20, 10, 5.5, 0])
    expect(tauxTvaSelecteur('fr', undefined)).toEqual([20, 10, 5.5, 0])
    expect(tauxTvaSelecteur('pt', null)).toEqual([23, 13, 6, 0])
  })

  it('ligne enregistrée à un autre taux (20 % sur /pt) : son taux reste proposé, à sa place, pour s\'afficher tel quel', () => {
    expect(tauxTvaSelecteur('pt', 20)).toEqual([23, 20, 13, 6, 0])
    expect(tauxTvaSelecteur('pt', 5.5)).toEqual([23, 13, 6, 5.5, 0])
    expect(tauxTvaSelecteur('fr', 2.1)).toEqual([20, 10, 5.5, 2.1, 0])
  })

  it('taux illisible ignoré ; la liste du pays n\'est jamais modifiée', () => {
    expect(tauxTvaSelecteur('pt', Number.NaN)).toEqual([23, 13, 6, 0])
    tauxTvaSelecteur('pt', 20)
    tauxTvaSelecteur('fr', 2.1)
    expect(TAUX_TVA_PROPOSES).toEqual({ fr: [20, 10, 5.5, 0], pt: [23, 13, 6, 0] })
  })
})

describe('prix saisi toutes taxes comprises (Fixy, motif de l\'appli)', () => {
  it('Portugal : ÷ 1,23 (123 € → 100 € HT) ; France : exactement l\'ancien ÷ 1,2', () => {
    expect(htDepuisTtcTauxNormal(123, 'pt')).toBeCloseTo(100, 10)
    expect(htDepuisTtcTauxNormal(1230, 'pt')).toBeCloseTo(1000, 10)
    for (const ttc of [0, 0.01, 1, 99.99, 120, 123.45, 1500, 98765.43]) expect(htDepuisTtcTauxNormal(ttc, 'fr')).toBe(ttc / 1.2)
  })
})
