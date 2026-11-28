#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# Vitfix Pro — mise à jour des projets natifs Android et iOS (Capacitor)
# L'appli affiche l'espace mobile du site (server.url de capacitor.config.ts) : plus d'export Next.js. Seule la page
# locale « hors connexion » (mobile/www) est copiée dans les projets natifs, avec la configuration et les plugins.
# Usage : bash scripts/build-mobile.sh [ios|android|both]
# APK de test sans Android Studio : workflow GitHub « App Android — APK de test » (voir MOBILE_GUIDE.md).
# ─────────────────────────────────────────────────────────────────

set -euo pipefail

PLATFORM="${1:-both}"

case "$PLATFORM" in
  ios|android) npx cap sync "$PLATFORM" ;;
  both) npx cap sync ;;
  *)
    echo "Usage : bash scripts/build-mobile.sh [ios|android|both]" >&2
    exit 2
    ;;
esac

echo ""
echo "Projets natifs à jour ($PLATFORM)."
echo "Suite : npm run mobile:open:android (Android Studio) ou npm run mobile:open:ios (Xcode, sur Mac)."
echo "Signature et publication sur les stores : MOBILE_GUIDE.md."
