import { describe, expect, it } from 'vitest'
import type { FacturationContrat } from '@/lib/administrateur-judiciaire/domain/contrats-facturation'
import {
  identifierPrestataire,
  proposerImputationFacture,
  rapprocherFactureContrat,
  type ContexteRapprochement,
  type ContratRapprochable,
} from '@/lib/administrateur-judiciaire/domain/facture-contrat'
import { proposerImputation, type FactureLue } from '@/lib/administrateur-judiciaire/domain/imputation-facture'

/**
 * Imputation d'une facture depuis son contrat (point 34 du bilan 2 ; Gestéam, tranche 33 : onglet Facturation du contrat,
 * ventilation clé · analytique · libellé ; la facture d'un contrat connu se code sans mots-clés). Le contrat se retrouve par
 * le prestataire (saisi, SIRET, SIREN, nom) et la copropriété, puis se départage par sa référence ou par son prix.
 */

const facturation = (surcharge: Partial<FacturationContrat> = {}): FacturationContrat => ({
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

const facture = (surcharge: Partial<FactureLue> = {}): FactureLue => ({
  fournisseur: 'ASCENSEURS DU SUD SARL',
  siret: '12345678900012',
  numero: 'F-77',
  date: '2026-10-05',
  htCentimes: 107_500,
  tauxTva: 20,
  tvaCentimes: 21_500,
  ttcCentimes: 129_000,
  texte: 'ASCENSEURS DU SUD SARL\nRéparation fuite gaine ascenseur\nTotal TTC 1 290,00',
  ...surcharge,
})

const contrat = (surcharge: Partial<ContratRapprochable> = {}): ContratRapprochable => ({
  id: 'ctr-1',
  prestataireId: 'pr-1',
  coproprieteId: 'copro-tilleuls',
  statut: 'En cours',
  type: 'Maintenance',
  reference: null,
  facturation: facturation(),
  ...surcharge,
})

const prestataires = [
  { id: 'pr-1', nom: 'Ascenseurs du Sud', siret: '123 456 789 00012' },
  { id: 'pr-2', nom: 'Nettoyage Pro SAS', siret: '98765432100019' },
]

const contexte = (surcharge: Partial<ContexteRapprochement> = {}): ContexteRapprochement => ({
  coproprieteId: 'copro-tilleuls',
  prestataires,
  contrats: [contrat()],
  ...surcharge,
})

const cles = ['001 - Charges générales', '002 - Ascenseur']

describe('identifier le prestataire', () => {
  it('par le prestataire saisi, puis le SIRET, le SIREN, enfin le nom sans forme juridique', () => {
    expect(identifierPrestataire(facture(), prestataires, 'pr-2')).toEqual({ prestataireIds: ['pr-2'], identification: 'saisi' })
    expect(identifierPrestataire(facture(), prestataires)).toEqual({ prestataireIds: ['pr-1'], identification: 'siret' })
    expect(identifierPrestataire(facture({ siret: '12345678900099' }), prestataires)).toEqual({ prestataireIds: ['pr-1'], identification: 'siren' })
    expect(identifierPrestataire(facture({ siret: null, fournisseur: 'Ascenseurs du Sud (S.A.R.L.)' }), prestataires)).toEqual({ prestataireIds: ['pr-1'], identification: 'nom' })
    expect(identifierPrestataire(facture({ siret: null, fournisseur: 'Ascenseurs du Sud-Est' }), prestataires)).toEqual({ prestataireIds: [], identification: null })
  })

  it('un prestataire saisi inconnu n’est pas retenu', () => {
    expect(identifierPrestataire(facture(), prestataires, 'pr-9')).toEqual({ prestataireIds: ['pr-1'], identification: 'siret' })
  })

  it('pas de repli sur le nom quand le SIRET de la facture désigne une autre entreprise que celle du prestataire', () => {
    expect(identifierPrestataire(facture({ siret: '55555555500011' }), prestataires)).toEqual({ prestataireIds: [], identification: null })
    // Prestataire sans SIRET connu : le nom suffit.
    expect(identifierPrestataire(facture({ siret: '55555555500011' }), [{ id: 'pr-5', nom: 'Ascenseurs du Sud', siret: null }])).toEqual({ prestataireIds: ['pr-5'], identification: 'nom' })
  })
})

describe('rapprocher la facture d’un contrat', () => {
  it('un seul contrat en cours du prestataire dans la copropriété', () => {
    expect(rapprocherFactureContrat(facture(), contexte())).toEqual({ statut: 'trouve', contratId: 'ctr-1', prestataireId: 'pr-1', identification: 'siret', departage: 'unique' })
  })

  it('autre copropriété, contrat résilié ou plus géré : aucun contrat', () => {
    for (const autre of [contrat({ coproprieteId: 'copro-pins' }), contrat({ statut: 'Résilié' }), contrat({ statut: 'Plus géré' })])
      expect(rapprocherFactureContrat(facture(), contexte({ contrats: [autre] }))).toEqual({ statut: 'aucun', motif: 'aucun_contrat_en_cours', prestataireIds: ['pr-1'] })
    expect(rapprocherFactureContrat(facture({ siret: null, fournisseur: 'Inconnu SA' }), contexte())).toEqual({ statut: 'aucun', motif: 'prestataire_inconnu', prestataireIds: [] })
  })

  it('plusieurs contrats : la référence citée dans la facture départage, puis le prix attendu', () => {
    const deux = [contrat(), contrat({ id: 'ctr-2', reference: 'MAINT-4471', facturation: facturation({ prixOrigineTtcCentimes: 60_000, indice: null, prixDernierTtcCentimes: 60_000 }) })]
    expect(rapprocherFactureContrat(facture({ texte: 'ASCENSEURS DU SUD\nContrat MAINT-4471 — 4e trimestre' }), contexte({ contrats: deux }))).toMatchObject({ statut: 'trouve', contratId: 'ctr-2', departage: 'reference' })
    // Sans référence : seul ctr-1 (prix attendu 129 000) colle au TTC de 129 000.
    expect(rapprocherFactureContrat(facture(), contexte({ contrats: deux }))).toMatchObject({ statut: 'trouve', contratId: 'ctr-1', departage: 'prix' })
    const indiscernables = [contrat(), contrat({ id: 'ctr-3' })]
    expect(rapprocherFactureContrat(facture(), contexte({ contrats: indiscernables }))).toEqual({ statut: 'ambigu', contratIds: ['ctr-1', 'ctr-3'], prestataireId: 'pr-1', identification: 'siret' })
  })

  it('une référence citée seulement dans une autre plus longue : la plus longue l’emporte ; citées toutes deux : le prix départage', () => {
    const deux = [contrat({ reference: 'MAINT-4471' }), contrat({ id: 'ctr-2', reference: 'MAINT-4471-B', facturation: facturation({ prixOrigineTtcCentimes: 60_000, indice: null, prixDernierTtcCentimes: 60_000 }) })]
    expect(rapprocherFactureContrat(facture({ texte: 'ASCENSEURS DU SUD\nContrat MAINT-4471-B' }), contexte({ contrats: deux }))).toMatchObject({ statut: 'trouve', contratId: 'ctr-2', departage: 'reference' })
    const lesDeux = facture({ texte: 'ASCENSEURS DU SUD\nContrat MAINT-4471 : maintenance T4\nContrat MAINT-4471-B : option' })
    expect(rapprocherFactureContrat(lesDeux, contexte({ contrats: deux }))).toMatchObject({ statut: 'trouve', contratId: 'ctr-1', departage: 'prix' })
    const repetee = facture({ ttcCentimes: 63_500, texte: 'ASCENSEURS DU SUD\nRéf. contrat MAINT-4471-B\nMAINT-4471-B Option télésurveillance T4' })
    expect(rapprocherFactureContrat(repetee, contexte({ contrats: deux }))).toMatchObject({ statut: 'trouve', contratId: 'ctr-2', departage: 'reference' })
  })

  it('deux établissements d’une même entreprise (même SIREN) : le prix départage', () => {
    const etablissements = [
      { id: 'pr-1', nom: 'Ascenseurs du Sud', siret: '12345678900020' },
      { id: 'pr-7', nom: 'Ascenseurs du Sud Est', siret: '12345678900038' },
    ]
    const contrats = [contrat(), contrat({ id: 'ctr-7', prestataireId: 'pr-7', facturation: facturation({ prixOrigineTtcCentimes: 60_000, indice: null, prixDernierTtcCentimes: 60_000 }) })]
    expect(rapprocherFactureContrat(facture(), contexte({ prestataires: etablissements, contrats }))).toMatchObject({ statut: 'trouve', contratId: 'ctr-1', identification: 'siren', departage: 'prix' })
  })

  it('un contrat au prix attendu nul ne gagne jamais le départage par le prix', () => {
    const deux = [contrat({ facturation: facturation({ prixOrigineTtcCentimes: 0, prixDernierTtcCentimes: 0, indice: null }) }), contrat({ id: 'ctr-2' })]
    expect(rapprocherFactureContrat(facture(), contexte({ contrats: deux }))).toMatchObject({ statut: 'trouve', contratId: 'ctr-2', departage: 'prix' })
    const zeroSeul = [contrat({ facturation: facturation({ prixOrigineTtcCentimes: 0, prixDernierTtcCentimes: 0, indice: null }) }), contrat({ id: 'ctr-3', facturation: facturation({ prixOrigineTtcCentimes: 10_000, indice: null, prixDernierTtcCentimes: 10_000 }) })]
    expect(rapprocherFactureContrat(facture(), contexte({ contrats: zeroSeul }))).toMatchObject({ statut: 'ambigu' })
  })

  it('deux prestataires de même nom : celui qui a un contrat dans la copropriété ; sinon ambigu', () => {
    const homonymes = [...prestataires, { id: 'pr-3', nom: 'ASCENSEURS DU SUD', siret: null }]
    const f = facture({ siret: null, fournisseur: 'Ascenseurs du Sud' })
    expect(rapprocherFactureContrat(f, contexte({ prestataires: homonymes }))).toMatchObject({ statut: 'trouve', contratId: 'ctr-1', identification: 'nom' })
    expect(rapprocherFactureContrat(f, contexte({ prestataires: homonymes, contrats: [contrat(), contrat({ id: 'ctr-4', prestataireId: 'pr-3' })] }))).toMatchObject({ statut: 'ambigu', prestataireId: null })
    // Prix différents : le prix ne départage pas deux entreprises distinctes.
    const prixDifferents = [contrat(), contrat({ id: 'ctr-4', prestataireId: 'pr-3', facturation: facturation({ prixOrigineTtcCentimes: 60_000, indice: null, prixDernierTtcCentimes: 60_000 }) })]
    expect(rapprocherFactureContrat(f, contexte({ prestataires: homonymes, contrats: prixDifferents }))).toMatchObject({ statut: 'ambigu', contratIds: ['ctr-1', 'ctr-4'] })
    expect(rapprocherFactureContrat(f, contexte({ prestataires: homonymes, contrats: [] }))).toEqual({ statut: 'aucun', motif: 'prestataire_ambigu', prestataireIds: ['pr-1', 'pr-3'] })
  })
})

describe('imputation proposée', () => {
  it('contrat trouvé : sa codification l’emporte sur les mots-clés (« réparation fuite » ne donne pas 61500)', () => {
    const resultat = proposerImputationFacture(facture(), cles, contexte())
    expect(resultat.imputation).toMatchObject({ comptePlan: '61400', cleRepartition: '002 - Ascenseur', certitude: 'contrat', familleAnalytique: '401-449' })
    expect(proposerImputation(facture(), cles).comptePlan).toBe('61500')
    expect(resultat).toMatchObject({ contratId: 'ctr-1', alertes: [], anomaliesContrat: [] })
  })

  it('facture éloignée du prix du contrat : travaux hors contrat probables, mots-clés et décision d’AG gardés, alertes', () => {
    const resultat = proposerImputationFacture(facture({ ttcCentimes: 160_000 }), cles, contexte())
    expect(resultat.anomaliesContrat.map((a) => a.code)).toEqual(['au_dessus_montant_alerte', 'ecart_prix_attendu'])
    expect(resultat.imputation).toEqual(proposerImputation(facture({ ttcCentimes: 160_000 }), cles))
    expect(resultat.alertes.map((a) => a.code)).toEqual(['facture_hors_contrat_possible'])
    const grosTravaux = facture({ ttcCentimes: 1_250_000, texte: 'ASCENSEURS DU SUD\nRéfection complète de la cabine\nTotal TTC 12 500,00' })
    const travaux = proposerImputationFacture(grosTravaux, cles, contexte())
    expect(travaux.imputation).toMatchObject({ comptePlan: '67100', decisionAgRequise: true })
    expect(travaux.alertes.map((a) => a.code)).toEqual(['facture_hors_contrat_possible', 'decision_ag_possible'])
  })

  it('facture éloignée du prix sans autre compte désigné par les mots (révision non saisie) : imputation du contrat gardée, alerte', () => {
    const resultat = proposerImputationFacture(facture({ ttcCentimes: 137_000, texte: 'ASCENSEURS DU SUD\nFacture T4 2026' }), cles, contexte())
    expect(resultat.imputation).toMatchObject({ comptePlan: '61400', cleRepartition: '002 - Ascenseur', certitude: 'contrat' })
    expect(resultat.alertes.map((a) => a.code)).toEqual(['facture_hors_contrat_possible'])
  })

  it('facture au prix du contrat : la décision d’AG du compte du contrat est gardée, même si un mot évoque des travaux', () => {
    const toiture = proposerImputationFacture(facture({ texte: 'ASCENSEURS DU SUD\nEntretien annuel des toitures-terrasses, visite contractuelle' }), cles, contexte())
    expect(toiture.imputation).toMatchObject({ comptePlan: '61400', decisionAgRequise: false })
    expect(toiture.alertes).toEqual([])
  })

  it('montant de la facture illisible : codification du contrat, divergence signalée avec sa cause', () => {
    const resultat = proposerImputationFacture(facture({ ttcCentimes: null }), cles, contexte())
    expect(resultat.imputation).toMatchObject({ comptePlan: '61400', certitude: 'contrat' })
    expect(resultat.alertes).toMatchObject([{ code: 'mots_cles_divergents', message: expect.stringMatching(/^Montant TTC de la facture illisible/) }])
  })

  it('prix du contrat inconnu : codification du contrat, divergence des mots-clés et décision d’AG signalées', () => {
    const sansPrix = contexte({ contrats: [contrat({ facturation: facturation({ prixOrigineTtcCentimes: null, prixDernierTtcCentimes: null, indice: null }) })] })
    const resultat = proposerImputationFacture(facture(), cles, sansPrix)
    expect(resultat.imputation).toMatchObject({ comptePlan: '61400', certitude: 'contrat' })
    expect(resultat.alertes).toMatchObject([{ code: 'mots_cles_divergents', message: expect.stringMatching(/^Prix du contrat inconnu/) }])
    const grosTravaux = facture({ texte: 'ASCENSEURS DU SUD\nRéfection de la cabine\nTotal TTC 1 290,00' })
    const ag = proposerImputationFacture(grosTravaux, cles, sansPrix)
    expect(ag.imputation).toMatchObject({ comptePlan: '61400', decisionAgRequise: true })
    expect(ag.alertes.map((a) => a.code)).toEqual(['mots_cles_divergents', 'decision_ag_possible'])
  })

  it('contrat sans codification : mots-clés, alerte ; clé du contrat absente de la copropriété : gardée, alerte', () => {
    const sansCodif = proposerImputationFacture(facture(), cles, contexte({ contrats: [contrat({ facturation: facturation({ codification: null }) })] }))
    expect(sansCodif.imputation.certitude).toBe('mots_cles')
    expect(sansCodif.alertes.map((a) => a.code)).toEqual(['codification_absente'])
    const cleInconnue = proposerImputationFacture(facture(), ['001 - Charges générales'], contexte())
    expect(cleInconnue.imputation.cleRepartition).toBe('002 - Ascenseur')
    expect(cleInconnue.alertes.map((a) => a.code)).toEqual(['cle_contrat_inconnue'])
  })

  it('sans contrat ou contrat ambigu : résultat identique aux mots-clés, ambiguïté signalée', () => {
    const sans = proposerImputationFacture(facture({ siret: null, fournisseur: 'Inconnu SA' }), cles, contexte())
    expect(sans.imputation).toEqual(proposerImputation(facture({ siret: null, fournisseur: 'Inconnu SA' }), cles))
    expect(sans).toMatchObject({ contratId: null, alertes: [], anomaliesContrat: [] })
    const ambigu = proposerImputationFacture(facture(), cles, contexte({ contrats: [contrat(), contrat({ id: 'ctr-3' })] }))
    expect(ambigu.alertes.map((a) => a.code)).toEqual(['contrat_ambigu'])
    expect(ambigu.imputation.certitude).toBe('mots_cles')
  })
})
