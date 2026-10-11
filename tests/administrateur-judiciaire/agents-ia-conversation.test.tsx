import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MaxJuridiqueModule } from '@/components/administrateur-judiciaire/modules/agents-ia/MaxJuridiqueModule'
import { TempoEcheancesModule } from '@/components/administrateur-judiciaire/modules/agents-ia/TempoEcheancesModule'
import { ToastProvider } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'

/** Conversations des agents IA de la succursale : annulation, données d'écran transmises, copropriété choisie. */

async function monter(module: 'max' | 'tempo') {
  await act(async () => {
    render(<ToastProvider>{module === 'max' ? <MaxJuridiqueModule /> : <TempoEcheancesModule />}</ToastProvider>)
  })
}

function envoyer(question: string) {
  const champ = screen.getAllByRole('textbox').find((el) => el.getAttribute('aria-label')?.startsWith('Question à')) as HTMLInputElement
  fireEvent.change(champ, { target: { value: question } })
  fireEvent.submit(champ.closest('form') as HTMLFormElement)
}

const corpsDe = (appel: unknown[]) => JSON.parse(String((appel[1] as RequestInit).body))

describe('Agents IA — conversation', () => {
  beforeEach(async () => {
    localStorage.removeItem(CLE_STOCKAGE_MODE)
    await viderBaseLocale()
    await initialiserBaseDemo()
    useDonneesStore.setState({ loading: false })
    await useDonneesStore.getState().loadAll()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('« Nouvelle conversation » pendant l’attente : la réponse tardive n’apparaît pas dans la nouvelle conversation', async () => {
    let repondre: (r: Response) => void = () => undefined
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((resolve, reject) => {
      repondre = resolve
      init?.signal?.addEventListener('abort', () => reject(new DOMException('annulé', 'AbortError')))
    })))
    await monter('max')
    envoyer('Quelle majorité pour désigner le syndic ?')
    expect(screen.getByText('Max rédige sa réponse…')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Nouvelle conversation/ }))
    await act(async () => {
      repondre(Response.json({ text: 'Réponse tardive de la première question' }))
    })
    expect(screen.queryByText('Réponse tardive de la première question')).toBeNull()
    expect(screen.queryByText('Réponse de démonstration')).toBeNull()
    expect(screen.queryByText('Max rédige sa réponse…')).toBeNull()
  })

  it('Tempo transmet l’état du Tableau : une automatisation mise en pause est connue de l’agent', async () => {
    const appel = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ text: 'ok' }))
    vi.stubGlobal('fetch', appel)
    await monter('tempo')
    fireEvent.click(screen.getByRole('button', { name: 'Tableau' }))
    const ligne = screen.getByText('Relance des impayés (plus de 30 jours)').closest('tr') as HTMLElement
    fireEvent.click(within(ligne).getByRole('button', { name: 'Mettre en pause' }))
    fireEvent.click(screen.getByRole('button', { name: 'Assistant' }))

    envoyer('Quelles automatisations sont actives ?')
    expect(await screen.findByText('ok')).toBeInTheDocument()
    const automatisations = corpsDe(appel.mock.calls[0]).contexte.ecransDemonstration.automatisations as Array<{ nom: string; statut: string }>
    expect(automatisations.find((a) => a.nom === 'Relance des impayés (plus de 30 jours)')?.statut).toBe('En pause')
    expect(corpsDe(appel.mock.calls[0]).agent).toBe('tempo')
  })

  it('la copropriété du sélecteur est transmise quand elle existe dans la base', async () => {
    const appel = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ text: 'ok' }))
    vi.stubGlobal('fetch', appel)
    await monter('max')
    envoyer('Durée de la mission ?')
    expect(await screen.findByText('ok')).toBeInTheDocument()
    const contexte = corpsDe(appel.mock.calls[0]).contexte as { coproprieteSelectionnee: string; coprietes?: unknown; coproprietes: Array<{ nom: string }> }
    expect(contexte.coproprietes.map((c) => c.nom)).toContain(contexte.coproprieteSelectionnee)
  })
})
