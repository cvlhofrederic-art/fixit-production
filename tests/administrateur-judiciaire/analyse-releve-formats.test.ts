import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  TAILLE_MAX_RELEVE_OCTETS,
  analyserReleve,
  decoderTexteReleve,
  refusTailleReleve,
  type EntreeAnalyseReleve,
} from '@/components/administrateur-judiciaire/modules/finances/tresorerie/analyse-releve'
import { lireReleve } from '@/lib/administrateur-judiciaire/domain/import/lecture-releve'

/**
 * Analyse d'un relevé avant import (écran « Banque et recouvrement ») pour les relevés CFONB 120 et camt.053, d'après le
 * mémo de branchement : lireReleve avec l'IBAN du compte choisi pour seul compte attendu ; dedoublonnerRelevesStructures
 * pour un relevé structuré (jamais dedoublonnerReleve) ; fichier avec une erreur : import bloqué, relevés lus montrés ;
 * depuis la décision du 26/11/2026 (PR 799, point 10 B), les relevés importés sont gardés (table « relevesImportes ») :
 * un relevé importé lors d'un import précédent est reconnu (analyse-releve-deja-importe.test.ts) ; la limite n'est plus
 * dite que pour un compte qui porte des lignes sans relevé gardé.
 */

const dossier = join(__dirname, 'fixtures', 'releves')
const CFONB = readFileSync(join(dossier, 'releve-nominal.cfonb120.txt'), 'latin1').replaceAll('\r\n', '\n')
const CAMT = readFileSync(join(dossier, 'releve-nominal.camt053.xml'), 'utf8')
/** Relevés 1 et 3 du fichier CFONB : ceux du seul compte 12345 00010 00012345678 (le relevé 2 est d'un autre compte). */
const CFONB_UN_COMPTE = CFONB.split('\n')
  .filter((ligne) => !ligne.includes('00087654321'))
  .join('\n')
/** Relevé 1 du fichier camt.053 seul (le relevé 2 est d'un autre compte). */
const CAMT_UN_RELEVE = CAMT.slice(0, CAMT.lastIndexOf('<Stmt>')) + CAMT.slice(CAMT.lastIndexOf('</Stmt>') + '</Stmt>'.length)
// IBAN des fixtures (compte des relevés 1 et 3) : exemple déjà utilisé par lecture-releve.test.ts.
const IBAN_FIXTURE = 'FR7612345000100001234567849'

const entree = (texte: string, compte: EntreeAnalyseReleve['compte'] = { id: 'B1', iban: IBAN_FIXTURE }): EntreeAnalyseReleve => ({
  texte,
  compte,
  lignesBanque: [],
  personnes: [],
})

describe('analyse d’un relevé structuré', () => {
  it('CFONB 120 d’un seul compte : relevés lus et contrôlés, mouvements retenus, import possible', () => {
    const analyse = analyserReleve(entree(CFONB_UN_COMPTE))
    expect(analyse.format).toBe('cfonb120')
    expect(analyse.erreurs).toEqual([])
    expect(analyse.blocage).toBeNull()
    expect(analyse.releves.map((releve) => [releve.rang, releve.mouvements, releve.etat])).toEqual([
      [1, 4, 'nouveau'],
      [2, 1, 'nouveau'],
    ])
    expect(analyse.releves[0].designation).toBe('Relevé 1 (RIB 12345 00010 00012345678 clé 49, du 30/09/2026 au 05/10/2026)')
    // Décision du 26/11/2026 (PR 799, rb-c08 A) : « 1 250,00 € » à l'écran, et non « 1 250,00 EUR ».
    expect(analyse.releves[0].ancienSolde).toBe('1 250,00 €')
    expect(analyse.releves[0].nouveauSolde).toBe('472,94 €')
    expect(analyse.retenues.map((ligne) => ligne.montant)).toEqual([350, -1234.56, 120, -12.5, -600])
    expect(analyse.doublons).toEqual([])
  })

  it('camt.053 : même lecture ; l’IBAN du compte choisi est le seul compte attendu', () => {
    const analyse = analyserReleve(entree(CAMT_UN_RELEVE))
    expect(analyse.format).toBe('camt053')
    expect(analyse.blocage).toBeNull()
    expect(analyse.retenues.map((ligne) => ligne.montant)).toEqual([350, -1234.56, 120, -12.5])
    // Autre compte choisi : le relevé est refusé, l'import bloqué.
    const autre = analyserReleve(entree(CAMT_UN_RELEVE, { id: 'B2', iban: 'FR76 3000 6000 0112 3456 7890 189' }))
    expect(autre.erreurs).toEqual([
      'Relevé 1 (IBAN FR7612345000100001234567849, du 30/09/2026 au 05/10/2026) refusé : compte absent des comptes attendus.',
    ])
    expect(autre.blocage).toMatch(/^Import bloqué/)
  })

  it('fichier avec une erreur (relevé d’un autre compte) : import bloqué, relevés lus montrés, toutes les erreurs gardées', () => {
    const analyse = analyserReleve(entree(CFONB))
    expect(analyse.erreurs).toEqual(lireReleve(CFONB, { comptesAttendus: [IBAN_FIXTURE] }).erreurs)
    expect(analyse.erreurs).toHaveLength(1)
    expect(analyse.blocage).toMatch(/^Import bloqué : le fichier contient une erreur/)
    expect(analyse.releves.map((releve) => releve.rang)).toEqual([1, 3])
  })

  it('format non reconnu : erreur et import bloqué', () => {
    const analyse = analyserReleve(entree('<releve><ligne/></releve>'))
    expect(analyse.format).toBe('inconnu')
    expect(analyse.erreurs).toEqual(['Format de relevé non reconnu : ni CSV, ni CFONB 120, ni camt.053.'])
    expect(analyse.blocage).toMatch(/^Import bloqué/)
    expect(analyse.retenues).toEqual([])
  })

  it('compte choisi sans IBAN : un relevé structuré ne peut pas lui être rapproché, import bloqué', () => {
    const analyse = analyserReleve(entree(CAMT_UN_RELEVE, { id: 'B1', iban: null }))
    expect(analyse.blocage).toBe(
      'Import bloqué : compte choisi sans IBAN, un relevé CFONB 120 ou camt.053 ne peut pas lui être rapproché. Saisir son IBAN dans « Comptes bancaires du mandat ».',
    )
  })

  it('même relevé deux fois dans le fichier : le second est reconnu (dedoublonnerRelevesStructures), ses mouvements ne sont pas repris', () => {
    const lignes = CFONB_UN_COMPTE.split('\n'),
      releve1 = lignes.slice(0, lignes.findIndex((ligne) => ligne.startsWith('07')) + 1)
    const analyse = analyserReleve(entree([...releve1, ...releve1].join('\n')))
    expect(analyse.releves.map((releve) => releve.etat)).toEqual(['nouveau', 'deja_importe'])
    expect(analyse.retenues).toHaveLength(4)
    expect(analyse.avertissements.some((texte) => texte.includes('déjà importé : 4 mouvements non repris'))).toBe(true)
  })

  it('mouvements identiques d’un même relevé : tous gardés (jamais dedoublonnerReleve) ; compte sans ligne : aucune limite à dire', () => {
    const lignes = CFONB_UN_COMPTE.split('\n'),
      fin = lignes.findIndex((ligne) => ligne.startsWith('07')),
      // Frais de tenue de compte (04 de 12,50) répétés : nouveau solde du relevé abaissé d'autant (472,94 → 460,44 ;
      // dernier chiffre signé : « D » = +4).
      frais = lignes.find((ligne) => ligne.includes('FRAIS TENUE DE COMPTE')) as string,
      releve = [...lignes.slice(0, fin), frais, lignes[fin].replace('0000000004729D', '0000000004604D')]
    const analyse = analyserReleve(entree(releve.join('\n')))
    expect(analyse.erreurs).toEqual([])
    expect(analyse.retenues.filter((ligne) => ligne.montant === -12.5)).toHaveLength(2)
    expect(analyse.limiteEmpreintes).toBeNull()
  })

  it('mouvement de même date, montant et libellé qu’une ligne déjà enregistrée sur le compte : gardé, avec un avertissement', () => {
    const analyse = analyserReleve({
      ...entree(CAMT_UN_RELEVE),
      lignesBanque: [
        { compte: '512-B1', date: new Date(2026, 9, 1), libelle: analyserReleve(entree(CAMT_UN_RELEVE)).retenues[0].libelle, montant: 350, sens: 'debit' },
      ],
    })
    expect(analyse.retenues).toHaveLength(4)
    expect(analyse.doublons).toEqual([])
    expect(analyse.avertissements).toContain(
      '1 mouvement de même date, même montant et même libellé qu’une ligne déjà enregistrée sur ce compte : relevé peut-être déjà importé, à vérifier.',
    )
  })

  it('CSV : lecture et doublons inchangés, aucune limite d’empreintes', () => {
    const analyse = analyserReleve(entree('Date;Libellé;Montant\n05/10/2026;VIR SEPA;350,00'))
    expect(analyse.format).toBe('csv')
    expect(analyse.releves).toEqual([])
    expect(analyse.blocage).toBeNull()
    expect(analyse.limiteEmpreintes).toBeNull()
    expect(analyse.retenues).toHaveLength(1)
  })
})

describe('lecture du fichier', () => {
  it('UTF-8 lu tel quel ; à défaut, Windows-1252 (CFONB en Latin-1 avec accents), longueur des lignes préservée', () => {
    const utf8 = new TextEncoder().encode('VIR SEPA RÉGULARISATION')
    expect(decoderTexteReleve(utf8.buffer)).toBe('VIR SEPA RÉGULARISATION')
    const latin1 = Uint8Array.from([0x56, 0x49, 0x52, 0x20, 0x52, 0xc9, 0x47, 0x55, 0x4c])
    expect(decoderTexteReleve(latin1.buffer)).toBe('VIR RÉGUL')
  })

  it('marque d’ordre des octets UTF-16 (export « Texte Unicode ») : lu en UTF-16, comme FileReader.readAsText avant', () => {
    const texte = 'Date\tLibellé\tMontant\n05/10/2026\tVIR SEPA\t350,00'
    const utf16 = (petitBoutiste: boolean): ArrayBuffer => {
      const octets = new Uint8Array(2 + texte.length * 2)
      octets.set(petitBoutiste ? [0xff, 0xfe] : [0xfe, 0xff])
      for (let rang = 0; rang < texte.length; rang++) {
        const code = texte.charCodeAt(rang)
        octets.set(petitBoutiste ? [code & 0xff, code >> 8] : [code >> 8, code & 0xff], 2 + rang * 2)
      }
      return octets.buffer
    }
    expect(decoderTexteReleve(utf16(true))).toBe(texte)
    expect(decoderTexteReleve(utf16(false))).toBe(texte)
    const analyse = analyserReleve(entree(decoderTexteReleve(utf16(true))))
    expect(analyse.format).toBe('csv')
    expect(analyse.retenues).toEqual([{ date: '2026-10-05', libelle: 'VIR SEPA', montant: 350 }])
  })

  it('marque d’ordre des octets UTF-8 suivie d’octets invalides : reste de l’UTF-8 (caractère de remplacement), comme avant', () => {
    const octets = Uint8Array.from([0xef, 0xbb, 0xbf, 0x56, 0x49, 0x52, 0x20, 0xc9])
    expect(decoderTexteReleve(octets.buffer)).toBe('VIR �')
  })

  it('fichier de plus de 10 Mo : refusé avant lecture (seuil provisoire, à fixer)', () => {
    expect(TAILLE_MAX_RELEVE_OCTETS).toBe(10 * 1024 * 1024)
    expect(refusTailleReleve(TAILLE_MAX_RELEVE_OCTETS)).toBeNull()
    expect(refusTailleReleve(TAILLE_MAX_RELEVE_OCTETS + 1)).toBe('Fichier de 10,0 Mo : au-delà de 10 Mo, le relevé n’est pas lu (seuil provisoire).')
  })
})
