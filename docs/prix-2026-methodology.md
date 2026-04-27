# Méthodologie — Prix Travaux Vitfix 2026

> **Référence** : `lib/prix-travaux-2026/` — base de prix all-in TTC du simulateur de devis Vitfix.

## Principe

Chaque ligne de prix (`PriceLine`) représente une **tâche unitaire** dans un métier (ex: "PAC air-eau 11 kW maison 120-160 m²"). Elle expose :
- Un `priceMin/priceMax` all-in TTC (MO chargée + matériaux + charges + marge + TVA), ≤ 20 % d'écart
- Une décomposition `cost` auditable (heures × taux + matériaux + marge)
- ≥ 2 sources fiables, dont ≥ 1 Tier 1
- Une date `lastVerified` pour suivre l'âge de la donnée

## Sources fiables — hiérarchie (free Tier 1 strategy)

### Tier 1 — Référence absolue (sources publiques gratuites)

| Source | Type | Accès | URL |
|---|---|---|---|
| **CAPEB** régionales | Taux horaires officiels artisans | Communiqués publics | https://www.capeb.fr |
| **FFB** (Fédération Française du Bâtiment) | Observatoire prix + index | Communiqués publics | https://www.ffbatiment.fr |
| **INSEE** Index BT01-BT53 | Évolution % matériaux + MO trimestrielle | Public, gratuit | https://www.insee.fr/fr/statistiques (séries BT) |
| **JORF** (Journal Officiel) | Barèmes officiels aides, TVA, fiscalité | Public, gratuit | https://www.legifrance.gouv.fr |

> **Note** : l'édition Batiprix de Le Moniteur (~600 €/an payant) est volontairement écartée de cette méthodologie. Vitfix s'appuie exclusivement sur les sources publiques gratuites Tier 1 ci-dessus.

### Tier 2 — Plateformes pros et data agrégée

| Source | Type | Accès | URL |
|---|---|---|---|
| **France Rénov'** (govt) | Barèmes officiels rénovation énergétique + coût moyens travaux | Public | https://france-renov.gouv.fr |
| **MaPrimeRénov'** (govt) | Barèmes aides + montants 2026 | Public | https://www.maprimerenov.gouv.fr |
| **Travaux.com** (Habitatpresto) | Agrégat 600k devis/an | Web public | https://www.travaux.com |
| **Quotatis** | Agrégat devis | Web public | https://www.quotatis.fr |
| **Service Public** | Éco-PTZ, aides locales, plafonds | Public | https://www.service-public.fr |

### Tier 3 — Distributeurs (cross-check matériaux)

Point.P, Cedeo, Lapeyre, Castorama, Leroy Merlin, ManoMano Pro — utilisés uniquement pour vérifier les prix matériaux retail (sites publics).

### Sources EXCLUES

- Forums (Forum Construire, Système-D, etc.)
- Blogs personnels et sites perso
- Sites US/UK/CA convertis ($ → €)
- Comparateurs sponsorisés (publi-rédactionnels)
- Réseaux sociaux (LinkedIn, Twitter)

## Méthodologie pour produire une ligne

### Étape 1 — Cadrage de la variante

Définir le `taskId` (kebab-case unique), `label` (lisible humain), `unit` (m²/ml/unité/forfait), `description` (détail technique).

Sous-segmenter assez finement pour que la fourchette finale rentre en 20 %. Exemple : pour PAC air-eau, ne pas faire UNE ligne 8 000-15 000 €. Faire 3 lignes :
- `pac-air-eau-8kw` : maison ≤ 120 m²
- `pac-air-eau-11kw` : maison 120-160 m²
- `pac-air-eau-14kw` : maison > 160 m²

### Étape 2 — Extraction Tier 1

Récupérer **≥ 2 sources Tier 1** :
1. **INSEE Index BT** — récupérer l'évolution annuelle 2025→2026 pour le métier concerné (BT16 peinture, BT38 plomberie, BT37 électricité, BT22 carrelage, BT24 maçonnerie, BT34 couverture, BT40 chauffage, etc.)
2. **CAPEB régionale** — taux horaire MO chargée pour la zone PACA (zone baseline)
3. **FFB observatoire** — confirmer la fourchette des matériaux

Citation directe extraite et stockée dans `sources[].excerpt`.

### Étape 3 — Cross-check Tier 2

Vérifier la cohérence avec ≥ 1 source Tier 2 (France Rénov', Travaux.com, Habitatpresto agrégé). Si écart > 25 % entre Tier 1 et Tier 2 :
- Retenir la **médiane Tier 1**
- Logger l'écart dans `notes`
- Tagger `confidence: 'medium'` au lieu de `'high'`

### Étape 4 — Décomposition coût

Renseigner `cost` :
```typescript
cost: {
  mainOeuvreHeures: 24,                  // estimation heures pour la tâche
  mainOeuvreTauxHoraire: 55,             // €/h chargé PACA standard 2026 (Capeb)
  materiaux: 9_800,                      // matériaux Tier 1 ou Tier 3
  chargesEntreprise: 60,                 // % info (déjà inclus dans MO chargée)
  margeNette: 10,                        // % marge artisan typique
}
```

### Étape 5 — Calcul priceMin / priceMax

Formule (PACA standard, gamme standard, état bon — la baseline) :
```
moBrut       = mainOeuvreHeures × mainOeuvreTauxHoraire
coutBrut     = moBrut + materiaux
coutFinal    = coutBrut × (1 + margeNette / 100)
ttc          = coutFinal × (1 + tva / 100)
priceMin     = round(ttc × 0.92)         // borne basse régionale
priceMax     = round(ttc × 1.08)         // borne haute (≤ 20 % spread)
```

Vérifier `(priceMax − priceMin) / priceMin ≤ 0.20` (test CI le valide automatiquement dans `tests/prix-2026/data-integrity.test.ts`).

### Étape 6 — Aides (rénovation énergétique uniquement)

Si la tâche est éligible MaPrimeRénov / CEE / TVA 5.5%, renseigner `aidesEligibles` :
```typescript
aidesEligibles: {
  maPrimeRenov: {
    forfaits: { bleu: 5000, jaune: 4000, violet: 3000, rose: 0 },
    plafondTravaux: 18_000,  // si plafond opération-spécifique
  },
  cee: {
    forfaitParUnite: 4500,
    operationStandard: 'BAR-TH-104',  // référence officielle
  },
  tvaReduite: 5.5,
  ecoPTZ: true,
}
```

Métiers éligibles aides : `chauffage`, `photovoltaique`, `ite`, `plaquiste` (isolation intérieure), `menuiserie` (fenêtres double vitrage). Le test CI `aidesEligibles only on energy-renovation metiers` enforce cette règle.

### Étape 7 — Confidence + lastVerified

- `confidence: 'high'` — ≥ 2 sources Tier 1 convergentes (écart < 10 %)
- `confidence: 'medium'` — 1 source Tier 1 + Tier 2, ou écart 10-25 %, ou métier nouveau (photovoltaïque) où les sources Tier 1 sont incomplètes
- `confidence: 'low'` — sources rares, spread élargi à 25 % avec note disclaimer

`lastVerified: 'YYYY-MM-DD'` — date du jour de la recherche.

## Exemple complet — `peinture-murs-interieur-2couches`

```typescript
{
  metier: 'peinture',
  taskId: 'peinture-murs-interieur-2couches',
  label: 'Peinture murs intérieurs — 2 couches + sous-couche',
  unit: 'm2',
  description: 'Préparation légère, sous-couche acrylique, 2 couches finition acrylique mat ou velours, marque pro (Tollens / Dulux Valentine)',

  cost: {
    mainOeuvreHeures: 0.35,           // 0.35 h/m² (rendement standard)
    mainOeuvreTauxHoraire: 48,        // 48 €/h chargé PACA peintre 2026
    materiaux: 7,                     // 7 €/m² (sous-couche + 2 couches qualité pro)
    chargesEntreprise: 60,
    margeNette: 12,
  },

  // moBrut = 0.35 × 48 = 16.80
  // coutBrut = 16.80 + 7 = 23.80
  // coutFinal = 23.80 × 1.12 = 26.66
  // ttc = 26.66 × 1.10 = 29.32
  // priceMin = round(29.32 × 0.92) = 27
  // priceMax = round(29.32 × 1.08) = 32
  priceMin: 27,
  priceMax: 32,
  priceUnit: 'EUR_TTC',
  tva: 10,                            // rénovation logement >2 ans

  conditions: {
    keywords: ['peinture mur', 'mur intérieur', '2 couches', 'rénovation peinture'],
  },

  sources: [
    {
      name: 'CAPEB PACA 2026 — Taux horaires peinture',
      tier: 1,
      excerpt: 'Taux horaire ouvrier peintre chargé Bouches-du-Rhône : 48 €/h',
      accessedAt: '2026-04-27',
    },
    {
      name: 'INSEE Index BT16 — Peinture (T1 2026)',
      tier: 1,
      url: 'https://www.insee.fr/fr/statistiques/series/103205830',
      excerpt: 'Évolution +2.8 % vs T1 2025',
      accessedAt: '2026-04-27',
    },
    {
      name: 'Travaux.com — Prix peinture 2026',
      tier: 2,
      url: 'https://www.travaux.com/peinture/prix',
      excerpt: 'Fourchette 25-35 €/m² peinture murs 2 couches, milieu de gamme',
      accessedAt: '2026-04-27',
    },
  ],

  lastVerified: '2026-04-27',
  confidence: 'high',
}
```

## Procédure de mise à jour

### Hebdomadaire (auto via `prix-freshness.yml` — Phase 6)
- Issue GitHub auto pour 5-10 lignes en rotation (`lastVerified > 90 jours`)
- Implémenteur revérifie sources, met à jour `priceMin/Max` + `lastVerified`

### Trimestrielle (manuelle)
- Revue indices INSEE BT01-BT53 publiés au trimestre (T1, T2, T3, T4)
- Adjust `priceMin/Max` au prorata pour les métiers concernés

### Annuelle Q1 (manuelle)
- Refresh complet des taux horaires CAPEB par région (publication communiqués CAPEB régionaux janvier-février)
- Refresh des barèmes MaPrimeRénov 2027 (publication décret JORF généralement décembre)
- Audit complet du fichier (cible : 100 % `lastVerified < 90j`)

## Procédure d'audit (litige client)

Si un client conteste un prix simulé :
1. Récupérer le `taskId` utilisé (loggé dans Langfuse trace)
2. Lire la ligne dans `lib/prix-travaux-2026/data/<metier>.ts`
3. Présenter les `sources[].excerpt` au client + `lastVerified`
4. Si désaccord persistant et écart >15 %, logger en issue GitHub `[Prix 2026 — Audit]` et recalibrer

## Gates CI bloquants

Le fichier `tests/prix-2026/data-integrity.test.ts` enforce 9 invariants à chaque PR :
1. spread ≤ 20 % par ligne
2. ≥ 2 sources, dont ≥ 1 Tier 1
3. lastVerified ≤ 730 jours (sinon erreur)
4. lastVerified > 365 jours → warning console
5. taskId globalement unique
6. cost decomposition cohérent à ±5 %
7. TVA ∈ {5.5, 10, 20}
8. aidesEligibles uniquement sur métiers énergétiques
9. dept zone uniqueness (pas de chevauchement)

Une PR qui casse une de ces invariants ne peut pas merger.
