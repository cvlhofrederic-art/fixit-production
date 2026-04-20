# Audit #09 — Étanchéité

**Trade** : `etancheite` (nouveau)
**Référentiels FR** :
- **NF DTU 43.1** — Étanchéité toitures-terrasses avec éléments porteurs en maçonnerie (rev. nov. 2004 + A1 2007)
- **NF DTU 43.3** — Étanchéité toitures-terrasses tôles acier
- **NF DTU 43.5** — Réfection étanchéité
- **NF DTU 44.1** — Étanchéité joints façades
- **NF DTU 14.1** — Cuvelage (parties enterrées)
- **NF DTU 52.10** — Systèmes d'étanchéité sous carrelage (SPEC pour SDB)

**Ouvrages couverts** : 5
- 9.1 Étanchéité toiture-terrasse inaccessible
- 9.2 Étanchéité toiture-terrasse accessible (lourde)
- 9.3 SPEC sous carrelage douche/SDB
- 9.4 Cuvelage enterré (vide sanitaire, cave)
- 9.5 Drainage périphérique

---

## 9.1 Étanchéité toiture-terrasse inaccessible

### 📚 Référence
- **NF DTU 43.1** — §5 (écran pare-vapeur), §6 (isolation), §7 (membrane étanchéité)

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 1 — Préparation (**obligatoire**)
- **Primaire d'accrochage bitumineux** — DTU 43.1 §5
  - Formule : `surface × 0.3` L
  - Fabricant : Siplast Siplasol / Icopal
  - Conditionnement : bidon 25 L

- **Écran pare-vapeur** (bitume SBS 4 mm)
  - Formule : `surface × 1.1` m²
  - Ref : NF DTU 43.1 §5
  - Fabricant : Siplast, Icopal
  - Conditionnement : rouleau 7,5 m²

#### Strate 2 — Principal (isolation + étanchéité)
- **Isolant thermique** (PIR, PSE, laine de roche haute densité)
  - Formule : `surface × 1.05` m² (épaisseur selon RE2020, 120-160 mm)
  - Conditionnement : panneau 1,20 × 1,00 m
  - Fabricant : Efisol PIR, Rockwool Rockacier

- **Membrane étanchéité bicouche SBS**
  - 1ère couche (élastomère SBS 4 mm) : `surface × 1.1` m²
  - 2ème couche autoprotégée (granulés minéraux) : `surface × 1.1` m²
  - Pertes : 10% (recouvrements 10 cm + chutes)

#### Strate 3 — Accessoires
- **Relevés d'étanchéité** (équerres, mollets, bandes)
  - Formule : `perimetre_toiture × 0.5` m² (relevé 50 cm hauteur)
  - Ref : NF DTU 43.1 §10 (relevés obligatoires 15 cm mini)

- **Costière métallique** (obstacle + jonction acrotère)
  - Formule : `perimetre_toiture × 1` ml

- **Crapaudines** (entrées d'eau pluviales)
  - Formule : `nb_evac × 1` u

#### Strate 4 — Finitions
- **Autoprotection granulés** (couche supérieure)
- **Nettoyage + mise en eau de contrôle**

### 🔧 Correctif : recette `etancheite-toiture-terrasse-inaccessible`

### 🧪 Test
**Input** : « Étanchéité toiture-terrasse 50 m² inaccessible »
**Output** : 55 m² iso + 55 m² pare-vapeur + 110 m² membrane bicouche + 30 m² relevés + 30 ml costière + crapaudines + primaire.

---

## 9.2 Étanchéité toiture-terrasse accessible

### 📚 Référence
- **NF DTU 43.1** + **règles complémentaires CSFE**

### État actuel : 🔴 ABSENT

### Spécifiques accessibilité (vs 9.1)
- **Protection dure** : dalles béton sur plots OU asphalte coulé OU revêtement dallage bois
- Couches supplémentaires :
  - **Écran désolidarisation** (nattes)
  - **Panneaux isolants résistance compression haute** (XPS 300 kPa)
  - **Lestage par dalles béton 50×50** (si toiture-terrasse dalle sur plots)

### 🧪 Test
**Input** : « Toiture-terrasse accessible 30 m² sur plots »
**Output** : isolant XPS + bicouche + écran désolidarisation + dalles béton + plots.

---

## 9.3 SPEC sous carrelage douche/SDB

### 📚 Référence
- **NF DTU 52.10** — Mise en œuvre de systèmes d'étanchéité sous protection carrelage
- **SPEC** = Système de Protection à l'Eau sous Carrelage

### État actuel : 🟡 — existe partiellement en option dans `carrelage-terrasse-spec` mais pas ouvrage autonome pour SDB

### Structure cible

#### Principal
- **Primaire bitumineux** ou époxy (selon système)
- **Membrane SPEC** (en résine liquide bicomposant OU natte étanche avec bande)
  - Formule : `surface × 1.05` m² (au sol + relevés)
  - Fabricant : Mapei Mapegum WPS, Weber.sys Protect, Sika Sanisol
- **Bande d'angle armée** (sur toutes les jonctions sol/mur)
  - Formule : `perimetre_angles × 1` ml
- **Manchettes de bonde / canalisations** (perforations)
  - Formule : `nb_perforations × 1` u

### 🔧 Correctif : recette `spec-douche-sdb`

### 🧪 Test
**Input** : « SPEC douche à l'italienne 4 m² + relevés 50 cm »
**Output** : 4 m² sol SPEC + 6 m² relevés + bande angle + manchette bonde.

---

## 9.4 Cuvelage enterré

### 📚 Référence
- **NF DTU 14.1** — Cuvelage (étanchéité parties enterrées pour lutte contre remontées d'eau)

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal (cuvelage type C — béton sec)
- **Enduit pelliculaire étanche** (type Sika Igasol Haut)
  - Formule : `surface × 3` kg
  - Pertes : 15%
- **Hydrofuge de masse** (dans béton parois) — **option**
- **Membrane bitumineuse** (cuvelage type B)
- **Drainage périphérique** (cf. 9.5 — obligatoirement associé)

### 🧪 Test
**Input** : « Cuvelage vide sanitaire 30 m² parois »
**Output** : 90 kg enduit pelliculaire + drainage.

---

## 9.5 Drainage périphérique

### 📚 Référence
- **NF DTU 20.1** §5.6 (drainage contre mur enterré)

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal
- **Nappe drainante** (type Dörken Delta MS + géotextile)
  - Formule : `perimetre × hauteur_enterree` m²
- **Drain agricole Ø100 PVC** (pied mur)
  - Formule : `perimetre × 1.05` ml
- **Gravier drainant 15/25** (autour drain)
  - Formule : `perimetre × 0.3` m³ (tranchée 30×30 cm)
- **Géotextile** (enrobage drain anti-colmatage)
  - Formule : `perimetre × 1` m²

#### Accessoires
- **Raccord drain / regard** (évacuation collectée)
- **Regard collecte** (tous les 20 ml ou angles)

### 🧪 Test
**Input** : « Drainage périph 30 ml × 2 m hauteur »
**Output** : 60 m² nappe + 31 ml drain + 9 m³ gravier + 30 m² géotextile + 1 regard.

---

## 📋 Synthèse trade #09

| Ouvrage | État | À créer |
|---|:-:|:-:|
| 9.1 Toiture-terrasse inaccessible | 🔴 | recette (10 matériaux) |
| 9.2 Toiture-terrasse accessible | 🔴 | recette (7 matériaux) |
| 9.3 SPEC douche/SDB | 🟡 | recette dédiée (4 matériaux) |
| 9.4 Cuvelage enterré | 🔴 | recette (5 matériaux) |
| 9.5 Drainage périph. | 🔴 | recette (6 matériaux) |

**Volume à créer** : 5 recettes, ~32 matériaux.
**Temps impl.** : ~2 h.

**Sources** :
- [NF DTU 43.1 — Bâtirama](https://www.batirama.com/article/26679-dtu-43.1-etancheite-des-toitures-avec-elements-porteurs-en-climat-de-plaine.html)
- [NF DTU 43.1 — CSTB](https://boutique.cstb.fr/Detail/Documents-Techniques-Unifies/DTU-NF-DTU/43-Etancheite-des-toitures/DTU-43-1-Etancheite-des-toitures-terrasses-et-toit)
