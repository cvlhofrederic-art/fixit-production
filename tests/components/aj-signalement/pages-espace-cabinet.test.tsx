// tests/components/aj-signalement/pages-espace-cabinet.test.tsx
//
// Espace de chaque cabinet client (PR 2, lot 4 ; Hugo, 11/11/2026 : « vitfix.io/<client>/ » est l'espace personnel du
// cabinet), côté pages internes servies par réécriture (next.config.ts) :
// - app/(commun)/cabinet/[identifiant]/connexion : connexion professionnelle DU cabinet (composant de la #669, contexte
//   du cabinet : nom, espace /<id>/suivi/, identifiant pour la décision d'accès) ;
// - app/(commun)/cabinet/[identifiant]/suivi : espace du gestionnaire (garde du navigateur avec le cabinet de la page).
// Identifiant invalide ou réservé → 404 SANS lecture ; cabinet inconnu (migration 20261111 absente comprise : la lecture
// rend alors « aucun cabinet ») → le même 404 ; erreur de base → exception (page d'erreur), jamais un faux 404.
// La lecture (serveur) et les chargeurs clients sont simulés : seules les décisions des pages sont testées.

import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const simul = vi.hoisted(() => ({ lire: vi.fn() }))

vi.mock('@/lib/aj-signalement/serveur', () => ({ lireCabinetDuCheminQr: simul.lire }))
vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NEXT_NOT_FOUND') },
}))
vi.mock('@/components/aj-signalement/espace/ChargeurConnexionEspaceQr', () => ({
  default: ({ contexte }: { contexte: unknown }) => <pre data-testid="connexion">{JSON.stringify(contexte)}</pre>,
}))
vi.mock('@/components/aj-signalement/espace/ChargeurEspaceQr', () => ({
  default: ({ cabinet }: { cabinet?: unknown }) => <pre data-testid="espace">{JSON.stringify(cabinet ?? null)}</pre>,
}))

const { default: PageConnexion } = await import('@/app/(commun)/cabinet/[identifiant]/connexion/page')
const { default: PageSuivi } = await import('@/app/(commun)/cabinet/[identifiant]/suivi/page')

const params = (identifiant: string) => ({ params: Promise.resolve({ identifiant }) })
const lu = (id: string) => JSON.parse(screen.getByTestId(id).textContent ?? 'null')

beforeEach(() => {
  simul.lire.mockReset()
  simul.lire.mockImplementation(async (identifiant: string) => ({ ok: true, cabinet: { identifiant, nom: 'Cabinet Exemple' } }))
})

describe('connexion professionnelle d’un cabinet (/<identifiant>/connexion/)', () => {
  it('cabinet connu : formulaire de la #669 avec le contexte du cabinet (nom, espace de suivi, identifiant)', async () => {
    render(await PageConnexion(params('cabinet-exemple')))
    expect(lu('connexion')).toEqual({
      nom: 'Cabinet Exemple', espace: { fr: '/cabinet-exemple/suivi/', pt: '/cabinet-exemple/suivi/' }, cabinet: { identifiant: 'cabinet-exemple' },
    })
    expect(simul.lire).toHaveBeenCalledWith('cabinet-exemple')
  })

  it.each(['Cabinet-Exemple', 'ab', 'aj-signalement', 'api', 'cabinet', 'a--b', 'plumber-porto'])(
    'identifiant invalide ou réservé (%s) : 404 sans lecture',
    async (identifiant) => {
      await expect(PageConnexion(params(identifiant))).rejects.toThrow('NEXT_NOT_FOUND')
      expect(simul.lire).not.toHaveBeenCalled()
    },
  )

  it('cabinet inconnu (ou migration 20261111 absente) : 404', async () => {
    simul.lire.mockResolvedValue({ ok: true, cabinet: null })
    await expect(PageConnexion(params('cabinet-exemple'))).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('erreur de base : exception (page d’erreur), pas un 404 qui ferait croire à un cabinet inconnu', async () => {
    simul.lire.mockResolvedValue({ ok: false })
    await expect(PageConnexion(params('cabinet-exemple'))).rejects.toThrow(/cabinet/)
    await expect(PageConnexion(params('cabinet-exemple'))).rejects.not.toThrow('NEXT_NOT_FOUND')
  })
})

describe('espace de suivi du gestionnaire (/<identifiant>/suivi/)', () => {
  it('cabinet connu : l’espace, avec le cabinet de la page pour la garde du navigateur', async () => {
    render(await PageSuivi(params('cabinet-exemple')))
    expect(lu('espace')).toEqual({ identifiant: 'cabinet-exemple', nom: 'Cabinet Exemple' })
  })

  it('identifiant réservé : 404 sans lecture', async () => {
    await expect(PageSuivi(params('aj-signalement'))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(simul.lire).not.toHaveBeenCalled()
  })

  it('cabinet inconnu : 404', async () => {
    simul.lire.mockResolvedValue({ ok: true, cabinet: null })
    await expect(PageSuivi(params('cabinet-exemple'))).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
