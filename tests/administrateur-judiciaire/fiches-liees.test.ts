import { describe, expect, it } from 'vitest'
import {
  TAILLE_MAX_FICHES_LIEES,
  TAILLE_PAGE_FICHES_LIEES,
  creerRattachement,
  fichesLiees,
  rattachementsDuCourrier,
  rattachementsDuDocument,
  type FicheLiee,
} from '@/lib/administrateur-judiciaire/domain/fiches-liees'

/**
 * Rattachement générique et « fiches liées » (point 47 du bilan 2 ; Gestéam, tranche 39 § Patron commun des onglets
 * secondaires : sur les fiches client, identité, entreprise, lot, travaux et contrat, les onglets Demandes, Courriers,
 * Documents, Contrats sont des listes filtrées des fiches liées — filtre de statut, période Du / au, Date · Immeuble ou
 * Émetteur · Objet ou Titre, bouton Ajouter pré-rattaché ; tranche 41 : le résumé d'un gros mandat a fait planter Gestéam).
 */

const sinistre = creerRattachement('Sinistre', 'S-7')
const copro = creerRattachement('Copropriété', 'copro-tilleuls')

const fiche = (id: string, date: string, surcharge: Partial<FicheLiee> = {}): FicheLiee => ({
  id,
  date,
  statut: 'En cours',
  rattachements: [copro, sinistre],
  ...surcharge,
})

describe('rattachement', () => {
  it('un type de DOSSIER ou une fiche porteuse (copropriété, identité, entreprise), et un identifiant', () => {
    expect(creerRattachement('Contentieux', ' C-3 ')).toEqual({ type: 'Contentieux', id: 'C-3' })
    expect(creerRattachement('Identité', 'id-1').type).toBe('Identité')
    // @ts-expect-error — type hors référentiel
    expect(() => creerRattachement('Chantier', 'x')).toThrow(/inconnu/i)
    expect(() => creerRattachement('Sinistre', ' ')).toThrow(/identifiant/i)
  })

  it('d’un courrier : copropriété, mandat, identité, entreprise renseignés', () => {
    expect(rattachementsDuCourrier({ coproprieteId: 'copro-tilleuls', mandatId: 'm-1', personneId: null, entrepriseId: 'e-4' })).toEqual([
      { type: 'Copropriété', id: 'copro-tilleuls' },
      { type: 'Mandat de syndic', id: 'm-1' },
      { type: 'Entreprise', id: 'e-4' },
    ])
    expect(rattachementsDuCourrier({ coproprieteId: null, mandatId: null, personneId: 'id-1', entrepriseId: null })).toEqual([{ type: 'Identité', id: 'id-1' }])
  })

  it('d’un document : ordonnance au mandat, journal de reprise à la copropriété ; un autre type n’est rattaché à rien', () => {
    expect(rattachementsDuDocument({ entiteType: 'mandat', entiteId: 'm-1' })).toEqual([{ type: 'Mandat de syndic', id: 'm-1' }])
    expect(rattachementsDuDocument({ entiteType: 'reprise', entiteId: 'copro-tilleuls' })).toEqual([{ type: 'Copropriété', id: 'copro-tilleuls' }])
    expect(rattachementsDuDocument({ entiteType: 'ag', entiteId: 'AG-2026' })).toEqual([])
    expect(rattachementsDuDocument({ entiteType: 'constructor', entiteId: 'x' })).toEqual([])
    expect(rattachementsDuDocument({ entiteType: 'mandat', entiteId: ' ' })).toEqual([])
  })
})

describe('fiches liées', () => {
  const fiches = [
    fiche('c-1', '2026-03-10'),
    fiche('c-2', '2026-09-01', { statut: 'Clos' }),
    fiche('c-3', '2026-06-15', { rattachements: [copro] }),
    fiche('c-4', '2025-12-31'),
    fiche('c-5', '2026-09-01'),
  ]

  it('les fiches de la cible, de la plus récente à la plus ancienne (à date égale, par identifiant)', () => {
    const page = fichesLiees(fiches, sinistre)
    expect(page.lignes.map((f) => f.id)).toEqual(['c-2', 'c-5', 'c-1', 'c-4'])
    expect(page).toMatchObject({ total: 4, page: 1, pages: 1, taille: TAILLE_PAGE_FICHES_LIEES })
    expect(fichesLiees(fiches, sinistre, { ordre: 'ancien' }).lignes.map((f) => f.id)).toEqual(['c-4', 'c-1', 'c-2', 'c-5'])
    expect(fichesLiees(fiches, creerRattachement('Sinistre', 'S-8')).total).toBe(0)
  })

  it('filtre de statut et période Du / au, bornes incluses', () => {
    expect(fichesLiees(fiches, sinistre, { statuts: ['En cours'] }).lignes.map((f) => f.id)).toEqual(['c-5', 'c-1', 'c-4'])
    expect(fichesLiees(fiches, copro, { du: '2026-03-10', au: '2026-09-01' }).lignes.map((f) => f.id)).toEqual(['c-2', 'c-5', 'c-3', 'c-1'])
    expect(fichesLiees(fiches, copro, { du: '2026-06-16' }).lignes.map((f) => f.id)).toEqual(['c-2', 'c-5'])
    expect(fichesLiees(fiches, copro, { au: '2025-12-31' }).lignes.map((f) => f.id)).toEqual(['c-4'])
  })

  it('bornée et paginée : jamais plus d’une page en mémoire d’écran', () => {
    const beaucoup = Array.from({ length: 120 }, (_, i) => fiche(`f-${String(i).padStart(3, '0')}`, '2026-01-01'))
    const premiere = fichesLiees(beaucoup, sinistre)
    expect(premiere).toMatchObject({ total: 120, page: 1, pages: 3 })
    expect(premiere.lignes).toHaveLength(TAILLE_PAGE_FICHES_LIEES)
    expect(fichesLiees(beaucoup, sinistre, { page: 3 }).lignes.map((f) => f.id)).toEqual(beaucoup.slice(100).map((f) => f.id))
    expect(fichesLiees(beaucoup, sinistre, { page: 4 }).lignes).toEqual([])
    expect(fichesLiees(beaucoup, sinistre, { taille: TAILLE_MAX_FICHES_LIEES }).lignes).toHaveLength(120)
  })

  it('refuse une période, une page ou une taille invalides', () => {
    expect(() => fichesLiees(fiches, sinistre, { du: '01/03/2026' })).toThrow(/AAAA-MM-JJ/)
    expect(() => fichesLiees(fiches, sinistre, { du: '2026-09-01', au: '2026-03-01' })).toThrow(/période/i)
    expect(() => fichesLiees(fiches, sinistre, { page: 0 })).toThrow(/page/i)
    expect(() => fichesLiees(fiches, sinistre, { taille: TAILLE_MAX_FICHES_LIEES + 1 })).toThrow(/taille/i)
    expect(() => fichesLiees(fiches, sinistre, { taille: 2.5 })).toThrow(/taille/i)
  })

  it('ne modifie pas la liste reçue', () => {
    const copie = fiches.map((f) => f.id)
    fichesLiees(fiches, sinistre)
    expect(fiches.map((f) => f.id)).toEqual(copie)
  })
})
