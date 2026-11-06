import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  GROUPES_RELANCE,
  JALONS_PROCEDURE,
  SOURCES_ECHEANCIER,
  STADES_RELANCE,
  controlerChronologieContentieux,
  creerDossierContentieux,
  echeancierActif,
  echeancierDuContentieux,
  etapeRecouvrementContentieux,
  phaseSuggeree,
  relanceDepuisEtape,
  relanceDuContentieux,
  type SaisieContentieux,
} from '@/lib/administrateur-judiciaire/domain/contentieux'
import { creerVoiesExecution } from '@/lib/administrateur-judiciaire/domain/contentieux-voies-execution'
import {
  controlerEcheancier,
  genererEcheancier,
  suivreEcheancier,
} from '@/lib/administrateur-judiciaire/domain/decompte-contentieux'

/**
 * Contentieux (cartographie Gestéam, tranches 20, 27 et 28) : dossier, intervenants (huissier, avocat, expert),
 * jalons de procédure datés, phase, lien avec le recouvrement et les stades / groupes de relance.
 * - Type et phase : référentiels Gestéam existants (TYPE_CONTENTIEUX, PHASE_CONTENTIEUX). La Particularité de Gestéam
 *   n'est pas reprise (décision J44 de Hugo du 06/11/2026).
 * - La phase est SAISIE ; VitFix en SUGGÈRE une d'après les faits datés et signale l'écart, sans l'écraser.
 */

const saisie = (surcharge: Partial<SaisieContentieux> = {}): SaisieContentieux => ({
  coproprieteId: 'copro-1',
  type: 'Recouvrement de charges/loyer',
  phase: 'Ouverture',
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

  it('J44 : la Particularité du contentieux est supprimée : le dossier se crée sans elle et n’en porte aucune', async () => {
    const dossier = creerDossierContentieux(saisie())
    expect(dossier).not.toHaveProperty('particularite')
    const exportsDuModule = await import('@/lib/administrateur-judiciaire/domain/contentieux')
    expect(exportsDuModule).not.toHaveProperty('particulariteSuggeree')
  })

  it('refuse type ou phase inconnus, une date invalide, un montant non entier', () => {
    expect(() => creerDossierContentieux(saisie({ type: 'Litige' as never }))).toThrow(/type/i)
    expect(() => creerDossierContentieux(saisie({ phase: 'Audience' as never }))).toThrow(/phase/i)
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
 * Point 57 du bilan Gestéam : le groupe de relance 6 (protocole d'accord) se DÉDUIT de l'échéancier du débiteur
 * (decompte-contentieux.suivreEcheancier, ou case « Échéancier » : J33). La Particularité « avec / sans échéancier » de
 * Gestéam n'est pas reprise (J44). 🔵 Un échéancier reste actif tant qu'une échéance n'est pas soldée, échue ou non.
 */
describe('contentieux — échéancier actif et relance', () => {
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

  it('relance du dossier : groupe 6 sous échéancier actif, sinon le groupe de l’étape', () => {
    const enProcedure = dossier({ jalons: { assignation: '2026-04-10' } })
    expect(relanceDuContentieux(enProcedure, null)).toEqual({ stade: '9', groupe: '9' })
    expect(relanceDuContentieux(enProcedure, aVenir)).toEqual({ stade: '9', groupe: '6' })
    expect(relanceDuContentieux(enProcedure, echueImpayee)).toEqual({ stade: '9', groupe: '6' })
    expect(relanceDuContentieux(enProcedure, solde)).toEqual({ stade: '9', groupe: '9' })
    expect(relanceDuContentieux(dossier(), aVenir)).toEqual({ stade: '1', groupe: '6' })
    expect(relanceDuContentieux(dossier({ dateCloture: '2026-09-01' }), aVenir)).toEqual({ stade: '0', groupe: '0' })
  })

  it('J44 : sans Particularité, la relance ne lit que l’échéancier (grille ou case « Échéancier »), comme avant', () => {
    const enProcedure = dossier({ jalons: { assignation: '2026-04-10' } })
    expect(relanceDuContentieux(enProcedure, null)).toEqual({ stade: '9', groupe: '9' })
    const caseCochee = dossier({ jalons: { assignation: '2026-04-10' }, voiesExecution: creerVoiesExecution({ caseEcheancier: true }) })
    expect(relanceDuContentieux(caseCochee, null)).toEqual({ stade: '9', groupe: '6' })
  })

  it('aucune relance pour un autre type de contentieux', () => {
    expect(relanceDuContentieux(dossier({ type: 'Garantie décennale' }), aVenir)).toBeNull()
  })

  it('🔴 l’origine de l’échéancier n’est pas lue : des délais de grâce du juge donnent aussi le groupe 6', () => {
    const decision = { origine: 'delais_grace', decideLe: '2026-03-20', contradictoire: true } as const
    expect(controlerEcheancier(echeances, decision)).toEqual([])
    const juge = dossier({ jalons: { assignation: '2026-02-10', jugement: '2026-03-20' } })
    expect(relanceDuContentieux(juge, aVenir)).toEqual({ stade: '9', groupe: '6' })
    expect(echeancierDuContentieux(juge, aVenir)).toEqual({ actif: true, source: 'grille', grilleActive: true })
  })

  /**
   * Décision J33 de Hugo (03/11/2026) : la case « Échéancier » du bloc Voie d'exécution désigne l'échéancier fixé par
   * décision du juge (délais de grâce, C. civ. art. 1343-5). Cochée, elle rend l'échéancier actif, source « décision du
   * juge » ; la grille du bloc Échéancier reste lue comme avant.
   */
  describe('J33 — case « Échéancier » : échéancier fixé par décision du juge', () => {
    const avecCase = (surcharge: Partial<SaisieContentieux> = {}) =>
      dossier({ voiesExecution: creerVoiesExecution({ caseEcheancier: true }), ...surcharge })
    const enProcedure = { jalons: { assignation: '2026-02-10', jugement: '2026-03-20' } }

    it('sans case ni grille active : aucun échéancier ; grille seule : actif, source « grille »', () => {
      expect(echeancierDuContentieux(dossier(), null)).toEqual({ actif: false, source: null, grilleActive: false })
      expect(echeancierDuContentieux(dossier(), solde)).toEqual({ actif: false, source: null, grilleActive: false })
      expect(echeancierDuContentieux(dossier(), aVenir)).toEqual({ actif: true, source: 'grille', grilleActive: true })
      const caseDecochee = dossier({ voiesExecution: creerVoiesExecution({ caseEcheancier: false }) })
      expect(echeancierDuContentieux(caseDecochee, echueImpayee)).toEqual({ actif: true, source: 'grille', grilleActive: true })
    })

    it('case cochée : échéancier actif, source « décision du juge », avec ou sans grille', () => {
      expect(echeancierDuContentieux(avecCase(), null)).toEqual({ actif: true, source: 'decision_du_juge', grilleActive: false })
      expect(echeancierDuContentieux(avecCase(), aVenir)).toEqual({ actif: true, source: 'decision_du_juge', grilleActive: true })
      expect(SOURCES_ECHEANCIER.decision_du_juge).toMatch(/délais de grâce, C\. civ\. art\. 1343-5/)
    })

    it('🔵 conséquence sur la grille existante : cochée, la case garde l’échéancier actif même grille soldée', () => {
      expect(echeancierDuContentieux(avecCase(), solde)).toEqual({ actif: true, source: 'decision_du_juge', grilleActive: false })
      expect(echeancierActif(solde)).toBe(false)
    })

    it('la case donne le groupe 6, sans grille ou grille soldée, sans passer par une Particularité (J44)', () => {
      expect(relanceDuContentieux(avecCase(enProcedure), null)).toEqual({ stade: '9', groupe: '6' })
      expect(relanceDuContentieux(avecCase(enProcedure), solde)).toEqual({ stade: '9', groupe: '6' })
      expect(relanceDuContentieux(dossier(enProcedure), solde)).toEqual({ stade: '9', groupe: '9' })
    })

    it('la case n’est pas une mesure d’exécution : la phase suggérée n’en dépend pas', () => {
      expect(phaseSuggeree(avecCase(enProcedure))).toEqual(phaseSuggeree(dossier(enProcedure)))
    })
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

  it('J44 : la Particularité, critère de recherche observé dans Gestéam, n’est pas reprise ; sa question 🔴 disparaît', () => {
    expect(source).not.toMatch(/est saisie et sert de critère de recherche/)
    expect(source).toMatch(/tranches 20 § 3 et 28/)
    expect(source).not.toMatch(/Où se saisit la Particularité/)
    expect(source).not.toMatch(/particulariteSuggeree|ParticulariteContentieux|particularite:/)
  })

  it('rubrique « Décisions de Hugo du 03/11/2026 » : J33 inscrite, art. 1343-5 relu', () => {
    const decisions = source.slice(source.indexOf('Décisions de Hugo du 03/11/2026'), source.indexOf('Point 56 du bilan Gestéam'))
    expect(decisions).toMatch(/J33/)
    expect(decisions).toMatch(/C\. civ\. art\. 1343-5/)
    expect(decisions).toMatch(/relu sur Légifrance le 03\/11\/2026/)
    expect(decisions).toMatch(/« dans la limite de deux années »/)
    expect(source).not.toMatch(/désigne-t-elle les délais de grâce accordés par/)
  })

  it('rubrique « Décisions de Hugo du 06/11/2026 » : J43 (exécution engagée sous échéancier du juge signalée) et J44 (Particularité supprimée)', () => {
    const decisions0611 = source.slice(source.indexOf('Décisions de Hugo du 06/11/2026'), source.indexOf('Point 56 du bilan Gestéam'))
    expect(decisions0611).toMatch(/J43 : /)
    expect(decisions0611).toMatch(/controlerExecutionSousEcheancierDuJuge/)
    expect(decisions0611).toMatch(/C\. civ\. art\. 1343-5, al\. 4/)
    // La gravité et la relecture du 06/11/2026 sont justifiées dans l'en-tête de contentieux-voies-execution.ts, pas ici.
    expect(decisions0611).toMatch(/relu sur Légifrance le 06\/11\/2026 : en-tête de contentieux-voies-execution\.ts\)/)
    expect(decisions0611).not.toMatch(/en-tête de ce module/)
    expect(decisions0611).toMatch(/J44 : la « Particularité » du contentieux est supprimée/)
    expect(decisions0611).toMatch(/echeancierDuContentieux et relanceDuContentieux/)
    expect(source).not.toMatch(/faut-il signaler une mesure d'exécution engagée/)
    expect(source).not.toMatch(/La « Particularité » \(question 25\) reste ouverte/)
  })

  it('les questions sur le groupe 6 citent l’origine de l’échéancier déjà modélisée', () => {
    expect(source).toMatch(/ORIGINES_ECHEANCIER/)
    expect(source).toMatch(/DecisionEcheancier\.origine/)
    expect(source).toMatch(/Quelles origines mettent le débiteur au groupe 6/)
    expect(source).not.toMatch(/distincts de l'échéancier amiable du bloc Échéancier/)
  })
})
