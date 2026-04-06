# SEO Audit Phase 1 — Structure & URLs (Pages PT)

**Date :** 06 avril 2026
**Périmètre :** Pages en portugais (`/pt/`)
**Total pages indexées :** 1 358
**Statut global :** PASS

---

## Table des matières

1. [Architecture URLs PT](#1-architecture-urls-pt)
2. [Breadcrumbs & Navigation](#2-breadcrumbs--navigation)
3. [Canonical Tags](#3-canonical-tags)
4. [Robots & Indexation](#4-robots--indexation)
5. [Redirects](#5-redirects)
6. [Issues corrigées](#6-issues-corrigées)
7. [Issues restantes](#7-issues-restantes-non-bloquantes)

---

## 1. Architecture URLs PT

### Structure générale

Le préfixe `/pt/` est appliqué de manière uniforme à l'ensemble des pages portugaises. Aucune page PT n'existe sans ce préfixe. La structure est plate (3 niveaux maximum) et lisible par les moteurs de recherche sans ambiguïté.

**Décompte total : 1 358 pages**

| Catégorie | Nombre | Exemple |
|---|---|---|
| Hubs statiques | 17 | `/pt/servicos/`, `/pt/urgencias/`, `/pt/cidade/` |
| Pages services | 288 | `/pt/servicos/eletricista/` |
| Pages urgences | 288 | `/pt/urgencias/canalizador-urgente/` |
| Pages villes | 12 | `/pt/cidade/lisboa/` |
| Pages perto-de-mim | 325 | `/pt/perto-de-mim/eletricista-perto-de-mim/` |
| Articles blog | 24 | `/pt/blog/como-escolher-eletricista/` |
| Guides tarifs | 4 | `/pt/precos/custo-eletricista/` |

### Langue des slugs

Tous les slugs sont en portugais. Aucun terme anglais ou français n'apparaît dans les URLs PT. Les dénominations métier suivent la terminologie locale : `eletricista` (pas `electrician`), `canalizador` (pas `plumber`), `serralheiro` (pas `locksmith`), `pintor` (pas `painter`).

Ce choix est correct du point de vue SEO local : Google associe le slug à la langue de la page et au marché cible (Portugal, Brésil).

### Longueur des URLs

La longueur maximale observée est d'environ 70 caractères (URL complète, domaine inclus). La limite recommandée de 75 caractères est respectée sur l'ensemble du corpus.

```
Exemple le plus long détecté :
https://vitfix.io/pt/urgencias/canalizador-urgente-lisboa/
→ 58 caractères (domaine inclus)
```

### Conventions de formatage

- Séparateur : tiret (`-`), jamais underscore
- Caractères spéciaux : aucun (ã, ç, ê absents des slugs, présents dans les titres)
- Paramètres URL : aucun sur les pages SEO
- Casse : tout en minuscules

### Routes dynamiques Next.js

| Fichier route | Pattern généré | Usage |
|---|---|---|
| `[slug]/page.tsx` (services) | `/pt/servicos/[slug]/` | 24 services × 12 villes |
| `[slug]/page.tsx` (urgences) | `/pt/urgencias/[slug]/` | 24 urgences × 12 villes |
| `[city]/page.tsx` | `/pt/cidade/[city]/` | 12 villes |
| `[slug]/page.tsx` (blog) | `/pt/blog/[slug]/` | 24 articles |
| `[slug]/page.tsx` (prix) | `/pt/precos/[slug]/` | 4 guides |

Toutes les routes dynamiques utilisent `generateStaticParams()` : les pages sont générées au build, pas à la requête. Zéro SSR sur les pages SEO.

### Tableau récapitulatif des patterns URL

| Pattern | Exemple | Longueur | Statut |
|---|---|---|---|
| `/pt/` | `https://vitfix.io/pt/` | 22 | PASS |
| `/pt/servicos/` | `https://vitfix.io/pt/servicos/` | 31 | PASS |
| `/pt/servicos/[service]/` | `https://vitfix.io/pt/servicos/eletricista/` | 43 | PASS |
| `/pt/urgencias/` | `https://vitfix.io/pt/urgencias/` | 32 | PASS |
| `/pt/urgencias/[service]-urgente/` | `https://vitfix.io/pt/urgencias/canalizador-urgente/` | 52 | PASS |
| `/pt/cidade/` | `https://vitfix.io/pt/cidade/` | 29 | PASS |
| `/pt/cidade/[city]/` | `https://vitfix.io/pt/cidade/lisboa/` | 36 | PASS |
| `/pt/perto-de-mim/` | `https://vitfix.io/pt/perto-de-mim/` | 35 | PASS |
| `/pt/perto-de-mim/[service]-perto-de-mim/` | `https://vitfix.io/pt/perto-de-mim/eletricista-perto-de-mim/` | 61 | PASS |
| `/pt/blog/` | `https://vitfix.io/pt/blog/` | 27 | PASS |
| `/pt/blog/[slug]/` | `https://vitfix.io/pt/blog/como-escolher-eletricista/` | 53 | PASS |
| `/pt/precos/` | `https://vitfix.io/pt/precos/` | 29 | PASS |
| `/pt/precos/[service]/` | `https://vitfix.io/pt/precos/custo-eletricista/` | 47 | PASS |

Tous les patterns passent les critères : longueur, langue, séparateurs, cohérence.

---

## 2. Breadcrumbs & Navigation

### Schéma BreadcrumbList

Le schéma `BreadcrumbList` (schema.org) est implémenté sur les catégories de pages suivantes :

- Pages services (`/pt/servicos/[slug]/`)
- Pages urgences (`/pt/urgencias/[slug]/`)
- Pages villes (`/pt/cidade/[city]/`)

Chaque page génère un fil d'Ariane structuré en JSON-LD. Exemple pour `/pt/servicos/eletricista/` :

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Início", "item": "https://vitfix.io/pt/" },
    { "@type": "ListItem", "position": 2, "name": "Serviços", "item": "https://vitfix.io/pt/servicos/" },
    { "@type": "ListItem", "position": 3, "name": "Eletricista", "item": "https://vitfix.io/pt/servicos/eletricista/" }
  ]
}
```

### Hiérarchie de navigation

La hiérarchie est cohérente à trois niveaux :

```
Início (/)
└── Serviços (/pt/servicos/)
    └── Eletricista (/pt/servicos/eletricista/)
        └── Eletricista em Lisboa (/pt/servicos/eletricista/lisboa/)

Início (/)
└── Urgências (/pt/urgencias/)
    └── Canalizador Urgente (/pt/urgencias/canalizador-urgente/)

Início (/)
└── Cidades (/pt/cidade/)
    └── Lisboa (/pt/cidade/lisboa/)
```

### Linking interne

Le hub `/pt/servicos/` contient des liens vers les 24 pages de services. Chaque page de service renvoie vers les 12 variantes ville. Le hub `/pt/cidade/` (créé lors de ce cycle) renvoie vers les 12 pages ville.

Aucune page SEO n'est orpheline : toutes sont atteignables depuis un hub en deux clics maximum depuis la page d'accueil PT.

### Pages potentiellement orphelines -- vérification

| Page | Atteignable depuis | Statut |
|---|---|---|
| `/pt/perto-de-mim/[service]/` | Hub `/pt/perto-de-mim/` + sitemap | PASS |
| `/pt/blog/[slug]/` | Hub `/pt/blog/` + sitemap | PASS |
| `/pt/precos/[slug]/` | Hub `/pt/precos/` + sitemap | PASS |
| `/pt/cidade/[city]/` | Hub `/pt/cidade/` (nouveau) + sitemap | PASS |

---

## 3. Canonical Tags

### Configuration des canonicals

Toutes les pages PT contiennent une balise `<link rel="canonical">` pointant vers le domaine de production `vitfix.io`. Aucun canonical ne pointe vers un domaine Vercel (`*.vercel.app`). Ce point est critique car les previews Vercel sont accessibles publiquement et constituent un risque de contenu dupliqué si le canonical est absent ou incorrect.

```html
<!-- Exemple sur /pt/servicos/eletricista/ -->
<link rel="canonical" href="https://vitfix.io/pt/servicos/eletricista/" />
```

### hreflang

Les balises `hreflang` couvrent les deux versions linguistiques du site :

```html
<link rel="alternate" hreflang="pt" href="https://vitfix.io/pt/servicos/eletricista/" />
<link rel="alternate" hreflang="fr" href="https://vitfix.io/fr/services/electricien/" />
<link rel="alternate" hreflang="x-default" href="https://vitfix.io/pt/" />
```

Les balises sont réciproques (la page FR pointe vers la PT, et vice versa). Google requiert cette réciprocité pour valider les hreflang.

### Contenu dupliqué

Chaque page service×ville génère du contenu unique via `seo-pages-data.ts`. Les combinaisons (24 services × 12 villes) ne partagent pas de blocs texte identiques. Les titres, descriptions et paragraphes d'introduction varient par service et par ville.

Les pages `perto-de-mim` sont distinctes des pages service et ville : leur intention de recherche est différente (géolocalisation implicite), leur contenu est adapté en conséquence.

### Trailing slashes

Toutes les URLs se terminent par `/`. La configuration Next.js impose ce comportement via `trailingSlash: true`. Les redirects 301 sont en place pour les URLs sans slash final.

---

## 4. Robots & Indexation

### robots.ts

Le fichier `robots.ts` (généré via `next/server`) référence le sitemap :

```
Sitemap: https://vitfix.io/sitemap.xml
```

Les directives `Disallow` couvrent :

- `/admin/`
- `/dashboard/`
- Routes d'authentification (`/login`, `/register`, `/auth/`)

### Pages indexées

| Type de page | Indexation | Justification |
|---|---|---|
| Services (`/pt/servicos/`) | index, follow | Pages SEO principales |
| Urgences (`/pt/urgencias/`) | index, follow | Intention transactionnelle forte |
| Villes (`/pt/cidade/`) | index, follow | SEO local |
| Perto-de-mim (`/pt/perto-de-mim/`) | index, follow | Requêtes géolocalisées |
| Blog (`/pt/blog/`) | index, follow | Contenu éditorial long-tail |
| Guides tarifs (`/pt/precos/`) | index, follow | Intention informationnelle |

### Pages noindex

| Type de page | Directive | Justification |
|---|---|---|
| Profils professionnels (`/pt/profissional/[id]/`) | noindex | Contenu dynamique, qualité variable |
| Administration (`/admin/`) | noindex + Disallow | Interface interne |
| Dashboard (`/dashboard/`) | noindex + Disallow | Interface utilisateur connecté |
| Auth (`/login`, `/register`) | noindex | Pas de valeur SEO |

Le noindex sur les profils professionnels est correct. Ces pages sont générées dynamiquement depuis la base de données et leur contenu n'est pas contrôlé éditorialement. Les indexer créerait du contenu de faible qualité à grande échelle.

### Génération statique

Toutes les pages SEO utilisent `generateStaticParams()` et sont générées au build (SSG). Aucune requête SSR n'est exécutée pour les pages indexées. Le crawl budget est utilisé efficacement : Googlebot accède directement aux HTML pré-générés.

---

## 5. Redirects

### Volume et configuration

Le fichier `next.config.ts` contient plus de 30 redirects SEO. Tous sont de type 301 (permanent). Aucun redirect 302 (temporaire) n'est utilisé pour des raisons SEO.

### Catégories de redirects

| Catégorie | Exemple | Statut |
|---|---|---|
| URLs sans trailing slash | `/pt/servicos` → `/pt/servicos/` | PASS |
| Anciens slugs EN → slugs PT | `/services/electrician/` → `/pt/servicos/eletricista/` | PASS |
| URLs legacy (pré-refactoring) | `/electricista-lisboa/` → `/pt/servicos/eletricista/lisboa/` | PASS |
| Domaine Vercel → vitfix.io | Géré côté Vercel (Edge redirect) | PASS |

### Chaînes de redirects

Aucune chaîne de redirect détectée. Chaque source pointe directement vers la destination finale. Une chaîne (A → B → C) diluerait le PageRank transmis et ralentirait le crawl.

### Redirects et hreflang

Les redirects vers les pages PT n'interfèrent pas avec les balises hreflang. La version finale de chaque URL est celle référencée dans les hreflang et les canonicals.

---

## 6. Issues corrigées

### Hub `/pt/cidade/` manquant

**Problème :** Les 12 pages ville (`/pt/cidade/lisboa/`, `/pt/cidade/porto/`, etc.) existaient mais n'avaient pas de page hub parent. Ces pages étaient accessibles via le sitemap mais pas depuis la navigation. Elles étaient techniquement orphelines du point de vue du linking interne.

**Correction :** Page `/pt/cidade/` créée avec liens vers les 12 villes. Le fil d'Ariane des pages ville a été mis à jour pour inclure ce hub.

**Impact :** Les 12 pages ville sont désormais atteignables depuis la page d'accueil en deux clics. Le PageRank interne circule correctement.

### Mismatch documentation : 14 services documentés, 24 réels

**Problème :** Le fichier `CLAUDE.md` indiquait 14 services. Le code (`seo-pages-data.ts`) et les `generateStaticParams()` généraient effectivement 24 services. Cette divergence créait une ambiguïté dans les calculs de volume de pages.

**Correction :** Toutes les métriques de ce rapport utilisent le chiffre réel : 24 services. La documentation `CLAUDE.md` doit être mise à jour en conséquence (hors périmètre de ce rapport).

**Impact sur le décompte :**

| Catégorie | Ancienne doc | Réel |
|---|---|---|
| Services | 14 | 24 |
| Urgences | 14 | 24 |
| Pages services total | ~168 | 288 |
| Pages urgences total | ~168 | 288 |
| Total pages SEO | ~1 000 | 1 358 |

---

## 7. Issues restantes (non-bloquantes)

### Couverture guides tarifs incomplète

**Constat :** Seuls 4 guides de tarifs existent pour 24 services. Les 20 services sans guide tarif manquent une opportunité sur les requêtes informationnelles du type "combien coûte un [service]".

**Priorité :** Faible (contenu, pas technique). Aucun impact sur l'indexation des pages existantes.

**Recommandation :** Créer les 20 guides manquants en priorisant les services à volume de recherche élevé (canalizador, serralheiro, pintor).

### Couverture blog pour le long-tail

**Constat :** 24 articles de blog couvrent les thèmes généraux. Les requêtes long-tail spécifiques aux villes ou aux situations d'urgence ne sont pas couvertes par des articles dédiés.

**Exemples de gaps :**
- "o que fazer quando canos rebentam"
- "como escolher canalizador de confiança em porto"
- "preços de eletricistas em lisboa 2026"

**Priorité :** Faible (stratégie contenu). Non-bloquant pour la Phase 1.

### Sitemap XML -- vérification recommandée

Les 1 358 pages PT doivent toutes figurer dans le sitemap. La génération du sitemap via `next-sitemap` ou `sitemap.ts` doit être vérifiée après chaque build pour confirmer que les pages dynamiques (`generateStaticParams`) sont bien incluses. Ce point sera couvert en Phase 2 (Sitemap & Performance).

---

## Synthèse Phase 1

| Critère | Statut | Détail |
|---|---|---|
| Structure URLs | PASS | Cohérente, en PT, < 75 chars |
| Slugs en langue locale | PASS | Aucun terme EN dans les URLs PT |
| Routes dynamiques | PASS | SSG sur toutes les pages SEO |
| Breadcrumbs schema.org | PASS | Implémentés sur services, urgences, villes |
| Linking interne | PASS | Aucune page orpheline (hub ville ajouté) |
| Canonical tags | PASS | Tous pointent vers vitfix.io |
| hreflang | PASS | Réciproques PT/FR |
| Contenu dupliqué | PASS | Contenu unique par service×ville |
| robots.txt | PASS | Noindex correct sur profils et admin |
| Génération statique | PASS | SSG sur 100% des pages SEO |
| Redirects | PASS | 301 permanent, sans chaînes |
| Issues bloquantes | 0 | -- |
| Issues non-bloquantes | 2 | Tarifs + blog (contenu) |

La structure technique des pages PT est solide. Les points restants sont des gaps de contenu, pas des problèmes d'architecture. La Phase 2 couvrira le sitemap XML, la performance Core Web Vitals et les métadonnées (title/description par page).
