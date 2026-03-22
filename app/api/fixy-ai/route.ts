import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { TOOLS, buildToolDescriptions, type ToolResult } from './tools'
import { callGroqWithRetry, type GroqResponse } from '@/lib/groq'
import crypto from 'crypto'
import { getAuthUser, unauthorizedResponse, verifyArtisanOwnership } from '@/lib/auth-helpers'
import { checkRateLimit as checkRL } from '@/lib/rate-limit'
import { fixyAiSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'

export const maxDuration = 30

// ── Fixy AI v2 — Assistant IA avec exécution d'actions serveur ────────────────

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

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
const JOUR_NOMS_LC = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

// ── Build system prompt ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Artisan context from frontend with dynamic shape
function buildSystemPrompt(context: Record<string, any>, locale?: string): string {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const dayName = DAY_NAMES[today.getDay()]

  // Pré-calculer les dates relatives
  const dateMapping: string[] = []
  dateMapping.push(`  - "aujourd'hui" = ${todayStr} (${JOUR_NOMS_LC[today.getDay()]})`)
  const demain = new Date(today); demain.setDate(demain.getDate() + 1)
  dateMapping.push(`  - "demain" = ${demain.toISOString().split('T')[0]} (${JOUR_NOMS_LC[demain.getDay()]})`)
  const apDemain = new Date(today); apDemain.setDate(apDemain.getDate() + 2)
  dateMapping.push(`  - "après-demain" = ${apDemain.toISOString().split('T')[0]} (${JOUR_NOMS_LC[apDemain.getDay()]})`)
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today); d.setDate(d.getDate() + i)
    dateMapping.push(`  - "${JOUR_NOMS_LC[d.getDay()]}" = ${d.toISOString().split('T')[0]}`)
  }
  const dateMappingStr = dateMapping.join('\n')

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

  let systemPrompt = `Tu es **Fixy 🔧**, l'assistant IA expert de ${context.artisan_name || "l'artisan"} sur Vitfix.
Tu es un assistant efficace, proactif, amical et HONNÊTE. Tu parles français.

📅 Aujourd'hui : ${dayName} ${today.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} (${todayStr})

## Compréhension vocale avancée
Tu comprends et traites parfaitement :
- Les **dictées vocales** (phrases longues, avec hésitations, reformulations)
- Les **abréviations orales** : "met", "mets", "rajoute", "enlève", "supprime", "active", "désactive"
- Le **langage naturel parlé** : "bloque-moi la semaine prochaine", "j'suis pas dispo mardi", "met une absence"
- Les **fautes d'orthographe** et le langage SMS : "ajd", "demain mat", "g pas dispo", "c bon"
- Les **demandes enchaînées** : "active tous mes motifs ET mets une absence du 5 au 10 mars"
- Les **termes approximatifs** : "mes vacances" = absence, "mes congés" = absence, "indispo" = absence

## Détection intelligente (clients, motifs, vocal)

### Clients
Quand un nom de client est dicté, cherche dans la liste ci-dessous (CLIENTS EXISTANTS).
Compare avec tolérance : ignore majuscules/accents, accepte les prononciations proches
(Levenshtein ≥ 80%). "Dupond" = "Dupont", "Lépore" = "Lepore", "Seb" → "Sebastien".
Si trouvé → utilise ses coordonnées (adresse, téléphone, email) sans demander confirmation.
Si pas trouvé → crée avec le nom dicté, c'est normal pour un nouveau client.

### Motifs/Services
Quand un type d'intervention est mentionné, compare avec les SERVICES/MOTIFS ci-dessous.
Utilise la correspondance sémantique, pas juste exacte :
- "élagage" → "Élagage d'arbres" ✅
- "taille" → "Taille de haies" ✅
- "nettoy" → "Nettoyage de bâtiments" ✅
- "gazon" → "Tonte de pelouse" ✅
Si trouvé → utilise le motif existant avec son prix configuré.
Si pas trouvé → crée une ligne personnalisée avec le prix dicté.

### Tolérance vocale
La reconnaissance vocale déforme les mots. Gère :
- Chiffres parlés : "cent cinquante euros" = 150€, "deux cent" = 200
- Adresses approximatives : "rue de la paix à Marseille" → reconstituer
- Noms déformés : accepter si ≥ 80% de similarité avec un client/motif connu

═══ MODULES ACCESSIBLES ═══
Tu as accès à TOUS les modules du dashboard artisan :
- 📅 RDV/Agenda : créer, confirmer, annuler, reprogrammer, détails
- ⏰ Disponibilités : jours, horaires, services liés
- 🔧 Motifs/Services : créer, modifier, activer/désactiver, supprimer, lier aux jours
- 🗓️ Absences/Congés : créer, lister, supprimer des périodes d'indisponibilité
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

ABSENCES/CONGÉS :
${(() => {
    const abs = (context.absences || [])
    if (abs.length === 0) return '(Aucune absence planifiée)'
    return abs.map((a: any) => {
      const s = new Date(a.start_date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      const e = new Date(a.end_date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      return `- ID:${a.id} | Du ${s} au ${e}${a.reason ? ` (${a.reason})` : ''}${a.label ? ` — ${a.label}` : ''}`
    }).join('\n')
  })()}

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

6. DATES RELATIVES — **UTILISE OBLIGATOIREMENT** cette table de conversion :
${dateMappingStr}
   ⚠️ UTILISE TOUJOURS les dates de cette table. Ne calcule JAMAIS une date toi-même.
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
- "met une absence du 5 au 10 mars" → actions: [{ "tool": "create_absence", "params": { "start_date": "2026-03-05", "end_date": "2026-03-10", "reason": "Vacances" } }]
- "je suis en vacances la semaine prochaine" → actions: [{ "tool": "create_absence", "params": { "start_date": "(lundi prochain)", "end_date": "(vendredi prochain)", "reason": "Vacances" } }]
- "bloque-moi mardi" → actions: [{ "tool": "create_absence", "params": { "start_date": "(mardi date)", "end_date": "(mardi date)", "reason": "Personnel" } }]
- "j'suis pas dispo demain" → actions: [{ "tool": "create_absence", "params": { "start_date": "(demain date)", "end_date": "(demain date)", "reason": "Personnel" } }]
- "mes absences" → actions: [{ "tool": "list_absences" }]
- "supprime mon absence" → pending_confirmation avec delete_absence

NE JAMAIS inclure de texte avant ou après le JSON.`

  if (locale === 'pt') {
    // Prepend Portuguese context to the system prompt
    const ptContext = `
LÍNGUA: Comunicas exclusivamente em português europeu (PT-PT). Nunca uses termos brasileiros.

VOCABULÁRIO OBRIGATÓRIO:
- "profissional" (nunca "artesão" — artesão = artisan d'art em Portugal)
- "orçamento" para devis (nunca "cotação")
- "obras" para travaux
- "remodelação" para rénovation (nunca "renovação")
- "casa de banho" (nunca "banheiro")
- "canalizador" para plombier
- "eletricista" para électricien
- "pedreiro" para maçon
- "registar-se" (nunca "cadastrar-se")

CONTEXTO LOCAL PORTUGAL:
- Cidades e distritos: Lisboa, Porto, Braga, Coimbra, Faro, Setúbal, Aveiro, Viseu, Leiria, Évora, Guimarães
- Códigos postais: XXXX-XXX (ex: 4710-057)
- Telefones: +351 XXX XXX XXX (9 dígitos após indicativo)
- NIF (Número de Identificação Fiscal) em vez de SIRET
- Moeda: Euro (€)
- Formato data: "1 de março de 2026" ou "01/03/2026"

REGRAS PROFISSIONAIS PORTUGAL:
- Horários obras com ruído: dias úteis, 8h00-20h00 (DL 9/2007)
- Fins de semana: trabalhos ruidosos proibidos em condomínios
- Eletricistas: certificação DGEG obrigatória
- Empreiteiros: alvará IMPIC obrigatório
- Seguro RC obrigatório para profissionais
- IVA: 23% standard, 6% reabilitação urbana

EMAILS em PT:
- Abertura: "Exmo(a) Sr(a) [Nome]," ou "Caro(a) [Nome],"
- Fecho: "Com os melhores cumprimentos,"
`
    systemPrompt = ptContext + '\n\n' + systemPrompt.replace(/Tu es \*\*Fixy 🔧\*\*/, 'Tu és o **Fixy 🔧**')
  }

  return systemPrompt
}

// ── Main POST handler ───────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = validateBody(fixyAiSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { message, artisan_id, context, conversation_history, locale } = validation.data

    // ── Auth: verify Bearer token and artisan ownership ──
    const user = await getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const verified = await verifyArtisanOwnership(user.id, artisan_id, supabaseAdmin)
    if (!verified) {
      return NextResponse.json({ error: 'Forbidden: artisan_id mismatch' }, { status: 403 })
    }

    if (!(await checkRL(`fixy_ai_${artisan_id}`, 30, 60_000))) {
      return NextResponse.json({ success: false, response: 'Tu vas trop vite ! Attends un peu avant de renvoyer un message.', actions_executed: [], client_actions: [] })
    }

    if (!GROQ_API_KEY) {
      return NextResponse.json({ success: false, response: 'Service IA indisponible. Réessaie plus tard.', actions_executed: [], client_actions: [] })
    }

    // Build system prompt with full context
    const systemPrompt = buildSystemPrompt(context || {}, locale)

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
    let groqData: GroqResponse
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic AI JSON response
    let parsed: Record<string, any>
    try { parsed = JSON.parse(content) } catch {
      logger.error('[fixy-ai] Failed to parse Groq response:', content.substring(0, 200))
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
      } catch (execErr: unknown) {
        const errMsg = execErr instanceof Error ? execErr.message : 'inconnue'
        actionsExecuted.push({
          tool: toolName,
          result: 'error',
          detail: `Erreur d'exécution : ${errMsg}`,
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

  } catch (error: unknown) {
    logger.error('[fixy-ai] Error:', error)
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

  } catch (error: unknown) {
    logger.error('[fixy-ai] Confirm error:', error)
    return NextResponse.json({ success: false, detail: 'Erreur serveur' }, { status: 500 })
  }
}
