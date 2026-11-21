// tests/components/btp-ecrans-echec-enregistrement.test.tsx — écrans du BTP pro : un enregistrement qui échoue ne ferme
// plus le formulaire et ne fait plus perdre la saisie (constat donnees-btp-2 de l'audit du 11/11/2026).
//
// Avant : Chantiers, Équipes, Pointage, Retenues de garantie et Sous-traitance fermaient leur fenêtre et vidaient la
// saisie sans regarder le résultat ; le pointage GPS affichait « Pointé » même si rien n'était enregistré ; la compta BTP
// retirait de l'écran un frais fixe dont la suppression avait été refusée. Maintenant : le message d'échec s'affiche
// (toast, via le hook), la fenêtre reste ouverte avec ce qui a été saisi, et rien n'est annoncé comme fait.
//
// Pointage : écran réécrit par le pointage géolocalisé (PR #703, réuni le 17/11/2026). L'ancien bouton GPS « Pointer
// sur … » n'existe plus (le pointage automatique passe par /api/btp/pointage, dont les refus sont testés dans
// tests/components/btp-pointage-ecran.test.tsx) ; la saisie à la main est dans l'onglet Historique du gérant.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Artisan } from '@/lib/types'

vi.mock('@/lib/supabase', () => {
  // Requête Supabase factice : toute chaîne d'appels (from().select().eq()…) se résout en liste vide.
  const requete: unknown = new Proxy(function requeteFactice() {}, {
    get: (_cible, cle) => (cle === 'then' ? (ok: (v: unknown) => void) => ok({ data: [], error: null }) : () => requete),
    apply: () => requete,
  })
  return {
    supabase: {
      from: () => requete,
      auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })) },
    },
  }
})
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/i18n/context', () => ({ useLocale: () => 'fr', useTranslation: () => ({ t: (cle: string) => cle }) }))

import { toast } from 'sonner'
import { ChantiersBTPV2 } from '@/components/dashboard/ChantiersBTPV2'
import EquipesBTPV2 from '@/components/dashboard/EquipesBTPV2'
import { PointageGeoSection } from '@/components/dashboard/PointageGeoSection'
import { RetenuesGarantieSection } from '@/components/dashboard/btp/RetenuesGarantieSection'
import { SousTraitanceDC4Section } from '@/components/dashboard/btp/SousTraitanceDC4Section'
import { ComptaBTPSection } from '@/components/dashboard/ComptaBTPSection'

const CHANTIER = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } })
const REFUS = () => json({ error: 'Les données n\'ont pas pu être enregistrées.' }, 500)

let envois: Array<{ table: string; action: string; data?: Record<string, unknown> }>
let reponseEcriture: () => Response
let lignes: Record<string, unknown[]>

beforeEach(() => {
  envois = []
  vi.mocked(toast.error).mockClear()
  reponseEcriture = REFUS
  lignes = {
    chantiers: [{ id: CHANTIER, titre: 'Villa Dupré', client: 'Mme Dupré', statut: 'En cours', latitude: 43.29, longitude: 5.37, geo_rayon_m: 100 }],
  }
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    // Écran Pointage : gérant sans fiche employé (onglets Pointer, Affectations, Historique).
    if (String(url).startsWith('/api/btp/pointage')) {
      return json({
        gerant: true, rattachement: 'aucun', moi: null, chantiers: [], pointageEnCours: null, pointagesOublies: [], historique: [],
        pointageAutoActive: false, reglageDisponible: true, comptes: {}, affectationIndividuelle: true,
      })
    }
    if (init?.method === 'POST') {
      envois.push(JSON.parse(String(init.body)))
      return reponseEcriture()
    }
    const table = new URL(String(url), 'https://vitfix.io').searchParams.get('table') ?? ''
    if (table === 'settings') return json({ settings: { geo_pointage_enabled: true } })
    return json({ [table]: lignes[table] ?? [] })
  })
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition: (ok: (p: { coords: { latitude: number; longitude: number } }) => void) => { ok({ coords: { latitude: 43.2901, longitude: 5.3701 } }); return 1 },
      clearWatch: vi.fn(),
    },
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Un compte par rendu : le hook garde ses lectures en cache par compte.
let rendus = 0
const nouvelArtisan = () => {
  rendus += 1
  return { id: `fiche-echec-${rendus}`, user_id: `compte-echec-${rendus}`, company_name: 'Société d’essai' } as unknown as Artisan
}

describe('Chantiers', () => {
  async function creerChantier(titre: string) {
    render(<ChantiersBTPV2 artisan={nouvelArtisan()} orgRole="pro_societe" />)
    fireEvent.click(await screen.findByRole('button', { name: '+ Nouveau chantier' }))
    fireEvent.change(screen.getByPlaceholderText('ex: Immeuble R+3 — Gros oeuvre'), { target: { value: titre } })
    fireEvent.click(screen.getByRole('button', { name: /Créer le chantier/ }))
    await waitFor(() => expect(envois).toHaveLength(1))
  }

  it('création refusée : la fenêtre reste ouverte avec le titre saisi, le message s’affiche', async () => {
    await creerChantier('Extension Paradis')
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(screen.getByPlaceholderText('ex: Immeuble R+3 — Gros oeuvre')).toHaveValue('Extension Paradis')
  })

  it('témoin : création réussie, la fenêtre se ferme', async () => {
    reponseEcriture = () => json({ row: { id: 'c-neuf', titre: 'Extension Paradis', statut: 'En attente' } }, 201)
    await creerChantier('Extension Paradis')
    await waitFor(() => expect(screen.queryByPlaceholderText('ex: Immeuble R+3 — Gros oeuvre')).toBeNull())
  })
})

describe('Équipes — membre', () => {
  it('ajout refusé : la fenêtre reste ouverte avec le prénom et le nom saisis', async () => {
    render(<EquipesBTPV2 artisan={nouvelArtisan()} orgRole="pro_societe" />)
    fireEvent.click(await screen.findByRole('button', { name: '+ Membre' }))
    fireEvent.change(screen.getByPlaceholderText('Jean'), { target: { value: 'Paul' } })
    fireEvent.change(screen.getByPlaceholderText('Dupont'), { target: { value: 'Durand' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

    await waitFor(() => expect(envois).toHaveLength(1))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(screen.getByPlaceholderText('Jean')).toHaveValue('Paul')
    expect(screen.getByPlaceholderText('Dupont')).toHaveValue('Durand')
  })
})

describe('Pointage', () => {
  it('pointage manuel refusé : le message s’affiche, le formulaire reste ouvert avec le nom saisi', async () => {
    render(<PointageGeoSection artisan={nouvelArtisan()} orgRole="pro_societe" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Historique' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Pointer manuellement' }))
    // Aucun employé dans Équipes : le nom se saisit librement.
    fireEvent.change(screen.getByLabelText('Employé', { selector: 'input#pointage-employe' }), { target: { value: 'Paul Durand' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(envois).toHaveLength(1))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(screen.getByLabelText('Employé', { selector: 'input#pointage-employe' })).toHaveValue('Paul Durand')
  })
})

describe('Retenues de garantie et sous-traitance', () => {
  it('retenue refusée : le formulaire reste ouvert avec le client saisi', async () => {
    const artisan = nouvelArtisan()
    const { container } = render(<RetenuesGarantieSection userId={artisan.id} orgRole="pro_societe" />)
    fireEvent.click(await screen.findByText('proDash.btp.retenues.nouvelleRetenue'))
    const choixChantier = (await screen.findByRole('option', { name: /Villa Dupré/ })).closest('select')
    if (!choixChantier) throw new Error('liste des chantiers introuvable')
    fireEvent.change(choixChantier, { target: { value: CHANTIER } })
    const champs = container.querySelectorAll('input')
    fireEvent.change(champs[0], { target: { value: 'Mme Dupré (copie)' } })
    fireEvent.change(container.querySelector('input[type="number"]') as Element, { target: { value: '12000' } })
    fireEvent.change(container.querySelector('input[type="date"]') as Element, { target: { value: '2026-12-01' } })
    fireEvent.click(screen.getByText(/proDash\.btp\.retenues\.(creer|ajouter|enregistrer)/))

    await waitFor(() => expect(envois).toHaveLength(1))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(screen.getByText('proDash.btp.retenues.nouvelleRetenueGarantie')).toBeInTheDocument()
    expect(container.querySelectorAll('input')[0]).toHaveValue('Mme Dupré (copie)')
  })

  it('sous-traitant refusé : le formulaire reste ouvert avec l’entreprise saisie', async () => {
    const artisan = nouvelArtisan()
    const { container } = render(<SousTraitanceDC4Section userId={artisan.id} orgRole="pro_societe" />)
    fireEvent.click(await screen.findByRole('button', { name: '+ Nouveau DC4' }))
    const entreprise = container.querySelector('input[type="text"]') as Element
    fireEvent.change(entreprise, { target: { value: 'Plomberie Martin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

    await waitFor(() => expect(envois).toHaveLength(1))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(container.querySelector('input[type="text"]')).toHaveValue('Plomberie Martin')
  })
})

describe('Compta BTP — frais fixes', () => {
  it('suppression refusée : le frais reste affiché et le message s’affiche', async () => {
    lignes.charges_fixes = [{ id: 'f-1', label: 'Loyer du dépôt', montant: 900, frequence: 'mensuel', categorie: 'loyer' }]
    render(<ComptaBTPSection artisan={nouvelArtisan()} orgRole="pro_societe" />)
    fireEvent.click(await screen.findByRole('button', { name: /Frais fixes/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer ce frais' }))

    await waitFor(() => expect(envois).toEqual([{ table: 'charges_fixes', action: 'delete', id: 'f-1' }]))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(screen.getByText('Loyer du dépôt')).toBeInTheDocument()
  })
})
