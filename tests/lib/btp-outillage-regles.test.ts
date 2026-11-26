// @vitest-environment node
// tests/lib/btp-outillage-regles.test.ts — règles pures de l'outillage BTP (26/11/2026) : le vendredi de la
// semaine, l'état de la vérification d'un chantier, le contrôle de la liste vérifiée, les formulaires reçus.

import { describe, expect, it } from 'vitest'
import {
  decalerDate, etatVerification, lignesAEnregistrer, outilPourEcran, outilSchema, vendrediDeReference,
  verificationPourEcran, verificationSchema, type OutilEcran,
} from '@/lib/btp/outillage-regles'

const ID_A = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c01'
const ID_B = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c02'
const CHANTIER = '3e4f5a6b-7c8d-4e9f-8a1b-2c3d4e5f6a01'

const outil = (id: string, quantite = 1, valeurs: Partial<OutilEcran> = {}): OutilEcran => ({
  id, type: 'outil', nom: `Outil ${id.slice(-2)}`, reference: null, quantite, chantierId: CHANTIER, etat: 'ok', notes: null,
  surPlaceDepuis: '2026-11-02', ...valeurs,
})

describe('vendrediDeReference — la semaine va du vendredi au jeudi', () => {
  it.each([
    ['2026-11-27', '2026-11-27'], // vendredi : lui-même
    ['2026-11-28', '2026-11-27'], // samedi
    ['2026-11-29', '2026-11-27'], // dimanche
    ['2026-11-30', '2026-11-27'], // lundi : en retard, pour le vendredi qui précède
    ['2026-12-03', '2026-11-27'], // jeudi
    ['2026-12-04', '2026-12-04'], // vendredi suivant
    ['2026-11-26', '2026-11-20'], // jeudi 26/11 (jour de la mise en ligne) : la semaine du 20/11
    ['2027-01-01', '2027-01-01'], // vendredi 1er janvier, changement d'année
    ['2027-01-03', '2027-01-01'],
    ['2028-03-01', '2028-02-25'], // année bissextile
  ])('%s → %s', (jour, vendredi) => {
    expect(vendrediDeReference(jour)).toBe(vendredi)
    expect(new Date(`${vendredi}T12:00:00Z`).getUTCDay()).toBe(5)
  })

  it('refuse une date mal formée plutôt que de rendre un vendredi faux', () => {
    expect(() => vendrediDeReference('27/11/2026')).toThrow(RangeError)
  })

  it('decalerDate franchit les mois et les années', () => {
    expect(decalerDate('2026-11-27', 7)).toBe('2026-12-04')
    expect(decalerDate('2026-12-31', 1)).toBe('2027-01-01')
    expect(decalerDate('2026-11-27', -84)).toBe('2026-09-04')
  })
})

describe('etatVerification', () => {
  const outils = [{ surPlaceDepuis: '2026-11-10' }]
  it('faite l’emporte sur tout le reste', () => {
    expect(etatVerification({ aujourdhui: '2026-11-30', vendredi: '2026-11-27', faite: true, outilsDuChantier: outils })).toBe('faite')
    expect(etatVerification({ aujourdhui: '2026-11-30', vendredi: '2026-11-27', faite: true, outilsDuChantier: [] })).toBe('faite')
  })
  it('le vendredi même : à faire ; le lundi suivant sans vérification : en retard', () => {
    expect(etatVerification({ aujourdhui: '2026-11-27', vendredi: '2026-11-27', faite: false, outilsDuChantier: outils })).toBe('a_faire')
    expect(etatVerification({ aujourdhui: '2026-11-30', vendredi: '2026-11-27', faite: false, outilsDuChantier: outils })).toBe('en_retard')
  })
  it('rien n’est en retard pour un outil arrivé sur le chantier après le vendredi (1re semaine, ou déplacé depuis)', () => {
    expect(etatVerification({ aujourdhui: '2026-11-26', vendredi: '2026-11-20', faite: false, outilsDuChantier: [{ surPlaceDepuis: '2026-11-26' }] })).toBe('prochaine')
    // Un outil entré le vendredi même compte pour ce vendredi.
    expect(etatVerification({ aujourdhui: '2026-11-30', vendredi: '2026-11-27', faite: false, outilsDuChantier: [{ surPlaceDepuis: '2026-11-27' }] })).toBe('en_retard')
  })
  it('un chantier sans outil n’a rien à vérifier', () => {
    expect(etatVerification({ aujourdhui: '2026-11-27', vendredi: '2026-11-27', faite: false, outilsDuChantier: [] })).toBe('sans_outils')
  })
})

describe('lignesAEnregistrer — la liste reçue doit être celle du chantier', () => {
  const surLeChantier = [outil(ID_A), outil(ID_B, 4)]

  it('chaque outil une fois : liste figée, manquants et pannes comptés', () => {
    const r = lignesAEnregistrer(surLeChantier, [
      { outilId: ID_A, presents: 1, enPanne: true, remarque: 'mandrin cassé' },
      { outilId: ID_B, presents: 3, enPanne: false, remarque: null },
    ])
    expect(r).toEqual({
      lignes: [
        { outilId: ID_A, nom: 'Outil 01', type: 'outil', reference: null, attendus: 1, presents: 1, enPanne: true, remarque: 'mandrin cassé' },
        { outilId: ID_B, nom: 'Outil 02', type: 'outil', reference: null, attendus: 4, presents: 3, enPanne: false, remarque: null },
      ],
      manquants: 1,
      enPanne: 1,
    })
  })

  it('un outil oublié, en double ou d’ailleurs : la liste a changé, rien ne s’enregistre', () => {
    expect(lignesAEnregistrer(surLeChantier, [{ outilId: ID_A, presents: 1, enPanne: false, remarque: null }])).toEqual({ refus: 'liste_changee' })
    expect(lignesAEnregistrer(surLeChantier, [
      { outilId: ID_A, presents: 1, enPanne: false, remarque: null },
      { outilId: ID_A, presents: 1, enPanne: false, remarque: null },
    ])).toEqual({ refus: 'liste_changee' })
    // Liste complète, mais un outil envoyé deux fois : refusée aussi (il serait compté deux fois).
    expect(lignesAEnregistrer(surLeChantier, [
      { outilId: ID_A, presents: 1, enPanne: false, remarque: null },
      { outilId: ID_A, presents: 0, enPanne: false, remarque: null },
      { outilId: ID_B, presents: 4, enPanne: false, remarque: null },
    ])).toEqual({ refus: 'liste_changee' })
    expect(lignesAEnregistrer([outil(ID_A)], [
      { outilId: ID_A, presents: 1, enPanne: false, remarque: null },
      { outilId: ID_B, presents: 1, enPanne: false, remarque: null },
    ])).toEqual({ refus: 'liste_changee' })
  })

  it('plus de présents que prévu : refusé (l’excédent se dit dans les remarques)', () => {
    expect(lignesAEnregistrer([outil(ID_A, 2)], [{ outilId: ID_A, presents: 3, enPanne: false, remarque: null }])).toEqual({ refus: 'quantite_invalide' })
  })

  it('un chantier sans outil : la vérification ne part qu’avec une observation', () => {
    expect(lignesAEnregistrer([], [])).toEqual({ refus: 'observations_requises' })
    expect(lignesAEnregistrer([], [], 'Falta uma rebarbadora')).toEqual({ lignes: [], manquants: 0, enPanne: 0 })
  })

  it('la remarque d’un élément présent et en état n’est pas gardée (le champ n’est pas affiché)', () => {
    const r = lignesAEnregistrer([outil(ID_A)], [{ outilId: ID_A, presents: 1, enPanne: false, remarque: 'Levada para Porto' }])
    expect('lignes' in r && r.lignes[0].remarque).toBeNull()
    const enPanne = lignesAEnregistrer([outil(ID_A)], [{ outilId: ID_A, presents: 1, enPanne: true, remarque: 'Cabo partido' }])
    expect('lignes' in enPanne && enPanne.lignes[0].remarque).toBe('Cabo partido')
  })
})

describe('formulaires reçus', () => {
  const base = { type: 'vehicule', nom: '  Carrinha Renault  ', reference: '  AA-00-BB ', quantite: 1, chantierId: null, etat: 'ok', notes: '   ' }

  it('espaces retirés, texte vide = absent', () => {
    expect(outilSchema.parse(base)).toEqual({ type: 'vehicule', nom: 'Carrinha Renault', reference: 'AA-00-BB', quantite: 1, chantierId: null, etat: 'ok', notes: null })
  })

  it('refuse ce que la base refuserait : nom vide ou trop long, quantité hors 1-999, type ou état inconnus', () => {
    for (const autre of [
      { nom: '   ' }, { nom: 'x'.repeat(121) }, { quantite: 0 }, { quantite: 1000 }, { quantite: 1.5 },
      { type: 'camion' }, { etat: 'perdu' }, { chantierId: 'pas-un-uuid' }, { reference: 'x'.repeat(81) }, { notes: 'x'.repeat(501) },
    ]) {
      expect(outilSchema.safeParse({ ...base, ...autre }).success, JSON.stringify(autre)).toBe(false)
    }
  })

  it('la vérification : observations bornées à 1000 caractères, nombres entiers et positifs', () => {
    const v = { chantierId: CHANTIER, lignes: [{ outilId: ID_A, presents: 0, enPanne: false, remarque: '' }], observations: '' }
    expect(verificationSchema.parse(v)).toEqual({ chantierId: CHANTIER, lignes: [{ outilId: ID_A, presents: 0, enPanne: false, remarque: null }], observations: null })
    expect(verificationSchema.safeParse({ ...v, observations: 'x'.repeat(1001) }).success).toBe(false)
    expect(verificationSchema.safeParse({ ...v, lignes: [{ outilId: ID_A, presents: -1, enPanne: false }] }).success).toBe(false)
  })
})

describe('lignes de la base vers l’écran', () => {
  it('outil : valeurs absentes ramenées à des valeurs sûres, type inconnu écarté', () => {
    expect(outilPourEcran({ id: ID_A, type: 'outil', nom: 'Escadote', quantite: 3, chantier_id: CHANTIER, etat: 'en_panne', created_at: '2026-11-26T10:00:00Z' }))
      .toEqual({ id: ID_A, type: 'outil', nom: 'Escadote', reference: null, quantite: 3, chantierId: CHANTIER, etat: 'en_panne', notes: null, surPlaceDepuis: '2026-11-26' })
    // L'arrivée sur le chantier (chantier_depuis) prime sur l'entrée au répertoire.
    expect(outilPourEcran({ id: ID_A, type: 'outil', nom: 'X', created_at: '2026-11-02T10:00:00Z', chantier_depuis: '2026-12-02T08:00:00Z' })?.surPlaceDepuis).toBe('2026-12-02')
    expect(outilPourEcran({ id: ID_A, type: 'grue', nom: 'X' })).toBeNull()
    expect(outilPourEcran({ id: ID_A, type: 'outil' })).toBeNull()
  })

  it('vérification : liste figée relue telle quelle, lignes illisibles écartées', () => {
    const v = verificationPourEcran({
      id: ID_A, chantier_id: CHANTIER, chantier_titre: 'Moradia', vendredi: '2026-11-27', created_at: '2026-11-27T16:00:00Z',
      valide_par_nom: 'Paulo', manquants: 1, en_panne: 0, observations: '',
      lignes: [{ outilId: ID_B, nom: 'Betoneira', type: 'outil', attendus: 1, presents: 0, enPanne: false }, 'illisible', null],
    })
    expect(v).toMatchObject({ chantierTitre: 'Moradia', par: 'Paulo', manquants: 1, observations: null })
    expect(v?.lignes).toEqual([{ outilId: ID_B, nom: 'Betoneira', type: 'outil', reference: null, attendus: 1, presents: 0, enPanne: false, remarque: null }])
    expect(verificationPourEcran({ id: ID_A })).toBeNull()
  })
})
