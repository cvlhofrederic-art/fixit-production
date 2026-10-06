// tests/components/devis-section-facturer-choix.test.tsx
//
// « Facturer » côté DEVIS, BTP (orgRole === 'pro_societe') : ouvre un choix
//   « Facture totale »    → le devis devient directement une facture émise (montants du devis,
//                           acomptes déjà facturés déduits), sans repasser par le formulaire ;
//   « Facture d'acompte » → lit l'échéancier du devis / % choisi et émet une facture d'acompte
//                           reliée au devis, avec UNE ligne par taux de TVA.
// Le côté artisan (conversion par le formulaire, lignes au pourcentage) est couvert par
// tests/components/acompte-artisan.test.tsx.

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'

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
// Séries distinctes : FACT- pour la facture, AC- pour l'acompte.
vi.mock('@/lib/doc-number', () => ({
  fetchNextDocNumber: vi.fn((type: string) => Promise.resolve(type === 'facture' ? 'FACT-2026-043' : 'AC-2026-020')),
  localFallbackDocNumber: vi.fn(() => 'AC-2026-020'),
}))
vi.mock('@/lib/document-sync', () => ({ syncDocumentSafe: vi.fn() }))
// RIB du profil : illisible par défaut (hors ligne), fourni au cas par cas.
vi.mock('@/lib/rib-profil', async (original) => ({
  ...(await original<typeof import('@/lib/rib-profil')>()),
  chargerRibProfil: vi.fn().mockResolvedValue(null),
}))

import { toast } from 'sonner'
import DevisSection from '@/components/dashboard/DevisSection'
import { dateDuJourLocale } from '@/lib/acompte-par-taux'
import { computeDocumentTotalHT } from '@/lib/devis-totals'
import { fetchNextDocNumber } from '@/lib/doc-number'
import { chargerRibProfil } from '@/lib/rib-profil'

const ARTISAN = {
  id: 'art-1', user_id: 'u-1', company_name: 'SUD TRAVAUX', email: 's@test.fr', phone: '', bio: '',
} as Parameters<typeof DevisSection>[0]['artisan']

const DEVIS = {
  id: 'dev-1', docNumber: 'DEV-2026-009', docType: 'devis', status: 'accepte',
  clientName: 'A & W SAS', docTitle: 'Rénovation appartement',
  regimeTva: 'classique', tvaEnabled: true,
  acomptesEnabled: true,
  acomptes: [
    { id: 'a1', ordre: 1, label: 'Acompte 1', pourcentage: 50, declencheur: 'À la signature' },
    { id: 'a2', ordre: 2, label: 'Acompte 2', pourcentage: 30, declencheur: 'À mi-chantier' },
    { id: 'a3', ordre: 3, label: 'Acompte 3', pourcentage: 20, declencheur: 'À la livraison' },
  ],
  lines: [{ id: 1, description: 'Rénovation', qty: 1, priceHT: 10000, tvaRate: 20, totalHT: 10000 }],
}

const ACOMPTE_DEJA_EMIS = {
  id: 'ac-x', docNumber: 'AC-2026-001', docType: 'facture', status: 'envoye', docDate: '2026-09-15',
  factureSubType: 'acompte', parentInvoiceNumber: 'DEV-2026-009', acompteOrdre: 1, acomptePourcentage: 50,
  regimeTva: 'classique',
  lines: [{ id: 9, description: 'Acompte 1', qty: 1, priceHT: 5000, tvaRate: 20, totalHT: 5000 }],
}

type Props = Parameters<typeof DevisSection>[0]

function props(convertDevisToFacture = vi.fn(), setSavedDocuments = vi.fn(), extraDocs: unknown[] = [], devis: unknown = DEVIS) {
  return {
    artisan: ARTISAN, services: [], bookings: [],
    savedDocuments: [devis, ...extraDocs] as unknown as Props['savedDocuments'],
    setSavedDocuments,
    showDevisForm: false, setShowDevisForm: vi.fn(),
    convertingDevis: null, setConvertingDevis: vi.fn(), openDevisForm: vi.fn(),
    convertDevisToFacture,
  } as unknown as Props
}

const emis = (setSavedDocuments: ReturnType<typeof vi.fn>, appel = 0) =>
  (setSavedDocuments.mock.calls[appel][0] as (p: unknown[]) => unknown[])([])[0] as Record<string, unknown>
const emis2 = (setSavedDocuments: ReturnType<typeof vi.fn>) =>
  emis(setSavedDocuments) as Parameters<typeof computeDocumentTotalHT>[0]

async function cliquerFactureTotale() {
  await waitFor(() => expect(screen.getByText('DEV-2026-009')).toBeInTheDocument())
  fireEvent.click(screen.getByText('proDash.devis.facturer'))
  fireEvent.click(screen.getByRole('button', { name: /Facture totale/i }))
}

describe('DevisSection — « Facturer » propose Totale ou Acompte (BTP)', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); vi.mocked(chargerRibProfil).mockResolvedValue(null) })
  afterEach(() => { cleanup() })

  it('« Facturer » ouvre le choix Totale / Acompte', async () => {
    render(<DevisSection {...props()} />)
    await waitFor(() => expect(screen.getByText('DEV-2026-009')).toBeInTheDocument())
    fireEvent.click(screen.getByText('proDash.devis.facturer'))
    expect(screen.getByRole('button', { name: /Facture totale/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Facture d'acompte/i })).toBeInTheDocument()
  })

  it('« Facture totale » → le devis devient directement une facture émise', async () => {
    const convert = vi.fn()
    const setSavedDocuments = vi.fn()
    render(<DevisSection {...props(convert, setSavedDocuments)} />)
    await cliquerFactureTotale()

    await waitFor(() => expect(setSavedDocuments).toHaveBeenCalled())
    expect(convert).not.toHaveBeenCalled() // plus de passage par le formulaire
    const facture = emis(setSavedDocuments)
    expect(facture.docType).toBe('facture')
    expect(facture.factureSubType).toBe('standard')
    expect(facture.docNumber).toBe('FACT-2026-043')
    expect(facture.status).toBe('envoye')
    expect(facture.sourceDevisNumber).toBe('DEV-2026-009')
    expect(facture.docDate).toBe(dateDuJourLocale())
    expect(String(facture.id)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/)
    expect(facture.lines).toEqual(DEVIS.lines)
    expect(computeDocumentTotalHT(facture as Parameters<typeof computeDocumentTotalHT>[0])).toBe(10000)
    // Aucune relecture avant l'émission : le message de succès donne le numéro et le montant.
    expect(toast.success).toHaveBeenCalledWith('Facture FACT-2026-043 émise — 10 000,00 € HT (devis DEV-2026-009)', expect.anything())
    // Persistée comme document émis
    const stockes = JSON.parse(localStorage.getItem('fixit_documents_art-1') || '[]') as { docNumber: string }[]
    expect(stockes.map((d) => d.docNumber)).toEqual(['FACT-2026-043'])
  })

  it('« Facture totale » après un acompte émis → acompte déduit (facture de solde)', async () => {
    const setSavedDocuments = vi.fn()
    render(<DevisSection {...props(vi.fn(), setSavedDocuments, [ACOMPTE_DEJA_EMIS])} />)
    await cliquerFactureTotale()

    await waitFor(() => expect(setSavedDocuments).toHaveBeenCalled())
    const facture = emis(setSavedDocuments)
    expect(computeDocumentTotalHT(facture as Parameters<typeof computeDocumentTotalHT>[0])).toBe(5000) // 10 000 − 5 000
    expect(facture.docTitle).toBe('Facture de solde — Rénovation appartement')
    const tables = facture.customTables as { id: string; lines: { description: string; totalHT: number }[] }[]
    expect(tables[tables.length - 1].id).toBe('acomptes-deduits')
    expect(tables[tables.length - 1].lines).toHaveLength(1)
    expect(tables[tables.length - 1].lines[0].totalHT).toBe(-5000)
    expect(tables[tables.length - 1].lines[0].description).toBe('Acompte déjà facturé — facture n° AC-2026-001 du 15/09/2026 — TVA 20 %')
  })

  it('RIB : la facture et l\'acompte portent le RIB actuel du profil, pas celui figé dans le devis', async () => {
    const devis = { ...DEVIS, iban: 'FR76 ANCIEN', bic: 'ANCIENBIC' }
    vi.mocked(chargerRibProfil).mockResolvedValue({ iban: 'FR76 NOUVEAU', bic: 'NOUVEAUBIC' })
    const setSavedDocuments = vi.fn()
    render(<DevisSection {...props(vi.fn(), setSavedDocuments, [], devis)} />)
    await cliquerFactureTotale()
    await waitFor(() => expect(setSavedDocuments).toHaveBeenCalledTimes(1))
    expect(emis(setSavedDocuments)).toMatchObject({ iban: 'FR76 NOUVEAU', bic: 'NOUVEAUBIC' })

    fireEvent.click(screen.getByText('proDash.devis.facturer'))
    fireEvent.click(screen.getByRole('button', { name: /Facture d'acompte/i }))
    fireEvent.click(screen.getByRole('button', { name: /Acompte 1.*50/ }))
    await waitFor(() => expect(setSavedDocuments).toHaveBeenCalledTimes(2))
    expect(emis(setSavedDocuments, 1)).toMatchObject({ factureSubType: 'acompte', iban: 'FR76 NOUVEAU', bic: 'NOUVEAUBIC' })
  })

  it('RIB illisible (hors ligne) : l\'ancien RIB du devis est retiré, le PDF relira le profil', async () => {
    const devis = { ...DEVIS, iban: 'FR76 ANCIEN', bic: 'ANCIENBIC' }
    vi.mocked(chargerRibProfil).mockResolvedValue(null)
    const setSavedDocuments = vi.fn()
    render(<DevisSection {...props(vi.fn(), setSavedDocuments, [], devis)} />)
    await cliquerFactureTotale()
    await waitFor(() => expect(setSavedDocuments).toHaveBeenCalled())
    const facture = emis(setSavedDocuments)
    expect(facture).not.toHaveProperty('iban')
    expect(facture).not.toHaveProperty('bic')
  })

  it('acompte sur un devis déjà facturé, ou au-delà de 100 % → refus, aucun numéro consommé', async () => {
    const dejaFacture = { id: 'f-1', docType: 'facture', factureSubType: 'standard', docNumber: 'FACT-2026-001', status: 'envoye', sourceDevisNumber: 'DEV-2026-009' }
    const setSavedDocuments = vi.fn()
    const { unmount } = render(<DevisSection {...props(vi.fn(), setSavedDocuments, [dejaFacture])} />)
    await waitFor(() => expect(screen.getByText('DEV-2026-009')).toBeInTheDocument())
    fireEvent.click(screen.getByText('proDash.devis.facturer'))
    fireEvent.click(screen.getByRole('button', { name: /Facture d'acompte/i }))
    fireEvent.click(screen.getByRole('button', { name: /Acompte 1.*50/ }))
    expect(toast.error).toHaveBeenLastCalledWith(expect.stringContaining('un acompte ferait double emploi'))
    unmount()

    // Deux acomptes de 50 % déjà émis : une troisième émission dépasserait le devis.
    const second = { ...ACOMPTE_DEJA_EMIS, id: 'ac-y', docNumber: 'AC-2026-002', acompteOrdre: 2 }
    render(<DevisSection {...props(vi.fn(), setSavedDocuments, [ACOMPTE_DEJA_EMIS, second])} />)
    await waitFor(() => expect(screen.getByText('DEV-2026-009')).toBeInTheDocument())
    fireEvent.click(screen.getByText('proDash.devis.facturer'))
    fireEvent.click(screen.getByRole('button', { name: /Facture d'acompte/i }))
    fireEvent.click(screen.getByRole('button', { name: /Acompte 1.*50/ }))
    expect(toast.error).toHaveBeenLastCalledWith(expect.stringContaining('dépasseraient le montant du devis'))
    expect(fetchNextDocNumber).not.toHaveBeenCalled()
    expect(setSavedDocuments).not.toHaveBeenCalled()
  })

  it('prestation future → aucune facture, le sélecteur d\'acompte s\'ouvre', async () => {
    const setSavedDocuments = vi.fn()
    const demain = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10)
    render(<DevisSection {...props(vi.fn(), setSavedDocuments, [], { ...DEVIS, prestationDate: demain })} />)
    await cliquerFactureTotale()

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('facture d\'acompte'))
    expect(fetchNextDocNumber).not.toHaveBeenCalled()
    expect(setSavedDocuments).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Acompte 1.*50/ })).toBeInTheDocument()
  })

  it('devis déjà facturé → refus, aucun numéro consommé', async () => {
    const dejaFacture = { id: 'f-1', docType: 'facture', factureSubType: 'standard', docNumber: 'FACT-2026-001', status: 'envoye', sourceDevisNumber: 'DEV-2026-009' }
    const setSavedDocuments = vi.fn()
    render(<DevisSection {...props(vi.fn(), setSavedDocuments, [dejaFacture])} />)
    await cliquerFactureTotale()

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('FACT-2026-001'))
    expect(fetchNextDocNumber).not.toHaveBeenCalled()
    expect(setSavedDocuments).not.toHaveBeenCalled()
  })

  it('second clic pendant l\'émission → une seule facture', async () => {
    let attribuer: (numero: string) => void = () => {}
    vi.mocked(fetchNextDocNumber).mockImplementationOnce(() => new Promise<string>((resolve) => { attribuer = resolve }))
    const setSavedDocuments = vi.fn()
    render(<DevisSection {...props(vi.fn(), setSavedDocuments)} />)
    await cliquerFactureTotale()
    await waitFor(() => expect(fetchNextDocNumber).toHaveBeenCalledTimes(1))
    await cliquerFactureTotale() // numéro pas encore attribué : ce clic est ignoré
    attribuer('FACT-2026-043')

    await waitFor(() => expect(setSavedDocuments).toHaveBeenCalledTimes(1))
    expect(fetchNextDocNumber).toHaveBeenCalledTimes(1)
  })

  it('acompte en cours d\'émission → ni second acompte, ni facture totale en parallèle', async () => {
    // Tant que l'acompte n'est pas dans la liste, un second calcul ne le verrait pas
    // (acompte en double, ou facture totale sans déduction).
    let attribuer: (numero: string) => void = () => {}
    vi.mocked(fetchNextDocNumber).mockImplementationOnce(() => new Promise<string>((resolve) => { attribuer = resolve }))
    const setSavedDocuments = vi.fn()
    render(<DevisSection {...props(vi.fn(), setSavedDocuments)} />)
    await waitFor(() => expect(screen.getByText('DEV-2026-009')).toBeInTheDocument())
    fireEvent.click(screen.getByText('proDash.devis.facturer'))
    fireEvent.click(screen.getByRole('button', { name: /Facture d'acompte/i }))
    fireEvent.click(screen.getByRole('button', { name: /Acompte 1.*50/ }))
    await waitFor(() => expect(fetchNextDocNumber).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByText('proDash.devis.facturer'))
    fireEvent.click(screen.getByRole('button', { name: /Facture d'acompte/i }))
    fireEvent.click(screen.getByRole('button', { name: /Acompte 2.*30/ }))
    expect(toast.error).toHaveBeenLastCalledWith(expect.stringContaining('déjà en cours d\'émission'))
    await cliquerFactureTotale()
    expect(toast.error).toHaveBeenCalledTimes(2)
    attribuer('AC-2026-020')

    await waitFor(() => expect(setSavedDocuments).toHaveBeenCalledTimes(1))
    expect(fetchNextDocNumber).toHaveBeenCalledTimes(1)
    expect(emis(setSavedDocuments).acomptePourcentage).toBe(50)
  })

  it('« Facture d\'acompte » → échéancier du devis → clic Acompte 1 émet (AC-, reliée au devis, une ligne par taux)', async () => {
    const setSavedDocuments = vi.fn()
    render(<DevisSection {...props(vi.fn(), setSavedDocuments)} />)
    await waitFor(() => expect(screen.getByText('DEV-2026-009')).toBeInTheDocument())
    fireEvent.click(screen.getByText('proDash.devis.facturer'))
    fireEvent.click(screen.getByRole('button', { name: /Facture d'acompte/i }))
    // L'échéancier du devis s'affiche dans la modale acompte
    fireEvent.click(screen.getByRole('button', { name: /Acompte 1.*50/ }))

    await waitFor(() => expect(setSavedDocuments).toHaveBeenCalled())
    const emitted = emis(setSavedDocuments)
    expect(emitted.factureSubType).toBe('acompte')
    expect(emitted.acomptePourcentage).toBe(50)
    expect(emitted.docNumber).toBe('AC-2026-020')
    expect(emitted.status).toBe('envoye')
    expect(emitted.parentInvoiceNumber).toBe('DEV-2026-009')
    expect(emitted.sourceDevisNumber).toBe('DEV-2026-009')
    // 50 % de 10 000 = 5 000, en UNE ligne au taux du devis
    expect(computeDocumentTotalHT(emitted as Parameters<typeof computeDocumentTotalHT>[0])).toBe(5000)
    const lignes = emitted.lines as { description: string; qty: number; priceHT: number; totalHT: number; tvaRate: number }[]
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({ description: 'Acompte de 50 % sur travaux soumis à la TVA au taux de 20 %', qty: 1, priceHT: 5000, totalHT: 5000, tvaRate: 20 })
    expect(emitted.materialLines).toEqual([])
    expect(emitted.fraisLines).toEqual([])
    expect(emitted.customTables).toEqual([])
  })

  it('devis à deux taux → acompte en deux lignes, une par taux', async () => {
    const devisDeuxTaux = {
      ...DEVIS,
      lines: [
        { id: 1, description: 'Dépose et pose faïence', qty: 1, priceHT: 3000, tvaRate: 10, totalHT: 3000 },
        { id: 2, description: 'Meuble vasque', qty: 2, priceHT: 600, tvaRate: 20, totalHT: 1200 },
      ],
    }
    const setSavedDocuments = vi.fn()
    render(<DevisSection {...props(vi.fn(), setSavedDocuments, [], devisDeuxTaux)} />)
    await waitFor(() => expect(screen.getByText('DEV-2026-009')).toBeInTheDocument())
    fireEvent.click(screen.getByText('proDash.devis.facturer'))
    fireEvent.click(screen.getByRole('button', { name: /Facture d'acompte/i }))
    fireEvent.click(screen.getByRole('button', { name: /Acompte 2.*30/ }))

    await waitFor(() => expect(setSavedDocuments).toHaveBeenCalled())
    const lignes = emis(setSavedDocuments).lines as { description: string; totalHT: number; tvaRate: number }[]
    expect(lignes.map((l) => [l.tvaRate, l.totalHT])).toEqual([[20, 360], [10, 900]])
    expect(lignes[1].description).toBe('Acompte de 30 % sur travaux soumis à la TVA au taux de 10 %')
  })

  it('devis encore en brouillon → ni facture ni acompte, aucun numéro consommé', async () => {
    const brouillon = { ...DEVIS, docNumber: '', status: 'brouillon' }
    const setSavedDocuments = vi.fn()
    render(<DevisSection {...props(vi.fn(), setSavedDocuments, [], brouillon)} />)
    await waitFor(() => expect(screen.getByText('A & W SAS')).toBeInTheDocument())
    fireEvent.click(screen.getByText('proDash.devis.facturer'))
    fireEvent.click(screen.getByRole('button', { name: /Facture totale/i }))
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('brouillon'))

    fireEvent.click(screen.getByText('proDash.devis.facturer'))
    fireEvent.click(screen.getByRole('button', { name: /Facture d'acompte/i }))
    fireEvent.click(screen.getByRole('button', { name: /Acompte 1.*50/ }))
    expect(toast.error).toHaveBeenCalledTimes(2)
    expect(toast.error).toHaveBeenLastCalledWith(expect.stringContaining('brouillon'))
    expect(fetchNextDocNumber).not.toHaveBeenCalled()
    expect(setSavedDocuments).not.toHaveBeenCalled()
  })

  it('dernière échéance de l\'échéancier → solde le devis au centime', async () => {
    // Devis de 100,03 € : 50 % = 50,02 et 30 % = 30,01 déjà émis ; 20 % arrondi seul donnerait 20,01.
    const devis = { ...DEVIS, lines: [{ id: 1, description: 'Rénovation', qty: 1, priceHT: 100.03, tvaRate: 20, totalHT: 100.03 }] }
    const emis = (numero: string, ordre: number, pourcentage: number, montant: number) => ({
      id: `ac-${ordre}`, docNumber: numero, docType: 'facture', status: 'pending', factureSubType: 'acompte', regimeTva: 'classique',
      parentInvoiceNumber: 'DEV-2026-009', acompteOrdre: ordre, acomptePourcentage: pourcentage,
      lines: [{ id: 1, description: 'Acompte', qty: 1, priceHT: montant, tvaRate: 20, totalHT: montant }],
    })
    const setSavedDocuments = vi.fn()
    render(<DevisSection {...props(vi.fn(), setSavedDocuments, [emis('AC-2026-001', 1, 50, 50.02), emis('AC-2026-002', 2, 30, 30.01)], devis)} />)
    await waitFor(() => expect(screen.getByText('DEV-2026-009')).toBeInTheDocument())
    fireEvent.click(screen.getByText('proDash.devis.facturer'))
    fireEvent.click(screen.getByRole('button', { name: /Facture d'acompte/i }))
    fireEvent.click(screen.getByRole('button', { name: /Acompte 3.*20/ }))

    await waitFor(() => expect(setSavedDocuments).toHaveBeenCalled())
    expect(computeDocumentTotalHT(emis2(setSavedDocuments))).toBe(20)
  })

  it('« Dupliquer » → le duplicata reçoit un identifiant UUID (enregistrable sans numéro)', async () => {
    const setConvertingDevis = vi.fn()
    render(<DevisSection {...{ ...props(), setConvertingDevis }} />)
    await waitFor(() => expect(screen.getByText('DEV-2026-009')).toBeInTheDocument())
    fireEvent.click(screen.getByText('proDash.devis.dupliquer'))
    const duplicata = setConvertingDevis.mock.calls[0][0] as { id: string; docNumber?: string }
    expect(duplicata.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(duplicata.docNumber).toBeUndefined()
  })

  it('un acompte déjà émis pour le devis est marqué « déjà émis » mais reste ré-émissible', async () => {
    render(<DevisSection {...props(vi.fn(), vi.fn(), [ACOMPTE_DEJA_EMIS])} />)
    await waitFor(() => expect(screen.getByText('DEV-2026-009')).toBeInTheDocument())
    fireEvent.click(screen.getByText('proDash.devis.facturer'))
    fireEvent.click(screen.getByRole('button', { name: /Facture d'acompte/i }))
    const a1 = screen.getByRole('button', { name: /Acompte 1.*50/ })
    expect(a1).not.toBeDisabled()              // ré-émission permise
    expect(a1).toHaveTextContent(/déjà émis/i) // mais visible que c'est fait
    expect(screen.getByRole('button', { name: /Acompte 2.*30/ })).not.toHaveTextContent(/déjà émis/i)
  })
})
