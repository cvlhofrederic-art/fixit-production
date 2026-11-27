import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TresorerieModule } from '@/components/administrateur-judiciaire/modules/finances/TresorerieModule'
import { ToastContext, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import { cloturerCompteBancaire, enregistrerCompteBancaire, type SaisieCompteBancaire } from '@/lib/administrateur-judiciaire/db/comptes-bancaires'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { cloturerArreteCompte, ouvrirArreteCompte } from '@/lib/administrateur-judiciaire/db/rapprochements'
import { importerReleveSurCompte } from '@/lib/administrateur-judiciaire/db/releves-bancaires'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Écran « Banque et recouvrement » : solde d'ouverture des comptes bancaires (PR 799, point 2, choix A validé par le
 * référent métier, décision du 26/11/2026). Formulaires « Nouveau compte » et « Modifier » : deux champs facultatifs,
 * « Solde d'ouverture » (montant signé) et « au » (date, pas après aujourd'hui). Le solde affiché du compte et le solde
 * compta de ses arrêtés le reprennent à partir de sa date : l'arrêté d'un compte ouvert avant le premier relevé importé
 * se clôture. Base de démonstration (jour figé au 04/06/2026).
 */

// IBAN de test publiés (exemples déjà utilisés par les tests D-BANQUE) : clés valides, aucun compte réel.
const IBAN_A = 'FR76 3000 6000 0112 3456 7890 189'
const IBAN_B = 'FR14 2004 1010 0505 0001 3M02 606'

const RELEVE = [
  { date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 },
  { date: '2026-05-20', libelle: 'PRLV EAU', montant: -120.5 },
  { date: '2026-06-02', libelle: 'VIR JUIN', montant: 99 },
]

const patienter = () =>
  act(async () => {
    await new Promise((resoudre) => setTimeout(resoudre, 30))
  })

const ajouter = (saisie: Partial<SaisieCompteBancaire> = {}) =>
  enregistrerCompteBancaire('C2', { nature: 'courant', libelle: 'Compte principal', iban: IBAN_A, bic: null, etablissement: null, ...saisie })

beforeEach(async () => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loaded: false, loading: false })
  await useDonneesStore.getState().loadAll()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
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

const panneauComptes = () => screen.getByRole('heading', { level: 3, name: 'Comptes bancaires du mandat' }).closest('.panel') as HTMLElement
const panneauRapprochement = () => screen.getByRole('heading', { level: 3, name: /^Rapprochement/ }).closest('.panel') as HTMLElement
const lignesComptes = () => within(panneauComptes()).queryAllByRole('row').slice(1)
const titresAlertes = () => Array.from(panneauComptes().querySelectorAll('.alert b')).map((titre) => titre.textContent ?? '')
const dialogue = () => within(screen.getByRole('dialog'))
const dernierToast = () => pushCourant.mock.calls.at(-1)?.[0]
const euros = (montant: number) => formatEurosCentimes(montant)

/** Clique et attend le toast qui confirme ou refuse l'écriture, puis la relecture. */
async function cliquerEtAttendre(bouton: HTMLElement) {
  const avant = pushCourant.mock.calls.length
  await act(async () => {
    fireEvent.click(bouton)
  })
  await waitFor(() => expect(pushCourant.mock.calls.length).toBeGreaterThan(avant))
  await patienter()
}

function saisirOuverture(montant: string, au: string) {
  fireEvent.change(dialogue().getByLabelText('Solde d’ouverture'), { target: { value: montant } })
  fireEvent.change(dialogue().getByLabelText('au'), { target: { value: au } })
}
const enregistrer = () => cliquerEtAttendre(dialogue().getByRole('button', { name: 'Enregistrer' }))
const ouvrirModifier = () => fireEvent.click(within(lignesComptes()[0]).getByRole('button', { name: /^Modifier/ }))

describe('Solde d’ouverture : formulaires « Nouveau compte » et « Modifier »', () => {
  it('« Nouveau compte » : deux champs facultatifs, vides ; le compte s’enregistre sans solde d’ouverture', async () => {
    await rendre()
    fireEvent.click(within(panneauComptes()).getByRole('button', { name: /Nouveau compte/ }))
    expect(dialogue().getByLabelText('Solde d’ouverture')).toHaveValue('')
    expect(dialogue().getByLabelText('au')).toHaveValue('')
    expect(dialogue().getByLabelText('au')).toHaveAttribute('type', 'date')
    // Jamais une date après aujourd'hui (jour figé de la démonstration).
    expect(dialogue().getByLabelText('au')).toHaveAttribute('max', '2026-06-04')
    expect(screen.getByRole('dialog').textContent).toContain('Vide : le compte part de zéro ; négatif : découvert.')
    expect(screen.getByRole('dialog').textContent).toContain('Solde au début de ce jour, avant ses mouvements.')
    fireEvent.change(dialogue().getByLabelText('IBAN'), { target: { value: IBAN_A } })
    await enregistrer()
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Compte enregistré' })
    const [ligne] = await ajDb.banques.toArray()
    expect(ligne).not.toHaveProperty('soldeOuvertureCentimes')
    expect(within(lignesComptes()[0]).getByText('—')).toBeInTheDocument()
  })

  it('« Nouveau compte » avec un solde d’ouverture : écrit sur le compte, et le solde affiché n’est plus « — »', async () => {
    await rendre()
    fireEvent.click(within(panneauComptes()).getByRole('button', { name: /Nouveau compte/ }))
    fireEvent.change(dialogue().getByLabelText('IBAN'), { target: { value: IBAN_A } })
    saisirOuverture('1 000,00', '2026-05-01')
    await enregistrer()
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Compte enregistré' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((await ajDb.banques.toArray())[0]).toMatchObject({ soldeOuvertureCentimes: 100_000, soldeOuvertureAu: '2026-05-01' })
    expect(lignesComptes()[0].textContent).toContain(euros(1000))
    expect(panneauComptes().textContent).toContain(
      'Solde par compte : solde d’ouverture saisi sur le compte, plus les lignes de relevé importées sur son sous-compte 512 à partir de la date de ce solde',
    )
  })

  it('« Modifier » : champs préremplis ; découvert accepté ; champs vidés : solde d’ouverture retiré', async () => {
    const { id } = await ajouter({ soldeOuverture: { montant: '1000', au: '2026-05-01' } })
    await importerReleveSurCompte('C2', id, RELEVE)
    await rendre()
    expect(lignesComptes()[0].textContent).toContain(euros(1428.5))
    ouvrirModifier()
    expect(dialogue().getByLabelText('Solde d’ouverture')).toHaveValue('1000,00')
    expect(dialogue().getByLabelText('au')).toHaveValue('2026-05-01')
    saisirOuverture('-200,50', '2026-05-15')
    await enregistrer()
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Compte modifié' })
    expect(await ajDb.banques.get(id)).toMatchObject({ soldeOuvertureCentimes: -20_050, soldeOuvertureAu: '2026-05-15' })
    // −200,50 − 120,50 + 99,00 : le virement du 10/05 est antérieur au solde d'ouverture.
    expect(lignesComptes()[0].textContent).toContain(euros(-222))
    ouvrirModifier()
    expect(dialogue().getByLabelText('Solde d’ouverture')).toHaveValue('-200,50')
    saisirOuverture('', '')
    await enregistrer()
    expect(await ajDb.banques.get(id)).toMatchObject({ soldeOuvertureCentimes: null, soldeOuvertureAu: null })
    expect(lignesComptes()[0].textContent).toContain(euros(428.5))
  })

  it('saisie refusée (date après aujourd’hui, montant sans date, montant illisible) : toast, formulaire ouvert, rien n’est écrit', async () => {
    await rendre()
    fireEvent.click(within(panneauComptes()).getByRole('button', { name: /Nouveau compte/ }))
    fireEvent.change(dialogue().getByLabelText('IBAN'), { target: { value: IBAN_A } })
    saisirOuverture('100', '2026-06-05')
    await enregistrer()
    expect(dernierToast()).toMatchObject({ kind: 'warn', title: 'Enregistrement impossible', desc: "Solde d’ouverture daté du 05/06/2026, après aujourd'hui." })
    saisirOuverture('100', '')
    await enregistrer()
    expect(dernierToast()).toMatchObject({ kind: 'warn', desc: 'Solde d’ouverture : date à saisir (champ « au »), ou vider le montant.' })
    saisirOuverture('cent euros', '2026-05-01')
    await enregistrer()
    expect(dernierToast()).toMatchObject({ kind: 'warn', desc: expect.stringMatching(/Solde d’ouverture illisible/) })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(await ajDb.banques.count()).toBe(0)
  })
})

describe('Solde d’ouverture : solde du compte et avertissements', () => {
  it('lignes de relevé datées avant le solde d’ouverture : avertissement sur le compte, elles n’entrent pas dans son solde', async () => {
    const { id } = await ajouter({ soldeOuverture: { montant: '1000', au: '2026-05-15' } })
    await importerReleveSurCompte('C2', id, RELEVE)
    await rendre()
    // 1 000,00 − 120,50 + 99,00.
    expect(lignesComptes()[0].textContent).toContain(euros(978.5))
    expect(titresAlertes()).toContain('Compte principal : 1 ligne de relevé datée avant le solde d’ouverture du 15/05/2026.')
    expect(panneauComptes().textContent).toContain(
      'Tenue pour déjà comprise dans ce solde, elle n’entre pas dans le solde du compte. Si ce n’est pas le cas, corriger la date ou le montant du solde d’ouverture.',
    )
  })

  it('aucune ligne avant le solde d’ouverture, ou compte sans solde d’ouverture : aucun avertissement', async () => {
    const { id } = await ajouter({ soldeOuverture: { montant: '1000', au: '2026-05-10' } })
    await importerReleveSurCompte('C2', id, RELEVE)
    const autre = await ajouter({ nature: 'fonds_travaux', libelle: 'Fonds de travaux', iban: IBAN_B })
    await importerReleveSurCompte('C2', autre.id, RELEVE)
    await rendre()
    expect(titresAlertes().filter((titre) => titre.includes('avant le solde d’ouverture'))).toEqual([])
  })

  it('compte repris sans solde d’ouverture : solde inconnu signalé ; avec solde d’ouverture : solde affiché, sans rappel « à solder »', async () => {
    const repris = await ajouter({ nature: 'repris_ancien_gestionnaire', libelle: 'Ancien compte', iban: IBAN_B })
    await rendre()
    expect(titresAlertes()).toContain("Compte repris de l'ancien syndic ou administrateur : solde inconnu ici.")
    expect(panneauComptes().textContent).toContain(
      'Le rappel « solder puis clôturer » n’est pas lancé : sans solde d’ouverture saisi, le solde affiché ne reprend pas le solde du compte avant le premier relevé importé.',
    )
    cleanup()
    await enregistrerCompteBancaire(
      'C2',
      { nature: 'repris_ancien_gestionnaire', libelle: 'Ancien compte', iban: IBAN_B, bic: null, etablissement: null, soldeOuverture: { montant: '500', au: '2026-05-01' } },
      { id: repris.id },
    )
    await rendre()
    expect(lignesComptes()[0].textContent).toContain(euros(500))
    expect(titresAlertes()).not.toContain("Compte repris de l'ancien syndic ou administrateur : solde inconnu ici.")
    // Contrôle « compte repris à solder » non réactivé par cette PR.
    expect(panneauComptes().textContent).not.toContain('non soldé')
  })

  it('compte repris au solde d’ouverture saisi, avec un compte courant : « Comptes conformes » jamais sans le bandeau du rappel non lancé', async () => {
    await ajouter()
    await ajouter({ nature: 'repris_ancien_gestionnaire', libelle: 'Ancien compte', iban: IBAN_B, soldeOuverture: { montant: '500', au: '2026-05-01' } })
    await rendre()
    expect(lignesComptes()[1].textContent).toContain(euros(500))
    // Le contrôle « compte repris à solder » ne tourne pas : sans bandeau, « Comptes conformes » couvrirait un compte repris qui garde un solde.
    expect(titresAlertes()).toContain('Comptes conformes au mode appliqué.')
    expect(titresAlertes()).toContain("Compte repris de l'ancien syndic ou administrateur : rappel « solder puis clôturer » non lancé.")
    expect(panneauComptes().textContent).toContain(
      'Le solde d’ouverture est saisi, mais ce rappel ne lit pas encore le solde du compte : un compte repris qui garde un solde n’est pas signalé ici.',
    )
    expect(titresAlertes()).not.toContain("Compte repris de l'ancien syndic ou administrateur : solde inconnu ici.")
  })

  it('compte repris clôturé au solde d’ouverture saisi, ou aucun compte repris : aucun bandeau du rappel', async () => {
    await ajouter({ soldeOuverture: { montant: '500', au: '2026-05-01' } })
    const repris = await ajouter({ nature: 'repris_ancien_gestionnaire', libelle: 'Ancien compte', iban: IBAN_B, soldeOuverture: { montant: '0', au: '2026-05-01' } })
    await cloturerCompteBancaire(repris.id)
    await rendre()
    expect(titresAlertes().filter((titre) => titre.includes('solder puis clôturer') || titre.includes('solde inconnu'))).toEqual([])
  })
})

describe('Solde d’ouverture : rapprochement', () => {
  it('« Nouvel arrêté » : le solde compta montré reprend le solde d’ouverture, et le formulaire le dit', async () => {
    const { id } = await ajouter({ soldeOuverture: { montant: '1000', au: '2026-05-01' } })
    await importerReleveSurCompte('C2', id, RELEVE)
    await rendre()
    fireEvent.click(within(panneauRapprochement()).getByRole('button', { name: /Nouvel arrêté/ }))
    fireEvent.change(dialogue().getByLabelText('Date de l’arrêté'), { target: { value: '2026-05-31' } })
    expect(screen.getByRole('dialog').textContent).toContain('Solde compta du compte au 31/05/2026 : 1 329,50 €')
    expect(screen.getByRole('dialog').textContent).toContain(
      'Solde d’ouverture du 01/05/2026 et lignes de relevé importées sur ce compte depuis cette date, jusqu’à celle de l’arrêté',
    )
    // Arrêté daté avant le solde d'ouverture : celui-ci n'y entre pas, la phrase d'origine reste.
    fireEvent.change(dialogue().getByLabelText('Date de l’arrêté'), { target: { value: '2026-04-30' } })
    expect(screen.getByRole('dialog').textContent).toContain(`Solde compta du sous-compte 512 au 30/04/2026 : ${euros(0)}`)
    expect(screen.getByRole('dialog').textContent).toContain('Lignes de relevé importées sur ce compte jusqu’à cette date')
  })

  it('« Nouvel arrêté » daté du jour même du solde d’ouverture : il y entre, avec les lignes de ce jour, et le formulaire le dit', async () => {
    const { id } = await ajouter({ soldeOuverture: { montant: '1000', au: '2026-05-10' } })
    await importerReleveSurCompte('C2', id, RELEVE)
    await rendre()
    fireEvent.click(within(panneauRapprochement()).getByRole('button', { name: /Nouvel arrêté/ }))
    fireEvent.change(dialogue().getByLabelText('Date de l’arrêté'), { target: { value: '2026-05-10' } })
    // 1 000,00 au début du 10/05, plus le virement de ce jour.
    expect(screen.getByRole('dialog').textContent).toContain('Solde compta du compte au 10/05/2026 : 1 450,00 €')
    expect(screen.getByRole('dialog').textContent).toContain(
      'Solde d’ouverture du 10/05/2026 et lignes de relevé importées sur ce compte depuis cette date, jusqu’à celle de l’arrêté',
    )
    expect(screen.getByRole('dialog').textContent).not.toContain('sous-compte 512')
    // La veille : le solde d'ouverture n'y entre pas, libellé et phrase d'origine.
    fireEvent.change(dialogue().getByLabelText('Date de l’arrêté'), { target: { value: '2026-05-09' } })
    expect(screen.getByRole('dialog').textContent).toContain(`Solde compta du sous-compte 512 au 09/05/2026 : ${euros(0)}`)
    expect(screen.getByRole('dialog').textContent).toContain('Lignes de relevé importées sur ce compte jusqu’à cette date')
  })

  it('arrêté bloqué par un écart faute de solde d’ouverture : celui-ci saisi, l’écart tombe à zéro et l’arrêté se clôture', async () => {
    const { id } = await ajouter()
    await importerReleveSurCompte('C2', id, RELEVE)
    const arrete = await ouvrirArreteCompte(id, { dateArrete: '2026-05-31', soldeBanqueCentimes: 132_950 })
    await rendre()
    expect(panneauRapprochement().textContent).toContain('Solde compta 329,50 €')
    expect(panneauRapprochement().textContent).toContain('Écart 1 000,00 €')
    await cliquerEtAttendre(within(panneauRapprochement()).getByRole('button', { name: 'Clôturer l’arrêté du 31/05/2026' }))
    expect(dernierToast()).toMatchObject({ kind: 'warn', title: 'Clôture refusée' })

    ouvrirModifier()
    saisirOuverture('1000', '2026-05-01')
    await enregistrer()
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Compte modifié' })
    expect(panneauRapprochement().textContent).toContain('Solde compta 1 329,50 €')
    expect(panneauRapprochement().textContent).toContain(`Écart ${euros(0)}`)
    await cliquerEtAttendre(within(panneauRapprochement()).getByRole('button', { name: 'Clôturer l’arrêté du 31/05/2026' }))
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Arrêté clôturé' })
    expect(await ajDb.rapprochements.get(arrete.id)).toMatchObject({ statut: 'Clôturé', soldeComptaCentimes: 132_950 })
  })

  it('arrêté clôturé qui couvre la date du solde d’ouverture : « Modifier » refuse de le changer, déclôturer d’abord', async () => {
    const { id } = await ajouter({ soldeOuverture: { montant: '1000', au: '2026-05-01' } })
    await importerReleveSurCompte('C2', id, RELEVE)
    const arrete = await ouvrirArreteCompte(id, { dateArrete: '2026-05-31', soldeBanqueCentimes: 132_950 })
    await cloturerArreteCompte(arrete.id)
    await rendre()
    ouvrirModifier()
    saisirOuverture('900', '2026-05-01')
    await enregistrer()
    expect(dernierToast()).toMatchObject({
      kind: 'warn',
      title: 'Enregistrement impossible',
      desc: 'Solde d’ouverture non modifié : l’arrêté clôturé du 31/05/2026 couvre sa date. Déclôturer d’abord cet arrêté.',
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(await ajDb.banques.get(id)).toMatchObject({ soldeOuvertureCentimes: 100_000 })
    expect(panneauRapprochement().textContent).toContain('Solde compta 1 329,50 €')
  })
})
