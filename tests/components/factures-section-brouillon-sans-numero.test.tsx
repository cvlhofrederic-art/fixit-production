// Liste Factures V5, société BTP (components/dashboard/FacturesSection.tsx, branche pro_societe) : « Marquer
// envoyée » et « Email » sur un brouillon sans numéro (constat documents-cycle-9 de l'audit des fondations BTP du
// 11/11/2026, limité par le lot au brouillon sans numéro).
//
// Avant : les deux boutons faisaient passer le brouillon « Émise » dans le navigateur, sans numéro.
// Désormais (BTP) : le brouillon garde son statut. « Marquer envoyée » affiche un message qui dit de le valider ;
// « Email » ouvre la messagerie comme avant, sans changer le statut. Artisan : inchangé.
// Hors de ce lot (décision de Frédéric) : une facture payée, en retard ou remboursée, que ces boutons ramènent à
// « Émise » comme avant.
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

const role = vi.hoisted(() => ({ valeur: 'pro_societe' as 'pro_societe' | 'artisan' }))

vi.mock('@/lib/i18n/context', async () => (await import('../helpers/mocks-formulaires-devis')).traductions())
vi.mock('@/lib/supabase', async () => (await import('../helpers/simulations-listes-documents')).supabaseListes())
vi.mock('@/components/dashboard/useThemeVars', async () => (await import('../helpers/simulations-listes-documents')).themeVarsNeutres())
vi.mock('@/lib/hooks/useOrgRoleContext', async () => (await import('../helpers/simulations-listes-documents')).contexteRole(role))
vi.mock('@/components/DevisFactureForm', async () => (await import('../helpers/simulations-listes-documents')).composantVide())
vi.mock('@/components/DevisFactureFormBTP', async () => (await import('../helpers/simulations-listes-documents')).composantVide())
vi.mock('@/components/DocumentCancelModal', async () => (await import('../helpers/simulations-listes-documents')).composantVide())
vi.mock('@/components/ConfirmDraftDeleteDialog', async () => (await import('../helpers/simulations-listes-documents')).composantVide())
vi.mock('@/lib/pdf/download-saved-devis', async () => (await import('../helpers/simulations-listes-documents')).telechargementPdfMuet())
vi.mock('sonner', async () => (await import('../helpers/mocks-formulaires-devis')).notifications())
vi.mock('@/lib/document-sync', async () => (await import('../helpers/mocks-formulaires-devis')).synchroMuette())

import { toast } from 'sonner'
import FacturesSection from '@/components/dashboard/FacturesSection'
import { statutsApres } from '../helpers/simulations-listes-documents'

const ARTISAN = { id: 'art-brouillon', user_id: 'u-1', company_name: 'BATIR TEST SAS', email: 'contact@batir.test', phone: '', bio: '' }
const CLE_BROUILLONS = `fixit_drafts_${ARTISAN.id}`
const ligne = [{ id: 1, description: 'Travaux', qty: 1, priceHT: 1000, tvaRate: 20, totalHT: 1000 }]

const BROUILLON = {
  id: '6f1c2a34-0000-4000-8000-0000000000d1', docNumber: '', docType: 'facture', status: 'brouillon',
  clientName: 'Client brouillon', clientEmail: 'client@example.com', lines: ligne,
}

type Proprietes = Parameters<typeof FacturesSection>[0]
const proprietes = (docs: unknown[], setSavedDocuments: ReturnType<typeof vi.fn>) => ({
  artisan: ARTISAN, services: [], bookings: [], savedDocuments: docs, setSavedDocuments,
  showFactureForm: false, setShowFactureForm: vi.fn(), convertingDevis: null, setConvertingDevis: vi.fn(), openFactureForm: vi.fn(),
}) as unknown as Proprietes

let ouvrir: ReturnType<typeof vi.fn>
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  role.valeur = 'pro_societe'
  ouvrir = vi.fn()
  vi.stubGlobal('open', ouvrir)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('BTP — brouillon sans numéro', () => {
  it('« Marquer envoyée » : le brouillon garde son statut, un message dit de le valider', () => {
    localStorage.setItem(CLE_BROUILLONS, JSON.stringify([BROUILLON]))
    const setSavedDocuments = vi.fn()
    render(<FacturesSection {...proprietes([BROUILLON], setSavedDocuments)} />)
    fireEvent.click(screen.getByText('proDash.factures.marquerEnvoyee'))
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/pas encore de numéro.*Valider et enregistrer/))
    expect(statutsApres(setSavedDocuments, [BROUILLON])).toEqual(['brouillon'])
    expect(JSON.parse(localStorage.getItem(CLE_BROUILLONS)!)).toEqual([BROUILLON])
  })

  it('« Email » : la messagerie s\'ouvre comme avant, le brouillon garde son statut', () => {
    localStorage.setItem(CLE_BROUILLONS, JSON.stringify([BROUILLON]))
    const setSavedDocuments = vi.fn()
    render(<FacturesSection {...proprietes([BROUILLON], setSavedDocuments)} />)
    fireEvent.click(screen.getByText('proDash.factures.envoyerEmail'))
    expect(ouvrir).toHaveBeenCalledTimes(1)
    expect(toast.error).not.toHaveBeenCalled()
    expect(statutsApres(setSavedDocuments, [BROUILLON])).toEqual(['brouillon'])
    expect(JSON.parse(localStorage.getItem(CLE_BROUILLONS)!)).toEqual([BROUILLON])
  })
})

describe('artisan — comportement d\'origine inchangé', () => {
  it('« Marquer envoyée » sur un brouillon : passe « envoyée » comme avant', () => {
    role.valeur = 'artisan'
    localStorage.setItem(CLE_BROUILLONS, JSON.stringify([BROUILLON]))
    const setSavedDocuments = vi.fn()
    render(<FacturesSection {...proprietes([BROUILLON], setSavedDocuments)} />)
    fireEvent.click(screen.getByText('proDash.factures.marquerEnvoyee'))
    expect(statutsApres(setSavedDocuments, [BROUILLON])).toEqual(['envoye'])
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('« Email » sur un brouillon : la messagerie s\'ouvre et le brouillon passe « envoyée » comme avant', () => {
    role.valeur = 'artisan'
    localStorage.setItem(CLE_BROUILLONS, JSON.stringify([BROUILLON]))
    const setSavedDocuments = vi.fn()
    render(<FacturesSection {...proprietes([BROUILLON], setSavedDocuments)} />)
    fireEvent.click(screen.getByText('proDash.factures.envoyerEmail'))
    expect(ouvrir).toHaveBeenCalledTimes(1)
    expect(statutsApres(setSavedDocuments, [BROUILLON])).toEqual(['envoye'])
  })
})
