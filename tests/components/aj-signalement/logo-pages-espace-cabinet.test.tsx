// tests/components/aj-signalement/logo-pages-espace-cabinet.test.tsx
//
// Logo d'un cabinet client (demande de Hugo du 13/11/2026), côté pages serveur de l'espace du cabinet (servies par
// réécriture depuis vitfix.io/<identifiant>/…) :
//   - connexion : le logo lu par lireLogoPageCabinetQr({ identifiant }) entre dans le contexte du composant, APRÈS la
//     lecture du cabinet (cabinet inconnu → 404 sans lecture du logo) ;
//   - invitation et confirmation d'adresse : le logo est passé au composant ; identifiant invalide → 404 sans lecture ;
//     identifiant valable mais sans cabinet ni logo → la page d'avant (jamais un 404 : un logo ne décide de rien) ;
//   - suivi : aucune lecture ici (le logo vient de GET /moi, dans le navigateur) ;
//   - aucun logo (cabinet sans logo, migration 20261114 absente, erreur : lireLogoPageCabinetQr rend null) → les
//     propriétés d'avant, sans clé « logo ».
// Lectures serveur et composants clients simulés : seules les décisions des pages sont testées.

import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { contexteConnexionCabinetQr } from '@/lib/aj-signalement/connexion-espace'

const simul = vi.hoisted(() => ({
  lireCabinet: vi.fn(),
  lireLogoPage: vi.fn(),
  proprietes: {} as Record<string, Record<string, unknown>>,
}))

vi.mock('@/lib/aj-signalement/serveur', () => ({ lireCabinetDuCheminQr: simul.lireCabinet }))
vi.mock('@/lib/aj-signalement/serveur-logo', () => ({ lireLogoPageCabinetQr: simul.lireLogoPage }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND') } }))
vi.mock('@/components/aj-signalement/espace/ChargeurConnexionEspaceQr', () => ({
  default: (p: Record<string, unknown>) => { simul.proprietes.connexion = p; return null },
}))
vi.mock('@/components/aj-signalement/espace/ChargeurEspaceQr', () => ({
  default: (p: Record<string, unknown>) => { simul.proprietes.suivi = p; return null },
}))
vi.mock('@/components/aj-signalement/InvitationAccesQr', () => ({
  default: (p: Record<string, unknown>) => { simul.proprietes.invitation = p; return null },
}))
vi.mock('@/components/aj-signalement/ConfirmationAdresseQr', () => ({
  default: (p: Record<string, unknown>) => { simul.proprietes['confirmation-adresse'] = p; return null },
}))

const { default: PageConnexion } = await import('@/app/(commun)/cabinet/[identifiant]/connexion/page')
const { default: PageSuivi } = await import('@/app/(commun)/cabinet/[identifiant]/suivi/page')
const { default: PageInvitation } = await import('@/app/(commun)/cabinet/[identifiant]/invitation/page')
const { default: PageConfirmation } = await import('@/app/(commun)/cabinet/[identifiant]/confirmation-adresse/page')

const CABINET = { identifiant: 'cabinet-exemple', nom: 'Cabinet Exemple' }
const LOGO = { src: '/api/aj-signalement/logo/cabinet-exemple/?v=0123456789abcdef', alt: 'Cabinet Exemple', largeur: 800, hauteur: 296 }
const params = (identifiant: string) => ({ params: Promise.resolve({ identifiant }) })
const PAGES_LIEN = { invitation: PageInvitation, 'confirmation-adresse': PageConfirmation } as const

beforeEach(() => {
  vi.clearAllMocks()
  simul.proprietes = {}
  simul.lireCabinet.mockImplementation(async (identifiant: string) => ({ ok: true, cabinet: { identifiant, nom: 'Cabinet Exemple' } }))
  simul.lireLogoPage.mockResolvedValue(LOGO)
})

describe('connexion professionnelle du cabinet', () => {
  it('le logo du cabinet dans le contexte, lu par son identifiant', async () => {
    render(await PageConnexion(params('cabinet-exemple')))
    expect(simul.proprietes.connexion).toEqual({ contexte: contexteConnexionCabinetQr(CABINET, LOGO) })
    expect(simul.lireLogoPage).toHaveBeenCalledWith({ identifiant: 'cabinet-exemple' })
  })

  it('aucun logo : le contexte d’avant, sans clé « logo »', async () => {
    simul.lireLogoPage.mockResolvedValue(null)
    render(await PageConnexion(params('cabinet-exemple')))
    expect(simul.proprietes.connexion).toEqual({ contexte: contexteConnexionCabinetQr(CABINET) })
    expect(Object.keys(simul.proprietes.connexion.contexte as object).sort()).toEqual(['cabinet', 'espace', 'nom'])
  })

  it('cabinet inconnu : 404 sans lecture du logo', async () => {
    simul.lireCabinet.mockResolvedValue({ ok: true, cabinet: null })
    await expect(PageConnexion(params('cabinet-exemple'))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(simul.lireLogoPage).not.toHaveBeenCalled()
  })
})

describe('suivi du gestionnaire', () => {
  it('aucune lecture du logo côté serveur : propriétés d’avant', async () => {
    render(await PageSuivi(params('cabinet-exemple')))
    expect(simul.proprietes.suivi).toEqual({ cabinet: CABINET })
    expect(simul.lireLogoPage).not.toHaveBeenCalled()
  })
})

describe.each(['invitation', 'confirmation-adresse'] as const)('%s', (chemin) => {
  const Page = PAGES_LIEN[chemin]

  it('le logo passé au composant, lu par l’identifiant du chemin', async () => {
    render(await Page(params('cabinet-exemple')))
    expect(simul.proprietes[chemin]).toEqual({ identifiant: 'cabinet-exemple', logo: LOGO })
    expect(simul.lireLogoPage).toHaveBeenCalledWith({ identifiant: 'cabinet-exemple' })
    expect(simul.lireCabinet).not.toHaveBeenCalled()
  })

  it('aucun logo (ni cabinet, migration absente, erreur) : la page d’avant, identifiant seul', async () => {
    simul.lireLogoPage.mockResolvedValue(null)
    render(await Page(params('cabinet-inconnu')))
    expect(simul.proprietes[chemin]).toEqual({ identifiant: 'cabinet-inconnu' })
  })

  it('identifiant invalide : 404 sans lecture du logo', async () => {
    await expect(Page(params('Cabinet-Exemple'))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(simul.lireLogoPage).not.toHaveBeenCalled()
  })
})
