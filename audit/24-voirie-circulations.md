# Audit #24 — Voirie & circulations extérieures

**Trade** : `voirie_ext` (nouveau)
**Référentiels FR** :
- **NF DTU 13.3** — Dallages (cf. #03 si dallage extérieur)
- **NF P98-331** — Tranchées
- **NF EN 13242** — Granulats
- **Fascicule 25** (CCTG) — chaussées enrobé

**Ouvrages couverts** : 5
- 24.1 Enrobé (asphalte)
- 24.2 Pavés autobloquants / béton
- 24.3 Dalles béton / pierre
- 24.4 Stabilisé / graviers
- 24.5 Bordures & caniveaux

---

## 24.1 Enrobé

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 1 — Préparation
- **Grave naturelle 0/31,5** (forme de fondation 20 cm)
  - Formule : `surface × 0.20` m³
  - Compactage obligatoire
- **Géotextile** (sous forme, si sol argileux)
  - Formule : `surface × 1.1` m²

#### Strate 2 — Principal
- **Enrobé à chaud BBSG 0/10** (6-8 cm épaisseur)
  - Formule : `surface × 0.08 × 2400` kg (densité 2,4 t/m³)
  - Conditionnement : camion 10-20 t
  - Fabricant : Colas, Eurovia, Eiffage

### 🧪 Test
**Input** : « Cour enrobé 100 m² épaisseur 6 cm »
**Output** : 20 m³ grave + 110 m² géotextile + 14,4 t enrobé.

---

## 24.2 Pavés autobloquants

### État actuel : 🔴 ABSENT

### Structure cible

#### Préparation
- Grave 0/31,5 (15 cm fondation)
- Géotextile
- **Lit de pose sable 0/4** (3-5 cm)
  - Formule : `surface × 0.04` m³

#### Principal
- **Pavés autobloquants béton** (format 20×10×6 ou 22×11×6)
  - Formule : `surface × 1.05` m²
  - Pertes : 5% (coupes)
  - Fabricant : Bradstone, Alkern
  - Conditionnement : palette 8-12 m²

#### Accessoires
- **Sable polymère joints** (solidification interstices)
  - Formule : `surface × 5` kg
  - Fabricant : Romex, Techniseal

### 🧪 Test
**Input** : « Allée pavés 30 m² »
**Output** : 4,5 m³ grave + 1,2 m³ sable + 31,5 m² pavés + 150 kg sable polymère.

---

## 24.3 Dalles béton / pierre

### Structure cible
- Identique 24.2 sauf dalles (grands formats 40×40, 50×50, 60×60)
- Pose sur sable ou mortier maigre

### 🧪 Test
**Input** : « Dalles béton 50×50, 20 m² »
**Output** : fondation + 21 m² dalles + mortier scellement.

---

## 24.4 Stabilisé / graviers

### État actuel : 🔴 ABSENT

### Structure cible
- **Forme grave**
- **Stabilisé calcaire blanc 0/6 ou 0/10** (couche finition 5-8 cm)
  - Formule : `surface × 0.08` m³
- **Arrosage/stabilisation** (eau + liant hydraulique léger)

### 🧪 Test
**Input** : « Allée stabilisé 50 m² »
**Output** : 10 m³ grave + 4 m³ stabilisé.

---

## 24.5 Bordures & caniveaux

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal
- **Bordures béton T2/CS1/A2** (selon type)
  - Formule : `longueur × 1` ml
  - Fabricant : Alkern, Bonna Sabla
- **Béton de scellement** (C20/25)
  - Formule : `longueur × 0.05` m³ (massif 30×15 cm)

### 🧪 Test
**Input** : « Bordures 25 ml »
**Output** : 25 ml bordures + 1,25 m³ béton.

---

## 📋 Synthèse trade #24

| Ouvrage | État | À créer |
|---|:-:|:-:|
| 24.1 Enrobé | 🔴 | recette (4 matériaux) |
| 24.2 Pavés | 🔴 | recette (5 matériaux) |
| 24.3 Dalles | 🔴 | recette (4 matériaux) |
| 24.4 Stabilisé | 🔴 | recette (3 matériaux) |
| 24.5 Bordures | 🔴 | recette (2 matériaux) |

**Volume** : 5 recettes, ~18 matériaux.
**Temps impl.** : ~1 h 30.
