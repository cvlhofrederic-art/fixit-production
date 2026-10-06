/**
 * Sous-sitemap 4 (fiches artisans, app/sitemap/[id]/route.ts) : une panne Supabase donne un sitemap vide, jamais une
 * erreur 500, mais elle doit rester visible dans les logs. Le client Supabase (postgrest-js) ne lève pas d'exception :
 * il renvoie { data: null, error }, que le catch ne voit jamais.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const reponse = vi.hoisted(() => ({ valeur: { data: null as unknown, error: null as unknown } }))
vi.mock('@/lib/supabase-server-component', () => ({
  createServerSupabaseClient: async () => ({
    from: () => ({ select: () => ({ eq: async () => reponse.valeur }) }),
  }),
}))
const avertir = vi.hoisted(() => vi.fn())
vi.mock('@/lib/logger', () => ({ logger: { warn: avertir, error: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

import { GET } from '@/app/sitemap/[id]/route'

const sitemap4 = () => GET(new Request('https://vitfix.io/sitemap/4.xml'), { params: Promise.resolve({ id: '4.xml' }) })

describe('sitemap des fiches artisans', () => {
  beforeEach(() => {
    avertir.mockClear()
  })

  it('erreur Supabase : sitemap vide et avertissement journalisé', async () => {
    reponse.valeur = { data: null, error: { message: 'JWT expired', code: 'PGRST301' } }
    const res = await sitemap4()
    expect(res.status).toBe(200)
    expect(await res.text()).not.toContain('<url>')
    expect(avertir).toHaveBeenCalledWith('[sitemap] fiches artisans indisponibles', expect.objectContaining({ message: 'JWT expired' }))
  })

  it('lecture réussie : fiches listées, aucun avertissement', async () => {
    reponse.valeur = { data: [{ id: 'a-1', slug: 'plomberie-durand', updated_at: null, org_role: 'artisan', country: 'FR' }], error: null }
    const res = await sitemap4()
    expect(await res.text()).toContain('plomberie-durand')
    expect(avertir).not.toHaveBeenCalled()
  })
})
