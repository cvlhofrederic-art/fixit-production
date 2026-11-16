// tests/lib/btp-pointage-colonnes.test.ts — colonnes écrites par useBTPData pour le pointage BTP (16/11/2026).
//
// Avant : le rayon du pointage GPS (fiche chantier), les employés choisis sur la fiche chantier, le chantier d'une
// équipe, l'employé et le chantier d'un pointage saisi à la main étaient perdus à l'enregistrement (aucune colonne
// dans mapToSupabase). Ils sont maintenant écrits, et seulement quand le formulaire les fournit.

import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null } })), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })) } },
}))

import { colonnesModifiees, ligneImportable, mapToSupabase } from '@/lib/hooks/use-btp-data'

const UUID = '3e4f5a6b-7c8d-4e9f-8a1b-2c3d4e5f6a01'

describe('import depuis le localStorage : anciens identifiants locaux', () => {
  it('retirés des colonnes de clé du pointage (sinon tout le lot échoue sur le type uuid)', () => {
    expect(ligneImportable('equipes', { nom: 'Équipe A', chantier_id: 'demo-ch-001' })).toEqual({ nom: 'Équipe A', chantier_id: null })
    expect(ligneImportable('pointages', { employe: 'X', membre_id: '1712345678901', chantier_id: UUID }))
      .toEqual({ employe: 'X', membre_id: null, chantier_id: UUID })
    expect(ligneImportable('chantiers', { titre: 'Villa', membres_ids: ['demo-m-1', UUID] })).toEqual({ titre: 'Villa', membres_ids: [UUID] })
  })

  it('les autres colonnes et les autres tables passent comme avant', () => {
    expect(ligneImportable('equipes', { nom: 'Équipe A', chantier_id: UUID })).toEqual({ nom: 'Équipe A', chantier_id: UUID })
    expect(ligneImportable('situations', { chantier_id: 'demo-ch-001', chantier: 'Villa' })).toEqual({ chantier_id: 'demo-ch-001', chantier: 'Villa' })
  })
})

describe('chantier : rayon du pointage GPS et employés affectés', () => {
  it('écrits quand la fiche chantier les fournit', () => {
    const fiche = mapToSupabase('chantiers', { titre: 'Villa', statut: 'En cours', geoRayonM: 150, membres_ids: ['m1', 'm2'] })
    expect(fiche).toMatchObject({ titre: 'Villa', geo_rayon_m: 150, membres_ids: ['m1', 'm2'] })
  })

  it('absents d’une création qui ne les fournit pas : la base garde ses valeurs par défaut', () => {
    const creation = mapToSupabase('chantiers', { titre: 'Garage' })
    expect(creation).not.toHaveProperty('geo_rayon_m')
    expect(creation).not.toHaveProperty('membres_ids')
  })

  it('modification partielle : seulement le champ fourni', () => {
    expect(colonnesModifiees('chantiers', { geoRayonM: 200 })).toEqual({ geo_rayon_m: 200 })
    expect(colonnesModifiees('chantiers', { geo_rayon_m: '75' })).toEqual({ geo_rayon_m: 75 })
    expect(colonnesModifiees('chantiers', { membres_ids: [] })).toEqual({ membres_ids: [] })
    expect(colonnesModifiees('chantiers', { statut: 'Terminé' })).toEqual({ statut: 'Terminé' })
  })

  it('rayon illisible : valeur par défaut de la colonne ; employés : identifiants non vides, sans doublon', () => {
    expect(colonnesModifiees('chantiers', { geoRayonM: 0 })).toEqual({ geo_rayon_m: 100 })
    expect(colonnesModifiees('chantiers', { geoRayonM: 'abc' })).toEqual({ geo_rayon_m: 100 })
    expect(colonnesModifiees('chantiers', { geoRayonM: 149.6 })).toEqual({ geo_rayon_m: 150 })
    expect(colonnesModifiees('chantiers', { membres_ids: ['m1', 'm1', '', 5, null, 'm2'] })).toEqual({ membres_ids: ['m1', 'm2'] })
    expect(colonnesModifiees('chantiers', { membres_ids: 'm1' })).toEqual({ membres_ids: [] })
  })
})

describe('équipe : chantier sur lequel elle travaille', () => {
  it('affectée, détachée, ou laissée telle quelle par un renommage', () => {
    expect(colonnesModifiees('equipes', { chantierId: 'c1' })).toEqual({ chantier_id: 'c1' })
    expect(colonnesModifiees('equipes', { chantierId: '' })).toEqual({ chantier_id: null })
    expect(colonnesModifiees('equipes', { nom: 'Maçons' })).toEqual({ nom: 'Maçons' })
  })

  it('le formulaire de l’écran Équipes garde le chantier de l’équipe qu’il modifie', () => {
    expect(colonnesModifiees('equipes', { nom: 'Maçons', metier: 'Gros œuvre', chantierId: 'c1', membreIds: ['m1'] }))
      .toEqual({ nom: 'Maçons', metier: 'Gros œuvre', chantier_id: 'c1', membreIds: ['m1'] })
    expect(mapToSupabase('equipes', { nom: 'Couvreurs' })).toMatchObject({ nom: 'Couvreurs', chantier_id: null })
  })
})

describe('pointage saisi à la main : employé et chantier choisis', () => {
  it('membre_id et chantier_id écrits, mode « manuel » posé à la création', () => {
    expect(mapToSupabase('pointages', {
      employe: 'Paul Exemple', membreId: 'm1', chantier: 'Villa', chantierId: 'c1', date: '2026-11-16',
      heureArrivee: '08:00', heureDepart: '17:00', pauseMinutes: 60, heuresTravaillees: 8,
    })).toMatchObject({ employe: 'Paul Exemple', membre_id: 'm1', chantier_nom: 'Villa', chantier_id: 'c1', mode: 'manuel' })
  })

  it('saisie libre (sans fiche ni chantier choisis) : identifiants vides', () => {
    expect(mapToSupabase('pointages', { employe: 'Intérimaire', chantier: 'Divers' })).toMatchObject({ membre_id: null, chantier_id: null })
  })
})
