import type { Recipe } from '../../types'

/**
 * PISCINE & SPA — audit #28
 *
 * Référentiels FR :
 * - NF P90-308   Piscines privatives familiales
 * - NF P90-309   Sécurité piscines (dispositif obligatoire)
 * - NF EN 16713  Systèmes filtration
 * - Article L.128-1 code construction — dispositif sécurité obligatoire
 */

export const piscineRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #28.1 PISCINE COQUE POLYESTER
  // ══════════════════════════════════════════════════════════
  {
    id: 'piscine-coque-polyester',
    name: 'Piscine coque polyester 8×4 m (livrée par camion-grue)',
    description: 'Coque préfabriquée + ceinture béton + remblai + local technique + équipements filtration + sécurité.',
    trade: 'piscine',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF P90-308 (Décembre 2013)', title: 'Piscines privatives familiales' },
      { code: 'NF P90-309 (Juin 2007)', title: 'Sécurité piscines' },
      { code: 'L.128-1 code construction', title: 'Dispositif sécurité obligatoire' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      '1 unité = 1 installation piscine complète 8×4 m',
      'Coque polyester livrée par camion-grue (accès chantier nécessaire)',
      'Ceinture béton périmétrique + remblai drainant autour',
      'Local technique préfabriqué ou maçonné',
      'Plage béton périphérique (1-2 m) à prévoir séparément',
      'DISPOSITIF SÉCURITÉ OBLIGATOIRE (L.128-1) : barrière, alarme, couverture OU abri',
      'Déclaration préalable mairie obligatoire (piscine > 10 m² enterrée)',
      'Taxe foncière augmentée suite à installation',
    ],
    materials: [
      // ═══ GROS ŒUVRE ═══
      {
        id: 'coque-polyester-8-4', name: 'Coque polyester 8×4 m (livrée usine)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Waterair / Generation Piscines',
      },
      {
        id: 'ceinture-beton-piscine', name: 'Ceinture béton périmétrique (0,05 m³/ml × 24 ml = 1,2 m³)',
        category: 'liant', phase: 'preparation', quantityPerBase: 1.2, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coulage',
      },
      {
        id: 'remblai-drainant-piscine', name: 'Remblai drainant autour coque (15 m³)',
        category: 'granulat', phase: 'preparation', quantityPerBase: 15, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Compactage',
      },
      // ═══ ÉQUIPEMENTS FILTRATION ═══
      {
        id: 'pompe-filtration-piscine', name: 'Pompe filtration + pré-filtre',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        normRef: 'NF EN 16713',
      },
      {
        id: 'filtre-sable-piscine', name: 'Filtre à sable (ou cartouche)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'skimmer-piscine', name: 'Skimmers (2 u standard)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'refoulement-piscine', name: 'Buses de refoulement (2 u)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'bonde-fond-piscine', name: 'Bonde de fond',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      // ═══ ACCESSOIRES ═══
      {
        id: 'local-technique-piscine', name: 'Local technique préfabriqué (ou maçonné)',
        category: 'bloc', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'echelle-inox-piscine', name: 'Échelle inox (ou escalier intégré coque)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'projecteur-led-piscine', name: 'Projecteurs LED (2 u)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'traitement-chlore-piscine', name: 'Système traitement (chlore/brome/sel/UV)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      // ═══ SÉCURITÉ OBLIGATOIRE ═══
      {
        id: 'dispositif-securite-piscine', name: 'Dispositif sécurité OBLIGATOIRE (alarme, couverture, barrière ou abri)',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        normRef: 'NF P90-306/307/308/309 + L.128-1',
        notes: 'Choix parmi 4 options : barrière NF P90-306, alarme 307, couverture 308, abri 309.',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #28.2 PISCINE BÉTON BANCHÉ
  // ══════════════════════════════════════════════════════════
  {
    id: 'piscine-beton-banche',
    name: 'Piscine béton banché/projeté 8×4×1,50 m',
    description: 'Structure béton avec armatures bi-nappe HA12 + enduit imperméable/liner + équipements identiques.',
    trade: 'piscine',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF P90-308 (Décembre 2013)', title: 'Piscines privatives' },
      { code: 'NF DTU 43.1 (Mai 2020)', title: 'Étanchéité (référence)' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      '1 unité = piscine béton 8×4×1,50 m complète',
      'Volume béton : ~28 m³ (parois + radier)',
      'Armatures bi-nappe HA12 : ~1 t',
      'Finition : enduit imperméable OU liner armé OU carrelage + joint époxy',
      'Plus cher que coque mais sur mesure et durable',
    ],
    materials: [
      {
        id: 'beton-piscine', name: 'Béton C30/37 hydrofugé (28 m³)',
        category: 'liant', phase: 'principal', quantityPerBase: 28, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coulage',
        normRef: 'NF EN 206',
      },
      {
        id: 'armature-ha12-piscine', name: 'Armatures HA12 bi-nappe (~1 t)',
        category: 'acier', phase: 'principal', quantityPerBase: 1000, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Chutes + recouvrements',
      },
      {
        id: 'enduit-impermeable-piscine', name: 'Enduit imperméable ou liner armé',
        category: 'etancheite', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Pertes',
      },
      {
        id: 'equipements-piscine-beton', name: 'Équipements (pompe + filtre + skimmers + bonde + projecteurs)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        notes: 'Pack équipements standard piscine béton.',
      },
      {
        id: 'local-technique-piscine-beton', name: 'Local technique',
        category: 'bloc', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'dispositif-securite-piscine-beton', name: 'Dispositif sécurité OBLIGATOIRE',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        normRef: 'L.128-1 code construction',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #28.3 PISCINE BOIS / LINER
  // ══════════════════════════════════════════════════════════
  {
    id: 'piscine-bois-liner',
    name: 'Piscine bois en kit + liner (6×3 m, semi-enterrée)',
    description: 'Kit bois pré-monté Nortland / Gardipool + liner 75/100. Solution économique et esthétique.',
    trade: 'piscine',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF P90-308 (Décembre 2013)', title: 'Piscines privatives' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      '1 unité = kit bois 6×3 m complet + liner',
      'Structure bois classe 4 autoclave',
      'Liner armé 75/100 (résistance)',
      'Filtration simple intégrée (ou sépara selon modèle)',
      'Pose semi-enterrée ou hors-sol selon terrain',
      'Dispositif sécurité IDEM (L.128-1)',
    ],
    materials: [
      {
        id: 'kit-piscine-bois', name: 'Kit bois piscine 6×3 m (préfa usine)',
        category: 'bois', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Nortland / Gardipool',
      },
      {
        id: 'liner-75-100', name: 'Liner armé 75/100 mm',
        category: 'etancheite', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sur mesure',
      },
      {
        id: 'filtration-integree-piscine-bois', name: 'Filtration intégrée (pompe + filtre)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'dispositif-securite-piscine-bois', name: 'Dispositif sécurité OBLIGATOIRE',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        normRef: 'L.128-1 code construction',
      },
    ],
  },
]
