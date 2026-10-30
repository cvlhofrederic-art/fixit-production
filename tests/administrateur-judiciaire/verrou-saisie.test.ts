import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Exercice } from '@/lib/administrateur-judiciaire/domain/exercices-budgets'
import {
  annulerTraitement,
  creerTraitement,
  type LigneMouvement,
  type SaisieTraitement,
} from '@/lib/administrateur-judiciaire/domain/traitements'
import {
  borneApplicable,
  borneArreteDesComptes,
  bornesDuPlan,
  messageVerrou,
  type BorneVerrou,
  type VerrouSaisie,
} from '@/lib/administrateur-judiciaire/domain/verrou-saisie'

/**
 * Point 27 du bilan — verrouillage de la saisie. Une date comptable couverte par une borne (édition figée, arrêté des
 * comptes de l'exercice, limite inférieure de saisie d'un plan) est refusée par creerTraitement et annulerTraitement ;
 * le refus dit quelle limite s'applique (critère T24). Sans verrou, rien ne change.
 */

const banque = 'TILL.51200.00000.0'
const copro = 'TILL.45000.00012.0'
const charge = 'TILL.61500.00000.0'
const fournisseur = 'TILL.40100.PLOMB.0'

const encaissement = (id: string, date: string, verrou?: VerrouSaisie) => {
  const saisie: SaisieTraitement = {
    id,
    famille: 'Encaissement',
    date,
    mouvements: [
      { compte: banque, sens: 'debit', montantCentimes: 10_000 },
      { compte: copro, sens: 'credit', montantCentimes: 10_000 },
    ],
  }
  return verrou === undefined ? creerTraitement(saisie) : creerTraitement(saisie, { verrou })
}

const facture = (id: string, date: string, verrou: VerrouSaisie) =>
  creerTraitement(
    {
      id,
      famille: 'Saisie de factures',
      date,
      mouvements: [
        { compte: charge, sens: 'debit', montantCentimes: 5_000 },
        { compte: fournisseur, sens: 'credit', montantCentimes: 5_000 },
      ],
    },
    { verrou },
  )

const edition: BorneVerrou = { jusquAu: '2026-03-31', origine: 'edition', reference: 'ed-7' }

describe('verrou de saisie — sans verrou', () => {
  it('creerTraitement et annulerTraitement se comportent comme avant (un argument, verrou absent ou vide)', () => {
    const t = encaissement('t1', '2020-01-01')
    expect(encaissement('t2', '2020-01-01', [])).toEqual({ ...t, id: 't2', mouvements: t.mouvements.map((m) => ({ ...m, traitementId: 't2' })) })
    expect(annulerTraitement(t, { id: 't1-a', date: '2020-01-01' }).annule).toBe('t1')
    expect(annulerTraitement(t, { id: 't1-b', date: '2020-01-01', verrou: [] }).annule).toBe('t1')
  })

  it('borneApplicable ne retient rien quand aucune borne ne couvre la date', () => {
    expect(borneApplicable([], { date: '2026-01-01', famille: 'Encaissement', comptes: [banque] })).toBeNull()
    expect(borneApplicable([edition], { date: '2026-04-01', famille: 'Encaissement', comptes: [banque] })).toBeNull()
  })
})

describe('verrou de saisie — borne d’édition', () => {
  it('refuse la date de la borne et toute date antérieure ; le message cite l’origine, la référence et la date', () => {
    expect(() => encaissement('t1', '2026-03-31', [edition])).toThrow(
      "Date comptable 2026-03-31 verrouillée jusqu'au 2026-03-31 inclus par l'édition « ed-7 » : saisie possible à partir du 2026-04-01.",
    )
    expect(() => encaissement('t1', '2025-06-30', [edition])).toThrow(/verrouillée.*édition « ed-7 »/)
  })

  it('accepte le lendemain de la borne', () => {
    expect(encaissement('t1', '2026-04-01', [edition]).date).toBe('2026-04-01')
  })

  it('refus atomique : une seule ligne visée suffit à refuser tout le traitement', () => {
    const verrou: VerrouSaisie = [{ ...edition, plans: ['51200'] }]
    expect(() => encaissement('t1', '2026-03-15', verrou)).toThrow(/verrouillée/)
    expect(facture('f1', '2026-03-15', verrou).id).toBe('f1')
  })

  it('une borne limitée à des familles ou à une plage de comptes laisse passer le reste', () => {
    const parFamille: VerrouSaisie = [{ ...edition, familles: ['Encaissement'] }]
    expect(() => encaissement('t1', '2026-03-15', parFamille)).toThrow(/ed-7/)
    expect(facture('f1', '2026-03-15', parFamille).id).toBe('f1')
    const parComptes: VerrouSaisie = [{ ...edition, compteDu: 'TILL.60000.00000.0', compteAu: 'TILL.69999.ZZZZZ.Z' }]
    expect(() => facture('f2', '2026-03-15', parComptes)).toThrow(/ed-7/)
    expect(encaissement('t2', '2026-03-15', parComptes).id).toBe('t2')
  })

  it('quand plusieurs bornes couvrent la date, la plus tardive est citée', () => {
    const verrou: VerrouSaisie = [
      { jusquAu: '2026-01-31', origine: 'edition', reference: 'ed-1' },
      { jusquAu: '2026-06-30', origine: 'edition', reference: 'ed-2' },
      { jusquAu: '2026-03-31', origine: 'arrete', reference: 'ex-2026' },
    ]
    expect(borneApplicable(verrou, { date: '2026-01-15', famille: 'Encaissement', comptes: [banque] })?.reference).toBe('ed-2')
    expect(() => encaissement('t1', '2026-01-15', verrou)).toThrow(/ed-2.*2026-07-01/)
  })

  it('une borne mal formée est refusée, même si elle ne couvre pas la date', () => {
    const date = '2026-12-01'
    expect(() => encaissement('t1', date, [{ ...edition, jusquAu: '2026-02-30' }])).toThrow(/borne de verrou invalide/i)
    expect(() => encaissement('t1', date, [{ ...edition, reference: ' ' }])).toThrow(/borne de verrou invalide/i)
    expect(() => encaissement('t1', date, [{ ...edition, origine: 'journal' as BorneVerrou['origine'] }])).toThrow(/borne de verrou invalide/i)
  })

  it('une borne au périmètre vide ou incohérent est refusée au lieu de ne rien verrouiller', () => {
    const date = '2026-03-01'
    const familleInconnue = { ...edition, familles: ['Encaissements'] } as unknown as BorneVerrou
    expect(() => encaissement('t1', date, [familleInconnue])).toThrow(/borne de verrou invalide.*famille inconnue « Encaissements »/i)
    expect(() => encaissement('t1', date, [{ ...edition, familles: [] }])).toThrow(/borne de verrou invalide.*familles vide/i)
    expect(() => encaissement('t1', date, [{ ...edition, plans: [] }])).toThrow(/borne de verrou invalide.*plans vide/i)
    expect(() => encaissement('t1', date, [{ ...edition, compteDu: 'TILL.6', compteAu: 'TILL.5' }])).toThrow(
      /borne de verrou invalide.*plage de comptes inversée/i,
    )
  })

  it('le contrôle porte sur la date comptable, qui doit être une date ISO', () => {
    expect(() => borneApplicable([edition], { date: '31/03/2026', famille: 'Encaissement', comptes: [banque] })).toThrow(/date comptable invalide/i)
  })
})

describe('verrou de saisie — limite inférieure de saisie du plan', () => {
  const plan = [
    { code: '51200', limiteInferieureSaisie: '2026-03-01' },
    { code: '61500' },
    { code: '70100', limiteInferieureSaisie: '' },
  ]

  it('une entrée de plan avec limite L donne une borne jusqu’à la veille de L, limitée à ce plan', () => {
    expect(bornesDuPlan(plan)).toEqual([{ jusquAu: '2026-02-28', origine: 'plan', reference: '51200', plans: ['51200'] }])
  })

  it('refuse une date avant L, accepte L ; les autres plans ne sont pas touchés', () => {
    const verrou = bornesDuPlan(plan)
    expect(() => encaissement('t1', '2026-02-28', verrou)).toThrow(
      "Date comptable 2026-02-28 verrouillée jusqu'au 2026-02-28 inclus par la limite inférieure de saisie du plan « 51200 » : saisie possible à partir du 2026-03-01.",
    )
    expect(encaissement('t1', '2026-03-01', verrou).date).toBe('2026-03-01')
    expect(facture('f1', '2026-01-10', verrou).date).toBe('2026-01-10')
  })

  it('contrôle aussi un compte dont le segment du syndicat est inconnu (« ____ »)', () => {
    const verrou = bornesDuPlan(plan)
    const lignes: LigneMouvement[] = [
      { compte: '____.51200.00000.0', sens: 'debit', montantCentimes: 100 },
      { compte: copro, sens: 'credit', montantCentimes: 100 },
    ]
    expect(() => creerTraitement({ id: 't1', famille: 'Encaissement', date: '2026-02-01', mouvements: lignes }, { verrou })).toThrow(/plan « 51200 »/)
  })

  it('une ligne sans compte est refusée pour ce motif, même quand une borne du plan couvre la date', () => {
    const verrou = bornesDuPlan(plan)
    const sansCompte = [
      { compte: undefined, sens: 'debit', montantCentimes: 100 },
      { compte: copro, sens: 'credit', montantCentimes: 100 },
    ] as unknown as LigneMouvement[]
    expect(() => creerTraitement({ id: 't1', famille: 'Encaissement', date: '2026-02-01', mouvements: sansCompte }, { verrou })).toThrow(
      'Mouvement sans compte.',
    )
    const montantInvalide: LigneMouvement[] = [
      { compte: banque, sens: 'debit', montantCentimes: -1 },
      { compte: copro, sens: 'credit', montantCentimes: -1 },
    ]
    expect(() => creerTraitement({ id: 't2', famille: 'Encaissement', date: '2026-02-01', mouvements: montantInvalide }, { verrou })).toThrow(
      /montant invalide/i,
    )
  })

  it('refuse une limite qui n’est pas une date ISO', () => {
    expect(() => bornesDuPlan([{ code: '51200', limiteInferieureSaisie: '01/03/26' }])).toThrow(/limite inférieure de saisie invalide.*51200/i)
  })
})

describe('verrou de saisie — arrêté des comptes de l’exercice', () => {
  /** Champs de l'Exercice du domaine (exercices-budgets.ts) que lit la borne : un Exercice complet s'y passe tel quel. */
  const exercice2025: Pick<Exercice, 'nom' | 'cloture'> = { nom: '2025', cloture: '2025-12-31' }

  it('la borne court jusqu’à la date de clôture incluse ; elle prend l’Exercice du domaine et le désigne par son nom', () => {
    const borne = borneArreteDesComptes(exercice2025)
    expect(borne).toEqual({ jusquAu: '2025-12-31', origine: 'arrete', reference: '2025' })
    expect(() => encaissement('t1', '2025-12-31', [borne])).toThrow(/arrêté des comptes de l'exercice « 2025 »/)
    expect(encaissement('t1', '2026-01-01', [borne]).date).toBe('2026-01-01')
  })

  it('refuse un exercice sans nom ou à date de clôture invalide', () => {
    expect(() => borneArreteDesComptes({ nom: '2025', cloture: '2025-13-31' })).toThrow(/clôture invalide.*« 2025 »/i)
    expect(() => borneArreteDesComptes({ nom: ' ', cloture: '2025-12-31' })).toThrow(/exercice sans nom/i)
  })

  it('messageVerrou dit quelle limite s’applique', () => {
    expect(messageVerrou('2025-11-02', { jusquAu: '2025-12-31', origine: 'arrete', reference: 'ex-2025' })).toBe(
      "Date comptable 2025-11-02 verrouillée jusqu'au 2025-12-31 inclus par l'arrêté des comptes de l'exercice « ex-2025 » : saisie possible à partir du 2026-01-01.",
    )
  })
})

describe('verrou de saisie — annulation (R6, arrêté du 14 mars 2005, art. 5 : écriture contraire)', () => {
  it('une contre-passation datée dans la période verrouillée est refusée', () => {
    const original = encaissement('t1', '2026-04-10')
    expect(() => annulerTraitement(original, { id: 't1-a', date: '2026-03-31', verrou: [edition] })).toThrow(/ed-7/)
  })

  it('un traitement verrouillé reste annulable par une contre-passation datée après la borne ; l’original reste intact', () => {
    const original = encaissement('t1', '2026-02-10')
    const instantane = structuredClone(original)
    const annulation = annulerTraitement(original, { id: 't1-a', date: '2026-04-01', verrou: [edition] })
    expect(annulation).toMatchObject({ famille: "Annulation d'encaissement", date: '2026-04-01', annule: 't1' })
    expect(original).toEqual(instantane)
  })

  it('la contre-passation n’est jamais incluse dans une édition, même si l’original l’était', () => {
    const original = encaissement('t1', '2026-02-10')
    const edite = { ...original, mouvements: original.mouvements.map((m) => ({ ...m, editionId: 'ed-7' })) }
    const annulation = annulerTraitement(edite, { id: 't1-a', date: '2026-04-01', verrou: [edition] })
    for (const m of annulation.mouvements) expect(m).not.toHaveProperty('editionId')
  })

  it('creerTraitement ne recopie pas la marque d’édition d’une ligne reçue', () => {
    const original = encaissement('t1', '2026-02-10')
    const lignes = original.mouvements.map((m) => ({ ...m, editionId: 'ed-7' }))
    const copie = creerTraitement({ id: 't2', famille: 'Encaissement', date: '2026-04-02', mouvements: lignes })
    for (const m of copie.mouvements) {
      expect(m).not.toHaveProperty('editionId')
      expect(m.traitementId).toBe('t2')
    }
  })
})

describe('verrou de saisie — en-tête (sources et marqueurs)', () => {
  const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'verrou-saisie.ts'), 'utf8')
  const entete = source.slice(0, source.indexOf('*/'))
  const paragraphes = entete.split(/\r?\n \*\r?\n/)
  const paragraphe = (debut: string): string => {
    const trouve = paragraphes.find((p) => p.includes(debut))
    expect(trouve, `paragraphe « ${debut} »`).toBeDefined()
    return trouve ?? ''
  }

  it('le bloc « lu sur Légifrance » ne contient que des lectures : ni déduction sur le PCG, ni recherche négative', () => {
    const lu = paragraphe('Le droit — 🟢 lu sur Légifrance')
    expect(lu).not.toMatch(/ne s'applique pas au syndicat/)
    expect(lu).not.toMatch(/Aucun texte/)
    expect(lu).toMatch(/65-557, art\. 14-3, al\. 1/)
    expect(lu).toMatch(/art\. 111-1/)
    expect(lu).toMatch(/version initiale/i)
    expect(lu).toMatch(/art\. 8[\s\S]*détailler/)
  })

  it('la mise à l’écart du PCG est une déduction ; l’absence de texte liant verrou et édition est un « non trouvé »', () => {
    expect(paragraphe('🔵 Déduit')).toMatch(/921-4[\s\S]*non repris/)
    expect(paragraphe('🔴 Non établi')).toMatch(/non trouvé/i)
    expect(paragraphe('🔴 Non établi')).toMatch(/verrou à une édition/)
  })

  it('T24 est citée comme spécification d’intégration VitFix, portant sur le journal, hors du bloc « cartographie »', () => {
    expect(paragraphe('lu dans la cartographie')).not.toMatch(/T24|03_LOT2/)
    expect(paragraphe('Spécification d’intégration VitFix')).toMatch(/T24[\s\S]*journal[\s\S]*dateLimiteSaisie/)
  })

  it('la borne de l’arrêté ne se lève pas : la réouverture d’un exercice clos est une question ouverte', () => {
    expect(entete).not.toMatch(/réouverture lève le verrou/)
    expect(paragraphe('🔴 Non établi')).toMatch(/peut-il être rouvert, et par quel acte tracé/)
  })
})
