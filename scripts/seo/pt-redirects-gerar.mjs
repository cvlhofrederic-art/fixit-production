// Génère data/seo/pt-redirects.csv (phase 2 du plan SEO PT, point 2.1) depuis le CSV de référence
// du 13/10/2026 : une URL par couple métier x ville, le modèle servicos ; urgencia et perto-de-mim
// métier x ville en 301 vers servicos ; hub picheleiro vers le hub canalizador (décisions 1 et 2).
//
//   node scripts/seo/pt-redirects-gerar.mjs
//
// Colonnes : source, destination, code, groupe, priorite, clics_sept, decision. La colonne
// `decision` est obligatoire pour les sources PROTEGER (règle 0.4 des instructions) : elle est
// remplie pour toutes les lignes, avec la même justification chiffrée.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lireCsv, ecrireCsv } from './pt-audit/lib/csv.mjs'
import { classer } from './pt-audit/lib/classer.mjs'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const csv = lireCsv(readFileSync(path.join(RACINE, 'data', 'seo', 'pt_sitemap_statut_complet.csv'), 'utf8'))
const chemins = new Set(csv.map((l) => l.chemin))

const DECISION = 'Consolidation phase 2 (DECISION PROPRIETAIRE 1, option A, mandat du 13/10/2026) : une URL par couple métier x ville, modèle servicos ; 301 un saut, sitemaps mis à jour le même jour'

const lignes = []
for (const l of csv) {
  const c = classer(l.chemin)
  let destination = null
  if (c.groupe === 'urgencia' && c.metier && c.ville) destination = `/pt/servicos/${c.metier}-${c.ville}/`
  else if (c.groupe === 'perto-de-mim' && c.metier && c.ville) destination = `/pt/servicos/${c.metier === 'picheleiro' ? 'canalizador' : c.metier}-${c.ville}/`
  else if (c.groupe === 'perto-de-mim-hub' && c.metier === 'picheleiro') destination = '/pt/perto-de-mim/canalizador/'
  if (!destination) continue
  if (!chemins.has(destination)) throw new Error(`destination absente du sitemap de référence : ${destination} (source ${l.chemin})`)
  const protegee = l.priorite === 'PROTEGER' ? ' ; PROTEGER : report des clics suivi dans docs/seo/journal-pt.md' : ''
  lignes.push({ source: l.chemin, destination, code: '301', groupe: c.groupe, priorite: l.priorite, clics_sept: l.clics_sept || '0', decision: DECISION + protegee })
}

// Garde-fous : aucune source n'est une destination (pas de chaîne), aucune boucle, sources uniques.
const sources = new Set(lignes.map((l) => l.source))
for (const l of lignes) {
  if (sources.has(l.destination)) throw new Error(`chaîne : ${l.source} -> ${l.destination} est aussi une source`)
  if (l.source === l.destination) throw new Error(`boucle : ${l.source}`)
}
if (sources.size !== lignes.length) throw new Error('sources en double')

lignes.sort((a, b) => a.source.localeCompare(b.source))
const sortie = path.join(RACINE, 'data', 'seo', 'pt-redirects.csv')
writeFileSync(sortie, ecrireCsv(lignes, ['source', 'destination', 'code', 'groupe', 'priorite', 'clics_sept', 'decision']))
const parGroupe = {}
for (const l of lignes) parGroupe[l.groupe] = (parGroupe[l.groupe] || 0) + 1
const protegees = lignes.filter((l) => l.priorite === 'PROTEGER')
console.log(`${lignes.length} redirections écrites dans ${path.relative(RACINE, sortie)} :`, JSON.stringify(parGroupe))
console.log(`${protegees.length} sources PROTEGER (${protegees.reduce((n, l) => n + Number(l.clics_sept || 0), 0)} clics en septembre), ${lignes.filter((l) => l.priorite === 'P1').length} sources P1`)

// Sources suivies (PROTEGER et P1) avec leur destination : docs/seo/phase-2-sources-suivies.md,
// pour lire le report des clics dans GSC (point 2.3 des instructions).
const suivies = lignes.filter((l) => l.priorite === 'PROTEGER' || l.priorite === 'P1').sort((a, b) => Number(b.clics_sept) - Number(a.clics_sept) || a.source.localeCompare(b.source))
const md = [
  '# Phase 2 SEO PT : sources PROTEGER et P1 redirigées (301) et leurs destinations',
  '',
  `Générée par \`scripts/seo/pt-redirects-gerar.mjs\` depuis \`data/seo/pt_sitemap_statut_complet.csv\` (référence du 13/10/2026) et \`data/seo/pt-redirects.csv\`. ${protegees.length} sources PROTEGER (${protegees.reduce((n, l) => n + Number(l.clics_sept || 0), 0)} clics en septembre 2026) et ${lignes.filter((l) => l.priorite === 'P1').length} sources P1. Suivi : dans GSC > Performances, comparer les clics de chaque destination avant et après la mise en production (docs/seo/journal-pt.md).`,
  '',
  '| Source (301) | Destination | Priorité | Clics sept. 2026 |',
  '|---|---|---|---|',
  ...suivies.map((l) => `| \`${l.source}\` | \`${l.destination}\` | ${l.priorite} | ${l.clics_sept} |`),
  '',
]
writeFileSync(path.join(RACINE, 'docs', 'seo', 'phase-2-sources-suivies.md'), md.join('\n'))
console.log(`${suivies.length} sources suivies écrites dans docs/seo/phase-2-sources-suivies.md`)
