import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { TOOLS, buildToolDescriptions, type ToolResult } from './tools'
import { callGroqWithRetry } from '@/lib/groq'
import crypto from 'crypto'
import { getAuthUser, unauthorizedResponse, verifyArtisanOwnership } from '@/lib/auth-helpers'
import { fixyAiSchema, validateBody } from '@/lib/validation'

export const maxDuration = 30

// ── Fixy AI v2 — Assistant IA avec exécution d'actions serveur ────────────────

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

// ── Rate limiting (in-memory, per artisan) ───────────────────────────────────
const rateLimits = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 30 // max requests per window
const RATE_WINDOW = 60_000 // 1 minute

function checkRateLimit(artisanId: string): boolean {
  const now = Date.now()
  const entry = rateLimits.get(artisanId)
  if (!entry || entry.resetAt < now) {
    rateLimits.set(artisanId, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// Cleanup rate limits every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimits) {
    if (entry.resetAt < now) rateLimits.delete(key)
  }
}, 300_000)

// ── Pending confirmations (in-memory, TTL 5min) ─────────────────────────────
const pendingConfirmations = new Map<string, {
  tool: string
  params: Record<string, unknown>
  artisanId: string
  expiresAt: number
}>()

// Cleanup expired tokens every 2 minutes
setInterval(() => {
  const now = Date.now()
  for (const [token, data] of pendingConfirmations) {
    if (data.expiresAt < now) pendingConfirmations.delete(token)
  }
}, 120_000)

// ── Day names for prompt ────────────────────────────────────────────────────
const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

// ── Build system prompt ─────────────────────────────────────────────────────
function buildSystemPrompt(context: any): string {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const dayName = DAY_NAMES[today.getDay()]

  // Services
  const serviceLines = (context.services || []).map((s: any) =>
    `- ID:${s.id} | ${s.name} | ${s.active ? 'ACTIF' : 'INACTIF'} | ${s.price_ttc ? s.price_ttc + '€' : 'prix libre'} | ${s.duration_minutes || 60}min`
  ).join('\n') || '(Aucun)'

  // Availability
  const availLines = [0, 1, 2, 3, 4, 5, 6].map(d => {
    const slot = (context.availability || []).find((a: any) => a.day_of_week === d)
    const linked = (context.dayServices || {})[String(d)]
    const linkedNames = linked?.length
      ? linked.map((sid: string) => {
          const svc = (context.services || []).find((s: any) => s.id === sid)
          return svc?.name || sid.substring(0, 8)
        }).join(', ')
      : 'aucun'
    if (!slot) return `${DAY_NAMES[d]}: NON CONFIGURÉ | Services: ${linkedNames}`
    return `${DAY_NAMES[d]}: ${slot.is_available ? `OUVERT ${slot.start_time?.substring(0, 5)}-${slot.end_time?.substring(0, 5)}` : 'FERMÉ'} | Services liés: ${linkedNames}`
  }).join('\n')

  // Bookings
  const bookingLines = (context.bookings || []).slice(0, 10).map((b: any) =>
    `- ID:${b.id} | ${b.booking_date} ${(b.booking_time || '').substring(0, 5)} | ${b.service_name || 'Intervention'} | ${b.client_name || 'Inconnu'} | ${b.status}`
  ).join('\n') || '(Aucun)'

  // Clients
  const clientLines = (context.clients || []).slice(0, 20).map((c: any) =>
    `- ${c.name}${c.phone ? ` (${c.phone})` : ''}${c.email ? ` [${c.email}]` : ''}`
  ).join('\n') || '(Aucun)'

  // Tool descriptions
  const toolDesc = buildToolDescriptions()

  return `Tu es Fixy, l'assistant IA de ${context.artisan_name || "l'artisan"} sur Vitfix.
Tu es un robot efficace 🔧, amical et HONNÊTE. Tu parles français.

📅 Aujourd'hui : ${dayName} ${today.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} (${todayStr})

═══ MODULES ACCESSIBLES ═══
Tu as accès à TOUS les modules du dashboard artisan :
- 📅 RDV/Agenda : créer, confirmer, annuler, reprogrammer, détails
- ⏰ Disponibilités : jours, horaires, services liés
- 🔧 Motifs/Services : créer, modifier, activer/désactiver, supprimer, lier aux jours
- 👥 Clients : liste complète, détails, historique RDV, CA par client
- 💬 Messages : lire et envoyer des messages dans les RDV
- 💰 Comptabilité : CA par période, données URSSAF, déclaration trimestrielle
- 📄 Devis/Factures : créer via formulaire client
- 🏢 Infos entreprise : SIRET, forme juridique, adresse, NAF
- ⚙️ Paramètres : message auto-réponse, durée blocage auto
- 🧭 Navigation : ouvrir n'importe quelle page du dashboard

═══ ÉTAT ACTUEL DE L'ARTISAN ═══

SERVICES/MOTIFS :
${serviceLines}

DISPONIBILITÉS :
${availLines}

PROCHAINS RDV :
${bookingLines}

CLIENTS :
${clientLines}

═══ OUTILS DISPONIBLES ═══
${toolDesc}

═══ RÈGLES CRITIQUES ═══

1. TOLÉRANCE ORTHOGRAPHIQUE : L'artisan écrit souvent mal le français.
   "activ tout mes motif" = "active tous mes motifs"
   "met mon lundi de 9 a 18" = "mets lundi de 9h à 18h"
   "desactiv le samdi" = "désactive le samedi"
   "c koi mes dispo" = "c'est quoi mes disponibilités"
   "conbien jai gagner" = "combien j'ai gagné"
   Comprends le SENS, pas l'orthographe.

2. HONNÊTETÉ ABSOLUE : Si tu retournes un tableau "actions" vide, NE DIS PAS "c'est fait".
   Tu peux UNIQUEMENT dire "c'est fait" si tu as des actions dans le tableau.
   Si tu ne peux pas faire quelque chose → dis-le clairement.

3. MULTI-ÉTAPES : Pour "active tous mes services sur toutes mes plages" :
   actions: [
     { "tool": "toggle_service_active", "params": { "service_id": "all", "active": true } },
     { "tool": "link_services_to_days", "params": { "day_of_week": "all", "service_ids": "all", "mode": "set" } }
   ]

4. CONFIRMATION : Les outils marqués ⚠️ (delete_service, cancel_booking) doivent aller dans "pending_confirmation" et PAS dans "actions".

5. IDs : Utilise les vrais IDs du contexte ci-dessus. JAMAIS inventer un ID.

6. DATES RELATIVES : "demain" = jour après ${todayStr}. "lundi" = prochain lundi.
   "la semaine prochaine" = semaine qui commence lundi prochain.

7. create_devis / create_facture : retourne-les dans "client_actions" car c'est le client qui ouvre le formulaire.

8. NAVIGATION : "ouvre la comptabilité", "va aux factures", "montre mes stats" → actions: [{ "tool": "navigate_to", "params": { "page": "..." } }]
   Le résultat de navigate_to sera automatiquement converti en client_action navigate.

9. FORMAT RÉPONSE — JSON valide, structure EXACTE :
{
  "actions": [
    { "tool": "nom_outil", "params": { ... } }
  ],
  "response": "Ta réponse naturelle (courte, avec emojis et **gras**)",
  "client_actions": [
    { "type": "open_devis_form", "data": { ... } }
  ],
  "pending_confirmation": null
}

Si action destructive :
{
  "actions": [],
  "response": "Tu veux vraiment annuler ce RDV ?",
  "client_actions": [],
  "pending_confirmation": {
    "tool": "cancel_booking",
    "params": { "booking_id": "xxx" },
    "description": "Annuler le RDV du 15 mars avec Dupont"
  }
}

EXEMPLES :
- "mes dispos" → actions: [{ "tool": "list_availability" }]
- "active le mardi" → actions: [{ "tool": "set_day_availability", "params": { "day_of_week": 2, "is_available": true } }]
- "active tous mes motifs sur mes plages" → actions multiples toggle_service_active + link_services_to_days
- "fait un devis pour dupont 500€ élagage" → client_actions: [{ "type": "open_devis_form", "data": { "clientName": "Dupont", ... } }]
- "confirme le rdv de demain" → cherche le booking_id dans le contexte, puis actions: [{ "tool": "confirm_booking", ... }]
- "met le prix de plomberie à 80€" → actions: [{ "tool": "update_service", "params": { "service_id": "...", "price_ttc": 80, "price_ht": 66.67 } }]
- "déplace le rdv de demain à vendredi 10h" → actions: [{ "tool": "reschedule_booking", "params": { "booking_id": "...", "new_date": "...", "new_time": "10:00" } }]
- "combien j'ai gagné ce mois" → actions: [{ "tool": "get_revenue_summary", "params": { "period": "month" } }]
- "ma liste de clients" → actions: [{ "tool": "list_clients" }]
- "les messages du rdv de dupont" → actions: [{ "tool": "list_booking_messages", "params": { "booking_id": "..." } }]
- "envoie un message : on arrive à 14h" → actions: [{ "tool": "send_booking_message", "params": { "booking_id": "...", "content": "On arrive à 14h" } }]
- "ma déclaration URSSAF" → actions: [{ "tool": "get_quarterly_data" }]
- "mon SIRET" → actions: [{ "tool": "get_company_info" }]
- "ouvre la comptabilité" → actions: [{ "tool": "navigate_to", "params": { "page": "comptabilite" } }]

NE JAMAIS inclure de texte avant ou après le JSON.`
}

// ── Main POST handler ───────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = validateBody(fixyAiSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { message, artisan_id, context, conversation_history } = validation.data

    // ── Auth: verify Bearer token and artisan ownership ──
    const user = await getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const verified = await verifyArtisanOwnership(user.id, artisan_id, supabaseAdmin)
    if (!verified) {
      return NextResponse.json({ error: 'Forbidden: artisan_id mismatch' }, { status: 403 })
    }

    if (!checkRateLimit(artisan_id)) {
      return NextResponse.json({ success: false, response: 'Tu vas trop vite ! Attends un peu avant de renvoyer un message.', actions_executed: [], client_actions: [] })
    }

    if (!GROQ_API_KEY) {
      return NextResponse.json({ success: false, response: 'Service IA indisponible. Réessaie plus tard.', actions_executed: [], client_actions: [] })
    }

    // Build system prompt with full context
    const systemPrompt = buildSystemPrompt(context || {})

    // Build conversation messages
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ]
    // Add conversation history (last 12 messages = ~6 turns)
    if (conversation_history && Array.isArray(conversation_history)) {
      for (const m of conversation_history.slice(-12)) {
        messages.push({ role: m.role, content: m.content })
      }
    }
    messages.push({ role: 'user', content: message })

    // Call Groq API with retry
    let groqData: any
    try {
      groqData = await callGroqWithRetry({
        messages,
        temperature: 0.2,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      })
    } catch {
      return NextResponse.json({ success: false, response: 'Erreur IA temporaire. Réessaie dans quelques instants.', actions_executed: [], client_actions: [] })
    }
    const content = groqData.choices?.[0]?.message?.content || ''

    let parsed: any
    try { parsed = JSON.parse(content) } catch {
      console.error('Failed to parse Groq response:', content)
      return NextResponse.json({ success: false, response: 'Je n\'ai pas bien compris. Reformule ?', actions_executed: [], client_actions: [] })
    }

    // ── EXECUTION PHASE ──────────────────────────────────────────────────
    const actionsExecuted: Array<{ tool: string; result: string; detail: string }> = []
    let pendingConf = null

    // Handle pending_confirmation from AI
    if (parsed.pending_confirmation && parsed.pending_confirmation.tool) {
      const pc = parsed.pending_confirmation
      const toolDef = TOOLS[pc.tool]
      if (toolDef && toolDef.requiresConfirmation) {
        const token = crypto.randomUUID()
        pendingConfirmations.set(token, {
          tool: pc.tool,
          params: pc.params || {},
          artisanId: artisan_id,
          expiresAt: Date.now() + 5 * 60 * 1000,
        })
        pendingConf = {
          tool: pc.tool,
          params: pc.params || {},
          description: pc.description || `Exécuter ${pc.tool}`,
          confirm_token: token,
        }
      }
    }

    // Execute non-destructive actions
    const actions = Array.isArray(parsed.actions) ? parsed.actions : []
    for (const action of actions) {
      const toolName = action.tool
      const toolDef = TOOLS[toolName]

      if (!toolDef) {
        actionsExecuted.push({ tool: toolName, result: 'error', detail: `Outil "${toolName}" inconnu` })
        continue
      }

      // If tool needs confirmation but AI put it in actions, move to pending
      if (toolDef.requiresConfirmation) {
        if (!pendingConf) {
          const token = crypto.randomUUID()
          pendingConfirmations.set(token, {
            tool: toolName,
            params: action.params || {},
            artisanId: artisan_id,
            expiresAt: Date.now() + 5 * 60 * 1000,
          })
          pendingConf = {
            tool: toolName,
            params: action.params || {},
            description: `Exécuter ${toolName}`,
            confirm_token: token,
          }
        }
        continue
      }

      // Execute the tool
      try {
        const result: ToolResult = await toolDef.execute(action.params || {}, artisan_id)
        actionsExecuted.push({
          tool: toolName,
          result: result.success ? 'success' : 'error',
          detail: result.detail,
        })
      } catch (execErr: any) {
        actionsExecuted.push({
          tool: toolName,
          result: 'error',
          detail: `Erreur d'exécution : ${execErr.message || 'inconnue'}`,
        })
      }
    }

    // Build client_actions array
    const clientActions = Array.isArray(parsed.client_actions) ? parsed.client_actions : []

    // Also handle legacy intents: if AI returns create_devis/create_facture as action
    for (const action of actions) {
      if (action.tool === 'create_devis' || action.tool === 'create_facture') {
        clientActions.push({
          type: action.tool === 'create_devis' ? 'open_devis_form' : 'open_facture_form',
          data: action.params || {},
        })
      }
    }

    // Handle navigate_to results → push as client_action navigate
    for (const exec of actionsExecuted) {
      if (exec.tool === 'navigate_to' && exec.result === 'success') {
        // Extract page from the detail (format: "Navigation vers pageName")
        const pageMatch = exec.detail.match(/Navigation vers\s+(\S+)/)
        if (pageMatch) {
          clientActions.push({ type: 'navigate', page: pageMatch[1] })
        }
      }
    }

    // If any actions were executed, ask client to refresh data
    if (actionsExecuted.some(a => a.result === 'success')) {
      clientActions.push({ type: 'refresh_data' })
    }

    return NextResponse.json({
      success: true,
      response: parsed.response || 'Action effectuée.',
      actions_executed: actionsExecuted,
      pending_confirmation: pendingConf,
      client_actions: clientActions,
    })

  } catch (error: any) {
    console.error('Fixy AI error:', error)
    return NextResponse.json({
      success: false,
      response: 'Oups, une erreur est survenue. Réessaie !',
      actions_executed: [],
      client_actions: [],
    })
  }
}

// ── GET: Confirm pending action ─────────────────────────────────────────────
// Using GET with query params for simplicity (called from client)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { artisan_id, confirm_token, confirmed } = body

    if (!confirm_token) {
      return NextResponse.json({ error: 'confirm_token requis' }, { status: 400 })
    }

    // ── Auth: verify Bearer token and artisan ownership ──
    const user = await getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const verified = await verifyArtisanOwnership(user.id, artisan_id, supabaseAdmin)
    if (!verified) {
      return NextResponse.json({ error: 'Forbidden: artisan_id mismatch' }, { status: 403 })
    }

    const pending = pendingConfirmations.get(confirm_token)
    if (!pending) {
      return NextResponse.json({ success: false, detail: 'Action expirée ou déjà traitée.' })
    }

    if (pending.artisanId !== artisan_id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    pendingConfirmations.delete(confirm_token)

    if (!confirmed) {
      return NextResponse.json({ success: true, detail: 'Action annulée.' })
    }

    // Execute the tool
    const toolDef = TOOLS[pending.tool]
    if (!toolDef) {
      return NextResponse.json({ success: false, detail: `Outil "${pending.tool}" introuvable.` })
    }

    const result = await toolDef.execute(pending.params, pending.artisanId)
    return NextResponse.json({
      success: result.success,
      detail: result.detail,
      tool: pending.tool,
    })

  } catch (error: any) {
    console.error('Fixy confirm error:', error)
    return NextResponse.json({ success: false, detail: 'Erreur serveur' }, { status: 500 })
  }
}
