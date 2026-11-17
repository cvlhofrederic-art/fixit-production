// Listes Devis et Factures (components/dashboard/DevisSection.tsx, FacturesSection.tsx) quand deux documents distincts
// portent le même numéro (constat documents-cycle-1 de l'audit des fondations BTP du 11/11/2026, puis relecture adverse
// du lot) : par exemple une facture A restée dans le navigateur (refusée par le serveur : numéro déjà pris) et la
// facture B de la base.
// - Rafraîchissement à la fermeture du formulaire. Société BTP : les deux restent dans la liste (avant : la fusion par
//   numéro en retirait un). Artisan : fusion d'origine, inchangée.
// - Actions de la liste, société BTP. L'annulation et « Accepté » / « Refusé » d'un devis désignent le document au
//   serveur par son seul numéro : tant que ce numéro est en double, elles sont refusées avec un message (sinon le
//   serveur aurait annulé ou modifié l'AUTRE document, puis les deux auraient disparu de la liste). « Marquer payée »,
//   « Email », la case à cocher et la suppression d'un brouillon ne touchent que le document visé (avant : les deux).
//   Artisan : inchangé.
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'

const role = vi.hoisted(() => ({ valeur: 'pro_societe' as 'pro_societe' | 'artisan' }))

vi.mock('@/lib/i18n/context', async () => (await import('../helpers/mocks-formulaires-devis')).traductions())
vi.mock('@/lib/supabase', async () => (await import('../helpers/simulations-listes-documents')).supabaseListes())
vi.mock('@/components/dashboard/useThemeVars', async () => (await import('../helpers/simulations-listes-documents')).themeVarsNeutres())
vi.mock('@/lib/hooks/useOrgRoleContext', async () => (await import('../helpers/simulations-listes-documents')).contexteRole(role))
// Formulaires simulés : un seul bouton « Retour », qui ferme le formulaire (onBack → rafraîchissement de la liste).
vi.mock('@/components/DevisFactureForm', () => ({ default: (p: { onBack: () => void }) => <button onClick={p.onBack}>Retour</button> }))
vi.mock('@/components/DevisFactureFormBTP', () => ({ default: (p: { onBack: () => void }) => <button onClick={p.onBack}>Retour</button> }))
// Fenêtre d'annulation : la vraie (elle envoie le numéro du document à /api/document-cancel, fetch simulé).
// Confirmation de suppression d'un brouillon : un seul bouton, qui confirme.
vi.mock('@/components/ConfirmDraftDeleteDialog', () => ({
  default: (p: { open: boolean; onConfirm: () => void }) => (p.open ? <button onClick={p.onConfirm}>Confirmer la suppression</button> : null),
}))
vi.mock('@/lib/pdf/download-saved-devis', async () => (await import('../helpers/simulations-listes-documents')).telechargementPdfMuet())
vi.mock('sonner', async () => (await import('../helpers/mocks-formulaires-devis')).notifications())
vi.mock('@/lib/document-sync', async () => (await import('../helpers/mocks-formulaires-devis')).synchroMuette())

import DevisSection from '@/components/dashboard/DevisSection'
import FacturesSection from '@/components/dashboard/FacturesSection'
import { toast } from 'sonner'
import { misesAJourBase, statutsApres } from '../helpers/simulations-listes-documents'

const ARTISAN = { id: 'art-meme-numero', user_id: 'u-1', company_name: 'BATIR TEST SAS', email: 'contact@batir.test', phone: '', bio: '' }
const CLE_DOCS = `fixit_documents_${ARTISAN.id}`
const CLE_BROUILLONS = `fixit_drafts_${ARTISAN.id}`
const ligne = [{ id: 1, description: 'Travaux', qty: 1, priceHT: 1000, tvaRate: 20, totalHT: 1000 }]
// Facture A restée dans le navigateur (numéro ancien ou modifié à la main, refusée par le serveur), facture B de la
// base : même numéro.
const FACT_A = { id: '6f1c2a34-0000-4000-8000-0000000000a1', docNumber: 'FACT-2026-012', docType: 'facture', status: 'envoye', clientName: 'Client A', lines: ligne }
const FACT_B = { id: '6f1c2a34-0000-4000-8000-0000000000b1', docNumber: 'FACT-2026-012', docType: 'facture', status: 'pending', clientName: 'Client B', lines: ligne }
const DEV_A = { ...FACT_A, docNumber: 'DEV-2026-007', docType: 'devis' }
const DEV_B = { ...FACT_B, docNumber: 'DEV-2026-007', docType: 'devis', status: 'sent' }

type Maj = (prev: unknown[]) => unknown[]

/** Ferme le formulaire et rend la liste obtenue par le rafraîchissement, à partir de la liste affichée `prev`. */
function rafraichir(setSavedDocuments: ReturnType<typeof vi.fn>, prev: unknown[]): unknown[] {
  fireEvent.click(screen.getByText('Retour'))
  const maj = setSavedDocuments.mock.calls.map(([v]) => v).find((v) => typeof v === 'function') as Maj | undefined
  expect(maj).toBeDefined()
  return maj!(prev)
}

function proprietes(docs: unknown[], setSavedDocuments: ReturnType<typeof vi.fn>): Record<string, unknown> {
  return {
    artisan: ARTISAN, services: [], bookings: [], savedDocuments: docs, setSavedDocuments,
    convertingDevis: null, setConvertingDevis: vi.fn(),
    showFactureForm: true, setShowFactureForm: vi.fn(), openFactureForm: vi.fn(),
    showDevisForm: true, setShowDevisForm: vi.fn(), openDevisForm: vi.fn(), convertDevisToFacture: vi.fn(),
  }
}
type ProprietesFactures = Parameters<typeof FacturesSection>[0]
type ProprietesDevis = Parameters<typeof DevisSection>[0]

/** Propriétés d'une section affichant sa liste (formulaire fermé). */
const proprietesListe = (docs: unknown[], setSavedDocuments: ReturnType<typeof vi.fn>): Record<string, unknown> =>
  ({ ...proprietes(docs, setSavedDocuments), showFactureForm: false, showDevisForm: false })
const listeFactures = (docs: unknown[], setSavedDocuments: ReturnType<typeof vi.fn>) =>
  render(<FacturesSection {...(proprietesListe(docs, setSavedDocuments) as unknown as ProprietesFactures)} />)
const listeDevis = (docs: unknown[], setSavedDocuments: ReturnType<typeof vi.fn>) =>
  render(<DevisSection {...(proprietesListe(docs, setSavedDocuments) as unknown as ProprietesDevis)} />)
/** Ligne de la liste qui affiche ce client. */
const ligneDe = (client: string): HTMLElement => screen.getByText(client).closest('tr') as HTMLElement
const statutsDuNavigateur = (cle: string): string[] => (JSON.parse(localStorage.getItem(cle) || '[]') as Array<{ status: string }>).map((d) => d.status)

let envoi: ReturnType<typeof vi.fn>
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  misesAJourBase.length = 0
  role.valeur = 'pro_societe'
  envoi = vi.fn(async () => new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', envoi)
  vi.stubGlobal('open', vi.fn())
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('liste Factures — deux factures au même numéro', () => {
  it('BTP : les deux factures restent après le rafraîchissement', () => {
    localStorage.setItem(`fixit_documents_${ARTISAN.id}`, JSON.stringify([FACT_A, FACT_B]))
    const setSavedDocuments = vi.fn()
    render(<FacturesSection {...(proprietes([FACT_A, FACT_B], setSavedDocuments) as unknown as ProprietesFactures)} />)
    expect(rafraichir(setSavedDocuments, [FACT_A, FACT_B])).toEqual([FACT_A, FACT_B])
  })

  it('artisan : fusion d\'origine, inchangée', () => {
    role.valeur = 'artisan'
    localStorage.setItem(`fixit_documents_${ARTISAN.id}`, JSON.stringify([FACT_A, FACT_B]))
    const setSavedDocuments = vi.fn()
    render(<FacturesSection {...(proprietes([FACT_A, FACT_B], setSavedDocuments) as unknown as ProprietesFactures)} />)
    expect(rafraichir(setSavedDocuments, [FACT_A, FACT_B])).toHaveLength(1)
  })
})

describe('liste Devis — deux devis au même numéro', () => {
  it('BTP : les deux devis restent après le rafraîchissement', () => {
    localStorage.setItem(`fixit_documents_${ARTISAN.id}`, JSON.stringify([DEV_A, DEV_B]))
    const setSavedDocuments = vi.fn()
    render(<DevisSection {...(proprietes([DEV_A, DEV_B], setSavedDocuments) as unknown as ProprietesDevis)} />)
    expect(rafraichir(setSavedDocuments, [DEV_A, DEV_B])).toEqual([DEV_A, DEV_B])
  })

  it('artisan : fusion d\'origine, inchangée', () => {
    role.valeur = 'artisan'
    localStorage.setItem(`fixit_documents_${ARTISAN.id}`, JSON.stringify([DEV_A, DEV_B]))
    const setSavedDocuments = vi.fn()
    render(<DevisSection {...(proprietes([DEV_A, DEV_B], setSavedDocuments) as unknown as ProprietesDevis)} />)
    expect(rafraichir(setSavedDocuments, [DEV_A, DEV_B])).toHaveLength(1)
  })
})

describe('liste Factures BTP — actions sur une facture dont le numéro est porté par une autre', () => {
  it('« Annuler » : refusé avec un message sur les deux factures, aucune annulation envoyée au serveur', () => {
    const setSavedDocuments = vi.fn()
    listeFactures([FACT_A, FACT_B], setSavedDocuments)
    fireEvent.click(within(ligneDe('Client A')).getByText('Annuler'))
    fireEvent.click(within(ligneDe('Client B')).getByText('Annuler'))
    expect(toast.error).toHaveBeenCalledTimes(2)
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Deux factures portent le numéro FACT-2026-012/))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(envoi).not.toHaveBeenCalled()
    expect(setSavedDocuments).not.toHaveBeenCalled()
  })

  it('numéro porté seulement par une facture annulée : l\'annulation s\'ouvre comme avant', () => {
    const FACT_C = { ...FACT_B, id: '6f1c2a34-0000-4000-8000-0000000000c1', status: 'cancelled', clientName: 'Client C' }
    listeFactures([FACT_A, FACT_C], vi.fn())
    fireEvent.click(within(ligneDe('Client A')).getByText('Annuler'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('« Marquer payée » : seule la facture visée passe « payée » (liste, navigateur, base)', async () => {
    localStorage.setItem(CLE_DOCS, JSON.stringify([FACT_A, FACT_B]))
    const setSavedDocuments = vi.fn()
    listeFactures([FACT_A, FACT_B], setSavedDocuments)
    fireEvent.click(within(ligneDe('Client A')).getByText('Marquer payée'))
    await waitFor(() => expect(setSavedDocuments).toHaveBeenCalled())
    expect(statutsApres(setSavedDocuments, [FACT_A, FACT_B])).toEqual(['paid', 'pending'])
    expect(statutsDuNavigateur(CLE_DOCS)).toEqual(['paid', 'pending'])
    expect(misesAJourBase).toEqual([{ table: 'factures', valeurs: { status: 'paid' }, colonne: 'id', valeur: FACT_A.id }])
  })

  it('« Email » : seule la facture visée passe « envoyée » ; l\'autre, payée, le reste', () => {
    const A = { ...FACT_A, clientEmail: 'client-a@example.com' }
    const B = { ...FACT_B, status: 'paid' }
    localStorage.setItem(CLE_DOCS, JSON.stringify([A, B]))
    const setSavedDocuments = vi.fn()
    listeFactures([A, B], setSavedDocuments)
    fireEvent.click(within(ligneDe('Client A')).getByText('proDash.factures.envoyerEmail'))
    expect(statutsApres(setSavedDocuments, [A, B])).toEqual(['envoye', 'paid'])
    expect(statutsDuNavigateur(CLE_DOCS)).toEqual(['envoye', 'paid'])
  })

  it('case à cocher : cocher une facture ne coche pas l\'autre', () => {
    listeFactures([FACT_A, FACT_B], vi.fn())
    fireEvent.click(within(ligneDe('Client A')).getByRole('checkbox'))
    expect((within(ligneDe('Client A')).getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
    expect((within(ligneDe('Client B')).getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
  })

  it('suppression d\'un brouillon qui porte le numéro : seul le brouillon est retiré, l\'autre facture reste', () => {
    const BROUILLON = { ...FACT_A, id: '6f1c2a34-0000-4000-8000-0000000000d1', status: 'brouillon', clientName: 'Client D' }
    localStorage.setItem(CLE_DOCS, JSON.stringify([FACT_B]))
    localStorage.setItem(CLE_BROUILLONS, JSON.stringify([BROUILLON]))
    const setSavedDocuments = vi.fn()
    listeFactures([BROUILLON, FACT_B], setSavedDocuments)
    fireEvent.click(within(ligneDe('Client D')).getByText('proDash.factures.supprimer'))
    fireEvent.click(screen.getByText('Confirmer la suppression'))
    expect(statutsApres(setSavedDocuments, [BROUILLON, FACT_B])).toEqual(['pending'])
    expect(statutsDuNavigateur(CLE_DOCS)).toEqual(['pending'])
    expect(statutsDuNavigateur(CLE_BROUILLONS)).toEqual([])
  })

  it('artisan : « Annuler » ouvre la fenêtre d\'annulation comme avant', () => {
    role.valeur = 'artisan'
    listeFactures([FACT_A, FACT_B], vi.fn())
    fireEvent.click(within(ligneDe('Client B')).getByText('Annuler'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(toast.error).not.toHaveBeenCalled()
  })
})

describe('liste Devis BTP — actions sur un devis dont le numéro est porté par un autre', () => {
  it('« Annuler » : refusé avec un message, aucune annulation envoyée au serveur', () => {
    const setSavedDocuments = vi.fn()
    listeDevis([DEV_A, DEV_B], setSavedDocuments)
    fireEvent.click(within(ligneDe('Client A')).getByRole('button', { name: 'Annuler' }))
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Deux devis portent le numéro DEV-2026-007/))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(envoi).not.toHaveBeenCalled()
    expect(setSavedDocuments).not.toHaveBeenCalled()
  })

  it('« Accepté » : refusé avec un message, rien n\'est envoyé au serveur', () => {
    listeDevis([DEV_A, DEV_B], vi.fn())
    fireEvent.click(within(ligneDe('Client B')).getByText('✓ Accepté'))
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Deux devis portent le numéro DEV-2026-007/))
    expect(envoi).not.toHaveBeenCalled()
  })

  it('artisan : « Accepté » part au serveur comme avant', async () => {
    role.valeur = 'artisan'
    listeDevis([DEV_A, DEV_B], vi.fn())
    fireEvent.click(within(ligneDe('Client B')).getByText('✓ Accepté'))
    await waitFor(() => expect(envoi).toHaveBeenCalledWith('/api/devis-status', expect.objectContaining({ method: 'POST' })))
    expect(toast.error).not.toHaveBeenCalled()
  })
})
