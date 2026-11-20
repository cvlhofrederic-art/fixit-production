import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { detecterFormatReleve, lireReleve } from '@/lib/administrateur-judiciaire/domain/import/lecture-releve'
import { dedoublonnerRelevesStructures, empreinteReleve, empreintesMouvements } from '@/lib/administrateur-judiciaire/domain/import/doublons-releves'
import { parserReleveBancaire } from '@/lib/administrateur-judiciaire/domain/import/releve-bancaire'

/**
 * Détection du format d'un relevé bancaire (CSV, CFONB 120, camt.053) à partir de son contenu, et lecture commune qui
 * rend les LigneReleve de l'import existant. Rien n'est branché sur l'écran de trésorerie.
 */

const fixture = (nom: string) => readFileSync(join(__dirname, 'fixtures', 'releves', nom), 'latin1').replaceAll('\r\n', '\n')
const CFONB = fixture('releve-nominal.cfonb120.txt')
const CFONB_DECIMALES = fixture('releve-decimales.cfonb120.txt')
const CAMT = readFileSync(join(__dirname, 'fixtures', 'releves', 'releve-nominal.camt053.xml'), 'utf8')
const CAMT_V08 = readFileSync(join(__dirname, 'fixtures', 'releves', 'releve-v08.camt053.xml'), 'utf8')
const CSV = 'Date;Libellé;Montant\n05/10/2026;VIR SEPA DURAND CLAIRE T4;350,00\n06/10/2026;PRLV EDF;-82,10\n'

describe('détection du format d’un relevé', () => {
  it('reconnaît le CSV (avec ou sans en-tête), le CFONB 120 (avec ou sans séparateur de ligne) et le camt.053', () => {
    expect(detecterFormatReleve(CSV)).toBe('csv')
    expect(detecterFormatReleve('05/10/2026,VIR DURAND,350.00')).toBe('csv')
    expect(detecterFormatReleve(CFONB)).toBe('cfonb120')
    expect(detecterFormatReleve(CFONB.replaceAll('\n', ''))).toBe('cfonb120')
    expect(detecterFormatReleve(`﻿${CFONB.replaceAll('\n', '\r\n')}`)).toBe('cfonb120')
    expect(detecterFormatReleve(CAMT)).toBe('camt053')
    expect(detecterFormatReleve(CAMT_V08)).toBe('camt053')
    expect(detecterFormatReleve(`﻿ \n${CAMT}`)).toBe('camt053')
  })

  it('autre XML, texte quelconque ou vide : format inconnu', () => {
    expect(detecterFormatReleve(CAMT.replace('xsd:camt.053.001.02', 'xsd:camt.054.001.02'))).toBe('inconnu')
    expect(detecterFormatReleve('<releve><ligne/></releve>')).toBe('inconnu')
    expect(detecterFormatReleve('Bonjour')).toBe('inconnu')
    expect(detecterFormatReleve('  \n ')).toBe('inconnu')
    expect(detecterFormatReleve('01ABCDE')).toBe('inconnu')
  })
})

describe('lecture commune d’un relevé', () => {
  it('CSV : même résultat que l’import existant, sans relevé ni solde', () => {
    const lecture = lireReleve(CSV)
    expect(lecture).toEqual({ format: 'csv', lignes: parserReleveBancaire(CSV).lignes, releves: [], erreurs: [], avertissements: [] })
  })

  it('CFONB 120 et camt.053 : les lignes sont les mouvements des relevés retenus, dans l’ordre du fichier', () => {
    const cfonb = lireReleve(CFONB)
    expect(cfonb.format).toBe('cfonb120')
    expect(cfonb.erreurs).toEqual([])
    expect(cfonb.releves).toHaveLength(3)
    expect(cfonb.lignes.map((ligne) => [ligne.date, ligne.montant])).toEqual([
      ['2026-10-01', 350],
      ['2026-10-02', -1234.56],
      ['2026-10-03', 120],
      ['2026-10-05', -12.5],
      ['2026-10-06', -600],
    ])
    const camt = lireReleve(CAMT)
    expect(camt.format).toBe('camt053')
    expect(camt.lignes.map((ligne) => ligne.montant)).toEqual([350, -1234.56, 120, -12.5])
  })

  it('formats structurés : un relevé réimporté n’apporte rien, reconnu par relevé et non ligne à ligne', () => {
    const { releves } = lireReleve(CAMT),
      dejaImporte = { releves: releves.map(empreinteReleve), mouvements: releves.flatMap(empreintesMouvements) }
    expect(dedoublonnerRelevesStructures(lireReleve(CAMT).releves, dejaImporte).lignes).toEqual([])
  })

  it('un relevé dans une autre devise que celle de la comptabilité est refusé', () => {
    const lecture = lireReleve(CFONB_DECIMALES)
    expect(lecture.releves.map((releve) => releve.devise)).toEqual(['EUR'])
    expect(lecture.erreurs).toEqual([
      'Relevé 1 (RIB 99999 00020 0000ABC1234 clé 82, du 30/09/2026 au 02/10/2026) refusé : relevé en XPF, la comptabilité est tenue en EUR.',
      'Relevé 2 (RIB 99999 00020 00000000077 clé 84, du 30/09/2026 au 01/10/2026) refusé : relevé en TND, la comptabilité est tenue en EUR.',
    ])
    expect(lireReleve(CFONB_DECIMALES, { deviseComptable: 'XPF' }).releves.map((releve) => releve.devise)).toEqual(['XPF'])
  })

  it('comptes attendus : un relevé d’un autre compte est refusé (RIB comparé à l’IBAN, IBAN à l’IBAN)', () => {
    const attendus = ['FR76 1234 5000 1000 0123 4567 849']
    const cfonb = lireReleve(CFONB, { comptesAttendus: attendus })
    expect(cfonb.releves.map((releve) => releve.rang)).toEqual([1, 3])
    expect(cfonb.erreurs).toEqual([
      'Relevé 2 (RIB 12345 00010 00087654321 clé 21, du 30/09/2026 au 05/10/2026) refusé : compte absent des comptes attendus.',
    ])
    const camt = lireReleve(CAMT, { comptesAttendus: attendus })
    expect(camt.releves.map((releve) => releve.rang)).toEqual([1])
    expect(camt.erreurs).toEqual([
      'Relevé 2 (IBAN FR7612345000100008765432121, du 30/09/2026 au 05/10/2026) refusé : compte absent des comptes attendus.',
    ])
    expect(lireReleve(CFONB, { comptesAttendus: [] }).releves).toHaveLength(3)
  })

  it('erreurs et avertissements du format sont rendus ; format inconnu refusé', () => {
    const tronque = lireReleve(CAMT.slice(0, 2000))
    expect(tronque.lignes).toEqual([])
    expect(tronque.erreurs[0]).toMatch(/^Fichier camt\.053 illisible/)
    expect(lireReleve('Bonjour')).toEqual({
      format: 'inconnu',
      lignes: [],
      releves: [],
      erreurs: ['Format de relevé non reconnu : ni CSV, ni CFONB 120, ni camt.053.'],
      avertissements: [],
    })
  })
})
