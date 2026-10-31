import { describe, expect, it } from 'vitest'
import { creerCompteCoproprietaire, creerPosition } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import { imputerEncaissement, postesDepuisAvis } from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import { avisDAppel, creerCleRepartition, type EcheanceAppel } from '@/lib/administrateur-judiciaire/domain/repartition-appels'

/**
 * Postes de terme tirés de l'avis d'appel (point 15 du bilan 2 ; Gestéam, tranches 30 et 43 § 8 : l'avis se décompose en
 * postes — clé, lot, base, taux, total, réglé, solde, Ctx). Relie repartition-appels.avisDAppel à l'imputation des
 * encaissements ; refuse, comme l'écriture de l'appel, un avis qui porte des anomalies.
 */

const cle = creerCleRepartition({
  id: 'cle-001',
  coproprieteId: 'copro-1',
  code: '001',
  libelle: 'Charges communes générales',
  lots: [
    { lotId: 'lot-1', tantiemes: 400 },
    { lotId: 'lot-2', tantiemes: 600 },
  ],
})
const comptes = [
  creerCompteCoproprietaire({ id: 'cpt-A', coproprieteId: 'copro-1', serie: '1', libelle: 'A' }),
  creerCompteCoproprietaire({ id: 'cpt-B', coproprieteId: 'copro-1', serie: '2', libelle: 'B' }),
]
const position = (id: string, lotId: string, compteId: string) =>
  creerPosition({ id, identiteId: `i-${id}`, lotId, compteId, qualite: 'Copropriétaire', part: { numerateur: 1, denominateur: 1 }, statut: 'En place', dateEntree: '2020-01-01', dateSortie: null })
const positions = [position('p1', 'lot-1', 'cpt-A'), position('p2', 'lot-2', 'cpt-B')]
const echeances: EcheanceAppel[] = [
  { id: 'B-2026-001-1', coproprieteId: 'copro-1', cleId: 'cle-001', exigibilite: '2026-01-01', libelle: 'Budget 2026 — provision 1/4', montantCentimes: 100_000, nature: 'budget' },
  { id: 'FT-2026-1', coproprieteId: 'copro-1', cleId: 'cle-001', exigibilite: '2026-01-01', libelle: 'Fonds de travaux 2026 — appel n° 1', montantCentimes: 5_000, nature: 'fonds_travaux' },
  { id: '00042-T1', coproprieteId: 'copro-1', cleId: 'cle-001', exigibilite: '2026-05-01', libelle: 'Ravalement — appel n° 1', montantCentimes: 30_000, nature: 'travaux' },
]
const avis = avisDAppel({ echeances, cles: [cle], positions, comptes })

describe('postes de terme depuis l’avis d’appel', () => {
  it('un poste par compte, échéance et lot, avec son type d’appel, sa clé, son lot, sa base et ses tantièmes', () => {
    const postes = postesDepuisAvis(avis, [cle])
    expect(postes.filter((p) => p.compteId === 'cpt-A')).toEqual([
      { id: 'B-2026-001-1:lot-1', compteId: 'cpt-A', appelId: 'B-2026-001-1', typeAppel: 'Budget', libelle: 'Budget 2026 — provision 1/4', exigibilite: '2026-01-01', montantCentimes: 40_000, regleCentimes: 0, contentieux: false, lotId: 'lot-1', cle: '001', baseCentimes: 100_000, tantiemes: { lot: 400, total: 1000 } },
      { id: 'FT-2026-1:lot-1', compteId: 'cpt-A', appelId: 'FT-2026-1', typeAppel: 'Fonds travaux', libelle: 'Fonds de travaux 2026 — appel n° 1', exigibilite: '2026-01-01', montantCentimes: 2_000, regleCentimes: 0, contentieux: false, lotId: 'lot-1', cle: '001', baseCentimes: 5_000, tantiemes: { lot: 400, total: 1000 } },
      { id: '00042-T1:lot-1', compteId: 'cpt-A', appelId: '00042-T1', typeAppel: 'Travaux', libelle: 'Ravalement — appel n° 1', exigibilite: '2026-05-01', montantCentimes: 12_000, regleCentimes: 0, contentieux: false, lotId: 'lot-1', cle: '001', baseCentimes: 30_000, tantiemes: { lot: 400, total: 1000 } },
    ])
    expect(postes.reduce((s, p) => s + p.montantCentimes, 0)).toBe(135_000)
    expect(postesDepuisAvis(avis)[0].tantiemes).toBeNull()
  })

  it('un compte qui détient deux lots : deux postes distincts par échéance', () => {
    const deuxLots = avisDAppel({ echeances: [echeances[0]], cles: [cle], positions: [position('p1', 'lot-1', 'cpt-A'), position('p3', 'lot-2', 'cpt-A')], comptes })
    expect(postesDepuisAvis(deuxLots).map((p) => [p.id, p.compteId, p.lotId, p.montantCentimes])).toEqual([
      ['B-2026-001-1:lot-1', 'cpt-A', 'lot-1', 40_000],
      ['B-2026-001-1:lot-2', 'cpt-A', 'lot-2', 60_000],
    ])
  })

  it('l’imputation s’y branche : ordre légal sur les échus, puis les appels à venir', () => {
    const resultat = imputerEncaissement({ id: 'E1', compteId: 'cpt-A', date: '2026-02-10', montantCentimes: 50_000 }, postesDepuisAvis(avis), { imputerSurAVenir: true })
    expect(resultat.lignes).toEqual([
      { posteId: 'B-2026-001-1:lot-1', montantCentimes: 40_000 },
      { posteId: 'FT-2026-1:lot-1', montantCentimes: 2_000 },
      { posteId: '00042-T1:lot-1', montantCentimes: 8_000 },
    ])
  })

  it('un appel de fonds de travaux non échu n’est jamais servi d’office, même quand on impute sur les appels à venir', () => {
    const resultat = imputerEncaissement({ id: 'E0', compteId: 'cpt-A', date: '2025-12-15', montantCentimes: 50_000 }, postesDepuisAvis(avis), { imputerSurAVenir: true })
    expect(resultat.lignes).toEqual([
      { posteId: 'B-2026-001-1:lot-1', montantCentimes: 40_000 },
      { posteId: '00042-T1:lot-1', montantCentimes: 10_000 },
    ])
  })

  it('une quote-part nulle ne crée pas de poste', () => {
    const zero = avisDAppel({
      echeances: [{ ...echeances[0], id: 'Z', montantCentimes: 1 }],
      cles: [creerCleRepartition({ id: 'cle-001', coproprieteId: 'copro-1', code: '001', libelle: 'x', lots: [{ lotId: 'lot-1', tantiemes: 1 }, { lotId: 'lot-2', tantiemes: 1 }] })],
      positions,
      comptes,
    })
    expect(zero.anomalies).toEqual([])
    expect(postesDepuisAvis(zero).map((p) => p.id)).toEqual(['Z:lot-1'])
  })

  it('refuse un avis en anomalie (comme l’écriture de l’appel) ou aux échéances en double', () => {
    const lotSansCompte = avisDAppel({ echeances: [echeances[0]], cles: [cle], positions: [positions[1]], comptes })
    expect(lotSansCompte.anomalies).toMatchObject([{ code: 'lot_sans_compte', lotId: 'lot-1' }])
    expect(() => postesDepuisAvis(lotSansCompte)).toThrow(/anomalie/)
    expect(() => postesDepuisAvis({ ...avis, echeances: [...avis.echeances, avis.echeances[0]] })).toThrow(/en double/)
  })
})
