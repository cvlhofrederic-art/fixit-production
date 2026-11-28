import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { feuillesALargeur, retirerFeuilles } from './regles-a-largeur'

/**
 * En-têtes de panneau coincés et défauts d'affichage déjà en ligne, sur téléphone surtout (aj-correctifs.css, propriété
 * controlesALaLigne de Panel) :
 * - décision du 26/11/2026 sur la page de validation de la PR 834, point ct-01 : l'en-tête « Comptes bancaires du mandat »
 *   (ComptesBancairesPanel.tsx, fichier de la PR 799, fusionnée depuis) passe à la ligne comme celui de l'avis d'appel ;
 * - même décision, point ct-07 : les autres en-têtes coincés nommés (rédaction automatique du dossier du juge, « Relevé
 *   des diligences » des honoraires, tableaux de bord budget et mandats). Pour « État des mandats », la cause est une
 *   grille à deux colonnes sur téléphone, corrigée aussi (choix à valider) ;
 * - décision du 26/11/2026 sur la page de validation de la PR 799, point rb-c07 A (défauts d'affichage déjà en ligne, PR
 *   à part) : première cellule d'en-tête des tableaux restée blanche sous 1025 px ; messages sur le bouton Fixy sur
 *   ordinateur (testé avec les messages du téléphone, correctifs-cadre-telephone.test.tsx).
 * jsdom ne calcule pas la mise en page : ces tests vérifient les déclarations et les propriétés ; la mise en page a été
 * mesurée dans Chrome avant et après (captures de la page de validation).
 */

const MODULE = join(__dirname, '..', '..', 'components', 'administrateur-judiciaire')
const lireSource = (...chemin: string[]) => readFileSync(join(MODULE, ...chemin), 'utf8')

afterEach(() => {
  cleanup()
  retirerFeuilles()
  document.body.innerHTML = ''
})

/** Fichiers .tsx du module, chemins relatifs avec des « / ». */
function fichiersTsx(dossier = MODULE): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) return fichiersTsx(chemin)
    return nom.endsWith('.tsx') ? [relative(MODULE, chemin).split(sep).join('/')] : []
  })
}

/**
 * Balises ouvrantes multilignes de Panel d'un source : propriétés entre « <Panel » et le « > » (ou « /> ») placé à la
 * même indentation, pour ne pas s'arrêter au « > » d'un bouton écrit dans la propriété right. Fins de ligne du poste de
 * travail ou du dépôt.
 */
function ouverturesDePanel(source: string): { proprietes: string; indentation: string }[] {
  return Array.from(source.matchAll(/^( *)<Panel\r?\n([\s\S]*?)\r?\n\1\/?>\r?$/gm), (m) => ({ indentation: m[1], proprietes: m[2] }))
}

/** Titre écrit en texte (title="…") d'une ouverture ; null pour un titre calculé. */
const titreDe = (proprietes: string): string | null => /^ *title="([^"]*)"$/m.exec(proprietes)?.[1] ?? null
const demandeLaLigne = ({ proprietes, indentation }: { proprietes: string; indentation: string }) =>
  new RegExp(`^${indentation}  controlesALaLigne$`, 'm').test(proprietes)

/** En-têtes qui passent à la ligne, par fichier : avis d'appel (PR 834), puis ceux de cette PR. */
const ATTENDUS: readonly [string, string][] = [
  ['modules/finances/appels/AvisAppelPanel.tsx', 'Avis d’appel par copropriétaire'],
  ['modules/finances/tresorerie/ComptesBancairesPanel.tsx', 'Comptes bancaires du mandat'],
  ['modules/mandat/composants/RedactionAutomatiqueJuge.tsx', 'Mode IA · rédaction automatique'],
  ['modules/mandat/HonorairesTaxation.tsx', 'Relevé des diligences'],
  ['modules/mandat/TableauDeBordModule.tsx', 'Suivi budgétaire cumulé — Exercice 2026'],
  ['modules/mandat/TableauDeBordModule.tsx', 'État des mandats'],
]

describe('en-têtes coincés : le contenu de droite passe sous le titre (ct-01, ct-07)', () => {
  for (const [fichier, titre] of ATTENDUS.slice(1))
    it(`${fichier.split('/').at(-1)} : « ${titre} » demande le retour à la ligne`, () => {
      const panneau = ouverturesDePanel(lireSource(...fichier.split('/'))).find(({ proprietes }) => titreDe(proprietes) === titre)
      expect(panneau, `panneau « ${titre} » introuvable`).toBeDefined()
      expect(panneau && demandeLaLigne(panneau)).toBe(true)
    })

  it('aucun autre en-tête du module ne le demande (chaque ajout est soumis avec ses captures)', () => {
    const demandes = fichiersTsx()
      .filter((fichier) => fichier !== 'ui/Panel.tsx')
      .flatMap((fichier) =>
        ouverturesDePanel(lireSource(...fichier.split('/')))
          .filter(demandeLaLigne)
          .map(({ proprietes }) => [fichier, titreDe(proprietes)]),
      )
    const tri = (a: readonly (string | null)[], b: readonly (string | null)[]) => `${a[0]}|${a[1]}`.localeCompare(`${b[0]}|${b[1]}`)
    expect([...demandes].sort(tri)).toEqual([...ATTENDUS].sort(tri))
    // Toute autre écriture de la propriété (sur une ligne, calculée, avec une valeur) échapperait au relevé ci-dessus :
    // le nombre d'occurrences de son nom, fichier par fichier, est celui des en-têtes attendus.
    const occurrences = Object.fromEntries(
      fichiersTsx()
        .filter((fichier) => fichier !== 'ui/Panel.tsx')
        .map((fichier) => [fichier, (lireSource(...fichier.split('/')).match(/controlesALaLigne/g) ?? []).length] as const)
        .filter(([, n]) => n > 0),
    )
    const attendues: Record<string, number> = {}
    for (const [fichier] of ATTENDUS) attendues[fichier] = (attendues[fichier] ?? 0) + 1
    expect(occurrences).toEqual(attendues)
  })
})

describe('tableau de bord : « Échéances prioritaires » et « État des mandats » l’un sous l’autre sur téléphone (ct-07, à valider)', () => {
  /**
   * Cause de l'en-tête coincé d'« État des mandats », relevée dans Chrome à 375 px : la grille qui le place à côté
   * d'« Échéances prioritaires » était écrite en ligne (1fr 1.25fr), sans retour à une colonne ; chaque panneau n'avait
   * qu'environ 160 px. Elle passe dans aj-correctifs.css, identique au-dessus de 768 px, sur une colonne en dessous (entre
   * 769 et 1024 px, chaque panneau garde plus de 400 px).
   */
  const GRILLE = 'vfx-grille-echeances-mandats'
  const monterGrille = () =>
    render(
      <div id="aj-root" lang="fr">
        <div className={GRILLE}>
          <div className="panel" />
          <div className="panel" />
        </div>
      </div>,
    )
  const grille = () => getComputedStyle(document.querySelector(`.${GRILLE}`) as Element)

  it('TableauDeBordModule.tsx : la grille porte la classe et n’a plus de colonnes écrites en ligne', () => {
    const source = lireSource('modules', 'mandat', 'TableauDeBordModule.tsx')
    expect(source).not.toContain("gridTemplateColumns: '1fr 1.25fr'")
    const ouverture = new RegExp(`<div className="${GRILLE}">\\r?\\n\\s*<Panel\\r?\\n\\s*title="Échéances prioritaires"`)
    expect(source).toMatch(ouverture)
  })

  for (const largeur of [769, 1024, 1440])
    it(`à ${largeur} px : deux colonnes, comme avant`, () => {
      feuillesALargeur(largeur)
      monterGrille()
      expect(grille().display).toBe('grid')
      expect(grille().gridTemplateColumns).toBe('1fr 1.25fr')
      expect(grille().gap).toBe('16px')
    })

  for (const largeur of [375, 768])
    it(`à ${largeur} px : une colonne`, () => {
      feuillesALargeur(largeur)
      monterGrille()
      expect(grille().gridTemplateColumns).toBe('1fr')
    })
})

describe('première cellule d’en-tête des tableaux restée blanche sous 1025 px (rb-c07)', () => {
  const SANS_CORRECTIF = ['aj.css', 'aj-selecteur-copro.css']
  /** Tableau du module (DataTable : .tbl-wrap > table.tbl) dans un panneau. */
  const monterTableau = () =>
    render(
      <div id="aj-root" lang="fr">
        <div className="panel">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Nature de la diligence</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>12/03/2026</td>
                  <td>Constitution du dossier</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>,
    )
  const fond = (selecteur: string) => getComputedStyle(document.querySelector(selecteur) as Element).backgroundColor
  const PREMIERE = '.tbl thead th:first-child'
  const SECONDE = '.tbl thead th:nth-child(2)'

  it('sans le correctif, la première cellule est blanche, les autres sur le fond des en-têtes (constat du 20/11/2026)', () => {
    feuillesALargeur(375, SANS_CORRECTIF)
    monterTableau()
    expect(fond(PREMIERE)).toBe('rgb(255, 255, 255)')
    expect(fond(SECONDE)).not.toBe(fond(PREMIERE))
  })

  /**
   * Fond déclaré en dernier pour ce sélecteur exact, seul ou dans une liste, dans l'ordre des feuilles chargées. jsdom ne
   * résout pas var(--paper) (fond calculé « transparent ») : la déclaration dit que la cellule collante reste opaque.
   */
  function fondDeclare(selecteur: string): string {
    let valeur = ''
    for (const feuille of Array.from(document.styleSheets))
      for (const regle of Array.from(feuille.cssRules))
        if (regle instanceof CSSStyleRule && regle.selectorText.split(',').some((s) => s.trim() === selecteur)) {
          const v = regle.style.getPropertyValue('background') || regle.style.getPropertyValue('background-color')
          if (v) valeur = v
        }
    return valeur
  }

  for (const largeur of [375, 768, 1024, 1440])
    it(`à ${largeur} px : même fond que les autres cellules d’en-tête ; la première colonne du corps reste opaque`, () => {
      feuillesALargeur(largeur)
      monterTableau()
      expect(fond(PREMIERE)).toBe(fond(SECONDE))
      // Au-dessus de 1024 px, la première colonne n'est pas collante : aucune règle propre à la première cellule.
      if (largeur > 1024) expect(fondDeclare('#aj-root .tbl thead th:first-child')).toBe('')
      if (largeur <= 1024) {
        // Colonne collante : le fond de la cellule d'en-tête est celui des en-têtes, opaque (pas « transparent »).
        expect(fondDeclare('#aj-root .tbl thead th:first-child')).toBe(fondDeclare('#aj-root .tbl thead th'))
        expect(fondDeclare('#aj-root .tbl thead th')).toBe('var(--paper)')
        // La cellule du corps garde son fond blanc, qui cache ce qui défile dessous.
        expect(fond('.tbl tbody td:first-child')).toBe('rgb(255, 255, 255)')
      }
    })
})
