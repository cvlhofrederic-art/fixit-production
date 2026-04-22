#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Cloudflare provisioning — vitfix.io
# Crée KV namespace (CACHE) + Queues (fixit-sync-jobs + DLQ).
# Compte cible : cvlho.frederic@gmail.com
#
# Usage :
#   wrangler login          # auth browser-based une seule fois
#   bash scripts/cf-provision.sh
#
# Ensuite : copier les IDs renvoyés dans wrangler.toml
# (remplacer REPLACE_WITH_KV_NAMESPACE_ID + REPLACE_WITH_KV_PREVIEW_ID).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BOLD=$'\033[1m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
RED=$'\033[0;31m'
RESET=$'\033[0m'

info()  { echo "${BOLD}${GREEN}▶${RESET} $*"; }
warn()  { echo "${BOLD}${YELLOW}!${RESET} $*"; }
fail()  { echo "${BOLD}${RED}✗${RESET} $*" >&2; exit 1; }

command -v npx >/dev/null 2>&1 || fail "npx introuvable (installer Node.js)"

info "Vérification auth Cloudflare…"
if ! npx --yes wrangler whoami 2>&1 | grep -q "You are logged in"; then
  fail "Pas connecté à Cloudflare. Lancer d'abord : npx wrangler login"
fi

echo
info "── 1/3 — KV namespace : CACHE (prod) ──"
npx wrangler kv namespace create CACHE
echo
info "── 2/3 — KV namespace : CACHE (preview) ──"
npx wrangler kv namespace create CACHE --preview
echo
info "── 3/3 — Queues : fixit-sync-jobs + DLQ ──"
npx wrangler queues create fixit-sync-jobs
npx wrangler queues create fixit-sync-jobs-dlq

echo
info "Provisioning terminé."
warn "ÉTAPE SUIVANTE : copier les deux IDs KV retournés ci-dessus dans wrangler.toml"
warn "  - id            ← ID du premier KV (prod)"
warn "  - preview_id    ← ID du second KV (--preview)"
echo
warn "Puis pousser les secrets : bash scripts/cf-secrets-template.sh"
