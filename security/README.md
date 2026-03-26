# Security Scanning — Vitfix.io

## Outils

| Outil | Type | Cible | Config |
|-------|------|-------|--------|
| Semgrep | SAST (code) | TypeScript/JS | `.semgrep.yml` |
| Gitleaks | Secrets | Git history + files | `.gitleaks.toml` |
| Trivy | Dépendances | node_modules | `.trivyignore` |
| Nuclei | DAST (web) | https://vitfix.io | `nuclei-config.yml` |
| Lighthouse | Perf/SEO/A11y | URLs sitemap | `lighthouserc.js` (racine) |

## Scripts locaux

```bash
npm run scan:secrets   # Gitleaks — détection de secrets
npm run scan:deps      # Trivy — vulnérabilités dépendances
npm run scan:code      # Semgrep — analyse statique custom
npm run scan:web       # Nuclei — scan DAST production
npm run scan:all       # Secrets + deps + code
```

Les résultats sont dans `security/outputs/` (gitignored).

## CI/CD

- **Push/PR** : `security.yml` — CodeQL + TruffleHog + Semgrep + Giskard + Trivy + Gitleaks
- **Quotidien 4h17 FR** : `security-daily.yml` — Trivy + Gitleaks + Nuclei + Semgrep complet
- Le cron crée une Issue GitHub si des problèmes sont trouvés.

## Faux positifs

- **Semgrep** : `// nosemgrep: rule-id` inline
- **Gitleaks** : ajouter path/regex dans `.gitleaks.toml` allowlist
- **Trivy** : ajouter CVE dans `.trivyignore`

## Installation locale (optionnel)

```bash
brew install semgrep gitleaks trivy nuclei
```

Ou via npx/docker (les workflows CI utilisent les GitHub Actions officielles).
