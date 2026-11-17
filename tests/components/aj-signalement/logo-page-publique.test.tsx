// tests/components/aj-signalement/logo-page-publique.test.tsx
//
// Logo d'un cabinet client sur la page publique ouverte par le QR code (vitfix.io/<identifiant>/signalement/<jeton>/ ;
// demande de Hugo du 13/11/2026, brouillon soumis à Frédéric) :
//   - le logo dans un bandeau BLANC au-dessus de l'en-tête bleu nuit (un logo sombre y reste lisible), aligné sur la
//     colonne de la page ; l'en-tête bleu nuit, le formulaire et le pied sont ceux d'avant ; texte alternatif = nom du
//     cabinet ; aucune adresse d'origine transmise (le chemin de la page porte le jeton du QR code) ;
//   - page serveur : logo lu par l'id du cabinet de la copropriété (lireLogoPageCabinetQr), APRÈS les contrôles du chemin
//     (jamais pour une page refusée), en même temps que l'information à la collecte ; aucun logo (cabinet sans logo,
//     migration 20261114 absente, erreur) → propriétés d'avant, sans clé « logo » ; l'ancienne page /fr|pt/signalement/
//     (copropriété sans cabinet) ne le lit jamais.
// Le DOM sans logo est figé par tests/components/aj-signalement/logo-espaces-sans-logo.test.tsx.
// Lectures serveur simulées ; données fictives.

import React from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const simul = vi.hoisted(() => ({
  lire: vi.fn(),
  information: vi.fn(),
  lireLogoPage: vi.fn(),
  proprietes: [] as Array<Record<string, unknown>>,
}))

vi.mock('@/lib/aj-signalement/serveur', () => ({ lireCoproprieteEtCabinetParJetonQr: simul.lire }))
vi.mock('@/lib/aj-signalement/serveur-information', () => ({ informationFormulaireQr: simul.information }))
vi.mock('@/lib/aj-signalement/serveur-logo', () => ({ lireLogoPageCabinetQr: simul.lireLogoPage }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-locale': 'fr' }) }))
vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NEXT_NOT_FOUND') },
  permanentRedirect: (url: string) => { throw new Error(`NEXT_REDIRECT_308:${url}`) },
}))

const JETON = '0123456789abcdef0123456789abcdef'
const LOGO = { src: '/api/aj-signalement/logo/cabinet-exemple/?v=0123456789abcdef', alt: 'Cabinet Exemple', largeur: 800, hauteur: 296 }
const COPRO = { nom: 'Résidence Exemple', adresse: '1 rue Exemple, 13001 Marseille' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('composant de la page publique', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ semblables: [] }), { status: 200, headers: { 'content-type': 'application/json' } })))
  })

  it('le logo dans un bandeau blanc AU-DESSUS de l’en-tête bleu nuit ; en-tête, formulaire et pied d’avant', async () => {
    const { default: AppSignalementQr } = await vi.importActual<typeof import('@/components/aj-signalement/AppSignalementQr')>('@/components/aj-signalement/AppSignalementQr')
    const sans = render(<AppSignalementQr jeton={JETON} copropriete={COPRO} langue="fr" />)
    const enteteAvant = (sans.container.querySelector('header') as HTMLElement).outerHTML
    sans.unmount()

    const { container } = render(<AppSignalementQr jeton={JETON} copropriete={COPRO} langue="fr" logo={LOGO} />)
    const page = container.firstChild as HTMLElement
    expect([...page.children].map((e) => e.tagName)).toEqual(['DIV', 'HEADER', 'MAIN', 'FOOTER'])
    const bandeau = page.children[0] as HTMLElement
    expect(bandeau.className).toContain('bg-white')
    const image = screen.getByRole('img', { name: 'Cabinet Exemple' })
    expect(bandeau).toContainElement(image)
    expect(image).toHaveAttribute('src', LOGO.src)
    expect(image).toHaveAttribute('width', '130')
    expect(image).toHaveAttribute('height', '48')
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer')
    // Aligné sur la colonne de la page (même largeur que l'en-tête et le formulaire).
    expect((image.parentElement as HTMLElement).className).toContain('max-w-2xl')
    expect((page.querySelector('header') as HTMLElement).outerHTML).toBe(enteteAvant)
    expect(container.querySelectorAll('img')).toHaveLength(1)
  })

  it('logo null : la page d’avant (en-tête, formulaire, pied)', async () => {
    const { default: AppSignalementQr } = await vi.importActual<typeof import('@/components/aj-signalement/AppSignalementQr')>('@/components/aj-signalement/AppSignalementQr')
    const { container } = render(<AppSignalementQr jeton={JETON} copropriete={COPRO} langue="pt" logo={null} />)
    expect([...(container.firstChild as HTMLElement).children].map((e) => e.tagName)).toEqual(['HEADER', 'MAIN', 'FOOTER'])
    expect(container.querySelector('img')).toBeNull()
  })
})

describe('page serveur du chemin client', () => {
  const copro = { id: 'c1', nom: 'Résidence Exemple', adresse: '1 rue Exemple', jeton: JETON, emails_destinataires: [], actif: true, created_at: null, cabinet_id: 'k1' }
  const cabinet = (identifiant: string) => ({ id: 'k1', nom: 'Cabinet Exemple', identifiant, langue: 'fr' })

  beforeEach(() => {
    vi.clearAllMocks()
    simul.proprietes = []
    simul.information.mockResolvedValue(null)
    simul.lireLogoPage.mockResolvedValue(LOGO)
    vi.doMock('@/components/aj-signalement/AppSignalementQr', () => ({
      default: (p: Record<string, unknown>) => { simul.proprietes.push(p); return null },
    }))
  })

  const ouvrirCabinet = async (identifiant: string, jeton = JETON) => {
    const { default: Page } = await import('@/app/(commun)/cabinet/[identifiant]/signalement/[jeton]/page')
    return Page({ params: Promise.resolve({ identifiant, jeton }) })
  }

  it('le logo du cabinet de la copropriété (lu par son id) passé au composant', async () => {
    simul.lire.mockResolvedValue({ ok: true, copropriete: copro, cabinet: cabinet('cabinet-exemple') })
    render(await ouvrirCabinet('cabinet-exemple'))
    expect(simul.lireLogoPage).toHaveBeenCalledWith({ id: 'k1' })
    expect(simul.proprietes.at(-1)).toMatchObject({ jeton: JETON, langue: 'fr', logo: LOGO })
  })

  it('aucun logo : les propriétés d’avant, sans clé « logo »', async () => {
    simul.lire.mockResolvedValue({ ok: true, copropriete: copro, cabinet: cabinet('cabinet-exemple') })
    simul.lireLogoPage.mockResolvedValue(null)
    render(await ouvrirCabinet('cabinet-exemple'))
    expect(Object.keys(simul.proprietes.at(-1) ?? {}).sort()).toEqual(['copropriete', 'information', 'jeton', 'langue'])
  })

  it('page refusée (jeton d’un autre cabinet, jeton mal formé) : le logo n’est jamais lu', async () => {
    simul.lire.mockResolvedValue({ ok: true, copropriete: copro, cabinet: cabinet('autre-cabinet') })
    await expect(ouvrirCabinet('cabinet-exemple')).rejects.toThrow('NEXT_NOT_FOUND')
    await expect(ouvrirCabinet('cabinet-exemple', 'pas-un-jeton')).rejects.toThrow('NEXT_NOT_FOUND')
    expect(simul.lireLogoPage).not.toHaveBeenCalled()
  })

  it('ancienne page /fr|pt/signalement/<jeton>/ (copropriété sans cabinet) : aucun logo lu', async () => {
    simul.lire.mockResolvedValue({ ok: true, copropriete: { ...copro, cabinet_id: null }, cabinet: null })
    const { default: PageAncienne } = await import('@/app/(commun)/signalement/[jeton]/page')
    render(await PageAncienne({ params: Promise.resolve({ jeton: JETON }) }))
    expect(simul.lireLogoPage).not.toHaveBeenCalled()
    expect(simul.proprietes.at(-1)).not.toHaveProperty('logo')
  })
})
