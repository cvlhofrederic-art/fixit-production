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
 * compta de ses arrêtés le reprennent, avec les lignes datées après son jour : l'arrêté d'un compte ouvert avant le
 * premier relevé importé se clôture. Base de démonstration (jour figé au 04/06/2026).
 * Réponses du référent métier du 28/11/2026 (PR 848) : solde de FIN de journée (point 2, choix B) ; lignes datées de son
 * jour ou d'avant signalées, hors du solde (point 3, choix A) ; solde d'ouverture daté après un arrêté refusé (point 4,
 * choix A) ; arrêté daté avant lui refusé (point 5, choix A) ; ligne « dont ouverture … » sous le solde et nom
 * accessible « Solde d'ouverture au » (point 7, choix A) ; bandeau du solde d'ouverture illisible (point 8, choix A).
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
    expect(screen.getByRole('dialog').textContent).toContain('Solde à la fin de ce jour, ses mouvements compris.')
    expect(screen.getByRole('dialog').textContent).not.toContain('Solde au début de ce jour')
    // Libellé affiché inchangé (« au ») ; nom lu par les lecteurs d'écran : « Solde d'ouverture au » (point 7).
    expect(dialogue().getByLabelText('au')).toHaveAccessibleName('Solde d’ouverture au')
    expect(dialogue().getByLabelText('Solde d’ouverture')).toHaveAccessibleName('Solde d’ouverture')
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
      'Solde par compte : solde d’ouverture saisi sur le compte, plus les lignes de relevé importées sur son sous-compte 512 datées après le jour de ce solde',
    )
  })

  it('tableau des comptes (point 7) : ligne grise « dont ouverture … au … » sous le solde, seulement pour un compte au solde d’ouverture', async () => {
    const { id } = await ajouter({ soldeOuverture: { montant: '1000', au: '2026-05-01' } })
    await importerReleveSurCompte('C2', id, RELEVE)
    const autre = await ajouter({ nature: 'fonds_travaux', libelle: 'Fonds de travaux', iban: IBAN_B })
    await importerReleveSurCompte('C2', autre.id, RELEVE)
    await ajouter({ nature: 'placement', libelle: 'Livret', iban: null, soldeOuverture: { montant: '-200,50', au: '2026-01-31' } })
    await rendre()
    const [principal, fonds, livret] = lignesComptes()
    /** Ligne grise de la cellule « Solde » (troisième colonne) d'une ligne du tableau. */
    const partOuverture = (ligne: HTMLElement) => ligne.querySelector<HTMLElement>('td:nth-child(3) .muted')
    expect(principal.textContent).toContain(euros(1428.5))
    const part = partOuverture(principal)
    // Séparateur des milliers visible : espace insécable ordinaire, comme les montants des arrêtés (décision du
    // 26/11/2026, rb-c02 A) ; l'espace fine du format français ne s'affiche pas dans la police du texte.
    expect(part?.textContent).toBe('dont ouverture 1 000,00 € au 01/05/2026')
    expect(part?.textContent).not.toContain(' ')
    // Même cellule que le solde, sur sa propre ligne.
    expect(part?.closest('td')?.textContent).toContain(euros(1428.5))
    expect(part).toHaveStyle({ display: 'block' })
    expect(fonds.textContent).toContain(euros(428.5))
    expect(fonds.textContent).not.toContain('dont ouverture')
    expect(partOuverture(fonds)).toBeNull()
    // Compte sans ligne importée, à découvert : le solde est le solde d'ouverture, la ligne grise le dit aussi.
    expect(partOuverture(livret)?.textContent).toBe(`dont ouverture ${euros(-200.5)} au 31/01/2026`)
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
    expect(titresAlertes()).toContain('Compte principal : 1 ligne de relevé datée au plus tard du 15/05/2026, date du solde d’ouverture.')
    expect(panneauComptes().textContent).toContain(
      'Tenue pour déjà comprise dans ce solde, elle n’entre pas dans le solde du compte. Si ce n’est pas le cas, corriger la date ou le montant du solde d’ouverture.',
    )
  })

  it('ligne de relevé datée du jour même du solde d’ouverture (fin de journée) : déjà comprise elle aussi, signalée, hors du solde', async () => {
    const { id } = await ajouter({ soldeOuverture: { montant: '1000', au: '2026-05-20' } })
    await importerReleveSurCompte('C2', id, RELEVE)
    await rendre()
    // 1 000,00 + 99,00 : le virement du 10/05 et le prélèvement du 20/05 sont déjà dans le solde d'ouverture.
    expect(lignesComptes()[0].textContent).toContain(euros(1099))
    expect(titresAlertes()).toContain('Compte principal : 2 lignes de relevé datées au plus tard du 20/05/2026, date du solde d’ouverture.')
    expect(panneauComptes().textContent).toContain('Tenues pour déjà comprises dans ce solde, elles n’entrent pas dans le solde du compte.')
  })

  it('toutes les lignes après le jour du solde d’ouverture, ou compte sans solde d’ouverture : aucun avertissement', async () => {
    const { id } = await ajouter({ soldeOuverture: { montant: '1000', au: '2026-05-09' } })
    await importerReleveSurCompte('C2', id, RELEVE)
    const autre = await ajouter({ nature: 'fonds_travaux', libelle: 'Fonds de travaux', iban: IBAN_B })
    await importerReleveSurCompte('C2', autre.id, RELEVE)
    await rendre()
    expect(titresAlertes().filter((titre) => titre.includes('solde d’ouverture'))).toEqual([])
  })

  it('solde d’ouverture écrit hors de l’écran sans date ou mal formé (point 8) : bandeau, il n’entre dans aucun solde', async () => {
    const { id } = await ajouter()
    await importerReleveSurCompte('C2', id, RELEVE)
    const autre = await ajouter({ nature: 'fonds_travaux', libelle: 'Fonds de travaux', iban: IBAN_B, soldeOuverture: { montant: '300', au: '2026-05-01' } })
    await ajDb.banques.update(id, { soldeOuvertureCentimes: 100_000 })
    await rendre()
    expect(titresAlertes()).toContain('1 solde d’ouverture de la base non pris en compte')
    expect(panneauComptes().textContent).toContain(
      'Compte principal : sans date ou mal formé, il n’entre ni dans le solde du compte ni dans ses arrêtés. À saisir de nouveau (« Modifier »), ou à reprendre dans la base locale.',
    )
    const bandeau = Array.from(panneauComptes().querySelectorAll('.alert')).find((alerte) => alerte.textContent?.includes('non pris en compte'))
    expect(bandeau).toHaveClass('rust')
    // Hors du solde, comme avant : lignes importées seulement, sans ligne « dont ouverture ».
    expect(lignesComptes()[0].textContent).toContain(euros(428.5))
    expect(lignesComptes()[0].textContent).not.toContain('dont ouverture')
    // « Modifier » : champs vides ; un solde d'ouverture saisi remplace les champs illisibles, le bandeau disparaît.
    ouvrirModifier()
    expect(dialogue().getByLabelText('Solde d’ouverture')).toHaveValue('')
    expect(dialogue().getByLabelText('au')).toHaveValue('')
    saisirOuverture('1000', '2026-05-01')
    await enregistrer()
    expect(await ajDb.banques.get(id)).toMatchObject({ soldeOuvertureCentimes: 100_000, soldeOuvertureAu: '2026-05-01' })
    expect(titresAlertes().filter((titre) => titre.includes('non pris en compte'))).toEqual([])

    cleanup()
    await ajDb.banques.update(id, { soldeOuvertureAu: '01/05/2026' })
    await ajDb.banques.update(autre.id, { soldeOuvertureCentimes: null })
    await rendre()
    expect(titresAlertes()).toContain('2 soldes d’ouverture de la base non pris en compte')
    expect(panneauComptes().textContent).toContain(
      'Compte principal, Fonds de travaux : sans date ou mal formés, ils n’entrent ni dans le solde de ces comptes ni dans leurs arrêtés. À saisir de nouveau (« Modifier »), ou à reprendre dans la base locale.',
    )
  })

  it('solde d’ouverture illisible d’un compte clôturé (ligne sans « Modifier ») : le bandeau ne conseille que la base locale', async () => {
    const CONSEIL_ACTIF = 'À saisir de nouveau (« Modifier »), ou à reprendre dans la base locale.'
    const { id } = await ajouter()
    const autre = await ajouter({ nature: 'fonds_travaux', libelle: 'Fonds de travaux', iban: IBAN_B })
    await ajDb.banques.update(autre.id, { soldeOuvertureCentimes: 30_000 })
    await cloturerCompteBancaire(autre.id)
    await rendre()
    // La ligne du compte clôturé n'a pas de bouton « Modifier », et son solde d'ouverture ne se modifie plus.
    const ligneCloturee = lignesComptes().find((ligne) => ligne.textContent?.includes('Fonds de travaux'))
    expect(ligneCloturee).toBeDefined()
    expect(within(ligneCloturee as HTMLElement).queryByRole('button', { name: /^Modifier/ })).toBeNull()
    expect(titresAlertes()).toContain('1 solde d’ouverture de la base non pris en compte')
    expect(panneauComptes().textContent).toContain(
      'Fonds de travaux : sans date ou mal formé, il n’entre ni dans le solde du compte ni dans ses arrêtés. Compte clôturé : à reprendre dans la base locale.',
    )
    expect(panneauComptes().textContent).not.toContain(CONSEIL_ACTIF)

    // Un compte actif et un compte clôturé : « Modifier » pour le premier, la base locale seule pour le second, nommé.
    cleanup()
    await ajDb.banques.update(id, { soldeOuvertureAu: '2026-05-01' })
    await rendre()
    expect(titresAlertes()).toContain('2 soldes d’ouverture de la base non pris en compte')
    expect(panneauComptes().textContent).toContain(
      `Compte principal, Fonds de travaux : sans date ou mal formés, ils n’entrent ni dans le solde de ces comptes ni dans leurs arrêtés. ${CONSEIL_ACTIF} Compte clôturé (Fonds de travaux) : à reprendre dans la base locale.`,
    )

    // Deux comptes clôturés : plus aucun « Modifier » à conseiller.
    cleanup()
    await cloturerCompteBancaire(id)
    await rendre()
    expect(panneauComptes().textContent).toContain(
      'Compte principal, Fonds de travaux : sans date ou mal formés, ils n’entrent ni dans le solde de ces comptes ni dans leurs arrêtés. Comptes clôturés : à reprendre dans la base locale.',
    )
    expect(panneauComptes().textContent).not.toContain(CONSEIL_ACTIF)
  })

  it('aucun solde d’ouverture illisible : aucun bandeau', async () => {
    await ajouter({ soldeOuverture: { montant: '1000', au: '2026-05-01' } })
    await ajouter({ nature: 'fonds_travaux', libelle: 'Fonds de travaux', iban: IBAN_B })
    await rendre()
    expect(titresAlertes().filter((titre) => titre.includes('non pris en compte'))).toEqual([])
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
      'Solde d’ouverture du 01/05/2026 et lignes de relevé importées sur ce compte datées après ce jour, jusqu’à la date de l’arrêté',
    )
    // Arrêté daté avant le solde d'ouverture : celui-ci n'y entre pas, la phrase d'origine reste.
    fireEvent.change(dialogue().getByLabelText('Date de l’arrêté'), { target: { value: '2026-04-30' } })
    expect(screen.getByRole('dialog').textContent).toContain(`Solde compta du sous-compte 512 au 30/04/2026 : ${euros(0)}`)
    expect(screen.getByRole('dialog').textContent).toContain('Lignes de relevé importées sur ce compte jusqu’à cette date')
  })

  it('« Nouvel arrêté » daté avant le solde d’ouverture (point 5) : refusé, « solde inconnu avant le JJ/MM/AAAA », formulaire ouvert', async () => {
    const { id } = await ajouter({ soldeOuverture: { montant: '1000', au: '2026-05-01' } })
    await importerReleveSurCompte('C2', id, RELEVE)
    await rendre()
    fireEvent.click(within(panneauRapprochement()).getByRole('button', { name: /Nouvel arrêté/ }))
    fireEvent.change(dialogue().getByLabelText('Date de l’arrêté'), { target: { value: '2026-04-30' } })
    fireEvent.change(dialogue().getByLabelText('Solde banque'), { target: { value: '0' } })
    await enregistrer()
    expect(dernierToast()).toMatchObject({
      kind: 'warn',
      title: 'Ouverture refusée',
      desc: 'Arrêté daté du 30/04/2026 : solde inconnu avant le 01/05/2026, date du solde d’ouverture du compte.',
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(await ajDb.rapprochements.count()).toBe(0)
  })

  it('« Nouvel arrêté » daté du jour même du solde d’ouverture : il y entre tel quel, les lignes de ce jour y sont déjà, et le formulaire le dit', async () => {
    const { id } = await ajouter({ soldeOuverture: { montant: '1000', au: '2026-05-10' } })
    await importerReleveSurCompte('C2', id, RELEVE)
    await rendre()
    fireEvent.click(within(panneauRapprochement()).getByRole('button', { name: /Nouvel arrêté/ }))
    fireEvent.change(dialogue().getByLabelText('Date de l’arrêté'), { target: { value: '2026-05-10' } })
    // 1 000,00 à la fin du 10/05 : le virement de ce jour y est déjà.
    expect(screen.getByRole('dialog').textContent).toContain('Solde compta du compte au 10/05/2026 : 1 000,00 €')
    expect(screen.getByRole('dialog').textContent).toContain(
      'Solde d’ouverture du 10/05/2026 et lignes de relevé importées sur ce compte datées après ce jour, jusqu’à la date de l’arrêté',
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

  it('solde d’ouverture daté après un arrêté du compte (point 4) : « Modifier » le refuse, formulaire ouvert, rien n’est écrit', async () => {
    const { id } = await ajouter()
    await importerReleveSurCompte('C2', id, RELEVE)
    await ouvrirArreteCompte(id, { dateArrete: '2026-05-31', soldeBanqueCentimes: 132_950 })
    await rendre()
    ouvrirModifier()
    saisirOuverture('1329,50', '2026-06-01')
    await enregistrer()
    expect(dernierToast()).toMatchObject({
      kind: 'warn',
      title: 'Enregistrement impossible',
      desc: 'Solde d’ouverture refusé : daté du 01/06/2026, après le premier arrêté du compte (31/05/2026, en cours). Un solde d’ouverture se date avant le premier arrêté du compte, ou le même jour. Le dater au plus tard du 31/05/2026, ou abandonner d’abord cet arrêté en cours.',
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(await ajDb.banques.get(id)).not.toHaveProperty('soldeOuvertureCentimes')
  })
})
