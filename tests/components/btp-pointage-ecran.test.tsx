// tests/components/btp-pointage-ecran.test.tsx — écran Pointage BTP (components/dashboard/PointageGeoSection.tsx,
// 16/11/2026) : ce que voient l'employé et le gérant, et ce qui part vers /api/btp/pointage et /api/btp.
// Données fictives ; réseau, géocodage et données BTP simulés.

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ContextePointage } from '@/lib/btp/pointage-regles'

const etat = vi.hoisted(() => ({
  locale: 'fr',
  tables: {} as Record<string, unknown[]>,
  updates: [] as Array<{ table: string; id: string; changes: Record<string, unknown> }>,
  ajouts: [] as Array<{ table: string; item: Record<string, unknown> }>,
  geocodage: null as null | { latitude: number; longitude: number; precise: boolean },
  echecEcriture: false,
}))

vi.mock('@/lib/hooks/use-btp-data', () => {
  const vide: unknown[] = []
  return {
    useBTPData: ({ table }: { table: string }) => ({
      items: etat.tables[table] ?? vide,
      loading: false,
      update: async (id: string, changes: Record<string, unknown>) => {
        if (etat.echecEcriture) return false
        etat.updates.push({ table, id, changes })
        return true
      },
      add: async (item: Record<string, unknown>) => { etat.ajouts.push({ table, item }); return { id: 'nouveau', ...item } },
      remove: async () => true,
    }),
  }
})
vi.mock('@/lib/btp/geocodage', async (original) => ({
  ...(await original<typeof import('@/lib/btp/geocodage')>()),
  geocoderAdresse: vi.fn(async () => etat.geocodage),
}))
// Mesure réelle par défaut (fausse géolocalisation ci-dessous) ; un test peut imposer un résultat.
vi.mock('@/components/dashboard/btp/pointage/positionSurPlace', async (original) => {
  const reel = await original<typeof import('@/components/dashboard/btp/pointage/positionSurPlace')>()
  return { ...reel, mesurerPositionSurPlace: vi.fn(reel.mesurerPositionSurPlace) }
})
vi.mock('@/lib/i18n/context', () => ({ useLocale: () => etat.locale, useTranslation: () => ({ t: (c: string) => c }) }))
vi.mock('@/lib/auth/jeton-acces', () => ({ jetonAcces: async () => 'tok' }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

import { toast } from 'sonner'
import { geocoderAdresse } from '@/lib/btp/geocodage'
import { mesurerPositionSurPlace } from '@/components/dashboard/btp/pointage/positionSurPlace'
import { PointageGeoSection } from '@/components/dashboard/PointageGeoSection'

const artisan = { id: 'art-1', user_id: 'soc-a', company_name: 'Société Essai' } as unknown as React.ComponentProps<typeof PointageGeoSection>['artisan']

const CONTEXTE_EMPLOYE: ContextePointage = {
  gerant: false,
  rattachement: 'relie',
  moi: { id: 'm-paul', nom: 'Paul Exemple' },
  chantiers: [
    { id: 'c-villa', titre: 'Villa', adresse: '1 rue des Lilas, 13008 Marseille', latitude: 43.25, longitude: 5.38, rayonM: 150 },
    { id: 'c-garage', titre: 'Garage', adresse: '', latitude: null, longitude: null, rayonM: 100 },
  ],
  pointageEnCours: null,
  pointagesOublies: [],
  historique: [],
  pointageAutoActive: false,
  reglageDisponible: true,
}

let contexte: ContextePointage
let envois: Array<Record<string, unknown>>
let lectures: number

/** Fausse géolocalisation du navigateur : `positionner` envoie une position à la surveillance en cours. */
function installerGeolocalisation() {
  let succes: PositionCallback | null = null
  const geo = {
    watchPosition: vi.fn((rappel: PositionCallback) => { succes = rappel; return 7 }),
    clearWatch: vi.fn(),
    getCurrentPosition: vi.fn(),
  }
  Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true })
  Object.defineProperty(navigator, 'permissions', { value: { query: vi.fn(async () => ({ state: 'granted' })) }, configurable: true })
  const positionner = async (latitude: number, longitude: number) => {
    await act(async () => { succes?.({ coords: { latitude, longitude, accuracy: 10 }, timestamp: Date.now() } as unknown as GeolocationPosition) })
  }
  return { geo, positionner }
}

beforeEach(() => {
  etat.locale = 'fr'
  etat.tables = {}
  etat.updates = []
  etat.ajouts = []
  etat.geocodage = null
  etat.echecEcriture = false
  contexte = structuredClone(CONTEXTE_EMPLOYE)
  envois = []
  lectures = 0
  localStorage.clear()
  Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true })
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (String(url).startsWith('/api/btp/pointage') && init?.method === 'POST') {
      envois.push(JSON.parse(String(init.body)))
      return new Response(JSON.stringify({ pointage: null }), { status: 201 })
    }
    lectures += 1
    return new Response(JSON.stringify(contexte), { status: 200 })
  })
})
afterEach(() => { vi.restoreAllMocks() })

const afficher = async () => {
  const rendu = render(<PointageGeoSection artisan={artisan} orgRole="pro_societe" />)
  // Onglet Pointer chargé : l'information (compte relié) ou l'explication (compte non relié).
  await screen.findAllByText(/ce qui est enregistré|Pointer mes heures/)
  return rendu
}

describe('employé', () => {
  it('voit l’information, ses chantiers, aucun onglet de gestion ; mode automatique non activé par l’employeur', async () => {
    await afficher()
    expect(screen.getByText(/position GPS et la distance au chantier restent sur votre téléphone/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Affectations' })).toBeNull()
    expect(screen.getByText(/Non activé par votre employeur/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Activer le pointage automatique/ })).toBeNull()
    expect(screen.getByText('Villa')).toBeTruthy()
    expect(screen.getByText(/sans position GPS : pointage à la main/)).toBeTruthy()
  })

  it('« Pointer ici » : bouton nommé d’après le chantier ; arrivée à la main sans position ni distance, puis rechargement', async () => {
    await afficher()
    const avant = lectures
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Pointer ici — Garage' })) })
    expect(envois).toEqual([{ action: 'arrivee', chantierId: 'c-garage', mode: 'manuel', fuseau: expect.any(String) }])
    expect(lectures).toBeGreaterThan(avant)
  })

  it('mode automatique activé par l’employeur : bouton d’activation', async () => {
    contexte.pointageAutoActive = true
    await afficher()
    expect((screen.getByRole('button', { name: 'Activer le pointage automatique' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('mode automatique activé mais aucun chantier localisé : activation impossible', async () => {
    contexte.pointageAutoActive = true
    contexte.chantiers = contexte.chantiers.filter(c => c.latitude === null)
    await afficher()
    expect((screen.getByRole('button', { name: 'Activer le pointage automatique' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('pointage commencé à la main : le mode automatique attend qu’il soit terminé à la main', async () => {
    contexte.pointageAutoActive = true
    contexte.pointageEnCours = { id: 'p1', chantierId: 'c-villa', chantierNom: 'Villa', date: '2026-11-16', heureArrivee: '08:30:00', heureDepart: null, heuresTravaillees: 0, mode: 'manuel' }
    await afficher()
    expect(screen.getByText(/Pointage à la main en cours/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Activer le pointage automatique' }) as HTMLButtonElement).disabled).toBe(true)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Terminer le pointage' })) })
    expect(envois).toEqual([{ action: 'depart', mode: 'manuel', fuseau: expect.any(String) }])
  })

  it('mode automatique choisi sur ce téléphone : la localisation reprend à l’ouverture… sauf pendant un pointage à la main', async () => {
    const { geo } = installerGeolocalisation()
    localStorage.setItem('vitfix_btp_pointage_auto', '1')
    contexte.pointageAutoActive = true
    const temoin = await afficher()
    await waitFor(() => expect(geo.watchPosition).toHaveBeenCalledTimes(1))
    temoin.unmount()

    geo.watchPosition.mockClear()
    contexte.pointageEnCours = { id: 'p1', chantierId: 'c-villa', chantierNom: 'Villa', date: '2026-11-16', heureArrivee: '08:30:00', heureDepart: null, heuresTravaillees: 0, mode: 'manuel' }
    await afficher()
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    expect(geo.watchPosition).not.toHaveBeenCalled()
  })

  it('suivi coupé puis téléphone loin du chantier : dernière présence affichée, et envoyée avec « Terminer » pour le gérant', async () => {
    const { positionner } = installerGeolocalisation()
    const derniereVue = Date.now() - 3 * 3_600_000
    localStorage.setItem('vitfix_btp_pointage_auto', '1')
    localStorage.setItem('vitfix_btp_pointage_presence', JSON.stringify({ chantierId: 'c-villa', instant: derniereVue }))
    contexte.pointageAutoActive = true
    contexte.pointageEnCours = { id: 'p1', chantierId: 'c-villa', chantierNom: 'Villa', date: '2026-11-16', heureArrivee: '06:00:00', heureDepart: null, heuresTravaillees: 0, mode: 'geo_auto' }
    await afficher()
    await waitFor(() => expect(navigator.geolocation.watchPosition).toHaveBeenCalled())
    await positionner(43.30, 5.38) // 5,5 km au nord de la villa
    expect(await screen.findByText(/dernière présence vue à/)).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Terminer le pointage' })) })
    expect(envois).toEqual([{ action: 'depart', mode: 'manuel', derniereVue, fuseau: expect.any(String) }])
  })

  it('pointage terminé aujourd’hui sur un chantier : l’écran dit que l’arrivée automatique y attend la sortie de la zone', async () => {
    installerGeolocalisation()
    const d = new Date()
    const jour = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    localStorage.setItem('vitfix_btp_pointage_auto', '1')
    localStorage.setItem('vitfix_btp_pointage_bloque', JSON.stringify({ chantierId: 'c-villa', jour }))
    contexte.pointageAutoActive = true
    await afficher()
    expect(await screen.findByText(/Pointage terminé sur Villa : l’arrivée automatique n’y reprendra qu’après votre sortie/)).toBeTruthy()
  })

  it('« Terminer » refusé (pointage terminé ailleurs, minuit passé page ouverte) : message, puis l’écran est relu', async () => {
    contexte.pointageEnCours = { id: 'p1', chantierId: 'c-villa', chantierNom: 'Villa', date: '2026-11-16', heureArrivee: '08:30:00', heureDepart: null, heuresTravaillees: 0, mode: 'manuel' }
    vi.mocked(globalThis.fetch).mockImplementation(async (_url, init) => {
      if (init?.method === 'POST') return new Response(JSON.stringify({ error: 'aucun_pointage_en_cours' }), { status: 404 })
      lectures += 1
      return new Response(JSON.stringify(contexte), { status: 200 })
    })
    await afficher()
    const avant = lectures
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Terminer le pointage' })) })
    expect(toast.error).toHaveBeenCalledWith('Aucun pointage en cours.')
    expect(lectures).toBeGreaterThan(avant)
  })

  it('départ oublié un jour précédent : signalé, à régulariser par le responsable', async () => {
    contexte.pointagesOublies = [{ id: 'p0', chantierId: 'c-villa', chantierNom: 'Villa', date: '2026-11-13', heureArrivee: '08:00:00', heureDepart: null, heuresTravaillees: 0, mode: 'geo_auto' }]
    await afficher()
    expect(screen.getByText(/Départ non pointé le .*Villa.*votre responsable les régularisera/)).toBeTruthy()
  })

  it('compte non relié à une fiche : explication, rien à pointer', async () => {
    contexte = { ...contexte, rattachement: 'aucun', moi: null, chantiers: [] }
    render(<PointageGeoSection artisan={artisan} orgRole="pro_societe" />)
    expect(await screen.findByText(/n’est relié à aucune fiche employé/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Pointer ici/ })).toBeNull()
  })

  it('en portugais', async () => {
    etat.locale = 'pt'
    render(<PointageGeoSection artisan={artisan} orgRole="pro_societe" />)
    expect(await screen.findByText(/o que é registado/)).toBeTruthy()
    expect(screen.getByText(/O registo automático não foi ativado pela sua entidade empregadora/)).toBeTruthy()
  })
})

describe('gérant — affectations', () => {
  beforeEach(() => {
    contexte = {
      ...structuredClone(CONTEXTE_EMPLOYE), gerant: true, rattachement: 'aucun', moi: null, chantiers: [],
      comptes: { 'm-paul': 'actif', 'm-jean': 'invitation' }, affectationIndividuelle: true,
    }
    etat.tables = {
      chantiers: [
        { id: 'c-villa', titre: 'Villa', statut: 'En cours', adresse: '1 rue des Lilas', codePostal: '13008', ville: 'Marseille', latitude: 43.25, longitude: 5.38, geoRayonM: 150, membres_ids: [] },
        { id: 'c-immeuble', titre: 'Immeuble', statut: 'En cours', adresse: '5 avenue du Port', ville: 'Marseille', latitude: null, longitude: null, geoRayonM: 100, membres_ids: [] },
        { id: 'c-fini', titre: 'Fini', statut: 'Terminé', membres_ids: [] },
      ],
      membres: [
        { id: 'm-paul', prenom: 'Paul', nom: 'Exemple', actif: true },
        { id: 'm-jean', prenom: 'Jean', nom: 'Test', actif: true },
        { id: 'm-ancien', prenom: 'Ancien', nom: 'Salarié', actif: false },
      ],
      equipes: [{ id: 'e-macons', nom: 'Maçons', chantierId: 'c-immeuble' }],
    }
  })

  const ouvrirAffectations = async () => {
    await afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Affectations' }))
  }
  const carte = (titre: string) => screen.getByText(titre).closest('.v5-card') as HTMLElement

  it('activer le pointage automatique exige de confirmer l’information des salariés, puis passe par la route', async () => {
    await ouvrirAffectations()
    expect(screen.getByText(/Consultez le CSE/)).toBeTruthy()
    const activer = screen.getByRole('button', { name: 'Activer pour ma société' }) as HTMLButtonElement
    expect(activer.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText(/J’ai informé mes salariés/))
    await act(async () => { fireEvent.click(activer) })
    expect(envois).toEqual([{ action: 'reglage_auto', actif: true, confirmation: true, fuseau: expect.any(String) }])
    expect(toast.success).toHaveBeenCalledWith('Pointage automatique activé')
  })

  it('activation refusée par le serveur : l’erreur est affichée', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (_url, init) => (init?.method === 'POST'
      ? new Response(JSON.stringify({ error: 'migration_requise' }), { status: 409 })
      : new Response(JSON.stringify(contexte), { status: 200 })))
    await ouvrirAffectations()
    fireEvent.click(screen.getByLabelText(/J’ai informé mes salariés/))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Activer pour ma société' })) })
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('mise à jour de la base'))
  })

  it('migration non appliquée : interrupteur indisponible, employés non affectables un par un, équipes toujours', async () => {
    contexte.reglageDisponible = false
    contexte.affectationIndividuelle = false
    await ouvrirAffectations()
    expect(screen.queryByRole('button', { name: 'Activer pour ma société' })).toBeNull()
    // Interrupteur et affectation individuelle : les deux le disent.
    expect(screen.getAllByText(/disponible après la mise à jour de la base/i)).toHaveLength(2)
    expect((within(carte('Villa')).getByLabelText(/Paul Exemple/) as HTMLInputElement).disabled).toBe(true)
    expect((within(carte('Villa')).getByLabelText(/Maçons/) as HTMLInputElement).disabled).toBe(false)
  })

  it('chantiers en cours seulement, employés actifs avec l’état de leur compte, position à vérifier sur la carte', async () => {
    await ouvrirAffectations()
    expect(screen.queryByText('Fini')).toBeNull()
    expect(screen.queryByText(/Ancien Salarié/)).toBeNull()
    const villa = carte('Villa')
    expect(within(villa).getByText('Compte actif')).toBeTruthy()
    expect(within(villa).getByText('Invitation envoyée')).toBeTruthy()
    expect(within(villa).getByText(/actuellement sur « Immeuble »/)).toBeTruthy()
    const lien = within(villa).getByRole('link', { name: 'Voir sur la carte — Villa' }) as HTMLAnchorElement
    expect(lien.href).toContain('openstreetmap.org/?mlat=43.25&mlon=5.38')
    expect(within(villa).getByRole('button', { name: 'Relocaliser l’adresse' })).toBeTruthy()
  })

  it('enregistrer : employés et rayon sur le chantier, équipe déplacée vers lui', async () => {
    await ouvrirAffectations()
    const villa = carte('Villa')
    fireEvent.click(within(villa).getByLabelText(/Paul Exemple/))
    fireEvent.click(within(villa).getByLabelText(/Maçons/))
    fireEvent.change(within(villa).getByLabelText(/^Rayon/), { target: { value: '300' } })
    await act(async () => { fireEvent.click(within(villa).getByRole('button', { name: 'Enregistrer' })) })
    expect(etat.updates).toEqual([
      { table: 'chantiers', id: 'c-villa', changes: { geoRayonM: 300, membres_ids: ['m-paul'] } },
      { table: 'equipes', id: 'e-macons', changes: { chantierId: 'c-villa' } },
    ])
  })

  it('localiser : adresse complète géocodée ; une position seulement approximative (centre de la commune) est refusée', async () => {
    etat.geocodage = { latitude: 43.29, longitude: 5.37, precise: false }
    await ouvrirAffectations()
    await act(async () => { fireEvent.click(within(carte('Immeuble')).getByRole('button', { name: 'Localiser l’adresse' })) })
    expect(geocoderAdresse).toHaveBeenLastCalledWith(expect.objectContaining({ adresse: '5 avenue du Port', ville: 'Marseille' }), 'FR')
    expect(etat.updates).toEqual([])
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('indiquez le numéro, la rue et le code postal'))

    etat.geocodage = { latitude: 43.301, longitude: 5.365, precise: true }
    await act(async () => { fireEvent.click(within(carte('Immeuble')).getByRole('button', { name: 'Localiser l’adresse' })) })
    expect(etat.updates).toEqual([{ table: 'chantiers', id: 'c-immeuble', changes: { latitude: 43.301, longitude: 5.365 } }])
  })

  const placer = async (titre: string) => {
    await act(async () => { fireEvent.click(within(carte(titre)).getByRole('button', { name: `Placer à ma position actuelle — ${titre}` })) })
  }
  const boutonDe = (titre: string, nom: string) => within(carte(titre)).getByRole('button', { name: nom }) as HTMLButtonElement

  it('placer à ma position actuelle : mesure annoncée, confirmation avec l’écart, position au millionième, contexte relu', async () => {
    const { geo, positionner } = installerGeolocalisation()
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await ouvrirAffectations()
    await placer('Villa')
    // Pendant la mesure : le bouton et l'annonce le disent ; ni seconde mesure ni autre action sur ce chantier.
    const enCours = boutonDe('Villa', 'Mesure de la position… — Villa')
    expect(enCours.getAttribute('aria-busy')).toBe('true')
    expect(enCours.disabled).toBe(true)
    expect(screen.getByText('Mesure de la position du chantier « Villa » : restez immobile quelques secondes.')).toBeTruthy()
    expect(boutonDe('Immeuble', 'Placer à ma position actuelle — Immeuble').disabled).toBe(true)
    expect(boutonDe('Villa', 'Relocaliser l’adresse').disabled).toBe(true)
    // Une action finie sur un autre chantier ne libère pas celui qui est mesuré.
    await act(async () => { fireEvent.click(boutonDe('Immeuble', 'Localiser l’adresse')) })
    expect(boutonDe('Villa', 'Relocaliser l’adresse').disabled).toBe(true)
    expect(boutonDe('Villa', 'Mesure de la position… — Villa').disabled).toBe(true)
    expect(geo.watchPosition).toHaveBeenCalledTimes(1)
    const lecturesAvant = lectures
    await positionner(43.2512345678, 5.3801234567)
    await waitFor(() => expect(etat.updates).toHaveLength(1))
    expect(etat.updates).toEqual([{ table: 'chantiers', id: 'c-villa', changes: { latitude: 43.251235, longitude: 5.380123 } }])
    const question = String(confirmer.mock.calls[0][0])
    expect(question).toContain('Placer le chantier « Villa » à votre position actuelle (précision ± 10 m) ?')
    expect(question).toContain('Faites-le sur le chantier, là où les employés travaillent')
    expect(question).toMatch(/C’est à 1\d\d m de la position enregistrée jusqu’ici\./)
    expect(question).not.toContain('Attention')
    expect(geo.clearWatch).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Position du chantier placée ici (± 10 m)')
    await waitFor(() => expect(lectures).toBeGreaterThan(lecturesAvant))
    expect(boutonDe('Villa', 'Placer à ma position actuelle — Villa').disabled).toBe(false)
    expect(screen.queryByText(/Mesure de la position du chantier/)).toBeNull()
  })

  it('chantier sans position : son adresse géocodée sert de repère ; loin, la confirmation alerte', async () => {
    const { positionner } = installerGeolocalisation()
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValue(false)
    etat.geocodage = { latitude: 43.301, longitude: 5.365, precise: true }
    await ouvrirAffectations()
    await placer('Immeuble')
    await positionner(43.4, 5.45)
    await waitFor(() => expect(confirmer).toHaveBeenCalledTimes(1))
    expect(geocoderAdresse).toHaveBeenLastCalledWith(expect.objectContaining({ adresse: '5 avenue du Port', ville: 'Marseille' }), 'FR')
    expect(String(confirmer.mock.calls[0][0])).toMatch(/Attention : vous êtes à 1\d km de l’adresse du chantier\. Êtes-vous bien sur ce chantier \?/)
    expect(etat.updates).toEqual([])
  })

  it('écriture refusée : l’erreur est affichée, rien n’est annoncé comme fait', async () => {
    const { positionner } = installerGeolocalisation()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    etat.echecEcriture = true
    await ouvrirAffectations()
    await placer('Villa')
    await positionner(43.2512, 5.3801)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('La position n’a pas été enregistrée.'))
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('onglet quitté pendant la mesure : surveillance arrêtée, ni question ni écriture', async () => {
    const { geo, positionner } = installerGeolocalisation()
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await ouvrirAffectations()
    await placer('Villa')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Historique' })) })
    expect(geo.clearWatch).toHaveBeenCalled()
    await positionner(43.2512, 5.3801)
    expect(confirmer).not.toHaveBeenCalled()
    expect(etat.updates).toEqual([])
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('relocaliser l’adresse d’un chantier qui a déjà une position : confirmation d’abord ; refusée, rien ne change', async () => {
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValue(false)
    etat.geocodage = { latitude: 43.2505, longitude: 5.3805, precise: true }
    await ouvrirAffectations()
    vi.mocked(geocoderAdresse).mockClear()
    await act(async () => { fireEvent.click(boutonDe('Villa', 'Relocaliser l’adresse')) })
    expect(String(confirmer.mock.calls[0][0])).toBe('Remplacer la position actuelle du chantier « Villa » par celle de son adresse ? Une position placée sur place serait perdue.')
    expect(geocoderAdresse).not.toHaveBeenCalled()
    expect(etat.updates).toEqual([])
    confirmer.mockReturnValue(true)
    await act(async () => { fireEvent.click(boutonDe('Villa', 'Relocaliser l’adresse')) })
    expect(etat.updates).toEqual([{ table: 'chantiers', id: 'c-villa', changes: { latitude: 43.2505, longitude: 5.3805 } }])
  })

  it('loin de la position enregistrée : la confirmation alerte ; refusée, rien n’est enregistré', async () => {
    const { positionner } = installerGeolocalisation()
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await ouvrirAffectations()
    await placer('Villa')
    await positionner(43.3, 5.4)
    await waitFor(() => expect(confirmer).toHaveBeenCalledTimes(1))
    expect(String(confirmer.mock.calls[0][0])).toContain('Attention : vous êtes à 5,8 km de la position enregistrée du chantier. Êtes-vous bien sur ce chantier ?')
    expect(etat.updates).toEqual([])
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('chantier sans position, adresse seulement approximative (centre de la commune) : placé sans écart à annoncer', async () => {
    const { positionner } = installerGeolocalisation()
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValue(true)
    etat.geocodage = { latitude: 43.29, longitude: 5.37, precise: false }
    await ouvrirAffectations()
    await placer('Immeuble')
    await positionner(43.301, 5.365)
    await waitFor(() => expect(etat.updates).toHaveLength(1))
    expect(String(confirmer.mock.calls[0][0])).not.toMatch(/C’est à|Vous êtes à|Attention/)
    expect(etat.updates).toEqual([{ table: 'chantiers', id: 'c-immeuble', changes: { latitude: 43.301, longitude: 5.365 } }])
  })

  it('mesure impossible : la raison est affichée, rien n’est demandé ni enregistré', async () => {
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await ouvrirAffectations()
    const cas: Array<[Awaited<ReturnType<typeof mesurerPositionSurPlace>>, string]> = [
      [{ ok: false, raison: 'imprecise', precisionM: 48.4 }, 'Position trop imprécise (± 48 m ; il faut ± 25 m au plus) : mettez-vous à découvert sur le chantier et réessayez.'],
      [{ ok: false, raison: 'imprecise', precisionM: 3200 }, 'Le téléphone ne donne qu’une position approximative (± 3,2 km) : autorisez la position exacte pour ce navigateur dans les réglages du téléphone, puis réessayez.'],
      [{ ok: false, raison: 'refusee' }, 'Localisation refusée : autorisez-la pour ce site dans les réglages du navigateur, puis réessayez.'],
      [{ ok: false, raison: 'introuvable' }, 'Position introuvable : mettez-vous à l’extérieur, sur le chantier, et réessayez.'],
      [{ ok: false, raison: 'indisponible' }, 'Ce navigateur ne donne pas la position : ouvrez cette page sur votre téléphone, sur le chantier.'],
    ]
    for (const [resultat, message] of cas) {
      vi.mocked(mesurerPositionSurPlace).mockResolvedValueOnce(resultat)
      await placer('Villa')
      expect(toast.error).toHaveBeenLastCalledWith(message)
    }
    expect(confirmer).not.toHaveBeenCalled()
    expect(etat.updates).toEqual([])
  })
})

describe('gérant — historique', () => {
  beforeEach(() => {
    contexte = { ...structuredClone(CONTEXTE_EMPLOYE), gerant: true, rattachement: 'aucun', moi: null, chantiers: [] }
  })

  it('pointage saisi à la main : l’employé et le chantier choisis partent avec leurs identifiants', async () => {
    etat.tables = {
      pointages: [],
      chantiers: [{ id: 'c-villa', titre: 'Villa', statut: 'En cours' }],
      membres: [{ id: 'm-paul', prenom: 'Paul', nom: 'Exemple', actif: true, typeCompte: 'ouvrier' }],
    }
    await afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Historique' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pointer manuellement' }))
    fireEvent.change(screen.getByLabelText('Employé', { selector: 'select#pointage-employe' }), { target: { value: 'm-paul' } })
    fireEvent.change(screen.getByLabelText('Chantier', { selector: 'select#pointage-chantier' }), { target: { value: 'c-villa' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' })) })
    expect(etat.ajouts).toEqual([{
      table: 'pointages',
      item: expect.objectContaining({ employe: 'Paul Exemple', membreId: 'm-paul', chantier: 'Villa', chantierId: 'c-villa', heuresTravaillees: 8 }),
    }])
  })

  it('départ non pointé un jour précédent et pointage refermé sans heures : signalés au gérant', async () => {
    etat.tables = {
      pointages: [
        { id: 'p1', employe: 'Paul Exemple', chantier: 'Villa', date: '2026-01-05', heureArrivee: '08:00:00', heureDepart: '', heuresTravaillees: 0, mode: 'geo_auto' },
        { id: 'p2', employe: 'Jean Test', chantier: 'Villa', date: '2026-01-05', heureArrivee: '08:00:00', heureDepart: '08:00:00', heuresTravaillees: 0, mode: 'geo_auto', notes: 'Départ non pointé : à régulariser.' },
      ],
      chantiers: [],
      membres: [],
    }
    await afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Historique' }))
    fireEvent.click(screen.getByRole('button', { name: 'Voir tout' }))
    expect(screen.getByText('Départ non pointé')).toBeTruthy()
    expect(screen.getByText('À régulariser')).toBeTruthy()
  })

  it('départ pointé à la main après une coupure du suivi GPS : « À vérifier », la note donne la dernière présence', async () => {
    const note = 'Départ pointé à la main après une coupure du suivi GPS ; dernière présence vue sur le chantier à 09:05 : à vérifier.'
    etat.tables = {
      pointages: [{ id: 'p1', employe: 'Paul Exemple', chantier: 'Villa', date: '2026-01-05', heureArrivee: '08:30:00', heureDepart: '13:00:00', heuresTravaillees: 4.5, mode: 'geo_auto', notes: note }],
      chantiers: [],
      membres: [],
    }
    await afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Historique' }))
    fireEvent.click(screen.getByRole('button', { name: 'Voir tout' }))
    expect(screen.getByText('À vérifier').getAttribute('title')).toBe(note)
  })
})
