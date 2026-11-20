import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TresorerieModule } from '@/components/administrateur-judiciaire/modules/finances/TresorerieModule'
import { ToastContext, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import { cloturerCompteBancaire, enregistrerCompteBancaire } from '@/lib/administrateur-judiciaire/db/comptes-bancaires'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Écran « Banque et recouvrement » : l'import d'un relevé fait choisir le compte bancaire du mandat (question 6 validée
 * le 20/11/2026). Les lignes vont au sous-compte 512 de ce compte, le solde s'affiche par compte dans « Comptes
 * bancaires du mandat », et « Lignes de relevé » dit le compte de chaque ligne. Base de démonstration (copropriété par
 * défaut : Le Clos des Vignes, C2), comme le reste de l'écran : l'import y écrit la base locale.
 */

// IBAN de test publiés (exemples déjà utilisés par les tests D-BANQUE) : clés valides, aucun compte réel.
const IBAN_A = 'FR76 3000 6000 0112 3456 7890 189'
const IBAN_B = 'FR14 2004 1010 0505 0001 3M02 606'

const etat = () => useDonneesStore.getState()

const patienter = () =>
  act(async () => {
    await new Promise((resoudre) => setTimeout(resoudre, 30))
  })

beforeEach(async () => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loaded: false, loading: false })
  await etat().loadAll()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

afterEach(() => cleanup())

const ajouterCompte = (libelle: string, iban: string) =>
  enregistrerCompteBancaire('C2', { nature: 'courant', libelle, iban, bic: null, etablissement: null })

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
  await waitFor(() => expect(screen.queryByText('Chargement…')).toBeNull())
  return { push }
}

const panneau = (titre: string | RegExp) => screen.getByRole('heading', { level: 3, name: titre }).closest('.panel') as HTMLElement
const panneauImport = () => within(panneau('Importer un relevé'))
const choixCompte = () => panneauImport().getByLabelText('Compte bancaire du relevé') as HTMLSelectElement
const boutonImporter = () => panneauImport().getByRole('button', { name: /^Importer \d+ ligne/ }) as HTMLButtonElement

function analyser(texte: string) {
  fireEvent.change(panneauImport().getByLabelText('Relevé bancaire'), { target: { value: texte } })
  fireEvent.click(panneauImport().getByRole('button', { name: /Analyser/ }))
}

async function importer(push: ReturnType<typeof vi.fn<ToastApi['push']>>) {
  const avant = push.mock.calls.length
  await act(async () => {
    fireEvent.click(boutonImporter())
  })
  await waitFor(() => expect(push.mock.calls.length).toBeGreaterThan(avant))
  await patienter()
  return push.mock.calls.at(-1)?.[0]
}

const CSV = 'Date;Libellé;Montant\n04/06/2026;VIR SEPA CHARGES T2;1840,00\n05/06/2026;PRLV ELECTRICITE PARTIES COMMUNES;-312,40'

describe('Import du relevé : choix du compte bancaire', () => {
  it('aucun compte actif : liste inactive et motif ; l’analyse reste possible, l’import est bloqué', async () => {
    await rendre()
    expect(choixCompte()).toBeDisabled()
    expect(choixCompte()).toHaveDisplayValue('Aucun compte actif')
    analyser(CSV)
    expect(boutonImporter()).toBeDisabled()
    expect(panneau('Importer un relevé').textContent).toContain(
      'Aucun compte bancaire actif : enregistrer d’abord le compte dans « Comptes bancaires du mandat ».',
    )
    // Motif annoncé avec le résultat de l'analyse (zone aria-live du panneau).
    expect(panneau('Importer un relevé').querySelector('.sr-only[aria-live="polite"]')?.textContent).toBe(
      'Relevé analysé (CSV) : 2 lignes retenues. Import impossible : Aucun compte bancaire actif : enregistrer d’abord le ' +
        'compte dans « Comptes bancaires du mandat ».',
    )
  })

  it('compte clôturé : jamais proposé', async () => {
    const ferme = await ajouterCompte('Ancien compte', IBAN_B)
    await cloturerCompteBancaire(ferme.id)
    await rendre()
    expect(Array.from(choixCompte().options).map((option) => option.text)).toEqual(['Aucun compte actif'])
  })

  it('un seul compte actif : choisi d’office ; les lignes vont à son sous-compte 512, le solde s’affiche par compte', async () => {
    const compte = await ajouterCompte('Compte principal', IBAN_A)
    const { push } = await rendre()
    expect(choixCompte()).toHaveDisplayValue('Compte principal · FR76 3000 6000 0112 3456 7890 189')
    analyser(CSV)
    expect(boutonImporter()).toBeEnabled()
    expect(await importer(push)).toMatchObject({ kind: 'success', title: 'Relevé importé' })
    expect(String(push.mock.calls.at(-1)?.[0].desc)).toContain('sur « Compte principal »')
    const banque = (await ajDb.ecritures.toArray()).filter((ecriture) => ecriture.compte.startsWith('512'))
    expect(banque.map((ecriture) => ecriture.compte)).toEqual([`512-${compte.id}`, `512-${compte.id}`])
    // Solde du sous-compte dans « Comptes bancaires du mandat » : 1 840,00 − 312,40.
    const ligneCompte = within(panneau('Comptes bancaires du mandat')).getAllByRole('row')[1]
    expect(ligneCompte.textContent).toContain(formatEurosCentimes(1527.6))
    // « Lignes de relevé » : le compte de chaque ligne.
    const lignes = within(panneau(/^Lignes de relevé/)).getAllByRole('row').slice(1)
    expect(lignes).toHaveLength(2)
    for (const ligne of lignes) expect(ligne.textContent).toContain('Compte principal')
  })

  it('plusieurs comptes actifs : choix exigé avant l’import ; changer de compte abandonne l’analyse', async () => {
    await ajouterCompte('Compte principal', IBAN_A)
    const second = await ajouterCompte('Compte travaux', IBAN_B)
    const { push } = await rendre()
    expect(choixCompte()).toHaveDisplayValue('Choisir le compte…')
    analyser(CSV)
    expect(boutonImporter()).toBeDisabled()
    expect(panneau('Importer un relevé').textContent).toContain('Choisir le compte bancaire du relevé.')
    fireEvent.change(choixCompte(), { target: { value: second.id } })
    expect(panneauImport().queryByRole('button', { name: /^Importer \d+ ligne/ })).toBeNull()
    fireEvent.click(panneauImport().getByRole('button', { name: /Analyser/ }))
    expect(await importer(push)).toMatchObject({ kind: 'success', title: 'Relevé importé' })
    expect((await ajDb.ecritures.toArray()).filter((ecriture) => ecriture.compte === `512-${second.id}`)).toHaveLength(2)
  })

  it('doublons d’un CSV : lignes du compte choisi et lignes non rattachées ; « Non rattaché » dans « Lignes de relevé »', async () => {
    const premier = await ajouterCompte('Compte principal', IBAN_A)
    const second = await ajouterCompte('Compte travaux', IBAN_B)
    // Ligne importée avant le choix du compte (store, « 512 » seul).
    await etat().importerReleve('C2', [{ date: '2026-06-03', libelle: 'VIR ANCIEN', montant: 10 }])
    await importerSur(premier.id, 'Date;Libellé;Montant\n03/06/2026;VIR ANCIEN;10,00\n04/06/2026;VIR NOUVEAU;20,00')
    const lignes = () => within(panneau(/^Lignes de relevé/)).getAllByRole('row').slice(1)
    expect(lignes().find((ligne) => ligne.textContent?.includes('VIR ANCIEN'))?.textContent).toContain('Non rattaché')
    expect((await ajDb.ecritures.toArray()).filter((ecriture) => ecriture.compte === `512-${premier.id}`).map((e) => e.libelle)).toEqual([
      'VIR NOUVEAU',
    ])
    // Même relevé sur l'autre compte : la ligne du premier compte n'y est pas un doublon, la ligne non rattachée l'est.
    await importerSur(second.id, 'Date;Libellé;Montant\n03/06/2026;VIR ANCIEN;10,00\n04/06/2026;VIR NOUVEAU;20,00')
    expect((await ajDb.ecritures.toArray()).filter((ecriture) => ecriture.compte === `512-${second.id}`).map((e) => e.libelle)).toEqual([
      'VIR NOUVEAU',
    ])
  })
})

/** Rend l'écran (à neuf), choisit le compte, analyse le CSV et l'importe : une ligne doit être écartée comme doublon. */
async function importerSur(banqueId: string, texte: string) {
  cleanup()
  const { push } = await rendre()
  fireEvent.change(choixCompte(), { target: { value: banqueId } })
  analyser(texte)
  expect(panneau('Importer un relevé').textContent).toContain('1 doublon déjà importé, écarté')
  await importer(push)
}
