import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { proposerImputations } from '@/lib/administrateur-judiciaire/domain/import/releve-bancaire'
import { decoderMontantCfonb, lireReleveCfonb120 } from '@/lib/administrateur-judiciaire/domain/import/releve-cfonb'

/**
 * Relevé de compte CFONB 120 caractères (brochure CFONB « Relevé de compte sur support informatique », juillet 2004 ;
 * enrichissements SEPA des enregistrements 05, « Évolutions du relevé de compte 120 caractères », V2.0, mars 2010).
 * Fichiers fictifs écrits à la main : tests/administrateur-judiciaire/fixtures/releves/*.cfonb120.txt.
 */

const fixture = (nom: string) => readFileSync(join(__dirname, 'fixtures', 'releves', nom), 'latin1')
const NOMINAL = fixture('releve-nominal.cfonb120.txt')
const DECIMALES = fixture('releve-decimales.cfonb120.txt')
const lignesDe = (texte: string) => texte.split(/\r?\n/).filter((ligne) => ligne !== '')
const avecLignes = (lignes: string[]) => lignes.join('\r\n') + '\r\n'
/** Remplace les caractères à partir de la position (1-indexée) d'une ligne. */
const surcharger = (ligne: string, position: number, valeur: string) =>
  ligne.slice(0, position - 1) + valeur + ligne.slice(position - 1 + valeur.length)
const modifierLigne = (texte: string, index: number, modifier: (ligne: string) => string) =>
  avecLignes(lignesDe(texte).map((ligne, rang) => (rang === index ? modifier(ligne) : ligne)))

describe('relevé CFONB 120 — fichiers de test', () => {
  it('les fichiers fictifs sont faits d’enregistrements de 120 caractères exactement', () => {
    for (const texte of [NOMINAL, DECIMALES]) for (const ligne of lignesDe(texte)) expect(ligne).toHaveLength(120)
  })
})

describe('relevé CFONB 120 — montant signé', () => {
  it('le dernier caractère porte le signe et le chiffre des unités ({ A…I positifs, } J…R négatifs)', () => {
    expect([...'{ABCDEFGHI'].map((c) => decoderMontantCfonb(`0000000000001${c}`))).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
    expect([...'}JKLMNOPQR'].map((c) => decoderMontantCfonb(`0000000000001${c}`))).toEqual([-10, -11, -12, -13, -14, -15, -16, -17, -18, -19])
    expect(decoderMontantCfonb('9999999999999I')).toBe(99_999_999_999_999)
  })

  it('zéro signé négatif rendu comme zéro ; caractère de signe, chiffre ou longueur invalides → null', () => {
    expect(Object.is(decoderMontantCfonb('0000000000000}'), 0)).toBe(true)
    expect(decoderMontantCfonb('00000000000005')).toBeNull()
    expect(decoderMontantCfonb('000000000000 5{')).toBeNull()
    expect(decoderMontantCfonb('0000000000005')).toBeNull()
    expect(decoderMontantCfonb('-000000000005{')).toBeNull()
  })
})

describe('relevé CFONB 120 — lecture', () => {
  const lecture = lireReleveCfonb120(NOMINAL)

  it('lit les trois relevés du fichier (deux comptes), sans erreur ni avertissement', () => {
    expect(lecture.erreurs).toEqual([])
    expect(lecture.avertissements).toEqual([])
    expect(lecture.releves.map((r) => [r.rang, r.compte.rib?.numero, r.mouvements.length])).toEqual([
      [1, '00012345678', 4],
      [2, '00087654321', 0],
      [3, '00012345678', 1],
    ])
  })

  it('rend le compte (RIB, clé calculée), la devise, les dates et les soldes en unités mineures', () => {
    const [releve] = lecture.releves
    expect(releve).toMatchObject({
      format: 'cfonb120',
      identifiant: null,
      compte: { iban: null, rib: { banque: '12345', guichet: '00010', numero: '00012345678', cle: '49' }, autreIdentifiant: null, titulaire: null },
      devise: 'EUR',
      decimales: 2,
      dateOuverture: '2026-09-30',
      dateCloture: '2026-10-05',
      soldeOuvertureMineur: 125_000,
      soldeClotureMineur: 47_294,
      totalCreditsMineur: 47_000,
      totalDebitsMineur: 124_706,
    })
  })

  it('un mouvement est une LigneReleve (montant positif = encaissement) enrichie de ses compléments 05', () => {
    const [virement, prelevement, regularisation, frais] = lecture.releves[0].mouvements
    expect(virement).toMatchObject({
      date: '2026-10-01',
      dateValeur: '2026-10-01',
      libelle: 'VIR SEPA RECU /DE DURAND CLAIRE APPEL DE FONDS T4 2026 LOT 12',
      montant: 350,
      montantMineur: 35_000,
      codeOperation: '05',
      referenceBanque: 'REF-BQ-000001',
      numeroEcriture: '0000001',
      payeur: 'DURAND CLAIRE',
      beneficiaire: null,
      referenceClient: 'E2E-T4-LOT12',
      motifRejet: null,
      contrepassation: false,
    })
    expect(virement.complements.map((c) => c.qualifiant)).toEqual(['NPY', 'LCC', 'RCN'])
    expect(prelevement).toMatchObject({
      date: '2026-10-02',
      montant: -1234.56,
      montantMineur: -123_456,
      codeOperation: 'B1',
      beneficiaire: 'SOCIETE DES EAUX FICTIVE',
      libelle: 'PRLV SEPA SOCIETE DES EAUX SOCIETE DES EAUX FICTIVE',
    })
    expect(regularisation.libelle).toBe('VIR SEPA RECU /DE MARTIN PAUL REGULARISATION DES CHARGES EXERCICE 2025 LOT 14')
    expect(regularisation.referenceBanque).toBeNull()
    expect(frais).toMatchObject({ libelle: 'FRAIS TENUE DE COMPTE', montant: -12.5, montantMineur: -1250, complements: [], numeroEcriture: null })
  })

  it('un relevé sans mouvement ne porte que l’ancien et le nouveau solde ; un solde débiteur est négatif', () => {
    expect(lecture.releves[1]).toMatchObject({ soldeOuvertureMineur: 500_000, soldeClotureMineur: 500_000, totalCreditsMineur: 0, totalDebitsMineur: 0 })
    expect(lecture.releves[2]).toMatchObject({ soldeOuvertureMineur: 47_294, soldeClotureMineur: -12_706, dateCloture: '2026-10-06' })
    expect(lecture.releves[2].mouvements[0]).toMatchObject({ libelle: 'CHEQUE 1234567', numeroEcriture: '1234567', montant: -600, codeOperation: '01' })
  })

  it('les mouvements passent tels quels dans la proposition d’imputation existante', () => {
    const [proposition] = proposerImputations(lecture.releves[0].mouvements.slice(0, 1), [{ nom: 'Durand Claire', solde: -350 }])
    expect(proposition.candidat?.nom).toBe('Durand Claire')
    expect(proposition.confiance).toBe('forte')
  })

  it('même lecture avec des fins de ligne LF, sans séparateur d’enregistrement ou avec les blancs de fin rognés', () => {
    const attendu = lecture.releves
    expect(lireReleveCfonb120(NOMINAL.replaceAll('\r\n', '\n')).releves).toEqual(attendu)
    expect(lireReleveCfonb120(lignesDe(NOMINAL).join('')).releves).toEqual(attendu)
    expect(lireReleveCfonb120(lignesDe(NOMINAL).map((ligne) => ligne.trimEnd()).join('\n')).releves).toEqual(attendu)
  })
})

describe('relevé CFONB 120 — décimales et montants nuls', () => {
  const lecture = lireReleveCfonb120(DECIMALES)

  it('lit un relevé sans décimale (XPF), un relevé à trois décimales (TND) et un relevé à solde nul', () => {
    expect(lecture.erreurs).toEqual([])
    const [xpf, tnd, nul] = lecture.releves
    expect(xpf).toMatchObject({ devise: 'XPF', decimales: 0, soldeOuvertureMineur: 150_000, soldeClotureMineur: 175_000 })
    expect(xpf.compte.rib).toEqual({ banque: '99999', guichet: '00020', numero: '0000ABC1234', cle: '82' })
    expect(xpf.mouvements[0]).toMatchObject({ montant: 25_000, montantMineur: 25_000 })
    expect(Object.is(xpf.mouvements[1].montantMineur, 0)).toBe(true)
    expect(Object.is(xpf.mouvements[1].montant, 0)).toBe(true)
    expect(xpf.mouvements[1].dateValeur).toBeNull()
    expect(tnd).toMatchObject({ devise: 'TND', decimales: 3, soldeOuvertureMineur: 1_000_500, soldeClotureMineur: 750_375 })
    expect(tnd.mouvements[0]).toMatchObject({ montant: -250.125, montantMineur: -250_125 })
    expect(Object.is(nul.soldeClotureMineur, 0)).toBe(true)
    expect(nul.soldeOuvertureMineur).toBe(0)
  })
})

/** Enregistrements fictifs du compte 12345 00010 00012345678 (EUR, 2 décimales), écrits zone par zone. */
const ANCIEN_SOLDE_NUL = `0112345    00010EUR2 00012345678  300926${' '.repeat(50)}0000000000000{${' '.repeat(16)}`
const mouvement = (libelle: string, montant: string, numero = '0000000') =>
  `0412345015100010EUR2 0001234567805011026  011026${libelle.padEnd(31)}  ${numero}  ${montant}${' '.repeat(16)}`
const complement = (qualifiant: string, texte: string) =>
  `0512345015100010EUR2 0001234567805011026     ${qualifiant}${texte.padEnd(70)}  `
const nouveauSolde = (montant: string) => `0712345    00010EUR2 00012345678  011026${' '.repeat(50)}${montant}${' '.repeat(16)}`

describe('relevé CFONB 120 — fichier hostile', () => {
  it('un mouvement suivi de 8 000 compléments LIB : lu en moins d’une seconde, libellé borné avec un avertissement', () => {
    const lignes = [
      ANCIEN_SOLDE_NUL,
      mouvement('VIR SEPA RECU', '0000000000010{'),
      complement('NPY', 'DURAND CLAIRE'),
      ...Array.from({ length: 8_000 }, (_, rang) => complement('LIB', `LIGNE ${rang}`)),
      nouveauSolde('0000000000010{'),
    ]
    for (const ligne of lignes) expect(ligne).toHaveLength(120)
    const debut = performance.now(),
      lecture = lireReleveCfonb120(avecLignes(lignes))
    expect(performance.now() - debut).toBeLessThan(1_000)
    expect(lecture.erreurs).toEqual([])
    const [virement] = lecture.releves[0].mouvements
    expect(virement.libelle).toMatch(/^VIR SEPA RECU LIGNE 0 LIGNE 1 .* DURAND CLAIRE$/)
    expect(virement.libelle.length).toBeLessThanOrEqual(1_000 + ' DURAND CLAIRE'.length)
    expect(lecture.avertissements).toEqual(['Relevé 1, ligne 2 : libellé limité à 1 000 caractères, textes suivants omis.'])
  })
})

describe('relevé CFONB 120 — refus', () => {
  it('ancien solde + mouvements ≠ nouveau solde : relevé refusé, les autres relevés du fichier restent lus', () => {
    const lecture = lireReleveCfonb120(modifierLigne(NOMINAL, 12, (ligne) => surcharger(ligne, 91, '0000000004728D')))
    expect(lecture.releves.map((r) => r.rang)).toEqual([2, 3])
    expect(lecture.erreurs).toEqual([
      'Relevé 1 (RIB 12345 00010 00012345678 clé 49, du 30/09/2026 au 05/10/2026) refusé : ancien solde 1 250,00 EUR + mouvements -777,06 EUR = 472,94 EUR, mais nouveau solde annoncé 472,84 EUR (écart 0,10 EUR).',
    ])
  })

  it('fichier coupé au milieu d’un enregistrement : refusé comme tronqué', () => {
    const lecture = lireReleveCfonb120(NOMINAL.slice(0, NOMINAL.indexOf('PRLV SEPA')))
    expect(lecture.releves).toEqual([])
    expect(lecture.erreurs.join(' ')).toMatch(/tronqué/)
    expect(lecture.erreurs.join(' ')).toMatch(/nouveau solde \(07\) absent/)
  })

  it('nouveau solde final absent : le dernier relevé est refusé', () => {
    const lecture = lireReleveCfonb120(avecLignes(lignesDe(NOMINAL).slice(0, -1)))
    expect(lecture.releves.map((r) => r.rang)).toEqual([1, 2])
    expect(lecture.erreurs).toEqual(['Relevé 3 (RIB 12345 00010 00012345678 clé 49) refusé : nouveau solde (07) absent, fichier tronqué ?'])
  })

  it('nouvel ancien solde avant le nouveau solde du relevé en cours : le relevé en cours est refusé', () => {
    const lecture = lireReleveCfonb120(avecLignes(lignesDe(NOMINAL).filter((_, index) => index !== 14)))
    expect(lecture.releves.map((r) => r.rang)).toEqual([1, 3])
    expect(lecture.erreurs).toEqual(['Relevé 2 (RIB 12345 00010 00087654321 clé 21) refusé : nouveau solde (07) absent avant l’ancien solde de la ligne 15.'])
  })

  it('montant illisible, date invalide, code d’enregistrement inconnu, ligne trop longue', () => {
    const erreurs = (texte: string) => lireReleveCfonb120(texte).erreurs.join(' ')
    expect(erreurs(modifierLigne(NOMINAL, 1, (ligne) => surcharger(ligne, 104, '5')))).toMatch(/Relevé 1, ligne 2 : montant illisible « 00000000035005 »/)
    expect(erreurs(modifierLigne(NOMINAL, 1, (ligne) => surcharger(ligne, 35, '320926')))).toMatch(/Relevé 1, ligne 2 : date de comptabilisation invalide « 320926 »/)
    expect(erreurs(modifierLigne(NOMINAL, 1, (ligne) => surcharger(ligne, 43, '011326')))).toMatch(/date de valeur invalide « 011326 »/)
    expect(erreurs(modifierLigne(NOMINAL, 0, (ligne) => surcharger(ligne, 35, '      ')))).toMatch(/Relevé 1, ligne 1 : date de l’ancien solde invalide/)
    expect(erreurs(modifierLigne(NOMINAL, 5, (ligne) => surcharger(ligne, 1, '03')))).toMatch(/ligne 6 : code d’enregistrement « 03 » inconnu/)
    expect(erreurs(modifierLigne(NOMINAL, 5, (ligne) => `${ligne}X`))).toMatch(/ligne 6 : 121 caractères au lieu de 120/)
    expect(erreurs(modifierLigne(NOMINAL, 5, (ligne) => surcharger(ligne, 20, '3')))).toMatch(/ligne 6 : .*identiques/)
  })

  it('mouvement ou complément d’un autre compte, complément orphelin ou détaché de son mouvement', () => {
    const erreurs = (texte: string) => lireReleveCfonb120(texte).erreurs.join(' ')
    expect(erreurs(modifierLigne(NOMINAL, 5, (ligne) => surcharger(ligne, 22, '00087654321')))).toMatch(
      /Relevé 1, ligne 6 : banque, guichet, devise, décimales et compte doivent être identiques/,
    )
    const lignes = lignesDe(NOMINAL)
    expect(erreurs(avecLignes([lignes[0], lignes[2], ...lignes.slice(1)]))).toMatch(/Relevé 1, ligne 2 : complément \(05\) sans mouvement \(04\)/)
    expect(erreurs(modifierLigne(NOMINAL, 2, (ligne) => surcharger(ligne, 35, '021026')))).toMatch(/Relevé 1, ligne 3 : .*positions 3 à 40/)
    expect(erreurs(avecLignes([lignes[1], ...lignes]))).toMatch(/^Ligne 1 : mouvement \(04\) hors relevé/)
  })

  it('enregistrement tronqué, flux sans séparateur de longueur non multiple de 120, fichier vide', () => {
    expect(lireReleveCfonb120(modifierLigne(NOMINAL, 1, (ligne) => ligne.slice(0, 95))).erreurs.join(' ')).toMatch(/ligne 2 : enregistrement tronqué/)
    expect(lireReleveCfonb120(lignesDe(NOMINAL).join('').slice(0, -7)).erreurs).toEqual([
      'Fichier sans séparateur de ligne de 2153 caractères : pas un multiple de 120, fichier tronqué ?',
    ])
    expect(lireReleveCfonb120(' \r\n').erreurs).toEqual(['Relevé vide.'])
  })

  it('rupture de continuité entre deux relevés successifs d’un même compte : avertissement', () => {
    const lignes = lignesDe(NOMINAL)
    lignes[15] = surcharger(lignes[15], 91, '0000000004729E')
    lignes[17] = surcharger(lignes[17], 91, '0000000001270N')
    const lecture = lireReleveCfonb120(avecLignes(lignes))
    expect(lecture.erreurs).toEqual([])
    expect(lecture.avertissements).toEqual([
      'Relevé 3 (RIB 12345 00010 00012345678 clé 49, du 05/10/2026 au 06/10/2026) : ancien solde 472,95 EUR différent du nouveau solde 472,94 EUR du relevé 1 du même compte.',
    ])
  })
})
