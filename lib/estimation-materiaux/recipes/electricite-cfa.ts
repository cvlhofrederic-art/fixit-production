import type { Recipe } from '../types'

/**
 * ÉLECTRICITÉ COURANTS FAIBLES (CFA) — audit #22
 *
 * Référentiels FR :
 * - NF EN 50173-1   Câblage informatique structuré
 * - NF C 15-100 §771.5  Précâblage informatique obligatoire logement neuf
 * - NF C 15-100 §521.9  Cohabitation CFO/CFA
 * - RE2T           Certification sécurité alarme type 2
 */

export const electriciteCfaRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #22.1 CÂBLAGE RJ45 (réseau informatique structuré)
  // ══════════════════════════════════════════════════════════
  {
    id: 'cfa-rj45-cat6a',
    name: 'Câblage RJ45 cat 6a (par prise réseau)',
    description: '1 prise RJ45 cat 6a = 15 ml câble + prise murale + patch + cordon. Baie brassage mutualisée.',
    trade: 'electricite_cfa',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF EN 50173-1', title: 'Câblage informatique structuré (classe E min)' },
      { code: 'NF C 15-100 §771.5', title: 'Précâblage obligatoire logement neuf' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      '1 unité = 1 prise RJ45 installée (estimation 15 ml câble par prise vers baie)',
      'Câble U/FTP cat 6a (classe E+, 500 MHz, 10 Gbit/s)',
      'Alternative cat 7 si très haut débit futur-proof',
      'Baie brassage 9U ou 12U mutualisée (amortie sur 8 prises)',
      'Patch panel 24 ports (amortissement sur nb prises)',
      'Cordons brassage 2 m (1 par prise vers switch)',
      'Switch/routeur non inclus (équipement actif à part)',
    ],
    materials: [
      {
        id: 'cable-utp-cat6a', name: 'Câble U/FTP cat 6a (bobine 305 m)',
        category: 'plaque', phase: 'principal', quantityPerBase: 16.5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + dénudage',
        normRef: 'NF EN 50173-1',
        manufacturerRef: 'Nexans / Legrand / Belden',
        packaging: { unit: 'rouleau', contentQty: 305, contentUnit: 'ml', label: 'bobine 305 m' },
      },
      {
        id: 'prise-rj45-murale', name: 'Prise RJ45 murale (mécanisme + plaque)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Legrand Mosaic / Schneider Odace',
      },
      {
        id: 'patch-panel-port', name: 'Patch panel (port 1/24 mutualisé)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 0.04, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        notes: '1 patch panel 24 ports amorti sur 24 prises = 0,042/prise.',
      },
      {
        id: 'cordon-brassage-rj45', name: 'Cordon de brassage 2 m (vers switch)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'baie-brassage-9u', name: 'Baie brassage 9U (mutualisée 8 prises)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 0.125, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        notes: '1 baie par 8 prises = 0,125/prise.',
      },
      {
        id: 'gaine-icta-cfa', name: 'Gaine ICTA Ø20 (protection câble)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 15, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #22.2 COAXIAL / FIBRE OPTIQUE
  // ══════════════════════════════════════════════════════════
  {
    id: 'cfa-coax-fibre',
    name: 'Câblage TV coaxial + arrivée fibre optique',
    description: 'Câble coaxial 17 VAtC (satellite/TNT) + prise murale TV. Boîtier PTO fibre + cordon monomode.',
    trade: 'electricite_cfa',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF EN 50173-1', title: 'Câblage structuré' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      '1 unité = 1 prise TV coaxiale (estimation 15 ml câble par prise)',
      'Câble coaxial 17 VAtC (satellite/TNT pro)',
      'Alternative : câble 19 VAtC haute qualité',
      'Répartiteur/amplificateur selon nb prises',
      'PTO fibre (opérateur) : 1 u par logement',
      'Cordon optique monomode (SC/APC) pour raccordement box',
    ],
    materials: [
      {
        id: 'cable-coaxial-17vatc', name: 'Câble coaxial 17 VAtC',
        category: 'plaque', phase: 'principal', quantityPerBase: 15, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'prise-tv-coax', name: 'Prise TV coaxiale murale',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'repartiteur-tv', name: 'Répartiteur/amplificateur TV (mutualisé)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.25, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        notes: '1 répartiteur pour ~4 prises.',
      },
      {
        id: 'pto-fibre-optique', name: 'Point de terminaison optique (PTO) fibre',
        category: 'accessoire', phase: 'principal', quantityPerBase: 0.25, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        notes: '1 PTO par logement (amorti sur ~4 prises TV).',
      },
      {
        id: 'cordon-fibre-optique', name: 'Cordon optique monomode SC/APC',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.25, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #22.3 SYSTÈME ALARME ANTI-INTRUSION
  // ══════════════════════════════════════════════════════════
  {
    id: 'alarme-anti-intrusion',
    name: 'Système alarme anti-intrusion (T3 standard)',
    description: 'Centrale + 4 détecteurs mouvement IR + 3 détecteurs ouverture + clavier + 2 télécommandes + sirènes + module GSM.',
    trade: 'electricite_cfa',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'RE2T', title: 'Certification sécurité alarme type 2' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      '1 unité = 1 installation alarme T3 complète',
      'Technologie : filaire (bus) ou radio (sans fil — plus rapide à poser)',
      '4 DIR (détecteurs mouvement) + 3 DO (ouvertures protégées)',
      '2 télécommandes livrées standard',
      'Sirène intérieure (dissuasion) + extérieure (alerte voisinage)',
      'Module GSM pour alertes téléphoniques',
      'Autocollants dissuasion visibles extérieur',
    ],
    materials: [
      {
        id: 'centrale-alarme', name: 'Centrale alarme + sirène intégrée',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Ajax / Diagral / Somfy Protexiom',
      },
      {
        id: 'detecteur-mouvement-ir', name: 'Détecteurs de mouvement IR',
        category: 'accessoire', phase: 'principal', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'detecteur-ouverture', name: 'Détecteurs d\'ouverture (portes/fenêtres)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'clavier-alarme', name: 'Clavier de commande',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'telecommande-alarme', name: 'Télécommandes (2 u standard)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'sirene-exterieure', name: 'Sirène extérieure',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'module-gsm-alarme', name: 'Module GSM (alertes téléphoniques)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'batterie-secours-alarme', name: 'Batterie de secours (en cas coupure 230 V)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'autocollant-dissuasion', name: 'Autocollants dissuasion (extérieur)',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #22.4 VIDÉOSURVEILLANCE IP
  // ══════════════════════════════════════════════════════════
  {
    id: 'videosurveillance-ip',
    name: 'Vidéosurveillance IP (4 caméras + NVR + disque)',
    description: 'Caméras IP PoE filaires + enregistreur NVR 8 canaux + disque 2-4 To + switch PoE.',
    trade: 'electricite_cfa',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF EN 50173-1', title: 'Câblage cat 6 min' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      '1 unité = 1 système 4 caméras complet',
      'Caméras IP PoE (alimentation par le câble Ethernet — un seul fil)',
      'Alternative WiFi (moins fiable, préférer filaire)',
      'NVR 8 canaux (capacité extension future)',
      'Disque dur 2 To = ~2 semaines 24/7 en 1080p',
      'Switch PoE (si NVR n\'a pas les ports PoE intégrés)',
      'Supports muraux caméras + raccords étanches extérieur',
    ],
    materials: [
      {
        id: 'camera-ip-poe', name: 'Caméras IP PoE (HD/4K)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Dahua / Hikvision / Reolink',
      },
      {
        id: 'nvr-8-canaux', name: 'NVR 8 canaux (enregistreur)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'disque-dur-2to', name: 'Disque dur 2 To (stockage vidéo)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Seagate Skyhawk / WD Purple',
      },
      {
        id: 'cable-ethernet-cat6-poe', name: 'Câbles Ethernet cat 6 (caméras → NVR)',
        category: 'plaque', phase: 'principal', quantityPerBase: 60, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        notes: '15 ml par caméra × 4 caméras = 60 ml.',
      },
      {
        id: 'switch-poe', name: 'Switch PoE (si NVR sans PoE)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        optional: true,
        condition: 'Si NVR sans ports PoE intégrés',
      },
      {
        id: 'support-mural-camera', name: 'Supports muraux caméras + raccords étanches',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit',
      },
    ],
  },
]
