// tests/components/btp-pointage-ecran.test.tsx — écran Pointage BTP (components/dashboard/PointageGeoSection.tsx,
// 16/11/2026) : ce que voient l'employé et le gérant, et ce qui part vers /api/btp/pointage et /api/btp.
// Données fictives ; réseau, géocodage et données BTP simulés.

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ContextePointage } from '@/lib/btp/pointage-regles'

const etat = vi.hoisted(() => ({
  locale: 'fr',
  tables: {} as Record<string, unknown[]>,
  updates: [] as Array<{ table: string; id: string; changes: Record<string, unknown> }>,
  ajouts: [] as Array<{ table: string; item: Record<string, unknown> }>,
  geocodage: null as null | { latitude: number; longitude: number; precise: boolean },
}))

vi.mock('@/lib/hooks/use-btp-data', () => {
  const vide: unknown[] = []
  return {
    useBTPData: ({ table }: { table: string }) => ({
      items: etat.tables[table] ?? vide,
      loading: false,
      update: async (id: string, changes: Record<string, unknown>) => { etat.updates.push({ table, id, changes }); return true },
      add: async (item: Record<string, unknown>) => { etat.ajouts.push({ table, item }); return { id: 'nouveau', ...item } },
      remove: async () => true,
    }),
  }
})
vi.mock('@/lib/btp/geocodage', async (original) => ({
  ...(await original<typeof import('@/lib/btp/geocodage')>()),
  geocoderAdresse: vi.fn(async () => etat.geocodage),
}))
vi.mock('@/lib/i18n/context', () => ({ useLocale: () => etat.locale, useTranslation: () => ({ t: (c: string) => c }) }))
vi.mock('@/lib/auth/jeton-acces', () => ({ jetonAcces: async () => 'tok' }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

import { toast } from 'sonner'
import { geocoderAdresse } from '@/lib/btp/geocodage'
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

beforeEach(() => {
  etat.locale = 'fr'
  etat.tables = {}
  etat.updates = []
  etat.ajouts = []
  etat.geocodage = null
  contexte = structuredClone(CONTEXTE_EMPLOYE)
  envois = []
  lectures = 0
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
    expect(screen.getByText(/Não ativada pela sua entidade empregadora/)).toBeTruthy()
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
    const lien = within(villa).getByRole('link', { name: /Voir la position de Villa sur la carte/ }) as HTMLAnchorElement
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
    expect(geocoderAdresse).toHaveBeenLastCalledWith('5 avenue du Port Marseille', 'FR')
    expect(etat.updates).toEqual([])
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('indiquez le numéro et la rue'))

    etat.geocodage = { latitude: 43.301, longitude: 5.365, precise: true }
    await act(async () => { fireEvent.click(within(carte('Immeuble')).getByRole('button', { name: 'Localiser l’adresse' })) })
    expect(etat.updates).toEqual([{ table: 'chantiers', id: 'c-immeuble', changes: { latitude: 43.301, longitude: 5.365 } }])
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
})
