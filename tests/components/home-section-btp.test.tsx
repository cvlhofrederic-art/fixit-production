// tests/components/home-section-btp.test.tsx
//
// Accueil du tableau de bord BTP pro : rendu du composant (components/dashboard/HomeSection.tsx, partagé avec l'artisan).
// Relecture adverse du 14/11/2026 : les tests du lot ne couvraient que les fonctions pures de lib/btp/accueil.ts
// (tests/lib/btp-accueil.test.ts). Ici, ce que l'écran affiche vraiment : tuiles, textes des alertes, ligne du tableau
// au dernier jour d'un chantier, destinations des liens (toutes rendues par la page), absence de boucle de rendu, et
// la branche artisan restée telle quelle (règle n° 1).

import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render } from '@testing-library/react'

const etat = vi.hoisted(() => ({
  rendus: 0,
  tables: {} as Record<string, unknown[]>,
  vide: [] as unknown[],
  locale: 'fr',
}))

// Comme le vrai hook (état React), la simulation rend le même tableau d'un rendu à l'autre : un tableau neuf à chaque
// rendu relancerait l'effet des alertes sans fin. Au-delà de 100 rendus, elle arrête le test au lieu de le laisser tourner.
vi.mock('@/lib/hooks/use-btp-data', () => ({
  useBTPData: ({ table }: { table: string }) => {
    if (table === 'chantiers') {
      etat.rendus += 1
      if (etat.rendus > 100) throw new Error('boucle de rendu de l’accueil')
    }
    return { items: etat.tables[table] ?? etat.vide }
  },
}))
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (cle: string) => cle }),
  useLocale: () => etat.locale,
}))

import HomeSection from '@/components/dashboard/HomeSection'

type Proprietes = React.ComponentProps<typeof HomeSection>

// Samedi 14 novembre 2026, midi, heure du poste.
const MAINTENANT = new Date(2026, 10, 14, 12, 0, 0)

const artisan = { id: 'art-1', user_id: 'usr-1', company_name: 'Société Essai', rating_avg: 4.8, rating_count: 12 } as unknown as Proprietes['artisan']

const demandeEnAttente = { id: 'b1', status: 'pending', booking_date: '2026-11-16', notes: 'Client: Mme Dupré | urgent', services: { name: 'Plomberie' }, price_ttc: 120 }
const interventionFaite = { id: 'b2', status: 'completed', booking_date: '2026-11-10', notes: 'Client: M. Roche', services: { name: 'Peinture' }, price_ttc: 300 }

const chantiers = [
  { id: 'c1', titre: 'Villa Dupré', client: 'Mme Dupré', statut: 'Terminé', budget: '28500', dateDebut: '2026-09-01', dateFin: '2026-10-20', equipe: 'A' },
  // Dernier jour du chantier : aujourd'hui.
  { id: 'c2', titre: 'Immeuble Lilas', client: 'SCI Les Lilas', statut: 'En cours', budget: '45000', dateDebut: '2026-10-01', dateFin: '2026-11-14', equipe: 'B' },
  { id: 'c3', titre: 'Garage Roche', client: 'M. Roche', statut: 'Annulé', budget: '9000', dateDebut: '2026-08-01', dateFin: '2026-08-20', equipe: 'B' },
  // Devait finir hier : en retard.
  { id: 'c4', titre: 'Toiture Martin', client: 'M. Martin', statut: 'En cours', budget: '', dateDebut: '2026-10-15', dateFin: '2026-11-13', equipe: 'A' },
]

const IDENTIFIANT_BROUILLON = '7a1e0d55-1111-4222-8333-9c0b1a2d3e4f'
const documents = [
  // Facture commencée puis laissée en brouillon : le chantier de Mme Dupré n'est pas facturé.
  { id: '50e30094-3af7-442b-b2b0-4e8c8fc12b64', docType: 'facture', docNumber: '', clientName: 'Mme Dupré', status: 'brouillon' },
  // Brouillon de devis BTP : pas de numéro avant la validation.
  { id: IDENTIFIANT_BROUILLON, docType: 'devis', docNumber: '', clientName: 'SCI Les Lilas', status: 'brouillon' },
  // Ancien brouillon portant un numéro provisoire.
  { id: '0b9d2c11-2222-4333-8444-1a2b3c4d5e6f', docType: 'devis', docNumber: 'BR-2026-003', clientName: 'M. Martin', status: 'draft' },
]

/** Facture ÉMISE et non réglée : numéro définitif, statut « envoye ». C'est ce que l'alerte doit signaler. */
const FACTURE_IMPAYEE = {
  id: 'f-impayee', docType: 'facture', docNumber: 'FACT-2026-001', clientName: 'Mme Dupré',
  status: 'envoye', docDate: '2026-11-01',
  lines: [{ id: 1, description: 'Plomberie', qty: 1, unit: 'f', priceHT: 100, tvaRate: 20, totalHT: 100 }],
}

/** Devis ÉMIS sans réponse du client. Les statuts « pending » et « en_attente », que l'ancien filtre cherchait, n'existent pas. */
const DEVIS_ENVOYE = {
  id: 'dv-envoye', docType: 'devis', docNumber: 'DEV-2026-010', clientName: 'SARL Ponts',
  status: 'envoye', docDate: '2026-11-10',
  lines: [{ id: 1, description: 'Pont', qty: 1, unit: 'f', priceHT: 5000, tvaRate: 20, totalHT: 5000 }],
}

const navigateTo = vi.fn()
const setActivePage = vi.fn()

function proprietes(orgRole: Proprietes['orgRole'], documentsEnregistres?: unknown): Proprietes {
  return {
    artisan, orgRole,
    bookings: [demandeEnAttente, interventionFaite], services: [],
    pendingBookings: [demandeEnAttente], completedBookings: [interventionFaite],
    totalRevenue: 300, firstName: 'Essai',
    navigateTo, setActivePage,
    setShowNewRdv: vi.fn(), setShowDevisForm: vi.fn(), setShowFactureForm: vi.fn(),
    openDevisForm: vi.fn(), openFactureForm: vi.fn(), setSidebarOpen: vi.fn(), openNewMotif: vi.fn(),
    documentsEnregistres,
  } as unknown as Proprietes
}

const attendre = (ms: number) => act(async () => { await new Promise(resoudre => setTimeout(resoudre, ms)) })

async function afficher(props: Proprietes) {
  const vue = render(<HomeSection {...props} />)
  await attendre(20)
  return vue
}

// Tout espace ramené à l'espace simple (les montants portent des espaces insécables).
const texte = (element: Element | null | undefined) => (element?.textContent ?? '').replace(/\s/g, ' ')
// Texte d'une alerte sans son pictogramme de tête.
const alertesAffichees = (conteneur: HTMLElement) => [...conteneur.querySelectorAll('.v5-al')].map(e => texte(e).replace(/^\S+ /, ''))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: MAINTENANT })
  etat.rendus = 0
  etat.locale = 'fr'
  etat.tables = {
    chantiers,
    membres: [{ id: 'm1', prenom: 'Ana', nom: 'Silva', type_compte: 'ouvrier', actif: true }],
    depenses: [{ id: 'd1', amount: 120.5, date: '2026-11-01', label: 'Sable', category: 'materiaux' }],
    situations: [],
  }
  localStorage.clear()
  navigateTo.mockClear()
  setActivePage.mockClear()
})

afterEach(() => { vi.useRealTimers() })

describe('accueil BTP (pro_societe) — tuiles', () => {
  it('budgets additionnés, chantier annulé écarté ; acomptes et marge « — » faute de donnée', async () => {
    const { container } = await afficher(proprietes('pro_societe', documents))
    const tuiles = [...container.querySelectorAll('.v5-kpi')]
    expect(tuiles.map(t => texte(t.querySelector('.v5-kpi-l')))).toEqual(['Chantiers actifs', 'CA total chantiers', 'Marge moyenne', 'Effectif'])
    expect(texte(tuiles[1].querySelector('.v5-kpi-v'))).toBe('73 500 €')
    expect(texte(tuiles[1].querySelector('.v5-kpi-s'))).toBe('Acomptes : —')
    expect(texte(tuiles[2].querySelector('.v5-kpi-v'))).toBe('—')
  })

  it('acomptes et marges renseignés : les valeurs s’affichent', async () => {
    etat.tables = {
      ...etat.tables,
      chantiers: [
        { id: 'c1', titre: 'Villa Dupré', client: 'Mme Dupré', statut: 'En cours', budget: '10000', acompte_recu: 3000, marge_prevue_pct: 20 },
        { id: 'c2', titre: 'Immeuble Lilas', client: 'SCI Les Lilas', statut: 'En cours', budget: '5000', acompte_recu: '1500', marge_prevue_pct: '31' },
      ],
    }
    const { container } = await afficher(proprietes('pro_societe', []))
    const tuiles = [...container.querySelectorAll('.v5-kpi')]
    expect(texte(tuiles[1].querySelector('.v5-kpi-v'))).toBe('15 000 €')
    expect(texte(tuiles[1].querySelector('.v5-kpi-s'))).toBe('Acomptes : 4 500 €')
    expect(texte(tuiles[2].querySelector('.v5-kpi-v'))).toBe('26%')
  })

  // Rapport i18n PT-PT du 17/11/2026 : pas d'espace avant « : », termes portugais (pas de calque du français),
  // pas de tiret long dans les alertes portugaises.
  it('en portugais : tuiles, rubrique des alertes et alertes en PT-PT', async () => {
    etat.locale = 'pt'
    etat.tables = { ...etat.tables, membres: [
      { id: 'm1', prenom: 'Ana', nom: 'Silva', type_compte: 'ouvrier', actif: true },
      { id: 'm2', prenom: 'Rui', nom: 'Costa', type_compte: 'chef_chantier', actif: true },
    ] }
    const { container } = await afficher(proprietes('pro_societe', documents))
    const tuiles = [...container.querySelectorAll('.v5-kpi')]
    expect(tuiles.map(t => texte(t.querySelector('.v5-kpi-l')))).toEqual(['Obras ativas', 'Faturação total das obras', 'Margem média', 'Colaboradores'])
    expect(texte(tuiles[1].querySelector('.v5-kpi-s'))).toBe('Adiantamentos: —')
    expect(texte(tuiles[2].querySelector('.v5-kpi-s'))).toBe('Objetivo: 25%')
    expect(texte(tuiles[3].querySelector('.v5-kpi-s'))).toBe('1 encarregado + 1 operário')
    expect(texte(container)).toContain('Alertas de obra')
    expect(texte(container)).toContain('Autos de medição')
    const alertes = alertesAffichees(container)
    expect(alertes).toContain('Toiture Martin: prazo excedido, validar como "Terminado"')
    expect(alertes).toContain('Villa Dupré: obra terminada, fatura não enviada (Mme Dupré)')
    expect(alertes).toContain('Orçamento a fazer: Plomberie (Mme Dupré)')
    for (const alerte of alertes) expect(alerte).not.toMatch(/[—–]/)
    expect(texte(container)).not.toMatch(/\S :/)
  })

  it('en portugais : documents de conformité nommés en portugais, pas par leur identifiant', async () => {
    etat.locale = 'pt'
    // Ni chantier ni document : les alertes de conformité ne sont pas coupées par la limite de six alertes affichées.
    etat.tables = {}
    localStorage.setItem('fixit_wallet_art-1', JSON.stringify({
      urssaf: { name: 'declaracao.pdf', expiryDate: '2026-11-24' },
      attestation_fiscale: { name: 'certidao.pdf', expiryDate: '2026-11-10' },
    }))
    const { container } = await afficher(proprietes('pro_societe', []))
    const alertes = alertesAffichees(container)
    expect(alertes.some(a => a.startsWith('Certidão de situação tributária regularizada (Finanças): expirou há'))).toBe(true)
    expect(alertes.some(a => a.startsWith('Declaração de situação contributiva (Segurança Social): expira em'))).toBe(true)
    expect(alertes.join(' ')).not.toMatch(/urssaf|attestation/)
  })
})

describe('accueil BTP (pro_societe) — alertes', () => {
  it('brouillon sans numéro nommé sans référence ; facture en brouillon : chantier terminé toujours signalé', async () => {
    const { container } = await afficher(proprietes('pro_societe', documents))
    expect(alertesAffichees(container)).toEqual([
      'Toiture Martin — deadline dépassée, à valider "Terminé"',
      'Villa Dupré — chantier terminé, facture non envoyée (Mme Dupré)',
      'Devis en brouillon — à envoyer (SCI Les Lilas)',
      'Devis BR-2026-003 en brouillon — à envoyer (M. Martin)',
      'Devis à faire — Plomberie (Mme Dupré)',
    ])
    // Aucun morceau de l'identifiant technique du brouillon à l'écran.
    expect(texte(container)).not.toContain(IDENTIFIANT_BROUILLON.slice(-6))
  })

  it('en portugais : même règle pour le brouillon sans numéro', async () => {
    etat.locale = 'pt'
    const { container } = await afficher(proprietes('pro_societe', documents))
    expect(alertesAffichees(container)).toContain('Orçamento em rascunho, por enviar (SCI Les Lilas)')
    expect(alertesAffichees(container)).toContain('Orçamento BR-2026-003 em rascunho, por enviar (M. Martin)')
  })

  it('facture émise pour le client : le chantier terminé n’est plus signalé ; devis annulé : « Devis à faire » reste', async () => {
    const { container } = await afficher(proprietes('pro_societe', [
      { id: 'f1', docType: 'facture', docNumber: 'FACT-2026-004', clientName: 'Mme Dupré', status: 'envoye' },
      { id: 'd1', docType: 'devis', docNumber: 'DEV-2026-009', clientName: 'Mme Dupré', status: 'annule' },
    ]))
    expect(alertesAffichees(container)).toEqual([
      'Toiture Martin — deadline dépassée, à valider "Terminé"',
      'Devis à faire — Plomberie (Mme Dupré)',
    ])
  })

  it('dernier jour d’un chantier : ni alerte ni ligne en retard ; le lendemain de la fin : les deux', async () => {
    const { container } = await afficher(proprietes('pro_societe', documents))
    const cellules = [...container.querySelectorAll<HTMLElement>('table.v5-dt tbody tr td:first-child')]
    const lilas = cellules.find(td => texte(td).startsWith('Immeuble Lilas'))
    const martin = cellules.find(td => texte(td).startsWith('Toiture Martin'))
    expect(texte(lilas)).toBe('Immeuble Lilas')
    expect(lilas?.style.color).toBe('')
    expect(alertesAffichees(container).some(a => a.includes('Immeuble Lilas'))).toBe(false)
    expect(texte(martin)).not.toBe('Toiture Martin') // suivi du signe d'avertissement
    expect(martin?.style.color).toBe('rgb(198, 40, 40)')
  })

  it('entrée nulle dans la liste des documents, ou liste absente : l’accueil s’affiche quand même', async () => {
    const avecNulle = await afficher(proprietes('pro_societe', [null, documents[1]]))
    expect(alertesAffichees(avecNulle.container)).toContain('Devis en brouillon — à envoyer (SCI Les Lilas)')
    avecNulle.unmount()
    const sansListe = await afficher(proprietes('pro_societe'))
    expect(alertesAffichees(sansListe.container)).toContain('Villa Dupré — chantier terminé, facture non envoyée (Mme Dupré)')
  })

  it('erreur pendant le calcul : journalisée, les alertes déjà calculées et celles de conformité restent affichées', async () => {
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem('fixit_wallet_art-1', JSON.stringify({ attestation_urssaf: { name: 'Attestation URSSAF', expiryDate: '2026-11-20' } }))
    // Demande dont la note n'est pas un texte : la lecture du nom du client échoue au milieu du calcul.
    const demandeIllisible = { id: 'b9', status: 'pending', notes: { client: 'Mme Dupré' } }
    const props = { ...proprietes('pro_societe', documents), pendingBookings: [demandeIllisible] } as unknown as Proprietes
    const { container } = await afficher(props)
    const alertes = alertesAffichees(container)
    expect(alertes[0]).toBe('Toiture Martin — deadline dépassée, à valider "Terminé"')
    expect(alertes.some(a => a.startsWith('attestation urssaf — expire dans'))).toBe(true)
    expect(erreurs).toHaveBeenCalledWith(expect.stringContaining('[accueil BTP]'), expect.any(Error))
    erreurs.mockRestore()
  })
})

describe('accueil BTP (pro_societe) — liens', () => {
  // Sections que la page sait afficher : les conditions `activePage === '…'` de sa zone de contenu.
  const sourcePage = readFileSync(resolve(process.cwd(), 'app/(commun)/pro/dashboard/page.tsx'), 'utf8')
  const contenu = sourcePage.slice(sourcePage.indexOf('<main '), sourcePage.indexOf('</main>'))
  const sectionsDeLaPage = new Set([...contenu.matchAll(/activePage === '([a-z0-9_]+)'/g)].map(m => m[1]))

  it('chaque clic de l’accueil mène à une section que la page affiche', async () => {
    expect(sectionsDeLaPage.size).toBeGreaterThan(30)
    expect(sectionsDeLaPage.has('home')).toBe(true)
    localStorage.setItem('fixit_messagerie_convs_art-1', JSON.stringify([{ id: 'conv-1', unread_count: 2, other_user_name: 'Mme Dupré' }]))
    localStorage.setItem('fixit_wallet_art-1', JSON.stringify({ attestation_urssaf: { name: 'Attestation URSSAF', expiryDate: '2026-11-20' } }))
    // Sans devis en brouillon, les cinq sources d'alerte tiennent dans les six lignes affichées.
    const { container } = await afficher(proprietes('pro_societe', [documents[0]]))
    expect(alertesAffichees(container)).toHaveLength(5)

    for (const element of container.querySelectorAll<HTMLElement>('[style*="cursor: pointer"], button')) fireEvent.click(element)
    await attendre(80) // les boutons « devis » et « facture » ouvrent leur formulaire après 50 ms

    const destinations = new Set<string>([...navigateTo.mock.calls, ...setActivePage.mock.calls].map(appel => String(appel[0])))
    expect([...destinations].filter(d => !sectionsDeLaPage.has(d))).toEqual([])
    // Les trois identifiants corrigés par le lot, et le reste des liens de l'écran.
    for (const attendue of ['compta_btp', 'portail_client', 'wallet', 'chantiers', 'rentabilite', 'equipes', 'gantt', 'situations', 'messages', 'devis', 'factures']) {
      expect(destinations.has(attendue), attendue).toBe(true)
    }
  })

  it('les trois tuiles dont le lien a été corrigé s’ouvrent aussi au clavier (Entrée, Espace), comme au clic', async () => {
    const { container } = await afficher(proprietes('pro_societe', [documents[0]]))
    const tuiles = [...container.querySelectorAll<HTMLElement>('[role="button"][tabindex="0"]')]
    const destinationAuClavier = (texte: string, touche: string) => {
      const tuile = tuiles.find(t => t.textContent?.includes(texte))
      expect(tuile, texte).toBeDefined()
      navigateTo.mockClear()
      fireEvent.keyDown(tuile!, { key: touche })
      return navigateTo.mock.calls.map(appel => String(appel[0]))
    }
    expect(destinationAuClavier('CA total chantiers', 'Enter')).toEqual(['compta_btp'])
    expect(destinationAuClavier('Dépenses', ' ')).toEqual(['rentabilite'])
    expect(destinationAuClavier('Clients', 'Enter')).toEqual(['portail_client'])
    // Une autre touche ne déclenche rien.
    expect(destinationAuClavier('Clients', 'a')).toEqual([])
  })

  it('la page transmet à l’accueil les devis et factures qu’elle a chargés (source des alertes)', () => {
    const debut = sourcePage.indexOf('<HomeSection')
    expect(debut).toBeGreaterThan(0)
    expect(sourcePage.slice(debut, sourcePage.indexOf('/>', debut))).toContain('documentsEnregistres={savedDocuments}')
  })
})

describe('accueil BTP (pro_societe) — pas de boucle de rendu', () => {
  it('le nombre de rendus reste borné au montage, puis à chaque nouvelle liste de documents', async () => {
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {})
    const vue = await afficher(proprietes('pro_societe', documents))
    const auMontage = etat.rendus
    expect(auMontage).toBeLessThanOrEqual(4)
    await attendre(150)
    expect(etat.rendus).toBe(auMontage)

    vue.rerender(<HomeSection {...proprietes('pro_societe', [...documents])} />)
    await attendre(150)
    const apresNouvelleListe = etat.rendus
    expect(apresNouvelleListe - auMontage).toBeLessThanOrEqual(3)

    vue.rerender(<HomeSection {...proprietes('pro_societe')} />)
    await attendre(150)
    expect(etat.rendus - apresNouvelleListe).toBeLessThanOrEqual(3)
    expect(erreurs).not.toHaveBeenCalled()
    erreurs.mockRestore()
  })
})

describe('règle n° 1 — accueil artisan inchangé', () => {
  it('tuiles artisan, aucune alerte BTP, même avec des chantiers et des documents', async () => {
    const { container } = await afficher(proprietes('artisan', documents))
    const tuiles = [...container.querySelectorAll('.v5-kpi')]
    expect(tuiles.map(t => texte(t.querySelector('.v5-kpi-l')))).toEqual(['Demandes en attente', 'CA ce mois', 'Note moyenne', 'Taux conversion'])
    expect(texte(tuiles[1].querySelector('.v5-kpi-v'))).toBe('300 €')
    expect(container.querySelectorAll('.v5-al')).toHaveLength(0)
    expect(texte(container)).toContain('Aucune alerte')
    expect(texte(container)).not.toContain('Alertes BTP')
    expect(texte(container)).not.toContain('brouillon')
    expect(texte(container)).not.toContain('CA total chantiers')
  })

  it('ses alertes viennent des documents de la page, et plus de son ancienne clé du navigateur', async () => {
    // A CHANGÉ DE SENS le 26/11/2026, et c'est le cas le plus instructif du lot : il FIGEAIT la lecture de
    // `fixit_docs_<id>`, une clé que plus aucun écran n'écrit depuis que lib/btp/accueil.ts a repris les alertes.
    // « Facture impayée », « Devis en attente » et « Devis récents » étaient donc VIDES pour tout le monde,
    // artisan comme société — et un bloc sans données ressemble à un bloc sans sujet.
    localStorage.setItem('fixit_docs_art-1', JSON.stringify([
      { id: 'fantome', type: 'facture', client: 'Client Fantôme', ref: 'F-0', total: 100, status: 'envoye', date: '2026-11-01' },
    ]))
    const { container } = await afficher(proprietes('artisan', [...documents, FACTURE_IMPAYEE]))
    expect([...container.querySelectorAll('.v5-al')].map(texte)).toEqual(['Facture impayée — Mme Dupré'])
    // L'ancienne clé n'est plus lue du tout.
    expect(texte(container)).not.toContain('Fantôme')
  })

  it('un devis envoyé sans réponse est signalé ; un brouillon ne l\'est pas, il n\'a jamais été envoyé', async () => {
    const { container } = await afficher(proprietes('artisan', [...documents, DEVIS_ENVOYE]))
    expect([...container.querySelectorAll('.v5-al')].map(texte)).toEqual(['Devis en attente — SARL Ponts'])
  })

  it('un devis accepté ou refusé n\'attend plus de réponse : aucune alerte', async () => {
    for (const statut of ['accepte', 'accepted', 'signed', 'refuse', 'rejected']) {
      const { container } = await afficher(proprietes('artisan', [{ ...DEVIS_ENVOYE, status: statut }]))
      expect(container.querySelectorAll('.v5-al')).toHaveLength(0)
    }
  })

  it('une facture payée n\'est pas signalée comme impayée, et une annulée non plus', async () => {
    for (const statut of ['paid', 'annule', 'cancelled']) {
      const { container } = await afficher(proprietes('artisan', [{ ...FACTURE_IMPAYEE, status: statut }]))
      expect(container.querySelectorAll('.v5-al')).toHaveLength(0)
    }
  })

  it('mise en page V22 (conciergerie) : le tableau des devis donne référence, montant et statut justes', async () => {
    // Ce tableau lisait `d.ref || d.number` (jamais posés : la référence est `docNumber`), `d.total || d.amount`
    // (jamais posés non plus : le montant se calcule depuis les lignes) et des statuts accentués « accepté » /
    // « refusé » qui n'existent pas. Tout devis s'y affichait donc « Attente », à 0 €, numéroté par son rang.
    const gagne = { ...DEVIS_ENVOYE, id: 'dv-gagne', docNumber: 'DEV-2026-077', clientName: 'Gagné', status: 'accepte' }
    const { container } = await afficher(proprietes('pro_conciergerie', [DEVIS_ENVOYE, gagne]))
    const corps = texte(container)
    expect(corps).toContain('DEV-2026-010')
    expect(corps).toContain('DEV-2026-077')
    expect(corps).toContain('5 000')
    // « accepte » est un statut réel : il doit s'afficher « Accepté », pas « Attente ».
    expect(corps).toContain('Accepté')
    expect(corps).toContain('Attente')
    // Le sous-titre des alertes portait lui aussi `ref`/`number` et `total`/`amount`, qu'aucune écriture ne
    // pose : il affichait « — · 0 € ». Cette mise en page est la seule qui le rende.
    //
    // L'assertion porte sur le sous-titre ENTIER, et pas sur le seul numéro : celui-ci apparaît aussi dans le
    // tableau « Devis récents » de la même page, si bien qu'un test du numéro seul restait vert même sans le
    // correctif — la contre-épreuve l'a montré.
    expect(corps).toContain('DEV-2026-010 · sans réponse')
    expect(corps).not.toContain('— · sans réponse')
  })

  it('deux devis du MÊME JOUR se départagent sur l\'horodatage d\'enregistrement', () => {
    // `docDate` est une journée : pour deux devis du même jour — le quotidien d'une société — la comparaison rend
    // 0 et le tri, stable, laissait le premier de la liste, donc le plus ancien. Le défaut subsistait à
    // l'intérieur d'une journée alors que le commentaire le disait corrigé.
    const matin = { ...DEVIS_ENVOYE, id: 'dv-matin', docNumber: 'DEV-2026-100', clientName: 'Matin', docDate: '2026-11-20', savedAt: '2026-11-20T08:00:00.000Z' }
    const soir = { ...DEVIS_ENVOYE, id: 'dv-soir', docNumber: 'DEV-2026-101', clientName: 'Soir', docDate: '2026-11-20', savedAt: '2026-11-20T18:00:00.000Z' }
    return afficher(proprietes('artisan', [matin, soir])).then(({ container }) => {
      const corps = texte(container)
      expect(corps).toContain('DEV-2026-101')
      expect(corps).not.toContain('DEV-2026-100')
    })
  })

  it('un document daté du futur n\'affiche pas « il y a -1j »', () => {
    // L'écart négatif arrive pour de bon : la date d'un document se saisit à la main, et `new Date('2026-11-26')`
    // vaut minuit UTC — donc un document du jour consulté avant 1 h du matin en France donne déjà un écart
    // négatif. `formatRelativeTime` n'avait aucune garde : « Facture impayée — … il y a -1j ».
    const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const future = { ...FACTURE_IMPAYEE, id: 'f-futur', docNumber: 'FACT-2026-999', docDate: demain }
    return afficher(proprietes('pro_conciergerie', [future])).then(({ container }) => {
      const corps = texte(container)
      expect(corps).not.toContain('-1j')
      expect(corps).not.toMatch(/il y a -\d/)
    })
  })

  it('un BROUILLON n\'est pas un « devis récent »', () => {
    // Un brouillon porte `docDate` : il pouvait donc gagner le tri et s'afficher comme dernier devis, à 0 €, et
    // le tableau de la mise en page V22 le rangeait en « Attente » — c'est-à-dire en attente de réponse du client.
    const brouillon = { ...DEVIS_ENVOYE, id: 'dv-br', docNumber: 'BR-2026-007', status: 'brouillon', clientName: 'Pas fini', docDate: '2026-11-25' }
    const emis = { ...DEVIS_ENVOYE, id: 'dv-emis', docNumber: 'DEV-2026-200', clientName: 'Émis', docDate: '2026-11-01' }
    return afficher(proprietes('artisan', [brouillon, emis])).then(({ container }) => {
      const corps = texte(container)
      expect(corps).toContain('DEV-2026-200')
      expect(corps).not.toContain('BR-2026-007')
    })
  })

  it('« Devis récents » trie sur docDate, le champ que les documents portent vraiment', () => {
    // Le tri lisait `date` et `created_at`, qu'aucune écriture ne pose (les formulaires posent `docDate`,
    // `savedAt` et `sentAt`) : le comparateur rendait toujours 0, donc le tri était INOPÉRANT et, le tri de
    // JavaScript étant stable, la tuile montrait le premier de la liste — en pratique le plus ANCIEN devis.
    const vieux = { ...DEVIS_ENVOYE, id: 'dv-vieux', docNumber: 'DEV-2026-001', clientName: 'Ancien', docDate: '2026-01-05' }
    const recent = { ...DEVIS_ENVOYE, id: 'dv-recent', docNumber: 'DEV-2026-050', clientName: 'Récent', docDate: '2026-11-20' }
    // Le plus ancien en PREMIER dans la liste fournie : sans tri effectif, c'est lui que la tuile afficherait.
    return afficher(proprietes('artisan', [vieux, recent])).then(({ container }) => {
      const corps = texte(container)
      expect(corps).toContain('DEV-2026-050')
      expect(corps).toContain('Récent')
      expect(corps).not.toContain('Aucun devis')
      // Le montant vient des LIGNES du document (docRevenueHT), pas d'un champ `total` que rien ne pose.
      expect(corps).toContain('5 000')
      // La tuile ne montre QUE le premier devis : le numéro du plus ancien ne doit apparaître nulle part.
      // Sans tri effectif, c'est lui qui s'afficherait (le tri de JavaScript est stable et la liste le donne
      // en premier). Son NOM, « Ancien », figure en revanche dans les alertes : ce n'est pas ce qu'on teste ici.
      expect(corps).not.toContain('DEV-2026-001')
    })
  })
})
