import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyserReleve, type EntreeAnalyseReleve } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/analyse-releve'
import { lireReleve } from '@/lib/administrateur-judiciaire/domain/import/lecture-releve'
import type { ReleveCompte } from '@/lib/administrateur-judiciaire/domain/import/releve-compte'
import { origineDuMouvement, releveImporte, type ReleveImporte } from '@/lib/administrateur-judiciaire/domain/import/releves-importes'

/**
 * Analyse d'un relevé structuré (CFONB 120, camt.053) quand des relevés ont déjà été importés sur le compte (décision du
 * 26/11/2026 du référent métier, PR 799, point 10 B) : un relevé gardé à un import précédent est reconnu, ses mouvements
 * ne sont pas repris, les autres relevés du fichier restent importables, et l'analyse le dit par un message par relevé.
 * Les relevés à garder à l'import (relevesAImporter) accompagnent les lignes retenues. Le CSV, sans identifiant de
 * relevé, garde son dédoublonnage et l'avertissement des mouvements semblables. Fichiers fictifs.
 */

const dossier = join(__dirname, 'fixtures', 'releves')
const CFONB = readFileSync(join(dossier, 'releve-nominal.cfonb120.txt'), 'latin1').replaceAll('\r\n', '\n')
const CAMT = readFileSync(join(dossier, 'releve-nominal.camt053.xml'), 'utf8')
/** Relevés 1 et 3 du fichier CFONB : ceux du seul compte 12345 00010 00012345678. */
const CFONB_UN_COMPTE = CFONB.split('\n')
  .filter((ligne) => !ligne.includes('00087654321'))
  .join('\n')
const CAMT_UN_RELEVE = CAMT.slice(0, CAMT.lastIndexOf('<Stmt>')) + CAMT.slice(CAMT.lastIndexOf('</Stmt>') + '</Stmt>'.length)
const IBAN_FIXTURE = 'FR7612345000100001234567849'

const entree = (texte: string, surcharge: Partial<EntreeAnalyseReleve> = {}): EntreeAnalyseReleve => ({
  texte,
  compte: { id: 'B1', iban: IBAN_FIXTURE },
  lignesBanque: [],
  personnes: [],
  ...surcharge,
})

/** Relevé gardé d'un relevé lu, importé en entier sur le compte B1 le 20/11/2026. */
const garde = (releve: ReleveCompte, id: string, banqueId = 'B1'): ReleveImporte =>
  releveImporte({ releve, repris: releve.mouvements }, { id, coproprieteId: 'C2', banqueId, dateImport: '2026-11-20' })

/** Lignes de banque écrites par l'import d'un relevé gardé : chacune avec l'origine de son mouvement. */
const lignesDe = (releve: ReleveCompte, releveId: string, compte = '512-B1'): EntreeAnalyseReleve['lignesBanque'] =>
  releve.mouvements.map((mouvement) => {
    const [annee, mois, jour] = mouvement.date.split('-').map(Number)
    return {
      compte,
      date: new Date(annee, mois - 1, jour),
      libelle: mouvement.libelle,
      montant: Math.abs(mouvement.montant),
      sens: mouvement.montant >= 0 ? 'debit' : 'credit',
      releve: origineDuMouvement(releveId, mouvement),
    }
  })

describe('relevé déjà importé sur le compte lors d’un import précédent', () => {
  it('tout le fichier déjà importé : aucun mouvement retenu, un message par relevé, rien à garder', () => {
    const releves = lireReleve(CFONB_UN_COMPTE).releves,
      gardes = releves.map((releve, rang) => garde(releve, `R${rang + 1}`))
    const analyse = analyserReleve(
      entree(CFONB_UN_COMPTE, { relevesImportes: gardes, lignesBanque: releves.flatMap((releve, rang) => lignesDe(releve, `R${rang + 1}`)) }),
    )
    expect(analyse.retenues).toEqual([])
    expect(analyse.doublons).toEqual([])
    expect(analyse.relevesAImporter).toEqual([])
    expect(analyse.releves.map((releve) => releve.etat)).toEqual(['importe_avant', 'importe_avant'])
    expect(analyse.relevesDejaImportes).toEqual([
      'Relevé 1 (RIB 12345 00010 00012345678 clé 49, du 30/09/2026 au 05/10/2026) : déjà importé sur ce compte le 20/11/2026, ses 4 mouvements ne sont pas repris.',
      'Relevé 2 (RIB 12345 00010 00012345678 clé 49, du 05/10/2026 au 06/10/2026) : déjà importé sur ce compte le 20/11/2026, son mouvement n’est pas repris.',
    ])
    // Dit une seule fois : ni dans les avertissements, ni comme ressemblance de lignes, ni comme limite.
    expect(analyse.avertissements).toEqual([])
    expect(analyse.limiteEmpreintes).toBe(false)
    // Rien ne bloque le fichier : il n'y a simplement plus rien à importer.
    expect(analyse.blocage).toBeNull()
  })

  it('un relevé déjà importé, un relevé nouveau : seul le nouveau est retenu, et lui seul est à garder', () => {
    const [premier] = lireReleve(CFONB_UN_COMPTE).releves
    const analyse = analyserReleve(entree(CFONB_UN_COMPTE, { relevesImportes: [garde(premier, 'R1')], lignesBanque: lignesDe(premier, 'R1') }))
    expect(analyse.releves.map((releve) => [releve.rang, releve.etat])).toEqual([
      [1, 'importe_avant'],
      [2, 'nouveau'],
    ])
    expect(analyse.retenues.map((ligne) => ligne.montant)).toEqual([-600])
    expect(analyse.relevesDejaImportes).toHaveLength(1)
    expect(analyse.relevesAImporter).toHaveLength(1)
    expect(analyse.relevesAImporter[0].releve.rang).toBe(2)
    expect(analyse.relevesAImporter[0].repris).toEqual(analyse.retenues)
  })

  it('le même relevé relu dans l’autre format (camt.053 après CFONB 120) : reconnu', () => {
    const [premier] = lireReleve(CFONB_UN_COMPTE).releves
    const analyse = analyserReleve(entree(CAMT_UN_RELEVE, { relevesImportes: [garde(premier, 'R1')], lignesBanque: lignesDe(premier, 'R1') }))
    expect(analyse.retenues).toEqual([])
    expect(analyse.relevesDejaImportes).toEqual([
      'Relevé 1 (IBAN FR7612345000100001234567849, du 30/09/2026 au 05/10/2026) : déjà importé sur ce compte le 20/11/2026, ses 4 mouvements ne sont pas repris.',
    ])
  })

  it('même identifiant qu’un relevé gardé, mais contenu différent : non repris, à vérifier, dit avec la date du premier import', () => {
    const [premier] = lireReleve(CAMT_UN_RELEVE).releves
    const analyse = analyserReleve(entree(CAMT_UN_RELEVE, { relevesImportes: [{ ...garde(premier, 'R1'), soldeClotureMineur: 1 }] }))
    expect(analyse.retenues).toEqual([])
    expect(analyse.releves.map((releve) => releve.etat)).toEqual(['importe_avant'])
    expect(analyse.relevesDejaImportes).toEqual([
      'Relevé 1 (IBAN FR7612345000100001234567849, du 30/09/2026 au 05/10/2026) : même identifiant « RELEVE-2026-10-05-A » qu’un relevé importé sur ce compte le 20/11/2026, mais période, soldes ou totaux différents ; relevé non repris, à vérifier.',
    ])
  })

  it('relevé gardé sur un autre compte bancaire : il n’est pas un relevé déjà importé sur ce compte', () => {
    const [premier] = lireReleve(CAMT_UN_RELEVE).releves
    const analyse = analyserReleve(entree(CAMT_UN_RELEVE, { relevesImportes: [garde(premier, 'R1', 'B2')], lignesBanque: lignesDe(premier, 'R1', '512-B2') }))
    expect(analyse.retenues).toHaveLength(4)
    expect(analyse.relevesDejaImportes).toEqual([])
    expect(analyse.releves.map((releve) => releve.etat)).toEqual(['nouveau'])
  })

  it('même relevé deux fois dans le fichier, jamais importé : « déjà dans le fichier », comme avant, dit dans les avertissements', () => {
    const lignes = CFONB_UN_COMPTE.split('\n'),
      releve1 = lignes.slice(0, lignes.findIndex((ligne) => ligne.startsWith('07')) + 1)
    const analyse = analyserReleve(entree([...releve1, ...releve1].join('\n')))
    expect(analyse.releves.map((releve) => releve.etat)).toEqual(['nouveau', 'deja_importe'])
    expect(analyse.relevesDejaImportes).toEqual([])
    expect(analyse.avertissements.some((texte) => texte.includes('déjà importé : 4 mouvements non repris'))).toBe(true)
    expect(analyse.relevesAImporter.map((aGarder) => [aGarder.releve.rang, aGarder.repris.length])).toEqual([[1, 4]])
  })
})

describe('mouvement déjà importé d’un autre relevé, reconnu par la référence de la banque gardée sur la ligne', () => {
  it('relevé nouveau dont un mouvement est déjà sur le compte : mouvement écarté, relevé gardé avec ses seuls mouvements repris', () => {
    const [premier] = lireReleve(CAMT_UN_RELEVE).releves,
      // Autre relevé (identifiant, période et soldes différents) : il ne porte que le premier mouvement du fichier.
      ancien: ReleveCompte = {
        ...premier,
        identifiant: 'RELEVE-2026-10-01-A',
        dateCloture: '2026-10-01',
        soldeClotureMineur: premier.soldeOuvertureMineur + premier.mouvements[0].montantMineur,
        totalCreditsMineur: premier.mouvements[0].montantMineur,
        totalDebitsMineur: 0,
        mouvements: [premier.mouvements[0]],
      }
    const analyse = analyserReleve(entree(CAMT_UN_RELEVE, { relevesImportes: [garde(ancien, 'R0')], lignesBanque: lignesDe(ancien, 'R0') }))
    expect(analyse.releves.map((releve) => releve.etat)).toEqual(['nouveau'])
    expect(analyse.doublons.map((ligne) => ligne.montant)).toEqual([350])
    expect(analyse.retenues.map((ligne) => ligne.montant)).toEqual([-1234.56, 120, -12.5])
    expect(analyse.relevesAImporter).toHaveLength(1)
    expect(analyse.relevesAImporter[0].repris).toEqual(analyse.retenues)
    expect(analyse.avertissements.some((texte) => texte.includes('relevé repris en partie, à vérifier'))).toBe(true)
  })
})

describe('lignes sans relevé gardé : importées d’un CSV ou avant que les relevés soient gardés', () => {
  const ancienne = { compte: '512-B1', date: new Date(2026, 8, 15), libelle: 'VIR ANCIEN', montant: 10, sens: 'debit' } as const

  it('compte qui porte de telles lignes : la limite est dite (un relevé qui les contient n’est pas reconnu)', () => {
    expect(analyserReleve(entree(CAMT_UN_RELEVE, { lignesBanque: [ancienne] })).limiteEmpreintes).toBe(true)
    // Ligne non rattachée (« 512 » seul, importée avant le choix du compte) : son compte n'est pas connu, la limite est dite.
    expect(analyserReleve(entree(CAMT_UN_RELEVE, { lignesBanque: [{ ...ancienne, compte: '512' }] })).limiteEmpreintes).toBe(true)
    // Ligne d'un autre compte bancaire : sans effet sur ce compte.
    expect(analyserReleve(entree(CAMT_UN_RELEVE, { lignesBanque: [{ ...ancienne, compte: '512-B2' }] })).limiteEmpreintes).toBe(false)
  })

  it('l’avertissement des mouvements semblables reste, pour un relevé structuré comme avant', () => {
    const [premier] = lireReleve(CAMT_UN_RELEVE).releves
    const analyse = analyserReleve(
      entree(CAMT_UN_RELEVE, { lignesBanque: [{ compte: '512-B1', date: new Date(2026, 9, 1), libelle: premier.mouvements[0].libelle, montant: 350, sens: 'debit' }] }),
    )
    expect(analyse.retenues).toHaveLength(4)
    expect(analyse.avertissements).toContain(
      '1 mouvement de même date, même montant et même libellé qu’une ligne déjà enregistrée sur ce compte : relevé peut-être déjà importé, à vérifier.',
    )
    expect(analyse.limiteEmpreintes).toBe(true)
  })

  it('CSV : aucun relevé à garder, dédoublonnage par date, montant et libellé inchangé, aucune limite dite', () => {
    const csv = 'Date;Libellé;Montant\n15/09/2026;VIR ANCIEN;10,00\n05/10/2026;VIR SEPA;350,00'
    const analyse = analyserReleve(entree(csv, { lignesBanque: [ancienne], relevesImportes: [garde(lireReleve(CAMT_UN_RELEVE).releves[0], 'R1')] }))
    expect(analyse.format).toBe('csv')
    expect(analyse.doublons.map((ligne) => ligne.libelle)).toEqual(['VIR ANCIEN'])
    expect(analyse.retenues.map((ligne) => ligne.libelle)).toEqual(['VIR SEPA'])
    expect(analyse.relevesAImporter).toEqual([])
    expect(analyse.relevesDejaImportes).toEqual([])
    expect(analyse.limiteEmpreintes).toBe(false)
  })

  it('sans compte choisi : analyse possible, rien n’est comparé aux relevés gardés', () => {
    const [premier] = lireReleve(CAMT_UN_RELEVE).releves
    const analyse = analyserReleve(entree(CAMT_UN_RELEVE, { compte: null, relevesImportes: [garde(premier, 'R1')] }))
    expect(analyse.retenues).toHaveLength(4)
    expect(analyse.relevesDejaImportes).toEqual([])
    expect(analyse.limiteEmpreintes).toBe(false)
  })
})
