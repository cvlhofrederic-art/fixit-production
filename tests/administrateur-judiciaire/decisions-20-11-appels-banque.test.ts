import { describe, expect, it } from 'vitest'
import { creerReglagesComptesCabinet } from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import {
  PERIMETRE_FONDS_DETENUS_PAR_DEFAUT,
  RUBRIQUES_FONDS_DETENUS,
  creerPerimetreFondsDetenus,
  fondsDetenusA,
  rubriqueDuCompte,
  type CompteFondsDetenus,
  type DonneesFondsDetenus,
} from '@/lib/administrateur-judiciaire/domain/fonds-detenus'
import { creerTraitement, type Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'
import { enTeteDuModule } from './en-tete-module'

/**
 * Décisions du 20/11/2026 (partie C), thème « appels-banque » : F98, F99, F103 à F108, F110 à F112, F114, F116, F118,
 * F119, F126 et F127. Chaque bloc teste la règle décidée ; les données sont fictives.
 */

// ─── F98, F99 : fonds détenus ────────────────────────────────────────────────────────────────

const ligne = (compte: string, sens: 'debit' | 'credit', montantCentimes: number) => ({ compte, sens, montantCentimes })

const entree = (id: string, date: string, compte: string, montant: number): Traitement =>
  creerTraitement({ id, famille: 'Encaissement', date, mouvements: [ligne(compte, 'debit', montant), ligne('PLAC.45000.00001.0', 'credit', montant)] })

const sortie = (id: string, date: string, compte: string, montant: number): Traitement =>
  creerTraitement({ id, famille: 'Règlement de factures', date, mouvements: [ligne('PLAC.40100.FOURN.0', 'debit', montant), ligne(compte, 'credit', montant)] })

const PLAC_COURANT = 'PLAC.51200.00000.0'
const PLAC_TERME = 'PLAC.50100.00000.0'
const PLAC_AUTRE = 'PLAC.50200.00000.0'

const compte = (surcharge: Partial<CompteFondsDetenus> & Pick<CompteFondsDetenus, 'banqueId' | 'compte512'>): CompteFondsDetenus => ({
  nature: 'courant',
  iban: null,
  etablissement: 'Banque Exemple',
  ...surcharge,
})

const donneesPlacement = (comptes: CompteFondsDetenus[], traitements: Traitement[]): DonneesFondsDetenus => ({
  reglagesComptes: creerReglagesComptesCabinet({}),
  mandats: [{ mandatId: 'm-plac', coproprieteId: 'copro-plac', segmentSyndicat: 'PLAC', fondement: 'Syndic judiciaire (art. 46)', comptes }],
  comptabilites: [{ coproprieteId: 'copro-plac', traitements }],
})

const comptesPlacement = [
  compte({ banqueId: 'b-courant', compte512: PLAC_COURANT, iban: 'FR76 3000 6000 0112 3456 7890 189' }),
  compte({ banqueId: 'b-terme', compte512: PLAC_TERME, nature: 'placement' }),
  compte({ banqueId: 'b-autre', compte512: PLAC_AUTRE, nature: 'placement' }),
]
const traitementsPlacement = [
  entree('e-1', '2026-03-01', PLAC_COURANT, 500_000),
  entree('e-2', '2026-03-02', PLAC_TERME, 200_000),
  entree('e-3', '2026-03-03', PLAC_AUTRE, 50_000),
]

describe('F98 — comptes de placement de classe 50 : comptés à part, « fonds placés », inclus par défaut', () => {
  it('une rubrique « fonds placés » à part, incluse par défaut', () => {
    expect(RUBRIQUES_FONDS_DETENUS.fonds_places.libelle).toMatch(/^Fonds placés/)
    expect(RUBRIQUES_FONDS_DETENUS.fonds_places.libelle).toMatch(/501 « Compte à terme ».*502 « Autre compte »/)
    expect(PERIMETRE_FONDS_DETENUS_PAR_DEFAUT.fonds_places).toBe(true)
    expect(rubriqueDuCompte({ nature: 'placement', compte512: PLAC_TERME })).toBe('fonds_places')
    expect(rubriqueDuCompte({ nature: 'placement', compte512: 'PLAC.51203.00000.0' })).toBe('autres_comptes')
  })

  it('les soldes des 501 et 502 entrent dans le total, sur la ligne « fonds placés »', () => {
    const fonds = fondsDetenusA('2026-12-31', donneesPlacement(comptesPlacement, traitementsPlacement))
    expect(fonds.totalCentimes).toBe(750_000)
    expect(fonds.comptes.map((l) => [l.banqueId, l.rubrique, l.soldeCentimes])).toEqual([
      ['b-courant', 'au_nom_du_syndicat', 500_000],
      ['b-terme', 'fonds_places', 200_000],
      ['b-autre', 'fonds_places', 50_000],
    ])
    expect(fonds.parRubrique.find((r) => r.cle === 'fonds_places')).toMatchObject({ inclus: true, fondsDetenusCentimes: 250_000, nombreComptes: 2 })
    expect(fonds.perimetreParDefaut).toBe(true)
  })

  it('le cabinet peut exclure les fonds placés : ils passent hors périmètre, toujours listés', () => {
    const perimetre = creerPerimetreFondsDetenus({ fonds_places: false })
    const fonds = fondsDetenusA('2026-12-31', donneesPlacement(comptesPlacement, traitementsPlacement), { perimetre })
    expect(fonds.totalCentimes).toBe(500_000)
    expect(fonds.horsPerimetreCentimes).toBe(250_000)
    expect(fonds.perimetreParDefaut).toBe(false)
    expect(fonds.comptes.filter((l) => !l.inclus).map((l) => l.banqueId)).toEqual(['b-terme', 'b-autre'])
  })

  it('un compte de classe 50 est un placement, du même syndicat ; un autre code de classe 5 reste refusé', () => {
    const lire = (c: CompteFondsDetenus) => () => fondsDetenusA('2026-12-31', donneesPlacement([c], []))
    expect(lire(compte({ banqueId: 'b-x', compte512: PLAC_TERME, nature: 'courant' }))).toThrow(/classe 50.*placement/)
    expect(lire(compte({ banqueId: 'b-x', compte512: 'AUTR.50100.00000.0', nature: 'placement' }))).toThrow(/autre syndicat/)
    expect(lire(compte({ banqueId: 'b-x', compte512: 'PLAC.53000.00000.0', nature: 'placement' }))).toThrow(/50/)
  })

  it('en-tête : la décision F98 remplace la marque 🔴 ; le fondement R. 814-30 est cité', () => {
    const { texte, item } = enTeteDuModule('fonds-detenus')
    expect(texte.slice(texte.indexOf('🔴 Non établi'))).not.toMatch(/classe 50 : non lus/)
    expect(item('- Décision du 20/11/2026 (partie C, F98)')).toMatch(/fonds placés.*inclus par défaut.*R\. 814-30/)
  })
})

describe('F99 — total sur les seuls soldes positifs, découverts à part et signalés (aucun changement de calcul)', () => {
  it('un découvert ne vient pas en déduction : il est totalisé à part et signalé', () => {
    const fonds = fondsDetenusA(
      '2026-12-31',
      donneesPlacement(comptesPlacement, [...traitementsPlacement, sortie('s-1', '2026-04-01', PLAC_AUTRE, 80_000)]),
    )
    expect(fonds.totalCentimes).toBe(700_000)
    expect(fonds.soldesNegatifsCentimes).toBe(-30_000)
    expect(fonds.anomalies.map((a) => a.code)).toContain('couverture_non_verifiable')
  })

  it('en-tête : la décision F99 remplace la marque « à confirmer »', () => {
    const { texte, item } = enTeteDuModule('fonds-detenus')
    expect(texte.slice(texte.indexOf('🔴 Non établi'))).not.toMatch(/totaux sur les seuls soldes positifs/)
    expect(item('- Décision du 20/11/2026 (partie C, F99)')).toMatch(/soldes positifs.*découverts.*à part.*R\. 814-37/)
  })
})
