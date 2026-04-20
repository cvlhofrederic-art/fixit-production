import type { Recipe } from '../../types'
import { ptRefs } from '../../data/pt/standards'

/**
 * PINTURA — recetas PT (Lot F).
 *
 * 3 obras pintura correntes :
 *  1. Pintura interior paredes (tinta aquosa 2 demãos)
 *  2. Pintura exterior fachada (tinta pliolite / acrílica 2 demãos)
 *  3. Verniz interior para madeira
 *
 * Referências : NP EN 1062-1.
 * Fabricantes : Robbialac, CIN, Barbot.
 */

export const pinturaRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════════
  //  1. PINTURA INTERIOR PAREDES
  // ══════════════════════════════════════════════════════════════
  {
    id: 'pintura-interior-paredes-pt',
    name: 'Pintura interior paredes (tinta aquosa, 2 demãos)',
    description: 'Pintura aquosa branca standard sobre parede rebocada ou pladur: primário + 2 demãos acabamento.',
    country: 'PT',
    trade: 'peinture',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: ptRefs('pintura_interior'),
    hypothesesACommuniquer: [
      'Suporte: parede rebocada ou pladur com juntas feitas',
      'Primário fixador sempre recomendado (tapa-poros)',
      'Rendimento tinta: 10-12 m²/L por demão (2 demãos)',
      'Acabamento mate ou acetinado',
      'Tinta aquosa (baixa COV, Classe A+)',
    ],
    materials: [
      {
        id: 'primario-fixador-pt', name: 'Primário fixador aquoso',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.1, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Aplicação rolo',
        manufacturerRef: 'Robbialac (Fixador) / CIN (Acricryl Primário)',
        packaging: { unit: 'pot', contentQty: 5, contentUnit: 'L', label: 'lata 5 L' },
      },
      {
        id: 'tinta-aquosa-interior-pt', name: 'Tinta aquosa interior branca mate (2 demãos)',
        category: 'peinture', phase: 'principal', quantityPerBase: 0.18, unit: 'L',
        geometryMultiplier: 'coats',
        wasteFactor: 1.08, wasteReason: 'Respingos, resíduos rolo',
        normRef: 'NP EN 1062-1 (2004)', manufacturerRef: 'Robbialac Solar / CIN Novatrato / Barbot Viva',
        packaging: { unit: 'pot', contentQty: 15, contentUnit: 'L', label: 'lata 15 L' },
      },
      {
        id: 'massa-reparacao-pt', name: 'Massa de reparação (buracos, fissuras)',
        category: 'enduit', phase: 'preparation', quantityPerBase: 0.05, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Secagem, resíduos',
        manufacturerRef: 'Robbialac / Sika',
      },
      {
        id: 'lixa-suporte-pt', name: 'Lixa papel grão 120 (lixar reparações)',
        category: 'outillage', phase: 'preparation', quantityPerBase: 0.05, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Desgaste',
      },
      {
        id: 'fita-pintor-pt', name: 'Fita de pintor (proteção)',
        category: 'outillage', phase: 'accessoires', quantityPerBase: 0.15, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  2. PINTURA EXTERIOR FACHADA
  // ══════════════════════════════════════════════════════════════
  {
    id: 'pintura-exterior-fachada-pt',
    name: 'Pintura exterior fachada (tinta pliolite, 2 demãos)',
    description: 'Pintura fachada exterior: tinta pliolite ou acrílica 100% hidrorrepelente, 2 demãos + primário.',
    country: 'PT',
    trade: 'peinture',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: ptRefs('pintura_interior'),
    hypothesesACommuniquer: [
      'Suporte: reboco curado > 28 dias',
      'Limpeza prévia + tratamento musgos/algas (se necessário)',
      'Primário consolidante anti-alcalino',
      'Tinta pliolite ou acrílica de alta resistência raios UV',
      'Cobertura 6-8 m²/L (2 demãos)',
      'Temperatura aplicação: 5-35 °C',
    ],
    materials: [
      {
        id: 'tratamento-algas-pt', name: 'Tratamento anti-musgos (lavagem pré-pintura)',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.15, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Pulverização',
        manufacturerRef: 'CIN Algicin / Robbialac Permatex Fungicida',
        optional: true, condition: 'Aplicar se fachada com manchas orgânicas',
      },
      {
        id: 'primario-consolidante-ext-pt', name: 'Primário consolidante exterior',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.15, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Aplicação',
        manufacturerRef: 'CIN / Robbialac',
        packaging: { unit: 'pot', contentQty: 5, contentUnit: 'L', label: 'lata 5 L' },
      },
      {
        id: 'tinta-pliolite-ext-pt', name: 'Tinta pliolite exterior (2 demãos)',
        category: 'peinture', phase: 'principal', quantityPerBase: 0.16, unit: 'L',
        geometryMultiplier: 'coats',
        wasteFactor: 1.10, wasteReason: 'Pulverização/rolo exterior',
        normRef: 'NP EN 1062-1 (2004)',
        manufacturerRef: 'Robbialac Permatex / CIN Cinolite / Barbot Protex',
        packaging: { unit: 'pot', contentQty: 15, contentUnit: 'L', label: 'lata 15 L' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  3. VERNIZ INTERIOR MADEIRA
  // ══════════════════════════════════════════════════════════════
  {
    id: 'verniz-interior-madeira-pt',
    name: 'Verniz interior madeira (pavimento/portas, 3 demãos)',
    description: 'Verniz acabamento mate/acetinado/brilho para madeira interior: lixagem + 3 demãos verniz poliuretano.',
    country: 'PT',
    trade: 'peinture',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: ptRefs('pintura_interior'),
    hypothesesACommuniquer: [
      'Suporte: madeira seca (< 12% humidade)',
      'Lixagem prévia grão 120 → 180',
      'Verniz poliuretano aquoso (baixa COV)',
      '3 demãos recomendadas em pavimento (alta circulação)',
      'Acabamento mate / acetinado / brilhante',
    ],
    materials: [
      {
        id: 'lixa-madeira-pt', name: 'Lixa papel grão 120 / 180',
        category: 'outillage', phase: 'preparation', quantityPerBase: 0.3, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.20, wasteReason: 'Desgaste rápido',
      },
      {
        id: 'verniz-poli-madeira-pt', name: 'Verniz poliuretano aquoso madeira',
        category: 'peinture', phase: 'principal', quantityPerBase: 0.08, unit: 'L',
        geometryMultiplier: 'coats',
        wasteFactor: 1.10, wasteReason: 'Aplicação pincel/rolo',
        manufacturerRef: 'CIN Hidroval / Robbialac Aquaglace',
        packaging: { unit: 'pot', contentQty: 5, contentUnit: 'L', label: 'lata 5 L' },
      },
      {
        id: 'panos-limpeza-pt', name: 'Panos de limpeza (pré-aplicação)',
        category: 'outillage', phase: 'preparation', quantityPerBase: 0.1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pano padrão',
      },
    ],
  },
]
