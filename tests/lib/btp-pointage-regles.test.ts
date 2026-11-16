// tests/lib/btp-pointage-regles.test.ts — règles serveur du pointage BTP (16/11/2026) : fiche employé du compte,
// chantiers affectés, heure locale, clôture, export CSV. Données fictives.

import { describe, expect, it } from 'vitest'
import {
  FUSEAU_PAR_DEFAUT,
  TOLERANCE_HORLOGE_MS,
  celluleCsv,
  chantierPointable,
  chantierPourTelephone,
  chantiersAffectes,
  cloturer,
  equipesDuMembre,
  fuseauValide,
  heureLocale,
  instantRetenu,
  libelleMode,
  membreDuCompte,
  pointagesEnCsv,
  secondesDepuisMinuit,
  type ChantierBtp,
  type EquipeBtp,
  type MembreBtp,
} from '@/lib/btp/pointage-regles'

const PAUL: MembreBtp = { id: 'm-paul', prenom: 'Paul', nom: 'Exemple', email: 'Paul.Exemple@example.test ' }
const JEAN: MembreBtp = { id: 'm-jean', prenom: 'Jean', nom: 'Test', email: 'jean@example.test', equipe_id: 'e-ancienne' }

describe('membreDuCompte — la fiche employé porte l’adresse e-mail du compte', () => {
  it('comparaison sans casse ni espaces', () => {
    expect(membreDuCompte([PAUL, JEAN], ' paul.exemple@EXAMPLE.test')).toEqual({ statut: 'relie', membre: PAUL })
  })

  it('aucune fiche, adresse vide ou fiche inactive : non relié', () => {
    expect(membreDuCompte([JEAN], 'paul.exemple@example.test')).toEqual({ statut: 'aucun' })
    expect(membreDuCompte([PAUL], '')).toEqual({ statut: 'aucun' })
    expect(membreDuCompte([PAUL], undefined)).toEqual({ statut: 'aucun' })
    expect(membreDuCompte([{ ...PAUL, actif: false }], 'paul.exemple@example.test')).toEqual({ statut: 'aucun' })
  })

  it('deux fiches actives à la même adresse : ambigu, aucune n’est choisie', () => {
    expect(membreDuCompte([PAUL, { ...PAUL, id: 'm-paul-2' }], 'paul.exemple@example.test')).toEqual({ statut: 'ambigu' })
    expect(membreDuCompte([PAUL, { ...PAUL, id: 'm-paul-2', actif: false }], 'paul.exemple@example.test'))
      .toEqual({ statut: 'relie', membre: PAUL })
  })
})

describe('chantiersAffectes — directement ou par une équipe, et seulement « En cours »', () => {
  const equipes: EquipeBtp[] = [
    { id: 'e-macons', chantier_id: 'c-villa', equipe_membres_btp: [{ membre_id: 'm-paul' }] },
    { id: 'e-ancienne', chantier_id: 'c-immeuble', equipe_membres_btp: [] },
    { id: 'e-sans-chantier', chantier_id: null, equipe_membres_btp: [{ membre_id: 'm-paul' }] },
  ]
  const chantiers: ChantierBtp[] = [
    { id: 'c-villa', titre: 'Villa', statut: 'En cours', membres_ids: [] },
    { id: 'c-immeuble', titre: 'Immeuble', statut: 'En cours' },
    { id: 'c-garage', titre: 'Garage', statut: 'En cours', membres_ids: ['m-paul'] },
    { id: 'c-fini', titre: 'Fini', statut: 'Terminé', membres_ids: ['m-paul', 'm-jean'] },
    { id: 'c-autre', titre: 'Autre', statut: 'En cours', membres_ids: ['m-autre'] },
  ]

  it('équipes du membre : table de liaison et ancienne colonne equipe_id', () => {
    expect([...equipesDuMembre(PAUL, equipes)].sort((a, b) => a.localeCompare(b))).toEqual(['e-macons', 'e-sans-chantier'])
    expect([...equipesDuMembre(JEAN, equipes)]).toEqual(['e-ancienne'])
  })

  it('Paul : la villa par son équipe, le garage directement ; pas le chantier terminé', () => {
    expect(chantiersAffectes(PAUL, chantiers, equipes).map(c => c.id)).toEqual(['c-villa', 'c-garage'])
  })

  it('Jean : l’immeuble par l’ancienne colonne equipe_id', () => {
    expect(chantiersAffectes(JEAN, chantiers, equipes).map(c => c.id)).toEqual(['c-immeuble'])
  })

  it('sans la colonne membres_ids (migration non appliquée), les équipes suffisent', () => {
    const sansColonne = chantiers.map(({ membres_ids: _ignore, ...reste }) => reste)
    expect(chantiersAffectes(PAUL, sansColonne, equipes).map(c => c.id)).toEqual(['c-villa'])
  })
})

describe('chantier vers le téléphone', () => {
  it('rien d’autre que titre, adresse, position et rayon ; position invalide → null', () => {
    const chantier: ChantierBtp & Record<string, unknown> = {
      id: 'c1', titre: 'Villa', adresse: '1 rue des Lilas', code_postal: '13008', ville: 'Marseille',
      latitude: 43.25, longitude: 5.38, geo_rayon_m: 150, budget: 45000, client: 'Mme X', membres_ids: ['m1'],
    }
    expect(chantierPourTelephone(chantier)).toEqual({
      id: 'c1', titre: 'Villa', adresse: '1 rue des Lilas, 13008 Marseille', latitude: 43.25, longitude: 5.38, rayonM: 150,
    })
    const sansPosition = chantierPourTelephone({ id: 'c2', titre: 'Garage', latitude: 0, longitude: 0, geo_rayon_m: null })
    expect(sansPosition).toMatchObject({ latitude: null, longitude: null, rayonM: 100, adresse: '' })
    expect(chantierPointable(sansPosition)).toBeNull()
    expect(chantierPointable(chantierPourTelephone(chantier))).toEqual({ id: 'c1', titre: 'Villa', latitude: 43.25, longitude: 5.38, rayonM: 150 })
  })
})

describe('heure du pointage', () => {
  it('fuseau : reconnu ou Europe/Paris', () => {
    expect(fuseauValide('Europe/Lisbon')).toBe('Europe/Lisbon')
    expect(fuseauValide('Pas/Un_Fuseau')).toBe(FUSEAU_PAR_DEFAUT)
    expect(fuseauValide(42)).toBe(FUSEAU_PAR_DEFAUT)
    expect(fuseauValide('')).toBe(FUSEAU_PAR_DEFAUT)
  })

  it('heure locale du chantier, heure d’été comprise', () => {
    const instant = Date.UTC(2026, 6, 15, 6, 5, 9) // 15/07/2026 06:05:09 UTC
    expect(heureLocale(instant, 'Europe/Paris')).toEqual({ date: '2026-07-15', heure: '08:05:09' })
    expect(heureLocale(instant, 'Europe/Lisbon')).toEqual({ date: '2026-07-15', heure: '07:05:09' })
    expect(heureLocale(Date.UTC(2026, 11, 31, 23, 30, 0), 'Europe/Paris')).toEqual({ date: '2027-01-01', heure: '00:30:00' })
  })

  it('instant retenu : celui du téléphone à moins de 10 min du serveur, sinon celui du serveur', () => {
    const serveur = 1_800_000_000_000
    expect(instantRetenu(serveur - 60_000, serveur)).toBe(serveur - 60_000)
    expect(instantRetenu(serveur - TOLERANCE_HORLOGE_MS, serveur)).toBe(serveur - TOLERANCE_HORLOGE_MS)
    expect(instantRetenu(serveur - TOLERANCE_HORLOGE_MS - 1, serveur)).toBe(serveur)
    expect(instantRetenu(serveur + 3_600_000, serveur)).toBe(serveur)
    expect(instantRetenu(undefined, serveur)).toBe(serveur)
    expect(instantRetenu(Number.NaN, serveur)).toBe(serveur)
  })
})

describe('clôture d’un pointage', () => {
  it('même jour : heure de départ et heures travaillées, pause déduite', () => {
    expect(cloturer({ date: '2026-11-16', heure: '08:00:00' }, { date: '2026-11-16', heure: '17:30:00' }, 60))
      .toEqual({ heureDepart: '17:30:00', heuresTravaillees: 8.5, clotureForcee: false })
    expect(cloturer({ date: '2026-11-16', heure: '07:42:10' }, { date: '2026-11-16', heure: '12:03:40' }, 0))
      .toEqual({ heureDepart: '12:03:40', heuresTravaillees: 4.36, clotureForcee: false })
  })

  it('départ constaté le lendemain : ramené à 23:59:59 du jour d’arrivée et signalé', () => {
    expect(cloturer({ date: '2026-11-16', heure: '20:00:00' }, { date: '2026-11-17', heure: '07:00:00' }, 0))
      .toEqual({ heureDepart: '23:59:59', heuresTravaillees: 4, clotureForcee: true })
  })

  it('horloge incohérente (départ avant l’arrivée) : durée nulle, jamais négative', () => {
    expect(cloturer({ date: '2026-11-16', heure: '10:00:00' }, { date: '2026-11-16', heure: '09:00:00' }, 0))
      .toEqual({ heureDepart: '10:00:00', heuresTravaillees: 0, clotureForcee: false })
    expect(cloturer({ date: '2026-11-16', heure: '10:00:00' }, { date: '2026-11-15', heure: '11:00:00' }, 0).heuresTravaillees).toBe(0)
  })

  it('heures illisibles ou hors bornes', () => {
    expect(secondesDepuisMinuit('08:30')).toBe(30_600)
    expect(secondesDepuisMinuit('24:00:00')).toBeNull()
    expect(secondesDepuisMinuit('8h30')).toBeNull()
    expect(secondesDepuisMinuit(null)).toBeNull()
  })
})

describe('export CSV', () => {
  it('cellules entre guillemets, guillemets doublés, formules neutralisées', () => {
    expect(celluleCsv('Villa "Les Pins"')).toBe('"Villa ""Les Pins"""')
    expect(celluleCsv('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"')
    expect(celluleCsv('-2')).toBe('"\'-2"')
    expect(celluleCsv('@SUM(A1)')).toBe('"\'@SUM(A1)"')
    expect(celluleCsv(null)).toBe('""')
  })

  it('points-virgules, en-tête dans la langue, pointage en cours, virgule décimale', () => {
    const csv = pointagesEnCsv([
      { date: '2026-11-16', employe: 'Paul Exemple', chantier: 'Villa', heureArrivee: '08:00:00', heureDepart: '12:30:00', heuresTravaillees: 4.5, mode: 'geo_auto' },
      { date: '2026-11-16', employe: 'Jean Test', chantier: 'Garage', heureArrivee: '13:15:00', heureDepart: '', heuresTravaillees: 0, mode: 'manuel' },
    ], false)
    expect(csv.split('\r\n')).toEqual([
      '"Date";"Employé";"Chantier";"Arrivée";"Départ";"Heures";"Méthode"',
      '"2026-11-16";"Paul Exemple";"Villa";"08:00";"12:30";"4,50";"Automatique (GPS)"',
      '"2026-11-16";"Jean Test";"Garage";"13:15";"En cours";"0,00";"Manuel"',
    ])
    expect(pointagesEnCsv([], true)).toBe('"Data";"Colaborador";"Obra";"Chegada";"Saída";"Horas";"Método"')
  })

  it('libellés des méthodes', () => {
    expect(libelleMode('geo_confirme', false)).toBe('Sur site (GPS)')
    expect(libelleMode('geo_auto', true)).toBe('Automática (GPS)')
    expect(libelleMode(undefined, false)).toBe('Manuel')
  })
})
