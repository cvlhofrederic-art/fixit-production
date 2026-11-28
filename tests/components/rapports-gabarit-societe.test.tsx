// tests/components/rapports-gabarit-societe.test.tsx — écran Rapports : le bouton de téléchargement passe au
// générateur le gabarit de relatório de la société (fiche Vitfix : « vitfix-relatorio »), pour le gérant comme pour un
// salarié invité (fiche de sa société) ; toute autre fiche et tout artisan gardent le PDF du module (règle n° 1).
// Et les photos liées partent avec le rapport même quand l'écran ne les avait pas encore lues : avant, l'état du rendu
// restait vide au moment de l'appel et le PDF sortait sans elles.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Artisan } from '@/lib/types'
import { VITFIX_SOCIETE_PROFIL_ID } from '@/lib/pdf/modeles-societes'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: () => Promise.resolve({ data: null, error: null }),
      upsert: () => Promise.resolve({ data: null, error: null }),
      delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    }),
    auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })) },
  },
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/i18n/context', () => ({ useLocale: () => 'pt', useTranslation: () => ({ t: (cle: string) => cle }) }))
vi.mock('@/lib/rapport-pdf', () => ({ generateRapportPDF: vi.fn(async () => {}) }))
vi.mock('@/components/dashboard/rapports/RapportPDFPreview', () => ({ default: () => null }))
vi.mock('next/image', () => ({ default: () => null }))

import { generateRapportPDF } from '@/lib/rapport-pdf'
import RapportsSection from '@/components/dashboard/RapportsSection'

const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } })
const PHOTOS = [
  { id: 'photo-1', url: 'https://example.test/1.jpg', taken_at: '2026-11-25T10:00:00Z' },
  { id: 'photo-2', url: 'https://example.test/2.jpg', taken_at: '2026-11-25T11:00:00Z' },
]
const RAPPORT = {
  id: 'rap_1795000000000', rapportNumber: 'RAP-2026-001', clientName: 'Cliente Exemplo', interventionDate: '2026-11-25',
  motif: 'Infiltração', travaux: [], materiaux: [], status: 'termine', linkedPhotoIds: ['photo-2'],
}

beforeEach(() => {
  localStorage.clear()
  vi.mocked(generateRapportPDF).mockClear()
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const adresse = String(url)
    if (adresse.startsWith('/api/artisan-photos')) return json({ data: PHOTOS })
    if (adresse.startsWith('/api/btp')) return json({ rapports: [] })
    if (adresse.startsWith('/api/artisan-company')) return json({ company: {} })
    return json({ data: [] })
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** Écran Rapports d'un compte, un rapport sur l'appareil ; clic sur « Descarregar ». */
async function telecharger(artisan: Artisan, orgRole: string) {
  localStorage.setItem(`fixit_rapports_${artisan.id}`, JSON.stringify([RAPPORT]))
  render(<RapportsSection artisan={artisan} bookings={[]} services={[]} orgRole={orgRole} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Descarregar' }))
  await waitFor(() => expect(generateRapportPDF).toHaveBeenCalledTimes(1))
  return vi.mocked(generateRapportPDF).mock.calls[0]
}

describe('Rapports : gabarit de relatório de la société', () => {
  it('gérant de la société Vitfix : gabarit « vitfix-relatorio », photos lues et transmises', async () => {
    const [rapport, photos, locale, orgRole, modele] = await telecharger({ id: VITFIX_SOCIETE_PROFIL_ID } as unknown as Artisan, 'pro_societe')
    expect(rapport).toMatchObject({ rapportNumber: 'RAP-2026-001', linkedPhotoIds: ['photo-2'] })
    expect(photos.map((p) => p.id)).toEqual(['photo-1', 'photo-2'])
    expect(locale).toBe('pt-PT')
    expect(orgRole).toBe('pro_societe')
    expect(modele).toBe('vitfix-relatorio')
  })

  it('salarié invité de la société Vitfix : gabarit de sa société', async () => {
    const salarie = { id: 'compte-salarie', fiche_societe_id: VITFIX_SOCIETE_PROFIL_ID } as unknown as Artisan
    const [, , , , modele] = await telecharger(salarie, 'pro_societe')
    expect(modele).toBe('vitfix-relatorio')
  })

  it('autre société BTP : PDF du module', async () => {
    const [, , , , modele] = await telecharger({ id: 'fiche-autre-societe' } as unknown as Artisan, 'pro_societe')
    expect(modele).toBeUndefined()
  })

  it('artisan (même fiche) : PDF du module, jamais le gabarit d’une société BTP', async () => {
    const [, photos, , , modele] = await telecharger({ id: VITFIX_SOCIETE_PROFIL_ID } as unknown as Artisan, 'artisan')
    expect(modele).toBeUndefined()
    expect(photos.map((p) => p.id)).toEqual(['photo-1', 'photo-2'])
  })

  it('numéro d’un nouveau rapport : série RT pour la société Vitfix, RAP inchangée ailleurs', async () => {
    // Horloge figée : le numéro porte l'année en cours.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-15T10:00:00Z'))
    try {
      const existants = [
        { ...RAPPORT, id: 'rap_1', rapportNumber: 'RAP-2026-007' },
        { ...RAPPORT, id: 'rap_2', rapportNumber: 'RT-2026-004' },
        { ...RAPPORT, id: 'rap_3', rapportNumber: 'RT-2025-019' },
      ]
      const numeroDuNouveau = async (artisan: Artisan, orgRole: string) => {
        localStorage.setItem(`fixit_rapports_${artisan.id}`, JSON.stringify(existants))
        const { container, unmount } = render(<RapportsSection artisan={artisan} bookings={[]} services={[]} orgRole={orgRole} />)
        fireEvent.click(await screen.findByRole('button', { name: '+ Novo relatório' }))
        const numero = container.querySelector('.v22-ref')?.textContent
        unmount()
        return numero
      }
      // Vitfix : la série RT a son propre compteur, par année (les anciens RAP restent tels quels).
      expect(await numeroDuNouveau({ id: VITFIX_SOCIETE_PROFIL_ID } as unknown as Artisan, 'pro_societe')).toBe('RT-2026-005')
      expect(await numeroDuNouveau({ id: 'compte-salarie', fiche_societe_id: VITFIX_SOCIETE_PROFIL_ID } as unknown as Artisan, 'pro_societe')).toBe('RT-2026-005')
      // Autre société BTP et artisan : série RAP, comme avant.
      expect(await numeroDuNouveau({ id: 'fiche-autre-societe' } as unknown as Artisan, 'pro_societe')).toBe('RAP-2026-008')
      expect(await numeroDuNouveau({ id: VITFIX_SOCIETE_PROFIL_ID } as unknown as Artisan, 'artisan')).toBe('RAP-2026-008')
    } finally {
      vi.useRealTimers()
    }
  })

  it('courriel au client : « relatório técnico » pour la société Vitfix, « relatório de obra » pour une autre société', async () => {
    const ouvrir = vi.spyOn(window, 'open').mockImplementation(() => null)
    const corpsDuCourriel = async (artisan: Artisan) => {
      localStorage.setItem(`fixit_rapports_${artisan.id}`, JSON.stringify([{ ...RAPPORT, clientEmail: 'cliente@example.pt' }]))
      const { unmount } = render(<RapportsSection artisan={artisan} bookings={[]} services={[]} orgRole="pro_societe" />)
      fireEvent.click(await screen.findByRole('button', { name: 'Email' }))
      unmount()
      return decodeURIComponent(String(ouvrir.mock.calls.at(-1)?.[0]))
    }
    expect(await corpsDuCourriel({ id: VITFIX_SOCIETE_PROFIL_ID } as unknown as Artisan)).toContain('Segue em anexo o relatório técnico RAP-2026-001')
    expect(await corpsDuCourriel({ id: 'fiche-autre-societe' } as unknown as Artisan)).toContain('Segue em anexo o relatório de obra RAP-2026-001')
  })

  it('rapport sans photo liée : les photos ne sont pas lues pour rien', async () => {
    localStorage.setItem(`fixit_rapports_${VITFIX_SOCIETE_PROFIL_ID}`, JSON.stringify([{ ...RAPPORT, linkedPhotoIds: [] }]))
    render(<RapportsSection artisan={{ id: VITFIX_SOCIETE_PROFIL_ID } as unknown as Artisan} bookings={[]} services={[]} orgRole="pro_societe" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Descarregar' }))
    await waitFor(() => expect(generateRapportPDF).toHaveBeenCalledTimes(1))
    expect(vi.mocked(generateRapportPDF).mock.calls[0][1]).toEqual([])
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).startsWith('/api/artisan-photos'))).toBe(false)
  })
})
