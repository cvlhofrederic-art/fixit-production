// tests/components/pro-invite-compte-existant.test.tsx
//
// Page d'acceptation d'une invitation d'équipe BTP (app/(commun)/pro/invite), parcours « comme les grands logiciels »
// (28/11/2026) :
// - adresse sans compte : deux champs, règle du mot de passe neuf vérifiée avant l'envoi ;
// - adresse qui a déjà un compte : un seul champ, « Mot de passe de votre compte Vitfix », « Mot de passe oublié ? » ;
//   un mauvais mot de passe reste sur le formulaire avec son message ;
// - adresse d'un autre espace : aucun formulaire, l'écran dit quoi faire ;
// - invitation acceptée : la session renvoyée par le serveur est posée et l'invité entre dans son espace ;
// - langue de la société : la page suit celle renvoyée par le serveur (portugais pour une société pt).
// Jusqu'au 27/11/2026 la page demandait toujours de « créer » un mot de passe ; pour un compte existant il n'était pas
// enregistré, et l'invité ne pouvait plus se connecter avec ce qu'il venait de taper.

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  setSession: vi.fn(),
  assign: vi.fn(),
  appMobile: false,
  locale: 'fr' as 'fr' | 'pt',
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('token=lien-signe'),
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: h.getSession, refreshSession: h.refreshSession, setSession: h.setSession } },
}))
vi.mock('@/lib/app-mobile', () => ({ estAppMobile: () => h.appMobile }))
vi.mock('@/lib/i18n/context', () => ({ useLocale: () => h.locale }))

const { default: ProInvitePage } = await import('@/app/(commun)/pro/invite/page')

const SESSION = { access_token: 'jeton-acces', refresh_token: 'jeton-renouvellement', expires_in: 3600 }

interface Lecture { etat_compte: string; langue?: string; role?: string }

function simulerServeur(lecture: Lecture, acceptation: { statut?: number; corps: Record<string, unknown> } = { corps: { success: true } }) {
  const envois: Array<Record<string, unknown>> = []
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      envois.push(JSON.parse(String(init.body)))
      return Response.json(acceptation.corps, { status: acceptation.statut ?? 200 })
    }
    return Response.json({
      valid: true, email: 'cl***@exemple.fr', full_name: 'Claire Martin', role: lecture.role ?? 'GERANT',
      company_name: 'Société BTP', langue: lecture.langue ?? 'fr', etat_compte: lecture.etat_compte,
    })
  }))
  return envois
}

function remplir(id: string, valeur: string) {
  const champ = document.getElementById(id)
  if (!champ) throw new Error(`champ ${id} absent`)
  fireEvent.change(champ, { target: { value: valeur } })
}

let descripteurLocation: PropertyDescriptor | undefined

beforeEach(() => {
  descripteurLocation = Object.getOwnPropertyDescriptor(window, 'location')
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { origin: 'https://vitfix.io', pathname: '/fr/pro/invite/', search: '?token=lien-signe', assign: h.assign },
  })
  h.getSession.mockReset().mockResolvedValue({ data: { session: null }, error: null })
  h.refreshSession.mockReset().mockResolvedValue({ data: {}, error: null })
  h.setSession.mockReset().mockResolvedValue({
    data: { user: { id: 'compte', app_metadata: { role: 'pro_societe', pro_team_role: 'GERANT', company_id: 'societe' } } },
    error: null,
  })
  h.assign.mockReset()
  h.appMobile = false
  h.locale = 'fr'
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  if (descripteurLocation) Object.defineProperty(window, 'location', descripteurLocation)
})

describe('adresse qui a déjà un compte Vitfix', () => {
  it("un seul champ, celui du mot de passe du compte, et « Mot de passe oublié ? »", async () => {
    simulerServeur({ etat_compte: 'existant' })
    render(<ProInvitePage />)
    expect(await screen.findByText(/Vous avez déjà un compte Vitfix avec cette adresse/)).toBeTruthy()
    expect(screen.getByLabelText('Mot de passe de votre compte Vitfix')).toBeTruthy()
    expect(document.getElementById('invite-confirmation')).toBeNull()
    expect(screen.getByRole('button', { name: "Rejoindre l'équipe" })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Mot de passe oublié ?' }).getAttribute('href')).toBe('/fr/auth/reset-password/')
  })

  it("mot de passe accepté : session posée, l'invité entre dans le tableau de bord pro", async () => {
    const envois = simulerServeur({ etat_compte: 'existant' }, { corps: { success: true, compte_existant: true, session: SESSION } })
    render(<ProInvitePage />)
    await screen.findByLabelText('Mot de passe de votre compte Vitfix')
    remplir('invite-mot-de-passe', 'ancien')
    fireEvent.click(screen.getByRole('button', { name: "Rejoindre l'équipe" }))

    await waitFor(() => expect(h.assign).toHaveBeenCalledWith('/fr/pro/dashboard'))
    // Ancien mot de passe hors de la règle des comptes neufs : envoyé tel quel, sans contrôle de la page.
    expect(envois).toEqual([{ token: 'lien-signe', password: 'ancien' }])
    expect(h.setSession).toHaveBeenCalledWith(SESSION)
    expect(screen.getByText('Ouverture de votre espace…')).toBeTruthy()
  })

  it('mauvais mot de passe : le formulaire reste, avec le message et « Mot de passe oublié ? »', async () => {
    simulerServeur({ etat_compte: 'existant' }, { statut: 401, corps: { error: 'Mot de passe incorrect', code: 'mot_de_passe_incorrect' } })
    render(<ProInvitePage />)
    await screen.findByLabelText('Mot de passe de votre compte Vitfix')
    remplir('invite-mot-de-passe', 'Mauvais1')
    fireEvent.click(screen.getByRole('button', { name: "Rejoindre l'équipe" }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/Mot de passe incorrect/)
    expect(screen.getByRole('link', { name: 'Mot de passe oublié ?' })).toBeTruthy()
    expect(h.setSession).not.toHaveBeenCalled()
    expect(h.assign).not.toHaveBeenCalled()
  })

  it("session non renvoyée : écran « Bienvenue » qui dit d'utiliser le mot de passe du compte, session ouverte renouvelée", async () => {
    h.getSession.mockResolvedValue({ data: { session: { access_token: 'ancien' } }, error: null })
    simulerServeur({ etat_compte: 'existant' }, { corps: { success: true, compte_existant: true } })
    render(<ProInvitePage />)
    await screen.findByLabelText('Mot de passe de votre compte Vitfix')
    remplir('invite-mot-de-passe', 'ancien')
    fireEvent.click(screen.getByRole('button', { name: "Rejoindre l'équipe" }))

    expect(await screen.findByText(/Connectez-vous avec le mot de passe de votre compte Vitfix/)).toBeTruthy()
    expect(h.refreshSession).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: 'Se connecter →' }).getAttribute('href')).toBe('/fr/auth/login/')
  })
})

describe('adresse sans compte', () => {
  it('deux champs ; mot de passe hors règle : défauts affichés, rien envoyé', async () => {
    const envois = simulerServeur({ etat_compte: 'aucun' })
    render(<ProInvitePage />)
    await screen.findByText('Choisissez le mot de passe de votre compte Vitfix.')
    remplir('invite-mot-de-passe', 'faible')
    remplir('invite-confirmation', 'faible')
    fireEvent.click(screen.getByRole('button', { name: "Créer mon compte et rejoindre l'équipe" }))

    const alerte = await screen.findByRole('alert')
    expect(alerte.textContent).toMatch(/Minimum 8 caractères/)
    expect(alerte.textContent).toMatch(/Au moins 1 majuscule/)
    expect(envois).toHaveLength(0)
    expect(screen.queryByRole('link', { name: 'Mot de passe oublié ?' })).toBeNull()
  })

  it("compte créé : session posée, l'invité entre dans son espace", async () => {
    simulerServeur({ etat_compte: 'aucun' }, { corps: { success: true, session: SESSION } })
    render(<ProInvitePage />)
    await screen.findByText('Choisissez le mot de passe de votre compte Vitfix.')
    remplir('invite-mot-de-passe', 'MotDePasse1')
    remplir('invite-confirmation', 'MotDePasse1')
    fireEvent.click(screen.getByRole('button', { name: "Créer mon compte et rejoindre l'équipe" }))

    await waitFor(() => expect(h.assign).toHaveBeenCalledWith('/fr/pro/dashboard'))
  })

  it('ouvrier dans l’appli Vitfix Pro : il entre sur le pointage (table des destinations après connexion)', async () => {
    h.appMobile = true
    h.setSession.mockResolvedValue({ data: { user: { id: 'c', app_metadata: { role: 'pro_societe', pro_team_role: 'OUVRIER' } } }, error: null })
    simulerServeur({ etat_compte: 'aucun', role: 'OUVRIER' }, { corps: { success: true, session: SESSION } })
    render(<ProInvitePage />)
    await screen.findByText('Choisissez le mot de passe de votre compte Vitfix.')
    remplir('invite-mot-de-passe', 'MotDePasse1')
    remplir('invite-confirmation', 'MotDePasse1')
    fireEvent.click(screen.getByRole('button', { name: "Créer mon compte et rejoindre l'équipe" }))
    await waitFor(() => expect(h.assign).toHaveBeenCalledWith('/fr/pro/dashboard/?p=pointage'))
  })

  it('confirmation différente : message, rien envoyé', async () => {
    const envois = simulerServeur({ etat_compte: 'aucun' })
    render(<ProInvitePage />)
    await screen.findByText('Choisissez le mot de passe de votre compte Vitfix.')
    remplir('invite-mot-de-passe', 'MotDePasse1')
    remplir('invite-confirmation', 'MotDePasse2')
    fireEvent.click(screen.getByRole('button', { name: "Créer mon compte et rejoindre l'équipe" }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/ne correspondent pas/)
    expect(envois).toHaveLength(0)
  })
})

describe('autres cas', () => {
  it("compte d'un autre espace : aucun formulaire, l'écran dit quoi faire", async () => {
    simulerServeur({ etat_compte: 'autre_espace' })
    render(<ProInvitePage />)
    expect(await screen.findByText('Adresse déjà utilisée ailleurs')).toBeTruthy()
    expect(document.getElementById('invite-mot-de-passe')).toBeNull()
  })

  it('invitation déjà acceptée : « Se connecter » et « Mot de passe oublié ? »', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Invitation déjà utilisée', code: 'deja_utilisee', langue: 'fr' }, { status: 409 })))
    render(<ProInvitePage />)
    expect(await screen.findByText('Invitation déjà acceptée')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Se connecter →' }).getAttribute('href')).toBe('/fr/auth/login/')
    expect(screen.getByRole('link', { name: 'Mot de passe oublié ?' })).toBeTruthy()
  })

  it('rôle écrit en toutes lettres (Gérant), jamais en code', async () => {
    simulerServeur({ etat_compte: 'aucun' })
    render(<ProInvitePage />)
    expect(await screen.findByText('Société BTP vous invite en tant que Gérant')).toBeTruthy()
    expect(screen.queryByText(/GERANT/)).toBeNull()
  })

  it.each([
    ['trop de demandes (429)', 429],
    ['panne du serveur (500)', 500],
  ])('lecture du lien en %s : « Erreur de connexion », jamais « Invitation invalide »', async (_cas, statut) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'x', code: 'erreur' }, { status: statut })))
    render(<ProInvitePage />)
    expect(await screen.findByText('Erreur de connexion')).toBeTruthy()
    expect(screen.queryByText('Invitation invalide')).toBeNull()
  })

  it('état du compte inconnu : deux champs, aucune règle imposée avant l’envoi, « Mot de passe oublié ? »', async () => {
    const envois = simulerServeur({ etat_compte: 'inconnu' }, { statut: 401, corps: { code: 'mot_de_passe_incorrect' } })
    render(<ProInvitePage />)
    expect(await screen.findByText(/Si vous avez déjà un compte Vitfix avec cette adresse, entrez le sien/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Mot de passe oublié ?' })).toBeTruthy()
    remplir('invite-mot-de-passe', 'ancien')
    remplir('invite-confirmation', 'ancien')
    fireEvent.click(screen.getByRole('button', { name: "Créer mon compte et rejoindre l'équipe" }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Mot de passe incorrect/)
    expect(envois).toEqual([{ token: 'lien-signe', password: 'ancien' }])
  })

  it('compte devenu « autre espace » au moment de l’envoi (409) : écran « Adresse déjà utilisée ailleurs »', async () => {
    simulerServeur({ etat_compte: 'existant' }, { statut: 409, corps: { code: 'autre_espace' } })
    render(<ProInvitePage />)
    await screen.findByLabelText('Mot de passe de votre compte Vitfix')
    remplir('invite-mot-de-passe', 'ancien')
    fireEvent.click(screen.getByRole('button', { name: "Rejoindre l'équipe" }))
    expect(await screen.findByText('Adresse déjà utilisée ailleurs')).toBeTruthy()
  })

  it('adresse jamais confirmée (403) : message qui mène à « Mot de passe oublié ? »', async () => {
    simulerServeur({ etat_compte: 'existant' }, { statut: 403, corps: { code: 'non_confirme' } })
    render(<ProInvitePage />)
    await screen.findByLabelText('Mot de passe de votre compte Vitfix')
    remplir('invite-mot-de-passe', 'ancien')
    fireEvent.click(screen.getByRole('button', { name: "Rejoindre l'équipe" }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/jamais été confirmée/)
  })

  it('corps refusé par la validation (400 « requete ») : erreur dans le formulaire, pas un écran de lien refusé', async () => {
    simulerServeur({ etat_compte: 'existant' }, { statut: 400, corps: { code: 'requete' } })
    render(<ProInvitePage />)
    await screen.findByLabelText('Mot de passe de votre compte Vitfix')
    remplir('invite-mot-de-passe', 'ancien')
    fireEvent.click(screen.getByRole('button', { name: "Rejoindre l'équipe" }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Une erreur est survenue/)
    expect(screen.queryByText('Invitation invalide')).toBeNull()
  })

  it('code de lien refusé avec un statut qui n’est pas un refus de lien (400) : erreur dans le formulaire', async () => {
    simulerServeur({ etat_compte: 'existant' }, { statut: 400, corps: { code: 'invalide' } })
    render(<ProInvitePage />)
    await screen.findByLabelText('Mot de passe de votre compte Vitfix')
    remplir('invite-mot-de-passe', 'ancien')
    fireEvent.click(screen.getByRole('button', { name: "Rejoindre l'équipe" }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Une erreur est survenue/)
    expect(screen.queryByText('Invitation invalide')).toBeNull()
  })

  it('lien refusé au moment de l’envoi (410 « expiree ») : écran « Invitation expirée »', async () => {
    simulerServeur({ etat_compte: 'existant' }, { statut: 410, corps: { code: 'expiree' } })
    render(<ProInvitePage />)
    await screen.findByLabelText('Mot de passe de votre compte Vitfix')
    remplir('invite-mot-de-passe', 'ancien')
    fireEvent.click(screen.getByRole('button', { name: "Rejoindre l'équipe" }))
    expect(await screen.findByText('Invitation expirée')).toBeTruthy()
  })

  it('session refusée par le navigateur : écran « Bienvenue » avec « Se connecter », aucune navigation', async () => {
    h.setSession.mockResolvedValue({ data: { user: null }, error: { message: 'jeton refusé' } })
    const avertissement = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    simulerServeur({ etat_compte: 'aucun' }, { corps: { success: true, session: SESSION } })
    render(<ProInvitePage />)
    await screen.findByText('Choisissez le mot de passe de votre compte Vitfix.')
    remplir('invite-mot-de-passe', 'MotDePasse1')
    remplir('invite-confirmation', 'MotDePasse1')
    fireEvent.click(screen.getByRole('button', { name: "Créer mon compte et rejoindre l'équipe" }))
    expect(await screen.findByText("Bienvenue dans l'équipe")).toBeTruthy()
    expect(screen.getByText('Votre compte est prêt. Connectez-vous pour ouvrir votre espace.')).toBeTruthy()
    expect(h.assign).not.toHaveBeenCalled()
    avertissement.mockRestore()
  })

  it('trop de tentatives (429) : message dédié', async () => {
    simulerServeur({ etat_compte: 'existant' }, { statut: 429, corps: { error: 'rate' } })
    render(<ProInvitePage />)
    await screen.findByLabelText('Mot de passe de votre compte Vitfix')
    remplir('invite-mot-de-passe', 'x')
    fireEvent.click(screen.getByRole('button', { name: "Rejoindre l'équipe" }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Trop de tentatives/)
  })
})

describe('société portugaise', () => {
  it('site en portugais : premier rendu déjà en portugais (même texte au serveur et au navigateur)', () => {
    h.locale = 'pt'
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)))
    render(<ProInvitePage />)
    expect(screen.getByText('A verificar o convite…')).toBeTruthy()
    expect(screen.getByText('ESPAÇO PRO')).toBeTruthy()
  })

  it('page en portugais, rôle « Gerente », liens vers les pages /pt', async () => {
    simulerServeur({ etat_compte: 'existant', langue: 'pt' })
    render(<ProInvitePage />)
    expect(await screen.findByText('Société BTP convidou-o(a) como Gerente')).toBeTruthy()
    expect(screen.getByText(/Já tem uma conta Vitfix com este endereço/)).toBeTruthy()
    expect(screen.getByLabelText('Palavra-passe da sua conta Vitfix')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Juntar-me à equipa' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Esqueceu-se da palavra-passe?' }).getAttribute('href')).toBe('/pt/auth/reset-password/')
    expect(screen.queryByText(/Mot de passe/)).toBeNull()
  })

  it('mauvais mot de passe : message en portugais', async () => {
    simulerServeur({ etat_compte: 'existant', langue: 'pt' }, { statut: 401, corps: { code: 'mot_de_passe_incorrect' } })
    render(<ProInvitePage />)
    await screen.findByLabelText('Palavra-passe da sua conta Vitfix')
    remplir('invite-mot-de-passe', 'Mauvais1')
    fireEvent.click(screen.getByRole('button', { name: 'Juntar-me à equipa' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Palavra-passe incorreta/)
  })

  it('session posée : destination dans la langue de la société', async () => {
    simulerServeur({ etat_compte: 'existant', langue: 'pt' }, { corps: { success: true, compte_existant: true, session: SESSION } })
    render(<ProInvitePage />)
    await screen.findByLabelText('Palavra-passe da sua conta Vitfix')
    remplir('invite-mot-de-passe', 'ancien')
    fireEvent.click(screen.getByRole('button', { name: 'Juntar-me à equipa' }))
    await waitFor(() => expect(h.assign).toHaveBeenCalledWith('/pt/pro/dashboard'))
  })
})
