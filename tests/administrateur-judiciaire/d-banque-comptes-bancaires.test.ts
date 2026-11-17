import { describe, expect, it } from 'vitest'
import {
  MODE_COMPTES_ADMINISTRATEUR_PROVISOIRE,
  MODES_TENUE_COMPTES,
  NATURES_COMPTE_BANCAIRE,
  controlerComptesMandat,
  creerReglagesComptesCabinet,
  resoudreModeComptes,
  validerIban,
  type CompteBancaireMandat,
} from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import { enTeteDuModule } from './en-tete-module'

/**
 * Décision D-BANQUE (Hugo Carvalho, 27/10/2026) — la tenue des comptes bancaires est un CHOIX DU CABINET,
 * modifiable MANDAT PAR MANDAT, pour s'adapter au régime des administrateurs judiciaires.
 * - Quatre modes : compte séparé au nom du syndicat, Caisse des dépôts, les deux, compte centralisateur du cabinet.
 * - Le réglage du cabinet donne le mode par défaut ; un mandat peut le remplacer.
 * - Invariant de droit, quel que soit le mode : le fonds de travaux reste sur un compte DISTINCT (L. 1965 art. 18, II,
 *   al. 4).
 * - Les comptes repris de l'ancien gestionnaire restent identifiables jusqu'à leur solde.
 */

// IBAN de test publiés (exemples ECBS / banques) : clés valides, aucun compte réel.
const IBAN_A = 'FR76 3000 6000 0112 3456 7890 189'
const IBAN_B = 'FR14 2004 1010 0505 0001 3M02 606'

const compte = (surcharge: Partial<CompteBancaireMandat>): CompteBancaireMandat => ({
  nature: 'courant',
  iban: IBAN_A,
  actif: true,
  soldeCentimes: 0,
  ...surcharge,
})

describe('D-BANQUE — référentiels', () => {
  it('propose les quatre modes de tenue, chacun avec un libellé et au moins une nature requise', () => {
    expect(Object.keys(MODES_TENUE_COMPTES)).toEqual([
      'compte_separe_syndicat',
      'caisse_depots',
      'banque_et_caisse_depots',
      'centralisateur_cabinet',
    ])
    for (const mode of Object.values(MODES_TENUE_COMPTES)) {
      expect(mode.libelle).toBeTruthy()
      expect(mode.naturesRequises.length).toBeGreaterThan(0)
    }
  })

  it('distingue les natures de compte observées dans Gestéam, fonds de travaux à part', () => {
    expect(Object.keys(NATURES_COMPTE_BANCAIRE)).toEqual([
      'courant',
      'fonds_travaux',
      'avance_travaux',
      'placement',
      'caisse_depots',
      'sous_compte_centralisateur',
      'repris_ancien_gestionnaire',
    ])
    for (const mode of Object.values(MODES_TENUE_COMPTES)) expect(mode.naturesRequises).not.toContain('fonds_travaux')
  })
})

describe('D-BANQUE — choix du cabinet, remplaçable par mandat', () => {
  it('le cabinet sans réglage tient un compte séparé au nom du syndicat', () => {
    expect(creerReglagesComptesCabinet({})).toEqual({ modeParDefaut: 'compte_separe_syndicat' })
  })

  it('refuse un mode inconnu', () => {
    expect(() => creerReglagesComptesCabinet({ modeParDefaut: 'livret' as never })).toThrow(/mode de tenue inconnu/i)
  })

  it('applique le mode du cabinet quand le mandat ne choisit rien', () => {
    const cabinet = creerReglagesComptesCabinet({ modeParDefaut: 'caisse_depots' })
    expect(resoudreModeComptes(cabinet, null)).toEqual({ mode: 'caisse_depots', origine: 'cabinet' })
    expect(resoudreModeComptes(cabinet, undefined)).toEqual({ mode: 'caisse_depots', origine: 'cabinet' })
  })

  it('le choix du mandat remplace celui du cabinet', () => {
    const cabinet = creerReglagesComptesCabinet({ modeParDefaut: 'caisse_depots' })
    expect(resoudreModeComptes(cabinet, 'banque_et_caisse_depots')).toEqual({
      mode: 'banque_et_caisse_depots',
      origine: 'mandat',
    })
  })

  it('refuse un mode de mandat inconnu', () => {
    expect(() => resoudreModeComptes(creerReglagesComptesCabinet({}), 'livret' as never)).toThrow(/mode de tenue inconnu/i)
  })
})

/**
 * Décision J37 de Hugo (03/11/2026) : dans la pratique du cabinet, le compte de l'administrateur provisoire est un compte
 * à la Caisse des dépôts, pas un compte centralisateur du cabinet ; le fonds de travaux reste sur un compte distinct.
 * D-BANQUE n'est pas remise en cause : la pratique est consignée, aucun mode n'est imposé.
 */
describe('J37 — compte de l’administrateur provisoire : la pratique du cabinet, sans rien imposer', () => {
  it('la pratique consignée est le compte à la Caisse des dépôts, un des modes du réglage', () => {
    expect(MODE_COMPTES_ADMINISTRATEUR_PROVISOIRE).toBe('caisse_depots')
    expect(Object.keys(MODES_TENUE_COMPTES)).toContain(MODE_COMPTES_ADMINISTRATEUR_PROVISOIRE)
    expect(MODE_COMPTES_ADMINISTRATEUR_PROVISOIRE).not.toBe('centralisateur_cabinet')
  })

  it('D-BANQUE inchangée : le réglage par défaut du cabinet et le choix du mandat restent libres', () => {
    expect(creerReglagesComptesCabinet({})).toEqual({ modeParDefaut: 'compte_separe_syndicat' })
    const cabinet = creerReglagesComptesCabinet({ modeParDefaut: MODE_COMPTES_ADMINISTRATEUR_PROVISOIRE })
    expect(resoudreModeComptes(cabinet, null)).toEqual({ mode: 'caisse_depots', origine: 'cabinet' })
    expect(resoudreModeComptes(cabinet, 'centralisateur_cabinet')).toEqual({ mode: 'centralisateur_cabinet', origine: 'mandat' })
  })

  it('à la Caisse des dépôts, sans IBAN, le fonds de travaux exige toujours son propre compte', () => {
    const cdc = compte({ nature: 'caisse_depots', iban: null })
    const sansFonds = controlerComptesMandat({ mode: 'caisse_depots', fondsTravaux: true, comptes: [cdc] })
    expect(sansFonds.map((a) => a.code)).toEqual(['fonds_travaux_manquant'])
    const avecFonds = controlerComptesMandat({
      mode: 'caisse_depots',
      fondsTravaux: true,
      comptes: [cdc, compte({ nature: 'fonds_travaux', iban: null })],
    })
    expect(avecFonds).toEqual([])
  })

  it('en-tête : rubrique « Décisions de Hugo du 03/11/2026 » avec J37 ; les textes du dépôt et la portée de l’art. 18, II, al. 3 restent ouverts', () => {
    const { texte: entete } = enTeteDuModule('comptes-bancaires')
    const decisions = entete.slice(entete.indexOf('Décisions de Hugo du 03/11/2026'), entete.indexOf('🔴'))
    expect(decisions).toMatch(/J37/)
    expect(decisions).toMatch(/compte à la Caisse des dépôts, pas un compte centralisateur du cabinet/)
    expect(decisions).toMatch(/D-BANQUE/)
    expect(decisions).toContain('art. 18, II, al. 4')
    const nonEtabli = entete.slice(entete.indexOf('🔴'))
    expect(nonEtabli).toMatch(/textes qui fondent le dépôt à la Caisse des dépôts/)
    expect(nonEtabli).toMatch(/la portée de l'art\. 18, II, al\. 3 \(compte séparé au nom du syndicat\)/)
    expect(nonEtabli).not.toMatch(/C\. com\., livre VIII\) et la portée/)
  })

  it('en-tête : le compte séparé du fonds de travaux est fondé sur L. 1965 art. 18, II, al. 4, pas sur l’art. 14-2-1', () => {
    const { texte: entete } = enTeteDuModule('comptes-bancaires')
    expect(entete).toMatch(/le fonds de travaux est déposé sur un compte séparé \(L\. 1965 art\. 18, II, al\. 4/)
    expect(entete).not.toMatch(/compte séparé \(L\. 1965 art\. 14-2-1\)/)
  })
})

describe('D-BANQUE — IBAN', () => {
  it('accepte un IBAN valide, avec ou sans espaces, en minuscules', () => {
    expect(validerIban(IBAN_A)).toBe(true)
    expect(validerIban(IBAN_B.replace(/ /g, '').toLowerCase())).toBe(true)
  })

  it('refuse une clé fausse, un format court ou vide', () => {
    expect(validerIban('FR76 3000 6000 0112 3456 7890 188')).toBe(false)
    expect(validerIban('FR76')).toBe(false)
    expect(validerIban('')).toBe(false)
  })
})

describe('D-BANQUE — contrôle des comptes d\'un mandat', () => {
  it('aucune anomalie quand les comptes requis par le mode et le fonds de travaux sont ouverts', () => {
    const anomalies = controlerComptesMandat({
      mode: 'banque_et_caisse_depots',
      fondsTravaux: true,
      comptes: [
        compte({ nature: 'courant' }),
        compte({ nature: 'caisse_depots', iban: null }),
        compte({ nature: 'fonds_travaux', iban: IBAN_B }),
      ],
    })
    expect(anomalies).toEqual([])
  })

  it('signale la nature requise par le mode et absente (un compte inactif ne compte pas)', () => {
    const anomalies = controlerComptesMandat({
      mode: 'caisse_depots',
      fondsTravaux: false,
      comptes: [compte({ nature: 'courant' }), compte({ nature: 'caisse_depots', actif: false })],
    })
    expect(anomalies.map((a) => a.code)).toEqual(['nature_manquante'])
    expect(anomalies[0].message).toMatch(/Caisse des dépôts/)
  })

  it('exige un compte de fonds de travaux distinct quand la copropriété en est dotée, fondement cité', () => {
    const anomalies = controlerComptesMandat({ mode: 'compte_separe_syndicat', fondsTravaux: true, comptes: [compte({})] })
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0]).toMatchObject({ code: 'fonds_travaux_manquant', gravite: 'bloquant', fondement: 'L. 1965 art. 18, II, al. 4' })
  })

  it('refuse un fonds de travaux sur le même IBAN qu\'un autre compte du mandat', () => {
    const anomalies = controlerComptesMandat({
      mode: 'compte_separe_syndicat',
      fondsTravaux: true,
      comptes: [compte({ nature: 'courant' }), compte({ nature: 'fonds_travaux', iban: IBAN_A.replace(/ /g, '') })],
    })
    expect(anomalies.map((a) => a.code)).toEqual(['fonds_travaux_confondu'])
    expect(anomalies[0].fondement).toBe('L. 1965 art. 18, II, al. 4')
  })

  it('signale un IBAN invalide sans bloquer les autres contrôles', () => {
    const anomalies = controlerComptesMandat({
      mode: 'compte_separe_syndicat',
      fondsTravaux: false,
      comptes: [compte({ iban: 'FR76 3000 6000 0112 3456 7890 188' })],
    })
    expect(anomalies.map((a) => a.code)).toEqual(['iban_invalide'])
  })

  it('rappelle de solder un compte repris de l\'ancien gestionnaire — alerte de gestion, sans texte cité', () => {
    const anomalies = controlerComptesMandat({
      mode: 'compte_separe_syndicat',
      fondsTravaux: false,
      comptes: [compte({}), compte({ nature: 'repris_ancien_gestionnaire', iban: IBAN_B, soldeCentimes: 152_000 })],
    })
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0]).toMatchObject({ code: 'compte_repris_a_solder', gravite: 'alerte' })
    expect(anomalies[0].fondement).toBeNull()
  })

  it('un compte repris soldé ne déclenche rien', () => {
    const anomalies = controlerComptesMandat({
      mode: 'compte_separe_syndicat',
      fondsTravaux: false,
      comptes: [compte({}), compte({ nature: 'repris_ancien_gestionnaire', iban: IBAN_B, soldeCentimes: 0 })],
    })
    expect(anomalies).toEqual([])
  })

  it('le mode centralisateur demande un sous-compte du cabinet, sans IBAN propre', () => {
    expect(
      controlerComptesMandat({
        mode: 'centralisateur_cabinet',
        fondsTravaux: false,
        comptes: [compte({ nature: 'sous_compte_centralisateur', iban: null })],
      }),
    ).toEqual([])
  })
})
