import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TresorerieModule } from '@/components/administrateur-judiciaire/modules/finances/TresorerieModule'
import { ToastContext, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import { cloturerCompteBancaire, enregistrerCompteBancaire } from '@/lib/administrateur-judiciaire/db/comptes-bancaires'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { abandonnerArreteCompte, cloturerArreteCompte, ouvrirArreteCompte } from '@/lib/administrateur-judiciaire/db/rapprochements'
import { importerReleveSurCompte } from '@/lib/administrateur-judiciaire/db/releves-bancaires'
import { repoEcritures } from '@/lib/administrateur-judiciaire/db/repositories'
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
 * Décision du 26/11/2026 : « Abandonner l'arrêté » pour un arrêté en cours, avec confirmation (rb-01 A) ; solde compta
 * d'un arrêté en cours recalculé à l'instant, enregistré à la clôture puis figé (rb-01 C et rb-03 A).
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

/** Rôles ARIA d'un tableau en fiches : le CSS le passe en blocs sur téléphone, les rôles gardent sa structure. */
function verifierRolesTableau(tableau: HTMLElement) {
  expect(tableau).toHaveAttribute('role', 'table')
  expect(tableau.querySelector('thead')).toHaveAttribute('role', 'rowgroup')
  expect(tableau.querySelector('tbody')).toHaveAttribute('role', 'rowgroup')
  for (const ligne of Array.from(tableau.querySelectorAll('tr'))) expect(ligne).toHaveAttribute('role', 'row')
  for (const th of Array.from(tableau.querySelectorAll('th'))) expect(th).toHaveAttribute('role', 'columnheader')
  for (const td of Array.from(tableau.querySelectorAll('td'))) expect(td).toHaveAttribute('role', 'cell')
  expect(within(tableau).getAllByRole('columnheader')).toHaveLength(5)
  expect(within(tableau).getAllByRole('row')).toHaveLength(3)
}
const dialogue = () => within(screen.getByRole('dialog'))

// Réponse du référent métier du 28/11/2026 (point #857 · 2, choix A) : sous « Compte rapproché » seulement, la phrase dit
// qu'elle vaut pour un nouvel arrêté ; celle de « Importer un relevé » ne change pas.
const AUCUN_COMPTE_ACTIF_RAPPROCHEMENT = 'Aucun compte bancaire actif : pour un nouvel arrêté, enregistrer d’abord le compte dans « Comptes bancaires du mandat ».'
const AUCUN_COMPTE_ACTIF_IMPORT = 'Aucun compte bancaire actif : enregistrer d’abord le compte dans « Comptes bancaires du mandat ».'
const dansImport = () => within(screen.getByRole('heading', { level: 3, name: 'Importer un relevé' }).closest('.panel') as HTMLElement)
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

/**
 * Sortie écrite sur le compte hors de l'import du relevé (autre outil), puis connue de l'écran. Période arrêtée protégée
 * (rb-04 A, décision du 26/11/2026) : l'import d'un relevé daté dans une période clôturée est refusé
 * (periode-arretee.test.ts) ; l'arrêté clôturé reste figé devant une écriture arrivée autrement.
 */
async function ecrireSortieHorsImport(date: Date, libelle: string, montant: number) {
  const [modele] = (await ajDb.ecritures.toArray()).filter((ecriture) => ecriture.compte === `512-${banqueId}`)
  const creee = await repoEcritures.create({ journalId: modele.journalId, date, compte: modele.compte, libelle, montant, sens: 'credit' })
  useDonneesStore.setState((etat) => ({ ecritures: [...etat.ecritures, creee] }))
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
    expect(dansPanneau().getByLabelText('Compte rapproché')).toHaveDisplayValue('Compte principal · …0189')
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

  it('aucun compte actif : message nuancé pour un nouvel arrêté (#857 · 2), « Nouvel arrêté » inactif ; la phrase de l’import ne change pas', async () => {
    await ajDb.banques.clear()
    await rendre()
    expect(dansPanneau().getByText(AUCUN_COMPTE_ACTIF_RAPPROCHEMENT)).toBeInTheDocument()
    expect(dansPanneau().queryByText(AUCUN_COMPTE_ACTIF_IMPORT)).toBeNull()
    expect(dansPanneau().getByRole('button', { name: /Nouvel arrêté/ })).toBeDisabled()
    expect(dansImport().getByText(AUCUN_COMPTE_ACTIF_IMPORT)).toBeInTheDocument()
    expect(dansImport().queryByText(AUCUN_COMPTE_ACTIF_RAPPROCHEMENT)).toBeNull()
  })

  it('un compte actif : aucune des deux phrases « Aucun compte bancaire actif »', async () => {
    await rendre()
    expect(screen.queryByText(/^Aucun compte bancaire actif/)).toBeNull()
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

describe('Rapprochement : « Abandonner l’arrêté » (rb-01 A, décision du 26/11/2026)', () => {
  it('arrêté en cours mal saisi : confirmation, abandon, puis « Nouvel arrêté » de nouveau possible sur le compte', async () => {
    // Faute de frappe dans le solde banque : 400,00 € au lieu de 329,50 €.
    const errone = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 40_000 })
    await rendre()
    const bouton = dansPanneau().getByRole('button', { name: 'Abandonner l’arrêté du 31/05/2026' })
    expect(bouton).toHaveTextContent('Abandonner l’arrêté')
    expect(bouton).toBeEnabled()

    // Confirmation d'abord : « Annuler » n'écrit rien.
    const toastsAvant = pushCourant.mock.calls.length
    fireEvent.click(bouton)
    expect(screen.getByRole('dialog')).toHaveTextContent('Arrêté au 31/05/2026')
    expect(screen.getByRole('dialog')).toHaveTextContent('Compte principal')
    expect(screen.getByRole('dialog')).toHaveTextContent('L’arrêté reste dans la base, marqué « Abandonné »')
    fireEvent.click(dialogue().getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((await ajDb.rapprochements.get(errone.id))?.statut).toBe('En cours')
    expect(pushCourant.mock.calls.length).toBe(toastsAvant)

    fireEvent.click(dansPanneau().getByRole('button', { name: 'Abandonner l’arrêté du 31/05/2026' }))
    await cliquerEtAttendre(dialogue().getByRole('button', { name: 'Abandonner l’arrêté' }))
    expect(dernierToast()).toEqual({
      kind: 'success',
      title: 'Arrêté abandonné',
      desc: 'Arrêté au 31/05/2026 : gardé dans la base, marqué « Abandonné ». Un nouvel arrêté peut être ouvert sur ce compte.',
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    // Gardé en base, jamais effacé.
    expect(await ajDb.rapprochements.get(errone.id)).toMatchObject({ statut: 'Abandonné', soldeBanqueCentimes: 40_000 })
    // Plus d'arrêté en cours : le panneau revient à « aucun arrêté », l'arrêté abandonné n'est pas affiché.
    expect(screen.getByRole('heading', { level: 3, name: 'Rapprochement bancaire' })).toBeInTheDocument()
    expect(dansPanneau().getByText('Aucun arrêté pour ce compte.')).toBeInTheDocument()
    expect(panneau().textContent).not.toContain('Abandonné')
    expect(dansPanneau().queryByRole('button', { name: /Abandonner/ })).toBeNull()

    // Un nouvel arrêté, juste, à la même date.
    saisirArrete('2026-05-31', '329,50')
    await cliquerEtAttendre(dialogue().getByRole('button', { name: 'Enregistrer' }))
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Arrêté ouvert' })
    expect(await ajDb.rapprochements.count()).toBe(2)
    expect(screen.getByRole('heading', { level: 3, name: 'Rapprochement au 31/05/2026' })).toBeInTheDocument()
    expect(panneau().textContent).toContain(`Écart ${formatEurosCentimes(0)}`)
    expect(dansPanneau().getByRole('button', { name: 'Clôturer l’arrêté du 31/05/2026' })).toBeEnabled()
  })

  it('arrêté clôturé : aucun bouton « Abandonner » ; arrêté abandonné : ni affiché, ni compté dans « Arrêtés du compte »', async () => {
    const premier = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-04-30', soldeBanqueCentimes: 0 })
    await cloturerArreteCompte(premier.id)
    const errone = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 40_000 })
    await abandonnerArreteCompte(errone.id)
    await rendre()
    // L'arrêté affiché est le dernier arrêté clôturé, pas l'arrêté abandonné (pourtant plus récent).
    expect(screen.getByRole('heading', { level: 3, name: 'Rapprochement au 30/04/2026' })).toBeInTheDocument()
    expect(dansPanneau().getByText('Clôturé')).toBeInTheDocument()
    expect(dansPanneau().queryByRole('button', { name: /Abandonner/ })).toBeNull()
    expect(dansPanneau().getByRole('button', { name: 'Déclôturer l’arrêté du 30/04/2026' })).toBeEnabled()
    expect(dansPanneau().getByRole('button', { name: /Nouvel arrêté/ })).toBeEnabled()
    // Un seul arrêté compte : la liste (montrée à partir de deux) reste absente.
    expect(dansPanneau().queryByRole('table', { name: 'Arrêtés du compte' })).toBeNull()
    expect(panneau().textContent).not.toContain('Abandonné')
  })

  it('refus de l’écriture (arrêté clôturé entre-temps) : toast, confirmation ouverte, rien n’est écrit', async () => {
    const arrete = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 32_950 })
    await rendre()
    fireEvent.click(dansPanneau().getByRole('button', { name: 'Abandonner l’arrêté du 31/05/2026' }))
    // Clôturé hors de cet écran pendant la confirmation.
    await cloturerArreteCompte(arrete.id)
    await cliquerEtAttendre(dialogue().getByRole('button', { name: 'Abandonner l’arrêté' }))
    expect(dernierToast()).toEqual({
      kind: 'warn',
      title: 'Abandon refusé',
      desc: 'Abandon refusé : seul un arrêté en cours peut être abandonné (arrêté « Clôturé »).',
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect((await ajDb.rapprochements.get(arrete.id))?.statut).toBe('Clôturé')
  })

  it('arrêté illisible sur le compte : « Abandonner » inactif, comme « Clôturer »', async () => {
    await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 32_950 })
    await ajDb.rapprochements.add({
      id: 'arrete-externe',
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-01T08:00:00.000Z',
      createdBy: null,
      updatedBy: null,
      bancaireId: banqueId,
      statut: 'En cours',
    })
    await rendre()
    expect(dansPanneau().getByRole('button', { name: 'Abandonner l’arrêté du 31/05/2026' })).toBeDisabled()
  })
})

describe('Rapprochement : solde compta recalculé jusqu’à la clôture, puis figé (rb-01 C et rb-03 A, décision du 26/11/2026)', () => {
  it('arrêté en cours : solde compta et écart à l’instant ; un relevé arrivé après l’ouverture n’empêche plus la clôture', async () => {
    // Solde banque du relevé au 31/05 : 317,50 €. À l'ouverture, les frais du 25/05 ne sont pas encore importés.
    const arrete = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 31_750 })
    expect(arrete.soldeComptaCentimes).toBe(32_950)
    await rendre()
    expect(panneau().textContent).toContain(`Solde compta ${formatEurosCentimes(329.5)}`)
    expect(panneau().textContent).toContain(`Écart ${formatEurosCentimes(-12)}`)

    // Relevé importé après l'ouverture, daté avant l'arrêté : le panneau suit, sans rien écrire dans l'arrêté.
    await act(async () => {
      await importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-25', libelle: 'FRAIS TENUE DE COMPTE', montant: -12 }])
    })
    await waitFor(() => expect(panneau().textContent).toContain(`Solde compta ${formatEurosCentimes(317.5)}`))
    expect(panneau().textContent).toContain(`Écart ${formatEurosCentimes(0)}`)
    expect((await ajDb.rapprochements.get(arrete.id))?.soldeComptaCentimes).toBe(32_950)

    await cliquerEtAttendre(dansPanneau().getByRole('button', { name: 'Clôturer l’arrêté du 31/05/2026' }))
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Arrêté clôturé' })
    // Le solde recalculé est enregistré avec la clôture.
    expect(await ajDb.rapprochements.get(arrete.id)).toMatchObject({ statut: 'Clôturé', soldeComptaCentimes: 31_750 })

    // Période arrêtée protégée (rb-04 A) : un autre relevé en retard, daté dans la période clôturée, est refusé.
    await expect(importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-26', libelle: 'COMMISSION', montant: -5 }])).rejects.toThrow(
      /^Import refusé : 1 ligne est datée au plus tard du 31\/05\/2026/,
    )
    // Figé : une écriture en retard arrivée hors de l'import ne change plus l'arrêté clôturé, ni en base ni à l'écran.
    await act(async () => {
      await ecrireSortieHorsImport(new Date(2026, 4, 26), 'COMMISSION', 5)
    })
    await patienter()
    expect(dansPanneau().getByText('Clôturé')).toBeInTheDocument()
    expect(panneau().textContent).toContain(`Solde compta ${formatEurosCentimes(317.5)}`)
    expect(panneau().textContent).toContain(`Écart ${formatEurosCentimes(0)}`)
    expect((await ajDb.rapprochements.get(arrete.id))?.soldeComptaCentimes).toBe(31_750)
  })

  it('« Clôturer » hors équilibre sur le solde recalculé : refusé, écart à l’instant en euros', async () => {
    // Équilibré à l'ouverture (329,50 €), puis des frais du 25/05 arrivent : écart de 12,00 €.
    const arrete = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 32_950 })
    await importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-25', libelle: 'FRAIS TENUE DE COMPTE', montant: -12 }])
    await rendre()
    expect(panneau().textContent).toContain(`Écart ${formatEurosCentimes(12)}`)
    await cliquerEtAttendre(dansPanneau().getByRole('button', { name: 'Clôturer l’arrêté du 31/05/2026' }))
    expect(dernierToast()).toEqual({
      kind: 'warn',
      title: 'Clôture refusée',
      desc: `Arrêté non équilibré : écart de ${formatEurosCentimes(12)}. Clôture possible seulement à l’équilibre.`,
    })
    expect(await ajDb.rapprochements.get(arrete.id)).toMatchObject({ statut: 'En cours', soldeComptaCentimes: 32_950 })
  })

  it('« Arrêtés du compte » : la ligne de l’arrêté en cours porte le solde recalculé, celle de l’arrêté clôturé son solde figé', async () => {
    const premier = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-15', soldeBanqueCentimes: 45_000 })
    await cloturerArreteCompte(premier.id)
    await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 32_950 })
    // Deux lignes en retard : l'une dans la période déjà clôturée (écrite hors de l'import, qui la refuse : rb-04 A),
    // l'autre dans l'arrêté en cours.
    await ecrireSortieHorsImport(new Date(2026, 4, 12), 'FRAIS AVANT LE PREMIER ARRETE', 3)
    await importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-25', libelle: 'FRAIS TENUE DE COMPTE', montant: -12 }])
    await rendre()
    const lignes = within(dansPanneau().getByRole('table', { name: 'Arrêtés du compte' })).getAllByRole('row').slice(1)
    const cellules = (ligne: HTMLElement) => within(ligne).getAllByRole('cell').map((cellule) => cellule.textContent)
    expect(cellules(lignes[0])).toEqual(['31/05/2026', formatEurosCentimes(329.5), formatEurosCentimes(314.5), formatEurosCentimes(15), 'En cours'])
    expect(cellules(lignes[1])).toEqual(['15/05/2026', formatEurosCentimes(450), formatEurosCentimes(450), formatEurosCentimes(0), 'Clôturé'])
  })

  it('« Nouvel arrêté » : le formulaire dit que le solde compta est recalculé jusqu’à la clôture, puis figé', async () => {
    await rendre()
    fireEvent.click(dansPanneau().getByRole('button', { name: /Nouvel arrêté/ }))
    const texte = screen.getByRole('dialog').textContent
    expect(texte).toContain('Lignes de relevé importées sur ce compte jusqu’à cette date ; montant recalculé jusqu’à la clôture de l’arrêté, puis figé.')
    expect(texte).not.toContain('figé à l’ouverture')
  })
})

describe('Rapprochement : corrections de la décision du 26/11/2026 (rb-13, rb-c02, rb-c03, rb-c04, rb-c05)', () => {
  it('rb-13 B : les taux « Rapproché auto » et « manuel » sont masqués tant que le pointage n’existe pas ; la phrase reste', async () => {
    await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 32_950 })
    await rendre()
    expect(panneau().textContent).not.toMatch(/Rapproché auto|manuel/)
    expect(panneau().textContent).not.toContain('0 %')
    expect(dansPanneau().getByText(/Aucun élément à pointer/)).toBeInTheDocument()
    // Les soldes et l'écart restent.
    expect(panneau().textContent).toContain('Solde banque')
    expect(panneau().textContent).toContain('Écart')
  })

  it('rb-c02 A : séparateur des milliers visible (espace de pleine largeur) dans le panneau, la liste et le formulaire', async () => {
    // Compta au 31/05 : 329,50 + 1 500,00 = 1 829,50 ; solde banque saisi : 1 958,10.
    await importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-25', libelle: 'VIR GROS MONTANT', montant: 1500 }])
    const premier = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-04-30', soldeBanqueCentimes: 0 })
    await cloturerArreteCompte(premier.id)
    await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 195_810 })
    await rendre()
    const texte = panneau().textContent ?? ''
    expect(texte).toContain('Solde banque 1\u00a0958,10\u00a0€')
    expect(texte).toContain('Solde compta 1\u00a0829,50\u00a0€')
    expect(texte).toContain('Écart 128,60\u00a0€')
    const ligne = within(dansPanneau().getByRole('table', { name: 'Arrêtés du compte' })).getAllByRole('row')[1]
    expect(ligne.textContent).toContain('1\u00a0958,10\u00a0€')
    // Aucune espace fine insécable (U+202F), presque invisible dans la police du panneau.
    expect(texte).not.toContain('\u202f')
    // Formulaire : après l'abandon de l'arrêté en cours.
    fireEvent.click(dansPanneau().getByRole('button', { name: 'Abandonner l’arrêté du 31/05/2026' }))
    await cliquerEtAttendre(dialogue().getByRole('button', { name: 'Abandonner l’arrêté' }))
    fireEvent.click(dansPanneau().getByRole('button', { name: /Nouvel arrêté/ }))
    fireEvent.change(dialogue().getByLabelText('Date de l’arrêté'), { target: { value: '2026-05-31' } })
    expect(screen.getByRole('dialog').textContent).toContain('Solde compta du sous-compte 512 au 31/05/2026 : 1\u00a0829,50\u00a0€')
    expect(screen.getByRole('dialog').textContent).not.toContain('\u202f')
  })

  it('rb-c03 A : un espace avant la ligne du solde compta dans « Nouvel arrêté »', async () => {
    await rendre()
    fireEvent.click(dansPanneau().getByRole('button', { name: /Nouvel arrêté/ }))
    const ligne = screen.getByText(/Solde compta du sous-compte 512/).closest('p') as HTMLElement
    expect(ligne.previousElementSibling?.className).toBe('field-row')
    expect(Number.parseFloat(ligne.style.marginTop)).toBeGreaterThanOrEqual(12)
  })

  it('rb-c04 A : « Arrêtés du compte » prête à passer en fiches sur téléphone (classe et étiquette de chaque valeur)', async () => {
    const premier = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-04-30', soldeBanqueCentimes: 0 })
    await cloturerArreteCompte(premier.id)
    await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 32_950 })
    await rendre()
    const tableau = dansPanneau().getByRole('table', { name: 'Arrêtés du compte' })
    expect(tableau).toHaveClass('vfx-fiches')
    const cellules = within(within(tableau).getAllByRole('row')[1]).getAllByRole('cell')
    expect(cellules.map((cellule) => cellule.getAttribute('data-label'))).toEqual(['Date', 'Solde banque', 'Solde compta', 'Écart', 'Statut'])
  })

  it('rb-c04 A : « Arrêtés du compte » garde ses rôles de tableau pour les lecteurs d’écran (le CSS le passe en blocs sur téléphone)', async () => {
    const premier = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-04-30', soldeBanqueCentimes: 0 })
    await cloturerArreteCompte(premier.id)
    await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 32_950 })
    await rendre()
    const tableau = dansPanneau().getByRole('table', { name: 'Arrêtés du compte' })
    verifierRolesTableau(tableau)
  })

  it('rb-c05 A : liste des comptes à libellé court, le nom du compte et la fin de l’IBAN', async () => {
    const autre = await enregistrerCompteBancaire('C2', { nature: 'fonds_travaux', libelle: 'Fonds de travaux', iban: IBAN_B, bic: null, etablissement: null })
    await enregistrerCompteBancaire('C2', { nature: 'placement', libelle: 'Placement sans IBAN', iban: null, bic: null, etablissement: null })
    await rendre()
    const liste = dansPanneau().getByLabelText('Compte rapproché') as HTMLSelectElement
    // Ordre de la liste : celui de la base (création dans la même milliseconde), donc comparé sans l'ordre.
    expect(Array.from(liste.options).map((option) => option.text).sort()).toEqual(['Compte principal · …0189', 'Fonds de travaux · …2606', 'Placement sans IBAN'])
    expect(Array.from(liste.options).map((option) => option.value)).toContain(autre.id)
  })
})

describe('Rapprochement : comptes clôturés en lecture seule (PR de suite de la 799, point 18, décision du 26/11/2026)', () => {
  const PHRASE = 'Compte clôturé : ses arrêtés sont consultables en lecture seule.'

  /** Compte clôturé aux deux arrêtés clôturés (le plus récent affiché, les deux listés). */
  async function compteCloture() {
    const ferme = await enregistrerCompteBancaire('C2', { nature: 'courant', libelle: 'Ancien compte', iban: IBAN_B, bic: null, etablissement: null })
    const un = await ouvrirArreteCompte(ferme.id, { dateArrete: '2026-03-31', soldeBanqueCentimes: 0 })
    await cloturerArreteCompte(un.id)
    const deux = await ouvrirArreteCompte(ferme.id, { dateArrete: '2026-04-30', soldeBanqueCentimes: 0 })
    await cloturerArreteCompte(deux.id)
    await cloturerCompteBancaire(ferme.id)
    return ferme
  }

  it('proposé après les comptes actifs, marqué « (clôturé) » ; arrêtés affichés sans aucune action ni « Nouvel arrêté »', async () => {
    const ferme = await compteCloture()
    await rendre()
    const liste = dansPanneau().getByLabelText('Compte rapproché') as HTMLSelectElement
    expect(Array.from(liste.options).map((option) => option.text)).toEqual(['Compte principal · …0189', 'Ancien compte · …2606 (clôturé)'])
    // Compte actif d'abord : ses actions restent là, sans la phrase.
    expect(dansPanneau().getByRole('button', { name: /Nouvel arrêté/ })).toBeEnabled()
    expect(dansPanneau().queryByText(PHRASE)).toBeNull()

    fireEvent.change(liste, { target: { value: ferme.id } })
    await waitFor(() => expect(screen.getByRole('heading', { level: 3, name: 'Rapprochement au 30/04/2026' })).toBeInTheDocument())
    expect(dansPanneau().getByText(PHRASE)).toBeInTheDocument()
    // Règle d’équilibre : définition gardée, promesse de clôture masquée (aucune clôture possible sur ce compte).
    expect(panneau().textContent).toContain('Équilibre : solde banque − suspens banque = solde compta − suspens compta.')
    expect(panneau().textContent).not.toContain('Clôture possible seulement à l’équilibre')
    expect(dansPanneau().getAllByText('Clôturé').length).toBeGreaterThan(0)
    const liste2 = within(dansPanneau().getByRole('table', { name: 'Arrêtés du compte' })).getAllByRole('row').slice(1)
    expect(liste2.map((ligne) => ligne.textContent?.slice(0, 10))).toEqual(['30/04/2026', '31/03/2026'])
    for (const nom of [/Nouvel arrêté/, /Clôturer/, /Déclôturer/, /Abandonner/]) expect(dansPanneau().queryByRole('button', { name: nom })).toBeNull()

    // Retour sur un compte actif : actions et absence de la phrase.
    fireEvent.change(liste, { target: { value: banqueId } })
    await waitFor(() => expect(dansPanneau().queryByText(PHRASE)).toBeNull())
    await waitFor(() => expect(dansPanneau().getByRole('button', { name: /Nouvel arrêté/ })).toBeEnabled())
  })

  it('compte actif avec un arrêté en cours : la règle d’équilibre garde sa promesse de clôture', async () => {
    await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 40_000 })
    await rendre()
    await waitFor(() => expect(screen.getByRole('heading', { level: 3, name: 'Rapprochement au 31/05/2026' })).toBeInTheDocument())
    expect(panneau().textContent).toContain('Équilibre : solde banque − suspens banque = solde compta − suspens compta. Clôture possible seulement à l’équilibre.')
  })

  it('aucun compte actif, un compte clôturé : choisi d’office, en lecture seule', async () => {
    await ajDb.banques.clear()
    await compteCloture()
    await rendre()
    expect(dansPanneau().getByLabelText('Compte rapproché')).toHaveDisplayValue('Ancien compte · …2606 (clôturé)')
    expect(dansPanneau().getByText(PHRASE)).toBeInTheDocument()
    expect(dansPanneau().queryByRole('button', { name: /Nouvel arrêté/ })).toBeNull()
    // Réponse du référent métier du 28/11/2026 (point #857 · 2, choix A) : la phrase dit qu'elle vaut pour un nouvel
    // arrêté ; elle ne semble plus dire que le compte affiché n'existe pas. Celle de l'import ne change pas.
    expect(dansPanneau().getByText(AUCUN_COMPTE_ACTIF_RAPPROCHEMENT)).toBeInTheDocument()
    expect(dansPanneau().queryByText(AUCUN_COMPTE_ACTIF_IMPORT)).toBeNull()
    expect(dansImport().getByText(AUCUN_COMPTE_ACTIF_IMPORT)).toBeInTheDocument()
  })

  it('compte clôturé avec un arrêté illisible : l’alerte ne promet pas de reprise des actions (refusées pour toujours)', async () => {
    const ferme = await compteCloture()
    await ajDb.rapprochements.add({
      id: 'arrete-externe-cloture',
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-01T08:00:00.000Z',
      createdBy: null,
      updatedBy: null,
      bancaireId: ferme.id,
      statut: 'En cours' as const,
    })
    await rendre()
    fireEvent.change(dansPanneau().getByLabelText('Compte rapproché'), { target: { value: ferme.id } })
    await waitFor(() => expect(panneau().textContent).toContain('1 arrêté de la base non affiché'))
    expect(panneau().textContent).toContain('à reprendre dans la base locale')
    expect(panneau().textContent).not.toContain('Ni ouverture')
  })

  it('compte clôturé avant le 28/11/2026 avec un arrêté en cours (relevé par la relecture) : affiché, en lecture seule, ni clôture ni abandon', async () => {
    const ferme = await enregistrerCompteBancaire('C2', { nature: 'courant', libelle: 'Ancien compte', iban: IBAN_B, bic: null, etablissement: null })
    await ouvrirArreteCompte(ferme.id, { dateArrete: '2026-05-31', soldeBanqueCentimes: 40_000 })
    // Réponse du référent métier du 28/11/2026 (point #857 · 1, choix A) : la clôture d'un tel compte est désormais
    // refusée ; ce cas ne vient plus que d'un compte clôturé avant cette règle, écrit ici directement dans la base.
    await expect(cloturerCompteBancaire(ferme.id)).rejects.toThrow(/Un arrêté est en cours sur ce compte/)
    await ajDb.banques.update(ferme.id, { actif: false })
    await rendre()
    fireEvent.change(dansPanneau().getByLabelText('Compte rapproché'), { target: { value: ferme.id } })
    await waitFor(() => expect(screen.getByRole('heading', { level: 3, name: 'Rapprochement au 31/05/2026' })).toBeInTheDocument())
    expect(dansPanneau().getByText('En cours')).toBeInTheDocument()
    expect(dansPanneau().getByText(PHRASE)).toBeInTheDocument()
    expect(panneau().textContent).toContain('Équilibre : solde banque')
    expect(panneau().textContent).not.toContain('Clôture possible seulement à l’équilibre')
    for (const nom of [/Nouvel arrêté/, /Clôturer/, /Déclôturer/, /Abandonner/]) expect(dansPanneau().queryByRole('button', { name: nom })).toBeNull()
  })
})
