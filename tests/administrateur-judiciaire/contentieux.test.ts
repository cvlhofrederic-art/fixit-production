import { describe, expect, it } from 'vitest'
import {
  GROUPES_RELANCE,
  JALONS_PROCEDURE,
  STADES_RELANCE,
  controlerChronologieContentieux,
  creerDossierContentieux,
  etapeRecouvrementContentieux,
  phaseSuggeree,
  relanceDepuisEtape,
  type SaisieContentieux,
} from '@/lib/administrateur-judiciaire/domain/contentieux'

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
