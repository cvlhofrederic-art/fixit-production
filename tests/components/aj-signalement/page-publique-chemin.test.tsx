// tests/components/aj-signalement/page-publique-chemin.test.tsx
//
// Chemin par cabinet client (vitfix.io/<identifiant>/signalement/<jeton>/, choix de Hugo du 10/11/2026), côté pages :
// - page interne app/(commun)/cabinet/[identifiant]/signalement/[jeton] (servie par réécriture) : identifiant ou jeton
//   mal formé → 404 SANS lecture ; copropriété inconnue, désactivée, sans cabinet ou d'un AUTRE cabinet → le même 404 ;
//   sinon la page publique, dans la langue du cabinet (attribut lang et textes) ;
// - ancienne page /fr|pt/signalement/<jeton>/ (QR codes déjà imprimés) : copropriété rattachée → redirection
//   permanente (308) vers le chemin de son cabinet ; sans cabinet → servie comme aujourd'hui (langue du chemin).
// La lecture (serveur) est simulée : seules les décisions des pages sont testées.

import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const simul = vi.hoisted(() => ({
  lire: vi.fn(),
  locale: 'fr' as string | null,
}))

vi.mock('@/lib/aj-signalement/serveur', () => ({ lireCoproprieteEtCabinetParJetonQr: simul.lire }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(simul.locale ? { 'x-locale': simul.locale } : {}),
}))
vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NEXT_NOT_FOUND') },
  permanentRedirect: (url: string) => { throw new Error(`NEXT_REDIRECT_308:${url}`) },
}))
vi.mock('@/components/aj-signalement/AppSignalementQr', () => ({
  default: ({ jeton, copropriete, langue }: { jeton: string; copropriete: { nom: string; adresse: string }; langue: string }) => (
    <p data-testid="app" data-jeton={jeton} data-langue={langue}>{copropriete.nom} — {copropriete.adresse}</p>
  ),
}))

const { default: PageCabinet } = await import('@/app/(commun)/cabinet/[identifiant]/signalement/[jeton]/page')
const { default: PageAncienne } = await import('@/app/(commun)/signalement/[jeton]/page')

const JETON = '0123456789abcdef0123456789abcdef'
const copro = { id: 'c1', nom: 'Résidence Exemple', adresse: '1 rue Exemple', jeton: JETON, emails_destinataires: [], actif: true, created_at: null, cabinet_id: 'k1' }
const cabinet = (identifiant: string, langue: 'fr' | 'pt' = 'fr') => ({ id: 'k1', nom: 'Cabinet Exemple', identifiant, langue })

const ouvrirCabinet = (identifiant: string, jeton = JETON) => PageCabinet({ params: Promise.resolve({ identifiant, jeton }) })
const ouvrirAncienne = (jeton = JETON) => PageAncienne({ params: Promise.resolve({ jeton }) })

beforeEach(() => {
  simul.lire.mockReset()
  simul.locale = 'fr'
})

describe('page interne du chemin client (/<identifiant>/signalement/<jeton>/)', () => {
  it('même cabinet : la page publique, dans la langue du cabinet', async () => {
    simul.lire.mockResolvedValue({ ok: true, copropriete: copro, cabinet: cabinet('cabinet-exemple', 'pt') })
    render(await ouvrirCabinet('cabinet-exemple'))
    const app = screen.getByTestId('app')
    expect(app).toHaveAttribute('data-langue', 'pt')
    expect(app).toHaveAttribute('data-jeton', JETON)
    expect(app).toHaveTextContent('Résidence Exemple — 1 rue Exemple')
    expect(app.closest('[lang]')).toHaveAttribute('lang', 'pt')
    expect(simul.lire).toHaveBeenCalledWith(JETON)
  })

  it('cabinet en français par défaut', async () => {
    simul.lire.mockResolvedValue({ ok: true, copropriete: copro, cabinet: cabinet('cabinet-exemple') })
    render(await ouvrirCabinet('cabinet-exemple'))
    expect(screen.getByTestId('app')).toHaveAttribute('data-langue', 'fr')
  })

  it('le jeton appartient à un AUTRE cabinet que celui du chemin : 404 neutre', async () => {
    simul.lire.mockResolvedValue({ ok: true, copropriete: copro, cabinet: cabinet('autre-cabinet') })
    await expect(ouvrirCabinet('cabinet-exemple')).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it.each([
    ['copropriété inconnue ou désactivée', { ok: true, copropriete: null, cabinet: null }],
    ['copropriété sans cabinet (ancienne adresse seulement)', { ok: true, copropriete: { ...copro, cabinet_id: null }, cabinet: null }],
    ['lecture impossible', { ok: false, code: 'serveur' }],
    ['migration absente', { ok: false, code: 'base_absente' }],
  ])('%s : le même 404', async (_cas, lecture) => {
    simul.lire.mockResolvedValue(lecture)
    await expect(ouvrirCabinet('cabinet-exemple')).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it.each([
    ['identifiant trop court', 'ab', JETON],
    ['identifiant en majuscules', 'Cabinet-Exemple', JETON],
    ['identifiant hors format', 'cabinet--exemple', JETON],
    ['jeton trop court', 'cabinet-exemple', JETON.slice(1)],
    ['jeton en majuscules', 'cabinet-exemple', JETON.toUpperCase()],
  ])('%s : 404 sans aucune lecture', async (_cas, identifiant, jeton) => {
    await expect(ouvrirCabinet(identifiant, jeton)).rejects.toThrow('NEXT_NOT_FOUND')
    expect(simul.lire).not.toHaveBeenCalled()
  })
})

describe('ancienne page /fr|pt/signalement/<jeton>/ (QR codes déjà imprimés)', () => {
  it('copropriété rattachée à un cabinet : redirection permanente vers le chemin du cabinet', async () => {
    simul.lire.mockResolvedValue({ ok: true, copropriete: copro, cabinet: cabinet('cabinet-exemple') })
    await expect(ouvrirAncienne()).rejects.toThrow(`NEXT_REDIRECT_308:/cabinet-exemple/signalement/${JETON}/`)
  })

  it('copropriété sans cabinet : servie comme aujourd’hui, langue du chemin', async () => {
    simul.lire.mockResolvedValue({ ok: true, copropriete: { ...copro, cabinet_id: null }, cabinet: null })
    render(await ouvrirAncienne())
    expect(screen.getByTestId('app')).toHaveAttribute('data-langue', 'fr')
    simul.locale = 'pt'
    render(await ouvrirAncienne())
    expect(screen.getAllByTestId('app')[1]).toHaveAttribute('data-langue', 'pt')
  })

  it('jeton mal formé : 404 sans lecture ; inconnu ou erreur : 404', async () => {
    await expect(ouvrirAncienne('pas-un-jeton')).rejects.toThrow('NEXT_NOT_FOUND')
    expect(simul.lire).not.toHaveBeenCalled()
    simul.lire.mockResolvedValue({ ok: true, copropriete: null, cabinet: null })
    await expect(ouvrirAncienne()).rejects.toThrow('NEXT_NOT_FOUND')
    simul.lire.mockResolvedValue({ ok: false, code: 'serveur' })
    await expect(ouvrirAncienne()).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
