// @vitest-environment node
// tests/api/btp-ecriture-rattachements.test.ts — POST /api/btp : une fiche ne se rattache qu'aux chantiers, membres
// et équipes du compte (constats api-coeur-9 et donnees-btp-9, 15/11/2026).
//
// Avant : chantier_id, membre_id, equipe_id et la liste des membres d'une équipe n'étaient pas contrôlés, et les liens
// d'une équipe étaient écrits sans contrôle d'erreur : une équipe pouvait être annoncée créée sans ses membres.
// Maintenant : chaque identifiant désigné doit appartenir au compte (400 sinon) ; une valeur déjà enregistrée sur la
// fiche et renvoyée telle quelle reste acceptée (signalée au journal) ; un échec d'écriture des membres est dit, et
// la modification d'une équipe n'écrit que les liens ajoutés ou retirés.

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

const { POST } = await import('@/app/api/btp/route')
const { nouvelleBase, requetes } = await import('../helpers/faux-supabase-btp')
const { logger } = await import('@/lib/logger')

const SOCIETE = '550e8400-e29b-41d4-a716-446655440000'
const AUTRE = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const CH_A = 'a1a1a1a1-0000-4000-8000-000000000001'
const CH_A2 = 'a1a1a1a1-0000-4000-8000-000000000002'
const CH_B = 'b2b2b2b2-0000-4000-8000-000000000001'
const CH_B2 = 'b2b2b2b2-0000-4000-8000-000000000002'
const CH_SUPPRIME = 'c3c3c3c3-0000-4000-8000-000000000001'
const M_A1 = 'd4d4d4d4-0000-4000-8000-000000000001'
const M_A2 = 'd4d4d4d4-0000-4000-8000-000000000002'
const M_B = 'e5e5e5e5-0000-4000-8000-000000000001'
const EQ_A = 'f6f6f6f6-0000-4000-8000-000000000001'
const EQ_B = 'f6f6f6f6-0000-4000-8000-000000000002'
const SITUATION = '17171717-0000-4000-8000-000000000001'

const poster = async (corps: Record<string, unknown>) => {
  const res = await POST(new NextRequest('https://vitfix.io/api/btp', {
    method: 'POST',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  }))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}

const pointage = { employe: 'Paul', date: '2026-11-15', heure_arrivee: '08:00', pause_minutes: 60, mode: 'manuel' }

/** Membres liés à une équipe dans la base simulée. */
const membresLies = (equipe: string) =>
  (h.base.lignes.equipe_membres_btp ?? []).filter(l => l.equipe_id === equipe).map(l => String(l.membre_id))

beforeEach(() => {
  h.user = { id: SOCIETE, app_metadata: { role: 'pro_societe' } }
  h.base = nouvelleBase({
    chantiers_btp: [
      { id: CH_A, owner_id: SOCIETE, titre: 'Cuisine' }, { id: CH_A2, owner_id: SOCIETE, titre: 'Salle de bains' },
      { id: CH_B, owner_id: AUTRE, titre: 'Chantier d’une autre société' }, { id: CH_B2, owner_id: AUTRE, titre: 'Autre' },
    ],
    membres_btp: [
      { id: M_A1, owner_id: SOCIETE, prenom: 'Paul', nom: 'Durand' }, { id: M_A2, owner_id: SOCIETE, prenom: 'Léa', nom: 'Martin' },
      { id: M_B, owner_id: AUTRE, prenom: 'Salarié', nom: 'Autre société', cout_horaire: 31 },
    ],
    equipes_btp: [{ id: EQ_A, owner_id: SOCIETE, nom: 'Maçons' }, { id: EQ_B, owner_id: AUTRE, nom: 'Couvreurs' }],
    equipe_membres_btp: [],
  })
  vi.mocked(logger.warn).mockClear()
  vi.mocked(logger.error).mockClear()
})

describe('POST /api/btp — création rattachée à une fiche', () => {
  it('pointage sur le chantier d’une autre société : 400, rien n’est enregistré', async () => {
    const res = await poster({ table: 'pointages_btp', action: 'insert', data: { ...pointage, chantier_id: CH_B } })
    expect(res.status).toBe(400)
    expect(res.json.error).toMatch(/chantier introuvable dans votre compte/)
    expect(requetes(h.base, 'pointages_btp', 'insert')).toEqual([])
  })

  it('pointage au nom du salarié d’une autre société : 400', async () => {
    const res = await poster({ table: 'pointages_btp', action: 'insert', data: { ...pointage, membre_id: M_B } })
    expect(res.status).toBe(400)
    expect(res.json.error).toMatch(/membre de l'équipe introuvable/)
    expect(requetes(h.base, 'pointages_btp', 'insert')).toEqual([])
  })

  it('membre rangé dans l’équipe d’une autre société : 400', async () => {
    const res = await poster({ table: 'membres_btp', action: 'insert', data: { prenom: 'Jean', nom: 'Petit', cout_horaire: 25, charges_pct: 45, equipe_id: EQ_B } })
    expect(res.status).toBe(400)
    expect(res.json.error).toMatch(/équipe introuvable/)
  })

  it('dépense rattachée à un chantier qui n’existe plus : 400', async () => {
    const res = await poster({ table: 'depenses_btp', action: 'insert', data: { label: 'Ciment', amount: 120, chantier_id: CH_SUPPRIME } })
    expect(res.status).toBe(400)
    expect(requetes(h.base, 'depenses_btp', 'insert')).toEqual([])
  })

  it('témoin : situation rattachée à un chantier du compte, acceptée', async () => {
    const res = await poster({ table: 'situations_btp', action: 'insert', data: { chantier: 'Cuisine', chantier_id: CH_A } })
    expect(res.status).toBe(201)
  })

  it('équipe avec un membre d’une autre société : 400, ni équipe ni liens créés', async () => {
    const res = await poster({ table: 'equipes_btp', action: 'insert', data: { nom: 'Plaquistes', membreIds: [M_A1, M_B] } })
    expect(res.status).toBe(400)
    expect(res.json.error).toMatch(/membre de l'équipe introuvable/)
    expect(requetes(h.base, 'equipes_btp', 'insert')).toEqual([])
    expect(requetes(h.base, 'equipe_membres_btp', 'insert')).toEqual([])
  })

  it('équipe avec ses membres (un membre cité deux fois) : créée, chaque membre lié une fois', async () => {
    const res = await poster({ table: 'equipes_btp', action: 'insert', data: { nom: 'Plaquistes', membreIds: [M_A1, M_A2, M_A1] } })
    expect(res.status).toBe(201)
    const id = (res.json.row as { id: string }).id
    expect(h.base.lignes.equipe_membres_btp).toEqual([{ equipe_id: id, membre_id: M_A1 }, { equipe_id: id, membre_id: M_A2 }])
  })

  it('liste de membres qui n’est pas une liste d’identifiants : 400', async () => {
    const res = await poster({ table: 'equipes_btp', action: 'insert', data: { nom: 'Plaquistes', membreIds: 'tout le monde' } })
    expect(res.status).toBe(400)
    expect(requetes(h.base, 'equipes_btp', 'insert')).toEqual([])
  })

  it('les liens de l’équipe ne s’écrivent pas : erreur dite, l’équipe créée par la requête est retirée', async () => {
    h.base.erreurs.push({ table: 'equipe_membres_btp', operation: 'insert', erreur: { code: '57014', message: 'canceling statement due to statement timeout' } })

    const res = await poster({ table: 'equipes_btp', action: 'insert', data: { nom: 'Plaquistes', membreIds: [M_A1] } })

    expect(res.status).toBe(500)
    expect(h.base.lignes.equipes_btp.map(e => e.nom)).toEqual(['Maçons', 'Couvreurs'])
  })
})

describe('POST /api/btp — modification d’un rattachement', () => {
  beforeEach(() => {
    // Situation enregistrée avant le correctif, rattachée au chantier d'une autre société.
    h.base.lignes.situations_btp = [{ id: SITUATION, owner_id: SOCIETE, chantier: 'Ancienne', chantier_id: CH_B, statut: 'brouillon' }]
  })

  it('rattachement déjà enregistré, renvoyé tel quel par le formulaire : accepté, signalé au journal', async () => {
    const res = await poster({ table: 'situations_btp', action: 'update', id: SITUATION, data: { chantier: 'Ancienne (renommée)', chantier_id: CH_B } })
    expect(res.status).toBe(200)
    expect(h.base.lignes.situations_btp[0]).toMatchObject({ chantier: 'Ancienne (renommée)', chantier_id: CH_B })
    expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/rattachement déjà en base/), expect.objectContaining({ colonnes: ['chantier_id'] }))
  })

  it('rattachement changé vers un autre chantier qui n’est pas au compte : 400, la fiche ne bouge pas', async () => {
    const res = await poster({ table: 'situations_btp', action: 'update', id: SITUATION, data: { chantier_id: CH_B2 } })
    expect(res.status).toBe(400)
    expect(h.base.lignes.situations_btp[0].chantier_id).toBe(CH_B)
  })

  it('témoin : rattachement changé vers un chantier du compte, accepté sans lecture de plus', async () => {
    const res = await poster({ table: 'situations_btp', action: 'update', id: SITUATION, data: { chantier_id: CH_A } })
    expect(res.status).toBe(200)
    expect(h.base.lignes.situations_btp[0].chantier_id).toBe(CH_A)
    expect(requetes(h.base, 'situations_btp', 'select')).toEqual([])
  })

  // Membres d'une équipe (relecture adverse du 15/11/2026) : la route n'écrit que la différence avec les liens
  // enregistrés. Un lien inchangé n'est ni supprimé ni réinséré : la base refuse de réécrire un lien vers le membre
  // d'une autre société (migration 20261115_btp_rattachements_meme_compte.sql), et supprimer tous les liens pour tout
  // réinsérer aurait alors vidé l'équipe.
  it('équipe : membre d’une autre société déjà lié, liste renvoyée avec un membre de plus : seul le nouveau lien est écrit', async () => {
    h.base.lignes.equipe_membres_btp = [{ equipe_id: EQ_A, membre_id: M_B }, { equipe_id: EQ_A, membre_id: M_A1 }]

    const res = await poster({ table: 'equipes_btp', action: 'update', id: EQ_A, data: { nom: 'Maçons', membreIds: [M_B, M_A1, M_A2] } })

    expect(res.status).toBe(200)
    expect(new Set(membresLies(EQ_A))).toEqual(new Set([M_B, M_A1, M_A2]))
    expect(requetes(h.base, 'equipe_membres_btp', 'delete')).toEqual([])
    expect(requetes(h.base, 'equipe_membres_btp', 'insert').map(e => e.valeur)).toEqual([[{ equipe_id: EQ_A, membre_id: M_A2 }]])
  })

  it('équipe : nouveau membre d’une autre société, 400, les liens ne bougent pas', async () => {
    h.base.lignes.equipe_membres_btp = [{ equipe_id: EQ_A, membre_id: M_A1 }]

    const res = await poster({ table: 'equipes_btp', action: 'update', id: EQ_A, data: { membreIds: [M_A1, M_B] } })

    expect(res.status).toBe(400)
    expect(h.base.lignes.equipe_membres_btp).toEqual([{ equipe_id: EQ_A, membre_id: M_A1 }])
  })

  it('équipe : membre retiré, seul son lien est supprimé ; les autres, dont un lien ancien, ne sont pas réécrits', async () => {
    h.base.lignes.equipe_membres_btp = [
      { equipe_id: EQ_A, membre_id: M_B }, { equipe_id: EQ_A, membre_id: M_A1 }, { equipe_id: EQ_A, membre_id: M_A2 },
    ]

    const res = await poster({ table: 'equipes_btp', action: 'update', id: EQ_A, data: { membreIds: [M_B, M_A1] } })

    expect(res.status).toBe(200)
    expect(requetes(h.base, 'equipe_membres_btp', 'delete')).toMatchObject([{ filtres: { equipe_id: EQ_A }, dans: { membre_id: [M_A2] } }])
    expect(requetes(h.base, 'equipe_membres_btp', 'insert')).toEqual([])
    expect(new Set(membresLies(EQ_A))).toEqual(new Set([M_B, M_A1]))
  })

  it('équipe : les nouveaux liens ne s’écrivent pas, erreur dite au lieu d’un succès ; les membres déjà liés restent', async () => {
    h.base.lignes.equipe_membres_btp = [{ equipe_id: EQ_A, membre_id: M_A2 }]
    h.base.erreurs.push({ table: 'equipe_membres_btp', operation: 'insert', erreur: { code: '57014', message: 'canceling statement due to statement timeout' } })

    const res = await poster({ table: 'equipes_btp', action: 'update', id: EQ_A, data: { membreIds: [M_A2, M_A1] } })

    expect(res.status).toBe(500)
    expect(res.json.error).toMatch(/liste de ses membres n'a pas pu être mise à jour/)
    expect(membresLies(EQ_A)).toEqual([M_A2])
  })

  it('équipe : liens enregistrés illisibles, erreur dite, aucun lien supprimé', async () => {
    h.base.lignes.equipe_membres_btp = [{ equipe_id: EQ_A, membre_id: M_A2 }]
    h.base.erreurs.push({ table: 'equipe_membres_btp', operation: 'select', erreur: { code: '57014', message: 'canceling statement due to statement timeout' } })

    const res = await poster({ table: 'equipes_btp', action: 'update', id: EQ_A, data: { membreIds: [M_A1] } })

    expect(res.status).toBe(500)
    expect(res.json.error).toMatch(/liste de ses membres n'a pas pu être mise à jour/)
    expect(requetes(h.base, 'equipe_membres_btp', 'delete')).toEqual([])
    expect(membresLies(EQ_A)).toEqual([M_A2])
  })
})

// Employés affectés à un chantier (chantiers_btp.membres_ids, uuid[] sans clé étrangère, migration 20261116 du pointage
// géolocalisé) : même règle que membre_id, élément par élément (réunion avec la PR #703, 17/11/2026).
describe('POST /api/btp — employés affectés à un chantier (membres_ids)', () => {
  const M_SUPPRIME = 'd4d4d4d4-0000-4000-8000-0000000000ff'

  it('création avec un employé d’une autre société : 400, rien n’est créé', async () => {
    const res = await poster({ table: 'chantiers_btp', action: 'insert', data: { titre: 'Garage', membres_ids: [M_A1, M_B] } })
    expect(res.status).toBe(400)
    expect(res.json.error).toMatch(/membre de l'équipe introuvable dans votre compte/)
    expect(requetes(h.base, 'chantiers_btp', 'insert')).toEqual([])
  })

  it('témoin : création avec des employés du compte, la liste est écrite', async () => {
    const res = await poster({ table: 'chantiers_btp', action: 'insert', data: { titre: 'Garage', membres_ids: [M_A1, M_A2] } })
    expect(res.status).toBe(201)
    expect(res.json.row).toMatchObject({ titre: 'Garage', owner_id: SOCIETE, membres_ids: [M_A1, M_A2] })
  })

  it('liste qui n’est pas une liste d’identifiants : 400, rien n’est créé', async () => {
    const res = await poster({ table: 'chantiers_btp', action: 'insert', data: { titre: 'Garage', membres_ids: ['m1'] } })
    expect(res.status).toBe(400)
    expect(res.json.error).toMatch(/mauvais format pour membres_ids/)
    expect(requetes(h.base, 'chantiers_btp', 'insert')).toEqual([])
  })

  it('employé supprimé depuis, resté dans la liste et renvoyé tel quel avec un employé de plus : accepté, signalé au journal', async () => {
    h.base.lignes.chantiers_btp[0].membres_ids = [M_SUPPRIME, M_A1]

    const res = await poster({ table: 'chantiers_btp', action: 'update', id: CH_A, data: { membres_ids: [M_SUPPRIME, M_A1, M_A2] } })

    expect(res.status).toBe(200)
    expect(h.base.lignes.chantiers_btp[0].membres_ids).toEqual([M_SUPPRIME, M_A1, M_A2])
    expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/rattachement déjà en base/), expect.objectContaining({ colonnes: ['membres_ids'] }))
  })

  it('employé d’une autre société ajouté à la liste : 400, la liste ne bouge pas', async () => {
    h.base.lignes.chantiers_btp[0].membres_ids = [M_A1]

    const res = await poster({ table: 'chantiers_btp', action: 'update', id: CH_A, data: { membres_ids: [M_A1, M_B] } })

    expect(res.status).toBe(400)
    expect(h.base.lignes.chantiers_btp[0].membres_ids).toEqual([M_A1])
  })

  it('reprise d’un chantier dont un employé n’est pas au compte : 400, rien n’est ajouté', async () => {
    h.base.lignes.chantiers_btp = []
    const res = await poster({ table: 'chantiers_btp', action: 'import', data: [{ titre: 'Villa', membres_ids: [M_B] }] })
    expect(res.status).toBe(400)
    expect(requetes(h.base, 'chantiers_btp', 'insert')).toEqual([])
  })
})

describe('POST /api/btp — reprise (import) rattachée', () => {
  it('situation reprise du navigateur rattachée au chantier d’une autre société : 400, rien n’est ajouté', async () => {
    const res = await poster({ table: 'situations_btp', action: 'import', data: [{ chantier: 'A', chantier_id: CH_A }, { chantier: 'B', chantier_id: CH_B }] })
    expect(res.status).toBe(400)
    expect(res.json.error).toMatch(/chantier introuvable/)
    expect(requetes(h.base, 'situations_btp', 'insert')).toEqual([])
  })

  it('témoin : reprise rattachée aux chantiers du compte, acceptée', async () => {
    const res = await poster({ table: 'situations_btp', action: 'import', data: [{ chantier: 'A', chantier_id: CH_A }, { chantier: 'A2', chantier_id: CH_A2 }] })
    expect(res.status).toBe(200)
    expect(res.json).toEqual({ imported: 2 })
  })
})
