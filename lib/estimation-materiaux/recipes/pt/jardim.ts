import type { Recipe } from '../../types'
import { ptRefs } from '../../data/pt/standards'

/**
 * JARDIM / ESPAÇOS EXTERIORES — recetas PT (escritas à mão, pt-PT).
 *
 * 4 obras de jardinagem e espaços exteriores :
 *  1. Relva natural (m²)
 *  2. Sistema de rega automática (u)
 *  3. Pavimento exterior permeável (m²)
 *  4. Muro de contenção (m³)
 *
 * Referências : NP EN 13242, NP EN 1338, NP EN 12620.
 * Fabricantes : Lusoceram, Pavestone PT, Weber PT, Sika PT.
 */

export const jardimRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════════
  //  1. RELVA NATURAL SEMEADA
  // ══════════════════════════════════════════════════════════════
  {
    id: 'relva-natural-pt',
    name: 'Relva natural semeada (preparação solo + sementeira)',
    description: 'Preparação do terreno, terra vegetal, corretivo orgânico e sementeira de relva para jardim residencial.',
    country: 'PT',
    trade: 'jardin',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      { code: 'NP EN 13242 (2013)', title: 'Agregados para materiais não ligados' },
    ],
    hypothesesACommuniquer: [
      'Terra vegetal 10-15 cm de espessura (NP EN 12620)',
      'Corretivo orgânico (composto) para fertilidade do solo',
      'Semente de relva rústica 35-40 g/m² (mistura festuca + lolium)',
      'Adubo de arranque NPK 15-15-15',
      'Rega diária durante 2-3 semanas após sementeira',
      'Primeiro corte ao atingir 8 cm de altura',
    ],
    materials: [
      {
        id: 'terra-vegetal-pt', name: 'Terra vegetal crivada (10 cm)',
        category: 'granulat', phase: 'preparation', quantityPerBase: 0.10, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Assentamento',
      },
      {
        id: 'composto-organico-pt', name: 'Composto orgânico / corretivo',
        category: 'adjuvant', phase: 'preparation', quantityPerBase: 0.02, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Assentamento',
      },
      {
        id: 'semente-relva-pt', name: 'Semente de relva rústica (mistura)',
        category: 'autre', phase: 'principal', quantityPerBase: 40, unit: 'g',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sementeira manual',
        manufacturerRef: 'Fertiberia / Lusosem',
      },
      {
        id: 'adubo-arranque-pt', name: 'Adubo de arranque NPK 15-15-15',
        category: 'adjuvant', phase: 'finitions', quantityPerBase: 30, unit: 'g',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Espalhamento',
      },
      {
        id: 'areia-cobertura-pt', name: 'Areia fina de cobertura (1-2 mm)',
        category: 'granulat', phase: 'finitions', quantityPerBase: 0.005, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Espalhamento',
        notes: 'Cobertura fina para proteção da semente',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  2. SISTEMA DE REGA AUTOMÁTICA
  // ══════════════════════════════════════════════════════════════
  {
    id: 'rega-automatica-pt',
    name: 'Sistema de rega automática (3 zonas relva + 1 gota-a-gota)',
    description: 'Programador 4 zonas + electroválvulas + tubo PE ∅25 + aspersores/gotejadores para jardim residencial.',
    country: 'PT',
    trade: 'jardin',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: ptRefs('abastecimento_agua'),
    hypothesesACommuniquer: [
      '1 unidade = instalação completa 4 zonas (3 relva + 1 canteiro)',
      'Programador 4-8 zonas (Hunter / Rain Bird)',
      '60 ml tubo PE ∅25 (rede principal)',
      '16 aspersores escamoteáveis (tipo pop-up)',
      'Filtro de entrada obrigatório (proteção electroválvulas)',
      'Redutor de pressão se rede > 4 bar',
      'Válvula anti-retorno obrigatória (proteção rede pública)',
    ],
    materials: [
      {
        id: 'programador-rega-pt', name: 'Programador 4-8 zonas (Hunter / Rain Bird)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
        manufacturerRef: 'Hunter / Rain Bird',
      },
      {
        id: 'electrovalvula-pt', name: 'Electroválvulas 24 V (1 por zona)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 4, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
      },
      {
        id: 'tubo-pe-25-pt', name: 'Tubo PE ∅25 (rede principal)',
        category: 'plaque', phase: 'principal', quantityPerBase: 60, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
      },
      {
        id: 'aspersor-pop-up-pt', name: 'Aspersores escamoteáveis (pop-up)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 16, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Quebras',
      },
      {
        id: 'acessorios-pe-pt', name: 'Acessórios PE (tês + curvas + uniões)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 12, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Rebuts',
      },
      {
        id: 'filtro-rega-pt', name: 'Filtro de entrada rede',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
      },
      {
        id: 'valvula-anti-retorno-pt', name: 'Válvula anti-retorno (proteção rede pública)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  3. PAVIMENTO EXTERIOR PERMEÁVEL
  // ══════════════════════════════════════════════════════════════
  {
    id: 'pavimento-permeavel-pt',
    name: 'Pavimento exterior em blocos de betão permeáveis',
    description: 'Pavimento permeável em blocos de betão vibro-prensado sobre cama de areia e sub-base drenante.',
    country: 'PT',
    trade: 'jardin',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: ptRefs('blocos_betao_pavimento', 'agregados_nao_ligados'),
    hypothesesACommuniquer: [
      'Blocos betão vibro-prensado 20×10×6 cm (Lusoceram / Pavestone PT)',
      '50 blocos por m² (espessura 6 cm, junta 3 mm)',
      'Cama de assentamento areia 0/4 com 4-5 cm',
      'Sub-base tout-venant 0/31,5 compactada 15 cm',
      'Geotêxtil 200 g/m² (anti-contaminação)',
      'Juntas preenchidas com areia fina (permeabilidade)',
      'Lancil de contenção perimetral obrigatório',
    ],
    materials: [
      {
        id: 'bloco-betao-pav-pt', name: 'Blocos betão vibro-prensado 20×10×6 cm',
        category: 'bloc', phase: 'principal', quantityPerBase: 50, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes, quebras',
        normRef: 'NP EN 1338 (2004)',
        manufacturerRef: 'Lusoceram / Pavestone PT',
        packaging: { unit: 'panneau', contentQty: 480, contentUnit: 'u', label: 'palete 480 u' },
      },
      {
        id: 'areia-assentamento-pav-pt', name: 'Areia 0/4 (cama de assentamento 5 cm)',
        category: 'granulat', phase: 'preparation', quantityPerBase: 0.05, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Nivelamento',
      },
      {
        id: 'tout-venant-pav-pt', name: 'Tout-venant 0/31,5 (sub-base 15 cm)',
        category: 'granulat', phase: 'preparation', quantityPerBase: 0.15, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Compactação',
        normRef: 'NP EN 13242 (2013)',
      },
      {
        id: 'geotextil-pav-pt', name: 'Geotêxtil 200 g/m² (anti-contaminação)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposição 20 cm',
        packaging: { unit: 'rouleau', contentQty: 100, contentUnit: 'm2', label: 'rolo 50×2 m' },
      },
      {
        id: 'areia-juntas-pav-pt', name: 'Areia fina (preenchimento juntas)',
        category: 'granulat', phase: 'finitions', quantityPerBase: 3, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Varrimento',
      },
      {
        id: 'lancil-betao-pav-pt', name: 'Lancil de betão 100×20×5 cm (contenção)',
        category: 'bloc', phase: 'accessoires', quantityPerBase: 0.5, unit: 'ml',
        geometryMultiplier: 'perimeter',
        wasteFactor: 1.05, wasteReason: 'Cortes',
        notes: 'Estimativa 0,5 ml de lancil por m² (perímetro variável)',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  4. MURO DE CONTENÇÃO EM BETÃO ARMADO
  // ══════════════════════════════════════════════════════════════
  {
    id: 'muro-contencao-pt',
    name: 'Muro de contenção em betão armado (tipo L)',
    description: 'Muro de suporte de terras em betão armado C25/30, secção tipo L com sapata, para desníveis até 2,50 m.',
    country: 'PT',
    trade: 'jardin',
    baseUnit: 'm3',
    geometryMode: 'volume',
    version: '2.0.0',
    dtuReferences: ptRefs('betao', 'betao_calculo', 'lnec_e464'),
    hypothesesACommuniquer: [
      'Betão C25/30 classe XC2 (enterrado, húmido — EN 206+A2)',
      'Secção tipo L: parede 20 cm + sapata 40 cm',
      'Armadura: ∅12 // 15 cm (face tracionada) + ∅8 // 20 (face comprimida)',
      'Drenagem traseira obrigatória (brita + tubo dreno ∅110)',
      'Impermeabilização face enterrada (emulsão betuminosa)',
      'Juntas de dilatação a cada 10-12 m',
      'Altura máx. 2,50 m — superior requer projeto de estabilidade',
    ],
    materials: [
      {
        id: 'cimento-contencao-pt', name: 'Cimento CEM II/B-L 32,5 N (350 kg/m³)',
        category: 'liant', phase: 'principal', quantityPerBase: 350, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.03, wasteReason: 'Resíduos sacos',
        manufacturerRef: 'Secil / Cimpor',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'areia-contencao-pt', name: 'Areia 0/4',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.48, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manuseamento',
      },
      {
        id: 'brita-contencao-pt', name: 'Brita 4/20',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.75, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manuseamento',
      },
      {
        id: 'agua-contencao-pt', name: 'Água de amassadura',
        category: 'eau', phase: 'principal', quantityPerBase: 175, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Doseamento',
      },
      {
        id: 'armadura-contencao-pt', name: 'Armadura HA ∅12 + ∅8 (taxa ~80 kg/m³)',
        category: 'acier', phase: 'principal', quantityPerBase: 80, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.12, wasteReason: 'Cortes, sobreposições EC2',
        normRef: 'NP EN 10080 (2008)',
      },
      {
        id: 'cofragem-contencao-pt', name: 'Cofragem metálica (2 faces)',
        category: 'ossature', phase: 'principal', quantityPerBase: 8, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Reutilização parcial',
        notes: '~8 m² de cofragem por m³ de muro (secção tipo L)',
      },
      {
        id: 'impermeab-contencao-pt', name: 'Emulsão betuminosa (face enterrada)',
        category: 'etancheite', phase: 'finitions', quantityPerBase: 0.5, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Aplicação rolo',
        manufacturerRef: 'Sika PT / Imperalum',
      },
      {
        id: 'dreno-contencao-pt', name: 'Tubo dreno ∅110 + brita drenagem traseira',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
        notes: '~1 ml de dreno por m³ de muro (estimativa)',
      },
    ],
  },
]
