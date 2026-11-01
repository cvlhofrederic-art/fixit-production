import { describe, expect, it } from 'vitest'
import {
  controlerDroitsLot,
  creerCompteCoproprietaire,
  creerIdentite,
  creerPosition,
  migrerCoproprietaire,
  muterLot,
  numeroCompteCoproprietaire,
  positionsEnPlace,
  type SaisiePosition,
} from '@/lib/administrateur-judiciaire/domain/identites-positions'

/**
 * Décision D2 (Hugo Carvalho, 27/10/2026) — Identité / Position / Compte copropriétaire (fiche client Gestéam,
 * tranche 30 ; qualités QUALITE_IDENTITE, tranche 20).
 * - Identité : la personne physique ou morale, une fois pour tout le cabinet.
 * - Position : le rôle d'une identité sur un lot (qualité, part, statut, dates).
 * - Compte copropriétaire : le débiteur d'un syndicat (compte 450 à numéro de série, D1), qui regroupe les positions.
 * Indivision / démembrement : un compte, plusieurs identités, des parts. Mutation : on clôt et on ouvre, sans effacer.
 */

const position = (surcharge: Partial<SaisiePosition> = {}) =>
  creerPosition({
    id: 'p-1',
    identiteId: 'id-1',
    lotId: 'lot-12',
    compteId: 'cpt-12',
    qualite: 'Copropriétaire',
    part: { numerateur: 1, denominateur: 1 },
    statut: 'En place',
    dateEntree: '2020-05-04',
    dateSortie: null,
    ...surcharge,
  })

describe('D2 — identité et compte', () => {
  it('crée une identité physique ou morale, nom nettoyé', () => {
    expect(creerIdentite({ id: 'id-1', nature: 'physique', civilite: 'Madame', nom: '  Durand ', prenom: 'Anne', telecoms: [] })).toMatchObject({
      nom: 'Durand',
      prenom: 'Anne',
    })
    expect(creerIdentite({ id: 'id-2', nature: 'morale', civilite: 'S.C.I.', nom: 'SCI Les Pins', prenom: null, telecoms: [] }).nature).toBe('morale')
    expect(() => creerIdentite({ id: 'x', nature: 'physique', civilite: 'Monsieur', nom: ' ', prenom: null, telecoms: [] })).toThrow(/nom/i)
  })

  it('compte copropriétaire : série sur 5 caractères ; numéro <syndicat>.45000.<série>.0 (D1)', () => {
    const compte = creerCompteCoproprietaire({ id: 'cpt-12', coproprieteId: 'copro-tilleuls', serie: '12', libelle: 'Indivision Durand' })
    expect(compte.serie).toBe('00012')
    expect(numeroCompteCoproprietaire(compte, 'TILL')).toBe('TILL.45000.00012.0')
    expect(() => creerCompteCoproprietaire({ id: 'c', coproprieteId: 'x', serie: '1234567', libelle: '' })).toThrow(/série/i)
  })
})

describe('D2 — positions', () => {
  it('une position de copropriété exige un compte et une part ; une position de location, non', () => {
    expect(() => position({ compteId: null })).toThrow(/compte/i)
    expect(() => position({ part: null })).toThrow(/part/i)
    expect(position({ qualite: 'Locataire', compteId: null, part: null }).qualite).toBe('Locataire')
  })

  it('refuse une qualité hors périmètre (gérance), une part invalide, des dates incohérentes', () => {
    expect(() => position({ qualite: 'Propriétaire' as never })).toThrow(/qualit/i)
    expect(() => position({ part: { numerateur: 3, denominateur: 2 } })).toThrow(/part/i)
    expect(() => position({ dateSortie: '2019-01-01' })).toThrow(/sortie/i)
    expect(() => position({ dateEntree: '04/05/2020' })).toThrow(/date/i)
  })

  it('positions en place à une date : entrée passée, pas encore sortie, statut ≠ Futur', () => {
    const positions = [
      position(),
      position({ id: 'p-2', identiteId: 'id-2', dateEntree: '2027-01-01', statut: 'Futur' }),
      position({ id: 'p-3', identiteId: 'id-3', dateEntree: '2015-01-01', dateSortie: '2020-05-04', statut: 'Sorti' }),
      position({ id: 'p-4', lotId: 'lot-13' }),
    ]
    expect(positionsEnPlace(positions, 'lot-12', '2026-10-27').map((p) => p.id)).toEqual(['p-1'])
    expect(positionsEnPlace(positions, 'lot-12', '2018-01-01').map((p) => p.id)).toEqual(['p-3'])
  })
})

describe('D2 — contrôle des droits sur un lot', () => {
  const demi = { numerateur: 1, denominateur: 2 }

  it('pleine propriété unique ou indivision dont les parts font 1 : conforme', () => {
    expect(controlerDroitsLot([position()])).toEqual([])
    expect(
      controlerDroitsLot([
        position({ qualite: 'Indivisaire', part: demi }),
        position({ id: 'p-2', identiteId: 'id-2', qualite: 'Indivisaire', part: { numerateur: 2, denominateur: 4 } }),
      ]),
    ).toEqual([])
  })

  it('démembrement : nue-propriété et usufruit, chacun à 1, sur le même compte', () => {
    expect(
      controlerDroitsLot([
        position({ qualite: 'Nu propriétaire' }),
        position({ id: 'p-2', identiteId: 'id-2', qualite: 'Usufruitier' }),
      ]),
    ).toEqual([])
  })

  it('signale : parts ≠ 1, aucun propriétaire, pleine propriété mêlée au démembrement, plusieurs comptes', () => {
    const codes = (positions: ReturnType<typeof position>[]) => controlerDroitsLot(positions).map((a) => a.code)
    expect(codes([position({ qualite: 'Indivisaire', part: demi })])).toEqual(['parts_incompletes'])
    expect(codes([position({ qualite: 'Locataire', compteId: null, part: null })])).toEqual(['sans_proprietaire'])
    expect(codes([position(), position({ id: 'p-2', identiteId: 'id-2', qualite: 'Usufruitier' })])).toEqual(['droits_incompatibles'])
    expect(
      codes([
        position({ qualite: 'Indivisaire', part: demi }),
        position({ id: 'p-2', identiteId: 'id-2', qualite: 'Indivisaire', part: demi, compteId: 'cpt-99' }),
      ]),
    ).toEqual(['comptes_multiples'])
  })
})

describe('D2 — mutation', () => {
  it('clôt les positions sortantes, ouvre les entrantes, garde l’historique', () => {
    const avant = [position()]
    const { positions, anomalies } = muterLot(avant, {
      lotId: 'lot-12',
      date: '2026-11-15',
      sortantes: ['p-1'],
      entrantes: [{ id: 'p-9', identiteId: 'id-9', compteId: 'cpt-40', qualite: 'Copropriétaire', part: { numerateur: 1, denominateur: 1 } }],
    })
    expect(anomalies).toEqual([])
    expect(positions.find((p) => p.id === 'p-1')).toMatchObject({ statut: 'Sorti', dateSortie: '2026-11-15' })
    expect(positions.find((p) => p.id === 'p-9')).toMatchObject({ statut: 'En place', dateEntree: '2026-11-15', lotId: 'lot-12' })
    expect(avant[0].statut).toBe('En place')
    expect(positionsEnPlace(positions, 'lot-12', '2026-11-15').map((p) => p.id)).toEqual(['p-9'])
  })

  it('refuse de sortir une position absente ou d’un autre lot ; signale une mutation qui laisse des parts incomplètes', () => {
    expect(() => muterLot([position()], { lotId: 'lot-12', date: '2026-11-15', sortantes: ['p-x'], entrantes: [] })).toThrow(/introuvable/i)
    const { anomalies } = muterLot([position()], {
      lotId: 'lot-12',
      date: '2026-11-15',
      sortantes: ['p-1'],
      entrantes: [{ id: 'p-9', identiteId: 'id-9', compteId: 'cpt-40', qualite: 'Indivisaire', part: { numerateur: 1, denominateur: 2 } }],
    })
    expect(anomalies.map((a) => a.code)).toEqual(['parts_incompletes'])
  })
})

describe('D2 — migration de l’ancien copropriétaire (une fiche par lot)', () => {
  it('donne une identité, un compte et une position de pleine propriété', () => {
    const migre = migrerCoproprietaire(
      { id: 'cp-1', lotId: 'lot-12', nom: 'Durand Anne', tel: '04 00 00 00 00', mail: 'anne@example.test', statut: 'à jour' },
      { coproprieteId: 'copro-tilleuls', serie: '00012', dateEntree: '2020-05-04' },
    )
    expect(migre.identite).toMatchObject({ id: 'id-cp-1', nature: 'physique', nom: 'Durand Anne' })
    expect(migre.identite.telecoms).toEqual([
      { nature: 'Téléphone', valeur: '04 00 00 00 00' },
      { nature: 'E-mail', valeur: 'anne@example.test' },
    ])
    expect(migre.compte).toMatchObject({ id: 'cpt-cp-1', serie: '00012', coproprieteId: 'copro-tilleuls' })
    expect(migre.position).toMatchObject({
      identiteId: 'id-cp-1',
      compteId: 'cpt-cp-1',
      lotId: 'lot-12',
      qualite: 'Copropriétaire',
      part: { numerateur: 1, denominateur: 1 },
      statut: 'En place',
    })
  })
})
