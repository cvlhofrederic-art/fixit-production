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
 * - Titre de la barre du haut coupé (« Appels de f… ») sous 641 px, puis entre 641 et 1023 px (téléphone à l'horizontale,
 *   tablette ; décision du 26/11/2026).
 * - Quatre indicateurs empilés à 375 px.
 * - Ombre de la barre latérale fermée au bord gauche (mise en page tiroir, jusqu'à 1024 px).
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
/**
 * Valeur de la dernière déclaration d'une propriété pour ce sélecteur exact, seul ou dans une liste, dans l'ordre des
 * feuilles chargées : la cascade d'un navigateur quand les règles ont la même spécificité. getComputedStyle ne convient
 * pas ici : jsdom donne à une liste de sélecteurs la spécificité la plus forte de la liste (« #aj-root .topbar .btn,
 * #aj-root .topbar .vfx-role, … .crumb.vfx-date-topbar » de aj-selecteur-copro.css), là où un navigateur prend celle du
 * sélecteur qui correspond. Limite : ne voit ni une règle plus spécifique écrite autrement, ni un !important ; la mise
 * en page du rôle a été mesurée dans Chrome avec les vraies feuilles.
 */
function derniereDeclaration(selecteur: string, propriete: string): string {
  let valeur = ''
  for (const feuille of Array.from(document.styleSheets))
    for (const regle of Array.from(feuille.cssRules))
      if (regle instanceof CSSStyleRule && regle.selectorText.split(',').some((s) => s.trim() === selecteur)) {
        const v = regle.style.getPropertyValue(propriete)
        if (v) valeur = v
      }
  return valeur
}
const sansEspaces = (valeur: string) => valeur.replaceAll(/\s+/g, '')

/**
 * Cadre du module, mêmes classes que Shell.tsx, DemoBanner.tsx, toast.tsx et FixyLauncher.tsx. `chargement` : base pas
 * encore lue en données réelles, le sélecteur de copropriété n'est pas affiché (SelecteurCoproGlobal rend null).
 */
function monterCadre(menuOuvert = false, chargement = false): void {
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
          ${chargement ? '' : '<div class="vfx-selecteur-copro"></div>'}
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
      // toute la largeur : sa propre ligne même pendant le chargement, quand le sélecteur de copropriété n'est pas encore là
      expect(derniereDeclaration('#aj-root .topbar .vfx-role', 'flex-basis')).toBe('100%')
      titreSurDeuxLignes()
    })

  for (const largeur of [481, 640])
    it(`à ${largeur} px : le rôle reste sur la ligne du titre, qui tient sur deux lignes au plus`, () => {
      feuillesALargeur(largeur)
      monterCadre()
      expect(style('.topbar .vfx-role').order).toBe('0')
      expect(derniereDeclaration('#aj-root .topbar .vfx-role', 'flex-basis')).toBe('auto')
      titreSurDeuxLignes()
    })

  for (const largeur of [641, 1023, 1024, 1440])
    it(`à ${largeur} px : le rôle reste sur la ligne du titre`, () => {
      feuillesALargeur(largeur)
      monterCadre()
      expect(style('.topbar .vfx-role').order).toBe('0')
      expect(derniereDeclaration('#aj-root .topbar .vfx-role', 'flex-basis')).toBe('auto')
      if (largeur === 641) expect(style('.topbar .crumb-mobile b').whiteSpace).toBe('nowrap')
    })

  it('sans le correctif, pendant le chargement de la base, le séparateur partage la ligne du titre (relecture du 25/11/2026)', () => {
    feuillesALargeur(375, SANS_CORRECTIF)
    monterCadre(false, true)
    expect(style('.topbar .spacer').display).not.toBe('none')
  })

  for (const largeur of [375, 480, 640])
    it(`à ${largeur} px, pendant le chargement de la base : le séparateur ne prend pas la moitié de la ligne du titre`, () => {
      feuillesALargeur(largeur)
      monterCadre(false, true)
      expect(style('.topbar .spacer').display).toBe('none')
    })

  for (const largeur of [641, 900, 1023])
    it(`à ${largeur} px, pendant le chargement de la base : le séparateur est masqué, il ne prend pas la moitié de la ligne du titre (décision du 26/11/2026)`, () => {
      feuillesALargeur(largeur)
      monterCadre(false, true)
      expect(style('.topbar .spacer').display).toBe('none')
    })

  for (const largeur of [1024, 1440])
    it(`à ${largeur} px, pendant le chargement de la base : le séparateur reste (barre sur une ligne)`, () => {
      feuillesALargeur(largeur)
      monterCadre(false, true)
      expect(style('.topbar .spacer').display).not.toBe('none')
    })
})

describe('titre coupé entre 641 et 1023 px : le sélecteur de copropriété sur sa propre ligne (décision du 26/11/2026)', () => {
  const copro = '#aj-root .topbar .vfx-selecteur-copro'
  const vide = '#aj-root .topbar .vfx-selecteur-copro__vide'
  const spacer = '#aj-root .topbar .vfx-selecteur-copro+.spacer'
  const spacerVide = '#aj-root .topbar .vfx-selecteur-copro__vide+.spacer'

  it('sans le correctif, le sélecteur partage la ligne du titre à 667 px (constat du 26/11/2026)', () => {
    feuillesALargeur(667, SANS_CORRECTIF)
    monterCadre()
    expect(derniereDeclaration('#aj-root .topbar', 'flex-wrap')).toBe('')
    expect(style('.topbar .vfx-selecteur-copro').order).not.toBe('10')
    expect(derniereDeclaration(spacer, 'display')).toBe('none')
  })

  for (const largeur of [641, 667, 768, 900, 1023])
    it(`à ${largeur} px : le sélecteur (ou le message de base vide) passe sur sa propre ligne, le titre pousse le rôle à droite`, () => {
      feuillesALargeur(largeur)
      monterCadre()
      expect(derniereDeclaration('#aj-root .topbar', 'flex-wrap')).toBe('wrap')
      expect(style('.topbar .vfx-selecteur-copro').order).toBe('10')
      for (const s of [copro, vide]) {
        expect(derniereDeclaration(s, 'order')).toBe('10')
        expect(derniereDeclaration(s, 'flex')).toBe('1 1 100%')
        expect(derniereDeclaration(s, 'max-width')).toBe('none')
      }
      // Derrière le sélecteur, le séparateur est masqué par aj-selecteur-copro.css (déjà avant ce correctif) ; pendant le
      // chargement, sans sélecteur, c'est ce correctif qui le masque (bloc « pendant le chargement » plus bas).
      expect(style('.topbar .spacer').display).toBe('none')
      expect(derniereDeclaration(spacerVide, 'display')).toBe('none')
      // Le rôle reste sur la ligne du titre.
      expect(style('.topbar .vfx-role').order).toBe('0')
    })

  it('à 640 px (portrait) : règle de aj-selecteur-copro.css, séparateur masqué derrière le sélecteur', () => {
    feuillesALargeur(640)
    monterCadre()
    expect(derniereDeclaration('#aj-root .topbar', 'flex-wrap')).toBe('wrap')
    expect(derniereDeclaration(spacer, 'display')).toBe('none')
  })

  for (const largeur of [1024, 1440])
    it(`à ${largeur} px : rien ne change (sélecteur sur la ligne du titre)`, () => {
      feuillesALargeur(largeur)
      monterCadre()
      expect(derniereDeclaration('#aj-root .topbar', 'flex-wrap')).toBe('')
      expect(style('.topbar .vfx-selecteur-copro').order).not.toBe('10')
      expect(derniereDeclaration(copro, 'max-width')).toBe('')
      expect(derniereDeclaration(spacer, 'display')).toBe('none')
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

  for (const largeur of [375, 1024])
    it(`sans le correctif, à ${largeur} px, la barre fermée garde son ombre (constats du 22/11 et du 26/11/2026)`, () => {
      feuillesALargeur(largeur, SANS_CORRECTIF)
      monterCadre()
      expect(style('aside.sidebar').boxShadow).toBe(OMBRE)
    })

  for (const largeur of [375, 1023, 1024])
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
    expect(blocs.map((bloc) => bloc.media.mediaText)).toEqual(['(prefers-reduced-motion: reduce) and (max-width: 1024px)'])
    expect(sansEspaces(blocs[0].cssRules[0].cssText)).toBe('#aj-rootaside.sidebar:not(.is-open){transition-delay:0s;}')
  })

  for (const largeur of [1025, 1440])
    it(`à ${largeur} px (mise en page ordinateur) : rien ne change`, () => {
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
