// tests/components/btp-fiche-chantier-gps.test.tsx — bouton GPS de la fiche chantier (components/dashboard/ChantiersBTPV2.tsx,
// 16/11/2026). Le bouton géocodait « ville || adresse » : la ville seule donnait le centre de la commune, et le pointage
// automatique se déclenchait au mauvais endroit. Il géocode maintenant l'adresse (rue, code postal, ville), refuse une
// position seulement approximative et ne garde jamais la position d'une ancienne adresse. Réseau, géocodage et données
// BTP simulés ; adresse fictive.

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

type PositionAdresse = { latitude: number; longitude: number; precise: boolean }

const etat = vi.hoisted(() => ({
  geocodage: null as null | { latitude: number; longitude: number; precise: boolean },
  /** Réponse retenue du géocodage (requête lente) : résolue par le test. */
  geocodageEnAttente: null as null | Promise<{ latitude: number; longitude: number; precise: boolean } | null>,
  chantiers: [] as unknown[],
  modifications: [] as Array<{ id: string; changes: Record<string, unknown> }>,
  ajouts: [] as Array<Record<string, unknown>>,
}))

// Comme les vrais hooks (état React), les simulations rendent les mêmes objets d'un rendu à l'autre : des objets neufs
// à chaque rendu relanceraient sans fin les effets de la fiche.
vi.mock('@/lib/hooks/use-btp-data', () => {
  const donnees = {
    items: [] as unknown[],
    loading: false,
    add: async (item: Record<string, unknown>) => { etat.ajouts.push(item); return null },
    update: async (id: string, changes: Record<string, unknown>) => { etat.modifications.push({ id, changes }); return true },
    remove: async () => true,
  }
  const reglages = { settings: { country: 'FR', company_type: 'sarl', cout_horaire_ouvrier: 22, charges_patronales_pct: 45, objectif_marge_pct: 20 } }
  return { useBTPData: () => { donnees.items = etat.chantiers; return donnees }, useBTPSettings: () => reglages }
})
vi.mock('@/lib/btp/geocodage', async (original) => ({
  ...(await original<typeof import('@/lib/btp/geocodage')>()),
  geocoderAdresse: vi.fn(async () => (etat.geocodageEnAttente ?? etat.geocodage)),
}))
vi.mock('@/lib/supabase', () => {
  const chaine: Record<string, unknown> = {}
  for (const methode of ['select', 'eq', 'is', 'in', 'not', 'order', 'limit']) chaine[methode] = () => chaine
  chaine.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok)
  return { supabase: { from: () => chaine, auth: { getSession: async () => ({ data: { session: null } }) } } }
})
vi.mock('@/lib/i18n/context', () => ({ useLocale: () => 'fr', useTranslation: () => ({ t: (c: string) => c }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

import { toast } from 'sonner'
import { geocoderAdresse } from '@/lib/btp/geocodage'
import { ChantiersBTPV2 } from '@/components/dashboard/ChantiersBTPV2'

const artisan = { id: 'art-1', user_id: 'soc-a' } as unknown as React.ComponentProps<typeof ChantiersBTPV2>['artisan']

/** Géocodage lent : la réponse n'arrive qu'à l'appel de `repondre`. */
function geocodageLent() {
  let repondre: (position: PositionAdresse | null) => void = () => undefined
  etat.geocodageEnAttente = new Promise(resolve => { repondre = resolve })
  return async (position: PositionAdresse | null) => { await act(async () => { repondre(position) }) }
}

beforeEach(() => {
  etat.geocodage = null
  etat.geocodageEnAttente = null
  etat.chantiers = []
  etat.modifications = []
  etat.ajouts = []
  vi.mocked(toast.warning).mockClear()
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ membres: [] })))
})
afterEach(() => { vi.restoreAllMocks() })

const ouvrirFiche = async () => {
  render(<ChantiersBTPV2 artisan={artisan} orgRole="pro_societe" />)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Nouveau chantier/ })) })
  fireEvent.change(screen.getByPlaceholderText('N°, rue...'), { target: { value: '1 rue des Lilas' } })
  fireEvent.change(screen.getByPlaceholderText('13001'), { target: { value: '13008' } })
  fireEvent.change(screen.getByPlaceholderText('Marseille, Lyon...'), { target: { value: 'Marseille' } })
}

// Le bouton GPS, à côté de la ville : une fois la position trouvée, il n'affiche plus que des icônes.
const boutonGps = () => within(screen.getByPlaceholderText('Marseille, Lyon...').parentElement as HTMLElement).getByRole('button')
const cliquerGps = async () => { await act(async () => { fireEvent.click(boutonGps()) }) }

describe('fiche chantier — bouton GPS', () => {
  it('géocode l’adresse (rue, code postal, ville) ; une position seulement approximative est refusée, avec un avertissement', async () => {
    etat.geocodage = { latitude: 43.29, longitude: 5.37, precise: false }
    await ouvrirFiche()
    await cliquerGps()
    expect(geocoderAdresse).toHaveBeenLastCalledWith(expect.objectContaining({ adresse: '1 rue des Lilas', codePostal: '13008', ville: 'Marseille' }), 'FR')
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('indiquez le numéro, la rue et le code postal'))
    expect(screen.queryByText(/GPS : /)).toBeNull()
  })

  it('position précise : enregistrée dans la fiche', async () => {
    etat.geocodage = { latitude: 43.25, longitude: 5.38, precise: true }
    await ouvrirFiche()
    await cliquerGps()
    expect(screen.getByText(/GPS : 43\.25000, 5\.38000/)).toBeTruthy()
  })

  it('jamais une position périmée : adresse modifiée, ou nouveau géocodage trop vague → l’ancienne position est retirée', async () => {
    etat.geocodage = { latitude: 43.25, longitude: 5.38, precise: true }
    await ouvrirFiche()
    await cliquerGps()
    fireEvent.change(screen.getByPlaceholderText('N°, rue...'), { target: { value: '9 rue des Lilas' } })
    expect(screen.queryByText(/GPS : /)).toBeNull()

    await cliquerGps()
    expect(screen.getByText(/GPS : 43\.25000/)).toBeTruthy()
    etat.geocodage = { latitude: 43.29, longitude: 5.37, precise: false }
    await cliquerGps()
    expect(screen.queryByText(/GPS : /)).toBeNull()
  })

  it('service injoignable (aucune réponse) : la position gardée correspond à l’adresse inchangée, avertissement', async () => {
    etat.geocodage = { latitude: 43.25, longitude: 5.38, precise: true }
    await ouvrirFiche()
    await cliquerGps()
    etat.geocodage = null
    await cliquerGps()
    expect(screen.getByText(/GPS : 43\.25000, 5\.38000/)).toBeTruthy()
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('position GPS non mise à jour'))
  })

  it('nouveau chantier : toute la fiche part à la création', async () => {
    await ouvrirFiche()
    fireEvent.change(screen.getByPlaceholderText('ex: Immeuble R+3 — Gros oeuvre'), { target: { value: 'Garage' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Créer le chantier/ })) })
    expect(etat.ajouts).toHaveLength(1)
    expect(etat.ajouts[0]).toMatchObject({ titre: 'Garage', adresse: '1 rue des Lilas', codePostal: '13008', ville: 'Marseille', geoRayonM: 100 })
  })

  it('réponse du géocodage arrivée après une retouche de l’adresse : ignorée (jamais la position de l’ancienne adresse)', async () => {
    await ouvrirFiche()
    const repondre = geocodageLent()
    await cliquerGps()
    fireEvent.change(screen.getByPlaceholderText('N°, rue...'), { target: { value: '9 rue des Lilas' } })
    await repondre({ latitude: 43.25, longitude: 5.38, precise: true })
    expect(screen.queryByText(/GPS : /)).toBeNull()
    expect((boutonGps() as HTMLButtonElement).disabled).toBe(false)
  })

  it('réponse arrivée après l’enregistrement, dans une autre fiche ouverte : ignorée', async () => {
    await ouvrirFiche()
    fireEvent.change(screen.getByPlaceholderText('ex: Immeuble R+3 — Gros oeuvre'), { target: { value: 'Garage' } })
    const repondre = geocodageLent()
    await cliquerGps()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Créer le chantier/ })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Nouveau chantier/ })) })
    await repondre({ latitude: 43.25, longitude: 5.38, precise: true })
    expect(screen.queryByText(/GPS : /)).toBeNull()
    expect(etat.ajouts).toHaveLength(1)
    expect(etat.ajouts[0]).toMatchObject({ latitude: null, longitude: null })
  })
})

// Chantier déjà enregistré, peut-être placé sur place (« Placer à ma position actuelle », onglet Affectations).
const VILLA = {
  id: 'c-villa', titre: 'Villa', client: 'Client fictif', adresse: '1 rue des Lilas', ville: 'Marseille', codePostal: '13008',
  dateDebut: '2026-11-01', dateFin: '2026-12-15', budget: '12000', statut: 'En cours', description: '', equipe: '',
  latitude: 43.2504, longitude: 5.3801, geoRayonM: 50, devis_id: null, membres_ids: ['m-paul'],
}

const modifier = async (chantier: Record<string, unknown> = VILLA) => {
  etat.chantiers = [chantier]
  render(<ChantiersBTPV2 artisan={artisan} orgRole="pro_societe" />)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Modifier' })) })
}
const enregistrer = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ })) }) }

describe('fiche chantier — modification d’un chantier existant', () => {
  it('seuls les champs modifiés partent : une fiche ouverte avant un placement sur place ne remet ni la position, ni le rayon, ni les employés', async () => {
    await modifier()
    fireEvent.change(screen.getByPlaceholderText('ex: Immeuble R+3 — Gros oeuvre'), { target: { value: 'Villa rénovée' } })
    await enregistrer()
    expect(etat.modifications).toEqual([{ id: 'c-villa', changes: { titre: 'Villa rénovée' } }])
  })

  it('rien de modifié : rien n’est envoyé', async () => {
    await modifier()
    await enregistrer()
    expect(etat.modifications).toEqual([])
  })

  it('adresse corrigée : la position enregistrée reste affichée ; « OK » la garde, seule l’adresse part', async () => {
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await modifier()
    fireEvent.change(screen.getByPlaceholderText('13001'), { target: { value: '13009' } })
    expect(screen.getByText(/GPS : 43\.25040, 5\.38010/)).toBeTruthy()
    await enregistrer()
    expect(confirmer).toHaveBeenCalledTimes(1)
    expect(String(confirmer.mock.calls[0][0])).toContain('L’adresse du chantier « Villa » a changé.')
    expect(String(confirmer.mock.calls[0][0])).toContain('OK : garder la position (adresse corrigée).')
    expect(etat.modifications).toEqual([{ id: 'c-villa', changes: { codePostal: '13009' } }])
  })

  it('adresse corrigée, retrait confirmé par un second OK : la position est retirée avec la nouvelle adresse', async () => {
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    await modifier()
    fireEvent.change(screen.getByPlaceholderText('Marseille, Lyon...'), { target: { value: 'Aubagne' } })
    await enregistrer()
    expect(confirmer).toHaveBeenCalledTimes(2)
    expect(String(confirmer.mock.calls[1][0])).toContain('Retirer la position GPS du chantier « Villa » (le chantier a changé d’endroit) ?')
    expect(String(confirmer.mock.calls[1][0])).toContain('écran Pointage équipes, onglet Affectations')
    expect(etat.modifications).toEqual([{ id: 'c-villa', changes: { ville: 'Aubagne', latitude: null, longitude: null } }])
  })

  it('adresse corrigée, les deux boîtes fermées (Échap, Retour) : rien n’est enregistré, la fiche reste ouverte', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await modifier()
    fireEvent.change(screen.getByPlaceholderText('Marseille, Lyon...'), { target: { value: 'Aubagne' } })
    await enregistrer()
    expect(etat.modifications).toEqual([])
    expect(screen.getByRole('button', { name: /Enregistrer/ })).toBeTruthy()
    expect(screen.getByText(/GPS : 43\.25040, 5\.38010/)).toBeTruthy()
  })

  it('adresse identique aux espaces et majuscules près : aucune question', async () => {
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await modifier()
    fireEvent.change(screen.getByPlaceholderText('Marseille, Lyon...'), { target: { value: ' MARSEILLE ' } })
    await enregistrer()
    expect(confirmer).not.toHaveBeenCalled()
    expect(etat.modifications).toEqual([{ id: 'c-villa', changes: { ville: ' MARSEILLE ' } }])
  })

  it('adresse corrigée puis bouton GPS : remplacer la position enregistrée se confirme ; la nouvelle part, sans autre question', async () => {
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValue(true)
    etat.geocodage = { latitude: 43.26, longitude: 5.39, precise: true }
    await modifier()
    fireEvent.change(screen.getByPlaceholderText('N°, rue...'), { target: { value: '3 rue des Lilas' } })
    await cliquerGps()
    await enregistrer()
    expect(confirmer).toHaveBeenCalledTimes(1)
    expect(String(confirmer.mock.calls[0][0])).toBe('Remplacer la position actuelle du chantier « Villa » par celle de son adresse ? Une position placée sur place serait perdue.')
    expect(etat.modifications).toEqual([{ id: 'c-villa', changes: { adresse: '3 rue des Lilas', latitude: 43.26, longitude: 5.39 } }])
  })

  it('bouton GPS refusé : ni géocodage ni changement de position', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    etat.geocodage = { latitude: 43.26, longitude: 5.39, precise: true }
    await modifier()
    vi.mocked(geocoderAdresse).mockClear()
    await cliquerGps()
    expect(geocoderAdresse).not.toHaveBeenCalled()
    expect(screen.getByText(/GPS : 43\.25040, 5\.38010/)).toBeTruthy()
  })

  it('bouton GPS, adresse trop vague : la position enregistrée est gardée, avec un avertissement', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    etat.geocodage = { latitude: 43.29, longitude: 5.37, precise: false }
    await modifier()
    await cliquerGps()
    expect(screen.getByText(/GPS : 43\.25040, 5\.38010/)).toBeTruthy()
    expect(toast.warning).toHaveBeenCalledWith('Adresse trop vague pour le GPS : la position actuelle du chantier est gardée. Indiquez le numéro, la rue et le code postal.')
    await enregistrer()
    expect(etat.modifications).toEqual([])
  })

  it('position recalculée puis adresse retouchée : la position calculée part aussitôt (jamais périmée)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    etat.geocodage = { latitude: 43.26, longitude: 5.39, precise: true }
    await modifier()
    await cliquerGps()
    expect(screen.getByText(/GPS : 43\.26000, 5\.39000/)).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('N°, rue...'), { target: { value: '3 rue des Lilas' } })
    expect(screen.queryByText(/GPS : /)).toBeNull()
  })

  it('géocodage d’une nouvelle fiche encore en cours quand on ouvre un chantier existant : sa réponse ne touche pas ce chantier', async () => {
    etat.chantiers = [VILLA]
    render(<ChantiersBTPV2 artisan={artisan} orgRole="pro_societe" />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Nouveau chantier/ })) })
    fireEvent.change(screen.getByPlaceholderText('N°, rue...'), { target: { value: '7 rue des Pins' } })
    fireEvent.change(screen.getByPlaceholderText('Marseille, Lyon...'), { target: { value: 'Marseille' } })
    const repondre = geocodageLent()
    await cliquerGps()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Modifier' })) })
    await repondre({ latitude: 43.3, longitude: 5.4, precise: true })
    expect(screen.getByText(/GPS : 43\.25040, 5\.38010/)).toBeTruthy()
  })

  it('chantier sans position enregistrée : adresse corrigée sans question', async () => {
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await modifier({ ...VILLA, latitude: null, longitude: null })
    fireEvent.change(screen.getByPlaceholderText('N°, rue...'), { target: { value: '3 rue des Lilas' } })
    await enregistrer()
    expect(confirmer).not.toHaveBeenCalled()
    expect(etat.modifications).toEqual([{ id: 'c-villa', changes: { adresse: '3 rue des Lilas' } }])
  })
})
