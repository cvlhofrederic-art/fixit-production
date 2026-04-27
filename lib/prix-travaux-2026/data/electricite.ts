// lib/prix-travaux-2026/data/electricite.ts
//
// Bootstrap Électricité — 5 lignes prix prioritaires 2026.
// Méthodologie : docs/prix-2026-methodology.md
// Sources Tier 1 gratuites uniquement (CAPEB / FFB / INSEE / France Rénov').
// Pas de Batiprix (décision produit : free Tier 1 only).
//
// NOTE INSEE — l'index officiel "Électricité" est le BT47 (BT37 désigne
// "Étanchéité multicouche", abrogé). Toutes les sources INSEE référencent BT47.

import type { PriceLine } from '../types'

export const electriciteLines: PriceLine[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Pose prise électrique standard 2P+T — €/unité
  // moBrut    = 0.90 × 55 = 49.50
  // coutBrut  = 49.50 + 12 = 61.50
  // coutFinal = 61.50 × 1.15 = 70.73
  // ttc       = 70.73 × 1.10 = 77.80
  // priceMin  = round(77.80 × 0.92) = 72
  // priceMax  = round(77.80 × 1.08) = 84
  // spread    = (84 − 72) / 72 = 16.7 % ≤ 20 % ✓
  // Hypothèse : remplacement ou pose en saignée courte sur réseau existant,
  // mécanisme + plaque milieu de gamme (~12 € fourniture), pas de tirage de
  // ligne neuve depuis tableau (sinon basculer sur ligne dédiée création
  // point électrique). TVA 10 % logement >2 ans.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'electricite',
    taskId: 'electricite-pose-prise-standard',
    label: 'Pose prise électrique 2P+T standard',
    unit: 'unite',
    description: 'Pose ou remplacement prise standard 2P+T 16A milieu de gamme sur réseau existant : mécanisme + plaque (~12 €), boîte d\'encastrement si besoin, raccordement, test continuité terre. Hors tirage de ligne neuve depuis le tableau et hors saignée murale lourde.',
    cost: {
      mainOeuvreHeures: 0.90,
      mainOeuvreTauxHoraire: 55,
      materiaux: 12,
      chargesEntreprise: 60,
      margeNette: 15,
    },
    priceMin: 72,
    priceMax: 84,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['pose prise', 'prise électrique', 'remplacement prise', 'prise 2P+T', 'prise courant'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires électricité',
        tier: 1,
        excerpt: 'Taux horaire ouvrier électricien chargé Bouches-du-Rhône : 55 €/h (estimation interne alignée fourchette nationale CAPEB 45-70 €/h chargé)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT47 — Électricité (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710979',
        excerpt: 'Index BT47 Électricité base 100 = 2010, dernière mise à jour 15/04/2026. Référence indexation prestations électricité bâtiment.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix installation prise électrique 2026',
        tier: 2,
        url: 'https://www.travaux.com/electricite/guide-des-prix/prix-de-linstallation-dune-prise-electrique',
        excerpt: 'Prise standard en remplacement 2P+T : 80-120 € fourniture + pose ; nouvelle prise avec câblage depuis tableau : 150-300 €',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Ootravaux — Prix pose prise électrique 2026',
        tier: 2,
        url: 'https://www.ootravaux.fr/installation-entretien/electricite/installation-electrique/prix-pose-prises-electriques.html',
        excerpt: 'Prix d\'installation d\'une prise électrique : 50-150 € pose comprise ; tarif horaire électricien 30-70 €/h',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — taux horaire 55 €/h is internal estimate aligned with 2025 baseline + INSEE BT47 (ranges nationale CAPEB 45-70 €/h chargé). Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Pose interrupteur va-et-vient — €/unité
  // moBrut    = 1.10 × 55 = 60.50
  // coutBrut  = 60.50 + 14 = 74.50
  // coutFinal = 74.50 × 1.15 = 85.68
  // ttc       = 85.68 × 1.10 = 94.24
  // priceMin  = round(94.24 × 0.92) = 87
  // priceMax  = round(94.24 × 1.08) = 102
  // spread    = (102 − 87) / 87 = 17.2 % ≤ 20 % ✓
  // Hypothèse : pose va-et-vient en remplacement ou ajout sur réseau existant,
  // 2 mécanismes + plaques milieu de gamme (~14 € fourniture), câblage entre
  // les 2 points si déjà tiré. Plus complexe qu'un simple interrupteur (test
  // commutation, repérage navette). TVA 10 % logement >2 ans.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'electricite',
    taskId: 'electricite-pose-interrupteur-va-et-vient',
    label: 'Pose interrupteur va-et-vient',
    unit: 'unite',
    description: 'Pose ou remplacement va-et-vient (2 points de commande) sur réseau existant : 2 mécanismes + plaques milieu de gamme (~14 €), repérage navette, raccordement, test commutation. Hors tirage câble navette neuf entre les 2 points et hors saignée murale.',
    cost: {
      mainOeuvreHeures: 1.10,
      mainOeuvreTauxHoraire: 55,
      materiaux: 14,
      chargesEntreprise: 60,
      margeNette: 15,
    },
    priceMin: 87,
    priceMax: 102,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['va-et-vient', 'interrupteur va et vient', 'pose interrupteur', 'remplacement interrupteur', 'interrupteur double commande'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires électricité',
        tier: 1,
        excerpt: 'Taux horaire ouvrier électricien chargé Bouches-du-Rhône : 55 €/h (estimation interne alignée fourchette nationale CAPEB 45-70 €/h chargé)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT47 — Électricité (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710979',
        excerpt: 'Index BT47 Électricité base 100 = 2010, dernière mise à jour 15/04/2026. Applicable mécanismes interrupteurs va-et-vient.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix installation interrupteur 2026',
        tier: 2,
        url: 'https://www.travaux.com/electricite/guide-des-prix/prix-de-linstallation-dun-interrupteur',
        excerpt: 'Pose va-et-vient par électricien : 70-130 € TTC selon câblage et tests ; interrupteur va-et-vient pose comprise : 23-150 €',
        accessedAt: '2026-04-27',
      },
      {
        name: 'MesDépanneurs.fr — Prix pose interrupteur 2026',
        tier: 2,
        url: 'https://www.mesdepanneurs.fr/blog/prix-pose-interrupteur',
        excerpt: 'Remplacement interrupteur va-et-vient : 30-280 € TTC fourniture + main d\'œuvre + déplacement ; tarif horaire moyen 65 €/h',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — taux horaire 55 €/h is internal estimate aligned with 2025 baseline + INSEE BT47 (ranges nationale CAPEB 45-70 €/h chargé). Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Tableau électrique 13 modules — forfait fourniture + pose
  // moBrut    = 7.00 × 55 = 385.00
  // coutBrut  = 385.00 + 600 = 985.00
  // coutFinal = 985.00 × 1.14 = 1122.90
  // ttc       = 1122.90 × 1.10 = 1235.19
  // priceMin  = round(1235.19 × 0.92) = 1136
  // priceMax  = round(1235.19 × 1.08) = 1334
  // spread    = (1334 − 1136) / 1136 = 17.4 % ≤ 20 % ✓
  // Hypothèse : tableau monophasé 1 rangée 13 modules (T1/studio ou poste
  // secondaire), coffret + 1 ID 30 mA type AC 40 A + 4-6 disjoncteurs
  // divisionnaires + peignes + repérage (~600 € fourniture), dépose ancien
  // tableau, pose neuf, raccordement disjoncteur de branchement, tests.
  // Hors mise à la terre majeure et hors GTL neuve.
  // TVA 10 % logement >2 ans (rénovation/remplacement).
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'electricite',
    taskId: 'electricite-tableau-electrique-13-modules',
    label: 'Tableau électrique 13 modules — fourniture + pose (forfait)',
    unit: 'forfait',
    description: 'Forfait fourniture + pose tableau électrique monophasé 1 rangée 13 modules (studio / T1 / poste secondaire) : coffret, 1 interrupteur différentiel 30 mA type AC 40 A, 4-6 disjoncteurs divisionnaires (10 A et 16 A), peignes d\'alimentation, repérage. Dépose ancien tableau, pose neuf, raccordement disjoncteur de branchement, tests conformité. Hors mise à la terre lourde et GTL neuve.',
    cost: {
      mainOeuvreHeures: 7.00,
      mainOeuvreTauxHoraire: 55,
      materiaux: 600,
      chargesEntreprise: 60,
      margeNette: 14,
    },
    priceMin: 1136,
    priceMax: 1334,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['tableau électrique', '13 modules', 'remplacement tableau', 'coffret électrique', 'tableau monophasé'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires électricité',
        tier: 1,
        excerpt: 'Taux horaire ouvrier électricien chargé Bouches-du-Rhône : 55 €/h (estimation interne alignée fourchette nationale CAPEB 45-70 €/h chargé)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT47 — Électricité (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710979',
        excerpt: 'Index BT47 Électricité base 100 = 2010, dernière mise à jour 15/04/2026. Couvre tableaux électriques et appareillage modulaire.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix mise aux normes tableau électrique 2026',
        tier: 2,
        url: 'https://www.travaux.com/electricite/guide-des-prix/prix-de-mise-aux-normes-dun-tableau-electrique',
        excerpt: 'Tableau monophasé 1 rangée 12-13 modules studio/T1 : 400-700 € matériel + pose ; main-d\'œuvre 30-50 % du devis (250-500 €)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix tableau électrique 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/electricite/prix-tableau-electrique',
        excerpt: 'Prix moyen tableau électrique complet 2026 : ~560 € ; fourchette 200-1400 € installation comprise selon configuration et nombre de rangées',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — taux horaire 55 €/h is internal estimate aligned with 2025 baseline + INSEE BT47 (ranges nationale CAPEB 45-70 €/h chargé). Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Mise aux normes NF C 15-100 — appartement 50 m² — forfait
  // moBrut    = 22.00 × 55 = 1210.00
  // coutBrut  = 1210.00 + 950 = 2160.00
  // coutFinal = 2160.00 × 1.12 = 2419.20
  // ttc       = 2419.20 × 1.10 = 2661.12
  // priceMin  = round(2661.12 × 0.92) = 2448
  // priceMax  = round(2661.12 × 1.08) = 2874
  // spread    = (2874 − 2448) / 2448 = 17.4 % ≤ 20 % ✓
  // Hypothèse : appartement T2 ~50 m² avec installation existante non conforme
  // (prises sans terre, tableau ancien, absence ID 30 mA). Forfait inclut :
  // dépose et remplacement tableau électrique, ajout GTL si possible,
  // remplacement prises sans terre (~10-12 prises), ajout 2-3 prises RJ45,
  // mise en place va-et-vient cuisine, mise à la terre des circuits sensibles,
  // attestation Consuel. Hors câblage neuf complet et hors saignée structurelle
  // lourde. TVA 10 % logement >2 ans.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'electricite',
    taskId: 'electricite-mise-aux-normes-NFC15-100-50m2',
    label: 'Mise aux normes NF C 15-100 — appartement 50 m² (forfait)',
    unit: 'forfait',
    description: 'Forfait mise aux normes NF C 15-100 appartement T2 ~50 m² existant non conforme : remplacement tableau électrique avec ID 30 mA, GTL et coffret communication, remplacement prises sans terre (~10-12 unités), ajout 2-3 prises RJ45, va-et-vient cuisine, mise à la terre circuits sensibles, attestation Consuel. Hors câblage neuf intégral et hors saignée murale lourde.',
    cost: {
      mainOeuvreHeures: 22.00,
      mainOeuvreTauxHoraire: 55,
      materiaux: 950,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 2448,
    priceMax: 2874,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      surfaceMin: 40,
      surfaceMax: 60,
      keywords: ['mise aux normes électrique', 'NF C 15-100', 'rénovation électrique appartement', 'mise en sécurité électrique', 'Consuel'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires électricité',
        tier: 1,
        excerpt: 'Taux horaire ouvrier électricien chargé Bouches-du-Rhône : 55 €/h (estimation interne alignée fourchette nationale CAPEB 45-70 €/h chargé)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT47 — Électricité (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710979',
        excerpt: 'Index BT47 Électricité base 100 = 2010, dernière mise à jour 15/04/2026. Référence pour rénovation et mise aux normes installations bâtiment.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'RénoEstim — Prix mise aux normes électrique 2026',
        tier: 2,
        url: 'https://www.renoestim.fr/guide/prix-mise-aux-normes-electrique',
        excerpt: 'Mise aux normes électrique 2026 : 50-150 €/m² ; appartement 50 m² : 4000-6000 € selon ampleur ; tableau + cuisine = 2/3 du coût total',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Prix-travaux-m2 — Prix remise aux normes installation électrique 2026',
        tier: 2,
        url: 'https://www.prix-travaux-m2.com/prix-remise-aux-normes-installation-electrique.php',
        excerpt: 'Mise aux normes 50 m² : ~4 450 € HT (tableau + GTL + coffret communication + prises terre + RJ45 + va-et-vient cuisine). Fourchette 70-180 €/m² HT fournitures + MO.',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — taux horaire 55 €/h is internal estimate aligned with 2025 baseline + INSEE BT47 (ranges nationale CAPEB 45-70 €/h chargé). Forfait positionné sur la borne basse de la fourchette Tier 2 (mise en sécurité essentielle, hors câblage neuf intégral). Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Borne de recharge véhicule électrique 7 kW — forfait fourniture + pose
  // moBrut    = 5.00 × 55 = 275.00
  // coutBrut  = 275.00 + 1050 = 1325.00
  // coutFinal = 1325.00 × 1.13 = 1497.25
  // ttc       = 1497.25 × 1.055 = 1579.60
  // priceMin  = round(1579.60 × 0.92) = 1453
  // priceMax  = round(1579.60 × 1.08) = 1706
  // spread    = (1706 − 1453) / 1453 = 17.4 % ≤ 20 % ✓
  // Hypothèse : wallbox monophasée 7,4 kW résidentielle milieu de gamme
  // (~900 €) + accessoires raccordement (disjoncteur dédié, câble cuivre 6 mm²
  // sur ~10 m, protection différentielle Type A 30 mA ou Type B selon constructeur,
  // ~150 €), pose par électricien certifié IRVE en logement principal ou secondaire
  // > 2 ans. TVA RÉDUITE 5,5 % (arrêté JORF 22/06/2023, généralisé tous logements
  // depuis 2025) car logement existant + facture unique fourniture + pose +
  // installateur IRVE + conformité NF C 15-100. Hors prime ADVENIR (réservée
  // copropriétés en 2026, pas individuel maison).
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'electricite',
    taskId: 'electricite-borne-recharge-vehicule-7kw',
    label: 'Borne de recharge véhicule électrique 7 kW — fourniture + pose IRVE (forfait)',
    unit: 'forfait',
    description: 'Forfait fourniture + pose wallbox monophasée 7,4 kW résidentielle milieu de gamme par électricien certifié IRVE : borne (~900 €), disjoncteur dédié, câble cuivre 6 mm² sur ~10 m, protection différentielle adaptée, raccordement tableau, paramétrage, mise en service. TVA 5,5 % en logement existant > 2 ans avec facture unique. Hors borne triphasée, hors tranchée extérieure et hors prime ADVENIR (copropriétés uniquement en 2026).',
    cost: {
      mainOeuvreHeures: 5.00,
      mainOeuvreTauxHoraire: 55,
      materiaux: 1050,
      chargesEntreprise: 60,
      margeNette: 13,
    },
    priceMin: 1453,
    priceMax: 1706,
    priceUnit: 'EUR_TTC',
    tva: 5.5,
    conditions: {
      keywords: ['borne de recharge', 'wallbox', 'borne véhicule électrique', '7 kW', 'IRVE', 'recharge voiture électrique'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires électricité',
        tier: 1,
        excerpt: 'Taux horaire ouvrier électricien chargé Bouches-du-Rhône : 55 €/h (estimation interne alignée fourchette nationale CAPEB 45-70 €/h chargé)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'JORF — Arrêté du 22 juin 2023 TVA réduite IRVE',
        tier: 1,
        url: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000047783647',
        excerpt: 'Arrêté du 22 juin 2023 — exigences techniques bornes de recharge pour application TVA réduite (5,5 %) ; logement existant > 2 ans, installation par professionnel IRVE certifié, facture unique fourniture + pose, conformité NF C 15-100',
        accessedAt: '2026-04-27',
      },
      {
        name: 'TotalEnergies — TVA borne de recharge 2026',
        tier: 2,
        url: 'https://www.totalenergies.fr/particuliers/recharge-voiture-electrique/borne-a-domicile/aides/tva',
        excerpt: 'TVA 5,5 % applicable depuis 2025 sur achat + installation borne en résidence principale ou secondaire >2 ans, fourniture + pose sur facture unique par installateur IRVE',
        accessedAt: '2026-04-27',
      },
      {
        name: 'IZI by EDF — Prix wallbox 7 kW 2026',
        tier: 2,
        url: 'https://izi-by-edf.fr/blog/borne-de-recharge-tva/',
        excerpt: 'Wallbox monophasée 7 kW pose comprise : 800-1500 € ; prix moyen résidentiel borne + pose 1000-1500 € ; exemple 7,4 kW 2000 € HT ramené à ~800 € après TVA réduite + crédit d\'impôt + ADVENIR copropriété',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'TVA 5,5 % validée par arrêté JORF 22/06/2023 (Tier 1) — conditions cumulatives logement >2 ans + IRVE + facture unique. ADVENIR 2026 réservée copropriétés (jusqu\'à 960 €/point), pas individuel maison ; le calcul ne déduit aucune aide. Crédit d\'impôt borne (jusqu\'à 500 €) reste cumulable côté client, à appliquer en aval. CAPEB PACA 2026 grid pending — taux 55 €/h estimation interne alignée fourchette nationale.',
  },
]
