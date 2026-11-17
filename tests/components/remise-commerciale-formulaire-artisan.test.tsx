// Remise commerciale et escompte dans le vrai formulaire artisan (components/DevisFactureForm.tsx) :
//   - un ancien document rouvert garde son PDF : la sauvegarde automatique ne pose pas la marque
//     d'escompte, même avec un escompte saisi (lib/escompte-pdf.ts) ;
//   - un document nouveau imprime l'escompte saisi ;
//   - en portugais (hors lot), la remise d'un document existant n'est pas effacée à l'enregistrement.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import type { ArtisanBasic } from '@/lib/devis-types'

const h = vi.hoisted(() => ({ locale: 'fr' as 'fr' | 'pt' }))

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: h.locale }),
  useLocale: () => h.locale,
}))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    from: () => {
      const chaine: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'order', 'limit', 'in']) chaine[m] = () => chaine
      chaine.single = async () => ({ data: null, error: null })
      chaine.maybeSingle = async () => ({ data: null, error: null })
      chaine.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok)
      return chaine
    },
  },
}))
vi.mock('@/lib/fetch-authentifie', () => ({ fetchAuthentifie: vi.fn().mockResolvedValue(new Response('[]', { status: 200 })) }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), warning: vi.fn(), loading: vi.fn(() => 'tid'), dismiss: vi.fn() }) }))
vi.mock('@/lib/document-sync', () => ({ syncDocumentSafe: vi.fn() }))

import DevisFactureForm from '@/components/DevisFactureForm'

const ARTISAN = { id: 'art-artisan-remise', company_name: 'Plomberie Test EI', email: 'contact@plomberie.test' } as unknown as ArtisanBasic
const CLE_BROUILLONS = `fixit_drafts_${ARTISAN.id}`

// Ancien brouillon (enregistré avant la correction de l'escompte) : escompte saisi, jamais imprimé.
const ANCIEN = {
  id: '6f1c2a34-0000-4000-8000-00000000a001', docType: 'devis', docNumber: '', status: 'brouillon',
  docTitle: 'Chauffe-eau', clientName: 'M. Test', savedAt: '2026-10-02T10:00:00.000Z',
  discount: '2 % si paiement sous 8 jours',
  lines: [{ id: 1, description: 'Remplacement chauffe-eau', qty: 1, unit: 'u', priceHT: 1000, tvaRate: 0, totalHT: 1000 }],
}

const brouillons = () => JSON.parse(localStorage.getItem(CLE_BROUILLONS) || '[]') as Array<Record<string, unknown>>
const monter = (initialData: unknown) => render(
  <DevisFactureForm artisan={ARTISAN} services={[]} bookings={[]} onBack={vi.fn()} initialData={initialData as never} />,
)

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  h.locale = 'fr'
})

describe('formulaire artisan — escompte et remise', () => {
  it('ancien document rouvert : la sauvegarde automatique ne pose pas la marque d escompte', async () => {
    monter(ANCIEN)
    await waitFor(() => expect(brouillons()).toHaveLength(1), { timeout: 5000 })
    expect(brouillons()[0].discount).toBe('2 % si paiement sous 8 jours')
    expect(brouillons()[0].escompteSurPdf).toBeUndefined()
  })

  it('l escompte modifié par l artisan est désormais imprimé (marque posée)', async () => {
    // Le champ escompte fait partie des conditions de paiement d'une facture.
    monter({ ...ANCIEN, docType: 'facture' })
    fireEvent.change(screen.getByPlaceholderText('devis.discountPlaceholder'), { target: { value: '3 % si paiement comptant' } })
    await waitFor(() => expect(brouillons()[0]?.escompteSurPdf).toBe(true), { timeout: 5000 })
    expect(brouillons()[0].discount).toBe('3 % si paiement comptant')
  })

  it('portugais : la remise d un document existant est conservée à l enregistrement', async () => {
    h.locale = 'pt'
    monter({ ...ANCIEN, remiseGlobale: { type: 'pourcentage', valeur: 10 }, escompteSurPdf: true })
    expect(screen.queryByLabelText('Unité de la remise commerciale')).toBeNull()
    await waitFor(() => expect(brouillons()).toHaveLength(1), { timeout: 5000 })
    expect(brouillons()[0].remiseGlobale).toEqual({ type: 'pourcentage', valeur: 10 })
    expect(brouillons()[0].escompteSurPdf).toBe(true)
  })
})
