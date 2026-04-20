# Audit #10 — Isolation thermique

**Trade** : `isolation` (nouveau)
**Référentiels FR** :
- **NF DTU 45.1** — Isolation des combles aménagés (laines minérales)
- **NF DTU 45.10** — Isolation combles perdus (en soufflage)
- **NF DTU 45.4** — Isolation des murs par l'intérieur (doublage)
- **NF DTU 41.2** — Bardage rapporté (ITE avec bardage)
- **NF DTU 45.11** — Isolation toitures inclinées type sarking
- **RE2020** — Réglementation environnementale (depuis 2022)

**Référentiel PT** : REH (DL 101-D/2020) — performance énergétique

**Ouvrages couverts** : 5
- 10.1 ITE (Isolation Thermique Extérieure) — sous enduit
- 10.2 ITI (Isolation Thermique Intérieure) — doublage sur ossature
- 10.3 Isolation combles perdus (soufflage)
- 10.4 Isolation combles aménagés / rampants
- 10.5 Isolation sarking (sur chevrons en toiture)

---

## 10.1 ITE — Isolation Thermique Extérieure sous enduit

### 📚 Référence
- **Cahier CSTB 3035** + **NF DTU 45.4** (référence)
- ETE (Évaluation Technique Européenne) + ATE/DTA fabricants

### État actuel : 🔴 ABSENT

### Structure cible (PSE gris 120 mm collé-chevillé)

#### Strate 1 — Préparation
- **Primaire d'accrochage** (si support faiblement absorbant)
  - Formule : `surface × 0.15` L

- **Rail de départ alu** (en pied de façade, protection PSE)
  - Formule : `longueur_pied × 1` ml
  - Pertes : 10%
  - Fabricant : Weber, Parex, PRB

#### Strate 2 — Principal
- **Panneau PSE gris 120 mm** (ou laine minérale rigide)
  - Formule : `surface × 1.05` m² (coupes)
  - Pertes : 5%
  - Fabricant : Knauf Therm ITEx Ultra, Efisol
  - Conditionnement : paquet de 2 à 3 m² (format 1,20 × 0,60)

- **Mortier colle ITE** (collage PSE sur support)
  - Formule : `surface × 5` kg
  - Pertes : 10%
  - Fabricant : Weber Therm ITE XM, Parex

#### Strate 3 — Accessoires
- **Chevilles à frapper PSE (PSE 15 cm)** (fixation mécanique complémentaire)
  - Formule : `surface × 6` u (6 chevilles/m² — Cahier CSTB 3035)
  - Ref : Ejot STR, Fischer Termoz

- **Treillis armature** (marouflage avant enduit)
  - Formule : `surface × 1.15` m² (recouvrements 10 cm)
  - Pertes : 15%

- **Sous-enduit / mortier armé** (couche d'armature)
  - Formule : `surface × 4` kg

- **Primaire régulateur** avant finition

#### Strate 4 — Finitions
- **Enduit de finition** (hydraulique ou pâteux)
  - Formule : `surface × 3` kg (coup grains fins 1 mm)
  - Fabricant : Weber.monorex ITE

- **Profils d'angle / de rive** (PVC ou alu avec treillis intégré)
  - Formule : `perimetre_angles × 1` ml

### 🔧 Correctif : recette `ite-pse-sous-enduit`

### 🧪 Test
**Input** : « ITE PSE 120 mm sur 80 m² façade »
**Output** : 84 m² PSE + 400 kg colle + 480 chevilles + 92 m² treillis + 320 kg sous-enduit + 240 kg enduit fin + profils.

---

## 10.2 ITI — Isolation Thermique Intérieure (doublage)

### 📚 Référence
- **NF DTU 45.4** + **NF DTU 25.41** (si sur ossature)

### État actuel : 🟡 — existe `doublage-placomur-pse` (option cloison-98), à enrichir

### Structure cible
Déjà audité en #13.4 (doublage collé). Renvoi vers cet audit.

---

## 10.3 Isolation combles perdus (soufflage)

### 📚 Référence
- **NF DTU 45.10** — Isolation combles perdus

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 1 — Préparation
- **Pare-vapeur** (si toit chaud — contre condensation)
  - Formule : `surface_plancher × 1.1` m²
  - Ref : NF DTU 45.10 §5.4
  - Fabricant : Siga Majpell / Isover Vario Duplex

- **Déflecteurs** aux entrées d'air (bouches d'aération rampants)
  - Formule : `longueur_egout × 1` u par chevron
  - Ref : NF DTU 40.29

#### Strate 2 — Principal
- **Laine minérale soufflée** (laine verre ou roche)
  - Formule : `surface × epaisseur × densité` kg
  - Épaisseur RE2020 : 350-400 mm (R > 7 m²K/W)
  - Densité 14 kg/m³ → 350 mm = 4,9 kg/m²
  - Fabricant : Isover Comblissimo, Ursa Silver Hub
  - Conditionnement : sac 14 à 22 kg

- **Ouate de cellulose** (alternative — souffler)
  - Densité 35 kg/m³ → 350 mm = 12 kg/m²
  - Fabricant : Igloo France Cellulose

#### Strate 3 — Accessoires
- **Règle de contrôle épaisseur** (piquets de contrôle — 1/20 m²)
- **Capot d'isolation trappe accès** (obligatoire — pertes thermiques)

### 🧪 Test
**Input** : « Combles perdus 80 m² soufflage laine de verre 350 mm »
**Output** : 392 kg laine (28 sacs 14 kg) + 88 m² pare-vapeur + 4 piquets + capot trappe.

---

## 10.4 Isolation combles aménagés / rampants

### 📚 Référence
- **NF DTU 45.1** — Isolation combles aménagés

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 1 — Préparation
- **Écran sous-toiture HPV** (si charpente tradi — pas déjà posé)
- **Pare-vapeur** (obligatoire côté chaud)

#### Strate 2 — Principal
- **Laine minérale en rouleau 200 + 100 mm** (bi-couche croisée, R > 6,5)
  - Formule : `surface_rampant × 1.05 × 2` (2 couches)
  - Ref : NF DTU 45.1 §5
  - Fabricant : Isover GR32, Ursa Saverex

- **Suspentes + fourrures** (si finition placo plafond cintré)
  - Formule : `surface × 5` u (suspentes)
  - Formule : `surface × 1.67` ml (fourrures entraxe 60 cm)

- **Plaques BA13** (plafond rampant — face intérieure)
  - Formule : `surface × 1.05` m²

#### Strate 3 — Accessoires
- Bande d'étanchéité à l'air (raccords pare-vapeur / mur)
- Vis TTPC, bande joints, enduit

### 🧪 Test
**Input** : « Combles aménagés 60 m² rampant »
**Output** : 63 × 2 = 126 m² laine + 60 m² pare-vapeur + 100 m² plaques BA13 + suspentes + fourrures.

---

## 10.5 Sarking (isolation sur chevrons en toiture)

### 📚 Référence
- **NF DTU 45.11** — Isolation supports discontinus par-dessus

### État actuel : 🔴 ABSENT

### Structure cible
- Panneau isolant rigide PIR/PUR 120 mm sur volige
- Pare-vapeur côté chaud
- Contre-liteaux + liteaux en surimpression
- Vis/fixations longueur adaptée (traversent isolant)

### 🧪 Test
**Input** : « Sarking 40 m² PIR 120 mm »
**Output** : 42 m² PIR + 44 m² pare-vapeur + contre-liteaux + vis spéciales.

---

## 📋 Synthèse trade #10

| Ouvrage | État | À créer |
|---|:-:|:-:|
| 10.1 ITE | 🔴 | recette (12 matériaux) |
| 10.2 ITI | 🟡 | couvert par #13.4 |
| 10.3 Combles perdus soufflage | 🔴 | recette (5 matériaux) |
| 10.4 Combles aménagés | 🔴 | recette (8 matériaux) |
| 10.5 Sarking | 🔴 | recette (5 matériaux) |

**Volume à créer** : 4 recettes, ~30 matériaux.
**Temps impl.** : ~2 h.
