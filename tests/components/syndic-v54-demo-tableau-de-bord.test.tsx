// tests/components/syndic-v54-demo-tableau-de-bord.test.tsx
//
// Démo Marseille (super_admin) — tableau de bord v54 connecté : plus aucun chiffre de maquette
// à côté des vraies données (bandeau, pastilles, budget, compteurs de la sidebar), accueil au
// nom du cabinet, bouton « Nouvelle mission » branché, lien « Panneau admin », vraie déconnexion.

import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({
  session: {
    access_token: 'jeton-super-admin',
    user: { id: 'id-super-admin', app_metadata: { role: 'super_admin' }, user_metadata: { full_name: 'Frédéric Carvalho' } },
  },
  signOut: vi.fn(async (_options?: { scope?: string }) => ({ error: null as unknown })),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: h.session } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: h.signOut,
    },
  },
}))

import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import ModDashboard from '@/components/syndic-dashboard/v54/modules/ModDashboard'
import SyndicDashboardV54 from '@/components/syndic-dashboard/v54/SyndicDashboardV54'
import { DashboardShell, compteursReels } from '@/components/syndic-dashboard/v54/shell'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import { IdentiteSyndicContext, nomAffiche } from '@/lib/syndic/v54/identite'
import { V54LocaleProvider } from '@/lib/syndic/v54/i18n'
import type { Immeuble, Mission } from '@/components/syndic-dashboard/types'
import type { Signalement } from '@/lib/syndic/v54/api'

afterEach(() => { cleanup(); vi.restoreAllMocks(); h.signOut.mockClear() })

const immeuble = (over: Partial<Immeuble>): Immeuble => ({
  id: 'i', nom: 'Résidence Le Prado', adresse: '', ville: 'Marseille', codePostal: '13008', nbLots: 0,
  anneeConstruction: 1970, typeImmeuble: '', gestionnaire: '', nbInterventions: 0, budgetAnnuel: 0, depensesAnnee: 0,
  ...over,
})
const mission = (statut: Mission['statut'], over: Partial<Mission> = {}): Mission => ({
  id: `m-${statut}-${Math.random()}`, immeuble: 'Résidence Le Prado', artisan: '', type: 'Plomberie', description: '',
  priorite: 'normale', statut, dateCreation: '2026-10-01', ...over,
})

const donnees = (over: Partial<SyndicData> = {}): SyndicData => ({
  authenticated: true, loading: false,
  immeubles: [
    immeuble({ id: 'a', nbLots: 12, budgetAnnuel: 100_000, depensesAnnee: 40_000 }),
    immeuble({ id: 'b', nom: 'Résidence Castellane', nbLots: 8, budgetAnnuel: 50_000, depensesAnnee: 20_000 }),
  ],
  missions: [mission('en_cours'), mission('acceptee'), mission('en_attente'), mission('en_attente'), mission('terminee')],
  artisans: [],
  ...over,
})

// Testing Library ramène les espaces insécables (séparateur de milliers fr-FR) à des espaces simples.
const nombre = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n).replace(/\s/g, ' ')

function rendreTableau(d: SyndicData, nom: string | null = null) {
  return render(
    <V54LocaleProvider locale="fr-FR">
      <ToastProvider>
        <IdentiteSyndicContext.Provider value={{ nom }}>
          <SyndicDataContext.Provider value={d}><ModDashboard /></SyndicDataContext.Provider>
        </IdentiteSyndicContext.Provider>
      </ToastProvider>
    </V54LocaleProvider>,
  )
}

describe('ModDashboard connecté — chiffres calculés', () => {
  it('bandeau : lots, missions actives (en_cours + acceptee) et budget en k€ calculés, avec leurs sous-titres', () => {
    rendreTableau(donnees())
    expect(screen.getByText('20')).toBeInTheDocument() // 12 + 8 lots
    expect(screen.getByText('dans 2 immeubles')).toBeInTheDocument()
    expect(screen.getAllByText('2 en attente').length).toBeGreaterThan(0) // bandeau (+ carte KPI)
    expect(screen.getByText('150')).toBeInTheDocument() // 150 000 € → 150 k€
    expect(screen.getAllByText('40 % consommé').length).toBeGreaterThan(0) // 60 000 / 150 000
    // Plus aucun chiffre de la maquette.
    expect(screen.queryByText('40')).toBeNull()
    expect(screen.queryByText('188')).toBeNull()
    expect(screen.queryByText('dans 4 immeubles')).toBeNull()
    expect(screen.queryByText('55 % consommé')).toBeNull()
  })

  it('pastilles : remplacées par le nombre réel d’ordres en attente (plus de « Synchronisé il y a 2 min »)', () => {
    rendreTableau(donnees())
    expect(screen.getByText('2 ordres de service en attente')).toBeInTheDocument()
    expect(screen.queryByText('Fonctionnement stable')).toBeNull()
    expect(screen.queryByText('Synchronisé il y a 2 min')).toBeNull()
    expect(screen.queryByText('6 ordres de service en attente')).toBeNull()
  })

  it('pastille : « Aucun ordre de service en attente » quand il n’y en a pas', () => {
    rendreTableau(donnees({ missions: [mission('en_cours')] }))
    expect(screen.getByText('Aucun ordre de service en attente')).toBeInTheDocument()
  })

  it('accueil : nom du cabinet quand il est connu, « Bienvenue » neutre sinon — jamais « Super Admin »', () => {
    rendreTableau(donnees(), 'Cabinet Phocéen')
    expect(screen.getByRole('heading', { level: 1, name: 'Bienvenue, Cabinet Phocéen' })).toBeInTheDocument()
    cleanup()
    rendreTableau(donnees())
    expect(screen.getByRole('heading', { level: 1, name: 'Bienvenue' })).toBeInTheDocument()
    expect(screen.queryByText('Super Admin')).toBeNull()
  })

  it('budget : total, dépensé et restant calculés depuis les immeubles ; maquette (188 000, Septembre 2026, catégories) absente', () => {
    rendreTableau(donnees())
    expect(screen.getByText(nombre(150_000))).toBeInTheDocument()
    expect(screen.getByText(nombre(60_000))).toBeInTheDocument()
    expect(screen.getByText(nombre(90_000))).toBeInTheDocument()
    expect(screen.getByText('Disponible · 60 %')).toBeInTheDocument()
    expect(screen.getByText(`Dépensé · ${nombre(60_000)} €`)).toBeInTheDocument()
    for (const maquette of ['188 000', '102 470', '85 530', 'Septembre 2026', '▲ 2 semaines de marge', 'Entretien · 42 000 €']) {
      expect(screen.queryByText(maquette)).toBeNull()
    }
  })

  it('budget non saisi : « Budget non renseigné » plutôt qu’un pourcentage inventé', () => {
    rendreTableau(donnees({ immeubles: [immeuble({ nbLots: 5 })] }))
    expect(screen.getAllByText('Budget non renseigné').length).toBeGreaterThan(0)
  })

  it('chargement initial (session en cours de lecture) : « — », aucun chiffre ni nom de la maquette', () => {
    rendreTableau({ authenticated: false, loading: true, missions: [], immeubles: [], artisans: [] })
    expect(screen.getByRole('heading', { level: 1, name: 'Bienvenue' })).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(3)
    for (const maquette of ['40', '188', '188 000', 'Super Admin', 'Synchronisé il y a 2 min', 'Fonctionnement stable', 'dans 4 immeubles']) {
      expect(screen.queryByText(maquette)).toBeNull()
    }
    // Ni pastille « aucun ordre » ni « budget non renseigné » avant les données.
    expect(screen.queryByText('Aucun ordre de service en attente')).toBeNull()
    expect(screen.queryByText('Budget non renseigné')).toBeNull()
  })

  it('premières données du cabinet attendues (connecté) : « — » plutôt que des zéros', () => {
    rendreTableau({ authenticated: true, loading: true, missions: [], immeubles: [], artisans: [] })
    expect(screen.getAllByText('—').length).toBeGreaterThan(3)
    expect(screen.queryByText('Aucun ordre de service en attente')).toBeNull()
    expect(screen.queryByText('dans 0 immeubles')).toBeNull()
  })

  it('rafraîchissement (données déjà là) : les chiffres restent affichés', () => {
    rendreTableau(donnees({ loading: true }))
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('2 ordres de service en attente')).toBeInTheDocument()
  })

  it('preview anonyme inchangée (maquette)', () => {
    render(<V54LocaleProvider locale="fr-FR"><ToastProvider><ModDashboard /></ToastProvider></V54LocaleProvider>)
    expect(screen.getByRole('heading', { level: 1, name: 'Bienvenue, Super Admin' })).toBeInTheDocument()
    expect(screen.getByText('188 000')).toBeInTheDocument()
    expect(screen.getByText('Synchronisé il y a 2 min')).toBeInTheDocument()
  })
})

describe('nomAffiche', () => {
  it('cabinet, puis société, puis nom complet ; null sinon', () => {
    expect(nomAffiche({ cabinet_name: ' Cabinet Phocéen ', full_name: 'F. C.' })).toBe('Cabinet Phocéen')
    expect(nomAffiche({ full_name: 'Frédéric Carvalho' })).toBe('Frédéric Carvalho')
    expect(nomAffiche({ full_name: '  ' })).toBeNull()
    expect(nomAffiche(undefined)).toBeNull()
  })
})

const renderModule = (route: string) => <div data-testid="active">{route}</div>

describe('Sidebar v54 — compteurs', () => {
  it('compteursReels : ordres en attente, signalements en attente, immeubles, prestataires', () => {
    const signalements = [{ statut: 'en_attente' }, { statut: 'en_cours' }] as Signalement[]
    expect(compteursReels({ ...donnees(), artisans: [{}, {}, {}] as SyndicData['artisans'], signalements }))
      .toEqual({ ordens: 2, canal: 1, edificios: 2, profissionais: 3 })
  })

  it('connecté : compteurs réels à la place de ceux de la maquette (4, 1, 4, 9) ; zéro masqué', () => {
    render(<DashboardShell renderModule={renderModule} compteurs={{ ordens: 3, canal: 0, edificios: 2, profissionais: 5 }} />)
    expect(screen.getByRole('button', { name: /Ordens de serviço/ }).textContent).toBe('Ordens de serviço3')
    expect(screen.getByRole('button', { name: /Canal de Comunicações/ }).textContent).toBe('Canal de Comunicações')
    expect(screen.getByRole('button', { name: /Edifícios/ }).textContent).toBe('Edifícios2')
    expect(screen.getByRole('button', { name: /^Profissionais/ }).textContent).toBe('Profissionais5')
  })

  it('chargement initial : aucune pastille (ni réelle, ni de la maquette)', () => {
    render(
      <SyndicDataContext.Provider value={{ authenticated: false, loading: true, missions: [], immeubles: [], artisans: [] }}>
        <DashboardShell renderModule={renderModule} />
      </SyndicDataContext.Provider>,
    )
    expect(screen.getByRole('button', { name: /Ordens de serviço/ }).textContent).toBe('Ordens de serviço')
    expect(screen.getByRole('button', { name: /Canal de Comunicações/ }).textContent).toBe('Canal de Comunicações')
    expect(screen.getByRole('button', { name: /^Profissionais/ }).textContent).toBe('Profissionais')
  })

  it('anonyme : compteurs de la maquette conservés', () => {
    render(<DashboardShell renderModule={renderModule} />)
    expect(screen.getByRole('button', { name: /Ordens de serviço/ }).textContent).toBe('Ordens de serviço4')
    expect(screen.getByRole('button', { name: /^Profissionais/ }).textContent).toBe('Profissionais9')
  })
})

describe('Barre du haut et pied de sidebar v54', () => {
  it('« Nova missão » ouvre les ordres de service', () => {
    render(<DashboardShell renderModule={renderModule} />)
    fireEvent.click(screen.getByRole('button', { name: /Nova missão/ }))
    expect(screen.getByTestId('active').textContent).toBe('ordens')
  })

  it('lien « Panneau admin » seulement quand il est fourni', () => {
    render(<V54LocaleProvider locale="fr-FR"><DashboardShell renderModule={renderModule} lienAdmin="/admin/exit" /></V54LocaleProvider>)
    expect(screen.getByRole('link', { name: 'Panneau admin' }).getAttribute('href')).toBe('/admin/exit')
    cleanup()
    render(<DashboardShell renderModule={renderModule} />)
    expect(screen.queryByRole('link')).toBeNull()
  })
})

describe('SyndicDashboardV54 — session super_admin', () => {
  /** Emplacement de la page (jsdom ne navigue pas) : l'affectation de href est observable. */
  const emplacement = () => ({ href: '/fr/syndic/v54', pathname: '/fr/syndic/v54', search: '', hash: '' })

  function brancherFetch() {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({}), { status: 200 }))
  }

  it('accueil au nom de la session, lien vers le panneau admin, « Se déconnecter » → signOut puis /fr/syndic/login', async () => {
    brancherFetch()
    const origine = Object.getOwnPropertyDescriptor(window, 'location')
    Object.defineProperty(window, 'location', { configurable: true, value: emplacement() })
    try {
      render(<V54LocaleProvider locale="fr-FR"><SyndicDashboardV54 /></V54LocaleProvider>)
      // Chargement des ~40 jeux de données du cabinet : délai large (suite complète en parallèle).
      expect(await screen.findByRole('heading', { level: 1, name: 'Bienvenue, Frédéric Carvalho' }, { timeout: 10_000 })).toBeInTheDocument()
      expect((await screen.findByRole('link', { name: 'Panneau admin' }, { timeout: 10_000 })).getAttribute('href')).toBe('/admin/dashboard')
      fireEvent.click(screen.getByRole('button', { name: /Se déconnecter/ }))
      await waitFor(() => expect(h.signOut).toHaveBeenCalledTimes(1), { timeout: 10_000 })
      // Session de cet appareil seulement (les autres sessions du compte restent ouvertes).
      expect(h.signOut).toHaveBeenCalledWith({ scope: 'local' })
      await waitFor(() => expect(window.location.href).toBe('/fr/syndic/login'), { timeout: 10_000 })
    } finally {
      if (origine) Object.defineProperty(window, 'location', origine)
    }
  })

  it('échec de la déconnexion : message d’erreur, on reste sur le tableau de bord', async () => {
    brancherFetch()
    h.signOut.mockResolvedValueOnce({ error: new Error('réseau') })
    const origine = Object.getOwnPropertyDescriptor(window, 'location')
    Object.defineProperty(window, 'location', { configurable: true, value: emplacement() })
    try {
      render(<V54LocaleProvider locale="fr-FR"><SyndicDashboardV54 /></V54LocaleProvider>)
      await screen.findByRole('heading', { level: 1, name: 'Bienvenue, Frédéric Carvalho' }, { timeout: 10_000 })
      fireEvent.click(screen.getByRole('button', { name: /Se déconnecter/ }))
      expect(await screen.findByText('Déconnexion impossible', {}, { timeout: 10_000 })).toBeInTheDocument()
      expect(window.location.href).toBe('/fr/syndic/v54')
    } finally {
      if (origine) Object.defineProperty(window, 'location', origine)
    }
  })
})
