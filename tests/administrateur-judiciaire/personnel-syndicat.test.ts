import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { balance } from '@/lib/administrateur-judiciaire/domain/etats-comptables'
import {
  COMPTES_NOMENCLATURE_PAIE,
  IDENTIFIANTS_EMPLOYEUR,
  NATURES_REGLEMENT_PAIE,
  OBLIGATIONS_EMPLOYEUR,
  PLAN_PAIE_PAR_DEFAUT,
  QUALITES_PERSONNEL,
  TYPES_DOCUMENT_EMPLOYEUR,
  compteDebiteReglementPaie,
  controlerBulletin,
  controlerBulletinSalarie,
  controlerFactureHorsPaie,
  controlerIdentifiantsEmployeur,
  controlerReglementPaie,
  creerSalarieSyndicat,
  ecrituresConstatationPaie,
  ecrituresReglementPaie,
  ecrituresTaxeSalaires,
  estEnPoste,
  netRegleParBulletin,
  reglementsEnVigueur,
  estQualitePersonnel,
  traitementConstatationPaie,
  traitementReglementPaie,
  verifierPlanPaie,
  type BulletinPaie,
  type BulletinPaieConstate,
  type ContextePaie,
  type ReglementPaie,
} from '@/lib/administrateur-judiciaire/domain/personnel-syndicat'
import { annulerTraitement, creerTraitement, mouvementsARepartir, type LigneMouvement } from '@/lib/administrateur-judiciaire/domain/traitements'

const CTX: ContextePaie = { segmentSyndicat: 'M001', plan: PLAN_PAIE_PAR_DEFAUT }

const gardien = creerSalarieSyndicat({
  id: 'sal-1',
  coproprieteId: 'copro-1',
  identiteId: 'identite-1',
  qualite: 'Gardien',
  auxiliaire421: '00001',
  entreeLe: '2024-03-01',
  sortieLe: null,
})

/** Exemple du relevé : brut 2 000 €, salariales 440 € (SS 300, autres 140), patronales 800 € (SS 600, autres 200), PAS 60 €, net 1 500 €. */
const bulletin = (champs: Partial<BulletinPaie> = {}): BulletinPaie => ({
  id: 'bul-2026-09',
  salarieId: 'sal-1',
  annee: 2026,
  mois: 9,
  brutCentimes: 200_000,
  cotisations: [
    { organisme: 'securite_sociale', salarialeCentimes: 30_000, patronaleCentimes: 60_000 },
    { organisme: 'autre_organisme', salarialeCentimes: 14_000, patronaleCentimes: 20_000 },
  ],
  prelevementSourceCentimes: 6_000,
  netAPayerCentimes: 150_000,
  ...champs,
})

const reglement = (champs: Partial<ReglementPaie> = {}): ReglementPaie => ({
  id: 'reg-1',
  coproprieteId: 'copro-1',
  mandatId: 'mandat-1',
  nature: 'salaire_net',
  salarieId: 'sal-1',
  bulletinId: 'bul-2026-09',
  montantCentimes: 150_000,
  mode: 'Virement',
  compteBanque: 'M001.51200.00000.0',
  le: '2026-09-30',
  reference: 'VIR-0930',
  ...champs,
})

const constatation = traitementConstatationPaie({ id: 'tr-paie-09', date: '2026-09-30' }, bulletin(), gardien, CTX)

const codes = (liste: { code: string }[]) => liste.map((a) => a.code)
const total = (lignes: LigneMouvement[], sens: 'debit' | 'credit') =>
  lignes.filter((l) => l.sens === sens).reduce((s, l) => s + l.montantCentimes, 0)

describe('référentiels de la paie (arrêté du 14 mars 2005, art. 7)', () => {
  it('intitulés exacts des comptes 421, 431, 432, 442, 641 à 644', () => {
    expect(COMPTES_NOMENCLATURE_PAIE).toEqual({
      remunerations: { compte: '421', libelle: 'Rémunérations dues' },
      securiteSociale: { compte: '431', libelle: 'Sécurité sociale' },
      autresOrganismes: { compte: '432', libelle: 'Autres organismes sociaux' },
      etatImpots: { compte: '442', libelle: 'Etat - impôts et versements assimilés' },
      salaires: { compte: '641', libelle: 'Salaires' },
      chargesSociales: { compte: '642', libelle: 'Charges sociales et organismes sociaux' },
      taxeSalaires: { compte: '643', libelle: 'Taxe sur les salaires' },
      autresFrais: { compte: '644', libelle: 'Autres (médecine du travail, mutuelles, etc.)' },
    })
  })

  it('plan par défaut : 64100 lu (tranche 24 § 5), chaque code est une subdivision de son compte', () => {
    expect(PLAN_PAIE_PAR_DEFAUT.salaires).toBe('64100')
    expect(verifierPlanPaie(PLAN_PAIE_PAR_DEFAUT)).toBe(PLAN_PAIE_PAR_DEFAUT)
  })

  it('refuse un 401 pour les rémunérations, et un code qui n’a pas 5 caractères', () => {
    expect(() => verifierPlanPaie({ ...PLAN_PAIE_PAR_DEFAUT, remunerations: '40100' })).toThrow(/subdivision du 421/)
    expect(() => verifierPlanPaie({ ...PLAN_PAIE_PAR_DEFAUT, salaires: '6410' })).toThrow(/5 caractères/)
  })

  it('qualités du personnel : celles de QUALITE_IDENTITE.personnel', () => {
    expect(QUALITES_PERSONNEL).toEqual(['Gardien', "Employé d'immeuble"])
    expect(estQualitePersonnel("Employé d'immeuble")).toBe(true)
    expect(estQualitePersonnel('Copropriétaire')).toBe(false)
  })

  it('types de document employeur : 12 libellés distincts (tranche 43 § 19 et tranche 18), reliés aux obligations', () => {
    const libelles = TYPES_DOCUMENT_EMPLOYEUR.map((t) => t.libelle)
    expect(new Set(libelles).size).toBe(12)
    expect(TYPES_DOCUMENT_EMPLOYEUR.filter((t) => t.sources.includes('tranche 43 § 19'))).toHaveLength(9)
    expect(TYPES_DOCUMENT_EMPLOYEUR.filter((t) => t.sources.includes('tranche 18'))).toHaveLength(7)
    expect(TYPES_DOCUMENT_EMPLOYEUR.find((t) => t.libelle === 'Déclaration DSN')?.obligation).toBe('dsn')
    const obligations = new Set<string>(OBLIGATIONS_EMPLOYEUR)
    for (const t of TYPES_DOCUMENT_EMPLOYEUR) if (t.obligation !== null) expect(obligations.has(t.obligation)).toBe(true)
  })

  it('identifiants employeur : repris de la fiche mandat (D1, côté syndicat), sans recopie', () => {
    expect(IDENTIFIANTS_EMPLOYEUR).toEqual(['SIRET', 'URSSAF', 'Taxe salaire', 'Caisse retraite', 'No de mutuelle', 'No de prévoyance'])
  })
})

describe('salarié du syndicat', () => {
  const saisie = { id: 's', coproprieteId: 'c', identiteId: 'i', qualite: 'Gardien' as const, auxiliaire421: '00002', entreeLe: '2025-01-01', sortieLe: null }

  it('D1 : rattaché au syndicat employeur (CCN art. 1er), pas au mandat', () => {
    expect(() => creerSalarieSyndicat({ ...saisie, coproprieteId: '' })).toThrow(/syndicat/)
    expect(creerSalarieSyndicat(saisie).coproprieteId).toBe('c')
  })

  it('contrôle la qualité, le sous-compte 421 et les dates', () => {
    expect(() => creerSalarieSyndicat({ ...saisie, qualite: 'Copropriétaire' as never })).toThrow(/Gardien ou Employé d'immeuble/)
    expect(() => creerSalarieSyndicat({ ...saisie, auxiliaire421: '2' })).toThrow(/5 caractères/)
    expect(() => creerSalarieSyndicat({ ...saisie, entreeLe: '2025-02-30' })).toThrow(/entrée/)
    expect(() => creerSalarieSyndicat({ ...saisie, sortieLe: '2024-12-31' })).toThrow(/sortie/)
  })

  it('en poste sur une période semi-ouverte : présent le jour d’entrée, plus le jour de sortie', () => {
    const sorti = creerSalarieSyndicat({ ...saisie, sortieLe: '2025-06-30' })
    expect(estEnPoste(sorti, '2025-01-01')).toBe(true)
    expect(estEnPoste(sorti, '2025-06-29')).toBe(true)
    expect(estEnPoste(sorti, '2025-06-30')).toBe(false)
    expect(estEnPoste(sorti, '2024-12-31')).toBe(false)
  })
})

describe('constatation de la paie (le bulletin vient du prestataire de paie)', () => {
  it('bulletin cohérent : aucune anomalie', () => {
    expect(controlerBulletin(bulletin())).toEqual([])
  })

  it('net incohérent, montant négatif ou décimal, période invalide : anomalies', () => {
    expect(codes(controlerBulletin(bulletin({ netAPayerCentimes: 149_999 })))).toEqual(['net_incoherent'])
    expect(codes(controlerBulletin(bulletin({ prelevementSourceCentimes: -1 })))).toContain('montant_invalide')
    expect(codes(controlerBulletin(bulletin({ brutCentimes: 200_000.5 })))).toContain('montant_invalide')
    expect(codes(controlerBulletin(bulletin({ mois: 13 })))).toEqual(['periode_invalide'])
    expect(codes(controlerBulletin(bulletin({ cotisations: [{ organisme: 'mutuelle' as never, salarialeCentimes: 0, patronaleCentimes: 0 }] })))).toContain(
      'organisme_inconnu',
    )
  })

  it('année sur 4 chiffres au plus : 99 999 refusée', () => {
    expect(codes(controlerBulletin(bulletin({ annee: 99_999 })))).toEqual(['periode_invalide'])
  })

  it('bulletin d’un mois fini avant l’entrée du salarié : refusé ; mois de l’entrée et mois postérieur à la sortie admis (🔴)', () => {
    expect(codes(controlerBulletinSalarie(bulletin({ annee: 2020, mois: 1 }), gardien))).toEqual(['bulletin_avant_entree'])
    expect(() => ecrituresConstatationPaie(bulletin({ annee: 2020, mois: 1 }), gardien, CTX)).toThrow(/entrée/)
    expect(controlerBulletinSalarie(bulletin({ annee: 2024, mois: 3 }), gardien)).toEqual([])
    expect(controlerBulletinSalarie(bulletin(), creerSalarieSyndicat({ ...gardien, sortieLe: '2026-06-30' }))).toEqual([])
    expect(codes(controlerBulletinSalarie(bulletin({ salarieId: 'sal-2' }), gardien))).toEqual(['salarie_incoherent'])
  })

  it('part patronale de la mutuelle : débit 644 (art. 7 « 644 Autres (médecine du travail, mutuelles, etc.) », art. 3) ; crédit 432 ; équilibrée', () => {
    const avecMutuelle = bulletin({
      cotisations: [
        { organisme: 'securite_sociale', salarialeCentimes: 30_000, patronaleCentimes: 60_000 },
        { organisme: 'autre_organisme', salarialeCentimes: 11_000, patronaleCentimes: 16_000 },
        { organisme: 'autre_organisme', auxiliaire: '00009', comptePatronal: 'autresFrais', salarialeCentimes: 3_000, patronaleCentimes: 4_000 },
      ],
    })
    expect(controlerBulletin(avecMutuelle)).toEqual([])
    const lignes = ecrituresConstatationPaie(avecMutuelle, gardien, CTX)
    expect(lignes.filter((l) => l.sens === 'debit')).toEqual([
      { compte: 'M001.64100.00000.0', sens: 'debit', montantCentimes: 200_000 },
      { compte: 'M001.64200.00000.0', sens: 'debit', montantCentimes: 76_000 },
      { compte: 'M001.64400.00000.0', sens: 'debit', montantCentimes: 4_000 },
    ])
    expect(lignes).toContainEqual({ compte: 'M001.43200.00009.0', sens: 'credit', montantCentimes: 7_000 })
    expect(total(lignes, 'debit')).toBe(total(lignes, 'credit'))
    const { traitement } = traitementConstatationPaie({ id: 'tr-mutuelle', date: '2026-09-30' }, avecMutuelle, gardien, CTX)
    expect(mouvementsARepartir([traitement], { du: '2026-09-01', au: '2026-09-30' }).map((m) => m.compte)).toContain('M001.64400.00000.0')
  })

  it('compte de charge patronale : 642 ou 644 seulement ; une cotisation de sécurité sociale reste au 642', () => {
    const cotisation = { salarialeCentimes: 0, patronaleCentimes: 0 }
    expect(codes(controlerBulletin(bulletin({ cotisations: [{ ...cotisation, organisme: 'autre_organisme', comptePatronal: '641' as never }] })))).toContain(
      'compte_charge_invalide',
    )
    expect(
      codes(controlerBulletin(bulletin({ cotisations: [{ ...cotisation, organisme: 'securite_sociale', comptePatronal: 'autresFrais' }] }))),
    ).toContain('compte_charge_invalide')
  })

  it('écriture : 641 et 642 au débit ; 421 du salarié, 431, 432 et 442 au crédit ; équilibrée', () => {
    const lignes = ecrituresConstatationPaie(bulletin(), gardien, CTX)
    expect(lignes).toEqual([
      { compte: 'M001.64100.00000.0', sens: 'debit', montantCentimes: 200_000 },
      { compte: 'M001.64200.00000.0', sens: 'debit', montantCentimes: 80_000 },
      { compte: 'M001.42100.00001.0', sens: 'credit', montantCentimes: 150_000 },
      { compte: 'M001.43100.00000.0', sens: 'credit', montantCentimes: 90_000 },
      { compte: 'M001.43200.00000.0', sens: 'credit', montantCentimes: 34_000 },
      { compte: 'M001.44200.00000.0', sens: 'credit', montantCentimes: 6_000 },
    ])
    expect(total(lignes, 'debit')).toBe(280_000)
    expect(total(lignes, 'credit')).toBe(280_000)
    expect(lignes.some((l) => l.compte.includes('.401'))).toBe(false)
  })

  it('un sous-compte par organisme (art. 8) ; lignes à zéro omises', () => {
    const lignes = ecrituresConstatationPaie(
      bulletin({
        cotisations: [
          { organisme: 'securite_sociale', salarialeCentimes: 30_000, patronaleCentimes: 60_000 },
          { organisme: 'autre_organisme', auxiliaire: '00001', salarialeCentimes: 10_000, patronaleCentimes: 15_000 },
          { organisme: 'autre_organisme', auxiliaire: '00002', salarialeCentimes: 4_000, patronaleCentimes: 5_000 },
        ],
        prelevementSourceCentimes: 0,
        netAPayerCentimes: 156_000,
      }),
      gardien,
      CTX,
    )
    expect(lignes.filter((l) => l.compte.startsWith('M001.432'))).toEqual([
      { compte: 'M001.43200.00001.0', sens: 'credit', montantCentimes: 25_000 },
      { compte: 'M001.43200.00002.0', sens: 'credit', montantCentimes: 9_000 },
    ])
    expect(lignes.some((l) => l.compte.startsWith('M001.442'))).toBe(false)
  })

  it('avantage en nature (logement du gardien) : compte fourni par le cabinet, exigé (🔴), jamais inventé', () => {
    const avecLogement = bulletin({ avantagesEnNatureCentimes: 30_000, netAPayerCentimes: 120_000 })
    expect(controlerBulletin(avecLogement)).toEqual([])
    expect(() => ecrituresConstatationPaie(avecLogement, gardien, CTX)).toThrow(/avantage en nature/)
    const lignes = ecrituresConstatationPaie(avecLogement, gardien, { ...CTX, compteAvantagesEnNature: 'A0001' })
    expect(lignes).toContainEqual({ compte: 'M001.A0001.00000.0', sens: 'credit', montantCentimes: 30_000 })
    expect(total(lignes, 'debit')).toBe(total(lignes, 'credit'))
  })

  it('attributs de l’analytique (010 : rubrique, récupérable 75 %) repris sur les charges, jamais calculés', () => {
    const attributs = { analytique: '010', rubrique: '010', recupLocatairePct: 75 }
    const [salaires, charges] = ecrituresConstatationPaie(bulletin(), gardien, { ...CTX, attributs: { salaires: attributs } })
    expect(salaires.attributs).toEqual(attributs)
    expect(charges.attributs).toBeUndefined()
  })

  it('refuse un bulletin incohérent ou d’un autre salarié', () => {
    expect(() => ecrituresConstatationPaie(bulletin({ netAPayerCentimes: 1 }), gardien, CTX)).toThrow(/net/)
    expect(() => ecrituresConstatationPaie(bulletin({ salarieId: 'sal-2' }), gardien, CTX)).toThrow(/sal-2/)
  })

  it('traitement « Saisie de mouvements » (🔴 famille Paie), libellé de la pièce ; les 64x sont à répartir', () => {
    expect(constatation.traitement.famille).toBe('Saisie de mouvements')
    expect(constatation.libelle).toBe('Paie 09/2026, bulletin bul-2026-09')
    expect(mouvementsARepartir([constatation.traitement], { du: '2026-09-01', au: '2026-09-30' }).map((m) => m.compte)).toEqual([
      'M001.64100.00000.0',
      'M001.64200.00000.0',
    ])
  })

  it('taxe sur les salaires : débit 643 / crédit 442', () => {
    expect(ecrituresTaxeSalaires(150_000, { ...CTX, auxiliaireTaxeSalaires: '00002' })).toEqual([
      { compte: 'M001.64300.00000.0', sens: 'debit', montantCentimes: 150_000 },
      { compte: 'M001.44200.00002.0', sens: 'credit', montantCentimes: 150_000 },
    ])
    expect(() => ecrituresTaxeSalaires(0, CTX)).toThrow(/centimes/)
  })
})

describe('règlement de la paie : catégorie distincte du règlement fournisseur', () => {
  const contexte = { salarie: gardien, bulletin: constatation.bulletin, contexte: CTX, traitements: [constatation.traitement], reglements: [] }

  it('natures fermées : salaire net, cotisations, prélèvement à la source, taxe sur les salaires', () => {
    expect(NATURES_REGLEMENT_PAIE).toEqual([
      'salaire_net',
      'cotisations_securite_sociale',
      'cotisations_autres_organismes',
      'prelevement_source',
      'taxe_salaires',
    ])
  })

  it('compte débité : 421 du salarié, 431, 432 (sous-compte), 442', () => {
    expect(compteDebiteReglementPaie(reglement(), gardien, CTX)).toBe('M001.42100.00001.0')
    const sansSalarie = { salarieId: null, bulletinId: null }
    expect(compteDebiteReglementPaie(reglement({ ...sansSalarie, nature: 'cotisations_securite_sociale' }), null, CTX)).toBe('M001.43100.00000.0')
    expect(compteDebiteReglementPaie(reglement({ ...sansSalarie, nature: 'cotisations_autres_organismes', auxiliaire: '00003' }), null, CTX)).toBe(
      'M001.43200.00003.0',
    )
    expect(compteDebiteReglementPaie(reglement({ ...sansSalarie, nature: 'prelevement_source' }), null, CTX)).toBe('M001.44200.00000.0')
    expect(
      compteDebiteReglementPaie(reglement({ ...sansSalarie, nature: 'taxe_salaires' }), null, { ...CTX, auxiliaireTaxeSalaires: '00002' }),
    ).toBe('M001.44200.00002.0')
    expect(() => compteDebiteReglementPaie(reglement(), null, CTX)).toThrow(/salarié/)
  })

  it('écriture : débit du compte de paie / crédit 512, jamais de 401', () => {
    expect(ecrituresReglementPaie(reglement(), gardien, CTX)).toEqual([
      { compte: 'M001.42100.00001.0', sens: 'debit', montantCentimes: 150_000 },
      { compte: 'M001.51200.00000.0', sens: 'credit', montantCentimes: 150_000 },
    ])
  })

  it('borné au solde créditeur du compte à la date du règlement', () => {
    expect(controlerReglementPaie(reglement(), contexte)).toEqual([])
    expect(codes(controlerReglementPaie(reglement({ montantCentimes: 150_001 }), contexte))).toEqual(['reglement_superieur_au_du'])
    const sansBulletin = { ...contexte, salarie: null, bulletin: null }
    const cotisations = reglement({ nature: 'cotisations_securite_sociale', salarieId: null, bulletinId: null, montantCentimes: 90_000 })
    expect(controlerReglementPaie(cotisations, sansBulletin)).toEqual([])
    expect(codes(controlerReglementPaie({ ...cotisations, le: '2026-09-29' }, sansBulletin))).toEqual(['reglement_superieur_au_du'])
    expect(codes(controlerReglementPaie(reglement({ le: '2026-09-29' }), contexte))).toEqual(['bulletin_non_constate'])
  })

  it('règlement antidaté après un premier règlement déjà écrit : refusé (pas de double paiement du net)', () => {
    const premier = traitementReglementPaie('tr-reg-a', reglement({ id: 'reg-a', le: '2026-10-05' }), contexte)
    const avecPremier = { ...contexte, traitements: [constatation.traitement, premier.traitement], reglements: [premier.reglement] }
    expect(codes(controlerReglementPaie(reglement({ id: 'reg-b', le: '2026-10-01' }), avecPremier))).toEqual(['reglement_superieur_au_du'])
    expect(codes(controlerReglementPaie(reglement({ id: 'reg-b', le: '2026-09-30' }), avecPremier))).toEqual(['reglement_superieur_au_du'])
    expect(() => traitementReglementPaie('tr-reg-b', reglement({ id: 'reg-b', le: '2026-10-01' }), avecPremier)).toThrow(/supérieur au dû/)
  })

  it('plan de paie vérifié aussi au règlement : un « 421 » codé 40100 est refusé', () => {
    const plan401 = { ...CTX, plan: { ...PLAN_PAIE_PAR_DEFAUT, remunerations: '40100' } }
    const reprise401 = creerTraitement({
      id: 'tr-401',
      famille: 'Saisie de mouvements',
      date: '2026-09-30',
      mouvements: [
        { compte: 'M001.61500.00000.0', sens: 'debit', montantCentimes: 150_000 },
        { compte: 'M001.40100.00001.0', sens: 'credit', montantCentimes: 150_000 },
      ],
    })
    const contexte401 = { salarie: gardien, bulletin: constatation.bulletin, contexte: plan401, traitements: [reprise401], reglements: [] }
    expect(() => compteDebiteReglementPaie(reglement(), gardien, plan401)).toThrow(/subdivision du 421/)
    expect(() => controlerReglementPaie(reglement(), contexte401)).toThrow(/subdivision du 421/)
    expect(() => ecrituresReglementPaie(reglement(), gardien, plan401)).toThrow(/subdivision du 421/)
    expect(() => traitementReglementPaie('tr-401-reg', reglement(), contexte401)).toThrow(/subdivision du 421/)
  })

  it('compte de banque : numéro complet <syndicat>.51xxx.<auxiliaire>.<repère>, du segment du syndicat (D1)', () => {
    expect(codes(controlerReglementPaie(reglement({ compteBanque: 'M002.51200.00000.0' }), contexte))).toEqual(['compte_banque_autre_syndicat'])
    expect(codes(controlerReglementPaie(reglement({ compteBanque: '51' }), contexte))).toEqual(['compte_banque_invalide'])
    expect(codes(controlerReglementPaie(reglement({ compteBanque: '51200' }), contexte))).toEqual(['compte_banque_invalide'])
    expect(codes(controlerReglementPaie(reglement({ compteBanque: 'M001.51' }), contexte))).toEqual(['compte_banque_invalide'])
    expect(controlerReglementPaie(reglement({ compteBanque: 'M001.51210.00002.1' }), contexte)).toEqual([])
  })

  it('salaire net : le bulletin réglé est exigé (sinon l’échéance « Paiement du salaire » resterait ouverte)', () => {
    expect(codes(controlerReglementPaie(reglement({ bulletinId: null }), contexte))).toEqual(['bulletin_requis'])
  })

  it('espèces : refus par choix de VitFix (compte 53 non tenu), sans texte qui l’impose ; à trancher (🔴)', () => {
    const [especes] = controlerReglementPaie(reglement({ mode: 'Espèces' }), contexte)
    expect(especes.code).toBe('especes')
    expect(especes.fondement).toBeNull()
    expect(especes.message).toMatch(/choix de VitFix/)
  })

  it('espèces, « Pas de règlement », référence absente, compte qui n’est pas une banque : refusés', () => {
    expect(codes(controlerReglementPaie(reglement({ mode: 'Espèces' }), contexte))).toEqual(['especes'])
    expect(codes(controlerReglementPaie(reglement({ mode: 'Pas de règlement' }), contexte))).toEqual(['mode_invalide'])
    expect(codes(controlerReglementPaie(reglement({ reference: '  ' }), contexte))).toEqual(['reference_absente'])
    expect(codes(controlerReglementPaie(reglement({ compteBanque: 'M001.40100.00001.0' }), contexte))).toEqual(['compte_banque_invalide'])
    expect(codes(controlerReglementPaie(reglement({ montantCentimes: 0 }), contexte))).toEqual(['montant_invalide'])
  })

  it('D1 : salarié du même syndicat ; un nouveau mandat du même syndicat règle la paie', () => {
    expect(controlerReglementPaie(reglement({ mandatId: 'mandat-2' }), contexte)).toEqual([])
    expect(codes(controlerReglementPaie(reglement({ coproprieteId: 'copro-2' }), contexte))).toEqual(['salarie_autre_syndicat'])
    expect(codes(controlerReglementPaie(reglement({ coproprieteId: ' ' }), contexte))).toContain('rattachement_absent')
  })

  it('salarié exigé pour le salaire net seulement', () => {
    expect(codes(controlerReglementPaie(reglement({ salarieId: null }), { ...contexte, salarie: null }))).toEqual(['salarie_requis'])
    expect(codes(controlerReglementPaie(reglement({ salarieId: 'sal-2' }), contexte))).toEqual(['salarie_incoherent'])
    expect(codes(controlerReglementPaie(reglement({ nature: 'prelevement_source', montantCentimes: 6_000 }), contexte))).toEqual([
      'salarie_inattendu',
    ])
    expect(
      controlerReglementPaie(reglement({ nature: 'prelevement_source', salarieId: null, bulletinId: null, montantCentimes: 6_000 }), {
        ...contexte,
        salarie: null,
      }),
    ).toEqual([])
  })

  it('traitement « Règlement de soldes de compte », annulable ; solde le 421 du salarié', () => {
    const { traitement, libelle } = traitementReglementPaie('tr-reg-1', reglement(), contexte)
    expect(traitement.famille).toBe('Règlement de soldes de compte')
    expect(libelle).toBe('Salaire net : règlement réf. VIR-0930 du 30/09/2026')
    const lignes421 = balance([constatation.traitement, traitement], { compteDu: 'M001.42100.00001.0', compteAu: 'M001.42100.00001.0' }).lignes
    expect(lignes421).toMatchObject([{ soldeCrediteurCentimes: 0, soldeDebiteurCentimes: 0 }])
    expect(annulerTraitement(traitement, { id: 'tr-annul', date: '2026-10-01' }).famille).toBe('Annulation de règlements')
    expect(() => traitementReglementPaie('tr-reg-2', reglement({ montantCentimes: 150_001 }), contexte)).toThrow(/supérieur/)
  })
})

describe('règlement du net rapporté au bulletin qu’il règle (constats du tour 2)', () => {
  const bulletin10 = bulletin({ id: 'bul-2026-10', mois: 10 })
  const constatation10 = traitementConstatationPaie({ id: 'tr-paie-10', date: '2026-10-31' }, bulletin10, gardien, CTX)
  const contexte = { salarie: gardien, bulletin: constatation.bulletin, contexte: CTX, traitements: [constatation.traitement], reglements: [] }

  it('bulletin d’un autre salarié : refusé au règlement (avant : accepté, puis le suivi employeur levait une erreur)', () => {
    const bulletinSal2 = { ...bulletin({ id: 'bul-sal2-09', salarieId: 'sal-2' }), traitementId: 'tr-paie-sal2-09' }
    const imputeAuBulletinDeSal2 = reglement({ bulletinId: 'bul-sal2-09' })
    const avecBulletinSal2 = { ...contexte, bulletin: bulletinSal2 }
    expect(codes(controlerReglementPaie(imputeAuBulletinDeSal2, avecBulletinSal2))).toEqual(['bulletin_autre_salarie'])
    expect(() => traitementReglementPaie('tr-x', imputeAuBulletinDeSal2, avecBulletinSal2)).toThrow(
      /salarié sal-1 imputé au bulletin bul-sal2-09 du salarié sal-2/,
    )
  })

  it('bulletin réglé : à fournir, celui que désigne le règlement, et cohérent', () => {
    expect(codes(controlerReglementPaie(reglement({ bulletinId: 'bul-inexistant' }), { ...contexte, bulletin: null }))).toEqual([
      'bulletin_introuvable',
    ])
    expect(codes(controlerReglementPaie(reglement({ bulletinId: 'bul-inexistant' }), contexte))).toEqual(['bulletin_incoherent'])
    expect(codes(controlerReglementPaie(reglement(), { ...contexte, bulletin: { ...constatation.bulletin, netAPayerCentimes: 1 } }))).toEqual(['net_incoherent'])
  })

  it('virement couvrant deux mois imputé au seul bulletin de 09 : refusé, borné au restant dû du bulletin', () => {
    const deuxMois = { ...contexte, traitements: [constatation.traitement, constatation10.traitement] }
    const [refus, ...autres] = controlerReglementPaie(reglement({ le: '2026-10-31', montantCentimes: 300_000 }), deuxMois)
    expect(autres).toEqual([])
    expect(refus?.code).toBe('reglement_superieur_au_du')
    expect(refus?.message).toMatch(/150000 restant dû sur le bulletin bul-2026-09/)
    expect(controlerReglementPaie(reglement({ le: '2026-10-31' }), deuxMois)).toEqual([])
    expect(controlerReglementPaie(reglement({ le: '2026-10-31', bulletinId: 'bul-2026-10' }), { ...deuxMois, bulletin: constatation10.bulletin })).toEqual([])
  })

  it('restant dû du bulletin : net moins les règlements déjà écrits qui lui sont imputés', () => {
    const premier = traitementReglementPaie('tr-reg-a', reglement({ id: 'reg-a', montantCentimes: 100_000 }), contexte)
    const ctx = {
      ...contexte,
      traitements: [constatation.traitement, constatation10.traitement, premier.traitement],
      reglements: [premier.reglement],
    }
    expect(codes(controlerReglementPaie(reglement({ id: 'reg-b', le: '2026-10-31', montantCentimes: 60_000 }), ctx))).toEqual([
      'reglement_superieur_au_du',
    ])
    expect(controlerReglementPaie(reglement({ id: 'reg-b', le: '2026-10-31', montantCentimes: 50_000 }), ctx)).toEqual([])
  })

  it('règlement annulé (virement rejeté) : ne réduit plus le restant dû du bulletin', () => {
    const rejete = traitementReglementPaie('tr-reg-r', reglement({ id: 'reg-r' }), contexte)
    const annulation = annulerTraitement(rejete.traitement, { id: 'tr-annul', date: '2026-10-02' })
    const sansAnnulation = { ...contexte, traitements: [constatation.traitement, rejete.traitement], reglements: [rejete.reglement] }
    expect(codes(controlerReglementPaie(reglement({ id: 'reg-s', le: '2026-10-05' }), sansAnnulation))).toEqual(['reglement_superieur_au_du'])
    const avecAnnulation = { ...sansAnnulation, traitements: [...sansAnnulation.traitements, annulation] }
    expect(controlerReglementPaie(reglement({ id: 'reg-s', le: '2026-10-05' }), avecAnnulation)).toEqual([])
  })

  it('règlement écrit relié à son traitement ; en vigueur tant que ce traitement est au grand livre sans annulation', () => {
    const ecrit = traitementReglementPaie('tr-reg-1', reglement(), contexte)
    expect(ecrit.reglement).toEqual({ ...reglement(), traitementId: 'tr-reg-1' })
    const annulation = annulerTraitement(ecrit.traitement, { id: 'tr-annul', date: '2026-10-02' })
    expect(reglementsEnVigueur([ecrit.reglement], [ecrit.traitement])).toEqual([ecrit.reglement])
    expect(reglementsEnVigueur([ecrit.reglement], [ecrit.traitement, annulation])).toEqual([])
    expect(() => reglementsEnVigueur([ecrit.reglement], [constatation.traitement])).toThrow(/traitement tr-reg-1 absent du grand livre/)
  })

  it('net réglé par bulletin : seuls les règlements du salaire net, cumulés par bulletin', () => {
    const regles = netRegleParBulletin([
      reglement({ id: 'reg-1', montantCentimes: 100_000 }),
      reglement({ id: 'reg-2', montantCentimes: 50_000 }),
      reglement({ id: 'reg-3', bulletinId: 'bul-2026-10' }),
      reglement({ id: 'reg-c', nature: 'cotisations_securite_sociale', salarieId: null, bulletinId: null }),
    ])
    expect([...regles]).toEqual([
      ['bul-2026-09', 150_000],
      ['bul-2026-10', 150_000],
    ])
  })
})

describe('règlement du net : rien n’est dû sur un bulletin avant sa constatation (constat du tour 3)', () => {
  const bulletin10 = bulletin({ id: 'bul-2026-10', mois: 10 })
  const constatation10 = traitementConstatationPaie({ id: 'tr-paie-10', date: '2026-10-31' }, bulletin10, gardien, CTX)
  const bulletin10Constate: BulletinPaieConstate = { ...bulletin10, traitementId: 'tr-paie-10' }
  const bulletin09Constate: BulletinPaieConstate = { ...bulletin(), traitementId: 'tr-paie-09' }
  /** 05/10 : seul le bulletin de 09 est constaté, et impayé : le 421 porte son net (150 000). */
  const imputeAuBulletin10 = reglement({ id: 'reg-10', bulletinId: 'bul-2026-10', le: '2026-10-05' })
  const au0510 = { salarie: gardien, bulletin: bulletin10Constate, contexte: CTX, traitements: [constatation.traitement], reglements: [] }
  const au3110 = { ...au0510, traitements: [constatation.traitement, constatation10.traitement] }

  it('bulletin constaté : relié au traitement de sa constatation', () => {
    expect(constatation10.bulletin).toEqual(bulletin10Constate)
    expect(constatation.bulletin).toEqual(bulletin09Constate)
  })

  it('imputé à un bulletin pas encore constaté : refusé, même si le 421 porte le solde d’un autre bulletin (avant : accepté)', () => {
    expect(balance([constatation.traitement], { compteDu: 'M001.42100.00001.0', compteAu: 'M001.42100.00001.0', au: '2026-10-05' }).lignes).toMatchObject([
      { soldeCrediteurCentimes: 150_000 },
    ])
    const [absente, ...autres] = controlerReglementPaie(imputeAuBulletin10, au0510)
    expect(autres).toEqual([])
    expect(absente?.code).toBe('bulletin_non_constate')
    expect(absente?.message).toMatch(/constatation tr-paie-10 absente du grand livre fourni/)
    expect(codes(controlerReglementPaie(imputeAuBulletin10, au3110))).toEqual(['bulletin_non_constate'])
    expect(controlerReglementPaie(imputeAuBulletin10, au3110)[0]?.message).toMatch(/constaté le 31\/10\/2026, après le règlement du 05\/10\/2026/)
    expect(() => traitementReglementPaie('tr-reg-10', imputeAuBulletin10, au3110)).toThrow(/rien n'est dû avant la constatation/)
  })

  it('constaté le jour du règlement ou avant : admis ; le net d’un bulletin n’est jamais réglé la veille de sa constatation', () => {
    expect(controlerReglementPaie({ ...imputeAuBulletin10, le: '2026-10-31' }, au3110)).toEqual([])
    const veille = { ...au0510, bulletin: bulletin09Constate }
    expect(codes(controlerReglementPaie(reglement({ le: '2026-09-29' }), veille))).toEqual(['bulletin_non_constate'])
    expect(controlerReglementPaie(reglement({ le: '2026-09-30' }), veille)).toEqual([])
  })

  it('constatation annulée (famille « Paie » annulable, 🔴 2) : rien n’est dû sur le bulletin', () => {
    const annulation = creerTraitement({
      id: 'tr-annul-paie-09',
      famille: 'Annulation de règlements',
      date: '2026-10-01',
      annule: 'tr-paie-09',
      mouvements: constatation.traitement.mouvements.map(({ compte, sens, montantCentimes }) => ({
        compte,
        sens: sens === 'debit' ? ('credit' as const) : ('debit' as const),
        montantCentimes,
      })),
    })
    const annulee = { ...au0510, bulletin: bulletin09Constate, traitements: [constatation.traitement, annulation] }
    expect(codes(controlerReglementPaie(reglement({ le: '2026-10-05' }), annulee))).toEqual(['bulletin_non_constate'])
    expect(controlerReglementPaie(reglement({ le: '2026-10-05' }), annulee)[0]?.message).toMatch(/constatation tr-paie-09 annulée/)
  })

  it('date du règlement invalide : signalée seule (aucune comparaison avec une date invalide)', () => {
    expect(codes(controlerReglementPaie(reglement({ le: 'pas-une-date' }), { ...au0510, bulletin: bulletin09Constate }))).toEqual(['date_invalide'])
  })
})

describe('garde contre le circuit Gestéam (salaire réglé comme une facture, tranche 43 § 10)', () => {
  it('641, 642, 643 en facture : anomalie ; 644 (médecine du travail, mutuelle) : facture admise', () => {
    expect(codes(controlerFactureHorsPaie([{ comptePlan: '64100' }, { comptePlan: '61500' }], 'Fournisseur'))).toEqual(['salaire_en_facture'])
    expect(codes(controlerFactureHorsPaie([{ comptePlan: '64200' }, { comptePlan: '64300' }], null))).toEqual([
      'salaire_en_facture',
      'salaire_en_facture',
    ])
    expect(controlerFactureHorsPaie([{ comptePlan: '64400' }], 'Organisme social')).toEqual([])
  })

  it('un tiers « Salarié » n’est pas un fournisseur', () => {
    expect(codes(controlerFactureHorsPaie([{ comptePlan: '61500' }], 'Salarié'))).toEqual(['tiers_salarie_en_fournisseur'])
  })
})

describe('identifiants du syndicat employeur', () => {
  it('aucun salarié en poste : aucune alerte', () => {
    const sorti = creerSalarieSyndicat({ ...gardien, sortieLe: '2026-01-31' })
    expect(controlerIdentifiantsEmployeur([sorti], '2026-10-30', {})).toEqual([])
  })

  it('salarié en poste : alerte de gestion par identifiant absent ; SIRET fondé sur la DSN', () => {
    const anomalies = controlerIdentifiantsEmployeur([gardien], '2026-10-30', { URSSAF: '123', 'Taxe salaire': ' ' })
    expect(anomalies.map((a) => a.message)).toHaveLength(5)
    expect(codes(anomalies)).toEqual(Array(5).fill('identifiant_employeur_absent'))
    expect(anomalies.find((a) => a.message.includes('SIRET'))?.fondement).toMatch(/R133-14/)
    expect(anomalies.find((a) => a.message.includes('Caisse retraite'))?.fondement).toBeNull()
  })
})

describe('en-tête du module (marqueurs 🟢 / 🔵 / 🔴)', () => {
  const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'personnel-syndicat.ts'), 'utf8')
  const entete = source.slice(0, source.indexOf('*/')).replaceAll(/\s*\n\s*\*\s*/g, ' ')
  const nonEtabli = entete.slice(entete.indexOf('🔴 Non établi'))
  const deduit = entete.slice(entete.indexOf('🔵 Déduit'), entete.indexOf('🔴 Non établi'))

  it('🟢 art. 10 : aucune règle de fonctionnement pour les 42, 43, 442 et 64 (il en donne une pour les 441 et 443)', () => {
    expect(entete).toMatch(/comptes 42, 43, 442 et 64/)
    expect(entete).not.toMatch(/42, 43, 44 et 64/)
  })

  it('🟢 tranche 18 : la famille « Employeur » est un échantillon, pas une liste de 7 types', () => {
    expect(entete).toMatch(/7 types relevés \(échantillon non exhaustif/)
    expect(entete).not.toMatch(/« Employeur » \(7 types\)/)
  })

  it('espèces : choix de VitFix posé en 🔴 (C. trav. L7211-3, 6°), plus en 🔵 ; prévoyance en 🔴', () => {
    expect(deduit).not.toMatch(/espèces refusées/)
    expect(nonEtabli).toMatch(/espèces/)
    expect(nonEtabli).toMatch(/L7211-3, 6°/)
    expect(nonEtabli).toMatch(/prévoyance/)
  })

  it('sources Gestéam, droit relu et marqueurs', () => {
    expect(entete).toMatch(/tranche 43 § 10/)
    expect(entete).toMatch(/§ 19/)
    expect(entete).toMatch(/Légifrance le 30\/10\/2026/)
    expect(entete).toMatch(/arrêté du 14 mars 2005/)
    for (const marqueur of ['🟢', '🔵', '🔴']) expect(entete).toContain(marqueur)
  })

  it('🔴 questions exactes : reclassement des 401 « salarié », famille « Paie », avantage en nature', () => {
    expect(nonEtabli).toMatch(/reclasser les soldes 401 « salarié » en 421/)
    expect(nonEtabli).toMatch(/famille « Paie »/)
    expect(nonEtabli).toMatch(/avantage en nature/i)
  })

  it('aucune date ISO dans la source', () => {
    expect(source).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })
})
