import type { Recipe } from '../../types'
import { ptRefs } from '../../data/pt/standards'

/**
 * CARPINTARIA — recetas PT (Lot Menuiserie — escritas à mão, pt-PT).
 *
 * 5 obras de carpintaria / caixilharia portuguesa corrente :
 *  1. Porta interior completa (bloco-porta) (u)
 *  2. Porta exterior de segurança (u)
 *  3. Caixilharia PVC / alumínio (janela oscilo-batente) (u)
 *  4. Armário embutido 2 portas de correr (u)
 *  5. Rodapé MDF / madeira (ml)
 *
 * Referências : NP EN 14351-1+A2 (janelas/portas), NP EN 942 (madeira),
 *               Marcação CE, RGEU.
 * Fabricantes : Vicaima, Extrusal, Sosoares, Jular.
 */

export const carpintariaRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════════
  //  1. PORTA INTERIOR COMPLETA (BLOCO-PORTA)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'porta-interior-pt',
    name: 'Porta interior completa (bloco-porta + ferragens)',
    description: 'Bloco-porta pré-montado: aro + folha 80×204 cm + fechadura + dobradiças + puxadores + batente.',
    country: 'PT',
    trade: 'menuiserie',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('caixilharia', 'rgeu'),
      { code: 'NP EN 942 (2007)', title: 'Madeira para caixilharia — classificação da qualidade' },
      { code: 'Marcação CE', title: 'Regulamento (UE) n.º 305/2011 — Produtos de construção' },
    ],
    hypothesesACommuniquer: [
      'Bloco-porta standard 80×204 cm (adaptar se atípico)',
      'Folha em MDF lacado / madeira maciça / melamina conforme orçamento',
      'Fechadura tipo trinco (quarto) — fechadura com chave para WC/casa de banho',
      '3 dobradiças de embutir (standard Vicaima)',
      'Afinação com calços de madeira + espuma PU',
      'Guarnição de aro (alizares) incluída',
    ],
    materials: [
      {
        id: 'bloco-porta-int-pt', name: 'Bloco-porta completo (aro + folha + vedação)',
        category: 'bois', phase: 'principal', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas (unidade)',
        normRef: 'NP EN 14351-1+A2 (2016)', manufacturerRef: 'Vicaima / Portas Luso',
      },
      {
        id: 'fechadura-trinco-pt', name: 'Fechadura de trinco + cilindro',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
      {
        id: 'dobradica-embutir-pt', name: 'Dobradiças de embutir (3 u standard)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 3, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
      {
        id: 'puxador-porta-pt', name: 'Puxadores (2 × manípulo)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 2, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
      {
        id: 'batente-mural-pt', name: 'Batente mural (anti-choque)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
      {
        id: 'espuma-pu-porta-pt', name: 'Espuma PU + calços de madeira (afinação)',
        category: 'adjuvant', phase: 'accessoires', quantityPerBase: 0.5, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purga cartucho',
        packaging: { unit: 'cartouche', contentQty: 0.75, contentUnit: 'L', label: 'cartucho 750 ml' },
      },
      {
        id: 'alizar-aro-pt', name: 'Guarnição aro (alizares madeira/MDF)',
        category: 'bois', phase: 'finitions', quantityPerBase: 5, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes em ângulo',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  2. PORTA EXTERIOR DE SEGURANÇA
  // ══════════════════════════════════════════════════════════════
  {
    id: 'porta-exterior-seguranca-pt',
    name: 'Porta exterior de segurança (blindada classe 3)',
    description: 'Porta de entrada blindada com aro reforçado, fechadura de segurança multiponto, olho mágico, vedação.',
    country: 'PT',
    trade: 'menuiserie',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('caixilharia', 'rgeu'),
      { code: 'NP EN 1627 (2011)', title: 'Portas — resistência à efração — classificação' },
      { code: 'Marcação CE', title: 'Regulamento (UE) n.º 305/2011' },
    ],
    hypothesesACommuniquer: [
      'Porta blindada classe 3 (RC3) — residencial standard',
      'Dimensão 90×205 cm (adaptar se atípico)',
      'Fechadura multiponto (3 ou 5 pontos) com cilindro europeu anti-bumping',
      'Aro metálico reforçado com garra de ancoragem',
      'Acabamento exterior: painel alumínio / madeira segundo gosto',
      'Isolamento acústico e térmico integrado na folha',
    ],
    materials: [
      {
        id: 'porta-blindada-rc3-pt', name: 'Porta blindada completa RC3 (aro + folha + vedação)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas (unidade)',
        normRef: 'NP EN 1627 (2011)', manufacturerRef: 'Vicaima Portaro / Dierre',
      },
      {
        id: 'fechadura-multiponto-pt', name: 'Fechadura multiponto 5 pontos + cilindro europeu',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Incluída no kit porta',
        manufacturerRef: 'Mottura / ISEO',
      },
      {
        id: 'puxador-ext-pt', name: 'Puxador exterior + interior',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 2, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
      {
        id: 'olho-magico-pt', name: 'Olho mágico (visor angular)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
      {
        id: 'silicone-aro-ext-pt', name: 'Silicone de vedação (junção aro/parede)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 0.3, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purga cartucho',
        packaging: { unit: 'cartouche', contentQty: 0.28, contentUnit: 'L', label: 'cartucho 280 ml' },
      },
      {
        id: 'bucha-metalica-aro-pt', name: 'Buchas metálicas fixação aro (8 u)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 8, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Reserva',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  3. CAIXILHARIA PVC / ALUMÍNIO (JANELA OSCILO-BATENTE)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'caixilharia-pvc-alu-pt',
    name: 'Caixilharia PVC/alumínio — janela oscilo-batente 120×140',
    description: 'Janela oscilo-batente 2 folhas, vidro duplo, com estores e peitoril. Instalação completa.',
    country: 'PT',
    trade: 'menuiserie',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('caixilharia', 'reh', 'rgeu'),
      { code: 'NP EN 14351-1+A2 (2016)', title: 'Janelas e portas exteriores — norma de produto' },
    ],
    hypothesesACommuniquer: [
      'Caixilho PVC ou alumínio com corte térmico (RPT)',
      'Dimensão standard 120×140 cm (2 folhas oscilo-batente)',
      'Vidro duplo 4/16/4 mm com gás árgon (Uw ≤ 1,4 W/m²K conforme REH)',
      'Estore de alumínio térmico incluído (caixa + lâminas)',
      'Peitoril em pedra ou alumínio NÃO incluído',
      'Vedação perimetral com espuma PU + silicone exterior',
      'Fabricante nacional: Extrusal (alumínio) ou Sosoares (PVC)',
    ],
    materials: [
      {
        id: 'caixilho-pvc-alu-pt', name: 'Caixilho PVC/alumínio RPT completo (aro + folhas + vidro)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Fabricação à medida',
        normRef: 'NP EN 14351-1+A2 (2016)', manufacturerRef: 'Extrusal / Sosoares / Cortizo',
      },
      {
        id: 'vidro-duplo-4-16-4-pt', name: 'Vidro duplo 4/16/4 mm gás árgon',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Corte à medida em fábrica',
        normRef: 'NP EN 1279-1 (2018)',
      },
      {
        id: 'estore-aluminio-pt', name: 'Estore alumínio térmico (caixa + lâminas + fita)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit completo',
        manufacturerRef: 'Gaviota / Extrusal',
      },
      {
        id: 'espuma-pu-caixilho-pt', name: 'Espuma PU expansiva (vedação aro/parede)',
        category: 'adjuvant', phase: 'accessoires', quantityPerBase: 0.75, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purga cartucho',
        packaging: { unit: 'cartouche', contentQty: 0.75, contentUnit: 'L', label: 'cartucho 750 ml' },
      },
      {
        id: 'silicone-ext-caixilho-pt', name: 'Silicone exterior (vedação perimetral)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 0.3, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purga cartucho',
        packaging: { unit: 'cartouche', contentQty: 0.28, contentUnit: 'L', label: 'cartucho 280 ml' },
      },
      {
        id: 'bucha-parafuso-caixilho-pt', name: 'Buchas + parafusos fixação aro (6 u)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 6, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Reserva',
      },
      {
        id: 'forra-interior-caixilho-pt', name: 'Forra interior (guarnição aro em MDF/alumínio)',
        category: 'bois', phase: 'finitions', quantityPerBase: 4, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes em ângulo',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  4. ARMÁRIO EMBUTIDO 2 PORTAS DE CORRER
  // ══════════════════════════════════════════════════════════════
  {
    id: 'armario-embutido-2-correr-pt',
    name: 'Armário embutido 2 portas de correr (2 m largura)',
    description: 'Armário integrado com portas de correr espelho/madeira/vidro. Calha superior/inferior + organização interior.',
    country: 'PT',
    trade: 'menuiserie',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('rgeu'),
      { code: 'NP EN 942 (2007)', title: 'Madeira para caixilharia — classificação da qualidade' },
    ],
    hypothesesACommuniquer: [
      'Armário 2 folhas de correr × 1 m (largura total 2 m standard)',
      'Alternativa 3 folhas para largura 2,40 m',
      'Calha superior + inferior obrigatórias + guias plásticas',
      'Organização interior: 1 prateleira + 1 varão de cabides mínimo',
      'Profundidade 60 cm standard (adaptar se atípico)',
    ],
    materials: [
      {
        id: 'porta-correr-armario-pt', name: 'Portas de correr (2 folhas, espelho/madeira/melamina)',
        category: 'bois', phase: 'principal', quantityPerBase: 2, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Fabricação à medida',
        manufacturerRef: 'Jular / AKI / IKEA PT',
      },
      {
        id: 'calha-armario-pt', name: 'Calha superior + inferior + guias (kit)',
        category: 'ossature', phase: 'principal', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit completo',
      },
      {
        id: 'painel-separacao-pt', name: 'Painéis separação interior (prateleiras melamina)',
        category: 'bois', phase: 'principal', quantityPerBase: 3, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes ajuste',
      },
      {
        id: 'varao-cabides-pt', name: 'Varão de cabides + suportes',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
      {
        id: 'rodizio-puxador-armario-pt', name: 'Rodízios + puxadores embutidos',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit completo',
      },
      {
        id: 'parafusos-buchas-armario-pt', name: 'Parafusos + buchas fixação estrutura',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 12, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Reserva',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  5. RODAPÉ MDF / MADEIRA
  // ══════════════════════════════════════════════════════════════
  {
    id: 'rodape-mdf-madeira-pt',
    name: 'Rodapé MDF ou madeira (perímetro divisão)',
    description: 'Rodapé compatível com pavimento. Fixação colada + pregada. Altura 6-10 cm.',
    country: 'PT',
    trade: 'menuiserie',
    baseUnit: 'ml',
    geometryMode: 'length',
    version: '2.0.0',
    dtuReferences: ptRefs('rgeu'),
    hypothesesACommuniquer: [
      'Rodapé MDF ou madeira maciça (altura 6-10 cm)',
      'Fixação: cola polímero + pregos sem cabeça',
      'Cantos interiores e exteriores cortados a 45° em obra',
    ],
    materials: [
      {
        id: 'rodape-mdf-pt', name: 'Rodapé MDF / madeira maciça',
        category: 'bois', phase: 'principal', quantityPerBase: 1.10, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes em ângulo',
        manufacturerRef: 'Jular / Leroy Merlin PT',
      },
      {
        id: 'cola-polimero-rodape-pt', name: 'Cola polímero (fixação)',
        category: 'colle', phase: 'accessoires', quantityPerBase: 0.03, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purga cartucho',
      },
      {
        id: 'prego-sem-cabeca-rodape-pt', name: 'Pregos sem cabeça',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 2, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perdas',
      },
    ],
  },
]
