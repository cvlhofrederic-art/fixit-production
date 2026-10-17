import { describe, it, expect } from 'vitest'
import { champsDocumentBtp, formatDelaiExecution, titreDocumentParDefaut, typeClientDetecte } from '@/lib/devis-btp-libelles'

describe("formatDelaiExecution — délai d'exécution du formulaire BTP", () => {
  it('garde l\'unité choisie : semaines et mois ne deviennent plus « jours ouvrés »', () => {
    expect(formatDelaiExecution(5, 'semaines', 'fr')).toBe('5 semaines')
    expect(formatDelaiExecution(2, 'mois', 'fr')).toBe('2 mois')
    expect(formatDelaiExecution(10, 'ouvres', 'fr')).toBe('10 jours ouvrés')
    expect(formatDelaiExecution(30, 'calendaires', 'fr')).toBe('30 jours calendaires')
  })

  it('accorde le singulier', () => {
    expect(formatDelaiExecution(1, 'ouvres', 'fr')).toBe('1 jour ouvré')
    expect(formatDelaiExecution(1, 'calendaires', 'fr')).toBe('1 jour calendaire')
    expect(formatDelaiExecution(1, 'semaines', 'fr')).toBe('1 semaine')
    expect(formatDelaiExecution(1, 'mois', 'fr')).toBe('1 mois')
  })

  it('en portugais', () => {
    expect(formatDelaiExecution(5, 'ouvres', 'pt')).toBe('5 dias úteis')
    expect(formatDelaiExecution(1, 'ouvres', 'pt')).toBe('1 dia útil')
    expect(formatDelaiExecution(7, 'calendaires', 'pt')).toBe('7 dias corridos')
    expect(formatDelaiExecution(3, 'semaines', 'pt')).toBe('3 semanas')
    expect(formatDelaiExecution(1, 'mois', 'pt')).toBe('1 mês')
    expect(formatDelaiExecution(4, 'mois', 'pt')).toBe('4 meses')
  })

  it('type absent ou inconnu : jours ouvrés, comme le formulaire par défaut', () => {
    expect(formatDelaiExecution(5, undefined, 'fr')).toBe('5 jours ouvrés')
    expect(formatDelaiExecution(5, '', 'fr')).toBe('5 jours ouvrés')
    expect(formatDelaiExecution(5, 'n_importe_quoi', 'fr')).toBe('5 jours ouvrés')
  })
})

describe('titreDocumentParDefaut — titre quand le document n\'en a pas', () => {
  it('une facture sans titre ne s\'appelle plus « Devis »', () => {
    expect(titreDocumentParDefaut('facture', 'FACT-2026-009', 'fr')).toBe('Facture FACT-2026-009')
    expect(titreDocumentParDefaut('devis', 'DEV-2026-014', 'fr')).toBe('Devis DEV-2026-014')
  })

  it('en portugais', () => {
    expect(titreDocumentParDefaut('facture', 'FT 2026/9', 'pt')).toBe('Fatura FT 2026/9')
    expect(titreDocumentParDefaut('devis', 'ORC-2026-3', 'pt')).toBe('Orçamento ORC-2026-3')
  })

  it('sans numéro : le type seul', () => {
    expect(titreDocumentParDefaut('facture', '', 'fr')).toBe('Facture')
    expect(titreDocumentParDefaut(undefined, undefined, 'fr')).toBe('Devis')
  })

  it('un avoir sans titre s\'intitule « Avoir » (« Nota de crédito » en portugais)', () => {
    expect(titreDocumentParDefaut('facture', 'AV-2026-001', 'fr', 'avoir')).toBe('Avoir AV-2026-001')
    expect(titreDocumentParDefaut('facture', 'NC-2026-1', 'pt', 'avoir')).toBe('Nota de crédito NC-2026-1')
    expect(titreDocumentParDefaut('facture', 'FACT-2026-010', 'fr', 'acompte')).toBe('Facture FACT-2026-010')
  })
})

describe('champsDocumentBtp — champs du PDF BTP, formulaire et liste', () => {
  const base = { locale: 'fr', docType: 'devis', docNumber: 'DEV-2026-030', docTitle: 'Ravalement' }

  it('délai : nombre + unité, délai déjà rédigé prioritaire, vide sans délai', () => {
    expect(champsDocumentBtp({ ...base, executionDelayDays: 5, executionDelayType: 'semaines' }).executionDelay).toBe('5 semaines')
    expect(champsDocumentBtp({ ...base, executionDelay: '3 à 4 semaines', executionDelayDays: 5 }).executionDelay).toBe('3 à 4 semaines')
    expect(champsDocumentBtp({ ...base, executionDelayDays: 0 }).executionDelay).toBe('')
    expect(champsDocumentBtp(base).executionDelay).toBe('')
  })

  it('titre : celui du document, sinon le titre par défaut selon le type', () => {
    expect(champsDocumentBtp(base).docTitle).toBe('Ravalement')
    expect(champsDocumentBtp({ ...base, docType: 'facture', docNumber: 'AV-2026-001', docTitle: '', factureSubType: 'avoir' }).docTitle).toBe('Avoir AV-2026-001')
  })

  it('rétractation : particulier oui, professionnel ou SIRET valide non', () => {
    expect(champsDocumentBtp({ ...base, clientType: 'particulier' })).toMatchObject({ clientType: 'particulier', isHorsEtablissement: true })
    expect(champsDocumentBtp({ ...base, clientType: 'professionnel' })).toMatchObject({ clientType: 'professionnel', isHorsEtablissement: false })
    expect(champsDocumentBtp({ ...base, clientType: 'particulier', clientSiret: '13119725300019', isHorsEtablissement: true }))
      .toMatchObject({ clientType: 'professionnel', isHorsEtablissement: false })
  })

  it('ancien devis sans type de client ni rétractation enregistrée : pas de rétractation (comme avant)', () => {
    expect(champsDocumentBtp(base)).toMatchObject({ clientType: 'particulier', isHorsEtablissement: false })
  })

  it('valeur enregistrée respectée pour un particulier', () => {
    expect(champsDocumentBtp({ ...base, clientType: 'particulier', isHorsEtablissement: false }).isHorsEtablissement).toBe(false)
  })
})

describe('typeClientDetecte — même règle à l\'aperçu et au téléchargement', () => {
  // SIRET au checksum de Luhn valide (SIREN 131197253 + NIC 00019)
  const SIRET_VALIDE = '13119725300019'

  it('un SIRET valide fait un client professionnel, même déclaré particulier', () => {
    expect(typeClientDetecte('particulier', SIRET_VALIDE)).toBe('professionnel')
    expect(typeClientDetecte('particulier', '131 197 253 00019')).toBe('professionnel')
  })

  it('sans SIRET valide, le type déclaré est gardé', () => {
    expect(typeClientDetecte('particulier', '')).toBe('particulier')
    expect(typeClientDetecte('particulier', '12345678901234')).toBe('particulier')
    expect(typeClientDetecte('professionnel', '')).toBe('professionnel')
    expect(typeClientDetecte(undefined, undefined)).toBe('particulier')
  })
})
