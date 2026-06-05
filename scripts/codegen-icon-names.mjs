#!/usr/bin/env node
// Génère lib/syndic/icon-names.ts (union type IconName + array ICON_NAMES) à
// partir des clés de l'objet ICON_PATHS dans
// components/syndic-dashboard/v54/primitives/icon/registry.tsx.
//
// Source de vérité : le registre. Ce script garde le type IconName exhaustif
// et synchronisé (pre-commit Husky le re-run si registry.tsx change).
//
// Parse via le TS compiler API natif (typescript déjà dep, zéro ajout).
//
// Usage : node scripts/codegen-icon-names.mjs [--check]
//   --check : ne réécrit pas, exit 1 si le fichier généré est obsolète (CI).

import ts from 'typescript'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REGISTRY = join(__dirname, '../components/syndic-dashboard/v54/primitives/icon/registry.tsx')
const OUTPUT = join(__dirname, '../lib/syndic/icon-names.ts')
const checkOnly = process.argv.includes('--check')

const source = readFileSync(REGISTRY, 'utf8')
const sf = ts.createSourceFile('registry.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

/** @type {string[]} */
const names = []

function unwrap(expr) {
  // ICON_PATHS = { ... } satisfies Record<...>  /  as Record<...>
  while (expr && (ts.isSatisfiesExpression?.(expr) || ts.isAsExpression(expr) || ts.isParenthesizedExpression(expr))) {
    expr = expr.expression
  }
  return expr
}

function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(sf) === 'ICON_PATHS' && node.initializer) {
    const obj = unwrap(node.initializer)
    if (obj && ts.isObjectLiteralExpression(obj)) {
      for (const prop of obj.properties) {
        if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
          const name = prop.name
          if (name && ts.isIdentifier(name)) names.push(name.text)
          else if (name && ts.isStringLiteral(name)) names.push(name.text)
        }
      }
    }
  }
  ts.forEachChild(node, visit)
}
visit(sf)

if (names.length === 0) {
  console.error('[codegen-icon-names] ERROR: aucune clé extraite de ICON_PATHS — registry.tsx malformé ?')
  process.exit(2)
}

// Dédup + stable order (ordre d'apparition dans le registre)
const seen = new Set()
const ordered = names.filter((n) => (seen.has(n) ? false : seen.add(n)))

const generated = `// GÉNÉRÉ — ne pas éditer à la main.
// Source : components/syndic-dashboard/v54/primitives/icon/registry.tsx
// Régénérer : node scripts/codegen-icon-names.mjs (pre-commit Husky automatique)
//
// ${ordered.length} icônes. Toute faute de frappe sur <Icon name="..."/> est
// rejetée au compile-time grâce au type IconName ci-dessous.

export const ICON_NAMES = [
${ordered.map((n) => `  ${JSON.stringify(n)},`).join('\n')}
] as const

export type IconName = (typeof ICON_NAMES)[number]
`

if (checkOnly) {
  const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf8') : ''
  if (current !== generated) {
    console.error('[codegen-icon-names] OBSOLÈTE : lib/syndic/icon-names.ts ne correspond pas au registre. Lance `node scripts/codegen-icon-names.mjs`.')
    process.exit(1)
  }
  console.error(`[codegen-icon-names] OK — ${ordered.length} icônes, à jour.`)
  process.exit(0)
}

writeFileSync(OUTPUT, generated, 'utf8')
console.error(`[codegen-icon-names] écrit ${OUTPUT} — ${ordered.length} icônes.`)
