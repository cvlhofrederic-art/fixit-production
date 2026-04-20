# Audit Estimateur Matériaux — Plan maître

> **Objet** : auditer et enrichir la base de connaissances de l'estimateur
> pour que chaque ouvrage renvoie un devis digne d'un conducteur de travaux.
>
> **Référentiel** : DTU français (CSTB/AFNOR) + équivalents Portugal (NP EN, LNEC, Decreto-Lei).
> **Date audit** : 2026-04-20 — **Auditeur** : Claude Opus 4.7

---

## 1. Méthode

Chaque ouvrage est audité sur **6 strates non-négociables** :

1. **Préparation / support** (décaissement, forme, sous-couche, primaire)
2. **Ouvrage principal** (matériau constitutif)
3. **Mise en œuvre** (liant, fixation, scellement)
4. **Accessoires réglementaires** (joints, ventilation, étanchéité)
5. **Finitions** (cure, protection, nettoyage)
6. **Consommables** (vis, clous, chevilles, silicone, adhésifs)

Chaque matériau dans chaque strate est catégorisé :
- `obligatoire` : sortie bloquée si absent
- `conseille` : alerte, non bloquant
- `optionnel_selon_contexte` : IA active selon conditions (RE2020, humidité, etc.)

---

## 2. Référentiels normatifs vérifiés (avril 2026)

### France — DTU (Documents Techniques Unifiés)
Édités par CSTB / AFNOR. Les NF DTU constituent la bonne pratique contractuelle reconnue.

### Portugal — Référentiel plus hétérogène
- **NP EN 206** + **NP EN 13670** : béton (spécification + exécution)
- **Eurocódigos** (EN 1990-1999 → NP EN 199x) : conception structures
- **Decreto-Lei n.º 90/2021** : cadre réglementaire béton
- **Despacho Normativo n.º 21/2019** : application Eurocódigos
- **LNEC E-xxx** : spécifications LNEC (E 435, E 464, E 465, etc.)
- **REH (DL 101-D/2020)** : performance énergétique habitation
- **RGEU (DL 38 382/51)** : règlement général des édifications urbaines
- Pas de "DTU portugais" strict : on utilise directement les EN + spécifs LNEC

**Sources utilisées** :
- [CSTB — boutique DTU](https://boutique.cstb.fr/)
- [AFNOR — recherche NF](https://www.boutique.afnor.org/)
- [LNEC — Documentos](https://www.lnec.pt/)
- [Legifrance](https://www.legifrance.gouv.fr/) / [diariodarepublica.pt](https://diariodarepublica.pt/)

---

## 3. État initial (avant audit)

| Trade actuel | Ouvrages existants | Statut |
|---|---|---|
| Maçonnerie | 8 | partiellement enrichi (dalle ST25C) |
| Placo | 4 | partiellement enrichi (cloison 72/48) |
| Peinture | 4 | partiellement enrichi (murs neuf) |
| Carrelage | 4 | partiellement enrichi (sol 45×45) |
| **TOTAL** | **20** | **4 trades sur 28** |

---

## 4. Les 28 corps de métier à auditer

Colonne **État** :
- 🟢 existe + enrichi (cible atteinte)
- 🟡 existe mais incomplet → audit + complément
- 🔴 absent → création totale

Colonne **Priorité** basée sur fréquence réelle en chantier (règle 80/20).

### Vague 1 — Critique (80% des chantiers BTP)

| # | Trade | Nb ouvrages | État | Prio |
|:-:|---|:-:|:-:|:-:|
| 3 | **Dallage & sol béton** (terre-plein, portée, chape, ragréage) | 4 | 🟡 1/4 enrichi | **P0** |
| 4 | **Maçonnerie traditionnelle** (parpaing, monomur, brique TC, pierre, béton cell., enduit) | 6 | 🟡 3/6 | P0 |
| 2 | **Fondations** (semelles filantes/isolées, radier, longrines, puits, micropieux) | 5 | 🔴 | P0 |
| 7 | **Couverture** (tuiles TC, tuiles béton, ardoise, zinc, bac acier, shingle) | 6 | 🔴 | P0 |
| 12 | **Menuiseries extérieures** (fenêtres PVC/alu/bois, porte entrée/garage, volets, baies) | 7 | 🔴 | P0 |
| 13 | **Cloisons & plâtrerie** (BA13, alvéolaire, doublage, plafond) | 6 | 🟡 4/6 | P1 |
| 17 | **Plomberie sanitaire** (PER/cuivre, PVC évac, sanitaires, CE) | 8 | 🔴 | P1 |
| 21 | **Électricité CFO** (tableau, câblage, prises/inter, MALT, borne VE) | 6 | 🔴 | P1 |

### Vague 2 — Essentiel (enveloppe + structure)

| # | Trade | Nb ouvrages | État | Prio |
|:-:|---|:-:|:-:|:-:|
| 5 | Béton armé banché (voile, poteau, poutre, plancher dalle/poutrelles/prédalle, escalier BA) | 7 | 🔴 | P2 |
| 6 | Charpente bois (traditionnelle, fermettes, MOB, lamellé-collé) | 4 | 🔴 | P2 |
| 8 | Zinguerie (gouttières, descentes EP, noues, solins) | 4 | 🔴 | P2 |
| 9 | Étanchéité (toiture-terrasse, terrasse accessible, SEL, cuvelage, drainage) | 5 | 🔴 | P2 |
| 10 | Isolation thermique (ITE, ITI, combles, sous-dalle, rampants) | 5 | 🔴 | P2 |
| 11 | Façade & bardage (enduit mono/trad, bardage bois/composite/métallique, vêture) | 6 | 🔴 | P2 |
| 14 | Menuiseries intérieures (portes, placards, escaliers bois, parquets, plinthes) | 6 | 🔴 | P2 |
| 15 | Revêtements de sol (carrelage, PVC, moquette, stratifié, béton ciré, résine) | 6 | 🟡 3/6 | P2 |
| 16 | Revêtements muraux (faïence, carrelage mural, peinture, papier peint, lambris) | 5 | 🟡 2/5 | P2 |

### Vague 3 — Spécialisé

| # | Trade | Nb ouvrages | État | Prio |
|:-:|---|:-:|:-:|:-:|
| 18 | Chauffage (radiateurs, PCRBT, chaudière, PAC, poêle, conduits) | 6 | 🔴 | P3 |
| 19 | Ventilation (VMC simple, double flux, VMI) | 3 | 🔴 | P3 |
| 20 | Climatisation (split, gainable, multi-split) | 3 | 🔴 | P3 |
| 1 | Terrassement & VRD (décaissement, remblai, réseaux, regards, géotextile) | 6 | 🔴 | P3 |
| 23 | Assainissement (fosse, microstation, épandage, raccord collectif) | 4 | 🔴 | P3 |
| 22 | Électricité CFA (RJ45, coax/fibre, alarme, vidéo, domotique) | 4 | 🔴 | P3 |

### Vague 4 — Extérieurs / finitions

| # | Trade | Nb ouvrages | État | Prio |
|:-:|---|:-:|:-:|:-:|
| 24 | Voirie & circulations ext. (enrobé, pavés, dalles, stabilisé, bordures) | 5 | 🔴 | P4 |
| 25 | Clôtures & portails (grillage, panneaux, mur bahut, portails) | 4 | 🔴 | P4 |
| 26 | Terrasses extérieures (bois, composite, carrelage ext., pierre) | 3 | 🔴 | P4 |
| 27 | Espaces verts (gazon semé/plaqué, plantations, arrosage auto) | 3 | 🔴 | P4 |
| 28 | Piscine & spa (coque, béton, liner, bois) | 3 | 🔴 | P4 |

### Totaux

| Vague | # trades | # ouvrages cible | % du périmètre |
|:-:|:-:|:-:|:-:|
| 1 Critique | 8 | 48 | ~35% (couvre 80% chantiers) |
| 2 Essentiel | 9 | 47 | ~34% |
| 3 Spécialisé | 6 | 26 | ~19% |
| 4 Extérieurs | 5 | 18 | ~13% |
| **TOTAL** | **28** | **≈139** | **100%** |

---

## 5. Volume de travail réaliste

| Phase | Livrable | Temps concentré |
|---|---|---|
| P1 | `00-plan.md` (ce fichier) + gabarit | 1 h |
| P2a | Audits Vague 1 (8 fichiers MD) | 12 h |
| P2b | Audits Vague 2 (9 fichiers MD) | 13 h |
| P2c | Audits Vagues 3-4 (11 fichiers MD) | 14 h |
| P3 | Refonte `lib/estimation-materiaux/recipes/` | 10 h |
| P4 | Prompt IA Groq (règles bloquantes + questions de relance) | 2 h |
| P5 | Tests Vitest (56 tests = 2 × 28 trades) | 6 h |
| P6 | UI « ⚠️ Cohérence du devis » | 3 h |
| **TOTAL** | | **≈ 61 h** |

**Mode de livraison** :
- Un fichier d'audit par commit pour faciliter review
- Validation user obligatoire après Vague 1 avant Vague 2
- Implémentation (P3-P6) en fin, après tous les audits validés

---

## 6. Règles d'honnêteté documentaire

- **DTU** : référence systématiquement vérifiable (code + intitulé exact + année de révision)
- **Section** : si citée, correspond au §X.Y réel du document
- **Fiche fabricant** : produit existant et commercialisé (Lafarge Le Classic, Weber Colflex, Placo BA13, Isover PAR, etc.)
- **Ratio** : sourcé (fiche fabricant, DTU, consensus profession)
- **Conditionnement** : réel et vérifiable (sac 25/35 kg, rouleau 25×6m, palette 60 blocs, etc.)
- **Incertain** : marqué `[à vérifier]` explicitement — jamais d'invention

---

## 7. Ordre de livraison des audits

L'ordre suit la priorité :

1. **03 Dallage & sol béton** ← premier (référence + partiellement enrichi)
2. 04 Maçonnerie
3. 02 Fondations
4. 07 Couverture
5. 12 Menuiseries extérieures
6. 13 Cloisons & plâtrerie
7. 17 Plomberie sanitaire
8. 21 Électricité CFO
9. …puis Vagues 2/3/4

Chaque fichier suit **strictement** le gabarit (cf. `03-dallage.md` — le premier livré servant de référence de format).
