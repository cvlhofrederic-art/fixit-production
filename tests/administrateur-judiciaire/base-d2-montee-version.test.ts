import './fuseau-paris'
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ajDb, NOM_BASE_LOCALE } from '@/lib/administrateur-judiciaire/db/schema'

/**
 * Montée de version de la base locale (plan des écrans, § 5.7 et § 5.10 : « à tester sur une base déjà remplie ») : une
 * base en version 2, remplie, s'ouvre en version 3 sans qu'aucune donnée ne bouge ; les six tables nouvelles sont vides
 * (aucune fonction upgrade : la migration des fiches est une fonction à part, db/migration-d2.ts). Retour arrière : la
 * base passée en version 3 se rouvre avec le code de la version 2. Un onglet resté ouvert sur l'ancien code se
 * reconnecte tout seul (Dexie 4.4.6 : fermeture sur versionchange, réouverture au repli de VersionError). Données fictives.
 */

/** Ancien code : les blocs version(1) et version(2) de db/schema.ts, recopiés tels quels (fixture). */
function baseV2(): Dexie {
  const db = new Dexie(NOM_BASE_LOCALE)
  db.version(1).stores({
    cabinets: 'id',
    societes: 'id, cabinetId',
    utilisateurs: 'id, roleId, email',
    roles: 'id',
    mandats: 'id, coproprieteId',
    coproprietes: 'id, code',
    immeubles: 'id, coproprieteId',
    batiments: 'id, immeubleId',
    cages: 'id, batimentId',
    lots: 'id, coproprieteId',
    coproprietaires: 'id, lotId',
    occupants: 'id, lotId',
    prestataires: 'id, nom',
    contrats: 'id, prestataireId, coproprieteId',
    assurances: 'id, coproprieteId',
    comptes: 'id, coproprieteId, numero',
    exercices: 'id, coproprieteId, annee',
    journaux: 'id, coproprieteId',
    ecritures: 'id, journalId, date',
    factures: 'id, prestataireId, coproprieteId',
    reglements: 'id, factureId, appelDeFondsId',
    budgets: 'id, coproprieteId, exerciceId',
    appelsDeFonds: 'id, coproprieteId',
    impayes: 'id, coproprietaireId',
    fondsTravaux: 'id, coproprieteId',
    banques: 'id, coproprieteId',
    rapprochements: 'id, bancaireId',
    ags: 'id, coproprieteId, date',
    resolutions: 'id, agId',
    procurations: 'id, agId, coproprietaireId',
    presences: 'id, agId, coproprietaireId',
    travaux: 'id, coproprieteId',
    devis: 'id, travauxId, prestataireId',
    interventions: 'id, coproprieteId, prestataireId',
    sinistres: 'id, coproprieteId',
    documents: 'id, entiteType, entiteId',
    taches: 'id, assigneId, due',
    echeances: 'id, coproprieteId, date',
    notifications: 'id, coproprieteId, date',
    activityLog: 'id, entite, entiteId, quand',
  })
  db.version(2).stores({
    changementsStatut: 'id, entiteType, entiteId, statutNouveau, dateEffet, courrierId, [entiteType+entiteId]',
    planComptable: 'id, code, source, nature, typeSru, horsService, [source+code]',
    modelesCourrier: 'id, famille, libelle, contexte, formeEnvoi',
    courriers:
      'id, coproprieteId, mandatId, personneId, entrepriseId, modeleId, statut, formeEnvoi, dateDepot, dateAccuseReception, referenceDiffusion',
  })
  return db
}

const NOUVELLES = ['identites', 'positions', 'comptesCoproprietaires', 'clesRepartition', 'echeancesAppel', 'traitements']

const suivi = { createdAt: '2026-06-01T08:00:00.000Z', updatedAt: '2026-06-01T08:00:00.000Z', createdBy: 'test', updatedBy: 'test' }

/** Base v2 « réelle » déjà remplie : copropriété, lot, fiche, écritures 450-<id>, impayé, AG, historique, courrier, journal. */
async function remplir(db: Dexie): Promise<void> {
  await db.table('coproprietes').add({ id: 'C9', code: 'ZZ', nom: 'Résidence fictive', adresse: '1 rue Fictive', nbLots: 1, budget: 0, depense: 0, impayes: 0, fondsTravaux: 0, ...suivi })
  await db.table('mandats').add({ id: 'M9', coproprieteId: 'C9', fondement: 'Art. 29-1', motif: 'Essai', tribunal: 'TJ Fictif', rg: '26/00001', ordonnance: new Date(2026, 2, 12), dureeMois: 12, echeance: new Date(2027, 2, 12), statut: 'Actif', pill: 'ok', notifOrdonnance: '', ...suivi })
  await db.table('lots').add({ id: 'L9', coproprieteId: 'C9', numero: 'Lot 1', tantiemes: { numerateur: 1000, denominateur: 1000 }, ...suivi })
  await db.table('coproprietaires').add({ id: 'F9', lotId: 'L9', nom: 'Personne Fictive', tel: '0100000000', mail: 'fictive@example.test', solde: -120.5, statut: 'Impayé', ...suivi })
  await db.table('journaux').add({ id: 'J9', coproprieteId: 'C9', ...suivi })
  await db.table('ecritures').bulkAdd([
    { id: 'E1', journalId: 'J9', date: new Date(2026, 4, 2), compte: '512', libelle: 'Relevé', montant: 50, sens: 'debit', ...suivi },
    { id: 'E2', journalId: 'J9', date: new Date(2026, 4, 2), compte: '450-F9', libelle: 'Encaissement', montant: 50, sens: 'credit', ...suivi },
  ])
  await db.table('impayes').add({ id: 'I9', coproprietaireId: 'F9', montant: 120.5, statut: 'relance:2026-05-03', ...suivi })
  await db.table('ags').add({ id: 'AG9', coproprieteId: 'C9', date: new Date(2026, 4, 20), nature: 'Judiciaire', statut: 'Convoquée', ...suivi })
  await db.table('changementsStatut').add({ id: 'CS9', entiteType: 'ag', entiteId: 'AG9', statutAncien: 'Projet', statutNouveau: 'Convoquée', dateEffet: '2026-05-01', courrierId: null, ...suivi })
  await db.table('courriers').add({ id: 'K9', modeleId: 'MC9', formeEnvoi: 'AR', statut: 'A Suivre', objet: 'Convocation', coproprieteId: 'C9', mandatId: 'M9', personneId: null, entrepriseId: null, dateDepot: '2026-05-01', datePremierePresentation: null, dateAccuseReception: null, referenceDiffusion: null, ...suivi })
  await db.table('activityLog').add({ id: 'A9', quand: '2026-06-01T08:00:00.000Z', entite: 'coproprietaires', entiteId: 'F9', action: 'create', qui: 'test', avant: null, apres: { id: 'F9' } })
}

/** Contenu de toutes les tables d'une instance. */
async function contenu(db: Dexie, noms: string[]): Promise<Record<string, unknown[]>> {
  const r: Record<string, unknown[]> = {}
  for (const nom of noms) r[nom] = await db.table(nom).toArray()
  return r
}

afterEach(async () => {
  vi.restoreAllMocks()
  ajDb.close()
  await Dexie.delete(NOM_BASE_LOCALE)
})

describe('montée de version 2 → 3 sur une base déjà remplie', () => {
  it('données v2 identiques, journal compris ; six tables nouvelles vides ; aucune écriture à la montée', async () => {
    const ancienne = baseV2()
    await ancienne.open()
    await remplir(ancienne)
    const noms = ancienne.tables.map((t) => t.name)
    const avant = await contenu(ancienne, noms)
    ancienne.close()

    await ajDb.open()
    expect(ajDb.verno).toBe(3)
    expect(await contenu(ajDb, noms)).toEqual(avant)
    for (const nom of NOUVELLES) expect(await ajDb.table(nom).count(), nom).toBe(0)
    // aucune fonction upgrade : le journal d'activité n'a reçu aucune entrée
    expect(await ajDb.activityLog.count()).toBe(1)
  })

  it('retour arrière : la base passée en version 3 se rouvre avec le code de la version 2, données gardées', async () => {
    const ancienne = baseV2()
    await ancienne.open()
    await remplir(ancienne)
    const noms = ancienne.tables.map((t) => t.name)
    const avant = await contenu(ancienne, noms)
    ancienne.close()

    await ajDb.open()
    ajDb.close()

    const retour = baseV2()
    await retour.open()
    expect(await contenu(retour, noms)).toEqual(avant)
    retour.close()
  })

  it('onglet resté ouvert sur l’ancien code : fermé à la montée, il se reconnecte tout seul et relit ses données', async () => {
    const avertissement = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const ancienne = baseV2()
    await ancienne.open()
    await remplir(ancienne)

    // l'onglet à jour ouvre la base en version 3 pendant que l'ancien est ouvert
    await ajDb.open()
    expect(ajDb.verno).toBe(3)
    expect(avertissement).toHaveBeenCalledWith(expect.stringContaining('Another connection wants to upgrade database'))

    // l'ancien onglet continue : réouverture automatique, lecture et écriture de l'ancien modèle sans erreur
    expect((await ancienne.table('coproprietaires').get('F9'))?.solde).toBe(-120.5)
    await ancienne.table('ecritures').add({ id: 'E3', journalId: 'J9', date: new Date(2026, 5, 3), compte: '450-F9', libelle: 'Encaissement', montant: 10, sens: 'credit', ...suivi })
    expect(await ajDb.ecritures.count()).toBe(3)
    // il n'écrit rien dans les tables nouvelles (il ne lance pas la migration)
    for (const nom of NOUVELLES) expect(await ajDb.table(nom).count(), nom).toBe(0)
    ancienne.close()
  })
})
