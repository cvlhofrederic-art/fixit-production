// tests/components/coproprietaire/documents.test.tsx
//
// Écran « Documents » du portail copropriétaire (EcranDocuments) :
// - rendu avec l'espace de démonstration : règlement structuré, procès-verbaux, contrats et
//   assurances traduits en français (jamais « limpezas » ni « multirriscos »), devis, autres ;
// - ouverture d'un fichier avec jeton : GET /api/coproprietaire/documents/<id> en Bearer, puis window.open ;
// - erreur d'ouverture persistante sous la ligne ; démonstration sans jeton (aucun appel réseau) ;
// - état vide, locataire (règlement seulement) ;
// - repartirDocuments : rubrique prioritaire, puis type ; tri du plus récent au plus ancien.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

import EcranDocuments, { repartirDocuments } from '@/components/coproprietaire-dashboard/ecrans/EcranDocuments'
import type { PropsEcran } from '@/components/coproprietaire-dashboard/contrat'
import { espaceDemo } from '@/lib/coproprietaire/demo'
import { euros, remplir, textesCopro } from '@/lib/coproprietaire/textes'
import type { DocumentImmeuble, EspaceCopro } from '@/lib/coproprietaire/types'

const t = textesCopro('fr')

function propsEcran(surcharges: Partial<PropsEcran> = {}): PropsEcran {
  return {
    espace: espaceDemo(),
    t,
    langue: 'fr',
    jeton: null,
    allerA: vi.fn(),
    rafraichir: vi.fn(async () => {}),
    miseAJourLe: new Date('2026-10-17T09:00:00+02:00'),
    ...surcharges,
  }
}

function espaceVide(): EspaceCopro {
  const espace = espaceDemo()
  return {
    ...espace,
    immeuble: { ...espace.immeuble, reglement: null },
    documents: { fichiers: [], contrats: [], assurances: [] },
  }
}

function fichier(partiel: Partial<DocumentImmeuble> & Pick<DocumentImmeuble, 'id'>): DocumentImmeuble {
  return {
    nom: `${partiel.id}.pdf`,
    type: 'autre',
    categorie: null,
    personnel: false,
    mimeType: 'application/pdf',
    tailleOctets: 1000,
    ajouteLe: '2026-01-01',
    tags: [],
    ...partiel,
  }
}

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })

/** Même normalisation que Testing Library : les espaces insécables d'Intl deviennent des espaces simples. */
const lisible = (texte: string) => texte.replace(/\s+/g, ' ')

/** Section (Carte) dont le titre est `titre`. */
function section(titre: string): HTMLElement {
  const h2 = screen.getByRole('heading', { name: titre })
  const carte = h2.closest('section')
  if (!carte) throw new Error(`Section « ${titre} » introuvable`)
  return carte
}

/** Bouton « Ouvrir » de la ligne du fichier nommé `nom`. */
function boutonOuvrir(nom: string): HTMLElement {
  const ligne = screen.getByText(nom).closest('li')
  if (!ligne) throw new Error(`Ligne « ${nom} » introuvable`)
  return within(ligne).getByRole('button')
}

let openSimule: ReturnType<typeof vi.fn>

beforeEach(() => {
  openSimule = vi.fn(() => null)
  vi.stubGlobal('open', openSimule)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

// ── Rendu de démonstration ────────────────────────────────────────────────────

describe('EcranDocuments — rendu avec les données de démonstration', () => {
  it('affiche le règlement structuré, avec sa date de mise à jour et sa répartition', () => {
    render(<EcranDocuments {...propsEcran()} />)
    const carte = section(t.documents.reglement)
    expect(within(carte).getByText('Mis à jour le 10 mars 2020')).toBeInTheDocument()
    expect(within(carte).getByText(t.documents.repartition)).toBeInTheDocument()
    expect(within(carte).getByText(/Charges générales réparties aux tantièmes généraux/)).toBeInTheDocument()
    expect(within(carte).getByText(/Majorité de l’article 24/)).toBeInTheDocument()
    expect(within(carte).getByText(t.documents.fondsTravaux)).toBeInTheDocument()
    expect(within(carte).getByText('oui')).toBeInTheDocument()
    expect(within(carte).getByText('5 %')).toBeInTheDocument()
    // Nom du PDF en texte, sans bouton tant qu'aucun fichier publié ne le porte.
    expect(within(carte).getByText('Règlement de copropriété — Résidence Le Prado.pdf')).toBeInTheDocument()
    expect(within(carte).queryByRole('button')).not.toBeInTheDocument()
    // Pas de texte de règlement en démo : pas de dépliant.
    expect(within(carte).queryByText(t.documents.reglementTexte)).not.toBeInTheDocument()
  })

  it('liste les deux procès-verbaux, le plus récent en premier', () => {
    render(<EcranDocuments {...propsEcran()} />)
    const carte = section(t.documents.pv)
    const lignes = within(carte).getAllByRole('listitem')
    expect(lignes).toHaveLength(2)
    expect(lignes[0]).toHaveTextContent('PV AG ordinaire du 11 juin 2026.pdf')
    expect(lignes[0]).toHaveTextContent('ajouté le 25 juin 2026')
    expect(lignes[0]).toHaveTextContent('2,4 Mo')
    expect(lignes[1]).toHaveTextContent('PV AG extraordinaire toiture — 20 septembre 2025.pdf')
  })

  it('traduit les contrats et l’assurance en français, avec coût, statut et fichiers associés', () => {
    render(<EcranDocuments {...propsEcran()} />)
    const carte = section(t.documents.contrats)
    const jusquAu = (date: string) => remplir(t.documents.jusquAu, { date })

    expect(within(carte).getByText(`Sécurité — Gardiennage Sud Services — ${jusquAu('31 décembre 2026')}`)).toBeInTheDocument()
    expect(within(carte).getByText(`Nettoyage — Propre & Net — ${jusquAu('31 décembre 2026')}`)).toBeInTheDocument()
    expect(within(carte).getByText(`Ascenseur — Ascenseurs Phocéens — ${jusquAu('30 juin 2027')}`)).toBeInTheDocument()
    expect(within(carte).getByText(
      `Assurance multirisque — AXA — ${remplir(t.documents.police, { numero: 'MRI-2026-4471' })} — ${jusquAu('31 décembre 2026')}`,
    )).toBeInTheDocument()

    expect(within(carte).getByText(lisible(remplir(t.documents.parMois, { montant: euros(650, 'fr') })))).toBeInTheDocument()
    expect(within(carte).getByText(lisible(remplir(t.documents.parAn, { montant: euros(4800, 'fr') })))).toBeInTheDocument()
    expect(within(carte).getAllByText('En cours')).toHaveLength(4)

    expect(within(carte).getByText('Contrat de gardiennage 2026.pdf')).toBeInTheDocument()
    expect(within(carte).getByText('Contrat d’assurance de l’immeuble 2026.pdf')).toBeInTheDocument()

    const texte = document.body.textContent ?? ''
    for (const brut of ['limpezas', 'multirriscos', 'seguranca', 'elevadores', 'ativo', 'ativa']) {
      expect(texte).not.toContain(brut)
    }
  })

  it('affiche le devis et les autres documents, chacun avec un seul bouton « Ouvrir »', () => {
    render(<EcranDocuments {...propsEcran()} />)
    const devis = section(t.documents.devis)
    expect(within(devis).getByText('Devis chaudière à condensation — Thermo Services.pdf')).toBeInTheDocument()
    expect(within(devis).getAllByRole('button', { name: t.commun.ouvrir })).toHaveLength(1)

    const autres = section(t.documents.autres)
    const lignes = within(autres).getAllByRole('listitem')
    expect(lignes).toHaveLength(3)
    expect(lignes[0]).toHaveTextContent('Convocation AG extraordinaire du 19 novembre 2026.pdf')
    expect(lignes[0]).toHaveTextContent('ajouté le 5 octobre 2026')
    expect(lignes[1]).toHaveTextContent('Comptes annuels 2025.pdf')
    expect(lignes[2]).toHaveTextContent('Budget prévisionnel 2027.pdf')

    // Huit fichiers, huit boutons « Ouvrir » ; pas d'état vide.
    expect(screen.getAllByRole('button', { name: t.commun.ouvrir })).toHaveLength(8)
    expect(screen.queryByText(t.documents.aucunDocument)).not.toBeInTheDocument()
  })

  it('présente les sections dans l’ordre : règlement, PV, contrats, devis, autres', () => {
    render(<EcranDocuments {...propsEcran()} />)
    const titres = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)
    expect(titres).toEqual([t.documents.reglement, t.documents.pv, t.documents.contrats, t.documents.devis, t.documents.autres])
  })

  it('marque d’un badge les documents de l’espace personnel', () => {
    const espace = espaceDemo()
    espace.documents.fichiers.push(fichier({
      id: 'perso-1', nom: 'Compte individuel 2025 — lot 12.pdf', categorie: 'compte_individuel', personnel: true, ajouteLe: '2026-09-01',
    }))
    render(<EcranDocuments {...propsEcran({ espace })} />)
    const ligne = screen.getByText('Compte individuel 2025 — lot 12.pdf').closest('li')
    expect(ligne).not.toBeNull()
    expect(within(ligne as HTMLElement).getByText('Personnel')).toBeInTheDocument()
    expect(section(t.documents.autres)).toContainElement(ligne as HTMLElement)
    // Un seul badge « Personnel » dans toute la page.
    expect(screen.getAllByText('Personnel')).toHaveLength(1)
  })
})

// ── Ouverture d'un fichier ────────────────────────────────────────────────────

describe('EcranDocuments — ouverture d’un fichier', () => {
  it('demande l’URL signée avec le jeton puis ouvre un nouvel onglet', async () => {
    // L'URL signée vient du stockage Supabase : safeOpen n'ouvre que cette origine.
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://projet-test.supabase.co')
    const fetchSimule = vi.fn(async () => json({ url: 'https://projet-test.supabase.co/storage/v1/object/sign/documents/pv-11-juin-2026.pdf?token=jeton-factice' }))
    vi.stubGlobal('fetch', fetchSimule)
    render(<EcranDocuments {...propsEcran({ jeton: 'jeton-test', espace: { ...espaceDemo(), source: 'reel' } })} />)

    const bouton = boutonOuvrir('PV AG ordinaire du 11 juin 2026.pdf')
    fireEvent.click(bouton)

    expect(bouton).toHaveTextContent(t.documents.ouvertureEnCours)
    expect(bouton).toBeDisabled()

    await waitFor(() => expect(openSimule).toHaveBeenCalledWith('https://projet-test.supabase.co/storage/v1/object/sign/documents/pv-11-juin-2026.pdf?token=jeton-factice', '_blank', 'noopener,noreferrer'))

    expect(fetchSimule).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSimule.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/coproprietaire/documents/demo-doc-4')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jeton-test')

    await waitFor(() => expect(bouton).toHaveTextContent(t.commun.ouvrir))
    expect(bouton).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('affiche une erreur persistante sous la ligne quand le serveur refuse', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'serveur' }, 500)))
    render(<EcranDocuments {...propsEcran({ jeton: 'jeton-test', espace: { ...espaceDemo(), source: 'reel' } })} />)

    const nom = 'Devis chaudière à condensation — Thermo Services.pdf'
    fireEvent.click(boutonOuvrir(nom))

    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveTextContent(t.documents.erreurOuverture)
    expect(screen.getByText(nom).closest('li')).toContainElement(alerte)
    expect(openSimule).not.toHaveBeenCalled()

    // Le bouton redevient utilisable, l'erreur reste affichée (pas de minuterie).
    const bouton = boutonOuvrir(nom)
    expect(bouton).toHaveTextContent(t.commun.ouvrir)
    expect(bouton).toBeEnabled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    // Les autres lignes ne portent pas l'erreur.
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('affiche la même erreur quand le réseau est coupé', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    render(<EcranDocuments {...propsEcran({ jeton: 'jeton-test', espace: { ...espaceDemo(), source: 'reel' } })} />)

    fireEvent.click(boutonOuvrir('Comptes annuels 2025.pdf'))

    expect(await screen.findByRole('alert')).toHaveTextContent(t.documents.erreurOuverture)
    expect(openSimule).not.toHaveBeenCalled()
  })

  it('affiche la même erreur quand l’URL renvoyée n’est pas celle du stockage Supabase', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://projet-test.supabase.co')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => json({ url: 'https://evil.example/pv-11-juin-2026.pdf' })))
    render(<EcranDocuments {...propsEcran({ jeton: 'jeton-test', espace: { ...espaceDemo(), source: 'reel' } })} />)

    const nom = 'PV AG ordinaire du 11 juin 2026.pdf'
    fireEvent.click(boutonOuvrir(nom))

    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveTextContent(t.documents.erreurOuverture)
    expect(screen.getByText(nom).closest('li')).toContainElement(alerte)
    expect(openSimule).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith('[safe-url] URL refusée')
    expect(boutonOuvrir(nom)).toBeEnabled()
  })

  it('en démonstration (sans jeton), n’appelle rien et explique que le document est fictif', () => {
    const fetchSimule = vi.fn()
    vi.stubGlobal('fetch', fetchSimule)
    render(<EcranDocuments {...propsEcran({ jeton: null })} />)

    const nom = 'Contrat de gardiennage 2026.pdf'
    fireEvent.click(boutonOuvrir(nom))

    expect(fetchSimule).not.toHaveBeenCalled()
    expect(openSimule).not.toHaveBeenCalled()
    const info = screen.getByRole('status')
    expect(info).toHaveTextContent(t.shell.demoVisiteur)
    expect(screen.getByText(nom).closest('li')).toContainElement(info)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

// ── États vide et locataire ───────────────────────────────────────────────────

describe('EcranDocuments — état vide et locataire', () => {
  it('sans aucun document ni règlement : un état vide et aucune section', () => {
    render(<EcranDocuments {...propsEcran({ espace: espaceVide() })} />)
    expect(screen.getByText(t.documents.aucunDocument)).toBeInTheDocument()
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('sans fichier mais avec un règlement : la carte du règlement reste, puis l’état vide', () => {
    const espace = espaceVide()
    espace.immeuble.reglement = espaceDemo().immeuble.reglement
    render(<EcranDocuments {...propsEcran({ espace })} />)
    expect(screen.getByRole('heading', { name: t.documents.reglement })).toBeInTheDocument()
    expect(screen.getByText(t.documents.aucunDocument)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: t.documents.contrats })).not.toBeInTheDocument()
  })

  it('un fichier publié de rubrique « règlement » s’ouvre depuis la carte du règlement, sans doublon', () => {
    const espace = espaceDemo()
    espace.documents.fichiers.push(fichier({ id: 'regl-1', nom: 'Règlement de copropriété.pdf', categorie: 'reglement', ajouteLe: '2020-03-10' }))
    render(<EcranDocuments {...propsEcran()} espace={espace} />)
    const carte = section(t.documents.reglement)
    expect(within(carte).getByText('Règlement de copropriété.pdf')).toBeInTheDocument()
    expect(within(carte).getByRole('button', { name: t.commun.ouvrir })).toBeInTheDocument()
    expect(screen.getAllByText('Règlement de copropriété.pdf')).toHaveLength(1)
    // Le nom déclaré dans la fiche n'est plus répété en texte.
    expect(within(carte).queryByText('Règlement de copropriété — Résidence Le Prado.pdf')).not.toBeInTheDocument()
  })

  it('un locataire ne voit que le règlement', () => {
    const espace = espaceDemo()
    espace.profil.role = 'locataire'
    render(<EcranDocuments {...propsEcran({ espace })} />)
    expect(screen.getByRole('heading', { name: t.documents.reglement })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText('PV AG ordinaire du 11 juin 2026.pdf')).not.toBeInTheDocument()
    expect(screen.queryByText(/Gardiennage Sud Services/)).not.toBeInTheDocument()
    expect(screen.queryByText(t.documents.aucunDocument)).not.toBeInTheDocument()
  })

  it('un locataire sans règlement voit l’état vide', () => {
    const espace = espaceDemo()
    espace.profil.role = 'locataire'
    espace.immeuble.reglement = null
    render(<EcranDocuments {...propsEcran({ espace })} />)
    expect(screen.getByText(t.documents.aucunDocument)).toBeInTheDocument()
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0)
  })
})

// ── repartirDocuments ─────────────────────────────────────────────────────────

describe('repartirDocuments', () => {
  it('répartit les fichiers de démonstration en quatre sections', () => {
    const r = repartirDocuments(espaceDemo().documents.fichiers)
    expect(r.pv.map(f => f.id)).toEqual(['demo-doc-4', 'demo-doc-9'])
    expect(r.contrats.map(f => f.id)).toEqual(['demo-doc-7', 'demo-doc-8'])
    expect(r.devis.map(f => f.id)).toEqual(['demo-doc-2'])
    expect(r.autres.map(f => f.id)).toEqual(['demo-doc-1', 'demo-doc-5', 'demo-doc-6'])
  })

  it('fait primer la rubrique choisie par le syndic sur le type du document', () => {
    const r = repartirDocuments([
      fichier({ id: 'a', type: 'pv_assemblee', categorie: 'convocation' }),
      fichier({ id: 'b', type: 'autre', categorie: 'pv_ag' }),
      fichier({ id: 'c', type: 'autre', categorie: 'assurance' }),
      fichier({ id: 'd', type: 'autre', categorie: 'contrat_syndic' }),
      fichier({ id: 'e', type: 'autre', categorie: 'devis_approuve' }),
      fichier({ id: 'f', type: 'devis', categorie: 'autre' }),
      fichier({ id: 'g', type: 'contrat', categorie: 'budget' }),
    ])
    expect(r.pv.map(f => f.id)).toEqual(['b'])
    expect(r.contrats.map(f => f.id)).toEqual(['c', 'd'])
    expect(r.devis.map(f => f.id)).toEqual(['e'])
    expect(r.autres.map(f => f.id)).toEqual(['a', 'f', 'g'])
  })

  it('sans rubrique, se fonde sur le type', () => {
    const r = repartirDocuments([
      fichier({ id: 'pv1', type: 'pv_assemblee' }),
      fichier({ id: 'pv2', type: 'ata_ag' }),
      fichier({ id: 'ct', type: 'contrat' }),
      fichier({ id: 'dv', type: 'devis' }),
      fichier({ id: 'au', type: 'autre' }),
    ])
    expect(r.pv.map(f => f.id)).toEqual(['pv1', 'pv2'])
    expect(r.contrats.map(f => f.id)).toEqual(['ct'])
    expect(r.devis.map(f => f.id)).toEqual(['dv'])
    expect(r.autres.map(f => f.id)).toEqual(['au'])
  })

  it('trie chaque section du plus récent au plus ancien sans modifier le tableau reçu', () => {
    const entree = [
      fichier({ id: 'vieux', type: 'devis', ajouteLe: '2024-02-01' }),
      fichier({ id: 'recent', type: 'devis', ajouteLe: '2026-10-05' }),
      fichier({ id: 'moyen', type: 'devis', ajouteLe: '2025-06-15' }),
    ]
    const copie = [...entree]
    const r = repartirDocuments(entree)
    expect(r.devis.map(f => f.id)).toEqual(['recent', 'moyen', 'vieux'])
    expect(entree).toEqual(copie)
  })

  it('rend quatre tableaux vides pour une liste vide', () => {
    expect(repartirDocuments([])).toEqual({ pv: [], contrats: [], devis: [], autres: [] })
  })
})
