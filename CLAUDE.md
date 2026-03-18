# CLAUDE.md — Vitfix.io

> **Lis ce fichier au début de chaque session.**
> Il référence toutes les ressources nécessaires pour travailler sur le projet.

---

## Projet

**Vitfix.io** — Plateforme de mise en relation entre artisans/professionnels de construction et clients (B2C + B2B).

- **Stack :** Next.js 14, TypeScript, Tailwind CSS, Supabase, Vercel
- **Marchés actifs :** France (Marseille/PACA) et Portugal (Porto/Tâmega e Sousa)
- **URL production :** https://vitfix.io
- **URL provisoire :** https://fixit-production.vercel.app

---

## Structure du projet

```
fixit-production/
├── app/                        ← Pages Next.js (App Router)
│   ├── fr/                     ← Pages marché France (Marseille)
│   │   ├── services/           ← Pages services × villes (SEO programmatique)
│   │   ├── urgence/            ← Pages urgence × villes
│   │   ├── ville/              ← Pages par ville
│   │   ├── blog/               ← Articles blog FR
│   │   ├── specialites/        ← Niches spécifiques PACA
│   │   ├── copropriete/        ← Pages B2B copropriété
│   │   ├── pres-de-chez-moi/   ← Pages "near me"
│   │   └── simulateur-devis/   ← Simulateur de devis par ville
│   ├── pt/                     ← Pages marché Portugal (~350+ pages)
│   │   ├── servicos/           ← Pages services × villes (14 services × 12 villes)
│   │   ├── urgencia/           ← Pages urgence × villes
│   │   ├── cidade/             ← Pages par ville (12 villes)
│   │   └── blog/               ← Articles blog PT
│   ├── en/                     ← Pages marché anglophone (Porto expats)
│   └── sitemap.ts              ← Sitemap dynamique
├── lib/
│   ├── fr-seo-pages-data.ts    ← Données SEO FR (20 services × 19 villes)
│   ├── fr-blog-data.ts         ← Articles blog FR
│   └── seo-pages-data.ts       ← Données SEO PT
├── seo-portugal/               ← Stratégie SEO marché Portugal
│   ├── CLAUDE.md               ← Guide complet SEO Portugal (lire en priorité)
│   ├── context/
│   │   ├── about-platform.md   ← Description complète de la plateforme
│   │   └── brand-voice.md      ← Tom et voix de marque
│   ├── Content/                ← Contenus PT créés
│   ├── Keywords/               ← Recherche mots-clés PT
│   ├── Templates/              ← Modèles de pages PT
│   └── Reports/                ← Rapports SEO PT
├── product/                    ← Produto e desenvolvimento
│   ├── roadmap.md              ← Mapa de produto, prioridades, estado atual
│   ├── bugs.md                 ← Bugs conhecidos e estado de resolução
│   └── decisions.md            ← Decisões técnicas e de produto documentadas
├── marketing/                  ← Marketing e comunicação
│   ├── CLAUDE.md               ← Contexto marketing (redes sociais, emails, anúncios)
│   ├── social-media/           ← Templates e calendário redes sociais
│   └── ads/                    ← Campanhas publicitárias
│       ├── google-ads.md       ← Estratégia e campanhas Google Ads
│       └── meta-ads.md         ← Estratégia e campanhas Meta/Facebook Ads
├── business/                   ← Estratégia e concorrência
│   ├── competitors.md          ← Análise de concorrência atualizada
│   └── growth-ideas.md         ← Ideias de crescimento e oportunidades
├── clients/                    ← Relação com clientes e profissionais
│   ├── onboarding/
│   │   ├── onboarding-profissionais.md  ← Processo de onboarding profissionais
│   │   └── onboarding-clientes.md       ← Processo de onboarding clientes
│   ├── templates-emails/
│   │   └── confirmacoes-lembretes-reclamacoes.md  ← Templates de emails
│   └── faq-responses/
│       └── faq-completo.md              ← FAQ completo da plataforma
└── components/                 ← Composants React partagés
```

---

## Marchés et langues

| Marché | Locale | Villes prioritaires | Fichier de référence |
|--------|--------|---------------------|---------------------|
| France | `fr` | Marseille, Aix-en-Provence, Aubagne, La Ciotat + 15 villes PACA | `lib/fr-seo-pages-data.ts` |
| Portugal | `pt` | Marco de Canaveses, Penafiel, Amarante, Porto + 8 villes | `seo-portugal/CLAUDEmemory.md` |
| English | `en` | Porto (expats) | `lib/en-services-data.ts` |

---

## Règles SEO — toujours appliquer

### Avant de créer du contenu :
1. Vérifier si une page existe déjà pour ce thème/ville/service
2. Ne jamais créer de duplicata — améliorer l'existant
3. Utiliser le bon fichier de données (`fr-seo-pages-data.ts` ou `seo-pages-data.ts`)

### Schema markup :
- France : `HomeAndConstructionBusiness` + `AggregateRating` + `areaServed` (8 villes)
- Portugal : `HomeAndConstructionBusiness` + `AggregateRating` + `areaServed` (12 villes) + `EmergencyService` (urgences)
- Toujours inclure `BreadcrumbList` et `FAQPage` sur les pages de service

### Meta tags :
- Title : 50-60 caractères, mot-clé au début
- Description : 150-160 caractères, avec CTA
- H1 unique par page avec mot-clé principal
- Canonical URL vers vitfix.io (jamais vercel.app)

### Langue :
- **FR** : Français standard
- **PT** : Portugais européen uniquement (jamais brésilien)
  - Dire "canalizador" pas "encanador"
  - Dire "telemóvel" pas "celular"
  - Dire "obras de renovação" pas "reforma"

---

## Fichier mémoire SEO Portugal — LIRE EN PRIORITÉ

- `seo-portugal/CLAUDEmemory.md` — **Fichier mémoire complet** : contexte produit, rotas implementadas, services (14), villes (12), GEO, vocabulaire régional, concurrents, calendrier de contenu, profils utilisateurs, mots-clés. Lire ce fichier au début de chaque session SEO Portugal.

---

## Fichiers de contexte par domaine

### SEO Portugal — lire en priorité pour tout contenu PT
- `seo-portugal/CLAUDEmemory.md` — Fichier mémoire complet (produit, routes, services, GEO, vocabulaire, concurrents)
- `seo-portugal/CLAUDE.md` — Stratégie complète, mots-clés, calendrier, modèles
- `seo-portugal/context/about-platform.md` — Fonctionnalités de la plateforme
- `seo-portugal/context/brand-voice.md` — Tom et vocabulaire approuvé

### Produto e desenvolvimento
- `product/roadmap.md` — Mapa de produto, funcionalidades, prioridades
- `product/bugs.md` — Bugs conhecidos e estado de resolução
- `product/decisions.md` — Decisões técnicas e de produto documentadas

### Marketing e comunicação
- `marketing/CLAUDE.md` — Contexto marketing (redes sociais, emails, anúncios)
- `marketing/ads/google-ads.md` — Estratégia e campanhas Google Ads
- `marketing/ads/meta-ads.md` — Estratégia e campanhas Meta/Facebook Ads
- `marketing/social-media/posts-templates.md` — Templates para redes sociais

### Clientes e onboarding
- `clients/onboarding/onboarding-profissionais.md` — Processo de onboarding profissionais
- `clients/onboarding/onboarding-clientes.md` — Processo de onboarding clientes
- `clients/templates-emails/confirmacoes-lembretes-reclamacoes.md` — Templates de emails
- `clients/faq-responses/faq-completo.md` — FAQ completo da plataforma

### Estratégia e concorrência
- `business/competitors.md` — Análise de concorrência atualizada
- `business/growth-ideas.md` — Ideias de crescimento e oportunidades

---

*Dernière mise à jour : 18 mars 2026 — PT: 14 services, 12 villes, ~350 pages, GEO (llms.txt + AI crawlers)*
