// tests/components/aj-signalement/affiche-logo-indecodable.test.tsx
//
// Relecture de sécurité du 13/11/2026 : carte d'une copropriété avec le VRAI jsPDF (seul le téléchargement est simulé).
// Le logo servi par la route publique avait la forme d'un PNG mais un IDAT qui n'était pas du zlib : jsPDF levait
// (« Error while decompressing the data »), l'affiche n'était jamais téléchargée, pour toutes les copropriétés du
// cabinet. Promesse de la carte : « logo illisible : affiche sans logo et avertissement ».
// Deux défenses, chacune vérifiée ici : la revérification du contenu (analyserPngQr) refuse l'image à la lecture ;
// et si jsPDF échouait malgré tout avec le logo, l'affiche serait refaite sans lui. Images synthétiques.

import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEXTES_TABLEAU_QR as T } from '@/lib/aj-signalement/affichage'
import { TEXTES_GESTION_QR as G } from '@/lib/aj-signalement/affichage-gestion'
import { gestionCoproprieteQrVide, type CoproprieteQr } from '@/lib/aj-signalement/types'
import { pngSynthetique } from '../../helpers/png-synthetique'

const sonner = vi.hoisted(() => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }))
vi.mock('sonner', () => sonner)
vi.mock('@/lib/aj-signalement/qr', async (original) => ({
  ...(await original<typeof import('@/lib/aj-signalement/qr')>()),
  telechargerFichier: vi.fn(),
}))

const qr = await import('@/lib/aj-signalement/qr')
const { default: CarteCoproprieteQr } = await import('@/components/aj-signalement/CarteCoproprieteQr')

const META = { version: '0123456789abcdef', largeur: 64, hauteur: 32 }
const copro: CoproprieteQr = {
  id: 'c0000000-0000-4000-8000-000000000001', nom: 'Résidence Exemple', adresse: '1 rue Exemple', jeton: 'c'.repeat(32),
  emailsDestinataires: [], actif: true, creeLe: '2026-11-01T10:00:00.000Z', nbSignalements: 0, nbEnAttente: 0,
  derniereAdresseProposee: null, ...gestionCoproprieteQrVide(),
  cabinet: { id: 'a0000000-0000-4000-8000-0000000000a1', nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' },
}
/** Forme juste (signature, IHDR, CRC, IEND), IDAT qui n'est pas un flux zlib. */
const INDECODABLE = pngSynthetique(64, 32, { idat: Buffer.from('ceci n est pas du zlib, juste des octets', 'latin1') })

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(INDECODABLE, { status: 200, headers: { 'content-type': 'image/png' } })))
})
afterEach(() => vi.unstubAllGlobals())

describe('affiche d’une copropriété, logo indécodable servi par la route (vrai jsPDF)', () => {
  it('l’affiche est téléchargée sans logo, avec un avertissement ; aucun message d’échec', async () => {
    render(<CarteCoproprieteQr copropriete={copro} origine="https://vitfix.io" onModifier={vi.fn()} logoCabinet={META} />)
    const carte = (await screen.findByRole('heading', { name: 'Résidence Exemple' })).closest('section') as HTMLElement
    const bouton = within(carte).getByRole('button', { name: T.affichePdf })
    await waitFor(() => expect(bouton).toBeEnabled())
    fireEvent.click(bouton)
    await waitFor(() => expect(qr.telechargerFichier).toHaveBeenCalledTimes(1), { timeout: 10_000 })
    const [nom, pdf] = vi.mocked(qr.telechargerFichier).mock.calls[0]
    expect(nom).toBe('affiche-qr-residence-exemple.pdf')
    expect(new TextDecoder('latin1').decode(new Uint8Array(await (pdf as Blob).arrayBuffer()).subarray(0, 5))).toBe('%PDF-')
    expect(sonner.toast.warning).toHaveBeenCalledWith(G.cabinets.logo.afficheSansLogo)
    expect(within(carte).queryByText(T.erreurFichier)).toBeNull()
  }, 20_000)
})
