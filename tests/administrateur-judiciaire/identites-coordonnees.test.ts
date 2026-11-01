import { describe, expect, it } from 'vitest'
import {
  adresseDeNotification,
  adressesValablesA,
  controlerAdresses,
  creerAdresseDatee,
  creerCompteCoproprietaire,
  creerIdentite,
  creerPosition,
  identitesDuGroupe,
  migrerCoproprietaire,
  participationsIdentite,
  positionsEnPlace,
  positionsIdentite,
  representantsLegauxA,
  statutPositionA,
  type AdresseDatee,
  type SaisieIdentite,
  type SaisiePosition,
} from '@/lib/administrateur-judiciaire/domain/identites-positions'

/**
 * Coordonnées et rattachements d'une identité (point 59 du bilan 2 ; Gestéam, tranche 37 § Identités : adresses datées
 * « À partir du … jusqu'au … », bouton Représentant légal, groupes ; tranche 39 : grilles Positions et Participations).
 * D. 1967 art. 65 al. 2 : notification valable à la dernière adresse communiquée par le copropriétaire à cet effet.
 */

const adresse = (surcharge: Partial<AdresseDatee> = {}): AdresseDatee =>
  creerAdresseDatee({
    id: 'adr-1',
    lignes: ['12 rue des Tilleuls'],
    codePostal: '13001',
    ville: 'Marseille',
    pays: 'France',
    usage: null,
    du: '2020-05-04',
    au: null,
    communiqueeLe: null,
    ...surcharge,
  })

const identite = (surcharge: Partial<SaisieIdentite> = {}) =>
  creerIdentite({ id: 'id-1', nature: 'physique', civilite: 'Madame', nom: 'Durand', prenom: 'Anne', telecoms: [], ...surcharge })

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

describe('point 59 — adresses datées', () => {
  it('nettoie l’adresse ; pays par défaut France ; refuse une adresse sans ligne, sans ville, un code postal français invalide, des dates incohérentes', () => {
    expect(adresse({ lignes: ['  12  rue des Tilleuls ', ' '], pays: ' ' })).toMatchObject({ lignes: ['12 rue des Tilleuls'], pays: 'France' })
    expect(adresse({ pays: 'Belgique', codePostal: '1000' }).codePostal).toBe('1000')
    expect(adresse({ pays: ' FRANCE ' }).pays).toBe('France')
    expect(() => adresse({ pays: 'france', codePostal: '1300' })).toThrow(/code postal/i)
    expect(() => adresse({ lignes: [' '] })).toThrow(/ligne/i)
    expect(() => adresse({ ville: ' ' })).toThrow(/ville/i)
    expect(() => adresse({ codePostal: '1300' })).toThrow(/code postal/i)
    expect(() => adresse({ du: '04/05/2020' })).toThrow(/AAAA-MM-JJ/)
    expect(() => adresse({ au: '2019-12-31' })).toThrow(/antérieure/i)
    expect(() => adresse({ communiqueeLe: '2020-13-01' })).toThrow(/AAAA-MM-JJ/)
  })

  it('adresses valables à une date : bornes « à partir du … jusqu’au … » incluses', () => {
    const temporaire = adresse({ id: 'adr-2', du: '2026-07-01', au: '2026-08-31' })
    const fiche = identite({ adresses: [adresse(), temporaire] })
    expect(adressesValablesA(fiche, '2026-06-30').map((a) => a.id)).toEqual(['adr-1'])
    expect(adressesValablesA(fiche, '2026-07-01').map((a) => a.id)).toEqual(['adr-1', 'adr-2'])
    expect(adressesValablesA(fiche, '2026-08-31').map((a) => a.id)).toEqual(['adr-1', 'adr-2'])
    expect(adressesValablesA(fiche, '2026-09-01').map((a) => a.id)).toEqual(['adr-1'])
    expect(() => adressesValablesA(fiche, '01/09/2026')).toThrow(/AAAA-MM-JJ/)
  })

  it('adresse de notification : la dernière communiquée qui vaut à la date — l’adresse temporaire l’emporte pendant sa période', () => {
    const fiche = identite({ adresses: [adresse(), adresse({ id: 'adr-2', du: '2026-07-01', au: '2026-08-31' })] })
    expect(adresseDeNotification(fiche, '2026-07-15')?.id).toBe('adr-2')
    expect(adresseDeNotification(fiche, '2026-09-01')?.id).toBe('adr-1')
    expect(adresseDeNotification(fiche, '2019-01-01')).toBeNull()
    expect(() => adresseDeNotification(fiche, '15/07/2026')).toThrow(/AAAA-MM-JJ/)
  })

  it('une adresse ne vaut pour la notification qu’à compter de sa réception par le syndic ; d’ici là, la dernière communiquée reste valable, même close', () => {
    const nouvelle = adresse({ id: 'adr-2', du: '2026-03-01', communiqueeLe: '2026-04-10' })
    const fiche = identite({ adresses: [adresse({ au: '2026-02-28' }), nouvelle] })
    expect(adressesValablesA(fiche, '2026-03-15').map((a) => a.id)).toEqual(['adr-2'])
    expect(adresseDeNotification(fiche, '2026-03-15')?.id).toBe('adr-1')
    expect(controlerAdresses(fiche, '2026-03-15')).toMatchObject([{ code: 'adresse_echue' }])
    expect(controlerAdresses(fiche, '2026-03-15')[0].message).toMatch(/art\. 65/)
    expect(adresseDeNotification(fiche, '2026-04-10')?.id).toBe('adr-2')
    expect(controlerAdresses(fiche, '2026-04-10')).toEqual([])
    const ancienne = identite({ adresses: [adresse(), nouvelle] })
    expect(adresseDeNotification(ancienne, '2026-03-15')?.id).toBe('adr-1')
    expect(adresseDeNotification(ancienne, '2026-04-10')?.id).toBe('adr-2')
  })

  it('à même date de prise d’effet, l’adresse bornée l’emporte ; deux adresses indiscernables : aucune n’est retenue, le contrôle le signale', () => {
    const bornee = adresse({ id: 'adr-2', du: '2020-05-04', au: '2026-12-31' })
    expect(adresseDeNotification(identite({ adresses: [adresse(), bornee] }), '2026-07-15')?.id).toBe('adr-2')
    const concurrentes = identite({ adresses: [adresse(), adresse({ id: 'adr-3', lignes: ['3 place Castellane'] })] })
    expect(adresseDeNotification(concurrentes, '2026-07-15')).toBeNull()
    expect(controlerAdresses(concurrentes, '2026-07-15').map((a) => a.code)).toEqual(['adresses_concurrentes'])
    expect(controlerAdresses(identite(), '2026-07-15').map((a) => a.code)).toEqual(['sans_adresse'])
    expect(controlerAdresses(identite({ adresses: [adresse()] }), '2026-07-15')).toEqual([])
  })

  it('refuse deux adresses de même identifiant', () => {
    expect(() => identite({ adresses: [adresse(), adresse()] })).toThrow(/adr-1/)
  })
})

describe('point 59 — groupes', () => {
  it('groupes de GROUPE_IDENTITE, sans doublon ; un groupe inconnu est refusé', () => {
    expect(identite({ groupes: ['Copie CS', 'Voisin'] }).groupes).toEqual(['Copie CS', 'Voisin'])
    expect(() => identite({ groupes: ['Copie CS', 'Copie CS'] })).toThrow(/double/i)
    // @ts-expect-error — groupe hors référentiel
    expect(() => identite({ groupes: ['Ami'] })).toThrow(/inconnu/i)
  })

  it('identités d’un groupe, triées par nom', () => {
    const identites = [
      identite({ id: 'id-1', nom: 'Martin', groupes: ['Copie CS'] }),
      identite({ id: 'id-2', nom: 'Étienne', groupes: ['Copie CS', 'Voisin'] }),
      identite({ id: 'id-3', nom: 'Durand', groupes: ['Voisin'] }),
    ]
    expect(identitesDuGroupe(identites, 'Copie CS').map((i) => i.nom)).toEqual(['Étienne', 'Martin'])
  })
})

describe('point 59 — représentant légal', () => {
  const sci = (representants: SaisieIdentite['representants']) =>
    identite({ id: 'id-sci', nature: 'morale', civilite: 'S.C.I.', nom: 'SCI Les Pins', prenom: null, representants })

  it('réservé aux personnes morales ; pas soi-même ; dates cohérentes', () => {
    expect(() => identite({ representants: [{ identiteId: 'id-9', fonction: 'Gérant', du: '2020-01-01', au: null }] })).toThrow(/morale/i)
    expect(() => sci([{ identiteId: 'id-sci', fonction: null, du: '2020-01-01', au: null }])).toThrow(/elle-même/i)
    expect(() => sci([{ identiteId: 'id-9', fonction: null, du: '2020-01-01', au: '2019-01-01' }])).toThrow(/antérieure/i)
    expect(() => sci([{ identiteId: ' ', fonction: null, du: '2020-01-01', au: null }])).toThrow(/identité/i)
    expect(sci(undefined).representants).toEqual([])
    expect(sci([{ identiteId: ' id-9 ', fonction: ' ', du: '2020-01-01', au: null }]).representants).toEqual([
      { identiteId: 'id-9', fonction: null, du: '2020-01-01', au: null },
    ])
    expect(() => sci([{ identiteId: ' id-sci ', fonction: null, du: '2020-01-01', au: null }])).toThrow(/elle-même/i)
  })

  it('représentants valables à une date (bornes incluses) ; plusieurs co-gérants possibles', () => {
    const fiche = sci([
      { identiteId: 'id-7', fonction: 'Gérant', du: '2015-01-01', au: '2023-06-30' },
      { identiteId: 'id-8', fonction: 'Gérant', du: '2023-07-01', au: null },
      { identiteId: 'id-9', fonction: 'Co-gérant', du: '2023-07-01', au: null },
    ])
    expect(representantsLegauxA(fiche, '2023-06-30').map((r) => r.identiteId)).toEqual(['id-7'])
    expect(representantsLegauxA(fiche, '2026-10-29').map((r) => r.identiteId)).toEqual(['id-8', 'id-9'])
    expect(representantsLegauxA(identite(), '2026-10-29')).toEqual([])
    expect(() => representantsLegauxA(fiche, '29/10/2026')).toThrow(/AAAA-MM-JJ/)
  })
})

describe('point 59 — positions d’une identité', () => {
  const positions = [
    position(),
    position({ id: 'p-2', lotId: 'lot-3', dateEntree: '2027-01-01', statut: 'Futur' }),
    position({ id: 'p-3', lotId: 'lot-40', dateEntree: '2015-01-01', dateSortie: '2020-05-04', statut: 'Sorti' }),
    position({ id: 'p-4', lotId: 'lot-7', compteId: null, part: null, qualite: 'Locataire', dateEntree: '2026-11-01' }),
    position({ id: 'p-5', identiteId: 'id-2', lotId: 'lot-12' }),
  ]

  it('statut à une date : cohérent avec positionsEnPlace', () => {
    for (const date of ['2015-01-01', '2020-05-03', '2020-05-04', '2026-10-29', '2026-11-01', '2027-01-01'])
      for (const p of positions)
        expect(statutPositionA(p, date) === 'En place').toBe(positionsEnPlace([p], p.lotId, date).length === 1)
    expect(statutPositionA(positions[2], '2020-05-04')).toBe('Sorti')
    expect(statutPositionA(positions[3], '2026-10-29')).toBe('Futur')
    expect(statutPositionA(positions[1], '2027-06-01')).toBe('Futur')
    expect(() => statutPositionA(positions[0], '29/10/2026')).toThrow(/AAAA-MM-JJ/)
  })

  it('tri par n° du lot joint (numérique), pas par identifiant', () => {
    const deux = [position({ id: 'p-a', lotId: 'lot-a' }), position({ id: 'p-b', lotId: 'lot-b' })]
    const lots = [
      { id: 'lot-a', coproprieteId: 'copro-tilleuls', numero: '10' },
      { id: 'lot-b', coproprieteId: 'copro-tilleuls', numero: '2' },
    ]
    expect(positionsIdentite(deux, 'id-1', { lots }).map((l) => l.lot?.numero)).toEqual(['2', '10'])
  })

  it('grille Positions : en place, puis futures, puis sorties, puis n° de lot ; jointure du lot', () => {
    const lots = [
      { id: 'lot-12', coproprieteId: 'copro-tilleuls', numero: '12' },
      { id: 'lot-7', coproprieteId: 'copro-tilleuls', numero: '7' },
      { id: 'lot-40', coproprieteId: 'copro-pins', numero: '40' },
    ]
    const grille = positionsIdentite(positions, 'id-1', { date: '2026-10-29', lots })
    expect(grille.map((l) => [l.position.id, l.statut, l.lot?.numero ?? null])).toEqual([
      ['p-1', 'En place', '12'],
      ['p-4', 'Futur', '7'],
      ['p-2', 'Futur', null],
      ['p-3', 'Sorti', '40'],
    ])
    // Sans date : statut enregistré ; lots inconnus, triés par identifiant (lot-7 avant lot-12).
    expect(positionsIdentite(positions, 'id-1').map((l) => [l.position.id, l.statut])).toEqual([
      ['p-4', 'En place'],
      ['p-1', 'En place'],
      ['p-2', 'Futur'],
      ['p-3', 'Sorti'],
    ])
    expect(() => positionsIdentite(positions, 'id-1', { date: '29/10/2026' })).toThrow(/AAAA-MM-JJ/)
  })
})

describe('point 59 — participations', () => {
  const comptes = [
    creerCompteCoproprietaire({ id: 'cpt-12', coproprieteId: 'copro-tilleuls', serie: '12', libelle: 'Indivision Durand' }),
    creerCompteCoproprietaire({ id: 'cpt-20', coproprieteId: 'copro-tilleuls', serie: '20', libelle: ' ' }),
  ]

  it('indivision : la part de l’identité et le total des parts en place sur le même compte, lot et droit', () => {
    const positions = [
      position({ qualite: 'Indivisaire', part: { numerateur: 1, denominateur: 2 } }),
      position({ id: 'p-2', identiteId: 'id-2', qualite: 'Indivisaire', part: { numerateur: 2, denominateur: 4 } }),
      position({ id: 'p-3', identiteId: 'id-3', qualite: 'Indivisaire', part: { numerateur: 1, denominateur: 2 }, dateEntree: '2010-01-01', dateSortie: '2020-05-04', statut: 'Sorti' }),
      // Même lot, même droit, autre compte : hors du total.
      position({ id: 'p-4', identiteId: 'id-4', qualite: 'Indivisaire', part: { numerateur: 1, denominateur: 2 }, compteId: 'cpt-99' }),
    ]
    expect(participationsIdentite(positions, comptes, 'id-1', '2026-10-29')).toEqual([
      { compteId: 'cpt-12', libelle: 'Indivision Durand', lotId: 'lot-12', qualite: 'Indivisaire', part: { numerateur: 1, denominateur: 2 }, total: { numerateur: 1, denominateur: 1 }, statut: 'En place' },
    ])
  })

  it('démembrement : la nue-propriété et l’usufruit se totalisent séparément ; un plein propriétaire seul n’a pas de participation', () => {
    const positions = [
      position({ qualite: 'Nu propriétaire', part: { numerateur: 1, denominateur: 2 } }),
      position({ id: 'p-2', identiteId: 'id-2', qualite: 'Nu propriétaire', part: { numerateur: 1, denominateur: 2 } }),
      position({ id: 'p-3', identiteId: 'id-3', qualite: 'Usufruitier' }),
      position({ id: 'p-4', identiteId: 'id-3', lotId: 'lot-13', compteId: 'cpt-20' }),
    ]
    expect(participationsIdentite(positions, comptes, 'id-1', '2026-10-29').map((p) => [p.qualite, p.total])).toEqual([
      ['Nu propriétaire', { numerateur: 1, denominateur: 1 }],
    ])
    expect(participationsIdentite(positions, comptes, 'id-3', '2026-10-29')).toEqual([])
  })

  it('associé : participation même à part entière ; compte sans libellé ou introuvable : libellé null', () => {
    const positions = [
      position({ qualite: 'Associé(e)', compteId: 'cpt-20' }),
      position({ id: 'p-2', lotId: 'lot-13', qualite: 'Indivisaire', compteId: 'cpt-inconnu', part: { numerateur: 1, denominateur: 3 } }),
    ]
    expect(participationsIdentite(positions, comptes, 'id-1', '2026-10-29').map((p) => [p.compteId, p.libelle, p.total])).toEqual([
      ['cpt-20', null, { numerateur: 1, denominateur: 1 }],
      ['cpt-inconnu', null, { numerateur: 1, denominateur: 3 }],
    ])
  })

  it('une participation sortie garde sa part ; son total est celui des parts en place à la date', () => {
    const positions = [
      position({ qualite: 'Indivisaire', part: { numerateur: 1, denominateur: 2 }, dateSortie: '2026-01-01', statut: 'Sorti' }),
      position({ id: 'p-2', identiteId: 'id-2', qualite: 'Indivisaire', part: { numerateur: 1, denominateur: 1 }, dateEntree: '2026-01-01' }),
    ]
    expect(participationsIdentite(positions, comptes, 'id-1', '2026-10-29')).toMatchObject([
      { part: { numerateur: 1, denominateur: 2 }, total: { numerateur: 1, denominateur: 1 }, statut: 'Sorti' },
    ])
  })
})

describe('point 59 — compatibilité', () => {
  it('une identité créée sans coordonnées n’a ni adresse, ni groupe, ni représentant ; la migration D2 non plus', () => {
    expect(identite()).toMatchObject({ adresses: [], groupes: [], representants: [] })
    const { identite: migree } = migrerCoproprietaire(
      { id: 'cp-1', lotId: 'lot-12', nom: 'Durand Anne', tel: '', mail: '', statut: 'à jour' },
      { coproprieteId: 'copro-tilleuls', serie: '00012', dateEntree: '2020-05-04' },
    )
    expect(migree).toMatchObject({ adresses: [], groupes: [], representants: [] })
  })
})
