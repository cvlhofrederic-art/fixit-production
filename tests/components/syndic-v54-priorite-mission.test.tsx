// tests/components/syndic-v54-priorite-mission.test.tsx
//
// « Nouvelle mission » (Ordres de service et raccourci NovaMissaoModal) : seules les priorités du
// CHECK syndic_missions.priorite sont proposées (urgente | normale | planifiee) — « basse » et
// « haute » faisaient échouer l'insertion (500). Le schéma de POST /api/syndic/missions accepte
// « planifiee » et ramène les anciennes valeurs à « normale ».

import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen, within, waitFor } from '@testing-library/react'
import ModOrdens from '@/components/syndic-dashboard/v54/modules/ModOrdens'
import { NovaMissaoModal } from '@/components/syndic-dashboard/v54/modules/NovaMissaoModal'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import { V54LocaleProvider } from '@/lib/syndic/v54/i18n'
import { syndicMissionSchema } from '@/lib/validation'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const donnees = (over: Partial<SyndicData> = {}): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], token: 'tok', refresh: vi.fn(), ...over,
})

const enFrancais = (ui: React.ReactNode, d: SyndicData = donnees()) => render(
  <V54LocaleProvider locale="fr-FR">
    <ToastProvider><SyndicDataContext.Provider value={d}>{ui}</SyndicDataContext.Provider></ToastProvider>
  </V54LocaleProvider>,
)

const options = (select: HTMLElement) => within(select).getAllByRole('option').map((o) => [(o as HTMLOptionElement).value, o.textContent])

describe('Priorité d’une nouvelle mission', () => {
  it('Ordres de service : Urgente / Normale / Planifiée seulement, « planifiee » envoyée telle quelle', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ mission: {} }), { status: 200 }))
    enFrancais(<ModOrdens />)
    fireEvent.click(screen.getByRole('button', { name: /Nouvelle mission/ }))
    const dialogue = await screen.findByRole('dialog')
    const select = within(dialogue).getByDisplayValue('Normale')
    expect(options(select)).toEqual([['urgente', 'Urgente'], ['normale', 'Normale'], ['planifiee', 'Planifiée']])

    fireEvent.change(select, { target: { value: 'planifiee' } })
    fireEvent.change(within(dialogue).getByPlaceholderText(/immeuble/i), { target: { value: 'Le Prado' } })
    const [type, description] = [within(dialogue).getAllByRole('textbox')[1], within(dialogue).getByRole('textbox', { name: /Description/i })]
    fireEvent.change(type, { target: { value: 'Plomberie' } })
    fireEvent.change(description, { target: { value: 'Fuite colonne' } })
    fireEvent.submit(dialogue.querySelector('form') as HTMLFormElement)
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body))).toMatchObject({ priorite: 'planifiee' })
  })

  it('raccourci « Nouvelle mission » (NovaMissaoModal) : mêmes trois priorités', () => {
    enFrancais(<NovaMissaoModal open onClose={vi.fn()} prefillImmeuble="Le Prado" lockImmeuble />)
    const select = within(screen.getByRole('dialog')).getByDisplayValue('Normale')
    expect(options(select)).toEqual([['urgente', 'Urgente'], ['normale', 'Normale'], ['planifiee', 'Planifiée']])
  })
})

describe('syndicMissionSchema — priorité', () => {
  const priorite = (p?: string) => {
    const r = syndicMissionSchema.safeParse(p === undefined ? {} : { priorite: p })
    return r.success ? r.data.priorite : 'refusée'
  }

  it('urgente / normale / planifiee acceptées ; basse et haute ramenées à normale ; inconnue refusée', () => {
    expect(priorite('urgente')).toBe('urgente')
    expect(priorite('planifiee')).toBe('planifiee')
    expect(priorite('normale')).toBe('normale')
    expect(priorite('basse')).toBe('normale')
    expect(priorite('haute')).toBe('normale')
    expect(priorite(undefined)).toBe('normale')
    expect(priorite('critique')).toBe('refusée')
  })
})
