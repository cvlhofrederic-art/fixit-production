// tests/lib/btp-gantt-taches-devis.test.ts — Planeamento Gantt BTP : une tâche correspond à une ligne d'un devis de
// l'obra choisie, avec ses jours et son horaire (demande de Frédéric du 28/11/2026). Logique pure de
// lib/btp/gantt-taches-devis.ts ; l'écran est couvert par tests/components/gantt-sous-taches.test.tsx.

import { describe, it, expect } from 'vitest'
import {
  devisDeLObra, erreurPeriode, finDeTache, horaireAffiche, jourAffiche, joursAffiches, lignesPlanifiables, memeLigne,
} from '@/lib/btp/gantt-taches-devis'

const OBRA = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const AUTRE_OBRA = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'

const devis = (id: string, extra: Record<string, unknown> = {}) => ({
  id, numero: `ORC-2026-${id}`, chantier_id: OBRA,
  items: [
    { id: 101, description: 'Demolição de paredes', qty: 25, unit: 'm2', priceHT: 18, totalHT: 450 },
    { id: 102, description: '  Reboco\n  interior  ', qty: 3, unit: 'autre', customUnit: 'div', priceHT: 100, totalHT: 300 },
  ],
  ...extra,
})

describe('lignesPlanifiables', () => {
  it('rend chaque ligne avec sa désignation, sa quantité et sa place dans le devis', () => {
    expect(lignesPlanifiables(devis('001'))).toEqual([
      { cle: '001::0', devisId: '001', devisNumero: 'ORC-2026-001', ligneId: '101', ligneIndex: 0, description: 'Demolição de paredes', quantite: '25 m2' },
      { cle: '001::1', devisId: '001', devisNumero: 'ORC-2026-001', ligneId: '102', ligneIndex: 1, description: 'Reboco interior', quantite: '3 div' },
    ])
  })

  it('écarte les lignes sans désignation et garde le rang d’origine des autres', () => {
    const lignes = lignesPlanifiables({ id: 'd', numero: 'X', items: [{ description: '   ', qty: 1 }, null, { designation: 'Deslocação', quantite: 2, unite: 'forfait' }] })
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({ description: 'Deslocação', ligneIndex: 2, cle: 'd::2', ligneId: null, quantite: '2 forfait' })
  })

  it('lit des lignes enregistrées en texte JSON, et ne casse pas sur un texte illisible ou une ligne sans items', () => {
    expect(lignesPlanifiables({ id: 'd', items: JSON.stringify([{ description: 'Pintura' }]) }).map(l => l.description)).toEqual(['Pintura'])
    expect(lignesPlanifiables({ id: 'd', items: '[pas du json' })).toEqual([])
    expect(lignesPlanifiables({ id: 'd' })).toEqual([])
    expect(lignesPlanifiables({ items: [{ description: 'Sans devis' }] })).toEqual([])
  })
})

describe('devisDeLObra', () => {
  it('garde les devis rattachés à l’obra, sans doublon ni devis supprimé', () => {
    const lus = [
      devis('001'),
      devis('002', { chantier_id: AUTRE_OBRA }),
      devis('003', { chantier_id: null }),
      devis('004', { deleted_at: '2026-11-20T10:00:00Z' }),
      devis('001'),
      devis('005'),
    ]
    expect(devisDeLObra(lus, OBRA).map(d => d.id)).toEqual(['001', '005'])
  })

  it('garde un devis sans ligne (l’écran dit qu’il n’en a pas) et ne rend rien sans obra', () => {
    expect(devisDeLObra([devis('005', { items: [] })], OBRA)).toEqual([{ id: '005', numero: 'ORC-2026-005', lignes: [] }])
    expect(devisDeLObra([devis('001')], '')).toEqual([])
  })
})

describe('memeLigne', () => {
  const [ligne] = lignesPlanifiables(devis('001'))
  it('reconnaît la ligne par son devis, son rang et son identifiant', () => {
    expect(memeLigne({ devisId: '001', ligneId: '101', ligneIndex: 0 }, ligne)).toBe(true)
    expect(memeLigne({ devisId: '001', ligneId: null, ligneIndex: 0 }, ligne)).toBe(true)
    // Une ligne ajoutée avant elle dans le devis : même identifiant, autre rang ; autre identifiant au même rang.
    expect(memeLigne({ devisId: '001', ligneId: '101', ligneIndex: 5 }, ligne)).toBe(false)
    expect(memeLigne({ devisId: '001', ligneId: '999', ligneIndex: 0 }, ligne)).toBe(false)
    expect(memeLigne({ devisId: '002', ligneId: '101', ligneIndex: 0 }, ligne)).toBe(false)
  })

  // Relecture adverse du 28/11/2026 : le formulaire de devis BTP numérote chaque section à partir de 1, et devis.items
  // les met bout à bout. Planifier la démolition marquait aussi le ciment et le déplacement « déjà planifiés ».
  it('deux lignes de sections différentes au même identifiant ne se confondent pas', () => {
    const lignes = lignesPlanifiables({
      id: 'd', numero: 'ORC-1',
      items: [
        { id: 1, description: 'Demolição' }, { id: 2, description: 'Reboco' },
        { id: 1, description: 'Cimento' }, { id: 1, description: 'Deslocação' },
      ],
    })
    const planifiee = { devisId: 'd', ligneId: '1', ligneIndex: 0 }
    expect(lignes.map(l => memeLigne(planifiee, l))).toEqual([true, false, false, false])
  })
  it('une sous-tâche d’avant (sans devis) ne correspond à aucune ligne', () => {
    expect(memeLigne({}, ligne)).toBe(false)
  })
})

describe('erreurPeriode', () => {
  const ok = { debut: '2026-12-01', fin: '2026-12-05', heureDebut: '08:00', heureFin: '17:00' }
  it('accepte une période cohérente, y compris sur un seul jour', () => {
    expect(erreurPeriode(ok)).toBeNull()
    expect(erreurPeriode({ ...ok, fin: '2026-12-01' })).toBeNull()
  })
  it('signale jours manquants, fin avant début, heures manquantes ou dans le mauvais ordre', () => {
    expect(erreurPeriode({ ...ok, fin: '' })).toBe('jours_manquants')
    expect(erreurPeriode({ ...ok, fin: '2026-11-30' })).toBe('fin_avant_debut')
    expect(erreurPeriode({ ...ok, heureFin: '' })).toBe('heures_manquantes')
    expect(erreurPeriode({ ...ok, heureDebut: '25:00' })).toBe('heures_manquantes')
    expect(erreurPeriode({ ...ok, heureFin: '08:00' })).toBe('heure_fin_avant_debut')
    expect(erreurPeriode({ ...ok, heureDebut: '14:00', heureFin: '09:30' })).toBe('heure_fin_avant_debut')
  })
})

describe('affichage des jours et de l’horaire', () => {
  it('affiche les jours sans décalage de fuseau', () => {
    expect(jourAffiche('2026-12-01')).toBe('01/12/2026')
    expect(joursAffiches('2026-12-01', '2026-12-05')).toBe('01/12/2026 → 05/12/2026')
    expect(joursAffiches('2026-12-01', '2026-12-01')).toBe('01/12/2026')
    expect(joursAffiches('', '')).toBe('')
  })
  it('affiche l’horaire en portugais et en français, rien pour une sous-tâche d’avant', () => {
    expect(horaireAffiche('08:00', '17:00', true)).toBe('das 08:00 às 17:00')
    expect(horaireAffiche('08:00', '17:00', false)).toBe('de 08:00 à 17:00')
    expect(horaireAffiche(undefined, undefined, true)).toBe('')
  })
})

describe('finDeTache', () => {
  it('avec un horaire : le dernier jour à l’heure de fin, en heure locale', () => {
    const fin = finDeTache({ fin: '2026-12-05', heureFin: '17:30' })
    expect([fin.getFullYear(), fin.getMonth(), fin.getDate(), fin.getHours(), fin.getMinutes()]).toEqual([2026, 11, 5, 17, 30])
  })
  it('sans horaire (sous-tâche d’avant) : le calcul d’avant, inchangé', () => {
    expect(finDeTache({ fin: '2026-12-05' }).getTime()).toBe(new Date('2026-12-05').getTime())
  })
})
