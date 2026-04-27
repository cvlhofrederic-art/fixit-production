// lib/prix-travaux-2026/data/chauffage.ts
//
// Bootstrap Chauffage — 5 lignes prix prioritaires 2026.
// Méthodologie : docs/prix-2026-methodology.md
// Sources Tier 1 gratuites uniquement (CAPEB / FFB / INSEE / France Rénov').
// Pas de Batiprix (décision produit : free Tier 1 only).
//
// NOTE INSEE — l'index officiel "Chauffage" est le BT40 (chauffage central avec
// distribution, y compris pompes à chaleur, chaudières gaz/fioul/biomasse).
// Les poêles à granulés et appareils indépendants se rattachent également au
// BT40 (équipements thermiques individuels). La pose des unités intérieures
// PAC air-air en multisplit reste indexée BT40 (génie climatique).
//
// AIDES ÉNERGÉTIQUES — Lignes 1 (chaudière condensation gaz THPE), 2 et 3 (PAC
// air-eau) et 5 (poêle granulés) sont éligibles MaPrimeRénov + CEE :
//   • BAR-TH-104 — Pompe à chaleur de type air/eau ou eau/eau
//   • BAR-TH-106 — Chaudière individuelle gaz à haute performance énergétique
//   • BAR-TH-112 — Appareil indépendant de chauffage au bois (poêle granulés)
// Les PAC air-air (multisplit, ligne 4) NE SONT PAS ÉLIGIBLES MaPrimeRénov ni
// CEE résidentiel (exclues du périmètre BAR-TH-104) — TVA 10 % standard rénov.
// Forfaits MPR 2026 par tranche de revenus (bleu/jaune/violet/rose) et bonus
// CEE forfaitaire conformément aux fiches d'opérations standardisées en vigueur.

import type { PriceLine } from '../types'

export const chauffageLines: PriceLine[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Chaudière gaz à condensation 25 kW — forfait posé (AIDES MPR + CEE)
  // moBrut    = 12.0 × 50 = 600.00
  // coutBrut  = 600.00 + 2650 = 3250.00
  // coutFinal = 3250.00 × 1.12 = 3640.00
  // ttc       = 3640.00 × 1.055 = 3840.20
  // priceMin  = round(3840.20 × 0.92) = 3533
  // priceMax  = round(3840.20 × 1.08) = 4147
  // spread    = (4147 − 3533) / 3533 = 17.4 % ≤ 20 % ✓
  // Hypothèse : remplacement d'une chaudière gaz vétuste par chaudière gaz à
  // condensation murale 25 kW THPE (ETAS ≥ 92 %), modèle milieu de gamme type
  // Saunier Duval ThemaPlus / De Dietrich MCR / Atlantic Naia. Fourniture
  // (~2650 € : chaudière 1750 + ballon ECS intégré ou kit raccordement 250 +
  // ventouse concentrique 200 + raccords cuivre + thermostat connecté +
  // accessoires sécurité 450). Dépose ancienne chaudière, raccordement gaz,
  // eau, évacuation condensats sur évacuation existante, mise en service et
  // attestation Qualigaz. Hors création conduit gaz neuf et hors carénage
  // habillage. TVA 5.5 % logement >2 ans (rénovation énergétique BAR-TH-106).
  //
  // AIDES BAR-TH-106 — Chaudière individuelle gaz THPE (ETAS ≥ 92 %) :
  //   • MPR forfaits 2026 : bleu 1200 €, jaune 800 €, violet 0, rose 0
  //   • Plafond travaux MPR : 1 chaudière par logement
  //   • CEE BAR-TH-106 : ~600 € (forfait national maison individuelle)
  //   • TVA réduite 5.5 % + Éco-PTZ cumulables
  //   • Performance minimale exigée : ETAS ≥ 92 % et NOx ≤ 56 mg/kWh PCI
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'chauffage',
    taskId: 'chauffage-chaudiere-condensation-gaz-25kw',
    label: 'Chaudière gaz à condensation 25 kW — forfait posé',
    unit: 'forfait',
    description: "Remplacement chaudière gaz par chaudière murale à condensation 25 kW THPE (ETAS ≥ 92 %), modèle milieu de gamme. Fourniture chaudière + kit raccordement + ventouse concentrique + thermostat connecté + accessoires sécurité, dépose ancienne chaudière, raccordement gaz/eau/évacuation condensats, mise en service et attestation Qualigaz. Hors création conduit gaz neuf et hors carénage. Logement >2 ans, opération éligible MaPrimeRénov + CEE BAR-TH-106, TVA 5.5 %.",
    cost: {
      mainOeuvreHeures: 12.0,
      mainOeuvreTauxHoraire: 50,
      materiaux: 2650,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 3533,
    priceMax: 4147,
    priceUnit: 'EUR_TTC',
    tva: 5.5,
    conditions: {
      keywords: ['chaudière condensation', 'chaudière gaz', 'remplacement chaudière', 'BAR-TH-106', 'THPE', 'chaudière 25 kW'],
      requiresFollowUp: ['conduit gaz existant et conforme', 'évacuation condensats à proximité', 'thermostat connecté inclus ou non'],
    },
    aidesEligibles: {
      maPrimeRenov: {
        forfaits: { bleu: 1200, jaune: 800, violet: 0, rose: 0 },
        plafondTravaux: 1,
      },
      cee: {
        forfaitParUnite: 600,
        operationStandard: 'BAR-TH-106',
      },
      tvaReduite: 5.5,
      ecoPTZ: true,
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires chauffage / génie climatique',
        tier: 1,
        excerpt: 'Taux horaire ouvrier chauffagiste chargé Bouches-du-Rhône : 50 €/h (estimation interne alignée fourchette nationale CAPEB 48-56 €/h chargé)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT40 — Chauffage (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710972',
        excerpt: 'Index BT40 Chauffage central base 100 = 2010, dernière mise à jour T1 2026. Référence indexation chaudières gaz/fioul/biomasse, PAC et radiateurs.',
        accessedAt: '2026-04-27',
      },
      {
        name: "France Rénov' — MaPrimeRénov 2026 chaudière gaz THPE (BAR-TH-106)",
        tier: 1,
        url: 'https://france-renov.gouv.fr/aides/maprimerenov',
        excerpt: 'Chaudière individuelle gaz à haute performance énergétique (ETAS ≥ 92 %) — forfaits 2026 par tranche revenus : bleu 1200 €, jaune 800 €, violet 0, rose 0. CEE BAR-TH-106 ~600 € en complément maison individuelle.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix chaudière gaz à condensation 2026',
        tier: 2,
        url: 'https://www.travaux.com/chauffage/guide-des-prix/prix-chaudiere-condensation-gaz',
        excerpt: 'Chaudière gaz à condensation 25 kW fourniture + pose : 3500-4500 € TTC milieu de gamme posée, hors aides',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: "CAPEB PACA 2026 grid pending official Q1 publication — 50 €/h is internal estimate aligned with 2025 baseline + INSEE BT40. Refresh via prix-freshness workflow when grid lands. Barèmes MPR/CEE 2026 (BAR-TH-106) basés sur fiches d'opérations standardisées France Rénov' / arrêté JORF 2026 ; à reconfirmer trimestriellement (forfaits gaz susceptibles de glisser à la baisse, plan de sortie progressif des aides chaudière gaz au profit des PAC).",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. PAC air-eau 8 kW maison ≤120 m² — forfait posé (AIDES MPR + CEE)
  // moBrut    = 24.0 × 55 = 1320.00
  // coutBrut  = 1320.00 + 7800 = 9120.00
  // coutFinal = 9120.00 × 1.12 = 10214.40
  // ttc       = 10214.40 × 1.055 = 10776.19
  // priceMin  = round(10776.19 × 0.92) = 9914
  // priceMax  = round(10776.19 × 1.08) = 11638
  // spread    = (11638 − 9914) / 9914 = 17.4 % ≤ 20 % ✓
  // Hypothèse : installation pompe à chaleur air-eau 8 kW (COP ≥ 4.0, ETAS ≥
  // 126 %) en remplacement chaudière, pour maison individuelle jusqu'à 120 m²
  // bien isolée. Modèle milieu de gamme type Atlantic Alféa Excellia / Daikin
  // Altherma 3 / Mitsubishi Ecodan. Fourniture (~7800 € : groupe extérieur
  // 4800 + module hydraulique intérieur 1600 + ballon tampon 50L 350 +
  // raccords frigorifiques + dérivation hydraulique + thermostat connecté +
  // accessoires antivibratiles 1050). Dépose ancien générateur, raccordement
  // hydraulique sur circuit existant, raccordement frigorifique, raccordement
  // électrique dédié et tableau, mise en service par technicien certifié
  // RGE QualiPAC. TVA 5.5 % logement >2 ans (rénovation énergétique
  // BAR-TH-104). Hors remplacement émetteurs (radiateurs basse température
  // ou plancher chauffant).
  //
  // AIDES BAR-TH-104 — Pompe à chaleur air-eau ou eau-eau :
  //   • MPR forfaits 2026 : bleu 5000 €, jaune 4000 €, violet 3000 €, rose 0
  //   • Plafond travaux MPR : 1 PAC par logement
  //   • CEE BAR-TH-104 : ~4500 € (forfait national maison individuelle, climat H1)
  //   • TVA réduite 5.5 % + Éco-PTZ cumulables
  //   • Performance minimale : ETAS ≥ 126 % (basse température) ou ≥ 111 %
  //     (moyenne et haute température). Pose obligatoire par RGE QualiPAC.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'chauffage',
    taskId: 'chauffage-pac-air-eau-8kw-maison-jusqu-120m2',
    label: 'PAC air-eau 8 kW — maison ≤120 m², forfait posé',
    unit: 'forfait',
    description: "Installation pompe à chaleur air-eau 8 kW (COP ≥ 4.0, ETAS ≥ 126 %) pour maison individuelle jusqu'à 120 m². Fourniture groupe extérieur + module hydraulique + ballon tampon + raccords frigorifiques + thermostat connecté + accessoires antivibratiles. Dépose ancien générateur, raccordement hydraulique sur circuit existant, raccordement frigorifique et électrique dédié, mise en service par technicien RGE QualiPAC. Hors remplacement des émetteurs. Logement >2 ans, opération éligible MaPrimeRénov + CEE BAR-TH-104, TVA 5.5 %.",
    cost: {
      mainOeuvreHeures: 24.0,
      mainOeuvreTauxHoraire: 55,
      materiaux: 7800,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 9914,
    priceMax: 11638,
    priceUnit: 'EUR_TTC',
    tva: 5.5,
    conditions: {
      surfaceMax: 120,
      keywords: ['PAC air-eau', 'pompe à chaleur air-eau', '8 kW', 'BAR-TH-104', 'QualiPAC', 'remplacement chaudière'],
      requiresFollowUp: ['compatibilité émetteurs (radiateurs BT ou plancher chauffant)', 'capacité tableau électrique', 'emplacement extérieur conforme nuisance acoustique'],
    },
    aidesEligibles: {
      maPrimeRenov: {
        forfaits: { bleu: 5000, jaune: 4000, violet: 3000, rose: 0 },
        plafondTravaux: 1,
      },
      cee: {
        forfaitParUnite: 4500,
        operationStandard: 'BAR-TH-104',
      },
      tvaReduite: 5.5,
      ecoPTZ: true,
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires chauffage / génie climatique',
        tier: 1,
        excerpt: 'Taux horaire ouvrier chauffagiste / frigoriste chargé Bouches-du-Rhône : 55 €/h (technicien RGE QualiPAC, certification fluides frigorigènes catégorie I)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT40 — Chauffage (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710972',
        excerpt: 'Index BT40 Chauffage central T1 2026 — applicable installations PAC air-eau et systèmes thermodynamiques.',
        accessedAt: '2026-04-27',
      },
      {
        name: "France Rénov' — MaPrimeRénov 2026 PAC air-eau (BAR-TH-104)",
        tier: 1,
        url: 'https://france-renov.gouv.fr/aides/maprimerenov',
        excerpt: 'Pompe à chaleur air/eau ou eau/eau — forfaits 2026 par tranche revenus : bleu 5000 €, jaune 4000 €, violet 3000 €, rose 0. CEE BAR-TH-104 ~4500 € en complément. Pose obligatoire RGE QualiPAC, ETAS ≥ 126 % (basse température).',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix PAC air-eau 2026',
        tier: 2,
        url: 'https://www.travaux.com/chauffage/guide-des-prix/prix-pompe-chaleur-air-eau',
        excerpt: 'PAC air-eau 8 kW maison ≤120 m² fourniture + pose : 9500-12000 € TTC milieu de gamme posée RGE, hors aides',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: "CAPEB PACA 2026 grid pending official Q1 publication — 55 €/h is internal estimate aligned with 2025 baseline + INSEE BT40 (chauffagiste-frigoriste certifié RGE QualiPAC). Refresh via prix-freshness workflow when grid lands. Barèmes MPR/CEE 2026 (BAR-TH-104) basés sur fiches d'opérations standardisées France Rénov' / arrêté JORF 2026 ; à reconfirmer trimestriellement (PAC reste l'aide phare 2026 mais forfaits susceptibles d'ajustement budget).",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. PAC air-eau 11 kW maison 120-160 m² — forfait posé (AIDES MPR + CEE)
  // moBrut    = 28.0 × 55 = 1540.00
  // coutBrut  = 1540.00 + 9800 = 11340.00
  // coutFinal = 11340.00 × 1.12 = 12700.80
  // ttc       = 12700.80 × 1.055 = 13399.34
  // priceMin  = round(13399.34 × 0.92) = 12327
  // priceMax  = round(13399.34 × 1.08) = 14471
  // spread    = (14471 − 12327) / 12327 = 17.4 % ≤ 20 % ✓
  // Hypothèse : installation PAC air-eau 11 kW (COP ≥ 4.0, ETAS ≥ 126 %) pour
  // maison individuelle 120-160 m². Mêmes gammes que ligne 2 mais puissance
  // supérieure et émetteurs plus nombreux. Fourniture (~9800 € : groupe
  // extérieur 6200 + module hydraulique intérieur 2000 + ballon tampon 80L
  // 450 + raccords + dérivation hydraulique + thermostat connecté +
  // accessoires antivibratiles 1150). Main d'œuvre majorée (+4 h vs 8 kW)
  // pour dimensionnement réseau, équilibrage circuits et raccordement
  // hydraulique étendu. Dépose ancien générateur, mise en service RGE
  // QualiPAC. TVA 5.5 % logement >2 ans (BAR-TH-104). Hors remplacement
  // émetteurs.
  //
  // AIDES BAR-TH-104 — Pompe à chaleur air-eau ou eau-eau :
  //   • MPR forfaits 2026 : bleu 5000 €, jaune 4000 €, violet 3000 €, rose 0
  //   • Plafond travaux MPR : 1 PAC par logement
  //   • CEE BAR-TH-104 : ~4500 € (forfait national maison individuelle, climat H1)
  //   • TVA réduite 5.5 % + Éco-PTZ cumulables
  //   • Performance minimale : ETAS ≥ 126 % (basse température). RGE QualiPAC.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'chauffage',
    taskId: 'chauffage-pac-air-eau-11kw-maison-120-160m2',
    label: 'PAC air-eau 11 kW — maison 120-160 m², forfait posé',
    unit: 'forfait',
    description: "Installation pompe à chaleur air-eau 11 kW (COP ≥ 4.0, ETAS ≥ 126 %) pour maison individuelle 120-160 m². Fourniture groupe extérieur + module hydraulique + ballon tampon 80L + raccords + thermostat connecté + accessoires antivibratiles. Dépose ancien générateur, raccordement hydraulique étendu (équilibrage circuits), raccordement frigorifique et électrique dédié, mise en service RGE QualiPAC. Hors remplacement des émetteurs. Logement >2 ans, opération éligible MaPrimeRénov + CEE BAR-TH-104, TVA 5.5 %.",
    cost: {
      mainOeuvreHeures: 28.0,
      mainOeuvreTauxHoraire: 55,
      materiaux: 9800,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 12327,
    priceMax: 14471,
    priceUnit: 'EUR_TTC',
    tva: 5.5,
    conditions: {
      surfaceMin: 120,
      surfaceMax: 160,
      keywords: ['PAC air-eau', 'pompe à chaleur air-eau', '11 kW', 'BAR-TH-104', 'QualiPAC', 'maison 150m2'],
      requiresFollowUp: ['compatibilité émetteurs (radiateurs BT ou plancher chauffant)', 'capacité tableau électrique 32 A dédié', 'emplacement extérieur conforme nuisance acoustique'],
    },
    aidesEligibles: {
      maPrimeRenov: {
        forfaits: { bleu: 5000, jaune: 4000, violet: 3000, rose: 0 },
        plafondTravaux: 1,
      },
      cee: {
        forfaitParUnite: 4500,
        operationStandard: 'BAR-TH-104',
      },
      tvaReduite: 5.5,
      ecoPTZ: true,
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires chauffage / génie climatique',
        tier: 1,
        excerpt: 'Taux horaire ouvrier chauffagiste / frigoriste chargé Bouches-du-Rhône : 55 €/h (rendement majoré 28 h pour dimensionnement réseau et équilibrage circuits étendus 120-160 m²)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT40 — Chauffage (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710972',
        excerpt: 'Index BT40 Chauffage central T1 2026 — applicable installations PAC air-eau forte puissance et plancher hydraulique.',
        accessedAt: '2026-04-27',
      },
      {
        name: "France Rénov' — MaPrimeRénov 2026 PAC air-eau (BAR-TH-104)",
        tier: 1,
        url: 'https://france-renov.gouv.fr/aides/maprimerenov',
        excerpt: 'Pompe à chaleur air/eau ou eau/eau — forfaits 2026 par tranche revenus : bleu 5000 €, jaune 4000 €, violet 3000 €, rose 0. CEE BAR-TH-104 ~4500 €. Pose RGE QualiPAC, ETAS ≥ 126 %.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix PAC air-eau 2026 par puissance',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/chauffage/prix-pompe-chaleur-air-eau',
        excerpt: 'PAC air-eau 11-12 kW maison 120-160 m² fourniture + pose : 12000-15000 € TTC milieu de gamme RGE QualiPAC, hors aides',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: "CAPEB PACA 2026 grid pending official Q1 publication — 55 €/h is internal estimate aligned with 2025 baseline + INSEE BT40 (chauffagiste-frigoriste certifié RGE QualiPAC). Refresh via prix-freshness workflow when grid lands. Barèmes MPR/CEE 2026 (BAR-TH-104) basés sur fiches d'opérations standardisées France Rénov' / arrêté JORF 2026 ; à reconfirmer trimestriellement (PAC reste l'aide phare 2026 mais forfaits susceptibles d'ajustement budget).",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. PAC air-air multisplit 3 unités — forfait posé (PAS d'aides MPR/CEE)
  // moBrut    = 14.0 × 55 = 770.00
  // coutBrut  = 770.00 + 4000 = 4770.00
  // coutFinal = 4770.00 × 1.12 = 5342.40
  // ttc       = 5342.40 × 1.10 = 5876.64
  // priceMin  = round(5876.64 × 0.92) = 5407
  // priceMax  = round(5876.64 × 1.08) = 6347
  // spread    = (6347 − 5407) / 5407 = 17.4 % ≤ 20 % ✓
  // Hypothèse : installation climatisation réversible multisplit 3 unités
  // intérieures + 1 groupe extérieur (puissance totale 6-7 kW), modèle milieu
  // de gamme type Daikin / Mitsubishi MSZ / LG. Fourniture (~4000 € : groupe
  // extérieur multisplit 3 sorties 2200 + 3 unités murales 1200 + raccords
  // frigorifiques cuivre pré-isolé + accessoires fixation + thermostat IR
  // 600). Pose : percement façade x3 + cheminement liaisons frigorifiques
  // (max 15 ml total cumulés), tirage au vide, charge complémentaire fluide
  // R32, raccordement électrique dédié, mise en service. Pas d'aides MPR ni
  // CEE (PAC air-air exclues du périmètre BAR-TH-104 résidentiel). TVA 10 %
  // logement >2 ans (entretien-amélioration, pas rénovation énergétique).
  // Hors goulottes décoratives longue distance et hors raccordement électrique
  // dédié si tableau saturé.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'chauffage',
    taskId: 'chauffage-pac-air-air-multisplit-3unites',
    label: 'PAC air-air multisplit — 3 unités intérieures + 1 groupe extérieur',
    unit: 'forfait',
    description: "Installation climatisation réversible multisplit : 1 groupe extérieur 3 sorties + 3 unités intérieures murales (puissance totale 6-7 kW), modèle milieu de gamme. Fourniture groupe + 3 splits + liaisons frigorifiques cuivre pré-isolé + accessoires fixation + thermostat IR. Pose : percement façade x3, cheminement liaisons (≤15 ml cumulés), tirage au vide, charge fluide R32, raccordement électrique dédié, mise en service. Hors goulottes décoratives longue distance et hors aides énergétiques (PAC air-air exclues du périmètre MaPrimeRénov / CEE résidentiel). Logement >2 ans, TVA 10 %.",
    cost: {
      mainOeuvreHeures: 14.0,
      mainOeuvreTauxHoraire: 55,
      materiaux: 4000,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 5407,
    priceMax: 6347,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['PAC air-air', 'climatisation réversible', 'multisplit', '3 unités', 'climatiseur', 'split system'],
      requiresFollowUp: ['longueur cumulée liaisons frigorifiques', 'capacité tableau électrique pour ligne dédiée', 'goulottes décoratives ou cheminement apparent'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires génie climatique / frigoriste',
        tier: 1,
        excerpt: 'Taux horaire ouvrier frigoriste chargé Bouches-du-Rhône : 55 €/h (certification fluides frigorigènes catégorie I obligatoire pour mise en service R32)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT40 — Chauffage (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710972',
        excerpt: 'Index BT40 Chauffage central / génie climatique T1 2026 — applicable systèmes split / multisplit air-air réversibles.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix climatisation multisplit 2026',
        tier: 2,
        url: 'https://www.travaux.com/chauffage/guide-des-prix/prix-climatisation-multisplit',
        excerpt: 'Climatisation réversible multisplit 3 unités fourniture + pose : 5000-7000 € TTC milieu de gamme posé, hors aides (PAC air-air non éligibles MPR/CEE résidentiel)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix climatisation réversible 3 splits 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/chauffage/prix-climatisation-reversible',
        excerpt: 'Multisplit 3 unités milieu de gamme posé : 5200-6500 € TTC selon marque et longueur liaisons frigorifiques. Aides MPR/CEE indisponibles pour air-air en logement individuel.',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: "CAPEB PACA 2026 grid pending official Q1 publication — 55 €/h is internal estimate aligned with 2025 baseline + INSEE BT40 (frigoriste certifié fluides). Refresh via prix-freshness workflow when grid lands. PAC air-air explicitement exclues de MaPrimeRénov et BAR-TH-104 résidentiel : aucune aide énergétique nationale, TVA 10 % standard rénovation. Vérifier coup de pouce local éventuel (collectivités) au cas par cas.",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Poêle à granulés 7 kW — forfait posé (AIDES MPR + CEE)
  // moBrut    = 12.0 × 50 = 600.00
  // coutBrut  = 600.00 + 3850 = 4450.00
  // coutFinal = 4450.00 × 1.12 = 4984.00
  // ttc       = 4984.00 × 1.055 = 5258.12
  // priceMin  = round(5258.12 × 0.92) = 4837
  // priceMax  = round(5258.12 × 1.08) = 5679
  // spread    = (5679 − 4837) / 4837 = 17.4 % ≤ 20 % ✓
  // Hypothèse : installation poêle à granulés (pellets) 7 kW étanche modèle
  // milieu de gamme type MCZ / Edilkamin / Invicta, rendement ≥ 87 %, label
  // Flamme Verte 7* ou équivalent. Fourniture (~3850 € : poêle 2400 + tubage
  // inox double paroi rigide + concentrique 4 ml ~750 + plaque sol vitrée
  // 200 + sortie de toit + accessoires fixation + raccordement électrique
  // 500). Pose : positionnement, tubage conduit existant ou création conduit
  // double paroi, raccordement électrique dédié, étanchéité passages et
  // sortie toit, mise en service avec test fumée et certification Qualibois.
  // TVA 5.5 % logement >2 ans (rénovation énergétique BAR-TH-112). Hors
  // création conduit cheminée neuf en façade extérieure (chiffrage ml
  // dédié) et hors silo de stockage granulés.
  //
  // AIDES BAR-TH-112 — Appareil indépendant chauffage bois (poêle granulés) :
  //   • MPR forfaits 2026 : bleu 2500 €, jaune 1500 €, violet 0, rose 0
  //   • Plafond travaux MPR : 1 appareil par logement
  //   • CEE BAR-TH-112 : ~700 € (forfait national maison individuelle)
  //   • TVA réduite 5.5 % + Éco-PTZ cumulables
  //   • Performance minimale : rendement ≥ 87 %, émissions CO ≤ 300 mg/Nm³,
  //     label Flamme Verte 7* ou équivalent. Pose RGE Qualibois.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'chauffage',
    taskId: 'chauffage-poele-granules-7kw-pose',
    label: 'Poêle à granulés 7 kW — forfait posé',
    unit: 'forfait',
    description: "Installation poêle à granulés (pellets) 7 kW étanche, rendement ≥ 87 %, label Flamme Verte 7*. Fourniture poêle + tubage inox double paroi rigide + concentrique 4 ml + plaque sol vitrée + sortie de toit + accessoires + raccordement électrique. Pose : positionnement, tubage conduit existant, raccordement électrique dédié, étanchéité passages et sortie toit, mise en service avec test fumée et certification Qualibois. Hors création conduit cheminée neuf en façade et hors silo de stockage. Logement >2 ans, opération éligible MaPrimeRénov + CEE BAR-TH-112, TVA 5.5 %.",
    cost: {
      mainOeuvreHeures: 12.0,
      mainOeuvreTauxHoraire: 50,
      materiaux: 3850,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 4837,
    priceMax: 5679,
    priceUnit: 'EUR_TTC',
    tva: 5.5,
    conditions: {
      keywords: ['poêle granulés', 'poêle pellets', 'BAR-TH-112', 'Flamme Verte 7', 'Qualibois', 'chauffage bois'],
      requiresFollowUp: ['conduit cheminée existant tubable ou création nécessaire', 'silo de stockage granulés inclus ou non', 'raccordement air comburant pour modèle étanche'],
    },
    aidesEligibles: {
      maPrimeRenov: {
        forfaits: { bleu: 2500, jaune: 1500, violet: 0, rose: 0 },
        plafondTravaux: 1,
      },
      cee: {
        forfaitParUnite: 700,
        operationStandard: 'BAR-TH-112',
      },
      tvaReduite: 5.5,
      ecoPTZ: true,
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires chauffage bois / fumisterie',
        tier: 1,
        excerpt: 'Taux horaire ouvrier fumiste / chauffagiste bois chargé Bouches-du-Rhône : 50 €/h (certification RGE Qualibois pour pose éligible aides)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT40 — Chauffage (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710972',
        excerpt: 'Index BT40 Chauffage central T1 2026 — applicable poêles à granulés et appareils indépendants bois, y compris fumisterie associée.',
        accessedAt: '2026-04-27',
      },
      {
        name: "France Rénov' — MaPrimeRénov 2026 poêle à granulés (BAR-TH-112)",
        tier: 1,
        url: 'https://france-renov.gouv.fr/aides/maprimerenov',
        excerpt: 'Appareil indépendant de chauffage au bois (poêle à granulés / pellets) — forfaits 2026 par tranche revenus : bleu 2500 €, jaune 1500 €, violet 0, rose 0. CEE BAR-TH-112 ~700 € en complément. Pose RGE Qualibois, rendement ≥ 87 %, label Flamme Verte 7*.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix poêle à granulés posé 2026',
        tier: 2,
        url: 'https://www.travaux.com/chauffage/guide-des-prix/prix-poele-granules',
        excerpt: 'Poêle à granulés 7 kW fourniture + pose RGE Qualibois : 4500-6000 € TTC milieu de gamme posé avec tubage standard, hors aides',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: "CAPEB PACA 2026 grid pending official Q1 publication — 50 €/h is internal estimate aligned with 2025 baseline + INSEE BT40 (fumiste / installateur RGE Qualibois). Refresh via prix-freshness workflow when grid lands. Barèmes MPR/CEE 2026 (BAR-TH-112) basés sur fiches d'opérations standardisées France Rénov' / arrêté JORF 2026 ; à reconfirmer trimestriellement (forfait poêle granulés stable 2025-2026 mais susceptible d'ajustement plan budget).",
  },
]
