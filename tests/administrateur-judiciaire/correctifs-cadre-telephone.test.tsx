import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { feuillesALargeur, retirerFeuilles, STYLES } from './regles-a-largeur'

/**
 * Cadre du module sur téléphone (aj-correctifs.css), décision du 22/11/2026 sur la page de validation de l'écran
 * « Appels de fonds », points ap-17 et ap-d09 : défauts déjà sur main, repris dans une PR à part.
 * - Titre de la barre du haut coupé (« Appels de f… ») sous 641 px.
 * - Quatre indicateurs empilés à 375 px.
 * - Ombre de la barre latérale fermée au bord gauche (mise en page tiroir, sous 1024 px).
 * - Bandeau du mode (démonstration / données réelles) au-dessus du voile des fenêtres, à toutes les largeurs.
 * - Messages (toasts) sur le bouton Fixy sous 769 px.
 * - En-tête de l’avis d’appel coincé à côté de son sélecteur sous 769 px.
 *
 * Feuilles chargées « à une largeur donnée », dans l'ordre du layout (regles-a-largeur.ts). Chaque bloc commence par le
 * constat, feuilles du module sans le correctif. jsdom ne calcule pas la mise en page : ces tests vérifient les
 * déclarations qui s'appliquent à chaque largeur ; la mise en page se vérifie dans un navigateur.
 */

const SANS_CORRECTIF = ['aj.css', 'aj-selecteur-copro.css']
const MODULE = join(__dirname, '..', '..', 'components', 'administrateur-judiciaire')
const lireSource = (...chemin: string[]) => readFileSync(join(MODULE, ...chemin), 'utf8')

afterEach(() => {
  cleanup()
  retirerFeuilles()
  document.body.innerHTML = ''
})

const style = (selecteur: string) => getComputedStyle(document.querySelector(selecteur) as Element)
const sansEspaces = (valeur: string) => valeur.replaceAll(/\s+/g, '')

/** Cadre du module, mêmes classes que Shell.tsx, DemoBanner.tsx, toast.tsx et FixyLauncher.tsx. */
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
    <button type="button" class="btn gold" aria-label="Ouvrir Fixy">Fixy</button>
  </div>`
}

describe('titre de la barre du haut coupé sur téléphone', () => {
  const titreSurDeuxLignes = () => {
    const titre = style('.topbar .crumb-mobile b')
    expect(titre.display).toBe('-webkit-box')
    expect(titre.getPropertyValue('-webkit-line-clamp')).toBe('2')
    expect(titre.whiteSpace).toBe('normal')
  }

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
      titreSurDeuxLignes()
    })

  for (const largeur of [481, 640])
    it(`à ${largeur} px : le rôle reste sur la ligne du titre, qui tient sur deux lignes au plus`, () => {
      feuillesALargeur(largeur)
      monterCadre()
      expect(style('.topbar .vfx-role').order).toBe('0')
      titreSurDeuxLignes()
    })

  for (const largeur of [641, 1440])
    it(`à ${largeur} px : rien ne change`, () => {
      feuillesALargeur(largeur)
      monterCadre()
      expect(style('.topbar .vfx-role').order).toBe('0')
      if (largeur === 641) expect(style('.topbar .crumb-mobile b').whiteSpace).toBe('nowrap')
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
  const tailleNombre = () => style('.kpi .num').fontSize
  const monterIndicateurs = () =>
    render(
      <div id="aj-root" lang="fr">
        <Kpis items={quatre} />
      </div>,
    )

  it('sans le correctif, une seule colonne sous 481 px, nombres en 26 px (constat du 22/11/2026)', () => {
    feuillesALargeur(375, SANS_CORRECTIF)
    monterIndicateurs()
    expect(colonnes()).toBe('1fr')
    expect(tailleNombre()).toBe('26px')
  })

  for (const largeur of [334, 375, 480])
    it(`à ${largeur} px : deux colonnes de 150 px au moins, nombres en 21 px pour tenir dans la carte`, () => {
      feuillesALargeur(largeur)
      monterIndicateurs()
      expect(colonnes()).toBe('repeat(auto-fit,minmax(150px,1fr))')
      expect(tailleNombre()).toBe('21px')
    })

  it('à 333 px (une seule colonne) : les nombres gardent 26 px', () => {
    feuillesALargeur(333)
    monterIndicateurs()
    expect(colonnes()).toBe('repeat(auto-fit,minmax(150px,1fr))')
    expect(tailleNombre()).toBe('26px')
  })

  it('à 481 et 1440 px : rien ne change', () => {
    feuillesALargeur(481)
    monterIndicateurs()
    expect(colonnes()).toBe('1fr1fr')
    expect(tailleNombre()).toBe('28px')
    cleanup()
    retirerFeuilles()
    feuillesALargeur(1440)
    monterIndicateurs()
    expect(colonnes()).toBe('repeat(auto-fit,minmax(180px,1fr))')
    expect(tailleNombre()).toBe('36px')
  })
})

describe('ombre de la barre latérale fermée au bord gauche', () => {
  const OMBRE = '4px 0 24px #0b18282e'
  /** Fermeture : le menu glisse (transform) avec son ombre, retirée une fois sorti de l'écran. */
  const FERMETURE = 'transformvar(--dur-slow)var(--ease-out),box-shadow0slinearvar(--dur-slow)'

  it('sans le correctif, la barre fermée garde son ombre sous 1025 px (constat du 22/11/2026)', () => {
    feuillesALargeur(375, SANS_CORRECTIF)
    monterCadre()
    expect(style('aside.sidebar').boxShadow).toBe(OMBRE)
  })

  for (const largeur of [375, 1023])
    it(`à ${largeur} px : plus d'ombre quand le menu est fermé, retirée à la fin du glissement ; le menu ouvert garde la sienne`, () => {
      feuillesALargeur(largeur)
      monterCadre()
      expect(style('aside.sidebar').boxShadow).toBe('none')
      expect(sansEspaces(style('aside.sidebar').transition)).toBe(FERMETURE)
      monterCadre(true)
      expect(style('aside.sidebar').boxShadow).toBe(OMBRE)
      expect(sansEspaces(style('aside.sidebar').transition)).toBe('transformvar(--dur-slow)var(--ease-out)')
    })

  it('mouvements réduits : l’ombre part avec le menu, sans attendre la durée du glissement', () => {
    const brute = document.createElement('style')
    brute.textContent = readFileSync(join(STYLES, 'aj-correctifs.css'), 'utf8')
    document.head.appendChild(brute)
    const blocs = Array.from((brute.sheet as CSSStyleSheet).cssRules).filter(
      (regle): regle is CSSMediaRule => regle instanceof CSSMediaRule && regle.media.mediaText.includes('prefers-reduced-motion'),
    )
    brute.remove()
    expect(blocs.map((bloc) => bloc.media.mediaText)).toEqual(['(prefers-reduced-motion: reduce) and (max-width: 1023px)'])
    expect(sansEspaces(blocs[0].cssRules[0].cssText)).toBe('#aj-rootaside.sidebar:not(.is-open){transition-delay:0s;}')
  })

  for (const largeur of [1024, 1440])
    it(`à ${largeur} px : rien ne change`, () => {
      feuillesALargeur(largeur, SANS_CORRECTIF)
      monterCadre()
      const avant = [style('aside.sidebar').boxShadow, style('aside.sidebar').transition]
      retirerFeuilles()
      feuillesALargeur(largeur)
      expect([style('aside.sidebar').boxShadow, style('aside.sidebar').transition]).toEqual(avant)
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
  const bas = () => parseFloat(style('.vfx-toast-viewport').bottom)
  /** Distance au bas de l'écran d'un élément de FixyLauncher.tsx, lue dans le style du bloc qui suit son repère. */
  const basDansFixy = (repere: RegExp): number => {
    const bloc = new RegExp(`${repere.source}[\\s\\S]*?style=\\{\\{([\\s\\S]*?)\\}\\}`).exec(lireSource('shell', 'FixyLauncher.tsx'))
    expect(bloc, `bloc ${repere.source} introuvable dans FixyLauncher.tsx`).not.toBeNull()
    const valeur = /\bbottom: (\d+),/.exec(bloc?.[1] ?? '')
    expect(valeur, `bottom du bloc ${repere.source}`).not.toBeNull()
    return Number(valeur?.[1])
  }
  const BOUTON = /aria-label=\{ouvert \? 'Fermer Fixy' : 'Ouvrir Fixy'\}/
  const FENETRE = /role="dialog"\s+aria-label="Fixy"/
  /** Haut du bouton Fixy : sa distance au bas de l'écran (FixyLauncher.tsx) plus sa hauteur de cible tactile (aj.css). */
  const hautDuBouton = () => basDansFixy(BOUTON) + parseFloat(style('.btn').minHeight)

  it('sans le correctif, les messages couvrent le bouton Fixy sous 769 px (constat du 22/11/2026)', () => {
    feuillesALargeur(375, SANS_CORRECTIF)
    monterCadre()
    expect(bas()).toBe(16)
    expect(bas()).toBeLessThan(hautDuBouton())
  })

  for (const largeur of [375, 768])
    it(`à ${largeur} px : au-dessus du bouton Fixy, au bas de sa fenêtre`, () => {
      feuillesALargeur(largeur)
      monterCadre()
      expect(hautDuBouton()).toBe(66)
      expect(bas()).toBeGreaterThan(hautDuBouton())
      // Même hauteur que le bas de la fenêtre de Fixy : un message couvre le bas de la fenêtre quand elle est ouverte.
      expect(bas()).toBe(basDansFixy(FENETRE))
    })

  for (const largeur of [769, 1440])
    it(`à ${largeur} px : rien ne change`, () => {
      feuillesALargeur(largeur)
      monterCadre()
      expect(bas()).toBe(24)
    })
})

describe('en-tête de l’avis d’appel coincé à côté de son sélecteur', () => {
  /** Sélecteur de aj-correctifs.css : enfant de l'en-tête qui n'est ni le pictogramme ni le bloc de droite. */
  const ENFANT_TITRE = 'div:not(.h-ico):not(.right)'
  const blocTitre = (entete: Element) => getComputedStyle(entete.querySelector(`:scope>${ENFANT_TITRE}`) as Element)
  /** L'avis d'appel (en-tête à la ligne) et un autre panneau à contrôle, que la décision ne vise pas (inchangé). */
  const monterPanneaux = () =>
    render(
      <div id="aj-root" lang="fr">
        <Panel
          title="Avis d’appel par copropriétaire"
          sub="Identités, positions et comptes (D2) du syndicat"
          icon="coin"
          controlesALaLigne
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

  it('seul l’en-tête qui le demande porte la classe du correctif ; le bloc du titre est bien visé', () => {
    monterPanneaux()
    const [avis, autre] = entetes()
    expect(avis.className).toBe('panel-head vfx-entete-a-la-ligne')
    expect(autre.className).toBe('panel-head')
    const blocs = avis.querySelectorAll(`:scope>${ENFANT_TITRE}`)
    expect(blocs).toHaveLength(1)
    expect(blocs[0].querySelector('h3')).not.toBeNull()
  })

  it('AvisAppelPanel.tsx demande le retour à la ligne de son en-tête', () => {
    // Balise ouvrante du panneau (fins de ligne du poste de travail ou du dépôt).
    const ouverture = /\r?\n {4}<Panel\r?\n([\s\S]*?)\r?\n {4}>\r?\n/.exec(lireSource('modules', 'finances', 'appels', 'AvisAppelPanel.tsx'))
    expect(ouverture?.[1]).toContain('title="Avis d’appel par copropriétaire"')
    expect(ouverture?.[1]).toMatch(/^ {6}controlesALaLigne$/m)
  })

  it('sans le correctif, le titre et le sélecteur restent sur la même ligne (constat du 22/11/2026)', () => {
    feuillesALargeur(375, SANS_CORRECTIF)
    monterPanneaux()
    expect(getComputedStyle(entetes()[0]).flexWrap).toBe('nowrap')
  })

  for (const largeur of [375, 768])
    it(`à ${largeur} px : le bloc du titre garde 120 px, sinon le sélecteur passe à la ligne, toujours à droite`, () => {
      feuillesALargeur(largeur)
      monterPanneaux()
      const [avis, autre] = entetes()
      expect(getComputedStyle(avis).flexWrap).toBe('wrap')
      const bloc = blocTitre(avis)
      expect(bloc.flexGrow).toBe('1')
      expect(bloc.flexBasis).toBe('120px')
      expect(bloc.minWidth).toBe('0px')
      expect(getComputedStyle(avis.querySelector('.right') as Element).marginLeft).toBe('auto')
      // Les autres en-têtes ne sont pas visés par la décision : inchangés.
      expect(getComputedStyle(autre).flexWrap).toBe('nowrap')
      expect(['', 'auto']).toContain(blocTitre(autre).flexBasis)
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
