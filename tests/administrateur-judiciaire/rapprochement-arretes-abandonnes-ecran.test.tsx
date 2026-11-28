import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TresorerieModule } from '@/components/administrateur-judiciaire/modules/finances/TresorerieModule'
import { eurosArrete } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/arretes-vue'
import { ToastContext, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import { enregistrerCompteBancaire } from '@/lib/administrateur-judiciaire/db/comptes-bancaires'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import {
  abandonnerArreteCompte,
  cloturerArreteCompte,
  decloturerArreteCompte,
  listerArretes,
  ouvrirArreteCompte,
  refuserImportSurPeriodeArretee,
} from '@/lib/administrateur-judiciaire/db/rapprochements'
import { importerReleveSurCompte } from '@/lib/administrateur-judiciaire/db/releves-bancaires'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Écran « Banque et recouvrement », panneau « Rapprochement » : arrêtés abandonnés (réponse du référent métier du
 * 28/11/2026 aux corrections de la PR 799, point cr-01, choix A).
 * - Un arrêté abandonné est affiché dans « Arrêtés du compte », statut « Abandonné » : la trace reste à l'écran. Il n'est
 *   jamais l'arrêté affiché en haut du panneau et n'entre dans aucun calcul (arrêté en cours, dernier arrêté, solde,
 *   période arrêtée) : seuls sa date et son solde banque saisi sont montrés, sans solde compta ni écart.
 * - Un arrêté clôturé puis déclôturé s'abandonne comme tout arrêté en cours ; la confirmation dit alors qu'il perd sa
 *   période arrêtée.
 * - Quand il ne reste que des arrêtés abandonnés, la phrase du panneau ne dit plus « Aucun arrêté pour ce compte. »
 *   au-dessus d'une liste qui en montre un : elle dit « Aucun arrêté en cours ni clôturé pour ce compte. » (relecture du
 *   28/11/2026 ; libellé à valider par le référent métier).
 * Base de démonstration (date figée au 04/06/2026), comme rapprochement-ecran.test.tsx.
 */

// IBAN de test publié (exemple déjà utilisé par les tests D-BANQUE) : clé valide, aucun compte réel.
const IBAN_A = 'FR76 3000 6000 0112 3456 7890 189'

/** Compte sans aucun arrêté, pas même abandonné. */
const AUCUN_ARRETE = 'Aucun arrêté pour ce compte.'
/** Compte dont il ne reste que des arrêtés abandonnés, affichés dans « Arrêtés du compte ». */
const AUCUN_ARRETE_QUI_COMPTE = 'Aucun arrêté en cours ni clôturé pour ce compte.'

const DEJA_CLOTURE = 'Cet arrêté a déjà été clôturé une fois : il perd sa période arrêtée.'
const CONFIRMATION =
  'L’arrêté reste dans la base, marqué « Abandonné ». Il ne compte plus : ni arrêté en cours, ni solde, ni période arrêtée. ' +
  'Un nouvel arrêté pourra être ouvert sur ce compte. Sans retour depuis cet écran.'

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
  // Solde compta au 30/04 : 0 ; au 31/05 : 329,50 €.
  await importerReleveSurCompte('C2', banqueId, [
    { date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 },
    { date: '2026-05-20', libelle: 'PRLV EAU', montant: -120.5 },
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
}

const panneau = () => screen.getByRole('heading', { level: 3, name: /^Rapprochement/ }).closest('.panel') as HTMLElement
const dansPanneau = () => within(panneau())
const dialogue = () => within(screen.getByRole('dialog'))
const dernierToast = () => pushCourant.mock.calls.at(-1)?.[0]
const tableau = () => dansPanneau().getByRole('table', { name: 'Arrêtés du compte' })
/** Cellules de chaque ligne de « Arrêtés du compte », sans la ligne des en-têtes. */
const lignesListe = () =>
  within(tableau())
    .getAllByRole('row')
    .slice(1)
    .map((ligne) => within(ligne).getAllByRole('cell').map((cellule) => cellule.textContent))

/** Clique et attend le toast qui confirme ou refuse l'écriture, puis la relecture. */
async function cliquerEtAttendre(bouton: HTMLElement) {
  const avant = pushCourant.mock.calls.length
  await act(async () => {
    fireEvent.click(bouton)
  })
  await waitFor(() => expect(pushCourant.mock.calls.length).toBeGreaterThan(avant))
  await patienter()
}

describe('Rapprochement : arrêtés abandonnés affichés dans « Arrêtés du compte » (cr-01 A, réponse du 28/11/2026)', () => {
  it('arrêté abandonné, seul sur le compte : affiché, statut « Abandonné » ; le panneau dit « Aucun arrêté en cours ni clôturé » et « Nouvel arrêté » reste possible', async () => {
    // Faute de frappe dans le solde banque : 400,00 € au lieu de 329,50 €.
    const errone = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 40_000 })
    await abandonnerArreteCompte(errone.id)
    await rendre()
    // Jamais l'arrêté affiché en haut du panneau.
    expect(screen.getByRole('heading', { level: 3, name: 'Rapprochement bancaire' })).toBeInTheDocument()
    // La phrase ne contredit pas la liste, qui montre un arrêté juste en dessous : elle dit ce qui manque.
    expect(dansPanneau().getByText(AUCUN_ARRETE_QUI_COMPTE)).toBeInTheDocument()
    expect(dansPanneau().queryByText(AUCUN_ARRETE)).toBeNull()
    expect(dansPanneau().getByRole('button', { name: /Nouvel arrêté/ })).toBeEnabled()
    expect(dansPanneau().queryByRole('button', { name: /Abandonner|Déclôturer|Clôturer/ })).toBeNull()
    // Dans la liste : sa date, son solde banque saisi, son statut ; ni solde compta ni écart (hors de tout calcul).
    expect(lignesListe()).toEqual([['31/05/2026', eurosArrete(40_000), '—', '—', 'Abandonné']])
    expect(within(tableau()).queryByRole('button')).toBeNull()
  })

  it('abandonné parmi d’autres : rangé à sa date, après l’arrêté de la même date ; arrêté affiché, soldes et clôture inchangés', async () => {
    const premier = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-04-30', soldeBanqueCentimes: 0 })
    await cloturerArreteCompte(premier.id)
    const errone = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 40_000 })
    await abandonnerArreteCompte(errone.id)
    await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 32_950 })
    await rendre()
    // L'arrêté affiché est l'arrêté en cours, avec son écart : l'arrêté abandonné, de même date, n'y change rien.
    expect(screen.getByRole('heading', { level: 3, name: 'Rapprochement au 31/05/2026' })).toBeInTheDocument()
    expect(dansPanneau().queryByText(/^Aucun arrêté/)).toBeNull()
    expect(panneau().textContent).toContain(`Solde banque ${eurosArrete(32_950)}`)
    expect(panneau().textContent).toContain(`Écart ${eurosArrete(0)}`)
    expect(lignesListe()).toEqual([
      ['31/05/2026', eurosArrete(32_950), eurosArrete(32_950), eurosArrete(0), 'En cours'],
      ['31/05/2026', eurosArrete(40_000), '—', '—', 'Abandonné'],
      ['30/04/2026', eurosArrete(0), eurosArrete(0), eurosArrete(0), 'Clôturé'],
    ])
    // Étiquettes des fiches sur téléphone (rb-c04 A), sur la ligne abandonnée comme sur les autres.
    const abandonnee = within(tableau()).getAllByRole('row')[2]
    expect(within(abandonnee).getAllByRole('cell').map((cellule) => cellule.getAttribute('data-label'))).toEqual([
      'Date',
      'Solde banque',
      'Solde compta',
      'Écart',
      'Statut',
    ])
    // La clôture se fait à l'équilibre de l'arrêté en cours, sans égard pour l'arrêté abandonné.
    await cliquerEtAttendre(dansPanneau().getByRole('button', { name: 'Clôturer l’arrêté du 31/05/2026' }))
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Arrêté clôturé' })
    expect(lignesListe().map((cellules) => cellules.at(-1))).toEqual(['Clôturé', 'Abandonné', 'Clôturé'])
    // Période arrêtée : celle du dernier arrêté clôturé, comme sans l'arrêté abandonné.
    await expect(refuserImportSurPeriodeArretee(banqueId, ['2026-06-01'])).resolves.toBeUndefined()
    await expect(refuserImportSurPeriodeArretee(banqueId, ['2026-05-31'])).rejects.toThrow(/au plus tard du 31\/05\/2026/)
  })

  it('abandon à l’écran : l’arrêté passe aussitôt dans la liste, statut « Abandonné »', async () => {
    await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 40_000 })
    await rendre()
    expect(dansPanneau().queryByRole('table', { name: 'Arrêtés du compte' })).toBeNull()
    fireEvent.click(dansPanneau().getByRole('button', { name: 'Abandonner l’arrêté du 31/05/2026' }))
    await cliquerEtAttendre(dialogue().getByRole('button', { name: 'Abandonner l’arrêté' }))
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Arrêté abandonné' })
    expect(lignesListe()).toEqual([['31/05/2026', eurosArrete(40_000), '—', '—', 'Abandonné']])
    expect(dansPanneau().getByText(AUCUN_ARRETE_QUI_COMPTE)).toBeInTheDocument()
    expect(dansPanneau().queryByText(AUCUN_ARRETE)).toBeNull()
  })
})

describe('Rapprochement : abandon d’un arrêté clôturé puis déclôturé (cr-01 A, réponse du 28/11/2026)', () => {
  it('clôturé, déclôturé : « Abandonner l’arrêté » est proposé, la confirmation dit qu’il perd sa période arrêtée ; abandonné, il reste affiché', async () => {
    const arrete = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 32_950 })
    await rendre()
    await cliquerEtAttendre(dansPanneau().getByRole('button', { name: 'Clôturer l’arrêté du 31/05/2026' }))
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Arrêté clôturé' })
    // Clôturé : période arrêtée (rb-04 A), aucun abandon proposé.
    expect(dansPanneau().queryByRole('button', { name: /Abandonner/ })).toBeNull()
    await expect(refuserImportSurPeriodeArretee(banqueId, ['2026-05-15'])).rejects.toThrow(/^Import refusé/)
    await cliquerEtAttendre(dansPanneau().getByRole('button', { name: 'Déclôturer l’arrêté du 31/05/2026' }))
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Arrêté déclôturé' })

    fireEvent.click(dansPanneau().getByRole('button', { name: 'Abandonner l’arrêté du 31/05/2026' }))
    const texte = screen.getByRole('dialog').textContent ?? ''
    expect(texte).toContain(CONFIRMATION)
    expect(texte).toContain(DEJA_CLOTURE)
    expect(dialogue().getAllByText(DEJA_CLOTURE)).toHaveLength(1)
    await cliquerEtAttendre(dialogue().getByRole('button', { name: 'Abandonner l’arrêté' }))
    expect(dernierToast()).toEqual({
      kind: 'success',
      title: 'Arrêté abandonné',
      desc: 'Arrêté au 31/05/2026 : gardé dans la base, marqué « Abandonné ». Un nouvel arrêté peut être ouvert sur ce compte.',
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((await ajDb.rapprochements.get(arrete.id))?.statut).toBe('Abandonné')
    // À l'écran : plus d'arrêté affiché en haut, la trace dans la liste.
    expect(screen.getByRole('heading', { level: 3, name: 'Rapprochement bancaire' })).toBeInTheDocument()
    expect(dansPanneau().getByText(AUCUN_ARRETE_QUI_COMPTE)).toBeInTheDocument()
    expect(lignesListe()).toEqual([['31/05/2026', eurosArrete(32_950), '—', '—', 'Abandonné']])
    // Sa période n'est plus arrêtée : un relevé daté dedans n'est plus refusé, et aucun arrêté ne compte sur le compte.
    await expect(refuserImportSurPeriodeArretee(banqueId, ['2026-05-15'])).resolves.toBeUndefined()
    expect((await listerArretes(banqueId)).arretes).toEqual([])
  })

  it('déclôturé avant l’affichage de l’écran : la confirmation le dit aussi (lu dans le journal d’activité)', async () => {
    const arrete = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 32_950 })
    await cloturerArreteCompte(arrete.id)
    await decloturerArreteCompte(arrete.id)
    await rendre()
    fireEvent.click(dansPanneau().getByRole('button', { name: 'Abandonner l’arrêté du 31/05/2026' }))
    expect(screen.getByRole('dialog').textContent).toContain(DEJA_CLOTURE)
  })

  it('arrêté jamais clôturé : la confirmation garde son texte, sans cette phrase', async () => {
    // Un arrêté plus ancien, clôturé puis déclôturé puis abandonné, ne compte pas pour l'arrêté en cours.
    const ancien = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-04-30', soldeBanqueCentimes: 0 })
    await cloturerArreteCompte(ancien.id)
    await decloturerArreteCompte(ancien.id)
    await abandonnerArreteCompte(ancien.id)
    await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 40_000 })
    await rendre()
    fireEvent.click(dansPanneau().getByRole('button', { name: 'Abandonner l’arrêté du 31/05/2026' }))
    const texte = screen.getByRole('dialog').textContent ?? ''
    expect(texte).toContain(CONFIRMATION)
    expect(texte).not.toContain('déjà été clôturé')
    expect(texte).not.toContain('perd sa période arrêtée')
  })
})
