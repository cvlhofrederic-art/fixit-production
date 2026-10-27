import { describe, expect, it } from 'vitest'
import {
  CYCLES_PIECE,
  changerStatutPiece,
  creerPieceTraitement,
  cycleDeFamille,
  numeroPieceSuivant,
  segmentComptableSyndicat,
  type PieceTraitement,
} from '@/lib/administrateur-judiciaire/domain/journal-traitements'
import { creerTraitement, type SaisieTraitement } from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * Décision D1 (Hugo Carvalho, 27/10/2026) — trois entités : Immeuble (bâtiment), Copropriété = syndicat, Mandat
 * judiciaire. Les COMPTES appartiennent au SYNDICAT : ils survivent au changement de mandataire ; chaque opération
 * garde le mandat qui l'a faite (reddition des comptes).
 *
 * Journal des traitements (Gestéam, tranche 29) : chaque opération de masse est une PIÈCE numérotée (séquence du
 * cabinet), rattachée à un syndicat et à un mandat, avec son nombre de lignes et un statut à cycle :
 * comptable (Enregistré → Imputé) ou document (Produit → Émis).
 */

const saisie = (surcharge: Partial<SaisieTraitement> = {}): SaisieTraitement => ({
  id: 't-1',
  famille: 'Encaissement',
  date: '2026-10-27',
  mouvements: [
    { compte: 'TILL.51200.00000.0', sens: 'debit', montantCentimes: 12_000 },
    { compte: 'TILL.45000.00012.0', sens: 'credit', montantCentimes: 12_000 },
  ],
  ...surcharge,
})

const piece = (surcharge: Partial<Parameters<typeof creerPieceTraitement>[0]> = {}): PieceTraitement =>
  creerPieceTraitement({
    traitement: creerTraitement(saisie()),
    numero: 120_239,
    coproprieteId: 'copro-tilleuls',
    segmentSyndicat: 'TILL',
    mandatId: 'mandat-2026',
    parametres: [],
    ...surcharge,
  })

describe('D1 — segment comptable du syndicat', () => {
  it('normalise le code du syndicat sur 4 caractères majuscules, complété par des 0', () => {
    expect(segmentComptableSyndicat('till')).toBe('TILL')
    expect(segmentComptableSyndicat('VM')).toBe('VM00')
    expect(segmentComptableSyndicat('É-1')).toBe('E100')
  })

  it('refuse un code vide ou trop long', () => {
    expect(() => segmentComptableSyndicat('  ')).toThrow(/code/i)
    expect(() => segmentComptableSyndicat('TILLEULS')).toThrow(/4 caract/i)
  })
})

describe('journal des traitements — pièces', () => {
  it('cycle par famille : documents (appel de fonds, règlement de factures) → Produit ; le reste → Enregistré', () => {
    expect(cycleDeFamille('Appel de fonds')).toBe('document')
    expect(cycleDeFamille('Règlement de factures')).toBe('document')
    expect(cycleDeFamille('Encaissement')).toBe('comptable')
    expect(CYCLES_PIECE.comptable).toEqual(['Enregistré', 'Imputé'])
    expect(CYCLES_PIECE.document).toEqual(['Produit', 'Émis'])
  })

  it('crée une pièce : numéro, syndicat, mandat, nombre de lignes, statut initial du cycle', () => {
    expect(piece()).toMatchObject({
      numero: 120_239,
      famille: 'Encaissement',
      date: '2026-10-27',
      coproprieteId: 'copro-tilleuls',
      mandatId: 'mandat-2026',
      nbLignes: 2,
      statut: 'Enregistré',
    })
  })

  it('D1 : refuse un mouvement sur le compte d’un autre syndicat', () => {
    const traitement = creerTraitement(
      saisie({
        mouvements: [
          { compte: 'TILL.51200.00000.0', sens: 'debit', montantCentimes: 500 },
          { compte: 'VM00.45000.00003.0', sens: 'credit', montantCentimes: 500 },
        ],
      }),
    )
    expect(() => piece({ traitement })).toThrow(/syndicat/i)
  })

  it('accepte les comptes encore sans segment (« ____ »), en attente de numérotation', () => {
    const traitement = creerTraitement(
      saisie({
        mouvements: [
          { compte: '____.51200.00000.0', sens: 'debit', montantCentimes: 500 },
          { compte: 'TILL.45000.00012.0', sens: 'credit', montantCentimes: 500 },
        ],
      }),
    )
    expect(piece({ traitement }).nbLignes).toBe(2)
  })

  it('refuse une pièce sans syndicat ou sans mandat, ou un numéro invalide', () => {
    expect(() => piece({ coproprieteId: '' })).toThrow(/syndicat/i)
    expect(() => piece({ mandatId: ' ' })).toThrow(/mandat/i)
    expect(() => piece({ numero: 0 })).toThrow(/num[ée]ro/i)
  })

  it('garde jusqu’à quatre paramètres typés (date, texte, entier, réel), comme la fiche Gestéam', () => {
    const p = piece({ parametres: [{ date: '2026-10-01', alpha: 'T4', entier: 4, reel: null }] })
    expect(p.parametres).toHaveLength(1)
    expect(() => piece({ parametres: Array(5).fill({ date: null, alpha: null, entier: null, reel: null }) })).toThrow(/quatre/i)
    expect(() => piece({ parametres: [{ date: '01/10/2026', alpha: null, entier: null, reel: null }] })).toThrow(/date/i)
  })
})

describe('journal des traitements — numérotation et statuts', () => {
  it('numéro suivant = plus grand numéro du cabinet + 1 ; 1 pour un journal vide', () => {
    expect(numeroPieceSuivant([])).toBe(1)
    expect(numeroPieceSuivant([piece({ numero: 12 }), piece({ numero: 120_238 }), piece({ numero: 7 })])).toBe(120_239)
  })

  it('le statut avance d’une étape dans son cycle, jamais en arrière ni hors cycle', () => {
    const p = piece()
    expect(changerStatutPiece(p, 'Imputé').statut).toBe('Imputé')
    expect(p.statut).toBe('Enregistré')
    expect(() => changerStatutPiece(changerStatutPiece(p, 'Imputé'), 'Enregistré')).toThrow(/statut/i)
    expect(() => changerStatutPiece(p, 'Émis')).toThrow(/cycle/i)
  })

  it('une pièce de document passe de Produit à Émis', () => {
    const appel = piece({
      traitement: creerTraitement(
        saisie({
          famille: 'Appel de fonds',
          mouvements: [
            { compte: 'TILL.45000.00012.0', sens: 'debit', montantCentimes: 80_000 },
            { compte: 'TILL.70100.00000.0', sens: 'credit', montantCentimes: 80_000 },
          ],
        }),
      ),
    })
    expect(appel.statut).toBe('Produit')
    expect(changerStatutPiece(appel, 'Émis').statut).toBe('Émis')
  })
})
