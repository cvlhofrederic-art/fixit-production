import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEMO_NOMS_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { FixyModule } from '@/components/administrateur-judiciaire/modules/agents-ia/FixyModule'
import { LeaComptableModule } from '@/components/administrateur-judiciaire/modules/agents-ia/LeaComptableModule'
import { MaxJuridiqueModule } from '@/components/administrateur-judiciaire/modules/agents-ia/MaxJuridiqueModule'
import { TempoEcheancesModule } from '@/components/administrateur-judiciaire/modules/agents-ia/TempoEcheancesModule'
import { ToastProvider } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Sélecteur de copropriété du haut de page (demande de Hugo du 29/10/2026) : la page de conversation des agents
 * (AgentChatPage, partagée par Fixy, Max, Léa et Tempo) suit la copropriété choisie ; son sélecteur « Copropriété »
 * en reprend le nom et, changé sur la page, change la copropriété choisie. Sans copropriété choisie (écran rendu
 * seul), la première copropriété de la liste, comme avant.
 */

const AGENTS: Array<[string, ComponentType, string]> = [
  ['Fixy', FixyModule, 'Question à Fixy — Assistant du mandat'],
  ['Max', MaxJuridiqueModule, 'Question à Max — Expert juridique'],
  ['Léa', LeaComptableModule, 'Question à Léa — Comptable'],
  ['Tempo', TempoEcheancesModule, 'Question à Tempo — Échéances'],
]

beforeEach(async () => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loading: false })
  await useDonneesStore.getState().loadAll()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

async function monter(Ecran: ComponentType): Promise<void> {
  await act(async () => {
    render(
      <ToastProvider>
        <Ecran />
      </ToastProvider>,
    )
  })
}

const selecteur = () => screen.getByRole('combobox', { name: 'Contexte' }) as HTMLSelectElement

describe.each(AGENTS)('%s — sélecteur « Copropriété » lié à la copropriété choisie', (_agent, Ecran) => {
  it('affiche la copropriété choisie et la suit sans remontage', async () => {
    useSelectionDossier.setState({ code: 'TL' })
    await monter(Ecran)
    expect(selecteur().value).toBe('Copropriété Les Tilleuls')
    await act(() => useSelectionDossier.getState().choisirCopro('VM'))
    expect(selecteur().value).toBe('Villa Montaigne')
  })

  it('un choix sur la page change la copropriété choisie pour toutes les pages', async () => {
    useSelectionDossier.setState({ code: 'TL' })
    await monter(Ecran)
    fireEvent.change(selecteur(), { target: { value: 'Le Clos des Vignes' } })
    expect(useSelectionDossier.getState().code).toBe('CV')
    expect(selecteur().value).toBe('Le Clos des Vignes')
  })

  it('sans copropriété choisie : copropriétés de la démonstration, la première par défaut, comme avant', async () => {
    await monter(Ecran)
    expect(Array.from(selecteur().options).map((option) => option.value)).toEqual([...DEMO_NOMS_COPROPRIETES])
    expect(selecteur().value).toBe('Résidence Le Méridien')
  })
})

// Mode démo, copropriété créée dans la base et choisie : son nom n'est pas parmi les noms de démonstration du
// sélecteur ; il y est ajouté, affiché et transmis à l'IA (au lieu de « Résidence Le Méridien »).
describe('Agents IA — copropriété créée dans la base', () => {
  it.each(AGENTS)('%s affiche et transmet le nom de la copropriété créée', async (_agent, Ecran, champ) => {
    let code = ''
    await act(async () => {
      const copro = await useDonneesStore.getState().createCopropriete({
        nom: 'Résidence Soleil',
        adresse: '1 rue du Soleil',
        nbLots: 10,
        rg: '26/01111',
        fondement: 'sj',
      })
      code = copro.code
    })
    const appel = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ text: 'ok' }))
    vi.stubGlobal('fetch', appel)
    useSelectionDossier.setState({ code })
    await monter(Ecran)
    expect(selecteur().value).toBe('Résidence Soleil')
    expect(selecteur().options[selecteur().selectedIndex]?.text).toBe('Résidence Soleil')
    const question = screen.getByRole('textbox', { name: champ }) as HTMLInputElement
    fireEvent.change(question, { target: { value: 'Où en est-on ?' } })
    fireEvent.submit(question.closest('form') as HTMLFormElement)
    expect(await screen.findByText('ok')).toBeInTheDocument()
    const corps = JSON.parse(String(appel.mock.calls[0][1]?.body))
    expect(corps.contexte.coproprieteSelectionnee).toBe('Résidence Soleil')
  })
})

describe('Agents IA — la copropriété choisie est transmise à l’agent', () => {
  it.each(AGENTS)('%s reçoit le nom de la copropriété choisie', async (_agent, Ecran, champ) => {
    const appel = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ text: 'ok' }))
    vi.stubGlobal('fetch', appel)
    useSelectionDossier.setState({ code: 'VM' })
    await monter(Ecran)
    const question = screen.getByRole('textbox', { name: champ }) as HTMLInputElement
    fireEvent.change(question, { target: { value: 'Où en est-on ?' } })
    fireEvent.submit(question.closest('form') as HTMLFormElement)
    expect(await screen.findByText('ok')).toBeInTheDocument()
    const corps = JSON.parse(String(appel.mock.calls[0][1]?.body))
    expect(corps.contexte.coproprieteSelectionnee).toBe('Villa Montaigne')
  })
})
