// Taux d'IVA des formulaires de devis et de factures sur /pt — constat de Frédéric du 20/11/2026 : « IVA 20 % est
// proposé aux utilisateurs PT côté artisan et BTP Pro, alors qu'au Portugal c'est 23 % par défaut, et 6 % est possible
// aussi sous certaines conditions ». Vrais formulaires (components/DevisFactureFormBTP.tsx,
// components/DevisFactureForm.tsx), en portugais puis en français (rendu français inchangé). Une ligne déjà
// enregistrée garde son taux, affiché tel quel. En fin de fichier, même banc : forme juridique portugaise du
// formulaire artisan (demande du 22/11/2026).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import type { ArtisanBasic } from '@/lib/devis-types'
import { traducteurDevisBtp } from '@/lib/devis-btp-traduction'

const langue = vi.hoisted(() => ({ locale: 'pt' as 'fr' | 'pt' }))
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (cle: string) => cle, locale: langue.locale }),
  useLocale: () => langue.locale,
}))
vi.mock('@/lib/supabase', async () => (await import('../helpers/mocks-formulaires-devis')).supabaseNavigateur())
vi.mock('@/lib/fetch-authentifie', async () => (await import('../helpers/mocks-formulaires-devis')).fetchAuthentifieVide())
vi.mock('sonner', async () => (await import('../helpers/mocks-formulaires-devis')).notifications())
vi.mock('@/lib/document-sync', async () => (await import('../helpers/mocks-formulaires-devis')).synchroMuette())
vi.mock('@/components/dashboard/btp/RentabiliteDevisModal', () => ({ default: () => null }))

import DevisFactureFormBTP from '@/components/DevisFactureFormBTP'
import DevisFactureForm from '@/components/DevisFactureForm'

const SOCIETE_PT = {
  id: 'art-btp-iva-pt', company_name: 'CONSTRUCOES EXEMPLO LDA', email: 'geral@exemplo.pt',
  legal_form: 'Sociedade por Quotas (Lda.)', company_address: 'Rua Direita 10, 4990-000 Ponte de Lima',
} as ArtisanBasic
const SOCIETE_FR = { id: 'art-btp-iva-fr', company_name: 'BATI EXEMPLE SARL', email: 'contact@bati.test', legal_form: 'SARL' } as ArtisanBasic
const ARTISAN = { id: 'art-iva', company_name: 'Canalizações Exemplo', email: 'geral@canalizacoes.test' } as unknown as ArtisanBasic

const monterBtp = (props: { initialData?: unknown; services?: unknown[]; bookings?: unknown[] } = {}) => render(
  <DevisFactureFormBTP
    artisan={langue.locale === 'pt' ? SOCIETE_PT : SOCIETE_FR}
    services={(props.services ?? []) as never}
    bookings={(props.bookings ?? []) as never}
    onBack={vi.fn()}
    initialData={props.initialData as never}
  />,
)
const monterArtisan = (initialData: unknown) => render(
  <DevisFactureForm artisan={ARTISAN} services={[]} bookings={[]} onBack={vi.fn()} initialData={initialData as never} />,
)

/** Sélecteurs de taux de TVA de l'écran : listes dont chaque option est un pourcentage (« 23% », « 5,5% », « 5.5% »). */
const selecteursTva = (racine: HTMLElement) => Array.from(racine.querySelectorAll('select')).filter((s) =>
  s.options.length > 1 && Array.from(s.options).every((o) => /^\d+([.,]\d+)?%$/.test((o.textContent || '').trim())))
const valeurs = (s: HTMLSelectElement) => Array.from(s.options).map((o) => o.value)
const libelles = (s: HTMLSelectElement) => Array.from(s.options).map((o) => o.textContent)
const affiche = (s: HTMLSelectElement) => s.options[s.selectedIndex]?.textContent

/** Lignes TVA du résumé du formulaire BTP (« libellé | montant », espaces insécables normalisés). */
const lignesResumeTva = (racine: HTMLElement) => Array.from(racine.querySelectorAll('.dv-resume-row.tva, .dv-resume-row.tva-total'))
  .map((ligne) => Array.from(ligne.querySelectorAll('span')).map((s) => (s.textContent || '').replace(/\s+/g, ' ').trim()).join(' | '))
/** Corps des appels à la lecture des factures fournisseurs. */
const appelsLectureFournisseur = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
  .filter(([url]) => url === '/api/supplier-invoice-scan')
  .map(([, init]) => JSON.parse(String((init as RequestInit).body)) as { pays?: string })

/** Ligne de document enregistrée avant le correctif, à 20 %. */
const LIGNE_20 = { id: 1, description: 'Reboco', qty: 10, unit: 'm2', priceHT: 30, tvaRate: 20, totalHT: 300 }

beforeEach(() => {
  localStorage.clear()
  langue.locale = 'pt'
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('formulaire BTP sur /pt', () => {
  const tx = traducteurDevisBtp('pt')

  it('nouveau document : prestations, matériaux et frais partent à 23 % et proposent 23, 13, 6 et 0 %', () => {
    const { container } = monterBtp()
    const selecteurs = selecteursTva(container)
    expect(selecteurs).toHaveLength(3)
    for (const s of selecteurs) {
      expect(s.value).toBe('23')
      expect(valeurs(s)).toEqual(['23', '13', '6', '0'])
    }
  })

  it('lignes ajoutées : 23 % (prestation, matériau, frais)', () => {
    const { container } = monterBtp()
    fireEvent.click(screen.getByText(tx('+ Ajouter une ligne')))
    fireEvent.click(screen.getByText(tx('+ Ajouter un matériau')))
    fireEvent.click(screen.getByText(tx('+ Ajouter un frais')))
    expect(selecteursTva(container).map((s) => s.value)).toEqual(Array(6).fill('23'))
  })

  it('table ajoutée : sa première ligne et les suivantes partent à 23 %', () => {
    const { container } = monterBtp()
    fireEvent.click(screen.getByText(tx('+ Ajouter une table')))
    const nouvelleTable = screen.getAllByRole('button').find((b) => (b.textContent || '').startsWith(tx('✚ Nouvelle table «')))
    expect(nouvelleTable).toBeDefined()
    fireEvent.click(nouvelleTable!)
    fireEvent.change(screen.getByPlaceholderText(tx('Ex : Électricité')), { target: { value: 'Pintura' } })
    fireEvent.click(screen.getByText(tx('Créer la table')))
    expect(selecteursTva(container).map((s) => s.value)).toEqual(Array(4).fill('23'))
    fireEvent.click(screen.getAllByText(tx('+ Ajouter une ligne'))[1])
    const selecteurs = selecteursTva(container)
    expect(selecteurs.map((s) => s.value)).toEqual(Array(5).fill('23'))
    expect(valeurs(selecteurs[4])).toEqual(['23', '13', '6', '0'])
  })

  it('6 % (taux réduit, sous conditions) : se choisit ligne par ligne, jamais posé d\'office', () => {
    const { container } = monterBtp()
    fireEvent.change(selecteursTva(container)[0], { target: { value: '6' } })
    const selecteurs = selecteursTva(container)
    expect(selecteurs.map((s) => s.value)).toEqual(['6', '23', '23'])
    expect(affiche(selecteurs[0])).toBe('6%')
  })

  it('prestation choisie dans le catalogue : taux normal portugais (23 %), comme 20 % en France', async () => {
    const services = [{ id: 'svc-1', name: 'Pintura de fachada', price_ht: 1000, price_ttc: 1230 }]
    const { container } = monterBtp({ services })
    fireEvent.change(selecteursTva(container)[0], { target: { value: '6' } })
    fireEvent.click(screen.getAllByText('▾')[0])
    fireEvent.click(screen.getByText(/^Pintura de fachada/))
    await waitFor(() => expect(screen.getByDisplayValue('Pintura de fachada')).toBeInTheDocument())
    expect(selecteursTva(container)[0].value).toBe('23')
  })

  it('intervention importée : sa ligne part à 23 %', () => {
    const bookings = [{
      id: 'bk-1', status: 'confirmed', booking_date: '2026-11-18', client_name: 'Maria Silva', address: 'Rua A 1, Porto',
      price_ht: 500, services: { name: 'Reparação de telhado' },
    }]
    const { container } = monterBtp({ bookings })
    const choix = Array.from(container.querySelectorAll('select')).find((s) => Array.from(s.options).some((o) => o.value === 'bk-1'))
    expect(choix).toBeDefined()
    fireEvent.change(choix!, { target: { value: 'bk-1' } })
    expect(screen.getByDisplayValue('Reparação de telhado')).toBeInTheDocument()
    expect(selecteursTva(container)[0].value).toBe('23')
  })

  it('lecture d\'une facture fournisseur : le formulaire transmet le pays (« pt »)', async () => {
    const { container } = monterBtp()
    const fichier = container.querySelector<HTMLInputElement>('input[type="file"][accept=".pdf,image/jpeg,image/png,image/webp"]')
    expect(fichier).not.toBeNull()
    fireEvent.change(fichier!, { target: { files: [new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'fatura.png', { type: 'image/png' })] } })
    await waitFor(() => expect(appelsLectureFournisseur()).toHaveLength(1))
    expect(appelsLectureFournisseur()[0].pays).toBe('pt')
  })

  it('résumé : une ligne vide (23 % par défaut) n\'ajoute pas « IVA 23 % 0,00 € » à côté du vrai taux', () => {
    // Main-d'œuvre à 6 % (rénovation d'un logement), matériaux et frais laissés vides
    const { container } = monterBtp({ initialData: { lines: [{ ...LIGNE_20, tvaRate: 6 }] } })
    expect(lignesResumeTva(container)).toEqual(['IVA 6 % | 18,00 €'])
  })

  it('résumé d\'un brouillon d\'avant à 20 %, rouvert sans matériaux ni frais : identique (ni « IVA 23 % », ni total)', () => {
    const { container } = monterBtp({ initialData: {
      id: '6f1c2a34-0000-4000-8000-00000000d001', docType: 'devis', status: 'brouillon', clientName: 'Cliente Exemplo',
      lines: [LIGNE_20], materialLines: [], fraisLines: [],
    } })
    expect(lignesResumeTva(container)).toEqual(['IVA 20 % | 60,00 €'])
  })

  it('résumé, lignes toutes à 0 % (isento) : « IVA 0 % », plus « IVA 20 % »', () => {
    const { container } = monterBtp({ initialData: { lines: [{ ...LIGNE_20, tvaRate: 0 }] } })
    expect(lignesResumeTva(container)).toEqual(['IVA 0 % | 0,00 €'])
  })

  it('document encore vide : le résumé montre le taux de ses lignes, 23 %', () => {
    const { container } = monterBtp()
    expect(lignesResumeTva(container)).toEqual(['IVA 23 % | 0,00 €'])
  })

  it('document enregistré à 20 % : chaque ligne garde 20 %, affiché tel quel parmi les taux portugais', () => {
    const { container } = monterBtp({ initialData: {
      docType: 'devis', docNumber: 'DEV-2026-001', status: 'envoye', clientName: 'Cliente Exemplo', lines: [LIGNE_20],
      materialLines: [{ ...LIGNE_20, id: 2, description: 'Cimento' }], fraisLines: [{ ...LIGNE_20, id: 3, description: 'Deslocação' }],
    } })
    const selecteurs = selecteursTva(container)
    expect(selecteurs).toHaveLength(3)
    for (const s of selecteurs) {
      expect(s.value).toBe('20')
      expect(affiche(s)).toBe('20%')
      expect(valeurs(s)).toEqual(['23', '20', '13', '6', '0'])
    }
  })
})

describe('formulaire BTP en français : inchangé', () => {
  beforeEach(() => { langue.locale = 'fr' })

  it('20 % par défaut ; 20, 10, 5.5 et 0 % proposés', () => {
    const { container } = monterBtp()
    const selecteurs = selecteursTva(container)
    expect(selecteurs).toHaveLength(3)
    for (const s of selecteurs) {
      expect(s.value).toBe('20')
      expect(valeurs(s)).toEqual(['20', '10', '5.5', '0'])
      expect(libelles(s)).toEqual(['20%', '10%', '5.5%', '0%'])
    }
    fireEvent.click(screen.getByText('+ Ajouter une ligne'))
    expect(selecteursTva(container).map((s) => s.value)).toEqual(['20', '20', '20', '20'])
  })

  it('résumé et lecture fournisseur inchangés (lignes vides comprises, « TVA 20 % » quand rien n\'est taxé)', async () => {
    const reduit = monterBtp({ initialData: { lines: [{ ...LIGNE_20, tvaRate: 10 }] } })
    expect(lignesResumeTva(reduit.container)).toEqual(['TVA 10 % | 30,00 €', 'TVA 20 % | 0,00 €', 'Total TVA | 30,00 €'])
    cleanup()
    const exonere = monterBtp({ initialData: { lines: [{ ...LIGNE_20, tvaRate: 0 }] } })
    expect(lignesResumeTva(exonere.container)).toEqual(['TVA 20 % | 0,00 €'])
    const fichier = exonere.container.querySelector<HTMLInputElement>('input[type="file"][accept=".pdf,image/jpeg,image/png,image/webp"]')
    fireEvent.change(fichier!, { target: { files: [new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'facture.png', { type: 'image/png' })] } })
    await waitFor(() => expect(appelsLectureFournisseur()).toHaveLength(1))
    expect(appelsLectureFournisseur()[0].pays).toBe('fr')
  })

  it('table ajoutée : 10 % comme avant', () => {
    const { container } = monterBtp()
    fireEvent.click(screen.getByText('+ Ajouter une table'))
    fireEvent.click(screen.getAllByRole('button').find((b) => (b.textContent || '').startsWith('✚ Nouvelle table «'))!)
    fireEvent.change(screen.getByPlaceholderText('Ex : Électricité'), { target: { value: 'Peinture' } })
    fireEvent.click(screen.getByText('Créer la table'))
    expect(selecteursTva(container).map((s) => s.value)).toEqual(['20', '20', '20', '10'])
  })
})

describe('formulaire artisan sur /pt', () => {
  const ajouterTable = (nom: string) => {
    fireEvent.click(screen.getByText('+ Ajouter une table de prestations'))
    fireEvent.change(screen.getByPlaceholderText(/^Ex : TRAVAUX PARTIES COMMUNES/), { target: { value: nom } })
    fireEvent.click(screen.getByText('Créer la table'))
  }

  it('ligne neuve et table ajoutée : 23 %, taux portugais seulement (la table proposait 0, 5.5, 10 et 20 % et affichait 0 %)', () => {
    const { container } = monterArtisan({ tvaEnabled: true })
    const [ligne] = selecteursTva(container)
    expect(ligne.value).toBe('23')
    expect(valeurs(ligne)).toEqual(['23', '13', '6', '0'])
    ajouterTable('Pintura')
    const selecteurs = selecteursTva(container)
    expect(selecteurs.map((s) => s.value)).toEqual(['23', '23'])
    expect(valeurs(selecteurs[1])).toEqual(['23', '13', '6', '0'])
    expect(affiche(selecteurs[1])).toBe('23%')
  })

  it('ligne arrivée à 20 % (document enregistré, devis préparé par Fixy avant ce correctif) : 20 % affiché, pas 23 %', () => {
    const { container } = monterArtisan({
      tvaEnabled: true,
      lines: [{ ...LIGNE_20, description: 'Substituição de torneira' }],
      fraisAnnexes: [{ id: 2, designation: 'Deslocação', categorie: 'deplacement', quantite: 1, unite: 'forfait', prix_unitaire_ht: 20, tva_applicable: 20, total_ht: 20 }],
    })
    const selecteurs = selecteursTva(container)
    expect(selecteurs.map((s) => s.value)).toEqual(['20', '20'])
    for (const s of selecteurs) {
      expect(affiche(s)).toBe('20%')
      expect(valeurs(s)).toEqual(['23', '20', '13', '6', '0'])
    }
  })
})

describe('formulaire artisan en français : inchangé', () => {
  it('lignes : 20 % par défaut, 20, 10, 5,5 et 0 % ; tables ajoutées : 0, 5.5, 10 et 20 %', () => {
    langue.locale = 'fr'
    const { container } = monterArtisan({ tvaEnabled: true })
    const [ligne] = selecteursTva(container)
    expect(ligne.value).toBe('20')
    expect(valeurs(ligne)).toEqual(['20', '10', '5.5', '0'])
    expect(libelles(ligne)).toEqual(['20%', '10%', '5,5%', '0%'])
    fireEvent.click(screen.getByText('+ Ajouter une table de prestations'))
    fireEvent.change(screen.getByPlaceholderText(/^Ex : TRAVAUX PARTIES COMMUNES/), { target: { value: 'Peinture' } })
    fireEvent.click(screen.getByText('Créer la table'))
    const table = selecteursTva(container)[1]
    expect(table.value).toBe('20')
    expect(valeurs(table)).toEqual(['0', '5.5', '10', '20'])
    expect(libelles(table)).toEqual(['0%', '5.5%', '10%', '20%'])
  })
})

// Demande de Frédéric du 22/11/2026 : une forme portugaise (profil ou vérification de l'entreprise) n'est plus lue
// « ei » sur /pt, sans mention d'identification ni contrôle du capital. Sur /fr, lecture d'avant. Un document déjà
// émis, rouvert, garde sa forme ; le régime d'IVA par défaut ne change pas.
describe('formulaire artisan : forme juridique portugaise', () => {
  const monterForme = (legalForm?: string, initialData?: unknown) => render(
    <DevisFactureForm
      artisan={{ ...ARTISAN, ...(legalForm ? { legal_form: legalForm } : {}) } as ArtisanBasic}
      services={[]} bookings={[]} onBack={vi.fn()} initialData={initialData as never}
    />,
  )
  /** Statut juridique affiché par le contrôle de conformité (« devis.statusLabel : … »). */
  const statut = (racine: HTMLElement) => Array.from(racine.querySelectorAll('.v22-ref'))
    .find((e) => (e.textContent || '').startsWith('devis.statusLabel'))?.querySelector('span')?.textContent
  /** Mentions légales de l'écran (t est l'identité : ce sont des clés). */
  const mentions = (racine: HTMLElement) => Array.from(Array.from(racine.querySelectorAll('.v22-card'))
    .find((c) => c.querySelector('.v22-card-title')?.textContent === 'devis.legalMentionsLabel')?.querySelectorAll('.v22-ref') ?? [])
    .map((m) => m.textContent)
  /** Réponse de /api/artisan-company : forme lue par la vérification de l'entreprise. */
  const verification = (legalForm: string) => vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(
    String(url).startsWith('/api/artisan-company') ? JSON.stringify({ company: { legalForm }, verified: true }) : '{}', { status: 200 })))
  const verifiee = (racine: HTMLElement) => waitFor(() => expect(racine.textContent).toContain('devis.verifiedDataSource'))
  const capitalExige = (racine: HTMLElement) => (racine.textContent || '').includes('devis.complianceCapital')

  it('Lda du profil sur /pt : reconnue, mention de société et contrôle du capital', () => {
    const { container } = monterForme('Sociedade por Quotas (Lda.)')
    expect(statut(container)).toBe('Sociedade por Quotas (Lda.)')
    expect(mentions(container)).toContain('devis.legal.sarlCapital')
    expect(capitalExige(container)).toBe(true)
  })

  it.each([
    ['Empresário em Nome Individual (ENI)', false],
    ['Unipessoal Lda.', true],
    ['Sociedade Anónima (SA)', true],
  ])('« %s » du profil sur /pt : reconnue, capital exigé : %s', (forme, capital) => {
    const { container } = monterForme(forme)
    expect(statut(container)).toBe(forme)
    expect(capitalExige(container)).toBe(capital)
  })

  it('sans forme au profil, ou sur /fr : lecture d\'avant', () => {
    expect(statut(monterForme().container)).toBe('Entreprise Individuelle (EI)')
    cleanup()
    langue.locale = 'fr'
    expect(statut(monterForme('Sociedade por Quotas (Lda.)').container)).toBe('Entreprise Individuelle (EI)')
    cleanup()
    expect(statut(monterForme('SARL').container)).toBe('SARL')
  })

  it('vérification sur /pt : un brouillon rouvert prend la forme vérifiée, un document émis rouvert garde la sienne', async () => {
    verification('Sociedade por Quotas')
    const brouillon = monterForme(undefined, { companyStatus: 'ei', docType: 'devis', status: 'brouillon', lines: [] })
    await verifiee(brouillon.container)
    expect(statut(brouillon.container)).toBe('Sociedade por Quotas (Lda.)')
    cleanup()
    const emis = monterForme(undefined, { companyStatus: 'ei', docType: 'devis', docNumber: 'DEV-2026-001', status: 'envoye', lines: [] })
    await verifiee(emis.container)
    expect(statut(emis.container)).toBe('Entreprise Individuelle (EI)')
  })

  it('ENI vérifié sur /pt : reconnu, sans couper l\'IVA du modèle de l\'artisan', async () => {
    // Modèle de l'artisan : IVA appliquée (le champ du numéro d'IVA n'apparaît qu'avec elle)
    localStorage.setItem(`fixit_devis_template_${ARTISAN.id}`, JSON.stringify({ tvaEnabled: true }))
    verification('Empresário em Nome Individual')
    const { container } = monterForme('Sociedade Anónima (SA)')
    expect(container.textContent).toContain('devis.taxNumberLabel')
    await verifiee(container)
    expect(statut(container)).toBe('Empresário em Nome Individual (ENI)')
    expect(container.textContent).toContain('devis.taxNumberLabel')
  })
})
