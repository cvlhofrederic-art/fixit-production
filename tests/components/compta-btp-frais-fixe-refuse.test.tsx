// tests/components/compta-btp-frais-fixe-refuse.test.tsx — Compta BTP, onglet « Frais fixes » : un frais refusé par le
// serveur affiche sa raison (relecture adverse du 15/11/2026).
//
// Avant : l'ajout d'un frais fixe ne lisait pas la réponse de POST /api/btp. Depuis la validation des écritures du
// 15/11/2026, un montant négatif est refusé : sans message, le frais disparaissait sans un mot. Maintenant : la raison
// donnée par le serveur s'affiche (toast). Le reste de l'écran ne change pas.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Artisan } from '@/lib/types'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })) } },
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/i18n/context', () => ({ useLocale: () => 'fr' }))

import { toast } from 'sonner'
import { ComptaBTPSection } from '@/components/dashboard/ComptaBTPSection'

const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } })

let envois: Array<Record<string, unknown>>
let reponseAjout: () => Response

beforeEach(() => {
  envois = []
  vi.mocked(toast.error).mockClear()
  reponseAjout = () => json({ row: { id: 'f-1' } }, 201)
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (init?.method === 'POST') {
      envois.push(JSON.parse(String(init.body)))
      return reponseAjout()
    }
    const table = new URL(String(url), 'https://vitfix.io').searchParams.get('table') ?? ''
    return json(table === 'settings' ? { settings: null } : { [table]: [] })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

const artisan = { id: 'a-1', user_id: 'u-1', company_name: 'Société d’essai' } as unknown as Artisan

/** Ouvre l'onglet « Frais fixes », saisit un frais et clique sur le bouton d'ajout. */
async function ajouterFrais(libelle: string, montant: string) {
  render(<ComptaBTPSection artisan={artisan} orgRole="pro_societe" />)
  fireEvent.click(await screen.findByRole('button', { name: /Frais fixes/ }))
  const champLibelle = screen.getByPlaceholderText('ex: Assurance décennale')
  fireEvent.change(champLibelle, { target: { value: libelle } })
  const formulaire = champLibelle.parentElement?.parentElement
  const champMontant = formulaire?.querySelector('input[type="number"]')
  const bouton = formulaire?.querySelector(':scope > button')
  if (!champMontant || !bouton) throw new Error('formulaire d’ajout introuvable')
  fireEvent.change(champMontant, { target: { value: montant } })
  fireEvent.click(bouton)
  await waitFor(() => expect(envois).toHaveLength(1))
}

describe('Compta BTP — ajout d’un frais fixe', () => {
  it('montant refusé par le serveur : sa raison s’affiche', async () => {
    reponseAjout = () => json({ error: 'Valeur refusée pour le montant (-90) : elle doit être positive ou nulle.' }, 400)

    await ajouterFrais('Loyer du dépôt', '-90')

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    expect(vi.mocked(toast.error).mock.calls[0][0]).toBe('Valeur refusée pour le montant (-90) : elle doit être positive ou nulle.')
    expect(envois).toEqual([{ table: 'charges_fixes', action: 'insert', data: { label: 'Loyer du dépôt', montant: -90, frequence: 'mensuel', categorie: 'autre' } }])
  })

  it('témoin : frais accepté, aucun message d’erreur', async () => {
    await ajouterFrais('Loyer du dépôt', '900')

    // Après l'ajout, l'écran relit la liste des frais.
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('table=charges_fixes'))).toHaveLength(2))
    expect(toast.error).not.toHaveBeenCalled()
  })
})
