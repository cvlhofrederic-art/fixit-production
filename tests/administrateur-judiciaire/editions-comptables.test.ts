import { describe, expect, it } from 'vitest'
import {
  balance,
  figerEdition,
  grandLivre,
  journalDesTraitements,
  verrouDesEditions,
  type SaisieEdition,
} from '@/lib/administrateur-judiciaire/domain/etats-comptables'
import { annulerTraitement, creerTraitement } from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * Point 27 du bilan — éditions figées (Gestéam, tranche 37 : « Inclus dans une édition », critère « Déjà inclus dans une
 * édition »). figerEdition marque les mouvements retenus par l'état ; verrouDesEditions en tire les bornes du verrou.
 */

const t = (id: string, famille: Parameters<typeof creerTraitement>[0]['famille'], date: string, lignes: [string, 'debit' | 'credit', number][]) =>
  creerTraitement({ id, famille, date, mouvements: lignes.map(([compte, sens, montantCentimes]) => ({ compte, sens, montantCentimes })) })

const traitements = [
  t('t1', 'Appel de fonds', '2026-01-05', [
    ['TILL.45000.00012.0', 'debit', 80_000],
    ['TILL.70100.00000.0', 'credit', 80_000],
  ]),
  t('t2', 'Encaissement', '2026-02-10', [
    ['TILL.51200.00000.0', 'debit', 50_000],
    ['TILL.45000.00012.0', 'credit', 50_000],
  ]),
  t('t3', 'Saisie de factures', '2026-04-15', [
    ['TILL.61500.00000.0', 'debit', 12_000],
    ['TILL.40100.PLOMB.0', 'credit', 12_000],
  ]),
]

const balanceT1: SaisieEdition = { id: 'ed-1', etat: 'Balance', du: '2026-01-01', au: '2026-03-31', editeeLe: '2026-04-05' }

const marques = (liste: { id: string; mouvements: { editionId?: string }[] }[]) =>
  liste.map((x) => [x.id, x.mouvements.map((m) => m.editionId ?? null)])

describe('figerEdition', () => {
  it('marque les mouvements de la période, compte ceux qu’elle marque, et laisse l’entrée intacte', () => {
    const instantane = structuredClone(traitements)
    const { edition, traitements: apres } = figerEdition(traitements, balanceT1, [])
    expect(edition).toEqual({ ...balanceT1, nbMouvementsMarques: 4 })
    expect(marques(apres)).toEqual([
      ['t1', ['ed-1', 'ed-1']],
      ['t2', ['ed-1', 'ed-1']],
      ['t3', [null, null]],
    ])
    expect(traitements).toEqual(instantane)
  })

  it('applique les filtres de l’état (familles, plage de comptes)', () => {
    const { edition, traitements: apres } = figerEdition(traitements, {
      ...balanceT1,
      id: 'ed-2',
      familles: ['Encaissement'],
      compteDu: 'TILL.51200.00000.0',
      compteAu: 'TILL.51299.ZZZZZ.Z',
    }, [])
    expect(edition.nbMouvementsMarques).toBe(1)
    expect(marques(apres)).toEqual([
      ['t1', [null, null]],
      ['t2', ['ed-2', null]],
      ['t3', [null, null]],
    ])
  })

  it('un mouvement déjà inclus garde sa première édition', () => {
    const premiere = figerEdition(traitements, { ...balanceT1, au: '2026-01-31' }, []).traitements
    const { edition, traitements: apres } = figerEdition(premiere, { ...balanceT1, id: 'ed-2', etat: 'Grand livre' }, [])
    expect(edition.nbMouvementsMarques).toBe(2)
    expect(marques(apres)).toEqual([
      ['t1', ['ed-1', 'ed-1']],
      ['t2', ['ed-2', 'ed-2']],
      ['t3', [null, null]],
    ])
  })

  it('refuse une saisie incohérente', () => {
    expect(() => figerEdition(traitements, { ...balanceT1, au: '2026-04-06' }, [])).toThrow(/2026-04-05.*2026-04-06/)
    expect(() => figerEdition(traitements, { ...balanceT1, du: '2026-04-01' }, [])).toThrow(/période invalide/i)
    expect(() => figerEdition(traitements, { ...balanceT1, editeeLe: '05/04/2026' }, [])).toThrow(/date invalide/i)
    expect(() => figerEdition(traitements, { ...balanceT1, id: '' }, [])).toThrow(/identifiant/i)
    expect(() => figerEdition(traitements, { ...balanceT1, etat: 'Pointe de garantie' as SaisieEdition['etat'] }, [])).toThrow(/Pointe de garantie/)
    expect(() => figerEdition(traitements, { ...balanceT1, etat: 'Journaux', compteDu: 'TILL.51200.00000.0' }, [])).toThrow(/journal/i)
  })

  it('refuse une édition au périmètre vide ou incohérent (elle poserait une borne qui ne verrouille rien)', () => {
    expect(() => figerEdition(traitements, { ...balanceT1, familles: [] }, [])).toThrow(/ed-1.*familles vide/)
    expect(() => figerEdition(traitements, { ...balanceT1, compteDu: 'TILL.6', compteAu: 'TILL.5' }, [])).toThrow(
      /ed-1.*plage de comptes inversée/,
    )
  })

  it('refuse de figer deux fois la même édition (marques des mouvements)', () => {
    const { traitements: apres } = figerEdition(traitements, balanceT1, [])
    expect(() => figerEdition(apres, { ...balanceT1, au: '2026-04-05' }, [])).toThrow(/ed-1.*déjà figée/)
  })

  it('refuse de figer deux fois la même édition, même quand sa première fois n’a marqué aucun mouvement', () => {
    const vide: SaisieEdition = { id: 'ed-vide', etat: 'Balance', du: '2025-10-01', au: '2025-12-31', editeeLe: '2026-01-05' }
    const premiere = figerEdition(traitements, vide, [])
    expect(premiere.edition.nbMouvementsMarques).toBe(0)
    expect(() => figerEdition(premiere.traitements, vide, [premiere.edition])).toThrow(/ed-vide.*déjà figée/)

    const ed1 = figerEdition(traitements, balanceT1, [])
    const janvier = figerEdition(ed1.traitements, { ...balanceT1, id: 'ed-2', au: '2026-01-31' }, [ed1.edition])
    expect(janvier.edition.nbMouvementsMarques).toBe(0)
    const deuxiemeTrimestre: SaisieEdition = { ...balanceT1, id: 'ed-2', du: '2026-04-01', au: '2026-06-30', editeeLe: '2026-07-01' }
    expect(() => figerEdition(janvier.traitements, deuxiemeTrimestre, [ed1.edition, janvier.edition])).toThrow(/ed-2.*déjà figée/)
  })
})

describe('critère « Déjà inclus dans une édition »', () => {
  const { traitements: apres } = figerEdition(traitements, balanceT1, [])

  it('balance et grand livre ne retiennent que les mouvements inclus (true) ou non inclus (false) ; absent, tous', () => {
    expect(balance(apres, { inclusDansEdition: true }).lignes.map((l) => l.compte)).toEqual([
      'TILL.45000.00012.0',
      'TILL.51200.00000.0',
      'TILL.70100.00000.0',
    ])
    expect(balance(apres, { inclusDansEdition: false }).lignes.map((l) => l.compte)).toEqual(['TILL.40100.PLOMB.0', 'TILL.61500.00000.0'])
    expect(balance(apres).lignes).toHaveLength(5)
    expect(grandLivre(apres, { inclusDansEdition: false }).map((c) => c.compte)).toEqual(['TILL.40100.PLOMB.0', 'TILL.61500.00000.0'])
  })

  it('le journal retient un traitement dont un mouvement répond au critère', () => {
    expect(journalDesTraitements(apres, { inclusDansEdition: true }).map((j) => j.traitementId)).toEqual(['t1', 't2'])
    expect(journalDesTraitements(apres, { inclusDansEdition: false }).map((j) => j.traitementId)).toEqual(['t3'])
    expect(journalDesTraitements(apres).map((j) => j.traitementId)).toEqual(['t1', 't2', 't3'])
  })
})

describe('verrouDesEditions', () => {
  it('une borne par édition, jusqu’à la fin de sa période, limitée à ses comptes et à ses familles', () => {
    const complete = figerEdition(traitements, balanceT1, []).edition
    const partielle = figerEdition(traitements, {
      ...balanceT1,
      id: 'ed-2',
      etat: 'Journaux',
      familles: ['Encaissement'],
    }, []).edition
    const parComptes = figerEdition(traitements, { ...balanceT1, id: 'ed-3', compteDu: 'TILL.51200.00000.0', compteAu: 'TILL.51299.ZZZZZ.Z' }, []).edition
    expect(verrouDesEditions([complete, partielle, parComptes])).toEqual([
      { jusquAu: '2026-03-31', origine: 'edition', reference: 'ed-1' },
      { jusquAu: '2026-03-31', origine: 'edition', reference: 'ed-2', familles: ['Encaissement'] },
      { jusquAu: '2026-03-31', origine: 'edition', reference: 'ed-3', compteDu: 'TILL.51200.00000.0', compteAu: 'TILL.51299.ZZZZZ.Z' },
    ])
  })

  it('refuse deux éditions de même identifiant (bornes en double ou contradictoires)', () => {
    const { edition } = figerEdition(traitements, balanceT1, [])
    expect(() => verrouDesEditions([edition, { ...edition, au: '2026-01-31' }])).toThrow(/ed-1.*en double/)
  })

  it('de bout en bout : la saisie dans la période éditée est refusée, l’annulation datée après la borne passe et reste hors édition', () => {
    const { edition, traitements: apres } = figerEdition(traitements, balanceT1, [])
    const verrou = verrouDesEditions([edition])
    expect(() =>
      creerTraitement(
        {
          id: 't4',
          famille: 'Encaissement',
          date: '2026-03-20',
          mouvements: [
            { compte: 'TILL.51200.00000.0', sens: 'debit', montantCentimes: 1_000 },
            { compte: 'TILL.45000.00012.0', sens: 'credit', montantCentimes: 1_000 },
          ],
        },
        { verrou },
      ),
    ).toThrow(/édition « ed-1 »/)
    const annulation = annulerTraitement(apres[1], { id: 't2-a', date: '2026-04-06', verrou })
    expect(journalDesTraitements([...apres, annulation], { inclusDansEdition: false }).map((j) => j.traitementId)).toEqual(['t2-a', 't3'])
  })
})
