import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { propagerStatutRapproche, type PieceARapprocher } from '@/lib/administrateur-judiciaire/domain/rapprochement-pieces'
import {
  etatArrete,
  type ArreteRapprochement,
  type ElementRapprochement,
  type PieceRapprochee,
} from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'

/**
 * Statut « Rapproché » propagé depuis l'arrêté de rapprochement (point 38 du bilan 2, réutilisé par le point 16 pour
 * les encaissements). Gestéam, tranche 36 § Règlements : le statut du règlement suit le rapprochement ; tranche 43 § 2 :
 * les encaissements d'un jour ouvré, non daté par rapport aux arrêtés, sont « Rapproché » ; tranche 29 : un arrêté environ
 * tous les dix jours. Statut posé au pointage, et non à la clôture : décision J8 de Hugo (30/10/2026).
 */

type Statut = 'Demandé' | 'À régler' | 'Enregistré' | 'Rapproché' | 'Annulé'
type Piece = PieceARapprocher<Statut>

const REGLE = { type: 'reglement', rapproche: 'Rapproché', avant: 'Enregistré' } as const

const reglement = (id: string, montantCentimes: number, surcharge: Partial<Piece> = {}): Piece => ({
  id,
  statut: 'Enregistré',
  montantCentimes,
  ...surcharge,
})

const pieces = (...ids: string[]): PieceRapprochee[] => ids.map((id) => ({ type: 'reglement', id }))

const element = (
  id: string,
  montantCentimes: number,
  porte: PieceRapprochee[] | undefined,
  surcharge: Partial<ElementRapprochement> = {},
): ElementRapprochement => ({
  id,
  cote: 'banque',
  montantCentimes,
  rapproche: 'manuel',
  date: '2026-10-08',
  rapprocheLe: '2026-10-12',
  ...(porte ? { pieces: porte } : {}),
  ...surcharge,
})

const arrete = (elements: ElementRapprochement[], surcharge: Partial<ArreteRapprochement> = {}): ArreteRapprochement => ({
  id: 'a-1',
  banqueId: 'b-courant',
  dateArrete: '2026-10-20',
  soldeBanqueCentimes: 0,
  soldeComptaCentimes: 0,
  statut: 'En cours',
  elements,
  ...surcharge,
})

describe('propagation du statut « Rapproché » depuis les arrêtés', () => {
  it('une pièce « Enregistré » pointée passe « Rapproché » et garde la trace de son rapprochement', () => {
    const { pieces: resultat, anomalies } = propagerStatutRapproche(
      [reglement('r-1', 120_000)],
      [arrete([element('rel-1', -120_000, pieces('r-1'), { rapproche: 'auto' })])],
      REGLE,
    )
    expect(anomalies).toEqual([])
    expect(resultat[0]).toEqual({
      id: 'r-1',
      statut: 'Rapproché',
      montantCentimes: 120_000,
      rapprochement: { arreteId: 'a-1', banqueId: 'b-courant', elementId: 'rel-1', cote: 'banque', mode: 'auto', rapprocheLe: '2026-10-12' },
    })
  })

  it('décision J8 : au pointage ; un arrêté en cours compte autant qu’un arrêté clôturé', () => {
    const lignes = [element('rel-1', -50_000, pieces('r-1'))]
    for (const statut of ['En cours', 'Clôturé'] as const)
      expect(propagerStatutRapproche([reglement('r-1', 50_000)], [arrete(lignes, { statut })], REGLE).pieces[0].statut).toBe('Rapproché')
  })

  it('un élément en suspens ne propage rien', () => {
    const { pieces: resultat } = propagerStatutRapproche(
      [reglement('r-1', 50_000)],
      [arrete([element('rel-1', -50_000, pieces('r-1'), { rapproche: false, rapprocheLe: null })])],
      REGLE,
    )
    expect(resultat[0]).toMatchObject({ statut: 'Enregistré', rapprochement: null })
  })

  it('une ligne de virement groupé rapproche tous ses règlements quand leur somme fait le montant de la ligne', () => {
    const { pieces: resultat, anomalies } = propagerStatutRapproche(
      [reglement('r-1', 30_000), reglement('r-2', 20_000), reglement('r-3', 10_000)],
      [arrete([element('rel-1', -60_000, pieces('r-1', 'r-2', 'r-3'))])],
      REGLE,
    )
    expect(anomalies).toEqual([])
    expect(resultat.map((p) => p.statut)).toEqual(['Rapproché', 'Rapproché', 'Rapproché'])
  })

  it('montants différents : anomalie, et aucune pièce de l’élément n’est propagée', () => {
    const { pieces: resultat, anomalies } = propagerStatutRapproche(
      [reglement('r-1', 30_000), reglement('r-2', 20_000)],
      [arrete([element('rel-1', -60_000, pieces('r-1', 'r-2'))])],
      REGLE,
    )
    expect(anomalies).toEqual([expect.objectContaining({ code: 'montant_different', arreteId: 'a-1', elementId: 'rel-1', pieceId: null })])
    expect(resultat.map((p) => p.statut)).toEqual(['Enregistré', 'Enregistré'])
  })

  it('sens incohérent : un règlement est une sortie (montant négatif), un encaissement une entrée (positif)', () => {
    const entree = propagerStatutRapproche([reglement('r-1', 50_000)], [arrete([element('rel-1', 50_000, pieces('r-1'))])], REGLE)
    expect(entree.anomalies.map((a) => a.code)).toEqual(['sens_incoherent'])
    expect(entree.pieces[0].statut).toBe('Enregistré')

    const encaissement = { type: 'encaissement', id: 'e-1' } as const
    const regleEncaissement = { type: 'encaissement', rapproche: 'Rapproché', avant: 'Enregistré' } as const
    const sortie = propagerStatutRapproche([reglement('e-1', 8_000)], [arrete([element('rel-2', -8_000, [encaissement])])], regleEncaissement)
    expect(sortie.anomalies.map((a) => a.code)).toEqual(['sens_incoherent'])
    const bonSens = propagerStatutRapproche([reglement('e-1', 8_000)], [arrete([element('rel-2', 8_000, [encaissement])])], regleEncaissement)
    expect(bonSens.pieces[0].statut).toBe('Rapproché')
  })

  it('pièce inconnue : anomalie, et les autres pièces de l’élément ne passent pas', () => {
    const { pieces: resultat, anomalies } = propagerStatutRapproche(
      [reglement('r-1', 30_000)],
      [arrete([element('rel-1', -50_000, pieces('r-1', 'r-inconnu'))])],
      REGLE,
    )
    expect(anomalies).toEqual([expect.objectContaining({ code: 'piece_inconnue', pieceId: 'r-inconnu' })])
    expect(resultat[0].statut).toBe('Enregistré')
  })

  it('les pièces d’un autre type sont ignorées', () => {
    const { pieces: resultat, anomalies } = propagerStatutRapproche(
      [reglement('r-1', 30_000)],
      [arrete([element('rel-1', 30_000, [{ type: 'encaissement', id: 'r-1' }])])],
      REGLE,
    )
    expect(anomalies).toEqual([])
    expect(resultat[0].statut).toBe('Enregistré')
  })

  it('pièce pointée par deux éléments du même côté : anomalie, rien n’est propagé pour elle', () => {
    const { pieces: resultat, anomalies } = propagerStatutRapproche(
      [reglement('r-1', 30_000), reglement('r-2', 10_000)],
      [arrete([element('rel-1', -30_000, pieces('r-1')), element('rel-2', -30_000, pieces('r-1')), element('rel-3', -10_000, pieces('r-2'))])],
      REGLE,
    )
    expect(anomalies).toEqual([expect.objectContaining({ code: 'pointee_deux_fois', pieceId: 'r-1', elementId: 'rel-2' })])
    expect(resultat.map((p) => p.statut)).toEqual(['Enregistré', 'Rapproché'])
  })

  it('une pièce portée par la ligne du relevé et par l’écriture du 512 est admise ; le pointage le plus ancien est retenu', () => {
    const { pieces: resultat, anomalies } = propagerStatutRapproche(
      [reglement('r-1', 30_000)],
      [
        arrete([
          element('ecr-1', -30_000, pieces('r-1'), { cote: 'compta', rapprocheLe: '2026-10-13' }),
          element('rel-1', -30_000, pieces('r-1'), { rapprocheLe: '2026-10-13' }),
        ]),
      ],
      REGLE,
    )
    expect(anomalies).toEqual([])
    expect(resultat[0].rapprochement).toMatchObject({ elementId: 'rel-1', cote: 'banque', rapprocheLe: '2026-10-13' })
  })

  it('un même élément repris d’arrêté en arrêté ne donne qu’un rapprochement : le plus ancien', () => {
    const repris = (rapprocheLe: string) => element('rel-1', -30_000, pieces('r-1'), { rapprocheLe })
    const { pieces: resultat, anomalies } = propagerStatutRapproche(
      [reglement('r-1', 30_000)],
      [
        arrete([repris('2026-10-15')], { id: 'a-1', statut: 'Clôturé' }),
        arrete([repris('2026-10-25')], { id: 'a-2', dateArrete: '2026-10-30' }),
      ],
      REGLE,
    )
    expect(anomalies).toEqual([])
    expect(resultat[0].rapprochement).toMatchObject({ arreteId: 'a-1', rapprocheLe: '2026-10-15' })
  })

  it('élément en suspens dans un arrêté puis rapproché dans le suivant : la pièce est rapprochée', () => {
    const { pieces: resultat } = propagerStatutRapproche(
      [reglement('r-1', 30_000)],
      [
        arrete([element('rel-1', -30_000, pieces('r-1'), { rapproche: false, rapprocheLe: null })], { id: 'a-1', statut: 'Clôturé' }),
        arrete([element('rel-1', -30_000, pieces('r-1'), { rapprocheLe: '2026-10-25' })], { id: 'a-2', dateArrete: '2026-10-30' }),
      ],
      REGLE,
    )
    expect(resultat[0].rapprochement).toMatchObject({ arreteId: 'a-2', rapprocheLe: '2026-10-25' })
  })

  it('dépointage (après une déclôture) : la pièce « Rapproché » revient à « Enregistré »', () => {
    const dejaRapproche = reglement('r-1', 30_000, {
      statut: 'Rapproché',
      rapprochement: { arreteId: 'a-1', banqueId: 'b-courant', elementId: 'rel-1', cote: 'banque', mode: 'manuel', rapprocheLe: '2026-10-12' },
    })
    const { pieces: resultat } = propagerStatutRapproche(
      [dejaRapproche],
      [arrete([element('rel-1', -30_000, pieces('r-1'), { rapproche: false, rapprocheLe: null })])],
      REGLE,
    )
    expect(resultat[0]).toMatchObject({ statut: 'Enregistré', rapprochement: null })
  })

  it('une pièce déjà « Rapproché » impliquée dans une anomalie garde son état (aucun changement silencieux)', () => {
    const rapprochement = { arreteId: 'a-1', banqueId: 'b-courant', elementId: 'rel-1', cote: 'banque', mode: 'manuel', rapprocheLe: '2026-10-12' } as const
    const { pieces: resultat, anomalies } = propagerStatutRapproche(
      [reglement('r-1', 30_000, { statut: 'Rapproché', rapprochement })],
      [arrete([element('rel-1', -31_000, pieces('r-1'))])],
      REGLE,
    )
    expect(anomalies.map((a) => a.code)).toEqual(['montant_different'])
    expect(resultat[0]).toMatchObject({ statut: 'Rapproché', rapprochement })
  })

  it('statut incompatible : une pièce ni « avant » ni « rapproché » qui est pointée est signalée et laissée telle quelle', () => {
    const { pieces: resultat, anomalies } = propagerStatutRapproche(
      [reglement('r-1', 30_000, { statut: 'Annulé' }), reglement('r-2', 10_000, { statut: 'À régler' })],
      [arrete([element('rel-1', -30_000, pieces('r-1')), element('rel-2', -10_000, pieces('r-2'))])],
      REGLE,
    )
    expect(anomalies.map((a) => [a.code, a.pieceId])).toEqual([
      ['statut_incompatible', 'r-1'],
      ['statut_incompatible', 'r-2'],
    ])
    expect(resultat.map((p) => p.statut)).toEqual(['Annulé', 'À régler'])
  })

  it('pièce d’un autre compte bancaire que celui de l’arrêté : anomalie', () => {
    const { pieces: resultat, anomalies } = propagerStatutRapproche(
      [reglement('r-1', 30_000, { banqueId: 'b-fonds-travaux' })],
      [arrete([element('rel-1', -30_000, pieces('r-1'))])],
      REGLE,
    )
    expect(anomalies).toEqual([expect.objectContaining({ code: 'autre_compte', pieceId: 'r-1' })])
    expect(resultat[0].statut).toBe('Enregistré')
  })

  it('à une date : un pointage postérieur est ignoré, un pointage du jour compte', () => {
    const lignes = [element('rel-1', -30_000, pieces('r-1'), { rapprocheLe: '2026-10-12' })]
    expect(propagerStatutRapproche([reglement('r-1', 30_000)], [arrete(lignes)], { ...REGLE, aLaDate: '2026-10-11' }).pieces[0].statut).toBe('Enregistré')
    expect(propagerStatutRapproche([reglement('r-1', 30_000)], [arrete(lignes)], { ...REGLE, aLaDate: '2026-10-12' }).pieces[0].statut).toBe('Rapproché')
  })

  it('un élément rapproché qui porte des pièces exige sa date d’opération et sa date de rapprochement (règle de suspensA)', () => {
    const calcul = (surcharge: Partial<ElementRapprochement>) => () =>
      propagerStatutRapproche([reglement('r-1', 30_000)], [arrete([element('rel-1', -30_000, pieces('r-1'), surcharge)])], REGLE)
    expect(calcul({ rapprocheLe: null })).toThrow(/sans date de rapprochement/)
    expect(calcul({ date: undefined })).toThrow(/sans date d'opération valide/)
    expect(calcul({ rapprocheLe: '2026-10-01' })).toThrow(/antérieur à son opération/)
  })

  it('un élément sans pièce (rapprochement antérieur au point 38) est ignoré, même sans date de rapprochement', () => {
    const { pieces: resultat, anomalies } = propagerStatutRapproche(
      [reglement('r-1', 30_000)],
      [arrete([element('rel-ancien', -30_000, undefined, { rapprocheLe: null, date: undefined })])],
      REGLE,
    )
    expect(anomalies).toEqual([])
    expect(resultat[0].statut).toBe('Enregistré')
  })

  it('fonction pure et idempotente ; l’ordre des pièces est conservé', () => {
    const entree = [reglement('r-2', 10_000), reglement('r-1', 30_000)]
    const arretes = [arrete([element('rel-1', -30_000, pieces('r-1'))])]
    const copie = structuredClone({ entree, arretes })
    const premier = propagerStatutRapproche(entree, arretes, REGLE)
    expect({ entree, arretes }).toEqual(copie)
    expect(premier.pieces.map((p) => p.id)).toEqual(['r-2', 'r-1'])
    expect(propagerStatutRapproche(premier.pieces, arretes, REGLE)).toEqual(premier)
  })

  it('refuse une règle où « avant » et « rapproché » se confondent, une pièce en double, une date invalide', () => {
    const aucune: Piece[] = []
    expect(() => propagerStatutRapproche(aucune, [], { type: 'reglement', rapproche: 'Enregistré', avant: 'Enregistré' })).toThrow(/distincts/)
    expect(() => propagerStatutRapproche([reglement('r-1', 1), reglement('r-1', 1)], [], REGLE)).toThrow(/double/)
    expect(() => propagerStatutRapproche(aucune, [], { ...REGLE, aLaDate: '12/10/2026' })).toThrow(/AAAA-MM-JJ/)
  })

  it('le lien vers les pièces reste facultatif et ne change pas l’état de l’arrêté', () => {
    const avec = arrete([element('rel-1', -30_000, pieces('r-1'))], { soldeBanqueCentimes: -30_000, soldeComptaCentimes: -30_000 })
    const sans = { ...avec, elements: [element('rel-1', -30_000, undefined)] }
    expect(etatArrete(avec)).toEqual(etatArrete(sans))
  })

  it('en-tête : sources citées telles quelles ; le choix « au pointage » est la décision J8 de Hugo', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'rapprochement-pieces.ts'), 'utf8')
    const entete = source.slice(0, source.indexOf('export interface'))
    expect(entete).not.toMatch(/récent|du jour/)
    expect(entete).toMatch(/tranche 29[^;]*dix jours/)
    expect(entete.slice(entete.indexOf('🔵'), entete.indexOf('Tranché par Hugo'))).not.toMatch(/suit le pointage/i)
    expect(entete).toMatch(/Tranché par Hugo le 30\/10\/2026 \(décision J8\) : statut « Rapproché » au POINTAGE/)
    expect(entete).not.toMatch(/hypothèse de travail/)
  })

  it('titres des tests : le choix « au pointage » n’est jamais présenté comme déduit, il est rattaché à la décision J8', () => {
    const titres = readFileSync(join(__dirname, 'rapprochement-pieces.test.ts'), 'utf8').match(/\bit\('[^']*'/g) ?? []
    const surLePointage = titres.filter((titre) => /pointage/.test(titre))
    expect(surLePointage.filter((titre) => titre.includes('🔵'))).toEqual([])
    expect(surLePointage.filter((titre) => titre.includes('décision J8 : au pointage'))).toHaveLength(1)
  })
})
