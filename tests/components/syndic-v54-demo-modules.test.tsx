// tests/components/syndic-v54-demo-modules.test.tsx
//
// Démo Marseille — modules v54 connectés : priorité et annulation réelles des ordres de service,
// semaine courante du planning, incidents terminés/annulés comptés résolus et SLA non inventé,
// assurance obligatoire FR (multirisque immeuble), « Prochain contrôle » vide.

import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import ModOrdens from '@/components/syndic-dashboard/v54/modules/ModOrdens'
import ModPlaneamento, { datesSemaineCourante } from '@/components/syndic-dashboard/v54/modules/ModPlaneamento'
import ModOcorrencias from '@/components/syndic-dashboard/v54/modules/ModOcorrencias'
import ModSeguroObr from '@/components/syndic-dashboard/v54/modules/ModSeguroObr'
import ModEdificios from '@/components/syndic-dashboard/v54/modules/ModEdificios'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import { V54LocaleProvider } from '@/lib/syndic/v54/i18n'
import type { Immeuble, Mission } from '@/components/syndic-dashboard/types'
import type { Seguro, Signalement } from '@/lib/syndic/v54/api'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })

const base = (over: Partial<SyndicData> = {}): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], ...over,
})

const enFrancais = (ui: React.ReactNode, d: SyndicData) => render(
  <V54LocaleProvider locale="fr-FR">
    <ToastProvider><SyndicDataContext.Provider value={d}>{ui}</SyndicDataContext.Provider></ToastProvider>
  </V54LocaleProvider>,
)

const mission = (over: Partial<Mission>): Mission => ({
  id: 'mission-0000', immeuble: 'Résidence Le Prado', artisan: 'Plomberie du Vieux-Port', type: 'Plomberie',
  description: 'Fuite', priorite: 'normale', statut: 'en_cours', dateCreation: '2026-10-01', ...over,
})

/** Ligne d'un ordre de service (bloc contenant le nom de l'immeuble). */
const ligne = (immeuble: string) => screen.getByText(immeuble).parentElement as HTMLElement

describe('Ordres de service — priorité et statut réels', () => {
  it('affiche « Urgente » / « Normale » / « Planifiée » selon la mission (plus toujours « Normale »)', () => {
    enFrancais(<ModOrdens />, base({ missions: [
      mission({ id: 'u-000001', immeuble: 'Immeuble Urgent', priorite: 'urgente' }),
      mission({ id: 'n-000001', immeuble: 'Immeuble Normal', priorite: 'normale' }),
      mission({ id: 'p-000001', immeuble: 'Immeuble Planifié', priorite: 'planifiee' }),
    ] }))
    expect(within(ligne('Immeuble Urgent')).getByText('Urgente')).toBeInTheDocument()
    expect(within(ligne('Immeuble Normal')).getByText('Normale')).toBeInTheDocument()
    expect(within(ligne('Immeuble Planifié')).getByText('Planifiée')).toBeInTheDocument()
    expect(within(ligne('Immeuble Urgent')).queryByText('Normale')).toBeNull()
  })

  it('mission annulée : « Annulé », jamais « En attente », sans bouton « Valider »', () => {
    enFrancais(<ModOrdens />, base({ missions: [mission({ id: 'a-000001', immeuble: 'Immeuble Annulé', statut: 'annulee', artisan: '' })] }))
    const bloc = ligne('Immeuble Annulé')
    expect(within(bloc).getByText('Annulé')).toBeInTheDocument()
    expect(within(bloc).queryByText('En attente')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Valider' })).toBeNull()
  })

  it('« Ouvrir » puis « Enregistrer » sur une mission acceptée : le statut envoyé reste « acceptee »', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ mission: {} }), { status: 200 }))
    enFrancais(<ModOrdens />, base({ token: 'tok', refresh: vi.fn(), missions: [mission({ id: 'acc-0001', statut: 'acceptee' })] }))
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('acceptee')
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/missions', expect.objectContaining({ method: 'PATCH' })))
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect(JSON.parse(String(init.body))).toMatchObject({ id: 'acc-0001', statut: 'acceptee' })
  })

  it('mission annulée rouverte : le statut proposé reste « annulee »', () => {
    enFrancais(<ModOrdens />, base({ token: 'tok', missions: [mission({ id: 'ann-0001', statut: 'annulee' })] }))
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('annulee')
  })
})

describe('Planning — semaine courante', () => {
  it('datesSemaineCourante : du lundi au dimanche de la semaine du jour donné (JJ/MM)', () => {
    // Dimanche 11/10/2026 → semaine du lundi 05/10 ; lundi 12/10 → semaine du 12/10.
    expect(datesSemaineCourante(new Date(2026, 9, 11, 15), 'fr-FR')).toMatchObject({ mon: '05/10', fri: '09/10', sun: '11/10' })
    expect(datesSemaineCourante(new Date(2026, 9, 12, 8), 'fr-FR')).toMatchObject({ mon: '12/10', tue: '13/10', fri: '16/10' })
    // Semaine à cheval sur deux mois.
    expect(datesSemaineCourante(new Date(2026, 9, 29), 'fr-FR')).toMatchObject({ mon: '26/10', fri: '30/10', sun: '01/11' })
  })

  it('en-têtes du planning : dates de la semaine en cours (plus « 19/05 … 23/05 »)', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 12, 9))
    enFrancais(<ModPlaneamento />, base({ eventos: [] }))
    for (const date of ['12/10', '13/10', '14/10', '15/10', '16/10']) expect(screen.getByText(date)).toBeInTheDocument()
    expect(screen.queryByText('19/05')).toBeNull()
  })
})

describe('Incidents — résolus et SLA', () => {
  const sig = (id: string, statut: string): Signalement => ({
    id, immeuble: 'Résidence Le Prado', demandeurNom: 'M. Martin', typeIntervention: 'Plomberie', description: `Incident ${id}`, priorite: 'normale', statut,
  })

  it('« terminee » et « annulee » comptent comme résolus ; le taux SLA n’est pas inventé', () => {
    render(<SyndicDataContext.Provider value={base({ signalements: [sig('a', 'terminee'), sig('b', 'annulee'), sig('c', 'en_attente'), sig('d', 'en_cours')] })}><ModOcorrencias /></SyndicDataContext.Provider>)
    expect(screen.getByText('Resolvidas').parentElement?.textContent).toContain('2')
    expect(screen.getByText('Abertas').parentElement?.textContent).toContain('1')
    expect(screen.queryByText('67%')).toBeNull()
  })

  it('preview anonyme : taux SLA de la maquette conservé', () => {
    render(<ModOcorrencias />)
    expect(screen.getByText('67%')).toBeInTheDocument()
  })
})

describe('Assurance obligatoire — multirisque immeuble en France', () => {
  const seguro = (over: Partial<Seguro>): Seguro => ({
    id: 's', immeuble: 'Résidence Le Prado', seguradora: 'AXA', tipo: 'incendio', apolice: 'POL-1',
    premioAnual: 4200, capital: 2_000_000, dataInicio: '2026-01-01', dataFim: '2027-01-01', statut: 'ativa', notes: '', ...over,
  })

  it('fr-FR : les polices « multirriscos » comptent aussi (incendie compris)', () => {
    enFrancais(<ModSeguroObr />, base({ seguros: [
      seguro({ id: 'mr', apolice: 'MRI-PRADO', tipo: 'multirriscos' }),
      seguro({ id: 'rc', apolice: 'RC-PRADO', tipo: 'responsabilidade_civil' }),
    ] }))
    expect(screen.getByText('MRI-PRADO')).toBeInTheDocument()
    expect(screen.queryByText('RC-PRADO')).toBeNull()
  })
})

describe('Immeubles — prochain contrôle', () => {
  const immeuble = (over: Partial<Immeuble>): Immeuble => ({
    id: 'i1', nom: 'Résidence Le Prado', adresse: '1 av. du Prado', ville: 'Marseille', codePostal: '13008', nbLots: 24,
    anneeConstruction: 1972, typeImmeuble: '', gestionnaire: '', nbInterventions: 3, budgetAnnuel: 60_000, depensesAnnee: 20_000, ...over,
  })

  it('date absente (« » renvoyé par l’API) → « — » ; date saisie → JJ/MM/AAAA', () => {
    enFrancais(<ModEdificios />, base({ immeubles: [immeuble({ prochainControle: '' })] }))
    expect(screen.getByText('Prochain contrôle').nextElementSibling?.textContent).toBe('—')
    cleanup()
    enFrancais(<ModEdificios />, base({ immeubles: [immeuble({ prochainControle: '2026-11-15' })] }))
    expect(screen.getByText('Prochain contrôle').nextElementSibling?.textContent).toBe('15/11/2026')
  })
})
