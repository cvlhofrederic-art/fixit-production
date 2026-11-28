import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DocumentsGedModule } from '@/components/administrateur-judiciaire/modules/outils-ia/DocumentsGedModule'
import { SaisieFacturesModule } from '@/components/administrateur-judiciaire/modules/outils-ia/SaisieFacturesModule'
import {
  ToastContext,
  ToastProvider,
  type OptionsFormulaire,
  type ToastApi,
} from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Saisie de factures et GED affichées selon la copropriété choisie dans le sélecteur du haut de page : listes filtrées,
 * indicateurs recalculés, copropriété choisie proposée par défaut ; sans copropriété choisie, écran de la démonstration.
 */

/** Base vidée, mode démo, jeu de démonstration inséré et chargé, aucune copropriété choisie. */
beforeEach(async () => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loading: false })
  await useDonneesStore.getState().loadAll()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

const choisir = (code: string | null) => act(() => useSelectionDossier.getState().choisirCopro(code))

const kpi = (lbl: string) => screen.getByText(lbl, { selector: '.lbl' }).previousElementSibling?.textContent

const lignesTableau = () => screen.queryAllByRole('row').slice(1)

const colonne = (index: number) => lignesTableau().map((ligne) => within(ligne).getAllByRole('cell')[index].textContent)

describe('Saisie de factures', () => {
  const FACTURE = {
    fournisseur: 'Atlantic Plomberie',
    siret: '12345678900012',
    numero: 'FAC-2026-090',
    date: '2026-05-30',
    montant_ht: 500,
    tva: 100,
    montant_ttc: 600,
    copropriete_probable: null,
    compte_charge_suggere: '615 — Entretien et petites réparations',
    libelle: 'Débouchage colonne',
  }

  async function monter() {
    await act(async () => {
      render(
        <ToastProvider>
          <SaisieFacturesModule />
        </ToastProvider>,
      )
    })
  }

  async function importer(facture: Record<string, unknown>) {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ facture })))
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Facture fournisseur à importer (PDF, PNG, JPEG ou WebP)'), {
        target: { files: [new File(['%PDF-1.7'], 'facture.pdf', { type: 'application/pdf' })] },
      })
    })
    return screen.findByRole('dialog')
  }

  it('sans copropriété choisie : les 4 factures ; copropriété non reconnue « À préciser »', async () => {
    await monter()
    expect(lignesTableau()).toHaveLength(4)
    expect(kpi('Total factures')).toBe('4')
    const formulaire = await importer(FACTURE)
    expect(within(formulaire).getByLabelText('Copropriété')).toHaveValue('À préciser')
  })

  it('factures de la copropriété choisie ; copropriété choisie proposée quand l’IA n’en reconnaît aucune', async () => {
    useSelectionDossier.setState({ code: 'LM' })
    await monter()
    expect(colonne(0)).toEqual(['FAC-2026-051', 'FAC-2026-044', 'FAC-2026-038'])
    expect(kpi('Total factures')).toBe('3')
    expect(kpi('Validées')).toBe('2')

    const formulaire = await importer(FACTURE)
    expect(within(formulaire).getByLabelText('Copropriété')).toHaveValue('Résidence Le Méridien')
    await act(async () => {
      fireEvent.click(within(formulaire).getByRole('button', { name: /Importer/ }))
    })
    await waitFor(() => expect(kpi('Total factures')).toBe('4'))
    expect(colonne(0)[0]).toBe('FAC-2026-090')

    choisir('CV')
    expect(colonne(0)).toEqual(['FAC-2026-029'])
  })

  it('la copropriété reconnue par l’IA reste prioritaire ; la facture rejoint la liste de sa copropriété', async () => {
    useSelectionDossier.setState({ code: 'LM' })
    await monter()
    const formulaire = await importer({ ...FACTURE, copropriete_probable: 'Le Clos des Vignes' })
    expect(within(formulaire).getByLabelText('Copropriété')).toHaveValue('Le Clos des Vignes')
    await act(async () => {
      fireEvent.click(within(formulaire).getByRole('button', { name: /Importer/ }))
    })
    expect(kpi('Total factures')).toBe('3')
    choisir('CV')
    expect(colonne(0)).toEqual(['FAC-2026-090', 'FAC-2026-029'])
  })

  it('facture laissée « À préciser » : visible quelle que soit la copropriété choisie', async () => {
    useSelectionDossier.setState({ code: 'TL' })
    await monter()
    const formulaire = await importer(FACTURE)
    fireEvent.change(within(formulaire).getByLabelText('Copropriété'), { target: { value: 'À préciser' } })
    await act(async () => {
      fireEvent.click(within(formulaire).getByRole('button', { name: /Importer/ }))
    })
    expect(colonne(0)).toEqual(['FAC-2026-090'])
    choisir('VM')
    expect(colonne(0)).toEqual(['FAC-2026-090'])
  })

  it('copropriété sans facture : état vide à son nom', async () => {
    useSelectionDossier.setState({ code: 'VM' })
    await monter()
    expect(lignesTableau()).toHaveLength(0)
    expect(screen.getByText('Aucune facture pour Villa Montaigne')).toBeInTheDocument()
    expect(kpi('Total factures')).toBe('0')
  })
})

describe('Documents (GED)', () => {
  function rendre(element: ReactElement) {
    const push = vi.fn<ToastApi['push']>(() => undefined)
    render(<ToastContext.Provider value={{ push, dismiss: vi.fn() }}>{element}</ToastContext.Provider>)
    return { push }
  }

  it('sans copropriété choisie : les 5 documents de l’ensemble des mandats', () => {
    rendre(<DocumentsGedModule />)
    expect(lignesTableau()).toHaveLength(5)
    expect(screen.getByText(/de l'ensemble des mandats/)).toBeInTheDocument()
  })

  it('documents de la copropriété choisie, chapeau et téléversement à son nom', () => {
    useSelectionDossier.setState({ code: 'LM' })
    const { push } = rendre(<DocumentsGedModule />)
    expect(colonne(0)).toEqual(['Ordonnance de désignation', 'Contrat ascenseur'])
    expect(screen.queryByText(/de l'ensemble des mandats/)).toBeNull()
    expect(screen.getByText(/Résidence Le Méridien/, { selector: '.lede' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Téléverser/ }))
    const formulaire = push.mock.calls.at(-1)?.[0] as OptionsFormulaire
    expect(formulaire.fields?.find((champ) => champ.label === 'Copropriété')?.value).toBe('Résidence Le Méridien')

    choisir('VM')
    expect(colonne(0)).toEqual(['État daté'])
  })
})
