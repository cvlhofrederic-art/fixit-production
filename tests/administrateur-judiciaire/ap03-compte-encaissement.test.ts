import { describe, expect, it } from 'vitest'
import {
  MODES_TENUE_COMPTES,
  NATURES_COMPTE_BANCAIRE,
  compteEncaissement,
  creerReglagesComptesCabinet,
  enMilieuDePhrase,
  estCompteDuFondsTravaux,
  lireModeComptes,
  type CompteCandidatEncaissement,
  type ModeComptesLu,
  type ModeTenueComptes,
} from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'

/**
 * Décision du 22/11/2026 (point 3 de la page « Appels de fonds », ap-03) : l'avis lit le mode de tenue réglé (choix du
 * mandat, à défaut réglage du cabinet : D-BANQUE) avant toute diffusion, au lieu de l'ordre fixe « compte courant, puis
 * Caisse des dépôts, puis sous-compte du centralisateur ».
 * - Un seul compte reçoit les règlements : celui de la nature que le mode fait recevoir (compteEncaissement), jamais un
 *   compte du fonds de travaux, jamais un compte clôturé, sans repli sur une autre nature.
 * - Compte absent, sans IBAN valide, ambigu ou qui reprend l'IBAN du fonds de travaux, mode illisible : aucun compte
 *   désigné, avec le motif (l'avis le porte comme anomalie bloquante, avis-appel.ts).
 * Comptes et IBAN fictifs (exemples publiés, clés valides).
 */

const IBAN_COURANT = 'FR14 2004 1010 0505 0001 3M02 606'
const IBAN_CDC = 'FR76 3000 6000 0112 3456 7890 189'
const IBAN_SOUS_COMPTE = 'DE89 3704 0044 0532 0130 00'
const IBAN_AUTRE = 'FR76 3000 4000 0312 3456 7890 143'
const compact = (iban: string) => iban.replaceAll(' ', '')

const mode = (m: ModeTenueComptes, origine: 'cabinet' | 'mandat' = 'cabinet'): ModeComptesLu => ({ resolu: { mode: m, origine }, erreur: null })

const courant: CompteCandidatEncaissement = { id: 'b-courant', nature: 'courant', iban: IBAN_COURANT, actif: true }
const cdc: CompteCandidatEncaissement = { id: 'b-cdc', nature: 'caisse_depots', iban: IBAN_CDC, actif: true }
const sousCompte: CompteCandidatEncaissement = { id: 'b-sc', nature: 'sous_compte_centralisateur', iban: IBAN_SOUS_COMPTE }
const fonds: CompteCandidatEncaissement = { id: 'b-ft', nature: 'fonds_travaux', iban: IBAN_AUTRE, actif: true }
const tous = [fonds, cdc, sousCompte, courant]

const motifDe = (resultat: ReturnType<typeof compteEncaissement>): string => {
  if (resultat.designe) throw new Error(`compte désigné : ${resultat.banqueId}`)
  return resultat.motif
}

describe('ap-03 — nature du compte qui reçoit les règlements, par mode', () => {
  it('chaque mode désigne une nature qu’il exige, jamais une nature du fonds de travaux', () => {
    expect(Object.fromEntries(Object.entries(MODES_TENUE_COMPTES).map(([cle, m]) => [cle, m.natureEncaissement]))).toEqual({
      compte_separe_syndicat: 'courant',
      caisse_depots: 'caisse_depots',
      // À valider (ap-03) : le compte en banque reçoit les règlements, la Caisse des dépôts garde le dépôt.
      banque_et_caisse_depots: 'courant',
      centralisateur_cabinet: 'sous_compte_centralisateur',
    })
    for (const m of Object.values(MODES_TENUE_COMPTES)) {
      expect((m.naturesRequises as readonly string[]).includes(m.natureEncaissement)).toBe(true)
      expect(estCompteDuFondsTravaux({ nature: m.natureEncaissement })).toBe(false)
    }
  })
})

describe('ap-03 — mode lu sans exception', () => {
  const cabinet = creerReglagesComptesCabinet({ modeParDefaut: 'caisse_depots' })

  it('choix du mandat, à défaut réglage du cabinet', () => {
    expect(lireModeComptes(cabinet, 'centralisateur_cabinet')).toEqual({ resolu: { mode: 'centralisateur_cabinet', origine: 'mandat' }, erreur: null })
    expect(lireModeComptes(cabinet, null)).toEqual({ resolu: { mode: 'caisse_depots', origine: 'cabinet' }, erreur: null })
    expect(lireModeComptes(cabinet, undefined)).toEqual({ resolu: { mode: 'caisse_depots', origine: 'cabinet' }, erreur: null })
  })

  it('choix du mandat inconnu : erreur gardée comme donnée, aucun mode par défaut', () => {
    expect(lireModeComptes(cabinet, 'livret' as ModeTenueComptes)).toEqual({ resolu: null, erreur: 'Mode de tenue inconnu : « livret ».' })
  })
})

describe('ap-03 — compte qui reçoit les règlements, selon le mode', () => {
  it('compte séparé : le compte courant, même quand la Caisse des dépôts et un sous-compte sont ouverts', () => {
    expect(compteEncaissement(mode('compte_separe_syndicat'), tous)).toEqual({
      designe: true,
      banqueId: 'b-courant',
      nature: 'courant',
      libelle: NATURES_COMPTE_BANCAIRE.courant.libelle,
      iban: compact(IBAN_COURANT),
      auNomDuSyndicat: true,
    })
  })

  it('Caisse des dépôts : le compte à la Caisse des dépôts, même quand un compte courant actif existe ; titulaire non établi comme le syndicat', () => {
    expect(compteEncaissement(mode('caisse_depots', 'mandat'), tous)).toEqual({
      designe: true,
      banqueId: 'b-cdc',
      nature: 'caisse_depots',
      libelle: NATURES_COMPTE_BANCAIRE.caisse_depots.libelle,
      iban: compact(IBAN_CDC),
      auNomDuSyndicat: false,
    })
  })

  it('compte en banque et Caisse des dépôts : le compte courant (à valider)', () => {
    expect(compteEncaissement(mode('banque_et_caisse_depots'), tous)).toMatchObject({ designe: true, banqueId: 'b-courant', auNomDuSyndicat: true })
  })

  it('centralisateur du cabinet : le sous-compte du mandat, titulaire non établi comme le syndicat', () => {
    expect(compteEncaissement(mode('centralisateur_cabinet'), tous)).toMatchObject({
      designe: true,
      banqueId: 'b-sc',
      nature: 'sous_compte_centralisateur',
      iban: compact(IBAN_SOUS_COMPTE),
      auNomDuSyndicat: false,
    })
  })

  it('IBAN rendu sans espaces, en majuscules', () => {
    const minuscules = { ...courant, iban: ' fr14 2004 1010 0505 0001 3m02 606 ' }
    expect(compteEncaissement(mode('compte_separe_syndicat'), [minuscules])).toMatchObject({ designe: true, iban: compact(IBAN_COURANT) })
  })
})

describe('ap-03 — aucun compte désigné : le motif, sans repli', () => {
  it('jamais de repli sur une autre nature : Caisse des dépôts absente, compte courant présent', () => {
    const motif = motifDe(compteEncaissement(mode('caisse_depots'), [courant, sousCompte]))
    expect(motif).toBe(
      `aucun compte actif « ${NATURES_COMPTE_BANCAIRE.caisse_depots.libelle} », compte qui reçoit les règlements dans le mode « ${MODES_TENUE_COMPTES.caisse_depots.libelle} »`,
    )
  })

  it('un compte clôturé ne compte pas ; un compte sans nature non plus', () => {
    expect(motifDe(compteEncaissement(mode('compte_separe_syndicat'), [{ ...courant, actif: false }]))).toMatch(/^aucun compte actif « Compte courant au nom du syndicat »/)
    expect(motifDe(compteEncaissement(mode('compte_separe_syndicat'), [{ id: 'b-x', iban: IBAN_COURANT }]))).toMatch(/^aucun compte actif/)
  })

  it('compte du mode sans IBAN, ou à l’IBAN invalide', () => {
    const sans = motifDe(compteEncaissement(mode('caisse_depots'), [{ ...cdc, iban: null }]))
    expect(sans).toBe(`« ${NATURES_COMPTE_BANCAIRE.caisse_depots.libelle} » sans IBAN valide`)
    expect(motifDe(compteEncaissement(mode('caisse_depots'), [{ ...cdc, iban: 'FR76 3000 6000 0112 3456 7890 188' }]))).toBe(sans)
  })

  it('plusieurs comptes actifs de la nature du mode, d’IBAN différents ou sans IBAN : ambigu', () => {
    const second = { ...courant, id: 'b-courant-2', iban: IBAN_AUTRE }
    const attendu = `2 comptes actifs « ${NATURES_COMPTE_BANCAIRE.courant.libelle} » : un seul doit recevoir les règlements`
    expect(motifDe(compteEncaissement(mode('compte_separe_syndicat'), [courant, second]))).toBe(attendu)
    expect(motifDe(compteEncaissement(mode('compte_separe_syndicat'), [courant, { ...second, iban: null }]))).toBe(attendu)
    // Le nombre compte les IBAN distincts : deux fiches d'un même IBAN sont un seul compte.
    expect(motifDe(compteEncaissement(mode('compte_separe_syndicat'), [courant, { ...courant, id: 'b-double' }, second]))).toBe(attendu)
    // Deux fiches du même compte (même IBAN) : un seul compte, la plus petite référence est retenue.
    expect(compteEncaissement(mode('compte_separe_syndicat'), [{ ...courant, id: 'b-z' }, { ...courant, id: 'b-a', iban: compact(IBAN_COURANT) }])).toMatchObject({
      designe: true,
      banqueId: 'b-a',
    })
  })

  it('IBAN du compte du mode identique à celui d’un compte qui tient le fonds de travaux, même clôturé : refusé', () => {
    const attendu = `l'IBAN du compte « ${NATURES_COMPTE_BANCAIRE.caisse_depots.libelle} » est celui d'un compte qui tient le fonds de travaux`
    const memeIban = (c: CompteCandidatEncaissement) => motifDe(compteEncaissement(mode('caisse_depots'), [cdc, { ...c, iban: IBAN_CDC }]))
    expect(memeIban(fonds)).toBe(attendu)
    expect(memeIban({ ...fonds, actif: false })).toBe(attendu)
    expect(memeIban({ id: 'b-pl', nature: 'placement', reserveAuFondsTravaux: true })).toBe(attendu)
    expect(memeIban({ id: 'b-rep', nature: 'repris_ancien_gestionnaire', tenaitFondsTravaux: true, actif: false })).toBe(attendu)
    // Un placement qui ne tient pas le fonds n'est pas en cause.
    expect(compteEncaissement(mode('caisse_depots'), [cdc, { id: 'b-pl', nature: 'placement', iban: IBAN_CDC }])).toMatchObject({ designe: true })
  })

  it('mode illisible : aucun compte, le motif cite l’erreur en milieu de phrase (minuscule initiale, sans point final)', () => {
    expect(motifDe(compteEncaissement({ resolu: null, erreur: 'Mode de tenue inconnu : « livret ».' }, tous))).toBe('mode de tenue inconnu : « livret »')
    expect(motifDe(compteEncaissement({ resolu: null, erreur: 'mandat « M404 » introuvable' }, tous))).toBe('mandat « M404 » introuvable')
    expect(enMilieuDePhrase(' Réglage illisible. ')).toBe('réglage illisible')
  })
})
