# Audit #18 — Chauffage

**Trade** : `chauffage` (nouveau)
**Référentiels FR** :
- **NF DTU 65.3** — Chauffage central
- **NF DTU 65.7** — Radiateurs
- **NF DTU 65.10** — Canalisations chauffage
- **NF DTU 65.11** — Dispositifs sécurité installations chauffage
- **NF DTU 65.14** — Plancher chauffant hydraulique
- **NF DTU 65.16** — Pompes à chaleur
- **NF DTU 24.1** — Conduits de fumée
- **RE2020** + **RT existant**

**Référentiel PT** : REH DL 101-D/2020

**Ouvrages couverts** : 6
- 18.1 Radiateurs eau chaude (acier, fonte, alu)
- 18.2 Plancher chauffant hydraulique (PCBT)
- 18.3 Chaudière gaz condensation
- 18.4 Pompe à chaleur air/eau (PAC)
- 18.5 Poêle à bois ou granulés
- 18.6 Conduits de fumée

---

## 18.1 Radiateurs eau chaude

### 📚 Référence
- **NF DTU 65.7** — Radiateurs
- **NF DTU 65.10** — Canalisations (PER ou cuivre)

### État actuel : 🔴 ABSENT

### Structure cible (par pièce)

#### Principal
- **Radiateur acier panneau simple/double** — puissance selon DPE
  - Formule : `1` u par pièce + taille selon volume
  - Fabricant : Acova, Zehnder, Finimetal
- **Robinet thermostatique** (obligatoire RT2012 + RE2020)
  - 1 u par radiateur
- **Purgeur automatique** (ou manuel)
- **Té de réglage** (retour)

#### Accessoires
- **Supports muraux** + chevilles
- **Joints d'étanchéité** (PTFE téflon, filasse + pâte à joint)
- **Raccord cuivre/PER** selon installation

### 🧪 Test
**Input** : « 5 radiateurs acier T3 »
**Output** : 5 radiateurs + 5 robinets thermostatiques + 5 purgeurs + 5 tés + supports + joints.

---

## 18.2 Plancher chauffant hydraulique (PCBT)

### 📚 Référence
- **NF DTU 65.14** — Plancher chauffant basse température

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 1 — Préparation (sous dalle)
- **Isolant PSE rainuré/plots** (R > 2,5 m²K/W — NF DTU 65.14 §5.2)
  - Formule : `surface × 1.05` m²
  - Fabricant : Knauf Therm PCRBT, Rehau
- **Film polyane** (barrière humidité)
- **Bande périphérique** (désolidarisation mur/chape)
  - Formule : `perimetre × 1` ml

#### Strate 2 — Principal
- **Tube PER diffusion Ø16 mm**
  - Formule : `surface × 6` ml (pas 15 cm moyen)
  - Fabricant : Rehau Rautitan, Uponor
  - Conditionnement : couronne 240 m

- **Collecteur réglage** (1 par zone) — inclut nourrice + circulateur
  - Formule : `1` u par niveau

- **Chape de scellement ciment** (CT-C25-F4, 5 cm sur tubes)
  - Formule : `surface × 0.05` m³

#### Strate 3 — Accessoires
- **Agrafes fixation tubes**
- **Thermostats d'ambiance** (1 par zone)
- **Têtes thermostatiques motorisées**

### 🧪 Test
**Input** : « PCBT 80 m² T3 »
**Output** : 84 m² PSE + 480 ml PER Ø16 + 1 collecteur + 4 m³ chape + agrafes + thermostats.

---

## 18.3 Chaudière gaz condensation

### 📚 Référence
- **NF DTU 65.4** — Chaudières
- **NF DTU 24.1** — Conduit fumée
- **RT2012 + RE2020** — perf HPE

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal
- **Chaudière gaz condensation** murale 24-28 kW
  - Fabricant : Viessmann Vitodens, ELM Leblanc, Saunier Duval
- **Conduit fumée concentrique** (ventouse ou cheminée)
  - Formule : `hauteur × 1.1` ml
- **Circulateur** (si non intégré)
- **Vase expansion** (si non intégré)

#### Accessoires
- **Groupe sécurité** (soupape + ballon tampon)
- **Pot anti-boues** magnétique
- **Robinet d'arrêt gaz certifié**
- **Raccord flexible gaz ADG**
- **Câblage pressostat, sonde extérieure**

### 🧪 Test
**Input** : « Chaudière gaz 24 kW + ventouse »
**Output** : chaudière + 2 ml conduit concentrique + pot anti-boues + soupape + robinet gaz.

---

## 18.4 Pompe à chaleur air/eau (PAC)

### 📚 Référence
- **NF DTU 65.16** — PAC air/eau
- **RE2020** — privilège fortes incitations

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal
- **Unité extérieure PAC air/eau** (5 à 14 kW)
  - Fabricant : Atlantic Alféa, Daikin Altherma, Mitsubishi Ecodan
- **Unité intérieure / ballon ECS intégré** (si système monobloc OU module hydraulique)
- **Liaisons frigorifiques cuivre** (aller + retour)
  - Formule : `distance × 2` ml
- **Câble liaison extérieur / intérieur** (section selon puissance)

#### Accessoires
- **Support châssis anti-vibrations** pour unité extérieure
- **Bac évacuation condensats + tuyau PVC Ø32**
- **Vase expansion** + **pot anti-boues**
- **Module hydraulique** (si kit séparé)
- **Sonde température extérieure**

### 🧪 Test
**Input** : « PAC air/eau 8 kW + ballon ECS 200 L »
**Output** : 1 unité ext. + 1 module hydr. + 1 ballon + 10 ml liaisons frigo + support + condensats + accessoires.

---

## 18.5 Poêle à bois ou granulés

### 📚 Référence
- **NF DTU 24.1** — Conduit fumée
- **NF EN 13240** (bûche) / **NF EN 14785** (granulés)
- **Label Flamme Verte 7★** (RE2020)

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal
- **Poêle** (bûche ou granulés)
  - Fabricant : Godin, Invicta (bûche) / MCZ, Palazzetti (granulés)
- **Conduit de fumée** (double paroi ou maçonné)
  - Formule : `hauteur × 1.1` ml
- **Plaque de protection sol** (plaque verre ou acier)

#### Accessoires
- **Tubage inox 316L** (si conduit maçonné existant)
- **Chapeau de cheminée**
- **Kit départ plafond** (traversée)
- **Habillage décoratif** (facultatif)

### 🧪 Test
**Input** : « Poêle granulés 8 kW + conduit 6 ml tubage »
**Output** : poêle + 6,6 ml tubage 316L + chapeau + plaque sol + kit départ.

---

## 18.6 Conduits de fumée

### 📚 Référence
- **NF DTU 24.1** — Conduits de fumée (rev. 2020)

### État actuel : 🔴 ABSENT

### Structure cible
- **Boisseaux terre cuite** (si neuf maçonné) OU tube inox
- **Souche** (partie émergeante toiture)
- **Chapeau** anti-pluie / anti-vent

### 🧪 Test
**Input** : « Conduit fumée 6 ml inox + souche »
**Output** : 6 ml tube inox + souche + chapeau + solin toiture.

---

## 📋 Synthèse trade #18

| Ouvrage | État | À créer |
|---|:-:|:-:|
| 18.1 Radiateurs | 🔴 | recette (7 matériaux) |
| 18.2 PCBT | 🔴 | recette (10 matériaux) |
| 18.3 Chaudière gaz | 🔴 | recette (8 matériaux) |
| 18.4 PAC air/eau | 🔴 | recette (9 matériaux) |
| 18.5 Poêle | 🔴 | recette (6 matériaux) |
| 18.6 Conduit fumée | 🔴 | recette (4 matériaux) |

**Volume** : 6 recettes, ~44 matériaux.
**Temps impl.** : ~3 h.
