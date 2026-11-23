import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

/**
 * Correctifs de la feuille de la maquette écrits à la main (aj-correctifs.css), décisions du 22/11/2026 sur l'écran
 * « Appels de fonds » : défaut 2 (un bouton désactivé avait l'aspect d'un bouton actif : la remise à zéro « all: revert »
 * de aj.css efface l'aspect natif et aucune règle ne le remplace) et défaut 6 (pastilles non cliquables de 44 px de haut
 * sur téléphone : la règle des cibles tactiles de aj.css vise aussi .pill).
 *
 * jsdom n'évalue pas les requêtes de largeur : les feuilles sont chargées « à une largeur donnée », dans l'ordre du layout,
 * leurs blocs @media dépliés quand ils valent et retirés sinon (comme barre-haut-date.test.tsx). Une requête autre qu'une
 * largeur (forced-colors, prefers-reduced-motion…) est retirée.
 */

const STYLES = join(__dirname, '..', '..', 'components', 'administrateur-judiciaire', 'styles')
const LAYOUT = join(__dirname, '..', '..', 'app', '(commun)', 'administrateur-judiciaire', 'layout.tsx')
const FEUILLES = ['aj.css', 'aj-selecteur-copro.css', 'aj-correctifs.css']

/** Vrai si la requête (« (max-width: 768px) ») vaut pour cette largeur de fenêtre. */
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

let chargees: HTMLStyleElement[] = []

/** Charge les feuilles du layout, dans son ordre, telles qu'elles s'appliquent à cette largeur. */
function feuillesALargeur(largeur: number, noms: readonly string[] = FEUILLES): void {
  for (const nom of noms) {
    const brute = document.createElement('style')
    brute.textContent = readFileSync(join(STYLES, nom), 'utf8')
    document.head.appendChild(brute)
    const texte = reglesALargeur((brute.sheet as CSSStyleSheet).cssRules, largeur)
    brute.remove()
    const feuille = document.createElement('style')
    feuille.textContent = texte
    document.head.appendChild(feuille)
    chargees.push(feuille)
  }
}

function monter(): Record<'desactive' | 'actif' | 'pastille' | 'petit', HTMLElement> {
  document.body.innerHTML = `<div id="aj-root" lang="fr">
    <button type="button" class="btn gold" disabled>Écrire l’appel</button>
    <button type="button" class="btn gold">Émettre un appel</button>
    <span class="pill sage no-dot">Appelé</span>
    <button type="button" class="btn ghost sm">Reprendre les fiches</button>
  </div>`
  const [desactive, actif, petit] = Array.from(document.querySelectorAll<HTMLElement>('button'))
  return { desactive, actif, petit, pastille: document.querySelector<HTMLElement>('.pill') as HTMLElement }
}

afterEach(() => {
  for (const feuille of chargees) feuille.remove()
  chargees = []
  document.body.innerHTML = ''
})

describe('aj-correctifs.css est chargée après les feuilles du module', () => {
  it('le layout importe aj-correctifs.css après aj.css et aj-selecteur-copro.css', () => {
    const layout = readFileSync(LAYOUT, 'utf8')
    const position = (nom: string) => layout.indexOf(`styles/${nom}'`)
    expect(position('aj-correctifs.css')).toBeGreaterThan(position('aj-selecteur-copro.css'))
    expect(position('aj-selecteur-copro.css')).toBeGreaterThan(position('aj.css'))
    expect(position('aj.css')).toBeGreaterThan(-1)
  })
})

describe('défaut 2 : un bouton désactivé se distingue d’un bouton actif', () => {
  it('sans le correctif, les deux ont le même aspect (constat du 22/11/2026)', () => {
    feuillesALargeur(1440, ['aj.css', 'aj-selecteur-copro.css'])
    const { desactive, actif } = monter()
    expect(getComputedStyle(desactive).opacity).toBe(getComputedStyle(actif).opacity)
    expect(getComputedStyle(desactive).cursor).toBe('pointer')
  })

  for (const largeur of [1440, 375])
    it(`à ${largeur} px : bouton désactivé atténué, curseur « interdit » ; bouton actif inchangé`, () => {
      feuillesALargeur(largeur)
      const { desactive, actif } = monter()
      expect(getComputedStyle(desactive).opacity).toBe('0.45')
      expect(getComputedStyle(desactive).cursor).toBe('not-allowed')
      expect(['', '1']).toContain(getComputedStyle(actif).opacity)
      expect(getComputedStyle(actif).cursor).toBe('pointer')
    })

  it('le survol et l’appui ne changent pas un bouton désactivé (règles de chaque variante présentes)', () => {
    const correctifs = readFileSync(join(STYLES, 'aj-correctifs.css'), 'utf8')
    for (const selecteur of [
      '#aj-root .btn:disabled:hover',
      '#aj-root .btn.ghost:disabled:hover',
      '#aj-root .btn.primary:disabled:hover',
      '#aj-root .btn.gold:disabled:hover',
      '#aj-root .btn.danger:disabled:hover',
      '#aj-root .btn:disabled:active',
    ])
      expect(correctifs).toContain(selecteur)
  })
})

describe('défaut 6 : une pastille n’est pas une cible tactile', () => {
  it('sans le correctif, la pastille monte à 44 px sur téléphone (constat du 22/11/2026)', () => {
    feuillesALargeur(375, ['aj.css', 'aj-selecteur-copro.css'])
    expect(getComputedStyle(monter().pastille).minHeight).toBe('44px')
  })

  it('à 375 px : la pastille garde sa hauteur ; les boutons gardent leurs 44 px (36 px en petit)', () => {
    feuillesALargeur(375)
    const { pastille, actif, petit } = monter()
    expect(['', 'auto', '0px']).toContain(getComputedStyle(pastille).minHeight)
    expect(getComputedStyle(actif).minHeight).toBe('44px')
    expect(getComputedStyle(petit).minHeight).toBe('36px')
  })

  it('à 1440 px : rien ne change', () => {
    feuillesALargeur(1440)
    expect(['', 'auto', '0px']).toContain(getComputedStyle(monter().pastille).minHeight)
  })
})
