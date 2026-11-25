// @vitest-environment node
// tests/api/pro-documents.test.ts — GET /api/pro/documents : les devis et factures de la société, lus par un
// compte qui n'en est pas le titulaire (25/11/2026).
//
// Pourquoi ce banc existe : la relecture adverse a relevé que le choix de lecture de cette route — `artisan_user_id
// = <société>` et RIEN d'autre, après le retrait du second critère `artisan_id` — n'était prouvé par aucun test. Un
// lot qui change le filtre d'une liste doit couvrir sa propre décision, sinon le prochain lecteur réintroduit le
// critère retiré sans qu'aucun rouge ne l'arrête.
//
// Ce que chaque cas protège :
//   - le FILTRE exact : la société, les lignes non supprimées, et aucun identifiant de salarié — sinon désactiver
//     un salarié ferait disparaître des documents de l'écran du gérant ;
//   - une ligne retenue par `artisan_id` seul RESTE invisible : l'écran du gérant ne la montre pas non plus
//     (lib/document-sync.ts) et les quatre routes de mutation répondraient 404 sur chacun de ses boutons ;
//   - une lecture en échec n'est JAMAIS une liste vide : l'écran doit dire « illisible », pas « aucun document » ;
//   - un rôle sans droit est refusé AVANT toute lecture ;
//   - les deux sens du désaccord entre le jeton et la base sont refusés en 409, dont celui que le serveur seul
//     peut voir : une ligne d'équipe que `app_metadata` ne porte pas (le serveur délivrerait un numéro de la
//     série de la société, le navigateur enregistrerait sous le salarié → 403 après consommation du numéro).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { FauxBase, Ligne } from '../helpers/faux-supabase-btp'

const h = vi.hoisted(() => ({
  base: null as unknown as FauxBase,
  user: null as null | { id: string; app_metadata?: Record<string, unknown> },
}))

vi.mock('@/lib/auth-helpers', async (io) => (await import('../helpers/mocks-routes-api')).authHelpersReels(io, () => h.user))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/supabase-server', async () => {
  const { fauxSupabase } = await import('../helpers/faux-supabase-btp')
  return { supabaseAdmin: { from: (t: string) => fauxSupabase(h.base).from(t) } }
})

const { GET } = await import('@/app/api/pro/documents/route')
const { nouvelleBase, requetes } = await import('../helpers/faux-supabase-btp')

const SOCIETE = '550e8400-e29b-41d4-a716-446655440000'
const FICHE = '7cfb1e10-0000-4000-8000-000000000001'
const AUTRE_COMPTE = '7c9e6679-7425-40de-944b-e07fc1f90ae7'

/**
 * `resolveCompanyId` garde en mémoire la société d'un compte 60 secondes (lib/auth-helpers.ts) et n'offre aucune
 * purge : chaque cas prend donc un compte NEUF. Sans cela, la société résolue d'un cas précédent serait servie au
 * suivant, et un cas de refus passerait pour la mauvaise raison.
 */
let compteur = 0
const nouveauCompte = () => {
  compteur += 1
  return `00000000-0000-4000-9000-${String(compteur).padStart(12, '0')}`
}

const lire = async () => {
  const res = await GET(new NextRequest('https://vitfix.io/api/pro/documents', {
    headers: { Authorization: 'Bearer jeton' },
  }))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}

/** La fiche de la société, que `resoudreTitulaireDocuments` exige unique. */
const ficheDeLaSociete = (): Ligne[] => [{
  id: FICHE, user_id: SOCIETE, company_name: 'Société du Gérant', legal_form: 'SAS',
}]

/**
 * Salarié invité : compte neuf, ligne d'équipe active, et la fiche de la société.
 * `jetonSansRattachement` retire `company_id` du jeton ; `sansLigneEquipe` retire la ligne de `pro_team_members`.
 */
function salarieInvite(
  role: string,
  options: { jetonSansRattachement?: boolean; sansLigneEquipe?: boolean; derogations?: Ligne[] } = {},
): string {
  const id = nouveauCompte()
  h.user = {
    id,
    app_metadata: {
      role: 'pro_societe',
      pro_team_role: role,
      ...(options.jetonSansRattachement ? {} : { company_id: SOCIETE }),
    },
  }
  if (!options.sansLigneEquipe) {
    h.base.lignes.pro_team_members = [{ id: `membre-${id}`, user_id: id, company_id: SOCIETE, is_active: true }]
  }
  if (options.derogations) {
    h.base.lignes.pro_role_permissions = options.derogations.map(d => ({ member_id: `membre-${id}`, ...d }))
  }
  h.base.lignes.profiles_artisan = ficheDeLaSociete()
  return id
}

const identifiants = (lignes: unknown) => (lignes as Array<{ id: string }>).map(l => l.id).sort()

beforeEach(() => {
  h.base = nouvelleBase()
  h.user = null
})

describe('GET /api/pro/documents — ce qui est lu, et sous quel compte', () => {
  it('rend les documents de la société, et seulement les siens', async () => {
    salarieInvite('SECRETAIRE')
    h.base.lignes.devis = [
      { id: 'd-1', artisan_user_id: SOCIETE, artisan_id: FICHE, numero: 'ORC-2026-001' },
      { id: 'd-2', artisan_user_id: SOCIETE, artisan_id: FICHE, numero: 'ORC-2026-002', deleted_at: null },
      // Supprimé : hors de la liste, comme sur l'écran du gérant.
      { id: 'd-supprime', artisan_user_id: SOCIETE, artisan_id: FICHE, deleted_at: '2026-11-01T10:00:00Z' },
      // Document d'une autre société : jamais.
      { id: 'd-ailleurs', artisan_user_id: AUTRE_COMPTE, artisan_id: 'fiche-ailleurs' },
    ]
    h.base.lignes.factures = [{ id: 'f-1', artisan_user_id: SOCIETE, artisan_id: FICHE, numero: 'FT-2026-001' }]

    const { status, json } = await lire()

    expect(status).toBe(200)
    // La ligne sans `deleted_at` et celle à `deleted_at: null` comptent toutes les deux — en base, les deux sont NULL.
    expect(identifiants(json.devis)).toEqual(['d-1', 'd-2'])
    expect(identifiants(json.factures)).toEqual(['f-1'])
    expect(json.societeId).toBe(SOCIETE)
    expect(json.ficheId).toBe(FICHE)
  })

  it('filtre sur la société et les lignes vivantes, et sur rien d’autre', async () => {
    const salarie = salarieInvite('SECRETAIRE')
    h.base.lignes.devis = [{ id: 'd-1', artisan_user_id: SOCIETE }]
    h.base.lignes.factures = []

    await lire()

    for (const table of ['devis', 'factures']) {
      const [requete] = requetes(h.base, table, 'select')
      expect(requete, `aucune lecture de ${table}`).toBeDefined()
      expect(requete.filtres).toEqual({ artisan_user_id: SOCIETE })
      expect(requete.estNul).toEqual({ deleted_at: null })
      // Aucun identifiant de salarié dans le filtre : désactiver un salarié ne doit jamais faire disparaître un
      // document de l'écran du gérant.
      expect(JSON.stringify(requete)).not.toContain(salarie)
    }
  })

  it('ne rend pas une ligne retenue par la seule fiche de la société', async () => {
    // Forme héritée : `artisan_id` porte la fiche de la société mais `artisan_user_id` un autre compte. Elle était
    // déjà invisible à l'écran du gérant (lib/document-sync.ts filtre sur `artisan_user_id`), et chaque bouton des
    // quatre routes de mutation lui répondrait 404. La montrer au seul salarié serait pire que de ne pas la montrer.
    salarieInvite('SECRETAIRE')
    h.base.lignes.devis = [
      { id: 'd-societe', artisan_user_id: SOCIETE, artisan_id: FICHE },
      { id: 'd-fiche-seule', artisan_user_id: AUTRE_COMPTE, artisan_id: FICHE },
    ]

    const { status, json } = await lire()

    expect(status).toBe(200)
    expect(identifiants(json.devis)).toEqual(['d-societe'])
  })

  it('relit sans raw_data quand la colonne n’existe pas, au lieu de rendre une erreur', async () => {
    salarieInvite('SECRETAIRE')
    h.base.lignes.devis = [{ id: 'd-1', artisan_user_id: SOCIETE, numero: 'ORC-2026-001' }]
    h.base.lignes.factures = []
    // Comme PostgREST : 42703 seulement parce que la requête demande une colonne absente du schéma.
    h.base.erreurs.push({
      table: 'devis',
      operation: 'select',
      siColonne: 'raw_data',
      erreur: { code: '42703', message: 'column devis.raw_data does not exist' },
    })

    const { status, json } = await lire()

    expect(status).toBe(200)
    expect(identifiants(json.devis)).toEqual(['d-1'])
    const lectures = requetes(h.base, 'devis', 'select')
    expect(lectures).toHaveLength(2)
    expect(lectures[0].colonnes).toContain('raw_data')
    expect(lectures[1].colonnes).not.toContain('raw_data')
  })

  it('rend 500 quand une lecture échoue, jamais une liste vide', async () => {
    salarieInvite('SECRETAIRE')
    h.base.lignes.devis = [{ id: 'd-1', artisan_user_id: SOCIETE }]
    h.base.erreurs.push({
      table: 'factures',
      operation: 'select',
      erreur: { code: '08006', message: 'connection failure' },
    })

    const { status, json } = await lire()

    expect(status).toBe(500)
    expect(json.code).toBe('lecture_impossible')
    // Surtout pas de liste : l'écran doit montrer une erreur, pas « aucun document ».
    expect(json.devis).toBeUndefined()
    expect(json.factures).toBeUndefined()
  })
})

describe('GET /api/pro/documents — qui a le droit de lire', () => {
  it('refuse un compte sans session', async () => {
    const { status } = await lire()
    expect(status).toBe(401)
  })

  it('refuse un compte qui n’est pas de société', async () => {
    h.user = { id: nouveauCompte(), app_metadata: { role: 'artisan' } }
    const { status } = await lire()
    expect(status).toBe(403)
  })

  it('refuse un rôle sans aucun droit sur les documents, sans rien lire', async () => {
    // Un ouvrier ou un chef de chantier pointe ses heures : il garde son application (voir /api/pro/titulaire),
    // mais il n'a rien à faire dans les devis ni dans les factures.
    salarieInvite('OUVRIER')
    h.base.lignes.devis = [{ id: 'd-1', artisan_user_id: SOCIETE }]

    const { status, json } = await lire()

    expect(status).toBe(403)
    expect(json.code).toBe('aucun_droit')
    expect(requetes(h.base, 'devis', 'select')).toHaveLength(0)
    expect(requetes(h.base, 'factures', 'select')).toHaveLength(0)
  })

  it('ne lit que les familles permises : une dérogation du gérant ferme une liste', async () => {
    // Aucun rôle par défaut n'a exactement une famille lisible ; c'est une dérogation posée par le gérant
    // (pro_role_permissions) qui crée ce cas, et elle doit se voir dans ce qui part en base.
    //
    // Le rôle de départ est SECRETAIRE (FULL partout sauf la gestion des comptes) parce qu'il est stable : les
    // matrices des rôles de terrain sont des décisions produit qui bougent, et ce cas ne porte pas sur elles.
    salarieInvite('SECRETAIRE', { derogations: [{ module_id: 'factures', access_level: 'NONE' }] })
    h.base.lignes.devis = [{ id: 'd-1', artisan_user_id: SOCIETE }]
    h.base.lignes.factures = [{ id: 'f-1', artisan_user_id: SOCIETE }]

    const { status, json } = await lire()

    expect(status).toBe(200)
    expect(identifiants(json.devis)).toEqual(['d-1'])
    expect(json.factures).toEqual([])
    // La liste fermée n'est pas lue du tout : pas de lecture suivie d'un filtrage en mémoire.
    expect(requetes(h.base, 'factures', 'select')).toHaveLength(0)
  })

  it('lit sous son propre compte pour le titulaire de la société', async () => {
    // Règle n° 1 : un gérant, un artisan ou un super_admin garde exactement le comportement d'avant ce lot.
    h.user = { id: SOCIETE, app_metadata: { role: 'pro_societe', pro_team_role: 'GERANT' } }
    h.base.lignes.profiles_artisan = ficheDeLaSociete()
    h.base.lignes.devis = [
      { id: 'd-sien', artisan_user_id: SOCIETE },
      { id: 'd-autre', artisan_user_id: AUTRE_COMPTE },
    ]

    const { status, json } = await lire()

    expect(status).toBe(200)
    expect(identifiants(json.devis)).toEqual(['d-sien'])
    expect(json.societeId).toBe(SOCIETE)
    // Aucune résolution d'équipe pour un titulaire : lirePerimetreBtp sort avant toute requête.
    expect(requetes(h.base, 'pro_team_members')).toHaveLength(0)
  })
})

describe('GET /api/pro/documents — le jeton et la base ne disent pas la même chose', () => {
  it('refuse en 409 un rattachement annoncé que la base ne confirme pas', async () => {
    salarieInvite('SECRETAIRE', { sansLigneEquipe: true })
    h.base.lignes.devis = [{ id: 'd-1', artisan_user_id: SOCIETE }]

    const { status, json } = await lire()

    expect(status).toBe(409)
    expect(json.code).toBe('societe_non_resolue')
    // Rien n'est lu sous un autre identifiant : surtout pas les documents du compte lui-même.
    expect(requetes(h.base, 'devis', 'select')).toHaveLength(0)
    expect(requetes(h.base, 'profiles_artisan', 'select')).toHaveLength(0)
  })

  it('refuse en 409 une ligne d’équipe que le jeton ne porte pas', async () => {
    // Le sens que le serveur SEUL peut voir, et le plus coûteux : il résoudrait la société et `next_doc_number`
    // (qui ne vérifie aucun rôle) délivrerait un numéro de SA série, pendant que le navigateur — qui décide à
    // partir de `app_metadata.company_id` seul — enregistrerait sous le compte du salarié. /api/devis/sync
    // répondrait alors 403 APRÈS la consommation du numéro, et la série du gérant garderait un trou définitif
    // (art. 242 nonies A I 2° du CGI). Refusé avant le numéro.
    salarieInvite('SECRETAIRE', { jetonSansRattachement: true })
    h.base.lignes.devis = [{ id: 'd-1', artisan_user_id: SOCIETE }]

    const { status, json } = await lire()

    expect(status).toBe(409)
    expect(json.code).toBe('societe_non_resolue')
    expect(requetes(h.base, 'devis', 'select')).toHaveLength(0)
  })

  it('refuse quand la fiche de la société est introuvable', async () => {
    salarieInvite('SECRETAIRE')
    h.base.lignes.profiles_artisan = []

    const { status, json } = await lire()

    expect(status).toBe(409)
    expect(json.code).toBe('fiche_societe_absente')
    expect(requetes(h.base, 'devis', 'select')).toHaveLength(0)
  })

  it('refuse quand la société porte plusieurs fiches', async () => {
    // `profiles_artisan.user_id` n'est pas unique en production : deux fiches, et l'identité du document devient
    // indécidable. Le gérant doit trancher avant que les documents s'ouvrent.
    salarieInvite('SECRETAIRE')
    h.base.lignes.profiles_artisan = [
      { id: FICHE, user_id: SOCIETE, company_name: 'Société du Gérant' },
      { id: 'fiche-doublon', user_id: SOCIETE, company_name: 'Société du Gérant (doublon)' },
    ]

    const { status, json } = await lire()

    expect(status).toBe(409)
    expect(json.code).toBe('fiche_societe_multiple')
    expect(requetes(h.base, 'devis', 'select')).toHaveLength(0)
  })
})
