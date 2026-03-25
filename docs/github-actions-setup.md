# Vitfix — GitHub Actions Setup

## Workflows installés

| Nom | Fichier | Déclencheur | Bloquant ? |
|-----|---------|-------------|------------|
| Sécurité — Analyse & Secrets | `security.yml` | push main, PR, lundi 6h | Oui |
| Qualité de code | `code-quality.yml` | PR | Oui |
| Tests — Unitaires, E2E & Accessibilité | `tests.yml` | push main, PR | Oui |
| CI — Build | `ci.yml` | push main, PR | Oui |
| Performance & SEO — Lighthouse | `lighthouse.yml` | PR | Oui |
| IA — Évaluation des prompts | `ai-eval.yml` | PR (fichiers IA) | Oui (sécurité) |
| Internationalisation — FR/PT | `i18n.yml` | PR | Non (warning) |
| IA — Évaluation nocturne Langfuse | `langfuse-eval.yml` | 2h UTC quotidien | Non (crée issue) |
| Release — Changelog & Versions | `release.yml` | push main | Non |

## Secrets GitHub à configurer

GitHub > Settings > Secrets and variables > Actions

### Priorité 1 — Build CI (bloquant)

| Secret | Service | Où le trouver |
|--------|---------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Dashboard > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Dashboard > Settings > API |

### Priorité 2 — Sentry (source maps)

| Secret | Service | Où le trouver |
|--------|---------|---------------|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry | Project Settings > Client Keys (DSN) |
| `SENTRY_AUTH_TOKEN` | Sentry | Settings > Auth Tokens (scopes: project:releases, org:read) |
| `SENTRY_ORG` | Sentry | Organization Settings > slug |
| `SENTRY_PROJECT` | Sentry | Project Settings > slug |

### Priorité 3 — Qualité de code

| Secret | Service | Où le trouver |
|--------|---------|---------------|
| `SONAR_TOKEN` | SonarCloud | sonarcloud.io > Account > Security |

### Priorité 4 — Observabilité IA

| Secret | Service | Où le trouver |
|--------|---------|---------------|
| `LANGFUSE_PUBLIC_KEY` | Langfuse | cloud.langfuse.com > Settings > API Keys |
| `LANGFUSE_SECRET_KEY` | Langfuse | cloud.langfuse.com > Settings > API Keys |
| `LANGFUSE_HOST` | Langfuse | `https://cloud.langfuse.com` (ou self-hosted) |

### Priorité 5 — Évaluation IA (optionnel)

| Secret | Service | Où le trouver |
|--------|---------|---------------|
| `OPENAI_API_KEY` | OpenAI | platform.openai.com > API Keys |
| `ANTHROPIC_API_KEY` | Anthropic | console.anthropic.com > API Keys |
| `GISKARD_API_KEY` | Giskard | app.giskard.ai > Settings |

## Services externes à créer (dans cet ordre)

1. **Supabase** — déjà configuré (copier les clés dans GitHub Secrets)
2. **Sentry** — sentry.io > nouveau projet Next.js
3. **SonarCloud** — sonarcloud.io > connecter le repo GitHub
4. **Langfuse** — cloud.langfuse.com > créer un projet
5. **Giskard** — app.giskard.ai > créer un projet (optionnel)

## Ce qui se passe au premier push

- Workflows sans secrets configurés : **warning + continuent** (pas de blocage)
- `ci.yml` et `tests.yml` : passent si Supabase secrets OK
- `ai-eval.yml` : poste un commentaire expliquant que les clés manquent
- `langfuse-eval.yml` : skip silencieusement si clés absentes
- `security.yml` : CodeQL/TruffleHog/Semgrep passent sans secrets

Configurer les secrets progressivement dans l'ordre de priorité ci-dessus.

## Tester les workflows localement

```bash
# Installer act (simulateur GitHub Actions local)
brew install act

# Tester le build
act push -W .github/workflows/ci.yml

# Tester les tests
act push -W .github/workflows/tests.yml

# Tester la sécurité
act push -W .github/workflows/security.yml

# Tester la qualité (simule une PR)
act pull_request -W .github/workflows/code-quality.yml

# Avec des secrets
echo "SONAR_TOKEN=xxx" > .secrets
act pull_request -W .github/workflows/code-quality.yml --secret-file .secrets
```

Limitations de `act` : CodeQL ne fonctionne pas en local, les commentaires PR non plus.

## Fichiers de configuration associés

| Fichier | Rôle |
|---------|------|
| `lighthouserc.js` | Config Lighthouse CI (URLs depuis sitemap, seuils, 3 runs) |
| `release-please-config.json` | Sections changelog (feat/fix/ai/voice/perf) |
| `.release-please-manifest.json` | Version actuelle (0.1.0) |
| `.github/dependabot.yml` | Mises à jour npm hebdo + Actions mensuel + groupe IA |
| `lib/langfuse.ts` | SDK Langfuse pour instrumenter les agents IA |
| `.claude/rules/` | Règles Claude Code (github-actions, ai-agents, testing) |
