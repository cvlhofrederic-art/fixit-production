#!/usr/bin/env npx tsx
// ── Auto-generate API documentation from route files ─────────────────────────
// Scans app/api/**/route.ts, extracts HTTP methods and inline comments,
// outputs a Markdown reference file.
//
// Usage: npx tsx scripts/generate-api-docs.ts

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const API_DIR = join(__dirname, '..', 'app', 'api')
const OUTPUT = join(__dirname, '..', 'docs', 'api-reference.md')

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

interface RouteInfo {
  path: string
  methods: { method: string; comment: string }[]
  auth: boolean
  rateLimit: boolean
  validation: boolean
}

function findRouteFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      results.push(...findRouteFiles(full))
    } else if (entry === 'route.ts') {
      results.push(full)
    }
  }
  return results
}

function extractRouteInfo(filePath: string): RouteInfo {
  const content = readFileSync(filePath, 'utf-8')
  const rel = relative(join(__dirname, '..', 'app'), filePath)
  // Convert file path to API route: api/bookings/route.ts -> /api/bookings
  const apiPath = '/' + rel.replace(/\/route\.ts$/, '').replace(/\\/g, '/')

  const methods: { method: string; comment: string }[] = []

  for (const method of HTTP_METHODS) {
    const exportRegex = new RegExp(`export\\s+async\\s+function\\s+${method}\\b`)
    if (exportRegex.test(content)) {
      // Look for inline comment above the export
      const lines = content.split('\n')
      let comment = ''
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(exportRegex)) {
          // Check 1-2 lines above for comments
          for (let j = Math.max(0, i - 2); j < i; j++) {
            const match = lines[j].match(/\/\/\s*(.+)/)
            if (match) {
              comment = match[1].replace(/^(GET|POST|PUT|PATCH|DELETE)\s*[:—-]\s*/, '').trim()
            }
          }
          break
        }
      }
      methods.push({ method, comment })
    }
  }

  const auth = content.includes('getAuthUser') || content.includes('auth-helpers')
  const rateLimit = content.includes('checkRateLimit')
  const validation = content.includes('validateBody') || content.includes('Schema')

  return { path: apiPath, methods, auth, rateLimit, validation }
}

function categorize(path: string): string {
  if (path.startsWith('/api/admin')) return 'Admin'
  if (path.startsWith('/api/syndic')) return 'Syndic'
  if (path.startsWith('/api/artisan') || path.startsWith('/api/pro/')) return 'Artisan'
  if (path.startsWith('/api/client')) return 'Client'
  if (path.startsWith('/api/copro')) return 'Copropriétaire'
  if (path.startsWith('/api/stripe')) return 'Paiements (Stripe)'
  if (path.startsWith('/api/booking')) return 'Réservations'
  if (path.includes('-ai') || path.includes('fixy') || path.includes('materiaux') || path.includes('comptable') || path.includes('email-agent')) return 'Agents IA'
  if (path.startsWith('/api/auth')) return 'Authentification'
  if (path.startsWith('/api/sync') || path.startsWith('/api/cron') || path.startsWith('/api/tenders')) return 'Cron & Sync'
  if (path.startsWith('/api/marches')) return 'Marketplace'
  if (path.startsWith('/api/portugal') || path.includes('fiscal')) return 'Portugal Fiscal'
  if (path.startsWith('/api/user')) return 'Utilisateur'
  return 'Autre'
}

// ── Main ─────────────────────────────────────────────────────────────────────

const files = findRouteFiles(API_DIR).sort()
const routes = files.map(extractRouteInfo).filter(r => r.methods.length > 0)

// Group by category
const grouped = new Map<string, RouteInfo[]>()
for (const route of routes) {
  const cat = categorize(route.path)
  if (!grouped.has(cat)) grouped.set(cat, [])
  grouped.get(cat)!.push(route)
}

// Generate markdown
const lines: string[] = [
  '# Vitfix API Reference',
  '',
  `> Auto-generated on ${new Date().toISOString().split('T')[0]} by \`scripts/generate-api-docs.ts\``,
  `> ${routes.length} routes, ${routes.reduce((s, r) => s + r.methods.length, 0)} endpoints`,
  '',
  '## Legend',
  '',
  '| Icon | Meaning |',
  '|------|---------|',
  '| `AUTH` | Requires authentication (getAuthUser) |',
  '| `RL` | Rate limited |',
  '| `ZOD` | Input validation (Zod schema) |',
  '',
]

const sortedCategories = [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))

for (const [category, catRoutes] of sortedCategories) {
  lines.push(`## ${category}`, '')
  lines.push('| Method | Endpoint | Description | Guards |')
  lines.push('|--------|----------|-------------|--------|')

  for (const route of catRoutes) {
    for (const m of route.methods) {
      const guards = [
        route.auth ? '`AUTH`' : '',
        route.rateLimit ? '`RL`' : '',
        route.validation ? '`ZOD`' : '',
      ].filter(Boolean).join(' ')
      lines.push(`| \`${m.method}\` | \`${route.path}\` | ${m.comment || '—'} | ${guards} |`)
    }
  }
  lines.push('')
}

lines.push('---', '', '*Regenerate: `npx tsx scripts/generate-api-docs.ts`*', '')

writeFileSync(OUTPUT, lines.join('\n'))
console.log(`Generated ${OUTPUT} — ${routes.length} routes documented`)
