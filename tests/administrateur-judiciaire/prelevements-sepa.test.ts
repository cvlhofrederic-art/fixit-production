import { describe, expect, it } from 'vitest'
import {
  genererPain008,
  preparerLotPrelevements,
  validerIcs,
  type EcheancePrelevement,
} from '@/lib/administrateur-judiciaire/domain/prelevements-sepa'

/**
 * Prélèvements SEPA des copropriétaires (cartographie Gestéam, tranches 25 et 29 ; D1 : créancier = le syndicat).
 * - Échéancier : montant prélevé plafonné au solde dû ; compte en contentieux exclu par défaut (colonne « Ctx »).
 * - Exclusions motivées : solde nul, IBAN invalide, RUM absente.
 * - Fichier pain.008.001.02 : un bloc par type de séquence (FRST / RCUR), totaux de contrôle.
 */

// IBAN de test publiés et ICS d'exemple : aucun compte ni créancier réels.
const echeance = (surcharge: Partial<EcheancePrelevement> = {}): EcheancePrelevement => ({
  id: 'e-1',
  compteCoproprietaire: 'TILL.45000.00012.0',
  debiteur: 'Copropriétaire A',
  iban: 'FR76 3000 6000 0112 3456 7890 189',
  bic: 'AGRIFRPP',
  rum: 'RUM-TILL-00012',
  dateSignatureMandat: '2024-03-01',
  sequence: 'RCUR',
  montantEcheanceCentimes: 30_000,
  soldeDuCentimes: 45_000,
  contentieux: false,
  ...surcharge,
})

const creancier = { nom: 'SDC Les Tilleuls (fictif)', ics: 'FR12ZZZ123456', iban: 'FR14 2004 1010 0505 0001 3M02 606', bic: 'PSSTFRPP' }

describe('SEPA — identifiant créancier', () => {
  it('ICS français : FR + 2 chiffres de clé + 3 caractères + 6 caractères', () => {
    expect(validerIcs('FR12ZZZ123456')).toBe(true)
    expect(validerIcs('fr12zzz123456')).toBe(true)
    expect(validerIcs('FR12ZZZ12345')).toBe(false)
    expect(validerIcs('DE12ZZZ123456')).toBe(false)
  })
})

describe('SEPA — préparation du lot', () => {
  it('plafonne au solde dû et exclut avec motif', () => {
    const lot = preparerLotPrelevements([
      echeance(),
      echeance({ id: 'e-2', soldeDuCentimes: 12_000 }),
      echeance({ id: 'e-3', soldeDuCentimes: 0 }),
      echeance({ id: 'e-4', contentieux: true }),
      echeance({ id: 'e-5', iban: 'FR76 3000 6000 0112 3456 7890 188' }),
      echeance({ id: 'e-6', rum: ' ' }),
    ])
    expect(lot.retenues.map((l) => [l.id, l.montantCentimes])).toEqual([
      ['e-1', 30_000],
      ['e-2', 12_000],
    ])
    expect(lot.exclues.map((e) => [e.id, e.motif])).toEqual([
      ['e-3', 'solde_nul'],
      ['e-4', 'contentieux'],
      ['e-5', 'iban_invalide'],
      ['e-6', 'rum_absente'],
    ])
    expect(lot.totalCentimes).toBe(42_000)
  })

  it('un compte en contentieux peut être gardé si le cabinet le décide', () => {
    expect(preparerLotPrelevements([echeance({ contentieux: true })], { exclureContentieux: false }).retenues).toHaveLength(1)
  })
})

describe('SEPA — fichier pain.008.001.02', () => {
  const lot = preparerLotPrelevements([echeance(), echeance({ id: 'e-2', sequence: 'FRST', debiteur: 'Copro <B> & fils', montantEcheanceCentimes: 5_050 })])
  const xml = genererPain008(lot, creancier, { messageId: 'TILL-20261105-01', dateCreation: '2026-10-27T09:00:00', dateEcheance: '2026-11-05' })

  it('en-tête : espace de noms, identifiant de message, nombre et somme de contrôle', () => {
    expect(xml).toContain('<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02"')
    expect(xml).toContain('<MsgId>TILL-20261105-01</MsgId>')
    expect(xml).toMatch(/<GrpHdr>[\s\S]*<NbOfTxs>2<\/NbOfTxs>[\s\S]*<CtrlSum>350.50<\/CtrlSum>/)
  })

  it('un bloc par séquence, avec l’ICS du créancier et la date d’échéance', () => {
    expect(xml.match(/<PmtInf>/g)).toHaveLength(2)
    expect(xml).toContain('<SeqTp>FRST</SeqTp>')
    expect(xml).toContain('<SeqTp>RCUR</SeqTp>')
    expect(xml).toContain('<ReqdColltnDt>2026-11-05</ReqdColltnDt>')
    expect(xml).toContain('<Id>FR12ZZZ123456</Id>')
  })

  it('chaque transaction porte RUM, date de signature, montant, IBAN sans espaces ; texte échappé', () => {
    expect(xml).toContain('<MndtId>RUM-TILL-00012</MndtId>')
    expect(xml).toContain('<DtOfSgntr>2024-03-01</DtOfSgntr>')
    expect(xml).toContain('<InstdAmt Ccy="EUR">50.50</InstdAmt>')
    expect(xml).toContain('<IBAN>FR7630006000011234567890189</IBAN>')
    expect(xml).toContain('Copro &lt;B&gt; &amp; fils')
  })

  it('refuse un ICS invalide, un IBAN créancier invalide ou un lot vide', () => {
    const options = { messageId: 'M', dateCreation: '2026-10-27T09:00:00', dateEcheance: '2026-11-05' }
    expect(() => genererPain008(lot, { ...creancier, ics: 'FR1' }, options)).toThrow(/ICS/)
    expect(() => genererPain008(lot, { ...creancier, iban: 'FR00' }, options)).toThrow(/IBAN/)
    expect(() => genererPain008(preparerLotPrelevements([]), creancier, options)).toThrow(/vide/i)
  })
})
