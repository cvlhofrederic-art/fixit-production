// tests/components/coproprietaire/demandes.test.tsx
//
// Écran « Mes demandes » du portail copropriétaire (EcranDemandes + DetailDemande + FormulaireSignalement) :
// - liste des demandes de démonstration : statuts en mots, frise, bouton « Voir le détail » ;
// - détail : fil d'échanges en bulles, compte rendu, coût pour la copropriété, retour ;
// - message au syndic : ajout local en démonstration, POST + rafraîchissement avec un jeton, erreur persistante ;
// - onglet « Travaux dans l'immeuble » : interventions non annulées, jamais d'étage ni de lot d'autrui,
//   préférence d'onglet mémorisée ;
// - formulaire : bouton désactivé tant qu'incomplet, compteur de caractères, corps construit par
//   construireSignalement, erreur réseau persistante (formulaire intact), confirmation persistante,
//   envoi en démonstration sans réseau.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

import EcranDemandes from '@/components/coproprietaire-dashboard/ecrans/EcranDemandes'
import { CLES_PREFERENCES, type PropsEcran } from '@/components/coproprietaire-dashboard/contrat'
import { espaceDemo } from '@/lib/coproprietaire/demo'
import { TYPES_PROBLEME, textesCopro } from '@/lib/coproprietaire/textes'
import { construireSignalement } from '@/lib/copro-signalement'
import type { EspaceCopro, InterventionVue } from '@/lib/coproprietaire/types'

const t = textesCopro('fr')

function props(sur: Partial<PropsEcran> = {}): PropsEcran {
  return {
    espace: espaceDemo(),
    t,
    langue: 'fr',
    jeton: null,
    allerA: vi.fn(),
    rafraichir: vi.fn(async () => {}),
    miseAJourLe: new Date('2026-10-17T09:00:00+02:00'),
    ...sur,
  }
}

/** Espace réel (source 'reel') avec les mêmes données que la démonstration. */
function espaceReel(): EspaceCopro {
  return { ...espaceDemo(), source: 'reel' }
}

type Appel = { url: string; init?: RequestInit }
let appels: Appel[] = []

function simulerFetch(reponse: () => Promise<Response>) {
  appels = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    appels.push({ url, init })
    return reponse()
  }))
}

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })

const boutonEnvoyerAuSyndic = () => screen.getByRole('button', { name: t.demandes.envoyerAuSyndic })

/** Remplit les quatre questions du formulaire (parties communes, escalier, urgent). */
function remplirFormulaire(description = 'Marche cassée au deuxième étage, quelqu’un va tomber.') {
  fireEvent.click(screen.getByRole('radio', { name: t.demandes.dansPartiesCommunes }))
  fireEvent.change(screen.getByLabelText(t.demandes.zone), { target: { value: 'Escalier' } })
  fireEvent.change(screen.getByLabelText(t.demandes.typeProbleme), { target: { value: TYPES_PROBLEME.fr[0] } })
  fireEvent.change(screen.getByLabelText(t.demandes.decrivez), { target: { value: description } })
  fireEvent.click(screen.getByRole('radio', { name: t.demandes.urgenceUrgent }))
}

beforeEach(() => {
  localStorage.clear()
  simulerFetch(async () => json({}, 500))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('EcranDemandes — liste de mes demandes', () => {
  it('affiche les deux demandes de démonstration avec leur statut en mots et une frise', () => {
    render(<EcranDemandes {...props()} />)

    expect(screen.getByRole('button', { name: t.demandes.nouvelleDemande })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: t.demandes.ongletMesDemandes })).toHaveAttribute('aria-selected', 'true')

    expect(screen.getByRole('heading', { name: 'Ascenseur' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Plomberie' })).toBeInTheDocument()
    expect(screen.getByText(t.demandes.statuts.en_attente)).toBeInTheDocument()
    // « Terminée » est aussi le nom de la dernière étape de la frise : on vise l'en-tête de la carte.
    const entetePlomberie = screen.getByRole('heading', { name: 'Plomberie' }).closest('header')
    expect(entetePlomberie).not.toBeNull()
    expect(within(entetePlomberie as HTMLElement).getByText(t.demandes.statuts.terminee)).toBeInTheDocument()
    expect(screen.getByText('envoyée le 29 septembre 2026')).toBeInTheDocument()

    const frises = screen.getAllByRole('list', { name: 'Avancement de la demande' })
    expect(frises).toHaveLength(2)
    // Demande reçue : première étape courante ; demande terminée : quatre étapes faites.
    expect(within(frises[0]).getByText(t.demandes.etapes.recue).closest('li')).toHaveAttribute('aria-current', 'step')
    expect(within(frises[1]).queryByRole('listitem', { current: 'step' })).toBeNull()

    expect(screen.getAllByRole('button', { name: t.commun.voirDetail })).toHaveLength(2)
  })

  it('état vide : phrase et bouton pour signaler', () => {
    const espace = espaceDemo()
    espace.interventions.mesDemandes = []
    render(<EcranDemandes {...props({ espace })} />)
    expect(screen.getByText(t.demandes.aucuneDemande)).toBeInTheDocument()
    // Le bouton de tête et celui de l'état vide portent le même libellé « Signaler un problème ».
    const boutons = screen.getAllByRole('button', { name: t.commun.signalerProbleme })
    expect(boutons).toHaveLength(2)
    fireEvent.click(boutons[1])
    expect(screen.getByRole('heading', { name: t.demandes.nouvelleDemande })).toBeInTheDocument()
    expect(boutonEnvoyerAuSyndic()).toBeDisabled()
  })
})

describe('DetailDemande', () => {
  it('ouvre le détail : fil de trois messages, compte rendu, coût de 420 €, retour à la liste', () => {
    render(<EcranDemandes {...props()} />)
    fireEvent.click(screen.getAllByRole('button', { name: t.commun.voirDetail })[1])

    expect(screen.getByRole('heading', { name: 'Plomberie' })).toBeInTheDocument()
    expect(screen.getByText('Prestataire : Plomberie du Vieux-Port')).toBeInTheDocument()
    expect(screen.getByText(/Pour joindre le prestataire, passez par votre syndic/)).toBeInTheDocument()
    expect(screen.getByText('Passage prévu le 16 septembre 2026')).toBeInTheDocument()
    expect(screen.getByText('Parties communes — Couloir / palier')).toBeInTheDocument()

    const fil = screen.getByRole('list', { name: t.demandes.fil })
    const bulles = within(fil).getAllByRole('listitem')
    expect(bulles).toHaveLength(3)
    expect(within(bulles[0]).getByText(t.demandes.vous)).toBeInTheDocument()
    expect(within(bulles[0]).getByText('Merci de faire vite, l’eau coule depuis ce matin.')).toBeInTheDocument()
    expect(within(bulles[1]).getByText('Votre syndic · Cabinet Dupont')).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: t.demandes.compteRendu })).toBeInTheDocument()
    expect(screen.getByText(/Remplacement du raccord défectueux/)).toBeInTheDocument()
    expect(screen.getByText(/420\s?€ TTC \(devis\) · facturé 420\s?€/)).toBeInTheDocument()
    expect(screen.getByText('Facture — FAC-2026-0931')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retour à mes demandes' }))
    expect(screen.getAllByRole('button', { name: t.commun.voirDetail })).toHaveLength(2)
  })

  it('locataire : aucun montant dans le détail', () => {
    const espace = espaceDemo()
    espace.profil.role = 'locataire'
    render(<EcranDemandes {...props({ espace, cible: 'demo-sig-2' })} />)
    expect(screen.queryByText(/420\s?€/)).toBeNull()
    expect(screen.getByText('Facture — FAC-2026-0931')).toBeInTheDocument()
  })

  it('demande déposée sans connexion (formulaire public) : mention affichée ; rien pour une demande du portail', () => {
    const espace = espaceDemo()
    espace.interventions.mesDemandes = espace.interventions.mesDemandes.map(d => (d.id === 'demo-sig-1' ? { ...d, origine: 'public' as const } : d))
    const { unmount } = render(<EcranDemandes {...props({ espace, cible: 'demo-sig-1' })} />)
    expect(screen.getByText(t.demandes.deposeeSansCompte)).toBeInTheDocument()
    unmount()
    render(<EcranDemandes {...props({ cible: 'demo-sig-2' })} />)
    expect(screen.queryByText(t.demandes.deposeeSansCompte)).toBeNull()
  })

  it('en démonstration : le message est ajouté localement, sans appel réseau', () => {
    render(<EcranDemandes {...props({ cible: 'demo-sig-1' })} />)
    expect(screen.getByRole('heading', { name: 'Ascenseur' })).toBeInTheDocument()

    const bouton = screen.getByRole('button', { name: t.commun.envoyer })
    expect(bouton).toBeDisabled()
    fireEvent.change(screen.getByLabelText(t.demandes.ecrireAuSyndic), { target: { value: 'Le bruit est de plus en plus fort.' } })
    expect(bouton).toBeEnabled()
    fireEvent.click(bouton)

    const fil = screen.getByRole('list', { name: t.demandes.fil })
    expect(within(fil).getAllByRole('listitem')).toHaveLength(2)
    expect(within(fil).getByText('Le bruit est de plus en plus fort.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/Démonstration/)
    expect(appels).toHaveLength(0)
    expect(screen.getByLabelText(t.demandes.ecrireAuSyndic)).toHaveValue('')
  })

  it('avec un jeton : POST /api/coproprietaire/signalement/message puis rafraichir()', async () => {
    simulerFetch(async () => json({ message: { id: 'msg-serveur-1', date: '2026-10-17T10:00:00+02:00' } }))
    const rafraichir = vi.fn(async () => {})
    render(<EcranDemandes {...props({ espace: espaceReel(), jeton: 'jeton-copro', cible: 'demo-sig-1', rafraichir })} />)

    fireEvent.change(screen.getByLabelText(t.demandes.ecrireAuSyndic), { target: { value: 'Avez-vous une date de passage ?' } })
    fireEvent.click(screen.getByRole('button', { name: t.commun.envoyer }))

    await waitFor(() => expect(screen.getByText(t.demandes.messageEnvoye)).toBeInTheDocument())
    expect(appels).toHaveLength(1)
    expect(appels[0].url).toBe('/api/coproprietaire/signalement/message')
    expect(appels[0].init?.method).toBe('POST')
    expect((appels[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer jeton-copro')
    expect(JSON.parse(appels[0].init?.body as string)).toEqual({ signalementId: 'demo-sig-1', texte: 'Avez-vous une date de passage ?' })
    await waitFor(() => expect(rafraichir).toHaveBeenCalledTimes(1))

    const fil = screen.getByRole('list', { name: t.demandes.fil })
    expect(within(fil).getByText('Avez-vous une date de passage ?')).toBeInTheDocument()
  })

  it('échec de l’envoi : erreur persistante, texte conservé', async () => {
    simulerFetch(async () => json({ error: 'serveur' }, 500))
    render(<EcranDemandes {...props({ espace: espaceReel(), jeton: 'jeton-copro', cible: 'demo-sig-1' })} />)

    fireEvent.change(screen.getByLabelText(t.demandes.ecrireAuSyndic), { target: { value: 'Toujours rien ?' } })
    fireEvent.click(screen.getByRole('button', { name: t.commun.envoyer }))

    expect(await screen.findByRole('alert')).toHaveTextContent(t.demandes.messageErreur)
    expect(screen.getByLabelText(t.demandes.ecrireAuSyndic)).toHaveValue('Toujours rien ?')
    expect(within(screen.getByRole('list', { name: t.demandes.fil })).getAllByRole('listitem')).toHaveLength(1)
  })
})

describe('EcranDemandes — travaux dans l’immeuble', () => {
  it('cible « travaux » : quatre interventions, statuts en mots, badge « ma demande », aucun lot d’autrui', () => {
    const espace = espaceDemo()
    const autrui: InterventionVue = {
      ...espace.interventions.immeuble[0], id: 'int-voisin', type: 'Serrurerie', zone: '', batiment: 'B', etage: '2', numLot: '7',
      estLaMienne: false, statut: 'annulee',
    }
    const voisin: InterventionVue = { ...autrui, id: 'int-voisin-2', statut: 'en_attente', prestataire: '' }
    espace.interventions.immeuble = [...espace.interventions.immeuble, autrui, voisin]
    render(<EcranDemandes {...props({ espace, cible: 'travaux' })} />)

    expect(screen.getByRole('tab', { name: t.demandes.ongletTravaux })).toHaveAttribute('aria-selected', 'true')
    const panneau = screen.getByRole('tabpanel')
    const titres = within(panneau).getAllByRole('heading', { level: 2 }).map(h => h.textContent)
    // L'intervention annulée n'est pas affichée ; celle du voisin l'est, sans son étage ni son lot.
    expect(titres).toEqual([
      'Électricité — Parking / garage',
      'Peinture — Hall d’entrée',
      'Ascenseur — Ascenseur',
      'Plomberie — Couloir / palier',
      'Serrurerie — bâtiment B',
    ])
    expect(within(panneau).getByText(t.demandes.statutsTravaux.acceptee)).toBeInTheDocument()
    expect(within(panneau).getByText(t.demandes.statutsTravaux.en_cours)).toBeInTheDocument()
    expect(within(panneau).getAllByText(t.demandes.statutsTravaux.terminee)).toHaveLength(2)
    expect(within(panneau).getByText('prestataire à désigner')).toBeInTheDocument()
    expect(within(panneau).getAllByText('ma demande')).toHaveLength(1)
    expect(within(panneau).queryByText(/lot 7/)).toBeNull()
    expect(within(panneau).queryByText(/lot 12/)).toBeNull()
    expect(within(panneau).queryByText(/2e étage/)).toBeNull()
    expect(within(panneau).getByText(/3\s?480\s?€ TTC \(devis\)/)).toBeInTheDocument()
    expect(within(panneau).getAllByRole('heading', { name: t.demandes.compteRendu })).toHaveLength(2)
  })

  it('état vide des travaux et préférence d’onglet mémorisée', () => {
    const espace = espaceDemo()
    espace.interventions.immeuble = []
    const { unmount } = render(<EcranDemandes {...props({ espace })} />)
    fireEvent.click(screen.getByRole('tab', { name: t.demandes.ongletTravaux }))
    expect(screen.getByText(t.demandes.aucunTravaux)).toBeInTheDocument()
    expect(localStorage.getItem(CLES_PREFERENCES.ongletDemandes)).toBe('travaux')
    unmount()

    render(<EcranDemandes {...props()} />)
    expect(screen.getByRole('tab', { name: t.demandes.ongletTravaux })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('FormulaireSignalement', () => {
  it('bouton désactivé tant que le formulaire est incomplet, compteur de caractères', () => {
    render(<EcranDemandes {...props({ cible: 'nouvelle' })} />)
    expect(boutonEnvoyerAuSyndic()).toBeDisabled()
    expect(screen.getByText(t.demandes.transmisAuSyndic)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Dans mon logement (bât. D, 4e étage, lot 12)' }))
    expect(screen.queryByLabelText(t.demandes.zone)).toBeNull()
    fireEvent.change(screen.getByLabelText(t.demandes.typeProbleme), { target: { value: TYPES_PROBLEME.fr[0] } })
    fireEvent.click(screen.getByRole('radio', { name: t.demandes.urgenceNon }))
    expect(boutonEnvoyerAuSyndic()).toBeDisabled()

    expect(screen.getByText(t.demandes.descriptionMinimum)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(t.demandes.decrivez), { target: { value: 'Fuite' } })
    expect(screen.getByText('Encore 5 caractère(s) : 10 caractères minimum.')).toBeInTheDocument()
    expect(boutonEnvoyerAuSyndic()).toBeDisabled()

    fireEvent.change(screen.getByLabelText(t.demandes.decrivez), { target: { value: 'Fuite sous l’évier' } })
    expect(screen.getByText(t.demandes.descriptionMinimum)).toBeInTheDocument()
    expect(boutonEnvoyerAuSyndic()).toBeEnabled()

    // Parties communes sans zone choisie : incomplet.
    fireEvent.click(screen.getByRole('radio', { name: t.demandes.dansPartiesCommunes }))
    expect(boutonEnvoyerAuSyndic()).toBeDisabled()
    fireEvent.change(screen.getByLabelText(t.demandes.zone), { target: { value: 'Escalier' } })
    expect(boutonEnvoyerAuSyndic()).toBeEnabled()
    expect(appels).toHaveLength(0)
  })

  it('avec un jeton : POST /api/coproprietaire/signalement, corps construit par construireSignalement, confirmation persistante', async () => {
    simulerFetch(async () => json({ signalement: { id: 'abcdef12-3456-7890' } }))
    const rafraichir = vi.fn(async () => {})
    const espace = espaceReel()
    render(<EcranDemandes {...props({ espace, jeton: 'jeton-copro', cible: 'nouvelle', rafraichir })} />)

    const description = 'Marche cassée au deuxième étage, quelqu’un va tomber.'
    remplirFormulaire(description)
    fireEvent.click(boutonEnvoyerAuSyndic())

    expect(await screen.findByText(/Votre demande a bien été envoyée à votre syndic le/)).toBeInTheDocument()
    expect(screen.getByText('Numéro : ABCDEF12')).toBeInTheDocument()
    expect(screen.getByText(t.demandes.confirmationSuite)).toBeInTheDocument()

    expect(appels).toHaveLength(1)
    expect(appels[0].url).toBe('/api/coproprietaire/signalement')
    expect(appels[0].init?.method).toBe('POST')
    expect((appels[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer jeton-copro')
    expect(JSON.parse(appels[0].init?.body as string)).toEqual({
      ...construireSignalement({ profile: espace.profil, type: TYPES_PROBLEME.fr[0], description, priorite: 'urgente', partieCommune: true, zone: 'Escalier' }),
      // Fiche affichée : la route rattache le signalement à ce lot.
      lot: espace.profil.id,
    })

    // Persistante : toujours là après un délai, pas de minuterie.
    await new Promise(r => setTimeout(r, 60))
    expect(screen.getByText('Numéro : ABCDEF12')).toBeInTheDocument()

    // « Voir ma demande » : rafraîchissement puis détail de la nouvelle demande.
    fireEvent.click(screen.getByRole('button', { name: t.demandes.voirMaDemande }))
    await waitFor(() => expect(rafraichir).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('heading', { name: TYPES_PROBLEME.fr[0] })).toBeInTheDocument()
    expect(screen.getByText(t.demandes.statuts.en_attente)).toBeInTheDocument()
    expect(screen.getByText('Parties communes — Escalier')).toBeInTheDocument()
  })

  it('erreur réseau : encadré persistant, formulaire intact, puis nouvel essai possible', async () => {
    simulerFetch(async () => { throw new TypeError('Failed to fetch') })
    render(<EcranDemandes {...props({ espace: espaceReel(), jeton: 'jeton-copro', cible: 'nouvelle' })} />)
    const description = 'Marche cassée au deuxième étage, quelqu’un va tomber.'
    remplirFormulaire(description)
    fireEvent.click(boutonEnvoyerAuSyndic())

    expect(await screen.findByRole('alert')).toHaveTextContent(t.demandes.erreurReseau)
    expect(screen.getByLabelText(t.demandes.decrivez)).toHaveValue(description)
    expect(screen.getByLabelText(t.demandes.zone)).toHaveValue('Escalier')
    expect(screen.getByRole('radio', { name: t.demandes.urgenceUrgent })).toBeChecked()
    expect(boutonEnvoyerAuSyndic()).toBeEnabled()
    expect(screen.queryByText(/Votre demande a bien été envoyée/)).toBeNull()

    // Trop d'envois : message dédié.
    simulerFetch(async () => json({ error: 'rate_limited' }, 429))
    fireEvent.click(boutonEnvoyerAuSyndic())
    expect(await screen.findByText(t.demandes.erreurTropDeDemandes)).toBeInTheDocument()
  })

  it('en démonstration : aucun appel réseau, demande ajoutée localement et visible dans la liste', async () => {
    render(<EcranDemandes {...props({ cible: 'nouvelle' })} />)
    remplirFormulaire()
    fireEvent.click(boutonEnvoyerAuSyndic())

    expect(await screen.findByText(/Votre demande a bien été envoyée à votre syndic le/)).toBeInTheDocument()
    expect(screen.getByText(/Numéro : [A-Z0-9-]{8}/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/Démonstration/)
    expect(appels).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: t.demandes.voirMaDemande }))
    expect(await screen.findByRole('heading', { name: TYPES_PROBLEME.fr[0] })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retour à mes demandes' }))
    expect(screen.getAllByRole('button', { name: t.commun.voirDetail })).toHaveLength(3)
    expect(screen.getAllByRole('list', { name: 'Avancement de la demande' })).toHaveLength(3)
  })

  it('« Faire une autre demande » remet le formulaire à zéro', async () => {
    render(<EcranDemandes {...props({ cible: 'nouvelle' })} />)
    remplirFormulaire()
    fireEvent.click(boutonEnvoyerAuSyndic())
    fireEvent.click(await screen.findByRole('button', { name: t.demandes.autreDemande }))
    expect(boutonEnvoyerAuSyndic()).toBeDisabled()
    expect(screen.getByLabelText(t.demandes.decrivez)).toHaveValue('')
    expect(screen.getByLabelText(t.demandes.typeProbleme)).toHaveValue('')
  })
})
