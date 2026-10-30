import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  SANS_ASSURANCE_IMPAYES,
  TYPES_SINISTRE_IMPAYES,
  controlerAssuranceImpayes,
  creerAssuranceImpayes,
  vueAssuranceImpayes,
  type AssuranceImpayesContentieux,
  type SinistreLie,
} from '@/lib/administrateur-judiciaire/domain/contentieux-assurance-impayes'
import { creerDossierContentieux, type SaisieContentieux } from '@/lib/administrateur-judiciaire/domain/contentieux'
import { creerSinistre, indemnitesSinistre, type SaisieSinistre } from '@/lib/administrateur-judiciaire/domain/sinistres'
import { TYPE_SINISTRE } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Point 57 du bilan Gestéam — assurance des impayés d'un contentieux (tranche 42, onglet Règlements, bloc Assurance :
 * case « Couverture impayés », « Déclaré le », « Indemnités totales (€) », bouton « Sinistre »).
 * - La garantie impayés se déclare comme un sinistre (🔵) : le contentieux porte la couverture, la date de déclaration et
 *   le lien vers la fiche sinistre ; les indemnités sont LUES sur le sinistre (indemnitesSinistre), jamais dupliquées.
 * - Aucun texte ne régit une « assurance des impayés de charges » (recherche Légifrance du 29/10/2026) : les contrôles
 *   signalent des incohérences de saisie, ils ne refusent rien et ne calculent aucun délai de déclaration.
 */

const AUJOURDHUI = '2026-10-29'

const ficheSinistre = (surcharge: Partial<SaisieSinistre> = {}) =>
  creerSinistre({
    coproprieteId: 'copro-1',
    type: 'Charges Impayées',
    phase: 'Indemnités',
    dateSurvenance: '2026-02-01',
    dateConnaissance: null,
    dateDeclaration: '2026-03-10',
    dateExpertise: null,
    dateRapport: null,
    dateReglement: null,
    dateCloture: null,
    partiesCommunesLesees: false,
    partiesCommunesResponsables: false,
    origine: '',
    lieu: '',
    dommages: '',
    assurance: { compagnie: null, courtier: null, contrat: null, numeroSinistre: null },
    indemniteImmediateCentimes: 120_000,
    indemniteImmediateReglee: true,
    indemniteDiffereeCentimes: 45_000,
    indemniteDiffereeReglee: false,
    causesSupprimees: false,
    reparationsFaites: false,
    ...surcharge,
  })

const lie = (surcharge: Partial<SaisieSinistre> = {}, id = 'S-1'): SinistreLie => ({ id, fiche: ficheSinistre(surcharge) })

const assurance = (surcharge: Partial<AssuranceImpayesContentieux> = {}): AssuranceImpayesContentieux =>
  creerAssuranceImpayes({ couverture: true, declareLe: '2026-03-10', sinistreId: 'S-1', ...surcharge })

const recouvrement = { coproprieteId: 'copro-1', type: 'Recouvrement de charges/loyer' } as const

const codes = (
  dossier: Parameters<typeof controlerAssuranceImpayes>[0],
  saisie: AssuranceImpayesContentieux,
  sinistre: SinistreLie | null,
) => controlerAssuranceImpayes(dossier, saisie, sinistre, AUJOURDHUI).map((a) => a.code)

describe('assurance impayés — types de sinistre et création', () => {
  it('les sinistres de la garantie impayés sont « Charges Impayées » et « Loyers Impayés », du référentiel Gestéam', () => {
    expect(TYPES_SINISTRE_IMPAYES).toEqual(['Charges Impayées', 'Loyers Impayés'])
    for (const type of TYPES_SINISTRE_IMPAYES) expect(TYPE_SINISTRE).toContain(type)
  })

  it('sans assurance : pas de couverture, ni déclaration, ni sinistre', () => {
    expect(SANS_ASSURANCE_IMPAYES).toEqual({ couverture: false, declareLe: null, sinistreId: null })
  })

  it('normalise la saisie : lien rogné, lien vide ou absent → null, date absente → null', () => {
    expect(creerAssuranceImpayes({ couverture: true, sinistreId: '  S-1 ' })).toEqual({
      couverture: true,
      declareLe: null,
      sinistreId: 'S-1',
    })
    expect(creerAssuranceImpayes({ couverture: false, declareLe: null, sinistreId: '   ' }).sinistreId).toBeNull()
  })

  it('ne stocke aucune indemnité sur le contentieux', () => {
    expect(Object.keys(assurance()).sort((a, b) => a.localeCompare(b))).toEqual(['couverture', 'declareLe', 'sinistreId'])
  })

  it('refuse une date de déclaration non ISO et une couverture non booléenne', () => {
    expect(() => creerAssuranceImpayes({ couverture: true, declareLe: '10/03/2026' })).toThrow(/date/i)
    expect(() => creerAssuranceImpayes({ couverture: 'oui' as never })).toThrow(/couverture/i)
  })
})

describe('assurance impayés — portée sur le dossier contentieux', () => {
  const saisie = (surcharge: Partial<SaisieContentieux> = {}): SaisieContentieux => ({
    coproprieteId: 'copro-1',
    type: 'Recouvrement de charges/loyer',
    phase: 'Ouverture',
    particularite: 'Contentieux sans échéancier',
    dateOuverture: '2026-01-15',
    dateCloture: null,
    objet: 'Charges impayées 2025',
    montantDemandeCentimes: 482_000,
    intervenants: {
      huissier: { nom: null, reference: null, transmisLe: null },
      avocat: { nom: null, reference: null, transmisLe: null },
      expert: { nom: null, reference: null, transmisLe: null },
    },
    jalons: {},
    ...surcharge,
  })

  it('le champ reste facultatif : un dossier saisi sans assurance n’en reçoit pas', () => {
    expect('assuranceImpayes' in creerDossierContentieux(saisie())).toBe(false)
  })

  it('creerDossierContentieux normalise l’assurance saisie et refuse une date de déclaration invalide', () => {
    const dossier = creerDossierContentieux(
      saisie({ assuranceImpayes: { couverture: true, declareLe: '2026-03-10', sinistreId: ' S-1 ' } }),
    )
    expect(dossier.assuranceImpayes).toEqual({ couverture: true, declareLe: '2026-03-10', sinistreId: 'S-1' })
    expect(() =>
      creerDossierContentieux(saisie({ assuranceImpayes: { couverture: true, declareLe: '2026-02-30', sinistreId: null } })),
    ).toThrow(/date/i)
  })
})

describe('assurance impayés — contrôles (signale, ne refuse pas)', () => {
  it('aucune anomalie pour une couverture déclarée et reliée au sinistre de la même date', () => {
    expect(controlerAssuranceImpayes(recouvrement, assurance(), lie(), AUJOURDHUI)).toEqual([])
  })

  it('aucune anomalie sans assurance, ni pour une couverture pas encore déclarée', () => {
    expect(controlerAssuranceImpayes(recouvrement, SANS_ASSURANCE_IMPAYES, null, AUJOURDHUI)).toEqual([])
    expect(codes(recouvrement, assurance({ declareLe: null, sinistreId: null }), null)).toEqual([])
  })

  it('déclaration ou sinistre sans la case « Couverture impayés »', () => {
    expect(codes(recouvrement, assurance({ couverture: false, sinistreId: null }), null)).toEqual(['declaration_sans_couverture'])
    expect(codes(recouvrement, assurance({ couverture: false, declareLe: null }), lie({ dateDeclaration: null }))).toEqual([
      'sinistre_sans_couverture',
    ])
  })

  it('couverture impayés sur un contentieux qui n’est pas un recouvrement de charges', () => {
    expect(codes({ coproprieteId: 'copro-1', type: 'Garantie décennale' }, assurance(), lie())).toEqual([
      'couverture_hors_recouvrement',
    ])
  })

  it('lien vers un sinistre introuvable', () => {
    expect(codes(recouvrement, assurance(), null)).toEqual(['sinistre_introuvable'])
  })

  it('sinistre d’un autre type que les impayés, ou d’une autre copropriété', () => {
    expect(codes(recouvrement, assurance(), lie({ type: 'Dégât des eaux' }))).toEqual(['sinistre_hors_impayes'])
    expect(codes(recouvrement, assurance(), lie({ type: 'Loyers Impayés' }))).toEqual([])
    expect(codes(recouvrement, assurance(), lie({ coproprieteId: 'copro-2' }))).toEqual(['sinistre_autre_copropriete'])
  })

  it('date de déclaration différente de celle du sinistre, ou reportée d’un seul côté', () => {
    const divergence = controlerAssuranceImpayes(recouvrement, assurance({ declareLe: '2026-03-12' }), lie(), AUJOURDHUI)
    expect(divergence.map((a) => a.code)).toEqual(['declaration_divergente'])
    expect(divergence[0].message).toContain('10/03/2026')
    expect(divergence[0].message).toContain('12/03/2026')
    expect(codes(recouvrement, assurance({ declareLe: null }), lie())).toEqual(['declaration_divergente'])
    expect(codes(recouvrement, assurance(), lie({ dateDeclaration: null }))).toEqual(['declaration_divergente'])
  })

  it('message de divergence : l’année s’écrit sur 4 chiffres, pour que 0026 ne passe pas pour 2026', () => {
    const divergence = (declareLe: string, dateDeclaration: string) =>
      controlerAssuranceImpayes(recouvrement, assurance({ declareLe }), lie({ dateDeclaration }), AUJOURDHUI)
    expect(divergence('0026-03-10', '2026-03-10').find((a) => a.code === 'declaration_divergente')?.message).toBe(
      "Déclaration à l'assureur le 10/03/0026 sur le contentieux, le 10/03/2026 sur le sinistre lié.",
    )
    // Faute de frappe côté sinistre : seule la divergence est signalée, elle doit donc montrer l'année fautive.
    const inverse = divergence('2026-03-10', '0026-03-10')
    expect(inverse.map((a) => a.code)).toEqual(['declaration_divergente'])
    expect(inverse[0].message).toContain('le 10/03/0026 sur le sinistre lié')
  })

  it('déclaration datée après aujourd’hui (2525) ou d’une année improbable (0026)', () => {
    const future = controlerAssuranceImpayes(recouvrement, assurance({ declareLe: '2525-03-10', sinistreId: null }), null, AUJOURDHUI)
    expect(future).toEqual([
      { code: 'declaration_non_plausible', nature: 'future', message: 'Déclaration datée du 10/03/2525, après aujourd\'hui.' },
    ])
    const improbable = controlerAssuranceImpayes(recouvrement, assurance({ declareLe: '0026-03-10', sinistreId: null }), null, AUJOURDHUI)
    expect(improbable.map((a) => a.nature)).toEqual(['annee_improbable'])
  })

  it('refuse une fiche sinistre qui n’est pas celle du lien, et une date du jour invalide', () => {
    expect(() => controlerAssuranceImpayes(recouvrement, assurance(), lie({}, 'S-2'), AUJOURDHUI)).toThrow(/sinistre/i)
    expect(() => controlerAssuranceImpayes(recouvrement, assurance({ sinistreId: null }), lie(), AUJOURDHUI)).toThrow(/sinistre/i)
    expect(() => controlerAssuranceImpayes(recouvrement, assurance(), lie(), '29/10/2026')).toThrow(/date/i)
  })
})

describe('assurance impayés — vue : indemnités lues sur le sinistre', () => {
  it('reprend strictement les indemnités du sinistre (indemnitesSinistre)', () => {
    const sinistre = lie()
    const vue = vueAssuranceImpayes(assurance(), sinistre)
    expect(vue.indemnites).toEqual(indemnitesSinistre(sinistre.fiche))
    expect(vue.indemnites).toEqual({ totalCentimes: 165_000, regleCentimes: 120_000, resteCentimes: 45_000 })
    expect(vue).toMatchObject({ couverture: true, declareLe: '2026-03-10', sinistreId: 'S-1' })
  })

  it('sans sinistre lié ou sans fiche : pas d’indemnités', () => {
    expect(vueAssuranceImpayes(assurance({ sinistreId: null }), null).indemnites).toBeNull()
    expect(vueAssuranceImpayes(assurance(), null).indemnites).toBeNull()
  })

  it('refuse une fiche sinistre qui n’est pas celle du lien', () => {
    expect(() => vueAssuranceImpayes(assurance(), lie({}, 'S-2'))).toThrow(/sinistre/i)
    expect(() => vueAssuranceImpayes(assurance({ sinistreId: null }), lie())).toThrow(/sinistre/i)
  })
})

describe('assurance impayés — en-tête : lecture des textes', () => {
  // Les lignes de commentaire sont recollées : une phrase de l'en-tête peut courir sur plusieurs lignes.
  const source = readFileSync(
    join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'contentieux-assurance-impayes.ts'),
    'utf8',
  ).replaceAll(/\r?\n\s*\*\s*/g, ' ')

  it('C. civ. art. 1346-5 : invocable par le débiteur dès qu’il la connaît, opposable après notification ou prise d’acte', () => {
    expect(source).toMatch(/opposable au débiteur après notification ou s'il en a pris acte/)
    expect(source).toMatch(/invocable par lui dès qu'il en a connaissance/)
    expect(source).toMatch(/opposable aux tiers dès le paiement/)
    expect(source).not.toMatch(/aucun effet tant que/)
    expect(source).toMatch(/non opposable au débiteur tant qu'elle n'est ni notifiée ni prise en acte/)
  })

  it('C. assur. art. L. 111-1 : l’application de L. 113-2 et de L. 121-12 à une garantie impayés reste à établir', () => {
    expect(source).toMatch(/L\. 111-1/)
    expect(source).toMatch(/opérations d'assurance crédit/)
    expect(source).toMatch(/opération d'assurance crédit \?/)
    expect(source).not.toMatch(/assureur de biens/)
    expect(source).toMatch(/assurances de dommages/)
  })
})
