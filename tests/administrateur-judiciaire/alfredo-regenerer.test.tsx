import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEMO_COURRIELS_ALFREDO } from '@/components/administrateur-judiciaire/data/courriels-alfredo'
import { AlfredoCourriersModule } from '@/components/administrateur-judiciaire/modules/agents-ia/AlfredoCourriersModule'
import { ToastProvider } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'

/** Alfredo — Courriers : « Régénérer » demande un nouveau brouillon à l'agent IA (Claude) à partir du fil. */

async function monter() {
  await act(async () => {
    render(<ToastProvider><AlfredoCourriersModule /></ToastProvider>)
  })
}

const premierCourriel = DEMO_COURRIELS_ALFREDO[0]

describe('Alfredo — régénération du brouillon par l’IA', () => {
  beforeEach(async () => {
    localStorage.removeItem(CLE_STOCKAGE_MODE)
    await viderBaseLocale()
    await initialiserBaseDemo()
    useDonneesStore.setState({ loading: false })
    await useDonneesStore.getState().loadAll()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('remplace le brouillon par celui de l’IA, rédigé à partir du fil du courriel', async () => {
    const appel = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ text: 'Madame Dubois,\n\nNous revenons vers vous au sujet de la régularisation.\n\nLe cabinet', modele: 'claude-sonnet-5-5' }),
    )
    vi.stubGlobal('fetch', appel)
    await monter()
    expect(screen.getByText((_, el) => el?.className === 'alf-draft' && !!el.textContent?.includes(premierCourriel.draft.slice(0, 30)))).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Régénérer' }))
    })
    expect(await screen.findByText(/Nous revenons vers vous au sujet de la régularisation/)).toBeInTheDocument()
    expect(screen.getByText('Brouillon régénéré')).toBeInTheDocument()

    const corps = JSON.parse(String(appel.mock.calls[0][1]?.body))
    expect(corps.agent).toBe('alfredo')
    expect(corps.message).toContain(premierCourriel.subject)
    expect(corps.message).toContain(premierCourriel.thread[0].text.slice(0, 40))
    // L'adresse e-mail de l'expéditeur ne part pas vers l'IA.
    expect(corps.message).not.toContain(premierCourriel.email)
  })

  it('IA indisponible : le brouillon d’origine est conservé et un toast le signale', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'ia_indisponible' }, { status: 503 })))
    await monter()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Régénérer' }))
    })
    expect(await screen.findByText('Brouillon inchangé')).toBeInTheDocument()
    expect(screen.getByText((_, el) => el?.className === 'alf-draft' && !!el.textContent?.includes(premierCourriel.draft.slice(0, 30)))).toBeInTheDocument()
  })
})
