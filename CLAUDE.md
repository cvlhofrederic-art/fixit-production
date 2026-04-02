# CLAUDE.md — Vitfix.io

> **Lis ce fichier au début de chaque session.**
> Il référence toutes les ressources nécessaires pour travailler sur le projet.

---

## Projet

**Vitfix.io** — Plateforme de mise en relation entre artisans/professionnels de construction et clients (B2C + B2B).

- **Stack :** Next.js 16.2.2, TypeScript, Tailwind CSS, Supabase, Vercel
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
├── components/                 ← Composants React partagés
│   ├── client-dashboard/       ← Sections dashboard client (10 modules)
│   ├── coproprietaire-dashboard/ ← Sections dashboard copropriétaire (10 modules)
│   ├── syndic-dashboard/       ← Sections dashboard syndic (pages/, operations/, financial/, etc.)
│   ├── pro-mobile/             ← Sections dashboard mobile artisan
│   ├── dashboard/              ← Sections dashboard pro (btp/, rapports/, etc.)
│   ├── chat/                   ← Composants chat IA (AiChatBot, FixyChatGeneric)
│   └── common/                 ← Composants partagés (Providers, ConsentAnalytics, etc.)
├── lib/
│   ├── pdf/                    ← Générateurs PDF (devis-generator-v2, devis-pdf-v3, build-v2-input)
│   ├── validation.ts           ← Schemas Zod centralisés pour API routes
│   ├── logger.ts               ← Logger structuré JSON + Sentry
│   ├── types.ts                ← Types partagés (Artisan, Booking, Service, etc.)
│   └── i18n/                   ← Système i18n (FR/PT/EN)
├── supabase/
│   └── migrations/             ← Migrations SQL (RLS, FK, Storage policies)
└── public/
    └── fonts/                  ← Liberation Sans TTF (embarquée dans PDF)
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

## Conventions code

### Error handling
- Toujours utiliser `toast` (Sonner) pour feedback utilisateur sur erreurs
- `console.warn` pour les erreurs localStorage (attendues en navigation privée)
- `logger` (lib/logger.ts) côté serveur — envoie automatiquement à Sentry pour error/fatal
- Ne jamais laisser de `catch {}` vide

### PDF / Devis
- 3 code paths PDF : `handleTestPdfV2` (download), `handlePreviewPdf` (aperçu), `handleExportFacturX`
- Assurance RC Pro obligatoire — hard block sur les 3 paths (art. L243-2)
- Rétractation B2C uniquement (conditionné sur `!client.siret`)
- Font Liberation Sans embarquée pour Unicode (€, ², °)
- Numérotation devis côté serveur (API `/api/devis-number`, séquence atomique)

### API routes
- Valider les inputs avec Zod (`lib/validation.ts` ou schema inline)
- Utiliser `logger` pour les erreurs, ne pas exposer les détails internes au client
- Rate limiting sur les endpoints IA et data-heavy

### Types
- Éviter `any` — utiliser les types de `lib/types.ts` (Artisan, Booking, Service, etc.)
- `Record<string, unknown>` pour les objets dynamiques

---

*Dernière mise à jour : 2 avril 2026 — Audit sécurité complet terminé, Next.js 16.2.2, 5 Storage buckets RLS, Zod validation*
