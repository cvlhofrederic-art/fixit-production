# Audit #15 — Revêtements de sol

**Trade** : `carrelage` (existant — à étendre en `revetement_sol`)
**Référentiels FR** :
- **NF DTU 52.1** — Revêtements de sol scellés (grès, pierre)
- **NF DTU 52.2** — Revêtements céramiques collés
- **NF DTU 53.1** — Revêtements textile (moquette)
- **NF DTU 53.2** — Revêtements PVC / linoléum
- **NF DTU 54.1** — Revêtements coulés (résine)
- **NF DTU 51.11** — Parquet flottant (cf. #14)

**Ouvrages couverts** : 6
- 15.1 Carrelage sol collé (existant — enrichi)
- 15.2 Sol PVC / lino (lé, dalles)
- 15.3 Moquette
- 15.4 Parquet stratifié (cf. #14.5)
- 15.5 Béton ciré
- 15.6 Résine époxy / polyuréthane

---

## 15.1 Carrelage sol collé

### État actuel : 🟡 — existe `carrelage-sol-colle-45` et `-60`, enrichi en avril 2026

Audit déjà fait (préparation/accessoires/finitions).

### Manques complémentaires

#### Strate 3 — Accessoires
- 🔴 **Nez de marche aluminium** (si marche dans parcours)
  - Formule : `nb_marches × 1` u
  - Conditionnement : longueur 2 m

- 🔴 **Profils de dilatation** (obligatoire si surface > 40 m² ou côté > 8 m)
  - Formule : `max(0, sqrt(surface) > 8 ? surface / 40 : 0)` ml
  - Ref : NF DTU 52.2 §7.3
  - Fabricant : Schlüter-Systems Dilex

### 🔧 Correctif : ajouter à recettes existantes `carrelage-sol-colle-*`.

---

## 15.2 Sol PVC / lino

### 📚 Référence
- **NF DTU 53.2** — Revêtements PVC

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 1 — Préparation
- **Ragréage autolissant P3** (obligatoire si planéité insuffisante)
  - Formule : `surface × 5` kg (3 mm moyenne)
- **Primaire d'accrochage**
  - Formule : `surface × 0.15` L

#### Strate 2 — Principal
- **PVC en lé** (largeur 2 ou 4 m) OU **dalles PVC** (50×50)
  - Formule : `surface × 1.05` m² (chutes)
  - Pertes : 5% lé, 10% dalles
  - Fabricant : Tarkett, Gerflor, Forbo

- **Colle PVC** (acrylique ou vinyle)
  - Formule : `surface × 0.4` kg
  - Pertes : 10%
  - Conditionnement : seau 5 à 20 kg

#### Strate 3 — Accessoires
- **Plinthes PVC assorties** (hauteur 6 cm)
  - Formule : `perimetre × 1.1` ml
- **Profils de seuil / raccord** (entre pièces)
- **Soudure chimique** (jonctions entre lés si sol hospitalier)

#### Strate 4 — Finitions
- **Nettoyage + émulsion protectrice** (kit entretien)

### 🧪 Test
**Input** : « Sol PVC en lé 30 m² + plinthes »
**Output** : 31,5 m² PVC + ragréage + primaire + 12 kg colle + 25 ml plinthes + profils.

---

## 15.3 Moquette

### 📚 Référence
- **NF DTU 53.1** — Moquette

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 1 — Préparation
- Ragréage (si nécessaire)
- Primaire

#### Strate 2 — Principal
- **Moquette** (rouleau 4 m largeur) — moquette LDF vélomé ou aiguilletée
  - Formule : `surface × 1.1` m²
  - Pertes : 10%

- **Colle moquette** (si pose collée) OU **bande bi-adhésive périphérique** (pose tendue)
  - Formule collée : `surface × 0.3` kg

#### Strate 3 — Accessoires
- **Plinthes bois ou PVC** — `perimetre × 1.1` ml
- **Profils seuil**
- **Sous-couche** (feutre, mousse — si confort)

### 🧪 Test
**Input** : « Moquette 25 m² pose collée »
**Output** : 27,5 m² moquette + 7,5 kg colle + 22 ml plinthes.

---

## 15.4 Parquet stratifié / flottant
Audité en #14.5.

---

## 15.5 Béton ciré

### État actuel : 🔴 ABSENT

### Structure cible
- **Chape ragréage fibrée** (support)
- **Primaire** béton ciré
- **Mortier béton ciré** (2 passes)
- **Cire ou vernis PU** (finition protection)

### 🧪 Test
**Input** : « Béton ciré 20 m² »
**Output** : primaire + 40 kg mortier + cire.

---

## 15.6 Résine époxy / polyuréthane

### 📚 Référence
- **NF DTU 54.1** — Revêtements coulés

### État actuel : 🔴 ABSENT

### Structure cible
- Primaire d'accrochage spécial résine
- Résine époxy ou polyuréthane (bicomposant)
- Décor (paillettes, quartz)
- Vernis UV de finition

### 🧪 Test
**Input** : « Résine PU atelier 40 m² »
**Output** : 6 L primaire + 40 kg résine + 10 L vernis.

---

## 📋 Synthèse trade #15

| Ouvrage | État | Action |
|---|:-:|---|
| 15.1 Carrelage | 🟡 | 2 matériaux à ajouter (nez marche, profil dilatation) |
| 15.2 PVC/lino | 🔴 | recette (8 matériaux) |
| 15.3 Moquette | 🔴 | recette (5 matériaux) |
| 15.4 Parquet | 🟡 | cf. #14.5 |
| 15.5 Béton ciré | 🔴 | recette (4 matériaux) |
| 15.6 Résine | 🔴 | recette (4 matériaux) |

**Volume à créer/enrichir** : 4 recettes, 2 matériaux sur existant.
**Temps impl.** : ~1 h 30.
