// tests/components/btp-pointage-ecran.test.tsx — écran Pointage BTP (components/dashboard/PointageGeoSection.tsx,
// 16/11/2026) : ce que voient l'employé et le gérant, et ce qui part vers /api/btp/pointage et /api/btp.
// Données fictives ; réseau et données BTP simulés.

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ContextePointage } from '@/lib/btp/pointage-regles'

const etat = vi.hoisted(() => ({
  locale: 'fr',
  tables: {} as Record<string, unknown[]>,
  updates: [] as Array<{ table: string; id: string; changes: Record<string, unknown> }>,
  ajouts: [] as Array<{ table: string; item: Record<string, unknown> }>,
  reglages: [] as Array<Record<string, unknown>>,
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
    useBTPSettings: () => ({ save: async (changes: Record<string, unknown>) => { etat.reglages.push(changes) } }),
  }
})
vi.mock('@/lib/i18n/context', () => ({ useLocale: () => etat.locale, useTranslation: () => ({ t: (c: string) => c }) }))
vi.mock('@/lib/auth/jeton-acces', () => ({ jetonAcces: async () => 'tok' }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

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
  historique: [],
  pointageAutoActive: false,
}

let contexte: ContextePointage
let envois: Array<Record<string, unknown>>
let lectures: number

beforeEach(() => {
  etat.locale = 'fr'
  etat.tables = {}
  etat.updates = []
  etat.ajouts = []
  etat.reglages = []
  contexte = structuredClone(CONTEXTE_EMPLOYE)
  envois = []
  lectures = 0
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

  it('« Pointer ici » : arrivée à la main sur ce chantier, sans position ni distance, puis rechargement', async () => {
    await afficher()
    const avant = lectures
    const [, garage] = screen.getAllByRole('button', { name: 'Pointer ici' })
    await act(async () => { fireEvent.click(garage) })
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
        { id: 'c-villa', titre: 'Villa', statut: 'En cours', adresse: '1 rue des Lilas', latitude: 43.25, longitude: 5.38, geoRayonM: 150, membres_ids: [] },
        { id: 'c-immeuble', titre: 'Immeuble', statut: 'En cours', latitude: 43.3, longitude: 5.4, geoRayonM: 100, membres_ids: [] },
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

  it('activer le pointage automatique exige de confirmer l’information des salariés', async () => {
    await ouvrirAffectations()
    expect(screen.getByText(/Consultez le CSE/)).toBeTruthy()
    const activer = screen.getByRole('button', { name: 'Activer pour ma société' }) as HTMLButtonElement
    expect(activer.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText(/J’ai informé mes salariés/))
    await act(async () => { fireEvent.click(activer) })
    expect(etat.reglages).toEqual([{ geo_pointage_enabled: true }])
  })

  it('chantiers en cours seulement, employés actifs avec l’état de leur compte', async () => {
    await ouvrirAffectations()
    expect(screen.queryByText('Fini')).toBeNull()
    expect(screen.queryByText(/Ancien Salarié/)).toBeNull()
    const villa = screen.getByText('Villa').closest('.v5-card') as HTMLElement
    expect(within(villa).getByText('Compte actif')).toBeTruthy()
    expect(within(villa).getByText('Invitation envoyée')).toBeTruthy()
    expect(within(villa).getByText(/actuellement sur « Immeuble »/)).toBeTruthy()
  })

  it('enregistrer : employés et rayon sur le chantier, équipe déplacée vers lui', async () => {
    await ouvrirAffectations()
    const villa = screen.getByText('Villa').closest('.v5-card') as HTMLElement
    fireEvent.click(within(villa).getByLabelText(/Paul Exemple/))
    fireEvent.click(within(villa).getByLabelText(/Maçons/))
    fireEvent.change(within(villa).getByLabelText(/^Rayon/), { target: { value: '300' } })
    await act(async () => { fireEvent.click(within(villa).getByRole('button', { name: 'Enregistrer' })) })
    expect(etat.updates).toEqual([
      { table: 'chantiers', id: 'c-villa', changes: { geoRayonM: 300, membres_ids: ['m-paul'] } },
      { table: 'equipes', id: 'e-macons', changes: { chantierId: 'c-villa' } },
    ])
  })

  it('migration non appliquée : employés non affectables un par un, équipes toujours', async () => {
    contexte.affectationIndividuelle = false
    await ouvrirAffectations()
    expect(screen.getByText(/disponible après la mise à jour de la base/)).toBeTruthy()
    const villa = screen.getByText('Villa').closest('.v5-card') as HTMLElement
    expect((within(villa).getByLabelText(/Paul Exemple/) as HTMLInputElement).disabled).toBe(true)
    expect((within(villa).getByLabelText(/Maçons/) as HTMLInputElement).disabled).toBe(false)
  })
})

describe('gérant — historique', () => {
  it('pointage saisi à la main : l’employé et le chantier choisis partent avec leurs identifiants', async () => {
    contexte = { ...structuredClone(CONTEXTE_EMPLOYE), gerant: true, rattachement: 'aucun', moi: null, chantiers: [] }
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
})
