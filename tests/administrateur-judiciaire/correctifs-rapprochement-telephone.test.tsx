import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ImportRelevePanel } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/ImportRelevePanel'
import { RapprochementPanel } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/RapprochementPanel'
import { ToastContext, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import type { CoproprieteVue } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import { feuillesALargeur, retirerFeuilles, STYLES } from './regles-a-largeur'

/**
 * Écran « Banque et recouvrement » sur téléphone et boutons inactifs (aj-correctifs.css), décision du 26/11/2026 sur la
 * page de validation de la PR 799 :
 * - rb-c01 A : un bouton inactif de l'écran est grisé, curseur « interdit ». La règle .btn:disabled du site (PR 823) couvre
 *   les boutons de l'écran : ce test le garde (« Importer N lignes », « Nouvel arrêté »), sans code de plus ;
 * - rb-c04 A : sur téléphone, « Relevés lus » et « Arrêtés du compte » passent en une fiche par ligne (classe vfx-fiches,
 *   étiquette de chaque valeur dans data-label), les valeurs les unes sous les autres ;
 * - rb-c06 A : sur téléphone, le bouton « Importer N lignes » passe sous la phrase, en entier.
 * Feuilles chargées « à une largeur donnée », dans l'ordre du layout (regles-a-largeur.ts) ; jsdom ne calcule pas la mise
 * en page, qui se vérifie dans Chrome (sondes de la PR).
 */

const SANS_CORRECTIF = ['aj.css', 'aj-selecteur-copro.css']
const correctifs = () => readFileSync(join(STYLES, 'aj-correctifs.css'), 'utf8')

afterEach(() => {
  cleanup()
  retirerFeuilles()
  document.body.innerHTML = ''
})

const COPRO = { id: 'C2', code: 'CV', nom: 'Le Clos des Vignes' } as unknown as CoproprieteVue

function rendreSansCompte() {
  const push = vi.fn<ToastApi['push']>(() => undefined)
  const racine = document.createElement('div')
  racine.id = 'aj-root'
  document.body.appendChild(racine)
  render(
    <ToastContext.Provider value={{ push, dismiss: vi.fn() }}>
      <RapprochementPanel comptes={[]} etatComptes="lu" ecrituresBanque={[]} />
      <ImportRelevePanel copro={COPRO} comptes={[]} etatComptes="lu" personnes={[]} lignesBanque={[]} />
    </ToastContext.Provider>,
    { container: racine },
  )
  fireEvent.change(screen.getByLabelText('Relevé bancaire'), { target: { value: 'Date;Libellé;Montant\n04/06/2026;VIR SEPA;10,00' } })
  fireEvent.click(screen.getByRole('button', { name: /Analyser/ }))
}

describe('rb-c01 A : les boutons inactifs de l’écran se distinguent des boutons actifs', () => {
  it('sans le correctif, ils gardent l’aspect actif (constat du 20/11/2026)', () => {
    feuillesALargeur(1440, SANS_CORRECTIF)
    rendreSansCompte()
    const importer = screen.getByRole('button', { name: /^Importer 1 ligne/ })
    expect(importer).toBeDisabled()
    expect(getComputedStyle(importer).cursor).toBe('pointer')
  })

  for (const largeur of [1440, 375])
    it(`à ${largeur} px : « Importer N lignes » et « Nouvel arrêté » inactifs sont atténués, curseur « interdit » ; « Exemple » reste actif`, () => {
      feuillesALargeur(largeur)
      rendreSansCompte()
      for (const bouton of [screen.getByRole('button', { name: /^Importer 1 ligne/ }), screen.getByRole('button', { name: /Nouvel arrêté/ })]) {
        expect(bouton).toBeDisabled()
        expect(getComputedStyle(bouton).opacity).toBe('0.45')
        expect(getComputedStyle(bouton).cursor).toBe('not-allowed')
      }
      const exemple = screen.getByRole('button', { name: 'Exemple' })
      expect(exemple).toBeEnabled()
      expect(getComputedStyle(exemple).cursor).toBe('pointer')
    })
})

/** Tableau d'une fiche par ligne, mêmes classes que « Arrêtés du compte » et « Relevés lus ». */
function monterTableau(): { table: HTMLElement; entete: HTMLElement; ligne: HTMLElement; cellule: HTMLElement; premiere: HTMLElement } {
  document.body.innerHTML = `<div id="aj-root"><div class="tbl-wrap"><table class="tbl vfx-fiches" aria-label="Arrêtés du compte">
    <thead><tr><th>Date</th><th>Solde banque</th></tr></thead>
    <tbody><tr><td class="num-cell" data-label="Date">31/05/2026</td><td class="num-cell" data-label="Solde banque" style="text-align:right">329,50 €</td></tr></tbody>
  </table></div></div>`
  const requete = (selecteur: string) => document.querySelector(selecteur) as HTMLElement
  return { table: requete('table'), entete: requete('thead'), ligne: requete('tbody tr'), premiere: requete('tbody td:first-child'), cellule: requete('tbody td:last-child') }
}

describe('rb-c04 A : une fiche par relevé ou par arrêté sur téléphone', () => {
  it('sans le correctif : un tableau de 720 px qui défile, première colonne collée (constat du 20/11/2026)', () => {
    feuillesALargeur(375, SANS_CORRECTIF)
    const { table, cellule } = monterTableau()
    expect(getComputedStyle(table).minWidth).toBe('720px')
    expect(getComputedStyle(cellule).display).toBe('table-cell')
  })

  it('à 375 et 768 px : lignes en blocs, valeurs les unes sous les autres, étiquette avant chaque valeur, en-têtes seulement pour les lecteurs d’écran', () => {
    for (const largeur of [375, 768]) {
      retirerFeuilles()
      feuillesALargeur(largeur)
      const { table, entete, ligne, cellule, premiere } = monterTableau()
      expect(getComputedStyle(table).minWidth).toBe('0px')
      expect(getComputedStyle(ligne).display).toBe('block')
      expect(getComputedStyle(cellule).display).toBe('flex')
      expect(getComputedStyle(cellule).justifyContent).toBe('space-between')
      expect(getComputedStyle(premiere).position).toBe('static')
      expect(getComputedStyle(entete).position).toBe('absolute')
      expect(getComputedStyle(entete).width).toBe('1px')
    }
    expect(correctifs()).toContain('#aj-root .tbl.vfx-fiches tbody td::before,')
    expect(correctifs()).toContain('{content:attr(data-label)')
  })

  it('à 769 px et au-dessus : le tableau reste un tableau', () => {
    for (const largeur of [769, 1440]) {
      retirerFeuilles()
      feuillesALargeur(largeur)
      const { table, entete, ligne, cellule } = monterTableau()
      expect(getComputedStyle(table).minWidth).not.toBe('0px')
      expect(getComputedStyle(entete).position).not.toBe('absolute')
      expect(getComputedStyle(ligne).display).not.toBe('block')
      expect(getComputedStyle(cellule).display).toBe('table-cell')
    }
  })
})

describe('rb-c06 A : « Importer N lignes » sous la phrase, en entier, sur téléphone', () => {
  async function analyserCsv() {
    const push = vi.fn<ToastApi['push']>(() => undefined)
    const racine = document.createElement('div')
    racine.id = 'aj-root'
    document.body.appendChild(racine)
    await act(async () => {
      render(
        <ToastContext.Provider value={{ push, dismiss: vi.fn() }}>
          <ImportRelevePanel copro={COPRO} comptes={[]} etatComptes="lu" personnes={[]} lignesBanque={[]} />
        </ToastContext.Provider>,
        { container: racine },
      )
    })
    fireEvent.change(screen.getByLabelText('Relevé bancaire'), { target: { value: 'Date;Libellé;Montant\n04/06/2026;VIR SEPA;10,00' } })
    fireEvent.click(screen.getByRole('button', { name: /Analyser/ }))
    const bouton = screen.getByRole('button', { name: /^Importer 1 ligne/ })
    return { bloc: bouton.parentElement as HTMLElement, bouton, phrase: bouton.nextElementSibling as HTMLElement }
  }

  for (const largeur of [375, 768])
    it(`à ${largeur} px : en colonne, phrase au-dessus, bouton à sa largeur naturelle`, async () => {
      feuillesALargeur(largeur)
      const { bloc, bouton, phrase } = await analyserCsv()
      expect(getComputedStyle(bloc).flexDirection).toBe('column')
      expect(getComputedStyle(bloc).alignItems).toBe('flex-start')
      expect(getComputedStyle(phrase).order).toBe('-1')
      expect(getComputedStyle(bouton).flexShrink).toBe('0')
    })

  for (const largeur of [769, 1440])
    it(`à ${largeur} px : sur une ligne, bouton puis phrase, centrés`, async () => {
      feuillesALargeur(largeur)
      const { bloc, bouton, phrase } = await analyserCsv()
      expect(getComputedStyle(bloc).flexDirection).not.toBe('column')
      expect(getComputedStyle(bloc).alignItems).toBe('center')
      expect(getComputedStyle(phrase).order).not.toBe('-1')
      expect(getComputedStyle(bouton).flexShrink).not.toBe('0')
    })
})
