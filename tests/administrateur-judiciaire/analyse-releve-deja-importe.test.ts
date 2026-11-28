import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MARCHES_A_SUIVRE_RELEVE_A_VERIFIER,
  analyserReleve,
  type EntreeAnalyseReleve,
} from '@/components/administrateur-judiciaire/modules/finances/tresorerie/analyse-releve'
import { lireReleve } from '@/lib/administrateur-judiciaire/domain/import/lecture-releve'
import type { ReleveCompte } from '@/lib/administrateur-judiciaire/domain/import/releve-compte'
import { origineDuMouvement, releveImporte, type ReleveImporte } from '@/lib/administrateur-judiciaire/domain/import/releves-importes'

/**
 * Analyse d'un relevé structuré (CFONB 120, camt.053) quand des relevés ont déjà été importés sur le compte (décision du
 * 26/11/2026 du référent métier, PR 799, point 10 B) : un relevé gardé à un import précédent est reconnu, ses mouvements
 * ne sont pas repris, les autres relevés du fichier restent importables, et l'analyse le dit par un message par relevé.
 * Les relevés à garder à l'import (relevesAImporter) accompagnent les lignes retenues. Le CSV, sans identifiant de
 * relevé, garde son dédoublonnage et l'avertissement des mouvements semblables. Fichiers fictifs.
 * Retours de la relecture du 27/11/2026 : un relevé gardé sur une autre fiche de compte de la copropriété est reconnu
 * aussi (deux fiches peuvent porter le même IBAN : le compte en banque est le même, et la trésorerie du syndicat
 * compterait deux fois ses mouvements) ; un relevé de même identifiant mais de contenu différent n'est pas dit « déjà
 * importé » (relevesAVerifier, état « a_verifier ») ; la limite des lignes sans relevé gardé dit si elles sont du compte
 * choisi, non rattachées à un compte, ou les deux.
 * Réponses du référent métier du 28/11/2026 : point #858 · 2 A, un relevé non repris dit sa marche à suivre, et un relevé
 * sans identifiant (CFONB 120) de même compte et de même période qu'un relevé gardé, mais de soldes différents, est
 * traité de même ; point #858 · 6 A, la limite des lignes sans relevé gardé n'est dite que si une de ces lignes est
 * datée dans la période d'un relevé analysé.
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
    expect(analyse.limiteEmpreintes).toBeNull()
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

  it('même identifiant qu’un relevé gardé, mais contenu différent : non repris, à vérifier, jamais dit « déjà importé »', () => {
    const [premier] = lireReleve(CAMT_UN_RELEVE).releves
    const analyse = analyserReleve(entree(CAMT_UN_RELEVE, { relevesImportes: [{ ...garde(premier, 'R1'), soldeClotureMineur: 1 }] }))
    expect(analyse.retenues).toEqual([])
    expect(analyse.relevesAImporter).toEqual([])
    // Ce n'est pas le même relevé : ni l'état « importé avant », ni un message parmi les relevés déjà importés.
    expect(analyse.releves.map((releve) => releve.etat)).toEqual(['a_verifier'])
    expect(analyse.relevesDejaImportes).toEqual([])
    expect(analyse.relevesAVerifier).toEqual([
      'Relevé 1 (IBAN FR7612345000100001234567849, du 30/09/2026 au 05/10/2026) : même identifiant « RELEVE-2026-10-05-A » qu’un relevé importé sur ce compte le 20/11/2026, mais période, soldes ou totaux différents ; relevé non repris, à vérifier.',
    ])
    // Dit une seule fois : pas répété dans les avertissements.
    expect(analyse.avertissements).toEqual([])
    // Réponse du 28/11/2026, point #858 · 2 A : l'écran dit quoi faire.
    expect(analyse.motifsAVerifier).toEqual(['identifiant'])
  })

  it('fichier sans relevé à vérifier : la liste des relevés à vérifier est vide, aucune marche à suivre', () => {
    const [premier] = lireReleve(CAMT_UN_RELEVE).releves
    for (const analyse of [
      analyserReleve(entree(CAMT_UN_RELEVE)),
      analyserReleve(entree(CAMT_UN_RELEVE, { relevesImportes: [garde(premier, 'R1')] })),
      analyserReleve(entree('Date;Libellé;Montant\n05/10/2026;VIR SEPA;350,00')),
    ]) {
      expect(analyse.relevesAVerifier).toEqual([])
      expect(analyse.motifsAVerifier).toEqual([])
    }
  })

  it('marche à suivre de chaque motif (réponse du 28/11/2026, point #858 · 2 A) : nouvel identifiant en camt.053, autre période sans identifiant', () => {
    expect(MARCHES_A_SUIVRE_RELEVE_A_VERIFIER).toEqual({
      identifiant: 'Marche à suivre : demander à la banque un relevé sous un nouvel identifiant.',
      periode: 'Marche à suivre : demander à la banque un relevé sur une autre période (un relevé CFONB 120 n’a pas d’identifiant).',
    })
  })

  it('CFONB 120, même compte et même période qu’un relevé gardé, nouveau solde différent : non repris, à vérifier, jamais dit « déjà importé »', () => {
    const [premier] = lireReleve(CFONB_UN_COMPTE).releves
    const analyse = analyserReleve(entree(CFONB_UN_COMPTE, { relevesImportes: [{ ...garde(premier, 'R1'), soldeClotureMineur: premier.soldeClotureMineur + 100 }] }))
    // Le relevé suivant du fichier (du 05/10 au 06/10/2026) reste importable.
    expect(analyse.releves.map((releve) => [releve.rang, releve.etat])).toEqual([
      [1, 'a_verifier'],
      [2, 'nouveau'],
    ])
    expect(analyse.retenues.map((ligne) => ligne.montant)).toEqual([-600])
    expect(analyse.relevesAImporter.map((aGarder) => aGarder.releve.rang)).toEqual([2])
    expect(analyse.relevesDejaImportes).toEqual([])
    expect(analyse.relevesAVerifier).toEqual([
      'Relevé 1 (RIB 12345 00010 00012345678 clé 49, du 30/09/2026 au 05/10/2026) : même période qu’un relevé importé sur ce compte le 20/11/2026, mais soldes ou totaux différents ; relevé non repris, à vérifier.',
    ])
    expect(analyse.motifsAVerifier).toEqual(['periode'])
    // Dit une seule fois : pas répété dans les avertissements.
    expect(analyse.avertissements).toEqual([])
    expect(analyse.blocage).toBeNull()
  })

  it('CFONB 120, ancien solde différent sur la même période, relevé gardé sur une autre fiche : à vérifier, la fiche est dite', () => {
    const [premier] = lireReleve(CFONB_UN_COMPTE).releves
    const analyse = analyserReleve(
      entree(CFONB_UN_COMPTE, {
        comptes: [{ id: 'B2', libelle: 'Ancien compte · …7849', cloture: true }],
        relevesImportes: [{ ...garde(premier, 'R1', 'B2'), soldeOuvertureMineur: premier.soldeOuvertureMineur + 100 }],
      }),
    )
    expect(analyse.relevesAVerifier).toEqual([
      'Relevé 1 (RIB 12345 00010 00012345678 clé 49, du 30/09/2026 au 05/10/2026) : même période qu’un relevé importé le 20/11/2026 sur un autre compte de la copropriété (« Ancien compte · …7849 », clôturé), mais soldes ou totaux différents ; relevé non repris, à vérifier.',
    ])
  })

  it('CFONB 120, même compte, autre période qu’un relevé gardé : relevé nouveau, repris', () => {
    const [premier] = lireReleve(CFONB_UN_COMPTE).releves
    const analyse = analyserReleve(entree(CFONB_UN_COMPTE, { relevesImportes: [{ ...garde(premier, 'R1'), dateOuverture: '2026-09-29', soldeClotureMineur: 1 }] }))
    expect(analyse.releves.map((releve) => releve.etat)).toEqual(['nouveau', 'nouveau'])
    expect(analyse.relevesAVerifier).toEqual([])
    expect(analyse.retenues).toHaveLength(5)
  })

  it('fichier d’un relevé de même identifiant et d’un relevé de même période : les deux motifs, dans l’ordre « identifiant », « période »', () => {
    // Second relevé du fichier camt.053 ramené sur le même compte (« RELEVE-2026-10-05-B », sans mouvement).
    const deuxReleves = CAMT.replace('FR7612345000100008765432121', 'FR7612345000100001234567849'),
      [premier, second] = lireReleve(deuxReleves).releves
    const analyse = analyserReleve(
      entree(deuxReleves, {
        relevesImportes: [
          // Gardé sans identifiant (comme lu d'un CFONB 120), même période, autre solde.
          { ...garde(premier, 'R1'), identifiant: null, numeroSequence: null, soldeClotureMineur: 1 },
          { ...garde(second, 'R2'), soldeClotureMineur: 1 },
        ],
      }),
    )
    expect(analyse.releves.map((releve) => releve.etat)).toEqual(['a_verifier', 'a_verifier'])
    expect(analyse.relevesAVerifier.map((message) => message.includes('même période'))).toEqual([true, false])
    expect(analyse.relevesAVerifier.map((message) => message.includes('même identifiant « RELEVE-2026-10-05-B »'))).toEqual([false, true])
    expect(analyse.motifsAVerifier).toEqual(['identifiant', 'periode'])
  })

  it('relevé gardé d’un autre compte en banque (autre IBAN) : il n’est pas un relevé déjà importé', () => {
    const [premier] = lireReleve(CAMT_UN_RELEVE).releves,
      ailleurs: ReleveCompte = { ...premier, compte: { ...premier.compte, iban: 'FR7630006000011234567890189' } }
    const analyse = analyserReleve(entree(CAMT_UN_RELEVE, { relevesImportes: [garde(ailleurs, 'R1', 'B2')], lignesBanque: lignesDe(ailleurs, 'R1', '512-B2') }))
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

describe('relevé déjà importé sur une autre fiche de compte de la copropriété (même compte en banque)', () => {
  // Fiches B2 et B3 : même IBAN que B1 (fiche clôturée puis recréée, ou saisie en double).
  const comptes: EntreeAnalyseReleve['comptes'] = [
    { id: 'B1', libelle: 'Compte principal · …7849', cloture: false },
    { id: 'B2', libelle: 'Ancien compte · …7849', cloture: true },
    { id: 'B3', libelle: 'Compte en double · …7849', cloture: false },
  ]

  it('même relevé gardé sur une autre fiche : reconnu, aucun mouvement repris, et la fiche est dite', () => {
    const [premier] = lireReleve(CAMT_UN_RELEVE).releves
    const analyse = analyserReleve(
      entree(CAMT_UN_RELEVE, { comptes, relevesImportes: [garde(premier, 'R1', 'B3')], lignesBanque: lignesDe(premier, 'R1', '512-B3') }),
    )
    expect(analyse.retenues).toEqual([])
    expect(analyse.relevesAImporter).toEqual([])
    expect(analyse.releves.map((releve) => releve.etat)).toEqual(['importe_avant'])
    expect(analyse.relevesDejaImportes).toEqual([
      'Relevé 1 (IBAN FR7612345000100001234567849, du 30/09/2026 au 05/10/2026) : déjà importé le 20/11/2026 sur un autre compte de la copropriété (« Compte en double · …7849 »), ses 4 mouvements ne sont pas repris.',
    ])
    expect(analyse.avertissements).toEqual([])
  })

  it('fiche clôturée : dite clôturée ; fiche que l’écran ne connaît pas : « un autre compte de la copropriété », sans nom', () => {
    const [premier] = lireReleve(CAMT_UN_RELEVE).releves
    expect(analyserReleve(entree(CAMT_UN_RELEVE, { comptes, relevesImportes: [garde(premier, 'R1', 'B2')] })).relevesDejaImportes).toEqual([
      'Relevé 1 (IBAN FR7612345000100001234567849, du 30/09/2026 au 05/10/2026) : déjà importé le 20/11/2026 sur un autre compte de la copropriété (« Ancien compte · …7849 », clôturé), ses 4 mouvements ne sont pas repris.',
    ])
    expect(analyserReleve(entree(CAMT_UN_RELEVE, { relevesImportes: [garde(premier, 'R1', 'B9')] })).relevesDejaImportes).toEqual([
      'Relevé 1 (IBAN FR7612345000100001234567849, du 30/09/2026 au 05/10/2026) : déjà importé le 20/11/2026 sur un autre compte de la copropriété, ses 4 mouvements ne sont pas repris.',
    ])
  })

  it('même identifiant, contenu différent, sur une autre fiche : à vérifier, la fiche est dite', () => {
    const [premier] = lireReleve(CAMT_UN_RELEVE).releves
    const analyse = analyserReleve(entree(CAMT_UN_RELEVE, { comptes, relevesImportes: [{ ...garde(premier, 'R1', 'B2'), soldeClotureMineur: 1 }] }))
    expect(analyse.retenues).toEqual([])
    expect(analyse.relevesDejaImportes).toEqual([])
    expect(analyse.relevesAVerifier).toEqual([
      'Relevé 1 (IBAN FR7612345000100001234567849, du 30/09/2026 au 05/10/2026) : même identifiant « RELEVE-2026-10-05-A » qu’un relevé importé le 20/11/2026 sur un autre compte de la copropriété (« Ancien compte · …7849 », clôturé), mais période, soldes ou totaux différents ; relevé non repris, à vérifier.',
    ])
  })

  it('mouvement d’un relevé nouveau déjà écrit sur une autre fiche (même référence de la banque) : écarté, pas compté deux fois', () => {
    const [premier] = lireReleve(CAMT_UN_RELEVE).releves,
      ancien: ReleveCompte = {
        ...premier,
        identifiant: 'RELEVE-2026-10-01-A',
        dateCloture: '2026-10-01',
        soldeClotureMineur: premier.soldeOuvertureMineur + premier.mouvements[0].montantMineur,
        totalCreditsMineur: premier.mouvements[0].montantMineur,
        totalDebitsMineur: 0,
        mouvements: [premier.mouvements[0]],
      }
    const analyse = analyserReleve(
      entree(CAMT_UN_RELEVE, { comptes, relevesImportes: [garde(ancien, 'R0', 'B2')], lignesBanque: lignesDe(ancien, 'R0', '512-B2') }),
    )
    expect(analyse.releves.map((releve) => releve.etat)).toEqual(['nouveau'])
    expect(analyse.doublons.map((ligne) => ligne.montant)).toEqual([350])
    expect(analyse.retenues.map((ligne) => ligne.montant)).toEqual([-1234.56, 120, -12.5])
    expect(analyse.relevesAImporter[0].repris).toEqual(analyse.retenues)
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
  // Ligne du 02/10/2026 : dans la période du relevé analysé (du 30/09/2026 au 05/10/2026).
  const ancienne = { compte: '512-B1', date: new Date(2026, 9, 2), libelle: 'VIR ANCIEN', montant: 10, sens: 'debit' } as const
  const datee = (annee: number, mois: number, jour: number) => ({ ...ancienne, date: new Date(annee, mois - 1, jour) })

  it('compte qui porte de telles lignes : la limite est dite (un relevé qui les contient n’est pas reconnu)', () => {
    expect(analyserReleve(entree(CAMT_UN_RELEVE, { lignesBanque: [ancienne] })).limiteEmpreintes).toBe('compte')
    // Ligne d'un autre compte bancaire : sans effet sur ce compte.
    expect(analyserReleve(entree(CAMT_UN_RELEVE, { lignesBanque: [{ ...ancienne, compte: '512-B2' }] })).limiteEmpreintes).toBeNull()
  })

  it('lignes non rattachées à un compte (« 512 » seul) : la limite le dit, sans les attribuer au compte choisi', () => {
    const nonRattachee = { ...ancienne, compte: '512' }
    // Compte neuf, sans aucune ligne : seules d'anciennes lignes non rattachées de la copropriété existent.
    expect(analyserReleve(entree(CAMT_UN_RELEVE, { lignesBanque: [nonRattachee] })).limiteEmpreintes).toBe('non_rattachees')
    expect(analyserReleve(entree(CAMT_UN_RELEVE, { lignesBanque: [ancienne, nonRattachee] })).limiteEmpreintes).toBe('compte_et_non_rattachees')
  })

  describe('réponse du référent métier du 28/11/2026, point #858 · 6 A : seulement si la période du relevé analysé recouvre la date de ces lignes', () => {
    const limite = (texte: string, lignesBanque: EntreeAnalyseReleve['lignesBanque']) => analyserReleve(entree(texte, { lignesBanque })).limiteEmpreintes

    it('lignes datées hors de la période du relevé (avant ou après) : la limite n’est pas dite', () => {
      expect(limite(CAMT_UN_RELEVE, [datee(2026, 9, 15)])).toBeNull()
      expect(limite(CAMT_UN_RELEVE, [datee(2026, 9, 29), datee(2026, 10, 6), datee(2026, 5, 10)])).toBeNull()
    })

    it('bornes comprises : ligne datée du premier ou du dernier jour de la période', () => {
      expect(limite(CAMT_UN_RELEVE, [datee(2026, 9, 30)])).toBe('compte')
      expect(limite(CAMT_UN_RELEVE, [datee(2026, 10, 5)])).toBe('compte')
    })

    it('une seule ligne dans la période suffit, parmi des lignes hors période', () => {
      expect(limite(CAMT_UN_RELEVE, [datee(2026, 5, 10), datee(2026, 10, 1), datee(2026, 11, 2)])).toBe('compte')
    })

    it('la variante dite ne compte que les lignes de la période : du compte, non rattachées, ou les deux', () => {
      const horsPeriode = datee(2026, 5, 10),
        nonRattachee = { ...ancienne, compte: '512' }
      expect(limite(CAMT_UN_RELEVE, [horsPeriode, nonRattachee])).toBe('non_rattachees')
      expect(limite(CAMT_UN_RELEVE, [ancienne, { ...horsPeriode, compte: '512' }])).toBe('compte')
      expect(limite(CAMT_UN_RELEVE, [horsPeriode, { ...horsPeriode, compte: '512' }])).toBeNull()
    })

    it('fichier de plusieurs relevés : la période de chacun compte', () => {
      // Relevés du 30/09 au 05/10/2026 et du 05/10 au 06/10/2026.
      expect(limite(CFONB_UN_COMPTE, [datee(2026, 10, 6)])).toBe('compte')
      expect(limite(CFONB_UN_COMPTE, [datee(2026, 10, 7)])).toBeNull()
    })

    it('ligne venue d’un relevé gardé, dans la période : elle a son relevé, la limite n’est pas dite pour elle', () => {
      const [premier] = lireReleve(CAMT_UN_RELEVE).releves,
        ancien: ReleveCompte = { ...premier, identifiant: 'RELEVE-2026-10-01-A', dateCloture: '2026-10-01', mouvements: [premier.mouvements[0]] }
      const analyse = analyserReleve(entree(CAMT_UN_RELEVE, { relevesImportes: [garde(ancien, 'R0')], lignesBanque: lignesDe(ancien, 'R0') }))
      expect(analyse.limiteEmpreintes).toBeNull()
    })
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
    expect(analyse.limiteEmpreintes).toBe('compte')
  })

  it('CSV : aucun relevé à garder, dédoublonnage par date, montant et libellé inchangé, aucune limite dite', () => {
    const csv = 'Date;Libellé;Montant\n02/10/2026;VIR ANCIEN;10,00\n05/10/2026;VIR SEPA;350,00'
    const analyse = analyserReleve(entree(csv, { lignesBanque: [ancienne], relevesImportes: [garde(lireReleve(CAMT_UN_RELEVE).releves[0], 'R1')] }))
    expect(analyse.format).toBe('csv')
    expect(analyse.doublons.map((ligne) => ligne.libelle)).toEqual(['VIR ANCIEN'])
    expect(analyse.retenues.map((ligne) => ligne.libelle)).toEqual(['VIR SEPA'])
    expect(analyse.relevesAImporter).toEqual([])
    expect(analyse.relevesDejaImportes).toEqual([])
    expect(analyse.limiteEmpreintes).toBeNull()
  })

  it('sans compte choisi : analyse possible, rien n’est comparé aux relevés gardés', () => {
    const [premier] = lireReleve(CAMT_UN_RELEVE).releves
    const analyse = analyserReleve(entree(CAMT_UN_RELEVE, { compte: null, relevesImportes: [garde(premier, 'R1')] }))
    expect(analyse.retenues).toHaveLength(4)
    expect(analyse.relevesDejaImportes).toEqual([])
    expect(analyse.limiteEmpreintes).toBeNull()
  })
})
