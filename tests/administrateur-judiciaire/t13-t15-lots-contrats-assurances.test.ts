import { describe, expect, it } from 'vitest'
import type { Contrat, Lot, Prestataire } from '@/lib/administrateur-judiciaire/db/schema'
import { attestationsEntreprisesAControler } from '@/lib/administrateur-judiciaire/domain/assurances-entreprises'
import { contratsARemettreEnConcurrence } from '@/lib/administrateur-judiciaire/domain/contrats'
import type { StatutContrat, TypeContrat, TypeLot } from '@/lib/administrateur-judiciaire/domain/referentiels-vitfix'

/**
 * T13 à T15 (intégration Gestéam, lot 1) : type de lot, contrat (type, statut, deux fenêtres de dates distinctes,
 * retard de facture), assurances des entreprises (RC décennale et RCP : nécessaire + échéance).
 */

const suivi = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: null,
  updatedBy: null,
}

describe('T13 — Lot.type typé par le référentiel', () => {
  it('accepte une valeur du référentiel, refuse le reste à la compilation', () => {
    const lot: Pick<Lot, 'type'> = { type: 'Appartement' }
    expect(lot.type).toBe('Appartement')
    // @ts-expect-error — valeur hors référentiel
    const horsListe: TypeLot = 'Appart'
    expect(horsListe).toBe('Appart')
  })
})

const contrat = (surcharge: Partial<Contrat>): Contrat => ({
  id: 'k1',
  prestataireId: 'p1',
  coproprieteId: 'C1',
  type: 'Maintenance',
  statut: 'En cours',
  reconductionDu: null,
  reconductionAu: null,
  concurrenceDu: null,
  concurrenceAu: null,
  retardFactureJours: null,
  ...suivi,
  ...surcharge,
})

describe('T14 — Contrat : type, statut, deux fenêtres distinctes', () => {
  it('type et statut sont typés par le référentiel', () => {
    // @ts-expect-error — type hors référentiel
    const t: TypeContrat = 'Entretien'
    // @ts-expect-error — statut hors référentiel
    const s: StatutContrat = 'Actif'
    expect([t, s]).toEqual(['Entretien', 'Actif'])
  })

  it('contrats à remettre en concurrence à une date : fenêtre de CONCURRENCE, bornes incluses, contrats en cours', () => {
    const contrats = [
      contrat({ id: 'dans-fenetre', concurrenceDu: '2026-09-01', concurrenceAu: '2026-11-30' }),
      contrat({ id: 'borne-debut', concurrenceDu: '2026-10-08', concurrenceAu: '2026-12-31' }),
      contrat({ id: 'borne-fin', concurrenceDu: '2026-01-01', concurrenceAu: '2026-10-08' }),
      contrat({ id: 'trop-tot', concurrenceDu: '2026-11-01', concurrenceAu: '2026-12-31' }),
      contrat({ id: 'resilie', statut: 'Résilié', concurrenceDu: '2026-09-01', concurrenceAu: '2026-11-30' }),
      contrat({ id: 'sans-fenetre' }),
      // La fenêtre de RECONDUCTION ne compte pas : les deux fenêtres ne servent pas à la même chose.
      contrat({ id: 'reconduction-seule', reconductionDu: '2026-09-01', reconductionAu: '2026-11-30' }),
    ]
    expect(contratsARemettreEnConcurrence(contrats, '2026-10-08').map((c) => c.id)).toEqual([
      'dans-fenetre',
      'borne-debut',
      'borne-fin',
    ])
  })

  it('une date invalide est refusée', () => {
    expect(() => contratsARemettreEnConcurrence([], '08/10/2026')).toThrow(/date/i)
  })
})

const prestataire = (surcharge: Partial<Prestataire>): Prestataire => ({
  id: 'p1',
  nom: 'Entreprise',
  metier: 'Plomberie',
  ville: 'Paris',
  siret: '',
  decennale: false,
  note: 0,
  interventions: 0,
  statut: '',
  pill: '',
  rcDecennaleNecessaire: false,
  rcDecennaleEcheance: null,
  rcpNecessaire: false,
  rcpEcheance: null,
  ...suivi,
  ...surcharge,
})

describe('T15 — attestations d’assurance des entreprises', () => {
  it('signale les attestations nécessaires échues, qui échoient avant la date, ou sans échéance', () => {
    const prestataires = [
      prestataire({ id: 'a-jour', rcDecennaleNecessaire: true, rcDecennaleEcheance: '2027-03-31', rcpNecessaire: true, rcpEcheance: '2027-01-01' }),
      prestataire({ id: 'decennale-echue', rcDecennaleNecessaire: true, rcDecennaleEcheance: '2026-06-30' }),
      prestataire({ id: 'rcp-echoit', rcpNecessaire: true, rcpEcheance: '2026-12-15' }),
      prestataire({ id: 'rcp-sans-date', rcpNecessaire: true, rcpEcheance: null }),
      prestataire({ id: 'non-necessaire', rcDecennaleNecessaire: false, rcDecennaleEcheance: '2020-01-01' }),
    ]
    expect(attestationsEntreprisesAControler(prestataires, '2026-12-31')).toEqual([
      { prestataireId: 'decennale-echue', garantie: 'RC décennale', echeance: '2026-06-30', motif: 'echue_ou_echoit' },
      { prestataireId: 'rcp-echoit', garantie: 'RCP', echeance: '2026-12-15', motif: 'echue_ou_echoit' },
      { prestataireId: 'rcp-sans-date', garantie: 'RCP', echeance: null, motif: 'echeance_absente' },
    ])
  })

  it('une échéance égale à la date est signalée (elle échoit ce jour-là)', () => {
    const p = prestataire({ id: 'ce-jour', rcDecennaleNecessaire: true, rcDecennaleEcheance: '2026-10-08' })
    expect(attestationsEntreprisesAControler([p], '2026-10-08')).toHaveLength(1)
  })

  it('une date invalide est refusée', () => {
    expect(() => attestationsEntreprisesAControler([], '2026-13-01')).toThrow(/date/i)
  })
})
