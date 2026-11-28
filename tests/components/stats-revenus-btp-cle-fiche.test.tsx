// Statistiques et Revenus (components/dashboard/StatsRevenusSection.tsx, mise en page V5), société BTP et artisan.
// Le tableau de bord range les devis, factures et dépenses dans le navigateur sous l'identifiant de la fiche
// (artisan.id) ; ces deux écrans les cherchaient sous celui du compte (artisan.user_id), qui n'y porte rien :
// chiffre d'affaires, factures, devis et dépenses à zéro (constat stockage-local-miroir-8 de l'audit du
// 11/11/2026). Réparé pour une société le 16/11/2026, pour un artisan le 26/11/2026 — chez lui le défaut datait
// du 11/04/2026, d'un commit écrit pour les comptes de démonstration, où id et user_id coïncident. Les factures relues depuis la base portent le statut de la
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

// Les chantiers vivent en base (table `chantiers_btp`, lue par /api/btp) : l'écran les compte par `useBTPData`,
// comme l'écran Chantiers lui-même et comme l'accueil. On simule le hook plutôt que le réseau.
const btp = vi.hoisted(() => ({ chantiers: [] as unknown[], vide: [] as unknown[], appels: [] as Record<string, unknown>[] }))
vi.mock('@/lib/hooks/use-btp-data', () => ({
  useBTPData: (options: { table: string; autoImport?: boolean }) => {
    btp.appels.push(options as Record<string, unknown>)
    return {
      items: options.table === 'chantiers' ? btp.chantiers : btp.vide,
      loading: false,
      error: null,
    }
  },
  signalerPlafondsAtteints: () => {},
  signalerChargementImpossible: () => {},
}))

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
// Facture payée qui ne vit QUE dans la liste du tableau de bord, jamais dans le stockage : elle sert à prouver
// qu'un artisan ne la lit pas. 5 000 €, pour que l'écart soit visible d'un coup d'œil.
const FACTURE_IGNOREE = {
  id: 'fact-9', docType: 'facture', docNumber: 'FACT-2026-009', status: 'paid', docDate: DATE_DOC,
  clientName: 'SAS Ignoree', docTitle: 'Ne doit pas compter', lines: [ligne('Ignorée', 5000)],
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
// Avoir qui solde FACTURE_PAYEE : `docType: 'facture'`, lignes NÉGATIVES, et le numéro de sa facture parente.
// C'est la forme réelle depuis le 05/06/2026 (`docType: 'avoir'` cassait la synchronisation).
const AVOIR_DE_LA_PAYEE = {
  id: 'avoir-1', docType: 'facture', factureSubType: 'avoir', docNumber: 'AV-2026-001', status: 'paid',
  docDate: DATE_DOC, parentInvoiceNumber: 'FACT-2026-001', clientName: 'SCI Les Tilleuls',
  docTitle: 'Avoir sur FACT-2026-001', lines: [ligne('Annulation', -1200)],
}
const PAYEE_ANNULEE = { ...FACTURE_PAYEE, status: 'cancelled' }
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

/** Chantiers du module BTP, tels que /api/btp les rend. */
const chantier = (titre: string, statut: string) => ({ id: titre, titre, client: 'SCI Les Tilleuls', statut })
function poserChantiers(chantiers: object[]) {
  btp.chantiers = chantiers
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
  btp.chantiers = []
  btp.appels = []
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

  it('une facture ANNULÉE n\'entre ni dans le chiffre d\'affaires ni dans le recouvrement', () => {
    // Le défaut le plus grave de ce lot, relevé en relecture adverse : la liste des factures était construite
    // sans aucun filtre de statut, donc une facture annulée entrait dans le CA du mois ET faisait baisser le
    // taux de recouvrement — alors que le tableau des encaissements, juste à côté sur le même écran, l'écartait
    // déjà. Payée 1 200 €, émise 800 €, annulée 700 € : facturé 2 000 €, encaissé 1 200 €, soit 60 %.
    // Sans le filtre : facturé 2 700 €, recouvrement 44 %, et un CA mensuel de 2 700 €.
    ranger(ARTISAN.id, [FACTURE_PAYEE, FACTURE_EMISE, FACTURE_ANNULEE])
    const { container } = monter('revenus')
    const [caAnnee, mois, enAttente, recouvrement] = indicateurs(container)
    expect(caAnnee).toBe(formatPrice(1200, 'fr'))
    expect(mois).toBe(formatPrice(1200, 'fr'))
    expect(enAttente).toBe(formatPrice(800, 'fr'))
    expect(recouvrement).toBe('60%')
  })

  it('une facture annulée ET son avoir sortent ENSEMBLE du chiffre d\'affaires', () => {
    // Le constat le plus grave de la troisième relecture, et une RÉGRESSION que j\'avais créée : écarter la
    // facture annulée sans écarter l\'avoir qui la soldait laissait la seule ligne NÉGATIVE. Le CA du mois pouvait
    // devenir négatif, et `totalBilled` tombant à 0 ou moins, le taux de recouvrement sautait à 100 %. Avant
    // qu\'on écarte les annulées, parent (+1 200) et avoir (−1 200) se neutralisaient : le total était juste.
    ranger(ARTISAN.id, [PAYEE_ANNULEE, AVOIR_DE_LA_PAYEE, FACTURE_EMISE])
    const { container } = monter('revenus')
    const [caAnnee, mois, enAttente, recouvrement] = indicateurs(container)
    // Il ne reste que la facture émise de 800 € : rien d\'encaissé, 800 € en attente, 0 % de recouvrement.
    expect(caAnnee).toBe(formatPrice(0, 'fr'))
    expect(mois).toBe(formatPrice(0, 'fr'))
    expect(enAttente).toBe(formatPrice(800, 'fr'))
    expect(recouvrement).toBe('0%')
  })

  it('un avoir dont la facture parente N\'est PAS annulée continue de se soustraire', () => {
    // L\'autre moitié de la règle : un avoir ordinaire doit rester compté, sinon le CA serait surestimé.
    ranger(ARTISAN.id, [FACTURE_PAYEE, AVOIR_DE_LA_PAYEE])
    const { container } = monter('revenus')
    expect(indicateurs(container)[0]).toBe(formatPrice(0, 'fr'))
  })

  it('une facture annulée ne compte pas non plus dans « factures émises » des Statistiques', () => {
    ranger(ARTISAN.id, [FACTURE_PAYEE, FACTURE_EMISE, FACTURE_ANNULEE])
    monter('stats')
    expect(screen.getByText('2 factures émises')).toBeInTheDocument()
  })
  it('« Encaissements récents » : seulement les factures payées, ni l\'émise non payée ni l\'annulée', () => {
    ranger(ARTISAN.id, [FACTURE_PAYEE, FACTURE_EMISE, FACTURE_ANNULEE])
    const { container } = monter('revenus')
    expect(clientsEncaisses(container)).toEqual(['SCI Les Tilleuls'])
  })
})

describe('« Chantiers actifs » — compté là où les chantiers vivent : la base', () => {
  // Jusqu'au 26/11/2026 cet écran lisait `chantiers_<id>` dans le navigateur, sans le préfixe `fixit_` : une clé
  // que personne n'a jamais écrite. Et la clé préfixée n'est plus écrite que par un composant que la page ne monte
  // plus (l'écran Chantiers est `ChantiersBTPV2`, qui passe par la base) et par le seed de démonstration. Le
  // compte restait donc à 0 et un repli affichait le nombre de DEVIS SIGNÉS sous cette étiquette.
  it('compte les chantiers non terminés, pas les devis signés', () => {
    ranger(ARTISAN.id)
    poserChantiers([
      chantier('Ravalement', 'En cours'),
      chantier('Toiture', 'En attente'),
      chantier('Dalle', 'Terminé'),
      chantier('Clôture', 'Annulé'),
    ])
    const { container } = monter('stats')
    // Deux actifs sur quatre, là où le repli aurait dit « 1 » (le seul devis signé du stockage).
    expect(indicateurs(container)[1]).toBe('2')
  })

  it('un statut inconnu compte comme actif plutôt que de disparaître', () => {
    ranger(ARTISAN.id)
    poserChantiers([chantier('Inédit', 'Phase 2'), chantier('Dalle', 'Terminé')])
    const { container } = monter('stats')
    expect(indicateurs(container)[1]).toBe('1')
  })

  it('cet écran LIT : il ne déclenche aucun import en base', () => {
    // `useBTPData` envoie par défaut un POST d'import des anciennes données du navigateur vers la base — une
    // écriture déclenchée par l'ouverture d'un écran de synthèse, et retentée à chaque montage si elle échoue.
    // Pour un rôle d'artisan, les deux garde-fous du hook (`_reprisesTentees`, `repriseDejaFaite`) sont de plus
    // contournés, `ecranBTP` étant faux. L'import appartient aux écrans qui gèrent les chantiers.
    ranger(ARTISAN.id)
    monter('stats')
    const chantiers = btp.appels.filter((a) => a.table === 'chantiers')
    expect(chantiers.length).toBeGreaterThan(0)
    for (const appel of chantiers) expect(appel.autoImport).toBe(false)
  })

  it('TOUS les chantiers terminés : zéro, et non le nombre de devis signés', () => {
    // Le repli était écrit `chantiersActifs || signedDevis.length` : un décompte de ZÉRO — le cas le plus banal,
    // une société dont tous les chantiers sont finis — retombait donc dans le repli et revoyait le nombre de devis
    // signés sous l'étiquette « Chantiers actifs ». Un zéro est une réponse, pas une absence de réponse.
    ranger(ARTISAN.id)
    poserChantiers([chantier('Dalle', 'Terminé'), chantier('Clôture', 'Annulé')])
    const { container } = monter('stats')
    expect(indicateurs(container)[1]).toBe('0')
  })

  it('aucun chantier : le repli sur les devis signés reste, pour un artisan sans module Chantiers', () => {
    ranger(ARTISAN.id)
    const { container } = monter('stats', 'artisan')
    expect(indicateurs(container)[1]).toBe('1')
  })

  it('rien dans le navigateur n\'est lu, sous l\'une ou l\'autre clé', () => {
    ranger(ARTISAN.id)
    for (const cle of [`chantiers_${ARTISAN.id}`, `fixit_chantiers_${ARTISAN.id}`]) {
      localStorage.setItem(cle, JSON.stringify([
        chantier('Fantôme 1', 'En cours'), chantier('Fantôme 2', 'En cours'), chantier('Fantôme 3', 'En cours'),
      ]))
    }
    const { container } = monter('stats')
    // Si l'une des deux clés était encore lue, on verrait « 3 ».
    expect(indicateurs(container)[1]).toBe('1')
  })
})

// Côté artisan : la clé de lecture est réparée (il lit sa fiche, comme une société), mais la SOURCE reste son
// stockage — la règle n° 1 veut qu'un fichier partagé conditionne son comportement, et son cache est de toute façon
// déjà hydraté depuis la base. Les écarts de statuts avec une société (« pending », « Accepté ») restent, voulus.
describe('Artisan — lit sa fiche, garde sa source et ses règles de statut', () => {
  it('lit les documents rangés sous l\'identifiant de sa fiche', () => {
    ranger(ARTISAN.id)
    const { container } = monter('stats', 'artisan')
    expect(indicateurs(container)[0]).toBe(formatPrice(1200, 'fr'))
  })

  it('ne lit RIEN sous l\'identifiant du compte', () => {
    // La contre-épreuve de la correction du 26/11/2026 : `user_id` n'est plus une clé de lecture. Avant, c'était la
    // SEULE lue côté artisan — et rien ne l'écrivait, d'où des écrans à zéro depuis le 11/04/2026.
    ranger(ARTISAN.user_id as string)
    const { container } = monter('stats', 'artisan')
    expect(indicateurs(container)[0]).toBe(formatPrice(0, 'fr'))
    expect(screen.queryByText('Synthèse financière')).not.toBeInTheDocument()
  })

  it('une facture au statut de la base « pending » compte comme émise, comme pour une société', () => {
    // A CHANGÉ DE SENS le 26/11/2026. La condition `orgRole === 'pro_societe'` n'avait de sens que tant qu'un
    // artisan lisait une clé vide. Maintenant qu'il lit le cache hydraté depuis la base, sa facture passe de
    // « envoye » à « pending » au premier rechargement : « Factures en attente » retombait à 0 € pendant que le
    // taux de recouvrement, lui, la comptait. Deux chiffres de la même carte se contredisaient selon qu'on venait
    // d'émettre ou qu'on avait rechargé la page.
    ranger(ARTISAN.id)
    monter('stats', 'artisan')
    expect(screen.getByText('2 factures émises')).toBeInTheDocument()
  })

  it('un devis marqué « Accepté » compte comme signé, comme pour une société', () => {
    // A CHANGÉ DE SENS le 26/11/2026. L'asymétrie de la PR #838 réservait « Accepté » aux sociétés, au motif d'un
    // usage qui leur serait propre — mais le bouton « ✓ Accepté » de DevisSection est partagé, et son filtre
    // « Acceptés » range déjà ces devis avec les signés pour un artisan. Il les voyait donc acceptés dans sa liste
    // et comptés zéro dans ses statistiques.
    ranger(ARTISAN.id, [FACTURE_PAYEE, DEVIS_ACCEPTE_BASE, DEVIS_ENVOYE])
    monter('stats', 'artisan')
    expect(screen.getByText('1/2 devis signés')).toBeInTheDocument()
  })

  it('ignore la liste du tableau de bord : sa source reste son stockage', () => {
    // Le cœur de la règle n° 1 pour ce lot. La prop porte une facture payée de 5 000 € et un devis signé ; le
    // stockage de sa fiche ne porte qu'une facture de 1 200 €. Seule celle du stockage compte.
    ranger(ARTISAN.id, [FACTURE_PAYEE])
    const { container } = monter('stats', 'artisan', [FACTURE_IGNOREE, DEVIS_SIGNE, BROUILLON])
    expect(indicateurs(container)[0]).toBe(formatPrice(1200, 'fr'))
    expect(screen.getByText('1 factures émises')).toBeInTheDocument()
    expect(screen.getByText('0/0 devis signés')).toBeInTheDocument()
  })

  it('« Encaissements récents » ne montre que les factures payées, comme pour une société', () => {
    // Ce cas a CHANGÉ DE SENS le 26/11/2026, et c'est le constat le plus utile de la relecture adverse : avant,
    // le tableau d'un artisan était vide (clé morte), et le banc figeait « toutes ses factures, payées ou non ».
    // Réparer la clé sans toucher à la ligne des encaissements aurait donc affiché sa facture ANNULÉE comme une
    // recette, en vert avec un « + ». Il n'y avait rien à préserver : seules les factures payées sont encaissées.
    ranger(ARTISAN.id, [FACTURE_PAYEE, FACTURE_EMISE, FACTURE_ANNULEE])
    const { container } = monter('revenus', 'artisan')
    expect(clientsEncaisses(container)).toEqual(['SCI Les Tilleuls'])
  })
})
