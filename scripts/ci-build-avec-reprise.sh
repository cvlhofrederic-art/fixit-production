#!/usr/bin/env bash
# Build de production pour la CI, avec reprise CIBLÉE sur l'échec de téléchargement des polices Google.
#
# next/font/google télécharge les fichiers de police (fonts.gstatic.com) à chaque build. Quand ce téléchargement
# échoue, Turbopack s'arrête sur des dizaines d'erreurs « Can't resolve
# '@vercel/turbopack-next/internal/font/google/font' », sans rapport avec le code. Seul ce cas est relancé ;
# toute autre erreur de build fait échouer l'étape immédiatement.
#
# Solution d'attente : la correction de fond (polices auto-hébergées) est à valider avec Frédéric.
set -uo pipefail

TENTATIVES="${TENTATIVES_BUILD:-3}"
PAUSE_SECONDES="${PAUSE_BUILD_SECONDES:-30}"
JOURNAL="$(mktemp)"
trap 'rm -f "$JOURNAL"' EXIT

for tentative in $(seq 1 "$TENTATIVES"); do
  if npm run build 2>&1 | tee "$JOURNAL"; then
    exit 0
  fi
  if ! grep -q "internal/font/google/font" "$JOURNAL"; then
    echo "::error::Build de production en échec (cause autre que le téléchargement des polices Google)."
    exit 1
  fi
  if [ "$tentative" -lt "$TENTATIVES" ]; then
    echo "::warning::Polices Google non téléchargées (tentative ${tentative}/${TENTATIVES}) : nouvelle tentative dans ${PAUSE_SECONDES} s."
    sleep "$PAUSE_SECONDES"
  fi
done

echo "::error::Polices Google toujours injoignables après ${TENTATIVES} tentatives."
exit 1
