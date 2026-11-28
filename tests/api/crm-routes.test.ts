// Routes du CRM du secrétariat (app/api/crm/*) : contrôle d'accès, validation, et ce qui est écrit en base.
// Accès : super admin (rôle + liste d'e-mails, isSuperAdmin réel) ou app_metadata.role === 'secretariat'. Seul getAuthUser
// est simulé ; la base est un faux client qui enregistre chaque requête (table, opération, valeurs, filtres).
// Données fictives.

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { EMAIL_HORS_LISTE, EMAIL_SUPER_ADMIN, compte, definirListeSuperAdmin, superAdminAutorise, superAdminHorsListe } from './super-admin-test-utils'

interface Requete {
  table: string
  op: 'select' | 'insert' | 'update'
  /** Texte passé à select() (colonnes et jointures demandées à PostgREST). */
  colonnes: string | null
  valeurs: Record<string, unknown> | null
  filtres: string[]
  fin: 'single' | 'maybeSingle' | 'liste'
}
type Reponse = { data: unknown; error: { code?: string; message: string } | null; count?: number | null }

const h = vi.hoisted(() => {
  const etat = {
    user: null as User | null,
    requetes: [] as Requete[],
    repondre: (_r: Requete): Reponse => ({ data: null, error: null }),
  }
  function from(table: string) {
    const r: Requete = { table, op: 'select', colonnes: null, valeurs: null, filtres: [], fin: 'liste' }
    const fin = (type: Requete['fin']) => {
      r.fin = type
      etat.requetes.push(r)
      return Promise.resolve(etat.repondre(r))
    }
    const chaine: Record<string, unknown> = {
      select: (c: string) => ((r.colonnes = c), chaine),
      insert: (v: Record<string, unknown>) => ((r.op = 'insert'), (r.valeurs = v), chaine),
      update: (v: Record<string, unknown>) => ((r.op = 'update'), (r.valeurs = v), chaine),
      eq: (c: string, v: unknown) => (r.filtres.push(`${c}=${String(v)}`), chaine),
      or: (f: string) => (r.filtres.push(`or(${f})`), chaine),
      ilike: (c: string, v: string) => (r.filtres.push(`${c} ilike ${v}`), chaine),
      like: (c: string, v: string) => (r.filtres.push(`${c} like ${v}`), chaine),
      order: () => chaine,
      limit: () => chaine,
      single: () => fin('single'),
      maybeSingle: () => fin('maybeSingle'),
      then: (ok: (v: Reponse) => unknown, ko: (e: unknown) => unknown) => fin('liste').then(ok, ko),
    }
    return chaine
  }
  return { etat, from: vi.fn(from) }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.etat.user),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: h.from } }))

definirListeSuperAdmin()
const demandes = await import('@/app/api/crm/demandes/route')
const uneDemande = await import('@/app/api/crm/demandes/[id]/route')
const notes = await import('@/app/api/crm/demandes/[id]/notes/route')
const contacts = await import('@/app/api/crm/contacts/route')
const unContact = await import('@/app/api/crm/contacts/[id]/route')

afterAll(() => {
  vi.unstubAllEnvs()
})

const ID_DEMANDE = '3f2b8c1e-5d4a-4b6f-9e7d-1a2b3c4d5e6f'
const ID_CONTACT = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
const ID_NOUVEAU = '9b8a7c6d-5e4f-4d3c-8b2a-1f0e9d8c7b6a'
const URL = 'http://localhost:3000/api/crm'

const secretaire = () => compte({ email: 'secretariat@exemple.test', role: 'secretariat', appMetadata: {} })

function requete(chemin: string, methode = 'GET', corps?: unknown, brut?: string): NextRequest {
  return new NextRequest(`${URL}${chemin}`, {
    method: methode,
    headers: { Authorization: 'Bearer jeton', 'content-type': 'application/json' },
    ...(corps !== undefined || brut !== undefined ? { body: brut ?? JSON.stringify(corps) } : {}),
  })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

const ligneDemande = (valeurs: Record<string, unknown> = {}) => ({
  id: ID_DEMANDE,
  numero: 7,
  contact_id: ID_CONTACT,
  titre: 'Fuite',
  description: '',
  motif: 'urgence',
  canal: 'appel',
  priorite: 'urgente',
  statut: 'nouvelle',
  rappel_le: null,
  resolue_le: null,
  created_at: '2026-11-22T10:00:00Z',
  updated_at: '2026-11-22T10:00:00Z',
  contact: { id: ID_CONTACT, nom: 'Client fictif', telephone: '+351912345678' },
  ...valeurs,
})

const ecritures = (table: string, op: Requete['op']) => h.etat.requetes.filter((r) => r.table === table && r.op === op)

beforeEach(() => {
  vi.clearAllMocks()
  h.etat.user = null
  h.etat.requetes = []
  h.etat.repondre = () => ({ data: null, error: null })
})

// Chaque route, appelée avec une saisie valable : seul le compte change d'un cas à l'autre.
const APPELS: Array<[string, () => Promise<Response>]> = [
  ['GET /demandes', () => demandes.GET(requete('/demandes'))],
  ['POST /demandes', () => demandes.POST(requete('/demandes', 'POST', { motif: 'info', canal: 'appel', titre: 'x' }))],
  ['GET /demandes/:id', () => uneDemande.GET(requete(`/demandes/${ID_DEMANDE}`), params(ID_DEMANDE))],
  ['PATCH /demandes/:id', () => uneDemande.PATCH(requete(`/demandes/${ID_DEMANDE}`, 'PATCH', { statut: 'en_cours' }), params(ID_DEMANDE))],
  ['POST /demandes/:id/notes', () => notes.POST(requete(`/demandes/${ID_DEMANDE}/notes`, 'POST', { contenu: 'x' }), params(ID_DEMANDE))],
  ['GET /contacts', () => contacts.GET(requete('/contacts?telephone=912345678'))],
  ['PATCH /contacts/:id', () => unContact.PATCH(requete(`/contacts/${ID_CONTACT}`, 'PATCH', { nom: 'x' }), params(ID_CONTACT))],
]

describe('contrôle d’accès des routes du CRM', () => {
  it.each(APPELS)('%s sans session → 401, aucune requête en base', async (_nom, appel) => {
    expect((await appel()).status).toBe(401)
    expect(h.from).not.toHaveBeenCalled()
  })

  const REFUSES: Array<[string, () => User]> = [
    ['client', () => compte({ email: EMAIL_HORS_LISTE, role: 'client' })],
    ['artisan', () => compte({ email: EMAIL_HORS_LISTE, role: 'artisan' })],
    ['super_admin hors de la liste d’e-mails', () => superAdminHorsListe()],
    // Vrai super admin (e-mail de la liste) pendant une « vue en tant que » : son rôle prêté est artisan, il est refusé.
    ['« vue en tant que » d’un super admin (rôle prêté)', () => compte({ email: EMAIL_SUPER_ADMIN, role: 'artisan', appMetadata: { _original_role: 'super_admin' } })],
    ['secretariat dans user_metadata seulement', () => ({ ...compte({ email: EMAIL_HORS_LISTE, role: 'client' }), user_metadata: { role: 'secretariat' } }) as User],
    ['rôle voisin (secretariat_x)', () => compte({ email: EMAIL_HORS_LISTE, role: 'secretariat_x' })],
  ]

  for (const [nom, appel] of APPELS) {
    it.each(REFUSES)(`${nom} : %s → 403, aucune requête en base`, async (_c, fabrique) => {
      h.etat.user = fabrique()
      expect((await appel()).status).toBe(403)
      expect(h.from).not.toHaveBeenCalled()
    })
  }

  it.each([
    ['secretariat', secretaire],
    ['super_admin de la liste', () => superAdminAutorise()],
  ])('%s : la liste s’ouvre', async (_nom, fabrique) => {
    h.etat.user = fabrique()
    h.etat.repondre = () => ({ data: [], error: null })
    const res = await demandes.GET(requete('/demandes'))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })
})

describe('validation', () => {
  beforeEach(() => {
    h.etat.user = secretaire()
  })

  it('JSON illisible, numéro non reconnu, champ inconnu → 400 sans écriture', async () => {
    expect((await demandes.POST(requete('/demandes', 'POST', undefined, '{pas du json'))).status).toBe(400)
    const numero = await demandes.POST(requete('/demandes', 'POST', { motif: 'info', canal: 'appel', titre: 'x', telephone: '12345' }))
    expect(numero.status).toBe(400)
    expect((await numero.json()).champs).toContain('telephone')
    expect((await demandes.POST(requete('/demandes', 'POST', { motif: 'info', canal: 'appel', titre: 'x', statut: 'resolue' }))).status).toBe(400)
    expect(h.from).not.toHaveBeenCalled()
  })

  it('identifiant d’URL qui n’est pas un UUID → 400', async () => {
    expect((await uneDemande.GET(requete('/demandes/abc'), params('abc'))).status).toBe(400)
    expect((await unContact.PATCH(requete('/contacts/abc', 'PATCH', { nom: 'x' }), params('abc'))).status).toBe(400)
    expect(h.from).not.toHaveBeenCalled()
  })

  it('recherche par numéro non reconnu → 400', async () => {
    expect((await contacts.GET(requete('/contacts?telephone=12'))).status).toBe(400)
  })
})

describe('POST /api/crm/demandes', () => {
  beforeEach(() => {
    h.etat.user = secretaire()
  })

  it('numéro déjà connu : la fiche existante est reprise, aucun contact créé ; création journalisée avec l’auteur', async () => {
    h.etat.repondre = (r) => {
      if (r.table === 'crm_contacts' && r.op === 'select') return { data: { id: ID_CONTACT, nom: 'Client fictif', telephone: '+351912345678' }, error: null }
      if (r.table === 'crm_demandes') return { data: ligneDemande(), error: null }
      return { data: { id: 'evt' }, error: null }
    }
    const res = await demandes.POST(requete('/demandes', 'POST', { telephone: '912 345 678', nom: 'Autre nom', motif: 'urgence', canal: 'appel', description: 'Fuite sous évier\nCuisine' }))
    expect(res.status).toBe(201)
    expect(ecritures('crm_contacts', 'insert')).toHaveLength(0)
    expect(ecritures('crm_contacts', 'update')).toHaveLength(0) // le nom déjà rempli n'est pas écrasé
    const [insertion] = ecritures('crm_demandes', 'insert')
    expect(insertion.valeurs).toMatchObject({ contact_id: ID_CONTACT, titre: 'Fuite sous évier', priorite: 'urgente', motif: 'urgence', canal: 'appel', rappel_le: null })
    const [journal] = ecritures('crm_evenements', 'insert')
    expect(journal.valeurs).toMatchObject({ demande_id: ID_DEMANDE, type: 'creation', auteur_nom: 'secretariat' })
  })

  it('nouveau numéro : fiche créée au format E.164 avec le nom saisi', async () => {
    h.etat.repondre = (r) => {
      if (r.table === 'crm_contacts' && r.op === 'select') return { data: null, error: null }
      if (r.table === 'crm_contacts' && r.op === 'insert') return { data: { id: ID_NOUVEAU }, error: null }
      if (r.table === 'crm_demandes') return { data: ligneDemande({ contact_id: ID_NOUVEAU }), error: null }
      return { data: { id: 'evt' }, error: null }
    }
    const res = await demandes.POST(requete('/demandes', 'POST', { telephone: '06 12 34 56 78', nom: 'Nouveau client', motif: 'devis', canal: 'whatsapp', titre: 'Devis façade' }))
    expect(res.status).toBe(201)
    expect(ecritures('crm_contacts', 'insert')[0].valeurs).toMatchObject({ nom: 'Nouveau client', telephone: '+33612345678' })
    expect(ecritures('crm_demandes', 'insert')[0].valeurs).toMatchObject({ contact_id: ID_NOUVEAU, priorite: 'normale', titre: 'Devis façade' })
  })

  it('même numéro créé entre-temps par un autre poste (23505) : la fiche créée est reprise', async () => {
    let lectures = 0
    h.etat.repondre = (r) => {
      if (r.table === 'crm_contacts' && r.op === 'select') return lectures++ === 0 ? { data: null, error: null } : { data: { id: ID_CONTACT, nom: '' }, error: null }
      if (r.table === 'crm_contacts' && r.op === 'insert') return { data: null, error: { code: '23505', message: 'duplicate key' } }
      if (r.table === 'crm_demandes') return { data: ligneDemande(), error: null }
      return { data: { id: 'evt' }, error: null }
    }
    const res = await demandes.POST(requete('/demandes', 'POST', { telephone: '+351912345678', motif: 'info', canal: 'appel', titre: 'x' }))
    expect(res.status).toBe(201)
    expect(ecritures('crm_demandes', 'insert')[0].valeurs).toMatchObject({ contact_id: ID_CONTACT })
  })

  it('appel masqué sans nom : demande sans fiche', async () => {
    h.etat.repondre = (r) => (r.table === 'crm_demandes' ? { data: ligneDemande({ contact_id: null, contact: null }), error: null } : { data: { id: 'evt' }, error: null })
    const res = await demandes.POST(requete('/demandes', 'POST', { motif: 'info', canal: 'appel_manque', titre: 'Appel masqué' }))
    expect(res.status).toBe(201)
    expect(h.etat.requetes.filter((r) => r.table === 'crm_contacts')).toHaveLength(0)
    expect(ecritures('crm_demandes', 'insert')[0].valeurs).toMatchObject({ contact_id: null })
  })

  it('fiche choisie inconnue → 404, rien d’écrit', async () => {
    h.etat.repondre = () => ({ data: null, error: null })
    const res = await demandes.POST(requete('/demandes', 'POST', { contact_id: ID_CONTACT, motif: 'info', canal: 'appel', titre: 'x' }))
    expect(res.status).toBe(404)
    expect(ecritures('crm_demandes', 'insert')).toHaveLength(0)
  })

  it('panne de la base → 500 sans détail interne', async () => {
    h.etat.repondre = () => ({ data: null, error: { code: 'XX000', message: 'relation crm_contacts secret detail' } })
    const res = await demandes.POST(requete('/demandes', 'POST', { telephone: '912345678', motif: 'info', canal: 'appel', titre: 'x' }))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'erreur_serveur' })
  })
})

describe('PATCH /api/crm/demandes/:id', () => {
  beforeEach(() => {
    h.etat.user = secretaire()
  })

  function avecStatut(statut: string) {
    h.etat.repondre = (r) => {
      if (r.table === 'crm_demandes' && r.op === 'select') return { data: { id: ID_DEMANDE, statut, contact_id: ID_CONTACT }, error: null }
      if (r.table === 'crm_demandes') return { data: ligneDemande(), error: null }
      return { data: { id: 'evt' }, error: null }
    }
  }

  it('résolue : date de résolution posée et changement journalisé', async () => {
    avecStatut('en_cours')
    expect((await uneDemande.PATCH(requete(`/demandes/${ID_DEMANDE}`, 'PATCH', { statut: 'resolue' }), params(ID_DEMANDE))).status).toBe(200)
    const [maj] = ecritures('crm_demandes', 'update')
    expect(maj.valeurs).toMatchObject({ statut: 'resolue' })
    expect(typeof maj.valeurs?.resolue_le).toBe('string')
    expect(ecritures('crm_evenements', 'insert')[0].valeurs).toMatchObject({ type: 'statut', contenu: 'en_cours>resolue' })
  })

  it('rouverte : date de résolution effacée', async () => {
    avecStatut('resolue')
    await uneDemande.PATCH(requete(`/demandes/${ID_DEMANDE}`, 'PATCH', { statut: 'en_cours' }), params(ID_DEMANDE))
    expect(ecritures('crm_demandes', 'update')[0].valeurs).toMatchObject({ statut: 'en_cours', resolue_le: null })
  })

  it('même statut, ou autre champ : rien au journal, date de résolution intacte', async () => {
    avecStatut('en_cours')
    await uneDemande.PATCH(requete(`/demandes/${ID_DEMANDE}`, 'PATCH', { statut: 'en_cours', rappel_le: '2026-11-23T09:00:00.000Z' }), params(ID_DEMANDE))
    expect(ecritures('crm_demandes', 'update')[0].valeurs).not.toHaveProperty('resolue_le')
    expect(ecritures('crm_evenements', 'insert')).toHaveLength(0)
  })

  it('demande inconnue → 404', async () => {
    h.etat.repondre = () => ({ data: null, error: null })
    expect((await uneDemande.PATCH(requete(`/demandes/${ID_DEMANDE}`, 'PATCH', { statut: 'resolue' }), params(ID_DEMANDE))).status).toBe(404)
  })
})

describe('lectures', () => {
  beforeEach(() => {
    h.etat.user = secretaire()
  })

  it('GET /demandes : ouvertes + résolues des 30 derniers jours, jointure du contact, compteurs calculés', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-22T15:00:00Z'))
    try {
      h.etat.repondre = () => ({ data: [ligneDemande(), ligneDemande({ id: 'x', statut: 'resolue', resolue_le: '2026-11-21T10:00:00Z', contact: [{ id: ID_CONTACT, nom: 'Tableau', telephone: null }] })], error: null })
      const res = await demandes.GET(requete('/demandes'))
      const corps = await res.json()
      expect(corps.compteurs).toEqual({ aTraiterAujourdhui: 1, enRetard: 0, resoluesSemaine: 1 })
      expect(corps.demandes[1].contact).toEqual({ id: ID_CONTACT, nom: 'Tableau', telephone: null })
      expect(corps.tronquee).toBe(false)
      expect(h.etat.requetes[0].filtres).toEqual(['or(statut.neq.resolue,resolue_le.gte.2026-10-23T15:00:00.000Z)'])
      expect(h.etat.requetes[0].colonnes).toContain('contact:crm_contacts(id, nom, telephone)')
    } finally {
      vi.useRealTimers()
    }
  })

  it('GET /contacts?telephone= : fiche et nombre de demandes', async () => {
    h.etat.repondre = (r) =>
      r.table === 'crm_contacts' ? { data: { id: ID_CONTACT, nom: 'Client fictif', telephone: '+351912345678' }, error: null } : { data: null, error: null, count: 3 }
    const corps = await (await contacts.GET(requete('/contacts?telephone=%2B351%20912%20345%20678'))).json()
    expect(corps.telephone).toBe('+351912345678')
    expect(corps.trouve).toMatchObject({ nbDemandes: 3, contact: { id: ID_CONTACT } })
    expect(h.etat.requetes[0].filtres).toEqual(['telephone=+351912345678'])
  })

  it('GET /contacts?q= : % et _ de la saisie restent littéraux', async () => {
    h.etat.repondre = () => ({ data: [], error: null })
    await contacts.GET(requete('/contacts?q=100%25_x'))
    expect(h.etat.requetes[0].filtres[0]).toBe('nom ilike %100\\%\\_x%')
    expect(h.etat.requetes[1].filtres[0]).toBe('telephone like %100%')
  })
})

describe('PATCH /api/crm/contacts/:id', () => {
  it('numéro déjà pris par une autre fiche → 409', async () => {
    h.etat.user = secretaire()
    h.etat.repondre = () => ({ data: null, error: { code: '23505', message: 'duplicate key' } })
    expect((await unContact.PATCH(requete(`/contacts/${ID_CONTACT}`, 'PATCH', { telephone: '912345678' }), params(ID_CONTACT))).status).toBe(409)
  })
})
