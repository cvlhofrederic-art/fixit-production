import { describe, it, expect, vi, beforeEach } from 'vitest'

// On teste les fonctions exécutrices isolées via import direct.
// execSearchDossier et execFindEmailThread sont exportées depuis route.ts.

describe('Fixy new tools — module importable', () => {
  it('module fixy-syndic existe et est importable', async () => {
    const mod = await import('@/app/api/syndic/fixy-syndic/route')
    expect(typeof mod.POST).toBe('function')
  })

  it('execSearchDossier est exportée', async () => {
    const mod = await import('@/app/api/syndic/fixy-syndic/route')
    expect(typeof (mod as Record<string, unknown>).execSearchDossier).toBe('function')
  })

  it('execFindEmailThread est exportée', async () => {
    const mod = await import('@/app/api/syndic/fixy-syndic/route')
    expect(typeof (mod as Record<string, unknown>).execFindEmailThread).toBe('function')
  })
})

describe('Fixy new tools — search_dossier', () => {
  it('retourne structure vide si query vide', async () => {
    const { execSearchDossier } = await import('@/app/api/syndic/fixy-syndic/route') as {
      execSearchDossier: (client: unknown, syndicId: string, query: string) => Promise<unknown>
    }

    const fakeClient = {
      from: () => ({
        select: () => ({ or: () => ({ limit: () => ({ data: [] }) }), ilike: () => ({ limit: () => ({ data: [] }) }) }),
      }),
    }

    const result = await execSearchDossier(fakeClient, 'syn-1', '')
    expect(result).toEqual({ coproprios: [], missions: [], signalements: [] })
  })

  it.todo('search_dossier retourne union {coproprios, missions, signalements}')
  it.todo('search_dossier limite à 10 résultats par table')
  it.todo('search_dossier filtre par cabinet_id pour coproprios et missions')
})

describe('Fixy new tools — find_email_thread', () => {
  it('retourne structure vide si pas de résultats', async () => {
    const { execFindEmailThread } = await import('@/app/api/syndic/fixy-syndic/route') as {
      execFindEmailThread: (client: unknown, syndicId: string, criteria: unknown) => Promise<unknown>
    }

    const fakeClient = {
      from: () => ({
        select: () => ({
          eq: function (this: unknown) { return this },
          order: function (this: unknown) { return this },
          limit: () => ({ data: [] }),
          ilike: function (this: unknown) { return this },
        }),
      }),
    }

    const result = await execFindEmailThread(fakeClient, 'syn-1', {})
    expect(result).toEqual({ emails: [] })
  })

  it.todo('find_email_thread filtre par from_email si fourni')
  it.todo('find_email_thread filtre par subject ilike si fourni')
  it.todo('find_email_thread ordonne par received_at décroissant')
})
