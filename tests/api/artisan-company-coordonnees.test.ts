/**
 * GET /api/artisan-company : coordonnées que le formulaire de devis artisan (components/DevisFactureForm.tsx) et la
 * section Rapports reprennent du profil.
 *
 * Défaut corrigé le 17/11/2026 : la route faisait passer l'adresse de connexion (ou l'e-mail des métadonnées
 * d'inscription) avant l'e-mail professionnel enregistré dans « Mon profil » (profiles_artisan.email). Un e-mail
 * professionnel choisi par le pro n'arrivait donc jamais sur ses devis. Contrat vérifié ici, sur les deux chemins de
 * la route (profil déjà complet, et complément par l'API Recherche d'entreprises) :
 * - profil avec un e-mail → c'est lui qui est renvoyé ;
 * - profil sans e-mail → l'adresse de connexion sert de repli.
 * Même défaut pour le téléphone : celui saisi à l'inscription (métadonnées du compte, jamais mises à jour ensuite)
 * passait avant celui de « Mon profil » :
 * - profil avec un téléphone → c'est lui qui est renvoyé ;
 * - profil sans téléphone → le téléphone de l'inscription sert de repli.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  const etat = {
    profil: null as Record<string, unknown> | null,
    utilisateur: null as Record<string, unknown> | null,
    colonnes: [] as string[],
  }
  const chaine: Record<string, ReturnType<typeof vi.fn>> = {}
  // select() retient les colonnes demandées : single() ne rend qu'elles, comme PostgREST. Une colonne retirée du
  // select de la route (email, phone) disparaît donc de la réponse et le test le voit.
  chaine.select = vi.fn((colonnes: string) => {
    etat.colonnes = colonnes.split(',').map((c) => c.trim())
    return chaine
  })
  chaine.update = vi.fn(() => chaine)
  // eq() termine l'update (« best effort ») et prolonge le select vers single().
  chaine.eq = vi.fn(() => Object.assign(Promise.resolve({ data: null, error: null }), chaine))
  chaine.single = vi.fn(async () => {
    if (!etat.profil) return { data: null, error: { message: 'introuvable' } }
    const ligne = Object.fromEntries(etat.colonnes.filter((c) => c in etat.profil!).map((c) => [c, etat.profil![c]]))
    return { data: ligne, error: null }
  })
  const getUserById = vi.fn(async () => ({ data: { user: etat.utilisateur }, error: null }))
  return { etat, chaine, from: vi.fn(() => chaine), getUserById }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => ({ id: 'utilisateur-de-test' })) }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => new Response(null, { status: 429 })),
}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { from: h.from, auth: { admin: { getUserById: h.getUserById } } },
}))

const { GET } = await import('@/app/api/artisan-company/route')

const ADRESSE_CONNEXION = 'connexion@exemple.fr'
const EMAIL_INSCRIPTION = 'inscription@exemple.fr'
const EMAIL_PROFESSIONNEL = 'contact@entreprise-exemple.fr'
const TELEPHONE_INSCRIPTION = '01 00 00 00 02'
const TELEPHONE_PROFIL = '01 00 00 00 01'
const SIRET = '12345678900011'

/** Profil déjà complet (forme juridique et adresse connues) : la route répond depuis la base. */
const profilComplet = (email: unknown, phone: unknown = '') => ({
  id: 'profil-de-test', user_id: 'utilisateur-de-test', company_name: 'Entreprise Exemple', siret: SIRET, siren: '',
  legal_form: 'SARL', naf_code: '', naf_label: '', company_address: '1 rue de l’Exemple 00000 Exempleville',
  company_city: 'Exempleville', company_postal_code: '00000', phone, email,
})

/** Profil sans forme juridique : la route complète par l'API Recherche d'entreprises. */
const profilACompleter = (email: unknown, phone: unknown = '') => ({
  ...profilComplet(email, phone), legal_form: null, company_address: null,
})

async function appeler() {
  const reponse = await GET(new NextRequest('http://localhost:3000/api/artisan-company?artisan_id=profil-de-test', {
    headers: { Authorization: 'Bearer jeton' },
  }))
  expect(reponse.status).toBe(200)
  return (await reponse.json()) as { source?: string; company: Record<string, unknown> }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.etat.utilisateur = {
    id: 'utilisateur-de-test',
    email: ADRESSE_CONNEXION,
    user_metadata: { email: EMAIL_INSCRIPTION, phone: TELEPHONE_INSCRIPTION },
  }
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    results: [{
      siren: '123456789', nom_complet: 'ENTREPRISE EXEMPLE', nature_juridique: '5499', etat_administratif: 'A',
      activite_principale: '43.22A',
      siege: { siret: SIRET, adresse: '1 RUE DE L EXEMPLE 00000 EXEMPLEVILLE', code_postal: '00000', libelle_commune: 'EXEMPLEVILLE' },
    }],
  }), { status: 200, headers: { 'content-type': 'application/json' } })))
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('GET /api/artisan-company : e-mail du profil avant l’adresse de connexion', () => {
  it('profil complet avec e-mail professionnel : c’est lui qui est renvoyé', async () => {
    h.etat.profil = profilComplet(EMAIL_PROFESSIONNEL)
    const { source, company } = await appeler()

    expect(source).toBe('database')
    expect(company.email).toBe(EMAIL_PROFESSIONNEL)
  })

  it.each([['null', null], ['vide', '']])('profil complet, e-mail %s : repli sur l’adresse de connexion', async (_cas, email) => {
    h.etat.profil = profilComplet(email)
    const { company } = await appeler()

    expect(company.email).toBe(ADRESSE_CONNEXION)
  })

  it('profil complété par l’API Recherche d’entreprises : e-mail professionnel, ni celui d’inscription ni celui de connexion', async () => {
    h.etat.profil = profilACompleter(EMAIL_PROFESSIONNEL)
    const { source, company } = await appeler()

    expect(source).toBe('api_gouv')
    expect(company.email).toBe(EMAIL_PROFESSIONNEL)
  })

  it('profil complété par l’API Recherche d’entreprises, sans e-mail : repli sur l’adresse de connexion', async () => {
    h.etat.profil = profilACompleter(null)
    const { source, company } = await appeler()

    expect(source).toBe('api_gouv')
    expect(company.email).toBe(ADRESSE_CONNEXION)
  })
})

describe('GET /api/artisan-company : téléphone du profil avant celui de l’inscription', () => {
  it('profil complet avec téléphone : c’est lui qui est renvoyé, pas celui de l’inscription', async () => {
    h.etat.profil = profilComplet(EMAIL_PROFESSIONNEL, TELEPHONE_PROFIL)
    const { source, company } = await appeler()

    expect(source).toBe('database')
    expect(company.phone).toBe(TELEPHONE_PROFIL)
  })

  it.each([['null', null], ['vide', '']])('profil complet, téléphone %s : repli sur celui de l’inscription', async (_cas, phone) => {
    h.etat.profil = profilComplet(EMAIL_PROFESSIONNEL, phone)
    const { company } = await appeler()

    expect(company.phone).toBe(TELEPHONE_INSCRIPTION)
  })

  it('profil complété par l’API Recherche d’entreprises : téléphone du profil, avec repli sur celui de l’inscription', async () => {
    h.etat.profil = profilACompleter(EMAIL_PROFESSIONNEL, TELEPHONE_PROFIL)
    expect((await appeler()).company.phone).toBe(TELEPHONE_PROFIL)

    h.etat.profil = profilACompleter(EMAIL_PROFESSIONNEL, null)
    expect((await appeler()).company.phone).toBe(TELEPHONE_INSCRIPTION)
  })
})
