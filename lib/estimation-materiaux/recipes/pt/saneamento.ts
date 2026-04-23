import type { Recipe } from '../../types'
import { ptRefs } from '../../data/pt/standards'

/**
 * SANEAMENTO — recetas PT (escritas à mão, pt-PT).
 *
 * 4 obras de saneamento / drenagem :
 *  1. Fossa séptica (u)
 *  2. Rede de drenagem pluvial (ml)
 *  3. Rede de esgoto doméstico (ml)
 *  4. Caixa de visita (u)
 *
 * Referências : NP EN 12056, NP EN 1917, RGSPPDADAR, NP EN 1329-1.
 * Fabricantes : Amiblu PT, Politejo, Fersil, Cimpor.
 */

export const saneamentoRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════════
  //  1. FOSSA SÉPTICA (instalação completa)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'fossa-septica-pt',
    name: 'Fossa séptica 3 000 L (habitação T3 — 5 HE)',
    description: 'Fossa séptica pré-fabricada em betão ou PEAD, com poço absorvente e ventilação. Solução para zonas sem rede pública.',
    country: 'PT',
    trade: 'assainissement',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: ptRefs('drenagem_predial', 'rgsppdadar'),
    hypothesesACommuniquer: [
      'Fossa 3 000 L para habitação T3 (5 habitantes equivalentes)',
      'Solo permeável pressuposto (poço absorvente viável)',
      'Distância mínima 5 m da habitação e 20 m de captações (RGSPPDADAR)',
      'Ventilação primária obrigatória (tubo PVC ∅110 até cobertura)',
      'Limpeza periódica (18-24 meses) por empresa credenciada',
      'Licenciamento camarário obrigatório',
    ],
    materials: [
      {
        id: 'fossa-septica-3000-pt', name: 'Fossa séptica 3 000 L (betão ou PEAD)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
        normRef: 'NP EN 12566-1 (2004)',
        manufacturerRef: 'Amiblu PT / Politejo',
      },
      {
        id: 'tubo-pvc-110-fossa-pt', name: 'Tubo PVC rígido ∅110 (ligação fossa)',
        category: 'plaque', phase: 'principal', quantityPerBase: 12, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
        normRef: 'NP EN 1329-1 (2014)',
      },
      {
        id: 'brita-fossa-pt', name: 'Brita 20/40 (cama e envolvimento)',
        category: 'granulat', phase: 'preparation', quantityPerBase: 3, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Compactação',
      },
      {
        id: 'geotextil-fossa-pt', name: 'Geotêxtil 200 g/m² (separação)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 12, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposição',
      },
      {
        id: 'poco-absorvente-pt', name: 'Anéis betão poço absorvente ∅1000 (3 anéis)',
        category: 'bloc', phase: 'principal', quantityPerBase: 3, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
        normRef: 'NP EN 1917 (2004)',
      },
      {
        id: 'ventilacao-pvc-110-pt', name: 'Tubo PVC ∅110 ventilação (chaminé)',
        category: 'plaque', phase: 'accessoires', quantityPerBase: 6, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
      },
      {
        id: 'tampao-ferro-fossa-pt', name: 'Tampão ferro fundido ∅600 (acesso fossa)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  2. REDE DE DRENAGEM PLUVIAL
  // ══════════════════════════════════════════════════════════════
  {
    id: 'drenagem-pluvial-pt',
    name: 'Rede de drenagem pluvial enterrada (∅160 PVC)',
    description: 'Canalização enterrada para recolha de águas pluviais: tubo PVC ∅160, caixas de recepção e ligação à rede municipal.',
    country: 'PT',
    trade: 'assainissement',
    baseUnit: 'ml',
    geometryMode: 'length',
    version: '2.0.0',
    dtuReferences: ptRefs('drenagem_predial', 'rgsppdadar', 'tubagens_pvc_evacuacao'),
    hypothesesACommuniquer: [
      'Tubo PVC rígido ∅160 SN4 (rigidez anelar mín. 4 kN/m²)',
      'Pendente mínima 1% (RGSPPDADAR)',
      'Cama de areia 10 cm + recobrimento 10 cm',
      'Fita sinalizadora obrigatória',
      'Caixa de recepção a cada 15 m ou mudança de direção',
      'Ligação à rede municipal sujeita a autorização camarária',
    ],
    materials: [
      {
        id: 'tubo-pvc-160-pluvial-pt', name: 'Tubo PVC rígido ∅160 SN4',
        category: 'plaque', phase: 'principal', quantityPerBase: 1, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes, uniões',
        normRef: 'NP EN 1401-1 (2009)',
        manufacturerRef: 'Politejo / Fersil',
      },
      {
        id: 'areia-cama-pluvial-pt', name: 'Areia 0/4 (cama + recobrimento)',
        category: 'granulat', phase: 'preparation', quantityPerBase: 0.08, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manuseamento',
      },
      {
        id: 'fita-sinalizadora-pluvial-pt', name: 'Fita sinalizadora azul (águas pluviais)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
      },
      {
        id: 'caixa-recepcao-pluvial-pt', name: 'Caixa de recepção PVC 30×30 (c/ grelha)',
        category: 'bloc', phase: 'principal', quantityPerBase: 0.07, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
        notes: '1 caixa a cada ~15 m (0,07/ml)',
      },
      {
        id: 'curvas-tes-pluvial-pt', name: 'Curvas e tês PVC ∅160 (acessórios)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.15, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Rejeições',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  3. REDE DE ESGOTO DOMÉSTICO
  // ══════════════════════════════════════════════════════════════
  {
    id: 'esgoto-domestico-pt',
    name: 'Rede de esgoto doméstico enterrada (∅125 PVC)',
    description: 'Canalização de águas residuais domésticas: tubo PVC ∅125, caixas de visita e ligação ao coletor público.',
    country: 'PT',
    trade: 'assainissement',
    baseUnit: 'ml',
    geometryMode: 'length',
    version: '2.0.0',
    dtuReferences: ptRefs('drenagem_predial', 'rgsppdadar', 'tubagens_pvc_evacuacao'),
    hypothesesACommuniquer: [
      'Tubo PVC rígido ∅125 SN4 (águas residuais domésticas)',
      'Pendente mínima 2% para ∅125 (RGSPPDADAR)',
      'Separação obrigatória pluviais/domésticas (sistema separativo)',
      'Sifão de pavimento nas instalações sanitárias (EN 12056)',
      'Cama de areia 10 cm + recobrimento 15 cm',
      'Fita sinalizadora castanha obrigatória',
    ],
    materials: [
      {
        id: 'tubo-pvc-125-esgoto-pt', name: 'Tubo PVC rígido ∅125 SN4',
        category: 'plaque', phase: 'principal', quantityPerBase: 1, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes, uniões',
        normRef: 'NP EN 1329-1 (2014)',
        manufacturerRef: 'Politejo / Fersil',
      },
      {
        id: 'areia-cama-esgoto-pt', name: 'Areia 0/4 (cama + recobrimento)',
        category: 'granulat', phase: 'preparation', quantityPerBase: 0.07, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manuseamento',
      },
      {
        id: 'fita-sinalizadora-esgoto-pt', name: 'Fita sinalizadora castanha (esgoto)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
      },
      {
        id: 'curvas-tes-esgoto-pt', name: 'Curvas e tês PVC ∅125',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.2, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Rejeições',
      },
      {
        id: 'cola-pvc-esgoto-pt', name: 'Cola PVC (uniões coladas)',
        category: 'adjuvant', phase: 'accessoires', quantityPerBase: 0.01, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  4. CAIXA DE VISITA
  // ══════════════════════════════════════════════════════════════
  {
    id: 'caixa-visita-pt',
    name: 'Caixa de visita em betão pré-fabricado ∅600',
    description: 'Caixa de visita pré-fabricada em betão para inspeção e manutenção de redes de drenagem.',
    country: 'PT',
    trade: 'assainissement',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: ptRefs('caixas_visita', 'rgsppdadar'),
    hypothesesACommuniquer: [
      'Caixa pré-fabricada betão ∅600 mm (profundidade até 1,50 m)',
      'Base com caleira direccional moldada',
      'Tampão ferro fundido classe B125 (passagem pedonal) ou D400 (viário)',
      'Argamassa de selagem das uniões (M10)',
      'Obrigatória em mudanças de direção, confluências e cada 30 m máximo',
      'Profundidade mín. 0,80 m (cobertura de terras)',
    ],
    materials: [
      {
        id: 'corpo-cx-visita-pt', name: 'Corpo caixa visita betão ∅600 (pré-fabricado)',
        category: 'bloc', phase: 'principal', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
        normRef: 'NP EN 1917 (2004)',
        manufacturerRef: 'Amiblu PT / Cimpor Pré-Fabricados',
      },
      {
        id: 'cone-reducao-cx-pt', name: 'Cone de redução betão ∅600→∅400',
        category: 'bloc', phase: 'principal', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
      },
      {
        id: 'tampao-ff-b125-pt', name: 'Tampão ferro fundido ∅400 classe B125',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
        normRef: 'NP EN 124-2 (2015)',
      },
      {
        id: 'argamassa-selagem-cx-pt', name: 'Argamassa de selagem M10',
        category: 'enduit', phase: 'principal', quantityPerBase: 10, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Resíduos',
        normRef: 'NP EN 998-2 (2017)',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'brita-fundo-cx-pt', name: 'Brita 20/40 (fundo compactado, 15 cm)',
        category: 'granulat', phase: 'preparation', quantityPerBase: 0.10, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Compactação',
      },
      {
        id: 'degraus-ferro-cx-pt', name: 'Degraus de acesso ferro galvanizado',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 3, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
        notes: 'Obrigatórios para profundidade > 1,00 m',
        optional: true,
        condition: 'Se profundidade superior a 1,00 m',
      },
    ],
  },
]
