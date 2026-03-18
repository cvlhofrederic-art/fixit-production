# Guide d'Intégration — Contenu SEO Portugal

**Destinataires:** Équipe de développement (Frédéric et co.)
**Statut:** Prêt pour intégration dans vitfix.io/pt/
**Date:** Mars 2026

---

## Vue d'ensemble

Le contenu SEO Portugal est maintenant complet et prêt pour déploiement sur **vitfix.io/pt/**. Voici ce que tu dois intégrer :

| Type | Quantité | Format |
|---|---|---|
| **Pages locales** (villes + services) | 77 pages | Markdown + frontmatter YAML |
| **Articles blog** | 28 articles | Markdown + frontmatter YAML |
| **Pages B2B** (condomínios) | 1 page | Markdown + frontmatter YAML |
| **Schémas JSON-LD** | 200+ | Templates prêts à copier |
| **Sitemap URLs** | 106 URLs | Liste complète fournie |
| **Répertoire** | `/Content/` | Structure organisée |

**Total:** ~106 pages SEO optimisées en portugais européen.

Tous les fichiers sont en **Markdown avec frontmatter YAML** — structure standard, facile à parser.

---

## Architecture Recommandée pour Next.js

### Routes dynamiques proposées

```
/pt/blog/[slug]/ → Articles de blog (example: /pt/blog/quanto-custa-canalizador-portugal-2026/)
/pt/[slug]/ → Pages locales (example: /pt/empreiteiro-porto/)
/pt/condominios/ → Page B2B (static page)
```

### Structure de fichiers locale

```
seo-portugal/
├── Content/
│   ├── Blog/
│   │   ├── quanto-custa-canalizador-portugal-2026.md
│   │   ├── empreiteiro-porto-guia-completo-2026.md
│   │   ├── ... (28 articles au total)
│   │   └── (format: titre, description, keyword, slug, category, date)
│   │
│   ├── Local/
│   │   ├── empreiteiro-porto.md
│   │   ├── canalizador-penafiel.md
│   │   ├── obras-renovacao-vila-nova-de-gaia.md
│   │   ├── ... (77 pages au total)
│   │   └── (format: titre, description, keyword, slug, cidade, servico)
│   │
│   └── Pages/
│       └── (pages statiques comme condomínios)
│
├── templates/
│   ├── schema-jsonld-templates.md
│   └── sitemap-urls-completo.md
│
└── README.md (ce fichier)
```

---

## Option A : Intégration dans `seo-pages-data.ts` (Recommandé — Plus Rapide)

Si tu as déjà un fichier `lib/seo-pages-data.ts` ou similaire qui centralise le contenu :

### 1. Ajoute les articles au tableau

```typescript
// lib/seo-pages-data.ts

export const blogArticles = [
  {
    id: "quanto-custa-canalizador-portugal-2026",
    slug: "quanto-custa-canalizador-portugal-2026",
    title: "Quanto Custa um Canalizador em Portugal em 2026?",
    description: "Guia completo de preços...",
    keyword: "quanto custa canalizador Portugal",
    category: "precos",
    date: "2026-03-18",
    content: "<!-- Contenu Markdown brut -->"
  },
  // ... répète pour chaque article
];

export const localPages = [
  {
    id: "empreiteiro-porto",
    slug: "empreiteiro-porto",
    title: "Empreiteiro no Porto | Profissionais Verificados | Vitfix.io",
    description: "Encontre empreiteiro verificado...",
    keyword: "empreiteiro Porto",
    cidade: "Porto",
    servico: "empreiteiro",
    date: "2026-03-18",
    content: "<!-- Contenu Markdown brut -->"
  },
  // ... répète pour chaque page locale
];
```

### 2. Crée les routes dynamiques

```typescript
// app/pt/blog/[slug]/page.tsx

import { blogArticles } from "@/lib/seo-pages-data";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  return blogArticles.map((article) => ({
    slug: article.slug,
  }));
}

export default function BlogPage({ params }: { params: { slug: string } }) {
  const article = blogArticles.find((a) => a.slug === params.slug);

  if (!article) {
    notFound();
  }

  return (
    <>
      <head>
        <title>{article.title}</title>
        <meta name="description" content={article.description} />
        <meta property="og:title" content={article.title} />
        <meta property="og:description" content={article.description} />
        <link rel="canonical" href={`https://vitfix.io/pt/blog/${article.slug}/`} />
      </head>

      <article>
        <h1>{article.title}</h1>
        <div dangerouslySetInnerHTML={{ __html: article.content }} />
      </article>
    </>
  );
}
```

### 3. Lis les fichiers Markdown et parse

```typescript
// scripts/parse-seo-content.ts

import fs from "fs";
import path from "path";
import matter from "gray-matter"; // npm install gray-matter

const contentDir = path.join(process.cwd(), "seo-portugal", "Content");

export function loadMarkdownContent(folder: string) {
  const folderPath = path.join(contentDir, folder);
  const files = fs.readdirSync(folderPath).filter((f) => f.endsWith(".md"));

  return files.map((file) => {
    const filePath = path.join(folderPath, file);
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(fileContent);

    return {
      ...data,
      content, // Markdown brut
      slug: data.slug || file.replace(".md", ""),
    };
  });
}

// Utilisation
const blogArticles = loadMarkdownContent("Blog");
const localPages = loadMarkdownContent("Local");
```

---

## Option B : Fichiers MDX dans `/app` (Plus Flexible)

Si tu préfères que chaque page soit son propre fichier (meilleure performance, rechargement à chaud) :

### 1. Convertis Markdown en MDX

```
seo-portugal/Content/Blog/quanto-custa-canalizador.md
→ app/pt/blog/quanto-custa-canalizador-portugal-2026/page.mdx
```

### 2. Crée un composant MDX wrapper

```typescript
// app/pt/blog/[slug]/layout.tsx

import { ReactNode } from "react";

export default function BlogLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <article className="prose prose-lg max-w-4xl mx-auto py-12">
      {children}
    </article>
  );
}
```

### 3. Utilise remark/rehype pour le parsing

```typescript
// lib/mdx-utils.ts

import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm"; // Tables, strikethrough, etc.
import rehypePrism from "rehype-prism-plus"; // Syntax highlighting

export async function parseMDXContent(mdxString: string) {
  const result = await compile(mdxString, {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypePrism],
  });

  return result;
}
```

**Avantage Option B:** Chaque page est un fichier indépendant — plus facile à maintenir et à modifier.
**Inconvénient:** Duplicate de contenu si tu utilises aussi un CMS centralisé.

---

## Contenu des Fichiers Markdown — Format Standard

Chaque fichier suit ce format :

```markdown
---
title: "Page Title (50-60 chars)"
description: "Meta description (150-160 chars)"
keyword: "primary-keyword"
slug: "url-slug"
type: "pagina-local" ou "artigo-seo"
cidade: "Porto" (pour pages locales uniquement)
servico: "empreiteiro" (pour pages locales uniquement)
category: "precos" ou "obras" (pour articles uniquement)
date: "2026-03-18"
---

# H1 Heading (= title avec variantes mineures)

Texte introductif...

## H2 Section

Contenu avec listes, tableaux, balises structurées.

### H3 Sous-section

Plus de détails.

## FAQ

### Question 1?
Réponse...

### Question 2?
Réponse...

---

## Références

- [Link 1](url)
- [Link 2](url)
```

---

## Schémas JSON-LD — À Intégrer

Chaque page doit avoir un schéma JSON-LD approprié. Les templates sont dans `/templates/schema-jsonld-templates.md`.

### Par type de page

| Type | Schema | Exemple |
|---|---|---|
| **Article blog** | `Article` + `FAQPage` | Guias de preços, artigos educativos |
| **Page local** | `LocalBusiness` + `FAQPage` | Empreiteiro no Porto, Canalizador em Penafiel |
| **Page B2B** | `Organization` + `FAQPage` | Página condomínios |
| **Guide de prix** | `Article` + `HowTo` + `FAQPage` | "Quanto custa X?" |

### Exemple pour "Article"

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Quanto Custa um Canalizador em Portugal em 2026?",
  "description": "Guia completo de preços...",
  "image": "https://vitfix.io/images/canalizador.jpg",
  "datePublished": "2026-03-18",
  "author": {
    "@type": "Organization",
    "name": "Vitfix.io"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Vitfix.io",
    "logo": {
      "@type": "ImageObject",
      "url": "https://vitfix.io/logo.png"
    }
  }
}
</script>
```

### Exemple pour "LocalBusiness"

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Empreiteiros Verificados no Porto",
  "description": "Encontre empreiteiro verificado...",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Porto",
    "addressRegion": "PT",
    "addressCountry": "PT"
  },
  "url": "https://vitfix.io/pt/empreiteiro-porto/",
  "telephone": "+351-XXX-XXX-XXX"
}
</script>
```

**Important:** Ajoute les schémas dans le `<head>` de chaque page — Google Rich Results Test doit passer sans erreurs.

---

## Meta Tags — Template Standard

Chaque page doit avoir ces meta tags :

```html
<!-- Meta tags essentiels -->
<title>{frontmatter.title}</title>
<meta name="description" content="{frontmatter.description}" />
<meta name="keywords" content="{frontmatter.keyword}, Portugal" />
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />

<!-- Open Graph (partage réseaux sociaux) -->
<meta property="og:title" content="{frontmatter.title}" />
<meta property="og:description" content="{frontmatter.description}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="https://vitfix.io/pt/{frontmatter.slug}/" />
<meta property="og:image" content="https://vitfix.io/images/default-og.jpg" />
<meta property="og:locale" content="pt_PT" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{frontmatter.title}" />
<meta name="twitter:description" content="{frontmatter.description}" />

<!-- Canonical URL (évite contenu dupliqué) -->
<link rel="canonical" href="https://vitfix.io/pt/{frontmatter.slug}/" />

<!-- Hreflang (multilingue) -->
<link rel="alternate" hreflang="pt" href="https://vitfix.io/pt/{frontmatter.slug}/" />
<link rel="alternate" hreflang="fr" href="https://vitfix.io/fr/{equivalent-slug}/" />
<link rel="alternate" hreflang="x-default" href="https://vitfix.io/" />
```

---

## Sitemap XML — À Générer

Voir `/templates/sitemap-urls-completo.md` pour la liste complète des 106 URLs.

### Génère dynamiquement avec Next.js

```typescript
// app/sitemap.ts

import { MetadataRoute } from "next";
import { blogArticles, localPages } from "@/lib/seo-pages-data";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://vitfix.io";

  // Pages blog
  const blogPages: MetadataRoute.Sitemap = blogArticles.map((article) => ({
    url: `${baseUrl}/pt/blog/${article.slug}/`,
    lastModified: new Date(article.date),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  // Pages locales
  const localPagesList: MetadataRoute.Sitemap = localPages.map((page) => ({
    url: `${baseUrl}/pt/${page.slug}/`,
    lastModified: new Date(page.date),
    changeFrequency: "weekly" as const,
    priority: 0.9, // Pages locales sont plus importantes
  }));

  // Pages statiques
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/pt/`,
      changeFrequency: "monthly" as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/pt/pesquisar/`,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/pt/condominios/`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
  ];

  return [...staticPages, ...blogPages, ...localPagesList];
}
```

Soumet le sitemap à Google Search Console après déploiement :
- `https://vitfix.io/pt/sitemap.xml`

---

## robots.txt — Recommandé

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /pro/dashboard/
Disallow: /syndic/dashboard/
Disallow: /auth/
Disallow: /*.json$
Disallow: /*?*

Crawl-delay: 1
Request-rate: 1/1s

Sitemap: https://vitfix.io/sitemap.xml
Sitemap: https://vitfix.io/pt/sitemap.xml
Sitemap: https://vitfix.io/fr/sitemap.xml
```

---

## Vérifications Avant Mise en Ligne

### Checklist SEO Technique

- [ ] **HTTPS sur tous les domaines** — Pas d'erreurs de certificat SSL
- [ ] **Responsive Design** — Mobile-first (test Mobile Friendly Test)
- [ ] **Core Web Vitals OK** — PageSpeed Insights score ≥90 (Largest Contentful Paint, First Input Delay, Cumulative Layout Shift)
- [ ] **Meta tags complets** — Title, description, og tags sur chaque page
- [ ] **Schema JSON-LD valide** — Tester avec [Rich Results Test](https://search.google.com/test/rich-results)
- [ ] **Images optimisées** — Avec alt text descriptif + compression (Squoosh, Tinypng)
- [ ] **Canonical URLs correctes** — Auto-détectées ou configurées manuellement
- [ ] **Hreflang PT/FR implémenté** — Validation avec Search Console
- [ ] **Sitemap.xml accessible** — `https://vitfix.io/pt/sitemap.xml` 200 OK
- [ ] **robots.txt en place** — `https://vitfix.io/robots.txt` avec Sitemap
- [ ] **Liens internes fonctionnels** — Pas de 404 en interne
- [ ] **Performance de chargement** — <3s First Contentful Paint sur 4G lent
- [ ] **Redirection HTTP→HTTPS** — Toutes les requêtes HTTP redirigent en 301
- [ ] **Pas de contenu dupliqué** — Test avec Copyscape ou Screaming Frog

### Vérifications Contenu

- [ ] **Pas de traduction automatique** — Tout a été révisé manuellement pour portugais européen
- [ ] **CTA clairs** — Tous les articles pointent vers `https://vitfix.io/pt/pesquisar/`
- [ ] **Mot-clés primaires présents** — Dans H1, premiers 100 mots, et meta description
- [ ] **Au moins 6 FAQ par page** — Captures les recherches par voix
- [ ] **Longueur minimale** — Articles blog ≥1.200 mots, pages locales ≥1.000 mots
- [ ] **Références externes** — Min 1 lien externe fiable par article (Portal da Habitação, DGEG, etc.)

### Outils de Vérification

1. **Google PageSpeed Insights** — https://pagespeed.web.dev/
2. **Google Rich Results Test** — https://search.google.com/test/rich-results
3. **Google Mobile Friendly Test** — https://search.google.com/mobile-friendly
4. **Lighthouse** — Intégré dans Chrome DevTools (F12 → Lighthouse)
5. **Screaming Frog** — Scan complet pour erreurs SEO (téléchargement local)

---

## Analytics et Monitoring

### Google Analytics 4 (GA4)

Ajoute ce script dans le `<head>` de chaque page :

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

Remplace `G-XXXXXXXXXX` par ton Google Analytics ID.

### Google Search Console

1. Vérifie la propriété du site (via DNS, fichier HTML ou Google Analytics)
2. Soumet le sitemap XML
3. Demande une ré-indexation immédiate pour les 106 URLs
4. Monitor chaque semaine :
   - Taux de clic (CTR) par keyword
   - Position moyenne dans les résultats
   - Pages avec impressions mais pas de clics (optimise further)
   - Pages qui reçoivent peu de trafic (improve ou delete)
   - Core Web Vitals issues

---

## Calendrier de Déploiement Recommandé

### Phase 1 : Préparation (2 jours)
- [ ] Convertis tous les fichiers Markdown en format Next.js
- [ ] Crée les routes dynamiques
- [ ] Ajoute les schémas JSON-LD
- [ ] Configure les meta tags

### Phase 2 : Testing (2 jours)
- [ ] Test sur environnement de staging (`staging-pt.vitfix.io`)
- [ ] Vérifie tous les liens internes
- [ ] Teste PageSpeed Insights et Core Web Vitals
- [ ] Vérifie Rich Results avec le Rich Results Test
- [ ] Test mobile responsiveness

### Phase 3 : Déploiement (1 jour)
- [ ] Deploy en production (`vitfix.io/pt/`)
- [ ] Réjout redirection du Vercel provisoire vers domaine principal
- [ ] Soumet sitemap à Google Search Console
- [ ] Demande ré-indexation immédiate

### Phase 4 : Monitoring (Continu)
- [ ] Monitore GA4 pour le trafic organique
- [ ] Vérifie Search Console chaque semaine
- [ ] Maintiens Core Web Vitals ≥90
- [ ] Met à jour le contenu si besoin (prix, dates, contexte local)

---

## Support et Maintenance

### Mises à jour futures

Le contenu est daté (mars 2026) — mettre à jour annuellement :

- [ ] Vérifie les prix encore réalistes (révise guides de prix)
- [ ] Ajoute nouvelles pages locales si expansion géographique
- [ ] Ajoute articles blog saisonniers (ex: "Rénovation d'automne", "Travaux d'urgence en hiver")
- [ ] Met à jour les références légales (code civil, normes) si change

### Nouvelle page locale?

Utilise le template :

```markdown
---
title: "[Service] em [Cidade] | Profissionais Verificados | Vitfix.io"
description: "Encontre [service] verificado em [cidade]..."
keyword: "[service] [cidade]"
slug: "[service]-[cidade]"
type: pagina-local
cidade: "[Cidade]"
servico: "[Service]"
date: "YYYY-MM-DD"
---
```

### Nouvel article blog?

Template :

```markdown
---
title: "[Action/Question] [Sujet] [Contexto/Année]"
description: "..."
keyword: "[primary keyword]"
slug: "[slug-slug-slug]"
type: artigo-seo
category: "[precos|obras|legislacao|etc]"
date: "YYYY-MM-DD"
---
```

---

## Questions Fréquentes (Dev Team)

**Q: Je dois ajouter le contenu dans une base de données?**
A: Non — tu peux laisser les fichiers Markdown dans le repo. Ils sont versionnés, faciles à modifier, et performants à la lecture. Pas besoin de CMS pour du contenu statique.

**Q: Quel langage/framework recommandez-vous?**
A: Next.js (App Router) + Markdown/MDX est idéal. C'est ce que Vitfix.io utilise déjà. Si tu préfères Gatsby ou Hugo, ça marche aussi.

**Q: Comment gérer les images?**
A: Chaque article devrait avoir 2-3 images max (1 cover image + 1-2 illustrations). Optimise à 1.2MB max avec Squoosh. Mets tous les alt text descriptifs.

**Q: Faut-il internationaliser les URLs?**
A: Oui. `/pt/blog/...` pour portugais, `/fr/blog/...` pour français. Utilise `hreflang` pour indiquer les versions alternatives.

**Q: Comment tracker la performance SEO?**
A: Google Search Console (tracking des keywords, CTR, position moyenne) + Google Analytics 4 (trafic organique, comportement utilisateur). Ajoute des tags GA4 aux CTAs pour tracker conversions.

---

**Date de création:** Mars 2026
**Prêt à déployer:** Oui
**Équipe de support:** Frédéric + Dev Portugal
