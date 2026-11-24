// @vitest-environment node
// tests/api/btp-perimetre-salarie.test.ts — ce qu'un salarié d'une société BTP lit et écrit par /api/btp (24/11/2026).
//
// Avant : la route filtrait tout par `owner_id = user.id`. Un salarié invité porte son propre identifiant, qui n'est
// celui d'aucune ligne de la société : il recevait des listes VIDES, sans erreur — et c'était cette même borne qui
// l'empêchait de modifier ou de supprimer les lignes du gérant, par effet de bord et non par règle. Ouvrir la lecture
// au périmètre de la société sans rien d'autre aurait donc ouvert la suppression du même coup.
//
// Maintenant : la société est résolue côté serveur, et le rôle d'équipe décide. FULL = tout, et le droit d'écrire ;
// READ = vue restreinte (ses chantiers affectés, sans les montants) et aucune écriture ; NONE = rien.
// Ces tests portent sur la décision de la route ; la matrice elle-même est vérifiée par tests/permissions.test.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { FauxBase } from '../helpers/faux-supabase-btp'

const h = vi.hoisted(() => ({
  base: null as unknown as FauxBase,
  user: null as null | { id: string; email?: string; app_metadata?: Record<string, unknown> },
}))

vi.mock('@/lib/auth-helpers', async (io) => (await import('../helpers/mocks-routes-api')).authHelpersReels(io, () => h.user))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/supabase-server', async () => {
  const { fauxSupabase } = await import('../helpers/faux-supabase-btp')
  return { supabaseAdmin: { from: (t: string) => fauxSupabase(h.base).from(t) } }
})

const { GET, POST } = await import('@/app/api/btp/route')
const { nouvelleBase } = await import('../helpers/faux-supabase-btp')

const SOCIETE = '550e8400-e29b-41d4-a716-446655440000'
const AUTRE_SOCIETE = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const M1 = '11111111-1111-4111-8111-111111111111'
const M2 = '22222222-2222-4222-8222-222222222222'
const E1 = '33333333-3333-4333-8333-333333333333'
const C_AFFECTE = 'aaaaaaaa-0000-4000-8000-000000000001'
const C_PAR_EQUIPE = 'aaaaaaaa-0000-4000-8000-000000000002'
const C_TERMINE = 'aaaaaaaa-0000-4000-8000-000000000003'
const C_AUTRUI = 'aaaaaaaa-0000-4000-8000-000000000004'

const EMAIL_OUVRIER = 'joao@exemple.test'

/** Un identifiant de compte neuf à chaque scénario : resolveCompanyId garde sa réponse 5 minutes en mémoire. */
let compteur = 0
const nouveauCompte = () => `99999999-0000-4000-8000-${String((compteur += 1)).padStart(12, '0')}`

const lire = async (query: string) => {
  const res = await GET(new NextRequest(`https://vitfix.io/api/btp${query}`, { headers: { Authorization: 'Bearer tok' } }))
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

const ecrire = async (corps: unknown) => {
  const res = await POST(new NextRequest('https://vitfix.io/api/btp', {
    method: 'POST', headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' }, body: JSON.stringify(corps),
  }))
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

/** Compte le gérant : il EST la société, sans rôle d'équipe. */
const gerant = () => { h.user = { id: SOCIETE, email: 'patron@exemple.test', app_metadata: { role: 'pro_societe' } } }

/** Sous-compte d'équipe relié à la société, avec son rôle. */
function salarie(role: string, options: { email?: string; derogations?: { module_id: string; access_level: string }[] } = {}) {
  const userId = nouveauCompte()
  const membreId = nouveauCompte()
  h.user = { id: userId, email: options.email ?? EMAIL_OUVRIER, app_metadata: { role: 'pro_societe', pro_team_role: role, company_id: SOCIETE } }
  h.base.lignes.pro_team_members = [{ id: membreId, user_id: userId, company_id: SOCIETE, is_active: true }]
  h.base.lignes.pro_role_permissions = (options.derogations ?? []).map(d => ({ member_id: membreId, ...d }))
}

const titres = (lignes: unknown) => (lignes as { titre: string }[]).map(l => l.titre).sort()

beforeEach(() => {
  h.base = nouvelleBase({
    chantiers_btp: [
      { id: C_AFFECTE, owner_id: SOCIETE, titre: 'Affecté', statut: 'En cours', membres_ids: [M1], budget: 120000, client: 'Mme Dupont', ville: 'Porto', latitude: 41.1, longitude: -8.6 },
      { id: C_PAR_EQUIPE, owner_id: SOCIETE, titre: 'Par équipe', statut: 'En cours', membres_ids: [], budget: 80000, client: 'SCI Bellevue', ville: 'Braga' },
      { id: C_TERMINE, owner_id: SOCIETE, titre: 'Terminé', statut: 'Terminé', membres_ids: [M1], budget: 50000, client: 'M. Lopes' },
      { id: C_AUTRUI, owner_id: AUTRE_SOCIETE, titre: 'Chantier d’une autre société', statut: 'En cours', membres_ids: [M1] },
    ],
    membres_btp: [
      { id: M1, owner_id: SOCIETE, prenom: 'João', nom: 'Ouvrier', email: EMAIL_OUVRIER, actif: true, salaire_net_mensuel: 1600, cout_horaire: 22 },
      { id: M2, owner_id: SOCIETE, prenom: 'Autre', nom: 'Collègue', email: 'autre@exemple.test', actif: true, salaire_net_mensuel: 2100 },
    ],
    equipes_btp: [{ id: E1, owner_id: SOCIETE, nom: 'Équipe A', chantier_id: C_PAR_EQUIPE }],
    equipe_membres_btp: [{ equipe_id: E1, membre_id: M1 }],
    depenses_btp: [{ id: 'dep-1', owner_id: SOCIETE, montant: 900 }],
    pro_team_members: [],
    pro_role_permissions: [],
  })
})

describe('GET /api/btp — le gérant ne perd rien', () => {
  it('voit les chantiers de sa société, et seulement les siens, avec les montants', async () => {
    gerant()
    const { status, json } = await lire('?table=chantiers')
    expect(status).toBe(200)
    expect(titres(json.chantiers)).toEqual(['Affecté', 'Par équipe', 'Terminé'])
    expect((json.chantiers as Record<string, unknown>[])[0]).toHaveProperty('budget')
    expect(json.restreint).toBeUndefined()
  })

  it('voit les fiches employés avec leurs salaires', async () => {
    gerant()
    const { json } = await lire('?table=membres')
    expect((json.membres as Record<string, unknown>[])[0]).toHaveProperty('salaire_net_mensuel')
  })
})

describe('GET /api/btp — salarié de terrain (vue restreinte)', () => {
  it('ne voit que ses chantiers en cours : affectation directe ou par son équipe', async () => {
    salarie('OUVRIER')
    const { status, json } = await lire('?table=chantiers')
    expect(status).toBe(200)
    expect(titres(json.chantiers)).toEqual(['Affecté', 'Par équipe'])
    expect(json.restreint).toBe(true)
    expect(json.rattachement).toBe('relie')
  })

  it('ne reçoit ni budget, ni client, ni identifiant du propriétaire', async () => {
    salarie('OUVRIER')
    const { json } = await lire('?table=chantiers')
    for (const chantier of json.chantiers as Record<string, unknown>[]) {
      expect(chantier).not.toHaveProperty('budget')
      expect(chantier).not.toHaveProperty('client')
      expect(chantier).not.toHaveProperty('owner_id')
      // Ce qu'il lui faut pour s'y rendre et pour la météo reste là.
      expect(chantier).toHaveProperty('titre')
      expect(chantier).toHaveProperty('ville')
    }
    const affecte = (json.chantiers as Record<string, unknown>[]).find(c => c.titre === 'Affecté')
    expect(affecte).toMatchObject({ latitude: 41.1, longitude: -8.6 })
  })

  it.each(['membres', 'depenses'])('ne reçoit rien de la liste %s, interdite à son rôle', async (table) => {
    salarie('OUVRIER')
    const { status, json } = await lire(`?table=${table}`)
    expect(status).toBe(200)
    expect(json[table]).toEqual([])
  })

  it('sans fiche employé à son adresse, aucun chantier — et la réponse le dit', async () => {
    salarie('OUVRIER', { email: 'jamais-vu@exemple.test' })
    const { json } = await lire('?table=chantiers')
    expect(json.chantiers).toEqual([])
    expect(json.rattachement).toBe('aucun')
  })

  it('deux fiches actives à la même adresse : rattachement ambigu, aucun chantier', async () => {
    h.base.lignes.membres_btp.push({ id: 'dbl', owner_id: SOCIETE, prenom: 'João', nom: 'Doublon', email: EMAIL_OUVRIER, actif: true })
    salarie('OUVRIER')
    const { json } = await lire('?table=chantiers')
    expect(json.chantiers).toEqual([])
    expect(json.rattachement).toBe('ambigu')
  })

  // Le chef de chantier a « equipes: READ », mais les fiches employés n'ont PAS de vue restreinte : les écrans
  // remplaceraient les colonnes retirées par des valeurs par défaut (coût horaire 25 €, charges 45 %), c'est-à-dire
  // par des chiffres de paie faux donnés pour ceux d'un collègue. En lecture seule, il ne reçoit donc rien.
  it('table=all : ses chantiers, et rien des listes qui porteraient de la paie ou des montants', async () => {
    salarie('CHEF_CHANTIER')
    const { json } = await lire('?table=all')
    expect(titres(json.chantiers)).toEqual(['Affecté', 'Par équipe'])
    expect(json.membres).toEqual([])
    expect(json.equipes).toEqual([])
    expect(json.depenses).toEqual([])
    expect(json.settings).toBeNull()
    expect(json.restreint).toBe(true)
  })

  // La reprise des anciennes données du navigateur sème une table vide de la société : réservée au titulaire, même
  // pour un rôle qui a FULL sur la table visée.
  it('refuse la reprise des anciennes données à la secrétaire', async () => {
    salarie('SECRETAIRE')
    const { status } = await ecrire({ table: 'chantiers_btp', action: 'import', data: [] })
    expect(status).toBe(403)
  })
})

describe('GET /api/btp — rôle d’équipe non reconnu', () => {
  // Un rôle ajouté en base sans être codé ici ne doit rien ouvrir : aucune permission, donc aucune donnée.
  it('ne voit rien et n’écrit rien', async () => {
    salarie('ROLE_QUI_N_EXISTE_PAS')
    const lecture = await lire('?table=chantiers')
    expect(lecture.json.chantiers).toEqual([])
    const ecriture = await ecrire({ table: 'chantiers_btp', action: 'insert', data: { titre: 'X' } })
    expect(ecriture.status).toBe(403)
  })
})

describe('GET /api/btp — la secrétaire a tous les pouvoirs', () => {
  it('voit tous les chantiers de la société, montants compris', async () => {
    salarie('SECRETAIRE')
    const { json } = await lire('?table=chantiers')
    expect(titres(json.chantiers)).toEqual(['Affecté', 'Par équipe', 'Terminé'])
    expect((json.chantiers as Record<string, unknown>[])[0]).toHaveProperty('budget')
    expect(json.restreint).toBeUndefined()
  })
})

describe('GET /api/btp — les dérogations du gérant priment', () => {
  it('un ouvrier à qui le gérant a donné FULL sur les chantiers les voit tous', async () => {
    salarie('OUVRIER', { derogations: [{ module_id: 'chantiers', access_level: 'FULL' }] })
    const { json } = await lire('?table=chantiers')
    expect(titres(json.chantiers)).toEqual(['Affecté', 'Par équipe', 'Terminé'])
    expect(json.restreint).toBeUndefined()
  })

  it('un ouvrier à qui le gérant a retiré les chantiers n’en voit aucun', async () => {
    salarie('OUVRIER', { derogations: [{ module_id: 'chantiers', access_level: 'NONE' }] })
    const { json } = await lire('?table=chantiers')
    expect(json.chantiers).toEqual([])
  })
})

describe('POST /api/btp — l’écriture suit le rôle, pas le simple fait d’être un compte pro', () => {
  it.each([
    ['chantiers_btp', 'OUVRIER'],
    ['membres_btp', 'OUVRIER'],
    ['chantiers_btp', 'CHEF_CHANTIER'],
    ['membres_btp', 'CONDUCTEUR_TRAVAUX'],
    ['settings_btp', 'OUVRIER'],
  ])('refuse %s à un %s', async (table, role) => {
    salarie(role)
    const action = table === 'settings_btp' ? 'upsert_settings' : 'insert'
    const { status } = await ecrire({ table, action, data: { titre: 'Chantier pirate' } })
    expect(status).toBe(403)
  })

  it('refuse à un salarié de SUPPRIMER un chantier de la société', async () => {
    salarie('OUVRIER')
    const { status } = await ecrire({ table: 'chantiers_btp', action: 'delete', id: C_AFFECTE })
    expect(status).toBe(403)
    expect(h.base.lignes.chantiers_btp.some(c => c.id === C_AFFECTE)).toBe(true)
  })

  it('laisse le gérant créer un chantier, comme avant', async () => {
    gerant()
    const { status } = await ecrire({ table: 'chantiers_btp', action: 'insert', data: { titre: 'Nouveau chantier', statut: 'En cours' } })
    expect(status).toBe(201)
    expect(h.base.lignes.chantiers_btp.some(c => c.titre === 'Nouveau chantier' && c.owner_id === SOCIETE)).toBe(true)
  })

  it('la secrétaire écrit sous la société, pas sous son propre compte', async () => {
    salarie('SECRETAIRE')
    const { status } = await ecrire({ table: 'chantiers_btp', action: 'insert', data: { titre: 'Chantier de Tatiana', statut: 'En cours' } })
    expect(status).toBe(201)
    const cree = h.base.lignes.chantiers_btp.find(c => c.titre === 'Chantier de Tatiana')
    expect(cree?.owner_id).toBe(SOCIETE)
  })
})
