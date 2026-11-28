// tests/lib/aj-signalement-logo-pages.test.ts
//
// Logo d'un cabinet client sur ses pages (demande de Hugo du 13/11/2026) : espace du cabinet (connexion, suivi,
// invitation, confirmation d'adresse) et page publique ouverte par le QR code.
//   - dimensionsLogoQr : taille affichée dans un cadre, proportions gardées, jamais agrandie au-delà de l'image ;
//   - logoPageQr : adresse versionnée de la route publique (identifiant du chemin public et version, rien d'autre),
//     texte alternatif = nom du cabinet, dimensions de l'image ;
//   - lireLogoPageCabinetQr (serveur, clé service) : nom et métadonnées du logo d'un cabinet, par son identifiant ou son
//     id, JAMAIS l'image ; null (page identique à avant) pour un identifiant invalide (sans lecture), un cabinet inconnu
//     ou sans logo, la migration 20261114 non appliquée (repli journalisé une fois), une erreur de la base (code seul au
//     journal) ou une exception.
// Base simulée (tests/helpers/aj-signalement-base.ts) ; cabinets fictifs « cabinet-exemple ».

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr } = await import('../helpers/aj-signalement-base')
const { reinitialiserSimulQr, simulQr } = await import('../helpers/aj-signalement-routes')
const A = await import('../helpers/aj-signalement-acces')
const { MIGRATION_LOGO_QR, reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')
const logo = await import('@/lib/aj-signalement/logo')
const serveurLogo = await import('@/lib/aj-signalement/serveur-logo')

const { CAB, CAB_AUTRE } = A
const VERSION = '0123456789abcdef'
const COLONNES_LOGO = ['logo_png', 'logo_largeur', 'logo_hauteur', 'logo_version', 'logo_maj_le']

function poserMeta(cabinetId: string, largeur: number, hauteur: number, version = VERSION): void {
  const ligne = baseQr.table('signalements_qr_cabinets').find((c) => c.id === cabinetId)
  if (!ligne) throw new Error('cabinet absent')
  // L'image elle-même n'est jamais lue par cette fonction : une valeur quelconque suffit.
  Object.assign(ligne, { logo_png: '\\x00', logo_largeur: largeur, logo_hauteur: hauteur, logo_version: version, logo_maj_le: '2026-11-13T10:00:00+00:00' })
}

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  A.poserJeuAccesQr()
})

describe('dimensionsLogoQr : taille affichée dans un cadre', () => {
  it.each([
    // [largeur, hauteur, cadre, attendu]
    [800, 296, { largeur: 240, hauteur: 48 }, { largeur: 130, hauteur: 48 }],
    [800, 100, { largeur: 240, hauteur: 48 }, { largeur: 240, hauteur: 30 }],
    [400, 400, { largeur: 160, hauteur: 40 }, { largeur: 40, hauteur: 40 }],
    [120, 30, { largeur: 240, hauteur: 48 }, { largeur: 120, hauteur: 30 }],
    [800, 1, { largeur: 240, hauteur: 48 }, { largeur: 240, hauteur: 1 }],
  ])('%i × %i dans %o → %o (proportions gardées, jamais agrandi)', (largeur, hauteur, cadre, attendu) => {
    expect(logo.dimensionsLogoQr(largeur, hauteur, cadre)).toEqual(attendu)
  })
})

describe('logoPageQr : ce que la page affiche', () => {
  it('adresse versionnée de la route publique, nom du cabinet en texte alternatif, dimensions de l’image', () => {
    expect(logo.logoPageQr('cabinet-exemple', 'Cabinet Exemple', { version: VERSION, largeur: 800, hauteur: 296 })).toEqual({
      src: `/api/aj-signalement/logo/cabinet-exemple/?v=${VERSION}`, alt: 'Cabinet Exemple', largeur: 800, hauteur: 296,
    })
  })

  it('aucun logo : null', () => {
    expect(logo.logoPageQr('cabinet-exemple', 'Cabinet Exemple', null)).toBeNull()
    expect(logo.logoPageQr('cabinet-exemple', 'Cabinet Exemple', undefined)).toBeNull()
  })
})

describe('lireLogoPageCabinetQr : nom et métadonnées, jamais l’image', () => {
  it('par l’identifiant du chemin public : le logo de CE cabinet', async () => {
    poserMeta(CAB, 800, 296)
    poserMeta(CAB_AUTRE, 100, 100, 'fedcba9876543210')
    expect(await serveurLogo.lireLogoPageCabinetQr({ identifiant: 'cabinet-exemple' })).toEqual({
      src: `/api/aj-signalement/logo/cabinet-exemple/?v=${VERSION}`, alt: 'Cabinet Exemple', largeur: 800, hauteur: 296,
    })
    const lectures = baseQr.etat.lectures.filter((l) => l.table === 'signalements_qr_cabinets')
    expect(lectures).toHaveLength(1)
    expect(lectures[0].colonnes).not.toContain('logo_png')
  })

  it('par l’id du cabinet (page publique du QR code)', async () => {
    poserMeta(CAB_AUTRE, 100, 100, 'fedcba9876543210')
    expect(await serveurLogo.lireLogoPageCabinetQr({ id: CAB_AUTRE })).toEqual({
      src: '/api/aj-signalement/logo/autre-cabinet/?v=fedcba9876543210', alt: 'Autre Cabinet', largeur: 100, hauteur: 100,
    })
  })

  it('cabinet sans logo, ou inconnu : null', async () => {
    expect(await serveurLogo.lireLogoPageCabinetQr({ identifiant: 'cabinet-exemple' })).toBeNull()
    expect(await serveurLogo.lireLogoPageCabinetQr({ identifiant: 'cabinet-inconnu' })).toBeNull()
    expect(await serveurLogo.lireLogoPageCabinetQr({ id: 'ca000000-0000-4000-8000-0000000000ff' })).toBeNull()
  })

  it.each(['Cabinet-Exemple', 'ab', 'aj-signalement', 'api', 'a--b'])('identifiant invalide ou réservé (%s) : null sans lecture', async (identifiant) => {
    expect(await serveurLogo.lireLogoPageCabinetQr({ identifiant })).toBeNull()
    expect(baseQr.etat.lectures).toHaveLength(0)
  })

  it('métadonnées incohérentes (version hors format) : null', async () => {
    poserMeta(CAB, 800, 296, 'pas-une-version')
    expect(await serveurLogo.lireLogoPageCabinetQr({ identifiant: 'cabinet-exemple' })).toBeNull()
  })

  it('migration 20261114 absente (colonnes inconnues) : null, repli journalisé une fois', async () => {
    baseQr.etat.colonnesAbsentes.signalements_qr_cabinets = COLONNES_LOGO
    expect(await serveurLogo.lireLogoPageCabinetQr({ identifiant: 'cabinet-exemple' })).toBeNull()
    expect(await serveurLogo.lireLogoPageCabinetQr({ identifiant: 'cabinet-exemple' })).toBeNull()
    const replis = simulQr.logger.warn.mock.calls.filter(([m]) => String(m).includes('migration du 14/11/2026 absente'))
    expect(replis).toHaveLength(1)
    expect(replis[0][1]).toMatchObject({ migration: MIGRATION_LOGO_QR, code: '42703' })
    expect(simulQr.logger.error).not.toHaveBeenCalled()
  })

  it('erreur de la base : null, code seul au journal', async () => {
    baseQr.etat.erreursPonctuelles.signalements_qr_cabinets = { code: '57014', message: 'canceling statement due to statement timeout' }
    expect(await serveurLogo.lireLogoPageCabinetQr({ identifiant: 'cabinet-exemple' })).toBeNull()
    expect(simulQr.logger.error).toHaveBeenCalledTimes(1)
    expect(simulQr.logger.error.mock.calls[0][1]).toEqual({ code: '57014' })
  })

  it('exception du client : null, nom de l’exception seul au journal (une page n’est jamais cassée par son logo)', async () => {
    const from = baseQr.client.from
    baseQr.client.from = (() => { throw new TypeError('fetch failed : https://exemple.test') }) as typeof from
    try {
      expect(await serveurLogo.lireLogoPageCabinetQr({ identifiant: 'cabinet-exemple' })).toBeNull()
    } finally {
      baseQr.client.from = from
    }
    const appel = [...simulQr.logger.warn.mock.calls, ...simulQr.logger.error.mock.calls].find(([m]) => String(m).includes('logo'))
    expect(appel?.[1]).toEqual({ exception: 'TypeError' })
  })
})
