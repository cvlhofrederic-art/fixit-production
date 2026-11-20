import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  alertesPnoLotsNonOccupes,
  attestationsPnoAControler,
  bilanAssurancesPno,
  controlesAssurancesPno,
  MESSAGE_PNO_LOT_NON_OCCUPE,
  REGLAGES_PNO_CABINET_PAR_DEFAUT,
  type AssurancePnoLot,
  type LotAssurancePno,
} from '@/lib/administrateur-judiciaire/domain/assurance-pno-lots'
import { LIBELLES_OCCUPATIONS_LOT, OCCUPATIONS_LOT, type OccupationLot } from '@/lib/administrateur-judiciaire/domain/fiche-lot'
import {
  depuisAssurancesPno,
  HORIZONS_CABINET_PAR_DEFAUT,
  reglageParDefaut,
  selectionnerAFaire,
  type AffectationMandat,
  type ElementAFaire,
  type ReglageSuivi,
} from '@/lib/administrateur-judiciaire/domain/suivi-a-faire'

/**
 * Décisions du 20/11/2026 (partie C, F55 à F59) sur l'assurance PNO des lots : alerte non bloquante pour un lot loué ou
 * vacant sans PNO (F55), attestations des occupants non recueillies par défaut (F56), relance 30 jours avant
 * l'échéance puis rappel à l'échéance (F57), libellé propre au statut « Cabinet » (F58), « à obtenir depuis le … » (F59).
 * Données fictives.
 */

const lot = (
  lotId: string,
  assurancePno: AssurancePnoLot | null,
  complement: Partial<Pick<LotAssurancePno, 'occupation' | 'repriseLe'>> = {},
): LotAssurancePno => ({ lotId, numero: lotId, assurancePno, ...complement })
const pno = (statut: string | null, echeance: string | null = null): AssurancePnoLot => ({ statut, echeance })

const AUJOURDHUI = '2026-11-04'

const lireEnTete = (fichier: string): string => {
  const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', fichier), 'utf8')
  return source.slice(0, source.indexOf('*/')).replaceAll(/\s*\n\s*\*\s*/g, ' ')
}

describe('F55 — « Pas de PNO » : alerte non bloquante pour un lot connu comme loué ou vacant', () => {
  it('occupation du lot : propriétaire occupant, loué, vacant (champ à enregistrer : FicheLot n’a que « occupeDepuis »)', () => {
    expect(OCCUPATIONS_LOT).toEqual(['proprietaire_occupant', 'loue', 'vacant'])
    expect(OCCUPATIONS_LOT.map((o) => LIBELLES_OCCUPATIONS_LOT[o])).toEqual(['Occupé par son propriétaire', 'Loué', 'Vacant'])
  })

  it('message de la décision, mot pour mot', () => {
    expect(MESSAGE_PNO_LOT_NON_OCCUPE).toBe(
      "lot non occupé par son propriétaire, sans PNO renseignée : l'art. 9-1 impose une assurance de responsabilité civile ; aucun texte n'impose au syndic de la contrôler",
    )
  })

  it('lot loué ou vacant sous « Pas de PNO » : alerte, jamais bloquante', () => {
    const alertes = alertesPnoLotsNonOccupes([
      lot('L1', pno('Pas de PNO'), { occupation: 'loue' }),
      lot('L2', pno('Pas de PNO'), { occupation: 'vacant' }),
    ])
    expect(alertes).toEqual([
      {
        lotId: 'L1',
        numero: 'L1',
        occupation: 'loue',
        bloquant: false,
        message: `Lot L1 : ${MESSAGE_PNO_LOT_NON_OCCUPE}.`,
        fondement: 'L. 1965 art. 9-1',
      },
      {
        lotId: 'L2',
        numero: 'L2',
        occupation: 'vacant',
        bloquant: false,
        message: `Lot L2 : ${MESSAGE_PNO_LOT_NON_OCCUPE}.`,
        fondement: 'L. 1965 art. 9-1',
      },
    ])
  })

  it('rien ne change si l’occupation est inconnue ou si le propriétaire occupe le lot ; rien pour un autre statut', () => {
    expect(
      alertesPnoLotsNonOccupes([
        lot('L1', pno('Pas de PNO')),
        lot('L2', pno('Pas de PNO'), { occupation: null }),
        lot('L3', pno('Pas de PNO'), { occupation: 'proprietaire_occupant' }),
        lot('L4', pno('Extérieure', '2027-01-31'), { occupation: 'loue' }),
        lot('L5', pno('Cabinet'), { occupation: 'vacant' }),
        lot('L6', null, { occupation: 'loue' }),
      ]),
    ).toEqual([])
  })

  it('règle 1 inchangée : « Pas de PNO » ne donne aucun contrôle, ni élément du suivi, même loué ; le bilan est inchangé', () => {
    const lots = [lot('L1', pno('Pas de PNO'), { occupation: 'loue' })]
    expect(controlesAssurancesPno(lots, { aujourdhui: AUJOURDHUI })).toEqual([])
    expect(depuisAssurancesPno([{ mandatId: 'M1', lot: lots[0] }], AUJOURDHUI)).toEqual([])
    expect(bilanAssurancesPno(lots)).toEqual(bilanAssurancesPno([lot('L1', pno('Pas de PNO'))]))
  })

  it('occupation hors liste : erreur d’appel', () => {
    expect(() => alertesPnoLotsNonOccupes([lot('L1', pno('Pas de PNO'), { occupation: 'locataire' as OccupationLot })])).toThrow(/occupation/i)
  })
})

describe('F56 — attestations des copropriétaires occupants : non recueillies par défaut', () => {
  it('réglage du cabinet désactivé par défaut', () => {
    expect(REGLAGES_PNO_CABINET_PAR_DEFAUT.suivreAttestationsOccupants).toBe(false)
  })

  it('un lot occupé par son propriétaire, sans PNO, ne produit ni contrôle ni alerte', () => {
    const lots = [lot('L1', pno('Pas de PNO'), { occupation: 'proprietaire_occupant' })]
    expect(controlesAssurancesPno(lots, { aujourdhui: AUJOURDHUI })).toEqual([])
    expect(alertesPnoLotsNonOccupes(lots)).toEqual([])
  })
})

describe('F57 — relance 30 jours avant l’échéance, réglable par le cabinet, puis rappel à l’échéance', () => {
  const affectations: AffectationMandat[] = [
    { mandatId: 'M1', cabinetId: null, responsableId: 'u1', comptableId: null, assistantId: null, statut: 'En gestion' },
  ]
  const elements = (echeances: string[]): ElementAFaire[] =>
    depuisAssurancesPno(
      echeances.map((echeance, i) => ({ mandatId: 'M1', lot: lot(`L${i + 1}`, pno('Extérieure', echeance)) })),
      AUJOURDHUI,
    )
  const retenus = (liste: ElementAFaire[], reglage: ReglageSuivi, horizonsCabinet?: Parameters<typeof selectionnerAFaire>[4]) =>
    selectionnerAFaire(liste, reglage, affectations, AUJOURDHUI, horizonsCabinet).map((e) => e.objetId)

  it('valeur nommée : 30 jours, comme l’anticipation des contrats à résilier', () => {
    expect(REGLAGES_PNO_CABINET_PAR_DEFAUT.relanceJoursAvantEcheance).toBe(30)
    expect(HORIZONS_CABINET_PAR_DEFAUT).toEqual({ pno_a_renouveler: { nombre: 30, unite: 'jours' } })
  })

  it('horizon « Maintenant » par défaut du collaborateur : l’échéance remonte 30 jours avant (04/11 + 30 = 04/12)', () => {
    expect(retenus(elements(['2026-12-04', '2026-12-10']), reglageParDefaut('u1'))).toEqual(['L1'])
  })

  it('valeur réglable par le cabinet', () => {
    expect(retenus(elements(['2026-12-04', '2026-12-10']), reglageParDefaut('u1'), { pno_a_renouveler: { nombre: 45, unite: 'jours' } })).toEqual([
      'L1',
      'L2',
    ])
  })

  it('le réglage du collaborateur, s’il existe, reste prioritaire (famille ou nature, même « Maintenant » pour la nature)', () => {
    const liste = elements(['2026-11-12', '2026-12-04'])
    const famille: ReglageSuivi = reglageParDefaut('u1')
    famille.familles.lots = { actif: true, perimetre: 'portefeuille', horizon: { nombre: 1, unite: 'semaines' }, natures: null }
    expect(retenus(liste, famille)).toEqual([])
    const nature: ReglageSuivi = reglageParDefaut('u1')
    nature.familles.lots = {
      actif: true,
      perimetre: 'portefeuille',
      horizon: { unite: 'maintenant' },
      natures: null,
      horizonsParNature: { pno_a_renouveler: { unite: 'maintenant' } },
    }
    expect(retenus(liste, nature)).toEqual([])
  })

  it('l’horizon du cabinet ne vaut que pour l’attestation PNO à renouveler', () => {
    const contrat: ElementAFaire = {
      id: 'contrats:C1:limite_resiliation',
      famille: 'contrats',
      nature: 'limite_resiliation',
      libelle: 'Contrat fictif',
      date: '2026-11-12',
      mandatId: 'M1',
      objetId: 'C1',
      assigneId: null,
      aConfirmer: false,
    }
    expect(selectionnerAFaire([contrat], reglageParDefaut('u1'), affectations, AUJOURDHUI)).toEqual([])
  })

  it('avant l’échéance : relance (libellé inchangé) ; à l’échéance, sans nouvelle attestation saisie : rappel', () => {
    const avant = controlesAssurancesPno([lot('L1', pno('Extérieure', '2026-11-30'))], { aujourdhui: AUJOURDHUI })[0]
    expect(avant).toMatchObject({ rappel: false, message: "Lot L1 : attestation PNO à renouveler à l'échéance du 30/11/2026." })
    for (const aujourdhui of ['2026-11-30', '2026-12-15']) {
      const rappel = controlesAssurancesPno([lot('L1', pno('Extérieure', '2026-11-30'))], { aujourdhui })[0]
      expect(rappel).toMatchObject({ motif: 'a_renouveler', date: '2026-11-30', rappel: true })
      expect(rappel.message).toBe('Lot L1 : rappel : attestation PNO à renouveler, échéance du 30/11/2026 atteinte sans nouvelle attestation saisie.')
    }
  })

  it('le rappel garde la date de l’échéance dans le suivi (élément inchangé, une seule ligne par lot)', () => {
    const [element] = depuisAssurancesPno([{ mandatId: 'M1', lot: lot('L1', pno('Extérieure', '2026-11-02')) }], AUJOURDHUI)
    expect(element).toMatchObject({ id: 'lots:L1:pno_a_renouveler', nature: 'pno_a_renouveler', date: '2026-11-02', aConfirmer: false })
    expect(element.libelle).toMatch(/^Lot L1 : rappel : /)
  })

  it('attestationsPnoAControler applique le rappel à sa date ; date du calcul invalide : erreur', () => {
    expect(attestationsPnoAControler([lot('L1', pno('Extérieure', '2026-11-03'))], AUJOURDHUI)[0].rappel).toBe(true)
    expect(() => controlesAssurancesPno([lot('L1', pno('Extérieure'))], { aujourdhui: '04/11/2026' })).toThrow(/invalide/)
  })
})

describe('F58 — statut « Cabinet » : échéance gardée au suivi, libellé « renouveler le contrat PNO souscrit par le cabinet »', () => {
  it('avant l’échéance, puis rappel à l’échéance', () => {
    const [avant] = controlesAssurancesPno([lot('L1', pno('Cabinet', '2026-12-31'))], { aujourdhui: AUJOURDHUI })
    expect(avant.message).toBe('Lot L1 : renouveler le contrat PNO souscrit par le cabinet, échéance du 31/12/2026.')
    const [apres] = controlesAssurancesPno([lot('L1', pno('Cabinet', '2026-10-31'))], { aujourdhui: AUJOURDHUI })
    expect(apres.message).toBe(
      'Lot L1 : rappel : renouveler le contrat PNO souscrit par le cabinet, échéance du 31/10/2026 atteinte sans nouvelle échéance saisie.',
    )
  })

  it('le suivi garde l’échéance du contrat « Cabinet » (même nature, même date)', () => {
    const [element] = depuisAssurancesPno([{ mandatId: 'M1', lot: lot('L1', pno('Cabinet', '2026-12-31')) }], AUJOURDHUI)
    expect(element).toMatchObject({ nature: 'pno_a_renouveler', date: '2026-12-31' })
    expect(element.libelle).not.toMatch(/attestation/)
  })

  it('« Cabinet » sans échéance saisie : libellé inchangé (la décision vise l’échéance)', () => {
    const [controle] = controlesAssurancesPno([lot('L1', pno('Cabinet'))], { aujourdhui: AUJOURDHUI })
    expect(controle.message).toBe('Lot L1 : PNO « Cabinet » sans échéance saisie ; attestation à obtenir.')
  })
})

describe('F59 — attestation à obtenir : « Maintenant » gardé, « à obtenir depuis le … » quand la date est connue', () => {
  it('date de reprise du lot : mention « depuis le … » ; l’élément reste daté du jour du calcul', () => {
    const lots = [lot('L1', pno('Extérieure'), { repriseLe: '2026-09-01' })]
    const [controle] = controlesAssurancesPno(lots, { aujourdhui: AUJOURDHUI })
    expect(controle).toMatchObject({ motif: 'echeance_absente', date: null, aObtenirDepuis: '2026-09-01' })
    expect(controle.message).toBe('Lot L1 : PNO « Extérieure » sans échéance saisie ; attestation à obtenir depuis le 01/09/2026.')
    const [element] = depuisAssurancesPno([{ mandatId: 'M1', lot: lots[0] }], AUJOURDHUI)
    expect(element).toMatchObject({ nature: 'pno_a_obtenir', date: AUJOURDHUI, libelle: controle.message })
  })

  it('échéance dépassée (« Extérieure + sans contrat ») : elle prime sur la reprise ; échéance à venir : la reprise, ou rien', () => {
    const [depassee] = controlesAssurancesPno([lot('L1', pno('Extérieure + sans contrat', '2026-10-01'), { repriseLe: '2026-09-01' })], {
      aujourdhui: AUJOURDHUI,
    })
    expect(depassee.aObtenirDepuis).toBe('2026-10-01')
    expect(depassee.message).toBe('Lot L1 : PNO extérieure sans contrat ; attestation à obtenir depuis le 01/10/2026 (lecture du statut à confirmer).')
    const aVenir = controlesAssurancesPno(
      [
        lot('L2', pno('Extérieure + sans contrat', '2027-01-31'), { repriseLe: '2026-09-01' }),
        lot('L3', pno('Extérieure + sans contrat', '2027-01-31')),
      ],
      { aujourdhui: AUJOURDHUI },
    )
    expect(aVenir.map((c) => c.aObtenirDepuis)).toEqual(['2026-09-01', null])
    expect(aVenir[1].message).toBe('Lot L3 : PNO extérieure sans contrat ; attestation à obtenir (lecture du statut à confirmer).')
  })

  it('échéance illisible : la reprise seule peut dater le manque', () => {
    const [controle] = controlesAssurancesPno([lot('L1', pno('Extérieure', '31/12/2026'), { repriseLe: '2026-09-01' })], { aujourdhui: AUJOURDHUI })
    expect(controle.message).toBe(
      'Lot L1 : échéance PNO illisible (« 31/12/2026 ») ; à ressaisir (AAAA-MM-JJ) ; attestation à obtenir depuis le 01/09/2026.',
    )
  })

  it('rien d’inventé : reprise postérieure au jour du calcul, pas de date de calcul, ou attestation à renouveler', () => {
    const [future] = controlesAssurancesPno([lot('L1', pno('Extérieure'), { repriseLe: '2026-12-01' })], { aujourdhui: AUJOURDHUI })
    expect(future.aObtenirDepuis).toBeNull()
    const [sansDate] = controlesAssurancesPno([lot('L1', pno('Extérieure'), { repriseLe: '2026-09-01' })])
    expect(sansDate.aObtenirDepuis).toBeNull()
    expect(sansDate.message).toBe('Lot L1 : PNO « Extérieure » sans échéance saisie ; attestation à obtenir.')
    const [renouveler] = controlesAssurancesPno([lot('L1', pno('Extérieure', '2026-10-01'), { repriseLe: '2026-09-01' })], { aujourdhui: AUJOURDHUI })
    expect(renouveler).toMatchObject({ motif: 'a_renouveler', aObtenirDepuis: null })
  })

  it('date de reprise non ISO : erreur d’appel', () => {
    expect(() => controlesAssurancesPno([lot('L1', pno('Extérieure'), { repriseLe: '01/09/2026' })])).toThrow(/reprise/i)
  })
})

describe('en-têtes : décisions du 20/11/2026 (partie C, F55 à F59)', () => {
  it('assurance-pno-lots.ts : décisions citées, questions fermées retirées, question sur le sens des statuts gardée', () => {
    const enTete = lireEnTete('assurance-pno-lots.ts')
    for (const point of ['F55', 'F56', 'F57', 'F58', 'F59']) expect(enTete).toContain(`Décision du 20/11/2026 (partie C, ${point})`)
    expect(enTete).not.toMatch(/Faut-il croiser avec l'occupation du lot/)
    expect(enTete).not.toMatch(/le cabinet recueille-t-il aussi l'attestation des copropriétaires occupants/)
    expect(enTete).not.toMatch(/à quel moment relancer avant l'échéance/)
    expect(enTete).not.toMatch(/sans être qualifié de manquement \(🔴 ci-dessous\)/)
    expect(enTete).toMatch(/sens exact de « Sans échéance »/)
    expect(enTete).toMatch(/L\. 1965 art\. 9-1/)
  })

  it('suivi-a-faire.ts : la relance de 30 jours et la priorité du collaborateur sont dites', () => {
    const enTete = lireEnTete('suivi-a-faire.ts')
    expect(enTete).toMatch(/décision du 20\/11\/2026, partie C, F57/)
    expect(enTete).toMatch(/HORIZONS_CABINET_PAR_DEFAUT/)
  })

  it('fiche-lot.ts : occupation du lot (F55), non ajoutée à FicheLot', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'fiche-lot.ts'), 'utf8')
    expect(source).toContain('Décision du 20/11/2026 (partie C, F55)')
    expect(source.slice(source.indexOf('export interface FicheLot'), source.indexOf('export function quotePartPourcent'))).not.toMatch(
      /occupation/,
    )
  })
})
