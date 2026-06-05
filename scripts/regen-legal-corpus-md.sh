#!/usr/bin/env bash
# Regenere lib/syndic/legal-corpus-pt-md.ts a partir de scripts/data/regime-juridico-condominio-portugal-2026.md
# Usage : bash scripts/regen-legal-corpus-md.sh
# Sortie : lib/syndic/legal-corpus-pt-md.ts (ecrase l'existant)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$REPO_ROOT/scripts/data/regime-juridico-condominio-portugal-2026.md"
DST="$REPO_ROOT/lib/syndic/legal-corpus-pt-md.ts"

[ -f "$SRC" ] || { echo "MD source absent: $SRC" >&2; exit 1; }

B64="$(base64 -i "$SRC" | tr -d '\n')"

cat > "$DST" <<EOF
// lib/syndic/legal-corpus-pt-md.ts
// AUTO-GENERATED — do not edit by hand. To regenerate, see scripts/regen-legal-corpus-md.sh
// Source : scripts/data/regime-juridico-condominio-portugal-2026.md

/* eslint-disable */
export const corpusMdB64 = '$B64'

export function decodeCorpusMd(): string {
  const binary = typeof atob === 'function'
    ? atob(corpusMdB64)
    : Buffer.from(corpusMdB64, 'base64').toString('binary')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}
EOF

LINES=$(wc -l < "$SRC")
BYTES=$(wc -c < "$SRC")
echo "Regenerated: $DST"
echo "Source: $SRC ($LINES lignes, $BYTES bytes)"
echo "Base64 length: ${#B64} chars"
