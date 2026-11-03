import { describe, expect, it } from 'vitest'
import {
  CODES_PROCEDURE_TARIF,
  NATURES_ELEMENT,
  creerElement,
  echeancesScenario,
  imputerFacture,
  libelleDepuisModele,
  preparerFacture,
  totalElement,
  validerFacture,
  type SaisieElement,
} from '@/lib/administrateur-judiciaire/domain/honoraires-facturation'

/**
 * Honoraires : éléments à facturer, factures, scénario de gestion courante (cartographie Gestéam, tranche 27).
 * - Élément : dossier, nature, tarif, mode de calcul (coût unitaire, coût horaire, barème temps), prix HT à 4 décimales.
 * - Facture : regroupe les éléments « A facturer » d'un mandat et d'un destinataire ; Préparation → Validée, non
 *   imputée → Imputée ; l'imputation est un traitement « Imputation des honoraires divers » au compte du SYNDICAT (D1).
 * - Scénario de gestion courante : montant périodique, fréquence en mois, libellé-modèle « [Trimestre] [Annee] ».
 */

const saisie = (surcharge: Partial<SaisieElement> = {}): SaisieElement => ({
  id: 'el-1',
  coproprieteId: 'copro-tilleuls',
  mandatId: 'mandat-2026',
  date: '2026-10-12',
  dossier: 'Contentieux',
  nature: 'Honoraires',
  tarif: 'Contentieux - MISE EN DEMEURE',
  calcul: 'Coût unitaire',
  quantite: 1,
  prixUnitaireHtDixMilliemes: 450_000,
  soumisTva: true,
  tauxTvaPct: 20,
  destinataire: 'Syndicat des copropriétaires',
  ...surcharge,
})

describe('honoraires — référentiels', () => {
  it('reprend les 15 natures d’éléments et les codes de procédure des tarifs', () => {
    expect(NATURES_ELEMENT).toHaveLength(15)
    expect(NATURES_ELEMENT).toEqual(expect.arrayContaining(['Timbre', 'AR', 'Vacations', 'Honoraires', 'Diffuseur LRE']))
    expect(Object.keys(CODES_PROCEDURE_TARIF)).toEqual(['IP', 'SI', 'SURT', 'RET', 'PROT', 'EXE', 'FSL'])
  })
})

describe('honoraires — éléments à facturer', () => {
  it('coût unitaire : quantité × prix HT, TVA, TTC (centimes arrondis)', () => {
    expect(totalElement(creerElement(saisie({ quantite: 3, prixUnitaireHtDixMilliemes: 12_345 })))).toEqual({
      htCentimes: 370,
      tvaCentimes: 74,
      ttcCentimes: 444,
    })
  })

  it('coût horaire : heures × taux horaire ; barème temps : minutes × taux horaire / 60', () => {
    expect(totalElement(creerElement(saisie({ calcul: 'Coût horaire', quantite: 1.5, prixUnitaireHtDixMilliemes: 1_200_000 }))).htCentimes).toBe(18_000)
    expect(totalElement(creerElement(saisie({ calcul: 'Barème temps', quantite: 45, prixUnitaireHtDixMilliemes: 1_200_000 }))).htCentimes).toBe(9_000)
  })

  it('élément non soumis à TVA (débours) : TTC = HT', () => {
    expect(totalElement(creerElement(saisie({ nature: 'Timbre', soumisTva: false, prixUnitaireHtDixMilliemes: 12_900 })))).toEqual({
      htCentimes: 129,
      tvaCentimes: 0,
      ttcCentimes: 129,
    })
  })

  it('crée l’élément « A facturer » ; refuse dossier, nature, calcul inconnus, quantité nulle, prix négatif, date invalide', () => {
    expect(creerElement(saisie()).statut).toBe('A facturer')
    expect(() => creerElement(saisie({ dossier: 'Divers' as never }))).toThrow(/dossier/i)
    expect(() => creerElement(saisie({ nature: 'Café' as never }))).toThrow(/nature/i)
    expect(() => creerElement(saisie({ calcul: 'Forfait' as never }))).toThrow(/calcul/i)
    expect(() => creerElement(saisie({ quantite: 0 }))).toThrow(/quantit/i)
    expect(() => creerElement(saisie({ prixUnitaireHtDixMilliemes: -1 }))).toThrow(/prix/i)
    expect(() => creerElement(saisie({ date: '12/10/2026' }))).toThrow(/date/i)
  })
})

describe('honoraires — fiche précise visée par l’élément (point 66, rattachement { type, id } du point 47)', () => {
  it('la fiche est facultative : absente ou null, l’élément se crée comme avant', () => {
    expect(creerElement(saisie()).fiche).toBeUndefined()
    expect(creerElement(saisie({ fiche: null })).fiche).toBeNull()
  })

  it('garde la fiche du dossier de l’élément, identifiant nettoyé', () => {
    const element = creerElement(saisie({ dossier: 'Sinistre', fiche: { type: 'Sinistre', id: '  sin-42 ' } }))
    expect(element.fiche).toEqual({ type: 'Sinistre', id: 'sin-42' })
    expect(element.statut).toBe('A facturer')
  })

  it('refuse une fiche d’un autre dossier, une fiche porteuse, un identifiant vide, un type inconnu', () => {
    expect(() => creerElement(saisie({ dossier: 'Sinistre', fiche: { type: 'Contentieux', id: 'ctx-1' } }))).toThrow(/dossier de l.élément/i)
    expect(() => creerElement(saisie({ fiche: { type: 'Copropriété', id: 'copro-tilleuls' } }))).toThrow(/porteuse/i)
    expect(() => creerElement(saisie({ fiche: { type: 'Entreprise', id: 'ent-1' } }))).toThrow(/porteuse/i)
    expect(() => creerElement(saisie({ fiche: { type: 'Contentieux', id: '   ' } }))).toThrow(/identifiant/i)
    expect(() => creerElement(saisie({ fiche: { type: 'Divers' as never, id: 'x' } }))).toThrow(/rattachement inconnu/i)
  })

  it('la facture se prépare de la même façon avec ou sans fiche', () => {
    const elements = [creerElement(saisie({ fiche: { type: 'Contentieux', id: 'ctx-1' } })), creerElement(saisie({ id: 'el-2' }))]
    const { facture } = preparerFacture(elements, {
      id: 'f-1',
      numero: 'H-2026-0001',
      date: '2026-10-27',
      mandatId: 'mandat-2026',
      destinataire: 'Syndicat des copropriétaires',
    })
    expect(facture.lignes.map((l) => l.elementId)).toEqual(['el-1', 'el-2'])
    expect(facture.totalHtCentimes).toBe(9_000)
  })
})

describe('honoraires — factures', () => {
  const elements = [
    creerElement(saisie()),
    creerElement(saisie({ id: 'el-2', nature: 'AR', tarif: 'Gestion - RAR', soumisTva: false, prixUnitaireHtDixMilliemes: 61_500 })),
    creerElement(saisie({ id: 'el-3', mandatId: 'autre-mandat' })),
  ]

  it('prépare une facture avec les éléments à facturer du mandat et du destinataire ; marque les éléments facturés', () => {
    const { facture, elements: apres } = preparerFacture(elements, {
      id: 'f-1',
      numero: 'H-2026-0001',
      date: '2026-10-27',
      mandatId: 'mandat-2026',
      destinataire: 'Syndicat des copropriétaires',
    })
    expect(facture).toMatchObject({
      statut: 'Préparation',
      type: 'Facture',
      coproprieteId: 'copro-tilleuls',
      lignes: [{ elementId: 'el-1' }, { elementId: 'el-2' }],
      totalHtCentimes: 5_115,
      totalTvaCentimes: 900,
      totalTtcCentimes: 6_015,
      tvaParTaux: [{ tauxPct: 20, baseCentimes: 4_500, tvaCentimes: 900 }],
    })
    expect(apres.map((e) => [e.id, e.statut])).toEqual([
      ['el-1', 'Facturé'],
      ['el-2', 'Facturé'],
      ['el-3', 'A facturer'],
    ])
  })

  it('refuse une facture sans élément à facturer', () => {
    expect(() =>
      preparerFacture(elements, { id: 'f', numero: 'H', date: '2026-10-27', mandatId: 'inconnu', destinataire: 'Syndicat des copropriétaires' }),
    ).toThrow(/aucun élément/i)
  })

  it('valide puis impute : traitement équilibré au compte du syndicat, débit 62111 / crédit fournisseur cabinet, TTC', () => {
    const { facture } = preparerFacture(elements, {
      id: 'f-1',
      numero: 'H-2026-0001',
      date: '2026-10-27',
      mandatId: 'mandat-2026',
      destinataire: 'Syndicat des copropriétaires',
    })
    expect(() => imputerFacture(facture, { traitementId: 't-9', segmentSyndicat: 'TILL', auxiliaireCabinet: 'CABAJ', date: '2026-10-28' })).toThrow(/valid/i)
    const validee = validerFacture(facture)
    expect(validee.statut).toBe('Validée, non imputée')
    const { facture: imputee, traitement } = imputerFacture(validee, { traitementId: 't-9', segmentSyndicat: 'TILL', auxiliaireCabinet: 'CABAJ', date: '2026-10-28' })
    expect(imputee.statut).toBe('Imputée')
    expect(traitement.famille).toBe('Imputation des honoraires divers')
    expect(traitement.mouvements).toEqual([
      { compte: 'TILL.62111.00000.0', sens: 'debit', montantCentimes: 6_015, traitementId: 't-9' },
      { compte: 'TILL.40100.CABAJ.0', sens: 'credit', montantCentimes: 6_015, traitementId: 't-9' },
    ])
    expect(() => validerFacture(imputee)).toThrow(/Préparation/)
  })
})

describe('honoraires — scénario de gestion courante', () => {
  it('libellé-modèle : [Trimestre], [Annee], [Mois]', () => {
    expect(libelleDepuisModele('xN - HONORAIRES SYNDIC [Trimestre] Trim. [Annee]', '2026-10-01')).toBe('xN - HONORAIRES SYNDIC 4 Trim. 2026')
    expect(libelleDepuisModele('Honoraires [Mois]/[Annee]', '2026-03-01')).toBe('Honoraires 03/2026')
  })

  it('échéances à facturer après la dernière facture, jusqu’à la date donnée, dans la période du scénario', () => {
    const scenario = {
      montantTtcCentimes: 60_000,
      frequenceMois: 3,
      debut: '2026-01-01',
      fin: '2026-12-31',
      derniereFacture: '2026-04-01',
      libelleModele: 'HONORAIRES [Trimestre] Trim. [Annee]',
    }
    expect(echeancesScenario(scenario, '2026-12-31')).toEqual([
      { date: '2026-07-01', libelle: 'HONORAIRES 3 Trim. 2026', montantTtcCentimes: 60_000 },
      { date: '2026-10-01', libelle: 'HONORAIRES 4 Trim. 2026', montantTtcCentimes: 60_000 },
    ])
    expect(echeancesScenario({ ...scenario, derniereFacture: null }, '2026-03-31').map((e) => e.date)).toEqual(['2026-01-01'])
  })

  it('refuse une fréquence nulle', () => {
    expect(() =>
      echeancesScenario({ montantTtcCentimes: 1, frequenceMois: 0, debut: '2026-01-01', fin: null, derniereFacture: null, libelleModele: '' }, '2026-12-31'),
    ).toThrow(/fréquence/i)
  })
})
