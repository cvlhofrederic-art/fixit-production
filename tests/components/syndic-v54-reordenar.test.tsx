import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModOsMeusModulos from '@/components/syndic-dashboard/v54/modules/ModOsMeusModulos'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import { SIDEBAR, applySidebarPrefs, isItem } from '@/components/syndic-dashboard/v54/shell/sidebar-config'

/** Reordenar módulos : helper applySidebarPrefs (pur) + éditeur authentifié → PUT prefs. */

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const idsOf = (secs: ReturnType<typeof applySidebarPrefs>) => secs.flatMap((s) => s.entries.filter(isItem).map((e) => e.id))
const authed = (over: Partial<SyndicData>): SyndicData => ({ authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], token: 'tok', ...over })

describe('applySidebarPrefs', () => {
  it('sans prefs → SIDEBAR inchangée (gated, même référence)', () => {
    expect(applySidebarPrefs(SIDEBAR, { itemOrder: [], itemsHidden: [] })).toBe(SIDEBAR)
    expect(applySidebarPrefs(SIDEBAR, undefined)).toBe(SIDEBAR)
  })
  it('masque les items cachés', () => {
    const ids = idsOf(applySidebarPrefs(SIDEBAR, { itemOrder: [], itemsHidden: ['ordens'] }))
    expect(ids).not.toContain('ordens')
    expect(ids).toContain('dashboard')
  })
  it('« modulos » et « logout » jamais masqués (anti-verrouillage)', () => {
    const ids = idsOf(applySidebarPrefs(SIDEBAR, { itemOrder: [], itemsHidden: ['modulos', 'logout'] }))
    expect(ids).toContain('modulos')
    expect(ids).toContain('logout')
  })
})

describe('ModOsMeusModulos — éditeur authentifié', () => {
  it('authentifié → éditeur réel (bouton Guardar) ; PUT les préférences', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ToastProvider><SyndicDataContext.Provider value={authed({ refresh: vi.fn() })}><ModOsMeusModulos /></SyndicDataContext.Provider></ToastProvider>)
    // masque un module puis guarde
    fireEvent.click(screen.getByLabelText('Mostrar Ordens de serviço'))
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/syndic/dashboard-prefs', expect.objectContaining({ method: 'PUT' })))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.itemsHidden).toContain('ordens')
    expect(Array.isArray(body.itemOrder)).toBe(true)
  })

  it('anonyme → catalogue mock (pas de bouton Guardar)', () => {
    render(<ToastProvider><ModOsMeusModulos /></ToastProvider>)
    expect(screen.queryByRole('button', { name: /Guardar/ })).toBeNull()
    expect(screen.getByText('Ordem do menu')).toBeInTheDocument()
  })
})
