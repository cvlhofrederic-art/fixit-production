import { describe, expect, it } from 'vitest'
import {
  AVERTISSEMENT_DELAI_CATASTROPHE_NATURELLE,
  AVERTISSEMENT_DELAI_DECLARATION,
  controlerCourriersDeclaration,
  controlerDelaiDeclaration,
  courriersDeDeclaration,
  estModeleDeclarationSinistre,
  ficheAvecDateDeclaration,
  GABARITS_DECLARATION_SINISTRE,
  proposerDateDeclaration,
  type CourrierDeSinistre,
  type SinistreIdentifie,
} from '@/lib/administrateur-judiciaire/domain/declaration-sinistre'
import { ajouterJours, estJourOuvrable, jourSemaine } from '@/lib/administrateur-judiciaire/domain/dates'
import { creerRattachement } from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import { modeleCourrierDepuisGabarit } from '@/lib/administrateur-judiciaire/domain/gabarits-courrier'
import {
  creerSinistre,
  etapeSuiviSinistre,
  PHASES_APRES_DECLARATION,
  type SaisieSinistre,
} from '@/lib/administrateur-judiciaire/domain/sinistres'
import { depuisSinistres } from '@/lib/administrateur-judiciaire/domain/suivi-a-faire'
import { PHASE_SINISTRE } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Point 58 du bilan 2 : date de déclaration d'un sinistre tirée du courrier de déclaration rattaché, sans écraser une date
 * saisie, et contrôle du délai de déclaration (signal, jamais une déchéance).
 * - Gestéam T42 : un courrier « DÉCLARATION » (archivé) existe sur la fiche, la date Déclaration du suivi reste vide.
 * - T43 § 22 : la famille Sinistre contient « déclaration », « déclaration sinistre DO (AR) », mais aussi « accusé
 *   déclaration copro » et « relance dossier », qui ne sont pas des déclarations à l'assureur.
 * - Repères : C. assur. art. L. 113-2, 4° (5 jours ouvrés, 2 pour le vol, ou le délai du contrat s'il est plus long),
 *   art. L. 125-2 (catastrophe naturelle : 30 jours après la publication de l'arrêté).
 */

const saisie = (surcharge: Partial<SaisieSinistre> = {}): SaisieSinistre => ({
  coproprieteId: 'copro-1',
  type: 'Dégât des eaux',
  phase: null,
  dateSurvenance: '2026-10-27',
  dateConnaissance: null,
  dateDeclaration: null,
  dateExpertise: null,
  dateRapport: null,
  dateReglement: null,
  dateCloture: null,
  partiesCommunesLesees: true,
  partiesCommunesResponsables: false,
  origine: 'Fuite sur colonne',
  lieu: 'Cage B',
  dommages: 'Plafond du palier',
  assurance: { compagnie: null, courtier: null, contrat: null, numeroSinistre: null },
  indemniteImmediateCentimes: 0,
  indemniteImmediateReglee: false,
  indemniteDiffereeCentimes: 0,
  indemniteDiffereeReglee: false,
  causesSupprimees: false,
  reparationsFaites: false,
  ...surcharge,
})

const sinistre = (surcharge: Partial<SaisieSinistre> = {}, id = 'sin-1'): SinistreIdentifie => ({
  id,
  fiche: creerSinistre(saisie(surcharge)),
})

const courrier = (surcharge: Partial<CourrierDeSinistre> = {}): CourrierDeSinistre => ({
  id: 'c-1',
  modele: { famille: 'Sinistre', libelle: 'déclaration' },
  rattachements: [creerRattachement('Copropriété', 'copro-1'), creerRattachement('Sinistre', 'sin-1')],
  formeEnvoi: 'AR',
  dateDepot: '2026-10-28',
  datePremierePresentation: '2026-10-29',
  dateAccuseReception: null,
  ...surcharge,
})

/** Date du jour, obligatoire : postérieure à tous les dépôts des courriers de ces tests, sauf mention contraire. */
const JOUR = { aujourdhui: '2026-11-20' }

describe('point 58 — reconnaître le courrier de déclaration par son modèle', () => {
  it('les deux gabarits de déclaration du registre', () => {
    expect(GABARITS_DECLARATION_SINISTRE).toEqual(['declaration_sinistre', 'declaration_sinistre_do'])
  })

  it('libellé Gestéam, objet VitFix, variante DO, sans égard à la casse ni aux accents', () => {
    for (const libelle of ['déclaration', 'DÉCLARATION', 'Déclaration de sinistre', 'déclaration sinistre DO (AR)'])
      expect(estModeleDeclarationSinistre({ famille: 'Sinistre', libelle })).toBe(true)
    expect(estModeleDeclarationSinistre(modeleCourrierDepuisGabarit('declaration_sinistre'))).toBe(true)
    expect(estModeleDeclarationSinistre(modeleCourrierDepuisGabarit('declaration_sinistre_do'))).toBe(true)
  })

  it('exclut l’accusé au copropriétaire, la relance, la contestation et les autres familles', () => {
    for (const libelle of ['accusé déclaration copro', 'relance dossier', 'contestation expertise (AR)', 'courrier simple'])
      expect(estModeleDeclarationSinistre({ famille: 'Sinistre', libelle })).toBe(false)
    expect(estModeleDeclarationSinistre({ famille: 'Gestion', libelle: 'déclaration' })).toBe(false)
    expect(estModeleDeclarationSinistre(modeleCourrierDepuisGabarit('contestation_expertise'))).toBe(false)
  })
})

describe('point 58 — courriers de déclaration d’un sinistre', () => {
  it('seuls les courriers rattachés à CE sinistre comptent (ni un autre sinistre, ni la seule copropriété)', () => {
    const retenus = courriersDeDeclaration('sin-1', [
      courrier({ id: 'a' }),
      courrier({ id: 'b', rattachements: [creerRattachement('Sinistre', 'sin-2')] }),
      courrier({ id: 'c', rattachements: [creerRattachement('Copropriété', 'copro-1')] }),
      courrier({ id: 'd', modele: { famille: 'Sinistre', libelle: 'relance dossier' } }),
    ])
    expect(retenus.map((c) => c.id)).toEqual(['a'])
  })

  it('ignore un courrier non déposé ou mal daté ; retient un courrier archivé (T42)', () => {
    const retenus = courriersDeDeclaration('sin-1', [
      courrier({ id: 'prepare', dateDepot: null, datePremierePresentation: null }),
      courrier({ id: 'faux', dateDepot: '2026-02-30' }),
      courrier({ id: 'archive', statut: 'Archivé' }),
    ])
    expect(retenus.map((c) => c.id)).toEqual(['archive'])
  })

  it('trie par dépôt croissant, puis par identifiant', () => {
    const retenus = courriersDeDeclaration('sin-1', [
      courrier({ id: 'z', dateDepot: '2026-10-30' }),
      courrier({ id: 'b', dateDepot: '2026-10-28' }),
      courrier({ id: 'a', dateDepot: '2026-10-28' }),
    ])
    expect(retenus.map((c) => c.id)).toEqual(['a', 'b', 'z'])
  })
})

describe('point 58 — proposition de date de déclaration', () => {
  it('aucun courrier de déclaration déposé', () => {
    expect(proposerDateDeclaration(sinistre(), [], JOUR)).toEqual({ nature: 'aucun_courrier', sinistreId: 'sin-1' })
  })

  it('date vide : propose le DÉPÔT du premier courrier, avec sa forme et sa première présentation', () => {
    expect(proposerDateDeclaration(sinistre(), [courrier({ id: 'c-2', dateDepot: '2026-10-30' }), courrier()], JOUR)).toEqual({
      nature: 'a_reporter',
      sinistreId: 'sin-1',
      date: '2026-10-28',
      courrierId: 'c-1',
      formeEnvoi: 'AR',
      datePremierePresentation: '2026-10-29',
    })
  })

  it('date saisie égale au dépôt : conforme', () => {
    expect(proposerDateDeclaration(sinistre({ dateDeclaration: '2026-10-28' }), [courrier()], JOUR)).toEqual({
      nature: 'conforme',
      sinistreId: 'sin-1',
      date: '2026-10-28',
      courrierId: 'c-1',
    })
  })

  it('date saisie différente : écart signalé, la date saisie n’est jamais remplacée', () => {
    const proposition = proposerDateDeclaration(sinistre({ dateDeclaration: '2026-10-29' }), [courrier()], JOUR)
    expect(proposition).toMatchObject({ nature: 'ecart', dateSaisie: '2026-10-29', dateCourrier: '2026-10-28', courrierId: 'c-1' })
    expect(proposition.nature === 'ecart' && proposition.message).toMatch(/29\/10\/2026.*28\/10\/2026/)
  })

  it('avec la date du jour, ne propose pas un dépôt daté après aujourd’hui', () => {
    const futur = [courrier({ dateDepot: '2026-11-02', datePremierePresentation: null })]
    expect(proposerDateDeclaration(sinistre(), futur, { aujourdhui: '2026-10-29' })).toEqual({ nature: 'aucun_courrier', sinistreId: 'sin-1' })
    expect(proposerDateDeclaration(sinistre(), futur, { aujourdhui: '2026-11-02' })).toMatchObject({ nature: 'a_reporter', date: '2026-11-02' })
    expect(() => proposerDateDeclaration(sinistre(), futur, { aujourdhui: '02/11/2026' })).toThrow(/jour/i)
  })

  it('la date du jour est obligatoire : sans elle, ni proposition ni contrôle des courriers (constats 9 et 10)', () => {
    const s = sinistre()
    const futur = [courrier({ dateDepot: '2026-11-02', datePremierePresentation: null })]
    // @ts-expect-error — la date du jour est obligatoire
    expect(() => proposerDateDeclaration(s, futur)).toThrow()
    expect(() => proposerDateDeclaration(s, futur, {} as never)).toThrow(/date du jour/i)
    // @ts-expect-error — la date du jour est obligatoire
    expect(() => controlerCourriersDeclaration(s, futur)).toThrow()
    expect(() => controlerCourriersDeclaration(s, futur, {} as never)).toThrow(/date du jour/i)
  })

  it('constat 10 : un dépôt daté après aujourd’hui n’est jamais reporté, l’alerte « à déclarer » demeure', () => {
    const s = sinistre()
    const futur = [courrier({ dateDepot: '2026-11-02', datePremierePresentation: null })]
    const options = { aujourdhui: '2026-10-29' }
    expect(controlerDelaiDeclaration(s, futur, options).etat).toBe('a_declarer')
    const fiche = ficheAvecDateDeclaration(s, proposerDateDeclaration(s, futur, options))
    expect(fiche).toBe(s.fiche)
    expect(fiche.dateDeclaration).toBeNull()
    expect(controlerDelaiDeclaration({ id: s.id, fiche }, futur, options).etat).toBe('a_declarer')
    expect(depuisSinistres([{ id: s.id, mandatId: 'm-1', libelle: 'DDE', fiche }]).map((e) => e.nature)).toContain('a_declarer')
  })

  it('écarte un courrier déposé avant la survenance ou la connaissance (mal rattaché)', () => {
    const fiche = sinistre({ dateConnaissance: '2026-10-29' })
    expect(proposerDateDeclaration(fiche, [courrier({ dateDepot: '2026-10-28', datePremierePresentation: null })], JOUR).nature).toBe('aucun_courrier')
    const avantEtApres = [
      courrier({ id: 'avant', dateDepot: '2026-10-20', datePremierePresentation: null }),
      courrier({ id: 'apres', dateDepot: '2026-10-30', datePremierePresentation: null }),
    ]
    expect(proposerDateDeclaration(fiche, avantEtApres, JOUR)).toMatchObject({ nature: 'a_reporter', courrierId: 'apres', date: '2026-10-30' })
  })
})

describe('point 58 — report sur la fiche', () => {
  it('remplit une date vide depuis la proposition, sans modifier la fiche reçue', () => {
    const s = sinistre()
    const fiche = ficheAvecDateDeclaration(s, proposerDateDeclaration(s, [courrier()], JOUR))
    expect(fiche.dateDeclaration).toBe('2026-10-28')
    expect(s.fiche.dateDeclaration).toBeNull()
  })

  it('ne touche jamais une date saisie (écart, conforme) ni une fiche sans courrier', () => {
    const saisi = sinistre({ dateDeclaration: '2026-10-29' })
    expect(ficheAvecDateDeclaration(saisi, proposerDateDeclaration(saisi, [courrier()], JOUR))).toBe(saisi.fiche)
    const conforme = sinistre({ dateDeclaration: '2026-10-28' })
    expect(ficheAvecDateDeclaration(conforme, proposerDateDeclaration(conforme, [courrier()], JOUR))).toBe(conforme.fiche)
    const vide = sinistre()
    expect(ficheAvecDateDeclaration(vide, proposerDateDeclaration(vide, [], JOUR)).dateDeclaration).toBeNull()
  })

  it('n’écrase pas une date saisie entre la proposition et son report', () => {
    const proposition = proposerDateDeclaration(sinistre(), [courrier()], JOUR)
    const saisieEntreTemps = sinistre({ dateDeclaration: '2026-10-29' })
    expect(ficheAvecDateDeclaration(saisieEntreTemps, proposition).dateDeclaration).toBe('2026-10-29')
  })

  it('refuse la proposition d’un autre sinistre', () => {
    const proposition = proposerDateDeclaration(sinistre(), [courrier()], JOUR)
    expect(() => ficheAvecDateDeclaration(sinistre({}, 'sin-2'), proposition)).toThrow(/autre sinistre/i)
  })
})

describe('point 58 — anomalies des courriers de déclaration', () => {
  it('aucune anomalie sur une déclaration AR présentée, adressée à la compagnie, sans date saisie', () => {
    expect(controlerCourriersDeclaration(sinistre(), [courrier({ typeDestinataire: "Compagnie d'assurance" })], JOUR)).toEqual([])
  })

  it('chronologie : courrier déposé avant la connaissance, écarté de la proposition', () => {
    const anomalies = controlerCourriersDeclaration(sinistre({ dateConnaissance: '2026-10-29' }), [courrier()], JOUR)
    expect(anomalies).toEqual([
      expect.objectContaining({ code: 'chronologie', gravite: 'avertissement', courrierId: 'c-1', message: expect.stringMatching(/28\/10\/2026/) }),
    ])
  })

  it('chronologie du report : une étape du suivi déjà datée avant le dépôt est signalée, la date reste proposée', () => {
    const s = sinistre({ dateExpertise: '2026-10-28' })
    const courriers = [courrier({ dateDepot: '2026-10-29', datePremierePresentation: '2026-10-30' })]
    expect(controlerCourriersDeclaration(s, courriers, JOUR)).toEqual([
      expect.objectContaining({ code: 'chronologie', gravite: 'avertissement', courrierId: 'c-1', message: expect.stringMatching(/29\/10\/2026.*Expertise datée/) }),
    ])
    expect(proposerDateDeclaration(s, courriers, JOUR)).toMatchObject({ nature: 'a_reporter', date: '2026-10-29' })
  })

  it('chronologie du report : une incohérence déjà présente sur la fiche n’est pas imputée au courrier', () => {
    const s = sinistre({ dateExpertise: '2026-10-30', dateRapport: '2026-10-29' })
    expect(controlerCourriersDeclaration(s, [courrier()], JOUR)).toEqual([])
  })

  it('plusieurs courriers : le premier est retenu, les suivants sont signalés pour information', () => {
    const anomalies = controlerCourriersDeclaration(sinistre(), [courrier(), courrier({ id: 'c-2', dateDepot: '2026-10-30', datePremierePresentation: '2026-10-31' })], JOUR)
    expect(anomalies).toEqual([expect.objectContaining({ code: 'plusieurs_courriers', gravite: 'information', courrierId: 'c-2' })])
  })

  it('sans preuve de réception : envoi simple, ou AR dont la première présentation n’est pas connue', () => {
    expect(controlerCourriersDeclaration(sinistre(), [courrier({ formeEnvoi: 'Normal', datePremierePresentation: null })], JOUR)).toEqual([
      expect.objectContaining({ code: 'sans_preuve_reception', gravite: 'information', courrierId: 'c-1' }),
    ])
    expect(controlerCourriersDeclaration(sinistre(), [courrier({ datePremierePresentation: null })], JOUR).map((a) => a.code)).toEqual(['sans_preuve_reception'])
  })

  it('écart avec la date saisie', () => {
    expect(controlerCourriersDeclaration(sinistre({ dateDeclaration: '2026-10-29' }), [courrier()], JOUR)).toEqual([
      expect.objectContaining({ code: 'ecart_date_saisie', gravite: 'avertissement', courrierId: 'c-1' }),
    ])
  })

  it('destinataire : un courtier (🔴 vaut-il avis à l’assureur ?) ou un tiers qui n’est pas une compagnie', () => {
    const [courtier] = controlerCourriersDeclaration(sinistre(), [courrier({ typeDestinataire: 'Courtier' })], JOUR)
    expect(courtier).toMatchObject({ code: 'destinataire_non_assureur', gravite: 'avertissement' })
    expect(courtier.message).toMatch(/courtier/i)
    expect(controlerCourriersDeclaration(sinistre(), [courrier({ typeDestinataire: "Expert d'assurance" })], JOUR).map((a) => a.code)).toEqual([
      'destinataire_non_assureur',
    ])
  })

  it('dépôt daté après aujourd’hui : écarté et signalé ; date du jour contrôlée', () => {
    const anomalies = controlerCourriersDeclaration(sinistre(), [courrier({ dateDepot: '2026-11-05', datePremierePresentation: null, formeEnvoi: 'Email' })], {
      aujourdhui: '2026-10-29',
    })
    expect(anomalies.map((a) => a.code)).toEqual(['depot_improbable'])
    expect(anomalies[0].message).toMatch(/05\/11\/2026, après aujourd'hui.*écarté/i)
    expect(() => controlerCourriersDeclaration(sinistre(), [], { aujourdhui: '29/10/2026' })).toThrow(/jour/i)
  })

  it('chronologie du report : une nouvelle incohérence est signalée même si le champ est déjà en anomalie', () => {
    // Clôture (24/10) déjà avant le rapport (25/10) ; le report au 28/10 la met aussi avant la déclaration.
    const cloture = sinistre({ dateSurvenance: '2026-10-20', dateRapport: '2026-10-25', dateCloture: '2026-10-24' })
    const courriers = [courrier({ typeDestinataire: "Compagnie d'assurance" })]
    expect(proposerDateDeclaration(cloture, courriers, JOUR)).toMatchObject({ nature: 'a_reporter', date: '2026-10-28' })
    expect(controlerCourriersDeclaration(cloture, courriers, JOUR)).toEqual([
      expect.objectContaining({ code: 'chronologie', courrierId: 'c-1', message: expect.stringMatching(/28\/10\/2026.*Clôture datée du 24\/10\/2026/) }),
    ])
    // Règlement (19/10) déjà avant la survenance (20/10), et désormais avant la déclaration.
    const reglement = sinistre({ dateSurvenance: '2026-10-20', dateReglement: '2026-10-19' })
    expect(controlerCourriersDeclaration(reglement, courriers, JOUR).map((a) => a.message)).toEqual([expect.stringMatching(/Règlement daté du 19\/10\/2026/)])
  })

  it('sans preuve de réception et date saisie différente : le message ne prétend pas retenir le dépôt', () => {
    const anomalies = controlerCourriersDeclaration(sinistre({ dateDeclaration: '2026-10-29' }), [courrier({ formeEnvoi: 'Normal', datePremierePresentation: null })], JOUR)
    expect(anomalies.map((a) => a.code)).toEqual(['sans_preuve_reception', 'ecart_date_saisie'])
    expect(anomalies[0].message).not.toMatch(/date retenue/i)
    expect(anomalies[1].message).toMatch(/date saisie est conservée/i)
    // Sans date saisie, le dépôt est bien la date retenue.
    expect(controlerCourriersDeclaration(sinistre(), [courrier({ formeEnvoi: 'Normal', datePremierePresentation: null })], JOUR)[0].message).toMatch(
      /date retenue est celle du dépôt/,
    )
  })

  it('catastrophe naturelle, courtier : avis « à l’assureur ou à son représentant local » (L. 125-2, D. 125-6), pas L. 113-2', () => {
    const [catnat] = controlerCourriersDeclaration(sinistre({ type: 'Catastrophes naturelles' }), [courrier({ typeDestinataire: 'Courtier' })], JOUR)
    expect(catnat.message).toMatch(/représentant local/)
    expect(catnat.message).toMatch(/L\. 125-2/)
    expect(catnat.message).toMatch(/D\. 125-6/)
    expect(catnat.message).not.toMatch(/L\. 113-2/)
    const [droitCommun] = controlerCourriersDeclaration(sinistre(), [courrier({ typeDestinataire: 'Courtier' })], JOUR)
    expect(droitCommun.message).toMatch(/L\. 113-2, 4°/)
  })
})

describe('point 58 — contrôle du délai de déclaration', () => {
  const aujourdhui = '2026-11-20'

  it('déclaré par courrier dans le délai (5 jours ouvrés depuis la connaissance)', () => {
    expect(controlerDelaiDeclaration(sinistre(), [courrier({ dateDepot: '2026-11-03', datePremierePresentation: null })], { aujourdhui })).toMatchObject({
      etat: 'dans_le_delai',
      declarationAuPlusTard: '2026-11-03',
      delai: { jours: 5, unite: 'jours_ouvres' },
      dateRetenue: '2026-11-03',
      source: 'courrier',
      courrierId: 'c-1',
      retardJours: 0,
      fondements: ['C. assur. art. L. 113-2, 4°'],
      aConfirmer: true,
    })
  })

  it('le 11 novembre ne compte pas ; un jour de plus est postérieur au repère', () => {
    const s = sinistre({ dateSurvenance: '2026-11-06' })
    expect(controlerDelaiDeclaration(s, [courrier({ dateDepot: '2026-11-16', datePremierePresentation: null })], { aujourdhui }).etat).toBe('dans_le_delai')
    expect(controlerDelaiDeclaration(s, [courrier({ dateDepot: '2026-11-17', datePremierePresentation: null })], { aujourdhui })).toMatchObject({
      etat: 'tardive',
      retardJours: 1,
    })
  })

  it('la date saisie prime sur le courrier', () => {
    const resultat = controlerDelaiDeclaration(sinistre({ dateDeclaration: '2026-11-05' }), [courrier({ dateDepot: '2026-11-02', datePremierePresentation: '2026-11-03' })], { aujourdhui })
    expect(resultat).toMatchObject({ etat: 'tardive', dateRetenue: '2026-11-05', source: 'saisie', courrierId: null, retardJours: 2 })
    expect(resultat.message).toMatch(/repère/i)
  })

  it('à vérifier : déposé dans le délai, présenté après le repère (🔴 envoi ou réception ?)', () => {
    const resultat = controlerDelaiDeclaration(sinistre(), [courrier({ dateDepot: '2026-11-03', datePremierePresentation: '2026-11-04' })], { aujourdhui })
    expect(resultat).toMatchObject({ etat: 'a_verifier', dateRetenue: '2026-11-03', retardJours: 0 })
    expect(resultat.message).toMatch(/envoi.*réception/i)
  })

  it('à vérifier aussi quand seul l’accusé de réception est connu', () => {
    expect(
      controlerDelaiDeclaration(sinistre(), [courrier({ dateDepot: '2026-11-03', datePremierePresentation: null, dateAccuseReception: '2026-11-05' })], { aujourdhui })
        .etat,
    ).toBe('a_verifier')
  })

  it('vol : 2 jours ouvrés', () => {
    expect(controlerDelaiDeclaration(sinistre({ type: 'Vol' }), [courrier({ dateDepot: '2026-10-30', datePremierePresentation: null })], { aujourdhui })).toMatchObject({
      etat: 'tardive',
      declarationAuPlusTard: '2026-10-29',
      delai: { jours: 2, unite: 'jours_ouvres' },
      retardJours: 1,
    })
  })

  it('délai du contrat plus long ; un délai invalide est refusé', () => {
    const courriers = [courrier({ dateDepot: '2026-11-05', datePremierePresentation: null })]
    expect(controlerDelaiDeclaration(sinistre(), courriers, { aujourdhui, delaiContratJoursOuvres: 10 })).toMatchObject({
      etat: 'dans_le_delai',
      delai: { jours: 10, unite: 'jours_ouvres' },
    })
    expect(() => controlerDelaiDeclaration(sinistre(), courriers, { aujourdhui, delaiContratJoursOuvres: 2.5 })).toThrow(/délai du contrat/i)
  })

  it('non déclaré : à déclarer jusqu’au repère, repère dépassé ensuite', () => {
    expect(controlerDelaiDeclaration(sinistre(), [], { aujourdhui: '2026-11-03' })).toMatchObject({
      etat: 'a_declarer',
      dateRetenue: null,
      source: null,
      retardJours: 0,
    })
    expect(controlerDelaiDeclaration(sinistre(), [], { aujourdhui: '2026-11-05' })).toMatchObject({ etat: 'delai_depasse', retardJours: 2 })
  })

  it('dommages-ouvrage : pas de repère (gabarit « pas de délai de déclaration propre »)', () => {
    const resultat = controlerDelaiDeclaration(sinistre({ type: 'Dommages Ouvrage' }), [], { aujourdhui })
    expect(resultat).toMatchObject({ etat: 'sans_repere', declarationAuPlusTard: null, delai: null, retardJours: 0 })
    expect(resultat.message).toMatch(/pas de délai de déclaration propre/i)
    expect(resultat.fondements).toEqual(['C. assur. annexe II à l’art. A. 243-1 (durée de la garantie)', 'C. assur. art. L. 114-1'])
    expect(resultat.fondements).toContain('C. assur. art. L. 114-1')
  })

  it('catastrophe naturelle : 30 jours après la publication de l’arrêté, sans repère si elle n’est pas connue', () => {
    const catnat = sinistre({ type: 'Catastrophes naturelles' })
    expect(controlerDelaiDeclaration(catnat, [], { aujourdhui })).toMatchObject({ etat: 'sans_repere', declarationAuPlusTard: null })
    expect(
      controlerDelaiDeclaration(catnat, [courrier({ dateDepot: '2026-11-25', datePremierePresentation: null })], {
        aujourdhui: '2026-11-30',
        datePublicationArrete: '2026-11-02',
      }),
    ).toMatchObject({
      etat: 'dans_le_delai',
      declarationAuPlusTard: '2026-12-02',
      delai: { jours: 30, unite: 'jours' },
      fondements: ['C. assur. art. L. 125-2', 'C. assur. art. D. 125-6'],
    })
    expect(() => controlerDelaiDeclaration(catnat, [], { aujourdhui, datePublicationArrete: '02/11/2026' })).toThrow(/arrêté/i)
  })

  it('signal, jamais une déchéance ; date du jour contrôlée', () => {
    const resultat = controlerDelaiDeclaration(sinistre({ dateDeclaration: '2026-11-05' }), [], { aujourdhui })
    expect(resultat.avertissement).toBe(AVERTISSEMENT_DELAI_DECLARATION)
    expect(resultat.avertissement).toMatch(/préjudice/i)
    expect(resultat.avertissement).toMatch(/force majeure/i)
    expect(() => controlerDelaiDeclaration(sinistre(), [], { aujourdhui: '2026-13-01' })).toThrow(/jour/i)
  })

  it('catastrophe naturelle à vérifier : le message cite le texte du délai appliqué (L. 125-2), pas L. 113-2', () => {
    const resultat = controlerDelaiDeclaration(
      sinistre({ type: 'Catastrophes naturelles' }),
      [courrier({ dateDepot: '2026-12-01', datePremierePresentation: '2026-12-03' })],
      { aujourdhui: '2026-12-10', datePublicationArrete: '2026-11-02' },
    )
    expect(resultat).toMatchObject({ etat: 'a_verifier', declarationAuPlusTard: '2026-12-02' })
    expect(resultat.message).toMatch(/envoi.*réception/i)
    expect(resultat.message).toMatch(/L\. 125-2/)
    expect(resultat.message).not.toMatch(/L\. 113-2/)
  })

  it('catastrophe naturelle : avertissement propre, sans le régime de déchéance de L. 113-2 (L. 125-2 renvoie à un décret)', () => {
    const resultat = controlerDelaiDeclaration(sinistre({ type: 'Catastrophes naturelles' }), [], { aujourdhui, datePublicationArrete: '2026-11-02' })
    expect(resultat.avertissement).toBe(AVERTISSEMENT_DELAI_CATASTROPHE_NATURELLE)
    expect(resultat.avertissement).toMatch(/jamais une déchéance/i)
    expect(resultat.avertissement).toMatch(/L\. 125-2/)
    expect(resultat.avertissement).toMatch(/D\. 125-6/)
    expect(resultat.avertissement).not.toMatch(/L\. 113-2/)
  })

  it('suivi plus avancé sans date de déclaration : ni « à déclarer » ni « déclarer sans attendre »', () => {
    const close = sinistre({ phase: 'Indemnités', dateExpertise: '2026-11-10', dateReglement: '2026-12-01', dateCloture: '2026-12-15' })
    const resultat = controlerDelaiDeclaration(close, [], { aujourdhui: '2026-12-20' })
    expect(resultat).toMatchObject({ etat: 'declaration_non_datee', retardJours: 0, dateRetenue: null, declarationAuPlusTard: '2026-11-03' })
    expect(resultat.message).toMatch(/Clôture datée du 15\/12\/2026/)
    expect(resultat.message).not.toMatch(/sans attendre/i)
    for (const etape of [{ dateExpertise: '2026-11-10' }, { dateRapport: '2026-11-12' }, { dateReglement: '2026-12-01' }]) {
      const s = sinistre(etape)
      expect(controlerDelaiDeclaration(s, [], { aujourdhui: '2026-12-20' }).etat).toBe('declaration_non_datee')
      // Même lecture que le suivi à faire : pas d'élément « à déclarer ».
      expect(depuisSinistres([{ id: s.id, mandatId: 'm-1', libelle: 'DDE', fiche: s.fiche }]).map((e) => e.nature)).not.toContain('a_declarer')
    }
  })

  it('phase saisie qui suit la déclaration, aucune date de suivi (T42, T43 § 5) : « déclaration non datée », jamais « déclarer sans attendre »', () => {
    for (const phase of PHASES_APRES_DECLARATION) {
      const s = sinistre({ phase })
      expect(etapeSuiviSinistre(s.fiche)).toBe('a_declarer')
      const resultat = controlerDelaiDeclaration(s, [], { aujourdhui: '2026-12-20' })
      expect(resultat).toMatchObject({ etat: 'declaration_non_datee', retardJours: 0, dateRetenue: null, source: null, declarationAuPlusTard: '2026-11-03' })
      expect(resultat.message).toContain(`phase saisie est « ${phase} »`)
      expect(resultat.message).toMatch(/vérifier que le sinistre est déclaré/)
      expect(resultat.message).toMatch(/repère indicatif au 03\/11\/2026/)
      expect(resultat.message).not.toMatch(/sans attendre/i)
      // Suivi à faire : l'élément du critère « À déclarer » demeure, mais à vérifier, sans injonction.
      const elements = depuisSinistres([{ id: s.id, mandatId: 'm-1', libelle: 'DDE', fiche: s.fiche }]).filter((e) => e.nature === 'a_declarer')
      expect(elements.map((e) => e.libelle)).toEqual([`DDE — déclaration non datée (phase « ${phase} ») : à vérifier`])
    }
    expect(PHASES_APRES_DECLARATION).toEqual(['Accusé réception', "Mission d'expertise", 'Relances', 'Complément de document', 'Indemnités'])
  })

  it('phase initiale, étape « Déclaration » ou régime « Dommages Ouvrages » (🔴) : le sinistre reste à déclarer', () => {
    const neutres = [null, 'Général', 'Déclaration', 'Dommages Ouvrages'] as const
    expect([...neutres.filter((p) => p !== null), ...PHASES_APRES_DECLARATION].sort()).toEqual([...PHASE_SINISTRE].sort())
    for (const phase of neutres) {
      const s = sinistre({ phase })
      expect(controlerDelaiDeclaration(s, [], { aujourdhui: '2026-12-20' })).toMatchObject({ etat: 'delai_depasse', message: expect.stringMatching(/sans attendre/) })
      expect(depuisSinistres([{ id: s.id, mandatId: 'm-1', libelle: 'DDE', fiche: s.fiche }]).find((e) => e.nature === 'a_declarer')?.libelle).toBe('DDE')
    }
  })

  it('la phase ne masque ni une date de déclaration ni un courrier : le délai est contrôlé', () => {
    expect(controlerDelaiDeclaration(sinistre({ phase: 'Indemnités', dateDeclaration: '2026-11-05' }), [], { aujourdhui })).toMatchObject({ etat: 'tardive', retardJours: 2 })
    expect(
      controlerDelaiDeclaration(sinistre({ phase: 'Relances' }), [courrier({ dateDepot: '2026-11-05', datePremierePresentation: null })], { aujourdhui }),
    ).toMatchObject({ etat: 'tardive', source: 'courrier', retardJours: 2 })
  })

  it('dépôt daté après aujourd’hui : écarté, le sinistre reste à déclarer (ou en retard)', () => {
    const futur = [courrier({ dateDepot: '2026-11-02', datePremierePresentation: null })]
    const resultat = controlerDelaiDeclaration(sinistre(), futur, { aujourdhui: '2026-10-28' })
    expect(resultat).toMatchObject({ etat: 'a_declarer', dateRetenue: null, source: null, courrierId: null })
    expect(resultat.message).toMatch(/02\/11\/2026, après aujourd'hui.*écarté/i)
    expect(controlerDelaiDeclaration(sinistre(), [courrier({ dateDepot: '2026-11-20', datePremierePresentation: null })], { aujourdhui: '2026-11-10' })).toMatchObject({
      etat: 'delai_depasse',
      retardJours: 7,
    })
    // Un courrier déjà déposé reste retenu ; le suivant, daté après aujourd'hui, est ignoré.
    expect(
      controlerDelaiDeclaration(sinistre(), [courrier({ id: 'c-0', dateDepot: '2026-10-28' }), ...futur], { aujourdhui: '2026-10-30' }),
    ).toMatchObject({ etat: 'dans_le_delai', courrierId: 'c-0', dateRetenue: '2026-10-28' })
  })

  it('date saisie après aujourd’hui : jamais remplacée, mais pas de conclusion sur le délai', () => {
    const resultat = controlerDelaiDeclaration(sinistre({ dateDeclaration: '2026-11-02' }), [], { aujourdhui: '2026-10-29' })
    expect(resultat).toMatchObject({ etat: 'a_verifier', dateRetenue: '2026-11-02', source: 'saisie', retardJours: 0 })
    expect(resultat.message).toMatch(/02\/11\/2026, après aujourd'hui/)
  })

  it('décompte de L. 113-2, 4° (🔴) : jours ouvrés depuis le lendemain de la connaissance, le repère tombe toujours un jour ouvré', () => {
    let jour = '2026-01-01'
    for (let i = 0; i < 365; i++, jour = ajouterJours(jour, 1))
      for (const type of ['Dégât des eaux', 'Vol'] as const) {
        const repere = controlerDelaiDeclaration(sinistre({ type, dateSurvenance: jour }), [], { aujourdhui: '2027-12-31' }).declarationAuPlusTard
        expect(repere !== null && estJourOuvrable(repere)).toBe(true)
      }
    // Connaissance le lundi 02/11 : mardi 03, mercredi 04, jeudi 05, vendredi 06, lundi 09.
    expect(controlerDelaiDeclaration(sinistre({ dateSurvenance: '2026-11-02' }), [], { aujourdhui }).declarationAuPlusTard).toBe('2026-11-09')
  })

  it('décompte de la catastrophe naturelle (🔴) : trente jours calendaires, un dernier jour samedi n’est pas reporté', () => {
    const resultat = controlerDelaiDeclaration(sinistre({ type: 'Catastrophes naturelles' }), [], { aujourdhui, datePublicationArrete: '2026-11-05' })
    expect(resultat.declarationAuPlusTard).toBe('2026-12-05')
    expect(jourSemaine('2026-12-05')).toBe(6)
  })
})
