import { describe, expect, it } from 'vitest'
import {
  PRIORITES_REGLEMENT,
  STATUTS_REGLEMENT_FACTURE,
  STATUTS_SAISIE_FACTURE,
  changerStatutReglement,
  lireCodeStatutGesteam,
  selectionnerFacturesAPayer,
  statutSaisieApresReglement,
  type FactureAPayer,
} from '@/lib/administrateur-judiciaire/domain/statuts-facture'

/**
 * Statuts d'une facture fournisseur (cartographie Gestéam, tranche 43 § 3) : trois axes distincts — saisie, comptabilité,
 * règlement — plus le mode et la priorité de règlement. La colonne « Statut » de la liste Gestéam se lit
 * « <mode> / <statut de saisie> » (V/Saisie, C/Saisie, N/Saisie, V/Enr., V/Réglée).
 * La sélection des factures pour un ordre de virement ne prend qu'une facture au bon à payer, comptabilisée, payable par
 * virement, échue à la date de l'ordre, dont la priorité n'est pas « ne pas régler », dans la limite du solde disponible
 * quand la priorité impose un contrôle de solde.
 */

const facture = (id: string, surcharge: Partial<FactureAPayer> = {}): FactureAPayer => ({
  id,
  fournisseurId: 'f-1',
  mode: 'Virement',
  statutSaisie: 'Enregistrée',
  comptabilisee: true,
  statutReglement: 'Bon à payer',
  priorite: 5,
  echeance: '2026-10-20',
  resteDuCentimes: 10_000,
  ...surcharge,
})

describe('statuts — référentiels Gestéam', () => {
  it('reprend les statuts de saisie et de règlement relevés', () => {
    expect([...STATUTS_SAISIE_FACTURE]).toEqual(['Pré-saisie', 'En saisie', 'Enregistrée', 'Rgt. partiel', 'Réglée', 'Non réglée'])
    expect([...STATUTS_REGLEMENT_FACTURE]).toEqual(['En attente', 'Acompte à régler', 'Bon à payer', 'En règlement', 'Réglée'])
  })

  it('ne connaît que les priorités observées : 5 à échéance avec contrôle de solde, 6 ne pas régler', () => {
    expect(PRIORITES_REGLEMENT).toEqual({
      5: { libelle: 'À échéance AVEC contrôle de solde', aEcheance: true, controleSolde: true, nePasRegler: false },
      6: { libelle: 'Ne pas régler', aEcheance: false, controleSolde: false, nePasRegler: true },
    })
  })
})

describe('statuts — lecture du code de la colonne Statut de Gestéam', () => {
  it('lit « <mode> / <statut de saisie> » pour les codes observés', () => {
    expect(lireCodeStatutGesteam('V/Saisie')).toEqual({ mode: 'Virement', statutSaisie: 'En saisie' })
    expect(lireCodeStatutGesteam('C/Saisie')).toEqual({ mode: 'Chèque', statutSaisie: 'En saisie' })
    expect(lireCodeStatutGesteam('N/Saisie')).toEqual({ mode: 'Pas de règlement', statutSaisie: 'En saisie' })
    expect(lireCodeStatutGesteam(' V/Enr. ')).toEqual({ mode: 'Virement', statutSaisie: 'Enregistrée' })
    expect(lireCodeStatutGesteam('V/Réglée')).toEqual({ mode: 'Virement', statutSaisie: 'Réglée' })
  })

  it('renvoie null pour une lettre ou un statut non observé, plutôt que de deviner', () => {
    expect(lireCodeStatutGesteam('P/Saisie')).toBeNull()
    expect(lireCodeStatutGesteam('V/Règl.')).toBeNull()
    expect(lireCodeStatutGesteam('Virement')).toBeNull()
  })
})

describe('statuts — statut de saisie après règlement', () => {
  it('passe à « Rgt. partiel » puis « Réglée » selon le réglé, et refuse un réglé hors bornes', () => {
    expect(statutSaisieApresReglement(10_000, 0)).toBe('Enregistrée')
    expect(statutSaisieApresReglement(10_000, 4_000)).toBe('Rgt. partiel')
    expect(statutSaisieApresReglement(10_000, 10_000)).toBe('Réglée')
    expect(() => statutSaisieApresReglement(10_000, 12_000)).toThrow(/réglé/i)
    expect(() => statutSaisieApresReglement(10_000, -1)).toThrow(/réglé/i)
  })
})

describe('statuts — transitions du statut de règlement', () => {
  it('suit En attente → Bon à payer → En règlement → Réglée', () => {
    const bap = changerStatutReglement(facture('a', { statutReglement: 'En attente' }), 'Bon à payer')
    expect(bap.statutReglement).toBe('Bon à payer')
    const enReglement = changerStatutReglement(bap, 'En règlement')
    expect(changerStatutReglement(enReglement, 'Réglée').statutReglement).toBe('Réglée')
  })

  it('n’accorde le bon à payer qu’à une facture enregistrée et comptabilisée', () => {
    expect(() =>
      changerStatutReglement(facture('a', { statutReglement: 'En attente', statutSaisie: 'En saisie' }), 'Bon à payer'),
    ).toThrow(/enregistrée/i)
    expect(() =>
      changerStatutReglement(facture('a', { statutReglement: 'En attente', comptabilisee: false }), 'Bon à payer'),
    ).toThrow(/comptabilisée/i)
  })

  it('refuse un saut d’étape et le retour en arrière depuis « Réglée »', () => {
    expect(() => changerStatutReglement(facture('a', { statutReglement: 'En attente' }), 'En règlement')).toThrow(/transition/i)
    expect(() => changerStatutReglement(facture('a', { statutReglement: 'Réglée' }), 'Bon à payer')).toThrow(/transition/i)
  })

  it('permet de retirer le bon à payer ou de sortir une facture d’un ordre non émis', () => {
    expect(changerStatutReglement(facture('a'), 'En attente').statutReglement).toBe('En attente')
    expect(changerStatutReglement(facture('a', { statutReglement: 'En règlement' }), 'Bon à payer').statutReglement).toBe(
      'Bon à payer',
    )
  })

  it('passe par « Acompte à régler » pour un acompte, puis revient au bon à payer du solde', () => {
    const acompte = changerStatutReglement(facture('a', { statutReglement: 'En attente' }), 'Acompte à régler')
    expect(changerStatutReglement(acompte, 'En règlement').statutReglement).toBe('En règlement')
    expect(changerStatutReglement(acompte, 'Bon à payer').statutReglement).toBe('Bon à payer')
  })

  it('ne modifie pas la facture reçue', () => {
    const f = facture('a', { statutReglement: 'En attente' })
    changerStatutReglement(f, 'Bon à payer')
    expect(f.statutReglement).toBe('En attente')
  })
})

describe('sélection des factures pour un ordre de virement', () => {
  it('retient les factures au bon à payer, échues, payables par virement, par échéance puis identifiant', () => {
    const resultat = selectionnerFacturesAPayer(
      [facture('b', { echeance: '2026-10-25' }), facture('a', { echeance: '2026-10-10' }), facture('c', { echeance: '2026-10-25' })],
      { date: '2026-10-28', soldeDisponibleCentimes: 100_000 },
    )
    expect(resultat.retenues.map((f) => f.id)).toEqual(['a', 'b', 'c'])
    expect(resultat.totalCentimes).toBe(30_000)
    expect(resultat.ecartees).toEqual([])
  })

  it('écarte, avec le motif, ce qui ne peut pas partir', () => {
    const resultat = selectionnerFacturesAPayer(
      [
        facture('cheque', { mode: 'Chèque' }),
        facture('attente', { statutReglement: 'En attente' }),
        facture('non-compta', { comptabilisee: false }),
        facture('saisie', { statutSaisie: 'En saisie' }),
        facture('ne-pas', { priorite: 6 }),
        facture('pas-echue', { echeance: '2026-11-15' }),
        facture('prio-inconnue', { priorite: 3 }),
        facture('soldee', { resteDuCentimes: 0 }),
      ],
      { date: '2026-10-28', soldeDisponibleCentimes: 100_000 },
    )
    expect(resultat.retenues).toEqual([])
    expect(resultat.ecartees.map((e) => [e.factureId, e.motif])).toEqual([
      ['cheque', 'mode'],
      ['attente', 'pas_de_bon_a_payer'],
      ['non-compta', 'non_comptabilisee'],
      ['saisie', 'non_enregistree'],
      ['ne-pas', 'ne_pas_regler'],
      ['pas-echue', 'non_echue'],
      ['prio-inconnue', 'priorite_inconnue'],
      ['soldee', 'rien_a_regler'],
    ])
  })

  it('accepte une facture en règlement partiel pour son reste dû', () => {
    const resultat = selectionnerFacturesAPayer([facture('p', { statutSaisie: 'Rgt. partiel', resteDuCentimes: 4_000 })], {
      date: '2026-10-28',
      soldeDisponibleCentimes: 100_000,
    })
    expect(resultat.totalCentimes).toBe(4_000)
  })

  it('arrête la sélection au solde disponible quand la priorité impose le contrôle de solde', () => {
    const resultat = selectionnerFacturesAPayer(
      [
        facture('a', { echeance: '2026-10-01', resteDuCentimes: 6_000 }),
        facture('b', { echeance: '2026-10-02', resteDuCentimes: 6_000 }),
        facture('c', { echeance: '2026-10-03', resteDuCentimes: 3_000 }),
      ],
      { date: '2026-10-28', soldeDisponibleCentimes: 10_000 },
    )
    expect(resultat.retenues.map((f) => f.id)).toEqual(['a', 'c'])
    expect(resultat.ecartees).toEqual([{ factureId: 'b', motif: 'solde_insuffisant' }])
    expect(resultat.totalCentimes).toBe(9_000)
  })

  it('refuse une date ou un solde invalides, et une facture en double', () => {
    expect(() => selectionnerFacturesAPayer([], { date: '28/10/2026', soldeDisponibleCentimes: 0 })).toThrow(/date/i)
    expect(() => selectionnerFacturesAPayer([], { date: '2026-10-28', soldeDisponibleCentimes: 1.5 })).toThrow(/solde/i)
    expect(() =>
      selectionnerFacturesAPayer([facture('a'), facture('a')], { date: '2026-10-28', soldeDisponibleCentimes: 0 }),
    ).toThrow(/double/i)
  })
})
