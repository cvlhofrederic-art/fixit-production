import { describe, expect, it } from 'vitest'
import {
  creerOrdreVirement,
  creerRemiseCheques,
  emettreOrdre,
  genererPain001,
  type LigneCheque,
  type LigneVirement,
} from '@/lib/administrateur-judiciaire/domain/ordres-banque'

/**
 * Ordres de banque (cartographie Gestéam, tranche 29 ; D1 : compte bancaire du syndicat).
 * - Remise de chèques : bordereau numéroté, nombre de pièces, total, rattaché au traitement d'encaissement d'origine.
 * - Ordre de virement : règlements fournisseurs avec IBAN contrôlé ; fichier pain.001.001.03.
 * - Statut Enregistré → Émis ; un ordre ne s'émet qu'une fois.
 */

const cheque = (surcharge: Partial<LigneCheque> = {}): LigneCheque => ({
  encaissementId: 'enc-1',
  tireur: 'Copropriétaire A',
  numeroCheque: '0001234',
  montantCentimes: 45_000,
  ...surcharge,
})

const virement = (surcharge: Partial<LigneVirement> = {}): LigneVirement => ({
  reglementId: 'reg-1',
  beneficiaire: 'Plomberie (fictive)',
  iban: 'FR76 3000 6000 0112 3456 7890 189',
  bic: 'AGRIFRPP',
  montantCentimes: 52_800,
  libelle: 'Facture F-2026-118',
  ...surcharge,
})

const base = { id: 'o-1', numero: 'REM-2026-0042', date: '2026-10-27', coproprieteId: 'copro-tilleuls', banqueId: 'b-courant', traitementId: 't-enc-7' }

describe('remise de chèques', () => {
  it('bordereau : nombre de pièces et total, statut Enregistré', () => {
    expect(creerRemiseCheques({ ...base, lignes: [cheque(), cheque({ encaissementId: 'enc-2', numeroCheque: '0009876', montantCentimes: 12_050 })] })).toMatchObject({
      type: 'Remise de chèques',
      statut: 'Enregistré',
      nombrePieces: 2,
      totalCentimes: 57_050,
    })
  })

  it('refuse une remise vide, un chèque en double, un montant invalide', () => {
    expect(() => creerRemiseCheques({ ...base, lignes: [] })).toThrow(/vide/i)
    expect(() => creerRemiseCheques({ ...base, lignes: [cheque(), cheque({ encaissementId: 'enc-2' })] })).toThrow(/double/i)
    expect(() => creerRemiseCheques({ ...base, lignes: [cheque({ montantCentimes: 0 })] })).toThrow(/montant/i)
  })
})

describe('ordre de virement', () => {
  it('total et nombre de virements ; IBAN contrôlés', () => {
    const ordre = creerOrdreVirement({ ...base, numero: 'VIR-2026-0011', lignes: [virement(), virement({ reglementId: 'reg-2', montantCentimes: 1_200 })] })
    expect(ordre).toMatchObject({ type: 'Ordre de virement', nombrePieces: 2, totalCentimes: 54_000 })
    expect(() => creerOrdreVirement({ ...base, lignes: [virement({ iban: 'FR76 3000 6000 0112 3456 7890 188' })] })).toThrow(/IBAN/)
  })

  it('émission unique', () => {
    const ordre = creerOrdreVirement({ ...base, lignes: [virement()] })
    const emis = emettreOrdre(ordre, '2026-10-28')
    expect(emis).toMatchObject({ statut: 'Émis', dateEmission: '2026-10-28' })
    expect(ordre.statut).toBe('Enregistré')
    expect(() => emettreOrdre(emis, '2026-10-29')).toThrow(/déjà/i)
  })

  it('fichier pain.001.001.03 : en-tête, débiteur (le syndicat), virements', () => {
    const ordre = creerOrdreVirement({ ...base, lignes: [virement(), virement({ reglementId: 'reg-2', beneficiaire: 'A & B', montantCentimes: 1_200 })] })
    const xml = genererPain001(
      ordre,
      { nom: 'SDC Les Tilleuls (fictif)', iban: 'FR14 2004 1010 0505 0001 3M02 606', bic: 'PSSTFRPP' },
      { messageId: 'VIR-2026-0011', dateCreation: '2026-10-27T09:00:00', dateExecution: '2026-10-28' },
    )
    expect(xml).toContain('<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"')
    expect(xml).toMatch(/<GrpHdr>[\s\S]*<NbOfTxs>2<\/NbOfTxs>[\s\S]*<CtrlSum>540.00<\/CtrlSum>/)
    expect(xml).toContain('<ReqdExctnDt>2026-10-28</ReqdExctnDt>')
    expect(xml).toContain('<IBAN>FR1420041010050500013M02606</IBAN>')
    expect(xml).toContain('<InstdAmt Ccy="EUR">528.00</InstdAmt>')
    expect(xml).toContain('A &amp; B')
  })

  it('pas de fichier de virement pour une remise de chèques', () => {
    const remise = creerRemiseCheques({ ...base, lignes: [cheque()] })
    expect(() =>
      genererPain001(remise as never, { nom: 'X', iban: 'FR14 2004 1010 0505 0001 3M02 606', bic: 'PSSTFRPP' }, { messageId: 'M', dateCreation: '2026-10-27T09:00:00', dateExecution: '2026-10-28' }),
    ).toThrow(/virement/i)
  })
})
