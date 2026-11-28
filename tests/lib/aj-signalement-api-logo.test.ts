// tests/lib/aj-signalement-api-logo.test.ts
//
// Appels du navigateur pour le logo d'un cabinet (demande de Hugo du 13/11/2026 ; lib/aj-signalement/api.ts) :
//   - chargerLogoAfficheQr : l'image du logo pour une affiche PDF, lue par la route PUBLIQUE versionnée (aucun cookie
//     envoyé), revérifiée (PNG conforme, dimensions lues dans l'en-tête) ; échec → un code, jamais d'exception ;
//   - envoyerLogoCabinetQr / retirerLogoCabinetQr : PUT (PNG en base64) et DELETE …/cabinets/[id]/logo ;
//   - chargerMoiQr : cabinet.logo du gestionnaire connecté, gardé seulement s'il a la forme attendue.
// fetch injecté ; images synthétiques.

import { describe, expect, it, vi } from 'vitest'
import { chargerLogoAfficheQr, chargerMoiQr, envoyerLogoCabinetQr, retirerLogoCabinetQr } from '@/lib/aj-signalement/api'
import { pngSynthetique } from '../helpers/png-synthetique'

const VERSION = '0123456789abcdef'
const META = { version: VERSION, largeur: 320, hauteur: 120 }
const K1 = 'a0000000-0000-4000-8000-0000000000a1'
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })

describe('chargerLogoAfficheQr', () => {
  it('route publique versionnée, sans cookie ; PNG revérifié, dimensions de l’en-tête', async () => {
    const png = pngSynthetique(320, 120)
    const f = vi.fn(async () => new Response(png, { status: 200, headers: { 'content-type': 'image/png' } }))
    const r = await chargerLogoAfficheQr('cabinet-exemple', META, f as unknown as typeof fetch)
    expect(f).toHaveBeenCalledWith(`/api/aj-signalement/logo/cabinet-exemple/?v=${VERSION}`, { method: 'GET', credentials: 'omit' })
    expect(r).toEqual({ ok: true, logo: { png, largeur: 320, hauteur: 120 } })
  })

  it('404 (logo retiré entre-temps) : introuvable ; 429 : trop_de_demandes ; réseau coupé : reseau', async () => {
    expect(await chargerLogoAfficheQr('cabinet-exemple', META, (async () => json({ error: 'introuvable' }, 404)) as unknown as typeof fetch))
      .toEqual({ ok: false, code: 'introuvable' })
    expect(await chargerLogoAfficheQr('cabinet-exemple', META, (async () => json({ error: 'trop_de_demandes' }, 429)) as unknown as typeof fetch))
      .toEqual({ ok: false, code: 'trop_de_demandes' })
    const coupe = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    expect(await chargerLogoAfficheQr('cabinet-exemple', META, coupe as unknown as typeof fetch)).toEqual({ ok: false, code: 'reseau' })
  })

  it('réponse qui n’est pas un PNG conforme (page HTML, SVG) : serveur, jamais posée sur l’affiche', async () => {
    for (const corps of ['<!doctype html><html></html>', '<svg xmlns="http://www.w3.org/2000/svg"/>']) {
      const f = async () => new Response(corps, { status: 200, headers: { 'content-type': 'image/png' } })
      expect(await chargerLogoAfficheQr('cabinet-exemple', META, f as unknown as typeof fetch)).toEqual({ ok: false, code: 'serveur' })
    }
  })
})

describe('envoi et retrait', () => {
  it('PUT …/logo : le PNG en base64 ; métadonnées rendues', async () => {
    const png = pngSynthetique(40, 20)
    const f = vi.fn(async () => json({ logo: { version: VERSION, largeur: 40, hauteur: 20 }, modifie: true }))
    expect(await envoyerLogoCabinetQr(K1, png, f as unknown as typeof fetch)).toEqual({ ok: true, logo: { version: VERSION, largeur: 40, hauteur: 20 }, modifie: true })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`/api/aj-signalement/cabinets/${K1}/logo`)
    expect(init.method).toBe('PUT')
    expect(JSON.parse(String(init.body))).toEqual({ png: Buffer.from(png).toString('base64') })
  })

  it('DELETE …/logo ; 503 base_absente rendu tel quel', async () => {
    const f = vi.fn(async () => json({ logo: null, modifie: false }))
    expect(await retirerLogoCabinetQr(K1, f as unknown as typeof fetch)).toEqual({ ok: true, logo: null, modifie: false })
    expect((f.mock.calls[0] as unknown as [string, RequestInit])[1].method).toBe('DELETE')
    expect(await retirerLogoCabinetQr(K1, (async () => json({ error: 'base_absente' }, 503)) as unknown as typeof fetch)).toEqual({ ok: false, code: 'base_absente' })
  })
})

describe('chargerMoiQr : logo du cabinet du gestionnaire', () => {
  const moi = (cabinet: Record<string, unknown>) => (async () => json({ profil: 'gestionnaire', nom: 'Marie Exemple', cabinet })) as unknown as typeof fetch
  const base = { identifiant: 'cabinet-exemple', nom: 'Cabinet Exemple', domaines: ['exemple.test'] }

  it('logo présent et bien formé : gardé ; absent : aucune clé (forme d’avant)', async () => {
    expect(await chargerMoiQr(moi({ ...base, logo: META }))).toEqual({ ok: true, moi: { profil: 'gestionnaire', nom: 'Marie Exemple', cabinet: { ...base, logo: META } } })
    const sans = await chargerMoiQr(moi(base))
    expect(sans).toEqual({ ok: true, moi: { profil: 'gestionnaire', nom: 'Marie Exemple', cabinet: base } })
    expect(sans.ok && sans.moi.profil === 'gestionnaire' && 'logo' in sans.moi.cabinet).toBe(false)
  })

  it('logo mal formé : ignoré', async () => {
    for (const logo of [{ version: 'x', largeur: 1, hauteur: 1 }, { version: VERSION, largeur: 9000, hauteur: 1 }, 'logo.png', null]) {
      const r = await chargerMoiQr(moi({ ...base, logo }))
      expect(r).toEqual({ ok: true, moi: { profil: 'gestionnaire', nom: 'Marie Exemple', cabinet: base } })
    }
  })
})
