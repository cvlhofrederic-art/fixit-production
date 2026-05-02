# GitHub Actions — Workflows installés (12)

## Pipeline production
- `deploy-cloudflare.yml` — **Seul pipeline de prod**. Build OpenNext + `wrangler deploy`. Cf. [project_deploy_cloudflare_only](../../memory/project_deploy_cloudflare_only.md). Plus jamais Vercel.
- `post-deploy.yml` — Smoke tests post-déploiement Cloudflare.

## Workflows bloquants (PR)
- `tests.yml` — Vitest unitaires + Playwright E2E (chromium/firefox/webkit) + Axe-core WCAG
- `ci.yml` — Build production Next.js
- `code-quality.yml` — ESLint + `tsc --noEmit` + SonarCloud
- `lighthouse.yml` — Audit perf/a11y/SEO depuis sitemap (seuils : perf 80, a11y 90, SEO 90, BP 85)
- `security.yml` — CodeQL + TruffleHog + Semgrep (OWASP + JWT) + Giskard (prompts IA)
- `ai-eval.yml` — DeepEval régression prompts (sur modif fichiers IA uniquement)

## Workflows non-bloquants
- `security-daily.yml` — Scan sécurité quotidien (CodeQL + dépendances).
- `i18n.yml` — Comparaison clés FR/PT (warning si manquantes).
- `langfuse-eval.yml` — Éval nocturne qualité IA (crée issue si qualité < 0.7).
- `release.yml` — Release Please (changelog auto, préfixes : `feat` / `fix` / `ai` / `voice` / `perf`).

## Secrets requis (GitHub > Settings > Secrets > Actions)
- **Build** : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Cloudflare** : `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- **Sentry** : `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `NEXT_PUBLIC_SENTRY_DSN`
- **SonarCloud** : `SONAR_TOKEN`
- **IA** (optionnels) : `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY`, `GISKARD_API_KEY`
- **Langfuse** : `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`
