# Audit #12 — Menuiseries extérieures

**Trade** : `menuiserie_ext` (nouveau)
**Référentiel FR** : **NF DTU 36.5** — *Mise en œuvre des fenêtres et portes extérieures* (rev. en vigueur, couvre tous matériaux : PVC, alu, bois, mixte)
**Référentiel PT** : NP EN 14351-1 (fenêtres) + NP EN 14351-2 (portes ext.) + REH (performance énergétique)

**Ouvrages couverts** : 7
- 12.1 Fenêtre PVC (pose neuf ou rénovation)
- 12.2 Fenêtre aluminium
- 12.3 Fenêtre bois
- 12.4 Porte d'entrée
- 12.5 Porte de garage
- 12.6 Volets roulants / volets battants
- 12.7 Portail motorisé

**Principe** : en `geometryMode: 'count'` — l'utilisateur saisit le **nombre** de menuiseries + dimensions individuelles si atypiques.

---

## 12.1 Ouvrage : Fenêtre PVC

### 📚 Référence
- **NF DTU 36.5** — §5.3 (pose applique), §5.4 (pose feuillure), §5.5 (pose tunnel)
- **NF EN 14351-1** — performance fenêtres
- **RE2020** — performance Uw ≤ 1,3 W/m²K

### État actuel : 🔴 ABSENT

### Structure cible (par unité)

#### Strate 1 — Préparation
- **Précadre PVC ou alu** `optionnel_selon_contexte` (si pose applique)
  - Formule : `perimetre × 1.05` ml
  - Pertes : 5%
  - Fabricant : KSM / Wurth
  - Condition : « Si pose applique sur tableau existant »

- **Bande compribande** `obligatoire` — NF DTU 36.5 §6.2.3 (étanchéité air/eau dynamique)
  - Formule : `perimetre × 1.05` ml
  - Pertes : 5%
  - Ref : NF DTU 36.5 §6.2.3
  - Fabricant : Illbruck / Tremco
  - Conditionnement : rouleau 8 ml

#### Strate 2 — Principal
- **Bloc-fenêtre PVC** (dormant + ouvrant + vitrage double/triple)
  - Formule : `1` u par menuiserie
  - Pertes : 0% (sur mesure)
  - Ref : NF EN 14351-1, NF DTU 36.5
  - Fabricants : Schuco, Veka, Rehau, Aluplast

- **Vitrage** — **INCLUS** dans le bloc-fenêtre (pas à comptabiliser séparément)

#### Strate 3 — Accessoires
- **Mousse PU expansive** (remplissage joint de calfeutrement) `obligatoire`
  - Formule : `perimetre × 0.3` L (cordon 3×3 cm)
  - Pertes : 15% (gâchage perdu)
  - Fabricant : Illbruck / Sika
  - Conditionnement : cartouche 750 ml ou bonbonne 880 ml

- **Mastic silicone ou MS polymère** (joint final extérieur) `obligatoire`
  - Formule : `perimetre × 0.06` L (cordon 6 mm)
  - Pertes : 15%
  - Fabricant : Sika 11FC / Bostik

- **Chevilles mécaniques M10** (fixation cadre) `obligatoire` — NF DTU 36.5 §5.7
  - Formule : `perimetre × 2` u (1 tous les 50 cm)
  - Pertes : 10%
  - Ref : NF DTU 36.5 §5.7 (fixation mécanique OBLIGATOIRE — mousse/colle INTERDITE)

- **Appui de fenêtre** (marbre, alu, PVC, ou béton préfa) `obligatoire` si pose neuf
  - Formule : `largeur × 1.1` ml (débord 5 cm chaque côté)
  - Pertes : 10%
  - Ref : NF DTU 36.5 §7

- **Bavette alu anti-pluie** (rejet d'eau extérieur)
  - Formule : `largeur × 1.05` ml
  - Fabricant : Weser / Aluplast

#### Strate 4 — Finitions
- **Joint d'étanchéité périphérique intérieur** (mousse ou mastic)
- **Nettoyage + protection chantier**

### 🔧 Correctif : nouvelle recette `menuiserie-fenetre-pvc`

```typescript
{
  id: 'menuiserie-fenetre-pvc',
  name: 'Fenêtre PVC (dormant + ouvrant + vitrage inclus)',
  trade: 'menuiserie_ext',
  baseUnit: 'u',
  geometryMode: 'count',
  dtuReferences: [
    { code: 'NF DTU 36.5', title: 'Mise en œuvre fenêtres et portes extérieures' },
    { code: 'NF EN 14351-1', title: 'Spécifications fenêtres et portes extérieures' },
  ],
  version: '2.1.0',
  constraints: {
    note: 'Ratios pour fenêtre standard 120×120 cm (périmètre 4,8 m). Pour dimensions atypiques, adapter manuellement.',
  },
  hypothesesACommuniquer: [
    'Fenêtre standard supposée 120×120 cm (périmètre 4,80 m) — adapter si dimensions atypiques',
    'Pose applique avec bande compribande OBLIGATOIRE (étanchéité air/eau NF DTU 36.5 §6.2.3)',
    'Fixation mécanique par chevilles M10 (la pose à la colle ou mousse seule est INTERDITE)',
    'Vitrage double ou triple inclus dans le bloc-fenêtre — pas de comptage séparé',
    'Appui de fenêtre inclus (indispensable pose neuf)',
    'Bavette alu rejet eau obligatoire en façade',
  ],
  materials: [ /* ... matériaux ci-dessus avec perimetre = 4.80 comme base count */ ],
},
```

### 🧪 Test de validation
**Input** : « 3 fenêtres PVC standard 120×120 »

**Output attendu** (pour 3 fenêtres, périmètre total 14,4 m) :
| Phase | Matériau | Qté |
|---|---|---|
| prep | Bande compribande | 15,1 ml (2 rouleaux 8 ml) |
| principal | Bloc fenêtre PVC | 3 u |
| accessoires | Mousse PU | 4,5 L (6 cartouches 750 ml) |
| accessoires | Mastic silicone | 0,9 L (3 cartouches) |
| accessoires | Chevilles M10 | 32 u |
| accessoires | Appui de fenêtre | 4 ml (marbre ou PVC) |
| accessoires | Bavette alu | 3,8 ml |

---

## 12.2 Ouvrage : Fenêtre aluminium

### Structure cible : identique 12.1 mais :
- Bloc-fenêtre alu (Schuco, Technal, Installux) — prix 1,5-2× PVC
- Rupture de pont thermique obligatoire depuis RT2012
- Uw ≤ 1,4 W/m²K (RE2020)
- Poids plus élevé → chevilles M12 (vs M10 PVC)

**Délta** : rebranchement sur mêmes accessoires sauf chevilles M12.

---

## 12.3 Ouvrage : Fenêtre bois

### Structure cible
- Bloc-fenêtre bois (classe 3 mini, essence : pin, chêne, mélèze) — fabricants : Lorenove, Minco, Gimm
- Traitement fongicide/insecticide inclus
- **Finition peinture/lasure** : décompte **supplémentaire** si non pré-finie usine
- Chevilles M10

### Spécifiques bois
- **Traitement insecticide supplémentaire tous les 5 ans** — à noter en hypothèse
- **Lasure 2 couches** à prévoir (trade peinture)

---

## 12.4 Ouvrage : Porte d'entrée

### Structure cible

#### Principal
- Bloc-porte (dormant + vantail + serrure multipoints + paumelles)
  - PVC, alu, bois, composite ou acier selon choix
  - Fabricants : Bel'm, Solabaie, Corvino, K-Line
- Seuil aluminium (à rupture pont thermique)

#### Accessoires
- Bande compribande (périmètre)
- Mousse PU + mastic
- Chevilles M12 (plus lourde que fenêtre)
- **Cylindre de sécurité** (option A2P*, **, ***)
  - Condition : « Si sécurité renforcée demandée »
- **Ferme-porte** (DTU accessibilité)
- **Judas** (conseillé)

### 🧪 Test
**Input** : « 1 porte d'entrée PVC avec cylindre A2P* »
**Output** : bloc-porte + seuil alu + calfeutrement + mousse + mastic + 4-6 chevilles M12 + cylindre sécurisé.

---

## 12.5 Ouvrage : Porte de garage

### Référence
- **NF EN 13241** — performance portes industrielles/garage
- Pas de DTU spécifique, mais principes NF DTU 36.5 + fabricant

### Types
- **Sectionnelle** : motorisée, rails plafond
- **Basculante** : manuelle, un seul panneau
- **Enroulable** : motorisée, coffre en linteau
- **Battante 2 vantaux** : classique

### Principal (sectionnelle motorisée — le plus courant)
- Panneaux sectionnels isolés (40 mm)
- Rails alu + patins plastique
- Moteur tubulaire ou chariot (Somfy, Hörmann, Came)
- Télécommandes (2 u standard)
- Cellules sécurité photoélectriques (obligatoires pour motorisation automatique — NF EN 13241)

### Accessoires
- Ressorts torsion (dimensionnés usine)
- Vis + chevilles de fixation rails
- Joint bas étanchéité

### 🧪 Test
**Input** : « 1 porte garage sectionnelle motorisée 2,40 × 2,10 m »
**Output** : panneaux + rails + motorisation + 2 télécommandes + cellules + joint bas.

---

## 12.6 Ouvrage : Volets roulants + volets battants

### Volets roulants
**Référence** : pas de DTU dédié, NF EN 13659 (performance)

#### Principal
- Tablier aluminium ou PVC (lames 37 ou 55 mm)
- Coffre (extérieur, intérieur, ou bloc baie)
- Coulisses + joint
- Axe + moteur (ou treuil manuel)
- Télécommande si motorisé

#### Accessoires
- Raccord mousse coffre/mur
- Cornière de finition
- Domotique (option : capteur solaire/pluie)

### Volets battants
- Panneau (bois, PVC, alu)
- Paumelles + gonds à sceller
- Pattes de scellement
- Arrêts de volet (targette bourrelet)
- Espagnolette

### 🧪 Test
**Input** : « 3 volets roulants alu motorisés + 2 volets battants PVC »
**Output** : 3 tabliers + 3 coffres + 3 moteurs + 3 télécommandes + 2 panneaux battants + paumelles + arrêts.

---

## 12.7 Ouvrage : Portail motorisé

### Types
- **Coulissant** : 1 vantail + rail au sol
- **Battant** : 2 vantaux

### Principal
- Vantail alu / PVC / bois / acier
- Motorisation (enterrée, à bras, à vérins) — Came, Nice, Faac
- Crémaillère (si coulissant)
- Photocellules (obligatoires)
- Feu clignotant (obligatoire)
- Digicode + télécommandes

### Accessoires
- Poteaux alu/acier + scellement béton (0,3 m³ par poteau)
- Gonds réglables
- Butoir
- Câblage 230 V (à faire par électricien)

### 🧪 Test
**Input** : « 1 portail battant 2 vantaux 3 m motorisé »
**Output** : 2 vantaux + motorisation bras + 2 poteaux + 0,6 m³ béton scellement + photocellules + feu clignotant + digicode + 2 télécommandes.

---

## 📋 Synthèse trade #12

| Ouvrage | État | Ouvrages à créer |
|---|:-:|:-:|
| 12.1 Fenêtre PVC | 🔴 | recette complète (9 matériaux) |
| 12.2 Fenêtre alu | 🔴 | recette complète (clone 12.1) |
| 12.3 Fenêtre bois | 🔴 | recette complète + lasure |
| 12.4 Porte d'entrée | 🔴 | recette complète (10 matériaux) |
| 12.5 Porte garage | 🔴 | recette complète (8 matériaux) |
| 12.6 Volets roulants/battants | 🔴 | 2 recettes (7 + 6 matériaux) |
| 12.7 Portail | 🔴 | recette complète (12 matériaux) |

**Volume à créer** : 8 recettes, ~75 matériaux.
**Temps implémentation** : ~4 h.

---

## ⚠️ Point critique DTU 36.5

**Interdictions explicites** (NF DTU 36.5 §5.7) :
- ❌ Fixation par colle seule
- ❌ Fixation par mousse PU seule
- ❌ Fixation par clous

**Obligation** : chevilles mécaniques (M10/M12 selon poids).

L'estimateur doit TOUJOURS inclure les chevilles mécaniques sur chaque pose de menuiserie.

---

## ✅ Statut audit #12

- [x] Vérification NF DTU 36.5 (tous matériaux)
- [x] NF EN 14351-1/2 portes/fenêtres
- [x] 7 ouvrages structurés
- [x] Règle d'interdiction fixation mousse/colle seule
- [ ] Implémentation : attente P3

**Prochain audit** : #13 Cloisons & plâtrerie.

---

**Sources normatives** :
- [NF DTU 36.5 — Bâtirama](https://www.batirama.com/article/11278-nf-dtu-36.5-mise-en-uvre-des-fenetres-et-portes-exterieures.html)
- [Bâtiactu — NF DTU 36.5](https://produits.batiactu.com/publi/le-dtu-36.5-explique-pour-vos-travaux-de-fenetres--452-194703.php)
- [Wurth — détails NF DTU 36.5](https://infos.wurth.fr/menuiserie-les-details-de-la-norme-dtu-36-5-pour-les-poses-de-fenetres/)
