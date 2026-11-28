// tests/lib/btp-rentabilite-obra.test.ts — équipe d'une obra jour par jour et rentabilité hors IVA
// (lib/btp/equipe-par-jour.ts, lib/btp/rentabilite-obra.ts ; demande de Frédéric du 28/11/2026 : « choisir les employés
// qui y sont, et pouvoir modifier par JOUR », « indiquer combien on a dépensé en matériaux », « le IVA doit pas être pris
// en compte dans le résultat »). Données fictives.

import { describe, expect, it } from 'vitest'
import {
  ajouteCeJour, equipeDuJour, estJourOuvre, jourRetouche, joursEntre, jourValide, lireEquipeParJour, membresDesignes,
  reprendreEquipeHabituelle, retoucherJour, simplifierEquipeParJour, JOURS_MAX_PAR_CHANTIER,
} from '@/lib/btp/equipe-par-jour'
import {
  achatsMateriaux, dateFinProlongee, montantHorsIva, rentabiliteObra, totalMateriauxHT, type EntreeRentabiliteObra,
} from '@/lib/btp/rentabilite-obra'

// Lundi 30/11/2026 → dimanche 06/12/2026.
const LUN = '2026-11-30', MAR = '2026-12-01', MER = '2026-12-02', VEN = '2026-12-04', SAM = '2026-12-05', DIM = '2026-12-06'

describe('jours et équipe habituelle', () => {
  it('jours valides seulement (pas de 30 février, pas d’autre format)', () => {
    expect(jourValide('2026-12-01')).toBe(true)
    expect(jourValide('2026-02-30')).toBe(false)
    expect(jourValide('01/12/2026')).toBe(false)
    expect(jourValide(20261201)).toBe(false)
  })

  it('jours de début à fin, les deux inclus ; vide si une date manque ou si la fin précède le début ; plafonnés', () => {
    expect(joursEntre(LUN, DIM)).toEqual([LUN, MAR, MER, '2026-12-03', VEN, SAM, DIM])
    expect(joursEntre(LUN, LUN)).toEqual([LUN])
    expect(joursEntre('', DIM)).toEqual([])
    expect(joursEntre(DIM, LUN)).toEqual([])
    expect(joursEntre('2026-01-01', '2099-12-31')).toHaveLength(JOURS_MAX_PAR_CHANTIER)
    // Passage à l'heure d'hiver : aucun jour sauté ni doublé.
    expect(joursEntre('2026-10-24', '2026-10-27')).toEqual(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'])
  })

  it('l’équipe habituelle travaille du lundi au vendredi, personne le week-end', () => {
    expect([LUN, VEN, SAM, DIM].map(estJourOuvre)).toEqual([true, true, false, false])
    expect(equipeDuJour(MAR, ['a', 'b'], {})).toEqual(['a', 'b'])
    expect(equipeDuJour(SAM, ['a', 'b'], {})).toEqual([])
  })

  it('un jour retouché prend exactement sa liste : un absent, un renfort, un samedi travaillé, un jour chômé', () => {
    const retouches = { [MAR]: ['a'], [MER]: ['a', 'b', 'c'], [SAM]: ['b'], [VEN]: [] }
    expect(equipeDuJour(MAR, ['a', 'b'], retouches)).toEqual(['a'])
    expect(equipeDuJour(MER, ['a', 'b'], retouches)).toEqual(['a', 'b', 'c'])
    expect(equipeDuJour(SAM, ['a', 'b'], retouches)).toEqual(['b'])
    expect(equipeDuJour(VEN, ['a', 'b'], retouches)).toEqual([])
    expect(jourRetouche(MAR, ['a', 'b'], retouches)).toBe(true)
    expect(jourRetouche(LUN, ['a', 'b'], retouches)).toBe(false)
  })

  it('seuls les jours qui diffèrent sont gardés, triés : la même équipe s’enregistre toujours pareil', () => {
    const brut = { [MER]: ['b', 'a'], [MAR]: ['a'], [SAM]: [], 'pas-un-jour': ['a'] }
    expect(simplifierEquipeParJour(brut, ['a', 'b'])).toEqual({ [MAR]: ['a'] })
    expect(Object.keys(simplifierEquipeParJour({ [VEN]: [], [LUN]: [] }, ['a']))).toEqual([LUN, VEN])
  })

  it('retoucher puis rétablir un jour', () => {
    const une = retoucherJour({}, ['a', 'b'], MAR, ['a', 'c'])
    expect(une).toEqual({ [MAR]: ['a', 'c'] })
    // Revenir à l'équipe habituelle en cochant les mêmes : la retouche disparaît d'elle-même.
    expect(retoucherJour(une, ['a', 'b'], MAR, ['b', 'a'])).toEqual({})
    expect(reprendreEquipeHabituelle(une, MAR)).toEqual({})
  })

  it('lecture tolérante de la colonne : jamais d’erreur, rien d’inventé', () => {
    expect(lireEquipeParJour(undefined)).toEqual({})
    expect(lireEquipeParJour('{}')).toEqual({})
    expect(lireEquipeParJour([['2026-12-01', ['a']]])).toEqual({})
    expect(lireEquipeParJour({ [MAR]: ['a', 'a', '', 3], x: ['b'], [MER]: 'a' })).toEqual({ [MAR]: ['a'] })
    expect(membresDesignes({ [MAR]: ['a', 'b'], [MER]: ['b', 'c'] })).toEqual(['a', 'b', 'c'])
  })

  it('pointage : ajouté ce jour-là seulement ; une colonne illisible n’ajoute rien', () => {
    expect(ajouteCeJour('c', MER, { [MER]: ['a', 'c'] })).toBe(true)
    expect(ajouteCeJour('c', MAR, { [MER]: ['a', 'c'] })).toBe(false)
    expect(ajouteCeJour('c', 'aujourd’hui', { [MER]: ['c'] })).toBe(false)
    expect(ajouteCeJour('c', MER, null)).toBe(false)
  })
})

describe('matériaux hors IVA', () => {
  it('montant payé IVA comprise ramené hors IVA, au centime', () => {
    expect(montantHorsIva(123, 23)).toBe(100)
    expect(montantHorsIva(113, 13)).toBe(100)
    expect(montantHorsIva(106, 6)).toBe(100)
    expect(montantHorsIva(120, 20)).toBe(100)
    expect(montantHorsIva(105.5, 5.5)).toBe(100)
    expect(montantHorsIva(50, 23)).toBe(40.65)
    expect(montantHorsIva(80, 0)).toBe(80)
    expect(montantHorsIva(80, Number.NaN)).toBe(80)
  })

  it('achats de l’obra : catégorie matériaux et bon chantier seulement, les plus récents d’abord ; total hors IVA', () => {
    const depenses = [
      { id: '1', chantier_id: 'c1', category: 'materiaux', amount: '100.50', date: '2026-11-02', label: 'Cimento' },
      { id: '2', chantierId: 'c1', category: 'materiel', amount: 49.5, date: '2026-11-20', label: 'Ancien' },
      { id: '3', chantier_id: 'c1', category: 'carburant', amount: 60, date: '2026-11-21', label: 'Gasóleo' },
      { id: '4', chantier_id: 'c2', category: 'materiaux', amount: 999, date: '2026-11-22', label: 'Autre obra' },
    ]
    expect(achatsMateriaux(depenses, 'c1').map(d => d.id)).toEqual(['2', '1'])
    expect(totalMateriauxHT(depenses, 'c1')).toBe(150)
    expect(totalMateriauxHT(depenses, 'c9')).toBeNull()
  })
})

describe('rentabilité d’une obra, hors IVA, équipe jour par jour', () => {
  // Obra d'une semaine (lundi → dimanche), deux employés à 100 € et 150 € par jour.
  const base: EntreeRentabiliteObra = {
    valeurHT: 5000, dateDebut: LUN, dateFin: DIM, statut: 'En cours',
    membresIds: ['a', 'b'], equipeParJour: {},
    coutJourParMembre: new Map([['a', 100], ['b', 150], ['c', 120]]),
    coutJourParDefaut: 200, nbEmployesSansEquipe: 1,
    materiauxHT: 1000, aujourdhui: MER,
  }

  it('valeur hors IVA − matériaux saisis − équipe des cinq jours ouvrés', () => {
    const r = rentabiliteObra(base)!
    expect(r.joursCalendrier).toBe(7)
    expect(r.joursTravailles).toBe(5)
    expect(r.coutJourEquipe).toBe(250)
    expect(r.coutMOPrevu).toBe(1250)
    expect(r.materiauxHT).toBe(1000)
    expect(r.materiauxEstimes).toBe(false)
    expect(r.beneficePrevu).toBe(2750)
    expect(r.beneficeActuel).toBe(2750)
    expect(r.margePrevuePct).toBe(55)
    expect(r.status).toBe('profit')
  })

  it('les jours retouchés changent la main-d’œuvre : absent mardi, renfort mercredi, samedi travaillé, vendredi chômé', () => {
    const r = rentabiliteObra({ ...base, equipeParJour: { [MAR]: ['a'], [MER]: ['a', 'b', 'c'], [SAM]: ['b'], [VEN]: [] } })!
    // lundi 250 + mardi 100 + mercredi 370 + jeudi 250 + vendredi 0 + samedi 150 = 1 120
    expect(r.coutMOPrevu).toBe(1120)
    expect(r.joursTravailles).toBe(5)
    expect(r.jours.filter(j => j.retouche).map(j => j.jour)).toEqual([MAR, MER, VEN, SAM])
  })

  it('sans aucun achat saisi : estimation de 15 % de la valeur, dite comme telle', () => {
    const r = rentabiliteObra({ ...base, materiauxHT: null })!
    expect(r.materiauxHT).toBe(750)
    expect(r.materiauxEstimes).toBe(true)
  })

  it('un ancien employé (absent de la liste des coûts) compte au coût par défaut ; sans équipe du tout, estimation', () => {
    expect(rentabiliteObra({ ...base, membresIds: ['a', 'inconnu'] })!.coutJourEquipe).toBe(300)
    const sansEquipe = rentabiliteObra({ ...base, membresIds: [], nbEmployesSansEquipe: 2 })!
    expect(sansEquipe.equipeEstimee).toBe(true)
    expect(sansEquipe.coutMOPrevu).toBe(2000)
  })

  it('l’IVA n’entre nulle part : une même obra payée 1 230 € TTC de matériaux à 23 % compte 1 000 €', () => {
    const r = rentabiliteObra({ ...base, materiauxHT: montantHorsIva(1230, 23) })!
    expect(r.materiauxHT).toBe(1000)
    expect(r.beneficePrevu).toBe(2750)
  })

  it('en retard : les jours écoulés après la fin coûtent l’équipe de chaque jour', () => {
    // Fin vendredi, aujourd'hui mardi suivant : samedi et dimanche sans personne, lundi et mardi avec l'équipe.
    const r = rentabiliteObra({ ...base, dateFin: VEN, aujourdhui: '2026-12-08' })!
    expect(r.enRetard).toBe(true)
    expect(r.finDepassee).toBe(true)
    expect(r.joursRetard).toBe(4)
    expect(r.coutRetard).toBe(500)
    expect(r.beneficeActuel).toBe(r.beneficePrevu - 500)
    // Une obra terminée n'est jamais en retard.
    expect(rentabiliteObra({ ...base, dateFin: VEN, statut: 'Terminé', aujourdhui: '2026-12-08' })!.enRetard).toBe(false)
  })

  it('rien à calculer sans valeur ou sans dates valides', () => {
    expect(rentabiliteObra({ ...base, valeurHT: 0 })).toBeNull()
    expect(rentabiliteObra({ ...base, dateDebut: '' })).toBeNull()
    expect(rentabiliteObra({ ...base, dateFin: '2026-11-01' })).toBeNull()
  })

  it('prolonger une obra déjà en retard part d’aujourd’hui, pas de l’ancienne fin', () => {
    expect(dateFinProlongee(VEN, 2, MER)).toBe('2026-12-06')
    expect(dateFinProlongee(VEN, 2, '2026-12-10')).toBe('2026-12-12')
    expect(dateFinProlongee('2026-12-31', 1, MER)).toBe('2027-01-01')
  })
})
