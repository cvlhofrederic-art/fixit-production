import { describe, expect, it } from 'vitest'
import { creerOrdreVirement } from '@/lib/administrateur-judiciaire/domain/ordres-banque'
import {
  PRIORITE_PAR_DEFAUT,
  creerReglagesReglementEntreprise,
  delivrerBap,
  regrouperVirements,
  reglementParDefautFacture,
  retirerBap,
  selectionnerPourCompte,
  type FacturePayable,
  type PolitiqueBap,
  type ReglementARegrouper,
} from '@/lib/administrateur-judiciaire/domain/paiement-fournisseurs'
import { changerStatutReglement } from '@/lib/administrateur-judiciaire/domain/statuts-facture'

/**
 * Préparation des paiements fournisseurs (point 36 du bilan 2 ; cartographie Gestéam, tranches 36, 37, 38 et 43 § 3 et
 * § 25).
 * - Les réglages de règlement de l'entreprise (mode, délai à date de facture, priorité, « 1 virement par » facture ou
 *   mandat) se recopient sur la facture à la saisie.
 * - Le compte payeur (journal de banque) est porté par la facture : un ordre ne prend que les factures de son compte.
 * - Le bon à payer (ou l'acompte) est délivré par un habilité ; au-delà d'un seuil, deux validations distinctes ; une
 *   validation vaut pour le montant validé seulement.
 * - Un virement par facture, ou un par mandat (toutes les factures du fournisseur sur le mandat, même IBAN).
 */

const facture = (id: string, surcharge: Partial<FacturePayable> = {}): FacturePayable => ({
  id,
  prestataireId: 'f-1',
  mandatId: 'M1',
  mode: 'Virement',
  statutSaisie: 'Enregistrée',
  comptabilisee: true,
  statutReglement: 'Bon à payer',
  priorite: 5,
  echeance: '2026-10-15',
  resteDuCentimes: 10_000,
  comptePayeurId: 'b-courant',
  ...surcharge,
})

const politique: PolitiqueBap = { habilites: ['u-resp', 'u-compta', 'u-assist'], doubleValidationAuDelaCentimes: 500_000 }
const ordre = { banqueId: 'b-courant', date: '2026-10-29', soldeDisponibleCentimes: 100_000 }

describe('réglages de règlement de l’entreprise', () => {
  it('par défaut : virement, à date de facture, priorité 5 (seule priorité de paiement observée), par facture', () => {
    expect(PRIORITE_PAR_DEFAUT).toBe(5)
    expect(creerReglagesReglementEntreprise({})).toEqual({
      mode: 'Virement',
      delaiJours: 0,
      priorite: 5,
      unVirementPar: 'facture',
      unChequePar: 'facture',
    })
  })

  it('refuse un mode, un délai, une priorité ou une unité invalides', () => {
    // @ts-expect-error — mode hors MODE_REGLEMENT
    expect(() => creerReglagesReglementEntreprise({ mode: 'Carte' })).toThrow(/mode/i)
    expect(() => creerReglagesReglementEntreprise({ delaiJours: -1 })).toThrow(/délai/i)
    expect(() => creerReglagesReglementEntreprise({ delaiJours: 1.5 })).toThrow(/délai/i)
    expect(() => creerReglagesReglementEntreprise({ priorite: -2 })).toThrow(/priorité/i)
    // @ts-expect-error — unité inconnue
    expect(() => creerReglagesReglementEntreprise({ unVirementPar: 'fournisseur' })).toThrow(/virement/i)
  })

  it('recopiés sur la facture : mode, échéance à date de facture + délai, priorité, « 1 virement par »', () => {
    const reglages = creerReglagesReglementEntreprise({ mode: 'Virement', delaiJours: 30, priorite: 5, unVirementPar: 'mandat' })
    expect(reglementParDefautFacture(reglages, '2026-10-02')).toEqual({
      mode: 'Virement',
      joursEcheance: 30,
      echeance: '2026-11-01',
      priorite: 5,
      unVirementPar: 'mandat',
    })
    expect(() => reglementParDefautFacture(reglages, '02/10/2026')).toThrow(/AAAA-MM-JJ/)
  })

  it('de bout en bout : une facture créée avec les réglages par défaut peut partir dans un ordre', () => {
    const defauts = reglementParDefautFacture(creerReglagesReglementEntreprise({}), '2026-10-01')
    const f = facture('a', { mode: defauts.mode, priorite: defauts.priorite, echeance: defauts.echeance })
    expect(selectionnerPourCompte([f], ordre).retenues.map((x) => x.id)).toEqual(['a'])
  })
})

describe('compte payeur', () => {
  it('un ordre ne prend que les factures de son compte ; les autres sont écartées avec leur motif', () => {
    const selection = selectionnerPourCompte(
      [facture('a'), facture('b', { comptePayeurId: 'b-fonds-travaux' }), facture('c', { comptePayeurId: null }), facture('d')],
      ordre,
    )
    expect(selection.retenues.map((f) => f.id)).toEqual(['a', 'd'])
    expect(selection.totalCentimes).toBe(20_000)
    expect(selection.ecartees).toEqual([
      { factureId: 'b', motif: 'autre_compte_payeur' },
      { factureId: 'c', motif: 'compte_payeur_absent' },
    ])
  })

  it('les règles de statuts-facture s’appliquent ensuite ; le solde n’est consommé que par les factures du compte', () => {
    const selection = selectionnerPourCompte(
      [
        facture('ancienne-autre-compte', { comptePayeurId: 'b-fonds-travaux', echeance: '2026-09-01', resteDuCentimes: 500_000 }),
        facture('en-attente', { statutReglement: 'En attente' }),
        facture('ok'),
      ],
      { ...ordre, soldeDisponibleCentimes: 10_000 },
    )
    expect(selection.retenues.map((f) => f.id)).toEqual(['ok'])
    expect(selection.ecartees).toEqual([
      { factureId: 'ancienne-autre-compte', motif: 'autre_compte_payeur' },
      { factureId: 'en-attente', motif: 'pas_de_bon_a_payer' },
    ])
  })

  it('refuse un compte vide ou une facture en double, même si l’un des exemplaires est d’un autre compte', () => {
    expect(() => selectionnerPourCompte([facture('a')], { ...ordre, banqueId: ' ' })).toThrow(/compte/i)
    expect(() => selectionnerPourCompte([facture('a'), facture('a', { comptePayeurId: null })], ordre)).toThrow(/double/i)
  })
})

describe('bon à payer', () => {
  const enAttente = (surcharge: Partial<FacturePayable> = {}) => facture('a', { statutReglement: 'En attente', ...surcharge })

  it('sous le seuil : une validation d’un habilité suffit ; elle porte le montant validé', () => {
    const resultat = delivrerBap(enAttente(), { par: 'u-resp', le: '2026-10-29' }, politique)
    expect(resultat).toMatchObject({ complet: true, validationsRequises: 1 })
    expect(resultat.facture.statutReglement).toBe('Bon à payer')
    expect(resultat.facture.validationsBap).toEqual([{ par: 'u-resp', le: '2026-10-29', montantCentimes: 10_000 }])
  })

  it('au-delà du seuil : deux validations de deux habilités distincts', () => {
    const grosse = enAttente({ resteDuCentimes: 800_000 })
    const premiere = delivrerBap(grosse, { par: 'u-resp', le: '2026-10-29' }, politique)
    expect(premiere).toMatchObject({ complet: false, validationsRequises: 2 })
    expect(premiere.facture.statutReglement).toBe('En attente')
    expect(() => delivrerBap(premiere.facture, { par: 'u-resp', le: '2026-10-29' }, politique)).toThrow(/déjà validé/i)
    const seconde = delivrerBap(premiere.facture, { par: 'u-compta', le: '2026-10-30' }, politique)
    expect(seconde.complet).toBe(true)
    expect(seconde.facture.statutReglement).toBe('Bon à payer')
    expect(seconde.facture.validationsBap?.map((v) => v.par)).toEqual(['u-resp', 'u-compta'])
  })

  it('les validations d’un cycle précédent (autre montant) ne comptent pas et n’empêchent pas de valider à nouveau', () => {
    const bap = delivrerBap(
      delivrerBap(enAttente({ resteDuCentimes: 800_000 }), { par: 'u-resp', le: '2026-10-01' }, politique).facture,
      { par: 'u-compta', le: '2026-10-01' },
      politique,
    ).facture
    // Paiement partiel par un ordre émis, retour « En attente » pour le solde.
    const solde = { ...changerStatutReglement(changerStatutReglement(bap, 'En règlement'), 'En attente', { ordre: 'Émis' }), resteDuCentimes: 600_000 }
    expect(solde.validationsBap).toHaveLength(2)
    const nouvelle = delivrerBap(solde, { par: 'u-assist', le: '2026-10-20' }, politique)
    expect(nouvelle).toMatchObject({ complet: false, validationsRequises: 2 })
    expect(nouvelle.facture.validationsBap).toEqual([{ par: 'u-assist', le: '2026-10-20', montantCentimes: 600_000 }])
    expect(delivrerBap(nouvelle.facture, { par: 'u-resp', le: '2026-10-21' }, politique).complet).toBe(true)
  })

  it('l’acompte passe par le même circuit, sur le montant de l’acompte', () => {
    const avecAcompte = enAttente({ resteDuCentimes: 900_000, acompteCentimes: 300_000 })
    const acompte = delivrerBap(avecAcompte, { par: 'u-resp', le: '2026-10-29' }, politique, { vers: 'Acompte à régler' })
    expect(acompte).toMatchObject({ complet: true, validationsRequises: 1 })
    expect(acompte.facture.statutReglement).toBe('Acompte à régler')
    expect(acompte.facture.validationsBap).toEqual([{ par: 'u-resp', le: '2026-10-29', montantCentimes: 300_000 }])
  })

  it('avec une politique, la sélection écarte un bon à payer ou un acompte posé sans le circuit', () => {
    const contourne = changerStatutReglement(facture('acompte', { statutReglement: 'En attente', resteDuCentimes: 900_000, acompteCentimes: 900_000 }), 'Acompte à régler')
    const selection = selectionnerPourCompte([contourne, facture('sans-validation')], { ...ordre, soldeDisponibleCentimes: 2_000_000, politique })
    expect(selection.retenues).toEqual([])
    expect(selection.ecartees).toEqual([
      { factureId: 'acompte', motif: 'bon_a_payer_incomplet' },
      { factureId: 'sans-validation', motif: 'bon_a_payer_incomplet' },
    ])
    const valide = delivrerBap(facture('v', { statutReglement: 'En attente' }), { par: 'u-resp', le: '2026-10-29' }, politique).facture
    expect(selectionnerPourCompte([valide], { ...ordre, politique }).retenues.map((f) => f.id)).toEqual(['v'])
  })

  it('sans seuil : toujours une seule validation', () => {
    expect(
      delivrerBap(enAttente({ resteDuCentimes: 9_999_999 }), { par: 'u-resp', le: '2026-10-29' }, { habilites: ['u-resp'], doubleValidationAuDelaCentimes: null }).complet,
    ).toBe(true)
  })

  it('refuse : non habilité, pas en attente, non comptabilisée ou non enregistrée (même au-delà du seuil), seuil ou date invalides', () => {
    expect(() => delivrerBap(enAttente(), { par: 'u-autre', le: '2026-10-29' }, politique)).toThrow(/habilité/i)
    expect(() => delivrerBap(facture('a'), { par: 'u-resp', le: '2026-10-29' }, politique)).toThrow(/en attente/i)
    expect(() => delivrerBap(enAttente({ comptabilisee: false, resteDuCentimes: 800_000 }), { par: 'u-resp', le: '2026-10-29' }, politique)).toThrow(
      /comptabilisée/i,
    )
    expect(() => delivrerBap(enAttente({ statutSaisie: 'En saisie', resteDuCentimes: 800_000 }), { par: 'u-resp', le: '2026-10-29' }, politique)).toThrow(
      /enregistrée/i,
    )
    expect(() => delivrerBap(enAttente(), { par: 'u-resp', le: '2026-10-29' }, { ...politique, doubleValidationAuDelaCentimes: Number.NaN })).toThrow(/seuil/i)
    expect(() => delivrerBap(enAttente(), { par: 'u-resp', le: '2026-10-29' }, { ...politique, doubleValidationAuDelaCentimes: -1 })).toThrow(/seuil/i)
    expect(() => delivrerBap(enAttente(), { par: 'u-resp', le: '29/10/2026' }, politique)).toThrow(/AAAA-MM-JJ/)
  })

  it('retirer le bon à payer remet la facture en attente ; sur une facture en attente, efface les validations partielles', () => {
    const bap = delivrerBap(enAttente(), { par: 'u-resp', le: '2026-10-29' }, politique).facture
    expect(retirerBap(bap)).toMatchObject({ statutReglement: 'En attente', validationsBap: [] })
    const partielle = delivrerBap(enAttente({ resteDuCentimes: 800_000 }), { par: 'u-resp', le: '2026-10-29' }, politique).facture
    expect(retirerBap(partielle)).toMatchObject({ statutReglement: 'En attente', validationsBap: [] })
  })

  it('ne modifie pas la facture reçue', () => {
    const origine = enAttente()
    delivrerBap(origine, { par: 'u-resp', le: '2026-10-29' }, politique)
    expect(origine.statutReglement).toBe('En attente')
    expect(origine.validationsBap).toBeUndefined()
  })
})

describe('regroupement des virements', () => {
  const reglement = (id: string, surcharge: Partial<ReglementARegrouper> = {}): ReglementARegrouper => ({
    reglementId: id,
    factureId: `F-${id}`,
    prestataireId: 'f-1',
    mandatId: 'M1',
    beneficiaire: 'Ascenseurs du Sud',
    iban: 'FR76 3000 6000 0112 3456 7890 189',
    bic: null,
    montantCentimes: 10_000,
    reference: `Fact. ${id}`,
    unVirementPar: 'facture',
    ...surcharge,
  })

  it('un virement par facture : une ligne par règlement', () => {
    const lignes = regrouperVirements([reglement('R1'), reglement('R2')])
    expect(lignes.map((l) => [l.ligne.reglementId, l.ligne.montantCentimes, l.reglementIds])).toEqual([
      ['R1', 10_000, ['R1']],
      ['R2', 10_000, ['R2']],
    ])
    expect(lignes[0].ligne.libelle).toBe('Fact. R1')
  })

  it('un virement par mandat : les factures du fournisseur sur le mandat, au même IBAN, en une ligne qui garde ses règlements', () => {
    const lignes = regrouperVirements(
      [
        reglement('R1'),
        reglement('R2', { mandatId: 'M2' }),
        reglement('R3', { montantCentimes: 2_550 }),
        reglement('R4', { iban: 'FR14 2004 1010 0505 0001 3M02 606' }),
      ].map((r) => ({ ...r, unVirementPar: 'mandat' as const })),
    )
    expect(lignes.map((l) => l.reglementIds)).toEqual([['R1', 'R3'], ['R2'], ['R4']])
    expect(lignes[0].ligne).toMatchObject({ reglementId: 'R1+1', montantCentimes: 12_550, libelle: 'Fact. R1, Fact. R3', reglementIds: ['R1', 'R3'] })
    const ordreVirement = creerOrdreVirement({
      id: 'O1',
      numero: 'OV-1',
      date: '2026-10-29',
      coproprieteId: 'copro-1',
      banqueId: 'b-courant',
      traitementId: 'T1',
      lignes: lignes.map((l) => l.ligne),
    })
    expect(ordreVirement.lignes[0].reglementIds).toEqual(['R1', 'R3'])
  })

  it('le choix est celui recopié sur chaque règlement', () => {
    const lignes = regrouperVirements([
      reglement('R1'),
      reglement('R2'),
      reglement('R3', { prestataireId: 'f-2', unVirementPar: 'mandat' }),
      reglement('R4', { prestataireId: 'f-2', unVirementPar: 'mandat' }),
    ])
    expect(lignes.map((l) => l.reglementIds)).toEqual([['R1'], ['R2'], ['R3', 'R4']])
  })

  it('identifiant de 35 caractères au plus ; libellé de 140 au plus, coupé entre deux références, avec le compte des omises', () => {
    const longs = Array.from({ length: 30 }, (_, i) =>
      reglement(`REGLEMENT-TRES-LONG-IDENTIFIANT-${i}`, { reference: `Facture n° 2026-${1000 + i}`, unVirementPar: 'mandat' }),
    )
    const [groupe] = regrouperVirements(longs)
    expect(groupe.ligne.reglementId.length).toBeLessThanOrEqual(35)
    expect(groupe.ligne.reglementId.endsWith('+29')).toBe(true)
    expect(groupe.ligne.libelle.length).toBeLessThanOrEqual(140)
    expect(groupe.ligne.libelle).toMatch(/^Facture n° 2026-1000, Facture n° 2026-1001, .*Facture n° 2026-\d{4} \+\d+$/)
    expect(groupe.ligne.libelle).not.toMatch(/…/)
    const listees = groupe.ligne.libelle.split(', ').length
    expect(groupe.ligne.libelle.endsWith(` +${30 - listees}`)).toBe(true)
    expect(groupe.reglementIds).toHaveLength(30)
  })

  it('référence vide : l’identifiant de la facture sert de libellé', () => {
    expect(regrouperVirements([reglement('R1', { reference: '  ' })])[0].ligne.libelle).toBe('F-R1')
  })

  it('refuse un montant invalide, un règlement en double ou une unité inconnue', () => {
    expect(() => regrouperVirements([reglement('R1', { montantCentimes: 0 })])).toThrow(/centimes/)
    expect(() => regrouperVirements([reglement('R1'), reglement('R1')])).toThrow(/double/i)
    // @ts-expect-error — unité inconnue
    expect(() => regrouperVirements([reglement('R1', { unVirementPar: 'fournisseur' })])).toThrow(/virement/i)
  })
})
