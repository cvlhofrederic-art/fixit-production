import { describe, expect, it } from 'vitest'
import {
  NATURES_REMUNERATION,
  creerElement,
  totalElement,
  type ElementAFacturer,
  type MissionHonoraires,
  type SaisieElement,
} from '@/lib/administrateur-judiciaire/domain/honoraires-facturation'
import {
  CADRES_REMUNERATION_SINISTRE,
  DILIGENCES_SINISTRE_AU_FORFAIT,
  DILIGENCES_SINISTRE_HORS_FORFAIT,
  FONDEMENTS_HONORAIRES_SINISTRE,
  HEURES_A_L_OUVERTURE_SINISTRE,
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
import { regimeDepuisFondement } from '@/lib/administrateur-judiciaire/domain/fondements'
import { enTeteDuModule } from './en-tete-module'

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

/** « Offert » n'est admis qu'au contrat type (J67, R9) : passer alors 'contrat_type_syndic'. */
const elementSinistre = (surcharge: Partial<SaisieElement> = {}, mission: MissionHonoraires = 'judiciaire'): ElementAFacturer =>
  creerElement(
    {
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
    },
    mission,
  )

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

  it('fondements par cadre : contrat type, tarif de l’AP (arrêté, art. 14), fixée par le juge (art. 3), fixée par le président (J67, R1), régime inconnu', () => {
    expect(CADRES_REMUNERATION_SINISTRE).toEqual([
      'contrat_type_syndic',
      'tarif_administrateur_provisoire',
      'remuneration_fixee_par_le_juge',
      'remuneration_fixee_par_le_president',
      'regime_inconnu',
    ])
    expect(FONDEMENTS_HONORAIRES_SINISTRE.regime_inconnu).toBe(FONDEMENTS_HONORAIRES_SINISTRE.remuneration_fixee_par_le_president)
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
    expect(FONDEMENTS_HONORAIRES_SINISTRE.remuneration_fixee_par_le_president).toEqual([
      'C. com. R. 814-27 : rémunération fixée sur justification par le président qui a désigné ; recours, CPC art. 714 à 718',
      'C. com. R. 814-28 : provision',
      'D. 1967 art. 46, 47 et 49 : désignations par le président du tribunal judiciaire',
      'D. 1967 art. 61-1-4 : mandataire ad hoc des art. 29-1 A à 29-1 C',
    ])
  })
})

describe('honoraires de sinistre — en-tête : décisions J67 (R1, R2, R8, R14) citées, questions tranchées retirées', () => {
  const { texte, item } = enTeteDuModule('honoraires-sinistre')

  it('J67, R1 : C. com. R. 814-27 et R. 814-28 remplacent « aucun texte trouvé » ; plus de question sur la base de rémunération', () => {
    expect(texte).not.toMatch(/Aucun texte trouvé sur la rémunération/)
    expect(texte).not.toMatch(/Quelle base de rémunération le cabinet applique-t-il/)
    expect(item('- 🟢 Syndic désigné par le juge')).toMatch(/C\. com\. R\. 814-27.*R\. 814-28.*61-1-4.*J67, R1/)
  })

  it('J67, R2 : aucun élément « A facturer » sans ordonnance en administration provisoire, choix confirmé', () => {
    expect(texte).not.toMatch(/est-il prélevé directement sur le compte du\s+syndicat/)
    expect(item('- J67, R2')).toMatch(/1 500 € HT.*sous 500 lots.*preparerFacture/)
  })

  it('J67, R8 : déduction sur le TTC, équivalent HT rendu à part, sans citer le CGI ; plus de question', () => {
    const r8 = item('- J67, R8')
    expect(r8).toMatch(/directive 2006\/112\/CE, art\. 73/)
    expect(r8).toMatch(/deductionHtEquivalentCentimes/)
    expect(r8).toMatch(/comptable du cabinet/)
    expect(texte).not.toMatch(/CGI|266/)
    expect(texte).not.toMatch(/s'impute-t-elle sur le TTC/)
  })

  it('J67, R14 : sans objet pour le cabinet (C. com. L. 811-10) ; la règle du contrat type reste écrite', () => {
    expect(item('- J67, R14')).toMatch(/sans objet pour le cabinet \(C\. com\. L\. 811-10.*7\.2\.1/)
    expect(texte).not.toMatch(/🔴 \(Frédéric\) Au contrat type, les copies/)
  })

  it('J72 (b) : frais d’envoi hors contrat type tranchés ; la question 🔴 « R5 et R6 » est retirée', () => {
    expect(texte).not.toMatch(/🔴 \(Hugo\) En administration provisoire de moins de 500 lots/)
    expect(texte).not.toMatch(/Choix actuel : seule l'absence de fiche est signalée/)
    expect(texte).not.toMatch(/R5 et R6 à concilier|Une seule règle est à\s+choisir/)
    const j72 = item('- J72 (décision de Hugo du 18/11/2026')
    expect(j72).toMatch(/frais du cabinet, à part de sa rémunération/)
    expect(j72).toMatch(/annexe « frais et débours »/)
    expect(j72).toMatch(/C\. com\. R\. 814-27/)
    expect(j72).toMatch(/frais_a_presenter_au_juge/)
    expect(j72).toMatch(/\(a\).*dépense du syndicat.*etapes-courrier\.ts/)
  })

  it('décision du 20/11/2026 (partie C, F5) : actes hors tarif chiffrés au temps passé × taux horaire ; la question 🔴 est retirée', () => {
    expect(texte).not.toMatch(/comment le cabinet chiffre-t-il les actes hors tarif/)
    const f5 = item('- Décision du 20/11/2026 (partie C, F5)')
    expect(f5).toMatch(/temps passé, en minutes exactes, multiplié par le taux horaire du cabinet, acte par acte/)
    expect(f5).toMatch(/date, la durée, l'objet et la fiche liée/)
    expect(f5).toMatch(/demande présentée au juge, jamais une facture au syndicat/)
    expect(f5).toMatch(/arrêté du 8 octobre 2015, art\. 14.*D\. 1967 art\. 61-1-5, II et III.*810\.2 et 820\.3/)
    expect(f5).toMatch(/actes-hors-tarif\.ts/)
    expect(f5).toMatch(/Aucun élément « A facturer »/)
  })
})

describe('honoraires de sinistre — rémunération et frais', () => {
  it('trois natures rémunèrent une diligence ; les autres (timbre, AR, copie, envois, diffuseurs) sont des frais (🔵)', () => {
    expect(NATURES_REMUNERATION_SINISTRE).toEqual(['Vacations', 'Honoraires', 'Prestations'])
  })

  it('la liste est celle de honoraires-facturation.ts, partagée avec le tableau des honoraires (une seule définition)', () => {
    expect(NATURES_REMUNERATION_SINISTRE).toBe(NATURES_REMUNERATION)
  })

  it('en-tête : l’alinéa du 7.1.5 sur l’envoi des documents n’est pas le dernier (suivent les archives, l’accès en ligne, le prorata)', () => {
    const { texte } = enTeteDuModule('honoraires-sinistre')
    expect(texte).not.toMatch(/7\.1\.5, dernier alinéa/)
    expect(texte).toMatch(/7\.1\.5, alinéa sur l'envoi des documents/)
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
  it('AP art. 29-1 : tarif de l’administrateur provisoire ; AP art. 47, syndic judiciaire : fixée par le président (J67, R1) ; régime null : inconnu', () => {
    expect(cadreRemunerationDuRegime('ap291', 120)).toBe('tarif_administrateur_provisoire')
    expect(cadreRemunerationDuRegime('ap291', 499)).toBe('tarif_administrateur_provisoire')
    expect(cadreRemunerationDuRegime('ap47', 600)).toBe('remuneration_fixee_par_le_president')
    expect(cadreRemunerationDuRegime('sj', 12)).toBe('remuneration_fixee_par_le_president')
    // Fondement vide, mal saisi, ou mandat ad hoc : fondements.ts rend null sans distinguer.
    for (const fondement of ['', 'Administration provisoire', 'Mandat ad hoc'])
      expect(cadreRemunerationDuRegime(regimeDepuisFondement(fondement), 12)).toBe('regime_inconnu')
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

  it('J38 : l’élément s’ouvre à 1 heure, comme Gestéam (choix confirmé), puis se corrige', () => {
    expect(HEURES_A_L_OUVERTURE_SINISTRE).toBe(1)
    const element = genere(elementAOuvertureSinistre(ouverture(), 'contrat_type_syndic'))
    expect(element.quantite).toBe(HEURES_A_L_OUVERTURE_SINISTRE)
    expect(corrigerHeures(element, 1.75).quantite).toBe(1.75)
    const { texte } = enTeteDuModule('honoraires-sinistre')
    const decisions = texte.slice(texte.indexOf('Décisions de Hugo du 03/11/2026'), texte.indexOf('Questions ouvertes'))
    expect(decisions).toMatch(/J38/)
    expect(decisions).toMatch(/1 heure/)
    expect(texte).not.toMatch(/Garder 1 heure par défaut \(choix actuel\), ou créer l'élément à 0 heure/)
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
    // Décision du 20/11/2026 (partie C, F5) : noter le temps, chiffré au taux horaire du cabinet, demande au juge.
    expect(resultat.signalement).toMatch(/temps passé, en minutes exactes, × taux horaire du cabinet/)
    expect(resultat.signalement).toMatch(/demande présentée au juge, jamais une facture au syndicat/)
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

  it('art. 46, 47 et 49 : fixée par le président qui a désigné (C. com. R. 814-27) ; mandataire ad hoc à part (D. 1967 art. 61-1-4) ; aucun élément', () => {
    const resultat = elementAOuvertureSinistre(ouverture(), 'remuneration_fixee_par_le_president')
    expect(resultat.genere).toBe(false)
    if (resultat.genere) return
    expect(resultat.motif).toBe('a_soumettre_au_juge')
    expect(resultat.signalement).toMatch(
      /Syndic judiciaire \(art\. 46\), AP faute de syndic \(art\. 47\) ou administrateur ad hoc \(art\. 49\) : rémunération fixée par le président du tribunal qui a désigné le cabinet, sur justification des diligences \(C\. com\. R\. 814-27 ; provision possible, R\. 814-28\)\./,
    )
    // R. 814-27 n'est pas cité pour le mandataire ad hoc, qui a son propre régime (J67, R1).
    expect(resultat.signalement).toMatch(
      /Mandataire ad hoc \(art\. 29-1 A à 29-1 C\) : rémunération arrêtée par le président en fin de mission \(D\. 1967 art\. 61-1-4 ; forfait de l'arrêté du 8 octobre 2015, art\. 1, sous 500 lots ; au-delà, conditions fixées par l'ordonnance de désignation\)\. À soumettre au président/,
    )
    expect(resultat.signalement).not.toMatch(/mandataire ad hoc\)? : rémunération fixée par le président du tribunal/i)
    expect(resultat.signalement).toMatch(/aucun élément « A facturer » n'est créé/)
    expect(resultat.signalement).not.toMatch(/non établie|à confirmer/)
    expect(resultat.fondements).toEqual(FONDEMENTS_HONORAIRES_SINISTRE.remuneration_fixee_par_le_president)
  })

  it('régime inconnu (fondement vide ou non reconnu, ou ad hoc) : rien n’est affirmé sur le régime, à vérifier ; même comportement', () => {
    const resultat = elementAOuvertureSinistre(ouverture(), cadreRemunerationDuRegime(regimeDepuisFondement(''), 120))
    expect(resultat).toMatchObject({ genere: false, motif: 'a_soumettre_au_juge', fondements: FONDEMENTS_HONORAIRES_SINISTRE.regime_inconnu })
    if (resultat.genere) return
    expect(resultat.signalement).toMatch(/^Régime du mandat non reconnu \(fondement vide ou non reconnu, ou mandat ad hoc\) : par défaut, .*à vérifier sur le fondement du mandat\./)
    expect(resultat.signalement).toMatch(/Administrateur ad hoc \(art\. 49\) : sur justification des diligences \(C\. com\. R\. 814-27/)
    expect(resultat.signalement).toMatch(/Mandataire ad hoc \(art\. 29-1 A à 29-1 C\) : .*D\. 1967 art\. 61-1-4/)
    expect(resultat.signalement).toMatch(/Administration provisoire de l'art\. 29-1 : corriger le fondement, son tarif s'applique \(D\. 1967 art\. 61-1-5\)\./)
    expect(resultat.signalement).not.toMatch(/Mandat de justice hors du tarif de l'art\. 29-1/)
    expect(resultat.signalement).toMatch(/aucun élément « A facturer » n'est créé\.$/)
  })

  it('aucun prénom de l’équipe dans les signalements renvoyés à l’écran', () => {
    for (const cadre of ['tarif_administrateur_provisoire', 'remuneration_fixee_par_le_juge', 'remuneration_fixee_par_le_president', 'regime_inconnu'] as const) {
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

  it('500 lots et plus, rémunération fixée par le président, régime inconnu : rien n’est refusé, la déclaration comprise', () => {
    const declaration = ouverture({ diligence: 'declaration', tarif: 'Sinistre - Déclaration du sinistre' })
    for (const cadre of ['remuneration_fixee_par_le_juge', 'remuneration_fixee_par_le_president', 'regime_inconnu'] as const)
      expect(elementAOuvertureSinistre(declaration, cadre)).toMatchObject({ genere: false, motif: 'a_soumettre_au_juge', diligence: 'declaration' })
  })

  it('hors contrat type, la diligence doit être connue et le tarif ne doit pas en viser une autre', () => {
    expect(() => elementAOuvertureSinistre(ouverture({ diligence: 'expertise' as never }), 'remuneration_fixee_par_le_president')).toThrow(/inconnue/i)
    expect(() =>
      elementAOuvertureSinistre(ouverture({ diligence: 'deplacement', tarif: 'Sinistre - SINISTRE MESURES CONSERVATOIRES' }), 'remuneration_fixee_par_le_president'),
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
    elementSinistre({ id: 'el-ctx', dossier: 'Contentieux', fiche: null, tarif: 'Contentieux - MISE EN DEMEURE' }),
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

  it('AP art. 29-1 : l’acte hors tarif se chiffre au temps passé × taux horaire du cabinet, demande au juge (décision du 20/11/2026, F5)', () => {
    const message = messageDe('tarif_administrateur_provisoire', 'el-s1')
    expect(message).toMatch(/temps passé, en minutes exactes, × taux horaire du cabinet/)
    expect(message).toMatch(/dans l'état des actes hors tarif/)
    expect(message).toMatch(/demande présentée au juge, jamais une facture au syndicat/)
    expect(message).toMatch(/décision du 20\/11\/2026, F5/)
    // La déclaration, exclue des actes hors tarif, n'est pas chiffrée ; à 500 lots et plus, pas d'acte hors tarif.
    expect(messageDe('tarif_administrateur_provisoire', 'el-decl')).not.toMatch(/taux horaire/)
    expect(messageDe('remuneration_fixee_par_le_juge', 'el-s1')).not.toMatch(/taux horaire|F5/)
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

  it('rémunération fixée par le président : chaque élément de sinistre est à lui soumettre (C. com. R. 814-27), sans prénom de l’équipe', () => {
    const signales = controlerHonorairesSinistre(elements, 'remuneration_fixee_par_le_president').filter(
      (a) => a.nature === 'remuneration_fixee_par_le_president',
    )
    expect(signales.map((a) => a.elementId)).toEqual(['el-s1', 'el-sf', 'el-decl', 'el-regl', 'el-inc', 'el-rcp'])
    expect(signales[0].message).toMatch(/C\. com\. R\. 814-27 ; provision possible, R\. 814-28\)\. Mandataire ad hoc/)
    expect(signales[0].message).toMatch(/\. À soumettre au président, pas à facturer au syndicat\.$/)
    expect(signales[0].message).not.toMatch(/Frédéric|Hugo|à confirmer/)
  })

  it('régime inconnu : chaque élément de sinistre est signalé « regime_inconnu », à vérifier sur le fondement du mandat', () => {
    const signales = controlerHonorairesSinistre(elements, 'regime_inconnu').filter((a) => a.nature === 'regime_inconnu')
    expect(signales.map((a) => a.elementId)).toEqual(['el-s1', 'el-sf', 'el-decl', 'el-regl', 'el-inc', 'el-rcp'])
    expect(signales[0].message).toMatch(/^Régime du mandat non reconnu .*\. À soumettre au juge, pas à facturer au syndicat\.$/)
  })

  const frais = [
    elementSinistre({ id: 'el-timbre', nature: 'Timbre', tarif: 'Sinistre - Affranchissement', calcul: 'Coût unitaire', prixUnitaireHtDixMilliemes: 12_900 }),
    elementSinistre({ id: 'el-ar', nature: 'AR', tarif: 'AR', calcul: 'Coût unitaire', fiche: null, prixUnitaireHtDixMilliemes: 54_000 }),
  ]
  const naturesDesFrais = (cadre: Parameters<typeof controlerHonorairesSinistre>[1]) =>
    controlerHonorairesSinistre(frais, cadre).map((a) => [a.elementId, a.nature])

  it('contrat type de syndic : frais d’envoi remboursés au syndic à part (7.1.5, 7.2.1) ; seule l’absence de fiche est signalée', () => {
    expect(naturesDesFrais('contrat_type_syndic')).toEqual([['el-ar', 'sans_fiche']])
  })

  it('J72 (b) : hors contrat type, chaque frais du dossier Sinistre est signalé « à présenter au juge », pas à facturer au syndicat', () => {
    const cadres = ['tarif_administrateur_provisoire', 'remuneration_fixee_par_le_juge', 'remuneration_fixee_par_le_president', 'regime_inconnu'] as const
    for (const cadre of cadres)
      expect(naturesDesFrais(cadre), cadre).toEqual([
        ['el-timbre', 'frais_a_presenter_au_juge'],
        ['el-ar', 'sans_fiche'],
        ['el-ar', 'frais_a_presenter_au_juge'],
      ])
    const message = (cadre: Parameters<typeof controlerHonorairesSinistre>[1]) =>
      controlerHonorairesSinistre(frais, cadre).find((a) => a.elementId === 'el-timbre')?.message ?? ''
    for (const cadre of cadres) {
      expect(message(cadre), cadre).toMatch(
        /^Tarif « Sinistre - Affranchissement » \(Timbre\) : frais du cabinet, à part de sa rémunération ; à présenter au juge en annexe « frais et débours », payés seulement en vertu de son ordonnance \(.*J72, b\) ; pas à facturer au syndicat\.$/,
      )
      expect(message(cadre)).not.toMatch(/Hugo|Frédéric/)
    }
    // relecture : le fondement de J72 (b) est l'ordonnance qui arrête les frais et débours (J67, R5), pas l'art. 61-1-5, II
    // (émoluments seuls) ni son III, al. 2 (droits proportionnels au-delà du seuil de l'arrêté)
    expect(message('tarif_administrateur_provisoire')).toContain('frais et débours arrêtés par l’ordonnance du président, Cass. 3e civ., 21/05/2026, n° 24-20.377 (J67, R5)')
    for (const cadre of cadres) expect(message(cadre), cadre).not.toMatch(/61-1-5, II/)
    expect(message('regime_inconnu')).toContain('Cass. 3e civ., 21/05/2026, n° 24-20.377')
    // 500 lots et plus : le juge fixe la rémunération « en fonction des frais engagés » (arrêté, art. 3)
    expect(message('remuneration_fixee_par_le_juge')).toContain('arrêté du 8 octobre 2015, art. 3')
    expect(message('remuneration_fixee_par_le_president')).toContain('C. com. R. 814-27')
    expect(message('regime_inconnu')).toMatch(/régime du mandat à vérifier/)
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

  it('les copies des quatre diligences hors forfait, ou d’aucune diligence nommée, restent des frais sans anomalie (J67, R14 : sans objet pour le cabinet)', () => {
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
      deductionHtEquivalentCentimes: 0,
      resteAChargeTtcCentimes: 0,
      excedentCentimes: 5_000,
      fraisTtcCentimes: 720 + 720 + 155,
    })
  })

  it('hors contrat type, le forfait du 7.1.1 ne s’applique pas : rien n’est écarté ; chaque copie et l’envoi sont à présenter au juge (J72, b)', () => {
    for (const cadre of ['tarif_administrateur_provisoire', 'remuneration_fixee_par_le_president', 'remuneration_fixee_par_le_juge'] as const)
      expect(natures(cadre), cadre).toEqual(dossier.map((e) => [e.id, 'frais_a_presenter_au_juge']))
    for (const cadre of ['tarif_administrateur_provisoire', 'remuneration_fixee_par_le_juge', 'remuneration_fixee_par_le_president'] as const)
      expect(soldeHonorairesSinistre(dossier, 'sin-42', [], cadre)).toMatchObject({ ecartesIds: [], fraisTtcCentimes: 4 * 720 + 155 })
  })
})

describe('honoraires de sinistre — déduction des sommes versées par l’assureur', () => {
  const elements = [
    genere(elementAOuvertureSinistre(ouverture(), 'contrat_type_syndic')),
    { ...corrigerHeures(elementSinistre({ id: 'el-2' }), 0.5), statut: 'Facturé' as const },
    elementSinistre({ id: 'el-autre', fiche: { type: 'Sinistre', id: 'sin-99' } }),
    elementSinistre({ id: 'el-ctx', dossier: 'Contentieux', fiche: { type: 'Contentieux', id: 'sin-42' } }),
  ]

  it('total des éléments de la fiche (facturés ou non), moins les versements de l’assureur', () => {
    expect(soldeHonorairesSinistre(elements, 'sin-42', [5_000, 3_000], 'contrat_type_syndic')).toEqual({
      elementIds: ['el-s1', 'el-2'],
      ecartesIds: [],
      totalHtCentimes: 13_500,
      totalTtcCentimes: 16_200,
      versementsCentimes: 8_000,
      deductionCentimes: 8_000,
      deductionHtEquivalentCentimes: 6_667,
      resteAChargeTtcCentimes: 8_200,
      excedentCentimes: 0,
      fraisTtcCentimes: 0,
    })
  })

  it('J67, R8 : la déduction porte sur le TTC ; son équivalent HT (déduction ÷ (1 + taux)) est rendu quand un seul taux de TVA', () => {
    expect(soldeHonorairesSinistre(elements, 'sin-42', [20_000], 'contrat_type_syndic').deductionHtEquivalentCentimes).toBe(13_500)
    const sansTva = elementSinistre({ id: 'el-ht', soumisTva: false })
    expect(soldeHonorairesSinistre([sansTva], 'sin-42', [3_000], 'contrat_type_syndic').deductionHtEquivalentCentimes).toBe(3_000)
    const mixte = [elements[0], elementSinistre({ id: 'el-55', tauxTvaPct: 5.5 })]
    expect(soldeHonorairesSinistre(mixte, 'sin-42', [3_000], 'contrat_type_syndic')).toMatchObject({
      deductionCentimes: 3_000,
      deductionHtEquivalentCentimes: null,
    })
    const reduit = elementSinistre({ id: 'el-55', tauxTvaPct: 5.5 })
    expect(soldeHonorairesSinistre([reduit], 'sin-42', [1_055], 'tarif_administrateur_provisoire').deductionHtEquivalentCentimes).toBe(1_000)
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

    it('AP art. 29-1 : seule la déclaration est écartée (arrêté, art. 14) ; 500 lots et plus, fixée par le président : rien n’est écarté', () => {
      expect(soldeHonorairesSinistre(fiche, 'sin-42', [], 'tarif_administrateur_provisoire')).toMatchObject({
        elementIds: ['r', 'ok', 'inc'],
        ecartesIds: ['d'],
      })
      expect(soldeHonorairesSinistre(fiche, 'sin-42', [], 'remuneration_fixee_par_le_juge').ecartesIds).toEqual([])
      expect(soldeHonorairesSinistre(fiche, 'sin-42', [], 'remuneration_fixee_par_le_president').ecartesIds).toEqual([])
    })
  })

  it('refuse un versement qui n’est pas en centimes entiers strictement positifs, un sinistre sans identifiant, un cadre inconnu', () => {
    expect(() => soldeHonorairesSinistre(elements, 'sin-42', [10.5], 'contrat_type_syndic')).toThrow(/versement/i)
    expect(() => soldeHonorairesSinistre(elements, 'sin-42', [0], 'contrat_type_syndic')).toThrow(/versement/i)
    expect(() => soldeHonorairesSinistre(elements, ' ', [], 'contrat_type_syndic')).toThrow(/identifiant/i)
    expect(() => soldeHonorairesSinistre(elements, 'sin-42', [], 'forfait' as never)).toThrow(/cadre/i)
  })
})

describe('honoraires de sinistre — élément offert ou en contrôle des coûts (point 67 ; tranche 43 § 13)', () => {
  /** Une diligence au forfait se trace en « Offert » ou « Contrôle coûts » (tranche 43 § 13) : ni non due, ni à soumettre. */
  const traces = [
    elementSinistre({ id: 'of-decl', tarif: 'Sinistre - Déclaration du sinistre', qualification: 'Offert' }, 'contrat_type_syndic'),
    elementSinistre({ id: 'cc-regl', tarif: 'Sinistre - Règlement des indemnités aux bénéficiaires', qualification: 'Contrôle coûts' }),
    elementSinistre({ id: 'cc-inc', tarif: 'Sinistre - FRAIS DIVERS', qualification: 'Contrôle coûts' }),
    elementSinistre({ id: 'cc-sf', fiche: null, qualification: 'Contrôle coûts' }),
    elementSinistre({
      id: 'of-copie',
      nature: 'Copie',
      calcul: 'Coût unitaire',
      quantite: 40,
      prixUnitaireHtDixMilliemes: 1_500,
      tarif: 'Sinistre - Copies de la déclaration du sinistre',
      qualification: 'Offert',
    }, 'contrat_type_syndic'),
  ]

  it('contrôle : seule l’absence de fiche est signalée, dans chacun des cadres', () => {
    for (const cadre of CADRES_REMUNERATION_SINISTRE)
      expect(controlerHonorairesSinistre(traces, cadre).map((a) => [a.elementId, a.nature])).toEqual([['cc-sf', 'sans_fiche']])
  })

  it('la même diligence au forfait, facturable, reste signalée (contrat type, 7.1.1)', () => {
    const facturable = elementSinistre({ id: 'fa-decl', tarif: 'Sinistre - Déclaration du sinistre', qualification: 'Facturable' })
    expect(controlerHonorairesSinistre([facturable], 'contrat_type_syndic').map((a) => a.nature)).toEqual(['diligence_au_forfait'])
  })

  it('solde : les éléments non facturables sont hors base, hors frais et hors écartés', () => {
    const fiche = [...traces, elementSinistre({ id: 'ok' }), elementSinistre({ id: 'timbre', nature: 'Timbre', calcul: 'Coût unitaire', prixUnitaireHtDixMilliemes: 12_900 })]
    for (const cadre of CADRES_REMUNERATION_SINISTRE)
      expect(soldeHonorairesSinistre(fiche, 'sin-42', [5_000], cadre)).toEqual({
        elementIds: ['ok'],
        ecartesIds: [],
        totalHtCentimes: 9_000,
        totalTtcCentimes: 10_800,
        versementsCentimes: 5_000,
        deductionCentimes: 5_000,
        deductionHtEquivalentCentimes: 4_167,
        resteAChargeTtcCentimes: 5_800,
        excedentCentimes: 0,
        fraisTtcCentimes: 155,
      })
  })

  it('la liste « Honoraires (€) » de la fiche montre aussi les éléments offerts ou en contrôle des coûts', () => {
    expect(honorairesDuSinistre(traces, 'sin-42').total).toBe(4)
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
