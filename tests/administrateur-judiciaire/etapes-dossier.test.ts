import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { etatEtape } from '@/lib/administrateur-judiciaire/domain/etapes'
import {
  ANOMALIES_PROGRAMMATION,
  CANAUX_ACCUSE_REALISATION,
  JOURS_SUIVI_ETAPE_AUTOMATIQUE,
  JOURS_SUIVI_ETAPE_MAX,
  LIBELLES_ANOMALIES_PROGRAMMATION,
  LIBELLES_CANAUX_ACCUSE_REALISATION,
  LIBELLES_NATURES_DEMANDEUR_ETAPE,
  LIBELLES_ORIGINE_ETAPE,
  LIBELLES_STATUT_ETAPE,
  NATURES_DEMANDEUR_ETAPE,
  TITRE_COPIE_AU_CS_POUR_INFO,
  USAGES_ETAPES_CABINET_PAR_DEFAUT,
  anomaliesProgrammation,
  bilanDurees,
  canalAccuseRealisation,
  creerEtapeDossier,
  detacherEtape,
  enchainerEtapeDossier,
  etapeAutomatiqueNonRealisee,
  etapeCopieAuCsPourInfo,
  etapesEnFichesLiees,
  programmerEtape,
  rattacherEtape,
  realiserEtapeDossier,
  relanceEtapeAutomatique,
  validerEtapeDossier,
  type EtapeDossier,
  type NatureDemandeurEtape,
  type OrigineEtape,
  type SaisieEtapeDossier,
} from '@/lib/administrateur-judiciaire/domain/etapes-dossier'
import { creerRattachement, fichesLiees } from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import {
  LIBELLES_NATURES_SUIVI,
  NATURES_SUIVI,
  depuisEtapes,
  depuisEtapesAutomatiques,
  reglageParDefaut,
  selectionnerAFaire,
  type ReglageFamille,
  type ReglageSuivi,
} from '@/lib/administrateur-judiciaire/domain/suivi-a-faire'

/**
 * Étapes d'un dossier (point 48 du bilan 2). Gestéam : tranche 35 § Étapes (fiche : Le, Titre, Étape type, rattachement,
 * Demandeur, Limite, Instructions ; Réalisation : À faire le + Fixe, Durée, Fait le, « Accusé de réalisation au
 * demandeur » ; Validation : Prévue le + Fixe, Durée ; Programmation : durées estimées / réelles, En cours depuis, Cumul),
 * tranche 14 § 6 (cinq acteurs, quatre dates), tranche 42 (étape « Copie au CS pour info » créée « Automatique »),
 * tranche 43 § 1 (étape automatique ouverte depuis des années, aucune relance).
 */

const contentieux = creerRattachement('Contentieux', 'C-3')
const copro = creerRattachement('Copropriété', 'copro-tilleuls')

const saisie = (surcharge: Partial<SaisieEtapeDossier> = {}): SaisieEtapeDossier => ({
  id: 'e-1',
  titre: 'Lettre de mise en demeure',
  etapeType: 'MED',
  creeeLe: '2026-10-20',
  origine: 'manuelle',
  creeeParId: 'collab-A',
  demandeurId: 'collab-A',
  demandeurNature: 'collaborateur',
  realisateurId: 'collab-B',
  validateurId: null,
  limite: '2026-11-05',
  rattachements: [contentieux, copro],
  instructions: 'Joindre le décompte',
  ...surcharge,
})

const etapeAutomatique = (surcharge: Partial<SaisieEtapeDossier> = {}): EtapeDossier =>
  creerEtapeDossier(
    saisie({
      id: 'e-auto',
      titre: 'Copie au CS pour info',
      etapeType: 'COPIE_CS',
      creeeLe: '2026-09-01',
      origine: 'automatique',
      creeeParId: null,
      limite: null,
      instructions: '',
      ...surcharge,
    }),
  )

describe('étape d’un dossier — création', () => {
  it('manuelle : créateur, date « Le », rattachements, instructions ; tout le reste à zéro', () => {
    const etape = creerEtapeDossier(saisie({ titre: '  Lettre de mise en demeure ', instructions: ' Joindre le décompte ' }))
    expect(etape).toEqual({
      id: 'e-1',
      titre: 'Lettre de mise en demeure',
      etapeType: 'MED',
      demandeurId: 'collab-A',
      realisateurId: 'collab-B',
      validateurId: null,
      limite: '2026-11-05',
      alerteSecurite: null,
      faitLe: null,
      valideeLe: null,
      validationSansObjet: false,
      compteRendu: '',
      creeeLe: '2026-10-20',
      origine: 'manuelle',
      creeeParId: 'collab-A',
      demandeurNature: 'collaborateur',
      rattachements: [contentieux, copro],
      instructions: 'Joindre le décompte',
      aFaireLe: null,
      validationPrevueLe: null,
      accuseAuDemandeur: false,
      durees: { realisationEstimee: null, realisationReelle: null, validationEstimee: null, validationReelle: null },
    })
    expect(etatEtape(etape, '2026-10-21').statut).toBe('a_faire')
  })

  it('automatique : sans créateur (affiché « Automatique »)', () => {
    const etape = etapeAutomatique()
    expect(etape).toMatchObject({ origine: 'automatique', creeeParId: null, creeeLe: '2026-09-01' })
    expect(LIBELLES_ORIGINE_ETAPE[etape.origine]).toBe('Automatique')
    expect(LIBELLES_ORIGINE_ETAPE.manuelle).toBe('Manuelle')
  })

  it('rattachements contrôlés et dédoublonnés ; saisie de programmation et durées estimées reprises', () => {
    const etape = creerEtapeDossier(
      saisie({
        rattachements: [contentieux, { type: 'Contentieux', id: ' C-3 ' }, copro],
        aFaireLe: '2026-10-25',
        validationPrevueLe: '2026-10-27',
        accuseAuDemandeur: true,
        durees: { realisationEstimee: 30, validationEstimee: 10 },
      }),
    )
    expect(etape.rattachements).toEqual([contentieux, copro])
    expect(etape).toMatchObject({ aFaireLe: '2026-10-25', validationPrevueLe: '2026-10-27', accuseAuDemandeur: true })
    expect(etape.durees).toEqual({ realisationEstimee: 30, realisationReelle: null, validationEstimee: 10, validationReelle: null })
  })

  it('refus : identifiant, titre ou demandeur vides ; origine et créateur incohérents ; dates et durées invalides', () => {
    expect(() => creerEtapeDossier(saisie({ id: ' ' }))).toThrow(/identifiant/i)
    expect(() => creerEtapeDossier(saisie({ titre: ' ' }))).toThrow(/titre/i)
    expect(() => creerEtapeDossier(saisie({ demandeurId: '' }))).toThrow(/demandeur/i)
    expect(() => creerEtapeDossier(saisie({ demandeurNature: 'syndic' as string as NatureDemandeurEtape }))).toThrow(/nature du demandeur/i)
    expect(() => creerEtapeDossier(saisie({ origine: 'importee' as string as OrigineEtape }))).toThrow(/origine/i)
    expect(() => creerEtapeDossier(saisie({ creeeParId: null }))).toThrow(/créateur/i)
    expect(() => creerEtapeDossier(saisie({ creeeParId: ' ' }))).toThrow(/créateur/i)
    expect(() => creerEtapeDossier(saisie({ origine: 'automatique', creeeParId: 'collab-A' }))).toThrow(/automatique/i)
    expect(() => creerEtapeDossier(saisie({ creeeLe: '20/10/2026' }))).toThrow(/création/i)
    expect(() => creerEtapeDossier(saisie({ limite: '2026-02-30' }))).toThrow(/limite/i)
    expect(() => creerEtapeDossier(saisie({ alerteSecurite: 'demain' }))).toThrow(/alerte/i)
    expect(() => creerEtapeDossier(saisie({ aFaireLe: '2026-13-01' }))).toThrow(/à faire le/i)
    expect(() => creerEtapeDossier(saisie({ validationPrevueLe: '2026-1-1' }))).toThrow(/prévue/i)
    expect(() => creerEtapeDossier(saisie({ durees: { realisationEstimee: -5 } }))).toThrow(/durée/i)
    expect(() => creerEtapeDossier(saisie({ durees: { validationEstimee: 1.5 } }))).toThrow(/durée/i)
    // @ts-expect-error — type hors référentiel
    expect(() => creerEtapeDossier(saisie({ rattachements: [{ type: 'Chantier', id: 'x' }] }))).toThrow(/inconnu/i)
  })

  it('réalisateur et valideur : espaces retirés, vide ou blanc = aucun (comme le demandeur et le créateur)', () => {
    expect(creerEtapeDossier(saisie({ realisateurId: '  ', validateurId: '' }))).toMatchObject({ realisateurId: null, validateurId: null })
    expect(creerEtapeDossier(saisie({ realisateurId: ' collab-B ', validateurId: ' collab-A ' }))).toMatchObject({
      realisateurId: 'collab-B',
      validateurId: 'collab-A',
    })
    const faite = realiserEtapeDossier(creerEtapeDossier(saisie({ validateurId: '  ' })), { date: '2026-10-21', compteRendu: '' }).etape
    expect(etatEtape(faite, '2026-10-21').statut).toBe('terminee')
    expect(depuisEtapes([{ mandatId: 'M1', etape: faite }], '2026-10-21')).toEqual([])
  })

  it('la saisie reçue n’est pas modifiée', () => {
    const brute = saisie({ rattachements: [contentieux, contentieux] })
    creerEtapeDossier(brute)
    expect(brute.rattachements).toEqual([contentieux, contentieux])
  })
})

describe('étape d’un dossier — rattachement et fiches liées', () => {
  it('rattacher sans doublon, détacher, sans modifier l’étape reçue', () => {
    const etape = creerEtapeDossier(saisie({ rattachements: [contentieux] }))
    const sinistre = creerRattachement('Sinistre', 'S-7')
    const rattachee = rattacherEtape(etape, sinistre)
    expect(rattachee.rattachements).toEqual([contentieux, sinistre])
    expect(rattacherEtape(rattachee, { type: 'Sinistre', id: ' S-7 ' }).rattachements).toEqual([contentieux, sinistre])
    expect(detacherEtape(rattachee, contentieux).rattachements).toEqual([sinistre])
    expect(etape.rattachements).toEqual([contentieux])
    expect(() => rattacherEtape(etape, { type: 'Sinistre', id: ' ' })).toThrow(/identifiant/i)
  })

  it('l’onglet Étapes d’un dossier : date de création, statut en clair, filtres et ordre de fichesLiees', () => {
    const ouverte = creerEtapeDossier(saisie({ id: 'e-2', creeeLe: '2026-10-22' }))
    const faite = realiserEtapeDossier(creerEtapeDossier(saisie({ id: 'e-1' })), { date: '2026-10-21', compteRendu: 'Envoyée' }).etape
    const ailleurs = creerEtapeDossier(saisie({ id: 'e-3', rattachements: [copro] }))
    const fiches = etapesEnFichesLiees([faite, ouverte, ailleurs], '2026-10-29')
    expect(fiches[0]).toEqual({ id: 'e-1', date: '2026-10-20', statut: 'Terminée', titre: 'Lettre de mise en demeure', rattachements: [contentieux, copro] })
    expect(fichesLiees(fiches, contentieux).lignes.map((f) => f.id)).toEqual(['e-2', 'e-1'])
    expect(fichesLiees(fiches, contentieux, { statuts: [LIBELLES_STATUT_ETAPE.a_faire] }).lignes.map((f) => f.id)).toEqual(['e-2'])
    expect(LIBELLES_STATUT_ETAPE).toEqual({ a_faire: 'À faire', a_valider: 'À valider', validee: 'Validée', terminee: 'Terminée' })
    expect(() => etapesEnFichesLiees([ouverte], '29/10/2026')).toThrow(/date du jour/i)
  })
})

describe('étape d’un dossier — programmation', () => {
  it('« à faire le », « prévue le » et durées estimées : absent = inchangé, null = effacé', () => {
    const etape = creerEtapeDossier(saisie({ aFaireLe: '2026-10-25', durees: { realisationEstimee: 30 } }))
    const programmee = programmerEtape(etape, { validationPrevueLe: '2026-10-28', dureeValidationEstimee: 15 })
    expect(programmee).toMatchObject({ aFaireLe: '2026-10-25', validationPrevueLe: '2026-10-28' })
    expect(programmee.durees).toEqual({ realisationEstimee: 30, realisationReelle: null, validationEstimee: 15, validationReelle: null })
    const effacee = programmerEtape(programmee, { aFaireLe: null, dureeRealisationEstimee: null })
    expect(effacee).toMatchObject({ aFaireLe: null, validationPrevueLe: '2026-10-28' })
    expect(effacee.durees.realisationEstimee).toBeNull()
    expect(etape.validationPrevueLe).toBeNull()
    expect(() => programmerEtape(etape, { aFaireLe: '25/10/2026' })).toThrow(/à faire le/i)
    expect(() => programmerEtape(etape, { dureeRealisationEstimee: -1 })).toThrow(/durée/i)
  })

  it('J44 : la case « Fixe » n’existe plus, ni à « À faire le », ni à « Prévue le » : ni créée, ni programmée, ni recopiée', () => {
    const etape = creerEtapeDossier(saisie({ aFaireLe: '2026-10-25', validationPrevueLe: '2026-10-27' }))
    const programmee = programmerEtape(etape, { aFaireLe: '2026-10-26', validationPrevueLe: '2026-10-28' })
    const faite = realiserEtapeDossier(programmee, { date: '2026-10-26', compteRendu: '' }).etape
    const processus = [
      { etapeType: 'MED', titre: 'Lettre de mise en demeure', delaiJours: 0 },
      { etapeType: 'COPIE_CS', titre: 'Copie au CS pour info', delaiJours: 8 },
    ]
    const suivante = enchainerEtapeDossier(faite, processus, { id: 'e-2', date: '2026-10-26', creeeParId: 'collab-B' }) as EtapeDossier
    for (const champ of ['aFaireLeFixe', 'validationPrevueLeFixe'])
      for (const fiche of [etape, programmee, faite, suivante]) expect(fiche).not.toHaveProperty(champ)
    expect(programmee).toMatchObject({ aFaireLe: '2026-10-26', validationPrevueLe: '2026-10-28' })
  })

  it('anomalies non bloquantes : à faire avant la création ou après la limite, validation prévue trop tôt ou sans valideur', () => {
    expect(ANOMALIES_PROGRAMMATION).toEqual([
      'a_faire_avant_creation',
      'a_faire_apres_limite',
      'validation_prevue_avant_a_faire',
      'validation_prevue_sans_validateur',
    ])
    for (const anomalie of ANOMALIES_PROGRAMMATION) expect(LIBELLES_ANOMALIES_PROGRAMMATION[anomalie]).toBeTruthy()
    expect(anomaliesProgrammation(creerEtapeDossier(saisie({ aFaireLe: '2026-10-25' })))).toEqual([])
    expect(anomaliesProgrammation(creerEtapeDossier(saisie({ aFaireLe: '2026-10-19' })))).toEqual(['a_faire_avant_creation'])
    expect(anomaliesProgrammation(creerEtapeDossier(saisie({ aFaireLe: '2026-11-06' })))).toEqual(['a_faire_apres_limite'])
    expect(
      anomaliesProgrammation(creerEtapeDossier(saisie({ validateurId: 'collab-A', aFaireLe: '2026-10-25', validationPrevueLe: '2026-10-24' }))),
    ).toEqual(['validation_prevue_avant_a_faire'])
    expect(anomaliesProgrammation(creerEtapeDossier(saisie({ validationPrevueLe: '2026-10-24' })))).toEqual(['validation_prevue_sans_validateur'])
    expect(anomaliesProgrammation(creerEtapeDossier(saisie({ validateurId: '', validationPrevueLe: '2026-10-25' })))).toEqual([
      'validation_prevue_sans_validateur',
    ])
    // Valideur vide sur une étape construite ailleurs : même lecture qu'etatEtape (pas de valideur).
    const prevue = creerEtapeDossier(saisie({ validationPrevueLe: '2026-10-25' }))
    expect(anomaliesProgrammation({ ...prevue, validateurId: '' })).toEqual(['validation_prevue_sans_validateur'])
    expect(anomaliesProgrammation(creerEtapeDossier(saisie({ limite: null, aFaireLe: '2027-01-04' })))).toEqual([])
  })
})

describe('étape d’un dossier — réalisation, accusé au demandeur, validation', () => {
  it('case « Accusé de réalisation au demandeur » cochée : un accusé décrit (rien n’est envoyé), durée réelle notée', () => {
    const etape = creerEtapeDossier(saisie({ accuseAuDemandeur: true }))
    const { etape: faite, accuse } = realiserEtapeDossier(etape, { date: '2026-10-21', compteRendu: ' Envoyée en recommandé ', dureeReelleMinutes: 20 })
    expect(accuse).toEqual({
      etapeId: 'e-1',
      destinataireId: 'collab-A',
      destinataireNature: 'collaborateur',
      canal: 'memo_interne',
      realiseParId: 'collab-B',
      titre: 'Lettre de mise en demeure',
      faitLe: '2026-10-21',
      compteRendu: 'Envoyée en recommandé',
    })
    expect(faite).toMatchObject({ faitLe: '2026-10-21', compteRendu: 'Envoyée en recommandé' })
    expect(faite.durees.realisationReelle).toBe(20)
    expect(etape.faitLe).toBeNull()
  })

  it('pas d’accusé si la case n’est pas cochée, ou si le demandeur a lui-même réalisé l’étape', () => {
    expect(realiserEtapeDossier(creerEtapeDossier(saisie()), { date: '2026-10-21', compteRendu: '' }).accuse).toBeNull()
    expect(
      realiserEtapeDossier(creerEtapeDossier(saisie({ accuseAuDemandeur: true, realisateurId: 'collab-A' })), { date: '2026-10-21', compteRendu: '' }).accuse,
    ).toBeNull()
    expect(
      realiserEtapeDossier(creerEtapeDossier(saisie({ accuseAuDemandeur: true, realisateurId: 'collab-A ' })), { date: '2026-10-21', compteRendu: '' }).accuse,
    ).toBeNull()
    const sansRealisateur = realiserEtapeDossier(creerEtapeDossier(saisie({ accuseAuDemandeur: true, realisateurId: ' ' })), {
      date: '2026-10-21',
      compteRendu: '',
    })
    expect(sansRealisateur.accuse).toMatchObject({ destinataireId: 'collab-A', realiseParId: null })
  })

  it('J22 : l’accusé part par e-mail vers un demandeur extérieur, en mémo interne entre collaborateurs (rien n’est envoyé)', () => {
    expect(NATURES_DEMANDEUR_ETAPE).toEqual(['collaborateur', 'coproprietaire', 'conseil_syndical', 'tiers'])
    expect(CANAUX_ACCUSE_REALISATION).toEqual(['memo_interne', 'courriel'])
    expect(LIBELLES_CANAUX_ACCUSE_REALISATION).toEqual({ memo_interne: 'Mémo interne', courriel: 'E-mail' })
    for (const nature of NATURES_DEMANDEUR_ETAPE) expect(LIBELLES_NATURES_DEMANDEUR_ETAPE[nature]).toBeTruthy()
    expect(canalAccuseRealisation('collaborateur')).toBe('memo_interne')
    for (const nature of ['coproprietaire', 'conseil_syndical', 'tiers'] as const) {
      expect(canalAccuseRealisation(nature)).toBe('courriel')
      const etape = creerEtapeDossier(saisie({ accuseAuDemandeur: true, demandeurId: 'identite-7', demandeurNature: nature }))
      expect(etape.demandeurNature).toBe(nature)
      const { accuse } = realiserEtapeDossier(etape, { date: '2026-10-21', compteRendu: 'Fuite réparée' })
      expect(accuse).toMatchObject({ destinataireId: 'identite-7', destinataireNature: nature, canal: 'courriel', realiseParId: 'collab-B' })
    }
    // La case décochée l'emporte, quelle que soit la nature du demandeur.
    const exterieur = creerEtapeDossier(saisie({ demandeurId: 'identite-7', demandeurNature: 'coproprietaire' }))
    expect(realiserEtapeDossier(exterieur, { date: '2026-10-21', compteRendu: '' }).accuse).toBeNull()
  })

  it('refus : réalisation avant la création, étape déjà réalisée, date ou durée invalides', () => {
    const etape = creerEtapeDossier(saisie())
    expect(() => realiserEtapeDossier(etape, { date: '2026-10-19', compteRendu: '' })).toThrow(/création/i)
    const faite = realiserEtapeDossier(etape, { date: '2026-10-21', compteRendu: '' }).etape
    expect(() => realiserEtapeDossier(faite, { date: '2026-10-22', compteRendu: '' })).toThrow(/déjà réalisée/i)
    expect(() => realiserEtapeDossier(etape, { date: '21/10/2026', compteRendu: '' })).toThrow(/date/i)
    expect(() => realiserEtapeDossier(etape, { date: '2026-10-21', compteRendu: '', dureeReelleMinutes: -3 })).toThrow(/durée/i)
  })

  it('validation : durée réelle de validation ; refus avant la réalisation', () => {
    const faite = realiserEtapeDossier(creerEtapeDossier(saisie({ validateurId: 'collab-A' })), { date: '2026-10-21', compteRendu: '' }).etape
    const validee = validerEtapeDossier(faite, { date: '2026-10-22', dureeReelleMinutes: 5 })
    expect(validee.valideeLe).toBe('2026-10-22')
    expect(validee.durees.validationReelle).toBe(5)
    expect(etatEtape(validee, '2026-10-22').statut).toBe('validee')
    expect(() => validerEtapeDossier(faite, { date: '2026-10-20' })).toThrow(/réalisation/i)
    expect(() => validerEtapeDossier(creerEtapeDossier(saisie()), { date: '2026-10-22' })).toThrow(/réalis/i)
  })

  it('refus de validation : aucune validation prévue, validation « sans objet », étape déjà validée', () => {
    const sansValideur = realiserEtapeDossier(creerEtapeDossier(saisie()), { date: '2026-10-21', compteRendu: '' }).etape
    expect(() => validerEtapeDossier(sansValideur, { date: '2026-10-22', dureeReelleMinutes: 10 })).toThrow(/aucune validation/i)
    const faite = realiserEtapeDossier(creerEtapeDossier(saisie({ validateurId: 'collab-A' })), { date: '2026-10-21', compteRendu: '' }).etape
    expect(() => validerEtapeDossier({ ...faite, validationSansObjet: true }, { date: '2026-10-22', dureeReelleMinutes: 7 })).toThrow(/sans objet/i)
    const validee = validerEtapeDossier(faite, { date: '2026-10-22', dureeReelleMinutes: 5 })
    expect(() => validerEtapeDossier(validee, { date: '2026-10-23', dureeReelleMinutes: 50 })).toThrow(/déjà validée.*22\/10\/2026/i)
    expect(bilanDurees(validee, '2026-10-29').cumulReelMinutes).toBe(5)
  })
})

describe('étape d’un dossier — durées (onglet Programmation)', () => {
  it('écarts estimé / réel, cumul réel, « en cours depuis »', () => {
    const etape = creerEtapeDossier(saisie({ validateurId: 'collab-A', durees: { realisationEstimee: 30, validationEstimee: 10 } }))
    expect(bilanDurees(etape, '2026-10-29')).toEqual({
      enCoursDepuisJours: 9,
      ecartRealisationMinutes: null,
      ecartValidationMinutes: null,
      cumulReelMinutes: null,
    })
    const faite = realiserEtapeDossier(etape, { date: '2026-10-23', compteRendu: '', dureeReelleMinutes: 45 }).etape
    expect(bilanDurees(faite, '2026-10-29')).toEqual({
      enCoursDepuisJours: 3,
      ecartRealisationMinutes: 15,
      ecartValidationMinutes: null,
      cumulReelMinutes: 45,
    })
    const validee = validerEtapeDossier(faite, { date: '2026-10-24', dureeReelleMinutes: 5 })
    expect(bilanDurees(validee, '2026-10-29')).toMatchObject({ ecartValidationMinutes: -5, cumulReelMinutes: 50 })
    expect(() => bilanDurees(etape, '2026-10-32')).toThrow(/date du jour/i)
  })

  it('J23 : « en cours depuis » se compte de la création, et non de « à faire le »', () => {
    const programmee = creerEtapeDossier(saisie({ aFaireLe: '2026-10-25' }))
    expect(bilanDurees(programmee, '2026-10-29').enCoursDepuisJours).toBe(9)
    const reportee = programmerEtape(programmee, { aFaireLe: '2026-10-28' })
    expect(bilanDurees(reportee, '2026-10-29').enCoursDepuisJours).toBe(9)
    const faite = realiserEtapeDossier(reportee, { date: '2026-10-28', compteRendu: '' }).etape
    expect(bilanDurees(faite, '2026-11-30').enCoursDepuisJours).toBe(8)
  })
})

describe('étape d’un dossier — enchaînement', () => {
  const processus = [
    { etapeType: 'OUV', titre: 'Ouverture de dossier', delaiJours: 0 },
    { etapeType: 'MED', titre: 'Lettre de mise en demeure', delaiJours: 0 },
    { etapeType: 'COPIE_CS', titre: 'Copie au CS pour info', delaiJours: 8 },
  ]

  it('l’étape suivante garde le dossier et les acteurs, remet à zéro la saisie propre à l’étape', () => {
    const etape = creerEtapeDossier(
      saisie({
        accuseAuDemandeur: true,
        aFaireLe: '2026-10-21',
        validationPrevueLe: '2026-10-22',
        alerteSecurite: '2026-11-01',
        durees: { realisationEstimee: 30 },
      }),
    )
    const faite = realiserEtapeDossier(etape, { date: '2026-10-21', compteRendu: 'Envoyée', dureeReelleMinutes: 40 }).etape
    const suivante = enchainerEtapeDossier(faite, processus, { id: 'e-2', date: '2026-10-21', creeeParId: 'collab-B' })
    expect(suivante).toEqual({
      id: 'e-2',
      titre: 'Copie au CS pour info',
      etapeType: 'COPIE_CS',
      demandeurId: 'collab-A',
      realisateurId: 'collab-B',
      validateurId: null,
      limite: '2026-10-29',
      alerteSecurite: null,
      faitLe: null,
      valideeLe: null,
      validationSansObjet: false,
      compteRendu: '',
      creeeLe: '2026-10-21',
      origine: 'manuelle',
      creeeParId: 'collab-B',
      demandeurNature: 'collaborateur',
      rattachements: [contentieux, copro],
      instructions: '',
      aFaireLe: null,
      validationPrevueLe: null,
      accuseAuDemandeur: false,
      durees: { realisationEstimee: null, realisationReelle: null, validationEstimee: null, validationReelle: null },
    })
    expect(suivante?.rattachements).not.toBe(faite.rattachements)
  })

  it('instructions et case d’accusé se saisissent après la création : l’étape enchaînée, cochée, produit l’accusé', () => {
    const faite = realiserEtapeDossier(creerEtapeDossier(saisie()), { date: '2026-10-21', compteRendu: '' }).etape
    const suivante = enchainerEtapeDossier(faite, processus, { id: 'e-2', date: '2026-10-21', creeeParId: 'collab-A' }) as EtapeDossier
    expect(realiserEtapeDossier(suivante, { date: '2026-10-25', compteRendu: '' }).accuse).toBeNull()
    const programmee = programmerEtape(suivante, { accuseAuDemandeur: true, instructions: '  Joindre la mise en demeure  ' })
    expect(programmee).toMatchObject({ accuseAuDemandeur: true, instructions: 'Joindre la mise en demeure' })
    expect(programmerEtape(programmee, { aFaireLe: '2026-10-24' })).toMatchObject({ accuseAuDemandeur: true, instructions: 'Joindre la mise en demeure' })
    expect(programmerEtape(programmee, { instructions: ' ', accuseAuDemandeur: false })).toMatchObject({ accuseAuDemandeur: false, instructions: '' })
    expect(realiserEtapeDossier(programmee, { date: '2026-10-25', compteRendu: '' }).accuse).toMatchObject({
      etapeId: 'e-2',
      destinataireId: 'collab-A',
      realiseParId: 'collab-B',
    })
    // Case cochée au moment de réaliser (sous-onglet Réalisation, tranche 35) ; absente : celle de l'étape.
    const cocheeALaRealisation = realiserEtapeDossier(suivante, { date: '2026-10-25', compteRendu: '', accuseAuDemandeur: true })
    expect(cocheeALaRealisation.etape.accuseAuDemandeur).toBe(true)
    expect(cocheeALaRealisation.accuse).toMatchObject({ etapeId: 'e-2', destinataireId: 'collab-A' })
    expect(realiserEtapeDossier(programmee, { date: '2026-10-25', compteRendu: '', accuseAuDemandeur: false }).accuse).toBeNull()
  })

  it('« sans objet » de la validation n’est pas recopié sur l’étape suivante (etapes.enchainer le recopierait)', () => {
    const faite = realiserEtapeDossier(creerEtapeDossier(saisie({ validateurId: 'collab-A' })), { date: '2026-10-21', compteRendu: '' }).etape
    const sansObjet: EtapeDossier = { ...faite, validationSansObjet: true }
    const suivante = enchainerEtapeDossier(sansObjet, processus, { id: 'e-2', date: '2026-10-22', creeeParId: 'collab-B' })
    expect(suivante).toMatchObject({ validateurId: 'collab-A', validationSansObjet: false, creeeLe: '2026-10-22', creeeParId: 'collab-B' })
    expect(etatEtape(suivante as EtapeDossier, '2026-10-22').statut).toBe('a_faire')
  })

  it('fin de processus : null ; refus avant réalisation, date antérieure à la réalisation, identifiant vide', () => {
    const faite = realiserEtapeDossier(creerEtapeDossier(saisie({ etapeType: 'COPIE_CS' })), { date: '2026-10-21', compteRendu: '' }).etape
    expect(enchainerEtapeDossier(faite, processus, { id: 'x', date: '2026-10-21', creeeParId: 'collab-B' })).toBeNull()
    const med = realiserEtapeDossier(creerEtapeDossier(saisie()), { date: '2026-10-21', compteRendu: '' }).etape
    expect(() => enchainerEtapeDossier(creerEtapeDossier(saisie()), processus, { id: 'x', date: '2026-10-21', creeeParId: 'collab-B' })).toThrow(/réalis/i)
    expect(() => enchainerEtapeDossier(med, processus, { id: 'x', date: '2026-10-20', creeeParId: 'collab-B' })).toThrow(/réalisation/i)
    expect(() => enchainerEtapeDossier(med, processus, { id: ' ', date: '2026-10-21', creeeParId: 'collab-B' })).toThrow(/identifiant/i)
  })

  it('J20 : « Créée par » = le collaborateur qui déclenche l’enchaînement (jamais « Automatique ») ; refus sans lui', () => {
    const med = realiserEtapeDossier(creerEtapeDossier(saisie()), { date: '2026-10-21', compteRendu: '' }).etape
    const suivante = enchainerEtapeDossier(med, processus, { id: 'e-2', date: '2026-10-22', creeeParId: ' collab-C ' }) as EtapeDossier
    expect(suivante).toMatchObject({ origine: 'manuelle', creeeParId: 'collab-C', creeeLe: '2026-10-22' })
    expect(LIBELLES_ORIGINE_ETAPE[suivante.origine]).toBe('Manuelle')
    for (const absent of ['', '  ', null] as (string | null)[])
      expect(() => enchainerEtapeDossier(med, processus, { id: 'e-2', date: '2026-10-22', creeeParId: absent as string })).toThrow(
        /collaborateur qui déclenche l’enchaînement/i,
      )
    // Même après une étape automatique, l'étape enchaînée est créée par le collaborateur qui enchaîne.
    const auto = realiserEtapeDossier(etapeAutomatique({ etapeType: 'MED' }), { date: '2026-09-02', compteRendu: '' }).etape
    expect(enchainerEtapeDossier(auto, processus, { id: 'e-3', date: '2026-09-02', creeeParId: 'collab-B' })).toMatchObject({
      origine: 'manuelle',
      creeeParId: 'collab-B',
    })
  })

  it('J20, conséquence : l’étape enchaînée n’est pas visée par la règle des N jours ; elle remonte par sa limite', () => {
    const med = realiserEtapeDossier(creerEtapeDossier(saisie()), { date: '2026-10-21', compteRendu: '' }).etape
    const suivante = enchainerEtapeDossier(med, processus, { id: 'e-2', date: '2026-10-21', creeeParId: 'collab-B' }) as EtapeDossier
    const bienPlusTard = '2027-06-30'
    expect(relanceEtapeAutomatique(suivante, bienPlusTard)).toBeNull()
    expect(etapeAutomatiqueNonRealisee(suivante, bienPlusTard)).toBeNull()
    expect(depuisEtapesAutomatiques([{ mandatId: 'M1', etape: suivante }], bienPlusTard)).toEqual([])
    expect(depuisEtapes([{ mandatId: 'M1', etape: suivante }], '2026-10-22')).toEqual([
      expect.objectContaining({ id: 'etapes:e-2:a_faire', date: '2026-10-29', assigneId: 'collab-B' }),
    ])
  })
})

describe('J24 : « Copie au CS pour info », usage du cabinet (réglage activable), pas une obligation', () => {
  const declencheur = {
    id: 'e-copie',
    contentieuxId: 'C-3',
    miseEnDemeureLe: '2026-10-20',
    demandeurId: 'collab-A',
    demandeurNature: 'collaborateur',
    realisateurId: 'collab-B',
  } as const

  const ACTIF = { copieAuCsPourInfo: true }

  it('J41 : usage INACTIF par défaut (réglage activable) : sans réglage du cabinet, aucune étape', () => {
    expect(USAGES_ETAPES_CABINET_PAR_DEFAUT).toEqual({ copieAuCsPourInfo: false })
    expect(etapeCopieAuCsPourInfo(declencheur)).toBeNull()
    expect(etapeCopieAuCsPourInfo(declencheur, USAGES_ETAPES_CABINET_PAR_DEFAUT)).toBeNull()
  })

  it('usage activé par le cabinet : étape automatique créée à la date de la mise en demeure', () => {
    const etape = etapeCopieAuCsPourInfo(declencheur, ACTIF) as EtapeDossier
    expect(etape).toMatchObject({
      id: 'e-copie',
      titre: TITRE_COPIE_AU_CS_POUR_INFO,
      origine: 'automatique',
      creeeParId: null,
      creeeLe: '2026-10-20',
      demandeurId: 'collab-A',
      realisateurId: 'collab-B',
      rattachements: [contentieux],
    })
    expect(TITRE_COPIE_AU_CS_POUR_INFO).toBe('Copie au CS pour info')
    // Étape automatique : la règle des N jours la vise.
    expect(etapeAutomatiqueNonRealisee(etape, '2026-11-19')).toEqual({ relanceLe: '2026-11-19', ouverteDepuisJours: 30 })
  })

  it('usage désactivé : aucune étape ; activé, contrôles de la saisie conservés', () => {
    expect(etapeCopieAuCsPourInfo(declencheur, { copieAuCsPourInfo: false })).toBeNull()
    expect(() => etapeCopieAuCsPourInfo({ ...declencheur, miseEnDemeureLe: '20/10/2026' }, ACTIF)).toThrow(/création/i)
    expect(() => etapeCopieAuCsPourInfo({ ...declencheur, contentieuxId: ' ' }, ACTIF)).toThrow(/identifiant/i)
  })
})

describe('étape automatique non réalisée après N jours (réglage de gestion, tranche 43 § 1)', () => {
  it('N par défaut : 30 jours, réglage du cabinet', () => {
    expect(JOURS_SUIVI_ETAPE_AUTOMATIQUE).toBe(30)
  })

  it('remonte à création + N, borne incluse, même sans limite ni alerte', () => {
    const etape = etapeAutomatique()
    expect(etapeAutomatiqueNonRealisee(etape, '2026-09-30')).toBeNull()
    expect(etapeAutomatiqueNonRealisee(etape, '2026-10-01')).toEqual({ relanceLe: '2026-10-01', ouverteDepuisJours: 30 })
    expect(etapeAutomatiqueNonRealisee(etape, '2029-10-01', 90)).toEqual({ relanceLe: '2026-11-30', ouverteDepuisJours: 1126 })
    expect(etapeAutomatiqueNonRealisee(etapeAutomatique({ limite: '2026-12-31' }), '2026-10-01')).not.toBeNull()
    expect(etapeAutomatiqueNonRealisee(etape, '2026-09-01', 0)).toEqual({ relanceLe: '2026-09-01', ouverteDepuisJours: 0 })
  })

  it('ignore une étape manuelle ou réalisée ; refuse un N non entier ou négatif et une date invalide', () => {
    expect(etapeAutomatiqueNonRealisee(creerEtapeDossier(saisie({ creeeLe: '2026-01-01' })), '2026-10-29')).toBeNull()
    const faite = realiserEtapeDossier(etapeAutomatique(), { date: '2026-09-02', compteRendu: '' }).etape
    expect(etapeAutomatiqueNonRealisee(faite, '2026-10-29')).toBeNull()
    expect(() => etapeAutomatiqueNonRealisee(etapeAutomatique(), '2026-10-29', -1)).toThrow(/jours/i)
    expect(() => etapeAutomatiqueNonRealisee(etapeAutomatique(), '2026-10-29', 1.5)).toThrow(/jours/i)
    expect(() => etapeAutomatiqueNonRealisee(etapeAutomatique(), '29/10/2026')).toThrow(/date du jour/i)
  })

  it('N borné à JOURS_SUIVI_ETAPE_MAX : une très grande valeur est refusée au lieu d’inverser la règle', () => {
    expect(JOURS_SUIVI_ETAPE_MAX).toBe(36_500)
    const etape = etapeAutomatique({ creeeLe: '2026-10-20' })
    expect(etapeAutomatiqueNonRealisee(etape, '2026-10-21', JOURS_SUIVI_ETAPE_MAX)).toBeNull()
    for (const jours of [JOURS_SUIVI_ETAPE_MAX + 1, 2_920_000, 3_000_000, 6_000_000, 1e9]) {
      expect(() => etapeAutomatiqueNonRealisee(etape, '2026-10-21', jours)).toThrow(/jours/i)
      expect(() => depuisEtapesAutomatiques([{ mandatId: 'M1', etape }], '2026-10-21', jours)).toThrow(/jours/i)
    }
  })

  it('relance au-delà de l’an 9999 : jamais due pour la fiche, refus explicite pour le suivi', () => {
    const lointaine = etapeAutomatique({ creeeLe: '9990-01-01' })
    expect(etapeAutomatiqueNonRealisee(lointaine, '9990-01-02', JOURS_SUIVI_ETAPE_MAX)).toBeNull()
    expect(() => depuisEtapesAutomatiques([{ mandatId: 'M1', etape: lointaine }], '9990-01-02', JOURS_SUIVI_ETAPE_MAX)).toThrow(
      /e-auto.*calendrier/i,
    )
  })
})

describe('suivi « à faire » — étapes', () => {
  it('nouvelle nature de la famille Étapes, avec son libellé', () => {
    expect(NATURES_SUIVI.etapes).toEqual(['a_faire', 'a_valider', 'automatique_non_realisee'])
    expect(LIBELLES_NATURES_SUIVI.automatique_non_realisee).toBe('Étape automatique non réalisée')
  })

  it('étape automatique non réalisée : à sa date de relance, pour son réalisateur, jamais un délai légal', () => {
    const realisee = realiserEtapeDossier(etapeAutomatique({ id: 'e-faite' }), { date: '2026-09-02', compteRendu: '' }).etape
    const elements = depuisEtapesAutomatiques(
      [
        { mandatId: 'M1', etape: etapeAutomatique() },
        { mandatId: 'M1', etape: creerEtapeDossier(saisie({ id: 'e-man', creeeLe: '2026-01-01' })) },
        { mandatId: 'M1', etape: etapeAutomatique({ id: 'e-recente', creeeLe: '2026-10-15' }) },
        { mandatId: 'M1', etape: realisee },
      ],
      '2026-10-29',
    )
    expect(elements.map((e) => [e.id, e.date])).toEqual([
      ['etapes:e-auto:automatique_non_realisee', '2026-10-01'],
      ['etapes:e-recente:automatique_non_realisee', '2026-11-14'],
    ])
    expect(elements[0]).toEqual({
      id: 'etapes:e-auto:automatique_non_realisee',
      famille: 'etapes',
      nature: 'automatique_non_realisee',
      libelle: 'Copie au CS pour info — étape automatique ouverte depuis le 01/09/2026',
      date: '2026-10-01',
      mandatId: 'M1',
      objetId: 'e-auto',
      assigneId: 'collab-B',
      aConfirmer: false,
    })
    expect(depuisEtapesAutomatiques([{ mandatId: null, etape: etapeAutomatique({ creeeLe: '2026-10-15' }) }], '2026-10-29', 7)).toEqual([
      expect.objectContaining({ date: '2026-10-22' }),
    ])
    expect(() => depuisEtapesAutomatiques([], '2026-10-29', -2)).toThrow(/jours/i)
    // e-recente (relance le 2026-11-14) est émise, mais l'horizon « maintenant » ne la retient pas encore.
    const retenus = selectionnerAFaire(elements, reglageParDefaut('collab-B'), [], '2026-10-29')
    expect(retenus.map((e) => e.id)).toEqual(['etapes:e-auto:automatique_non_realisee'])
  })

  it('relance tombant un samedi : vue le vendredi, comme tout élément du week-end ; la fiche n’est pas encore en retard', () => {
    const samedi = etapeAutomatique({ id: 'e-samedi', creeeLe: '2026-09-03' })
    const elements = depuisEtapesAutomatiques([{ mandatId: 'M1', etape: samedi }], '2026-10-02')
    expect(elements.map((e) => [e.id, e.date])).toEqual([['etapes:e-samedi:automatique_non_realisee', '2026-10-03']])
    expect(selectionnerAFaire(elements, reglageParDefaut('collab-B'), [], '2026-10-02').map((e) => e.id)).toEqual([
      'etapes:e-samedi:automatique_non_realisee',
    ])
    expect(selectionnerAFaire(elements, reglageParDefaut('collab-B'), [], '2026-10-01')).toEqual([])
    expect(etapeAutomatiqueNonRealisee(samedi, '2026-10-02')).toBeNull()
  })

  it('l’horizon de la famille Étapes, ou celui de la nature, s’applique à la relance d’étape', () => {
    const elements = depuisEtapesAutomatiques([{ mandatId: 'M1', etape: etapeAutomatique({ creeeLe: '2026-09-27' }) }], '2026-10-20')
    expect(elements.map((e) => e.date)).toEqual(['2026-10-27'])
    const avecEtapes = (regle: Partial<ReglageFamille>): ReglageSuivi => {
      const reglage = reglageParDefaut('collab-B')
      const etapes: ReglageFamille = { actif: true, perimetre: 'portefeuille', horizon: { unite: 'maintenant' }, natures: null, ...regle }
      return { ...reglage, familles: { ...reglage.familles, etapes } }
    }
    const septJours = { nombre: 7, unite: 'jours' } as const
    expect(selectionnerAFaire(elements, avecEtapes({}), [], '2026-10-20')).toEqual([])
    expect(selectionnerAFaire(elements, avecEtapes({ horizon: septJours }), [], '2026-10-20')).toHaveLength(1)
    expect(selectionnerAFaire(elements, avecEtapes({ horizonsParNature: { automatique_non_realisee: septJours } }), [], '2026-10-20')).toHaveLength(1)
    expect(selectionnerAFaire(elements, avecEtapes({ horizonsParNature: { a_faire: septJours } }), [], '2026-10-20')).toEqual([])
  })

  it('« à faire le » compte parmi les dates d’une étape à faire : une étape sans limite ni alerte remonte', () => {
    const programmee = programmerEtape(creerEtapeDossier(saisie({ limite: null })), { aFaireLe: '2026-10-27' })
    const avantLimite = creerEtapeDossier(saisie({ id: 'e-2', aFaireLe: '2026-10-25' }))
    const sansDate = creerEtapeDossier(saisie({ id: 'e-3', limite: null }))
    const elements = depuisEtapes(
      [
        { mandatId: 'M1', etape: programmee },
        { mandatId: 'M1', etape: avantLimite },
        { mandatId: 'M1', etape: sansDate },
      ],
      '2026-10-29',
    )
    expect(elements.map((e) => [e.id, e.date])).toEqual([
      ['etapes:e-1:a_faire', '2026-10-27'],
      ['etapes:e-2:a_faire', '2026-10-25'],
    ])
  })
})

describe('en-tête du module : décisions de Hugo du 03/11/2026 (J20 à J24) et 🔴 restants', () => {
  const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'etapes-dossier.ts'), 'utf8')
  const entete = source.slice(0, source.indexOf('*/')).replaceAll(/\s*\n\s*\*\s*/g, ' ')
  const decisions = entete.slice(entete.indexOf('Décisions de Hugo du 03/11/2026'), entete.indexOf('🔵 Déduits'))
  const nonEtabli = entete.slice(entete.indexOf('🔴 Non établi'), entete.indexOf('Le droit'))

  /** Ligne « - Jxx : … » de la rubrique, seule : l'intro (« J20 à J24 ») et les renvois (« usage du cabinet : J24 ») n'y comptent pas. */
  const ligneDecision = (j: string) => decisions.split(/ - (?=J\d{2} : |Question \d+ )/).find((ligne) => ligne.startsWith(`${j} : `)) ?? ''

  it('rubrique des décisions : une ligne par décision, J20 à J24, chacune avec sa teneur', () => {
    expect(entete).toContain('Décisions de Hugo du 03/11/2026')
    expect(ligneDecision('J20')).toMatch(/^J20 : une étape issue d'un « Enchaînement » porte comme créateur le collaborateur qui a déclenché l'enchaînement/)
    expect(ligneDecision('J20')).toMatch(/jamais « Automatique »/)
    expect(ligneDecision('J20')).toMatch(/crée une étape d'origine « manuelle »/)
    expect(ligneDecision('J20')).toMatch(/la règle « étape automatique non réalisée après N jours » ne vise pas l'étape enchaînée/)
    expect(ligneDecision('J21')).toMatch(/^J21 : les champs Durée sont en minutes/)
    expect(ligneDecision('J22')).toMatch(/^J22 : l'accusé de réalisation part par e-mail quand le demandeur est extérieur/)
    expect(ligneDecision('J22')).toMatch(/il reste interne \(mémo\) entre collaborateurs/)
    expect(ligneDecision('J22')).toMatch(/rien n'est envoyé/)
    expect(ligneDecision('J23')).toMatch(/^J23 : « En cours depuis » se compte depuis la création de l'étape/)
    expect(ligneDecision('J24')).toMatch(/^J24 : l'étape automatique « Copie au CS pour info » relève d'un usage du cabinet/)
    expect(ligneDecision('J24')).toMatch(/pas d'une obligation du contrat de syndic/)
    expect(ligneDecision('J24')).toMatch(/réglage activable \(UsagesEtapesCabinet, etapeCopieAuCsPourInfo\)/)
  })

  it('🔴 restants : valeur de N, délais légaux d’un processus, « à compter de la demande », canal de repli ; plus les questions tranchées', () => {
    expect(nonEtabli).toMatch(/quelle valeur de N/)
    expect(nonEtabli).toMatch(/première présentation/)
    expect(nonEtabli).toMatch(/à compter de la demande/)
    expect(nonEtabli).toMatch(/10\. Frédéric ou Hugo \(suite de J22\) : demandeur extérieur sans adresse électronique/)
    // J41 et J44 (06/11/2026) : valeur par défaut de l'usage et case « Fixe » tranchées.
    expect(nonEtabli).not.toMatch(/case « Fixe »/)
    expect(nonEtabli).not.toMatch(/11\. Hugo : l'usage « Copie au CS pour info » est-il actif par défaut/)
    expect(source).not.toMatch(/🔴 11/)
    expect(source).not.toMatch(/🔴 5\b/)
    expect(nonEtabli).not.toMatch(/« Automatique » ou le collaborateur/)
    expect(nonEtabli).not.toMatch(/unité des champs Durée/)
    expect(nonEtabli).not.toMatch(/mémo interne, e-mail/)
    expect(nonEtabli).not.toMatch(/depuis la création ou depuis/)
    expect(nonEtabli).not.toMatch(/usage du cabinet ou du contrat de syndic/)
  })

  it('rubrique « Décisions de Hugo du 06/11/2026 » : J41 (usage inactif par défaut) et J44 (case « Fixe » supprimée)', () => {
    const decisions0611 = entete.slice(entete.indexOf('Décisions de Hugo du 06/11/2026'), entete.indexOf('🔵 Déduits'))
    expect(decisions0611).toMatch(/J41 : l'usage « Copie au CS pour info » est INACTIF par défaut/)
    expect(decisions0611).toMatch(/USAGES_ETAPES_CABINET_PAR_DEFAUT/)
    expect(decisions0611).toMatch(/J44 : la case « Fixe » de « À faire le » et de « Prévue le » est supprimée/)
    expect(decisions).not.toMatch(/Question 13 \(case « Fixe »\) : non tranchée/)
    expect(source).not.toMatch(/aFaireLeFixe|validationPrevueLeFixe/)
  })

  it('aucune date ISO dans la source', () => {
    expect(source).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })
})
