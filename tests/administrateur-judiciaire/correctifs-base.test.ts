import './fuseau-paris'
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { repoEcritures, repoLots, repoPrestataires } from '@/lib/administrateur-judiciaire/db/repositories'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import type { LigneListeCoproprietaires } from '@/lib/administrateur-judiciaire/domain/import/liste-coproprietaires'
import type { LigneReleve } from '@/lib/administrateur-judiciaire/domain/import/releve-bancaire'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'

/**
 * Correctifs de la base locale (défauts hérités de la maquette) :
 * 1. importerCoproprietaires : deux imports concurrents de la même liste (double clic, bouton actif pendant l'import)
 *    dupliquaient lots et copropriétaires. Ils sont désormais exécutés l'un après l'autre.
 * 2. Seed de démonstration : interrompu en cours de route, il laissait une démonstration partielle définitive (le
 *    contrôle « base déjà remplie » empêchait toute reprise). Il forme désormais une seule transaction.
 * 3. importerReleve : une erreur en cours de boucle laissait en base des écritures absentes de l'état (et donc du
 *    dédoublonnage) ; un nouvel import les dupliquait. La boucle forme désormais une seule transaction.
 */

const etat = () => useDonneesStore.getState()

/** Comptes de toutes les tables de la base. */
async function compterTables(): Promise<Record<string, number>> {
  const comptes: Record<string, number> = {}
  for (const table of ajDb.tables) comptes[table.name] = await table.count()
  return comptes
}

/** Base vidée, mode démo, jeu de démonstration inséré, store rechargé. */
async function reinitialiser(): Promise<void> {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loading: false })
  await etat().loadAll()
}

/** Laisse avancer les opérations en cours de la base (fake-indexeddb planifie ses requêtes hors des microtâches). */
const laisserAvancer = () => new Promise((resoudre) => setTimeout(resoudre, 0))

beforeEach(async () => {
  await reinitialiser()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('correctif — imports concurrents de la liste des copropriétaires', () => {
  const COPRO = 'C4',
    lignes: LigneListeCoproprietaires[] = Array.from({ length: 30 }, (_, index) => ({
      lot: `Lot import ${index + 1}`,
      nom: `Personne ${index + 1}`,
      tel: '',
      mail: '',
      solde: index % 3 === 0 ? -120 : 0,
      tantiemes: { numerateur: 100 + index, denominateur: 10000 },
    }))

  /** Lots et personnes de la copropriété importée, dans l'état et en base. */
  async function importes() {
    const lotsEtat = etat().lots.filter((lot) => lot.numero.startsWith('Lot import')),
      idsLots = new Set(lotsEtat.map((lot) => lot.id)),
      lotsBase = (await ajDb.lots.where('coproprieteId').equals(COPRO).toArray()).filter((lot) =>
        lot.numero.startsWith('Lot import'),
      ),
      idsLotsBase = new Set(lotsBase.map((lot) => lot.id))
    return {
      lotsEtat: lotsEtat.length,
      personnesEtat: etat().coproprietaires.filter((personne) => idsLots.has(personne.lotId)).length,
      lotsBase: lotsBase.length,
      personnesBase: (await ajDb.coproprietaires.toArray()).filter((personne) => idsLotsBase.has(personne.lotId))
        .length,
    }
  }

  const SANS_DOUBLON = { lotsEtat: 30, personnesEtat: 30, lotsBase: 30, personnesBase: 30 }

  it('deux imports lancés ensemble : le second met à jour ce que le premier a créé, sans doublon', async () => {
    const [premier, second] = await Promise.all([
      etat().importerCoproprietaires(COPRO, lignes),
      etat().importerCoproprietaires(COPRO, lignes),
    ])
    expect(premier).toEqual({ crees: 30, misAJour: 0 })
    expect(second).toEqual({ crees: 0, misAJour: 30 })
    expect(await importes()).toEqual(SANS_DOUBLON)
  })

  it('second clic pendant l’import : aucun doublon, quel que soit l’avancement du premier', async () => {
    const premier = etat().importerCoproprietaires(COPRO, lignes)
    // Second déclenchement une fois quelques lignes du premier traitées (le second rattrapait alors le premier).
    while ((await importes()).personnesEtat < 5) await laisserAvancer()
    const second = etat().importerCoproprietaires(COPRO, lignes)
    expect(await premier).toEqual({ crees: 30, misAJour: 0 })
    expect(await second).toEqual({ crees: 0, misAJour: 30 })
    expect(await importes()).toEqual(SANS_DOUBLON)
  })

  it('un import en échec ne bloque pas le suivant, qui garde son propre résultat', async () => {
    vi.spyOn(repoLots, 'create').mockRejectedValueOnce(new Error('Écriture refusée'))
    const premier = etat().importerCoproprietaires(COPRO, lignes),
      second = etat().importerCoproprietaires(COPRO, lignes)
    await expect(premier).rejects.toThrow('Écriture refusée')
    expect(await second).toEqual({ crees: 30, misAJour: 0 })
    expect(await importes()).toEqual(SANS_DOUBLON)
    // La file est de nouveau libre : un import isolé démarre normalement.
    expect(await etat().importerCoproprietaires(COPRO, lignes.slice(0, 2))).toEqual({ crees: 0, misAJour: 2 })
  })
})

describe('correctif — seed de démonstration interrompu', () => {
  it('une interruption annule tout le seed, qui est refait complet au lancement suivant', async () => {
    const complet = await compterTables()
    expect(complet.coproprietes).toBeGreaterThan(0)
    expect(complet.prestataires).toBeGreaterThan(0)
    expect(complet.taches).toBeGreaterThan(0)

    await viderBaseLocale()
    // Interruption après les copropriétés, mandats, lots et copropriétaires (avant les prestataires).
    vi.spyOn(repoPrestataires, 'create').mockRejectedValueOnce(new Error('Seed interrompu'))
    await expect(initialiserBaseDemo()).rejects.toThrow('Seed interrompu')
    vi.restoreAllMocks()

    const apresInterruption = await compterTables()
    expect(Object.values(apresInterruption).every((compte) => compte === 0)).toBe(true)

    await initialiserBaseDemo()
    expect(await compterTables()).toEqual(complet)
  })
})

describe('correctif — import de relevé interrompu', () => {
  const COPRO = 'C1',
    lignes: LigneReleve[] = [
      { date: '2026-05-02', libelle: 'VIR SEPA GARNIER SOPHIE', montant: 920 },
      { date: '2026-05-03', libelle: 'PRLV EDF COLLECTIVITES', montant: -312.45 },
      { date: '2026-05-04', libelle: 'VIR BENALI', montant: 620 },
      { date: '2026-05-05', libelle: 'PRLV ASSURANCE', montant: -50 },
      { date: '2026-05-06', libelle: 'VIR ROUSSEAU', montant: 100.1 },
    ]

  /** Écritures du journal de la copropriété, en base. */
  async function ecrituresEnBase() {
    const journal = await ajDb.journaux.where('coproprieteId').equals(COPRO).first()
    return journal ? ajDb.ecritures.where('journalId').equals(journal.id).toArray() : []
  }

  it('une erreur en cours de boucle ne laisse aucune écriture en base ; le nouvel import ne duplique rien', async () => {
    const creer = repoEcritures.create
    let appels = 0
    vi.spyOn(repoEcritures, 'create').mockImplementation((...args) => {
      appels++
      return appels > 3 ? Promise.reject(new Error('Quota dépassé')) : creer(...args)
    })
    const journalAvant = await ajDb.activityLog.where('entite').equals('ecritures').count()
    await expect(etat().importerReleve(COPRO, lignes)).rejects.toThrow('Quota dépassé')
    vi.restoreAllMocks()

    // Rien d'enregistré (ni écriture ni entrée du journal d'activité), comme l'état qui n'en contient aucune.
    expect(await ecrituresEnBase()).toEqual([])
    expect(await ajDb.activityLog.where('entite').equals('ecritures').count()).toBe(journalAvant)
    expect(etat().ecritures).toEqual([])
    // Le journal de la copropriété reste créé et affiché, comme avant.
    expect(etat().journaux.filter((journal) => journal.coproprieteId === COPRO)).toHaveLength(1)

    // Nouvel import du même relevé, puis rechargement : chaque ligne une seule fois.
    const banque = await etat().importerReleve(COPRO, lignes)
    expect(banque).toHaveLength(5)
    useDonneesStore.setState({ loading: false })
    await etat().loadAll()
    const enBase = await ecrituresEnBase()
    expect(enBase.filter((ecriture) => ecriture.compte === '512')).toHaveLength(5)
    expect(enBase.filter((ecriture) => ecriture.compte === '471')).toHaveLength(2)
    expect(etat().ecritures).toHaveLength(7)
  })

  it('erreur d’IndexedDB elle-même (clé en double) : même erreur remontée, aucune écriture en base', async () => {
    const table = ajDb.ecritures,
      ajouter = table.add.bind(table)
    let appels = 0,
      premierId = ''
    // 4e écriture refusée par la base (identifiant déjà présent) : ConstraintError d'IndexedDB.
    vi.spyOn(table, 'add').mockImplementation((ecriture, cle) => {
      appels++
      if (appels === 1) premierId = ecriture.id
      return ajouter(appels === 4 ? { ...ecriture, id: premierId } : ecriture, cle)
    })
    const erreur = await etat()
      .importerReleve(COPRO, lignes)
      .then(
        () => null,
        (raison: unknown) => raison,
      )
    vi.restoreAllMocks()
    // Erreur d'origine inchangée (le toast « Import impossible » affiche le même message).
    expect(erreur).toBeInstanceOf(Error)
    expect((erreur as Error).name).toBe('ConstraintError')
    expect(await ecrituresEnBase()).toEqual([])
    expect(etat().ecritures).toEqual([])
  })
})
