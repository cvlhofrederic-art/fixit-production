#!/bin/bash
# =============================================================================
# check-mobile-compat.sh
# =============================================================================
# Scan `app/pro/mobile/` + composants `components/pro-mobile/` pour interdire
# les patterns SSR-only qui cassent silencieusement en build statique
# (output: 'export' utilisé par build-mobile.sh pour packager Capacitor).
#
# Interdits :
#   1. Imports de `next/headers` (cookies, headers) — Node.js only
#   2. Directive `'use server'` (Server Actions) — non supporté en export
#   3. fetch('/api/…') relatif — l'export statique n'inclut pas les routes API,
#      le runtime Capacitor (capacitor://localhost) ne peut pas les résoudre.
#      Utiliser ${API_BASE} ou une URL absolue.
#
# Exit code :
#   0 : aucune violation
#   1 : au moins une violation détectée
# =============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGETS=(
  "$PROJECT_ROOT/app/pro/mobile"
  "$PROJECT_ROOT/components/pro-mobile"
)

# Filtrer les cibles existantes (components/pro-mobile peut ne pas exister)
EXISTING=()
for dir in "${TARGETS[@]}"; do
  if [[ -d "$dir" ]]; then
    EXISTING+=("$dir")
  fi
done

if [[ ${#EXISTING[@]} -eq 0 ]]; then
  echo "[check-mobile-compat] No mobile directories to scan, skipping."
  exit 0
fi

echo "[check-mobile-compat] Scanning ${EXISTING[*]} ..."

violations=0

# 1. Imports next/headers (cookies, headers)
hits=$(grep -rnE "from ['\"]next/headers['\"]" "${EXISTING[@]}" --include="*.ts" --include="*.tsx" 2>/dev/null || true)
if [[ -n "$hits" ]]; then
  echo ""
  echo "❌ Imports de 'next/headers' (cookies/headers) — interdits en export statique :"
  echo "$hits"
  violations=$((violations + 1))
fi

# 2. Directive 'use server'
hits=$(grep -rnE "^['\"]use server['\"]" "${EXISTING[@]}" --include="*.ts" --include="*.tsx" 2>/dev/null || true)
if [[ -n "$hits" ]]; then
  echo ""
  echo "❌ Directive 'use server' (Server Actions) — non supporté en export statique :"
  echo "$hits"
  violations=$((violations + 1))
fi

# 3. fetch en path relatif vers /api/
hits=$(grep -rnE "fetch\(['\"\\\`]/api/" "${EXISTING[@]}" --include="*.ts" --include="*.tsx" 2>/dev/null || true)
if [[ -n "$hits" ]]; then
  echo ""
  echo "❌ fetch('/api/…') relatif — l'export statique n'inclut pas les routes API."
  echo "   Utiliser une URL absolue ou \${API_BASE} (process.env.NEXT_PUBLIC_API_URL) :"
  echo "$hits"
  violations=$((violations + 1))
fi

if [[ $violations -gt 0 ]]; then
  echo ""
  echo "[check-mobile-compat] ❌ $violations violation(s) détectée(s). Build mobile bloqué."
  exit 1
fi

echo "[check-mobile-compat] ✅ Aucune violation détectée."
exit 0
