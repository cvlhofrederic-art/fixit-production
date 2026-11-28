import { describe, expect, it } from 'vitest'
import {
  CATEGORIES_ELEMENT,
  CODES_PROCEDURE_TARIF,
  COMPTES_CHARGE_PAR_DEFAUT,
  NATURES_ELEMENT,
  NATURES_REMUNERATION,
  QUALIFICATIONS_ELEMENT,
  QUALIFICATION_PAR_DEFAUT,
  categorieDe,
  corrigerQuantite,
  creerElement,
  echeancesScenario,
  estFacturable,
  imputerFacture,
  libelleDepuisModele,
  preparerFacture,
  qualificationDe,
  qualifierElement,
  signalerElementsOfferts,
  totalElement,
  validerFacture,
  type CadreFacturation,
  type ElementAFacturer,
  type SaisieElement,
} from '@/lib/administrateur-judiciaire/domain/honoraires-facturation'
import { controlerHonorairesSinistre } from '@/lib/administrateur-judiciaire/domain/honoraires-sinistre'
import { AP_120_LOTS, finDeMission, ordonnance } from './donnees-ordonnances-remuneration'
import { enTeteDuModule } from './en-tete-module'

/**
 * Honoraires : éléments à facturer, factures, scénario de gestion courante (cartographie Gestéam, tranche 27).
 * - Élément : dossier, nature, tarif, mode de calcul (coût unitaire, coût horaire, barème temps), prix HT à 4 décimales.
 * - Facture : regroupe les éléments « A facturer » d'un mandat et d'un destinataire ; Préparation → Validée, non
 *   imputée → Imputée ; l'imputation est un traitement « Imputation des honoraires divers » au compte du SYNDICAT (D1).
 * - Mission judiciaire (J67, R3) : la facture est refusée au-delà de ce que couvrent le droit fixe et les ordonnances.
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

/** Élément créé en mission judiciaire, celle des mandats du cabinet (C. com. L. 811-10 ; J67, R9 et R15). */
const creer = (s: SaisieElement): ElementAFacturer => creerElement(s, 'judiciaire')

/** « Offert » n'est admis qu'au contrat type de syndic (J67, R9). */
const elementOffert = (surcharge: Partial<SaisieElement> = {}): ElementAFacturer =>
  creerElement(saisie({ qualification: 'Offert', ...surcharge }), 'contrat_type_syndic')

/** Élément d'AR non soumis à TVA : 6,15 € HT. */
const ar = (surcharge: Partial<SaisieElement> = {}): ElementAFacturer =>
  creer(saisie({ id: 'el-2', nature: 'AR', tarif: 'Gestion - RAR', soumisTva: false, prixUnitaireHtDixMilliemes: 61_500, ...surcharge }))

const CONTRAT_TYPE: CadreFacturation = { mission: 'contrat_type_syndic' }

const entete = { id: 'f-1', numero: 'H-2026-0001', date: '2026-10-27', mandatId: 'mandat-2026', destinataire: 'Syndicat des copropriétaires' }

const preparer = (elements: ElementAFacturer[], cadre: CadreFacturation = CONTRAT_TYPE, date = entete.date) =>
  preparerFacture(elements, { ...entete, date, cadre })

describe('honoraires — référentiels', () => {
  it('reprend les 15 natures d’éléments et les codes de procédure des tarifs', () => {
    expect(NATURES_ELEMENT).toHaveLength(15)
    expect(NATURES_ELEMENT).toEqual(expect.arrayContaining(['Timbre', 'AR', 'Vacations', 'Honoraires', 'Diffuseur LRE']))
    expect(Object.keys(CODES_PROCEDURE_TARIF)).toEqual(['IP', 'SI', 'SURT', 'RET', 'PROT', 'EXE', 'FSL'])
  })

  it('rémunération et frais (🔵) : trois natures rémunèrent une diligence, les douze autres sont des frais', () => {
    expect(CATEGORIES_ELEMENT).toEqual(['Rémunération', 'Frais'])
    expect(NATURES_REMUNERATION).toEqual(['Vacations', 'Honoraires', 'Prestations'])
    const remuneration = NATURES_ELEMENT.filter((nature) => categorieDe({ nature }) === 'Rémunération')
    const frais = NATURES_ELEMENT.filter((nature) => categorieDe({ nature }) === 'Frais')
    expect(remuneration).toEqual(['Vacations', 'Honoraires', 'Prestations'])
    expect(frais).toHaveLength(12)
    expect(frais).toEqual(expect.arrayContaining(['Timbre', 'AR', 'Copie', 'Envoi de mail', 'Diffuseur AR', 'Diffuseur LRE', 'AR étranger']))
  })
})

describe('honoraires — éléments à facturer', () => {
  it('coût unitaire : quantité × prix HT, TVA, TTC (centimes arrondis)', () => {
    expect(totalElement(creer(saisie({ quantite: 3, prixUnitaireHtDixMilliemes: 12_345 })))).toEqual({
      htCentimes: 370,
      tvaCentimes: 74,
      ttcCentimes: 444,
    })
  })

  it('coût horaire : heures × taux horaire ; barème temps : minutes × taux horaire / 60', () => {
    expect(totalElement(creer(saisie({ calcul: 'Coût horaire', quantite: 1.5, prixUnitaireHtDixMilliemes: 1_200_000 }))).htCentimes).toBe(18_000)
    expect(totalElement(creer(saisie({ calcul: 'Barème temps', quantite: 45, prixUnitaireHtDixMilliemes: 1_200_000 }))).htCentimes).toBe(9_000)
  })

  it('élément non soumis à TVA (débours) : TTC = HT', () => {
    expect(totalElement(creer(saisie({ nature: 'Timbre', soumisTva: false, prixUnitaireHtDixMilliemes: 12_900 })))).toEqual({
      htCentimes: 129,
      tvaCentimes: 0,
      ttcCentimes: 129,
    })
  })

  it('crée l’élément « A facturer » ; refuse dossier, nature, calcul inconnus, quantité nulle, prix négatif, date invalide', () => {
    expect(creer(saisie()).statut).toBe('A facturer')
    expect(() => creer(saisie({ dossier: 'Divers' as never }))).toThrow(/dossier/i)
    expect(() => creer(saisie({ nature: 'Café' as never }))).toThrow(/nature/i)
    expect(() => creer(saisie({ calcul: 'Forfait' as never }))).toThrow(/calcul/i)
    expect(() => creer(saisie({ quantite: 0 }))).toThrow(/quantit/i)
    expect(() => creer(saisie({ prixUnitaireHtDixMilliemes: -1 }))).toThrow(/prix/i)
    expect(() => creer(saisie({ date: '12/10/2026' }))).toThrow(/date/i)
  })
})

describe('honoraires — fiche précise visée par l’élément (point 66, rattachement { type, id } du point 47)', () => {
  it('la fiche est facultative : absente ou null, l’élément se crée comme avant', () => {
    expect(creer(saisie()).fiche).toBeUndefined()
    expect(creer(saisie({ fiche: null })).fiche).toBeNull()
  })

  it('garde la fiche du dossier de l’élément, identifiant nettoyé', () => {
    const element = creer(saisie({ dossier: 'Sinistre', fiche: { type: 'Sinistre', id: '  sin-42 ' } }))
    expect(element.fiche).toEqual({ type: 'Sinistre', id: 'sin-42' })
    expect(element.statut).toBe('A facturer')
  })

  it('refuse une fiche d’un autre dossier, une fiche porteuse, un identifiant vide, un type inconnu', () => {
    expect(() => creer(saisie({ dossier: 'Sinistre', fiche: { type: 'Contentieux', id: 'ctx-1' } }))).toThrow(/dossier de l.élément/i)
    expect(() => creer(saisie({ fiche: { type: 'Copropriété', id: 'copro-tilleuls' } }))).toThrow(/porteuse/i)
    expect(() => creer(saisie({ fiche: { type: 'Entreprise', id: 'ent-1' } }))).toThrow(/porteuse/i)
    expect(() => creer(saisie({ fiche: { type: 'Contentieux', id: '   ' } }))).toThrow(/identifiant/i)
    expect(() => creer(saisie({ fiche: { type: 'Divers' as never, id: 'x' } }))).toThrow(/rattachement inconnu/i)
  })

  it('la facture se prépare de la même façon avec ou sans fiche', () => {
    const elements = [creer(saisie({ fiche: { type: 'Contentieux', id: 'ctx-1' } })), creer(saisie({ id: 'el-2' }))]
    const { facture } = preparer(elements)
    expect(facture.lignes.map((l) => l.elementId)).toEqual(['el-1', 'el-2'])
    expect(facture.totalHtCentimes).toBe(9_000)
  })
})

describe('honoraires — factures', () => {
  const elements = [creer(saisie()), ar(), creer(saisie({ id: 'el-3', mandatId: 'autre-mandat' }))]

  it('prépare une facture avec les éléments à facturer du mandat et du destinataire ; marque les éléments facturés', () => {
    const { facture, elements: apres } = preparer(elements)
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

  it('chaque ligne garde sa TVA : la somme des lignes TTC égale le total de la facture', () => {
    const { facture } = preparer(elements)
    expect(facture.lignes.map((l) => [l.elementId, l.htCentimes, l.tvaCentimes])).toEqual([
      ['el-1', 4_500, 900],
      ['el-2', 615, 0],
    ])
    expect(facture.lignes.reduce((s, l) => s + l.htCentimes + l.tvaCentimes, 0)).toBe(facture.totalTtcCentimes)
  })

  it('refuse une facture sans élément à facturer, ou sans cadre connu', () => {
    expect(() => preparerFacture(elements, { ...entete, mandatId: 'inconnu', cadre: CONTRAT_TYPE })).toThrow(/aucun élément/i)
    expect(() => preparer(elements, { mission: 'forfait' } as never)).toThrow(/cadre/i)
  })
})

describe('honoraires — imputation par catégorie (J67, R10)', () => {
  const IMPUTATION = { traitementId: 't-9', segmentSyndicat: 'TILL', auxiliaireCabinet: 'CABAJ', date: '2026-10-28' }
  const imputer = (elements: ElementAFacturer[], comptesCharge?: Parameters<typeof imputerFacture>[1]['comptesCharge']) =>
    imputerFacture(validerFacture(preparer(elements).facture), { ...IMPUTATION, comptesCharge })

  it('comptes par défaut : rémunération au 62111, frais (débours) au 62120', () => {
    expect(COMPTES_CHARGE_PAR_DEFAUT).toEqual({ Rémunération: '62111', Frais: '62120' })
  })

  it('refuse une facture validée dont le total TTC n’est pas la somme des lignes HT + TVA (traitement non équilibré)', () => {
    const facture = validerFacture(preparer([creer(saisie()), ar()]).facture)
    expect(() => imputerFacture({ ...facture, totalTtcCentimes: facture.totalTtcCentimes + 1 }, IMPUTATION)).toThrow(
      /non équilibré : débit 6015 centimes, crédit 6016 centimes/,
    )
  })

  it('facture mixte : un débit par catégorie, crédit unique du compte fournisseur du cabinet, TTC', () => {
    const { facture } = preparer([creer(saisie()), ar()])
    expect(() => imputerFacture(facture, IMPUTATION)).toThrow(/valid/i)
    const { facture: imputee, traitement } = imputer([creer(saisie()), ar()])
    expect(imputee.statut).toBe('Imputée')
    expect(imputee.lignes.map((l) => l.elementId)).toEqual(['el-1', 'el-2'])
    expect(traitement.famille).toBe('Imputation des honoraires divers')
    expect(traitement.mouvements).toEqual([
      { compte: 'TILL.62111.00000.0', sens: 'debit', montantCentimes: 5_400, traitementId: 't-9' },
      { compte: 'TILL.62120.00000.0', sens: 'debit', montantCentimes: 615, traitementId: 't-9' },
      { compte: 'TILL.40100.CABAJ.0', sens: 'credit', montantCentimes: 6_015, traitementId: 't-9' },
    ])
    expect(() => validerFacture(imputee)).toThrow(/Préparation/)
  })

  it('facture de frais seuls : un seul débit, au compte des frais', () => {
    expect(imputer([ar({ id: 'el-1' })]).traitement.mouvements.map((m) => [m.compte, m.sens, m.montantCentimes])).toEqual([
      ['TILL.62120.00000.0', 'debit', 615],
      ['TILL.40100.CABAJ.0', 'credit', 615],
    ])
  })

  it('comptes réglables par catégorie (une subdivision de 6213 « Frais postaux », par exemple)', () => {
    const comptes = imputer([creer(saisie()), ar()], { Frais: '62130' }).traitement.mouvements.map((m) => m.compte)
    expect(comptes).toEqual(['TILL.62111.00000.0', 'TILL.62130.00000.0', 'TILL.40100.CABAJ.0'])
  })
})

describe('honoraires — qualification de l’élément (point 67 ; Gestéam : « Traitement », tranche 43 § 13)', () => {
  it('trois qualifications Gestéam ; « Facturable » par défaut (tranche 42 : élément créé à l’ouverture d’un sinistre)', () => {
    expect(QUALIFICATIONS_ELEMENT).toEqual(['Facturable', 'Offert', 'Contrôle coûts'])
    expect(QUALIFICATION_PAR_DEFAUT).toBe('Facturable')
  })

  it('qualification absente : l’élément se crée comme avant et vaut « Facturable »', () => {
    const element = creer(saisie())
    expect(element.qualification).toBeUndefined()
    expect(qualificationDe(element)).toBe('Facturable')
    expect(estFacturable(element)).toBe(true)
  })

  it('garde la qualification fournie ; refuse une qualification inconnue', () => {
    const offert = elementOffert()
    expect(offert.qualification).toBe('Offert')
    expect(offert.statut).toBe('A facturer')
    expect(estFacturable(offert)).toBe(false)
    expect(estFacturable(creer(saisie({ qualification: 'Contrôle coûts' })))).toBe(false)
    expect(() => creer(saisie({ qualification: 'Gratuit' as never }))).toThrow(/qualification inconnue/i)
    expect(() => qualificationDe({ qualification: 'Gratuit' as never })).toThrow(/qualification inconnue/i)
  })

  it('requalifie un élément encore « A facturer » sans modifier l’élément reçu ; refuse un élément facturé', () => {
    const element = creer(saisie())
    const offert = qualifierElement(element, 'Offert', 'contrat_type_syndic')
    expect(offert).toEqual({ ...element, qualification: 'Offert' })
    expect(element.qualification).toBeUndefined()
    expect(qualifierElement(offert, 'Facturable', 'contrat_type_syndic').qualification).toBe('Facturable')
    expect(() => qualifierElement({ ...element, statut: 'Facturé' }, 'Offert', 'contrat_type_syndic')).toThrow(/facturé/i)
    expect(() => qualifierElement(element, 'Gratuit' as never, 'contrat_type_syndic')).toThrow(/qualification inconnue/i)
  })

  it('seuls les éléments facturables entrent dans la facture ; offerts et contrôle des coûts restent « A facturer »', () => {
    const elements = [
      creer(saisie()),
      elementOffert({ id: 'el-2' }),
      creer(saisie({ id: 'el-3', qualification: 'Contrôle coûts' })),
      creer(saisie({ id: 'el-4', qualification: 'Facturable', prixUnitaireHtDixMilliemes: 100_000 })),
    ]
    const { facture: preparee, elements: apres } = preparer(elements)
    expect(preparee.lignes.map((l) => l.elementId)).toEqual(['el-1', 'el-4'])
    expect(preparee).toMatchObject({ totalHtCentimes: 5_500, totalTvaCentimes: 1_100, totalTtcCentimes: 6_600 })
    expect(apres.map((e) => [e.id, e.statut, e.qualification])).toEqual([
      ['el-1', 'Facturé', undefined],
      ['el-2', 'A facturer', 'Offert'],
      ['el-3', 'A facturer', 'Contrôle coûts'],
      ['el-4', 'Facturé', 'Facturable'],
    ])
  })

  it('refuse une facture dont tous les éléments du mandat et du destinataire sont offerts ou en contrôle des coûts', () => {
    const elements = [elementOffert(), creer(saisie({ id: 'el-2', qualification: 'Contrôle coûts' }))]
    expect(() => preparer(elements)).toThrow(/aucun élément facturable/i)
  })
})

describe('honoraires — « Offert » refusé en mission judiciaire (J67, R9)', () => {
  const element = creer(saisie())

  it('qualifierElement refuse « Offert » : tracer en Contrôle coûts (règle professionnelle 244.1, lecture prudente)', () => {
    expect(() => qualifierElement(element, 'Offert', 'judiciaire')).toThrow(
      'Qualification « Offert » refusée. Mission judiciaire : tracer en Contrôle coûts ; une remise sur émoluments avant leur arrêté par le juge est à éviter (règle professionnelle 244.1, lecture prudente).',
    )
  })

  it('« Contrôle coûts » et « Facturable » restent admis ; au contrat type, « Offert » aussi', () => {
    expect(qualifierElement(element, 'Contrôle coûts', 'judiciaire').qualification).toBe('Contrôle coûts')
    expect(qualifierElement(element, 'Facturable', 'judiciaire').qualification).toBe('Facturable')
    expect(qualifierElement(element, 'Offert', 'contrat_type_syndic').qualification).toBe('Offert')
  })

  it('creerElement reçoit toujours la mission : « Offert » refusé en mission judiciaire, admis au contrat type', () => {
    expect(() => creer(saisie({ qualification: 'Offert' }))).toThrow(/Offert.*refusée/)
    expect(elementOffert().qualification).toBe('Offert')
    expect(() => creerElement(saisie(), undefined as never)).toThrow(/mission inconnue/i)
    expect(() => qualifierElement(element, 'Offert', 'autre' as never)).toThrow(/mission/i)
  })

  it('corrigerQuantite garde la qualification : un « Offert » déjà enregistré n’est pas changé ; refuse un élément facturé', () => {
    const enregistre = elementOffert({ prixUnitaireHtDixMilliemes: 100_000 })
    const corrige = corrigerQuantite(enregistre, 3)
    expect(corrige).toEqual({ ...enregistre, quantite: 3 })
    expect(enregistre.quantite).toBe(1)
    expect(() => corrigerQuantite({ ...enregistre, statut: 'Facturé' }, 3)).toThrow(/déjà facturé/)
    expect(() => corrigerQuantite(enregistre, 0)).toThrow(/quantit/i)
  })

  it('un élément déjà « Offert » n’est pas changé : il est signalé en mission judiciaire, pas au contrat type', () => {
    const elements = [element, elementOffert({ id: 'el-of' })]
    expect(signalerElementsOfferts(elements, 'judiciaire')).toEqual([
      { elementId: 'el-of', message: expect.stringMatching(/^Élément « Offert » en mission judiciaire : .*244\.1, lecture prudente/) },
    ])
    expect(elements[1].qualification).toBe('Offert')
    expect(signalerElementsOfferts(elements, 'contrat_type_syndic')).toEqual([])
  })
})

describe('honoraires — facture d’une mission judiciaire couverte par les ordonnances (J67, R3)', () => {
  /** Honoraires de ce montant HT (centimes), TVA 20 %. */
  const honoraires = (id: string, htCentimes: number, surcharge: Partial<SaisieElement> = {}): ElementAFacturer =>
    creer(saisie({ id, prixUnitaireHtDixMilliemes: htCentimes * 100, ...surcharge }))
  /** Élément qui facture le droit fixe (J67, R2 et R3) ; 1 500 € HT par défaut. */
  const droitFixe = (id = 'el-df', htCentimes = 150_000): ElementAFacturer =>
    honoraires(id, htCentimes, { dossier: 'Gestion', tarif: 'Gestion - DROIT FIXE', droitFixe: true })
  const judiciaire = (surcharge: Partial<Extract<CadreFacturation, { mission: 'judiciaire' }>> = {}): CadreFacturation => ({
    mission: 'judiciaire',
    mandat: AP_120_LOTS,
    ordonnances: [],
    factures: [],
    ...surcharge,
  })
  /** Facture déjà émise pour le mandat (une autre que f-1). */
  const emise = (elements: ElementAFacturer[], cadre: CadreFacturation, date = '2026-04-01') =>
    preparerFacture(elements, { ...entete, id: 'f-0', numero: 'H-2026-0000', date, cadre }).facture
  const AP_600_LOTS = { regime: 'ap291', nbLots: 600 } as const

  it('AP art. 29-1 de moins de 500 lots, sans ordonnance : l’élément du droit fixe se facture, jusqu’à 1 500 € HT', () => {
    const { couverture, facture } = preparer([droitFixe()], judiciaire(), '2026-04-15')
    expect(couverture).toMatchObject({ emolumentsHtCentimes: 150_000, droitFixeHtCentimes: 150_000, ordonnanceIds: [] })
    expect(facture.lignes).toEqual([expect.objectContaining({ elementId: 'el-df', htCentimes: 150_000, droitFixe: true })])
    const refus = () => preparer([droitFixe('el-df', 150_001)], judiciaire(), '2026-04-15')
    expect(refus).toThrow(/Facture refusée : droit fixe de 1\s500,01\s€ HT au-delà de ce que couvre le droit fixe \(1\s500,00\s€ HT couverts/)
    expect(refus).toThrow(/D\. 1967 art\. 61-1-5/)
  })

  it('le droit fixe ne couvre aucune autre rémunération : une diligence de sinistre sans ordonnance est refusée (J67, R2)', () => {
    const sinistre = honoraires('el-sin', 120_000, {
      dossier: 'Sinistre',
      fiche: { type: 'Sinistre', id: 'sin-42' },
      nature: 'Vacations',
      tarif: 'Sinistre - SINISTRE VACATIONS DEPLACEMENT SUR LES LIEUX',
    })
    // Les deux modules disent la même chose du même élément : à soumettre au juge, pas à facturer au syndicat.
    expect(controlerHonorairesSinistre([sinistre], 'tarif_administrateur_provisoire').map((a) => a.nature)).toEqual(['hors_tarif_ap'])
    const refus = () => preparer([sinistre], judiciaire(), '2026-04-15')
    expect(refus).toThrow(/Facture refusée : rémunération de 1\s200,00\s€ HT au-delà de ce que couvrent les ordonnances \(0,00\s€ HT couverts/)
    expect(refus).toThrow(/Le droit fixe ne couvre que l'élément qui le facture/)
    expect(preparer([sinistre], judiciaire({ ordonnances: [ordonnance()] }), '2026-04-15').facture.totalHtCentimes).toBe(120_000)
  })

  it('le droit fixe : une fois par mandat, à la seule AP de moins de 500 lots, sur une nature de rémunération', () => {
    const premiere = emise([droitFixe('el-df', 100_000)], judiciaire())
    expect(() => preparer([droitFixe('el-df2', 50_000)], judiciaire({ factures: [premiere] }), '2026-04-15')).toThrow(
      /droit fixe se facture une seule fois, pour l'ensemble de la mission \(déjà facturé : facture H-2026-0000\)/,
    )
    expect(() => preparer([droitFixe('el-a', 50_000), droitFixe('el-b', 50_000)], judiciaire(), '2026-04-15')).toThrow(/une seule fois/)
    for (const mandat of [AP_600_LOTS, { regime: 'sj', nbLots: 40 }, { regime: 'ap47', nbLots: 40 }, { regime: null, nbLots: 40 }] as const)
      expect(() => preparer([droitFixe()], judiciaire({ mandat, ordonnances: [ordonnance()] }), '2026-04-15')).toThrow(/droit fixe non dû pour ce mandat/)
    expect(() => creer(saisie({ nature: 'AR', droitFixe: true }))).toThrow(/Droit fixe : la nature « AR » est un frais/)
  })

  it('500 lots et plus, syndic judiciaire, AP art. 47 : rien sans ordonnance (arrêté, art. 3 ; C. com. R. 814-27)', () => {
    for (const mandat of [AP_600_LOTS, { regime: 'sj', nbLots: 40 }, { regime: 'ap47', nbLots: 40 }] as const)
      expect(() => preparer([honoraires('el-1', 100)], judiciaire({ mandat }), '2026-04-15')).toThrow(/C\. com\. R\. 814-27/)
  })

  it('droit fixe et acomptes, chacun pour sa part, moins ce qui est déjà facturé pour le mandat (les autres mandats ne comptent pas)', () => {
    const ordonnances = [ordonnance()]
    const anterieure = emise([droitFixe(), honoraires('el-0', 250_000)], judiciaire({ ordonnances }))
    const autreMandat = { ...anterieure, id: 'f-x', mandatId: 'autre-mandat' }
    const cadre = judiciaire({ ordonnances, factures: [anterieure, autreMandat] })
    expect(preparer([honoraires('el-1', 50_000)], cadre, '2026-04-15').facture.totalHtCentimes).toBe(50_000)
    expect(() => preparer([honoraires('el-1', 50_001)], cadre, '2026-04-15')).toThrow(/3\s000,00\s€ HT couverts au 15\/04\/2026 ; 2\s500,00\s€ HT déjà facturés/)
  })

  it('une facture repréparée sous le même identifiant ne compte pas dans le déjà facturé ; une autre facture, si', () => {
    const premiere = preparer([droitFixe()], judiciaire(), '2026-04-15').facture
    expect(preparer([droitFixe()], judiciaire({ factures: [premiere] }), '2026-04-15').facture.totalHtCentimes).toBe(150_000)
    expect(() => preparer([droitFixe()], judiciaire({ factures: [{ ...premiere, id: 'f-0' }] }), '2026-04-15')).toThrow(/une seule fois/)
  })

  it('fin de mission exécutoire : elle arrête toute la rémunération, le droit fixe déjà facturé s’impute sur elle', () => {
    const cadre = judiciaire({ ordonnances: [finDeMission()], factures: [emise([droitFixe()], judiciaire(), '2026-03-01')] })
    expect(preparer([honoraires('el-1', 450_000)], cadre, '2026-04-11').facture.totalHtCentimes).toBe(450_000)
    expect(() => preparer([honoraires('el-1', 450_001)], cadre, '2026-04-11')).toThrow(/6\s000,00\s€ HT couverts au 11\/04\/2026 ; 1\s500,00\s€ HT déjà facturés/)
  })

  it('frais : couverts par les seuls frais des ordonnances, jamais par le droit fixe', () => {
    expect(() => preparer([ar({ id: 'el-1' })], judiciaire(), '2026-04-15')).toThrow(/Facture refusée : frais de 6,15\s€ HT/)
    expect(preparer([ar({ id: 'el-1' })], judiciaire({ ordonnances: [ordonnance()] }), '2026-04-15').facture.totalTtcCentimes).toBe(615)
  })

  it('fin de mission : refusée pendant le mois de recours, avec le calcul du délai ; ensuite admise, certificat de non-recours conseillé', () => {
    const cadre = judiciaire({ mandat: AP_600_LOTS, ordonnances: [finDeMission()] })
    expect(() => preparer([honoraires('el-1', 600_000)], cadre, '2026-04-10')).toThrow(/délai de recours en cours.*exécutoire à partir du 11\/04\/2026/)
    const { couverture } = preparer([honoraires('el-1', 600_000)], cadre, '2026-04-11')
    expect(couverture?.etats[0].avertissement).toMatch(/certificat de non-recours/)
  })

  it('fin de mission : refusée tant qu’un recours est pendant, ou si la notification n’indique pas le recours', () => {
    const pendant = judiciaire({ mandat: AP_600_LOTS, ordonnances: [finDeMission({ recours: { formeLe: '2026-04-02', decision: null } })] })
    expect(() => preparer([honoraires('el-1', 100)], pendant, '2026-06-01')).toThrow(/pendant, suspensif d'exécution/)
    const sansMention = judiciaire({ mandat: AP_600_LOTS, ordonnances: [finDeMission({ mentionDuRecours: false })] })
    expect(() => preparer([honoraires('el-1', 100)], sansMention, '2026-06-01')).toThrow(/sans la mention de la voie de recours/)
  })

  it('contrat type de syndic : aucun contrôle des ordonnances', () => {
    expect(preparer([honoraires('el-1', 9_000_000)]).couverture).toBeNull()
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

describe('honoraires — en-tête : décisions J67 citées, questions tranchées retirées', () => {
  const { texte, item } = enTeteDuModule('honoraires-facturation')

  it('J67, R10 : rémunération au 62111 (6211), frais au 62120 (6212), comptes réglables ; seul le 6221 reste ouvert', () => {
    const decision = item('- J67, R10')
    for (const reference of ['62111', '6211 « Rémunération du syndic »', '62120', '6212 « Débours »', '6213 « Frais postaux »', 'L. 1965 art. 29-1, I, al. 2', 'arrêté du 14 mars 2005, art. 7 et 8'])
      expect(decision).toContain(reference)
    expect(decision).toMatch(/imputerFacture/)
    expect(texte).not.toMatch(/🔴 \(Frédéric ou le référent métier\) Compte de charge/)
    expect(item('🔴 (comptable du cabinet)')).toMatch(/6221 « Honoraires travaux »/)
  })

  it('J67, R15 : sans objet pour le cabinet (C. com. L. 811-10) ; les fondements lus restent écrits pour le jour où le cadre servirait', () => {
    const decision = item('- J67, R15')
    expect(decision).toMatch(/sans objet pour le cabinet \(C\. com\. L\. 811-10\)/)
    expect(decision).toMatch(/annexe 2/)
    expect(decision).toMatch(/dépassement des horaires et durées[^;]*7\.1\.5/)
    expect(decision).toMatch(/L\. 1965 art\. 10-1, a et b/)
    expect(decision).toMatch(/état daté au plus 380 € TTC/)
    expect(texte).not.toMatch(/🔴 \(Frédéric ou le référent métier\) Gestion syndic/)
  })

  it('J67, R3 et R9 : droit fixe dès que la décision est portée à la connaissance de l’AP, moins de 500 lots ; « Offert » refusé, lecture prudente', () => {
    const r3 = item('- J67, R3')
    expect(r3).toMatch(/dès que la décision de désignation est portée à sa connaissance/)
    expect(r3).toMatch(/moins de 500 lots/)
    expect(r3).toMatch(/C\. pr\. civ\. art\. 714 à 718/)
    expect(r3).toMatch(/ordonnances-remuneration\.ts/)
    expect(r3).toMatch(/Le droit fixe ne couvre que l'élément qui le facture \(champ\s+droitFixe\), une seule fois par mandat/)
    expect(item('- J67, R9')).toMatch(/244\.1.*section sur la concurrence/)
    expect(texte).not.toMatch(/🔴 \(Frédéric ou le référent métier\) Administration provisoire/)
  })
})
