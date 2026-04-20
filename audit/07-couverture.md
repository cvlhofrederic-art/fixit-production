# Audit #07 — Couverture

**Trade** : `couverture` (nouveau — à créer)
**Référentiels FR** :
- **NF DTU 40.21** — tuiles terre cuite à emboîtement ou glissement à relief
- **NF DTU 40.22** — tuiles canal
- **NF DTU 40.23** — tuiles plates TC
- **NF DTU 40.24** — tuiles béton à glissement/emboîtement longitudinal
- **NF DTU 40.11** — ardoises naturelles
- **NF DTU 40.14** — bardeaux bitumés (shingle)
- **NF DTU 40.41** — feuilles et bandes métalliques à joint debout (zinc)
- **NF DTU 40.35** — plaques métalliques nervurées (bac acier)
- **NF DTU 40.29** — écrans souples de sous-toiture
- **NF DTU 31.1** — charpente bois

**Référentiel PT** : NP EN 1304 (tuiles TC) + NP EN 490 (tuiles béton) + NP EN 12326 (ardoises)

**Ouvrages couverts** : 6
- 7.1 Couverture tuiles terre cuite emboîtement
- 7.2 Couverture tuiles béton
- 7.3 Couverture ardoise naturelle (posée clouée/crochetée)
- 7.4 Couverture zinc joint debout
- 7.5 Couverture bac acier nervuré
- 7.6 Couverture shingle / bardeau bitumé

**⚠️ Pré-requis trade `charpente`** : la couverture suppose une charpente existante (à traiter dans audit #06). L'audit #07 se concentre sur la partie COUVERTURE stricte.

---

## 7.1 Ouvrage : Couverture tuiles terre cuite à emboîtement

### 📚 Référence
- **NF DTU 40.21** — Tuiles TC à emboîtement ou glissement à relief (rev. 2020)
- **NF EN 1304** — Spécifications tuiles TC
- **NF DTU 40.29** — Écrans souples sous-toiture
- Complément : Guide CSTB « Les couvertures en tuiles et les écrans souples »

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 1 — Préparation
- **Écran sous-toiture HPV** (Haute Perméabilité Vapeur) `obligatoire` — NF DTU 40.29 §5
  - Formule : `surface_rampant × 1.1` m² (recouvrements 10 cm)
  - Pertes : 10%
  - Fabricant : Delta Maxx / Monarflex / Siplast
  - Conditionnement : rouleau 75 m² (1,50 × 50 m)
  - Ref : NF DTU 40.29

- **Liteaux bois 27×38** `obligatoire` — NF DTU 40.21 §5.2.2
  - Formule : `surface × (1 / pureau_tuile)` ml (pureau variable selon tuile, ≈ 0,35 m → 2,85 ml/m²)
  - Pertes : 10%
  - Ref : NF DTU 40.21 §5.2 + NF DTU 31.1
  - Conditionnement : botte 50 ml
  - Bois : Classe 2 minimum (traité autoclave)

- **Contre-liteaux 27×27** `obligatoire` si écran sous-toiture — NF DTU 40.29 §6.2
  - Formule : `surface × (1 / 0.60)` ml (un contre-liteau par chevron, ≈ 60 cm d'axe)
  - Pertes : 10%
  - Conditionnement : botte 50 ml

#### Strate 2 — Principal
- **Tuile TC emboîtement** (Monier Redland 10, Imerys Rubis, Terreal Romane…)
  - Ratio : 11-14 tuiles/m² (selon modèle, à 13 moyen)
  - Pertes : 5% (casse transport + coupes rives/faîtage)
  - Ref : NF EN 1304 + NF DTU 40.21
  - Conditionnement : palette 240 tuiles

- **Tuile de faîtage TC** (idem fabricant)
  - Formule : `longueur_faitage × 3` u (3 u/ml moyen)
  - Pertes : 10%
  - Conditionnement : palette 100

- **Tuile de rive** (droite ou gauche)
  - Formule : `longueur_rive × 3` u
  - Pertes : 10%

#### Strate 3 — Accessoires (obligatoire)
- **Crochets/pattes de tuile inox** — NF DTU 40.21 §5.3
  - Formule : `surface × (1 tuile sur 3 fixée) × 13 × 0.33` = `surface × 4.3` u
  - Ou en zone vent : toutes les tuiles en périphérie + 1/3 intérieur
  - Pertes : 10%
  - Conditionnement : boîte 500 u

- **Closoir ventilé faîtage** — NF DTU 40.29 §7 (obligatoire avec écran SC)
  - Formule : `longueur_faitage × 1` ml
  - Pertes : 5%
  - Conditionnement : rouleau 5 ml
  - Fabricant : Ubbink / Vergez

- **Bande de rive métallique (zinc ou alu)**
  - Formule : `longueur_rive × 1` ml
  - Pertes : 10%

- **Clous galvanisés 3×50** (fixation liteaux sur chevrons)
  - Formule : `metres_liteaux × 2` u (2 clous/ml)
  - Pertes : 10%

#### Strate 4 — Finitions / points singuliers
- **Solin plomb ou alu** (autour cheminées/penetrations) — `optionnel_selon_contexte`
  - Formule : `nb_penetrations × perimetre_moyen × 0.6` m²
  - Ref : NF DTU 40.41 §7
  - Condition : « Si présence cheminée, conduit VMC ou autre pénétration »

### 🔧 Correctif : nouvelle recette `couv-tuile-tc-emboitement`

Points d'attention spécifiques :
- Zone climatique influence la pente min (Z1 : 30°, Z2 : 35°, Z3 : 40°)
- Fixation tuiles : 1/3 en plaine, 2/3 en zone exposée, 100% crête/bord mer
- Écran de sous-toiture HPV obligatoire en zone froide (si condensation)

### 🧪 Test de validation
**Input** : « Couverture tuile TC 100 m² rampant, faîtage 10 m, rives 20 ml »

**Output attendu** :
| Phase | Matériau | Qté |
|---|---|---|
| prep | Écran HPV | 110 m² (2 rouleaux 75 m²) |
| prep | Liteaux 27×38 | 285 ml (6 bottes 50 ml) |
| prep | Contre-liteaux 27×27 | 185 ml |
| prep | Clous galva 3×50 | 740 u |
| principal | Tuile TC emboîtement | 1 365 u (6 palettes 240) |
| principal | Tuile faîtage | 33 u |
| principal | Tuile rive | 66 u |
| accessoires | Crochets inox | 473 u (1 boîte 500) |
| accessoires | Closoir ventilé | 10,5 ml (3 rouleaux 5 m) |
| accessoires | Bande de rive | 22 ml |

---

## 7.2 Ouvrage : Couverture tuiles béton

### 📚 Référence
- **NF DTU 40.24** — Tuiles béton à glissement/emboîtement longitudinal
- **NF EN 490** — Spécifications tuiles béton
- Fabricants : Monier Tegalit, Imerys Beauvoise

### État actuel : 🔴 ABSENT

### Structure cible
**Quasi-identique à 7.1** sauf :
- Tuile béton (≈ 10 tuiles/m² — grand format vs 13 TC)
- Pertes tuiles : 3% (plus résistantes au transport)
- Poids au m² plus élevé → charpente renforcée à valider

### 🔧 Correctif : recette `couv-tuile-beton` (clone de 7.1 avec ratios ajustés).

### 🧪 Test
**Input** : « Couverture tuile béton 80 m² »
**Output** : 800 tuiles + écran + liteaux + contre-liteaux + accessoires.

---

## 7.3 Ouvrage : Couverture ardoise naturelle

### 📚 Référence
- **NF DTU 40.11** — Couverture en ardoises
- **NF EN 12326** — Spécifications ardoise
- Fabricants : Cupa Pizarras R12/H12, Strongslate

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 1 — Préparation
- **Écran HPV** (obligatoire — pente mini 22° DTU 40.11 §4.3)
- **Liteaux bois 27×38** (classe 2 minimum)
- **Voliges bois jointives** (si pose « à crochets cachés » ou cloue) — en remplacement ou complément des liteaux
  - Pertes : 10%

#### Strate 2 — Principal
- **Ardoise naturelle** 22×32 ou 24×40 (formats courants)
  - Ratio 32×22 à pureau 12 cm : ≈ 28 ardoises/m²
  - Pertes : **15-20%** (fragile, coupes)
  - Ref : NF EN 12326

- **Ardoise faîtière** 32×22
  - Formule : `longueur_faitage × 4` u

#### Strate 3 — Accessoires
- **Crochets inox 316** — pose au crochet courante
  - Formule : `surface × 28 × 1` (2 crochets/ardoise)
  - Pertes : 10%
  - Matériau inox 316L obligatoire bord de mer

- **Clous cuivre** (si pose clouée)
  - Formule : `surface × 56` u (4 clous/ardoise × 28)
  - Pertes : 15%

- **Closoir faîtage plomb**
- **Solin plomb** aux rives

### 🔧 Correctif : recette `couv-ardoise-naturelle`.

### 🧪 Test
**Input** : « Ardoise 60 m² pose au crochet »
**Output** : 2 016 ardoises + 3 528 crochets inox + accessoires.

---

## 7.4 Ouvrage : Couverture zinc joint debout

### 📚 Référence
- **NF DTU 40.41** — Couverture zinc à joint debout
- **NF EN 988** — Spécifications zinc

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 1 — Préparation
- **Voliges bois jointives** (support continu obligatoire) — NF DTU 40.41 §5.2
  - Formule : `surface × 1` m²
  - Bois : Classe 2, épaisseur 18-22 mm
- **Écran anti-bruit/anti-condensation** (Delta-Trela ou équivalent)
  - Formule : `surface × 1.05` m²

#### Strate 2 — Principal
- **Bande zinc prépatiné** VMZINC / RHEINZINK épaisseur 0,65 ou 0,8 mm
  - Formule : `surface × 1.15` m² (largeur bande 50 cm, joint debout + pertes)
  - Pertes : 15% (chutes + pliures)

#### Strate 3 — Accessoires
- **Pattes fixes zinc** (1 toutes les 15 cm) + **pattes coulissantes**
  - Formule : `surface × 6` u
- **Soudure étain** (pour assemblages spéciaux)

#### Strate 4 — Finitions
- **Larmier en bas de pente** (profilé zinc)
- **Habillage faîtage zinc plié**

### 🔧 Correctif : recette `couv-zinc-joint-debout`.

### 🧪 Test
**Input** : « Couverture zinc 50 m² pente 25° »
**Output** : 57,5 m² zinc + 50 m² voliges + 300 pattes + accessoires.

---

## 7.5 Ouvrage : Couverture bac acier nervuré

### 📚 Référence
- **NF DTU 40.35** — Couverture en plaques nervurées métalliques

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 1 — Préparation
- Pas d'écran sous-toiture obligatoire si bac anti-condensation
- **Isolant laine de verre** (si toiture isolée) — à part

#### Strate 2 — Principal
- **Bac acier nervuré** (39/333, 63/750, 43/235…) — ArcelorMittal Hacierplus / Trilobe
  - Formule : `surface × 1.05` m² (recouvrements latéraux)
  - Pertes : 5%
  - Conditionnement : à la longueur (bacs sur mesure)

#### Strate 3 — Accessoires
- **Vis autoforeuses + rondelles EPDM** — 6 à 8 u/m²
- **Closoir mousse** faîtage + rives
- **Bande de solin**
- **Cornières faîtière** + **rives**

### 🔧 Correctif : recette `couv-bac-acier`.

### 🧪 Test
**Input** : « Bac acier 120 m² hangar »
**Output** : 126 m² bac + 840 vis + closoirs + cornières.

---

## 7.6 Ouvrage : Couverture shingle / bardeau bitumé

### 📚 Référence
- **NF DTU 40.14** — Couverture en bardeaux bitumés
- **NF EN 544** — Spécifications bardeaux

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 1 — Préparation
- **Voliges bois jointives** — support continu obligatoire
  - Formule : `surface × 1` m²
- **Feutre bitumé 36S** (sous-couche)
  - Formule : `surface × 1.10` m²

#### Strate 2 — Principal
- **Bardeau bitumé** (IKO Armourshield / GAF Timberline)
  - Formule : `surface × 1.10` m² (recouvrements + arrondis)
  - Pertes : 10%
  - Conditionnement : rouleau ou paquet selon format

#### Strate 3 — Accessoires
- **Clous galva tête large** — 4 clous/bardeau ≈ 20/m²
- **Colle bitumineuse** pour scellement
- **Bardeau de faîtage**

### 🔧 Correctif : recette `couv-shingle`.

### 🧪 Test
**Input** : « Shingle 40 m² abri de jardin »
**Output** : 44 m² bardeaux + 40 m² voliges + 800 clous + bardeaux faîtage.

---

## 📋 Synthèse trade #07

| Ouvrage | État | Ouvrages à créer |
|---|:-:|:-:|
| 7.1 Tuiles TC emboîtement | 🔴 | recette complète (12 matériaux) |
| 7.2 Tuiles béton | 🔴 | recette complète (clone 7.1) |
| 7.3 Ardoise naturelle | 🔴 | recette complète (11 matériaux) |
| 7.4 Zinc joint debout | 🔴 | recette complète (9 matériaux) |
| 7.5 Bac acier | 🔴 | recette complète (8 matériaux) |
| 7.6 Shingle | 🔴 | recette complète (8 matériaux) |

**Volume à créer** : 6 recettes, ~60 matériaux.

**Temps implémentation** : ~3 h 30.

---

## ⚠️ Prérequis pour cet audit
- **Audit #06 Charpente bois** à traiter AVANT impl. P3 car chevrons/pannes/fermettes supportent la couverture. On peut garder l'audit couverture séparé (pose sur charpente existante supposée) mais l'IA doit pouvoir recommander l'ajout de l'ouvrage charpente correspondant.
- **Trade `couverture`** à ajouter dans le schema Zod de Recipe :
  - Actuellement : `z.enum(['maconnerie', 'placo', 'peinture', 'carrelage'])`
  - Cible : ajouter `'couverture', 'charpente', 'menuiserie_ext', 'plomberie', 'electricite', 'fondations', ...` (liste exhaustive lors de P3)

---

## ✅ Statut audit #07

- [x] Vérification NF DTU 40.21, 40.24, 40.11, 40.41, 40.35, 40.14, 40.29
- [x] 6 ouvrages structurés
- [x] Tests de validation chiffrés
- [ ] Implémentation : attente P3

**Prochain audit** : #12 Menuiseries extérieures.

---

**Sources normatives** :
- [NF DTU 40.21 — CSTB](https://boutique.cstb.fr/detail/documents-techniques-unifies/dtu-nf-dtu/40-couverture/nf-dtu-40-21-couverture-en-tuiles-de-terre-cuite-a)
- [Bâtirama — NF DTU 40.21](https://www.batirama.com/article/11118-nf-dtu-40.21-tuiles-tc-a-emboitement-ou-a-glissement-a-relief.html)
- [Guide CSTB — Écrans souples sous-toiture](https://boutique.cstb.fr/detail/guides-et-livres/techniques-de-construction/toitures-couvertures-etancheite/les-couvertures-en-tuiles-et-les-ecrans-souple)
- [Bâtirama — Liste DTU 40](https://www.batirama.com/rubrique-article/l-info-normes-liste-des-dtu/170-dtu-40-couverture-page-1.html)
