// tests/lib/og-polices.test.ts
//
// Polices de /api/og : origine constante du dépôt et liste fermée de fichiers, quelle que soit
// la requête reçue (Aikido : SSRF, l'origine venait de request.url).

import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCfEnvMock = vi.fn<() => Promise<Record<string, unknown>>>()
vi.mock('@/lib/env', () => ({ getCfEnv: () => getCfEnvMock() }))

import { POLICES_OG, urlPoliceOg, chargerPoliceOg } from '@/lib/seo/og-polices'

function reponse(ok: boolean, status: number, octets = 3): Response {
  return { ok, status, arrayBuffer: async () => new ArrayBuffer(octets) } as unknown as Response
}

describe('og-polices', () => {
  beforeEach(() => {
    getCfEnvMock.mockReset()
    getCfEnvMock.mockResolvedValue({})
  })

  it('liste fermée de deux fichiers WOFF', () => {
    expect(Object.keys(POLICES_OG).sort()).toEqual(['black', 'medium'])
    expect(POLICES_OG.black).toBe('Montserrat-900.woff')
    expect(POLICES_OG.medium).toBe('Montserrat-500.woff')
  })

  it("construit l'URL depuis l'origine constante du site, jamais depuis une requête", () => {
    expect(urlPoliceOg('black')).toBe('https://vitfix.io/fonts/Montserrat-900.woff')
    expect(urlPoliceOg('medium')).toBe('https://vitfix.io/fonts/Montserrat-500.woff')
  })

  it('appelle le fetcher avec cette URL et renvoie les octets', async () => {
    const fetcher = vi.fn(async () => reponse(true, 200, 7))
    const octets = await chargerPoliceOg('black', fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith('https://vitfix.io/fonts/Montserrat-900.woff')
    expect(octets.byteLength).toBe(7)
  })

  it('lève une erreur si la police est indisponible (la route retombe sur la police par défaut)', async () => {
    await expect(chargerPoliceOg('medium', async () => reponse(false, 404))).rejects.toThrow('font Montserrat-500.woff 404')
  })

  it('refuse une police hors liste sans rien appeler, même si la valeur ressemble à un chemin', async () => {
    const fetcher = vi.fn(async () => reponse(true, 200))
    await expect(chargerPoliceOg('../../etc/passwd' as never, fetcher)).rejects.toThrow('Police OG inconnue')
    await expect(chargerPoliceOg('constructor' as never, fetcher)).rejects.toThrow('Police OG inconnue')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('utilise le binding ASSETS de Cloudflare quand il existe, avec la même URL constante', async () => {
    const assetsFetch = vi.fn(async (_req: Request) => reponse(true, 200, 5))
    getCfEnvMock.mockResolvedValue({ ASSETS: { fetch: assetsFetch } })
    const octets = await chargerPoliceOg('black')
    expect(assetsFetch).toHaveBeenCalledTimes(1)
    const requete = assetsFetch.mock.calls[0][0]
    expect(requete).toBeInstanceOf(Request)
    expect(requete.url).toBe('https://vitfix.io/fonts/Montserrat-900.woff')
    expect(octets.byteLength).toBe(5)
  })

  it('sans binding (dev, tests), passe par le fetch global vers le site', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reponse(true, 200, 2))
    try {
      const octets = await chargerPoliceOg('medium')
      expect(fetchSpy).toHaveBeenCalledWith('https://vitfix.io/fonts/Montserrat-500.woff')
      expect(octets.byteLength).toBe(2)
    } finally {
      fetchSpy.mockRestore()
    }
  })
})
