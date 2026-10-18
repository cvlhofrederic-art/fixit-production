// tests/components/syndic-v54-portail-syndic.test.tsx
//
// Côté syndic du portail copropriétaire (tableau de bord v54, syndic connecté) :
//   - GED : interrupteur « Visible par les copropriétaires » par document rattaché à un immeuble
//     (PATCH /api/syndic/lea-documents/[id]), désactivé sans immeuble, sélecteur de rubrique une
//     fois publié ; la colonne Immeuble affiche le nom de l'immeuble ;
//   - Extranet : « Activer l'accès » appelle POST /api/syndic/coproprios/[id]/acces avec l'id
//     Supabase de la fiche ; « Accès activé » inactif quand l'accès l'est déjà ;
//   - Canal, onglet Demandes : mention « visibles par le demandeur » au-dessus du champ de réponse.
// La preview anonyme (PT, instantané byte-exact) ne montre aucun de ces contrôles.

import React, { useState } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import ModDocsGED from '@/components/syndic-dashboard/v54/modules/ModDocsGED'
import ModExtranet from '@/components/syndic-dashboard/v54/modules/ModExtranet'
import { CanalDemandes } from '@/components/syndic-dashboard/v54/modules/canal/CanalDemandes'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { V54LocaleProvider } from '@/lib/syndic/v54/i18n'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { LeaDocument } from '@/components/syndic-dashboard/v54/modules/use-lea-documents'
import type { Coprop, Signalement } from '@/lib/syndic/v54/api'
import type { Immeuble } from '@/components/syndic-dashboard/types'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

const PRADO = { id: 'imm-1', nom: 'Résidence Le Prado' } as Immeuble
const BEARER = { Authorization: 'Bearer jeton-cabinet' }

const base: SyndicData = { authenticated: true, loading: false, missions: [], immeubles: [PRADO], artisans: [], team: [], coproprios: [], token: 'jeton-cabinet' }

const doc = (over: Partial<LeaDocument>): LeaDocument => ({
  id: 'd1', filename: 'document.pdf', mime_type: 'application/pdf', size_bytes: 1000,
  type: 'pv_assemblee', status: 'processed', immeuble_id: null, tags: null,
  uploaded_at: '2026-06-01T10:00:00.000Z', processed_at: null, error_message: null, extracted_metadata: null,
  ...over,
})

const cadre = (ui: React.ReactNode, data: SyndicData = base) => (
  <V54LocaleProvider locale="fr-FR"><ToastProvider><SyndicDataContext.Provider value={data}>{ui}</SyndicDataContext.Provider></ToastProvider></V54LocaleProvider>
)

describe('GED — publication sur le portail copropriétaire', () => {
  const PV = doc({ id: 'doc-pv', filename: 'PV AG 2026.pdf', immeuble_id: 'imm-1' })
  const SANS = doc({ id: 'doc-sans', filename: 'Note interne.pdf', immeuble_id: null })

  function simulerApi(reponsePatch: (corps: Record<string, unknown>) => Record<string, unknown>) {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        const corps = JSON.parse(String(init.body)) as Record<string, unknown>
        return Promise.resolve(new Response(JSON.stringify(reponsePatch(corps)), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({ documents: [PV, SANS], total: 2 }), { status: 200 }))
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('interrupteur par document : actif avec immeuble, désactivé sans (info-bulle), nom de l’immeuble affiché', async () => {
    simulerApi((corps) => ({ document: { ...PV, ...corps } }))
    render(cadre(<ModDocsGED />))
    expect(await screen.findByText('PV AG 2026.pdf')).toBeInTheDocument()
    expect(screen.getByText('Résidence Le Prado')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Portail' })).toBeInTheDocument()

    const interrupteurs = screen.getAllByRole('checkbox', { name: 'Visible par les copropriétaires' })
    expect(interrupteurs).toHaveLength(2)
    const lignePv = screen.getByText('PV AG 2026.pdf').closest('tr') as HTMLElement
    const ligneSans = screen.getByText('Note interne.pdf').closest('tr') as HTMLElement
    expect(within(lignePv).getByRole('checkbox')).toBeEnabled()
    expect(within(lignePv).getByRole('checkbox')).not.toBeChecked()
    const sans = within(ligneSans).getByRole('checkbox')
    expect(sans).toBeDisabled()
    expect(sans.closest('span')).toHaveAttribute('title', "Rattachez d'abord le document à un immeuble")
    // Pas de sélecteur de rubrique tant que rien n'est publié.
    expect(screen.queryByRole('combobox', { name: 'Rubrique du portail' })).toBeNull()
  })

  it('activer → PATCH publie_extranet:true avec le jeton, puis sélecteur de rubrique → PATCH categorie_extranet', async () => {
    const fetchMock = simulerApi((corps) => ({ document: { ...PV, publie_extranet: true, ...corps } }))
    render(cadre(<ModDocsGED />))
    const lignePv = (await screen.findByText('PV AG 2026.pdf')).closest('tr') as HTMLElement
    fireEvent.click(within(lignePv).getByRole('checkbox'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/syndic/lea-documents/doc-pv', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ publie_extranet: true }) })))
    const appelPatch = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'PATCH')
    expect((appelPatch?.[1] as RequestInit).headers).toMatchObject({ ...BEARER, 'Content-Type': 'application/json' })

    // La ligne est mise à jour avec la réponse (sans relecture de la liste) : interrupteur coché + rubrique.
    await waitFor(() => expect(within(lignePv).getByRole('checkbox')).toBeChecked())
    expect(await screen.findByText('Document visible par les copropriétaires')).toBeInTheDocument()
    const rubrique = within(lignePv).getByRole('combobox', { name: 'Rubrique du portail' })
    expect(within(rubrique).getByRole('option', { name: "PV d'assemblée" })).toBeInTheDocument()
    expect(within(rubrique).getByRole('option', { name: 'État descriptif de division' })).toBeInTheDocument()
    fireEvent.change(rubrique, { target: { value: 'pv_ag' } })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/syndic/lea-documents/doc-pv', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ categorie_extranet: 'pv_ag' }) })))
    await waitFor(() => expect(rubrique).toHaveValue('pv_ag'))
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes('limit=100'))).toHaveLength(1)
  })

  it('refus de l’API : toast d’erreur avec le message du code, interrupteur inchangé', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => init?.method === 'PATCH'
      ? Promise.resolve(new Response(JSON.stringify({ error: 'migration_requise' }), { status: 409 }))
      : Promise.resolve(new Response(JSON.stringify({ documents: [PV], total: 1 }), { status: 200 })))
    vi.stubGlobal('fetch', fetchMock)
    render(cadre(<ModDocsGED />))
    const lignePv = (await screen.findByText('PV AG 2026.pdf')).closest('tr') as HTMLElement
    fireEvent.click(within(lignePv).getByRole('checkbox'))
    expect(await screen.findByText('Portail pas encore activé sur cette base de données.')).toBeInTheDocument()
    expect(within(lignePv).getByRole('checkbox')).not.toBeChecked()
  })

  it('preview anonyme : ni colonne Portail ni interrupteur', () => {
    render(<ModDocsGED />)
    expect(screen.queryByRole('columnheader', { name: 'Portal' })).toBeNull()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })
})

describe('Extranet — activation de l’accès au portail', () => {
  const copro = (over: Partial<Coprop>): Coprop => ({
    id: 'c1', immeuble: 'Résidence Le Prado', batiment: 'A', etage: 2, numeroPorte: '2B', proprietario: 'Sophie Martin',
    email: 'sophie.martin@example.fr', telefone: '06', ocupado: true, acessoPortal: false, solde: 0, ...over,
  })

  it('« Activer l’accès » → POST /api/syndic/coproprios/[id]/acces (id Supabase, propriétaire), toast, refresh', async () => {
    const refresh = vi.fn()
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true, invite: true, email: 'sophie.martin@example.fr' }), { status: 200 })))
    vi.stubGlobal('fetch', fetchMock)
    const data: SyndicData = { ...base, refresh, coproprios: [copro({ id: 'fiche-uuid-1' }), copro({ id: 'fiche-uuid-2', proprietario: 'Paul Durand', email: 'paul@example.fr', acessoPortal: true })] }
    render(cadre(<ModExtranet />, data))

    const deja = screen.getByRole('button', { name: 'Accès activé' })
    expect(deja).toBeDisabled()
    const activer = screen.getByRole('button', { name: "Activer l'accès" })
    expect(activer).toBeEnabled()
    fireEvent.click(activer)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/syndic/coproprios/fiche-uuid-1/acces', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...BEARER },
      body: JSON.stringify({ occupant: 'proprietaire' }),
    })))
    expect(await screen.findByText('Invitation envoyée à sophie.martin@example.fr')).toBeInTheDocument()
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('sans e-mail : bouton désactivé avec l’explication ; refus de l’API : toast d’erreur', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: 'compte_autre_role', role: 'syndic' }), { status: 409 }))))
    const data: SyndicData = { ...base, coproprios: [copro({ id: 'f-sans', proprietario: 'Sans Email', email: '' }), copro({ id: 'f-syndic', proprietario: 'Déjà Syndic', email: 's@example.fr' })] }
    render(cadre(<ModExtranet />, data))
    const boutons = screen.getAllByRole('button', { name: "Activer l'accès" })
    expect(boutons).toHaveLength(2)
    const sansEmail = boutons.find((b) => b.hasAttribute('title')) as HTMLElement
    expect(sansEmail).toBeDisabled()
    expect(sansEmail).toHaveAttribute('title', "Renseignez d'abord l'e-mail du copropriétaire")
    const actif = boutons.find((b) => !b.hasAttribute('title')) as HTMLElement
    fireEvent.click(actif)
    expect(await screen.findByText("Cet e-mail a déjà un compte Vitfix d'un autre type (syndic, prestataire…).")).toBeInTheDocument()
  })

  it('preview anonyme : aucun bouton d’activation', () => {
    render(<V54LocaleProvider locale="fr-FR"><ModExtranet /></V54LocaleProvider>)
    expect(screen.queryByRole('button', { name: "Activer l'accès" })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Accès activé' })).toBeNull()
  })
})

describe('Canal — onglet Demandes', () => {
  const signalement: Signalement = {
    id: 's-prado', immeuble: 'Le Prado', demandeurNom: 'Géraldine Xavier', demandeurRole: 'coproprio', demandeurEmail: '', typeIntervention: 'Plomberie',
    description: 'Fuite', priorite: 'normale', statut: 'en_attente', batiment: '', etage: '', numLot: '', createdAt: '2026-10-12T08:00:00Z', messages: [],
  } as Signalement

  function Demandes() {
    const [sel, setSel] = useState<string | null>(null)
    return <CanalDemandes signalements={[signalement]} selectedId={sel} onSelect={setSel} onValider={vi.fn()} token="tok" onRafraichir={vi.fn()} />
  }

  it('mention « visibles par le demandeur » au-dessus du champ de réponse', () => {
    render(<V54LocaleProvider locale="fr-FR"><ToastProvider><Demandes /></ToastProvider></V54LocaleProvider>)
    const mention = screen.getByText('Vos réponses sont visibles par le demandeur dans son espace')
    const pied = mention.closest('footer') as HTMLElement
    expect(pied).not.toBeNull()
    expect(within(pied).getByRole('textbox', { name: 'Message' })).toBeInTheDocument()
    expect(mention.compareDocumentPosition(within(pied).getByRole('textbox', { name: 'Message' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
