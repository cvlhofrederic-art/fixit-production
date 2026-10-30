import { describe, expect, it } from 'vitest'
import { creerElement, totalElement, type ElementAFacturer, type SaisieElement } from '@/lib/administrateur-judiciaire/domain/honoraires-facturation'
import {
  CADRES_REMUNERATION_SINISTRE,
  DILIGENCES_SINISTRE_AU_FORFAIT,
  DILIGENCES_SINISTRE_HORS_FORFAIT,
  FONDEMENTS_HONORAIRES_SINISTRE,
  NATURES_REMUNERATION_SINISTRE,
  NATURES_REPROGRAPHIE_SINISTRE,
  SEUIL_LOTS_REMUNERATION_PAR_LE_JUGE,
  TARIF_SINISTRE_HORS_HEURES_OUVRABLES,
  cadreRemunerationDuRegime,
  controlerHonorairesSinistre,
  corrigerHeures,
  coutHoraireUrgence,
  diligenceDuTarif,
  dureeDepuisHoraires,
  elementAOuvertureSinistre,
  elementCommeFicheLiee,
  honorairesDuSinistre,
  soldeHonorairesSinistre,
  type OuvertureSinistre,
  type ResultatOuvertureSinistre,
} from '@/lib/administrateur-judiciaire/domain/honoraires-sinistre'

/**
 * Point 66 du bilan 2 — élément d'honoraires rattaché à une fiche sinistre (cartographie Gestéam, tranches 42 et 27).
 * - À l'ouverture d'un sinistre, Gestéam crée un élément « A facturer » au coût horaire, Dossier = Sinistre + la fiche.
 * - Contrat type de syndic (D. 1967 annexe 1, 7.2.4 ; annexe 2, III, 6° à 9°) : quatre diligences seulement ; la
 *   déclaration et le règlement des indemnités restent au forfait (7.1.1) ; les sommes de l'assureur s'en déduisent.
 * - Administration provisoire art. 29-1 : acte hors tarif (arrêté du 8 octobre 2015, art. 14) à soumettre au juge :
 *   aucun élément « A facturer ». À 500 lots et plus, l'art. 14 ne s'applique pas : l'entière rémunération est fixée par
 *   le juge (arrêté, art. 3).
 */

/** Message de l'erreur levée par `action` (le test échoue si rien n'est levé). */
const erreurDe = (action: () => unknown): string => {
  try {
    action()
  } catch (erreur) {
    return erreur instanceof Error ? erreur.message : String(erreur)
  }
  throw new Error('Une erreur était attendue.')
}

const ouverture = (surcharge: Partial<OuvertureSinistre> = {}): OuvertureSinistre => ({
  elementId: 'el-s1',
  sinistreId: 'sin-42',
  coproprieteId: 'copro-tilleuls',
  mandatId: 'mandat-2026',
  dateOuverture: '2026-10-12',
  coutHoraireHtDixMilliemes: 900_000,
  soumisTva: true,
  tauxTvaPct: 20,
  ...surcharge,
})

const genere = (resultat: ResultatOuvertureSinistre): ElementAFacturer => {
  if (!resultat.genere) throw new Error(`Élément attendu, signalement reçu : ${resultat.signalement}`)
  return resultat.element
}

const elementSinistre = (surcharge: Partial<SaisieElement> = {}): ElementAFacturer =>
  creerElement({
    id: 'el-x',
    coproprieteId: 'copro-tilleuls',
    mandatId: 'mandat-2026',
    date: '2026-10-15',
    dossier: 'Sinistre',
    fiche: { type: 'Sinistre', id: 'sin-42' },
    nature: 'Prestations',
    tarif: 'Sinistre - SINISTRE MESURES CONSERVATOIRES',
    calcul: 'Coût horaire',
    quantite: 1,
    prixUnitaireHtDixMilliemes: 900_000,
    soumisTva: true,
    tauxTvaPct: 20,
    destinataire: 'Syndicat des copropriétaires',
    ...surcharge,
  })

describe('honoraires de sinistre — référentiel', () => {
  it('quatre diligences hors forfait (annexe 2, III, 6° à 9°), avec les tarifs du catalogue Gestéam', () => {
    expect(DILIGENCES_SINISTRE_HORS_FORFAIT.map((d) => [d.code, d.rubrique, d.tarifGesteam])).toEqual([
      ['deplacement', 'D. 1967 annexe 2, III, 6°', 'SINISTRE VACATIONS DEPLACEMENT SUR LES LIEUX'],
      ['mesures_conservatoires', 'D. 1967 annexe 2, III, 7°', 'SINISTRE MESURES CONSERVATOIRES'],
      ['assistance_expertise', 'D. 1967 annexe 2, III, 8°', "SINISTRE ASSISTANCE AUX MESURES D'EXPERTISE"],
      ['suivi_assureur', 'D. 1967 annexe 2, III, 9°', "SINISTRE SUIVI DU DOSSIER AUPRES DE L'ASSUREUR"],
    ])
  })

  it('deux diligences au forfait : déclaration et règlement des indemnités (7.1.1 ; liste annexée, V-17° et V-18°)', () => {
    expect(DILIGENCES_SINISTRE_AU_FORFAIT.map((d) => d.code)).toEqual(['declaration', 'reglement_indemnites'])
    expect(DILIGENCES_SINISTRE_AU_FORFAIT.map((d) => d.rubrique)).toEqual([
      'D. 1967 annexe 1, 7.1.1 ; liste annexée au contrat, V-17°',
      'D. 1967 annexe 1, 7.1.1 ; liste annexée au contrat, V-18°',
    ])
  })

  it('fondements par cadre : contrat type, tarif de l’AP (arrêté du 8 octobre 2015, art. 14), rémunération fixée par le juge (art. 3), non établi', () => {
    expect(CADRES_REMUNERATION_SINISTRE).toEqual([
      'contrat_type_syndic',
      'tarif_administrateur_provisoire',
      'remuneration_fixee_par_le_juge',
      'non_etabli',
    ])
    expect(FONDEMENTS_HONORAIRES_SINISTRE.remuneration_fixee_par_le_juge).toEqual([
      'L. 1965 art. 29-1, II',
      'D. 1967 art. 61-1-5, II et III',
      'Arrêté du 8 octobre 2015, art. 3',
    ])
    expect(FONDEMENTS_HONORAIRES_SINISTRE.remuneration_fixee_par_le_juge.join(' ')).not.toMatch(/art\. 14/)
    expect(FONDEMENTS_HONORAIRES_SINISTRE.contrat_type_syndic).toEqual(
      expect.arrayContaining(['L. 1965 art. 18-1 A, I', 'D. 1967 annexe 1, points 7.1.1, 7.2.1 et 7.2.4']),
    )
    expect(FONDEMENTS_HONORAIRES_SINISTRE.tarif_administrateur_provisoire).toEqual(
      expect.arrayContaining(['Arrêté du 8 octobre 2015, art. 14', 'D. 1967 art. 61-1-5, I à III']),
    )
    expect(FONDEMENTS_HONORAIRES_SINISTRE.non_etabli.length).toBeGreaterThan(0)
  })
})

describe('honoraires de sinistre — rémunération et frais', () => {
  it('trois natures rémunèrent une diligence ; les autres (timbre, AR, copie, envois, diffuseurs) sont des frais (🔵)', () => {
    expect(NATURES_REMUNERATION_SINISTRE).toEqual(['Vacations', 'Honoraires', 'Prestations'])
  })

  it('deux natures de frais sont de la reprographie (7.1.1, al. 2) : la copie du cabinet et celle du diffuseur (🔵)', () => {
    expect(NATURES_REPROGRAPHIE_SINISTRE).toEqual(['Copie', 'Diffuseur copie'])
  })
})

describe('honoraires de sinistre — diligence lue dans le tarif', () => {
  it('reconnaît les quatre tarifs du catalogue, le « SUIVI ET GESTION MRI » de l’ouverture et l’urgence hors heures ouvrables', () => {
    expect(diligenceDuTarif('Sinistre - SINISTRE VACATIONS DEPLACEMENT SUR LES LIEUX')).toBe('deplacement')
    expect(diligenceDuTarif('Sinistre - SINISTRE MESURES CONSERVATOIRES')).toBe('mesures_conservatoires')
    expect(diligenceDuTarif("Sinistre - SINISTRE ASSISTANCE AUX MESURES D'EXPERTISE")).toBe('assistance_expertise')
    expect(diligenceDuTarif("Sinistre - SINISTRE SUIVI DU DOSSIER AUPRES DE L'ASSUREUR")).toBe('suivi_assureur')
    expect(diligenceDuTarif('SUIVI ET GESTION MRI')).toBe('suivi_assureur')
    expect(diligenceDuTarif('Sinistre - SINISTRE PRESTATION EN DEHORS JOURS ET HEURES OUVRABLES')).toBe('hors_heures_ouvrables')
    expect(TARIF_SINISTRE_HORS_HEURES_OUVRABLES).toBe('SINISTRE PRESTATION EN DEHORS JOURS ET HEURES OUVRABLES')
  })

  it('reconnaît les diligences au forfait (accents et casse indifférents), sinon null', () => {
    expect(diligenceDuTarif('Sinistre - Déclaration du sinistre')).toBe('declaration')
    expect(diligenceDuTarif('Sinistre - règlement des indemnités aux bénéficiaires')).toBe('reglement_indemnites')
    expect(diligenceDuTarif('Sinistre - SUIVI DECLARATION ASSUREUR')).toBe('declaration')
    expect(diligenceDuTarif('Gestion - RAR')).toBeNull()
    expect(diligenceDuTarif('Gestion - Gestion des sinistres, rendez-vous constat')).toBeNull()
    expect(diligenceDuTarif('')).toBeNull()
  })

  it('le règlement suppose les indemnités ou les bénéficiaires ; ni le règlement de copropriété ni la déclaration de créance (catalogue, tranche 27)', () => {
    expect(diligenceDuTarif('Gestion - REGLEMENT COPROPRIETE- ETAT DESCRIPTIF DES DIVISIONS')).toBeNull()
    expect(diligenceDuTarif('Sinistre - Mise à jour du REGLEMENT DE COPROPRIETE après sinistre')).toBeNull()
    expect(diligenceDuTarif('Contentieux - RET - DECLARATION DE LA CREANCE')).toBeNull()
    expect(diligenceDuTarif('Contentieux - RET - DECLARATION DE LA CREANCE (retablissement personnel)')).toBeNull()
    expect(diligenceDuTarif('Sinistre - Gestion des règlements aux bénéficiaires')).toBe('reglement_indemnites')
    expect(diligenceDuTarif('Sinistre - REGLEMENT INDEMNITE')).toBe('reglement_indemnites')
  })
})

describe('honoraires de sinistre — cadre de rémunération du mandat', () => {
  it('AP art. 29-1 : tarif de l’administrateur provisoire ; AP art. 47, syndic judiciaire, ad hoc ou inconnu : non établi', () => {
    expect(cadreRemunerationDuRegime('ap291', 120)).toBe('tarif_administrateur_provisoire')
    expect(cadreRemunerationDuRegime('ap291', 499)).toBe('tarif_administrateur_provisoire')
    expect(cadreRemunerationDuRegime('ap47', 600)).toBe('non_etabli')
    expect(cadreRemunerationDuRegime('sj', 12)).toBe('non_etabli')
    expect(cadreRemunerationDuRegime(null, 12)).toBe('non_etabli')
  })

  it('AP art. 29-1 d’une copropriété de 500 lots et plus : rémunération entière fixée par le juge (arrêté, art. 3)', () => {
    expect(SEUIL_LOTS_REMUNERATION_PAR_LE_JUGE).toBe(500)
    expect(cadreRemunerationDuRegime('ap291', 500)).toBe('remuneration_fixee_par_le_juge')
    expect(cadreRemunerationDuRegime('ap291', 600)).toBe('remuneration_fixee_par_le_juge')
  })

  it('AP art. 29-1 : refuse un nombre de lots qui n’est pas un entier strictement positif', () => {
    expect(() => cadreRemunerationDuRegime('ap291', 0)).toThrow(/lots/i)
    expect(() => cadreRemunerationDuRegime('ap291', 12.5)).toThrow(/lots/i)
    expect(() => cadreRemunerationDuRegime('ap291', Number.NaN)).toThrow(/lots/i)
  })
})

describe('honoraires de sinistre — élément créé à l’ouverture (contrat type de syndic)', () => {
  it('crée l’élément « A facturer » du dossier Sinistre, rattaché à la fiche, au coût horaire, daté de l’ouverture', () => {
    const element = genere(elementAOuvertureSinistre(ouverture(), 'contrat_type_syndic'))
    expect(element).toEqual({
      id: 'el-s1',
      coproprieteId: 'copro-tilleuls',
      mandatId: 'mandat-2026',
      date: '2026-10-12',
      dossier: 'Sinistre',
      fiche: { type: 'Sinistre', id: 'sin-42' },
      nature: 'Prestations',
      tarif: "Sinistre - SINISTRE SUIVI DU DOSSIER AUPRES DE L'ASSUREUR",
      calcul: 'Coût horaire',
      quantite: 1,
      prixUnitaireHtDixMilliemes: 900_000,
      soumisTva: true,
      tauxTvaPct: 20,
      destinataire: 'Syndicat des copropriétaires',
      statut: 'A facturer',
    })
    expect(totalElement(element)).toEqual({ htCentimes: 9_000, tvaCentimes: 1_800, ttcCentimes: 10_800 })
  })

  it('accepte une autre diligence, une durée, le tarif du cabinet et le tarif d’urgence hors heures ouvrables', () => {
    const deplacement = genere(elementAOuvertureSinistre(ouverture({ diligence: 'deplacement', heures: 2.5 }), 'contrat_type_syndic'))
    expect(deplacement.tarif).toBe('Sinistre - SINISTRE VACATIONS DEPLACEMENT SUR LES LIEUX')
    expect(totalElement(deplacement).htCentimes).toBe(22_500)
    expect(genere(elementAOuvertureSinistre(ouverture({ tarif: 'SUIVI ET GESTION MRI' }), 'contrat_type_syndic')).tarif).toBe('SUIVI ET GESTION MRI')
    const urgence = 'Sinistre - SINISTRE PRESTATION EN DEHORS JOURS ET HEURES OUVRABLES'
    expect(genere(elementAOuvertureSinistre(ouverture({ diligence: 'mesures_conservatoires', tarif: urgence }), 'contrat_type_syndic')).tarif).toBe(urgence)
    expect(genere(elementAOuvertureSinistre(ouverture({ destinataire: 'Copropriétaire' }), 'contrat_type_syndic')).destinataire).toBe('Copropriétaire')
  })

  it('refuse une diligence au forfait, un tarif incohérent, au forfait ou non identifié, une fiche sans identifiant', () => {
    expect(() => elementAOuvertureSinistre(ouverture({ diligence: 'declaration' }), 'contrat_type_syndic')).toThrow(/forfait.*7\.1\.1/i)
    expect(() => elementAOuvertureSinistre(ouverture({ diligence: 'reglement_indemnites' }), 'contrat_type_syndic')).toThrow(/forfait.*7\.1\.1/i)
    expect(() => elementAOuvertureSinistre(ouverture({ tarif: 'Sinistre - SINISTRE MESURES CONSERVATOIRES' }), 'contrat_type_syndic')).toThrow(
      /autre diligence/i,
    )
    expect(() => elementAOuvertureSinistre(ouverture({ tarif: 'Sinistre - Déclaration du sinistre' }), 'contrat_type_syndic')).toThrow(/forfait/i)
    expect(() => elementAOuvertureSinistre(ouverture({ tarif: 'Gestion - RAR' }), 'contrat_type_syndic')).toThrow(/non identifiée/i)
    expect(() =>
      elementAOuvertureSinistre(ouverture({ tarif: 'Gestion - REGLEMENT COPROPRIETE- ETAT DESCRIPTIF DES DIVISIONS' }), 'contrat_type_syndic'),
    ).toThrow(/non identifiée/i)
    expect(() => elementAOuvertureSinistre(ouverture({ sinistreId: '  ' }), 'contrat_type_syndic')).toThrow(/identifiant/i)
    expect(() => elementAOuvertureSinistre(ouverture(), 'forfait' as never)).toThrow(/cadre/i)
    expect(() => elementAOuvertureSinistre(ouverture({ diligence: 'expertise' as never }), 'contrat_type_syndic')).toThrow(/inconnue/i)
  })

  it('les contrôles de l’élément restent ceux de creerElement (date, durée, taux)', () => {
    expect(() => elementAOuvertureSinistre(ouverture({ dateOuverture: '12/10/2026' }), 'contrat_type_syndic')).toThrow(/date/i)
    expect(() => elementAOuvertureSinistre(ouverture({ heures: 0 }), 'contrat_type_syndic')).toThrow(/quantit/i)
    expect(() => elementAOuvertureSinistre(ouverture({ coutHoraireHtDixMilliemes: 1.5 }), 'contrat_type_syndic')).toThrow(/prix/i)
  })
})

describe('honoraires de sinistre — pas d’élément hors du contrat type', () => {
  it('AP art. 29-1 : acte hors tarif à soumettre au juge, aucun élément « A facturer »', () => {
    const resultat = elementAOuvertureSinistre(ouverture(), 'tarif_administrateur_provisoire')
    expect(resultat.genere).toBe(false)
    if (resultat.genere) return
    expect(resultat.motif).toBe('a_soumettre_au_juge')
    expect(resultat.signalement).toMatch(/hors tarif/i)
    expect(resultat.signalement).toMatch(/juge/i)
    expect(resultat.fondements).toEqual(FONDEMENTS_HONORAIRES_SINISTRE.tarif_administrateur_provisoire)
    expect(resultat.fiche).toEqual({ type: 'Sinistre', id: 'sin-42' })
    expect(resultat.diligence).toBe('suivi_assureur')
  })

  it('AP art. 29-1 de 500 lots et plus : rémunération entière fixée par le juge (arrêté, art. 3), sans l’art. 14', () => {
    const resultat = elementAOuvertureSinistre(ouverture(), 'remuneration_fixee_par_le_juge')
    expect(resultat.genere).toBe(false)
    if (resultat.genere) return
    expect(resultat.motif).toBe('a_soumettre_au_juge')
    expect(resultat.signalement).toMatch(/500 lots et plus/)
    expect(resultat.signalement).toMatch(/arrêté du 8 octobre 2015, art\. 3/)
    expect(resultat.signalement).toMatch(/61-1-5, II et III/)
    expect(resultat.signalement).not.toMatch(/art\. 14|hors tarif/)
    expect(resultat.fondements).toEqual(FONDEMENTS_HONORAIRES_SINISTRE.remuneration_fixee_par_le_juge)
  })

  it('cadre non établi : signalement (rémunération à confirmer selon l’ordonnance), fondements, aucun élément', () => {
    const resultat = elementAOuvertureSinistre(ouverture(), 'non_etabli')
    expect(resultat.genere).toBe(false)
    if (resultat.genere) return
    expect(resultat.motif).toBe('base_non_etablie')
    expect(resultat.signalement).toMatch(/non établie/i)
    expect(resultat.signalement).toMatch(/à confirmer selon l'ordonnance/)
    expect(resultat.fondements).toEqual(FONDEMENTS_HONORAIRES_SINISTRE.non_etabli)
  })

  it('aucun prénom de l’équipe dans les signalements renvoyés à l’écran', () => {
    for (const cadre of ['tarif_administrateur_provisoire', 'remuneration_fixee_par_le_juge', 'non_etabli'] as const) {
      const resultat = elementAOuvertureSinistre(ouverture(), cadre)
      if (resultat.genere) throw new Error('Signalement attendu.')
      expect(resultat.signalement).not.toMatch(/Frédéric|Hugo|question pour/i)
    }
  })

  it('AP art. 29-1 : seule la déclaration est refusée (arrêté, art. 14), jamais au nom du contrat type (7.1.1, annexe 2)', () => {
    const parDiligence = erreurDe(() => elementAOuvertureSinistre(ouverture({ diligence: 'declaration' }), 'tarif_administrateur_provisoire'))
    expect(parDiligence).toMatch(/déclaration.*art\. 14/i)
    expect(parDiligence).not.toMatch(/7\.1\.1|annexe/)
    const parTarif = erreurDe(() =>
      elementAOuvertureSinistre(ouverture({ tarif: 'Sinistre - Déclaration du sinistre' }), 'tarif_administrateur_provisoire'),
    )
    expect(parTarif).toMatch(/art\. 14/)
    expect(parTarif).not.toMatch(/7\.1\.1|annexe/)
  })

  it('AP art. 29-1 : le règlement des indemnités et un tarif du catalogue hors des quatre diligences sont à soumettre au juge', () => {
    const reglement = elementAOuvertureSinistre(
      ouverture({ diligence: 'reglement_indemnites', tarif: 'Sinistre - Règlement des indemnités aux bénéficiaires' }),
      'tarif_administrateur_provisoire',
    )
    expect(reglement).toMatchObject({ genere: false, motif: 'a_soumettre_au_juge', diligence: 'reglement_indemnites' })
    const constat = elementAOuvertureSinistre(
      ouverture({ tarif: 'Gestion - Gestion des sinistres, rendez-vous constat' }),
      'tarif_administrateur_provisoire',
    )
    expect(constat).toMatchObject({ genere: false, motif: 'a_soumettre_au_juge', diligence: 'suivi_assureur' })
  })

  it('500 lots et plus, cadre non établi : rien n’est refusé, la déclaration comprise', () => {
    const declaration = ouverture({ diligence: 'declaration', tarif: 'Sinistre - Déclaration du sinistre' })
    expect(elementAOuvertureSinistre(declaration, 'remuneration_fixee_par_le_juge')).toMatchObject({
      genere: false,
      motif: 'a_soumettre_au_juge',
      diligence: 'declaration',
    })
    expect(elementAOuvertureSinistre(declaration, 'non_etabli')).toMatchObject({ genere: false, motif: 'base_non_etablie', diligence: 'declaration' })
  })

  it('hors contrat type, la diligence doit être connue et le tarif ne doit pas en viser une autre', () => {
    expect(() => elementAOuvertureSinistre(ouverture({ diligence: 'expertise' as never }), 'non_etabli')).toThrow(/inconnue/i)
    expect(() =>
      elementAOuvertureSinistre(ouverture({ diligence: 'deplacement', tarif: 'Sinistre - SINISTRE MESURES CONSERVATOIRES' }), 'non_etabli'),
    ).toThrow(/autre diligence/i)
  })
})

describe('honoraires de sinistre — urgence hors jours et heures ouvrables (7.2.4)', () => {
  it('coût horaire majoré du pourcentage du contrat, en dix-millièmes d’euro ; sans majoration, inchangé', () => {
    expect(coutHoraireUrgence(900_000, 50)).toBe(1_350_000)
    expect(coutHoraireUrgence(900_000, 0)).toBe(900_000)
    expect(coutHoraireUrgence(900_001, 25)).toBe(1_125_001)
    const urgence = genere(
      elementAOuvertureSinistre(
        ouverture({ tarif: TARIF_SINISTRE_HORS_HEURES_OUVRABLES, coutHoraireHtDixMilliemes: coutHoraireUrgence(900_000, 50) }),
        'contrat_type_syndic',
      ),
    )
    expect(totalElement(urgence).htCentimes).toBe(13_500)
  })

  it('majoration au centième de point : calcul exact, demi arrondi au dix-millième supérieur', () => {
    expect(coutHoraireUrgence(285_000, 0.07)).toBe(285_200)
    expect(coutHoraireUrgence(1_339_500, 0.1)).toBe(1_340_840)
    expect(coutHoraireUrgence(1_250, 1.32)).toBe(1_267)
    expect(coutHoraireUrgence(515_000, 33.33)).toBe(686_650)
    expect(coutHoraireUrgence(101_000, 29.95)).toBe(131_250)
  })

  it('refuse un coût horaire qui n’est pas en dix-millièmes entiers positifs, une majoration négative, non finie ou au-delà du centième', () => {
    expect(() => coutHoraireUrgence(1.5, 10)).toThrow(/coût horaire/i)
    expect(() => coutHoraireUrgence(-1, 10)).toThrow(/coût horaire/i)
    expect(() => coutHoraireUrgence(900_000, -5)).toThrow(/majoration/i)
    expect(() => coutHoraireUrgence(900_000, Number.NaN)).toThrow(/majoration/i)
    expect(() => coutHoraireUrgence(900_000, 12.345)).toThrow(/majoration/i)
    expect(() => coutHoraireUrgence(Number.MAX_SAFE_INTEGER, 50)).toThrow(/coût horaire/i)
  })
})

describe('honoraires de sinistre — temps passé', () => {
  it('durée depuis les horaires début / fin (hh:mm) : minutes exactes, heures au centième', () => {
    expect(dureeDepuisHoraires('09:00', '10:00')).toEqual({ minutes: 60, heures: 1 })
    expect(dureeDepuisHoraires('14:00', '15:30')).toEqual({ minutes: 90, heures: 1.5 })
    expect(dureeDepuisHoraires('09:00', '09:50')).toEqual({ minutes: 50, heures: 0.83 })
  })

  it('refuse un horaire mal formé ou une fin qui n’est pas après le début', () => {
    expect(() => dureeDepuisHoraires('9h', '10:00')).toThrow(/horaire/i)
    expect(() => dureeDepuisHoraires('09:00', '24:00')).toThrow(/horaire/i)
    expect(() => dureeDepuisHoraires('10:00', '10:00')).toThrow(/après/i)
    expect(() => dureeDepuisHoraires('10:00', '09:00')).toThrow(/après/i)
  })

  it('corrige le nombre d’heures d’un élément au coût horaire encore à facturer', () => {
    const element = genere(elementAOuvertureSinistre(ouverture(), 'contrat_type_syndic'))
    const corrige = corrigerHeures(element, 0.5)
    expect(corrige.quantite).toBe(0.5)
    expect(totalElement(corrige)).toEqual({ htCentimes: 4_500, tvaCentimes: 900, ttcCentimes: 5_400 })
    expect(element.quantite).toBe(1)
  })

  it('refuse un élément facturé, un élément qui n’est pas au coût horaire, une durée nulle ou invalide', () => {
    const element = genere(elementAOuvertureSinistre(ouverture(), 'contrat_type_syndic'))
    expect(() => corrigerHeures({ ...element, statut: 'Facturé' }, 2)).toThrow(/facturé/i)
    expect(() => corrigerHeures({ ...element, calcul: 'Coût unitaire' }, 2)).toThrow(/coût horaire/i)
    expect(() => corrigerHeures(element, 0)).toThrow(/heures/i)
    expect(() => corrigerHeures(element, -1)).toThrow(/heures/i)
    expect(() => corrigerHeures(element, Number.NaN)).toThrow(/heures/i)
  })
})

describe('honoraires de sinistre — contrôle des éléments', () => {
  const elements = [
    genere(elementAOuvertureSinistre(ouverture(), 'contrat_type_syndic')),
    elementSinistre({ id: 'el-sf', fiche: undefined }),
    elementSinistre({ id: 'el-decl', tarif: 'Sinistre - Déclaration du sinistre' }),
    elementSinistre({ id: 'el-regl', tarif: 'Sinistre - Règlement des indemnités aux bénéficiaires' }),
    elementSinistre({ id: 'el-inc', tarif: 'Sinistre - FRAIS DIVERS' }),
    elementSinistre({ id: 'el-rcp', tarif: 'Sinistre - Mise à jour du REGLEMENT DE COPROPRIETE après sinistre' }),
    creerElement({ ...elementSinistre({ id: 'el-ctx' }), dossier: 'Contentieux', fiche: null, tarif: 'Contentieux - MISE EN DEMEURE' }),
  ]
  const natures = (cadre: Parameters<typeof controlerHonorairesSinistre>[1]) =>
    controlerHonorairesSinistre(elements, cadre).map((a) => [a.elementId, a.nature])
  const messageDe = (cadre: Parameters<typeof controlerHonorairesSinistre>[1], elementId: string) =>
    controlerHonorairesSinistre(elements, cadre).find((a) => a.elementId === elementId)?.message

  it('contrat type : sans fiche, diligence au forfait (déclaration, règlement), diligence non identifiée ; hors dossier Sinistre ignoré', () => {
    expect(natures('contrat_type_syndic')).toEqual([
      ['el-sf', 'sans_fiche'],
      ['el-decl', 'diligence_au_forfait'],
      ['el-regl', 'diligence_au_forfait'],
      ['el-inc', 'diligence_non_identifiee'],
      ['el-rcp', 'diligence_non_identifiee'],
    ])
    expect(messageDe('contrat_type_syndic', 'el-decl')).toMatch(/7\.1\.1/)
  })

  it('contrat type : la diligence non identifiée se fonde sur l’annexe 2 seule, pas sur l’arrêté de l’AP', () => {
    expect(messageDe('contrat_type_syndic', 'el-inc')).toMatch(/annexe 2, III, 6° à 9°/)
    expect(messageDe('contrat_type_syndic', 'el-inc')).not.toMatch(/arrêté|art\. 14/)
  })

  it('AP art. 29-1 : chaque élément de sinistre est hors tarif, sauf la déclaration, seule exclue (arrêté, art. 14)', () => {
    expect(natures('tarif_administrateur_provisoire')).toEqual([
      ['el-s1', 'hors_tarif_ap'],
      ['el-sf', 'sans_fiche'],
      ['el-sf', 'hors_tarif_ap'],
      ['el-decl', 'diligence_au_forfait'],
      ['el-regl', 'hors_tarif_ap'],
      ['el-inc', 'hors_tarif_ap'],
      ['el-rcp', 'hors_tarif_ap'],
    ])
    expect(messageDe('tarif_administrateur_provisoire', 'el-decl')).toMatch(/exclue des actes hors tarif.*art\. 14/)
  })

  it('AP art. 29-1 de 500 lots et plus : chaque élément est soumis au juge (arrêté, art. 3) ; ni exclusion de la déclaration ni art. 14', () => {
    expect(natures('remuneration_fixee_par_le_juge')).toEqual([
      ['el-s1', 'remuneration_fixee_par_le_juge'],
      ['el-sf', 'sans_fiche'],
      ['el-sf', 'remuneration_fixee_par_le_juge'],
      ['el-decl', 'remuneration_fixee_par_le_juge'],
      ['el-regl', 'remuneration_fixee_par_le_juge'],
      ['el-inc', 'remuneration_fixee_par_le_juge'],
      ['el-rcp', 'remuneration_fixee_par_le_juge'],
    ])
    expect(messageDe('remuneration_fixee_par_le_juge', 'el-decl')).toMatch(/500 lots et plus.*art\. 3/)
    expect(messageDe('remuneration_fixee_par_le_juge', 'el-decl')).not.toMatch(/art\. 14|hors tarif/)
  })

  it('cadre non établi : chaque élément de sinistre est signalé, sans prénom de l’équipe', () => {
    const signales = controlerHonorairesSinistre(elements, 'non_etabli').filter((a) => a.nature === 'cadre_non_etabli')
    expect(signales.map((a) => a.elementId)).toEqual(['el-s1', 'el-sf', 'el-decl', 'el-regl', 'el-inc', 'el-rcp'])
    expect(signales[0].message).toMatch(/à confirmer selon l'ordonnance/)
    expect(signales[0].message).not.toMatch(/Frédéric|Hugo/)
  })

  const frais = [
    elementSinistre({ id: 'el-timbre', nature: 'Timbre', tarif: 'Sinistre - Affranchissement', calcul: 'Coût unitaire', prixUnitaireHtDixMilliemes: 12_900 }),
    elementSinistre({ id: 'el-ar', nature: 'AR', tarif: 'AR', calcul: 'Coût unitaire', fiche: null, prixUnitaireHtDixMilliemes: 54_000 }),
  ]
  const naturesDesFrais = (cadre: Parameters<typeof controlerHonorairesSinistre>[1]) =>
    controlerHonorairesSinistre(frais, cadre).map((a) => [a.elementId, a.nature])

  it('frais d’envoi du dossier Sinistre : ni diligence ni cadre contrôlés (🔴 hors contrat type) ; seule l’absence de fiche est signalée', () => {
    expect(naturesDesFrais('contrat_type_syndic')).toEqual([['el-ar', 'sans_fiche']])
    expect(naturesDesFrais('tarif_administrateur_provisoire')).toEqual([['el-ar', 'sans_fiche']])
    expect(naturesDesFrais('non_etabli')).toEqual([['el-ar', 'sans_fiche']])
  })

  it('500 lots et plus : les frais aussi sont soumis au juge, qui fixe la rémunération « en fonction des frais engagés » (arrêté, art. 3)', () => {
    expect(naturesDesFrais('remuneration_fixee_par_le_juge')).toEqual([
      ['el-timbre', 'remuneration_fixee_par_le_juge'],
      ['el-ar', 'sans_fiche'],
      ['el-ar', 'remuneration_fixee_par_le_juge'],
    ])
  })

  it('aucune anomalie pour l’élément créé à l’ouverture en contrat type ; cadre inconnu refusé', () => {
    expect(controlerHonorairesSinistre(elements.slice(0, 1), 'contrat_type_syndic')).toEqual([])
    expect(() => controlerHonorairesSinistre(elements, 'forfait' as never)).toThrow(/cadre/i)
  })
})

describe('honoraires de sinistre — reprographie d’une diligence au forfait (contrat type, 7.1.1, al. 2)', () => {
  /** 40 copies à 0,15 € HT, TVA 20 % : 6,00 € HT, 7,20 € TTC. */
  const copie = (surcharge: Partial<SaisieElement>): ElementAFacturer =>
    elementSinistre({ nature: 'Copie', calcul: 'Coût unitaire', quantite: 40, prixUnitaireHtDixMilliemes: 1_500, ...surcharge })
  const dossier = [
    copie({ id: 'cp-decl', tarif: 'Sinistre - Copies de la déclaration du sinistre' }),
    copie({ id: 'cp-regl', nature: 'Diffuseur copie', tarif: 'Sinistre - Copies du règlement des indemnités aux bénéficiaires' }),
    copie({ id: 'cp-exp', tarif: "Sinistre - Copies pour l'expertise" }),
    copie({ id: 'cp-sans', tarif: 'Sinistre - Copies' }),
    elementSinistre({
      id: 'tb-decl',
      nature: 'Timbre',
      tarif: 'Sinistre - Envoi de la déclaration du sinistre',
      calcul: 'Coût unitaire',
      prixUnitaireHtDixMilliemes: 12_900,
    }),
  ]
  const natures = (cadre: Parameters<typeof controlerHonorairesSinistre>[1]) =>
    controlerHonorairesSinistre(dossier, cadre).map((a) => [a.elementId, a.nature])

  it('la copie d’une déclaration ou d’un règlement des indemnités est comprise dans le forfait ; l’envoi reste remboursé à part (7.1.5, dernier alinéa)', () => {
    expect(totalElement(dossier[0]).ttcCentimes).toBe(720)
    expect(natures('contrat_type_syndic')).toEqual([
      ['cp-decl', 'diligence_au_forfait'],
      ['cp-regl', 'diligence_au_forfait'],
    ])
    const message = controlerHonorairesSinistre(dossier, 'contrat_type_syndic')[0].message
    expect(message).toMatch(/reprographie/i)
    expect(message).toMatch(/D\. 1967 annexe 1, 7\.1\.1, al\. 2/)
  })

  it('les copies des quatre diligences hors forfait, ou d’aucune diligence nommée, restent des frais sans anomalie (🔴 question)', () => {
    const autres = dossier.filter((e) => e.id === 'cp-exp' || e.id === 'cp-sans')
    expect(controlerHonorairesSinistre(autres, 'contrat_type_syndic')).toEqual([])
  })

  it('solde : ces copies sont écartées (ni frais ni honoraires) ; les autres copies et l’envoi restent des frais', () => {
    expect(soldeHonorairesSinistre(dossier, 'sin-42', [5_000], 'contrat_type_syndic')).toEqual({
      elementIds: [],
      ecartesIds: ['cp-decl', 'cp-regl'],
      totalHtCentimes: 0,
      totalTtcCentimes: 0,
      versementsCentimes: 5_000,
      deductionCentimes: 0,
      resteAChargeTtcCentimes: 0,
      excedentCentimes: 5_000,
      fraisTtcCentimes: 720 + 720 + 155,
    })
  })

  it('hors contrat type, le forfait du 7.1.1 ne s’applique pas : rien n’est écarté, et à 500 lots et plus tout est soumis au juge', () => {
    expect(natures('tarif_administrateur_provisoire')).toEqual([])
    expect(natures('non_etabli')).toEqual([])
    expect(natures('remuneration_fixee_par_le_juge')).toEqual(dossier.map((e) => [e.id, 'remuneration_fixee_par_le_juge']))
    for (const cadre of ['tarif_administrateur_provisoire', 'remuneration_fixee_par_le_juge', 'non_etabli'] as const)
      expect(soldeHonorairesSinistre(dossier, 'sin-42', [], cadre)).toMatchObject({ ecartesIds: [], fraisTtcCentimes: 4 * 720 + 155 })
  })
})

describe('honoraires de sinistre — déduction des sommes versées par l’assureur', () => {
  const elements = [
    genere(elementAOuvertureSinistre(ouverture(), 'contrat_type_syndic')),
    { ...corrigerHeures(elementSinistre({ id: 'el-2' }), 0.5), statut: 'Facturé' as const },
    elementSinistre({ id: 'el-autre', fiche: { type: 'Sinistre', id: 'sin-99' } }),
    creerElement({ ...elementSinistre({ id: 'el-ctx' }), dossier: 'Contentieux', fiche: { type: 'Contentieux', id: 'sin-42' } }),
  ]

  it('total des éléments de la fiche (facturés ou non), moins les versements de l’assureur', () => {
    expect(soldeHonorairesSinistre(elements, 'sin-42', [5_000, 3_000], 'contrat_type_syndic')).toEqual({
      elementIds: ['el-s1', 'el-2'],
      ecartesIds: [],
      totalHtCentimes: 13_500,
      totalTtcCentimes: 16_200,
      versementsCentimes: 8_000,
      deductionCentimes: 8_000,
      resteAChargeTtcCentimes: 8_200,
      excedentCentimes: 0,
      fraisTtcCentimes: 0,
    })
  })

  it('les frais d’envoi de la fiche restent à part : ni dans le total des honoraires ni dans la déduction', () => {
    const timbre = elementSinistre({ id: 'el-timbre', nature: 'Timbre', tarif: 'Sinistre - Affranchissement', calcul: 'Coût unitaire', prixUnitaireHtDixMilliemes: 12_900 })
    const solde = soldeHonorairesSinistre([...elements, timbre], 'sin-42', [20_000], 'contrat_type_syndic')
    expect(solde.elementIds).toEqual(['el-s1', 'el-2'])
    expect(solde).toMatchObject({ totalTtcCentimes: 16_200, deductionCentimes: 16_200, excedentCentimes: 3_800, fraisTtcCentimes: 155 })
  })

  it('la déduction est plafonnée au total ; l’excédent est signalé, jamais un reste négatif', () => {
    expect(soldeHonorairesSinistre(elements, 'sin-42', [20_000], 'contrat_type_syndic')).toMatchObject({
      deductionCentimes: 16_200,
      resteAChargeTtcCentimes: 0,
      excedentCentimes: 3_800,
    })
    expect(soldeHonorairesSinistre(elements, 'sin-42', [], 'contrat_type_syndic')).toMatchObject({
      deductionCentimes: 0,
      resteAChargeTtcCentimes: 16_200,
    })
  })

  describe('base de la déduction : la rémunération due dans le cadre (7.2.4, dernier alinéa ; arrêté, art. 14)', () => {
    const fiche = [
      elementSinistre({ id: 'd', tarif: 'Sinistre - Déclaration du sinistre' }),
      elementSinistre({ id: 'r', tarif: 'Sinistre - Règlement des indemnités aux bénéficiaires' }),
      elementSinistre({ id: 'ok', tarif: 'Sinistre - SINISTRE MESURES CONSERVATOIRES' }),
      elementSinistre({ id: 'inc', tarif: 'Gestion - Gestion des sinistres, rendez-vous constat' }),
    ]

    it('contrat type : la déclaration et le règlement (au forfait, 7.1.1) sont écartés et n’absorbent pas l’excédent', () => {
      expect(soldeHonorairesSinistre([fiche[0], fiche[2]], 'sin-42', [20_000], 'contrat_type_syndic')).toMatchObject({
        elementIds: ['ok'],
        ecartesIds: ['d'],
        totalTtcCentimes: 10_800,
        deductionCentimes: 10_800,
        resteAChargeTtcCentimes: 0,
        excedentCentimes: 9_200,
      })
      expect(soldeHonorairesSinistre(fiche, 'sin-42', [], 'contrat_type_syndic')).toMatchObject({ elementIds: ['ok', 'inc'], ecartesIds: ['d', 'r'] })
    })

    it('AP art. 29-1 : seule la déclaration est écartée (arrêté, art. 14) ; 500 lots et plus, non établi : rien n’est écarté', () => {
      expect(soldeHonorairesSinistre(fiche, 'sin-42', [], 'tarif_administrateur_provisoire')).toMatchObject({
        elementIds: ['r', 'ok', 'inc'],
        ecartesIds: ['d'],
      })
      expect(soldeHonorairesSinistre(fiche, 'sin-42', [], 'remuneration_fixee_par_le_juge').ecartesIds).toEqual([])
      expect(soldeHonorairesSinistre(fiche, 'sin-42', [], 'non_etabli').ecartesIds).toEqual([])
    })
  })

  it('refuse un versement qui n’est pas en centimes entiers strictement positifs, un sinistre sans identifiant, un cadre inconnu', () => {
    expect(() => soldeHonorairesSinistre(elements, 'sin-42', [10.5], 'contrat_type_syndic')).toThrow(/versement/i)
    expect(() => soldeHonorairesSinistre(elements, 'sin-42', [0], 'contrat_type_syndic')).toThrow(/versement/i)
    expect(() => soldeHonorairesSinistre(elements, ' ', [], 'contrat_type_syndic')).toThrow(/identifiant/i)
    expect(() => soldeHonorairesSinistre(elements, 'sin-42', [], 'forfait' as never)).toThrow(/cadre/i)
  })
})

describe('honoraires de sinistre — fiches liées (liste « Honoraires (€) » et nœud « Honoraires lignes » du Flux)', () => {
  it('un élément devient une fiche liée : la fiche, la copropriété et le mandat', () => {
    const element = genere(elementAOuvertureSinistre(ouverture(), 'contrat_type_syndic'))
    expect(elementCommeFicheLiee(element)).toEqual({
      id: 'el-s1',
      date: '2026-10-12',
      statut: 'A facturer',
      rattachements: [
        { type: 'Sinistre', id: 'sin-42' },
        { type: 'Copropriété', id: 'copro-tilleuls' },
        { type: 'Mandat de syndic', id: 'mandat-2026' },
      ],
      element,
    })
    expect(elementCommeFicheLiee(elementSinistre({ fiche: null })).rattachements.map((r) => r.type)).toEqual(['Copropriété', 'Mandat de syndic'])
  })

  it('liste les éléments d’un sinistre, filtrés par statut, les plus récents d’abord', () => {
    const elements = [
      genere(elementAOuvertureSinistre(ouverture(), 'contrat_type_syndic')),
      elementSinistre({ id: 'el-5', date: '2026-10-20' }),
      { ...elementSinistre({ id: 'el-6' }), statut: 'Facturé' as const },
      elementSinistre({ id: 'el-7', fiche: { type: 'Sinistre', id: 'sin-99' } }),
    ]
    const page = honorairesDuSinistre(elements, 'sin-42', { statuts: ['A facturer'] })
    expect(page.lignes.map((l) => l.element.id)).toEqual(['el-5', 'el-s1'])
    expect(page.total).toBe(2)
    expect(honorairesDuSinistre(elements, 'sin-42').total).toBe(3)
  })
})
