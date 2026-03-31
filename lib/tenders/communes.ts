// ── Communes discovery via geo.api.gouv.fr ──────────────────────────────────

import { readFile, writeFile, stat, mkdir } from 'fs/promises'
import path from 'path'
import { logger } from '@/lib/logger'
import { SCANNER_CONFIG, DEPARTMENTS } from './config'
import type { Commune } from './types'

const GEO_API_BASE = 'https://geo.api.gouv.fr'
const CACHE_DIR = path.join(process.cwd(), 'data')
const CACHE_MAX_AGE_MS = SCANNER_CONFIG.cache_communes_hours * 60 * 60 * 1000

// ── Helpers ──────────────────────────────────────────────────────────────────

export function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function slugify(name: string): string {
  return stripAccents(name)
    .toLowerCase()
    .replace(/['']/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function cachePath(department: string): string {
  return path.join(CACHE_DIR, `communes-${department}.json`)
}

async function isCacheFresh(filePath: string): Promise<boolean> {
  try {
    const stats = await stat(filePath)
    return Date.now() - stats.mtimeMs < CACHE_MAX_AGE_MS
  } catch {
    return false
  }
}

// ── Fetch from geo API ───────────────────────────────────────────────────────

interface GeoApiCommune {
  nom: string
  code: string
  codesPostaux: string[]
  population?: number
}

export async function fetchCommunes(department: string): Promise<Commune[]> {
  const url = `${GEO_API_BASE}/departements/${department}/communes?fields=nom,code,codesPostaux,population&format=json`

  logger.info(`[communes] Fetching communes for department ${department}`)

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(SCANNER_CONFIG.request_timeout_ms),
  })

  if (!response.ok) {
    throw new Error(`geo.api.gouv.fr returned ${response.status} for department ${department}`)
  }

  const data: GeoApiCommune[] = await response.json()

  const deptConfig = DEPARTMENTS[department]
  const region = deptConfig?.region ?? 'unknown'

  const communes: Commune[] = data.map((c) => ({
    name: c.nom,
    code_insee: c.code,
    postal_codes: c.codesPostaux ?? [],
    department,
    region,
    population: c.population,
  }))

  logger.info(`[communes] Found ${communes.length} communes in department ${department}`)

  return communes
}

// ── Cached loader ────────────────────────────────────────────────────────────

export async function loadCommunes(department: string): Promise<Commune[]> {
  const file = cachePath(department)

  if (await isCacheFresh(file)) {
    logger.info(`[communes] Using cached data for department ${department}`)
    const raw = await readFile(file, 'utf-8')
    return JSON.parse(raw) as Commune[]
  }

  const communes = await fetchCommunes(department)

  try {
    await mkdir(CACHE_DIR, { recursive: true })
    await writeFile(file, JSON.stringify(communes, null, 2), 'utf-8')
    logger.info(`[communes] Cache written to ${file}`)
  } catch (err) {
    logger.warn(`[communes] Failed to write cache: ${err}`)
  }

  return communes
}

// ── Website resolution ───────────────────────────────────────────────────────

async function tryWebsite(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(SCANNER_CONFIG.request_timeout_ms),
      headers: {
        'User-Agent': SCANNER_CONFIG.user_agent,
      },
    })
    return response.ok
  } catch {
    return false
  }
}

async function resolveOneWebsite(commune: Commune): Promise<Commune> {
  const slug = slugify(commune.name)

  const candidates = [
    `https://www.mairie-${slug}.fr`,
    `https://www.ville-${slug}.fr`,
    `https://www.${slug}.fr`,
    `https://mairie-${slug}.fr`,
  ]

  for (const url of candidates) {
    if (await tryWebsite(url)) {
      return {
        ...commune,
        website: url,
        website_status: 'found',
      }
    }
  }

  return {
    ...commune,
    website_status: 'not_found',
  }
}

export async function resolveWebsites(communes: Commune[]): Promise<Commune[]> {
  const concurrency = SCANNER_CONFIG.max_concurrent_requests
  const results: Commune[] = []
  let index = 0

  logger.info(`[communes] Resolving websites for ${communes.length} communes (concurrency: ${concurrency})`)

  async function worker() {
    while (index < communes.length) {
      const i = index++
      const commune = communes[i]

      try {
        const resolved = await resolveOneWebsite(commune)
        results[i] = resolved

        if (resolved.website_status === 'found') {
          logger.info(`[communes] ${resolved.name}: ${resolved.website}`)
        }
      } catch (err) {
        results[i] = { ...commune, website_status: 'error' }
        logger.warn(`[communes] Error resolving ${commune.name}: ${err}`)
      }

      if ((i + 1) % 20 === 0) {
        logger.info(`[communes] Progress: ${i + 1}/${communes.length}`)
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, communes.length) }, () => worker())
  await Promise.all(workers)

  const found = results.filter((c) => c.website_status === 'found').length
  logger.info(`[communes] Resolution complete: ${found}/${communes.length} websites found`)

  return results
}
