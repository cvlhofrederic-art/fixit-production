# Guide de contribution — Vitfix

Ce document couvre le processus de contribution au projet Vitfix, des conventions de branche jusqu'au déploiement.

---

## 1. Comment contribuer

Le workflow standard pour toute contribution :

1. Créer une branche depuis `main` (toujours à jour).
2. Développer et tester localement (`lint`, `tsc`, `test`, `build`).
3. Commiter avec un préfixe conventionnel.
4. Pousser la branche et ouvrir une Pull Request.
5. Attendre que tous les checks CI passent.
6. Obtenir une approbation en code review.
7. Merger dans `main` (squash merge recommandé).

Avant de commencer, lire `docs/DEVELOPER_ONBOARDING.md` pour l'installation locale et la configuration de l'environnement.

---

## 2. Branches

Toujours créer sa branche depuis `main` à jour :

```bash
git checkout main && git pull
git checkout -b feat/ma-feature
```

### Préfixes de branche

| Préfixe | Usage |
|---------|-------|
| `feat/` | Nouvelle fonctionnalité |
| `fix/` | Correction de bug |
| `ai/` | Modification d'un agent IA ou d'un prompt |
| `voice/` | Modification liée à la reconnaissance vocale |
| `perf/` | Amélioration de performance |
| `docs/` | Documentation uniquement |
| `chore/` | Maintenance, dépendances, CI, tooling |

### Exemples

- `feat/syndic-tarifs-page`
- `fix/devis-tva-calculation`
- `ai/fixy-multi-lot-prompt`
- `voice/stt-fallback-firefox`
- `perf/lighthouse-image-optimization`
- `docs/api-reference-update`
- `chore/upgrade-next-16`

---

## 3. Commits

Le projet utilise les **conventional commits**. Chaque commit doit avoir un préfixe suivi de deux-points et d'un espace.

### Préfixes reconnus

| Préfixe | Usage | Apparaît dans le changelog |
|---------|-------|---------------------------|
| `feat:` | Nouvelle fonctionnalité | Oui |
| `fix:` | Correction de bug | Oui |
| `ai:` | Modification agent IA / prompt | Oui |
| `voice:` | Modification reconnaissance vocale | Oui |
| `perf:` | Amélioration de performance | Oui |
| `refactor:` | Refactoring sans changement fonctionnel | Non |
| `docs:` | Documentation | Non |
| `chore:` | Maintenance, dépendances, CI | Non |

### Exemples

```bash
git commit -m "feat: ajout page tarifs syndic"
git commit -m "fix: correction calcul TVA devis PDF"
git commit -m "ai: mise à jour prompt Fixy pour devis multi-lots"
git commit -m "voice: fallback navigateur sans Web Speech API"
git commit -m "perf: lazy load images pages SEO"
git commit -m "refactor: extraction logique planning syndic"
git commit -m "docs: mise à jour référence API bookings"
git commit -m "chore: upgrade Supabase SDK v2.95"
```

Garder les messages courts (< 72 caractères), en français, à l'impératif.

---

## 4. Pull Requests

Chaque PR doit contenir les informations suivantes :

### Template

```markdown
## Description
[Résumé clair du changement et de sa motivation]

## Type de changement
- [ ] Nouvelle fonctionnalité (feat)
- [ ] Correction de bug (fix)
- [ ] Modification IA (ai)
- [ ] Modification vocale (voice)
- [ ] Performance (perf)
- [ ] Refactoring
- [ ] Documentation
- [ ] Maintenance / CI

## Checklist
- [ ] `npm run lint` passe sans erreur
- [ ] `npx tsc --noEmit` passe sans erreur
- [ ] `npm run test` passe (tous les tests unitaires)
- [ ] `npm run build` réussit
- [ ] Tests ajoutés ou mis à jour si nécessaire
- [ ] Documentation mise à jour si changement d'API ou nouvelle feature
- [ ] Aucun secret ou clé dans le code
```

Titre de la PR : utiliser le même format que les commits (`feat: ...`, `fix: ...`, etc.).

---

## 5. Checks CI obligatoires

Tous ces workflows doivent passer avant le merge :

| Workflow | Fichier | Ce qu'il vérifie |
|----------|---------|------------------|
| **Tests** | `tests.yml` | Vitest unitaires + Playwright E2E (3 navigateurs) + Axe-core WCAG |
| **Build** | `ci.yml` | Build de production Next.js |
| **Code Quality** | `code-quality.yml` | ESLint + `tsc --noEmit` + SonarCloud |
| **Security** | `security.yml` | CodeQL + TruffleHog (secrets) + Semgrep (OWASP/JWT) + Giskard (prompts IA) |
| **Lighthouse** | `lighthouse.yml` | Performance >= 80, Accessibilité >= 90, SEO >= 90, Bonnes pratiques >= 85 |
| **AI Eval** | `ai-eval.yml` | Régression des prompts IA via DeepEval (déclenché uniquement si fichiers IA modifiés) |

Si un check échoue, corriger le problème avant de demander une review. Ne pas contourner les checks.

Vérification locale complète avant de pousser :

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

---

## 6. Code review

### Qui review

Toute PR nécessite au minimum une approbation avant le merge. Le lead technique review les changements touchant :

- Les agents IA (prompts, architecture)
- La sécurité (auth, RLS, rate limiting)
- Le SEO (structure des URLs `/fr/` et `/pt/`)
- Les paiements (Stripe)

### Quoi vérifier en review

- Le code respecte les conventions TypeScript du projet (pas de `any`, validation Zod).
- Les tests couvrent le changement.
- Pas de régression sur les parcours critiques.
- Pas de secret ou de donnée sensible dans le code.
- Les composants client n'importent pas `supabaseAdmin`.
- Les URLs SEO existantes ne sont pas modifiées sans validation explicite.

### Répondre aux commentaires

Corriger les retours et pousser de nouveaux commits. Ne pas force-push sur une branche en review.

---

## 7. Tests

### Règle générale

Toute nouvelle fonctionnalité ou correction de bug doit inclure des tests. Toute modification existante doit maintenir les tests actuels au vert.

### Commandes

```bash
npm run test              # Vitest unitaires (une passe)
npm run test:watch        # Vitest en mode watch
npm run test:coverage     # Vitest avec rapport de couverture
npm run test:e2e          # Playwright E2E (Chromium en local)
npm run test:e2e:ui       # Playwright avec interface visuelle
```

### Structure

- `tests/` : tests unitaires et API (Vitest)
- `e2e/` : tests end-to-end (Playwright)

### Parcours critiques (ne jamais casser)

1. Création de devis par artisan via Fixy AI (voix ou texte)
2. Inscription artisan, vérification, accès au dashboard
3. Inscription client, recherche artisan, mise en relation
4. Commande vocale, analyse, action confirmée
5. Paiement Stripe et échéancier

En CI, Playwright tourne sur 3 navigateurs (Chromium, Firefox, WebKit) et Axe-core vérifie la conformité WCAG (niveaux wcag2a, wcag2aa, wcag21aa).

---

## 8. Style de code

### TypeScript strict

- Pas de `any`. Utiliser les types de `lib/types.ts` (Artisan, Booking, Service, etc.).
- `Record<string, unknown>` pour les objets dynamiques.
- Le check `tsc --noEmit` doit passer sans erreur.

### Validation des inputs

- Valider tous les inputs API avec Zod (`lib/validation.ts` ou schema inline).
- Ne jamais faire confiance aux données côté client.

### Gestion d'erreurs

- Côté client : `toast` (Sonner) pour le feedback utilisateur. Pas de `alert()`.
- Côté serveur : `logger` (`lib/logger.ts`) qui envoie automatiquement à Sentry pour les niveaux error/fatal.
- Jamais de `catch {}` vide. Toujours logger ou afficher l'erreur.
- `console.warn` uniquement pour les erreurs localStorage (attendues en navigation privée).

### Supabase

- `lib/supabase.ts` : client browser (respecte RLS).
- `lib/supabase-server.ts` (`supabaseAdmin`) : serveur uniquement, bypass RLS.
- Ne jamais importer `supabaseAdmin` dans un composant client.

### Imports Capacitor

Toujours dynamiques (`await import(...)`) pour éviter les crashs SSR.

---

## 9. Documentation

Mettre à jour la documentation dans ces cas :

- **Nouvelle route API** : ajouter dans `docs/api-reference.md`.
- **Nouvelle fonctionnalité** : documenter dans le README ou le fichier de contexte pertinent.
- **Changement de configuration** : mettre à jour `docs/ENVIRONMENTS.md` ou `docs/github-actions-setup.md`.
- **Nouvel agent IA** : documenter l'agent, son prompt et son instrumentation Langfuse.
- **Modification de structure d'URL** : valider avec le lead puis mettre à jour les fichiers SEO.
- **Décision technique notable** : ajouter dans `product/decisions.md`.

Régénérer la doc API si des routes ont changé :

```bash
npm run docs:api
```

---

## 10. Releases

Les releases sont entièrement automatisées via **Release Please**.

### Fonctionnement

1. Chaque commit sur `main` avec un préfixe reconnu (`feat`, `fix`, `ai`, `voice`, `perf`) est analysé par Release Please.
2. Le workflow `release.yml` crée automatiquement une PR de release avec le changelog généré.
3. Au merge de cette PR, une GitHub Release est publiée avec le bon numéro de version.

### Ce qui est interdit

- Ne pas modifier manuellement la version dans `package.json`.
- Ne pas créer de tags ou de releases GitHub manuellement.
- Ne pas modifier `.release-please-manifest.json` directement.

### Configuration

| Fichier | Rôle |
|---------|------|
| `release-please-config.json` | Sections du changelog (feat/fix/ai/voice/perf) |
| `.release-please-manifest.json` | Version actuelle du projet |
| `.github/workflows/release.yml` | Workflow GitHub Actions |

Le déploiement sur Vercel se déclenche automatiquement à chaque push sur `main`. Aucune action manuelle requise.
