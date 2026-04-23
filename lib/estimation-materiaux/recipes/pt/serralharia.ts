import type { Recipe } from '../../types'
import { ptRefs } from '../../data/pt/standards'

/**
 * SERRALHARIA — recetas PT (Lot Métallerie — escritas à mão, pt-PT).
 *
 * 5 obras de serralharia metálica portuguesa corrente :
 *  1. Gradeamento / guarda de varanda (ml)
 *  2. Portão metálico de garagem (u)
 *  3. Escada metálica interior (u)
 *  4. Estrutura metálica ligeira (kg)
 *  5. Corrimão metálico (ml)
 *
 * Referências : NP EN 1090 (execução), NP EN 10025 (aços), Eurocódigo 3.
 * Fabricantes : Aço Português, Ferpinta, Megasa, A. Ramalhão.
 */

export const serralhariaRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════════
  //  1. GRADEAMENTO / GUARDA DE VARANDA
  // ══════════════════════════════════════════════════════════════
  {
    id: 'gradeamento-varanda-pt',
    name: 'Gradeamento / guarda de varanda em aço (altura 1,10 m)',
    description: 'Guarda metálica para varanda ou escada exterior. Tubo quadrado 40×40, montantes + corrimão + travessas.',
    country: 'PT',
    trade: 'metallerie',
    baseUnit: 'ml',
    geometryMode: 'length',
    version: '2.0.0',
    dtuReferences: [
      { code: 'NP EN 1090-1+A1 (2012)', title: 'Execução de estruturas de aço — requisitos' },
      { code: 'NP EN 10025-2 (2019)', title: 'Produtos laminados a quente de aços de construção — condições técnicas' },
      { code: 'RGEU art.º 58-61', title: 'Guardas e varandas — alturas mínimas' },
    ],
    hypothesesACommuniquer: [
      'Altura mínima 1,10 m (RGEU art.º 58)',
      'Espaçamento máximo entre elementos verticais 11 cm (segurança infantil)',
      'Aço S235JR (NP EN 10025-2) — tubo quadrado 40×40×2 mm',
      'Tratamento: metalização / galvanização a quente + pintura epóxi',
      'Chumbamento com bucha química em laje/murete',
      'Acabamento conforme projecto (lacado RAL à escolha)',
    ],
    materials: [
      {
        id: 'tubo-quadrado-40-pt', name: 'Tubo quadrado 40×40×2 mm S235JR (montantes + corrimão)',
        category: 'acier', phase: 'principal', quantityPerBase: 8, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes, soldadura, pontas',
        normRef: 'NP EN 10025-2 (2019)', manufacturerRef: 'Ferpinta / Megasa',
      },
      {
        id: 'travessas-varetas-pt', name: 'Varetas / travessas verticais ∅12 (enchimento)',
        category: 'acier', phase: 'principal', quantityPerBase: 3, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.12, wasteReason: 'Cortes frequentes, pontas curtas',
        normRef: 'NP EN 10025-2 (2019)',
      },
      {
        id: 'chapa-base-fixacao-pt', name: 'Chapas de base fixação (platines 100×100×6 mm)',
        category: 'acier', phase: 'principal', quantityPerBase: 2, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Corte laser, pouca perda',
        notes: '2 platines por ml (~1 montante a cada 0,5 m)',
      },
      {
        id: 'bucha-quimica-pt', name: 'Bucha química (chumbamento em betão)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 2, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Reserva, falhas furo',
        packaging: { unit: 'cartouche', contentQty: 10, contentUnit: 'u', label: 'cartucho 300 ml (~10 fix.)' },
      },
      {
        id: 'varoes-roscados-pt', name: 'Varões roscados M10 + porcas (ancoragem)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 4, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Reserva',
      },
      {
        id: 'primario-zinco-pt', name: 'Primário rico em zinco (metalização a frio)',
        category: 'peinture', phase: 'finitions', quantityPerBase: 0.15, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação pistola/pincel',
        manufacturerRef: 'CIN / Hempel',
      },
      {
        id: 'tinta-epoxi-ral-pt', name: 'Tinta epóxi de acabamento (RAL à escolha)',
        category: 'peinture', phase: 'finitions', quantityPerBase: 0.15, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação + retoques',
        manufacturerRef: 'CIN / Robbialac',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  2. PORTÃO METÁLICO DE GARAGEM (BASCULANTE / SECCIONADO)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'portao-metalico-garagem-pt',
    name: 'Portão metálico de garagem basculante/seccionado (3×2,2 m)',
    description: 'Portão garagem em chapa aço galvanizado com motorização. Dimensão standard 3,0×2,2 m.',
    country: 'PT',
    trade: 'metallerie',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: [
      { code: 'NP EN 13241-1 (2004)', title: 'Portões industriais, comerciais e de garagem — norma de produto' },
      { code: 'NP EN 12604 (2017)', title: 'Portões — aspectos mecânicos — requisitos' },
      { code: 'Marcação CE', title: 'Regulamento (UE) n.º 305/2011' },
    ],
    hypothesesACommuniquer: [
      'Portão seccionado ou basculante 3,0×2,2 m (garagem individual)',
      'Chapa aço galvanizado + isolamento PU injectado (painéis seccionados)',
      'Motorização tubular incluída (compatível telecomando)',
      'Guias laterais + molas de compensação',
      'Segurança anti-queda + fotocélula (NP EN 12453)',
      'Alimentação elétrica monofásica 230 V a prever pelo electricista',
    ],
    materials: [
      {
        id: 'portao-seccionado-pt', name: 'Portão seccionado galvanizado completo (painéis + guias + molas)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit completo fabricante',
        normRef: 'NP EN 13241-1 (2004)', manufacturerRef: 'Hörmann / Novoferm / Crawford',
      },
      {
        id: 'motor-portao-pt', name: 'Motor tubular + telecomandos (2 u)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit',
        manufacturerRef: 'Somfy / Hörmann',
      },
      {
        id: 'fotocelula-portao-pt', name: 'Fotocélula de segurança (par)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        normRef: 'NP EN 12453 (2017)',
      },
      {
        id: 'bucha-fixacao-guia-pt', name: 'Buchas metálicas fixação guias (10 u)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 10, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Reserva',
      },
      {
        id: 'vedante-perimetral-portao-pt', name: 'Vedante perimetral borracha (contorno)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 10, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes ajuste',
      },
      {
        id: 'cabo-electrico-portao-pt', name: 'Cabo eléctrico 3G1,5 mm² (alimentação motor)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 5, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Trajecto variável',
        notes: 'Comprimento estimado — adaptar conforme distância ao quadro eléctrico',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  3. ESCADA METÁLICA INTERIOR (14 DEGRAUS)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'escada-metalica-14-pt',
    name: 'Escada metálica interior recta ou 1/4 volta (14 degraus)',
    description: 'Escada metálica para pé-direito 2,70 m: 2 longarinas UPN + degraus chapa + corrimão + balaústres.',
    country: 'PT',
    trade: 'metallerie',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: [
      { code: 'NP EN 1090-2 (2018)', title: 'Execução de estruturas de aço — requisitos técnicos classe EXC2' },
      { code: 'NP EN 1993-1-1 (Eurocódigo 3)', title: 'Projecto de estruturas de aço — regras gerais' },
      { code: 'RGEU art.º 42-44', title: 'Escadas — dimensões mínimas' },
    ],
    hypothesesACommuniquer: [
      '14 degraus para pé-direito 2,70 m (cobertor 25 cm, espelho 19 cm)',
      'Longarinas em perfil UPN 200 ou tubo rectangular 200×100×5 mm',
      'Degraus em chapa xadrez 4/6 mm ou madeira sobre suporte metálico',
      'Corrimão tubo ∅42 mm, balaústres tubo ∅16 mm',
      'Tratamento: decapagem + primário + lacagem epóxi',
      'Cálculo estrutural segundo Eurocódigo 3 (sobrecarga 3 kN/m²)',
    ],
    materials: [
      {
        id: 'longarina-upn-200-pt', name: 'Longarinas UPN 200 (2 u × 4,5 m)',
        category: 'acier', phase: 'principal', quantityPerBase: 210, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.08, wasteReason: 'Cortes, furação',
        normRef: 'NP EN 10025-2 (2019)', manufacturerRef: 'Aço Português / Megasa',
      },
      {
        id: 'degrau-chapa-xadrez-pt', name: 'Degraus chapa xadrez 4/6 mm (14 u)',
        category: 'acier', phase: 'principal', quantityPerBase: 85, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes, pontas',
        notes: '~6 kg/degrau × 14 = 84 kg',
      },
      {
        id: 'corrimao-tubo-42-pt', name: 'Corrimão tubo ∅42×2 mm inox/aço',
        category: 'acier', phase: 'principal', quantityPerBase: 5, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes, curvas',
      },
      {
        id: 'balaustre-tubo-16-pt', name: 'Balaústres tubo ∅16 mm (14 u)',
        category: 'acier', phase: 'principal', quantityPerBase: 14, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Perdas corte',
      },
      {
        id: 'chapa-apoio-escada-pt', name: 'Chapas de apoio superior/inferior (platines)',
        category: 'acier', phase: 'principal', quantityPerBase: 4, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Corte laser',
      },
      {
        id: 'eléctrodos-soldadura-pt', name: 'Eléctrodos / fio MIG 0,8 mm (soldadura)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 2, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.20, wasteReason: 'Pontas, projecções',
      },
      {
        id: 'bucha-quimica-escada-pt', name: 'Buchas químicas fixação (4 pontos)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 4, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Reserva',
      },
      {
        id: 'primario-epoxi-escada-pt', name: 'Primário epóxi anti-corrosão',
        category: 'peinture', phase: 'finitions', quantityPerBase: 1.5, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação + retoques',
        manufacturerRef: 'CIN / Hempel',
      },
      {
        id: 'tinta-acabamento-escada-pt', name: 'Tinta epóxi acabamento (RAL)',
        category: 'peinture', phase: 'finitions', quantityPerBase: 1.5, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação + retoques',
        manufacturerRef: 'CIN / Robbialac',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  4. ESTRUTURA METÁLICA LIGEIRA (PERFIS LAMINADOS)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'estrutura-metalica-ligeira-pt',
    name: 'Estrutura metálica ligeira — pilares e vigas (por tonelada)',
    description: 'Estrutura metálica leve em perfis IPE/HEA para mezanino, cobertura ou ampliação. Fabrico + montagem.',
    country: 'PT',
    trade: 'metallerie',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: [
      { code: 'NP EN 1090-2 (2018)', title: 'Execução de estruturas de aço — classe EXC2' },
      { code: 'NP EN 1993-1-1 (Eurocódigo 3)', title: 'Projecto de estruturas de aço' },
      { code: 'NP EN 10025-2 (2019)', title: 'Aços de construção — condições técnicas S235/S275' },
    ],
    hypothesesACommuniquer: [
      'Aço S275JR (NP EN 10025-2) — perfis IPE 200-300 ou HEA 160-240',
      'Classe de execução EXC2 (edifícios correntes, NP EN 1090-2)',
      'Ligações aparafusadas classe 8.8 (ou soldadas em fábrica)',
      'Projecto estrutural obrigatório (engenheiro civil)',
      'Tratamento anti-corrosão: metalização a quente ou galvanização',
      'Protecção ao fogo (tinta intumescente) se exigido pelo SCIE',
      'Preço indicativo: base por tonelada de aço colocado',
    ],
    materials: [
      {
        id: 'perfis-ipe-hea-pt', name: 'Perfis IPE/HEA S275JR (pilares + vigas)',
        category: 'acier', phase: 'principal', quantityPerBase: 1000, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.08, wasteReason: 'Cortes, furação, desperdício de barras',
        normRef: 'NP EN 10025-2 (2019)', manufacturerRef: 'Megasa / ArcelorMittal',
      },
      {
        id: 'chapas-goussets-pt', name: 'Chapas de ligação (goussets, platines)',
        category: 'acier', phase: 'principal', quantityPerBase: 50, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Cortes, pontas irregulares',
      },
      {
        id: 'parafusos-hr-88-pt', name: 'Parafusos HR classe 8.8 + porcas + anilhas',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 60, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Reserva, substituição',
        normRef: 'NP EN 14399 (2015)',
      },
      {
        id: 'electrodos-mig-estrut-pt', name: 'Fio de soldadura MIG 0,8 mm',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.20, wasteReason: 'Pontas, projecções',
      },
      {
        id: 'chumbadouros-pt', name: 'Chumbadouros M16 + porcas (fundação)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 8, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Reserva',
      },
      {
        id: 'galvanizacao-quente-pt', name: 'Galvanização a quente (tratamento anti-corrosão)',
        category: 'peinture', phase: 'finitions', quantityPerBase: 1000, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Tratamento por imersão — sem perdas',
        notes: 'Preço por kg de aço galvanizado. Alternativa: metalização a frio + pintura.',
      },
      {
        id: 'tinta-intumescente-pt', name: 'Tinta intumescente (protecção ao fogo R30/R60)',
        category: 'peinture', phase: 'finitions', quantityPerBase: 0.5, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação pistola',
        optional: true,
        condition: 'Se exigido pelo projecto SCIE (segurança contra incêndio)',
        manufacturerRef: 'Nullifire / CIN',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  5. CORRIMÃO METÁLICO (INTERIOR/EXTERIOR)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'corrimao-metalico-pt',
    name: 'Corrimão metálico em tubo inox/aço (fixação parede)',
    description: 'Corrimão mural fixado com suportes. Tubo ∅42 mm inox 304 ou aço lacado.',
    country: 'PT',
    trade: 'metallerie',
    baseUnit: 'ml',
    geometryMode: 'length',
    version: '2.0.0',
    dtuReferences: [
      { code: 'NP EN 1090-1+A1 (2012)', title: 'Execução de estruturas de aço' },
      { code: 'RGEU art.º 58-61', title: 'Guardas e corrimãos — alturas mínimas' },
    ],
    hypothesesACommuniquer: [
      'Tubo ∅42×1,5 mm inox AISI 304 (ou aço lacado)',
      'Fixação mural com suportes a cada 80-100 cm',
      'Altura de colocação 90 cm (medida desde o focinho do degrau)',
      'Terminações curvas (cotovelos) nas extremidades',
    ],
    materials: [
      {
        id: 'tubo-42-inox-pt', name: 'Tubo ∅42×1,5 mm inox 304 (ou aço)',
        category: 'acier', phase: 'principal', quantityPerBase: 1.05, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes extremidades',
        manufacturerRef: 'Ferpinta / Inoxpar',
      },
      {
        id: 'suporte-mural-corrimao-pt', name: 'Suportes murais (1 a cada 80 cm)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 1.25, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Reserva',
      },
      {
        id: 'cotovelo-terminal-pt', name: 'Cotovelos terminais (2 por troço)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.4, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        notes: '~2 terminações por cada 5 ml',
      },
      {
        id: 'bucha-parafuso-corrimao-pt', name: 'Buchas + parafusos inox fixação',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 2.5, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Reserva (2 por suporte)',
      },
    ],
  },
]
