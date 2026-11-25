import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { feuillesALargeur, retirerFeuilles } from './regles-a-largeur'

/**
 * Cadre du module sur téléphone (aj-correctifs.css), décision du 22/11/2026 sur la page de validation de l'écran
 * « Appels de fonds », points ap-17 et ap-d09 : défauts déjà sur main, repris dans une PR à part.
 * - Titre de la barre du haut coupé (« Appels de f… ») sous 481 px.
 * - Quatre indicateurs empilés à 375 px.
 * - Ombre de la barre latérale fermée au bord gauche (mise en page tiroir, sous 1025 px).
 * - Bandeau du mode (démonstration / données réelles) au-dessus du voile des fenêtres, à toutes les largeurs.
 * - Messages (toasts) sur le bouton Fixy sous 769 px.
 * - En-tête de panneau coincé à côté de son contrôle (« Avis d'appel par copropriétaire », « Comptes bancaires du
 *   mandat ») sous 769 px.
 *
 * Feuilles chargées « à une largeur donnée », dans l'ordre du layout (regles-a-largeur.ts). Chaque bloc commence par le
 * constat, feuilles du module sans le correctif. jsdom ne calcule pas la mise en page : ces tests vérifient les
 * déclarations qui s'appliquent à chaque largeur ; la mise en page se vérifie dans un navigateur.
 */

const SANS_CORRECTIF = ['aj.css', 'aj-selecteur-copro.css']
const FIXY = join(__dirname, '..', '..', 'components', 'administrateur-judiciaire', 'shell', 'FixyLauncher.tsx')

afterEach(() => {
  cleanup()
  retirerFeuilles()
  document.body.innerHTML = ''
})

const style = (selecteur: string) => getComputedStyle(document.querySelector(selecteur) as Element)
const sansEspaces = (valeur: string) => valeur.replaceAll(/\s+/g, '')

/** Cadre du module, mêmes classes que Shell.tsx, DemoBanner.tsx et toast.tsx. */
function monterCadre(menuOuvert = false): void {
  document.body.innerHTML = `<div id="aj-root" lang="fr">
    <div class="vfx-demo-banner" role="status"><span><b>MAQUETTE</b> · données de démonstration</span></div>
    <div class="app">
      <aside class="sidebar ${menuOuvert ? 'is-open' : ''}" aria-label="Navigation principale"></aside>
      <div class="sidebar-backdrop ${menuOuvert ? 'is-open' : ''}" aria-hidden="true"></div>
      <main id="main" tabindex="-1">
        <div class="topbar" role="banner">
          <button class="hamburger" aria-label="Ouvrir le menu"></button>
          <div class="crumb"><span>VitFix</span><b>Appels de fonds</b></div>
          <div class="crumb-mobile"><b>Appels de fonds</b></div>
          <div class="vfx-selecteur-copro"></div>
          <div class="spacer"></div>
          <label class="vfx-role"><select aria-label="Rôle dans le cabinet"><option>Comptabilité</option></select></label>
          <button class="icon-btn vfx-loupe-palette" aria-label="Ouvrir la palette de commandes"></button>
        </div>
      </main>
    </div>
    <div class="modal-backdrop"><div class="modal" role="dialog" aria-label="Fenêtre"></div></div>
    <div class="vfx-toast-viewport" role="region" aria-label="Notifications"></div>
  </div>`
}

describe('titre de la barre du haut coupé sur téléphone', () => {
  it('sans le correctif, le rôle partage la ligne du titre et le titre reste sur une ligne (constat du 22/11/2026)', () => {
    feuillesALargeur(375, SANS_CORRECTIF)
    monterCadre()
    expect(style('.topbar .vfx-role').order).toBe('0')
    expect(style('.topbar .crumb-mobile b').whiteSpace).toBe('nowrap')
  })

  for (const largeur of [375, 480])
    it(`à ${largeur} px : le rôle passe sous le sélecteur de copropriété ; le titre tient sur deux lignes au plus`, () => {
      feuillesALargeur(largeur)
      monterCadre()
      expect(style('.topbar .vfx-selecteur-copro').order).toBe('10')
      expect(style('.topbar .vfx-role').order).toBe('11')
      const titre = style('.topbar .crumb-mobile b')
      expect(titre.display).toBe('-webkit-box')
      expect(titre.getPropertyValue('-webkit-line-clamp')).toBe('2')
      expect(titre.whiteSpace).toBe('normal')
    })

  for (const largeur of [481, 1440])
    it(`à ${largeur} px : rien ne change`, () => {
      feuillesALargeur(largeur)
      monterCadre()
      expect(style('.topbar .vfx-role').order).toBe('0')
      if (largeur === 481) expect(style('.topbar .crumb-mobile b').whiteSpace).toBe('nowrap')
    })
})

describe('indicateurs empilés à 375 px', () => {
  const quatre = [
    { num: '12', lbl: 'Lots' },
    { num: '4', lbl: 'Appels' },
    { num: '1', lbl: 'Relances' },
    { num: '0', lbl: 'Impayés' },
  ]
  const colonnes = () => sansEspaces(style('.kpi-grid').gridTemplateColumns)
  const monterIndicateurs = () =>
    render(
      <div id="aj-root" lang="fr">
        <Kpis items={quatre} />
      </div>,
    )

  it('sans le correctif, une seule colonne sous 481 px (constat du 22/11/2026)', () => {
    feuillesALargeur(375, SANS_CORRECTIF)
    monterIndicateurs()
    expect(colonnes()).toBe('1fr')
  })

  for (const largeur of [375, 480])
    it(`à ${largeur} px : deux colonnes tant que chacune garde 150 px`, () => {
      feuillesALargeur(largeur)
      monterIndicateurs()
      expect(colonnes()).toBe('repeat(auto-fit,minmax(150px,1fr))')
    })

  it('à 481 et 1440 px : rien ne change', () => {
    feuillesALargeur(481)
    monterIndicateurs()
    expect(colonnes()).toBe('1fr1fr')
    cleanup()
    retirerFeuilles()
    feuillesALargeur(1440)
    monterIndicateurs()
    expect(colonnes()).toBe('repeat(auto-fit,minmax(180px,1fr))')
  })
})

describe('ombre de la barre latérale fermée au bord gauche', () => {
  const OMBRE = '4px 0 24px #0b18282e'

  it('sans le correctif, la barre fermée garde son ombre sous 1025 px (constat du 22/11/2026)', () => {
    feuillesALargeur(375, SANS_CORRECTIF)
    monterCadre()
    expect(style('aside.sidebar').boxShadow).toBe(OMBRE)
  })

  for (const largeur of [375, 1024])
    it(`à ${largeur} px : plus d'ombre quand le menu est fermé ; le menu ouvert garde la sienne`, () => {
      feuillesALargeur(largeur)
      monterCadre()
      expect(style('aside.sidebar').boxShadow).toBe('none')
      monterCadre(true)
      expect(style('aside.sidebar').boxShadow).toBe(OMBRE)
    })

  for (const largeur of [1025, 1440])
    it(`à ${largeur} px : rien ne change`, () => {
      feuillesALargeur(largeur, SANS_CORRECTIF)
      monterCadre()
      const avant = style('aside.sidebar').boxShadow
      retirerFeuilles()
      feuillesALargeur(largeur)
      expect(style('aside.sidebar').boxShadow).toBe(avant)
    })
})

describe('bandeau du mode au-dessus du voile des fenêtres', () => {
  const z = (selecteur: string) => Number(style(selecteur).zIndex)
  const variable = (nom: string) => Number(style('#aj-root').getPropertyValue(nom).trim())

  it('sans le correctif, le bandeau passe au-dessus du voile des fenêtres (constat du 22/11/2026)', () => {
    feuillesALargeur(1440, SANS_CORRECTIF)
    monterCadre()
    expect(z('.vfx-demo-banner')).toBe(2000)
    expect(z('.vfx-demo-banner')).toBeGreaterThan(z('.modal-backdrop'))
  })

  for (const largeur of [375, 1440])
    it(`à ${largeur} px : au-dessus de la barre du haut collante, sous tous les voiles`, () => {
      feuillesALargeur(largeur)
      monterCadre()
      const bandeau = z('.vfx-demo-banner')
      expect(bandeau).toBe(101)
      expect(bandeau).toBeGreaterThan(variable('--z-sticky'))
      expect(bandeau).toBeLessThan(variable('--z-drawer-backdrop'))
      expect(bandeau).toBeLessThan(variable('--z-cmdk'))
      expect(bandeau).toBeLessThan(z('.modal-backdrop'))
    })
})

describe('messages (toasts) sur le bouton Fixy', () => {
  const bas = () => style('.vfx-toast-viewport').bottom

  it('sans le correctif, les messages sont à 16 px du bas sous 769 px (constat du 22/11/2026)', () => {
    feuillesALargeur(375, SANS_CORRECTIF)
    monterCadre()
    expect(bas()).toBe('16px')
  })

  for (const largeur of [375, 768])
    it(`à ${largeur} px : au-dessus du bouton Fixy, là où s'ouvre sa fenêtre`, () => {
      feuillesALargeur(largeur)
      monterCadre()
      expect(bas()).toBe('74px')
      // Bouton Fixy à 22 px du bas, 44 px de haut (cibles tactiles sous 769 px), fenêtre de Fixy à 74 px du bas.
      const fixy = readFileSync(FIXY, 'utf8')
      expect(fixy).toContain('bottom: 22,')
      expect(fixy).toContain('bottom: 74,')
      expect(74).toBeGreaterThanOrEqual(22 + 44 + 8)
    })

  for (const largeur of [769, 1440])
    it(`à ${largeur} px : rien ne change`, () => {
      feuillesALargeur(largeur)
      monterCadre()
      expect(bas()).toBe('24px')
    })
})

describe('en-tête de panneau coincé à côté de son contrôle', () => {
  /** Sélecteur de aj-correctifs.css : enfant de .panel-head qui n'est ni le pictogramme ni le bloc de droite. */
  const ENFANT_TITRE = 'div:not(.h-ico):not(.right)'
  const BLOC_TITRE = `.panel-head>${ENFANT_TITRE}`
  const blocTitre = (entete: Element) => getComputedStyle(entete.querySelector(`:scope>${ENFANT_TITRE}`) as Element)
  /** Les deux en-têtes du constat : sélecteur de l'avis d'appel, bouton des comptes bancaires. */
  const monterPanneaux = () =>
    render(
      <div id="aj-root" lang="fr">
        <Panel
          title="Avis d’appel par copropriétaire"
          sub="Identités, positions et comptes (D2) du syndicat"
          icon="coin"
          right={
            <select className="btn ghost sm" aria-label="Appel">
              <option>Appel au 01/10/2026</option>
            </select>
          }
        />
        <Panel
          title="Comptes bancaires du mandat"
          sub="Choix du cabinet, remplaçable mandat par mandat"
          icon="bank"
          right={
            <button type="button" className="btn gold sm">
              Nouveau compte
            </button>
          }
        />
      </div>,
    )
  const entetes = () => Array.from(document.querySelectorAll('.panel-head'))

  it('le sélecteur du bloc du titre désigne bien le bloc qui porte le titre, dans les deux en-têtes', () => {
    monterPanneaux()
    expect(entetes()).toHaveLength(2)
    for (const entete of entetes()) {
      const blocs = entete.parentElement?.querySelectorAll(BLOC_TITRE) ?? []
      expect(blocs).toHaveLength(1)
      expect(blocs[0].querySelector('h3')).not.toBeNull()
    }
  })

  it('sans le correctif, le titre et le contrôle restent sur la même ligne (constat du 22/11/2026)', () => {
    feuillesALargeur(375, SANS_CORRECTIF)
    monterPanneaux()
    for (const entete of entetes()) expect(getComputedStyle(entete).flexWrap).toBe('nowrap')
  })

  for (const largeur of [375, 768])
    it(`à ${largeur} px : le bloc du titre garde 120 px, sinon les contrôles passent à la ligne, toujours à droite`, () => {
      feuillesALargeur(largeur)
      monterPanneaux()
      for (const entete of entetes()) {
        expect(getComputedStyle(entete).flexWrap).toBe('wrap')
        const bloc = blocTitre(entete)
        expect(bloc.flexGrow).toBe('1')
        expect(bloc.flexBasis).toBe('120px')
        expect(bloc.minWidth).toBe('0px')
        expect(getComputedStyle(entete.querySelector('.right') as Element).marginLeft).toBe('auto')
      }
    })

  for (const largeur of [769, 1440])
    it(`à ${largeur} px : rien ne change`, () => {
      feuillesALargeur(largeur)
      monterPanneaux()
      for (const entete of entetes()) {
        expect(getComputedStyle(entete).flexWrap).toBe('nowrap')
        expect(['', 'auto']).toContain(blocTitre(entete).flexBasis)
      }
    })
})
