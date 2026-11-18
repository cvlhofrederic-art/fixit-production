import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BASES_LIGNES_HONORAIRES_COURRIER,
  DECLENCHEUR_HONORAIRES_MISE_EN_DEMEURE,
  DESTINATAIRE_SYNDICAT,
  DECLENCHEUR_MISE_EN_DEMEURE,
  ID_REGLE_COPIE_AU_CS_POUR_INFO,
  ID_REGLE_HONORAIRES_MISE_EN_DEMEURE,
  NAISSANCES_COPIE_AU_CS,
  NAISSANCE_COPIE_AU_CS_PAR_DEFAUT,
  REGLES_ETAPES_COURRIER_PAR_DEFAUT,
  REGLES_HONORAIRES_COURRIER_PAR_DEFAUT,
  baseLigneHonorairesCourrier,
  casDesFraisDEnvoi,
  courrierDeclenche,
  courrierOrigineDe,
  creerRegleEtapeCourrier,
  creerRegleHonorairesCourrier,
  declencherEtapesDuCourrier,
  enchainerEtapeDossierSansDoublon,
  estRecouvrementContreUnCoproprietaire,
  modeRealisationDe,
  modeleSansEtapesNeesDuCourrier,
  proposerHonorairesDuCourrier,
  regleCopieAuCsPourInfo,
  regleHonorairesMiseEnDemeure,
  typesEtapesNeesDuCourrier,
  type ContexteDeclenchementEtapes,
  type ContexteHonorairesCourrier,
  type CourrierDeclencheur,
  type LigneHonorairesCourrier,
  type RegleEtapeCourrier,
  type SaisieRegleEtapeCourrier,
} from '@/lib/administrateur-judiciaire/domain/etapes-courrier'
import {
  LIBELLES_MODES_REALISATION_ETAPE,
  MODES_REALISATION_ETAPE,
  TITRE_COPIE_AU_CS_POUR_INFO,
  USAGES_ETAPES_CABINET_PAR_DEFAUT,
  creerEtapeDossier,
  enchainerEtapeDossier,
  etapeAutomatiqueNonRealisee,
  etapeCopieAuCsPourInfo,
  programmerEtape,
  realiserEtapeDossier,
  type EtapeDossier,
} from '@/lib/administrateur-judiciaire/domain/etapes-dossier'
import { creerRattachement } from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import type { Regime } from '@/lib/administrateur-judiciaire/domain/fondements'
import { creerElement, totalElement } from '@/lib/administrateur-judiciaire/domain/honoraires-facturation'
import {
  ETAPE_TYPE_COPIE_AU_CS_POUR_INFO,
  TYPES_ETAPES_PAR_DOSSIER,
  creerModeleListeControle,
  instancierModele,
  modeleDuDossier,
  processusDuDossier,
} from '@/lib/administrateur-judiciaire/domain/modeles-etapes'
import { TYPE_CONTENTIEUX } from '@/lib/data/referentiels-gesteam-judiciaire'
import { enTeteDuModule } from './en-tete-module'

/**
 * Étapes déclenchées par un courrier (point 50 du bilan 2). Gestéam : tranche 42 § Étapes du contentieux (« Copie au CS
 * pour info », Automatique, à la date de la mise en demeure, rattachement Contentieux, réalisation par Courrier) et
 * point 10 ; tranche 43 § 1 (Flux : étape, courrier de mise en demeure, lignes d'honoraires générées par le courrier et
 * forfait « MISE EN DEMEURE ») ; tranches 22 et 43 § 22 (familles et modèles de courrier) ; tranche 27 (natures et tarifs).
 */

const AUJOURDHUI = '2026-11-16'
const contentieux = creerRattachement('Contentieux', 'C-3')
const autreContentieux = creerRattachement('Contentieux', 'C-4')
const copro = creerRattachement('Copropriété', 'copro-tilleuls')
const ACTIF = { copieAuCsPourInfo: true }

const courrier = (surcharge: Partial<CourrierDeclencheur> = {}): CourrierDeclencheur => ({
  id: 'cour-1',
  modeleId: 'mod-med',
  modele: { famille: 'Contentieux', libelle: 'Mise en demeure de payer' },
  dateDepot: '2026-11-10',
  rattachements: [contentieux, copro],
  coproprieteId: 'copro-tilleuls',
  mandatId: 'M1',
  ...surcharge,
})

const contexte = (surcharge: Partial<ContexteDeclenchementEtapes> = {}): ContexteDeclenchementEtapes => ({
  aujourdhui: AUJOURDHUI,
  idEtape: ({ regle, dossier }) => `etape:${regle.id}:${dossier.id}`,
  demandeurId: 'collab-A',
  demandeurNature: 'collaborateur',
  realisateurId: 'collab-B',
  etapesExistantes: [],
  ...surcharge,
})

const copieActive = (): RegleEtapeCourrier => regleCopieAuCsPourInfo({ usages: ACTIF })

/** Règle propre au cabinet : la déclaration de sinistre fait naître l'étape type « Déclaration sinistre ». */
const saisieRegleSinistre = (surcharge: Partial<SaisieRegleEtapeCourrier> = {}): SaisieRegleEtapeCourrier => ({
  id: 'declaration-sinistre',
  libelle: 'Déclaration de sinistre envoyée',
  declencheur: { par: 'modele', modeleIds: ['mod-declaration'] },
  dossier: 'Sinistre',
  etapeType: TYPES_ETAPES_PAR_DOSSIER.Sinistre[0].etapeType,
  titre: TYPES_ETAPES_PAR_DOSSIER.Sinistre[0].titre,
  modeRealisation: 'courrier',
  active: true,
  ...surcharge,
})

// ─── La Copie au CS, premier cas de la règle « courrier → étape type » ─────────────────────

describe('Copie au CS pour info : premier cas de la règle « courrier → étape type »', () => {
  it('J41 : règle inactive par défaut ; sans réglage du cabinet, le courrier ne crée aucune étape', () => {
    expect(REGLES_ETAPES_COURRIER_PAR_DEFAUT).toHaveLength(1)
    const [regle] = REGLES_ETAPES_COURRIER_PAR_DEFAUT
    expect(regle).toMatchObject({ id: ID_REGLE_COPIE_AU_CS_POUR_INFO, active: false, etapeType: ETAPE_TYPE_COPIE_AU_CS_POUR_INFO })
    expect(regleCopieAuCsPourInfo()).toEqual(regle)
    expect(regleCopieAuCsPourInfo({ usages: USAGES_ETAPES_CABINET_PAR_DEFAUT }).active).toBe(false)
    const resultat = declencherEtapesDuCourrier(courrier(), REGLES_ETAPES_COURRIER_PAR_DEFAUT, contexte())
    expect(resultat.etapes).toEqual([])
    expect(resultat.ecartees).toEqual([
      expect.objectContaining({ regleId: ID_REGLE_COPIE_AU_CS_POUR_INFO, motif: 'inactive', dossier: null, etapeId: null }),
    ])
    expect(resultat.ecartees[0].message).toMatch(/inactive/)
  })

  it('la règle : déclenchée par les mises en demeure du contentieux (J64), étape type n° 3, réalisation par courrier', () => {
    expect(DECLENCHEUR_MISE_EN_DEMEURE).toEqual({ par: 'mise_en_demeure_contentieux' })
    expect(copieActive()).toEqual({
      id: ID_REGLE_COPIE_AU_CS_POUR_INFO,
      libelle: 'Copie au CS pour info à la mise en demeure',
      declencheur: DECLENCHEUR_MISE_EN_DEMEURE,
      dossier: 'Contentieux',
      etapeType: ETAPE_TYPE_COPIE_AU_CS_POUR_INFO,
      titre: TITRE_COPIE_AU_CS_POUR_INFO,
      modeRealisation: 'courrier',
      active: true,
    })
    expect(MODES_REALISATION_ETAPE).toEqual(['courrier'])
    expect(LIBELLES_MODES_REALISATION_ETAPE.courrier).toBe('Courrier')
  })

  it('usage activé : l’envoi de la mise en demeure crée l’étape « Automatique », à la date du dépôt, rattachée au dossier', () => {
    const { etapes, ecartees, avertissements } = declencherEtapesDuCourrier(courrier(), [copieActive()], contexte())
    expect(ecartees).toEqual([])
    expect(avertissements).toEqual([])
    expect(etapes).toEqual([
      {
        id: 'etape:copie-au-cs-pour-info:C-3',
        titre: TITRE_COPIE_AU_CS_POUR_INFO,
        etapeType: ETAPE_TYPE_COPIE_AU_CS_POUR_INFO,
        demandeurId: 'collab-A',
        realisateurId: 'collab-B',
        validateurId: null,
        limite: null,
        alerteSecurite: null,
        faitLe: null,
        valideeLe: null,
        validationSansObjet: false,
        compteRendu: '',
        creeeLe: '2026-11-10',
        origine: 'automatique',
        creeeParId: null,
        demandeurNature: 'collaborateur',
        rattachements: [contentieux],
        instructions: '',
        aFaireLe: null,
        validationPrevueLe: null,
        accuseAuDemandeur: false,
        durees: { realisationEstimee: null, realisationReelle: null, validationEstimee: null, validationReelle: null },
        courrierOrigineId: 'cour-1',
        modeRealisation: 'courrier',
      },
    ])
    expect(courrierOrigineDe(etapes[0])).toBe('cour-1')
    expect(modeRealisationDe(etapes[0])).toBe('courrier')
    // Étape automatique : la règle des N jours la vise (tranche 43 § 1).
    expect(etapeAutomatiqueNonRealisee(etapes[0], '2026-12-10')).toEqual({ relanceLe: '2026-12-10', ouverteDepuisJours: 30 })
  })

  it('non-régression : même étape que etapeCopieAuCsPourInfo (inchangée, sans les deux champs), plus le courrier d’origine et le mode', () => {
    const viaCourrier = declencherEtapesDuCourrier(courrier(), [copieActive()], contexte({ idEtape: () => 'e-copie' })).etapes[0]
    const declencheur = {
      id: 'e-copie',
      contentieuxId: 'C-3',
      miseEnDemeureLe: '2026-11-10',
      demandeurId: 'collab-A',
      demandeurNature: 'collaborateur',
      realisateurId: 'collab-B',
      etapeType: ETAPE_TYPE_COPIE_AU_CS_POUR_INFO,
    } as const
    const ancienne = etapeCopieAuCsPourInfo(declencheur, ACTIF) as EtapeDossier
    expect(viaCourrier).toEqual({ ...ancienne, courrierOrigineId: 'cour-1', modeRealisation: 'courrier' })
    expect(ancienne).not.toHaveProperty('courrierOrigineId')
    expect(ancienne).not.toHaveProperty('modeRealisation')
    expect(courrierOrigineDe(ancienne)).toBeNull()
    expect(modeRealisationDe(ancienne)).toBeNull()
    expect(etapeCopieAuCsPourInfo(declencheur)).toBeNull()
  })

  it('naissance par le courrier par défaut (J64) ; réglage « enchainement » : la règle reste inactive même usage activé', () => {
    expect(NAISSANCES_COPIE_AU_CS).toEqual(['courrier', 'enchainement'])
    expect(NAISSANCE_COPIE_AU_CS_PAR_DEFAUT).toBe('courrier')
    const regle = regleCopieAuCsPourInfo({ usages: ACTIF, naissance: 'enchainement' })
    expect(regle.active).toBe(false)
    expect(declencherEtapesDuCourrier(courrier(), [regle], contexte()).etapes).toEqual([])
    expect(() => regleCopieAuCsPourInfo({ usages: ACTIF, naissance: 'agenda' as 'courrier' })).toThrow(/naissance/i)
  })

  it('le cabinet peut remplacer le déclencheur par la liste de ses modèles de mise en demeure', () => {
    const regle = regleCopieAuCsPourInfo({ usages: ACTIF, declencheur: { par: 'modele', modeleIds: ['mod-19-2'] } })
    expect(declencherEtapesDuCourrier(courrier({ modeleId: 'mod-19-2' }), [regle], contexte()).etapes).toHaveLength(1)
    expect(declencherEtapesDuCourrier(courrier(), [regle], contexte()).etapes).toEqual([])
  })
})

// ─── Famille ou modèle ────────────────────────────────────────────────────────────────────

describe('déclencheur : un modèle ou une famille de courrier', () => {
  it('famille + libellé : casse, accents et ponctuation ignorés ; une relance de la même famille ne déclenche rien', () => {
    for (const libelle of ['MISE EN DEMEURE DE PAYER - procédure 19-2 - AR', 'Mise en demeure de payer avec décompte', 'mise-en-demeure locataire'])
      expect(courrierDeclenche(courrier({ modele: { famille: 'Contentieux', libelle } }), DECLENCHEUR_MISE_EN_DEMEURE)).toBe(true)
    const relance = courrier({ modele: { famille: 'Contentieux', libelle: 'Relance RAR' } })
    expect(courrierDeclenche(relance, DECLENCHEUR_MISE_EN_DEMEURE)).toBe(false)
    // Une règle qui ne vise pas le courrier n'est ni appliquée ni signalée.
    expect(declencherEtapesDuCourrier(relance, [copieActive()], contexte())).toEqual({
      courrierId: 'cour-1',
      etapes: [],
      ecartees: [],
      avertissements: [],
    })
  })

  it('famille différente : « RAR mise en demeure » de la Comptabilité syndic ne déclenche pas la règle par défaut', () => {
    const comptable = courrier({ modele: { famille: 'Comptabilité syndic', libelle: 'RAR mise en demeure' } })
    expect(courrierDeclenche(comptable, DECLENCHEUR_MISE_EN_DEMEURE)).toBe(false)
    expect(declencherEtapesDuCourrier(comptable, [copieActive()], contexte()).etapes).toEqual([])
  })

  it('famille sans libellé : tout courrier de la famille ; par modèle : le seul identifiant du modèle compte', () => {
    expect(courrierDeclenche(courrier({ modele: { famille: 'Contentieux', libelle: 'Relance RAR' } }), { par: 'famille', famille: 'Contentieux' })).toBe(
      true,
    )
    expect(courrierDeclenche(courrier(), { par: 'famille', famille: 'Sinistre', libelleContient: null })).toBe(false)
    const parModele = { par: 'modele', modeleIds: ['mod-declaration', 'mod-declaration-do'] } as const
    const declaration = courrier({ modeleId: 'mod-declaration-do', modele: { famille: 'Sinistre', libelle: 'déclaration sinistre DO (AR)' } })
    expect(courrierDeclenche(declaration, parModele)).toBe(true)
    // Même famille et même libellé, autre modèle : rien.
    expect(courrierDeclenche({ ...declaration, modeleId: 'mod-autre' }, parModele)).toBe(false)
  })

  it('règle propre au cabinet, par modèle : l’étape type est créée dans le dossier du type de la règle', () => {
    const regle = creerRegleEtapeCourrier(saisieRegleSinistre())
    const declaration = courrier({
      id: 'cour-decl',
      modeleId: 'mod-declaration',
      modele: { famille: 'Sinistre', libelle: 'déclaration' },
      rattachements: [creerRattachement('Sinistre', 'S-9'), contentieux],
    })
    const [etape] = declencherEtapesDuCourrier(declaration, [regle], contexte()).etapes
    expect(etape).toMatchObject({
      id: 'etape:declaration-sinistre:S-9',
      titre: 'Déclaration sinistre',
      etapeType: 'sinistre.declaration_sinistre',
      origine: 'automatique',
      rattachements: [creerRattachement('Sinistre', 'S-9')],
      courrierOrigineId: 'cour-decl',
      modeRealisation: 'courrier',
    })
  })

  it('règle contrôlée : espaces retirés, désactivée sans réglage, mode facultatif ; refus des saisies invalides', () => {
    const regle = creerRegleEtapeCourrier({
      ...saisieRegleSinistre({ active: undefined, modeRealisation: undefined }),
      id: ' r-1 ',
      declencheur: { par: 'modele', modeleIds: [' mod-a ', 'mod-a', 'mod-b'] },
    })
    expect(regle).toMatchObject({ id: 'r-1', active: false, modeRealisation: null, declencheur: { par: 'modele', modeleIds: ['mod-a', 'mod-b'] } })
    const famille = creerRegleEtapeCourrier(saisieRegleSinistre({ declencheur: { par: 'famille', famille: 'Sinistre', libelleContient: '  ' } }))
    expect(famille.declencheur).toEqual({ par: 'famille', famille: 'Sinistre', libelleContient: null })
    expect(() => creerRegleEtapeCourrier(saisieRegleSinistre({ id: ' ' }))).toThrow(/identifiant/i)
    expect(() => creerRegleEtapeCourrier(saisieRegleSinistre({ libelle: '' }))).toThrow(/libellé/i)
    expect(() => creerRegleEtapeCourrier(saisieRegleSinistre({ declencheur: { par: 'modele', modeleIds: [' '] } }))).toThrow(/au moins un modèle/i)
    expect(() =>
      creerRegleEtapeCourrier(saisieRegleSinistre({ declencheur: { par: 'famille', famille: 'Courriers divers' as 'Sinistre' } })),
    ).toThrow(/famille de modèle inconnue/i)
    expect(() => creerRegleEtapeCourrier(saisieRegleSinistre({ declencheur: { par: 'autre' } as unknown as { par: 'famille'; famille: 'Sinistre' } }))).toThrow(
      /déclencheur/i,
    )
    expect(() => creerRegleEtapeCourrier(saisieRegleSinistre({ dossier: 'Recouvrement' as 'Sinistre' }))).toThrow(/dossier inconnu/i)
    expect(() => creerRegleEtapeCourrier(saisieRegleSinistre({ etapeType: ' ' }))).toThrow(/type d’étape/i)
    expect(() => creerRegleEtapeCourrier(saisieRegleSinistre({ titre: ' ' }))).toThrow(/titre/i)
    expect(() => creerRegleEtapeCourrier(saisieRegleSinistre({ modeRealisation: 'memo' as 'courrier' }))).toThrow(/mode de réalisation inconnu/i)
  })

  it('deux règles de même identifiant : refus', () => {
    const regle = creerRegleEtapeCourrier(saisieRegleSinistre())
    expect(() => declencherEtapesDuCourrier(courrier(), [regle, regle], contexte())).toThrow(/règle « declaration-sinistre » en double/i)
  })
})

// ─── Anti-doublon ─────────────────────────────────────────────────────────────────────────

describe('anti-doublon : par dossier, type d’étape et courrier d’origine', () => {
  it('second déclenchement du même courrier : rien de nouveau, l’étape déjà née est citée', () => {
    const [etape] = declencherEtapesDuCourrier(courrier(), [copieActive()], contexte()).etapes
    const second = declencherEtapesDuCourrier(courrier(), [copieActive()], contexte({ etapesExistantes: [etape] }))
    expect(second.etapes).toEqual([])
    expect(second.ecartees).toEqual([
      expect.objectContaining({ regleId: ID_REGLE_COPIE_AU_CS_POUR_INFO, motif: 'deja_creee', dossier: contentieux, etapeId: etape.id }),
    ])
    expect(second.ecartees[0].message).toMatch(/déjà née du courrier cour-1/)
    // Réalisée entre-temps, elle compte toujours.
    const faite = realiserEtapeDossier(etape, { date: '2026-11-12', compteRendu: 'Copie envoyée' }).etape
    expect(declencherEtapesDuCourrier(courrier(), [copieActive()], contexte({ etapesExistantes: [faite] })).etapes).toEqual([])
  })

  it('une autre mise en demeure dans le même dossier crée sa propre étape (une copie par courrier)', () => {
    const [premiere] = declencherEtapesDuCourrier(courrier(), [copieActive()], contexte()).etapes
    const seconde = declencherEtapesDuCourrier(
      courrier({ id: 'cour-2', dateDepot: '2026-11-14' }),
      [copieActive()],
      contexte({ etapesExistantes: [premiere], idEtape: () => 'e-copie-2' }),
    )
    expect(seconde.etapes).toEqual([expect.objectContaining({ id: 'e-copie-2', courrierOrigineId: 'cour-2', creeeLe: '2026-11-14' })])
    expect(seconde.avertissements).toEqual([])
  })

  it('deux règles qui créent le même type pour le même courrier : une seule étape', () => {
    const parModele = regleCopieAuCsPourInfo({ usages: ACTIF, declencheur: { par: 'modele', modeleIds: ['mod-med'] } })
    const doublon = creerRegleEtapeCourrier({ ...parModele, id: 'copie-cs-par-modele' })
    const resultat = declencherEtapesDuCourrier(courrier(), [copieActive(), doublon], contexte({ idEtape: ({ regle }) => `e-${regle.id}` }))
    expect(resultat.etapes.map((e) => e.id)).toEqual(['e-copie-au-cs-pour-info'])
    expect(resultat.ecartees).toEqual([expect.objectContaining({ regleId: 'copie-cs-par-modele', motif: 'deja_creee', etapeId: 'e-copie-au-cs-pour-info' })])
  })

  it('étape du même type déjà ouverte dans le dossier sans courrier d’origine : créée, avec un avertissement non bloquant', () => {
    const manuelle = creerEtapeDossier({
      id: 'e-manuelle',
      titre: TITRE_COPIE_AU_CS_POUR_INFO,
      etapeType: ETAPE_TYPE_COPIE_AU_CS_POUR_INFO,
      creeeLe: '2026-11-09',
      origine: 'manuelle',
      creeeParId: 'collab-A',
      demandeurId: 'collab-A',
      demandeurNature: 'collaborateur',
      rattachements: [contentieux],
    })
    const resultat = declencherEtapesDuCourrier(courrier(), [copieActive()], contexte({ etapesExistantes: [manuelle] }))
    expect(resultat.etapes).toHaveLength(1)
    expect(resultat.avertissements).toEqual([expect.stringMatching(/e-manuelle.*sans courrier d’origine.*vérifier le doublon/)])
    // Réalisée, elle ne gêne plus.
    const faite = realiserEtapeDossier(manuelle, { date: '2026-11-09', compteRendu: '' }).etape
    expect(declencherEtapesDuCourrier(courrier(), [copieActive()], contexte({ etapesExistantes: [faite] })).avertissements).toEqual([])
  })

  it('identifiant d’étape déjà pris, ou identique pour deux étapes : refus', () => {
    const existante = declencherEtapesDuCourrier(courrier({ id: 'cour-0' }), [copieActive()], contexte({ idEtape: () => 'e-1' })).etapes[0]
    expect(() => declencherEtapesDuCourrier(courrier(), [copieActive()], contexte({ etapesExistantes: [existante], idEtape: () => 'e-1' }))).toThrow(
      /identifiant d’étape « e-1 » déjà pris/i,
    )
    const deuxDossiers = courrier({ rattachements: [contentieux, autreContentieux] })
    expect(() => declencherEtapesDuCourrier(deuxDossiers, [copieActive()], contexte({ idEtape: () => 'e-x' }))).toThrow(/déjà pris/i)
  })

  it('courrier rattaché à deux dossiers du type : une étape par dossier ; à aucun : règle écartée', () => {
    const deuxDossiers = declencherEtapesDuCourrier(courrier({ rattachements: [contentieux, autreContentieux] }), [copieActive()], contexte())
    expect(deuxDossiers.etapes.map((e) => e.rattachements)).toEqual([[contentieux], [autreContentieux]])
    const sansDossier = declencherEtapesDuCourrier(courrier({ rattachements: [copro] }), [copieActive()], contexte())
    expect(sansDossier.etapes).toEqual([])
    expect(sansDossier.ecartees).toEqual([expect.objectContaining({ motif: 'dossier_absent', dossier: null })])
    expect(sansDossier.ecartees[0].message).toMatch(/aucun dossier « Contentieux »/)
  })
})

// ─── Enchaînement sans doublon ───────────────────────────────────────────────────────────

describe('enchaînement : l’étape née du courrier n’est pas recréée (J64)', () => {
  const processus = processusDuDossier('Contentieux', ACTIF)
  const etapeMed = (): EtapeDossier =>
    realiserEtapeDossier(
      creerEtapeDossier({
        id: 'e-med',
        titre: 'Lettre de mise en demeure',
        etapeType: processus[1].etapeType,
        creeeLe: '2026-11-05',
        origine: 'manuelle',
        creeeParId: 'collab-A',
        demandeurId: 'collab-A',
        demandeurNature: 'collaborateur',
        rattachements: [contentieux, copro],
      }),
      { date: '2026-11-10', compteRendu: 'Envoyée' },
    ).etape
  const saisieEnchainement = { id: 'e-suivante', date: '2026-11-10', creeeParId: 'collab-A' }

  it('usage actif, naissance « courrier » : l’enchaînement ne crée pas la Copie au CS, il cite celle née du courrier', () => {
    const [nee] = declencherEtapesDuCourrier(courrier(), [copieActive()], contexte()).etapes
    const resultat = enchainerEtapeDossierSansDoublon(etapeMed(), processus, saisieEnchainement, {
      regles: [copieActive()],
      etapesExistantes: [nee],
    })
    expect(resultat).toMatchObject({ etape: null, motif: 'nee_du_courrier', etapesDuCourrier: [nee] })
    expect(resultat.message).toMatch(/naît du courrier/)
    // Sans elle, l'enchaînement direct l'aurait créée (processus Gestéam n° 3).
    expect(enchainerEtapeDossier(etapeMed(), processus, saisieEnchainement)?.etapeType).toBe(ETAPE_TYPE_COPIE_AU_CS_POUR_INFO)
  })

  it('courrier pas encore envoyé : toujours aucune création, le message renvoie à l’envoi d’un courrier visé par la règle', () => {
    const resultat = enchainerEtapeDossierSansDoublon(etapeMed(), processus, saisieEnchainement, { regles: [copieActive()], etapesExistantes: [] })
    expect(resultat).toMatchObject({ etape: null, motif: 'nee_du_courrier', etapesDuCourrier: [] })
    expect(resultat.message).toMatch(/de l’envoi d’un courrier visé par la règle/)
  })

  it('une Copie au CS née d’un courrier dans un autre dossier ne compte pas', () => {
    const [ailleurs] = declencherEtapesDuCourrier(courrier({ rattachements: [autreContentieux] }), [copieActive()], contexte()).etapes
    const resultat = enchainerEtapeDossierSansDoublon(etapeMed(), processus, saisieEnchainement, {
      regles: [copieActive()],
      etapesExistantes: [ailleurs],
    })
    expect(resultat.etapesDuCourrier).toEqual([])
  })

  it('naissance « enchainement » (réversible) : l’enchaînement la crée, comme enchainerEtapeDossier', () => {
    const regles = [regleCopieAuCsPourInfo({ usages: ACTIF, naissance: 'enchainement' })]
    const resultat = enchainerEtapeDossierSansDoublon(etapeMed(), processus, saisieEnchainement, { regles, etapesExistantes: [] })
    expect(resultat).toEqual({
      etape: enchainerEtapeDossier(etapeMed(), processus, saisieEnchainement),
      motif: null,
      message: null,
      etapesDuCourrier: [],
    })
    expect(resultat.etape?.origine).toBe('manuelle')
  })

  it('usage inactif (J41) : le processus s’arrête à la mise en demeure, fin de processus', () => {
    const resultat = enchainerEtapeDossierSansDoublon(etapeMed(), processusDuDossier('Contentieux'), saisieEnchainement, {
      regles: REGLES_ETAPES_COURRIER_PAR_DEFAUT,
      etapesExistantes: [],
    })
    expect(resultat).toEqual({ etape: null, motif: 'fin_de_processus', message: null, etapesDuCourrier: [] })
  })

  it('les autres étapes du processus s’enchaînent normalement ; les refus d’enchainerEtapeDossier sont gardés', () => {
    const ouverture = realiserEtapeDossier(
      creerEtapeDossier({
        id: 'e-ouv',
        titre: 'Ouverture de dossier',
        etapeType: processus[0].etapeType,
        creeeLe: '2026-11-01',
        origine: 'manuelle',
        creeeParId: 'collab-A',
        demandeurId: 'collab-A',
        demandeurNature: 'collaborateur',
        rattachements: [contentieux],
      }),
      { date: '2026-11-02', compteRendu: '' },
    ).etape
    const resultat = enchainerEtapeDossierSansDoublon(ouverture, processus, { ...saisieEnchainement, date: '2026-11-02' }, {
      regles: [copieActive()],
      etapesExistantes: [],
    })
    expect(resultat.etape?.titre).toBe('Lettre de mise en demeure')
    expect(resultat.motif).toBeNull()
    expect(() =>
      enchainerEtapeDossierSansDoublon(ouverture, processus, { ...saisieEnchainement, creeeParId: ' ' }, { regles: [copieActive()], etapesExistantes: [] }),
    ).toThrow(/collaborateur qui déclenche l’enchaînement/)
  })

  it('types d’étapes nés du courrier, par dossier : ceux des règles actives seulement', () => {
    expect(typesEtapesNeesDuCourrier([copieActive()], 'Contentieux')).toEqual([ETAPE_TYPE_COPIE_AU_CS_POUR_INFO])
    expect(typesEtapesNeesDuCourrier(REGLES_ETAPES_COURRIER_PAR_DEFAUT, 'Contentieux')).toEqual([])
    expect(typesEtapesNeesDuCourrier([copieActive()], 'Sinistre')).toEqual([])
    // Liste de contrôle du contentieux, usage actif : la Copie au CS y figure (question n° 5 de modeles-etapes.ts).
    const modele = modeleDuDossier('Contentieux', { id: 'm', titre: 'Contentieux' }, ACTIF)
    expect(modele.etapes.map((e) => e.etapeType)).toEqual(expect.arrayContaining(typesEtapesNeesDuCourrier([copieActive()], 'Contentieux')))
  })
})

describe('champs du courrier d’origine sur l’étape : gardés à la réalisation, jamais recopiés par l’enchaînement', () => {
  const regle = creerRegleEtapeCourrier(saisieRegleSinistre())
  const declaration = courrier({
    id: 'cour-decl',
    modeleId: 'mod-declaration',
    modele: { famille: 'Sinistre', libelle: 'déclaration' },
    rattachements: [creerRattachement('Sinistre', 'S-9')],
  })

  it('réalisée et reprogrammée, l’étape garde son courrier d’origine et son mode', () => {
    const [etape] = declencherEtapesDuCourrier(declaration, [regle], contexte()).etapes
    const faite = realiserEtapeDossier(programmerEtape(etape, { instructions: 'Joindre le constat' }), { date: '2026-11-11', compteRendu: '' }).etape
    expect(faite).toMatchObject({ courrierOrigineId: 'cour-decl', modeRealisation: 'courrier', faitLe: '2026-11-11' })
  })

  it('enchainerEtapeDossier : l’étape suivante n’a ni courrier d’origine ni mode (J20 : geste du collaborateur)', () => {
    const [etape] = declencherEtapesDuCourrier(declaration, [regle], contexte()).etapes
    const faite = realiserEtapeDossier(etape, { date: '2026-11-11', compteRendu: '' }).etape
    const suivante = enchainerEtapeDossier(faite, processusDuDossier('Sinistre'), { id: 'e-2', date: '2026-11-11', creeeParId: 'collab-A' }) as EtapeDossier
    expect(suivante).toMatchObject({ titre: 'Information lésé', origine: 'manuelle', creeeParId: 'collab-A' })
    expect(suivante).not.toHaveProperty('courrierOrigineId')
    expect(suivante).not.toHaveProperty('modeRealisation')
  })

  it('lecture : valeur absente = null ; mode inconnu (donnée corrompue) refusé', () => {
    const [etape] = declencherEtapesDuCourrier(declaration, [regle], contexte()).etapes
    expect(modeRealisationDe({ ...etape, modeRealisation: null })).toBeNull()
    expect(courrierOrigineDe({ ...etape, courrierOrigineId: null })).toBeNull()
    expect(() => modeRealisationDe({ ...etape, modeRealisation: 'fax' as 'courrier' })).toThrow(/mode de réalisation inconnu/i)
  })
})

// ─── Dates et contrôles du courrier ──────────────────────────────────────────────────────

describe('courrier déclencheur : dates et contrôles', () => {
  it('courrier non envoyé (pas de dépôt) : refus, les étapes naissent de l’envoi', () => {
    expect(() => declencherEtapesDuCourrier(courrier({ dateDepot: null }), [copieActive()], contexte())).toThrow(/n’est pas envoyé/)
    // Même règles inactives : l'entrée est contrôlée.
    expect(() => declencherEtapesDuCourrier(courrier({ dateDepot: null }), REGLES_ETAPES_COURRIER_PAR_DEFAUT, contexte())).toThrow(/n’est pas envoyé/)
  })

  it('dates invalides : dépôt hors AAAA-MM-JJ, après aujourd’hui, année improbable ; date du jour invalide', () => {
    expect(() => declencherEtapesDuCourrier(courrier({ dateDepot: '10/11/2026' }), [copieActive()], contexte())).toThrow(/AAAA-MM-JJ/)
    expect(() => declencherEtapesDuCourrier(courrier({ dateDepot: '2026-02-30' }), [copieActive()], contexte())).toThrow(/AAAA-MM-JJ/)
    expect(() => declencherEtapesDuCourrier(courrier({ dateDepot: '2026-11-17' }), [copieActive()], contexte())).toThrow(/après aujourd'hui/)
    expect(() => declencherEtapesDuCourrier(courrier({ dateDepot: '1026-11-10' }), [copieActive()], contexte())).toThrow(/année improbable/)
    expect(() => declencherEtapesDuCourrier(courrier(), [copieActive()], contexte({ aujourdhui: '16/11/2026' }))).toThrow()
    // Le jour même : admis.
    expect(declencherEtapesDuCourrier(courrier({ dateDepot: AUJOURDHUI }), [copieActive()], contexte()).etapes[0].creeeLe).toBe(AUJOURDHUI)
  })

  it('identifiants du courrier et du modèle obligatoires ; famille du modèle contrôlée ; rattachements contrôlés', () => {
    expect(() => declencherEtapesDuCourrier(courrier({ id: ' ' }), [copieActive()], contexte())).toThrow(/identifiant du courrier/i)
    expect(() => declencherEtapesDuCourrier(courrier({ modeleId: '' }), [copieActive()], contexte())).toThrow(/modèle du courrier/i)
    expect(() =>
      declencherEtapesDuCourrier(courrier({ modele: { famille: 'Recouvrement' as 'Contentieux', libelle: 'x' } }), [copieActive()], contexte()),
    ).toThrow(/famille de modèle inconnue/i)
    expect(() =>
      declencherEtapesDuCourrier(courrier({ rattachements: [{ type: 'Contentieux', id: ' ' }] }), [copieActive()], contexte()),
    ).toThrow(/identifiant attendu/)
  })

  it('les contrôles de creerEtapeDossier s’appliquent à l’étape créée (demandeur, nature)', () => {
    expect(() => declencherEtapesDuCourrier(courrier(), [copieActive()], contexte({ demandeurId: ' ' }))).toThrow(/demandeur/i)
    expect(() =>
      declencherEtapesDuCourrier(courrier(), [copieActive()], contexte({ demandeurNature: 'syndic' as 'collaborateur' })),
    ).toThrow(/nature du demandeur/i)
  })
})

// ─── Proposition de lignes d'honoraires (désactivée par défaut) ──────────────────────────

const ligneAr: LigneHonorairesCourrier = {
  objet: 'frais_envoi',
  nature: 'AR',
  tarif: 'Gestion - RAR',
  quantite: 1,
  prixUnitaireHtDixMilliemes: 61_000,
  soumisTva: true,
  tauxTvaPct: 20,
  destinataire: 'Syndicat des copropriétaires',
}
const ligneForfait: LigneHonorairesCourrier = {
  objet: 'forfait_mise_en_demeure',
  nature: 'Honoraires',
  tarif: 'Contentieux - MISE EN DEMEURE',
  quantite: 1,
  prixUnitaireHtDixMilliemes: 300_000,
  soumisTva: true,
  tauxTvaPct: 20,
  // J67, R7 : le cabinet facture le forfait au syndicat, qui le paie
  destinataire: 'Syndicat des copropriétaires',
}

const contexteHonoraires = (surcharge: Partial<ContexteHonorairesCourrier> = {}): ContexteHonorairesCourrier => ({
  mission: 'judiciaire',
  aujourdhui: AUJOURDHUI,
  idElement: ({ regle, rang, dossier }) => `el:${regle.id}:${dossier.id}:${rang}`,
  ...surcharge,
})
/** J72 (a) : le dossier visé poursuit un copropriétaire en retard (lu par l'appelant sur la fiche du contentieux). */
const RECOUVREMENT = { recouvrementContreUnCoproprietaire: true } as const
const IMPUTATION_ART_10_1_A = {
  a: 'coproprietaire_en_retard',
  fondement: 'L. 1965 art. 10-1, a',
  conditions: ['créance justifiée', 'mise en demeure partie (une relance faite avant elle n’est pas visée)', 'coût nécessaire'],
}

describe('honoraires du courrier : proposition de lignes, jamais écrites, désactivée par défaut', () => {
  it('par défaut : aucune règle, aucun montant ; la règle de la mise en demeure exige les lignes du cabinet et reste inactive', () => {
    expect(REGLES_HONORAIRES_COURRIER_PAR_DEFAUT).toEqual([])
    expect(proposerHonorairesDuCourrier(courrier(), REGLES_HONORAIRES_COURRIER_PAR_DEFAUT, contexteHonoraires())).toEqual({
      courrierId: 'cour-1',
      propositions: [],
      ecartees: [],
    })
    expect(() => regleHonorairesMiseEnDemeure({ lignes: [] })).toThrow(/au moins une ligne/i)
    const inactive = regleHonorairesMiseEnDemeure({ lignes: [ligneAr, ligneForfait] })
    // Déclencheur d'avant J64, inchangé (J64 ne vise que la Copie au CS).
    expect(DECLENCHEUR_HONORAIRES_MISE_EN_DEMEURE).toEqual({ par: 'famille', famille: 'Contentieux', libelleContient: 'mise en demeure' })
    expect(inactive).toMatchObject({ id: ID_REGLE_HONORAIRES_MISE_EN_DEMEURE, active: false, dossier: 'Contentieux', declencheur: DECLENCHEUR_HONORAIRES_MISE_EN_DEMEURE })
    const resultat = proposerHonorairesDuCourrier(courrier(), [inactive], contexteHonoraires())
    expect(resultat.propositions).toEqual([])
    expect(resultat.ecartees).toEqual([expect.objectContaining({ regleId: ID_REGLE_HONORAIRES_MISE_EN_DEMEURE, motif: 'inactive' })])
  })

  it('activée : frais d’envoi et forfait proposés en saisies d’éléments (dossier et fiche du contentieux, date du dépôt)', () => {
    const regle = regleHonorairesMiseEnDemeure({ lignes: [ligneAr, ligneForfait], active: true })
    const { propositions, ecartees } = proposerHonorairesDuCourrier(courrier(), [regle], contexteHonoraires(RECOUVREMENT))
    expect(ecartees).toEqual([])
    expect(propositions.map((p) => p.saisie)).toEqual([
      {
        id: 'el:honoraires-mise-en-demeure:C-3:1',
        coproprieteId: 'copro-tilleuls',
        mandatId: 'M1',
        date: '2026-11-10',
        dossier: 'Contentieux',
        fiche: contentieux,
        nature: 'AR',
        tarif: 'Gestion - RAR',
        calcul: 'Coût unitaire',
        quantite: 1,
        prixUnitaireHtDixMilliemes: 61_000,
        soumisTva: true,
        tauxTvaPct: 20,
        destinataire: 'Syndicat des copropriétaires',
        // J72 (a) : en mission judiciaire, l'envoi de la mise en demeure est une dépense du syndicat ; la ligne du
        // cabinet n'en est que la trace
        qualification: 'Contrôle coûts',
      },
      {
        id: 'el:honoraires-mise-en-demeure:C-3:2',
        coproprieteId: 'copro-tilleuls',
        mandatId: 'M1',
        date: '2026-11-10',
        dossier: 'Contentieux',
        fiche: contentieux,
        nature: 'Honoraires',
        tarif: 'Contentieux - MISE EN DEMEURE',
        calcul: 'Coût unitaire',
        quantite: 1,
        prixUnitaireHtDixMilliemes: 300_000,
        soumisTva: true,
        tauxTvaPct: 20,
        destinataire: 'Syndicat des copropriétaires',
      },
    ])
    // La saisie proposée passe creerElement, que l'appelant appelle s'il retient la proposition.
    const element = creerElement(propositions[1].saisie, 'judiciaire')
    expect(element.statut).toBe('A facturer')
    expect(totalElement(element)).toEqual({ htCentimes: 3_000, tvaCentimes: 600, ttcCentimes: 3_600 })
  })

  it('J67, R7 : forfait en deux lignes, payé par le syndicat puis imputable au copropriétaire en retard, aConfirmer gardé ; J72 (a) : frais d’envoi, dépense du syndicat', () => {
    const regle = regleHonorairesMiseEnDemeure({ lignes: [ligneAr, ligneForfait], active: true })
    const [frais, forfait] = proposerHonorairesDuCourrier(courrier(), [regle], contexteHonoraires(RECOUVREMENT)).propositions
    const imputation = IMPUTATION_ART_10_1_A
    expect(forfait).toMatchObject({ objet: 'forfait_mise_en_demeure', aConfirmer: true, fondements: ['L. 1965 art. 10-1, a'] })
    expect(forfait.repartition).toEqual({ payeur: 'syndicat', paiement: 'facture_du_cabinet', imputation })
    expect(forfait.observation).toMatch(/^Deux lignes \(J67, R7\) : le cabinet facture le forfait au syndicat, qui le paie/)
    expect(forfait.observation).toMatch(/une relance faite avant la mise en demeure n'est pas visée\. Montant et tarif : réglage du cabinet, aucun montant par défaut\.$/)
    // J72 (a) : dépense du syndicat, payée sur son compte avec la pièce du prestataire postal, imputée au seul
    // copropriétaire en retard (L. 1965 art. 10-1, a) ; décidée, plus « à confirmer »
    expect(frais).toMatchObject({ objet: 'frais_envoi', aConfirmer: false, fondements: ['L. 1965 art. 10-1, a'] })
    expect(frais.repartition).toEqual({ payeur: 'syndicat', paiement: 'piece_du_prestataire_postal', imputation })
    expect(frais.observation).toMatch(/^Dépense du syndicat \(J72, a\) : /)
    expect(frais.observation).toContain('pièce du prestataire postal')
    expect(frais.observation).toContain('« notamment les frais de mise en demeure »')
    expect(frais.observation).toMatch(/ni remboursée au cabinet ni facturée par lui/)
    expect(frais.observation).not.toMatch(/Hugo|Frédéric|À trancher|R5 ou R6|à confirmer/)
    expect(BASES_LIGNES_HONORAIRES_COURRIER.forfait_mise_en_demeure.aConfirmer).toBe(true)
  })

  it('J72 (a) : en mission judiciaire, la ligne d’envoi du recouvrement n’est qu’une trace (Contrôle coûts) ; « Facturable » est refusé', () => {
    const regle = (qualification?: 'Facturable' | 'Contrôle coûts') =>
      regleHonorairesMiseEnDemeure({ lignes: [{ ...ligneAr, ...(qualification ? { qualification } : {}) }], active: true })
    const [trace] = proposerHonorairesDuCourrier(courrier(), [regle()], contexteHonoraires(RECOUVREMENT)).propositions
    expect(trace.saisie.qualification).toBe('Contrôle coûts')
    // l'élément, s'il est enregistré, ne se facture pas (point 67 : hors facture, statut inchangé)
    expect(creerElement(trace.saisie, 'judiciaire').qualification).toBe('Contrôle coûts')
    expect(proposerHonorairesDuCourrier(courrier(), [regle('Contrôle coûts')], contexteHonoraires(RECOUVREMENT)).propositions[0].saisie.qualification).toBe('Contrôle coûts')
    expect(() => proposerHonorairesDuCourrier(courrier(), [regle('Facturable')], contexteHonoraires(RECOUVREMENT))).toThrow(
      /ligne 1 \(frais d’envoi\) : « Facturable » refusé.*dépense du syndicat.*pièce du prestataire postal.*L\. 1965 art\. 10-1, a ; J72, a\)/,
    )
    // contrat type de syndic (sans objet pour le cabinet) : remboursés au syndic, la ligne du cabinet reste telle quelle
    const [syndic] = proposerHonorairesDuCourrier(courrier(), [regle()], contexteHonoraires({ mission: 'contrat_type_syndic', ...RECOUVREMENT })).propositions
    expect(syndic.saisie).not.toHaveProperty('qualification')
    expect(syndic.observation).toMatch(/contrat type de syndic.*7\.1\.5 et 7\.2\.1.*9\.1/i)
  })

  it('J72 (b) : autres envois du cabinet (sinistre, gestion) : frais du cabinet, à présenter au juge, payés seulement en vertu de son ordonnance', () => {
    const sinistre = creerRattachement('Sinistre', 'S-7')
    const regle = creerRegleHonorairesCourrier({
      id: 'frais-sinistre',
      libelle: 'Frais d’envoi du sinistre',
      declencheur: { par: 'famille', famille: 'Sinistre' },
      dossier: 'Sinistre',
      lignes: [ligneAr],
      active: true,
    })
    const courrierSinistre = courrier({ modele: { famille: 'Sinistre', libelle: 'Déclaration de sinistre' }, rattachements: [sinistre, copro] })
    const [frais] = proposerHonorairesDuCourrier(courrierSinistre, [regle], contexteHonoraires({ regime: 'ap291' })).propositions
    // relecture : fondement de J72 (b), l'ordonnance qui arrête les frais et débours (J67, R5), pas D. 1967 art. 61-1-5, II
    expect(frais).toMatchObject({ objet: 'frais_envoi', aConfirmer: false, fondements: ['C. com. R. 814-27', 'Cass. 3e civ., 21/05/2026, n° 24-20.377'] })
    expect(frais.repartition).toEqual({ payeur: 'syndicat', paiement: 'ordonnance_du_juge', imputation: null })
    expect(frais.observation).toMatch(/^À présenter au juge \(J72, b\) : frais du cabinet, à part de sa rémunération/)
    expect(frais.observation).toContain('annexe « frais et débours »')
    expect(frais.observation).toContain('payés seulement en vertu de son ordonnance')
    expect(frais.observation).toContain('frais et débours arrêtés par l’ordonnance du président, Cass. 3e civ., 21/05/2026, n° 24-20.377 (J67, R5)')
    expect(frais.observation).not.toMatch(/61-1-5, II|Hugo|Frédéric|à confirmer|contrat type/)
    // la ligne reste un frais du cabinet : qualification du cabinet gardée (la facture exige l'ordonnance, J67, R3)
    expect(frais.saisie).not.toHaveProperty('qualification')
    // même base quel que soit le régime ; par défaut : celle des autres envois (BASES_LIGNES_HONORAIRES_COURRIER)
    for (const regime of [null, 'sj', 'ap47', 'ap291'] as const)
      expect(baseLigneHonorairesCourrier('frais_envoi', { regime, cas: 'autre_envoi' })).toEqual(BASES_LIGNES_HONORAIRES_COURRIER.frais_envoi)
    expect(baseLigneHonorairesCourrier('frais_envoi')).toEqual(BASES_LIGNES_HONORAIRES_COURRIER.frais_envoi)
    expect(BASES_LIGNES_HONORAIRES_COURRIER.frais_envoi.repartition.paiement).toBe('ordonnance_du_juge')
    expect(() => baseLigneHonorairesCourrier('frais_envoi', { cas: 'contentieux' as 'autre_envoi' })).toThrow(/cas des frais d’envoi inconnu « contentieux »/)
    expect(() => baseLigneHonorairesCourrier('frais_envoi', { mission: 'conventionnelle' as 'judiciaire' })).toThrow(/mission inconnue « conventionnelle »/)
  })

  it('J67, R7 : le forfait se facture au syndicat, qui le paie ; un autre destinataire est refusé', () => {
    const autre = { ...ligneForfait, destinataire: 'Copropriétaire débiteur' }
    expect(() => regleHonorairesMiseEnDemeure({ lignes: [autre] })).toThrow(
      /\(forfait de mise en demeure\) : destinataire « Copropriétaire débiteur » refusé.*J67, R7.*« Syndicat des copropriétaires »/,
    )
    // la saisie proposée et le payeur disent la même chose, quel que soit le régime
    const regle = regleHonorairesMiseEnDemeure({ lignes: [ligneForfait], active: true })
    for (const regime of [null, 'sj', 'ap47', 'ap291'] as const) {
      const [forfait] = proposerHonorairesDuCourrier(courrier(), [regle], contexteHonoraires({ regime })).propositions
      expect([forfait.saisie.destinataire, forfait.repartition?.payeur]).toEqual([DESTINATAIRE_SYNDICAT, 'syndicat'])
    }
    // frais d'envoi : destinataire laissé au cabinet (J72, a : en mission judiciaire, la ligne n'est qu'une trace)
    expect(() => regleHonorairesMiseEnDemeure({ lignes: [{ ...ligneAr, destinataire: 'Copropriétaire débiteur' }] })).not.toThrow()
  })

  it('J67, R7 : selon le régime du mandat ; sous l’art. 29-1, montant à présenter au juge ; sous les art. 46 et 47, aucun texte', () => {
    const regle = regleHonorairesMiseEnDemeure({ lignes: [ligneAr, ligneForfait], active: true })
    const propositions = (regime: Regime | null) => proposerHonorairesDuCourrier(courrier(), [regle], contexteHonoraires({ regime, ...RECOUVREMENT })).propositions
    const [fraisAp, forfaitAp] = propositions('ap291')
    expect(forfaitAp).toMatchObject({ aConfirmer: true, fondements: ['L. 1965 art. 10-1, a', 'L. 1965 art. 29-1, II', 'D. 1967 art. 61-1-5, II', 'arrêté du 08/10/2015, art. 14'] })
    expect(forfaitAp.observation).toMatch(/à présenter au juge dans le compte provisoire détaillé \(D\. 1967 art\. 61-1-5, II ; arrêté du 08\/10\/2015, art\. 14\) ; seule la somme admise et payée par le syndicat est imputée au copropriétaire/)
    expect(forfaitAp.observation).toMatch(/aucun arrêt lu : à confirmer\.$/)
    for (const regime of ['sj', 'ap47'] as const) {
      const [, forfait] = propositions(regime)
      expect(forfait.fondements).toEqual(['L. 1965 art. 10-1, a'])
      expect(forfait.observation).toMatch(/aucun contrat type voté ; les art\. 46 et 47 du décret ne disent rien de ce forfait : à confirmer\.$/)
    }
    expect(propositions(null)[1]).toMatchObject(BASES_LIGNES_HONORAIRES_COURRIER.forfait_mise_en_demeure)
    expect(baseLigneHonorairesCourrier('forfait_mise_en_demeure', { regime: 'ap291' }).observation).toBe(forfaitAp.observation)
    // frais d'envoi du recouvrement : même base quel que soit le régime (J72, a)
    expect(fraisAp).toMatchObject(baseLigneHonorairesCourrier('frais_envoi', { cas: 'recouvrement' }))
    expect(() => propositions('ap99' as Regime)).toThrow(/Régime du mandat « ap99 » inconnu/)
  })

  it('qualification et calcul repris de la ligne du cabinet (point 67)', () => {
    const regle = regleHonorairesMiseEnDemeure({
      lignes: [{ ...ligneForfait, qualification: 'Contrôle coûts', calcul: 'Barème temps', quantite: 30 }],
      active: true,
    })
    const [proposition] = proposerHonorairesDuCourrier(courrier(), [regle], contexteHonoraires()).propositions
    expect(proposition.saisie).toMatchObject({ qualification: 'Contrôle coûts', calcul: 'Barème temps', quantite: 30 })
  })

  it('J67, R9 : une ligne « Offert » est refusée en mission judiciaire, admise au contrat type de syndic', () => {
    const regle = regleHonorairesMiseEnDemeure({ lignes: [{ ...ligneForfait, qualification: 'Offert' }], active: true })
    expect(() => proposerHonorairesDuCourrier(courrier(), [regle], contexteHonoraires())).toThrow(
      /Qualification « Offert » refusée\. Mission judiciaire : tracer en Contrôle coûts/,
    )
    const [proposition] = proposerHonorairesDuCourrier(courrier(), [regle], contexteHonoraires({ mission: 'contrat_type_syndic' })).propositions
    expect(proposition.saisie.qualification).toBe('Offert')
  })

  it('J67, R7 et R9 : un régime de mandat de justice exige la mission « judiciaire » ; le contexte incohérent est refusé', () => {
    const regle = regleHonorairesMiseEnDemeure({ lignes: [{ ...ligneForfait, qualification: 'Offert' }], active: true })
    for (const regime of ['sj', 'ap47', 'ap291'] as const) {
      // sinon « Offert » passerait, alors que la base dit le forfait soumis au juge (ap291)
      expect(() => proposerHonorairesDuCourrier(courrier(), [regle], contexteHonoraires({ mission: 'contrat_type_syndic', regime }))).toThrow(
        new RegExp(`Contexte incohérent : régime « ${regime} » \\(mandat de justice\\) et mission « contrat_type_syndic »`),
      )
      // refusé avant toute règle : le contexte seul est en cause
      expect(() =>
        proposerHonorairesDuCourrier(courrier(), REGLES_HONORAIRES_COURRIER_PAR_DEFAUT, contexteHonoraires({ mission: 'contrat_type_syndic', regime })),
      ).toThrow(/Contexte incohérent/)
    }
    // régime inconnu : la mission seule décide
    expect(proposerHonorairesDuCourrier(courrier(), [regle], contexteHonoraires({ mission: 'contrat_type_syndic', regime: null })).propositions).toHaveLength(1)
  })

  it('écartées : dossier absent, dossier ambigu (un envoi, une série de frais), copropriété ou mandat manquants ; courrier non visé : rien', () => {
    const regle = regleHonorairesMiseEnDemeure({ lignes: [ligneAr], active: true })
    const motif = (c: CourrierDeclencheur) => proposerHonorairesDuCourrier(c, [regle], contexteHonoraires()).ecartees.map((e) => e.motif)
    expect(motif(courrier({ rattachements: [copro] }))).toEqual(['dossier_absent'])
    expect(motif(courrier({ rattachements: [contentieux, autreContentieux] }))).toEqual(['dossier_ambigu'])
    expect(motif(courrier({ mandatId: null }))).toEqual(['rattachement_incomplet'])
    expect(motif(courrier({ coproprieteId: ' ' }))).toEqual(['rattachement_incomplet'])
    expect(proposerHonorairesDuCourrier(courrier({ modele: { famille: 'Contentieux', libelle: 'Relance RAR' } }), [regle], contexteHonoraires())).toEqual({
      courrierId: 'cour-1',
      propositions: [],
      ecartees: [],
    })
  })

  it('refus : frais d’envoi d’une nature de rémunération, ligne invalide, identifiants d’élément en double, dates invalides', () => {
    expect(() => regleHonorairesMiseEnDemeure({ lignes: [{ ...ligneAr, nature: 'Honoraires' }] })).toThrow(/frais d’envoi.*nature de frais/i)
    expect(() => regleHonorairesMiseEnDemeure({ lignes: [{ ...ligneAr, prixUnitaireHtDixMilliemes: 6.1 }] })).toThrow(/prix unitaire/i)
    expect(() => regleHonorairesMiseEnDemeure({ lignes: [{ ...ligneAr, quantite: 0 }] })).toThrow(/quantité/i)
    expect(() => regleHonorairesMiseEnDemeure({ lignes: [{ ...ligneAr, tauxTvaPct: -1 }] })).toThrow(/taux de TVA/i)
    expect(() => regleHonorairesMiseEnDemeure({ lignes: [{ ...ligneAr, tarif: ' ' }] })).toThrow(/tarif/i)
    expect(() => regleHonorairesMiseEnDemeure({ lignes: [{ ...ligneAr, destinataire: '' }] })).toThrow(/destinataire/i)
    expect(() => regleHonorairesMiseEnDemeure({ lignes: [{ ...ligneAr, objet: 'relance' as 'frais_envoi' }] })).toThrow(/objet de ligne inconnu/i)
    expect(() => regleHonorairesMiseEnDemeure({ lignes: [{ ...ligneAr, nature: 'Fax' as 'AR' }] })).toThrow(/nature d’élément inconnue/i)
    expect(() => regleHonorairesMiseEnDemeure({ lignes: [{ ...ligneAr, qualification: 'Gratuit' as 'Offert' }] })).toThrow(/qualification inconnue/i)
    expect(() =>
      creerRegleHonorairesCourrier({ id: ' ', libelle: 'x', declencheur: DECLENCHEUR_MISE_EN_DEMEURE, dossier: 'Contentieux', lignes: [ligneAr] }),
    ).toThrow(/identifiant/i)
    const regle = regleHonorairesMiseEnDemeure({ lignes: [ligneAr, ligneForfait], active: true })
    expect(() => proposerHonorairesDuCourrier(courrier(), [regle], contexteHonoraires({ idElement: () => 'el-1' }))).toThrow(/en double/i)
    expect(() => proposerHonorairesDuCourrier(courrier({ dateDepot: null }), [regle], contexteHonoraires())).toThrow(/n’est pas envoyé/)
    expect(() => proposerHonorairesDuCourrier(courrier({ dateDepot: '2026-11-30' }), [regle], contexteHonoraires())).toThrow(/après aujourd'hui/)
  })
})

// ─── J72, relecture : le cas des frais d'envoi suit le courrier, le dossier poursuivi et la mission ──

describe('J72, relecture : cas des frais d’envoi selon la nature du courrier, le dossier poursuivi et la mission', () => {
  const SANS_RECOUVREMENT = { recouvrementContreUnCoproprietaire: false } as const
  const regleDuDossier = (dossier: 'Contentieux' | 'Comptabilité' | 'Sinistre', qualification?: 'Facturable') =>
    creerRegleHonorairesCourrier({
      id: `frais-${dossier}`,
      libelle: `Frais d’envoi (${dossier})`,
      declencheur: { par: 'famille', famille: dossier === 'Comptabilité' ? 'Comptabilité syndic' : dossier },
      dossier,
      lignes: [{ ...ligneAr, ...(qualification ? { qualification } : {}) }],
      active: true,
    })
  const fraisDe = (c: CourrierDeclencheur, surcharge: Partial<ContexteHonorairesCourrier>, regle = regleDuDossier('Contentieux')) =>
    proposerHonorairesDuCourrier(c, [regle], contexteHonoraires(surcharge)).propositions[0]
  const BASE_B = { aConfirmer: false, repartition: { payeur: 'syndicat', paiement: 'ordonnance_du_juge', imputation: null } }
  const comptabilite = creerRattachement('Comptabilité', 'CPT-12')
  const sinistre = creerRattachement('Sinistre', 'S-7')

  it('type du contentieux : seul « Recouvrement de charges/loyer » avec un compte débiteur poursuit un copropriétaire en retard', () => {
    expect(estRecouvrementContreUnCoproprietaire({ type: 'Recouvrement de charges/loyer', compteId: 'cpt-12' })).toBe(true)
    // sans compte débiteur, le débiteur n'est pas établi (un locataire, pour un loyer)
    expect(estRecouvrementContreUnCoproprietaire({ type: 'Recouvrement de charges/loyer', compteId: null })).toBeNull()
    expect(estRecouvrementContreUnCoproprietaire({ type: 'Recouvrement de charges/loyer', compteId: ' ' })).toBeNull()
    for (const type of TYPE_CONTENTIEUX.filter((t) => t !== 'Recouvrement de charges/loyer'))
      expect(estRecouvrementContreUnCoproprietaire({ type, compteId: 'cpt-12' }), type).toBe(false)
  })

  it('« Litige entreprise » ou « Garantie décennale » : la mise en demeure de l’entreprise relève de J72 (b), rien n’est imputé à un copropriétaire', () => {
    const entreprise = courrier({ modele: { famille: 'Contentieux', libelle: "Mise en demeure de l'entreprise de reprendre les désordres" } })
    for (const type of ['Litige entreprise', 'Garantie décennale'] as const) {
      const frais = fraisDe(entreprise, { recouvrementContreUnCoproprietaire: estRecouvrementContreUnCoproprietaire({ type, compteId: null }) })
      expect(frais, type).toMatchObject(BASE_B)
      expect(frais.saisie, type).not.toHaveProperty('qualification')
    }
    // « Facturable » n'y est pas refusé : un frais du cabinet, facturé en vertu de l'ordonnance (J67, R3)
    expect(fraisDe(entreprise, SANS_RECOUVREMENT, regleDuDossier('Contentieux', 'Facturable')).saisie.qualification).toBe('Facturable')
  })

  it('dossier qui ne dit pas s’il poursuit un copropriétaire : à confirmer, sans imputation ni refus de « Facturable » (jamais d’imputation par défaut)', () => {
    const frais = fraisDe(courrier(), {})
    expect(frais).toMatchObject({ aConfirmer: true, repartition: { payeur: 'syndicat', paiement: 'ordonnance_du_juge', imputation: null } })
    expect(frais.observation).toMatch(/^À confirmer \(J72\) : /)
    expect(frais.observation).toMatch(/J72, a.*J72, b/)
    expect(frais.saisie).not.toHaveProperty('qualification')
    expect(fraisDe(courrier(), { recouvrementContreUnCoproprietaire: null }, regleDuDossier('Contentieux', 'Facturable')).saisie.qualification).toBe('Facturable')
  })

  it('mise en demeure adressée à un locataire, ou envoi qui n’est ni une mise en demeure ni une relance : J72 (b), même au recouvrement', () => {
    const locataire = courrier({ modele: { famille: 'Contentieux', libelle: 'Mise en demeure de payer - locataire' } })
    expect(fraisDe(locataire, RECOUVREMENT)).toMatchObject(BASE_B)
    const huissier = courrier({ modele: { famille: 'Contentieux', libelle: "Transmission du dossier à l'huissier" } })
    expect(fraisDe(huissier, RECOUVREMENT)).toMatchObject(BASE_B)
    expect(fraisDe(huissier, {})).toMatchObject(BASE_B)
    expect(casDesFraisDEnvoi({ famille: 'Contentieux', libelle: 'Procédure 19-2' }, true)).toBe('recouvrement')
    expect(casDesFraisDEnvoi({ famille: 'Contentieux', libelle: 'Relance RAR' }, true)).toBe('recouvrement')
    expect(casDesFraisDEnvoi({ famille: 'Contentieux', libelle: 'Relance RAR' }, false)).toBe('autre_envoi')
    expect(casDesFraisDEnvoi({ famille: 'Contentieux', libelle: 'Relance RAR' }, null)).toBe('non_etabli')
    // « remise en demeure » n'est pas « mise en demeure » (mots entiers)
    expect(casDesFraisDEnvoi({ famille: 'Contentieux', libelle: 'Remise en demeure' }, true)).toBe('autre_envoi')
  })

  it('mise en demeure ou relance hors du dossier Contentieux (« Comptabilité syndic - RAR mise en demeure », dossier Comptabilité) : J72 (a)', () => {
    const regle = regleDuDossier('Comptabilité')
    const rar = courrier({ modele: { famille: 'Comptabilité syndic', libelle: 'RAR mise en demeure' }, rattachements: [comptabilite, copro] })
    const frais = fraisDe(rar, RECOUVREMENT, regle)
    expect(frais).toMatchObject({ aConfirmer: false, repartition: { payeur: 'syndicat', paiement: 'piece_du_prestataire_postal', imputation: IMPUTATION_ART_10_1_A } })
    expect(frais.saisie).toMatchObject({ dossier: 'Comptabilité', fiche: comptabilite, qualification: 'Contrôle coûts' })
    expect(() => fraisDe(rar, RECOUVREMENT, regleDuDossier('Comptabilité', 'Facturable'))).toThrow(/« Facturable » refusé.*J72, a/)
    // non établi : à confirmer, et non plus « frais du cabinet à présenter au juge »
    expect(fraisDe(rar, {}, regle)).toMatchObject({ aConfirmer: true, repartition: { imputation: null } })
    const relance = courrier({ modele: { famille: 'Comptabilité syndic', libelle: 'Relance appel de fonds impayé' }, rattachements: [comptabilite, copro] })
    expect(fraisDe(relance, RECOUVREMENT, regle).repartition.paiement).toBe('piece_du_prestataire_postal')
  })

  it('mission au contrat type de syndic : remboursés au syndic sur sa facture (7.1.5, 7.2.1), jamais « à présenter au juge » ; imputés au recouvrement (9.1)', () => {
    const SYNDIC = { mission: 'contrat_type_syndic' } as const
    const recouvrement = fraisDe(courrier(), { ...SYNDIC, ...RECOUVREMENT })
    expect(recouvrement).toMatchObject({ aConfirmer: false, repartition: { payeur: 'syndicat', paiement: 'facture_du_cabinet', imputation: IMPUTATION_ART_10_1_A } })
    expect(recouvrement.fondements).toEqual(['D. 1967 annexe 1, 7.1.5 et 7.2.1', 'L. 1965 art. 10-1, a', 'D. 1967 annexe 1, 9.1'])
    const declaration = courrier({ modele: { famille: 'Sinistre', libelle: 'Déclaration de sinistre' }, rattachements: [sinistre, copro] })
    const autre = fraisDe(declaration, SYNDIC, regleDuDossier('Sinistre'))
    expect(autre).toMatchObject({ aConfirmer: false, fondements: ['D. 1967 annexe 1, 7.1.5 et 7.2.1'], repartition: { paiement: 'facture_du_cabinet', imputation: null } })
    const nonEtabli = fraisDe(courrier(), SYNDIC)
    expect(nonEtabli).toMatchObject({ aConfirmer: true, repartition: { paiement: 'facture_du_cabinet', imputation: null } })
    expect(nonEtabli.observation).toMatch(/9\.1/)
    for (const base of [recouvrement, autre, nonEtabli]) {
      expect(base.observation).toMatch(/^Contrat type de syndic \(sans objet pour le cabinet, J67, R14\) : /)
      expect(base.observation).not.toMatch(/présenter au juge|ordonnance|pièce du prestataire postal/)
    }
    // en mission judiciaire, les bases ne parlent plus du contrat type
    expect(fraisDe(courrier(), RECOUVREMENT).observation).not.toMatch(/contrat type/)
    expect(recouvrement).toMatchObject(baseLigneHonorairesCourrier('frais_envoi', { mission: 'contrat_type_syndic', cas: 'recouvrement' }))
  })

  it('contrôles : drapeau du recouvrement non booléen refusé ; en-tête : le cas suit la nature du courrier, plus le seul dossier', () => {
    expect(() => fraisDe(courrier(), { recouvrementContreUnCoproprietaire: 'oui' as unknown as boolean })).toThrow(
      /recouvrement contre un copropriétaire : oui, non ou non établi attendu \(J72\), reçu « oui »/,
    )
    const { item } = enTeteDuModule('etapes-courrier')
    const j72 = item('- J72 (décision de Hugo du 18/11/2026')
    expect(j72).not.toMatch(/Le dossier Contentieux est lu comme/)
    expect(j72).toMatch(/casDesFraisDEnvoi/)
    expect(j72).toMatch(/estRecouvrementContreUnCoproprietaire/)
    expect(j72).toMatch(/jamais imputé au copropriétaire par défaut/)
    expect(j72).not.toMatch(/61-1-5, II/)
  })
})

// ─── Relecture contradictoire (constats confirmés, tests vus en échec avant correction) ──

describe('relecture : constats confirmés', () => {
  it('R1 — même dossier rattaché deux fois au courrier : une seule série de frais, aucun écart parasite', () => {
    const doublon = courrier({ rattachements: [contentieux, { type: 'Contentieux', id: ' C-3 ' }, copro] })
    const regle = regleHonorairesMiseEnDemeure({ lignes: [ligneAr], active: true })
    const honoraires = proposerHonorairesDuCourrier(doublon, [regle], contexteHonoraires())
    expect(honoraires.ecartees).toEqual([])
    expect(honoraires.propositions.map((p) => p.saisie.fiche)).toEqual([contentieux])
    const etapes = declencherEtapesDuCourrier(doublon, [copieActive()], contexte())
    expect(etapes.etapes).toHaveLength(1)
    expect(etapes.ecartees).toEqual([])
  })

  it('R2 — filtre de libellé : mots entiers (« AR » ne trouve pas « garant », « mise en demeure » ne trouve pas « remise en demeure »)', () => {
    const parAr = { par: 'famille', famille: 'Contentieux', libelleContient: 'AR' } as const
    expect(courrierDeclenche(courrier({ modele: { famille: 'Contentieux', libelle: 'Courrier garant' } }), parAr)).toBe(false)
    expect(courrierDeclenche(courrier({ modele: { famille: 'Sinistre', libelle: 'déclaration sinistre DO (AR)' } }), { ...parAr, famille: 'Sinistre' })).toBe(
      true,
    )
    expect(courrierDeclenche(courrier({ modele: { famille: 'Contentieux', libelle: 'Remise en demeure' } }), DECLENCHEUR_MISE_EN_DEMEURE)).toBe(false)
    expect(courrierDeclenche(courrier({ modele: { famille: 'Contentieux', libelle: 'Mise en demeure de payer - AR' } }), parAr)).toBe(true)
  })

  it('R3 — filtre de libellé sans lettre ni chiffre : refusé (il viserait toute la famille)', () => {
    expect(() => courrierDeclenche(courrier(), { par: 'famille', famille: 'Contentieux', libelleContient: '—' })).toThrow(/libellé.*lettre ni chiffre/i)
    expect(() => creerRegleEtapeCourrier(saisieRegleSinistre({ declencheur: { par: 'famille', famille: 'Sinistre', libelleContient: ' - ' } }))).toThrow(
      /lettre ni chiffre/i,
    )
  })

  it('R4 — frais d’envoi : J72 tranche (a, recouvrement : dépense du syndicat ; b, autres envois : frais du cabinet à présenter au juge)', () => {
    const recouvrement = baseLigneHonorairesCourrier('frais_envoi', { cas: 'recouvrement' })
    expect(recouvrement.aConfirmer).toBe(false)
    expect(recouvrement.fondements).toContain('L. 1965 art. 10-1, a')
    expect(recouvrement.observation).toMatch(/^Dépense du syndicat \(J72, a\)/)
    const cabinet = BASES_LIGNES_HONORAIRES_COURRIER.frais_envoi
    expect(cabinet.aConfirmer).toBe(false)
    expect(cabinet.observation).toMatch(/^À présenter au juge \(J72, b\)/)
  })

  it('R5 — réglage par défaut gelé en profondeur : son déclencheur partagé ne se modifie pas', () => {
    const [regle] = REGLES_ETAPES_COURRIER_PAR_DEFAUT
    expect(Object.isFrozen(regle.declencheur)).toBe(true)
    expect(() => {
      ;(regle.declencheur as { par: string }).par = 'famille'
    }).toThrow()
  })

  it('R6 — enchaînement refusé sans Copie au CS née : le message ne promet pas une création que rien ne garantit', () => {
    const processus = processusDuDossier('Contentieux', ACTIF)
    const med = realiserEtapeDossier(
      creerEtapeDossier({
        id: 'e-med',
        titre: 'Lettre de mise en demeure',
        etapeType: processus[1].etapeType,
        creeeLe: '2026-11-05',
        origine: 'manuelle',
        creeeParId: 'collab-A',
        demandeurId: 'collab-A',
        demandeurNature: 'collaborateur',
        rattachements: [contentieux],
      }),
      { date: '2026-11-10', compteRendu: '' },
    ).etape
    const { message } = enchainerEtapeDossierSansDoublon(med, processus, { id: 'e-s', date: '2026-11-10', creeeParId: 'collab-A' }, {
      regles: [copieActive()],
      etapesExistantes: [],
    })
    expect(message).not.toMatch(/sera créée/)
    expect(message).toMatch(/aucune n’est encore née d’un courrier dans ce dossier/)
    expect(message).toMatch(/courrier visé par la règle/)
  })

  it('R7 — liste de contrôle du contentieux, usage actif : sans les types nés du courrier, une seule Copie au CS, sans avertissement', () => {
    const modele = modeleDuDossier('Contentieux', { id: 'm', titre: 'Contentieux' }, ACTIF)
    const sans = modeleSansEtapesNeesDuCourrier(modele, [copieActive()])
    expect(sans.etapes.map((e) => e.etapeType)).not.toContain(ETAPE_TYPE_COPIE_AU_CS_POUR_INFO)
    expect(sans.etapes).toHaveLength(modele.etapes.length - 1)
    // Règles inactives (par défaut) : le modèle est rendu tel quel.
    expect(modeleSansEtapesNeesDuCourrier(modele, REGLES_ETAPES_COURRIER_PAR_DEFAUT)).toEqual(modele)
    const liste = instancierModele(sans, {
      ids: sans.etapes.map((_, i) => `l-${i}`),
      dossierId: 'C-3',
      depart: '2026-11-01',
      creeeParId: 'collab-A',
      demandeurId: 'collab-A',
      demandeurNature: 'collaborateur',
    })
    const resultat = declencherEtapesDuCourrier(courrier(), [copieActive()], contexte({ etapesExistantes: liste.etapes }))
    const copies = [...liste.etapes, ...resultat.etapes].filter((e) => e.etapeType === ETAPE_TYPE_COPIE_AU_CS_POUR_INFO)
    expect(copies).toHaveLength(1)
    expect(resultat.avertissements).toEqual([])
    // Modèle dont toutes les étapes naissent du courrier : refus clair.
    const seule = creerModeleListeControle({
      id: 'seule',
      titre: 'Copie seule',
      dossier: 'Contentieux',
      etapes: [{ etapeType: ETAPE_TYPE_COPIE_AU_CS_POUR_INFO, titre: TITRE_COPIE_AU_CS_POUR_INFO }],
    })
    expect(() => modeleSansEtapesNeesDuCourrier(seule, [copieActive()])).toThrow(/toutes ses étapes naissent d’un courrier/)
    expect(modele.etapes).toHaveLength(3) // le modèle reçu n'est pas modifié
  })

  it('R8 — en-tête : J1 et J50 cités en rappel 🔵, pas comme décisions sur les étapes ; libellés 19-2 non relevés (J64)', () => {
    const { texte, item } = enTeteDuModule('etapes-courrier')
    expect(item('- 🔵 Rappel de J1 et J50')).toMatch(/aucune décision sur les étapes/)
    const declencheur = item('- déclencheur par défaut de la Copie au CS (J64')
    expect(declencheur).toMatch(/procédure accélérée au fond/)
    expect(declencheur).toMatch(/non relevés/)
    expect(texte).toContain('modeleSansEtapesNeesDuCourrier')
  })
})

// ─── Modules existants et en-tête ────────────────────────────────────────────────────────

describe('modules existants et en-tête du module', () => {
  it('etapes-dossier.ts : les champs du point 50 sont facultatifs (EtapeDossier inchangée pour l’existant)', () => {
    const etape = creerEtapeDossier({
      id: 'e-1',
      titre: 'Ouverture de dossier',
      creeeLe: '2026-11-01',
      origine: 'manuelle',
      creeeParId: 'collab-A',
      demandeurId: 'collab-A',
      demandeurNature: 'collaborateur',
    })
    expect(etape).not.toHaveProperty('courrierOrigineId')
    expect(etape).not.toHaveProperty('modeRealisation')
  })

  it('en-tête : tranches, décisions (J64 : naissance par le courrier, questions n° 1 et 2 fermées), forfait 🔴, aucune date ISO', () => {
    const { texte, item } = enTeteDuModule('etapes-courrier')
    for (const attendu of ['Tranche 42', 'Tranche 43 § 1', 'Tranche 22', 'Tranche 27', 'J20', 'J24', 'J41', 'J64', 'point 49', 'point 66', 'point 67'])
      expect(texte).toContain(attendu)
    expect(item('- J64 (décision de Hugo du 17/11/2026 (J64)')).toMatch(/NAÎT DU COURRIER/)
    expect(item('1. et 2. Fermées par J64')).toMatch(/pas les simples relances/)
    expect(texte).toContain('- Naissance de la Copie au CS : du courrier')
    expect(texte).toMatch(/L\. 1965 art\. 10-1, a/)
    expect(texte).toContain('🔴')
    // J67, R7 ferme la question n° 3 ; J72 ferme la n° 4 (frais d'envoi : R5 et R6 conciliés)
    expect(item('- J67, R7 (décision de Hugo du 17/11/2026')).toMatch(/deux lignes : le cabinet facture le syndicat, qui paie/)
    expect(texte).toContain('3. Fermée par J67, R7 (ci-dessus).')
    expect(texte).not.toContain('3. Cabinet (Frédéric ou Hugo)')
    expect(texte).toContain('4. Fermée par J72 (ci-dessus).')
    expect(texte).not.toMatch(/R5 et R6 ne les règlent pas de la même façon|R5 ou R6|à confirmer \(🔴, question n° 4\)|question n° 4 \(🔴\)/)
    const j72 = item('- J72 (décision de Hugo du 18/11/2026')
    expect(j72).toMatch(/\(a\) mise en demeure et relances d'un copropriétaire en retard : dépense du syndicat.*pièce du prestataire postal.*L\. 1965 art\. 10-1, a/)
    expect(j72).toMatch(/\(b\) autres envois du cabinet.*annexe « frais et débours ».*C\. com\. R\. 814-27/)
    expect(texte).not.toContain('4. Frédéric')
    const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'etapes-courrier.ts'), 'utf8')
    expect(source).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(source).not.toMatch(/\bany\b/)
  })

  it('modeles-etapes.ts : l’ancienne question n° 6 est fermée par J64 et renvoie au point 50', () => {
    const { texte, item } = enTeteDuModule('modeles-etapes')
    expect(texte).not.toContain('6. Hugo (avec le point 50')
    const decision = item('- J64 (décision de Hugo du 17/11/2026 (J64)')
    expect(decision).toMatch(/etapes-courrier\.ts/)
    expect(decision).toMatch(/enchainerEtapeDossierSansDoublon/)
  })
})
