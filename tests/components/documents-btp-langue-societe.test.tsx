// tests/components/documents-btp-langue-societe.test.tsx
//
// Documents BTP émis en un clic (facture d'acompte et facture totale depuis un devis, acompte depuis une facture) :
// dans la langue de la SOCIÉTÉ (sa fiche, lib/btp/langue-documents.ts), plus dans celle de l'écran.
// Constat de Frédéric du 27/11/2026 : SUD TRAVAUX, société française, ouverte sur /pt (cookie de langue resté au
// portugais) → facture d'acompte AC-2026-030 entièrement en portugais (« Adiantamento n.º 3 de 3 », « Adiantamento de
// 20 % por conta dos trabalhos… »). Les messages affichés, eux, restent dans la langue de l'écran.

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'

const ecran = vi.hoisted(() => ({ locale: 'pt' as 'fr' | 'pt' }))

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: ecran.locale }),
  useLocale: () => ecran.locale,
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))
vi.mock('@/components/dashboard/useThemeVars', () => ({
  useThemeVars: () => ({
    bg: '#fff', surface: '#fff', surfaceAlt: '#f5f5f5', border: '#e5e5e5',
    text: '#000', textMuted: '#666', accent: '#000', accentText: '#fff',
    red: '#dc2626', green: '#16a34a',
  }),
}))
vi.mock('@/lib/hooks/useOrgRoleContext', () => ({
  useOrgRoleContext: () => ({ orgRole: 'pro_societe', isV5: true, useBtpDesign: true }),
}))
vi.mock('@/components/DevisFactureForm', () => ({ default: () => null }))
vi.mock('@/components/DevisFactureFormBTP', () => ({ default: () => null }))
vi.mock('@/components/DocumentCancelModal', () => ({ default: () => null }))
vi.mock('@/components/ConfirmDraftDeleteDialog', () => ({ default: () => null }))
vi.mock('@/lib/pdf/download-saved-devis', () => ({ downloadSavedDevis: vi.fn() }))
vi.mock('@/components/dashboard/useDocumentCancel', () => ({
  useDocumentCancel: () => ({ cancellingDoc: null, setCancellingDoc: vi.fn(), handleRemoveDoc: vi.fn(), handleCancelled: vi.fn() }),
  isDocDraftStatus: () => false,
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => 'tid') } }))
vi.mock('@/lib/doc-number', () => ({
  fetchNextDocNumber: vi.fn((type: string) => Promise.resolve(type === 'facture' ? 'FACT-2026-043' : 'AC-2026-030')),
  localFallbackDocNumber: vi.fn(() => 'AC-2026-030'),
}))
vi.mock('@/lib/document-sync', () => ({ syncDocumentSafe: vi.fn() }))
vi.mock('@/lib/rib-profil', async (original) => ({
  ...(await original<typeof import('@/lib/rib-profil')>()),
  chargerRibProfil: vi.fn().mockResolvedValue(null),
}))

import { toast } from 'sonner'
import DevisSection from '@/components/dashboard/DevisSection'
import FacturesSection from '@/components/dashboard/FacturesSection'

type PropsDevis = Parameters<typeof DevisSection>[0]
type PropsFactures = Parameters<typeof FacturesSection>[0]

// Fiche lue par le tableau de bord (profiles_artisan, select('*')) : la langue y est toujours, nulle ou non.
const SOCIETE_FRANCAISE = { id: 'art-sud', user_id: 'u-sud', company_name: 'SUD TRAVAUX', language: 'fr' }
const SOCIETE_PORTUGAISE = { id: 'art-vc', user_id: 'u-vc', company_name: 'VITFIX CONSTRUÇÕES', language: 'pt' }
const SOCIETE_SANS_LANGUE = { id: 'art-x', user_id: 'u-x', company_name: 'SOCIÉTÉ X', language: null }
// Identité de repli sans langue connue (aucune clé language) : la langue de l'écran, comme avant.
const IDENTITE_INCONNUE = { id: 'art-y', user_id: 'u-y', company_name: 'SOCIÉTÉ Y' }

const DEVIS = {
  id: 'dev-33', docNumber: 'DEV-2026-033', docType: 'devis', status: 'accepte', docDate: '2026-02-11',
  clientName: 'SIGA', docTitle: 'Travaux façade, verrière et balcons',
  regimeTva: 'classique', tvaEnabled: true,
  acomptesEnabled: true,
  acomptes: [
    { id: 'a1', ordre: 1, label: 'Acompte 1', pourcentage: 50, declencheur: 'À la signature' },
    { id: 'a2', ordre: 2, label: 'Acompte 2', pourcentage: 30, declencheur: 'À mi-chantier' },
    { id: 'a3', ordre: 3, label: 'Acompte 3', pourcentage: 20, declencheur: 'À la livraison' },
  ],
  lines: [{ id: 1, description: 'Façade', qty: 1, priceHT: 10000, tvaRate: 10, totalHT: 10000 }],
}

const FACTURE = {
  id: 'fac-9', docNumber: 'FACT-2026-009', docType: 'facture', status: 'pending', clientName: 'SIGA',
  docTitle: 'Travaux façade', regimeTva: 'classique', tvaEnabled: true,
  lines: [{ id: 1, description: 'Façade', qty: 1, priceHT: 10000, tvaRate: 10, totalHT: 10000 }],
}

function propsDevis(artisan: unknown, setSavedDocuments = vi.fn(), devis: unknown = DEVIS): PropsDevis {
  return {
    artisan, services: [], bookings: [],
    savedDocuments: [devis] as unknown as PropsDevis['savedDocuments'],
    setSavedDocuments,
    showDevisForm: false, setShowDevisForm: vi.fn(),
    convertingDevis: null, setConvertingDevis: vi.fn(), openDevisForm: vi.fn(),
    convertDevisToFacture: vi.fn(),
  } as unknown as PropsDevis
}

function propsFactures(artisan: unknown, setSavedDocuments = vi.fn()): PropsFactures {
  return {
    artisan, services: [], bookings: [],
    savedDocuments: [FACTURE] as unknown as PropsFactures['savedDocuments'],
    setSavedDocuments,
    showFactureForm: false, setShowFactureForm: vi.fn(),
    convertingDevis: null, setConvertingDevis: vi.fn(), openFactureForm: vi.fn(),
  } as unknown as PropsFactures
}

const emis = (setSavedDocuments: ReturnType<typeof vi.fn>) =>
  (setSavedDocuments.mock.calls[0][0] as (p: unknown[]) => unknown[])([])[0] as Record<string, unknown>
const designations = (doc: Record<string, unknown>) => (doc.lines as { description: string }[]).map((l) => l.description)

async function emettreAcompteDepuisDevis(artisan: unknown): Promise<Record<string, unknown>> {
  const setSavedDocuments = vi.fn()
  render(<DevisSection {...propsDevis(artisan, setSavedDocuments)} />)
  await waitFor(() => expect(screen.getByText('DEV-2026-033')).toBeInTheDocument())
  fireEvent.click(screen.getByText('proDash.devis.facturer'))
  fireEvent.click(screen.getByRole('button', { name: /Facture d'acompte/i }))
  fireEvent.click(screen.getByRole('button', { name: /Acompte 3.*20/ }))
  await waitFor(() => expect(setSavedDocuments).toHaveBeenCalled())
  return emis(setSavedDocuments)
}

describe('Documents BTP en un clic : langue de la société, pas de l\'écran', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); ecran.locale = 'pt' })
  afterEach(() => { cleanup() })

  it('société française sur écran portugais : facture d\'acompte en français (cas AC-2026-030)', async () => {
    const acompte = await emettreAcompteDepuisDevis(SOCIETE_FRANCAISE)
    expect(acompte.docNumber).toBe('AC-2026-030')
    expect(acompte.docTitle).toBe('Acompte n° 3 sur 3 (20 %) — Travaux façade, verrière et balcons')
    expect(designations(acompte)).toEqual(['Acompte de 20 % sur travaux soumis à la TVA au taux de 10 %'])
    expect(acompte.linesName).toBe('Acompte')
    expect(String(acompte.notes)).toMatch(/^Acompte de 20 % \(n° 3 sur 3\) sur le devis/)
    expect(JSON.stringify(acompte)).not.toMatch(/Adiantamento|IVA|orçamento/)
  })

  it('société dont la fiche n\'a pas de langue : française, comme sa série de numérotation', async () => {
    const acompte = await emettreAcompteDepuisDevis(SOCIETE_SANS_LANGUE)
    expect(acompte.docTitle).toMatch(/^Acompte n° 3 sur 3/)
  })

  it('société portugaise sur écran français : fatura de adiantamento en portugais', async () => {
    ecran.locale = 'fr'
    const acompte = await emettreAcompteDepuisDevis(SOCIETE_PORTUGAISE)
    expect(acompte.docTitle).toBe('Adiantamento n.º 3 de 3 (20 %) — Travaux façade, verrière et balcons')
    expect(designations(acompte)).toEqual(['Adiantamento de 20 % por conta dos trabalhos sujeitos a IVA à taxa de 10 %'])
    expect(acompte.linesName).toBe('Adiantamento')
  })

  it('identité sans langue connue : langue de l\'écran, comme avant', async () => {
    const acompte = await emettreAcompteDepuisDevis(IDENTITE_INCONNUE)
    expect(acompte.docTitle).toMatch(/^Adiantamento n\.º 3 de 3/)
  })

  it('facture totale d\'une société française sur écran portugais : en français', async () => {
    const setSavedDocuments = vi.fn()
    const devisRealise = { ...DEVIS, acomptesEnabled: false, acomptes: [], prestationDate: '2026-02-20' }
    render(<DevisSection {...propsDevis(SOCIETE_FRANCAISE, setSavedDocuments, devisRealise)} />)
    await waitFor(() => expect(screen.getByText('DEV-2026-033')).toBeInTheDocument())
    fireEvent.click(screen.getByText('proDash.devis.facturer'))
    fireEvent.click(screen.getByRole('button', { name: /Facture totale/i }))
    await waitFor(() => expect(setSavedDocuments).toHaveBeenCalled())
    const facture = emis(setSavedDocuments)
    expect(facture.docNumber).toBe('FACT-2026-043')
    expect(String(facture.notes)).toContain('Réf. devis : DEV-2026-033')
    expect(String(facture.notes)).not.toContain('orçamento')
  })

  it('refus de la facture totale : le message reste dans la langue de l\'écran', async () => {
    const brouillon = { ...DEVIS, status: 'brouillon' }
    render(<DevisSection {...propsDevis(SOCIETE_FRANCAISE, vi.fn(), brouillon)} />)
    await waitFor(() => expect(screen.getByText('DEV-2026-033')).toBeInTheDocument())
    fireEvent.click(screen.getByText('proDash.devis.facturer'))
    fireEvent.click(screen.getByRole('button', { name: /Facture totale/i }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(vi.mocked(toast.error).mock.calls[0][0]).toBe('Este orçamento ainda é um rascunho: valide-o antes de o faturar.')
  })

  it('« → Acompte » depuis une facture, société française sur écran portugais : en français', async () => {
    const setSavedDocuments = vi.fn()
    render(<FacturesSection {...propsFactures(SOCIETE_FRANCAISE, setSavedDocuments)} />)
    await waitFor(() => expect(screen.getByText('FACT-2026-009')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('proDash.factures.toAcompteTitle'))
    fireEvent.click(screen.getByRole('button', { name: '30 %' }))
    fireEvent.click(screen.getByText("Émettre l'acompte"))
    await waitFor(() => expect(setSavedDocuments).toHaveBeenCalled())
    const acompte = emis(setSavedDocuments)
    expect(designations(acompte)).toEqual(['Acompte de 30 % sur travaux soumis à la TVA au taux de 10 %'])
    expect(acompte.linesName).toBe('Acompte')
  })

  it('« → Acompte » depuis une facture, société portugaise sur écran français : en portugais', async () => {
    ecran.locale = 'fr'
    const setSavedDocuments = vi.fn()
    render(<FacturesSection {...propsFactures(SOCIETE_PORTUGAISE, setSavedDocuments)} />)
    await waitFor(() => expect(screen.getByText('FACT-2026-009')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('proDash.factures.toAcompteTitle'))
    fireEvent.click(screen.getByRole('button', { name: '30 %' }))
    fireEvent.click(screen.getByText("Émettre l'acompte"))
    await waitFor(() => expect(setSavedDocuments).toHaveBeenCalled())
    expect(designations(emis(setSavedDocuments))).toEqual(['Adiantamento de 30 % por conta dos trabalhos sujeitos a IVA à taxa de 10 %'])
  })
})
