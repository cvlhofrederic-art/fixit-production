// tests/components/aj-signalement/journal.test.tsx
//
// Vue « Journal » de l'espace AJ Signalement (SPEC § 1.8) : date, auteur (« Administrateur » ou le nom), action en
// clair, copropriété, champs modifiés (noms seulement) ; filtres action, copropriété, gestionnaire (rechargement à
// chaque changement) ; 100 lignes par page, « Voir plus » par le curseur du serveur ; « Conservation : 12 mois. ».

import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIBELLE_ACTION_JOURNAL_QR as A, TEXTES_GESTION_QR as G } from '@/lib/aj-signalement/affichage-gestion'
import { remplir } from '@/lib/coproprietaire/textes'
import { gestionCoproprieteQrVide, type CoproprieteQr, type EvenementJournalQr, type GestionnaireQr } from '@/lib/aj-signalement/types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const { default: JournalQr } = await import('@/components/aj-signalement/JournalQr')

const K1 = 'a0000000-0000-4000-8000-0000000000a1'
const G1 = '11111111-1111-4111-8111-111111111111'
const C1 = 'c0000000-0000-4000-8000-000000000001'

const evenement = (id: string, action: EvenementJournalQr['action'], extra: Partial<EvenementJournalQr> = {}): EvenementJournalQr => ({
  id, creeLe: '2026-11-10T12:00:00.000Z', cabinetId: K1, action, acteur: { profil: 'super_admin', nom: null }, coproprieteId: C1,
  coproprieteNom: 'Résidence Exemple', gestionnaireId: null, gestionnaireNom: null, signalementId: null, operationId: null, champs: [], details: {}, ...extra,
})

const copros: CoproprieteQr[] = [{
  id: C1, nom: 'Résidence Exemple', adresse: '', jeton: '0'.repeat(32), emailsDestinataires: [], actif: true, creeLe: '2026-11-01T00:00:00Z',
  nbSignalements: 0, nbEnAttente: 0, derniereAdresseProposee: null, ...gestionCoproprieteQrVide(),
}]
const gestionnaires = [{ id: G1, nom: 'Marie Exemple' }] as GestionnaireQr[]

let appels: string[] = []
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  appels = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    appels.push(url)
    if (url.includes('avant=')) return json({ evenements: [evenement('1', 'cabinet.cree', { coproprieteId: null, coproprieteNom: null })], suite: null })
    return json({
      evenements: [
        evenement('3', 'copropriete.modifiee', { champs: ['nom', 'adresse'] }),
        evenement('2', 'gestionnaire.adresse_confirmee', { acteur: { profil: 'gestionnaire', nom: 'Marie Exemple' }, gestionnaireId: G1, gestionnaireNom: 'Marie Exemple', coproprieteId: null, coproprieteNom: null }),
      ],
      suite: { avant: '2026-11-10T12:00:00.123456+00:00', avantId: '2' },
    })
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('journal', () => {
  it('lignes : auteur, action en clair, copropriété, champs ; pied « Conservation : 12 mois. »', async () => {
    render(<JournalQr coproprietes={copros} gestionnaires={gestionnaires} />)
    const liste = await screen.findByRole('list', { name: G.journal.liste })
    const lignes = within(liste).getAllByRole('listitem')
    expect(lignes).toHaveLength(2)
    expect(within(lignes[0]).getByText(A['copropriete.modifiee'])).toBeInTheDocument()
    expect(within(lignes[0]).getByText('Administrateur', { exact: false })).toBeInTheDocument()
    expect(within(lignes[0]).getByText('Résidence Exemple', { exact: false })).toBeInTheDocument()
    expect(within(lignes[0]).getByText(remplir(G.journal.champs, { champs: 'nom, adresse' }))).toBeInTheDocument()
    expect(within(lignes[1]).getAllByText('Marie Exemple', { exact: false }).length).toBeGreaterThan(0)
    expect(screen.getByText(G.journal.conservation)).toBeInTheDocument()
    expect(appels).toEqual(['/api/aj-signalement/journal'])
  })

  it('« Voir plus » : page suivante par le curseur du serveur, ajoutée à la suite', async () => {
    render(<JournalQr coproprietes={copros} gestionnaires={gestionnaires} />)
    fireEvent.click(await screen.findByRole('button', { name: G.journal.voirPlus }))
    await waitFor(() => expect(within(screen.getByRole('list', { name: G.journal.liste })).getAllByRole('listitem')).toHaveLength(3))
    expect(appels[1]).toBe('/api/aj-signalement/journal?avant=2026-11-10T12%3A00%3A00.123456%2B00%3A00&avantId=2')
    expect(screen.queryByRole('button', { name: G.journal.voirPlus })).toBeNull()
  })

  it('filtres action, copropriété, gestionnaire : rechargement depuis la première page', async () => {
    render(<JournalQr coproprietes={copros} gestionnaires={gestionnaires} />)
    await screen.findByRole('list', { name: G.journal.liste })
    fireEvent.change(screen.getByLabelText(G.journal.filtreAction), { target: { value: 'cabinet.cree' } })
    await waitFor(() => expect(appels.at(-1)).toBe('/api/aj-signalement/journal?action=cabinet.cree'))
    fireEvent.change(screen.getByLabelText(G.journal.filtreCopro), { target: { value: C1 } })
    await waitFor(() => expect(appels.at(-1)).toBe(`/api/aj-signalement/journal?action=cabinet.cree&copropriete=${C1}`))
    fireEvent.change(screen.getByLabelText(G.journal.filtreGestionnaire), { target: { value: G1 } })
    await waitFor(() => expect(appels.at(-1)).toBe(`/api/aj-signalement/journal?action=cabinet.cree&copropriete=${C1}&gestionnaire=${G1}`))
  })

  it('erreur de chargement : message et Réessayer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'serveur' }, 500)))
    render(<JournalQr coproprietes={copros} gestionnaires={gestionnaires} />)
    expect(await screen.findByRole('button', { name: G.reessayer })).toBeInTheDocument()
  })
})
