import './fuseau-paris'
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComptesBancairesPanel } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/ComptesBancairesPanel'
import { ImportRelevePanel } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/ImportRelevePanel'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { TresorerieModule } from '@/components/administrateur-judiciaire/modules/finances/TresorerieModule'
import { ToastContext, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import { enregistrerCompteBancaire } from '@/lib/administrateur-judiciaire/db/comptes-bancaires'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import type { Banque } from '@/lib/administrateur-judiciaire/db/schema'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'
import type { ComptesBancairesLus } from '@/lib/administrateur-judiciaire/db/use-comptes-bancaires'
import type { CoproprieteVue } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import { feuillesALargeur, retirerFeuilles, STYLES } from './regles-a-largeur'

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

async function monterComptes(actif = true) {
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
        actif,
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

/** Vrai écran « Banque et recouvrement » sur la base de démonstration, avec un relevé importé (une ligne au débit de 512). */
async function monterLignes() {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loaded: false, loading: false })
  await useDonneesStore.getState().loadAll()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
  await enregistrerCompteBancaire('C2', {
    nature: 'courant',
    libelle: 'Compte principal',
    iban: 'FR76 3000 6000 0112 3456 7890 189',
    bic: null,
    etablissement: null,
  })
  await act(async () => {
    render(toast(<TresorerieModule />), { container: racine() })
  })
  await waitFor(() => expect(screen.queryByText('Chargement…')).toBeNull())
  const panneauImport = within(screen.getByRole('heading', { level: 3, name: 'Importer un relevé' }).closest('.panel') as HTMLElement)
  fireEvent.change(panneauImport.getByLabelText('Relevé bancaire'), { target: { value: 'Date;Libellé;Montant\n04/06/2026;VIR SEPA CHARGES T2;1840,00' } })
  fireEvent.click(panneauImport.getByRole('button', { name: /Analyser/ }))
  await act(async () => {
    fireEvent.click(panneauImport.getByRole('button', { name: /^Importer 1 ligne/ }))
  })
  return screen.findByRole('table', { name: 'Lignes de relevé' }, { timeout: 5000 })
}

const montages: [string, () => Promise<HTMLElement> | HTMLElement, string[]][] = [
  ['Comptes bancaires du mandat', monterComptes, ['Nature', 'IBAN', 'Solde', 'Actions']],
  ['Lignes retenues du relevé', monterAnalyse, ['Date', 'Libellé', 'Montant', 'Copropriétaire', 'Imputation proposée']],
  ['Lignes de relevé', monterLignes, ['Date', 'Libellé', 'Montant', 'Sens', 'Compte', 'Lettrage']],
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

  it('« Lignes de relevé » : la liste « Imputer … » reste dans la cellule Lettrage, utilisable', async () => {
    const table = await monterLignes()
    const cellule = within(within(table).getAllByRole('row')[1]).getAllByRole('cell')[5]
    expect(cellule).toHaveAttribute('data-label', 'Lettrage')
    expect(within(cellule).getByRole('combobox', { name: /^Imputer / })).toBeEnabled()
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

describe('fiche d’un compte : détails de présentation (relecture du 27/11/2026)', () => {
  const feuille = () => readFileSync(join(STYLES, 'aj-correctifs.css'), 'utf8')

  it('l’IBAN se coupe sur la fiche (375 px) et reste sur une ligne sur ordinateur (769 px)', async () => {
    for (const [largeur, attendu] of [
      [375, 'normal'],
      [769, 'nowrap'],
    ] as const) {
      cleanup()
      retirerFeuilles()
      feuillesALargeur(largeur)
      const table = await monterComptes()
      const iban = within(table).getByText('FR76 3000 6000 0112 3456 7890 189')
      expect(getComputedStyle(iban).whiteSpace).toBe(attendu)
    }
  })

  it('l’étiquette de chaque valeur est écrite par une règle ::before complète, comptes compris', () => {
    expect(feuille()).toContain(
      '#aj-root .tbl.vfx-fiches tbody td::before,#aj-root table.vfx-comptes.vfx-fiches tbody td::before{content:attr(data-label)',
    )
  })

  it('l’étiquette « Solde » a la police du module (Manrope), pas celle de la cellule à chasse fixe', () => {
    expect(feuille()).toContain('#aj-root table.vfx-comptes.vfx-fiches tbody td::before{font-family:Manrope,system-ui,sans-serif}')
  })

  it('une cellule vide (compte clôturé : pas d’actions) n’affiche pas son étiquette', () => {
    expect(feuille()).toContain('#aj-root table.vfx-comptes.vfx-fiches tbody td:empty::before{display:none}')
  })

  it('compte clôturé : la cellule Actions est bien vide (le :empty de la règle précédente s’y applique)', async () => {
    const table = await monterComptes(false)
    const cellule = within(within(table).getAllByRole('row')[1]).getAllByRole('cell')[3]
    expect(cellule).toBeEmptyDOMElement()
  })

  it('les pastilles de la cellule Nature se calent à droite sur la fiche (375 px), pas sur ordinateur', async () => {
    for (const [largeur, attendu] of [
      [375, 'flex-end'],
      [769, 'normal'],
    ] as const) {
      cleanup()
      retirerFeuilles()
      feuillesALargeur(largeur)
      const table = await monterComptes(false)
      const pastilles = within(table).getByText('Clôturé').closest('.vfx-fiche-pastilles') as HTMLElement
      expect(getComputedStyle(pastilles).justifyContent).toBe(attendu)
    }
  })
})
