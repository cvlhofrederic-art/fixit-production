import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComptesBancairesPanel } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/ComptesBancairesPanel'
import { ImportRelevePanel } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/ImportRelevePanel'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { ToastContext, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import type { Banque } from '@/lib/administrateur-judiciaire/db/schema'
import type { ComptesBancairesLus } from '@/lib/administrateur-judiciaire/db/use-comptes-bancaires'
import type { CoproprieteVue } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import { feuillesALargeur, retirerFeuilles } from './regles-a-largeur'

/**
 * Tableaux déjà en ligne sur téléphone (PR de suite de la 799, décision du 26/11/2026, points c05 B et c06) : « Comptes
 * bancaires du mandat », « Lignes de relevé » et le tableau de l'analyse d'un relevé passent, sous 769 px, en une fiche
 * par ligne (classe vfx-fiches, étiquette de chaque valeur dans data-label, rôles ARIA de tableau conservés), comme
 * « Relevés lus » et « Arrêtés du compte ». Au-dessus de 768 px, rien ne change. Feuilles chargées à une largeur donnée ;
 * jsdom ne calcule pas la mise en page, qui se vérifie dans Chrome (sondes de la PR).
 */

afterEach(() => {
  cleanup()
  retirerFeuilles()
  document.body.innerHTML = ''
})

const COPRO = { id: 'C2', code: 'CV', nom: 'Le Clos des Vignes', mandatId: null, fondement: '' } as unknown as CoproprieteVue

function racine(): HTMLElement {
  const noeud = document.createElement('div')
  noeud.id = 'aj-root'
  document.body.appendChild(noeud)
  return noeud
}

const toast = (enfants: ReactNode) => (
  <ToastContext.Provider value={{ push: vi.fn<ToastApi['push']>(() => undefined), dismiss: vi.fn() }}>{enfants}</ToastContext.Provider>
)

async function monterComptes() {
  const lus: ComptesBancairesLus = {
    chargement: false,
    erreur: null,
    reglagesCabinet: null,
    relire: () => undefined,
    comptes: [
      {
        id: 'B1',
        coproprieteId: 'C2',
        nature: 'courant',
        libelle: 'Compte courant',
        iban: 'FR76 3000 6000 0112 3456 7890 189',
        bic: 'EXEMFRPP',
        etablissement: 'Banque d’exemple',
        actif: true,
      },
    ] as unknown as Banque[],
  }
  await act(async () => {
    render(toast(<ComptesBancairesPanel copro={COPRO} lus={lus} ecrituresBanque={[]} />), { container: racine() })
  })
  return screen.getByRole('table', { name: 'Comptes bancaires du mandat' })
}

async function monterAnalyse() {
  await act(async () => {
    render(toast(<ImportRelevePanel copro={COPRO} comptes={[]} etatComptes="lu" personnes={[]} lignesBanque={[]} />), {
      container: racine(),
    })
  })
  fireEvent.change(screen.getByLabelText('Relevé bancaire'), { target: { value: 'Date;Libellé;Montant\n04/06/2026;VIR SEPA;10,00' } })
  fireEvent.click(screen.getByRole('button', { name: /Analyser/ }))
  return screen.getByRole('table', { name: 'Lignes retenues du relevé' })
}

function monterLignes() {
  render(
    <div id="aj-root">
      <DataTable
        fiches="Lignes de relevé"
        rowKey="id"
        columns={[
          { h: 'Date', render: () => '04/06/2026' },
          { h: 'Montant', render: () => '10,00 €' },
          { h: 'Lettrage', render: () => <button type="button">Imputer</button> },
        ]}
        rows={[{ id: 'E1' }]}
      />
    </div>,
  )
  return screen.getByRole('table', { name: 'Lignes de relevé' })
}

const montages: [string, () => Promise<HTMLElement> | HTMLElement, string[]][] = [
  ['Comptes bancaires du mandat', monterComptes, ['Nature', 'IBAN', 'Solde', 'Actions']],
  ['Lignes retenues du relevé', monterAnalyse, ['Date', 'Libellé', 'Montant', 'Copropriétaire', 'Imputation proposée']],
  ['Lignes de relevé', monterLignes, ['Date', 'Montant', 'Lettrage']],
]

describe.each(montages)('%s : une fiche par ligne sur téléphone', (_nom, monter, entetes) => {
  it('conserve les rôles ARIA de tableau, une étiquette data-label par cellule (celle de son en-tête)', async () => {
    const table = await monter()
    expect(table).toHaveClass('vfx-fiches')
    expect(table).toHaveAttribute('role', 'table')
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(entetes)
    const ligne = within(table).getAllByRole('row')[1]
    const cellules = within(ligne).getAllByRole('cell')
    expect(cellules.map((td) => td.getAttribute('data-label'))).toEqual(entetes)
  })

  for (const largeur of [375, 768])
    it(`à ${largeur} px : ligne en bloc, cellule en flex, en-têtes réservés aux lecteurs d’écran, tableau sans largeur minimale`, async () => {
      feuillesALargeur(largeur)
      const table = await monter()
      const ligne = within(table).getAllByRole('row')[1]
      const cellule = within(ligne).getAllByRole('cell')[0]
      expect(getComputedStyle(table).minWidth).toBe('0px')
      expect(getComputedStyle(table).display).toBe('block')
      expect(getComputedStyle(ligne).display).toBe('block')
      expect(getComputedStyle(cellule).display).toBe('flex')
      expect(getComputedStyle(table.querySelector('thead') as HTMLElement).position).toBe('absolute')
    })

  for (const largeur of [769, 1440])
    it(`à ${largeur} px : le tableau reste un tableau`, async () => {
      feuillesALargeur(largeur)
      const table = await monter()
      const ligne = within(table).getAllByRole('row')[1]
      const cellule = within(ligne).getAllByRole('cell')[0]
      expect(getComputedStyle(table).display).toBe('table')
      expect(getComputedStyle(table).minWidth).not.toBe('0px')
      expect(getComputedStyle(ligne).display).not.toBe('block')
      expect(getComputedStyle(cellule).display).toBe('table-cell')
      expect(getComputedStyle(table.querySelector('thead') as HTMLElement).position).not.toBe('absolute')
    })
})

describe('« Comptes bancaires du mandat » sur ordinateur : la largeur minimale de 640 px passe de l’écriture en ligne à la feuille', () => {
  for (const largeur of [769, 1440])
    it(`à ${largeur} px : table de 640 px au minimum, bordures fusionnées, corps de 13 px, comme avant`, async () => {
      feuillesALargeur(largeur)
      const table = await monterComptes()
      expect(getComputedStyle(table).minWidth).toBe('640px')
      expect(getComputedStyle(table).borderCollapse).toBe('collapse')
      expect(getComputedStyle(table).fontSize).toBe('13px')
    })
})

describe('les actions d’une ligne restent des boutons utilisables sur la fiche', () => {
  it('« Comptes bancaires » : Modifier et Clôturer dans la cellule Actions, nommés par le compte', async () => {
    const table = await monterComptes()
    const cellule = within(within(table).getAllByRole('row')[1]).getAllByRole('cell')[3]
    expect(cellule).toHaveAttribute('data-label', 'Actions')
    expect(within(cellule).getByRole('button', { name: /^Modifier / })).toBeEnabled()
    expect(within(cellule).getByRole('button', { name: /^Clôturer / })).toBeEnabled()
  })

  it('« Lignes de relevé » : le bouton de la cellule Lettrage reste un bouton', () => {
    const table = monterLignes()
    expect(within(table).getByRole('button', { name: 'Imputer' })).toBeEnabled()
  })
})

describe('DataTable sans fiches : inchangé', () => {
  it('ni classe vfx-fiches, ni rôles ajoutés, ni data-label', () => {
    render(<DataTable columns={[{ h: 'Date', render: () => 'x' }]} rows={[{}]} />)
    const table = screen.getByRole('table')
    expect(table).not.toHaveClass('vfx-fiches')
    expect(table).not.toHaveAttribute('role')
    expect(table.querySelector('td')).not.toHaveAttribute('data-label')
  })
})
