import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  dedoublonnerRelevesStructures,
  empreinteReleve,
  empreintesMouvements,
  reconnaitreReleve,
  type DejaImporte,
  type EmpreinteMouvement,
  type EmpreinteReleve,
} from '@/lib/administrateur-judiciaire/domain/import/doublons-releves'
import { lireReleve } from '@/lib/administrateur-judiciaire/domain/import/lecture-releve'
import { dedoublonnerReleve } from '@/lib/administrateur-judiciaire/domain/import/releve-bancaire'
import type { ReleveCompte } from '@/lib/administrateur-judiciaire/domain/import/releve-compte'

/**
 * Doublons des relevés structurés (CFONB 120, camt.053) : un relevé retenu, dont le solde a été contrôlé, n'est jamais
 * dédoublonné à l'intérieur ; un relevé déjà importé est reconnu par son identité, un mouvement déjà importé par sa
 * référence. Fichiers fictifs : tests/administrateur-judiciaire/fixtures/releves/.
 */

const fixture = (nom: string) => readFileSync(join(__dirname, 'fixtures', 'releves', nom), 'latin1').replaceAll('\r\n', '\n')
const CFONB = fixture('releve-nominal.cfonb120.txt')
const CAMT = readFileSync(join(__dirname, 'fixtures', 'releves', 'releve-nominal.camt053.xml'), 'utf8')
const CAMT_V08 = readFileSync(join(__dirname, 'fixtures', 'releves', 'releve-v08.camt053.xml'), 'utf8')
const RIEN: DejaImporte = { releves: [], mouvements: [] }

/** Ce que l'import garderait de relevés importés. */
const dejaImporte = (releves: readonly ReleveCompte[]): DejaImporte => ({
  releves: releves.map(empreinteReleve),
  mouvements: releves.flatMap(empreintesMouvements),
})

/** Frais de tenue de compte de 1,25 EUR le 01/10/2026, numéro d'écriture donné (compte 12345 00010 00012345678). */
const frais = (numero: string) =>
  `0412345090000010EUR2 0001234567813011026  011026${'FRAIS TENUE DE COMPTE'.padEnd(31)}  ${numero}  0000000000012N${' '.repeat(16)}`
/** Relevé équilibré : 100,00 − 1,25 − 1,25 = 97,50, deux frais identiques le même jour (écritures 0000001 et 0000002). */
const DEUX_FRAIS = [
  `0112345    00010EUR2 00012345678  300926${' '.repeat(50)}0000000001000{${' '.repeat(16)}`,
  frais('0000001'),
  frais('0000002'),
  `0712345    00010EUR2 00012345678  011026${' '.repeat(50)}0000000000975{${' '.repeat(16)}`,
].join('\r\n')

describe('doublons des relevés structurés — à l’intérieur d’un relevé', () => {
  it('deux mouvements identiques d’un relevé contrôlé sont deux mouvements réels : tous deux gardés', () => {
    for (const ligne of DEUX_FRAIS.split('\r\n')) expect(ligne).toHaveLength(120)
    const lecture = lireReleve(DEUX_FRAIS)
    expect(lecture.erreurs).toEqual([])
    expect(lecture.lignes.map((ligne) => [ligne.date, ligne.libelle, ligne.montant])).toEqual([
      ['2026-10-01', 'FRAIS TENUE DE COMPTE', -1.25],
      ['2026-10-01', 'FRAIS TENUE DE COMPTE', -1.25],
    ])
    // Le dédoublonnage du CSV (date, montant, libellé) les confondrait : il ne s'applique pas aux relevés structurés.
    expect(dedoublonnerReleve(lecture.lignes, []).retenues).toHaveLength(1)
    const resultat = dedoublonnerRelevesStructures(lecture.releves, RIEN)
    expect(resultat.lignes).toHaveLength(2)
    expect(resultat.lignes.reduce((somme, mouvement) => somme + mouvement.montantMineur, 0)).toBe(
      lecture.releves[0].soldeClotureMineur - lecture.releves[0].soldeOuvertureMineur,
    )
    expect(resultat).toMatchObject({ doublons: [], dejaImportes: [], avertissements: [] })
    expect(resultat.nouveaux.map((releve) => releve.rang)).toEqual([1])
  })
})

describe('doublons des relevés structurés — relevé déjà importé', () => {
  it('un relevé réimporté est reconnu en entier par son identifiant : aucun mouvement repris', () => {
    const resultat = dedoublonnerRelevesStructures(lireReleve(CAMT).releves, dejaImporte(lireReleve(CAMT).releves))
    expect(resultat.lignes).toEqual([])
    expect(resultat.nouveaux).toEqual([])
    expect(resultat.dejaImportes.map((releve) => releve.identifiant)).toEqual(['RELEVE-2026-10-05-A', 'RELEVE-2026-10-05-B'])
    expect(resultat.avertissements).toEqual([
      'Relevé 1 (IBAN FR7612345000100001234567849, du 30/09/2026 au 05/10/2026) déjà importé : 4 mouvements non repris.',
      'Relevé 2 (IBAN FR7612345000100008765432121, du 30/09/2026 au 05/10/2026) déjà importé : aucun mouvement.',
    ])
  })

  it('le même relevé lu en CFONB 120 puis en camt.053 est reconnu (RIB et IBAN, période, soldes, totaux)', () => {
    const resultat = dedoublonnerRelevesStructures(lireReleve(CAMT).releves, dejaImporte(lireReleve(CFONB).releves))
    expect(resultat.dejaImportes.map((releve) => releve.rang)).toEqual([1, 2])
    expect(resultat.lignes).toEqual([])
    // Relevé suivant (camt.053, du 05/10 au 06/10/2026), sans relevé gardé de sa période : nouveau, repris en entier.
    const suite = dedoublonnerRelevesStructures(lireReleve(CAMT_V08).releves, dejaImporte(lireReleve(CFONB).releves.slice(0, 2)))
    expect(suite.nouveaux.map((releve) => releve.identifiant)).toEqual(['RELEVE-2026-10-06-A'])
    expect(suite.lignes.map((mouvement) => mouvement.montant)).toEqual([-600, 80])
    expect(suite.avertissements).toEqual([])
  })

  it('le même relevé deux fois dans un fichier : le second est reconnu', () => {
    const lecture = lireReleve(`${CAMT}\n${CAMT}`)
    expect(lecture.releves).toHaveLength(4)
    const resultat = dedoublonnerRelevesStructures(lecture.releves, RIEN)
    expect(resultat.nouveaux.map((releve) => releve.rang)).toEqual([1, 2])
    expect(resultat.dejaImportes.map((releve) => releve.rang)).toEqual([3, 4])
    expect(resultat.lignes).toHaveLength(4)
  })

  it('même identifiant mais période ou soldes différents : relevé non repris, avertissement à vérifier', () => {
    const [releve] = lireReleve(CAMT).releves,
      resultat = dedoublonnerRelevesStructures([releve], { releves: [{ ...empreinteReleve(releve), soldeClotureMineur: 0 }], mouvements: [] })
    expect(resultat.dejaImportes).toEqual([releve])
    expect(resultat.avertissements).toEqual([
      'Relevé 1 (IBAN FR7612345000100001234567849, du 30/09/2026 au 05/10/2026) : même identifiant « RELEVE-2026-10-05-A » ' +
        'qu’un relevé déjà importé, mais période, soldes ou totaux différents ; relevé non repris, à vérifier.',
    ])
  })

  it('sans identifiant commun : même compte, même période, mêmes soldes et totaux ; numéros de séquence non contradictoires', () => {
    const [releve] = lireReleve(CAMT).releves,
      sansIdentifiant = { ...empreinteReleve(releve), identifiant: null },
      reconnu = (empreinte: EmpreinteReleve) => dedoublonnerRelevesStructures([releve], { releves: [empreinte], mouvements: [] }).dejaImportes.length
    expect(releve.numeroSequence).toBe('41')
    expect(reconnu(sansIdentifiant)).toBe(1)
    expect(reconnu({ ...sansIdentifiant, numeroSequence: null })).toBe(1)
    expect(reconnu({ ...sansIdentifiant, numeroSequence: '42' })).toBe(0)
    // Soldes ou totaux différents sur la même période : voir le bloc de la réponse du 28/11/2026 (relevé non repris).
    expect(reconnu({ ...sansIdentifiant, dateCloture: '2026-10-06' })).toBe(0)
    expect(reconnu({ ...sansIdentifiant, dateOuverture: '2026-09-29' })).toBe(0)
    expect(reconnu({ ...sansIdentifiant, devise: 'XPF' })).toBe(0)
    expect(reconnu({ ...sansIdentifiant, compte: { ...releve.compte, iban: 'FR7612345000100008765432121' } })).toBe(0)
    expect(reconnu({ ...empreinteReleve(releve), identifiant: 'AUTRE-RELEVE' })).toBe(0)
  })
})

describe('relevé de même compte et de même période qu’un relevé déjà importé, sans identifiant commun (réponse du référent métier du 28/11/2026, point #858 · 2 A)', () => {
  // Relevés 1 et 3 du fichier CFONB : compte 12345 00010 00012345678, du 30/09 au 05/10/2026 puis du 05/10 au 06/10/2026.
  const relevesCfonb = (): ReleveCompte[] => lireReleve(CFONB).releves.filter((releve) => releve.compte.rib?.numero === '00012345678'),
    comparaison = (releve: ReleveCompte, connu: EmpreinteReleve) => reconnaitreReleve(empreinteReleve(releve), [connu])?.comparaison ?? null

  it('CFONB 120 : nouveau solde différent de celui du relevé gardé, même période : relevé non repris, à vérifier', () => {
    const [releve] = relevesCfonb(),
      connu = { ...empreinteReleve(releve), soldeClotureMineur: releve.soldeClotureMineur + 100 },
      resultat = dedoublonnerRelevesStructures([releve], { releves: [connu], mouvements: [] })
    expect(releve.identifiant).toBeNull()
    expect(resultat.lignes).toEqual([])
    expect(resultat.nouveaux).toEqual([])
    expect(resultat.dejaImportes).toEqual([releve])
    expect(resultat.reconnus.map((reconnu) => [reconnu.comparaison, reconnu.connu])).toEqual([['periode', connu]])
    expect(resultat.avertissements).toEqual([
      'Relevé 1 (RIB 12345 00010 00012345678 clé 49, du 30/09/2026 au 05/10/2026) : même période qu’un relevé déjà importé, ' +
        'mais soldes ou totaux différents ; relevé non repris, à vérifier.',
    ])
  })

  it('ancien solde différent, ou totaux différents à soldes égaux : même refus', () => {
    const [releve] = relevesCfonb(),
      empreinte = empreinteReleve(releve)
    expect(comparaison(releve, { ...empreinte, soldeOuvertureMineur: empreinte.soldeOuvertureMineur + 1 })).toBe('periode')
    expect(
      comparaison(releve, { ...empreinte, totalCreditsMineur: empreinte.totalCreditsMineur + 500, totalDebitsMineur: empreinte.totalDebitsMineur + 500 }),
    ).toBe('periode')
    // Même période, mêmes soldes et mêmes totaux : c'est le même relevé, comme avant.
    expect(comparaison(releve, empreinte)).toBe('identique')
  })

  it('« même période » : mêmes dates de début et de fin ; une seule date différente : relevé distinct, repris', () => {
    const [premier, suivant] = relevesCfonb(),
      autreSolde = { ...empreinteReleve(premier), soldeClotureMineur: 1 }
    expect(comparaison(premier, { ...autreSolde, dateCloture: '2026-10-06' })).toBeNull()
    expect(comparaison(premier, { ...autreSolde, dateOuverture: '2026-09-29' })).toBeNull()
    // Relevé suivant du même compte (du 05/10 au 06/10/2026) : son ancien solde est le nouveau solde du premier, il est repris.
    const resultat = dedoublonnerRelevesStructures([suivant], { releves: [empreinteReleve(premier)], mouvements: [] })
    expect(resultat.nouveaux).toEqual([suivant])
    expect(resultat.avertissements).toEqual([])
  })

  it('autre compte ou autre devise : jamais confondus', () => {
    const [releve] = relevesCfonb(),
      autreSolde = { ...empreinteReleve(releve), soldeClotureMineur: 1 }
    expect(comparaison(releve, { ...autreSolde, devise: 'XPF' })).toBeNull()
    expect(comparaison(releve, { ...autreSolde, compte: { ...releve.compte, rib: { banque: '12345', guichet: '00010', numero: '00087654321', cle: '21' } } })).toBeNull()
  })

  it('relevé gardé d’un CFONB 120, relevé analysé en camt.053 (un seul porte un identifiant) : même période, autre solde, non repris', () => {
    // Relevé 3 du fichier CFONB (du 05/10 au 06/10/2026, un chèque) ; le camt.053 de la même période porte un mouvement de plus.
    const [releve] = lireReleve(CAMT_V08).releves,
      resultat = dedoublonnerRelevesStructures([releve], dejaImporte(lireReleve(CFONB).releves))
    expect(resultat.lignes).toEqual([])
    expect(resultat.reconnus.map((reconnu) => reconnu.comparaison)).toEqual(['periode'])
    expect(resultat.avertissements).toEqual([
      'Relevé 1 (IBAN FR7612345000100001234567849, du 05/10/2026 au 06/10/2026) : même période qu’un relevé déjà importé, ' +
        'mais soldes ou totaux différents ; relevé non repris, à vérifier.',
    ])
  })

  it('camt.053 sous un nouvel identifiant (la marche à suivre dite à l’écran) : relevé distinct, repris, même sur la même période', () => {
    const [releve] = lireReleve(CAMT).releves,
      connu = { ...empreinteReleve(releve), identifiant: 'RELEVE-2026-10-05-A-ANNULE', soldeClotureMineur: 1 }
    expect(comparaison(releve, connu)).toBeNull()
    expect(dedoublonnerRelevesStructures([releve], { releves: [connu], mouvements: [] }).nouveaux).toEqual([releve])
  })

  it('plusieurs relevés gardés : le même relevé l’emporte sur le même identifiant, qui l’emporte sur la même période', () => {
    const [releve] = lireReleve(CAMT).releves,
      empreinte = empreinteReleve(releve),
      memePeriode = { ...empreinte, identifiant: null, numeroSequence: null, soldeClotureMineur: 1 },
      memeIdentifiant = { ...empreinte, soldeClotureMineur: 2 },
      identique = { ...empreinte, identifiant: null, numeroSequence: null }
    expect(reconnaitreReleve(empreinte, [memePeriode, memeIdentifiant, identique])).toEqual({ connu: identique, comparaison: 'identique' })
    expect(reconnaitreReleve(empreinte, [memePeriode, memeIdentifiant])).toEqual({ connu: memeIdentifiant, comparaison: 'identifiant' })
    expect(reconnaitreReleve(empreinte, [memePeriode])).toEqual({ connu: memePeriode, comparaison: 'periode' })
  })

  it('numéros de séquence contraires : relevés distincts, comme avant', () => {
    const [releve] = lireReleve(CAMT).releves,
      sansIdentifiant = { ...empreinteReleve(releve), identifiant: null }
    expect(comparaison(releve, { ...sansIdentifiant, numeroSequence: '42', soldeClotureMineur: 1 })).toBeNull()
  })

  it('deux relevés de même période et de soldes différents dans un même fichier : le second n’est pas repris', () => {
    const [releve] = relevesCfonb(),
      second: ReleveCompte = { ...releve, rang: 2, soldeOuvertureMineur: releve.soldeOuvertureMineur + 100, soldeClotureMineur: releve.soldeClotureMineur + 100 },
      resultat = dedoublonnerRelevesStructures([releve, second], RIEN)
    expect(resultat.nouveaux).toEqual([releve])
    expect(resultat.dejaImportes).toEqual([second])
    expect(resultat.lignes).toEqual(releve.mouvements)
    expect(resultat.avertissements).toEqual([
      'Relevé 2 (RIB 12345 00010 00012345678 clé 49, du 30/09/2026 au 05/10/2026) : même période qu’un relevé déjà importé, ' +
        'mais soldes ou totaux différents ; relevé non repris, à vérifier.',
    ])
  })
})

describe('doublons des relevés structurés — mouvement déjà importé', () => {
  const [releve] = lireReleve(CAMT).releves,
    [virement, prelevement] = releve.mouvements,
    empreinte: EmpreinteMouvement = {
      compte: releve.compte,
      devise: 'EUR',
      date: '2026-10-01',
      montantMineur: 35_000,
      referenceBanque: 'REF-BQ-000001',
      numeroEcriture: null,
    }

  it('reconnu par sa référence banque (même compte, date et montant) : écarté, relevé repris en partie avec un avertissement', () => {
    const resultat = dedoublonnerRelevesStructures([releve], { releves: [], mouvements: [empreinte] })
    expect(resultat.doublons).toEqual([virement])
    expect(resultat.lignes).toEqual(releve.mouvements.slice(1))
    expect(resultat.nouveaux).toEqual([releve])
    expect(resultat.avertissements).toEqual([
      'Relevé 1 (IBAN FR7612345000100001234567849, du 30/09/2026 au 05/10/2026) : 1 mouvement déjà importé ' +
        '(même référence de la banque ou même numéro d’écriture) écarté ; relevé repris en partie, à vérifier.',
    ])
  })

  it('à défaut de référence banque, par le numéro d’écriture ; jamais sur un autre compte, une autre date ou un autre montant', () => {
    const doublons = (autre: Partial<EmpreinteMouvement>) =>
      dedoublonnerRelevesStructures([releve], { releves: [], mouvements: [{ ...empreinte, ...autre }] }).doublons
    expect(doublons({ referenceBanque: null, numeroEcriture: '0000002', date: '2026-10-02', montantMineur: -123_456 })).toEqual([prelevement])
    expect(doublons({ referenceBanque: 'REF-BQ-AUTRE', numeroEcriture: '0000002', date: '2026-10-02', montantMineur: -123_456 })).toEqual([])
    expect(doublons({ montantMineur: 35_001 })).toEqual([])
    expect(doublons({ date: '2026-10-02' })).toEqual([])
    expect(doublons({ devise: 'XPF' })).toEqual([])
    expect(doublons({ compte: { ...releve.compte, iban: 'FR7612345000100008765432121' } })).toEqual([])
    expect(doublons({ referenceBanque: null })).toEqual([])
  })

  it('un mouvement sans référence ni numéro n’est jamais pris pour un doublon', () => {
    const resultat = dedoublonnerRelevesStructures(lireReleve(DEUX_FRAIS).releves, {
      releves: [],
      mouvements: [{ ...empreinte, compte: lireReleve(DEUX_FRAIS).releves[0].compte, date: '2026-10-01', montantMineur: -125, referenceBanque: null }],
    })
    expect(resultat.lignes).toHaveLength(2)
  })

  it('empreintes : ce qu’il faut garder d’un relevé et de ses mouvements pour les reconnaître', () => {
    expect(empreinteReleve(releve)).toEqual({
      compte: releve.compte,
      devise: 'EUR',
      identifiant: 'RELEVE-2026-10-05-A',
      numeroSequence: '41',
      dateOuverture: '2026-09-30',
      dateCloture: '2026-10-05',
      soldeOuvertureMineur: 125_000,
      soldeClotureMineur: 47_294,
      totalCreditsMineur: 47_000,
      totalDebitsMineur: 124_706,
    })
    expect(empreintesMouvements(releve)[0]).toEqual({ ...empreinte, numeroEcriture: '0000001' })
  })
})
