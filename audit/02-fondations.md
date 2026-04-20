# Audit #02 — Fondations

**Trade** : `maconnerie` (sous-domaine fondations)
**Référentiel FR sup.** : **NF DTU 13.1** (NF P11-212) — révision **septembre 2019**
**Référentiel FR prof.** : **NF DTU 13.2** (NF P11-211) — fondations profondes
**Référentiel PT** : NP EN 1997-1 (Eurocódigo 7) + Decreto-Lei 95/2019

**Ouvrages couverts** : 5
- 2.1 Semelle filante béton armé (sous mur)
- 2.2 Semelle isolée (sous poteau)
- 2.3 Radier général
- 2.4 Longrines
- 2.5 Puits courts / massifs semi-profonds

---

## 2.1 Ouvrage : Semelle filante béton armé

### 📚 Référence normative
- **NF DTU 13.1** rev. septembre 2019 — *Fondations superficielles*
- **Partie 1-1** : Cahier CCT
- **§ 5.1** : Dimensions minimales (40 cm largeur × 20 cm hauteur)
- **§ 6.3** : Étude sol obligatoire (G2 PRO) depuis loi Elan
- **Eurocode 2** (NF EN 1992-1-1) pour armatures
- **NF EN 206** pour béton

### État actuel
**🔴 ABSENT** de la base actuelle.

### Structure cible

#### Strate 1 — Préparation (obligatoire)
- **Décaissement/terrassement** — main d'œuvre, à ne pas lister en matériau
- **Béton de propreté** (obligatoire DTU 13.1 §5.3)
  - Formule : `longueur × largeur_semelle × 0.05` m³ (ép. 5 cm)
  - Pertes : 10%
  - Dosage : 250 kg/m³ ciment CEM II
  - Ref : NF DTU 13.1 §5.3

- **Film polyane 200 μm** (sous semelle si nappe phréatique ou sol argileux) — `optionnel_selon_contexte`
  - Formule : `longueur × largeur_semelle × 1.1` m²
  - Condition : « Si sol humide, argileux ou nappe < 2 m »

#### Strate 2 — Principal (obligatoire)
- **Béton C25/30 dosé 350 kg/m³** (armé — NF DTU 13.1 §6.1)
  - Ciment CEM II 32,5 R — `volume × 350` kg
  - Sable 0/4 — `volume × 0.5` m³
  - Gravier 4/20 — `volume × 0.7` m³
  - Eau — `volume × 175` L
  - Pertes béton : 5% (coulage bennes)

- **Armatures longitudinales HA10** (4 barres filantes minimum selon DTU 13.1)
  - Formule : `longueur × 4 × 0.62` kg (HA10 = 0,62 kg/ml)
  - Pertes : 10% (chutes + recouvrements 30 cm)
  - Ref : NF DTU 13.1 §6.2 + Eurocode 2 §9.2.1.1
  - Conditionnement : barre 6 ml
  - Fabricant : ArcelorMittal / Aciers de Bresle

- **Cadres HA8** (espacement 25 cm)
  - Formule : `longueur × (1/0.25) × 0.395` kg (HA8 = 0,395 kg/ml, cadre = 4 × largeur)
  - Pertes : 10%
  - Ref : NF DTU 13.1 §6.2 / Eurocode 2 §9.5

#### Strate 3 — Accessoires (obligatoire)
- **Cales d'enrobage 30 mm** (obligatoire — enrobage 3 cm mini DTU 21 §7.2)
  - Formule : `longueur × 4` u (4 cales/ml)
  - Pertes : 10%

- **Ligatures fil recuit** (liaison armatures — DTU 21 §3.4)
  - Formule : `longueur × 0.1` kg (100 g/ml moyen)
  - Pertes : 15%
  - Conditionnement : bobine 5 kg

- **Arase étanche bitumineuse** (en haut de semelle, avant élévation murs)
  - Formule : `longueur × 1` ml (largeur semelle ≈ mur)
  - Ref : NF DTU 20.1 §5.2.2 (jointure mur)

#### Strate 4 — Finitions
- Aucune finition matière (c'est enfoui)
- Cure béton non obligatoire (tranché fermé par remblai rapide)

### 🔧 Correctif : nouvelle recette
```typescript
{
  id: 'semelle-filante-ba',
  name: 'Semelle filante béton armé (sous mur)',
  trade: 'maconnerie',
  baseUnit: 'ml',
  geometryMode: 'length',
  dtuReferences: [
    { code: 'NF DTU 13.1', title: 'Fondations superficielles', section: '§ 5-6' },
    { code: 'NF EN 206', title: 'Béton — spécification' },
    { code: 'NF EN 1992-1-1', title: 'Eurocode 2 : calcul structures béton' },
  ],
  version: '2.1.0',
  constraints: {
    // largeur min 40 cm, hauteur min 20 cm, profondeur >= hors-gel (70-90 cm selon zone)
    note: 'Largeur semelle 40 cm minimum. Hauteur 20 cm minimum. Profondeur hors-gel selon zone climatique.',
  },
  hypothesesACommuniquer: [
    'Semelle standard 40 cm largeur × 20 cm hauteur supposée — adapter selon étude G2 PRO',
    'Étude de sol G2 PRO obligatoire avant exécution (loi Elan)',
    'Béton de propreté 5 cm obligatoire sous armatures (DTU 13.1 §5.3)',
    'Ferraillage : 4 HA10 filants + cadres HA8 tous les 25 cm (DTU 13.1 §6.2)',
    'Profondeur à adapter au hors-gel local (70 cm nord, 90 cm montagne)',
    'Arase étanche obligatoire en haut de semelle avant mur (NF DTU 20.1)',
  ],
  materials: [
    // --- Préparation ---
    { id: 'beton-proprete', name: 'Béton de propreté 5 cm (250 kg/m³)',
      category: 'liant', phase: 'preparation', quantityPerBase: 0.02, unit: 'm3',
      geometryMultiplier: 'none', wasteFactor: 1.10,
      wasteReason: 'Coulage en fond de fouille',
      dtu: 'NF DTU 13.1 §5.3' },
    // --- Principal ---
    { id: 'ciment-cem2-325r', name: 'Ciment CEM II/B 32,5 R (béton 350 kg/m³)',
      category: 'liant', phase: 'principal', quantityPerBase: 28, unit: 'kg',
      geometryMultiplier: 'none', wasteFactor: 1.03,
      wasteReason: 'Résidus sacs',
      dtu: 'NF DTU 13.1 §6.1', normRef: 'NF EN 197-1',
      packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
      notes: 'Base : 0,08 m³/ml (40×20 cm) × 350 kg = 28 kg/ml' },
    { id: 'sable-0-4', name: 'Sable 0/4', category: 'granulat', phase: 'principal',
      quantityPerBase: 0.04, unit: 'm3', geometryMultiplier: 'none',
      wasteFactor: 1.10, wasteReason: 'Manutention' },
    { id: 'gravier-4-20', name: 'Gravier 4/20', category: 'granulat', phase: 'principal',
      quantityPerBase: 0.056, unit: 'm3', geometryMultiplier: 'none',
      wasteFactor: 1.10, wasteReason: 'Manutention' },
    { id: 'eau-beton', name: 'Eau de gâchage', category: 'eau', phase: 'principal',
      quantityPerBase: 14, unit: 'L', geometryMultiplier: 'none',
      wasteFactor: 1.00, wasteReason: 'Dosage précis' },
    { id: 'acier-ha10-filant', name: 'Acier HA10 filants (4 barres)',
      category: 'acier', phase: 'principal', quantityPerBase: 2.48, unit: 'kg',
      geometryMultiplier: 'none', wasteFactor: 1.10,
      wasteReason: 'Chutes + recouvrements 30 cm',
      dtu: 'NF DTU 13.1 §6.2', normRef: 'NF A 35-080' },
    { id: 'acier-ha8-cadres', name: 'Acier HA8 cadres tous 25 cm',
      category: 'acier', phase: 'principal', quantityPerBase: 1.58, unit: 'kg',
      geometryMultiplier: 'none', wasteFactor: 1.10,
      wasteReason: 'Chutes + ligatures',
      dtu: 'NF DTU 13.1 §6.2' },
    // --- Accessoires ---
    { id: 'cales-beton-30', name: 'Cales enrobage 30 mm',
      category: 'accessoire', phase: 'accessoires', quantityPerBase: 4, unit: 'u',
      geometryMultiplier: 'none', wasteFactor: 1.10,
      wasteReason: 'Casse',
      dtu: 'NF DTU 21 §7.2' },
    { id: 'ligatures-fil-recuit', name: 'Ligatures fil recuit 1,4 mm',
      category: 'fixation', phase: 'accessoires', quantityPerBase: 0.1, unit: 'kg',
      geometryMultiplier: 'none', wasteFactor: 1.15,
      wasteReason: 'Perte chantier',
      dtu: 'NF DTU 21 §3.4',
      packaging: { unit: 'rouleau', contentQty: 5, contentUnit: 'kg', label: 'bobine 5 kg' } },
    { id: 'arase-etanche-bitume', name: 'Arase étanche bitumineuse',
      category: 'etancheite', phase: 'finitions', quantityPerBase: 1, unit: 'ml',
      geometryMultiplier: 'none', wasteFactor: 1.05,
      wasteReason: 'Coupes aux angles',
      dtu: 'NF DTU 20.1 §5.2.2',
      packaging: { unit: 'rouleau', contentQty: 10, contentUnit: 'ml', label: 'rouleau 10 m × 20 cm' } },
    // --- Options ---
    { id: 'film-polyane-200', name: 'Film polyane 200 μm sous semelle',
      category: 'etancheite', phase: 'preparation', quantityPerBase: 0.5, unit: 'm2',
      geometryMultiplier: 'none', wasteFactor: 1.15,
      wasteReason: 'Recouvrements + remontées',
      dtu: 'NF DTU 13.1 §5.3',
      optional: true,
      condition: 'Si sol humide, argileux ou nappe phréatique < 2 m' },
  ],
},
```

### 🧪 Test de validation
**Input** : « Semelle filante 25 ml sous mur extérieur »

**Output attendu** :
| Phase | Matériau | Qté |
|---|---|---|
| prep | Béton propreté | 0,55 m³ (25 × 0,02 × 1,10) |
| principal | Ciment mortier | 700 kg (20 sacs 35 kg) |
| principal | Sable 0/4 | 1,10 m³ |
| principal | Gravier 4/20 | 1,54 m³ |
| principal | Eau | 350 L |
| principal | Acier HA10 filant | 68,2 kg (25 × 2,48 × 1,10) |
| principal | Acier HA8 cadres | 43,5 kg |
| accessoires | Cales béton 30 | 110 u |
| accessoires | Ligatures | 2,9 kg (1 bobine 5 kg) |
| accessoires | Arase étanche | 26,3 ml (3 rouleaux 10 m) |

---

## 2.2 Ouvrage : Semelle isolée (sous poteau)

### 📚 Référence
- NF DTU 13.1 §5.1.2 — dimensions min 40×40 cm

### État actuel : 🔴 ABSENT

### Structure cible (identique 2.1 mais `baseUnit: 'u'`)
- Béton propreté : forfait 0,04 m³/u (dimension 60×60×10 cm)
- Béton armé : forfait 0,16 m³/u (60×60×45 cm)
- Ferraillage : grille bi-directionnelle HA10 × 8 barres/u

### 🔧 Correctif
Créer recette `semelle-isolee-ba` avec `geometryMode: 'count'` (input = nombre de poteaux).

### 🧪 Test
**Input** : « 4 semelles isolées sous poteaux »
**Output** : ×4 les quantités unitaires.

---

## 2.3 Ouvrage : Radier général

### 📚 Référence
- NF DTU 13.1 §5.4 — Radiers
- Épaisseur min : 25 cm

### État actuel : 🔴 ABSENT

### Structure cible
Similaire au dallage ST40C mais :
- Épaisseur minimum 25 cm (vs 12 cm dallage)
- Double nappe armatures (haut + bas) HA12 maille 15×15
- Forme en cuvette avec relevés périphériques
- Béton C30/37 (plus résistant que dalle classique)

### Matériaux spécifiques
- **Treillis ST65C** (Ø12) OU **armatures HA12 bi-nappe** :
  - Bi-nappe : 2 × 1,78 kg/m² = 3,56 kg HA12/m² (avec recouvrements)
- Hydrofuge de masse **obligatoire** (vs optionnel dallage)
- Joint de reprise latéral (profilé métallique hydrogonflant)

### 🔧 Correctif : nouvelle recette `radier-general`
Structure détaillée à déployer en P3.

### 🧪 Test
**Input** : « Radier 10×8 m épaisseur 30 cm »
**Output** : ~24 m³ béton + 285 kg HA12 + 88 m² treillis (si choisi) + hydrofuge.

---

## 2.4 Ouvrage : Longrines

### 📚 Référence
- NF DTU 13.1 §5.5 — Longrines
- Poutre béton armé sur pieux ou entre semelles

### État actuel : 🔴 ABSENT

### Structure cible
- Béton C25/30 dosé 350 kg/m³
- Armatures longitudinales : 4 HA12 min
- Cadres HA8 tous 20 cm
- Coffrage bois (si non enterrée) — matériau à part
- Décoffrant (si coffrage)

### Matériaux spécifiques (vs semelle 2.1)
- Section type : 30×40 cm (vs 40×20 semelle)
- Ferraillage plus dense (4 HA12 + cadres HA8 @20 = filante poutre)
- Coffrage contreplaqué CTBX 18 mm (si hors sol)

### 🔧 Correctif : recette `longrine-ba` à créer (P3).

---

## 2.5 Ouvrage : Puits court / massif semi-profond

### 📚 Référence
- NF DTU 13.1 §5.6 — massifs semi-profonds (élancement ≤ 5)
- NF DTU 13.2 §5 — si élancement > 5 (fondation profonde)

### État actuel : 🔴 ABSENT

### Structure cible (puits court béton)
- Tube béton (si puits foncé) OU béton coulé en place
- Armature cage (4 HA14 + cadres HA8)
- Béton dosé 350 kg/m³

### 🔧 Correctif : recette `puits-court-ba` avec `geometryMode: 'count'` + hauteur.

---

## 📋 Synthèse trade #02

| Ouvrage | État | Ouvrages à créer |
|---|:-:|:-:|
| 2.1 Semelle filante | 🔴 | recette complète (11 matériaux) |
| 2.2 Semelle isolée | 🔴 | recette complète (10 matériaux) |
| 2.3 Radier général | 🔴 | recette complète (12 matériaux) |
| 2.4 Longrine | 🔴 | recette complète (9 matériaux) |
| 2.5 Puits court | 🔴 | recette complète (8 matériaux) |

**Volume à créer** : 5 nouvelles recettes, ~50 matériaux au total.

**Temps implémentation** : ~3 h.

---

## ✅ Statut audit #02

- [x] Vérification NF DTU 13.1 rev. 2019
- [x] Référence Eurocode 2 armatures
- [x] 5 ouvrages structurés
- [x] Correctif TS complet pour semelle filante (gabarit)
- [x] Structures 2.2→2.5 esquissées (à détailler en P3)
- [ ] Implémentation code : attente validation globale

**Prochain audit** : #07 Couverture.

---

**Sources normatives** :
- [NF DTU 13.1 — CSTB](https://boutique.cstb.fr/detail/documents-techniques-unifies/dtu-nf-dtu/13-fondations/nf-dtu-13-1-fondations-superficielles)
- [CAPEB — nouveau NF DTU 13.1](https://www.capeb.fr/actualites/nf-dtu-13.1-nouveau-dtu-pour-les-fondations-superficielles)
- [Bâtirama — NF DTU 13.1](https://www.batirama.com/article/40159-nf-dtu-13.1-fondations-pour-les-batiments.html)
