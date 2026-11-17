// Validation du vrai formulaire BTP (components/DevisFactureFormBTP.tsx) quand le numéro ne peut pas être tiré du
// serveur (constats documents-cycle-1, stockage-local-miroir-9 et documents-cycle-14 de l'audit des fondations BTP
// du 11/11/2026).
//
// - Serveur muet (route /api/doc-number et fonction next_doc_number en échec) : avant, le formulaire attribuait en
//   silence un numéro tiré d'un compteur du navigateur, que le serveur ignore (deux factures pouvaient porter le même
//   numéro). Désormais la facture reste un brouillon, sans numéro, et un message le dit.
// - Stockage du navigateur plein : avant, le numéro était consommé sur le serveur, puis l'écriture échouait (trou dans
//   la série). Désormais rien n'est demandé au serveur tant que le navigateur ne peut pas enregistrer la facture.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import type { ArtisanBasic } from '@/lib/devis-types'

const simu = vi.hoisted(() => ({ rpc: vi.fn(), locale: 'fr' as 'fr' | 'pt' }))

// Langue de l'interface, réglée par test (le formulaire traduit ses textes par tx depuis #735).
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (cle: string) => cle, locale: simu.locale }),
  useLocale: () => simu.locale,
}))
vi.mock('@/lib/supabase', async () => {
  const base = (await import('../helpers/mocks-formulaires-devis')).supabaseNavigateur()
  return {
    supabase: {
      ...base.supabase,
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'jeton-test', user: { id: 'uid-societe' } } } }) },
      rpc: simu.rpc,
    },
  }
})
vi.mock('@/lib/fetch-authentifie', async () => (await import('../helpers/mocks-formulaires-devis')).fetchAuthentifieVide())
vi.mock('sonner', async () => (await import('../helpers/mocks-formulaires-devis')).notifications())
vi.mock('@/lib/document-sync', async () => (await import('../helpers/mocks-formulaires-devis')).synchroMuette())
vi.mock('@/components/dashboard/btp/RentabiliteDevisModal', () => ({ default: () => null }))

import DevisFactureFormBTP from '@/components/DevisFactureFormBTP'
import { toast } from 'sonner'
import { syncDocumentSafe } from '@/lib/document-sync'
import { remplirLeStockage } from '../helpers/stockage-navigateur-plein'

// Année des numéros rendus par le serveur simulé (le formulaire les reprend tels quels : aucune lecture de l'horloge).
const ANNEE = 2026
const ARTISAN: ArtisanBasic = { id: 'art-btp-numero', user_id: 'uid-societe', company_name: 'BATIR TEST SAS', email: 'contact@batir.test' }
const CLE_DOCS = `fixit_documents_${ARTISAN.id}`
const CLE_BROUILLONS = `fixit_drafts_${ARTISAN.id}`

const BROUILLON = {
  id: '6f1c2a34-0000-4000-8000-00000000e001', docType: 'facture', docNumber: '', status: 'brouillon',
  docTitle: 'Ravalement', clientName: 'SCI Test', savedAt: '2026-11-13T10:00:00.000Z',
  lines: [{ id: 1, description: 'Ravalement de façade', qty: 1, unit: 'f', priceHT: 2000, tvaRate: 20, totalHT: 2000 }],
  materialLines: [], fraisLines: [], customTables: [], notes: '',
}

const lire = (cle: string) => JSON.parse(localStorage.getItem(cle) || '[]') as Array<Record<string, unknown>>
const appelsNumerotation = (f: ReturnType<typeof vi.fn>) => f.mock.calls.filter(([url]) => String(url).includes('/api/doc-number'))

/** Réponse de la route de numérotation ; les autres appels réseau du formulaire répondent une liste vide. */
function reseau(numerotation: () => Promise<Response>) {
  const f = vi.fn((url: unknown) => (String(url).includes('/api/doc-number') ? numerotation() : Promise.resolve(new Response('[]', { status: 200 }))))
  vi.stubGlobal('fetch', f)
  return f
}


const monter = (onBack = vi.fn()) => {
  render(<DevisFactureFormBTP artisan={ARTISAN} services={[]} bookings={[]} onBack={onBack} initialData={BROUILLON as never} />)
  return onBack
}

beforeEach(() => {
  simu.locale = 'fr'
  localStorage.clear()
  localStorage.setItem(CLE_BROUILLONS, JSON.stringify([BROUILLON]))
  vi.clearAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('formulaire BTP — validation sans numéro du serveur', () => {
  it('serveur muet : la facture reste un brouillon sans numéro et un message le dit', async () => {
    reseau(() => Promise.reject(new TypeError('Failed to fetch')))
    simu.rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
    const onBack = monter()

    fireEvent.click(screen.getByRole('button', { name: 'Valider et enregistrer' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/numéro.*serveur.*reste en brouillon/i)))
    // Aucune facture émise : pas de numéro tiré d'un compteur du navigateur.
    expect(lire(CLE_DOCS)).toEqual([])
    const [brouillon] = lire(CLE_BROUILLONS)
    expect(brouillon).toMatchObject({ id: BROUILLON.id, status: 'brouillon' })
    expect(brouillon.docNumber || '').toBe('')
    expect(vi.mocked(syncDocumentSafe).mock.calls.filter(([doc]) => doc.status === 'envoye')).toEqual([])
    expect(onBack).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalledWith('Facture validée')
  })

  it('stockage du navigateur plein : aucun numéro demandé au serveur, message propre au stockage', async () => {
    const f = reseau(() => Promise.resolve(new Response(JSON.stringify({ number: `FACT-${ANNEE}-041` }), { status: 200 })))
    simu.rpc.mockResolvedValue({ data: `FACT-${ANNEE}-041`, error: null })
    remplirLeStockage()
    const onBack = monter()

    fireEvent.click(screen.getByRole('button', { name: 'Valider et enregistrer' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/stockage du navigateur/i)))
    expect(appelsNumerotation(f)).toEqual([])
    expect(simu.rpc).not.toHaveBeenCalled()
    expect(lire(CLE_DOCS)).toEqual([])
    expect(onBack).not.toHaveBeenCalled()
  })

  it('serveur disponible : la facture est validée avec le numéro du serveur (inchangé)', async () => {
    const f = reseau(() => Promise.resolve(new Response(JSON.stringify({ number: `FACT-${ANNEE}-042` }), { status: 200 })))
    const onBack = monter()

    fireEvent.click(screen.getByRole('button', { name: 'Valider et enregistrer' }))

    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1))
    expect(appelsNumerotation(f)).toHaveLength(1)
    const [emise] = lire(CLE_DOCS)
    expect(emise).toMatchObject({ id: BROUILLON.id, docNumber: `FACT-${ANNEE}-042`, status: 'envoye' })
    expect(lire(CLE_BROUILLONS)).toEqual([])
    expect(toast.success).toHaveBeenCalledWith('Facture validée')
  })
})

// Sur /pt, le formulaire est en portugais (#735) : les messages détaillés de la validation, en français seulement,
// cèdent la place au message traduit du formulaire ; le comportement (brouillon gardé, aucun numéro) est le même.
describe('formulaire BTP en portugais — validation sans numéro du serveur', () => {
  const messagesEnFrancais = () => vi.mocked(toast.error).mock.calls.filter(([m]) => /serveur|navigateur|brouillon/i.test(String(m)))

  it('serveur muet : message en portugais, la facture reste un brouillon sans numéro', async () => {
    simu.locale = 'pt'
    reseau(() => Promise.reject(new TypeError('Failed to fetch')))
    simu.rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
    const onBack = monter()

    fireEvent.click(screen.getByRole('button', { name: 'Validar e guardar' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível validar a fatura'))
    expect(messagesEnFrancais()).toEqual([])
    expect(lire(CLE_DOCS)).toEqual([])
    expect(lire(CLE_BROUILLONS)[0]).toMatchObject({ id: BROUILLON.id, status: 'brouillon' })
    expect(onBack).not.toHaveBeenCalled()
  })

  it('stockage du navigateur plein : message en portugais, aucun numéro demandé au serveur', async () => {
    simu.locale = 'pt'
    const f = reseau(() => Promise.resolve(new Response(JSON.stringify({ number: `FACT-${ANNEE}-043` }), { status: 200 })))
    simu.rpc.mockResolvedValue({ data: `FACT-${ANNEE}-043`, error: null })
    remplirLeStockage()
    const onBack = monter()

    fireEvent.click(screen.getByRole('button', { name: 'Validar e guardar' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível validar a fatura'))
    expect(messagesEnFrancais()).toEqual([])
    expect(appelsNumerotation(f)).toEqual([])
    expect(simu.rpc).not.toHaveBeenCalled()
    expect(lire(CLE_DOCS)).toEqual([])
    expect(onBack).not.toHaveBeenCalled()
  })
})
