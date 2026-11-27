import './fuseau-paris'
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { monterShellJudiciaire as monterShell, preparerShellJudiciaire } from '../helpers/shell-judiciaire'

/**
 * Focus rendu au contenu principal après une navigation depuis la palette ⌘K : <main id="main" tabindex="-1"> reçoit
 * le focus par programme (un lecteur d'écran repart du contenu de la page), sans que le navigateur dessine autour de
 * toute la zone principale l'indicateur de focus des contrôles (contour bleu marine 2 px et halo 4 px de aj.css).
 * Les feuilles de l'application (aj.css, puis aj-selecteur-copro.css, dans l'ordre du layout) sont chargées dans le
 * document ; jsdom applique la cascade et :focus-visible.
 */

vi.mock('next/dynamic', () => ({
  default: () =>
    function EcranFactice() {
      return <div data-testid="ecran-registre" />
    },
}))

const STYLES = join(__dirname, '..', '..', 'components', 'administrateur-judiciaire', 'styles')
const feuilles: HTMLStyleElement[] = []

beforeAll(async () => {
  for (const nom of ['aj.css', 'aj-selecteur-copro.css']) {
    const feuille = document.createElement('style')
    feuille.textContent = readFileSync(join(STYLES, nom), 'utf8')
    document.head.appendChild(feuille)
    feuilles.push(feuille)
  }
})

preparerShellJudiciaire()

afterAll(() => {
  for (const feuille of feuilles) feuille.remove()
})

const palette = () => screen.queryByRole('dialog', { name: 'Palette de commandes' })

describe('contenu principal focalisé par programme', () => {
  it('après une navigation depuis la palette : focus sur <main>, sans contour ni halo autour de la zone', async () => {
    await monterShell()
    const main = document.getElementById('main') as HTMLElement
    expect(main).toHaveAttribute('tabindex', '-1')

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const champPalette = within(palette() as HTMLElement).getByRole<HTMLInputElement>('textbox', { name: 'Rechercher' })
    // Comme dans le navigateur : le champ de la palette a le focus, on y tape, puis Entrée ouvre l'élément actif.
    champPalette.focus()
    fireEvent.change(champPalette, { target: { value: 'Tilleuls' } })
    await act(async () => {
      fireEvent.keyDown(champPalette, { key: 'Enter' })
    })
    expect(palette()).toBeNull()
    expect(document.activeElement).toBe(main)

    // Chrome tient ce focus pour « visible » (dernière interaction au clavier, champ de saisie retiré) : mesuré dans
    // Chrome headless. L'heuristique de jsdom diffère quand le champ focalisé a été retiré ; on rejoue donc le même état
    // par une interaction clavier suivie du focus par programme.
    focaliserApresClavier(main)
    expect(main.matches(':focus-visible')).toBe(true)
    const style = getComputedStyle(main)
    expect(style.outline).not.toMatch(/solid/)
    expect(style.outlineStyle).toBe('none')
    expect(style.boxShadow).toBe('none')
  })

  it('les contrôles gardent l’indicateur de focus standard (contour 2 px et halo)', async () => {
    await monterShell()
    // jsdom garde le style calculé en cache jusqu'à la prochaine modification du DOM (pas au changement de focus) :
    // le bouton est pris par son libellé, sans requête par rôle, qui calculerait son style avant le focus.
    const bouton = screen.getByLabelText('Rechercher une copropriété, une personne, un lot, un prestataire')
    focaliserApresClavier(bouton)
    expect(bouton.matches(':focus-visible')).toBe(true)
    const style = getComputedStyle(bouton)
    expect(style.outline).toMatch(/^2px solid/)
    expect(style.boxShadow).toMatch(/4px/)
  })
})

/** Focus par programme juste après une interaction au clavier (Tab), comme le fait le navigateur. */
function focaliserApresClavier(element: HTMLElement): void {
  element.blur()
  fireEvent.keyDown(document.body, { key: 'Tab' })
  element.focus()
}
