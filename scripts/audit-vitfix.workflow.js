// Workflow d'audit Vitfix réutilisable (« loop »).
// ─────────────────────────────────────────────────────────────────────────────
// SOURCE DE VÉRITÉ versionnée. Pour l'exécuter comme workflow nommé :
//   cp scripts/audit-vitfix.workflow.js .claude/workflows/audit-vitfix.js
//   puis : Workflow({ name: 'audit-vitfix', args: { date: 'AAAA-MM-JJ' } })
// Ou directement : Workflow({ scriptPath: 'scripts/audit-vitfix.workflow.js', args: { date: '...' } })
//
// Structure : finders par dimension → vérification adversariale (filtre les faux
// positifs) → ground-truth Supabase advisors → synthèse markdown priorisée.
// Le workflow RETOURNE le rapport (les workflows n'écrivent pas de fichier) →
// écrire le résultat dans docs/audits/<date>-audit-vitfix.md.
// ─────────────────────────────────────────────────────────────────────────────

export const meta = {
  name: 'audit-vitfix',
  description: 'Audit multi-agents Vitfix (archi, sécurité, perf, métier) : find → vérifie adversarialement → synthétise',
  phases: [
    { title: 'Ground-truth', detail: 'Supabase advisors security+performance' },
    { title: 'Audit', detail: '1 finder par dimension, code actif' },
    { title: 'Verify', detail: 'skeptique adversarial par finding critique/haut' },
    { title: 'Report', detail: 'synthèse priorisée + markdown' },
  ],
}

const ACTIVE_SCOPE = `PÉRIMÈTRE — CODE ACTIF UNIQUEMENT. Audite : app/pro/, app/client/, app/api/ (routes actives), components/ (SAUF components/syndic-dashboard), lib/, middleware.ts, supabase/migrations, next.config.ts, open-next.config.ts, wrangler.toml. EXCLUS (dormant, NE PAS reporter) : app/syndic/, app/coproprietaire/, components/syndic-dashboard/, app/{en,es,nl}/, tables syndic_*/copro_*.`

const KNOWN_ACCEPTED = `DÉJÀ CONNUS / ACCEPTÉS — NE PAS reporter :
- anon key + URL Supabase inline dans wrangler.toml [vars] (publics par design)
- tables RLS-enabled sans policy (cron_heartbeats, idempotency_keys, stripe_webhook_events, subscription_*) = deny-all volontaire
- next_doc_number SECURITY DEFINER : valide auth.uid()===p_artisan_user_id en interne (migration 077)
- OpenNext : pas besoin de export const runtime par route (wrapper cloudflare-node par défaut)
- les 5 bugs récurrents (acompte #396, doublons #415, brouillon #411, base clients #343, numérotation) sont corrigés avec tests
- isProGerant/init-role/comptable-ai/RLS marches : corrigés dans la Vague 1 (2026-06-10)`

const FINDINGS_SCHEMA = {
  type: 'object', required: ['summary', 'findings'],
  properties: {
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'severity', 'dimension', 'location', 'evidence', 'impact', 'fix'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          dimension: { type: 'string' },
          location: { type: 'string' },
          evidence: { type: 'string' },
          impact: { type: 'string' },
          fix: { type: 'string' },
        },
      },
    },
  },
}
const VERDICT_SCHEMA = {
  type: 'object', required: ['isReal', 'adjustedSeverity', 'reasoning'],
  properties: {
    isReal: { type: 'boolean' },
    adjustedSeverity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'none'] },
    reasoning: { type: 'string' },
  },
}
const ADVISOR_SCHEMA = {
  type: 'object', required: ['counts', 'topIssues'],
  properties: {
    counts: { type: 'array', items: { type: 'object', required: ['name', 'level', 'count'], properties: { name: { type: 'string' }, level: { type: 'string' }, count: { type: 'number' } } } },
    topIssues: { type: 'array', items: { type: 'string' } },
  },
}

phase('Ground-truth')
const advisors = await agent(
  `Appelle les outils Supabase MCP via ToolSearch (query "select:mcp__supabase__get_advisors"), puis get_advisors type "security" PUIS type "performance". Résume : compte par (name, level) et liste les 15 problèmes les plus graves touchant des TABLES ACTIVES (bookings, devis, factures, profiles_artisan, clients, marches*, subscriptions, profiles). Le résultat performance est volumineux : si renvoyé en fichier, parse-le avec python/jq, ne le lis pas entier. ${ACTIVE_SCOPE}`,
  { schema: ADVISOR_SCHEMA, phase: 'Ground-truth', label: 'supabase-advisors' }
)
const advisorCtx = JSON.stringify(advisors).slice(0, 2500)

const DIMENSIONS = [
  { key: 'architecture', prompt: `Audite ARCHITECTURE & QUALITÉ : god components (>1500 l) et duplication artisan/BTP (DevisFactureForm vs BTP), pages dashboard surdimensionnées, empty catch blocks (interdits par CLAUDE.md — logger serveur / toast client), usage de any, hygiène repo (audit-*.md stale, copies de conflit iCloud "* 2"). Donne file:line réels.` },
  { key: 'security', prompt: `Audite SÉCURITÉ : authz API (vérif session + orgRole), lecture de rôle depuis user_metadata (modifiable client) vs app_metadata, RLS USING(true)/WITH CHECK(true) sur tables actives, init-role allowlist, prompt injection / system prompt fourni par le client dans les agents Groq, rate-limiting des endpoints IA, secrets hors [vars], RGPD (PII vers Langfuse/Sentry). Croise avec les advisors. Donne file:line / migration réels.` },
  { key: 'performance', prompt: `Audite PERFORMANCE & CLOUDFLARE : état en mémoire par isolate (Map de rate-limit, circuit-breaker, caches auth, confirmations) qui ne survit pas aux Workers, pagination Supabase manquante (.range), select('*'), libs lourdes côté client. Croise avec advisors perf (auth_rls_initplan, unused_index, multiple_permissive_policies, unindexed_foreign_keys). Donne file:line réels.` },
  { key: 'business', prompt: `Audite MÉTIER & IA : séparation artisan/BTP dans fichiers partagés (orgRole/useBtpDesign), exactitude PDF (V2 artisan vs V3 BTP, franchise 293B, RC Pro, police Unicode), prefill acompte (scaling de TOUTES les lignes + flags de visibilité), numérotation, instrumentation Langfuse de tous les agents, garde anti-hallucination (recoupement des chiffres vs DB). Lis .claude/rules/artisan-vs-btp.md d'abord. Donne file:line réels.` },
]

phase('Audit')
const reviewed = await pipeline(
  DIMENSIONS,
  (d) => agent(
    `${d.prompt}\n\n${ACTIVE_SCOPE}\n\n${KNOWN_ACCEPTED}\n\nContexte advisors DB : ${advisorCtx}\n\nRetourne 10-20 findings matériels, evidence-backed, file:line vérifiés (pas de généralités).`,
    { schema: FINDINGS_SCHEMA, phase: 'Audit', label: `audit:${d.key}`, agentType: d.key === 'security' ? 'security-reviewer' : 'Explore' }
  ),
  (review, d) => parallel(
    (review?.findings || [])
      .filter((f) => f.severity === 'critical' || f.severity === 'high')
      .map((f) => () =>
        agent(
          `Vérifie ce finding de façon ADVERSARIALE : lis le code réel à ${f.location} et essaie de le RÉFUTER. Par défaut isReal=false si tu ne trouves pas de preuve concrète dans le code. Finding : ${JSON.stringify(f)}`,
          { schema: VERDICT_SCHEMA, phase: 'Verify', label: `verify:${d.key}` }
        ).then((v) => ({ ...f, verdict: v }))
      )
  ).then((verified) => ({
    dimension: d.key,
    confirmed: verified.filter(Boolean).filter((f) => f.verdict?.isReal).map((f) => ({ ...f, severity: f.verdict.adjustedSeverity })),
    lower: (review?.findings || []).filter((f) => f.severity === 'medium' || f.severity === 'low'),
  }))
)

phase('Report')
const allConfirmed = reviewed.flat().filter(Boolean).flatMap((r) => [...(r.confirmed || []), ...(r.lower || [])])
const report = await agent(
  `Synthétise un rapport d'audit Vitfix en markdown FR. Findings (déjà vérifiés pour critiques/hauts) : ${JSON.stringify(allConfirmed).slice(0, 12000)}\nAdvisors : ${advisorCtx}\nDate du run : ${args?.date || 'non fournie'}.\nStructure : (1) résumé exécutif 5 lignes, (2) tableau par sévérité, (3) findings détaillés groupés par dimension avec file:line + fix, (4) deltas vs faux positifs connus. Priorise sécurité > stabilité Workers > perf DB > qualité/métier.`,
  { phase: 'Report', label: 'synthèse' }
)
return { report, findings: allConfirmed, advisors }
