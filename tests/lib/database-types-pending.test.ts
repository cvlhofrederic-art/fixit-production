import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// TYPE-2 — Garde-fou anti-masquage du schéma généré.
//
// lib/database-types.ts (TIRET) fusionne les types générés depuis la prod
// (lib/database.types.ts, POINT) avec des définitions « pending » écrites à la
// main (PendingTables / PendingFunctions / PendingEnums) pour les objets pas
// encore créés en live. Le Merge fait PRIMER le pending : si, après
// `supabase db push` + régénération (`supabase gen types typescript --linked`),
// on oublie de vider le pending, les définitions manuelles masqueraient
// silencieusement le schéma réellement généré.
//
// Ce test ÉCHOUE dès qu'une clé pending existe aussi dans les types générés →
// il force le vidage prévu par l'en-tête de lib/database-types.ts.
//
// Choix d'implémentation : parsing runtime des deux fichiers plutôt qu'une
// assertion type-level (expectTypeOf / Extract<keyof A, keyof B>) parce que :
//   1. les assertions de type vitest ne sont vérifiées que par
//      `vitest --typecheck`, absent du pipeline `npm run test` — la garde
//      serait silencieuse dans la CI actuelle ;
//   2. PendingTables / PendingFunctions / PendingEnums sont des types internes
//      NON exportés — un test type-level imposerait de les exporter ;
//   3. le parseur s'auto-vérifie (le test échoue si les tables stables connues
//      ne sont plus retrouvées côté généré, ou si une déclaration Pending*
//      référencée n'est plus localisable) : il ne peut pas passer « à vide ».

const GENERATED_PATH = join(process.cwd(), 'lib/database.types.ts')
const MERGED_PATH = join(process.cwd(), 'lib/database-types.ts')

/** Delta d'accolades d'une ligne, littéraux de chaîne ignorés. */
function braceDelta(line: string): number {
  const stripped = line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '')
  let delta = 0
  for (const ch of stripped) {
    if (ch === '{') delta += 1
    else if (ch === '}') delta -= 1
  }
  return delta
}

/**
 * Extrait les clés de PREMIER niveau du bloc `{ ... }` dont l'accolade
 * ouvrante se trouve sur la ligne `startLine`. Les clés imbriquées (Row,
 * Insert, Args…) sont à profondeur ≥ 2 et donc ignorées ; `[_ in never]`
 * (forme « vidée ») ne matche pas le pattern identifiant.
 */
function extractBlockKeys(lines: string[], startLine: number): string[] {
  const keys: string[] = []
  let depth = 0
  for (let i = startLine; i < lines.length; i++) {
    if (i > startLine && depth === 1) {
      const m = lines[i].match(/^\s*([A-Za-z_]\w*)\s*\??:/)
      if (m) keys.push(m[1])
    }
    depth += braceDelta(lines[i])
    if (depth <= 0) break
  }
  return keys
}

/** Première ligne matchant `pattern`, ou -1. */
function findLine(lines: string[], pattern: RegExp, from = 0): number {
  for (let i = from; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i
  }
  return -1
}

/** Sections Tables / Functions / Enums du schéma `public` généré. */
function parseGeneratedSections(source: string) {
  const lines = source.split('\n')
  const publicLine = findLine(lines, /^ {2}public: \{/)
  if (publicLine === -1) {
    throw new Error('Parseur: bloc `public` introuvable dans lib/database.types.ts — format inattendu, adapter le test')
  }
  const sections: Record<'Tables' | 'Functions' | 'Enums', string[]> = {
    Tables: [],
    Functions: [],
    Enums: [],
  }
  for (const name of Object.keys(sections) as Array<keyof typeof sections>) {
    const start = findLine(lines, new RegExp(`^ {4}${name}: \\{`), publicLine)
    if (start === -1) {
      throw new Error(`Parseur: section \`${name}\` introuvable dans lib/database.types.ts — format inattendu, adapter le test`)
    }
    sections[name] = extractBlockKeys(lines, start)
  }
  return sections
}

/**
 * Clés d'une déclaration `type Pending… = { ... }` de lib/database-types.ts.
 * Déclaration absente ET identifiant non référencé → [] (pending légitimement
 * supprimé). Identifiant encore référencé mais déclaration introuvable →
 * erreur (le parseur ne doit jamais passer « à vide » par accident).
 */
function parsePendingKeys(source: string, typeName: string): string[] {
  const lines = source.split('\n')
  const declLine = findLine(lines, new RegExp(`^(export )?type ${typeName} = \\{`))
  if (declLine === -1) {
    if (new RegExp(`\\b${typeName}\\b`).test(source)) {
      throw new Error(`Parseur: \`${typeName}\` est référencé dans lib/database-types.ts mais sa déclaration n'est pas localisable — adapter le test`)
    }
    return []
  }
  return extractBlockKeys(lines, declLine)
}

describe('database-types — les définitions pending ne doivent pas masquer le schéma généré', () => {
  const generatedSource = readFileSync(GENERATED_PATH, 'utf-8')
  const mergedSource = readFileSync(MERGED_PATH, 'utf-8')
  const generated = parseGeneratedSections(generatedSource)

  it('sanity: le parseur retrouve les tables/RPC stables du schéma généré', () => {
    // Si ces assertions échouent, c'est le PARSEUR (ou le format du fichier
    // généré) qui a changé — pas un vrai overlap. Corriger le test d'abord.
    expect(generated.Tables.length).toBeGreaterThan(20)
    expect(generated.Tables).toContain('profiles_artisan')
    expect(generated.Tables).toContain('services')
    expect(generated.Tables).toContain('bookings')
    expect(generated.Functions).toContain('next_doc_number')
  })

  it.each([
    ['PendingTables', 'Tables'],
    ['PendingFunctions', 'Functions'],
    ['PendingEnums', 'Enums'],
  ] as const)('%s : aucune clé déjà présente dans les types générés (%s)', (pendingType, section) => {
    const pendingKeys = parsePendingKeys(mergedSource, pendingType)
    const generatedKeys = new Set(generated[section])
    const overlap = pendingKeys.filter((k) => generatedKeys.has(k))
    expect(
      overlap,
      `${overlap.join(', ') || '(aucun)'} existe(nt) désormais dans lib/database.types.ts (schéma régénéré). ` +
        `La définition manuelle de ${pendingType} MASQUERAIT le schéma réel : ` +
        `vider ${pendingType} dans lib/database-types.ts (cf. en-tête du fichier).`,
    ).toEqual([])
  })
})
