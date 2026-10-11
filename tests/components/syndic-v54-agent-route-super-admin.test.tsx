import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

/**
 * Scénario de la démo : Frédéric, connecté en super_admin, ouvre Fixy sur la
 * version FR du dashboard v54. La session est `authed` (jeton transmis), l'agent
 * est branché (pas de bandeau « démonstration »), la deuxième question emporte
 * l'historique (AgentRoute → askAgent) et la réponse s'affiche en Markdown.
 */

const h = vi.hoisted(() => ({
  session: { access_token: 'jeton-super-admin', user: { id: 'id-super-admin', app_metadata: { role: 'super_admin' } } },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: h.session } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

import SyndicDashboardV54 from '@/components/syndic-dashboard/v54/SyndicDashboardV54'
import { V54LocaleProvider } from '@/lib/syndic/v54/i18n'
import { SIDEBAR_FR } from '@/components/syndic-dashboard/v54/shell/sidebar-config.fr'
import { isItem } from '@/components/syndic-dashboard/v54/shell/sidebar-config'

const REPONSE = '**Trois** interventions urgentes :\n- ascenseur\n- toiture'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

/** Listes /api/syndic/* vides ; Fixy répond en Markdown. */
function brancherFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (entree) =>
    String(entree) === '/api/syndic/fixy-syndic'
      ? new Response(JSON.stringify({ response: REPONSE }), { status: 200 })
      : new Response(JSON.stringify({}), { status: 200 }),
  )
}

function ouvrirAgent(id: string) {
  const ids = SIDEBAR_FR.flatMap((s) => s.entries.filter(isItem).map((e) => e.id))
  const aside = document.querySelector('aside')
  if (!aside) throw new Error('sidebar absente')
  const items = [...aside.querySelectorAll<HTMLElement>('button:not([aria-expanded]):not([aria-label])')]
  fireEvent.click(items[ids.indexOf(id)])
}
const ouvrirFixy = () => ouvrirAgent('fixy')

async function poser(question: string, agent = 'Fixy') {
  fireEvent.change(screen.getByLabelText(`Question pour ${agent}`), { target: { value: question } })
  fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
  await waitFor(() => expect(screen.queryByText('Rédaction en cours…')).toBeNull())
}

describe('Dashboard v54 FR — super_admin : Fixy branché avec mémoire', () => {
  it('jeton du super_admin, historique transmis à la 2e question, réponse en Markdown', async () => {
    const fetchSpy = brancherFetch()
    render(<V54LocaleProvider locale="fr-FR"><SyndicDashboardV54 /></V54LocaleProvider>)
    // Données réelles chargées avec le jeton du super_admin (plus de données fictives).
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/missions', { headers: { Authorization: 'Bearer jeton-super-admin' } }),
    )
    ouvrirFixy()
    await screen.findByLabelText('Question pour Fixy')
    expect(screen.queryByText(/Démonstration du design system v54/)).toBeNull()

    await poser('Quelles urgences cette semaine ?')
    await poser('Et pour l’ascenseur ?')

    const appelsFixy = fetchSpy.mock.calls.filter(([url]) => String(url) === '/api/syndic/fixy-syndic')
    expect(appelsFixy).toHaveLength(2)
    const init = appelsFixy[1][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jeton-super-admin')
    expect(JSON.parse(String(init.body))).toEqual({
      message: 'Et pour l’ascenseur ?',
      locale: 'fr',
      conversation_history: [
        { role: 'user', content: 'Quelles urgences cette semaine ?' },
        { role: 'assistant', content: REPONSE },
      ],
    })
    // Première question : pas d'historique, corps inchangé.
    expect(JSON.parse(String((appelsFixy[0][1] as RequestInit).body))).toEqual({ message: 'Quelles urgences cette semaine ?', locale: 'fr' })

    const gras = screen.getAllByText('Trois')
    expect(gras.every((el) => el.tagName === 'STRONG')).toBe(true)
    expect(document.querySelector('[aria-live="polite"]')?.textContent).not.toContain('**')
  })

  it('un fil par agent : passer de Fixy à Max ne transmet pas la conversation de Fixy', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (entree) =>
      /\/api\/syndic\/(fixy-syndic|max-ai)$/.test(String(entree))
        ? new Response(JSON.stringify({ response: REPONSE }), { status: 200 })
        : new Response(JSON.stringify({}), { status: 200 }),
    )
    render(<V54LocaleProvider locale="fr-FR"><SyndicDashboardV54 /></V54LocaleProvider>)
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/missions', expect.anything()))
    ouvrirFixy()
    await screen.findByLabelText('Question pour Fixy')
    await poser('Question à Fixy')

    ouvrirAgent('max')
    const champMax = await screen.findByLabelText(/^Question pour Max/)
    expect(screen.queryByText('Question à Fixy')).toBeNull()
    fireEvent.change(champMax, { target: { value: 'Question à Max' } })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
    await waitFor(() => expect(fetchSpy.mock.calls.some(([url]) => String(url) === '/api/syndic/max-ai')).toBe(true))
    const appelMax = fetchSpy.mock.calls.find(([url]) => String(url) === '/api/syndic/max-ai') as [unknown, RequestInit]
    expect(JSON.parse(String(appelMax[1].body))).toEqual({ message: 'Question à Max', locale: 'fr' })
  })
})
