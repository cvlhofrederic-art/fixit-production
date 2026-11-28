// tests/components/pro-invite-compte-existant.test.tsx
//
// Page d'acceptation d'une invitation d'équipe BTP (app/(commun)/pro/invite). Quand l'adresse invitée a déjà un
// compte Vitfix, le serveur rattache ce compte à la société SANS changer son mot de passe : celui saisi dans le
// formulaire n'est pas enregistré. Jusqu'au 27/11/2026 la page affichait quand même « Compte créé, connectez-vous avec
// vos identifiants » : l'invité essayait le mot de passe qu'il venait de taper et la connexion lui était refusée.
// L'écran de fin dit maintenant que le compte existait, que le mot de passe saisi n'a pas été retenu, et mène à
// « Mot de passe oublié ». Une session déjà ouverte dans le navigateur est renouvelée (sinon son jeton garde l'ancien
// rôle et le tableau de bord renvoie à la connexion en boucle). Un compte neuf garde l'écran « Compte créé ».

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({
  sessionOuverte: false,
  getSession: vi.fn(),
  refreshSession: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('token=lien-signe'),
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: h.getSession, refreshSession: h.refreshSession } },
}))

const { default: ProInvitePage } = await import('@/app/(commun)/pro/invite/page')

const MOT_DE_PASSE = 'NouveauMotDePasse1'

function simulerServeur(reponseAcceptation: Record<string, unknown>, statut = 200) {
  const appels: Array<{ url: string; init?: RequestInit }> = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    appels.push({ url, init })
    if (init?.method === undefined) {
      return Response.json({ valid: true, email: 'cl***@exemple.fr', full_name: 'Claire Martin', role: 'GERANT', company_name: 'Société BTP' })
    }
    return Response.json(reponseAcceptation, { status: statut })
  }))
  return appels
}

async function accepterAvecMotDePasse() {
  render(<ProInvitePage />)
  await screen.findByText("Rejoindre l'équipe")
  const champs = document.querySelectorAll('input[type="password"]')
  fireEvent.change(champs[0], { target: { value: MOT_DE_PASSE } })
  fireEvent.change(champs[1], { target: { value: MOT_DE_PASSE } })
  fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))
}

describe("page d'invitation pro : compte existant rattaché", () => {
  beforeEach(() => {
    cleanup()
    h.sessionOuverte = false
    h.getSession.mockReset().mockImplementation(async () => ({ data: { session: h.sessionOuverte ? { access_token: 'ancien' } : null }, error: null }))
    h.refreshSession.mockReset().mockResolvedValue({ data: {}, error: null })
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('le rôle Gérant est écrit en toutes lettres', async () => {
    simulerServeur({ success: true })
    render(<ProInvitePage />)
    expect(await screen.findByText('Gérant')).toBeTruthy()
    expect(screen.queryByText('GERANT')).toBeNull()
  })

  it("compte existant : l'écran dit que le mot de passe saisi n'a pas été enregistré et mène à « Mot de passe oublié »", async () => {
    const appels = simulerServeur({ success: true, compte_existant: true, message: 'Compte existant rattaché.' })
    await accepterAvecMotDePasse()

    expect(await screen.findByText("Compte rattaché à l'équipe")).toBeTruthy()
    expect(screen.getByText("Le mot de passe saisi ici n'a pas été enregistré.")).toBeTruthy()
    expect(screen.queryByText('Compte créé')).toBeNull()
    expect(screen.getByRole('link', { name: 'Mot de passe oublié' }).getAttribute('href')).toBe('/auth/reset-password')
    expect(screen.getByRole('link', { name: 'Se connecter →' }).getAttribute('href')).toBe('/auth/login')

    const acceptation = appels.find(a => a.init?.method === 'POST')
    expect(JSON.parse(String(acceptation?.init?.body))).toEqual({ token: 'lien-signe', password: MOT_DE_PASSE })
    // Aucune session ouverte dans ce navigateur : rien à renouveler.
    expect(h.refreshSession).not.toHaveBeenCalled()
  })

  it('compte existant avec une session déjà ouverte : la session est renouvelée (nouveau rôle dans le jeton)', async () => {
    h.sessionOuverte = true
    simulerServeur({ success: true, compte_existant: true })
    await accepterAvecMotDePasse()

    expect(await screen.findByText("Compte rattaché à l'équipe")).toBeTruthy()
    expect(h.refreshSession).toHaveBeenCalledTimes(1)
  })

  it('renouvellement de session en échec : l’écran « Compte rattaché » s’affiche quand même', async () => {
    h.sessionOuverte = true
    h.refreshSession.mockRejectedValue(new Error('réseau'))
    const avertissement = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    simulerServeur({ success: true, compte_existant: true })
    await accepterAvecMotDePasse()

    expect(await screen.findByText("Compte rattaché à l'équipe")).toBeTruthy()
    expect(avertissement).toHaveBeenCalled()
    avertissement.mockRestore()
  })

  it('compte neuf : écran « Compte créé » inchangé, sans « Mot de passe oublié » ni renouvellement de session', async () => {
    h.sessionOuverte = true
    simulerServeur({ success: true, message: 'Compte créé avec succès.' })
    await accepterAvecMotDePasse()

    await waitFor(() => expect(screen.getByText('Compte créé')).toBeTruthy())
    expect(screen.getByText('Vous pouvez maintenant vous connecter avec vos identifiants.')).toBeTruthy()
    expect(screen.queryByText("Compte rattaché à l'équipe")).toBeNull()
    expect(screen.queryByRole('link', { name: 'Mot de passe oublié' })).toBeNull()
    expect(h.refreshSession).not.toHaveBeenCalled()
  })

  it('rattachement non validé (207) : le message du serveur s’affiche, pas un écran de succès', async () => {
    simulerServeur({ success: false, message: "Le compte a été rattaché mais l'invitation n'a pas pu être validée. Contactez le support." }, 207)
    await accepterAvecMotDePasse()

    expect(await screen.findByText(/Contactez le support/)).toBeTruthy()
    expect(screen.queryByText("Compte rattaché à l'équipe")).toBeNull()
    expect(screen.queryByText('Compte créé')).toBeNull()
  })
})
