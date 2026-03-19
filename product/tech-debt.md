# Tech Debt — Performance & Architecture

> Fichier de suivi des problèmes identifiés mais non corrigés.
> Mis à jour : 19 mars 2026

---

## CRITICAL — Refactors lourds

### 1. Syndic dashboard : 89 useState → Zustand/useReducer
- **Fichier :** `app/syndic/dashboard/page.tsx` (5 947 lignes)
- **Problème :** 89 variables useState indépendantes. Chaque setState re-render tout le composant (6000 lignes de JSX).
- **Impact :** Performance dégradée sur le dashboard syndic, surtout sur mobile.
- **Fix :** Regrouper les états par domaine (missions, immeubles, modales, formulaires) dans un Zustand store ou useReducer. Extraire les modales en composants avec état local.
- **Effort :** 2-3 jours
- **Priorité :** P1

### 2. Pro dashboard : 54 useState → custom hooks
- **Fichier :** `app/pro/dashboard/page.tsx:64-210` (2 316 lignes)
- **Problème :** 54 useState déclarés dans le composant principal.
- **Fix :** Créer des custom hooks par feature : `useMotifForm()`, `useAvailability()`, `useCalendarView()`, `useMessaging()`. Déplacer les états modales dans les composants modaux.
- **Effort :** 1-2 jours
- **Priorité :** P1

### 3. Migration fetch → useFetch/SWR (~50 endroits)
- **Fichiers :** Tous les dashboards (pro, syndic, client, coproprietaire)
- **Problème :** `useEffect(() => { fetch('/api/...').then(...) })` sans cache, sans déduplication, sans retry.
- **Fix :** Remplacer par `const { data } = useFetch<T>('/api/...')` (helper créé dans `lib/use-fetch.ts`). SWR installé (v2.4.1).
- **Pattern avant/après :**
  ```tsx
  // Avant
  const [data, setData] = useState(null)
  useEffect(() => { fetch(`/api/x?id=${id}`).then(r => r.json()).then(setData) }, [id])

  // Après
  import { useFetch } from '@/lib/use-fetch'
  const { data, isLoading } = useFetch(`/api/x?id=${id}`)
  ```
- **Effort :** 3-4h (mécanique, faible risque)
- **Priorité :** P2

---

## HIGH — Améliorations architecture

### 4. Pro mobile monolithique
- **Fichier :** `app/pro/mobile/page.tsx` (3 046 lignes)
- **Problème :** GPS tracking, Proof of Work, compliance wallet, interventions — tout dans un seul composant.
- **Fix :** Extraire `ProofOfWorkTab`, `ComplianceWalletTab`, `AgendaTab` en composants séparés avec état local.
- **Effort :** 1 jour
- **Priorité :** P2

### 5. Client dashboard monolithique
- **Fichier :** `app/client/dashboard/page.tsx` (2 979 lignes)
- **Problème :** Bookings, ratings, tracking, messaging — tout inline.
- **Fix :** Même pattern que pro dashboard — extraire par feature.
- **Effort :** 1 jour
- **Priorité :** P2

### 6. Coproprietaire dashboard monolithique
- **Fichier :** `app/coproprietaire/dashboard/page.tsx` (4 129 lignes)
- **Problème :** 8+ onglets gérés inline sans extraction.
- **Fix :** Extraire chaque onglet en composant séparé.
- **Effort :** 1-2 jours
- **Priorité :** P2

---

## MEDIUM — SEO restant

### 7. Hreflang pages dynamiques PT↔FR
- **Fichiers :** `app/pt/servicos/[slug]/page.tsx`, `app/pt/urgencia/[slug]/page.tsx`
- **Problème :** Hreflang partiel (PT + x-default, mais pas FR). Le mapping slug PT→FR est complexe (slugs différents entre marchés).
- **Fix :** Créer un mapping table dans seo-pages-data.ts ou ajouter un champ `frSlug` aux données.
- **Effort :** 2-3h
- **Priorité :** P3

### 8. BreadcrumbList manquant sur 10 pages FR
- **Pages :** tarifs, marches/gerer, marches/publier, cgu, mentions-legales, a-propos, + 4 legacy Porto pages
- **Fix :** Ajouter `BreadcrumbList` JSON-LD dans les metadata de chaque page.
- **Effort :** 1h
- **Priorité :** P3

### 9. FAQPage manquant sur cidade/[slug] et precos/ (PT)
- **Fix :** Ajouter FAQPage schema avec questions pertinentes par ville/service.
- **Effort :** 1h
- **Priorité :** P3

---

## LOW — Nice to have

### 10. Naming conventions (FR dans le code TS)
- **Problème :** 673+ propriétés d'interface en français (nom, prenom, adresse, nbLots...) car elles reflètent la DB Supabase.
- **Fix :** Créer un mapping layer ou renommer en DB. Très risqué (673+ refs).
- **Effort :** 3-5 jours
- **Priorité :** P4 (tech debt accepté)

### 11. Sitemap hreflang annotations
- **Problème :** Next.js sitemap API ne supporte pas nativement xhtml:link pour hreflang dans sitemap.xml.
- **Fix :** Custom sitemap route qui génère XML avec hreflang.
- **Effort :** 2-3h
- **Priorité :** P4

### 12. 5 font families → 2-3
- **Problème :** 5 Google Fonts chargées (DM Sans, Syne, Montserrat, Outfit, Playfair Display). Impact mineur car next/font self-host.
- **Fix :** Réduire à 2-3 familles, charger les autres lazily.
- **Effort :** 1h
- **Priorité :** P4
