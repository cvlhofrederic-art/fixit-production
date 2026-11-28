// tests/lib/btp-rentabilite-obra.test.ts — équipe d'une obra jour par jour et rentabilité hors IVA
// (lib/btp/equipe-par-jour.ts, lib/btp/rentabilite-obra.ts ; demande de Frédéric du 28/11/2026 : « choisir les employés
// qui y sont, et pouvoir modifier par JOUR », « indiquer combien on a dépensé en matériaux », « le IVA doit pas être pris
// en compte dans le résultat »). Données fictives.

import { describe, expect, it } from 'vitest'
import {
  ajouteCeJour, equipeDuJour, estJourOuvre, figerJoursPasses, formeEquipeParJourValide, jourRetouche, joursEntre, jourValide,
  lireEquipeParJour, membresDesignes, periodeTronquee, reprendreEquipeHabituelle, retoucherJour, simplifierEquipeParJour,
  JOURS_MAX_PAR_CHANTIER, MEMBRES_MAX_PAR_JOUR,
} from '@/lib/btp/equipe-par-jour'
import {
  achatsMateriaux, dateFinProlongee, montantHorsIva, pointagesDeLObra, rentabiliteObra, totalAutresDepensesHT,
  totalMateriauxHT, type EntreeRentabiliteObra,
} from '@/lib/btp/rentabilite-obra'
import { estFerie, jourOuvreDans, nomFerie, paques, paysDuCodePostal } from '@/lib/btp/jours-feries'

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

  it('un jour passé garde sa liste même égale à l’équipe habituelle ; un jour à venir égal disparaît', () => {
    // Aujourd'hui mercredi : lundi et mardi sont passés.
    expect(simplifierEquipeParJour({ [LUN]: ['a', 'b'], [MER]: ['a', 'b'], [VEN]: ['a'] }, ['a', 'b'], MER))
      .toEqual({ [LUN]: ['a', 'b'], [VEN]: ['a'] })
    expect(retoucherJour({}, ['a', 'b'], MAR, ['a', 'b'], MER)).toEqual({ [MAR]: ['a', 'b'] })
  })

  it('changer l’équipe habituelle fige les jours passés sans liste ; aujourd’hui et la suite prennent la nouvelle', () => {
    // Rui (r) en renfort mardi ; mercredi, il entre dans l'équipe habituelle.
    const avant = { [MAR]: ['a', 'b', 'r'] }
    const apres = figerJoursPasses({ debut: LUN, aujourdhui: MER, ancienneEquipe: ['a', 'b'], nouvelleEquipe: ['a', 'b', 'r'], equipeParJour: avant })
    expect(apres).toEqual({ [LUN]: ['a', 'b'], [MAR]: ['a', 'b', 'r'] })
    expect(equipeDuJour(LUN, ['a', 'b', 'r'], apres)).toEqual(['a', 'b'])
    expect(equipeDuJour(MER, ['a', 'b', 'r'], apres)).toEqual(['a', 'b', 'r'])
    // Puis Rui repart : mardi le garde, lundi aussi (rien ne bouge dans le passé).
    const ensuite = figerJoursPasses({ debut: LUN, aujourdhui: VEN, ancienneEquipe: ['a', 'b', 'r'], nouvelleEquipe: ['a', 'b'], equipeParJour: apres })
    expect(ensuite[MAR]).toEqual(['a', 'b', 'r'])
    expect(ensuite[MER]).toEqual(['a', 'b', 'r'])
    expect(equipeDuJour(VEN, ['a', 'b'], ensuite)).toEqual(['a', 'b'])
    // Même équipe, ou obra pas encore commencée : rien n'est figé.
    expect(figerJoursPasses({ debut: LUN, aujourdhui: MER, ancienneEquipe: ['b', 'a'], nouvelleEquipe: ['a', 'b'], equipeParJour: {} })).toEqual({})
    expect(figerJoursPasses({ debut: VEN, aujourdhui: MER, ancienneEquipe: ['a'], nouvelleEquipe: ['b'], equipeParJour: {} })).toEqual({})
  })

  it('forme stricte attendue par la route : « __proto__ », jour faux, liste trop longue refusés', () => {
    const UUID = /^[0-9a-f-]{36}$/i
    const id = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'
    expect(formeEquipeParJourValide({ [MAR]: [id] }, UUID)).toBe(true)
    expect(formeEquipeParJourValide(JSON.parse(`{"${MAR}": [], "__proto__": {"x": 1}}`), UUID)).toBe(false)
    expect(formeEquipeParJourValide({ '2026-02-30': [id] }, UUID)).toBe(false)
    expect(formeEquipeParJourValide({ [MAR]: Array.from({ length: MEMBRES_MAX_PAR_JOUR + 1 }, () => id) }, UUID)).toBe(false)
    expect(formeEquipeParJourValide([id], UUID)).toBe(false)
    // Lecture : identifiants en minuscules, clé « __proto__ » ignorée.
    expect(lireEquipeParJour(JSON.parse(`{"${MAR}": ["${id.toUpperCase()}"], "__proto__": ["${id}"]}`))).toEqual({ [MAR]: [id] })
  })

  it('période tronquée seulement au-delà du plafond (une obra d’exactement 1 100 jours ne l’est pas)', () => {
    const fin1100 = new Date(Date.UTC(2026, 0, 1 + JOURS_MAX_PAR_CHANTIER - 1)).toISOString().slice(0, 10)
    expect(periodeTronquee('2026-01-01', fin1100)).toBe(false)
    expect(periodeTronquee('2026-01-01', '2099-12-31')).toBe(true)
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

  it('employé parti (désactivé ou supprimé) : compté les jours passés, plus à partir d’aujourd’hui', () => {
    // b désactivé : lundi et mardi (passés) avec lui, mercredi à vendredi sans lui.
    const r = rentabiliteObra({ ...base, actifs: new Set(['a']) })!
    expect(r.coutMOPrevu).toBe(250 * 2 + 100 * 3)
    expect(r.coutJourEquipe).toBe(100)
    // Inscrit nommément un jour à venir : il compte ce jour-là.
    expect(rentabiliteObra({ ...base, actifs: new Set(['a']), equipeParJour: { [VEN]: ['a', 'b'] } })!.coutMOPrevu).toBe(250 * 2 + 100 * 2 + 250)
    // Fiches pas encore chargées (aucun filtre) : comme avant.
    expect(rentabiliteObra(base)!.coutMOPrevu).toBe(1250)
  })

  it('coût inconnu d’un employé compté : signalé (coût par défaut)', () => {
    expect(rentabiliteObra(base)!.coutsParDefaut).toBe(false)
    expect(rentabiliteObra({ ...base, membresIds: ['a', 'inconnu'] })!.coutsParDefaut).toBe(true)
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

// Méthode « pro » (décision de Frédéric du 28/11/2026 : « Fait au mieux méthode pro ») : jours fériés nationaux,
// pointage réel des jours passés, autres dépenses de l'obra.
describe('jours fériés nationaux', () => {
  it('Pâques (Meeus) : 2026 → 5 avril, 2027 → 28 mars, 2025 → 20 avril', () => {
    expect(paques(2026)).toBe('2026-04-05')
    expect(paques(2027)).toBe('2027-03-28')
    expect(paques(2025)).toBe('2025-04-20')
  })

  it('Portugal 2026 (Código do Trabalho, art. 234.º) : fixes et mobiles ; pas le Carnaval', () => {
    const feries = ['2026-01-01', '2026-04-03', '2026-04-05', '2026-04-25', '2026-05-01', '2026-06-04', '2026-06-10',
      '2026-08-15', '2026-10-05', '2026-11-01', '2026-12-01', '2026-12-08', '2026-12-25']
    for (const jour of feries) expect(estFerie(jour, 'PT')).toBe(true)
    expect(estFerie('2026-02-17', 'PT')).toBe(false) // Carnaval, facultatif
    expect(estFerie('2026-07-14', 'PT')).toBe(false)
    expect(nomFerie('2026-06-04', 'PT', true)).toBe('Corpo de Deus')
    expect(nomFerie('2026-12-01', 'PT', true)).toBe('Restauração da Independência')
  })

  it('France 2026 (Code du travail, L3133-1) : lundi de Pâques, Ascension, Pentecôte, 14 juillet, 11 novembre…', () => {
    const feries = ['2026-01-01', '2026-04-06', '2026-05-01', '2026-05-08', '2026-05-14', '2026-05-25', '2026-07-14',
      '2026-08-15', '2026-11-01', '2026-11-11', '2026-12-25']
    for (const jour of feries) expect(estFerie(jour, 'FR')).toBe(true)
    expect(estFerie('2026-12-01', 'FR')).toBe(false)
    expect(nomFerie('2026-05-14', 'FR', false)).toBe('Ascension')
  })

  it('pays d’une obra d’après son code postal ; jours travaillés hors week-end et fériés', () => {
    expect(paysDuCodePostal('4050-262')).toBe('PT')
    expect(paysDuCodePostal(' 13008 ')).toBe('FR')
    expect(paysDuCodePostal('')).toBeNull()
    expect(jourOuvreDans('PT')(MAR)).toBe(false) // 1er décembre, férié au Portugal
    expect(jourOuvreDans('FR')(MAR)).toBe(true)
    expect(jourOuvreDans(null)(MAR)).toBe(false) // pays inconnu : fériés des deux pays
    expect(jourOuvreDans('PT')(SAM)).toBe(false)
  })

  it('rentabilité : l’équipe habituelle ne travaille pas un jour férié (sauf jour retouché)', () => {
    const entree = {
      valeurHT: 5000, dateDebut: LUN, dateFin: DIM, statut: 'En cours', membresIds: ['a'], equipeParJour: {},
      coutJourParMembre: new Map([['a', 100]]), coutJourParDefaut: 200, nbEmployesSansEquipe: 1, materiauxHT: 0, aujourdhui: LUN,
    }
    expect(rentabiliteObra({ ...entree, ouvre: jourOuvreDans('PT') })!.coutMOPrevu).toBe(400)
    expect(rentabiliteObra({ ...entree, ouvre: jourOuvreDans('FR') })!.coutMOPrevu).toBe(500)
    expect(rentabiliteObra({ ...entree, ouvre: jourOuvreDans('PT'), equipeParJour: { [MAR]: ['a'] } })!.coutMOPrevu).toBe(500)
  })
})

describe('pointage réel et autres dépenses', () => {
  const base: EntreeRentabiliteObra = {
    valeurHT: 5000, dateDebut: LUN, dateFin: DIM, statut: 'En cours',
    membresIds: ['a', 'b'], equipeParJour: {},
    coutJourParMembre: new Map([['a', 100], ['b', 150]]), coutHeureParMembre: new Map([['a', 12.5], ['b', 20]]),
    coutJourParDefaut: 200, nbEmployesSansEquipe: 1, materiauxHT: 1000, aujourdhui: MER,
  }

  it('jour passé pointé : heures × coût horaire de chacun, à la place de l’équipe prévue ; deux pointages s’additionnent', () => {
    const pointages = pointagesDeLObra([
      { chantier_id: 'c1', membre_id: 'a', date: MAR, heures_travaillees: '4' },
      { chantier_id: 'c1', membre_id: 'a', date: MAR, heures_travaillees: 3.5 },
      { chantier_id: 'c1', membre_id: 'c', date: MAR, heures_travaillees: 8 },
      { chantier_id: 'autre', membre_id: 'b', date: MAR, heures_travaillees: 8 },
    ], 'c1')
    const r = rentabiliteObra({ ...base, pointages })!
    const mardi = r.jours.find(j => j.jour === MAR)!
    expect(mardi.source).toBe('pointage')
    expect(mardi.heures).toEqual({ a: 7.5, c: 8 })
    // a : 7,5 h × 12,5 = 93,75 ; c (sans fiche connue) : 8 h × 200 ÷ 7.
    expect(mardi.cout).toBeCloseTo(93.75 + 8 * 200 / 7, 1)
    expect(r.joursPointes).toBe(1)
    expect(r.coutsParDefaut).toBe(true)
  })

  it('pointage sans heures (départ non enregistré) : une journée ; pointage d’aujourd’hui ou à venir : ignoré', () => {
    const pointages = pointagesDeLObra([
      { chantierId: 'c1', membreId: 'b', date: LUN, heures_travaillees: null },
      { chantierId: 'c1', membreId: 'a', date: MER, heures_travaillees: 2 },
    ], 'c1')
    const r = rentabiliteObra({ ...base, pointages })!
    expect(r.jours.find(j => j.jour === LUN)).toMatchObject({ source: 'pointage', cout: 150 })
    expect(r.jours.find(j => j.jour === MER)).toMatchObject({ source: 'prevu', cout: 250 })
  })

  it('pointage au nom seul (sans fiche) : compté au coût par défaut, sous son nom', () => {
    const pointages = pointagesDeLObra([{ chantier_id: 'c1', membre_id: null, employe: 'Rui', date: LUN, heures_travaillees: 7 }], 'c1')
    const lundi = rentabiliteObra({ ...base, pointages })!.jours.find(j => j.jour === LUN)!
    expect(lundi.membres).toEqual(['nom:rui'])
    expect(lundi.cout).toBe(200)
  })

  it('autres dépenses de l’obra (location, carburant…) déduites du résultat, hors matériaux', () => {
    const depenses = [
      { chantier_id: 'c1', category: 'materiaux', amount: 1000 },
      { chantier_id: 'c1', category: 'location', amount: '300' },
      { chantier_id: 'c1', category: 'carburant', amount: 45.5 },
      { chantier_id: 'c2', category: 'transport', amount: 999 },
    ]
    expect(totalAutresDepensesHT(depenses, 'c1')).toBe(345.5)
    const r = rentabiliteObra({ ...base, autresDepensesHT: totalAutresDepensesHT(depenses, 'c1') })!
    expect(r.autresDepensesHT).toBe(346)
    // 5 000 − 1 000 (matériaux) − 345,50 (autres) − 1 250 (cinq jours de l'équipe) = 2 404,50
    expect(r.beneficePrevu).toBe(2405)
  })
})
