import type { Recipe } from '../../types'
import { ptRefs } from '../../data/pt/standards'

/**
 * ELETRICIDADE — recetas PT (pt-PT).
 *
 * 4 obras de instalações elétricas portuguesas correntes :
 *  1. Instalação elétrica habitação T3 (u)
 *  2. Quadro elétrico principal (u)
 *  3. Tomadas e interruptores — por circuito (u)
 *  4. Iluminação interior — por ponto luminoso (u)
 *
 * Referências : RTIEBT (Portaria 949-A/2006), NP EN 60898, NP EN 61008,
 *               CENELEC HD 60364, NP EN 61439-3.
 * Fabricantes : Efapel, Legrand PT, Schneider Electric PT, ABB PT.
 */

export const eletricidadeRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════════
  //  1. INSTALAÇÃO ELÉTRICA HABITAÇÃO T3
  // ══════════════════════════════════════════════════════════════
  {
    id: 'instalacao-eletrica-t3-pt',
    name: 'Instalação elétrica completa habitação T3',
    description: 'Instalação elétrica completa para T3 (~80 m²): quadro, circuitos, tomadas, iluminação, terra. Conforme RTIEBT.',
    country: 'PT',
    trade: 'electricite',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: ptRefs('rtiebt', 'cenelec_instalacoes', 'quadros_baixa_tensao'),
    hypothesesACommuniquer: [
      'Habitação T3 (~80 m²) — 12 a 16 circuitos conforme RTIEBT',
      'Quadro principal 3 filas × 12 módulos (Efapel / Legrand PT)',
      'Disjuntores diferenciais 30 mA tipo AC (2 u) + tipo A (1 u)',
      '~18 disjuntores magneto-térmicos (iluminação × 4, tomadas × 6, dedicados × 5, AVAC × 3)',
      'Cablagem H07V-U/R em tubo VD ou ERFE (RTIEBT)',
      'Ligação à terra com elétrodo e barramento de terra',
      'Certificação CERTIEL obrigatória após instalação',
    ],
    materials: [
      {
        id: 'quadro-3f-12m-pt', name: 'Quadro elétrico 3 filas × 12 módulos (Efapel)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        normRef: 'NP EN 61439-3 (2012)', manufacturerRef: 'Efapel / Legrand PT / Schneider Electric PT',
      },
      {
        id: 'diferencial-30ma-ac-pt', name: 'Interruptor diferencial 30 mA 40 A tipo AC',
        category: 'accessoire', phase: 'principal', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        normRef: 'NP EN 61008-1 (2012)', manufacturerRef: 'ABB PT / Schneider Electric PT',
      },
      {
        id: 'diferencial-30ma-a-pt', name: 'Interruptor diferencial 30 mA 40 A tipo A',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        normRef: 'NP EN 61008-1 (2012)', manufacturerRef: 'ABB PT / Schneider Electric PT',
        notes: 'Obrigatório para circuitos máq. lavar, AVAC, carregamento VE.',
      },
      {
        id: 'disjuntor-mt-pt', name: 'Disjuntores magneto-térmicos 10A/16A/20A/32A',
        category: 'accessoire', phase: 'principal', quantityPerBase: 18, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        normRef: 'NP EN 60898-1 (2015)', manufacturerRef: 'Efapel / ABB PT',
        notes: 'T3: ~18 disjuntores (iluminação × 4, tomadas × 6, dedicados × 5, AVAC × 3).',
      },
      {
        id: 'tubo-vd-20-pt', name: 'Tubo VD Ø20 mm (proteção cabos)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 350, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes, curvas, troços',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'ml', label: 'vara 3 m' },
      },
      {
        id: 'cabo-h07vu-15-pt', name: 'Cabo H07V-U 1,5 mm² (iluminação)',
        category: 'plaque', phase: 'principal', quantityPerBase: 200, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes, descarnar',
        packaging: { unit: 'rouleau', contentQty: 100, contentUnit: 'ml', label: 'rolo 100 m' },
      },
      {
        id: 'cabo-h07vu-25-pt', name: 'Cabo H07V-U 2,5 mm² (tomadas)',
        category: 'plaque', phase: 'principal', quantityPerBase: 250, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes, descarnar',
        packaging: { unit: 'rouleau', contentQty: 100, contentUnit: 'ml', label: 'rolo 100 m' },
      },
      {
        id: 'tomada-schuko-pt', name: 'Tomadas Schuko 16 A (mecanismo + espelho)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 25, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        manufacturerRef: 'Efapel Série 90 / Legrand Niloe',
      },
      {
        id: 'interruptor-simples-pt', name: 'Interruptores simples/comutação (mecanismo + espelho)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 12, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        manufacturerRef: 'Efapel Série 90 / Legrand Niloe',
      },
      {
        id: 'caixa-aparelhagem-pt', name: 'Caixas de aparelhagem encastrar Ø60 mm',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 40, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Quebras na montagem',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  2. QUADRO ELÉTRICO PRINCIPAL
  // ══════════════════════════════════════════════════════════════
  {
    id: 'quadro-eletrico-principal-pt',
    name: 'Quadro elétrico principal (T2–T5)',
    description: 'Quadro com barramento, diferenciais 30 mA, disjuntores, pentes de ligação, bornes terra/neutro. Conforme RTIEBT.',
    country: 'PT',
    trade: 'electricite',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: ptRefs('rtiebt', 'quadros_baixa_tensao', 'disjuntores', 'diferenciais'),
    hypothesesACommuniquer: [
      'Quadro 2 a 4 filas conforme tipologia (T2 = 2 filas, T5 = 4 filas)',
      'Disjuntor de entrada (corte geral) 40 A bipolar obrigatório',
      'Diferenciais 30 mA: tipo AC (circuitos gerais) + tipo A (máq. lavar, AVAC)',
      'Pentes de ligação horizontais (1 por fila)',
      'Etiquetagem obrigatória de todos os circuitos (RTIEBT)',
      'Certificação CERTIEL obrigatória após instalação',
    ],
    materials: [
      {
        id: 'caixa-quadro-3f-pt', name: 'Caixa quadro 3 filas × 12 módulos (encastrar)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        normRef: 'NP EN 61439-3 (2012)', manufacturerRef: 'Efapel / Hager PT',
      },
      {
        id: 'disjuntor-geral-40a-pt', name: 'Disjuntor corte geral 40 A bipolar',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        normRef: 'NP EN 60898-1 (2015)',
      },
      {
        id: 'diferencial-30ma-ac-pt', name: 'Interruptor diferencial 30 mA 40 A tipo AC',
        category: 'accessoire', phase: 'principal', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        normRef: 'NP EN 61008-1 (2012)',
      },
      {
        id: 'diferencial-30ma-a-pt', name: 'Interruptor diferencial 30 mA 40 A tipo A',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        normRef: 'NP EN 61008-1 (2012)',
      },
      {
        id: 'disjuntor-mt-10-16-20-pt', name: 'Disjuntores magneto-térmicos 10A/16A/20A/32A',
        category: 'accessoire', phase: 'principal', quantityPerBase: 18, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        normRef: 'NP EN 60898-1 (2015)', manufacturerRef: 'ABB PT / Schneider Electric PT',
      },
      {
        id: 'pente-ligacao-pt', name: 'Pentes de ligação (barramentos horizontais)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit',
        notes: '1 pente por fila.',
      },
      {
        id: 'borne-terra-neutro-pt', name: 'Borne de terra + borne de neutro',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit',
      },
      {
        id: 'etiquetagem-circuitos-pt', name: 'Etiquetagem de circuitos (autocolantes + esquema)',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  3. TOMADAS E INTERRUPTORES — POR CIRCUITO
  // ══════════════════════════════════════════════════════════════
  {
    id: 'circuito-tomadas-pt',
    name: 'Circuito de tomadas/interruptores (1 circuito standard)',
    description: 'Cablagem completa de 1 circuito: tubo VD + cabos H07V-U + caixas + tomadas Schuko ou interruptores. ~30 ml por circuito.',
    country: 'PT',
    trade: 'electricite',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: ptRefs('rtiebt', 'cenelec_instalacoes', 'disjuntores'),
    hypothesesACommuniquer: [
      '1 u = 1 circuito elétrico (tomadas OU iluminação OU dedicado)',
      'Secção conforme uso: 1,5 mm² iluminação, 2,5 mm² tomadas 16 A, 6 mm² 32 A (forno/placa)',
      'Estimativa 30 ml tubo VD por circuito (média de comprimentos)',
      'Cabos H07V-U rígidos 3 condutores: fase + neutro + terra',
      'Máx. 8 tomadas por circuito 16 A / máx. 8 pontos por circuito iluminação (RTIEBT)',
      'Ligadores Wago 221 ou equivalente (substituem bornes antigos)',
    ],
    materials: [
      {
        id: 'tubo-vd-20-circuito-pt', name: 'Tubo VD Ø20 mm (proteção cabo)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 33, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes + curvas',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'ml', label: 'vara 3 m' },
      },
      {
        id: 'cabo-h07vu-25-fase-pt', name: 'Cabo H07V-U 2,5 mm² fase (castanho)',
        category: 'plaque', phase: 'principal', quantityPerBase: 33, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes, descarnar',
        packaging: { unit: 'rouleau', contentQty: 100, contentUnit: 'ml', label: 'rolo 100 m' },
      },
      {
        id: 'cabo-h07vu-25-neutro-pt', name: 'Cabo H07V-U 2,5 mm² neutro (azul)',
        category: 'plaque', phase: 'principal', quantityPerBase: 33, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
        packaging: { unit: 'rouleau', contentQty: 100, contentUnit: 'ml', label: 'rolo 100 m' },
      },
      {
        id: 'cabo-h07vu-25-terra-pt', name: 'Cabo H07V-U 2,5 mm² terra (verde/amarelo)',
        category: 'plaque', phase: 'principal', quantityPerBase: 33, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
        packaging: { unit: 'rouleau', contentQty: 100, contentUnit: 'ml', label: 'rolo 100 m' },
      },
      {
        id: 'caixa-aparelhagem-circuito-pt', name: 'Caixas de aparelhagem encastrar Ø60 mm',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 5, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Quebras',
        manufacturerRef: 'Efapel / Legrand PT',
      },
      {
        id: 'tomada-schuko-circuito-pt', name: 'Tomadas Schuko 16 A (mecanismo + espelho)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 5, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        manufacturerRef: 'Efapel Série 90 / Legrand Niloe',
        optional: true,
        condition: 'Se circuito de tomadas (não iluminação)',
      },
      {
        id: 'interruptor-circuito-pt', name: 'Interruptores simples/comutação',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        manufacturerRef: 'Efapel Série 90',
        optional: true,
        condition: 'Se circuito de iluminação',
      },
      {
        id: 'ligador-wago-221-pt', name: 'Ligadores Wago 221 (conexões)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 10, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perdas',
        manufacturerRef: 'Wago 221',
        packaging: { unit: 'u', contentQty: 100, contentUnit: 'u', label: 'caixa 100 u' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  4. ILUMINAÇÃO INTERIOR — POR PONTO LUMINOSO
  // ══════════════════════════════════════════════════════════════
  {
    id: 'iluminacao-ponto-pt',
    name: 'Iluminação interior (1 ponto luminoso)',
    description: 'Ponto de luz com caixa DCL, suporte luminária, cablagem desde caixa de derivação. Luminária não incluída.',
    country: 'PT',
    trade: 'electricite',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: ptRefs('rtiebt', 'cenelec_instalacoes'),
    hypothesesACommuniquer: [
      '1 u = 1 ponto luminoso (teto ou parede)',
      'Caixa DCL obrigatória no teto (ponto de ligação normalizado)',
      'Cablagem H07V-U 1,5 mm² desde caixa de derivação (~5 ml médios)',
      'Tubo VD Ø16 mm para proteção',
      'Luminária LED não incluída (a prever separadamente)',
      'Máx. 8 pontos luminosos por circuito 10 A (RTIEBT)',
    ],
    materials: [
      {
        id: 'caixa-dcl-pt', name: 'Caixa DCL teto (ponto de ligação)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        manufacturerRef: 'Efapel / Legrand PT',
      },
      {
        id: 'cabo-h07vu-15-ilum-pt', name: 'Cabo H07V-U 1,5 mm² (3 condutores)',
        category: 'plaque', phase: 'principal', quantityPerBase: 15, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes (3 cond. × 5 ml)',
        packaging: { unit: 'rouleau', contentQty: 100, contentUnit: 'ml', label: 'rolo 100 m' },
        notes: '3 condutores × 5 ml = 15 ml total (fase + neutro + terra).',
      },
      {
        id: 'tubo-vd-16-ilum-pt', name: 'Tubo VD Ø16 mm',
        category: 'accessoire', phase: 'principal', quantityPerBase: 5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'ml', label: 'vara 3 m' },
      },
      {
        id: 'caixa-derivacao-pt', name: 'Caixa de derivação (1 por 3 pontos)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.33, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
      {
        id: 'ligador-wago-ilum-pt', name: 'Ligadores Wago 221',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perdas',
        manufacturerRef: 'Wago 221',
      },
      {
        id: 'abraçadeira-tubo-pt', name: 'Abraçadeiras fixação tubo VD (cada 60 cm)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 8, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perdas',
      },
    ],
  },
]
