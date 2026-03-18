# COMMANDE CLAUDE CODE — INTÉGRATION SEO PORTUGAL

> **Copie-colle ce prompt dans Claude Code pour intégrer tout le contenu SEO dans l'app Next.js.**

---

## PROMPT À DONNER À CLAUDE CODE :

```
Lê o ficheiro seo-portugal/INTEGRATION-CLAUDE-CODE.md pour comprendre le contexte.

OBJECTIF : Intégrer tout le contenu SEO de seo-portugal/Content/ dans l'app Next.js fixit-production.

CONTEXTE :
- L'app a déjà un blog qui fonctionne via lib/data/seo-pages-data.ts (26 articles en TypeScript inline)
- Le blog utilise app/blog/[slug]/page.tsx qui importe BLOG_ARTICLES depuis seo-pages-data.ts
- Les pages locales sont générées programmatiquement via CITIES × SERVICES
- Il y a 38 nouveaux articles .md dans seo-portugal/Content/Blog/
- Il y a 108 pages locales .md dans seo-portugal/Content/Local/
- Il y a 1 page B2B .md dans seo-portugal/Content/Pages/

APPROCHE RECOMMANDÉE (par ordre de priorité) :

### ÉTAPE 1 — Convertir les articles .md en données TypeScript

Crée un nouveau fichier lib/data/seo-blog-extended.ts qui :
1. Exporte un tableau EXTENDED_BLOG_ARTICLES avec le même interface BlogArticle
2. Pour chaque fichier .md dans seo-portugal/Content/Blog/, parse le frontmatter et le contenu markdown en objet BlogArticle
3. Les sections H2 du markdown deviennent des objets { heading, content }
4. Le premier paragraphe avant le premier H2 devient l'intro

Puis dans lib/data/seo-pages-data.ts :
- Importe EXTENDED_BLOG_ARTICLES depuis seo-blog-extended.ts
- Merge les deux tableaux : export const ALL_BLOG_ARTICLES = [...BLOG_ARTICLES, ...EXTENDED_BLOG_ARTICLES]
- Mets à jour getBlogArticle() pour chercher dans ALL_BLOG_ARTICLES
- Mets à jour generateStaticParams() dans app/blog/[slug]/page.tsx pour utiliser ALL_BLOG_ARTICLES

### ÉTAPE 2 — Ajouter le support des catégories manquantes

L'interface BlogArticle a un type category limité à : 'eletricidade' | 'canalizacao' | 'pintura' | 'pladur' | 'obras' | 'isolamento' | 'impermeabilizacao' | 'desentupimento' | 'manutencao'

Il faut ajouter ces catégories :
- 'condominios' (articles B2B)
- 'legislacao' (articles législation)
- 'profissionais' (articles côté offre)
- 'expats' (articles anglais)
- 'alojamento-local' (articles Airbnb)
- 'precos' (guides de prix)
- 'sazonal' (articles saisonniers)
- 'regional' (guides régionaux)

Mets à jour le categoryLabel() dans app/blog/[slug]/page.tsx pour gérer ces nouvelles catégories.

### ÉTAPE 3 — Articles anglais (EN)

Pour les 3 articles en anglais (lang: en) :
- Crée app/en/blog/[slug]/page.tsx (copie de app/blog/[slug]/page.tsx mais avec locale: 'en_GB')
- Filtre les articles par lang dans generateStaticParams()
- Les articles EN ont type: 'article-en' et lang: 'en' dans leur frontmatter

### ÉTAPE 4 — Pages locales enrichies

Les 108 pages locales dans Content/Local/ sont du contenu ENRICHI par rapport aux pages programmatiques existantes (CITIES × SERVICES).
Options :
a) Créer une route app/pt/[slug]/page.tsx qui charge le contenu depuis les fichiers .md (via un loader)
b) Ou convertir en données TypeScript et les servir via la même logique que les pages de service existantes mais avec contenu plus riche

L'option (a) est plus propre. Utilise gray-matter pour parser le frontmatter et remark/rehype pour le markdown.

### ÉTAPE 5 — Schema JSON-LD

Le fichier seo-portugal/templates/schema-jsonld-templates.md contient les templates.
Intègre-les dans les composants :
- app/blog/[slug]/page.tsx → Article + FAQPage
- Pages locales → LocalBusiness + FAQPage
- Pages de service → Service + FAQPage

### ÉTAPE 6 — Sitemap

Le fichier app/sitemap.ts existe déjà. Ajoute toutes les nouvelles URLs :
- /pt/blog/[slug] pour les 38 nouveaux articles
- /en/blog/[slug] pour les 3 articles anglais
- /pt/[slug] pour les 108 pages locales enrichies

### ÉTAPE 7 — Vérifications

Après intégration :
1. npm run build — doit compiler sans erreur
2. Vérifier que chaque nouvelle page est accessible
3. Vérifier que le sitemap inclut toutes les URLs
4. Vérifier que les Schema JSON-LD sont valides (test avec Rich Results Test de Google)
5. Vérifier que les meta tags (title, description, canonical, OG) sont corrects

FICHIERS CLÉS À MODIFIER :
- lib/data/seo-pages-data.ts (interface + catégories + merge)
- lib/data/seo-blog-extended.ts (NOUVEAU — articles étendus)
- app/blog/[slug]/page.tsx (catégories + import)
- app/blog/page.tsx (listing)
- app/en/blog/[slug]/page.tsx (NOUVEAU — articles EN)
- app/sitemap.ts (nouvelles URLs)

FICHIERS DE CONTENU SOURCE :
- seo-portugal/Content/Blog/*.md (38 articles)
- seo-portugal/Content/Local/*.md (108 pages locales)
- seo-portugal/Content/Pages/*.md (1 page B2B)
- seo-portugal/templates/schema-jsonld-templates.md (Schema markup)
- seo-portugal/templates/sitemap-urls-completo.md (liste URLs)
```

---

## NOTES IMPORTANTES

### Structure des fichiers .md

Chaque fichier .md a un frontmatter YAML :
```yaml
---
title: Titre de la page
description: Meta description
keyword: mot-clé principal
slug: slug-url
date: 2026-03-18
category: catégorie
type: artigo-seo | pagina-local | pagina-b2b | guia-precos | article-en
cidade: Nom de la ville (pour pages locales)
servico: Type de service (pour pages locales)
lang: pt | en
---
```

Suivi du contenu Markdown avec H1, H2, H3, listes, tableaux, etc.

### Mapping catégories

| type (frontmatter) | category (TypeScript) |
|---|---|
| artigo-seo | selon le sujet (obras, canalizacao, etc.) |
| pagina-local | N/A — route séparée |
| pagina-b2b | condominios |
| guia-precos | precos |
| artigo-b2b | condominios |
| article-en | expats |

### Dépendances à installer

```bash
npm install gray-matter remark remark-html
```

---

*Fichier créé le 18 mars 2026*
*Projet : Vitfix.io SEO Portugal*
