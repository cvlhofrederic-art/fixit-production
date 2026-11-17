// tests/api/aj-signalement-logo-cabinet.test.ts
//
// Logo d'un cabinet client (demande de Hugo du 13/11/2026 : « pouvoir ajouter le logo au cabinet et aux PDF ») :
//   PUT    /api/aj-signalement/cabinets/[id]/logo — envoi (super admin seul) : PNG en base64, revérifié par la route
//          (signature, morceaux, en-tête, poids) avant la fonction signalements_qr_regler_logo_cabinet (journal
//          cabinet.modifie {logo}, simulée ici) ; p_acteur = la session, jamais le corps ;
//   DELETE /api/aj-signalement/cabinets/[id]/logo — retrait (super admin seul) ;
//   GET    /api/aj-signalement/logo/[identifiant] — lecture PUBLIQUE de l'image (pages publiques et espace du cabinet,
//          affiches) : image/png, cache public immuable quand la version demandée est la version en place, nosniff, CSP
//          restrictive, ressource réservée au site ; aucune donnée personnelle dans l'adresse ;
//   GET    /api/aj-signalement/cabinets et /api/aj-signalement/moi : métadonnées du logo (version, dimensions), jamais
//          l'image.
// Migration 20261114 absente : aucun logo, réponses identiques à avant ; envoi et retrait 503 base_absente.
// Images synthétiques ; cabinets « cabinet-exemple », domaines en exemple.test.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'
import { deflateSync } from 'zlib'
import { NextRequest } from 'next/server'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr } = await import('../helpers/aj-signalement-base')
const { ADMIN_QR, contexteQr, reinitialiserSimulQr, requeteQr, simulQr, texteJournalServeurQr } = await import('../helpers/aj-signalement-routes')
const A = await import('../helpers/aj-signalement-acces')
const { base64Png, hexBytea, pngSynthetique } = await import('../helpers/png-synthetique')
const { PUT, DELETE } = await import('@/app/api/aj-signalement/cabinets/[id]/logo/route')
const { GET: LIRE_LOGO } = await import('@/app/api/aj-signalement/logo/[identifiant]/route')
const { GET: CABINETS } = await import('@/app/api/aj-signalement/cabinets/route')
const { GET: MOI } = await import('@/app/api/aj-signalement/moi/route')
const { MIGRATION_LOGO_QR, reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')

const { CAB, CAB_AUTRE } = A
const COLONNES_LOGO = ['logo_png', 'logo_largeur', 'logo_hauteur', 'logo_version', 'logo_maj_le']
const empreinte16 = (octets: Uint8Array) => createHash('sha256').update(octets).digest('hex').slice(0, 16)
const PNG = pngSynthetique(320, 120, { couleur: [29, 65, 100, 255] })
const VERSION = empreinte16(PNG)

/** Pose un logo sur un cabinet de la base simulée (comme la fonction SQL l'aurait écrit). */
function poserLogo(cabinetId: string, png: Uint8Array, largeur: number, hauteur: number): void {
  const ligne = baseQr.table('signalements_qr_cabinets').find((c) => c.id === cabinetId)
  if (!ligne) throw new Error('cabinet absent')
  Object.assign(ligne, {
    logo_png: hexBytea(png), logo_largeur: largeur, logo_hauteur: hauteur, logo_version: empreinte16(png), logo_maj_le: '2026-11-13T10:00:00+00:00',
  })
}

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  A.poserJeuAccesQr()
  // Fonction SQL d'envoi et de retrait, réduite à ses règles visibles depuis la route (exécutée pour de vrai : PGlite).
  baseQr.etat.fonctions.signalements_qr_regler_logo_cabinet = (a) => {
    const ligne = baseQr.table('signalements_qr_cabinets').find((c) => c.id === a.p_cabinet)
    if (!ligne) return { error: { code: 'P0001', message: 'a_reverifier' } }
    if (a.p_png === null) {
      const modifie = ligne.logo_version != null
      Object.assign(ligne, { logo_png: null, logo_largeur: null, logo_hauteur: null, logo_version: null, logo_maj_le: null })
      if (modifie) baseQr.table('signalements_qr_journal').push({ cabinet_id: a.p_cabinet, action: 'cabinet.modifie', champs: ['logo'], details: { logo: 'retire' } })
      return { data: { version: null, modifie } }
    }
    const octets = Uint8Array.from(Buffer.from(String(a.p_png).slice(2), 'hex'))
    const version = empreinte16(octets)
    const modifie = ligne.logo_version !== version
    Object.assign(ligne, { logo_png: a.p_png, logo_largeur: a.p_largeur, logo_hauteur: a.p_hauteur, logo_version: version, logo_maj_le: '2026-11-13T11:00:00+00:00' })
    if (modifie) baseQr.table('signalements_qr_journal').push({ cabinet_id: a.p_cabinet, action: 'cabinet.modifie', champs: ['logo'], details: { logo: 'envoye' } })
    return { data: { version, modifie } }
  }
})

const envoyer = (id: string, corps: unknown) => PUT(requeteQr(`/api/aj-signalement/cabinets/${id}/logo`, 'PUT', corps), contexteQr(id))
const retirer = (id: string) => DELETE(requeteQr(`/api/aj-signalement/cabinets/${id}/logo`, 'DELETE'), contexteQr(id))
const lireLogo = (identifiant: string, requete = '', entetes: Record<string, string> = {}) =>
  LIRE_LOGO(new NextRequest(
    `https://vitfix.io/api/aj-signalement/logo/${identifiant}${requete}`, { headers: entetes }), { params: Promise.resolve({ identifiant }) })
const appelsLogo = () => baseQr.etat.appelsRpc.filter((a) => a.nom === 'signalements_qr_regler_logo_cabinet')

describe('PUT …/cabinets/[id]/logo : droits', () => {
  it('401 sans session ; 403 super admin hors de la liste, « vue en tant que », gestionnaire ; aucune fonction appelée', async () => {
    simulQr.user = null
    expect((await envoyer(CAB, { png: base64Png(PNG) })).status).toBe(401)
    expect((await retirer(CAB)).status).toBe(401)
    simulQr.user = { ...ADMIN_QR, email: 'autre@exemple.test' }
    expect((await envoyer(CAB, { png: base64Png(PNG) })).status).toBe(403)
    simulQr.user = { ...ADMIN_QR, app_metadata: { role: 'coproprio', _original_role: 'super_admin' } }
    expect((await envoyer(CAB, { png: base64Png(PNG) })).status).toBe(403)
    A.connecterQr(A.COMPTE_G1)
    expect((await envoyer(CAB, { png: base64Png(PNG) })).status).toBe(403)
    expect((await retirer(CAB)).status).toBe(403)
    expect(appelsLogo()).toEqual([])
  })

  it('limite de débit : par adresse IP puis par compte ; refus → 429 sans appel', async () => {
    await envoyer(CAB, { png: base64Png(PNG) })
    expect(simulQr.limites).toEqual(['qr_cabinet_logo_203.0.113.7', `qr_cabinet_logo_${ADMIN_QR.id}`])
    simulQr.refuser = ['qr_cabinet_logo_']
    baseQr.etat.appelsRpc = []
    expect((await envoyer(CAB, { png: base64Png(PNG) })).status).toBe(429)
    expect((await retirer(CAB)).status).toBe(429)
    expect(appelsLogo()).toEqual([])
  })
})

describe('PUT …/cabinets/[id]/logo : envoi', () => {
  it('PNG valide : fonction appelée avec l’image (bytea), ses dimensions lues dans l’en-tête et l’acteur de la session', async () => {
    const res = await envoyer(CAB, { png: base64Png(PNG) })
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await res.json()).toEqual({ logo: { version: VERSION, largeur: 320, hauteur: 120 }, modifie: true })
    expect(appelsLogo()).toEqual([{
      nom: 'signalements_qr_regler_logo_cabinet',
      args: { p_cabinet: CAB, p_png: hexBytea(PNG), p_largeur: 320, p_hauteur: 120, p_acteur: ADMIN_QR.id },
    }])
  })

  it('même image renvoyée : modifie false (rien de journalisé par la base)', async () => {
    await envoyer(CAB, { png: base64Png(PNG) })
    const res = await envoyer(CAB, { png: base64Png(PNG) })
    expect(await res.json()).toEqual({ logo: { version: VERSION, largeur: 320, hauteur: 120 }, modifie: false })
    expect(baseQr.table('signalements_qr_journal')).toHaveLength(1)
  })

  it.each([
    ['corps absent', undefined],
    ['corps non JSON', 'pas du json'],
    ['champ png absent', {}],
    ['clé inconnue', { png: base64Png(PNG), nom: 'x' }],
    ['pas du base64', { png: 'ceci n’est pas du base64 !' }],
    ['SVG (jamais stocké)', { png: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>').toString('base64') }],
    ['JPEG', { png: Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(80).fill(0)]).toString('base64') }],
    ['PNG avec texte (métadonnées)', { png: base64Png(pngSynthetique(10, 10, { morceaux: [{ type: 'tEXt', donnees: new TextEncoder().encode('Author\0X') }] })) }],
    ['PNG suivi d’un script', { png: base64Png(pngSynthetique(10, 10, { queue: new TextEncoder().encode('<script>') })) }],
    ['plus de 800 px', { png: base64Png(pngSynthetique(801, 10)) }],
    ['plus de 200 Kio', { png: base64Png(pngSynthetique(240, 240, { bruit: true })) }],
    // Relecture de sécurité du 13/11/2026 : appel direct de la route, sans le canvas, avec un PNG de forme juste mais au
    // contenu choisi ; tous trois étaient acceptés, stockés puis servis par la route publique.
    ['texte libre dans iCCP', { png: base64Png(pngSynthetique(64, 32, { morceaux: [{ type: 'iCCP', donnees: Buffer.concat([Buffer.from('%PDF-1.7 profil\0\0', 'latin1'), deflateSync(Buffer.from('jean.exemple@exemple.test'))]) }] })) }],
    ['octets après le flux zlib, dans l’IDAT', { png: base64Png(pngSynthetique(64, 32, { idat: Buffer.concat([deflateSync(Buffer.alloc(32 * 257)), Buffer.from('PK\u0003\u0004<html><script>', 'latin1')]) })) }],
    ['bombe de décompression (≈ 145 Kio → 150 Mo)', { png: base64Png(pngSynthetique(800, 400, { idat: deflateSync(Buffer.alloc(150_000_000), { level: 9 }) })) }],
  ])('%s → 400 invalide, aucune fonction appelée', async (_cas, corps) => {
    const requete = typeof corps === 'string'
      ? new NextRequest(`https://vitfix.io/api/aj-signalement/cabinets/${CAB}/logo`, { method: 'PUT', body: corps })
      : requeteQr(`/api/aj-signalement/cabinets/${CAB}/logo`, 'PUT', corps)
    const res = await PUT(requete, contexteQr(CAB))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalide')
    expect(appelsLogo()).toEqual([])
  })

  it('corps annoncé trop lourd (Content-Length) : 400 avant toute lecture', async () => {
    const requete = new NextRequest(`https://vitfix.io/api/aj-signalement/cabinets/${CAB}/logo`, {
      method: 'PUT', headers: { 'content-type': 'application/json', 'content-length': String(400_000) }, body: JSON.stringify({ png: base64Png(PNG) }),
    })
    const res = await PUT(requete, contexteQr(CAB))
    expect(res.status).toBe(400)
    expect(appelsLogo()).toEqual([])
  })

  it('cabinet inconnu ou identifiant qui n’est pas un UUID : 404, aucune fonction appelée', async () => {
    expect((await envoyer('ca000000-0000-4000-8000-0000000000ff', { png: base64Png(PNG) })).status).toBe(404)
    expect((await envoyer('pas-un-uuid', { png: base64Png(PNG) })).status).toBe(404)
    expect((await retirer('pas-un-uuid')).status).toBe(404)
    expect(appelsLogo()).toEqual([])
  })

  it('image refusée par la contrainte de la base (23514) : 400 invalide, journalisé sans valeur', async () => {
    baseQr.etat.fonctions.signalements_qr_regler_logo_cabinet = () => ({ error: { code: '23514', message: 'new row violates check constraint "signalements_qr_cabinets_logo_png_valide"' } })
    const res = await envoyer(CAB, { png: base64Png(PNG) })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalide')
    expect(simulQr.logger.warn).toHaveBeenCalled()
  })

  it('autre erreur de la base : 500 serveur, code seul au journal, jamais le message', async () => {
    baseQr.etat.fonctions.signalements_qr_regler_logo_cabinet = () => ({ error: { code: '57014', message: 'canceling statement due to statement timeout' } })
    const res = await envoyer(CAB, { png: base64Png(PNG) })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'serveur' })
    expect(texteJournalServeurQr()).not.toContain('canceling statement')
  })

  it('migration 20261114 absente (fonction absente, PGRST202) : 503 base_absente, repli journalisé une fois', async () => {
    delete baseQr.etat.fonctions.signalements_qr_regler_logo_cabinet
    for (let i = 0; i < 2; i++) {
      const res = await envoyer(CAB, { png: base64Png(PNG) })
      expect(res.status).toBe(503)
      expect(await res.json()).toEqual({ error: 'base_absente' })
    }
    expect((await retirer(CAB)).status).toBe(503)
    const avertissements = simulQr.logger.warn.mock.calls.filter((c) => String(c[0]).includes('14/11/2026'))
    expect(avertissements).toHaveLength(2)
    expect(avertissements[0][1]).toEqual({ migration: MIGRATION_LOGO_QR, code: 'PGRST202' })
  })
})

describe('DELETE …/cabinets/[id]/logo : retrait', () => {
  it('logo retiré : fonction appelée sans image ; { logo: null, modifie: true } ; second retrait : modifie false', async () => {
    poserLogo(CAB, PNG, 320, 120)
    const res = await retirer(CAB)
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await res.json()).toEqual({ logo: null, modifie: true })
    expect(appelsLogo()[0].args).toEqual({ p_cabinet: CAB, p_png: null, p_largeur: null, p_hauteur: null, p_acteur: ADMIN_QR.id })
    expect(await (await retirer(CAB)).json()).toEqual({ logo: null, modifie: false })
  })

  it('cabinet inconnu : 404', async () => {
    expect((await retirer('ca000000-0000-4000-8000-0000000000ff')).status).toBe(404)
  })
})

describe('GET /api/aj-signalement/logo/[identifiant] : lecture publique de l’image', () => {
  beforeEach(() => {
    simulQr.user = null
    poserLogo(CAB, PNG, 320, 120)
  })

  it('sans session : l’image elle-même, octet pour octet, cache public immuable pour la version en place', async () => {
    const res = await lireLogo('cabinet-exemple', `?v=${VERSION}`)
    expect(res.status).toBe(200)
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG)
    expect(res.headers.get('Content-Type')).toBe('image/png')
    expect(res.headers.get('Content-Length')).toBe(String(PNG.length))
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
    expect(res.headers.get('ETag')).toBe(`"${VERSION}"`)
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'none'; sandbox")
    expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin')
    expect(res.headers.get('Content-Disposition')).toBe('inline; filename="logo.png"')
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex')
    expect(res.headers.get('Set-Cookie')).toBeNull()
    expect(simulQr.limites).toEqual(['qr_logo_203.0.113.7'])
    // Seules les colonnes du logo sont lues, jamais autre chose du cabinet : métadonnées d'abord, image ensuite.
    expect(baseQr.etat.lectures.filter((l) => l.table === 'signalements_qr_cabinets').map((l) => l.colonnes)).toEqual([
      'logo_version, logo_largeur, logo_hauteur',
      'logo_png, logo_version, logo_largeur, logo_hauteur',
    ])
  })

  // Relecture de sécurité du 13/11/2026 : chaque requête anonyme, 304 compris, tirait l'image entière de la base
  // (≈ 384 000 caractères hexadécimaux pour 192 Ko, ≈ 30 ms de calcul) : une amplification des coûts, bornée par la
  // limite de débit. Les réponses sans corps se décident sur les métadonnées seules.
  describe('réponses sans corps : décidées sur les métadonnées, sans lire l’image', () => {
    const colonnesLues = () => baseQr.etat.lectures.filter((l) => l.table === 'signalements_qr_cabinets').map((l) => l.colonnes)

    it('If-None-Match de la version en place (avec ou sans version dans l’adresse) : 304, la colonne logo_png n’est pas lue', async () => {
      for (const requete of [`?v=${VERSION}`, '', '?v=0000000000000000']) {
        baseQr.etat.lectures = []
        const res = await lireLogo('cabinet-exemple', requete, { 'if-none-match': `"${VERSION}"` })
        expect(res.status).toBe(304)
        expect(colonnesLues()).toEqual(['logo_version, logo_largeur, logo_hauteur'])
      }
    })

    it('304 : mêmes en-têtes que l’image (cache selon la version demandée, ETag, nosniff, CSP)', async () => {
      const immuable = await lireLogo('cabinet-exemple', `?v=${VERSION}`, { 'if-none-match': `"${VERSION}"` })
      expect(immuable.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
      expect(immuable.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(immuable.headers.get('Content-Security-Policy')).toBe("default-src 'none'; sandbox")
      const court = await lireLogo('cabinet-exemple', '', { 'if-none-match': `"${VERSION}"` })
      expect(court.headers.get('Cache-Control')).toBe('public, max-age=300')
    })

    it('cabinet sans logo ou inconnu : 404 sans lire l’image', async () => {
      for (const identifiant of ['autre-cabinet', 'cabinet-inconnu']) {
        baseQr.etat.lectures = []
        expect((await lireLogo(identifiant)).status).toBe(404)
        expect(colonnesLues().some((c) => c.includes('logo_png'))).toBe(false)
      }
    })

    it('If-None-Match d’une ancienne version : l’image en place (200), lue après les métadonnées', async () => {
      const res = await lireLogo('cabinet-exemple', `?v=${VERSION}`, { 'if-none-match': '"0000000000000000"' })
      expect(res.status).toBe(200)
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG)
      expect(colonnesLues()).toEqual(['logo_version, logo_largeur, logo_hauteur', 'logo_png, logo_version, logo_largeur, logo_hauteur'])
    })

    it('erreur de la base dès les métadonnées : 500, l’image n’est pas lue', async () => {
      baseQr.etat.erreursPonctuelles.signalements_qr_cabinets = { code: '57014', message: 'canceling statement due to statement timeout' }
      expect((await lireLogo('cabinet-exemple')).status).toBe(500)
      expect(colonnesLues().some((c) => c.includes('logo_png'))).toBe(false)
    })
  })

  it('sans version, ou avec une autre version : l’image en place, cache public court', async () => {
    for (const requete of ['', '?v=0000000000000000']) {
      const res = await lireLogo('cabinet-exemple', requete)
      expect(res.status).toBe(200)
      expect(res.headers.get('Cache-Control')).toBe('public, max-age=300')
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG)
    }
  })

  it('If-None-Match de la version en place : 304 sans corps', async () => {
    const res = await lireLogo('cabinet-exemple', `?v=${VERSION}`, { 'if-none-match': `"${VERSION}"` })
    expect(res.status).toBe(304)
    expect((await res.arrayBuffer()).byteLength).toBe(0)
    expect(res.headers.get('ETag')).toBe(`"${VERSION}"`)
  })

  it('cabinet sans logo, ou inconnu : 404 jamais en cache', async () => {
    for (const identifiant of ['autre-cabinet', 'cabinet-inconnu']) {
      const res = await lireLogo(identifiant)
      expect(res.status).toBe(404)
      expect(res.headers.get('Cache-Control')).toBe('no-store')
    }
  })

  it('identifiant hors format ou réservé : 404 sans lecture de la base', async () => {
    for (const identifiant of ['Cabinet', 'ab', 'aj-signalement', 'admin', '..%2Fx']) {
      expect((await lireLogo(identifiant)).status).toBe(404)
    }
    expect(baseQr.etat.lectures).toEqual([])
  })

  it('migration 20261114 absente (colonnes inconnues, 42703) : 404, repli journalisé une fois', async () => {
    baseQr.etat.colonnesAbsentes.signalements_qr_cabinets = COLONNES_LOGO
    expect((await lireLogo('cabinet-exemple')).status).toBe(404)
    expect((await lireLogo('cabinet-exemple')).status).toBe(404)
    const avertissements = simulQr.logger.warn.mock.calls.filter((c) => String(c[0]).includes('14/11/2026'))
    expect(avertissements).toHaveLength(1)
    expect(avertissements[0][1]).toEqual({ migration: MIGRATION_LOGO_QR, code: '42703' })
  })

  it('image stockée illisible (jamais servie telle quelle) : 404, erreur journalisée', async () => {
    const ligne = baseQr.table('signalements_qr_cabinets').find((c) => c.id === CAB) as Record<string, unknown>
    ligne.logo_png = `\\x${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('hex')}`
    const res = await lireLogo('cabinet-exemple', `?v=${VERSION}`)
    expect(res.status).toBe(404)
    expect(res.headers.get('Content-Type')).not.toBe('image/png')
    expect(simulQr.logger.error).toHaveBeenCalled()
  })

  // Relecture de sécurité du 13/11/2026 : la forme seule était revérifiée à la lecture ; un PNG écrit hors de la route
  // (éditeur SQL), de forme juste mais au contenu choisi, était servi tel quel.
  it.each([
    ['octets cachés après le flux zlib', pngSynthetique(64, 32, { idat: Buffer.concat([deflateSync(Buffer.alloc(32 * 257)), Buffer.from('PK\u0003\u0004<html>', 'latin1')]) })],
    ['IDAT qui n’est pas du zlib', pngSynthetique(64, 32, { idat: Buffer.from('ceci n est pas du zlib', 'latin1') })],
    ['profil ICC (iCCP)', pngSynthetique(64, 32, { morceaux: [{ type: 'iCCP', donnees: Buffer.concat([Buffer.from('profil\0\0', 'latin1'), deflateSync(Buffer.from('texte'))]) }] })],
  ])('image stockée hors de la route (%s) : jamais servie, 404, erreur journalisée avec sa raison', async (_cas, image) => {
    poserLogo(CAB, image, 64, 32)
    const res = await lireLogo('cabinet-exemple', `?v=${empreinte16(image)}`)
    expect(res.status).toBe(404)
    expect(res.headers.get('Content-Type')).not.toBe('image/png')
    expect(simulQr.logger.error).toHaveBeenCalledWith(expect.stringContaining('logo stocké illisible'), expect.objectContaining({ raison: expect.any(String) }))
  })

  it('erreur de la base : 500, jamais en cache, code seul au journal', async () => {
    baseQr.etat.erreursPonctuelles.signalements_qr_cabinets = { code: '57014', message: 'canceling statement due to statement timeout' }
    const res = await lireLogo('cabinet-exemple')
    expect(res.status).toBe(500)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(texteJournalServeurQr()).not.toContain('canceling statement')
  })

  it('limite de débit par adresse IP : 429', async () => {
    simulQr.refuser = ['qr_logo_']
    expect((await lireLogo('cabinet-exemple')).status).toBe(429)
    expect(baseQr.etat.lectures).toEqual([])
  })
})

describe('métadonnées du logo dans les lectures de l’espace (jamais l’image)', () => {
  it('GET /cabinets : logo { version, largeur, hauteur } du cabinet qui en a un ; aucune clé logo pour les autres', async () => {
    poserLogo(CAB, PNG, 320, 120)
    const res = await CABINETS(requeteQr('/api/aj-signalement/cabinets'))
    expect(res.status).toBe(200)
    const texte = await res.text()
    expect(texte).not.toContain(hexBytea(PNG).slice(2, 40))
    const { cabinets } = JSON.parse(texte) as { cabinets: Array<Record<string, unknown>> }
    expect(cabinets.find((c) => c.id === CAB)?.logo).toEqual({ version: VERSION, largeur: 320, hauteur: 120 })
    expect('logo' in (cabinets.find((c) => c.id === CAB_AUTRE) ?? {})).toBe(false)
    const lues = baseQr.etat.lectures.filter((l) => l.table === 'signalements_qr_cabinets').map((l) => l.colonnes)
    expect(lues.some((c) => c.includes('logo_png'))).toBe(false)
  })

  it('GET /cabinets, migration 20261114 absente : liste identique à avant (aucune clé logo), repli journalisé une fois', async () => {
    const avant = await (await CABINETS(requeteQr('/api/aj-signalement/cabinets'))).json()
    baseQr.etat.colonnesAbsentes.signalements_qr_cabinets = COLONNES_LOGO
    const res = await CABINETS(requeteQr('/api/aj-signalement/cabinets'))
    expect(res.status).toBe(200)
    const apres = await res.json()
    expect(apres).toEqual(avant)
    expect(JSON.stringify(apres)).not.toContain('logo')
    await CABINETS(requeteQr('/api/aj-signalement/cabinets'))
    expect(simulQr.logger.warn.mock.calls.filter((c) => String(c[0]).includes('14/11/2026'))).toHaveLength(1)
  })

  it('GET /moi (gestionnaire) : logo de SON cabinet seulement ; sans logo ou sans migration, réponse d’avant', async () => {
    A.connecterQr(A.COMPTE_G1)
    const sansLogo = await (await MOI(requeteQr('/api/aj-signalement/moi'))).json()
    expect(sansLogo.cabinet).toEqual({ identifiant: 'cabinet-exemple', nom: 'Cabinet Exemple', domaines: ['exemple.test'] })
    poserLogo(CAB_AUTRE, pngSynthetique(50, 50), 50, 50)
    expect((await (await MOI(requeteQr('/api/aj-signalement/moi'))).json()).cabinet).toEqual(sansLogo.cabinet)
    poserLogo(CAB, PNG, 320, 120)
    const avecLogo = await (await MOI(requeteQr('/api/aj-signalement/moi'))).json()
    expect(avecLogo.cabinet).toEqual({ ...sansLogo.cabinet, logo: { version: VERSION, largeur: 320, hauteur: 120 } })
    baseQr.etat.colonnesAbsentes.signalements_qr_cabinets = COLONNES_LOGO
    const res = await MOI(requeteQr('/api/aj-signalement/moi'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(sansLogo)
  })
})
