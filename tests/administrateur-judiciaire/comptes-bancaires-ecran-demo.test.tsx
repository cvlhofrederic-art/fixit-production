import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TresorerieModule } from '@/components/administrateur-judiciaire/modules/finances/TresorerieModule'
import { ToastContext, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { validerIban } from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { ajouterCompteBancaireDemo, initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE, MODE_ACTIF } from '@/lib/administrateur-judiciaire/mode'
import { statutEcran } from '@/components/administrateur-judiciaire/modules/registry'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Panneau « Comptes bancaires du mandat » EN DÉMONSTRATION : même comportement que le reste de l'écran « Banque et
 * recouvrement » (statut « reel », hors simulesEnDemonstration) : il lit et écrit la base locale de démonstration.
 * Décision du 26/11/2026 (PR 799, rb-07 A) : le jeu de démonstration a un compte bancaire fictif (Le Clos des Vignes),
 * pour que l'import d'un relevé et « Nouvel arrêté » ne soient pas bloqués faute de compte.
 */

const patienter = () =>
  act(async () => {
    await new Promise((resoudre) => setTimeout(resoudre, 30))
  })

beforeEach(async () => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  await ajouterCompteBancaireDemo()
  useDonneesStore.setState({ loaded: false, loading: false })
  await useDonneesStore.getState().loadAll()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

afterEach(() => cleanup())

async function rendre() {
  const push = vi.fn<ToastApi['push']>(() => undefined)
  await act(async () => {
    render(
      <ToastContext.Provider value={{ push, dismiss: vi.fn() }}>
        <TresorerieModule />
      </ToastContext.Provider>,
    )
  })
  await patienter()
  return { push }
}

const panneau = () =>
  screen.getByRole('heading', { level: 3, name: 'Comptes bancaires du mandat' }).closest('.panel') as HTMLElement
const panneauNomme = (titre: string | RegExp) => within(screen.getByRole('heading', { level: 3, name: titre }).closest('.panel') as HTMLElement)

describe('Comptes bancaires en démonstration', () => {
  it('écran « reel » en démonstration aussi : l’enregistrement n’est pas simulé', () => {
    expect(MODE_ACTIF).toBe('demo')
    expect(statutEcran('tresorerie', 'demo')).toBe('reel')
  })

  it('copropriété de démonstration par défaut (Le Clos des Vignes) : un compte fictif, aucun toast à l’ouverture (rb-07 A)', async () => {
    const { push } = await rendre()
    const lignes = await ajDb.banques.toArray()
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({ coproprieteId: 'C2', nature: 'courant', actif: true })
    expect(within(panneau()).queryByText('Aucun compte enregistré pour cette copropriété.')).toBeNull()
    expect(within(panneau()).getAllByRole('row')).toHaveLength(2)
    expect(push).not.toHaveBeenCalled()
  })

  it('le jeu de démonstration de la maquette (initialiserBaseDemo) reste sans compte : le compte s’ajoute à part, une seule fois', async () => {
    await viderBaseLocale()
    await initialiserBaseDemo()
    expect(await ajDb.banques.count()).toBe(0)
    const journalAvant = await ajDb.activityLog.count()
    await ajouterCompteBancaireDemo()
    await ajouterCompteBancaireDemo()
    expect(await ajDb.banques.toArray()).toHaveLength(1)
    expect(await ajDb.activityLog.count()).toBe(journalAvant + 1)
  })

  it('compte clôturé ou compte créé à la main : le compte de démonstration n’est pas ajouté en double', async () => {
    const [compte] = await ajDb.banques.toArray()
    await ajDb.banques.update(compte.id, { actif: false })
    await ajouterCompteBancaireDemo()
    expect(await ajDb.banques.toArray()).toHaveLength(1)
    await viderBaseLocale()
    await initialiserBaseDemo()
    await ajDb.banques.add({ id: 'B-MAIN', coproprieteId: 'C2', createdAt: '2026-06-04T08:00:00.000Z', updatedAt: '2026-06-04T08:00:00.000Z', createdBy: null, updatedBy: null })
    await ajouterCompteBancaireDemo()
    expect((await ajDb.banques.toArray()).map((banque) => banque.id)).toEqual(['B-MAIN'])
  })

  it('mode données réelles : aucun compte fictif ajouté', async () => {
    await viderBaseLocale()
    localStorage.setItem(CLE_STOCKAGE_MODE, 'reel')
    try {
      await ajouterCompteBancaireDemo()
      expect(await ajDb.banques.count()).toBe(0)
    } finally {
      localStorage.removeItem(CLE_STOCKAGE_MODE)
    }
  })

  it('l’IBAN du compte de démonstration est fictif et valide ; les autres copropriétés n’ont pas de compte', async () => {
    await rendre()
    const lignes = await ajDb.banques.toArray()
    expect(validerIban(lignes[0].iban ?? '')).toBe(true)
    expect(lignes.filter((banque) => banque.coproprieteId !== 'C2')).toEqual([])
  })

  it('démonstration : « Exemple », « Analyser » puis « Importer » ne sont plus bloqués, et « Nouvel arrêté » est actif (rb-07 A)', async () => {
    const { push } = await rendre()
    const importer = panneauNomme('Importer un relevé')
    expect(importer.getByLabelText('Compte bancaire du relevé')).toBeEnabled()
    expect(panneauNomme('Rapprochement bancaire').getByRole('button', { name: /Nouvel arrêté/ })).toBeEnabled()
    fireEvent.click(importer.getByRole('button', { name: 'Exemple' }))
    fireEvent.click(importer.getByRole('button', { name: /Analyser/ }))
    const bouton = importer.getByRole('button', { name: /^Importer 2 lignes/ })
    expect(bouton).toBeEnabled()
    expect(importer.queryByText('Import impossible')).toBeNull()
    await act(async () => {
      fireEvent.click(bouton)
    })
    await waitFor(() => expect(push.mock.calls.at(-1)?.[0]).toMatchObject({ kind: 'success', title: 'Relevé importé' }), { timeout: 5000 })
    await patienter()
    const [compte] = await ajDb.banques.toArray()
    expect((await ajDb.ecritures.toArray()).filter((ecriture) => ecriture.compte === `512-${compte.id}`)).toHaveLength(2)
  })

  it('« Nouveau compte » écrit dans la base locale de démonstration, comme l’import du relevé', async () => {
    const { push } = await rendre()
    fireEvent.click(within(panneau()).getByRole('button', { name: /Nouveau compte/ }))
    const boite = within(screen.getByRole('dialog'))
    fireEvent.change(boite.getByLabelText('IBAN'), { target: { value: 'FR14 2004 1010 0505 0001 3M02 606' } })
    await act(async () => {
      fireEvent.click(boite.getByRole('button', { name: 'Enregistrer' }))
    })
    await patienter()
    const lignes = await ajDb.banques.toArray()
    expect(lignes).toHaveLength(2)
    expect(lignes.every((ligne) => ligne.coproprieteId === 'C2')).toBe(true)
    expect(push.mock.calls.at(-1)?.[0]).toMatchObject({ kind: 'success', title: 'Compte enregistré' })
  })
})
