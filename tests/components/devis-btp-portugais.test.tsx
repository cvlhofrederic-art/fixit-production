// Formulaire de devis et facture BTP sur /pt (components/DevisFactureFormBTP.tsx), constats de Frédéric du 17/11/2026
// pour la société Method Soluções : « sociedade por quotas » s'affichait « Entreprise Individuelle (EI) », et toute la
// création de devis restait en français. Le vrai formulaire est rendu en portugais puis en français.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import type { ArtisanBasic } from '@/lib/devis-types'
import { TEXTES_DEVIS_BTP_PT } from '@/lib/devis-btp-traduction'

const langue = vi.hoisted(() => ({ locale: 'pt' as 'fr' | 'pt' }))
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (cle: string) => cle, locale: langue.locale }),
  useLocale: () => langue.locale,
}))
vi.mock('@/lib/supabase', async () => (await import('../helpers/mocks-formulaires-devis')).supabaseNavigateur())
vi.mock('@/lib/fetch-authentifie', async () => (await import('../helpers/mocks-formulaires-devis')).fetchAuthentifieVide())
vi.mock('sonner', async () => (await import('../helpers/mocks-formulaires-devis')).notifications())
vi.mock('@/lib/document-sync', async () => (await import('../helpers/mocks-formulaires-devis')).synchroMuette())
// Fenêtre de rentabilité simulée : on garde la langue que le formulaire lui transmet
const fenetre = vi.hoisted(() => ({ langues: [] as Array<string | undefined> }))
vi.mock('@/components/dashboard/btp/RentabiliteDevisModal', () => ({
  default: (props: { langue?: string }) => { fenetre.langues.push(props.langue); return null },
}))

import DevisFactureFormBTP from '@/components/DevisFactureFormBTP'

const LDA = 'Sociedade por Quotas (Lda.)'
const SOCIETE_PT = {
  id: 'art-btp-pt', company_name: 'CONSTRUCOES EXEMPLO LDA', email: 'geral@exemplo.pt', legal_form: LDA,
  company_address: 'Rua Direita 10, 4990-000 Ponte de Lima',
} as ArtisanBasic

const monter = (initialData?: unknown, artisan: ArtisanBasic = SOCIETE_PT) => render(
  <DevisFactureFormBTP artisan={artisan} services={[]} bookings={[]} onBack={vi.fn()} initialData={initialData as never} />,
)

/** Textes visibles et attributs lus par l'utilisateur (placeholder, title, aria-label, alt). */
function textesAffiches(racine: HTMLElement): string[] {
  const textes: string[] = []
  const parcours = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT)
  for (let n = parcours.nextNode(); n; n = parcours.nextNode()) {
    if (n.parentElement?.tagName !== 'STYLE') textes.push((n.textContent || '').trim())
  }
  for (const el of Array.from(racine.querySelectorAll('[placeholder],[title],[aria-label],[alt]'))) {
    for (const attr of ['placeholder', 'title', 'aria-label', 'alt']) {
      const v = el.getAttribute(attr)
      if (v) textes.push(v.trim())
    }
  }
  return textes.filter(Boolean)
}

beforeEach(() => {
  localStorage.clear()
  langue.locale = 'pt'
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('société par quotas (Lda) : plus jamais « Entreprise Individuelle (EI) »', () => {
  it('en portugais : forme juridique et mention de la société, sans ENI', () => {
    const { container } = monter()
    expect(screen.getByDisplayValue(LDA)).toBeDisabled()
    const mentions = container.querySelector('.dv-mentions')?.textContent || ''
    expect(mentions).toContain(`${LDA} com capital social de [capital a indicar] €. Sede: Rua Direita 10, 4990-000 Ponte de Lima.`)
    expect(mentions).not.toContain('Empresário em Nome Individual')
    expect(container.textContent).not.toContain('Entreprise Individuelle')
  })

  it('en français (même société) : sa forme portugaise et sa mention, sans EI', () => {
    langue.locale = 'fr'
    const { container } = monter()
    expect(screen.getByDisplayValue(LDA)).toBeDisabled()
    expect(container.querySelector('.dv-mentions')?.textContent).toContain(`${LDA} au capital de [capital à renseigner] €. Siège social : Rua Direita 10`)
    expect(container.textContent).not.toContain('Entreprise Individuelle')
    expect(container.textContent).not.toContain('Loi n°2022-172')
  })

  it('société en nom collectif portugaise : sa forme, ni EI ni ENI ni capital', () => {
    const { container } = monter(undefined, { ...SOCIETE_PT, legal_form: 'Sociedade em Nome Coletivo' } as ArtisanBasic)
    expect(screen.getByDisplayValue('Sociedade em Nome Coletivo')).toBeDisabled()
    const mentions = container.querySelector('.dv-mentions')?.textContent || ''
    expect(mentions).toContain('Sociedade em Nome Coletivo. Sede: Rua Direita 10, 4990-000 Ponte de Lima.')
    expect(mentions).not.toContain('Empresário em Nome Individual')
  })

  it('capital social exigé pour une Lda (astérisque), comme pour une SARL', () => {
    monter()
    const libelle = screen.getByText('Capital social').closest('label')
    expect(libelle?.querySelector('.req')).not.toBeNull()
  })
})

describe('création de devis en portugais', () => {
  it('aucun texte de l\'écran ne reste en français', () => {
    const { container } = monter()
    const francais = new Set(Object.entries(TEXTES_DEVIS_BTP_PT).filter(([fr, pt]) => fr !== pt).map(([fr]) => fr))
    const textes = textesAffiches(container)
    expect(textes.length).toBeGreaterThan(150)
    expect(textes).toContain('Forma jurídica')
    expect(textes.filter((t) => francais.has(t))).toEqual([])
    for (const mot of ['Statut juridique', 'Raison sociale', 'Enregistrer brouillon', 'Télécharger PDF', 'DÉSIGNATION', 'Mode de paiement']) {
      expect(container.textContent).not.toContain(mot)
    }
  })

  it('libellés portugais, valeurs des listes enregistrées en français (PDF et échéance)', () => {
    monter()
    expect(screen.getByText('Forma jurídica')).toBeInTheDocument()
    expect(screen.getByText('Guardar rascunho')).toBeInTheDocument()
    expect(screen.getByText('Descarregar PDF')).toBeInTheDocument()
    expect(screen.getAllByText('DESIGNAÇÃO').length).toBeGreaterThan(0)
    const virement = screen.getByRole('option', { name: 'Transferência bancária' }) as HTMLOptionElement
    expect(virement.value).toBe('Virement bancaire')
    expect(virement.selected).toBe(true)
    const comptant = screen.getByRole('option', { name: 'A pronto, na receção' }) as HTMLOptionElement
    expect(comptant.value).toBe('Comptant à réception')
  })

  it('contrôle de conformité : un NIF portugais de 9 chiffres est accepté', () => {
    const { container } = monter(undefined, { ...SOCIETE_PT, siret: '512 345 678' } as ArtisanBasic)
    const ligne = Array.from(container.querySelectorAll('.dv-conf-item')).find((el) => el.firstElementChild?.textContent === 'NIF')
    expect(ligne?.querySelector('.dv-conf-check')).not.toBeNull()
  })

  it('la fenêtre « Rentabilité du devis » reçoit la langue portugaise du formulaire', () => {
    fenetre.langues = []
    monter()
    fireEvent.click(screen.getByText('📊 Rentabilidade do orçamento'))
    expect(fenetre.langues.at(-1)).toBe('pt')
  })

  it('nouveau document : valeurs par défaut en portugais', () => {
    monter()
    expect(screen.getByDisplayValue('Taxa de juro legal em vigor')).toBeInTheDocument()
    expect(screen.getByDisplayValue('40 € (apenas B2B)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Portugal continental')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Mão de obra')).toBeInTheDocument()
    expect((screen.getByRole('option', { name: 'Portugal' }) as HTMLOptionElement).selected).toBe(true)
  })

  it('document déjà enregistré : ses valeurs restent telles quelles, brouillon réenregistré sans changement', async () => {
    const brouillon = {
      id: '6f1c2a34-0000-4000-8000-00000000f001', savedAt: '2026-11-17T10:00:00.000Z', docNumber: '', status: 'brouillon',
      docType: 'devis', companyStatus: 'Entreprise Individuelle (EI)', clientName: 'Cliente Teste',
      penaltyRate: "3 × taux d'intérêt légal en vigueur", recoveryFee: '40 € (BtoB uniquement)', insuranceCoverage: 'France métropolitaine',
      linesName: "Main d'œuvre", clientStreet: '14 rue Colbert', clientPostalCode: '13001', clientCity: 'Marseille', clientCountry: 'France',
      clientAddress: '14 rue Colbert, 13001 Marseille',
      lines: [{ id: 1, description: 'Limpeza de telhado', qty: 1, unit: 'f', priceHT: 900, tvaRate: 20, totalHT: 900 }],
      materialLines: [], fraisLines: [],
    }
    monter(brouillon)
    expect(screen.getByDisplayValue('Entreprise Individuelle (EI)')).toBeDisabled()
    expect(screen.getByDisplayValue("3 × taux d'intérêt légal en vigueur")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Main d'œuvre")).toBeInTheDocument()
    await waitFor(() => expect(JSON.parse(localStorage.getItem(`fixit_drafts_${SOCIETE_PT.id}`) || '[]')).toHaveLength(1), { timeout: 5000 })
    const [enregistre] = JSON.parse(localStorage.getItem(`fixit_drafts_${SOCIETE_PT.id}`) || '[]')
    for (const cle of ['companyStatus', 'penaltyRate', 'recoveryFee', 'insuranceCoverage', 'linesName', 'clientCountry', 'clientAddress'] as const) {
      expect(enregistre[cle], cle).toBe(brouillon[cle])
    }
  })

  // Relecture adverse du 17/11/2026 : l'adresse se recompose à l'ouverture et part dans la sauvegarde automatique ;
  // sa règle ne doit pas dépendre de la langue (« , Portugal » retiré, « Belgique » traduite…).
  it.each([
    ['Portugal', 'Rua de Santa Catarina 14, 4000-447 Porto, Portugal'],
    ['Belgique', 'Rue Haute 1, 1000 Bruxelles, Belgique'],
    ['Autre', 'Calle Mayor 1, 28013 Madrid, Autre'],
  ])('brouillon existant au pays « %s » rouvert sur /pt : adresse réenregistrée à l\'identique', async (pays, adresse) => {
    const [rue, villeCp] = adresse.split(', ')
    const [cp, ...ville] = villeCp.split(' ')
    const brouillon = {
      id: `6f1c2a34-0000-4000-8000-00000000f0${pays.length}`, savedAt: '2026-11-17T10:00:00.000Z', docNumber: '', status: 'brouillon',
      docType: 'devis', clientName: 'Cliente', clientStreet: rue, clientPostalCode: cp, clientCity: ville.join(' '), clientCountry: pays,
      clientAddress: adresse, lines: [{ id: 1, description: 'Obra', qty: 1, unit: 'f', priceHT: 100, tvaRate: 20, totalHT: 100 }],
      materialLines: [], fraisLines: [],
    }
    monter(brouillon)
    await waitFor(() => expect(JSON.parse(localStorage.getItem(`fixit_drafts_${SOCIETE_PT.id}`) || '[]')).toHaveLength(1), { timeout: 5000 })
    const [enregistre] = JSON.parse(localStorage.getItem(`fixit_drafts_${SOCIETE_PT.id}`) || '[]')
    expect(enregistre.clientAddress).toBe(adresse)
    expect(enregistre.clientCountry).toBe(pays)
  })
})
