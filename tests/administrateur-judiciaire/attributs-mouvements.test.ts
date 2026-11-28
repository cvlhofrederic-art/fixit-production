import { describe, expect, it } from 'vitest'
import { controlerVentilation, ecritureFactureVentilee, type LigneFacture } from '@/lib/administrateur-judiciaire/domain/facture-ventilee'
import {
  annulerTraitement,
  creerTraitement,
  mouvementsARepartir,
  type LigneMouvement,
} from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * Attributs et liens des lignes de mouvement (point 26 du bilan 2 ; Gestéam, tranche 37 § Mouvements : onglets Montants —
 * Récup. locataire %, Non récupérable, Non déductible, Hono. base, Clé, Analytique —, Liens — Fournisseur, Client, Travaux,
 * Contrat, Sinistre, Lot —, Totaux — Répartition « À répartir » ; tranche 43 § 7 : liens polymorphes).
 */

const ligne = (surcharge: Partial<LigneFacture> = {}): LigneFacture => ({
  comptePlan: '61500',
  analytique: '460',
  cleRepartition: '001',
  rubrique: 'R12',
  codeFiscal: 'F3',
  montantTtcCentimes: 30_000,
  recupLocatairePct: 0,
  lotId: null,
  rattachement: null,
  ...surcharge,
})

describe('attributs et liens d’une ligne de mouvement', () => {
  it('se conservent dans le traitement', () => {
    const mouvements: LigneMouvement[] = [
      {
        compte: 'TILL.61500.00000.0',
        sens: 'debit',
        montantCentimes: 1_000,
        attributs: { cle: '001', analytique: '460', recupLocatairePct: 50, nonDeductible: false, baseHonorairesCentimes: 1_000, etatRepartition: 'a_repartir' },
        liens: { fournisseurId: 'f-1', contratId: 'ctr-9' },
      },
      { compte: 'TILL.40100.PLOMB.0', sens: 'credit', montantCentimes: 1_000, liens: { fournisseurId: 'f-1' } },
    ]
    const t = creerTraitement({ id: 't-1', famille: 'Saisie de factures', date: '2026-10-15', mouvements })
    expect(t.mouvements[0]).toMatchObject({ attributs: { cle: '001', recupLocatairePct: 50, etatRepartition: 'a_repartir' }, liens: { contratId: 'ctr-9' } })
  })

  it('refuse une part récupérable ou un taux hors de 0 à 100, une base d’honoraires invalide, une marque ou un état inconnus', () => {
    const avec = (attributs: LigneMouvement['attributs']) => () =>
      creerTraitement({
        id: 't',
        famille: 'Saisie de factures',
        date: '2026-10-15',
        mouvements: [
          { compte: 'A', sens: 'debit', montantCentimes: 1, attributs },
          { compte: 'B', sens: 'credit', montantCentimes: 1 },
        ],
      })
    expect(avec({ recupLocatairePct: 101 })).toThrow(/récupérable/i)
    expect(avec({ recupLocatairePct: -1 })).toThrow(/récupérable/i)
    expect(avec({ recupLocatairePct: Number.NaN })).toThrow(/récupérable/i)
    // @ts-expect-error — texte au lieu d'un nombre
    expect(avec({ recupLocatairePct: '50' })).toThrow(/récupérable/i)
    expect(avec({ baseHonorairesCentimes: -1 })).toThrow(/honoraires/i)
    expect(avec({ baseHonorairesCentimes: 1.5 })).toThrow(/honoraires/i)
    expect(avec({ tauxHonorairesPct: 101 })).toThrow(/taux/i)
    // @ts-expect-error — marque non booléenne
    expect(avec({ nonDeductible: 'oui' })).toThrow(/déductible/i)
    // @ts-expect-error — état inconnu
    expect(avec({ etatRepartition: 'en_cours' })).toThrow(/répartition/i)
    expect(avec({ recupLocatairePct: 0, tauxHonorairesPct: 100, baseHonorairesCentimes: 0 })).not.toThrow()
  })

  it('l’annulation garde les attributs et les liens de chaque ligne', () => {
    const t = creerTraitement({
      id: 't-1',
      famille: 'Règlement de factures',
      date: '2026-10-15',
      mouvements: [
        { compte: 'TILL.40100.PLOMB.0', sens: 'debit', montantCentimes: 500, liens: { fournisseurId: 'f-1' } },
        { compte: 'TILL.51200.00000.0', sens: 'credit', montantCentimes: 500, attributs: { analytique: null } },
      ],
    })
    const annulation = annulerTraitement(t, { id: 't-1-a', date: '2026-10-16' })
    expect(annulation.mouvements[0]).toMatchObject({ sens: 'credit', liens: { fournisseurId: 'f-1' } })
    expect(annulation.mouvements[1]).toMatchObject({ sens: 'debit', attributs: { analytique: null } })
    expect(annulation.mouvements[1].attributs).not.toHaveProperty('etatRepartition')
  })

  it('l’annulation d’une charge déjà répartie est « à répartir » : elle entre dans la répartition de sa période', () => {
    const reglement = creerTraitement({
      id: 't-2',
      famille: 'Règlement de factures',
      date: '2025-12-15',
      mouvements: [
        { compte: 'TILL.61500.00000.0', sens: 'debit', montantCentimes: 1_000, attributs: { cle: '001', etatRepartition: 'reparti' } },
        { compte: 'TILL.51200.00000.0', sens: 'credit', montantCentimes: 1_000 },
      ],
    })
    const annulation = annulerTraitement(reglement, { id: 't-2-a', date: '2026-02-01' })
    expect(annulation.mouvements[0].attributs).toEqual({ cle: '001', etatRepartition: 'a_repartir' })
    expect(reglement.mouvements[0].attributs?.etatRepartition).toBe('reparti')
    expect(mouvementsARepartir([reglement, annulation], { du: '2026-01-01', au: '2026-12-31' }).map((m) => [m.traitementId, m.sens, m.montantCentimes])).toEqual([
      ['t-2-a', 'credit', 1_000],
    ])
  })
})

describe('écriture de la facture ventilée', () => {
  it('chaque ligne de charge porte clé, analytique, rubrique, code fiscal, part récupérable, honoraires, « à répartir » et ses liens', () => {
    const t = ecritureFactureVentilee({
      id: 't-1',
      date: '2026-10-15',
      segmentSyndicat: 'TILL',
      auxiliaireFournisseur: 'PLOMB',
      fournisseurId: 'f-1',
      totalTtcCentimes: 120_000,
      lignes: [
        ligne({ recupLocatairePct: 40, lotId: 'lot-3', baseHonorairesCentimes: 30_000, tauxHonorairesPct: 2.5 }),
        ligne({ comptePlan: '67100', montantTtcCentimes: 52_000, rattachement: { type: 'travaux', id: '00042' } }),
        ligne({ comptePlan: '62300', montantTtcCentimes: 18_000, rattachement: { type: 'sinistre', id: 'S-7' } }),
        ligne({ comptePlan: '62200', montantTtcCentimes: 20_000, rattachement: { type: 'contentieux', id: 'C-3' } }),
      ],
    })
    expect(t.mouvements.map((m) => [m.compte, m.sens, m.montantCentimes])).toEqual([
      ['TILL.61500.00000.0', 'debit', 30_000],
      ['TILL.67100.00042.0', 'debit', 52_000],
      ['TILL.62300.00000.0', 'debit', 18_000],
      ['TILL.62200.00000.0', 'debit', 20_000],
      ['TILL.40100.PLOMB.0', 'credit', 120_000],
    ])
    expect(t.mouvements[0]).toMatchObject({
      attributs: {
        cle: '001',
        analytique: '460',
        rubrique: 'R12',
        codeFiscal: 'F3',
        recupLocatairePct: 40,
        baseHonorairesCentimes: 30_000,
        tauxHonorairesPct: 2.5,
        etatRepartition: 'a_repartir',
      },
      liens: { lotId: 'lot-3', fournisseurId: 'f-1' },
    })
    expect(t.mouvements.slice(0, 4).map((m) => [m.attributs?.etatRepartition, m.attributs?.baseHonorairesCentimes, m.attributs?.tauxHonorairesPct])).toEqual([
      ['a_repartir', 30_000, 2.5],
      ['a_repartir', null, null],
      ['a_repartir', null, null],
      ['a_repartir', null, null],
    ])
    expect(t.mouvements[1].liens).toEqual({ fournisseurId: 'f-1', travauxId: '00042' })
    expect(t.mouvements[2].liens).toEqual({ fournisseurId: 'f-1', sinistreId: 'S-7' })
    expect(t.mouvements[3].liens).toEqual({ fournisseurId: 'f-1', contentieuxId: 'C-3' })
    expect(t.mouvements[4]).toMatchObject({ liens: { fournisseurId: 'f-1' } })
    expect(t.mouvements[4].attributs).toBeUndefined()
  })

  it('sans fournisseur, une ligne sans lot ni rattachement n’a pas de liens', () => {
    const t = ecritureFactureVentilee({ id: 't-1', date: '2026-10-15', segmentSyndicat: 'TILL', auxiliaireFournisseur: 'PLOMB', totalTtcCentimes: 30_000, lignes: [ligne()] })
    expect(t.mouvements.every((m) => !('liens' in m))).toBe(true)
  })

  it('le contrôle de la ventilation signale une base ou un taux d’honoraires invalides, et une part récupérable NaN, avant l’écriture', () => {
    const codes = (l: LigneFacture) => controlerVentilation(30_000, [l]).map((a) => a.code)
    expect(codes(ligne({ baseHonorairesCentimes: -1 }))).toEqual(['honoraires_invalide'])
    expect(codes(ligne({ baseHonorairesCentimes: 12.5 }))).toEqual(['honoraires_invalide'])
    expect(codes(ligne({ tauxHonorairesPct: 500 }))).toEqual(['honoraires_invalide'])
    expect(codes(ligne({ recupLocatairePct: Number.NaN }))).toEqual(['recuperable_invalide'])
    expect(codes(ligne({ baseHonorairesCentimes: 0, tauxHonorairesPct: 0 }))).toEqual([])
    expect(() =>
      ecritureFactureVentilee({ id: 't', date: '2026-10-15', segmentSyndicat: 'TILL', auxiliaireFournisseur: 'PLOMB', totalTtcCentimes: 30_000, lignes: [ligne({ baseHonorairesCentimes: -1 })] }),
    ).toThrow(/ventilation à corriger/)
  })
})

describe('mouvements à répartir', () => {
  it('les charges d’une période — marquées « à répartir » ou de classe 6 sans état — ; une charge répartie ou hors période n’y est pas', () => {
    const facture = ecritureFactureVentilee({
      id: 't-1',
      date: '2026-10-15',
      segmentSyndicat: 'TILL',
      auxiliaireFournisseur: 'PLOMB',
      fournisseurId: 'f-1',
      totalTtcCentimes: 30_000,
      lignes: [ligne()],
    })
    const ancienne = creerTraitement({
      id: 't-0',
      famille: 'Saisie de factures',
      date: '2025-12-31',
      mouvements: [
        { compte: 'TILL.61500.00000.0', sens: 'debit', montantCentimes: 700, attributs: { etatRepartition: 'a_repartir' } },
        { compte: 'TILL.40100.PLOMB.0', sens: 'credit', montantCentimes: 700 },
      ],
    })
    const repartie = creerTraitement({
      id: 't-2',
      famille: 'Saisie de factures',
      date: '2026-11-02',
      mouvements: [
        { compte: 'TILL.61500.00000.0', sens: 'debit', montantCentimes: 900, attributs: { etatRepartition: 'reparti' } },
        { compte: 'TILL.40100.PLOMB.0', sens: 'credit', montantCentimes: 900 },
      ],
    })
    // Facture en imputation unique (ecritureFacture) : charge de classe 6 sans attributs.
    const imputationUnique = creerTraitement({
      id: 't-3',
      famille: 'Saisie de factures',
      date: '2026-06-30',
      mouvements: [
        { compte: '____.62700.00000.0', sens: 'debit', montantCentimes: 1_200 },
        { compte: '____.40100.FOURN.0', sens: 'credit', montantCentimes: 1_200 },
      ],
    })
    const resultat = mouvementsARepartir([facture, ancienne, repartie, imputationUnique], { du: '2026-01-01', au: '2026-12-31' })
    expect(resultat.map((m) => [m.traitementId, m.compte, m.montantCentimes])).toEqual([
      ['t-1', 'TILL.61500.00000.0', 30_000],
      ['t-3', '____.62700.00000.0', 1_200],
    ])
    expect(() => mouvementsARepartir([], { du: '2026-12-31', au: '2026-01-01' })).toThrow(/période/i)
  })
})
