// tests/api/companies-search.test.ts
//
// GET /api/companies/search — recherche publique par métier :
//   - specialty obligatoire (400), slug inconnu (404), métier sans profil (200, liste vide) ;
//   - profils lus avec select('*') : une colonne absente du schéma de prod (first_name, last_name,
//     naf_label…) ne fait plus échouer la recherche (500 « Search failed » avant le correctif) ;
//   - seuls les champs publics sortent (réponse publique et mise en cache), colonne absente = null ;
//   - KYC approuvé seulement, verified_source lu dans profile_specialties, filtres verified_source et city.
// Supabase en mémoire.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { appelsDe, clientMemoire, nouvelleBase, type BaseMemoire } from './syndic-supabase-memoire'

const h = vi.hoisted(() => ({ base: null as unknown as BaseMemoire }))

vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (t: string) => clientMemoire(h.base).from(t) } }))

const { GET } = await import('@/app/api/companies/search/route')

const chercher = (query: string) => GET(new NextRequest(`https://vitfix.io/api/companies/search${query}`))

const CHAMPS_PUBLICS = [
  'id', 'user_id', 'company_name', 'first_name', 'last_name', 'email', 'phone',
  'company_city', 'naf_code', 'naf_label', 'verified', 'kyc_status', 'categories',
  'verified_source', 'profile_type',
]

// Ligne telle que la prod la renvoie avec select('*') : pas de first_name / last_name / naf_label,
// mais des colonnes qui ne doivent pas sortir de la réponse publique.
const profil = (id: string, extra: Record<string, unknown> = {}) => ({
  id: `art-${id}`, user_id: `user-${id}`, company_name: `Entreprise ${id}`, email: `${id}@exemple.fr`,
  phone: '0600000000', company_city: 'Marseille', naf_code: '4322A', verified: true, kyc_status: 'approved',
  categories: ['plomberie'], siret: '12345678900011', bio: 'Bio interne', kyc_market: 'fr_artisan',
  company_address: '1 rue du Port', ...extra,
})

beforeEach(() => {
  h.base = nouvelleBase()
  h.base.colonnesAbsentes = { profiles_artisan: ['first_name', 'last_name', 'naf_label'] }
  h.base.lignes.specialties = [
    { id: 'spec-plomberie', slug: 'plomberie', label_fr: 'Plomberie' },
    { id: 'spec-piscine', slug: 'piscine', label_fr: 'Piscine' },
  ]
  h.base.lignes.profile_specialties = [
    { specialty_id: 'spec-plomberie', user_id: 'user-1', verified_source: 'kbis' },
    { specialty_id: 'spec-plomberie', user_id: 'user-2', verified_source: 'self_declared' },
    { specialty_id: 'spec-plomberie', user_id: 'user-3', verified_source: 'kbis' },
  ]
  h.base.lignes.profiles_artisan = [
    profil('1'),
    profil('2', { company_city: 'Aix-en-Provence', verified: false }),
    profil('3', { kyc_status: 'pending' }),
  ]
})

describe('GET /api/companies/search', () => {
  it('400 sans paramètre specialty', async () => {
    const res = await chercher('')
    expect(res.status).toBe(400)
  })

  it('404 pour un métier inconnu', async () => {
    const res = await chercher('?specialty=inconnu')
    expect(res.status).toBe(404)
  })

  it('200 et liste vide pour un métier sans profil', async () => {
    const res = await chercher('?specialty=piscine')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ results: [], specialty: 'Piscine', total: 0 })
    expect(appelsDe(h.base, 'profiles_artisan')).toHaveLength(0)
  })

  it('schéma de prod sans first_name / last_name / naf_label : 200, profils lus avec select(*)', async () => {
    const res = await chercher('?specialty=plomberie')
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toContain('public')
    const json = await res.json()
    expect(json.specialty).toBe('Plomberie')
    expect(json.total).toBe(2)
    expect(json.results.map((r: { id: string }) => r.id)).toEqual(['art-1', 'art-2'])
    expect(appelsDe(h.base, 'profiles_artisan', 'select')[0].colonnes).toBe('*')
  })

  it('ne renvoie que les champs publics, une colonne absente vaut null', async () => {
    const json = await (await chercher('?specialty=plomberie')).json()
    const premier = json.results[0]
    expect(Object.keys(premier).sort()).toEqual([...CHAMPS_PUBLICS].sort())
    expect(premier).toMatchObject({
      id: 'art-1', company_name: 'Entreprise 1', naf_code: '4322A',
      first_name: null, last_name: null, naf_label: null,
      verified_source: 'kbis', profile_type: 'artisan',
    })
    expect(premier).not.toHaveProperty('siret')
    expect(premier).not.toHaveProperty('bio')
    expect(premier).not.toHaveProperty('company_address')
  })

  // email (celui de la connexion, saisi à l'inscription) et phone sont dans le select depuis la création de
  // la route (13dd04a2, 01/04/2026). La prod répond 500 (constaté le 23/10) : elle ne les sert donc pas
  // aujourd'hui, et ce correctif les rendra publics. Les garder ou les retirer revient à Frédéric : ce test
  // décrit le choix actuel, il ne le valide pas.
  it('renvoie email et phone des profils (exposition publique à trancher par Frédéric)', async () => {
    const json = await (await chercher('?specialty=plomberie')).json()
    expect(json.results[0]).toMatchObject({ email: '1@exemple.fr', phone: '0600000000' })
  })

  it('renvoie first_name, last_name et naf_label quand les colonnes existent', async () => {
    h.base.colonnesAbsentes = {}
    h.base.lignes.profiles_artisan = [profil('1', { first_name: 'Jean', last_name: 'Dupont', naf_label: 'Plomberie' })]
    const json = await (await chercher('?specialty=plomberie')).json()
    expect(json.results[0]).toMatchObject({ first_name: 'Jean', last_name: 'Dupont', naf_label: 'Plomberie' })
  })

  it('filtre par verified_source et par ville', async () => {
    const parSource = await (await chercher('?specialty=plomberie&verified_source=self_declared')).json()
    expect(parSource.results.map((r: { id: string }) => r.id)).toEqual(['art-2'])
    const parVille = await (await chercher('?specialty=plomberie&city=aix')).json()
    expect(parVille.results.map((r: { id: string }) => r.id)).toEqual(['art-2'])
  })

  it('500 « Search failed » si la lecture des profils échoue', async () => {
    h.base.erreurs['profiles_artisan.select'] = { message: 'boom' }
    const res = await chercher('?specialty=plomberie')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Search failed' })
  })
})
