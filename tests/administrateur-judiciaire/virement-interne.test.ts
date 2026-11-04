import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { annulerTraitement } from '@/lib/administrateur-judiciaire/domain/traitements'
import { controlerRangsDuLot, emettreOrdreConstate } from '@/lib/administrateur-judiciaire/domain/types-ordres-banque'
import * as moduleVirement from '@/lib/administrateur-judiciaire/domain/virement-interne'
import {
  creerLotVirementsInternes,
  creerVirementInterne,
  emettreLotVirementsInternes,
  fichierVirementInterne,
  mouvementFondsTravaux,
  mouvementsVirementInterne,
  ordresDuLotVirementsInternes,
  recomposerLotVirementsInternes,
  traitementVirementsInternes,
  type CompteVirementInterne,
  type SaisieVirementDuLot,
  type SaisieVirementInterne,
  type VirementInterne,
} from '@/lib/administrateur-judiciaire/domain/virement-interne'

/**
 * Virement de banque à banque entre comptes du syndicat (point 39 du bilan 2 ; Gestéam, tranche 43 § 12 : traitement
 * distinct « Règlement de banque à banque », par exemple du compte courant vers le compte du fonds de travaux).
 * D-BANQUE : le compte du fonds de travaux est toujours distinct. Données fictives.
 */

const SEGMENT = 'TILL'
const IBAN_COURANT = 'FR76 3000 6000 0112 3456 7890 189'
const IBAN_FONDS = 'FR14 2004 1010 0505 0001 3M02 606'
const IBAN_REPRIS = 'FR76 3000 4000 0312 3456 7890 143'
const IBAN_PLACEMENT = 'FR37 1027 8060 0000 0204 2010 154'

const compte = (surcharge: Partial<CompteVirementInterne> = {}): CompteVirementInterne => ({
  banqueId: 'b-courant',
  coproprieteId: 'copro-tilleuls',
  nature: 'courant',
  iban: IBAN_COURANT,
  bic: 'AGRIFRPP',
  compte512: 'TILL.51200.00000.0',
  actif: true,
  ...surcharge,
})
const COURANT = compte()
const FONDS = compte({ banqueId: 'b-fonds', nature: 'fonds_travaux', iban: IBAN_FONDS, bic: 'PSSTFRPP', compte512: 'TILL.51210.00000.0' })
const FONDS_CDC = compte({ banqueId: 'b-fonds-cdc', nature: 'fonds_travaux', iban: null, bic: null, compte512: 'TILL.51220.00000.0' })
const REPRIS = compte({ banqueId: 'b-repris', nature: 'repris_ancien_gestionnaire', iban: IBAN_REPRIS, compte512: 'TILL.51290.00000.0' })
const PLACEMENT = compte({ banqueId: 'b-placement', nature: 'placement', iban: IBAN_PLACEMENT, compte512: 'TILL.51230.00000.0' })
/** Ancien compte du fonds de travaux, repris de l'ancien gestionnaire. */
const REPRIS_FONDS: CompteVirementInterne = { ...REPRIS, banqueId: 'b-repris-fonds', compte512: 'TILL.51291.00000.0', tenaitFondsTravaux: true }

/** Saisie d'un virement sans sa place dans le lot (traitement, rang, taille du lot). */
const BASE: SaisieVirementDuLot = {
  id: 'vi-1',
  numero: 'BAB-0001',
  date: '2026-10-29',
  coproprieteId: 'copro-tilleuls',
  mandatId: 'm-1',
  source: COURANT,
  destination: FONDS,
  montantCentimes: 250_000,
  libelle: 'Cotisations fonds de travaux T4',
}
const saisieDuLot = (surcharge: Partial<SaisieVirementDuLot> = {}): SaisieVirementDuLot => ({ ...BASE, ...surcharge })
/** Saisie unitaire : virement seul de son lot (rang 1, lot de 1), sauf surcharge. */
const saisie = (surcharge: Partial<SaisieVirementInterne> = {}): SaisieVirementInterne => ({
  ...BASE,
  traitementId: 't-bab-1',
  rang: 1,
  nombreOrdresDuLot: 1,
  ...surcharge,
})
const creer = (surcharge: Partial<SaisieVirementInterne> = {}) => creerVirementInterne(saisie(surcharge), { segmentSyndicat: SEGMENT })
/** Émission d'un lot, le 30/10/2026, journal vide et aucun virement connu, sauf surcharge. */
const emettreLot = (lot: VirementInterne[], options: Partial<Parameters<typeof emettreLotVirementsInternes>[1]> = {}) =>
  emettreLotVirementsInternes(lot, { dateEmission: '2026-10-30', journal: [], virementsConnus: [], ...options })
/** Émission d'un virement seul de son lot (lot de un). */
const emis = (v: VirementInterne) => emettreLot([v])[0]
/** Virement émis relu tel quel (stockage), sans passer par emettreLotVirementsInternes : l'écriture refait les contrôles. */
const relu = (v: VirementInterne): VirementInterne => ({ ...v, statut: 'Émis', dateEmission: '2026-10-30' })
const AU_30 = { id: 't-bab-1', date: '2026-10-30', journal: [] }

/** Sortie du fonds de travaux vers le compte courant (paiement de travaux). */
const sortie = (emploiFondsTravaux: SaisieVirementInterne['emploiFondsTravaux']) =>
  creer({ source: FONDS, destination: COURANT, libelle: 'Travaux du plan, tranche 1', emploiFondsTravaux })

describe('sens du virement au regard du fonds de travaux', () => {
  it('alimentation, sortie, changement de compte du fonds, ou aucun', () => {
    expect(mouvementFondsTravaux(COURANT, FONDS)).toBe('alimentation')
    expect(mouvementFondsTravaux(FONDS, COURANT)).toBe('sortie')
    expect(mouvementFondsTravaux(FONDS, FONDS_CDC)).toBe('changement_de_compte')
    expect(mouvementFondsTravaux(REPRIS, COURANT)).toBe('aucun')
  })

  it('🔵 ancien compte du fonds repris : un compte du fonds (sortie vers le compte courant, changement de compte vers le fonds)', () => {
    expect(mouvementFondsTravaux(REPRIS_FONDS, COURANT)).toBe('sortie')
    expect(mouvementFondsTravaux(REPRIS_FONDS, { nature: 'sous_compte_centralisateur' })).toBe('sortie')
    expect(mouvementFondsTravaux(REPRIS_FONDS, FONDS)).toBe('changement_de_compte')
  })
})

describe('alimentation du fonds de travaux depuis le compte courant (L. 1965 art. 18, II, al. 4)', () => {
  it('🟢 admise sans condition : virement enregistré, non émis, non imputé, sans tiers', () => {
    const v = creer()
    expect(v).toMatchObject({
      type: 'Virement interne',
      famille: 'Règlement de banque à banque',
      mouvementFondsTravaux: 'alimentation',
      affectation: null,
      emploiFondsTravaux: null,
      decisionPlacement: null,
      statut: 'Enregistré',
      dateEmission: null,
      impute: false,
    })
    expect(v).not.toHaveProperty('tiers')
  })

  it('écriture : débit du 512 de destination, crédit du 512 de source, montant brut', () => {
    expect(mouvementsVirementInterne(creer())).toEqual([
      { compte: 'TILL.51210.00000.0', sens: 'debit', montantCentimes: 250_000 },
      { compte: 'TILL.51200.00000.0', sens: 'credit', montantCentimes: 250_000 },
    ])
  })

  it('traitement « Règlement de banque à banque » équilibré après émission ; le virement devient imputé', () => {
    const { traitement, virements } = traitementVirementsInternes([emis(creer())], AU_30)
    expect(traitement).toMatchObject({ id: 't-bab-1', famille: 'Règlement de banque à banque', date: '2026-10-30' })
    expect(traitement.mouvements.map((m) => [m.compte, m.sens, m.traitementId])).toEqual([
      ['TILL.51210.00000.0', 'debit', 't-bab-1'],
      ['TILL.51200.00000.0', 'credit', 't-bab-1'],
    ])
    expect(virements[0]).toMatchObject({ impute: true, statut: 'Émis' })
  })
})

describe('sortie du fonds de travaux : décision d’affectation ou ordonnance (L. 1965 art. 14-2-1, I ; art. 29-14, 2°)', () => {
  it('🔵 sans emploi rattaché : refusée', () => {
    expect(() => sortie(null)).toThrow(/14-2-1/)
    expect(() => sortie(undefined)).toThrow(/décision d'affectation/)
  })

  it('travaux du plan avec décision d’assemblée : admise, contrôle d’affectation conservé', () => {
    const v = sortie({ objet: 'travaux_ppt', decisionAg: 'AG du 12/06/2026, résolution 14' })
    expect(v.mouvementFondsTravaux).toBe('sortie')
    expect(v.affectation).toMatchObject({ autorise: true, cause: 'admis' })
    expect(v.emploiFondsTravaux).toEqual({ objet: 'travaux_ppt', decisionAg: 'AG du 12/06/2026, résolution 14' })
  })

  it('travaux urgents sans décision, charges courantes : refusées', () => {
    expect(() => sortie({ objet: 'travaux_urgents', decisionAg: null })).toThrow(/décision d'assemblée/)
    expect(() => sortie({ objet: 'charges_courantes', decisionAg: 'AG du 12/06/2026' })).toThrow(/exclue/)
  })

  it('administration provisoire : gestion courante sur ordonnance du juge (art. 29-14, 2°)', () => {
    expect(() => sortie({ objet: 'redressement_29_14', decisionAg: null })).toThrow(/ordonnance/)
    const v = sortie({ objet: 'redressement_29_14', decisionAg: null, autorisationJuge: 'Ordonnance du 02/09/2026' })
    expect(v.affectation?.fondement).toContain('29-14')
  })

  it('🔴 vers un compte de placement : refusée (aucun texte lu), même avec emploi admis et décision de placement', () => {
    const versPlacement = () =>
      creer({ source: FONDS, destination: PLACEMENT, emploiFondsTravaux: { objet: 'travaux_ppt', decisionAg: 'AG' }, decisionPlacement: 'AG du 12/06/2026, résolution 9' })
    expect(versPlacement).toThrow(/Fonds de travaux vers un compte de placement : refusé/)
    expect(versPlacement).toThrow(/à trancher/)
  })

  it('un emploi rattaché à un virement qui ne sort pas du fonds : refusé (sens à vérifier)', () => {
    expect(() => creer({ emploiFondsTravaux: { objet: 'travaux_ppt', decisionAg: 'AG' } })).toThrow(/ne sort pas du fonds/)
  })
})

describe('changement de compte du fonds de travaux', () => {
  it('🔵 vers un autre compte du fonds (par exemple à la Caisse des dépôts) : admis sans décision', () => {
    expect(creer({ source: FONDS, destination: FONDS_CDC })).toMatchObject({ mouvementFondsTravaux: 'changement_de_compte', affectation: null })
  })
})

describe('comptes du virement', () => {
  it('fonds de travaux et autre compte sur un même IBAN : refusé (L. 1965 art. 18, II, al. 4)', () => {
    expect(() => creer({ destination: { ...FONDS, iban: IBAN_COURANT } })).toThrow(/18, II, al\. 4/)
  })

  it('deux comptes sur un même IBAN, un même compte, un même 512 : refusés', () => {
    expect(() => creer({ destination: { ...PLACEMENT, iban: IBAN_COURANT }, decisionPlacement: 'AG' })).toThrow(/même IBAN/)
    expect(() => creer({ destination: { ...FONDS, banqueId: 'b-courant' } })).toThrow(/même compte/)
    expect(() => creer({ destination: { ...FONDS, compte512: 'TILL.51200.00000.0' } })).toThrow(/même compte 512/)
  })

  it('compte d’un autre syndicat : refusé (D1) ; une avance de fonds n’est pas un virement interne', () => {
    expect(() => creer({ source: { ...COURANT, coproprieteId: 'cabinet' } })).toThrow(/autre syndicat.*18, II, dernier al\./)
  })

  it('🟢 avance de fonds : interdite au syndic, sauf syndic provisoire et administrateur provisoire des art. 29-1 et 29-11', () => {
    const apport = () => creer({ source: { ...COURANT, coproprieteId: 'cabinet' } })
    expect(apport).toThrow(/le syndic ne peut en faire, sauf le syndic provisoire et l'administrateur provisoire désigné en application des art\. 29-1 et 29-11/)
    expect(apport).not.toThrow(/encaissement avec tiers/)
  })

  it('compte inactif, nature inconnue, IBAN invalide, 512 mal formé ou d’un autre segment : refusés', () => {
    expect(() => creer({ destination: { ...FONDS, actif: false } })).toThrow(/inactif/)
    expect(() => creer({ destination: { ...FONDS, nature: 'livret' as never } })).toThrow(/nature inconnue/)
    expect(() => creer({ destination: { ...FONDS, iban: 'FR14 2004 1010 0505 0001 3M02 607' } })).toThrow(/IBAN invalide/)
    expect(() => creer({ destination: { ...FONDS, compte512: 'TILL.40100.00000.0' } })).toThrow(/512/)
    expect(() => creer({ destination: { ...FONDS, compte512: 'AUTR.51210.00000.0' } })).toThrow(/segment « TILL »/)
  })

  it('🔵 compte repris de l’ancien gestionnaire : se solde vers le compte du mandat, jamais alimenté', () => {
    expect(creer({ source: REPRIS, destination: COURANT, libelle: 'Solde du compte repris' }).mouvementFondsTravaux).toBe('aucun')
    expect(() => creer({ source: COURANT, destination: REPRIS })).toThrow(/repris/)
  })

  it('🔵 ancien compte du fonds repris : son solde reste au fonds, ou en sort sous contrôle d’affectation (L. 1965 art. 18, II, al. 4)', () => {
    const solde = (surcharge: Partial<SaisieVirementInterne>) => creer({ source: REPRIS_FONDS, libelle: 'Solde de l’ancien compte du fonds', ...surcharge })
    expect(() => solde({ destination: COURANT })).toThrow(/Sortie du fonds de travaux.*14-2-1/)
    expect(() => solde({ destination: compte({ banqueId: 'b-centr', nature: 'sous_compte_centralisateur', iban: null, compte512: 'TILL.51250.00000.0' }) })).toThrow(/14-2-1/)
    expect(() => solde({ destination: PLACEMENT, decisionPlacement: 'AG' })).toThrow(/Fonds de travaux vers un compte de placement : refusé/)
    expect(solde({ destination: FONDS })).toMatchObject({ mouvementFondsTravaux: 'changement_de_compte', affectation: null })
    const sortieAdmise = solde({ destination: COURANT, emploiFondsTravaux: { objet: 'travaux_ppt', decisionAg: 'AG du 12/06/2026, résolution 14' } })
    expect(sortieAdmise).toMatchObject({ mouvementFondsTravaux: 'sortie', affectation: { autorise: true } })
    expect(() => creer({ destination: REPRIS_FONDS })).toThrow(/repris/)
  })

  it('« tenait le fonds de travaux » sur un compte qui n’est pas repris : refusé', () => {
    expect(() => creer({ source: { ...COURANT, tenaitFondsTravaux: true } })).toThrow(/seul un compte repris/)
    expect(() => creer({ destination: { ...FONDS, tenaitFondsTravaux: true } })).toThrow(/seul un compte repris/)
  })
})

describe('placement des fonds (D. 1967 art. 35-1)', () => {
  it('🔵 vers un compte de placement : décision de l’assemblée (ou ordonnance qui en confie le pouvoir) exigée', () => {
    expect(() => creer({ destination: PLACEMENT })).toThrow(/35-1/)
    expect(creer({ destination: PLACEMENT, decisionPlacement: ' AG du 12/06/2026, résolution 9 ' }).decisionPlacement).toBe('AG du 12/06/2026, résolution 9')
  })

  it('retour du placement vers le compte courant : admis ; décision de placement sans placement : refusée', () => {
    expect(creer({ source: PLACEMENT, destination: COURANT }).decisionPlacement).toBeNull()
    expect(() => creer({ decisionPlacement: 'AG' })).toThrow(/sans compte de placement/)
  })
})

describe('saisie', () => {
  it('montant, date, libellé, syndicat, mandat, numéro, traitement : contrôlés', () => {
    expect(() => creer({ montantCentimes: 10.5 })).toThrow(/Montant/)
    expect(() => creer({ montantCentimes: 0 })).toThrow(/Montant/)
    expect(() => creer({ date: '29/10/2026' })).toThrow(/Date/)
    expect(() => creer({ libelle: ' ' })).toThrow(/Libellé/)
    expect(() => creer({ coproprieteId: '' })).toThrow(/D1/)
    expect(() => creer({ mandatId: '' })).toThrow(/mandat/)
    expect(() => creer({ numero: '' })).toThrow(/numéro/)
    expect(() => creer({ traitementId: '' })).toThrow(/traitement/)
  })

  it('rang dans le lot : entier à partir de 1', () => {
    expect(() => creer({ rang: 0 })).toThrow(/Rang invalide/)
    expect(() => creer({ rang: 1.5 })).toThrow(/Rang invalide/)
    expect(creer({ rang: 3, nombreOrdresDuLot: 3 }).rang).toBe(3)
  })

  it('taille du lot : entier à partir de 1, saisie avec le rang ; rang compris dans le lot', () => {
    expect(() => creer({ nombreOrdresDuLot: 0 })).toThrow(/Taille du lot invalide/)
    expect(() => creer({ nombreOrdresDuLot: 1.5 })).toThrow(/Taille du lot invalide/)
    expect(() => creer({ nombreOrdresDuLot: undefined as never })).toThrow(/Taille du lot invalide/)
    expect(() => creer({ rang: 3, nombreOrdresDuLot: 2 })).toThrow(/Rang 3 hors du lot de 2 virements/)
    expect(creer({ rang: 2, nombreOrdresDuLot: 2 })).toMatchObject({ rang: 2, nombreOrdresDuLot: 2 })
  })
})

describe('émission et écriture', () => {
  it('émission unique, à une date ISO', () => {
    const v = emis(creer())
    expect(v).toMatchObject({ statut: 'Émis', dateEmission: '2026-10-30' })
    expect(() => emettreLot([v], { dateEmission: '2026-10-31' })).toThrow(/déjà émis/)
    expect(() => emettreLot([creer()], { dateEmission: '30/10/2026' })).toThrow(/Date d'émission invalide/)
  })

  it('la vue d’un virement (ordre du lot) ne s’émet pas seule : on émet le lot, puis on relit la vue', () => {
    const v = creer()
    const [vue] = ordresDuLotVirementsInternes([v])
    expect(() => emettreOrdreConstate(vue, '2026-10-30')).toThrow(/emettreLotVirementsInternes/)
    expect(ordresDuLotVirementsInternes([emis(v)])[0]).toMatchObject({ statut: 'Émis', dateEmission: '2026-10-30' })
  })

  it('pas d’écriture avant l’émission, ni deux fois, ni sous un autre traitement, ni pour plusieurs syndicats', () => {
    expect(() => traitementVirementsInternes([creer()], AU_30)).toThrow(/pas émis/)
    const { virements } = traitementVirementsInternes([emis(creer())], AU_30)
    expect(() => traitementVirementsInternes(virements, AU_30)).toThrow(/déjà imputé/)
    expect(() => traitementVirementsInternes([emis(creer())], { ...AU_30, id: 't-autre' })).toThrow(/t-autre/)
    expect(() => traitementVirementsInternes([emis(creer()), { ...emis(creer({ id: 'vi-2' })), coproprieteId: 'copro-autre' }], AU_30)).toThrow(/D1/)
    expect(() => traitementVirementsInternes([emis(creer()), emis(creer())], AU_30)).toThrow(/double/)
    expect(() => traitementVirementsInternes([], AU_30)).toThrow(/aucun virement/)
  })

  it('un lot de deux virements de sens contraires : écritures brutes, jamais compensées ; rangs 1 et 2, sans tiers', () => {
    const [aller, retour] = emettreLot([
      creer({ nombreOrdresDuLot: 2 }),
      creer({
        id: 'vi-2',
        numero: 'BAB-0002',
        rang: 2,
        nombreOrdresDuLot: 2,
        source: FONDS,
        destination: COURANT,
        montantCentimes: 100_000,
        emploiFondsTravaux: { objet: 'travaux_ppt', decisionAg: 'AG' },
      }),
    ])
    const { traitement } = traitementVirementsInternes([aller, retour], AU_30)
    expect(traitement.mouvements.map((m) => m.montantCentimes)).toEqual([250_000, 250_000, 100_000, 100_000])
    const ordres = ordresDuLotVirementsInternes([aller, retour])
    expect(ordres.map((o) => [o.rang, o.type, o.tiers, o.banqueId, o.numeroPiece])).toEqual([
      [1, 'Virement interne', null, 'b-courant', 'BAB-0001'],
      [2, 'Virement interne', null, 'b-fonds', 'BAB-0002'],
    ])
    expect(controlerRangsDuLot(ordres)).toEqual([])
  })

  it('le rang est celui du virement, pas sa position dans la liste passée', () => {
    const v1 = creer({ traitementId: 't-lot', nombreOrdresDuLot: 2 })
    const v2 = creer({ id: 'vi-2', numero: 'BAB-0002', traitementId: 't-lot', rang: 2, nombreOrdresDuLot: 2 })
    const rangs =(virements: VirementInterne[]) => ordresDuLotVirementsInternes(virements).map((o) => [o.numero, o.rang])
    expect(rangs([v1, v2])).toEqual([['BAB-0001', 1], ['BAB-0002', 2]])
    expect(rangs([v2])).toEqual([['BAB-0002', 2]])
    expect(rangs([v2, v1])).toEqual([['BAB-0002', 2], ['BAB-0001', 1]])
    expect(controlerRangsDuLot(ordresDuLotVirementsInternes([v2])).map((a) => a.code)).toEqual(['rang_manquant'])
  })

  it('🔴 contre-passation : aucune annulation observée pour « Règlement de banque à banque » (branchement à faire dans traitements.ts)', () => {
    const { traitement } = traitementVirementsInternes([emis(creer())], AU_30)
    expect(() => annulerTraitement(traitement, { id: 't-ann', date: '2026-10-31' })).toThrow(/Aucune annulation observée/)
  })
})

describe('écriture de virements relus : un lot s’écrit en une fois, entier, sous un traitement neuf (taille du lot, journal)', () => {
  const T_LOT = { id: 't-lot', date: '2026-10-30', journal: [] }
  /** Virement émis relu d'un lot de deux sous « t-lot », rang 1 sauf surcharge. */
  const duLotDeDeux = (surcharge: Partial<SaisieVirementInterne> = {}) => relu(creer({ traitementId: 't-lot', nombreOrdresDuLot: 2, ...surcharge }))

  it('(a) deux virements saisis au même rang : refusés dès le premier appel, seuls comme ensemble', () => {
    const vi1 = duLotDeDeux()
    const vi2 = duLotDeDeux({ id: 'vi-2', numero: 'BAB-0002' })
    expect(() => traitementVirementsInternes([vi1], T_LOT)).toThrow(/le lot compte 2 virement\(s\), 1 passé\(s\)/)
    expect(() => traitementVirementsInternes([vi2], { ...T_LOT, date: '2026-10-31' })).toThrow(/le lot compte 2 virement\(s\)/)
    expect(() => traitementVirementsInternes([vi1, vi2], T_LOT)).toThrow(/rang 1 déjà pris/)
  })

  it('(a) deux saisies unitaires (rang 1, lot de 1) sous le même traitement : la seconde est refusée, le traitement étant au journal', () => {
    const vi1 = relu(creer({ traitementId: 't-lot' }))
    const vi2 = relu(creer({ id: 'vi-2', numero: 'BAB-0002', traitementId: 't-lot' }))
    const { traitement } = traitementVirementsInternes([vi1], T_LOT)
    expect(() => traitementVirementsInternes([vi2], { ...T_LOT, date: '2026-10-31', journal: [traitement] })).toThrow(
      /Traitement t-lot déjà passé au journal/,
    )
    expect(() => traitementVirementsInternes([vi1, vi2], T_LOT)).toThrow(/le lot compte 1 virement\(s\), 2 passé\(s\)/)
  })

  it('(b) rang final oublié : refusé dès le premier appel ; le lot entier s’écrit, une fois', () => {
    const vi1 = duLotDeDeux()
    const vi2 = duLotDeDeux({ id: 'vi-2', numero: 'BAB-0002', rang: 2, montantCentimes: 50_000 })
    expect(() => traitementVirementsInternes([vi1], T_LOT)).toThrow(/1 passé\(s\) ; passer tous les virements du lot/)
    expect(() => traitementVirementsInternes([vi2], T_LOT)).toThrow(/1 passé\(s\)/)
    expect(() => traitementVirementsInternes([vi1, { ...vi2, rang: 1 }], T_LOT)).toThrow(/rang 1 déjà pris/)
    const { traitement, virements } = traitementVirementsInternes([vi2, vi1], T_LOT)
    expect(traitement.mouvements).toHaveLength(4)
    expect(virements.map((v) => v.impute)).toEqual([true, true])
    expect(() => traitementVirementsInternes([vi1, vi2], { ...T_LOT, journal: [traitement] })).toThrow(/déjà passé au journal/)
  })

  it('virements qui déclarent des lots de tailles différentes : refusés', () => {
    const vi1 = duLotDeDeux()
    const vi2 = duLotDeDeux({ id: 'vi-2', numero: 'BAB-0002', rang: 2, nombreOrdresDuLot: 3 })
    expect(() => traitementVirementsInternes([vi1, vi2], T_LOT)).toThrow(/tailles différentes \(2, 3\)/)
  })

  it('creerLotVirementsInternes attribue le traitement, les rangs 1 à n et la taille n ; le lot s’écrit tel quel', () => {
    const lot = creerLotVirementsInternes([saisieDuLot(), saisieDuLot({ id: 'vi-2', numero: 'BAB-0002', montantCentimes: 50_000 })], {
      traitementId: 't-lot',
      segmentSyndicat: SEGMENT,
    })
    expect(lot.map((v) => [v.id, v.traitementId, v.rang, v.nombreOrdresDuLot, v.statut])).toEqual([
      ['vi-1', 't-lot', 1, 2, 'Enregistré'],
      ['vi-2', 't-lot', 2, 2, 'Enregistré'],
    ])
    expect(traitementVirementsInternes(emettreLot(lot), T_LOT).traitement.mouvements).toHaveLength(4)
  })

  it('creerLotVirementsInternes refuse un lot vide, un virement en double, plusieurs syndicats, et contrôle chaque virement', () => {
    const options = { traitementId: 't-lot', segmentSyndicat: SEGMENT }
    expect(() => creerLotVirementsInternes([], options)).toThrow(/aucun virement/)
    expect(() => creerLotVirementsInternes([saisieDuLot(), saisieDuLot()], options)).toThrow(/vi-1 en double/)
    expect(() => creerLotVirementsInternes([saisieDuLot(), saisieDuLot({ id: 'vi-2', coproprieteId: 'copro-autre' })], options)).toThrow(/plusieurs syndicats \(D1\)/)
    expect(() => creerLotVirementsInternes([saisieDuLot(), saisieDuLot({ id: 'vi-2', montantCentimes: 0 })], options)).toThrow(/Montant/)
    expect(() => creerLotVirementsInternes([saisieDuLot()], { ...options, traitementId: ' ' })).toThrow(/traitement/)
  })
})

describe('un lot est contrôlé avant l’envoi à la banque : émis entier, il s’écrit toujours', () => {
  const T_LOT = { id: 't-lot', date: '2026-10-30', journal: [] }
  const SOUS_T_LOT = { traitementId: 't-lot', segmentSyndicat: SEGMENT }
  /** Lot de deux sous « t-lot » : vi-1 courant → fonds ; vi-2 fonds → compte du fonds à la Caisse des dépôts (hors fichier). */
  const lotDeDeux = () =>
    creerLotVirementsInternes(
      [saisieDuLot(), saisieDuLot({ id: 'vi-2', numero: 'BAB-0002', source: FONDS, destination: FONDS_CDC, montantCentimes: 500 })],
      SOUS_T_LOT,
    )

  it('l’émission isolée d’un virement n’existe plus : seul un lot s’émet (un virement seul est un lot de un)', () => {
    expect(moduleVirement).not.toHaveProperty('emettreVirementInterne')
    expect(emis(creer())).toMatchObject({ statut: 'Émis', dateEmission: '2026-10-30' })
  })

  it('(1) émission d’une partie du lot : refusée, rien ne part ; le virement abandonné se retire, le lot recomposé s’émet et s’écrit', () => {
    const [vi1, vi2] = lotDeDeux()
    expect(() => emettreLot([vi1])).toThrow(/le lot compte 2 virement\(s\), 1 passé\(s\)/)
    expect(() => emettreLot([vi2])).toThrow(/le lot compte 2 virement\(s\), 1 passé\(s\)/)
    expect([vi1.statut, vi2.statut]).toEqual(['Enregistré', 'Enregistré'])
    const [seul] = recomposerLotVirementsInternes([vi1], { traitementId: 't-lot' })
    expect(seul).toMatchObject({ id: 'vi-1', traitementId: 't-lot', rang: 1, nombreOrdresDuLot: 1, statut: 'Enregistré', montantCentimes: 250_000 })
    const { traitement, virements } = traitementVirementsInternes(emettreLot([seul], { virementsConnus: [vi1, vi2] }), T_LOT)
    expect(traitement.mouvements.map((m) => [m.compte, m.sens, m.montantCentimes])).toEqual([
      ['TILL.51210.00000.0', 'debit', 250_000],
      ['TILL.51200.00000.0', 'credit', 250_000],
    ])
    expect(virements[0]).toMatchObject({ id: 'vi-1', statut: 'Émis', impute: true })
  })

  it('(1) lot entier émis en une fois, à une même date : chacun de ses virements émis s’écrit avec lui', () => {
    const lotEmis = emettreLot(lotDeDeux())
    expect(lotEmis.map((v) => [v.id, v.rang, v.statut, v.dateEmission])).toEqual([
      ['vi-1', 1, 'Émis', '2026-10-30'],
      ['vi-2', 2, 'Émis', '2026-10-30'],
    ])
    expect(traitementVirementsInternes(lotEmis, T_LOT).virements.map((v) => v.impute)).toEqual([true, true])
  })

  it('(2) même rang saisi deux fois : l’émission refuse le lot, aucun virement ne part ; recomposé, il s’émet et s’écrit', () => {
    const vi1 = creer({ traitementId: 't-lot', nombreOrdresDuLot: 2 })
    const vi2 = creer({ id: 'vi-2', numero: 'BAB-0002', traitementId: 't-lot', nombreOrdresDuLot: 2 })
    expect(() => emettreLot([vi1, vi2])).toThrow(/rang 1 déjà pris/)
    expect(() => emettreLot([vi2, vi1])).toThrow(/rang 1 déjà pris/)
    expect(() => emettreLot([vi1])).toThrow(/1 passé\(s\)/)
    expect(() => emettreLot([vi2])).toThrow(/1 passé\(s\)/)
    const lot = recomposerLotVirementsInternes([vi1, vi2], { traitementId: 't-lot' })
    expect(lot.map((v) => [v.id, v.rang, v.nombreOrdresDuLot])).toEqual([
      ['vi-1', 1, 2],
      ['vi-2', 2, 2],
    ])
    expect(traitementVirementsInternes(emettreLot(lot), T_LOT).traitement.mouvements).toHaveLength(4)
  })

  it('(3) traitement déjà au journal : l’émission refuse le lot ; recomposé sous un traitement neuf, il s’émet et s’écrit', () => {
    const premierLot = emettreLot(creerLotVirementsInternes([saisieDuLot()], SOUS_T_LOT))
    const journal = [traitementVirementsInternes(premierLot, T_LOT).traitement]
    const [nouveau] = creerLotVirementsInternes([saisieDuLot({ id: 'vi-9', numero: 'BAB-0009' })], SOUS_T_LOT)
    expect(() => emettreLot([nouveau], { journal })).toThrow(/Traitement t-lot déjà passé au journal/)
    expect(nouveau.statut).toBe('Enregistré')
    const neuf = emettreLot(recomposerLotVirementsInternes([nouveau], { traitementId: 't-lot-2' }), { journal })
    const { virements } = traitementVirementsInternes(neuf, { id: 't-lot-2', date: '2026-10-31', journal })
    expect(virements[0]).toMatchObject({ id: 'vi-9', traitementId: 't-lot-2', impute: true })
  })

  it('(3) traitement réservé par un lot émis, pas encore écrit : un autre lot ne s’émet pas sous ce traitement, ni un virement deux fois', () => {
    const [a] = creerLotVirementsInternes([saisieDuLot()], SOUS_T_LOT)
    const [b] = creerLotVirementsInternes([saisieDuLot({ id: 'vi-9', numero: 'BAB-0009' })], SOUS_T_LOT)
    const [aEmis] = emettreLot([a])
    const virementsConnus = [aEmis, b]
    expect(() => emettreLot([b], { virementsConnus })).toThrow(/Traitement t-lot déjà réservé par le virement BAB-0001, émis dans un autre lot/)
    expect(() => emettreLot([a], { virementsConnus })).toThrow(/Virement BAB-0001 déjà émis \(traitement t-lot\)/)
    const [bEmis] = emettreLot(recomposerLotVirementsInternes([b], { traitementId: 't-lot-b' }), { virementsConnus })
    const premier = traitementVirementsInternes([aEmis], T_LOT)
    const second = traitementVirementsInternes([bEmis], { id: 't-lot-b', date: '2026-10-30', journal: [premier.traitement] })
    expect([premier.virements[0].impute, second.virements[0].impute]).toEqual([true, true])
  })

  it('émission : lot vide, plusieurs traitements, plusieurs syndicats, virement en double : refusés', () => {
    const vi1 = creer({ traitementId: 't-lot', nombreOrdresDuLot: 2 })
    const vi2 = creer({ id: 'vi-2', numero: 'BAB-0002', traitementId: 't-autre', rang: 2, nombreOrdresDuLot: 2 })
    expect(() => emettreLot([])).toThrow(/aucun virement/)
    expect(() => emettreLot([vi1, vi2])).toThrow(/plusieurs traitements \(t-lot, t-autre\)/)
    expect(() => emettreLot([vi1, { ...vi2, traitementId: 't-lot', coproprieteId: 'copro-autre' }])).toThrow(/plusieurs syndicats \(D1\)/)
    expect(() => emettreLot([vi1, vi1])).toThrow(/vi-1 en double/)
  })

  it('recomposition : refusée une fois le lot émis, et pour un lot vide, un traitement absent, un double, plusieurs syndicats', () => {
    const [vi1, vi2] = lotDeDeux()
    const [vi1Emis] = emettreLot([vi1, vi2])
    expect(() => recomposerLotVirementsInternes([vi1Emis], { traitementId: 't-lot' })).toThrow(/BAB-0001 déjà émis le 2026-10-30.*ne se recompose plus/)
    expect(() => recomposerLotVirementsInternes([], { traitementId: 't-lot' })).toThrow(/aucun virement/)
    expect(() => recomposerLotVirementsInternes([vi1], { traitementId: ' ' })).toThrow(/traitement/)
    expect(() => recomposerLotVirementsInternes([vi1, vi1], { traitementId: 't-lot' })).toThrow(/vi-1 en double/)
    expect(() => recomposerLotVirementsInternes([vi1, { ...vi2, coproprieteId: 'copro-autre' }], { traitementId: 't-lot' })).toThrow(/D1/)
  })
})

describe('fichier de virement (pain.001.001.03)', () => {
  const options = { nomSyndicat: 'SDC Les Tilleuls (fictif)', messageId: 'BAB-0001', dateCreation: '2026-10-30T09:00:00', dateExecution: '2026-10-31' }

  it('débiteur = compte source, créancier = le syndicat sur le compte de destination', () => {
    const xml = fichierVirementInterne(creer(), options)
    expect(xml).toMatch(/<DbtrAcct><Id><IBAN>FR7630006000011234567890189<\/IBAN>/)
    expect(xml).toMatch(/<Cdtr><Nm>SDC Les Tilleuls \(fictif\)<\/Nm><\/Cdtr>\s*<CdtrAcct><Id><IBAN>FR1420041010050500013M02606<\/IBAN>/)
    expect(xml).toContain('<EndToEndId>BAB-0001</EndToEndId>')
    expect(xml).toContain('<InstdAmt Ccy="EUR">2500.00</InstdAmt>')
  })

  it('compte sans IBAN ou sans BIC (Caisse des dépôts, sous-compte centralisateur) : virement à ordonner hors fichier', () => {
    expect(() => fichierVirementInterne(creer({ source: FONDS, destination: FONDS_CDC }), options)).toThrow(/destination .*sans IBAN/)
    expect(() => fichierVirementInterne(creer({ source: { ...COURANT, bic: null } }), options)).toThrow(/source .*sans IBAN ou BIC/)
    expect(() => fichierVirementInterne(creer(), { ...options, nomSyndicat: ' ' })).toThrow(/syndicat/)
  })
})

describe('en-tête : sources et marqueurs', () => {
  const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'virement-interne.ts'), 'utf8')
  const entete = source.slice(0, source.indexOf('*/')).replace(/\s*\n\s*\*\s*/g, ' ')

  it('cite Gestéam (tranche 43 § 12, tranche 29), D-BANQUE et les textes lus', () => {
    for (const attendu of ['tranche 43 § 12', 'tranche 29', 'D-BANQUE', 'art. 18, II', '14-2-1', '29-14', '35-1', 'arrêté du 14 mars 2005', "contrôlé AVANT l'envoi à la banque"])
      expect(entete).toContain(attendu)
    for (const marqueur of ['🟢', '🔵', '🔴']) expect(entete).toContain(marqueur)
  })

  const nonEtabli = entete.slice(entete.indexOf('🔴 Non établi'))

  it('🔴 pose les questions ouvertes (compte de transit, sens inverse, compte centralisateur, annulation)', () => {
    for (const attendu of [
      '471, 472',
      "vire-t-il d'abord vers le compte courant",
      'compte centralisateur',
      'Caisse des dépôts',
      'Annulation',
      'Ajustement bancaire fonds travaux',
      "un ordre d'un lot dont les autres sont « Émis »",
      'aucune annulation après émission ici',
    ])
      expect(nonEtabli).toContain(attendu)
  })

  it('🟢 art. 18, II, dernier al. au plus près du texte : interdiction faite au syndic, avec ses deux exceptions', () => {
    expect(entete).toContain(
      "le syndic ne peut avancer de fonds au syndicat, à l'exception du syndic provisoire et de l'administrateur provisoire désigné en application des art. 29-1 et 29-11",
    )
    expect(entete).not.toContain('seuls le syndic provisoire')
    expect(nonEtabli).toContain('D. 1967 art. 46')
    expect(nonEtabli).toContain("L'administrateur provisoire de l'art. 47")
  })

  it('🔴 la question sur l’emploi du fonds décrit le contrôle réel : décision d’affectation (1° à 4°) ou ordonnance de l’art. 29-14, 2°', () => {
    expect(entete).not.toContain("VitFix exige l'une ou l'autre")
    expect(entete).toContain('pour les seules dépenses du I, 1° à 4° (decisionAg)')
    expect(entete).toContain("exigent l'ordonnance de l'art. 29-14, 2° (autorisationJuge)")
    expect(nonEtabli).toContain("l'ordonnance de l'art. 29-14, 2° (autorisationJuge) sont des textes libres")
  })
})
