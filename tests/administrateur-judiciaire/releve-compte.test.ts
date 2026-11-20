import { describe, expect, it } from 'vitest'
import { validerIban } from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import {
  cleRib,
  composerLibelle,
  compteCorrespond,
  controlerSoldes,
  decimalesDevise,
  formaterMontantMineur,
  LONGUEUR_MAX_LIBELLE,
  montantMajeur,
  type CompteReleve,
} from '@/lib/administrateur-judiciaire/domain/import/releve-compte'

/** Outils communs des relevés structurés (CFONB 120, camt.053) : devises, montants, soldes, compte, libellé. */

const compteRib: CompteReleve = {
  iban: null,
  rib: { banque: '12345', guichet: '00010', numero: '00012345678', cle: '49' },
  autreIdentifiant: null,
  titulaire: null,
}

describe('relevés structurés — devises et montants', () => {
  it('décimales ISO 4217 : 0, 2, 3 ou 4 selon la devise ; 2 par défaut', () => {
    expect(['EUR', 'XPF', 'JPY', 'TND', 'KWD', 'CLF', 'CHF'].map(decimalesDevise)).toEqual([2, 0, 0, 3, 3, 4, 2])
  })

  it('montant décimal dérivé de l’entier, zéro négatif rendu comme zéro', () => {
    expect(montantMajeur(-123_456, 2)).toBe(-1234.56)
    expect(montantMajeur(250_125, 3)).toBe(250.125)
    expect(montantMajeur(175_000, 0)).toBe(175_000)
    expect(Object.is(montantMajeur(-0, 2), 0)).toBe(true)
  })

  it('formate en groupes de trois chiffres avec la devise', () => {
    expect(formaterMontantMineur(123_456_789, 2, 'EUR')).toBe('1 234 567,89 EUR')
    expect(formaterMontantMineur(-5, 2, 'EUR')).toBe('-0,05 EUR')
    expect(formaterMontantMineur(175_000, 0, 'XPF')).toBe('175 000 XPF')
    expect(formaterMontantMineur(750_375, 3, 'TND')).toBe('750,375 TND')
    expect(formaterMontantMineur(0, 2, 'EUR')).toBe('0,00 EUR')
  })
})

describe('relevés structurés — contrôle des soldes', () => {
  const releve = (soldeClotureMineur: number) => ({
    soldeOuvertureMineur: 10_000,
    soldeClotureMineur,
    devise: 'EUR',
    decimales: 2,
    mouvements: [{ montantMineur: 2_500 }, { montantMineur: -1_000 }],
  })

  it('ancien solde + mouvements = nouveau solde, sinon le motif chiffré du refus', () => {
    expect(controlerSoldes(releve(11_500))).toBeNull()
    expect(controlerSoldes(releve(11_400))).toBe(
      'ancien solde 100,00 EUR + mouvements 15,00 EUR = 115,00 EUR, mais nouveau solde annoncé 114,00 EUR (écart 1,00 EUR).',
    )
  })

  it('refuse des sommes hors des entiers exacts', () => {
    expect(controlerSoldes({ ...releve(0), mouvements: [{ montantMineur: Number.MAX_SAFE_INTEGER }, { montantMineur: 10 }] })).toMatch(
      /limites de calcul exact/,
    )
  })
})

describe('relevés structurés — compte du relevé', () => {
  it('clé RIB calculée, lettres du numéro de compte converties', () => {
    expect(cleRib('30002', '00550', '0000157841Z')).toBe('25')
    expect(cleRib('12345', '00010', '00012345678')).toBe('49')
    expect(cleRib('99999', '00020', '0000ABC1234')).toBe('82')
  })

  it('rapproche un RIB d’un IBAN français ou monégasque, un IBAN lu d’un IBAN, espaces et casse ignorés', () => {
    expect(validerIban('FR7612345000100001234567849')).toBe(true)
    expect(compteCorrespond(compteRib, 'FR76 1234 5000 1000 0123 4567 849')).toBe(true)
    expect(compteCorrespond(compteRib, 'FR7612345000100008765432121')).toBe(false)
    expect(compteCorrespond(compteRib, 'DE89370400440532013000')).toBe(false)
    expect(compteCorrespond({ ...compteRib, rib: null, iban: 'FR7612345000100001234567849' }, 'fr76 1234 5000 1000 0123 4567 849')).toBe(true)
    expect(compteCorrespond({ ...compteRib, rib: null, autreIdentifiant: 'X' }, 'FR7612345000100001234567849')).toBe(false)
  })
})

describe('relevés structurés — libellé', () => {
  it('morceaux sans répétition, contrepartie ajoutée seulement si un de ses mots manque', () => {
    expect(composerLibelle(['VIR SEPA RECU /DE DURAND CLAIRE', '  APPEL  T4 ', 'appel t4'], 'Durand Claire')).toEqual({
      libelle: 'VIR SEPA RECU /DE DURAND CLAIRE APPEL T4',
      tronque: false,
    })
    expect(composerLibelle(['VIR SEPA RECU'], 'DURAND CLAIRE').libelle).toBe('VIR SEPA RECU DURAND CLAIRE')
    expect(composerLibelle([null, '', undefined], null)).toEqual({ libelle: '(sans libellé)', tronque: false })
    expect(composerLibelle([], 'MARTIN PAUL').libelle).toBe('MARTIN PAUL')
  })

  it('libellé borné : au-delà de 1 000 caractères les textes suivants sont omis, la contrepartie reste ajoutée', () => {
    expect(LONGUEUR_MAX_LIBELLE).toBe(1_000)
    const long = composerLibelle(['A'.repeat(5_000), 'SUITE'], 'DURAND CLAIRE')
    expect(long).toEqual({ libelle: `${'A'.repeat(1_000)} DURAND CLAIRE`, tronque: true })
    const pile = composerLibelle(['X'.repeat(995), 'APPEL T4'], null)
    expect(pile).toEqual({ libelle: `${'X'.repeat(995)} APPE`, tronque: true })
    expect(composerLibelle(['X'.repeat(999), 'Y'], null)).toEqual({ libelle: 'X'.repeat(999), tronque: true })
    expect(composerLibelle(['X'.repeat(998), 'Y'], null)).toEqual({ libelle: `${'X'.repeat(998)} Y`, tronque: false })
  })

  it('temps linéaire : 20 000 morceaux distincts ou répétés lus en moins d’une seconde (fichier hostile)', () => {
    const distincts = Array.from({ length: 20_000 }, (_, rang) => `APPEL ${rang}`),
      debut = performance.now(),
      compose = composerLibelle(distincts, 'DURAND CLAIRE'),
      repetes = composerLibelle(Array.from({ length: 20_000 }, (_, rang) => (rang % 2 ? 'appel  t4' : 'APPEL T4')), null)
    expect(performance.now() - debut).toBeLessThan(1_000)
    expect(compose.tronque).toBe(true)
    expect(compose.libelle.length).toBeLessThanOrEqual(LONGUEUR_MAX_LIBELLE + ' DURAND CLAIRE'.length)
    expect(compose.libelle).toMatch(/^APPEL 0 APPEL 1 APPEL 2 .* DURAND CLAIRE$/)
    expect(repetes).toEqual({ libelle: 'APPEL T4', tronque: false })
  })
})
