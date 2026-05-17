#!/usr/bin/env tsx
// docs/agent-max/evals/run-evals.ts
// ─────────────────────────────────────────────────────────────────────────────
// Runner d'évaluations pour Max v1.1 (PT). Lit les fichiers JSONL du jeu
// désigné (train ou held-out), POSTe chaque cas sur /api/syndic/max-ai, applique
// le verifier déclaré, produit un rapport JSON horodaté dans results/.
//
// Usage :
//   MAX_AI_ENDPOINT=https://vitfix.io/api/syndic/max-ai \
//   MAX_AI_BEARER_TOKEN=<token user syndic> \
//   EVAL_RUN_ID=baseline-$(git rev-parse --short HEAD) \
//     npx tsx docs/agent-max/evals/run-evals.ts --set=train
//
// Flags :
//   --set=train|held-out          (obligatoire)
//   --category=<filename-prefix>  (optionnel, ex. --category=02-controle-perimetre)
//   --concurrency=N               (parallélisme — défaut 4 ; 1 si --serial)
//   --serial                      (force --concurrency=1)
//   --dry-run                     (parse les cas sans POSTer — pour debug)
//
// Code de sortie : 0 si tous les seuils passent, 1 sinon.
// ─────────────────────────────────────────────────────────────────────────────

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'

// ── Types ───────────────────────────────────────────────────────────────────

type Verifier = 'regex' | 'citation_count' | 'llm_judge' | 'refusal_pattern'

interface EvalCase {
  id: string
  category: string
  question: string
  verifier: Verifier
  expected_refusal?: boolean
  must_contain_regex?: string[]
  must_not_contain_regex?: string[]
  min_citations?: number
  expected_sources?: string[]
  judge_criteria?: string
  notes?: string
}

interface MaxResponse {
  response: string
  citations: Array<{
    font_id: string
    exact_quote: string
    claim: string
    chunk_id?: string
    source?: string
    article?: string | null
    quote_verified?: boolean
  }>
  confidence: number
  refusal: boolean
  retrieval?: {
    chunks_found: number
    chunks_cited: number
    hyde_used: boolean
    chunk_ids?: string[]
    eval_run_id?: string
  }
}

interface CaseResult {
  id: string
  category: string
  passed: boolean
  reasons: string[]
  latency_ms: number
  response_excerpt: string
  retrieval?: MaxResponse['retrieval']
  refusal: boolean
}

// ── Args parsing ────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const flags: Record<string, string | boolean> = {}
  for (const a of args) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=')
      flags[k] = v ?? true
    }
  }
  if (flags['set'] !== 'train' && flags['set'] !== 'held-out') {
    console.error('Usage: tsx run-evals.ts --set=train|held-out [--category=<prefix>] [--concurrency=N] [--dry-run]')
    process.exit(2)
  }
  return {
    set: flags['set'] as 'train' | 'held-out',
    category: (flags['category'] as string) || null,
    concurrency: flags['serial'] ? 1 : Number(flags['concurrency'] || 4),
    dryRun: !!flags['dry-run'],
  }
}

// ── Loading cases ───────────────────────────────────────────────────────────

function loadCases(set: 'train' | 'held-out', categoryPrefix: string | null): EvalCase[] {
  const dir = resolve(__dirname, set)
  if (!existsSync(dir)) {
    console.error(`Directory not found: ${dir}`)
    process.exit(2)
  }
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .filter((f) => !categoryPrefix || f.startsWith(categoryPrefix))
    .sort()
  const cases: EvalCase[] = []
  for (const file of files) {
    const lines = readFileSync(join(dir, file), 'utf8').trim().split('\n')
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        cases.push(JSON.parse(line) as EvalCase)
      } catch (e) {
        console.error(`Parse error in ${file}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }
  return cases
}

// ── Verifiers ───────────────────────────────────────────────────────────────

function verifyRegex(c: EvalCase, res: MaxResponse): { passed: boolean; reasons: string[] } {
  const reasons: string[] = []
  const text = res.response || ''
  for (const pat of c.must_contain_regex ?? []) {
    const re = new RegExp(pat)
    if (!re.test(text)) reasons.push(`must_contain_regex /${pat}/ did not match`)
  }
  for (const pat of c.must_not_contain_regex ?? []) {
    const re = new RegExp(pat)
    if (re.test(text)) reasons.push(`must_not_contain_regex /${pat}/ matched`)
  }
  return { passed: reasons.length === 0, reasons }
}

function verifyCitationCount(c: EvalCase, res: MaxResponse): { passed: boolean; reasons: string[] } {
  const reasons: string[] = []
  const validCitations = (res.citations ?? []).filter((cit) => cit.quote_verified !== false)
  const min = c.min_citations ?? 1
  if (validCitations.length < min) {
    reasons.push(`citation_count: got ${validCitations.length} verified citations, expected >= ${min}`)
  }
  // Bonus checks via regex pour fixer le contenu
  const text = res.response || ''
  for (const pat of c.must_contain_regex ?? []) {
    const re = new RegExp(pat)
    if (!re.test(text)) reasons.push(`must_contain_regex /${pat}/ did not match`)
  }
  for (const pat of c.must_not_contain_regex ?? []) {
    const re = new RegExp(pat)
    if (re.test(text)) reasons.push(`must_not_contain_regex /${pat}/ matched`)
  }
  return { passed: reasons.length === 0, reasons }
}

function verifyRefusalPattern(c: EvalCase, res: MaxResponse): { passed: boolean; reasons: string[] } {
  const reasons: string[] = []
  const expected = c.expected_refusal === true
  if (res.refusal !== expected) {
    reasons.push(`refusal: got ${res.refusal}, expected ${expected}`)
  }
  const text = res.response || ''
  for (const pat of c.must_contain_regex ?? []) {
    const re = new RegExp(pat)
    if (!re.test(text)) reasons.push(`must_contain_regex /${pat}/ did not match`)
  }
  for (const pat of c.must_not_contain_regex ?? []) {
    const re = new RegExp(pat)
    if (re.test(text)) reasons.push(`must_not_contain_regex /${pat}/ matched`)
  }
  return { passed: reasons.length === 0, reasons }
}

async function verifyLlmJudge(
  c: EvalCase,
  res: MaxResponse,
  groqApiKey: string,
): Promise<{ passed: boolean; reasons: string[]; score: number }> {
  if (!c.judge_criteria) {
    return { passed: false, reasons: ['llm_judge: judge_criteria field missing'], score: 0 }
  }
  if (!groqApiKey) {
    return { passed: false, reasons: ['llm_judge: GROQ_API_KEY not set'], score: 0 }
  }
  const judgePrompt = `És um juiz imparcial. Avalia a seguinte resposta de um agente jurídico contra o critério dado.

Critério: ${c.judge_criteria}

Pergunta do utilizador: ${c.question}

Resposta do agente:
"""
${res.response}
"""

Responde APENAS com um objeto JSON: { "score": <número entre 0 e 1>, "razao": "<curta explicação em português>" }.
Score >= 0.7 = passa; < 0.7 = falha.`
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: judgePrompt }],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    })
    if (!r.ok) {
      return { passed: false, reasons: [`llm_judge HTTP ${r.status}`], score: 0 }
    }
    const data = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const rawJson = data.choices?.[0]?.message?.content || '{}'
    const parsed = JSON.parse(rawJson) as { score?: number; razao?: string }
    const score = Number(parsed.score ?? 0)
    const passed = score >= 0.7
    return {
      passed,
      reasons: passed ? [] : [`llm_judge score ${score.toFixed(2)} < 0.7 — ${parsed.razao || 'sem razão'}`],
      score,
    }
  } catch (e) {
    return { passed: false, reasons: [`llm_judge exception: ${e instanceof Error ? e.message : String(e)}`], score: 0 }
  }
}

// ── HTTP call ───────────────────────────────────────────────────────────────

async function callMax(
  endpoint: string,
  bearer: string,
  evalRunId: string,
  question: string,
): Promise<{ res: MaxResponse | null; latency_ms: number; error?: string }> {
  const start = Date.now()
  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearer}`,
        'Content-Type': 'application/json',
        'X-Eval-Run-Id': evalRunId,
      },
      body: JSON.stringify({
        message: question,
        locale: 'pt',
        conversation_history: [],
      }),
    })
    const latency_ms = Date.now() - start
    if (!r.ok) {
      const errText = await r.text().catch(() => '')
      return { res: null, latency_ms, error: `HTTP ${r.status} ${errText.slice(0, 200)}` }
    }
    const res = (await r.json()) as MaxResponse
    return { res, latency_ms }
  } catch (e) {
    return {
      res: null,
      latency_ms: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

// ── Run one case ────────────────────────────────────────────────────────────

async function runCase(
  c: EvalCase,
  endpoint: string,
  bearer: string,
  evalRunId: string,
  groqKey: string,
  dryRun: boolean,
): Promise<CaseResult> {
  if (dryRun) {
    return {
      id: c.id,
      category: c.category,
      passed: true,
      reasons: ['dry-run: skipped real call'],
      latency_ms: 0,
      response_excerpt: '(dry-run)',
      refusal: false,
    }
  }
  const { res, latency_ms, error } = await callMax(endpoint, bearer, evalRunId, c.question)
  if (!res) {
    return {
      id: c.id,
      category: c.category,
      passed: false,
      reasons: [`call failed: ${error}`],
      latency_ms,
      response_excerpt: '',
      refusal: false,
    }
  }
  let verdict: { passed: boolean; reasons: string[] }
  if (c.verifier === 'regex') verdict = verifyRegex(c, res)
  else if (c.verifier === 'citation_count') verdict = verifyCitationCount(c, res)
  else if (c.verifier === 'refusal_pattern') verdict = verifyRefusalPattern(c, res)
  else if (c.verifier === 'llm_judge') verdict = await verifyLlmJudge(c, res, groqKey)
  else verdict = { passed: false, reasons: [`unknown verifier: ${c.verifier}`] }
  return {
    id: c.id,
    category: c.category,
    passed: verdict.passed,
    reasons: verdict.reasons,
    latency_ms,
    response_excerpt: (res.response || '').slice(0, 300),
    retrieval: res.retrieval,
    refusal: res.refusal,
  }
}

// ── Pool d'exécution ────────────────────────────────────────────────────────

async function runPool<T, R>(items: T[], fn: (it: T) => Promise<R>, concurrency: number): Promise<R[]> {
  const results: R[] = []
  let idx = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++
      results[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return results
}

// ── Rapport ─────────────────────────────────────────────────────────────────

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

function buildReport(
  evalRunId: string,
  set: string,
  endpoint: string,
  startedAt: string,
  results: CaseResult[],
) {
  const byCategory: Record<string, { passed: number; failed: number; latencies: number[] }> = {}
  for (const r of results) {
    const cat = byCategory[r.category] ?? (byCategory[r.category] = { passed: 0, failed: 0, latencies: [] })
    if (r.passed) cat.passed++
    else cat.failed++
    cat.latencies.push(r.latency_ms)
  }
  const byCategoryReport: Record<string, unknown> = {}
  for (const [cat, stats] of Object.entries(byCategory)) {
    const total = stats.passed + stats.failed
    byCategoryReport[cat] = {
      passed: stats.passed,
      failed: stats.failed,
      pass_rate: total > 0 ? Number((stats.passed / total).toFixed(3)) : 0,
      latency_p50_ms: percentile(stats.latencies, 50),
      latency_p95_ms: percentile(stats.latencies, 95),
    }
  }
  const total = results.length
  const passed = results.filter((r) => r.passed).length
  return {
    eval_run_id: evalRunId,
    started_at: startedAt,
    ended_at: new Date().toISOString(),
    endpoint,
    set,
    summary: {
      total,
      passed,
      failed: total - passed,
      pass_rate: total > 0 ? Number((passed / total).toFixed(3)) : 0,
    },
    by_category: byCategoryReport,
    failures: results
      .filter((r) => !r.passed)
      .map((r) => ({
        id: r.id,
        category: r.category,
        reasons: r.reasons,
        response_excerpt: r.response_excerpt,
        refusal: r.refusal,
      })),
  }
}

// ── D2 — Critères de succès (cf. README §Critères de succès) ────────────────

function checkSuccessThresholds(report: ReturnType<typeof buildReport>): { ok: boolean; details: string[] } {
  const details: string[] = []
  const NON_REGRESSION = new Set([
    'comparison-numerique',
    'controle-perimetre',
    'matiere-couverte',
    'citation-verbatim',
  ])
  const CORE = new Set([
    'cobranca-quotas',
    'impugnacao',
    'reparticao-encargos',
    'personalidade-judiciaria',
  ])
  let ok = true
  for (const [cat, statsRaw] of Object.entries(report.by_category)) {
    const stats = statsRaw as { pass_rate: number }
    const threshold = NON_REGRESSION.has(cat) ? 0.85 : CORE.has(cat) ? 0.8 : 0
    if (stats.pass_rate < threshold) {
      ok = false
      details.push(`${cat}: pass_rate ${stats.pass_rate} < threshold ${threshold}`)
    } else {
      details.push(`${cat}: pass_rate ${stats.pass_rate} >= threshold ${threshold} ✓`)
    }
  }
  return { ok, details }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs()
  const endpoint = process.env.MAX_AI_ENDPOINT || 'http://localhost:3000/api/syndic/max-ai'
  const bearer = process.env.MAX_AI_BEARER_TOKEN || ''
  const evalRunId = process.env.EVAL_RUN_ID || `manual-${Date.now()}`
  const groqKey = process.env.GROQ_API_KEY || ''
  const startedAt = new Date().toISOString()

  if (!args.dryRun && !bearer) {
    console.error('MAX_AI_BEARER_TOKEN env required (syndic user JWT). Use --dry-run pour skip les appels réels.')
    process.exit(2)
  }

  const cases = loadCases(args.set, args.category)
  if (cases.length === 0) {
    console.error('No cases found.')
    process.exit(2)
  }

  console.log(`[run-evals] ${cases.length} cas chargé(s) (${args.set}${args.category ? ` / ${args.category}` : ''})`)
  console.log(`[run-evals] endpoint=${endpoint}`)
  console.log(`[run-evals] eval_run_id=${evalRunId}`)
  console.log(`[run-evals] concurrency=${args.concurrency}${args.dryRun ? ' (DRY RUN)' : ''}`)

  const results = await runPool(
    cases,
    (c) => runCase(c, endpoint, bearer, evalRunId, groqKey, args.dryRun),
    args.concurrency,
  )

  const report = buildReport(evalRunId, args.set, endpoint, startedAt, results)
  const success = checkSuccessThresholds(report)

  // Persiste le rapport
  const resultsDir = resolve(__dirname, 'results')
  if (!existsSync(resultsDir)) mkdirSync(resultsDir, { recursive: true })
  const ts = startedAt.replace(/[:.]/g, '-')
  const reportPath = join(resultsDir, `${ts}-${evalRunId}.json`)
  writeFileSync(reportPath, JSON.stringify({ ...report, success }, null, 2))
  console.log(`[run-evals] rapport écrit : ${reportPath}`)

  console.log(`\n[run-evals] Résumé :`)
  console.log(`  Total          : ${report.summary.total}`)
  console.log(`  Passed         : ${report.summary.passed} (${(report.summary.pass_rate * 100).toFixed(1)}%)`)
  console.log(`  Failed         : ${report.summary.failed}`)
  console.log(`\n[run-evals] Seuils D2 (85% non-régression / 80% cœur) :`)
  for (const line of success.details) console.log(`  ${line}`)

  process.exit(success.ok ? 0 : 1)
}

main().catch((e) => {
  console.error('[run-evals] FATAL:', e)
  process.exit(1)
})
