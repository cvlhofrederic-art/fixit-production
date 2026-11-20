import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { proposerImputations } from '@/lib/administrateur-judiciaire/domain/import/releve-bancaire'
import { lireReleveCamt053 } from '@/lib/administrateur-judiciaire/domain/import/releve-camt'

/**
 * Relevé de compte ISO 20022 camt.053 (BankToCustomerStatement), versions 001.02 et 001.08 : guide CFONB « Guide
 * d'utilisation du standard ISO 20022 pour les relevés de compte » V1.2 (juillet 2019) ; guide Payments Canada camt.053.001.08
 * (MyStandards, 19/04/2024). Fichiers fictifs écrits à la main : tests/administrateur-judiciaire/fixtures/releves/*.xml.
 */

/** Fins de ligne ramenées à LF : la copie de travail peut être en CRLF (core.autocrlf). */
const fixture = (nom: string) => readFileSync(join(__dirname, 'fixtures', 'releves', nom), 'utf8').replaceAll('\r\n', '\n')
const NOMINAL = fixture('releve-nominal.camt053.xml')
const V08 = fixture('releve-v08.camt053.xml')

/** Relevé minimal d'une devise : soldes et écritures (montant, sens) écrits à la main. */
function releveMinimal(devise: string, ouverture: string, cloture: string, ecritures: [string, 'CRDT' | 'DBIT'][], sts = '<Sts>BOOK</Sts>') {
  const bal = (code: string, montant: string) =>
    `<Bal><Tp><CdOrPrtry><Cd>${code}</Cd></CdOrPrtry></Tp><Amt Ccy="${devise}">${montant}</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2026-10-01</Dt></Dt></Bal>`
  const ntry = ([montant, sens]: [string, string], rang: number) =>
    `<Ntry><Amt Ccy="${devise}">${montant}</Amt><CdtDbtInd>${sens}</CdtDbtInd>${rang === 0 ? sts : '<Sts>BOOK</Sts>'}<BookgDt><Dt>2026-10-01</Dt></BookgDt><AddtlNtryInf>ECRITURE ${rang + 1}</AddtlNtryInf></Ntry>`
  return (
    '<?xml version="1.0" encoding="UTF-8"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><BkToCstmrStmt>' +
    '<GrpHdr><MsgId>M1</MsgId><CreDtTm>2026-10-01T20:00:00</CreDtTm></GrpHdr>' +
    `<Stmt><Id>S1</Id><CreDtTm>2026-10-01T20:00:00</CreDtTm><Acct><Id><Othr><Id>CPT-FICTIF-01</Id></Othr></Id><Ccy>${devise}</Ccy></Acct>` +
    `${bal('OPBD', ouverture)}${bal('CLBD', cloture)}${ecritures.map(ntry).join('')}</Stmt></BkToCstmrStmt></Document>`
  )
}

describe('relevé camt.053 — lecture (version 001.02)', () => {
  const lecture = lireReleveCamt053(NOMINAL)

  it('lit les deux relevés (deux comptes) du message, sans erreur ni avertissement', () => {
    expect(lecture.erreurs).toEqual([])
    expect(lecture.avertissements).toEqual([])
    expect(lecture.releves.map((r) => [r.rang, r.identifiant, r.compte.iban, r.mouvements.length])).toEqual([
      [1, 'RELEVE-2026-10-05-A', 'FR7612345000100001234567849', 4],
      [2, 'RELEVE-2026-10-05-B', 'FR7612345000100008765432121', 0],
    ])
  })

  it('rend le compte, la devise, les dates et les soldes OPBD / CLBD en unités mineures', () => {
    expect(lecture.releves[0]).toMatchObject({
      format: 'camt053',
      compte: { iban: 'FR7612345000100001234567849', rib: null, autreIdentifiant: null, titulaire: 'SDC LES TILLEULS' },
      numeroSequence: '41',
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

  it('l’ancien solde peut être le solde clos précédent (PRCD) ; un relevé sans écriture', () => {
    expect(lecture.releves[1]).toMatchObject({ soldeOuvertureMineur: 500_000, soldeClotureMineur: 500_000, dateOuverture: '2026-09-30', mouvements: [] })
    expect(lecture.releves[1].compte.titulaire).toBeNull()
    expect(lecture.releves[1].numeroSequence).toBeNull()
  })

  it('une écriture est une LigneReleve (montant positif = encaissement) avec ses références et ses parties', () => {
    const [virement, prelevement, regularisation, frais] = lecture.releves[0].mouvements
    expect(virement).toEqual({
      date: '2026-10-01',
      dateValeur: '2026-10-01',
      libelle: 'APPEL DE FONDS T4 2026 LOT 12 DURAND CLAIRE',
      montant: 350,
      montantMineur: 35_000,
      codeOperation: 'PMNT/RCDT/ESCT',
      referenceBanque: 'REF-BQ-000001',
      numeroEcriture: '0000001',
      payeur: 'DURAND CLAIRE',
      beneficiaire: null,
      referenceClient: 'E2E-T4-LOT12',
      motifRejet: null,
      contrepassation: false,
      complements: [],
    })
    expect(prelevement).toMatchObject({
      montant: -1234.56,
      montantMineur: -123_456,
      codeOperation: 'PMNT/RDDT/ESDD',
      beneficiaire: 'SOCIETE DES EAUX FICTIVE',
      referenceClient: 'FACT-EAU-T3-2026',
      libelle: 'FACTURE EAU T3 2026 SOCIETE DES EAUX FICTIVE',
    })
    expect(regularisation).toMatchObject({ montant: 120, referenceClient: null, referenceBanque: null, numeroEcriture: null })
    expect(regularisation.libelle).toBe('REGULARISATION DES CHARGES EXERCICE 2025 LOT 14 MARTIN PAUL')
    expect(frais).toMatchObject({ libelle: 'FRAIS TENUE DE COMPTE', montant: -12.5, codeOperation: 'ACMT/MDOP/CHRG' })
  })

  it('les écritures passent telles quelles dans la proposition d’imputation existante', () => {
    const [proposition] = proposerImputations(lecture.releves[0].mouvements.slice(0, 1), [{ nom: 'Durand Claire', solde: -350 }])
    expect(proposition.confiance).toBe('forte')
  })
})

describe('relevé camt.053 — version 001.08, éléments préfixés, plusieurs messages', () => {
  const lecture = lireReleveCamt053(V08)

  it('lit Sts/Cd, Pty/Nm, les dates en DtTm, les entités, CDATA et un IBAN écrit avec des espaces', () => {
    expect(lecture.erreurs).toEqual([])
    const [releve] = lecture.releves
    expect(releve).toMatchObject({
      identifiant: 'RELEVE-2026-10-06-A',
      compte: { iban: 'FR7612345000100001234567849' },
      dateOuverture: '2026-10-05',
      dateCloture: '2026-10-06',
      soldeOuvertureMineur: 47_294,
      soldeClotureMineur: -4_706,
    })
    const [cheque, remboursement] = releve.mouvements
    expect(cheque).toMatchObject({
      date: '2026-10-06',
      montant: -600,
      beneficiaire: 'DUPONT & FILS',
      libelle: 'CHEQUE 1234567 DUPONT & FILS',
      codeOperation: 'PMNT/ICHQ/CCHQ',
      contrepassation: false,
    })
    expect(remboursement).toMatchObject({
      montant: 80,
      contrepassation: true,
      payeur: 'SDC LES TILLEULS',
      beneficiaire: 'ASSURANCE FICTIVE',
      libelle: 'REMBOURSEMENT <PRIME> TROP PERCUE CONTRAT N° 77 éCHéANCE ASSURANCE FICTIVE',
    })
  })

  it('plusieurs messages à la suite dans un fichier : relevés numérotés dans l’ordre, continuité contrôlée', () => {
    const suite = lireReleveCamt053(`${NOMINAL}\n${V08}`)
    expect(suite.erreurs).toEqual([])
    expect(suite.avertissements).toEqual([])
    expect(suite.releves.map((r) => r.identifiant)).toEqual(['RELEVE-2026-10-05-A', 'RELEVE-2026-10-05-B', 'RELEVE-2026-10-06-A'])
    const rompue = lireReleveCamt053(`${NOMINAL}\n${V08.replace("<doc:Amt Ccy='EUR'>472.94</doc:Amt>", "<doc:Amt Ccy='EUR'>472.95</doc:Amt>").replace('>47.06<', '>47.05<')}`)
    expect(rompue.avertissements).toEqual([
      'Relevé 3 (IBAN FR7612345000100001234567849, du 05/10/2026 au 06/10/2026) : ancien solde 472,95 EUR différent du nouveau solde 472,94 EUR du relevé 1 du même compte.',
    ])
  })
})

describe('relevé camt.053 — décimales, montants nuls, écritures non comptabilisées', () => {
  it('sans décimale (XPF) et à trois décimales (KWD), selon ISO 4217', () => {
    const xpf = lireReleveCamt053(releveMinimal('XPF', '150000', '175000', [['25000', 'CRDT']]))
    expect(xpf.erreurs).toEqual([])
    expect(xpf.releves[0]).toMatchObject({ devise: 'XPF', decimales: 0, soldeOuvertureMineur: 150_000, compte: { autreIdentifiant: 'CPT-FICTIF-01' } })
    expect(xpf.releves[0].mouvements[0]).toMatchObject({ montant: 25_000, montantMineur: 25_000, libelle: 'ECRITURE 1' })
    const kwd = lireReleveCamt053(releveMinimal('KWD', '1000.5', '750.375', [['250.125', 'DBIT']]))
    expect(kwd.erreurs).toEqual([])
    expect(kwd.releves[0]).toMatchObject({ decimales: 3, soldeOuvertureMineur: 1_000_500, soldeClotureMineur: 750_375 })
    expect(kwd.releves[0].mouvements[0]).toMatchObject({ montant: -250.125, montantMineur: -250_125 })
  })

  it('montants à zéro acceptés', () => {
    const lecture = lireReleveCamt053(releveMinimal('EUR', '0', '0.00', [['0.00', 'DBIT']]))
    expect(lecture.erreurs).toEqual([])
    expect(Object.is(lecture.releves[0].mouvements[0].montantMineur, 0)).toBe(true)
    expect(lecture.releves[0]).toMatchObject({ soldeOuvertureMineur: 0, soldeClotureMineur: 0 })
  })

  it('plus de décimales que la devise n’en admet : refus', () => {
    expect(lireReleveCamt053(releveMinimal('XPF', '150000.5', '150000.5', [])).erreurs.join(' ')).toMatch(/« 150000.5 » : XPF admet 0 décimale/)
    expect(lireReleveCamt053(releveMinimal('EUR', '10', '9.995', [['0.005', 'DBIT']])).erreurs.join(' ')).toMatch(/« 9.995 » : EUR admet 2 décimales/)
  })

  it('une écriture non comptabilisée (PDNG) est écartée du relevé et du contrôle des soldes, avec un avertissement', () => {
    const lecture = lireReleveCamt053(releveMinimal('EUR', '100', '100', [['40', 'CRDT']], '<Sts><Cd>PDNG</Cd></Sts>'))
    expect(lecture.erreurs).toEqual([])
    expect(lecture.releves[0].mouvements).toEqual([])
    expect(lecture.avertissements).toEqual(['Relevé 1, écriture 1 : écriture au statut PDNG, non comptabilisée, écartée.'])
  })
})

describe('relevé camt.053 — fichier hostile', () => {
  it('une écriture à 20 000 textes libres : lue en moins d’une seconde, libellé borné avec un avertissement', () => {
    const ustrd = Array.from({ length: 20_000 }, (_, rang) => `<Ustrd>APPEL ${rang}</Ustrd>`).join(''),
      xml = releveMinimal('EUR', '0', '1.00', [['1.00', 'CRDT']]).replace(
        '<AddtlNtryInf>ECRITURE 1</AddtlNtryInf>',
        `<NtryDtls><TxDtls><RltdPties><Dbtr><Nm>DURAND CLAIRE</Nm></Dbtr></RltdPties><RmtInf>${ustrd}</RmtInf></TxDtls></NtryDtls>`,
      ),
      debut = performance.now(),
      lecture = lireReleveCamt053(xml)
    expect(performance.now() - debut).toBeLessThan(1_000)
    expect(lecture.erreurs).toEqual([])
    const [ecriture] = lecture.releves[0].mouvements
    expect(ecriture.libelle).toMatch(/^APPEL 0 APPEL 1 .* DURAND CLAIRE$/)
    expect(ecriture.libelle.length).toBeLessThanOrEqual(1_000 + ' DURAND CLAIRE'.length)
    expect(lecture.avertissements).toEqual(['Relevé 1, écriture 1 : libellé limité à 1 000 caractères, textes suivants omis.'])
  })

  it('20 000 soldes OPBD répétés : relevé refusé en moins d’une seconde et demie', () => {
    const debut = performance.now(),
      lecture = lireReleveCamt053(releveEur(solde('OPBD', '1.00').repeat(20_000) + solde('CLBD', '1.00')))
    expect(performance.now() - debut).toBeLessThan(1_500)
    expect(lecture.releves).toEqual([])
    expect(lecture.erreurs[0]).toBe('Relevé 1 : plusieurs soldes OPBD.')
  })
})

/** Relevé EUR d'un compte IBAN fictif : contenu du Stmt après Acct (soldes, totaux, écritures) et pagination éventuelle. */
const releveEur = (contenu: string, pagination = '') =>
  '<?xml version="1.0" encoding="UTF-8"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><BkToCstmrStmt>' +
  `<GrpHdr><MsgId>M1</MsgId><CreDtTm>2026-10-01T20:00:00</CreDtTm>${pagination}</GrpHdr>` +
  `<Stmt><Id>S1</Id><Acct><Id><IBAN>FR7612345000100001234567849</IBAN></Id><Ccy>EUR</Ccy></Acct>${contenu}</Stmt></BkToCstmrStmt></Document>`
function solde(code: string, montant: string) {
  return `<Bal><Tp><CdOrPrtry><Cd>${code}</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">${montant}</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2026-10-01</Dt></Dt></Bal>`
}
const ecriture = (montant: string, sens: 'CRDT' | 'DBIT', contenu = '', statut = 'BOOK') =>
  `<Ntry><Amt Ccy="EUR">${montant}</Amt><CdtDbtInd>${sens}</CdtDbtInd><Sts>${statut}</Sts><BookgDt><Dt>2026-10-01</Dt></BookgDt>${contenu}</Ntry>`
/** Totaux annoncés : [nombre, somme] des écritures au crédit puis au débit. */
const totaux = ([nbCredits, credits]: [number, string], [nbDebits, debits]: [number, string]) =>
  `<TxsSummry><TtlNtries><NbOfNtries>${nbCredits + nbDebits}</NbOfNtries><Sum>${(Number(credits) + Number(debits)).toFixed(2)}</Sum></TtlNtries>` +
  `<TtlCdtNtries><NbOfNtries>${nbCredits}</NbOfNtries><Sum>${credits}</Sum></TtlCdtNtries>` +
  `<TtlDbtNtries><NbOfNtries>${nbDebits}</NbOfNtries><Sum>${debits}</Sum></TtlDbtNtries></TxsSummry>`

describe('relevé camt.053 — totaux annoncés et pagination', () => {
  it('écritures comptées au crédit ou au débit selon CdtDbtInd, y compris une écriture à 0,00', () => {
    const lecture = lireReleveCamt053(
      releveEur(
        solde('OPBD', '100.00') +
          solde('CLBD', '100.00') +
          totaux([1, '0'], [1, '0']) +
          ecriture('0.00', 'CRDT', '<AddtlNtryInf>FRAIS OFFERTS</AddtlNtryInf>') +
          ecriture('0.00', 'DBIT', '<AddtlNtryInf>COMMISSION NULLE</AddtlNtryInf>'),
      ),
    )
    expect(lecture.erreurs).toEqual([])
    expect(lecture.releves[0].mouvements.map((m) => m.libelle)).toEqual(['FRAIS OFFERTS', 'COMMISSION NULLE'])
  })

  it('seules les écritures comptabilisées comptent dans les totaux annoncés (guide CFONB V1.2, p. 32)', () => {
    const lecture = lireReleveCamt053(
      releveEur(solde('OPBD', '0') + solde('CLBD', '10.00') + totaux([1, '10.00'], [0, '0']) + ecriture('10.00', 'CRDT') + ecriture('5.00', 'CRDT', '', 'PDNG')),
    )
    expect(lecture.erreurs).toEqual([])
    expect(lecture.releves[0].mouvements.map((m) => m.montant)).toEqual([10])
    expect(lecture.avertissements).toEqual(['Relevé 1, écriture 2 : écriture au statut PDNG, non comptabilisée, écartée.'])
  })

  it('pagination : « page 01, dernière page » est un message unique ; une autre page ou un numéro illisible est refusé', () => {
    const page = (numero: string, derniere = 'true') => `<MsgPgntn><PgNb>${numero}</PgNb><LastPgInd>${derniere}</LastPgInd></MsgPgntn>`,
      soldes = solde('OPBD', '100.00') + solde('CLBD', '100.00')
    expect(lireReleveCamt053(releveEur(soldes, page('01')))).toMatchObject({ erreurs: [], releves: [{ identifiant: 'S1' }] })
    expect(lireReleveCamt053(releveEur(soldes, page('00001'))).erreurs).toEqual([])
    expect(lireReleveCamt053(releveEur(soldes, page('2'))).erreurs).toEqual([
      'Message 1 refusé : relevé paginé (page 2, dernière page : oui) ; la lecture d’un relevé réparti sur plusieurs messages n’est pas traitée.',
    ])
    expect(lireReleveCamt053(releveEur(soldes, page('1A'))).erreurs[0]).toMatch(/^Message 1 refusé : relevé paginé \(page 1A,/)
    expect(lireReleveCamt053(releveEur(soldes, page('000000'))).erreurs[0]).toMatch(/^Message 1 refusé : relevé paginé \(page 000000,/)
  })
})

describe('relevé camt.053 — écriture globale (lot de transactions)', () => {
  const transaction = (nom: string, montant: string, reference: string) =>
    `<TxDtls><Refs><AcctSvcrRef>TX-${reference}</AcctSvcrRef><EndToEndId>E2E-${reference}</EndToEndId></Refs><AmtDtls><TxAmt><Amt Ccy="EUR">${montant}</Amt></TxAmt></AmtDtls>` +
    `<RltdPties><Dbtr><Nm>${nom}</Nm></Dbtr></RltdPties><RmtInf><Ustrd>APPEL DE FONDS T4 ${nom}</Ustrd></RmtInf><AddtlTxInf>/LIB/VIR SEPA RECU /DE ${nom}</AddtlTxInf></TxDtls>`
  const lot = (details: string) =>
    lireReleveCamt053(
      releveEur(solde('OPBD', '0') + solde('CLBD', '300.00') + ecriture('300.00', 'CRDT', `<AddtlNtryInf>REMISE VIREMENTS T4</AddtlNtryInf><NtryDtls>${details}</NtryDtls>`)),
    )

  it('plusieurs transactions : ni payeur, ni bénéficiaire, ni référence, ni texte des transactions ; avertissement', () => {
    const lecture = lot(`<Btch><NbOfTxs>2</NbOfTxs></Btch>${transaction('DURAND CLAIRE', '100.00', '1')}${transaction('MARTIN PAUL', '200.00', '2')}`)
    expect(lecture.erreurs).toEqual([])
    const [mouvement] = lecture.releves[0].mouvements
    expect(mouvement).toMatchObject({
      montant: 300,
      libelle: 'REMISE VIREMENTS T4 (écriture globale de 2 transactions)',
      payeur: null,
      beneficiaire: null,
      referenceClient: null,
      referenceBanque: null,
      motifRejet: null,
    })
    expect(lecture.avertissements).toEqual([
      'Relevé 1, écriture 1 : écriture globale de 2 transactions non éclatée ; payeurs, bénéficiaires, références et textes des transactions non repris.',
    ])
    const [proposition] = proposerImputations([mouvement], [
      { nom: 'Durand Claire', solde: -100 },
      { nom: 'Martin Paul', solde: -200 },
    ])
    expect(proposition.candidat).toBeNull()
  })

  it('le nombre de transactions est le plus grand de Btch/NbOfTxs et du nombre de TxDtls', () => {
    expect(lot(`<Btch><NbOfTxs>3</NbOfTxs></Btch>${transaction('DURAND CLAIRE', '300.00', '1')}`).avertissements[0]).toMatch(/écriture globale de 3 transactions/)
    expect(lot(`${transaction('DURAND CLAIRE', '100.00', '1')}${transaction('MARTIN PAUL', '200.00', '2')}`).avertissements[0]).toMatch(/écriture globale de 2 transactions/)
    const unique = lot(`<Btch><NbOfTxs>1</NbOfTxs></Btch>${transaction('DURAND CLAIRE', '300.00', '1')}`)
    expect(unique.avertissements).toEqual([])
    expect(unique.releves[0].mouvements[0]).toMatchObject({ payeur: 'DURAND CLAIRE', referenceClient: 'E2E-1', referenceBanque: 'TX-1' })
  })
})

describe('relevé camt.053 — refus', () => {
  const erreurs = (texte: string) => lireReleveCamt053(texte).erreurs

  it('ancien solde + écritures ≠ nouveau solde : relevé refusé, l’autre relevé du message reste lu', () => {
    const lecture = lireReleveCamt053(NOMINAL.replace('<Amt Ccy="EUR">472.94</Amt>', '<Amt Ccy="EUR">472.84</Amt>'))
    expect(lecture.releves.map((r) => r.rang)).toEqual([2])
    expect(lecture.erreurs).toEqual([
      'Relevé 1 (IBAN FR7612345000100001234567849, du 30/09/2026 au 05/10/2026) refusé : ancien solde 1 250,00 EUR + mouvements -777,06 EUR = 472,94 EUR, mais nouveau solde annoncé 472,84 EUR (écart 0,10 EUR).',
    ])
  })

  it('fichier tronqué ou XML mal formé : aucun relevé lu', () => {
    const tronque = lireReleveCamt053(NOMINAL.slice(0, NOMINAL.indexOf('<Ntry>', NOMINAL.indexOf('<Ntry>') + 1)))
    expect(tronque.releves).toEqual([])
    expect(tronque.erreurs).toHaveLength(1)
    expect(tronque.erreurs[0]).toMatch(/^Fichier camt\.053 illisible : XML illisible \(ligne \d+\) : document tronqué : <Stmt> n’est pas fermé\.$/)
    expect(erreurs(NOMINAL.replace('</Ntry>', '</Ntri>'))[0]).toMatch(/illisible.*<\/Ntri>/)
    expect(erreurs('VIR;DURAND;350')[0]).toMatch(/^Fichier camt\.053 illisible/)
  })

  it('DTD et entités externes refusées (pas de lecture de fichier local)', () => {
    const xxe = NOMINAL.replace('<Document', '<!DOCTYPE Document [<!ENTITY x SYSTEM "file:///etc/passwd">]>\n<Document').replace('SDC LES TILLEULS', '&x;')
    expect(erreurs(xxe)[0]).toMatch(/DTD/)
  })

  it('autre message que camt.053, structure absente', () => {
    expect(erreurs(NOMINAL.replace('xsd:camt.053.001.02', 'xsd:camt.054.001.02'))).toEqual([
      'Message 1 non reconnu : <Document> de l’espace de noms « urn:iso:std:iso:20022:tech:xsd:camt.054.001.02 », camt.053 attendu.',
    ])
    expect(erreurs('<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><Autre/></Document>')).toEqual([
      'Message 1 : élément BkToCstmrStmt absent.',
    ])
    expect(erreurs('<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><BkToCstmrStmt><GrpHdr/></BkToCstmrStmt></Document>')).toEqual([
      'Message 1 : aucun relevé (Stmt).',
    ])
  })

  it('relevé paginé sur plusieurs messages : refusé (lecture page à page non traitée)', () => {
    expect(erreurs(V08.replace('<doc:LastPgInd>true</doc:LastPgInd>', '<doc:LastPgInd>false</doc:LastPgInd>'))).toEqual([
      'Message 1 refusé : relevé paginé (page 1, dernière page : non) ; la lecture d’un relevé réparti sur plusieurs messages n’est pas traitée.',
    ])
  })

  it('solde absent, devise d’écriture différente, sens ou montant illisible, date absente, IBAN invalide, totaux faux', () => {
    const texte = (remplacements: [string, string][]) => remplacements.reduce((xml, [de, vers]) => xml.replace(de, vers), NOMINAL)
    const refus = (remplacements: [string, string][]) => erreurs(texte(remplacements)).join(' | ')
    expect(refus([['<Cd>CLBD</Cd>', '<Cd>ITBD</Cd>']])).toMatch(/^Relevé 1 : nouveau solde \(CLBD\) absent\. \| Relevé 1 \(IBAN FR7612345000100001234567849\) refusé : 1 erreur\.$/)
    expect(refus([['<Cd>OPBD</Cd>', '<Cd>ITBD</Cd>']])).toMatch(/Relevé 1 : ancien solde \(OPBD ou PRCD\) absent/)
    expect(refus([['<Cd>CLAV</Cd>', '<Cd>CLBD</Cd>']])).toMatch(/Relevé 1 : plusieurs soldes CLBD/)
    expect(refus([['<Amt Ccy="EUR">350.00</Amt>', '<Amt Ccy="USD">350.00</Amt>']])).toMatch(/Relevé 1, écriture 1 : devise USD différente de celle du relevé \(EUR\)/)
    expect(refus([['<CdtDbtInd>CRDT</CdtDbtInd>\n        <Sts>', '<CdtDbtInd>CRED</CdtDbtInd>\n        <Sts>']])).toMatch(/Relevé 1, écriture 1 : sens « CRED » illisible \(CRDT ou DBIT attendu\)/)
    expect(refus([['<Amt Ccy="EUR">350.00</Amt>', '<Amt Ccy="EUR">350,00</Amt>']])).toMatch(/Relevé 1, écriture 1 : montant illisible « 350,00 »/)
    expect(refus([['<Amt Ccy="EUR">350.00</Amt>', '<Amt Ccy="EUR">-350.00</Amt>']])).toMatch(/montant illisible « -350.00 »/)
    expect(refus([['<Amt Ccy="EUR">350.00</Amt>', '<Amt>350.00</Amt>']])).toMatch(/Relevé 1, écriture 1 : devise absente/)
    expect(
      refus([
        ['<BookgDt>\n          <Dt>2026-10-01</Dt>\n        </BookgDt>', ''],
        ['<ValDt>\n          <Dt>2026-10-01</Dt>\n        </ValDt>', ''],
      ]),
    ).toMatch(/Relevé 1, écriture 1 : date de comptabilisation absente ou invalide/)
    expect(refus([['<Dt>2026-10-02</Dt>', '<Dt>2026-02-30</Dt>']])).toMatch(/Relevé 1, écriture 2 : date de comptabilisation absente ou invalide/)
    expect(refus([['FR7612345000100001234567849', 'FR7612345000100001234567848']])).toMatch(/Relevé 1 : IBAN invalide « FR7612345000100001234567848 »/)
    expect(refus([['<IBAN>FR7612345000100001234567849</IBAN>', '']])).toMatch(/Relevé 1 : compte non identifié/)
    expect(refus([['<NbOfNtries>4</NbOfNtries>', '<NbOfNtries>5</NbOfNtries>']])).toMatch(/Relevé 1 : totaux annoncés incohérents : 5 écritures annoncées, 4 lues/)
    expect(refus([['<Sum>470</Sum>', '<Sum>471</Sum>']])).toMatch(/Relevé 1 : totaux annoncés incohérents : crédits annoncés 471,00 EUR, lus 470,00 EUR/)
  })
})
