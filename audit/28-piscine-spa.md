# Audit #28 — Piscine & spa

**Trade** : `piscine` (nouveau)
**Référentiels FR** :
- **NF P90-308** — Piscines privatives familiales
- **NF P90-309** — Sécurité piscines privatives
- **NF EN 16713** — Systèmes de filtration
- **Article L.128-1** code construction — dispositifs de sécurité obligatoires

**Ouvrages couverts** : 3
- 28.1 Piscine coque polyester
- 28.2 Piscine béton (maçonnée/banchée/projeté)
- 28.3 Piscine bois / liner

---

## 28.1 Piscine coque polyester

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 1 — Préparation (gros œuvre)
- **Terrassement** (main d'œuvre + location pelle)
- **Lit de sable + ceinture béton**
  - Ceinture : `perimetre × 0.05` m³
- **Remblai drainant** (autour coque)
  - Formule : `volume_autour` m³

#### Strate 2 — Principal
- **Coque polyester** (sur mesure, livrée par camion-grue)
  - Formule : `1` u
  - Fabricant : Waterair, Generation Piscines

- **Local technique** (bloc filtration)
- **Plage béton** périphérique (contour piscine 1-2 m)

#### Strate 3 — Équipements
- **Pompe filtration** + pré-filtre
- **Filtre à sable** (ou cartouche)
- **Skimmers** (2 u standard) — buses aspiration
- **Refoulements** (2 u) — buses refoulement
- **Bonde de fond**
- **Échelle inox** (ou escalier intégré à coque)
- **Projecteurs LED** (éclairage)
- **Système traitement** (chlore/brome/sel/UV)

#### Strate 4 — Sécurité obligatoire
- **Dispositif sécurité normé** (1 des 4 obligatoires) :
  - Barrière (NF P90-306)
  - Alarme (NF P90-307)
  - Couverture (NF P90-308)
  - Abri (NF P90-309)

### 🧪 Test
**Input** : « Piscine coque 8×4 m + plage + sécurité »
**Output** : 1 coque + ceinture béton + remblai + local technique + pompe + filtre + 2 skimmers + 2 buses + bonde + échelle + 2 projecteurs + traitement + dispositif sécurité.

---

## 28.2 Piscine béton

### État actuel : 🔴 ABSENT

### Structure cible
- Terrassement
- Armatures (bi-nappe HA12)
- Béton projeté ou banché (parois + fond 20 cm)
- Enduit imperméable + liner OU carrelage + joint époxy
- Équipements idem 28.1

### 🧪 Test
**Input** : « Piscine béton 8×4×1,50 m »
**Output** : ~28 m³ béton + 1 t armatures + équipements.

---

## 28.3 Piscine bois / liner

### Structure cible
- Structure bois pré-montée (Nortland, Gardipool)
- Liner armé 75/100 mm
- Équipements réduits (filtration intégrée parfois)

### 🧪 Test
**Input** : « Piscine bois 6×3 m liner »
**Output** : 1 kit bois + 1 liner + filtration intégrée.

---

## 📋 Synthèse trade #28

| Ouvrage | État | À créer |
|---|:-:|:-:|
| 28.1 Coque polyester | 🔴 | recette (12 matériaux) |
| 28.2 Béton | 🔴 | recette (10 matériaux) |
| 28.3 Bois/liner | 🔴 | recette (4 matériaux) |

**Volume** : 3 recettes, ~26 matériaux.
**Temps impl.** : ~2 h.

---

## ⚠️ Points critiques piscine

- **Dispositif sécurité** obligatoire (Article L.128-1 code construction) — amende si absent
- **Déclaration préalable mairie** (piscine > 10 m² enterrée) — pas un matériau
- **Impôts locaux** (piscine = taxe foncière augmentée)
- **Certificat de conformité** local technique (élec)
