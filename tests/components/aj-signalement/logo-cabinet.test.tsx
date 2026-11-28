// tests/components/aj-signalement/logo-cabinet.test.tsx
//
// Logo d'un cabinet client dans la vue « Cabinets » de l'espace AJ Signalement (super admin ; demande de Hugo du
// 13/11/2026, BROUILLON pour Frédéric) : bouton « Logo » sur chaque cabinet, fenêtre avec le logo actuel (lu par sa
// route publique versionnée) ou « Aucun logo », choix d'un fichier converti en PNG sur l'appareil (convertirLogoQr,
// simulée ici), aperçu, enregistrement (PUT …/logo, PNG en base64), retrait après confirmation (DELETE …/logo), messages
// d'erreur (conversion refusée, refus du serveur). Aucun logo réel : images synthétiques.

import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEXTES_GESTION_QR as G } from '@/lib/aj-signalement/affichage-gestion'
import { remplir } from '@/lib/coproprietaire/textes'
import type { CabinetQr } from '@/lib/aj-signalement/types'
import { messageEchecQr } from '@/components/aj-signalement/messageEchecQr'
import { pngSynthetique } from '../../helpers/png-synthetique'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
const conversion = vi.hoisted(() => ({ convertirLogoQr: vi.fn() }))
vi.mock('@/lib/aj-signalement/logo-navigateur', () => conversion)

const { default: CabinetsQr } = await import('@/components/aj-signalement/CabinetsQr')

const L = G.cabinets.logo
const K1 = 'a0000000-0000-4000-8000-0000000000a1'
const K2 = 'a0000000-0000-4000-8000-0000000000a2'
const VERSION = '0123456789abcdef'
const avecLogo: CabinetQr = {
  id: K1, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr', domaines: ['exemple.test'], identifiantFige: true,
  nbCoproprietes: 1, nbGestionnaires: 1, logo: { version: VERSION, largeur: 320, hauteur: 120 },
}
const sansLogo: CabinetQr = { id: K2, nom: 'Autre Exemple', identifiant: 'autre-exemple', langue: 'fr', domaines: [], identifiantFige: false, nbCoproprietes: 0, nbGestionnaires: 0 }
const PNG = pngSynthetique(800, 296)

type Appel = { url: string; methode: string; corps: unknown }
let appels: Appel[] = []
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })

function simulerFetch(routeur: (appel: Appel) => Response) {
  appels = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const appel = { url, methode: init?.method ?? 'GET', corps: init?.body ? JSON.parse(String(init.body)) : null }
    appels.push(appel)
    return routeur(appel)
  }))
}

const rappels = { onModifie: vi.fn(), onReessayer: vi.fn(), onJournal: vi.fn() }
const rendre = () => render(<CabinetsQr cabinets={[avecLogo, sansLogo]} erreur={null} coproprietes={[]} {...rappels} />)
const carte = (nom: string) => screen.getByRole('heading', { name: nom }).closest('section') as HTMLElement
const ouvrir = (nom: string) => fireEvent.click(within(carte(nom)).getByRole('button', { name: L.bouton }))
const fenetre = () => screen.getByRole('dialog')
const choisirFichier = (nom = 'logo.svg') => {
  const champ = within(fenetre()).getByLabelText(L.fichier) as HTMLInputElement
  fireEvent.change(champ, { target: { files: [new File(['<svg/>'], nom, { type: 'image/svg+xml' })] } })
}

beforeEach(() => {
  vi.clearAllMocks()
  simulerFetch(() => json({}))
  conversion.convertirLogoQr.mockResolvedValue({ ok: true, png: PNG, largeur: 800, hauteur: 296 })
  // jsdom n'a pas d'adresses blob : l'aperçu reçoit une adresse simulée.
  URL.createObjectURL = vi.fn(() => 'blob:apercu-logo')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => vi.unstubAllGlobals())

describe('cartes des cabinets', () => {
  it('chaque cabinet a un bouton « Logo » et une ligne qui dit s’il en a un', () => {
    rendre()
    expect(within(carte('Cabinet Exemple')).getByText(remplir(L.ligneAvec, { largeur: 320, hauteur: 120 }))).toBeInTheDocument()
    expect(within(carte('Autre Exemple')).getByText(L.ligneSans)).toBeInTheDocument()
    expect(within(carte('Cabinet Exemple')).getByRole('button', { name: L.bouton })).toBeInTheDocument()
    expect(within(carte('Autre Exemple')).getByRole('button', { name: L.bouton })).toBeInTheDocument()
  })
})

// Relecture de conformité du 13/11/2026 : la fenêtre promettait le logo « dans les e-mails de signalement », qui partent
// en lot (Resend n'y accepte aucune pièce jointe) et n'en portent jamais (tests/api/aj-signalement-signalements.test.ts).
// Le texte ne promet le logo que là où il paraît. BROUILLON pour Frédéric ; à revoir si Hugo retient l'envoi unitaire.
describe('textes de la fenêtre : le logo promis seulement là où il paraît', () => {
  it('accusé de réception au déclarant : oui ; e-mails de signalement aux gestionnaires et messages diffusés : non', () => {
    rendre()
    ouvrir('Cabinet Exemple')
    const intro = within(fenetre()).getByText(L.intro).textContent ?? ''
    expect(intro).toMatch(/dans l’accusé de réception envoyé au déclarant/)
    expect(intro).toMatch(/ni dans les e-mails de signalement envoyés aux gestionnaires, ni dans les messages diffusés aux déclarants/)
    expect(intro).not.toMatch(/et les e-mails de signalement/)
  })

  it('confirmation du retrait : les accusés de réception, pas « les e-mails du cabinet »', () => {
    expect(L.confirmerRetrait).toMatch(/accusés de réception/)
    expect(L.confirmerRetrait).not.toMatch(/e-mails du cabinet/)
  })
})

describe('fenêtre du logo', () => {
  it('cabinet avec logo : image lue par la route publique versionnée, dimensions, « Retirer le logo »', () => {
    rendre()
    ouvrir('Cabinet Exemple')
    expect(within(fenetre()).getByRole('heading', { name: remplir(L.titre, { cabinet: 'Cabinet Exemple' }) })).toBeInTheDocument()
    const image = within(fenetre()).getByRole('img', { name: remplir(L.altActuel, { cabinet: 'Cabinet Exemple' }) })
    expect(image).toHaveAttribute('src', `/api/aj-signalement/logo/cabinet-exemple/?v=${VERSION}`)
    expect(within(fenetre()).getByText(remplir(L.dimensions, { largeur: 320, hauteur: 120 }))).toBeInTheDocument()
    expect(within(fenetre()).getByRole('button', { name: L.retirer })).toBeInTheDocument()
    expect(within(fenetre()).getByRole('button', { name: L.envoyer })).toBeDisabled()
  })

  it('cabinet sans logo : « Aucun logo », aucune image, pas de retrait', () => {
    rendre()
    ouvrir('Autre Exemple')
    expect(within(fenetre()).getByText(L.aucun)).toBeInTheDocument()
    expect(within(fenetre()).queryByRole('img')).toBeNull()
    expect(within(fenetre()).queryByRole('button', { name: L.retirer })).toBeNull()
  })

  it('fichier choisi : converti sur l’appareil, aperçu du PNG, puis PUT …/logo avec le PNG en base64 ; fenêtre fermée, message, rechargement', async () => {
    simulerFetch(() => json({ logo: { version: 'fedcba9876543210', largeur: 800, hauteur: 296 }, modifie: true }))
    rendre()
    ouvrir('Autre Exemple')
    expect(within(fenetre()).getByLabelText(L.fichier)).toHaveAttribute('accept', '.svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp')
    choisirFichier()
    const apercu = await within(fenetre()).findByRole('img', { name: remplir(L.altApercu, { cabinet: 'Autre Exemple' }) })
    expect(apercu).toHaveAttribute('src', 'blob:apercu-logo')
    expect(conversion.convertirLogoQr).toHaveBeenCalledTimes(1)
    expect((conversion.convertirLogoQr.mock.calls[0][0] as File).name).toBe('logo.svg')
    expect(within(fenetre()).getByText(remplir(L.apercuDetail, { largeur: 800, hauteur: 296, poids: Math.max(1, Math.round(PNG.length / 1024)) }))).toBeInTheDocument()
    fireEvent.click(within(fenetre()).getByRole('button', { name: L.envoyer }))
    await waitFor(() => expect(rappels.onModifie).toHaveBeenCalledTimes(1))
    expect(appels).toEqual([{ url: `/api/aj-signalement/cabinets/${K2}/logo`, methode: 'PUT', corps: { png: Buffer.from(PNG).toString('base64') } }])
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText(L.enregistre)).toBeInTheDocument()
  })

  it('même logo déjà en place (modifie false) : message dédié', async () => {
    simulerFetch(() => json({ logo: { version: VERSION, largeur: 320, hauteur: 120 }, modifie: false }))
    rendre()
    ouvrir('Cabinet Exemple')
    choisirFichier('logo.png')
    await within(fenetre()).findByRole('img', { name: remplir(L.altApercu, { cabinet: 'Cabinet Exemple' }) })
    fireEvent.click(within(fenetre()).getByRole('button', { name: L.envoyer }))
    expect(await screen.findByText(L.inchange)).toBeInTheDocument()
  })

  it.each([
    ['fichier_trop_lourd'], ['format'], ['illisible'], ['trop_lourd'], ['navigateur'],
  ] as const)('conversion refusée (%s) : message, rien d’envoyé', async (raison) => {
    conversion.convertirLogoQr.mockResolvedValue({ ok: false, raison })
    rendre()
    ouvrir('Autre Exemple')
    choisirFichier()
    expect(await within(fenetre()).findByText(L.erreurs[raison])).toBeInTheDocument()
    expect(within(fenetre()).getByRole('button', { name: L.envoyer })).toBeDisabled()
    expect(appels).toEqual([])
  })

  it('conversion refusée : SVG avec du texte HTML (svg_html) : message dédié', async () => {
    conversion.convertirLogoQr.mockResolvedValue({ ok: false, raison: 'svg_html' })
    rendre()
    ouvrir('Autre Exemple')
    choisirFichier()
    expect(await within(fenetre()).findByText(L.erreurs.svg_html)).toBeInTheDocument()
    expect(L.erreurs.svg_html).toMatch(/PNG/)
  })

  // Relecture de sécurité du 13/11/2026 : une conversion qui REJETTE (exception du navigateur) laissait la fenêtre sur
  // « Préparation de l'image… », le champ de fichier désactivé, sans message (rejet non géré).
  it('conversion qui lève (exception du navigateur) : message, champ de fichier de nouveau utilisable, plus de « Préparation »', async () => {
    const avertir = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    conversion.convertirLogoQr.mockRejectedValue(Object.assign(new Error('Tainted canvases may not be exported.'), { name: 'SecurityError' }))
    rendre()
    ouvrir('Autre Exemple')
    choisirFichier()
    expect(await within(fenetre()).findByText(L.erreurs.navigateur)).toBeInTheDocument()
    expect(within(fenetre()).queryByText(L.conversion)).toBeNull()
    expect(within(fenetre()).getByLabelText(L.fichier)).toBeEnabled()
    expect(avertir).toHaveBeenCalledWith('[aj-signalement] logo non préparé', 'SecurityError')
    // Un nouveau choix est possible tout de suite.
    conversion.convertirLogoQr.mockResolvedValue({ ok: true, png: PNG, largeur: 800, hauteur: 296 })
    choisirFichier('logo.png')
    expect(await within(fenetre()).findByRole('img', { name: remplir(L.altApercu, { cabinet: 'Autre Exemple' }) })).toBeInTheDocument()
    expect(within(fenetre()).queryByText(L.erreurs.navigateur)).toBeNull()
    avertir.mockRestore()
  })

  it('refus du serveur (migration à appliquer, 503) : message de l’espace, fenêtre ouverte, rien rechargé', async () => {
    simulerFetch(() => json({ error: 'base_absente' }, 503))
    rendre()
    ouvrir('Autre Exemple')
    choisirFichier()
    await within(fenetre()).findByRole('img', { name: remplir(L.altApercu, { cabinet: 'Autre Exemple' }) })
    fireEvent.click(within(fenetre()).getByRole('button', { name: L.envoyer }))
    expect(await within(fenetre()).findByText(messageEchecQr('base_absente'))).toBeInTheDocument()
    expect(rappels.onModifie).not.toHaveBeenCalled()
  })

  it('retrait : confirmation d’abord (annulable), puis DELETE …/logo ; fenêtre fermée, message, rechargement', async () => {
    simulerFetch(() => json({ logo: null, modifie: true }))
    rendre()
    ouvrir('Cabinet Exemple')
    fireEvent.click(within(fenetre()).getByRole('button', { name: L.retirer }))
    expect(within(fenetre()).getByText(L.confirmerRetrait)).toBeInTheDocument()
    expect(appels).toEqual([])
    fireEvent.click(within(fenetre()).getByRole('button', { name: G.annuler }))
    expect(within(fenetre()).queryByText(L.confirmerRetrait)).toBeNull()
    fireEvent.click(within(fenetre()).getByRole('button', { name: L.retirer }))
    fireEvent.click(within(fenetre()).getByRole('button', { name: L.confirmerRetraitBouton }))
    await waitFor(() => expect(rappels.onModifie).toHaveBeenCalledTimes(1))
    expect(appels).toEqual([{ url: `/api/aj-signalement/cabinets/${K1}/logo`, methode: 'DELETE', corps: null }])
    expect(screen.getByText(L.retire)).toBeInTheDocument()
  })
})

// Relecture de conformité du 13/11/2026 (règle § 7.6, « Tab piégé ») : « Retirer le logo » puis « Annuler » remplacent
// le bouton activé ; le focus tombait sur <body>, hors de la fenêtre, et Tab partait dans le fond de la page.
describe('fenêtre du logo : le focus reste dans la fenêtre quand le bouton activé disparaît', () => {
  const dansLaFenetre = () => fenetre().contains(document.activeElement) && document.activeElement !== document.body

  it('« Retirer le logo » : la question de confirmation prend le focus ; « Annuler » : le focus revient à « Retirer le logo »', async () => {
    rendre()
    ouvrir('Cabinet Exemple')
    const retirer = within(fenetre()).getByRole('button', { name: L.retirer })
    retirer.focus()
    fireEvent.click(retirer)
    await waitFor(() => expect(dansLaFenetre()).toBe(true))
    expect(document.activeElement?.textContent).toContain(L.confirmerRetrait)
    const annuler = within(fenetre()).getByRole('button', { name: G.annuler })
    annuler.focus()
    fireEvent.click(annuler)
    await waitFor(() => expect(document.activeElement).toBe(within(fenetre()).getByRole('button', { name: L.retirer })))
  })

  it('retrait refusé par le serveur : la confirmation disparaît, le focus va au message d’erreur (dans la fenêtre)', async () => {
    simulerFetch(() => json({ error: 'base_absente' }, 503))
    rendre()
    ouvrir('Cabinet Exemple')
    fireEvent.click(within(fenetre()).getByRole('button', { name: L.retirer }))
    const oui = within(fenetre()).getByRole('button', { name: L.confirmerRetraitBouton })
    oui.focus()
    fireEvent.click(oui)
    const message = await within(fenetre()).findByText(messageEchecQr('base_absente'))
    await waitFor(() => expect(dansLaFenetre()).toBe(true))
    expect(message.closest('[tabindex="-1"]')).toBe(document.activeElement)
  })

  it('choix d’un fichier pendant la confirmation : la confirmation se ferme sans déplacer le focus vers « Retirer le logo »', async () => {
    rendre()
    ouvrir('Cabinet Exemple')
    fireEvent.click(within(fenetre()).getByRole('button', { name: L.retirer }))
    const champ = within(fenetre()).getByLabelText(L.fichier)
    champ.focus()
    choisirFichier('logo.png')
    await within(fenetre()).findByRole('img', { name: remplir(L.altApercu, { cabinet: 'Cabinet Exemple' }) })
    expect(document.activeElement).not.toBe(within(fenetre()).getByRole('button', { name: L.retirer }))
  })
})

// Correctif #683 (13/11/2026, « les listes ne se rafraîchissent pas ») appliqué à la fenêtre du logo : l'envoi et le
// retrait attendent la liste des cabinets rechargée (onModifie, promesse) avant de fermer la fenêtre et d'annoncer leur
// succès ; la fenêtre reste occupée jusque-là (aucun second envoi).
describe('fenêtre du logo : succès annoncé avec la liste à jour', () => {
  const differe = () => {
    let tenir: () => void = () => {}
    const promesse = new Promise<void>((r) => { tenir = r })
    return { promesse, tenir }
  }

  it('envoi : la fenêtre reste ouverte et occupée tant que la liste n’est pas relue ; un second clic n’envoie rien', async () => {
    const rechargement = differe()
    rappels.onModifie.mockImplementationOnce(() => rechargement.promesse)
    simulerFetch(() => json({ logo: { version: 'fedcba9876543210', largeur: 800, hauteur: 296 }, modifie: true }))
    rendre()
    ouvrir('Autre Exemple')
    choisirFichier()
    await within(fenetre()).findByRole('img', { name: remplir(L.altApercu, { cabinet: 'Autre Exemple' }) })
    fireEvent.click(within(fenetre()).getByRole('button', { name: L.envoyer }))
    await waitFor(() => expect(rappels.onModifie).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByText(L.enregistre)).toBeNull()
    fireEvent.click(within(fenetre()).getByRole('button', { name: L.envoi }))
    expect(appels.filter((a) => a.methode === 'PUT')).toHaveLength(1)
    rechargement.tenir()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByText(L.enregistre)).toBeInTheDocument()
  })

  it('retrait : le message n’arrive qu’avec la liste relue', async () => {
    const rechargement = differe()
    rappels.onModifie.mockImplementationOnce(() => rechargement.promesse)
    simulerFetch(() => json({ logo: null, modifie: true }))
    rendre()
    ouvrir('Cabinet Exemple')
    fireEvent.click(within(fenetre()).getByRole('button', { name: L.retirer }))
    fireEvent.click(within(fenetre()).getByRole('button', { name: L.confirmerRetraitBouton }))
    await waitFor(() => expect(rappels.onModifie).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByText(L.retire)).toBeNull()
    rechargement.tenir()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByText(L.retire)).toBeInTheDocument()
  })
})
