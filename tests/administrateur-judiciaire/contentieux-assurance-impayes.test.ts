import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AVERTISSEMENT_REPERE_POLICE_IMPAYES,
  FAITS_GENERATEURS_IMPAYES,
  LIBELLE_COMPTE_ATTENTE_ASSUREUR,
  LIBELLES_FAITS_GENERATEURS_IMPAYES,
  POLICE_IMPAYES_NON_RENSEIGNEE,
  SANS_ASSURANCE_IMPAYES,
  TYPES_SINISTRE_IMPAYES,
  UNITES_DELAI_POLICE_IMPAYES,
  controlerAssuranceImpayes,
  creerAssuranceImpayes,
  creerPoliceAssuranceImpayes,
  repereDeclarationImpayes,
  ventilerSoldeImpayes,
  vueAssuranceImpayes,
  type AssuranceImpayesContentieux,
  type PoliceAssuranceImpayes,
  type SaisiePoliceAssuranceImpayes,
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
    // Question fermée par la décision du 20/11/2026 (partie C, F51) : la qualification se fait sur la police.
    expect(source).toMatch(/qualification de la garantie \(opération d'assurance crédit ou non\) se fait à la lecture de la police/)
    expect(source).not.toMatch(/assureur de biens/)
    expect(source).toMatch(/assurances de dommages/)
  })

  it('J67, R47 : la souscription sous administration provisoire suit la mission de l’ordonnance ; la question 3 ne garde que le lien avec le contrat', () => {
    const decision = source.slice(source.indexOf('Décision de Hugo du 17/11/2026'), source.indexOf('🔵 Déduit'))
    expect(decision).toMatch(/J67, R47/)
    expect(decision).toMatch(/controlerSouscriptionAssuranceImpayes/)
    expect(decision).toMatch(/D\. 1967 art\. 62-7/)
    expect(decision).toMatch(/enregistrement : à brancher/)
    expect(source).not.toMatch(/la souscription d'une police au nom du syndicat suit-elle la mission de l'ordonnance/)
    expect(source).toMatch(/La case « Couverture impayés » découle-t-elle d'un contrat d'assurance du mandat/)
  })

  it('J32 : le bouton « Historique » trace l’historique du dossier de contentieux ; aucun historique dans le domaine, dit sans écran', () => {
    const decisions = source.slice(source.indexOf('Décisions de Hugo du 03/11/2026'), source.indexOf('🔵 Déduit'))
    expect(decisions).toMatch(/J32/)
    expect(decisions).toMatch(/historique du dossier de contentieux/)
    expect(decisions).toMatch(/aucun historique du dossier de contentieux/)
    expect(source).not.toMatch(/Que trace le bouton « Historique »/)
  })
})

// ─── Décisions du 20/11/2026 (partie C, F51 et F52) ─────────────────────────────────────────

describe('F51 — police impayés : délai de déclaration et fait qui déclenche le sinistre, repère « selon la police »', () => {
  const remplie = (surcharge: Partial<SaisiePoliceAssuranceImpayes> = {}): PoliceAssuranceImpayes =>
    creerPoliceAssuranceImpayes({ delaiDeclaration: { nombre: 30, unite: 'jours' }, faitGenerateur: 'premiere_echeance_impayee', ...surcharge })

  it('les cinq faits de la décision, dans son ordre, et leurs libellés', () => {
    expect(FAITS_GENERATEURS_IMPAYES).toEqual([
      'premiere_echeance_impayee',
      'mise_en_demeure_sans_effet',
      'decision_de_justice',
      'seuil_de_dette',
      'autre',
    ])
    expect(FAITS_GENERATEURS_IMPAYES.map((fait) => LIBELLES_FAITS_GENERATEURS_IMPAYES[fait])).toEqual([
      'Première échéance impayée',
      'Mise en demeure restée sans effet',
      'Décision de justice',
      'Seuil de dette',
      'Autre',
    ])
    expect(UNITES_DELAI_POLICE_IMPAYES).toEqual(['jours', 'jours_ouvres', 'mois'])
  })

  it('par défaut, les deux champs sont vides et la police n’est pas lue', () => {
    expect(POLICE_IMPAYES_NON_RENSEIGNEE).toEqual({ delaiDeclaration: null, faitGenerateur: null, lue: false })
    expect(creerPoliceAssuranceImpayes({})).toEqual(POLICE_IMPAYES_NON_RENSEIGNEE)
  })

  it('choix actuel gardé : aucun délai calculé tant que les deux champs ne sont pas remplis', () => {
    for (const police of [
      POLICE_IMPAYES_NON_RENSEIGNEE,
      creerPoliceAssuranceImpayes({ delaiDeclaration: { nombre: 30, unite: 'jours' } }),
      creerPoliceAssuranceImpayes({ faitGenerateur: 'decision_de_justice' }),
    ]) {
      const repere = repereDeclarationImpayes(police, { dateFaitGenerateur: '2026-02-01', declareLe: null, aujourdhui: AUJOURDHUI })
      expect(repere).toMatchObject({ etat: 'sans_repere', date: null, retardJours: 0 })
      expect(repere.message).toMatch(/aucun délai de déclaration calculé/i)
    }
  })

  it('champs remplis, date du fait non renseignée : pas de repère, le message dit quel fait dater', () => {
    const repere = repereDeclarationImpayes(remplie({ faitGenerateur: 'mise_en_demeure_sans_effet' }), {
      dateFaitGenerateur: null,
      declareLe: null,
      aujourdhui: AUJOURDHUI,
    })
    expect(repere).toMatchObject({ etat: 'sans_repere', date: null })
    expect(repere.message).toContain('« Mise en demeure restée sans effet »')
  })

  it('repère du fait + délai : jours calendaires, jours ouvrés (11 novembre exclu), mois au même quantième', () => {
    const date = (police: PoliceAssuranceImpayes, dateFaitGenerateur: string) =>
      repereDeclarationImpayes(police, { dateFaitGenerateur, declareLe: null, aujourdhui: '2026-01-01' }).date
    expect(date(remplie(), '2026-02-01')).toBe('2026-03-03')
    expect(date(remplie({ delaiDeclaration: { nombre: 5, unite: 'jours_ouvres' } }), '2026-11-06')).toBe('2026-11-16')
    expect(date(remplie({ delaiDeclaration: { nombre: 1, unite: 'mois' } }), '2026-01-31')).toBe('2026-02-28')
  })

  it('états : à déclarer, repère dépassé, dans le repère, après le repère (signal, jamais une déchéance)', () => {
    const etat = (declareLe: string | null, aujourdhui: string) =>
      repereDeclarationImpayes(remplie(), { dateFaitGenerateur: '2026-02-01', declareLe, aujourdhui })
    expect(etat(null, '2026-03-03')).toMatchObject({ etat: 'a_declarer', date: '2026-03-03', retardJours: 0 })
    expect(etat(null, '2026-03-05')).toMatchObject({ etat: 'repere_depasse', retardJours: 2 })
    expect(etat('2026-03-03', '2026-10-29')).toMatchObject({ etat: 'dans_le_repere', retardJours: 0 })
    const apres = etat('2026-03-10', '2026-10-29')
    expect(apres).toMatchObject({ etat: 'apres_le_repere', retardJours: 7, selonLaPolice: true })
    expect(apres.message).toMatch(/selon la police/)
    expect(apres.avertissement).toBe(AVERTISSEMENT_REPERE_POLICE_IMPAYES)
    expect(AVERTISSEMENT_REPERE_POLICE_IMPAYES).toMatch(/jamais une déchéance/)
    expect(apres.message).not.toMatch(/tardive|déchu|déchéance encourue/i)
  })

  it('refuse un délai mal formé, un fait inconnu, une date du fait ou du jour non ISO', () => {
    expect(() => creerPoliceAssuranceImpayes({ delaiDeclaration: { nombre: 0, unite: 'jours' } })).toThrow(/délai/i)
    expect(() => creerPoliceAssuranceImpayes({ delaiDeclaration: { nombre: 2.5, unite: 'mois' } })).toThrow(/délai/i)
    expect(() => creerPoliceAssuranceImpayes({ delaiDeclaration: { nombre: 5, unite: 'semaines' as never } })).toThrow(/unité/i)
    expect(() => creerPoliceAssuranceImpayes({ faitGenerateur: 'jugement' as never })).toThrow(/fait/i)
    expect(() => creerPoliceAssuranceImpayes({ lue: 'oui' as never })).toThrow(/lue/i)
    expect(() =>
      repereDeclarationImpayes(remplie(), { dateFaitGenerateur: '01/02/2026', declareLe: null, aujourdhui: AUJOURDHUI }),
    ).toThrow(/fait/i)
    expect(() =>
      repereDeclarationImpayes(remplie(), { dateFaitGenerateur: '2026-02-01', declareLe: '2026-02-30', aujourdhui: AUJOURDHUI }),
    ).toThrow(/déclaration/i)
    expect(() =>
      repereDeclarationImpayes(remplie(), { dateFaitGenerateur: '2026-02-01', declareLe: null, aujourdhui: '29/10/2026' }),
    ).toThrow(/date/i)
  })
})

describe('F52 — indemnité de l’assureur impayés : à part par défaut, ventilée une fois la police lue', () => {
  const lue = creerPoliceAssuranceImpayes({ lue: true })
  const ventiler = (soldeDuCentimes: number, recupereDepuisIndemniteCentimes: number, indemniteRegleeCentimes = 120_000) =>
    ventilerSoldeImpayes(lue, { soldeDuCentimes, indemniteRegleeCentimes, recupereDepuisIndemniteCentimes })

  it('par défaut (police non lue) : l’indemnité s’affiche à part, ni déduite du solde dû, ni imputée comme un règlement', () => {
    const vue = ventilerSoldeImpayes(POLICE_IMPAYES_NON_RENSEIGNEE, {
      soldeDuCentimes: 300_000,
      indemniteRegleeCentimes: 120_000,
      recupereDepuisIndemniteCentimes: 50_000,
    })
    expect(vue).toMatchObject({
      ventilee: false,
      soldeDuParLeDebiteurCentimes: 300_000,
      dontPartSyndicatCentimes: null,
      dontPartAssureurCentimes: null,
      aReverserAssureurCentimes: 0,
      indemniteRegleeCentimes: 120_000,
    })
    expect(vue.message).toMatch(/à part/)
    expect(vue.message).toMatch(/ni déduite du solde dû, ni imputée comme un règlement du débiteur/)
  })

  it('police lue, rien récupéré depuis l’indemnité : solde inchangé, dont part du syndicat et dont part de l’assureur', () => {
    expect(ventiler(300_000, 0)).toMatchObject({
      ventilee: true,
      soldeDuParLeDebiteurCentimes: 300_000,
      dontPartSyndicatCentimes: 180_000,
      dontPartAssureurCentimes: 120_000,
      aReverserAssureurCentimes: 0,
    })
  })

  it('le récupéré va d’abord à la part du syndicat (C. civ. art. 1346-3)', () => {
    expect(ventiler(250_000, 50_000)).toMatchObject({
      dontPartSyndicatCentimes: 130_000,
      dontPartAssureurCentimes: 120_000,
      aReverserAssureurCentimes: 0,
    })
  })

  it('au-delà de la part du syndicat : compte d’attente « à reverser à l’assureur », jusqu’à décision', () => {
    const vue = ventiler(100_000, 200_000)
    expect(vue).toMatchObject({
      soldeDuParLeDebiteurCentimes: 100_000,
      dontPartSyndicatCentimes: 0,
      dontPartAssureurCentimes: 100_000,
      aReverserAssureurCentimes: 20_000,
    })
    expect(vue.message).toMatch(/à reverser à l'assureur/)
    expect(vue.message).toMatch(/jusqu'à décision/)
    expect(LIBELLE_COMPTE_ATTENTE_ASSUREUR).toBe("À reverser à l'assureur")
  })

  it('la part de l’assureur ne dépasse ni son paiement ni la créance (C. civ. art. 1346-4)', () => {
    expect(ventiler(50_000, 0)).toMatchObject({ dontPartSyndicatCentimes: 0, dontPartAssureurCentimes: 50_000 })
    expect(ventiler(300_000, 0, 0)).toMatchObject({ dontPartSyndicatCentimes: 300_000, dontPartAssureurCentimes: 0 })
  })

  it('solde négatif (excédent du débiteur) : aucune part restante, l’excédent n’est pas à l’assureur', () => {
    expect(ventiler(-10_000, 310_000)).toMatchObject({
      soldeDuParLeDebiteurCentimes: -10_000,
      dontPartSyndicatCentimes: 0,
      dontPartAssureurCentimes: 0,
      aReverserAssureurCentimes: 120_000,
    })
  })

  it('les parts restantes font toujours le solde dû, quand il est positif ou nul', () => {
    for (const [solde, recupere] of [
      [300_000, 0],
      [250_000, 50_000],
      [100_000, 200_000],
      [0, 300_000],
    ]) {
      const vue = ventiler(solde, recupere)
      expect((vue.dontPartSyndicatCentimes ?? 0) + (vue.dontPartAssureurCentimes ?? 0)).toBe(solde)
    }
  })

  it('montants en centimes entiers ; récupéré et indemnité positifs', () => {
    expect(() => ventiler(100.5, 0)).toThrow(/centimes/i)
    expect(() => ventiler(100_000, -1)).toThrow(/centimes/i)
    expect(() => ventiler(100_000, 0, -5)).toThrow(/centimes/i)
  })
})

describe('en-tête : décisions du 20/11/2026 (partie C, F51 et F52)', () => {
  const source = readFileSync(
    join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'contentieux-assurance-impayes.ts'),
    'utf8',
  ).replaceAll(/\r?\n\s*\*\s*/g, ' ')

  it('les deux décisions sont citées ; les questions 1 et 2 sont fermées, la 3 reste ouverte', () => {
    expect(source).toContain('Décision du 20/11/2026 (partie C, F51)')
    expect(source).toContain('Décision du 20/11/2026 (partie C, F52)')
    expect(source).not.toMatch(/La police impayés du cabinet est-elle une opération d'assurance crédit \?/)
    expect(source).not.toMatch(/la police prévoit-elle une subrogation de l'assureur/)
    expect(source).not.toMatch(/\(🔴 1 et 2\)|\(🔴 2\)/)
    expect(source).toMatch(/La case « Couverture impayés » découle-t-elle d'un contrat d'assurance du mandat/)
  })

  it('le décompte renvoie à la ventilation, sans déduire l’indemnité (F52)', () => {
    const decompte = readFileSync(
      join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'decompte-contentieux.ts'),
      'utf8',
    ).replaceAll(/\r?\n\s*\*\s*/g, ' ')
    expect(decompte).toContain('Décision du 20/11/2026 (partie C, F52)')
    expect(decompte).toMatch(/ventilerSoldeImpayes ; le solde dû reste inchangé/)
  })

  it('sinistres.ts ne renvoie plus à la question 1 fermée : il cite la décision F51', () => {
    const sinistres = readFileSync(
      join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'sinistres.ts'),
      'utf8',
    ).replaceAll(/\r?\n\s*\*\s*/g, ' ')
    expect(sinistres).not.toMatch(/🔴 1, non tranché/)
    expect(sinistres).toContain('Décision du 20/11/2026 (partie C, F51)')
    expect(sinistres).toMatch(/repereDeclarationImpayes/)
  })
})
