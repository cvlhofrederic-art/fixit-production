# Audit #11 — Façade & bardage

**Trade** : `facade` (nouveau)
**Référentiels FR** :
- **NF DTU 26.1** — Enduits aux mortiers (cf. #04)
- **NF DTU 42.1** — Revêtements extérieurs en polymère (pâteux)
- **NF DTU 41.2** — Bardage bois et panneaux dérivés
- **NF DTU 33.1** — Façades légères
- **RE2020** — Performance thermique & perméabilité

**Ouvrages couverts** : 6
- 11.1 Enduit monocouche (prêt à l'emploi)
- 11.2 Enduit multicouche traditionnel
- 11.3 Bardage bois sur ossature
- 11.4 Bardage composite / fibre-ciment
- 11.5 Bardage métallique (bac acier, zinc)
- 11.6 Vêture (panneaux rigides collés)

---

## 11.1 Enduit monocouche

### 📚 Référence
- **NF DTU 26.1** + **NF EN 998-1** (mortiers prêts)
- Cahier CSTB 3678 (enduits monocouches)

### État actuel : 🔴 ABSENT (inclus partiellement en #04.6 comme alternative)

### Structure cible

#### Strate 1 — Préparation
- **Nettoyage support + humidification** (main d'œuvre)
- **Grillage armature** (jonctions changements de matériau — obligatoire)
  - Formule : `longueur_jonctions × hauteur` m²

#### Strate 2 — Principal
- **Enduit monocouche prêt à l'emploi** (pâteux ou hydraulique)
  - Formule : `surface × 25` kg (15 kg/m²/cm × 15-18 mm d'épaisseur)
  - Pertes : 15% (projection + taloches)
  - Fabricant : Weber.monorex, Parex Lanko, PRB

#### Strate 3 — Accessoires
- **Cornières d'angle PVC avec treillis**
  - Formule : `perimetre_angles × 1` ml
- **Profilés de départ alu** (en pied de façade)
  - Formule : `longueur × 1` ml

### 🧪 Test
**Input** : « Enduit monocouche 100 m² »
**Output** : 2,5 t enduit + cornières + profilés de départ + grillage si jonctions.

---

## 11.2 Enduit multicouche traditionnel

### État actuel : 🔴 ABSENT — déjà audité en #04.6
Renvoi à l'audit #04 pour détail complet (gobetis + corps + finition).

---

## 11.3 Bardage bois sur ossature

### 📚 Référence
- **NF DTU 41.2** — §5 (pose), §6 (traitement), §7 (fixations)

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 1 — Préparation
- **Pare-pluie HPV** (étanchéité à l'air + perméable vapeur)
  - Formule : `surface × 1.1` m²
  - Fabricant : Delta Maxx, Isover Vario, Siga Majpell
  - Pertes : 10%

- **Tasseaux ossature bois 40×50** (classe 2 minimum, entraxe 60 cm)
  - Formule : `surface × 1.67` ml (tasseaux verticaux)
  - Pertes : 10%
  - Ref : NF DTU 41.2 §5.3

#### Strate 2 — Principal
- **Lames de bardage bois** (sapin, mélèze, douglas, red cedar — classe 3 min)
  - Formule : `surface × 1.1` m² (recouvrements + pertes)
  - Pertes : 15%
  - Fabricant : ThermoWood, Piveteau

#### Strate 3 — Accessoires
- **Vis inox A2 (ou A4 bord de mer)** — NF DTU 41.2 §7
  - Formule : `surface × 20` u (1 vis tous 20 cm × 3 rangées)
  - Pertes : 10%

- **Grille anti-rongeurs** (en pied + haut)
  - Formule : `longueur × 2` ml

- **Profils de départ / finition alu**
  - Formule : `longueur × 1` ml

#### Strate 4 — Finitions / Traitement
- **Traitement fongicide/insecticide/imprégnation** (si bardage non pré-traité)
  - Formule : `surface × 0.5` L
- **Lasure** (si finition couleur) — à prévoir en peinture

### 🧪 Correctif : recette `bardage-bois-claire-voie`

### 🧪 Test
**Input** : « Bardage douglas 50 m² »
**Output** : 55 m² lames + 55 m² pare-pluie + 84 ml tasseaux + 1 100 vis inox + grille + profils.

---

## 11.4 Bardage composite / fibre-ciment

### 📚 Référence
- **NF DTU 41.2** + ATEC fabricant (Eternit Cedral, James Hardie)

### État actuel : 🔴 ABSENT

### Structure cible (quasi identique 11.3)
- Pare-pluie + tasseaux identiques
- Lames fibre-ciment **Cedral** (Eternit) ou HardiePlank
- Vis fabricant spécifiques (tête peinte)
- Finition pré-peinte usine (pas de traitement)

### 🧪 Test
**Input** : « Bardage Cedral 40 m² »
**Output** : 44 m² Cedral + pare-pluie + tasseaux + vis spé + profils.

---

## 11.5 Bardage métallique (bac acier / zinc)

### Structure cible
- Ossature identique (tasseaux) + pare-pluie
- **Bac acier nervuré ou zinc joint debout** (vertical ou horizontal)
- Vis autoforeuses + rondelles EPDM
- Closoirs + cornières

### 🧪 Test
**Input** : « Bardage bac acier 50 m² »
**Output** : 52,5 m² bac + pare-pluie + tasseaux + vis + closoirs.

---

## 11.6 Vêture (panneaux collés)

### État actuel : 🔴 ABSENT

### Structure cible
- Panneaux rigides (fibre-ciment, pierre reconstituée, minéral)
- Collage MAP + chevillage
- Joints spécifiques (silicone ou joints secs)

### 🧪 Test
**Input** : « Vêture pierre reconstituée 30 m² »
**Output** : 31,5 m² panneaux + MAP + chevilles + silicone.

---

## 📋 Synthèse trade #11

| Ouvrage | État | À créer |
|---|:-:|:-:|
| 11.1 Enduit monocouche | 🔴 | recette (5 matériaux) |
| 11.2 Enduit multicouche | 🔴 | cf. #04.6 |
| 11.3 Bardage bois | 🔴 | recette (9 matériaux) |
| 11.4 Bardage composite | 🔴 | recette clone 11.3 |
| 11.5 Bardage métallique | 🔴 | recette (7 matériaux) |
| 11.6 Vêture | 🔴 | recette (4 matériaux) |

**Volume à créer** : 5 recettes, ~32 matériaux.
**Temps impl.** : ~2 h 30.
