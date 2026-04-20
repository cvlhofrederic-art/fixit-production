import type { Recipe } from '../types'

/**
 * MENUISERIES EXTÉRIEURES — audit #12
 *
 * Référentiel FR : NF DTU 36.5 — Mise en œuvre fenêtres et portes
 *                  extérieures (tous matériaux : PVC, alu, bois, mixte)
 *
 * Référentiels PT : NP EN 14351-1 (fenêtres) + NP EN 14351-2 (portes)
 *                   REH (DL 101-D/2020) pour performance énergétique
 *
 * Règle critique NF DTU 36.5 §5.7 :
 *   - Fixation par COLLE SEULE, MOUSSE SEULE ou CLOUS : INTERDITE
 *   - OBLIGATOIRE : chevilles mécaniques M10 (PVC) ou M12 (alu, porte lourde)
 *
 * baseUnit: 'u' pour toutes les recettes (compter par menuiserie).
 * Hypothèse périmètre : fenêtre standard 120×120 = périmètre 4,80 m.
 */

export const menuiseriesExtRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #12.1 FENÊTRE PVC
  // ══════════════════════════════════════════════════════════
  {
    id: 'menuiserie-fenetre-pvc',
    name: 'Fenêtre PVC (dormant + ouvrant + vitrage inclus)',
    description: 'Fenêtre PVC 2 vantaux avec vitrage double 4/16/4 inclus. Pose applique avec calfeutrement étanchéité NF DTU 36.5.',
    trade: 'menuiserie_ext',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 36.5', title: 'Mise en œuvre fenêtres et portes extérieures' },
      { code: 'NF EN 14351-1', title: 'Spécifications fenêtres et portes extérieures' },
      { code: 'RE2020', title: 'Performance Uw ≤ 1,3 W/m²K' },
    ],
    version: '2.1.0',
    constraints: {
      note: 'Ratios pour fenêtre standard 120×120 cm (périmètre 4,8 m). Pour dimensions atypiques, adapter manuellement.',
    },
    hypothesesACommuniquer: [
      'Fenêtre standard 120×120 cm (périmètre 4,80 m) — adapter si atypique',
      'Vitrage double 4/16/4 Argon inclus dans le bloc-fenêtre',
      'Bande compribande OBLIGATOIRE pour étanchéité air/eau (NF DTU 36.5 §6.2.3)',
      'Fixation CHEVILLES MÉCANIQUES M10 — la pose à la colle ou mousse seule est INTERDITE',
      'Appui fenêtre (PVC / marbre / béton préfa) inclus pour pose neuf',
      'Bavette alu anti-pluie obligatoire en rejet d\'eau extérieur',
      'Précadre PVC ou alu optionnel pour pose applique sur tableau existant',
    ],
    materials: [
      // ═══ PRINCIPAL ═══
      {
        id: 'bloc-fenetre-pvc', name: 'Bloc-fenêtre PVC 120×120 (2 vantaux, vitrage double 4/16/4)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sur mesure, pas de perte',
        dtu: 'NF DTU 36.5', normRef: 'NF EN 14351-1',
        manufacturerRef: 'Schuco / Veka / Rehau / Aluplast / K-Line PVC',
      },
      // ═══ PRÉPARATION ═══
      {
        id: 'bande-compribande', name: 'Bande compribande (étanchéité air/eau)',
        category: 'joint', phase: 'preparation', quantityPerBase: 5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
        dtu: 'NF DTU 36.5 §6.2.3',
        manufacturerRef: 'Illbruck TP600 / Tremco iCA',
        packaging: { unit: 'rouleau', contentQty: 8, contentUnit: 'ml', label: 'rouleau 8 ml' },
        notes: 'Périmètre fenêtre × 1,05 = 5 ml.',
      },
      {
        id: 'precadre-fenetre', name: 'Précadre PVC ou alu (si pose applique)',
        category: 'ossature', phase: 'preparation', quantityPerBase: 5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
        manufacturerRef: 'KSM / Wurth',
        optional: true,
        condition: 'Si pose applique sur tableau existant (rénovation)',
      },
      // ═══ ACCESSOIRES ═══
      {
        id: 'mousse-pu-menuiserie', name: 'Mousse PU expansive (remplissage joint calfeutrement)',
        category: 'adjuvant', phase: 'accessoires', quantityPerBase: 1.5, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Gâchage perdu',
        manufacturerRef: 'Illbruck FM330 / Sika Boom',
        packaging: { unit: 'cartouche', contentQty: 0.75, contentUnit: 'L', label: 'cartouche 750 ml' },
      },
      {
        id: 'mastic-silicone-menuiserie', name: 'Mastic silicone/MS polymère (joint final extérieur)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 0.3, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purge cartouche',
        manufacturerRef: 'Sika 11FC / Bostik H995',
        packaging: { unit: 'cartouche', contentQty: 0.31, contentUnit: 'L', label: 'cartouche 310 ml' },
      },
      {
        id: 'cheville-mecanique-m10', name: 'Chevilles mécaniques M10 (fixation cadre)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 10, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse',
        dtu: 'NF DTU 36.5 §5.7',
        notes: '1 cheville tous 50 cm × périmètre 4,80 m = 10 u. Fixation m\u00e9canique OBLIGATOIRE.',
      },
      {
        id: 'appui-fenetre', name: 'Appui de fenêtre (PVC / marbre / béton préfa)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1.3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 36.5 §7',
        notes: 'Largeur 1,20 m + débord 5 cm chaque côté = 1,30 ml.',
      },
      {
        id: 'bavette-alu-rejet-eau', name: 'Bavette alu anti-pluie (rejet d\'eau extérieur)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1.25, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
        manufacturerRef: 'Weser / Aluplast',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #12.2 FENÊTRE ALUMINIUM
  // ══════════════════════════════════════════════════════════
  {
    id: 'menuiserie-fenetre-alu',
    name: 'Fenêtre aluminium (rupture pont thermique)',
    description: 'Fenêtre alu à rupture de pont thermique, vitrage triple 4/18/4/18/4 Argon. Uw ≤ 1,4 W/m²K (RE2020).',
    trade: 'menuiserie_ext',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 36.5', title: 'Mise en œuvre fenêtres et portes extérieures' },
      { code: 'NF EN 14351-1', title: 'Spécifications fenêtres et portes extérieures' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Fenêtre alu RPT avec vitrage triple (performance RE2020)',
      'Plus lourde que PVC → chevilles M12 (vs M10 PVC)',
      'Prix 1,5 à 2× supérieur au PVC',
      'Mêmes accessoires (compribande, mousse PU, mastic) que PVC',
      'Seuil alu à rupture pont thermique si porte-fenêtre',
    ],
    materials: [
      {
        id: 'bloc-fenetre-alu', name: 'Bloc-fenêtre alu RPT 120×120 (vitrage triple)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sur mesure',
        dtu: 'NF DTU 36.5', normRef: 'NF EN 14351-1',
        manufacturerRef: 'Schuco / Technal / Installux / K-Line alu',
      },
      {
        id: 'bande-compribande', name: 'Bande compribande',
        category: 'joint', phase: 'preparation', quantityPerBase: 5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes', dtu: 'NF DTU 36.5 §6.2.3',
        packaging: { unit: 'rouleau', contentQty: 8, contentUnit: 'ml', label: 'rouleau 8 ml' },
      },
      {
        id: 'mousse-pu-menuiserie', name: 'Mousse PU',
        category: 'adjuvant', phase: 'accessoires', quantityPerBase: 1.5, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Gâchage',
        packaging: { unit: 'cartouche', contentQty: 0.75, contentUnit: 'L', label: 'cartouche 750 ml' },
      },
      {
        id: 'mastic-silicone-menuiserie', name: 'Mastic silicone/MS polymère',
        category: 'joint', phase: 'accessoires', quantityPerBase: 0.3, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purge',
        packaging: { unit: 'cartouche', contentQty: 0.31, contentUnit: 'L', label: 'cartouche 310 ml' },
      },
      {
        id: 'cheville-mecanique-m12', name: 'Chevilles mécaniques M12 (fenêtre alu plus lourde)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 10, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse',
        dtu: 'NF DTU 36.5 §5.7',
      },
      {
        id: 'appui-fenetre', name: 'Appui de fenêtre',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1.3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'bavette-alu-rejet-eau', name: 'Bavette alu anti-pluie',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1.25, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #12.3 FENÊTRE BOIS
  // ══════════════════════════════════════════════════════════
  {
    id: 'menuiserie-fenetre-bois',
    name: 'Fenêtre bois (classe 3 minimum, essence noble)',
    description: 'Fenêtre bois pin/chêne/mélèze, traitement fongicide/insecticide usine, à refinir sur chantier (lasure).',
    trade: 'menuiserie_ext',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 36.5', title: 'Fenêtres/portes extérieures' },
      { code: 'NF EN 14351-1', title: 'Spécifications' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Bois classe 3 minimum (contact humidité occasionnelle)',
      'Traitement fongicide/insecticide inclus usine',
      'Essences courantes : pin traité (économique), chêne (premium), mélèze (durable)',
      'Lasure 2 couches à prévoir séparément (trade peinture)',
      'Entretien tous les 5 ans obligatoire (lasure + traitement)',
    ],
    materials: [
      {
        id: 'bloc-fenetre-bois', name: 'Bloc-fenêtre bois 120×120 (classe 3, vitrage double)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sur mesure',
        dtu: 'NF DTU 36.5',
        manufacturerRef: 'Lorenove / Minco / Gimm / Alabert',
      },
      {
        id: 'bande-compribande', name: 'Bande compribande',
        category: 'joint', phase: 'preparation', quantityPerBase: 5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes', dtu: 'NF DTU 36.5 §6.2.3',
        packaging: { unit: 'rouleau', contentQty: 8, contentUnit: 'ml', label: 'rouleau 8 ml' },
      },
      {
        id: 'mousse-pu-menuiserie', name: 'Mousse PU',
        category: 'adjuvant', phase: 'accessoires', quantityPerBase: 1.5, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Gâchage',
        packaging: { unit: 'cartouche', contentQty: 0.75, contentUnit: 'L', label: 'cartouche 750 ml' },
      },
      {
        id: 'mastic-silicone-menuiserie', name: 'Mastic silicone',
        category: 'joint', phase: 'accessoires', quantityPerBase: 0.3, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purge',
        packaging: { unit: 'cartouche', contentQty: 0.31, contentUnit: 'L', label: 'cartouche 310 ml' },
      },
      {
        id: 'cheville-mecanique-m10', name: 'Chevilles M10',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 10, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse', dtu: 'NF DTU 36.5 §5.7',
      },
      {
        id: 'appui-fenetre', name: 'Appui de fenêtre',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1.3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'bavette-alu-rejet-eau', name: 'Bavette alu rejet d\'eau',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1.25, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #12.4 PORTE D'ENTRÉE
  // ══════════════════════════════════════════════════════════
  {
    id: 'menuiserie-porte-entree',
    name: 'Porte d\'entrée (bloc-porte + seuil alu + serrure multipoints)',
    description: 'Bloc-porte complet (dormant + vantail + serrure multipoints + seuil alu RPT).',
    trade: 'menuiserie_ext',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 36.5', title: 'Fenêtres et portes extérieures' },
      { code: 'NF EN 14351-1', title: 'Spécifications portes' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Bloc-porte PVC, alu, bois, composite ou acier selon gamme',
      'Serrure multipoints A2P standard — A2P* ou ** pour sécurité renforcée',
      'Seuil alu à rupture pont thermique (accessibilité PMR réglementaire)',
      'Chevilles M12 obligatoires (poids supérieur aux fenêtres)',
      'Ferme-porte conseillé (obligatoire ERP)',
      'Cylindre sécurisé optionnel (A2P* si assurance vol renforcée)',
    ],
    materials: [
      {
        id: 'bloc-porte-entree', name: 'Bloc-porte d\'entrée (dormant + vantail + serrure)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sur mesure',
        dtu: 'NF DTU 36.5',
        manufacturerRef: 'Bel\'m / Solabaie / Corvino / K-Line',
      },
      {
        id: 'seuil-alu-rpt-porte', name: 'Seuil aluminium RPT (rupture pont thermique)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sur mesure',
      },
      {
        id: 'bande-compribande', name: 'Bande compribande',
        category: 'joint', phase: 'preparation', quantityPerBase: 6, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes', dtu: 'NF DTU 36.5 §6.2.3',
      },
      {
        id: 'mousse-pu-menuiserie', name: 'Mousse PU',
        category: 'adjuvant', phase: 'accessoires', quantityPerBase: 2, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Gâchage',
        packaging: { unit: 'cartouche', contentQty: 0.75, contentUnit: 'L', label: 'cartouche 750 ml' },
      },
      {
        id: 'mastic-silicone-menuiserie', name: 'Mastic silicone',
        category: 'joint', phase: 'accessoires', quantityPerBase: 0.4, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purge',
        packaging: { unit: 'cartouche', contentQty: 0.31, contentUnit: 'L', label: 'cartouche 310 ml' },
      },
      {
        id: 'cheville-mecanique-m12-porte', name: 'Chevilles M12 porte (plus lourde)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 6, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse',
        dtu: 'NF DTU 36.5 §5.7',
      },
      {
        id: 'cylindre-securise-a2p', name: 'Cylindre sécurisé A2P* (sécurité renforcée)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Vachette / Bricard / Picard',
        optional: true,
        condition: 'Si assurance vol renforcée ou exposition élevée (rez-de-chaussée, immeuble)',
      },
      {
        id: 'ferme-porte-hydraulique', name: 'Ferme-porte hydraulique (accessibilité)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        optional: true,
        condition: 'Obligatoire ERP / fortement recommandé accessibilité PMR',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #12.5 PORTE DE GARAGE (sectionnelle motorisée)
  // ══════════════════════════════════════════════════════════
  {
    id: 'menuiserie-porte-garage-sectionnelle',
    name: 'Porte de garage sectionnelle motorisée',
    description: 'Porte sectionnelle 2,40×2,10 m motorisée (le plus courant). Panneaux isolés 40 mm, rails plafond, motorisation + cellules sécurité obligatoires.',
    trade: 'menuiserie_ext',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF EN 13241', title: 'Performance portes industrielles/garage' },
      { code: 'NF DTU 36.5', title: 'Principes pose menuiseries ext.' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Porte sectionnelle 2,40×2,10 m (format standard) — motorisée',
      'Panneaux isolés 40 mm (performance thermique)',
      'Cellules sécurité photoélectriques OBLIGATOIRES pour motorisation automatique (NF EN 13241)',
      '2 télécommandes livrées standard',
      'Alternatives : basculante (manuelle), enroulable (coffre linteau), battante (2 vantaux)',
    ],
    materials: [
      {
        id: 'porte-garage-sectionnelle', name: 'Porte garage sectionnelle 2,40×2,10 (panneaux isolés 40 mm)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sur mesure',
        normRef: 'NF EN 13241',
        manufacturerRef: 'Hörmann / Novoferm / Wayne Dalton',
      },
      {
        id: 'rails-alu-porte-garage', name: 'Rails alu plafond + patins plastique',
        category: 'ossature', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sur mesure (kit)',
      },
      {
        id: 'motorisation-porte-garage', name: 'Motorisation tubulaire + chariot (Somfy / Hörmann / Came)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Somfy / Hörmann / Came',
      },
      {
        id: 'telecommande-porte', name: 'Télécommandes (2 u standard)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'cellules-photoelectriques', name: 'Cellules photoélectriques (sécurité OBLIGATOIRE)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        normRef: 'NF EN 13241',
      },
      {
        id: 'joint-bas-porte-garage', name: 'Joint bas d\'étanchéité (sol)',
        category: 'joint', phase: 'finitions', quantityPerBase: 1, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'vis-fixation-porte-garage', name: 'Vis + chevilles fixation rails',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit inclus',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #12.6 VOLETS ROULANTS
  // ══════════════════════════════════════════════════════════
  {
    id: 'menuiserie-volet-roulant-elec',
    name: 'Volet roulant électrique (tablier alu + coffre + moteur)',
    description: 'Volet roulant alu lames 37 mm, coffre extérieur, motorisation filaire Somfy. 1 u par fenêtre.',
    trade: 'menuiserie_ext',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF EN 13659', title: 'Performance volets' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Tablier alu lames 37 mm (standard) ou 55 mm (isolation renforcée)',
      'Coffre : extérieur (renovation), intérieur (neuf), ou bloc baie intégré',
      'Motorisation Somfy Oximo filaire — alternative radio (sans fil)',
      'Coulisses alu + joint',
      'Telecommande sur demande (option domotique)',
    ],
    materials: [
      {
        id: 'tablier-volet-alu', name: 'Tablier volet alu lames 37 mm',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sur mesure',
        manufacturerRef: 'Profalux / Somfy / Bubendorff',
      },
      {
        id: 'coffre-volet', name: 'Coffre volet roulant (extérieur)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sur mesure',
      },
      {
        id: 'moteur-volet-filaire', name: 'Moteur tubulaire filaire Somfy Oximo',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Somfy Oximo / Bubendorff',
      },
      {
        id: 'coulisse-alu-volet', name: 'Coulisses alu + joint brosse',
        category: 'ossature', phase: 'principal', quantityPerBase: 2, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
      },
      {
        id: 'corniere-finition-volet', name: 'Cornière de finition + mousse raccord coffre/mur',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Ajustements',
      },
      {
        id: 'inter-filaire-volet', name: 'Inverseur mural ou télécommande',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #12.7 PORTAIL BATTANT MOTORISÉ
  // ══════════════════════════════════════════════════════════
  {
    id: 'menuiserie-portail-battant-motorise',
    name: 'Portail battant 2 vantaux motorisé (alu ou acier)',
    description: 'Portail alu ou acier 3 m × 1,50 m, motorisé à bras Came/Nice/Faac. 2 poteaux scellés + photocellules + feu clignotant + digicode.',
    trade: 'menuiserie_ext',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [{ code: 'NF EN 13241', title: 'Performance portails' }],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Portail 3 m × 1,50 m — 2 vantaux battants (alu premium, acier standard)',
      'Motorisation à bras ou à vérins (Came, Nice, Faac)',
      '2 poteaux alu/acier + scellement béton 0,3 m³/poteau (0,6 m³ total)',
      'Photocellules + feu clignotant OBLIGATOIRES (NF EN 13241)',
      'Digicode + 2 télécommandes livrées standard',
      'Câblage 230 V à faire par électricien (trade #21)',
    ],
    materials: [
      {
        id: 'portail-battant-2-vantaux', name: 'Portail battant 2 vantaux (3 m × 1,50 m)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sur mesure',
        normRef: 'NF EN 13241',
        manufacturerRef: 'Cadiou Industrie / Charuel / Portalp',
      },
      {
        id: 'motorisation-portail-bras', name: 'Motorisation à bras (Came / Nice / Faac)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Came / Nice / Faac',
      },
      {
        id: 'poteau-portail', name: 'Poteaux portail (2 u alu/acier)',
        category: 'ossature', phase: 'principal', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sur mesure',
      },
      {
        id: 'beton-scellement-portail', name: 'Béton scellement poteaux (C25/30)',
        category: 'liant', phase: 'preparation', quantityPerBase: 0.6, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coulage',
        normRef: 'NF EN 206',
        notes: '0,3 m³ par poteau × 2 poteaux = 0,6 m³.',
      },
      {
        id: 'photocellules-portail', name: 'Photocellules (sécurité OBLIGATOIRE)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        normRef: 'NF EN 13241',
      },
      {
        id: 'feu-clignotant-portail', name: 'Feu clignotant orange (signalisation OBLIGATOIRE)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'digicode-portail', name: 'Digicode + 2 télécommandes',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'butoir-portail', name: 'Butoirs de portail + gâches réglables',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit',
      },
    ],
  },
]
