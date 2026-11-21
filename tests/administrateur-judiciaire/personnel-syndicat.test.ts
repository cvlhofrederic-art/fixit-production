import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { balance } from '@/lib/administrateur-judiciaire/domain/etats-comptables'
import {
  COMPTES_NOMENCLATURE_PAIE,
  ELEMENTS_NON_RECUPERABLES,
  IDENTIFIANTS_EMPLOYEUR,
  MESSAGE_BULLETIN_APRES_SORTIE,
  METHODES_AVANTAGES_EN_NATURE,
  NATURES_LIGNE_BULLETIN,
  NATURES_REGLEMENT_PAIE,
  OBLIGATIONS_EMPLOYEUR,
  PARTS_RECUPERABLES_DECRET_87_713,
  PLAN_PAIE_PAR_DEFAUT,
  QUALITES_PERSONNEL,
  TYPES_DOCUMENT_EMPLOYEUR,
  anomaliesBloquantesPaie,
  categorieRecuperable,
  compteDebiteReglementPaie,
  controlerBulletin,
  controlerBulletinSalarie,
  controlerFactureHorsPaie,
  controlerIdentifiantsEmployeur,
  controlerRecuperablePaie,
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
  type LigneBulletin,
  type ReglementPaie,
  type SalarieSyndicat,
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

  it('bulletin d’un mois fini avant l’entrée du salarié : refusé ; mois de l’entrée admis', () => {
    expect(codes(controlerBulletinSalarie(bulletin({ annee: 2020, mois: 1 }), gardien))).toEqual(['bulletin_avant_entree'])
    expect(() => ecrituresConstatationPaie(bulletin({ annee: 2020, mois: 1 }), gardien, CTX)).toThrow(/entrée/)
    expect(controlerBulletinSalarie(bulletin({ annee: 2024, mois: 3 }), gardien)).toEqual([])
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

  it('avantage en nature, méthode du compte du cabinet (F41) : compte fourni par le cabinet, exigé, jamais inventé', () => {
    const avecLogement = bulletin({ avantagesEnNatureCentimes: 30_000, netAPayerCentimes: 120_000 })
    expect(controlerBulletin(avecLogement)).toEqual([])
    const methodeCabinet = { ...CTX, methodeAvantagesEnNature: 'compte_cabinet' } as const
    expect(() => ecrituresConstatationPaie(avecLogement, gardien, methodeCabinet)).toThrow(/compte de contrepartie des avantages en nature à fournir par le cabinet/)
    const lignes = ecrituresConstatationPaie(avecLogement, gardien, { ...methodeCabinet, compteAvantagesEnNature: 'A0001' })
    expect(lignes).toContainEqual({ compte: 'M001.64100.00000.0', sens: 'debit', montantCentimes: 200_000 })
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

describe('J67, R38 — part récupérable sur le locataire (décret n° 87-713, art. 2)', () => {
  const salarie = (qualite: SalarieSyndicat['qualite'], tachesContrat: SalarieSyndicat['tachesContrat']) =>
    creerSalarieSyndicat({ ...gardien, qualite, tachesContrat })
  const repris = (pct: number): ContextePaie => ({
    ...CTX,
    attributs: { salaires: { analytique: '010', recupLocatairePct: pct }, chargesSociales: { analytique: '010', recupLocatairePct: pct } },
  })
  const mutuelle = { organisme: 'autre_organisme', comptePatronal: 'autresFrais', salarialeCentimes: 3_000, patronaleCentimes: 4_000 } as const

  it('taux du décret : 75 % (gardien : entretien et rejets), 40 % (une seule tâche), 100 % (employé d’immeuble), 10 % (encadrement en régie)', () => {
    expect(PARTS_RECUPERABLES_DECRET_87_713).toEqual({
      gardien_entretien_et_rejets: 75,
      gardien_une_tache: 40,
      employe_immeuble: 100,
      encadrement_technique_regie: 10,
    })
    expect(categorieRecuperable(salarie('Gardien', 'entretien_et_rejets'))).toBe('gardien_entretien_et_rejets')
    expect(categorieRecuperable(salarie('Gardien', 'rejets'))).toBe('gardien_une_tache')
    expect(categorieRecuperable(salarie("Employé d'immeuble", 'entretien'))).toBe('employe_immeuble')
    expect(categorieRecuperable(gardien)).toBeNull()
    expect(() => creerSalarieSyndicat({ ...gardien, tachesContrat: 'menage' as never })).toThrow(/Tâches du contrat/)
  })

  it('taux repris de l’analytique contrôlé contre la fonction et les tâches du contrat : alerte d’écart, non bloquante', () => {
    expect(controlerRecuperablePaie(salarie('Gardien', 'entretien_et_rejets'), repris(75))).toEqual([])
    const ecarts = controlerRecuperablePaie(salarie('Gardien', 'entretien'), repris(75))
    expect(codes(ecarts)).toEqual(['recuperable_ecart', 'recuperable_ecart'])
    expect(ecarts[0].message).toBe(
      "Compte 641 « Salaires » : part récupérable de 75 % reprise de l'analytique ; 40 % selon la fonction et les tâches du contrat du salarié sal-1.",
    )
    expect(ecarts[0].fondement).toBe('Décret n° 87-713, art. 2, c ; J67, R38')
    expect(controlerRecuperablePaie(salarie("Employé d'immeuble", 'rejets'), repris(75))[0].fondement).toBe('Décret n° 87-713, art. 2, d ; J67, R38')
  })

  it('sans tâches saisies : le taux repris est gardé, à confirmer ; sans analytique : rien à signaler', () => {
    const [alerte, ...autres] = controlerRecuperablePaie(gardien, { ...CTX, attributs: { salaires: { recupLocatairePct: 75 } } })
    expect(autres).toEqual([])
    expect(alerte.code).toBe('recuperable_a_confirmer')
    expect(alerte.message).toBe("Compte 641 « Salaires » : part récupérable de 75 % reprise de l'analytique, à confirmer : tâches du contrat du salarié sal-1 non saisies.")
    expect(controlerRecuperablePaie(gardien, CTX)).toEqual([])
  })

  it('part patronale de mutuelle (644) : 0 % selon la nature de la ligne, même si l’analytique porte un autre taux (alerte)', () => {
    const avecMutuelle = bulletin({ cotisations: [...bulletin().cotisations, mutuelle], netAPayerCentimes: 147_000 })
    const attributs = { salaires: { analytique: '010', recupLocatairePct: 75 }, autresFrais: { analytique: '012', recupLocatairePct: 75 } }
    const lignes = ecrituresConstatationPaie(avecMutuelle, gardien, { ...CTX, attributs })
    expect(lignes.find((l) => l.compte === 'M001.64400.00000.0')?.attributs).toEqual({ analytique: '012', recupLocatairePct: 0 })
    const [alerte] = controlerRecuperablePaie(salarie('Gardien', 'entretien_et_rejets'), { ...CTX, attributs })
    expect(alerte).toEqual({
      code: 'recuperable_exclu_force',
      message: "Compte 644 « Autres (médecine du travail, mutuelles, etc.) » : jamais récupérable, 0 % appliqué au lieu des 75 % de l'analytique.",
      fondement: 'Décret n° 87-713, art. 2, c ; J67, R38 et R39',
    })
  })

  it('prévoyance passée au 644 par le cabinet : le compte entier reste à 0 % (J67, R39), sans la nommer « mutuelle » ; au 642, elle garde son taux', () => {
    const prevoyance = { organisme: 'autre_organisme', salarialeCentimes: 2_000, patronaleCentimes: 20_000 } as const
    const attributs = { chargesSociales: { analytique: '010', recupLocatairePct: 75 }, autresFrais: { analytique: '010', recupLocatairePct: 75 } }
    const au644 = bulletin({ cotisations: [...bulletin().cotisations, { ...prevoyance, comptePatronal: 'autresFrais' }], netAPayerCentimes: 148_000 })
    const ligne644 = ecrituresConstatationPaie(au644, gardien, { ...CTX, attributs }).find((l) => l.compte === 'M001.64400.00000.0')
    expect(ligne644).toMatchObject({ montantCentimes: 20_000, attributs: { recupLocatairePct: 0 } })
    const alerte = controlerRecuperablePaie(salarie('Gardien', 'entretien_et_rejets'), { ...CTX, attributs }).find((a) => a.code === 'recuperable_exclu_force')
    expect(alerte?.message).not.toMatch(/part patronale de mutuelle/)
    expect(alerte?.message).toMatch(/jamais récupérable, 0 % appliqué au lieu des 75 %/)
    const au642 = bulletin({ cotisations: [...bulletin().cotisations, prevoyance], netAPayerCentimes: 148_000 })
    const ligne642 = ecrituresConstatationPaie(au642, gardien, { ...CTX, attributs }).find((l) => l.compte === 'M001.64200.00000.0')
    expect(ligne642?.attributs?.recupLocatairePct).toBe(75)
  })

  it('salaire en nature et éléments exclus retirés de la base récupérable : une seconde ligne au 641, à 0 %', () => {
    const attributs = { analytique: '010', rubrique: '010', recupLocatairePct: 75 }
    const b = bulletin({ brutCentimes: 260_000, avantagesEnNatureCentimes: 30_000, elementsNonRecuperablesCentimes: { indemnite_licenciement: 30_000 }, netAPayerCentimes: 180_000 })
    expect(controlerBulletin(b)).toEqual([])
    const ctx = { ...CTX, methodeAvantagesEnNature: 'compte_cabinet', compteAvantagesEnNature: 'A0001' } as const
    const lignes = ecrituresConstatationPaie(b, gardien, { ...ctx, attributs: { salaires: attributs } })
    expect(lignes.filter((l) => l.compte === 'M001.64100.00000.0')).toEqual([
      { compte: 'M001.64100.00000.0', sens: 'debit', montantCentimes: 200_000, attributs },
      { compte: 'M001.64100.00000.0', sens: 'debit', montantCentimes: 60_000, attributs: { ...attributs, recupLocatairePct: 0 } },
    ])
    expect(total(lignes, 'debit')).toBe(total(lignes, 'credit'))
    // Sans analytique, rien à forcer : une seule ligne au 641, comme avant.
    expect(ecrituresConstatationPaie(b, gardien, ctx).filter((l) => l.compte === 'M001.64100.00000.0')).toHaveLength(1)
  })

  it('éléments exclus contrôlés : nature connue, centimes entiers, jamais plus que le brut', () => {
    expect(ELEMENTS_NON_RECUPERABLES).toEqual(['indemnite_licenciement', 'depart_retraite', 'interessement_participation'])
    expect(codes(controlerBulletin(bulletin({ elementsNonRecuperablesCentimes: { prime: 100 } as never })))).toContain('nature_inconnue')
    expect(codes(controlerBulletin(bulletin({ elementsNonRecuperablesCentimes: { depart_retraite: -1 } })))).toContain('montant_invalide')
    const trop = controlerBulletin(bulletin({ elementsNonRecuperablesCentimes: { interessement_participation: 300_000 } }))
    expect(trop).toMatchObject([{ code: 'montant_invalide' }])
    expect(trop[0].message).toMatch(/plus que le brut/)
  })
})

describe('règlement de la paie : catégorie distincte du règlement fournisseur', () => {
  const contexte = { salarie: gardien, bulletin: constatation.bulletin, contexte: CTX, traitements: [constatation.traitement], reglements: [] }

  it('natures fermées : salaire net, cotisations, prélèvement à la source, taxe sur les salaires, acompte et saisie (F42)', () => {
    expect(NATURES_REGLEMENT_PAIE).toEqual([
      'salaire_net',
      'cotisations_securite_sociale',
      'cotisations_autres_organismes',
      'prelevement_source',
      'taxe_salaires',
      'acompte_salaire',
      'saisie_salaire',
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

  it('J25 et J40 : salaire en espèces refusé (décision du cabinet, compte 53 non tenu), même sous le seuil de C. trav. L3241-1', () => {
    // Seule la paie est contrôlée ici ; les fournisseurs relèvent de reglements-fournisseurs.ts (J25 aussi).
    const [especes] = controlerReglementPaie(reglement({ mode: 'Espèces' }), contexte)
    expect(especes.code).toBe('especes')
    expect(especes.fondement).toBeNull()
    expect(especes.message).toMatch(/décision J25/)
    expect(especes.message).toMatch(/compte 53/)
    expect(especes.message).not.toMatch(/à trancher/)
    // J40 (06/11/2026) : refus maintenu sous le seuil de L3241-1, même à la demande du salarié ; choix plus strict que la loi.
    expect(especes.message).toMatch(/C\. trav\. L3241-1/)
    expect(especes.message).toMatch(/au salarié qui le demande/)
    expect(especes.message).toMatch(/décision J40/)
    expect(especes.message).toMatch(/plus strict que la loi/)
    expect(especes.message).not.toMatch(/reste ouvert/)
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

describe('Décision du 20/11/2026 (partie C, F39) — écritures de paie confirmées', () => {
  it('brut au débit du 641 ; net au crédit du 421 ; cotisations au crédit du 431 / 432 ; part patronale au débit du 642 (644 : mutuelle) ; prélèvement à la source au crédit du 442 ; taxe 643 / 442', () => {
    const avecMutuelle = bulletin({
      cotisations: [
        { organisme: 'securite_sociale', salarialeCentimes: 30_000, patronaleCentimes: 60_000 },
        { organisme: 'autre_organisme', salarialeCentimes: 11_000, patronaleCentimes: 16_000 },
        { organisme: 'autre_organisme', auxiliaire: '00009', comptePatronal: 'autresFrais', salarialeCentimes: 3_000, patronaleCentimes: 4_000 },
      ],
    })
    const lignes = ecrituresConstatationPaie(avecMutuelle, gardien, CTX)
    const sur = (prefixe: string) => lignes.filter((l) => l.compte.startsWith(`M001.${prefixe}`)).map((l) => [l.sens, l.montantCentimes])
    expect(sur('641')).toEqual([['debit', 200_000]])
    expect(sur('421')).toEqual([['credit', 150_000]])
    expect(sur('431')).toEqual([['credit', 90_000]])
    expect(sur('432')).toEqual([
      ['credit', 27_000],
      ['credit', 7_000],
    ])
    expect(sur('642')).toEqual([['debit', 76_000]])
    expect(sur('644')).toEqual([['debit', 4_000]])
    expect(sur('442')).toEqual([['credit', 6_000]])
    expect(ecrituresTaxeSalaires(10_000, CTX).map((l) => [l.compte, l.sens])).toEqual([
      ['M001.64300.00000.0', 'debit'],
      ['M001.44200.00000.0', 'credit'],
    ])
  })
})

describe('Décision du 20/11/2026 (partie C, F41) — avantage en nature neutralisé par défaut', () => {
  /** Logement du gardien : avantage de 300 € compris dans le brut de 2 000 € ; net 1 200 €. */
  const avecLogement = bulletin({ avantagesEnNatureCentimes: 30_000, netAPayerCentimes: 120_000 })
  const attributs = { analytique: '010', rubrique: '010', recupLocatairePct: 75 }

  it('deux méthodes : neutralisée (par défaut) ou compte fourni par le cabinet', () => {
    expect(METHODES_AVANTAGES_EN_NATURE).toEqual(['neutralise', 'compte_cabinet'])
  })

  it('par défaut : 641 au brut diminué de l’avantage, aucun compte crédité, cotisations du brut entier inchangées ; plus de blocage', () => {
    const lignes = ecrituresConstatationPaie(avecLogement, gardien, CTX)
    expect(lignes).toEqual([
      { compte: 'M001.64100.00000.0', sens: 'debit', montantCentimes: 170_000 },
      { compte: 'M001.64200.00000.0', sens: 'debit', montantCentimes: 80_000 },
      { compte: 'M001.42100.00001.0', sens: 'credit', montantCentimes: 120_000 },
      { compte: 'M001.43100.00000.0', sens: 'credit', montantCentimes: 90_000 },
      { compte: 'M001.43200.00000.0', sens: 'credit', montantCentimes: 34_000 },
      { compte: 'M001.44200.00000.0', sens: 'credit', montantCentimes: 6_000 },
    ])
    expect(total(lignes, 'debit')).toBe(250_000)
    expect(total(lignes, 'credit')).toBe(250_000)
    expect(ecrituresConstatationPaie(avecLogement, gardien, { ...CTX, methodeAvantagesEnNature: 'neutralise' })).toEqual(lignes)
    // Le montant reste sur le bulletin, pour information.
    expect(traitementConstatationPaie({ id: 'tr-logement', date: '2026-09-30' }, avecLogement, gardien, CTX).bulletin.avantagesEnNatureCentimes).toBe(30_000)
  })

  it('neutralisé, avec une analytique : l’avantage reste hors du 641 ; seuls les éléments exclus passent sur la seconde ligne à 0 % (J67, R38)', () => {
    expect(ecrituresConstatationPaie(avecLogement, gardien, { ...CTX, attributs: { salaires: attributs } }).filter((l) => l.compte === 'M001.64100.00000.0')).toEqual([
      { compte: 'M001.64100.00000.0', sens: 'debit', montantCentimes: 170_000, attributs },
    ])
    const b = bulletin({ brutCentimes: 260_000, avantagesEnNatureCentimes: 30_000, elementsNonRecuperablesCentimes: { indemnite_licenciement: 30_000 }, netAPayerCentimes: 180_000 })
    const lignes = ecrituresConstatationPaie(b, gardien, { ...CTX, attributs: { salaires: attributs } })
    expect(lignes.filter((l) => l.compte === 'M001.64100.00000.0')).toEqual([
      { compte: 'M001.64100.00000.0', sens: 'debit', montantCentimes: 200_000, attributs },
      { compte: 'M001.64100.00000.0', sens: 'debit', montantCentimes: 30_000, attributs: { ...attributs, recupLocatairePct: 0 } },
    ])
    expect(total(lignes, 'debit')).toBe(total(lignes, 'credit'))
  })

  it('méthode incohérente (compte fourni, avantage neutralisé) ou inconnue : refusée', () => {
    expect(() => ecrituresConstatationPaie(avecLogement, gardien, { ...CTX, compteAvantagesEnNature: 'A0001' })).toThrow(
      /neutralisés .*aucun compte crédité/,
    )
    expect(() => ecrituresConstatationPaie(avecLogement, gardien, { ...CTX, methodeAvantagesEnNature: 'produit' as never })).toThrow(
      /Méthode des avantages en nature « produit »/,
    )
  })
})

describe('Décision du 20/11/2026 (partie C, F42) — autres lignes du bulletin', () => {
  const CTX_F42: ContextePaie = { ...CTX, compteAcomptes: '42110', compteSaisiesSalaire: '46200' }
  /** Brut 2 000 €, salariales 440 €, PAS 60 € ; acompte 300 €, avance 200 €, saisie 100 € (bénéficiaire 00007), frais 30 €, indemnité non soumise 200 € : net 1 130 €. */
  const complet = bulletin({
    lignesComplementaires: [
      { nature: 'acompte', montantCentimes: 30_000 },
      { nature: 'avance', montantCentimes: 20_000 },
      { nature: 'saisie_salaire', montantCentimes: 10_000, beneficiaire: '00007' },
      { nature: 'frais_rembourses', montantCentimes: 3_000 },
      { nature: 'indemnite_non_soumise', montantCentimes: 20_000 },
    ],
    netAPayerCentimes: 113_000,
  })
  const seule = (ligneBulletin: LigneBulletin) => bulletin({ lignesComplementaires: [ligneBulletin] })

  it('natures fermées : acompte, avance, saisie sur salaire, frais remboursés, indemnité non soumise', () => {
    expect(NATURES_LIGNE_BULLETIN).toEqual(['acompte', 'avance', 'saisie_salaire', 'frais_rembourses', 'indemnite_non_soumise'])
  })

  it('contrôle du net : brut − cotisations salariales − avantages en nature − PAS − acomptes − autres retenues + versements non soumis', () => {
    expect(controlerBulletin(complet)).toEqual([])
    const [incoherent, ...autres] = controlerBulletin({ ...complet, netAPayerCentimes: 150_000 })
    expect(autres).toEqual([])
    expect(incoherent.code).toBe('net_incoherent')
    expect(incoherent.message).toBe(
      'Bulletin bul-2026-09 : net à payer de 150000 centimes pour 113000 centimes attendus (net = brut − cotisations salariales − avantages en nature − prélèvement à la source − acomptes − autres retenues + versements non soumis).',
    )
  })

  it('lignes contrôlées : nature connue, centimes entiers, bénéficiaire exigé pour une saisie et pour elle seule', () => {
    expect(codes(controlerBulletin(seule({ nature: 'prime' as never, montantCentimes: 0 })))).toEqual(['nature_inconnue'])
    expect(codes(controlerBulletin(seule({ nature: 'acompte', montantCentimes: -1 })))).toContain('montant_invalide')
    expect(codes(controlerBulletin(seule({ nature: 'acompte', montantCentimes: 0.5 })))).toContain('montant_invalide')
    expect(codes(controlerBulletin(seule({ nature: 'saisie_salaire', montantCentimes: 0 })))).toEqual(['auxiliaire_invalide'])
    expect(codes(controlerBulletin(seule({ nature: 'saisie_salaire', montantCentimes: 0, beneficiaire: '7' })))).toEqual(['auxiliaire_invalide'])
    expect(codes(controlerBulletin(seule({ nature: 'frais_rembourses', montantCentimes: 0, beneficiaire: '00007' })))).toEqual(['auxiliaire_invalide'])
  })

  it('écriture : acompte et avance repris au crédit du sous-compte « acomptes » du 421 du salarié, saisie au crédit du 462 du bénéficiaire, frais au débit du 644, indemnité au débit du 641 ; équilibrée', () => {
    const lignes = ecrituresConstatationPaie(complet, gardien, CTX_F42)
    expect(lignes).toEqual([
      { compte: 'M001.64100.00000.0', sens: 'debit', montantCentimes: 220_000 },
      { compte: 'M001.64200.00000.0', sens: 'debit', montantCentimes: 80_000 },
      { compte: 'M001.64400.00000.0', sens: 'debit', montantCentimes: 3_000 },
      { compte: 'M001.42100.00001.0', sens: 'credit', montantCentimes: 113_000 },
      { compte: 'M001.42110.00001.0', sens: 'credit', montantCentimes: 50_000 },
      { compte: 'M001.46200.00007.0', sens: 'credit', montantCentimes: 10_000 },
      { compte: 'M001.43100.00000.0', sens: 'credit', montantCentimes: 90_000 },
      { compte: 'M001.43200.00000.0', sens: 'credit', montantCentimes: 34_000 },
      { compte: 'M001.44200.00000.0', sens: 'credit', montantCentimes: 6_000 },
    ])
    expect(total(lignes, 'debit')).toBe(303_000)
    expect(total(lignes, 'credit')).toBe(303_000)
  })

  it('indemnité non soumise marquée non récupérable ; frais remboursés au 644, compte jamais récupérable (J67, R39)', () => {
    const avecAnalytiques = { salaires: { analytique: '010', recupLocatairePct: 75 }, autresFrais: { analytique: '012', recupLocatairePct: 75 } }
    const lignes = ecrituresConstatationPaie(complet, gardien, { ...CTX_F42, attributs: avecAnalytiques })
    expect(lignes.filter((l) => l.compte === 'M001.64100.00000.0')).toEqual([
      { compte: 'M001.64100.00000.0', sens: 'debit', montantCentimes: 200_000, attributs: { analytique: '010', recupLocatairePct: 75 } },
      { compte: 'M001.64100.00000.0', sens: 'debit', montantCentimes: 20_000, attributs: { analytique: '010', recupLocatairePct: 0 } },
    ])
    expect(lignes.find((l) => l.compte === 'M001.64400.00000.0')).toEqual({
      compte: 'M001.64400.00000.0',
      sens: 'debit',
      montantCentimes: 3_000,
      attributs: { analytique: '012', recupLocatairePct: 0 },
    })
  })

  it('codes du sous-compte « acomptes » du 421 et du 462 : fournis par le cabinet, sans défaut, subdivisions de leur compte', () => {
    expect(() => ecrituresConstatationPaie(complet, gardien, { ...CTX_F42, compteAcomptes: null })).toThrow(/Sous-compte « acomptes » du 421 : .*à fournir par le cabinet/)
    expect(() => ecrituresConstatationPaie(complet, gardien, { ...CTX_F42, compteAcomptes: '40100' })).toThrow(/subdivision du 421/)
    expect(() => ecrituresConstatationPaie(complet, gardien, { ...CTX_F42, compteSaisiesSalaire: undefined })).toThrow(/462 « Créditeurs divers »/)
    expect(() => ecrituresConstatationPaie(complet, gardien, { ...CTX_F42, compteSaisiesSalaire: '46100' })).toThrow(/subdivision du 462/)
    // Sans acompte ni saisie, aucun de ces codes n'est exigé.
    const fraisSeuls = bulletin({ lignesComplementaires: [{ nature: 'frais_rembourses', montantCentimes: 3_000 }], netAPayerCentimes: 153_000 })
    expect(ecrituresConstatationPaie(fraisSeuls, gardien, CTX)).toContainEqual({
      compte: 'M001.64400.00000.0',
      sens: 'debit',
      montantCentimes: 3_000,
    })
  })

  it('acompte ou avance versé avant la paie : débit du sous-compte « acomptes » du 421 du salarié / crédit de la banque, sans borne de solde ; repris à la paie, le sous-compte est soldé', () => {
    const acompte = reglement({ id: 'reg-acompte', nature: 'acompte_salaire', bulletinId: null, montantCentimes: 50_000, le: '2026-09-15', reference: 'VIR-0915' })
    const contexte = { salarie: gardien, bulletin: null, contexte: CTX_F42, traitements: [], reglements: [] }
    expect(controlerReglementPaie(acompte, contexte)).toEqual([])
    expect(ecrituresReglementPaie(acompte, gardien, CTX_F42)).toEqual([
      { compte: 'M001.42110.00001.0', sens: 'debit', montantCentimes: 50_000 },
      { compte: 'M001.51200.00000.0', sens: 'credit', montantCentimes: 50_000 },
    ])
    const ecrit = traitementReglementPaie('tr-acompte', acompte, contexte)
    expect(ecrit.libelle).toBe('Acompte ou avance sur salaire : règlement réf. VIR-0915 du 15/09/2026')
    const paie = traitementConstatationPaie({ id: 'tr-paie-f42', date: '2026-09-30' }, complet, gardien, CTX_F42)
    expect(balance([ecrit.traitement, paie.traitement], { compteDu: 'M001.42110.00001.0', compteAu: 'M001.42110.00001.0' }).lignes).toMatchObject([
      { soldeCrediteurCentimes: 0, soldeDebiteurCentimes: 0 },
    ])
    expect(codes(controlerReglementPaie({ ...acompte, salarieId: null }, { ...contexte, salarie: null }))).toEqual(['salarie_requis'])
    expect(codes(controlerReglementPaie({ ...acompte, mode: 'Espèces' }, contexte))).toEqual(['especes'])
    expect(() => controlerReglementPaie(acompte, { ...contexte, contexte: CTX })).toThrow(/Sous-compte « acomptes » du 421/)
  })

  it('saisie sur salaire réglée au bénéficiaire : débit de son sous-compte du 462 / crédit de la banque, borné au solde créditeur après la paie', () => {
    const paie = traitementConstatationPaie({ id: 'tr-paie-f42', date: '2026-09-30' }, complet, gardien, CTX_F42)
    const sansBeneficiaire = reglement({
      id: 'reg-saisie',
      nature: 'saisie_salaire',
      salarieId: null,
      bulletinId: null,
      montantCentimes: 10_000,
      le: '2026-10-05',
      reference: 'VIR-1005',
    })
    const saisie = { ...sansBeneficiaire, auxiliaire: '00007' }
    const contexte = { salarie: null, bulletin: null, contexte: CTX_F42, traitements: [paie.traitement], reglements: [] }
    expect(controlerReglementPaie(saisie, contexte)).toEqual([])
    expect(ecrituresReglementPaie(saisie, null, CTX_F42)).toEqual([
      { compte: 'M001.46200.00007.0', sens: 'debit', montantCentimes: 10_000 },
      { compte: 'M001.51200.00000.0', sens: 'credit', montantCentimes: 10_000 },
    ])
    expect(codes(controlerReglementPaie({ ...saisie, montantCentimes: 10_001 }, contexte))).toEqual(['reglement_superieur_au_du'])
    expect(codes(controlerReglementPaie({ ...saisie, le: '2026-09-29' }, contexte))).toEqual(['reglement_superieur_au_du'])
    expect(codes(controlerReglementPaie(sansBeneficiaire, contexte))).toEqual(['auxiliaire_invalide'])
    expect(() => ecrituresReglementPaie(sansBeneficiaire, null, CTX_F42)).toThrow(/bénéficiaire/)
    expect(codes(controlerReglementPaie({ ...saisie, salarieId: 'sal-1' }, contexte))).toEqual(['salarie_inattendu'])
  })
})

describe('Décision du 20/11/2026 (partie C, F43) — bulletin d’un mois postérieur à la sortie', () => {
  const sorti = creerSalarieSyndicat({ ...gardien, sortieLe: '2026-06-30' })

  it('accepté, avec une alerte non bloquante au libellé décidé ; pas limité au mois du paiement', () => {
    const alertes = controlerBulletinSalarie(bulletin(), sorti)
    expect(alertes).toEqual([
      {
        code: 'bulletin_apres_sortie',
        message:
          "Bulletin d'un mois postérieur à la sortie : rappel de salaire ou régularisation ? Vérifier la DSN et le signalement de fin de contrat (bulletin bul-2026-09 de 09/2026, sortie du salarié sal-1 le 30/06/2026).",
        fondement: null,
      },
    ])
    expect(MESSAGE_BULLETIN_APRES_SORTIE).toBe(
      "Bulletin d'un mois postérieur à la sortie : rappel de salaire ou régularisation ? Vérifier la DSN et le signalement de fin de contrat",
    )
    expect(anomaliesBloquantesPaie(alertes)).toEqual([])
    expect(ecrituresConstatationPaie(bulletin(), sorti, CTX)).toEqual(ecrituresConstatationPaie(bulletin(), gardien, CTX))
    // Un an après la sortie (rappel après un litige) : toujours admis, toujours signalé.
    expect(codes(controlerBulletinSalarie(bulletin({ annee: 2027, mois: 9 }), sorti))).toEqual(['bulletin_apres_sortie'])
  })

  it('mois de la sortie : aucune alerte ; mois commencé au plus tôt le jour de la sortie : alerte', () => {
    expect(controlerBulletinSalarie(bulletin({ mois: 6 }), sorti)).toEqual([])
    const sortiLe0107 = creerSalarieSyndicat({ ...gardien, sortieLe: '2026-07-01' })
    expect(controlerBulletinSalarie(bulletin({ mois: 6 }), sortiLe0107)).toEqual([])
    expect(codes(controlerBulletinSalarie(bulletin({ mois: 7 }), sortiLe0107))).toEqual(['bulletin_apres_sortie'])
  })

  it('le net se règle malgré l’alerte ; le refus d’un mois fini avant l’entrée est gardé, et bloquant', () => {
    const constate = traitementConstatationPaie({ id: 'tr-paie-sorti', date: '2026-09-30' }, bulletin(), sorti, CTX)
    const contexte = { salarie: sorti, bulletin: constate.bulletin, contexte: CTX, traitements: [constate.traitement], reglements: [] }
    expect(controlerReglementPaie(reglement(), contexte)).toEqual([])
    const avantEntree = controlerBulletinSalarie(bulletin({ annee: 2020, mois: 1 }), sorti)
    expect(codes(avantEntree)).toEqual(['bulletin_avant_entree'])
    expect(anomaliesBloquantesPaie(avantEntree)).toEqual(avantEntree)
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
  const decisions = entete.slice(entete.indexOf('Décisions du 03/11/2026'), entete.indexOf('🔵 Déduit'))

  it('🟢 art. 10 : aucune règle de fonctionnement pour les 42, 43, 442 et 64 (il en donne une pour les 441 et 443)', () => {
    expect(entete).toMatch(/comptes 42, 43, 442 et 64/)
    expect(entete).not.toMatch(/42, 43, 44 et 64/)
  })

  it('🟢 tranche 18 : la famille « Employeur » est un échantillon, pas une liste de 7 types', () => {
    expect(entete).toMatch(/7 types relevés \(échantillon non exhaustif/)
    expect(entete).not.toMatch(/« Employeur » \(7 types\)/)
  })

  it('J25 : espèces tranchées (décision du référent métier), l’ancienne question 7 retirée du 🔴 ; prévoyance : seul le relevé Gestéam reste en 🔴', () => {
    expect(decisions).toMatch(/J25/)
    expect(decisions).toMatch(/espèces/)
    expect(decisions).toMatch(/compte 53/)
    expect(decisions).toMatch(/L7211-3, 6°/)
    expect(deduit).not.toMatch(/espèces refusées/)
    expect(nonEtabli).not.toMatch(/Faut-il admettre les espèces pour un salaire/)
    expect(nonEtabli).toMatch(/sous quel code est l'entrée « prévoyance » des 64xxx/)
  })

  it('J67, R38 et R39 : part récupérable et compte de la prévoyance tranchés, les questions 6 et 8 retirées du 🔴', () => {
    const j67 = entete.slice(entete.indexOf('Décisions du 17/11/2026'), entete.indexOf('🔵 Déduit'))
    expect(j67).toMatch(/J67, R38 : .*décret n° 87-713, art\. 2/)
    expect(j67).toMatch(/J67, R39 : .*642 par défaut, réglable cotisation par cotisation/)
    expect(j67).toMatch(/la mutuelle va au 644/)
    expect(nonEtabli).not.toMatch(/Récupérabilité des salaires du gardien/)
    expect(nonEtabli).not.toMatch(/Part patronale de la prévoyance : 642/)
    expect(source).not.toMatch(/🔴 8/)
  })

  it('J67, R38 : liste complète des éléments jamais récupérables ; points restés ouverts marqués en 🔴 ; tout le 644 à 0 % en 🔵', () => {
    const j67 = entete.slice(entete.indexOf('Décisions du 17/11/2026'), entete.indexOf('🔵 Déduit'))
    expect(j67).toMatch(/la participation au comité d'entreprise et à l'effort de construction, la cotisation à la médecine du travail/)
    expect(nonEtabli).toMatch(/11\. Référent métier \(J67, R38, points restés ouverts\) : la participation au comité d'entreprise et à l'effort de construction/)
    expect(nonEtabli).toMatch(/logements sociaux n'a pas été lu/)
    expect(deduit).toMatch(/tout le 644 est tenu pour jamais récupérable, par son compte/)
  })

  it('J25 : C. trav. L3241-1 relu (version, phrase exacte)', () => {
    expect(entete).not.toMatch(/L3241-1 non lu/)
    expect(decisions).not.toMatch(/aucun texte lu ne l'impose/)
    expect(decisions).toMatch(/En vigueur au 03\/11\/2026/)
    expect(decisions).toMatch(/en vigueur depuis le 27\/12\/2022/)
    expect(decisions).toMatch(/loi n° 2021-1774 du 24 décembre 2021, art\. 1/)
    expect(decisions).toMatch(/« En dessous d'un montant mensuel déterminé par décret, le salaire est payé en espèces au salarié qui le demande\. »/)
    expect(decisions).toMatch(
      /« Au-delà d'un montant mensuel déterminé par décret, le salaire est payé par chèque barré ou par virement à un compte bancaire ou postal dont le salarié est le titulaire ou le cotitulaire\. »/,
    )
  })

  it('J40 (décision du 06/11/2026) : aucun salaire en espèces, même sous le seuil ; le 🔴 10 devient une décision, le risque est dit', () => {
    const decisions0611 = entete.slice(entete.indexOf('Décisions du 06/11/2026'), entete.indexOf('🔵 Déduit'))
    expect(decisions0611).toMatch(/J40 : aucun paiement en espèces, même pour un salarié payé sous le seuil de C\. trav\. L3241-1 qui le demande/)
    expect(decisions0611).toMatch(/choix du cabinet, plus strict que la loi/)
    expect(decisions0611).toMatch(/Risque : C\. trav\. L3241-1 donne ce droit au salarié qui le demande, sous le montant mensuel fixé par décret/)
    expect(decisions).not.toMatch(/question ouverte \(🔴 10\)/)
    expect(nonEtabli).not.toMatch(/J25 vaut-il contre la demande d'un salarié payé sous ce seuil/)
    expect(nonEtabli).not.toMatch(/^10\.| 10\. /)
    expect(source).not.toMatch(/🔴 10/)
  })

  it('J25 : la remise d’espèces reçues est tranchée à part (J29 du registre), hors de ce module', () => {
    expect(decisions).not.toMatch(/reste à trancher/)
    expect(decisions).toMatch(/J29/)
    expect(decisions).toMatch(/types-ordres-banque\.ts/)
    // reglements-fournisseurs.ts applique aussi J25.
    expect(decisions).toMatch(/reglements-fournisseurs\.ts applique aussi J25/)
    expect(decisions).not.toMatch(/à aligner sur J25/)
  })

  it('sources Gestéam, droit relu et marqueurs', () => {
    expect(entete).toMatch(/tranche 43 § 10/)
    expect(entete).toMatch(/§ 19/)
    expect(entete).toMatch(/Légifrance le 30\/10\/2026/)
    expect(entete).toMatch(/arrêté du 14 mars 2005/)
    for (const marqueur of ['🟢', '🔵', '🔴']) expect(entete).toContain(marqueur)
  })

  it('🔴 questions exactes : reclassement des 401 « salarié », famille « Paie »', () => {
    expect(nonEtabli).toMatch(/reclasser les soldes 401 « salarié » en 421/)
    expect(nonEtabli).toMatch(/famille « Paie »/)
  })

  it('décisions du 20/11/2026 (partie C, F39, F41, F42, F43) : citées, les questions 🔴 n° 1 (seconde partie), 4, 5 et 9 retirées', () => {
    const bloc = entete.slice(entete.indexOf('Décisions du responsable du projet du 20/11/2026'), entete.indexOf('🔵 Déduit'))
    for (const point of ['F39', 'F41', 'F42', 'F43']) expect(bloc).toContain(`Décision du 20/11/2026 (partie C, ${point})`)
    expect(bloc).toMatch(/F39\) : écritures de paie confirmées : brut au débit du 641 ; net à payer au crédit du 421/)
    expect(bloc).toMatch(/F41\) : .*aucun compte crédité pour l'avantage/)
    expect(bloc).toMatch(/714 « Produits divers »/)
    expect(bloc).toMatch(/F42\) : .*sous-compte « acomptes » du 421 du salarié/)
    expect(bloc).toMatch(/462 « Créditeurs divers »/)
    expect(bloc).toMatch(/net = brut − cotisations salariales − avantages en nature − prélèvement à la source − acomptes − autres retenues \+ versements non soumis/)
    expect(bloc).toMatch(/F43\) : .*alerte non bloquante/)
    expect(nonEtabli).not.toMatch(/les confirmez-vous/)
    expect(nonEtabli).not.toMatch(/Avantage en nature compris dans le brut/)
    expect(nonEtabli).not.toMatch(/Autres éléments du bulletin/)
    expect(nonEtabli).not.toMatch(/admis sans alerte/)
    expect(nonEtabli).toMatch(/les n° 4, 5 et 9, et la seconde question du n° 1 : décisions du 20\/11\/2026/)
    expect(nonEtabli).toMatch(/sous-compte « acomptes » du 421/)
    for (const marque of ['🔴 4', '🔴 9']) expect(source).not.toContain(marque)
  })

  it('F39 : la marque 🔵 des écritures de paie reste jusqu’à la validation du comptable du cabinet', () => {
    expect(deduit).toMatch(/confirmé par la décision du 20\/11\/2026 \(partie C, F39\), marque à retirer après la validation du comptable du cabinet/)
    expect(source).not.toMatch(/🔵 contreparties déduites\)/)
  })

  it('aucune date ISO dans la source', () => {
    expect(source).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })
})
