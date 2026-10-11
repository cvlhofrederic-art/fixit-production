import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import AgentChatPage from '@/components/syndic-dashboard/v54/primitives/agent-chat-page/AgentChatPage'
import { askAgentDetaille, decrireActionFixy, executerActionFixy } from '@/lib/syndic/v54/api'

/**
 * Fixy (v54) : une action proposée par l'agent (##ACTION## extrait par la route) s'affiche sous sa réponse
 * avec « Confirmer » / « Ignorer » ; elle n'est exécutée (POST execute-action) qu'après confirmation.
 */

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const MISSION = { type: 'create_mission', immeuble: 'Résidence Atlantique', description: 'Fuite colonne EU', priorite: 'urgente', type_travaux: 'Plomberie' }

describe('lib/syndic/v54/api — actions de Fixy', () => {
  it('askAgentDetaille renvoie le texte et l’action proposée', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ response: 'Mission préparée.', action: MISSION }), { status: 200 }))
    expect(await askAgentDetaille('fixy', 'Crée une mission', 'tok', 'fr-FR')).toEqual({ texte: 'Mission préparée.', action: MISSION })
  })

  it('decrireActionFixy : libellé et détails en français ; action non exécutable (navigate) → null', () => {
    expect(decrireActionFixy(MISSION, 'fr-FR')).toEqual({
      libelle: 'Créer une mission',
      details: ['Immeuble : Résidence Atlantique', 'Description : Fuite colonne EU', 'Priorité : urgente', 'Type de travaux : Plomberie'],
    })
    expect(decrireActionFixy({ type: 'navigate', page: 'impayes' }, 'fr-FR')).toBeNull()
    expect(decrireActionFixy(MISSION, 'pt-PT')?.libelle).toBe('Criar uma ordem de serviço')
  })

  it('executerActionFixy envoie {action:{type,args}} avec le jeton ; erreur serveur → rejet', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, mission_id: 'm1' }), { status: 200 }))
    expect(await executerActionFixy(MISSION, 'tok', 'fr-FR')).toBe('✅ Action exécutée.')
    const [url, init] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/syndic/fixy-syndic/execute-action')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    const { type, ...args } = MISSION
    expect(JSON.parse(String(init.body))).toEqual({ action: { type, args } })

    spy.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'missing_mission_id' }), { status: 400 }))
    await expect(executerActionFixy({ type: 'update_mission' }, 'tok')).rejects.toThrow('missing_mission_id')
  })
})

describe('AgentChatPage — carte de confirmation d’une action', () => {
  async function poserAvecAction(executer: () => Promise<string>) {
    const onAsk = vi.fn().mockResolvedValue({ texte: 'Je prépare la mission.', action: { libelle: 'Créer une mission', details: ['Immeuble : Atlantique'], executer } })
    render(<AgentChatPage name="Fixy" intro="Olá" onAsk={onAsk} />)
    fireEvent.change(screen.getByLabelText('Pergunta a Fixy'), { target: { value: 'Crée une mission' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    await screen.findByRole('group', { name: 'Créer une mission' })
  }

  it('rien n’est exécuté avant « Confirmer » ; après, message de confirmation et carte retirée', async () => {
    const executer = vi.fn().mockResolvedValue('✅ Ação executada.')
    await poserAvecAction(executer)
    expect(screen.getByText('Immeuble : Atlantique')).toBeInTheDocument()
    expect(executer).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(screen.getByText('✅ Ação executada.')).toBeInTheDocument())
    expect(executer).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('group', { name: 'Créer une mission' })).toBeNull()
  })

  it('« Ignorer » retire la carte sans rien exécuter', async () => {
    const executer = vi.fn()
    await poserAvecAction(executer)
    fireEvent.click(screen.getByRole('button', { name: 'Ignorar' }))
    expect(screen.queryByRole('group', { name: 'Créer une mission' })).toBeNull()
    expect(executer).not.toHaveBeenCalled()
  })

  it('échec de l’exécution : la carte reste proposée (nouvel essai possible)', async () => {
    const executer = vi.fn().mockRejectedValue(new Error('boom'))
    await poserAvecAction(executer)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(executer).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar' })).not.toBeDisabled())
  })
})
