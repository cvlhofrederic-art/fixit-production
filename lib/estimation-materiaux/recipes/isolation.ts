import type { Recipe } from '../types'

/**
 * ISOLATION THERMIQUE — audit #10
 *
 * Référentiels FR :
 * - NF DTU 45.1   Isolation combles aménagés
 * - NF DTU 45.10  Isolation combles perdus (soufflage)
 * - NF DTU 45.4   Isolation des murs par l'intérieur (doublage)
 * - NF DTU 45.11  Isolation toitures inclinées type sarking
 * - NF DTU 41.2   Bardage rapporté (ITE avec bardage)
 * - RE2020        Performance thermique (R > 3 m²K/W murs, > 6 combles)
 *
 * Référentiel PT : REH (DL 101-D/2020)
 */

export const isolationRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #10.1 ITE SOUS ENDUIT (PSE gris 120 mm collé-chevillé)
  // ══════════════════════════════════════════════════════════
  {
    id: 'ite-pse-sous-enduit',
    name: 'ITE — PSE gris 120 mm sous enduit mince',
    description: 'Isolation thermique extérieure : collage PSE + chevillage + armature + enduit fin. Performance R ≈ 3,8.',
    trade: 'isolation',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'Cahier CSTB 3035', title: 'ITE sous enduit mince' },
      { code: 'NF DTU 45.4', title: 'Isolation intérieure (référence)' },
      { code: 'RE2020', title: 'Performance thermique R > 3' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'PSE gris Th38 120 mm (R = 3,16) — alternative laine rigide',
      'Collage au MAP + chevillage mécanique complémentaire (6 chevilles/m² — Cahier CSTB 3035)',
      'Rail de départ alu en pied de façade (protection + alignement)',
      'Armature treillis fibre de verre dans sous-enduit',
      'Enduit de finition grain fin 1 mm (hydraulique ou pâteux)',
      'Profils d\'angle PVC/alu avec treillis intégré',
    ],
    materials: [
      // ═══ PRÉPARATION ═══
      {
        id: 'primaire-accrochage-ite', name: 'Primaire d\'accrochage (si support absorbant)',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.15, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac + rouleau',
        manufacturerRef: 'Weber Prim / Parex',
        optional: true,
        condition: 'Si support faiblement absorbant (crépi ancien, brique non enduite)',
      },
      {
        id: 'rail-depart-alu-ite', name: 'Rail de départ alu (pied de façade)',
        category: 'ossature', phase: 'preparation', quantityPerBase: 0.25, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        manufacturerRef: 'Weber / Parex / PRB',
        notes: '1 ml rail tous 4 m² de façade typique.',
      },
      // ═══ PRINCIPAL ═══
      {
        id: 'pse-gris-120', name: 'Panneau PSE gris 120 mm (R = 3,16)',
        category: 'isolant', phase: 'principal', quantityPerBase: 1.05, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Découpes',
        dtu: 'Cahier CSTB 3035',
        manufacturerRef: 'Knauf Therm ITEx Ultra / Efisol',
        packaging: { unit: 'u', contentQty: 2.4, contentUnit: 'm2', label: 'paquet 2 panneaux 1,20×0,60 m' },
      },
      {
        id: 'mortier-colle-ite', name: 'Mortier colle ITE (MAP)',
        category: 'colle', phase: 'principal', quantityPerBase: 5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Résidus',
        manufacturerRef: 'Weber Therm ITE XM / Parex',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      // ═══ ACCESSOIRES ═══
      {
        id: 'cheville-pse-ite', name: 'Chevilles à frapper PSE (fixation mécanique)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 6, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Casse',
        dtu: 'Cahier CSTB 3035',
        manufacturerRef: 'Ejot STR / Fischer Termoz',
      },
      {
        id: 'treillis-armature-ite', name: 'Treillis armature fibre de verre',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 1.15, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Recouvrements 10 cm',
      },
      {
        id: 'sous-enduit-mortier-arme', name: 'Sous-enduit / mortier armé (marouflage)',
        category: 'enduit', phase: 'principal', quantityPerBase: 4, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Résidus',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'primaire-regulateur-ite', name: 'Primaire régulateur (avant finition)',
        category: 'primaire', phase: 'principal', quantityPerBase: 0.12, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac',
      },
      // ═══ FINITIONS ═══
      {
        id: 'enduit-finition-ite', name: 'Enduit de finition grain fin (1 mm)',
        category: 'enduit', phase: 'finitions', quantityPerBase: 3, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Taloche',
        manufacturerRef: 'Weber.monorex ITE',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'profil-angle-ite', name: 'Profils d\'angle PVC/alu (avec treillis intégré)',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 0.2, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #10.3 ISOLATION COMBLES PERDUS (SOUFFLAGE)
  // ══════════════════════════════════════════════════════════
  {
    id: 'iso-combles-perdus-soufflage',
    name: 'Isolation combles perdus par soufflage (laine minérale 350 mm)',
    description: 'Soufflage laine minérale 350 mm pour R > 7 m²K/W (RE2020). Pare-vapeur + déflecteurs.',
    trade: 'isolation',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 45.10', title: 'Isolation combles perdus par soufflage' },
      { code: 'RE2020', title: 'R > 7 m²K/W' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Laine minérale soufflée 350-400 mm (R > 7 m²K/W — obligatoire RE2020)',
      'Densité 14 kg/m³ → 4,9 kg/m² pour 350 mm',
      'Pare-vapeur obligatoire côté chaud (sous combles habitables) — DTU 45.10 §5.4',
      'Alternative : ouate de cellulose (densité 35 kg/m³ → 12 kg/m²)',
      'Déflecteurs aux entrées d\'air (éviter d\'obturer la ventilation rampants)',
      'Piquets de contrôle épaisseur (1 tous 20 m²)',
      'Capot isolé trappe accès OBLIGATOIRE (pertes thermiques)',
    ],
    materials: [
      // ═══ PRÉPARATION ═══
      {
        id: 'pare-vapeur-combles', name: 'Pare-vapeur (côté chaud)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements',
        dtu: 'NF DTU 45.10 §5.4',
        manufacturerRef: 'Siga Majpell / Isover Vario Duplex',
        optional: true,
        condition: 'Si combles habitables en-dessous (RE2020 obligatoire)',
      },
      {
        id: 'deflecteur-entree-air', name: 'Déflecteurs aux entrées d\'air (sur chevrons)',
        category: 'accessoire', phase: 'preparation', quantityPerBase: 0.1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF DTU 40.29',
        notes: '1 déflecteur/chevron à l\'égout.',
      },
      // ═══ PRINCIPAL ═══
      {
        id: 'laine-minerale-soufflee', name: 'Laine minérale soufflée (350 mm, densité 14 kg/m³)',
        category: 'isolant', phase: 'principal', quantityPerBase: 4.9, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Pertes soufflage',
        dtu: 'NF DTU 45.10',
        manufacturerRef: 'Isover Comblissimo / Ursa Silver Hub',
        packaging: { unit: 'sac', contentQty: 14, contentUnit: 'kg', label: 'sac 14 kg' },
      },
      // ═══ ACCESSOIRES ═══
      {
        id: 'piquet-controle-epaisseur', name: 'Piquets contrôle épaisseur (1/20 m²)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.05, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'capot-isolation-trappe', name: 'Capot isolation trappe d\'accès',
        category: 'isolant', phase: 'finitions', quantityPerBase: 0.01, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        notes: '1 capot par maison (amortie sur toute la surface).',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #10.4 ISOLATION COMBLES AMÉNAGÉS / RAMPANTS
  // ══════════════════════════════════════════════════════════
  {
    id: 'iso-combles-amenages',
    name: 'Isolation combles aménagés (bi-couche laine 200+100 mm rampant)',
    description: 'Double couche croisée laine 200+100 mm entre chevrons + sous-face BA13. R > 6,5 (RE2020).',
    trade: 'isolation',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 45.1', title: 'Isolation combles aménagés' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      '2 couches laine minérale croisées : 200 mm (entre chevrons) + 100 mm (sous chevrons)',
      'Total 300 mm → R ≈ 7,5 m²K/W (bien au-delà RE2020)',
      'Écran sous-toiture HPV (si charpente neuve — sinon pré-installé)',
      'Pare-vapeur côté chaud obligatoire',
      'Suspentes + fourrures F530 pour finition plafond BA13 (vs cloison latérale)',
    ],
    materials: [
      {
        id: 'ecran-sous-toit-hpv-iso', name: 'Écran sous-toiture HPV (si neuf)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements',
        dtu: 'NF DTU 40.29',
        optional: true,
        condition: 'Si charpente neuve sans écran pré-installé',
      },
      {
        id: 'pare-vapeur-combles-iso', name: 'Pare-vapeur (côté chaud)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements',
        dtu: 'NF DTU 45.1',
      },
      {
        id: 'laine-200-combles', name: 'Laine minérale 200 mm (1ère couche entre chevrons)',
        category: 'isolant', phase: 'principal', quantityPerBase: 1.05, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Découpes',
        dtu: 'NF DTU 45.1', manufacturerRef: 'Isover GR32 200 mm',
      },
      {
        id: 'laine-100-combles', name: 'Laine minérale 100 mm (2ème couche croisée)',
        category: 'isolant', phase: 'principal', quantityPerBase: 1.05, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Découpes',
        dtu: 'NF DTU 45.1',
      },
      {
        id: 'suspente-f530-combles', name: 'Suspentes F530 (fixation plafond)',
        category: 'fixation', phase: 'principal', quantityPerBase: 5, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Casse',
      },
      {
        id: 'fourrure-f530-combles', name: 'Fourrures F530 (entraxe 60 cm)',
        category: 'ossature', phase: 'principal', quantityPerBase: 1.67, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'plaque-ba13-combles', name: 'Plaque BA13 (face intérieure plafond)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1.05, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Découpes',
      },
      {
        id: 'bande-adhesive-pare-vapeur', name: 'Bande adhésive étanchéité à l\'air',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.2, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        manufacturerRef: 'Siga Sicrall / Isover Vario KB1',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #10.5 SARKING (isolation sur chevrons)
  // ══════════════════════════════════════════════════════════
  {
    id: 'iso-sarking',
    name: 'Sarking — isolation par-dessus chevrons (PIR 120 mm)',
    description: 'Isolation continue par-dessus la charpente (absence de pont thermique). Contre-liteaux + liteaux en surimpression.',
    trade: 'isolation',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 45.11', title: 'Isolation supports discontinus par-dessus' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'PIR ou PUR 120 mm par-dessus chevrons → R ≈ 5,5',
      'Pare-vapeur côté intérieur (entre chevrons et panneaux)',
      'Contre-liteaux + liteaux en surimpression (longueur vis adaptée)',
      'Vis longues traversent tout le complexe (120+40+27 = 187 mm min)',
      'Alternative à l\'isolation sous rampants (meilleure performance thermique)',
    ],
    materials: [
      {
        id: 'pare-vapeur-sarking', name: 'Pare-vapeur (côté intérieur)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements',
      },
      {
        id: 'pir-120-sarking', name: 'Panneau PIR 120 mm',
        category: 'isolant', phase: 'principal', quantityPerBase: 1.05, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Découpes',
        dtu: 'NF DTU 45.11',
        manufacturerRef: 'Efisol / Recticel / Utherm',
      },
      {
        id: 'contre-liteau-sarking', name: 'Contre-liteaux 27×40 (surimpression)',
        category: 'bois', phase: 'principal', quantityPerBase: 1.67, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'liteau-sarking', name: 'Liteaux 27×38 (sur contre-liteaux)',
        category: 'bois', phase: 'principal', quantityPerBase: 2.85, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'vis-longues-sarking', name: 'Vis longues spéciales sarking (> 200 mm)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
    ],
  },
]
