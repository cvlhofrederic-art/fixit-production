import './fuseau-paris'
import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CanalCommunicationModule } from '@/components/administrateur-judiciaire/modules/gestion/CanalCommunicationModule'
import { TresorerieModule } from '@/components/administrateur-judiciaire/modules/finances/TresorerieModule'
import { PrestatairesModule } from '@/components/administrateur-judiciaire/modules/patrimoine/Prestataires'
import { Fiche360PersonneModule } from '@/components/administrateur-judiciaire/modules/pilotage/Fiche360PersonneModule'
import { RepriseJudiciaireModule } from '@/components/administrateur-judiciaire/modules/pilotage/RepriseJudiciaireModule'
import { ToastContext, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { PIECES_REPRISE } from '@/lib/administrateur-judiciaire/domain/reprise'
import { AUJOURDHUI_ISO, CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Régressions des défauts fonctionnels hérités de la maquette dans les écrans de données (revue, constats 14, 21, 24,
 * 25, 28 et 30). Chaque test échouait avec le code d'origine ; les parcours normaux restent identiques.
 * 14) Reprise judiciaire : second clic sur « Importer » pendant l'import, double clic sur une pièce ;
 * 21) Fiche 360 personne : avis de mutation en 9999 (plantage du rendu) ou en 0000-0099 (date limite en 19xx) ;
 * 24) Banque et recouvrement : imputations concurrentes (double imputation, mise à jour du solde perdue) ;
 * 25) Banque et recouvrement : double clic sur le bouton d'étape (dossier en double, deux étapes le même jour) ;
 * 28) Prestataires : échec d'enregistrement devenu une promesse rejetée non gérée, sans retour ;
 * 30) Canal de communication : identifiant de mission en collision avec une mission existante.
 */

const etat = () => useDonneesStore.getState()

/** Base vidée, mode démo, jeu de démonstration inséré, store rechargé, sélection de dossier remise à zéro. */
async function reinitialiser(): Promise<void> {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loading: false })
  await etat().loadAll()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
}

/** Laisse s'écouler un délai réel (fake-indexeddb planifie ses requêtes hors des microtâches). */
const patienter = (ms: number) => new Promise((resoudre) => setTimeout(resoudre, ms))

/** Rend l'écran sous un fournisseur de toasts espion. */
function rendre(element: ReactElement) {
  const push = vi.fn<ToastApi['push']>(() => undefined)
  render(<ToastContext.Provider value={{ push, dismiss: vi.fn() }}>{element}</ToastContext.Provider>)
  return { push }
}

/** Toasts poussés (options du premier argument), dans l'ordre. */
const toasts = (push: ReturnType<typeof rendre>['push']) => push.mock.calls.map(([options]) => options)

describe('Reprise judiciaire — second clic sur « Importer » pendant l’import (constat 14)', () => {
  beforeEach(async () => {
    await reinitialiser()
  })

  /** Charge la liste d'exemple, l'analyse et renvoie le bouton « Importer 3 copropriétaires ». */
  function preparerImport(): HTMLButtonElement {
    fireEvent.click(screen.getByRole('button', { name: 'Exemple' }))
    fireEvent.click(screen.getByRole('button', { name: /Analyser/ }))
    return screen.getByRole('button', { name: /Importer 3 copropriétaires/ }) as HTMLButtonElement
  }

  /** Copropriétaires « Garnier Sophie » enregistrés sur les lots de Villa Montaigne (C4). */
  const garnierVillaMontaigne = () => {
    const lots = new Set(etat().lots.filter((lot) => lot.coproprieteId === 'C4').map((lot) => lot.id))
    return etat().coproprietaires.filter((personne) => lots.has(personne.lotId) && personne.nom === 'Garnier Sophie')
  }

  it('double clic : un seul import, un seul toast, bouton toujours actif (sans attribut disabled)', async () => {
    const { push } = rendre(<RepriseJudiciaireModule />)
    const bouton = preparerImport()
    fireEvent.click(bouton)
    // Import en cours : le bouton est toujours là, inchangé.
    expect(screen.getByRole('button', { name: /Importer 3 copropriétaires/ })).toBe(bouton)
    expect(bouton.hasAttribute('disabled')).toBe(false)
    fireEvent.click(bouton)
    await waitFor(() => expect(push).toHaveBeenCalled())
    // Laisse le temps à un éventuel second import de se terminer.
    await patienter(300)
    expect(toasts(push)).toEqual([
      { kind: 'success', title: 'Liste importée', desc: '3 copropriétaires créés, 0 mis à jour.' },
    ])
    expect(garnierVillaMontaigne()).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /Importer 3 copropriétaires/ })).toBeNull()
  })

  it('le verrou est libéré après l’import, réussi ou en échec : un nouvel import de la liste se lance', async () => {
    const importerOrigine = etat().importerCoproprietaires
    let appels = 0
    useDonneesStore.setState({
      importerCoproprietaires: (coproprieteId, lignes) => {
        appels += 1
        return appels === 1 ? Promise.reject(new Error('Base indisponible')) : importerOrigine(coproprieteId, lignes)
      },
    })
    try {
      const { push } = rendre(<RepriseJudiciaireModule />)
      const bouton = preparerImport()
      fireEvent.click(bouton)
      await waitFor(() =>
        expect(toasts(push)).toEqual([{ kind: 'warn', title: 'Import impossible', desc: 'Base indisponible' }]),
      )
      fireEvent.click(bouton)
      await waitFor(() => expect(push).toHaveBeenCalledTimes(2))
      expect(toasts(push)[1]).toEqual({
        kind: 'success',
        title: 'Liste importée',
        desc: '3 copropriétaires créés, 0 mis à jour.',
      })
      // Même liste importée une seconde fois : mise à jour, comme dans la maquette.
      fireEvent.click(preparerImport())
      await waitFor(() => expect(push).toHaveBeenCalledTimes(3))
      expect(toasts(push)[2]).toEqual({
        kind: 'success',
        title: 'Liste importée',
        desc: '0 copropriétaire créé, 3 mis à jour.',
      })
      expect(garnierVillaMontaigne()).toHaveLength(1)
    } finally {
      useDonneesStore.setState({ importerCoproprietaires: importerOrigine })
    }
  })
})

describe('Reprise judiciaire — double clic sur une pièce (constat 14)', () => {
  beforeEach(async () => {
    await reinitialiser()
  })

  const [piece] = PIECES_REPRISE
  const boutonPiece = () => screen.getByText(piece.libelle).closest('button') as HTMLButtonElement
  /** Types des documents de reprise de la pièce pour Villa Montaigne (C4), dans l'ordre d'écriture. */
  const typesDocumentsPiece = async () =>
    (await ajDb.documents.toArray())
      .filter(
        (document) =>
          document.entiteType === 'reprise' &&
          document.entiteId === 'C4' &&
          (document.type === piece.cle || document.type === `retrait:${piece.cle}`),
      )
      .map((document) => document.type)
      .sort()

  it('deux clics rapprochés basculent deux fois (reçue puis retirée) au lieu d’écrire deux fois « reçue »', async () => {
    rendre(<RepriseJudiciaireModule />)
    expect(within(boutonPiece()).queryByText('Attendue')).not.toBeNull()
    fireEvent.click(boutonPiece())
    fireEvent.click(boutonPiece())
    await waitFor(async () => expect(await typesDocumentsPiece()).toHaveLength(2))
    await patienter(100)
    expect(await typesDocumentsPiece()).toEqual([piece.cle, `retrait:${piece.cle}`].sort())
    await waitFor(() => expect(within(boutonPiece()).queryByText('Attendue')).not.toBeNull())
    // Un seul clic suffit ensuite à la marquer reçue.
    fireEvent.click(boutonPiece())
    await waitFor(() => expect(within(boutonPiece()).queryByText('Reçue')).not.toBeNull())
    expect(await typesDocumentsPiece()).toEqual([`retrait:${piece.cle}`, piece.cle, piece.cle].sort())
  })

  it('clic simple inchangé : la pièce passe à « Reçue », puis un clic la retire', async () => {
    rendre(<RepriseJudiciaireModule />)
    fireEvent.click(boutonPiece())
    await waitFor(() => expect(within(boutonPiece()).queryByText('Reçue')).not.toBeNull())
    fireEvent.click(boutonPiece())
    await waitFor(() => expect(within(boutonPiece()).queryByText('Attendue')).not.toBeNull())
    expect(await typesDocumentsPiece()).toEqual([piece.cle, `retrait:${piece.cle}`].sort())
  })
})

describe('Fiche 360 personne — avis de mutation hors calendrier (constat 21)', () => {
  const INVITE = "Saisir la date pour calculer le délai d'opposition (L. 1965 art. 20)."
  const opposition = (date: string) =>
    `Opposition à former au plus tard le ${date} (L. 1965 art. 20 : quinze jours de l'avis).`

  beforeEach(async () => {
    await reinitialiser()
  })

  async function saisirAvis(valeur: string): Promise<HTMLElement> {
    fireEvent.change(await screen.findByLabelText("Date de l'avis de mutation"), { target: { value: valeur } })
    return screen.getByLabelText("Date de l'avis de mutation").closest('div')?.querySelector('p') as HTMLElement
  }

  it('avis du 20/12/9999 (délai en l’an 10000) : message d’invite au lieu d’un plantage du rendu', async () => {
    rendre(<Fiche360PersonneModule />)
    const message = await saisirAvis('20/12/9999')
    expect(message.textContent).toBe(INVITE)
    expect(message.style.color).toBe('var(--navy-300)')
    expect(screen.getByText('Notification et mutation')).not.toBeNull()
    expect((await saisirAvis('17/12/9999')).textContent).toBe(INVITE)
  })

  it('avis en 0000-0099 : message d’invite au lieu d’une date limite ramenée au XXe siècle', async () => {
    rendre(<Fiche360PersonneModule />)
    expect((await saisirAvis('15/03/0026')).textContent).toBe(INVITE)
    expect((await saisirAvis('31/12/0099')).textContent).toBe(INVITE)
    expect((await saisirAvis('01/01/0000')).textContent).toBe(INVITE)
  })

  it('saisies qui fonctionnaient : affichage inchangé (y compris 16/12/9999 et l’an 100)', async () => {
    rendre(<Fiche360PersonneModule />)
    const message = await saisirAvis('15/03/2026')
    expect(message.textContent).toBe(opposition('30/03/2026'))
    expect(message.style.color).toBe('var(--rust-500)')
    expect((await saisirAvis('16/12/9999')).textContent).toBe(opposition('31/12/9999'))
    expect((await saisirAvis('15/03/2150')).textContent).toBe(opposition('30/03/2150'))
    expect((await saisirAvis('15/03/1850')).textContent).toBe(opposition('30/03/1850'))
    expect((await saisirAvis('15/03/0100')).textContent).toBe(opposition('30/03/100'))
    expect((await saisirAvis('31/02/2026')).textContent).toBe(INVITE)
    expect((await saisirAvis('')).textContent).toBe(INVITE)
  })
})

describe('Banque et recouvrement — imputations concurrentes (constat 24)', () => {
  // Le Clos des Vignes (CV, C2) : Sophie Garnier (P2, -1840) et Karim Benali (P3, -620), débiteurs.
  const soldeDe = (id: string) => etat().coproprietaires.find((personne) => personne.id === id)?.solde
  /** Contreparties 450 citant l'écriture 512 (« … relevé <id> »). */
  const imputationsDe = (ecritureId: string) =>
    etat().ecritures.filter(
      (ecriture) => ecriture.compte.startsWith('450-') && ecriture.libelle.endsWith(`relevé ${ecritureId}`),
    )
  const ligne512 = (libelle: string) => {
    const ecriture = etat().ecritures.find((candidate) => candidate.compte === '512' && candidate.libelle === libelle)
    if (!ecriture) throw new Error(`Ligne introuvable : ${libelle}`)
    return ecriture
  }
  const selectImputation = (libelle: string) =>
    screen.getByRole('combobox', { name: `Imputer ${libelle}` }) as HTMLSelectElement

  beforeEach(async () => {
    await reinitialiser()
    await etat().importerReleve('C2', [
      { date: '2026-06-04', libelle: 'VIR ENCAISSEMENT A', montant: 100 },
      { date: '2026-06-05', libelle: 'VIR ENCAISSEMENT B', montant: 200 },
    ])
  })

  it('select changé deux fois de suite : une seule imputation, au premier copropriétaire choisi', async () => {
    const { push } = rendre(<TresorerieModule />)
    const select = selectImputation('VIR ENCAISSEMENT A')
    fireEvent.change(select, { target: { value: 'P2' } })
    fireEvent.change(select, { target: { value: 'P3' } })
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Imputer VIR ENCAISSEMENT A' })).toBeNull())
    await patienter(300)
    const imputations = imputationsDe(ligne512('VIR ENCAISSEMENT A').id)
    expect(imputations.map((ecriture) => ecriture.compte)).toEqual(['450-P2'])
    expect((await ajDb.ecritures.toArray()).filter((ecriture) => ecriture.compte.startsWith('450-'))).toHaveLength(1)
    expect(soldeDe('P2')).toBe(-1740)
    expect(soldeDe('P3')).toBe(-620)
    expect(toasts(push)).toEqual([
      { kind: 'success', title: 'Encaissement imputé', desc: 'Solde du copropriétaire mis à jour.' },
    ])
  })

  it('deux lignes imputées ensemble au même copropriétaire : les deux montants comptent dans son solde', async () => {
    const { push } = rendre(<TresorerieModule />)
    fireEvent.change(selectImputation('VIR ENCAISSEMENT A'), { target: { value: 'P2' } })
    fireEvent.change(selectImputation('VIR ENCAISSEMENT B'), { target: { value: 'P2' } })
    await waitFor(() => expect(screen.getAllByText('Imputé · C 450')).toHaveLength(2))
    await patienter(100)
    expect(soldeDe('P2')).toBe(-1540)
    expect((await ajDb.coproprietaires.get('P2'))?.solde).toBe(-1540)
    expect(imputationsDe(ligne512('VIR ENCAISSEMENT A').id)).toHaveLength(1)
    expect(imputationsDe(ligne512('VIR ENCAISSEMENT B').id)).toHaveLength(1)
    expect(push).toHaveBeenCalledTimes(2)
  })

  it('ligne imputée à la main pendant la boucle d’import : une seule contrepartie par ligne, soldes cohérents', async () => {
    const releve = [
      'Date;Libellé;Montant',
      '06/06/2026;VIR IMPORT 1;10,00',
      '07/06/2026;VIR IMPORT 2;20,00',
      '08/06/2026;VIR IMPORT 3;30,00',
      '09/06/2026;VIR IMPORT 4;40,00',
    ].join('\n')
    const { push } = rendre(<TresorerieModule />)
    fireEvent.change(screen.getByLabelText('Relevé bancaire'), { target: { value: releve } })
    fireEvent.click(screen.getByRole('button', { name: /Analyser/ }))
    for (let numero = 1; numero <= 4; numero++)
      fireEvent.change(screen.getByLabelText(`Copropriétaire ligne ${numero}`), { target: { value: 'P2' } })
    fireEvent.click(screen.getByRole('button', { name: /Importer 4 lignes/ }))
    // Dès que la ligne 4 apparaît dans le journal (avant que la boucle ne l'atteigne), imputation manuelle à P3.
    const select4 = await waitFor(() => selectImputation('VIR IMPORT 4'))
    fireEvent.change(select4, { target: { value: 'P3' } })
    await waitFor(() => expect(toasts(push).some((options) => 'title' in options && options.title === 'Relevé importé')).toBe(true))
    await patienter(300)
    const imputations = [1, 2, 3, 4].map((numero) => imputationsDe(ligne512(`VIR IMPORT ${numero}`).id))
    expect(imputations.map((liste) => liste.length)).toEqual([1, 1, 1, 1])
    const totalPour = (id: string) =>
      imputations
        .flat()
        .filter((ecriture) => ecriture.compte === `450-${id}`)
        .reduce((total, ecriture) => total + ecriture.montant, 0)
    expect(soldeDe('P2')).toBe(Math.round((-1840 + totalPour('P2')) * 100) / 100)
    expect(soldeDe('P3')).toBe(Math.round((-620 + totalPour('P3')) * 100) / 100)
    expect((await ajDb.coproprietaires.get('P2'))?.solde).toBe(soldeDe('P2'))
  })
})

describe('Banque et recouvrement — double clic sur le bouton d’étape (constat 25)', () => {
  beforeEach(async () => {
    await reinitialiser()
  })

  /** Bouton d'étape de la ligne de Sophie Garnier (P2). */
  const boutonEtape = () => {
    const ligne = screen.getByRole('button', { name: 'Sophie Garnier' }).parentElement?.parentElement as HTMLElement
    const boutons = within(ligne).getAllByRole('button')
    return boutons[boutons.length - 1] as HTMLButtonElement
  }
  const dossiersGarnier = async () => (await ajDb.impayes.toArray()).filter((impaye) => impaye.coproprietaireId === 'P2')

  it('deux clics pendant l’enregistrement : un seul dossier d’impayé créé, un seul toast', async () => {
    const { push } = rendre(<TresorerieModule />)
    const bouton = boutonEtape()
    expect(bouton.textContent).toBe('Mise en demeure')
    fireEvent.click(bouton, { detail: 1 })
    expect(bouton.hasAttribute('disabled')).toBe(false)
    fireEvent.click(bouton, { detail: 1 })
    await waitFor(() => expect(push).toHaveBeenCalled())
    await patienter(300)
    expect(await dossiersGarnier()).toHaveLength(1)
    expect(etat().impayes.filter((impaye) => impaye.coproprietaireId === 'P2')).toHaveLength(1)
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('second clic d’un double clic (detail 2) sur le bouton passé à l’étape suivante : ignoré', async () => {
    const { push } = rendre(<TresorerieModule />)
    fireEvent.click(boutonEtape(), { detail: 1 })
    await waitFor(() => expect(boutonEtape().textContent).toBe('Exigibilité anticipée'))
    fireEvent.click(boutonEtape(), { detail: 2 })
    await patienter(300)
    expect((await dossiersGarnier()).map((dossier) => dossier.statut)).toEqual([`mise_en_demeure:${AUJOURDHUI_ISO}`])
    expect(boutonEtape().textContent).toBe('Exigibilité anticipée')
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('clic simple ou clavier (detail 0) inchangés : chaque clic distinct avance d’une étape', async () => {
    const { push } = rendre(<TresorerieModule />)
    fireEvent.click(boutonEtape(), { detail: 1 })
    await waitFor(() => expect(boutonEtape().textContent).toBe('Exigibilité anticipée'))
    fireEvent.click(boutonEtape(), { detail: 0 })
    await waitFor(() => expect(boutonEtape().textContent).toBe('Action en justice'))
    expect((await dossiersGarnier()).map((dossier) => dossier.statut)).toEqual([`exigibilite:${AUJOURDHUI_ISO}`])
    expect(toasts(push)).toEqual([
      {
        kind: 'success',
        title: 'Dossier de recouvrement',
        desc: expect.stringContaining('Étape « Mise en demeure » enregistrée au '),
      },
      {
        kind: 'success',
        title: 'Dossier de recouvrement',
        desc: expect.stringContaining('Étape « Exigibilité anticipée » enregistrée au '),
      },
    ])
  })
})

describe('Prestataires — échec d’enregistrement (constat 28)', () => {
  beforeEach(async () => {
    await reinitialiser()
  })

  it('prestataire supprimé entre-temps (base réinitialisée ailleurs) : toast d’échec au lieu d’un rejet non géré', async () => {
    const { push } = rendre(<PrestatairesModule />)
    const [premier] = etat().prestataires
    fireEvent.click((await screen.findAllByRole('button', { name: 'Modifier' }))[0])
    await ajDb.prestataires.delete(premier.id)
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1))
    expect(toasts(push)).toEqual([
      {
        kind: 'warn',
        title: 'Enregistrement impossible',
        desc: expect.stringContaining('introuvable'),
      },
    ])
    // La modale est fermée, comme avant.
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull()
  })

  it('enregistrement réussi inchangé : modification puis création', async () => {
    const { push } = rendre(<PrestatairesModule />)
    const [premier] = etat().prestataires
    fireEvent.click((await screen.findAllByRole('button', { name: 'Modifier' }))[0])
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1))
    expect(toasts(push)[0]).toEqual({
      kind: 'success',
      title: 'Prestataire modifié',
      desc: `${premier.nom} a été mis à jour.`,
    })
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un prestataire/ }))
    fireEvent.change(screen.getByLabelText(/Raison sociale/), { target: { value: 'Nouvelle Entreprise' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    await waitFor(() => expect(push).toHaveBeenCalledTimes(2))
    expect(toasts(push)[1]).toEqual({
      kind: 'success',
      title: 'Prestataire créé',
      desc: 'Nouvelle Entreprise a été ajouté.',
    })
    expect(await screen.findByText('Nouvelle Entreprise')).not.toBeNull()
  })
})

describe('Canal de communication — identifiant de mission en collision (constat 30)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** Crée un ordre de mission avec cette description (valeurs par défaut pour le reste). */
  function creerOrdre(description: string) {
    fireEvent.click(screen.getByRole('button', { name: /Nouvel ordre de mission/ }))
    fireEvent.change(screen.getByLabelText('Intervention demandée'), { target: { value: description } })
    fireEvent.click(screen.getByRole('button', { name: /Transmettre à l'artisan/ }))
  }

  const cartes = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.canal-mission-card'))

  /** Fixe les prochains tirages de crypto.getRandomValues (un entier par appel ; le dernier vaut pour la suite). */
  function fixerTirages(...valeurs: number[]) {
    let appel = 0
    return vi.spyOn(crypto, 'getRandomValues').mockImplementation((tableau) => {
      ;(tableau as Uint16Array)[0] = valeurs[Math.min(appel++, valeurs.length - 1)]
      return tableau
    })
  }

  it('le second tirage retombant sur l’identifiant de la première mission créée est refait', () => {
    const erreurConsole = vi.spyOn(console, 'error')
    // 5 missions de démonstration : m6 + 300 = « m306 » ; puis m7 + 299 = « m306 » (collision), puis m7 + 500.
    fixerTirages(300, 299, 500)
    rendre(<CanalCommunicationModule />)
    creerOrdre('Première intervention')
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Message sur la première mission' } })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le message' }))
    expect(screen.queryByText('Message sur la première mission')).not.toBeNull()
    creerOrdre('Seconde intervention')
    expect(cartes()).toHaveLength(7)
    // Retour à la première mission créée (deuxième carte : les nouvelles missions sont ajoutées en tête).
    fireEvent.click(cartes()[1])
    expect(cartes().map((carte) => carte.getAttribute('aria-current'))).toEqual([
      null,
      'true',
      null,
      null,
      null,
      null,
      null,
    ])
    expect(screen.queryByText('Message sur la première mission')).not.toBeNull()
    expect(screen.queryAllByText('Première intervention').length).toBeGreaterThan(0)
    expect(screen.queryByText('Seconde intervention')).toBeNull()
    // Aucune clé React en double.
    expect(erreurConsole.mock.calls.some((appel) => String(appel[0]).includes('same key'))).toBe(false)
  })

  it('sans collision : un seul tirage, comme dans la maquette', () => {
    const tirage = fixerTirages(123)
    rendre(<CanalCommunicationModule />)
    creerOrdre('Intervention unique')
    expect(tirage).toHaveBeenCalledTimes(1)
    expect(cartes()).toHaveLength(6)
    expect(cartes()[0].getAttribute('aria-current')).toBe('true')
  })

  it('tirage hors de la plage 0 à 999 : refait (tirage uniforme, sans modulo)', () => {
    // Dix bits tirés : 1010 dépasse 999, le tirage est refait ; 42 est retenu.
    const tirage = fixerTirages(1010, 42)
    rendre(<CanalCommunicationModule />)
    creerOrdre('Intervention unique')
    expect(tirage).toHaveBeenCalledTimes(2)
    expect(cartes()).toHaveLength(6)
  })
})
