import './fuseau-paris'
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, render } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Shell } from '@/components/administrateur-judiciaire/shell/Shell'
import { ToastProvider } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Barre du haut : la date ne prend pas la place du titre de la page (contrôle du 30/10/2026).
 * En mode « données réelles », la date affichée est celle du jour ; sa largeur suit le jour et le mois (jusqu'à 211 px,
 * « dimanche 13 septembre 2026 à 00:48 »). Mesuré dans Chrome headless : revenue dès 1600 px, elle réduisait le titre
 * à 0 px et poussait la pastille de statut sur le sélecteur. Elle ne revient plus qu'à 1920 px, et le fil d'Ariane
 * coupe son contenu.
 *
 * jsdom n'évalue pas les requêtes de largeur : aj-selecteur-copro.css est chargée « à une largeur donnée », ses blocs
 * @media étant dépliés ou retirés selon cette largeur (feuilleALargeur). aj.css est chargée telle quelle : ses requêtes
 * de largeur ne touchent la barre du haut que sous 1281 px (marges intérieures) et sous 1025 px.
 */

vi.mock('next/dynamic', () => ({
  default: () =>
    function EcranFactice() {
      return <div data-testid="ecran-registre" />
    },
}))

const STYLES = join(__dirname, '..', '..', 'components', 'administrateur-judiciaire', 'styles')
let feuilleAj: HTMLStyleElement
let feuilleBarre: HTMLStyleElement | null = null

/** Vrai si la requête (« (min-width: 1025px) and (max-width: 1919px) ») vaut pour cette largeur de fenêtre. */
function requeteVraie(requete: string, largeur: number): boolean {
  return requete.split(/\s+and\s+/).every((condition) => {
    const borne = /^\(\s*(min|max)-width\s*:\s*(\d+)px\s*\)$/.exec(condition.trim())
    if (!borne) return false
    return borne[1] === 'min' ? largeur >= Number(borne[2]) : largeur <= Number(borne[2])
  })
}

/** Texte des règles appliquées à cette largeur : blocs @media dépliés quand ils valent, retirés sinon. */
function reglesALargeur(regles: CSSRuleList, largeur: number): string {
  return Array.from(regles, (regle) => {
    if (!(regle instanceof CSSMediaRule)) return regle.cssText
    return requeteVraie(regle.media.mediaText, largeur) ? reglesALargeur(regle.cssRules, largeur) : ''
  }).join('\n')
}

/** Charge aj-selecteur-copro.css (après aj.css, comme le layout) telle qu'elle s'applique à cette largeur. */
function feuilleALargeur(largeur: number): void {
  const brute = document.createElement('style')
  brute.textContent = readFileSync(join(STYLES, 'aj-selecteur-copro.css'), 'utf8')
  document.head.appendChild(brute)
  const texte = reglesALargeur((brute.sheet as CSSStyleSheet).cssRules, largeur)
  brute.remove()
  feuilleBarre?.remove()
  feuilleBarre = document.createElement('style')
  feuilleBarre.textContent = texte
  document.head.appendChild(feuilleBarre)
}

beforeAll(async () => {
  feuilleAj = document.createElement('style')
  feuilleAj.textContent = readFileSync(join(STYLES, 'aj.css'), 'utf8')
  document.head.appendChild(feuilleAj)
  localStorage.clear()
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loaded: false, loading: false })
  await useDonneesStore.getState().loadAll()
})

// Le Shell est monté pour chaque test : tests/setup.ts démonte le rendu après chacun (cleanup).
beforeEach(async () => {
  window.scrollTo = (() => undefined) as typeof window.scrollTo
  useSelectionDossier.setState({ code: 'LM', coproprietaireId: null })
  // Écran branché sur la base : pastille « Données réelles », la plus large des trois.
  window.history.replaceState(null, '', '#tresorerie')
  await act(async () => {
    render(
      <div id="aj-root" lang="fr">
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </div>,
    )
  })
})

afterEach(() => {
  cleanup()
  feuilleBarre?.remove()
  feuilleBarre = null
})

afterAll(() => {
  feuilleAj.remove()
  window.history.replaceState(null, '', window.location.pathname)
})

const barre = () => document.querySelector('.topbar') as HTMLElement
const date = () => barre().querySelector('.vfx-date-topbar') as HTMLElement
const filAriane = () => barre().querySelector('.crumb:not(.crumb-mobile):not(.vfx-date-topbar)') as HTMLElement
const affiche = (element: Element) => getComputedStyle(element).display !== 'none'

describe('barre du haut — la date ne prend pas la place du titre de la page', () => {
  it('la date reste masquée jusqu’à 1919 px, où la barre est resserrée ; elle revient à 1920 px', () => {
    expect(date().querySelector('time')).not.toBeNull()
    for (const largeur of [1100, 1440, 1599, 1600, 1620, 1650, 1760, 1800, 1919]) {
      feuilleALargeur(largeur)
      expect(affiche(date()), `${largeur} px`).toBe(false)
    }
    for (const largeur of [1920, 2560]) {
      feuilleALargeur(largeur)
      expect(affiche(date()), `${largeur} px`).toBe(true)
    }
  })

  it('« VitFix › » revient à 1600 px, sans la date : le titre et la pastille de statut gardent leur place', () => {
    const [vitfix, chevron] = Array.from(filAriane().children)
    expect(vitfix).toHaveTextContent('VitFix')
    feuilleALargeur(1599)
    expect(affiche(vitfix)).toBe(false)
    expect(affiche(chevron)).toBe(false)
    feuilleALargeur(1600)
    expect(affiche(vitfix)).toBe(true)
    expect(affiche(chevron)).toBe(true)
    expect(affiche(date())).toBe(false)
    expect(filAriane().querySelector(':scope > b')).toHaveTextContent('Banque & recouvrement')
    expect(filAriane().querySelector(':scope > .pill')).toHaveTextContent('Données réelles')
  })

  it('garde : le fil d’Ariane coupe son contenu, la pastille de statut ne peut pas passer sur le sélecteur', () => {
    for (const largeur of [1100, 1600, 1920]) {
      feuilleALargeur(largeur)
      expect(getComputedStyle(filAriane()).overflow, `${largeur} px`).toBe('hidden')
      // Le titre se tronque par des points de suspension avant que la pastille ne soit coupée.
      const titre = filAriane().querySelector(':scope > b') as HTMLElement
      expect(getComputedStyle(titre).textOverflow).toBe('ellipsis')
      expect(getComputedStyle(filAriane().querySelector(':scope > .pill') as HTMLElement).flex).toMatch(/^(none|0 0 auto)$/)
    }
  })
})
