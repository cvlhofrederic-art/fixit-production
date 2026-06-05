import type { Recipe } from '../../types'
import { ptRefs } from '../../data/pt/standards'

/**
 * CANALIZAÇÃO — recetas PT (pt-PT).
 *
 * 4 obras de canalização portuguesa corrente :
 *  1. Rede de água fria e quente (por ponto de água) (u)
 *  2. Esgoto e drenagem PVC (ml)
 *  3. Casa de banho completa (u)
 *  4. Cozinha — canalização completa (u)
 *
 * Referências : RGSPPDADAR (DR 23/95), NP EN 806, NP EN 12056, NP EN 1451-1.
 * Fabricantes : Geberit, Uponor PT, Sanitana, Roca PT, OLI.
 */

export const canalizacaoRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════════
  //  1. REDE DE ÁGUA FRIA E QUENTE (por ponto de água)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'rede-agua-ponto-pt',
    name: 'Rede de água fria/quente PEX (por ponto de água)',
    description: 'Alimentação AF + AQS por ponto de água desde coletor. Tubos PEX azul/vermelho Ø16 em tubo corrugado.',
    country: 'PT',
    trade: 'plomberie',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: ptRefs('dimensionamento_plombagem', 'abastecimento_agua_predial', 'tubagens_pex'),
    hypothesesACommuniquer: [
      '1 u = 1 ponto de água (lavatório, lava-louça, duche, sanita...)',
      'Estimativa 8 ml tubo por ponto desde coletor (distribuição em estrela)',
      'Tubo PEX azul AF + PEX vermelho AQS em tubo corrugado pré-formado',
      'Válvula de retenção + válvula de corte geral incluídas (RGSPPDADAR)',
      'Isolamento AQS para tubos > 3 m em zona não aquecida (REH)',
      'Ensaio de pressão obrigatório antes de fechar paredes (RGSPPDADAR)',
    ],
    materials: [
      {
        id: 'tubo-pex-16-azul-pt', name: 'Tubo PEX Ø16 azul (AF, em rolo)',
        category: 'plaque', phase: 'principal', quantityPerBase: 8, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes + curvatura',
        normRef: 'NP EN ISO 15875 (2005)', manufacturerRef: 'Uponor PT / Giacomini',
        packaging: { unit: 'rouleau', contentQty: 50, contentUnit: 'ml', label: 'rolo 50 m' },
      },
      {
        id: 'tubo-pex-16-vermelho-pt', name: 'Tubo PEX Ø16 vermelho (AQS, em rolo)',
        category: 'plaque', phase: 'principal', quantityPerBase: 5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes + curvatura',
        normRef: 'NP EN ISO 15875 (2005)', manufacturerRef: 'Uponor PT / Giacomini',
        packaging: { unit: 'rouleau', contentQty: 50, contentUnit: 'ml', label: 'rolo 50 m' },
        notes: '5 ml AQS/ponto (sanita não tem AQS — média ponderada).',
      },
      {
        id: 'tubo-corrugado-pex-pt', name: 'Tubo corrugado Ø25 (proteção + isolamento)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 13, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
        packaging: { unit: 'rouleau', contentQty: 25, contentUnit: 'ml', label: 'rolo 25 m' },
      },
      {
        id: 'coletor-pex-pt', name: 'Coletor PEX múltiplo (distribuição)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 0.25, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        manufacturerRef: 'Uponor PT / Giacomini',
        notes: '1 coletor para ~4 pontos de água (0,25 u/ponto).',
      },
      {
        id: 'acessorios-pex-pt', name: 'Acessórios PEX (joelhos + tês + uniões)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Rejeitados',
      },
      {
        id: 'valvula-corte-geral-pt', name: 'Válvula de corte geral (1/4 de volta)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.25, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        notes: '1 válvula por habitação (0,25 u/ponto se T3–T4).',
      },
      {
        id: 'valvula-retencao-pt', name: 'Válvula de retenção (após contador)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.25, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        notes: '1 válvula por habitação (obrigatório RGSPPDADAR).',
      },
      {
        id: 'abraçadeira-pex-pt', name: 'Abraçadeiras fixação tubo PEX (cada 50 cm)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 26, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perdas em obra',
        notes: '13 ml tubo corrugado bi-tubo AF+AQS / 0,5 m = 26 u/ponto.',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  2. ESGOTO E DRENAGEM PVC (rede linear)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'esgoto-drenagem-pvc-pt',
    name: 'Esgoto e drenagem PVC (rede linear)',
    description: 'Rede de esgoto e drenagem em PVC com ventilação primária obrigatória. Diâmetros conforme uso.',
    country: 'PT',
    trade: 'plomberie',
    baseUnit: 'ml',
    geometryMode: 'length',
    version: '2.0.0',
    dtuReferences: ptRefs('dimensionamento_plombagem', 'drenagem_predial', 'tubagens_pvc_drenagem'),
    hypothesesACommuniquer: [
      'Diâmetros por uso: Ø40 lavatório/bidé, Ø50 duche/máq. lavar, Ø75 lava-louça/banheira, Ø110 sanita+queda',
      'Rácio 1 ml = 1 ml tubo + acessórios (joelhos/tês ~0,3/ml médio)',
      'Cola PVC especial obrigatória — não usar cola universal',
      'Ventilação primária obrigatória queda EV Ø110 em cobertura (RGSPPDADAR)',
      'Caixa de visita cada 15 ml ou mudança de direção',
      'Sifão obrigatório por aparelho sanitário',
    ],
    materials: [
      {
        id: 'tubo-pvc-110-pt', name: 'Tubo PVC Ø110 esgoto (vara 3 m)',
        category: 'plaque', phase: 'principal', quantityPerBase: 0.3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
        normRef: 'NP EN 1329-1 (2014)',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'ml', label: 'vara 3 m' },
        notes: 'Rácio 30% do linear tipicamente em Ø110 (queda sanita).',
      },
      {
        id: 'tubo-pvc-75-pt', name: 'Tubo PVC Ø75 esgoto',
        category: 'plaque', phase: 'principal', quantityPerBase: 0.2, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'ml', label: 'vara 3 m' },
      },
      {
        id: 'tubo-pvc-50-pt', name: 'Tubo PVC Ø50 esgoto',
        category: 'plaque', phase: 'principal', quantityPerBase: 0.3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'ml', label: 'vara 3 m' },
      },
      {
        id: 'tubo-pvc-40-pt', name: 'Tubo PVC Ø40 esgoto',
        category: 'plaque', phase: 'principal', quantityPerBase: 0.2, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'ml', label: 'vara 3 m' },
      },
      {
        id: 'cola-pvc-esgoto-pt', name: 'Cola PVC especial esgoto',
        category: 'colle', phase: 'accessoires', quantityPerBase: 0.02, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Resíduos',
        manufacturerRef: 'Griffon / Ceys',
        packaging: { unit: 'pot', contentQty: 1, contentUnit: 'L', label: 'lata 1 L' },
      },
      {
        id: 'acessorios-pvc-pt', name: 'Acessórios PVC (joelhos + tês + uniões)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Rejeitados',
      },
      {
        id: 'abraçadeira-pvc-pt', name: 'Abraçadeiras fixação PVC (horizontal 80 cm, vertical 2 m)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.8, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perdas',
      },
      {
        id: 'tampa-visita-pvc-pt', name: 'Tampa de visita PVC (cada 15 ml)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.07, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
      {
        id: 'chapeu-ventilacao-pt', name: 'Chapéu ventilação primária Ø110 (cobertura)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.05, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        notes: '1 chapéu por queda EV (rácio 0,05/ml).',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  3. CASA DE BANHO COMPLETA
  // ══════════════════════════════════════════════════════════════
  {
    id: 'casa-banho-completa-pt',
    name: 'Casa de banho completa (sanita + lavatório + duche)',
    description: 'Casa de banho standard: sanita suspensa com autoclismo OLI/Geberit, lavatório com misturadora, base de duche com coluna.',
    country: 'PT',
    trade: 'plomberie',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: ptRefs('dimensionamento_plombagem', 'abastecimento_agua_predial'),
    hypothesesACommuniquer: [
      'Sanita suspensa com autoclismo embutido OLI / Geberit (dupla descarga 3/6 L)',
      'Lavatório cerâmico Sanitana/Roca PT com misturadora monocomando',
      'Base de duche acrílica 80×80 ou 90×90 com coluna e misturadora',
      'Resguardo de duche vidro temperado 6 mm',
      'Sifões cromados obrigatórios por aparelho',
      'Silicone sanitário anti-bolor nas juntas perimetrais',
      'Fixação autoclismo a parede portante (buchas metálicas M10)',
    ],
    materials: [
      {
        id: 'autoclismo-embutido-pt', name: 'Autoclismo embutido (OLI / Geberit Duofix)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        manufacturerRef: 'OLI / Geberit',
      },
      {
        id: 'sanita-suspensa-pt', name: 'Sanita suspensa sem rebordo (Sanitana / Roca PT)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        manufacturerRef: 'Sanitana / Roca PT',
      },
      {
        id: 'placa-descarga-pt', name: 'Placa de descarga dupla (3/6 L)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        manufacturerRef: 'OLI Globe / Geberit Sigma',
      },
      {
        id: 'lavatorio-ceramico-pt', name: 'Lavatório cerâmico (Sanitana / Roca PT)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        manufacturerRef: 'Sanitana / Roca PT',
      },
      {
        id: 'misturadora-lavatorio-pt', name: 'Misturadora monocomando lavatório',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        manufacturerRef: 'Roca PT / Grohe',
      },
      {
        id: 'base-duche-pt', name: 'Base de duche acrílica (80×80 ou 90×90)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        manufacturerRef: 'Sanitana / Roca PT',
      },
      {
        id: 'coluna-duche-pt', name: 'Coluna de duche (misturadora + chuveiro fixo + telefone)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        manufacturerRef: 'Roca PT / Grohe',
      },
      {
        id: 'resguardo-duche-pt', name: 'Resguardo duche vidro temperado 6 mm',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
      {
        id: 'sifao-lavatorio-pt', name: 'Sifão cromado Ø32 (lavatório)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
      {
        id: 'valvula-duche-pt', name: 'Válvula de descarga Ø90 (duche)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
      {
        id: 'flexiveis-inox-pt', name: 'Flexíveis inox G3/8" × 50 cm (AF + AQS)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        notes: '2 para lavatório + 2 para sanita/duche.',
      },
      {
        id: 'silicone-sanitario-pt', name: 'Silicone sanitário anti-bolor',
        category: 'joint', phase: 'finitions', quantityPerBase: 0.15, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purga cartucho',
        packaging: { unit: 'cartouche', contentQty: 0.31, contentUnit: 'L', label: 'cartucho 310 ml' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  4. COZINHA — CANALIZAÇÃO COMPLETA
  // ══════════════════════════════════════════════════════════════
  {
    id: 'canalizacao-cozinha-pt',
    name: 'Canalização de cozinha (lava-louça + máquinas)',
    description: 'Alimentação AF/AQS + esgoto para lava-louça, máquina de lavar louça e máquina de lavar roupa.',
    country: 'PT',
    trade: 'plomberie',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: ptRefs('dimensionamento_plombagem', 'abastecimento_agua_predial', 'tubagens_pvc_evacuacao'),
    hypothesesACommuniquer: [
      '1 u = canalização completa da cozinha (3 pontos de água)',
      'Lava-louça com misturadora monocomando bica alta',
      'Pontos de alimentação para máq. lavar louça + máq. lavar roupa',
      'Esgoto PVC Ø50 com sifão duplo (lava-louça + máq. louça)',
      'Válvulas de corte individuais por aparelho (RGSPPDADAR)',
      'Torneiras de máquina (1/4 de volta) com ligação roscada',
    ],
    materials: [
      {
        id: 'misturadora-cozinha-pt', name: 'Misturadora monocomando bica alta (cozinha)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        manufacturerRef: 'Roca PT / Grohe',
      },
      {
        id: 'sifao-duplo-cozinha-pt', name: 'Sifão duplo Ø50 (lava-louça + máq. louça)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
      {
        id: 'tubo-pex-16-cozinha-pt', name: 'Tubo PEX Ø16 (AF + AQS, 3 pontos)',
        category: 'plaque', phase: 'principal', quantityPerBase: 20, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes + curvatura',
        normRef: 'NP EN ISO 15875 (2005)', manufacturerRef: 'Uponor PT',
        packaging: { unit: 'rouleau', contentQty: 50, contentUnit: 'ml', label: 'rolo 50 m' },
        notes: '~7 ml × 3 pontos = ~20 ml (AF + AQS combinados).',
      },
      {
        id: 'tubo-pvc-50-cozinha-pt', name: 'Tubo PVC Ø50 esgoto cozinha',
        category: 'plaque', phase: 'principal', quantityPerBase: 3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
        normRef: 'NP EN 1329-1 (2014)',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'ml', label: 'vara 3 m' },
      },
      {
        id: 'torneira-maquina-pt', name: 'Torneiras de máquina 1/4 volta (máq. louça + máq. roupa)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
      {
        id: 'valvula-corte-cozinha-pt', name: 'Válvulas de corte individuais',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        notes: '1 por aparelho (lava-louça, máq. louça, máq. roupa).',
      },
      {
        id: 'flexiveis-cozinha-pt', name: 'Flexíveis inox G3/8" × 50 cm',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
      {
        id: 'fita-teflon-pt', name: 'Fita de teflon + pasta vedante (estanquicidade)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perdas',
      },
      {
        id: 'silicone-cozinha-pt', name: 'Silicone sanitário (vedação lava-louça)',
        category: 'joint', phase: 'finitions', quantityPerBase: 0.05, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purga cartucho',
        packaging: { unit: 'cartouche', contentQty: 0.31, contentUnit: 'L', label: 'cartucho 310 ml' },
      },
    ],
  },
]
