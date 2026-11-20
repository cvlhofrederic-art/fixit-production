// Vrai formulaire artisan (components/DevisFactureForm.tsx) :
//   - marque « rendu complet » (lib/version-rendu.ts) posée sur un document nouveau ou un duplicata,
//     jamais sur un document d'avant la correction ni sur un document tiré d'un document d'avant ;
//   - frais annexe d'un document au rendu complet arrondi au centime (calcul d'origine sinon) ;
//   - sauvegarde automatique déclenchée par toute saisie enregistrée : tables personnalisées, frais
//     annexes, adresse (avant : client, lignes, matériaux, titre et remise seulement) ; le lien vers le
//     devis d'origine survit à la remise à null d'`initialData` par la section parente ; un brouillon
//     à identifiant horodaté et sans numéro n'est pas envoyé à une synchro qui le refuserait ;
//   - échéance « fin de mois » d'un document au rendu complet au bon jour en heure de Paris ;
//   - « Télécharger » du formulaire et téléchargement depuis la liste : mêmes lignes, même TVA.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import type { ArtisanBasic } from '@/lib/devis-types'
import { entreesPdfV2 } from '../helpers/mocks-formulaires-devis'

vi.mock('@/lib/i18n/context', async () => (await import('../helpers/mocks-formulaires-devis')).traductions())
vi.mock('@/lib/supabase', async () => (await import('../helpers/mocks-formulaires-devis')).supabaseNavigateur())
vi.mock('@/lib/fetch-authentifie', async () => (await import('../helpers/mocks-formulaires-devis')).fetchAuthentifieVide())
vi.mock('sonner', async () => (await import('../helpers/mocks-formulaires-devis')).notifications())
vi.mock('@/lib/document-sync', async () => (await import('../helpers/mocks-formulaires-devis')).synchroMuette())
vi.mock('@/lib/pdf/devis-generator-v2', async () => (await import('../helpers/mocks-formulaires-devis')).generateurPdfV2Espion())
vi.mock('@/lib/pdf/pdfa3-wrap', async () => (await import('../helpers/mocks-formulaires-devis')).habillagePdfA3Neutre())

import DevisFactureForm from '@/components/DevisFactureForm'
import { produireFichierDocument } from '@/lib/pdf/download-saved-devis'
import { syncDocumentSafe } from '@/lib/document-sync'

const ARTISAN = { id: 'art-artisan-rendu', company_name: 'Plomberie Test EI', email: 'contact@plomberie.test' } as unknown as ArtisanBasic
const CLE_BROUILLONS = `fixit_drafts_${ARTISAN.id}`

const LIGNE = { id: 1, description: 'Remplacement chauffe-eau', qty: 1, unit: 'u', priceHT: 1000, tvaRate: 10, totalHT: 1000 }
const MATERIAU = { id: 2, description: 'Chauffe-eau 200 L', qty: 1, unit: 'u', priceHT: 300, tvaRate: 20, totalHT: 300 }
const FRAIS = { id: 3, designation: 'Trajet chantier', categorie: 'deplacement', quantite: 1, unite: 'forfait', prix_unitaire_ht: 45, tva_applicable: 20, total_ht: 45 }

// Document nouveau (création depuis une intervention, sans identifiant ni horodatage).
const NOUVEAU = {
  docType: 'devis', docTitle: 'Chauffe-eau', clientName: 'M. Nouveau', tvaEnabled: true,
  insuranceName: 'AXA', insuranceNumber: 'RC-1', acomptesEnabled: false, acomptes: [],
  lines: [LIGNE], materialLines: [MATERIAU], fraisAnnexes: [FRAIS],
}
// Brouillon enregistré avant la correction.
const ANCIEN = {
  ...NOUVEAU, id: '6f1c2a34-0000-4000-8000-00000000c001', docNumber: '', status: 'brouillon',
  clientName: 'M. Ancien', savedAt: '2026-10-02T10:00:00.000Z',
}

const brouillons = () => JSON.parse(localStorage.getItem(CLE_BROUILLONS) || '[]') as Array<Record<string, unknown>>
const monter = (initialData: unknown) => render(
  <DevisFactureForm artisan={ARTISAN} services={[]} bookings={[]} onBack={vi.fn()} initialData={initialData as never} />,
)
const enregistre = async () => {
  await waitFor(() => expect(brouillons()).toHaveLength(1), { timeout: 5000 })
  return brouillons()[0]
}
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Section parente comme DevisSection / FacturesSection : `initialData` remis à null après chaque
// enregistrement, sans démonter le formulaire.
function SectionParente({ document, sauvegardes }: { document: unknown; sauvegardes: unknown[] }) {
  const [initial, setInitial] = useState<unknown>(document)
  return (
    <DevisFactureForm artisan={ARTISAN} services={[]} bookings={[]} onBack={vi.fn()} initialData={initial as never}
      onSave={(d) => { sauvegardes.push(d); setInitial(null) }} />
  )
}

beforeEach(() => {
  localStorage.clear()
  entreesPdfV2.length = 0
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ number: 'DEV-2026-001' }), { status: 200 }))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('formulaire artisan — marque « rendu complet »', () => {
  it('document nouveau : marque posée', async () => {
    monter(NOUVEAU)
    expect((await enregistre()).versionRendu).toBe(2)
  })

  it('document d avant la correction rouvert : aucune marque (PDF et totaux d origine)', async () => {
    monter(ANCIEN)
    const brouillon = await enregistre()
    expect('versionRendu' in brouillon).toBe(false)
  })

  it('duplicata d un document d avant : document nouveau, marque posée', async () => {
    monter({ ...ANCIEN, id: Date.now().toString(), isDuplicate: true, savedAt: undefined })
    expect((await enregistre()).versionRendu).toBe(2)
  })

  it('facture tirée d un devis d avant la correction : suit son devis (aucune marque)', async () => {
    const { id: _i, savedAt: _s, status: _st, ...reste } = ANCIEN
    monter({ ...reste, docType: 'facture', sourceDevisNumber: 'DEV-2026-010', sourceDevisId: ANCIEN.id })
    const brouillon = await enregistre()
    expect('versionRendu' in brouillon).toBe(false)
  })
})

describe('formulaire artisan — frais annexe arrondi au centime (rendu complet seulement)', () => {
  const saisir = async (initialData: unknown) => {
    monter({ ...(initialData as object), fraisAnnexes: [{ ...FRAIS, prix_unitaire_ht: 0, total_ht: 0 }] })
    await enregistre()
    const ligne = screen.getByDisplayValue('Trajet chantier').closest('tr') as HTMLElement
    const [, quantite, prix] = Array.from(ligne.querySelectorAll('input'))
    fireEvent.change(quantite, { target: { value: '1,25' } })
    fireEvent.change(prix, { target: { value: '10,10' } })
    await waitFor(() => expect((brouillons()[0].fraisAnnexes as Array<{ prix_unitaire_ht: number }>)[0].prix_unitaire_ht).toBe(10.1), { timeout: 5000 })
    return (brouillons()[0].fraisAnnexes as Array<{ total_ht: number }>)[0].total_ht
  }

  it('document nouveau : 1,25 × 10,10 = 12,63 €', async () => {
    expect(await saisir(NOUVEAU)).toBe(12.63)
  })

  it('document d avant : calcul d origine (12,625)', async () => {
    expect(await saisir(ANCIEN)).toBe(12.625)
  })
})

describe('formulaire artisan — sauvegarde automatique', () => {
  it('une table personnalisée modifiée est enregistrée sans clic sur « Enregistrer »', async () => {
    monter({ ...ANCIEN, customTables: [{ id: 't1', name: 'Isolation', category: 'labor', lines: [{ id: 9, description: 'Isolant', qty: 1, unit: 'u', priceHT: 200, tvaRate: 5.5, totalHT: 200 }] }] })
    await enregistre()
    fireEvent.change(screen.getByDisplayValue('Isolant'), { target: { value: 'Isolant laine de bois' } })
    await waitFor(() => {
      const tables = brouillons()[0].customTables as Array<{ lines: Array<{ description: string }> }>
      expect(tables[0].lines[0].description).toBe('Isolant laine de bois')
    }, { timeout: 5000 })
  })

  it('un frais annexe et l adresse du client aussi', async () => {
    monter(ANCIEN)
    await enregistre()
    fireEvent.change(screen.getByDisplayValue('Trajet chantier'), { target: { value: 'Trajet chantier aller-retour' } })
    fireEvent.change(screen.getByPlaceholderText('devis.clientAddressPlaceholder'), { target: { value: '3 rue des Lilas 13600 La Ciotat' } })
    await waitFor(() => {
      const brouillon = brouillons()[0]
      expect((brouillon.fraisAnnexes as Array<{ designation: string }>)[0].designation).toBe('Trajet chantier aller-retour')
      expect(brouillon.clientAddress).toBe('3 rue des Lilas 13600 La Ciotat')
    }, { timeout: 5000 })
  })

  it('facture tirée d un devis : le lien survit à la remise à null d initialData, aucun réenregistrement de plus', async () => {
    const sauvegardes: unknown[] = []
    const { id: _i, savedAt: _s, status: _st, ...reste } = ANCIEN
    render(<SectionParente document={{ ...reste, docType: 'facture', sourceDevisNumber: 'DEV-2026-010', sourceDevisId: ANCIEN.id, versionRendu: 2 }} sauvegardes={sauvegardes} />)
    await enregistre()
    await attendre(2500)
    expect(sauvegardes).toHaveLength(1)
    expect(brouillons()[0]).toMatchObject({ sourceDevisNumber: 'DEV-2026-010', sourceDevisId: ANCIEN.id })
  })

  it('brouillon à identifiant horodaté et sans numéro : enregistré localement, aucune synchro vouée au refus', async () => {
    const synchro = vi.mocked(syncDocumentSafe)
    synchro.mockClear()
    monter({ ...ANCIEN, id: '1779539827817', isDuplicate: true, savedAt: undefined })
    await enregistre()
    expect(synchro).not.toHaveBeenCalled()
    cleanup()
    localStorage.clear()
    monter(ANCIEN)
    await enregistre()
    expect(synchro).toHaveBeenCalledTimes(1)
  })

  it('formulaire sans contenu : rien n est enregistré', async () => {
    monter({ docType: 'devis' })
    await attendre(2000)
    expect(brouillons()).toHaveLength(0)
  })
})

describe('formulaire artisan — échéance « 30 jours fin de mois » en heure de Paris', () => {
  const fuseauInitial = process.env.TZ
  beforeEach(() => { process.env.TZ = 'Europe/Paris' })
  afterEach(() => { process.env.TZ = fuseauInitial })
  const facture = { docType: 'facture', docDate: '2026-11-13', sentAt: '2026-11-13T09:00:00.000Z', paymentCondition: '30 jours fin de mois' }

  it('document au rendu complet : 31/12, dernier jour du mois', async () => {
    monter({ ...NOUVEAU, ...facture, paymentDue: '' })
    expect((await enregistre()).paymentDue).toBe('2026-12-31')
  })

  it('document d avant la correction : échéance d origine inchangée (30/12)', async () => {
    monter({ ...ANCIEN, ...facture, paymentDue: '2026-12-30' })
    expect((await enregistre()).paymentDue).toBe('2026-12-30')
  })
})

describe('« Télécharger » du formulaire et téléchargement depuis la liste : même PDF', () => {
  it('document au rendu complet : mêmes lignes (matériaux et frais compris), même TVA, mêmes sections', async () => {
    monter(NOUVEAU)
    const brouillon = await enregistre()
    fireEvent.click(screen.getByText('devis.downloadPdf'))
    await waitFor(() => expect(entreesPdfV2).toHaveLength(1), { timeout: 5000 })
    await produireFichierDocument(brouillon as never, { locale: 'fr', t: (k: string) => k, artisan: ARTISAN as never })
    expect(entreesPdfV2).toHaveLength(2)
    const [formulaire, liste] = entreesPdfV2
    for (const cle of ['lignes', 'mode_affichage', 'tvaBreakdown', 'remiseGlobale', 'acomptes', 'customSectionLabels', 'versionRendu']) {
      expect(liste[cle], cle).toEqual(formulaire[cle])
    }
    expect((formulaire.lignes as Array<{ designation: string }>).map((l) => l.designation))
      .toEqual(['Remplacement chauffe-eau', 'Chauffe-eau 200 L', 'Trajet chantier'])
    expect(formulaire.tvaBreakdown).toEqual([{ rate: 20, base: 345, amount: 69 }, { rate: 10, base: 1000, amount: 100 }])
  })
})
