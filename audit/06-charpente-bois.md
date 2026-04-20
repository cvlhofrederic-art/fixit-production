# Audit #06 — Charpente bois

**Trade** : `charpente` (nouveau)
**Référentiels FR** :
- **NF DTU 31.1** — Charpentes et escaliers en bois (rev. 2017)
- **NF DTU 31.2** — Construction de maisons et bâtiments à ossature en bois (rev. 2019 + A1 2021)
- **NF DTU 31.3** — Charpentes industrielles en bois (fermettes)
- **NF DTU 31.4** — Façades à ossature bois
- **Eurocode 5** (NF EN 1995-1-1) — conception structures bois

**Référentiel PT** : NP EN 1995 + NP EN 14081 (classement résistance bois)

**Ouvrages couverts** : 4
- 6.1 Charpente traditionnelle
- 6.2 Charpente industrielle (fermettes)
- 6.3 Maison à ossature bois (MOB murs)
- 6.4 Lamellé-collé (poutres structurelles)

---

## 6.1 Charpente traditionnelle

### 📚 Référence
- **NF DTU 31.1** — §5 (matériaux), §6 (assemblages), §7 (traitement)
- Eurocode 5 pour dimensionnement

### État actuel : 🔴 ABSENT

### Structure cible (charpente 2 pans maison standard)

#### Strate 2 — Principal
- **Pannes sablières** (en appui sur murs, section 75×200 ou 100×200)
  - Formule : `longueur_pan × 2` ml (2 sablières par pan)
  - Pertes : 10%
  - Essence : résineux C18-C24 (NF EN 14081)

- **Pannes faîtière + pannes intermédiaires**
  - Formule : `longueur × 3` ml (1 faîtière + 2 intermédiaires)

- **Chevrons** (section 63×75 ou 75×100)
  - Formule : `surface_rampant / 0.55` ml (entraxe 50-60 cm)
  - Pertes : 10%

- **Arbalétriers** (si fermes)
  - Formule : `nb_fermes × 2 × longueur_pan` ml

#### Strate 3 — Accessoires
- **Sabots, étriers** (fixation pannes → chevrons OU chevrons → arbalétriers)
  - Formule : `nb_chevrons × 2` u
  - Fabricant : Simpson Strong-Tie

- **Boulons traversants Ø12** — jonctions pannes/murs
  - Formule : `nb_pannes × 4` u

- **Équerres** — Simpson Strong-Tie

- **Vis tirefond 8×140** — fixation des assemblages

- **Clous 6×180** (si assemblages cloués traditionnels)

#### Strate 4 — Finitions
- **Traitement fongicide/insecticide** obligatoire classe 2
  - Formule : `volume_bois × 10` L/m³ bois (saturation)
  - Fabricant : Xyladecor / Remmers
  - *Note : le traitement est le plus souvent fait usine, vérifier*

### 🔧 Correctif : recette `charpente-tradi`

### 🧪 Test
**Input** : « Charpente tradi maison 10×8 m, pente 35° »
**Output** : 32 m² rampant → ~60 ml chevrons + 30 ml pannes + sabots + boulons + traitement.

---

## 6.2 Charpente industrielle (fermettes)

### 📚 Référence
- **NF DTU 31.3** — Fermettes industrielles

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal
- **Fermettes préfabriquées** (assemblées en usine par connecteurs métalliques)
  - Formule : `longueur_batiment / 0.6` u (entraxe 60 cm)
  - Pertes : 5%
  - Fabricant : Alpha / Charpentes Françaises
  - Conditionnement : livraison montée sur chantier

- **Liteaux de contreventement** (diagonales de stabilité)
  - Formule : `longueur × 2` ml

- **Entretoises**
  - Formule : `nb_fermes × 1` ml

#### Accessoires
- **Sabots Simpson sablière/fermette**
- **Vis/clous fixation**

### 🧪 Test
**Input** : « Charpente fermette 10×8 m »
**Output** : 16 fermettes + contreventement + sabots.

---

## 6.3 Maison à ossature bois (MOB) — murs

### 📚 Référence
- **NF DTU 31.2** rev. 2019 (+ A1 2021) — Construction MOB

### État actuel : 🔴 ABSENT

### Structure cible (par m² de mur)

#### Strate 1 — Préparation
- **Lisse basse** (45×145 ou 45×220 selon iso)
  - Formule : `longueur_murs × 1.05` ml
  - Classe 4 (contact sol)

#### Strate 2 — Principal
- **Montants 45×145** tous 60 cm (ou 45×220 si iso renforcée)
  - Formule : `longueur_murs × (1 / 0.6) × hauteur` ml
  - Pertes : 10%
  - Classe 2 (intérieur) ou 3 (pluie occasionnelle)

- **Lisse haute** (idem montants)
  - Formule : `longueur × 1.05` ml

- **Voile de contreventement OSB 3 18 mm** (côté intérieur) OU contreventement diagonal
  - Formule : `surface_murs × 1.05` m²
  - Ref : NF DTU 31.2 §5.3

- **Pare-pluie HPV** (côté extérieur)
  - Formule : `surface × 1.1` m²

- **Isolation laine minérale 145 mm** (entre montants)
  - Formule : `surface × 0.9` m² (déduction montants ≈ 10%)

#### Strate 3 — Accessoires
- **Vis tirefonds 6×140** (assemblage lisse/montant)
- **Clous spi 2,8×63** (fixation OSB)
- **Équerres fixation lisse basse**
- **Cheville chimique béton** (ancrage dalle)
- **Bande d'arase** sous lisse basse

### 🔧 Correctif : recette `mob-murs`

### 🧪 Test
**Input** : « Mur MOB 30 m², hauteur 2,80 m »
**Output** : 11 ml lisses + 145 ml montants + 31,5 m² OSB + 33 m² pare-pluie + 27 m² iso 145 mm + fixations.

---

## 6.4 Lamellé-collé (poutres structurelles)

### 📚 Référence
- **NF DTU 31.1** §4.2 — Bois lamellé-collé structural
- **NF EN 14080** — Lamellé-collé

### État actuel : 🔴 ABSENT

### Structure cible
- **Poutre lamellé-collé GL24h** ou GL28h (section 160×500, 200×600 typique)
  - Formule : `longueur × 1` ml
  - Conditionnement : sur mesure
  - Fabricant : Schilliger / Weinmann / Hasslacher

- **Appuis béton** (si portée grande) — à coffrer à part
- **Sabots d'appui Simpson large section** (WM / HWS)

### 🧪 Test
**Input** : « Poutre LC GL24h 200×600 × 6 ml »
**Output** : 1 poutre LC + sabots + fixations.

---

## 📋 Synthèse trade #06

| Ouvrage | État | À créer |
|---|:-:|:-:|
| 6.1 Charpente tradi | 🔴 | recette complète (10 matériaux) |
| 6.2 Fermettes | 🔴 | recette (5 matériaux) |
| 6.3 MOB murs | 🔴 | recette (11 matériaux) |
| 6.4 Lamellé-collé | 🔴 | recette (4 matériaux) |

**Volume à créer** : 4 recettes, ~30 matériaux.
**Temps impl.** : ~2 h 30.
