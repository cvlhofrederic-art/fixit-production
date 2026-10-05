import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEMO_NOMS_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { FixyModule } from '@/components/administrateur-judiciaire/modules/agents-ia/FixyModule'
import { TempoEcheancesModule } from '@/components/administrateur-judiciaire/modules/agents-ia/TempoEcheancesModule'
import { statutEcran } from '@/components/administrateur-judiciaire/modules/registry'
import { ToastProvider } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'

/**
 * Écran Fixy à deux onglets, comme Tempo (demande de Frédéric) :
 * - « Assistant », ouvert par défaut : la page d'accueil de Fixy, agent secrétaire, reprise de la maquette
 *   VitFix_Syndic_Judiciaire_13_M1 (ModFixy : AgentChatPage, domaine « ops ») ;
 * - « Tableau » : la page Fixy d'avant (veille, demande, courriel, ordonnance, notes, sur les données réelles).
 */

const etat = () => useDonneesStore.getState()

/** Base vidée, mode démo, jeu de démonstration inséré, store rechargé. */
async function reinitialiser(): Promise<void> {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loading: false })
  await etat().loadAll()
}

async function monter(ecran: 'fixy' | 'tempo') {
  let rendu: ReturnType<typeof render> | undefined
  await act(async () => {
    rendu = render(<ToastProvider>{ecran === 'fixy' ? <FixyModule /> : <TempoEcheancesModule />}</ToastProvider>)
  })
  return rendu as ReturnType<typeof render>
}

const puce = (nom: 'Assistant' | 'Tableau') => screen.getByRole('button', { name: nom })

/** Barre des puces : le conteneur du bouton « Assistant ». */
const barreDesPuces = (rendu: ReturnType<typeof render>) =>
  within(rendu.container).getByRole('button', { name: 'Assistant' }).parentElement as HTMLElement

describe('Fixy — onglet « Assistant » par défaut (page d\'accueil de la maquette 13_M1)', () => {
  beforeEach(reinitialiser)

  it('ouvre la page de conversation de Fixy, comme dans la maquette', async () => {
    await monter('fixy')
    expect(puce('Assistant')).toHaveClass('chip', 'active')
    expect(puce('Tableau')).not.toHaveClass('active')

    expect(screen.getByRole('heading', { level: 2, name: /^Fixy — Assistant du mandat/ })).toBeInTheDocument()
    expect(screen.getByText('Coordination des interventions et de la gestion courante du syndicat')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Bonjour, je suis Fixy.' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Je vous aide à piloter les interventions, les prestataires et le suivi opérationnel de vos copropriétés sous mandat.',
      ),
    ).toBeInTheDocument()

    // Historique : « HIER » puis « CETTE SEMAINE », trois conversations.
    const historique = screen.getByRole('complementary', { name: 'Historique des conversations' })
    expect(within(historique).getByText('HIER')).toBeInTheDocument()
    expect(within(historique).getByText('CETTE SEMAINE')).toBeInTheDocument()
    expect(
      within(historique)
        .getAllByRole('button')
        .map((bouton) => bouton.textContent)
        .filter((texte) => !/Nouvelle conversation/.test(texte || '') && texte !== ''),
    ).toEqual(['Ordre de mission — fuite 4e étage', 'Devis étanchéité Les Tilleuls', 'Prestataires plomberie référencés'])

    // Sélecteur de copropriété (première copropriété choisie) et bouton Documents.
    const selecteur = screen.getByRole('combobox', { name: 'Contexte' }) as HTMLSelectElement
    expect(Array.from(selecteur.options).map((option) => option.value)).toEqual([...DEMO_NOMS_COPROPRIETES])
    expect(selecteur.value).toBe('Résidence Le Méridien')
    expect(screen.getByRole('button', { name: 'Documents' })).toBeInTheDocument()

    // Quatre suggestions, dans l'ordre de la maquette.
    expect(
      Array.from(document.querySelectorAll('.agent-suggestion')).map((suggestion) => suggestion.textContent),
    ).toEqual([
      'Quelles interventions sont en attente de validation ?',
      'Génère un ordre de service pour la fuite du 4e',
      'Quels prestataires sont référencés pour la plomberie ?',
      'Fais le point opérationnel du Clos des Vignes',
    ])

    // Rien de l'ancien écran sur cet onglet.
    expect(screen.queryByText(/^Veille · /)).toBeNull()
    expect(screen.queryByText('Courriel reçu')).toBeNull()
  })

  it('une suggestion remplit le champ ; l\'envoi affiche la réponse opérationnelle de Fixy', async () => {
    await monter('fixy')
    const champ = screen.getByRole('textbox', { name: 'Question à Fixy — Assistant du mandat' }) as HTMLInputElement
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Quelles interventions sont en attente de validation ?' }))
    expect(champ.value).toBe('Quelles interventions sont en attente de validation ?')
    expect(document.activeElement).toBe(champ)
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
    expect(screen.getByText(/^3 interventions en attente de validation : étanchéité toiture des Tilleuls/)).toBeInTheDocument()
    expect(champ.value).toBe('')

    fireEvent.change(champ, { target: { value: 'Fais le point opérationnel du Clos des Vignes' } })
    fireEvent.submit(champ.closest('form') as HTMLFormElement)
    expect(screen.getByText(/^Point opérationnel du Clos des Vignes : 48 lots/)).toBeInTheDocument()
  })
})

describe('Fixy — onglet « Tableau » : la page Fixy d\'avant', () => {
  beforeEach(reinitialiser)

  it('affiche la veille, la demande, le courriel, l\'ordonnance et les notes, puis revient à l\'assistant', async () => {
    await monter('fixy')
    fireEvent.click(puce('Tableau'))
    expect(puce('Tableau')).toHaveClass('chip', 'active')
    expect(puce('Assistant')).not.toHaveClass('active')

    expect(screen.getByText('Agents IA · pilotage')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/^Veille · \d+ rappels?$/)).toBeInTheDocument())
    expect(screen.getByText('Demande')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Demande à Fixy' })).toBeInTheDocument()
    expect(screen.getByText('Courriel reçu')).toBeInTheDocument()
    expect(screen.getByText('Nouveau mandat depuis une ordonnance')).toBeInTheDocument()
    expect(screen.getByText(/^Notes au gestionnaire \(\d+\)$/)).toBeInTheDocument()
    expect(screen.queryByText('Bonjour, je suis Fixy.')).toBeNull()

    fireEvent.click(puce('Assistant'))
    expect(screen.getByText('Bonjour, je suis Fixy.')).toBeInTheDocument()
    expect(screen.getByText(/^Veille · /)).not.toBeVisible()
    expect(screen.getByText('Courriel reçu')).not.toBeVisible()
  })

  it('la demande libre du Tableau répond toujours avec le moteur réel (échéances calculées)', async () => {
    await monter('fixy')
    fireEvent.click(puce('Tableau'))
    await waitFor(() => expect(screen.getByText(/^Veille · \d+ rappels?$/)).toBeInTheDocument())
    fireEvent.change(screen.getByRole('textbox', { name: 'Demande à Fixy' }), {
      target: { value: 'échéances de Villa Montaigne' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Demander' }))
    // Réponse du moteur de délais légaux (date figée de la démo), pas une réponse simulée de l'assistant.
    expect(screen.getByText('Échéances légales au 04/06/2026')).toBeInTheDocument()
    expect(screen.getByText('« échéances de Villa Montaigne » · moteur de délais légaux')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').some((ligne) => /^Villa Montaigne · /.test(ligne.textContent || ''))).toBe(true)
  })

  it('le travail en cours du Tableau survit à un passage par l\'onglet Assistant (comme le tableau de Tempo)', async () => {
    await monter('fixy')
    fireEvent.click(puce('Tableau'))
    await waitFor(() => expect(screen.getByText(/^Veille · \d+ rappels?$/)).toBeInTheDocument())
    fireEvent.change(screen.getByRole('textbox', { name: 'Demande à Fixy' }), {
      target: { value: 'échéances de Villa Montaigne' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Demander' }))
    const courriel = screen.getByRole('textbox', { name: 'Courriel reçu' }) as HTMLTextAreaElement
    fireEvent.change(courriel, { target: { value: 'Bonjour, une question sur mes charges.' } })

    fireEvent.click(puce('Assistant'))
    expect(screen.getByText('Échéances légales au 04/06/2026')).not.toBeVisible()
    fireEvent.click(puce('Tableau'))

    expect(screen.getByText('Échéances légales au 04/06/2026')).toBeVisible()
    expect((screen.getByRole('textbox', { name: 'Courriel reçu' }) as HTMLTextAreaElement).value).toBe(
      'Bonjour, une question sur mes charges.',
    )
  })
})

describe('Fixy et Tempo — mêmes puces « Assistant » / « Tableau »', () => {
  beforeEach(reinitialiser)

  it('les puces reprennent le balisage de l\'écran Tempo de la maquette', async () => {
    const rendu = await monter('fixy')
    const barre = barreDesPuces(rendu)
    // <div style={{display:'flex',gap:8,marginBottom:18}}> puis deux <button className="chip …"> avec leur icône.
    expect(barre.tagName).toBe('DIV')
    expect(barre.getAttribute('style')).toBe('display: flex; gap: 8px; margin-bottom: 18px;')
    const boutons = Array.from(barre.children) as HTMLElement[]
    expect(boutons.map((bouton) => [bouton.tagName, bouton.className, bouton.textContent])).toEqual([
      ['BUTTON', 'chip active', 'Assistant'],
      ['BUTTON', 'chip ', 'Tableau'],
    ])
    for (const bouton of boutons) {
      const icone = bouton.querySelector('svg') as SVGElement
      expect(icone.getAttribute('style')).toBe('width: 13px; height: 13px; vertical-align: -2px; margin-right: 5px;')
    }
  })

  it('Tempo garde ses deux onglets, avec un balisage identique à celui de Fixy', async () => {
    const tempo = await monter('tempo')
    expect(puce('Assistant')).toHaveClass('chip', 'active')
    expect(screen.getByText('Bonjour, je suis Tempo.')).toBeInTheDocument()
    const balisageTempo = barreDesPuces(tempo).outerHTML
    fireEvent.click(puce('Tableau'))
    expect(screen.getByText('Tableau des automatisations')).toBeInTheDocument()
    tempo.unmount()

    const fixy = await monter('fixy')
    expect(barreDesPuces(fixy).outerHTML).toBe(balisageTempo)
  })
})

describe('Fixy — statut de l\'écran', () => {
  it('reste « Données réelles » : son onglet Tableau lit et écrit la base locale', () => {
    expect(statutEcran('fixy')).toBe('reel')
  })
})
