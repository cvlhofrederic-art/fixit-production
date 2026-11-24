// @vitest-environment node
// tests/api/btp-ecriture-validation.test.ts — POST /api/btp : ce que le serveur accepte d'écrire, table par table
// (constat donnees-btp-9, 15/11/2026).
//
// Avant : seul le nom de la table et l'action étaient contrôlés ; la fiche partait telle quelle en base. Un champ
// inconnu ou un texte dans un montant finissait en « Erreur serveur », un budget négatif ou une retenue à 150 %
// passaient sans alerte, tout compte connecté (client, syndic) pouvait remplir ces tables, et l'import des anciennes
// données du navigateur pouvait s'ajouter à une table déjà remplie (doublons).
// Maintenant :
//   - colonnes du relevé de production seulement, types que la base accepte, champs obligatoires → 400 clair ;
//   - bornes métier (montant négatif, taux hors 0-100) à la création et quand une modification change la valeur ;
//     une valeur déjà en base renvoyée telle quelle par l'écran est acceptée et signalée au journal ;
//   - import refusé (409) si le compte a déjà des lignes dans la table ; bornes seulement signalées à l'import ;
//   - écriture réservée aux comptes du tableau de bord professionnel (403 pour un client ou un syndic).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { FauxBase } from '../helpers/faux-supabase-btp'

const h = vi.hoisted(() => ({
  base: null as unknown as FauxBase,
  user: null as null | { id: string; app_metadata?: Record<string, unknown> },
}))

// Seul getAuthUser est simulé : la route lit aussi getUserRole, isProGerant et resolveCompanyId pour établir le
// périmètre de la société (lib/btp/perimetre-compte.ts, 24/11/2026), et c'est bien ce vrai code qu'on éprouve ici.
vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.user),
}))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/supabase-server', async () => {
  const { fauxSupabase } = await import('../helpers/faux-supabase-btp')
  return { supabaseAdmin: { from: (t: string) => fauxSupabase(h.base).from(t) } }
})

const { GET, POST } = await import('@/app/api/btp/route')
const { nouvelleBase, requetes } = await import('../helpers/faux-supabase-btp')
const { logger } = await import('@/lib/logger')

const SOCIETE = '550e8400-e29b-41d4-a716-446655440000'
const AUTRE = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const CHANTIER = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const RETENUE = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'
const SITUATION = 'c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f'

const poster = async (corps: Record<string, unknown>) => {
  const res = await POST(new NextRequest('https://vitfix.io/api/btp', {
    method: 'POST',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  }))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}

const ecritures = () => h.base.journal.filter(e => e.operation !== 'select')
const chantier = () => h.base.lignes.chantiers_btp.find(l => l.id === CHANTIER)

beforeEach(() => {
  h.user = { id: SOCIETE, app_metadata: { role: 'pro_societe' } }
  h.base = nouvelleBase({
    chantiers_btp: [{ id: CHANTIER, owner_id: SOCIETE, titre: 'Rénovation cuisine', budget: 12000, statut: 'En cours' }],
  })
  vi.mocked(logger.warn).mockClear()
})

describe('POST /api/btp — colonnes acceptées (relevé de la base de production)', () => {
  it('champ qui n’est pas une colonne : 400 qui le nomme, rien n’est écrit', async () => {
    const res = await poster({ table: 'chantiers_btp', action: 'insert', data: { titre: 'Toiture', couleur: 'rouge' } })

    expect(res.status).toBe(400)
    expect(res.json.error).toMatch(/non reconnu.*couleur/)
    expect(ecritures()).toEqual([])
  })

  it('réglages avec un champ qui n’est pas une colonne (country) : 400, rien n’est écrit', async () => {
    const res = await poster({ table: 'settings_btp', action: 'upsert_settings', data: { country: 'FR', taux_is: 25 } })

    expect(res.status).toBe(400)
    expect(res.json.error).toMatch(/country/)
    expect(ecritures()).toEqual([])
  })

  it('identifiant, propriétaire et dates système envoyés par l’écran : ignorés, la fiche est créée au nom du compte', async () => {
    const res = await poster({
      table: 'chantiers_btp', action: 'insert',
      data: { titre: 'Toiture', id: 'forge', owner_id: AUTRE, created_at: '2020-01-01', updated_at: '2020-01-01', equipe_membres_btp: [] },
    })

    expect(res.status).toBe(201)
    const [insertion] = requetes(h.base, 'chantiers_btp', 'insert')
    expect(insertion.valeur).toEqual({ titre: 'Toiture', owner_id: SOCIETE })
  })

  it('modification : created_at et updated_at fournis ne sont pas réécrits', async () => {
    h.base.lignes.situations_btp = [{ id: SITUATION, owner_id: SOCIETE, chantier: 'Toiture', statut: 'brouillon', created_at: '2026-10-01' }]

    const res = await poster({ table: 'situations_btp', action: 'update', id: SITUATION, data: { statut: 'envoyée', created_at: '2020-01-01', updated_at: '2020-01-01' } })

    expect(res.status).toBe(200)
    const [modification] = requetes(h.base, 'situations_btp', 'update')
    expect(modification.valeur).toEqual({ statut: 'envoyée' })
    expect(h.base.lignes.situations_btp[0].created_at).toBe('2026-10-01')
  })

  it('réglages enregistrés par une autre action qu’upsert_settings : 400', async () => {
    const res = await poster({ table: 'settings_btp', action: 'insert', data: { devise: 'EUR' } })
    expect(res.status).toBe(400)
    expect(ecritures()).toEqual([])
  })
})

describe('POST /api/btp — types que la base accepte', () => {
  it('texte dans un montant : 400 qui nomme le champ', async () => {
    const res = await poster({ table: 'chantiers_btp', action: 'insert', data: { titre: 'Toiture', budget: 'beaucoup' } })
    expect(res.status).toBe(400)
    expect(res.json.error).toMatch(/budget/)
    expect(ecritures()).toEqual([])
  })

  it('identifiant de chantier mal formé : 400', async () => {
    const res = await poster({ table: 'situations_btp', action: 'insert', data: { chantier: 'Toiture', chantier_id: 'pas-un-identifiant' } })
    expect(res.status).toBe(400)
    expect(res.json.error).toMatch(/chantier_id/)
    expect(ecritures()).toEqual([])
  })

  it('objet dans un champ texte : 400', async () => {
    const res = await poster({ table: 'chantiers_btp', action: 'insert', data: { titre: { texte: 'Toiture' } } })
    expect(res.status).toBe(400)
    expect(ecritures()).toEqual([])
  })

  it('témoin : nombre écrit en texte (« 12000 »), date et heure en texte, JSON libre : acceptés comme par la base', async () => {
    const res = await poster({ table: 'pointages_btp', action: 'insert', data: { employe: 'Paul', date: '2026-11-15', heure_arrivee: '08:00', pause_minutes: '60', heures_travaillees: 7.5 } })
    expect(res.status).toBe(201)
    const chantierEnTexte = await poster({ table: 'chantiers_btp', action: 'insert', data: { titre: 'Toiture', budget: '12000', sous_taches: [{ nom: 'Dépose' }] } })
    expect(chantierEnTexte.status).toBe(201)
  })
})

describe('POST /api/btp — champs obligatoires', () => {
  it('création sans titre : 400', async () => {
    const res = await poster({ table: 'chantiers_btp', action: 'insert', data: { client: 'M. Martin' } })
    expect(res.status).toBe(400)
    expect(res.json.error).toMatch(/obligatoire.*titre/)
    expect(ecritures()).toEqual([])
  })

  it('titre vidé (null) en modification : 400, la fiche reste intacte', async () => {
    const res = await poster({ table: 'chantiers_btp', action: 'update', id: CHANTIER, data: { titre: null } })
    expect(res.status).toBe(400)
    expect(res.json.error).toMatch(/titre/)
    expect(chantier()?.titre).toBe('Rénovation cuisine')
  })

  it('témoin : modification partielle sans le titre, acceptée', async () => {
    const res = await poster({ table: 'chantiers_btp', action: 'update', id: CHANTIER, data: { statut: 'Terminé' } })
    expect(res.status).toBe(200)
    expect(chantier()?.statut).toBe('Terminé')
  })
})

describe('POST /api/btp — bornes métier', () => {
  it('création d’un chantier au budget négatif : 400 avec un message clair, rien n’est écrit', async () => {
    const res = await poster({ table: 'chantiers_btp', action: 'insert', data: { titre: 'Toiture', budget: -50000 } })
    expect(res.status).toBe(400)
    expect(res.json.error).toMatch(/budget.*positive ou nulle/)
    expect(ecritures()).toEqual([])
  })

  it('création d’une retenue de garantie à 150 % : 400', async () => {
    const res = await poster({ table: 'retenues_btp', action: 'insert', data: { chantier: 'Toiture', taux_retenue: 150 } })
    expect(res.status).toBe(400)
    expect(res.json.error).toMatch(/taux de retenue.*entre 0 et 100/)
    expect(ecritures()).toEqual([])
  })

  it('modification qui saisit un budget négatif : 400, la fiche garde son budget', async () => {
    const res = await poster({ table: 'chantiers_btp', action: 'update', id: CHANTIER, data: { budget: -50000 } })
    expect(res.status).toBe(400)
    expect(chantier()?.budget).toBe(12000)
    expect(requetes(h.base, 'chantiers_btp', 'update')).toEqual([])
  })

  it('valeur hors bornes déjà en base, renvoyée telle quelle par le formulaire : acceptée et signalée au journal', async () => {
    h.base.lignes.retenues_btp = [{ id: RETENUE, owner_id: SOCIETE, chantier: 'Toiture', taux_retenue: 150 }]

    const res = await poster({ table: 'retenues_btp', action: 'update', id: RETENUE, data: { chantier: 'Toiture B', taux_retenue: 150 } })

    expect(res.status).toBe(200)
    expect(h.base.lignes.retenues_btp[0]).toMatchObject({ chantier: 'Toiture B', taux_retenue: 150 })
    expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/déjà en base/), expect.objectContaining({ colonnes: ['taux_retenue'] }))
  })

  it('valeur hors bornes déjà en base mais remplacée par une autre valeur hors bornes : 400', async () => {
    h.base.lignes.retenues_btp = [{ id: RETENUE, owner_id: SOCIETE, chantier: 'Toiture', taux_retenue: 150 }]
    const res = await poster({ table: 'retenues_btp', action: 'update', id: RETENUE, data: { taux_retenue: 160 } })
    expect(res.status).toBe(400)
    expect(h.base.lignes.retenues_btp[0].taux_retenue).toBe(150)
  })

  it('réglages : taux d’IS à 150 refusé ; déjà enregistré à 150 et renvoyé tel quel, accepté', async () => {
    const refuse = await poster({ table: 'settings_btp', action: 'upsert_settings', data: { taux_is: 150 } })
    expect(refuse.status).toBe(400)
    expect(ecritures()).toEqual([])

    h.base.lignes.settings_btp = [{ owner_id: SOCIETE, taux_is: 150 }]
    const accepte = await poster({ table: 'settings_btp', action: 'upsert_settings', data: { taux_is: 150, objectif_marge_pct: 20 } })
    expect(accepte.status).toBe(200)
    expect(h.base.lignes.settings_btp[0]).toMatchObject({ taux_is: 150, objectif_marge_pct: 20 })
  })

  it('témoin : valeurs dans les bornes, aucune lecture de plus', async () => {
    const res = await poster({ table: 'chantiers_btp', action: 'update', id: CHANTIER, data: { budget: 15000, latitude: 43.3, longitude: 5.4 } })
    expect(res.status).toBe(200)
    expect(requetes(h.base, 'chantiers_btp', 'select')).toEqual([])
  })
})

describe('POST /api/btp — reprise des anciennes données du navigateur (import)', () => {
  const pointage = { employe: 'Paul', date: '2026-01-05', heure_arrivee: '08:00', heure_depart: '17:00', pause_minutes: 60, heures_travaillees: 8, mode: 'manuel' }

  it('le compte a déjà des pointages : 409, rien n’est inséré (pas de doublon)', async () => {
    h.base.lignes.pointages_btp = [{ id: 'p-existant', owner_id: SOCIETE, ...pointage }]

    const res = await poster({ table: 'pointages_btp', action: 'import', data: [pointage] })

    expect(res.status).toBe(409)
    expect(res.json.error).toMatch(/déjà/)
    expect(requetes(h.base, 'pointages_btp', 'insert')).toEqual([])
  })

  it('témoin : table vide pour ce compte (les lignes d’un autre compte ne comptent pas), reprise acceptée', async () => {
    h.base.lignes.pointages_btp = [{ id: 'p-autre', owner_id: AUTRE, ...pointage }]

    const res = await poster({ table: 'pointages_btp', action: 'import', data: [pointage, { ...pointage, date: '2026-01-06' }] })

    expect(res.status).toBe(200)
    expect(res.json).toEqual({ imported: 2 })
  })

  it('valeur hors bornes dans les anciennes données : reprise acceptée, valeur signalée au journal', async () => {
    const res = await poster({ table: 'retenues_btp', action: 'import', data: [{ chantier: 'Toiture', taux_retenue: 150 }] })
    expect(res.status).toBe(200)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/reprise/), expect.objectContaining({ colonnes: ['taux_retenue'] }))
  })

  it('anciennes équipes du navigateur (membreIds) : refusées comme avant, rien n’est inséré', async () => {
    const res = await poster({ table: 'equipes_btp', action: 'import', data: [{ nom: 'Maçons', metier: null, membreIds: ['local-1'] }] })
    expect(res.status).toBe(400)
    expect(res.json.error).toMatch(/membreIds/)
    expect(requetes(h.base, 'equipes_btp', 'insert')).toEqual([])
  })

  it('ligne invalide dans l’import : 400 qui donne son rang, rien n’est inséré', async () => {
    const res = await poster({ table: 'pointages_btp', action: 'import', data: [pointage, { ...pointage, heures_travaillees: 'huit' }] })
    expect(res.status).toBe(400)
    expect(res.json.error).toMatch(/ligne 2/)
    expect(requetes(h.base, 'pointages_btp', 'insert')).toEqual([])
  })
})

describe('POST /api/btp — comptes autorisés à écrire', () => {
  for (const role of ['client', 'particulier', 'syndic', 'syndic_admin', 'coproprio']) {
    it(`compte ${role} : 403, aucune écriture`, async () => {
      h.user = { id: SOCIETE, app_metadata: { role } }
      const res = await poster({ table: 'chantiers_btp', action: 'insert', data: { titre: 'Toiture' } })
      expect(res.status).toBe(403)
      expect(h.base.journal).toEqual([])
    })
  }

  it('artisan : la reprise lancée par l’accueil partagé reste possible', async () => {
    h.user = { id: SOCIETE, app_metadata: { role: 'artisan' } }
    h.base.lignes.chantiers_btp = []
    const res = await poster({ table: 'chantiers_btp', action: 'import', data: [{ titre: 'Ancien chantier' }] })
    expect(res.status).toBe(200)
  })

  it('compte sans rôle (artisan inscrit avant l’attribution du rôle) : accepté comme avant', async () => {
    h.user = { id: SOCIETE }
    const res = await poster({ table: 'chantiers_btp', action: 'insert', data: { titre: 'Toiture' } })
    expect(res.status).toBe(201)
  })

  it('lecture (GET) inchangée pour un compte client', async () => {
    h.user = { id: SOCIETE, app_metadata: { role: 'client' } }
    const res = await GET(new NextRequest('https://vitfix.io/api/btp?table=chantiers', { headers: { Authorization: 'Bearer tok' } }))
    expect(res.status).toBe(200)
  })
})
