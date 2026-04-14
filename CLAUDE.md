# CLAUDE.md — Vitfix.io

## Projet
**Vitfix.io** — Plateforme mise en relation artisans/clients (B2C + B2B).
Stack : Next.js 16.2.2, TypeScript, Tailwind CSS, Supabase, Vercel.
Production : https://vitfix.io | Provisoire : https://fixit-production.vercel.app

## Marchés
- **FR** (`fr`) : Marseille/PACA, 20 services x 19 villes — `lib/fr-seo-pages-data.ts`
- **PT** (`pt`) : Porto/Tamega e Sousa, 14 services x 12 villes — `lib/seo-pages-data.ts`
- **EN** (`en`) : Porto expats — `lib/en-services-data.ts`

## SEO
- Verifier l'existant avant de creer (jamais de duplicata)
- Schema : `HomeAndConstructionBusiness` + `AggregateRating` + `BreadcrumbList` + `FAQPage`
- PT : `EmergencyService` en plus pour urgences
- Title 50-60 chars, Description 150-160 chars, H1 unique, canonical vers vitfix.io
- **PT** : Portugais europeen uniquement (canalizador, telemovel, obras de renovacao)
- Contexte complet SEO PT : `seo-portugal/CLAUDEmemory.md`

## Code conventions
- Erreurs : `toast` (Sonner) client, `logger` (lib/logger.ts) serveur, jamais de `catch {}` vide
- PDF : 3 paths (download/apercu/FacturX), RC Pro obligatoire, Liberation Sans pour Unicode
- API : Zod validation (`lib/validation.ts`), rate limiting endpoints IA, pas de details internes au client
- Types dans `lib/types.ts`, eviter `any`, `Record<string, unknown>` pour objets dynamiques

## Contexte par domaine (lire a la demande)
- SEO PT : `seo-portugal/CLAUDEmemory.md`, `seo-portugal/CLAUDE.md`
- Produto : `product/roadmap.md`, `product/bugs.md`, `product/decisions.md`
- Marketing : `marketing/CLAUDE.md`, `marketing/ads/`
- Clients : `clients/onboarding/`, `clients/faq-responses/faq-completo.md`
- Business : `business/competitors.md`, `business/growth-ideas.md`
