// tests/components/vitfixsignal/affichage-telephone.test.tsx
//
// Défauts d'affichage de l'espace Vitfix Signal déjà en ligne, relevés par les captures des écrans des bureaux du
// 19/11/2026 (téléphone de 375 px, ordinateur de 1 280 px) ; corrections validées le 20/11/2026 (point
// h-02). Chaque défaut est corrigé à sa cause, avec les classes et motifs des écrans voisins :
//   - en-tête : titre tronqué à une lettre (13 px) à côté de « Panneau admin » et « Se déconnecter », bloc tenu à la
//     largeur de ses deux boutons, rangée sans retour à la ligne → la rangée passe à la ligne (titre au-dessus des
//     boutons) quand le titre de la vue ne tient pas à côté d'eux, et seulement alors ; boutons bornés à la largeur
//     (max-w-full, motif de la carte commune) ;
//   - barre du bas à cinq entrées (super admin) : « Cabinets » sortait de 3 px et « Tableau de bord » tenait sur trois
//     lignes, plus haut que la barre → libellés en text-xs, centrés, interligne serré (leading-tight, motif de la barre
//     du portail copropriétaire), 4 px au moins entre deux libellés (px-0.5) ; la barre à trois entrées d'un
//     gestionnaire, qui tenait, ne change pas ;
//   - vue Copropriétés : la liste « Afficher » élargissait la page à 483 px → étiquette bornée à la barre (min-w-0
//     max-w-full) et liste qui rétrécit dans son étiquette (min-w-0), comme « Filtrer par copropriété » ;
//   - « Sa page de suivi » (page profil) et lignes des signalements (vue Signalements, tableau de bord) : texte écrasé en
//     colonne étroite à côté de son bouton → bouton sous le texte sur téléphone, côte à côte à partir de sm (motif
//     flex-col sm:flex-row des lignes des bureaux) ;
//   - barre latérale (ordinateur) : « SIGNALEMENTS PAR … » tronqué → deux lignes au plus (line-clamp-2).
// jsdom ne calcule pas la mise en page : on vérifie les classes ; les largeurs ont été mesurées dans Chrome (avant /
// après) à 360, 375, 768, 1 024 et 1 280 px. Données fictives : « Cabinet Exemple », bureau « Nord », @exemple.test.

import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEXTES_TABLEAU_QR as T } from '@/lib/vitfixsignal/affichage'
import { TEXTES_GESTION_QR as G } from '@/lib/vitfixsignal/affichage-gestion'
import { gestionCoproprieteQrVide, type CoproprieteQr, type SignalementQr } from '@/lib/vitfixsignal/types'

type Rappel = (evenement: string, session: unknown) => void
const simul = vi.hoisted(() => ({ getUser: vi.fn(), signOut: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: simul.getUser,
      signOut: simul.signOut,
      onAuthStateChange: (_rappel: Rappel) => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const { default: EspaceVitfixSignal } = await import('@/components/vitfixsignal/espace/EspaceVitfixSignal')
const { default: FicheGestionnaireQr } = await import('@/components/vitfixsignal/FicheGestionnaireQr')

const K1 = 'a0000000-0000-4000-8000-0000000000a1'
const B1 = 'b0000000-0000-4000-8000-0000000000b1'
const G1 = '11111111-1111-4111-8111-111111111111'
const C1 = 'c0000000-0000-4000-8000-000000000001'
const CABINET = { id: K1, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' }

/** Copropriété du tableau ; `avecBureau` : rattachée au bureau Nord (filtre « Bureau » de la vue Copropriétés). */
const residence = (avecBureau: boolean): CoproprieteQr => ({
  ...gestionCoproprieteQrVide(), id: C1, nom: 'Résidence Exemple', adresse: '12 rue Exemple', jeton: '0123456789abcdef0123456789abcdef',
  emailsDestinataires: [], actif: true, creeLe: '2026-11-01T10:00:00.000Z', nbSignalements: 1, nbEnAttente: 1, derniereAdresseProposee: null,
  cabinet: CABINET, codePostal: '13001', ville: 'Marseille', gestionnaires: [{ id: G1, nom: 'Marie Exemple' }], ouverts: 1, urgentsOuverts: 1,
  dernier: '2026-11-18T10:00:00.000Z', ...(avecBureau ? { bureau: { id: B1, nom: 'Nord', ferme: false } } : {}),
})
const signalement: SignalementQr = {
  id: '5a000000-0000-4000-8000-000000000001', coproprieteId: C1, coproprieteNom: 'Résidence Exemple', prenom: 'Alex', nom: 'Exemple',
  telephone: '06 00 00 00 00', email: 'alex.exemple@exemple.test', batiment: 'A', etage: '2', numLot: '12', estPartieCommune: false,
  zoneSignalee: '', typeIntervention: 'Plomberie (fuite, colonne, robinetterie)', description: 'Description fictive', priorite: 'urgente',
  statut: 'en_attente', langue: 'fr', emailEnvoyeLe: null, emailErreur: null, confirmationEnvoyeeLe: null, confirmationErreur: null,
  qualiteDeclarant: 'proprietaire', adresseProposee: '', signalementLieId: null, creeLe: '2026-11-18T10:00:00.000Z', misAJourLe: '2026-11-18T10:00:00.000Z',
}
const marie = {
  id: G1, nom: 'Marie Exemple', cabinet: CABINET, email: 'marie.exemple@exemple.test', etat: 'adresse_confirmee', domaineForce: false,
  coproprietes: 1, ouverts: 1, urgents: 1, creeLe: '2026-11-01T09:00:00.000Z', confirmeeLe: '2026-11-02T09:00:00.000Z',
}
const MOI = { profil: 'gestionnaire', nom: 'Marie Exemple', cabinet: { identifiant: 'cabinet-exemple', nom: 'Cabinet Exemple', domaines: ['exemple.test'] } }

let avecBureau = false
function reponse(url: string): unknown {
  if (url.startsWith('/api/vitfixsignal/tableau')) return { tableau: { coproprietes: [residence(avecBureau)], signalements: [signalement] } }
  if (url === '/api/vitfixsignal/cabinets') return { cabinets: [{ ...CABINET, langue: 'fr', domaines: ['exemple.test'], identifiantFige: true, nbCoproprietes: 1, nbGestionnaires: 1 }] }
  if (url.startsWith('/api/vitfixsignal/gestionnaires?')) return { gestionnaires: [marie] }
  if (url === `/api/vitfixsignal/gestionnaires/${G1}`) return { gestionnaire: marie, envois: [], attributions: [], creations: [], journal: [] }
  if (url.startsWith(`/api/vitfixsignal/coproprietes/${C1}/signalements`)) return { signalements: [signalement], suite: null }
  if (url === '/api/vitfixsignal/moi') return MOI
  return {}
}

beforeEach(() => {
  vi.clearAllMocks()
  avecBureau = false
  simul.signOut.mockResolvedValue({ error: null })
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(reponse(url)), { status: 200, headers: { 'content-type': 'application/json' } })))
})
afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

const PREMIER_RENDU = { timeout: 5000 }
const utilisateur = (app_metadata: Record<string, unknown>) =>
  ({ data: { user: { id: 'u1', email: 'admin@exemple.test', app_metadata, user_metadata: {} } }, error: null })

/** Espace du super admin ouvert sur une vue (ancre), titre affiché. */
async function espaceSuperAdmin(ancre: string, vue: string) {
  simul.getUser.mockResolvedValue(utilisateur({ role: 'super_admin' }))
  window.history.replaceState(null, '', `/fr/vitfixsignal/${ancre}`)
  const rendu = render(<EspaceVitfixSignal />)
  await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(vue), PREMIER_RENDU)
  return rendu
}

/** Espace d'un gestionnaire (vitfix.io/cabinet-exemple/suivi/), tableau de bord affiché. */
async function espaceGestionnaire() {
  simul.getUser.mockResolvedValue(utilisateur({ role: 'gestionnaire_signalement', vitfixsignal_cabinet: 'cabinet-exemple' }))
  window.history.replaceState(null, '', '/cabinet-exemple/suivi/')
  const rendu = render(<EspaceVitfixSignal cabinet={{ identifiant: 'cabinet-exemple', nom: 'Cabinet Exemple' }} />)
  await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tableau de bord'), PREMIER_RENDU)
  return rendu
}

const barreDuBas = () => screen.getAllByRole('navigation', { name: 'Menu Vitfix Signal' })[1]

describe('en-tête de l’espace (titre tronqué à une lettre sur téléphone)', () => {
  /**
   * La rangée passe à la ligne (flex-wrap) seulement quand le titre de la vue ne tient pas à côté des boutons : seul le
   * h1 donne au bloc des textes sa largeur propre (les deux autres lignes, w-0 min-w-full, en prennent la largeur sans
   * l'élargir) et le bloc s'étend (grow) sur la place laissée par les boutons. Mesuré dans Chrome : super admin sur
   * téléphone, titre de 13 px avant, sur toute la largeur après (boutons dessous) ; gestionnaire (un bouton) et
   * ordinateur (1 024 et 1 280 px) : en-tête d'avant, aux mêmes dimensions.
   */
  const verifierRangee = (container: HTMLElement) => {
    const rangee = (container.querySelector('header') as HTMLElement).firstElementChild as HTMLElement
    expect(rangee).toHaveClass('flex', 'flex-wrap', 'items-center', 'justify-between')
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveClass('truncate')
    expect(h1).not.toHaveClass('w-0')
    const textes = h1.parentElement as HTMLElement
    expect(textes).toHaveClass('min-w-0', 'grow')
    const lignes = [...textes.children].filter((e) => e !== h1)
    expect(lignes).toHaveLength(2)
    for (const ligne of lignes) expect(ligne).toHaveClass('w-0', 'min-w-full', 'truncate')
    const boutons = screen.getByRole('button', { name: 'Se déconnecter' }).parentElement as HTMLElement
    expect(boutons).toBe(rangee.lastElementChild)
    expect(boutons).toHaveClass('flex', 'flex-wrap', 'max-w-full', 'shrink-0')
  }

  it('super admin : la rangée passe à la ligne quand le titre ne tient pas à côté des boutons ; boutons bornés à la largeur', async () => {
    const { container } = await espaceSuperAdmin('#tableau-de-bord', 'Tableau de bord')
    verifierRangee(container)
  })

  it('espace d’un gestionnaire (un bouton) : la même rangée', async () => {
    const { container } = await espaceGestionnaire()
    verifierRangee(container)
  })
})

describe('barre latérale (ordinateur) : sous-titre tronqué', () => {
  it('« Signalements par QR code » sur deux lignes au plus, au lieu d’une ligne tronquée', async () => {
    await espaceSuperAdmin('#tableau-de-bord', 'Tableau de bord')
    const laterale = screen.getByRole('complementary', { name: 'Vitfix Signal' })
    const sousTitre = within(laterale).getByText('Signalements par QR code')
    expect(sousTitre).toHaveClass('line-clamp-2', 'break-words')
    expect(sousTitre).not.toHaveClass('truncate')
  })

  it('espace d’un gestionnaire : le nom du cabinet, même forme (deux lignes au plus)', async () => {
    await espaceGestionnaire()
    const laterale = screen.getByRole('complementary', { name: 'Vitfix Signal' })
    expect(within(laterale).getByText('Cabinet Exemple')).toHaveClass('line-clamp-2')
  })
})

describe('barre du bas (téléphone)', () => {
  it('cinq entrées (super admin) : libellés en text-xs, centrés, interligne serré, 4 px au moins entre eux (« Cabinets » dans l’écran, « Tableau de bord » sur deux lignes)', async () => {
    await espaceSuperAdmin('#tableau-de-bord', 'Tableau de bord')
    const liens = within(barreDuBas()).getAllByRole('link')
    expect(liens.map((l) => l.textContent)).toEqual(['Tableau de bord', 'Copropriétés', 'Signalements', 'Gestionnaires', 'Cabinets'])
    for (const lien of liens) {
      expect(lien).toHaveClass('text-xs', 'px-0.5')
      expect(lien).not.toHaveClass('text-sm')
      expect(within(lien).getByText(lien.textContent ?? '')).toHaveClass('text-center', 'leading-tight')
    }
  })

  it('trois entrées (gestionnaire), qui tenaient : la barre d’avant (text-sm, libellé sans classe)', async () => {
    await espaceGestionnaire()
    const liens = within(barreDuBas()).getAllByRole('link')
    expect(liens.map((l) => l.textContent)).toEqual(['Tableau de bord', 'Copropriétés', 'Signalements'])
    for (const lien of liens) {
      expect(lien).toHaveClass('text-sm')
      expect(lien).not.toHaveClass('text-xs')
      expect(lien).not.toHaveClass('px-0.5')
      expect(within(lien).getByText(lien.textContent ?? '').getAttribute('class')).toBeNull()
    }
  })
})

describe('vue Copropriétés : liste « Afficher » qui élargissait la page à 483 px', () => {
  /**
   * Étiquette bornée à la barre (min-w-0 max-w-full) et liste qui rétrécit dans son étiquette (min-w-0). Pas de
   * max-w-full sur la liste : elle deviendrait « compressible » (largeur minimale nulle) et, avec le filtre « Bureau »,
   * le groupe des filtres serait écrasé à côté des boutons sur un ordinateur étroit au lieu de passer à la ligne.
   */
  const verifier = () => {
    const liste = screen.getByLabelText(G.copropriete.filtre)
    expect(liste).toHaveClass('min-w-0')
    expect(liste).not.toHaveClass('max-w-full')
    expect(liste.closest('label')).toHaveClass('flex', 'min-w-0', 'max-w-full', 'items-center')
  }

  it('sans bureau : étiquette directement dans la barre', async () => {
    await espaceSuperAdmin('#coproprietes', 'Copropriétés')
    await screen.findByLabelText(G.copropriete.filtre, {}, PREMIER_RENDU)
    expect(screen.queryByLabelText(G.bureaux.filtre.libelle)).toBeNull()
    verifier()
  })

  it('avec le filtre « Bureau » : étiquette dans le groupe des filtres', async () => {
    avecBureau = true
    await espaceSuperAdmin('#coproprietes', 'Copropriétés')
    await screen.findByLabelText(G.bureaux.filtre.libelle, {}, PREMIER_RENDU)
    verifier()
  })
})

describe('lignes à bouton : texte écrasé en colonne étroite à côté du bouton sur téléphone', () => {
  /** Disposition de la ligne : bouton sous le texte sur téléphone, côte à côte à partir de sm ; plus de flex-wrap. */
  const dispositionDe = (bouton: HTMLElement) => bouton.parentElement as HTMLElement

  it('signalements (vue Signalements et tableau de bord) : texte au-dessus de « Voir le détail », côte à côte à partir de sm', async () => {
    await espaceSuperAdmin('#signalements', 'Signalements')
    const bouton = await screen.findByRole('button', { name: T.voirDetail }, PREMIER_RENDU)
    const disposition = dispositionDe(bouton)
    expect(disposition).toHaveClass('flex', 'flex-col', 'items-start', 'sm:flex-row', 'sm:justify-between')
    expect(disposition).not.toHaveClass('flex-wrap')
    expect(disposition.firstElementChild).toHaveClass('min-w-0', 'flex-1')
  })

  it('« Sa page de suivi » : copropriété au-dessus de « Voir les signalements », puis signalements dépliés au-dessus de « Détail »', async () => {
    render(<FicheGestionnaireQr id={G1} coproprietes={[]} gestionnaires={[]} onRetour={vi.fn()} onModifie={vi.fn(async () => {})} />)
    const voir = await screen.findByRole('button', { name: G.suivi.voir }, PREMIER_RENDU)
    const copro = dispositionDe(voir)
    expect(copro).toHaveClass('flex', 'flex-col', 'items-start', 'sm:flex-row', 'sm:justify-between')
    expect(copro).not.toHaveClass('flex-wrap')
    expect(within(copro).getByRole('heading', { name: 'Résidence Exemple', level: 3 })).toBeInTheDocument()

    fireEvent.click(voir)
    const detail = await screen.findByRole('button', { name: G.suivi.voirDetail })
    const ligne = dispositionDe(detail)
    expect(ligne.tagName).toBe('LI')
    expect(ligne).toHaveClass('flex', 'flex-col', 'items-start', 'sm:flex-row', 'sm:items-center', 'sm:justify-between')
    expect(ligne).not.toHaveClass('flex-wrap')
  })
})
