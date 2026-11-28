/**
 * Liste des sections ouvertes à une société BTP (lib/btp/sections-tableau-de-bord.ts) : elle doit couvrir, avec les
 * écrans des autres métiers, exactement les sections que la page du tableau de bord sait afficher, et contenir tout ce
 * que le menu et l'en-tête BTP peuvent ouvrir. Sans cette garde, une section ajoutée à la page mais oubliée ici
 * renverrait la société à l'accueil.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { SECTIONS_AUTRES_METIERS, MODULE_DE_LA_SECTION, SECTIONS_SOCIETE_BTP } from '@/lib/btp/sections-tableau-de-bord'
import { ALL_PRO_MODULES } from '@/lib/permissions'
import { useModulesConfig } from '@/hooks/useModulesConfig'

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')
const t = (cle: string, repli?: string) => repli ?? cle

describe('sections du tableau de bord ouvertes à une société BTP', () => {
  it('avec les écrans des autres métiers, couvrent exactement les sections de la page, sans recouvrement', () => {
    const page = lire('app/(commun)/pro/dashboard/page.tsx')
    const contenu = page.slice(page.indexOf('<main '), page.indexOf('</main>'))
    const sectionsDeLaPage = new Set([...contenu.matchAll(/activePage === '([a-z0-9_]+)'/g)].map((m) => m[1]))
    expect(sectionsDeLaPage.size).toBeGreaterThan(40)

    expect([...SECTIONS_SOCIETE_BTP].filter((s) => SECTIONS_AUTRES_METIERS.has(s))).toEqual([])
    const couvertes = new Set([...SECTIONS_SOCIETE_BTP, ...SECTIONS_AUTRES_METIERS])
    expect([...sectionsDeLaPage].filter((s) => !couvertes.has(s))).toEqual([])
    expect([...couvertes].filter((s) => !sectionsDeLaPage.has(s))).toEqual([])
  })

  it('contiennent chaque module du menu BTP, en français comme en portugais', () => {
    for (const isPt of [false, true]) {
      const { result } = renderHook(() => useModulesConfig('fiche-1', t, isPt))
      const absents = result.current.ALL_MODULES.map((m) => m.id).filter((id) => !SECTIONS_SOCIETE_BTP.has(id))
      expect(absents, isPt ? 'portugais' : 'français').toEqual([])
    }
  })

  it('contiennent chaque destination du menu et de l’en-tête BTP', () => {
    for (const fichier of ['components/dashboard/V5Sidebar.tsx', 'components/dashboard/V5Header.tsx']) {
      const destinations = [...lire(fichier).matchAll(/navigateTo\('([a-z0-9_]+)'\)/g)].map((m) => m[1])
      expect(destinations.length, fichier).toBeGreaterThan(0)
      expect(destinations.filter((d) => !SECTIONS_SOCIETE_BTP.has(d)), fichier).toEqual([])
    }
  })
})

// ── Sections que la matrice des droits ne gouverne pas (24/11/2026) ────────────────────────────────────────
//
// Depuis que le tableau de bord vérifie la permission avant d'ouvrir une section, une section sans module
// correspondant serait refusée à tout salarié — et « Mon profil », qui porte le changement de mot de passe,
// l'enfermerait dehors. Ces six-là sont donc laissées ouvertes exprès. Si une septième apparaît, ce test le dit :
// il faut alors décider, soit lui donner un module, soit l'ajouter ici en connaissance de cause.
describe('sections sans module de permission', () => {
  const SANS_MODULE = ['comm_pro', 'portail_client', 'canal', 'prestations', 'modules', 'help']

  it('la liste des sections hors matrice est exactement celle-ci', () => {
    const horsMatrice = [...SECTIONS_SOCIETE_BTP].filter((section) => !ALL_PRO_MODULES.includes(section as never))
    expect(horsMatrice.sort()).toEqual([...SANS_MODULE].sort())
  })

  it('« prestations » est l’adresse du module « motifs », et se garde par lui', () => {
    expect(MODULE_DE_LA_SECTION.prestations).toBe('motifs')
    expect(ALL_PRO_MODULES).toContain('motifs')
  })

  it('les sections d’accueil d’un salarié sont, elles, toutes gouvernées', () => {
    for (const section of ['pointage', 'chantiers', 'meteo', 'dictionnaire_materiaux', 'calendar', 'photos_chantier']) {
      expect(SECTIONS_SOCIETE_BTP.has(section)).toBe(true)
      expect(ALL_PRO_MODULES).toContain(section)
    }
  })
})
