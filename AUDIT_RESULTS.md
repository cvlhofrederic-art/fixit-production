# AUDIT COMPLET VITFIX PRO — Rapport Final

> Date : 24 mars 2026
> Audité par : Claude Code (Opus 4.6)
> Projet : Vitfix.io — fixit-production

---

## 1. SCORE GLOBAL : 62/100

| Catégorie | Score | Détail |
|-----------|-------|--------|
| **Sécurité** | **18/25** | RLS solide, headers OK, mais 82 routes sans validation Zod, dépendances vulnérables (jsPDF critical) |
| **Architecture** | **13/20** | Patterns incohérents, 300+ `any`, fichiers monolithiques (5 952 lignes max), duplications |
| **Conformité légale BTP** | **13/20** | 13 mentions présentes, MAIS : RC Pro "N/A" autorisé, numérotation localStorage, rétractation non conditionnelle |
| **Performance** | **12/15** | Dynamic imports corrects, fonts optimisées, mais 57% pages sans metadata, ~20% images non optimisées |
| **UX/Accessibilité** | **3/10** | 146 catches silencieux, 50+ ops sans loading, 1 934 boutons sans aria-label |
| **Données/Supabase** | **6/10** | Index corrects, RLS tables OK, mais Storage sans RLS, FK manquantes, migrations mal numérotées |

---

## 2. CARTOGRAPHIE

| Métrique | Valeur |
|----------|--------|
| Fichiers source | 865 |
| Pages (page.tsx) | 97 |
| API Routes | 100 |
| Server Actions | 0 (tout via API routes) |
| Composants | 149 |
| Tables Supabase | 57 |
| Migrations SQL | 29 |
| Storage Buckets | 3 |

---

## 3. LES 5 CORRECTIONS CRITIQUES (à faire en premier)

### CRITIQUE 1 — Mettre à jour jsPDF (vulnérabilité critical)

| | |
|-|-|
| **Module** | Dépendances |
| **Problème** | jsPDF ≤4.2.0 : PDF Object Injection + HTML Injection (GHSA-7x6v-j9x4-qf24, GHSA-wfv2-pwc8-crg5) |
| **Fix** | `npm audit fix` ou mettre à jour jsPDF vers version patchée |
| **Effort** | 15 min |

### CRITIQUE 2 — Mettre à jour Next.js (CSRF bypass + DoS)

| | |
|-|-|
| **Module** | Dépendances |
| **Problème** | Next.js 16.0-16.1.6 : null origin CSRF bypass (GHSA-mq59), HTTP smuggling, image cache DoS |
| **Fix** | `npm install next@16.2.1` |
| **Effort** | 30 min (test de non-régression) |

### CRITIQUE 3 — Bloquer la génération PDF si RC Pro manquante

| | |
|-|-|
| **Module** | Devis/Facturation |
| **Problème** | `lib/pdf/devis-generator-v2.ts` ligne 694 : affiche "RC Pro N/A" si champs vides. Illégal (art. L243-2 C. assurances) |
| **Fix** | Ajouter validation bloquante dans `components/DevisFactureForm.tsx` : si `insurance_name` ET `insurance_number` vides → bloquer le bouton "Générer PDF" |
| **Effort** | 30 min |

### CRITIQUE 4 — Numérotation devis/factures côté serveur

| | |
|-|-|
| **Module** | Devis/Facturation |
| **Problème** | Numéros basés sur `localStorage` uniquement (lignes 521-538 DevisFactureForm). Pas de garantie séquentielle, duplicats possibles multi-device. Viole art. L441-3 C. com. |
| **Fix** | API route `/api/devis-number` avec séquence DB atomique (`SELECT MAX(seq) + 1 ... FOR UPDATE`) par artisan/année. Table `devis_sequences(artisan_id, year, last_seq)` |
| **Effort** | 2h |

### CRITIQUE 5 — Ajouter RLS sur les Storage buckets

| | |
|-|-|
| **Module** | Supabase/Données |
| **Problème** | Aucune policy RLS sur les 3 buckets Storage. Si un signed URL fuite ou expire mal, accès non autorisé possible |
| **Fix** | Migration SQL avec policies sur `storage.objects` pour `artisan-documents` (owner-only), `artisan-photos` (artisan+client du booking), `profile-photos` (owner write, public read actifs) |
| **Effort** | 1h |

---

## 4. LES 10 CORRECTIONS IMPORTANTES

| # | Priorité | Module | Problème | Fix | Effort |
|---|----------|--------|----------|-----|--------|
| 1 | P1 | UX | 146 catches silencieux — erreurs invisibles pour l'utilisateur | Implémenter un toast global (react-hot-toast ou sonner). Remplacer `catch {}` par `catch { toast.error(...) }` | 4h |
| 2 | P1 | UX | 50+ opérations async sans loading state | Ajouter `useState(false)` + disabled button sur chaque action async dans les 8 fichiers principaux | 3h |
| 3 | P1 | Sécurité | 82/99 API routes sans validation Zod | Étendre `lib/validation.ts` avec schemas pour les routes financières, admin, et upload en priorité | 6h |
| 4 | P2 | Architecture | 300+ `any` TypeScript | Créer interfaces pour les 6 fichiers les plus touchés (syndic dashboard 32, pro dashboard 26, API IA 18) | 4h |
| 5 | P2 | Devis | Droit de rétractation généré même en B2B | Conditionner page 2 du PDF à `!input.client.siret` (hors établissement uniquement) | 30 min |
| 6 | P2 | Devis | Acomptes : warning seulement si ≠ 100% | Bloquer la génération PDF si sum(acomptes) ≠ 100% | 30 min |
| 7 | P2 | Devis | Pas de police TTF embarquée dans le PDF | Embarquer Liberation Sans via `pdf.addFont()` pour support Unicode complet (€, °, ², accents) | 1h |
| 8 | P2 | Supabase | 3 FK manquantes (syndic_signalements.cabinet_id, syndic_missions.cabinet_id, marches_candidatures.artisan_id) | Migration SQL `ALTER TABLE ... ADD CONSTRAINT ... REFERENCES ... ON DELETE CASCADE` | 30 min |
| 9 | P2 | Architecture | Fichiers monolithiques (syndic 5 952 lignes, copro 4 129, pro 3 208) | Extraire les sections en composants dans components/dashboard/ et components/syndic-dashboard/ | 8h |
| 10 | P2 | Sécurité | Cookies sans flags Secure/HttpOnly explicites | Ajouter `secure: true, httpOnly: true` dans middleware.ts pour tous les cookies | 15 min |

---

## 5. AMÉLIORATIONS NICE-TO-HAVE

| Module | Amélioration | Effort |
|--------|-------------|--------|
| Performance | Remplacer 20% d'`<img>` restantes par `next/image` (syndic logo, marketplace, receipt scanner) | 2h |
| SEO | Ajouter metadata aux 56 pages qui n'en ont pas (dashboards, pages [slug], legal) | 3h |
| Accessibilité | Ajouter aria-label aux boutons icon-only (1 934+ boutons) | 4h |
| Accessibilité | Ajouter `<label>` aux 8+ inputs de formulaire sans label | 1h |
| UX | Validation en temps réel des formulaires (debounce sur champs) | 3h |
| UX | Afficher les règles de mot de passe pendant la saisie (pas seulement après submit) | 1h |
| Architecture | Extraire le pattern token refresh (7+ fichiers) dans `lib/auth-helpers.ts` | 1h |
| Architecture | Extraire le pattern fetch+Bearer (6+ fichiers) dans un helper unifié | 1h |
| Supabase | Renommer les migrations pour numérotation stricte (fix double 013, nommer les hotfixes) | 30 min |
| Supabase | Ajouter auto-reconnexion Realtime après MAX_CHANNEL_ERRORS (exponential backoff) | 2h |
| Navigation | Corriger lien cassé `/auth/signup` → `/auth/register` dans simulateur/page.tsx | 5 min |
| Sécurité | Documenter le endpoint `exec_sql` RPC comme admin-only, auditer les permissions | 30 min |

---

## 6. PLAN D'ACTION SUR 2 SEMAINES

### Semaine 1 : Corrections critiques + P1

| Jour | Tâche | Effort |
|------|-------|--------|
| Lun | CRITIQUE 1 + 2 : Mettre à jour jsPDF et Next.js, tester non-régression | 1h |
| Lun | CRITIQUE 3 : Bloquer PDF sans RC Pro | 30 min |
| Mar | CRITIQUE 4 : Numérotation devis côté serveur (API + migration + intégration form) | 3h |
| Mar | CRITIQUE 5 : Storage RLS policies (migration SQL) | 1h |
| Mer | P1 #1 : Toast global + remplacement des 146 catches silencieux | 4h |
| Jeu | P1 #2 : Loading states sur les 50+ opérations async | 3h |
| Ven | P1 #3 : Validation Zod sur les 20 routes les plus critiques (financières, admin, upload) | 4h |

### Semaine 2 : Corrections P2 + qualité

| Jour | Tâche | Effort |
|------|-------|--------|
| Lun | P2 #5-6 : Rétractation conditionnelle + acomptes bloquants | 1h |
| Lun | P2 #7 : Font TTF embarquée dans devis PDF | 1h |
| Lun | P2 #8 : FK manquantes (migration SQL) | 30 min |
| Lun | P2 #10 : Flags Secure/HttpOnly sur cookies | 15 min |
| Mar | P2 #4 : Remplacer les 300+ `any` par des interfaces (top 6 fichiers) | 4h |
| Mer-Jeu | P2 #9 : Découpage fichiers monolithiques (syndic → composants, copro → composants) | 8h |
| Ven | Nice-to-have : Metadata SEO, aria-labels, lien cassé, migrations renommées | 4h |

---

## 7. DÉTAIL PAR MODULE

### Sécurité (18/25)

**Forces :**
- RLS complet sur 28+ tables avec policies contextuelles
- Headers sécurité complets (HSTS, CSP, X-Frame-Options DENY)
- CSRF via validation Origin dans middleware
- Rate limiting Redis + fallback in-memory
- Aucun secret exposé côté client
- Validation magic bytes sur les uploads
- sanitizeHtml() avec suppression scripts/handlers

**Faiblesses :**
- 82/99 API routes sans validation Zod (dont routes financières)
- jsPDF vulnérable (critical) + Next.js vulnérable (moderate)
- Cookies sans Secure/HttpOnly
- `exec_sql` RPC admin non documenté

### Architecture (13/20)

**Forces :**
- 3 clients Supabase distincts correctement utilisés
- 20+ sections code-split via next/dynamic dans pro/dashboard
- lib/validation.ts centralisé (452 lignes)
- auth-helpers.ts avec cache cabinet_id

**Faiblesses :**
- 300+ TypeScript `any`
- Fichiers monolithiques (syndic 5 952, copro 4 129, pro 3 208 lignes)
- 3 patterns d'erreur différents (try/catch+alert, {error} check, silencieux)
- Token refresh dupliqué dans 7+ fichiers
- localStorage comme pseudo-DB (absences, documents, drafts)

### Conformité légale BTP (13/20)

**Forces :**
- 13 mentions obligatoires présentes dans le PDF
- Pénalités de retard non-supprimables (hardcoded)
- Médiateur consommation mentionné
- 3 niveaux de prestation distincts (titre/description/étapes)
- 7 couleurs conformes à la spec

**Faiblesses :**
- RC Pro "N/A" autorisé (illégal)
- Numérotation localStorage (pas séquentielle garantie, viole art. L441-3)
- Droit de rétractation inclus même en B2B
- Acomptes ≠ 100% non bloquant
- Pas de police TTF embarquée

### Performance (12/15)

**Forces :**
- Imports dynamiques sur toutes les librairies lourdes
- next/font/google pour les 7 fonts
- Pas de N+1 queries
- Sélection de colonnes appropriée
- pro/dashboard utilise next/dynamic extensivement

**Faiblesses :**
- 56/97 pages sans metadata (57.7%)
- ~20% d'images via `<img>` au lieu de next/image

### UX/Accessibilité (3/10)

**Forces :**
- Mobile responsive solide (Tailwind responsive prefixes)
- 0 images sans alt text
- LocaleLink pour navigation i18n

**Faiblesses :**
- 146 catches silencieux
- 50+ opérations sans loading state
- 1 934+ boutons sans aria-label
- 8+ inputs sans label
- Validation formulaires après submit uniquement
- 1 lien cassé

### Données/Supabase (6/10)

**Forces :**
- Index complets (composite, partial, GIN)
- RLS tables complètes (28+)
- Soft deletes + deleted_at filters dans RLS
- Portugal fiscal compliance (hash chains, ATCUD)
- Referral anti-fraud (IP tracking, risk log)

**Faiblesses :**
- Storage buckets sans RLS (0 policies)
- 3 FK manquantes
- Migrations mal numérotées (double 013, mix nommé/numéroté)
- Realtime sans auto-reconnexion après erreurs

---

*Fin du rapport d'audit — 24 mars 2026*
