// Conformité (WalletConformiteSection) et Références chantiers (CarnetDeVisiteSection), société BTP.
// Chaque document gardait, dans le stockage du navigateur, le lien signé rendu au dépôt : au bout de 7 jours,
// « Voir » ouvrait une page d'erreur du stockage, « Envoyer le dossier » transmettait des liens morts et les
// miniatures des références cassaient, alors que les fichiers existaient toujours.
// Pour une société BTP, la page demande désormais un lien frais pour chaque document (POST /api/stockage/liens) et
// s'en sert pour Voir, Envoyer et les miniatures. Le stockage du navigateur n'est pas réécrit.
// Côté artisan, rien ne change (règle artisan / BTP) : même défaut, signalé à Frédéric.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Artisan } from '@/lib/types'

const PROJET = 'https://projet-test.supabase.co'
const FICHE_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const ancienLien = (chemin: string) => `${PROJET}/storage/v1/object/sign/artisan-documents/${chemin}?token=expire`
const lienFrais = (chemin: string) => `${PROJET}/storage/v1/object/sign/artisan-documents/${chemin}?token=frais`
const RC_PRO = `wallet/${FICHE_ID}/rc_pro/0f8fad5b-d9cb-469f-a165-70867728950e.pdf`
const REFERENCE = `portfolio/${FICHE_ID}/1b4e28ba-2fa1-11d2-883f-0016d3cca427.jpg`

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (cle: string) => cle, locale: 'fr' }),
  useLocale: () => 'fr',
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'jeton' } } }) } },
}))
vi.mock('@/components/dashboard/useThemeVars', () => ({ useThemeVars: () => ({}) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() } }))
// next/image réduit à une balise img : seule l'adresse affichée compte ici.
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => React.createElement('img', { src, alt }),
}))

import WalletConformiteSection from '@/components/dashboard/WalletConformiteSection'
import CarnetDeVisiteSection from '@/components/dashboard/CarnetDeVisiteSection'
import { supabase } from '@/lib/supabase'

const artisan = { id: FICHE_ID, company_name: 'BATIMENT SUD EXEMPLE', categories: [] } as unknown as Artisan
const appelsLiens = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) => url === '/api/stockage/liens')
const lectureSession = supabase.auth.getSession as unknown as ReturnType<typeof vi.fn>

/**
 * Laisse aboutir toute demande de liens en attente (session, appel de la route, réponse, nouvel affichage) : un
 * contrôle « aucun lien demandé » fait juste après l'affichage passerait même si une demande était en route.
 */
const laisserAboutirLesDemandes = () => act(async () => {
  await new Promise((fin) => setTimeout(fin, 0))
})

beforeEach(() => {
  lectureSession.mockClear()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', PROJET)
  // Stockage simulé de jsdom, propre à ce test : chaque cas pose ses propres clés.
  localStorage.removeItem(`fixit_wallet_${FICHE_ID}`)
  localStorage.removeItem(`fixit_portfolio_${FICHE_ID}`)
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/stockage/liens') {
      const { valeurs } = JSON.parse(String(init?.body)) as { valeurs: string[] }
      const chemins = valeurs.map((v) => v.replace(`${PROJET}/storage/v1/object/sign/artisan-documents/`, '').replace(/\?.*$/, ''))
      return new Response(JSON.stringify({ liens: chemins.map(lienFrais) }))
    }
    return new Response('{}')
  }))
  vi.spyOn(window, 'open').mockImplementation(() => null)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('Conformité — société BTP', () => {
  beforeEach(() => {
    localStorage.setItem(`fixit_wallet_${FICHE_ID}`, JSON.stringify({
      rc_pro: { url: ancienLien(RC_PRO), uploadedAt: '2026-11-01T10:00:00.000Z', name: 'rc-pro.pdf' },
    }))
  })

  it('« Voir » ouvre un lien frais créé à partir du chemin enregistré', async () => {
    render(<WalletConformiteSection artisan={artisan} orgRole="pro_societe" />)
    // Lien frais demandé, puis réponse appliquée à l'écran ; un seul clic ensuite (pas d'action répétée dans waitFor).
    await waitFor(() => expect(appelsLiens()).toHaveLength(1))
    await laisserAboutirLesDemandes()

    fireEvent.click(screen.getByTitle('Voir'))
    expect(window.open).toHaveBeenLastCalledWith(lienFrais(RC_PRO), '_blank', 'noopener,noreferrer')
    expect(window.open).toHaveBeenCalledTimes(1)
    expect(appelsLiens()).toHaveLength(1)
    expect(JSON.parse(String(appelsLiens()[0][1]?.body))).toEqual({ valeurs: [ancienLien(RC_PRO)] })
  })

  it('« Envoyer le dossier » transmet le lien frais, pas l’ancien', async () => {
    render(<WalletConformiteSection artisan={artisan} orgRole="pro_societe" />)
    await waitFor(() => expect(appelsLiens()).toHaveLength(1))
    await laisserAboutirLesDemandes()

    fireEvent.click(screen.getByText('📧 proDash.wallet.envoyerLeDossier'))
    const mailto = decodeURIComponent(String((window.open as unknown as ReturnType<typeof vi.fn>).mock.lastCall?.[0]))
    expect(mailto).toContain(lienFrais(RC_PRO))
    expect(mailto).not.toContain(ancienLien(RC_PRO))
  })

  it('le stockage du navigateur garde la valeur enregistrée (rien n’est réécrit)', async () => {
    render(<WalletConformiteSection artisan={artisan} orgRole="pro_societe" />)
    await waitFor(() => expect(appelsLiens()).toHaveLength(1))
    expect(JSON.parse(localStorage.getItem(`fixit_wallet_${FICHE_ID}`) || '{}').rc_pro.url).toBe(ancienLien(RC_PRO))
  })

  it('artisan : inchangé, « Voir » ouvre la valeur enregistrée, aucun lien demandé', async () => {
    render(<WalletConformiteSection artisan={artisan} orgRole="artisan" />)
    await laisserAboutirLesDemandes()

    fireEvent.click(screen.getByTitle('Voir'))
    expect(window.open).toHaveBeenLastCalledWith(ancienLien(RC_PRO), '_blank', 'noopener,noreferrer')
    expect(lectureSession).not.toHaveBeenCalled()
    expect(appelsLiens()).toHaveLength(0)
  })
})

describe('Références chantiers — société BTP', () => {
  beforeEach(() => {
    localStorage.setItem(`fixit_portfolio_${FICHE_ID}`, JSON.stringify([
      { id: '1', url: ancienLien(REFERENCE), title: 'Immeuble R+3', category: 'Neuf', uploadedAt: '2026-11-01T10:00:00.000Z' },
    ]))
  })

  it('miniature et agrandissement affichent un lien frais', async () => {
    const { container } = render(<CarnetDeVisiteSection artisan={artisan} orgRole="pro_societe" />)
    await waitFor(() => expect(appelsLiens()).toHaveLength(1))

    const miniature = () => container.querySelector('.v5-gal-thumb') as HTMLElement
    await waitFor(() => expect(miniature().style.backgroundImage).toContain(lienFrais(REFERENCE)))
    fireEvent.click(screen.getByText('Immeuble R+3'))
    expect((screen.getByAltText('Immeuble R+3') as HTMLImageElement).getAttribute('src')).toBe(lienFrais(REFERENCE))
  })

  it('artisan : inchangé, la miniature garde la valeur enregistrée, aucun lien demandé', async () => {
    const { container } = render(<CarnetDeVisiteSection artisan={artisan} orgRole="artisan" />)
    await laisserAboutirLesDemandes()

    expect((container.querySelector('.v5-gal-thumb') as HTMLElement).style.backgroundImage).toContain(ancienLien(REFERENCE))
    fireEvent.click(screen.getByText('Immeuble R+3'))
    expect((screen.getByAltText('Immeuble R+3') as HTMLImageElement).getAttribute('src')).toBe(ancienLien(REFERENCE))
    expect(lectureSession).not.toHaveBeenCalled()
    expect(appelsLiens()).toHaveLength(0)
  })
})
