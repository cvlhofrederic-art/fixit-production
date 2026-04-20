# Audit #14 — Menuiseries intérieures

**Trade** : `menuiserie_int` (nouveau)
**Référentiels FR** :
- **NF DTU 36.2** — Menuiseries intérieures en bois
- **NF DTU 51.1** — Parquet massif cloué
- **NF DTU 51.2** — Parquet collé
- **NF DTU 51.3** — Parquet flottant sur lambourdes
- **NF DTU 51.11** — Parquet flottant / stratifié

**Ouvrages couverts** : 6
- 14.1 Porte intérieure
- 14.2 Placards / dressings
- 14.3 Escaliers bois
- 14.4 Parquet massif cloué
- 14.5 Parquet flottant / stratifié
- 14.6 Plinthes

---

## 14.1 Porte intérieure

### 📚 Référence
- **NF DTU 36.2** §5 (pose), §6 (quincaillerie)

### État actuel : 🔴 ABSENT

### Structure cible (par unité)

#### Strate 2 — Principal
- **Bloc-porte complet** (dormant 70-83×203 + vantail + joint)
  - Formule : `1` u
  - Fabricant : Eclisse, Tordjman, Sofrappo
  - Prix : 80-250 € selon finition

- **Huisserie bois** (si non incluse dans bloc-porte)
  - Formule : `1` u

#### Strate 3 — Accessoires (obligatoire)
- **Serrure + cylindre** (type BT : bec-de-cane pour intérieur, chiffre pour WC/SDB)
- **Paumelles** (3 u standard)
- **Poignées** (2 × béquille)
- **Butoir mural** (anti-choc)

#### Strate 4 — Finitions
- **Cale bois + mousse PU** (réglage)
- **Joint chambranle** (mastic ou kit)
- **Cornière bois ou plinthe murale** (jonction avec mur)

### 🧪 Test
**Input** : « 5 portes intérieures standard 83×204 »
**Output** : 5 blocs-portes + 5 serrures + 15 paumelles + 10 poignées + mousse PU + butoirs.

---

## 14.2 Placards / dressings

### État actuel : 🔴 ABSENT

### Structure cible
- **Portes coulissantes** (miroir, bois, verre) — 2-3 vantaux/placard
- **Rails + guides** haut/bas
- **Panneaux séparation intérieur** (tablard, penderie)
- **Quincaillerie** (poignées, roulettes)

### 🧪 Test
**Input** : « Placard 2 portes coulissantes 2 m largeur »
**Output** : 2 portes + rails + tablards + pendeur + poignées.

---

## 14.3 Escaliers bois

### 📚 Référence
- **NF DTU 36.2** §8 — Escaliers

### État actuel : 🔴 ABSENT

### Structure cible (escalier 1/4 tournant 14 marches)

#### Principal
- **Marches bois** (14 u) — hêtre, chêne, sapin selon essence
- **Contremarches** (14 u)
- **Limons** (2 u latéraux ou 1 central)
- **Balustres** (1 par marche généralement)
- **Main courante** bois
- **Poteau d'appui haut/bas**
- **Vis + chevilles** fixation

### 🧪 Test
**Input** : « Escalier bois droit 14 marches »
**Output** : 14 marches + 14 contremarches + 2 limons + 14 balustres + 1 main courante + poteaux + vis.

---

## 14.4 Parquet massif cloué

### 📚 Référence
- **NF DTU 51.1** — Parquet massif cloué

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 1 — Préparation
- **Lambourdes bois 27×50** — espacement 30-40 cm
  - Formule : `surface × 3` ml (lambourdes parallèles)
  - Pertes : 10%
  - Classe 2

- **Isolant acoustique entre lambourdes** (laine minérale 40 mm)
  - Formule : `surface × 0.85` m² (déduction lambourdes)

#### Strate 2 — Principal
- **Lames parquet massif** (chêne, hêtre, douglas)
  - Formule : `surface × 1.1` m²
  - Pertes : 10%

- **Clous parquet** (tête perdue 2,5×50)
  - Formule : `surface × 12` u

#### Strate 4 — Finitions
- **Huile ou vitrificateur** — 2 couches
  - Formule : `surface × 0.15` L/couche × 2 = 0,3 L/m²

### 🧪 Test
**Input** : « Parquet massif cloué chêne 30 m² »
**Output** : 33 m² lames + 90 ml lambourdes + 26 m² laine + 360 clous + 9 L vitrificateur.

---

## 14.5 Parquet flottant / stratifié

### 📚 Référence
- **NF DTU 51.11** — Parquet flottant

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 1 — Préparation
- **Sous-couche acoustique** (mousse PE 3 mm ou équivalent)
  - Formule : `surface × 1.05` m²
- **Film polyane sous sous-couche** (barrière humidité)
  - Formule : `surface × 1.1` m²
- **Ragréage** (si planéité insuffisante) — optionnel

#### Strate 2 — Principal
- **Lames stratifié ou contrecollé** (1,20 × 0,20 m typique)
  - Formule : `surface × 1.08` m²
  - Pertes : 8%
  - Fabricant : Quick-Step, Tarkett, Egger

#### Strate 3 — Accessoires
- **Cales de dilatation** (8-10 mm périphérique) — `perimetre × 3` u
- **Joints de dilatation** (surface > 50 m² ou longueur > 8 m) — nez seuil alu

### 🧪 Test
**Input** : « Parquet flottant 40 m² »
**Output** : 43 m² lames + 42 m² sous-couche + 44 m² polyane + cales + nez seuil.

---

## 14.6 Plinthes

### État actuel : 🔴 ABSENT

### Structure cible
- **Plinthes bois ou MDF** (assorties parquet) — hauteur 6-10 cm
  - Formule : `perimetre × 1.1` ml
- **Clous ou colle** fixation
- **Angles pré-découpés** (intérieur/extérieur)

### 🧪 Test
**Input** : « Plinthes 40 ml »
**Output** : 44 ml plinthes + clous + angles.

---

## 📋 Synthèse trade #14

| Ouvrage | État | À créer |
|---|:-:|:-:|
| 14.1 Porte intérieure | 🔴 | recette (7 matériaux) |
| 14.2 Placards | 🔴 | recette (5 matériaux) |
| 14.3 Escaliers bois | 🔴 | recette (7 matériaux) |
| 14.4 Parquet massif | 🔴 | recette (6 matériaux) |
| 14.5 Parquet flottant | 🔴 | recette (5 matériaux) |
| 14.6 Plinthes | 🔴 | recette (3 matériaux) |

**Volume à créer** : 6 recettes, ~33 matériaux.
**Temps impl.** : ~2 h.
