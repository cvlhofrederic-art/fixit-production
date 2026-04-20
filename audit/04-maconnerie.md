# Audit #04 — Maçonnerie traditionnelle

**Trade** : `maconnerie` (sous-domaine élévation murs)
**Référentiel FR** : **NF DTU 20.1** (NF P10-202) — révision **juillet 2020** (intègre Eurocode 6)
**Référentiel FR enduits** : **NF DTU 26.1** — enduits aux mortiers de liants hydrauliques (homologation 2008, en vigueur)
**Référentiel PT** : NP EN 1996 (Eurocódigo 6) + NP EN 771 (spec éléments maçonnerie) + Decreto-Lei 90/2021

**Ouvrages couverts** : 6
- 4.1 Mur parpaings creux B40 20×20×50 (existe, à enrichir)
- 4.2 Mur brique monomur terre cuite 30 cm (existe, à enrichir)
- 4.3 Mur brique terre cuite traditionnelle (pleine/creuse, hors monomur) — **création**
- 4.4 Mur pierre (moellons hourdés) — **création**
- 4.5 Mur béton cellulaire (Siporex / Ytong / Cellumat) — **création**
- 4.6 Enduit extérieur multicouche (gobetis + corps + finition) — **création**

---

## 4.1 Ouvrage : Mur parpaings creux B40 20×20×50

### 📚 Référence normative
- **NF DTU 20.1** rev. juillet 2020 — *Ouvrages en maçonnerie de petits éléments — Parois et murs*
- **§ 5** : Mortiers de hourdage
- **§ 6.4** : Chaînages horizontaux et verticaux
- **§ 6.6** : Ouvertures — linteaux
- **NF EN 771-3** : spécifications blocs béton de granulats
- **NF EN 998-2** : mortiers de maçonnerie

### État actuel
Fichier : `lib/estimation-materiaux/recipes/maconnerie.ts` → `id: 'mur-parpaing-20'`

**Strate 2 — Principal**
- ✅ Parpaing creux B40 20×20×50 (10 u/m²)
- ✅ Ciment CEM II mortier hourdage (8 kg/m²)
- ✅ Sable 0/4 (0,022 m³/m²)
- ✅ Acier HA10 chaînages verticaux (0,8 kg/m²)
- ✅ Béton chaînage (0,01 m³/m²)

### ❌ Manques identifiés

#### Strate 1 — Préparation
- 🔴 **Arase étanche (semelle mur sur fondation)** `obligatoire` — barrière capillaire
  - Formule : `longueur × 1.05` ml (largeur 20 cm)
  - Pertes : 5%
  - Ref : NF DTU 20.1 §5.2.2 — arase d'étanchéité obligatoire en partie basse
  - Conditionnement : rouleau bitumineux 10 m × 20 cm (Siplast / Icopal)

#### Strate 2 — Principal (compléments)
- 🔴 **Cadres HA6 chaînages** `obligatoire` (mentionnés dans les notes, pas listés)
  - Formule : `perimetre × 0.25` kg (2 cadres / 15 cm × 4 angles + int.)
  - Pertes : 10%
  - Ref : NF DTU 20.1 §6.4 + Eurocode 2 §9.5
  - Conditionnement : barre 6 m HA6

- 🔴 **Eau de gâchage mortier** `obligatoire`
  - Formule : `0.022 × 0.18 × 1000` = 4 L/m² (E/C = 0,55 mortier)
  - Pertes : 0%
  - Ref : NF EN 998-2

- 🔴 **Acier HA8 chaînage horizontal (haut + sous dalle)** `obligatoire` si hauteur > 2,8 m
  - Formule : `longueur × 2` kg (2 filantes tout haut)
  - Pertes : 10%
  - Ref : NF DTU 20.1 §6.4.2 — chaînage horizontal en partie haute
  - Conditionnement : barre 6 m

- 🔴 **Linteau préfabriqué béton (au-dessus ouvertures)** `obligatoire` si ouvertures > 0
  - Formule : `nb_ouvertures × largeur_moy × 1.3` ml (appuis + marge)
  - Pertes : 5%
  - Ref : NF DTU 20.1 §6.6 / NF EN 845-2
  - Conditionnement : unité (linteau 1,40 m Leroy Merlin / Point P)
  - *Limite technique : pour notre engine, utiliser `openings/1.5` comme estimation du linéaire (hypothèse ouverture moyenne 1,50 m)*

#### Strate 3 — Accessoires
- 🔴 **Colle à joint mince (si parpaings rectifiés)** `optionnel_selon_contexte`
  - Formule : `surface × 3` kg (alternative au mortier classique)
  - Ref : fabricant (Alkern ThermoRoc)
  - Condition : « Si utilisation de parpaings rectifiés type ThermoRoc »

- 🔴 **Feuillards d'harpage inox** `conseille` si mur en continuité d'ouvrage ancien
  - Formule : `hauteur × 2` u (1 tous les 2 rangs par jonction)
  - Pertes : 5%
  - Ref : NF DTU 20.1 §6.3

#### Strate 4 — Finitions
- 🔴 **Grillage nervuré coulissage** `obligatoire` aux jonctions entre éléments différents
  - Formule : `max(0, hauteur × nb_jonctions)` m²
  - Pertes : 10%
  - Ref : NF DTU 26.1 §6.4.3 (anti-fissures aux changements de matériau)

### 🔧 Correctif à appliquer

Ajouter dans `materials[]` de `mur-parpaing-20` :

```typescript
// Arase étanche
{
  id: 'arase-etanche-bitume',
  name: 'Arase étanche bitumineuse (barrière capillaire 20 cm)',
  category: 'etancheite', phase: 'preparation',
  quantityPerBase: 1, unit: 'ml',
  geometryMultiplier: 'none', // ratio par ml déjà intégré
  wasteFactor: 1.05, wasteReason: 'Coupes aux angles',
  dtu: 'NF DTU 20.1 §5.2.2',
  manufacturerRef: 'Siplast Veral / Icopal',
  packaging: { unit: 'rouleau', contentQty: 10, contentUnit: 'ml', label: 'rouleau 10 m × 20 cm' },
  notes: 'Obligatoire en partie basse contre remontées capillaires.',
},
// Eau de gâchage
{
  id: 'eau-mortier',
  name: 'Eau de gâchage mortier',
  category: 'eau', phase: 'principal',
  quantityPerBase: 4, unit: 'L',
  geometryMultiplier: 'none',
  wasteFactor: 1.00, wasteReason: 'Dosage précis (E/C = 0,55)',
  normRef: 'NF EN 1008',
},
// Cadres HA6
{
  id: 'acier-ha6-cadres',
  name: 'Acier HA6 cadres chaînages (tous les 15 cm)',
  category: 'acier', phase: 'principal',
  quantityPerBase: 0.25, unit: 'kg',
  geometryMultiplier: 'none',
  wasteFactor: 1.10, wasteReason: 'Chutes + ligatures',
  dtu: 'NF DTU 20.1 §6.4', normRef: 'NF A 35-080',
},
// Chaînage horizontal haut
{
  id: 'acier-ha8-chainage-horiz',
  name: 'Acier HA8 chaînage horizontal (2 filantes en partie haute)',
  category: 'acier', phase: 'principal',
  quantityPerBase: 0.6, unit: 'kg',
  geometryMultiplier: 'height',
  wasteFactor: 1.10, wasteReason: 'Chutes + recouvrements (DTU 21)',
  dtu: 'NF DTU 20.1 §6.4.2',
  notes: '2 filantes HA8 en partie haute × longueur du mur.',
},
// Linteau préfa
{
  id: 'linteau-prefa-beton',
  name: 'Linteau préfabriqué béton armé (au-dessus ouvertures)',
  category: 'bloc', phase: 'principal',
  quantityPerBase: 0.7, unit: 'ml',
  geometryMultiplier: 'none',
  wasteFactor: 1.05, wasteReason: 'Coupes appuis',
  dtu: 'NF DTU 20.1 §6.6', normRef: 'NF EN 845-2',
  manufacturerRef: 'Alkern / Fabemi',
  notes: 'Estimation : openings_m² / hauteur_moy(1m) × 1.3 marge appui — adapter si grandes baies.',
},
```

+ hypothèses :
```typescript
hypothesesACommuniquer: [
  'Arase étanche bitumineuse obligatoire en pied de mur (NF DTU 20.1 §5.2.2)',
  'Chaînages verticaux tous les 5 m + 4 angles supposés (1 chaînage / 5 m²)',
  'Chaînage horizontal haut 2 HA8 filantes (DTU 20.1 §6.4.2)',
  'Linteaux estimés à 70 cm/m² d\'ouvertures (hypothèse ouverture moyenne 1,50 m)',
  'Enduit extérieur NON inclus — à ajouter avec l\'ouvrage "enduit-ext-multicouche"',
  'Parpaings hourdés au mortier traditionnel — alternative colle à joint mince optionnelle',
],
```

### 🧪 Test de validation
**Input** : « Mur parpaing 20 cm, 10 m de long sur 2,5 m de haut, 1 porte et 1 fenêtre »

**Output attendu** :
| Phase | Matériau | Qté |
|---|---|---|
| prep | Arase étanche | 10,5 ml |
| principal | Parpaing B40 | 227 u (23 m² net × 10) |
| principal | Ciment mortier | 184 kg (~6 sacs 35 kg) |
| principal | Sable 0/4 | 0,51 m³ |
| principal | **Eau gâchage** 🆕 | 92 L |
| principal | Acier HA10 chaînages V | 18,4 kg |
| principal | **Cadres HA6** 🆕 | 7 kg |
| principal | **HA8 chaînage horiz** 🆕 | 15 kg (sur 2,5 m hauteur) |
| principal | Béton chaînage | 0,23 m³ |
| principal | **Linteaux béton** 🆕 | ~1,8 ml (ouvertures 2,7 m²) |

---

## 4.2 Ouvrage : Mur brique monomur terre cuite 30 cm

### 📚 Référence
- **NF DTU 20.1** §5.3 (mortier joint mince rectifié)
- **NF EN 771-1** (brique terre cuite)
- Fabricants : Bouyer Leroux Bio'Bric / Terreal Monomur / Wienerberger Porotherm

### État actuel
`id: 'mur-brique-monomur-30'` existe. À lire et enrichir selon mêmes règles que 4.1 (cf. code).

### ❌ Manques identifiés (idem 4.1 sauf mortier spécifique)
- Arase étanche ✅ idem
- Cadres HA6 chaînages ✅ idem
- HA8 chaînage horizontal ✅ idem
- Linteau préfa ✅ idem
- **Spécifique** : mortier à joint mince (vs mortier traditionnel) → vérifier la recette actuelle
- **Spécifique** : angles monomur préfa (blocs spéciaux) — `conseille`
- **Spécifique** : membrane coupure capillaire sous 1er rang — idem arase

### 🔧 Correctif
Mêmes 5 ajouts que 4.1 + remplacement ciment/sable par colle joint mince si non présent.

### 🧪 Test de validation
**Input** : « Mur monomur 30 cm, 8×2,70 m, sans ouverture »
**Output** : briques monomur + colle joint mince + chaînages + linteau (si ouvertures).

---

## 4.3 Ouvrage : Mur brique terre cuite traditionnelle (pleine/creuse, hors monomur) — **CRÉATION**

### 📚 Référence
- **NF DTU 20.1** — briques terre cuite (section identique parpaings + spécificités)
- **NF EN 771-1** — spécifications briques

### Structure cible

#### Strate 1 — Préparation
- Arase étanche bitumineuse (identique 4.1)

#### Strate 2 — Principal
- Brique TC pleine ou creuse (ex : brique plâtrière 5,5×10,5×22) — ratio selon format
  - Standard 5,5×10,5×22 : ≈ 60 briques/m² (1 brique × hauteur)
  - Ref fabricant : Bouyer Leroux / Terreal / Wienerberger
- Ciment mortier CEM II/B 32,5 R — 8 kg/m² (idem parpaing)
- Sable 0/4 — 0,025 m³/m² (légèrement plus car joints plus fins)
- Eau — 4 L/m²
- Chaînages verticaux HA10 / cadres HA6 / HA8 horizontal (idem 4.1)

#### Strate 3 — Accessoires
- Linteau préfa (si ouvertures)
- Harpages aux angles (mêmes feuillards que 4.1)

### 🔧 Correctif : nouvelle recette
```typescript
{
  id: 'mur-brique-tc-traditionnelle',
  name: 'Mur brique terre cuite traditionnelle (format 5,5×10,5×22)',
  trade: 'maconnerie',
  baseUnit: 'm2',
  geometryMode: 'area_minus_openings',
  dtuReferences: [
    { code: 'NF DTU 20.1', title: 'Ouvrages en maçonnerie de petits éléments', section: '§ 5-6' },
    { code: 'NF EN 771-1', title: 'Spécifications éléments maçonnerie en terre cuite' },
  ],
  version: '2.1.0',
  constraints: { maxHeight: 2.8 },
  hypothesesACommuniquer: [ /* idem 4.1 */ ],
  materials: [ /* arase + 60 briques/m² + ciment + sable + eau + aciers + linteaux */ ],
},
```

### 🧪 Test de validation
**Input** : « Mur brique TC 22 cm, 6 m × 2,50 m »
**Output** : 900 briques + mortier + aciers + linteaux (si ouvertures).

---

## 4.4 Ouvrage : Mur en pierre (moellons hourdés) — **CRÉATION**

### 📚 Référence
- **NF DTU 20.1** §5.4 — maçonnerie pierre
- **NF EN 771-6** — spécifications pierre naturelle
- **NF DTU 20.11** (spécifique pierre) — nota : plus principalement DTU 20.1

### Structure cible

#### Strate 2 — Principal
- Moellons pierre locale — 1 t/m² pour mur 30 cm (densité 2,4 × 0,30 × 1,40 coef foisonnement)
  - Ref fabricant : carrières locales (Bourgogne, Lauze, Calcaire…)
  - Pertes : **25%** (coupes, calage)
- Mortier chaux NHL 3,5 (OBLIGATOIRE pour respirer la pierre — pas de ciment pur)
  - Ratio : 15 kg liant/m²
  - Ref : NF EN 459-1
  - Fabricant : Saint-Astier / Baumit Romanzement
- Sable 0/4 (2 volumes pour 1 chaux) — 0,04 m³/m²
- Eau — 5 L/m²

#### Strate 3 — Accessoires
- Harpages inox aux angles (recommandé)
- Ferraillage interne si mur porteur neuf (nécessaire si > 1,5 m hauteur)

### 🔧 Correctif : nouvelle recette avec note de limite
```typescript
// ATTENTION : pierre locale = variabilité énorme. Ratio moyen pour mur 30 cm :
// - 1 t moellons / m² → à adapter pour pierres > 40 cm
// - Chaux NHL 3,5 obligatoire (ciment interdit sur pierre ancienne)
```

### 🧪 Test de validation
**Input** : « Mur pierre 30 cm, 5 m × 2,20 m »
**Output** : 11 t moellons + 165 kg chaux + 0,44 m³ sable + etc.

---

## 4.5 Ouvrage : Mur béton cellulaire (Siporex / Ytong / Cellumat) — **CRÉATION**

### 📚 Référence
- **NF DTU 20.1** §5.5 — blocs béton cellulaire (ajout 2020)
- **NF EN 771-4** — spécifications blocs cellulaires autoclave
- Fabricants : Xella Ytong / Cellumat

### Structure cible

#### Strate 1 — Préparation
- Arase étanche (idem 4.1)
- Colle spéciale béton cellulaire 1er rang (mortier classique) — 0,02 m³/m²

#### Strate 2 — Principal
- Bloc cellulaire 30 ou 36,5 cm (Ytong 625×250 = 4 blocs/m²)
  - Densité 500 kg/m³ → bloc 30 cm ≈ 25 kg
  - Pertes : 5%
- Colle joint mince (spécifique cellulaire) — 3 kg/m²
  - Ref fabricant : Ytong ThermoKleber
- Eau colle — 1 L/m²

#### Strate 3 — Accessoires
- Chaînages (idem 4.1 — HA10 verticaux + HA8 horizontal)
- Linteau béton cellulaire préfa OU linteau béton classique
- Cornières d'angles inox

### 🧪 Test de validation
**Input** : « Mur Ytong 30 cm, 10 m × 2,50 m, 1 fenêtre »
**Output** : ~100 blocs + 75 kg colle + chaînages + linteau.

---

## 4.6 Ouvrage : Enduit extérieur multicouche (gobetis + corps + finition) — **CRÉATION**

### 📚 Référence
- **NF DTU 26.1** — *Enduits aux mortiers de liants hydrauliques* (homologué 2008, en vigueur 2026)
- **§ 6.3** : composition gobetis / corps / finition
- **NF EN 998-1** — mortiers enduit

### Structure cible

**Cycle obligatoire en 3 couches** (DTU 26.1 §6.3) :

#### Strate 1 — Préparation
- Brossage + humidification support — **main d'œuvre**, pas matériau
- Grillage armature aux jonctions (idem 4.1) — `obligatoire` aux changements de matériau
- Bande armée rentrante dans les angles (anti-fissures) — `conseille`

#### Strate 2 — Principal (3 couches)

**Couche 1 — Gobetis d'accrochage** (épaisseur 1-5 mm, DTU 26.1 §6.3.1)
- Ciment CEM II — 12 kg/m² (dosage 600 kg/m³, couche 20 mm)
- Sable 0/4 — 0,02 m³/m²
- Eau — 3 L/m²

**Couche 2 — Corps d'enduit** (épaisseur 8-15 mm, DTU 26.1 §6.3.2)
- Liant ciment + chaux (mélange CH ou NHL) — 15 kg/m²
- Sable 0/4 — 0,015 m³/m²
- Eau — 3 L/m²

**Couche 3 — Finition** (épaisseur 3-5 mm, DTU 26.1 §6.3.3)
- Mortier de finition OU enduit chaux pigmenté — 5 kg/m²
  - Ref : Weber.monorex / Parex Lanko
- Eau — 1 L/m²

#### Strate 3 — Accessoires
- Cornière d'angle PVC ou alu — `perimetre_ouvertures + angles × hauteur` ml
  - Pertes : 10%
  - Ref : NF DTU 26.1 §6.5
  - Fabricant : PAM / Weber

#### Alternative : Enduit monocouche (entrée DTU 2019)
- Enduit monocouche prêt à l'emploi — 25 kg/m² (Weber.monorex / Parex)
- En 2 passes : corps + finition en 1 application
- Cornière d'angle
- Grillage armature (obligatoire sur changement support)

### 🔧 Correctif : 2 nouvelles recettes
- `enduit-ext-multicouche-tradi` (3 couches DTU 26.1)
- `enduit-ext-monocouche` (mono passe fabricant)

### 🧪 Test de validation
**Input** : « Enduit extérieur monocouche 100 m² sur parpaing »
**Output** : 2,5 t enduit monocouche (25 kg/m²) + cornières d'angle + grillage jonctions.

---

## 📋 Synthèse trade #04

| Ouvrage | État | Ouvrages à enrichir | Ouvrages à créer |
|---|:-:|:-:|:-:|
| 4.1 Mur parpaings | 🟡 | 5 matériaux + hypothèses | – |
| 4.2 Mur brique monomur | 🟡 | 5 matériaux + hypothèses | – |
| 4.3 Mur brique TC tradi | 🔴 | – | recette complète |
| 4.4 Mur pierre | 🔴 | – | recette complète (chaux NHL) |
| 4.5 Mur béton cellulaire | 🔴 | – | recette complète |
| 4.6 Enduit ext. | 🔴 | – | 2 recettes (multi + mono) |

**Volume correctif estimé** :
- 10 matériaux à ajouter aux 2 recettes existantes
- 5 nouvelles recettes à créer
- Hypothèses consolidées × 2 recettes existantes

**Temps d'implémentation** : ~2 h 30

---

## ✅ Statut audit #04

- [x] Vérification normative NF DTU 20.1 rev. 2020 — source CSTB
- [x] Vérification NF DTU 26.1 (enduits) — structure gobetis/corps/finition
- [x] Inventaire état actuel
- [x] Identification manques par strate
- [x] Formulation correctifs TypeScript (5 nouveaux matériaux par recette existante + structures de 5 nouvelles recettes)
- [x] Tests de validation formalisés
- [ ] **Implémentation code** : attente validation user pour lancer P3 (refonte `ouvrages.ts`)

**Prochain audit** : #02 Fondations (critique Vague 1).

---

**Sources normatives vérifiées** :
- [NF DTU 20.1 — CSTB Boutique](https://boutique.cstb.fr/Detail/Documents-Techniques-Unifies/DTU-NF-DTU/20-Maconneries/NF-DTU-20-1-Ouvrages-en-maconnerie-de-petits-eleme)
- [Le Moniteur — révision NF DTU 20.1](https://www.lemoniteur.fr/article/maconnerie-revision-du-nf-dtu-20-1.2098294)
- [Bâtirama — NF DTU 26.1](https://www.batirama.com/article/10907-nf-dtu-26.1-travaux-d-enduits-de-mortier.html)
- [Cahiers Techniques Bâtiment — enduits monocouches au DTU](https://www.cahiers-techniques-batiment.fr/article/enduits-de-mortiers-les-monocouches-entrent-au-dtu.21289)
