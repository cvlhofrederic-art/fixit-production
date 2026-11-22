// CRM du secrétariat installable sur l'ordinateur (22/11/2026) : manifeste « Vitfix CRM » (lib/crm/manifeste.ts),
// sa route et sa déclaration dans le layout du CRM. Critères d'installation de Chrome et Edge : nom, icônes PNG 192 et
// 512 réellement présentes, adresse de départ dans la portée, affichage en fenêtre à part. Que la route échappe au
// middleware et reçoive une seule CSP : tests/securite/csp-politique-unique.test.ts.

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { CHEMIN_CRM } from '@/lib/crm/types'
import { CHEMIN_MANIFESTE_CRM, MANIFESTE_CRM } from '@/lib/crm/manifeste'
import { METADONNEES_PARTAGEES, metadonneesRacine } from '@/lib/seo/metadonnees-racine'

const { GET } = await import('@/app/(commun)/admin/crm/manifest.webmanifest/route')
const { metadata } = await import('@/app/(commun)/admin/crm/layout')

/** Largeur et hauteur d'un PNG, lues dans son en-tête IHDR. */
function dimensionsPng(fichier: string): { largeur: number; hauteur: number } {
  const octets = readFileSync(fichier)
  expect(octets.subarray(1, 4).toString('ascii')).toBe('PNG')
  return { largeur: octets.readUInt32BE(16), hauteur: octets.readUInt32BE(20) }
}

describe('manifeste de l’application Vitfix CRM', () => {
  it('ouvre directement le CRM, dans une fenêtre à part, sous une identité fixe et distincte de l’application Vitfix', () => {
    expect(MANIFESTE_CRM.name).toBe('Vitfix CRM')
    expect(MANIFESTE_CRM.short_name).toBe('Vitfix CRM')
    expect(MANIFESTE_CRM.start_url).toBe(CHEMIN_CRM)
    // Valeur écrite en dur : changer l'identité rendrait orphelines les applications déjà installées.
    expect(MANIFESTE_CRM.id).toBe('/admin/crm/')
    expect(MANIFESTE_CRM.display).toBe('standalone')
  })

  it('ne couvre que le CRM : les autres liens vitfix.io ne s’ouvrent pas dans l’application', () => {
    expect(MANIFESTE_CRM.scope).toBe(CHEMIN_CRM)
    expect(MANIFESTE_CRM.start_url.startsWith(MANIFESTE_CRM.scope)).toBe(true)
    for (const ailleurs of ['/', '/pt/', '/fr/auth/login', '/admin/dashboard/', '/pro/dashboard']) {
      expect(ailleurs.startsWith(MANIFESTE_CRM.scope), ailleurs).toBe(false)
    }
  })

  it('a des icônes PNG 192 et 512 présentes dans public/, aux dimensions annoncées', () => {
    const tailles = MANIFESTE_CRM.icons.map((icone) => icone.sizes)
    expect(tailles).toEqual(expect.arrayContaining(['192x192', '512x512']))
    for (const icone of MANIFESTE_CRM.icons) {
      const fichier = path.join(process.cwd(), 'public', icone.src)
      expect(existsSync(fichier), icone.src).toBe(true)
      const { largeur, hauteur } = dimensionsPng(fichier)
      expect(`${largeur}x${hauteur}`).toBe(icone.sizes)
      expect(icone.type).toBe('image/png')
    }
  })

  it('est servi par sa route en application/manifest+json, sans aucune donnée de compte', async () => {
    const reponse = await GET()
    expect(reponse.status).toBe(200)
    expect(reponse.headers.get('Content-Type')).toBe('application/manifest+json; charset=utf-8')
    const corps = await reponse.json()
    expect(corps).toEqual(JSON.parse(JSON.stringify(MANIFESTE_CRM)))
  })

  it('la route existe à l’adresse déclarée par le layout du CRM', () => {
    expect(CHEMIN_MANIFESTE_CRM).toBe('/admin/crm/manifest.webmanifest')
    expect(existsSync(path.join(process.cwd(), 'app', '(commun)', CHEMIN_MANIFESTE_CRM, 'route.ts'))).toBe(true)
    expect(metadata.manifest).toBe(CHEMIN_MANIFESTE_CRM)
  })
})

// Le navigateur ne retient que le premier <link rel="manifest"> : celui de Vitfix, écrit en dur dans la coquille, passait
// avant celui du CRM en développement. Le manifeste passe par les métadonnées, où celui d'une section remplace l'autre.
describe('manifeste déclaré par les métadonnées, jamais en dur', () => {
  it('le manifeste général de Vitfix vient des métadonnées partagées des layouts racine', () => {
    expect(METADONNEES_PARTAGEES.manifest).toBe('/manifest.json')
    expect(metadonneesRacine('fr').manifest).toBe('/manifest.json')
    expect(metadonneesRacine('pt').manifest).toBe('/manifest.json')
  })

  it('la coquille commune n’écrit plus de manifeste en dur', () => {
    const source = readFileSync(path.join(process.cwd(), 'components', 'common', 'CoquilleRacine.tsx'), 'utf8')
    expect(source).not.toMatch(/rel=["']manifest["']/)
  })
})
