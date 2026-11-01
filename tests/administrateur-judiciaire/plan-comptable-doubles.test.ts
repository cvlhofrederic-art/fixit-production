import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { PlanComptable } from '@/lib/administrateur-judiciaire/domain/plan-comptable'
import {
  clePlanComptable,
  importerPlanComptable,
  libelleSansSuffixeDouble,
  resoudreEntreePlan,
} from '@/lib/administrateur-judiciaire/domain/plan-comptable-doubles'
import { DOMAINE, REFERENTIELS_TRACABILITE } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Point 29 du bilan des écarts Gestéam → VitFix : clé d'une entrée de plan (source, code, sous-compte, type), fusion des
 * doubles « _ » identiques à l'import et signalement des autres ; feuilles DOMAINE manquantes (tranche 43 § 20 et § 21).
 * Libellés génériques du plan type uniquement : aucun libellé propre à un dossier, aucune donnée personnelle.
 */

const entreePlan = (surcharge: Partial<PlanComptable>): PlanComptable => ({
  id: 'pc-1',
  code: '45000',
  libelle: 'COPROPRIETAIRES',
  source: 'Copropriété',
  horsService: false,
  type: 'Copropriétaire',
  nature: 'Copropriétaire',
  lien: 'COPRO',
  categorie: 'Copropriétaire',
  analytique: 'libre',
  regleNumeroCompte: 'Série',
  regleSousCompte: 'Libre',
  pointe: 'inclu',
  libelleCompteIdentiquePlan: true,
  lettrageActif: true,
  ajoutManuelActif: false,
  parDefautSiNouveauMandat: false,
  ...surcharge,
})

/** Les deux 47150 de la tranche 43 § 21 : même code, types, pointage et proposition par défaut différents. */
const attenteOrdinaire = entreePlan({
  id: 'pc-47150-a',
  code: '47150',
  libelle: "Compte d'attente_",
  type: "Compte d'attente",
  nature: "Compte d'attente",
  lien: undefined,
  categorie: undefined,
  regleNumeroCompte: 'A zéro',
  regleSousCompte: 'A zéro',
  pointe: 'inclu',
  parDefautSiNouveauMandat: true,
})
const attenteBascule = entreePlan({
  ...attenteOrdinaire,
  id: 'pc-47150-b',
  libelle: "COMPTE D'ATTENTE DE TRESORERIE",
  type: 'Bascule gérance copropriété',
  pointe: 'exclu',
  parDefautSiNouveauMandat: false,
})

/** 71147 : même paramétrage, le second libellé est celui d'une opération (neutralisé ici). */
const subvention = entreePlan({
  id: 'pc-71147-a',
  code: '71147',
  libelle: 'Travaux - Subventions_',
  type: 'Travaux - Subventions, autres produits',
  nature: 'Travaux - Subventions',
  lien: 'TRVX',
  categorie: 'Travaux',
  typeSru: 'Travaux - Subventions, autres produits',
  analytique: 'imposee',
  regleNumeroCompte: 'No des travaux',
  regleSousCompte: 'A zéro',
})
const subventionOperation = { ...subvention, id: 'pc-71147-b', libelle: '(SUBVENTIONS OPERATION A)' }

describe('Point 29 — clé d’une entrée de plan', () => {
  it('47150 avec deux types donne deux clés ; même source, code et type donnent la même clé', () => {
    expect(clePlanComptable(attenteOrdinaire)).not.toBe(clePlanComptable(attenteBascule))
    expect(clePlanComptable(entreePlan({ id: 'x' }))).toBe(clePlanComptable(entreePlan({ id: 'y', libelle: 'COPROPRIETAIRES_' })))
  })

  it('une autre source ou un autre sous-compte donne une autre clé', () => {
    const base = entreePlan({})
    expect(clePlanComptable({ ...base, source: 'Commune' })).not.toBe(clePlanComptable(base))
    expect(clePlanComptable({ ...base, sousCompte: '00101' })).not.toBe(clePlanComptable(base))
    expect(clePlanComptable({ ...base, sousCompte: '00101' })).not.toBe(clePlanComptable({ ...base, sousCompte: '00102' }))
  })

  it('un type ou un sous-compte vide ou blanc vaut absence ; les espaces de bord ne changent pas la clé', () => {
    const sansType = entreePlan({ type: undefined })
    expect(clePlanComptable({ ...sansType, type: '' })).toBe(clePlanComptable(sansType))
    expect(clePlanComptable({ ...sansType, type: '   ' })).toBe(clePlanComptable(sansType))
    expect(clePlanComptable({ ...sansType, sousCompte: ' ' })).toBe(clePlanComptable(sansType))
    expect(clePlanComptable(entreePlan({ type: ' Copropriétaire ' }))).toBe(clePlanComptable(entreePlan({})))
    expect(clePlanComptable(sansType)).not.toBe(clePlanComptable(entreePlan({})))
  })

  it('🔴 lecture provisoire : le sous-compte « 00000 » est un sous-compte ordinaire, distinct de l’absence de sous-compte', () => {
    const generique = entreePlan({ id: 'pc-a', code: '40100', libelle: 'Fournisseurs', type: 'Fournisseur' })
    const zero = { ...generique, id: 'pc-b', sousCompte: '00000' }
    expect(clePlanComptable(zero)).not.toBe(clePlanComptable(generique))
    expect(importerPlanComptable([generique, zero])).toMatchObject({ entrees: [generique, zero], signalements: [], enAttente: [] })
  })
})

describe('Point 29 — libellé sans le suffixe « _ » des doubles', () => {
  it('retire les « _ » finaux (et les espaces), garde le reste du libellé', () => {
    expect(libelleSansSuffixeDouble('COPROPRIETAIRES_')).toBe('COPROPRIETAIRES')
    expect(libelleSansSuffixeDouble('Banque__ ')).toBe('Banque')
    expect(libelleSansSuffixeDouble('Classe 7 _')).toBe('Classe 7')
    expect(libelleSansSuffixeDouble('FONDS_TRAVAUX')).toBe('FONDS_TRAVAUX')
    expect(libelleSansSuffixeDouble('(SUBVENTIONS OPERATION A)')).toBe('(SUBVENTIONS OPERATION A)')
    expect(libelleSansSuffixeDouble('___')).toBe('')
  })
})

describe('Point 29 — import du plan : fusion des doubles « _ » identiques', () => {
  it('une entrée seule sur sa clé est conservée telle quelle, dans l’ordre de l’import', () => {
    const banque = entreePlan({ id: 'pc-512', code: '51200', libelle: 'Banque', type: 'Banque', nature: 'Banque' })
    const caisse = entreePlan({ id: 'pc-530', code: '53000', libelle: 'CAISSE', type: 'Caisse', nature: 'Caisse' })
    const resultat = importerPlanComptable([banque, caisse])
    expect(resultat.entrees).toEqual([banque, caisse])
    expect(resultat.entrees[0]).toBe(banque)
    expect(resultat).toMatchObject({ fusions: [], remplacements: {}, signalements: [], enAttente: [] })
  })

  it('45000 « COPROPRIETAIRES » / « COPROPRIETAIRES_ » : une entrée conservée, celle sans « _ », même placée en second', () => {
    const double = entreePlan({ id: 'pc-45000-b', libelle: 'COPROPRIETAIRES_' })
    const principale = entreePlan({ id: 'pc-45000-a' })
    const resultat = importerPlanComptable([double, principale])
    expect(resultat.entrees).toEqual([principale])
    expect(resultat.fusions).toEqual([
      { cle: clePlanComptable(principale), code: '45000', conserveId: 'pc-45000-a', absorbesIds: ['pc-45000-b'] },
    ])
    expect(resultat.remplacements).toEqual({ 'pc-45000-b': 'pc-45000-a' })
    expect(resultat.signalements).toEqual([])
    expect(resultat.enAttente).toEqual([])
  })

  it.each([
    ['45900', 'COPROPRIETAIRE - CREANCES DOUTEUSES'],
    ['49200', 'PERSONNES AUTRES QUE LE COPROPRIETAIRE'],
    ['53000', 'CAISSE'],
  ])('%s : le double « _ » identique est fusionné', (code, libelle) => {
    const a = entreePlan({ id: `pc-${code}-a`, code, libelle, type: 'Classe 4', nature: 'Classe 4', regleNumeroCompte: 'Libre' })
    const b = { ...a, id: `pc-${code}-b`, libelle: `${libelle}_` }
    const resultat = importerPlanComptable([a, b])
    expect(resultat.entrees).toEqual([a])
    expect(resultat.remplacements).toEqual({ [b.id]: a.id })
  })

  it('deux doubles portant tous deux « _ » : la première occurrence est conservée', () => {
    const a = entreePlan({ id: 'pc-a', libelle: 'COPROPRIETAIRES_' })
    const b = entreePlan({ id: 'pc-b', libelle: 'COPROPRIETAIRES__' })
    expect(importerPlanComptable([a, b]).fusions[0]).toMatchObject({ conserveId: 'pc-a', absorbesIds: ['pc-b'] })
  })

  it('l’ordre d’affichage est ignoré ; les notes comptent', () => {
    const a = entreePlan({ id: 'pc-a', ordre: 1 })
    expect(importerPlanComptable([a, entreePlan({ id: 'pc-b', libelle: 'COPROPRIETAIRES_', ordre: 7 })]).fusions).toHaveLength(1)
    const resultat = importerPlanComptable([a, entreePlan({ id: 'pc-b', libelle: 'COPROPRIETAIRES_', notes: 'Reprise' })])
    expect(resultat.fusions).toEqual([])
    expect(resultat.signalements).toMatchObject([{ motif: 'parametrage_different', champsDifferents: ['notes'], bloquant: true }])
  })
})

describe('Point 29 — import du plan : signalements', () => {
  it('47150 : deux types distincts, deux entrées conservées, signalement non bloquant', () => {
    const resultat = importerPlanComptable([attenteOrdinaire, attenteBascule])
    expect(resultat.entrees).toEqual([attenteOrdinaire, attenteBascule])
    expect(resultat.fusions).toEqual([])
    expect(resultat.enAttente).toEqual([])
    expect(resultat.signalements).toHaveLength(1)
    const [signalement] = resultat.signalements
    expect(signalement).toMatchObject({
      motif: 'types_distincts',
      code: '47150',
      ids: ['pc-47150-a', 'pc-47150-b'],
      champsDifferents: ['libelle', 'parDefautSiNouveauMandat', 'pointe', 'type'],
      bloquant: false,
    })
    expect(signalement.message).toMatch(/numéro de compte/)
    expect(signalement.message).toMatch(/Bascule gérance copropriété/)
    expect(signalement.message).toContain('2 entrées de 2 types distincts')
    expect(signalement.message).toContain('toutes conservées')
  })

  it('types distincts et double non fusionnable d’un même type : le message compte entrées et types et ne dit pas « toutes conservées »', () => {
    const doubleDifferent = { ...attenteOrdinaire, id: 'pc-47150-c', libelle: "Compte d'attente", pointe: 'exclu' as const }
    const resultat = importerPlanComptable([attenteOrdinaire, doubleDifferent, attenteBascule])
    expect(resultat.entrees).toEqual([attenteBascule])
    expect(resultat.enAttente).toEqual([attenteOrdinaire, doubleDifferent])
    expect(resultat.signalements.map((s) => [s.motif, s.bloquant])).toEqual([
      ['types_distincts', false],
      ['parametrage_different', true],
    ])
    const [types] = resultat.signalements
    expect(types.ids).toEqual(['pc-47150-a', 'pc-47150-c', 'pc-47150-b'])
    expect(types.message).toContain('3 entrées de 2 types distincts')
    expect(types.message).not.toMatch(/toutes conservées/)
    expect(types.message).toContain('1 conservée, 0 absorbée par fusion, 2 en attente')
  })

  it('types distincts et double « _ » fusionnable d’un même type : le message compte l’entrée absorbée', () => {
    const doubleFusionnable = { ...attenteOrdinaire, id: 'pc-47150-c', libelle: "Compte d'attente" }
    const resultat = importerPlanComptable([attenteOrdinaire, doubleFusionnable, attenteBascule])
    expect(resultat.entrees).toEqual([doubleFusionnable, attenteBascule])
    expect(resultat.remplacements).toEqual({ 'pc-47150-a': 'pc-47150-c' })
    expect(resultat.signalements).toHaveLength(1)
    expect(resultat.signalements[0].message).toContain('3 entrées de 2 types distincts')
    expect(resultat.signalements[0].message).not.toMatch(/toutes conservées/)
    expect(resultat.signalements[0].message).toContain('2 conservées, 1 absorbée par fusion, 0 en attente')
  })

  it('71147 : seul le libellé diffère au-delà du « _ » → libelle_different, bloquant, entrées en attente', () => {
    const resultat = importerPlanComptable([subvention, subventionOperation])
    expect(resultat.entrees).toEqual([])
    expect(resultat.fusions).toEqual([])
    expect(resultat.enAttente).toEqual([subvention, subventionOperation])
    expect(resultat.signalements).toMatchObject([
      { motif: 'libelle_different', code: '71147', ids: ['pc-71147-a', 'pc-71147-b'], champsDifferents: ['libelle'], bloquant: true },
    ])
    expect(resultat.signalements[0].message).toContain('(SUBVENTIONS OPERATION A)')
  })

  it('paramétrage différent : la liste exacte des champs qui diffèrent, triée', () => {
    const a = entreePlan({ id: 'pc-a' })
    const b = entreePlan({ id: 'pc-b', libelle: 'COPROPRIETAIRES_', pointe: 'exclu', parDefautSiNouveauMandat: true })
    const c = entreePlan({ id: 'pc-c', regleNumeroCompte: 'Libre' })
    const resultat = importerPlanComptable([a, b, c])
    expect(resultat.entrees).toEqual([])
    expect(resultat.enAttente).toEqual([a, b, c])
    expect(resultat.signalements).toMatchObject([
      {
        motif: 'parametrage_different',
        code: '45000',
        ids: ['pc-a', 'pc-b', 'pc-c'],
        champsDifferents: ['parDefautSiNouveauMandat', 'pointe', 'regleNumeroCompte'],
        bloquant: true,
      },
    ])
  })

  it('un libellé et un paramètre différents : parametrage_different, le libellé figure dans la liste', () => {
    const resultat = importerPlanComptable([subvention, { ...subventionOperation, analytique: 'libre' }])
    expect(resultat.signalements).toMatchObject([{ motif: 'parametrage_different', champsDifferents: ['analytique', 'libelle'] }])
  })

  it('aucune fusion partielle : deux doubles identiques et un troisième différent → tout le groupe en attente', () => {
    const a = entreePlan({ id: 'pc-a' })
    const b = entreePlan({ id: 'pc-b', libelle: 'COPROPRIETAIRES_' })
    const c = entreePlan({ id: 'pc-c', pointe: 'exclu' })
    const resultat = importerPlanComptable([a, b, c])
    expect(resultat.fusions).toEqual([])
    expect(resultat.enAttente).toEqual([a, b, c])
    expect(resultat.signalements).toMatchObject([{ motif: 'parametrage_different', champsDifferents: ['pointe'] }])
  })

  it('type absent à côté d’une entrée typée (même code, même source, même sous-compte) : type_absent, bloquant, toutes ces entrées en attente', () => {
    const sansType = { ...attenteOrdinaire, id: 'pc-47150-c', type: undefined }
    const resultat = importerPlanComptable([attenteOrdinaire, attenteBascule, sansType])
    expect(resultat.entrees).toEqual([])
    expect(resultat.enAttente).toEqual([attenteOrdinaire, attenteBascule, sansType])
    expect(resultat.signalements).toHaveLength(1)
    expect(resultat.signalements[0]).toMatchObject({
      motif: 'type_absent',
      code: '47150',
      ids: ['pc-47150-a', 'pc-47150-b', 'pc-47150-c'],
      champsDifferents: ['libelle', 'parDefautSiNouveauMandat', 'pointe', 'type'],
      bloquant: true,
    })
    expect(resultat.signalements[0].message).toContain('toutes les entrées de ce code sans sous-compte (même source) sont mises en attente')
  })

  it('type_absent : champsDifferents donne les champs qui diffèrent vraiment, type compris', () => {
    const typee = entreePlan({ id: 'pc-a' })
    const identiqueHorsType = entreePlan({ id: 'pc-b', type: undefined, libelle: 'COPROPRIETAIRES_' })
    expect(importerPlanComptable([typee, identiqueHorsType]).signalements).toMatchObject([
      { motif: 'type_absent', champsDifferents: ['type'] },
    ])
    const autresNotes = entreePlan({ id: 'pc-c', type: undefined, notes: 'Reprise', pointe: 'exclu' })
    expect(importerPlanComptable([typee, autresNotes]).signalements).toMatchObject([
      { motif: 'type_absent', champsDifferents: ['notes', 'pointe', 'type'] },
    ])
  })

  it('type_absent sur un sous-compte : seules les entrées de ce sous-compte sont en attente, et le message le dit', () => {
    const fournisseur = entreePlan({ id: 'pc-a', code: '40100', libelle: 'Fournisseurs', type: 'Fournisseur', sousCompte: '00101' })
    const sansType = { ...fournisseur, id: 'pc-b', type: undefined }
    const autreSousCompte = { ...fournisseur, id: 'pc-c', sousCompte: '00102' }
    const resultat = importerPlanComptable([fournisseur, sansType, autreSousCompte])
    expect(resultat.entrees).toEqual([autreSousCompte])
    expect(resultat.enAttente).toEqual([fournisseur, sansType])
    expect(resultat.signalements).toHaveLength(1)
    const { message } = resultat.signalements[0]
    expect(message).toContain('Code 40100 (Copropriété), sous-compte 00101')
    expect(message).toContain('toutes les entrées de ce code et de ce sous-compte (même source) sont mises en attente')
    expect(message).not.toMatch(/toutes les entrées du code/)
  })

  it('deux entrées sans type, doubles « _ » identiques : fusionnées (le type absent est une valeur de clé)', () => {
    const a = entreePlan({ id: 'pc-a', type: undefined })
    const b = entreePlan({ id: 'pc-b', type: '', libelle: 'COPROPRIETAIRES_' })
    const resultat = importerPlanComptable([a, b])
    expect(resultat.entrees).toEqual([a])
    expect(resultat.signalements).toEqual([])
  })
})

describe('Point 29 — ce qui n’est jamais un double', () => {
  it('même code, sous-comptes différents (T21 § 4.2) : deux entrées, même si les libellés ne diffèrent que par « _ »', () => {
    const fournisseurA = entreePlan({ id: 'pc-a', code: '40100', libelle: 'Fournisseurs', type: 'Fournisseur', sousCompte: '00101' })
    const fournisseurB = { ...fournisseurA, id: 'pc-b', libelle: 'Fournisseurs_', sousCompte: '00102' }
    const resultat = importerPlanComptable([fournisseurA, fournisseurB])
    expect(resultat.entrees).toEqual([fournisseurA, fournisseurB])
    expect(resultat.fusions).toEqual([])
    expect(resultat.signalements).toEqual([])
  })

  it('même code, sources différentes : deux entrées, aucun signalement', () => {
    const copro = entreePlan({ id: 'pc-a' })
    const commune = entreePlan({ id: 'pc-b', source: 'Commune', libelle: 'COPROPRIETAIRES_' })
    const resultat = importerPlanComptable([copro, commune])
    expect(resultat.entrees).toEqual([copro, commune])
    expect(resultat.signalements).toEqual([])
  })
})

describe('Point 29 — garanties de l’import', () => {
  const lot = (): PlanComptable[] => [
    entreePlan({ id: 'pc-45000-a' }),
    attenteOrdinaire,
    entreePlan({ id: 'pc-45000-b', libelle: 'COPROPRIETAIRES_' }),
    subvention,
    attenteBascule,
    subventionOperation,
    entreePlan({ id: 'pc-512', code: '51200', libelle: 'Banque', type: 'Banque', nature: 'Banque' }),
  ]

  it('chaque entrée de l’import se retrouve une fois : conservée, absorbée ou en attente ; clés uniques ; ordre de première occurrence', () => {
    const entrees = lot()
    const resultat = importerPlanComptable(entrees)
    const absorbes = resultat.fusions.flatMap((f) => f.absorbesIds)
    expect(resultat.entrees.length + absorbes.length + resultat.enAttente.length).toBe(entrees.length)
    const ids = [...resultat.entrees, ...resultat.enAttente].map((e) => e.id).concat(absorbes)
    expect(new Set(ids).size).toBe(entrees.length)
    const cles = resultat.entrees.map(clePlanComptable)
    expect(new Set(cles).size).toBe(cles.length)
    expect(resultat.entrees.map((e) => e.id)).toEqual(['pc-45000-a', 'pc-47150-a', 'pc-47150-b', 'pc-512'])
    expect(resultat.enAttente.map((e) => e.id)).toEqual(['pc-71147-a', 'pc-71147-b'])
    expect(resultat.signalements.map((s) => s.motif)).toEqual(['types_distincts', 'libelle_different'])
  })

  it('ordre de première occurrence, distinct de l’ordre des codes, même quand l’entrée conservée d’une fusion vient en second', () => {
    const caisse = entreePlan({ id: 'pc-530', code: '53000', libelle: 'CAISSE', type: 'Caisse', nature: 'Caisse' })
    const double = entreePlan({ id: 'pc-45000-b', libelle: 'COPROPRIETAIRES_' })
    const principale = entreePlan({ id: 'pc-45000-a' })
    expect(importerPlanComptable([caisse, double, principale]).entrees.map((e) => e.id)).toEqual(['pc-530', 'pc-45000-a'])
    const banque = entreePlan({ id: 'pc-512', code: '51200', libelle: 'Banque', type: 'Banque', nature: 'Banque' })
    expect(importerPlanComptable([attenteOrdinaire, banque, attenteBascule]).entrees.map((e) => e.id)).toEqual([
      'pc-47150-a',
      'pc-512',
      'pc-47150-b',
    ])
    expect(importerPlanComptable([banque, caisse, principale]).entrees.map((e) => e.id)).toEqual(['pc-512', 'pc-530', 'pc-45000-a'])
  })

  it('une clé fusionnée prend le rang de sa première occurrence (le double « _ »), pas celui de l’entrée conservée', () => {
    const double = entreePlan({ id: 'pc-45000-b', libelle: 'COPROPRIETAIRES_' })
    const caisse = entreePlan({ id: 'pc-530', code: '53000', libelle: 'CAISSE', type: 'Caisse', nature: 'Caisse' })
    const principale = entreePlan({ id: 'pc-45000-a' })
    const resultat = importerPlanComptable([double, caisse, principale])
    expect(resultat.fusions).toMatchObject([{ conserveId: 'pc-45000-a', absorbesIds: ['pc-45000-b'] }])
    expect(resultat.entrees.map((e) => e.id)).toEqual(['pc-45000-a', 'pc-530'])
  })

  it('la fonction est pure : l’import n’est pas modifié', () => {
    const entrees = lot()
    const copie = structuredClone(entrees)
    for (const entree of entrees) Object.freeze(entree)
    importerPlanComptable(Object.freeze(entrees))
    expect(entrees).toEqual(copie)
  })

  it('un identifiant en double dans l’import est refusé', () => {
    expect(() => importerPlanComptable([entreePlan({ id: 'pc-x' }), entreePlan({ id: 'pc-x', code: '53000' })])).toThrow(/pc-x/)
  })
})

describe('Point 29 — désigner une entrée de plan sans « premier trouvé »', () => {
  const plan = importerPlanComptable([
    entreePlan({ id: 'pc-45000-a' }),
    entreePlan({ id: 'pc-45000-b', libelle: 'COPROPRIETAIRES_' }),
    attenteOrdinaire,
    attenteBascule,
  ]).entrees

  it('45000 : trouvée après fusion', () => {
    expect(resoudreEntreePlan(plan, { source: 'Copropriété', code: '45000' })).toEqual({
      statut: 'trouvee',
      entree: plan[0],
    })
  })

  it('47150 sans type : ambiguë, les deux candidates ; avec son type : trouvée', () => {
    expect(resoudreEntreePlan(plan, { source: 'Copropriété', code: '47150' })).toEqual({
      statut: 'ambigue',
      candidates: [attenteOrdinaire, attenteBascule],
    })
    expect(resoudreEntreePlan(plan, { source: 'Copropriété', code: '47150', type: "Compte d'attente" })).toEqual({
      statut: 'trouvee',
      entree: attenteOrdinaire,
    })
  })

  it('code inconnu, type inconnu ou autre source : absente', () => {
    expect(resoudreEntreePlan(plan, { source: 'Copropriété', code: '99999' })).toEqual({ statut: 'absente' })
    expect(resoudreEntreePlan(plan, { source: 'Copropriété', code: '47150', type: 'Travaux - Appels' })).toEqual({ statut: 'absente' })
    expect(resoudreEntreePlan(plan, { source: 'Commune', code: '45000' })).toEqual({ statut: 'absente' })
  })

  it('sur un plan non importé, les doubles « _ » restent ambigus', () => {
    const brut = [entreePlan({ id: 'pc-a' }), entreePlan({ id: 'pc-b', libelle: 'COPROPRIETAIRES_' })]
    expect(resoudreEntreePlan(brut, { source: 'Copropriété', code: '45000' }).statut).toBe('ambigue')
  })

  it('le sous-compte, s’il est donné, filtre les candidates', () => {
    const fournisseurs = [
      entreePlan({ id: 'pc-a', code: '40100', type: 'Fournisseur', sousCompte: '00101' }),
      entreePlan({ id: 'pc-b', code: '40100', type: 'Fournisseur', sousCompte: '00102' }),
    ]
    expect(resoudreEntreePlan(fournisseurs, { source: 'Copropriété', code: '40100' }).statut).toBe('ambigue')
    expect(resoudreEntreePlan(fournisseurs, { source: 'Copropriété', code: '40100', sousCompte: '00102' })).toEqual({
      statut: 'trouvee',
      entree: fournisseurs[1],
    })
  })

  it('40100 générique et 40100-00101 : `sousCompte: null` (ou vide) désigne l’entrée sans sous-compte ; absent, il ne filtre pas', () => {
    const generique = entreePlan({ id: 'pc-40100', code: '40100', libelle: 'Fournisseurs', type: 'Fournisseur' })
    const tiers = { ...generique, id: 'pc-40100-00101', sousCompte: '00101' }
    const importe = importerPlanComptable([generique, tiers])
    expect(importe).toMatchObject({ entrees: [generique, tiers], signalements: [], enAttente: [] })
    const critere = { source: 'Copropriété', code: '40100' } as const
    expect(resoudreEntreePlan(importe.entrees, critere).statut).toBe('ambigue')
    expect(resoudreEntreePlan(importe.entrees, { ...critere, sousCompte: undefined }).statut).toBe('ambigue')
    expect(resoudreEntreePlan(importe.entrees, { ...critere, sousCompte: null })).toEqual({ statut: 'trouvee', entree: generique })
    expect(resoudreEntreePlan(importe.entrees, { ...critere, type: 'Fournisseur', sousCompte: null })).toEqual({
      statut: 'trouvee',
      entree: generique,
    })
    expect(resoudreEntreePlan(importe.entrees, { ...critere, sousCompte: '  ' })).toEqual({ statut: 'trouvee', entree: generique })
    expect(resoudreEntreePlan(importe.entrees, { ...critere, sousCompte: '00101' })).toEqual({ statut: 'trouvee', entree: tiers })
    expect(resoudreEntreePlan([tiers], { ...critere, sousCompte: null })).toEqual({ statut: 'absente' })
  })

  it('`type: null` désigne l’entrée sans type ; absent, il ne filtre pas', () => {
    const sansType = entreePlan({ id: 'pc-a', code: '40100', type: undefined })
    const typee = entreePlan({ id: 'pc-b', code: '40100', type: 'Fournisseur', sousCompte: '00101' })
    const critere = { source: 'Copropriété', code: '40100' } as const
    expect(resoudreEntreePlan([sansType, typee], critere).statut).toBe('ambigue')
    expect(resoudreEntreePlan([sansType, typee], { ...critere, type: null })).toEqual({ statut: 'trouvee', entree: sansType })
    expect(resoudreEntreePlan([sansType, typee], { ...critere, type: 'Fournisseur' })).toEqual({ statut: 'trouvee', entree: typee })
  })
})

describe('Point 29 — DOMAINE : feuilles relevées en tranche 43 § 20', () => {
  it('aucune racine vide', () => {
    for (const [racine, feuilles] of Object.entries(DOMAINE)) expect(feuilles.length, racine).toBeGreaterThan(0)
  })

  it('les trois racines complétées : 1, 6 et 5 feuilles', () => {
    expect([...DOMAINE['AUTRES ABONNEMENTS CONTRACTUELS']]).toEqual(['Assurance PNO'])
    expect([...DOMAINE.ELECTRICITE]).toEqual([
      'Compteur individuel élec.',
      'Électricité',
      "Fournitures d'électricité",
      'Groupe électrogène',
      'Paratonnerre',
      'Transformateur',
    ])
    expect([...DOMAINE.EQUIPEMENTS]).toEqual(["Compresseur d'air", 'Disconnecteur', 'Plieuse', 'Ventilation cuisine', 'VMC'])
  })

  it('124 feuilles au total, comme la table de traçabilité', () => {
    expect(Object.values(DOMAINE).flat()).toHaveLength(124)
    const trace = REFERENTIELS_TRACABILITE.find((t) => t.nom === 'DOMAINE')
    expect(trace?.nbValeurs).toBe(124)
    expect(trace?.statut).toMatch(/tranche 43 § 20/)
  })
})

describe('Point 29 — en-tête du module : le droit lu et la lecture du logiciel ne se mélangent pas', () => {
  const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'plan-comptable-doubles.ts'), 'utf8')
  /**
   * Du début donné à la ligne « * » vide suivante, ou à la fin du commentaire pour le dernier paragraphe ; les retours à
   * la ligne du commentaire sont ramenés à une espace, pour qu'une phrase coupée se lise d'un tenant.
   */
  const paragraphe = (debut: string): string => {
    const i = source.indexOf(debut)
    expect(i, debut).toBeGreaterThanOrEqual(0)
    let fin = source.indexOf('\n *\n', i)
    if (fin < 0) fin = source.indexOf('\n */', i)
    return source.slice(i, fin).replaceAll(/\r?\n \*\s+/g, ' ')
  }

  it('🟢 Légifrance : l’art. 8 est cité avec sa condition, sans rattachement aux codes Gestéam', () => {
    const droit = paragraphe('Le droit — 🟢')
    expect(droit).toContain('« les seuls utilisables »')
    expect(droit).toContain('ne suffisent pas')
    expect(droit).toContain('« peut ouvrir toute subdivision nécessaire »')
    expect(droit).not.toMatch(/Gestéam|fondement/)
  })

  it('🔵 : le rattachement des codes Gestéam à l’art. 8 est déduit, et réservé pour 00000 et 58xxx (T21 § 2)', () => {
    const deduit = paragraphe('🔵 Déduit')
    expect(deduit).toMatch(/art\. 8/)
    expect(deduit).toMatch(/00000/)
    expect(deduit).toMatch(/58xxx/)
    expect(deduit).toMatch(/aucun compte de l'art\. 7/)
  })

  it('🔵 : l’asymétrie sous-compte / type est tracée (sans sous-compte : importée sans signalement ; sans type : bloquant)', () => {
    const deduit = paragraphe('🔵 Déduit')
    expect(deduit).toMatch(/sans sous-compte à côté d'entrées à sous-compte/)
    expect(deduit).toMatch(/sans signalement/)
    expect(deduit).toMatch(/type_absent/)
    expect(deduit).toMatch(/24 lignes sur 710/)
    expect(deduit).toMatch(/sousCompte: null/)
  })

  it('🔴 : la coexistence d’un code sans sous-compte et à sous-compte, et le sens de « 00000 », sont des questions ouvertes', () => {
    const ouvert = paragraphe('🔴 Non établi')
    expect(ouvert).toMatch(/40100 générique à côté de 40100\/00101/)
    expect(ouvert).toMatch(/tranche 21 § 4\.2 ne l'établit pas/)
    expect(ouvert).toMatch(/« 00000 »[^?]*\?/)
    expect(ouvert).not.toMatch(/\*\//)
  })
})
