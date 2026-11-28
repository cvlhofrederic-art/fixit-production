import { describe, expect, it } from 'vitest'
import {
  CYCLES_PIECE,
  annulerPiece,
  changerStatutPiece,
  creerPieceTraitement,
  cycleDeFamille,
  dateEffetPiece,
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

describe('journal des traitements — statut « Annulé » (point 25, tranche 43 § 6)', () => {
  const ANNULATION = { id: 't-1-ann', date: '2026-10-28', numero: 120_240, segmentSyndicat: 'TILL' }

  it('une pièce enregistrée s’annule par une écriture contraire, journalisée comme une pièce', () => {
    const p = piece()
    const { piece: annulee, annulation } = annulerPiece(p, ANNULATION)
    expect(annulee).toMatchObject({ numero: 120_239, statut: 'Annulé', annuleePar: 't-1-ann' })
    expect(p.statut).toBe('Enregistré')
    expect(p.annuleePar).toBeUndefined()
    expect(annulation).toMatchObject({
      id: 't-1-ann',
      numero: 120_240,
      famille: "Annulation d'encaissement",
      date: '2026-10-28',
      coproprieteId: 'copro-tilleuls',
      mandatId: 'mandat-2026',
      statut: 'Enregistré',
      parametres: [],
    })
    expect(annulation.traitement.annule).toBe('t-1')
    expect(annulation.traitement.mouvements.map((m) => m.sens)).toEqual(['credit', 'debit'])
    expect(annulerPiece(p, { ...ANNULATION, mandatId: 'mandat-2027' }).annulation.mandatId).toBe('mandat-2027')
  })

  it('« Annulé » est définitif et ne s’atteint pas par un changement de statut', () => {
    const { piece: annulee } = annulerPiece(piece(), ANNULATION)
    expect(() => changerStatutPiece(piece(), 'Annulé')).toThrow(/annulerPiece/)
    expect(() => changerStatutPiece(annulee, 'Enregistré')).toThrow(/annulée/i)
    expect(() => changerStatutPiece(annulee, 'Imputé')).toThrow(/annulée/i)
    expect(() => annulerPiece(annulee, { ...ANNULATION, numero: 120_241 })).toThrow(/déjà annulée/i)
  })

  it('refuse une pièce imputée, une pièce de document, un numéro déjà pris, une famille sans annulation', () => {
    expect(() => annulerPiece(changerStatutPiece(piece(), 'Imputé'), ANNULATION)).toThrow(/imputée ne s'annule plus/i)
    const appel = piece({
      traitement: creerTraitement(
        saisie({
          famille: 'Appel de fonds',
          mouvements: [
            { compte: 'TILL.45000.00012.0', sens: 'debit', montantCentimes: 100 },
            { compte: 'TILL.70100.00000.0', sens: 'credit', montantCentimes: 100 },
          ],
        }),
      ),
    })
    expect(() => annulerPiece(appel, ANNULATION)).toThrow(/Produit/)
    expect(() => annulerPiece(piece(), { ...ANNULATION, numero: 120_239 })).toThrow(/numéro/i)
    expect(() => annulerPiece(piece({ traitement: creerTraitement(saisie({ famille: 'Saisie de factures' })) }), ANNULATION)).toThrow(
      /Aucune annulation observée/,
    )
  })

  it('l’annulation a son propre identifiant : ni vide, ni celui de la pièce annulée (elle renverrait à elle-même)', () => {
    expect(() => annulerPiece(piece(), { ...ANNULATION, id: 't-1' })).toThrow(/propre identifiant.*t-1/)
    expect(() => annulerPiece(piece(), { ...ANNULATION, id: '' })).toThrow(/identifiant du traitement d'annulation attendu/)
    expect(() => annulerPiece(piece(), { ...ANNULATION, id: '   ' })).toThrow(/identifiant du traitement d'annulation attendu/)
  })

  it('l’écriture contraire ne précède pas l’écriture qu’elle annule : date antérieure à la pièce refusée, même jour admis', () => {
    expect(() => annulerPiece(piece(), { ...ANNULATION, date: '2026-10-26' })).toThrow(/26\/10\/2026.*antérieure.*27\/10\/2026/)
    expect(() => annulerPiece(piece(), { ...ANNULATION, date: '26/10/2026' })).toThrow(/invalide/)
    expect(annulerPiece(piece(), { ...ANNULATION, date: '2026-10-27' }).annulation.date).toBe('2026-10-27')
  })

  it('date d’effet : la date de la pièce, sauf pour une répartition (datée de la clôture, effet en ligne 3 des paramètres)', () => {
    const ligne = (date: string | null, alpha: string | null = null, entier: number | null = null) => ({ date, alpha, entier, reel: null })
    const repartition = (parametres = [ligne('2025-01-01', 'TILL'), ligne('2025-12-31', 'Répartition des dépenses'), ligne('2026-02-01', null, 1), ligne('2026-02-16', null, 15)]) =>
      piece({
        traitement: creerTraitement(
          saisie({
            id: 'rep-1',
            famille: 'Répartition de charges',
            date: '2025-12-31',
            mouvements: [
              { compte: 'TILL.45000.00012.0', sens: 'debit', montantCentimes: 500 },
              { compte: 'TILL.47100.00000.0', sens: 'credit', montantCentimes: 500 },
            ],
          }),
        ),
        parametres,
      })
    expect(dateEffetPiece(piece())).toBe('2026-10-27')
    expect(dateEffetPiece(repartition())).toBe('2026-02-01')
    expect(() => dateEffetPiece(repartition([]))).toThrow(/sans date d'effet.*ligne 3/)
    const { annulation } = annulerPiece(repartition(), { ...ANNULATION, date: '2025-12-31', dateEffet: '2026-02-01' })
    expect(annulation).toMatchObject({ date: '2025-12-31', parametres: [ligne('2026-02-01')] })
    expect(dateEffetPiece(annulation)).toBe('2026-02-01')
    expect(() => annulerPiece(repartition(), { ...ANNULATION, date: '2026-02-01', dateEffet: '2026-02-01' })).toThrow(/postérieure.*clôture/)
    expect(() => annulerPiece(repartition(), { ...ANNULATION, date: '2025-12-31' })).toThrow(/date d'effet attendue/)
    expect(() => annulerPiece(repartition(), { ...ANNULATION, date: '2025-12-31', dateEffet: '2026-01-15' })).toThrow(/15\/01\/2026.*antérieure.*01\/02\/2026/)
    expect(() => annulerPiece(piece(), { ...ANNULATION, dateEffet: '2026-10-29' })).toThrow(/pas de date d'effet distincte/)
  })
})
