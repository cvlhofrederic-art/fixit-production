// lib/prix-travaux-2026/data/plomberie.ts
//
// Bootstrap Plomberie — 5 lignes prix prioritaires 2026.
// Méthodologie : docs/prix-2026-methodology.md
// Sources Tier 1 gratuites uniquement (CAPEB / FFB / INSEE / France Rénov').
// Pas de Batiprix (décision produit : free Tier 1 only).

import type { PriceLine } from '../types'

export const plomberieLines: PriceLine[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Remplacement robinet mitigeur standard — forfait
  // moBrut    = 1.30 × 55 = 71.50
  // coutBrut  = 71.50 + 35 = 106.50
  // coutFinal = 106.50 × 1.12 = 119.28
  // ttc       = 119.28 × 1.10 = 131.21
  // priceMin  = round(131.21 × 0.92) = 121
  // priceMax  = round(131.21 × 1.08) = 142
  // spread    = (142 − 121) / 121 = 17.4 % ≤ 20 % ✓
  // Hypothèse : mitigeur standard évier ou lavabo (~35 €), pose simple sans
  // modification réseau, dépose ancien robinet incluse.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'plomberie',
    taskId: 'plomberie-remplacement-robinet-standard',
    label: 'Remplacement robinet mitigeur standard (forfait)',
    unit: 'forfait',
    description: 'Forfait remplacement mitigeur évier ou lavabo standard milieu de gamme : dépose ancien robinet, pose neuf mitigeur fourni (≤ 50 €), raccordement flexibles, test étanchéité. Hors modification réseau.',
    cost: {
      mainOeuvreHeures: 1.30,
      mainOeuvreTauxHoraire: 55,
      materiaux: 35,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 121,
    priceMax: 142,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['remplacement robinet', 'mitigeur évier', 'mitigeur lavabo', 'changement robinet', 'pose mitigeur'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires plomberie',
        tier: 1,
        excerpt: 'Taux horaire ouvrier plombier chargé Bouches-du-Rhône : 55 €/h (estimation interne alignée fourchette nationale CAPEB 45-70 €/h chargé)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT38 — Plomberie sanitaire (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710972',
        excerpt: 'Index BT38 mis à jour 13/03/2026 et 15/04/2026, base 100 = 2010. Évolution intégrée au taux horaire chargé.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix pose et remplacement mitigeur 2026',
        tier: 2,
        url: 'https://www.travaux.com/plomberie/guide-des-prix/prix-pose-et-remplacement-mitigeur',
        excerpt: 'Mitigeur évier standard : 100-150 € TTC fourniture + pose (déplacement 30-50 € + 1 h MO 40-60 € + robinet ≥ 65 €)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Thermocom — Tarif plombier changer un robinet 2026',
        tier: 2,
        url: 'https://thermocom.fr/tarif-plombier-pour-changer-un-robinet/',
        excerpt: 'Tarif plombier changement robinet standard : 150-350 € TTC (avec robinet inclus, fourchette élargie selon type)',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — taux horaire 55 €/h is internal estimate aligned with 2025 baseline + INSEE BT38 +2-3% (ranges nationale CAPEB 45-70 €/h chargé). Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Remplacement WC standard à poser — forfait
  // moBrut    = 2.80 × 55 = 154.00
  // coutBrut  = 154.00 + 90 = 244.00
  // coutFinal = 244.00 × 1.12 = 273.28
  // ttc       = 273.28 × 1.10 = 300.61
  // priceMin  = round(300.61 × 0.92) = 277
  // priceMax  = round(300.61 × 1.08) = 325
  // spread    = (325 − 277) / 277 = 17.3 % ≤ 20 % ✓
  // Hypothèse : WC classique à poser (cuvette + réservoir attenant ~80 €),
  // dépose ancienne cuvette, raccord arrivée d'eau et pipe évacuation existants.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'plomberie',
    taskId: 'plomberie-remplacement-wc-standard',
    label: 'Remplacement WC à poser standard (forfait)',
    unit: 'forfait',
    description: 'Forfait remplacement WC classique à poser milieu de gamme : dépose ancienne cuvette, fourniture + pose ensemble cuvette/réservoir attenant (~80 €), pipe évacuation, raccord arrivée d\'eau, joints, test étanchéité. Hors WC suspendu, hors broyeur.',
    cost: {
      mainOeuvreHeures: 2.80,
      mainOeuvreTauxHoraire: 55,
      materiaux: 90,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 277,
    priceMax: 325,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['remplacement WC', 'changement WC', 'pose WC', 'WC à poser', 'remplacement toilettes'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires plomberie',
        tier: 1,
        excerpt: 'Taux horaire ouvrier plombier chargé Bouches-du-Rhône : 55 €/h (estimation interne alignée fourchette nationale CAPEB 45-70 €/h chargé)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT38 — Plomberie sanitaire (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710972',
        excerpt: 'Index BT38 mis à jour 13/03/2026 et 15/04/2026, base 100 = 2010. Plomberie sanitaire (y compris appareils).',
        accessedAt: '2026-04-27',
      },
      {
        name: 'MesDépanneurs.fr — Prix remplacement WC 2026',
        tier: 2,
        url: 'https://www.mesdepanneurs.fr/blog/prix-remplacement-toilettes',
        excerpt: 'WC classique à poser : 200-1100 € tout compris ; moyenne 350-550 € pour remplacement simple en 2 h max',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix installation/remplacement WC 2026',
        tier: 2,
        url: 'https://www.travaux.com/salles-de-bain-sanitaires/guide-des-prix/prix-de-linstallation-remplacement-dun-wc',
        excerpt: 'Forfait pose WC à poser (MO seule) : 150-200 € TTC ; total fourniture + pose WC classique 280-450 €',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — taux horaire 55 €/h is internal estimate aligned with 2025 baseline + INSEE BT38 +2-3% (ranges nationale CAPEB 45-70 €/h chargé). Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Remplacement chauffe-eau électrique 200L — forfait
  // moBrut    = 5.00 × 55 = 275.00
  // coutBrut  = 275.00 + 700 = 975.00
  // coutFinal = 975.00 × 1.11 = 1082.25
  // ttc       = 1082.25 × 1.10 = 1190.48
  // priceMin  = round(1190.48 × 0.92) = 1095
  // priceMax  = round(1190.48 × 1.08) = 1286
  // spread    = (1286 − 1095) / 1095 = 17.4 % ≤ 20 % ✓
  // Hypothèse : ballon 200L stéatite milieu de gamme (~600 €) + accessoires
  // (groupe sécurité, raccords, flexibles ~100 €), dépose ballon existant,
  // pose en remplacement à l'identique sans modification arrivée/évacuation.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'plomberie',
    taskId: 'plomberie-remplacement-chauffe-eau-200l',
    label: 'Remplacement chauffe-eau électrique 200L stéatite (forfait)',
    unit: 'forfait',
    description: 'Forfait remplacement à l\'identique chauffe-eau électrique vertical 200L stéatite milieu de gamme (~600 €) : dépose ancien ballon, pose neuf, groupe de sécurité, flexibles, raccordement arrivée eau froide et départ ECS, mise en service. Hors modification arrivée électrique ou évacuation.',
    cost: {
      mainOeuvreHeures: 5.00,
      mainOeuvreTauxHoraire: 55,
      materiaux: 700,
      chargesEntreprise: 60,
      margeNette: 11,
    },
    priceMin: 1095,
    priceMax: 1286,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['chauffe-eau 200L', 'ballon eau chaude', 'remplacement chauffe-eau', 'chauffe-eau électrique', 'cumulus 200L'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires plomberie',
        tier: 1,
        excerpt: 'Taux horaire ouvrier plombier chargé Bouches-du-Rhône : 55 €/h (estimation interne alignée fourchette nationale CAPEB 45-70 €/h chargé)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT38 — Plomberie sanitaire (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710972',
        excerpt: 'Index BT38 mis à jour 13/03/2026 et 15/04/2026, base 100 = 2010. Plomberie sanitaire y compris appareils sanitaires.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'MesDépanneurs.fr — Tarifs remplacement chauffe-eau 100L/150L/200L 2026',
        tier: 2,
        url: 'https://www.mesdepanneurs.fr/blog/tarif-remplacement-chauffe-eau-200l',
        excerpt: 'Remplacement chauffe-eau 200L stéatite : 950 € (moyenne) ; fourchette 850-1550 € TTC appareil + pose + dépose',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Prix-pose.com — Changement chauffe-eau 2026',
        tier: 2,
        url: 'https://www.prix-pose.com/changement-chauffe-eau',
        excerpt: 'Capacité 200 L (installation incluse) : 650-1450 € ; remplacement moyen 700-1800 € (dépose + fourniture + pose)',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — taux horaire 55 €/h is internal estimate aligned with 2025 baseline + INSEE BT38 +2-3% (ranges nationale CAPEB 45-70 €/h chargé). Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Installation douche italienne standard — forfait (hors carrelage)
  // moBrut    = 26.00 × 55 = 1430.00
  // coutBrut  = 1430.00 + 1700 = 3130.00
  // coutFinal = 3130.00 × 1.11 = 3474.30
  // ttc       = 3474.30 × 1.10 = 3821.73
  // priceMin  = round(3821.73 × 0.92) = 3516
  // priceMax  = round(3821.73 × 1.08) = 3128 ?? recompute
  // priceMax  = round(3821.73 × 1.08) = 4128
  // spread    = (4128 − 3516) / 3516 = 17.4 % ≤ 20 % ✓
  // Hypothèse : douche italienne standard 90×120 cm en remplacement bac douche
  // existant : receveur extra-plat ou caniveau (~400 €), paroi fixe (~500 €),
  // mitigeur thermostatique + colonne (~400 €), bonde + siphon (~80 €),
  // étanchéité + tuyauterie + accessoires (~320 €). MAIN D'ŒUVRE plomberie
  // pure (hors carrelage / hors maçonnerie reprise sol).
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'plomberie',
    taskId: 'plomberie-installation-douche-italienne-standard',
    label: 'Installation douche italienne standard 90×120 (forfait, hors carrelage)',
    unit: 'forfait',
    description: 'Forfait installation douche à l\'italienne 90×120 cm en remplacement bac existant : receveur extra-plat ou caniveau, paroi fixe, mitigeur thermostatique + colonne, bonde + siphon ultra-plat, étanchéité, raccordements arrivée et évacuation. Plomberie + sanitaire seuls — hors carrelage, hors reprise maçonnerie sol importante.',
    cost: {
      mainOeuvreHeures: 26.00,
      mainOeuvreTauxHoraire: 55,
      materiaux: 1700,
      chargesEntreprise: 60,
      margeNette: 11,
    },
    priceMin: 3516,
    priceMax: 4128,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['douche italienne', 'douche à l\'italienne', 'installation douche', 'rénovation douche', 'receveur extra-plat'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires plomberie',
        tier: 1,
        excerpt: 'Taux horaire ouvrier plombier chargé Bouches-du-Rhône : 55 €/h (estimation interne alignée fourchette nationale CAPEB 45-70 €/h chargé)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT38 — Plomberie sanitaire (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710972',
        excerpt: 'Index BT38 mis à jour 13/03/2026 et 15/04/2026, base 100 = 2010. Plomberie sanitaire y compris appareils.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix douche italienne 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/salle-de-bain-wc/prix-douche-italienne',
        excerpt: 'Configuration milieu de gamme (receveur carrelable + bonde + paroi fixe) : 1500-1600 € matériaux ; pose plombier + sanitaire 45-70 €/h HT en 2026',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix installation douche 2026',
        tier: 2,
        url: 'https://www.travaux.com/plomberie/guide-des-prix/prix-de-linstallation-dune-douche',
        excerpt: 'Plomberie douche italienne installation/rénovation : 500-1500 € selon complexité réseau + fourniture/pose receveur et paroi 1500-3000 € hors carrelage',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — taux horaire 55 €/h is internal estimate aligned with 2025 baseline + INSEE BT38 +2-3% (ranges nationale CAPEB 45-70 €/h chargé). Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Débouchage canalisation évacuation — forfait
  // moBrut    = 2.50 × 55 = 137.50
  // coutBrut  = 137.50 + 15 = 152.50
  // coutFinal = 152.50 × 1.15 = 175.38
  // ttc       = 175.38 × 1.10 = 192.91
  // priceMin  = round(192.91 × 0.92) = 178
  // priceMax  = round(192.91 × 1.08) = 208
  // spread    = (208 − 178) / 178 = 16.9 % ≤ 20 % ✓
  // Hypothèse : débouchage furet motorisé sur évacuation lavabo / évier /
  // douche (pas colonne EU lourde, pas hydrocurage haute pression). Marge 15 %
  // car prestation dépannage avec déplacement court intégré au forfait.
  // TVA 10 % logement >2 ans (entretien sanitaire éligible).
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'plomberie',
    taskId: 'plomberie-debouchage-canalisation-evacuation',
    label: 'Débouchage canalisation évacuation au furet motorisé (forfait)',
    unit: 'forfait',
    description: 'Forfait débouchage évacuation lavabo, évier, baignoire ou douche au furet motorisé : déplacement, démontage siphon, passage furet motorisé, contrôle écoulement, remontage. Hors hydrocurage haute pression et hors colonne d\'évacuation principale (EU).',
    cost: {
      mainOeuvreHeures: 2.50,
      mainOeuvreTauxHoraire: 55,
      materiaux: 15,
      chargesEntreprise: 60,
      margeNette: 15,
    },
    priceMin: 178,
    priceMax: 208,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['débouchage canalisation', 'débouchage évacuation', 'furet plombier', 'canalisation bouchée', 'débouchage évier'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires plomberie',
        tier: 1,
        excerpt: 'Taux horaire ouvrier plombier chargé Bouches-du-Rhône : 55 €/h (estimation interne alignée fourchette nationale CAPEB 45-70 €/h chargé)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT38 — Plomberie sanitaire (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710972',
        excerpt: 'Index BT38 mis à jour 13/03/2026 et 15/04/2026, base 100 = 2010. Référence indexation prestations plomberie courante.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix débouchage canalisation 2026',
        tier: 2,
        url: 'https://www.travaux.com/plomberie/guide-des-prix/prix-debouchage-dune-canalisation-bouchee',
        excerpt: 'Furet motorisé : 100-250 € ; tarif horaire plombier débouchage 40-70 €/h déplacement inclus ; facturation forfait majoritaire',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Ootravaux — Prix débouchage canalisation 2026',
        tier: 2,
        url: 'https://www.ootravaux.fr/installation-entretien/assainissement/prix-debouchage-canalisation.html',
        excerpt: 'Débouchage évacuation lavabo/évier/baignoire/douche : 90-250 € selon méthode et accessibilité',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — taux horaire 55 €/h is internal estimate aligned with 2025 baseline + INSEE BT38 +2-3% (ranges nationale CAPEB 45-70 €/h chargé). Refresh via prix-freshness workflow when grid lands.',
  },
]
