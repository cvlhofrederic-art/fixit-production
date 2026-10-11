import './fuseau-paris'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OrdresServiceModule } from '@/components/administrateur-judiciaire/modules/gestion/OrdresService'
import { ToastContext, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import { DATE_DEMO_ISO, dateLocaleIso } from '@/lib/administrateur-judiciaire/mode'
import type { OrdrePrestataire, ReponseOrdresPrestataire } from '@/lib/administrateur-judiciaire/ordres-prestataire'

/**
 * Ordres de service → prestataire Vitfix (boucle prestataire) : « Envoyer au prestataire » sur une intervention ouvre
 * le choix d'un prestataire du cabinet (sans compte Vitfix : grisé), la date du jour réel et une note ; l'envoi part
 * à la route, puis le suivi de l'ordre (statut, échanges, documents, réponse) s'affiche sous la carte. La route est
 * simulée (fetch) ; aucun appel réseau.
 */

const ART = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'
const ART_SANS_COMPTE = 'bbbbbbbb-cccc-4ddd-8eee-000000000000'
const MISSION = 'dddddddd-0000-4000-8000-000000000001'

const PRESTATAIRES = [
  { id: ART, nom: 'Frédéric Multiservice', metier: 'Multiservice', compte: true },
  { id: ART_SANS_COMPTE, nom: 'Atelier Ménard', metier: 'Peintre', compte: false },
]

const ORDRE_SUIVI: OrdrePrestataire = {
  missionId: MISSION,
  conversationId: 'conv-1',
  messageId: 'ordre-1',
  referenceAj: 'OS-2026-051',
  titre: 'Fuite sur colonne EU — appartement du 4e étage',
  copropriete: 'Le Clos des Vignes',
  adresse: 'Le Clos des Vignes — Lot 27',
  localisation: 'Lot 27',
  prestataire: { nom: 'Frédéric Multiservice', metier: 'Multiservice' },
  urgence: 'urgente',
  dateIntervention: '2026-10-13',
  creeLe: '2026-10-12T09:00:00Z',
  statut: 'accepte',
  heureArrivee: '09:30',
  messages: [
    { id: 'm1', type: 'system', contenu: '✅ Mission acceptée — Frédéric Multiservice sera sur place à 09:30', creeLe: '2026-10-12T09:05:00Z', cote: 'artisan', document: null },
    {
      id: 'm2',
      type: 'text',
      contenu: '📄 Facture F-2026-007 — 1 250,50 € TTC',
      creeLe: '2026-10-12T09:10:00Z',
      cote: 'artisan',
      document: { type: 'facture', reference: 'F-2026-007', montant_ttc: 1250.5, description: 'Remplacement de la colonne', date: '2026-10-12' },
    },
    { id: 'm3', type: 'text', contenu: 'Je passe avec un collègue.', creeLe: '2026-10-12T09:11:00Z', cote: 'artisan', document: null },
  ],
}

type Route = (init: RequestInit | undefined) => Response | Promise<Response>

/** fetch simulé : GET → `lecture()`, POST → `ecriture(corps)`. */
function simulerRoute(lecture: () => ReponseOrdresPrestataire | Response, ecriture: (corps: Record<string, unknown>) => Response = () => Response.json({})) {
  const appel = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (_url, init) => {
    const route: Route = (i) => {
      if (i?.method === 'POST') return ecriture(JSON.parse(String(i.body)))
      const r = lecture()
      return r instanceof Response ? r : Response.json(r)
    }
    return route(init)
  })
  vi.stubGlobal('fetch', appel)
  return appel
}

const posts = (appel: ReturnType<typeof simulerRoute>) =>
  appel.mock.calls.filter(([, init]) => init?.method === 'POST').map(([, init]) => JSON.parse(String(init?.body)))

async function monter() {
  const push = vi.fn<ToastApi['push']>(() => undefined)
  await act(async () => {
    render(
      <ToastContext.Provider value={{ push, dismiss: vi.fn() }}>
        <OrdresServiceModule />
      </ToastContext.Provider>,
    )
  })
  return { push }
}

/** Carte de l'intervention portant ce numéro. */
const carte = (numero: string) => screen.getByText(numero).parentElement?.parentElement as HTMLElement

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Ordres de service — envoi au prestataire Vitfix et suivi', () => {
  it('choix du prestataire → envoi → suivi avec statut, documents et réponse', async () => {
    let ordres: OrdrePrestataire[] = []
    const appel = simulerRoute(
      () => ({ prestataires: PRESTATAIRES, ordres }),
      (corps) => {
        if (corps.action === 'envoyer') {
          ordres = [ORDRE_SUIVI]
          return Response.json({ mission_id: MISSION, conversation_id: 'conv-1', notification: true })
        }
        return Response.json({ message: { id: 'm4', type: 'text', contenu: String(corps.content), creeLe: '2026-10-12T09:20:00Z', cote: 'donneur_ordre', document: null } })
      },
    )
    const { push } = await monter()
    await waitFor(() => expect(appel).toHaveBeenCalled())

    fireEvent.click(within(carte('OS-2026-051')).getByRole('button', { name: /Envoyer au prestataire/ }))
    const dialogue = await screen.findByRole('dialog', { name: /Envoyer au prestataire Vitfix/ })
    expect(within(dialogue).getByText('Envoi réel')).toBeTruthy()

    // Prestataires du cabinet : celui sans compte Vitfix est grisé, celui avec compte présélectionné.
    const choix = within(dialogue).getByLabelText(/Prestataire Vitfix/) as HTMLSelectElement
    await waitFor(() => expect(choix.value).toBe(ART))
    const sansCompte = within(choix).getByRole('option', { name: /Atelier Ménard.*pas de compte Vitfix/ }) as HTMLOptionElement
    expect(sansCompte.disabled).toBe(true)

    // Date du jour réel, jamais la date figée de la démonstration.
    const date = within(dialogue).getByLabelText(/Date d’intervention/) as HTMLInputElement
    expect(date.value).toBe(dateLocaleIso(new Date()))
    expect(date.value).not.toBe(DATE_DEMO_ISO)

    fireEvent.change(within(dialogue).getByLabelText(/Note pour le prestataire/), { target: { value: 'Clé chez la gardienne' } })
    await act(async () => {
      fireEvent.click(within(dialogue).getByRole('button', { name: /Envoyer l’ordre/ }))
    })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(posts(appel)[0]).toEqual({
      action: 'envoyer',
      syndic_artisan_id: ART,
      copropriete: 'Le Clos des Vignes',
      objet: 'Fuite sur colonne EU — appartement du 4e étage',
      localisation: 'Lot 27',
      urgence: 'urgence',
      date_intervention: dateLocaleIso(new Date()),
      note: 'Clé chez la gardienne',
      reference_aj: 'OS-2026-051',
    })
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success', title: 'Ordre transmis' }))

    // Suivi déplié sous la carte : statut, avancement, document du prestataire.
    const suivi = await screen.findByRole('region', { name: /Suivi prestataire/ })
    expect(within(carte('OS-2026-051')).getByText('Vitfix · Accepté')).toBeTruthy()
    expect(within(suivi).getByText('Accepté', { selector: '.pill' })).toBeTruthy()
    expect(within(suivi).getByText(/Mission acceptée/)).toBeTruthy()
    expect(within(suivi).getByText('Je passe avec un collègue.')).toBeTruthy()
    expect(within(suivi).getByText('Facture F-2026-007')).toBeTruthy()
    expect(within(suivi).getByText(/1.250,50.€ TTC/)).toBeTruthy()
    expect(within(carte('OS-2026-051')).queryByRole('button', { name: /^Envoyer au prestataire/ })).toBeNull()

    fireEvent.click(within(suivi).getByRole('button', { name: 'Ouvrir' }))
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ kind: 'doc', docTitle: 'Facture n° F-2026-007' }))

    // Réponse au prestataire.
    fireEvent.change(within(suivi).getByLabelText(/Message à Frédéric Multiservice/), { target: { value: 'Merci, accès par le parking' } })
    await act(async () => {
      fireEvent.click(within(suivi).getByRole('button', { name: /Envoyer le message au prestataire/ }))
    })
    await waitFor(() => expect(posts(appel)).toHaveLength(2))
    expect(posts(appel)[1]).toEqual({ action: 'repondre', mission_id: MISSION, content: 'Merci, accès par le parking' })
    await waitFor(() => expect((within(suivi).getByLabelText(/Message à Frédéric Multiservice/) as HTMLInputElement).value).toBe(''))
  })

  it('ordre non livré par la route : erreur dans la fenêtre et toast, fenêtre gardée ouverte', async () => {
    simulerRoute(
      () => ({ prestataires: PRESTATAIRES, ordres: [] }),
      () => Response.json({ error: 'livraison_impossible' }, { status: 500 }),
    )
    const { push } = await monter()
    fireEvent.click(within(carte('OS-2026-050')).getByRole('button', { name: /Envoyer au prestataire/ }))
    const dialogue = await screen.findByRole('dialog')
    await waitFor(() => expect((within(dialogue).getByLabelText(/Prestataire Vitfix/) as HTMLSelectElement).value).toBe(ART))
    await act(async () => {
      fireEvent.click(within(dialogue).getByRole('button', { name: /Envoyer l’ordre/ }))
    })
    expect(await within(dialogue).findByText(/n’a pas pu être livré/)).toBeTruthy()
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error', title: 'Ordre non transmis' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('vue prestataire active (401) : bandeau dans l’écran, aucun toast', async () => {
    simulerRoute(() => Response.json({ error: 'non_autorise' }, { status: 401 }))
    const { push } = await monter()
    expect(await screen.findByText(/Si la vue prestataire est active, revenez en super admin/)).toBeTruthy()
    expect(push).not.toHaveBeenCalled()
  })

  it('ordre envoyé en saisie libre : carte en tête de « Tous », suivi à la demande', async () => {
    simulerRoute(() => ({ prestataires: PRESTATAIRES, ordres: [{ ...ORDRE_SUIVI, referenceAj: '', copropriete: 'Résidence Atlantique', statut: 'refuse', messages: [] }] }))
    await monter()
    expect(await screen.findByText('Résidence Atlantique')).toBeTruthy()
    expect(screen.getByText('Vitfix · Refusé')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Renvoyer au prestataire/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Suivi prestataire/ }))
    const suivi = screen.getByRole('region', { name: /Suivi prestataire/ })
    expect(within(suivi).getByText('Refusé par le prestataire')).toBeTruthy()
  })

  it('plusieurs prestataires avec compte Vitfix : aucune présélection (pas d’envoi à un tiers en un clic)', async () => {
    const ART2 = 'bbbbbbbb-cccc-4ddd-8eee-111111111111'
    simulerRoute(() => ({
      prestataires: [
        { id: ART2, nom: 'Atlantic Plomberie', metier: 'Plombier', compte: true },
        ...PRESTATAIRES,
      ],
      ordres: [],
    }))
    await monter()
    fireEvent.click(within(carte('OS-2026-051')).getByRole('button', { name: /Envoyer au prestataire/ }))
    const dialogue = await screen.findByRole('dialog', { name: /Envoyer au prestataire Vitfix/ })
    const choix = within(dialogue).getByLabelText(/Prestataire Vitfix/) as HTMLSelectElement
    await waitFor(() => expect(within(choix).getAllByRole('option').length).toBeGreaterThan(2))
    expect(choix.value).toBe('')
  })

  it('ordre terminé : la carte propose de renvoyer au prestataire (une répétition ne bloque pas la démo)', async () => {
    simulerRoute(() => ({ prestataires: PRESTATAIRES, ordres: [{ ...ORDRE_SUIVI, statut: 'termine' }] }))
    await monter()
    await waitFor(() => expect(within(carte('OS-2026-051')).getByRole('button', { name: /Renvoyer au prestataire/ })).toBeTruthy())
  })
})
