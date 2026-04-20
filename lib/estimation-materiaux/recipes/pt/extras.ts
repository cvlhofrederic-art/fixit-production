import type { Recipe } from '../../types'
import { ptRefs } from '../../data/pt/standards'

/**
 * EXTRAS PT — recetas complementares (Lot F).
 *
 * 1 recette extra pour compléter le set de 20 :
 *  1. Canalização sanitária PEX básica (m²  habitação)
 */

export const extrasPtRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════════
  //  1. CANALIZAÇÃO SANITÁRIA PEX (habitação)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'canalizacao-pex-habitacao-pt',
    name: 'Canalização sanitária PEX habitação (cozinha + 1 casa de banho)',
    description: 'Distribuição água fria + quente em PEX-a (Uponor), colectores, válvulas, isolamento.',
    country: 'PT',
    trade: 'plomberie',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('abastecimento_agua', 'tubagens_pex', 'dimensionamento_plombagem'),
    ],
    hypothesesACommuniquer: [
      '1 unidade = rede completa para cozinha + 1 casa de banho',
      'Rede em PEX-a 16×2 mm (água fria + quente)',
      'Colector 4 saídas (água fria) + 4 saídas (água quente)',
      'Tubagem envolvida em corrugado anti-rato + permite substituição futura',
      'Isolamento AF/AQ obrigatório (anti-condensação / perdas térmicas)',
      'Válvula de corte geral + válvula por aparelho (RGSPPDADAR)',
      'Teste de pressão 1,5× pressão serviço antes de fechar chapas',
    ],
    materials: [
      {
        id: 'tubo-pex-16-pt', name: 'Tubo PEX-a 16×2 mm (Uponor Comfort Pipe Plus)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 40, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Cortes + perdas curvas',
        normRef: 'NP EN ISO 15875 (2005)', manufacturerRef: 'Uponor Portugal',
        packaging: { unit: 'rouleau', contentQty: 100, contentUnit: 'ml', label: 'rolo 100 ml' },
      },
      {
        id: 'corrugado-25-pt', name: 'Corrugado proteção tubo PEX (camisa)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 40, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
        manufacturerRef: 'Fersil',
      },
      {
        id: 'colector-pex-4-saidas-pt', name: 'Colector PEX 4 saídas com válvulas',
        category: 'accessoire', phase: 'principal', quantityPerBase: 2, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
        manufacturerRef: 'Uponor / Far',
      },
      {
        id: 'acessorios-pex-pt', name: 'Acessórios PEX (curvas, ligadores, uniões)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 12, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perdas, reajustes',
        manufacturerRef: 'Uponor',
      },
      {
        id: 'valvula-corte-pt', name: 'Válvula de corte geral 1/2"',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
        manufacturerRef: 'Jimten / Oventrop PT',
      },
      {
        id: 'isolamento-tubo-pt', name: 'Isolamento tubo (anti-condensação água fria)',
        category: 'isolant', phase: 'accessoires', quantityPerBase: 40, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
        manufacturerRef: 'Armacell / Kaiflex',
      },
      {
        id: 'selante-ptfe-pt', name: 'Fita PTFE / vedante roscas',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 3, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
      },
    ],
  },
]
