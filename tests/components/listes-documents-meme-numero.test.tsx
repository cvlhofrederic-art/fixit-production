// Listes Devis et Factures (components/dashboard/DevisSection.tsx, FacturesSection.tsx) : rafraîchissement à la
// fermeture du formulaire, quand deux documents distincts portent le même numéro (constat documents-cycle-1 de l'audit
// des fondations BTP du 11/11/2026). Société BTP : les deux restent dans la liste (avant : la fusion par numéro en
// retirait un). Artisan : fusion d'origine, inchangée.
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
// Formulaires simulés : un seul bouton « Retour », qui ferme le formulaire (onBack → rafraîchissement de la liste).
vi.mock('@/components/DevisFactureForm', () => ({ default: (p: { onBack: () => void }) => <button onClick={p.onBack}>Retour</button> }))
vi.mock('@/components/DevisFactureFormBTP', () => ({ default: (p: { onBack: () => void }) => <button onClick={p.onBack}>Retour</button> }))
vi.mock('@/components/DocumentCancelModal', () => ({ default: () => null }))
vi.mock('@/components/ConfirmDraftDeleteDialog', () => ({ default: () => null }))
vi.mock('@/lib/pdf/download-saved-devis', () => ({ downloadSavedDevis: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => 'tid') } }))
vi.mock('@/lib/document-sync', () => ({ syncDocumentSafe: vi.fn() }))

import DevisSection from '@/components/dashboard/DevisSection'
import FacturesSection from '@/components/dashboard/FacturesSection'

const ARTISAN = { id: 'art-meme-numero', user_id: 'u-1', company_name: 'BATIR TEST SAS', email: 'contact@batir.test', phone: '', bio: '' }
const ligne = [{ id: 1, description: 'Travaux', qty: 1, priceHT: 1000, tvaRate: 20, totalHT: 1000 }]
// Facture A numérotée hors connexion par le navigateur, facture B par le serveur : même numéro.
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

beforeEach(() => { localStorage.clear(); role.valeur = 'pro_societe' })
afterEach(() => { cleanup() })

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
