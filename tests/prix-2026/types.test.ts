import { describe, it, expect } from 'vitest'
import type { PriceLine, Metier, Source, CostBreakdown, AidesEligibles } from '@/lib/prix-travaux-2026'

describe('lib/prix-travaux-2026 — types', () => {
  it('exports PriceLine type with required fields', () => {
    const line: PriceLine = {
      metier: 'peinture',
      taskId: 'test-task',
      label: 'Test',
      unit: 'm2',
      cost: { mainOeuvreHeures: 1, mainOeuvreTauxHoraire: 50, materiaux: 10, chargesEntreprise: 60, margeNette: 10 },
      priceMin: 100,
      priceMax: 115,
      priceUnit: 'EUR_TTC',
      tva: 10,
      sources: [{ name: 's', tier: 1 }],
      lastVerified: '2026-04-27',
      confidence: 'high',
    }
    expect(line.taskId).toBe('test-task')
  })

  it('Metier union includes all 20 trades', () => {
    const metiers: Metier[] = [
      'plomberie', 'electricite', 'peinture', 'plaquiste', 'carrelage',
      'maconnerie', 'couverture', 'menuiserie', 'serrurerie', 'vitrerie',
      'chauffage', 'climatisation', 'paysagisme', 'piscine', 'ramonage',
      'nettoyage', 'store-banne', 'desamiantage', 'photovoltaique', 'ite',
    ]
    expect(metiers).toHaveLength(20)
  })
})
