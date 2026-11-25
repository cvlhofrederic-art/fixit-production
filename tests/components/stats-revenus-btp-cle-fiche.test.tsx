// Statistiques et Revenus d'une société BTP (components/dashboard/StatsRevenusSection.tsx, mise en page V5).
// Le tableau de bord range les devis, factures et dépenses d'une société dans le navigateur sous l'identifiant de
// sa fiche (artisan.id) ; ces deux écrans les cherchaient sous celui du compte (artisan.user_id), qui n'y porte
// rien : chiffre d'affaires, factures, devis et dépenses à zéro pour une société sans réservation (constat
// stockage-local-miroir-8 de l'audit du 11/11/2026). Les factures relues depuis la base portent le statut de la
// base (« pending » pour une facture émise non payée, lib/document-sync.ts) : elles comptent comme envoyées. Un devis
// marqué « Accepté » depuis la liste (« accepte » dans le navigateur, « accepted » en base) compte comme signé, et
// « Encaissements récents » ne montre que des factures payées (retours de la relecture adverse).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { Artisan } from '@/lib/types'
import { formatPrice } from '@/lib/utils'

vi.mock('@/lib/i18n/context', async () => (await import('../helpers/mocks-formulaires-devis')).traductions())
vi.mock('sonner', async () => (await import('../helpers/mocks-formulaires-devis')).notifications())
vi.mock('@/components/stats/ResumeActivite', () => ({ default: () => null }))

import StatsRevenusSection from '@/components/dashboard/StatsRevenusSection'

const ARTISAN = { id: 'fiche-btp-stats', user_id: 'compte-btp-stats', company_name: 'BATIR TEST SAS' } as unknown as Artisan
// Horloge figée au 16/11/2026 à midi (heure locale) : documents datés du 10 novembre, donc du mois en cours quel que
// soit le fuseau de la machine.
const MAINTENANT = new Date(2026, 10, 16, 12)
const DATE_DOC = '2026-11-10'

const ligne = (description: string, totalHT: number) => ({ id: 1, description, qty: 1, unit: 'f', priceHT: totalHT, tvaRate: 20, totalHT })

const FACTURE_PAYEE = {
  id: 'fact-1', docType: 'facture', docNumber: 'FACT-2026-001', status: 'paid', docDate: DATE_DOC,
  clientName: 'SCI Les Tilleuls', docTitle: 'Ravalement façade', lines: [ligne('Ravalement', 1200)],
}
// Facture émise relue depuis la base : statut de la base, « pending ».
const FACTURE_EMISE = {
  id: 'fact-2', docType: 'facture', docNumber: 'FACT-2026-002', status: 'pending', docDate: DATE_DOC,
  clientName: 'SARL Durand', docTitle: 'Toiture', lines: [ligne('Toiture', 800)],
}
const FACTURE_ANNULEE = {
  id: 'fact-3', docType: 'facture', docNumber: 'FACT-2026-003', status: 'cancelled', docDate: DATE_DOC,
  clientName: 'EURL Martin', docTitle: 'Clôture', lines: [ligne('Clôture', 700)],
}
const DEVIS_SIGNE = {
  id: 'dev-1', docType: 'devis', docNumber: 'DEV-2026-001', status: 'signed', docDate: DATE_DOC,
  clientName: 'SCI Les Tilleuls', docTitle: 'Devis — Ravalement façade', lines: [ligne('Ravalement', 1500)],
}
// Devis marqués « ✓ Accepté » depuis la liste des devis : statut du navigateur, puis statut de la base.
const DEVIS_ACCEPTE_NAVIGATEUR = {
  id: 'dev-2', docType: 'devis', docNumber: 'DEV-2026-002', status: 'accepte', docDate: DATE_DOC,
  clientName: 'SARL Durand', docTitle: 'Devis — Toiture', lines: [ligne('Toiture', 1000)],
}
const DEVIS_ACCEPTE_BASE = {
  id: 'dev-3', docType: 'devis', docNumber: 'DEV-2026-003', status: 'accepted', docDate: DATE_DOC,
  clientName: 'EURL Martin', docTitle: 'Devis — Clôture', lines: [ligne('Clôture', 500)],
}
const DEVIS_ENVOYE = {
  id: 'dev-4', docType: 'devis', docNumber: 'DEV-2026-004', status: 'sent', docDate: DATE_DOC,
  clientName: 'SAS Petit', docTitle: 'Devis — Terrasse', lines: [ligne('Terrasse', 300)],
}
const DEPENSE = { label: 'Ciment', amount: '300', date: DATE_DOC, category: 'materiaux' }
// Brouillon : ni numéro de série, ni statut d'émission. Il vit dans la liste du tableau de bord à côté des
// documents émis, et ne doit entrer dans aucun chiffre.
const BROUILLON = {
  id: 'dev-brouillon', docType: 'devis', status: 'brouillon', docDate: DATE_DOC,
  clientName: 'Prospect', docTitle: 'Devis — à finir', lines: [ligne('Terrassement', 9000)],
}

function ranger(id: string, documents: object[] = [FACTURE_PAYEE, FACTURE_EMISE, DEVIS_SIGNE]) {
  localStorage.setItem(`fixit_documents_${id}`, JSON.stringify(documents))
  localStorage.setItem(`fixit_expenses_${id}`, JSON.stringify([DEPENSE]))
}

function monter(
  activePage: 'stats' | 'revenus',
  orgRole: 'pro_societe' | 'artisan' = 'pro_societe',
  savedDocuments?: object[],
) {
  return render(
    <StatsRevenusSection
      artisan={ARTISAN} bookings={[]} services={[]} pendingBookings={[]} completedBookings={[]}
      totalRevenue={0} activePage={activePage} orgRole={orgRole}
      savedDocuments={savedDocuments as never}
    />,
  )
}

/** Valeurs des quatre indicateurs, dans l'ordre de l'écran. */
const indicateurs = (conteneur: HTMLElement) =>
  Array.from(conteneur.querySelectorAll('.v5-kpi-v')).map((n) => n.textContent)

/** Clients des lignes de « Encaissements récents » (deuxième colonne du tableau). */
const clientsEncaisses = (conteneur: HTMLElement) =>
  Array.from(conteneur.querySelectorAll('table.v5-dt tbody tr')).map((tr) => tr.children[1]?.textContent ?? '')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(MAINTENANT)
  localStorage.clear()
  // Bandeau de pilotage : /api/btp indisponible dans le test, le bandeau ne s'affiche pas.
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Statistiques BTP — documents et dépenses lus sous l\'identifiant de la fiche', () => {
  it('chiffre d\'affaires des factures payées, factures émises et devis de la société', () => {
    ranger(ARTISAN.id)
    const { container } = monter('stats')
    const [ca, chantiers, taux] = indicateurs(container)
    expect(ca).toBe(formatPrice(1200, 'fr'))
    // Facture payée + facture émise (statut de la base).
    expect(screen.getByText('2 factures émises')).toBeInTheDocument()
    expect(screen.getByText('1 devis au total')).toBeInTheDocument()
    expect(chantiers).toBe('1')
    expect(taux).toBe('100%')
  })

  it('les dépenses de la comptabilité alimentent la synthèse financière', () => {
    ranger(ARTISAN.id)
    monter('stats')
    expect(screen.getByText('Synthèse financière')).toBeInTheDocument()
    // getByText compare le texte de la page, espaces insécables ramenés à des espaces, à la chaîne telle quelle.
    expect(screen.getByText(formatPrice(300, 'fr').replace(/\s/g, ' '))).toBeInTheDocument()
  })

  it('rien sous l\'identifiant du compte n\'est lu à la place de la fiche', () => {
    ranger(ARTISAN.user_id as string)
    const { container } = monter('stats')
    expect(indicateurs(container)[0]).toBe(formatPrice(0, 'fr'))
    expect(screen.queryByText('Synthèse financière')).not.toBeInTheDocument()
  })

  it('un devis marqué « Accepté » (navigateur ou base) compte comme signé', () => {
    ranger(ARTISAN.id, [FACTURE_PAYEE, DEVIS_SIGNE, DEVIS_ACCEPTE_NAVIGATEUR, DEVIS_ACCEPTE_BASE, DEVIS_ENVOYE])
    const { container } = monter('stats')
    const [, chantiers, taux, panierMoyen] = indicateurs(container)
    expect(screen.getByText('3/4 devis signés')).toBeInTheDocument()
    expect(taux).toBe('75%')
    // « Chantiers actifs » ne lit pas les chantiers de l'écran Chantiers (il cherche une clé que personne n'écrit ;
    // correction reportée, les statuts qui comptent comme actifs restent à décider) : il reprend le nombre de devis
    // signés. Cette attente fige ce repli sans le présenter comme voulu.
    expect(chantiers).toBe('3')
    // (1 500 + 1 000 + 500) / 3
    expect(panierMoyen).toBe(formatPrice(1000, 'fr'))
  })
})

// ── Salarié invité d'une société (25/11/2026) ───────────────────────────────────────────────────────────────
// Ses documents sont ceux de la SOCIÉTÉ : le serveur les lit, le tableau de bord les tient, et son propre stockage
// de navigateur n'en contient aucun — y recopier la comptabilité de l'entreprise lui refuserait l'effacement de son
// compte. Ces écrans lisaient ce stockage : tout était à zéro sur une liste de devis par ailleurs pleine.
describe('Salarié invité — les chiffres viennent de la liste du tableau de bord', () => {
  it('chiffre d\'affaires et devis de la société, alors que son stockage est vide', () => {
    // Rien rangé : son navigateur ne porte aucun document de la société.
    const { container } = monter('stats', 'pro_societe', [FACTURE_PAYEE, FACTURE_EMISE, DEVIS_SIGNE])
    const [ca, , taux] = indicateurs(container)
    expect(ca).toBe(formatPrice(1200, 'fr'))
    expect(screen.getByText('2 factures émises')).toBeInTheDocument()
    expect(screen.getByText('1 devis au total')).toBeInTheDocument()
    expect(taux).toBe('100%')
  })

  it('les revenus aussi : encaissé, en attente et recouvrement', () => {
    const { container } = monter('revenus', 'pro_societe', [FACTURE_PAYEE, FACTURE_EMISE])
    const [caAnnee, , enAttente, recouvrement] = indicateurs(container)
    expect(caAnnee).toBe(formatPrice(1200, 'fr'))
    expect(enAttente).toBe(formatPrice(800, 'fr'))
    expect(recouvrement).toBe('60%')
  })

  it('la liste du tableau de bord prime sur le stockage du navigateur', () => {
    // Un poste partagé peut porter les brouillons d'un autre compte sous cette clé : la liste du serveur tranche.
    ranger(ARTISAN.id, [FACTURE_ANNULEE])
    const { container } = monter('stats', 'pro_societe', [FACTURE_PAYEE, DEVIS_SIGNE])
    expect(indicateurs(container)[0]).toBe(formatPrice(1200, 'fr'))
    expect(screen.getByText('1 factures émises')).toBeInTheDocument()
  })

  it('un brouillon de la liste n\'entre dans aucun chiffre', () => {
    // La liste du tableau de bord porte les brouillons à côté des documents émis. Les compter ferait baisser le
    // taux de transformation sans que personne l'ait demandé — et pour un artisan, ce serait une régression pure.
    const { container } = monter('stats', 'pro_societe', [FACTURE_PAYEE, DEVIS_SIGNE, BROUILLON])
    const [ca, , taux, panierMoyen] = indicateurs(container)
    expect(screen.getByText('1 devis au total')).toBeInTheDocument()
    expect(screen.getByText('1/1 devis signés')).toBeInTheDocument()
    expect(taux).toBe('100%')
    expect(ca).toBe(formatPrice(1200, 'fr'))
    // 1 500, le devis signé seul : les 9 000 du brouillon n'y sont pas.
    expect(panierMoyen).toBe(formatPrice(1500, 'fr'))
  })

  it('liste vide : le stockage est lu, comme avant (un écran monté avant la réponse du serveur)', () => {
    ranger(ARTISAN.id)
    const { container } = monter('stats', 'pro_societe', [])
    expect(indicateurs(container)[0]).toBe(formatPrice(1200, 'fr'))
  })
})

describe('Revenus BTP — factures lues sous l\'identifiant de la fiche', () => {
  it('encaissé, en attente (statut de la base compris) et recouvrement', () => {
    ranger(ARTISAN.id)
    const { container } = monter('revenus')
    const [caAnnee, mois, enAttente, recouvrement] = indicateurs(container)
    expect(caAnnee).toBe(formatPrice(1200, 'fr'))
    expect(mois).toBe(formatPrice(1200, 'fr'))
    expect(enAttente).toBe(formatPrice(800, 'fr'))
    expect(recouvrement).toBe('60%')
    expect(screen.queryByText('proDash.home.aucuneActivite')).not.toBeInTheDocument()
  })

  it('« Encaissements récents » : seulement les factures payées, ni l\'émise non payée ni l\'annulée', () => {
    ranger(ARTISAN.id, [FACTURE_PAYEE, FACTURE_EMISE, FACTURE_ANNULEE])
    const { container } = monter('revenus')
    expect(clientsEncaisses(container)).toEqual(['SCI Les Tilleuls'])
  })
})

// Côté artisan, rien ne change (règle n° 1) : ces tests figent le comportement d'avant, qui porte les mêmes défauts,
// signalés et laissés hors de ce lot. Ils ne disent pas que ce comportement est le bon.
describe('Artisan — comportement inchangé, mêmes défauts signalés hors de ce lot', () => {
  it('lit toujours sous l\'identifiant du compte', () => {
    ranger(ARTISAN.user_id as string)
    const { container } = monter('stats', 'artisan')
    expect(indicateurs(container)[0]).toBe(formatPrice(1200, 'fr'))
  })

  it('une facture au statut de la base « pending » n\'est toujours pas comptée comme envoyée', () => {
    ranger(ARTISAN.user_id as string)
    monter('stats', 'artisan')
    expect(screen.getByText('1 factures émises')).toBeInTheDocument()
  })

  it('un devis marqué « Accepté » ne compte toujours pas comme signé', () => {
    ranger(ARTISAN.user_id as string, [FACTURE_PAYEE, DEVIS_ACCEPTE_BASE, DEVIS_ENVOYE])
    monter('stats', 'artisan')
    expect(screen.getByText('0/2 devis signés')).toBeInTheDocument()
  })

  it('la liste du tableau de bord ne change aucun de ses chiffres', () => {
    // L'artisan reçoit désormais la même prop. Les brouillons qu'elle porte ne doivent pas entrer dans ses
    // compteurs : son ancienne lecture ne regardait que `fixit_documents_`, qui ne porte que les documents émis.
    const { container } = monter('stats', 'artisan', [FACTURE_PAYEE, DEVIS_ACCEPTE_BASE, DEVIS_ENVOYE, BROUILLON])
    expect(indicateurs(container)[0]).toBe(formatPrice(1200, 'fr'))
    // Deux devis émis, aucun signé au sens artisan (« accepted » ne compte pas pour lui) : exactement comme avant.
    expect(screen.getByText('0/2 devis signés')).toBeInTheDocument()
  })

  it('« Encaissements récents » reprend toujours toutes ses factures, payées ou non', () => {
    ranger(ARTISAN.user_id as string, [FACTURE_PAYEE, FACTURE_EMISE, FACTURE_ANNULEE])
    const { container } = monter('revenus', 'artisan')
    expect(clientsEncaisses(container).sort((a, b) => a.localeCompare(b))).toEqual(['EURL Martin', 'SARL Durand', 'SCI Les Tilleuls'])
  })
})
