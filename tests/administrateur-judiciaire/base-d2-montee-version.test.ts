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
 * Version 4 (table « encaissements », imputation aux comptes D2) : mêmes garanties, la base ouverte par le code courant
 * est en version 4 ; une base en version 3 remplie (compte, échéance appelée, pièce) y monte sans qu'aucune donnée ne bouge.
 * Version 5 (table « relevesImportes », décision du 26/11/2026 du référent métier, PR 799, point 10 B) : mêmes garanties,
 * la base ouverte par le code courant est en version 5 ; une base en version 4 remplie (lignes de relevé au sous-compte
 * 512 d'un compte bancaire, arrêté, encaissement) y monte sans qu'aucune donnée ne bouge, la table nouvelle est vide :
 * les relevés importés avant cette version n'ont pas d'empreinte, et aucune n'est inventée à la montée.
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

const NOUVELLES = ['identites', 'positions', 'comptesCoproprietaires', 'clesRepartition', 'echeancesAppel', 'traitements', 'encaissements', 'relevesImportes']

/** Code de la version 3 : baseV2 et le bloc version(3) de db/schema.ts, recopié tel quel (fixture). */
function baseV3(): Dexie {
  const db = baseV2()
  db.version(3).stores({
    identites: 'id',
    positions: 'id, lotId, identiteId',
    comptesCoproprietaires: 'id, coproprieteId, &[coproprieteId+serie]',
    clesRepartition: 'id, coproprieteId, &[coproprieteId+code]',
    echeancesAppel: '[coproprieteId+id], coproprieteId',
    traitements: 'id, coproprieteId, mandatId, &numero',
  })
  return db
}

/** Code de la version 4 : baseV3 et le bloc version(4) de db/schema.ts, recopié tel quel (fixture). */
function baseV4(): Dexie {
  const db = baseV3()
  db.version(4).stores({
    encaissements: 'id, coproprieteId',
  })
  return db
}

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

describe('montée de version 2 → 5 (par les versions 3 et 4) sur une base déjà remplie', () => {
  it('données v2 identiques, journal compris ; huit tables nouvelles vides ; aucune écriture à la montée', async () => {
    const ancienne = baseV2()
    await ancienne.open()
    await remplir(ancienne)
    const noms = ancienne.tables.map((t) => t.name)
    const avant = await contenu(ancienne, noms)
    ancienne.close()

    await ajDb.open()
    expect(ajDb.verno).toBe(5)
    expect(await contenu(ajDb, noms)).toEqual(avant)
    for (const nom of NOUVELLES) expect(await ajDb.table(nom).count(), nom).toBe(0)
    // aucune fonction upgrade : le journal d'activité n'a reçu aucune entrée
    expect(await ajDb.activityLog.count()).toBe(1)
  })

  it('retour arrière : la base passée en version 5 se rouvre avec le code de la version 2, données gardées', async () => {
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

    // l'onglet à jour ouvre la base en version 5 pendant que l'ancien est ouvert
    await ajDb.open()
    expect(ajDb.verno).toBe(5)
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

describe('montée de version 3 → 5 (par la version 4) sur une base D2 déjà remplie', () => {
  /** Base v3 : la base v2 remplie, plus un compte, une clé, une échéance appelée et sa pièce d'appel (fictifs). */
  async function remplirD2(db: Dexie): Promise<void> {
    await remplir(db)
    await db.table('comptesCoproprietaires').add({ id: 'CPT9', coproprieteId: 'C9', serie: '00001', libelle: 'Personne Fictive', ...suivi })
    await db.table('clesRepartition').add({ id: 'CLE9', coproprieteId: 'C9', code: '001', libelle: 'Charges communes générales', lots: [{ lotId: 'L9', tantiemes: 1000 }], totalTantiemes: 1000, ...suivi })
    await db.table('echeancesAppel').add({ id: 'A-20270101-001-1', coproprieteId: 'C9', cleId: 'CLE9', exigibilite: '2027-01-01', libelle: 'Provisions T1 2027', montantCentimes: 12_500, nature: 'budget', statut: 'Appelé', traitementId: 'appel-9', ...suivi })
    await db.table('traitements').add({ id: 'appel-9', numero: 1, famille: 'Appel de fonds', date: '2027-01-01', coproprieteId: 'C9', mandatId: 'M9', nbLignes: 2, statut: 'Produit', parametres: [], ...suivi })
  }

  it('données v3 identiques, journal compris ; tables « encaissements » et « relevesImportes » vides ; aucune écriture à la montée', async () => {
    const ancienne = baseV3()
    await ancienne.open()
    expect(ancienne.verno).toBe(3)
    await remplirD2(ancienne)
    const noms = ancienne.tables.map((t) => t.name)
    const avant = await contenu(ancienne, noms)
    ancienne.close()

    await ajDb.open()
    expect(ajDb.verno).toBe(5)
    expect(await contenu(ajDb, noms)).toEqual(avant)
    expect(await ajDb.encaissements.count()).toBe(0)
    expect(await ajDb.relevesImportes.count()).toBe(0)
    expect(await ajDb.activityLog.count()).toBe(1)
  })

  it('retour arrière : la base passée en version 5 se rouvre avec le code de la version 3, données gardées', async () => {
    const ancienne = baseV3()
    await ancienne.open()
    await remplirD2(ancienne)
    const noms = ancienne.tables.map((t) => t.name)
    const avant = await contenu(ancienne, noms)
    ancienne.close()

    await ajDb.open()
    ajDb.close()

    const retour = baseV3()
    await retour.open()
    expect(await contenu(retour, noms)).toEqual(avant)
    retour.close()
  })
})

describe('montée de version 4 → 5 sur une base déjà remplie de relevés importés avant cette version', () => {
  /**
   * Base v4 : la base v2 remplie, plus un compte bancaire, deux lignes de relevé importées sur son sous-compte 512 (dont
   * une sortie et son 471), un arrêté de rapprochement et un encaissement de copropriétaire (fictifs).
   */
  async function remplirV4(db: Dexie): Promise<void> {
    await remplir(db)
    await db.table('banques').add({ id: 'B9', coproprieteId: 'C9', nature: 'courant', libelle: 'Compte principal', iban: 'FR7630006000011234567890189', bic: null, etablissement: null, ...suivi })
    await db.table('ecritures').bulkAdd([
      { id: 'E10', journalId: 'J9', date: new Date(2026, 9, 1), compte: '512-B9', libelle: 'VIR SEPA RECU', montant: 350, sens: 'debit', ...suivi },
      { id: 'E11', journalId: 'J9', date: new Date(2026, 9, 2), compte: '512-B9', libelle: 'PRLV SEPA', montant: 123.45, sens: 'credit', ...suivi },
      { id: 'E12', journalId: 'J9', date: new Date(2026, 9, 2), compte: '471', libelle: 'À ventiler · PRLV SEPA · relevé E11', montant: 123.45, sens: 'debit', ...suivi },
    ])
    await db.table('rapprochements').add({ id: 'RA9', bancaireId: 'B9', dateArrete: '2026-10-05', soldeBanqueCentimes: 22_655, soldeComptaCentimes: 22_655, statut: 'Clôturé', elements: [], ...suivi })
    await db.table('encaissements').add({ id: 'ENC9', coproprieteId: 'C9', ...suivi })
  }

  it('données v4 identiques, journal compris ; table « relevesImportes » vide ; aucune écriture à la montée', async () => {
    const ancienne = baseV4()
    await ancienne.open()
    expect(ancienne.verno).toBe(4)
    await remplirV4(ancienne)
    const noms = ancienne.tables.map((t) => t.name)
    const avant = await contenu(ancienne, noms)
    ancienne.close()

    await ajDb.open()
    expect(ajDb.verno).toBe(5)
    expect(await contenu(ajDb, noms)).toEqual(avant)
    // Aucune empreinte inventée pour les relevés importés avant cette version : la table est vide, les lignes sans origine.
    expect(await ajDb.relevesImportes.count()).toBe(0)
    for (const ecriture of await ajDb.ecritures.toArray()) expect('releve' in ecriture, ecriture.id).toBe(false)
    expect(await ajDb.activityLog.count()).toBe(1)
  })

  it('retour arrière : la base passée en version 5 se rouvre avec le code de la version 4, données gardées', async () => {
    const ancienne = baseV4()
    await ancienne.open()
    await remplirV4(ancienne)
    const noms = ancienne.tables.map((t) => t.name)
    const avant = await contenu(ancienne, noms)
    ancienne.close()

    await ajDb.open()
    ajDb.close()

    const retour = baseV4()
    await retour.open()
    expect(await contenu(retour, noms)).toEqual(avant)
    retour.close()
  })

  it('onglet resté ouvert sur le code de la version 4 : il se reconnecte tout seul, sans écrire dans la table nouvelle', async () => {
    const avertissement = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const ancienne = baseV4()
    await ancienne.open()
    await remplirV4(ancienne)

    await ajDb.open()
    expect(ajDb.verno).toBe(5)
    expect(avertissement).toHaveBeenCalledWith(expect.stringContaining('Another connection wants to upgrade database'))

    // L'ancien onglet importe encore une ligne de relevé, à l'ancienne : elle est lue par le nouveau code, sans origine.
    await ancienne.table('ecritures').add({ id: 'E13', journalId: 'J9', date: new Date(2026, 9, 3), compte: '512-B9', libelle: 'VIR SEPA RECU', montant: 10, sens: 'debit', ...suivi })
    expect(await ajDb.ecritures.count()).toBe(6)
    expect(await ajDb.relevesImportes.count()).toBe(0)
    ancienne.close()
  })
})
