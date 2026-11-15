// tests/lib/use-btp-data-champs-enregistres.test.ts — champs des formulaires BTP jamais enregistrés alors que leur colonne
// existe en production (constats donnees-btp-6 et donnees-btp-7 de l'audit du 11/11/2026 ; colonnes vérifiées dans le
// relevé de production du 11/11/2026).
//
// Avant : le pointage GPS partait comme un pointage manuel, sans chantier, sans salarié, sans coordonnées ni distance,
// avec un départ à 17:00 jamais saisi ; le rayon de pointage d'un chantier, l'équipe d'un membre, le chantier d'une
// équipe et celui d'une dépense n'étaient jamais envoyés. Maintenant : ces champs partent dans leur colonne, à la
// création comme à la modification, et se relisent.

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null } })), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })) } },
}))

import { colonnesModifiees, mapFromSupabase, mapToSupabase } from '@/lib/hooks/use-btp-data'

const CHANTIER = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const MEMBRE = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'
const EQUIPE = 'c3d4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f'

describe('pointage', () => {
  it('pointage GPS : chantier, mode, coordonnées et distance enregistrés ; ni heure de départ ni heures inventées', () => {
    // Ce que PointageGeoSection envoie quand on pointe sur un chantier détecté par le GPS.
    const ligne = mapToSupabase('pointages', {
      employe: 'Société d’essai', poste: 'patron', chantier: 'Villa Dupré', chantierId: CHANTIER,
      date: '2026-11-15', heureArrivee: '08:12', heureDepart: '', pauseMinutes: 0, heuresTravaillees: null,
      notes: 'Pointage GPS (37m)', mode: 'geo_confirme', arriveeLat: 43.29, arriveeLng: 5.37, distanceM: 37,
    })
    expect(ligne).toMatchObject({
      chantier_id: CHANTIER, chantier_nom: 'Villa Dupré', mode: 'geo_confirme',
      arrivee_lat: 43.29, arrivee_lng: 5.37, distance_m: 37,
      heure_arrivee: '08:12', heure_depart: null, heures_travaillees: null,
    })
  })

  it('pointage manuel : le salarié et le chantier choisis sont enregistrés, ses heures aussi', () => {
    const ligne = mapToSupabase('pointages', {
      employe: 'Paul Durand', membreId: MEMBRE, poste: 'Maçon', chantier: 'Villa Dupré', chantierId: CHANTIER,
      date: '2026-11-15', heureArrivee: '08:00', heureDepart: '17:00', pauseMinutes: 60, heuresTravaillees: 8, mode: 'manuel',
    })
    expect(ligne).toMatchObject({ membre_id: MEMBRE, chantier_id: CHANTIER, heure_depart: '17:00', heures_travaillees: 8, mode: 'manuel' })
  })

  it('sans chantier ni salarié choisis : null, jamais une chaîne vide dans une colonne d’identifiant', () => {
    const ligne = mapToSupabase('pointages', { employe: 'Paul', chantierId: '', membreId: '', date: '2026-11-15', heureArrivee: '08:00' })
    expect(ligne).toMatchObject({ membre_id: null, chantier_id: null, mode: 'manuel', arrivee_lat: null, depart_lat: null, distance_m: null })
  })

  it('la distance au chantier est un nombre entier de mètres', () => {
    expect(mapToSupabase('pointages', { employe: 'Paul', distanceM: 36.6 })).toMatchObject({ distance_m: 37 })
    expect(mapToSupabase('pointages', { employe: 'Paul', distanceM: 'n’importe quoi' })).toMatchObject({ distance_m: null })
  })

  it('relecture : chantier, salarié, départ GPS et mode reviennent à l’écran', () => {
    const relu = mapFromSupabase('pointages', {
      id: 'p-1', employe: 'Paul', membre_id: MEMBRE, chantier_id: CHANTIER, chantier_nom: 'Villa Dupré', date: '2026-11-15',
      heure_arrivee: '08:00', heure_depart: null, heures_travaillees: null, mode: 'geo_confirme',
      arrivee_lat: 43.29, arrivee_lng: 5.37, depart_lat: 43.3, depart_lng: 5.38, distance_m: 37,
    })
    expect(relu).toMatchObject({
      membreId: MEMBRE, chantierId: CHANTIER, mode: 'geo_confirme', heureDepart: '',
      arriveeLat: 43.29, arriveeLng: 5.37, departLat: 43.3, departLng: 5.38, distanceM: 37,
    })
  })
})

describe('chantier : rayon de pointage GPS', () => {
  it('le rayon choisi est enregistré, à la création comme à la modification', () => {
    expect(mapToSupabase('chantiers', { titre: 'Villa Dupré', geoRayonM: 250 })).toMatchObject({ geo_rayon_m: 250 })
    expect(colonnesModifiees('chantiers', { geoRayonM: 250 })).toEqual({ geo_rayon_m: 250 })
  })

  it('sans rayon fourni (ou rayon illisible), rien n’est envoyé : la base garde sa valeur', () => {
    expect(mapToSupabase('chantiers', { titre: 'Villa Dupré' })).not.toHaveProperty('geo_rayon_m')
    expect(colonnesModifiees('chantiers', { geoRayonM: undefined })).toEqual({})
    expect(colonnesModifiees('chantiers', { geoRayonM: 0 })).toEqual({})
  })
})

describe('membre, équipe, dépense : rattachements', () => {
  it('l’équipe choisie pour un membre est enregistrée ; « Sans équipe » donne null', () => {
    expect(mapToSupabase('membres', { prenom: 'Paul', nom: 'Durand', equipeId: EQUIPE })).toMatchObject({ equipe_id: EQUIPE })
    expect(colonnesModifiees('membres', { equipeId: '' })).toEqual({ equipe_id: null })
  })

  it('le chantier d’une équipe est enregistré avec elle', () => {
    expect(mapToSupabase('equipes', { nom: 'Maçons', chantierId: CHANTIER, membreIds: [] })).toMatchObject({ chantier_id: CHANTIER })
    expect(colonnesModifiees('equipes', { nom: 'Maçons', chantierId: '' })).toEqual({ nom: 'Maçons', chantier_id: null })
  })

  it('le chantier d’une dépense est enregistré avec elle', () => {
    expect(mapToSupabase('depenses', { label: 'Ciment', amount: 120, chantierId: CHANTIER })).toMatchObject({ chantier_id: CHANTIER })
    expect(mapToSupabase('depenses', { label: 'Ciment', amount: 120 })).toMatchObject({ chantier_id: null })
  })
})
