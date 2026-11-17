// Vrai formulaire artisan (components/DevisFactureForm.tsx) : coordonnées de l'émetteur d'un document rouvert.
// À l'ouverture, le formulaire reprend les coordonnées de GET /api/artisan-company, qui donne depuis le 17/11/2026
// celles de « Mon profil » d'abord. Un document déjà émis (numéro, statut autre que brouillon), rouvert pour être
// consulté ou régénéré, garde son e-mail et son téléphone : « ce qui a déjà été fait ne se touche pas ». Un
// brouillon, un duplicata, ou un document émis sans e-mail ni téléphone, reprennent les coordonnées du profil.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import type { ArtisanBasic } from '@/lib/devis-types'

vi.mock('@/lib/i18n/context', async () => (await import('../helpers/mocks-formulaires-devis')).traductions())
vi.mock('@/lib/supabase', async () => (await import('../helpers/mocks-formulaires-devis')).supabaseNavigateur())
vi.mock('@/lib/fetch-authentifie', async () => (await import('../helpers/mocks-formulaires-devis')).fetchAuthentifieVide())
vi.mock('sonner', async () => (await import('../helpers/mocks-formulaires-devis')).notifications())
vi.mock('@/lib/document-sync', async () => (await import('../helpers/mocks-formulaires-devis')).synchroMuette())
vi.mock('@/lib/pdf/devis-generator-v2', async () => (await import('../helpers/mocks-formulaires-devis')).generateurPdfV2Espion())
vi.mock('@/lib/pdf/pdfa3-wrap', async () => (await import('../helpers/mocks-formulaires-devis')).habillagePdfA3Neutre())

import DevisFactureForm from '@/components/DevisFactureForm'

const ARTISAN = {
  id: 'art-coordonnees', company_name: 'Plomberie Exemple EI', email: 'contact@plomberie-exemple.fr', phone: '01 00 00 00 05',
} as unknown as ArtisanBasic

// Réponse de /api/artisan-company : coordonnées actuelles du profil, et un nom qui prouve que la réponse a été lue.
const PROFIL = { name: 'Plomberie Exemple Renommée', email: 'nouveau@exemple.fr', phone: '01 00 00 00 04' }

const LIGNE = { id: 1, description: 'Remplacement chauffe-eau', qty: 1, unit: 'u', priceHT: 1000, tvaRate: 10, totalHT: 1000 }
// Devis déjà émis, avec les coordonnées qu'il portait à son émission.
const EMIS = {
  id: '6f1c2a34-0000-4000-8000-00000000d001', docType: 'devis', docNumber: 'DEV-2026-042', status: 'envoye',
  docTitle: 'Chauffe-eau', clientName: 'M. Client', tvaEnabled: true, lines: [LIGNE], materialLines: [], fraisAnnexes: [],
  acomptesEnabled: false, acomptes: [], companyEmail: 'ancien@exemple.fr', companyPhone: '01 00 00 00 03',
  savedAt: '2026-10-02T10:00:00.000Z',
}
const { docNumber: _numero, status: _statut, savedAt: _date, ...EMIS_SANS_NUMERO } = EMIS

const monter = (initialData: unknown) => render(
  <DevisFactureForm artisan={ARTISAN} services={[]} bookings={[]} onBack={vi.fn()} initialData={initialData as never} />,
)
/** Attend que la réponse de /api/artisan-company ait été appliquée (le nom du profil apparaît). */
const reponseAppliquee = () => waitFor(() => expect(screen.getByDisplayValue(PROFIL.name)).toBeTruthy(), { timeout: 5000 })

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (entree) => {
    const url = typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url
    if (url.includes('/api/artisan-company')) {
      return new Response(JSON.stringify({ verified: true, source: 'database', company: PROFIL }), { status: 200 })
    }
    return new Response(JSON.stringify({ number: 'DEV-2026-001' }), { status: 200 })
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('formulaire artisan — coordonnées de l’émetteur d’un document rouvert', () => {
  it('document déjà émis : garde son e-mail et son téléphone', async () => {
    monter(EMIS)
    await reponseAppliquee()

    expect(screen.getByDisplayValue('ancien@exemple.fr')).toBeTruthy()
    expect(screen.getByDisplayValue('01 00 00 00 03')).toBeTruthy()
    expect(screen.queryByDisplayValue(PROFIL.email)).toBeNull()
    expect(screen.queryByDisplayValue(PROFIL.phone)).toBeNull()
  })

  it('document déjà émis sans e-mail ni téléphone : le profil remplit les champs vides', async () => {
    monter({ ...EMIS, companyEmail: '', companyPhone: '' })
    await reponseAppliquee()

    expect(screen.getByDisplayValue(PROFIL.email)).toBeTruthy()
    expect(screen.getByDisplayValue(PROFIL.phone)).toBeTruthy()
  })

  it.each([
    ['brouillon', { ...EMIS, docNumber: '', status: 'brouillon' }],
    ['duplicata', { ...EMIS_SANS_NUMERO, id: '1763380800000', isDuplicate: true }],
  ])('%s : reprend les coordonnées actuelles du profil', async (_cas, document) => {
    monter(document)
    await reponseAppliquee()

    expect(screen.getByDisplayValue(PROFIL.email)).toBeTruthy()
    expect(screen.getByDisplayValue(PROFIL.phone)).toBeTruthy()
  })
})
