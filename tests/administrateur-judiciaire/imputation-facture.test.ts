import { describe, expect, it } from 'vitest'
import {
  codeFournisseur,
  controlerFacture,
  ecritureFacture,
  lireFacture,
  proposerImputation,
} from '@/lib/administrateur-judiciaire/domain/imputation-facture'

/**
 * Facture fournisseur → lecture, contrôles, codification (compte de charge, famille analytique, clé de répartition)
 * et écriture comptable au journal des achats. Règles locales, sans IA : rien n'est envoyé à l'extérieur.
 */

const FACTURE_PLOMBIER = `PLOMBERIE DUPONT SARL
SIRET 123 456 789 00012
Facture n° F-2026-118 du 14/09/2026
Intervention : réparation fuite colonne d'eau, cage B
Total HT : 480,00 €
TVA 10 % : 48,00 €
Total TTC : 528,00 €`

const CLES = ['001 - Charges communes générales', '002 - Ascenseur', '003 - Chauffage collectif']

describe('lecture de la facture', () => {
  it('lit fournisseur, SIRET, numéro, date et montants en centimes', () => {
    expect(lireFacture(FACTURE_PLOMBIER)).toEqual({
      fournisseur: 'PLOMBERIE DUPONT SARL',
      siret: '12345678900012',
      numero: 'F-2026-118',
      date: '2026-09-14',
      htCentimes: 48_000,
      tauxTva: 10,
      tvaCentimes: 4_800,
      ttcCentimes: 52_800,
      texte: FACTURE_PLOMBIER,
    })
  })

  it('accepte les montants avec espaces, points de milliers et sans symbole', () => {
    const lue = lireFacture('ENTREPRISE X\nFacture N°77 - 02/03/2026\nMontant HT 12 400,00\nTVA (20%) 2.480,00\nNet à payer TTC 14880,00 EUR')
    expect([lue.htCentimes, lue.tauxTva, lue.tvaCentimes, lue.ttcCentimes, lue.numero, lue.date]).toEqual([
      1_240_000, 20, 248_000, 1_488_000, '77', '2026-03-02',
    ])
  })

  it('une information absente vaut null, jamais une valeur inventée', () => {
    const lue = lireFacture('Bonjour,\nveuillez trouver ci-joint')
    expect([lue.siret, lue.numero, lue.date, lue.htCentimes, lue.ttcCentimes]).toEqual([null, null, null, null, null])
  })
})

describe('contrôles', () => {
  it('une facture cohérente et complète ne soulève aucune anomalie', () => {
    expect(controlerFacture(lireFacture(FACTURE_PLOMBIER))).toEqual([])
  })

  it('HT + TVA ≠ TTC, taux inconnu, TVA ≠ HT × taux : anomalies chiffrées', () => {
    const lue = { ...lireFacture(FACTURE_PLOMBIER), ttcCentimes: 53_000, tauxTva: 7 }
    expect(controlerFacture(lue).map((a) => a.code)).toEqual(['total_incoherent', 'taux_tva_inconnu', 'tva_incoherente'])
  })

  it('mentions obligatoires manquantes signalées une à une', () => {
    const codes = controlerFacture(lireFacture('Total TTC : 10,00 €')).map((a) => a.code)
    expect(codes).toEqual(expect.arrayContaining(['numero_manquant', 'date_manquante', 'siret_manquant', 'montant_ht_manquant']))
  })
})

describe('codification : compte, famille analytique, clé de répartition', () => {
  it('réparation de plomberie → 615 entretien et petites réparations, charges générales', () => {
    expect(proposerImputation(lireFacture(FACTURE_PLOMBIER), CLES)).toMatchObject({
      comptePlan: '61500',
      libelleCompte: 'Entretien et petites réparations',
      familleAnalytique: '460-469',
      cleRepartition: '001 - Charges communes générales',
      decisionAgRequise: false,
      certitude: 'mots_cles',
    })
  })

  it('la clé suit l’équipement nommé : ascenseur → clé Ascenseur', () => {
    const lue = lireFacture('ASCENSEURS DU CENTRE\nFacture n° 9 du 01/09/2026\nDépannage ascenseur bât. A\nTotal HT 300,00\nTVA 20 % 60,00\nTotal TTC 360,00')
    expect(proposerImputation(lue, CLES)).toMatchObject({ comptePlan: '61500', cleRepartition: '002 - Ascenseur' })
  })

  it.each([
    ['Fourniture électricité parties communes EDF', '60200', '230-245'],
    ['Contrat de maintenance annuel portes automatiques', '61400', '401-449'],
    ['Prime assurance multirisque immeuble', '61600', '490-499'],
    ['Nettoyage des parties communes - septembre', '61100', '450-456'],
  ])('« %s » → compte %s, famille %s', (libelle, compte, famille) => {
    expect(proposerImputation(lireFacture(`FOURNISSEUR\n${libelle}\nTotal TTC 100,00`), CLES)).toMatchObject({
      comptePlan: compte,
      familleAnalytique: famille,
    })
  })

  it('travaux de ravalement → 671, décision d’AG requise', () => {
    expect(proposerImputation(lireFacture('FACADES & CO\nRavalement de la façade sur rue\nTotal TTC 13 640,00'), CLES)).toMatchObject({
      comptePlan: '67100',
      decisionAgRequise: true,
    })
  })

  it('rien de reconnu → compte à choisir, jamais deviné ; clé par défaut', () => {
    expect(proposerImputation(lireFacture('SOCIETE Y\nPrestation diverse\nTotal TTC 50,00'), CLES)).toMatchObject({
      comptePlan: null,
      certitude: 'a_completer',
      cleRepartition: '001 - Charges communes générales',
    })
  })
})

describe('écriture au journal des achats', () => {
  it('débit charge TTC (TVA non récupérable par le syndicat) / crédit fournisseur, traitement équilibré', () => {
    const lue = lireFacture(FACTURE_PLOMBIER)
    const { traitement, cleRepartition } = ecritureFacture({
      id: 'f1',
      facture: lue,
      imputation: proposerImputation(lue, CLES),
    })
    expect(traitement.famille).toBe('Saisie de factures')
    expect(traitement.date).toBe('2026-09-14')
    expect(traitement.mouvements.map((m) => [m.compte, m.sens, m.montantCentimes])).toEqual([
      ['____.61500.00000.0', 'debit', 52_800],
      ['____.40100.PLOMB.0', 'credit', 52_800],
    ])
    expect(cleRepartition).toBe('001 - Charges communes générales')
  })

  it('refuse sans compte de charge, sans TTC ou sans date', () => {
    const lue = lireFacture(FACTURE_PLOMBIER)
    const imputation = proposerImputation(lue, CLES)
    expect(() => ecritureFacture({ id: 'x', facture: lue, imputation: { ...imputation, comptePlan: null } })).toThrow(/compte/)
    expect(() => ecritureFacture({ id: 'x', facture: { ...lue, ttcCentimes: null }, imputation })).toThrow(/TTC/)
    expect(() => ecritureFacture({ id: 'x', facture: { ...lue, date: null }, imputation })).toThrow(/date/)
  })

  it('code fournisseur : 5 caractères majuscules, sans accent, complété par des 0', () => {
    expect(codeFournisseur('Plomberie Dupont SARL')).toBe('PLOMB')
    expect(codeFournisseur('Élec 2')).toBe('ELEC2')
    expect(codeFournisseur('AB')).toBe('AB000')
  })
})
