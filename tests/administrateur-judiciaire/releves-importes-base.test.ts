import './fuseau-paris'
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enregistrerCompteBancaire } from '@/lib/administrateur-judiciaire/db/comptes-bancaires'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { importerReleveSurCompte } from '@/lib/administrateur-judiciaire/db/releves-bancaires'
import { listerRelevesImportes } from '@/lib/administrateur-judiciaire/db/releves-importes'
import { repoEcritures } from '@/lib/administrateur-judiciaire/db/repositories'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { compteBanque, soldeCompteCentimes } from '@/lib/administrateur-judiciaire/db/sous-comptes-banque'
import { dateVersIso } from '@/lib/administrateur-judiciaire/domain/dates'
import { dedoublonnerRelevesStructures, empreinteReleve } from '@/lib/administrateur-judiciaire/domain/import/doublons-releves'
import { lireReleve } from '@/lib/administrateur-judiciaire/domain/import/lecture-releve'
import type { ReleveCompte } from '@/lib/administrateur-judiciaire/domain/import/releve-compte'
import { dejaImporteSurCompte, type ReleveRepris } from '@/lib/administrateur-judiciaire/domain/import/releves-importes'
import { AUJOURDHUI_ISO, CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'

/**
 * Table locale des relevés importés (décision du 26/11/2026 du référent métier, PR 799, points 10 B et 11 B) : base
 * locale en version 5, une table « relevesImportes » ; chaque relevé structuré importé y est gardé avec son empreinte et
 * son solde de clôture, dans la transaction de ses lignes ; chaque ligne garde les informations de son mouvement ; un
 * relevé déjà gardé sur le compte est refusé à l'écriture, sans rien écrire. Le CSV ne change pas. Base de
 * démonstration (Le Clos des Vignes, C2), fichiers fictifs.
 */

const dossier = join(__dirname, 'fixtures', 'releves')
const CFONB = readFileSync(join(dossier, 'releve-nominal.cfonb120.txt'), 'latin1').replaceAll('\r\n', '\n')
const CFONB_UN_COMPTE = CFONB.split('\n')
  .filter((ligne) => !ligne.includes('00087654321'))
  .join('\n')
const CAMT = readFileSync(join(dossier, 'releve-nominal.camt053.xml'), 'utf8')
const CAMT_UN_RELEVE = CAMT.slice(0, CAMT.lastIndexOf('<Stmt>')) + CAMT.slice(CAMT.lastIndexOf('</Stmt>') + '</Stmt>'.length)
// IBAN des fixtures (compte des relevés 1 et 3) : exemple déjà utilisé par lecture-releve.test.ts.
const IBAN_FIXTURE = 'FR76 1234 5000 1000 0123 4567 849'

const etat = () => useDonneesStore.getState()
const entiers = (releves: readonly ReleveCompte[]): ReleveRepris[] => releves.map((releve) => ({ releve, repris: releve.mouvements }))
const lignesDe = (releves: readonly ReleveRepris[]) => releves.flatMap((releve) => releve.repris)

let banqueId: string

beforeEach(async () => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loaded: false, loading: false })
  await etat().loadAll()
  banqueId = (await enregistrerCompteBancaire('C2', { nature: 'courant', libelle: 'Compte principal', iban: IBAN_FIXTURE, bic: null, etablissement: null })).id
})

describe('base locale en version 5 : table des relevés importés', () => {
  it('table « relevesImportes », dernière du schéma, lue par copropriété (D1) et par compte bancaire', () => {
    expect(ajDb.verno).toBe(5)
    const table = ajDb.tables.at(-1)
    expect(table?.name).toBe('relevesImportes')
    expect(table?.schema.primKey.src).toBe('id')
    expect(table?.schema.indexes.map((index) => index.src)).toEqual(['coproprieteId', 'banqueId'])
  })
})

describe('import d’un relevé structuré : le relevé et les informations de ses mouvements sont gardés', () => {
  it('CFONB 120 : un relevé gardé par relevé du fichier (empreinte, solde de clôture, compte, date d’import), lu par copropriété', async () => {
    const releves = lireReleve(CFONB_UN_COMPTE).releves
    await importerReleveSurCompte('C2', banqueId, lignesDe(entiers(releves)), entiers(releves))
    const gardes = await listerRelevesImportes('C2')
    expect(gardes).toHaveLength(2)
    expect(gardes.map((garde) => [garde.rang, garde.banqueId, garde.coproprieteId, garde.format, garde.dateImport])).toEqual([
      [1, banqueId, 'C2', 'cfonb120', AUJOURDHUI_ISO],
      [2, banqueId, 'C2', 'cfonb120', AUJOURDHUI_ISO],
    ])
    expect(gardes.map((garde) => [garde.dateOuverture, garde.dateCloture, garde.soldeOuvertureMineur, garde.soldeClotureMineur])).toEqual([
      ['2026-09-30', '2026-10-05', 125_000, 47_294],
      ['2026-10-05', '2026-10-06', 47_294, -12_706],
    ])
    expect(gardes.map((garde) => [garde.nombreMouvements, garde.nombreMouvementsRepris])).toEqual([
      [4, 4],
      [1, 1],
    ])
    for (const [rang, garde] of gardes.entries()) expect(garde).toMatchObject(empreinteReleve(releves[rang]))
    // Champs de suivi et journal d'activité, comme toute écriture de la base.
    expect(gardes[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(await ajDb.activityLog.where('entite').equals('relevesImportes').count()).toBe(2)
    expect(await listerRelevesImportes('C1')).toEqual([])
  })

  it('chaque ligne garde son relevé, la référence de la banque, la date de valeur et le payeur ; le 471 d’une sortie ne garde rien', async () => {
    const releves = lireReleve(CFONB_UN_COMPTE).releves
    const creees = await importerReleveSurCompte('C2', banqueId, lignesDe(entiers(releves)), entiers(releves))
    const gardes = await listerRelevesImportes('C2')
    expect(creees).toHaveLength(5)
    const [virement, prelevement] = creees
    expect(virement.releve).toMatchObject({
      releveId: gardes[0].id,
      referenceBanque: 'REF-BQ-000001',
      dateValeur: '2026-10-01',
      payeur: 'DURAND CLAIRE',
      referenceClient: 'E2E-T4-LOT12',
      numeroEcriture: '0000001',
      montantMineur: 35_000,
    })
    expect(prelevement.releve).toMatchObject({ releveId: gardes[0].id, referenceBanque: 'REF-BQ-000002', beneficiaire: 'SOCIETE DES EAUX FICTIVE' })
    expect(creees[4].releve?.releveId).toBe(gardes[1].id)
    // Relu de la base, pas seulement de la valeur rendue ; le store porte les mêmes lignes.
    const enBase = await ajDb.ecritures.where('journalId').equals(virement.journalId).toArray()
    expect(enBase.find((ecriture) => ecriture.id === virement.id)?.releve).toEqual(virement.releve)
    expect(etat().ecritures.find((ecriture) => ecriture.id === virement.id)?.releve).toEqual(virement.releve)
    const attentes = enBase.filter((ecriture) => ecriture.compte === '471')
    expect(attentes).toHaveLength(3)
    for (const attente of attentes) expect(attente.releve).toBeUndefined()
  })

  it('ce qui est gardé suffit à reconnaître le relevé à l’import suivant (relu de la base)', async () => {
    const releves = lireReleve(CAMT_UN_RELEVE).releves
    await importerReleveSurCompte('C2', banqueId, lignesDe(entiers(releves)), entiers(releves))
    const gardes = await listerRelevesImportes('C2'),
      lignes = (await ajDb.ecritures.toArray()).filter((ecriture) => ecriture.compte === compteBanque(banqueId)),
      deja = dejaImporteSurCompte(
        gardes,
        lignes.map((ecriture) => ({ date: dateVersIso(ecriture.date) ?? '', releve: ecriture.releve })),
      )
    // Le même relevé, relu en CFONB 120 : reconnu en entier.
    const resultat = dedoublonnerRelevesStructures(lireReleve(CFONB_UN_COMPTE).releves, deja)
    expect(resultat.dejaImportes.map((releve) => releve.rang)).toEqual([1])
    expect(resultat.nouveaux.map((releve) => releve.rang)).toEqual([2])
  })
})

describe('relevé déjà importé sur le compte : refusé à l’écriture, rien n’est écrit', () => {
  it('second import du même relevé (analyse périmée, autre onglet, double clic) : refus, ni ligne ni relevé en plus', async () => {
    const releves = lireReleve(CFONB_UN_COMPTE).releves
    await importerReleveSurCompte('C2', banqueId, lignesDe(entiers(releves)), entiers(releves))
    const solde = soldeCompteCentimes(await ajDb.ecritures.toArray(), compteBanque(banqueId))
    const lignesAvant = await ajDb.ecritures.count(),
      ecrituresEtat = etat().ecritures.length
    await expect(importerReleveSurCompte('C2', banqueId, lignesDe(entiers(releves)), entiers(releves))).rejects.toThrow(
      'Relevé 1 (RIB 12345 00010 00012345678 clé 49, du 30/09/2026 au 05/10/2026) : déjà importé sur ce compte. Analyser le fichier à nouveau.',
    )
    expect(await ajDb.ecritures.count()).toBe(lignesAvant)
    expect(await ajDb.relevesImportes.count()).toBe(2)
    expect(etat().ecritures).toHaveLength(ecrituresEtat)
    expect(soldeCompteCentimes(await ajDb.ecritures.toArray(), compteBanque(banqueId))).toBe(solde)
  })

  it('le même relevé relu dans l’autre format (camt.053 après CFONB 120) : refusé aussi', async () => {
    const cfonb = lireReleve(CFONB_UN_COMPTE).releves,
      camt = lireReleve(CAMT_UN_RELEVE).releves
    await importerReleveSurCompte('C2', banqueId, lignesDe(entiers(cfonb)), entiers(cfonb))
    await expect(importerReleveSurCompte('C2', banqueId, lignesDe(entiers(camt)), entiers(camt))).rejects.toThrow(/déjà importé sur ce compte/)
    expect(await ajDb.relevesImportes.count()).toBe(2)
  })

  it('même relevé deux fois dans le même import : refusé en entier', async () => {
    const [releve] = lireReleve(CAMT_UN_RELEVE).releves,
      deuxFois = entiers([releve, { ...releve, rang: 2, mouvements: releve.mouvements.map((mouvement) => ({ ...mouvement })) }])
    await expect(importerReleveSurCompte('C2', banqueId, lignesDe(deuxFois), deuxFois)).rejects.toThrow(/Relevé 2 .* déjà importé sur ce compte/)
    expect(await ajDb.relevesImportes.count()).toBe(0)
    expect((await ajDb.ecritures.toArray()).filter((ecriture) => ecriture.compte === compteBanque(banqueId))).toEqual([])
  })

  it('le même relevé sur un autre compte de la copropriété n’est pas un relevé déjà importé sur ce compte', async () => {
    const autre = await enregistrerCompteBancaire('C2', { nature: 'courant', libelle: 'Second compte', iban: IBAN_FIXTURE, bic: null, etablissement: null })
    const releves = lireReleve(CAMT_UN_RELEVE).releves
    await importerReleveSurCompte('C2', banqueId, lignesDe(entiers(releves)), entiers(releves))
    const copie = lireReleve(CAMT_UN_RELEVE).releves
    await expect(importerReleveSurCompte('C2', autre.id, lignesDe(entiers(copie)), entiers(copie))).resolves.toHaveLength(4)
    expect((await listerRelevesImportes('C2')).map((garde) => garde.banqueId)).toEqual([banqueId, autre.id])
  })
})

describe('une seule transaction : tout est écrit, ou rien', () => {
  it('échec de l’écriture d’une ligne : aucun relevé gardé, aucune ligne', async () => {
    const releves = lireReleve(CFONB_UN_COMPTE).releves
    const creation = repoEcritures.create.bind(repoEcritures)
    let appels = 0
    const espion = vi.spyOn(repoEcritures, 'create').mockImplementation(async (...arguments_) => {
      appels++
      if (appels === 3) throw new Error('Quota dépassé')
      return creation(...arguments_)
    })
    try {
      await expect(importerReleveSurCompte('C2', banqueId, lignesDe(entiers(releves)), entiers(releves))).rejects.toThrow('Quota dépassé')
    } finally {
      espion.mockRestore()
    }
    expect(await ajDb.relevesImportes.count()).toBe(0)
    expect((await ajDb.ecritures.toArray()).filter((ecriture) => ecriture.compte === compteBanque(banqueId))).toEqual([])
    expect(await ajDb.activityLog.where('entite').equals('relevesImportes').count()).toBe(0)
    // Rien n'ayant été gardé, le même import repasse ensuite en entier.
    await expect(importerReleveSurCompte('C2', banqueId, lignesDe(entiers(releves)), entiers(releves))).resolves.toHaveLength(5)
  })

  it('relevés et lignes qui ne se correspondent pas (mouvement d’un relevé absent des lignes, ou l’inverse) : refus, rien n’est écrit', async () => {
    const releves = entiers(lireReleve(CFONB_UN_COMPTE).releves)
    await expect(importerReleveSurCompte('C2', banqueId, lignesDe(releves).slice(1), releves)).rejects.toThrow(/ne correspondent pas/)
    await expect(
      importerReleveSurCompte('C2', banqueId, [...lignesDe(releves), { date: '2026-10-07', libelle: 'LIGNE EN TROP', montant: 1 }], releves),
    ).rejects.toThrow(/ne correspondent pas/)
    expect(await ajDb.relevesImportes.count()).toBe(0)
    expect((await ajDb.ecritures.toArray()).filter((ecriture) => ecriture.compte === compteBanque(banqueId))).toEqual([])
  })

  it('relevé repris en partie : gardé avec le nombre de mouvements repris ; relevé sans mouvement repris : gardé pour son solde', async () => {
    const [premier, second] = lireReleve(CFONB_UN_COMPTE).releves
    const releves: ReleveRepris[] = [
      { releve: premier, repris: premier.mouvements.slice(2) },
      { releve: second, repris: [] },
    ]
    await expect(importerReleveSurCompte('C2', banqueId, lignesDe(releves), releves)).resolves.toHaveLength(2)
    expect((await listerRelevesImportes('C2')).map((garde) => [garde.nombreMouvements, garde.nombreMouvementsRepris, garde.soldeClotureMineur])).toEqual([
      [4, 2, 47_294],
      [1, 0, -12_706],
    ])
  })
})

describe('CSV et import sans compte : inchangés', () => {
  const lignes = [
    { date: '2026-06-04', libelle: 'VIR ENCAISSEMENT A', montant: 100 },
    { date: '2026-06-05', libelle: 'PRLV FOURNISSEUR', montant: -40.5 },
  ]

  it('CSV sur un compte : aucun relevé gardé, lignes sans origine (le CSV n’a pas d’identifiant de relevé)', async () => {
    const creees = await importerReleveSurCompte('C2', banqueId, lignes)
    expect(await ajDb.relevesImportes.count()).toBe(0)
    for (const ecriture of creees) expect('releve' in ecriture).toBe(false)
    // Le même CSV peut être importé de nouveau à l'écriture : son dédoublonnage reste celui de l'analyse (date, montant, libellé).
    await expect(importerReleveSurCompte('C2', banqueId, lignes)).resolves.toHaveLength(2)
  })

  it('import du store sans compte (« 512 » seul) : inchangé ; des relevés sans compte bancaire sont refusés', async () => {
    await expect(etat().importerReleve('C2', lignes)).resolves.toHaveLength(2)
    const releves = entiers(lireReleve(CAMT_UN_RELEVE).releves)
    await expect(
      etat().importerReleve('C2', lignesDe(releves), '512', { banqueId, dateImport: AUJOURDHUI_ISO, releves }),
    ).rejects.toThrow(/sous-compte 512 du compte bancaire/)
    expect(await ajDb.relevesImportes.count()).toBe(0)
  })
})
