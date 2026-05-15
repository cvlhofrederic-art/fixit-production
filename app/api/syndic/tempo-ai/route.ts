// app/api/syndic/tempo-ai/route.ts
// Agent Tempo ⏱️ — orchestrateur d'automatisations récurrentes syndic.
// Pattern ##TOOL## identique à alfredo-chat.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { supabaseAdmin } from '@/lib/supabase-server'
import { isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { callGroqWithRetry } from '@/lib/groq'
import { sanitizeContextForLLM, resolveSanitizedToken } from '@/lib/ai/sanitize-context'
import { evaluateCron } from '@/lib/scheduler/cron-evaluator'
import { traceAgent } from '@/lib/langfuse'

const BodySchema = z.object({
  message: z.string().min(1).max(4000),
  conversation_history: z.array(z.any()).optional(),
  locale: z.enum(['fr', 'pt']).optional(),
})

// ── System prompts ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT_FR = `Tu es Tempo ⏱️, l'agent IA orchestrateur d'automatisations du syndic Vitfix.
Ton rôle : aider l'utilisateur à programmer des tâches récurrentes (envois, génération docs, rappels).

CAPACITÉS — task_types disponibles :
- send_email_template : email avec template + recipients
- send_appel_charges : Léa génère contenu + envoi aux copropriétaires (params: immeuble_id)
- send_relance_impaye : Léa rédige relance + envoi pour impayés > N jours (params: threshold_days)
- send_convocation_ag : Max génère convocation AG officielle (params: immeuble_id, ag_date, agenda, recipients)
- generate_monthly_report : Léa compile rapport mensuel (params: recipients)
- remind_echeance_legale : DPE/ascenseur/gaz (params: type, expiration, recipients)
- backup_docs : archive zip mensuelle (params: notify_email)

PATTERN D'INVOCATION TOOLS :
Quand tu veux créer/modifier une automatisation, réponds avec :
##TOOL##{"name":"<tool_name>","args":{...}}##

Tools disponibles :
- create_automation : { name, task_type, cron_expr, params, locale, timezone? }
- list_automations : { status? }
- pause_automation : { automation_id }
- resume_automation : { automation_id }
- delete_automation : { automation_id }
- dry_run : { automation_id }
- analyze_runs : { automation_id, period: 'week'|'month'|'all' }

EXEMPLES :
- "Envoie chaque 1er trimestre les appels de charges pour Belle Vue"
  → ##TOOL##{"name":"create_automation","args":{"name":"Appels trimestriels Belle Vue","task_type":"send_appel_charges","cron_expr":"0 9 1 1,4,7,10 *","params":{"immeuble_id":"<id-Belle-Vue>"},"locale":"fr"}}##
- "Liste mes automatisations actives"
  → ##TOOL##{"name":"list_automations","args":{"status":"active"}}##
- "Mets en pause l'automatisation X"
  → ##TOOL##{"name":"pause_automation","args":{"automation_id":"<id>"}}##

RÈGLES :
1. Explique en français ce que tu vas faire AVANT le bloc ##TOOL##.
2. Si une info manque (cron, immeuble, recipients), demande clarification plutôt qu'inventer.
3. Pour cron expressions, utilise format standard 5 champs (m h dom mon dow).
4. Confirme TOUJOURS avec l'utilisateur avant create/delete (pas d'exécution automatique).

Sans tool, réponds normalement.`

const SYSTEM_PROMPT_PT = `És o Tempo ⏱️, o agente IA orquestrador de automatizações do síndico Vitfix.
O teu papel: ajudar o utilizador a programar tarefas recorrentes (envios, geração de documentos, lembretes).

CAPACIDADES — task_types disponíveis :
- send_email_template : email com template + destinatários
- send_appel_charges : Léa gera conteúdo + envio aos condóminos (params: immeuble_id)
- send_relance_impaye : Léa redige cobrança + envio para dívidas > N dias (params: threshold_days)
- send_convocation_ag : Max gera convocatória de AG oficial (params: immeuble_id, ag_date, agenda, recipients)
- generate_monthly_report : Léa compila relatório mensal (params: recipients)
- remind_echeance_legale : DPE/elevador/gás (params: type, expiration, recipients)
- backup_docs : arquivo zip mensal (params: notify_email)

PADRÃO DE INVOCAÇÃO DE TOOLS :
##TOOL##{"name":"<tool_name>","args":{...}}##

REGRAS :
1. Explica em português o que vais fazer ANTES do bloco ##TOOL##.
2. Se faltam informações (cron, imóvel, destinatários), pede esclarecimento.
3. Confirma SEMPRE com o utilizador antes de criar/eliminar.`

// ── Tool extraction ───────────────────────────────────────────────────────────

function extractToolCall(text: string): { name: string; args: Record<string, unknown> } | null {
  const m = text.match(/##TOOL##\s*(\{[\s\S]*?\})\s*##/)
  if (!m) return null
  try {
    const parsed = JSON.parse(m[1]) as { name?: string; args?: Record<string, unknown> }
    if (typeof parsed.name === 'string') return { name: parsed.name, args: parsed.args ?? {} }
  } catch {
    return null
  }
  return null
}

// ── Tool executor ─────────────────────────────────────────────────────────────

async function execTempoTool(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>,
  userId: string,
  cabinetId: string,
): Promise<unknown> {
  switch (name) {
    case 'create_automation': {
      const cronEval = evaluateCron(args.cron_expr as string, {
        timezone: (args.timezone as string) ?? 'Europe/Paris',
      })
      if (!cronEval.valid) return { error: 'invalid_cron', detail: cronEval.error }
      const { data, error } = await supabaseAdmin
        .from('syndic_automations')
        .insert({
          cabinet_id: cabinetId,
          created_by: userId,
          name: (args.name as string) ?? 'Automatisation sans nom',
          description: (args.description as string) ?? null,
          task_type: args.task_type,
          cron_expr: args.cron_expr,
          timezone: (args.timezone as string) ?? 'Europe/Paris',
          params: (args.params as object) ?? {},
          locale: (args.locale as string) ?? 'fr',
          next_run_at: cronEval.next.toISOString(),
        })
        .select()
        .single()
      if (error) return { error: error.message }
      return { ok: true, automation: data, next_run: cronEval.next.toISOString() }
    }

    case 'list_automations': {
      let q = supabaseAdmin
        .from('syndic_automations')
        .select(
          'id, name, task_type, cron_expr, status, last_run_at, last_run_status, next_run_at, run_count, failure_count',
        )
        .eq('cabinet_id', cabinetId)
        .order('created_at', { ascending: false })
      if (args.status) q = q.eq('status', args.status as string)
      const { data } = await q.limit(50)
      return { automations: data ?? [] }
    }

    case 'pause_automation':
    case 'resume_automation':
    case 'delete_automation': {
      if (!args.automation_id) return { error: 'missing_automation_id' }
      const newStatus =
        name === 'pause_automation' ? 'paused' : name === 'resume_automation' ? 'active' : 'archived'
      const { data, error } = await supabaseAdmin
        .from('syndic_automations')
        .update({ status: newStatus })
        .eq('id', args.automation_id as string)
        .eq('cabinet_id', cabinetId)
        .select()
        .single()
      if (error || !data) return { error: 'not_found_or_failed' }
      return { ok: true, automation: data }
    }

    case 'dry_run': {
      if (!args.automation_id) return { error: 'missing_automation_id' }
      const { data: auto } = await supabaseAdmin
        .from('syndic_automations')
        .select('*')
        .eq('id', args.automation_id as string)
        .eq('cabinet_id', cabinetId)
        .single()
      if (!auto) return { error: 'not_found' }
      const cronEval = evaluateCron((auto as { cron_expr: string; timezone: string }).cron_expr, {
        timezone: (auto as { timezone: string }).timezone,
      })
      return {
        ok: true,
        would_run_at: cronEval.next.toISOString(),
        task_type: (auto as { task_type: string }).task_type,
        params: (auto as { params: unknown }).params,
      }
    }

    case 'analyze_runs': {
      const period = (args.period ?? 'week') as 'week' | 'month' | 'all'
      const days = period === 'week' ? 7 : period === 'month' ? 30 : 365
      const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()
      const q = supabaseAdmin
        .from('syndic_automation_runs')
        .select('status, emails_sent, error_message, started_at')
        .eq('cabinet_id', cabinetId)
        .gte('started_at', since)
        .order('started_at', { ascending: false })
        .limit(200)
      if (args.automation_id) {
        const { data } = await q.eq('automation_id', args.automation_id as string)
        const list = ((data ?? []) as { status: string; emails_sent?: number; error_message?: string }[])
        const byStatus: Record<string, number> = {}
        for (const r of list) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
        return {
          period,
          total: list.length,
          by_status: byStatus,
          total_emails: list.reduce((s, r) => s + (r.emails_sent ?? 0), 0),
          recent_errors: list.filter((r) => r.error_message).slice(0, 5),
        }
      }
      const { data } = await q
      const list = ((data ?? []) as { status: string; emails_sent?: number; error_message?: string }[])
      const byStatus: Record<string, number> = {}
      for (const r of list) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
      return {
        period,
        total: list.length,
        by_status: byStatus,
        total_emails: list.reduce((s, r) => s + (r.emails_sent ?? 0), 0),
        recent_errors: list.filter((r) => r.error_message).slice(0, 5),
      }
    }

    default:
      return { error: `unknown_tool: ${name}` }
  }
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  if (!(await checkRateLimit(`tempo:${ip}`, 30, 60_000))) return rateLimitResponse()

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const rawBody = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(rawBody)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })

  const locale = parsed.data.locale ?? 'fr'
  const cabinetId = await resolveCabinetId(user, supabaseAdmin as Parameters<typeof resolveCabinetId>[1])
  if (!cabinetId) return NextResponse.json({ error: 'cabinet_not_found' }, { status: 403 })

  // Charger contexte minimal (immeubles + nb automations actives)
  const [immsRes, autosCountRes] = await Promise.all([
    supabaseAdmin.from('syndic_immeubles').select('id, nom').eq('cabinet_id', cabinetId).limit(20),
    supabaseAdmin
      .from('syndic_automations')
      .select('id', { count: 'exact', head: true })
      .eq('cabinet_id', cabinetId)
      .eq('status', 'active'),
  ])

  const ctxRaw = {
    immeubles: ((immsRes.data ?? []) as { id: string; nom: string }[]).map((i) => ({
      id: i.id,
      nom: i.nom,
    })),
    active_automations_count: autosCountRes.count ?? 0,
  }
  const { sanitized, tokenMap } = sanitizeContextForLLM(ctxRaw)

  const systemPrompt =
    (locale === 'pt' ? SYSTEM_PROMPT_PT : SYSTEM_PROMPT_FR) +
    `\n\nCONTEXTE :\n${JSON.stringify(sanitized, null, 2)}`

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...(parsed.data.conversation_history ?? []).slice(-30),
    { role: 'user' as const, content: parsed.data.message },
  ]

  try {
    const groqRes = await traceAgent(
      { agent_id: 'tempo', user_id: user.id, prompt: parsed.data.message },
      () => callGroqWithRetry({ messages, temperature: 0.3, max_tokens: 1500 }),
    )
    const rawResponse = groqRes.choices[0]?.message?.content ?? ''

    const toolCall = extractToolCall(rawResponse)
    if (toolCall) {
      const toolResult = await execTempoTool(toolCall.name, toolCall.args, user.id, cabinetId)
      const followUpMessages = [
        ...messages,
        { role: 'assistant' as const, content: rawResponse },
        {
          role: 'system' as const,
          content: `Résultat tool ${toolCall.name} :\n${JSON.stringify(toolResult, null, 2)}\n\nReformule en ${locale === 'pt' ? 'português europeu' : 'français'} pour l'utilisateur de manière concise.`,
        },
      ]
      const followUp = await callGroqWithRetry({
        messages: followUpMessages,
        temperature: 0.4,
        max_tokens: 1000,
      })
      const followUpContent = followUp.choices[0]?.message?.content ?? ''
      const resolved = resolveSanitizedToken(followUpContent, tokenMap) ?? followUpContent
      return NextResponse.json({ response: resolved, tool_used: toolCall.name })
    }

    const resolved = resolveSanitizedToken(rawResponse, tokenMap) ?? rawResponse
    return NextResponse.json({ response: resolved })
  } catch (err) {
    logger.error('[tempo-ai] error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'agent_error' }, { status: 502 })
  }
}
