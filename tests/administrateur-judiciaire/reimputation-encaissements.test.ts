import { describe, expect, it } from 'vitest'
import { imputerEncaissements, type Encaissement, type PosteDette } from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import { lignesEcrites, type ImputationEcrite } from '@/lib/administrateur-judiciaire/domain/postes-comptes'
import {
  mentionReimputation,
  mouvementsReclassement,
  ordreDesEncaissements,
  postesSansSuffixe,
  rejouerSuffixe,
  traitementReclassement,
  verifierRejeuABlanc,
  type EncaissementARejouer,
} from '@/lib/administrateur-judiciaire/domain/reimputation-encaissements'

/**
 * Réimputation dans l'ordre des dates d'un compte (décision du 24/11/2026, question 6, option 3), fonctions pures de
 * domain/reimputation-encaissements.ts : ordre des encaissements d'un compte, garde du rejeu à blanc, vrai rejeu après
 * le paiement en retard, garde de la désignation du débiteur, lignes du reclassement interne au compte 450 (aucune ligne
 * de banque), mention de la pièce.
 * Données fictives : compte c1 (série 00001), provisions T4 2026 (270,00 €, exigibles le 01/10/2026), provisions T1 2027
 * (450,01 €) et fonds de travaux T1 2027 (22,50 €), exigibles le 01/01/2027.
 */

const poste = (id: string, typeAppel: PosteDette['typeAppel'], exigibilite: string, montantCentimes: number, planCompte = '45000'): PosteDette => ({
  id: `${id}:L1`,
  compteId: 'c1',
  appelId: id,
  typeAppel,
  libelle: `Appel ${id}`,
  exigibilite,
  montantCentimes,
  regleCentimes: 0,
  contentieux: false,
  planCompte,
})
const POSTES = [poste('T4', 'Budget', '2026-10-01', 27_000), poste('T1', 'Budget', '2027-01-01', 45_001), poste('FT', 'Fonds travaux', '2027-01-01', 2_250)]
const encaisse = (id: string, date: string, montantCentimes: number, surcharge: Partial<Encaissement> = {}): Encaissement => ({ id, compteId: 'c1', date, montantCentimes, ...surcharge })

/** Écrit des encaissements dans l'ordre reçu, comme à la saisie : chacun avec son imputation gardée, et les postes après. */
function ecrire(encaissements: readonly (Encaissement & { imputerSurAVenir?: boolean })[], postes: PosteDette[] = POSTES) {
  let courants = postes
  const ecrits = encaissements.map(({ imputerSurAVenir = false, ...encaissement }): EncaissementARejouer => {
    const { resultats, postes: apres } = imputerEncaissements([encaissement], courants, { imputerSurAVenir })
    courants = apres
    const [resultat] = resultats
    return {
      encaissement,
      courante: {
        lignes: lignesEcrites(resultat.lignes, resultat.postes),
        resteAImputerCentimes: resultat.resteAImputerCentimes,
        designationsIgnorees: resultat.designationsIgnorees,
        designationPartielleRefusee: resultat.designationPartielleRefusee,
        imputerSurAVenir,
      },
    }
  })
  return { ecrits, postes: courants }
}

/** Le paiement en retard inséré avant le suffixe : garde du rejeu à blanc, imputation du paiement à sa date, vrai rejeu. */
function inserer(enRetard: Encaissement, suffixe: EncaissementARejouer[], postes: PosteDette[]) {
  const sans = postesSansSuffixe(suffixe, postes)
  verifierRejeuABlanc(suffixe, sans)
  const { resultats, postes: apresLeRetard } = imputerEncaissements([enRetard], sans)
  return { enRetard: resultats[0], ...rejouerSuffixe(suffixe, apresLeRetard) }
}

const parPoste = (imputation: ImputationEcrite) => imputation.lignes.map((l) => [l.posteId, l.montantCentimes])
const COMPTES_450 = { compteId: 'c1', compteCoproprietaire: 'ACAC.45000.00001.0', compteDuPlan: (plan: string) => `ACAC.${plan}.00001.0` }
const origine = (appelId: string, typeAppel: 'Budget' | 'Fonds travaux') => ({ origine: { type: 'appel', appelId, typeAppel } })
const LIENS = { liens: { compteCoproprietaireId: 'c1' } }

describe('ordre des encaissements d’un compte : date, numéro de la pièce d’origine, rang dans le lot, identifiant', () => {
  it('le numéro de la pièce départage deux lots du même jour, le rang deux encaissements d’un lot ; jamais l’horodatage', () => {
    const ordre = ordreDesEncaissements(new Map([['p3', 3], ['p4', 4]]))
    const e = (id: string, date: string, traitementId: string, rang: number) => ({ id, date, traitementId, rang })
    const tries = [e('a', '2027-01-15', 'p4', 0), e('z', '2027-01-15', 'p3', 1), e('y', '2027-01-15', 'p3', 0), e('m', '2026-12-20', 'p4', 1), e('b', '2027-01-15', 'p-absente', 0)].sort(ordre)
    // Une pièce absente du journal passe après les pièces numérotées de son jour.
    expect(tries.map((x) => x.id)).toEqual(['m', 'y', 'z', 'a', 'b'])
  })
})

describe('rejeu : le paiement en retard prend sa place, les encaissements postérieurs sont réimputés à leur date', () => {
  it('chèque remis le 20/12 inséré avant un virement du 15/01 : le chèque sert le T4, seul échu ; le virement solde le T4 puis sert les postes du 01/01 au prorata', () => {
    const { ecrits, postes } = ecrire([encaisse('enc-janvier', '2027-01-15', 27_000)])
    expect(parPoste(ecrits[0].courante)).toEqual([['T4:L1', 27_000]])
    const { enRetard, rejeux, postes: apres } = inserer(encaisse('enc-cheque', '2026-12-20', 20_000), ecrits, postes)
    expect(enRetard.lignes).toEqual([{ posteId: 'T4:L1', montantCentimes: 20_000 }])
    expect(rejeux).toHaveLength(1)
    expect(rejeux[0]).toMatchObject({ encaissementId: 'enc-janvier', change: true, avant: ecrits[0].courante })
    expect(parPoste(rejeux[0].apres)).toEqual([
      ['T4:L1', 7_000],
      ['T1:L1', 19_048],
      ['FT:L1', 952],
    ])
    expect(rejeux[0].apres).toMatchObject({ resteAImputerCentimes: 0, designationsIgnorees: [], designationPartielleRefusee: false, imputerSurAVenir: false })
    expect(apres.map((p) => p.regleCentimes)).toEqual([27_000, 19_048, 952])
  })

  it('imputation inchangée par le paiement en retard : rejeu sans changement, aucune ligne de reclassement', () => {
    // Le virement désigne le T1, paiement partiel accepté : le chèque antérieur sert le T4, le virement garde le T1.
    const { ecrits, postes } = ecrire([encaisse('enc-janvier', '2027-01-15', 10_000, { postesDesignes: ['T1:L1'], designationPartielleAcceptee: true })])
    const { rejeux } = inserer(encaisse('enc-cheque', '2026-12-20', 10_000), ecrits, postes)
    expect(rejeux[0].change).toBe(false)
    expect(parPoste(rejeux[0].apres)).toEqual([['T1:L1', 10_000]])
    expect(mouvementsReclassement({ ...COMPTES_450, avant: rejeux[0].avant, apres: rejeux[0].apres })).toEqual([])
  })

  it('demande d’imputation sur les appels à venir reprise telle quelle au rejeu ; le fonds de travaux non échu n’est jamais servi', () => {
    // Le 22/12/2026, 300,00 € avec la demande du débiteur : T4 soldé, 30,00 € sur le budget à venir.
    const { ecrits, postes } = ecrire([{ ...encaisse('enc-22', '2026-12-22', 30_000), imputerSurAVenir: true }])
    expect(parPoste(ecrits[0].courante)).toEqual([
      ['T4:L1', 27_000],
      ['T1:L1', 3_000],
    ])
    const { rejeux } = inserer(encaisse('enc-cheque', '2026-12-20', 7_000), ecrits, postes)
    expect(parPoste(rejeux[0].apres)).toEqual([
      ['T4:L1', 20_000],
      ['T1:L1', 10_000],
    ])
    expect(rejeux[0].apres.imputerSurAVenir).toBe(true)
  })

  it('plusieurs encaissements postérieurs : rejoués un à un, chacun à sa date, sur les soldes laissés par le précédent', () => {
    const { ecrits, postes } = ecrire([encaisse('enc-a', '2027-01-10', 20_000), encaisse('enc-b', '2027-01-15', 10_000)])
    expect(ecrits.map((e) => parPoste(e.courante))).toEqual([[['T4:L1', 20_000]], [['T4:L1', 7_000], ['T1:L1', 2_857], ['FT:L1', 143]]])
    const { rejeux, postes: apres } = inserer(encaisse('enc-cheque', '2026-12-20', 27_000), ecrits, postes)
    expect(rejeux.map((r) => [r.encaissementId, r.change])).toEqual([
      ['enc-a', true],
      ['enc-b', true],
    ])
    expect(parPoste(rejeux[0].apres)).toEqual([
      ['T1:L1', 19_048],
      ['FT:L1', 952],
    ])
    expect(apres.reduce((s, p) => s + p.regleCentimes, 0)).toBe(57_000)
  })
})

describe('garde du rejeu à blanc : une imputation écrite qui ne se rejoue pas à l’identique refuse la réimputation', () => {
  it('encaissement imputé sur un état que les postes d’aujourd’hui ne redonnent pas : refus qui le nomme et dit pourquoi', () => {
    const { ecrits, postes } = ecrire([encaisse('enc-janvier', '2027-01-15', 27_000)])
    // L'imputation gardée dit 100,00 € sur le T1 : le rejeu seul, sur les postes d'aujourd'hui, donne le T4.
    const fausse: EncaissementARejouer = { ...ecrits[0], courante: { ...ecrits[0].courante, lignes: [{ posteId: 'T4:L1', montantCentimes: 17_000, appelId: 'T4', typeAppel: 'Budget', planCompte: '45000' }, { posteId: 'T1:L1', montantCentimes: 10_000, appelId: 'T1', typeAppel: 'Budget', planCompte: '45000' }] } }
    const avec = postes.map((p) => ({ ...p, regleCentimes: { 'T4:L1': 17_000, 'T1:L1': 10_000 }[p.id] ?? 0 }))
    expect(() => verifierRejeuABlanc([fausse], postesSansSuffixe([fausse], avec))).toThrow(
      /Encaissement enc-janvier du 15\/01\/2027 : son imputation écrite ne se rejoue pas à l'identique.*poste « T4:L1 » : 170,00\s€ écrits, 270,00\s€ au rejeu.*Réimputation refusée, rien n'est écrit/,
    )
  })

  it('reliquat ou signalements différents : refus', () => {
    const { ecrits, postes } = ecrire([encaisse('enc-janvier', '2027-01-15', 27_000)])
    const sans = postesSansSuffixe(ecrits, postes)
    expect(() => verifierRejeuABlanc([{ ...ecrits[0], courante: { ...ecrits[0].courante, designationPartielleRefusee: true } }], sans)).toThrow(/désignation partielle refusée/)
    expect(() => verifierRejeuABlanc([{ ...ecrits[0], courante: { ...ecrits[0].courante, designationsIgnorees: ['T1:L1'] } }], sans)).toThrow(/désignations ignorées/)
  })

  it('poste désigné disparu (appel annulé) : l’erreur du rejeu est rendue comme un refus expliqué, avec sa cause', () => {
    const { ecrits, postes } = ecrire([encaisse('enc-janvier', '2027-01-15', 2_250, { postesDesignes: ['FT:L1'] })])
    const sansLeFonds = postesSansSuffixe(ecrits, postes).filter((p) => p.id !== 'FT:L1')
    expect(() => verifierRejeuABlanc(ecrits, sansLeFonds)).toThrow(/Encaissement enc-janvier du 15\/01\/2027 : son imputation écrite ne se rejoue pas.*Poste désigné inconnu \(id=FT:L1\).*Réimputation refusée/)
  })
})

describe('désignation du débiteur (C. civ. art. 1342-10, al. 1) : jamais déplacée par la réimputation', () => {
  it('désignation qui a joué et dont le montant changerait : refus', () => {
    const { ecrits, postes } = ecrire([encaisse('enc-janvier', '2027-01-15', 27_000, { postesDesignes: ['T4:L1'] })])
    expect(() => inserer(encaisse('enc-cheque', '2026-12-20', 10_000), ecrits, postes)).toThrow(
      /Encaissement enc-janvier du 15\/01\/2027 : le débiteur a désigné le poste « T4:L1 ».*270,00\s€.*170,00\s€.*Réimputation refusée, rien n'est écrit/,
    )
  })

  it('désignation refusée avant et après (paiement partiel non accepté) : pas de refus, la part imputée par la règle légale bouge', () => {
    const { ecrits, postes } = ecrire([encaisse('enc-janvier', '2027-01-15', 10_000, { postesDesignes: ['T1:L1'] })])
    expect(ecrits[0].courante).toMatchObject({ lignes: [{ posteId: 'T4:L1', montantCentimes: 10_000 }], designationPartielleRefusee: true })
    const { rejeux } = inserer(encaisse('enc-cheque', '2026-12-20', 27_000), ecrits, postes)
    expect(rejeux[0]).toMatchObject({ change: true, apres: { designationPartielleRefusee: true } })
    expect(parPoste(rejeux[0].apres)).toEqual([
      ['T1:L1', 9_524],
      ['FT:L1', 476],
    ])
  })

  it('désignation devenue sans objet (poste désigné soldé par le paiement en retard) : refus', () => {
    const { ecrits, postes } = ecrire([encaisse('enc-janvier', '2027-01-15', 27_000, { postesDesignes: ['T4:L1'] })])
    expect(() => inserer(encaisse('enc-cheque', '2026-12-20', 27_000), ecrits, postes)).toThrow(/Encaissement enc-janvier.*désign.*Réimputation refusée/)
  })
})

describe('pièce de reclassement : interne au compte 450, sans mouvement de banque', () => {
  it('débit de l’origine perdue, crédits des origines gagnées, équilibré, le compte copropriétaire en lien ; aucune ligne 512', () => {
    const { ecrits, postes } = ecrire([encaisse('enc-janvier', '2027-01-15', 27_000)])
    const { rejeux } = inserer(encaisse('enc-cheque', '2026-12-20', 20_000), ecrits, postes)
    const lignes = mouvementsReclassement({ ...COMPTES_450, avant: rejeux[0].avant, apres: rejeux[0].apres })
    expect(lignes).toEqual([
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 20_000, ...origine('T4', 'Budget'), ...LIENS },
      { compte: 'ACAC.45000.00001.0', sens: 'credit', montantCentimes: 19_048, ...origine('T1', 'Budget'), ...LIENS },
      { compte: 'ACAC.45000.00001.0', sens: 'credit', montantCentimes: 952, ...origine('FT', 'Fonds travaux'), ...LIENS },
    ])
    expect(lignes.some((l) => l.compte.includes('.512'))).toBe(false)
    const traitement = traitementReclassement(lignes, { id: 'reclassement-1', date: '2027-02-15' })
    expect(traitement).toMatchObject({ id: 'reclassement-1', famille: 'Correction de mouvements', date: '2027-02-15' })
    expect(traitement.annule).toBeUndefined()
    expect(traitement.mouvements).toHaveLength(3)
  })

  it('reliquat : un paiement antérieur ne peut qu’augmenter le reliquat d’un encaissement postérieur : débit avec l’origine, crédit du 45000 sans origine', () => {
    // Virement de 300,00 € le 20/12 : T4 soldé, 30,00 € « à imputer » ; puis un chèque de 100,00 € remis le 10/12.
    const { ecrits, postes } = ecrire([encaisse('enc-virement', '2026-12-20', 30_000)])
    expect(ecrits[0].courante).toMatchObject({ lignes: [{ posteId: 'T4:L1', montantCentimes: 27_000 }], resteAImputerCentimes: 3_000 })
    const { rejeux } = inserer(encaisse('enc-cheque', '2026-12-10', 10_000), ecrits, postes)
    expect(rejeux[0].apres).toMatchObject({ lignes: [{ posteId: 'T4:L1', montantCentimes: 17_000 }], resteAImputerCentimes: 13_000 })
    expect(mouvementsReclassement({ ...COMPTES_450, avant: rejeux[0].avant, apres: rejeux[0].apres })).toEqual([
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 10_000, ...origine('T4', 'Budget'), ...LIENS },
      { compte: 'ACAC.45000.00001.0', sens: 'credit', montantCentimes: 10_000, ...LIENS },
    ])
  })

  it('sous-comptes du 450 : le débit reste au compte que l’appel perdu a débité, le crédit va au 450-1 de l’appel gagné', () => {
    const avecSousComptes = [POSTES[0], { ...POSTES[1], planCompte: '45010' }, POSTES[2]]
    const { ecrits, postes } = ecrire([encaisse('enc-janvier', '2027-01-15', 27_000)], avecSousComptes)
    const { rejeux } = inserer(encaisse('enc-cheque', '2026-12-20', 20_000), ecrits, postes)
    expect(mouvementsReclassement({ ...COMPTES_450, avant: rejeux[0].avant, apres: rejeux[0].apres }).map((l) => [l.sens, l.compte, l.montantCentimes])).toEqual([
      ['debit', 'ACAC.45000.00001.0', 20_000],
      ['credit', 'ACAC.45010.00001.0', 19_048],
      ['credit', 'ACAC.45000.00001.0', 952],
    ])
  })

  it('deux lots d’un même appel sur le même compte 450 : une seule ligne par compte et par appel d’origine', () => {
    const ligne = (posteId: string, montantCentimes: number, appelId = 'T4') => ({ posteId, montantCentimes, appelId, typeAppel: 'Budget' as const, planCompte: '45000' })
    const base = { resteAImputerCentimes: 0, designationsIgnorees: [], designationPartielleRefusee: false, imputerSurAVenir: false }
    const avant: ImputationEcrite = { ...base, lignes: [ligne('T4:L1', 6_000), ligne('T4:L2', 4_000)] }
    const apres: ImputationEcrite = { ...base, lignes: [ligne('T4:L1', 3_000), ligne('T4:L2', 2_000), ligne('T1:L1', 3_000, 'T1'), ligne('T1:L2', 2_000, 'T1')] }
    expect(mouvementsReclassement({ ...COMPTES_450, avant, apres }).map((l) => [l.sens, l.montantCentimes, l.origine?.type === 'appel' ? l.origine.appelId : null])).toEqual([
      ['debit', 5_000, 'T4'],
      ['credit', 5_000, 'T1'],
    ])
  })

  it('mention de la pièce justificative : fondement, compte, paiement en retard avec sa pièce et son jour de saisie, encaissement réimputé', () => {
    const reimpute = { id: 'enc-janvier', date: '2027-01-15', numeroPiece: 3 }
    expect(mentionReimputation({ serie: '00001', enRetard: { ids: ['enc-cheque'], date: '2026-12-20', numeroPiece: 4 }, saisiLe: '2027-02-15', reimpute })).toBe(
      'Réimputation dans l\'ordre des dates (C. civ. art. 1342-10 ; arrêté du 14/03/2005, art. 9) du compte 00001 : encaissement enc-cheque du 20/12/2026 (pièce n° 4) saisi le 15/02/2027 ; encaissement réimputé enc-janvier du 15/01/2027 (pièce n° 3).',
    )
    expect(mentionReimputation({ serie: '00001', enRetard: { ids: ['enc-a', 'enc-b'], date: '2026-12-20', numeroPiece: 4 }, saisiLe: '2027-02-15', reimpute })).toMatch(
      /encaissements enc-a, enc-b du 20\/12\/2026 \(pièce n° 4\) saisis le 15\/02\/2027 ;/,
    )
  })
})
