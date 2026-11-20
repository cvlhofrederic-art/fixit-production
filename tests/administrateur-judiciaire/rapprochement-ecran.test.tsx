import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TresorerieModule } from '@/components/administrateur-judiciaire/modules/finances/TresorerieModule'
import { ToastContext, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import { enregistrerCompteBancaire } from '@/lib/administrateur-judiciaire/db/comptes-bancaires'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { cloturerArreteCompte, ouvrirArreteCompte } from '@/lib/administrateur-judiciaire/db/rapprochements'
import { importerReleveSurCompte } from '@/lib/administrateur-judiciaire/db/releves-bancaires'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { AUJOURDHUI_ISO, CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Écran « Banque et recouvrement », panneau « Rapprochement » (maquette du 27/10/2026, MaquetteRapprochementPanel) :
 * « Nouvel arrêté » réel (formulaire, absent de la maquette, validé le 20/11/2026), enregistré dans la table locale
 * « rapprochements » ; clôture refusée hors équilibre, clôture à l'équilibre, déclôture du dernier arrêté. Base de
 * démonstration (date figée au 04/06/2026), qui s'écrit comme le reste de l'écran.
 */

// IBAN de test publiés (exemples déjà utilisés par les tests D-BANQUE) : clés valides, aucun compte réel.
const IBAN_A = 'FR76 3000 6000 0112 3456 7890 189'
const IBAN_B = 'FR14 2004 1010 0505 0001 3M02 606'

const patienter = () =>
  act(async () => {
    await new Promise((resoudre) => setTimeout(resoudre, 30))
  })

let banqueId: string

beforeEach(async () => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loaded: false, loading: false })
  await useDonneesStore.getState().loadAll()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
  banqueId = (await enregistrerCompteBancaire('C2', { nature: 'courant', libelle: 'Compte principal', iban: IBAN_A, bic: null, etablissement: null })).id
  await importerReleveSurCompte('C2', banqueId, [
    { date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 },
    { date: '2026-05-20', libelle: 'PRLV EAU', montant: -120.5 },
    { date: '2026-06-02', libelle: 'VIR JUIN', montant: 99 },
  ])
})

afterEach(() => cleanup())

let pushCourant: ReturnType<typeof vi.fn<ToastApi['push']>>

async function rendre() {
  pushCourant = vi.fn<ToastApi['push']>(() => undefined)
  await act(async () => {
    render(
      <ToastContext.Provider value={{ push: pushCourant, dismiss: vi.fn() }}>
        <TresorerieModule />
      </ToastContext.Provider>,
    )
  })
  await patienter()
  await waitFor(() => expect(screen.queryByText('Chargement…')).toBeNull())
  return { push: pushCourant }
}

const panneau = () => screen.getByRole('heading', { level: 3, name: /^Rapprochement/ }).closest('.panel') as HTMLElement
const dansPanneau = () => within(panneau())
const dialogue = () => within(screen.getByRole('dialog'))
const dernierToast = () => pushCourant.mock.calls.at(-1)?.[0]

/** Clique et attend le toast qui confirme ou refuse l'écriture, puis la relecture. */
async function cliquerEtAttendre(bouton: HTMLElement) {
  const avant = pushCourant.mock.calls.length
  await act(async () => {
    fireEvent.click(bouton)
  })
  await waitFor(() => expect(pushCourant.mock.calls.length).toBeGreaterThan(avant))
  await patienter()
}

function saisirArrete(date: string, soldeBanque: string) {
  fireEvent.click(dansPanneau().getByRole('button', { name: /Nouvel arrêté/ }))
  fireEvent.change(dialogue().getByLabelText('Date de l’arrêté'), { target: { value: date } })
  fireEvent.change(dialogue().getByLabelText('Solde banque'), { target: { value: soldeBanque } })
}

describe('Rapprochement : panneau et « Nouvel arrêté »', () => {
  it('entre « Comptes bancaires du mandat » et « Importer un relevé », comme la maquette ; sans arrêté', async () => {
    await rendre()
    const titres = screen.getAllByRole('heading', { level: 3 }).map((titre) => titre.textContent)
    expect(titres.slice(0, 3)).toEqual(['Comptes bancaires du mandat', 'Rapprochement bancaire', 'Importer un relevé'])
    expect(dansPanneau().getByLabelText('Compte rapproché')).toHaveDisplayValue('Compte principal · FR76 3000 6000 0112 3456 7890 189')
    expect(dansPanneau().getByText('Aucun arrêté pour ce compte.')).toBeInTheDocument()
    expect(dansPanneau().getByRole('button', { name: /Nouvel arrêté/ })).toBeEnabled()
  })

  it('« Nouvel arrêté » : date du jour proposée, solde compta du sous-compte à la date ; enregistré et affiché en cours', async () => {
    await rendre()
    fireEvent.click(dansPanneau().getByRole('button', { name: /Nouvel arrêté/ }))
    expect(dialogue().getByLabelText('Date de l’arrêté')).toHaveValue(AUJOURDHUI_ISO)
    expect(screen.getByRole('dialog').textContent).toContain(`Solde compta du sous-compte 512 au 04/06/2026 : ${formatEurosCentimes(428.5)}`)
    fireEvent.change(dialogue().getByLabelText('Date de l’arrêté'), { target: { value: '2026-05-31' } })
    expect(screen.getByRole('dialog').textContent).toContain(`Solde compta du sous-compte 512 au 31/05/2026 : ${formatEurosCentimes(329.5)}`)
    fireEvent.change(dialogue().getByLabelText('Solde banque'), { target: { value: '329,50' } })
    await cliquerEtAttendre(dialogue().getByRole('button', { name: 'Enregistrer' }))
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Arrêté ouvert' })
    expect(screen.queryByRole('dialog')).toBeNull()
    const lignes = await ajDb.rapprochements.toArray()
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({ bancaireId: banqueId, dateArrete: '2026-05-31', soldeBanqueCentimes: 32_950, soldeComptaCentimes: 32_950 })
    expect(screen.getByRole('heading', { level: 3, name: 'Rapprochement au 31/05/2026' })).toBeInTheDocument()
    expect(dansPanneau().getByText('En cours')).toBeInTheDocument()
    expect(panneau().textContent).toContain(`Solde banque ${formatEurosCentimes(329.5)}`)
    expect(panneau().textContent).toContain(`Écart ${formatEurosCentimes(0)}`)
    // Un arrêté en cours : « Clôturer » remplace « Nouvel arrêté » (un seul arrêté en cours par compte).
    expect(dansPanneau().queryByRole('button', { name: /Nouvel arrêté/ })).toBeNull()
    expect(dansPanneau().getByRole('button', { name: 'Clôturer l’arrêté du 31/05/2026' })).toBeEnabled()
  })

  it('saisie à corriger (date après aujourd’hui, solde illisible) : toast, formulaire ouvert, rien n’est écrit', async () => {
    await rendre()
    saisirArrete('2026-06-05', '10')
    await cliquerEtAttendre(dialogue().getByRole('button', { name: 'Enregistrer' }))
    expect(dernierToast()).toEqual({ kind: 'warn', title: 'Saisie à corriger', desc: "Arrêté daté du 05/06/2026, après aujourd'hui." })
    fireEvent.change(dialogue().getByLabelText('Date de l’arrêté'), { target: { value: '2026-05-31' } })
    fireEvent.change(dialogue().getByLabelText('Solde banque'), { target: { value: 'abc' } })
    await cliquerEtAttendre(dialogue().getByRole('button', { name: 'Enregistrer' }))
    expect(dernierToast()).toMatchObject({ kind: 'warn', title: 'Saisie à corriger', desc: expect.stringMatching(/^Solde banque illisible/) })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(await ajDb.rapprochements.count()).toBe(0)
  })

  it('refus du domaine (date non postérieure au dernier arrêté) : toast, formulaire ouvert', async () => {
    const premier = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 32_950 })
    await cloturerArreteCompte(premier.id)
    await rendre()
    saisirArrete('2026-05-31', '329,50')
    await cliquerEtAttendre(dialogue().getByRole('button', { name: 'Enregistrer' }))
    expect(dernierToast()).toEqual({
      kind: 'warn',
      title: 'Ouverture refusée',
      desc: "Date d'arrêté non postérieure au dernier arrêté du compte (2026-05-31).",
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(await ajDb.rapprochements.count()).toBe(1)
  })

  it('aucun compte actif : message, « Nouvel arrêté » inactif', async () => {
    await ajDb.banques.clear()
    await rendre()
    expect(dansPanneau().getByText('Aucun compte bancaire actif : enregistrer d’abord le compte dans « Comptes bancaires du mandat ».')).toBeInTheDocument()
    expect(dansPanneau().getByRole('button', { name: /Nouvel arrêté/ })).toBeDisabled()
  })

  it('arrêté illisible écrit hors de l’écran : bandeau, et ni « Nouvel arrêté » ni « Clôturer » (refusés tant qu’il reste)', async () => {
    const illisible = {
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-01T08:00:00.000Z',
      createdBy: null,
      updatedBy: null,
      bancaireId: banqueId,
      statut: 'En cours' as const,
    }
    await ajDb.rapprochements.add({ id: 'arrete-externe', ...illisible })
    await rendre()
    expect(panneau().textContent).toContain('1 arrêté de la base non affiché')
    expect(dansPanneau().getByRole('button', { name: /Nouvel arrêté/ })).toBeDisabled()
    cleanup()
    await ajDb.rapprochements.clear()
    await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 32_950 })
    await ajDb.rapprochements.add({ id: 'arrete-externe', ...illisible })
    await rendre()
    expect(dansPanneau().getByRole('button', { name: 'Clôturer l’arrêté du 31/05/2026' })).toBeDisabled()
  })
})

describe('Rapprochement : clôture et déclôture', () => {
  it('« Clôturer » hors équilibre : refusé par toast, écart en euros (règle du domaine), l’arrêté reste en cours', async () => {
    await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 40_000 })
    await rendre()
    expect(panneau().textContent).toContain(`Écart ${formatEurosCentimes(70.5)}`)
    await cliquerEtAttendre(dansPanneau().getByRole('button', { name: 'Clôturer l’arrêté du 31/05/2026' }))
    expect(dernierToast()).toEqual({
      kind: 'warn',
      title: 'Clôture refusée',
      desc: `Arrêté non équilibré : écart de ${formatEurosCentimes(70.5)}. Clôture possible seulement à l’équilibre.`,
    })
    expect((await ajDb.rapprochements.toArray())[0].statut).toBe('En cours')
    expect(dansPanneau().getByText('En cours')).toBeInTheDocument()
  })

  it('à l’équilibre : clôturé, puis déclôturé (dernier arrêté du compte)', async () => {
    await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 32_950 })
    await rendre()
    await cliquerEtAttendre(dansPanneau().getByRole('button', { name: 'Clôturer l’arrêté du 31/05/2026' }))
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Arrêté clôturé' })
    expect(dansPanneau().getByText('Clôturé')).toBeInTheDocument()
    expect(dansPanneau().getByRole('button', { name: /Nouvel arrêté/ })).toBeEnabled()
    await cliquerEtAttendre(dansPanneau().getByRole('button', { name: 'Déclôturer l’arrêté du 31/05/2026' }))
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Arrêté déclôturé' })
    expect((await ajDb.rapprochements.toArray())[0].statut).toBe('En cours')
    expect(dansPanneau().getByText('En cours')).toBeInTheDocument()
  })

  it('plusieurs arrêtés : liste « Arrêtés du compte » ; autre compte choisi : ses propres arrêtés', async () => {
    const premier = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-04-30', soldeBanqueCentimes: 0 })
    await cloturerArreteCompte(premier.id)
    await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 32_950 })
    const autre = await enregistrerCompteBancaire('C2', { nature: 'fonds_travaux', libelle: 'Fonds de travaux', iban: IBAN_B, bic: null, etablissement: null })
    await ouvrirArreteCompte(autre.id, { dateArrete: '2026-03-31', soldeBanqueCentimes: 0 })
    await rendre()
    const liste = within(dansPanneau().getByRole('table', { name: 'Arrêtés du compte' })).getAllByRole('row').slice(1)
    expect(liste.map((ligne) => ligne.textContent?.slice(0, 10))).toEqual(['31/05/2026', '30/04/2026'])
    fireEvent.change(dansPanneau().getByLabelText('Compte rapproché'), { target: { value: autre.id } })
    await waitFor(() => expect(screen.getByRole('heading', { level: 3, name: 'Rapprochement au 31/03/2026' })).toBeInTheDocument())
    expect(dansPanneau().queryByRole('table', { name: 'Arrêtés du compte' })).toBeNull()
  })
})
