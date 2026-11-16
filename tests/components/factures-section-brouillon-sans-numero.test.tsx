// Liste Factures V5, société BTP (components/dashboard/FacturesSection.tsx, branche pro_societe) : « Marquer
// envoyée » et « Email » (constat documents-cycle-9 de l'audit des fondations BTP du 11/11/2026).
//
// Avant : sur une facture en brouillon, sans numéro, les deux boutons la faisaient passer « Émise » dans le navigateur,
// sans numéro (et « Email » ouvrait un message « Factures  — … » sans numéro) ; sur une facture payée, ils la
// ramenaient à « Émise ».
// Désormais (BTP) : un brouillon sans numéro garde son statut et un message dit de le valider ; une facture payée, en
// retard ou remboursée garde son statut (« Email » ouvre toujours le message). Artisan : inchangé.
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

const role = vi.hoisted(() => ({ valeur: 'pro_societe' as 'pro_societe' | 'artisan' }))

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'fr' }),
  useLocale: () => 'fr',
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))
vi.mock('@/components/dashboard/useThemeVars', () => ({
  useThemeVars: () => ({
    bg: '#fff', surface: '#fff', surfaceAlt: '#f5f5f5', border: '#e5e5e5',
    text: '#000', textMuted: '#666', accent: '#000', accentText: '#fff', red: '#dc2626', green: '#16a34a',
  }),
}))
vi.mock('@/lib/hooks/useOrgRoleContext', () => ({
  useOrgRoleContext: () => ({ orgRole: role.valeur, isV5: true, useBtpDesign: role.valeur === 'pro_societe' }),
}))
vi.mock('@/components/DevisFactureForm', () => ({ default: () => null }))
vi.mock('@/components/DevisFactureFormBTP', () => ({ default: () => null }))
vi.mock('@/components/DocumentCancelModal', () => ({ default: () => null }))
vi.mock('@/components/ConfirmDraftDeleteDialog', () => ({ default: () => null }))
vi.mock('@/lib/pdf/download-saved-devis', () => ({ downloadSavedDevis: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => 'tid') } }))
vi.mock('@/lib/document-sync', () => ({ syncDocumentSafe: vi.fn() }))

import { toast } from 'sonner'
import FacturesSection from '@/components/dashboard/FacturesSection'

const ARTISAN = { id: 'art-brouillon', user_id: 'u-1', company_name: 'BATIR TEST SAS', email: 'contact@batir.test', phone: '', bio: '' }
const CLE_DOCS = `fixit_documents_${ARTISAN.id}`
const CLE_BROUILLONS = `fixit_drafts_${ARTISAN.id}`
const ligne = [{ id: 1, description: 'Travaux', qty: 1, priceHT: 1000, tvaRate: 20, totalHT: 1000 }]

const BROUILLON = {
  id: '6f1c2a34-0000-4000-8000-0000000000d1', docNumber: '', docType: 'facture', status: 'brouillon',
  clientName: 'Client brouillon', clientEmail: 'client@example.com', lines: ligne,
}
const PAYEE = {
  id: '6f1c2a34-0000-4000-8000-0000000000e1', docNumber: 'FACT-2026-019', docType: 'facture', status: 'paid',
  clientName: 'Client payé', clientEmail: 'paye@example.com', sentAt: '2026-06-04T10:00:00.000Z', lines: ligne,
}

type Proprietes = Parameters<typeof FacturesSection>[0]
const proprietes = (docs: unknown[], setSavedDocuments: ReturnType<typeof vi.fn>) => ({
  artisan: ARTISAN, services: [], bookings: [], savedDocuments: docs, setSavedDocuments,
  showFactureForm: false, setShowFactureForm: vi.fn(), convertingDevis: null, setConvertingDevis: vi.fn(), openFactureForm: vi.fn(),
}) as unknown as Proprietes

/** Statuts que prend la liste après les mises à jour demandées par la section, à partir de `prev`. */
function statutsApres(setSavedDocuments: ReturnType<typeof vi.fn>, prev: Array<{ status: string }>): string[] {
  let liste: Array<{ status: string }> = prev
  for (const [maj] of setSavedDocuments.mock.calls) liste = typeof maj === 'function' ? maj(liste) : maj
  return liste.map((d) => d.status)
}

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

  it('« Email » : aucun message sans numéro n\'est ouvert, le brouillon garde son statut', () => {
    localStorage.setItem(CLE_BROUILLONS, JSON.stringify([BROUILLON]))
    const setSavedDocuments = vi.fn()
    render(<FacturesSection {...proprietes([BROUILLON], setSavedDocuments)} />)
    fireEvent.click(screen.getByText('proDash.factures.envoyerEmail'))
    expect(ouvrir).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/pas encore de numéro/))
    expect(statutsApres(setSavedDocuments, [BROUILLON])).toEqual(['brouillon'])
    expect(JSON.parse(localStorage.getItem(CLE_BROUILLONS)!)).toEqual([BROUILLON])
  })
})

describe('BTP — facture payée', () => {
  it('« Marquer envoyée » : la facture reste payée', () => {
    localStorage.setItem(CLE_DOCS, JSON.stringify([PAYEE]))
    const setSavedDocuments = vi.fn()
    render(<FacturesSection {...proprietes([PAYEE], setSavedDocuments)} />)
    fireEvent.click(screen.getByText('proDash.factures.marquerEnvoyee'))
    expect(statutsApres(setSavedDocuments, [PAYEE])).toEqual(['paid'])
    expect(JSON.parse(localStorage.getItem(CLE_DOCS)!)).toEqual([PAYEE])
  })

  it('« Email » : le message s\'ouvre, la facture reste payée', () => {
    localStorage.setItem(CLE_DOCS, JSON.stringify([PAYEE]))
    const setSavedDocuments = vi.fn()
    render(<FacturesSection {...proprietes([PAYEE], setSavedDocuments)} />)
    fireEvent.click(screen.getByText('proDash.factures.envoyerEmail'))
    expect(ouvrir).toHaveBeenCalledTimes(1)
    expect(String(ouvrir.mock.calls[0][0])).toContain('FACT-2026-019')
    expect(statutsApres(setSavedDocuments, [PAYEE])).toEqual(['paid'])
    expect(JSON.parse(localStorage.getItem(CLE_DOCS)!)).toEqual([PAYEE])
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
})
