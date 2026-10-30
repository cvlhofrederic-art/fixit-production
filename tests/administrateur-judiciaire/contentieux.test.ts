import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  GROUPES_RELANCE,
  JALONS_PROCEDURE,
  STADES_RELANCE,
  controlerChronologieContentieux,
  creerDossierContentieux,
  echeancierActif,
  etapeRecouvrementContentieux,
  particulariteSuggeree,
  phaseSuggeree,
  relanceDepuisEtape,
  relanceDuContentieux,
  type SaisieContentieux,
} from '@/lib/administrateur-judiciaire/domain/contentieux'
import {
  controlerEcheancier,
  genererEcheancier,
  suivreEcheancier,
} from '@/lib/administrateur-judiciaire/domain/decompte-contentieux'

/**
 * Contentieux (cartographie Gestéam, tranches 20, 27 et 28) : dossier, intervenants (huissier, avocat, expert),
 * jalons de procédure datés, phase, lien avec le recouvrement et les stades / groupes de relance.
 * - Type, phase et particularité : référentiels Gestéam existants (TYPE_CONTENTIEUX, PHASE_CONTENTIEUX,
 *   PARTICULARITE_CONTENTIEUX).
 * - La phase est SAISIE ; VitFix en SUGGÈRE une d'après les faits datés et signale l'écart, sans l'écraser.
 */

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

describe('contentieux — référentiels et création', () => {
  it('reprend les huit jalons de procédure de la fiche Gestéam, dans l’ordre de la fiche', () => {
    expect(JALONS_PROCEDURE.map((j) => j.libelle)).toEqual([
      'Mise en demeure',
      'Commandement',
      'Référé',
      'Assignation',
      'Audience',
      'Ordonnance',
      'Jugement',
      'Signification',
    ])
  })

  it('reprend les stades et groupes de relance de Gestéam (tranche 27)', () => {
    expect(STADES_RELANCE.map((s) => `${s.code} ${s.libelle}`)).toEqual([
      '0 Compte à jour',
      '1 1re relance',
      '2 Mise en demeure',
      '3 Relance après mise en demeure',
      '9 Dossier contentieux',
    ])
    expect(GROUPES_RELANCE.map((g) => `${g.code} ${g.libelle}`)).toEqual([
      '0 Relance',
      '1 Prélèvement',
      '6 Protocole d’accord',
      '9 Contentieux',
    ])
  })

  it('crée un dossier valide', () => {
    expect(creerDossierContentieux(saisie({ objet: '  Charges  impayées ' })).objet).toBe('Charges impayées')
  })

  it('refuse type, phase ou particularité inconnus, une date invalide, un montant non entier', () => {
    expect(() => creerDossierContentieux(saisie({ type: 'Litige' as never }))).toThrow(/type/i)
    expect(() => creerDossierContentieux(saisie({ phase: 'Audience' as never }))).toThrow(/phase/i)
    expect(() => creerDossierContentieux(saisie({ particularite: 'Avec plan' as never }))).toThrow(/particularit/i)
    expect(() => creerDossierContentieux(saisie({ jalons: { jugement: '12/03/2026' } }))).toThrow(/date/i)
    expect(() => creerDossierContentieux(saisie({ montantDemandeCentimes: 12.5 }))).toThrow(/montant/i)
    expect(() => creerDossierContentieux(saisie({ jalons: { plaidoirie: '2026-03-12' } as never }))).toThrow(/jalon/i)
  })
})

describe('contentieux — chronologie de la procédure', () => {
  it('aucune anomalie pour une procédure dans l’ordre', () => {
    const dossier = creerDossierContentieux(
      saisie({
        jalons: {
          miseEnDemeure: '2026-02-01',
          assignation: '2026-04-10',
          audience: '2026-06-05',
          jugement: '2026-07-01',
          signification: '2026-07-20',
          commandement: '2026-08-10',
        },
      }),
    )
    expect(controlerChronologieContentieux(dossier)).toEqual([])
  })

  it('signale un jugement avant l’audience et une signification avant le jugement', () => {
    const dossier = creerDossierContentieux(
      saisie({ jalons: { audience: '2026-06-05', jugement: '2026-05-01', signification: '2026-04-20' } }),
    )
    expect(controlerChronologieContentieux(dossier).map((a) => a.jalon)).toEqual(['jugement', 'signification'])
  })

  it('signale une transmission à l’huissier avant l’ouverture du dossier', () => {
    const dossier = creerDossierContentieux(
      saisie({ intervenants: { ...saisie().intervenants, huissier: { nom: 'Étude', reference: null, transmisLe: '2026-01-02' } } }),
    )
    expect(controlerChronologieContentieux(dossier).map((a) => a.jalon)).toEqual(['huissier'])
  })
})

describe('contentieux — phase suggérée d’après les faits datés', () => {
  const avec = (surcharge: Partial<SaisieContentieux>) => creerDossierContentieux(saisie(surcharge))
  const transmis = (role: 'huissier' | 'avocat') => ({
    intervenants: { ...saisie().intervenants, [role]: { nom: 'X', reference: null, transmisLe: '2026-03-01' } },
  })

  it.each([
    [{}, 'Ouverture'],
    [{ jalons: { miseEnDemeure: '2026-02-01' } }, 'Mise en demeure'],
    [{ jalons: { miseEnDemeure: '2026-02-01' }, ...transmis('huissier') }, "Transmis à l'huissier"],
    [{ jalons: { miseEnDemeure: '2026-02-01' }, ...transmis('avocat') }, "Transmis à l'avocat"],
    [{ jalons: { assignation: '2026-04-10' } }, 'Procédure Judiciaire'],
    [{ jalons: { jugement: '2026-07-01', commandement: '2026-08-10' } }, 'Exécution en cours'],
    [{ dateCloture: '2026-09-01' }, 'Clos'],
  ] as const)('%o → %s', (surcharge, phase) => {
    expect(phaseSuggeree(avec(surcharge as Partial<SaisieContentieux>)).phase).toBe(phase)
  })

  it('signale l’écart avec la phase saisie, sans l’écraser', () => {
    const dossier = avec({ phase: 'Mise en demeure', jalons: { assignation: '2026-04-10' } })
    expect(phaseSuggeree(dossier)).toEqual({ phase: 'Procédure Judiciaire', ecart: true })
    expect(dossier.phase).toBe('Mise en demeure')
  })

  it('« Règlement amiable » ou « Déclaration Assurance » saisis restent valables tant qu’aucun fait postérieur n’existe', () => {
    expect(phaseSuggeree(avec({ phase: 'Règlement amiable', jalons: { miseEnDemeure: '2026-02-01' } }))).toEqual({
      phase: 'Règlement amiable',
      ecart: false,
    })
    expect(phaseSuggeree(avec({ phase: 'Déclaration Assurance', type: 'Garantie décennale' }))).toEqual({
      phase: 'Déclaration Assurance',
      ecart: false,
    })
  })

  it('la date « Déclaré le » de l’assurance impayés ne donne pas la phase « Déclaration Assurance » (🔴 Frédéric)', () => {
    const declare = avec({ assuranceImpayes: { couverture: true, declareLe: '2026-03-10', sinistreId: null } })
    expect(phaseSuggeree(declare)).toEqual({ phase: 'Ouverture', ecart: false })
    expect(etapeRecouvrementContentieux(declare)).toBe('amiable')
    const enDemeure = avec({
      jalons: { miseEnDemeure: '2026-02-01' },
      assuranceImpayes: { couverture: true, declareLe: '2026-03-10', sinistreId: 'S-1' },
    })
    expect(phaseSuggeree(enDemeure).phase).toBe('Mise en demeure')
  })
})

describe('contentieux — lien avec le recouvrement et les relances', () => {
  it('donne l’étape de recouvrement d’un dossier de charges', () => {
    const etape = (surcharge: Partial<SaisieContentieux>) => etapeRecouvrementContentieux(creerDossierContentieux(saisie(surcharge)))
    expect(etape({})).toBe('amiable')
    expect(etape({ jalons: { miseEnDemeure: '2026-02-01' } })).toBe('mise_en_demeure')
    expect(etape({ jalons: { assignation: '2026-04-10' } })).toBe('procedure')
    expect(etape({ dateCloture: '2026-09-01' })).toBe('solde')
  })

  it('n’en donne aucune pour un autre type de contentieux', () => {
    expect(etapeRecouvrementContentieux(creerDossierContentieux(saisie({ type: 'Garantie décennale' })))).toBeNull()
  })

  it('traduit l’étape en stade et groupe de relance', () => {
    expect(relanceDepuisEtape('amiable', false)).toEqual({ stade: '1', groupe: '0' })
    expect(relanceDepuisEtape('mise_en_demeure', false)).toEqual({ stade: '2', groupe: '0' })
    expect(relanceDepuisEtape('exigibilite', false)).toEqual({ stade: '3', groupe: '0' })
    expect(relanceDepuisEtape('procedure', false)).toEqual({ stade: '9', groupe: '9' })
    expect(relanceDepuisEtape('solde', false)).toEqual({ stade: '0', groupe: '0' })
  })

  it('un débiteur sous protocole d’accord (contentieux avec échéancier) passe au groupe 6', () => {
    expect(relanceDepuisEtape('procedure', true)).toEqual({ stade: '9', groupe: '6' })
  })
})

/**
 * Point 57 du bilan Gestéam : la particularité « avec / sans échéancier » et le groupe de relance 6 (protocole d'accord)
 * se DÉDUISENT de l'échéancier du débiteur (decompte-contentieux.suivreEcheancier). La particularité saisie n'est jamais
 * écrasée : l'écart est signalé. 🔵 Un échéancier reste actif tant qu'une échéance n'est pas soldée, échue ou non.
 */
describe('contentieux — échéancier actif, particularité, relance', () => {
  const echeances = genererEcheancier({ nombre: 3, tousLes: 1, unite: 'mois', premiereLe: '2026-04-05', montantCentimes: 100_000 })
  const suivi = (montantRegle: number, aujourdhui: string) =>
    suivreEcheancier(echeances, montantRegle > 0 ? [{ id: 'R1', date: '2026-04-05', montantCentimes: montantRegle }] : [], aujourdhui)
  const aVenir = suivi(0, '2026-03-01')
  const echueImpayee = suivi(100_000, '2026-05-10')
  const derniereImpayee = suivi(200_000, '2026-08-01')
  const partielle = suivi(250_000, '2026-08-01')
  const solde = suivi(300_000, '2026-08-01')
  const dossier = (surcharge: Partial<SaisieContentieux> = {}) => creerDossierContentieux(saisie(surcharge))

  it('les échéanciers de référence ont les statuts attendus', () => {
    const statuts = (s: ReturnType<typeof suivi>) => s.echeances.map((e) => e.statut)
    expect(statuts(aVenir)).toEqual(['a_venir', 'a_venir', 'a_venir'])
    expect(statuts(echueImpayee)).toEqual(['payee', 'impayee', 'a_venir'])
    expect(statuts(derniereImpayee)).toEqual(['payee', 'payee', 'impayee'])
    expect(statuts(partielle)).toEqual(['payee', 'payee', 'partielle'])
    expect(statuts(solde)).toEqual(['payee', 'payee', 'payee'])
  })

  it('un échéancier est actif tant qu’une échéance n’est pas soldée', () => {
    expect(echeancierActif(aVenir)).toBe(true)
    expect(echeancierActif(echueImpayee)).toBe(true)
    expect(echeancierActif(derniereImpayee)).toBe(true)
    expect(echeancierActif(partielle)).toBe(true)
    expect(echeancierActif(solde)).toBe(false)
  })

  it('aucun échéancier, ou un échéancier vide : inactif', () => {
    expect(echeancierActif(null)).toBe(false)
    expect(echeancierActif(undefined)).toBe(false)
    expect(echeancierActif(suivreEcheancier([], [], '2026-08-01'))).toBe(false)
  })

  it('particularité suggérée d’après l’échéancier, écart signalé sans écraser la saisie', () => {
    const sans = dossier()
    expect(particulariteSuggeree(sans, aVenir)).toEqual({ particularite: 'Contentieux avec échéancier', ecart: true })
    expect(sans.particularite).toBe('Contentieux sans échéancier')
    expect(particulariteSuggeree(sans, null)).toEqual({ particularite: 'Contentieux sans échéancier', ecart: false })
    const avec = dossier({ particularite: 'Contentieux avec échéancier' })
    expect(particulariteSuggeree(avec, echueImpayee)).toEqual({ particularite: 'Contentieux avec échéancier', ecart: false })
    expect(particulariteSuggeree(avec, null)).toEqual({ particularite: 'Contentieux sans échéancier', ecart: true })
    expect(particulariteSuggeree(avec, solde)).toEqual({ particularite: 'Contentieux sans échéancier', ecart: true })
  })

  it('relance du dossier : groupe 6 sous échéancier actif, sinon le groupe de l’étape', () => {
    const enProcedure = dossier({ jalons: { assignation: '2026-04-10' } })
    expect(relanceDuContentieux(enProcedure, null)).toEqual({ stade: '9', groupe: '9' })
    expect(relanceDuContentieux(enProcedure, aVenir)).toEqual({ stade: '9', groupe: '6' })
    expect(relanceDuContentieux(enProcedure, echueImpayee)).toEqual({ stade: '9', groupe: '6' })
    expect(relanceDuContentieux(enProcedure, solde)).toEqual({ stade: '9', groupe: '9' })
    expect(relanceDuContentieux(dossier(), aVenir)).toEqual({ stade: '1', groupe: '6' })
    expect(relanceDuContentieux(dossier({ dateCloture: '2026-09-01' }), aVenir)).toEqual({ stade: '0', groupe: '0' })
  })

  it('la relance suit l’échéancier, pas la particularité saisie', () => {
    const avecSaisi = dossier({ particularite: 'Contentieux avec échéancier', jalons: { assignation: '2026-04-10' } })
    expect(relanceDuContentieux(avecSaisi, null)).toEqual({ stade: '9', groupe: '9' })
  })

  it('aucune relance pour un autre type de contentieux', () => {
    expect(relanceDuContentieux(dossier({ type: 'Garantie décennale' }), aVenir)).toBeNull()
  })

  it('🔴 l’origine de l’échéancier n’est pas lue : des délais de grâce du juge donnent aussi le groupe 6', () => {
    const decision = { origine: 'delais_grace', decideLe: '2026-03-20', contradictoire: true } as const
    expect(controlerEcheancier(echeances, decision)).toEqual([])
    const juge = dossier({ jalons: { assignation: '2026-02-10', jugement: '2026-03-20' } })
    expect(relanceDuContentieux(juge, aVenir)).toEqual({ stade: '9', groupe: '6' })
    expect(particulariteSuggeree(juge, aVenir).particularite).toBe('Contentieux avec échéancier')
  })
})

describe('contentieux — en-tête du point 57 : sources et points ouverts', () => {
  // Les lignes de commentaire sont recollées : une phrase de l'en-tête peut courir sur plusieurs lignes.
  const source = readFileSync(
    join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'contentieux.ts'),
    'utf8',
  ).replaceAll(/\r?\n\s*\*\s*/g, ' ')

  it('la recherche négative sur l’échéancier se limite à la loi n° 65-557 et au décret n° 67-223', () => {
    expect(source).not.toMatch(/seuls existent/)
    expect(source).toMatch(/aucun texte de la loi n° 65-557 ni du décret n° 67-223 ne fixe la forme ni la durée/)
    expect(source).toMatch(/C\. civ\. art\. 1305-2 à 1305-4/)
    expect(source).toMatch(/L\. 732-1/)
    expect(source).toMatch(/n° 89-462, art\. 24, V et VI/)
  })

  it('les échelonnements de la loi ne se limitent pas à l’art. 29-5, V : les annuités de l’art. 33 sont citées', () => {
    expect(source).not.toMatch(/ils ne prévoient que les échéanciers individualisés/)
    expect(source).toMatch(/loi art\. 29-5, V/)
    expect(source).toMatch(/annuités égales au dixième de sa part des travaux/)
    expect(source).toMatch(/première mutation entre vifs de son lot/)
    expect(source).toMatch(/Le paiement par annuités de la loi art\. 33 n'a pas d'origine dans ORIGINES_ECHEANCIER/)
  })

  it('la Particularité n’est lue que comme critère de recherche ; son lieu de saisie est une question', () => {
    expect(source).not.toMatch(/est saisie et sert de critère de recherche/)
    expect(source).toMatch(/tranches 20 § 3 et 28/)
    expect(source).toMatch(/Où se saisit la Particularité/)
  })

  it('les questions sur le groupe 6 citent l’origine de l’échéancier déjà modélisée', () => {
    expect(source).toMatch(/ORIGINES_ECHEANCIER/)
    expect(source).toMatch(/DecisionEcheancier\.origine/)
    expect(source).toMatch(/Quelles origines mettent le débiteur au groupe 6/)
    expect(source).not.toMatch(/distincts de l'échéancier amiable du bloc Échéancier/)
  })
})
